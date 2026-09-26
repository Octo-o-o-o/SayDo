// 本地 OpenAI 兼容 scripted provider。标注:确定性剧本,不是云模型验收。
// dialog 带 tools 按最后一条消息形状走剧本;thinking/cheap 不计入 dialog。
// 采访走生产 remember(readinessKey)+confirmReadiness,不预置绑定。
// B4 原根因(采访前植入就绪)本包只关联记录,不清零。

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { CLAIM, LLM_LOG, LLM_PORT } from "./constants.js";

const DRAFT = {
  outcomePreview: "README 安装一节带 pnpm 说明",
  inScope: ["README 安装小节"],
  outOfScope: ["其他文档"],
  acceptance: ["安装一节出现 pnpm install 示例", "现有 npm 说明保留"],
  plan: [{ seq: 1, step: "改 README 安装小节", owner: "ai" }],
  risks: [] as string[]
};

const READINESS_KEYS = ["goal", "acceptance", "scope", "codebase_understood"] as const;

const READINESS_CLAIMS: Record<(typeof READINESS_KEYS)[number], string> = {
  goal: "目标是给 README 安装一节补 pnpm 说明",
  acceptance: "验收是安装一节出现 pnpm install 示例,并且现有 npm 说明保留",
  scope: "范围只改 README 安装小节",
  codebase_understood: "我已经看过仓库里现有的 npm 安装说明"
};

type Pack = {
  packageId: string;
  revision: number;
  taskDraftId: string;
  remembered: boolean;
  readinessPresented: boolean;
};

function harvestPack(messages: Array<{ role?: string; content?: unknown }>, pack: Pack): void {
  for (const m of messages) {
    if (m?.role !== "tool") continue;
    try {
      const row = JSON.parse(String(m.content ?? "{}")) as Record<string, unknown>;
      if (typeof row["packageId"] === "string" && row["packageId"]) pack.packageId = row["packageId"];
      if (typeof row["revision"] === "number") pack.revision = row["revision"];
      if (typeof row["taskDraftId"] === "string" && row["taskDraftId"]) pack.taskDraftId = row["taskDraftId"];
    } catch {
      // 坏 tool 结果不进剧本状态
    }
  }
}

function lastOfRole(
  messages: Array<{ role?: string; content?: unknown }>,
  role: string
): { role?: string; content?: unknown } | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === role) return messages[i];
  }
  return undefined;
}

function countMemIds(messages: Array<{ role?: string; content?: unknown }>): number {
  let n = 0;
  for (const m of messages) {
    if (m?.role !== "tool") continue;
    try {
      const row = JSON.parse(String(m.content ?? "{}")) as Record<string, unknown>;
      if (typeof row["memId"] === "string" && row["memId"]) n += 1;
    } catch {
      // 忽略坏回执
    }
  }
  return n;
}

