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
        const taskId = o["task_id"] ? String(o["task_id"]) : null;
        // DAILY-01:定位对象——通知行可跳到对应任务验收面;「知道了」只是 ack,不等于任务处理完毕
        const label = `${String(o["task_title"] ?? taskId)} · ${String(o["trigger"])}`;
        return (
          <div key={id} className="flex items-center gap-[10px]" style={{ padding: "10px 0", borderTop: "1px solid var(--line)", fontSize: "var(--text-sm)" }}>
            <Icon size={16} color="var(--text-muted)" aria-hidden />
            <span style={{ flex: 1 }}>
              {taskId ? (
                <a href={`#/review/${encodeURIComponent(taskId)}`} style={{ color: "inherit" }} data-notify-locate={taskId}>
                  {label}
                </a>
              ) : (
                label
              )}
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

/** DAILY-01:全部/未读/已读 筛选;未读=pending|notified(待 ack),终态收据不复活 */
export type NotifyFilter = "all" | "unread" | "read";
const NOTIFY_FILTER_LABEL: Record<NotifyFilter, string> = { all: "全部", unread: "未读", read: "已读" };

function notifyUnread(o: Row): boolean {
  const s = String(o["state"]);
  return s === "pending" || s === "notified";
}

const notifyTabBtn = (active: boolean): React.CSSProperties => ({
  height: 30,
  padding: "0 14px",
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--line)",
  background: active ? "var(--selected-wash)" : "transparent",
  color: active ? "var(--active-ink)" : "var(--text-secondary)",
  fontSize: "var(--text-xs)",
  cursor: "pointer"
});

export function NotifyView({
  rows,
  filter,
  onFilter,
  onAck,
  ackError
}: {
  rows: Row[];
  filter: NotifyFilter;
  onFilter: (f: NotifyFilter) => void;
  onAck: (id: string) => void;
  ackError: string | null;
}): ReactElement {
  const shown = rows.filter((o) =>
    filter === "all" ? true : filter === "unread" ? notifyUnread(o) : !notifyUnread(o)
  );
  return (
    <div data-page="notify">
      <SectionTitle>回叫与通知</SectionTitle>
      <div className="flex items-center gap-[8px]" style={{ margin: "0 0 var(--space-3)" }} data-notify-filters>
        {(["all", "unread", "read"] as const).map((f) => (
          <button key={f} style={notifyTabBtn(filter === f)} data-notify-filter={f} onClick={() => onFilter(f)}>
            {NOTIFY_FILTER_LABEL[f]}
          </button>
        ))}
      </div>
      <NotifyAckError message={ackError} />
      {shown.length === 0 ? (
        <PaperCard>
          <EmptyState icon={Bell} text={filter === "unread" ? "没有未读通知" : filter === "read" ? "还没有已读通知" : "没有通知"} />
        </PaperCard>
      ) : (
        <PaperCard>
          <NotifyOutboxList rows={shown} onAck={onAck} />
        </PaperCard>
      )}
    </div>
  );
}

export function Notify() {
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<NotifyFilter>("all");
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
  return <NotifyView rows={data ?? []} filter={filter} onFilter={setFilter} onAck={onAck} ackError={ackError} />;
}
