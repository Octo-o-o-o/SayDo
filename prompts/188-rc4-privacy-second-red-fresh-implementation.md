# RC4 public/privacy 第二次红灯后的全新实施会话

这是上一实施会话第一次 readback 返工后再次出现的独立 No-Go。按项目制度，不得 resume 旧实施会话，也不得读取旧会话日志、旧 review 报告正文或施工自辩。你是全新的实施会话，只以本 prompt、当前工作树代码、canonical/计划文档和真实测试为输入。

只修改 `~/WorkSpace/SayDo-rc4-f107-readline-review-fix-20260823`。不要提交、推送、联网，不触碰用户原始 dirty worktree，不改写 `history/PROCESS-JOURNAL.md`。不得削弱、删除或跳过门禁；不得把 dirty source 缺最终 implementation-boundary 证据这一预期项伪造为绿色。

两路零上下文审查结论均为 P0=0、P1=2、No-Go。合并去重后必须关闭以下三组边界。

## P1-1：真实 week-audit adapter 丢弃 stdin

`scripts/week-audit.mjs` 约 528 行的第二个 Git adapter 只接收 `args`，没有转发 helper 传入的 `{ input }`。`scripts/implementation-boundary.mjs` 的 `git cat-file --batch-check` 依赖该 stdin，因此在合法源码提交后追加合法独立 boundary 证据提交时，真实：

```text
node scripts/week-audit.mjs --write
node scripts/week-audit.mjs --check
```

都会 exit 1，错误为“实施边界对象类型输出为空”，并可能把 owner-home 绝对路径 stack 输出到日志。现有 `test-week-audit-boundary` 89/89 只测 helper，没有覆盖真实 adapter。

修复要求：

- adapter 完整、逐字段、受控地转发所需 input/options，不能只为这一条硬编码假结果；
- 新增真实 full-history Git 集成 fixture：源码 commit + 唯一独立 boundary 证据 commit，真实跑 `--write` 与 `--check` 均通过；
- 缺 input、错误 object type、错误 parent、脏 snapshot、availability 漂移仍 fail-closed；
- CLI 错误不得泄漏 owner-home 绝对路径或私有 probe 值。

## P1-2：所谓完整 CI 等价既不完整，也不能证明 active execution

当前 `scripts/ci-gate-manifest.mjs` 只比较 12 条子集，真实四入口命令数约为 25/26/28/29；实际 `check-public-tree-privacy.mjs`、`pnpm test`、iOS build test、等价检查自身、third-party gate 等不在完整比较内。`just ci` 还缺 CLI distribution，而 package/CI/release 有。

另外当前解析可被下列非同义 hostile 变体绕过并继续返回 `ok=true failures=[]`：

1. YAML `run: |` 改为 folded `run: >-`；
2. step/job 加 `if: false`；
3. step 加 `continue-on-error: true`；
4. shell block 前置 `set +e`；
5. 把 gate 文本放入带尾注释的 heredoc；
6. publish 删除真实 `quality-node` needs，只留下 comment-only `quality-node` 与另一个数组 needs；
7. 从 CI/release/本地入口删除实际 privacy scan、`pnpm test`、iOS build test、third-party gate 或 equivalence gate 本身。

修复要求：

- 建立一份可执行的完整 gate SoT，或用真正的 YAML/shell 语义解析；四个入口必须执行同一完整边界集合，不能靠源码字符串、注释、echo、heredoc 正文自证；
- `just ci` 补齐 distribution，release quality job 执行完整集合，publish 有真实、结构化、fail-closed 的依赖；
- 明确拒绝/识别 `if:false`、`continue-on-error`、`set +e`、`|| true`、folded scalar、comment-only/echo-only/heredoc-only、重复/缺失/乱序；
- 逐个实际 gate 删除的 hostile 都必须红，不能先过滤到 12 条再比较；
- 若采用共享 runner，各入口仍必须验证 runner 是 active、精确一次、没有吞错，且 publish needs 真实完整 gate job。

## P1-3：iOS public artifact policy 漏真实账户、team 与设备标识

当前 `scripts/ios-artifact-policy.mjs` 会接受以下内容：

```text
DEVELOPMENT_TEAM[sdk=iphoneos*] = ABCDE12345
TeamIdentifier = ABCDE12345
APPLE_ID = alice@example.invalid
0123456789abcdef0123456789abcdef01234567
00008110-0012345678901234
platform=iOS,name=AlicePhone
```

修复要求：

- 在完整 tracked `apps/ios/**` 普通文件集合中识别 sdk-qualified build setting、TeamIdentifier、Apple account/email、40-hex legacy UDID、现代 Apple device ID、个人 device name/destination；
- 继续拒绝 symlink/gitlink/特殊 mode、绝对本机路径与公开隐私命中；错误输出不得回显真实标识或私有值；
- 正常占位符、变量引用和通用设备族表达不能误报；
- 每一类独立 hostile fixture 都必须红，并补组合、大小写/空白/常见 pbxproj/xcconfig/project.yml 形态。

## 不可回归合同

- full-history historical transform、journal digest、doc links、public text redaction、public tree boundary/privacy、ref mode、private probes、release atomic boundary、iOS build/install 绑定均保持既有合同；
- `history/PROCESS-JOURNAL.md` 的 HEAD/index/work blob 必须继续完全相同；
- dirty source 97 条的既有修改不得丢失，新增修改必须逐项可解释；
- clean candidate 必须由完整历史 clone 加当前精确 tree 构造，源码 tree 与 fixture tree 完全相同，最终 clean、non-shallow、`git fsck --full` 通过。

## 必跑门禁

先跑新增三组真实集成/hostile 测试，再在独占测试窗口内串行运行项目需要的 daemon/full Node 门禁。至少包括：

```text
node scripts/test-week-audit-boundary.mjs
node scripts/test-ci-gate-manifest.mjs
node scripts/check-ci-gate-equivalence.mjs
node scripts/test-ios-artifact-policy.mjs
node scripts/test-public-tree-boundary.mjs
node scripts/test-public-tree-privacy.mjs
node scripts/test-public-text-redaction.mjs
node scripts/test-historical-redaction.mjs
node scripts/test-journal-digest.mjs
node scripts/check-journal-digests.mjs
node scripts/check-release-provenance.mjs
pnpm run verify:distribution
pnpm typecheck
pnpm lint
bash scripts/check-emoji.sh
git diff --check
```

并在精确 clean full-history candidate 上真实运行 `week-audit --write`、`--check` 与适用的完整 `just ci`。若发现其他测试进程正在运行，先等待，不得与 daemon/vitest 并行。任何红灯继续诊断；最终报告列出根因、实际修改文件、每条命令真实 exit/摘要、新 candidate tree 与唯一预期红项。保持未提交。
