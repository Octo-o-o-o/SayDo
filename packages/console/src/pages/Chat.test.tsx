import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  CHAT_EXAMPLES,
  ChatExampleCards,
  firstRunAssistantTurn,
  VOICE_DISABLED_MESSAGE,
  VOICE_DISCONNECTED_MESSAGE,
  VOICE_SYSTEM_NOTE,
  VOICE_SYSTEM_UNSUPPORTED_MESSAGE,
  VOICE_UNCONFIGURED_MESSAGE,
  VoiceStartButton,
  confirmCardCopy,
  voiceInputUnavailable
} from "./Chat";
import type { SetupProbe } from "../lib/setupApi";
import { THINKING_FALLBACK_MS } from "../voice/useVoiceChannel";

describe("Chat 空态案例卡", () => {
  it("渲染四张固定案例卡", () => {
    const html = renderToStaticMarkup(<ChatExampleCards onPick={() => {}} />);
    expect(html.match(/data-chat-example="true"/g)).toHaveLength(4);
    for (const text of CHAT_EXAMPLES) expect(html).toContain(text);
  });

  it("点击只把案例交给 draft 回调,不触发发送动作", () => {
    const onPick = vi.fn();
    const element = ChatExampleCards({ onPick }) as ReactElement<{
      children: ReactElement<{ onClick: () => void }>[];
    }>;
    element.props.children[0]!.props.onClick();
    expect(onPick).toHaveBeenCalledOnce();
    expect(onPick).toHaveBeenCalledWith(CHAT_EXAMPLES[0]);
  });
});

describe("first-run 三态呈现", () => {
  it("eligible presented+delivered 生成普通 assistant turn", () => {
    expect(
      firstRunAssistantTurn({
        state: "presented",
        delivered: true,
        message: "固定开场白",
        turnId: "turn_1"
      })
    ).toEqual({ key: "onboarding-turn_1", text: "固定开场白" });
  });

  it("legacy 与抢先用户态都不生成消息", () => {
    expect(firstRunAssistantTurn({ state: "legacy_not_eligible", delivered: false })).toBeNull();
    expect(firstRunAssistantTurn({ state: "skipped_by_user", delivered: false })).toBeNull();
  });
});

