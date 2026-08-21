// 阶段 A(07 D17):launchd plist 生成纯函数——结构断言(副作用面在 cli.ts,人工验收记 evidence)。

import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildLaunchdPlist,
  buildPipelinePlist,
  LAUNCHD_LABEL,
  PIPELINE_LAUNCHD_LABEL,
  PLAN_REASON_EXISTS_WITHOUT_PIPELINE,
  PLAN_REASON_NO_PIPELINE_DIR,
  PLAN_REASON_NO_UV,
  PLAN_REASON_SKIP_PIPELINE,
  pipelinePlistMissingMessage,
  planInstall,
  type PlanInstallInput
} from "../src/launchd/plist.js";
import { isExistingDirectory, resolveUvBin } from "../src/launchd/uvBin.js";

const BASE = {
  nodeBin: "/usr/local/bin/node",
  tsxCli: "/repo/node_modules/.pnpm/tsx@4/node_modules/tsx/dist/cli.mjs",
  daemonEntry: "/repo/packages/daemon/src/index.ts",
  workingDirectory: "/repo/packages/daemon",
  logsDir: "/Users/o/.saydo/logs",
  pathEnv: "/usr/local/bin:/usr/bin:/bin",
  saydoHome: "/Users/o/.saydo"
};

describe("buildLaunchdPlist(D17 常驻合同)", () => {
  it("结构:Label + 全绝对路径 ProgramArguments 三段 + RunAtLoad + 崩溃自启 + 日志落 ~/.saydo/logs", () => {
    const xml = buildLaunchdPlist(BASE);
    expect(xml).toContain(`<string>${LAUNCHD_LABEL}</string>`);
    // ProgramArguments 顺序:node -> tsx cli -> daemon 入口(launchd PATH 贫瘠,全绝对路径)
    const argIdx = [BASE.nodeBin, BASE.tsxCli, BASE.daemonEntry].map((s) => xml.indexOf(`<string>${s}</string>`));
    expect(argIdx.every((i) => i > 0)).toBe(true);
    expect(argIdx[0]).toBeLessThan(argIdx[1] as number);
    expect(argIdx[1]).toBeLessThan(argIdx[2] as number);
    expect(xml).toContain("<key>RunAtLoad</key>\n    <true/>");
    // 崩溃自启:KeepAlive.SuccessfulExit=false(exit 0 的 graceful stop 不复活)
    expect(xml).toMatch(/<key>KeepAlive<\/key>\s*<dict>\s*<key>SuccessfulExit<\/key>\s*<false\/>/);
    expect(xml).toContain("<string>/Users/o/.saydo/logs/daemon.launchd.out.log</string>");
    expect(xml).toContain("<string>/Users/o/.saydo/logs/daemon.launchd.err.log</string>");
    expect(xml).toContain("<key>PATH</key>");
    expect(xml).toContain("<key>SAYDO_HOME</key>\n      <string>/Users/o/.saydo</string>");
  });

  it("SAYDO_DEV 快照:给了才写(不隐式改 profile);未给不出现该键", () => {
    expect(buildLaunchdPlist({ ...BASE, saydoDev: "1" })).toContain("<key>SAYDO_DEV</key>");
    expect(buildLaunchdPlist(BASE)).not.toContain("SAYDO_DEV");
  });

  it("XML 转义:路径含 & / < 不产生裸实体", () => {
    const xml = buildLaunchdPlist({
      ...BASE,
      pathEnv: "/a&b:/usr/bin",
      workingDirectory: "/x<y",
      saydoHome: "/Users/o/a&b"
    });
    expect(xml).toContain("/a&amp;b:/usr/bin");
    expect(xml).toContain("/x&lt;y");
    expect(xml).toContain("/Users/o/a&amp;b");
    expect(xml).not.toContain("/a&b:");
  });
});

const PIPELINE_BASE = {
  uvBin: "/opt/homebrew/bin/uv",
  pipelineDir: "/repo/pipeline",
  logsDir: "/Users/o/.saydo/logs",
  pathEnv: "/usr/local/bin:/usr/bin:/bin",
  saydoHome: "/Users/o/.saydo"
};

