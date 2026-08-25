# AI Supply 生态与普通用户 UX 最终闭包复核 v12

你是全新、零上下文、只读的生态与产品体验审查者。只读取：

`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

禁止读取其他prompt、review、history、journal、日志或实现者说明。先独立验证冻结身份：25,018行、1,513,595 bytes、SHA-256 `7ffadde7837eeab3332431a67437aff2a65595cc1e9cda8c88c69a2e970e8d09`；不一致只报告漂移。验证后连续读完整文件，不能只查品牌名或读矩阵摘要。

目标用户是本机已经使用任意主流AI服务的人：他可能只有CLI订阅、消费订阅、官方API、三方网关、企业云身份、本地runtime、远程/LAN设备、bridge/router或完全自定义端点。判断方案是否真的让这些用户自动发现、低认知接入、诚实付费、失败可恢复，而不是只“列到名字”。

至少逐项检查：

1. 中国大陆与全球官方API、三方API/网关、订阅和CLI的主流覆盖，含智谱/Z.AI、Kimi、OpenCode Go/Zen/Server/ACP、Codex、Gemini/Antigravity、MiniMax、百炼、方舟/BytePlus、混元、千帆、SiliconFlow、OpenRouter等。
2. Ollama、LM Studio、oMLX、llama.cpp、vLLM/SGLang、LocalAI/Open WebUI、Docker Model Runner、Podman AI Lab及长尾本地runtime的发现、协议、冷态、local/cloud/LAN边界。
3. CC Switch桌面与CLI fork、LiteLLM、One API/New API、Portkey、Vercel AI Gateway等bridge/router是否被当作路由控制面，而非误认provider。
4. Custom Base URL是否真正覆盖OpenAI Chat、OpenAI Responses、Anthropic Messages、mTLS-only和custom secret header；协议、path、auth、model/deployment、proxy/TLS和未知计量是否各自友好且安全。
5. 每个固定requirement是否有真实账户起点、准确graph entry、recipe字段、runtime state producer、正向ready终态；Codex/Kimi订阅OAuth与OpenCode/CC Switch本地surface图不得互换。
6. `user_primary_action`与automatic step是否定义清楚；最坏起点的主动作、外部任务、MFA、字段、leave-return、copy/paste和时间是否可从事件日志重算且不借更宽tier。
7. 自动探测是否默认安全、非打扰、不会读第三方secret或运行helper；主动配置、被动提示、焦点恢复、错误处方、取消、旧方案保留是否足够友好。
8. connected/conversation/review/execution/control readiness、费用/权益/数据文案、`zh-CN/en-US/en-XA`、键盘/screen reader/窄屏/200%是否无误导。
9. provider preset、model picker、普通路径与高级路径是否让非技术用户无需理解Base URL、协议、四槽和内部receipt；专家仍可审计最终wire与route。
10. 61行最低真相、ecosystem matrix、Phase、TCK、release gate和支持页是否逐row一致；品牌级布尔或预配置账号不得替代真实旅程。

用具体用户故事寻找不可达、字段超限、错误账号状态、伪零配置、暗中按量、订阅权益误用、国内外realm误投、自动探测扰民和提示无主动作等反例。当前官网事实可能变化，但本轮不联网；只判断文档是否建立可刷新证据和诚实降级机制。

把报告写入：

`research/codex-findings/140-ai-supply-ecosystem-ux-final-closure-v12.md`

报告必须含冻结完整性、A/B/C计数、逐finding精确行号和最小用户路径、覆盖矩阵、遗漏生态清单、唯一verdict。A表示主流路径不可达、安全/费用/权益/数据误导或固定最低集失败；B表示显著生态、交互、可访问性、可验证性或扩展缺口；C仅为非阻断改进。只有A=0且B=0可`PASS`，否则`FAIL`。不得修改目标文档。
