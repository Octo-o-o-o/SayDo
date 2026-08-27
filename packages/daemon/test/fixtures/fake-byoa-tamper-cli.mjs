#!/usr/bin/env node
// L-1 反例夹具:第一发在退出前把自身按“同 mtime/size”换掉,用来验证同一次 chat 内的
// 每一次再 spawn 都必须重验二进制身份。
// 被换上的副本只改 TAMPERED 这一个字节,长度不变,行为变成“正常成功”——
// 身份门若失效,这段输出就会被当成合法结果下发。
// 两条再 spawn 路径:缺省走 runSpawnTurn 内的网络重试;prompt 含 tamper-tripwire 时
// 走 provider 的 tripwire 强化重试(第二次 invoke)。

import { readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";

const TAMPERED = "0";

const args = process.argv.slice(2);
const prompt = readFileSync(0, "utf8");
const modelFlag = args.indexOf("--model");
const model = modelFlag >= 0 ? args[modelFlag + 1] : "claude-fable-5";

function emit(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

function swapSelf() {
  const self = process.argv[1];
  const before = statSync(self);
  const swapped = readFileSync(self, "utf8").replace('const TAMPERED = "0";', 'const TAMPERED = "1";');
  writeFileSync(self, swapped);
  utimesSync(self, before.atimeMs / 1000, before.mtimeMs / 1000);
}

if (TAMPERED === "1") {
  // 落地一个执行痕迹:测试断言它不存在,才算证明"被换上的二进制没有被执行",
  // 而不是只证明"它的输出没有被下发"。
  writeFileSync(`${process.argv[1]}.executed`, "tampered", "utf8");
  emit({ type: "system", subtype: "init", model });
  emit({ type: "result", subtype: "success", result: "TAMPERED-BINARY-EXECUTED" });
} else if (prompt.includes("tamper-tripwire")) {
  swapSelf();
  emit({ type: "tool_call", subtype: "started" });
} else {
  swapSelf();
  if (prompt.includes("tamper-evidence")) {
    // 先给完整成功流再以网络错误退出:这一发因此有自己的 evidence digest,
    // 与"被拦下那一发"的空结果可区分,记账证据取错就会被测出来。
    emit({ type: "system", subtype: "init", model });
    emit({ type: "result", subtype: "success", result: "FIRST-ATTEMPT-EVIDENCE" });
  }
  process.stderr.write("network connection reset\n");
  // 用 exitCode 而不是 process.exit():后者可能在 stderr 管道 flush 前就退出,
  // 让"网络型失败"判据偶发不命中。
  process.exitCode = 8;
}
