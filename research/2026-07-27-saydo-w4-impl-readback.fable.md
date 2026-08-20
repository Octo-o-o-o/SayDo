# SayDo W4 批(S3 卡 + writing 窄版 + 三增量项)实施对账报告(/impl-review)

> 分支:main · 基线 `eabc5ac`(W5a 收口)→ 收口 `b5d45e9` · **9 提交**(本会话 `git log` 真实输出,总结引用的 8 个 hash 全部对上,另含开批 chore `c108c42`)· 计划文档:`voice-coding/IMPL-PROMPT-8-W4.md` · 改动面 63 文件 +5418/−280 · 对账执行:2026-07-27 晚,三路取证 subagent 实读代码 + 门禁本会话亲跑。

## TL;DR

**主体成立:S3 卡全链与三增量项按合同落地,writing 窄版结构完整;但收口状态有一个硬红灯和两个实质 B 级缺口,判定:W4 = 有条件收口(三件修复后完全收口)。** 台账 9 项:[ok]×6、[warn]×3(3.2 verify-fail 缺口 / 3.7 三处同源虚述 / 3.6 收口 SHA 上 ci 红)。门禁亲跑:测试矩阵全绿(contracts **73** + daemon **638|4 skipped** + python **20**(单独跑)+ Playwright **21**)但 **`just ci` 整体 exit=1**——emoji 门禁被收口 evidence 自己打红(7 个 `[ok]` 字符),下一批开批断言会被卡。批末评审 A-1/B-1 回修实证在案;runtime 仍 @ `eabc5ac`(deploy 等 owner 知会,铁律遵守)。

## 对账台账(状态 → 证据;全部来自本会话实读/实跑)

| # | 计划项 | 状态 | 关键证据与出入 |
|---|---|---|---|
| 3.1 | S3 卡全链 | [ok] | v9 迁移全形状(两表+approvals 六列双向 CHECK+turn_ref 放宽,`ddl.ts:275-338,419`);四工具签名/事务逐字照合同(`s3Tools.ts`:strictObject 拒 rpId/refDigest 注入 :104-107、库内自取 :143-156、register 零收据 :229-251、verify 三写同事务 :367-392、approveMerge 五步含双 CAS :412-453);WebAuthn 验签核真验签(CBOR 拒非常规/COSE ES256/UP∧UV/signCount 三分支/rpIdHash 恒定时比较);守卫四断言先于业务(`s3Guard.ts` + `s3Routes.ts:60-85` 强制 POST);通用 decide 对 S3 双层拒;console 卡全要素(Touch ID/降级/tailnet 不渲染/诚实注脚/置灰/308 归一);合并执行段(树漂移断言/冻结 verify/ff-only/幂等/重启恢复);**32 例反例全数在案且用真 P-256 签名非 mock**(`fakeWebauthn.ts:17,88`,wrongKey 反例依赖真验签)。两处措辞级注记:崩溃注入用例=事务中途失败等价(终态断言与合同一致);验签计算在事务体前(三写仍同事务,原子性不受影响) |
| 3.2 | writing 窄版 | [warn] | 结构全落:contracts 五件(enum/article/WritingSettleProof/结构纯函数/content_done)、executor 分叉(barrier ① 成稿对账 `executor.ts:998-1027`、③ manual 恒 unknown :1048-1052、违反转 blocked)、reviewTask ④(H(JCS(proof)) `operations.ts:450`、未逐条裁决拒 :427-433、任一 fail 拒 :446-449)、typeGate 缺省 ["coding"]、v10 迁移、TaskDetail 置灰。**实质缺口:合同 §6.1a ③ 后半句"配置了内容 lint 则 fail ⇒ 不 settle"无机械检查**——`executor.ts:983-995` verify 循环只写 verify.json,无 exitCode 检查、结果不映射 acceptanceChecks,函数自注释与 evidence [ok] 声称均过头;测试仅纯函数层有断言,executor 层无用例(生产构造恒 manual,该断言在生产 settle 路径不可能触发)。P0 缺省 verify 为空所以现实影响窄,但**翻值前置清单第 6 项("verify 内容型模板")的"全绿"声称打折**。次级:barrier ⑤"同事务"实为顺序 CAS+认领收敛(coding/writing 共通既有形态,非本批回归) |
| 3.3 | golden 扩位 | [ok] | `W4_GOLDEN` 4 条(`golden.ts:227-255`)+ coverage 断言(状态词零违规/零 emoji/W4 专项 `golden-coverage.test.ts:43-48`) |
| 3.7 | readinessSkeleton | [warn] | 单源纯函数+词表+quick 不删 critical(`contracts/readiness.ts:27-88`)、readinessRef 入签名域、fail-closed 落 assessments 行、拍板门(缺失/dimsDigest 不符拒 `liveTools.ts:459-475`)、12 例含 W1 场景回归全实证;**armed 声明与代码一致**(生产未注入 readinessEvidence ⇒ 未 armed ⇒ 旧路径,诚实)。**实质缺口:合同"三处唯一消费点"实际只接了两处**(proposeStart `liveTools.ts:341` + assessReadiness :844;"会话建立"装配点全仓无调用,注释与 evidence 自述虚述)。轻:况④ provider 不可用归并况③路径(结果同为 gap_critical,无专属分支/测试) |
| 3.8 | proposed TTL | [ok] | v11 全形状 + A-1 加固(建索引前收敛老库多 proposed `ddl.ts:380-391`);transitionToProposed 事务 CAS 关旧+不可变锚(`dao/packages.ts:61-86`);PackageTransitions 两新边+旧测试断言改造;sweep 幂等+双闸(receipt 在期不豁免 `liveTools.ts:221-233,456`);updatePackageExpiry 全仓无定义且有运行时锁死断言。计数勘误:测试实为 **8 例**非自述 9(内容齐全,数字虚 1);C-2 第二写点 evidence 已自曝 |
| 3.4 | 双仓并行 | [ok] | 既有认领模型满足(同 project 活跃 run 互斥 NOT EXISTS + 每 tick 一认领 `executor.ts:505-524`),本批补测试锚(跨仓并行/同仓串行守恒/queued 投影);口径注:"并发 2"是双仓场景涌现值,非机械上限配置(与 evidence 自述一致) |
| 3.9 | 输入区三态 | [ok] | 三态全要素(`Chat.tsx`:toggle/空格 hold/打字/免手并列 + 电平波形计时取消 + 语音条+可编辑转写,采完不直发 :33,46-50);turn.text 白名单仅 console、**asr.final 仍 pipeline 专属 B8 未放宽**(`hub.ts:53-66`);voice.mode 契约二值不动;Playwright 三态用例在。措辞注:typed 标记止于 WS 层未达持久层;第一条用例名含"回车发送"但正文未真按 Enter |
| 3.5 | E2E 全链 | [ok] (自动化)/顺延(owner 触点) | writing 全链闭合 e2e 实证(真 git worktree + fake agent + 真 P-256 fake Touch ID:成稿→逐节验收→S3 合并→定稿→article.md 落主分支 HEAD tree,`writing-narrow.test.ts:371-408`);OctoBlog 真篇 + S3 真人过卡 = owner-gated 顺延,合规 |
| 3.6 | 收尾 | [warn] | evidence 97 行三级词表+待回写 8 条;HANDOFF §4 铁律行同步逐字在(`HANDOFF.md:61`)、指针清除 [ok];**硬红灯:收口 SHA 上 `just ci` exit=1**——`check-emoji.sh` 拦下 evidence `w4-batch.md:35` 的 7 个 `[ok]` 字符(ci-node 最后一步 fail,python 矩阵被中止)。"收口基线 ci=0"的声称在收口 HEAD 上不成立(代码提交时点绿,evidence 提交把门禁打红);轻:HANDOFF §2-13 登记三件非总结所说四件(第四件 deploy 知会未列入) |

