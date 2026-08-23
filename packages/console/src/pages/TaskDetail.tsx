// 任务详情 = review 证据视图(#/p/:id/task/:tid;11 §5.5):
// 按 DecisionPackage.acceptance[] 分组的 AcceptanceCheck(pass/fail/unknown,禁伪精确);
// 操作行(接线批任务②接真实写口):验收通过/提修改("这轮不作废")/作废(取消链)/重试/取消
// + 合并(S3 组件=去屏幕确认,语音 UI 永不渲染 S3 批准按钮;P0 = requestManualMerge 人工合并交接);
// trust-report iframe 组件本步只建壳(P0.5-D 真实渲染);零外部跳转(深链 collapsed)。

import { useState } from "react";
import { renderTier1BlockedReason, type AcceptanceCheck } from "@saydo/contracts";
import { Check, CircleDashed, Fingerprint, ShieldAlert, X } from "lucide-react";
import { api, isRemoteOrigin, webauthnCreate, webauthnGet, type Row } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { ErrorCard, PaperCard, Mono, SectionTitle, CostText } from "../components/ui";
import { RiskBadge, RouteBadge, StatusChip } from "../components/StatusChip";
import { PackageDemoPreview } from "../components/redesign/DemoFrame";

interface Acceptance {
  text?: string;
  criterion?: string;
  verify?: { templateRef?: string };
}

export function acceptanceStateForCriterion(
  criterion: string,
  checks: AcceptanceCheck[]
): "pass" | "fail" | "unknown" {
  const matches = checks.filter((check) => check.criterion === criterion);
  if (matches.length !== 1) return "unknown";
  const check = matches[0]!;
  if (check.status !== "unknown" && !check.evidenceRef?.trim()) return "unknown";
  return check.status;
}

const CANCELABLE = ["confirmed", "queued", "running", "blocked", "paused_step_boundary", "ready_for_review"];

export function humanizeTier1RunEvidence(value: unknown): string | null {
  return renderTier1BlockedReason(value);
}

