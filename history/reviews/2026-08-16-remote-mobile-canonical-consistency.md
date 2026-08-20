# 一致性评审 remote-mobile-w0(2026-08-16)

> 性质:实施期轻量「回写 canonical」的一致性 subagent。只读。不替代 Codex 74。
> 范围:09 M1 段 + 11 §5.6b/§5.8a vs 工作区实现。

## 终裁

**通过。** 无 A 级形状/安全冲突。

## 必核对齐

1. **白名单**  
   09 M1(`docs/09-data-contracts.md:1143`)列出 GET `attention` / `focuses` / `focuses/:id`、POST `first-run/query`，以及 2026-08-16 补录的 `recent-transcript`、`memory/recent`、`projects/:id/memory`；`GET /api/setup/probe` 不在名单。  
   `packages/daemon/src/net/mobileLan.ts:11-25` 与之逐条一致；`t2-thin.test.ts:187-196` 断言 probe 为 false。  
   `packages/daemon/src/index.ts:869-887`：`via=mobile_lan` 且不在白名单 → 403 `mobile_lan_route_rejected`。

2. **payload**  
   - `recent-transcript`：`packages/daemon/src/api/recentTranscript.ts` 确有 `sessionId`/`projectId`，转写原文 `speaker`/`text`，可选 `origin`/`turnId`/`ts`。  
   - `memory/recent`：`recentMemory.ts:35-44` 确有 `claim` 全文、`trust`/`source`/`taint`/`expiresAt`/`ts`。  
   - `projects/:id/memory`：`packages/daemon/src/api/console.ts:188-201` 同行形状。

3. **门控**  
   仅 `mobile_lan_route_rejected` → `remote-mobile`(`SetupBootstrapBoundary.tsx:12,26-28`)；`RemoteMobileShell` 直挂 `MobileApp`。  
   四码 `token_mismatch`/`origin_rejected`/`host_rejected`/`setup_local_only` 仍 `probe-error`。  
   `useMobileViewport` 只在 `AppContent`(`App.tsx:140-151`)。

4. **RFC1918**  
   `isRfc1918Ipv4` 与 `isPrivateLanHostname` 均为 `10/8`、`172.16–31/12`、`192.168/16`；`127` 与 `100.64` 都拒。

## 残留旧句

`docs/11-ui-spec.md` 未命中「LAN 不在本门范围」「只 Loading/降级」。

## C 级(不挡收口)

- `memory/recent` 合同未写封闭字段集,实现另带 `id`/`tier`;移动 UI `MobileMemoryRow` 不展示 `taint`(线上下发仍有)。
- RFC1918 谓词三处拷贝(pairing / identity / e2e global-setup),口径相同、未单源。
- 11 §5.6b 首句写 Boundary 之后切树,LAN 例外在同段后半、实现为 Boundary 内 `RemoteMobileShell`。

## Codex 74 后注

Finding 1(B)已吸收:`GET /api/projects/:id/memory` 合同改为显式 `id`/`tier`/`claim`/`trust`/`source`/`taint`/`expiresAt`(`claim` 全文、`taint` 数组,不含 `ts`),与 `packages/daemon/src/api/console.ts:187-201` 对齐。上表 payload 第 3 条「同行形状」自此不再自指。

## 结论

remote-mobile-w0 回写的 09/11 与工作区实现同口径,可以收口。
