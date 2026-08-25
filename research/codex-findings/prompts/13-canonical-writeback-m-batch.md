# Codex 攒批评审 prompt:canonical 回写批 2(外部评审 M1-M11 文档侧,2026-07-25)

你是独立评审员。评审 ~/WorkSpace/voice-coding 设计文档库刚完成的一批 canonical 回写(外部评审必做清单 M1-M11 的文档侧),只读、找硬伤,不改文件。

## 本批回写内容

1. **M1**(docs/09-data-contracts.md §9):`context_snapshots` 拆内容表(pack_digest PK,幂等 upsert)+ `context_snapshot_uses(session_id, pack_digest, used_at, rebuild)` 使用记录表。
2. **M4**(09 §9 cost_entries 注释):kind='llm' 行 meta_json 定型 {model,input_tokens,cached_input_tokens,output_tokens,routed_provider?},断言 cached<=input;E1 usage 命名统一;明确不动 [pricing.llm] 单价合一(B6 定稿)。
3. **M7**(09 §5 + §0.1):ContextSnapshot 加 parentPackDigest?(入 packDigest 签名域)、slices 加 segment("stable"|"topical")/form("verbatim"|"gist")/prefixDigest?;编译规则⑥装配序恒定 + ⑦驱逐纪律;compilerVersion 含渲染模板+token 计数器版本;2.2 验收加 prefix-diff 条。
4. **M8**(09 §11 [params]):session_idle_suspend_sec=45 / dialog_context_high(6000)/low(3000)_watermark_tokens / audio_retention_days=0。
5. **M9**(09 §11 [pricing] 注释):计费单位词表 llm=tokens+cached_tokens / asr=audio_min / tts=chars / P2 预留 messages/wallclock_min。
6. **M11**(09 §1 TranscriptTurn):audioSegmentRef?{path,startMs,endMs}。
7. **M6**(docs/10-voice-ux-spec.md):§4 骨架 rule2 采访承接层;§1 话术变体三档纪律;新 §2.5 审批确认封闭肯定词表(肯定/否定表 + 否定优先 + 单字"不"精确匹配 + 否定邻接防护 + unmatched 默认拒绝复读/二次转屏 + S3 不适用);#42b 异族深评等待(起/心跳/插话应答)。

## 实现对照(SayDo 仓已同步落码,供交叉验证契约-实现一致)

- packages/contracts/src/types/contextpack.ts(segment/form/prefixDigest/parentPackDigest)
- packages/contracts/src/digests.ts(computePackDigest:parentPackDigest 入签名;prefixDigest 派生值排除防自指涉)
- packages/daemon/src/memory/compiler.ts(规则⑥⑦;稳定段 id 字典序渲染;M3 form)
- packages/daemon/src/storage/dao/snapshots.ts(拆表 DAO)
- packages/daemon/src/approvals/confirmVocab.ts(封闭词表匹配器)
- packages/daemon/src/cost/ledger.ts(meta 定型)

## 找什么(按优先级)

A 级:契约自相矛盾/不可实现/破坏既有红线(Gate 0 六项、S3 屏幕强认证、状态词纪律、两把钥匙、执行模式不变量);签名域循环/不可复现;封闭词表的安全漏洞(误放行路径)。
B 级:遗漏的同步点(其它章节还引用旧 context_snapshots 单表语义/旧 slices 形状);措辞歧义会导致实施漂移。
C 级:风格/冗余。

输出:逐条发现(级别/文件/行号或段落/问题/建议),最后 Go/No-Go 结论。简体中文。
