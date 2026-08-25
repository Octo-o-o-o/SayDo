# 评审成果转交 Prompt(发给实施中会话;owner 转发即生效)

> 生成于 2026-07-25,来源:`research/saydo-improvement-scan-2026-07.md`(4 subagent 深挖)+ 两份同日调研。聊天可直接复制以下全文。

---

【外部评审成果转交——按窗口期消费,不是新需求】

背景:文档会话(voice-coding 仓)完成了 2026-07 语音模型调研(OpenAI gpt-realtime-2.1 代 / xAI grok-voice / GPT-Live 无 API)与 4 路 subagent 全角度深挖评审,产出已 triage。owner 把本 prompt 发给你 = **批准下方"必做清单"**;其余一律不扩权。总性质:字段级/验收级/话术级小改,零架构变更,无一条推翻已定稿裁决。

## 0. 先做:进度自查(漂移即报)

报告你当前进行到 IMPLEMENTATION-PLAN 的哪个 Phase 哪一步(以真实 git log / 文件为证)。下方每项标注了消费窗口(某实施步**之前**落最省);窗口已过的项不要硬塞——如实标注"窗口已过",评估返工成本后再动,migration/补丁方案先报 owner 一句再做。

## 1. 必读材料(按序,均在 ~/WorkSpace/voice-coding/)

1. `research/saydo-improvement-scan-2026-07.md` —— **主文档**:§0 triage(A 级 6 项)、§2 实施窗口期对照表、§3 四路报告全文(每项的完整证据与字段级建议在这里,执行时以 §3 细节为准);
2. `research/voice-model-tech-scan-2026-07.md` —— 模型技术情报(§1.1 上下文/缓存机制、§5 工程细节,供理解"为什么");
3. `research/voice-call-channel-scan-2026-07.md` —— 通话形态调研(仅背景,本次不实施)。

## 2. 授权边界与红线(违反即停)

1. **必做清单之外零蔓延**:候选清单(§4)按"到步评估、记录理由"处理,不作门禁;§5"不做清单"一律不碰。
2. **canonical 回写纪律不变**:凡涉及 docs/09/10 的项,先回写文档、走轻量评审(一致性 subagent;Codex 攒批),评审通过再写代码——照 IMPLEMENTATION-PLAN"发现设计问题先回写文档再改代码"的既有流程。
3. **既有红线一寸不动**:Gate 0 六项、S3 屏幕强认证、状态词纪律(`ready_for_review` 口径)、两把钥匙、执行模式不变量——本批增补没有任何一项以放宽上述为前提;若你发现某项落地"顺手"要动红线,停下上浮。
4. 已定稿选型(D2/D4/D5/D6/D18、FTS5、Pipecat 暂定等)**不重开**;本批只做测量、契约补齐、话术增补。

## 3. 必做清单(按消费窗口排列)

