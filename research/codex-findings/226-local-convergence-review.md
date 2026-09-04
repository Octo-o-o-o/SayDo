# SayDo 本地遗留工作收敛独立复审报告

> 归档来源：本文件由 `<supervisor-control>/review-1-replacement.md` 脱敏入库。原始报告 12,781 bytes，raw SHA-256 `52b98619e334fa779a31022c39f7a08ae4ad49c290ce2c65ad610daf0ab62414`。入库副本删除本机绝对路径，仓库路径改为相对路径，旧 clone 写作 `<legacy-clone>`，监督目录写作 `<supervisor-control>`，并去除行尾空白；因此本文件 digest 与原始 raw SHA 不同。verdict、manifest、证据值与两条 P2 delta 未改写。

> task=`saydo-local-convergence`
> stage=`pending-local-work`
> cycle=`initial`
> review ordinal=`1`
> review scope=`workflow-final`
> verdict=`GREEN`

## 结论

当前 candidate 没有可达的 P0/P1，七项 focused gate 均为 exit 0。验收台账为 3 项 `[ok]`、1 项 `[warn]`、1 项合理 `[divergent]`。

发现两项非阻断 P2：

- 旧 clone 的 occurrence-selector sibling 加固仅适用于已经退役的 selector grammar。
- Tailcat 能力表的 A/B/C 机械计数与摘要不一致。

`just ci` 与 Playwright 尚未在本 reviewer 会话运行；按 `full_gate_timing=after_semantic_review_green`，保存报告并验证 manifest 后应由 supervisor 进入完整门禁。本会话没有修改仓库。

## 冻结对象核验

| 项目 | 实际结果 |
|---|---|
| branch | `codex/local-convergence-20260904` |
| HEAD | `5cf1cabb2feea2508a4724082a408c7b734e81e2` |
| subject | `fix(local-convergence): 入库 Tailcat 评估并加固安装脚本自测` |
| parent | `a4f1a0618fdbb7c4a8eb7178429cd9b08a8b92d8` |
| candidate tree | `79748f2da3bab36a34cb27b08c1b0452653ba111` |
| parent tree | `627bc53f8b7258ba5e56534fc8d4141126b32cac` |
| commit count | `1` |
| git-diff-v1 | `e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727` |
| handoff validator | `status="valid"`，无 contract/risk violation |
| working tree | tracked diff、index、porcelain 均为空 |

提交 exact path 为：

- `docs/plan/2026-09-03-tailcat-borrowing-assessment.fable.md`
- `docs/plan/README.md`
- `scripts/test-install-scripts.mjs`

没有越出五路径白名单。`scripts/check-active-claims.mjs` 与 `scripts/test-active-claims.mjs` 未改，parent/HEAD blob 分别保持 `de9e303...` 与 `0d6d423...`。

## 验收台账

| acceptance | 状态 | 独立证据与判断 |
|---|---|---|
| `LC-GIT-FREEZE` | `[ok]` | HEAD、唯一 parent、tree、fingerprint 全匹配；工作树干净。 |
| `LC-SCOPE` | `[divergent]` | handoff 字面五路径中实际只改三路径，但无越界路径；未改的两项正是不可达的旧 scanner grammar。依据本次明确的可达性约束，这是合理偏离，不构成验收失败。 |
| `LC-TAILCAT-DOC` | `[warn]` | 核心结论、现状和安全边界通过；存在一项计数 P2。 |
| `LC-QUICKSTART-MUTATIONS` | `[ok]` | 三项 mutation 均真实命中唯一输入、改变内容并触发对应 checker 错误；原 18 项与动态无写入检查未削弱。 |
| `LC-PG01A-SCANNER` | `[ok]` | 完成旧 clone 对账；旧补丁不可从现役 checker、正式入口或声明 grammar 到达，因此没有应移植的 P0/P1 修复。 |

## Tailcat 文档复核

[Tailcat 评估](docs/plan/2026-09-03-tailcat-borrowing-assessment.fable.md:6)明确声明“不 supersede D13”，并把本轮限定为零代码评估；未来 sidecar/spike 均写成 owner 决策后的候选，没有伪装为现状。

本地对账结果：

- T2 继续使用 Tailscale、T3 使用 LAN WS 加自建密文中继和 Noise XX，分别与[架构 §7](docs/03-architecture.md:147)及[D13](docs/07-tech-stack-decisions.md:164)一致。
- 远程封顶 S2、S3 仅本机受信终端，与[09 合法组合矩阵](docs/09-data-contracts.md:322)、[assertS3LocalAndBound 合同](docs/09-data-contracts.md:393)和[守卫实现](packages/daemon/src/net/s3Guard.ts:27)一致。
- `identity.ts` 仅在真实 peer 为 loopback 时赋予 `via="local"`；因此文档提出“用户态转发不能继承本机面”的未来安全约束成立。
- T2 手机烟测、T19 与 tailnet 的现状表述与当前 `HANDOFF.md` 一致。
- 程序化扫描未发现 `/Users/...`、`/home/...` 或 Windows 本机绝对路径。

