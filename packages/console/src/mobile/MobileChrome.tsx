import { ArrowLeft, Menu, Mic, RefreshCw, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useSetup } from "../shell/SetupContext";
import { loadRecentMemories, type MobileMemoryRow } from "./data";
import type { DaemonStatus } from "./dstat";
import { memoryRowView } from "./memoryView";

const STATUS_LABEL: Record<DaemonStatus, string> = {
  connecting: "连接中",
  online: "在线",
  offline: "等待桌面连接"
};

export function MobileHeader({ title, crumb, back }: { title: string; crumb: string; back?: string }) {
  return (
    <header className="m-topbar">
      {back ? (
        <a className="m-back" href={`#${back}`} aria-label="返回">
          <ArrowLeft size={18} aria-hidden />
        </a>
      ) : (
        <span className="m-avatar" aria-hidden>
          S
        </span>
      )}
      <div className="m-titlebox">
        <div className="m-title">{title}</div>
        <div className="m-crumb">{crumb}</div>
      </div>
    </header>
  );
}

export function MobileShell({
  children,
  status,
  menuOpen,
  setMenuOpen,
  draft,
  setDraft,
  onSend,
  sending = false,
  nativeMode = false,
  onReconnect
}: {
  children: ReactNode;
  status: DaemonStatus;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  draft: string;
  setDraft: (draft: string) => void;
  onSend: () => void;
  sending?: boolean;
  nativeMode?: boolean;
  onReconnect?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (status === "online") onSend();
  };
  const waitingDesktop = status === "offline" || status === "connecting";
  return (
    <div className="m-root" data-mobile-shell data-dstat={status} data-native={nativeMode ? "true" : "false"}>
      <div className={`m-dstat m-dstat-${status}`} role="status">
        <span className="m-dstat-dot" aria-hidden />
        {STATUS_LABEL[status]}
        {status === "offline" ? <span> · 已禁发</span> : null}
        {waitingDesktop && onReconnect ? (
          <button
            type="button"
            className="m-dstat-reconnect"
            onClick={onReconnect}
            aria-label="立即重连"
          >
            <RefreshCw size={12} aria-hidden />
            重连
          </button>
        ) : null}
      </div>
      <main className="m-main">{children}</main>
      <form className="m-dock" onSubmit={submit}>
        <button className="m-menu-button" type="button" onClick={() => setMenuOpen(true)} aria-label="打开菜单">
          <Menu size={21} aria-hidden />
        </button>
        <div className="m-composer">
          <button
            type="button"
            className="m-mic-focus"
            aria-label="聚焦输入，使用键盘话筒"
            onClick={() => inputRef.current?.focus()}
          >
            <Mic size={18} aria-hidden />
          </button>
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="用键盘上的话筒说话"
            aria-label="消息"
          />
          <button
            type="submit"
            className="m-send"
            disabled={status !== "online" || draft.trim() === "" || sending}
            aria-label="发送"
          >
            <Send size={17} aria-hidden />
          </button>
        </div>
      </form>
      {menuOpen ? <MobileMenu status={status} onClose={() => setMenuOpen(false)} onReconnect={onReconnect} /> : null}
    </div>
  );
}

function MobileMenu({
  status,
  onClose,
  onReconnect
}: {
  status: DaemonStatus;
  onClose: () => void;
  onReconnect?: () => void;
}) {
  const setup = useSetup();
  const [memories, setMemories] = useState<MobileMemoryRow[] | null>(null);
  const [memoryError, setMemoryError] = useState(false);
  const showFinishSetup = setup.peeked && !setup.dialogReady;

  useEffect(() => {
    let active = true;
    void loadRecentMemories(12).then(
      (rows) => {
        if (!active) return;
        setMemories(rows);
        setMemoryError(false);
      },
      () => {
        if (active) {
          setMemories([]);
          setMemoryError(true);
        }
      }
    );
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="m-menu-mask" role="presentation" onClick={onClose}>
      <aside className="m-menu" aria-label="移动菜单" onClick={(event) => event.stopPropagation()}>
        <div className="m-menu-head">
          <div>
            <strong data-brand-lockup>说到 SayDo</strong>
            <span>同一本账</span>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭菜单">
            <X size={19} aria-hidden />
          </button>
        </div>
        <nav>
          {showFinishSetup ? (
            <button
              type="button"
              data-action="finish-setup"
              onClick={() => {
                setup.setPeeked(false);
                onClose();
              }}
            >
              完成配置<span>请用更宽的窗口继续向导</span>
            </button>
          ) : null}
          <a href="#/m" onClick={onClose}>
            今天<span>四色收件箱</span>
          </a>
          <a href="#/m/chat" onClick={onClose}>
            开口聊<span>文本与键盘听写</span>
          </a>
          <a href="#/m/things" onClick={onClose}>
            事<span>Focus 与泳道</span>
          </a>
        </nav>
        <div className="m-menu-memory" data-mobile-memory>
          <span>记忆库</span>
          {memories === null ? (
            <small>正在取最近记忆…</small>
          ) : memoryError ? (
            <small>记忆暂时取不到，桌面仍可查看</small>
          ) : memories.length === 0 ? (
            <small>还没有沉淀记忆；聊过并确认的会记在这里</small>
          ) : (
            <ul className="m-memory-ledger">
              {memories.map((row) => {
                const view = memoryRowView(row);
                return (
                  <li key={row.id} className="m-memory-row">
                    <strong>{view.title}</strong>
                    <span>
                      {view.time} · {view.source}
                      {view.tier ? ` · ${view.tier}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="m-menu-readonly">
          <span>连接状态</span>
          <strong>{STATUS_LABEL[status]}</strong>
          {status !== "online" && onReconnect ? (
            <button type="button" className="m-menu-reconnect" onClick={onReconnect}>
              立即重连
            </button>
          ) : (
            <small>M1 只读；配对与设备管理在后续批次</small>
          )}
        </div>
        <div className="m-menu-readonly">
          <span>设置</span>
          <strong>桌面查看</strong>
          <small>M1 不开放手机配置写口</small>
        </div>
      </aside>
    </div>
  );
}

export function MobileNotice({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "error" }) {
  return <div className={`m-notice m-notice-${tone}`}>{children}</div>;
}
