# 最近一周全量双向对账、修复与快速启动发布报告

> 主账本窗口固定为北京时间 `2026-08-15 00:00:00` 至首轮冻结提交
> `3fccf4a704ad9a5d8e013baaefb67c66a5737cba`;该点之后的全部回修提交另由
> `research/week-audit/2026-08-23-remediation-ledger.json` 双向覆盖至最终实施冻结 SHA。
> 生成账本的证据载体提交因 SHA 自引用不可能性明确排除在回修范围外。本文 supersede
> `docs/review/2026-08-22-week-crosscheck.md` 对冻结点之后现势的描述,不改写前报告的历史事实。

## 1. 结论

已记录 ref 宇宙中没有发现未合并而又独立实现的新功能分支。主线 115 个提交、清单中的额外
16 个提交、434 个变更路径与 219 份文档型资产已经全部进入可复现台账;额外提交均为经
机械树差异验证的公开快照或与主线同树的分支提交,没有重复算成功能。首轮未提交工作树
另以逐路径状态、字节数、mode 与内容 SHA-256 冻结;最终回修进入独立 remediation ledger,
不再把“首轮冻结已审完”误写成“后续修复也已入账”。ref manifest 是冻结后约五小时补录，
因此不能证明冻结时存在但随后删除或强制移动的 ref 没有遗漏；这是本轮不可回填的历史盲区。

冻结范围的双向人工语义复核确认 11 组需要处置的问题。可判定项全部选择了合同与证据更强的一侧并直接
修复:W5.4-b C1 init 探针与 C3、旧 Agent SDK 口径、过期 Playwright 结论、首启/正式 IA
测试漂移、CLI 发布身份与法务文件、端口占用误判、Windows 分发 CI、官网源码-only 入口、
跨平台认证话术和 prompt 隔离。首轮两路独立评审与 Codex 对抗评审又发现工作树审计、
验收证据真实性、发布物源码绑定、真实安装入口、并发身份登记与官网状态等收口缺陷,
以及 rc.2 首次托管门暴露的跨平台红灯，已按 §5 的 F29–F105 回修；rc.3 两路独立复审均为 Go，但首次托管门又暴露
F106–F107。当前 rc.4 必须重新复审并以新标签首次 Actions 与发布后实测为准。无法由自动化替代的
四场真人验收、真 Claude hook 全链、HarmonyOS 签名与商店/npm registry 发布继续如实保留为边界。

全量原始主账本见 `docs/review/2026-08-22-week-audit-ledger.md`,机器可读明细见
`research/week-audit/2026-08-22-ledger.json`;回修账本见
`docs/review/2026-08-23-remediation-ledger.md` 与对应 JSON。四者由 `scripts/week-audit.mjs`
从两个连续范围重建,不是人工抽样表;implementation-only 回修提交另有机器可读跨提交
`relatedDocumentRefs`,文档侧反向列 `relatedImplementationCommits`。

逐项 JSON 只承诺**机械证据覆盖**,不承诺 334 行逐项人工判定正确。旧 refiner 曾机械生成
`decision/claim/rationale`,这些字段已从 schema 6 的 commit/document decision rows 删除;
顶层 `findings` 仍按设计保留 11 条人工处置的 `decision`。人工部分只保留本文 F18–F28 与
23 个 SHA、10 份文档的非空 finding 链接;精确映射及全 334 键摘要冻结在
`research/week-audit/2026-08-23-review-finding-anchor.json`。空 finding 明确不等于人工判绿。

## 2. 覆盖与复现

| 项 | 数量 | 判定 |
|---|---:|---|
| 主线提交 | 115 | `8a8247a..3fccf4a`,逐提交列路径、文档、实现、测试与分类 |
| 已记录 ref 宇宙时间窗提交 | 131 | 主线 115 + 额外 16；不外推到事后已消失的 ref |
| 额外引用 | 16 | 5 个公开 snapshot 逐一验证允许删除集 + 11 个 tree-equivalent;独立未合并实现 0。snapshot **commit** 与可重算的 public tree object digest（该提交 `^{tree}`，快照说明 `public-tree:` 行）是两个 git 对象，不得混称。旧公开快照 commit `2bb91011cacc889c4ab8c2504e3b74871bd4c169` 的 tree digest 为 `0fa18ac3e7c16c91ac21b1addce886e6ed1a4961`。 |
| 变更路径 | 434 | 全量 `git diff --name-only -z` |
| 文档型资产 | 219 | Markdown 154 + 站点/证据/许可证等 65 |
| 提交分类 | 115 | paired 29 / document-only 48 / implementation-only 38 |
| 文档状态 | 219 | 同提交实现或测试 149 / 合同或发布文案纯文档 17 / 档案与证据 53 |
| 回修提交与文档 | 见 remediation ledger | `3fccf4a..最终实施冻结 SHA`;逐提交 `relatedDocumentRefs` 与逐文档反向边 |
| 活跃文档相对链接 | 96 | Markdown 内联/引用式链接及两个 Pages 根的 HTML `href/src`;broken 0 |
| 当前修复工作树 | 逐路径冻结 | 七个自引用账本输出单独摘要闭环,review finding anchor、cross-links 与其余 staged/unstaged/untracked 全量记录 |

复现门禁:

```sh
node scripts/week-audit.mjs --check
node scripts/check-doc-links.mjs
```

## 3. 提交 -> 文档:115 个提交的机械覆盖与已记录发现

账本 §1 已逐行列出 115 个提交。本节给出语义裁决,同组内每个 SHA 都已经在账本保留完整
路径,这里不重复数百行路径。

### 3.1 implementation-only 38 个

这些提交没有“同一提交”的文档,但逐项追到相邻或后续合同/计划/证据后,没有发现真正无文档
承接的功能。不能据此把 38 个提交误报为 38 个漏文档。

