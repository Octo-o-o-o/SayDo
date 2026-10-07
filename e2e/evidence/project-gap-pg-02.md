# PG-02 minimal-truth-gate-bootstrap · repair-9 最后一轮未提交候选

> 2026-10-03 索引注：首段的 repair-9、“当前最后 6/6”及下文各轮 PASS/RED、预算、数字与日志均为对应日期的历史原文；后续正文已累积至 repair-26，现役续接记录已到 owner18/repair45。现役排产只读 [PLAN-2 的 PG-02 批卡](../../docs/plan/IMPLEMENTATION-PLAN-2.md)，现役合同读 [09 §18](../../docs/09-data-contracts.md)；完整续接账本仍位于 `~/.codex/tasks/saydo-modular-foundation-20260929/`。本轮仅整合与审计，PG-02 仍 RED，不继承旧 gate PASS，也不重开预算；本轮结果见 [2026-10-03 整合审计](fortnight-audit-2026-10-03.md)。

状态：RED / INCOMPLETE。当前追加第 6/6 轮已使用，无额外续修授权。
真实输入 HEAD=`8933fc7e7af7fd983a8fbe259f419d3f2a87ded5`，没有新 I/E SHA。
旧 PG02 8 修 8 评、20260927 窗口原 1 修 0 评及后续已用额度全部保留。
本轮没有独立 PG02 review，不关闭 G-A3，不进入 PG03 生产。

## 本轮实际结果

- 101 个原 action ID 全部保留；原 22 个 none 逐项对账。当前有限扫描 39/101 无拒绝，原 none 中 12/22 无拒绝。其余不能作为无写证明。
- 未知调用仍拒绝；改为先核有限来源图，再重放条件写点。真实 timer、VoiceHub peer、setup scope、四函数订阅计费摘要绑定完整源码与实际来源；WS heartbeat 不再混入 malformed/quiesced 的写点。节点、跳数、读取与 30 秒 self-test 上限未增加。
- 唯一 action ledger 回填 17 个已逐项核对的动作，保留条件与变体。brain:approveAction 的 38 条条件写点对应 16 个 token/ref 物理写点，不表示新增 38 个业务写入位置。未闭合 provider/runtime 链仍未通过，讲解与 setup 的真实正例仍 RED。
- 完整诊断仍有 9324 条拒绝（1693 个不同 code/detail）、4368 条实见条件写点；后者不是完整效果集合。正式 checker 最近实际运行 13054 failures。拒绝数含重复路径与 ledger 比对项，不是独立产品 bug 数。
- 仅退役 CTX-05/06/08/13/15，保留原日期、来源与历史 RED。600 题全部保留，其中 57 题当前不可执行，543 题仅表示未被此次退役阻断；有效上下文 11/16。simulation/dry-run 由真实 producer 投影排除 ID，不能把历史 REPLAY_PASS/EXECUTABLE 当当前成功。
- corpus 80 类 mutation 及真实 rebuild 暂存验证/字节幂等正例通过；Q0 的 986 个 LIVE required 对象与旧报告保留，未运行 Q0 --write。没有删其它正式支持或测试。
- daemon/console/contracts 产品源码、600 题来源与历史 CTX source 的字节未修改；docs/09 模块 §17 原字节保留。§18 的候选修订仍需宿主独立审查。

## 门禁与绑定限制

三 checker 中 support 通过；capability 因 dirty docs/09 与已提交 blob 不同拒绝；action 及完整 action mutation 仍 RED。schema、lint/typecheck、corpus/simulation/dry-run validators 与对应 mutation、Q0/check mutation、隐私/指针等逐命令事实以本轮仓外 REPORT 与 COMMANDS 为准，不借 repair-7/8 的 GREEN。

监听相关 just ci、完整 Playwright、PG01B 两个监听文件由宿主最终运行；本轮不复撞已知沙箱限制。非监听 daemon focused 是 59 过/1 logger 子进程断言失败，不能直接归因为已证 EPERM。固定候选上的完整门与独立 PG02 验收尚未运行。

新增 `research/customer-question-corpus/context-availability.mjs` 尚未 stage；RF00 使用 ls-files，当前 check 不覆盖该新增源。宿主必须先将全部 I/E 新增显式暂存，再真实生成 RF00、分离 I/E，并在真实 I 后更新同 cohort 来源绑定。不能伪造 I 身份或修改 checker 容忍漂移。

全 101 ID、原22none、8类旧根因、全部日志字节/SHA、filehash、明确 I/E pathspec 与 patch 保存在本任务仓外 `repair-9-artifacts/REPORT.md`。这是一份未提交且未通过的候选记录，不能据此声称交付。

## repair-8 历史证据（原文保留）

# PG-02 minimal-truth-gate-bootstrap · repair-8 待固定候选证据

状态:RED / INCOMPLETE。review-6 的 R-LEDGER / R-EVIDENCE / R-GATES 未整体关闭。
当前追加第 5/6 轮;旧 PG02 8 修 8 评及旧窗口记录保留,不修改旧账。
输入 HEAD=`6affca9f13c078104b9ff6697571f61eb7c941b6`;未生成或声称新的 I/E SHA。
当前候选尚有可修的合法调用闭包问题,不能只把未通过归因于 corpus 新鲜度。

## repair-8 实际变更与限制

