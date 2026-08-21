# 87 · 状态对齐实施后交叉评审终裁

> 日期：2026-08-21
> 输入：Grok 首轮实施结果 + 两路零上下文只读复核 + Codex `gpt-5.6-sol` 对抗复核 + 首次收口后返回的两路迟到只读复核。
> 对象：未提交工作树；本轮不部署、不修改 live 配置。

## 1. 评审输入

| 路 | 产物 | 首轮结论 |
|---|---|---|
| 对外承诺 / 双语 | `87-status-alignment-post-implementation-product.md` | `FAIL`，A 2 / B 4 |
| 内部档案 / 证据 | `87-status-alignment-post-implementation-integrity.md` | `FAIL`，确认 3 / 部分确认 1 / 驳回 1 |
| Codex 对抗复核 | `87-status-alignment-post-implementation-codex.md` | `FAIL`，A 2 / B 4 |
| 首次收口后迟到复核 | `87-status-alignment-post-implementation-late.md` | 新增 A 1 / B 2；其余为已关闭重复项 |

首轮三路共同命中：云端绝对句、系统语音联网例外、tailnet 三层状态、CLI / SDK 与 live steer 范围、证据归属。迟到复核另命中一条 A 级合同冲突：Docs 误写「语音不放行审批」，但 canonical 明确 voice / `voice_weak` 封顶 S2；并补出 LLM 深研状态分叉与备份证据来源缺注。

## 2. 冲突终裁

| 争议 | 终裁 | 理由 |
|---|---|---|
| Claude Code 执行器应否从「进行中」降档 | **不降档** | W5.4-a 已有实装与 evidence；「进行中 + 生产主流程未接」是准确状态 |
| tailnet 是否「现在可用」 | **对当前 HEAD 不成立** | 开发机 / 旧 runtime 网络底座已就绪，但 HEAD setup probe 仍以 `setup_local_only` 拒绝；对外只能写「进行中」 |
| observedModel 豁免是否继续休眠 | **证伪旧句** | `docs/09` 与 T18 实现表明 BYOA `claude_cli` 条件豁免已落地；Tier1 `claude_code` 不使用该豁免 |
| 语音是否不放行任何审批 | **否** | `docs/09` §3 明确 voice / `voice_weak` 允许 ≤ S2，`docs/10` §2.5 给出封闭肯定词表；只有 S3 绝不语音放行 |
| PLAN-2 的 `602aa09` 是否当前 HEAD | **否** | 它是 2026-07-26 历史证据提交；当前三层坐标只认 HANDOFF §1 快照 |
| W5.4-b 是否包含 live steer | **否** | 定稿方案选择 `claude -p`；本轮保留 `queued_delta` / `cancel_resume`，streaming input / live steer 不在当前批 |
| LLM 深研是「进行中」还是「规划中」 | **规划中** | packages 与 PLAN-2 均无实施命中，§16 总表也写「方案在拟」；当前只有确定性奠基机械管道 |

## 3. 已回修

1. 中英 Docs：
   - 「无云端依赖」改为本地核心 + 用户主动启用第三方服务例外；
   - 系统 / 浏览器语音改为设备端或联网取决于设置与厂商实现；
   - 出网清单改为「主要路径，不是穷举」；
   - tailnet 从「现在可用」改为「进行中」，明确网络底座就绪不等于 HEAD 支持；
   - 审批分面改为 LAN 不裁 S2/S3、语音确认封顶 S2、tailnet 配对屏幕面在支持后封顶 S2、S3 只走本机认证屏幕；
   - LLM 深研统一为「规划中」，并把奠基词条改回确定性机械管道；
   - 源稿与成品页同步。
2. 中英 Privacy：
   - 删除「音频仅本机处理 / never uploaded」；
   - 改为 SayDo 不保存音频，系统识别的设备端 / 联网处理取决于设置与厂商实现。
3. `HANDOFF.md`：
   - 当前三层坐标唯一源显式化；
   - Claude CLI 版本更新为 2.1.225；
   - `claude -p` 取代 Agent SDK 泛称；
   - BYOA 条件豁免已落地、Tier1 不豁免；
   - 备份失败标明为本机日志 / 目录现场取证，仓内无可复跑原始日志。
4. `IMPLEMENTATION-PLAN-2.md`：
   - `602aa09` 标为历史证据提交；
   - W5.4 改为 Claude Code CLI；
   - 明确 W5.4-b / c 边界与 live steer 不在本轮。
5. prompt / evidence：
   - `[ok]` / `[fail]` / `[warn]` 恢复为允许的文本状态标记；
   - evidence 保留 Grok 原始浏览器失败，并另列调度方 Playwright 后验结果；
   - IMPL-PROMPT-11 增加后验勘误，不静默改写历史派发正文。

## 4. 回修后验证

| 门禁 | 结果 |
|---|---|
| `git diff --check` | exit 0 |
| `bash scripts/check-emoji.sh` | exit 0 |
| 10 页 HTML 链接 / id / fragment / 资源审计 | exit 0，`pages=10 links_and_assets=420` |
| 状态与隐私关键锚 | exit 0，`files=8 assertions=30` |
| 迟到回修关键锚 | exit 0，`files=5 assertions=25` |
| `UV_CACHE_DIR=/tmp/saydo-uv-cache just ci` | 迟到回修后重跑 exit 0；contracts 103、console 264、daemon 1665 passed / 4 skipped、Python 33 passed |
| Playwright 定向回归 | 中英 Docs 桌面 + 中英 Privacy 手机：无横向溢出、无坏图、0 console error / warning |
| 迟到回修 Playwright | 中英 Docs 桌面：语音 S2 与 LLM 深研新口径存在，旧句消失；无横向溢出、无坏图、0 console error / warning |

## 5. 仍未改变的边界

- 未 commit、未 push、未部署官网或常驻 runtime。
- T19 × tailnet 合同仍需 owner 拍板并先回写 canonical；此前禁止升常驻或把 `setup_local_only` 静默并入 `remote-mobile`。
- 定时备份 `workspace_identity_changed` 仍是下一次部署门前置。
- GitHub Actions 的 pnpm 重复版本键仍待走公开快照仓通道修复。
- W5.4-b 生产执行主流程接线仍是下一工程项；本轮没有把它写成已可用。

## 6. 结论

首轮及迟到复核的 A 级与采纳的 B 级均已回修，驳回项与已关闭重复项未造成错误降档。实施与检查已跑完，等 owner 验收。
