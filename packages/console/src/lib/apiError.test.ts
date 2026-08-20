// 传输层失败分类与重试预算(09 §1261 `{ok,code,message,retryable}` 落地)。
// 回归目标是 2026-08-12 那次实测事故:403 被说成"连接失败"、网络层原样吐 "Failed to fetch"、
// daemon 明说 retryable 却不重试、以及据此把用户推去填 API key。

import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiErrorFromNetwork, apiErrorFromResponse, apiErrorMessage, toApiError } from "./apiError";
import { apiGet, apiPost, retryAllowance, RETRY_BUDGET } from "./api";
import { cliProbeFailureCopy, postSetupConfig, postSetupSecret, setupErrorMessage, SetupApiError } from "./setupApi";

/** node 单测无 DOM:为 capToken/localStorage 提供最小桩 */
function stubBrowserGlobals() {
  const store = new Map<string, string>();
  vi.stubGlobal("location", { search: "", host: "127.0.0.1:47100", hostname: "127.0.0.1" });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    }
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("失败分类", () => {
  it("fetch 自身抛 = 网络层:可重试,且点破僵尸页这一最常见成因", () => {
    const err = apiErrorFromNetwork(new TypeError("Failed to fetch"), "/api/overview");
    expect(err.kind).toBe("network");
    expect(err.retryable).toBe(true);
    // 主文案不得再出现浏览器原话
    expect(err.message).toBe("连不上 SayDo 服务");
    expect(err.message).not.toContain("Failed to fetch");
    expect(err.hint).toContain("vite");
    // 原话只进折叠区,便于排查
    expect(err.path).toContain("Failed to fetch");
  });

  it("503 starting → 可重试,且不冤枉成连接失败", () => {
    const err = apiErrorFromResponse(503, { ok: false, code: "starting", message: "daemon starting", retryable: true });
    expect(err.kind).toBe("starting");
    expect(err.retryable).toBe(true);
    expect(err.message).toBe("SayDo 服务正在启动");
  });

  it("403 token_mismatch → 凭证失效(不是连接失败),不可重试,给能照做的下一步", () => {
    const err = apiErrorFromResponse(
      403,
      { ok: false, code: "token_mismatch", message: "G1 identity check failed" },
      "/api/overview"
    );
    expect(err.kind).toBe("auth");
    expect(err.retryable).toBe(false);
    expect(err.message).toBe("访问凭证已失效");
    // daemon 原文是天书,不能直接端给用户
    expect(err.message).not.toContain("G1");
    expect(err.hint).toContain("token");
  });

  it("401 与 token_missing 同样归入凭证失效", () => {
    expect(apiErrorFromResponse(401, {}).kind).toBe("auth");
    expect(apiErrorFromResponse(403, { code: "token_missing" }).kind).toBe("auth");
  });

  it("业务 403 不映射成凭证失效", () => {
    const mismatch = apiErrorFromResponse(403, {
      ok: false,
      code: "artifact_project_mismatch",
      message: "artifact art_x 不属于项目 prj_y"
    });
    expect(mismatch.kind).toBe("client");
    expect(mismatch.message).toBe("这份产物不属于当前项目");
    expect(mismatch.message).not.toContain("凭证");
    const lan = apiErrorFromResponse(403, {
      ok: false,
      code: "mobile_lan_route_rejected",
      message: "M1 移动 LAN 面未开放此路由"
    });
    expect(lan.kind).toBe("client");
    expect(lan.message).toBe("手机局域网面未开放此内容");
  });

  it("retryable 以 daemon 响应体为准,不由状态码替它做主", () => {
    // 5xx 通常可重试,但 daemon 明说 false 就是 false
    expect(apiErrorFromResponse(500, { ok: false, retryable: false }).retryable).toBe(false);
    // 缺字段时才兜底
    expect(apiErrorFromResponse(500, { ok: false }).retryable).toBe(true);
    // 4xx 通常不可重试,daemon 说可以也照办
    expect(apiErrorFromResponse(409, { ok: false, retryable: true }).retryable).toBe(true);
  });

  it("4xx 用 daemon 的 message(它才知道这个请求错在哪)", () => {
    const err = apiErrorFromResponse(400, { ok: false, code: "bad_json", message: "request body is not valid json" });
    expect(err.kind).toBe("client");
    expect(err.message).toBe("request body is not valid json");
  });

  it("detail 汇总技术细节供折叠区显示", () => {
    const err = apiErrorFromResponse(403, { code: "token_mismatch" }, "/api/overview");
    expect(err.detail).toContain("HTTP 403");
    expect(err.detail).toContain("code=token_mismatch");
    expect(err.detail).toContain("/api/overview");
  });

  it("toApiError 原样透传 ApiError,其余按网络层兜底", () => {
    const already = apiErrorFromResponse(403, { code: "token_missing" });
    expect(toApiError(already)).toBe(already);
    expect(toApiError(new Error("boom")).kind).toBe("network");
    expect(apiErrorMessage(new Error("boom"))).toBe("boom");
  });
});

