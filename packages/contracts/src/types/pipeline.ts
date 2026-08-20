// docs/09 §10 语音管线 WS 契约(A1 与 A2 之间)。
// Unheard 纪律:被打断句 watermark 后文本 heard=false,不进对话事实(10 §3)。

import { z } from "zod";
import { idSchema } from "../ids.js";
import { confirmResolvedOutcomeSchema } from "./mobile.js";
import { runtimeIdentitySchema } from "../runtime.js";

export const nativeReplyOriginSchema = z.enum([
  "assistant_reply",
  "system",
  "confirmation",
  "onboarding"
]);
export type NativeReplyOrigin = z.infer<typeof nativeReplyOriginSchema>;

export const pipelineMsgSchema = z.discriminatedUnion("t", [
  z.strictObject({ t: z.literal("audio.frame"), sessionId: idSchema, seq: z.number().int().nonnegative() }),
  z.strictObject({
    t: z.enum(["asr.partial", "asr.final"]),
    sessionId: idSchema,
    turnId: idSchema,
    text: z.string(),
    // confidence 可选:定档 sauc 大模型不回置信度(ADR-101 实测 2026-07-24),provider 有则透传
    confidence: z.number().min(0).max(1).optional()
  }),
  z.strictObject({
    t: z.literal("tts.say"),
    sessionId: idSchema,
    sentenceId: z.string().min(1),
    text: z.string(),
    interruptible: z.boolean()
  }),
  // M2-voice-a:壳内 TTS 只消费经 daemon 口播闸与脱敏出口生成的定向文本事件。
  z.strictObject({
    t: z.literal("native.reply"),
    sessionId: idSchema,
    turnId: z.string().min(1),
    sentenceId: z.string().min(1),
    text: z.string(),
    origin: nativeReplyOriginSchema
  }),
  z.strictObject({
    t: z.literal("tts.playout"),
    sessionId: idSchema,
    sentenceId: z.string().min(1),
    watermarkMs: z.number().nonnegative()
  }),
  z.strictObject({
    t: z.literal("barge_in"),
    sessionId: idSchema,
    atMs: z.number().nonnegative(),
    truncatedSentenceId: z.string().min(1)
  }),
  // holdForConfirm(RA-closeout dogfood 修复 2026-07-28;10 §3-7"采完不直发"):手动档停录发本标记——
  // pipeline 照常 finalize 产 asr.final(标点/热词全),daemon 消费一次性 hold 挡该轮进 Brain,
  // 转写经 hub 广播回 console 填充待确认框;确认发送走 turn.text(typed)。additive 可选字段。
  z.strictObject({ t: z.literal("turn.done_speaking"), sessionId: idSchema, holdForConfirm: z.literal(true).optional() }),
  z.strictObject({ t: z.literal("turn.listen_again"), sessionId: idSchema }),
  // W4 3.9(10 #7/#8/#9;11 §5.10):console 编辑后文本轮——采完不直发,用户改字确认再发(纠 ASR 误听正道)。
  // typed 标 provenance(键入/编辑,非原始听音);console 可发(受信终端 G1),不放宽 asr.final(B8 仍 pipeline 专属)。
  z.strictObject({ t: z.literal("turn.text"), sessionId: idSchema, turnId: idSchema, text: z.string().min(1), typed: z.literal(true) }),
  // W2 阶段 D(05 §4 提前批 #6;10 §3-1 轮次三层):免手档 additive 扩展(09 §10 回写随批末轻量评审)——
  // voice.mode:console -> pipeline,轮次采集模式切换(ptt=按住说 / hands_free=VAD 起停);
  // vad.speech:pipeline -> console,免手档语音活动边界(start 供播放侧触发 barge-in watermark 截断,
  //   end 纯观测)——console 持有播放水位,截断语义仍由既有 barge_in 消息承载(unheard 纪律不变)
  z.strictObject({ t: z.literal("voice.mode"), sessionId: idSchema, mode: z.enum(["ptt", "hands_free"]) }),
  z.strictObject({ t: z.literal("vad.speech"), sessionId: idSchema, phase: z.enum(["start", "end"]) }),
  // F25(2026-08-04)+批 1 v0.3.3:确认卡 UI 事件;digest 三元绑定(合同 §6)
  z.strictObject({
    t: z.literal("confirm.card"),
    sessionId: idSchema,
    receiptId: z.string().min(1),
    text: z.string(),
    kind: z.string(),
    digest: z.string().min(1),
    digestVersion: z.number().int().positive()
  }),
  z.strictObject({
    t: z.literal("confirm.countdown"),
    sessionId: idSchema,
    receiptId: z.string().min(1),
    ms: z.number().positive()
  }),
  z.strictObject({
    t: z.literal("confirm.resolved"),
    sessionId: idSchema,
    receiptId: z.string().min(1),
    outcome: confirmResolvedOutcomeSchema
  }),
  // 批 4:会话内「这次聊出来的东西」实体卡(办成事才长卡;只下行 console)
  z.strictObject({
    t: z.literal("focus.entity"),
    sessionId: idSchema,
    entity: z.strictObject({
      id: z.string().min(1),
      kind: z.string().min(1),
      title: z.string(),
      sub: z.string(),
      color: z.string().min(1),
      at: z.string().min(1)
    })
  }),
  // 批 1:console 点击专用上行(退役 F25 sendText 词表复用)
  z.strictObject({
    t: z.literal("confirm.click"),
    sessionId: idSchema,
    receiptId: z.string().min(1),
    digest: z.string().min(1),
    decision: z.enum(["accept", "reject"])
  }),
  // M1 移动卡裁决:卡原 session+receipt 显式定向;withdraw 是撤下而非 reject。
  z.strictObject({
    t: z.literal("confirm.decision"),
    sessionId: idSchema,
    receiptId: z.string().min(1),
    decision: z.enum(["accept", "reject", "withdraw"])
  }),
  z.strictObject({
    t: z.literal("session.project"),
    sessionId: idSchema,
    projectId: idSchema,
    projectRevision: z.number().int().nonnegative(),
    reason: z.enum(["draft_created", "workspace_adopted", "draft_reanchored", "migration_snapshot"])
  }),
  // M3/A-1(2026-07-25):五段延迟时间戳(03 §3 SLO 分段实测;atMs=单调时钟毫秒,同一进程内可减)
  z.strictObject({
    t: z.literal("latency.stage"),
    sessionId: idSchema,
    turnId: idSchema,
    stage: z.enum(["vad_end", "asr_final", "llm_first_token", "tts_first_byte", "playout_start"]),
    atMs: z.number().nonnegative()
  }),
  // 接线批(2026-07-25;HANDOFF §2-9-③):热词偏置词表下发(daemon -> pipeline 单向;
  // 词源 P0 = M0 热词(term∪canonical)——奠基 seedTerms 经 biasTerms(extraSeeds) 预留、生产接线
  // 挂账 dogfood 期(一致性评审 B-1 如实口径);消费点 = sauc recognize corpus.context;
  // 09 §10 词表已回写(canonical),仅 daemon 可发(peer 直发被 hub 角色白名单丢弃)
  z.strictObject({
    t: z.literal("asr.hotwords"),
    words: z.array(z.string().min(1)).max(1000)
  }),
  z.strictObject({
    t: z.literal("pipeline.health"),
    asr: z.enum(["ok", "degraded", "down"]),
    tts: z.enum(["ok", "degraded", "down"]),
    identity: runtimeIdentitySchema,
    stateRootDigest: z.string().regex(/^[0-9a-f]{64}$/),
    /** first-run onboarding self-restart 世代号(pipeline 重连上报;缺省=未参与协调) */
    generation: z.number().int().nonnegative().optional()
  }),
  // first-run onboarding v4:daemon→pipeline 协调重启;pipeline 回 ACK 后 self-exec 重读 .env
  z.strictObject({
    t: z.literal("pipeline.restart_pending"),
    generation: z.number().int().nonnegative()
  }),
  z.strictObject({
    t: z.literal("pipeline.restart_ack"),
    generation: z.number().int().nonnegative()
  }),
  // Focus v0.4 ④e:双文本分离——modelText 全文仅投 via=local 的 console peer(不脱敏);
  // tailnet 只收既有脱敏 tts.say 句。console 同 turnId 到达后替换该轮逐句气泡。
  z.strictObject({
    t: z.literal("screen_text"),
    sessionId: idSchema,
    turnId: idSchema,
    text: z.string()
  }),
  // Focus v0.4 ④e A6:console 应用层心跳(30s);daemon 90s 无心跳视同断开,取消 idle 收场。
  z.strictObject({
    t: z.literal("console.heartbeat"),
    sessionId: idSchema,
    atMs: z.number().nonnegative()
  })
]);
export type PipelineMsg = z.infer<typeof pipelineMsgSchema>;