P2：第 19 行声明 `A×1/B×8/C×21`，但第 37–66 行的 30 条表格实际为 `A=0/B=8/C=22`。核心裁决不受影响，但台账不自洽。

## 安装测试复核

[安装自测](scripts/test-install-scripts.mjs:69)只新增三条不变量及对应 mutation：

| mutation | 输入命中 | 改值 | checker 结果 |
|---|---:|---:|---|
| PowerShell `$insideUserDir=false` | 1 | true | 判红，命中“用户目录约束默认不成立” |
| PowerShell 目录分隔符边界 | 1 | true | 判红，命中“前缀比较含目录分隔符边界” |
| fish PATH 写入 | 1 | true | 判红，命中“fish PATH 写入” |

独立内存探针同时得到：

- baseline checker error count=`0`
- parent mutation count=`18`
- candidate mutation count=`21`
- 原 18 个 label 全保留，原 mutation block 改动数=`0`
- dynamic no-write 区段与 parent 字节一致
- 净新增 `fromCharCode`、`eslint-disable`、`@ts-ignore`、`.skip`、`.only` 命中数=`0`

产品 installer 没有变化：`install.sh` 和 `install.ps1` 的 parent/HEAD blob 完全一致；两份脚本均保留 `SAYDO_INSTALL_ALLOW_OUTSIDE_HOME`，实际实现见 [install.sh](deploy/saydo-octoooo-com/install.sh:36)与[install.ps1](deploy/saydo-octoooo-com/install.ps1:33)。

## 旧 scanner 对账

旧 clone 状态只有两项 dirty：

- `M scripts/check-active-claims.mjs`
- `M scripts/test-active-claims.mjs`

旧 dirty patch 为 checker `+229/-28`、测试 `+452/-0`，集中加固 TypeScript/TSX 注释消隐、return type、generic arrow，以及 generic-arrow 前缀后的 sibling `export` 定位。旧实现自身声明使用 145×7 occurrence ledger 和 selector 字段；相关 sibling 反例见[旧测试](<legacy-clone>/scripts/test-active-claims.mjs:3637)。

现役 checker 的正式形状不同：

- [现役 checker](scripts/check-active-claims.mjs:12)维护 required roots 和 forbidden patterns。
- [实际扫描路径](scripts/check-active-claims.mjs:130)直接扫描完整文件 surface。
- `OCCURRENCES`、`parseSelector`、`applySelector`、`elideTsComments` 在现役文件中的命中数均为 0。
- `package.json`、Justfile、CI 和 release workflow 均调用这份现役 checker。
- 独立内存探针把 nested generic-arrow 放在 sibling export 前，后者含禁用声明时仍命中 `zero-extra-cost`。

因此旧 sibling 缺陷无法影响当前正式入口。按 V2.4.2 价值边界，它不是 P0/P1；不得整文件覆盖现役 checker，记为 deferred P2。

## 门禁证据复核

[supervisor log](<supervisor-control>/focused-supervisor.log:1)为 2,189 字节，独立重算 SHA-256：

`2d1a561b1740d8da544c7bc32da9b4c6156c7c1c70e6942271f9c452006e2c6a`

它与指定值及 [summary](<supervisor-control>/focused-supervisor.summary.json:1)中的 `log_sha256` 完全一致。summary 自身 SHA-256 为：

`46c3bab553568be89ec01dc0cca8cfa18dfc664c9241e5a98d648d07069acc47`

summary 顶层为 `status="completed"`、`reason="exit"`、`error_type=null`、`exit_code=0`。

| 原 focused gate | supervisor 日志 | 本会话复核 | exit |
|---|---|---|---:|
| `node scripts/test-install-scripts.mjs` | 第 1 行：`mutations=21 all red; dynamic no-write checks=6` | 按约束未重跑 mkdtemp suite；三项新增 mutation 以纯内存探针复核 | 0 |
| `node scripts/check-public-tree-privacy.mjs --fs` | 第 2 行：`hits=0` | 独立静态复跑同值 | 0 |
| `node scripts/check-active-claims.mjs` | 第 3 行：`roots=33` | 独立静态复跑同值 | 0 |
| `node scripts/test-active-claims.mjs` | 第 37 行：`33 passed` | 按约束未重跑 mkdtemp suite | 0 |
| `bash scripts/check-emoji.sh` | 第 38 行：`clean` | 独立静态复跑同值 | 0 |
| `node scripts/check-doc-links.mjs` | 第 39 行：`files=138 broken=0` | 独立静态复跑同值 | 0 |
| `git diff --check` | 成功时静默；整体 summary exit 0 | 独立复跑 exit 0，并输出本会话 probe 尾行 | 0 |

一次内存探针最初因 shell here-document 需要临时文件而被只读环境拒绝；随后改为纯 `node -e` 输入并通过。该失败未运行产品 suite、未写仓库，也不是产品 RED。

## P0/P1 与返工

