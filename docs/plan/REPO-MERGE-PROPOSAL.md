# 仓库合并方案 v2:voice-coding(设计库)并入 SayDo(实现仓)

> 状态:**superseded**。owner 于 2026-07-29 要求执行完整合并;实际执行范围、漂移修订与验证证据以
> [MIGRATION.md](MIGRATION.md) 为准。以下保留 2026-07-25 v2 前置方案原貌供追溯。
> 日期:2026-07-25(v2)。方向由 owner 提出(合并到 SayDo,voice-coding 转归档)。
> 本文档定稿后随 `docs/plan/` 迁入 SayDo,作为本次迁移的决策记录。

## 0. 一句话结论

**建议合并,采用"冻结快照 → 分层复制入仓 → 归档封存"三段式**:canonical 与全部活文档迁入 SayDo;voice-coding 冻结为归档库(**不增不改**,唯一例外 = 归档声明本身);迁移以带 SHA-256 的文件 manifest 为准,不以时点手数为准。

## 1. 事实基座(v1 成稿时点快照;标注 [漂移] 处在评审期间已变化)

> 评审教训:本方案成稿到评审收口的 1 小时内,设计库新增了 `IMPL-PROMPT-4-EXECUTOR.md`、README 更新、journal 写入 R39,SayDo 工作树由 dirty 变 clean。**因此 v2 把"事实"降级为"时点快照",全部动态项改由 §7 实施前置检查在执行时点重测。**

| # | 事实 | 证据坐标 | 评审核验 |
|---|---|---|---|
| F1 | voice-coding **本地无 git 元数据**:docs/09 契约、10 话术、11 UI 这些"实施照抄源"无版本控制、无 diff;远端备份**未核实**(不宣称"无备份") | 目录无 `.git`;SayDo 有 git + `github.com/Octo-o-o-o/SayDo` | Codex 1.1:措辞已收敛 |
| F2 | **跨仓运行时依赖埋下 CI 断裂点**:`config.test.ts` 以 `../../../../voice-coding/templates` 直接 `readFileSync`,无守卫;CI workflow 只 checkout SayDo | `SayDo/packages/daemon/test/config.test.ts:11,240,249`;`ci.yml` 跑 `pnpm test`;"Actions 上必挂"为合理推断(未实跑远端);billing 未开通为 HANDOFF 自报 | Codex 1.2:A 级风险成立 |
| F3 | SayDo 引用 voice-coding:**tracked 15 文件/25 行**;含工作树忽略文件(`.saydo/knowledge/` 2 份)共 **17 文件/29 行** | `git grep -n -I voice-coding`;`rg --hidden --no-ignore` | Codex 1.3:v1 只记账 12 文件,已补 |
| F4 | 回写纪律("先修文档再改代码")跨仓执行:文档与代码改动无法同 commit | `SayDo/AGENTS.md:3-6` | 三方确认 |
| F5 | **ADR 编号已分叉且不止一对**:设计层 ADR-001-execution-layer vs 工程层 ADR-001/002/101;`docs/05` §6 还预告"另出 ADR-002"(设计层),与工程 ADR-002-byoa 撞号;工程 ADR-001 内预留"设计层 ADR-102"又是第三种口径 | 两仓 `docs/adr/`;`docs/05-roadmap.md:143`;`SayDo/docs/adr/ADR-001-pipecat-interrupt-go.md:3-4` | S1 评审 A1:v1 只盘点了一对,已补 |
| F6 | 体积[漂移]:总 ~132M;**迁入候选集实测 112 文件 / 约 2.0 MiB**(rsync dry-run + 字节求和);大件 = spike node_modules 40M(可再生)+ codex 日志 45M + archive 22M + assets 11M + 根 logs ~12M | `du`/`stat`/rsync dry-run(Codex 复测) | 实施时以 manifest 为准 |
| F7 | demo:主 demo(saydo-console-demo.html)自包含;**atelier 对照稿加载 Google Fonts 外部 webfont**(无本地相对资源,但非离线自包含);`research/business-flows.html` 自包含 | `demo/saydo-console-demo-atelier.html:7-9` | Codex 1.7:v1"两份都自包含"不实,已修 |
| F8 | 引用面:docs→`research/` 34 行/9 文件(**仓根口径文本坐标,非 markdown 链接形态**);docs→`assets/` 0;docs 内 `ADR-001` 16 行/8 文件(其中**带路径可改约 7 处,余为纯文本提及**) | rg 计数 + 逐行判读(S1/S2/Codex 三方复测一致) | 拆分口径已修 |
| F9 | SayDo `.gitignore` 含 `node_modules/`、`*.log`、`.DS_Store`、`.saydo/`:候选集经 `git check-ignore` 实测,仅 codex 日志 23 个 `.log` 被挡,`saydo.env.example` 等正常入库;`package-lock.json` 不被挡(作为资料入库) | `git check-ignore --stdin` 全候选集(S2 实测) | 成立;但入库集以 manifest 显式声明,不依赖 gitignore 隐含决定 |
| F10 | **零 emoji 门禁冲突(实施硬项)**:按门禁同款正则(含 `\p{Emoji_Presentation}`)对候选集实测 **244 处/18 种字符**(docs 47/research 106/history 38/plans 22/demo 17/templates 12/prompts 2);大头为 U+2705(勾)/U+274C(叉)/U+26A0(警告)/U+2713/U+2605(星)/U+2B50(星)/孤立 U+FE0F 变体符 ×11/图标类(U+1F399 等)若干 | 门禁正则实测(S2 222+19 与 Codex 244 交叉印证,差异为 Prompt 4 新增) | v1 的 220(三码区 python 统计)口径偏窄,已改门禁口径;数字为时点值,实施以门禁实扫为准 |
| F11 | [漂移] 动态状态一律不写死:SayDo 工作树/HEAD、journal 轮次(评审时已至 R39)、IMPL-PROMPT 份数(评审期间出现第 4 份)由 §7 前置检查实测 | — | 三方一致要求 |

