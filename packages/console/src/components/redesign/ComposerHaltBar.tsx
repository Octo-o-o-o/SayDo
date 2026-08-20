// ComposerHaltBar(demo composerFor 停机分支):closed/abandoned/archived 三种停机三种文案(11 §0.1-8 历史不可变);
// 停机状态=不进今天、拒绝新写入;closed 只能 fork。fork 回调由容器。

import { Plus } from "lucide-react";
import { Btn, card } from "./shared";
import type { FocusLifecycle } from "./types";

const HALT_COPY: Record<string, [string, string]> = {
  closed: ["已收官", "正常走完的。要继续,只能以它为底 fork 一件新的。"],
  abandoned: ["已放弃", "你主动中止的——放弃也是干净的收场,不是失败。想重来,fork 一件新的。"],
  archived: ["已归档", "封存不删,随时可以在「记录」里重开。"]
};

export function ComposerHaltBar({ lifecycle, onFork }: {
  lifecycle: FocusLifecycle;
  onFork?: () => void;
}) {
  const copy = HALT_COPY[lifecycle];
  if (!copy) return null;
  return (
    <div
      style={{ ...card, display: "flex", gap: "var(--space-3)", alignItems: "center", background: "var(--surface-raised)" }}
      data-composer-halt={lifecycle}
    >
      <span style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
        {copy[0]} · {copy[1]}停机状态:不进「今天」、拒绝新写入。
      </span>
      <span style={{ flex: 1 }} />
      <Btn variant="primary" icon={Plus} onClick={onFork}>fork 一件新的</Btn>
    </div>
  );
}
