# T17b truthful first-run 修复对抗评审

你是只读对抗评审工程师。仓库为当前 cwd，分支应为 `fix/t17-truthful-firstrun`，基准 HEAD 为
`e92566f`；当前未提交工作树是 T17b 修复。禁止修改文件、commit、push、联网或启动 subagent。

任务：直接读取 `research/codex-findings/47-t17-truthful-firstrun-review.md`，逐项复核其中
A1-A6/B1-B2 是否被当前工作树真实闭合。不要复述提交者自述；必须沿生产 composition、HTTP/WS、
provider resolver/adapter、durable transcript/rebuild、console mount/reload 与真实进程测试追证。

重点攻击：

1. recovery-only 是否只装配 health/readyz、静态壳和本机 setup 自救；是否仍构造业务对象、注册
   定时器、恢复/老化/重放、Tier1、降格 saga 或 ntfy；非法 project override 是否必须先列出再按
   明确 projectIds 清除，且不存在远程/越权/误删入口。
2. dialog/thinking/cheap/evaluator 四个 API 槽是否都把 resolver 的 expectedFamily 传到 OpenAI
   compatible adapter；响应 model 缺失、不可解析、家族冲突是否 fail-closed 并写不可变审计；项目
   override 与 fallback 路径是否遗漏。
3. 空 HOME 首跑资格是否在内部 audit 前持久化；配置、self-restart、`/chat-new` 后是否真投；
   `presenting→presented` 崩溃窗口、响应丢失、组件卸载/重载、同 session 重询是否稳定返回同一
   turnId/message 且不重复转写/审计；消息只有在 durable 接纳后才消费 marker，recovery/closed
   拒收不得消费。
4. `TranscriptTurn.origin` 是否只做最小可选枚举，append、JSONL、suspend/rebuild、SQLite 重开后的
   进程级重建全程保留；普通轮兼容性是否破坏。
5. docs/07、docs/09 是否把旧 BYOA 当前时态明确迁为 Future/History 并移出 P0 当前测试清单；
   SetupWizard 文案是否明确只读、不可选择；新增测试是否存在字面假绿、只测 helper 或未走生产入口。

允许运行只读检查与测试，但报告中只声称你真实运行过的结果。输出简体中文 Markdown，首行必须是
`# Go` 或 `# No-Go`；按 A/B/C 分级列发现，每项给 file:line、触发、后果、最小修法。A=安全、
契约、数据丢失或验收硬阻断；B=重要但非硬阻断；C=可选改进。没有某级时明确写 0 项。最后列实际
运行命令与真实结果。若 47 的 6A/2B 全闭合且无新 A/B，判 Go。
