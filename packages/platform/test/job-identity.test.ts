import { createHash } from "node:crypto";
import { fstatSync, fsyncSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { setFsyncSyncImplForTests } from "../src/fs.js";
import {
  appendReapAudit,
  brandTrustedFailure,
  commitOwnerReapIfIdentity,
  formatSayDoJobName,
  isSayDoJobName,
  ownerIdentityEqual,
  parseAgentOwnerRecord,
  parsePendingRuntimeOwnerRecord,
  parseRuntimeOwnerRecord,
  projectUntrustedFailureText,
  runtimeOwnerIdentity,
  sayDoJobNameMatchesIdentity,
  writeDurableJson
} from "../src/jobIdentity.js";

const GEN_A = "01234567-89ab-cdef-0123-456789abcdef";
const GEN_B = "01234567-89ab-cdef-0123-456789abcde0";

function expectedDigest(owner: string, run: string, generation: string): string {
  return createHash("sha256")
    .update(`saydo-job-v1\0${owner}\0${run}\0${generation}`, "utf8")
    .digest("hex");
}

afterEach(() => {
  setFsyncSyncImplForTests(null);
});

describe("durable write / reap audit 必须 fsync 文件和目录", () => {
  it("writeDurableJson 与 appendReapAudit 的 fsync fd 必须指向目标文件与父目录", () => {
    const seen: Array<{ file: boolean; dir: boolean; ino: string }> = [];
    setFsyncSyncImplForTests((fd) => {
      const st = fstatSync(fd);
      seen.push({ file: st.isFile(), dir: st.isDirectory(), ino: String(st.ino) });
      fsyncSync(fd);
    });
    const home = mkdtempSync(join(tmpdir(), "saydo-fsync-"));
    const path = join(home, "runtime", "children", "4242.json");
    const writeResult = writeDurableJson(path, { ok: true });
    const fileIno = String(statSync(path).ino);
    const dirIno = String(statSync(dirname(path)).ino);
    expect(seen.some((item) => item.file && item.ino === fileIno)).toBe(true);
    if (writeResult === "synced") {
      expect(seen.some((item) => item.dir && item.ino === dirIno)).toBe(true);
    } else {
      expect(writeResult).toBe("unsupported");
    }
    const afterWrite = seen.length;
    const auditResult = appendReapAudit(home, { action: "test.reap", pid: 4242 });
    const auditPath = join(home, "audit", "reap.jsonl");
    const auditFileIno = String(statSync(auditPath).ino);
    const auditDirIno = String(statSync(dirname(auditPath)).ino);
    const later = seen.slice(afterWrite);
    expect(later.some((item) => item.file && item.ino === auditFileIno)).toBe(true);
    if (auditResult === "synced") {
      expect(later.some((item) => item.dir && item.ino === auditDirIno)).toBe(true);
    } else {
      expect(auditResult).toBe("unsupported");
    }
    expect(readFileSync(auditPath, "utf8")).toContain("test.reap");
  });

  it("目录 fsync EIO 必须 fail-closed，不得当 durable 成功", () => {
    setFsyncSyncImplForTests((fd) => {
      const st = fstatSync(fd);
      if (st.isDirectory()) {
        const err = new Error("disk io") as NodeJS.ErrnoException;
        Object.defineProperty(err, "code", { value: "EIO" });
        throw err;
      }
      fsyncSync(fd);
    });
    const home = mkdtempSync(join(tmpdir(), "saydo-fsync-eio-"));
    expect(() => writeDurableJson(join(home, "x.json"), { ok: true })).toThrow(/EIO|disk io/u);
  });

  it("目录 fsync 平台不支持时调用方必须看到 unsupported，文件已 rename", () => {
    setFsyncSyncImplForTests((fd) => {
      const st = fstatSync(fd);
      if (st.isDirectory()) {
        const err = new Error("dir fsync unsupported") as NodeJS.ErrnoException;
        Object.defineProperty(err, "code", { value: "EINVAL" });
        throw err;
      }
      fsyncSync(fd);
    });
    const home = mkdtempSync(join(tmpdir(), "saydo-fsync-unsup-"));
    const path = join(home, "owner.json");
    expect(writeDurableJson(path, { ok: true })).toBe("unsupported");
    expect(readFileSync(path, "utf8")).toContain("ok");
  });
});

describe("ownerIdentityEqual 完整 identity", () => {
  const jobName = formatSayDoJobName("Local", "owner", "run", GEN_A);
  const base = {
    version: 1 as const,
    pid: 4242,
    processStart: "birth",
    ownerPid: 7,
    ownerInstanceId: "owner",
    runId: "run",
    jobName,
    binary: process.execPath,
    kind: "exec",
    commandToken: `saydo-child-${GEN_A}`,
    generation: GEN_A
  };

  it("只差 binary 或 ownerPid 必须不相等，CAS 不得 unlink", () => {
    expect(ownerIdentityEqual(base, { ...base, binary: "/tmp/other-bin" })).toBe(false);
    expect(ownerIdentityEqual(base, { ...base, ownerPid: 99 })).toBe(false);
    const home = mkdtempSync(join(tmpdir(), "saydo-cas-ident-"));
    const path = join(home, "owner.json");
    const record = {
      version: 1,
      pid: 4242,
      kind: "exec",
      binary: process.execPath,
      processStart: "birth",
      ownerPid: 7,
      ownerInstanceId: "owner",
      runId: "run",
      commandToken: `saydo-child-${GEN_A}`,
      generation: GEN_A,
      jobName
    };
    writeFileSync(path, JSON.stringify(record));
    const parsed = parseRuntimeOwnerRecord(record);
    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") return;
    expect(() => commitOwnerReapIfIdentity(
      path,
      { ...runtimeOwnerIdentity(parsed.record), binary: "/tmp/other-bin" },
      () => undefined,
      () => {
        throw new Error("must not unlink");
      }
    )).toThrow(/owner identity cas failed/u);
    expect(() => commitOwnerReapIfIdentity(
      path,
      { ...runtimeOwnerIdentity(parsed.record), ownerPid: 99 },
      () => undefined,
      () => {
        throw new Error("must not unlink");
      }
    )).toThrow(/owner identity cas failed/u);
    expect(readFileSync(path, "utf8")).toContain("birth");
  });
});

describe("brandTrustedFailure 用户可见文本", () => {
  it("branded port_conflict/home_mismatch 到达投影，未 brand 的 Error 不得泄漏", () => {
    const branded = brandTrustedFailure("port_conflict:home_mismatch");
    expect(projectUntrustedFailureText(branded, "cli failed")).toBe("port_conflict:home_mismatch");
    expect(projectUntrustedFailureText(new Error("port_conflict:home_mismatch"), "cli failed")).toBe("cli failed");
    try {
      branded.message = "SECRET";
    } catch {
      // 冻结
    }
    expect(projectUntrustedFailureText(branded, "cli failed")).toBe("port_conflict:home_mismatch");
    expect(branded.message).not.toContain("SECRET");
  });
});

describe("SayDo Job 名 generation-bound digest", () => {
  it("(a-b,c) 与 (a,b-c) 必须不同名", () => {
    const left = formatSayDoJobName("Local", "a-b", "c", GEN_A);
    const right = formatSayDoJobName("Local", "a", "b-c", GEN_A);
    expect(left).not.toBe(right);
    expect(left).toBe(`Local\\SayDoJob-v1-${expectedDigest("a-b", "c", GEN_A)}`);
    expect(right).toBe(`Local\\SayDoJob-v1-${expectedDigest("a", "b-c", GEN_A)}`);
  });

  it("相同 owner/run 不同 generation 必须不同名", () => {
    const a = formatSayDoJobName("Local", "owner", "run", GEN_A);
    const b = formatSayDoJobName("Local", "owner", "run", GEN_B);
    expect(a).not.toBe(b);
    expect(a).toBe(`Local\\SayDoJob-v1-${expectedDigest("owner", "run", GEN_A)}`);
    expect(b).toBe(`Local\\SayDoJob-v1-${expectedDigest("owner", "run", GEN_B)}`);
  });

  it("Job 名是 v1 digest，不写入原始字段", () => {
    const name = formatSayDoJobName("Local", "owner.instance", "run_id", GEN_A);
    expect(name).toMatch(/^Local\\SayDoJob-v1-[0-9a-f]{64}$/u);
    expect(name.includes("owner.instance")).toBe(false);
    expect(name.includes("run_id")).toBe(false);
    expect(name.includes(GEN_A)).toBe(false);
    expect(isSayDoJobName(name)).toBe(true);
  });

  it("旧字段拼接 grammar 一律非法", () => {
    expect(isSayDoJobName("Local\\SayDoJob-owner-run")).toBe(false);
    expect(isSayDoJobName("Global\\SayDoJob-abc-run")).toBe(false);
    expect(isSayDoJobName("Local\\SayDoJob-v1-xyz")).toBe(false);
    expect(isSayDoJobName(`Local\\SayDoJob-v1-${"g".repeat(64)}`)).toBe(false);
    expect(isSayDoJobName(`Local\\SayDoJob-v1-${"a".repeat(63)}`)).toBe(false);
  });

  it("matcher 必须带同一 generation", () => {
    const name = formatSayDoJobName("Local", "owner", "run", GEN_A);
    expect(sayDoJobNameMatchesIdentity(name, "owner", "run", GEN_A)).toBe(true);
    expect(sayDoJobNameMatchesIdentity(name, "owner", "run", GEN_B)).toBe(false);
    expect(sayDoJobNameMatchesIdentity(name, "owner", "run")).toBe(false);
    expect(sayDoJobNameMatchesIdentity(formatSayDoJobName("Global", "owner", "run", GEN_A), "owner", "run", GEN_A)).toBe(true);
  });

  it("identity token / generation / NUL fail closed", () => {
    expect(() => formatSayDoJobName("Local", "bad id", "run", GEN_A)).toThrow(/saydo job identity invalid/u);
    expect(() => formatSayDoJobName("Local", "owner", "run", "not-a-uuid")).toThrow(/saydo job identity invalid/u);
    expect(() => formatSayDoJobName("Local", "ow\0ner", "run", GEN_A)).toThrow(/saydo job identity invalid/u);
  });
});

describe("destructive owner parser 强制完整 identity", () => {
  const jobName = formatSayDoJobName("Local", "owner", "run", GEN_A);
  const complete = {
    version: 1 as const,
    pid: 4242,
    kind: "exec",
    binary: process.execPath,
    processStart: "birth",
    ownerPid: 2,
    ownerInstanceId: "owner",
    runId: "run",
    commandToken: `saydo-child-${GEN_A}`,
    generation: GEN_A,
    jobName
  };

  it("runtime owner 缺 generation/token/job/kind 一律 invalid", () => {
    expect(parseRuntimeOwnerRecord(complete).status).toBe("valid");
    for (const key of ["generation", "commandToken", "jobName", "kind", "ownerPid", "ownerInstanceId", "runId", "binary"] as const) {
      const copy = { ...complete };
      delete copy[key];
      expect(parseRuntimeOwnerRecord(copy).status).toBe("invalid");
    }
  });

  it("jobName 必须绑定同一 ownerInstanceId/runId/generation，格式对但字段错仍 invalid", () => {
    const foreign = formatSayDoJobName("Local", "other-owner", "run", GEN_A);
    expect(parseRuntimeOwnerRecord({ ...complete, jobName: foreign }).status).toBe("invalid");
    expect(parseAgentOwnerRecord({ ...complete, worktree: "/tmp/wt", kind: "tier1:agent", jobName: foreign }, "run").status).toBe("invalid");
    const otherGen = formatSayDoJobName("Local", "owner", "run", GEN_B);
    expect(parseRuntimeOwnerRecord({ ...complete, jobName: otherGen }).status).toBe("invalid");
  });

  it("agent owner 同样强制完整 immutable identity", () => {
    const agent = { ...complete, worktree: "/tmp/wt", kind: "tier1:agent" };
    expect(parseAgentOwnerRecord(agent, "run").status).toBe("valid");
    const missingGen = { ...agent };
    delete (missingGen as { generation?: string }).generation;
    expect(parseAgentOwnerRecord(missingGen, "run").status).toBe("invalid");
    const missingJob = { ...agent };
    delete (missingJob as { jobName?: string }).jobName;
    expect(parseAgentOwnerRecord(missingJob, "run").status).toBe("invalid");
    const missingKind = { ...agent };
    delete (missingKind as { kind?: string }).kind;
    expect(parseAgentOwnerRecord(missingKind, "run").status).toBe("invalid");
  });

  it("pending runtime owner 允许 birth=null，仍要求 generation 与 jobName", () => {
    expect(parsePendingRuntimeOwnerRecord({ ...complete, processStart: null }).status).toBe("valid");
    const missingJob = { ...complete, processStart: null };
    delete (missingJob as { jobName?: string }).jobName;
    expect(parsePendingRuntimeOwnerRecord(missingJob).status).toBe("invalid");
  });
});
