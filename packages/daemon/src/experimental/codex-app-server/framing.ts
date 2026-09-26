export interface FrameLimits {
  maxLineBytes: number;
  maxBufferBytes: number;
  maxQueued: number;
  maxPending: number;
}

export const DEFAULT_FRAME_LIMITS: FrameLimits = Object.freeze({
  maxLineBytes: 256 * 1024,
  maxBufferBytes: 512 * 1024,
  maxQueued: 8,
  maxPending: 8
});

export interface FrameError {
  code: "line_too_long" | "buffer_overflow" | "invalid_utf8" | "invalid_json";
  byteLength: number;
}

export interface FrameBatch {
  messages: unknown[];
  errors: FrameError[];
}

/**
 * JSONL 按字节切行。0x0A 在 UTF-8 里只能是 ASCII 换行,不会落在多字节字符中间,
 * 所以未完整的行留在字节缓冲里,整行再用 fatal UTF-8 解码。
 */
export class ByteLineFramer {
  private buf = Buffer.alloc(0);
  private discarding = false;

  constructor(private readonly limits: Pick<FrameLimits, "maxLineBytes" | "maxBufferBytes">) {}

  reset(): void {
    this.buf = Buffer.alloc(0);
    this.discarding = false;
  }

  push(chunk: Buffer): FrameBatch {
    const messages: unknown[] = [];
    const errors: FrameError[] = [];
    let rest = chunk;
    while (rest.length > 0) {
      if (this.discarding) {
        const nl = rest.indexOf(0x0a);
        if (nl === -1) return { messages, errors };
        this.discarding = false;
        rest = rest.subarray(nl + 1);
        continue;
      }
      const nl = rest.indexOf(0x0a);
      if (nl === -1) {
        const total = this.buf.length + rest.length;
        if (total > this.limits.maxBufferBytes) {
          errors.push({ code: "buffer_overflow", byteLength: total });
          this.buf = Buffer.alloc(0);
          this.discarding = true;
          return { messages, errors };
        }
        if (total > this.limits.maxLineBytes) {
          errors.push({ code: "line_too_long", byteLength: total });
          this.buf = Buffer.alloc(0);
          this.discarding = true;
          return { messages, errors };
        }
        this.buf = this.buf.length === 0 ? Buffer.from(rest) : Buffer.concat([this.buf, rest]);
        return { messages, errors };
      }
      const piece = rest.subarray(0, nl);
      rest = rest.subarray(nl + 1);
      const lineLen = this.buf.length + piece.length;
      if (lineLen > this.limits.maxLineBytes) {
        errors.push({ code: "line_too_long", byteLength: lineLen });
        this.buf = Buffer.alloc(0);
        continue;
      }
      const line = this.buf.length === 0 ? Buffer.from(piece) : Buffer.concat([this.buf, piece]);
      this.buf = Buffer.alloc(0);
      const stripped = line.length > 0 && line[line.length - 1] === 0x0d ? line.subarray(0, line.length - 1) : line;
      if (stripped.length === 0) continue;
      const parsed = decodeJsonLine(stripped);
      if (!parsed.ok) errors.push(parsed.error);
      else messages.push(parsed.value);
    }
    return { messages, errors };
  }
}

function decodeJsonLine(line: Buffer): { ok: true; value: unknown } | { ok: false; error: FrameError } {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(line);
  } catch {
    return { ok: false, error: { code: "invalid_utf8", byteLength: line.length } };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: { code: "invalid_json", byteLength: line.length } };
  }
}

export interface ByteSink {
  write(chunk: Buffer): boolean;
  end(): void;
  on(event: "drain", listener: () => void): void;
  off(event: "drain", listener: () => void): void;
}

export interface QueueHooks {
  onWritten: () => void;
  onDropped: () => void;
  /** 入队后、pump 前给出取消函数。尚未 write 时取消返回 true。 */
  onQueued?: (cancel: () => boolean) => void;
}

/** write() 返回 false 时停止继续 write,等 drain。未 write 的本地队列在 close 时丢弃。 */
export class OutboundQueue {
  private queue: Array<{ bytes: Buffer; hooks: QueueHooks }> = [];
  private waiting = false;
  private closed = false;
  private pumping = false;
  private readonly onDrain = (): void => {
    this.waiting = false;
    this.pump();
  };

  constructor(
    private readonly sink: ByteSink,
    private readonly maxQueued: number,
    private readonly maxLineBytes: number,
    private readonly onBroken: () => void
  ) {}

  get queued(): number {
    return this.queue.length;
  }

  enqueue(bytes: Buffer, hooks: QueueHooks): "accepted" | "full" | "closed" | "too_big" {
    if (this.closed) return "closed";
    if (bytes.length > this.maxLineBytes) return "too_big";
    if (this.queue.length >= this.maxQueued) return "full";
    const item = { bytes, hooks };
    this.queue.push(item);
    hooks.onQueued?.(() => {
      const index = this.queue.indexOf(item);
      if (index < 0) return false;
      this.queue.splice(index, 1);
      return true;
    });
    this.pump();
    return "accepted";
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.waiting = false;
    this.sink.off("drain", this.onDrain);
    const dropped = this.queue.splice(0);
    for (const item of dropped) item.hooks.onDropped();
    try {
      this.sink.end();
    } catch {
      // stdin 已经关闭
    }
  }

  private pump(): void {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (!this.waiting && !this.closed && this.queue.length > 0) {
        const item = this.queue[0];
        if (!item) break;
        let accepted = false;
        try {
          accepted = this.sink.write(item.bytes) !== false;
        } catch {
          this.closed = true;
          const dropped = this.queue.splice(0);
          for (const entry of dropped) entry.hooks.onDropped();
          this.onBroken();
          return;
        }
        this.queue.shift();
        item.hooks.onWritten();
        if (!accepted) {
          this.waiting = true;
          this.sink.off("drain", this.onDrain);
          this.sink.on("drain", this.onDrain);
        }
      }
    } finally {
      this.pumping = false;
    }
  }
}

export function encodeLine(value: unknown, maxLineBytes: number): Buffer {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  if (body.length + 1 > maxLineBytes) {
    throw new Error("line_too_long");
  }
  return Buffer.concat([body, Buffer.from([0x0a])]);
}

export function asBuffer(chunk: Buffer | string): Buffer {
  return Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
}
