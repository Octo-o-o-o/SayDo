// 三熔断(计划 4.2;04 §5.2 防无人值守烧钱):墙钟(活跃执行时间,审批/提问停靠期停表)+
// 回合数 + token/成本,任一触发 ⇒ cancel ⇒ 带上下文进 blocked 叫人。阈值与执行模式无关(来自决策包 cost 上限)。
// "15 分钟无事件"抓挂死,抓不住"活跃兜圈烧钱",故三者缺一不可(04 §5.2 诚实注记)。
// 纯状态机(时钟注入),无 IO;订阅调用 maxCost 只约束 api 计费部分(订阅靠墙钟+回合兜底,07 D18)。

export interface FuseLimits {
  walltimeActiveMin: number;
  maxTurns: number;
  maxCost: number; // 元(仅 api 计费部分;订阅调用不计,靠墙钟+回合兜底)
}

export type TripReason = "walltime" | "turns" | "cost";

export class CircuitBreakers {
  private readonly limits: FuseLimits;
  private readonly now: () => number;
  private activeMs = 0; // 累计活跃执行时间(停靠期不计)
  private runningSince: number | null = null; // 正在活跃计时的起点(null=停表中)
  private turns = 0;
  private apiCostYuan = 0;
  private tripped: TripReason | null = null;

  constructor(limits: FuseLimits, now: () => number = () => Date.now()) {
    this.limits = limits;
    this.now = now;
  }

  /** 开始/恢复活跃计时(running 态);已在计时则幂等 */
  resume(): void {
    if (this.runningSince === null) this.runningSince = this.now();
  }

  /** 停表(审批/提问停靠期):把已跑时长累加,停止计时 */
  pause(): void {
    if (this.runningSince !== null) {
      this.activeMs += this.now() - this.runningSince;
      this.runningSince = null;
    }
  }

  /** 当前累计活跃毫秒(含正在计时段) */
  activeMsNow(): number {
    return this.activeMs + (this.runningSince !== null ? this.now() - this.runningSince : 0);
  }

  recordTurn(): void {
    this.turns += 1;
  }

  /** 记 api 计费(元;订阅调用传 0——不进 maxCost) */
  recordApiCost(yuan: number): void {
    this.apiCostYuan += yuan;
  }

  /** 检查是否触发熔断(任一维超限;返回首个触发原因,幂等——已跳闸保留首因) */
  check(): TripReason | null {
    if (this.tripped) return this.tripped;
    if (this.activeMsNow() >= this.limits.walltimeActiveMin * 60_000) this.tripped = "walltime";
    else if (this.turns >= this.limits.maxTurns) this.tripped = "turns";
    else if (this.apiCostYuan >= this.limits.maxCost) this.tripped = "cost";
    return this.tripped;
  }

  snapshot(): { activeMin: number; turns: number; apiCostYuan: number; tripped: TripReason | null } {
    return {
      activeMin: Math.round((this.activeMsNow() / 60_000) * 100) / 100,
      turns: this.turns,
      apiCostYuan: this.apiCostYuan,
      tripped: this.check()
    };
  }
}

/** 停靠老化判定(默认 72h;到期 ⇒ 取消 + 包回落 draft,09 §6.1 park_expired) */
export function isParkExpired(parkedDeadline: string, nowIso: string): boolean {
  return nowIso >= parkedDeadline;
}

export function parkDeadlineFrom(parkedAtIso: string, agingHours = 72): string {
  return new Date(new Date(parkedAtIso).getTime() + agingHours * 3_600_000).toISOString();
}
