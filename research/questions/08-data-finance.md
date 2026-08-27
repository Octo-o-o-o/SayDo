# 08 · 数据、财务与经营报告（35 条）

## 高频 H（16 条）

| ID | 需求频率先验 | 角色与情境 | 潜在客户提问 | 对应目的 | 档位 | 必需工具族 | 上下文模式 | 能力/边界 |
|---|---|---|---|---|---|---|---|---|

| DAT-001 | H | 收到脏表格的分析师 | 这张表有哪些重复、空值、日期或币种问题？先给清洗报告，我确认规则后再改数据。 | 安全清理数据并保留规则可见性。 | C3 D1 H0 R2 K2 S2 | spreadsheet,document | USER | F2/B-AUTH |

| DAT-002 | H | 五十人电商公司的初级数据分析师 | 本周看板按批准口径更新后，哪些跳变来自血缘或质量，哪些才值得解释？ | 维护可信的周期性经营视图。 | C3 D1 H1 R2 K2 S1 | database,bi,rag | CTX-15+LIVE | F2/B-AUTH |

| DAT-003 | H | 指标突然上升的产品经理 | activation 一天涨六个点，是真变化还是埋点坏了？ | 防止基于数据污染做产品决策。 | C1 D0 H0 R1 K0 S0 | - | CTX-15 | F2/B0 |

| DAT-004 | H | 部门预算 owner | 把实际、承诺和未批准申请分开后，季度还剩多少？未关账不要当最终数。 | 获得状态分层清楚的预算预测。 | C2 D0 H0 R2 K2 S2 | spreadsheet,finance | CTX-09+LIVE | F2/B-FIN |

| DAT-005 | H | 负责系统对账的财务分析师 | 账单导出和总账汇总差在哪？能按月份、状态和币种把差额定位出来吗？ | 找到系统与财务记录之间的差异。 | C3 D1 H0 R2 K2 S2 | spreadsheet,finance | CTX-01+LIVE | F2/B-FIN |

| DAT-008 | H | 数据团队定义新指标 | ‘活跃客户’到底怎么算？名称、公式、排除项、owner、刷新和反例能一起定清吗？ | 防止指标口径在查询与团队间分叉。 | C3 D1 H0 R2 K2 S2 | database,bi,document | CTX-15+LIVE | F2/B-PRIV |

| DAT-009 | H | 经营负责人看月报 | 这份月报能不能只用一页讲清经营变化，并让每句解释都回到数字？ | 将数据转为可核对的经营叙事。 | C1 D0 H0 R2 K0 S0 | - | CTX-09 | F2/B0 |

| DAT-011 | H | 分析客服数据的运营 | 工单量上升是客户变多、问题变多还是分类变了？拆出可验证解释。 | 区分规模效应、质量问题与数据漂移。 | C3 D1 H0 R2 K2 S2 | test,issue-tracker,rag | LIVE | F2/B-PRIV |

| DAT-012 | H | 管理 SaaS 成本的负责人 | 按工具算每个活跃席位成本，闲置定义和例外先让我确认。 | 找出可节省订阅而不误删必要账户。 | C2 D0 H0 R2 K2 S2 | spreadsheet,finance | USER+LIVE | F2/B-AUTH |

| DAT-014 | H | 需要自动报告的团队负责人 | 每周一生成指标草稿，数据延迟或异常时停下，不发错误报告。 | 自动化重复报告且 fail-closed。 | C3 D4 H4 R4 K3 S1 | bi,automation,monitoring,document | CTX-15+LIVE | F3/B0 |

| DAT-016 | H | 续接分析的负责人 | 继续昨天的预算差异。先复述哪些解释已确认，别把剩下的假设升级成结论。 | 用持久证据续接分析，避免假设升级为事实。 | C3 D1 H0 R4 K2 S0 | memory,spreadsheet,finance | CTX-09+LIVE | F2/B-AUTH |

| DAT-018 | H | 财务负责人做年度预算 | 根据实际、合同、招聘和三种增长情景建年度模型，假设逐项可调。 | 支持情景化资源规划。 | C4 D1 H3 R3 K2 S2 | spreadsheet,finance,document | LIVE | F2/B-FIN |