- 原始 101 action / 22 none 已逐 ID 保存真实源码诊断;包括写点、via、conditions、真实 result 文本及每个调用的处置或拒绝。仓外 `repair-8-artifacts/audit-last-data.json` 为完整输入结果,不是 checker 通过证据。
- 局部 const alias、嵌套返回 factory、实参委托进入有限来源解析。无法证明的调用不再因 receiver 不是形参而静默跳过。相同 helper 的不同实参来源分别检查;缓存原位源码变更有拒绝/恢复测试。
- `brain:approveAction` 已发现 approvals SQL、approval.transition、accept/reject 审计及条件化确认消费;真实局部闭包无 unresolved。`setup:postConfirmCliCapability` 已发现 byoa.invocation,但完整 provider/native 闭包仍有拒绝,不能报真实正例通过。
- 六个已核到业务写点的原 none 已回填唯一 action ledger。其它未闭合 none 的文字明确不构成无写证明;新 claim 必须被当前 RED 门阻断。保留原 101 个 action ID,没有削减产品支持面或修改 daemon/console。
- setup 完整路由参与扫描,不再只核第一个 helper。具名原生值、schema、只读源码边界绑定实际来源;新增文件写点合同仍待宿主独立审查。日志输出与业务审计分开处理。
- 全链真实正例及已有完整 mutation 仍有失败;预算和门限未放宽。原断言保留,测试入口汇总 helper 失败后继续其它隔离组,最终仍非零。
- CTX05/06/08/13/15 仍待 owner 权威新输入或明确历史 fixture 窗口;未续期、未改门限、未运行 Q0 --write。
- 排产仍 active=PG-02 / next=PG-03 / last_closed=RF-00;未手改指针,未进入 PG03。

本轮最终诊断覆盖 101 action,识别 1854 个条件化写点并保留 7360 条闭包拒绝;正式 checker 为 8584 failures,不能作为完整写点集。mutation 实测约 25.95 秒且 exit 1,30 秒门限未改。

本轮逐命令 argv/cwd/exit/候选、日志字节与 SHA、原编号验收映射、全部 8 个旧根因、I/E patch/pathspec/hash、NOT_RUN 与宿主精确命令保存在仓外 `repair-8-artifacts/REPORT.md`。
当前只有未提交候选,不得据此合并或声称交付。下面保留 repair-7 历史门禁,它们不能替代本轮证据。

## repair-7 历史记录


状态:INCOMPLETE。PG02 三 checker 与完整 mutation 自检通过;required PG01A corpus
新鲜度回归仍 RED,最终 I 上的完整门与独立 PG02 验收未运行。G-A3 未关闭,PG03 未开工。
本稿尚未绑定新的 I SHA,不能当作固定候选最终证据。

输入 HEAD:`4b9d0f39a9319650bce7687acfba01552099c053`。
已知 RED 恢复点 I=`7de2877038b58b400d33807092d8d7b8fd2f5973`,E=输入 HEAD。
旧主账 8 修 8 评、20260927 窗口原 1 修 0 评保留;本卡消耗该窗口第 3 次修复、
当前六轮追加第 4/6 次。宿主独占账本,本调用不改 task.json、不派 agent/reviewer。
RF00 contract checkpoint 已由 owner 确认独立通过,不等于 PG02 验收。

## 实施者当前自检

- 全 101 action 的真实 checker exit 0;原两讲解入口各 24 个 callee_unresolved 已消除。
  两者都保留,不降 none、不删正式支持范围、不改 daemon/console 产品行为。
- `cliResolverContext` → `recordCliInvocation` → `recordCliSubscriptionInvocation` →
  `recordLlmUsage` → `insertCostEntry` 已由实际 import/实参/回调绑定。
  `makeCliProvider` 的 wrapper 与 `resolveApiProvider` 的拒绝审计回调均进入写点扫描。
  两动作各补 `sql:INSERT:cost_entries` 和 `provider.observed_model_rejected`,每动作登记 8 个写点。
- `@saydo/platform` 的 index → process → win32 工厂返回、stdio 和生命周期方法有限核验;
  test hook 与测试工厂依真实生产引用闭合集排除,不按 ForTests 后缀豁免。
  原生字符串/RegExp/AbortSignal 绑定实际来源,不建通用 AST 或执行平台。
- action 判定源为 402 个 cited blobs,新增三个 platform 判定文件纳入同一读取预算和 Git 绑定。
  capability 17、support 39、gate registry 9 条不变。AI 草案十份仍 designed,下沉 exact-set=[]。
- 新来源反例 39 项,缺实际调用 2 项,伪审计 receiver 2 项,两现役入口正例;
  完整 action mutation 包含原七组 helper 和既有语义/Git 断言,exit 0。
  先前完整 mutation 曾因 30 秒门限失败,保留日志;通过按完整字节复用 AST 和不可变 Git OID
  消除重复解析,未提高门限。新增原位源码变更、dirty 字节与核验期间 HEAD 移动反例。
- RF00 先复现 stored2489/fresh2490,再 `--write` 刷新。没有新增仓内文件;
  宿主最终仍须显式 stage 全部 I/E 新增路径后生成,避免 E 文件再次遗漏。
  六语言 source corpus 未变;矩阵 B 继续引用 A 的单源生成分母。
- 排产保持 active=PG-02,next=PG-03,last_closed=RF-00;原指针未手改。
  `--check` 通过,相同字节与真实 HEAD 的临时 clone 中 `--self-test` 八反例通过,临时目录已清理。

## required 回归与限制

- contracts schemas/truth-plane 23 tests、contracts typecheck、console 指定三文件 54 tests通过。
  当前本地 pipeline/.venv 的 ruff 与 pytest 145 tests通过;不是完整 just ci 等效。
