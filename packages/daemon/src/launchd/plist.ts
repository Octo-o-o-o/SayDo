// 阶段 A · launchd 常驻(07 D17,提前批 #1):daemon 开机自起 + 崩溃自启;菜单栏仍 P2。
// plist 生成为纯函数(单测断言结构);系统副作用(bootstrap/bootout)全在 cli.ts,
// 且安装属系统级变更,必须过 owner 检查点(IMPL-5 §4-①)后才执行。
// 形态要点:
// - ProgramArguments 全绝对路径(node + tsx cli.mjs 物理路径 + daemon 入口)——launchd 的
//   PATH 贫瘠(/usr/bin:/bin),不做任何运行期解析;
// - KeepAlive.SuccessfulExit=false:崩溃/被杀(非零退出/信号死)自动重启;gracefulStop
//   (SIGTERM -> exit 0)按"成功退出"不复活——stop 语义由 bootout 承载;
// - RunAtLoad=true:装载即起,重登录自起;
// - PATH 快照自安装 shell:daemon 内 verify/执行链要跑 pnpm/just/git 等,launchd 缺省环境找不到。

export const LAUNCHD_LABEL = "com.saydo.daemon";
export const PIPELINE_LAUNCHD_LABEL = "com.saydo.pipeline";

export interface LaunchdPlistInput {
  /** node 绝对路径(process.execPath 快照) */
  nodeBin: string;
  /** tsx dist/cli.mjs 物理路径(pnpm symlink 已展开) */
  tsxCli: string;
  /** packages/daemon/src/index.ts 绝对路径 */
  daemonEntry: string;
  /** daemon 包目录(WorkingDirectory) */
  workingDirectory: string;
  /** ~/.saydo/logs(launchd stdout/stderr 兜底捕获;daemon 自身 JSONL 日志同目录) */
  logsDir: string;
  /** 安装 shell 的 PATH 快照 */
  pathEnv: string;
  /** 已校验的 SayDo 状态根；launchd 不继承安装 shell 环境，必须显式固定。 */
  saydoHome: string;
  /** SAYDO_DEV 快照(dev profile 经 ~/.zshrc 注入,launchd 不读 shell rc——如实快照,不隐式变更 profile) */
  saydoDev?: string | undefined;
}

export interface PipelinePlistInput {
  uvBin: string;
  pipelineDir: string;
  logsDir: string;
  pathEnv: string;
  saydoHome: string;
  daemonPort?: string | undefined;
}

