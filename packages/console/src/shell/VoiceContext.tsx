// 语音会话上下文(08 §6 关键语义②:切导航不断会话——通道挂在 App 层,页面只消费)。
// 顶栏指示器三态(11 §5.7):活跃(连接+锚定项目)/挂起/无会话。

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useVoiceChannel } from "../voice/useVoiceChannel";
import { navigate } from "../lib/router";
import { sessionProjectRoute } from "../voice/sessionProject";

type VoiceApi = ReturnType<typeof useVoiceChannel> & {
  sessionId: string;
  anchorProjectId: string | null;
  setAnchorProjectId: (id: string | null) => void;
};

const VoiceCtx = createContext<VoiceApi | null>(null);
const SESSION_STORAGE_KEY = "saydo.voice.sessionId";

function newSessionId(): string {
  // ULID 形态占位(Crockford Base32 26 位;console 侧只作 WS 会话锚,真 ULID 由 daemon 侧生成)
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let s = "";
  for (let i = 0; i < 26; i++) s += alphabet[Math.floor(Math.random() * 32)];
  return `ses_${s}`;
}

function currentSessionId(): string {
  const stored = localStorage.getItem(SESSION_STORAGE_KEY);
  if (/^ses_[0-9A-HJKMNP-TV-Z]{26}$/u.test(stored ?? "")) return stored as string;
  const created = newSessionId();
  localStorage.setItem(SESSION_STORAGE_KEY, created);
  return created;
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [sessionId] = useState(currentSessionId);
  const [anchorProjectId, setAnchorProjectId] = useState<string | null>(null);
  const channel = useVoiceChannel(sessionId);
  // K1 世代检测(义骁 8/6 实测:daemon 清零/重启后旧页面照常显示旧世界):/health stateRootDigest
  // 变化 ⇒ 报废本地 sessionId + 整页刷新一次(digest 先落 storage 防刷新循环)
  useEffect(() => {
    void fetch("/health")
      .then((r) => r.json())
      .then((h: { stateRootDigest?: string }) => {
        const digest = h?.stateRootDigest ?? "";
        if (!digest) return;
        const KEY = "saydo.stateRootDigest";
        const prev = localStorage.getItem(KEY);
        localStorage.setItem(KEY, digest);
        if (prev && prev !== digest) {
          localStorage.removeItem(SESSION_STORAGE_KEY);
          location.reload();
        }
      })
      .catch(() => {
        // health 不可达不拦启动
      });
  }, []);
  useEffect(() => {
    const event = channel.sessionProject;
    if (!event) return;
    setAnchorProjectId(event.projectId);
    const target = sessionProjectRoute(event);
    const cur = location.hash.replace(/^#/, "");
    // L3(义骁 8/6 实测):主轴倒置后项目锚定不再抢导航——刷新看板被强跳对话页的根因即此处
    // 无条件 navigate。仅当用户本就在对话/项目页时跟随路径刷新;看板/Focus 详情等页保持原地。
    const onProjectish = cur === "/chat" || cur.startsWith("/p/");
    if (onProjectish && cur !== target) navigate(target);
  }, [channel.sessionProject]);
  // 5.2 验收锚:切导航不断会话 ⇒ Provider 只挂载一次(Playwright 断言此计数恒 1)
  useState(() => {
    const w = window as unknown as { __saydoVoiceMounts?: number };
    w.__saydoVoiceMounts = (w.__saydoVoiceMounts ?? 0) + 1;
    return 0;
  });
  const value = useMemo(
    () => ({ ...channel, sessionId, anchorProjectId, setAnchorProjectId }),
    [channel, sessionId, anchorProjectId]
  );
  return <VoiceCtx.Provider value={value}>{children}</VoiceCtx.Provider>;
}

export function useVoice(): VoiceApi {
  const v = useContext(VoiceCtx);
  if (!v) throw new Error("useVoice outside VoiceProvider");
  return v;
}
