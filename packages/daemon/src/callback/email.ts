// EMAIL-A 阶段 A(候选):回叫升级链 L1 的邮件出站通道(与 ntfy 并列可选,任一配置即启用;05 决策单第 11 节)。
// 红线沿用 ntfy 通道:标题/正文经 redactText;深链只带路由不带 capability token;
// 话术按 10 §1 状态词(ready_for_review = "执行和检查都跑完了,等你验收",绝不说"完成/交付")。
// 只发 ready_for_review / blocked / failed / approval_request;每任务一线程(Message-ID / In-Reply-To / References,
// 线程锚落 callback_outbox.thread_message_id,DDL v32 additive)。
// SMTP submission:587 STARTTLS(缺省)或 465 隐式 TLS;AUTH PLAIN;客户端只用 node:net / node:tls,不新增依赖。
// 凭据(SMTP_PASSWORD)经 /api/setup/secret 白名单落 .env(0600),永不进日志/审计/邮件正文。

import { createConnection } from "node:net";
import { connect as tlsConnect } from "node:tls";
import type { Db } from "../storage/db.js";
import { redactText } from "../voice/redactor.js";
import { renderNtfyMessage, type OutboxRowForNotify } from "./ntfy.js";

export const EMAIL_TRIGGERS: ReadonlySet<string> = new Set(["ready_for_review", "blocked", "failed", "approval_request"]);

export interface EmailTarget {
  host: string;
  port: number;
  /** starttls = 明文连上后 STARTTLS 升级(587);tls = 隐式 TLS(465) */
  mode: "starttls" | "tls";
  user?: string;
  pass?: string;
  from: string;
  to: string;
}

/** 三键必填(SMTP_HOST / SMTP_FROM / EMAIL_TO),缺任一即"未配置";SMTP_PORT 缺省 587;465 或 SMTP_SECURITY=tls 走隐式 TLS */
export function resolveEmailTarget(env: Record<string, string | undefined>): EmailTarget | null {
  const host = env["SMTP_HOST"]?.trim();
  const from = env["SMTP_FROM"]?.trim();
  const to = env["EMAIL_TO"]?.trim();
  if (!host || !from || !to) return null;
  const portRaw = env["SMTP_PORT"]?.trim();
  const port = portRaw ? Number(portRaw) : 587;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;
  const mode: EmailTarget["mode"] = env["SMTP_SECURITY"]?.trim() === "tls" || port === 465 ? "tls" : "starttls";
  const user = env["SMTP_USER"]?.trim();
  const pass = env["SMTP_PASSWORD"];
  return { host, port, mode, ...(user ? { user } : {}), ...(pass ? { pass } : {}), from, to };
}

export interface EmailMessage {
  subject: string;
  text: string;
  /** 深链(只带路由,无 token) */
  click: string;
  messageId: string;
  inReplyTo?: string;
  references?: string[];
}

/** Message-ID = <entryId@发件域>;发件域取不到时用 saydo.local */
export function emailMessageId(entryId: string, from: string): string {
  const domain = from.split("@")[1]?.replace(/[<>\s]/g, "") || "saydo.local";
  return `<${entryId}@${domain}>`;
}

/** 同任务已发邮件的线程锚(按发送先后);排除自身 */
export function previousThreadIds(db: Db, taskId: string, excludeEntryId: string): string[] {
  const rows = db
    .prepare(
      `SELECT thread_message_id FROM callback_outbox
       WHERE task_id = ? AND thread_message_id IS NOT NULL AND id <> ?
       ORDER BY updated_at, created_at`
    )
    .all(taskId, excludeEntryId) as { thread_message_id: string }[];
  return rows.map((r) => r.thread_message_id);
}

