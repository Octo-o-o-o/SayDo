// launchd CLI 进程级失败可见:隔离 HOME + PATH 上的 launchctl 桩,不触真实 launchctl。
// 本组是 POSIX 进程 fixture(#!/bin/sh stub、HOME、PATH 冒号拼接)。win32 不能执行该 stub,
// 且 os.homedir() 不以 HOME 为权威;跳过以免误触本机路径。这不是 Windows 产品测试的替代。

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { LAUNCHD_LABEL, PIPELINE_LAUNCHD_LABEL } from "../src/launchd/plist.js";

const POSIX_LAUNCHD_PROCESS = process.platform !== "win32";

const DAEMON_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(DAEMON_DIR, "..", "..");
const TSX = join(DAEMON_DIR, "node_modules", "tsx", "dist", "cli.mjs");
const CLI = join(DAEMON_DIR, "src", "launchd", "cli.ts");

function posixLaunchAgentPaths(): { daemon: string; pipeline: string } | null {
  if (!POSIX_LAUNCHD_PROCESS) return null;
  const agents = join(homedir(), "Library", "LaunchAgents");
  return {
    daemon: join(agents, `${LAUNCHD_LABEL}.plist`),
    pipeline: join(agents, `${PIPELINE_LAUNCHD_LABEL}.plist`)
  };
}

function snapshotRealPlist(path: string): { exists: boolean; stamp: string } {
  if (!existsSync(path)) return { exists: false, stamp: "" };
  const st = statSync(path);
  return { exists: true, stamp: `${st.mtimeMs}:${st.size}:${st.ino}` };
}

const realPlists = posixLaunchAgentPaths();
const realBefore = realPlists
  ? {
      daemon: snapshotRealPlist(realPlists.daemon),
      pipeline: snapshotRealPlist(realPlists.pipeline)
    }
  : null;

interface StubCtl {
  printDaemon?: boolean;
  printPipeline?: boolean;
  kickstart?: boolean;
  bootoutDaemon?: boolean;
  bootoutPipeline?: boolean;
  bootstrap?: boolean;
}

function writeStub(bin: string, logPath: string, ctl: StubCtl): void {
  const script = `#!/bin/sh
log=${JSON.stringify(logPath)}
printf '%s\\n' "$*" >> "$log"
cmd="$1"
tgt="$2"
ok_print_d=${ctl.printDaemon === false ? "0" : "1"}
ok_print_p=${ctl.printPipeline ? "1" : "0"}
ok_kick=${ctl.kickstart ? "1" : "0"}
ok_boot_d=${ctl.bootoutDaemon ? "1" : "0"}
ok_boot_p=${ctl.bootoutPipeline ? "1" : "0"}
ok_bootstr=${ctl.bootstrap ? "1" : "0"}
case "$cmd" in
print)
  case "$tgt" in
  *pipeline*) [ "$ok_print_p" = 1 ] && exit 0; exit 1 ;;
  *) [ "$ok_print_d" = 1 ] && exit 0; exit 1 ;;
  esac
  ;;
kickstart)
  [ "$ok_kick" = 1 ] && exit 0
  echo "injected launchctl failure" >&2
  exit 1
  ;;
bootout)
  case "$tgt" in
  *pipeline*)
    [ "$ok_boot_p" = 1 ] && exit 0
    echo "injected pipeline bootout failure" >&2
    exit 1
    ;;
  *)
    [ "$ok_boot_d" = 1 ] && exit 0
    echo "injected daemon bootout failure" >&2
    exit 1
    ;;
  esac
  ;;
bootstrap)
  [ "$ok_bootstr" = 1 ] && exit 0
  echo "injected bootstrap failure" >&2
  exit 1
  ;;
*)
  exit 98
  ;;
esac
`;
  const stub = join(bin, "launchctl");
  writeFileSync(stub, script, { mode: 0o700 });
  chmodSync(stub, 0o700);
}

