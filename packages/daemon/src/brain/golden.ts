// 真实输出的状态词与连续应答检查。
import { FORBIDDEN_STATUS_WORDS } from "./instructions.js";

/** 状态词纪律检查(执行状态语境下禁"做完/完成") */
export function checkStatusWords(text: string): { ok: boolean; hit: string[] } {
  const hit = FORBIDDEN_STATUS_WORDS.filter((w) => text.includes(w));
  return { ok: hit.length === 0, hit };
}

/** M6③ 变体三档·自由池纪律:禁连续两轮同词开头 */
export function checkNoRepeatedOpeners(turns: string[]): { ok: boolean; violation?: string } {
  for (let i = 1; i < turns.length; i++) {
    const prev = (turns[i - 1] ?? "").trim().slice(0, 1);
    const cur = (turns[i] ?? "").trim().slice(0, 1);
    if (prev !== "" && prev === cur) {
      return { ok: false, violation: `连续两轮同词开头: "${prev}" (turn ${i - 1}/${i})` };
    }
  }
  return { ok: true };
}