/** 渲染邮件:复用 ntfy 渲染(标题经 redactor、正文固定话术、深链无 token);非四类事件返回 null(不发) */
export function renderEmailMessage(
  db: Db,
  entry: OutboxRowForNotify,
  opts: { consoleBase: string; from: string }
): EmailMessage | null {
  if (!EMAIL_TRIGGERS.has(entry.trigger)) return null;
  const base = renderNtfyMessage(db, entry, { consoleBase: opts.consoleBase });
  const prior = previousThreadIds(db, entry.task_id, entry.id);
  const subject = redactText(prior.length > 0 ? `Re: ${base.title}` : base.title);
  // 阻塞原因来自 renderTier1BlockedReason 的登记模板,仍整体过一遍 redactor(与 TTS 同族外呼面)
  const text = redactText(`${base.body}\n\n打开:${base.click}\n\n(SayDo 自动回叫邮件,请勿直接回复)`);
  const last = prior[prior.length - 1];
  return {
    subject,
    text,
    click: base.click,
    messageId: emailMessageId(entry.id, opts.from),
    ...(last ? { inReplyTo: last, references: prior } : {})
  };
}

// ---------------- 最小 SMTP submission 客户端 ----------------

/** 可注入的 socket 面(node:net.Socket / node:tls.TLSSocket 天然满足;测试用假 socket) */
export interface SmtpSocket {
  write(data: string): unknown;
  on(event: "data", cb: (chunk: Buffer | string) => void): unknown;
  on(event: "error", cb: (err: Error) => void): unknown;
  on(event: "close", cb: () => void): unknown;
  end(): unknown;
  destroy(): unknown;
}

export interface SmtpDialer {
  connect(target: EmailTarget): Promise<SmtpSocket>;
  upgradeTls(socket: SmtpSocket, host: string): Promise<SmtpSocket>;
}

export const nodeSmtpDialer: SmtpDialer = {
  connect(target) {
    return new Promise((resolve, reject) => {
      if (target.mode === "tls") {
        const s = tlsConnect({ host: target.host, port: target.port, servername: target.host }, () => resolve(s));
        s.once("error", reject);
      } else {
        const s = createConnection({ host: target.host, port: target.port }, () => resolve(s));
        s.once("error", reject);
      }
    });
  },
  upgradeTls(socket, host) {
    return new Promise((resolve, reject) => {
      // socket 只在 connect() 里由 node:net 创建,这里的类型收窄仅对生产路径成立
      const s = tlsConnect({ socket: socket as unknown as import("node:net").Socket, servername: host }, () => resolve(s));
      s.once("error", reject);
    });
  }
};

class SmtpReplyReader {
  private buffer = "";
  private waiters: { resolve: (r: { code: number; lines: string[] }) => void; reject: (e: Error) => void }[] = [];
  private failed: Error | null = null;

  constructor(socket: SmtpSocket) {
    socket.on("data", (chunk) => {
      this.buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      this.drain();
    });
    socket.on("error", (err) => this.fail(err));
    socket.on("close", () => this.fail(new Error("smtp connection closed")));
  }

  private fail(err: Error): void {
    this.failed = err;
    for (const w of this.waiters.splice(0)) w.reject(err);
  }

  private drain(): void {
    while (this.waiters.length > 0) {
      const parsed = this.takeReply();
      if (!parsed) return;
      this.waiters.shift()!.resolve(parsed);
    }
  }

  /** 取一条完整应答:若干 `250-xxx` 续行 + 一行 `250 xxx` 结束 */
  private takeReply(): { code: number; lines: string[] } | null {
    const lines: string[] = [];
    let consumed = 0;
    let rest = this.buffer;
    for (;;) {
      const nl = rest.indexOf("\r\n");
      if (nl === -1) return null;
      const line = rest.slice(0, nl);
      consumed += nl + 2;
      rest = rest.slice(nl + 2);
      lines.push(line);
      if (/^\d{3}(?: |$)/.test(line)) break;
      if (!/^\d{3}-/.test(line)) return this.badReply(line);
    }
    this.buffer = this.buffer.slice(consumed);
    const code = Number(lines[lines.length - 1]!.slice(0, 3));
    return { code, lines };
  }

  private badReply(line: string): null {
    this.fail(new Error(`smtp malformed reply: ${line.slice(0, 40)}`));
    return null;
  }

