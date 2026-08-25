# RC4 发布线全新实施会话：只补 close/spawn 精确回归锁

你是新的 Grok 实施会话，不继承旧会话推理。当前 worktree 的产品实现已被独立 hostile probe 判 Go；原实施会话在第二次 readback 仍有一个 P2 测试合同缺口，按制度废弃。只基于当前代码、prompt 173 与下述可判定目标补测试，不重写已绿产品实现，不提交、不推送、不联网、不发布、不启动 subagent。

## 唯一缺口

`scripts/test-release-provenance.mjs` 的 claim/read/persist/lease close-failure 回归只断言“有 throw + sentinel 不泄漏”，未锁精确公共消息，也丢弃每个 `closeThrowIo()` 的 close 计数；spawn-throw 用例只断言 close=1，未断言 lower-level 通用失败与 sentinel 不泄漏。

## 精确验收

1. 公共入口表为每项声明并严格断言：
   - claim -> `部署证据路径非法`
   - read -> `既有部署证据读取失败`
   - persist -> `部署证据写入失败`
   - lease -> `部署证据租约已失效`
2. 每个入口必须保留自己唯一的 `closeThrowIo()` 实例，调用后断言 `closes() === 1`；不得在 closure 内临时创建后丢弃计数器。
3. 每项继续断言 message/stack 不含 close sentinel；原 evidence bytes 完全不变；claim 目标不存在；不能只断言 truthy throw。
4. 保存 spawn-throw 的 `runOpenatHelper()` 返回值并断言：`ok === false`、`error === "部署证据路径非法"`、close 恰好一次、结果 message/stack 不含唯一 spawn sentinel。
5. 先证明这些断言在旧测试中确实缺失；只改直接相关回归，不放宽 9/9/12/9、25/92/281、single-fd、nlink=0、short-write、zero-mutation 等现有断言。

## 门禁

- `node scripts/test-release-provenance.mjs` 连续 5 次，全部物理 exit 0、精确矩阵输出不变、无 portability warning。
- `node scripts/test-release-physical-evidence.mjs`。
- `pnpm typecheck`。
- `pnpm lint`。
- `node scripts/check-emoji.mjs`。
- `node scripts/check-doc-links.mjs`。
- `git diff --check`。
- `actionlint .github/workflows/ci.yml`。

只报告真实 diff、命令、exit 与断言证据。
