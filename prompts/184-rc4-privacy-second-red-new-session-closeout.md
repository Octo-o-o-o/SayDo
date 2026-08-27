# RC4 public/privacy 第二次红灯：新实施会话收口

你是全新的 Grok 实施会话。不要 resume 任何旧会话，不要读取 `logs/`、旧 review/report 或实施会话解释；不要提交、推送、联网或触碰用户原始 dirty worktree。只在本文件所在 worktree 施工。先完整读取适用 `AGENTS.md`、`prompts/179-rc4-public-privacy-second-red-fresh-implementation.md`、`prompts/183-rc4-privacy-second-red-first-readback-return.md` 与当前全部 dirty diff。

上一实施会话已关闭绝大多数 P1/P2，但其交付仍有一个真实稳定红灯，且 shallow-clone 回归缺少“确实 shallow”的机械证明。不得 reset、checkout、覆盖或重做现有落地；只关闭以下精确缺口与相邻测试。

当前未提交候选已用临时 index 写成 Git tree `eeb7082ba7b5a8ca269cf98c9988e34f29be4c64`，再从该 tree 逐字节/mode 构造隔离提交，source/fixture tree 精确相等。真实 private probes 的该完整候选：

- `--fs`：exit 0，`scanned=1415 binary=87 excluded=8 hits=0`
- `--ref <40-hex fixture commit>`：exit 0，计数相同

不要用 HEAD 快照冒充 dirty 候选，也不要因接下来修改使 tree 改变就继续引用上述 tree；完成后必须重新生成并报告新的 exact source/fixture tree。

## P1：doc-links 正确闭锁后暴露的唯一真实 broken link

宿主真实命令：

```text
$ node scripts/check-doc-links.mjs
[fail] 活跃文档相对链接失效:1
research/codex-findings/24-repo-merge-migration-review.md:368 -> ../../.saydo/knowledge/current/core.md#L16
exit 1
```

`.saydo/knowledge/current/core.md` 是过程态私有知识投影，不进入公开仓；当前 worktree 中该目标也不存在。实现的 fail-closed 行为正确，不能恢复“被 Git ignore 就算存在”的豁免，也不能伪造 `file://`/external 目标。

最小修复历史报告：保留“当时审查过 current/core.md 第 16 至 29 行”的历史事实，但把不可发布的 Markdown 链接改为不可点击的受控文字/反引号相对标识，并明确它是过程态私有路径、不随公开仓发布。不要改成新的 canonical 断言，不要重写整段。随后：

- `check-doc-links.mjs` 必须 exit 0，broken=0；
- 增加/保留 hostile fixture，证明“目标不存在但 Git ignored”仍 fail-closed；
- 显式 destination mapping 只有目标真实存在才允许通过。

## P1：shallow-clone hostile 必须证明自己真的 shallow

当前 `test-journal-digests.mjs` 使用本地路径 `git clone --depth 1 <path>`；Git 可能忽略本地 clone 的 depth，使测试因别的原因假红。

- 改用 `file://` URL 或等价的真实 shallow 构造；
- 在调用 verifier 前机械断言 `rev-list --count HEAD === 1`（或精确预期），并断言 erratum 所绑定的旧 commit/object 不可达；
- full clone 正例必须机械断言旧 commit 可达且 erratum 精确通过；
- shallow clone 只能因历史证据不可达而 fail-closed，不能因 policy SHA、缺脚本、working-tree drift 或 fixture 配置错误碰巧失败；测试要断言失败 reason。

## 完整候选复核

1. 用完整本地 clone 保留原仓历史，覆盖全部 tracked modified + untracked 候选，提交后比较 source candidate tree 与 fixture tree 完全相等；不得抽样。
2. 在该 clean full-history candidate 上运行 journal check、public-text fixed-point、historical fixed-point、doc-links、privacy `--fs`/`--ref`（真实 probes）。除最终 implementation boundary 尚未生成这一预期证据阶段项外，全部必须 exit 0。
3. `week-audit --check-bundle` 缺最终 boundary 是主会话最终集成阶段才会关闭的预期红灯；不得伪造 boundary 或写成通过。相关自测与 CI 步骤等价门禁本身必须通过。
4. `history/PROCESS-JOURNAL.md` 的 HEAD/index/working blob 必须继续完全一致；禁止 rewrite。

## 必跑门禁

至少如实运行并报告真实退出码：doc-links 及新增 hostile、journal self-test/check、public-text、boundary、privacy、historical fixed-point、week-boundary self-test、CI gate equivalence、iOS policy、release provenance、typecheck、lint、`bash scripts/check-emoji.sh`、`git diff --check`、actionlint；以及上面的 exact clean full-history candidate。若 sandbox 不能证明真实 private probes/full history，明确交给宿主复核，不能编绿。

完成后列出这两个 P1 的代码/测试证据、新 candidate tree、所有门禁摘要与仍预期为红的最终 boundary 项。不要提交。