| 承接主题 | 提交 | 文档侧裁决 |
|---|---|---|
| provider 与安全 floor | `50193f3` `03c6d54` | 既有 09/10 合同已覆盖输出预算和代码执行风险;测试是合同加固,不新造产品语义 |
| 四端名称与 emoji gate | `b13b744` `2402143` | release 材料、站点与 LICENSE 批随后统一承接 |
| cmdEffect 三轮加固 | `e79d1d8` `068e392` `115353e` `adc2b9a` | IMPL-PROMPT-9、`cmdeffect-hardening` evidence 与三轮 review 完整承接 |
| 模板与 launchd | `122d101` `f69ea43` `66412d6` `e88d9d1` `5827de2` | public-readiness 计划/evidence、官网 Docs 与模板合同承接 |
| Demo 小样链 | `8e6c819` `3c9c52b` `5c48eb4` `81e6b9a` `2260033` `3badf47` | 07 D14、S1 evidence 与 review 80 承接 |
| 回叫链 | `dedd327` `37b349a` `8ec247e` | 04 §4、S2 evidence 与 review 81/83 承接 |
| W5.4-a Claude 纯函数层 | `5195164` `0ae8692` `16d24eb` `f1a5d28` `70ef24a` `6313766` `56f0731` `54b981c` | W5.4 方案、w54a evidence 与 review 82/84/85 承接 |
| Windows/Linux 适配 | `ef444cb` `3279c0f` `316f031` `0cad56e` `2cec464` | ADR-003/004、WINDOWS/LINUX-ALIGNMENT 与 evidence 88 承接 |
| W5.4-b C1/C2 | `4c4bf96` `3bf3d10` | 09、ADR-002、IMPL-PROMPT-15、w54b evidence 与 review 90–92 承接;本轮补 C1 init/C3 |
| 备份身份锚 | `d406387` | docs/09、HANDOFF、对账 F17 与备份现场复验承接 |

### 3.2 document-only 48 个

48 个纯文档提交覆盖 evidence/review/journal/开批交接以及 canonical、计划、官网和 release
口径;它们本来就不应为了“配对”而伪造同提交代码。以下 48 个 SHA 各出现一次:

`aac3d60` `35604be` `bc2ac87` `26d32e8` `15de970` `de6d685` `fdde42d`
`74dc924` `b604cf1` `cb2fba8` `1ee5622` `29f33cf` `0649107` `96946e1`
`7382f9c` `33c5cf1` `60e1147` `39dbaef` `6e0a9b2` `40810a3` `832e934`
`c207729` `63600c6` `ce7e7a7` `c384687` `243a4c8` `b5796a5` `f104563`
`52c10d5` `0642260` `a356780` `876f29d` `fa921a7` `a6a79ec` `f04b898`
`6365513` `088b8f0` `05bc91d` `fcd2f9e` `5a73420` `5036bee` `cdf49f2`
`a26d5bf` `82c77e3` `fb16fb8` `19be5aa` `92d5b55` `3fccf4a`。

语义复核发现其中发生当前状态漂移的不是历史 evidence,而是 PLAN-2、HANDOFF、03–07、
modules/c、官网 Docs 与 `docs/11` 的现时态,见 §5。

### 3.3 paired 29 个

29 个同提交带文档和实现/测试的提交不等于自动正确。逐个复核后,需要修的集中在 W5.4-b、
跨平台发布与状态回写;其余对偶成立。完整集合:

`789b76d` `af5d0b1` `3197fd8` `addfd19` `354b028` `ed8b0f3` `f7d7492`
`1a41b45` `93eb814` `2d7e363` `9224fb9` `d2d7a31` `aa2dffc` `7fb3fa1`
`55a224d` `693475a` `1679078` `920af91` `11e3653` `1482510` `479634c`
`ad8adb1` `4d2824e` `058090d` `1d6680c` `afd31b4` `1d1d822` `a971519`
`6d98a6e`。

## 4. 文档 -> 提交:219 份文档型资产的机械覆盖与已记录发现

账本 §3 对 219 份资产逐行给出触及提交、同提交实现、同提交测试与状态。按文档职责聚合如下:

| 类型 | 数量 | 裁决 |
|---|---:|---|
| canonical | 13 | 09/10/11 与 ADR-002 的合同形状有实现锚;03–07、modules/c 的 Agent SDK 现时态漂移已改成 CLI hooks |
| plan | 16 | 历史计划保持原时点;唯一排产源 PLAN-2 只标 W5.4-b 收口候选,复审与 Windows 证据齐备前不关批 |
| website | 27 | 原 source-only 入口与平台口径已对齐 GitHub Release；rc.2/rc.3 首次门失败后，当前中英首页、Docs 与内容稿统一指向 rc.4 候选 |
| root contract | 5 | README 增加无源码快速启动;HANDOFF 在最终提交/部署后刷新三层时钟 |
| evidence | 37 | 不回写历史红灯;`w54b-batch.md` 以新 §10 supersede 旧现势,保留原始时间点 |
| review | 7 | 作为评审结论保存;本报告对前一份 crosscheck 的新漂移作 supersede |
| review input | 69 | prompt/Codex 报告只作证据,不拿其自报代替代码或门禁 |
| archive | 21 | 原始材料保持不可变语境,不把旧路径/旧状态当当前合同 |
| supporting doc | 24 | 许可证、平台说明与辅助文档逐项追到相邻实现/evidence |

## 5. 发现、方向与修复

