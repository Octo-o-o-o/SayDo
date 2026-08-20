import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import {
  makeNotifyAckHandler,
  NotifyAckButton,
  NotifyAckError,
  NotifyOutboxList,
  NotifyView,
  requestOutboxAck
} from "./Notify";

describe("Notify 知道了", () => {
  it("notified 行显示按钮;acked/resolved 行仍在但无按钮", () => {
    const onAck = vi.fn();
    const html = renderToStaticMarkup(
      <NotifyOutboxList
        rows={[
          {
            id: "ntf_01AAAAAAAAAAAAAAAAAAAAAAAA",
            state: "notified",
            trigger: "blocked",
            task_title: "导出功能",
            created_at: "2026-07-25T10:00:00.000Z",
            escalation: 0
          },
          {
            id: "ntf_01BBBBBBBBBBBBBBBBBBBBBBBB",
            state: "acked",
            trigger: "blocked",
            task_title: "导出功能",
            created_at: "2026-07-25T10:01:00.000Z",
            escalation: 0
          },
          {
            id: "ntf_01CCCCCCCCCCCCCCCCCCCCCCCC",
            state: "resolved",
            trigger: "ready_for_review",
            task_title: "导出功能",
            created_at: "2026-07-25T10:02:00.000Z",
            escalation: 1
          }
        ]}
        onAck={onAck}
      />
    );
    expect(html).toContain("知道了");
    expect(html).toContain('data-outbox-ack="ntf_01AAAAAAAAAAAAAAAAAAAAAAAA"');
    expect(html.match(/data-outbox-ack=/g)).toHaveLength(1);
    expect(html).toContain("acked");
    expect(html).toContain("resolved");

    const btn = NotifyAckButton({ id: "ntf_01AAAAAAAAAAAAAAAAAAAAAAAA", onAck }) as ReactElement<{
      onClick: () => void;
    }>;
    btn.props.onClick();
    expect(onAck).toHaveBeenCalledOnce();
    expect(onAck).toHaveBeenCalledWith("ntf_01AAAAAAAAAAAAAAAAAAAAAAAA");
  });

  it("点击走 api.ackOutbox;失败文案可见", async () => {
    const spy = vi.spyOn(api, "ackOutbox").mockResolvedValue({ ok: true, state: "acked" });
    await requestOutboxAck("ntf_01AAAAAAAAAAAAAAAAAAAAAAAA");
    expect(spy).toHaveBeenCalledWith("ntf_01AAAAAAAAAAAAAAAAAAAAAAAA");
    spy.mockRejectedValueOnce(new Error("网络中断"));
    await expect(requestOutboxAck("ntf_x")).rejects.toThrow("网络中断");
    const failHtml = renderToStaticMarkup(<NotifyAckError message="知道了失败,请再试一次" />);
    expect(failHtml).toContain("data-ack-error");
    expect(failHtml).toContain("知道了失败");
    expect(renderToStaticMarkup(<NotifyAckError message={null} />)).toBe("");
    spy.mockRestore();
  });

  it("NotifyView 按钮 → onAck → api.ackOutbox(Notify 全路径)", async () => {
    const spy = vi.spyOn(api, "ackOutbox").mockResolvedValue({ ok: true, state: "acked" });
    const onOk = vi.fn();
    const onErr = vi.fn();
    const onAck = makeNotifyAckHandler(requestOutboxAck, onOk, onErr);
    const notified = {
      id: "ntf_01AAAAAAAAAAAAAAAAAAAAAAAA",
      state: "notified",
      trigger: "blocked",
      task_title: "导出功能",
      created_at: "2026-07-25T10:00:00.000Z",
      escalation: 0
    };
    const html = renderToStaticMarkup(<NotifyView rows={[notified]} onAck={onAck} ackError={null} />);
    expect(html).toContain('data-outbox-ack="ntf_01AAAAAAAAAAAAAAAAAAAAAAAA"');
    expect(html).toContain("知道了");
    const btn = NotifyAckButton({ id: notified.id, onAck }) as ReactElement<{ onClick: () => void }>;
    btn.props.onClick();
    await vi.waitFor(() => expect(spy).toHaveBeenCalledWith(notified.id));
    expect(onOk).toHaveBeenCalledOnce();
    expect(onErr).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
