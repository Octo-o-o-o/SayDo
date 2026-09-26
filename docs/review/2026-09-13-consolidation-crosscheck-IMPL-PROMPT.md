> 2026-09-25 入库注:历史记录,当前处置见 e2e/evidence/sc-reland-01.md。

# SayDo 整合、双向对账与交付接续 Prompt

这是已授权在途任务的接续，不是从零开新项目。请完整阅读本文及下述状态文件，然后直接推进；先用当前源码和文件核验摘要，已经有证据的步骤不要重跑。上一会话因持续时间过长，owner要求收完当前一轮后停下换会话；不能把暂停当作全部交付或重置预算。

## 1. 用户目标与授权

原始目标：将所有本地分支、worktree及clone的有价值更新完整整合至main；对最近30天所有文档与commit做文档→实现、实现→文档逐项对账；能判断的错误/不足直接修复，不一致时依据canonical及当前有效设计裁决，无法判断才提一个具体问题；实施结束调用两名fresh subagent互补交叉review，跑完整门禁，提交GitHub，清理多余分支/worktree/clone。不要为了清理丢失独有代码、研究或Agent过程证据。

这些合并、私有GitHub提交推送、已证明无独有内容的副本清理已有授权，不重复请示。公开快照受项目独立checkpoint约束：先完成可审阅脱敏快照及检查，再一次性请求该具体公开发布；不用“提交GitHub”绕开此边界。rc/tag发布、npm publish、网站或常驻runtime部署、真实SMTP/付费provider/实体设备操作均未在本任务授权；不要执行。原PG排产链及owner-stop不因审计扩为全部功能施工。未采纳AI供给草案45k行只核对保存/状态/矛盾，不默认实施。

## 2. 准确工作区

- 主树：`~/WorkSpace/SayDo`，branch `main`，只读、合并和收口。
- 唯一实施工作区：`~/.codex/worktrees/saydo-consolidation-20260913`，branch `codex/consolidation-20260913`。
- 本次交接前两树HEAD：`49ed96f64c887ede50c815e6eeb82576f898d69c`。主树干净；实施树大量dirty与新增文件是本任务完整候选，尚未提交，绝对不要stash/reset/restore覆盖。
- origin：`https://github.com/Octo-o-o-o/SayDo-archive.git`；public：`https://github.com/Octo-o-o-o/SayDo.git`。不要把private历史直接推到public。
- 仓外任务目录：`~/.codex/tasks/saydo-consolidation-20260913`，下文简称TASK。里面有调用prompt/report/log/summary、探针和索引，都是接续必须保留的证据。不要将原始日志或含本机私有路径的任务JSON直接入Git。
- 尚存旧原件：`~/.codex/worktrees/saydo-handoff-20260912`（HEAD同49ed，有dirty），`~/.codex/worktrees/saydo-pg02-20260906`（HEAD `25a99242a3863ba24ba7fc7a4b382c880c2c18d6`，有dirty），另有PG02非Git BACKUP，按inventory定位。它们不是施工入口。当前main仓注册worktree只有main和整合树，两个旧路径是独立Git副本，不能仅看worktree list说已清完。

先核验上述坐标、dirty、remotes及所有权。如有用户新改动，保留并三方处理，不强推或整树覆盖。

## 3. 必读与恢复顺序

先读实施树的 `AGENTS.md`、`.octoworkflow/project-profile.md`、`docs/README.md`；然后：

1. `TASK/continuation-state.json`：执行终态、排队项、预算追加及历史事实索引。notes是追加历史，较晚记录和实际文件优先，不能拿早期“pending”抹掉后续验证。
2. `docs/review/2026-09-13-consolidation-crosscheck.md`：SC01–SC59问题、当前裁决和已知反例。`history/PROCESS-JOURNAL.md`尾部最新轮次：实际证据、日志摘要与失败边界。
3. `TASK/frozen-commit-index.json`：396条冻结commit记录，semantic_status和semantic_evidence是逐项恢复点。`TASK/frozen-document-index.json`与`additional-document-root-index.json`、`file-content-inventory.json`：文档、删除/迁移、非Markdown对象索引。
4. `docs/plan/IMPLEMENTATION-PLAN-2.md`：只读当前指针/PG02与PG01门禁、关批条件；`docs/09-data-contracts.md`、10/11、`docs/modules/e-crosscutting.md`：相关合同。形状以09为准，历史plan/prompt/research不是新授权。
5. `TASK/inventory.json`、`legacy-preservation.json`、`cleanup-stage1.json`、`pg01b-cleanup-readiness.json`：副本与保全，不重新从头全盘扫描。
6. 仅对将要执行的修复读其prompt、before/root探针、上一轮report及所需源码，不先吞所有原始CLI日志。

