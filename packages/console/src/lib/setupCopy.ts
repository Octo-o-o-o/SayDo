/** 向导链用户可见文案单源。遵守 docs/11 §10.1:不解释交互,不重复教学。 */

export const SETUP_COPY = {
  detecting: "正在清点这台机器能用的模型来源…",
  switchProvider: "切换提供商",
  mixTitle: "我的混搭",
  comboEmptyComplete: "没有匹配的模型",
  comboEmptyPartial: "列表里没有这个名字",
  comboMatchExtra: " · 不在列表里也能用",
  comboPlaceholderComplete: (n: number) => `搜索模型(共 ${n} 个)`,
  comboPlaceholderPartial: (n: number) => `搜索或直接填模型名(已知 ${n} 个)`,
  noListNote: "没有完整列表",
  enumerableCount: (n: number) => `${n} 个模型`,
  transportHint: "以你 CLI 配置的上游为准",
  apiKeyReuse: "这个地址的密钥会留在这台电脑,提交后不再显示",
  storedKeyReuse: "已有可复用的密钥;留空会沿用,不会再显示原值。",
  inventoryOthers: (names: string) => `本机还有 ${names},暂时还不能当模型来源`,
  cliLoading: "正在查看这家能不能用"
} as const;
