import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DecisionPackageCard } from "./DecisionPackageCard";
import { applyDemoFetchResult, DemoFrame, DemoPreviewStatus } from "./DemoFrame";
import type { DecisionPackageView } from "./types";
import { decisionPackageFixtures } from "./DecisionPackageCard.fixture";
import { apiErrorFromResponse } from "../../lib/apiError";

const BASE: DecisionPackageView = decisionPackageFixtures[0]!.pkg;
const DEMO_REF = { artifactId: "art_01AAAAAAAAAAAAAAAAAAAAAAAA", version: 1 };
const PROJECT_ID = "prj_01AAAAAAAAAAAAAAAAAAAAAAAA";

describe("DecisionPackageCard 现役逐步确认", () => {
  it("不提供一口气跑完 selector", () => {
    const html = renderToStaticMarkup(<DecisionPackageCard pkg={BASE} />);
    expect(html).not.toContain("一口气跑完");
    expect(html).toContain("按逐步确认执行");
    expect(html).not.toContain("disabled");
  });

  it("旧 selectedMode=direct_to_review fail-closed 不可拍板", () => {
    const html = renderToStaticMarkup(
      <DecisionPackageCard pkg={{ ...BASE, selectedMode: "direct_to_review" }} />
    );
    expect(html).toContain("不能从这里拍板");
    expect(html).toContain("disabled");
    expect(html).not.toContain("一口气跑完");
  });
});

describe("DecisionPackageCard 看小样", () => {
  it("有 demoRef 且有 projectId 渲染「看小样」按钮", () => {
    const html = renderToStaticMarkup(
      <DecisionPackageCard pkg={{ ...BASE, projectId: PROJECT_ID, demoRef: DEMO_REF }} />
    );
    expect(html).toContain("看小样");
    expect(html).toContain("data-demo-preview");
  });

  it("无 demoRef 不渲染「看小样」", () => {
    const html = renderToStaticMarkup(<DecisionPackageCard pkg={{ ...BASE, projectId: PROJECT_ID }} />);
    expect(html).not.toContain("看小样");
    expect(html).not.toContain("data-demo-preview");
  });

  it("有 demoRef 无 projectId 不渲染「看小样」", () => {
    const html = renderToStaticMarkup(<DecisionPackageCard pkg={{ ...BASE, demoRef: DEMO_REF }} />);
    expect(html).not.toContain("看小样");
    expect(html).not.toContain("data-demo-preview");
  });
});

describe("DemoFrame iframe 沙箱", () => {
  it("sandbox 为空字符串且使用 srcdoc 而非 src", () => {
    const html = renderToStaticMarkup(<DemoFrame html="<p>小样</p>" projectId="prj_x" />);
    expect(html).toContain('title="决策包小样"');
    expect(html).toMatch(/sandbox=""/);
    expect(html).toMatch(/srcdoc=/i);
    expect(html).not.toMatch(/[\s]src="/);
    expect(html).toContain("在产物库查看");
  });
});

describe("看小样 fetch 失败渲染", () => {
  it("403 artifact_project_mismatch 渲染人话且无 iframe", () => {
    const err = apiErrorFromResponse(403, {
      ok: false,
      code: "artifact_project_mismatch",
      message: "artifact art_x 不属于项目 prj_y(拒跨项目读取)"
    });
    const html = renderToStaticMarkup(<DemoPreviewStatus err={err.message} html={null} projectId={PROJECT_ID} />);
    expect(html).toContain("这份产物不属于当前项目");
    expect(html).not.toContain("凭证");
    expect(html).not.toContain("data-demo-frame");
  });

  it("409 artifact_corrupt 渲染错误且清空小样", () => {
    const err = apiErrorFromResponse(409, {
      ok: false,
      code: "artifact_corrupt",
      message: "artifact corrupt: art_x v1 digest mismatch"
    });
    const html = renderToStaticMarkup(<DemoPreviewStatus err={err.message} html={null} projectId={PROJECT_ID} />);
    expect(html).toContain("data-demo-error");
    expect(html).toContain("digest mismatch");
    expect(html).not.toContain("data-demo-frame");
  });

  it("非 demo 类型不进 srcDoc", () => {
    expect(applyDemoFetchResult({ artifact: { type: "plan" }, content: "# 计划" })).toEqual({
      html: null,
      err: "这份产物不是决策包小样"
    });
    expect(applyDemoFetchResult({ artifact: { type: "demo" }, content: "<p>ok</p>" })).toEqual({
      html: "<p>ok</p>",
      err: null
    });
  });
});
