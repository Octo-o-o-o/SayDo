# 01 · 软件工程与 IT（120 条）

## 高频 H（54 条）

| ID | 需求频率先验 | 角色与情境 | 潜在客户提问 | 对应目的 | 档位 | 必需工具族 | 上下文模式 | 能力/边界 |
|---|---|---|---|---|---|---|---|---|

| ENG-002 | H | 修线上缺陷的工程师 | 用户改完邮箱再刷新会变回旧值，你先复现、找根因，再给我最小修复。 | 在有限范围内修复可复现缺陷并保留证据。 | C3 D1 H0 R3 K2 S1 | repo,test | LIVE | F1/B0 |

| ENG-003 | H | 给旧模块补保障的工程师 | 这个解析器没人敢动。能只把现有行为补成测试，不碰实现吗？ | 用回归测试冻结现状，为后续修改降风险。 | C2 D0 H0 R2 K1 S1 | test | USER | F1/B0 |

| ENG-004 | H | CI 突然变红的开发者 | 这个测试本地过、CI 挂，到底差在哪？能查证原因，不靠重试糊过去吗？ | 找到环境或竞态根因，避免制造假绿。 | C2 D0 H0 R2 K2 S0 | test,ci | LIVE | F2/B0 |

| ENG-005 | H | 维护复杂函数的开发者 | 这段代码越来越难读，能在不改行为的前提下拆清楚，并用回归测试证明吗？ | 改善可维护性，同时用测试约束等价性。 | C2 D0 H0 R2 K2 S1 | repo,test | USER+LIVE | F1/B0 |

| ENG-006 | H | 合并前自查的工程师 | 帮我 review 这个分支，最可能造成数据丢失、越权或兼容性回退的地方有哪些？ | 在合并前优先发现高影响缺陷。 | C2 D0 H0 R2 K1 S0 | git | USER+LIVE | F1/B0 |

| ENG-007 | H | 三人开源维护组里兼顾安全告警的工程师 | 这个安全更新我们真的受影响吗？先查调用路径和 breaking change，确认后再升级。 | 用兼容性和回归证据完成常见依赖升级，不与漏洞可达性调查重复。 | C4 D1 H0 R3 K2 S2 | repo,test,ci | LIVE | F2/B-AUTH |

| ENG-008 | H | 扩展服务接口的后端工程师 | 能按现有风格加一个按月份查账单的接口吗？权限、分页和错误码都要有测试。 | 交付契合既有合同的新 API。 | C3 D1 H0 R2 K2 S1 | repo,test,api | CTX-01+LIVE | F1/B0 |

| ENG-009 | H | 修改控制台的前端工程师 | 导出入口应该放在哪个设置页，才能让窄屏也好用，又不影响其他页面？ | 完成聚焦的 UI 改动并守住响应式体验。 | C3 D1 H0 R2 K3 S1 | repo,browser,design,test | CTX-01+LIVE | F2/B0 |

| ENG-010 | H | 被类型错误阻塞的 TypeScript 开发者 | 这个联合类型为什么突然收窄失败？先解释，再用最小改动修到 typecheck 通过。 | 理解并消除类型回归，避免粗暴断言。 | C3 D1 H0 R2 K2 S1 | repo,test | LIVE | F1/B0 |

| ENG-011 | H | 页面变慢的全栈工程师 | 列表一多就卡，先别猜着改，真正慢的是哪里？ | 用测量驱动性能修复，而非猜测优化。 | C2 D0 H0 R2 K3 S1 | repo,browser,monitoring,test | LIVE | F2/B0 |

| ENG-012 | H | 排查慢查询的数据工程师 | 这条查询昨天突然慢了一倍，是执行计划、索引还是 schema 变了？ | 定位数据库性能退化并给出可验证修复。 | C3 D1 H0 R4 K3 S2 | memory,repo,shell,database,document | USER+LIVE | F2/B0 |

| ENG-014 | H | 新增功能后补文档的工程师 | 请按实际代码补清默认值和失败方式：这个配置项现在到底怎么用？ | 让文档与实现一致，减少错误配置。 | C2 D0 H0 R2 K1 S1 | repo | LIVE | F1/B0 |

| ENG-015 | H | 维护入门文档的开源维护者 | 按当前命令实际走一遍，README 的快速开始现在还能跑通吗？ | 恢复新用户可复现的安装路径。 | C2 D0 H0 R2 K1 S0 | shell | LIVE | F1/B0 |

| ENG-016 | H | 准备改表的后端工程师 | 这个字段要从可空改成必填，先给我迁移和回滚方案，别直接动生产数据。 | 在实施前暴露兼容和数据回填风险。 | C2 D0 H0 R2 K2 S1 | document,repo | USER+LIVE | F1/B0 |

