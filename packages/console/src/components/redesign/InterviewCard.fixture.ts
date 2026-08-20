// InterviewCard fixture:未选(推荐只占徽章不占预选位)/已选。
export const interviewFixtures = [
  {
    name: "未选(推荐只占徽章)",
    question: "报告里你最想先弄懂哪一块?",
    options: ["心血管和血压相关", "代谢(血糖 / 血脂)", "肿瘤标志物", "都给我讲讲"],
    recommended: "都给我讲讲",
    picked: null as string | null
  },
  {
    name: "已选",
    question: "报告里你最想先弄懂哪一块?",
    options: ["心血管和血压相关", "代谢(血糖 / 血脂)", "肿瘤标志物", "都给我讲讲"],
    recommended: "都给我讲讲",
    picked: "代谢(血糖 / 血脂)"
  }
];
