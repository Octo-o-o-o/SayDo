// 决策包 Demo 小样:iframe srcdoc + sandbox=""(零 allow,禁脚本);不把 token 放 URL。

import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { Btn } from "./shared";

export function DemoFrame({ html, projectId }: { html: string; projectId?: string }) {
  return (
    <div data-demo-frame-wrap>
      <iframe
        title="决策包小样"
        sandbox=""
        srcDoc={html}
        style={{
          width: "100%",
          height: 480,
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface)"
        }}
        data-demo-frame
      />
      {projectId ? (
        <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)" }}>
          <a href={`#/p/${projectId}/artifacts`} data-demo-artifacts-link>
            在产物库查看
          </a>
        </p>
      ) : null}
    </div>
  );
}

/** 读口成功体 → 仅 type=demo 才进 srcDoc */
export function applyDemoFetchResult(r: { artifact?: { type?: unknown }; content?: unknown }): {
  html: string | null;
  err: string | null;
} {
  if (r.artifact?.type !== "demo" || typeof r.content !== "string") {
    return { html: null, err: "这份产物不是决策包小样" };
  }
  return { html: r.content, err: null };
}

export type DemoRequestEpoch = { id: number };

/** 仅当前请求可改 html/err/loading;旧成功/失败都返回 undefined。 */
export function applyOwnedDemoFetch(
  epoch: DemoRequestEpoch,
  current: DemoRequestEpoch,
  result: { artifact?: { type?: unknown }; content?: unknown }
): { html: string | null; err: string | null } | undefined {
  if (epoch.id !== current.id) return undefined;
  return applyDemoFetchResult(result);
}

export function applyOwnedDemoFailure(
  epoch: DemoRequestEpoch,
  current: DemoRequestEpoch,
  error: unknown
): { html: null; err: string } | undefined {
  if (epoch.id !== current.id) return undefined;
  return { html: null, err: error instanceof Error ? error.message : String(error) };
}

export function DemoPreviewStatus({
  err,
  html,
  projectId
}: {
  err: string | null;
  html: string | null;
  projectId: string;
}) {
  return (
    <>
      {err ? (
        <p style={{ margin: "6px 0 0", fontSize: "var(--text-xs)", color: "var(--color-error)" }} data-demo-error>
          {err}
        </p>
      ) : null}
      {html ? (
        <div style={{ marginTop: "var(--space-3)" }}>
          <DemoFrame html={html} projectId={projectId} />
        </div>
      ) : null}
    </>
  );
}

export function PackageDemoPreview({
  demoRef,
  projectId
}: {
  demoRef: { artifactId: string; version: number };
  projectId: string;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const epochRef = useRef(0);

  useEffect(() => {
    epochRef.current += 1;
    setHtml(null);
    setErr(null);
    setLoading(false);
    return () => {
      epochRef.current += 1;
    };
  }, [demoRef.artifactId, demoRef.version, projectId]);

  const open = (): void => {
    const epoch = { id: ++epochRef.current };
    setErr(null);
    setLoading(true);
    void api
      .getArtifactContent(demoRef.artifactId, demoRef.version, projectId)
      .then((r) => {
        const next = applyOwnedDemoFetch(epoch, { id: epochRef.current }, r);
        if (!next) return;
        setHtml(next.html);
        setErr(next.err);
        setLoading(false);
      })
      .catch((e: unknown) => {
        const next = applyOwnedDemoFailure(epoch, { id: epochRef.current }, e);
        if (!next) return;
        setHtml(next.html);
        setErr(next.err);
        setLoading(false);
      });
  };
  return (
    <div data-demo-preview data-demo-loading={loading ? "true" : "false"} style={{ marginTop: "var(--space-3)" }}>
      <Btn onClick={open} disabled={loading} style={{ minHeight: 40, minWidth: 40 }}>
        看小样
      </Btn>
      <DemoPreviewStatus err={err} html={html} projectId={projectId} />
    </div>
  );
}
