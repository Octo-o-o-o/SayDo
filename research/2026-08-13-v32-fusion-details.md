# v3.2 融合页细节六项施工报告

> 2026-08-13。分支 `feat/t20-fusion-layout`。对照
> `OctoAgent/docs/product/2026-08-13-向导快速配置UX重构方案-v1.md` 「v3.2 追加」。
> 未 push。未改 `apps/`、`docs/store`、启动链/validate、移动壳。47500 未碰。

## TL;DR

六项均已落地:文案清查(含孤立 `{`)、点击即全量列表、ack 对齐、全局单浮层、混搭快照卡退役覆盖确认。console vitest **25 files / 210 tests** 绿,`tsc --noEmit` 绿,`vite build` 绿。真浏览器六项交互未走完(见未做项)。

## Commit

| hash | 说明 |
|---|---|
| `d5ede352509713412feb7fe2c0643052e819fa67` | docs(11): 回写 v3.2 融合页细节合同 |
| `5b79cb78c49d8ae3f5960328acd19fc8f016378d` | feat(console): 向导文案清查,点击即全量列表,全局单浮层 |
| `af80b26fb0683f76c4ad7437fde75e632ba84591` | feat(console): 混搭快照卡退役覆盖确认,接线单浮层与 ack 对齐 |

`git log` 取自本会话,parent=`352ab93`。

## 门禁

```
pnpm --filter @saydo/console test
  Test Files  25 passed (25)
  Tests  210 passed (210)

pnpm --filter @saydo/console typecheck   # tsc --noEmit, exit 0
pnpm --filter @saydo/console build       # tsc --noEmit && vite build, exit 0
  dist/assets/index-CKh8js18.js  741.44 kB
scripts/check-emoji.sh <改动文本文件>    # [ok]
```

新单测:

- `comboFilterQuery` + 点击展开全量(已选 id 不筛掉其余项;inset 不另起浮层)
- `openFusionOverlay` 打开新浮层替换旧浮层
- `reduceMixAfterEdit` / `reduceMixAfterSelectHouse` / `reduceMixRestore`:编辑→快照,切家保留,点回恢复,全跟回解散
- PurposeZones / SupplyPicker 去标签后无孤立 `{`;向导首帧无覆盖确认框

## S1 文案对照

| 位置 | 改前 | 改后 |
|---|---|---|
| 检测进度行 | `正在清点这台机器能用的模型来源…（再核对一遍）` | `正在清点这台机器能用的模型来源…` |
| 槽行入口 | `换家 · {家名}` | `切换提供商` |
| 融合页导语 | `某一槽想换家,点槽行即可` | `某一槽想换提供商,点「切换提供商」即可` |
| claude/codex `note`(展示层) | `claude 没有列出全部模型的接口。下面是从本机记录里找到的:你用过的 N 个,加上官方别名——不是全集,别的模型直接填就行。` | `从你本机用过的记录里找到 N 个;其他模型名可直接填` |
| 换家 popover 导流句 | `想从列表里挑而不是手打的话,grok有 N 个模型可以搜。` | 整句删除 |
| ModelCombo 不可枚举 hint | `候选来自本机记录,不是全集——别的模型直接打进去就行` | `从你本机用过的记录里找到这些;其他模型名可直接填` |
| ModelCombo 可枚举 hint | `点输入框展开列表,或直接打字过滤` | `点输入框看全部,打字可筛选` |
| 列表空(不可枚举) | `候选里没有这个名字。要是你确定它可用,就这么填,保存后能用自检验证。` | `列表里没有这个名字。确定能用的话直接填即可` |
| 匹配行附加 | ` · 不在候选里也能用,直接保存即可` | ` · 不在列表里也能用` |
| CLI 卡可枚举 | `N 个模型可选(可搜索) · 保存后真实自检` | `N 个模型可搜` |
| CLI 卡不可枚举 | `没有完整模型列表,可留空用默认或自己填写 · 保存后真实自检` | `没有完整列表,可留空或直接填` |
| 探测占位 | `正在读登录态和可用模型` | `正在查看这家能不能用` |
| inventory 旁注 | `另识别到本机 X,尚未接入推理槽供给,暂不能选` | `本机还有 X,暂时还不能当模型来源` |
| API 端点说明 | `端点档:{via} · key 存入 {ENV}` | `这个地址的密钥会留在这台电脑,提交后不再显示` |
| 已存 key | `已检测到可复用 key;留空会沿用,不会回显原值。` | `已有可复用的密钥;留空会沿用,不会再显示原值。` |
| 设置页槽位提示 | `在向导里逐槽换家` | `在向导里逐槽切换提供商` |
| 切家确认框 | `覆盖这套混搭,四槽改用 X 预置?` | 退役;改左栏「我的混搭」卡 |

