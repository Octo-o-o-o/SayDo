# AI 供给生态与开源可扩展性独立评审

> 评审输入 SHA-256：`7fb98df5defe9f96dcc917067f645e4e7c1cac0148691c0e9f0633a5f964884c`
> 结论：`FAIL`
> 角度：中国大陆/全球生态、订阅与 gateway 费用、本地冷态、开源贡献与证据复现

## A findings

### A-1 native code plugin 的“限权子进程”不是安全边界

签名正确且只申请 transport capability 的插件仍能以同一 OS 用户直接读取 `~/.ssh`、工作区或其他文件并自行外连，全程不经过 ConnectorPluginHost。独立进程、临时 HOME 和 opaque handle 不撤销 ambient filesystem/network/process authority；HashiCorp go-plugin 的 handshake 也不是 sandbox。

最小修订：第三方 native code 在正式平台完成 OS 强制 sandbox 前只能标“完全信任的本机代码”，不得用逐 capability 文案或取得 supported/privacy badge。capability 模式使用 WASI 或等价 OS sandbox，并以直接 syscall 负例证明无法绕过 host。

### A-2 默认冷态 Ollama 形成无法自举的证据环

Ollama 默认在一段空闲后卸载模型。`/api/tags` 可见已下载模型而 `/api/ps` 为空；方案又要求 conformance 前已有 loaded artifact evidence，并禁止自动阶段加载模型，用户只能外部手工预热。

最小修订：新增 `LocalPreloadAuthorization/Receipt`。在验证 loopback、runtime process、已安装本地 artifact，并排除 cloud alias/LM Link 后，只允许 content-free、本地、禁止下载和外网的 preload；成功取得 loaded evidence 后再 conformance。补冷态、OOM、取消和 cloud/LAN 负例。

### A-3 OpenRouter BYOK 的多 key 路由和双计费无法进入闭包

普通 OpenRouter OAuth/inference key 不能读取或 fence workspace BYOK 管理配置。BYOK 可按顺序尝试多把 provider key并回落 shared capacity；成功请求还可能同时产生上游 provider charge 与 OpenRouter fee/credits。

最小修订：普通 key/OAuth 下 BYOK 只标 inventory，提示 direct provider key；正式支持时要求独立 management authority、配置 revision、完整 key 顺序与 shared fallback fence，并用 `BillingChargeComponent[]` 对每个 biller/account/funding/unit 独立授权和结算。

### A-4 CandidateDataBoundary 丢失 member 与数据属性的元组关系

把 operator、region、retention、training、subprocessor 分成全局数组，可把 A 的 operator 与 B 的 region/retention 重组出用户从未确认的组合并通过逐列 membership。

最小修订：使用 `DataBoundaryAlternative[]`，每项绑定 member ordinal、attempt、fence、boundary 和完整数据属性/evidence 元组；runtime 只能整体匹配同一个 alternative。

## B findings

### B-1 签名 TCK report 没有可信 signer/builder policy

贡献者可修改本地 runner 让测试恒绿再自行签名；报告未绑定 TCK/runner/builder/source commit/provenance，UI 仍可能投影正式徽章。

最小修订：受信 CI 生成 SLSA/in-toto style attestation，绑定 connector、SDK、TCK、fixture、source commit 和环境；registry allowlist builder/issuer。publisher 自签只为 `community-unverified`。

### B-2 四条证据轴不足以回答当前是否可用

connector 可同时是 stable/core/healthy/allowed，但价格证据过期、DataBoundary unknown 或 RouteSet fence 不可得，实际 activation 必须停止。

最小修订：保留四轴，另由完整当前闭包计算 `activation_readiness=ready|action_required|blocked`；官网和 UI 不仅凭四轴显示笼统支持。

### B-3 通用“最多 2 个请求”会少报 gateway upstream attempts

一次 gateway ingress 可能按 InvocationEnvelope 触发四个 upstream attempt，预算虽正确，固定文案仍会让用户误解只有两次可能计费调用。

最小修订：固定 2 只用于 custom protocol probe；其他确认卡从 InvocationEnvelope 派生并分别显示 ingress 数和最大 upstream invocation 数。

### B-4 缺贡献治理、晋升、交接和撤销合同

即使 manifest、fixture、report、owner 齐全，贡献者仍不知道谁审批 Rights、谁可进入 TUF、如何从 community 晋升、maintainer 离任怎么交接、恶意版本由谁撤销。

最小修订：Phase 8/GA 交付 `CONTRIBUTING.md`、`CODE_OF_CONDUCT.md`、`GOVERNANCE.md`、`CODEOWNERS`、DCO/CLA 裁决、review ownership、TUF delegation/onboarding/revocation、晋升和 sunset SLA。

## C findings

### C-1 开源架构证据使用可变分支链接

OpenCode、Cline、Vercel、TUF 等 `main/dev/master` 内容会变化，同一方案 SHA 的依据不可复现。

最小修订：影响合同的资料使用 commit permalink，并记录 `accessedAt` 与内容 digest；动态网页形成 evidence lock。

### C-2 普通 provider 的 `region:string` 没有规范语义

`global`、`provider_default` 等任意同义字符串可制造不同 resource identity，也可能被误当 processing-region 证明。

最小修订：使用 `explicit_region | provider_managed | global_endpoint | unknown` 判别联合，并明确它不能替代 DataBoundary。

## 结论

上述问题在输入 SHA 上至少包含四项可复现 A 级缺口，因此结论为 `FAIL`。本报告不评价后续修订版；后续必须以新 SHA 重新评审。
