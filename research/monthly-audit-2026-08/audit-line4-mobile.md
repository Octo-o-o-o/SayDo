# mobile/remote 线 commit↔文档 双向对照审计

> 审计人:零上下文独立会话(Fable 5)。日期:2026-08-27。
> 对象:14 条 commit(`line4-mobile.txt`)× 三份锚定文档 × journal / evidence / 当前 main 代码。
> 仓库:`~/WorkSpace/SayDo`,审计时 `git branch --show-current` = `main`,HEAD `f723ab7`。
> 纪律:所有断言均出自本会话真实命令输出;无法复核的标「未核实」。只读,零修改。

## 计数

| 级别 | 数量 |
|---|---|
| A(错误/不一致) | 1 |
| B(疏漏/不足) | 2 |
| C(观察) | 7 |

---

## 0. 事件链还原:mobile 线并入 → main `just ci` 红 → 9a3e180 修复

任务指定必须完整还原的背景线。逐环取证结果:

### 0.1 拓扑与时间线(本会话 `git log --graph` / `git log -1 --format='%ci'` 实测)

```
e22be46 (08-23 22:00) merge-base ── release 线与 mobile 线的分叉点
├─ release 线(main 侧):09f7920 (08-24) 引入门禁 scripts/test-ios-build-and-install.mjs,
│   并改写 apps/ios/build-and-install.sh 为 SAYDO_IOS_DEVICE_ID 合同;…→ rc.5–rc.12 链 → 1f2e57e
├─ mobile 线(codex/rc4-mobile-readiness-fix):
│   7062267 (08-24 00:30) → 36a4450 → fc6bef3(evidence) → c56ebdf → 4fe482b(evidence)
│   其中 7062267/36a4450/c56ebdf 三连把 apps/ios/build-and-install.sh 重构为
│   scripts/mobile-install-common.sh 公共库 + saydo_pick_single_device 自动发现,变量改名 SAYDO_DEVICE_ID
└─ d83c341 (08-26 22:36) merge → 6cb461c (22:38) → 5e27796 (22:50) → … → 9a3e180 (08-27 09:37) 修复
```

- rc.12 tag 时间:内部仓无该 tag(`git tag --list` 仅 `v0.1.0-rc.1`;`git ls-remote --tags origin` 同);
  `e2e/evidence/w54b-batch.md:265` 记录「rc.12 tag 打于 2026-08-26 19:43,d83c341 在 22:36」——与
  `git log -1 d83c341` 实测 22:36:27 吻合,「tag 后 3 小时」为约数(2h53m)。tag 本体在公开仓,本地不可复核(见「未核实」)。

### 0.2 红灯机制(静态复核,全部命中)

- `git show d83c341:scripts/test-ios-build-and-install.mjs` 存在;该脚本断言
  `source.includes('platform=iOS,id=${SAYDO_IOS_DEVICE_ID}')` 等(见 9a3e180 删除 diff 全文)。
- `git show d83c341:apps/ios/build-and-install.sh` 已是 mobile 版:第 9 行 `COMMON_LIB=…/mobile-install-common.sh`、
  第 158 行 `saydo_pick_single_device`、第 179/196 行 `SAYDO_DEVICE_ID` —— 门禁断言必失败。
- 二分链复核:`git show 329a40d:apps/ios/build-and-install.sh | grep -c SAYDO_IOS_DEVICE_ID` = 5,
  `1f2e57e` 同为 5(旧合同在,门禁绿);`d83c341` 起为 0(转红)。与 w54b §14.2 记录的
  「329a40d 绿 → 1f2e57e 绿 → d83c341 红 → c383bc0 红」一致。
- 「合并后全仓 SAYDO_IOS_DEVICE_ID 命中 4 处全部在门禁脚本自身」:`git grep -c 'SAYDO_IOS_DEVICE_ID' d83c341`
  = `scripts/test-ios-build-and-install.mjs:4`,唯一文件、恰 4 处。命题成立。
- 连带后果「三项 mobile 门禁从未在 just ci 执行」:d83c341 的 justfile `ci-node` 中
  `test-ios-build-and-install` 行位于 `test-pairing-url-corpus / test-mobile-installers /
  test-mobile-release-contract` 三行之前(`git show d83c341` 的 `diff --cc justfile` 可见),
  just 按行 fail-fast,成立。