describe("语音未配置降级态", () => {
  const probe = (secrets: Record<string, boolean>, asr: string, pipelinePeer?: boolean): SetupProbe =>
    ({
      config: { present: true, slots: {} },
      secrets,
      acks: { evaluator_isolation: false, evaluator_same_family: false },
      hints: [],
      clis: [],
      voice: { asr, tts: "down", ...(pipelinePeer === undefined ? {} : { pipelinePeer }) },
      pendingConfig: null,
      pendingEnv: null,
      recovery: { active: false, mode: "normal", violations: [] }
    }) as SetupProbe;

  it("probe 缺 ASR 配置时禁用点击说话并渲染完整人话", () => {
    const unavailable = voiceInputUnavailable(probe({}, "down"));
    const html = renderToStaticMarkup(
      <VoiceStartButton unavailable={unavailable} handsFree={false} onClick={() => {}} />
    );
    expect(unavailable).toBe(true);
    expect(html).toContain("disabled");
    expect(html).toContain(VOICE_UNCONFIGURED_MESSAGE);
    expect(html).toContain("点击说话");
  });

  it("probe 尚未取得或请求失败时保持 fail-safe 禁用", () => {
    expect(voiceInputUnavailable(null)).toBe(true);
    expect(voiceInputUnavailable(null, { asr: "down" })).toBe(true);
  });

  it("console WS 未连接时使用连接态人话,不冒充缺 key", () => {
    const html = renderToStaticMarkup(
      <VoiceStartButton
        unavailable
        unavailableMessage={VOICE_DISCONNECTED_MESSAGE}
        handsFree={false}
        onClick={() => {}}
      />
    );
    expect(html).toContain(VOICE_DISCONNECTED_MESSAGE);
    expect(html).not.toContain(VOICE_UNCONFIGURED_MESSAGE);
  });

  it("ASR key 与 probe 都就绪时按钮不降级", () => {
    expect(
      voiceInputUnavailable(
        probe({ VOLC_APP_ID: true, VOLC_ACCESS_TOKEN: true }, "ok")
      )
    ).toBe(false);
  });

  it("密钥存在但 pipeline peer 未在线时仍禁用,不把配置形状冒充可用", () => {
    expect(voiceInputUnavailable(probe({ VOLC_APP_ID: true, VOLC_ACCESS_TOKEN: true }, "ok", false))).toBe(true);
    const html = renderToStaticMarkup(
      <VoiceStartButton unavailable unavailableMessage={VOICE_DISABLED_MESSAGE} handsFree={false} onClick={() => {}} />
    );
    expect(html).toContain("文本与控制面可用,语音未启用");
    expect(html).not.toContain("豆包 key");
  });

  it("probe degraded 或实时 ASR 掉线时立即禁用", () => {
    const ready = probe({ VOLC_APP_ID: true, VOLC_ACCESS_TOKEN: true }, "ok", true);
    expect(voiceInputUnavailable(probe({ VOLC_APP_ID: true, VOLC_ACCESS_TOKEN: true }, "degraded", true))).toBe(true);
    expect(voiceInputUnavailable(ready, { asr: "down" })).toBe(true);
    expect(voiceInputUnavailable(ready, { asr: "ok" })).toBe(false);
  });

  it("VOLC 未配且浏览器 ASR 可用时走系统级,按钮可用并旁注质量分层", () => {
    const unavailable = voiceInputUnavailable(probe({}, "down"), null, { asr: true, tts: true });
    const html = renderToStaticMarkup(
      <VoiceStartButton
        unavailable={unavailable}
        handsFree={false}
        onClick={() => {}}
        systemNote={VOICE_SYSTEM_NOTE}
      />
    );
    expect(unavailable).toBe(false);
    expect(html).not.toContain("disabled");
    expect(html).toContain(VOICE_SYSTEM_NOTE);
    expect(html).toContain("点击说话");
  });

  it("VOLC 未配且浏览器无 ASR 时仍禁用并如实说明", () => {
    const unavailable = voiceInputUnavailable(probe({}, "down"), null, { asr: false, tts: true });
    const html = renderToStaticMarkup(
      <VoiceStartButton
        unavailable={unavailable}
        unavailableMessage={VOICE_SYSTEM_UNSUPPORTED_MESSAGE}
        handsFree={false}
        onClick={() => {}}
      />
    );
    expect(unavailable).toBe(true);
    expect(html).toContain("disabled");
    expect(html).toContain(VOICE_SYSTEM_UNSUPPORTED_MESSAGE);
  });

  it("VOLC 已配时系统级退位,仍按 pipeline 健康判定", () => {
    const ready = probe({ VOLC_APP_ID: true, VOLC_ACCESS_TOKEN: true }, "ok", true);
    expect(voiceInputUnavailable(ready, { asr: "ok" }, { asr: true, tts: true })).toBe(false);
    expect(voiceInputUnavailable(ready, { asr: "down" }, { asr: true, tts: true })).toBe(true);
    expect(
      voiceInputUnavailable(probe({ VOLC_APP_ID: true, VOLC_ACCESS_TOKEN: true }, "ok", false), null, {
        asr: true,
        tts: true
      })
    ).toBe(true);
  });
});

describe("CLI 慢速轮次进度", () => {
  it("thinking 兜底覆盖 BYOA 120 秒 wall timeout", () => {
    expect(THINKING_FALLBACK_MS).toBeGreaterThan(240_000);
  });
});

describe("生产确认卡 kind 文案(GAP-02 2.1)", () => {
  it("memory kind:记忆 · 信息确认 · 不是授权,按钮记/不用记,超时不记", () => {
    const copy = confirmCardCopy("memory");
    expect(copy.label).toBe("记忆 · 信息确认 · 不是授权");
    expect(copy.accept).toBe("记");
    expect(copy.reject).toBe("不用记");
    expect(copy.countdownHint).toContain("不记");
    expect(copy.countdownHint).not.toContain("自动执行");
  });

  it("其它 kind 与表外 kind 沿用做/不要与自动执行说明", () => {
    for (const kind of ["dispatch", "readiness", "something_new"]) {
      const copy = confirmCardCopy(kind);
      expect(copy.label).toBeNull();
      expect(copy.accept).toBe("做");
      expect(copy.reject).toBe("不要");
      expect(copy.countdownHint).toContain("自动执行");
    }
  });
});
