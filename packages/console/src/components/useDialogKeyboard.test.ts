// A11Y-01 弹窗键盘闭环(11 §9):Escape 关闭 / Tab 环内循环 / 初始焦点进入 / 关闭后焦点回触发控件。
// 仓内无 DOM 测试环境,用 EventTarget + 假元素驱动纯控制器(hook 只是薄包装)。

import { describe, expect, it, vi } from "vitest";
import { dialogKeydownAction, installDialogKeyboard } from "./useDialogKeyboard";

class FakeDoc extends EventTarget {
  activeElement: FakeEl | null = null;
}

class FakeEl {
  isConnected = true;
  constructor(
    readonly name: string,
    private readonly doc: FakeDoc
  ) {}
  focus(): void {
    this.doc.activeElement = this;
  }
}

function keydown(key: string, shiftKey = false) {
  const event = new Event("keydown", { cancelable: true });
  Object.assign(event, { key, shiftKey });
  const stop = vi.fn();
  Object.defineProperty(event, "stopImmediatePropagation", { value: stop });
  return { event, stop };
}

function setup(focusableCount = 2, withClose = true) {
  const onClose = withClose ? vi.fn() : undefined;
  const doc = new FakeDoc();
  const trigger = new FakeEl("trigger", doc);
  trigger.focus();
  const container = new FakeEl("container", doc);
  const focusables = Array.from({ length: focusableCount }, (_, i) => new FakeEl(`f${i}`, doc));
  const dispose = installDialogKeyboard({
    doc,
    container,
    getFocusables: () => focusables,
    onClose
  });
  return { doc, trigger, container, focusables, dispose, onClose };
}

describe("dialogKeydownAction", () => {
  const a = { id: "a" };
  const b = { id: "b" };
  const c = { id: "c" };

  it("Escape → close;其它键不接管", () => {
    expect(dialogKeydownAction({ key: "Escape", shiftKey: false }, [a, b], a)).toEqual({ type: "close" });
    expect(dialogKeydownAction({ key: "Enter", shiftKey: false }, [a, b], a)).toBeNull();
  });

  it("Tab 在末项回绕到首项,Shift+Tab 在首项回绕到末项,中间项交给浏览器", () => {
    expect(dialogKeydownAction({ key: "Tab", shiftKey: false }, [a, b, c], c)).toEqual({ type: "focus", target: a });
    expect(dialogKeydownAction({ key: "Tab", shiftKey: true }, [a, b, c], a)).toEqual({ type: "focus", target: c });
    expect(dialogKeydownAction({ key: "Tab", shiftKey: false }, [a, b, c], b)).toBeNull();
  });

  it("焦点已逃到弹窗外时 Tab 拉回首项,无可聚焦项时按住不动", () => {
    expect(dialogKeydownAction({ key: "Tab", shiftKey: false }, [a, b], null)).toEqual({ type: "focus", target: a });
    expect(dialogKeydownAction({ key: "Tab", shiftKey: true }, [a, b], null)).toEqual({ type: "focus", target: b });
    expect(dialogKeydownAction({ key: "Tab", shiftKey: false }, [], null)).toEqual({ type: "hold" });
  });
});

describe("installDialogKeyboard", () => {
  it("打开即把焦点移入首个可操作控件;无控件时落到容器", () => {
    const s = setup(2);
    expect(s.doc.activeElement).toBe(s.focusables[0]);
    s.dispose();
    const empty = setup(0);
    expect(empty.doc.activeElement).toBe(empty.container);
    empty.dispose();
  });

  it("Escape 关闭并阻止事件继续传播", () => {
    const s = setup(2);
    const { event, stop } = keydown("Escape");
    s.doc.dispatchEvent(event);
    expect(s.onClose).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    expect(stop).toHaveBeenCalledTimes(1);
    s.dispose();
  });

  it("Tab 不逃逸:末项 Tab 回首项,首项 Shift+Tab 回末项", () => {
    const s = setup(3);
    s.focusables[2]!.focus();
    const tab = keydown("Tab");
    s.doc.dispatchEvent(tab.event);
    expect(tab.event.defaultPrevented).toBe(true);
    expect(s.doc.activeElement).toBe(s.focusables[0]);
    const back = keydown("Tab", true);
    s.doc.dispatchEvent(back.event);
    expect(back.event.defaultPrevented).toBe(true);
    expect(s.doc.activeElement).toBe(s.focusables[2]);
    s.dispose();
  });

  it("关闭后焦点回到触发控件;触发控件已卸载则不动", () => {
    const s = setup(2);
    expect(s.doc.activeElement).not.toBe(s.trigger);
    s.dispose();
    expect(s.doc.activeElement).toBe(s.trigger);

    const t = setup(1);
    t.trigger.isConnected = false;
    t.dispose();
    expect(t.doc.activeElement).toBe(t.focusables[0]);
  });

  it("dispose 后不再响应键盘", () => {
    const s = setup(2);
    s.dispose();
    const { event } = keydown("Escape");
    s.doc.dispatchEvent(event);
    expect(s.onClose).not.toHaveBeenCalled();
  });

  it("没有 onClose 时 Escape 不接管(留给外层),Tab 仍环内循环", () => {
    const s = setup(2, false);
    const { event } = keydown("Escape");
    s.doc.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    s.focusables[1]!.focus();
    const tab = keydown("Tab");
    s.doc.dispatchEvent(tab.event);
    expect(s.doc.activeElement).toBe(s.focusables[0]);
    s.dispose();
  });
});
