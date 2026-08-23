// W5.4-b C1:claude 身份登记承载(方案 D12)+ verifyBinaryIdentity 共享提升。
// - 登记读/写/核验:临时 SAYDO_HOME,缺失/损坏/形状不符全回 null(fail-closed 不抛);
// - 核验谱:ok / identity_missing / binary_path_mismatch / digest_mismatch / binary_unreadable;
// - Tier1 每次核验都重算 digest，同尺寸同 mtime 替换也 fail-closed；
// - 共享 verifyBinaryIdentity 行为与原 byoa 私有实现等价(通过回 identity,不通过回 undefined)。

import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  claudeIdentityPath,
  readClaudeIdentity,
  verifyClaudeIdentity,
  writeClaudeIdentity,
  type ClaudeIdentityRecord
} from "../src/tier1/claudeIdentity.js";
import { sha256File, verifyBinaryIdentity } from "../src/providers/binaryIdentity.js";

function makeHome(): string {
  return mkdtempSync(join(tmpdir(), "saydo-idhome-"));
}

function makeBin(home: string, content = "#!/bin/bash\necho claude\n"): string {
  const bin = join(home, "claude.exe");
  writeFileSync(bin, content);
  chmodSync(bin, 0o755);
  return bin;
}

function record(bin: string, over: Partial<ClaudeIdentityRecord> = {}): ClaudeIdentityRecord {
  return {
    binaryPath: realpathSync(bin),
    binaryDigest: sha256File(bin),
    version: "2.1.220",
    testedAt: "2026-08-21T00:00:00.000Z",
    receipt: { source: "test" },
    ...over
  };
}

function makeCurrentCmdShim(home: string): { shim: string; target: string } {
  const binDir = join(home, "bin");
  const targetDir = join(home, "node_modules", "@anthropic-ai", "claude-code");
  mkdirSync(binDir, { recursive: true });
  mkdirSync(targetDir, { recursive: true });
  const target = join(targetDir, "cli.js");
  const shim = join(binDir, "claude.cmd");
  writeFileSync(target, "process.exit(0);\n");
  writeFileSync(
    shim,
    '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n\r\nIF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n) ELSE (\r\n  SET "_prog=node"\r\n)\r\n\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & set PATHEXT=%PATHEXT:;.JS;=;% & "%_prog%"  "%dp0%\\..\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*\r\n'
  );
  return { shim, target: realpathSync(target) };
}

describe("claude-identity.json 读/写(D12 承载;路径经 SAYDO_HOME 解析)", () => {
  it("路径 = $SAYDO_HOME/tier1/claude-identity.json", () => {
    expect(claudeIdentityPath("/x/home")).toBe("/x/home/tier1/claude-identity.json");
  });

  it("写读往返:五键全保真(receipt 原样存证)", () => {
    const home = makeHome();
    const bin = makeBin(home);
    const rec = record(bin);
    writeClaudeIdentity(home, rec);
    expect(readClaudeIdentity(home)).toEqual(rec);
  });

  it("缺失 ⇒ null;损坏 JSON ⇒ null;形状不符(digest 非 64hex)⇒ null(不抛)", () => {
    const home = makeHome();
    expect(readClaudeIdentity(home)).toBeNull();
    mkdirSync(join(home, "tier1"), { recursive: true });
    writeFileSync(claudeIdentityPath(home), "not-json");
    expect(readClaudeIdentity(home)).toBeNull();
    writeFileSync(
      claudeIdentityPath(home),
      JSON.stringify({ binaryPath: "/x", binaryDigest: "short", version: "1", testedAt: "t", receipt: {} })
    );
    expect(readClaudeIdentity(home)).toBeNull();
  });
});

