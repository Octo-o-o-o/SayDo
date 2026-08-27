# RC4 public/privacy 第二次红灯：第一次 readback 返工

继续当前 fresh 实施会话 `01a030ff-6079-7073-ac93-d808e1f78789`，只在本文件所在 worktree 施工。不要读取 `logs/`、旧评审报告或其他实施会话解释；不要提交、推送、联网或触碰用户原始 dirty worktree。当前 143 条 journal 数据与真实候选的 private-probe 扫描结果本身没有发现错配，但零上下文 hostile readback 证明校验器仍有 fail-open、不可移植和自修改门禁。下面 P1/P2 必须全部机械关闭，并补稳定红/绿回归；不能只让当前样本变绿。

## P1-1：catalog 不得覆盖任何已确定的机械分类

- `historical-unverifiable` 与 `historical-erratum` 只能消费 `mechanicalCategory === "unresolved"` 的 occurrence。
- 先独立机械推导唯一类别/reason，再与 catalog 精确比较；`checked`、`skipped-log`、`excluded-non-artifact`、`historical` 等已确定类别一律不能被 catalog 改挂到 exception。
- 增加至少两个 fake-repo 反例：`skipped-log -> historical-unverifiable`、`excluded-non-artifact -> historical-unverifiable`，都必须 `failClosed=true`。

## P1-2：erratum 必须同路径，且只能是行数差异

- 规范化后强制 `actualPath === item.path === parsed claim path === catalog bound path`。
- `erratum-line-count` 必须证明 path、bytes、SHA-256、Git blob identity 全部精确相同，机械失败仅为 lines mismatch；same blob / different path 也必须拒绝。
- 三条现有 erratum 不得绑定只在本机 `public` remote 可达的 commit。先自行用 Git 重算，再改绑到仓内 `rev-list --all` 可达且 path/blob/stats 精确一致的 commit；host readback 找到的候选是 `26d32e89d9c6d28961ec93bf719266f80de6b26b`，不得盲抄，必须核实。
- 增加完整 clean clone 正例、same-blob/different-path 红例，以及 shallow clone 明确 fail-closed 的回归。

## P1-3：所有 Git 查询都必须成功/确实不存在/内部错误三态

- 历史 `git log`、`rev-list`、`ls-tree`、`cat-file` 的 spawn error、signal、异常退出、对象读取错误不得吞成“无历史”或 `unreachable-intermediate`。
- 只有 Git 成功返回的“路径/对象确实不存在”才能支持 unreachable；用 `ls-tree` 等明确区分缺失与内部失败。
- `skipped-log` 的 `ls-files` 同样如此：正常未匹配与 status 128/spawn error/signal 分开，内部错误必须进入 failures。
- 增加 fake Git：历史查询 exit 128 伪装 unreachable、`ls-files` exit 128 + `check-ignore` exit 0 伪装 skipped，两者都必须 fail-closed。

## P1-4：含空格 home grammar 不能截断或让二次扫描假净

- 从运行时私有 probe/config 注入可信 profile literal，并贯穿 strict、loose、git-path、binary、redaction/count API；生产调用方不能漏传。probe 本身不得进入公开输出或候选。
- macOS `/Users/<profile>`、Linux `/home/<profile>`、Windows `C:\\Users\\<profile>`/`C:/Users/<profile>` 覆盖 bare EOF、普通/连续空格、ASCII 标点和 Unicode 终止符；合法 spaced profile 必须完整覆盖且零 residue，suffix 保留。
- Windows profile 比较大小写不敏感；其余平台按明确规则。首次 range、替换后 residue、二次 strict/loose/git/binary count 必须一致且为零。
- 至少冻结 3 平台 × 当前 14 个终止符的 42 个既有反例，再加大小写 Windows、EOF 与 suffix 正例。

## P1-5：`--fs` 必须消除 hash-then-read TOCTOU

- 不得先按 path/hash 校验，之后重新打开同一路径扫描。对 working/index/HEAD/untracked exact-set 使用冻结 bytes：可扫描已验证的 Git blob，或在同一 no-follow FD 的同一 buffer 上同时 hash+scan，并在扫描后重新校验 path inode、mode、index/HEAD identity 与 untracked 集合。
- hostile Git wrapper 在 `hash-object` 后替换 working bytes 时必须受控拒绝，不能 `hits=0`；错误输出仍不得泄漏 path/profile。
- 保留现有 open-after-replace、symlink、stage conflict、mode/content drift、clean untracked 全部闭锁。

