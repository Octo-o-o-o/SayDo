# 2026-08-22 最近一周全量双向对账与快速启动发布方案

> 本轮是 `docs/review/2026-08-22-week-crosscheck.md` 之后的新一轮复审与发布，
> 不覆盖前一份报告的历史结论；新报告须明确引用并校正其收口后再次产生的漂移。
> 时间窗固定为北京时间 `2026-08-15 00:00:00` 至本轮冻结提交。

## 1. 目标与边界

1. 对时间窗内的全部提交和全部被触及文档建立两张可复现台账：
   `文档 -> 提交/实现/测试` 与 `提交 -> 文档/合同/测试`，不得抽样。
2. 对可判定的错误、疏漏和不一致直接修复；合同与实现冲突时，先按
   `docs/09-data-contracts.md` 判断方向。涉及战略、商业或合同新语义时停止并上浮 owner。
3. 清偿前一轮已确认且仍未完成的 W5.4-b C3、C1 init 物理断言与跨平台话术欠账。
4. 把已经存在的 `@saydo/cli` 可分发运行时落成 GitHub Release 预发布包，让
   macOS、Windows、Linux 用户在不克隆源码的前提下用一条相同命令启动 daemon + console。
5. npm registry 发布不在本轮自动执行；待 owner 后续手动发布。移动壳仍是开发通道评估壳，
   本轮真机安装不得改写为已上架或生产配对完成。
6. `v0.1.0` 仍受四场真人验收门约束。本轮只能发布新的不可移动预发布标签
   `v0.1.0-rc.2`，不得把预发布写成正式首发。

## 2. 冻结基线

- 截止前基线：`8a8247a347238b6bf6ad649f1162f1934540eafd`。
- 开工 HEAD：`3fccf4a704ad9a5d8e013baaefb67c66a5737cba`。
- 主线时间窗提交：115；事后清单所记录 ref 的时间窗提交：131。额外 16 个必须逐条判定为公开快照、
  已移植分支或真实未合并提交，不能仅凭无共同祖先判成漏合并。
- 基线至开工 HEAD：434 个路径，其中 Markdown 154 份、文档型资产 219 份。
- 开工时本地 worktree 只有主树，本地分支只有 `main`；当前施工分支为
  `codex/week-audit-faststart-20260822`。

以上数字须在最终报告用本会话真实命令重取；若冻结提交变化，台账生成器必须记录
`range_end`，不能静默把新提交混进旧基线。

## 3. 分阶段验收标准

### A. 全量双向台账

- 生成可复现的清单脚本，输出中必须恰好覆盖冻结范围内 115 个主线提交、已记录 ref 宇宙中的
  额外提交、154 份 Markdown 与其余文档型资产；重复 snapshot 要显示对应关系，不能重复算成功能实现。
- 本轮 ref manifest 在冻结时刻之后补录，只证明已记录 ref tip 的可重建集合，不能据此断言冻结时不存在
  后续删除或强制移动的 ref。脚本仍须拒绝提交时间晚于冻结上界的 tip。今后每次 freeze 必须先原子持久化
  本地 `for-each-ref` 与各 remote `ls-remote` 的完整输出、采集时间和 SHA-256，再以该原始清单生成 manifest；
  必要时用 reflog 或 GitHub ref event 辅证。公开 bundle 另记录 history digest、公开 tree 过滤证明与预期不可移动 tag。
- 每个提交行至少含 SHA、时间、主题、代码路径、文档路径、对应计划/机械证据与 finding 链接。
- 每个文档行至少含路径、触及它的提交、关联代码/发布资产、状态、机械证据与 finding 链接；纯 prompt、历史报告、
  原始证据可标为档案，但仍必须出现。机械生成器不得产出逐项人工正确性裁决；空 finding 不等于判绿。
- 运行仓内相对链接、过期 SHA/版本/状态词、官网中英文口径、计划现时态与实现锚检查；
  报告分节落 `docs/review/`，不得只在聊天给摘要。

门禁：

```sh
node scripts/week-audit.mjs --check
node scripts/week-audit.mjs --write
node scripts/check-doc-links.mjs
git diff --check
bash scripts/check-emoji.sh
```

### B. W5.4-b 欠账清偿

- C1：Tier1 自检真实发起一次有界、只读、单 turn 的 `claude -p` 探针并解析
  `system/init`；校验 adapter、版本、`apiKeySource=none`、模型族和身份登记，超时或异常 fail-closed。
- C3：设置页展示 Tier1 后端、模型、版本、登录态、自检和五小时窗观测；任务详情展示
  adapter 与 observed model；文件工具 S2、限流、登录过期、身份漂移和 max-turns 使用人话；
  认证话术按平台写“本机认证”，不得硬编码 Touch ID；backend prompt 不允许 Claude 改
  `.claude/`。
