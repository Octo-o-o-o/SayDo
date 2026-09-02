# SayDo 项目缺口治理 v7 最终对抗复查（fresh 220）

你是全新、零上下文、只读的最终实施就绪性审查者。不要改文件，不运行产品测试、构建、真实账号、
设备、connector、deploy 或网络访问，不创建 subagent。先读 `AGENTS.md`、`HANDOFF.md` 第 0 节、
当前 v7 program、D17 import spec、owner decisions、PLAN-2 当前入口，以及 219 report。

重点重验 219 的两条 A 是否按最小方式闭合：

1. dry-run rebuild 是否只在形成 I 前运行；I focused gate 是否从 committed I bytes 开始做 read-only
   validator/mutation，不能在 detached worktree 重写两份投影后假绿；Q0 `--write` 是否明确只是所有
   read-only I gates 之后生成的 E artifact；PG-02 回归是否排除这个 writer而不改绑历史 report identity。
2. PG-03 I focused gate 是否已删除 predecessor `week-audit --check-bundle`，同时通用代码批生命周期仍
   强制 E 前 writer、七项 actual subset、clean E `--check-bundle`，gate-manifest mutation 能证明 CI/
   release 控制流可达该 E 门。

随后用当前 bytes 快速复核 D17 的 28-path E exact-set、219 `[fail]` report 保留、220 pending report、
preexisting literal blob、I/review/E/恢复/future full-E-OID ff-only；确认 PG-01A–PG-06、五线覆盖、回报、
持续成本与防过度边界未回归。当前未实施、未跑产品测试、未来 SHA 未填、签署前 dirty 不算 finding。

只列有 `file:line`、可复现失败和最小修法的 finding。输出先给 `[pass]` 或 `[fail]`，最后严格给：

```text
A_open_exact_set={...}
B_open_exact_set={...}
C_open_exact_set={...}
D17_SEMANTIC_FREEZE_READY=yes|no
D17_READY_AFTER_MECHANICAL_FINALIZATION=yes|no
owner_now_must_provide_exact_set={...}
OVERDESIGN_REGRESSION=no|yes
```

列出实际只读命令、静态门与未运行项。不要生成签署 SHA。
