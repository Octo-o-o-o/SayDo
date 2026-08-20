// PageNavTarget → 真实 hash(接线合同 README:onNavigate 映射)。

import type { PageNavTarget } from "../../pages/redesign/nav";

export function pageNavToHash(target: PageNavTarget): string {
  switch (target.page) {
    case "focus":
      return `/focus/${encodeURIComponent(target.focusId)}`;
    case "records":
      return `/records/${encodeURIComponent(target.focusId)}`;
    case "review":
      return `/review/${encodeURIComponent(target.taskId)}`;
    case "board":
      return "/board";
    case "today":
      return "/today";
  }
}