P0：无。
P1：无。
blockers：空。

没有产品返工项。manifest 载荷经本地 validator 内存校验得到 `errors=[]`、`next_action="full_gate"`。保存报告后仍需 supervisor 按冻结 acceptance 运行一次 `just ci` 与 Playwright；本报告不宣称这两项已经通过。

## Deferred P2 ledger delta

当前唯一 ledger 为“当前无条目”。本轮新增两项，因 reviewer 全只读均标记 `deferred`：

1. `LC-P2-OBSOLETE-SCANNER-SIBLING`

   - first_seen_candidate：`5cf1cabb2feea2508a4724082a408c7b734e81e2`
   - location：旧 clone `scripts/test-active-claims.mjs:3637-3732`；现役 `scripts/check-active-claims.mjs:130-147`
   - impact：现役正式路径不可达；仅未来重新引入 selector grammar 时可能漏检
   - resolution：不得整文件移植；只有重新引入 occurrence-selector 时才连同 sibling/TSX 反例吸收

2. `LC-P2-TAILCAT-COUNT`

   - first_seen_candidate：`5cf1cabb2feea2508a4724082a408c7b734e81e2`
   - location：`docs/plan/2026-09-03-tailcat-borrowing-assessment.fable.md:19,37-66`
   - impact：评估台账计数不自洽，核心 D13/T2/T3/S3 结论不受影响
   - resolution：对齐表格与摘要，并明确 A1 是表内裁决还是表外衍生安全动作

```review-manifest
{
  "verdict": "GREEN",
  "review_ordinal": 1,
  "candidate_head": "5cf1cabb2feea2508a4724082a408c7b734e81e2",
  "diff_fingerprint": "e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727",
  "review_scope": "workflow-final",
  "blockers": [],
  "p2_ledger_delta": [
    {
      "id": "LC-P2-OBSOLETE-SCANNER-SIBLING",
      "first_seen_candidate": "5cf1cabb2feea2508a4724082a408c7b734e81e2",
      "location": "<legacy-clone>/scripts/test-active-claims.mjs:3637-3732; scripts/check-active-claims.mjs:130-147",
      "evidence": "旧 dirty patch 加固 occurrence-selector 在 TSX generic-arrow 前缀后的 sibling export 定位；现役 checker 无 OCCURRENCES/parseSelector/applySelector/elideTsComments，整文件扫描内存探针仍命中 zero-extra-cost。",
      "impact": "现役 canonical 与正式入口不可达；仅在未来恢复旧 selector grammar 时可能产生漏检。",
      "status": "deferred",
      "last_validated_candidate": "5cf1cabb2feea2508a4724082a408c7b734e81e2",
      "resolution": "不得整文件移植；仅在重新引入 occurrence-selector grammar 时连同相应 sibling/TSX 反例一起吸收。"
    },
    {
      "id": "LC-P2-TAILCAT-COUNT",
      "first_seen_candidate": "5cf1cabb2feea2508a4724082a408c7b734e81e2",
      "location": "docs/plan/2026-09-03-tailcat-borrowing-assessment.fable.md:19,37-66",
      "evidence": "30 行能力表机械计数为 A=0/B=8/C=22，摘要写成 A=1/B=8/C=21。",
      "impact": "评估台账计数不自洽，但 D13、T2/T3 与 S3 安全结论不受影响。",
      "status": "deferred",
      "last_validated_candidate": "5cf1cabb2feea2508a4724082a408c7b734e81e2",
      "resolution": "在唯一 final P2 批中对齐表格与摘要，并明确 A1 是表内裁决还是表外衍生安全动作。"
    }
  ],
  "focused_gates": [
    {
      "name": "install-script-mutations",
      "exit_code": 0,
      "summary": "supervisor log 第 1 行：21 mutations all red，dynamic no-write checks=6；三条新增 mutation 内存探针均真实改值并命中预期错误。"
    },
    {
      "name": "public-tree-privacy-fs",
      "exit_code": 0,
      "summary": "supervisor log 第 2 行 hits=0；本会话静态复跑 exit 0。"
    },
    {
      "name": "active-claims",
      "exit_code": 0,
      "summary": "supervisor log 第 3 行 roots=33；本会话静态复跑 exit 0。"
    },
    {
      "name": "active-claims-mutations",
      "exit_code": 0,
      "summary": "supervisor log 第 37 行：33 passed；按只读约束未重跑 mkdtemp suite。"
    },
    {
      "name": "emoji-gate",
      "exit_code": 0,
      "summary": "supervisor log 第 38 行 clean；本会话静态复跑 exit 0。"
    },
    {
      "name": "active-doc-links",
      "exit_code": 0,
      "summary": "supervisor log 第 39 行 files=138 broken=0；本会话静态复跑 exit 0。"
    },
    {
      "name": "git-diff-check",
      "exit_code": 0,
      "summary": "成功时静默；supervisor 汇总 exit 0，且本会话独立静态复跑 exit 0。"
    }
  ],
  "stop_reason": null
}
```
