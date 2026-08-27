# RC4 发布溯源首轮 readback 返工单

## 1. 会话与边界

这是 `prompts/101-rc4-release-provenance-and-state-review-fix.md` 实施后的第一次红灯，必须回到同一发布实施会话返工。
保留当前未提交实现；只修改发布脚本、workflow、相应测试和必要合同文档。不得 commit、push、创建/修改远端
ruleset、tag、Release 或 Pages 部署，不得把 fixture 绿灯描述成真实外部验证。

以下问题由宿主和独立只读 reviewer 以真实反例确认。修复必须保持 prompt 101 的精确资产、全历史唯一性、
availability 事务和 preview-first 合同；不能通过减少快照目标、吞错、放宽 schema、删除反例或改成 skip 过门禁。

## 2. P1：Windows 实体 verifier 不是可运行闭包

`verify-release-url.mjs` 新增相对导入 `release-asset-manifest.mjs`，后者继续导入
`release-file-transaction.mjs`，并从 repo 布局下的 `docs/release/v0.1.0-rc.4-assets.json` 读取冻结清单；
但 `runWindowsPhysical` 仍只 scp verifier 与 PowerShell wrapper，wrapper 又只允许一个 `.mjs` 文件名。
按当前实际复制集合在隔离目录执行，网络请求前即 `ERR_MODULE_NOT_FOUND`，所以 Windows exec/global 必红。

必须实现：

- 为每次 gate 生成不可碰撞、可严格校验的远端相对根目录，保持最小 `scripts/` 与 `docs/release/` 布局，
  只复制 verifier 的完整相对 import/data 闭包；创建目标必须 fail-if-exists，不能复用远端旧文件。
- wrapper 只接受该固定生成格式下的安全相对 verifier 路径，拒绝绝对路径、`..`、空段、控制字符和任意扩展；
  不得为方便而允许通用 shell path。
- 两种安装模式结束后递归清理这一个随机根；清理失败必须非成功留证，不能只输出 warn 后把门判绿。
- 远端执行前后应绑定/验证传输闭包每个代码和 data 文件的 SHA-256；不能只绑定顶层 verifier。

新增直接回归：只复制旧两文件时必须以缺依赖失败；完整最小闭包在无参数 module-load 探针中必须到达预期 usage
错误而非 import/manifest 错误；任一 helper 或 tracked manifest 漂移必须在发起实体运行前拒绝。

## 3. P1：实体门 transitive provenance 缺口

`trustedPhysicalTools` 当前只绑定 post gate、physical validator、wrapper、verifier 四项，遗漏 verifier/post gate
的传递依赖和 tracked manifest。clean HEAD 可以替换 helper/data 而顶层 verifier SHA 不变。

必须实现：

- 建立明确、稳定的实体门代码/data exact closure；至少覆盖 post gate 的全部相对 import、Windows 远端闭包、
  `week-audit --write/--check` 的执行代码及 tracked asset manifest。
- 对闭包每项同时执行 release tag vs HEAD diff、publication manifest kind/digest readback，并写入 evidence
  `toolFingerprints`；缺项、额外未登记的相对 import、digest 漂移都 fail-closed。
- 用程序化 import-closure 断言防止未来新增相对 import 时漏更新人工列表；PowerShell/data 文件作为显式非 JS 根登记。

## 4. P1：availability snapshot/rollback 不是精确事务

已复现：目录内 symlink 会因 `statSync` 跟随链接而把仓外文件读进快照；原文件在 mutation 中被换成目录后，
restore 直接 write 导致 `EISDIR`，保留错误目录并掩盖原始 injected error；atomic temp/partial 的清理失败被吞，
新残留仍在；任一 restore 抛错还会中止后续目标回滚。

必须实现：

- 快照和复核使用不跟随链接的 `lstat` 语义；顶层或递归成员出现 symlink/非普通文件都在第一次 mutation 前拒绝，
  不读取链接目标。
- snapshot paths 必须去重且互不为祖先/后代，避免重叠恢复；路径集合非法时 mutation 次数必须为零。
- availability replacement 不能在最长 45 分钟的四项实体复验之前先从文件 A 计算、复验后才快照文件 B，
  否则成功路径会用基于 A 的旧内容静默覆盖期间的 B。应先完成外部实体复验，再立即从同一份 snapshot bytes
  派生 exact-anchor replacement；进入第一次 mutation 前重新验证 branch/HEAD/clean 状态及目标 bytes 未漂移。
- 恢复每个原文件/目录前先移除异型现状，再用同目录 temp+rename 原子恢复；所有 snapshot entry 都尝试恢复，
  不能因第一项失败跳过后面；最后逐项 exact bytes/type/existence 复核。
- rollback/cleanup 自身失败时必须同时保留原始 mutation error 和完整 rollback failures（例如 AggregateError/cause），
  不得掩盖原错，也不得吞清理错误或声称 exact rollback 成功。
- `writeFileAtomic`/`writeDirAtomic` 的 temp/partial 清理失败必须可观察；目录成员名同时拒绝 `/`、反斜杠、
  `..`、绝对路径和控制字符。

新增故障注入：顶层与嵌套 symlink、file→dir、dir→file、两个以上 restore 失败仍全部尝试、temp/partial rm 失败、
重叠 snapshot path，以及“计划后/快照前目标漂移”；逐项断言原错误、rollback 错误、残留、mutation 调用次数，
并证明成功 replacement 精确派生自实际 snapshot bytes 而不是早先读取。

