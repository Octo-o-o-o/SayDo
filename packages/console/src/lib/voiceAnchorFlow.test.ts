import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newId, VOICE_QUIESCE_TIMEOUT_MS } from "@saydo/contracts";
import { PENDING_ANCHOR_KEY, readPendingAnchor, writePendingAnchor } from "./pendingAnchor";
import {
  ensureAnchorIdentity,
  retryAnchorPayload,
  resetVoiceAnchorFlowForTests,
  runVoiceAnchorFlow,
  shouldRenewAnchorRequestId,
  STATUS_TIMEOUT_MS,
  type VoiceAnchorPort
} from "./voiceAnchorFlow";

const posts: unknown[] = [];

vi.mock("./api", () => ({
  apiPost: vi.fn(async (_path: string, body: unknown) => {
    posts.push(body);
    return { ok: true };
  })
}));

afterEach(() => {
  posts.length = 0;
  resetVoiceAnchorFlowForTests();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal("sessionStorage", memoryStorage());
});

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v)
  } as Storage;
}

function basePort(overrides: Partial<VoiceAnchorPort> = {}): VoiceAnchorPort {
  return {
    sessionId: newId("ses"),
    daemonEpoch: newId("evt"),
    connected: true,
    micActive: false,
    mode: "ptt",
    stopMic: vi.fn(),
    finalizeRecordingEdit: vi.fn(),
    sendPrepare: vi.fn(() => true),
    sendRearm: vi.fn(() => true),
    waitStatus: vi.fn(async (spec) => ({
      sessionId: spec.sessionId,
      requestId: spec.requestId,
      status: spec.statuses.includes("rearmed") ? ("rearmed" as const) : ("prepared" as const)
    })),
    cancelWait: vi.fn(),
    ...overrides
  };
}