function esc(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function buildLaunchdPlist(i: LaunchdPlistInput): string {
  const envEntries = [
    `      <key>PATH</key>\n      <string>${esc(i.pathEnv)}</string>`,
    `      <key>SAYDO_HOME</key>\n      <string>${esc(i.saydoHome)}</string>`,
    ...(i.saydoDev !== undefined ? [`      <key>SAYDO_DEV</key>\n      <string>${esc(i.saydoDev)}</string>`] : [])
  ].join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${LAUNCHD_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
      <string>${esc(i.nodeBin)}</string>
      <string>${esc(i.tsxCli)}</string>
      <string>${esc(i.daemonEntry)}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${esc(i.workingDirectory)}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
      <key>SuccessfulExit</key>
      <false/>
    </dict>
    <key>ThrottleInterval</key>
    <integer>5</integer>
    <key>StandardOutPath</key>
    <string>${esc(i.logsDir)}/daemon.launchd.out.log</string>
    <key>StandardErrorPath</key>
    <string>${esc(i.logsDir)}/daemon.launchd.err.log</string>
    <key>EnvironmentVariables</key>
    <dict>
${envEntries}
    </dict>
  </dict>
</plist>
`;
}

export function buildPipelinePlist(i: PipelinePlistInput): string {
  const envEntries = [
    `      <key>PATH</key>\n      <string>${esc(i.pathEnv)}</string>`,
    `      <key>SAYDO_HOME</key>\n      <string>${esc(i.saydoHome)}</string>`,
    ...(i.daemonPort !== undefined
      ? [`      <key>SAYDO_DAEMON_PORT</key>\n      <string>${esc(i.daemonPort)}</string>`]
      : [])
  ].join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${PIPELINE_LAUNCHD_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
      <string>${esc(i.uvBin)}</string>
      <string>run</string>
      <string>python</string>
      <string>-m</string>
      <string>saydo_pipeline</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${esc(i.pipelineDir)}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
      <key>SuccessfulExit</key>
      <false/>
    </dict>
    <key>ThrottleInterval</key>
    <integer>5</integer>
    <key>StandardOutPath</key>
    <string>${esc(i.logsDir)}/pipeline.launchd.out.log</string>
    <key>StandardErrorPath</key>
    <string>${esc(i.logsDir)}/pipeline.launchd.err.log</string>
    <key>EnvironmentVariables</key>
    <dict>
${envEntries}
    </dict>
  </dict>
</plist>
`;
}

export const PLAN_REASON_SKIP_PIPELINE =
  "[warn] 未安装语音管线常驻(--without-pipeline);/readyz 将报 voiceReady=false";
export const PLAN_REASON_NO_UV =
  "[fail] 未找到 uv,语音管线无法常驻;如只要文本/控制面,用 'just daemon install --without-pipeline'";
export const PLAN_REASON_EXISTS_WITHOUT_PIPELINE =
  "[warn] pipeline plist 已存在,本旗标不拆除;要停语音管线请 uninstall 或手删";
export const PLAN_REASON_NO_PIPELINE_DIR =
  "[fail] pipeline 目录不存在,无法生成 com.saydo.pipeline.plist";

export function pipelinePlistMissingMessage(path: string): string {
  return `pipeline plist 不存在:${path};先 just daemon install(会生成)`;
}

export type PipelineAction = "none" | "bootstrap" | "reload";

export interface PlanInstallInput {
  pipelinePlistExists: boolean;
  /** launchctl print 该 job 是否已装载 */
  pipelineLoaded: boolean;
  withoutPipeline: boolean;
  uvBin: string | null;
  pipelineDirExists: boolean;
}

export interface PlanInstallResult {
  writePipelinePlist: boolean;
  writeUvBin: string | null;
  /** bootstrap = 装载未运行的 job; reload = bootout+bootstrap 重载同 SAYDO_HOME */
  pipelineAction: PipelineAction;
  bindPipeline: boolean;
  reason?: string;
  exitCode: 0 | 1;
}

const PLAN_IDLE: Pick<
  PlanInstallResult,
  "writePipelinePlist" | "writeUvBin" | "pipelineAction" | "bindPipeline"
> = {
  writePipelinePlist: false,
  writeUvBin: null,
  pipelineAction: "none",
  bindPipeline: false
};

/** 决定 install 要写/装载/重载 pipeline 的哪一步;系统副作用留在命令层。 */
export function planInstall(i: PlanInstallInput): PlanInstallResult {
  if (i.withoutPipeline) {
    if (i.pipelinePlistExists) {
      return { ...PLAN_IDLE, exitCode: 0, reason: PLAN_REASON_EXISTS_WITHOUT_PIPELINE };
    }
    return { ...PLAN_IDLE, exitCode: 0, reason: PLAN_REASON_SKIP_PIPELINE };
  }
  if (i.pipelinePlistExists) {
    if (i.pipelineLoaded) {
      return { ...PLAN_IDLE, pipelineAction: "reload", bindPipeline: true, exitCode: 0 };
    }
    // plist 在、job 未装载:半安装可重试(bootstrap 失败或 writePlist 抛错留下的文件)
    return { ...PLAN_IDLE, pipelineAction: "bootstrap", bindPipeline: true, exitCode: 0 };
  }
  if (!i.uvBin) {
    return { ...PLAN_IDLE, exitCode: 1, reason: PLAN_REASON_NO_UV };
  }
  if (!i.pipelineDirExists) {
    return { ...PLAN_IDLE, exitCode: 1, reason: PLAN_REASON_NO_PIPELINE_DIR };
  }
  return {
    writePipelinePlist: true,
    writeUvBin: i.uvBin,
    pipelineAction: "bootstrap",
    bindPipeline: false,
    exitCode: 0
  };
}
