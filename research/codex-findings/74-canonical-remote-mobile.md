# 74 remote-mobile canonical 回写对抗审

> 日期：2026-08-16；HEAD：`3197fd8a2b60e4cd948ef2efe9e8fa3a7c5853ca`；只读核对工作区与 HEAD，未改文件、未启动额外评审层。

## 终裁

需回修后通过。

未发现 A 级合同冲突或安全旁路。必须修正一处 B 级合同措辞：

- [docs/09-data-contracts.md:1143](~/WorkSpace/SayDo/docs/09-data-contracts.md:1143) 中 `/api/projects/:id/memory` 的隐私边界漏记 `taint`，且“行形状同项目记忆”是自指，不能机械判定。

## Findings

1. B，项目记忆端点漏写 `taint` 暴露边界

   - 打哪一句：`GET /api/projects/:id/memory` 的“行形状同项目记忆,含 claim 全文”。
   - 证据：实现返回该项目 M1–M3 活跃投影，并明确包含完整 `claim`、`source`、`taint`、`expiresAt`；`taint` 缺失时仍投影为空数组。[console.ts:187](~/WorkSpace/SayDo/packages/daemon/src/api/console.ts:187)
   - 问题：合同没有声明该端点会把 `taint` 发到 LAN，且“同项目记忆”没有指向另一个可判定形状。不是实现冲突，但隐私边界不完整。
   - 最小改法：改为“返回该项目 M1–M3 活跃投影；行含 `id`/`tier`/`claim`/`trust`/`source`/`taint`/`expiresAt`，其中 `claim` 为全文、`taint` 为数组；不含 `ts`”。

## 09 vs 代码白名单对账

- [ok] `GET /api/sessions/recent-transcript`：HEAD allowlist 已放行；响应含 nullable `sessionId`/`projectId`，并原样投影 `speaker`/`text`，可选 `origin`/`turnId`/`ts`。[mobileLan.ts:11](~/WorkSpace/SayDo/packages/daemon/src/net/mobileLan.ts:11) [recentTranscript.ts:7](~/WorkSpace/SayDo/packages/daemon/src/api/recentTranscript.ts:7) [recentTranscript.ts:61](~/WorkSpace/SayDo/packages/daemon/src/api/recentTranscript.ts:61)

- [ok] `GET /api/memory/recent`：HEAD allowlist 已放行；响应确实包含 `claim` 全文和 `trust`/`source`/`taint`/`expiresAt`/`ts`。[recentMemory.ts:33](~/WorkSpace/SayDo/packages/daemon/src/api/recentMemory.ts:33)

- [fail] `GET /api/projects/:id/memory`：路径与实现一致，但 canonical 未明确记录响应中的 `taint`，见 Finding 1。[mobileLan.ts:21](~/WorkSpace/SayDo/packages/daemon/src/net/mobileLan.ts:21) [console.ts:193](~/WorkSpace/SayDo/packages/daemon/src/api/console.ts:193)

- [ok] `GET /api/setup/probe`：不在 `mobileLanApiAllowed` 中；LAN 路由守卫位于 probe handler 之前，返回 403 `mobile_lan_route_rejected`。[mobileLan.ts:11](~/WorkSpace/SayDo/packages/daemon/src/net/mobileLan.ts:11) [index.ts:868](~/WorkSpace/SayDo/packages/daemon/src/index.ts:868) [index.ts:988](~/WorkSpace/SayDo/packages/daemon/src/index.ts:988)

- [ok] `remote-mobile` 门：`SetupContext` 保留 daemon 原始 code；Boundary 只把精确 `mobile_lan_route_rejected` 映射为 `remote-mobile`，且该判断先于 peek/app。其余 code 均落 `probe-error`，四码名单没有漏放或多放。[SetupContext.tsx:78](~/WorkSpace/SayDo/packages/console/src/shell/SetupContext.tsx:78) [SetupBootstrapBoundary.tsx:25](~/WorkSpace/SayDo/packages/console/src/components/SetupBootstrapBoundary.tsx:25)

- [ok] “不改 allowlist 语义”：`git diff --exit-code HEAD --` 五个目标 daemon 文件返回 exit 0、无输出；三条 GET 均已存在于 HEAD。

- [ok] RFC1918 出码顺带核对：console 与 daemon 都只接受 `10/8`、`172.16/12`、`192.168/16`，范围一致。[pairing.ts:15](~/WorkSpace/SayDo/packages/console/src/lib/pairing.ts:15) [identity.ts:14](~/WorkSpace/SayDo/packages/daemon/src/net/identity.ts:14)

## 11 vs 代码门对账

- [ok] §5.6b 本机分树：`<768px` 或原生强制标志进入 `MobileApp`；本机宽屏遇移动 hash 时计算桌面目标并重定向。[useMobileViewport.ts:3](~/WorkSpace/SayDo/packages/console/src/mobile/useMobileViewport.ts:3) [App.tsx:140](~/WorkSpace/SayDo/packages/console/src/App.tsx:140)

- [ok] §5.6b LAN 宽屏：`RemoteMobileShell` 直接挂 `MobileApp`，不经过 `AppContent`、`useMobileViewport` 或桌面 `Layout`，因此宽屏不会落桌面。[SetupBootstrapBoundary.tsx:149](~/WorkSpace/SayDo/packages/console/src/components/SetupBootstrapBoundary.tsx:149) [SetupBootstrapBoundary.tsx:168](~/WorkSpace/SayDo/packages/console/src/components/SetupBootstrapBoundary.tsx:168)

- [ok] §5.8a：`remote-mobile` 不映射成 `app`，即使已 peek 也因判定顺序保持移动树；其余 probe 错误停错误卡。[SetupBootstrapBoundary.tsx:25](~/WorkSpace/SayDo/packages/console/src/components/SetupBootstrapBoundary.tsx:25) [SetupBootstrapBoundary.tsx:178](~/WorkSpace/SayDo/packages/console/src/components/SetupBootstrapBoundary.tsx:178)

- [ok] 与 09 无门形状冲突：两处都规定 probe 不开放、仅指定拒绝码进入移动树。

- [ok] 旧句已清理：针对“LAN 不在本门范围”“连接 Loading/降级”“只 Loading”的 `rg` 检索无命中，exit 1；现存相关表述仅位于 §5.6b、§5.8a 的新语义行。

## Triage(实施会话 2026-08-16)

终裁「需回修后通过」。A 级零。Finding 1(B)已吸收:`docs/09-data-contracts.md` M1 段 `GET /api/projects/:id/memory` 改为显式字段集(含 `taint` 数组,不含 `ts`),不再自指「行形状同项目记忆」。