- PG01A 十项其它 read-only validator/mutation/Q0 check 均通过。
  dry-run 原摘要失败已保留,按现有 producer 从真实 source 重建两派生文档;
  主语料 SHA-256 保持 `0c2a1f6569db7c05088ab6d624eeecbcf3bc9260008780c42f3bf01db9db2da6`。
  仅更新 authority digest;generated_at、600 行结果、旧 Q0 implementation 身份均未改。
  未运行 Q0 --write。
- corpus validator 仍失败:CTX-05/06/08/13/15 分别于 09-20/23/21/18/24 到期。
  逐项核验原 source:市场快照明确限定捕获/有效日期;运营与漏斗是七月至八月的统计窗口;
  照护是八月机构指示与旧复诊排期;指标仓库截至八月二十四日。
  仓内没有这些窗口之后的新权威输入。现有合成 fixture 不能冒充现实资料或自动产生续期事实;
  需要语料权威提供更新 source,或具名批准把历史窗口重新核定为冻结 fixture。
  未推 valid_until、未改 checker 门限/校验日、未以日期 sentinel 求绿。
- PG01B pairing corpus、remote inventory/全部 mutation 通过,remote 业务继续关闭。
  repair-6 宿主依赖安装、daemon 66/66、platform 88/14skip、Playwright56/56 的五份日志已逐份
  校验字节/SHA。这解释前轮 EPERM,不能替代本候选最终 full gate。
- 本卡遵照 owner 不重试已知沙箱监听/ps/browser 门。最终 `just ci`、Playwright、指定 daemon
  七文件、页面图像与独立 PG02 review 由宿主在固定候选上执行,此前不得进入 PG03。

## 可恢复证据

仓外 `~/.codex/tasks/saydo-modular-foundation-20260929/repair-7-artifacts/`:
`REPORT.md`、`commands.jsonl`、`log-manifest.json`、`current-action-analysis.json`、
`ledger-adaptation.json`、`candidate-files.json`、I/E pathspec 与 patch、`host-next-commands.md`。
逐命令记录 argv/cwd/exit、真实 HEAD、调用前后候选 diff 摘要、日志字节/SHA;
最终 `candidate.json` 给出真实 git-diff-v1。原始 log 和 profile 不入 Git。

旧 RED 未清零:repair-6 两入口 48 个 unresolved、前轮 Git mismatch/环境失败,
以及本轮 RF00 旧分母、dry-run 旧摘要、mutation 超时均保留原日志与恢复点。
未 commit、push、合并、发布或部署。宿主须回填真实 I SHA 后再形成 E;独立验收另行主持。

## repair-7 固定实现候选宿主门禁

代码提交 `aded272c06d2f7cc6f9606ab612b5f2275ddc297`,干净实现候选上执行34条命令:33通过、1失败。PG02三checker及完整mutation、just ci本地Node/Python双矩阵、Playwright56场通过。PG01A corpus validator因CTX-05/06/08/13/15过期失败;不续期,不放宽required门。独立PG02审查待跑,G-A3保持未关闭,不得进入PG03。

原始日志目录 `~/.codex/tasks/saydo-modular-foundation-20260929/repair-7-host-gates/`,日志不入Git。

|日志|exit|bytes|SHA-256|
|---|---:|---:|---|
|01.log|0|370|`10fadb31722e7b08a1dd4a4b2dcf3d6712af027b66186ced84de06968ab23b10`|
|02.log|0|21|`7814839f17399c70af7adc88a420262bda9e1c53d02e45ce5b4fef97abefac1a`|
|03.log|0|24|`39a4213f5f6c793ae104e1709eb5a20ef438aefe6987a3dd5711636506d2259d`|
|04.log|0|23|`7c54075752724cb808395bd5ca97bcf9b90b6e71945eca59edba4bee651882fe`|
|05.log|0|3212|`e770270114e2b654672944244ffdb1cca82d6177ab4592ee4bc88def212d791d`|
|06.log|0|18|`75e047bc2efcef1de3f3ef2c4f030d2a394102cb7b8019bb86e6d33b02cdf638`|
|07.log|0|21|`5ee014a32aad1a0d1112ea37f75bea272b65eca50b0730a8849dd272a20125c8`|
|08.log|1|6393|`e2e9f4bb24da357050482565d9397b8c0883ceda54a534d228d8fbed7dff2ece`|
|09.log|0|4109|`9c9cf56341e48ce03d2199f82ade5b97bdedb0ab6e73badb406f30ade28200bf`|
|10.log|0|2021|`ddefe69571d87e15d8ebea06245989e353111c5faf82a458f53922d1eb9ddd3b`|
|11.log|0|466|`228852349e75b7b7c10386c67fee1f47cdc49273eccda9a0035c90e9ddb3e925`|
|12.log|0|656|`df6f850213d1f16e347c594f03a6d3ad9b896fdefca4f3c7b78588d13e7cc066`|
|13.log|0|1702|`6c7e0eb416d96153010f97c4d375b58b6ddc5eb46eaa5a15e2aec8e6d73585f1`|
|14.log|0|832|`a24e86aa1d4e81347d3200f867a8176c8280e8a1608096a872e42236750b7d8b`|
|15.log|0|28|`fcf9d9b005e7c8ce7b76fb3bda5028373c684533cec26d35e41c6176db8c3886`|
|16.log|0|1931|`d9c369cc6531ee1f3f7e9401aaf38a99409a3b4ab72528a9664c79cbdda7f770`|
|17.log|0|27|`8b46650b1c52525eafa2b67b3cbfc74b9d7af3bf9e6a74d7f0edec511c91800c`|
|18.log|0|1156|`917d56956c12b7674c2e638f9282e0f5b7a62883e660dd7039eb0536c96c8fda`|
|19.log|0|594|`9fd2e95089050a2519899c388c9ffc42e109262f6c8d09ba43fdb066cb49599b`|
|20.log|0|1027|`3e763ab4fc2481fd3a37fe15fad12facfb77491092acfd9158caa2df741fadef`|
|21.log|0|12272|`62eb38ac0a5589337716b4c05271434f9e876e56f1df88bc6b49c8fc660b6ae4`|
|22.log|0|71|`7c413e5e18145636179f2e0bda6352a2b47903ce4b37b201fe3b7fb982688bcd`|
|23.log|0|512|`6cb54e37c13b5eac36b23ef07aedcdc66c762b45493ebbe11704786b3295ca83`|
|24.log|0|335|`3d038bd0a6bbae2295f5aeaf0d55a4fc48ba617a9c07ea5c2b593f6afd855ffe`|
|25.log|0|3372|`2c3fb66707f99e6ce43e81310276980c163fd698c3db3aa44617952f177f56bb`|
|26.log|0|82|`d360e836a6cc111c570c1c604162160bd7d8017185d5b77904a50445af4a2c20`|
|27.log|0|47|`367ab9953bb662f3754b30586d56c3f69e9a06bff84cbbad2707dec8d03390bd`|
|28.log|0|23|`e97ffbbcc1ec2da64acb2b45cd94178bfa0703a13878c9345ab3f93ff96d7da3`|
|29.log|0|67|`6676ed72b9810374c10d1312f297a64e2a665f08dc8f1128c57b4adf323d4b20`|
|30.log|0|0|`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`|
|31.log|0|448|`8394e399fc1db6433060ab605e25d3087af7e2fc3b75eb52abe171bf4bdc4be0`|
|32.log|0|67|`6676ed72b9810374c10d1312f297a64e2a665f08dc8f1128c57b4adf323d4b20`|
|33.log|0|130605|`7908e841cd0f0a421229379b74a258ab44eaa17b36cf9ecb5b1e3d9620a2d2fd`|
|34.log|0|7294|`4cd0fcb4a139514b3c32f1ff7dfe1ce540f6eaaca0785a0ff4843bcead373c48`|

