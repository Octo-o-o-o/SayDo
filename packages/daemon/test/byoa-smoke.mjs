// T18b 真实 Codex 冒烟(非 CI;手动):cheap schema + dialog_cli_oneshot remember envelope。
// 运行:node --import tsx test/byoa-smoke.mjs
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative } from "node:path";
import { DRAFT_JSON_SCHEMA, draftPackageSchema } from "../src/brain/liveTools.ts";
import {
  dialogCliOneshotJsonSchema,
  parseDialogCliOneshotEnvelope
} from "../src/brain/dialogLoop.ts";
import { probeCliCapability } from "../src/config/cliCapability.ts";
import { familyFromModelName } from "../src/config/family.ts";
import { createByoaProvider } from "../src/providers/byoa/provider.ts";

const auditLog = [];
let auditSeq = 0;
const audit = { record: (event) => (auditLog.push(event), { id: `aud_smoke${++auditSeq}` }) };
const capability = await probeCliCapability("codex");

if (!capability.found || capability.auth.status !== "logged_in" || !capability.path || !capability.binaryDigest) {
  console.error(
    JSON.stringify({
      ok: false,
      code: "codex_unavailable",
      found: capability.found,
      auth: capability.auth.status,
      binaryIdentity: Boolean(capability.path && capability.binaryDigest)
    })
  );
  process.exitCode = 1;
} else {
  const provider = createByoaProvider({
    provider: "codex_cli",
    model: "gpt-5.6-luna",
    reasoning: "low",
    expectedFamily: "gpt",
    profile: "default",
    familyOf: familyFromModelName,
    audit,
    binaryPath: capability.path,
    binaryIdentity: { path: capability.path, digest: capability.binaryDigest },
    wallTimeoutMs: 180_000
  });
  const startedAt = Date.now();
  const result = await provider.chat({
    messages: [
      { role: "system", content: "按给定 schema 起草最小决策包,只输出 JSON。" },
      { role: "user", content: "做一次 setup 自检" }
    ],
    jsonSchema: DRAFT_JSON_SCHEMA,
    temperature: 0,
    maxTokens: 256
  });
  const invocation = auditLog.findLast((event) => event.action === "byoa.invocation");
  const cageCwd = typeof invocation?.meta?.cwd === "string" ? invocation.meta.cwd : "";
  let schemaValid = false;
  if (result.ok) {
    try {
      draftPackageSchema.parse(JSON.parse(result.text));
      schemaValid = true;
    } catch {
      schemaValid = false;
    }
  }
  const oneshotResult = await provider.chat({
    messages: [
      {
        role: "system",
        content:
          '只输出 version=1 的 JSON envelope。用户明确说“记一下”时必须生成一个 remember action,arguments 固定含 tier="M1",trust="user_stated",claim=用户原话中的事实;reply 简短确认。'
      },
      { role: "user", content: "帮我记一下买了乐高" }
    ],
    jsonSchema: dialogCliOneshotJsonSchema([
      {
        name: "remember",
        description: "记住用户亲述事实",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["tier", "claim", "trust"],
          properties: {
            tier: { type: "string", enum: ["M0", "M1", "M2", "M3"] },
            claim: { type: "string" },
            trust: { type: "string", enum: ["user_stated", "user_approved"] },
            projectId: { type: "string" }
          }
        }
      }
    ]),
    temperature: 0,
    maxTokens: 256
  });
  const oneshotEnvelope = oneshotResult.ok ? parseDialogCliOneshotEnvelope(oneshotResult.text) : null;
  const rememberAction = oneshotEnvelope?.actions.find((action) => action.tool === "remember");
  const oneshotInvocation = auditLog.findLast((event) => event.action === "byoa.invocation");
  const evidence = {
    ok: result.ok && schemaValid && oneshotResult.ok && Boolean(oneshotEnvelope && rememberAction),
    resultOk: result.ok,
    ...(result.ok ? {} : { code: result.code }),
    schemaValid,
    elapsedMs: Date.now() - startedAt,
    toolCallCount: invocation?.meta?.toolCallCount,
    voided: invocation?.meta?.voided,
    voidReason: invocation?.meta?.voidReason,
    cwdEmptyAtSpawn: invocation?.meta?.cageCwdEmptyAtSpawn,
    cwdUnderTmp: cageCwd !== "" && !relative(tmpdir(), cageCwd).startsWith(".."),
    cwdCleaned: cageCwd !== "" && !existsSync(cageCwd),
    observedModelSource: result.ok ? result.observedModelSource : undefined,
    oneshotResultOk: oneshotResult.ok,
    ...(oneshotResult.ok ? {} : { oneshotCode: oneshotResult.code }),
    oneshotUnknownEventShapes: oneshotInvocation?.meta?.unknownEventShapes,
    oneshotEnvelope,
    rememberActionPresent: Boolean(rememberAction)
  };
  console.log(JSON.stringify(evidence, null, 2));
  if (!evidence.ok) process.exitCode = 1;
}