describe("voiceAnchorFlow 处理链", () => {
  it("排空等待预算与合同 120s 一致,不是 8s", () => {
    expect(STATUS_TIMEOUT_MS).toBe(VOICE_QUIESCE_TIMEOUT_MS);
    expect(STATUS_TIMEOUT_MS).toBe(120_000);
  });

  it("HTTP/prepared/rearmed 成功仍保留未发送草稿;waiter 先于 prepare", async () => {
    const store = sessionStorage;
    const epoch = newId("evt");
    const payload = {
      focusId: newId("foc"),
      title: "主题",
      laneTitle: "主线",
      draft: "还没发出的稿"
    };
    const statuses: Array<"prepared" | "rearmed"> = ["prepared", "rearmed"];
    const port = basePort({
      daemonEpoch: epoch,
      waitStatus: vi.fn(async (spec) => {
        const status = statuses.shift() ?? "rearmed";
        return { sessionId: spec.sessionId, requestId: spec.requestId, status };
      })
    });
    const persisted: Array<string | undefined> = [];
    const result = await runVoiceAnchorFlow({
      ownerOk: () => true,
      payload,
      liveDraft: () => "还没发出的稿",
      persist: (next) => persisted.push(next.draft),
      port
    });
    expect(result.status).toBe("ready");
    expect(port.sendPrepare).toHaveBeenCalled();
    expect(port.waitStatus).toHaveBeenCalled();
    const waitOrder = (port.waitStatus as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!;
    const prepareOrder = (port.sendPrepare as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!;
    expect(waitOrder).toBeLessThan(prepareOrder);
    expect(port.finalizeRecordingEdit).not.toHaveBeenCalled();
    expect(posts[0]).toMatchObject({ focusId: payload.focusId, laneTitle: "主线" });
    expect((posts[0] as { requestId: string }).requestId.startsWith("evt_")).toBe(true);
    expect(persisted.every((draft) => draft === "还没发出的稿")).toBe(true);
    expect(readPendingAnchor(store)?.draft).toBe("还没发出的稿");
    expect(store.getItem(PENDING_ANCHOR_KEY)).toContain("还没发出的稿");
  });

  it("实际在录 PTT 只 finalize 一次 edit;HF 不补 done", async () => {
    const ptt = basePort({
      micActive: true,
      mode: "ptt"
    });
    await runVoiceAnchorFlow({
      ownerOk: () => true,
      payload: { focusId: newId("foc"), draft: "ptt" },
      liveDraft: () => "ptt",
      persist: () => undefined,
      port: ptt
    });
    expect(ptt.stopMic).toHaveBeenCalledOnce();
    expect(ptt.finalizeRecordingEdit).toHaveBeenCalledOnce();

    const hf = basePort({
      micActive: true,
      mode: "hands_free"
    });
    await runVoiceAnchorFlow({
      ownerOk: () => true,
      payload: { focusId: newId("foc"), draft: "hf" },
      liveDraft: () => "hf",
      persist: () => undefined,
      port: hf
    });
    expect(hf.stopMic).toHaveBeenCalledOnce();
    expect(hf.finalizeRecordingEdit).not.toHaveBeenCalled();
  });

  it("缺握手或 sendPrepare 未发出则保稿,不走 HTTP", async () => {
    const noHello = basePort({ connected: false, daemonEpoch: null });
    const missed = await runVoiceAnchorFlow({
      ownerOk: () => true,
      payload: { focusId: newId("foc"), draft: "未握手稿" },
      liveDraft: () => "未握手稿",
      persist: () => undefined,
      port: noHello
    });
    expect(missed.status).toBe("failed");
    if (missed.status === "failed") expect(missed.payload.draft).toBe("未握手稿");
    expect(noHello.sendPrepare).not.toHaveBeenCalled();
    expect(posts).toEqual([]);

    const silent = basePort({
      sendPrepare: vi.fn(() => false)
    });
    const blocked = await runVoiceAnchorFlow({
      ownerOk: () => true,
      payload: { focusId: newId("foc"), draft: "未发出" },
      liveDraft: () => "未发出",
      persist: () => undefined,
      port: silent
    });
    expect(blocked.status).toBe("failed");
    expect(silent.cancelWait).toHaveBeenCalled();
    expect(posts).toEqual([]);
  });

  it("voice_audio_unknown 保稿并带回未知世代,不自动带 discard", async () => {
    const port = basePort({
      waitStatus: vi.fn(async (spec) => ({
        sessionId: spec.sessionId,
        requestId: spec.requestId,
        status: "rejected" as const,
        code: "voice_audio_unknown",
        unknownEpochs: [1]
      }))
    });
    const result = await runVoiceAnchorFlow({
      ownerOk: () => true,
      payload: { focusId: newId("foc"), draft: "旧稿还在" },
      liveDraft: () => "旧稿还在",
      persist: () => undefined,
      port
    });
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.unknownEpochs).toEqual([1]);
      expect(result.payload.discardUnknownEpochs).toBeUndefined();
      expect(result.payload.draft).toBe("旧稿还在");
      expect(result.code).toBe("voice_audio_unknown");
    }
    expect(port.sendRearm).not.toHaveBeenCalled();
    expect(posts).toEqual([]);
  });

  it("同 daemonEpoch 重试复用 requestId;换 epoch 换新 ID", () => {
    const epoch = newId("evt");
    const first = ensureAnchorIdentity({ focusId: newId("foc") }, epoch);
    const again = ensureAnchorIdentity(first, epoch);
    expect(again.requestId).toBe(first.requestId);
    const next = ensureAnchorIdentity(again, newId("evt"));
    expect(next.requestId).not.toBe(first.requestId);
  });

  it("failed/dead 后必须换新 ID;未见终态同 epoch 仍复用", () => {
    expect(shouldRenewAnchorRequestId("voice_request_dead")).toBe(true);
    expect(shouldRenewAnchorRequestId("voice_recognition_failed")).toBe(true);
    expect(shouldRenewAnchorRequestId("voice_audio_unknown")).toBe(false);
    const pending = { focusId: newId("foc"), requestId: "evt_old", daemonEpoch: "evt_ep" };
    expect(retryAnchorPayload(pending, "还在", "voice_request_dead").requestId).toBeUndefined();
    expect(retryAnchorPayload(pending, "还在", "voice_audio_unknown").requestId).toBe("evt_old");
    const same = ensureAnchorIdentity(pending, "evt_ep");
    expect(same.requestId).toBe("evt_old");
  });

  it("等待异常时 owner 已换不得覆盖已保存的新稿", async () => {
    const store = sessionStorage;
    const payloadA = { focusId: newId("foc"), draft: "旧A" };
    const payloadB = { focusId: newId("foc"), title: "主题B", draft: "新B" };
    let owner = "A";
    const port = basePort({
      waitStatus: vi.fn(async () => {
        writePendingAnchor(store, payloadB);
        owner = "B";
        throw new Error("anchor status timeout");
      })
    });
    const result = await runVoiceAnchorFlow({
      ownerOk: () => owner === "A",
      payload: payloadA,
      liveDraft: () => (owner === "A" ? "旧A" : "新B"),
      persist: (next) => writePendingAnchor(store, next),
      port
    });
    expect(result.status).toBe("stale");
    expect(readPendingAnchor(store)?.draft).toBe("新B");
    expect(readPendingAnchor(store)?.title).toBe("主题B");
  });

  it("收到 voice_request_dead 后 persist 去掉 requestId", async () => {
    const store = sessionStorage;
    const port = basePort({
      waitStatus: vi.fn(async (spec) => ({
        sessionId: spec.sessionId,
        requestId: spec.requestId,
        status: "rejected" as const,
        code: "voice_request_dead"
      }))
    });
    const result = await runVoiceAnchorFlow({
      ownerOk: () => true,
      payload: { focusId: newId("foc"), draft: "死码后重试", requestId: "evt_dead" },
      liveDraft: () => "死码后重试",
      persist: (next) => writePendingAnchor(store, next),
      port
    });
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.code).toBe("voice_request_dead");
      expect(result.payload.requestId).toBeUndefined();
    }
    expect(readPendingAnchor(store)?.requestId).toBeUndefined();
  });
});


