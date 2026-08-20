// #/dev-pages(dev-only 走查页,HANDOFF-2 §2 门禁要求):四个 redesign 页面 fixture 驱动可切换。
// 三态自查:亮/暗主题(写 documentElement data-theme)+ 宽/窄(rdp-force-narrow 模拟 <1100px 降级)。
// 只读预览:所有回调打 console.debug;不进生产导航(路由表单独标注 dev-only)。

import { useState } from "react";
import type { ReactNode } from "react";
import { Btn, card } from "../components/redesign";
import { FocusPage, ReviewPage, BoardPage, RecordsPage } from "./redesign";
import type { PageNavTarget } from "./redesign";
import { focusPageFixtures } from "./redesign/FocusPage.fixture";
import { reviewPageFixtures } from "./redesign/ReviewPage.fixture";
import { boardPageFixtures } from "./redesign/BoardPage.fixture";
import { recordsPageFixtures } from "./redesign/RecordsPage.fixture";
import { segmentTranscriptDemo } from "../components/redesign/TimelineNote.fixture";

const debug = (...args: unknown[]) => console.debug("[dev-pages action]", ...args);

type PageKey = "focus" | "review" | "board" | "records";
const PAGE_LABEL: Record<PageKey, string> = { focus: "FocusPage", review: "ReviewPage", board: "BoardPage", records: "RecordsPage" };

function setTheme(mode: "light" | "dark" | "auto") {
  if (mode === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", mode);
}

/** 活跃态 composerSlot 占位:真实语音 composer 由接线线挂载 */
function ComposerSlotDemo() {
  return (
    <div style={{ ...card, display: "flex", gap: "var(--space-3)", alignItems: "center", background: "var(--surface-raised)" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--active-ink)", flex: "none" }} aria-hidden />
      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
        composerSlot 占位(dev):这里挂语音输入区,接线线施工
      </span>
    </div>
  );
}

export function DevPages() {
  const [page, setPage] = useState<PageKey>("focus");
  const [variant, setVariant] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const [theme, setThemeState] = useState<"light" | "dark" | "auto">("auto");

  const onNavigate = (t: PageNavTarget) => debug("navigate", t);
  const onExpandSegment = (sessionRef: string) => {
    debug("expandSegment", sessionRef);
    return segmentTranscriptDemo;
  };

  const fixtures: Record<PageKey, { name: string; node: (i: number) => ReactNode }> = {
    focus: {
      name: "FocusPage",
      node: (i) => {
        const f = focusPageFixtures[i]!;
        return (
          <FocusPage
            view={f.view}
            composerSlot={f.halt ? undefined : <ComposerSlotDemo />}
            onNavigate={onNavigate}
            onAction={(a) => debug("focus", a)}
            onExpandSegment={onExpandSegment}
          />
        );
      }
    },
    review: {
      name: "ReviewPage",
      node: (i) => <ReviewPage view={reviewPageFixtures[i]!.view} onNavigate={onNavigate} onAction={(a) => debug("review", a)} />
    },
    board: {
      name: "BoardPage",
      node: (i) => <BoardPage view={boardPageFixtures[i]!.view} onNavigate={onNavigate} onAction={(a) => debug("board", a)} />
    },
    records: {
      name: "RecordsPage",
      node: (i) => <RecordsPage view={recordsPageFixtures[i]!.view} onNavigate={onNavigate} onAction={(a) => debug("records", a)} onExpandSegment={onExpandSegment} />
    }
  };

  const variantCount = { focus: focusPageFixtures.length, review: reviewPageFixtures.length, board: boardPageFixtures.length, records: recordsPageFixtures.length }[page];
  const vi = Math.min(variant, variantCount - 1);

  const pick = (p: PageKey) => { setPage(p); setVariant(0); };
  const pickTheme = (m: "light" | "dark" | "auto") => { setThemeState(m); setTheme(m); };

  return (
    <div data-page="dev-pages">
      <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: 4 }}>redesign 页面走查</h1>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
        dev-only:四页 fixture 驱动;回调打 console.debug。亮/暗写 data-theme;窄 = rdp-force-narrow 模拟 &lt;1100px 降级(右栏收成摘要条)。
      </p>
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-5)", flexWrap: "wrap", alignItems: "center" }}>
        {(Object.keys(PAGE_LABEL) as PageKey[]).map(p => (
          <Btn key={p} variant={page === p ? "primary" : "default"} onClick={() => pick(p)}>{PAGE_LABEL[p]}</Btn>
        ))}
        <span style={{ width: 1, height: 18, background: "var(--line)" }} aria-hidden />
        {Array.from({ length: variantCount }).map((_, i) => (
          <Btn key={i} variant={vi === i ? "ink-outline" : "default"} onClick={() => setVariant(i)}>例 {i + 1}</Btn>
        ))}
        <span style={{ width: 1, height: 18, background: "var(--line)" }} aria-hidden />
        <Btn variant={theme === "light" ? "ink-outline" : "default"} onClick={() => pickTheme("light")}>亮</Btn>
        <Btn variant={theme === "dark" ? "ink-outline" : "default"} onClick={() => pickTheme("dark")}>暗</Btn>
        <Btn variant={theme === "auto" ? "ink-outline" : "default"} onClick={() => pickTheme("auto")}>跟随系统</Btn>
        <span style={{ width: 1, height: 18, background: "var(--line)" }} aria-hidden />
        <Btn variant={narrow ? "ink-outline" : "default"} onClick={() => setNarrow(!narrow)}>{narrow ? "窄(模拟 <1100px)" : "宽"}</Btn>
      </div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", fontFamily: "var(--font-mono)", marginBottom: "var(--space-3)" }}>
        {fixtures[page].name} · {vi + 1}/{variantCount}
      </div>
      <div
        className={narrow ? "rdp-force-narrow" : undefined}
        style={narrow ? { maxWidth: 720, margin: "0 auto", outline: "1px dashed var(--line-soft)", outlineOffset: 8 } : undefined}
      >
        {fixtures[page].node(vi)}
      </div>
    </div>
  );
}