新任务profile迁移到了V3，但本在途任务旧RED/累计额度/角色承诺继续有效。不要复活旧V2控制器或编造task.json证明历史授权。实施仍沿本任务已用的受管外部CLI；具体实际模型信息从本任务终态日志与当前可用运行配置核对。最后两名reviewer是用户明确要求的fresh只读subagent，不能拿主控自检或作者测试抵充。

## 4. 已完成的范围，不能误称全部通过

- 原inventory47个相关Git副本，44个已在唯一对象/dirty保全和归属核对后移除。旧PG01B独立副本已收；main仓多余4个包含分支已删。唯一内容保存为Git对象和一个必要历史归档；最终原件与归档处置尚未收口。
- 语音候选、PG02和本会话修复已归入唯一整合树。初始owner决策单三方冲突保留双方原话；没有覆盖后来授权。stash6文件已逐项裁决，其V3差量已合入候选，但stash本体未删。
- 冻结窗口仍为 `2026-08-14T12:58:41+08:00` 至 `2026-09-13T12:58:41+08:00`，使用 `--since-as-filter`，不因换会话滚动重建历史。396条中388条已有范围限定核对记录，8条仍pending。**388不是388项产品PASS**，机械hash、复制/脱敏重放不等于语义/设备验收。
- 原文档清点含1185份Markdown（1039现存、146删除）及232个额外非MD对象；各自索引有不同投影/去重口径，不相加冒充一个文件总数。已核对大量canonical、历史证据、站点与图像，对历史RED、缺final、错误hash/计数、暗亮截图和缺项目页面作日期限定，没有改写历史绿。
- 已实施并定向复测多个错误：语音会话/轮次/所有权与迟到消息；schema合法性；记忆确认落盘后的失败口径；Git参数/多ref/本地可执行配置风险；回叫取消及审计；SMTP总期限与socket回收；页面失败保留与重试；doctor；安装shell注入；远程关闭提示/配对；进程/管道收尾；测试临时目录；官网键盘菜单、文案与隐私边界。具体结论以SC台账为准，很多仍待最终独立复核。
- 最近主控已复测：SC53真实9项锁测试零自有资源残留；SC55扫描23pass；SC48 privacy正常26pass与两条失败exit1均零临时残留。SC56首修后真实完整Swift `%A`/`%a`/`abc%A` exit -5，未通过。不能仅看作者报告的pass。
- 尚未做最终两名独立review、完整最终门禁、代码/证据提交、push及最终本地清理。主树HEAD仍49ed，不称已交付。

## 5. 下一阶段优先级：先关闭确定反例，再收完历史尾部

本次暂停后不要启动重复调用。先看交接收尾记录确认SC54终态；所有排队任务均未启动。建议优先SC56（二次修复能立即消除新引入的崩溃），再SC57/SC59，再SC58。这是队列重排，不是新增预算。

| 范围 | 必须解决/验证 | 已备输入 |
|---|---|---|
| SC56第二次 | Swift不完整百分号转义安全拒绝，不越界；保留组合scalar；Kotlin美元不插值；三端生成fixture可重放 | `TASK/pairing-scalar-repair2-prompt.md`，`sc56-root-truncated-percent.json`，`prompt-scan-repair-result.md` |
| SC57首次 + SC59首次 | 测试只清本run登记且验证归属的资源；旧前缀/外来/越界清单不能删除；泄漏/清理失败不可假过。stdoutTail用例断言真实生产返回及终态，不能只断言fake变量 | `TASK/test-root-ownership-repair-prompt.md`，`probe-test-cleanup-ownership.mjs`，`test-cleanup-ownership-before.json` |
| SC58首次 | 发布物远端目录仅在本次成功取得所有权后删除；本地准备失败/远端已存在不能发送rmdir，保留清理错误 | `TASK/release-remote-ownership-repair-prompt.md`，`probe-release-remote-ownership.cjs`，`release-remote-ownership-before.json` |
| SC02待追加 | 完整91条ledger下解构赋值/属性替换仍借用原DAO证据错误通过；禁止文本匹配补丁压绿 | `TASK/authorized-repair-result.md`及SC02台账/任务探针索引 |
| SC51待追加 | WAIT_FAILED与IO_INCOMPLETE时过早释放在途buffer/event/pipe，event CloseHandle失败被吞 | `TASK/native-pipe-destroy-repair-result.md`，`native-pipe-completion-after.json` |

