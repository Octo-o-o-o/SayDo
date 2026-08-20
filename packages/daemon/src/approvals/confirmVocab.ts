// 审批确认封闭肯定词表(计划 M6④/④-G2;10 §2.5)。审批级 utterance P0 防线:
// 定档 sauc 不回 confidence,S2 放行依赖语音确认——ASR 幻觉可凭空产肯定词。
// 状态机侧(3.4/4.2)消费此单源词表:复述关键参数 + 封闭词表匹配才 accept,未匹配默认拒绝并复读。

/** 封闭肯定词表(锁定档,逐字;10 §2.5) */
export const CONFIRM_YES = ["好", "好的", "可以", "行", "批准", "同意", "确认", "通过", "去吧", "可以的"] as const;
export const CONFIRM_NO = ["不", "不行", "不要", "别", "取消", "算了", "停"] as const;

export type ConfirmMatch = "accept" | "reject" | "unmatched";

function norm(s: string): string {
  // 显式转义全角标点(impl-readback 回收批 2,B1):旧字符类的"!!"是两个 ASCII 感叹号
  // (hexdump 21 21)——与 Codex 16 A2 修掉的"两个 ASCII ?"同种字节病;全角 \uFF01 不在表内
  // 导致 sauc 回全角标点时"可以!"被系统性误拒(fail-safe 方向但词表环可用性受损)。
  return s.replace(/[\s，。,.、!\uFF01?\uFF1F]/g, "");
}

// 封闭文法(2026-07-25 综合评审 A1 回修——旧"子串+邻接防护"存在误放行路径:
// "确认不了"/"同意不了"/"可以吗?"/"没必要说好" 均被旧逻辑判 accept):
//   accept 仅当整句 = (语气引导)*(肯定词)+(语气尾)*——肯定词后跟任何实义内容一律 unmatched。
const FILLER = "(?:嗯|啊|哦|呃|那|就)"; // norm 已剥标点/空白
const YES_ALT = "(?:好的|可以的|去吧|批准|同意|确认|通过|可以|行|好)"; // 长词优先
const TAIL = "(?:吧|呀|啊|的|了|嘞|哈)";
const YES_CLOSED_RE = new RegExp(`^${FILLER}*${YES_ALT}+${TAIL}*$`);

/**
 * 匹配用户答复(fail-safe;A1 回修后的封闭文法):
 * - 疑问句护栏:以 吗/呢/?/? 收尾 ⇒ unmatched(反问不是批准);
 * - 否定优先:否定词任意位置子串命中即 reject(含单字"不"——"确认不了/不错"都 reject,
 *   误拒可接受方向;"行"⊂"不行"重叠由否定优先消解);
 * - 肯定 = 封闭文法整句匹配(语气词 + 肯定词 + 语气尾,别无其他)——
 *   "好几个问题要先问你"/"没必要说好"等携带实义内容的话一律 unmatched;
 * - 都不命中 ⇒ unmatched(默认拒绝并复读,连续两次转屏)。
 * 方向纪律:误拒(false-reject)可接受——用户重说一次;误放(false-accept)不可接受。
 */
export function matchConfirmation(reply: string): ConfirmMatch {
  const trimmed = reply.trim();
  if (trimmed === "") return "unmatched";
  // 疑问句护栏:显式转义全角问号 \uFF1F(Codex 16 A2 回修:旧字符类肉眼像"?/?"实为两个 ASCII ?,
  // 全角问号被 norm 剥掉后"可以?"整句命中肯定词表 => 误放行;sauc 实测回全角标点,ADR-101)
  if (/[?\uFF1F]\s*$|[吗呢]\s*$/.test(trimmed)) return "unmatched";
  const n = norm(reply);
  if (n === "") return "unmatched";
  if (CONFIRM_NO.some((w) => n.includes(w))) return "reject"; // 否定优先(含"不"子串,fail-safe)
  if (YES_CLOSED_RE.test(n)) return "accept";
  return "unmatched";
}

/** 复述关键参数确认文法(10 §2.5:任务+效果+目标来自 E2 spokenForm) */
export function buildConfirmPrompt(spokenForm: string): string {
  return `${spokenForm}——对吗?说"好"或"可以"我就去;不做就说"不要"。`;
}

/**
 * 单次确认裁决(4.2 消费):首答 unmatched ⇒ 复读(retry);第二次 unmatched ⇒ 转屏。
 * 返回下一步动作。
 */
export function decideConfirmation(reply: string, attempt: number): {
  action: "accept" | "reject" | "reread" | "to_screen";
} {
  const m = matchConfirmation(reply);
  if (m === "accept") return { action: "accept" };
  if (m === "reject") return { action: "reject" };
  // unmatched:第一次复读,第二次转屏(不无限复读)
  return { action: attempt >= 2 ? "to_screen" : "reread" };
}