- 对应单测与至少两条定向 Playwright 均通过；`docs/10`、`docs/11` 只回写已经落地并验证的形状。

门禁：

```sh
pnpm --filter @saydo/daemon test -- tier1-self-test tier1-executor tier1-claude-backend
pnpm --filter @saydo/console test
pnpm exec playwright test e2e/console --grep "Tier1|observed model|本机认证"
```

### C. 无源码快速启动与发布资产

- `@saydo/cli` 版本、build identity、包名与预发布标签一致；`better-sqlite3` 与 `koffi` 两个
  native external 必须从安装后的 tarball 真加载；tarball 只含运行所需文件、
  README、LICENSE、NOTICE、THIRD_PARTY_NOTICES 与 npm package.json，不含源码树、秘密或私有归档。
- 产出版本固定的 npm tarball 与 `SHA256SUMS`，并在 GitHub Release 作为 prerelease 发布。
- GitHub Release 必须走 draft→上传三项 exact-set→非空校验→以 `UNAVAILABLE - PENDING SMOKE`
  标题和置顶警示发布→immutable 校验；发布后 fixed-URL smoke 六项全绿才把 title/notes 改为可用态。
  任一 smoke 失败则把 pending 改成明确 unavailable，保留不可变 tag/asset 作为证据，不删除后复用同名 tag。
  GitHub immutable release 只允许发布后改 title/notes，本流程不得改 tag 或 asset；`run_attempt>1` 永久拒绝
  available，post-release gate 也从 Actions REST readback 同一 attempt，失败 job 重跑不得抹掉 unavailable。
- available title/body 写入后必须精确读回冻结 release notes；读回失败由退出 trap 重试回退到 unavailable，
  post-release gate 不接受仅凭“不含 fail 字样”的近似状态。CI 默认 token 只授予 `contents:read`，只有发布写步骤升权。
- 所有公开快照的隐私探针必须来自 Git common dir 下固定 owner-only、非 symlink 文件；拒绝环境变量换锚。
- 官网中英首页、Docs、README 与内容稿给出两条路径：
  1. 一次运行：`npm exec --yes --package=<固定 release tarball URL> -- saydo up`；
  2. 常用安装：`npm install --global <固定 release tarball URL>` 后 `saydo up`。
- 文案明确：该包启动 daemon + console；语音 pipeline、macOS launchd 常驻和开发改源码仍走源码安装；
  Windows/Linux 当前前台运行，不冒充系统服务安装已经落地。
- CI 增加 Windows 分发验收；Linux 分发验收与现有 Ubuntu 门并存。六个 fixed-URL job 都从线上字节验证
  metadata/checksum、`/health`、受保护 desktop summary、console HTML、重复 `up` attach、优雅停止与零孤儿；
  macOS 和实体 Windows 随后再用同一 URL 复验，二者合起来才允许官网改“可直接使用”。
- Windows 实体复验不得把 OpenSSH remote command 当作 argv：请求以 base64url 严格 JSON 传入固定 PowerShell
  wrapper，wrapper 用 `-NoProfile -NonInteractive` 启动、校验 exact property set 与固定 URL，并精确透传 Node exit code。

门禁：

```sh
pnpm --filter @saydo/cli verify:distribution
node scripts/build-release-artifacts.mjs --write
node scripts/build-release-artifacts.mjs --check
node scripts/post-release-gate.mjs --check-candidate v0.1.0-rc.2
```

### D. 平台与真机验证

- macOS：从空临时 npm cache 与空 `SAYDO_HOME` 使用最终 GitHub Release URL 启动，
  `/health`、受保护 summary、console HTML、重复启动 attach、Ctrl+C 优雅停止与无孤儿进程均通过。
- Windows：通过 owner 私有配置中的固定 literal IP 与 pinned SSH host key，在空临时目录安装同一 Release URL，
  执行可做到的分发验收与真实启动/健康/停止；连接地址、用户名、known_hosts 不写入公开树。若远程会话
  不允许弹浏览器，以 `--no-open` 验证。
- Mac 与 Windows 各跑 `exec`、`global` 两种入口。`post-release-gate.mjs --write-availability` 是唯一证据
  生成者：它从 clean internal main 直接起两次本机子进程，并经 `/usr/bin/ssh`、`-F /dev/null`、严格
  known_hosts 和关闭 forwarding/proxy/control 的连接直接起两次 Windows 子进程；不再读取外部预制 JSON。
  每次结果必须回显 gate 的独立 challenge，并绑定 immutable tag SHA、固定 URL、tarball 摘要、
  source/build/runtime identity、已审 verifier SHA、Node 22、平台、安装模式、attach、优雅停止和零孤儿。
  四项全绿且处于 45 分钟窗口后，gate 才原子晋升本轮证据目录。该门防止预制 JSON 或托管 runner 冒充，
  不宣称 SSH endpoint 是硬件证明，也不抵抗同一 OS 用户下的恶意代码。
