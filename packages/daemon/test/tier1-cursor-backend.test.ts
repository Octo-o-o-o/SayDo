import { describe, expect, it } from "vitest";
import {
  cursorBackend,
  cursorBuildArgv,
  cursorIsTerminalResult,
  cursorParseLine,
  isCursorShellToolCall,
  isCursorStartedToolCall
} from "../src/tier1/backends/cursor.js";

describe("cursor backend seam(B1-a 快照,行为对齐抽取前)", () => {
  it("buildArgv 与抽取前 realAgentSpawner 一致", () => {
    expect(cursorBuildArgv({ model: "fable-5-max", prompt: "hello" })).toEqual([
      "-p",
      "--force",
      "--trust",
      "--output-format",
      "stream-json",
      "--model",
      "fable-5-max",
      "hello"
    ]);
    expect(
      cursorBuildArgv({ model: "fable-5-max", prompt: "hello", resumeKey: "chat-1", sessionId: "ignored", maxTurns: 9 })
    ).toEqual([
      "-p",
      "--force",
      "--trust",
      "--output-format",
      "stream-json",
      "--model",
      "fable-5-max",
      "--resume",
      "chat-1",
      "hello"
    ]);
  });

  it("finishPolicy / canaryLeft / adapter 恒 cursor 现状", () => {
    const b = cursorBackend();
    expect(b.adapter).toBe("cursor");
    expect(b.finishPolicy).toBe("kill_on_result");
    expect(b.canaryLeft).toBe("shell_started");
  });

  it("parseLine: system.init -> observed_model; started shell -> tool_started; result success -> result", () => {
    expect(
      cursorParseLine(JSON.stringify({ type: "system", subtype: "init", model: "fable-5-max" }))
    ).toEqual({ kind: "observed_model", observedModel: "fable-5-max" });
    const started = JSON.stringify({
      type: "tool_call",
      subtype: "started",
      tool_call: { name: "shell", args: { command: "ls" } }
    });
    expect(isCursorStartedToolCall(started)).toBe(true);
    expect(isCursorShellToolCall(started)).toBe(true);
    expect(cursorParseLine(started)).toEqual({ kind: "tool_started", tool: "started" });
    const result = JSON.stringify({ type: "result", subtype: "success", result: "done" });
    expect(cursorIsTerminalResult(result)).toBe(true);
    expect(cursorParseLine(result).kind).toBe("result");
    const err = JSON.stringify({ type: "result", subtype: "error", result: "oops" });
    expect(cursorIsTerminalResult(err)).toBe(true);
    expect(cursorParseLine(err).kind).toBe("unknown");
  });
});
