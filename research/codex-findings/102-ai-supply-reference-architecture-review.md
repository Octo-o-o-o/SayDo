# AI 供给参考架构独立评审

> 评审输入 SHA-256：`7fb98df5defe9f96dcc917067f645e4e7c1cac0148691c0e9f0633a5f964884c`
> 结论：`FAIL`
> 角度：仓内 canonical、阶段 DAG、插件隔离、可重算合同与发布门禁

## A findings

### A-1 “限权子进程”没有 OS 级隔离

第三方插件或 Execution Driver 即使完全绕过 host RPC，仍可用同 UID 直接读取未授权文件、建立外连或在 tool event 前修改工作区。空环境、临时 HOME、RPC、签名和 CPU/RSS 上限只能限制合作型进程或故障范围，不能改变内核授予的 ambient authority。

最小修订：code plugin/Execution Driver 激活前必须有当前平台的 OS-enforced deny-by-default sandbox；只放行 broker IPC 与具名 capability。没有可证明 backend 的平台只能 inventory。TCK 在 macOS/Linux/Windows 真实执行越界 `open/connect/exec/process-inspection/credential-store` 负例。

### A-2 hard-stop 没有中止已经在途的请求

首字节前 generation 检查只能关闭 check→send 窗口，不能在长流或慢上传已经开始后处理 emergency deny、rights 撤销或 secret revoke。

最小修订：发送 lease 可撤销并登记所有 in-flight transport/child；hard-stop 原子加代后同步 abort body/reader/socket/WebSocket/plugin/process/tool gate。已发送费用进入 `charge_unknown`，并增加慢上传、SSE、WebSocket、Execution session 的首字节后撤销反例。

### A-3 AdaptationPlan 不能证明每个 IR occurrence 被保留

adapter 可在两个 image、两个并行 tool call 或重复 reasoning block 中只序列化一个，却用单个 feature 名宣称 preserved。

最小修订：host 先生成逐 occurrence 的 `{path,kind,digest,requiredness}`；plan 对它形成无漏项、无重复的严格分区并绑定 wire-plan digest。组合 property/mutation fixture 删除中间 occurrence 必须在网络前失败。

### A-4 真正未知的上游事件仍可被忽略

旧 decoder 无法证明新 event 不含工具、费用、usage 或 terminal 语义；保存 opaque digest 不等于保留语义。

最小修订：未知 event type 默认 protocol terminal failure。只有 profile 预先具名且证明为无关键语义的 keepalive/display event 才可忽略并警告；费用/terminal 权威性不明时保持 `charge_unknown`。

### A-5 Phase 0 依赖 Phase 1 才创建的机械门

Phase 0 要求 import graph 门通过，但 SDK/runtime/TCK 骨架和 `check:connector-boundaries` 排在 Phase 1，导致阶段只能虚报、提前施工或无法收口。

最小修订：Phase 0 只固化 ADR 依赖图；机械门与红/绿 fixture 明确移到 Phase 1，或把完整门实现前移。

## B findings

### B-1 production snapshot 切换早于完整 policy/ActivationManifest

Phase 2 尚无 Phase 3 的完整 Rights/Billing/DataBoundary/Activation closure，若切 live 只能依赖伪 manifest。

最小修订：Phase 2 仅用 fake receipts 和 shadow compiler，禁止写 active pointer；首个 production cutover 移到 Phase 3 的完整垂直切片。

### B-2 第三方插件没有 secret-safe 的新认证扩展路径

未知 HMAC/challenge signer 既不能看到 secret bytes，也无法用宿主已知 primitive 表达。

最小修订：列出 broker-side declarative signing primitives 和 trusted signer 边界；无法表达的 secret-dependent signer 要求核心版本，不能承诺任意插件实现。

### B-3 TCK digest 与时间/环境字段矛盾

CLI 与 library 分别运行时 `startedAt/finishedAt/environment` 必然不同，不能要求完整报告 digest 相同。

最小修订：拆 deterministic `ConformanceResultCore` 与 `ConformanceRunEnvelope`；只要求相同输入的 core digest 一致。

### B-4 TCK runner 被分配给 runtime 和 TCK 两个包

目录方案会产生两套 runner，或迫使生产 runtime 依赖测试包。

最小修订：`connector-tck` 独占 runner/fuzz/fake host；runtime 只保留报告 verifier 与 live-check orchestration。

### B-5 ActiveSupplySnapshot digest 的 JCS 签名域不明确

现有 JCS 对 `Map` 不形成可重算内容，不同 binding/handle 可能得到相同投影。

最小修订：使用排序、无重复的纯 JSON `ActiveSupplySnapshotCore`，签入 compiler version、entry key 与全部 receipt/artifact digest；runtime Map/handle 只从 core 构造并 deep-freeze。

### B-6 跨平台性能、sandbox 和 24 小时 soak 未进入 release matrix

现有 release workflow 的三平台 job 只测 CLI distribution；Ubuntu 单点 benchmark 不能证明 macOS/Windows 的 process/socket/cancel/RSS，24h soak 也无法塞进短 job。

最小修订：固定支持 OS/arch/hardware profile；建立独立三平台 release qualification 和长时 soak workflow，每个平台报告进入 release digest closure。

### B-7 SDK/TCK 只有 workspace 测试，没有外部安装门

workspace link 可掩盖 `private:true`、TS 源码 export、缺 files/types/license 等发布缺陷。

最小修订：实际 `pnpm pack`，在仓外 fresh Node 22 ESM consumer 安装 tarball 并运行；前一 minor 兼容测试同样消费 tarball。

### B-8 IR/TCK 没有 citation/refusal/server-tool fixture

正文可通过全部现有 fixture，但 Responses annotation、Anthropic citation/refusal 或 hosted tool 语义被静默丢弃。

最小修订：IR 加判别分支，三协议 golden、跨协议 adaptation-loss 与 unknown-event fixture 全部进入 Phase 2/TCK。

### B-9 四类 conformance report 共用不适用的模型字段

纯 discovery 或 ACP execution report 没有 provider/model identity，只能填伪值。

最小修订：按 `reportKind=protocol|capability|discovery|execution` 建严格判别联合，共享 deterministic core/envelope，各分支只要求适用 identity。

## C findings

### C-1 ConnectorDefinition 身份规范不够机械

公共 `id:string`、未排序或重复的 capability/profile 列表会让大小写、Unicode 近形和数组重排形成多个 digest。

最小修订：使用受限 ASCII namespace、长度上限、去重和 canonical sort 后再签名。

## 结论

上述问题在输入 SHA 上至少包含五项可复现 A 级缺口，因此结论为 `FAIL`。本报告不评价后续修订版；后续必须以新 SHA 重新评审。
