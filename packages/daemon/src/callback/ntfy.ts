// W2 阶段 B · ntfy 投递(升级链 L1 的 ntfy 通道接线;07 D11 ntfy 起步 + 05 §4 提前批 #2 深链)。
// 红线(IMPL-5 §2-B):深链只带路由,capability token 绝不进 URL——token 由手机端本地会话注入
// (首次配对一次,之后 localStorage);深链指向 tailnet console(配置了 [t2].tailnet_hosts 时),
// 否则回落本机 URL(仅桌面可点)。
// 话术纪律(10 §1 状态词):ready_for_review = "执行和检查都跑完了,等你验收";绝不说"完成"。
// 发布形态 = ntfy JSON POST(HTTP header 仅 ASCII,中文标题必须走 JSON body)。

import { renderTier1BlockedReason } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { redactText } from "../voice/redactor.js";

export interface NtfyTarget {
  server: string; // 如 https://ntfy.sh(NTFY_SERVER)
  topic: string; // NTFY_TOPIC
}

export interface NtfyMessage {
  title: string;
  body: string;
  /** 点击深链(只带路由,无 token) */
  click: string;
  priority: number; // ntfy 1-5;blocked/failed 升为 4(high)
}

export interface OutboxRowForNotify {
  id: string;
  task_id: string;
  trigger: string;
  settle_json?: string;
}

function blockedBody(entry: OutboxRowForNotify): string | null {
  if (!entry.settle_json) return null;
  try {
    const parsed = JSON.parse(entry.settle_json) as { minimalProof?: { exitEvidence?: unknown } };
    return renderTier1BlockedReason(parsed.minimalProof?.exitEvidence);
  } catch {
    return null;
  }
}

/** 深链基址:tailnet 首个枚举主机(手机可达)> 本机回落 */
export function consoleBaseUrl(tailnetHosts: readonly string[], port: number): string {
  const host = tailnetHosts[0];
  return host ? `http://${host}:${port}` : `http://127.0.0.1:${port}`;
}

/** 渲染通知(标题带任务名;正文按 trigger 走 10 §1 状态词;深链 = 任务详情 hash 路由,无 token) */
export function renderNtfyMessage(
  db: Db,
  entry: OutboxRowForNotify,
  opts: { consoleBase: string }
): NtfyMessage {
  const task = db.prepare("SELECT title, project_id FROM tasks WHERE id=?").get(entry.task_id) as
    | { title: string; project_id: string }
    | undefined;
  // 批末终审 A1 回修:任务标题是自由文本(可能含路径/凭据形态),经公网 ntfy(topic 明文可订阅)
  // 与手机锁屏呈现——与 TTS 同族外呼面,必经 redactor(10 §1 红线;正文为固定话术、深链只含 ULID)
  const title = redactText(task?.title ?? entry.task_id);
  const click = task
    ? `${opts.consoleBase}/#/p/${task.project_id}/task/${entry.task_id}`
    : `${opts.consoleBase}/#/`;
  switch (entry.trigger) {
    case "ready_for_review":
      return { title: `SayDo:${title}`, body: "执行和检查都跑完了,等你验收。", click, priority: 3 };
    case "blocked":
      return { title: `SayDo:${title}`, body: blockedBody(entry) ?? "任务卡住了,需要你处理。", click, priority: 4 };
    case "failed":
      return { title: `SayDo:${title}`, body: blockedBody(entry) ?? "这一轮失败了,要不要看一眼。", click, priority: 4 };
    default:
      return { title: `SayDo:${title}`, body: `任务状态更新(${entry.trigger})。`, click, priority: 3 };
  }
}

/** 真实投递(JSON 发布;失败返回 false 留 pending 重试——at-least-once,重复推送无害) */
export async function postNtfy(target: NtfyTarget, msg: NtfyMessage): Promise<boolean> {
  try {
    const res = await fetch(target.server, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: target.topic,
        title: msg.title,
        message: msg.body,
        click: msg.click,
        priority: msg.priority
      }),
      signal: AbortSignal.timeout(10_000)
    });
    return res.ok;
  } catch {
    return false;
  }
}
