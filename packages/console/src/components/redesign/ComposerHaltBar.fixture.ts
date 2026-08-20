// ComposerHaltBar fixture:三种停机三种文案。
export const composerHaltFixtures = [
  { name: "closed · 已收官", lifecycle: "closed" as const },
  { name: "abandoned · 已放弃", lifecycle: "abandoned" as const },
  { name: "archived · 已归档", lifecycle: "archived" as const }
];