## 2. 为什么合并(四个硬理由,评审后维持)

1. **canonical 无版本控制是当前结构最大风险**(F1):回写改动不可 diff、不可回滚。合并即获得 git + GitHub。
2. **仓库不自包含,远端 CI 是定时炸弹**(F2):billing 开通后 `config.test.ts` 两用例必挂;templates 与 docs/09 联动维护,单独搬 templates 只会制造第二个分叉点。
3. **回写纪律与跨仓结构矛盾**(F4):合并后"代码 + 文档回写"同 commit。评审提醒:同仓 ≠ 天然一致,回写一致性评审制度保留。
4. **命名与编号已多点分叉**(F5):两对 ADR 撞号 + 一处预留口径漂移;`.saydo/knowledge` 缓存的旧 canonical 指针也需随迁移重建。越晚合并越难收。

## 3. 备选方案对比(v2 按评审要求扩为全谱)

| 方案 | 内容 | 备份 | 原子性 | CI 自包含 | 回写同 commit | 审计 | 维护成本 | 裁决 |
|---|---|---|---|---|---|---|---|---|
| **A(推荐)** | 分层复制入仓 + 归档冻结 | git+GitHub | 单仓单 PR | 是 | 是 | 单仓齐备 | 一次迁移 + 244 字符清理 | **推荐** |
| B | 只修 CI(templates 入仓)+ voice-coding 单独 `git init` | 两仓各自 | 跨仓两 PR | 是(仅 templates) | 否 | 两仓分账 | 低一次性,**高长期**(F3/F4/F5 长存,双库漂移) | 备选(owner 若拒 A 的字符清理成本) |
| C | 全量搬迁(126M 档案入 git) | git | 单仓 | 是 | 是 | 单仓 | clone 永久拖累 | 拒 |
| D1 | docs 单独建仓,SayDo pin commit 消费 | git×2 | 跨仓 | 需同步机制 | 否 | 两仓 | 三个根(设计仓/实现仓/归档),双根认知不减反增 | 拒:回写摩擦不减 |
| D2 | submodule/subtree | git | submodule 递归复杂 | checkout 需递归 | subtree 可/submodule 否 | 复杂 | submodule 是本诉求(文档+代码同 PR)的反模式;subtree ≈ A 但多一层机制 | 拒 |
| D3 | 双仓 + CI 同步门禁(SHA/manifest 校验) | git×2 | 跨仓 | 需镜像 | 否 | 门禁可审计 | 新建并长期维护一套同步门禁 | 拒:过渡态成本高于一次合并 |
| D4 | 文档仓 + 大档案 LFS/对象存储分离 | git+LFS | 单仓 | 是 | 是 | 是 | LFS 配置与费用 | **A 已隐含 D4 精神**(大档案留归档不入 git),无需 LFS |