| ENG-017 | H | 接到模糊 bug 报告的 QA | 用户只说偶尔保存不了，我们怎么先把它稳定复现出来？ | 把模糊现象收敛为可验证缺陷。 | C3 D1 H0 R3 K2 S0 | repo,test,monitoring | USER+LIVE | F2/B0 |

| ENG-018 | H | 准备版本说明的发布负责人 | 把这个版本从上个 tag 到现在的用户可见变化整理成 release notes，内部重构不要写进去。 | 生成面向用户、可追溯的版本说明。 | C2 D0 H0 R2 K1 S1 | git | LIVE | F1/B0 |

| ENG-019 | H | 合并时遇到冲突的开发者 | 昨天那版冲突处理跑测试又挂了。别再整块选一边，先告诉我是哪条语义没保住。 | 保留双方语义并安全解决冲突。 | C3 D1 H0 R4 K2 S2 | memory,test,git | USER+LIVE | F1/B0 |

| ENG-020 | H | 收到漏洞通告的技术负责人 | 先判断这个漏洞在我们的调用路径里能不能触发，证据够了再提升级。 | 区分真实暴露与仅版本命中，合理排序修复。 | C3 D1 H0 R2 K2 S2 | repo,rag | USER+LIVE | F1/B0 |

| ENG-021 | H | 正在排查告警的值班工程师 | 这段错误日志里，第一个异常信号和最可能的触发点是什么？ | 快速形成事故调查假设和下一步检查。 | C2 D0 H0 R2 K1 S2 | monitoring | CTX-02+LIVE | F2/B0 |

| ENG-022 | H | 负责数据可靠性的工程师 | 昨晚备份任务显示成功，你别只看退出码，帮我验证快照真的可读、能恢复。 | 验证备份有效性而非表面成功。 | C3 D1 H0 R2 K2 S0 | filesystem,test,tasks | LIVE | F2/B0 |

| ENG-024 | H | 新成员装环境 | 按仓库现在的要求把本机开发环境跑起来，卡住就记录准确原因，不要跳过检查。 | 获得可复现的开发环境和故障记录。 | C2 D0 H0 R2 K2 S2 | repo,shell | LIVE | F1/B0 |

| ENG-025 | H | 维护跨平台 CLI 的工程师 | 这个命令在 macOS 正常，Windows 路径一带空格就挂，补实现和跨平台测试。 | 修复路径兼容并防止平台回归。 | C3 D1 H0 R2 K2 S1 | shell,test | USER+LIVE | F1/B0 |

| ENG-026 | H | 被 flaky test 困扰的团队 | 这个用例十次里挂一次，先做重复运行和时序取证，别直接放宽超时。 | 找出非确定性来源并恢复测试可信度。 | C2 D0 H0 R2 K1 S0 | shell | LIVE | F1/B0 |

| ENG-028 | H | 身份服务值班负责人 | 根据这次登录事故材料写复盘，根因、促成因素和行动项要分开。 | 形成无责、可执行且来源清楚的事故复盘。 | C3 D1 H0 R2 K3 S2 | tasks,monitoring,document,rag | CTX-02+LIVE | F2/B0 |

| ENG-029 | H | 修回归的前端开发者 | 昨天改筛选器后键盘操作失效了，定位是哪次改动，修完补回归测试。 | 恢复交互并锁住可访问性行为。 | C3 D1 H0 R4 K3 S1 | memory,repo,git,test | USER+LIVE | F1/B0 |

| ENG-030 | H | 做无障碍整改的前端工程师 | 先把这个表单用键盘和读屏走一遍，列出阻断问题，再按影响修。 | 发现并修复关键可访问性障碍。 | C4 D1 H0 R3 K2 S1 | browser,repo,test | LIVE | F2/B0 |

| ENG-034 | H | 前后端共同改合同 | 这个响应字段要改名，先找所有消费者，给我兼容期方案和契约测试。 | 避免接口分叉和一次性破坏升级。 | C3 D1 H0 R2 K2 S1 | repo,test,document | LIVE | F1/B0 |

| ENG-035 | H | 产品分析工程师 | 给新导出功能加最少但够用的事件，既能看使用率，也别把账单内容打进日志。 | 获得隐私安全的产品使用信号。 | C2 D0 H0 R2 K2 S2 | bi,monitoring | CTX-01+LIVE | F2/B-PRIV |

| ENG-037 | H | 修权限漏洞的后端工程师 | 普通成员好像能读管理员导出接口，先做反例测试，再修到默认拒绝。 | 消除越权并建立 fail-closed 回归门。 | C4 D1 H0 R3 K2 S2 | repo,test,api | CTX-01+LIVE | F1/B-PRIV |

| ENG-039 | H | 优化读取性能的开发者 | 这个缓存到底值不值得加，会脏多久，又该怎么失效？ | 避免用缓存掩盖问题或引入陈旧数据。 | C2 D0 H0 R2 K2 S0 | repo,monitoring | LIVE | F2/B0 |