### 0.3 修复(9a3e180)与当前状态

- 9a3e180 diff:删 `scripts/test-ios-build-and-install.mjs`(54 行)、justfile `ci-node` 删该行、
  package.json `ci:node` 删该段。与消息逐句一致。
- 本会话在当前 main 实跑三项 mobile 门禁(首手证据):
  - `node scripts/test-pairing-url-corpus.mjs` → `[ok] pairing url corpus 216 passed`,exit 0
  - `node scripts/test-mobile-installers.mjs` → `[ok] mobile installer self-test 128 passed`,exit 0
  - `node scripts/test-mobile-release-contract.mjs` → `[ok] mobile release contract 227 passed`,exit 0
  与 9a3e180 消息及 w54b §14.3 记录的 216/128/227 逐一相同。
- 残留引用清点(任务点名「grep 脚本与 justfile」),当前 main:
  - **可执行面全净**:justfile `ci-node` 无该行(本会话 sed 输出);package.json `ci:node` 无该段;
    `.github/workflows/` 零命中(`grep -rn 'test-ios\|SAYDO_IOS' .github/` 空;ci.yml 现跑三项 mobile 门禁
    + `ios-shell` 模拟器 job,后者与被删门禁无关)。
  - **非执行面的历史引用**(`git grep` main):`e2e/evidence/w54b-batch.md`(事件记录)、
    `history/PROCESS-JOURNAL.md` R110、`prompts/146/157/158/160/164`(RC4 privacy 线历史工作单)、
    `research/week-audit/2026-08-23-publication-manifest.json:11326`(账本,见 C-3)、
    `research/rc4-unmerged-tooling/test-ios-artifact-policy.mjs`(08-27 17:42 由 511787f 抢救入库的
    未采用工具存档,晚于修复,见 C-4)。均非门禁/构建路径。
- 文档记录:R110(journal:2790-2837)+ `e2e/evidence/w54b-batch.md` §14.2/§14.3 + 9a3e180 提交正文,
  三处相互一致、根因与处置完整——**除一处叙事与 git 留痕矛盾,即本审计唯一 A 级(A-1)**。

### 0.4 自洽性结论

当前 main 上:门禁删除完整、三项 mobile 门禁实测绿、workflow 干净、`remote-mobile` 门与 A2 重连修复原样在位
(`SetupBootstrapBoundary.tsx:14/27` 有 `remote-mobile` kind;`MobileApp.tsx` 零处
`installMobileForegroundReconnect`)。事件链在文档中如实、多处冗余记录。**状态自洽,唯根因叙事的一个从句
与 merge commit 留痕矛盾(A-1)。**

---

## A 级发现(1 条)

### A-1 ·「git 不报冲突,因为两边改的是不同文件」与 d83c341 的 `# Conflicts:` 留痕矛盾(三处文档同错)

- **主张**:ci 红根因叙事中的「git 未给信号」从句为假。三处原文:
  1. 9a3e180 提交正文:「该门禁不存在于 mobile 线,那条线无从同步——**git 不报冲突,因为两边改的是不同文件**」
  2. `history/PROCESS-JOURNAL.md:2800`(R110):「两条 RC4 分支的语义级合并冲突(**git 不报,因两边改不同文件**)」
  3. `e2e/evidence/w54b-batch.md:255-256`(§14.2):「语义级合并冲突(**git 不报冲突,改的是不同文件**)」
- **证据**(本会话实测):
  - `git log -1 --format=%B d83c341` 尾部自动生成的冲突清单:
    `# Conflicts: apps/ios/README.md、apps/ios/build-and-install.sh、e2e/evidence/2026-08-22-mobile-shells-device-build.md、justfile、package.json` ——被测脚本与 justfile **都在冲突名单里**。
  - 双侧修改实证:`git log e22be46..1f2e57e -- apps/ios/build-and-install.sh` = `09f7920`(release 侧);
    `git log e22be46..4fe482b -- apps/ios/build-and-install.sh` = `c56ebdf/36a4450/7062267`(mobile 侧)。
    justfile 同理(09f7920 vs 7062267)。
  - 合并处置实证:`git diff d83c341^2 d83c341 -- apps/ios/build-and-install.sh` 为空(installer 整取 mobile 侧);
    justfile 的 `diff --cc` 显示两侧门禁行被**并集保留**,且 ios 门禁行排在三项 mobile 门禁之前。
