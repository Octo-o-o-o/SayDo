import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SessionSegmentCard, TimelineNote } from "./TimelineNote";

describe("SessionSegmentCard 静态诚实态", () => {
  it("transcriptAvailable=false 不画展开、不伪造转写", () => {
    const html = renderToStaticMarkup(
      <SessionSegmentCard
        sessionRef="ses_none"
        turnCount={9}
        startTs="周一 21:40"
        endTs="22:03"
        transcriptAvailable={false}
        onExpand={() => {
          throw new Error("should not read");
        }}
      />
    );
    expect(html).toContain("未存转写,仅事件留痕");
    expect(html).not.toContain("展开转写");
    expect(html).not.toContain("这一段没有留下转写内容。");
    expect(html).not.toContain("转写没读到。");
    expect(html).toContain('data-transcript-available="false"');
  });

  it("可展开初态不把失败画成真空", () => {
    const html = renderToStaticMarkup(
      <SessionSegmentCard
        sessionRef="ses_a"
        turnCount={3}
        startTs="10:00"
        endTs="10:10"
        transcriptAvailable={true}
        onExpand={async () => null}
      />
    );
    expect(html).toContain("展开转写");
    expect(html).not.toContain("这一段没有留下转写内容。");
    expect(html).not.toContain("转写没读到。");
    expect(html).toContain('data-session-ref="ses_a"');
  });

  it("分隔注只渲染给定文本", () => {
    const html = renderToStaticMarkup(<TimelineNote text="昨天下午 · 第 12 次会话开始" />);
    expect(html).toContain("昨天下午 · 第 12 次会话开始");
  });
});