## 4. 迁移清单(方案 A,v2 = 顶层 20 项全归属)

原则:**复制而非移动**;入库集以显式 manifest(文件清单 + SHA-256)declared,不依赖 gitignore 隐含决定;归档库原件永不删除。

### 4.1 迁入 SayDo

| 源(voice-coding) | 去处(SayDo) | 处理 |
|---|---|---|
| `docs/01-11 + modules/ + hopper-side-feedback-*.md` | `docs/`(与现有合并;无同名文件冲突,实测冲突仅 AGENTS/README/.DS_Store 三项) | 直落;字符清理见 §6 |
| `docs/adr/ADR-001-execution-layer.md` | `docs/adr/design/ADR-001-execution-layer.md` | 设计层独立子目录,保留编号;**该文件内 3 处相对链接因深度变化改写**(`../../history/` → `../../../history/` 等,Codex 4.3 实测行 5/28/84);docs 内**约 7 处带路径引用**批量改,纯文本提及不改字 |
| (新增)`docs/adr/README.md` | 同左 | **双序列索引 + 引用规范**:design/ = 设计层(001 执行层;05 §6 预告的"载体 ADR"归此序列续编 design-002),根 = 工程层(001 pipecat/002 byoa/101 asr);纯文本提及必须带"设计层/工程"限定词;**随迁修 2 处无限定引用**(`docs/05:143`、`docs/modules/e-crosscutting.md:9`)与工程 ADR-001 内"预留 ADR-102"旧口径 |
| `IMPLEMENTATION-PLAN.md`、`IMPL-PROMPT*.md(实施时点实数,现 4 份)` | `docs/plan/` | 历史锁版迁入,顶部加迁移注记,内文旧坐标不逐条改;**`docs/08:7`、`docs/10:5` 等指向 `../IMPLEMENTATION-PLAN.md` 的链接改为 `plan/IMPLEMENTATION-PLAN.md`**;README 文档地图同步改 |
| `REPO-MERGE-PROPOSAL.md`(本文档,定稿版) | `docs/plan/` | 决策记录归档;入仓前自身过门禁 |
| (新增)`docs/plan/MIGRATION.md` | 同左 | 路径映射表:历史证据旧路径 → 新位置/归档位置;logs 与 Cursor 会话档案"去哪找";baseline 断链 allowlist(评审实测 2 处既有断链:`docs/06:103-109` 描述基准、`research/codex-findings/04:4` 相对路径) |
| `templates/`(3 文件) | `templates/` | **与测试路径修复同 commit 原子迁移**:`config.test.ts:11` 改 `../../../templates`(测试文件上跳三级到仓根,S2/Codex 双确认推导正确);`run.mjs:16` 默认值改 `join(here, "../../../docs")` |
| `demo/`(2 HTML) | `demo/` | 两份 Demo 均使用 inline SVG 或纯文本状态标记，渲染层与源码层都执行零 emoji；atelier 的 Google Fonts 外链保留并在文件头注明"非离线自包含,历史对照稿" |
| `research/`(**范围明确化**:全部 md + 各 spike 的脚本/配置/结果,含 `business-flows.html`、`hooks.json`、`package.json`、`package-lock.json`;排除 node_modules 与 `*.log`) | `research/` | docs→research 34 处仓根坐标引用保持有效;spike 的 package.json 不在 pnpm workspace glob 内,定性为资料(S2/Codex 双确认零影响) |
| `history/`(journal/README/scenarios/v1.14 终版) | `history/` | journal 在 SayDo 续写,轮次**以实施时点 journal 最大轮次顺延**(不写死编号,评审已发现 R39 撞号) |
| `prompts/` | `prompts/` | 活跃 prompt 中的旧根路径改仓内相对路径;历史 prompt 原样 |
| `AGENTS.md`(评审制度) | 并入 `SayDo/AGENTS.md` | **按 §5 三栏清单合并**,不允许 rsync 覆盖 |
| `README.md`(文档地图) | 并入 `SayDo/README.md` | 文档地图指向仓内路径;**同步刷新状态行**(交接指针指向实施时点的活 prompt;"VoiceLoop 旧称仅存于…"措辞加"归档库") |

