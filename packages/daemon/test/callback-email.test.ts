// EMAIL-A 阶段 A 候选:邮件出站通道。内存 DB + 假 SMTP socket,禁真连接。
// 覆盖:渲染经 redactor / 线程头 / 四类事件过滤 / SMTP 会话与 RFC 5322 数据段 / DND 只发一次 /
// 投递失败不写 notified / 未配置降级(桌面通知仍走,不假装有推送面)。

import { mkdtempSync } from "node:fs";
import { createServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { OutboxTrigger, Tier1SettleProof } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { CallbackEngine } from "../src/callback/engine.js";
import { arbitrate } from "../src/callback/arbitration.js";
import {
  buildEmailData,
  EMAIL_TRIGGERS,
  emailMessageId,
  renderEmailMessage,
  resolveEmailTarget,
  sendEmailSmtp,
  type EmailMessage,
  type EmailTarget,
  type SmtpDialer,
  type SmtpSocket
} from "../src/callback/email.js";
import { consoleBaseUrl, LOCAL_HANDLE_HINT, renderNtfyMessage } from "../src/callback/ntfy.js";
import { runCallbackSweep, type SweepDeps } from "../src/callback/sweep.js";
import { getOutboxEntry, setOutboxThreadMessageId } from "../src/storage/dao/outbox.js";
import type { AuditSink } from "../src/obs/audit.js";

const PRJ = "prj_01AAAAAAAAAAAAAAAAAAAAAAAA";
const TSK = "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA";
const BASE = "http://127.0.0.1:47100";

let db: Db;
let nowMs: number;
let engine: CallbackEngine;
const auditEvents: { action: string; meta?: Record<string, unknown> }[] = [];
const audit: AuditSink = {
  record: (e) => {
    auditEvents.push({ action: e.action, ...(e.meta !== undefined ? { meta: e.meta } : {}) });
    return { id: "aud_x" };
  }
};

function seed(taskTitle: string): void {
  const t0 = "2026-09-09T09:00:00.000Z";
  db.prepare(
    `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
     VALUES (?, '报表系统', 'coding', 'active', '{}', 'stepwise', ?, ?)`
  ).run(PRJ, t0, t0);
  db.prepare(
    `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, budget_json, created_at, updated_at)
     VALUES (?, ?, ?, '# t', 'tier1', 'ready_for_review', 'cursor', '{}', ?, ?)`
  ).run(TSK, PRJ, taskTitle, t0, t0);
}

const proof = (): Tier1SettleProof => ({
  kind: "tier1",
  taskId: TSK,
  runId: "run-1",
  attempt: 1,
  packageRevision: 1,
  treeSha: "abc123",
  tier1VerifyDigest: "sha256:" + "1".repeat(64),
  acceptanceChecks: [],
  transcriptCursor: "c-100",
  settledAt: "2026-09-09T00:00:00.000Z"
});

function enqueue(trigger: OutboxTrigger, occurrenceKey: string): string {
  const r =
    trigger === "ready_for_review"
      ? engine.enqueue({
          taskId: TSK,
          trigger,
          packageRevision: 1,
          occurrenceKey,
          settleProof: proof(),
          projectionCursor: "c-100",
          artifactChecks: ["ac1"]
        })
      : engine.enqueue({
          taskId: TSK,
          trigger,
          packageRevision: 1,
          occurrenceKey,
          minimalProof: { questionId: `q-${occurrenceKey}`, transcriptCursor: "cur-x" },
          projectionCursor: "c",
          artifactChecks: []
        });
  expect(r.enqueued).toBe(true);
  return r.entryId;
}

const target: EmailTarget = {
  host: "smtp.example.test",
  port: 587,
  mode: "starttls",
  user: "bot@example.test",
  pass: "pw-fixture-not-a-real-secret",
  from: "SayDo <bot@example.test>",
  to: "owner@example.test"
};

beforeEach(() => {
  db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-cb-em-")), "saydo.db"));
  nowMs = Date.parse("2026-09-09T10:00:00.000Z");
  engine = new CallbackEngine({ db, audit, now: () => new Date(nowMs) });
  auditEvents.length = 0;
});

describe("resolveEmailTarget", () => {
  it("三键缺一即未配置;465 或 SMTP_SECURITY=tls 走隐式 TLS,缺省 587 STARTTLS", () => {
    expect(resolveEmailTarget({})).toBeNull();
    expect(resolveEmailTarget({ SMTP_HOST: "h", SMTP_FROM: "a@b" })).toBeNull();
    const t = resolveEmailTarget({ SMTP_HOST: "h", SMTP_FROM: "a@b", EMAIL_TO: "c@d" });
    expect(t).toMatchObject({ host: "h", port: 587, mode: "starttls", from: "a@b", to: "c@d" });
    expect(t?.user).toBeUndefined();
    expect(resolveEmailTarget({ SMTP_HOST: "h", SMTP_FROM: "a@b", EMAIL_TO: "c@d", SMTP_PORT: "465" })?.mode).toBe("tls");
    expect(resolveEmailTarget({ SMTP_HOST: "h", SMTP_FROM: "a@b", EMAIL_TO: "c@d", SMTP_SECURITY: "tls" })?.mode).toBe("tls");
    expect(resolveEmailTarget({ SMTP_HOST: "h", SMTP_FROM: "a@b", EMAIL_TO: "c@d", SMTP_PORT: "abc" })).toBeNull();
  });
});

describe("renderEmailMessage", () => {
  it("标题经 redactor(任务名里的 token/路径不进邮件);正文按 10 §1 状态词;深链只带路由不带 token", () => {
    seed("导出功能 sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ /opt/saydo-fixture/secret.env");
    const id = enqueue("ready_for_review", "a1");
    const msg = renderEmailMessage(db, { id, task_id: TSK, trigger: "ready_for_review" }, { consoleBase: BASE, from: target.from });
    expect(msg).not.toBeNull();
    expect(msg!.subject).not.toContain("sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(msg!.subject).not.toContain("/opt/saydo-fixture");
    expect(msg!.text).toContain("执行和检查都跑完了,等你验收");
    expect(msg!.text).not.toMatch(/完成|交付了。/u);
    expect(msg!.click).toBe(`${BASE}/#/p/${PRJ}/task/${TSK}`);
    expect(msg!.click).not.toContain("token");
    expect(msg!.messageId).toBe(emailMessageId(id, target.from));
    expect(msg!.messageId).toBe(`<${id}@example.test>`);
    expect(msg!.inReplyTo).toBeUndefined();
  });

  it("每任务一线程:后续邮件带 In-Reply-To / References 指向已发邮件,主题加 Re:", () => {
    seed("导出功能");
    const first = enqueue("blocked", "b1");
    const m1 = renderEmailMessage(db, { id: first, task_id: TSK, trigger: "blocked" }, { consoleBase: BASE, from: target.from })!;
    setOutboxThreadMessageId(db, first, m1.messageId, new Date(nowMs).toISOString());
    nowMs += 1_000;
    const second = enqueue("failed", "f1");
    const m2 = renderEmailMessage(db, { id: second, task_id: TSK, trigger: "failed" }, { consoleBase: BASE, from: target.from })!;
    expect(m2.inReplyTo).toBe(m1.messageId);
    expect(m2.references).toEqual([m1.messageId]);
    expect(m2.subject.startsWith("Re: ")).toBe(true);
    expect(getOutboxEntry(db, first)?.threadMessageId).toBe(m1.messageId);
  });

  it("只发四类事件:step_boundary / parked_expired / subscription_stalled 返回 null", () => {
    seed("导出功能");
    expect([...EMAIL_TRIGGERS].sort()).toEqual(["approval_request", "blocked", "failed", "ready_for_review"]);
    const id = enqueue("step_boundary", "s1");
    expect(renderEmailMessage(db, { id, task_id: TSK, trigger: "step_boundary" }, { consoleBase: BASE, from: target.from })).toBeNull();
  });
});

// ---- 假 SMTP 服务器:按脚本回应,记录客户端命令 ----
class FakeSocket implements SmtpSocket {
  written: string[] = [];
  private handlers: { data: ((c: Buffer | string) => void)[]; error: ((e: Error) => void)[]; close: (() => void)[] } = {
    data: [],
    error: [],
    close: []
  };
  destroyed = false;
  ended = false;
  constructor(private readonly script: (cmd: string | null, socket: FakeSocket) => string | null) {}
  write(data: string): void {
    this.written.push(data);
    const cmd = data.endsWith("\r\n.\r\n") ? "DATA_BODY" : data.trimEnd();
    const reply = this.script(cmd, this);
    if (reply !== null) queueMicrotask(() => this.emit("data", reply));
  }
  on(event: "data", cb: (chunk: Buffer | string) => void): this;
  on(event: "error", cb: (err: Error) => void): this;
  on(event: "close", cb: () => void): this;
  on(event: "data" | "error" | "close", cb: unknown): this {
    (this.handlers[event] as unknown[]).push(cb);
    if (event === "data" && this.pendingData.length > 0) {
      const queued = this.pendingData.splice(0);
      queueMicrotask(() => {
        for (const p of queued) this.emit("data", p);
      });
    }
    return this;
  }
  private pendingData: string[] = [];
  emit(event: "data", payload: string): void {
    if (this.handlers.data.length === 0) {
      this.pendingData.push(payload);
      return;
    }
    for (const h of this.handlers.data) h(payload);
  }
  emitError(err: Error): void {
    for (const h of this.handlers.error) h(err);
  }
  greet(): void {
    const reply = this.script(null, this);
    if (reply !== null) queueMicrotask(() => this.emit("data", reply));
  }
  end(): void {
    this.ended = true;
  }
  destroy(): void {
    this.destroyed = true;
  }
}

function okServer(over: Partial<Record<string, string>> = {}) {
  return (cmd: string | null): string | null => {
    if (cmd === null) return "220 smtp.example.test ESMTP\r\n";
    const head = cmd.split(" ")[0]!;
    if (over[head] !== undefined) return over[head]!;
    switch (head) {
      case "EHLO":
        return "250-smtp.example.test\r\n250-STARTTLS\r\n250 AUTH PLAIN\r\n";
      case "STARTTLS":
        return "220 go ahead\r\n";
      case "AUTH":
        return "235 ok\r\n";
      case "MAIL":
      case "RCPT":
        return "250 ok\r\n";
      case "DATA":
        return "354 end with .\r\n";
      case "DATA_BODY":
        return "250 queued\r\n";
      case "QUIT":
        return "221 bye\r\n";
      default:
        return "500 ?\r\n";
    }
  };
}

function dialerWith(plain: FakeSocket, tls: FakeSocket): SmtpDialer & { upgraded: number } {
  const d = {
    upgraded: 0,
    connect: async () => {
      plain.greet();
      return plain;
    },
    upgradeTls: async () => {
      d.upgraded += 1;
      return tls;
    }
  };
  return d;
}

describe("sendEmailSmtp(假 socket)", () => {
  const msg: EmailMessage = {
    subject: "SayDo:导出功能",
    text: "执行和检查都跑完了,等你验收。\n\n打开:http://127.0.0.1:47100/#/p/x/task/y",
    click: "http://127.0.0.1:47100/#/p/x/task/y",
    messageId: "<out_1@example.test>",
    inReplyTo: "<out_0@example.test>",
    references: ["<out_0@example.test>"]
  };

  it("587:EHLO → STARTTLS → 升级后再 EHLO → AUTH PLAIN → MAIL/RCPT/DATA → 250 ⇒ true;头部含线程字段且不含凭据", async () => {
    const plain = new FakeSocket(okServer());
    const tls = new FakeSocket(okServer());
    const dialer = dialerWith(plain, tls);
    const ok = await sendEmailSmtp(target, msg, { dialer, now: () => new Date(nowMs) });
    expect(ok).toBe(true);
    expect(plain.written.map((w) => w.split(" ")[0]!.trim())).toEqual(["EHLO", "STARTTLS"]);
    expect(dialer.upgraded).toBe(1);
    const cmds = tls.written.map((w) => w.split(" ")[0]!.split("\r\n")[0]!);
    expect(cmds.slice(0, 5)).toEqual(["EHLO", "AUTH", "MAIL", "RCPT", "DATA"]);
    expect(cmds.at(-1)).toBe("QUIT");
    const data = tls.written.find((w) => w.includes("Message-ID:"))!;
    expect(data).toContain("Message-ID: <out_1@example.test>");
    expect(data).toContain("In-Reply-To: <out_0@example.test>");
    expect(data).toContain("References: <out_0@example.test>");
    expect(data).toContain("Subject: =?UTF-8?B?");
    expect(data).toContain("From: <bot@example.test>");
    expect(data).toContain("To: <owner@example.test>");
    expect(data).not.toContain("pw-fixture-not-a-real-secret");
    expect(data).not.toContain("token=");
    // 正文 base64 可还原为原文
    const body = data.split("\r\n\r\n")[1]!.replace(/\r\n\.\r\n$/, "").replace(/\r\n/g, "");
    expect(Buffer.from(body, "base64").toString("utf8")).toBe(msg.text);
    // AUTH PLAIN 只在 TLS 之后发,明文段不含凭据
    expect(plain.written.join("")).not.toContain("AUTH");
    expect(tls.ended).toBe(true);
  });

  it("465 隐式 TLS:不发 STARTTLS;无 user/pass 不发 AUTH", async () => {
    const sock = new FakeSocket(okServer());
    const dialer = dialerWith(sock, sock);
    const { user: _u, pass: _p, ...noAuth } = target;
    const ok = await sendEmailSmtp({ ...noAuth, port: 465, mode: "tls" }, msg, { dialer });
    expect(ok).toBe(true);
    expect(dialer.upgraded).toBe(0);
    const cmds = sock.written.map((w) => w.split(" ")[0]!.split("\r\n")[0]!);
    expect(cmds).not.toContain("STARTTLS");
    expect(cmds).not.toContain("AUTH");
  });

  it("RCPT 550 ⇒ false 且不发 DATA;greeting 4xx ⇒ false;socket error ⇒ false", async () => {
    const rejected = new FakeSocket(okServer({ RCPT: "550 no such user\r\n" }));
    expect(await sendEmailSmtp({ ...target, mode: "tls" }, msg, { dialer: dialerWith(rejected, rejected) })).toBe(false);
    expect(rejected.written.some((w) => w.startsWith("DATA"))).toBe(false);
    expect(rejected.destroyed).toBe(true);

    const busy = new FakeSocket((cmd) => (cmd === null ? "421 try later\r\n" : "500 ?\r\n"));
    expect(await sendEmailSmtp({ ...target, mode: "tls" }, msg, { dialer: dialerWith(busy, busy) })).toBe(false);

    const dying = new FakeSocket((cmd, s) => {
      if (cmd === null) return "220 hi\r\n";
      queueMicrotask(() => s.emitError(new Error("ECONNRESET")));
      return null;
    });
    expect(await sendEmailSmtp({ ...target, mode: "tls" }, msg, { dialer: dialerWith(dying, dying) })).toBe(false);
  });

  it("无应答 ⇒ 超时返回 false", async () => {
    const silent = new FakeSocket((cmd) => (cmd === null ? "220 hi\r\n" : null));
    expect(await sendEmailSmtp({ ...target, mode: "tls" }, msg, { dialer: dialerWith(silent, silent), timeoutMs: 20 })).toBe(false);
  });

  it("连接卡住:总 deadline 从 dial 起算,超时 false 且不泄漏凭据", async () => {
    const hang: SmtpDialer = {
      connect: () => new Promise(() => {}),
      upgradeTls: async (socket) => socket
    };
    const started = Date.now();
    const ok = await sendEmailSmtp(target, msg, { dialer: hang, timeoutMs: 10 });
    expect(ok).toBe(false);
    expect(Date.now() - started).toBeLessThan(200);
    expect(ok).not.toBeUndefined();
  });

  it("连接迟到返回:销毁迟到 socket", async () => {
    const lateSockets: FakeSocket[] = [];
    const hang: SmtpDialer = {
      connect: () =>
        new Promise((resolve) => {
          setTimeout(() => {
            const socket = new FakeSocket(okServer());
            lateSockets.push(socket);
            resolve(socket);
          }, 40);
        }),
      upgradeTls: async (socket) => socket
    };
    expect(await sendEmailSmtp(target, msg, { dialer: hang, timeoutMs: 10 })).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(lateSockets).toHaveLength(1);
    const late = lateSockets[0];
    if (!late) throw new Error("late socket was not delivered");
    expect(late.destroyed).toBe(true);
    expect(late.written.join("")).not.toContain("pw-fixture-not-a-real-secret");
  });

  it("握手卡住:销毁已持有 socket", async () => {
    const plain = new FakeSocket(okServer());
    const hang: SmtpDialer = {
      connect: async () => {
        plain.greet();
        return plain;
      },
      upgradeTls: () => new Promise(() => {})
    };
    expect(await sendEmailSmtp(target, msg, { dialer: hang, timeoutMs: 20 })).toBe(false);
    expect(plain.destroyed).toBe(true);
    expect(plain.written.join("")).not.toContain("pw-fixture-not-a-real-secret");
    expect(plain.written.join("")).not.toContain("AUTH");
  });

  it("可注入 dialer 收到可选 AbortSignal;旧 fake 忽略第二参仍可跑", async () => {
    let seen: AbortSignal | undefined;
    const hang: SmtpDialer = {
      connect: (_target, signal) => {
        seen = signal;
        return new Promise(() => {});
      },
      upgradeTls: async (socket) => socket
    };
    expect(await sendEmailSmtp(target, msg, { dialer: hang, timeoutMs: 15 })).toBe(false);
    expect(seen).toBeDefined();
    expect(seen!.aborted).toBe(true);
  });

  it("DATA 250 后即使对端不回应 QUIT，也释放本次连接", async () => {
    const sock = new FakeSocket((cmd) => cmd === "QUIT" ? null : okServer()(cmd));
    expect(await sendEmailSmtp({ ...target, mode: "tls" }, msg, {
      dialer: dialerWith(sock, sock), timeoutMs: 20
    })).toBe(true);
    expect(sock.destroyed).toBe(true);
  });

  it("DATA 250 已接收后迟到 error 不回退失败", async () => {
    const sock = new FakeSocket((cmd, s) => {
      if (cmd === "DATA_BODY") {
        queueMicrotask(() => queueMicrotask(() => s.emitError(new Error("after-250"))));
        return "250 queued\r\n";
      }
      return okServer()(cmd);
    });
    expect(await sendEmailSmtp({ ...target, mode: "tls" }, msg, { dialer: dialerWith(sock, sock) })).toBe(true);
  });

  it("buildEmailData:行首点转义、Auto-Submitted 头", () => {
    const { inReplyTo: _i, references: _r, ...single } = msg;
    const data = buildEmailData(target, single, new Date(nowMs));
    expect(data).toContain("Auto-Submitted: auto-generated");
    expect(data).not.toContain("In-Reply-To");
    expect(data).not.toMatch(/\r\n\.[^.]/);
  });

  it("buildEmailData:长中文/混合多字节/长 ASCII 按 RFC2047 折行且往返还原", () => {
    const zh = "汉".repeat(80);
    const mixed = `Hi 你好${"世".repeat(40)}\u{20000}尾`;
    const ascii = `A${"b".repeat(200)}Z`;
    for (const subject of [zh, mixed, ascii]) {
      const { inReplyTo: _i, references: _r, ...single } = msg;
      const data = buildEmailData(target, { ...single, subject }, new Date(nowMs));
      const headers = data.split("\r\n\r\n")[0]!;
      for (const line of headers.split("\r\n")) {
        if (line.includes("=?")) expect(line.length).toBeLessThanOrEqual(76);
        for (const word of line.match(/=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/g) ?? []) {
          expect(word.length).toBeLessThanOrEqual(75);
        }
      }
      expect(decodeEncodedHeader(headers, "Subject")).toBe(subject);
      expect(decodeEncodedHeader(headers, "Subject")).not.toContain("\uFFFD");
      const body = data.split("\r\n\r\n")[1]!.replace(/\r\n\.\r\n$/, "").replace(/\r\n/g, "");
      expect(Buffer.from(body, "base64").toString("utf8")).toBe(msg.text);
    }
  });

  it("buildEmailData:多 References 合法折行且不截断 Message-ID 链", () => {
    const refs = Array.from({ length: 12 }, (_, i) => `<out_${String(i).padStart(3, "0")}@thread.example.test>`);
    const data = buildEmailData(
      target,
      { ...msg, subject: "SayDo:thread", references: refs, inReplyTo: refs[refs.length - 1]! },
      new Date(nowMs)
    );
    const headers = data.split("\r\n\r\n")[0]!;
    const refLines = collectHeader(headers, "References");
    expect(refLines.length).toBeGreaterThan(1);
    for (const line of refLines) expect(line.length).toBeLessThanOrEqual(78);
    const unfolded = refLines.join(" ").replace(/^References:\s*/, "").replace(/\s+/g, " ").trim();
    expect(unfolded.split(" ")).toEqual(refs);
    for (const id of refs) expect(headers).toContain(id);
  });

  it("配置 tailnet 时邮件/ntfy 仍只给本机入口,正文提示本机处理,title 脱敏", () => {
    seed("修 /opt/saydo-test/.secret.env 里的 sk-test0123456789abcdef0123");
    const base = consoleBaseUrl(["saydo-test.example"], 47100);
    expect(base).toBe("http://127.0.0.1:47100");
    const ntfy = renderNtfyMessage(db, { id: "out_mail", task_id: TSK, trigger: "ready_for_review" }, { consoleBase: base });
    const mail = renderEmailMessage(db, { id: "out_mail", task_id: TSK, trigger: "ready_for_review" }, { consoleBase: base, from: target.from });
    expect(mail).not.toBeNull();
    expect(ntfy.click).toMatch(/^http:\/\/127\.0\.0\.1:47100\/#\/p\/prj_/);
    expect(ntfy.click).not.toContain("token");
    expect(ntfy.click).not.toContain("saydo-test.example");
    expect(ntfy.body).toContain(LOCAL_HANDLE_HINT);
    expect(ntfy.body).not.toContain("手机可处理");
    expect(ntfy.title).not.toContain("sk-test0123456789abcdef0123");
    expect(mail!.click).toBe(ntfy.click);
    expect(mail!.text).toContain(LOCAL_HANDLE_HINT);
    expect(mail!.text).toContain("打开:http://127.0.0.1:47100/");
    expect(mail!.text).not.toContain("saydo-test.example");
    expect(mail!.subject).not.toContain("sk-test0123456789abcdef0123");
  });
});

describe("sendEmailSmtp(原生临时 TCP)", () => {
  const probeMsg: EmailMessage = {
    subject: "probe",
    text: "probe",
    click: "",
    messageId: "<probe@example.test>"
  };

  async function listenHang(onConn: (s: Socket) => void): Promise<{
    port: number;
    peers: Socket[];
    close: () => Promise<void>;
  }> {
    const peers: Socket[] = [];
    const server = createServer((s) => {
      peers.push(s);
      s.on("error", () => {});
      onConn(s);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const a = server.address();
    if (!a || typeof a === "string") throw new Error("address");
    return {
      port: a.port,
      peers,
      close: async () => {
        for (const s of peers) s.destroy();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    };
  }

  function waitPeerClosed(peers: Socket[], timeoutMs: number): Promise<void> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const tick = (): void => {
        if (peers.length > 0 && peers.every((s) => s.destroyed)) {
          resolve();
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`peer still open: accepted=${peers.length} open=${peers.filter((s) => !s.destroyed).length}`));
          return;
        }
        setTimeout(tick, 5);
      };
      for (const s of peers) s.once("close", () => tick());
      tick();
    });
  }

  it("隐式 TLS 握手挂住:超时 false 且服务端观察到 close", async () => {
    const hang = await listenHang((s) => {
      s.resume();
    });
    try {
      const ok = await sendEmailSmtp(
        { host: "127.0.0.1", port: hang.port, mode: "tls", from: "a@example.test", to: "b@example.test" },
        probeMsg,
        { timeoutMs: 50 }
      );
      expect(ok).toBe(false);
      await waitPeerClosed(hang.peers, 200);
      expect(hang.peers.length).toBeGreaterThanOrEqual(1);
      expect(hang.peers.every((s) => s.destroyed)).toBe(true);
    } finally {
      await hang.close();
    }
  });

  it("STARTTLS 后握手挂住:超时 false 且服务端观察到 close", async () => {
    const hang = await listenHang((s) => {
      let buf = "";
      s.write("220 hang.example.test ESMTP\r\n");
      s.on("data", (chunk) => {
        buf += chunk.toString("utf8");
        for (;;) {
          const nl = buf.indexOf("\r\n");
          if (nl === -1) return;
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 2);
          const head = line.split(" ")[0]?.toUpperCase() ?? "";
          if (head === "EHLO") {
            s.write("250-hang.example.test\r\n250 STARTTLS\r\n");
          } else if (head === "STARTTLS") {
            s.write("220 go ahead\r\n");
          }
        }
      });
    });
    try {
      const ok = await sendEmailSmtp(
        { host: "127.0.0.1", port: hang.port, mode: "starttls", from: "a@example.test", to: "b@example.test" },
        probeMsg,
        { timeoutMs: 80 }
      );
      expect(ok).toBe(false);
      await waitPeerClosed(hang.peers, 200);
      expect(hang.peers.length).toBeGreaterThanOrEqual(1);
      expect(hang.peers.every((s) => s.destroyed)).toBe(true);
    } finally {
      await hang.close();
    }
  });
});

