# RC4 发布最终复审返工：目录锚、不可变错误、状态机 Proxy、可复现 bundle

继续原 implementation session，只改当前 worktree，不 commit、不 push、不联网、不调用 subagent。上轮静态 parent symlink、close fail-closed、foreign forged error 与 private path identity 已有进展，但回修后零上下文评审和主会话真实探针仍判定 No-Go。必须根因修复并扩展真实公共入口回归。

## P1：parent chain 检查与 open 之间仍可换成 symlink

现有 `assertAnchoredParentChain(path)` 是 pathname 预检查。对抗 IO hook 在检查结束、`open` 之前把 `inside/redirect` 换成指向 outside 的 symlink，`acquireDeployEvidenceLease()` 仍返回 fresh 并在树外创建 claim。仅“open 后再 lstat/realpath”不合格：外部文件已经落地；也不得沿后来 symlink 删除不确定目标。

要求：

1. claim、read、assert lease、persist 都使用真正 directory-handle anchored 的 primitive：从可信 root 逐 component 以 no-follow directory handle 打开，最终 basename 相对已持有 parent handle 执行，路径换位不能改变目标目录。
2. Node 若无跨平台 `openat`，允许新增仓内、可审计的最小 POSIX helper（例如 Python 标准库 `os.open(..., dir_fd=..., O_NOFOLLOW|O_DIRECTORY)`），固定 argv/stdin、固定大小与稳定错误；强 primitive 不可用的平台必须在任何创建/外部动作前 fail-closed，不能退回 pathname check。Windows 路径必须用 `path.parse(...).root` 等平台正确构造；不能生成 `\\C:`。官方 deploy 可明确要求支持该强 primitive。
3. 回归必须在真实 acquire 公共入口的 open 边界换父目录，断言 nonzero/throw、fresh 未返回、outside claim 从未出现；read/assert/persist 做同族 swap，外部 sentinel 均存活。
4. 静态父 symlink、dangling/final symlink、FIFO、close failure、inode identity 与并发唯一 fresh 既有用例继续绿。

## P1：owned Error 的 message/metadata 可在逸出后篡改再重放

`WeakSet` 只记录对象身份；调用方取得 genuine owned Error 后可改写 `.message`，再把同一对象送回 Cloudflare 或 durable projection，当前会信任新文本。修复为不可变的内部错误投影：

- 使用私有 WeakMap 在创建时保存 canonical message/metadata，后续永远不重新信任对象可写属性；或冻结对象并把 stage/persist 元数据放私有表。
- `toPublicError` / `wrapError` / `ownedMessage` 只取创建时快照，始终新建对外错误；未知 caught object 一律新建稳定常量，不原样返回。
- 增加“genuine owned error 逸出→message/stage/persistFailed 改写→重放”的 Cloudflare 与 durable/state-machine 用例，原 UNIQUE 文本/对象身份不得出现。

## P1：state machine 仍直接读取 caught Proxy 属性

当前多处 `error?.persistFailed`、`error.stage`、`sanitizeDeployError(error.message)` 信任任意 caught object。真实结果：

- `readProject` 抛 revoked Proxy 时裸 TypeError 逸出，durable 只留 `started`。
- `audit` 抛 Proxy 时攻击 message 可进入 `audit_failed` evidence。
- 主会话独立探针：wrangler 抛一个 `persistFailed` getter 返回 true 的 Proxy Error，per-site 与 outer catch 两次信任该属性，最终 `sameObject=true` 且 `UNIQUE_ATTACK_TEXT` 逸出（probe exit 1）。

修复要求：

1. catch body 不得直接读取任意 caught value 的任何属性/`instanceof`/`toString`。只有内部 WeakMap 品牌记录的 stable metadata 才能判断 `persistFailed` / `stage`；所有本地产生的 aggregate persist errors 必须在创建时登记，不靠对象自报。
2. unknown wrangler/readProject/listDeployments/fetchHttp/persist/audit thrown value（含 getter Proxy、revoked Proxy、primitive）全部映射为新的稳定常量 Error；外部动作已经发生时仍按可信的本地 stage 常量落 `partial_failed`/`audit_failed`，不得让攻击者自选 stage。
3. evidence 的 error message 只来自内部稳定投影；unknown 一律 `部署失败`，不得写入攻击文本。
4. 真实 `runPagesDeployStateMachine` 公共入口覆盖上述三条，不接受仅直接测 helper。

## P1：bundle 不能依赖目标外的 untracked prompts

当前源 worktree 因 9 个未跟踪 prompts 恰好存在而 `--check-bundle` 绿；在只物化真实目标（tracked diff + 新 helper）的干净副本里 `--check-bundle` 红。冻结 publication/working snapshot 不得偷偷依赖不属于发布目标的本地未跟踪文件。

- publication manifest 的候选必须来自 Git index/tracked target；新增 source 在重生 bundle 前应先进入 index/代码提交，而不是把任意 `--others` 纳入公开 exact-set。
- working-tree snapshot 如需记录证据载体，必须是显式目标集合，或明确拒绝无关 untracked；不能把历史 implementation prompts 的偶然存在当成发布输入。
- 增加隔离 fixture：源树有额外 untracked prompt，但 materialized target 无该 prompt 时 bundle 仍一致；新增应发布 source 未入 index 时必须明确拒绝，而不是悄悄冻结。
- 当前 9 个 prompts 是否作为最终 evidence 由主会话在提交阶段决定；脚本不能隐式决定。

## P2：证据与跨平台

- `e2e/evidence/2026-08-23-rc4-release-candidate.md` 仍引用旧 `85c9...`，却描述未提交 patch，且 Proxy 结论与真实反例矛盾。现在先删掉/降回待验证表述；主会话完成代码提交后再用真实新 SHA 回写 evidence，不得编占位 SHA。
- Windows drive-root 构造必须正确；若强目录 primitive 暂不支持 Windows，明确、可测试地在外部动作前 fail-closed，而非路径误判或越界。

## 主机门禁

如实运行并回报：

1. `node scripts/test-release-provenance.mjs`
2. `node scripts/test-release-physical-evidence.mjs`
3. 干净 materialized target 的 `node scripts/week-audit.mjs --check-bundle`
4. `pnpm typecheck`
5. `pnpm lint`
6. `node scripts/check-emoji.mjs`
7. `node scripts/check-doc-links.mjs`
8. `git diff --check`

另逐项报告：parent swap outside files=0、owned error replay leak=0、revoked/forged state-machine error leak=0、forged persistFailed sameObject=false、bundle extra-untracked independence。不要执行 Cloudflare、GitHub、Release 或任何网络/部署动作。