## P1-6：path ID 不得跨运行被字典反推

- 禁止公开无盐 SHA-256 路径前缀。每个进程生成随机私有 HMAC key，ID 只保证同一次运行内稳定；跨运行不可关联。
- key/path 都不得输出、落盘或进入报告。测试只冻结格式、同运行一致性、不同运行不等，不冻结具体 ID。
- 增加小字典反推 hostile，证明公开候选路径不能从输出 ID 唯一还原。

## P1-7：availability transition 必须绑定真实 Git blob identity

- 对 before/after tree entry 同时精确比较 path set、mode、冻结 bytes/SHA-256 与 `entry.blob`；并从返回 bytes 独立重算 Git blob ID，禁止信任伪 Git 提供的 blob 字段。
- fake Git 返回正确内容/mode、但合法 40-hex 错 blob 的 transition 必须拒绝；现有 wrong-before/script/single-byte/missing/duplicate/extra-path 正反例不得回归。

## P1-8：historical Markdown 门禁必须纯只读并在 fixed point 通过

- 门禁不得写目标仓。existing 文件对 frozen/base HEAD 的 transform 做比较；新增文件要求 `transform(current) === current`。移除 `changed >= 1` 这类要求。
- corpus 必须是 tracked + untracked 候选的精确 union，并冻结 inventory/预期变更集合；不能漏掉新增 prompt/report。
- 修正 `prompts/146-rc4-public-privacy-host-readback-return.md` 两个 malformed privacy destination，使候选本身处于 fixed point。测试在有问题候选上必须只读失败，在正确 fixed point 上必须只读 exit 0、`changed=0`。
- transformer 先解析并解码 `file:///Users/...`、`file:///home/...`、`file:///C:/Users/...` 再应用 home 脱敏；三平台 URI hostile 不得残留 privacy hit。
- 完整比较所有 generic Markdown destination 的精确 multiset/count；除 privacy-sensitive destination 外必须逐项不变。

## P1-9：clean/full/shallow clone 与本地/CI 门禁合同

- `.github/workflows/ci.yml` checkout 使用完整历史；本地 `just ci`/`ci:node` 必须运行与 GitHub 等价的 `week-audit --check-bundle`、historical fixed-point、journal 等发布边界步骤。
- 增加脚本化步骤清单一致性检查，防止本地 CI 与 GitHub CI 再分叉。
- full clean clone 的 journal/public-text/historical/week boundary 必须可绿；shallow clone 不得错误通过 journal，测试应稳定、受控地证明 fail-closed。
- 当前最终 implementation boundary 尚未生成是预期的证据阶段红灯：不要在本施工分支伪造最终 boundary，也不要把该项写成绿；实现与测试关闭后由主会话在最终集成候选生成。

## P2：同轮关闭

1. doc-links 不得因目标被 Git ignore 就把不存在的 Markdown destination 当存在；删除该豁免。迁移例外只能使用显式 mapping，且映射目标必须真实存在。
2. historical link preservation 使用完整 destination multiset/count 精确比较，不只比较数量不减少或少量非敏感链接。
3. historical transformer 的三平台 `file://` 本地 home URI 按上文解析后脱敏，并补 percent-encoding/空格/Unicode fixture。

## 数据与边界不变量

- `history/PROCESS-JOURNAL.md` 必须保持 HEAD/index/working blob 完全不变；禁止恢复任何 rewrite 能力。
- 原始 dirty `--fs` 因 exact-set 不一致应受控 exit 2；另用隔离已提交候选验证真实 private probes 的 `--ref`/`--fs` 都 exit 0、hits=0。
- stdout/stderr、fixture、报告与新 prompt 不得引入 private profile/path；错误只输出稳定类别和随机 opaque ID。
- 不得削弱 private-probe 要求、availability 冻结、exact inventory、safe-open、release provenance 或 fail-closed 语义。

## 必跑门禁与交付

至少运行并如实报告：journal self-test/check、boundary、public-text、privacy hostile、historical Markdown fixed-point、doc-links、week-audit boundary、iOS policy、release provenance、typecheck、lint、emoji、`git diff --check`、actionlint，以及新增 clean full clone / shallow clone / TOCTOU / random-ID / forged-blob 回归。

若 Grok workspace sandbox 无法证明真实 clone/history 或 private probes，明确列为宿主待验收，不得编造成绿。完成后给出逐条 P1/P2 对应的代码、测试、命令与原始摘要；不要提交。
