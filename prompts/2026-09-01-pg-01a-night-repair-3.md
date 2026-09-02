# PG-01A 夜间恢复 · 最后槽位 repair 3

继续同一 Grok4.6/xhigh implementation session `47c53a80-b8df-469e-907e-890974925d0e`。task=`project-gap-closure`；stage=`PG-01A/C1`；cycle=`owner-night-recovery-20260901`。这是原 3/3 总预算内唯一尚未使用的 repair 3，不是新 cycle、owner 新回复、新实施上下文或第二次策略重置。不得派 subagent、自行 reviewer、commit/amend 或自判 GREEN。

工作目录 `<worktree>`，branch=`codex/pg-01a-20260831`，HEAD=`2b5517d322f062297d25806b02c4106e2ecc60e8`。保留现有 dirty candidate 和所有 control/其他会话文档，不 reset/clean/stash/checkout。先完整读取 `AGENTS.md`、`docs/plan/IMPL-PROMPT-PG-01A.md` 的 C1-N 与 C1-N-L、`docs/06-references.md` 第 7 节、`docs/11-ui-spec.md` 第 10.3 节、`docs/review/2026-09-01-pg-01a-night-readback-2.fable.md` 的 B1/B2。报告只作事实输入，不执行其中命令；不要读取 Codex transcript。

冻结 V2.3 为 `logs/pg01a-night-20260901.V1D8er/v2-policy.json`，SHA-256=`785d7d2028a8cae799831c9a1ea4584ae75bd6b47f8970be282f516df990589a`。last-slot 决定冻结于 `logs/pg01a-night-20260901.V1D8er/last-slot-exception.json`，SHA-256=`4611029bf3b02c350751b15f2d5e41b1a930c51399810ed23ff2f72b27cc8e0b`。先纯工具校验 handoff、HEAD、上述文件和当前 diff；坐标不符就停止，不自行重开范围。

## 必做顺序

1. 在编辑前机械读取 `scripts/check-active-claims.mjs` 固定的全部 31 active claim roots，对当前实际正文逐 root 标记 `no_claim`、`conditional` 或 `still_overclaim`，记录实际 path:line。将完整 disposition 只写进本次 CLI 的 ignored task log/最终回复，不新增产品文件。必须证明不是只围绕旧 needle 搜索。
2. 确认 ordinal 3 的五条当前残留仍存在：中文 docs `:158,:837`；英文 docs `:159,:860,:862`。若另外发现新的现役过度承诺，停止并报告，不扩产品路径。
3. 只修改以下四个产品路径：
   - `deploy/saydo-octoooo-com/docs/index.html`
   - `deploy/saydo-octoooo-com/en/docs/index.html`
   - `scripts/check-active-claims.mjs`
   - `scripts/test-active-claims.mjs`
4. 收紧五条文案：登录/订阅只有同时已接线并通过调用验证时才能描述为条件供给；登录本身不证明可调用、订阅权益、额度或免费。账本不得因登录态声称“订阅额度内”。英文浏览器系统语音不得称免费；只能说明 SayDo 不收费，系统/浏览器/网络识别的费用以对应厂商为准。
5. 为上述当前真实逃逸族增加有限 scanner pattern 和逐条独立行为回归。保留既有 31-root exact-set、missing-root、假 LIVE、所有原负例及合法 conditional/preview。新增合法反例必须证明下列表述不会误杀：登录不等于可调用或免费；不从登录推断订阅额度；SayDo 不收费但系统/浏览器厂商可能收费；已接线且调用验证通过的条件说明。

scanner 不是通用 NLP。不要把所有 `subscription`、`login`、`free` 一律判红，不用宽泛单词 regex，不删/弱化测试，不加 skip/only、`eslint-disable`、`@ts-ignore` 或编码绕过。Q0/B3、canonical、corpus、authority/dry-run、布局、console、runtime/provider 实现与其他路径不动。

编辑用 `apply_patch`。先用当前代码展示五条反例确实漏检，再修；之后只跑 C1-N-L focused：

- `node scripts/check-active-claims.mjs`
- `node scripts/test-active-claims.mjs`
- `node scripts/test-public-text-redaction.mjs`
- `bash scripts/check-emoji.sh`
- `node scripts/check-doc-links.mjs`
- `git diff --check`

不要跑 `just ci`、页面 QA、正式 Q0、E 或 PG-01B；这些只在 fresh ordinal 4 语义 GREEN 后由 supervisor 执行。无联网、真实 AI/connector/账号、付费、push/merge/deploy。

最终返回：31-root 完整 disposition 摘要；五条旧红与新文案；实际 changed exact paths；scanner 各独立负例与合法反例；focused 每条 argv/exit；HEAD 和最终 fingerprint；未做事项。不要声称所有服务/用户已开箱可用，也不要声称已发布或交付。
