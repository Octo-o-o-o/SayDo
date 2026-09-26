import { describe, expect, it } from "vitest";
import { ByteLineFramer, OutboundQueue, encodeLine } from "../../src/experimental/codex-app-server/framing.js";
import { turnSchema, commandDeclineSchema, emptyPermissionsSchema } from "../../src/experimental/codex-app-server/protocol.js";
import { SCHEMA_PROVENANCE, PINNED_CODEX_CLI_VERSION } from "../../src/experimental/codex-app-server/provenance.js";
import { Gate } from "./support.js";

describe("codex app-server framing", () => {
  it("按字节保留被切开的 UTF-8,并拆开粘包", () => {
    const framer = new ByteLineFramer({ maxLineBytes: 1024, maxBufferBytes: 2048 });
    const first = Buffer.from(`${JSON.stringify({ method: "notice", params: { text: "中文边界" } })}\n`);
    const second = Buffer.from(`${JSON.stringify({ method: "next" })}\n`);
    const both = Buffer.concat([first, second]);
    const marker = Buffer.from("中");
    const at = first.indexOf(marker);
    const split = at + 1;
    expect(framer.push(both.subarray(0, split)).messages).toEqual([]);
    const rest = framer.push(both.subarray(split));
    expect(rest.errors).toEqual([]);
    expect(rest.messages).toHaveLength(2);
    expect((rest.messages[0] as { params: { text: string } }).params.text).toBe("中文边界");
    expect(rest.messages[1]).toMatchObject({ method: "next" });
  });

  it("超长行和缓冲上限都不是成功消息,之后的合法行仍可解析", () => {
    const framer = new ByteLineFramer({ maxLineBytes: 32, maxBufferBytes: 20 });
    const overflow = framer.push(Buffer.alloc(21, 0x61));
    expect(overflow.messages).toEqual([]);
    expect(overflow.errors[0]?.code).toBe("buffer_overflow");
    const limited = new ByteLineFramer({ maxLineBytes: 16, maxBufferBytes: 100 });
    const huge = Buffer.concat([Buffer.alloc(30, 0x62), Buffer.from("\n"), Buffer.from('{"ok":true}\n')]);
    const parsed = limited.push(huge);
    expect(parsed.errors.some((error) => error.code === "line_too_long")).toBe(true);
    expect(parsed.messages).toEqual([{ ok: true }]);
  });

  it("非法 UTF-8 和非法 JSON 不产出消息", () => {
    const framer = new ByteLineFramer({ maxLineBytes: 100, maxBufferBytes: 100 });
    const badUtf8 = framer.push(Buffer.from([0xff, 0x0a]));
    expect(badUtf8.messages).toEqual([]);
    expect(badUtf8.errors[0]?.code).toBe("invalid_utf8");
    const badJson = framer.push(Buffer.from("{not-json\n"));
    expect(badJson.messages).toEqual([]);
    expect(badJson.errors[0]?.code).toBe("invalid_json");
  });

  it("write 返回 false 后停止继续 write,队列满则拒绝,close 丢弃未写出的字节", () => {
    const gate = new Gate();
    gate.hold = true;
    const dropped: number[] = [];
    const written: number[] = [];
    const queue = new OutboundQueue(gate, 1, 100, () => undefined);
    const first = queue.enqueue(Buffer.from("one\n"), {
      onWritten: () => written.push(1),
      onDropped: () => dropped.push(1)
    });
    const second = queue.enqueue(Buffer.from("two\n"), {
      onWritten: () => written.push(2),
      onDropped: () => dropped.push(2)
    });
    const third = queue.enqueue(Buffer.from("three\n"), {
      onWritten: () => written.push(3),
      onDropped: () => dropped.push(3)
    });
    expect(first).toBe("accepted");
    expect(second).toBe("accepted");
    expect(third).toBe("full");
    expect(gate.chunks.map((chunk) => chunk.toString("utf8"))).toEqual(["one\n"]);
    expect(written).toEqual([1]);
    queue.close();
    expect(dropped).toEqual([2]);
    expect(gate.chunks).toHaveLength(1);
    expect(encodeLine({ ok: true }, 100).toString("utf8")).toBe('{"ok":true}\n');
  });

  it("可空 turn 字段可解析,decline 与空权限形状不带宽授权", () => {
    expect(turnSchema.safeParse({
      id: "tu",
      status: "inProgress",
      items: [],
      completedAt: null,
      durationMs: null,
      startedAt: null,
      error: null
    }).success).toBe(true);
    expect(turnSchema.safeParse({ id: null, status: "inProgress", items: [] }).success).toBe(false);
    expect(commandDeclineSchema.parse({ decision: "decline" })).toEqual({ decision: "decline" });
    expect(commandDeclineSchema.safeParse({ decision: "acceptForSession" }).success).toBe(false);
    expect(JSON.stringify(emptyPermissionsSchema.parse({ permissions: {} }))).toBe('{"permissions":{}}');
    expect(PINNED_CODEX_CLI_VERSION).toBe("0.153.3");
    expect(SCHEMA_PROVENANCE.manifestFileCount).toBe(304);
    for (const hash of Object.values(SCHEMA_PROVENANCE.files)) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
