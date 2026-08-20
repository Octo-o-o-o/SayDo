// daemon API 客户端(5.1 + 接线批任务⑤):capability token 从 ?token=/localStorage(G1)。
// 端口判定归零(接线批修):旧实现写死判定 vite 端口 5173(实际 strictPort 47120),dev 页
// API/WS 全打错源;且直连 daemon 会撞 G1 的 Origin 白名单(47120 非法 Origin,DNS-rebinding 防护
// 不放宽)+ 缺 CORS。现一切**恒同源相对路径**:build 产物由 daemon 静态服务(同源天然成立),
// vite dev 由 vite.config 的 server.proxy 把 /api,/dev,/ws,/health 转发到 daemon(proxy 剥 Origin 头
// = 本地进程调用语义,token 门照过不放宽)。

import {
  ApiError,
  apiErrorFromNetwork,
  apiErrorFromResponse,
  toApiError,
  type ApiFailureKind,
  type DaemonErrorBody
} from "./apiError";
import { nextBackoffDelayMs, sleep } from "./backoff";

export const CAP_TOKEN_KEY = "saydo.capToken";

export function capToken(): string {
  const fromUrl = new URLSearchParams(location.search).get("token");
  if (fromUrl) {
    localStorage.setItem(CAP_TOKEN_KEY, fromUrl);
    return fromUrl;
  }
  return localStorage.getItem(CAP_TOKEN_KEY) ?? "";
}

/**
 * 清掉本机存的 capability token(凭证失效后的自救口)。
 * daemon 重置/换 token 后,localStorage 里的旧值会让后续每个请求都 403,而 token 一旦
 * 进过 localStorage 就没有界面手段能清——只能开 devtools。这里给 UI 一个正经出口。
 */
export function clearCapToken(): void {
  try {
    globalThis.localStorage?.removeItem(CAP_TOKEN_KEY);
  } catch {
    // localStorage 不可用(隐私模式)时无所谓:那本来也没存住
  }
}

/** 恒同源(dev 走 vite proxy,build 走 daemon 静态服务;不再有端口判定分支) */
export function daemonBase(): string {
  return "";
}

/** WS 端:同源 host(dev 由 vite ws proxy 转发) */
export function daemonWsUrl(): string {
  const token = capToken();
  return `ws://${location.host}/ws/voice${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

// W2 阶段 B:fetch 的 token 从 ?token= 改走 x-saydo-token header(extractToken 两形态都收,
// header 不落 URL 面更干净;WS 例外——浏览器 WebSocket 无自定义 header,保持 ?token=)。
// 页面地址栏 ?token= 仅作首次注入(capToken 存 localStorage 后深链不再带 token,IMPL-5 §2-B)。
/**
 * 各类失败允许的自动重试次数(09 §1261 的 retryable 落地)。
 * starting:daemon 冷启动 tsx 要十几秒(DEPLOY §2),退避 0.5+1+2+4+8≈15.5s 刚好覆盖这一窗口;
 * network/server:只救瞬时抖动,救不回就尽快把人话摆出来,别让人干等;
 * auth/client:换凭证或改请求才可能好,重试纯属浪费。
 */
export const RETRY_BUDGET: Record<ApiFailureKind, number> = {
  starting: 5,
  network: 2,
  server: 2,
  auth: 0,
  client: 0
};

/**
 * 本次失败还能重试几次。
 * idempotent=false(POST/DELETE)只放行 starting——503 是在业务路由**之前**返回的
 * (daemon index.ts:345),可确定请求没被处理过;其余一律不自动重发:写口会真实派发执行任务、
 * 消耗额度(DEPLOY §5 风险提示),重发一次就可能多扣一次钱,这个代价不能由重试悄悄替用户承担。
 */
export function retryAllowance(err: ApiError, idempotent: boolean): number {
  if (!err.retryable) return 0;
  if (!idempotent) return err.kind === "starting" ? RETRY_BUDGET.starting : 0;
  return RETRY_BUDGET[err.kind];
}

/** idempotent:能否安全重发(GET 是,写口不是);expectJson:成功响应必须是 JSON 体(读口是) */
interface RequestPolicy {
  idempotent: boolean;
  expectJson: boolean;
}

async function requestOnce<T>(path: string, init: RequestInit, policy: RequestPolicy): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${daemonBase()}${path}`, init);
  } catch (err) {
    // fetch 自身抛 = 网络层(连接被拒/离线/超时),没有 status 可谈
    throw apiErrorFromNetwork(err, path);
  }
  const payload = (await res.json().catch(() => null)) as DaemonErrorBody | null;
  // HTTP 200 但 body.ok===false 也是失败(daemon 部分写口如此回),同样走契约解析
  if (!res.ok || payload?.ok === false) {
    throw apiErrorFromResponse(res.status, payload, path);
  }
  if (policy.expectJson && payload === null) {
    // 读口拿到非 JSON 的 2xx:多半是被别的东西应答了(代理/占位页),
    // 旧实现在这里抛裸 SyntaxError,同样是天书,统一成人话。
    throw new ApiError("服务返回了看不懂的内容", {
      kind: "server",
      retryable: false,
      status: res.status,
      path
    });
  }
  return payload as T;
}

