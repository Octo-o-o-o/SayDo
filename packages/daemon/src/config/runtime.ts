// 运行期配置读取的 fail-closed 方向(impl-readback 回收批 2,B4):
// "配置不可读" != "配置未写"——文件缺失(ENOENT,首启合法)走缺省;文件存在但解析失败一律朝紧:
// 启动期 => 拒启动(与 [params] 非法同律);运行期 Gate 0 => enabled:false(拒 dispatch),
// 防 config.toml 被改坏后 daemon 带宽松缺省继续跑(G6 同意翻转 / Gate 0 放行)。

import { loadConfigFile, paramValue } from "./load.js";
import { PARAM_DEFAULTS } from "./types.js";

function isEnoent(err: unknown): boolean {
  return (err as NodeJS.ErrnoException | null)?.code === "ENOENT";
}

/** 错误摘要脱原文(回收批 2 复审 A1):TomlError 的 message 含 config 原文 codeblock(\n\n 之后)——
 *  审计 append-only 永不可清,原文进去就出不来;只取首行(静态短语),截 160。 */
export function sanitizedConfigErrorSummary(err: unknown): string {
  return String(err).split("\n")[0]!.slice(0, 160);
}

export interface StartupLiveConfig {
  storeTranscript: boolean;
  idleSuspendSec: number;
}

/** 启动期读取(SessionManager 构造用):缺失=缺省(G6 缺省 store_transcript=true 是 canonical 缺省);损坏=抛(拒启动)。 */
export function readStartupLiveConfig(path: string): StartupLiveConfig {
  try {
    const cfg = loadConfigFile(path);
    return {
      storeTranscript: cfg.privacy.store_transcript, // prefault 恒有值(收口对账 #2)
      idleSuspendSec: paramValue(cfg, "session_idle_suspend_sec")
    };
  } catch (err) {
    if (isEnoent(err)) {
      return { storeTranscript: true, idleSuspendSec: PARAM_DEFAULTS.session_idle_suspend_sec };
    }
    throw new Error(
      `config.toml 存在但解析失败,拒启动(fail-closed,与 [params] 非法同律;impl-readback B4)。` +
        `修复 ${path} 后重启。原始错误:${String(err).slice(0, 200)}`
    );
  }
}

export interface Gate0State {
  enabled: boolean;
  bypass: boolean;
  /** 非 null = 本次读取发生了 fail-closed 回落(config 损坏),调用方应记审计/日志 */
  failClosedReason: string | null;
}

/** 运行期 Gate 0 读取(每次 dispatch 前):缺失=出厂缺省(既有语义不变);损坏=enabled:false 拒 dispatch。 */
export function readGate0FromFile(path: string): Gate0State {
  try {
    const cfg = loadConfigFile(path);
    return { enabled: cfg.gate0?.enabled ?? true, bypass: cfg.gate0?.bypass ?? false, failClosedReason: null };
  } catch (err) {
    if (isEnoent(err)) return { enabled: true, bypass: false, failClosedReason: null };
    return {
      enabled: false,
      bypass: false,
      // A1:审计消费本字段——只放脱敏摘要(首行,无 codeblock 原文);完整错误让 owner 在 stderr/启动日志看
      failClosedReason: `config.toml 损坏,Gate 0 fail-closed 拒 dispatch:${sanitizedConfigErrorSummary(err)}`
    };
  }
}