export function TaskDetail({ taskId }: { taskId: string }) {
  const [refresh, setRefresh] = useState(0);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [s3Busy, setS3Busy] = useState(false);
  // writing 逐条裁决态(criterion -> pass/fail);approve 载荷的一部分(11 §5.5)
  const [acVerdicts, setAcVerdicts] = useState<Record<string, "pass" | "fail">>({});
  const { data, error } = useAsync(() => api.taskDetail(taskId), [taskId, refresh]);
  // S3 卡渲染条件(11 §5.4):tailnet 不渲染(不发 status 请求——S3 面守卫本就会 403);
  // 未注册 passkey ⇒ 降级"去受信终端手动合并"+ 注册入口
  const { data: s3Status } = useAsync(
    () => (isRemoteOrigin() ? Promise.resolve(null) : api.s3Status().catch(() => null)),
    [refresh]
  );
  if (error) return <ErrorCard message="任务详情加载失败" detail={error} />;
  if (!data) return null;
  const task = (data["task"] ?? {}) as Row;
  const pkg = data["package"] as Row | null;
  const demoRefRaw = pkg?.["demoRef"];
  const demoRef =
    demoRefRaw && typeof demoRefRaw === "object"
      ? (demoRefRaw as { artifactId?: unknown; version?: unknown })
      : null;
  const demoRefOk =
    demoRef && typeof demoRef.artifactId === "string" && typeof demoRef.version === "number"
      ? { artifactId: demoRef.artifactId, version: demoRef.version }
      : null;
  const projectId = String(task["project_id"] ?? "");
  const runs = (data["runs"] ?? []) as Row[];
  const approvals = (data["approvals"] ?? []) as Row[];
  const costs = (data["costs"] ?? []) as Row[];
  const decisions = (data["decisions"] ?? []) as Row[];
  const writingProof = data["writingProof"] as { acceptanceChecks?: { criterion: string; source: string; status: string }[] } | null;
  const acceptanceChecks = (data["acceptanceChecks"] ?? []) as AcceptanceCheck[];
  const isWriting = String(task["project_type"] ?? "") === "writing" && writingProof !== null;
  const acceptance = ((pkg?.["acceptance"] as (string | Acceptance)[] | undefined) ?? []).map((a) =>
    typeof a === "string" ? a : a.text ?? a.criterion ?? JSON.stringify(a)
  );
  const status = String(task["status"]);
  const settled = status === "ready_for_review" || status === "review_approved_waiting_merge";
  const currentAttempt = runs.reduce((m, r) => Math.max(m, Number(r["attempt"] ?? 0)), 0);
  // W4 3.2 writing:manual 验收项逐条裁决(11 §5.5;settled ≠ 全绿——未逐条不给"验收通过")
  const manualCriteria = (writingProof?.acceptanceChecks ?? []).filter((c) => c.source === "manual").map((c) => c.criterion);
  const allManualDecided = manualCriteria.length > 0 && manualCriteria.every((c) => acVerdicts[c] !== undefined);

  const run = (fn: () => Promise<unknown>): void => {
    setActionMsg(null);
    void fn().then(
      (out) => {
        const handoff = (out as { handoffUrl?: string } | null)?.handoffUrl;
        setActionMsg(handoff ? `去受信终端合并;完成后 watcher 核验 treeSha 才记交付(${handoff})` : null);
        setRefresh((n) => n + 1);
      },
      (err: unknown) => setActionMsg(String(err instanceof Error ? err.message : err))
    );
  };

  return (
    <div className="flex flex-col gap-[var(--space-4)]" data-page="task-detail">
      <PaperCard strong>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[10px]">
            <h1 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 700 }}>{String(task["title"] ?? "")}</h1>
            <RouteBadge route={String(task["route"] ?? "tier1")} />
          </div>
          <StatusChip status={String(task["viewStatus"] ?? task["status"])} deadline={(task["parked_deadline"] as string) ?? null} />
        </div>
        <p style={{ margin: "6px 0 0" }}>
          <Mono>digest {String(task["package_digest"] ?? "").slice(-12) || "无"}</Mono>
        </p>
      </PaperCard>

      {demoRefOk && projectId ? (
        <PaperCard>
          <SectionTitle>决策包小样</SectionTitle>
          <PackageDemoPreview demoRef={demoRefOk} projectId={projectId} />
        </PaperCard>
      ) : null}

      {/* 证据视图:AC 分组 */}
      <PaperCard>
        <SectionTitle>验收标准</SectionTitle>
        {acceptance.length === 0 ? (
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>决策包未带验收标准</p>
        ) : isWriting && status === "ready_for_review" ? (
          // writing 逐条裁决(11 §5.5;09 §6.1a barrier ④):settled ≠ 全绿,manual 项必须人逐条 pass/fail
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }} data-acceptance-list data-writing-review>
            {acceptance.map((ac, i) => {
              const isManual = manualCriteria.includes(ac);
              const v = acVerdicts[ac];
              return (
                <li key={i} className="flex items-center justify-between gap-[8px]" style={{ padding: "8px 0", fontSize: "var(--text-sm)", borderTop: i > 0 ? "1px solid var(--line)" : "none" }}>
                  <span>{ac}</span>
                  {isManual ? (
                    <span className="flex items-center gap-[6px]" data-ac-verdict={ac}>
                      <button
                        style={verdictBtn(v === "pass", "var(--color-success)")}
                        data-ac-pass
                        onClick={() => setAcVerdicts((m) => ({ ...m, [ac]: "pass" }))}
                      >
                        通过
                      </button>
                      <button
                        style={verdictBtn(v === "fail", "var(--color-error)")}
                        data-ac-fail
                        onClick={() => setAcVerdicts((m) => ({ ...m, [ac]: "fail" }))}
                      >
                        不过
                      </button>
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-faint)", fontSize: "var(--text-xs)" }}>自动检查</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }} data-acceptance-list>
            {acceptance.map((ac, i) => {
              // 只消费 daemon 返回的逐条 AcceptanceCheck；task/run 终态不能代替 criterion 证据。
              const state = acceptanceStateForCriterion(ac, acceptanceChecks);
              return (
                <li key={i} className="flex items-center gap-[8px]" style={{ padding: "6px 0", fontSize: "var(--text-sm)" }}>
                  {state === "pass" ? (
                    <Check size={16} color="var(--color-success)" aria-label="通过" />
                  ) : state === "fail" ? (
                    <X size={16} color="var(--color-error)" aria-label="未过" />
                  ) : (
                    <CircleDashed size={16} color="var(--text-muted)" aria-label="未验证" />
                  )}
                  <span>{ac}</span>
                  {state === "unknown" ? <span style={{ color: "var(--text-faint)", fontSize: "var(--text-xs)" }}>未验证</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </PaperCard>

      {/* W5a 3.2:decisions 区(11 §5.5 证据视图内;与语音 explainResult 同源读 tier1_runs.decisions_json) */}
      <PaperCard>
        <SectionTitle>agent 自主决策</SectionTitle>
        {decisions.length === 0 ? (
          <div className="flex items-center gap-[var(--space-3)]">
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }} data-decisions-empty>
              还没提炼(每条决策含理由,均可推翻)
            </p>
            {runs.length > 0 ? (
              <button
                style={secondaryBtn}
                data-action="distill-decisions"
                onClick={() => run(() => api.explainTask(taskId, "decisions"))}
              >
                提炼决策
              </button>
            ) : null}
          </div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }} data-decisions-list>
            {decisions.map((d, i) => (
              <li key={i} style={{ padding: "6px 0", fontSize: "var(--text-sm)", borderTop: i > 0 ? "1px solid var(--line)" : "none" }}>
                <div className="flex items-center gap-[8px]">
                  <span style={{ fontWeight: 600 }}>{String(d["what"] ?? "")}</span>
                  <span style={{ color: "var(--text-faint)", fontSize: "var(--text-xs)", border: "1px solid var(--line)", borderRadius: "var(--radius-xs)", padding: "0 6px" }}>
                    可推翻
                  </span>
                </div>
                <p style={{ margin: "2px 0 0", color: "var(--text-muted)" }}>理由:{String(d["why"] ?? "")}</p>
              </li>
            ))}
          </ul>
        )}
      </PaperCard>

      {/* runs */}
      <PaperCard>
        <SectionTitle>执行记录</SectionTitle>
        {runs.length === 0 ? (
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>还没跑过</p>
        ) : (
          <table style={{ width: "100%", fontSize: "var(--text-sm)", borderCollapse: "collapse" }}>
            <tbody>
              {runs.map((r) => (
                <tr key={String(r["id"])} style={{ height: 40, borderTop: "1px solid var(--line)" }}>
                  <td>第 {String(r["attempt"])} 次</td>
                  <td>
                    <Mono>{String(r["adapter"])}</Mono>
                  </td>
                  <td>
                    <div>{String(r["state"])}</div>
                    {r["evidence_conflict"] === true ? (
                      <div data-tier1-evidence-conflict style={{ fontSize: "var(--text-xs)", color: "var(--color-error)" }}>
                        终态证据冲突,本行不合并展示
                      </div>
                    ) : humanizeTier1RunEvidence(r["exit_evidence"]) ? (
                      <div data-tier1-run-reason style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                        {humanizeTier1RunEvidence(r["exit_evidence"])}
                      </div>
                    ) : null}
                  </td>
                  <td data-observed-model>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>观测模型</div>
                    <Mono>{String(r["observed_model"] ?? "未观测")}</Mono>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Mono>{String(r["tree_sha"] ?? "").slice(0, 8) || "-"}</Mono>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PaperCard>

      {/* 审批记录(内嵌;04 §5.2 必带上下文——本页即上下文) */}
      <PaperCard>
        <SectionTitle>审批记录</SectionTitle>
        {approvals.length === 0 ? (
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>无</p>
        ) : (
          <div className="flex flex-col gap-[6px]">
            {approvals.map((a) => (
              <div key={String(a["id"])} className="flex items-center gap-[10px]" style={{ fontSize: "var(--text-sm)" }}>
                <RiskBadge risk={String(a["risk"])} />
                <span>{String(a["kind"])}</span>
                <Mono>{String(a["decided_via"])}</Mono>
                <span style={{ color: "var(--text-muted)" }}>{String(a["outcome"])}</span>
              </div>
            ))}
          </div>
        )}
      </PaperCard>

      {/* 成本 */}
      <PaperCard>
        <SectionTitle>成本</SectionTitle>
        {costs.length === 0 ? (
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>还没有确切数字</p>
        ) : (
          <div className="flex flex-col gap-[4px]">
            {costs.map((c, i) => (
              <div key={i} className="flex justify-between" style={{ fontSize: "var(--text-sm)" }}>
                <Mono>{String(c["kind"])}</Mono>
                <CostText known={c["known"] === 1} amount={(c["amount"] as number) ?? null} source={String(c["source"] ?? "")} currency={(c["currency"] as string) ?? null} />
              </div>
            ))}
          </div>
        )}
      </PaperCard>

      {/* trust-report iframe 壳(P0.5-D 真实渲染;P0 无 Hopper 任务可验) */}
      {String(task["route"]) === "hopper" ? (
        <PaperCard>
          <SectionTitle>执行报告</SectionTitle>
          <iframe title="trust-report" sandbox="allow-same-origin" style={{ width: "100%", height: 320, border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }} data-trust-report-shell />
        </PaperCard>
      ) : null}

      {/* 操作行(11 §5.5;接线批任务②接真实写口):按状态渲染可用动作 */}
      {settled || status === "failed" || status === "blocked" || CANCELABLE.includes(status) ? (
        <PaperCard>
          <div className="flex flex-wrap items-center gap-[var(--space-3)]" data-review-actions>
            {status === "ready_for_review" ? (
              <>
                <button
                  style={{ ...secondaryBtn, cursor: isWriting && !allManualDecided ? "not-allowed" : "pointer", opacity: isWriting && !allManualDecided ? "var(--disabled-opacity)" : 1 }}
                  data-action="approve"
                  disabled={isWriting && !allManualDecided}
                  title={isWriting && !allManualDecided ? "先逐条裁决每个验收项(settled 不等于全绿)" : "验收通过"}
                  onClick={() =>
                    run(() =>
                      api.reviewTask(taskId, {
                        verdict: "approve",
                        expectedAttempt: currentAttempt,
                        ...(isWriting ? { acceptanceVerdicts: manualCriteria.map((c) => ({ criterion: c, status: acVerdicts[c] as "pass" | "fail" })) } : {})
                      })
                    )
                  }
                >
                  验收通过
                </button>
                <button
                  style={secondaryBtn}
                  data-action="request-changes"
                  onClick={() => {
                    const comments = window.prompt("要改什么?(这轮不作废,同任务新 attempt 接着改)") ?? undefined;
                    if (comments === undefined) return;
                    run(() => api.reviewTask(taskId, { verdict: "request_changes", expectedAttempt: currentAttempt, comments }));
                  }}
                >
                  提修改(这轮不作废)
                </button>
                <button
                  style={dangerBtn}
                  data-action="reject"
                  onClick={() => {
                    if (!window.confirm("作废这轮?改过的东西留在工作区没动,想捡回来可以再说。")) return;
                    run(() => api.reviewTask(taskId, { verdict: "reject", expectedAttempt: currentAttempt }));
                  }}
                >
                  作废这轮
                </button>
              </>
            ) : null}
            {settled && isRemoteOrigin() ? (
              // tailnet/远程来源:一律不渲染 S3 卡(09 §3.3 红线②;11 §5.4),置引导回桌面
              <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }} data-s3-remote-guide>
                合并是 S3 操作,手机上不放行——请回桌面受信终端完成;手机端可以看任务、批执行中的 S2 审批。
              </p>
            ) : null}
            {settled && !isRemoteOrigin() ? (
              // S3 组件组(11 §5.4/§5.5):主路径 = 用本机认证批准合并(WebAuthn,认证 UI 由 OS 提供);
              // 未注册 passkey ⇒ 降级"去受信终端手动合并"(requestManualMerge);批准前置灰。
              <button
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  height: 36,
                  padding: "0 16px",
                  borderRadius: "var(--radius-xs)",
                  border: "1px solid var(--color-error)",
                  background: "transparent",
                  color: "var(--color-error)",
                  fontSize: "var(--text-sm)",
                  cursor: status === "review_approved_waiting_merge" && !s3Busy ? "pointer" : "not-allowed",
                  opacity: status === "review_approved_waiting_merge" && !s3Busy ? 1 : "var(--disabled-opacity)"
                }}
                data-s3-merge
                data-s3-mode={s3Status?.registered ? "webauthn" : "manual-fallback"}
                disabled={status !== "review_approved_waiting_merge" || s3Busy}
                title={
                  status !== "review_approved_waiting_merge"
                    ? "先验收通过,批准后才可合并"
                    : s3Status?.registered
                      ? "本机认证系统弹窗确认后,daemon 本地合并"
                      : "未注册本机认证凭据:去受信终端人工合并(或先注册凭据)"
                }
                onClick={() => {
                  if (!s3Status?.registered) {
                    run(() => api.requestManualMerge(taskId));
                    return;
                  }
                  // WebAuthn 三步(09 §3.3 签发链):挑战 -> OS 本机认证断言 -> 收据 -> approveMerge
                  if (location.hostname === "127.0.0.1") {
                    setActionMsg("S3 卡须经 http://localhost 访问(rpId 绑定);请用 localhost 打开本页。");
                    return;
                  }
                  setS3Busy(true);
                  setActionMsg(null);
                  void (async () => {
                    try {
                      const ch = await api.s3Challenge({ action: "merge", taskId });
                      if (!ch.allowCredentialId) throw new Error("无活跃本机认证凭据");
                      const assertion = await webauthnGet(ch.challenge, ch.rpId, ch.allowCredentialId);
                      const v = await api.s3Verify(ch.challengeId, assertion);
                      await api.approveMerge(taskId, v.receiptId);
                      setActionMsg("已批准,daemon 正在本地合并(rebase + 重跑 verify + 树对账)…");
                      setRefresh((n) => n + 1);
                      setTimeout(() => setRefresh((n) => n + 1), 2500); // 捡 merge 执行段结果
                    } catch (e) {
                      // 失败/超时/被打断:error 提示不放行;挑战单次消费已作废,重点重签(09 §3.3)
                      setActionMsg(`本机认证批准未完成:${String(e instanceof Error ? e.message : e)}`);
                    } finally {
                      setS3Busy(false);
                    }
                  })();
                }}
              >
                {s3Status?.registered ? <Fingerprint size={16} aria-hidden /> : <ShieldAlert size={16} aria-hidden />}
                {s3Status?.registered ? "用本机认证批准合并" : "合并(去屏幕强认证)"}
              </button>
            ) : null}
            {settled && !isRemoteOrigin() && !s3Status?.registered ? (
              // 注册入口(一次性 bootstrap;owner 亲自在受信终端)——注册后主路径变本机认证
              <button
                style={secondaryBtn}
                data-s3-register
                disabled={s3Busy}
                onClick={() => {
                  if (location.hostname === "127.0.0.1") {
                    setActionMsg("注册须经 http://localhost 访问(rpId 绑定);请用 localhost 打开本页。");
                    return;
                  }
                  setS3Busy(true);
                  setActionMsg(null);
                  void (async () => {
                    try {
                      const ch = await api.s3Challenge({ action: "register" });
                      const attestation = await webauthnCreate(ch.challenge, ch.rpId);
                      await api.s3Register(ch.challengeId, attestation);
                      setActionMsg("本机认证凭据已注册;现在可以用本机认证批准合并了。");
                      setRefresh((n) => n + 1);
                    } catch (e) {
                      setActionMsg(`注册未完成:${String(e instanceof Error ? e.message : e)}`);
                    } finally {
                      setS3Busy(false);
                    }
                  })();
                }}
              >
                <Fingerprint size={16} aria-hidden />
                注册本机认证凭据
              </button>
            ) : null}
            {settled && !isRemoteOrigin() && s3Status?.registered ? (
              // 降级路径保留(11 §5.5:未注册/不可用/owner 选人工;已注册时作为次要入口)
              <button
                style={secondaryBtn}
                data-action="request-manual-merge"
                disabled={status !== "review_approved_waiting_merge"}
                onClick={() => run(() => api.requestManualMerge(taskId))}
              >
                去受信终端手动合并
              </button>
            ) : null}
            {status === "review_approved_waiting_merge" && !isRemoteOrigin() ? (
              // MergeProof 核验(按需触发形态):owner 受信终端合并后点此,daemon 从主仓 git 现读
              // treeSha 对账批准时落库值(不信人工输入;不匹配拒推进,防已回滚显示完成)
              <button style={secondaryBtn} data-action="verify-merge" onClick={() => run(() => api.verifyMerge(taskId))}>
                我已合并,核验
              </button>
            ) : null}
            {status === "failed" || status === "blocked" ? (
              <button
                style={secondaryBtn}
                data-action="retry"
                onClick={() => {
                  const message = window.prompt(status === "blocked" ? "回答 agent 的问题(一答一 run):" : "重派发前要补充什么?(可留空)") ?? undefined;
                  if (message === undefined) return;
                  run(() => api.retryTask(taskId, message === "" ? undefined : message));
                }}
              >
                {status === "failed" ? "重试(重新排队)" : "答复并继续"}
              </button>
            ) : null}
            {CANCELABLE.includes(status) ? (
              <button
                style={dangerBtn}
                data-action="cancel"
                onClick={() => {
                  if (!window.confirm("取消这个任务?执行侧确认后才算停。")) return;
                  run(() => api.cancelTask(taskId));
                }}
              >
                取消任务
              </button>
            ) : null}
          </div>
          {actionMsg ? (
            <p style={{ margin: "8px 0 0", fontSize: "var(--text-sm)", color: "var(--text-muted)" }} data-action-msg>
              {actionMsg}
            </p>
          ) : null}
          {settled && !isRemoteOrigin() ? (
            // 诚实注脚(09 §3.3 同步凭据条款 ②;11 §5.4 逐字):不宣称"密钥永不离开本机"
            <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--text-faint)" }} data-s3-honesty-note>
              用于本机认证的 passkey 可能经系统账号同步到你的其他设备;批准动作本身只能在这台电脑完成。
            </p>
          ) : null}
        </PaperCard>
      ) : null}
    </div>
  );
}

const dangerBtn: React.CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--color-error)",
  background: "transparent",
  color: "var(--color-error)",
  fontSize: "var(--text-sm)",
  cursor: "pointer"
};

const secondaryBtn: React.CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--line)",
  background: "var(--surface-control)",
  color: "var(--text-primary)",
  fontSize: "var(--text-sm)",
  cursor: "pointer"
};

/** writing 逐条裁决按钮(选中态描边高亮) */
function verdictBtn(active: boolean, color: string): React.CSSProperties {
  return {
    height: 28,
    padding: "0 10px",
    borderRadius: "var(--radius-xs)",
    border: `1px solid ${active ? color : "var(--line)"}`,
    background: active ? color : "transparent",
    color: active ? "var(--fg-on-fill)" : "var(--text-secondary)",
    fontSize: "var(--text-xs)",
    cursor: "pointer"
  };
}
