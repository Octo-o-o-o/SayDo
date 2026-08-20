// drop 前 lint 预检(P0.5-B;附录 §1.6/09 §6.2):hopper lint <file> --json 后判定。
// 关键:missing_acceptance 只是 warning 不进退出码——必须同时查三处,任一命中 => 不 drop 回对话补料。

import { z } from "zod";

export const lintOutputSchema = z.looseObject({
  blocking: z.array(z.unknown()).optional(),
  result: z
    .looseObject({
      classification: z.string().optional(),
      execution_decision: z.string().optional(),
      risk: z.string().optional()
    })
    .optional()
});

export type LintVerdict = { ok: true; risk?: string | undefined } | { ok: false; reason: string; risk?: string | undefined };

const NOT_READY = new Set(["blocked", "conflict", "draft", "plan_needed", "research", "deferred"]);

export function judgeLint(rawJson: string): LintVerdict {
  let out: z.infer<typeof lintOutputSchema>;
  try {
    out = lintOutputSchema.parse(JSON.parse(rawJson));
  } catch (err) {
    return { ok: false, reason: `lint 输出不可解析(fail-closed): ${String(err).slice(0, 120)}` };
  }
  const risk = out.result?.risk;
  if ((out.blocking ?? []).length > 0) return { ok: false, reason: "lint blocking 非空", risk };
  const cls = out.result?.classification;
  if (cls && NOT_READY.has(cls)) return { ok: false, reason: `classification=${cls}(非 ready 即不派)`, risk };
  if (out.result?.execution_decision === "needs_human") return { ok: false, reason: "execution_decision=needs_human", risk };
  return { ok: true, risk };
}
