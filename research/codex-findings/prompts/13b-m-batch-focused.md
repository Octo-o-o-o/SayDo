# Codex 聚焦复核 prompt:M 批 canonical 回写的 §11/§12 一致性(13 号任务续,2026-07-25)

前次全量评审(prompts/13)已完成分析但输出被超时截断,已知结论是"当前批次不能放行"。本次聚焦复核,直接输出发现清单,不要重新全库扫描。

评审对象:/Users/wangyixiao/WorkSpace/voice-coding/docs/09-data-contracts.md 的 2026-07-25 M 批新增(M1 拆表/M4 cost meta 定型/M7 §5 规则⑥⑦/M8 params/M9 单位词表/M11 audioSegmentRef)+ docs/10 的 M6 四话术,与 09 既有 §11(模型/配置/记账规则)、§12(契约测试清单)、§0.1(签名域)的一致性。

重点核对(疑似冲突点,请证实或证伪):
1. **M4 vs §11-5**:§9 cost_entries 注释新定 kind='llm' 行 meta 必含 {model,input_tokens,cached_input_tokens,output_tokens};§11-5 既有"订阅调用记账 meta_json={provider, plan_window?, requests}"——订阅行的 meta 形状两处是否矛盾?若矛盾给最小改法。
2. **M2 vs §11-4**:§11-4 invocation 记录字段表(profile/provider/argv digest/cwd/笼档/observedModel/tool 计数/证据 digest)是否需要补"实际路由 provider(routed_provider)"?M2 原文要求"invocation 记录补实际路由 provider字段",本批只落了 cost meta。
3. **M7 §0.1 签名域行**:parentPackDigest 入签名、slices 含 segment/form 但 prefixDigest 派生值排除——§0.1 表述与 §5 接口注释是否自洽、无自指涉歧义?
4. **M1 拆表后**:§12-该有的契约测试条目(重建 digest 一致/使用记录如实)是否需要在 §12 增行?(§12 清单是"P0 必须全绿"的单源)
5. **M6 §2.5 封闭词表**:与 §3 收据矩阵(voice 封顶 S2/turn_ref 必带)、04 §5.1 S3 红线的表述一致性;词表匹配细则(2026-07-25 已按评审 A1 改封闭文法:整句=语气词+肯定词+语气尾,疑问句护栏,"不"子串即 reject)是否需要回写 docs/10 §2.5 第 5 条措辞。
6. 其它你前次已发现但未及输出的 A/B 级问题(若还记得范围,按 09/10 本批新增段落复核)。

输出格式:逐条【级别|文件|段落|问题|最小改法】,最后 Go/No-Go。简体中文,直接给结论,少过程叙述。