### 4.2 留在 voice-coding(归档封存)

`archive/`(22M 快照)、`assets/`(11M 品牌探索,docs 零引用)、`logs/`(~12M 运行日志;**在 SayDo 为新起点**,历史日志只在归档库)、`.playwright-mcp/`(浏览器会话产物,含临时数据,不入 git)、`saydo-review-*.cursor.md`(2 份根目录评审历史)、`.DS_Store`(rsync 排除,任何去处都不带)、**以及全部已迁内容的原件**。

### 4.3 归档封存设计(v2 强化,回应"复制式迁移的 canonical 分叉"A 级风险)

1. **冻结快照**:迁移执行前生成全库文件 manifest(路径 + 字节数 + SHA-256)存入 SayDo `docs/plan/MIGRATION.md` 附件;归档库从此有可核验的"封存基线"。
2. **归档声明 = 冻结不增不改**(唯一例外 = 声明本身):`README.md` 整文替换为归档指针(指向 SayDo 仓 URL + 迁移 commit SHA + 冻结时间);`AGENTS.md` **整文替换**为归档头(旧条款全部失效、唯一活动仓 = SayDo、本库禁止任何写入)——AGENTS 是 always-applied 规则,只加头部不足以阻止旧制度条款注入未来会话(评审 B6)。
3. **drift check**:迁移后首次评审轮附带一次归档库对 manifest 的差异校验;此后 owner 抽查。
4. `.saydo/knowledge/`(SayDo 奠基产物)缓存了旧 canonical 绝对路径与"设计层 ADR 留 voice-coding"旧口径:**迁移后由奠基器重新生成**(不手改,遵守 knowledge 块纪律)。

### 4.4 评审制度路径重定义(合并后)

- `research/codex-findings/NN-*.md`、`prompts/`、`history/PROCESS-JOURNAL.md` → SayDo 仓内同名路径延续;
- `logs/` → SayDo 本地新起点,`*.log` 不进 git;**审计闭环改为**:每份 codex 报告/journal 条目记录对应日志文件名 + 字节数 + SHA-256(tracked 文件记账不可变,日志本体本地保留,归档库存历史);
- **增量约束**(评审 B3):制度条款加一句——评审产物落盘后、提交前须过 `check-emoji.sh`;Codex/subagent prompt 模板注明"输出禁 emoji,状态标记用 [ok]/[warn]/[fail]"。

## 5. AGENTS.md 与 README 合并规格(v2 新增,评审 B3 要求的三栏清单)

| 条款(源) | 处置 | 合并后落点 |
|---|---|---|
| voice-coding:评审制度(重制度 + 实施期轻量版) | **保留** | 制度节;路径按 §4.4 改写;补增量门禁句 |
| voice-coding:"docs/ 是唯一 canonical(01–10 + adr/)" | **改写** | 新句(见下"canonical 精确定义") |
| voice-coding:"细则见 IMPLEMENTATION-PLAN.md 每 Phase 收尾仪式" | **改写** | 轻量评审细则实体化进合并稿(计划已锁版,不再作为活条款载体) |
| voice-coding:"research/ 是证据源;history/ 是过程档案;archive/ 是快照" | **改写** | research/history 指仓内;archive 指归档库 |
| voice-coding:demo 与 docs/08 §6 同步、headless Chrome 验证、术语以 docs/06 为准、语言与身份(owner 唯一决策人) | **保留** | 原文并入 |
| SayDo:仓库结构、硬规则 1-6、质量门、常用命令、语言 | **保留** | 原文保留 |
| SayDo:"设计文档库(canonical)在 /Users/…/voice-coding/(只读参考)" | **废止** | 由 canonical 精确定义替代 |
| SayDo:"实施主线 = IMPLEMENTATION-PLAN.md…按其 §4 回写纪律" | **改写** | 回写纪律条款实体化;主线指针改指活交接文档(HANDOFF);**HANDOFF 改写时同步声明新主线**(评审 C6) |
| SayDo:"docs/adr — 工程 ADR(设计层 ADR 留 voice-coding)" | **改写** | "docs/adr = 工程序列;docs/adr/design/ = 设计序列(见 adr/README)" |
| SayDo:saydo:knowledge 块 | **保留原样** | 奠基器维护,不手改;迁移后触发重新奠基(§4.3.4) |