repair-8 宿主恢复点:代码提交 `526d41f135aea9d173b7b900736776a604d65c6b`,仍为RED。原始23文件摘要全量核验;有限调用闭包合法正例未闭合,不能启动PG03。

repair-9 宿主冻结:代码提交 `0184a64c6dbf5d7521938c6ff80da10814e63575`,当前追加6/6已使用。全部30文件摘要核对,显式stage新增模块后重生成RF00,四台账绑定真实I。PG02调用闭包仍RED,未声称通过;语料退役为owner明确授权,原历史与失败保留。固定候选门和独立审查另行登记。

## repair-10 待绑定证据（新增窗口1/6，RED）

输入HEAD `8f2f42066858c6e9901f9607aec545e8eb0ff866`；新I尚不存在，不以输入HEAD冒充实施提交。完整checker 7822拒绝、完整mutation exit1/32.048秒；54/101来源扫描无拒绝不等于通过。实际手工修22记录、原22none逐项对账，P2 authority模块独改反例通过，原日期/600题/57排除/72sim与13排除/986LIVE不变。宿主固定候选门与独立验收NOT_RUN，G-A3未关闭，不进入PG03。

日志与真实候选元数据在仓外repair-10-artifacts/REPORT.md和COMMANDS.md；action-check-close.log 831297bytes，SHA-256 `8474d921346a5b7b0c5f6e3a161b5e1f188a798f12ef165ef2c2a3d83eda2d18`；action-mutations-close.log 6120bytes，SHA-256 `5a77a44d5a8baf6073bc4f6025b188d8a8b3f5dd053d1f270d7b01cc10c2f8ed`。本条为待绑定稿，未声称独立GREEN或历史实验重跑。

## repair-11 待绑定证据（新增窗口2/6，RED）

输入HEAD仍 `8f2f42066858c6e9901f9607aec545e8eb0ff866`，没有新实施冻结SHA。正式checker 7469拒绝；101动作中57无来源拒绝，完整mutation exit1/27.776秒，services真实调用闭包未闭合。原12跳/256节点/512文件/1MiB/8MiB/30秒不变；原22none身份全部对应，人工改8条不等于全101人工闭合。RF00两实际源人工复核及SHA更新、生成/check/mutation通过；P2退役authority与旧分母保持，Q0未--write。

`action-check-last.log`=801197 bytes/SHA-256 `c3c52b98ba7acb16bc12d90bfc8da3f15cb7b02dffe4aa87e34f35cf955fe6b0`；`action-mutation-close.log`=107349 bytes/SHA-256 `867d4c636bb594ba7008384343f5e4d19d36ea107e6479b15dec2ce661bc2374`。全量诊断和I/E patch/hash位于仓外repair-11-artifacts；raw log不入Git。capability的dirty docs09 blob mismatch单列，action真实来源/ledger/variant/shared-binding失败不是Git绑定问题。最终just ci、Playwright、daemon监听/ps门及固定候选独立验收按授权留宿主；旧宿主通过证据不冒充本卡固定候选。PG02两个P1仍RED，G-A3未关闭，PG03未进入，未commit。此稿待宿主真实I冻结后绑定。

## repair-12 待绑定证据（新增窗口3/6，RED）

