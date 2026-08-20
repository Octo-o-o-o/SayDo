# Phase 2 证据 · 记忆域最小可信

## 1. 测试命令与尾行输出

```
$ just ci
packages/contracts test:  Tests 65 passed (65)
packages/daemon   test:  Tests 174 passed (174)
[ok] emoji gate: clean / self-test pass=4
python: All checks passed! (ruff) / 1 passed (pytest)
[ok] just ci: node + python matrices green
```

## 2. 验收条目 ↔ 测试对照

| 条目 | 覆盖测试 | 状态 |
|---|---|---|
| §12-4 全绿:forget_hard 传播(FTS/投影/摘要/备份登记)+ 就地覆写 + 重放幂等 + generation 单调 | `test/memory.test.ts` | 绿 |
| §12-4:否定不复活 / M0 拒第三方与 taint / expiresAt 过期不入投影 / 空 payload 遗忘拒(DDL CHECK)/ 崩溃相位重放 | `test/memory.test.ts` | 绿 |
| auto_low_impact 独立机械判定器正反例(git-tracked repo_file/user_edit 事实性 ⇒ 直入;指令词/第三方/非 tracked ⇒ candidate) | `test/memory.test.ts` | 绿 |
| 2.2 同输入同 digest(facts/topicTerms 顺序与重复无关;签名域变化 digest 变、元数据 sessionId 不变) | `test/memory-compiler.test.ts` | 绿 |
| 2.2 excluded 全记录(third_party/expired/m0_gate_trust/m0_gate_taint/budget_*)+ 预算截断序(critical > ts 新先) | `test/memory-compiler.test.ts` | 绿 |
| 2.2 snapshot 落盘幂等(pack_digest PK,INSERT OR IGNORE)+ 回读 digest 校验 | `test/memory-compiler.test.ts` | 绿 |
| 2.2 B5 freshness 硬过滤(FTS 残影不出结果)/ forget_hard 双保险 / provenance 随结果 / rg 现读 / MATCH 转义 | `test/memory-retrieval.test.ts` | 绿 |
| 2.3 中型仓缺省预算内 complete(fixture 仓 + SayDo 仓真实 bootstrap 162 文件)/ 超限如实 partial + 进度话术 | `test/memory-foundation.test.ts` | 绿 |
| 2.3 generation 原子切换(发布失败注入 ⇒ current 指针保留旧 generation) | `test/memory-foundation.test.ts` | 绿 |
| 2.3 预热增量 fixture(committed/staged/unstaged/untracked 四组 + rename -M + amend ⇒ base_not_ancestor 不误判全删) | `test/memory-foundation.test.ts` | 绿 |
| 2.4 误听纠正 ⇒ 热词生效(M0 user_stated 写入 ⇒ biasTerms ⇒ topicTerms 使 pack digest 变化;forget 即消失) | `test/memory-hotwords.test.ts` | 绿 |
| 2.4 re-anchor 候选并入(draft 期 user_stated 并入后必为 candidate 不升权;archived+reanchoredTo;守卫三反例) | `test/projects-lifecycle.test.ts` | 绿 |

## 3. Golden / spike 跑分

- **07 D9 分词 spike 两批全跑**(`e2e/spikes/fts-d9/RESULT.md`):第一批(voice-coding 文档,~700 段)hit@5 = 20/20;第二批(2.3 奠基产物,SayDo 仓真实 bootstrap)hit@5 = 12/12;2 字词专项 4/4 全 0 命中(trigram 已知限制实锤,"幂等"存在于 11 个文件仍不可查;降级链 = simple 扩展/预分词,P1)。
- 结论:trigram 起步可用(P0 生产配置维持);发现两条真实风险已记录——2 字中文词不可索引、口语措辞与文档字面漂移时纯子串匹配失败(缓解:2.4 热词 + B5 rg 双源)。

## 4. 截图清单

本 Phase 不适用(记忆域无 UI;控制台记忆页属 Phase 5)。

## 5. 偏离与回写链接

