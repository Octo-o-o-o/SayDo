# RC4 发布线主机 readback 返工单

你是本轮发布线施工者。继续会话 `<session-id>`，仓库为
`<repo>`，精确基线提交为
`704048f2ca026a03edf40b0932153fdacb256daa`。

这不是一次新的独立评审，而是实施会话结束后的主机 readback。常规门禁虽然退出 0，主机用直接反例仍复现了四个红灯。必须逐一关闭并把每个反例加入自动化测试。只修改本轮发布脚本、测试和因生成器变化必须刷新的既有 canonical 生成物；不得触碰真实 Cloudflare/GitHub、远端、tag、release、部署、daemon 或 mobile；不得 commit/push。使用 `apply_patch` 修改。

## 主机已复现的真实结果

```json
{"arbitraryIdAccepted":true,"unknownEvidenceFieldReturned":true,"unknownEvidenceFieldPersisted":true,"unprojectedReleaseSeedRetained":true,"unprojectedPublicCiSeedRetained":true}
{"partialWriteAccepted":true,"actualBytes":17,"expectedBytes":34}
```

因此，当前实现仍会：

1. 接受任意安全字符片段作为 Pages deployment id；
2. 在 evidence 根对象或嵌套对象中接受、返回并落盘合同外字段；
3. 从 release/publicCi seed 保留未投影的外部字段；
4. 一次 `write` 发生短写时仍返回成功并留下截断 JSON。

## 必须完成的修复

### 1. Pages deployment id 使用当前真实合同

- 当前对两个真实生产 Pages 项目的只读枚举结果为 18/18 个 id 都是 36 字符的小写 UUID v4。不要为了测试 fixture 保留“任意 `[A-Za-z0-9._-]` 片段”兼容口。
- fresh/recovery/readback 所有 deployment id 均使用同一个严格验证器，当前只接受规范小写 UUID v4。未来 Cloudflare 若改变合同，应显式升级 schema 与测试，不能静默放宽。
- 测试里的合法 fixture 改成确定性的合法 UUID v4；任意短片段、32 hex、大小写 UUID、错误 variant/version、token、URL、控制字符、超长值必须 fail-closed。
- 错误文本只用常量，不回显不可信 id。

### 2. 完整 durable evidence 做 exact schema 投影

- 持久化边界必须从可信字段逐字段重建最终 evidence，不能 `{...seed}`、`Object.assign`、rest-copy 或仅在序列化后扫字符串。
- 根对象及 `release`、`publicCi`、`pages`、`audit`、`deployment`、`project` 等所有嵌套结构均拒绝或丢弃合同外字段；选择一种行为后写明确测试，不能让未知字段出现在 returned object 或落盘 JSON。
- 对每个数组、字符串、URL/host、计数、时间戳和状态设置明确类型及合理上限。project domains 只从本地可信 expected exact-set 重建；Cloudflare raw object 不进入 evidence。
- seed 中仅使用合同允许且本地可信的字段；`release` / `publicCi` 的外部未知字段必须消失。getter、Proxy、`toJSON`、Symbol、循环对象、token/sentinel 不能泄漏到返回值、错误、stdout 或文件。
- 完整 evidence 在任何 JSON 序列化、stdout 或落盘之前先通过该投影与验证；不要把“替换敏感字符串”当成合同验证。

### 3. 短写入必须完整循环或失败

- `replaceRegularFileInPlace` 以及本轮涉及的同类文件写入必须循环写到全部 byte 完成，正确处理 offset；一次写入小于剩余长度不得视为成功。
- `write` 返回 0、非法 byte count、抛错或最终字节数不足时必须 fail-closed，不能把截断文件报告为成功。
- 保持既有 inode/lease 与 `O_NOFOLLOW` 安全属性，不得为了简化改回可被 symlink/rename 竞态利用的临时路径。
- 增加确定性的真实短写反例：模拟多次短写最终成功，并验证内容逐字节完整；模拟 0 progress/中途失败，验证不会返回成功。不要只测 helper mock 的 happy path。

### 4. 清理明显死代码并防回归

- 若仍存在连续两个相同 `return error...` 或其他本轮引入的不可达重复语句，删除重复项。
- 将上述四类主机反例直接纳入 `scripts/test-release-provenance.mjs` 或现有最合适的发布自测，让旧实现必红、新实现转绿。
- 测试必须断言 unknown 字段在 returned object 与 persisted JSON 两处都不存在，并断言任意 id 不再被接受。

## 验收门禁

逐项运行并记录真实退出码：

```sh
node scripts/test-release-provenance.mjs
node scripts/test-release-physical-evidence.mjs
node scripts/post-release-gate.mjs --check-candidate v0.1.0-rc.4
node scripts/week-audit.mjs --check
node scripts/week-audit.mjs --check-bundle
pnpm typecheck
pnpm lint
pnpm exec actionlint
bash scripts/check-doc-links.sh
bash scripts/check-emoji.sh
git diff --check 704048f2ca026a03edf40b0932153fdacb256daa --
```

不得运行真实发布、真实部署、`pnpm test`、`just ci` 或 daemon Vitest。若刷新生成物，先确认生成命令成功，再复跑两个 week-audit check。最后给出改动文件 exact-set、四个反例对应测试位置、各门禁原始摘要与退出码、残余风险；不 commit。