## 质量复审发现

- **A-1/B-1(批末评审,已修,实证)**:`07377a4` 只动 ddl.ts+迁移测试——v11 建唯一索引前收敛老库多 proposed(保留最新)、v9 迁移前剔除 pre-W4 generic S3 行,回归用例 `storage-migration-v5.test.ts:109-131`。
- **新发现 P0(阻塞下一批开批)**:收口 HEAD 上 `just ci` 红(emoji gate × evidence `[ok]`×7)——修复 = evidence 内 `[ok]` 换 `[x]`/"已"并补一个 chore 提交,一分钟。
- **新发现 B-3(翻值 gate)**:writing verify fail ⇒ 不 settle 无机械检查无测试(见台账 3.2)——**翻值 `enabled_project_types` 前必修**,否则配置了内容 lint 的项目 lint 红也 settle。
- **新发现 B-4(armed 接线批)**:readinessSkeleton 第三处("会话建立"装配)接线不存在,合同 09 §13"三处唯一消费点"暂只两处;连带况④ 无专属分支。随 armed 语义落定批一并接线。
- **B-2(evidence 已登记,复核属实)**:merge 执行段 verify 同步重跑阻塞事件循环,setImmediate 已脱离 HTTP 路径,完整非阻塞留独立批。
- **C 级(登记)**:C-1 sectionCoverage 由 executor 自造恒 drafted(barrier ② 机械性依赖人评兜底,后续按 markdown 标题解析);proposed-ttl 自述 9 例实 8;typed provenance 措辞超前;HANDOFF §2-13 差一件。

## 门禁结果(本会话亲跑)

- `just ci`(`/tmp/w4-review-ci.log`):**CI_EXIT=1**——contracts `Tests 73 passed (73)` [ok];daemon `Tests 638 passed | 4 skipped (642)` [ok];随后 `bash scripts/check-emoji.sh` → `[fail] emoji gate: e2e/evidence/w4-batch.md:35`(7 个 `[ok]`),`recipe ci-node failed`,python 矩阵被中止。
- `just ci-python`(单独补跑):`20 passed in 0.24s`,exit 0。
- `pnpm exec playwright test`:**21 passed (19.6s)**,exit 0。
- runtime:`~/.saydo/runtime` @ `eabc5ac`(未 deploy——与声称一致,"dogfood 时段不擅自重启"铁律遵守)。

## 修复清单(按优先级;只列不修)

1. **P0**:evidence `w4-batch.md:35` 的 `[ok]`×7 换非 pictographic 字符 + chore 提交 → `just ci` 复绿(阻塞下一批开批断言)。
2. **P1(翻值 gate)**:executor writing 路径补"内容型 verify exit≠0 ⇒ 不 settle(转 blocked)"机械检查 + executor 层反例;结果映射 acceptanceChecks(source="verify")。翻值 `enabled_project_types` 前必须完成——前置清单第 6 项以此为准。
3. **P1(armed 接线批)**:readinessSkeleton 会话建立装配点接线(合同三处同源)+ 况④ 专属分支/测试;与"证据绑定 canonical 语义"同批。
4. **P2**:B-2 verify 重跑 worker 化;C-1 sectionCoverage 标题解析;HANDOFF §2-13 补 deploy 知会件;evidence 计数勘误(9→8)。
