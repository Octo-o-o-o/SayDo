# 71 阶段缺口分析对抗审

> 日期：2026-08-13（当前运行环境）  
> 目标文件：`/Users/wangyixiao/WorkSpace/SayDo/docs/review/2026-08-14-saydo-phase-gap-analysis.md`  
> HEAD：无法取得  
> 范围：只读；未运行 lint、测试，也未修改仓库文件

## 终裁

不可接受，但原因首先是本轮证据链未建立，而不是已经证明目标文档的数字全部错误。

本轮对 `git rev-parse HEAD`、目标文档 `nl -ba`、`git status` 和材料 `rg` 的实际调用均返回：

```text
sandbox-exec: sandbox_apply: Operation not permitted
```

因此无法取得目标文档行号、HEAD、上游 ref、journal、8 月 review、store status 或原始日志。按照 grounding 规则，不能把“11 条未 push、268/257、lint 8 errors、Playwright 29/3、runtime=ada7981c”等写成已复核事实。

在可收口前，至少必须：

1. 将全部硬数字绑定到同一 HEAD、同一时间点和明确的 ref。
2. 把“提交计数差异”与“ff-only 违规”分开。
3. 把 B0 改为条件式结论，除非有 ancestry/推送失败证据。
4. 在施工前加入证据快照、owner 决策和外部解锁检查。
5. 显式补审 dogfood 价值轨道、商店具体阻断和评审吞吐成本。

## Findings

### F-01：A 级，§6 的全部硬主张目前不可审计

打文档哪一句：`§6 证据锚`中的各硬数字和硬主张；本轮无法读取原文，故不伪造行号。

证据：

```text
$ git rev-parse HEAD
sandbox-exec: sandbox_apply: Operation not permitted

$ nl -ba /Users/wangyixiao/WorkSpace/SayDo/docs/review/2026-08-14-saydo-phase-gap-analysis.md | sed -n '1,260p'
sandbox-exec: sandbox_apply: Operation not permitted

$ git status --short --branch
sandbox-exec: sandbox_apply: Operation not permitted

$ rg -n 'R6[2-9]|B0|行动序|ff-only|268|257|dogfood|外部|评审' ...
sandbox-exec: sandbox_apply: Operation not permitted
```

对结论的含义：当前不能判定任一数字为真，也不能判定任一数字为假。目标文档不应以“已复核”语气收口。

### F-02：B 级，11 条未 push 不能直接等同于发布阻断或 ff-only 失败

打文档哪一句：若 §6 将“11 条未 push”直接写成 ff-only 纪律失败或发布不可行。

证据：同上 E0；HEAD、upstream 和 ahead/behind 计数均未取得。

必须核对：

```text
git status --short --branch
git rev-list --left-right --count @{upstream}...HEAD
git rev-list --count @{upstream}..HEAD
git merge-base --is-ancestor @{upstream} HEAD
```

对结论的含义：

- ahead 11 只表示相对某个 upstream 有 11 个本地提交，不表示已经分叉。
- ff-only 约束的是目标 ref 与源 ref 的祖先关系；提交数本身不证明违反。
- upstream 缺失、ref 选错或工作树有未跟踪文件时，“11 条未 push”可能只是口径错误。

### F-03：B 级，268/257 的“分叉”解释证据不足

打文档哪一句：若 §6 把 268 和 257 的差异直接称为“分叉”“两条开发线”或“ff-only 冲突”。

证据：无法读取文档或 git 拓扑；上述命令均被 sandbox 拒绝。

必须明确：

```text
git rev-list --left-right --count <base>...HEAD
git log --graph --decorate --oneline --all
git merge-base <base> HEAD
```

对结论的含义：268/257 可能是总提交数、不同基线的计数、左右两侧 ahead/behind，或迁移前后的不同历史。没有 ref 名称和左右顺序，不能推出分叉，更不能推出 ff-only 失败。

### F-04：B 级，lint、emoji、Playwright 和场次状态可能存在时间点或分母混用

打文档哪一句：§6 中以下表述若未绑定日志和 HEAD：

- “lint 8 errors”
- “HEAD 版 emoji 门禁红，命中 icns”
- “Playwright 29/3”
- “场次① failed”

证据：无法读取日志目录或目标文档；`rg` 调用直接失败。

对结论的含义：

