import { daemonWsUrl } from "../lib/api";
import { VOICE_WS_PROTOCOL_VERSION } from "../voice/useVoiceChannel";
import {
  confirmResolvedOutcomeSchema,
  type MobileConfirmSuccessOutcome,
  type PipelineMsg
} from "@saydo/contracts";

export type MobileConfirmDecision = Extract<PipelineMsg, { t: "confirm.decision" }>["decision"];
export type MobileConfirmOutcome = MobileConfirmSuccessOutcome;

const EXPECTED_OUTCOME: Record<MobileConfirmDecision, MobileConfirmOutcome> = {
  accept: "accepted",
  reject: "rejected",
  withdraw: "withdrawn"
};

export class MobileConfirmOutcomeError extends Error {
  constructor(readonly outcome: string) {
    super(
      outcome === "expired"
        ? "这张卡已过期搁置，本次裁决未执行"
        : outcome === "untrusted_source"
          ? "这张执行审批只能回到受信桌面处理"
        : "这张卡的状态已变化，本次裁决未执行"
    );
    this.name = "MobileConfirmOutcomeError";
  }

  get keepsWithdrawAvailable(): boolean {
    return this.outcome === "untrusted_source";
  }
}

export function expectedConfirmOutcome(decision: MobileConfirmDecision): MobileConfirmOutcome {
  return EXPECTED_OUTCOME[decision];
}

export function sendMobileConfirmDecision(
  input: { sessionId: string; receiptId: string; decision: MobileConfirmDecision },
  timeoutMs = 5_000
): Promise<MobileConfirmOutcome> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(daemonWsUrl());
    let sent = false;
    let settled = false;
    const finish = (error?: Error, outcome?: MobileConfirmOutcome) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      ws.close();
      if (error) reject(error);
      else resolve(outcome ?? expectedConfirmOutcome(input.decision));
    };
    const timer = window.setTimeout(() => finish(new Error("裁决回执超时,卡状态可能已变化")), timeoutMs);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ v: VOICE_WS_PROTOCOL_VERSION, role: "console" }));
    });
    ws.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      const message = JSON.parse(event.data) as Record<string, unknown>;
      if (message["t"] === "hello.ack" && !sent) {
        sent = true;
        ws.send(JSON.stringify({ t: "confirm.decision", ...input }));
        return;
      }
      if (
        message["t"] === "confirm.resolved" &&
        message["sessionId"] === input.sessionId &&
        message["receiptId"] === input.receiptId
      ) {
        const parsedOutcome = confirmResolvedOutcomeSchema.safeParse(message["outcome"]);
        if (!parsedOutcome.success) {
          finish(new MobileConfirmOutcomeError("unknown"));
          return;
        }
        const outcome = parsedOutcome.data;
        const expected = expectedConfirmOutcome(input.decision);
        if (outcome === expected) finish(undefined, expected);
        else finish(new MobileConfirmOutcomeError(outcome));
      }
    });
    ws.addEventListener("error", () => finish(new Error("确认通道连接失败")));
    ws.addEventListener("close", () => {
      if (!settled) finish(new Error("确认通道已断开"));
    });
  });
}
