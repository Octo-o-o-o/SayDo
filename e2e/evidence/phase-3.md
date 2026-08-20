# Phase 3 证据 · 采访、就绪与决策包(Tier1 范围)

## 1. 测试命令与尾行输出

```
$ just ci
packages/contracts test:  Tests 65 passed (65)
packages/daemon   test:  Tests 208 passed (208)
[ok] emoji gate: clean / self-test pass=4
python: All checks passed! (ruff) / 8 passed (pytest)
[ok] just ci: node + python matrices green
```

## 2. 验收条目 ↔ 测试对照

| 条目 | 覆盖测试 | 状态 |
|---|---|---|
| 前置:09 §4.1 源快照合同(SOL A3 结项)——一致性 subagent(2A/9B)+ Codex 攒批(No-Go 3A/3B)双评审全数回修 | 设计库九处 + `test/evaluator.test.ts`(合同落地) | 绿 |
| 3.1 预算耗尽必停(缺省 8,params);"值得问"词表代码层强制(词表外构造即抛) | `test/interview-policy.test.ts` | 绿 |
| 3.1 选择题 2-5 互斥选项 + 推荐项(04 §2.1 为准;modules/a 旧"≤3"canonical 冲突已裁决修正) | 同上(反例:1/6 个选项拒、重复拒、推荐越界拒) | 绿 |
| 3.1 golden 采访 3 条(真 Pack,b1 真编译器非桩)+ Quick 直通 golden 1 条 | 同上 | 绿 |
| 3.2 critical unknown ⇒ 不就绪(规则层硬门槛,不可被平均) | `test/evaluator.test.ts` | 绿 |
| 3.2 评估器读不到 Brain 自辩(接口隔离:assessDeep 输入类型无对话历史;prompt 指令区断言) | 同上 | 绿 |
| 3.2 篡改 claim 状态但 source 不符 ⇒ conflicting → gap_critical(反例) | 同上 | 绿 |
| §12-11 反例矩阵:stale·intact 两维独立/重验终局(不符 ⇒ mismatch,重验成功 ⇒ fresh)/evidence_missing→unknown 非 conflicting/agent_output·import 不得唯一支持/注入 4 类语料(指令区无攻击文本+JSON 转义承载)/严格 JSON fail-closed/机械门只降不升/TOCTOU(symlink 拒、孤儿清)/共享快照零引用才删正文/deep 行 DDL CHECK 拒缺 replay/深评调用律(去重·上限·冷却)/recovery snapshot 重执行 | 同上(11 用例) | 绿 |
| 3.3 cost unknown 不显示 0(有用量无价目 ⇒ 整体 unknown 不局部编数;max 必 known 为正) | `test/package-factory.test.ts` | 绿 |
| 3.3 产物版本链(v1→v2 自动 supersedes/lineage 回溯/digest 读取重校篡改报损坏/未知 id 起新版拒) | 同上 | 绿 |
| 3.3 §12-1 相关:digest 可复验(verifyPackageDigest null)/revise ⇒ revision+1 digest 变 + supersedes 链 | 同上 | 绿 |
| 3.3 反例:acceptance 空拒/step_confirm 带 grants 拒(validateGrants fail-closed,spokenForm 必须模板渲染)/critical unknown 不可拍板(assertProposable) | 同上 | 绿 |

## 3. Golden / 阶段产出

- 3.1 golden 4 条(真 Context Pack:采访带预研结论/预算停转摘要/选项式 2-5/Quick 直通),复用 1.4 golden 框架(`brain/golden.ts` checkGolden + 状态词纪律)。
- 完整 ≥20 条真人音频级 golden 随 5.3(owner 场次)。

## 4. 截图清单

本 Phase 不适用(评估器/工厂无 UI;决策卡 UI 属 Phase 5)。

## 5. 偏离与回写链接

- **09 §4.1 两轮评审回修(重要)**:一致性 subagent 2A/9B(遗忘漏快照/stale 跨文档矛盾/no_quote 绕过/locator 七 kind/…)+ Codex 攒批 **No-Go 3A/3B/1C**(hard-forget 活动库明文不闭合 ⇒ claim_snapshot_links 一等关联 + 共享快照零引用规则;验证谓词 fail-open ⇒ 白名单谓词 + stale 不可消费中间态;ASR 权威五处冲突 ⇒ 单家定档统一)——全数回修,报告 `research/codex-findings/12-canonical-writeback-batch1.md`,journal R33。
- **canonical 冲突裁决**:选项数 04 §2.1(2-5)vs modules/a A4(≤3)——以 04 为准,modules 修正并注记。
- **[pricing] 回写(09 §11)**:currency/as_of + llm·asr·tts 三维单价表;无表项 ⇒ unknown 不编数;全局专属不可项目覆盖;budget.task_max_default 作 cost.max 缺省来源。攒批下次 Codex。
- **snap_ 前缀修正 snp_**(idSchema 3 字母正则;09 §0 与 contracts 同步)。
- **P0 显式 unsupported**:快照器对 web/artifact 源 fail-closed 抛错(critical claim 以其为源 ⇒ snapshot_missing ⇒ unknown 阻塞,诚实降级)——artifact 捕获随 B4 消费场景补,web 的 SSRF 边界随真实消费补(§4.1 合同已定形态)。
- **09 §14-A6 重开项已关闭**(快照清除 + recovery 重执行 + §12-11 反例全绿,设计库同步)。

