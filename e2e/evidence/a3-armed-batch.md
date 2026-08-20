# A3-armed 批 evidence(2026-07-28)

方案:`research/2026-07-28-a3-armed-design.md` v1.2(评审链 = 双 SA + Codex 23,5A/7B 全吸收)。
canonical 先行落盘:09(§0.1/§1/§2/§4/§4.1/§5/§9/§12/§13 covered 块)+ 02 §5 + 04 §2.2 + 06 §5 + 10(#10 变体/#41-45/规则5)+ 11 §5.6a + modules a/b + PLAN-2;DDL 机械验证(sqlite3 32 表)+ fence 配对 + 交叉引用通过。

## 提交链

| 段 | SHA | 内容 |
|---|---|---|
| 段1 additive | 2f2f7d8 | contracts(结构化 ReadinessDim/pending 清单/双 digest ref/isReadinessBlocking)+ v13(readiness_bindings 一等实体)+ remember 四闸候选 + confirmReadiness 确认环 + provider + buildInstructions 单源 |
| 段2 armed | 3f75cbe | index 生产恒 armed(evidenceFor/readinessConfirm/readinessInstructions/promote 重装配)+ readinessCurrentCheck 现势复核(issue 预检 + dispatch 权威)+ 双门 isReadinessBlocking 收窄 |
| 段3 收口 | 06118dc | 删 null 旁路/删 ready-dims-空回退 + 深评触发归位(骨架非 blocking 才抽查)+ rig armed 化 + readiness-binding.test.ts 21 例 |
| review 回修 | fde2752 | A-1 hard-forget 联动清绑定行(+recovery 重放)/ B-1 复核入消费事务锁窗 / B-2 UNIQUE 部分索引 / C-1 type_changed 分辨 |

## 收口基线

- `just ci` 绿:contracts 73 + daemon 679 passed | 4 skipped + python 20 + emoji gate;TSC 干净。
- Playwright 未跑:本批零 console 改动(就绪确认卡屏幕面 11 §5.6a 登记后续,见下)。

## 批末 code-review(A 级必修纪律)

结论 1A/2B/5C:A-1(hard-forget 不清绑定行,违 09 明文)+ B-1(复核在事务外,双进程有缝)+ B-2(同 key 双现役无 UNIQUE 封死)当场修(fde2752);C-1 顺手修。

## C 级登记(不阻塞)

- C-2:provider 返回 `{covered,bindings}`,合同示意 `{checklistDigest,bindings}`——checklistDigest 由 gate 层现算,语义等价;下轮 canonical 攒批时对齐措辞。
- C-3:confirmBindings 快照捕获在事务外,事务失败留孤儿快照行(append-only 证据无引用,无害;重试重复捕获)。
- C-5:listCandidates 同 key 取最新依赖 `ORDER BY ts,id`,同毫秒 ULID 非单调——实际近不可达,登记观察。
- 就绪复述确认卡屏幕面(11 §5.6a)未实施:语音环 to_screen 档按"作废重发起"话术兜底(不指向不存在的卡);随 console 批补。
- 深评生产装配仍空 = A5-armed 留白(本批交付其全部机械输入:binding/snapshot/digest/audit 转写指纹)。

## 存量盘点(生产库,armed 激活冲击面;Codex 23 A-5)

- active 项目 1 个:OctoDesk(coding)——零绑定 ⇒ 4 critical 全 unknown ⇒ 新提议需引导重绑(10 #45:Brain 复述旧事实 → 确认环升格;禁自动 backfill)。
- 旧 proposed 包 1 个(armed 前组包,无 readinessRef)——拍板将拒 `readiness_ref_missing` ⇒ 重新提议(fail-closed 预期行为)。

## canonical 待回写(攒批)

- 09 covered 块 provider 形状措辞对齐实现(C-2);09 收据终态句已同步改 voided_by_conflict(实现词表复用)。

## owner 声明项([!] 产品语义变更,已在汇报中显式说明)

门拒绝集收窄:旧"ready=false 一律拒组包" → 新"gap_critical 拒;gap_knowledge/gap_requirement 为建议态放行"(回归 02 §5 critical=阻塞/非 critical=建议设计意图;isReadinessBlocking 单源,10 #42 播报)。