- **准确的机制应为**:git **报了**冲突(installer 与 justfile 都要人工解),解法取了 mobile 版 installer、并集了
  justfile 门禁行;真正无冲突信号的只有门禁脚本本身(release 侧独有文件)。「语义级」成立之处在于:门禁↔被测
  脚本的矛盾**跨文件**,任何单文件的冲突解决画面都不直接呈现它,且合并后未立即复跑 `ci-node`(当晚仅单独跑过
  mobile release contract,见 6cb461c 正文)。结论(语义冲突、删门禁、rc.12 绿与 main 红不矛盾)均不受影响,
  但「git 不报冲突/两边改不同文件」作为事实陈述是错的,并被三份档案复制。
- **建议处置**:在 w54b §14.2 与 R110 各补一行更正(commit 正文不可改):d83c341 实际带 5 文件冲突
  (含 build-and-install.sh 与 justfile),漏检环节是「冲突解决取舍后未复跑 ci-node」,而非「git 无信号」。

---

## B 级发现(2 条)

### B-1 · gap-audit 文档两处 file:line 引用错位(结论本身与代码相符)

- **主张**:`docs/review/2026-08-13-mobile-gap-audit.fable.md` 在锚 `cda99b8` 下有两处引用坐标错误:
  1. B1 条:「`.m-composer` 两翼 36px(`mobile.css:674-678`);`.m-back`/`.m-avatar` 38px(`mobile.css:120-124`)」——
     两个行号**互换了**。实测 `git show cda99b8:…/mobile.css`:120-124 行是 `.m-composer` 的
     `grid-template-columns: 36px …`;674-678 行是 `.m-avatar,.m-back` 的 `width/height: 38px`。
  2. A1 条:「`via=tailnet` → 显式 403 setup_local_only(`index.ts:988-998`)」——实测该文件
    `setup_local_only` 出现于 967/1021/1115 行;`/api/setup/probe` 的 tailnet 403 块在约 961-973 行,
    988-998 行是 probe 响应的 `bootPromote` JSON 拼装,引用范围偏移约 25 行。
- **证据**:上列命令输出均在本会话(`git show cda99b8:packages/console/src/mobile/mobile.css | sed -n '674,678p;120,124p'`;
  `git show cda99b8:packages/daemon/src/index.ts | grep -n setup_local_only` 与 `sed -n '955,972p'`)。
  其余抽查的引用全部命中:`mobileLan.ts:11-26`、`index.ts:875-885`(mobile_lan_route_rejected 于 880)、
  `SetupBootstrapBoundary.tsx:20-23`(逐字)、`confirmCopy.ts:17-23`、`hub.ts:826-836`/`857-860`、`hooks.ts:14-21`。
- **建议处置**:低价值回改;若该文档还会被当施工/复核索引使用,顺手改这两处坐标即可。

### B-2 · 08-24 mobile 分支批与 08-26 并入后序列在 journal 无轮次/索引行;6cb461c 全仓零文档提及

- **主张**:R84 确立并回补过「PLAN-2 §7-9 一行索引纪律」(journal:1793-1820,补录 08-04~08-20 各批)。
  但本线的以下工作没有任何 R 轮次或索引行:
  - 08-24 分支批(7062267 → 36a4450 → fc6bef3 → c56ebdf → 4fe482b,`codex/rc4-mobile-readiness-fix`);
  - 08-26 并入后序列 6cb461c(版本锚释放)、5e27796(账本重生成);及背景性的 c0df247 与 rc.5–rc.12 链。
  R110 只在追溯 ci 红根因时提到 d83c341/c56ebdf;`git grep -c '6cb461c' main` **零命中**——该修复只有
  自身 commit message 一份记录(消息本身翔实:三处锚过时假红、动态化版本锚、227 项全过,与 diff 逐句吻合)。