| ENG-044 | H | 准备请求评审的工程师 | 根据实际 diff 和测试结果写 PR 描述，未验证的地方单独列，不要自夸。 | 降低 reviewer 理解成本并诚实交接。 | C2 D0 H0 R2 K2 S1 | test,git | LIVE | F1/B0 |

| ENG-045 | H | 团队技术负责人 | 这次改动跨四个目录，按实际依赖建议 reviewer，不要只看 CODEOWNERS。 | 找到真正理解改动面的评审人。 | C3 D1 H0 R2 K2 S1 | repo,git,tasks | LIVE | F2/B0 |

| ENG-046 | H | QA 负责人 | 按这份需求列正向、边界、权限和失败恢复测试，先指出哪些现在测不了。 | 形成风险驱动且可执行的测试计划。 | C2 D0 H0 R2 K1 S2 | test | CTX-03 | F1/B0 |

| ENG-047 | H | 维护开发者工具的工程师 | 新命令第一次失败时用户看不懂，重做帮助文案和退出码，并补 CLI 测试。 | 让命令失败可诊断且适合自动化消费。 | C3 D1 H0 R2 K3 S1 | repo,shell,test,document | LIVE | F1/B0 |

| ENG-049 | H | 收到噪声告警的 SRE | 这个告警半夜响了五次但都没影响用户，帮我重定义触发、抑制和升级条件。 | 降低告警疲劳同时保留真实事故信号。 | C2 D0 H0 R2 K2 S2 | notification,monitoring | LIVE | F2/B0 |

| ENG-050 | H | 下班交接的值班工程师 | 把今天未解决的三个异常整理成接班人能直接继续的交接，不要把猜测写成结论。 | 保持调查连续性并分离事实与假设。 | C2 D0 H0 R2 K2 S1 | memory,monitoring | CTX-02+LIVE | F2/B0 |

| ENG-053 | H | 离开工位的工程师 | 我刚派的修复现在到哪了？只告诉我状态、已验证证据和还在等什么。 | 低注意力获取可信进度，而非原始日志。 | C1 D0 H0 R1 K2 S0 | memory,tasks | LIVE | F1/B0 |

| ENG-054 | H | 续接昨日任务的开发者 | 继续昨天那个导入 bug，先复述上次做到哪、哪些决定已经确认，再开工。 | 用持久上下文安全续接，避免重复和漂移。 | C3 D1 H0 R4 K2 S2 | memory,issue-tracker | USER+LIVE | F2/B-AUTH |

| ENG-060 | H | 重做权限模型的平台团队 | 现在角色越加越乱，先从真实动作整理权限矩阵，再给迁移和反例测试。 | 收敛最小权限模型并避免隐式扩权。 | C4 D2 H0 R3 K2 S1 | test,repo | LIVE | F1/B0 |

| ENG-062 | H | 数据平台工程师 | 把这条每天全量跑的管线改成增量，先定义迟到数据、重跑和一致性验收。 | 降低成本并保持可恢复的数据正确性。 | C4 D1 H0 R3 K2 S1 | repo,database,test | CTX-15+LIVE | F2/B0 |

| ENG-064 | H | 云成本突然上升的负责人 | 上月云账单涨了 28%，按服务和使用量拆解，别把所有增长都叫浪费。 | 区分业务增长、价格变化和资源低效。 | C2 D0 H0 R2 K2 S2 | cloud,repo | LIVE | F2/B-FIN |

| ENG-070 | H | 准备渗透测试的安全工程师 | 把系统资产、信任边界、测试账号和禁止动作整理成给第三方的测试包。 | 提高安全测试覆盖并限制误伤。 | C2 D0 H0 R2 K1 S2 | test | USER | F1/B-PRIV |

| ENG-072 | H | 供应链安全负责人 | 我们有哪些安装脚本和下载二进制会在 CI 执行？做清单并给最小权限改造。 | 降低构建链被第三方代码利用的风险。 | C3 D1 H0 R2 K3 S1 | shell,tasks,ci,document | LIVE | F2/B0 |

| ENG-075 | H | 基础设施团队 | 把这批手工云资源收进 IaC，先导入现状，再确保计划里没有意外删除。 | 降低配置漂移并安全迁移资源所有权。 | C3 D1 H0 R2 K2 S2 | cloud,document | USER+LIVE | F2/B-AUTH |

| ENG-086 | H | 负责新人上岗的工程经理 | 新人第一周总卡在环境和权限。把真实安装步骤、访问申请和首个小改动做成能逐项过关的清单。 | 让新人用可验证的环境与首个改动进入工程流程。 | C4 D1 H1 R3 K3 S1 | repo,shell,tasks,document | LIVE | F2/B0 |

| ENG-088 | H | 准备公开仓的维护者 | 发布前扫描许可证、隐私材料、构建产物和不可公开历史，先给阻断清单。 | 防止开源发布泄露或许可不合规。 | C3 D1 H0 R2 K3 S2 | repo,shell,tasks,document,rag | USER+LIVE | F2/B-PRIV |