## 5. P1：week-audit 七个输出仍非原子写

`WEEK_AUDIT_WRITE_OUTPUTS` 虽已列出七个目标，但 `week-audit.mjs --write` 仍逐项 `writeFileSync` 直接覆盖，
与 prompt 101 及计划文档声明的同目录临时文件 + rename 不一致。

必须让 `week-audit --write` 的每个生成文件使用同一 audited atomic writer；外层 availability snapshot 继续承担
七文件跨目标回滚。增加程序化门禁证明 writer 接线，不得只搜索路径字符串。

现有 rollback 自测还把 `rename-last` 设为第 7 次，实际 evidence、physical dir、audit file 后面仍有 rename；
`evidence`/`audit-write` 用手动 throw 也没有注入相应 write/rename。改为真实统计全部 mutation，覆盖第 1、
中间、evidence、physical-dir、audit/最后一次 rename，以及 audit check 在全部写完后的失败。每个 case 都逐文件校验。

## 6. P1：Pages 证据状态可被伪装，persist failure 与外部现实脱节

已复现把 `evidenceSeed.status="completed"` 传入后，第一次持久化及全过程均显示 completed，因为 spread 位于
固定 `status:"started"` 之后；schema 同样可被覆盖。另在 preview/production 外部调用成功后若 persist 失败，
当前直接抛 `persistFailed`，持久证据可能仍为 planned/deploying，且不尝试记录 partial_failed/不确定外部现实。

必须实现：

- 固定 schema/status/内部状态字段由状态机最后赋值或显式白名单构造，seed 只能提供经 schema 校验的
  release/public main/public CI readback；拒绝 seed 中的保留字段、缺失或非法 40-hex publicMain、重复 site project。
- preview 与 production 每次外部调用前都原子持久化明确的 in-progress 状态；外部调用/readback 后的 persist
  失败要保留“外部可能已发生”的 stage/outcome，尝试紧急写 partial_failed；若持久层持续失败，最终错误同时包含
  原始阶段与 persist failures，绝不能继续下一个站点或返回成功。
- Wrangler 输出 URL 必须精确属于声明的 project，不能接受任意 `<hash>.<other-project>.pages.dev`。每次 preview/
  production 后用 Wrangler `pages deployment list --project-name ... --environment ... --json` 或等价 Cloudflare API
  读取本次 deployment 对象，并机械核对 project_name、唯一 URL/id、environment、branch、commit_dirty=false、
  `deployment_trigger.metadata.commit_hash===publicMain`、latest_stage success；这些字段逐站写入 evidence。
  production 正式域名检查还必须证明域名/production alias 指向刚才 readback 的 deployment，不能只凭可能陈旧的
  marker/HTTP bytes 判本次部署成功。
- 任一错误路径不得让最后已持久状态倒退；completed/audit_failed 的语义和真实部署结果保持 prompt 101 合同。

新增反例：seed 覆盖 schema/status/内部字段、重复站点、非法 publicMain；错误 project URL、旧 commit、错 branch、
错 environment、dirty/failed deployment、正式域名仍返回旧 marker；preview 成功后 persist 一次失败、production
成功后 persist 一次失败、persist 持续失败，逐项断言外部调用次数、最后 durable 状态和聚合错误。

## 7. P2：门禁不能只做字符串存在性检查

- workflow 自测需真正解析 YAML 后检查 concurrency、permissions、三处 SHA readback/uniqueness 与 exact manifest
  job 接线；本机 `actionlint` 可作为附加门，但不能用自制顶层文本分块冒充 YAML parser。
- remote verifier 闭包、week-audit atomic writer、真实最后 rename 均需行为反例；禁止仅 `includes()` 判接线。
- ruleset matcher 只接受合同允许且确实覆盖目标 tag 的 GitHub ref pattern；不要因自制 regex 与 GitHub 语义不同而
  把不确定 pattern 判绿，未知/不支持 pattern 应 fail-closed。

## 8. 验收门禁

至少真实运行并报告：

1. `node scripts/test-release-provenance.mjs`
2. `node scripts/test-release-physical-evidence.mjs`
3. remote verifier 最小闭包 module-load/direct fixture
4. `node scripts/build-release-artifacts.mjs --freeze`
5. `node scripts/build-release-artifacts.mjs --check`
6. `node scripts/post-release-gate.mjs --check-candidate v0.1.0-rc.4`
7. `node scripts/week-audit.mjs --write`
8. `node scripts/week-audit.mjs --check`
9. `node scripts/week-audit.mjs --check-bundle`
10. workflow YAML parser与 `actionlint .github/workflows/release.yml .github/workflows/ci.yml`
11. 所有改动 `.mjs` 的 `node --check`、PowerShell parser（若本机可用）、`bash -n scripts/publish-public-snapshot.sh`
12. `git diff --check` 与 `bash scripts/check-emoji.sh`

若当前 dirty implementation boundary 使 week-audit/bundle 必须由宿主最终 commit 后才能冻结，先让生成器和原子事务
反例通过，明确列出仅能在最终 SHA 后执行的门；不得把 stale bundle 写成通过。最终只返回相对当前工作树的改动与真实
命令结果，不 commit、push、tag、release 或 deploy。