describe("主题续接存储及异常边界", () => {
  it.each(["quota", "getter"])("%s 失败在 prepare/HTTP/rearm 前阻断并保留 owner 稿", async (fault) => {
    if (fault === "quota") vi.stubGlobal("sessionStorage", { setItem: () => { throw new Error("QuotaExceededError"); } });
    else Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get: () => { throw new Error("SecurityError"); } });
    const port = basePort(); const saved: unknown[] = [];
    const result = await runVoiceAnchorFlow({ ownerOk: () => true, payload: { focusId: "foc_A" },
      liveDraft: () => "当前未发送的稿", persist: (p) => { saved.push(p); }, port });
    expect(result).toMatchObject({ status: "failed", payload: { draft: "当前未发送的稿", daemonEpoch: port.daemonEpoch } });
    expect(saved).toHaveLength(1); expect(port.sendPrepare).not.toHaveBeenCalled();
    expect(port.sendRearm).not.toHaveBeenCalled(); expect(posts).toEqual([]);
  });

  it.each(["stopMic", "sendPrepare", "sendRearm", "waitStatus", "persist"])("%s 抛错结算且下一个 owner 正常运行", async (site) => {
    const port = basePort(); const boom = () => { throw new Error("synthetic port failure"); };
    if (site !== "persist") Object.assign(port, { [site]: boom });
    const first = runVoiceAnchorFlow({ ownerOk: () => true, payload: { focusId: "foc_A", draft: "A" },
      liveDraft: () => "A", persist: site === "persist" ? boom : () => undefined, port });
    const timeout = new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error("did not settle")), 200); first.finally(() => clearTimeout(timer)); });
    expect((await Promise.race([first, timeout])).status).toBe("failed");
    const next = basePort();
    expect((await runVoiceAnchorFlow({ ownerOk: () => true, payload: { focusId: "foc_B", draft: "B" },
      liveDraft: () => "B", persist: () => undefined, port: next })).status).toBe("ready");
    expect(next.sendPrepare).toHaveBeenCalledOnce(); expect(next.sendRearm).toHaveBeenCalledOnce();
  });

  it("prepare 后存储失效阻断 HTTP，不自动重放；恢复存储后显式同 ID 重试", async () => {
    const store = sessionStorage; let failed = false; const original = store.setItem;
    store.setItem = (key, value) => { if (failed) throw new Error("quota"); original(key, value); };
    const port = basePort({ waitStatus: vi.fn(async (spec) => {
      failed = true; return { sessionId: spec.sessionId, requestId: spec.requestId, status: "prepared" as const };
    }) });
    const result = await runVoiceAnchorFlow({ ownerOk: () => true, payload: { focusId: "foc_A", draft: "A" },
      liveDraft: () => "A", persist: () => undefined, port });
    expect(result.status).toBe("failed"); expect(posts).toEqual([]); expect(port.sendRearm).not.toHaveBeenCalled();
    if (result.status !== "failed") throw new Error("fixture");
    failed = false; const next = basePort({ daemonEpoch: port.daemonEpoch });
    const retry = await runVoiceAnchorFlow({ ownerOk: () => true, payload: result.payload,
      liveDraft: () => "A", persist: () => undefined, port: next });
    expect(retry.status).toBe("ready"); expect(next.sendPrepare).toHaveBeenCalledWith(expect.objectContaining({ requestId: result.payload.requestId }));
  });
});