- **对冲证据**(说明不是「全无记录」):分支批有 prompts/114–164 的 `rc4-mobile-*` 工作单链
  (143/148/154 记录了两轮 No-Go 退回与返工,`prompts/203-rc4-long-session-handoff…md:31` 记录末码
  c56ebdf 全 hash)、`e2e/evidence/2026-08-22-mobile-shells-device-build.md` §5 记录 36a4450 全 hash 与
  门禁/原生测试结果、`docs/release/version-matrix.md` 为其版本 SoT。缺的是 journal 侧的索引位。
- **建议处置**:按 R84 同款「一行索引」补录一条(日期/末码/载体=prompts 143-164 + evidence §5/评审=独立
  readback 退回两轮),并把 6cb461c/5e27796 挂进 R110 或该行,消除孤儿 commit。

---

## C 级观察(7 条)

### C-1 · 锚定文档记录的 SHA-256 指纹因 09f7920 路径脱敏而过期(原始 blob 全部验中)

- shell-strategy §6/§8 记录:69 报告 `c28e9964…/18161B`、70 prompt `0c93c792…/4725B`。当前文件为
  `f093d9e0…/18145B`、`57dcbfb4…/4693B`。差异全部来自 09f7920(08-24「收紧公开树隐私」)把
  `~/...` 改 `~`;`git show 35604be:<file> | shasum -a 256` 得到的**原始 blob 与文档记录
  逐字节一致**。70 报告 `4252ebfe…` 未被脱敏波及,现值仍与文档一致。
- 同理:R72/R73 记录的 w0 readback(`c5e6162…/4888B`)与 evidence(`83efe3e9…/5471B`)指纹,与
  `git show bc2ac87:<file>` 完全一致;当前工作树版本仅差 09f7920 的一处路径替换(diff 实测)。
  `docs/review/2026-08-16-now-vs-later.md` 未被波及,当前 SHA 仍与 R73 记录一致(`302664fd…/9332B`)。
- 本地 logs(不入 Git,`git check-ignore` 证实 ignored、`git ls-files logs` 为 0):
  69/70/73/74 四份日志的 SHA-256 与行数**全部与文档记录一致**(本会话 shasum 实测)。
- 处置:无需动作;这是「指纹记录的是当时版本」的预期语义。若要杜绝后人误判,可在脱敏 commit 说明或文档加一句注。

### C-2 · readback 台账第 1 条以 `HANDOFF.md:21` 佐证「指针=remote-mobile-w0」,该状态只存在于工作树,从未入库

- `git show addfd19:HANDOFF.md` 第 21 行仍是基线空指针注释;`git show bc2ac87:HANDOFF.md` 第 21 行已是
  「指针:空。`remote-mobile-w0` 已收口(代码 addfd19…)」。两提交法下指针 set 态本就不产生 commit;
  R71(「HANDOFF 指针仍为 remote-mobile-w0,待授权后清」)与 R72/R73、bc2ac87 收口行共同佐证流程真实执行。
  仅指出:该条证据事后不可独立复核,属流程设计使然,非造假信号。

### C-3 · publication manifest 仍列已删除的 `scripts/test-ios-build-and-install.mjs`——已被文档预答,现况无害

- `git grep -c` 证实 `research/week-audit/2026-08-23-publication-manifest.json` 现仍含该路径(9a3e180 后未再生成)。
- 无害性核验:`scripts/test-public-text-redaction.mjs:129` 把该 manifest 列入 generatedSkip(不校验内容);
  `scripts/release-physical-closure.mjs:109-124` 的 `assertPhysicalToolFingerprints` 只要求**闭包成员必须
  登记在 manifest**,多余条目不校验;被删脚本不在 `physicalToolClosure`(闭包=post-release-gate/verify-release-url/
  week-audit 的 import 闭包 + 4 个非 JS 根)。
- w54b §14.2 已明示:「manifest 中的该路径条目属账本,随其既有重生成流程处理,本节不手改」。下次重生成时自消。

### C-4 · 08-27 抢救入库把断言旧合同的姊妹工具带回 research/ 存档(晚于修复,不接线,自洽)

