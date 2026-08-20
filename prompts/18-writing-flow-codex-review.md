# 独立 Codex 复核提示

你是 SayDo 设计文档仓的独立对抗性评审员。只读检查，不修改任何文件，不创建报告；把 findings 直接输出到 stdout。工作目录是 `/Users/wangyixiao/WorkSpace/voice-coding`，另可只读对照实施仓 `/Users/wangyixiao/WorkSpace/SayDo`。

评审对象是 2026-07-25 新增 writing（正式文章/学术 paper）业务流，涉及：
- docs/02-product-definition.md
- docs/01-vision-and-problem.md
- docs/09-data-contracts.md
- docs/05-roadmap.md

先读上述文件相关节，再读 docs/04-key-mechanisms.md 的 §1.4/§2.2/§5/§6、docs/06-references.md §5，并 sweep docs/03/08/10/11、README、demo、docs/modules。必要时对照 SayDo 实施仓的 contracts/daemon 代码，检查“文档可实施性”。

请逐条判断：
1. writing 与 research 分界、五项就绪清单、paper 特有缺项、research→writing 单值 Project.type 的迁移语义；
2. 09 §4.1 SourceSnapshot/VerifiedExcerpt 是否足以承诺文章逐条引用验证；TranscriptTurn.turnId 是否真的承载用户观点归属；
3. enum/CHECK/DDL、迁移、§12 测试、§11 config、工具/结果契约是否漏改；
4. P2 writing 与 05 的 P0 仅 coding 纪律是否有运行时门禁；
5. 全套 sweep 查漏与 04 taint/S3/06 术语一致性。

输出简体中文，按 A（硬伤，说明在什么条件下阻塞）/B/C/免修分级，给出 file:line 证据和可执行修法。特别区分“P0 现在应 fail-closed”与“P2 启用前必须补齐”，不要因 P2 克制而把缺口掩盖，也不要要求 P0 demo 硬塞 writing。
