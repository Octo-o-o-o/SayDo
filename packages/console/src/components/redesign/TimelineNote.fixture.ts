// TimelineNote / SessionSegmentCard fixture:分隔注 + 会话段三态(已收场可展开/未存转写/中断缺尾)。
export const timelineNoteFixtures: { name: string; text: string }[] = [
  { name: "会话分隔", text: "昨天下午 · 第 12 次会话开始" },
  { name: "打断注记", text: "上一句被打断,未送达,不作「已告知」依据" }
];

export const sessionSegmentFixtures: {
  name: string;
  turnCount: number;
  startTs: string;
  endTs: string | null;
  transcriptAvailable: boolean;
}[] = [
  { name: "已收场 · 可展开转写", turnCount: 41, startTs: "昨天 15:02", endTs: "17:40", transcriptAvailable: true },
  { name: "未存转写(store_transcript=false,占位不伪造)", turnCount: 9, startTs: "周一 21:40", endTs: "22:03", transcriptAvailable: false },
  { name: "中断缺尾(无 closed 事件)", turnCount: 17, startTs: "今天 09:31", endTs: null, transcriptAvailable: true }
];

export const segmentTranscriptDemo = [
  "你:demo 先给我看,确认了再动 console。",
  "SayDo:好,那核心动作其实只有三个:跟我聊、看着方案拍板、跑完了验收。",
  "你:对,我就想打开一眼看到今天要我干嘛。"
];