| 编号 | 不一致或缺口 | 对齐方向 | 处置 |
|---|---|---|---|
| F18 | 没有可复现的 115 commit / 219 doc 双向总账 | 增加证据工具 | 新增冻结账本生成器、Markdown/JSON 输出与固定计数门 |
| F19 | C1 验收写了真实 init,实现只有版本/身份检查 | 对齐实施到已批准验收 | 新增空 cwd、零工具、30s/1MiB 的 `system/init` 探针,环境白名单与生产 spawn 同源 |
| F20 | C3 明确在计划但未实施 | 对齐实施到合同 | 设置页 Tier1 卡、任务 observed model、blocked 人话、跨平台认证与 backend prompt 隔离全部落地 |
| F21 | 03/04/05/06/modules/c 仍把 Claude Agent SDK 写成当前主档 | 对齐文档到 09 与物理实现 | 当前主档改为 `claude -p` + CLI hooks;Agent SDK/live steer 只保留未来候选 |
| F22 | 官网写成“只能源码运行”,但仓内已有可分发 CLI | 补实现并对齐文档 | 固定 tarball、一次运行/全局安装两条路径;诚实注明只含 daemon + console；rc.2 由 F98–F101 升为 rc.3，rc.3 再由 F106–F107 升为 rc.4 |
| F23 | CLI 仍是 0.0.1,包内无 README/LICENSE/NOTICE | 对齐发布身份与 Apache-2.0 | 当前版本 `0.1.0-rc.4`,包内法务副本逐字校验,只打包 dist、package.json 与四份包文档 |
| F24 | 分发 verifier 把已有 daemon 误判成可绑定端口 | 修实施 | 先真实 TCP connect 判断占用,再做 bind 探针;47100 冲突保持与默认端口生命周期都复验 |
| F25 | CI 没有完整桌面分发门 | 补实施 | 发布前 `distribution` 与发布后固定 URL smoke 均覆盖 Ubuntu、macOS、Windows |
| F26 | `docs/11` 仍写 29 failed / 3 passed | 以现行 IA 与真实门禁为准 | 修 Focus ID、Today/Dashboard 路由、首启 peek、云语音 peer、过期 parked fixture;36/36 绿后回写 |
| F27 | 额外 16 个引用可能被误判为漏合并 | 以 tree 与 snapshot 实际差异为准 | 5 个 public snapshot 验证为同树或仅删除私有软著材料,11 个 tree-equivalent;独立未合并实现 0 |
| F28 | PLAN-2/HANDOFF/w54b evidence 的现势互相冲突 | 保留历史,刷新唯一现势 | PLAN-2 与 evidence 新增收口口径;HANDOFF 待最终 SHA、runtime 与上线结果一次刷新 |
| F29 | Claude 自检继承宿主认证环境、init 校验过松且 symlink 身份可分叉 | 对齐安全合同到实施 | 版本/认证/init 共用剥离环境;严格校验完整 init/result;二进制与 workspace 按 realpath 登记 |
| F30 | 并发自检共用临时身份文件且可互相覆盖 | 修实施 | 临时文件加入 UUID,同一身份目标串行化,并发回归测试覆盖 |
| F31 | Tier1 四类 blocked 的屏幕/语音/回叫话术分叉 | 合同单源 | 新增 contracts presentation 函数,屏幕与 callback 同源,语音继续走脱敏投影 |
| F32 | terminal settle 同时落非 canonical action,审计口径冲突 | 对齐实施到 09 | 每次 settle 只落一个 canonical terminal action,删除分叉 action |
| F33 | coding 任务按 task 状态把全部验收项伪显示为 pass | 对齐实施到 acceptance oracle | settle 持久化逐项 `AcceptanceCheck`;无一一证据绑定时只显示 `unknown`,UI 不再推导绿色 |
| F34 | 冻结账本不覆盖工作树,公开 snapshot 只信标题,语义状态由规则自称 reviewed | 补机械证据并划清人工边界 | 工作树内容快照;snapshot 逐树验证;JSON 只声明机械覆盖与 finding 链接,不再自动生成逐项正确性裁决 |
| F35 | 旧 tarball 可与 checksum 自洽却不含当前 daemon | 对齐发布物到当前源码 | 每次 check 先重建,逐 tar member 对当前 dist;build identity 绑定源码输入;连续两次打包哈希一致 |
| F36 | 分发门未真跑 Windows shim,也未验证固定 URL/空全局环境 | 补发布前后两层门 | Windows 经 `saydo.cmd`;发布后从空 cache/prefix/home 全局安装,真启停并查孤儿进程 |
| F37 | Playwright 直接写 localStorage,未验证桌面 fresh-origin 逃生口 | 修测试 | 新 daemon/origin 真点击 `peek-anyway`,校验进入正式页、持久化与 reload |
| F38 | 官网 Claude 状态、环境 allowlist、Touch ID 与实际合同漂移 | 以 canonical/实现为准 | 中英源稿及 HTML 对齐 cursor/Claude/Codex 状态、POSIX/Windows 环境集与平台中立认证 |
| F39 | CLI 只有直接版权声明,缺第三方依赖 notices | 对齐发布法务 | 从已安装的 production dependency closure 生成并校验 `THIRD_PARTY_NOTICES.md`,当前覆盖 59 个分发依赖 |
| F40 | 链接门只扫 56 个 Markdown 且语法不全 | 扩大门禁 | 覆盖 95 个活跃文档/站点/package README,解析 Markdown 内联/引用式与 HTML 相对资源 |
| F41 | W5.4-b 在独立复审前被写成已收口 | 保留历史并纠正现势 | PLAN-2 与 evidence 只标收口候选,复审和 Windows 真机证据后才允许关闭 |
| F42 | 新验收保护使缺失或伪造 DecisionPackage 的旧分发/故事 fixture 在恢复后阻塞 | 保留生产 fail-closed,修测试事实 | 合法 dispatch fixture 持久化正文并按 JCS 计算真实 digest;另保留正文缺失、正文篡改必须 blocked 的反例,恢复与分发全链重跑 |
| F43 | 最终工作树继续变化时冻结账本仍可过期 | 冻结候选而非冻结口号 | ref tip 改为冻结时刻之前的最后提交,工作树逐路径记录 mode/bytes/SHA-256;最终停止写入后重生成并同时跑完整模式与无私有对象 bundle 模式 |
| F44 | rc.2 旧 tgz 可与自身 checksum 自洽但落后当前源码 | 发布物必须绑定最终源码 | check 每次先重建并逐成员比较;最终候选连续两次独立 pack 字节一致,不复用旧 artifact |
| F45 | coding approve 缺失、畸形或漂移 DecisionPackage 时可 fail-open | 对齐 09 的 package 三元组权威性 | 批准事务内加载并严格解析 package,核对 project/revision/digest、重算 digest 与 acceptance exact-set;任一不符拒绝 |
| F46 | settle 的 run/task/outbox/audit 分段提交存在崩溃窗,且 outbox 任意写失败被误当 dedupe | 对齐 durable 原子结算合同 | `commitSettle` 将 proof、task 转态、回叫、outbox 与 canonical audit 放进单一 SQLite transaction;只有实际存在同 dedupeKey 活跃行的 UNIQUE 冲突可幂等,其余异常上抛;两种注入失败均验证整体回滚 |
| F47 | `pass/fail` 可缺 `evidenceRef`,仍会在屏幕显示为已通过 | 缺证据恒 unknown | schema 强制非空 evidenceRef;legacy/畸形 proof 在 API/UI 降级 unknown;approve 再做 exact-set 与证据结构校验 |
| F48 | 发布脚本可从脏工作树、错误分支或错误 remote 发布旧 HEAD | 发布动作绑定已审 SHA | 要求 clean main、origin/main upstream、完整 expected SHA 与精确公开 remote URL;公开 main+tag atomic push;release workflow 自跑完整质量门 |
| F49 | bundle 只自洽,缺冻结 ref manifest 与公开外部锚 | 提高可独立复验性 | 记录冻结时刻的 ref→tip、history digest、公开 tree 过滤证明与预期 tag;公开 tag workflow 运行 `--check-bundle` 形成不可移动锚 |
| F50 | 单次构建和直接 URL 安装不能证明可复现及线上字节身份 | 双构建+先验字节核对 | 两个隔离 pack 目录比较完整 tgz;包含 package manifest;URL verifier 先下载 tar/checksum/metadata,核对 SHA-256、SHA-512 integrity、bytes、entryCount、版本、source/build/protocol 后才安装 |
| F51 | notices 扫描漏 `LICENSE-MIT.txt` 一类文件 | 对齐真实分发法务闭包 | 扩展 LICENSE/LICENCE/COPYING/NOTICE 候选匹配,发现候选却未收正文即失败;重生成后覆盖 59 个运行依赖 |
| F52 | rc.2 尚未发布却被写成当前可用,Claude FAQ 又按 Cursor 排障 | 发布事实优先于营销文案 | 发布前所有入口统一为“候选,Release 出现且 smoke 绿后可用”;FAQ 按 Cursor/Claude/Codex 分支,availability 另做 post-release 提交 |
| F53 | canonical 要求 `kind:"tier1"`,严格 schema 却只接无 kind | 对齐实现到 canonical 判别联合 | 新 proof 恒写 `kind:"tier1"`;旧数据仅在明确 legacy normalization 中补默认,round-trip 测试覆盖 |
| F54 | 第二 Pages 根、fresh-origin 与发布后部署次序没有机械闭合 | 扩门并固定顺序 | 链接门扫描两个 deploy root并接入 CI/release;全量 Playwright 进入发布前门;顺序固定为 internal SHA→public main+tag→全部 post-smoke→availability main→两站 Pages→生产复核 |
| F55 | terminal action 与 UI AcceptanceCheck 在消费者侧重定义 | 契约单源 | contracts 导出 terminal action schema/type;daemon 与 console 直接 import;UI 直接消费 `AcceptanceCheck` |
| F56 | canonical 只列 `better-sqlite3`,实际还 externalize `koffi` | 对齐文档和分发门到实现 | 09 明列两个 native external;安装包测试从 tarball 真加载 `koffi.load` 与 `better-sqlite3` 后再启服务 |
| F57 | settle、coding approve、writing approve 可读取另一项目的 DecisionPackage | 项目身份必须 fail-closed | package DB 列、body 与 task/run 的 projectId 必须一致;三个入口均增加跨项目反例,存储回读另核对 id/revision/projectId 三个身份列 |
| F58 | Release 发布前未验证资产 exact-set,首次公开又可能把未过 smoke 的 immutable 资产显示成可用 | 对齐 GitHub immutable release 生命周期 | draft 先写 pending/unavailable 标题正文→上传三项 exact-set→非空校验→publish→immutable 校验;六项 fixed-URL smoke 全绿后才改 title/notes 为 available 并回读;重跑永久门另由 F75 收紧 |
| F59 | 机械模板与路径候选曾冒充逐项人工语义裁决 | 删除伪人工字段,只保留可证边界 | semantic schema 6 从 commit/document rows 删除 `decision/claim/rationale`;逐 SHA/逐文档绑定真实 diff hunk、blob、bytes 与内容 SHA-256;顶层人工 finding 决策保留,空 finding 不判绿;integrity schema 5 与公开 bundle 校验主账本、回修账本和全树 exact-set |
| F60 | availability 文案与两套 Pages 部署次序仍靠人工记忆 | 发布事实成为机械前置 | 精确核对 immutable Release、三项资产、tag SHA、指定 workflow 与六项 fixed-URL smoke;availability 后要求完整 clean、origin/main、internal/public 全树仅完整删除私有登记 exact-set;固定 Wrangler 4.112.0 部署两站并检查五个入口 |
| F61 | Actions 使用可移动 major tag,release tarball 独立 check 未覆盖成员类型和全量集合 | 收紧供应链输入与独立门禁 | Actions 全部固定 commit且 checkout 不持久化凭据;tarball 必须等于当前 `dist` 递归全量文件 + 五份包文档,只允许普通 0644 文件,拒目录、重复、特殊类型与路径穿越 |
| F62 | daemon 进程测试健康窗口仅 8 秒,短于文档明确的 10–15 秒冷启动上界,全套件并行时产生假红 | 测试门对齐受支持启动合同 | helper 窗口收紧为完整 15 秒上界;原红灯单例连续重跑三次通过,最终仍须以全量 `just ci` 复跑为准 |
| F63 | failed/blocked 事务回滚后的收口意图只留在 executor 内存,daemon 重启会重新 spawn agent;pending 又可覆盖稍后到达的用户取消 | durable 意图与用户动作优先级对齐 canonical | DDL v31 新增 `finalize_pending_json`;终态事务前先持久化原意,恢复只重试收口且 spawn=0,成功或 cancel/steer 结算时原子清除;failed/blocked 各有跨 executor 与取消竞态反例 |
| F64 | 原生会话恢复身份不符时曾先写 failed 再终止 agent,提交后崩溃可遗留仍能产生副作用的孤儿进程 | 进程退出证明先于任何终态 | 恢复链改为 kill、等待进程组退出并清 owner 后才 finalize;统一守卫拒绝所有 `agentOwnershipEstablished && !processGroupVerifiedExited` 的失败终态提交 |
| F65 | agent 成功退出后先清 restart marker、后跑 verify/snapshot/settle,daemon 中途崩溃会重复 spawn | 成功终态也必须先有 durable 意图 | `finalize_pending_json` 增加 review 联合分支;先持久化 observed model/event cursor 并清 restart marker,恢复只续 verify/snapshot/settle、spawn=0,review 事务内原子清 marker |
| F66 | cancel 自愈首次结算失败后可能被误分类为 steer,请求阶段的 task/run/outbox/audit 也可半提交 | 用户动作与审计同事务且按 durable 状态重读 | reaper/gate 在异步等待后重读 task/run,`cancel_settled/cancel_requested` 保持 cancel 优先;cancel、steer、终态及恢复审计事务化,注入失败后同进程可重试收敛 |
| F67 | writing approve 只相信旧 artifact/proof,且 Windows 反斜杠路径可越出 worktree | 批准树与成稿字节必须不可变同一 | article path 同时按 POSIX/Windows 边界规范化并拒绝绝对/盘符/UNC/穿越;批准事务内重读 package/proof/artifact,用 `git cat-file <tree>:<path>` 对齐批准树、artifact 与 digest |
| F68 | coding/writing Review 消费端仍可用 task 终态伪造 pass/fail,owner 写作裁决又未投影成逐条证据 | 逐条 AcceptanceCheck 只认结构化证据 | API/mapper 删除状态推导;pass/fail 必须有匹配 criterion 与非空 evidenceRef;writing owner 审计作为 `audit:<id>` 的逐条 pass 收据,异常或旧数据保持 unknown |
| F69 | Windows npm `.cmd` 经 shell 会拒绝合法多行参数或暴露元字符解释面 | 不经 `cmd.exe`,只接受可证明模板 | 解析完整官方 npm Node cmd-shim 模板并提取唯一 JS 入口,用 `process.execPath` 直接传 argv;合法 `..` 全局安装布局、空格/多行参数、额外命令和非模板拒绝均有回归测试 |
| F70 | review 的 outbox/audit/成本终态事务失败会被 crash handler 改写成 failed | 非业务 settle 故障保留原意 | 所有此类异常只记录 `tier1.finalize_transaction_failed` 并保留 durable review marker;解除注入故障后同 run 幂等进入 ready_for_review,不产生 failed 副作用 |
| F71 | review marker 不含 resultEvent,重启后真实 usage 被永久写成 unavailable/0 | 成本证据随终态意图持久化 | 新 review marker 必带原始 result;旧 marker 只从 eventLine 以内 durable NDJSON 修复,缺失 fail-closed;恢复测试逐字段核对 token、turn 与估值 |
| F72 | mtime/size digest 缓存允许同尺寸并恢复时间戳的 Claude wrapper/JS 替换 | Tier1 身份门逐次重哈希 | BYOA 缓存不变,Tier1 每次 spawn 前对 wrapper 与 runtime target 全量 SHA-256;同尺寸同 mtime 反例必须拒绝 |
| F73 | writing 终态事务反复失败时每 tick 新建一个不可达 article artifact | 产物引用先 durable、写入 exact-replay | review intent 在写文件前固定 article id/version/tree/path/digest;ArtifactStore 已存在时全字段与内容复验,重试始终只有一行一文件 |
| F74 | 首轮账本停在 3fcc,后续回修提交未进 commit/doc 双向覆盖 | 主账本不改历史,增加连续回修账本 | 新 remediation JSON/Markdown 精确覆盖 `3fcc..最终实施冻结`;implementation-only 必须有 cross-links,文档侧反向集合机械复验;证据载体因 SHA 自引用明确排除 |
| F75 | fixed-URL smoke 首轮失败后可用 Actions rerun 覆盖 unavailable title/body | 同 tag 首轮失败永久不可用 | available job 拒绝 `run_attempt>1`;post-release gate 从 REST 重读 attempt=1,任一失败只能发新 rc |
| F76 | availability/部署证据写回会让 publication manifest 漂移,部署又只信本地 tracking ref | 状态写回与 bundle 同提交,远端 SHA 现读 | write-availability 与 deploy 强制落 evidence 并自动重生/复核 bundle;部署核对 origin push URL 与实时 `ls-remote origin/main` 后才上传 Pages |
| F77 | fixed URL verifier 只验基础健康与 status,低于计划的完整安装形状 | 线上不可变字节直接跑完整 smoke | exec/global 六项都验证 protected summary、重复 `up` attach、attach 客户端独立退出、owner 仍存活、最终优雅停止和零孤儿;本机 Mac/实体 Windows 再复验后才改官网 availability |
| F78 | callback engine 若静默拒绝且返回空 entry,review 事务仍可推进 `ready_for_review` | durable outbox 是 settle barrier,空 entry 必须失败 | `commitSettle` 要求非空 `entryId`;注入“未抛错但未持久化”后 run/task/outbox/audit 全回滚,恢复引擎后幂等收敛且只落一条回叫 |
| F79 | `claude_code` 切回 `cursor` 时恢复身份检查被跳过,可跨后端 spawn | adapter durable 身份双向 fail-closed | 所有恢复 spawn 前无条件比较 row adapter 与实际 backend;cursor→claude 与 claude→cursor 都转 blocked 且 spawn=0 |
| F80 | adapter mismatch 的 run/task/outbox/audit 分段提交,回叫失败会留下不可恢复半终态 | 复用 durable failure intent 与统一终态事务 | mismatch 只先写 `finalize_pending_json`;run/task/outbox/canonical audit/cost/marker clear 统一由 `finalizeFailure` 原子提交,注入失败整体回滚并可同进程重试 |
| F81 | 恢复只信 DB cursor/marker,忽略已落 `events.jsonl` 的更多行 | durable 事件文件是恢复游标与 usage 来源 | 所有 active recovery 先按原 adapter 重放 durable 行,恢复 eventLine/model/result;marker 存在时以 marker 行为上界,取消/steer 也写唯一成本行 |
| F82 | Cursor result 已回 usage,adapter 却只保留 text 并把 token 记成 unavailable/0 | 对齐真实 Cursor camelCase 到 canonical cost 字段 | 严格校验四个非负整数并归一化 input/output/cache read/cache write;fixture-backed 正常 settle 与重启取消均核对成本 |
| F83 | availability/部署在私有树误跑公开 `--check-bundle`,且 Pages 上传前未确认公开 bundle | 私有完整树与公开过滤树分门,外部写前先验公开 SHA | internal 状态写回用 `--write`+`--check`;deploy 先绑定 public/main exact tree,再要求同 SHA 公开 CI 全绿且 node job 已跑 `--check-bundle`,之后才允许 Wrangler |
| F84 | Actions 六项 smoke 一绿即可翻官网,未机械消费本机 Mac 与实体 Windows 复验 | availability 必须绑定四份实体主机证据 | Mac/Windows 各跑 exec/global,证据绑定固定 URL、tag/tarball/source/build/runtime identity、Node 22、attach/停止/零孤儿且拒绝 GitHub runner;四份缺一即拒写 availability |
| F85 | 中英首页与 Release notes 只展示一次运行,常用全局安装不可发现 | 对齐已批准的双入口验收 | 首页、内容稿与 Release notes 同时展示固定 URL 的 `npm exec` 和 `npm install --global`+`saydo up`,Docs/README/package README 保持同口径 |
| F86 | fixed URL 验证器从 `node:path` 导入不存在的 `realpathSync`,发布后六路 smoke 会在启动时全部失败 | 修实现并让 CI 真启动发布脚本 | 从 `node:fs` 导入;实体发布证据自测要求无参启动必须精确返回用法与 exit 2,模块导入/顶层启动错误会提前红灯 |
| F87 | restart review intent 真实 Git 夹具的内部等待与整例上限同为 15 秒,全套件满载时框架先于断言收口而假红 | 保留断言,只给目标竞态分层超时 | 内部 durable intent 等待 30 秒、整例 45 秒;单进程定向 1.08 秒通过,最终全量内同例 1.50 秒通过,不改生产逻辑或成功条件 |
| F88 | publication manifest 与工作树快照记录生成时 `HEAD`,纯证据提交一落地就让 clean `--check` 自己判漂移 | 自引用字段改为稳定实施边界 | publication schema 2、integrity schema 6 只绑定最终实施 SHA,同时继续冻结非生成文件 exact-set/模式/字节/摘要;内部 check 另要求实施边界是当前 HEAD 祖先,证据载体提交后可重放 |
| F89 | availability 接受四份自报 JSON,手写 platform/checks/hostFingerprint 也能通过;计划还把私有 SSH 地址写进公开文档 | gate 直接实跑并收紧隐私边界 | write-availability 从 clean main 直接运行两次 Mac verifier,再经系统 OpenSSH、owner-only known_hosts、literal IP 与禁 forwarding/proxy/control 的固定连接运行两次 Windows verifier;四个随机 challenge、已审工具 SHA 与 immutable tag SHA 全绑定后由 gate 原子晋升证据目录,不再读取预制 JSON;公开文档只保留哈希化连接锚 |
| F90 | ref manifest 在冻结后补录,不能证明此前已删除或强制移动的 ref 不存在 | 把结论降到证据可证明边界 | 报告和生成账本统一改称“已记录 ref 宇宙”;脚本拒绝提交时间晚于冻结上界的 tip;未来 freeze 先原子留存本地与远端完整 ref 清单、时间和摘要,历史盲区不伪造回填 |
| F91 | OpenSSH 会把远端参数交给默认 shell 解析,直接传 node/path/url 不能视为安全 argv | 固定远端入口与请求语法 | 上传同 tag 受审的 PowerShell wrapper;SSH 只传 base64url 严格 JSON,wrapper 在 `-NoProfile -NonInteractive` 下校验 exact property set、固定 URL、mode/challenge/path 后用 PowerShell 参数调用 Node并透传退出码 |
| F92 | 公开发布允许环境变量把私有探针换成任意文件 | 发布隐私门固定锚 | 所有公开快照都强制 realpath 等于 Git common dir 的固定探针文件,要求 regular、非 symlink、当前 owner 与 owner-only 权限及至少一条有效规则;输出只含路径 SHA-256 |
| F93 | CI token 未声明最小权限 | 默认只读,发布 job 单独升权 | `ci.yml` 顶层固定 `contents:read`;release 继续顶层只读,仅 publish/标记状态 job 使用 `contents:write` |
| F94 | available 写入成功而 readback 失败会留下“页面可用、job 红”的半状态,post gate 又只排除 fail 字样 | exact readback 与失败回退 | available job 用 EXIT trap 最多六次回退并读回 unavailable;成功只认 title 与冻结 release notes exact match;post gate 再独立执行同一 exact readback |
| F95 | review 终局意图与 restart marker 可同时存在,终态事务失败后重启会被 marker 永久打断 | 终局意图优先且两类 marker 互斥 | 写入或恢复到 `finalize_pending_json` 后清除 restart marker;停机只中断进程,不再为该 run 写 restart;恢复只做 settle,成本/outbox/audit 注入失败解除后可幂等收口 |
| F96 | adapter 漂移检查位于工作区预检之后,工作树缺失时会先走不一致清理而跳过跨后端保护 | adapter 身份先于 workspace 可用性 | 对所有 running recovery 无条件比较 durable adapter 与实际 backend;即使 worktree 已删也先写 blocked failure intent,双向漂移均 spawn=0,终态事务失败仍可原子重试 |
| F97 | 恢复前已落盘的旧 success result 可被新进程继承,造成旧用量与新执行串代 | 每个进程代际独占终态 | recovery 在任何 spawn 前识别未绑定 finalization 的 durable result 并 fail-closed;旧活进程先按 ownership 回收,不再 spawn;成本只登记旧 result 一次,ready_for_review 回叫为零 |
| F98 | rc.2 在 Windows 被 pnpm 冗余触发 `better-sqlite3` 本机编译，GitHub runner 缺兼容 C++ 工具链 | 选择无本机编译的受支持安装合同 | 升至 `better-sqlite3 13.0.3`；pnpm `allowBuilds` 只拒绝该包的冗余脚本，必要的 `esbuild`/`koffi` 继续放行；实体 Windows 空目录 frozen install 与 SQLite 查询通过 |
| F99 | rc.2 Linux 恢复夹具依赖 5ms 事件调度，终止期 stdout `ECONNRESET` 又会泄漏成 Vitest 未处理异常 | durable 事实先于断言，终止期流错误必须收口 | 四个反例等待 `events.jsonl` durable 行；只忽略终止期 `ECONNRESET`，其它 stdout error 记录并令命令失败；daemon 全套及五轮压力复跑通过 |
| F100 | Windows `.cmd` 二次转义、管理员 token 默认 owner 与 wrapper 管道句柄共同使真实安装门失败 | 对齐 Win32 真实进程与 ACL 合同 | `.cmd` 使用外层引号 + verbatim arguments；Administrators owner 同次写入改归当前 SID，SYSTEM/陌生 SID 拒绝；PID 退出后关闭本地 stdio、等待 close 再有限重试 EBUSY，夹具改标准 npm Node shim |
| F101 | rc.2 已成为失败 tag，若移动或重跑会抹去首次运行证据；但未创建 immutable Release，也没有 tag ruleset | 保留失败证据并以流程纪律锁定 | 保留 rc.2 与 Actions `32616479767`/`32616480151`，明确“按发布纪律不得移动、不重跑”而非技术不可变；rc.3 主修复为 `23c2251`，最终评审回修为 `08b7610` |
| F102 | SYSTEM 进程面对 SYSTEM owner 会先命中 `owner===current` 而错误 keep；Administrators/current 也可原地保留 | 禁止系统身份成为最终状态根 owner | SYSTEM 出现在 owner 或 current 任一侧均拒绝，current 为 Administrators 也拒绝；三条反例补进纯函数测试，实体 Windows native readback 全绿 |
| F103 | Win32 `BOOL/LPBOOL` 被 Koffi 1-byte `bool` 错绑，且 SID/SDDL 系统分配字符串未 `LocalFree` | 对齐 Win32 32-bit ABI 与系统所有权合同 | 全文件 Win32 BOOL 改为 `int32`，LPBOOL 改 `int32 *`；系统分配字符串以原始指针读取、`string16` 解码并在 finally 释放；实体 Windows platform 13 项与完整 distribution 通过 |
| F104 | Playwright 截图直接写仓库内状态根，公开图会暴露本机路径；主题又被初始 effect 竞态覆盖，暗色图可能实际为亮色 | 公开证据必须匿名且可判定 | macOS/Linux 测试状态根固定到无用户名的系统临时目录；亮暗主题先持久化、重载，再断言 `data-theme` 后截图；最终关键图目视复核，定向门与全套 Playwright 均通过 |
| F105 | `HANDOFF.md` 的现行发布门仍把待发布候选写成 rc.2，报告又把流程纪律简写成技术不可移动 | 历史事实与现行候选分层 | rc.2 历史失败记录保留；未来门禁统一指向 rc.3，旧 tag 明确为“按发布纪律不移动、不重跑” |
| F106 | rc.3 的 Windows Git checkout 因 `core.autocrlf` 把受控法务文件与构建输入改成 CRLF | 跨平台同一 Git 树必须派生同一字节 | 新增仓库级 `* text=auto eol=lf`，并把 `.gitattributes` 纳入 CLI source revision；`core.autocrlf=true` 对照 checkout 从 1513/212 个 CRLF 降为 0/0 |
| F107 | rc.3 Linux 终止受管进程组时，主 agent 与 runtime wrapper 的 stdio/control pipe 仍可把 `ECONNRESET` 泄漏为 Vitest unhandled error | 运行中错误 fail-closed，明确丢弃的流仍以 child exit/close 为权威 | agent、BYOA 与受管命令活动期 stdout/stderr 错误进入有界诊断并失败，只忽略收口期 `ECONNRESET`，且本地 pipe 错误不得触发网络重试；统一 spawn 边界消费 `ignore` stdin/stdout/stderr 与 permit pipe 错误；跨 executor 夹具先等原终态事务真实红灯再模拟重启 |
| F108 | macOS 通过 `npm exec` 前台运行时，一次 `Ctrl+C` 被终端进程组与 npm 包装层瞬时重复投递，supervisor 误走 repeated-signal 强停 | 合并同一物理按键的瞬时重复，同时保留真正二次信号的紧急出口 | 同种 OS signal 在 50ms 内只入队一次；不同 signal、显式 `cli-stop-*` 与窗口后的第二次 signal 保持原语义；CLI 24 passed/1 skipped，最终 tarball 真机输出 `daemon stopping reason="cli_sigint"`、前台 exit 0、状态/监听/PID 全归零 |

