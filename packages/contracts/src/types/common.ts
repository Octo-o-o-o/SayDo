// docs/09 §0 通用类型:Id/Digest/Ts/Money。

import { z } from "zod";

export const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/u, "invalid digest");
export type Digest = z.infer<typeof digestSchema>;

/** ISO-8601 带时区(09 §0:Ts) */
export const tsSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u, "Ts must be ISO-8601 with timezone");
export type Ts = z.infer<typeof tsSchema>;

/** Money(09 §0):unknown 永不显示为 0;订阅第三态见 cost_entries.source */
export const moneySchema = z
  .strictObject({
    known: z.boolean(),
    value: z.number().nonnegative().optional(),
    currency: z.enum(["CNY", "USD"]).optional(),
    asOf: tsSchema.optional()
  })
  .refine((m) => !m.known || (m.value !== undefined && m.currency !== undefined), {
    message: "known money requires value and currency"
  });
export type Money = z.infer<typeof moneySchema>;
