// StandbyCard fixture:待命(在等+叫醒条件+到期兜底)/已唤醒(dependency_woken)。
export const standbyFixtures = [
  {
    name: "待命(在等+叫醒条件+到期兜底)",
    waitingText: "酒店确认海景大床房。",
    wakeCondition: "酒店回复,或 8/10 还没消息我提醒你换一家。",
    woken: false,
    wokenText: ""
  },
  {
    name: "已唤醒(dependency_woken)",
    waitingText: "",
    wakeCondition: "",
    woken: true,
    wokenText: "酒店回复了:海景房可订。行程草案我开始排,排好叫你。"
  }
];