describe("verifyClaudeIdentity(登记核验谱;Tier1 每次重哈希)", () => {
  it("正例:登记与实际文件一致 ⇒ ok + record 回传", () => {
    const home = makeHome();
    const bin = makeBin(home);
    writeClaudeIdentity(home, record(bin));
    const v = verifyClaudeIdentity(home, bin);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.record.binaryPath).toBe(realpathSync(bin));
  });

  it.skipIf(process.platform === "win32")("配置为 symlink 时按实体路径核验登记", () => {
    const home = makeHome();
    const bin = makeBin(home);
    const alias = join(home, "claude-current");
    symlinkSync(bin, alias, "file");
    writeClaudeIdentity(home, record(realpathSync(bin)));
    const v = verifyClaudeIdentity(home, alias);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.record.binaryPath).toBe(realpathSync(bin));
  });

  it("登记缺失 ⇒ identity_missing + 自检处方", () => {
    const home = makeHome();
    const bin = makeBin(home);
    const v = verifyClaudeIdentity(home, bin);
    expect(v).toMatchObject({ ok: false, code: "identity_missing" });
    if (!v.ok) expect(v.detail).toContain("scope");
  });

  it("登记 binaryPath 与配置 claude_bin 不一致 ⇒ binary_path_mismatch", () => {
    const home = makeHome();
    const bin = makeBin(home);
    writeClaudeIdentity(home, record(bin, { binaryPath: "/elsewhere/claude.exe" }));
    expect(verifyClaudeIdentity(home, bin)).toMatchObject({ ok: false, code: "binary_path_mismatch" });
  });

  it("二进制内容漂移(mtime/size 变化)⇒ digest_mismatch(身份漂移处方)", () => {
    const home = makeHome();
    const bin = makeBin(home);
    writeClaudeIdentity(home, record(bin));
    writeFileSync(bin, "#!/bin/bash\necho tampered longer content\n");
    const v = verifyClaudeIdentity(home, bin);
    expect(v).toMatchObject({ ok: false, code: "digest_mismatch" });
    if (!v.ok) expect(v.detail).toContain("身份漂移");
  });

  it("bin 文件被删 ⇒ binary_unreadable", () => {
    const home = makeHome();
    const bin = makeBin(home);
    writeClaudeIdentity(home, record(bin));
    rmSync(bin);
    expect(verifyClaudeIdentity(home, bin)).toMatchObject({ ok: false, code: "binary_unreadable" });
  });

  it("每次 Tier1 核验都重算 wrapper digest", () => {
    const home = makeHome();
    const bin = makeBin(home);
    writeClaudeIdentity(home, record(bin));
    let calls = 0;
    const hashFile = (p: string): string => {
      calls += 1;
      return sha256File(p);
    };
    expect(verifyClaudeIdentity(home, bin, { hashFile }).ok).toBe(true);
    expect(calls).toBe(1);
    expect(verifyClaudeIdentity(home, bin, { hashFile }).ok).toBe(true);
    expect(calls).toBe(2);
    const future = new Date(Date.now() + 10_000);
    utimesSync(bin, future, future);
    expect(verifyClaudeIdentity(home, bin, { hashFile }).ok).toBe(true);
    expect(calls).toBe(3);
  });

  it("同尺寸内容替换并恢复原 mtime 仍拒绝", () => {
    const home = makeHome();
    const bin = makeBin(home);
    writeClaudeIdentity(home, record(bin));
    expect(verifyClaudeIdentity(home, bin).ok).toBe(true);
    const before = statSync(bin);
    writeFileSync(bin, "#!/bin/bash\necho pwned!\n");
    utimesSync(bin, before.atime, before.mtime);
    expect(statSync(bin).size).toBe(before.size);
    expect(verifyClaudeIdentity(home, bin)).toMatchObject({ ok: false, code: "digest_mismatch" });
  });

  it("win32 npm shim 同时钉住 .cmd 与最终 JS；旧登记和 JS 漂移均拒绝", () => {
    const home = makeHome();
    const { shim, target } = makeCurrentCmdShim(home);
    writeClaudeIdentity(home, record(shim));
    expect(verifyClaudeIdentity(home, shim, { platform: "win32" })).toMatchObject({
      ok: false,
      code: "runtime_target_missing"
    });

    writeClaudeIdentity(
      home,
      record(shim, { runtimeTargetPath: target, runtimeTargetDigest: sha256File(target) })
    );
    expect(verifyClaudeIdentity(home, shim, { platform: "win32" }).ok).toBe(true);
    writeFileSync(target, "process.exit(1); // changed\n");
    expect(verifyClaudeIdentity(home, shim, { platform: "win32" })).toMatchObject({
      ok: false,
      code: "runtime_target_digest_mismatch"
    });
  });
});

describe("verifyBinaryIdentity 共享导出(byoa 原语义等价:通过回 identity / 不通过回 undefined)", () => {
  const familyOf = (m: string): string | null => (m.startsWith("claude") ? "claude" : m.startsWith("gpt") ? "gpt" : null);

  it("路径一致 + digest 一致 ⇒ 回 identity;binaryPath 与登记 path 不等 ⇒ undefined", () => {
    const home = makeHome();
    const bin = makeBin(home);
    const identity = { path: bin, digest: sha256File(bin) };
    expect(verifyBinaryIdentity(bin, identity, familyOf, "claude")).toBe(identity);
    expect(verifyBinaryIdentity("/other/claude.exe", identity, familyOf, "claude")).toBeUndefined();
    expect(verifyBinaryIdentity(undefined, identity, familyOf, "claude")).toBeUndefined();
    expect(verifyBinaryIdentity(bin, undefined, familyOf, "claude")).toBeUndefined();
  });

  it("digest 格式非法 / 内容不符 / 相对路径 ⇒ undefined(fail-closed 谱不变)", () => {
    const home = makeHome();
    const bin = makeBin(home);
    expect(verifyBinaryIdentity(bin, { path: bin, digest: "XYZ" }, familyOf, "claude")).toBeUndefined();
    expect(verifyBinaryIdentity(bin, { path: bin, digest: "b".repeat(64) }, familyOf, "claude")).toBeUndefined();
    expect(
      verifyBinaryIdentity("claude.exe", { path: "claude.exe", digest: sha256File(bin) }, familyOf, "claude")
    ).toBeUndefined();
  });

  it("defaultModel 族与期望不符 ⇒ undefined;同族 ⇒ 通过(byoa verified_binary_default 链回归)", () => {
    const home = makeHome();
    const bin = makeBin(home);
    const digest = sha256File(bin);
    expect(
      verifyBinaryIdentity(bin, { path: bin, digest, defaultModel: "gpt-5.6-sol" }, familyOf, "claude")
    ).toBeUndefined();
    const ok = verifyBinaryIdentity(bin, { path: bin, digest, defaultModel: "claude-opus-5" }, familyOf, "claude");
    expect(ok?.defaultModel).toBe("claude-opus-5");
  });
});