### 5.1 独立评审状态

- `final_code_security_review` 在 `bb9d287` 候选发现审批后 eligibility、review 取消优先、快速退出
  tombstone、writing 原始字节、Windows shim、Release readback 与 private probe 问题;当前实现及反例已逐项吸收。
- `freeze_security_review` 零上下文复审发现 F70、F71、F73、F75 与 availability bundle 漂移;
  `freeze_docs_release_review` 独立发现 F74、F76、F77 及报告措辞过宽。两路结论均为修复前 No-Go,
  不能当成修复后通过;修复后以真实门禁和最终只读 readback 收口。
- `freeze_final_security` 对 `174ab48` 的零上下文复审再现 F79–F82；`freeze_final_release` 同一冻结提交
  再现 F83–F85，并指出纯证据载体尚未进入该提交树。两路均为 No-Go；当前回修分支先修实现，随后另建
  只含范围参数与生成物的证据提交，再对新的冻结 SHA 做最终 readback。
- `final_runtime_review` 对证据冻结后的候选做零上下文复审,发现 F95–F97 三条 P1；当前已由
  `877c875` 与 `3e74a5a` 回修并在 owner home 下实跑 `restart-policy`/`tier1-executor` 共 104 项全绿,
  daemon typecheck 退出 0。同一独立会话随后对 `81760a4` 差量复核,三条均判 `CONFIRMED_FIXED`,
  独立门禁为聚焦反例 8 passed/96 skipped、daemon 1883 passed/5 skipped,最终结论 Go 且无新增 P0/P1。
  剩余盲区是真供应商 CLI 恢复未跑,5 项 live 测试仍 skipped。
