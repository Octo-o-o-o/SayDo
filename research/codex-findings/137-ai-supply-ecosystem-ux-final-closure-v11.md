# AI Supply 生态与普通用户 UX 最终收口独立评审 v11

VERDICT: FAIL

## 评审边界与冻结完整性

- 评审输入：`prompts/137-ai-supply-ecosystem-ux-final-closure-v11.md`。
- 唯一目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`。
- 已按连续行段完整读取目标第 1–22,507 行；未读取旧报告、其他 prompt、其他仓库文件或外部资料。
- 冻结目标初始观测：22,507 行，1,363,124 bytes，SHA-256 `3b93808d641a6f2a59a1938ae6526280da1d7746dc8acf4197d030cdc6bf8ed1`，与 prompt 三项完全一致。
- 目标最终 SHA-256：`3b93808d641a6f2a59a1938ae6526280da1d7746dc8acf4197d030cdc6bf8ed1`；本评审未修改目标。
- `REFERENCE_REQUIREMENTS_V3` 第 19,350–19,410 行共 61 行；按冻结文本重算，分类为 18 global official、10 China official、13 gateway/subscription、9 local、4 execution、5 custom、1 bridge、1 control；surface 为 55 inference、4 execution、1 bridge、1 control；journey tier 为 13 zero-config、35 guided-key、4 guided-oauth、9 enterprise-managed；realm 为 33 global、14 China mainland、14 local。

## 严重度汇总

| 严重度 | 数量 |
|---|---:|
| A | 4 |
| B | 1 |
| C | 0 |

## Findings

### [A-001] 九条固定企业推理 requirement 无法进入唯一 GA supply journey 类型

- 精确位置：`GaSupplyJourneyUxBindingV2` 仅允许 `zero_config/guided_key/guided_oauth`（第 18,698–18,725 行）；`enterprise_managed` 只加在 execution binding（第 18,727–18,747 行）；`GaJourneyDefinitionV2` 把 inference/supply 固定绑定前者（第 18,749–18,781 行），其后 supply pass 类型也只遍历该三值 union（第 19,862–19,939 行）。然而 61 行真相源中，Vertex ADC/WIF、Azure service principal/managed identity、Bedrock static/role/SSO、Hunyuan signed API、custom mTLS 共九条均同时声明 `surfaceKind: "inference"` 与 `journeyTier: "enterprise_managed"`（第 19,353–19,354、19,357–19,358、19,360–19,362、19,387、19,409 行）。V3 又宣称 matrix/journey/pass/docs 只能由 requirements 精确投影（第 19,563–19,579 行）。
- 普通用户反例：企业用户选择 Azure OpenAI service principal。该固定 requirement 必须投影成 supply + enterprise-managed；现有 union 中这个交集是 `never`，因此系统只能丢掉该 requirement、错误改成 execution/guided-oauth，或永远产不出 completed-pass report。
- 为什么现有设计挡不住：requirements 自己只 `satisfies ReferenceRequirementV3`，其中 tier union 允许 enterprise；现有 compile-time assertions 只核对 recipe class/关键行存在，不核对每行是否可实例化为 `GaJourneyDefinitionV2`。所以文档可以通过局部类型检查，同时九条企业 journey 在 GA 门禁形状中不可表示。
- 根因级修复：新增 supply 的 `enterprise_managed` binding（或统一升级为按 `surfaceKind × journeyTier` 穷尽映射的 V3 definition/pass/gate 类型），把 enterprise class limits 贯穿 definition、run、pass、entry、ecosystem gate；再为 61 行逐行生成 `Extract<GaJourneyDefinitionV3, exact subject>` 非 `never` 的编译断言及运行期 deriver mutation fixture，任何无法投影的行直接阻断 designation。

### [A-002] 固定 custom journey 的 recipe 与签名 UX 上限互斥，且 secret-header 的认证字段根本不在 recipe 中

- 精确位置：guided-key class limit 把 `baseUrl` 与 `protocol` 上限都设为 0（第 18,444–18,448 行），scalar limit 又把全部 manual fields 上限设为 2（第 18,561–18,579 行）。`RECIPE_CUSTOM_ENDPOINT_V1` 却要求用户显式提交 `base_url`、`protocol`、`model_or_deployment` 三个必填字段，并把 `api_key` 设为可选（第 19,268–19,282 行）。三个固定 custom protocol journey 均把该 recipe 标成 `guided_key`（第 19,406–19,408 行）。`custom.secret-header` 同样复用该 recipe（第 19,410 行），虽然 field union 明明定义了 `custom_secret_header_name/value`（第 19,112–19,135 行），recipe 却没有这两个字段。
- 普通用户反例：用户添加一个带 bearer key 的 OpenAI-compatible 私有网关。即使不填可选 key，三个必填公开字段已经超过 scalar 2，并分别触发被签名为 0 的 base URL/protocol class；如改走 secret-header，界面按唯一 recipe 连 header 名和值都无从收集。该用户无法同时完成真实配置与 per-class gate。
- 为什么现有设计挡不住：derivation receipt 只声称验证 field classification/source/persistence（第 19,537–19,550 行），没有验证 `authKind` 所需字段、recipe 必填字段到 manual class 的映射、各 class 总和及所选 tier 的 signed limits。`substitute_recipe_or_manual_field_source` mutation 也不覆盖“原 recipe 自己超限/缺认证字段”。
- 根因级修复：为 custom endpoint 建立独立 journey tier 与签名 scalar/per-class limits，或把这些 journey 明确归入能容纳 base URL/protocol/model 的 enterprise class；按 auth kind 拆出 bearer、x-api-key、authless、secret-header、mTLS recipe，要求认证字段与 `authKind` 精确相等。deriver 必须逐字段映射到唯一 UX metric class、重算必填总数并证明不超限；加入删除 header field、把 required key 改 optional、把 custom recipe 绑定 guided-key 的负向 fixture。

### [A-003] 61 行“唯一真相源”没有编码可执行 onboarding 步骤或必测账户起点，门禁可用预配置账户跳过普通用户路径

- 精确位置：`startingAccountState` 虽列出 no-account、signed-out、no-billing、admin-required、local-not-running 等状态（第 18,376–18,435 行），但 `GaJourneyDefinitionBaseV2` 的必测笛卡尔积只有 platform、locale、pseudo-locale 与 anchor state（第 18,679–18,695 行），`GaJourneyRunSubjectV2` 同样没有 account state（第 19,677–19,695 行）。唯一 recipe schema 只有静态 fields、通用 validation sequence 与 recovery-state 名单，没有 prerequisite/main action、account creation/login/MFA/admin wait、external-task transition 或 leave/return 的有序步骤（第 19,137–19,186 行）。V3 却要求 journey、fixture、docs 只从 requirements/recipe 生成（第 19,563–19,579 行）。
- 普通用户反例：第一次使用 OpenAI API 的用户没有账户、billing 或 key；或者第一次使用 Codex app-server 的用户尚未安装且处于 signed-out。固定行分别只给 `warm + RECIPE_GUIDED_KEY_V1`（第 19,350、19,208–19,219 行）和 `not_installed/signed_out/... + RECIPE_EXECUTION_STDIO_V1`（第 19,400 行），但没有规定哪个起点必须跑、由哪些动作把状态推进到 ready。发布方可让所有报告填写 `signed_in_ready`，只测粘贴已有 key/调用已有 CLI，仍覆盖全部 required run subject digest。
- 为什么现有设计挡不住：`GaUxActualMetricsV2.startingAccountState` 是报告方单值，不属于 definition 或 run-subject identity，也没有 baseline 要求每个 recipe 必测哪些起点；`requiredRuntimeStates: string[]` 只是终端/fixture 名称，不能唯一推导用户动作与计量分类。于是“61 行精确覆盖”只证明已配置路径，不证明普通用户真实 onboarding。
- 根因级修复：给每条 requirement 增加类型化 `requiredStartingAccountStates` 与有序 journey graph，逐状态列 prerequisite、唯一 primary action、external task class、manual field、provider-page step、MFA/leave-return/recovery 和产生的 runtime state；把 account state 纳入 run subject digest 与 required Cartesian expansion。至少对 no-account、signed-out/no-billing、enterprise-admin-required、local-not-running 的适用行分别要求独立 pass，并新增省略任一起点/步骤仍伪造覆盖的 mutation fixtures。

### [A-004] typed action log 无法产生它声称精确派生的等待、复制及时间计量，UX gate 可接受不可审计数字

- 精确位置：actual metrics 要求 `administratorWaitEventCount/Millis`、`copyPasteCount`、`appElapsedMillis`、`rawElapsedMillis` 并声称全部来自完整 typed log（第 18,415–18,435 行）。但 `GaUxActionEventV3` 只有 primary action、external-task **started**、manual-field、provider-step、leave、return、error、recovery 八类事件；没有 external-task end、administrator-wait interval、copy/paste、app foreground/background 或 run interval，唯一时间字段还是不含可运算时值的 `occurredAtMonotonicDigest`（第 18,480–18,495 行）。composition/payload 随后仅用字面量 `true` 声称每项 componentwise sum 与完整派生（第 19,697–19,711、19,754–19,788 行）。
- 普通用户反例：Bedrock SSO 用户离开应用登录、完成 MFA、等待管理员批准 20 分钟，再复制一次 profile 信息返回。事件 union 最多记录 external-task-start/leave/return，既没有批准结束时间和 app 活跃区间，也没有复制事件；实现只能把这些成本报成 0，或在 `actualUxMetrics` 中填入没有 typed-event 来源的数字。两种做法都可携带现有 nominal proof 字段进入 per-class gate。
- 为什么现有设计挡不住：门禁核对的是报告中的 totals 与布尔 receipt，没有一个由事件 union 到所有 metric 的可执行、总函数式 reducer；因此“计入前置 + 主流程、raw/app 双时间、copy/paste/admin wait 全部求和”不可复算，签名限额可能被低报后误放行。
- 根因级修复：扩展事件 union，至少加入 external-task/admin-wait start+terminal、copy/paste、app visibility/session interval 和 run terminal；携带可验证的同一 monotonic clock 数值/ordinal 与配对 nonce。冻结唯一 deterministic reducer，从 event set 计算每一 metric 并让 gate 只接收 reducer 输出；增加删除 terminal、压缩等待、漏记 copy、把 raw time 冒充 app time 的 mutation fixtures。

### [B-001] exact-return-focus policy 要求 window/route，但唯一 evidence receipt 无法证明二者

- 精确位置：`ReturnFocusPolicyV1.captureBeforeExternalTask` 明确要求 `window_id` 与 `route_id`，再加 source card/control/action nonce（第 19,552–19,560 行）。`GaReturnFocusEvidenceReceipt` 只保存 nonce、card、control 和 accessibility digest，没有 window/route before/after identity（第 18,465–18,478 行）；action event 外壳也只有 nonce/card（第 18,480–18,492 行）。
- 普通用户反例：用户在两个 SayDo 窗口打开同一 supply route，在窗口 A 发起浏览器登录后切到窗口 B；回调若把焦点放到 B 的同名 card/control，现有 receipt 仍能填出相同 card/control/nonce 和可见 enabled 证明，却不能证明回到原窗口与原 route。键盘/屏幕阅读器用户会失去上下文。
- 为什么现有设计挡不住：policy 中的 capture tuple 没有进入证据类型或 equality predicate；accessibility tree digest 只能说明某棵树的焦点，不能证明它属于发起任务的 window/route。
- 根因级修复：receipt 增加 before/after `windowId`、`routeId`，并由外部任务 nonce 绑定发起窗口、route、card、control；恢复 verifier 逐层验证 same-window/same-route 后才按 fallback order 聚焦。加入双窗口、路由切换、card 重挂载与 passive refresh 的负向 a11y fixture。

## 生态与旅程覆盖矩阵

下表的 `[ok]` 只表示在冻结文档中未发现新的阻断性内部矛盾，不代表代码实现已被本次只读文档评审验证。

| # | 检查面 | 冻结目标覆盖 | 评审结果 |
|---:|---|---|---|
| 1 | 全球/中国官方 provider 与长尾 | 61 行覆盖 OpenAI、Anthropic、Gemini、OpenRouter/OpenCode、ZAI/BigModel、Kimi、DeepSeek、Bailian、Volcano/BytePlus、Hunyuan、Qianfan、MiniMax、SiliconFlow；长尾有 registry 分级 | `[warn]` 名单存在，但企业行被 A-001 截断，通用 recipe 受 A-003 影响 |
| 2 | Codex/Claude/Kimi/Gemini/OpenCode/Cursor/Grok/Qwen/Copilot 与 rights/overage | 主体区分 inference 与 execution、官方 API 与受支持执行面，并给 conditional rights、unknown metering、overage/official alternative | `[ok]` 未发现继续复用消费者凭据或静默切 payg 的新矛盾 |
| 3 | Zen/Go 三协议、HTTP/ACP、Kimi 双协议、LM Studio/oMLX 三协议、BytePlus/云 auth | 关键协议行独立列出，LM Studio/oMLX 各三行，OpenCode Zen/Go 各三行，Server HTTP/ACP 独立，云 auth 独立 | `[fail]` 九条企业 auth 无 GA supply 形状（A-001），可执行步骤/账户起点不完整（A-003） |
| 4 | bridge/gateway/proxy/custom endpoint | CC Switch、gateway/proxy inventory 与 custom Chat/Responses/Messages/mTLS/secret-header 有入口和 unknown metering | `[fail]` custom recipe 与签名 limits/auth fields 直接冲突（A-002） |
| 5 | Ollama、LM Studio/Link、oMLX、vLLM/SGLang/llama.cpp/LocalAI、Docker/Podman/Foundry/Apple、LAN | 本机/云端、托管/非托管、cold/stopped/model-missing/port-conflict、LAN 信任边界有明确分层；L0/L2/库存分级可见 | `[ok]` 未发现新的本地服务静默启动、拉取、加载或 LAN 越权缺口 |
| 6 | Bedrock/Google/Azure 企业认证与未知价格 | 各 auth 行与 funding tier 独立；主体要求用户精确选择 principal/project/tenant/region/deployment，不猜 default chain | `[fail]` enterprise inference 类型不可表示（A-001），且必测普通起点/有序步骤未进入唯一真相源（A-003） |
| 7 | provider-first UX、单主动作、发现、登录/MFA/离开返回、首见证、离线/代理、中国网络、locale/a11y、生命周期/迁移提示 | 主体有 provider-first、单 primary、两 locale+pseudo、双 anchor、离线/代理/China、cold/stopped/rollback/readiness 提示 | `[fail]` account/install/login 起点可被跳过（A-003），跨窗口/route 焦点证据不闭合（B-001） |
| 8 | 每条 required journey 的双 anchor、前置+主动作与总时间 | definition 要求 `not_enrolled/ready`，并声明前置与主流程统一 inventory | `[fail]` account-state 不是 required run 维度（A-003）；typed log 无法重算等待/复制/raw-app time（A-004） |
| 9 | per-class limits、manualFieldCount 求和、focus restore | scalar/class limits、求和 receipt、focus policy 均已写入 GA gate | `[fail]` custom 必填字段超限（A-002），计量事件不完备（A-004），window/route 证据缺失（B-001） |
| 10 | 61 requirements 唯一真相源与防删改/借报告/V2 复活 | 文本确有 61 行，重复 entry 的 protocol/surface 要独立报告，V1/V2 仅迁移输入，删除/替换撤销 designation | `[fail]` requirements 到 GA definition/recipe/metrics 的跨类型映射不是全函数（A-001、A-002、A-003） |
| 11 | passive/static/explicit discovery 安全 | 禁读第三方 secret/history、禁执行 helper/CLI/浏览器/metadata，显式动作与 LAN/paid 操作分离 | `[ok]` 未发现静默 start/pull/load 或付费动作被 passive discovery 触发 |
| 12 | remote witness 首次动作、processor/proxy/offline recovery 与生产 qualification | 用户 disclosure/decision、数据边界、proxy/offline typed terminal、24 小时多 observer qualification、失败降级 boot-local 均有合同 | `[ok]` qualification 失败不会把不合格 witness 发货，普通用户仍有明确本机降级与恢复说明 |
| 13 | inventory/install/login/rights/conformance/readiness/cost/data boundary/local-vs-egress | UI 投影和 receipts 分离这些维度，并要求 cost/data-boundary/identity scope 可见 | `[warn]` 状态命名覆盖充分，但从普通账户起点到这些状态的必测动作仍受 A-003 影响 |
| 14 | 未授权消费者订阅的官方替代 | 主体明确不得把网页登录态/token/消费者订阅冒充 API；rights-blocked 走官方 API或受支持执行面，未知费用不静默切换 | `[ok]` 未发现新的凭据复用、越权推理或 silent payg 路径 |

## 收口判定

四个 A 级问题分别破坏固定 requirement 的可表示性、custom journey 的可达性、普通用户起点覆盖与 UX 计量的可复算性；一个 B 级问题使跨应用返回焦点证据不足。应先修复并以同一冻结口径重跑独立评审。
