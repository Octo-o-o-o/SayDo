# 仓库公开就绪(license / 扫描 / 待 owner 裁决)

> 产出:Claude Fable 5,2026-08-20。背景:owner 指示「把仓库改成 Public,并且把 license 做到最合适」。本文记录已完成项、公开前全史扫描结果、**阻塞公开的隐私项与处置选项**(归 owner 裁决),以及翻公开的操作清单。零 emoji。

## 1. 已完成

- **许可证 = Apache License 2.0**(commit `354b028`,已 push 到 `origin/main`):`LICENSE`(标准全文 + 版权行 `Copyright 2026 Yixiao Wang (汪义骁)`)、`NOTICE`(声明「说到」/SayDo 名称、印章 logo、`assets/` 品牌资产不在许可范围——Apache §6 商标条款)、`README.md` 新增「许可证」节、根 `package.json` 与可发布的 `packages/cli/package.json` 补 `"license": "Apache-2.0"`。
- 选 Apache-2.0 而非 MIT 的理由:① 含专利授权与明确的商标排除(项目有品牌与商店上架计划);② 与全部依赖(MIT/BSD/Apache)及同作者 Hopper(MIT)兼容;③ 社区与企业采用阻力最小。若 owner 想要 copyleft(AGPL)或更宽松(MIT),改 LICENSE 一行一文件即可,此前无对外分发不构成变更成本。
- **全史秘密扫描**:`gitleaks git .`(434 commits,12.5 MB)仅 2 条命中,均为误报(`research/codex-findings/24-…md:210` 文件名数组;`e2e/spikes/asr-1.0/check-asr-auth.sh:48` 是 RFC 6455 示例 `Sec-WebSocket-Key` 常量)。无真实 token / key / cap-token / ntfy topic / `.env` 真值入库。(基线注 2026-08-27 月度审计:此为 2026-08-20 时点基线;08-27 复跑为 713 commits / 129 条命中,按 规则×文件 全 17 组抽样均为假阳性类——测试标记串、evidence 指纹字段、40-hex commit SHA 等;公开树现役门是 `check-public-tree-privacy`,当日实测 hits=0。)

## 2. 阻塞公开的隐私项(翻公开前必须裁决)

| # | 位置 | 内容 | 首次入库 | 风险 |
|---|---|---|---|---|
| P1 | `docs/release/2026-08-13-tencent-icp-app-filing.md` §1–§2 | 两个手机号(联系方式 / **应急联系人**)、备案通知邮箱(个人 QQ 邮箱)、身份证有效期、主体备案号;腾讯云客服被叫号码 | `aac3d60`(2026-08-13;其后约 106 个提交) | 高——个人身份信息 + 第三方(应急联系人)电话 |
| P2 | `docs/release/2026-08-13-app-materials.md:38,40,199,208`、`store-submission-status.md:10`、`release-profile.yaml:58` | CPCC 账号用户名与 ICP 备案订单号(字面已于 2026-08-20 抹除) | 同上 | 中——账号名 + 可被社工利用的订单号 |
| P3 | `history/voice-coding-framework.Cursor2.md` §9(:792-830 等)、`history/PROCESS-JOURNAL.md` R2/R3(:67-69)、`docs/06-references.md:47` | 第三方(实名,公开稿已隐去)在交流群的发言摘录、其产品截图的获取与读取过程记录(工具名公开稿已隐去) | `f28489d`(2026-07-29 单仓合并;源自更早的 voice-coding 仓) | 高——他人私域群聊与加密图片解密的叙述,公开有伦理与关系风险 |
| P4 | `docs/release/filing-cheatsheet.md`、`store-submission-status.md` | Apple Team ID、App Store ID、Play/AGC 应用 ID、证书指纹、keystore 本机路径 | 同 P1 | 低(多为公开可见标识符),但与 P1/P2 同目录,建议一并处理 |

## 3. 处置选项(归 owner)