  next(): Promise<{ code: number; lines: string[] }> {
    if (this.failed) return Promise.reject(this.failed);
    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
      this.drain();
    });
  }
}

function b64Lines(input: string): string {
  const b64 = Buffer.from(input, "utf8").toString("base64");
  return b64.replace(/(.{76})/g, "$1\r\n");
}

function encodedWord(text: string): string {
  return /^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function addr(a: string): string {
  const m = /<([^>]+)>/.exec(a);
  return m ? m[1]! : a.trim();
}

/** RFC 5322 数据段(base64 正文;行首点转义;头部不含凭据、不含 token) */
export function buildEmailData(target: EmailTarget, msg: EmailMessage, now: Date): string {
  const headers = [
    `From: <${addr(target.from)}>`,
    `To: <${addr(target.to)}>`,
    `Subject: ${encodedWord(msg.subject)}`,
    `Date: ${now.toUTCString()}`,
    `Message-ID: ${msg.messageId}`,
    ...(msg.inReplyTo ? [`In-Reply-To: ${msg.inReplyTo}`] : []),
    ...(msg.references && msg.references.length > 0 ? [`References: ${msg.references.join(" ")}`] : []),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "Auto-Submitted: auto-generated"
  ];
  const body = b64Lines(msg.text);
  const raw = `${headers.join("\r\n")}\r\n\r\n${body}`;
  // 行首点转义(RFC 5321 §4.5.2)
  return raw.replace(/(^|\r\n)\./g, "$1..");
}

export const SMTP_TIMEOUT_MS = 20_000;

/**
 * 真实投递:成功(DATA 250)返回 true;任何失败返回 false(留 pending 重试,at-least-once)。
 * 失败原因不含服务器回显中的凭据;调用方只拿布尔,日志由 sweep 记 entryId。
 */
export async function sendEmailSmtp(
  target: EmailTarget,
  msg: EmailMessage,
  io: { dialer?: SmtpDialer; now?: () => Date; timeoutMs?: number } = {}
): Promise<boolean> {
  const dialer = io.dialer ?? nodeSmtpDialer;
  const now = io.now ?? (() => new Date());
  let socket: SmtpSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    socket = await dialer.connect(target);
    let reader = new SmtpReplyReader(socket);
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("smtp timeout")), io.timeoutMs ?? SMTP_TIMEOUT_MS);
    });
    const step = async (cmd: string | null, okCodes: number[]): Promise<void> => {
      if (cmd !== null) socket!.write(`${cmd}\r\n`);
      const reply = await Promise.race([reader.next(), timeout]);
      if (!okCodes.includes(reply.code)) throw new Error(`smtp ${cmd ? cmd.split(" ")[0] : "greeting"} rejected: ${reply.code}`);
    };
    await step(null, [220]);
    await step("EHLO saydo.local", [250]);
    if (target.mode === "starttls") {
      await step("STARTTLS", [220]);
      socket = await Promise.race([dialer.upgradeTls(socket, target.host), timeout]);
      reader = new SmtpReplyReader(socket);
      await step("EHLO saydo.local", [250]);
    }
    if (target.user && target.pass) {
      const token = Buffer.from(`\0${target.user}\0${target.pass}`, "utf8").toString("base64");
      await step(`AUTH PLAIN ${token}`, [235]);
    }
    await step(`MAIL FROM:<${addr(target.from)}>`, [250]);
    await step(`RCPT TO:<${addr(target.to)}>`, [250, 251]);
    await step("DATA", [354]);
    socket.write(`${buildEmailData(target, msg, now())}\r\n.\r\n`);
    const accepted = await Promise.race([reader.next(), timeout]);
    if (accepted.code !== 250) throw new Error(`smtp DATA rejected: ${accepted.code}`);
    try {
      socket.write("QUIT\r\n");
    } catch {
      /* 已接受即算投递成功 */
    }
    socket.end();
    return true;
  } catch {
    socket?.destroy();
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