function collectHeader(headers: string, name: string): string[] {
  const lines = headers.split("\r\n");
  const start = lines.findIndex((l) => l.toLowerCase().startsWith(`${name.toLowerCase()}:`));
  if (start < 0) return [];
  const out = [lines[start]!];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^[ \t]/.test(lines[i]!)) out.push(lines[i]!);
    else break;
  }
  return out;
}

function decodeEncodedHeader(headers: string, name: string): string {
  const raw = collectHeader(headers, name).join("\r\n").slice(name.length + 1).trimStart();
  const unfolded = raw.replace(/\r\n[ \t]/g, "");
  const parts: { start: number; end: number; text: string }[] = [];
  const re = /=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(unfolded))) {
    parts.push({ start: m.index, end: m.index + m[0].length, text: Buffer.from(m[1]!, "base64").toString("utf8") });
  }
  if (parts.length === 0) return unfolded;
  let out = "";
  let last = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i]!;
    const gap = unfolded.slice(last, p.start);
    if (!(i > 0 && /^[ \t]*$/.test(gap))) out += gap;
    out += p.text;
    last = p.end;
  }
  return out + unfolded.slice(last);
}

// ---- sweep 集成:邮件作为 L1 通道 ----
interface H {
  deps: SweepDeps;
  emails: EmailMessage[];
  desktopCalls: number;
  warnMsgs: string[];
}

