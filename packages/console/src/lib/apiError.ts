// daemon 传输层错误的单一真相(09 §1261 统一错误形状 `{ok:false, code, message, retryable}`)。
//
// 起因(2026-08-12 实测):前端此前只把失败拼成 `${status} ${path}`,daemon 给的 code/message/
// retryable 三个字段一个都没消费,于是:
//   ① 403 token_mismatch 被主界面说成"连接 daemon 失败"——daemon 其实好好的,是凭证失效;
//   ② fetch 网络层异常原样吐出浏览器的 "Failed to fetch",向导据此提示"CLI 检测失败"并
//      推荐去填 API key——本机三家 CLI 都已登录,用户被误导着走向花钱的路;
//   ③ daemon 冷启动期间返回 503 {code:"starting",retryable:true}(index.ts:345),明写可重试,
//      前端当硬失败展示,只能手动刷页。
// 与 setupApi.ts 的 SetupApiError 同构(那边管 setup 写口的 violations,这边管传输层),
// 分层上必须在 setupApi 之下:api.ts 是底层,setupApi 依赖它,反向依赖会成环。

/** 失败大类——UI 按此分流文案与恢复动作,不再按 HTTP 数字猜 */
export type ApiFailureKind = "network" | "auth" | "starting" | "server" | "client";

/** daemon 统一错误体(09 §1261);字段可缺,解析一律容错 */
export interface DaemonErrorBody {
  ok?: boolean;
  code?: string;
  message?: string;
  retryable?: boolean;
}

/** G1 身份门拒绝的 code(daemon index.ts:864 identity_rejected / token_missing / token_mismatch) */
const AUTH_CODES = new Set(["token_missing", "token_mismatch", "identity_rejected"]);

/** 业务 403:不是凭证失效,按 code 给人话(S1 评审 1 B1) */
const BUSINESS_403_MESSAGES: Record<string, string> = {
  artifact_project_mismatch: "这份产物不属于当前项目",
  mobile_lan_route_rejected: "手机局域网面未开放此内容"
};

export class ApiError extends Error {
  readonly kind: ApiFailureKind;
  readonly code?: string;
  readonly status?: number;
  readonly retryable: boolean;
  /** 恢复指引(人话;没有确定办法时为 undefined,不编造) */
  readonly hint?: string;
  /** 出错的请求路径,只进"原始错误"折叠区,不进主文案 */
  readonly path?: string;

  constructor(
    message: string,
    opts: { kind: ApiFailureKind; retryable: boolean; code?: string; status?: number; hint?: string; path?: string }
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = opts.kind;
    this.retryable = opts.retryable;
    this.code = opts.code;
    this.status = opts.status;
    this.hint = opts.hint;
    this.path = opts.path;
  }

  /** 折叠区用的技术细节(状态码/code/路径);主文案永远只用 message */
  get detail(): string {
    const bits = [
      this.status === undefined ? null : `HTTP ${this.status}`,
      this.code ? `code=${this.code}` : null,
      this.path ?? null
    ].filter((b): b is string => b !== null);
    return bits.join(" · ");
  }
}

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * 网络层失败(fetch 自身抛异常:连接被拒/DNS/超时/离线)。
 * 这里最典型的一种是"页面还在、后面的进程已经没了"——旧 vite dev 页尤其容易踩:
 * 前端恒同源(api.ts daemonBase 返回 ""),vite 一停,页面照旧显示,所有请求却打进空气。
 */
export function apiErrorFromNetwork(cause: unknown, path?: string): ApiError {
  const raw = cause instanceof Error ? cause.message : String(cause);
  return new ApiError("连不上 SayDo 服务", {
    kind: "network",
    retryable: true,
    hint: "确认 daemon 在跑;如果这个页面是从开发端口(vite)打开的,进程停掉后页面会像还活着一样,请改用 daemon 地址重新进入。",
    path: path === undefined ? undefined : `${path} · ${raw}`
  });
}

/**
 * HTTP 失败响应 → ApiError。
 * retryable 一律**优先采信 daemon 响应体**(契约字段),缺字段时才按状态码兜底,
 * 免得前端自己那套猜测和 daemon 的真实语义打架。
 */
export function apiErrorFromResponse(status: number, body: unknown, path?: string): ApiError {
  const raw = asRecord(body) as DaemonErrorBody;
  const code = asString(raw.code);
  const daemonMessage = asString(raw.message);
  const declaredRetryable = typeof raw.retryable === "boolean" ? raw.retryable : undefined;

  if (code === "starting" || (status === 503 && code === undefined)) {
    return new ApiError("SayDo 服务正在启动", {
      kind: "starting",
      retryable: declaredRetryable ?? true,
      code,
      status,
      hint: "冷启动通常十几秒,起来后会自动继续。",
      path
    });
  }

  if (code !== undefined && BUSINESS_403_MESSAGES[code] !== undefined) {
    return new ApiError(BUSINESS_403_MESSAGES[code] as string, {
      kind: "client",
      retryable: declaredRetryable ?? false,
      code,
      status,
      path
    });
  }

  if (status === 401 || status === 403 || (code !== undefined && AUTH_CODES.has(code))) {
    return new ApiError("访问凭证已失效", {
      kind: "auth",
      retryable: declaredRetryable ?? false,
      code,
      status,
      // daemon 的 "G1 identity check failed" 对用户是天书,这里换成能照做的话。
      hint: "daemon 重置或换过 token 后,旧凭证会失效(它存在本机浏览器里)。用带新 token 的链接重新进入即可。",
      path
    });
  }

  if (status >= 500) {
    return new ApiError(daemonMessage ?? "SayDo 服务出错了", {
      kind: "server",
      retryable: declaredRetryable ?? true,
      code,
      status,
      path
    });
  }

  return new ApiError(daemonMessage ?? "这个请求没被接受", {
    kind: "client",
    retryable: declaredRetryable ?? false,
    code,
    status,
    path
  });
}

/** 任意异常 → ApiError(已是 ApiError 则原样返回;其余按网络层兜底) */
export function toApiError(err: unknown, path?: string): ApiError {
  return err instanceof ApiError ? err : apiErrorFromNetwork(err, path);
}

/** UI 兜底:任意异常 → 一句人话(ApiError 用分类文案,其余用原始 message) */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : String(err);
}