function runCli(
  args: string[],
  opts: { home: string; bin: string; timeoutMs?: number }
): { exit: number; stdout: string; stderr: string } {
  try {
    const out = execFileSync(process.execPath, [TSX, CLI, ...args], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: opts.timeoutMs ?? 15_000,
      env: {
        ...process.env,
        HOME: opts.home,
        SAYDO_HOME: join(opts.home, ".saydo"),
        PATH: `${opts.bin}:${process.env["PATH"] ?? "/usr/bin:/bin"}`
      }
    });
    return { exit: 0, stdout: out, stderr: "" };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { exit: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

function isolateHome(): {
  home: string;
  bin: string;
  log: string;
  agents: string;
  daemonPlist: string;
  pipelinePlist: string;
  cleanup: () => void;
} {
  const root = mkdtempSync(join(tmpdir(), "saydo-launchd-cli-"));
  const home = join(root, "home");
  const bin = join(root, "bin");
  const agents = join(home, "Library", "LaunchAgents");
  mkdirSync(bin);
  mkdirSync(agents, { recursive: true });
  mkdirSync(join(home, ".saydo"), { recursive: true });
  return {
    home,
    bin,
    log: join(root, "launchctl.log"),
    agents,
    daemonPlist: join(agents, `${LAUNCHD_LABEL}.plist`),
    pipelinePlist: join(agents, `${PIPELINE_LAUNCHD_LABEL}.plist`),
    cleanup: () => rmSync(root, { recursive: true, force: true })
  };
}

describe.skipIf(!POSIX_LAUNCHD_PROCESS)("launchd cli process(隔离 HOME+stub,不触真实 launchctl)", () => {
  afterEach(() => {
    if (!realPlists || !realBefore) return;
    expect(snapshotRealPlist(realPlists.daemon)).toEqual(realBefore.daemon);
    expect(snapshotRealPlist(realPlists.pipeline)).toEqual(realBefore.pipeline);
  });

  it("printUsage:本机文本可用,语音按 ready,不开放远程,不提 iPhone", () => {
    const iso = isolateHome();
    try {
      writeStub(iso.bin, iso.log, {});
      const r = runCli([], { home: iso.home, bin: iso.bin });
      expect(r.exit).toBe(0);
      expect(r.stdout).toContain("--without-pipeline");
      expect(r.stdout).toContain("本机文本/控制面可用");
      expect(r.stdout).toContain("voiceReady");
      expect(r.stdout).toContain("不开放远程");
      expect(r.stdout).not.toContain("iPhone");
      expect(existsSync(iso.log)).toBe(false);
    } finally {
      iso.cleanup();
    }
  });

  it("start:kickstart 失败非零且保留 plist;成功为零", () => {
    const iso = isolateHome();
    try {
      writeFileSync(iso.daemonPlist, "probe-plist\n");
      writeStub(iso.bin, iso.log, { printDaemon: true, kickstart: false });
      const fail = runCli(["start"], { home: iso.home, bin: iso.bin });
      expect(fail.exit).not.toBe(0);
      expect(fail.stderr).toContain("[fail] kickstart");
      expect(readFileSync(iso.daemonPlist, "utf8")).toBe("probe-plist\n");
      expect(readFileSync(iso.log, "utf8")).toMatch(/kickstart/);

      writeStub(iso.bin, iso.log, { printDaemon: true, kickstart: true });
      const ok = runCli(["start"], { home: iso.home, bin: iso.bin });
      expect(ok.exit).toBe(0);
      expect(ok.stdout).toContain("[ok] 服务已装载,kickstart 触发启动");
      expect(existsSync(iso.daemonPlist)).toBe(true);
    } finally {
      iso.cleanup();
    }
  });

  it("start:无服务时 bootstrap 成功为零;无 plist 非零且不调 launchctl", () => {
    const iso = isolateHome();
    try {
      writeStub(iso.bin, iso.log, { printDaemon: false, bootstrap: true });
      const missing = runCli(["start"], { home: iso.home, bin: iso.bin });
      expect(missing.exit).not.toBe(0);
      expect(missing.stderr).toContain("plist 不存在");
      expect(existsSync(iso.log)).toBe(false);

      writeFileSync(iso.daemonPlist, "probe-plist\n");
      const boot = runCli(["start"], { home: iso.home, bin: iso.bin });
      expect(boot.exit).toBe(0);
      expect(boot.stdout).toContain("[ok] 已装载并启动");
      expect(readFileSync(iso.log, "utf8")).toMatch(/bootstrap/);
    } finally {
      iso.cleanup();
    }
  });

  it("uninstall:daemon bootout 失败保留 plist、非零;重试仍见配置", () => {
    const iso = isolateHome();
    try {
      writeFileSync(iso.daemonPlist, "keep-me\n");
      writeStub(iso.bin, iso.log, { printDaemon: true, bootoutDaemon: false });
      const fail = runCli(["uninstall"], { home: iso.home, bin: iso.bin });
      expect(fail.exit).not.toBe(0);
      expect(fail.stderr).toContain("[fail] bootout");
      expect(readFileSync(iso.daemonPlist, "utf8")).toBe("keep-me\n");
      expect(fail.stdout + fail.stderr).not.toContain(`已删除 ${iso.daemonPlist}`);

      const retry = runCli(["uninstall"], { home: iso.home, bin: iso.bin });
      expect(retry.exit).not.toBe(0);
      expect(existsSync(iso.daemonPlist)).toBe(true);
      expect(readFileSync(iso.daemonPlist, "utf8")).toBe("keep-me\n");
    } finally {
      iso.cleanup();
    }
  });

  it("uninstall:先成功停 job 再删 plist;无服务幂等删残留或无需删除", () => {
    const iso = isolateHome();
    try {
      writeFileSync(iso.daemonPlist, "gone\n");
      writeStub(iso.bin, iso.log, { printDaemon: true, bootoutDaemon: true });
      const ok = runCli(["uninstall"], { home: iso.home, bin: iso.bin });
      expect(ok.exit).toBe(0);
      expect(existsSync(iso.daemonPlist)).toBe(false);
      expect(ok.stdout).toContain("已停止并卸载服务");
      expect(ok.stdout).toContain("已删除");

      writeStub(iso.bin, iso.log, { printDaemon: false });
      const idle = runCli(["uninstall"], { home: iso.home, bin: iso.bin });
      expect(idle.exit).toBe(0);
      expect(idle.stdout).toContain("服务未装载,无需 bootout");
      expect(idle.stdout).toContain("plist 不存在,无需删除");

      writeFileSync(iso.daemonPlist, "orphan\n");
      const orphan = runCli(["uninstall"], { home: iso.home, bin: iso.bin });
      expect(orphan.exit).toBe(0);
      expect(existsSync(iso.daemonPlist)).toBe(false);
      expect(orphan.stdout).toContain("服务未装载,无需 bootout");
      expect(orphan.stdout).toContain("已删除");
    } finally {
      iso.cleanup();
    }
  });

  it("uninstall:pipeline bootout 失败保留 pipeline plist,daemon 已停则其 plist 已删", () => {
    const iso = isolateHome();
    try {
      writeFileSync(iso.daemonPlist, "d\n");
      writeFileSync(iso.pipelinePlist, "p\n");
      writeStub(iso.bin, iso.log, {
        printDaemon: true,
        printPipeline: true,
        bootoutDaemon: true,
        bootoutPipeline: false
      });
      const r = runCli(["uninstall"], { home: iso.home, bin: iso.bin });
      expect(r.exit).not.toBe(0);
      expect(existsSync(iso.daemonPlist)).toBe(false);
      expect(readFileSync(iso.pipelinePlist, "utf8")).toBe("p\n");
      expect(r.stderr).toContain("pipeline bootout");
    } finally {
      iso.cleanup();
    }
  });
});
