# 88 · Windows 对齐评审 triage

输入:一致性 subagent A=2/B=4/C=3；实现可行性 subagent A=7/B=7/C=4；Codex 88 A=7/B=7/C=1。
本表只记裁决。回修落后盘的合同/代码为准。

| ID | 来源 | 裁决 | 落点 |
|---|---|---|---|
| C-A1 / X-A5 | 09 DDL uid 唯一 | 吸收 | 09 §9 与 §1 同句 |
| C-A2 / X-A6 / I-A2 | 只哈希 gate.sh | 吸收 | 09 §11/§12-10；实现 digest 活动入口 |
| C-B1 / X-B6 | “正式执行面”过强 | 吸收 | ADR-004/03/02 改为目标面+工程对齐进行中 |
| C-B2 / X-C1 | 07 D8 jq | 吸收 | 07 D8 按 OS 分行 |
| C-B3 / X-B7 | Touch ID 分叉 | 吸收 | 09 签发链、10 #20；Hello 真人证据标 owner 触点,不挡代码 |
| C-B4 | cursor-agent.exe | 吸收 | 09 pin 允许 .exe |
| I-A1 / X-A2 | 匿名 Job / taskkill | 吸收 | ADR-003 具名 Job+KILL_ON_JOB_CLOSE；删 ADR-004 taskkill 主路径 |
| I-A2 / X-A3 | Named Pipe 无 SD | **重选 IPC**(Codex 授权):Windows 门 = `127.0.0.1` 仅本机临时端口 + HMAC(gate-secret) + owner-only 秘密文件；禁止 G1 端口、禁止 Node 默认 DACL pipe、禁止 win32 文件系统 AF_UNIX 当生产 | ADR-003 §3 重写 |
| I-A3 / X-A1 | alive1 / pgrep | 吸收 | 删除二者作 birth；win=`GetProcessTimes`；darwin=`ps lstart` 失败则 null |
| I-A4 / X-A4 | owner 跳过 / icacls 不完整 | 吸收 | 回读精确 DACL；getuid 缺失不得跳过 |
| I-A5 / X-B2 | https:// 误触发 | 吸收 | 09 词法左边界+先拒 URI |
| I-A6 / X-B4 / X-A7 | 与 W5.4-b 双写 | **本会话裁定**(owner 本轮授权 W-Win):本批独占 gate 运输与 `gate-*.mjs`；W5.4-b 暂停改 `handleGateRequest` 直到本批收口。协议超集:`{cwd, command?}` 现网不变,可选 `kind` 供 Claude 钩子,未知 kind deny | PLAN-2 / ADR |
| I-A7 | verify USERPROFILE | 吸收 | executor verifyEnv |
| X-B1 | macOS 可用性 | 吸收 | ADR 写明:无 lstart 则拒起,不再 alive1 |
| X-B3 | 双语言向量 | 吸收 | platform 测 + pipeline 对等测 |
| X-B5 | CI 层级 | **本会话裁定**:本地 `just ci`/`pnpm ci:node` = P0；Actions `windows-latest` = P1。ADR-004 决策 5 收窄 | ADR-004 |
| X-B7 Hello 真人 | 文案必修；真人过卡 = owner 触点,与 macOS Touch ID 真人同级,不挡工程收口 |

驳回:无。不把 WSL 当绿、不把 taskkill 当生产 killTree。
