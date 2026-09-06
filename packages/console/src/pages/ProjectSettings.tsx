// 项目设置(#/p/:id/settings;工作区/类型/执行模式默认;P0 只读展示 + 危险区分组样式)。
// W2 阶段 C:奠基操作(首次/重奠基;重奠基 generation+1 使旧 Context Pack 失效重编译)。
// W5a 3.5:模型/预算覆盖(08 §6 项目设置行"P1 模型/预算覆盖";daemon 受控表,绝不落 project.toml)。

import { useState } from "react";
import { Settings2 } from "lucide-react";
import type { GitProtectionResult, KnowledgePrivacyPrescription, KnowledgePrivacySafeHit } from "@saydo/contracts";
import { api, isRemoteOrigin } from "../lib/api";
import { ApiError } from "../lib/apiError";
import { useAsync } from "../lib/useAsync";
import { EmptyState, ErrorCard, PaperCard, Mono, SectionTitle } from "../components/ui";

type FoundationFailureFields = {
  message: string;
  safeHits: KnowledgePrivacySafeHit[];
  overflowCount?: number;
  gitProtection?: GitProtectionResult;
  prescription?: KnowledgePrivacyPrescription;
};

export type FoundationBootstrapView =
  | { kind: "success"; generation: number; status: string; progressLine: string }
  | ({ kind: "refresh_failed" } & FoundationFailureFields)
  | ({ kind: "first_build_unavailable" } & FoundationFailureFields)
  | ({ kind: "git_protection" } & FoundationFailureFields)
  | { kind: "generic"; message: string };

function gitOverlay(apiErr: ApiError): Pick<FoundationFailureFields, "gitProtection" | "prescription"> {
  if (apiErr.code !== "git_protection_insufficient") return {};
  return {
    ...(apiErr.gitProtection ? { gitProtection: apiErr.gitProtection } : {}),
    prescription: apiErr.prescription ?? "fix_git_ignore_or_untrack"
  };
}

function failureFields(apiErr: ApiError): FoundationFailureFields {
  return {
    message: apiErr.message,
    safeHits: apiErr.safeHits ?? [],
    ...(apiErr.overflowCount !== undefined ? { overflowCount: apiErr.overflowCount } : {}),
    ...gitOverlay(apiErr)
  };
}

export function foundationViewFromError(err: unknown): FoundationBootstrapView {
  const apiErr = err instanceof ApiError ? err : undefined;
  if (apiErr?.failureClass === "foundation_refresh_failed_kept_old") {
    return { kind: "refresh_failed", ...failureFields(apiErr) };
  }
  if (apiErr?.failureClass === "foundation_first_build_unavailable") {
    return { kind: "first_build_unavailable", ...failureFields(apiErr) };
  }
  if (apiErr?.code === "git_protection_insufficient") {
    return { kind: "git_protection", ...failureFields(apiErr) };
  }
  if (apiErr?.code === "foundation_build_restricted") {
    return { kind: "first_build_unavailable", ...failureFields(apiErr) };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { kind: "generic", message: `奠基失败:${message}` };
}

function SafeHitsList({ hits }: { hits: KnowledgePrivacySafeHit[] }) {
  if (hits.length === 0) return null;
  return (
    <ul data-foundation-safe-hits style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: "var(--text-xs)" }}>
      {hits.map((hit, i) => (
        <li key={`${hit.relativeSource}:${hit.line ?? ""}:${hit.kind}:${i}`} data-safe-hit>
          {hit.relativeSource}
          {hit.line !== undefined ? `:${hit.line}` : ""}
          {` ${hit.kind} ${hit.prescription}`}
        </li>
      ))}
    </ul>
  );
}