输入HEAD `8f2f42066858c6e9901f9607aec545e8eb0ff866`，新实施I不存在。完整101已跑：60来源无拒绝且ledger精确对齐，剩余41未闭合；正式checker8469拒绝，完整mutation exit1/35.848秒并触原30秒。两个P1/G-A3未关闭，不进入PG03。手工仅补S3 verify与openOnScreen两记录，原22none完整对应；动作失败不是Git binding问题。五CTX退役、原600/57/72/13/986LIVE与§17不变，RF00实际source人工复核/write/check/mutation通过。

`action-check-final3.log`=896798 bytes/SHA-256 `670387b88334448f41b26eb54e054c08bf4cc028349e2a21bfee88d50c12c800`；`action-mutation-final3.log`=12687 bytes/SHA-256 `8ce8d830f555b57595c26aaa8cb0abc14c58343569d1fe099d1ee64bccc06902`。 全量ref/result/conditions/via、聚合诊断、I/E pathspec/patch、字节SHA与argv/cwd/exit/候选保存在仓外repair-12-artifacts。raw log未入Git。最终just ci、Playwright、daemon监听/ps门、原树schedule self-test与固定候选独立验收按授权留宿主；未生成伪I绑定、未commit。本稿待宿主真实冻结I后绑定，不声称独立GREEN。

## repair-13 待绑定证据（新增窗口4/6，RED）

输入HEAD仍 `8f2f42066858c6e9901f9607aec545e8eb0ff866`，24份授权dirty原样承接，无新实施I。先核真实执行图与闭包/参数/receiver，再用反例修正注册生命周期、计费摘要槽位、回调遮蔽与TTS事件接线；来源闭合后仅人工补S3注册一条成本SQL。全101与原22none已核：60来源无拒绝且台账精确，41未闭合；checker8276拒绝，完整mutation exit1/28.841秒，时间门未触发不等于通过。setup真实成本SQL仍未覆盖，PG02两个P1/G-A3保持RED，不进入PG03。

`action-check-last.log`=879386 bytes/SHA-256 `c3df203fb393a3e804556ebce36327fd4e89f3ca9759467472a5664c8c1ae07c`；`action-mutation-last.log`=110104 bytes/SHA-256 `b3e6201a9ddb688119ccc4d8a61c17d86fe13f9df4ddcebeb335e5cee6099163`。完整差集、真实图/环境、剩余根因、命令元数据、I/E pathspec/patch与本轮增量在仓外repair-13-artifacts；raw log不入Git。原12跳/256节点/512文件/1MiB/8MiB/30秒、§17及五CTX退役/历史分母/Q0保持；RF00语义source SHA未变，没有自动改写语义裁决。just ci、Playwright、daemon监听/ps、schedule self-test及固定候选独立验收按授权留宿主；本稿待真实I绑定，不自判GREEN，未commit。

## repair-14 待绑定证据（新增窗口5/6，RED）

输入HEAD `8f2f42066858c6e9901f9607aec545e8eb0ff866`，24份授权dirty原样承接；无新实施I。实际receiver/判别值/请求参数关系修复后，API直调不再借BYOA落账，CLI dialog retry不再扩入API；真实CLI成本路径逐跳13，与原12跳和摘要保留坐标合同冲突，完整源码SHA及最小12/13例保存在仓外。没有改门限、零计中间函数或变更产品行为。继续修复真值/精确值混淆、同名receiver遮蔽、只读对象环境共享和局部分组数组来源，保留真实callback/条件与未知拒绝。

全101及原22none已机械核对：60来源无拒绝且ledger精确，41未闭合；checker8178拒绝，完整mutation exit1/20.452秒，前次36.559秒超时保留，不声称性能问题关闭。setup仍256节点/437来源拒绝且缺真实成本SQL；两个P1/G-A3仍RED，全101人工语义闭合未达到，PG03未进入。本轮无ledger记录改动，S3注册六跳TTS成本SQL保持。

`action-check-last.log`=868306 bytes/SHA-256 `0163ba98e4f78882484036d8000ad175b1dc998073b47181cf3a4a073380d505`；`action-mutation-final2.log`=110394 bytes/SHA-256 `45db661aa0215b6211c2a33fbc6a065d0f39c61268fb435b5256e740518e00cd`。全量差集、机制余项、argv/cwd/exit/候选及日志摘要、累计I/E和本轮patch/pathspec/全文件SHA在repair-14-artifacts，raw log不入Git。§17、原预算、五CTX/历史分母/Q0只读/RF00人工语义核对保持；dirty canonical绑定另列，不能解释真实callee失败。just ci、Playwright、daemon监听/ps、schedule self-test和独立验收留宿主；此稿待真实I绑定，未commit，未自判GREEN。

## repair-15 待绑定证据（新增窗口最后第6/6轮，RED）

输入HEAD `8f2f42066858c6e9901f9607aec545e8eb0ff866`、24份dirty及指纹 `93a583f2350e145eea2bead0cce5ad79c157406830b3fe743cacd93a4de29b06` 实核。真实provider工厂opts/返回臂/chat实参保留，模块singleton与局部const创建按真实环境复用；默认limiter队列/Promise履约/release闭包及fetch替换实现增加真入口正负例。未知输入、旧队列元素、藏写callback、源变更仍拒绝。上述局部机制修复未使生产闭包完全收敛；memory approve仍8条来源拒绝，setup仍256节点且漏真实成本SQL。

