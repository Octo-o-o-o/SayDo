import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DecisionPackageCard } from "./DecisionPackageCard";
import {
  applyDemoFetchResult,
  applyOwnedDemoFailure,
  applyOwnedDemoFetch,
  DemoFrame,
  DemoPreviewStatus
} from "./DemoFrame";
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

describe("PackageDemoPreview 请求归属(生产消费 applyOwnedDemoFetch)", () => {
  const demoOk = { artifact: { type: "demo" as const }, content: "<p>NEW_VERSION_2</p>" };
  const demoOld = { artifact: { type: "demo" as const }, content: "<p>OLD_VERSION_1</p>" };

  it("旧成功不得改当前 html/err", () => {
    expect(applyOwnedDemoFetch({ id: 1 }, { id: 2 }, demoOld)).toBeUndefined();
    expect(applyOwnedDemoFetch({ id: 2 }, { id: 2 }, demoOk)).toEqual({
      html: "<p>NEW_VERSION_2</p>",
      err: null
    });
  });

  it("旧失败不得改当前 html/err", () => {
    expect(applyOwnedDemoFailure({ id: 1 }, { id: 3 }, new Error("stale fail"))).toBeUndefined();
    expect(applyOwnedDemoFailure({ id: 3 }, { id: 3 }, new Error("当前错误"))).toEqual({
      html: null,
      err: "当前错误"
    });
  });

  it("当前请求仍走类型检查,非 demo 不进 srcDoc", () => {
    expect(applyOwnedDemoFetch({ id: 4 }, { id: 4 }, { artifact: { type: "plan" }, content: "# 计划" })).toEqual({
      html: null,
      err: "这份产物不是决策包小样"
    });
  });
});


describe("DecisionPackageCard 五个合法包态", () => {
  it.each([
    ["draft", "草稿"], ["approved", "已批准"], ["expired", "已作废"], ["superseded", "已被新版本替代"]
  ] as const)("%s 诚实显示且没有批准入口", (status, label) => {
    const html = renderToStaticMarkup(<DecisionPackageCard pkg={{ ...BASE, status }} />);
    expect(html).toContain(label);
    expect(html).not.toContain("待拍板");
    expect(html).not.toContain("拍板,开始");
  });
  it("只有 proposed 显示可批准，旧 direct 仍禁用", () => {
    const html = renderToStaticMarkup(<DecisionPackageCard pkg={{ ...BASE, status: "proposed" }} />);
    expect(html).toContain("待拍板");
    expect(html).toContain("拍板,开始");
    expect(html).not.toContain("disabled");
    const old = renderToStaticMarkup(<DecisionPackageCard pkg={{ ...BASE, status: "proposed", selectedMode: "direct_to_review" }} />);
    expect(old).toContain("disabled");
  });
});