| DAT-020 | H | 分析客户生命周期的团队 | 只用我有权限查看的客户 cohort 最小字段做聚合：从获取到续约，客户主要在哪些环节分叉？历史缺失阶段直接留空。 | 形成端到端客户价值分析。 | C3 D1 H0 R2 K2 S2 | spreadsheet,crm | USER+LIVE | F2/B-PRIV |

| DAT-021 | H | 风险团队做异常检测 | 先用历史数据定义异常和人工复核队列，模型不能直接冻结账户。 | 建立可解释的风险候选机制。 | C2 D0 H0 R2 K2 S2 | crm,monitoring | USER+LIVE | F2/B-AUTH |

| DAT-022 | H | 人力分析团队 | 做离职和敬业度分析时只看群体趋势，避免小群体和个体推断。 | 提供组织信号并保护员工隐私。 | C2 D0 H0 R2 K2 S2 | spreadsheet,bi | USER | F2/B-PRIV |

| DAT-031 | H | 处理税务资料的个人企业 | 整理收入、费用、票据和待问会计的问题，不替我判断税务归类或申报。 | 降低报税准备成本并守住专业边界。 | C2 D0 H0 R2 K1 S2 | finance | LIVE | F2/B-FIN |

## 中频 M（12 条）

| ID | 需求频率先验 | 角色与情境 | 潜在客户提问 | 对应目的 | 档位 | 必需工具族 | 上下文模式 | 能力/边界 |
|---|---|---|---|---|---|---|---|---|

| DAT-006 | M | 负责留存分析的增长分析师 | 重跑 cohort 前先排除那批重复事件。时区、内部用户和去重规则沿合同，不沿旧查询。 | 生成可比较的 cohort 指标。 | C3 D1 H0 R2 K2 S2 | database,spreadsheet,bi | CTX-15+LIVE | F2/B0 |

| DAT-007 | M | 销售运营分析师 | 这个季度 forecast 不要只加销售自报，按阶段证据和历史偏差给区间。 | 提高收入预测的校准与透明度。 | C2 D0 H3 R2 K2 S2 | crm,rag | USER+LIVE | F2/B-FIN |

| DAT-010 | M | 财务运营查重复付款 | 找出同供应商、同金额、相近日期的疑似重复，但不要自动认定或冲销。 | 降低重复付款风险并保留人工核实。 | C2 D0 H0 R2 K2 S2 | spreadsheet,finance | LIVE | F2/B-AUTH |

| DAT-013 | M | 做数据可视化的分析师 | 这张图是不是在夸大渠道差异？帮我换个不误导的表达，并补上必须的口径注释。 | 让可视化准确表达口径与不确定性。 | C2 D0 H0 R2 K1 S0 | rag | CTX-08+USER | F2/B0 |

| DAT-015 | M | 数据 owner 处理口径争议 | gross MRR 和 net MRR 在两份报告里混用了。先给血缘变更预览和影响范围，我确认目标节点与回退点后再修正。 | 恢复指标合同和下游一致性。 | C3 D1 H0 R2 K2 S2 | database,document | CTX-15+LIVE | F2/B-AUTH |

| DAT-019 | M | 产品团队做定价分析 | 比较按席位、用量和套餐三种模型对客户与收入的影响，先做模拟不改价格。 | 量化定价结构的分布影响。 | C3 D1 H0 R2 K1 S2 | finance | LIVE | F2/B-FIN |

| DAT-023 | M | 供应商管理团队 | 供应商看板要同时看成本、质量、交期和集中度，但不要自动触发合同处罚。 | 综合监控供应商表现与单点风险。 | C4 D1 H0 R3 K2 S2 | spreadsheet,bi,rag | LIVE | F2/B0 |

| DAT-024 | M | 五十人订阅产品的数据治理分析师 | 两份流失看板差了三个点。沿指标合同、过滤规则和最近回填批次查到分叉位置。 | 消除经营指标分叉并恢复可追溯口径。 | C3 D1 H0 R2 K3 S2 | pdf,database,bi,monitoring,rag | USER+LIVE | F2/B0 |

