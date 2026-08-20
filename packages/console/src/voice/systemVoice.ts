// 浏览器系统级语音(v3.7 W1):VOLC 未配时 ASR=SpeechRecognition、TTS=speechSynthesis。
// 识别文本走 turn.text(typed submission,与 iOS native 同构),不经 daemon pipeline。

import type { SetupProbe } from "../lib/setupApi";

export const VOICE_SYSTEM_NOTE = "系统语音 · 质量一般,配好 VOLC 更准更自然";
export const VOICE_SYSTEM_UNSUPPORTED_MESSAGE =
  "这台浏览器没有系统语音识别——可以直接打字;配好 VOLC 后这里可以开口即说";
export const VOICE_SETTINGS_COPY = "没配也能说:先用系统语音;配 VOLC 后自动切换云端(更准)";

export type VoiceTransport = "cloud" | "system" | "unavailable";

export type SystemVoiceCaps = {
  asr: boolean;
  tts: boolean;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal?: boolean; 0?: { transcript?: string } }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export type SystemVoiceHost = {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
  speechSynthesis?: SpeechSynthesis;
};

export function detectSystemVoiceCaps(host: SystemVoiceHost = globalThis as SystemVoiceHost): SystemVoiceCaps {
  const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  return {
    asr: typeof Ctor === "function",
    tts: typeof host.speechSynthesis === "object" && host.speechSynthesis !== null
  };
}

export function isVolcConfigured(probe: SetupProbe | null): boolean {
  return probe?.secrets["VOLC_APP_ID"] === true && probe?.secrets["VOLC_ACCESS_TOKEN"] === true;
}

export function resolveVoiceTransport(
  probe: SetupProbe | null,
  liveHealth: { asr: string } | null,
  caps: SystemVoiceCaps
): VoiceTransport {
  if (!probe) return "unavailable";
  if (isVolcConfigured(probe)) {
    if (liveHealth && liveHealth.asr !== "ok") return "unavailable";
    if (probe.voice.pipelinePeer === false || probe.voice.asr !== "ok") return "unavailable";
    return "cloud";
  }
  return caps.asr ? "system" : "unavailable";
}

export function reportSystemVoiceTest(caps: SystemVoiceCaps): {
  status: "ok" | "fail";
  error: string;
} {
  const asr = caps.asr ? "可用" : "不可用";
  const tts = caps.tts ? "可用" : "不可用";
  return {
    status: caps.asr || caps.tts ? "ok" : "fail",
    error: `浏览器 ASR ${asr} / TTS ${tts}`
  };
}

export function pickChineseVoice(
  voices: ReadonlyArray<{ lang: string; name: string }>
): { lang: string; name: string } | null {
  const zh = voices.filter((v) => /^zh\b/i.test(v.lang) || /chinese|中文/i.test(v.name));
  return (
    zh.find((v) => /CN|Hans|China/i.test(v.lang) || /Chinese/i.test(v.name)) ??
    zh[0] ??
    null
  );
}

export function speakSystemTts(text: string, host: SystemVoiceHost = globalThis as SystemVoiceHost): boolean {
  const synth = host.speechSynthesis;
  const trimmed = text.trim();
  if (!synth || trimmed === "") return false;
  const utter = new SpeechSynthesisUtterance(trimmed);
  const picked = pickChineseVoice(synth.getVoices());
  if (picked) {
    const match = synth.getVoices().find((v) => v.name === picked.name && v.lang === picked.lang);
    if (match) utter.voice = match;
    utter.lang = picked.lang;
  } else {
    utter.lang = "zh-CN";
  }
  synth.speak(utter);
  return true;
}

export function cancelSystemTts(host: SystemVoiceHost = globalThis as SystemVoiceHost): void {
  host.speechSynthesis?.cancel();
}

export type SystemAsrSession = {
  start(): boolean;
  stop(): string;
  abort(): void;
  transcript(): string;
};

export function createSystemAsrSession(host: SystemVoiceHost = globalThis as SystemVoiceHost): SystemAsrSession | null {
  const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  if (typeof Ctor !== "function") return null;
  let rec: SpeechRecognitionLike | null = null;
  let text = "";
  return {
    start() {
      this.abort();
      text = "";
      rec = new Ctor();
      rec.lang = "zh-CN";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (ev) => {
        let next = "";
        for (let i = 0; i < ev.results.length; i++) {
          next += ev.results[i]?.[0]?.transcript ?? "";
        }
        text = next;
      };
      rec.onerror = () => {
        // 权限拒绝/无匹配等:停录后由调用方按空转写处理
      };
      try {
        rec.start();
        return true;
      } catch {
        rec = null;
        return false;
      }
    },
    stop() {
      const out = text.trim();
      try {
        rec?.stop();
      } catch {
        // already stopped
      }
      rec = null;
      return out;
    },
    abort() {
      try {
        rec?.abort();
      } catch {
        // already aborted
      }
      rec = null;
      text = "";
    },
    transcript() {
      return text;
    }
  };
}