| ENG-089 | H | 接入第三方服务的后端团队 | 这个供应商 API 偶尔超时，做重试、幂等、限流和降级，但别把错误吞掉。 | 提高外部依赖韧性并保持失败可见。 | C2 D0 H0 R2 K2 S1 | repo,api | LIVE | F1/B0 |

| ENG-091 | H | 下线旧功能的产品工程师 | 上次说旧 API 没人用，但客服刚找到一个大客户。重新查消费者，再给可回滚的下线门。 | 避免静默破坏存量消费者。 | C3 D1 H0 R4 K3 S2 | memory,repo,api,monitoring,crm | CTX-03+LIVE | F2/B-PRIV |

| ENG-092 | H | 收口复盘行动的事故负责人 | 这次别只写“加强测试”，把哪道检测本可更早发现、owner 和验证日期写清楚。 | 产出可追责于系统而非个人的行动项。 | C2 D0 H0 R2 K2 S1 | test,tasks | CTX-02+LIVE | F2/B0 |

| ENG-093 | H | 对客户汇报可靠性的工程师 | 用过去一季度数据写 uptime 报告，计划停机、局部降级和测量盲区分开。 | 提供可审计且不夸大的可靠性说明。 | C2 D0 H0 R2 K2 S1 | monitoring,document | LIVE | F2/B0 |

| ENG-094 | H | 技术负责人排债 | 把最近三个月 bug、告警和返工聚成技术债主题，按用户影响和修复杠杆排序。 | 从零散抱怨形成可决策的偿债组合。 | C3 D1 H0 R2 K2 S1 | notification,issue-tracker,monitoring | USER+LIVE | F2/B0 |

| ENG-095 | H | 负责长期维护的仓库维护者 | 每周检查依赖更新和安全通告，只产草稿任务卡，别自动升级。 | 持续发现维护需求且不擅自改变代码。 | C3 D4 H4 R4 K2 S2 | tasks,automation,repo | LIVE | F3/B0 |

| ENG-106 | H | 公共服务产品的无障碍负责人 | 按 WCAG 做全站审计、修复计划和证据包，但法规结论交给专业审核。 | 系统提升无障碍并保留合规复核边界。 | C3 D1 H0 R2 K3 S1 | browser,repo,test,document | LIVE | F2/B-LEG |

| ENG-109 | H | 内部平台团队 | SDK、参考文档和契约测试老是不同步。能都从 schema 生成，CI 发现手写分叉就拦住吗？ | 让合同成为 SDK、文档与测试的共同来源。 | C4 D1 H0 R3 K3 S2 | repo,test,database,api,ci | LIVE | F2/B0 |

## 中频 M（42 条）

| ID | 需求频率先验 | 角色与情境 | 潜在客户提问 | 对应目的 | 档位 | 必需工具族 | 上下文模式 | 能力/边界 |
|---|---|---|---|---|---|---|---|---|

| ENG-001 | M | 新接手仓库的后端工程师 | 先画一张能核对的路径图：这个请求从 API 到数据库到底绕了哪些层？ | 快速建立可核对的代码导航，减少盲目搜索。 | C3 D1 H0 R2 K2 S0 | repo,database,api | LIVE | F1/B0 |

| ENG-013 | M | 维护流水线的平台工程师 | PR 的 lint job 要跑七分钟。能找出可安全并行或缓存的步骤，同时不降低门禁吗？ | 缩短反馈时间，同时保留质量信号。 | C5 D2 H0 R3 K2 S2 | test,git,ci | LIVE | F2/B0 |

| ENG-023 | M | 配置多个环境的开发者 | 把 dev 和 staging 的配置差异列清楚，哪些是故意的，哪些可能是漂移？ | 识别环境漂移并保留敏感信息边界。 | C2 D0 H0 R2 K1 S2 | git | LIVE | F1/B-PRIV |

| ENG-027 | M | SaaS 产品工程师 | 把财务要的月度 CSV 导出做出来，字段和 Excel 验收都按现有简报。 | 交付高频业务功能并用明确 oracle 验收。 | C3 D1 H0 R2 K3 S2 | repo,test,spreadsheet,finance | CTX-01+LIVE | F2/B0 |

| ENG-031 | M | 为低视力客户修移动页面的前端工程师 | 390 像素宽时这页一直横着滚。能按现有断点修掉，又不把字段藏起来吗？ | 保持移动浏览器可读和可操作。 | C3 D1 H0 R2 K2 S1 | repo,mobile,design | USER+LIVE | F2/B0 |

| ENG-032 | M | 接入表单数据的后端工程师 | 导入规则定好后，请直接在现有后端实现，并补空值、重复和非法日期的测试；能先给我看 dry-run 结果吗？ | 防止脏数据静默进入系统。 | C3 D1 H0 R2 K2 S1 | repo,test | USER+LIVE | F1/B0 |