| 选项 | 做法 | 优点 | 代价 |
|---|---|---|---|
| **A 改写历史后公开同一仓** | `git filter-repo` 删除 P1 文件全史 + `--replace-text` 抹除 P2 用户名/订单号 + 重写 P3 三处段落;force-push;所有 clone/并发会话重新拉取 | 仓库 URL 与完整提交史保留 | `aac3d60` 之后约 106 个提交 SHA 全变(HANDOFF / evidence / journal 里引用的 `addfd19`、`e79d1d8`、`068e392`、`115353e`、`adc2b9a`、`29f33cf`、`354b028` 等全部失效,需加「重写前 SHA」注记);P3 若要抹干净,影响自 `f28489d` 起全部历史 ⇒ 实质是全史重写 |
| **B 只在 HEAD 删改 + 接受历史暴露** | 把 P1 文件移出仓(搬到 `~/.config/saydo/` 或私有笔记),P2/P3 段落改写,正常提交后翻公开 | 零 SHA 变动,一小时内可公开 | 历史里仍能翻到手机号 / 邮箱 / 第三方内容——**不建议**(P1/P3 性质) |
| **C 公开一份干净快照,原仓转私有归档** | 原仓重命名(如 `SayDo-private`,保留全部历史与 SHA 引用);新建公开仓 `Octo-o-o-o/SayDo`(URL 不变)= 当前 HEAD 的单提交(或少量提交)快照,提交前先按 B 做删改;之后开发在公开仓继续(或双推) | 隐私最稳;官网/Docs 链接不变;过程档案与 SHA 引用在私有归档仍可核 | 公开仓无历史(evidence 文档里的 SHA 在公开仓不可解析,需在 README 注明「历史在私有归档」);双仓维护一段时间 |

**建议**:若 owner 看重「公开即可审计全史」选 A(我来执行,但需 owner 知会并发会话、并接受 SHA 引用失效);若更看重隐私与零风险,选 C。无论哪种,P1 文件都建议从仓内**整体移出**(备案材料本就写明「证件号不入仓」,电话与私人邮箱也不该入仓),P3 三处改写为「一位同行的公开产品界面(已获授权 / 或删去解密过程叙述)」由 owner 定稿。

## 3.1 执行记录(2026-08-20,owner 授权「按建议继续实施」)

**已按选项 C 变体执行**:① HEAD 脱敏(P1 备案文件整体替换为存根,原文移 `~/.saydo/private/` 并留存归档史;P2 账号名/订单号字面抹除;P3 第三方实名与图片获取工具叙述隐去,观点转述匿名保留;新发现的订阅账号邮箱同批抹除);② 原远端仓改名 `Octo-o-o-o/SayDo-archive`(private,全史与全部 SHA 引用保留,本地 origin 指向它);③ 新建公开仓 `Octo-o-o-o/SayDo` = 干净快照(`scripts/publish-public-snapshot.sh`,推前隐私探针,后续快照沿用);④ README 增「过程史与归档」节 + `SECURITY.md`。P4(Apple Team ID / App ID / 证书指纹)复核为无增量风险,保留。

## 4. 翻公开的操作清单(裁决后执行)

1. 按所选选项完成删改 / 改写 / 快照。
2. 复跑 `gitleaks git .` + 本文 §2 的 `git grep` 探针(手机号正则、CPCC 账号名、图片工具名、第三方实名、备案通知邮箱前缀、订阅账号邮箱)全零——探针字面量的现行位置(2026-08-27 更新):脚本内联仅手机号正则一条(`scripts/publish-public-snapshot.sh`),其余隐私探针存于 Git 私有目录锚文件 `.git/info/saydo-private-probes`(常规文件、owner-only 权限,由脚本运行时读取;不入公开树)。
3. `gh repo edit Octo-o-o-o/SayDo --visibility public --accept-visibility-change-consequences`;确认 `gh repo view --json isPrivate,licenseInfo` 返回 `false` / `Apache License 2.0`。
4. 官网 / Docs 稿的「开源免费 · 前往 GitHub」口径生效(见 `docs/site/` 两稿 C-1)。
5. 可选:GitHub 仓库 About 填一句话与 topics;开启 Issues;加 `SECURITY.md`(私下披露邮箱 `support@octoooo.com`)与 `CONTRIBUTING.md`(指向 AGENTS.md)。