function harness(over: { emailOk?: boolean; desktopOk?: boolean; email?: boolean; inDnd?: boolean; ntfy?: boolean }): H {
  const h: H = { deps: undefined as unknown as SweepDeps, emails: [], desktopCalls: 0, warnMsgs: [] };
  h.deps = {
    db,
    engine,
    arbitrate,
    voice: {
      consolePeerForTask: () => null,
      ttsHealthy: () => false,
      voiceBusy: () => false,
      say: async () => false,
      consoleSay: () => false
    },
    desktop: {
      notify: async () => {
        h.desktopCalls += 1;
        return over.desktopOk === true;
      }
    },
    ntfy: {
      enabled: over.ntfy === true,
      post: async () => false,
      render: (d, entry) => renderNtfyMessage(d, entry, { consoleBase: BASE })
    },
    ...(over.email === false
      ? {}
      : {
          email: {
            enabled: true,
            send: async (m) => {
              h.emails.push(m);
              return over.emailOk !== false;
            },
            render: (d, entry) => renderEmailMessage(d, entry, { consoleBase: BASE, from: target.from }),
            recordThread: (entryId, mid) => setOutboxThreadMessageId(db, entryId, mid, new Date(nowMs).toISOString())
          }
        }),
    dnd: {
      inWindow: () => over.inDnd === true,
      windowEnd: () => "2026-09-09T16:00:00.000Z"
    },
    log: {
      info: () => undefined,
      warn: (m) => {
        h.warnMsgs.push(m);
      },
      error: () => undefined
    },
    audit,
    l1FailWarned: new Set()
  };
  return h;
}

