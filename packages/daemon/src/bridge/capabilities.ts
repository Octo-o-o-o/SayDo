export type CapLevel = "runtime" | "schema_only" | "none";

// 保留现役 Tier1 操作的 Hopper 拒绝投影；握手原型已退役。
export function hopperSteerSupport(level: CapLevel): { steerable: boolean; phrase: string } {
  if (level === "runtime") {
    return {
      steerable: true,
      phrase: "Hopper 已支持运行中改需求(能力升级已到);桥消费面按升级批接线"
    };
  }
  return {
    steerable: false,
    phrase: "这个任务走的 Hopper 后端不支持运行中改需求——要改就取消这轮重新派,或等它跑完在验收时提修改"
  };
}
