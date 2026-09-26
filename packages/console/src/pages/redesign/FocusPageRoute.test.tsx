import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FocusPageRoute } from "./FocusPageRoute";
import { focusPageActive } from "./FocusPage.fixture";

const loadOlder = vi.fn(async () => {});
const data = {
  view: focusPageActive as typeof focusPageActive | null,
  loading: false,
  error: null as string | null,
  reload: () => {},
  loadOlder,
  hasOlder: true,
  olderError: null as string | null,
  onExpandSegment: async () => null
};

vi.mock("../../shell/VoiceContext", () => ({
  useVoice: () => ({ sessionId: null, confirmCard: null, sendText: async () => false })
}));

vi.mock("../../hooks/redesign/useFocusPageData", () => ({
  useFocusPageData: () => data
}));

describe("FocusPageRoute 翻页局部错误", () => {
  beforeEach(() => {
    loadOlder.mockClear();
    data.view = focusPageActive;
    data.loading = false;
    data.error = null;
    data.hasOlder = true;
    data.olderError = null;
  });

  it("olderError 用局部 ErrorCard+重试,不拆已有 Focus 视图", () => {
    data.olderError = "timeline 5xx";
    const html = renderToStaticMarkup(<FocusPageRoute focusId={focusPageActive.focus.id} />);
    expect(html).toContain('data-page="redesign-focus"');
    expect(html).toContain("data-timeline-older-error");
    expect(html).toContain("更早时间线没加载下来");
    expect(html).toContain("timeline 5xx");
    expect(html).toContain("data-timeline-older-retry");
    expect(html).toContain("data-timeline-older");
    expect(html).toContain("重试加载更早");
    expect(html).not.toContain("Focus 页加载失败");
  });

  it("整页 error 仍会换成 ErrorCard,与局部翻页错误分流", () => {
    data.error = "首屏失败";
    data.olderError = null;
    const html = renderToStaticMarkup(<FocusPageRoute focusId={focusPageActive.focus.id} />);
    expect(html).toContain("Focus 页加载失败");
    expect(html).toContain("首屏失败");
    expect(html).not.toContain('data-page="redesign-focus"');
    expect(html).not.toContain("data-timeline-older-error");
  });
});
