// 电源断言(计划 4.3;modules/c C7 ③):长任务防睡眠中断(macOS caffeinate)。
// spawn 注入化(测试用 fake);无 caffeinate 环境降级为 no-op + 审计(不阻塞执行,如实记录)。

import { spawn, type ChildProcess } from "node:child_process";

export interface PowerSpawner {
  /** 启动一个防睡眠进程,返回 kill 句柄;不可用返回 null */
  start(): { kill: () => void } | null;
}

/** macOS caffeinate -i(阻止 idle sleep);其它平台返回 null(no-op) */
export function realPowerSpawner(): PowerSpawner {
  return {
    start() {
      if (process.platform !== "darwin") return null;
      let child: ChildProcess;
      try {
        child = spawn("caffeinate", ["-i"], { stdio: "ignore" });
      } catch {
        return null;
      }
      return { kill: () => child.kill() };
    }
  };
}

/** 电源断言持有器:有活跃 Tier1 任务时 assert,清零时 release(引用计数) */
export class PowerAssertion {
  private readonly spawner: PowerSpawner;
  private handle: { kill: () => void } | null = null;
  private refs = 0;

  constructor(spawner: PowerSpawner) {
    this.spawner = spawner;
  }

  acquire(): void {
    this.refs += 1;
    if (this.refs === 1 && this.handle === null) this.handle = this.spawner.start();
  }

  release(): void {
    if (this.refs === 0) return;
    this.refs -= 1;
    if (this.refs === 0 && this.handle) {
      this.handle.kill();
      this.handle = null;
    }
  }

  get active(): boolean {
    return this.refs > 0;
  }
}
