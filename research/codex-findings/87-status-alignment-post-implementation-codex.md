# 87 · 状态对齐批实施后对抗复核

## 1. 总评

**FAIL**。

本复核以 `chore/status-alignment-20260821` 的活动树 `HEAD=088b8f0cc176bc2be9cf09235a640301dd35cb55` 为坐标，先把暂存的开批前基线与未暂存的本批增量分开，再逐项对照 `IMPL-PROMPT-11`。未暂存文件集合只有允许范围内的 14 个路径；`git diff --check` 与 `git diff HEAD --check` 均为 0，emoji 门为 0。没有证据表明本批改了 canonical、workflow、运行时代码、live 配置、TTS，或执行了 commit、push、deploy。

但成品文档仍有可复现的 A 级数据路径/法律表述问题，且有 B 级状态档案和源稿复活风险。修复并重新跑针对性门禁前，不应进入 owner 验收。

对问题 1 的直接回答：Grok 没有完整执行 `IMPL-PROMPT-11`。范围边界基本守住，但 §3.2 的语音例外、Docs 的云端路径、tailnet 状态和 PLAN/源稿档案对账均有漏项。

## 2. 发现（按严重度）

### A-1 · Docs 仍把可选第三方出网写成“无云端依赖”

证据：

- 中文文档 `deploy/saydo-octoooo-com/docs/index.html:216` 写“全部跑在你的 Mac 上,无云端依赖”，但同一表 `:224` 明写 pipeline 是火山豆包云端 ASR/TTS；` :782-783` 又明写音频发往火山引擎、AI 上游和可选 ntfy 出网。
- 英文同位 `deploy/saydo-octoooo-com/en/docs/index.html:228`、`:236`、`:802-803` 同样冲突。
- 两份源稿仍保留同一生成源：`docs/site/2026-08-20-docs-page-content.fable.md:122`、`:128`、`:692-694`；源稿 FAQ `:749` 还写“没有云端服务器”。成品 FAQ `deploy/saydo-octoooo-com/docs/index.html:845` 与英文 `en/docs/index.html:865` 也使用无限定的“没有云端服务器 / There are no cloud servers”。

影响：普通访客可把“没有 SayDo 自营后端”误读成“没有任何云端依赖或出网”。这与页面自己给出的第三方 AI、云端语音和推送数据路径直接抵消，属于数据路径和对外承诺的重大失真；不能由首页已经正确写出的“开发者不运营后台”来豁免。

最小修法：把组件标题改成“核心 daemon、console、账本和执行在你的 Mac；可选语音、AI、推送连接你自行配置的第三方；SayDo 不运营产品后端”，中英文及源稿同改；Docs FAQ 用“没有开发者运营的云端后台”而不是“没有云端服务器”。保留隐私页和首页中事实成立的“不运营任何服务器 / runs no servers”。

### A-2 · 法律页麦克风行仍是无条件“不上传”，与联网识别分支冲突

证据：

- `deploy/saydo-octoooo-com/privacy/index.html:76` 写“音频仅在本机处理，不上传”；英文 `deploy/saydo-octoooo-com/en/privacy/index.html:76` 写“Audio is processed on-device only; never uploaded”。
- 紧邻的 `privacy/index.html:77` 只给“语音识别”行加了系统联网例外，并没有限定上一行的麦克风断言。
- 原生实现存在可选联网识别路径：`apps/ios/SayDo/NativeSpeechController.swift:202-232` 在 `allowServerRecognition` 为真且设备端识别不可用时放行联网识别，`:241-246` 相应设置 `requiresOnDeviceRecognition`。这不是“任何情况下音频都不出网”的事实。

影响：法律页表格的普通读法是麦克风音频绝不离开设备，与用户显式允许系统联网识别时的真实路径不一致，形成法律事实和数据去向过度承诺。

最小修法：把该行限定为“手机端默认设备内处理、SayDo 不主动保存或上传；若在系统/壳设置中允许联网语音识别，音频按操作系统厂商条款处理”，中英文同步。不要删 Keychain、Keystore、HarmonyOS 等价设施句，也不要改动“不运营任何服务器”。

### B-1 · Tailnet 对外状态与 HEAD 的 T19 首启门不一致

证据：

