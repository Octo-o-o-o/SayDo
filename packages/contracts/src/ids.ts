// Id 体系(docs/09 §0):ULID + 实体前缀。
// 前缀词表:prj_/ses_/pkg_/tsk_/apr_/mem_/ntf_(outbox)/art_/dsp_(dispatch)/cmd_(出站命令)/aud_(审计)
// + cred_(WebauthnCredential)/s3c_(S3Challenge)——09 §3.3(W4);前缀形状随之放宽为 3-4 位小写字母数字。

import { ulid } from "ulid";
import { z } from "zod";

export const ID_PREFIXES = {
  project: "prj",
  session: "ses",
  package: "pkg",
  task: "tsk",
  approval: "apr",
  memory: "mem",
  outbox: "ntf",
  artifact: "art",
  dispatch: "dsp",
  command: "cmd",
  audit: "aud",
  snapshot: "snp",
  tier1Run: "run",
  webauthnCredential: "cred",
  s3Challenge: "s3c",
  s3BootstrapIntent: "s3i",
  readinessBinding: "rbd",
  readinessReceipt: "rrc",
  /** SD-2:普通 M0 记忆提议确认收据(confirm 环 kind=memory) */
  memoryReceipt: "mrc",
  projectAnchor: "anc",
  event: "evt",
  // Focus Contract v0
  focus: "foc",
  focusEvent: "fev",
  focusObligation: "fob",
  focusActivation: "fac",
  focusCloseSettlement: "fcs",
  actionExecutionBinding: "aeb",
  focusShadowProjection: "fsp",
  focusCompareRecord: "fcr",
  /** Focus 线(lane);合同 §3.1 lan_ 前缀 ULID */
  focusLane: "lan",
  /** Focus v0.4 ④d Expectation aggregate 行 */
  focusExpectation: "fex"
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${ulid()}`;
}

/** 宽松 Id schema(任意实体);实体定型用 idOf。前缀 3-4 位、首位字母(cred_/s3c_ 属 09 §3.3 词表) */
export const idSchema = z.string().regex(/^[a-z][a-z0-9]{2,3}_[0-9A-HJKMNP-TV-Z]{26}$/u, "invalid id");

export function idOf(prefix: IdPrefix) {
  return z.string().regex(new RegExp(`^${prefix}_[0-9A-HJKMNP-TV-Z]{26}$`, "u"), `expected ${prefix}_ id`);
}
