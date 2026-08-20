// E1 provider(1.2):统一超时/重试 + observedModel 提取 + usage 回报 + C8 记账行形状。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createOpenAICompatProvider } from "../src/providers/openaiCompat.js";
import { resolveApiProvider, SLOT_TIMEOUT_MS } from "../src/providers/resolve.js";
import { recordLlmUsage, recordTtsChars } from "../src/cost/ledger.js";
import { openDb } from "../src/storage/db.js";

function fakeFetch(handler: (call: number) => Response | Promise<Response>): typeof fetch {
  let calls = 0;
  return (async () => handler(++calls)) as typeof fetch;
}

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("OpenAICompatProvider", () => {
  it("成功:提取 text/observedModel/usage(09 §11 规则 2 的 api 侧观测)", async () => {
    const p = createOpenAICompatProvider({
      baseUrl: "https://x/v1",
      apiKey: "k",
      model: "google/gemini-2.5-flash",
      fetchImpl: fakeFetch(() =>
        okJson({
          model: "google/gemini-2.5-flash-20260601",
          choices: [{ message: { content: "好的" } }],
          usage: { prompt_tokens: 12, completion_tokens: 3 }
        })
      )
    });
    const r = await p.chat({ messages: [{ role: "user", content: "hi" }] });
    expect(r).toMatchObject({
      ok: true,
      text: "好的",
      requestedModel: "google/gemini-2.5-flash",
      observedModel: "google/gemini-2.5-flash-20260601",
      observedModelSource: "stream",
      observedModelExempted: false,
      usage: { promptTokens: 12, completionTokens: 3 }
    });
  });

  it("reasoning 预算:DeepSeek 官方直连抬到 16000,其他端点维持 3000(2026-08-15 实测,e2e/spikes/deepseek-toolloop)", async () => {
    const seen: Record<string, unknown>[] = [];
    const spy = (async (_input: unknown, init: RequestInit | undefined) => {
      seen.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return okJson({ model: "deepseek-v4-pro", choices: [{ message: { content: "ok" } }] });
    }) as typeof fetch;

    await createOpenAICompatProvider({
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "k",
      model: "deepseek-v4-pro",
      fetchImpl: spy
    }).chat({ messages: [{ role: "user", content: "hi" }], maxTokens: 64 });
    expect(seen[0]?.["max_tokens"]).toBe(16000);

    await createOpenAICompatProvider({
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "k",
      model: "deepseek/deepseek-v4-pro",
      fetchImpl: spy
    }).chat({ messages: [{ role: "user", content: "hi" }], maxTokens: 64 });
    expect(seen[1]?.["max_tokens"]).toBe(3000);

    // 调用方要得更多时以调用方为准(下限只兜底,不封顶)
    await createOpenAICompatProvider({
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "k",
      model: "deepseek-v4-pro",
      fetchImpl: spy
    }).chat({ messages: [{ role: "user", content: "hi" }], maxTokens: 40000 });
    expect(seen[2]?.["max_tokens"]).toBe(40000);
  });

  it("预算耗尽在 reasoning(finish=length 且无 content/toolCalls)⇒ 作废而非静默返回空回答", async () => {
    const p = createOpenAICompatProvider({
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "k",
      model: "deepseek-v4-pro",
      fetchImpl: fakeFetch(() =>
        okJson({
          model: "deepseek-v4-pro",
          choices: [{ finish_reason: "length", message: { content: "" } }],
          usage: { prompt_tokens: 99, completion_tokens: 3000 }
        })
      )
    });
    const r = await p.chat({ messages: [{ role: "user", content: "证明…" }], maxTokens: 3000 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("invalid_response");
      expect(r.retryable).toBe(false);
      expect(r.message).toContain("finish=length");
    }
  });

  it("finish=length 但拿到了 content ⇒ 仍是成功(截断不等于无产出)", async () => {
    const p = createOpenAICompatProvider({
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "k",
      model: "deepseek-v4-flash",
      fetchImpl: fakeFetch(() =>
        okJson({ model: "deepseek-v4-flash", choices: [{ finish_reason: "length", message: { content: "半句话" } }] })
      )
    });
    const r = await p.chat({ messages: [{ role: "user", content: "hi" }] });
    expect(r).toMatchObject({ ok: true, text: "半句话" });
  });

  it("429 ⇒ rate_limited 且可重试(限流是暂态,不与 4xx 同档)", async () => {
    const p = createOpenAICompatProvider({
      baseUrl: "https://x/v1",
      apiKey: "k",
      model: "m1",
      fetchImpl: fakeFetch((n) =>
        n === 1
          ? new Response("rate limited", { status: 429 })
          : okJson({ model: "m1", choices: [{ message: { content: "第二次成功" } }] })
      )
    });
    const r = await p.chat({ messages: [{ role: "user", content: "hi" }] });
    expect(r).toMatchObject({ ok: true, text: "第二次成功" });

    const always = createOpenAICompatProvider({
      baseUrl: "https://x/v1",
      apiKey: "k",
      model: "m1",
      fetchImpl: fakeFetch(() => new Response("rate limited", { status: 429 }))
    });
    const r2 = await always.chat({ messages: [{ role: "user", content: "hi" }] });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2).toMatchObject({ code: "rate_limited", retryable: true });
  });

  it("槽位等待预算:深推理档放宽,实时档维持 30s(reasoning 单次可产出数千 token)", () => {
    expect(SLOT_TIMEOUT_MS.dialog).toBe(30_000);
    expect(SLOT_TIMEOUT_MS.cheap).toBe(30_000);
    expect(SLOT_TIMEOUT_MS.thinking).toBe(180_000);
    expect(SLOT_TIMEOUT_MS.evaluator).toBe(180_000);
  });

  it("5xx 重试一次后成功;4xx 不重试", async () => {
    const p = createOpenAICompatProvider({
      baseUrl: "https://x/v1",
      apiKey: "k",
      model: "m1",
      fetchImpl: fakeFetch((n) =>
        n === 1 ? new Response("boom", { status: 500 }) : okJson({ model: "m1", choices: [{ message: { content: "ok" } }] })
      )
    });
    const r = await p.chat({ messages: [{ role: "user", content: "hi" }] });
    expect(r.ok).toBe(true);

    let calls4xx = 0;
    const p2 = createOpenAICompatProvider({
      baseUrl: "https://x/v1",
      apiKey: "k",
      model: "m1",
      fetchImpl: (async () => {
        calls4xx++;
        return new Response("denied", { status: 403 });
      }) as typeof fetch
    });
    const r2 = await p2.chat({ messages: [{ role: "user", content: "hi" }] });
    expect(r2).toMatchObject({ ok: false, code: "http_4xx", retryable: false });
    expect(calls4xx).toBe(1);
  });

  it("caller AbortSignal 取消 API 请求且不得重试", async () => {
    let calls = 0;
    const p = createOpenAICompatProvider({
      baseUrl: "https://x/v1",
      apiKey: "k",
      model: "m1",
      fetchImpl: (async (_input, init) => {
        calls += 1;
        await new Promise<void>((_resolve, reject) => {
          const abort = (): void => reject(new DOMException("aborted", "AbortError"));
          if (init?.signal?.aborted) abort();
          else init?.signal?.addEventListener("abort", abort, { once: true });
        });
        throw new Error("unreachable");
      }) as typeof fetch
    });
    const controller = new AbortController();
    const pending = p.chat({ messages: [{ role: "user", content: "hi" }] }, controller.signal);
    controller.abort();
    await expect(pending).resolves.toMatchObject({ ok: false, code: "cancelled", retryable: false });
    expect(calls).toBe(1);
  });

  it("缺 choices 内容 => invalid_response(fail-closed,不编内容)", async () => {
    const p = createOpenAICompatProvider({
      baseUrl: "https://x/v1",
      apiKey: "k",
      model: "m1",
      fetchImpl: fakeFetch(() => okJson({ model: "m1", choices: [] }))
    });
    const r = await p.chat({ messages: [{ role: "user", content: "hi" }] });
    expect(r).toMatchObject({ ok: false, code: "invalid_response" });
  });

  it("observedModel 严格口径(impl-readback B1):缺失/null/非字符串/空串一律作废,不可洗白", async () => {
    const rejected: string[] = [];
    const bodies: Record<string, unknown>[] = [
      { choices: [{ message: { content: "ok" } }] }, // 缺失
      { model: null, choices: [{ message: { content: "ok" } }] }, // null(=== undefined 窄检的穿透面)
      { model: 123, choices: [{ message: { content: "ok" } }] }, // 非字符串
      { model: "", choices: [{ message: { content: "ok" } }] } // 空串
    ];
    for (const body of bodies) {
      const p = createOpenAICompatProvider({
        baseUrl: "https://x/v1",
        apiKey: "k",
        model: "m1",
        onObservedModelRejected: (event) => rejected.push(event.code),
        fetchImpl: fakeFetch(() => okJson(body))
      });
      const r = await p.chat({ messages: [{ role: "user", content: "hi" }] });
      expect(r).toMatchObject({ ok: false, code: "observed_model_missing", retryable: false });
    }
    expect(rejected).toEqual([
      "observed_model_missing",
      "observed_model_missing",
      "observed_model_missing",
      "observed_model_missing"
    ]);
  });

  it("binding resolver 的 expected family 在适配器边界统一复核", async () => {
    const rejected: string[] = [];
    const mismatch = createOpenAICompatProvider({
      baseUrl: "https://x/v1",
      apiKey: "k",
      model: "opaque-dialog-model",
      expectedFamily: "claude",
      onObservedModelRejected: (event) => rejected.push(event.code),
      fetchImpl: fakeFetch(() =>
        okJson({ model: "openai/gpt-5.6-luna", choices: [{ message: { content: "ok" } }] })
      )
    });
    await expect(mismatch.chat({ messages: [{ role: "user", content: "hi" }] })).resolves.toMatchObject({
      ok: false,
      code: "observed_model_family_mismatch"
    });

    const unresolved = createOpenAICompatProvider({
      baseUrl: "https://x/v1",
      apiKey: "k",
      model: "opaque-dialog-model",
      expectedFamily: "claude",
      onObservedModelRejected: (event) => rejected.push(event.code),
      fetchImpl: fakeFetch(() => okJson({ model: "opaque-response", choices: [{ message: { content: "ok" } }] }))
    });
    await expect(unresolved.chat({ messages: [{ role: "user", content: "hi" }] })).resolves.toMatchObject({
      ok: false,
      code: "observed_model_family_unresolved"
    });
    expect(rejected).toEqual(["observed_model_family_mismatch", "observed_model_family_unresolved"]);
  });

  it("模型异常与正文异常同时出现时仍优先拒绝并审计 observedModel", async () => {
    const cases = [
      {
        body: { choices: [] },
        code: "observed_model_missing"
      },
      {
        body: { model: "opaque-response", choices: [{ message: { tool_calls: [{}] } }] },
        code: "observed_model_family_unresolved"
      },
      {
        body: { model: "openai/gpt-5.6-luna", choices: [] },
        code: "observed_model_family_mismatch"
      }
    ] as const;
    const rejected: string[] = [];

    for (const entry of cases) {
      const provider = createOpenAICompatProvider({
        baseUrl: "https://x/v1",
        apiKey: "k",
        model: "opaque-dialog-model",
        expectedFamily: "claude",
        onObservedModelRejected: (event) => rejected.push(event.code),
        fetchImpl: fakeFetch(() => okJson(entry.body))
      });
      await expect(provider.chat({ messages: [{ role: "user", content: "hi" }] })).resolves.toMatchObject({
        ok: false,
        code: entry.code,
        retryable: false
      });
    }

    expect(rejected).toEqual(cases.map((entry) => entry.code));
  });
});