describe("sweep × 邮件通道", () => {
  it("桌面失败 + ntfy 未配置 + 邮件成功 ⇒ notified(escalation 1),线程锚落库", async () => {
    seed("导出功能");
    const id = enqueue("blocked", "e1");
    const h = harness({ emailOk: true, desktopOk: false });
    const r = await runCallbackSweep(h.deps, new Date(nowMs));
    expect(r.emailSent).toBe(1);
    expect(r.l1Notified).toBe(1);
    expect(h.emails).toHaveLength(1);
    const entry = getOutboxEntry(db, id);
    expect(entry?.state).toBe("notified");
    expect(entry?.escalationLevel).toBe(1);
    expect(entry?.threadMessageId).toBe(h.emails[0]!.messageId);
  });

  it("三通道全失败 ⇒ 不写 notified,条目留 pending 重试,告警一次", async () => {
    seed("导出功能");
    const id = enqueue("failed", "e2");
    const h = harness({ emailOk: false, desktopOk: false });
    const r = await runCallbackSweep(h.deps, new Date(nowMs));
    expect(r.emailSent).toBe(0);
    expect(r.l1Notified).toBe(0);
    expect(r.alerts).toBe(1);
    const entry = getOutboxEntry(db, id);
    expect(entry?.state).toBe("pending");
    expect(entry?.notifiedAt).toBeUndefined();
    expect(entry?.threadMessageId).toBeUndefined();
    // 第二轮仍失败:不重复告警
    const r2 = await runCallbackSweep(h.deps, new Date(nowMs + 15_000));
    expect(r2.alerts).toBe(0);
    expect(getOutboxEntry(db, id)?.state).toBe("pending");
  });

  it("DND 窗口:邮件只发一次并 snooze,同窗口第二轮不再发;不走桌面", async () => {
    seed("导出功能");
    const id = enqueue("blocked", "e3");
    const h = harness({ emailOk: true, inDnd: true });
    const r = await runCallbackSweep(h.deps, new Date(nowMs));
    expect(r.emailSent).toBe(1);
    expect(r.snoozed).toBe(1);
    expect(h.desktopCalls).toBe(0);
    expect(h.emails[0]!.text.startsWith("(免打扰时段)")).toBe(true);
    expect(auditEvents.filter((e) => e.action === "callback.dnd_pushed")).toHaveLength(1);
    expect(getOutboxEntry(db, id)?.state).toBe("pending");
    const r2 = await runCallbackSweep(h.deps, new Date(nowMs + 60_000));
    expect(r2.emailSent).toBe(0);
    expect(h.emails).toHaveLength(1);
  });

  it("未配置邮件(dep 缺省)⇒ 行为与既有一致:桌面成功即 notified,不渲染邮件", async () => {
    seed("导出功能");
    const id = enqueue("ready_for_review", "e4");
    const h = harness({ email: false, desktopOk: true });
    const r = await runCallbackSweep(h.deps, new Date(nowMs));
    expect(r.emailSent).toBe(0);
    expect(h.emails).toHaveLength(0);
    expect(getOutboxEntry(db, id)?.state).toBe("notified");
  });

  it("非四类事件(step_boundary)不发邮件,即使邮件已配置", async () => {
    seed("导出功能");
    enqueue("step_boundary", "e5");
    const h = harness({ emailOk: true, desktopOk: true });
    const r = await runCallbackSweep(h.deps, new Date(nowMs));
    expect(r.emailSent).toBe(0);
    expect(h.emails).toHaveLength(0);
    expect(r.l1Notified).toBe(1);
  });
});