- **ASR 阻塞持续(owner 行动项)**:owner 开通了火山"流式 sauc + 录音 auc"资源,但 2026-07-24 实测现有 key 仍 `45000030 resource not granted`(sauc 握手 403)——资源开在了另一账号/应用下,与 `DOUBAO_TTS_API_KEY` 不匹配。解法:登录开通 ASR 的账号,取该应用的 API Key 填 `~/.saydo/.env` 的 `VOLC_API_KEY`。1.0 定档 + ADR-101 + owner 场次①继续待 key。
- **工程内规(注释级,未动 canonical)**:B3 轻量版 token 预算映射为"读入摘录预算"(estimateTokens;P1 接沉思档深研时语义回归 LLM token);compiler 的 token 粗估(CJK≈1/字,ASCII≈4 字符/token)确定性纯函数,估算法变更随 COMPILER_VERSION 升版。
- **spike 发现回写**:D9 RESULT.md 记录切段阈值须按语料适配(奠基产物短行结构化文档标题段 <10 字符;B5 生产侧以"claim 整条"入库,无此问题)。
- **dogfood 副作用(设计行为)**:SayDo 仓 `.saydo/` 入 gitignore;AGENTS.md 尾部由奠基器追加幂等指针块(04 §1.2 输出侧互通)。

## 5b. Phase 级评审记录(code-review subagent)

2 A / 6 B / 8 C,其中 5 项经评审方运行时实证;triage:A 级全修,B 级全修(均为契约语义偏离小改,不留尾巴),C 级择 3 修 5 记录。

**A 级(必修,已修)**:
- A-1 forget_hard 崩溃恢复无承载:tombstone 事务提交后、store 清除前崩溃 ⇒ FTS 明文残影,且 `deleteByIds` 依赖进程内存映射重启后静默失效——新增 `memory/recovery.ts`(`recoverMemory`:重放 tombstone 重执行覆写(幂等)+ FTS 全量 rebuild 清残影,记忆域装配强制入口);崩溃相位测试重写:相位一断言"明文在 memory_events 不可见 + generation 不被恢复推进",新增相位二(事务提交/FTS 清除前崩溃 ⇒ 残影实锤 ⇒ 恢复例程收敛),废除"手动重调 forgetHard 充当恢复"的糊弄断言。
- A-2 foundation 发布非原子:旧实现先覆盖现役 knowledge/ 再切指针,失败后文件投影已被新 generation 污染——重构为 knowledge 按 generation 子目录(gen-N/)+ current.json(真相源)与 knowledge/current symlink(消费视图)双原子 rename;AGENTS.md 指针改指 current/core.md;测试补"发布失败后 current/core.md 逐字节一致"断言。

**B 级(全修)**:B-1 `project()` 消费 supersedes(纠正后旧值退场且不复活,重放同语义);B-2 编译器预算改首超截断(装箱式 continue 会让低优先级小事实反转规则①,COMPILER_VERSION 升 0.2.0);B-3 expiresAt 写入侧归一化 UTC Z(±HH:MM 偏移时区下字典序比较漏判过期,评审实证);B-4 reanchorDraft 事务包裹(半程崩溃重复并入窗口);B-5 reanchor 透传 expiresAt/taint(临时事实不因换 id 永生;AddInput 增显式 taint 入口);B-6 项目状态转换落审计(project.create_draft/promote/reanchor)。

**C 级(修 3 记 5)**:已修——C-1 excluded 排序 localeCompare 换码元比较(ICU 环境相关性);C-2 KEY_FILES realpath 去重(macOS 大小写不敏感致 justfile 双清点,评审实证);C-7 热词禁换行。记录不修——C-3 `[forgotten]` 哨兵(removed 集已兜底)、C-4 ts 用 ULID 前缀代理(P0 接受)、C-5 gitHead 双求值(微)、C-6 manifest 损坏容错(warmup 抛错可接受,P1 needsRebuild 化)、C-8 snapshot 跨 session 复用时 session_id 保留首次(审计口径以 sessions 表为准,已注释)。

**评审确认无问题项**:M0 红线四路径无绕过;packDigest 签名域与 09 §0.1 一致;SQL/rg/git 无注入面;编译器确定性(输入顺序无关)成立。

## 6. Gate 0 归属项(Phase 2 落点)

- **G6 删除/同意传播(另一半)**:forget_hard = tombstone(targets+digests+generation)+ 就地覆写历史 claim/source + 多目标清除(FTS 标准 DELETE/投影/摘要/备份登记待过期)+ 重放幂等;`test/memory.test.ts` 传播与崩溃相位用例全绿。备份例外按 09 §4(登记待过期,`backup_retention_days` 全局专属)。
- **M0 红线(04 §1.4)**:第三方内容永远不能进 M0(classify 抛 MemoryPolicyError + compiler m0_gate 双层);B1 编译层 taint 永不入 M0。

## 代码提交 hash

- 2.1 `49ccefb`(记忆账本 B2)/ 2.2 `f264fff`(B1+B5+D9)/ 2.3 `05f9dda`(B3+D9 第二批)/ 2.4 `47651db`(热词+draft 流程)
- evidence 提交:见本文件所在提交(两提交纪律:代码先行,证据收尾)