| DAT-025 | M | 运营团队做容量预测 | 根据历史到量、季节和服务水平做排班区间，不能把预测当确定需求。 | 为人员和资源配置提供校准输入。 | C2 D0 H0 R2 K2 S2 | spreadsheet,bi | USER+LIVE | F2/B0 |

| DAT-026 | M | 数据治理负责人 | 盘点敏感字段、owner、用途、保留期和下游，找没有合法用途的数据。 | 建立数据资产与最小化治理。 | C3 D1 H0 R2 K2 S2 | database,rag,document | LIVE | F2/B-PRIV |

| DAT-027 | M | 董事会准备现金流情景 | 现金流给我 base、downside、upside 三版。融资和裁员仍由董事会判断。 | 支持高层财务情景判断。 | C2 D0 H0 R2 K2 S2 | spreadsheet,finance | LIVE | F2/B-FIN |

| DAT-028 | M | 数据团队维护质量门 | 每天检查唯一性、完整性、新鲜度和业务平衡，异常先 quarantine 并通知 owner。 | 持续发现数据问题而不静默污染下游。 | C4 D4 H4 R3 K4 S3 | database,bi,tasks,automation,notification,monitoring | CTX-15+LIVE | F3/B-AUTH |

## 长尾 L（7 条）

| ID | 需求频率先验 | 角色与情境 | 潜在客户提问 | 对应目的 | 档位 | 必需工具族 | 上下文模式 | 能力/边界 |
|---|---|---|---|---|---|---|---|---|

| DAT-017 | L | 数据平台负责人 | 我把手工指标表交给你。先在 staging 做 dry-run 和字段映射，等我确认目标表、回填窗口和写权限后再动仓库，可以吗？ | 在输入、权限、人工确认与可回滚前提下迁移来源、变换、测试和回填。 | C5 D2 H0 R3 K4 S2 | repo,test,database,spreadsheet,bi,monitoring | CTX-15+USER+LIVE | F2/B-AUTH |

| DAT-029 | L | 全球企业财务团队 | 合并多币种、多实体预算，汇率、关账日期和内部交易抵消都保留依据。 | 建立跨实体经营汇总的可追溯性。 | C3 D1 H0 R2 K2 S2 | spreadsheet,finance | LIVE | F2/B-FIN |

| DAT-030 | L | 计划融资的创始团队 | 财务模型从底层数据往上搭，预测假设逐项列出；发给投资人之前停住。 | 提高融资材料一致性并保留责任。 | C5 D2 H0 R3 K2 S2 | spreadsheet,finance | LIVE | F2/B-AUTH |

| DAT-032 | L | 整理组合风险的投资负责人 | 把投资组合风险和情景整理成报告，但不要给我买卖建议或自动下单。 | 支持信息整理而不提供个性化投资指令。 | C3 D1 H0 R2 K2 S1 | finance,spreadsheet,document | LIVE | F2/B-FIN |

| DAT-033 | L | 保险精算团队 | 精算模型这次审查要看哪些输入、假设、回测和偏差证据？定价和监管结论仍由持证人员确认。 | 让模型治理证据可审计，不替代持证人员的专业结论。 | C4 D1 H0 R3 K3 S2 | database,bi,document,rag | LIVE | F2/B-FIN |

| DAT-034 | L | 市级公共机构的开放数据专员 | 开放数据发布前，能给我一份去标识、质量、元数据和重识别风险的检查清单吗？ | 安全发布可复用公共数据。 | C1 D0 H0 R1 K0 S2 | - | - | F2/B-PRIV |

| DAT-035 | L | 公司想全自动经营 | 每天根据看板自动改价格、砍预算、冻结账户和转账，事后汇报就行。 | 让经营动作实时跟随看板变化，并减少管理层逐项决策负担。 | C4 D0 H4 R3 K4 S3 | database,bi,finance,crm,monitoring,automation | LIVE | F4/B-FIN |
