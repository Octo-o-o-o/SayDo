# 评审 92 · 评审 91 二次回修的聚焦复核(零上下文;范围收窄)

只读仓库 `~/WorkSpace/SayDo`,分支 `main`,HEAD = `afd31b4`。

前两轮报告在 `research/codex-findings/90-week-crosscheck-review.md` 与 `91-review90-rework-verify.md`,
二次回修台账在 `e2e/evidence/w54b-batch.md` §8。**本轮范围收窄,只回答两个问题**:

## 问题一:二次回修本身对不对

逐条判 `CONFIRMED_FIXED` / `STILL_BROKEN`,附 file:line:

1. **A-5 退化修复**:`finalizeFailure` 的 `transitionTask` catch 分支现在补了 `resolveClaim`。
   - 这个位置对吗?会不会重复 resolve(该函数末尾也有一次)?`resolveClaim` 幂等吗?
   - 还有别的早退路径漏 `resolveClaim` 吗?`git grep -n 'active.delete' packages/daemon/src/tier1/executor.ts` 逐个查。
   - 新测试 `评审 91 A-5:身份漂移遇任务已被并发转走` 真的走到那条早退路径了吗,还是根本没触发?
2. **B-3**:`cursorHookCommand` POSIX 分支改成 shell 单引号包裹。
   - 转义实现对吗(`'` → `'\''`)?claude 的 `--settings` 与 cursor 的 `hooks.json` 两个消费方都由 shell 执行吗?
   - 有没有第三个消费方拿这个串当**文件路径**用(那样加引号就坏了)?
3. **B-6**:`isRateRejectStatus` 加否定前缀消解。
   - `not_cached_but_limited` 判 true 对吗?`rate_limited_not_cached` 呢?有没有更该覆盖的真实 status 形态?
4. **C-1**:`writeGateScriptAtomic` / `writeDataSurfaceAtomic` 在 rename 后重走 `restrictOwnerOnly`。
   - POSIX 上这是死代码还是有副作用?`restrictOwnerOnly` 在 win32 失败时会抛吗——抛了会不会让自愈路径整个炸掉?
5. **A-2**:`gateAssetsPresent` 现在会实连环回端口;`restartRequiredToArm` 由 `hadUsableIdentityBefore` 推出。
   - 自检里多做一次 TCP 连接有没有副作用(比如触发 daemon 的连接计数/日志洪水)?
   - `hadUsableIdentityBefore` 调用 `verifyClaudeIdentity` 会写 digest 缓存,对后续判定有影响吗?
6. **A-1/B-4 的回滚**:我把删掉的圈外预筛又加了回来,理由是「删掉会让圈外写永不 allow 只剩 daemon 单层,
   且要动受保护的既有 7 例」。**这个理由站得住吗?** 还是应该判为「为了不动测试而保留了已知错误」?
   请给出你的独立判断,不要迁就我的说法。

## 问题二:回修引入了什么新问题

`git diff 1d6680c..afd31b4 -- packages/` 独立扫一遍,报告新引入的 A/B/C 级问题。
特别看:`selfTest.ts` 的 `hadUsableIdentityBefore` 位置、`executor.ts` 的 `resolveClaim` 新增点、
`adapter.ts` 的引用函数、`claudeOutcome.ts` 的分词逻辑。

## 输出

- 问题一:6 条逐条判定 + 证据。
- 问题二:新问题清单(按 A/B/C 分级),没有就写「无」。
- 一句总裁决:`Go` / `修正后 Go` / `No-Go`,并说明**还差什么才能 Go**。

注:本批 W5.4-b **不宣称收口**(C3 未做、C1 的 init 断言未做),所以「Go」的判据是
「已落地的部分没有正确性/安全性缺陷,且未做的部分被如实登记」,不是「批次完成」。
不要复述代码,只写判断与证据。