| ENG-033 | M | 设计 CLI 的工程师 | 给这个清理命令设计 dry-run、范围确认和可恢复输出，别一上来就删。 | 为破坏性命令建立预览与确认边界。 | C2 D0 H0 R2 K1 S0 | shell | LIVE | F1/B-AUTH |

| ENG-036 | M | 灰度发布负责人 | 这个功能先给内部和 5% 客户开，帮我把开关、回滚和观测条件写清楚。 | 降低发布风险并定义扩大流量的证据。 | C2 D0 H0 R2 K1 S1 | monitoring | LIVE | F2/B-AUTH |

| ENG-038 | M | API 平台工程师 | 这个接口被单个客户打爆了，设计一个能解释、能观测、不会误伤批处理的限流方案。 | 保护服务同时保留合法高吞吐路径。 | C4 D1 H0 R3 K3 S1 | repo,api,monitoring,document | LIVE | F2/B0 |

| ENG-040 | M | 维护异步任务的工程师 | 这条消息失败后重复执行了三次，帮我核对幂等键、重试条件和死信处理。 | 防止重复副作用和无休止重试。 | C3 D1 H0 R2 K2 S1 | repo,messaging,test | LIVE | F2/B0 |

| ENG-041 | M | 维护定时任务的平台工程师 | 夜间同步偶尔漏跑，能查清是调度、时区还是重叠执行的问题，并补上失败通知吗？ | 提高周期任务可预测性并补可见性。 | C3 D1 H0 R2 K2 S1 | automation,notification,monitoring | LIVE | F2/B0 |

| ENG-042 | M | 做文件导入的全栈工程师 | 给用户一个导入前预览，错误行能下载，成功行和失败行数量要对得上。 | 让批量导入可理解、可纠错和可验收。 | C3 D1 H0 R2 K2 S1 | repo,test,browser | LIVE | F2/B0 |

| ENG-043 | M | 改善错误体验的开发者 | 这些错误码用户根本看不懂。能改成下一步该做什么，同时把关联 ID 留给排障吗？ | 提升失败可恢复性而不泄露内部细节。 | C3 D1 H0 R2 K2 S1 | repo,test | USER+LIVE | F1/B0 |

| ENG-048 | M | 维护老数据库的工程师 | 新列只进了建库脚本，老库还没迁移。能补上增量迁移和老版本 fixture 吗？ | 防止只在空库绿、真实升级失败。 | C3 D1 H0 R2 K2 S1 | repo,database,test | LIVE | F1/B0 |

| ENG-051 | M | 维护重复代码的开发者 | 这三个 helper 看起来一样，先确认行为差异，再决定是否合并。 | 避免为了去重破坏隐含契约。 | C3 D1 H0 R2 K2 S0 | repo,test | LIVE | F1/B0 |

| ENG-052 | M | 发现文档漂移的维护者 | 配置文档说默认关闭，代码却默认开启。能找到权威口径并把两边对齐吗？ | 消除合同与实现冲突。 | C2 D0 H0 R2 K2 S2 | repo,rag | LIVE | F1/B0 |

| ENG-055 | M | 技术负责人评审架构 | 通知真要改成事件驱动吗？先给我一页 ADR，把失败模式和不改的代价讲清楚。 | 在施工前澄清边界、收益和迁移风险。 | C2 D0 H0 R2 K2 S1 | repo,document | USER+LIVE | F1/B0 |

| ENG-056 | M | 单体应用负责人 | 这个计费模块是否值得拆服务？用依赖、变更频率和故障边界给证据。 | 避免凭潮流做高成本架构决策。 | C3 D1 H0 R2 K2 S0 | repo,tasks,rag | CTX-01+LIVE | F2/B0 |

| ENG-058 | M | 跨三个仓库改协议的工程师 | 事件字段要同时改服务端、SDK 和示例仓，依赖顺序和兼容窗口该怎么排？ | 协调跨仓合同变更并防止版本错配。 | C4 D1 H0 R3 K2 S1 | repo,tasks,api | LIVE | F2/B0 |

| ENG-059 | M | 接入支付回调的后端团队 | 设计支付 webhook 的验签、幂等、重放和对账，任何真实扣款都先用沙箱。 | 建立安全可恢复的支付事件处理。 | C2 D0 H0 R2 K2 S2 | spreadsheet,api | LIVE | F2/B0 |

| ENG-061 | M | 企业版工程师 | 给现有登录加 SSO，先把租户发现、账号合并、锁死风险和管理员恢复路径设计清楚。 | 安全引入企业身份而不阻断存量用户。 | C4 D1 H0 R3 K2 S2 | repo,test,document | USER+LIVE | F1/B-ID |

| ENG-063 | M | 建观测体系的 SRE | 给这项核心流程补日志、指标和 trace，先回答用户影响怎么从信号里看出来。 | 建立以用户结果为中心的可观测性。 | C2 D0 H0 R2 K2 S1 | bi,monitoring | LIVE | F2/B0 |