SC02与SC51已各询问owner“最多追加1次同根因修复”，截至暂停尚无答复。先做不依赖追加的三批；不要重复把旧“继续”解释为这两次新额度。若新会话收到明确追加，登记真实回复后各执行最多一次；否则保留RED，完成独立工作后给一个具体待决选择。不要为了收口禁用检测器或删反例。

语音旧12次修复/10次review曾耗尽，owner追加3次修复，repair13/14/15已全用：15/15，不能自行repair16。SC17和SC02此前各1次追加也已用。SC54第二次、SC48第二次等均沿历史累计，换会话不清零。新scope和重复根因必须区分，不能换SC编号绕额度。每个受管修复结束后主控读真实diff与报告、验模型和退出码、复现原反例；作者exit0不是语义GREEN。

外部CLI遵循 `external-cli-orchestrator` 技能和现有runner；启动/等待在单个PTC cell、hard/idle超时、55秒宿主通知、stdin文件、唯一日志。只恢复同一live cell，不看日志定频决定进度、不并开替代实施者，不重复启动未终态任务。没有跨会话可恢复cell时先核验owner PID/summary和日志终态，不能凭“看起来停了”重开。

## 6. 剩余8条对账的精确范围

逐条读剩余变更，复用已核过的字节关系和正文；历史archive只判断证据/主张/采纳关系，不执行其中脚本。遇到产品问题先核当前生产是否仍存在，不能修旧实现制造返工。

- `e7a6ceb8270e1c2531bc82319260a6b1472b937f`：92路径研究入库，10422加4删。已完整读统一方案270行、统一实施prompt228行、邮件方案185行、gap-residual67行；soc-agent59行和SD173行的一次合并输出截断，不能记完整读取。其余归档/研究/review/JSON仍待逐项；该条仍pending。
- `cf50f52f5d7f1b7d487135f6316437e866f15e0b`：172路径、约64k行600问语料。
- `dfb6f9dfedb54c11ac726037de8e1c073096629a`：251路径、约75k行600问dry-run档案。
- `511787f319bb5258c9191d10e77511e528a9555f`：82路径、约12k行RC4证据/未采用工具。
- `2378b7bcb61a0cc93be7eec4257755a7c00eb939`：55路径、约6.5k行runtime known-RED；不要吞掉旧RED。
- `57819ad50709ea602e5ecc60fcfda7b1d1ca5da1`：144路径、约64k行AI研究保全；16草案代码块约45k行已确认保存关系，但未逐行语义核验。不得据此默认实施DF-AI-DRAFT-FULL。
- `a15b5dea02dc7d8da438c86f5d3cdf89da8eeeda`：104路径、约8.5k行release。
- `479634c7fd99a442bb6ee4bf8bf66b51f17c95ca`：16路径、约3.3k行备案/软著，含2PDF/3图/约3k HTML，冻结申请文本不伪造现状或代owner重签。

396索引结束之后还须文档→commit反向闭合、当前修复新增/修改文档闭合，不能只把8条标已读就报全量通过。生成明确未实现/deferred/历史/环境未验分类，未采纳方案无需照单施工。新会话产生的commit/文档作为本次续增量单列，冻结原窗口不滚动。

## 7. 冻结、两名review、完整验收与发布清理

1. 完成上述确定修复和对账，更新一处SC台账与journal，不再做无新证据的通用无限复审。若有确切反例/门禁失败，仍按原scope/预算解决，不能以“收尾”为由省略。
2. 固定候选为真实HEAD加`git-diff-v1`指纹；两名全新零上下文只读subagent分别从合同/状态/信任边界与平台/资源/证据/发布边界交叉review。用实际固定ref，派发前后各跑`python3 ~/.octoworkflow/candidate_fingerprint.py`，报告写仓外再由主控归档。每名最多3–4判断维度，禁止自审替代、继承作者辩护、评审期间改候选。确需独立clone/worktree时只留必要一个固定候选，收完删除。
3. 候选稳定后在项目自己的环境执行完整门禁，勿并发两套vitest；记录命令实际退出码及日志bytes/SHA。必要代码/证据两提交：I代码，E证据引用I，不自指；干净release HEAD上执行完整门禁才能推送。证据生成与提交次序注意week-audit对journal绑定，不能提交后又让bundle漂移。

