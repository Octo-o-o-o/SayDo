import { describe, expect, it, vi } from "vitest";
import { commandToEffect } from "../src/tier1/cmdEffect.js";
import { computeRisk } from "../src/policy/engine.js";
import { decideCommand } from "../src/tier1/gate.js";

describe("凭据委派实际效果与语音门", () => {
  const writes = [
    "git config http.delegation always", "git config http.delegation none", "git config http.delegation policy",
    "git config --unset http.delegation", "git config --unset-all http.https://example.test.delegation",
    "git config http.https://example.test.delegation always", 'git config "http.https://example.test.delegation" policy',
    'git config http.dele"ga"tion always', "git -c http.delegation=always status",
    'git -c "http.https://example.test.delegation=none" status'
  ];
  it.each(writes)("%s 沿分类器/风险/语音门拒绝且零确认", async (command) => {
    const effect = commandToEffect(command);
    expect(computeRisk(effect).level).toBe("S3");
    const confirm = vi.fn(async () => true);
    const decision = await decideCommand({ taskId: "task-test", seq: 1, command, effect },
      { registry: { packageScripts: [], justfileTasks: [] }, stepConfirm: confirm, approvalTimeoutMs: 1 });
    expect(decision).toMatchObject({ permission: "deny", risk: "S3" });
    expect(confirm).not.toHaveBeenCalled();
  });
  it.each([
    ["git config --get http.delegation", "S0"], ["git config get http.delegation", "S1"],
    ["git config --get http.https://example.test.delegation", "S0"],
    ["git config http.postBuffer 1024", "S1"], ["git config http.version HTTP/2", "S1"],
    ["git config http.https://example.test.postBuffer 1024", "S1"]
  ])("%s 保留普通读写对照 %s", async (command, level) => {
    const effect = commandToEffect(command);expect(computeRisk(effect).level).toBe(level);
    const confirm = vi.fn(async () => true);
    expect(await decideCommand({ taskId: "task-test", seq: 1, command, effect },
      { registry: { packageScripts: [], justfileTasks: [] }, stepConfirm: confirm, approvalTimeoutMs: 1 })).toMatchObject({ permission: "allow", risk: level });
    expect(confirm).not.toHaveBeenCalled();
  });
});