| ENG-065 | M | 国际化负责人 | 中文设置页要支持多语言，能把日期、金额和长文案的改动与测试一起补上吗？ | 建立可扩展本地化能力而非只换字符串。 | C3 D1 H0 R2 K2 S1 | repo,test,browser | LIVE | F2/B0 |

| ENG-066 | M | 移动端架构师 | 设计离线编辑和上线后同步，冲突不能最后写入者无脑覆盖。 | 明确定义离线一致性、冲突与用户恢复。 | C2 D0 H0 R2 K2 S1 | automation,git | LIVE | F2/B0 |

| ENG-067 | M | 平台产品工程师 | 插件机制我有点担心失控。权限、兼容、隔离和撤销这四块先怎么设门？ | 避免第三方扩展扩大供应链风险。 | C3 D1 H0 R2 K1 S2 | repo | LIVE | F1/B0 |

| ENG-068 | M | API owner | 给公开 API 做 v2，列出客户端迁移、双写期、弃用信号和最终下线门。 | 让破坏性升级可观测、可退出。 | C2 D0 H0 R2 K2 S1 | repo,api | CTX-03+LIVE | F1/B0 |

| ENG-071 | M | 设计删除闭环的隐私工程师 | 用户要求彻底删除数据时，帮我沿数据库、对象存储、缓存、索引和备份画传播链。 | 发现删除闭环中的遗漏和保留期例外。 | C3 D1 H0 R2 K3 S0 | repo,database,cloud,document | LIVE | F2/B-AUTH |

| ENG-073 | M | 上线前性能负责人 | 按真实流量模型设计压测，不能只打首页；给出停止条件和容量结论。 | 验证关键路径容量并避免压测误导。 | C3 D1 H0 R2 K2 S0 | repo,test,monitoring | USER+LIVE | F2/B0 |

| ENG-077 | M | Linux 部署负责人 | 给前台可运行的服务补 systemd 常驻方案，但先出权限、日志和升级回滚设计。 | 从手工启动演进到可维护常驻。 | C3 D1 H0 R2 K3 S1 | shell,monitoring,document,repo | LIVE | F2/B0 |

| ENG-079 | M | 移动团队负责人 | 原生壳先别立项。我们能不能用一个小 spike 验证后台、推送、麦克风和断线恢复？ | 用 bounded spike 验证高风险平台假设。 | C4 D1 H0 R3 K2 S0 | repo,test,mobile | LIVE | F3/B0 |

| ENG-080 | M | 浏览器扩展工程师 | 这个扩展要读当前页面并发给本地服务，设计权限最小化和敏感页面拒绝规则。 | 防止浏览器上下文泄露和过宽权限。 | C2 D0 H0 R2 K2 S2 | browser,repo | LIVE | F2/B0 |

| ENG-081 | M | 给产品加 AI 摘要的团队 | 先做一套有人工标签的评测集，再比较模型，不要凭三条示例上线。 | 用可重复评估替代演示偏见。 | C3 D1 H0 R2 K2 S0 | test,document | USER | F1/B0 |

| ENG-082 | M | 构建内部知识问答的工程师 | 给这些手册做 RAG，先定义来源优先级、版本冲突、引用和不知道时怎么答。 | 建立可溯源且不掩盖不确定性的检索系统。 | C3 D1 H0 R2 K3 S0 | pdf,document,rag,git | USER+LIVE | F2/B0 |

| ENG-083 | M | 安全评审 AI 功能 | 仓库里的文档可能有 prompt injection，设计候选记忆、工具权限和回读验证的红队测试。 | 阻断不可信内容到持久行动依据的链路。 | C3 D1 H0 R2 K2 S2 | memory,repo,test | LIVE | F1/B0 |

| ENG-084 | M | 设计 agent 平台的工程师 | 把读文件、跑命令、联网、发消息分成效果权限，给每类工具一个拒绝和审计路径。 | 建立按效果而非工具名的治理模型。 | C4 D1 H0 R3 K2 S2 | shell,browser,messaging | LIVE | F2/B0 |

| ENG-087 | M | SDK 维护者 | 用当前接口写一个从零可跑的 SDK 教程，代码样例必须进 CI。 | 让开发者文档保持可执行。 | C3 D1 H0 R2 K2 S2 | repo,api,ci | LIVE | F2/B0 |

| ENG-098 | M | 计划语言迁移的架构师 | 把核心服务从 Python 迁到 Go，先做行为基线、双跑和逐流量切换方案。 | 在保持行为和可回滚前提下迁移技术栈。 | C4 D2 H2 R3 K3 S1 | repo,test,ci,monitoring | LIVE | F2/B0 |

| ENG-101 | M | 加密基础设施团队 | 密钥轮换设计快评审了，能重点检查旧密钥残留、回滚和审计证据是否闭合吗？ | 发现加密生命周期中的操作风险。 | C3 D1 H0 R2 K2 S2 | repo,rag,document | USER+LIVE | F1/B-PRIV |

