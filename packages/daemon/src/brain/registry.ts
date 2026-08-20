// 工具注册表(接线批任务③;09 §13 工具契约的 function-call 装配面)。
// Brain 只发起、daemon 执行,返回即 Brain 全部世界观(03 §1);错误统一 {ok:false,code,message,retryable}
// 直接作为工具结果回给模型(不抛异常中断对话环)。参数解析 fail-closed:JSON 坏/未知工具名一律错误对象。

import type { ToolSpec } from "../providers/types.js";

export interface ToolContext {
  sessionId: string;
  /** 当前用户轮(voice 收据 turnRef 绑定等 daemon 侧自取,不信 Brain 报) */
  turnId: string;
  /** 异步 handler 每次 await 后、任何写入前调用；旧轮或挂起轮会抛错并由 registry 折叠。 */
  assertCurrent?: () => void;
  /** 当前轮生命周期；传给可能启动 CLI 的工具 handler。 */
  signal?: AbortSignal;
}

export type ToolHandler = (args: unknown, ctx: ToolContext) => Promise<unknown> | unknown;

export class ToolRegistry {
  private readonly tools = new Map<string, { spec: ToolSpec; handler: ToolHandler }>();

  register(spec: ToolSpec, handler: ToolHandler): void {
    if (this.tools.has(spec.name)) throw new Error(`tool already registered: ${spec.name}`);
    this.tools.set(spec.name, { spec, handler });
  }

  specs(): ToolSpec[] {
    return [...this.tools.values()].map((t) => t.spec);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** 执行一次工具调用;一切失败都折叠为 §13 错误对象(模型可读,不断环) */
  async dispatch(name: string, argsRaw: string, ctx: ToolContext): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, code: "unknown_tool", message: `no such tool: ${name}`, retryable: false };
    let args: unknown;
    try {
      args = argsRaw.trim() === "" ? {} : JSON.parse(argsRaw);
    } catch {
      return { ok: false, code: "invalid_arguments", message: "tool arguments is not valid json", retryable: false };
    }
    try {
      ctx.assertCurrent?.();
      return await tool.handler(args, ctx);
    } catch (err) {
      const message = String(err instanceof Error ? err.message : err).slice(0, 300);
      return { ok: false, code: "tool_failed", message, retryable: false };
    }
  }
}