describe("buildPipelinePlist + planInstall(public-readiness)", () => {
  it("Label 为 com.saydo.pipeline", () => {
    const xml = buildPipelinePlist(PIPELINE_BASE);
    expect(xml).toContain(`<string>${PIPELINE_LAUNCHD_LABEL}</string>`);
    expect(PIPELINE_LAUNCHD_LABEL).toBe("com.saydo.pipeline");
  });

  it("ProgramArguments 五元组顺序:uvBin, run, python, -m, saydo_pipeline", () => {
    const xml = buildPipelinePlist(PIPELINE_BASE);
    const args = [PIPELINE_BASE.uvBin, "run", "python", "-m", "saydo_pipeline"];
    const idx = args.map((s) => xml.indexOf(`<string>${s}</string>`));
    expect(idx.every((i) => i > 0)).toBe(true);
    expect(idx[0]).toBeLessThan(idx[1] as number);
    expect(idx[1]).toBeLessThan(idx[2] as number);
    expect(idx[2]).toBeLessThan(idx[3] as number);
    expect(idx[3]).toBeLessThan(idx[4] as number);
  });

  it("WorkingDirectory / RunAtLoad / KeepAlive.SuccessfulExit=false", () => {
    const xml = buildPipelinePlist(PIPELINE_BASE);
    expect(xml).toContain(`<string>${PIPELINE_BASE.pipelineDir}</string>`);
    expect(xml).toContain("<key>RunAtLoad</key>\n    <true/>");
    expect(xml).toMatch(/<key>KeepAlive<\/key>\s*<dict>\s*<key>SuccessfulExit<\/key>\s*<false\/>/);
    expect(xml).toContain("<key>ThrottleInterval</key>\n    <integer>5</integer>");
  });

  it("两条 log 路径落 ~/.saydo/logs/pipeline.launchd.{out,err}.log", () => {
    const xml = buildPipelinePlist(PIPELINE_BASE);
    expect(xml).toContain("<string>/Users/o/.saydo/logs/pipeline.launchd.out.log</string>");
    expect(xml).toContain("<string>/Users/o/.saydo/logs/pipeline.launchd.err.log</string>");
  });

  it("Env 含 PATH+SAYDO_HOME;给 daemonPort 才写 SAYDO_DAEMON_PORT", () => {
    const without = buildPipelinePlist(PIPELINE_BASE);
    expect(without).toContain("<key>PATH</key>");
    expect(without).toContain("<key>SAYDO_HOME</key>\n      <string>/Users/o/.saydo</string>");
    expect(without).not.toContain("SAYDO_DAEMON_PORT");
    const withPort = buildPipelinePlist({ ...PIPELINE_BASE, daemonPort: "47100" });
    expect(withPort).toContain("<key>SAYDO_DAEMON_PORT</key>\n      <string>47100</string>");
  });

  it("XML 转义:路径含 & / < / > 不产生裸实体", () => {
    const xml = buildPipelinePlist({
      ...PIPELINE_BASE,
      uvBin: "/opt/homebrew/bin/u&v",
      pipelineDir: "/x<y>",
      pathEnv: "/a&b:/usr/bin",
      saydoHome: "/Users/o/a&b"
    });
    expect(xml).toContain("/opt/homebrew/bin/u&amp;v");
    expect(xml).toContain("/x&lt;y&gt;");
    expect(xml).toContain("/a&amp;b:/usr/bin");
    expect(xml).toContain("/Users/o/a&amp;b");
    expect(xml).not.toContain("/a&b:");
    expect(xml).not.toContain("/x<y>");
  });

  it("planInstall:plist 已存在 ⇒ 不写", () => {
    const r = plan({ pipelinePlistExists: true, pipelineLoaded: true, uvBin: "/x/uv" });
    expect(r.writePipelinePlist).toBe(false);
    expect(r.exitCode).toBe(0);
  });

  it("planInstall:不存在 + 有 uv + 未跳过 ⇒ 写", () => {
    const r = plan({ uvBin: "/x/uv" });
    expect(r.writePipelinePlist).toBe(true);
    expect(r.writeUvBin).toBe("/x/uv");
    expect(r.pipelineAction).toBe("bootstrap");
    expect(r.exitCode).toBe(0);
  });

  it("planInstall:不存在 + 无 uv + 未跳过 ⇒ 不写 + exitCode 1 + reason 含 --without-pipeline", () => {
    const r = plan({ uvBin: null });
    expect(r.writePipelinePlist).toBe(false);
    expect(r.exitCode).toBe(1);
    expect(r.reason).toBe(PLAN_REASON_NO_UV);
    expect(r.reason).toContain("--without-pipeline");
  });

  it("planInstall:不存在 + 无 uv + --without-pipeline ⇒ 不写 + exitCode 0", () => {
    const r = plan({ uvBin: null, withoutPipeline: true });
    expect(r.writePipelinePlist).toBe(false);
    expect(r.pipelineAction).toBe("none");
    expect(r.exitCode).toBe(0);
    expect(r.reason).toBe(PLAN_REASON_SKIP_PIPELINE);
  });

  it("planInstall:exists true, loaded false, withoutPipeline false ⇒ bootstrap", () => {
    const r = plan({ pipelinePlistExists: true, pipelineLoaded: false, uvBin: "/x/uv" });
    expect(r.writePipelinePlist).toBe(false);
    expect(r.writeUvBin).toBeNull();
    expect(r.pipelineAction).toBe("bootstrap");
    expect(r.bindPipeline).toBe(true);
    expect(r.exitCode).toBe(0);
  });

  it("planInstall:exists true, loaded false, withoutPipeline true ⇒ idle+reason", () => {
    const r = plan({
      pipelinePlistExists: true,
      pipelineLoaded: false,
      uvBin: "/x/uv",
      withoutPipeline: true
    });
    expect(r.writePipelinePlist).toBe(false);
    expect(r.writeUvBin).toBeNull();
    expect(r.pipelineAction).toBe("none");
    expect(r.bindPipeline).toBe(false);
    expect(r.exitCode).toBe(0);
    expect(r.reason).toBe(PLAN_REASON_EXISTS_WITHOUT_PIPELINE);
  });

  it("planInstall:exists true, loaded true ⇒ 重载同 SAYDO_HOME", () => {
    const r = plan({ pipelinePlistExists: true, pipelineLoaded: true, uvBin: "/x/uv" });
    expect(r.writePipelinePlist).toBe(false);
    expect(r.pipelineAction).toBe("reload");
    expect(r.bindPipeline).toBe(true);
    expect(r.exitCode).toBe(0);
  });

  it("planInstall:不存在 + 有 uv + --without-pipeline ⇒ 不写 + exitCode 0", () => {
    const r = plan({ uvBin: "/x/uv", withoutPipeline: true });
    expect(r.writePipelinePlist).toBe(false);
    expect(r.pipelineAction).toBe("none");
    expect(r.bindPipeline).toBe(false);
    expect(r.exitCode).toBe(0);
    expect(r.reason).toBe(PLAN_REASON_SKIP_PIPELINE);
  });

  it("planInstall:exists true + withoutPipeline ⇒ 不 bind/reload + warn 不拆除", () => {
    const r = plan({
      pipelinePlistExists: true,
      pipelineLoaded: true,
      uvBin: "/x/uv",
      withoutPipeline: true
    });
    expect(r.writePipelinePlist).toBe(false);
    expect(r.pipelineAction).toBe("none");
    expect(r.bindPipeline).toBe(false);
    expect(r.exitCode).toBe(0);
    expect(r.reason).toBe(PLAN_REASON_EXISTS_WITHOUT_PIPELINE);
  });

  it("planInstall:要写但 pipeline 目录不存在 ⇒ 不写 + exitCode 1", () => {
    const r = plan({ uvBin: "/x/uv", pipelineDirExists: false });
    expect(r.writePipelinePlist).toBe(false);
    expect(r.pipelineAction).toBe("none");
    expect(r.exitCode).toBe(1);
    expect(r.reason).toBe(PLAN_REASON_NO_PIPELINE_DIR);
  });

  it("B9: daemon plist 不写 SAYDO_DAEMON_PORT 时 pipeline 缺省也不写", () => {
    expect(buildLaunchdPlist(BASE)).not.toContain("SAYDO_DAEMON_PORT");
    expect(buildPipelinePlist(PIPELINE_BASE)).not.toContain("SAYDO_DAEMON_PORT");
  });

  it("deploy 缺 plist 文案含先 just daemon install", () => {
    expect(pipelinePlistMissingMessage("/tmp/com.saydo.pipeline.plist")).toContain(
      "先 just daemon install(会生成)"
    );
  });
});