async function request<T>(path: string, init: RequestInit, policy: RequestPolicy): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await requestOnce<T>(path, init, policy);
    } catch (err) {
      const apiErr = toApiError(err, path);
      if (attempt >= retryAllowance(apiErr, policy.idempotent)) throw apiErr;
      await sleep(nextBackoffDelayMs(attempt));
      attempt += 1;
    }
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { headers: { "x-saydo-token": capToken() } }, { idempotent: true, expectJson: true });
}

/** 动作写口(接线批任务②;G1 同 token 门;失败抛 daemon 的 {code,message} 人话) */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(
    path,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-saydo-token": capToken() },
      body: JSON.stringify(body ?? {})
    },
    { idempotent: false, expectJson: false }
  );
}

/** DELETE(批 3:session task-context 关闭) */
export async function apiDelete<T = { ok?: boolean }>(path: string, body?: unknown): Promise<T> {
  return request<T>(
    path,
    {
      method: "DELETE",
      headers: { "content-type": "application/json", "x-saydo-token": capToken() },
      body: body !== undefined ? JSON.stringify(body) : undefined
    },
    { idempotent: false, expectJson: false }
  );
}

/** 阶段 B:是否远程来源(tailnet 手机面)——S3 合并链按钮置灰引导回受信终端(后端 403 同语义强制) */
export function isRemoteOrigin(): boolean {
  return !["127.0.0.1", "localhost"].includes(location.hostname);
}

// ---- 载荷类型(daemon api/console.ts 的镜像;宽松记录型,页面只读) ----

export interface TaskRowView {
  id: string;
  projectId: string;
  title: string;
  route: string;
  status: string;
  viewStatus: string;
  attempt: number;
  budget: { walltimeActiveMin: number; maxTurns: number; maxCost: number } | null;
  parkedDeadline: string | null;
  updatedAt: string;
}

export interface ProjectCard {
  id: string;
  title: string;
  type: string;
  status: string;
  workspace: string | null;
  taskCounts: Record<string, number>;
}

export interface Overview {
  projects: ProjectCard[];
  pending: { readyForReview: TaskRowView[]; approvals: number; blocked: TaskRowView[]; unreadCallbacks: number };
}

export type Row = Record<string, unknown>;