最终全101及原22none：60项来源无拒绝且ledger机械精确，41项未闭合；正式checker10758拒绝，完整原mutation exit1/23.822秒，真实正例仍失败。60项已人工复读入口和主要效果，但未达到全101完整人工语义审定；A2/A3全部在未闭合ID，没有给不完整扫描闭包自动补账，本轮ledger零改动。37既定门为30自检通过、3失败、4宿主待跑；自检不等于独立GREEN。产品行为、§17、12/256/512/1MiB/8MiB/30s、五CTX退役、历史分母与Q0只读保持；RF00两源人工重读且SHA未变，check/mutation通过。

真实CLI 13跳与12跳合同的冲突、原合同内替代及不适用原因、仅建议未应用的最小合同修订草案，以及全部剩余非冲突根因分别保存于仓外repair-15-artifacts。不能把其余41项失败归入合同冲突。待宿主真实I/source_binding、未运行daemon监听ps/schedule隔离self-test/just ci/Playwright与checker缺口分开；不关闭PG02，不启动PG03，不自追加预算或派review。

`action-check-final.log`=1143375 bytes/SHA-256 `dd502d8c9d6a15edeed70a773bdf70aa7aeab1505cfdca9260bc99d5c9eb73c3`；`action-mutation-final.log`=111666 bytes/SHA-256 `b94f381246378c12b08194fd7b784bd6af8391e4e338b2e7ff9cc80601e56daa`；`effects-final.log`=10774 bytes/SHA-256 `8ad51ef5362d734a709e47f59ea623da56039e38210324f91ab20e8c41163d7f`；`boundary-final.log`=328 bytes/SHA-256 `ed347aa296e8b6ffba85b8f36e8c08b6fc6ddb2a49c4420da4bf749ffa12b4d0`。精确argv/cwd/exit/候选、全101对账、累计I/E与本轮增量patch、24文件SHA/指纹及重建验证在仓外repair-15-artifacts。raw log不入Git；未stage/commit/common-dir写，旧轮次与失败保留。

## repair-16 C13 合同候选（新增最多2修复/2审查窗口第1次，待 C13-contract）

输入 HEAD `8f2f42066858c6e9901f9607aec545e8eb0ff866`、24份累计 dirty 指纹 `daa3f43eb85886f0068b53d2eff880f17b009f812fb0f3e1ddacb4b81af77a1d` 已实核，旧累计15修复与所有RED保留。owner-extension-4 采纳 NEXT-BOUNDED-WORK 的“按此预算执行”；本次仅合同与证据，schema/checker/test/ledger 的继承字节未改，未stage/commit/common-dir写。

重新从当前源码 AST 核验 CLI dialog 成本链：13 个不同调用表达式，index.ts:1393 的 wrapper 与 callback 内调用分处第35/63列，不能按相同行号去重；provisional 创建、hook/slot/DB 接线、逐请求事务循环和末四条计费摘要坐标均已核对。此为静态可达见证，不是真实 CLI 或计费运行，不是全入口来源闭合。原生事务沿既有边界检查 callback 写点，不把本地中间函数零计数。

docs09 §18 的 via/非回边/对应缓存重放统一为13，14跳拒绝；节点256/文件512/1MiB/8MiB/30s、§17、完整101及原22none逐项核验与支持范围不变。当前实现仍限12：直接链与摘要重放的12通过、13/14拒绝为本轮最小复现，绝不据此声称13产品门已通过。必须先通过宿主独立 C13-contract，才在剩余第二次修复同步实现。C13不关闭PG02。

代表生产路径只读诊断：setup 256节点/1969部分effects/494来源拒绝，仍缺成本SQL；5个opts环境对应40个BYOA chat key。memory approve 68节点/12 effects/8拒绝；recovery clear-invalid 13节点/2 effects/4拒绝。setup 原函数扫描与只读插桩的序列化结果全等。三项都是未闭合诊断，不是正式checker通过；全101与完整mutation本轮按授权未重跑，旧60/101和其余41项RED保留为继承事实。

精确文件/符号/测试映射、原始图/环境/条件、全引用搜索、源码bytes/SHA、累计I/E与本轮增量在仓外repair-16-artifacts。没有新散落仓内方案。R15-N1..N7全保留，先闭合代表路径再做完整回归；未知来源、receiver、callback与条件不得豁免。宿主冻结/独立审查尚未进行，不自判GREEN，不启动下一阶段。

`witness-verified.log`=727 bytes/SHA-256 `92281ee7438833e1c99f02c09726d66158f59e6277c588842326368cdba33ecd`；`production-setup.log`=4516 bytes/SHA-256 `060796a4a1289479c1ffdba6cd467e584efa40f4843ee236285d1c5550f6a9f8`；`production-memory.log`=4352 bytes/SHA-256 `f2b776f3b32069eeca70607ebe6a99aeea978f4990ce90824489af53a221bce2`；`production-overrides.log`=1255 bytes/SHA-256 `fccd4b92b603ebb973e4fa7852236511c3529d92cc2e0921040e36b0b185b964`；`boundary-replay-final.log`=451 bytes/SHA-256 `e6d0fa70e940d58611497e67407fc63be4ca518a4903a9eb23d07f18d6b8ec24`。raw log 不入Git；每份日志的 argv/cwd/退出码/耗时与SHA在同名 result.json，全部日志汇总在 logs.sha256.json。

## repair-17 · 已审 C13 实现同步，PG-02 仍 RED

输入 HEAD `8f2f42066858c6e9901f9607aec545e8eb0ff866`、24 dirty 指纹 `cea9b7291eee34a0e2b136387d1fb639422b643eb9eeee7b341f9625311621f9` 已核；review-8 仅通过 C13-contract。承接全部旧15次及repair-16，不新增第三次修复、不派agent/reviewer。