### 孤立 `{` 根因

owner 截图位在换家 popover **上方**。同位代码是槽行按钮

```
换家 · {supplyHouseLabel(supply)}
```

JSX 插值本身能编译;若家名为空、水合异常,或源码层花括号被当成文本,页面上就会留下孤立 `{`。同页 popover 内还有 `端点档:{deriveProviderViaName(...)}`,花括号与动态值贴在一起。

修复:按钮改为无插值的「切换提供商」;端点行改人话,不再输出 `{via}`/`{ENV}`;单测把 PurposeZones(popover 打开)与 SupplyPicker 去标签后断言不含 `{`。

daemon `cliCapability.ts` 的 note 原文未改(启动链/validate 零改动红线)。展示层用 `humanizeCapabilityNote` 覆盖,用户看不见内部腔。

## 逐项落点

| 项 | 状态 | 落点 |
|---|---|---|
| S1 文案清查 + `{` | 完成 | `setupCopy.ts`;`SetupWizard.tsx` 检测行/导语/按钮;`SupplyPicker.tsx` note/导流句/端点行;`ModelCombo.tsx` hint;`GlobalSettings.tsx` |
| S2 点击即全量列表 | 完成 | `ModelCombo.tsx` `comboFilterQuery`:未打字过滤词为空;列表 `max-height:320px` 内滚 |
| S3 ack 对齐 | 完成 | `.setup-ack-row`:checkbox `margin:0` + `align-items:center`;两行左缘同一 class |
| S4 全局单浮层 | 完成 | `setupOverlay.ts` + `SetupWizard` 单一 `overlay` 状态;打开模型下拉关换家,反之亦然;popover 内 `surface="inset"` 不另起浮层;Esc/点外关;`--z-setup-overlay:30` |
| S5 混搭快照卡 | 完成 | `reduceMixAfterEdit/SelectHouse/Restore`;左栏 `MixSnapshotCard`;切家直接 apply;全跟回解散;内存态不落盘;`data-overwrite-mix-confirm` 已删 |
| S6 校验 | 部分 | 单测/tsc/build 绿;真浏览器六项交互未走完 |

## 自验 daemon

- 47500:`node` pid `15089` 全程未杀未改。
- 47470:本会话起过隔离 `SAYDO_HOME=SayDo/.tmp/v32-47470` 的自验 daemon(先 `4162` 后 `7556`)。`curl /health` 与带 token 的 `/api/setup/probe` 通,dialog=`unarmed`。
- console vite `127.0.0.1:47120` 代理到 47470。
- Chrome headless 被沙箱拒(`Failed to create a unique user data directory` / `Operation not permitted`),无 browser MCP,故未做点击走查。

## 未做项

1. 真浏览器六项交互复验(选家/开列表/单浮层互斥/混搭卡切回/ack 对齐目视)。
2. daemon note 源字符串未改;只在 console 展示层人话化。
3. 未 push。
4. 未改启动链、validate、`apps/`、`docs/store`、移动壳。
5. 隔离 HOME `.tmp/v32-47470` 未入 Git;收工后应停 47470/47120,勿动 47500。