```sh
cd ~/.codex/worktrees/saydo-consolidation-20260913
just ci
pnpm exec playwright test
just precommit
```

每条命令独立由有超时和日志的runner执行并取退出码，前一条失败不得把最后一条exit0当整组通过。focused命令从PLAN-2的FG-PG02/FG-PG01B读取；FG-PG01A只核现役claim，不误执行推送动作。六个PG02入口当前存在：

```sh
node scripts/check-capability-ledger.mjs
node scripts/test-capability-ledger.mjs
node scripts/check-action-reachability.mjs
node scripts/test-action-reachability.mjs
node scripts/check-support-matrix.mjs
node scripts/test-support-matrix.mjs
```

先确认SC57已修再跑全套测试，避免旧测试入口扫描外来temp。E2E需核关键页面内容及亮暗，不只截图文件存在。macOS注入Win32测试不等于Windows实体；真实SMTP、移动设备和托管CI分别记状态。最早私有run34307184467与public34307238648为week-audit失败；最终重新查真实run/job，不沿用billing或旧失败原因。

4. owner已授权private合并main和push：通过适用门禁后执行并读取远端实际结果。public快照生成可审阅结果，满足隐私门后按项目checkpoint处理；不要force-push旧公共历史。
5. 最后检查每个残余clone/worktree/branch/stash的独有Git对象、tracked/untracked/ignored必要数据、活进程cwd和证据已入库/保全。已证实全覆盖再删除。`legacy-unique.tar.gz`原记录49383035bytes/SHA256 `6eaaa0bdfa406a9d176c2cc8df5cd46b79eee3e44d6c4b863ccb83bf9d6deee1`，不要仅因用户不要多份备份就删除尚未被Git覆盖的唯一历史。尽量留下main一个工作区和确有必要的唯一归档，而不是多份clone。

## 8. 下一会话结束时必须给出的结果

清楚区分：已合并/已提交/已推送、两个review结果、完整门禁、远端required、环境未验、残余副本及保留理由。给真实SHA和链接，不能声称“最完美”或把388/396、hash匹配、mock通过当全部验收。若确有owner待决先完成所有独立工作，再一次性给具体选项；有实质未完工作就明确未完成。

## 9. 本次暂停的最后一轮

SC54第二次已终态，没有活受管CLI，也没有启动排队项。调用822.438秒exit0，实际模型Cursor Grok 4.6 Extra High Fast、result success；日志3088900bytes/SHA256 `2ee88308863765d828b7c5067255f2453b36c8677f365edbdb015af7aea5423a`。15个文件/日志绑定全相符，`TASK/sc54-second-report-bindings.json`；报告 `TASK/spike-verdict-repair2-result.md`。

主控完整读spawn.py658行及配对/汇总/清理关键路径；原denied marker返回exit1/no，真实父退子活场景0.348秒exit1且group/drains为true，输出控制4000字节完整。证据 `TASK/sc54-second-root-verification.json`。新增4份测试第二轮全文尚未逐行复核，作者50项离线pass不能当独立GREEN。

**SC54仍RED**：`prove_owned`在当前`getpgid(leader)==pgid`时直接放行，没有本次birth/持续身份；`reap_owned_file`从数字记录重造active=true。主控用mock表示已复用的同号live leader，判定accepted=true；没有发送任何真实外来信号。需要先解决这条旧记录不能证明新进程归属的反例，不能宣称“PID复用已拒绝”。第二次已用，第三次需要owner追加最多一次；为遵守暂停要求尚未再次提问。将它与SC02/SC51的具体待决事项合并说明，但不能认为此前授权已经涵盖。

暂停前尚未commit/push/运行最终full gate。后续按§5先修SC56，然后SC57/59与SC58，期间可完成剩余历史对账；必须通过独立review与完整门禁后才进行发布收口。