export const api = {
  overview: () => apiGet<Overview>("/api/overview"),
  projectTasks: (id: string) => apiGet<TaskRowView[]>(`/api/projects/${id}/tasks`),
  taskDetail: (tid: string) => apiGet<Row | null>(`/api/tasks/${tid}`),
  memory: (id: string) => apiGet<Row[]>(`/api/projects/${id}/memory`),
  artifacts: (id: string) => apiGet<Row[]>(`/api/projects/${id}/artifacts`),
  projectSettings: (id: string) => apiGet<Row | null>(`/api/projects/${id}/settings`),
  approvals: (project?: string) => apiGet<Row[]>(`/api/approvals${project ? `?project=${project}` : ""}`),
  outbox: () => apiGet<Row[]>("/api/outbox"),
  ackOutbox: (id: string) => apiPost<{ ok: true; state: string; already?: boolean }>(`/api/outbox/${encodeURIComponent(id)}/ack`, {}),
  costs: () => apiGet<{ byProject: Row[]; entries: Row[] }>("/api/costs"),
  config: () => apiGet<Row>("/api/config"),
  // 任务动作(接线批任务②;11 §5.5 操作行 / 取消 / 重试)
  reviewTask: (
    tid: string,
    body: {
      verdict: "approve" | "request_changes" | "reject";
      expectedAttempt: number;
      comments?: string;
      acceptanceVerdicts?: { criterion: string; status: "pass" | "fail" }[];
    }
  ) => apiPost<{ ok: true; state: string; attempt?: number }>(`/api/tasks/${tid}/review`, body),
  cancelTask: (tid: string) => apiPost<{ ok: true; state: string }>(`/api/tasks/${tid}/cancel`, {}),
  retryTask: (tid: string, message?: string) =>
    apiPost<{ ok: true; attempt: number }>(`/api/tasks/${tid}/retry`, message ? { message } : {}),
  requestManualMerge: (tid: string) => apiPost<{ ok: true; handoffUrl: string }>(`/api/tasks/${tid}/request-manual-merge`, {}),
  verifyMerge: (tid: string) => apiPost<{ ok: true; state: string; mergeCommit: string }>(`/api/tasks/${tid}/verify-merge`, {}),
  // 执行中 S2 审批决策(执行器批任务②;runtime_effect 张的屏幕决策口)
  decideApproval: (aid: string, decision: "accept" | "reject") =>
    apiPost<{ ok: true; decision: string }>(`/api/approvals/${aid}/decide`, { decision }),
  // W5a 3.3:第四动作 edit(修改后批准;仅屏幕仅 S2)——旧张 superseded_by_edit,新张单次预批
  editApproval: (aid: string, editedCommand: string) =>
    apiPost<{ ok: true; decision: "edit"; newReceiptId: string }>(`/api/approvals/${aid}/decide`, {
      decision: "edit",
      editedCommand
    }),
  // W5a 3.2:决策提炼(与语音 explainResult 同实现同落库——口播/上屏一致)
  explainTask: (tid: string, level: "one_liner" | "walkthrough" | "decisions" = "decisions") =>
    apiPost<{ kind: string; text: string; decisions?: { what: string; why: string; overridable: true }[] }>(
      `/api/tasks/${tid}/explain`,
      { level }
    ),
  // W2 阶段 C:记忆候选人批(只提名、人批准)+ 项目奠基(仅受信终端)
  approveMemory: (id: string) => apiPost<{ ok: true; eventId: string }>(`/api/memory/${id}/approve`, {}),
  rejectMemory: (id: string) => apiPost<{ ok: true; eventId: string }>(`/api/memory/${id}/reject`, {}),
  bootstrapFoundation: (projectId: string) =>
    apiPost<{ ok: true; generation: number; status: string; progressLine: string }>(
      `/api/projects/${projectId}/foundation/bootstrap`,
      {}
    ),
  // W5a 3.5:项目级模型/预算覆盖(daemon 受控表;仅受信终端,tailnet 403)
  saveProjectOverrides: (projectId: string, overrides: unknown) =>
    apiPost<{ ok: true; overrides: unknown }>(`/api/projects/${projectId}/settings/overrides`, overrides),
  // W5a 3.6:产物控制面(diff + 子集导出;items 形如 "art_x:1")
  artifactDiff: (artifactId: string, from: number, to: number) =>
    apiGet<Row>(`/api/artifacts/${artifactId}/diff?from=${from}&to=${to}`),
  getArtifactContent: (artifactId: string, version: number, projectId: string) =>
    apiGet<{ artifact: Row; content: string }>(
      `/api/artifacts/${artifactId}/versions/${version}?project=${encodeURIComponent(projectId)}`
    ),
  exportArtifacts: (projectId: string, items: string[]) =>
    apiGet<Row>(`/api/projects/${projectId}/artifacts/export?items=${encodeURIComponent(items.join(","))}`),
  // W4 3.1:S3 卡(09 §3.3/11 §5.4;WebAuthn 交互三步 + 状态查询;守卫在 daemon 侧四断言)。
  // 全部 POST:同源 GET fetch 不带 Origin 头,守卫 ② 需要 Origin 精确断言
  s3Status: () =>
    apiPost<{ ok: true; registered: boolean; credentialId?: string; rpId: string }>("/api/s3/status", {}),
  s3Challenge: (input: { action: "merge"; taskId: string } | { action: "register" }) =>
    apiPost<{ ok: true; challengeId: string; challenge: string; expiresAt: string; rpId: string; allowCredentialId?: string }>(
      "/api/s3/challenge",
      input
    ),
  s3Register: (challengeId: string, attestation: string) =>
    apiPost<{ ok: true; credentialId: string }>("/api/s3/register", { challengeId, attestation }),
  s3Verify: (challengeId: string, assertion: string) =>
    apiPost<{ ok: true; receiptId: string; expiresAt: string }>("/api/s3/verify", { challengeId, assertion }),
  approveMerge: (tid: string, s3ReceiptId: string) =>
    apiPost<{ ok: true; state: "merging" }>(`/api/tasks/${tid}/approve-merge`, { s3ReceiptId })
};

// ---- W4 3.1:WebAuthn 浏览器桥(navigator.credentials;认证 UI 由 OS 提供,不自绘) ----

function b64uToBuf(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bufToB64u(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 注册(webauthn.create):platform authenticator + userVerification required(09 §3.3 注册链) */
export async function webauthnCreate(challenge: string, rpId: string): Promise<string> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: b64uToBuf(challenge).buffer as ArrayBuffer,
      rp: { id: rpId, name: "SayDo" },
      user: { id: new TextEncoder().encode("owner").buffer as ArrayBuffer, name: "owner", displayName: "owner" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256(P0 主路径)
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60_000
    }
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("注册被取消");
  const resp = cred.response as AuthenticatorAttestationResponse;
  return JSON.stringify({
    clientDataJSON: bufToB64u(resp.clientDataJSON),
    attestationObject: bufToB64u(resp.attestationObject)
  });
}

/** 断言(webauthn.get):Touch ID 系统弹窗(09 §3.3 签发链 ②) */
export async function webauthnGet(challenge: string, rpId: string, allowCredentialId: string): Promise<string> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: b64uToBuf(challenge).buffer as ArrayBuffer,
      rpId,
      allowCredentials: [{ type: "public-key", id: b64uToBuf(allowCredentialId).buffer as ArrayBuffer }],
      userVerification: "required",
      timeout: 60_000
    }
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("认证被取消");
  const resp = cred.response as AuthenticatorAssertionResponse;
  return JSON.stringify({
    credentialId: bufToB64u(cred.rawId),
    clientDataJSON: bufToB64u(resp.clientDataJSON),
    authenticatorData: bufToB64u(resp.authenticatorData),
    signature: bufToB64u(resp.signature)
  });
}
