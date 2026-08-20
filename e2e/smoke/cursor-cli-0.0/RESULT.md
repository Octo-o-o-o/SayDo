# 0.0 Tier1 执行后端冒烟(cursor_cli)· 结果

- 日期:2026-07-24 · cursor-agent 2026.07.23-e383d2b · 模型 claude-fable-5-max · 订阅态零 API key
- 范围:计划 0.0(a) 补验项(钩子门 deny/放行/阻塞三测已由 voice-coding spike 2026-07-23 通过,不重跑)
- 复现:`bash run.sh`(本目录);原始产物 `/tmp/saydo-p00-smoke/`(hook-fired.log / t1-t3 输出)

## 结论:5/5 PASS —— cursor_cli 后端成立,0.0 出口达成

| 测试 | 断言 | 结果 |
|---|---|---|
| T1a | 真实多步任务中 `npm install`(setup 通道)触发 beforeShellExecution | [PASS] |
| T1b | 同任务中 `git push`(push 通道)触发 beforeShellExecution | [PASS] |
| T1c | allow 决策下 push 实际落到本地 bare remote(无外部副作用) | [PASS] |
| T2 | deny 决策下 push 被拦,remote head 未变 | [PASS] |
| T3 | `create-chat` + `--resume <chatId>` 续会话,上一轮暗号可复述 | [PASS] |

## 关键证据

hook-fired.log(每条 shell 命令一次钩子触发,与 fail-closed 四律的"每条命令独立审批"一致):

```
{"ts":"1784867797","cmd":"npm install --no-audit --no-fund"}
{"ts":"1784867804","cmd":"git push origin main"}
{"ts":"1784867828","cmd":"git push origin main"}   <- T2 deny 轮
```

T3 resume 应答(chat_id=204924f9-9fd2-432e-889c-6e9b043e5659):`mango-42`(暗号原样复述)。

## 对 4.1 实现的备注

- setup(npm install)与 push 均走 shell 通道,beforeShellExecution 覆盖面对 Tier1 S2 足够(与 07 D8 判断一致);
- deny 语义在 `--force` 下仍可靠(复确认 spike 结论);
- `--resume` 走 chatId,执行器需持久化 (adapter, nativeSessionId=chatId, cwd) 恢复钥匙(09 §12-7)。
- claude_sdk 四能力冒烟顺延至 Claude 订阅购入(计划 v2.3(1)),不触发停止条款(风险表:未选后端顺延不停)。