| ENG-102 | M | 做实验室设备集成的工程师 | 这台串口设备协议文档不全，先做只读探针和回放夹具，不要直接发控制指令。 | 安全逆向设备协议并建立可重复测试。 | C2 D0 H0 R2 K1 S2 | api | LIVE | F2/B0 |

| ENG-104 | M | 上线机器学习模型的平台组 | 模型准备上线了。能把训练版本、漂移监控和回滚串起来，等我批准后再执行流量切换吗？ | 建立有版本证据、监控和人工授权的模型发布链。 | C4 D1 H0 R3 K3 S3 | repo,cloud,monitoring,document | LIVE | F3/B-AUTH |

| ENG-105 | M | 做边缘端应用的架构师 | 设备可能离线七天，设计配置同步、冲突处理和远程升级失败恢复。 | 让边缘系统在弱连接下保持可控。 | C2 D0 H1 R2 K2 S2 | automation,git | LIVE | F2/B0 |

| ENG-116 | M | 受监管行业的工程治理负责人 | 这些证据都在当前 workspace：把其中的需求、代码、测试、审批和发布记录串成审计包，法律充分性由合规人员确认。 | 在缺省 coding workspace 内建立可追溯的软件交付证据链。 | C4 D1 H0 R3 K3 S2 | repo,test,filesystem,rag | LIVE | F1/B-LEG |

## 长尾 L（24 条）

| ID | 需求频率先验 | 角色与情境 | 潜在客户提问 | 对应目的 | 档位 | 必需工具族 | 上下文模式 | 能力/边界 |
|---|---|---|---|---|---|---|---|---|

| ENG-057 | L | 计划渐进迁移的架构师 | 给这套单体到模块化架构做三阶段迁移，每阶段都要能回滚和单独验收。 | 降低结构性迁移的爆炸半径。 | C3 D3 H2 R4 K2 S1 | repo,test | LIVE | F3/B0 |

| ENG-069 | L | 负责灾备的 SRE | 用我们真实依赖做一份恢复方案，RPO、RTO、演练步骤和失败退出都要有。 | 把灾备从文档口号变成可演练合同。 | C5 D2 H0 R3 K3 S2 | test,tasks,document,repo | LIVE | F2/B0 |

| ENG-074 | L | 组织上线演练的发布工程师 | 我们想先小流量走一遍发布。审批都过后，能边切流量边看健康指标，出问题就回滚吗？ | 在受控真实 effect 下检查流量切换、数据兼容和回滚证据。 | C3 D1 H0 R2 K3 S3 | repo,test,cloud,monitoring | LIVE | F3/B-AUTH |

| ENG-076 | L | Windows 兼容负责人 | 把目前依赖 POSIX shell、信号和路径的地方全量列出，按风险分批对齐 Windows。 | 系统化关闭跨平台缺口。 | C4 D1 H0 R3 K2 S0 | shell,tasks,repo | LIVE | F2/B0 |

| ENG-078 | L | macOS 分发负责人 | CLI 签名发布这条少见流程，能先列出证书、notarization 和更新门的人工检查清单吗？ | 规划可信桌面分发并避免误签发布。 | C1 D0 H0 R1 K3 S1 | repo,shell,tasks,document | LIVE | F2/B-AUTH |

| ENG-085 | L | 维护语音产品的 QA | 根据真实误听整理一套中英混说回归语料，保留原话、识别结果和修正。 | 用真实失败持续校准 ASR。 | C3 D1 H0 R2 K2 S1 | transcription,test,document | USER | F2/B0 |

| ENG-090 | L | 迁移历史数据的工程师 | 给 2,000 万行回填做分片、校验、暂停和恢复，线上负载不能被拖垮。 | 安全执行大规模数据回填。 | C4 D2 H2 R3 K3 S2 | database,test,monitoring,document | USER+LIVE | F2/B0 |

| ENG-096 | L | 负责仓库治理的平台团队负责人 | 每周巡检失败 CI、过期待办和高频 flaky test，按项目聚合后再叫我。 | 建立低噪声的主动工程巡检。 | C4 D4 H4 R4 K3 S3 | tasks,automation,ci,notification | LIVE | F3/B-AUTH |

| ENG-097 | L | 接手失控代码库的 CTO | 先用两周把这套系统的真实边界、关键债和可替换模块摸清，再决定是否重写。 | 用证据约束重写冲动并形成投资决策。 | C3 D3 H2 R2 K1 S1 | repo | LIVE | F1/B0 |

| ENG-099 | L | 多云合规负责人 | 设计一套能在两家云故障时切换的架构，先算清数据一致性、成本和演练代价。 | 判断多云是否值得并定义真实恢复能力。 | C5 D2 H0 R3 K3 S0 | test,spreadsheet,cloud,repo | LIVE | F2/B0 |