- `final_release_review` 对同一候选发现的实体门、ref 证据边界、SSH shell、私有探针、CI 权限和
  Release available 回读问题已形成 F89–F94 并回修。对 `81760a4` 的最终差量复核确认上述六项无新增
  P0/P1,但以唯一 P1 判 No-Go:生成物仍停在旧实施边界/schema。随后把最终实施边界固定为
  `3e74a5a`,将 `81760a4` 及本提交视为证据载体,重生 schema 2/6 bundle；内部 `--check` 已恢复为绿,
  后续公开过滤树的 `--check-bundle` 由 rc.3 最终发布复审一并完成。
- `rc3_runtime_review` 对 `23c2251` 首轮独立复核判 No-Go，发现 F102–F103；`08b7610` 已回修，
  macOS platform/typecheck 与实体 Windows platform 13 项、完整 CLI distribution 均复验通过，
  同一评审会话随后对 `7996311` 差量复核判 Go，无新增 P0/P1/P2。
- `rc3_release_review` 对 `23c2251` 首轮独立复核判 No-Go：唯一 P1 是 rc.3 证据包仍停在旧边界，
  P2 是 rc.2 “不可移动”的技术事实过宽。后者已改为流程纪律；F104 前移后统一以 `57d3e10`
  为最终实施边界重生 schema 2/6 bundle；对 `07c253d` 的最终复核又确认 F105 已关闭。全新
  公开过滤树 `f38b3d8c93c47adba09eb67882adee1d5f817108` 运行 `--check-bundle` 为 exit 0，结论 Go，
  无 actionable P0/P1/P2。