function journeyReply(
  messages: Array<{ role?: string; content?: unknown }>,
  pack: Pack
): {
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
} {
  harvestPack(messages, pack);
  const last = messages[messages.length - 1];
  const lastUser = String(lastOfRole(messages, "user")?.content ?? "");
  const lastTool = last?.role === "tool" ? last : undefined;
  let lastToolRow: Record<string, unknown> = {};
  if (lastTool) {
    try {
      lastToolRow = JSON.parse(String(lastTool.content ?? "{}")) as Record<string, unknown>;
    } catch {
      lastToolRow = {};
    }
  }

  const tool = (id: string, name: string, args: unknown) => ({
    id,
    type: "function" as const,
    function: { name, arguments: JSON.stringify(args) }
  });

  if (lastTool) {
    if (lastToolRow["ok"] === false) {
      return { content: "这一步没做成,我对着屏幕再看一眼。" };
    }
    if (typeof lastToolRow["taskDraftId"] === "string" && lastToolRow["packageId"] === undefined) {
      return {
        content: null,
        tool_calls: [tool("c2", "proposeStart", { taskDraftId: lastToolRow["taskDraftId"] })]
      };
    }
    if (typeof lastToolRow["packageId"] === "string") {
      return { content: "我这边评估过了,可以开始了。做完你会得到:README 安装一节带 pnpm 说明。预计封顶 20 元。" };
    }
    if (Array.isArray(lastToolRow["presented"])) {
      pack.readinessPresented = true;
      return { content: "请在屏幕上核对刚才记下的几条。" };
    }
    if (!pack.readinessPresented && countMemIds(messages) > 0) {
      pack.readinessPresented = true;
      return { content: null, tool_calls: [tool("r1", "confirmReadiness", {})] };
    }
    if (lastToolRow["confirmationPresented"] === true || typeof lastToolRow["receiptId"] === "string") {
      return { content: "收到。" };
    }
    if (lastToolRow["ok"] === true && (typeof lastToolRow["eventId"] === "string" || lastToolRow["tier"] === "M0")) {
      return { content: "记下了。" };
    }
  }

  if (lastUser.includes("按记住的偏好")) return { content: "按你记住的偏好继续。" };
  if (lastUser.includes("以后发布前不用再问")) {
    return {
      content: null,
      tool_calls: [tool("m0", "remember", { tier: "M0", claim: CLAIM, trust: "user_stated" })]
    };
  }
  if (lastUser.includes("开始吧")) {
    return {
      content: null,
      tool_calls: [tool("c3", "issueDispatchReceipt", { packageId: pack.packageId, revision: pack.revision })]
    };
  }
  if (lastUser.includes("出包") || lastUser.includes("按刚才说的")) {
    return {
      content: null,
      tool_calls: [
        tool("c1", "createTask", {
          rawPoints: [
            READINESS_CLAIMS.goal,
            READINESS_CLAIMS.acceptance,
            READINESS_CLAIMS.scope,
            READINESS_CLAIMS.codebase_understood
          ]
        })
      ]
    };
  }
  if (lastUser.includes("目标是") || lastUser.includes("我已经看过") || lastUser.includes("验收是")) {
    if (!pack.remembered) {
      pack.remembered = true;
      return {
        content: null,
        tool_calls: READINESS_KEYS.map((key, i) =>
          tool(`k${i}`, "remember", {
            tier: key === "codebase_understood" ? "M2" : "M1",
            claim: READINESS_CLAIMS[key],
            trust: "user_stated",
            readinessKey: key
          })
        )
      };
    }
    return { content: "请在屏幕上核对刚才记下的几条。说一声出包我就立项。" };
  }
  if (lastUser.includes("README") || lastUser.includes("pnpm")) {
    return { content: "受众是谁？\n1. 商业\n2. 内部" };
  }
  return { content: "按你记住的偏好继续。" };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function startScriptedLlm(opts: { port: number; logPath: string }): Promise<{ close: () => Promise<void> }> {
  mkdirSync(dirname(opts.logPath), { recursive: true });
  const pack: Pack = { packageId: "", revision: 0, taskDraftId: "", remembered: false, readinessPresented: false };
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, fixture: "scripted-llm" }));
        return;
      }
      if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "not_found" }));
        return;
      }
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}") as {
        model?: string;
        messages?: Array<{ role?: string; content?: unknown }>;
        tools?: unknown[];
        response_format?: { type?: string; json_schema?: { schema?: { required?: string[] } } };
      };
      const model = typeof body.model === "string" && body.model !== "" ? body.model : "gpt-4o-mini";
      const hasTools = Array.isArray(body.tools) && body.tools.length > 0;
      const required = body.response_format?.json_schema?.schema?.required ?? [];
      const isDraft = required.includes("outcomePreview");
      appendFileSync(
        opts.logPath,
        `${JSON.stringify({
          at: new Date().toISOString(),
          model,
          hasTools,
          isDraft,
          messages: body.messages ?? []
        })}\n`
      );

      let message: { role: "assistant"; content: string | null; tool_calls?: unknown };
      if (isDraft || (!hasTools && body.response_format)) {
        message = { role: "assistant", content: isDraft ? JSON.stringify(DRAFT) : JSON.stringify({ ok: true }) };
      } else if (hasTools) {
        const reply = journeyReply(body.messages ?? [], pack);
        message = { role: "assistant", content: reply.content, ...(reply.tool_calls ? { tool_calls: reply.tool_calls } : {}) };
      } else {
        message = { role: "assistant", content: "我理解要做:README 安装一节补 pnpm 说明。对吗?" };
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "chatcmpl-journey01-scripted",
          model,
          choices: [
            {
              index: 0,
              finish_reason: message.tool_calls ? "tool_calls" : "stop",
              message
            }
          ]
        })
      );
    })().catch((err: unknown) => {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }));
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, "127.0.0.1", () => {
      resolve({
        close: () =>
          new Promise((done, fail) => {
            server.close((err) => (err ? fail(err) : done()));
          })
      });
    });
  });
}

if (process.argv[1] && process.argv[1].endsWith("scripted-llm.ts")) {
  const port = Number(process.env["SCRIPT_LLM_PORT"] ?? LLM_PORT);
  const logPath = process.env["SCRIPT_LLM_LOG"] ?? LLM_LOG;
  void startScriptedLlm({ port, logPath }).then(() => {
    process.stdout.write(`scripted-llm listening ${port}\n`);
  });
}