**canonical 精确定义(合并后 AGENTS.md 用语,评审 A2 要求)**:
"`docs/01–11 + docs/modules/ + docs/adr/`(design/ 设计序列 + 根工程序列)为 canonical,**09/10/11 为实施照抄源**;`docs/plan/` 为历史锁版档案,**不属 canonical**;`research/` 为证据源;`history/` 为过程档案;设计期原始档案在归档库 voice-coding(冻结)。"

## 6. 禁用字符清理政策(v2 按评审分治,替代 v1 的全局机械替换)

> 评审实证:全局"U+2705→[ok]、U+2605→推荐"式替换会破坏语义——templates 的星号是**成对硬约束标记**(U+2605 成对包裹,替换成"推荐"语义崩坏);docs/08 表格中勾号是"已回改"状态列;IMPL-PROMPT-4 用勾/警告/叉作三态图例;docs/11 §7(评审引 §184)规定 Hopper 原始报告**原样留存、digest 不变**。

| 类别 | 范围 | 处理 |
|---|---|---|
| 状态符(U+2705/U+274C/U+26A0+FE0F/U+2713/U+2610) | docs、history、research 报告、计划文件的表格与图例 | 替换为 `[ok]/[fail]/[warn]/[todo]`;**按字素簇整体替换**(警告符 + U+FE0F 变体符作为一个单元),防孤立 FE0F 残留(门禁固件 3 专拦此项) |
| 成对强调星(U+2605/U+2B50,成对包裹用法) | templates TOML 注释、history/scenarios | 成对替换为全角括号【】或删除,**逐处人工核对语义**,不做无脑映射 |
| 功能性图标(U+1F399/U+1F514/U+1F319/U+1F50D 等) | demo atelier 对照稿 | 改为 inline SVG 或纯文本状态标记；禁止用 HTML entity / JS Unicode escape 绕过源码门禁 |
| 原始证据类 | research 中"评审输出原文"性质文件 | **owner 拍板项 3**:推荐同样做字素簇替换并在 journal 声明"格式符替换,语义零改动"(digest 论证:这些 md 报告不在 09 的 digest 链上,Hopper 收据类原始件不在迁移集);若 owner 要求字节级原样,则该子集留归档库不迁 |
| 验收口径 | 全部 | **`git add -A` 之后**从 SayDo 仓根跑 `check-emoji.sh`(门禁只扫 tracked/staged,rsync 后未 add 即跑 = 假绿,评审 A 级发现);清理完成标准 = add 后门禁 clean,**不以任何手数数字为准** |

顺带修复(B 级,随迁移批):`check-emoji.sh` 加仓根锚定(当前从错误 cwd 调用会 `fatal` 后假绿,Codex 实测)。BIN_RE 扩展名黑名单的补全(svg/wasm/mp4 等)记为 SayDo 侧待办,不阻塞迁移。

## 7. 实施步骤(v2 重排:冻结与 manifest 前置,评审 5.1 的依赖顺序)