- lint 数字必须来自对应 HEAD 的原始输出，不能拿历史日志。
- `icns` 命中可能是二进制扫描误报；“命中路径”不等于源代码含有 emoji。
- Playwright 的 29/3 必须说明分子、分母、失败与跳过的定义，以及是否为同一场次。
- 场次①的 `failed` 必须有审计事件、时间戳和重跑关系；不能以一次失败覆盖后续状态。

### F-05：B 级，runtime、HANDOFF、T 系列和 tag 断言都需要范围限定

打文档哪一句：若 §6 使用以下绝对语气：

- “runtime=ada7981c”
- “HANDOFF 末次提交为 97b01f7”
- “T 系列没有排产文件”
- “v0.1.0 未打”

证据：无法读取健康接口、git log、文件树或 tags。

必须分别核对：

```text
git show -s --format='%H %ad %s' 97b01f7
rg --files | rg '(^|/)[Tt].*(plan|schedule|排产)|T[0-9]'
git tag --list 'v0.1.0'
git ls-remote --tags origin 'refs/tags/v0.1.0'
```

对结论的含义：

- runtime 字符串不等于当前健康进程实际运行版本。
- HANDOFF 文件中的自述提交不等于该文件最后一次 git 修改提交。
- 仓内没有匹配文件，不等于仓外或不同命名下没有排产。
- 本地没有 tag，不等于远端没有 tag，也不等于发布合同必需该 tag。

## 对 B0 的专项裁决

ff-only 发布纪律与 268/257 分叉的解读，当前不能判为正确。

正确的逻辑应是：

```text
提交数量差异
  ≠
拓扑分叉
  ≠
ff-only 失败
  ≠
发布不可行
```

只有在明确 base/ref、确认 `merge-base` 非祖先关系，或有实际 push 被 `non-fast-forward` 拒绝时，才能把它提升为发布阻断。

B0 是否配得上“最核心”：

- 默认不配。单纯的本地提交卫生问题通常低于 Gate 0、安全/契约阻断、外部商店解锁和真实 dogfood 价值证据。
- 若证据证明 canonical 源已经分裂、无法确定可发布真相，B0 可以升为 P0。
- 在证据缺失时，B0 应写成“待核验的源拓扑风险”，不能写成既成事实。

更值得优先审查的候选问题：

1. Gate 0、安全和数据契约是否真正可发布。
2. 商店提交的外部依赖是否已解锁。
3. dogfood 是否产生真实用户价值证据，而不只是工程门禁。
4. owner 尚未决策的范围、平台和验收标准。
5. 评审与证据流程是否已经压低迭代吞吐。

这些排序属于 C 级价值判断，最终需 owner 拍板；但把 B0 无条件列为第一核心问题是不充分的。

## 对行动序的专项裁决

由于无法读取目标文档的 1-5 原句，不能逐项判定其原顺序。可接受的依赖顺序应接近：

1. 只读建立证据快照：HEAD、upstream、拓扑、日志时间点、当前外部状态。
2. 取得 owner 对范围、发布目标和验收标准的决策，并记录外部解锁项。
3. 只有在 B0 被拓扑证据证实时，才处理同步、推送或迁移。
4. 再施工 B2；若 B2 与 owner 决策正交且低风险，可并行，但必须证明不会改变范围或造成返工。
5. 运行规定的验证、dogfood 和商店提交证据，形成可验收的 release 状态。

潜在错误处方：

- 在 owner 两问未答时直接大规模施工 B2，可能因范围改变而返工。
- 先修提交拓扑，再发现真正阻断来自商店、Gate 0 或 dogfood，属于排序失真。
- 把一次失败场次或历史 lint 日志当作当前阶段判定。
- 只安排内部工程修复，不安排外部解锁和用户价值验证。

## 证伪

本轮没有取得任何目标文档行号，因此不能列出“已被命令直接推翻”的句子。以下句式只能列为待证伪，不应当作为已证伪事实：

- “268/257 直接证明 ff-only 违规。”
- “11 条未 push 直接证明不能发布。”
- “icns 命中直接证明仓库含 emoji。”
- “Playwright 29/3 直接代表当前通过率或失败率。”
- “runtime=ada7981c 直接证明 HEAD 对应运行时。”
- “HANDOFF 中的 97b01f7 直接等于文件末次提交。”
- “仓内没有 T 系列文件直接证明没有排产。”
- “本地没有 v0.1.0 tag 直接证明远端也未打 tag。”

当前唯一可以确定的事实是：本轮只读执行接口无法读取仓库，故该分析尚未达到可接受的对抗复核证据标准。