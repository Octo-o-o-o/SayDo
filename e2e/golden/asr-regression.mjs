// ASR 误听 golden 回归集(07 D4:换 provider 门禁资产;W9 触发线 = 纠错事件 + 人工标注累计 300-500 条)。
// 登记形式照 e2e/spikes/asr-1.0/corpus.mjs(id/text/terms)+ 误听登记字段:
//   misheard = 稳定误听形态(逐字);source = 语料来源;audio = 音频定位(owner 底板在 ~/.saydo/owner-audio,不入 repo);
//   registeredAt = 登记日;status = "open"(未拉回)| "recovered"(已拉回,附拉回方式)。
// 策展纪律(W9):每周从纠错事件(10 #8/#9)+ 人工标注策展一次;两次复跑一致才登记(防抖动误登)。
// 消费:audio-smoke-5.py --profile owner 的 OWNER_KNOWN_MISSES 与本表 status=open 条目保持一致;
//       7.6 第二家对比(gpt-4o-transcribe,挂 OpenAI key)以本表全量作跑分门禁。

export const ASR_REGRESSION = [
  {
    id: "r001",
    text: "settle barrier 没过就不许回叫,proof 缺一不叫",
    terms: ["settle barrier", "proof"],
    misheard: "uh strawberry 没过就不许回,叫 proof 缺一不叫。",
    missedTerm: "settle barrier",
    source: "owner 真人底板 a13(R45,2026-07-26;两次复跑稳定)",
    audio: "~/.saydo/owner-audio/a13.m4a",
    registeredAt: "2026-07-26",
    status: "open",
    note: "热词调优五组变体(拆词 settle/barrier、Gate zero 变体、scale=2 加权、组合)全部无改善——偏置拉不动声学置信(W1.2 实验,evidence w1-batch.md);拉回路径 = 用户纠错链(10 #8/#9)入 M0 热词后复验,场次①步骤 5 现场验证",
  },
  {
    id: "r002",
    text: "Gate 0 没关的话 dispatch 一律拒绝,没有 bypass",
    terms: ["Gate 0", "dispatch"],
    misheard: "嗯,get 0没关的话 dispatch 一律拒绝,没有 by pass。",
    missedTerm: "Gate 0",
    source: "owner 真人底板 a20(R45,2026-07-26;两次复跑稳定)",
    audio: "~/.saydo/owner-audio/a20.m4a",
    registeredAt: "2026-07-26",
    status: "open",
    note: "同 r001 实验矩阵,无变体拉回;\"get 0\"与\"Gate 0\"归一化后仍不同串(norm 不吞 0 前空格差异之外的字符差)",
  },
];