- `research/rc4-unmerged-tooling/test-ios-artifact-policy.mjs`(含 4 处 `SAYDO_IOS_DEVICE_ID` 断言)由
  511787f(08-27 17:42,「抢救入库 RC4 …20 个未采用工具」)加入,**晚于** 9a3e180(09:37)。
  它属于 R113 抢救线的存档(journal:2908 附近登记),未被 justfile/ci/workflow 引用。
  9a3e180 提交时「全仓命中全部在门禁脚本自身,生产代码零处」的陈述在当时为真;现在多出的命中全部在
  prompts/research 历史档,断言依旧成立(生产/门禁面零处)。

### C-5 · gap-audit 清单各条的「当前 main」状态与文档口径逐一相符,无虚报完成

- 已修且在位:A1(`remote-mobile` kind、仅 `mobile_lan_route_rejected`,probe 仍不进 `mobileLan.ts` 白名单)、
  A2(MobileApp 零重连监听,单一 owner 在 `useVoiceChannel` + `reconnectPolicy` 400ms 窗)——均 addfd19 落地、
  经 08-26 大并入存活(本会话 grep 当前文件证实)。
- 分支批兑现的:C4 配对校验三端对齐(pairing-url corpus 216 例三端同源,实测 pass)、
  D6 版本统一(iOS `Info.plist` 0.1.0 / Android `versionName "0.1.0"` / 鸿蒙 `app.json5` versionName 0.1.0,
  `docs/release/version-matrix.md` 为 SoT 记「三端壳统一 0.1.0 (1)」)。
- 按文档声明仍不做/待办的,现状确实未做:B1 触控热区仍 36/38px(mobile.css 现 122/678 行)、
  C2 鸿蒙 `module.json5` 仍仅 `ohos.permission.INTERNET`(相机权限=提审前项)、
  D1 Android/鸿蒙主导航白名单未加(提审前项)。
- readback 的 P2 备注仍如实:`installMobileForegroundReconnect` 至今仍导出(reconnect.ts:28),
  仅测试消费,生产不调用。

### C-6 · shell-strategy 的行数复验与 owner 拍板项指针,现势核验通过

- 行数(在其锚 `e987f05` 重算):Android Kotlin 905 [ok]、鸿蒙 ETS 1195 [ok]、React 移动非测试 2095 + 测试 729 [ok];
  iOS Swift 2064 = **非测试口径**(全量 2184,测试文件仅 VoiceStateMachineTests 120 行)——文中未标注口径,
  与其 React 行的标注法一致,数字正确。
- tailnet:strategy §5.1 要求「不拍板则只认 LAN」——addfd19 恰好只旁路 `mobile_lan_route_rejected`,
  09 回写明文「不得旁路 setup_local_only」,HANDOFF §2-17 另立「T19 × tailnet 前置门」行,三处一致。
- 「设计 ADR-003(产品载体)」指针仍有效:docs/adr/README.md 明示「设计 ADR-003 | 产品载体与部署组合 | 预留,
  尚未成文」;工程 `ADR-003-os-adapters.md` 是**另一命名空间**(设计 ADR-004 明写「不吞并设计 ADR-003」),
  无撞号。随之而来的已知开口:docs/07 D12 至今仍写「Capacitor + 薄原生模块」,与仓内三端原生壳事实相反——
  这正是 strategy §5.2 预警过、明确留给 owner 拍板后一次性回写的债,不是漂移新增。

### C-7 · c0df247 属 release 线,列入本清单仅因处于并入窗口;实施与消息一致

- diff = `scripts/post-release-gate.mjs` 两处:remoteCommand 补内层引号 + `parseVerifierOutput` 恢复
  len/head/tail 诊断,与其(异常详尽的)提交正文逐句吻合。rc.10/rc.11 证据 json 在
  `e2e/evidence/2026-08-26-rc1{0,1,2}-*.json`。与 mobile 壳无涉;rc.5–rc.12 链整体同样缺 journal 轮次
  (归入 B-2 的相邻观察,超出本线主责)。

---

## 附录一 · A 向(文档→commit)逐项核验台账

### 1. `docs/review/2026-08-13-mobile-gap-audit.fable.md`