| ENG-100 | L | 数据库负责人 | 这张十亿行生产表要换主键。先只做迁移方案和隔离演练，不改生产；把双写核对、逐阶段放行和回滚终态写清。 | 用隔离演练和人工放行方案控制超大生产数据库结构变更风险。 | C5 D2 H2 R4 K3 S2 | repo,database,test,monitoring,document | USER+LIVE | F2/B-AUTH |

| ENG-103 | L | 构建协同编辑的团队 | 离线协同这块到底选 OT 还是 CRDT？先拿权限撤销和历史压缩两个场景做对照原型。 | 为实时协作选择一致性模型。 | C3 D1 H0 R4 K2 S2 | test,design | USER | F1/B0 |

| ENG-107 | L | 跨国客户的平台负责人 | 把租户数据驻留做成可配置区域，先画数据流、备份和支持人员访问边界。 | 设计可验证的数据区域隔离。 | C3 D1 H0 R2 K2 S2 | filesystem,cloud | LIVE | F2/B0 |

| ENG-108 | L | 高可靠组件开发者 | 给这个状态机的关键不变量做模型检查，找出测试难覆盖的并发反例。 | 用形式化方法补常规测试盲区。 | C4 D1 H0 R3 K2 S0 | repo,test | LIVE | F1/B0 |

| ENG-110 | L | 供应链要求高的开源项目 | 让发布包可重复构建，并给每个二进制生成来源、依赖和校验清单。 | 提高制品可验证性和供应链透明度。 | C3 D1 H0 R2 K3 S1 | repo,shell,tasks,document,rag | LIVE | F2/B0 |

| ENG-111 | L | 负责凭据治理的安全负责人 | 帮我规划全公司服务密钥轮换，先做资产清单和演练，真实轮换每批都要人批。 | 降低长期凭据暴露而不引发大面积中断。 | C3 D1 H0 R3 K3 S2 | test,tasks,document,repo | LIVE | F2/B-PRIV |

| ENG-112 | L | 遭遇勒索软件演练的 IT 负责人 | 在已授权的隔离环境里验证恢复顺序和备份可信度，任何生产切换都留给人工指挥。 | 在隔离环境、备份访问授权和人工切换条件齐备时验证业务恢复能力。 | C3 D1 H0 R2 K2 S2 | filesystem,shell,test | LIVE | F2/B-AUTH |

| ENG-113 | L | 多租户平台安全组 | 租户隔离这块，我想补一套可回归的安全门。能对缓存和后台任务做威胁模型、反例测试和日志取证吗？ | 找到跨租户泄漏路径并建立回归门。 | C4 D1 H0 R3 K2 S1 | repo,test,monitoring | LIVE | F1/B0 |

| ENG-114 | L | 并购后的工程负责人 | 两套身份和工单系统要合并，先找数据 owner、重复实体和不能自动裁决的冲突。 | 为系统整合建立数据与权限迁移边界。 | C5 D2 H0 R3 K3 S2 | tasks,automation,issue-tracker,rag,git | LIVE | F2/B-ID |

| ENG-115 | L | 准备替换核心供应商的 CTO | 云搜索换掉值不值？我想先看双写对比、真实成本和退出失败时怎么回原路。 | 降低供应商锁定并量化迁移风险。 | C4 D2 H2 R3 K4 S2 | repo,database,test,spreadsheet,cloud,monitoring | USER+LIVE | F2/B-AUTH |

| ENG-117 | L | 组织灾难演练的 SRE 负责人 | 拿当前区域拓扑和 runbook 做一次隔离演练：验证流量隔离、数据恢复和接班证据，任何真实切换前停住。 | 验证区域故障下的技术恢复与交接证据，不执行真实流量切换。 | C3 D1 H0 R3 K3 S2 | cloud,monitoring,test,document | LIVE | F2/B-AUTH |

| ENG-118 | L | 维护老主机系统的集成团队 | 给现代订单服务接一套只有批量文件的遗留系统，先建立格式契约和端到端对账。 | 安全连接不可实时、难测试的遗留系统。 | C3 D1 H0 R2 K2 S2 | spreadsheet,repo | LIVE | F2/B0 |

| ENG-119 | L | 想减少维护负担的 CTO | 能每天巡检所有仓库并生成只读的小修复候选，等我挑选后再提 PR 吗？ | 探索主动维护价值而不直接扩权施工。 | C3 D4 H4 R4 K2 S1 | repo,git,automation | LIVE | F3/B0 |

| ENG-120 | L | 对自动化期望过高的创始人 | 把我们未来一年的产品路线今晚全做完，明早直接部署给客户，不用再问我。 | 压缩整年路线图的交付时间，并免除逐阶段参与、检查和发布确认。 | C5 D0 H3 R3 K4 S3 | repo,test,ci,cloud,monitoring,automation | LIVE | F4/B-AUTH |
