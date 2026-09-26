# 官网改版零上下文评审记录(2026-09-17)

- 候选:分支 `site-redesign-20260917`,基 `c012c97bce12308e3e4500f66f342333f22b27e1`
- 冻结 ref:实现 `8086af1cd1a6ae1909de27f43d60de0062117911` → 回修 `a06613d6500d8ad2a7c231e7931dc4a9628f7d91` → 回修 `7d40e9d2449f10393247127347d92c8579dd6997`
- 评审树:detached worktree `SayDo-review-8086af1`(临时;`_review-ref/` 为两份设计稿只读副本,评审后清理)
- 候选指纹(派发前后一致):git-diff-v1 `e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727`(clean tree)
- reviewer 通道:本宿主 fresh-context 只读 subagent(评审预算 `~/.octoworkflow/v2-policy.json`,`reviewers_per_candidate=1`)
- 评审维度(固定清单 4 项):设计对齐 / 生产路由与双语正确性 / 事实边界(L3 口径) / 保留面与硬规则

## 轮 0 · 8086af1 → RED

| 严重度 | 位置 | 问题 |
|---|---|---|
| major | index.html:629, en/index.html 对应行 | 新首页缺 `id="faq"`,8 个保留子页 `/#faq`、`/en/#faq` 共 16 处链接锚点落空 |
| minor | en/quick-start/index.html 等 | 英文页 `data-internal` 链接指 `/`、`/#…`、`/quick-start/…`,JS 拼 query 后落回中文规范路径而非 `/en/` |
| minor(存量) | terms/support/privacy 正文 | 手机 QR 配对/LAN 加密表述与新页"移动开发中"口径不一致;非本次 diff 引入,另行排期 |

另记录 reviewer 诚实声明:只读无 exec,install 脚本与图标"未改动"只抽查未能字节级证实(后由实施者 `git diff --name-only c012c97..HEAD -- deploy/` 证实 deploy 树下仅 15 个预期文件变化,install.sh/install.ps1/_headers/图标零 diff)。

## 轮 1 · a06613d → GREEN(回修轮 1/3)

- 两首页 `<section class="boundaries section" id="faq">` 唯一落点;16 处子页链接全部有锚。
- `en/` 树 `data-internal` 残留根路径链接零命中;中文页 `/…` 路由未动;同页锚点、外链、`data-route-*` 无回归;无重复 id。

## 轮 2 · 7d40e9d → YELLOW(回修轮 2/3)

- 部署门禁 `availabilityState("available")` 要求四个官网文件各含恰好一次 rc.13 after 锚句;首页重写后缺失,已以不参与 `setLanguage` 替换的 `<span class="micro">` 恢复(index/en 各 1 次,FAQ-03 答案末尾)。
- minor(接受):锚句不随语言切换——门禁逐字匹配要求原文恰好一次,双语属性会致文件内出现两次,非切换元素是唯一满足形式;属门禁设计约束而非缺陷。

## 结论

候选 `7d40e9d` 评审通过(轮 0 RED → 回修两轮后无未决 blocker/major;两条 minor 一为门禁约束的有意取舍,一为存量文案待 owner 排期)。