const PLAN_DEFAULTS: PlanInstallInput = {
  pipelinePlistExists: false,
  pipelineLoaded: false,
  withoutPipeline: false,
  uvBin: null,
  pipelineDirExists: true
};

function plan(over: Partial<PlanInstallInput>) {
  return planInstall({ ...PLAN_DEFAULTS, ...over });
}

describe("resolveUvBin(A3:不调 which,只信 PATH 绝对项)", () => {
  it("绝对 PATH 下可执行 uv 被命中,返回 candidate 本身", () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-uv-ok-"));
    const bin = join(dir, "uv");
    writeFileSync(bin, "#!/bin/sh\n");
    chmodSync(bin, 0o755);
    try {
      expect(resolveUvBin({ PATH: dir })).toBe(bin);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === "win32")("非可执行文件跳过", () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-uv-nx-"));
    const bin = join(dir, "uv");
    writeFileSync(bin, "#!/bin/sh\n");
    chmodSync(bin, 0o644);
    try {
      expect(resolveUvBin({ PATH: dir })).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("相对 PATH 项与空项跳过,即使 cwd 下有可执行 uv", () => {
    const root = mkdtempSync(join(tmpdir(), "saydo-uv-rel-"));
    const relDir = join(root, "rel");
    mkdirSync(relDir);
    const bin = join(relDir, "uv");
    writeFileSync(bin, "#!/bin/sh\n");
    chmodSync(bin, 0o755);
    const prev = process.cwd();
    process.chdir(root);
    try {
      expect(resolveUvBin({ PATH: ["rel", ".", " "].join(delimiter) })).toBeNull();
      expect(resolveUvBin({ PATH: `${delimiter}${relDir}` })).toBe(bin);
    } finally {
      process.chdir(prev);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("isExistingDirectory:目录真、文件与缺失为假", () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-pdir-"));
    const file = join(dir, "not-a-dir");
    writeFileSync(file, "x");
    try {
      expect(isExistingDirectory(dir)).toBe(true);
      expect(isExistingDirectory(file)).toBe(false);
      expect(isExistingDirectory(join(dir, "missing"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
