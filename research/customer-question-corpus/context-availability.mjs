import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// docs/09 §18.9 的 owner exact-set；manifest 是状态源，题目依赖从原行读取。
const retiredDates = new Map([
  ["CTX-05", "2026-09-30"], ["CTX-06", "2026-09-30"], ["CTX-08", "2026-09-30"],
  ["CTX-09", "2026-10-04"], ["CTX-12", "2026-10-04"], ["CTX-13", "2026-09-30"],
  ["CTX-15", "2026-09-30"], ["CTX-16", "2026-10-04"]
]);

export function contextAvailability(root) {
  const retired = [];
  for (let i = 1; i <= 16; i += 1) {
    const id = `CTX-${String(i).padStart(2, "0")}`;
    const text = readFileSync(join(root, "contexts", id, "manifest.md"), "utf8");
    const statuses = [...text.matchAll(/- `active_status`: `([^`]+)`/gu)];
    const expected = retiredDates.has(id) ? "retired_no_updated_source" : "active";
    if (statuses.length > 1 || (statuses[0]?.[1] ?? "active") !== expected) throw new Error(`${id} active_status 与 owner 退役 exact-set 不符`);
    if (retiredDates.has(id)) {
      const dates = [...text.matchAll(/- `retired_on`: `([^`]+)`/gu)];
      if (dates.length !== 1 || dates[0][1] !== retiredDates.get(id)) throw new Error(`${id} 缺真实退役日期或日期漂移`);
      retired.push(id);
    }
  }
  const rows = [];
  for (const name of readdirSync(join(root, "questions")).filter(name => name.endsWith(".md")).sort()) {
    for (const line of readFileSync(join(root, "questions", name), "utf8").split("\n")) {
      if (!/^\| [A-Z]{3}-\d{3} \|/u.test(line)) continue;
      const cells = line.split("|").slice(1, -1).map(cell => cell.trim());
      const dependencies = cells[7].split("+").map(value => value.trim()).filter(id => retired.includes(id));
      rows.push({ id: cells[0], status: dependencies.length ? "not_executable_retired_context" : "not_blocked_by_retirement", dependencies });
    }
  }
  if (rows.length !== 600 || new Set(rows.map(row => row.id)).size !== 600) throw new Error("当前可用性必须保留 600 题唯一历史分母");
  const excluded = rows.filter(row => row.dependencies.length);
  return { historical_questions: rows.length, active_contexts: 16 - retired.length, retired_contexts: retired, not_blocked_by_retirement: rows.length - excluded.length, excluded_count: excluded.length, excluded };
}

export function renderAvailability(availability, selectedIds = null) {
  const selected = selectedIds ? new Set(selectedIds) : null;
  const excluded = availability.excluded.filter(row => !selected || selected.has(row.id));
  const total = selected?.size ?? availability.historical_questions;
  return [
    "## 当前上下文可用性（2026-09-30 原退役与 2026-10-04 追加退役投影）",
    "",
    `历史分母 ${total}；因退役上下文不可执行 ${excluded.length}；未被本次退役阻断 ${total - excluded.length}（不代表执行通过）。未退役上下文 ${availability.active_contexts}/16（不代表当前有效，当前有效性见 expiry-observation-2026-10-03.md）。`,
    "历史回放与理论状态保留；下列题目当前为 not_executable_retired_context，不得以历史 EXECUTABLE 或 REPLAY_PASS 宣称当前成功。",
    "",
    "| ID | 退役依赖 | 当前状态 |",
    "|---|---|---|",
    ...excluded.map(row => `| ${row.id} | ${row.dependencies.join(", ")} | ${row.status} |`),
    ""
  ].join("\n");
}
