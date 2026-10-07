// EMAIL-A 阶段 A(候选):回叫升级链 L1 的邮件出站通道(与 ntfy 并列可选,任一配置即启用;05 决策单第 11 节)。
// 红线沿用 ntfy 通道:标题/正文经 redactText;若带入口只给本机受信 hash 路由,不带 capability token,
// 不把远程任务 URL 当可用入口(07 D11 当前边界);正文须写明回到运行 SayDo 的电脑处理。
// 话术按 10 §1 状态词(ready_for_review = "执行和检查都跑完了,等你验收",绝不说"完成/交付")。
// Subject/References 按 RFC2047 §2 / RFC5322 折行:encoded-word ≤75,含 encoded-word 的物理行 ≤76。
// 只发 ready_for_review / blocked / failed / approval_request;每任务一线程(Message-ID / In-Reply-To / References,
// 线程锚落 callback_outbox.thread_message_id,DDL v32 additive)。
// SMTP submission:587 STARTTLS(缺省)或 465 隐式 TLS;AUTH PLAIN;客户端只用 node:net / node:tls,不新增依赖。
// 凭据(SMTP_PASSWORD)经 /api/setup/secret 白名单落 .env(0600),永不进日志/审计/邮件正文。

import { createConnection, type Socket } from "node:net";
import { connect as tlsConnect, type TLSSocket } from "node:tls";
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
  connect(target: EmailTarget, signal?: AbortSignal): Promise<SmtpSocket>;
  upgradeTls(socket: SmtpSocket, host: string, signal?: AbortSignal): Promise<SmtpSocket>;
}

function smtpAbortError(): Error {
  return new Error("smtp timeout");
}

/** 握手未完成也能取消:socket 在 connect/secureConnect 前就持有,abort 即 destroy。 */
function watchNativeConnect(
  socket: Socket | TLSSocket,
  readyEvent: "connect" | "secureConnect",
  signal?: AbortSignal
): Promise<Socket | TLSSocket> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error): void => {
      if (settled) return;
      settled = true;
      socket.off(readyEvent, onReady);
      socket.off("error", onError);
      if (signal) signal.removeEventListener("abort", onAbort);
      if (err) {
        socket.on("error", () => undefined);
        socket.destroy();
        reject(err);
        return;
      }
      resolve(socket);
    };
    const onReady = (): void => finish();
    const onError = (err: Error): void => finish(err);
    const onAbort = (): void => finish(smtpAbortError());
    if (signal?.aborted) {
      finish(smtpAbortError());
      return;
    }
    socket.once(readyEvent, onReady);
    socket.once("error", onError);
    if (signal) signal.addEventListener("abort", onAbort);
  });
}