/** 奠基结果纯展示(无 hook),供静态渲染测试三态与成功态。 */
export function FoundationBootstrapResultView({ result }: { result: FoundationBootstrapView }) {
  if (result.kind === "success") {
    return (
      <p data-foundation-result style={{ margin: "10px 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
        {`generation ${result.generation}(${result.status}):${result.progressLine}`}
      </p>
    );
  }
  if (result.kind === "generic") {
    return (
      <p data-foundation-result style={{ margin: "10px 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
        {result.message}
      </p>
    );
  }
  const title =
    result.kind === "refresh_failed"
      ? "底座未更新,仍用上一版"
      : result.kind === "first_build_unavailable"
        ? "知识底座还没建起来"
        : "这次私有知识没写进去,Git 还没保护好";
  const gitLine =
    result.kind === "git_protection"
      ? undefined
      : result.gitProtection || result.prescription === "fix_git_ignore_or_untrack"
        ? "这次私有知识没写进去,Git 还没保护好"
        : undefined;
  const prescription =
    result.kind === "git_protection" || result.prescription === "fix_git_ignore_or_untrack"
      ? (result.prescription ?? "fix_git_ignore_or_untrack")
      : result.prescription;
  const gitProtection = "gitProtection" in result ? result.gitProtection : undefined;
  return (
    <div data-foundation-result data-foundation-kind={result.kind} style={{ margin: "10px 0 0" }}>
      <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{title}</p>
      {gitLine ? (
        <p data-foundation-git-line style={{ margin: "6px 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          {gitLine}
        </p>
      ) : null}
      {prescription ? (
        <p data-foundation-prescription style={{ margin: "6px 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          {`处方:${prescription}`}
        </p>
      ) : null}
      {gitProtection ? (
        <p data-foundation-git-protection style={{ margin: "6px 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          {gitProtection.status}
          {gitProtection.relativeTarget ? ` ${gitProtection.relativeTarget}` : ""}
        </p>
      ) : null}
      <SafeHitsList hits={result.safeHits} />
    </div>
  );
}

export function ProjectSettings({ projectId }: { projectId: string }) {
  const [refresh, setRefresh] = useState(0);
  const { data, error } = useAsync(() => api.projectSettings(projectId), [projectId, refresh]);
  const [foundationView, setFoundationView] = useState<FoundationBootstrapView | null>(null);
  const [busy, setBusy] = useState(false);
  const [ovMsg, setOvMsg] = useState<string | null>(null);
  if (error) return <ErrorCard message="项目设置加载失败" detail={error} />;
  if (!data) return <EmptyState icon={Settings2} text="项目不存在" />;
  const ws = JSON.parse(String(data["workspace_json"] ?? "{}")) as Record<string, unknown>;
  const rows: [string, string][] = [
    ["名称", String(data["title"] ?? "")],
    ["类型", String(data["type"] ?? "")],
    ["状态", String(data["status"] ?? "")],
    ["工作区", String(ws["path"] ?? "未绑定")],
    ["执行模式默认", String(data["exec_mode_default"] ?? "")]
  ];
  const runBootstrap = () => {
    setBusy(true);
    setFoundationView(null);
    void api
      .bootstrapFoundation(projectId)
      .then((r) =>
        setFoundationView({
          kind: "success",
          generation: r.generation,
          status: r.status,
          progressLine: r.progressLine
        })
      )
      .catch((e: unknown) => setFoundationView(foundationViewFromError(e)))
      .finally(() => setBusy(false));
  };
  return (
    <div className="flex flex-col gap-[var(--space-4)]" data-page="psettings">
      <SectionTitle>项目设置</SectionTitle>
      <PaperCard>
        <table style={{ width: "100%", fontSize: "var(--text-sm)", borderCollapse: "collapse" }}>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} style={{ height: 44, borderTop: "1px solid var(--line)" }}>
                <td style={{ color: "var(--text-muted)", width: 160 }}>{k}</td>
                <td>
                  <Mono>{v}</Mono>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: "12px 0 0", fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
          verify 白名单与 setup 命令来自仓内 .saydo/project.toml(白名单域,models/providers 等项目层出现即拒)。
        </p>
      </PaperCard>
      {/* W5a 3.5:模型/预算覆盖(受控表;项目 > 全局;evaluator 不可覆盖——异族护栏锚点) */}
      <SectionTitle>模型与预算覆盖</SectionTitle>
      <PaperCard>
        {(() => {
          const ov = (data["overrides"] ?? null) as {
            models?: { dialog?: unknown; thinking?: unknown; dev?: { agent: string; model: string } };
            budget?: { maxCost?: number; walltimeActiveMin?: number; maxTurns?: number };
          } | null;
          const fmtBinding = (b: unknown): string =>
            b === undefined || b === null ? "(跟随全局)" : typeof b === "string" ? b : JSON.stringify(b);
          const ovRows: [string, string][] = [
            ["对话档(dialog)", fmtBinding(ov?.models?.dialog)],
            ["沉思档(thinking)", fmtBinding(ov?.models?.thinking)],
            ["开发档(dev)", ov?.models?.dev ? `${ov.models.dev.agent}:${ov.models.dev.model}` : "(跟随全局)"],
            ["任务成本上限", ov?.budget?.maxCost !== undefined ? `${ov.budget.maxCost}` : "(跟随全局)"],
            ["活跃墙钟(分钟)", ov?.budget?.walltimeActiveMin !== undefined ? `${ov.budget.walltimeActiveMin}` : "(跟随全局)"],
            ["回合上限", ov?.budget?.maxTurns !== undefined ? `${ov.budget.maxTurns}` : "(跟随全局)"]
          ];
          return (
            <>
              <table style={{ width: "100%", fontSize: "var(--text-sm)", borderCollapse: "collapse" }} data-overrides-table>
                <tbody>
                  {ovRows.map(([k, v]) => (
                    <tr key={k} style={{ height: 40, borderTop: "1px solid var(--line)" }}>
                      <td style={{ color: "var(--text-muted)", width: 160 }}>{k}</td>
                      <td>
                        <Mono>{v}</Mono>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ margin: "10px 0 6px", fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
                覆盖存 daemon 受控表(不落 project.toml——仓库随附文件带 models 键会被拒,09 §11 白名单)。评估器不可覆盖;
                改完即对新会话/新派发生效。护栏:覆盖后的组合仍须评估器异族,违者拒存。
              </p>
              <button
                data-action="edit-overrides"
                disabled={isRemoteOrigin()}
                title={isRemoteOrigin() ? "覆盖只在受信终端改——回到桌面完成" : "以 JSON 编辑覆盖(留空清除)"}
                style={{
                  height: 34,
                  padding: "0 14px",
                  borderRadius: "var(--radius-xs)",
                  border: "1px solid var(--line)",
                  background: "var(--surface-control)",
                  color: "var(--text-primary)",
                  fontSize: "var(--text-sm)",
                  cursor: isRemoteOrigin() ? "not-allowed" : "pointer",
                  opacity: isRemoteOrigin() ? "var(--disabled-opacity)" : 1
                }}
                onClick={() => {
                  const current = JSON.stringify(ov ?? {}, null, 2);
                  const input = window.prompt(
                    '编辑项目覆盖 JSON(例 {"models":{"dev":{"agent":"cursor","model":"fable-5"}},"budget":{"maxCost":30}};{} 为清空):',
                    current
                  );
                  if (input === null) return;
                  setOvMsg(null);
                  try {
                    const parsed = JSON.parse(input) as Record<string, unknown>;
                    void api
                      .saveProjectOverrides(projectId, parsed)
                      .then(() => {
                        setOvMsg("已保存");
                        setRefresh((n) => n + 1);
                      })
                      .catch((e: Error) => setOvMsg(`保存被拒:${e.message}`));
                  } catch (e) {
                    setOvMsg(`JSON 不合法:${String(e).slice(0, 120)}`);
                  }
                }}
              >
                编辑覆盖
              </button>
              {ovMsg ? (
                <p data-overrides-msg style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                  {ovMsg}
                </p>
              ) : null}
            </>
          );
        })()}
      </PaperCard>
      <SectionTitle>知识底座(奠基)</SectionTitle>
      <PaperCard>
        <p style={{ margin: "0 0 10px", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
          奠基读取仓库关键文件生成知识底座(.saydo/knowledge/),重奠基产生新 generation 并使旧 Context Pack 失效重编译。
        </p>
        <button
          data-action="foundation-bootstrap"
          disabled={busy || isRemoteOrigin()}
          title={isRemoteOrigin() ? "奠基会写仓库文件,手机上不放行——回到桌面执行" : "读仓库关键文件,建/更新知识底座"}
          style={{
            height: 34,
            padding: "0 14px",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--active-ink-border)",
            background: "transparent",
            color: "var(--active-ink)",
            fontSize: "var(--text-sm)",
            cursor: busy || isRemoteOrigin() ? "not-allowed" : "pointer",
            opacity: busy || isRemoteOrigin() ? "var(--disabled-opacity)" : 1
          }}
          onClick={runBootstrap}
        >
          {busy ? "奠基中(读关键文件)" : "奠基 / 重奠基"}
        </button>
        {foundationView ? <FoundationBootstrapResultView result={foundationView} /> : null}
      </PaperCard>
      {/* 危险区(11 §5.8:单独分组 + error 描边) */}
      <div
        style={{
          border: "1px solid var(--color-error)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-4)"
        }}
        data-danger-zone
      >
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-error)" }}>危险区</p>
        <p style={{ margin: "6px 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          删除项目/撤回记忆(hard-forget)须二次确认;备份里的副本按保留期到期消失。
        </p>
      </div>
    </div>
  );
}
