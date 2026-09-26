import { z } from "zod";
import { CLIENT_NAME, CLIENT_VERSION } from "./provenance.js";

export const requestIdSchema = z.union([
  z.string().min(1),
  z.number().int().refine((value) => Number.isSafeInteger(value), "unsafe integer id")
]);

export type RequestId = z.infer<typeof requestIdSchema>;

export const turnStatusSchema = z.enum(["completed", "interrupted", "failed", "inProgress"]);
export type TurnStatus = z.infer<typeof turnStatusSchema>;

const nullableInt = z.number().int().nullable();

/** 入站 turn 只约束本原型要读的字段;可空字段按 schema 接受 null,多余字段保留。 */
export const turnSchema = z.looseObject({
  id: z.string().min(1),
  status: turnStatusSchema,
  items: z.array(z.unknown()),
  completedAt: nullableInt.optional(),
  durationMs: nullableInt.optional(),
  startedAt: nullableInt.optional(),
  error: z.unknown().nullable().optional()
});

export const threadCarrierSchema = z.looseObject({
  thread: z.looseObject({
    id: z.string().min(1),
    cliVersion: z.string().optional(),
    model: z.string().nullable().optional(),
    name: z.string().nullable().optional()
  })
});

export const initializeResultSchema = z.looseObject({
  userAgent: z.string(),
  codexHome: z.string().min(1),
  platformFamily: z.string().min(1),
  platformOs: z.string().min(1)
});

export const initializeParamsSchema = z.strictObject({
  clientInfo: z.strictObject({
    name: z.string().min(1),
    version: z.string().min(1)
  }),
  capabilities: z.strictObject({
    experimentalApi: z.boolean()
  })
});

const textInputSchema = z.strictObject({
  type: z.literal("text"),
  text: z.string()
});

export const threadStartParamsSchema = z.strictObject({
  approvalPolicy: z.literal("on-request"),
  approvalsReviewer: z.literal("user"),
  ephemeral: z.literal(true),
  sandbox: z.literal("read-only"),
  model: z.string().min(1).optional(),
  cwd: z.string().min(1).optional()
});

export const threadResumeParamsSchema = z.strictObject({
  threadId: z.string().min(1),
  approvalPolicy: z.literal("on-request"),
  approvalsReviewer: z.literal("user"),
  sandbox: z.literal("read-only"),
  excludeTurns: z.literal(true)
});

export const threadReadParamsSchema = z.strictObject({
  threadId: z.string().min(1),
  includeTurns: z.literal(false)
});

export const turnStartParamsSchema = z.strictObject({
  threadId: z.string().min(1),
  input: z.array(textInputSchema).length(1),
  model: z.string().min(1).optional()
});

export const turnSteerParamsSchema = z.strictObject({
  threadId: z.string().min(1),
  expectedTurnId: z.string().min(1),
  input: z.array(textInputSchema).length(1)
});

export const turnInterruptParamsSchema = z.strictObject({
  threadId: z.string().min(1),
  turnId: z.string().min(1)
});

/** TurnInterruptResponse.json 只有 type:object。null、数字、数组都不是 ACK。 */
export const turnInterruptResponseSchema = z.looseObject({});

export const commandDeclineSchema = z.strictObject({
  decision: z.literal("decline")
});

export const commandAcceptOnceSchema = z.strictObject({
  decision: z.literal("accept")
});

export const legacyDeniedSchema = z.strictObject({
  decision: z.strictObject({
    denied: z.strictObject({
      rejection: z.literal("denied")
    })
  })
});

export const emptyPermissionsSchema = z.strictObject({
  permissions: z.strictObject({})
});

export const emptyAnswersSchema = z.strictObject({
  answers: z.strictObject({})
});

export const commandApprovalParamsSchema = z.looseObject({
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  itemId: z.string().min(1),
  startedAtMs: z.number().int(),
  command: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  approvalId: z.string().nullable().optional(),
  cwd: z.string().nullable().optional()
});

export const fileApprovalParamsSchema = z.looseObject({
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  itemId: z.string().min(1),
  startedAtMs: z.number().int(),
  reason: z.string().nullable().optional(),
  grantRoot: z.string().nullable().optional()
});

export const permissionsParamsSchema = z.looseObject({
  cwd: z.string().min(1),
  itemId: z.string().min(1),
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  startedAtMs: z.number().int(),
  permissions: z.looseObject({
    fileSystem: z.unknown().nullable().optional(),
    network: z.unknown().nullable().optional()
  }),
  reason: z.string().nullable().optional()
});

export const userInputParamsSchema = z.looseObject({
  isBlocking: z.boolean(),
  itemId: z.string().min(1),
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  questions: z.array(z.unknown()),
  autoResolutionMs: nullableInt.optional()
});

export const legacyExecParamsSchema = z.looseObject({
  callId: z.string().min(1),
  command: z.array(z.string()),
  conversationId: z.string().min(1),
  cwd: z.string(),
  parsedCmd: z.array(z.unknown()),
  reason: z.string().nullable().optional(),
  approvalId: z.string().nullable().optional()
});

export const legacyPatchParamsSchema = z.looseObject({
  callId: z.string().min(1),
  conversationId: z.string().min(1),
  fileChanges: z.record(z.string(), z.unknown()),
  grantRoot: z.string().nullable().optional(),
  reason: z.string().nullable().optional()
});

export const turnNoticeSchema = z.looseObject({
  threadId: z.string().min(1),
  turn: turnSchema
});

const envelopeSchema = z.looseObject({
  id: requestIdSchema.optional(),
  method: z.string().min(1).optional(),
  params: z.unknown().optional(),
  result: z.unknown().optional(),
  error: z
    .looseObject({
      code: z.number().int(),
      message: z.string(),
      data: z.unknown().optional()
    })
    .optional()
});