本轮 schema via.max、扩展/重放、构造/叶子剩余预算同步13；14拒绝，来源递归12及256/512/1MiB/8MiB/30s不变。真实CLI13调用点再核为13，重复物理行调用未去重；直接12/13/14、短路径缓存后长路径重放、剩余预算与改源反例通过。完整effects测试通过；services保留真实setup CLI13成本链正例，仍失败，没有用API短链替代。

来源修复只有限收窄：同一receiver、请求创建slot、真实CLI predicate集合和已核覆盖控制流关联，dialog/evaluator裁掉被provisional覆盖的初始化BYOA实例；thinking/cheap非CLI配置的dialog fallback仍保留。不同opts/receiver不合并，初始化阶段效果不省略。setup BYOA chat上下文从前轮40到20，但仍256节点、581拒绝（334预算/重放）、881观测效果且无cost SQL，不能称闭合。memory仍8拒绝；recovery仍4拒绝。静态focus14跳诊断止于FocusWriteError构造器，前序authority/事务状态条件未证成，不宣称另一条真实超长成本链。

全101对账仍60机械闭合且ledger精确、41未闭合；原22none身份保留。正式checker9359拒绝（callee5394/A2 3541/A3 417/variant6/shared1）。完整mutation exit1/28.733s；低于30s但整体仍失败。逐ID差集、当前人工复读范围和继承repair15说明见repair-17-artifacts；未宣称全101人工闭包审定，不复制不完整扫描结果入ledger。

schema/类型/lint、语料、RF00 check/mutation等执行结果逐条保存；RF00两个TS源人工重读后更新semantic SHA。Q0只check、五CTX退役保持。原37门当前29通过、3失败、5留宿主（监听测试、冻结ref隐私、schedule隔离self-test、just ci、Playwright）；最终doclinks/emoji结果另记录。真实source_binding待宿主I冻结后运行host-bind.py；未生成Git对象。宿主冻结/独立review未做，PG02未关闭、PG03未进入。

原始日志均在仓外repair-17-artifacts，argv/cwd/exit/候选前后SHA在同名JSON；含早期失败/撤回实验，不抹除失败。关键日志：

`action-check-final.log`：1009110 bytes，SHA-256 `0174e618697ae95165e2e9afdea379b98f3b8462226202fdab7ac1af234397f6`，exit 1，37.975s。

`action-mutation-final.log`：111753 bytes，SHA-256 `d2c23b0b93071effa1e2ff1630e69432413ea3c0c140f621ad1f5df852aefc9c`，exit 1，28.733s。

`effects-final.log`：10861 bytes，SHA-256 `f9493a9ca5fbf82057be43d6f86dc40bea20995b4d408cc452d5fb0887f1573d`，exit 0，3.312s。

`setup-final.log`：4518 bytes，SHA-256 `4b359a146cf7423337f1e51d79e9e69e17216cdd25a006eab6b0086bf241a36a`，exit 0，3.067s。

`memory-final.log`：4352 bytes，SHA-256 `f2b776f3b32069eeca70607ebe6a99aeea978f4990ce90824489af53a221bce2`，exit 0，1.645s。

`recovery-final.log`：1255 bytes，SHA-256 `fccd4b92b603ebb973e4fa7852236511c3529d92cc2e0921040e36b0b185b964`，exit 0，0.921s。

收尾：dry-run 两份既有派生报告因 C13 合同输入摘要变化而失配，使用既有 renderer 重建，主语料摘要仍为 `ffca34aab5455a37f1812ef0a0420d387205187b9dc3f654ff97c6c89137fcf5`；原失败日志保留，复验见 repair-17-artifacts/dry-run-final.json。

## repair-18 · 2026-09-30 · PG-02 repair-18（owner-decision-5 第1次修复调用，RED）

- 输入：继承 HEAD `8f2f42066858c6e9901f9607aec545e8eb0ff866`、24份 dirty 和指纹 `19c8139dd4c8e70cda269359c7f44f86ba25e88afa96cd6f7a32ae21bdd02aa3`，真实核对并保存输入快照；旧 RED、计数及主树工作保留。
- 行动：先用独立编写的顺序短→长14跳 fixture 复现 B1，再由原生产入口复现 B2 的256节点/581拒绝/零成本路径及 B3 的37条声明缺成本SQL。分离路径预算验证与最短效果见证去重，检查共享尾链和计算叶子深度；保留非回边、实际receiver及条件语义。按实际四槽循环/返回臂与CLI覆盖证明收窄来源，修复计费摘要被泛化工厂解析遮蔽，并核验实际订阅回调绑定。产品、合同、台账记录与各预算未改。
- 产出：仓外 repair-18-artifacts 保存修前/修后日志、全101/原22none逐ID数据、门禁精确argv和累计I/E/本轮增量恢复包；最终结果以该目录 REPORT.md 为准。B1 12/13通过、14拒绝的顺序/条件/共享尾链/纯叶子/receiver回归 exit0；setup 定向诊断仍256节点/511拒绝/零成本路径。
- 结论：RED / 待独立审查。B1已有实现及正反例证据；B2仅部分收窄，真实完整入口仍不闭合，不能把局部计费解析成功当完整13跳效果发现。按指定先后关系未补写B3，未闭合来源不复制进台账。全量语义验收未达到；PG03未进入；无stage/commit/push、全局配置、task.json或主树写入，无agent/reviewer，不自判GREEN。

`b1-before.log`：3779 bytes，SHA-256 `4d49a638f2c78978d1665be8d94f9fc3d41b2174a13d8df64e6adef77880522f`，exit 0。

