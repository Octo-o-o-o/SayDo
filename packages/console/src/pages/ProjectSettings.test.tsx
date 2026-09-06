import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { apiErrorFromResponse } from "../lib/apiError";
import { FoundationBootstrapResultView, foundationViewFromError, type FoundationBootstrapView } from "./ProjectSettings";

const SECRET = ["sk", "-", "A".repeat(16)].join("");
const ABS = ["/Use", "rs/alice/repo"].join("");

function htmlOf(result: FoundationBootstrapView): string {
  return renderToStaticMarkup(<FoundationBootstrapResultView result={result} />);
}

function assertNoLeak(html: string): void {
  expect(html).not.toContain("/Users/");
  expect(html).not.toContain("C:/");
  expect(html).not.toContain(SECRET);
  expect(html).not.toContain(ABS);
}

describe("项目设置奠基结果展示", () => {
  it("成功态仍是 generation 行", () => {
    const html = htmlOf({
      kind: "success",
      generation: 2,
      status: "complete",
      progressLine: "底座已建好,读了 3 个关键文件。"
    });
    expect(html).toContain("generation 2(complete):底座已建好,读了 3 个关键文件。");
    expect(html).not.toContain("底座未更新");
    expect(html).not.toContain("知识底座还没建起来");
    assertNoLeak(html);
  });

  it("刷新失败仍用上一版,不显示新 generation 成功行", () => {
    const html = htmlOf({
      kind: "refresh_failed",
      message: "底座未更新,仍用上一版",
      safeHits: [
        {
          relativeSource: "AGENTS.md",
          line: 2,
          kind: "openai_sk",
          prescription: "remove_source_literal"
        }
      ]
    });
    expect(html).toContain("底座未更新,仍用上一版");
    expect(html).toContain("AGENTS.md");
    expect(html).toContain(":2");
    expect(html).toContain("openai_sk");
    expect(html).toContain("remove_source_literal");
    expect(html).not.toContain("generation ");
    assertNoLeak(html);
  });

  it("首次无底座", () => {
    const html = htmlOf({
      kind: "first_build_unavailable",
      message: "知识底座还没建起来",
      safeHits: [
        {
          relativeSource: ".cursor/rules/demo.md",
          kind: "github_ghp",
          prescription: "remove_source_literal"
        }
      ]
    });
    expect(html).toContain("知识底座还没建起来");
    expect(html).toContain(".cursor/rules/demo.md");
    expect(html).not.toContain("generation ");
    assertNoLeak(html);
  });

  it("Git 保护不足带处方", () => {
    const html = htmlOf({
      kind: "git_protection",
      message: "这次私有知识没写进去,Git 还没保护好",
      safeHits: [],
      gitProtection: { status: "insufficient", relativeTarget: ".saydo/foundation" },
      prescription: "fix_git_ignore_or_untrack"
    });
    expect(html).toContain("这次私有知识没写进去,Git 还没保护好");
    expect(html).toContain("fix_git_ignore_or_untrack");
    expect(html).not.toContain("generation ");
    assertNoLeak(html);
  });

  it("failureClass 刷新失败 + git code 同时呈现,互不遮蔽", () => {
    const err = apiErrorFromResponse(
      409,
      {
        ok: false,
        code: "git_protection_insufficient",
        message: "这次私有知识没写进去,Git 还没保护好,屏幕上有做法,我不会替你改仓库",
        retryable: false,
        failureClass: "foundation_refresh_failed_kept_old",
        gitProtection: { status: "insufficient", relativeTarget: ".saydo/foundation" },
        prescription: "fix_git_ignore_or_untrack",
        safeHits: []
      },
      "/api/projects/p/foundation/bootstrap"
    );
    const html = htmlOf(foundationViewFromError(err));
    expect(html).toContain("仍用上一版");
    expect(html).toContain("这次私有知识没写进去,Git 还没保护好");
    expect(html).toContain("fix_git_ignore_or_untrack");
    expect(html).toContain("insufficient");
    expect(html).toContain(".saydo/foundation");
    expect(html).not.toContain("generation ");
    assertNoLeak(html);
  });

  it("failureClass 首次无底座 + git code 同时呈现,互不遮蔽", () => {
    const err = apiErrorFromResponse(
      409,
      {
        ok: false,
        code: "git_protection_insufficient",
        message: "这次私有知识没写进去,Git 还没保护好,屏幕上有做法,我不会替你改仓库",
        retryable: false,
        failureClass: "foundation_first_build_unavailable",
        gitProtection: { status: "outside_root", relativeTarget: ".saydo" },
        prescription: "fix_git_ignore_or_untrack",
        safeHits: []
      },
      "/api/projects/p/foundation/bootstrap"
    );
    const html = htmlOf(foundationViewFromError(err));
    expect(html).toContain("知识底座还没建起来");
    expect(html).toContain("这次私有知识没写进去,Git 还没保护好");
    expect(html).toContain("fix_git_ignore_or_untrack");
    expect(html).toContain("outside_root");
    expect(html).toContain(".saydo");
    expect(html).not.toContain("generation ");
    assertNoLeak(html);
  });

  it("App.tsx 路由 psettings 指向 ProjectSettings", () => {
    const appSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../App.tsx"), "utf8");
    expect(appSrc).toContain('case "psettings"');
    expect(appSrc).toContain("<ProjectSettings");
    expect(appSrc).toContain('from "./pages/ProjectSettings"');
  });
});