describe("重试预算", () => {
  it("读口按失败大类给预算:启动中等得久,凭证问题一次都不重试", () => {
    const get = (err: ApiError) => retryAllowance(err, true);
    expect(get(apiErrorFromResponse(503, { code: "starting", retryable: true }))).toBe(RETRY_BUDGET.starting);
    expect(get(apiErrorFromNetwork(new Error("x")))).toBe(RETRY_BUDGET.network);
    expect(get(apiErrorFromResponse(500, {}))).toBe(RETRY_BUDGET.server);
    expect(get(apiErrorFromResponse(403, { code: "token_mismatch" }))).toBe(0);
    expect(get(apiErrorFromResponse(400, {}))).toBe(0);
  });

  it("写口只在 starting 时重发——其余一律不自动重发,免得多派发一次任务、多扣一次钱", () => {
    const post = (err: ApiError) => retryAllowance(err, false);
    // 503 是在业务路由之前返回的,可确定请求没被处理过
    expect(post(apiErrorFromResponse(503, { code: "starting", retryable: true }))).toBe(RETRY_BUDGET.starting);
    // 这两类无法确定服务端是否已经执行,不能替用户承担重复执行的代价
    expect(post(apiErrorFromNetwork(new Error("x")))).toBe(0);
    expect(post(apiErrorFromResponse(500, { retryable: true }))).toBe(0);
  });

  it("daemon 说不可重试就不重试", () => {
    expect(retryAllowance(apiErrorFromResponse(500, { retryable: false }), true)).toBe(0);
  });
});

describe("请求重试行为", () => {
  it("GET 遇 starting 会自动重试并最终成功(daemon 冷启动十几秒不该让人手动刷页)", async () => {
    stubBrowserGlobals();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { ok: false, code: "starting", retryable: true }))
      .mockResolvedValueOnce(jsonResponse(200, { projects: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiGet<{ projects: unknown[] }>("/api/overview")).resolves.toEqual({ projects: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("GET 遇凭证失效立刻停手,不做无谓重试", async () => {
    stubBrowserGlobals();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(403, { ok: false, code: "token_mismatch" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiGet("/api/overview")).rejects.toMatchObject({ kind: "auth" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("POST 网络失败不重发(写口可能已在服务端生效)", async () => {
    stubBrowserGlobals();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiPost("/api/tasks/t1/retry", {})).rejects.toMatchObject({ kind: "network" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("HTTP 200 但 body.ok=false 仍按契约判失败", async () => {
    stubBrowserGlobals();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { ok: false, code: "not_found", message: "没这个任务" })));

    await expect(apiPost("/api/tasks/x/cancel", {})).rejects.toMatchObject({ kind: "client", message: "没这个任务" });
  });
});

describe("setup 自管 fetch 的传输层保护", () => {
  // 这几个端点是首启主路径(保存配置→写 key→自检→重启),此前传输层失败一路裸奔到界面

  it("保存配置时连不上 → 人话而非 TypeError", async () => {
    stubBrowserGlobals();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(postSetupConfig({})).rejects.toMatchObject({ kind: "network", message: "连不上 SayDo 服务" });
  });

  it("写 key 时凭证失效 → 说凭证,不把 daemon 的 G1 天书端给用户", async () => {
    stubBrowserGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(403, { ok: false, code: "token_mismatch", message: "G1 identity check failed" }))
    );

    const err = await postSetupSecret("OPENROUTER_API_KEY", "sk-x").catch((e: unknown) => e);
    expect(err).toMatchObject({ kind: "auth", message: "访问凭证已失效" });
    expect(String((err as Error).message)).not.toContain("G1");
  });

  it("回归:422 校验失败仍抛 SetupApiError 且 violations 一条不丢", async () => {
    stubBrowserGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(422, {
          ok: false,
          code: "config_validation_failed",
          message: "配置不合法",
          violations: [{ code: "evaluator_same_family", slot: "evaluator", message: "评估器与对话同族", fix: "换一家" }]
        })
      )
    );

    const err = await postSetupConfig({}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SetupApiError);
    // setupApi.ts 的血泪注释:只看顶层 code 会永远匹配不上,同族确认框因此从未弹出过
    expect((err as SetupApiError).hasViolation("evaluator_same_family")).toBe(true);
    expect(setupErrorMessage(err)).toContain("评估器与对话同族");
  });

  it("传输层失败的提示带上恢复指引", () => {
    expect(setupErrorMessage(apiErrorFromNetwork(new Error("x")))).toContain("daemon");
  });
});

describe("CLI 探测失败的建议分流", () => {
  it("连不上/凭证失效/正在启动都不是 CLI 的问题,不得顺势推荐 API 直连", () => {
    expect(cliProbeFailureCopy(apiErrorFromNetwork(new Error("x"))).suggestApi).toBe(false);
    expect(cliProbeFailureCopy(apiErrorFromResponse(403, { code: "token_mismatch" })).suggestApi).toBe(false);
    expect(cliProbeFailureCopy(apiErrorFromResponse(503, { code: "starting" })).suggestApi).toBe(false);
  });

  it("探测本身真出错时,才建议改走 API", () => {
    expect(cliProbeFailureCopy(apiErrorFromResponse(500, {})).suggestApi).toBe(true);
    expect(cliProbeFailureCopy(new Error("解析失败")).suggestApi).toBe(true);
  });

  it("文案取分类后的人话,并带上可照做的下一步", () => {
    const copy = cliProbeFailureCopy(apiErrorFromNetwork(new TypeError("Failed to fetch")));
    expect(copy.message).toBe("连不上 SayDo 服务");
    expect(copy.hint).toBeDefined();
  });
});
