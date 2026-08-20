import { describe, expect, it } from "vitest";
import {
  collectSecretEnvValues,
  SAFETY_STOP_LOG_BYTES,
  SAFETY_STOP_SNIPPET_CHARS,
  safetyStopLogLine,
  sanitizeCliStdoutLine,
  triggerContentSnippet,
  truncateUtf8Bytes,
  withTriggerContent
} from "../src/providers/byoa/safetyDiagnostics.js";

describe("safetyDiagnostics", () => {
  it("替换已知 secret 环境值与常见 key 形态", () => {
    const secret = "sk-live-abcdefghijklmnopqrstuvwxyz";
    const values = collectSecretEnvValues({ OPENAI_API_KEY: secret, PATH: "/usr/bin" });
    expect(values).toEqual([secret]);
    const line = `{"type":"notice","token":"${secret}","auth":"Bearer abcdefghijklmnop"}`;
    expect(sanitizeCliStdoutLine(line, values)).not.toContain(secret);
    expect(sanitizeCliStdoutLine(line, values)).toContain("[redacted]");
    expect(sanitizeCliStdoutLine(line, values)).toContain("Bearer [redacted]");
  });

  it("触发行日志截 500 字节,自检片段截 120 字", () => {
    const line = "x".repeat(800);
    expect(Buffer.byteLength(safetyStopLogLine(line))).toBe(SAFETY_STOP_LOG_BYTES);
    expect(triggerContentSnippet(line).length).toBe(SAFETY_STOP_SNIPPET_CHARS);
    expect(truncateUtf8Bytes("中文完整", 6)).toBe("中文");
  });

  it("失败文案尾部附触发内容", () => {
    const message = "CLI 输出了无法识别的内容,这次结果作废(保守处理)";
    const line = '{"type":"token_notice","id":"abc"}';
    expect(withTriggerContent(message, line)).toBe(`${message}(触发内容:${line})`);
    expect(withTriggerContent(message, undefined)).toBe(message);
  });
});