| # | 窗口 | 做什么 | 流程 |
|---|---|---|---|
| M1 | **0.3 建表前** | `context_snapshots` 表修矛盾(现 PK=pack_digest 与"重建 digest 一致"验收冲突,同 digest 二次落盘必现):拆 `context_snapshots(pack_digest PK, compiler_version, body_json, created_at)` 内容表(幂等 upsert)+ `context_snapshot_uses(session_id, pack_digest, used_at)` 使用记录表;或最小改复合 PK=(pack_digest, session_id)。细节:主文档 §3.3-6 | 先回写 09 §9 DDL(轻量评审)再建表 |
| M2 | 0.4 / Phase -1 配置 | 对话档 OpenRouter **钉路由**:provider 白名单/固定排序钉单一上游(防首 token 抖动 + 前缀缓存跨供应商全量 miss);invocation 记录补"实际路由 provider"字段。细节:§3.1-4 | 配置层直接做 |
| M3 | **1.2 之前** | 五段延迟时间戳入 WS 事件与 JSONL 日志:`vad_end / asr_final / llm_first_token / tts_first_byte / playout_start`;Phase 1 出口用注入语料跑 ≥20 条,出 P50/P90 分段分解表(EOU 等待单列);内标 P50<1.0s、发布上限 1.5s(03 §3 SLO 的第一次实测落点)。细节:§3.1-1 | 测量增补,直接做 |
| M4 | **1.2 C8 记账接线时**(晚了历史行无法回填) | `cost_entries` 的 `kind='llm'` 行 `meta_json` 定型必含 `{model, input_tokens, cached_input_tokens, output_tokens}`(§12 加断言 cached≤input;订阅行金额 NULL 但 tokens 照记);E1 provider 抽象统一 usage 字段命名(OpenAI `prompt_tokens_details.cached_tokens` / Anthropic `cache_read_input_tokens`,后者 1.25× 写入价留列位)。**注意:只定记账明细,不动 `[pricing.llm]` 单价合一(B6 定稿,分列另候 owner)**。细节:§3.3-4 | 先回写 09 §9 注释(轻量评审)再落 |
| M5 | 1.3b/2.x | 否定/修订类 utterance 即时落账本:会话中检出"不要 X/改成 Y"类口头否定,即时经 `remember`(trust=user_stated)写记忆事件——防其只存在于转写、被 M3 预算挤出后静默消失(规则②只管账本层,接不住转写层)。细节:§3.3-5② | A3 工具纪律,随 1.3b 落 |
| M6 | **1.4 话术 golden 前** | 四件话术增补**攒一批**回写 docs/10 后再落 golden:① 采访承接层(骨架 §4-2 增补"提问前 ≤半句复述用户上轮要点再问";golden 加承接要素断言);② 异族深评等待话术(等待条目 + 承诺超 50% 心跳改口 + 等待中插话应答;触发按可感时长、与供给方式解耦);③ 话术变体三档纪律(锁定 / 结构锁定表层可变 / 自由池轮换,golden 按档断言);④ **审批确认封闭肯定词表**(S2 语音确认要求复述关键参数 + 封闭词表匹配,未匹配默认拒绝并复读——sauc 无 confidence,这是审批级 utterance 的 P0 防线;状态机侧在 3.4/4.2 消费同一词表)。细节:§3.2-1/2/3 与 §3.4-G2 | 回写 docs/10(轻量评审,四件一批)→ 1.4 golden |
| M7 | **2.2 ContextCompiler 前** | 09 §5 增两规则两字段:规则⑥装配序恒定(渲染序固定 instructions→M0→M1→M2→M3,层内 stable ref 序,FTS 分只决定入选不决定顺序,易变项后置,渲染模板版本 + token 计数器版本并入 compilerVersion);规则⑦驱逐纪律(已入选切片仅因 invalidate/expire/critical 挤占被逐);字段 `parentPackDigest?`(入签名域保纯函数性)、切片 `segment:"stable"|"topical"` 与 `prefixDigest`;**2.2 验收加一条:同会话相邻两次编译输出 prefix-diff,全部易变字段必须位于公共前缀之后**。同次回写捎带 M3 形态条(近 K 轮 `verbatim` + 更早轮 `gist`,切片加 `form` 标注)。细节:§3.3-1/5① | 先回写 09 §5(轻量评审)再实现 |
| M8 | 随最近一次 09 回写捎带 | 09 §11 [params] 补三键:`session_idle_suspend_sec=45`(参数化既有阈值)、`dialog_context_high/low_watermark_tokens`(会话内对话历史滞回截断,归 A3;P0 实现可先简化为"全量直到高水位",契约与参数先落);04 §3 的"重建按全价预算、cache 命中属 bonus"注记随文档会话的 §6 回写,不归你。细节:§3.3-2/3 | 参数 + 契约先落,实现可简 |
| M9 | 3.3 `[pricing]` 最小合同回写时 | 顺手定计费单位词表:`audio_min / tokens / cached_tokens / chars / messages / wallclock_min`,约定每 kind 恒定 unit,estimate→actual 公式按 unit 计算(免 P2 迁移)。细节:§3.1-8 | 随既定回写顺带 |
| M10 | Phase 1 收尾任意时点 | TTS 漂移哨兵:固定 3–5 句 golden 文本周期合成(每周或每次发布),比对时长/响度包络/ASR 回转文本一致性,超阈值告警(防"同 snapshot 服务端漂移",OpenAI 社区实证的新风险类,火山同暴露)。细节:§3.1-3 | 小 cron/CI 任务 |
| M11 | 随转写合同实施步 | F2 钩子两件:转写留痕保持 utterance↔原始音频段可关联(核对 09 相应合同,缺则随回写补字段);原始音频保留期参数化(为 P1 diarize 事后审计留口,本身 P0 不做审计)。细节:§3.4-F2 | 核对 09,缺则补 |

## 4. 候选清单(到步评估,采纳与否在 evidence 记一句理由,不作门禁)

- 思考沉默与空闲分开计时(问句后 90s 单独计时,30s 轻声安抚;§3.2-5);
- earcon 声音符号最小集三件(思考循环音/回叫接通提示音/完成音;§3.2-6);
- 回叫接通后口头推迟("半小时后再叫我"=ack+定时重入升级链)与 30s 无应答挂断收尾句(§3.2-7);
- 验收对话收口三件(walkthrough 按 AC 对齐/固定收口句/语音通过应答;§3.2-8);
- 垫话细则(实验性,仅耳机通道;§3.2-4);TTS 语速口令入 M0 偏好(§3.2-10 尾)。

## 5. 不做清单(待 owner 另行拍板或不在你范围)

- `[pricing.llm]` 三键分列 P1→P0(动 Codex 复审 B6 定稿);
- 通话形态 B1–B6、电话认证补丁 F4/F5、PSTN 披露分级 F6(P1/P2 战略范围);
- diarize 检测型审计立项(F1,P1 设计);
- S2S 供应商侧工具禁令回写 07 D6(F3)及 research §6 各条纯文档刷新(6-1/6-2/6-5/6-7 等)——归文档会话;
- 多任务聚合口播(P0.5–P1)、无屏声明态(P1)。

## 6. 诚实汇报要求

完成后按 M1–M11 逐项对账:[ok] (给代码提交 hash + 测试/golden 输出尾行)/ [warn]部分(差什么)/ [fail]未做(为什么);窗口已过的项报"窗口已过 + 返工评估结论";候选清单逐条记采纳/不采纳 + 一句理由;canonical 回写各附轻量评审记录位置。全部写入本 Phase 的 `e2e/evidence/`,供后续对账复审。