- rc.3 发布后的首次托管门又暴露 F106–F107；它们不在上述 Go 的本地/实体环境中可见。
  rc.4 修复必须在新的零上下文实施复审与发布复审后才可推送，不沿用 rc.3 的 Go 结论。
- 外部 Codex 108 与全新 session 112 都没有产生 final message。108 日志为 `1893732` bytes、
  SHA-256 `7669f8311c5adb809827b3f2b4716f855b8ef10d3d68a7e7b68acad6d3e2079f`;112 在 1200 秒
  守卫下 exit 124,日志 `1469747` bytes、SHA-256
  `bbf09c2f6d8b04d71bf87ab2748444f694e365ee448731f7e44015fcc1b51344`;两者 `turn.completed=0`。
  112 中间事件指出的 result/usage 恢复与 identity cache 风险由独立安全评审复现并形成 F71/F72,
  但不能据此伪造一份 Codex final。完整失败记录见 `research/codex-findings/108-*` 与 `112-*`。
- Grok rc.3 首轮实施日志 `logs/rc3-grok-implementation.jsonl` 为 `1921653` bytes、SHA-256
  `5171a10f76afb21611b9dfdfea9d6fd525f01e4d10e05504dedcc6bdd0393764`，终态 `end_turn`；
  后续 Windows ACL 追加尝试在零文件改动时因循环输出终止，exit 130，日志 `702824` bytes、SHA-256
  `71ab7a68a124dc88f1ca695612e0bae596dc19362b3a3d8acc8fadcc3f000a16`，不作为通过证据。