- 中文成品 `deploy/saydo-octoooo-com/docs/index.html:753` 描述 tailnet 可看任务并批 S2，`:830` 标为“现在可用（需手工配）”；英文 `en/docs/index.html:850` 同样标为 “Available now (manual config)”。源稿 `docs/site/2026-08-20-docs-page-content.fable.md:734` 复活同一状态。
- HEAD 运行时代码在 tailnet 首启 probe 明确返回 `setup_local_only`：`packages/daemon/src/index.ts:993-1003`、`:1047-1055`，setup 写口也在 `:1157-1175` 拒绝 tailnet。
- 控制台只把 `mobile_lan_route_rejected` 映射为 remote-mobile，`packages/console/src/components/SetupBootstrapBoundary.tsx:12`、`:25-29`；其它 probe 错误（含 `setup_local_only`）落到 `probe-error`，`:151-153`。
- 内部档案已经记录这个前置门：`HANDOFF.md:57`、`docs/plan/IMPLEMENTATION-PLAN-2.md:127`。

影响：这不证明所有已经在本机完成首启的 tailnet 会话都失败，但证明“HEAD 上手工配好即可现在可用”没有说明首启条件；新用户按文档从远程面进入会撞错误卡。它是可复现的可用性/状态错位，不应被静默映射成 remote-mobile。

最小修法：owner 在 T19 合同拍板并完成 HEAD 定向验证前，把双语 tailnet 状态改成明确的本机首启前置/待 T19，而不是无条件“现在可用”；若决定恢复可用，先改 canonical、代码和测试，再改文案。不得在本批增加 `SAYDO_MOBILE_LAN` 或绕过 `setup_local_only`。

### B-2 · Claude 泛卖点和源稿仍会复活“执行器在建/进行中”的过满口径

证据：

- 首页泛卖点仍写 `deploy/saydo-octoooo-com/index.html:275`“Claude Code 执行器在建”，英文 `en/index.html:275` 为“with a Claude Code executor in progress”。
- 源稿直接提供同一旧句：`docs/site/2026-08-20-homepage-structure-copy.fable.md:104-105`；其结构表和建议段 `:21-22`、`:39` 也仍把该句作为生成材料。
- 同页较精确的状态卡 `index.html:311-312` 已正确写“官方 CLI 能力实测与审批门判定逻辑已验证，尚未接入生产执行链”；Docs `deploy/saydo-octoooo-com/docs/index.html:513`、`:831` 也正确写“生产执行主流程接线是下一步”。W5.4-a 证据 `e2e/evidence/w54a-claude-cli.md:3`、`:94`、`:182-183` 明确未接执行器认领主路径。

影响：同一首页和下一次生成输入同时存在“在建/in progress”和“尚未接入生产链”，普通访客会把纯函数 spike 读成实际执行器正在可用化，后续生成又可能复活被 triage 禁止的“接线在途”语义。

最小修法：泛卖点与源稿改成与状态卡完全相同的受限事实，或删除该泛卖点中的 Claude 执行器句；保留“进行中”徽标，但不把生产接线写成当前在途。

### B-3 · PLAN-2 当前表仍把历史证据 SHA 标成 `HEAD`，且没有三时钟/Release digest

证据：

- `docs/plan/IMPLEMENTATION-PLAN-2.md:15` 在当前状态表写“接线批 / 执行器批 … HEAD `602aa09`”。本会话真实命令 `git rev-parse HEAD` 返回 `088b8f0cc176bc2be9cf09235a640301dd35cb55`；`HANDOFF.md:22` 才是正确的活动树 HEAD、常驻 runtime `ada7981c...`、release config digest `2278...` 三层时钟。
- PLAN-2 的 2026-08-21 覆盖段 `:10` 只写 runtime 结论和 T2 前置，没有补活动树 HEAD 与 release config digest，导致读者会把 `602aa09` 当成当前 HEAD。

影响：实施/验收人员可能拿历史批次 SHA 代替活动树，或把 runtime/release config 的事实外推到 HEAD；这正是本批要求消除的时钟混用。

最小修法：把 `602aa09` 改成“历史证据 commit”并去掉无日期的 `HEAD` 标签；在 PLAN-2 当前快照明确引用 HANDOFF 的三层时钟（或完整复制同一组值），不要保留第二套坐标。

### B-4 · HANDOFF/PLAN-2 的 Claude “SDK”命名与实际 CLI 运输层不一致

证据：

- `HANDOFF.md:46` 仍写“Tier1 Claude Agent SDK”；`docs/plan/IMPLEMENTATION-PLAN-2.md:62` 标题仍是“Claude SDK Tier1 主档接入”。
- 实际 W5.4-a 证据标题 `e2e/evidence/w54a-claude-cli.md:1`，范围 `:3` 明确是官方 `claude -p` CLI spike，且 `:182-184` 明确未接生产主路径；Docs 成品 `deploy/saydo-octoooo-com/docs/index.html:513` 也使用 CLI 子进程。