## 5b. Phase 级评审记录(code-review subagent)

3 A / 8 B / 若干 C(评审含本机实测:git 行为探针 + 201 测试复跑)。triage:A/B 全修,C 择 4 修 4 记录。

**A 级(全修)**:
- A-1 hard-forget 未覆盖 readiness_assessments 明文段与深评 prompt 落盘文件(且 09 §14-A6 曾提前宣称关闭——"文档说做了代码没做",已更正声明):makeSnapshotForgetStore 扩展——按 tombstone targetDigests(= claim textDigest)定位 dims_json/blocking_criticals_json/source_verifications_json 对应明文段覆写 [forgotten],prompt_body_path 文件删除(prompt 含 claim 全文无法部分覆写,遗忘优先于 replay,prompt_digest 留审计痕);ForgetHardStores.snapshot 签名扩 targetDigests;recovery 重执行同步。
- A-2 零 binding critical claim 被放行("上游标 verified 且不给证据"绕过回读抽查——正是 04 §2.2-5 立项要防的):assessDeep 对 critical ∧ 零 binding ⇒ fail-closed 置 unknown → gap_critical;补 verdict 断言反例。
- A-3 snapshotForget 删序错误(先删 links[唯一枚举键]再删正文,中途崩溃重放不可收敛,敏感正文永久残留):改序——枚举 → 零引用判定(排除本批)→ 先 rm 正文(幂等)→ 事务内删行+删 links(最后删枚举键);补"正文已删、links 残留"中间态重放收敛测试。

**B 级(全修)**:B-1 落库 source_verifications_json 改用语义维合成后数组(可审计重建不断链);B-2 上游 excerpt 真校验(按 range 从 bodyPath 重取比 excerptDigest,替换恒真的同源自比);B-3 user_utterance freshness 改 JSON.parse 按 turnId 比对(原 includes 对含引号/换行文本永久假 stale);B-4 本地文件捕获加 workspace 边界(realpath 全路径断言,挡绝对路径/../ 穿越/目录级 symlink 外逃——防 ~/.ssh 吸入快照经深评 prompt 外传);B-5 quickPassthrough 否定上下文防护("别直接做"不再误直通);B-6 覆盖扫描候选 id 改 claim 内容派生(位置化 id 在 dims 变序后去重失效);B-7 深评输出超长熔断(64KB + perClaim max);B-8 repo_file commit 白名单(hex oid,拒空 commit 读可变 index/拒 "-" 前缀)+ --end-of-options + user_edit ref lastIndexOf 统一 + readLive 去多余 split。

**C 级(修 4 记 4)**:已修——Governor 去重键补 trigger 三元组 + per-session 冷却;snapshot store 声明而 executor 缺失 ⇒ 抛错(原 ?.() 静默 fail-open);estimate as_of 非法日期不炸(可解析才带 asOf);factory.revise 可选产新版 plan artifact(改包路径计划落盘不断档)。记录不修——cutExcerpt 20 行窗上限(超窗 excerpt=undefined,深评拿 null,可接受)、captureTranscriptTurn 的 includes 预筛选可被他 turn 正文误中断(概率低,P1)、非 critical 用 bindingPasses 已按契约收窄、recoverMemory/scanOrphans 生产装配点随 A 域接线(已入跟踪)。

**评审确认无问题项**:数据栅栏本体(JSON 转义无逃逸面,四类注入语料测试)、谓词与 §4.1 白名单逐字一致、digest 签名域正确、estimate unknown 语义、采访机械层确定性、TOCTOU 其余部分、DDL/DAO 约束。

## 6. Gate 0 归属项(Phase 3 落点)

- **防相关错误链(04 §2.3)核心落地**:A5 独立评估器(只读证据,接口层无 Brain 自辩输入)+ critical claim source 回读抽查(daemon 快照器 + 机械三维 + 异族深评语义维,白名单谓词 fail-closed)+ 注入四类语料反例。
- **G6 延伸**:源快照纳入 hard-forget 传播(claim_snapshot_links 枚举 + 共享零引用 + 崩溃恢复重执行)——被遗忘的敏感原文在活动存储零明文。

## 代码提交 hash

- 3-pre `b299f18`(§4.1 DDL/stores/snp)+ `43fd741`(Codex 回修终稿同步)/ 3.1 `df4f400` / 3.2 `d84ff98` / 3.3 `647c6fc`
- evidence 提交:见本文件所在提交(两提交纪律:代码先行,证据收尾)