- Grok F108 施工日志 `logs/2026-08-23-rc4-f108-grok.jsonl` 为 `1504789` bytes、SHA-256
  `cadac83a2881a3fd3715524111fb9ae8e2c37f9e080a469de7ba3e8e5b511793`，终态 `end_turn`；其
  sandbox 内 supervisor 聚焦测试 5 passed/2 skipped，完整 CLI 门因 sandbox 禁止 `ps` 未通过。
  主会话在真实主机重跑完整 CLI 为 24 passed/1 skipped，并以最终 tarball 真机复验，未把 sandbox
  失败伪写成通过。

## 6. 快速启动方案裁决

| 入口 | 本轮裁决 | 理由与边界 |
|---|---|---|
| GitHub Release 固定 tarball + `npm exec` | 本轮首选并落地 | 无源码、一次运行、三平台共包；不可移动 tag、checksum、metadata 与六个发布后 smoke 绑定线上字节 |
| 固定 tarball + `npm install --global` | 本轮常用入口并落地 | 同一受验字节,安装一次后直接 `saydo up`;仍要求 Node 22 |
| npm registry 的 `npx @saydo/cli@<version>` | 代码已具备,等待 owner 手动发布 | 最短命令,但 registry 对外发布不在本轮自动授权范围；发布前官网不得展示为可用 |
| Homebrew / Scoop / winget | 延后 | 当前只会再包装 Node 与同一 tarball并扩大签名、撤回和更新面；等系统常驻安装器成形后再做才有净价值 |
| Docker | 不作为桌面默认 | 会隔开本机工作区、登录态 AI CLI、审批 hooks 与 localhost 控制台,与产品本机执行模型冲突 |
| `.dmg` / `.msi` / `.deb` | P2 | 应与菜单栏、Windows/Linux 常驻服务、代码签名和自动更新一起设计,不能把当前前台 CLI 冒充原生安装器 |