影响：这会在下一次排产时把“CLI 能力 spike、W5.4-b 生产接线”误记成 SDK 已选或已常驻，尤其会与“订阅只经 CLI 登录态消费”的约束混淆。

最小修法：改为“Claude Code CLI / `claude -p` Tier1 接入（W5.4-b）”；若未来确有 SDK 方案，单独标为未决设计，不得放在当前能力标题中。

### B-5 · evidence 对浏览器门禁是诚实的，但缺少调度方后验的来源附录

证据：

- `e2e/evidence/status-alignment-20260821.md:119-120` 如实记录 `node e2e/audit-check.mjs` 缺 `playwright`、Chromium 启动受沙箱限制；`:137` 明确说横向溢出与 pageerror 未在 Grok 沙箱内核验，没有把失败写成通过。
- 同文件 `:110-126` 记录了命令与退出码，`:128-137` 记录未做清单，整体没有证据造假。
- 本会话独立复跑 `node e2e/audit-check.mjs` 仍为退出码 1（`ERR_MODULE_NOT_FOUND: playwright`）。本会话 `UV_CACHE_DIR=/tmp/saydo-uv-review-cache just ci` 为退出码 1，失败点是沙箱 `pgrep`/`listen EPERM`；这与 evidence `:123-124` 所记录的另一轮 `/tmp/saydo-uv-cache just ci` 退出码 0 必须分开记，不能互相覆盖。

影响：实现证据可信，但按 `IMPL-PROMPT-11 §4.6` 的浏览器门禁仍不自足。调度方提供的后验 Playwright 事实可以补足验收依据，但不能倒写成 Grok 会话已跑过。

最小修法：在 evidence 末尾追加独立来源段，标题明确“调度方在 Grok 会话结束后执行的 Playwright 后验”，记录桌面 1442×867 的中英首页/文档、手机 390×844 的中英首页/文档/隐私/条款/支持页面、无横向溢出、无 `naturalWidth=0`、控制台 0 error/0 warning 及已核对锚点；同时写入实际命令、日志文件名、字节数和 SHA-256（若有）。保留现有 6b 失败记录，不改写其来源。

### C-1 · 中文首页徽标词表仍与 Docs 分叉

`deploy/saydo-octoooo-com/index.html:319` 使用 “Coming soon”，而 Docs 的三档词表和对应状态使用“规划中”（例如 `deploy/saydo-octoooo-com/docs/index.html:131`、`:836`）。这不改变事实，属 C 级文风/词表一致性问题；可在下次文案批统一为“规划中”，不阻塞本批安全验收。

## 3. IMPL-PROMPT-11 逐节覆盖结论

| 章节 | 结论 | 对账证据 |
|---|---|---|
| §3.1 官网中英成品 | 部分收口 | Win/Linux、三端 App、邮件按钮、信任条、LAN/S2/S3、QR 前置和精确 Claude 状态卡均已落在 `deploy/saydo-octoooo-com/index.html:96,168,311-312,332,379,397-428` 及英文同位；但 `:275` 与源稿 `docs/site/2026-08-20-homepage-structure-copy.fable.md:104-105` 仍有 Claude 泛句。 |
| §3.2 隐私/条款 | 部分收口 | 日期、第三方例外、开发者限定“不上传”、LAN/overlay、Keychain/Keystore/HarmonyOS 已在 `privacy/index.html:61-86` 和英文页；麦克风行的无条件“不上传”见 A-2。 |
| §3.3 Docs | 部分收口 | 实时字幕/Silero 已降为规划中，能量 VAD、语义 EOU、“说完了”与云端级联语音现在可用，Claude 细句和权限边界正确（`docs/index.html:513,733-734,770,782-783,825,831`）；组件“无云端依赖”、tailnet “现在可用”仍未对账。 |
| §3.4 HANDOFF | 大体收口，留 B | 指针、三层时钟、场次、Actions、Tailscale、T19、备份、A3/deep readiness、TTS 事实均在 `HANDOFF.md:21-22,45-58,62-66`；`:46` 的 SDK 命名是 B-4。 |
| §3.5 PLAN-2 | 部分收口 | W5.4-b、Actions、场次、T2、T19 与备份前置已更新（`:10,16,126-127,143,152,185`）；`:15` 的 `HEAD 602aa09` 和 `:62` 的 SDK 标题仍失真，见 B-3/B-4。 |
| §3.6 evidence | 结构齐全，浏览器来源未闭合 | `e2e/evidence/status-alignment-20260821.md:33-53,55-107,110-137` 覆盖文件清单、双语对账、档案事实、命令退出码和未做清单；6b 失败记录诚实，但调度方后验尚未附录。 |
| §3.7 两份 emoji prompt | [ok] | `git diff` 显示每份仅一行 pictographic 示例替换；`bash scripts/check-emoji.sh` 本会话退出码 0，输出 `[ok] emoji gate: clean`。 |
| §4 验收锚 | 部分可复现 | 本会话 `git diff --check` 与 `git diff HEAD --check` 均 0；`node e2e/audit-check.mjs` 为 1，`just ci` 的本会话复跑为 1（沙箱限制）。证据文件记录的另一轮 `UV_CACHE_DIR=/tmp/saydo-uv-cache just ci` 为 0，应按来源分层。 |
| §5 红线 | [ok] 未触碰 | 未暂存增量只含允许 14 路径；没有 packages、pipeline、`.github/workflows`、`docs/09`、`docs/10`、`docs/11` 或 live 配置增量；未 commit/push/deploy。 |

