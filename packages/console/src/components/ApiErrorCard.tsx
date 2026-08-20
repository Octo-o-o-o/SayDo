// daemon 传输层失败的统一呈现:人话 + 能照做的下一步 + 恢复动作。
//
// 此前主界面对任何失败都只说一句"连接 daemon 失败",于是 403(凭证失效,daemon 好好的)
// 与真的连不上被说成同一件事,用户照着排查 daemon 只会白忙。分类见 lib/apiError.ts。

import { clearCapToken } from "../lib/api";
import type { ApiError } from "../lib/apiError";
import { ErrorCard } from "./ui";

const BUTTON_STYLE = {
  height: 32,
  padding: "0 14px",
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--line)",
  background: "transparent",
  color: "var(--text-primary)",
  fontSize: "var(--text-sm)",
  cursor: "pointer"
} as const;

/** 取新 token 的命令(照抄可用;token 只在本机文件里,不进任何界面文本) */
export function reopenCommand(origin: string): string {
  return `open "${origin}/?token=$(cat ~/.saydo/.cap-token)"`;
}

function CommandLine({ text }: { text: string }) {
  return (
    <pre
      data-reopen-command
      style={{
        margin: "8px 0 0",
        padding: "8px 10px",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-xs)",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-xs)",
        color: "var(--text-secondary)",
        whiteSpace: "pre-wrap",
        userSelect: "all"
      }}
    >
      {text}
    </pre>
  );
}

export function ApiErrorCard({
  failure,
  message,
  fallbackHint
}: {
  /** 分类失败;null=不是传输层错误(页面自己的业务异常),此时只显示 message */
  failure: ApiError | null;
  /** 已人话化的错误文本(useAsync.error) */
  message: string;
  fallbackHint?: string;
}) {
  const kind = failure?.kind;
  const origin = typeof location === "undefined" ? "http://127.0.0.1:47100" : location.origin;

  const action =
    kind === "auth" ? (
      <button
        type="button"
        data-action="clear-cap-token"
        onClick={() => {
          clearCapToken();
          location.reload();
        }}
        style={BUTTON_STYLE}
      >
        清除本机存的旧凭证
      </button>
    ) : kind === "network" || kind === "server" || kind === "starting" ? (
      <button type="button" data-action="retry-request" onClick={() => location.reload()} style={BUTTON_STYLE}>
        重试
      </button>
    ) : null;

  return (
    <div data-api-error-kind={kind ?? "unknown"}>
      <ErrorCard
        message={failure?.message ?? message}
        hint={failure?.hint ?? fallbackHint}
        detail={failure?.detail ?? message}
        action={action}
      />
      {kind === "auth" ? <CommandLine text={reopenCommand(origin)} /> : null}
    </div>
  );
}