- Linux：公开仓 GitHub Actions 的 Ubuntu 分发 job 通过；不把 CI 等同 systemd 常驻验证。
- iPhone Air、Android、HarmonyOS：重建后向当前可连接真机安装并启动；设备离线、未签名或需要
  人工解锁时，保留真实失败证据并标阻塞，不伪造通过。移动壳的 LAN + token spike 边界不变。

### E. 独立评审、发布、部署与清理

- 实施与评估使用零上下文独立会话；两个互补 subagent 只读评审，加一次
  `codex exec -m gpt-5.6-sol`、max、read-only 对抗评审。A 级全部修，B/C 逐条 triage。
- 本地 `just ci`、分发验收、站点视觉截图、隐私探针、公开快照树差异与 emoji 门禁全部绿后，
  才按仓库两提交法入库并推送。
- 发布顺序固定且不得交换：① clean 的最终 internal SHA 推到 `origin/main`；② 从同一 SHA 的 clean
  clone 生成公开快照，并把 `public/main` 与不可移动 `v0.1.0-rc.2` 在一次 atomic push 中发布；
  ③ 等待 tag workflow 的 snapshot、Node/Python、fresh-origin Playwright、三平台 distribution、
  Release 以 pending/unavailable 态创建及三平台 exec/global 固定 URL smoke 全绿；任一 smoke 红则
  workflow 保留不可变 tag/asset、显式标记 Release unavailable，官网继续保持“发布候选”文案；六项
  smoke 全绿后 workflow 才把 Release title/notes 改成可用态并 readback；④ 本机 Mac 与实体 Windows
  对同一 immutable URL 完成 D 节复验；⑤ 随后必须由带 `--evidence` 输出路径、私有 Windows SSH 锚和
  新证据目录的 `post-release-gate.mjs --write-availability` 直接发起 Mac/Windows 的 exec/global 四次实跑，
  拒绝任何预制证据输入，并机械核对 tag SHA、Release/asset exact-set、指定 workflow 与六项托管 smoke，
  再写 availability 文案，并自动重生、
  按私有完整树模式复核 audit bundle；availability 与 bundle 同一提交，
  重建公开快照后只推 `public/main`、不移动 tag；⑥ availability 快照进入
  公开 main 后先等待精确绑定该 `public/main` SHA 的公开 CI 全绿，其中 node job 必须已执行公开树
  `--check-bundle`；随后由同一脚本 `--deploy` 再核对 internal/public 全树 exact-set 和这次公开 CI，
  并用固定 Wrangler 4.112.0 依次上传两个 Pages
  项目；部署必须核对 origin push URL 与实时 `ls-remote origin/main`，并强制落 `--evidence`；⑦ 核验生产域名 HTTP、
  关键安装文案、Release metadata/SHA256SUMS 与线上 tarball 摘要，随后再次重生 bundle 并形成最终 records snapshot。
  公开快照全程先确认私有软著材料仍被排除。
- 发布前后分别核对 `git worktree list`、本地分支 ancestor、工作区 clean；只删除已证明合并且
  不含独有改动的本地分支/worktree。远端历史分支不在“本地清理”授权内，不擅自删除。
- 最终运行时复审发现的三项 P1 作为发布硬门：`finalize_pending_json` 与 restart marker 不得形成
  永久双锁；adapter 漂移必须先于工作区存在性判断且双向 spawn=0；未绑定终局意图的旧 durable
  result 不得供新进程继承。成本、outbox、audit 三类终态注入失败和旧活进程 ownership 回收均须有反例。

总门禁：

```sh
just ci
pnpm --filter @saydo/cli verify:distribution
pnpm --filter @saydo/daemon exec vitest run test/restart-policy.test.ts test/tier1-executor.test.ts
bash scripts/check-emoji.sh
git diff --check
git status --short --branch
```

## 4. 需要上浮而不能擅断的事项

以下只有在实际遇到时才暂停对应项，其余阶段继续：

1. 需要改变 `docs/09` 已有合同形状、移动配对威胁模型或 `v0.1.0` 发布门。
2. 需要对外提交 App Store、Google Play、AppGallery 或 npm registry。
3. HarmonyOS 缺发布 Profile、设备离线或签名身份需要 owner 交互。
4. 四场真人体验与主观语音听感；自动化不能替代 owner 验收。