0. **冻结协调**:与当前活跃批次(实施时点的 IMPL-PROMPT 批)对齐——迁移等其 commit 收口,或 owner 明确锁定基线;冻结窗口内设计库停止一切写入。
1. **前置检查(执行时点实测,替代 F11 静态陈述)**:SayDo 工作树 clean + 记录 HEAD SHA;journal 当前最大轮次;IMPL-PROMPT 实数;`git remote -v`。
2. **生成源库 manifest**(全库路径 + 字节 + SHA-256)与迁入候选清单(§4.1 口径),rsync **dry-run + checksum、禁 delete** 核对。
3. SayDo 建分支 `repo-merge`。
4. rsync 复制(排除 `node_modules/`、`*.log`、`.DS_Store`;**AGENTS.md/README.md 不在 rsync 集内**,评审确认的仅有同名冲突,走第 5 步语义合并)。
5. **语义合并先行**:AGENTS.md(§5 三栏清单)、README、`docs/adr/README.md` 双序列索引、`docs/plan/MIGRATION.md`。
6. 引用与链接更新:§4.1 各行(ADR 路径 ~7 处 + ADR-001 内 3 处深度修正 + 计划链接 docs/08:7、docs/10:5、README + 2 处 ADR-002 无限定引用);代码路径修复(`config.test.ts:11`、`run.mjs:16`);`HANDOFF.md`/`AGENTS.md`/`README.md` 的 voice-coding 绝对路径改仓内;历史证据 9 文件(evidence×4 + spikes/smoke RESULT/json×3 + ADR×2)**不改内文**,入 MIGRATION.md 映射。
7. 字符清理(§6 分治)。
8. **`git add -A`**,然后门禁:`just ci` 双矩阵 + `check-emoji.sh`(从仓根)+ **链接扫描(新工作项)**:口径 = 仓根相对文本坐标(34 处 research 引用非 md 链接形态,按仓根解析;docs/plan 历史件旧坐标豁免;baseline allowlist 见 MIGRATION.md)+ demo 两份 HTML headless Chrome 截图(验收口径 = 结构完整可渲染 + 字符转实体处渲染不变)。
9. 干净 clone 复核:临时目录 `git clone` 后跑模板相关测试(验证仓库自包含,F2 闭环)。
10. 两提交法:`feat(repo-merge): ...`(迁移与修复)+ `chore(evidence): repo-merge`(六段证据,记录代码提交 SHA,不自指;**migration-only 代码改动清单 = config.test.ts 与 run.mjs 两处路径**,与业务改动零混批)。
11. **最后**落归档声明(§4.3.2,写入迁移 commit SHA)+ journal 记录(轮次顺延)+ 触发 `.saydo` 重新奠基。

## 8. 回滚设计(v2 补全)

- 回滚 = **逆序 revert 两个 commit**(先 evidence 后 feat),归档声明有**独立恢复步骤**(把 voice-coding 的 README/AGENTS 从归档头恢复为原文,原文在 git revert 后的 SayDo `docs/plan/` 副本与归档库 manifest 中都有);
- 归档库自身在整个过程零删除,manifest 提供任意时点的完整性核验;
- 实施前在临时 clone 中演练一次 revert 路径(评审 6.1 要求)。

## 9. 风险与缓解(v2 增补)

| 风险 | 等级 | 缓解 |
|---|---|---|
| 迁移窗口内设计库并发写入 → 快照不完整(评审期间实际发生:Prompt 4 落盘) | A→已缓解 | §7.0 冻结协调 + §7.2 manifest 核对 |
| 门禁"假绿"(untracked 不被扫)→ CI 迟发红 | A→已缓解 | §6 验收口径:add 后跑 + 干净 clone 复核 |
| 字符替换破坏语义/digest | A→已缓解 | §6 分治 + 逐处人工核对成对星 + owner 拍板项 3 |
| 归档库继续被写 → canonical 分叉 | B | §4.3 冻结声明(AGENTS 整文替换)+ drift check |
| 29 个候选文件含 `/Users/…` 本机绝对路径,入 GitHub 私有仓 | B/C | 私有仓风险低;活跃文件(prompt/AGENTS/README)改仓内相对路径,历史证据保留原文;preflight 记录清单,owner 知情 |
| `logs/` 不进 git → 评审日志不可审计 | B→已缓解 | §4.4 SHA-256 记账制 |
| 表格类文件替换误伤 | B | diff 逐文件人工抽查 + 门禁兜底 |
| 归档库被未来会话误当 canonical | B | AGENTS/README 整文替换双保险 + `.saydo` 知识重建 |
| HANDOFF"实施主线"指针漂移 | C | §5 表:HANDOFF 改写时声明新主线 |
| BIN_RE 黑名单不全(svg 等) | C | 记 SayDo 待办,当前迁入集无 svg,不阻塞 |

## 10. 待 owner 拍板项(v2)

1. **方向**:方案 A(合并)vs B(最小修补:templates 入仓修 CI + voice-coding 单独 git 化)。评审后推荐维持 A;§3 矩阵供对照。
2. **ADR 双序列**:`docs/adr/design/` 子目录方案(推荐,保编号;含 05 §6 未来载体 ADR 归 design-002 的续编规则)。
3. **历史档案字符政策**:research/history 的字素簇替换(推荐,journal 声明)vs 字节级原样子集留归档不迁。
4. voice-coding 归档后**是否改名**(如 `saydo-design-archive`,可选)。
5. **迁移时机**:当前活跃批(实施时点的 IMPL-PROMPT 批)commit 收口后的冻结窗口,由 owner 指定。