`b2-before.log`：4518 bytes，SHA-256 `4b359a146cf7423337f1e51d79e9e69e17216cdd25a006eab6b0086bf241a36a`，exit 0。

`b3-before.log`：50515 bytes，SHA-256 `0f5d75fcea9ec0d53c14f7fc3234883e23e4eaa9f7c702a2f1bea7d30b0ae08d`，exit 0。

`b1-budget-regression.log`：10952 bytes，SHA-256 `4ff024f4ca93432ae6a27d6d63e88b16e3af1488885608fdeaf509b4f9d18d27`，exit 0。

`setup-final.log`：6532 bytes，SHA-256 `1d5f3c2f97435ab50b7acb88c043977953775ea5f5ee86937c6faf89be3154d6`，exit 0。


## 2026-10-02 repair-25 事实补充

输入 HEAD `8f2f42066858c6e9901f9607aec545e8eb0ff866`,输入 git-diff-v1 `8cecb616660f09e391308e906b04e9f469d12f308ed06d28d458c96b4388cddb`。本轮仅隔离候选,未 commit/merge/push,未改 C14 合同、原预算或产品业务行为。

[ok] C14 在已收费候选源的 AST 运行时 import/re-export 不可满足前提上提前禁用 A,不构建局部 Program 冒充证明;数组/可变对象仍拒绝。同次检查不复用可变 config/lib/source 的接受证明。fixture 的读取收费与原 512files/1MiB/8MiB/30s 正负例另见本轮日志。

[ok] B4 正式 checker 的 ok 与 closureReady 使用同一 blockingFailures;三类真实超界诊断仍保留 RED。完整 checker 与正式 CLI 入口的合法超界正例 exit0、unknown/非法登记反例 exit1,见 `repair-25-artifacts/33-action.log`。fixture 不代表真实产品闭合。

[fail] 正式产品 checker 修前 exit1/69.252秒,修后最近有效运行 exit1/61.563秒/11267拒绝。两者都是41/101来源扫描无拒绝;没有把无拒绝当全量验收。C14 compiler 读入0文件/0字节且0accepted,总读入442文件/5696412字节,完整成本仍超过30秒,B2未关闭。

[warn] 修复真实 audit.record 的 action shorthand 参数来源漏记,unknown 保留拒绝。ws:voice.anchor_prepare 不再 none;按真实扫描登记121个含路径条件的效果,其中真实 voice.anchor_prepare 审计通过 hub→barrier→组合根回调到 SQLite sink;该动作仍有388扫描拒绝,未使用 B 豁免。新真实 WS/SQLite 审计与同请求重放测试保留在 voice-barrier.test.ts,实际运行由宿主 full gate 执行,本实施者未跑 daemon suite。

全101 ID与repair-8历史原22none逐项对账见本轮 `all-actions-final.json`、`original-22-none.json`、`ACTION-AUDIT.md`;当前12none单独全量列出,不能代替原22cohort。其余动作的手工语义闭合仍未达到,B3保留RED。3条超长JSON记录只作紧凑排版,不删效果/条件/via,action-ledger仍遵守单文件1MiB。

[ok] CI-FIX已有test差额及C14 contract test的机械发现与真实人工处置同步,RF00 inventory/md/acceptance-matrix生成/check/mutation通过。[fail] docs09工作区与HEAD不同的capability source binding原门保留。[fail] CTX-09/12/16的冻结来源与2026-09-30有效期保留,没有新的真实更新来源可替代,未续期/删语料/Q0 --write。

日志 argv、code、耗时、bytes、SHA-256和候选前后身份均在仓外本轮同名json;最终候选与未做项以 REPORT.md/NATIVE-TERMINAL.json为准。focused自检不是独立GREEN;full/Linux/fresh review交由宿主,PG03未启动。

### 2026-10-02 repair-26 最后有限复修(产品仍 RED)

输入:review-15 的 writing approve outbox 路径漏登与 voice.anchor_prepare transition 错绑;本次仅隔离候选,账本由宿主管理。

行动:两个 approve 记录按真实扫描登记28个效果,含 operations.ts:427→661→60→outbox.ts:115 的 writing outbox UPDATE及 callback.freeze 条件审计;全101 effectKey/conditions/via与跨函数绑定逐项机器对账,anchor_prepare 改为已证 effect/via 支撑的 shared_bound。未改业务与合同。

产出:仓外 repair-26-artifacts/all-actions-final.json、all-101-differences.json、original-22-none.json 与 ACTION-AUDIT.md;真实Git旧22none和101原ID全等保留。两个approve和anchor已扫描效果登记精确相等,但其未知/超界仍阻断。其余37动作仍有3078漏登、415多登或条件/via不匹配;setup:postTier1SetupTest跨函数来源未证明仍拒绝。全量扫描效果3781个,全部登记的压缩ledger约3.54MiB超原1MiB,未扩大限额;当前完整ledger916049bytes。

性能:重复条件校验改为同完整源码AST语法索引,不复用来源判定;13hop深度先检查后去重。新增错误branch/同Map源码变更/跨函数误绑/approve双路径漏登与错via mutation。正式checker实测56.400→39.503秒,仍超30秒,不得称性能通过。

结论:[fail] PG-02仍RED;CAP09 dirty合同与HEAD不一致、CTX09/12/16过期前提未获改变授权,未伪续期或commit。focused与具体日志见仓外REPORT/COMMANDS;full/Linux/browser/freshreview由宿主执行,本实施者NOT_RUN。无commit/merge/push/发布/生产服务或新agent。