## 4. evidence 可信度与浏览器后验的正确记法

当前 evidence 的可信部分：

- `:24-31` 的分支、HEAD、runtime/digest 来源和 staged 基线说明清楚；`:35-53` 没有把 staged 基线资产冒充本批增量。
- `:57-89` 的旧短语、双语语义、法律日期、权限边界和 Claude/Silero 锚与当前文件可对上。
- `:119-124`、`:128-137` 主动记录了浏览器和门禁受阻、未部署、未改 canonical/workflow/TTS 等事实，没有伪造“浏览器已通过”。

调度方另行提供的后验结果（不归因于 Grok）是：桌面 1442 x 867 核对中英文首页/文档，手机 390 x 844 核对中英文首页、文档、隐私、条款、支持；无横向溢出、无 `naturalWidth=0`，控制台 0 error/0 warning，且隐私日期/第三方例外/不运营服务器/Keychain/Keystore 与首页平台状态、Docs 的 S2/S3、Claude、Silero 锚均存在。我把它作为外部复核事实，不把它倒写成 `status-alignment-20260821.md` 的 Grok 命令结果。

必须追加但不能倒写的内容：

1. 追加一节独立 provenance，明确执行者是“调度方”，时间点是 Grok 会话结束后，不能写成 Grok 的命令结果。
2. 按来源列出桌面与手机 viewport、页面清单、横向溢出、图片自然宽度、console error/warning 和隐私/状态锚点；若没有可复核日志，就标为调度方后验观察，不冒充 `§4.6` 命令门。
3. 保留原 6a/6b 退出码和“Grok 沙箱未验证”的说明；两套结果并列，不用后验观察覆盖失败门禁。

## 5. 保持不动项

- `docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、`docs/11-ui-spec.md`、`.github/workflows/ci.yml`、运行时代码、live `~/.saydo` / launchd / Tailscale 配置。
- 不运营任何服务器、开发者不运营产品后台、Keychain / Android Keystore / HarmonyOS 等价设施等真实承诺；只收窄可能误读的“无云端依赖/不上传”上下文。
- macOS 桌面服务和 Cursor Agent 现在可用；Windows/Linux 暂不支持且无时间表；iOS/Android/HarmonyOS 开发中、未上架、无下载包；邮件只订阅进展。
- LAN 不放行 S2/S3、用户自配 tailnet 远程面封顶 S2、S3/合并/删除回电脑；能量 VAD、语义 EOU、“说完了”兜底和云端级联语音现在可用；实时字幕与 Silero VAD 规划中。
- Claude 当前仅保留官方 CLI 能力实测和审批门判定纯函数已验证、生产执行主流程未接入；不把它写成常驻执行器。
- 条款适用对象、令牌寿命和 TTS §2-10 不在本批扩大解释或改写；不把工作树改动写成发布。

## 6. 最终是否可进入 owner 验收

**当前不可直接进入。** 至少应先处理 A-1、A-2，并回修 B-1 至 B-4；随后按来源追加调度方浏览器后验，重新跑可运行的文案/HTML/CI 门禁并保留本次沙箱失败原因。修复后才可把本轮交给 owner 验收；在此之前不得 commit、push、deploy 或升常驻。
