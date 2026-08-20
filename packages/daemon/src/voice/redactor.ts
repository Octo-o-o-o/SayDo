// TTS 脱敏 redactor(安全红线,10 §1):敏感数据永不进 TTS。
// 共享序列化层——审批播报(#19/#39)与溯源(#37)共用同一实现(防某处漏脱敏)。
// 路径说"某个配置文件"、密钥说"一处凭据"、digest 不念 hash(10 #37)。
// 注:敏感形态标记(如私钥块的关键词)一律用字符串拼接构造正则,源码不出现完整凭据形态。

export type DataClass = "token" | "secret" | "customer" | "path" | "digest";

/** 显式标注段:调用方已知某片段是敏感类(客户数据无法靠正则识别,必须显式标) */
export interface RedactSpan {
  value: string;
  dataClass: DataClass;
}

const REPLACEMENTS: Record<DataClass, string> = {
  token: "一处凭据",
  secret: "一处凭据",
  customer: "一处客户数据",
  path: "某个文件",
  digest: "一个校验值"
};

// 私钥块关键词(拼接构造,避免源码出现完整词组)
const PK = "PRIV" + "ATE " + "KEY";
const PEM_RE = new RegExp("-----BEGIN [A-Z ]*" + PK + "-----[\\s\\S]*?-----END [A-Z ]*" + PK + "-----", "g");
// 云访问密钥前缀 + 16 位(拼接前缀,避免完整示例串)
const CLOUD_KEY_RE = new RegExp("\\b(?:A" + "KIA|A" + "SIA)[0-9A-Z]{16}\\b", "g");
const PATH_RE = /(?:~\/|\/(?:Users|home|var|tmp|etc|opt|private)\/|[A-Za-z]:\\)[^\s，。;；、"']*/g;

// 自动检测规则(顺序敏感:先长后短,先具体后泛化;评审 A1/A2/B2/B3 加固)
const AUTO_RULES: { re: RegExp; cls: DataClass; label?: (m: string) => string }[] = [
  { re: PEM_RE, cls: "secret" },
  { re: /\bsha256:[0-9a-f]{64}\b/gi, cls: "digest" },
  { re: /\bBearer\s+[A-Za-z0-9._-]{8,}/g, cls: "token" },
  { re: new RegExp("\\b(?:sk|gho|ghp|ghs|ghr|xoxb|xoxp)[-_][A-Za-z0-9]{16,}\\b", "g"), cls: "token" },
  { re: CLOUD_KEY_RE, cls: "token" },
  { re: /\benv:[A-Z][A-Z0-9_]*\b/g, cls: "secret" },
  {
    re: PATH_RE,
    cls: "path",
    label: (m) => (/\.(?:env|toml|json|ya?ml|conf|cfg|pem|key)\b/i.test(m) ? "某个配置文件" : "某个文件")
  },
  { re: /\.{1,2}\/[^\s，。;；、"']*\.(?:env|pem|key)\b/gi, cls: "path", label: () => "某个配置文件" },
  // 纯数字长串:手机号(11)/银行卡号(12-19)——客户数据可正则识别的兜底(A2;金额/时长/端口/年份 <11 位不吞)
  { re: /\b\d{11,19}\b/g, cls: "customer" },
  // 裸长密钥串(≥20 位,无空格;短 key 也覆盖)——放最后,避免误吞正常词
  { re: /\b[A-Za-z0-9+/_-]{20,}={0,2}\b/g, cls: "secret" }
];

export interface RedactResult {
  text: string;
  redactions: { cls: DataClass; count: number }[];
}

/**
 * 脱敏一段将进 TTS 的文本。
 * @param spans 显式标注的敏感片段(如客户数据)——优先按此替换,再跑自动规则。
 */
export function redactForSpeech(input: string, spans: RedactSpan[] = []): RedactResult {
  let text = input;
  const counts = new Map<DataClass, number>();
  const bump = (cls: DataClass, n = 1) => counts.set(cls, (counts.get(cls) ?? 0) + n);

  for (const span of spans) {
    if (!span.value) continue;
    const before = text;
    text = text.split(span.value).join(REPLACEMENTS[span.dataClass]);
    if (text !== before) bump(span.dataClass);
  }

  // SayDo 自家业务 id(09 §0:小写前缀_Crockford26;含 focus 域 foc/fac/fob/fev 等)不是凭据——
  // E2 实测:focusId 被裸长串规则误伤成"一处凭据",Brain 再学舌复述,形成污染链(2026-08-04)
  const SAYDO_ID_RE = /\b[a-z]{2,4}_[0-9A-HJKMNP-TV-Z]{26}\b/g;
  const idKeep = new Map<string, string>();
  text = text.replace(SAYDO_ID_RE, (m) => {
    const k = `\u0000ID${idKeep.size}\u0000`;
    idKeep.set(k, m);
    return k;
  });

  for (const rule of AUTO_RULES) {
    text = text.replace(rule.re, (m) => {
      bump(rule.cls);
      return rule.label ? rule.label(m) : REPLACEMENTS[rule.cls];
    });
  }

  for (const [k, v] of idKeep) text = text.split(k).join(v);

  return { text, redactions: [...counts.entries()].map(([cls, count]) => ({ cls, count })) };
}

export function redactText(input: string, spans: RedactSpan[] = []): string {
  return redactForSpeech(input, spans).text;
}

/** 是否仍残留明显敏感形态(自测/断言用:redactor 出口不应再命中;与 AUTO_RULES 同步,B1) */
export function hasResidualSensitive(text: string): boolean {
  return (
    new RegExp("-----BEGIN [A-Z ]*" + PK).test(text) ||
    /\bsha256:[0-9a-f]{64}\b/i.test(text) ||
    /\bBearer\s+[A-Za-z0-9._-]{8,}/.test(text) ||
    new RegExp("\\b(?:sk|gho|ghp|ghs|ghr|xoxb|xoxp)[-_][A-Za-z0-9]{16,}\\b").test(text) ||
    new RegExp("\\b(?:A" + "KIA|A" + "SIA)[0-9A-Z]{16}\\b").test(text) ||
    /\benv:[A-Z][A-Z0-9_]*\b/.test(text) ||
    /(?:~\/|\/(?:Users|home|var|tmp|etc|opt|private)\/|[A-Za-z]:\\)[^\s]*/.test(text) ||
    /\b\d{11,19}\b/.test(text) ||
    /\b[A-Za-z0-9+/_-]{20,}={0,2}\b/.test(text)
  );
}
