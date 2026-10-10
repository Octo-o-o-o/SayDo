// 此面只管理登记；不接收 peer 业务效果，不共享 Owner CAP 给 Anyvia。
import type { IncomingMessage, ServerResponse } from "node:http";
import { ZodError } from "zod";
import { readJsonBody } from "../httpJsonBody.js";
import type { PersonalContextKeyCustody } from "../personalContext/keyCustody.js";
import type { PersonalContextRegistry } from "../personalContext/registry.js";
import type { PersonalContextSessionSupervisor } from "../personalContext/sessionSupervisor.js";

export async function handlePersonalContextOwnerApi(
  req: IncomingMessage, res: ServerResponse, registry: PersonalContextRegistry,
  authorizeLocalOwner: () => boolean,
  keys?: PersonalContextKeyCustody,
  sessions?: PersonalContextSessionSupervisor,
): Promise<void> {
  const reply = (status: number, value: unknown): void => {
    if (res.writableEnded || res.headersSent) return;
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(value));
  };
  try {
    if (!authorizeLocalOwner()) { reply(403, { ok: false, code: "local_owner_required" }); return; }
    const path = (req.url ?? "").split("?")[0];
    if (req.method === "GET" && path === "/api/personal-context/sessions") {
      if (!sessions) throw Error("personal_context_session_platform_unavailable");
      reply(200, { ok: true, sessions: sessions.list() }); return;
    }
    if (req.method === "GET" && path === "/api/personal-context/registrations") {
      reply(200, { ok: true, ...registry.list() as object }); return;
    }
    if (req.method !== "POST") { reply(405, { ok: false, code: "method_not_allowed" }); return; }
    const routes = new Set(["/api/personal-context/sessions/open", "/api/personal-context/sessions/close", "/api/personal-context/keys/provision", "/api/personal-context/registrations", "/api/personal-context/registrations/change", "/api/personal-context/permissions", "/api/personal-context/permissions/revoke"]);
    if (!path || !routes.has(path)) { reply(404, { ok: false, code: "route_not_found" }); return; }
    const body = await readJsonBody(req, res, 8192);
    if (body.status === "failed") return;
    // 接收正文可能等待；在实际写入之前再走原身份门。
    if (!authorizeLocalOwner()) { reply(403, { ok: false, code: "local_owner_required" }); return; }
    let result: unknown;
    if (path === "/api/personal-context/sessions/open" || path === "/api/personal-context/sessions/close") {
      if (!sessions) throw Error("personal_context_session_platform_unavailable");
      result = path.endsWith("/open") ? await sessions.open(body.value) : await sessions.close(body.value);
    } else if (path === "/api/personal-context/keys/provision") {
      if (!keys) throw Error("personal_context_key_platform_unavailable");
      result = keys.provision(body.value);
    } else if (path === "/api/personal-context/registrations") result = registry.register(body.value);
    else if (path === "/api/personal-context/registrations/change") {
      let failure: unknown, failed = false;
      try { result = registry.change(body.value); } catch (error) { failure = error; failed = true; }
      try { await sessions?.settleInvalidated(); } catch (error) { if (failed) throw new AggregateError([failure, error], "personal_context_registration_and_cleanup_failed"); throw error; }
      if (failed) throw failure;
    }
    else if (path === "/api/personal-context/permissions") result = registry.grant(body.value);
    else { registry.revokePermission(body.value); result = {}; }
    reply(200, { ok: true, result });
  } catch (error) {
    // 不向 HTTP/日志回显公钥输入、路径、SQL 或业务正文。
    const code = error instanceof ZodError ? "invalid_input" : error instanceof Error && /^personal_context_[a-z_]+$/u.test(error.message) ? error.message : "personal_context_registry_rejected";
    reply(error instanceof ZodError ? 400 : 409, { ok: false, code });
  }
}