describe("resolveApiProvider", () => {
  it("via 命名端点:env 引用解析;缺 key 处方化抛错", () => {
    const named = { gw: { base_url: "https://gw/v1", api_key: "env:GW_KEY", family: "gpt" as const } };
    const p = resolveApiProvider({ provider: "api", model: "m", via: "gw" }, named, { GW_KEY: "secret" });
    expect(p.kind).toBe("api");
    expect(() => resolveApiProvider({ provider: "api", model: "m", via: "gw" }, named, {})).toThrow(/GW_KEY/);
    expect(() => resolveApiProvider({ provider: "api", model: "m", via: "ghost" }, named, {})).toThrow(/未定义/);
  });
});

describe("C8 记账(1.2 接线)", () => {
  it("llm/tts 行:source=api known=0 amount=NULL,用量入 meta([pricing] 回写前不编数)", () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-c8-")), "saydo.db"));
    recordLlmUsage(
      db,
      "dialog",
      { model: "m1", promptTokens: 10, completionTokens: 5, cachedPromptTokens: 4, routedProvider: "openai" },
      {},
      () => new Date("2026-07-24T00:00:00Z")
    );
    recordTtsChars(db, "ses_x", 42, () => new Date("2026-07-24T00:00:00Z"));
    const rows = db.prepare("SELECT kind, amount, known, source, meta_json FROM cost_entries ORDER BY kind").all() as {
      kind: string;
      amount: number | null;
      known: number;
      source: string;
      meta_json: string;
    }[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: "llm.dialog", amount: null, known: 0, source: "api" });
    // M4 定型:input/cached_input/output tokens 恒在 + routed_provider
    expect(JSON.parse(rows[0]!.meta_json)).toMatchObject({
      model: "m1",
      input_tokens: 10,
      cached_input_tokens: 4,
      output_tokens: 5,
      routed_provider: "openai"
    });
    expect(rows[1]).toMatchObject({ kind: "tts.chars", known: 0 });
  });

  it("M4:cached_input_tokens > input_tokens ⇒ 拒(§12 断言)", () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-c8b-")), "saydo.db"));
    expect(() =>
      recordLlmUsage(db, "dialog", { model: "m", promptTokens: 5, completionTokens: 1, cachedPromptTokens: 9 }, {}, () => new Date())
    ).toThrow(/cached_input_tokens/);
  });
});
