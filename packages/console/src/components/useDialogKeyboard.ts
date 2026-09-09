// 弹窗键盘合同(11 §9 A11Y-01):Escape 关闭 / 焦点进入 / Tab 环内循环 / 关闭后焦点回触发控件。
// Escape 形态沿用 PairingOverlay(capture + stopImmediatePropagation);纯控制器与 hook 分离便于无 DOM 单测。

import { useEffect, useRef, type RefObject } from "react";

export const DIALOG_FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface DialogKeyLike {
  key: string;
  shiftKey: boolean;
}

export type DialogKeyAction<T> = { type: "close" } | { type: "focus"; target: T } | { type: "hold" } | null;

/** 纯判定:给定按键、弹窗内可聚焦序列与当前焦点,决定接管动作;null=交给浏览器默认行为。 */
export function dialogKeydownAction<T>(ev: DialogKeyLike, focusables: readonly T[], active: T | null): DialogKeyAction<T> {
  if (ev.key === "Escape") return { type: "close" };
  if (ev.key !== "Tab") return null;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (first === undefined || last === undefined) return { type: "hold" };
  const idx = active === null ? -1 : focusables.indexOf(active);
  if (ev.shiftKey) {
    if (idx <= 0) return { type: "focus", target: last };
    return null;
  }
  if (idx === -1 || idx === focusables.length - 1) return { type: "focus", target: first };
  return null;
}

export interface DialogFocusable {
  focus(): void;
  isConnected?: boolean;
}

export interface DialogKeyboardHost<T extends DialogFocusable> {
  doc: EventTarget & { activeElement: T | null };
  container: T;
  getFocusables(): readonly T[];
  onClose?: (() => void) | undefined;
}

/** 安装键盘合同;返回卸载函数(卸载时把焦点还给打开弹窗时的触发控件)。 */
export function installDialogKeyboard<T extends DialogFocusable>(host: DialogKeyboardHost<T>): () => void {
  const trigger = host.doc.activeElement;
  const initial = host.getFocusables()[0] ?? host.container;
  initial.focus();

  const onKey = (raw: Event) => {
    const ev = raw as Event & Partial<DialogKeyLike>;
    if (typeof ev.key !== "string") return;
    const action = dialogKeydownAction({ key: ev.key, shiftKey: ev.shiftKey === true }, host.getFocusables(), host.doc.activeElement);
    if (action === null) return;
    if (action.type === "close") {
      if (!host.onClose) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      host.onClose();
      return;
    }
    ev.preventDefault();
    if (action.type === "focus") action.target.focus();
  };
  host.doc.addEventListener("keydown", onKey, { capture: true });

  return () => {
    host.doc.removeEventListener("keydown", onKey, { capture: true });
    if (trigger && trigger.isConnected !== false) trigger.focus();
  };
}

/** React 包装:ref 指向弹窗面板;active=false(inline 预览)时不安装。onClose 走 ref,避免每次渲染重装。 */
export function useDialogKeyboard(
  ref: RefObject<HTMLElement | null>,
  options: { onClose?: (() => void) | undefined; active?: boolean }
): void {
  const onCloseRef = useRef(options.onClose);
  onCloseRef.current = options.onClose;
  const hasClose = options.onClose !== undefined;
  const active = options.active ?? true;

  useEffect(() => {
    const container = ref.current;
    if (!active || !container) return;
    return installDialogKeyboard<HTMLElement>({
      // document.activeElement 静态类型是 Element|null;弹窗内可聚焦项都是 HTMLElement,按此面消费
      doc: document as unknown as DialogKeyboardHost<HTMLElement>["doc"],
      container,
      getFocusables: () => Array.from(container.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR)),
      onClose: hasClose ? () => onCloseRef.current?.() : undefined
    });
  }, [ref, active, hasClose]);
}