| 项 | 核验 | 证据 |
|---|---|---|
| 代码锚 `cda99b83a4…` 存在 | [ok] | `git log -1` = 08-13 fix(daemon) family_mismatch |
| 「后续 HEAD 0fe5fe8 未改门控文件」 | [ok] | `git diff --stat cda99b8 e987f05 -- <6 门控文件>` 为空(0fe5fe8 为两锚之间提交) |
| A1 因果链(mobileLan 白名单/875-885 403/boundary 三态/peeked 锁死) | [ok](引用坐标一处偏移,见 B-1.2) | 各 `git show` 摘录 |
| A2 双监听(MobileApp.tsx:81-86 + useVoiceChannel:409-414) | [ok] | b26b1e8/9bea8e1 diff 与 cda99b8 文件一致 |
| B1 36/38px | 实质 [ok],行号互换(B-1.1) | 见 B-1 |
| E1 confirmCopy 17-23 / F1 hub 826-836·857-860 / B3 hooks 14-21 | [ok] 逐字命中 | 本会话 sed 输出 |
| 与 08-12 四 commit 的关系 | [ok] 审计引用的正是它们引入的代码(confirmCopy/reconnect/toasts) | bf395e0 等 diff |

### 2. `docs/review/2026-08-13-mobile-shell-strategy-final.fable.md`

| 项 | 核验 | 证据 |
|---|---|---|
| 代码锚 e987f05 存在 | [ok] | git log -1 |
| Codex 69/70 报告/prompt 存在与指纹 | [ok](69 报告与 70 prompt 现值差异=09f7920 脱敏;原始 blob 逐字节验中;70 报告现值直接验中) | C-1 |
| 69/70 日志(不入 Git)行数+SHA | [ok] 本地实测全中 | C-1 |
| 行数复验(2064/905/1195/2095+729) | [ok] | C-6 |
| W0 唯一完成定义(remote-mobile+重连+09 回写;tailnet 待拍板) | [ok] 被 addfd19 精确执行 | addfd19 diff、09/11 回写文本 |
| 「错误处方=映射成 app」禁令 | [ok] 实现走新 kind 直挂 MobileApp,未映射 app | SetupBootstrapBoundary diff |

### 3. `docs/review/2026-08-16-remote-mobile-w0-impl-readback.fable.md`

| 台账# | 声明 | 核验 |
|---|---|---|
| 头部 | 代码 addfd196…、基线 3197fd8a… | [ok] 两 hash 均实存且日期相符 |
| 1 | HANDOFF:21 指针 + PLAN-2:69-71 | 指针=工作树态(C-2);PLAN-2 69-71 行在 addfd19 为临时轨道上下文 [ok] |
| 2 | 09:1143 三条 GET + 门语义,allowlist 未改 | [ok] 1143 行即 M1 段;mobileLan.ts:11-25 语义未动 |
| 3/4 | probeErrorCode/probeFailureFromCaught;仅精确码;四码仍错误卡;Boundary 12-31/151/168-175;test.ts:67-109;test.tsx:118-157 | [ok] 全部行号逐一命中(本会话 sed) |
| 5 | remote-mobile 不走 AppContent/viewport | [ok] RemoteMobileShell 直挂 |
| 6 | reconnectPolicy 15-21;useVoiceChannel 411-431;MobileApp 无 install… | [ok] 全中 |
| 7 | pairing.ts:16-47 RFC1918;pairing.test:41-61 | [ok] 全中 |
| 8 | 定向 Playwright 6 passed(6 个 -g 模式) | 模式对应的 6 条测试在 addfd19 的 console.spec.ts:183-254 全部实存;运行结果为其会话记录(与 R71/R72/evidence 三处一致),本会话未重跑(未核实-历史) |
| 9 | 不开放 probe/不救 29/未部署 | [ok] 代码与 evidence 口径一致 |
| 质量段 | Codex 74「需回修后通过,A 零,唯一 B=taint」 | [ok] 74 报告原文逐句吻合;其「最小改法」措辞被 addfd19 的 09 回写逐字采纳 |
| 门禁段 | just ci exit 0(103/253/19/1300\|4/33)+初跑 eslint 红清偿=偏离 1 | 三处独立记录(readback/evidence/R72)数字互证一致;历史运行本会话不可重放(未核实-历史) |