export type InboundMessage =
  | { kind: "request"; id: RequestId; method: string; params: unknown }
  | { kind: "notification"; method: string; params: unknown }
  | { kind: "response"; id: RequestId; result: unknown }
  | { kind: "error"; id: RequestId; error: { code: number; message: string } }
  | { kind: "malformed"; code: "malformed_message" };

export function classifyMessage(value: unknown): InboundMessage {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { kind: "malformed", code: "malformed_message" };
  }
  const parsed = envelopeSchema.safeParse(value);
  if (!parsed.success) return { kind: "malformed", code: "malformed_message" };
  const hasResult = Object.prototype.hasOwnProperty.call(value, "result");
  const hasError = Object.prototype.hasOwnProperty.call(value, "error");
  const method = parsed.data.method;
  const id = parsed.data.id;
  if (method !== undefined && (hasResult || hasError)) {
    return { kind: "malformed", code: "malformed_message" };
  }
  if (hasResult && hasError) return { kind: "malformed", code: "malformed_message" };
  if (method !== undefined && id !== undefined) {
    return { kind: "request", id, method, params: parsed.data.params ?? null };
  }
  if (method !== undefined && id === undefined) {
    return { kind: "notification", method, params: parsed.data.params ?? null };
  }
  if (hasResult && id !== undefined) return { kind: "response", id, result: parsed.data.result };
  if (hasError && id !== undefined && parsed.data.error) {
    return {
      kind: "error",
      id,
      error: { code: parsed.data.error.code, message: parsed.data.error.message }
    };
  }
  return { kind: "malformed", code: "malformed_message" };
}

export function idKey(id: RequestId): string {
  return typeof id === "number" ? `n:${id}` : `s:${id}`;
}

export function buildInitializeParams(): z.infer<typeof initializeParamsSchema> {
  return initializeParamsSchema.parse({
    clientInfo: { name: CLIENT_NAME, version: CLIENT_VERSION },
    capabilities: { experimentalApi: false }
  });
}

export function buildInitializedNotification(): { method: "initialized" } {
  return { method: "initialized" };
}

export function buildThreadStartParams(input: { model?: string; cwd?: string }): z.infer<typeof threadStartParamsSchema> {
  const params: z.input<typeof threadStartParamsSchema> = {
    approvalPolicy: "on-request",
    approvalsReviewer: "user",
    ephemeral: true,
    sandbox: "read-only"
  };
  if (input.model !== undefined) params.model = input.model;
  if (input.cwd !== undefined) params.cwd = input.cwd;
  return threadStartParamsSchema.parse(params);
}

export function buildThreadReadParams(threadId: string): z.infer<typeof threadReadParamsSchema> {
  return threadReadParamsSchema.parse({ threadId, includeTurns: false });
}

export function buildThreadResumeParams(threadId: string): z.infer<typeof threadResumeParamsSchema> {
  return threadResumeParamsSchema.parse({
    threadId,
    approvalPolicy: "on-request",
    approvalsReviewer: "user",
    sandbox: "read-only",
    excludeTurns: true
  });
}

export function buildTurnStartParams(input: {
  threadId: string;
  text: string;
  model?: string;
}): z.infer<typeof turnStartParamsSchema> {
  const params: z.input<typeof turnStartParamsSchema> = {
    threadId: input.threadId,
    input: [{ type: "text", text: input.text }]
  };
  if (input.model !== undefined) params.model = input.model;
  return turnStartParamsSchema.parse(params);
}

export function buildTurnSteerParams(input: {
  threadId: string;
  expectedTurnId: string;
  text: string;
}): z.infer<typeof turnSteerParamsSchema> {
  return turnSteerParamsSchema.parse({
    threadId: input.threadId,
    expectedTurnId: input.expectedTurnId,
    input: [{ type: "text", text: input.text }]
  });
}

export function buildTurnInterruptParams(threadId: string, turnId: string): z.infer<typeof turnInterruptParamsSchema> {
  return turnInterruptParamsSchema.parse({ threadId, turnId });
}

export function declineDecision(): z.infer<typeof commandDeclineSchema> {
  return commandDeclineSchema.parse({ decision: "decline" });
}

export function acceptOnceDecision(): z.infer<typeof commandAcceptOnceSchema> {
  return commandAcceptOnceSchema.parse({ decision: "accept" });
}

export function legacyDeniedDecision(): z.infer<typeof legacyDeniedSchema> {
  return legacyDeniedSchema.parse({ decision: { denied: { rejection: "denied" } } });
}

export function emptyPermissionsResult(): z.infer<typeof emptyPermissionsSchema> {
  return emptyPermissionsSchema.parse({ permissions: {} });
}

export function emptyAnswersResult(): z.infer<typeof emptyAnswersSchema> {
  return emptyAnswersSchema.parse({ answers: {} });
}

/** 只取最前产品名/x.y.z。产品名可含空格。括号内 OS 版本和后缀 client 版本不返回。 */
export function userAgentVersions(userAgent: string): string[] {
  const match = /^(?:[^\s/()]+(?:\s+[^\s/()]+)*)\/(\d+\.\d+\.\d+)(?=\s|$)/.exec(userAgent.trim());
  const version = match?.[1];
  return version ? [version] : [];
}

export function redactText(text: string): string {
  return text
    .replace(/\/Users\/[^\s"]+/g, "<path>")
    .replace(/\/home\/[^\s"]+/g, "<path>")
    .replace(/[A-Za-z]:\\[^\s"]+/g, "<path>")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "<secret>")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/g, "Bearer <secret>");
}
