// 最小 CBOR 编解码(RFC 8949 子集;零第三方依赖)——WebAuthn attestationObject 与 COSE key 专用。
// 解码:definite-length 的 uint/negint/bytes/text/array/map(WebAuthn 实现均为 definite);
// indefinite length / 浮点 / tag 一律拒(fail-closed:S3 面不解析用不到的形态)。
// 编码:测试与 fixture 构造用(生产路径只解码)。

export type CborValue = number | string | Uint8Array | CborValue[] | CborMap;
export type CborMap = Map<number | string, CborValue>;

class CborReader {
  private off = 0;
  constructor(private readonly buf: Uint8Array) {}

  private byte(): number {
    if (this.off >= this.buf.length) throw new Error("cbor: unexpected end of input");
    return this.buf[this.off++] as number;
  }

  private take(n: number): Uint8Array {
    if (this.off + n > this.buf.length) throw new Error("cbor: unexpected end of input");
    const out = this.buf.subarray(this.off, this.off + n);
    this.off += n;
    return out;
  }

  private length(info: number): number {
    if (info < 24) return info;
    if (info === 24) return this.byte();
    if (info === 25) {
      const b = this.take(2);
      return ((b[0] as number) << 8) | (b[1] as number);
    }
    if (info === 26) {
      const b = this.take(4);
      return (((b[0] as number) << 24) | ((b[1] as number) << 16) | ((b[2] as number) << 8) | (b[3] as number)) >>> 0;
    }
    // info 27(uint64)/28-30(保留)/31(indefinite):S3 面用不到,fail-closed
    throw new Error(`cbor: unsupported length encoding (info=${info})`);
  }

  value(): CborValue {
    const initial = this.byte();
    const major = initial >> 5;
    const info = initial & 0x1f;
    switch (major) {
      case 0: // unsigned int
        return this.length(info);
      case 1: // negative int = -1 - n
        return -1 - this.length(info);
      case 2: // byte string
        return new Uint8Array(this.take(this.length(info)));
      case 3: // text string
        return new TextDecoder("utf-8", { fatal: true }).decode(this.take(this.length(info)));
      case 4: {
        const n = this.length(info);
        const arr: CborValue[] = [];
        for (let i = 0; i < n; i++) arr.push(this.value());
        return arr;
      }
      case 5: {
        const n = this.length(info);
        const map: CborMap = new Map();
        for (let i = 0; i < n; i++) {
          const k = this.value();
          if (typeof k !== "number" && typeof k !== "string") throw new Error("cbor: map key must be int or text");
          if (map.has(k)) throw new Error("cbor: duplicate map key");
          map.set(k, this.value());
        }
        return map;
      }
      default:
        throw new Error(`cbor: unsupported major type ${major} (tag/float/simple rejected, fail-closed)`);
    }
  }

  done(): boolean {
    return this.off >= this.buf.length;
  }

  offset(): number {
    return this.off;
  }
}

/** 解码单个 CBOR 值;trailing bytes 拒(attestationObject 是单值文档) */
export function decodeCbor(buf: Uint8Array): CborValue {
  const r = new CborReader(buf);
  const v = r.value();
  if (!r.done()) throw new Error("cbor: trailing bytes after value");
  return v;
}

/** 解码首个 CBOR 值并返回其字节长(authenticatorData 内嵌 COSE key 后可能跟 extensions) */
export function decodeCborPrefix(buf: Uint8Array): { value: CborValue; bytes: number } {
  const r = new CborReader(buf);
  const v = r.value();
  return { value: v, bytes: r.offset() };
}

// ---------- 编码(测试/fixture 构造用;生产路径只解码) ----------

function encodeHead(major: number, n: number): number[] {
  if (n < 24) return [(major << 5) | n];
  if (n < 0x100) return [(major << 5) | 24, n];
  if (n < 0x10000) return [(major << 5) | 25, n >> 8, n & 0xff];
  return [(major << 5) | 26, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

export function encodeCbor(v: CborValue): Uint8Array {
  const out: number[] = [];
  const write = (x: CborValue): void => {
    if (typeof x === "number") {
      if (!Number.isInteger(x)) throw new Error("cbor encode: only integers");
      if (x >= 0) out.push(...encodeHead(0, x));
      else out.push(...encodeHead(1, -1 - x));
      return;
    }
    if (typeof x === "string") {
      const b = new TextEncoder().encode(x);
      out.push(...encodeHead(3, b.length), ...b);
      return;
    }
    if (x instanceof Uint8Array) {
      out.push(...encodeHead(2, x.length), ...x);
      return;
    }
    if (Array.isArray(x)) {
      out.push(...encodeHead(4, x.length));
      for (const item of x) write(item);
      return;
    }
    out.push(...encodeHead(5, x.size));
    for (const [k, val] of x) {
      write(k);
      write(val);
    }
  };
  write(v);
  return new Uint8Array(out);
}