当前落地包只含 daemon + Web 控制台。可选语音 pipeline、macOS launchd、Windows Scheduled
Task、Linux systemd 与移动生产配对继续走各自阶段；这个边界在 README、官网中英首页、Docs、
package README 和 Release notes 一致呈现。

## 7. 已验证结果与诚实边界

本轮当前已取得的直接证据:

- rc.4 最终实施边界为 `b768089585d710255d61a693c2489ccf425f446f`：`951249e` 修 F106/F107，
  `b92b0ea` 修 Windows 标准 npm shim 与脚本 basename 夹具，`b768089` 修 F108。schema 2/6 bundle
  将以该实施边界重生；公开 `--check-bundle` 只在剔除私有软著材料后的过滤树运行。
- Mac 最终 `just ci` exit 0：contracts 111、platform 13、console 278、CLI 24 passed/1 skipped、
  daemon 1885 passed/5 skipped、pipeline 34 passed，emoji、颜色、迁移工具与实体发布证据自测同绿。
- Linux daemon 全套在 F107 修复后为 1883 passed/7 skipped、无 unhandled `ECONNRESET`；最终
  runtime-child + tier1-executor 为 111/111，CLI 为 24 passed/1 skipped，完整 distribution exit 0。
- macOS、Linux、Windows 的最终 distribution 均读回同一身份：
  `sourceRevision=043c335d6e6f6f5a293aa2b04a1c7282ff594a5f3249aceb3c60c126f93066b9`，
  `buildId=0.1.0-rc.4+043c335d6e6f.p1-0-0.c043c335d6e6f`；17 个包成员，生命周期与零孤儿门全绿。
- `pnpm exec playwright test`:[ok] 36 passed(2.7m),其中 11 路由亮暗主题均经重载后属性断言，
  22 张 PNG 均可解码，OCR 扫描未检出本机用户名、`/Users/` 或工作区路径；fresh-origin 真点击
  `peek-anyway` 并在整页重载后保持选择；F108 只改 CLI supervisor，未改 UI 资产。
- 最终实施冻结后重新执行 `build-release-artifacts --write/--check`；两次隔离构建字节一致。tgz 为
  `1146972` bytes、SHA-256 `d4ac2e2866a7ffb5191a8d4c3cea97b8581a7ecbe8380f698b42f661a1eb370e`、
  17 个成员，身份同上；独立 `--check` 为 exit 0。
- Mac 最终 tarball 真走 `npm exec`：status/health/ready/console/SQLite 通过，单次 `Ctrl+C` 输出
  `daemon stopping reason="cli_sigint"` 且前台 exit 0，状态为 available、监听与记录 PID 均为 0。
- 实体 Windows 使用 `core.autocrlf=true` 的全新 Git checkout，HEAD 精确为 `b768089`，工作树 clean，
  受控源码 CRLF 为 0；Node `v22.22.0`、pnpm `10.33.1`，空依赖安装、CLI 24 passed/1 skipped 与
  distribution 均 exit 0。最终 tarball 真启动后 status/health/ready/console/SQLite 通过，单次
  `Ctrl+C` 前台 exit 0，监听、daemon PID、supervisor PID 与匹配进程均归零。daemon 代码边界
  `b92b0ea` 的 runtime-child + tier1-executor 111/111 另已在同一实体主机通过。
- rc.2 的公开 Actions run `32616479767` / `32616480151` 首次运行失败且未创建 Release；旧 tag
  按发布纪律保持不移动且不重跑。rc.3 的公开 CI `32622757288` 与 release
  `32622757385` 同样为 attempt 1 / failure，没有创建 Release；Windows notice 换行对账与 Linux 四次
  agent pipe `ECONNRESET` 分别形成 F106–F107。当前所有发布入口和 `--check-candidate`
  的 11 个锚改指 rc.4 candidate。
- 官网本地视觉复核:[ok] 中文/英文桌面与窄屏安装入口完整可读,三条命令无横向溢出、两张图标均加载成功,
  浏览器 console 无 warning/error;关键章节 DOM 各恰好一份。超长截图在平滑滚动中出现拼接伪影,
  未作为页面重复的证据。
- `git diff --check`:[ok]。

尚不能写成已通过的项:

1. W5.4-c 的真实 Claude PreToolUse/PostToolUse hook 全链与 live conformance。
2. 四场真人语音体验、S3 真人过卡与主观听感。
3. Windows system service、Windows 通知/SAPI TTS 与 Linux systemd 常驻安装;rc.4 只承诺前台运行。
4. HarmonyOS 真机当前离线且 HAP 缺签名 Profile;不得把 unsigned build 写成装机通过。
5. npm registry、App Store、Google Play、AppGallery 发布;本轮不代替 owner 的商店与 npm 操作。

当前 rc.4 的最终独立复审、Mac/Windows Release URL 实跑、GitHub Release、公开 Actions、
官网部署、真机结果与 Git/worktree 清理证据在发布阶段完成后续写本文,任何失败保留原始结论。
