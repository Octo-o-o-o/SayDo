import { describe, expect, it } from "vitest";
import type { SetupProbe } from "../lib/setupApi";
import {
  detectSystemVoiceCaps,
  isVolcConfigured,
  pickChineseVoice,
  reportSystemVoiceTest,
  resolveVoiceTransport,
  type SystemVoiceHost
} from "./systemVoice";

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

class FakeRec {
  lang = "";
  continuous = false;
  interimResults = false;
  onresult = null;
  onerror = null;
  onend = null;
  start(): void {}
  stop(): void {}
  abort(): void {}
}

describe("系统级语音形态切换", () => {
  it("VOLC 未配且浏览器 ASR 可用时走系统级", () => {
    expect(isVolcConfigured(probe({}, "down"))).toBe(false);
    expect(resolveVoiceTransport(probe({}, "down"), null, { asr: true, tts: true })).toBe("system");
    expect(resolveVoiceTransport(probe({}, "down"), { asr: "down" }, { asr: true, tts: false })).toBe("system");
  });

  it("VOLC 已配且 pipeline 就绪时走云端,系统级退位", () => {
    const ready = probe({ VOLC_APP_ID: true, VOLC_ACCESS_TOKEN: true }, "ok", true);
    expect(isVolcConfigured(ready)).toBe(true);
    expect(resolveVoiceTransport(ready, { asr: "ok" }, { asr: true, tts: true })).toBe("cloud");
    expect(resolveVoiceTransport(ready, null, { asr: true, tts: true })).toBe("cloud");
  });

  it("VOLC 已配但 pipeline 未就绪时仍不可用,不回落系统级", () => {
    const keys = { VOLC_APP_ID: true, VOLC_ACCESS_TOKEN: true };
    expect(resolveVoiceTransport(probe(keys, "ok", false), null, { asr: true, tts: true })).toBe("unavailable");
    expect(resolveVoiceTransport(probe(keys, "degraded", true), null, { asr: true, tts: true })).toBe(
      "unavailable"
    );
    expect(resolveVoiceTransport(probe(keys, "ok", true), { asr: "down" }, { asr: true, tts: true })).toBe(
      "unavailable"
    );
  });

  it("VOLC 未配且浏览器无 ASR 时按现状禁用", () => {
    expect(resolveVoiceTransport(probe({}, "down"), null, { asr: false, tts: true })).toBe("unavailable");
    expect(resolveVoiceTransport(null, null, { asr: true, tts: true })).toBe("unavailable");
  });

  it("特性检测认 SpeechRecognition 与 webkit 前缀,以及 speechSynthesis", () => {
    expect(detectSystemVoiceCaps({} as SystemVoiceHost)).toEqual({ asr: false, tts: false });
    expect(detectSystemVoiceCaps({ webkitSpeechRecognition: FakeRec, speechSynthesis: {} as SpeechSynthesis })).toEqual({
      asr: true,
      tts: true
    });
    expect(detectSystemVoiceCaps({ SpeechRecognition: FakeRec })).toEqual({ asr: true, tts: false });
  });

  it("测试语音在系统级形态如实报告 ASR/TTS", () => {
    expect(reportSystemVoiceTest({ asr: true, tts: true })).toEqual({
      status: "ok",
      error: "浏览器 ASR 可用 / TTS 可用"
    });
    expect(reportSystemVoiceTest({ asr: true, tts: false })).toEqual({
      status: "ok",
      error: "浏览器 ASR 可用 / TTS 不可用"
    });
    expect(reportSystemVoiceTest({ asr: false, tts: false })).toEqual({
      status: "fail",
      error: "浏览器 ASR 不可用 / TTS 不可用"
    });
  });

  it("中文 voice 优先", () => {
    expect(
      pickChineseVoice([
        { lang: "en-US", name: "Samantha" },
        { lang: "zh-CN", name: "Tingting" },
        { lang: "zh-TW", name: "Meijia" }
      ])
    ).toEqual({ lang: "zh-CN", name: "Tingting" });
    expect(pickChineseVoice([{ lang: "en-US", name: "Alex" }])).toBeNull();
  });
});
