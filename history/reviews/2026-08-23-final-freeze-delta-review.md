# 2026-08-23 最终冻结差量复审

## 坐标与隔离

- 复审候选:`81760a4497778fbb9c16b249908cb852ce4c1e89`。
- 最终实施边界:`3e74a5a6a4e5c187688c157309989737bf9af947`；其后的提交只承载评审、范围参数与生成证据。
- 两路评审使用各自零上下文独立会话,均只读；没有读取实施方的施工推理。

## 运行时复审

`final_runtime_review` 对 F95–F97 逐条判定 `CONFIRMED_FIXED`,最终 Go,未发现新增 P0/P1:

1. review finalization 存在时停机不再写 restart marker；历史双 marker 在恢复时先清 restart、只做 settle。
2. adapter mismatch 已前移到 workspace 检查之前,双向缺 worktree 均 blocked 且 spawn=0。
3. 未绑定 finalization 的旧 durable result fail-closed,任何新 spawn 前再次清旧终态,成本不跨代。

独立门禁:聚焦反例 8 passed/96 skipped；daemon 1883 passed/5 skipped；typecheck、`git diff --check`
均退出 0。盲区:真实供应商 CLI 恢复未跑,完整套件 5 项 live 测试仍 skipped。

## 发布复审

`final_release_review` 确认直接实体门、OpenSSH/PowerShell 固定入口、private probe 固定锚、CI 最小权限、
Release exact readback/失败回退和发布顺序均为 `CONFIRMED_FIXED`,未发现新增 P0。唯一 P1 是生成证据仍停在
旧边界:旧 `--check`/`--check-bundle` 均退出 1,publication/integrity schema 与当前脚本不一致。

处置:将 `scripts/week-audit.mjs` 的 implementation boundary 固定到 `3e74a5a`,重生 schema 2/6 全量
bundle。内部完整树 `node scripts/week-audit.mjs --check` 已退出 0；公开过滤树 `--check-bundle` 必须在
证据提交后另跑,内部树因含明确排除的软著材料会按设计拒绝该模式。

## 外部 Codex 边界

外部 Codex 108 与全新 session 112 均未产出 final。108 日志 1893732 bytes、SHA-256
`7669f8311c5adb809827b3f2b4716f855b8ef10d3d68a7e7b68acad6d3e2079f`;112 在 1200 秒守卫下 exit 124,
日志 1469747 bytes、SHA-256 `bbf09c2f6d8b04d71bf87ab2748444f694e365ee448731f7e44015fcc1b51344`。
两者 `turn.completed=0`,不能伪写 Codex 通过结论。
