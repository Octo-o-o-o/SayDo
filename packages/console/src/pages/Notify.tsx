// 回叫与通知时间线(#/notify;升级链 L0/L1/L2 图标恒 muted——历史记录不再警示,11 §2.6)。

import { useState, type ReactElement } from "react";
import { Bell, BellRing, MonitorSpeaker, Phone } from "lucide-react";
import { api, type Row } from "../lib/api";
import { apiErrorMessage } from "../lib/apiError";
import { useAsync } from "../lib/useAsync";
import { EmptyState, ErrorCard, PaperCard, Mono, SectionTitle } from "../components/ui";

const ESC_ICON = [Phone, MonitorSpeaker, BellRing] as const;

export function requestOutboxAck(id: string): Promise<{ ok: true; state: string; already?: boolean }> {
  return api.ackOutbox(id);
}

/** Notify() 的按钮回调:ack 成功刷新,失败可见。 */
export function makeNotifyAckHandler(
  ack: (id: string) => Promise<unknown>,
  onOk: () => void,
  onErr: (message: string) => void
): (id: string) => void {
  return (id: string): void => {
    void ack(id).then(
      () => onOk(),
      (err: unknown) => onErr(apiErrorMessage(err))
    );
  };
}

export function NotifyAckError({ message }: { message: string | null }): ReactElement | null {
  if (!message) return null;
  return (
    <p data-ack-error style={{ margin: "0 0 var(--space-3)", fontSize: "var(--text-sm)", color: "var(--color-error)" }}>
      {message}
    </p>
  );
}

export function NotifyAckButton({ id, onAck }: { id: string; onAck: (id: string) => void }): ReactElement {
  return (
    <button
      type="button"
      data-outbox-ack={id}
      onClick={() => onAck(id)}
      style={{
        padding: "4px 10px",
        borderRadius: "var(--radius-xs)",
        border: "1px solid var(--line)",
        background: "var(--surface-control)",
        color: "var(--text-secondary)",
        fontSize: "var(--text-xs)",
        cursor: "pointer"
      }}
    >
      知道了
    </button>
  );
}

export function NotifyOutboxList({
  rows,
  onAck
}: {
  rows: Row[];
  onAck: (id: string) => void;
}): ReactElement {
  return (
    <div className="flex flex-col" data-outbox-list>
      {rows.map((o) => {
        const esc = Math.min(Number(o["escalation"] ?? 0), 2);
        const Icon = ESC_ICON[esc] ?? Phone;
        const id = String(o["id"]);
        const state = String(o["state"]);
        const showAck = state === "notified";
        return (
          <div key={id} className="flex items-center gap-[10px]" style={{ padding: "10px 0", borderTop: "1px solid var(--line)", fontSize: "var(--text-sm)" }}>
            <Icon size={16} color="var(--text-muted)" aria-hidden />
            <span style={{ flex: 1 }}>
              {String(o["task_title"] ?? o["task_id"])} · {String(o["trigger"])}
            </span>
            <span style={{ color: "var(--text-muted)" }}>{state}</span>
            <Mono>{String(o["created_at"] ?? "").slice(5, 16)}</Mono>
            {showAck ? <NotifyAckButton id={id} onAck={onAck} /> : null}
          </div>
        );
      })}
    </div>
  );
}

export function NotifyView({
  rows,
  onAck,
  ackError
}: {
  rows: Row[];
  onAck: (id: string) => void;
  ackError: string | null;
}): ReactElement {
  return (
    <div data-page="notify">
      <SectionTitle>回叫与通知</SectionTitle>
      <NotifyAckError message={ackError} />
      {rows.length === 0 ? (
        <PaperCard>
          <EmptyState icon={Bell} text="没有通知" />
        </PaperCard>
      ) : (
        <PaperCard>
          <NotifyOutboxList rows={rows} onAck={onAck} />
        </PaperCard>
      )}
    </div>
  );
}

export function Notify() {
  const [tick, setTick] = useState(0);
  const [ackError, setAckError] = useState<string | null>(null);
  const { data, error } = useAsync(() => api.outbox(), [tick]);
  if (error) return <ErrorCard message="通知加载失败" detail={error} />;
  const onAck = makeNotifyAckHandler(
    requestOutboxAck,
    () => {
      setAckError(null);
      setTick((n) => n + 1);
    },
    (message) => setAckError(message)
  );
  return <NotifyView rows={data ?? []} onAck={onAck} ackError={ackError} />;
}