export const nodeSmtpDialer: SmtpDialer = {
  connect(target, signal) {
    if (signal?.aborted) return Promise.reject(smtpAbortError());
    if (target.mode === "tls") {
      const s = tlsConnect({ host: target.host, port: target.port, servername: target.host });
      return watchNativeConnect(s, "secureConnect", signal);
    }
    const s = createConnection({ host: target.host, port: target.port });
    return watchNativeConnect(s, "connect", signal);
  },
  upgradeTls(socket, host, signal) {
    if (signal?.aborted) {
      socket.destroy();
      return Promise.reject(smtpAbortError());
    }
    // socket 只在 connect() 里由 node:net 创建,这里的类型收窄仅对生产路径成立
    const s = tlsConnect({ socket: socket as unknown as Socket, servername: host });
    return watchNativeConnect(s, "secureConnect", signal);
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

const SUBJECT_PREFIX_LEN = "Subject: ".length;
const RFC2047_WORD_MAX = 75;
const RFC2047_LINE_MAX = 76;
const RFC5322_LINE_SOFT = 78;

function isPrintableAscii(text: string): boolean {
  return /^[\x20-\x7e]*$/.test(text);
}

function encodedWordFromBytes(bytes: Buffer): string {
  return `=?UTF-8?B?${bytes.toString("base64")}?=`;
}

function maxBytesForWord(maxWordLen: number): number {
  const overhead = "=?UTF-8?B?".length + "?=".length;
  const maxB64 = Math.floor((maxWordLen - overhead) / 4) * 4;
  return Math.max(0, (maxB64 / 4) * 3);
}

function encodeAsWords(text: string, firstMaxWord: number, contMaxWord: number): string[] {
  const words: string[] = [];
  let maxWord = firstMaxWord;
  let buf = Buffer.alloc(0);
  for (const cp of text) {
    const next = Buffer.from(cp, "utf8");
    const maxBytes = maxBytesForWord(maxWord);
    if (buf.length > 0 && buf.length + next.length > maxBytes) {
      words.push(encodedWordFromBytes(buf));
      buf = next;
      maxWord = contMaxWord;
    } else {
      buf = Buffer.concat([buf, next]);
    }
  }
  if (buf.length > 0) words.push(encodedWordFromBytes(buf));
  return words;
}

function foldEncodedWords(name: string, words: string[]): string {
  if (words.length === 0) return `${name}: `;
  const lines = [`${name}: ${words[0]!}`];
  for (const w of words.slice(1)) lines.push(` ${w}`);
  return lines.join("\r\n");
}

/** RFC2047 encoded-word 拆分 + 合法 fold;短 ASCII 保持原文。 */
export function encodeHeader(name: string, text: string): string {
  const prefix = `${name}: `;
  const shortAscii = isPrintableAscii(text) && prefix.length + text.length <= RFC5322_LINE_SOFT;
  if (shortAscii) return `${prefix}${text}`;
  const firstMax =
    name.toLowerCase() === "subject" ? RFC2047_LINE_MAX - SUBJECT_PREFIX_LEN : RFC2047_WORD_MAX;
  const words = encodeAsWords(text, Math.min(firstMax, RFC2047_WORD_MAX), RFC2047_WORD_MAX);
  return foldEncodedWords(name, words);
}

function foldUnstructuredTokens(name: string, tokens: string[]): string {
  const prefix = `${name}: `;
  const lines: string[] = [];
  let current = prefix;
  for (const tok of tokens) {
    if (current === prefix) {
      current += tok;
      continue;
    }
    if (current.length + 1 + tok.length <= RFC5322_LINE_SOFT) {
      current += ` ${tok}`;
    } else {
      lines.push(current);
      current = ` ${tok}`;
    }
  }
  lines.push(current);
  return lines.join("\r\n");
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
    encodeHeader("Subject", msg.subject),
    `Date: ${now.toUTCString()}`,
    `Message-ID: ${msg.messageId}`,
    ...(msg.inReplyTo ? [foldUnstructuredTokens("In-Reply-To", [msg.inReplyTo])] : []),
    ...(msg.references && msg.references.length > 0 ? [foldUnstructuredTokens("References", msg.references)] : []),
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
  const timeoutMs = io.timeoutMs ?? SMTP_TIMEOUT_MS;
  const abort = new AbortController();
  let socket: SmtpSocket | null = null;
  const extras: SmtpSocket[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;
  let accepted = false;

  const destroyAll = (): void => {
    socket?.destroy();
    for (const s of extras) s.destroy();
  };

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      if (!accepted) abort.abort();
      destroyAll();
      reject(new Error("smtp timeout"));
    }, timeoutMs);
  });
  timeout.catch(() => undefined);

  const adopt = (s: SmtpSocket): SmtpSocket => {
    if (timedOut) {
      s.destroy();
      throw new Error("smtp timeout");
    }
    if (socket && socket !== s) extras.push(socket);
    socket = s;
    return s;
  };

  const watchLate = (p: Promise<SmtpSocket>): Promise<SmtpSocket> => {
    const guarded = p.then(
      (s) => {
        if (timedOut || accepted) {
          s.destroy();
          throw new Error("smtp timeout");
        }
        return s;
      },
      (err: unknown) => {
        if (timedOut || accepted) throw new Error("smtp timeout");
        throw err;
      }
    );
    guarded.catch(() => undefined);
    return guarded;
  };

  try {
    adopt(await Promise.race([watchLate(Promise.resolve(dialer.connect(target, abort.signal))), timeout]));
    let reader = new SmtpReplyReader(socket!);
    const step = async (cmd: string | null, okCodes: number[]): Promise<void> => {
      if (cmd !== null) socket!.write(`${cmd}\r\n`);
      const reply = await Promise.race([reader.next(), timeout]);
      if (!okCodes.includes(reply.code)) {
        throw new Error(`smtp ${cmd ? cmd.split(" ")[0] : "greeting"} rejected: ${reply.code}`);
      }
    };
    await step(null, [220]);
    await step("EHLO saydo.local", [250]);
    if (target.mode === "starttls") {
      await step("STARTTLS", [220]);
      adopt(await Promise.race([watchLate(Promise.resolve(dialer.upgradeTls(socket!, target.host, abort.signal))), timeout]));
      reader = new SmtpReplyReader(socket!);
      await step("EHLO saydo.local", [250]);
    }
    if (target.user && target.pass) {
      const token = Buffer.from(`\0${target.user}\0${target.pass}`, "utf8").toString("base64");
      await step(`AUTH PLAIN ${token}`, [235]);
    }
    await step(`MAIL FROM:<${addr(target.from)}>`, [250]);
    await step(`RCPT TO:<${addr(target.to)}>`, [250, 251]);
    await step("DATA", [354]);
    socket!.write(`${buildEmailData(target, msg, now())}\r\n.\r\n`);
    const dataReply = await Promise.race([reader.next(), timeout]);
    if (dataReply.code !== 250) throw new Error(`smtp DATA rejected: ${dataReply.code}`);
    accepted = true;
    try {
      socket!.write("QUIT\r\n");
    } catch {
      /* 已接受即算投递成功 */
    }
    try {
      socket!.end();
    } catch {
      /* 已接受即算投递成功 */
    }
    return true;
  } catch {
    if (!accepted) destroyAll();
    return accepted;
  } finally {
    if (timer) clearTimeout(timer);
    // DATA 的 250 已决定投递结果，QUIT/对端 FIN 不得让本次连接无限存活。
    destroyAll();
  }
}