## 附录二 · B 向(commit→文档)逐条台账

| # | commit | diff 与描述 | 文档覆盖 |
|---|---|---|---|
| 1 | bf395e0 确认卡副文字+toast | [ok] 全读,confirmCopy/toasts 新建,与消息一致 | R84 索引(voice-fix 前端批 merge 6cd362d「五件」)+ 评审 63 自审 + gap-audit 引用其代码 |
| 2 | f525a9b 字阶系统 | [ok] mobile.css 单文件,字阶变量 20/17/15/13/16/12/11 落地 | 同上 |
| 3 | b26b1e8 退避+前台重连 | [ok] reconnect.ts 新建(500ms 起、封顶 30s)、MobileChrome 重连钮 | 同上;其引入的双监听即 gap-audit A2 的标的 |
| 4 | 9bea8e1 反馈环+乐观气泡 | [ok] ensureMobileChatRoute/乐观对账/导航,与消息一致 | 同上 |
| 5 | addfd19 W0 remote-mobile | [ok] 18 文件核心逐 hunk 读毕,与 readback 台账全对齐 | R71-73、readback、evidence、HANDOFF §1+§2-16、PLAN-2 |
| 6 | bc2ac87 evidence w0 | [ok] 11 文件=readback/evidence/journal/prompts/findings 73·74/一致性报告;HANDOFF 指针清 | 自身即文档载体;R73 记其为两提交法第二腿 |
| 7 | 7062267 三端壳测试+安装入口 | [ok](stat 级全读+关键面抽验)mobile-install-common.sh/两大门禁脚本/三端 DesktopProfile/version-matrix 新建 | prompts/143·148·154(两轮 No-Go 返工链);**journal 无索引(B-2)** |
| 8 | 36a4450 配对解析+门禁对齐 | [ok] 三端 PairingUrlCorpus(各 ~384 行)+ corpus.json + 216 例门禁 | evidence 2026-08-22-mobile-shells-device-build.md §5 记其全 hash 与门禁结果;journal 无索引(B-2) |
| 9 | c56ebdf 闭合配对+安装边界 | [ok] installer 重构终态(公共库+自动发现)在 d83c341 树验证 | prompts/203:31 记全 hash;R110/w54b 作为根因提及;journal 无索引(B-2) |
| 10 | c0df247 实体门内层引号 | [ok] 全读,与消息一致 | 自documenting + rc10/11 证据 json;见 C-7 |
| 11 | d83c341 merge mobile 线 | [ok] 冲突 5 文件、installer 取 mobile 侧、justfile 并集(即红灯物理成因) | R110/w54b 记录充分;**唯叙事矛盾见 A-1** |
| 12 | 6cb461c 版本锚释放 | [ok] 全读:动态 rc 版本锚+首页新文案锚,与消息一致 | **全仓零提及(B-2)**;commit message 自身翔实 |
| 13 | 5e27796 账本重生成 | [ok] 两个 week-audit json,与消息一致 | 账本自身即产物;journal 无索引(B-2 相邻) |
| 14 | 9a3e180 删 ios 安装器门禁 | [ok] 全读+机制复算+三门禁今日重跑 216/128/227 绿 | R110 + w54b §14.2/14.3,记录质量高(除 A-1 从句) |

注:分支上另有两个 evidence commit(fc6bef3、4fe482b)不在给定 14 条清单内,已作为 8/9 的文档载体一并核验。

## 未核实项(如实列)

1. rc.12 tag 的 19:43 打点:tag 在公开仓,内部仓与 origin 均无;采信 w54b §14.3 记录(与 d83c341 22:36 的间隔口径吻合)。
2. 历史测试运行结果(R71/R72 的 just ci 45398ms、Playwright 6/8.2s、w54b §14.3 修复前 exit 1 复现):属当时会话终端证据,本会话未重放历史工作树;已做的替代验证=静态机制复算(0.2 节)+ 今日三门禁重跑绿。
3. 今日 HEAD(f723ab7)的完整 `just ci` 未重跑(超出本线范围;mobile 相关三门禁已实测绿)。
4. 真机行为(LAN 扫码进壳、WKWebView)各文档均自我声明未验,本审计同样未触及。
