# RC4 发布链：有界写入与 helper 结果信封返工

你在原 `grok-4.6` 发布实施会话继续施工。只修改当前 worktree；不要 commit、push、发布、部署、联网，不要改用户原始 dirty worktree。

上一轮已完成事件之后，主控在宿主用公开入口/真实临时文件复现出新的 P1。现有 read 有 1 MiB 上限，但 claim/persist 写入没有同一上限；同时 helper 结果只做字段 allowlist，不做互斥和 op-specific 形状校验。必须在进入独立复审前修复。

## 已验证复现

主控使用 `MAX_EVIDENCE_BYTES + 1` 字节输入，得到：

```text
persistRejected=false, persistSize=1048577
defaultAnchoredIo.claim: ok=true, size=1048577
claim 返回 {ok:true,error:"contradiction",dev:"1",ino:"1"}: claimRejected=false
persist 返回 {ok:true,error:"contradiction"}: contradictoryPersistRejected=false
```

所有探针只作用于 `mkdtemp` 临时目录并已清理。当前实现会写出自己随后拒绝读取的 evidence；persist 超限还会先 `ftruncate`，因此不是可接受的输入校验缺口。矛盾结果则可让公共入口在没有真实 mutation 时谎报成功。

## P1-1：claim/persist 必须在任何 mutation 前按 UTF-8 bytes 封顶

统一以 `MAX_EVIDENCE_BYTES = 1_048_576` 为 claim/read/persist 的证据字节上限：

1. Python helper 在 `open_anchored`、`O_CREAT|O_EXCL`、`ftruncate`、write 之前，把 body 严格编码为 UTF-8 bytes 并检查长度；`MAX + 1` 必须拒绝，claim 不得创建路径，persist 原 inode 字节/size/identity 不变。
2. Node `runOpenatHelper`、`defaultAnchoredIo.claim/persist` 和 `replaceRegularFileInPlace` 的公共边界也要在 spawn 或调用注入的 `io.anchored.*` 之前做同一 byte 上限检查，避免 custom IO 绕过 authority。不得只依赖 2 MiB stdin 上限。
3. 限制按 bytes，不按 JS 字符数/Python code point；补多字节 Unicode 恰好边界与越界回归。`MAX` 边界应按明确合同接受，`MAX+1` 拒绝。
4. 非 string/Buffer、编码失败、hostile coercion/getter/Proxy 必须返回/抛出既有受控常量，不执行 attacker coercion 后再把其文本泄漏，也不得发生 mutation。
5. claim 超限用受控 claim failure，persist 超限用受控 write failure；不能包装成成功，也不能制造一个随后无法 read/recover 的 evidence。

新增真实文件探针：

- direct `runOpenatHelper` 与 `defaultAnchoredIo.claim` 的 `MAX`/`MAX+1`，越界时路径不存在；
- direct/default/custom persist 的 `MAX`/`MAX+1`，越界时 custom method 调用计数 0，原字节和 inode 不变；
- ASCII 与多字节 Unicode 两组；
- 越界失败后 read/lease/retry 状态仍可判定。

## P1-2：helper result 必须是互斥、op-specific 的 exact envelope

`viewAnchoredResult`/调用点必须知道预期 op，并严格验证 own-data descriptor，不能仅把未知键过滤掉后凭 `ok === true` 放行。合同至少应为：

- claim 成功：exact `{ok:true, dev:<canonical decimal string>, ino:<canonical decimal string>}`；
- read 成功：exact `{ok:true, dev:<canonical decimal string>, ino:<canonical decimal string>, text:<string>}`，text 仍受 byte 上限；
- persist/lease 成功：exact `{ok:true}`；
- 失败：exact `{ok:false, error:<non-empty controlled string>}`，仅在合同允许时可有 canonical `code`；不得带 dev/ino/text；
- `ok` 缺失、非 boolean、true 同时带 error/code、false 同时带成功 payload、op 不匹配、缺字段、字段类型错误、额外字段、getter/accessor、throwing/revoked Proxy、异常 ownKeys/descriptor 一律安全拒绝。

公共调用点必须分别用 `claim`/`read`/`persist`/`lease` 预期形状验证 injected IO 结果，不能让后续调用者偶然检查字段来代替信封验证。失败时新建受控错误，不泄漏原对象身份、攻击文本或 V8 引擎文本；mutation 计数必须为 0。

新增表驱动反例，至少覆盖：

```text
{ok:true,error:"x"}
{ok:true,code:"EEXIST"}
{ok:true,text:"x"} 作为 persist
{ok:true} 作为 claim/read
{ok:false,error:"x",dev:"1",ino:"1"}
{ok:false}
{ok:"true"}
额外未知 own field
accessor / revoked Proxy / throwing descriptor
```

并证明四个合法 success envelope 与允许的 failure envelope 仍通过；大于 `MAX_SAFE_INTEGER` 但规范的 dev/ino 十进制字符串继续保持字符串，不得退回 Number。

## P2：发布线新 prompt 脱敏

以下未跟踪发布 prompts 已被文件名扫描命中本机 home，部分还含 operational UUID：

```text
prompts/112-rc4-release-second-red-new-session.md
prompts/115-rc4-release-first-review-return.md
prompts/118-rc4-release-second-red-new-session.md
prompts/121-rc4-release-final-review-return.md
prompts/128-rc4-release-postfix-second-red-fresh-implementation.md
prompts/145-rc4-release-host-readback-return.md
```

仅用 `$HOME`、`<repo>`、`<session-id>`、`<device-id>` 等语义占位符替换真实值，保持命令和验收含义；不要回显被替换值。随后扫描全部本轮未跟踪发布 prompts（含 147/150/151/156/161/165），home、operational UUID、RFC1918/private probe 命中必须为 0。不要使用 `git add -A`。

## 完整门禁

逐条运行并真实报告 exit code/摘要：

```text
node scripts/test-release-provenance.mjs
node scripts/test-release-physical-evidence.mjs
隔离物化 tracked target 后 node scripts/week-audit.mjs --check-bundle
pnpm typecheck
pnpm lint
node scripts/check-emoji.mjs
node scripts/check-doc-links.mjs
git diff --check
```

另单独报告上面 bounded-write 与 exact-envelope 表驱动探针的计数和零 mutation 断言。当前 worktree 因 helper 仍未入 index 导致直接 `--check-bundle` 只允许这一项预期失败；不得 `git add` 或伪造 index 让它变绿。

## 边界

- 不处理 AI supply 商业/战略计划。
- 不创建 release、tag、ruleset、Cloudflare deployment 或外部状态。
- 不删除用户文件，不修改其他 worktree。
- 未 commit；最终答复逐项列出真实测试证据与仍存限制。
