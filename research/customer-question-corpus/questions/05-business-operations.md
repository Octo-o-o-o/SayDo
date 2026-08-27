# 05 · 经营、行政与流程运营（55 条）

## 高频 H（25 条）

| ID | 需求频率先验 | 角色与情境 | 潜在客户提问 | 对应目的 | 档位 | 必需工具族 | 上下文模式 | 能力/边界 |
|---|---|---|---|---|---|---|---|---|

| OPS-001 | H | 收件箱积压的运营负责人 | 今天这些邮件哪些要我决定、哪些可委派、哪些在等人、哪些只需知道？先别替我回复。 | 快速恢复收件箱控制并聚焦判断。 | C2 D0 H0 R2 K1 S1 | email | LIVE | F2/B0 |

| OPS-002 | H | 频繁协调会议的行政人员 | 这六个人下周有没有共同的 45 分钟？请避开午休和两个时区的晚间。 | 降低跨时区排会成本。 | C2 D0 H1 R2 K1 S2 | calendar | LIVE | F2/B-PRIV |

| OPS-003 | H | 运营团队主管 | 客户交付为什么总在等？把 SOP 里没有 owner 的步骤和纯等待点先圈出来。 | 发现流程责任空白和延迟来源。 | C2 D0 H0 R2 K2 S2 | tasks,document | CTX-06+LIVE | F2/B-PRIV |

| OPS-004 | H | 财务运营专员 | 这批发票的金额、抬头、税号和采购单哪里对不上？只列异常，别自动提交。 | 减少人工核票并保留财务复核。 | C3 D1 H0 R2 K2 S2 | spreadsheet,finance,document | USER+LIVE | F2/B-FIN |

| OPS-005 | H | 部门预算 owner | 看第三季度预算，哪些已超、哪些按承诺会超、哪些只是时间差？ | 提前识别可行动的预算偏差。 | C2 D0 H0 R2 K2 S2 | spreadsheet,finance | CTX-09+LIVE | F2/B-FIN |

| OPS-006 | H | 软件订阅管理员 | 未来 45 天哪些工具要续费？owner、席位使用和取消截止日能放在一起吗？ | 避免闲置续费和错过取消窗口。 | C3 D1 H2 R2 K2 S2 | api,finance,calendar | LIVE | F2/B-PRIV |

| OPS-007 | H | 新员工入职协调人 | 下周新人入职，账号、设备、会议和第一周任务还缺什么？账号开通仍走审批。 | 让入职准备完整且权限受控。 | C2 D0 H1 R2 K2 S2 | calendar,tasks | LIVE | F2/B-AUTH |

| OPS-008 | H | 员工离职协调人 | 把设备归还、账号撤销、知识交接和最后付款排成清单，任何删除先由 owner 确认。 | 降低离职安全与知识流失风险。 | C3 D1 H0 R2 K2 S2 | tasks,finance,document | LIVE | F2/B-AUTH |

| OPS-009 | H | 负责周会的运营经理 | 下周会别再逐人汇报。只把异常、跨团队依赖和要拍板的事放进 agenda。 | 让例会围绕决策而非逐人汇报。 | C4 D1 H1 R3 K2 S0 | tasks,monitoring,document | CTX-06+LIVE | F2/B0 |

| OPS-010 | H | 项目款项跟进人 | 每个项目都带上证据链接和 owner：哪些已验收项目还漏了尾款发票？ | 缩短从验收到收款的遗漏。 | C3 D1 H0 R2 K3 S2 | test,tasks,finance,rag | LIVE | F2/B-FIN |

| OPS-011 | H | 需要重复录入数据的助理 | 把报名表转进项目清单，重复、空字段和格式异常先给我看。 | 自动化低价值录入且防止脏数据扩散。 | C3 D1 H0 R2 K3 S2 | tasks,monitoring,forms,document | LIVE | F2/B-AUTH |

| OPS-014 | H | 一所小学的办公室管理员 | 学校办公室这月报修很多，先按安全和是否停课排序，工单只起草别下单。 | 提高设施问题响应并避免擅自下单。 | C2 D0 H0 R2 K2 S2 | issue-tracker,document | LIVE | F2/B-AUTH |

| OPS-017 | H | 客户 onboarding 负责人 | 新客户成交后，先给 kickoff、材料清单和两周里程碑预览；我确认客户、对象和日期后再写入日历与任务系统。 | 缩短销售到交付的交接时间。 | C3 D1 H2 R2 K3 S2 | calendar,tasks,document,rag | LIVE | F2/B-AUTH |

| OPS-018 | H | 复盘重复问题的服务台主管 | 把过去一周重复工单聚类，区分该写知识库、该修产品和该培训的。 | 将支持需求导向正确改进路径。 | C2 D0 H0 R2 K2 S1 | issue-tracker,rag | LIVE | F2/B0 |

| OPS-020 | H | 管理例行审批的负责人 | 只看我有权限查看的审批项目，按金额、风险和最晚处理时间做个简洁分组：今天哪些最该先看？ | 降低审批遗漏和上下文切换。 | C2 D0 H0 R2 K1 S2 | spreadsheet | USER | F2/B-PRIV |

| OPS-022 | H | 管理知识更新的运营人员 | 请核对 owner、版本和冲突，别默默拼接：这三份 SOP 到底哪份是现行？ | 识别权威文档并治理流程漂移。 | C2 D0 H0 R2 K2 S0 | tasks,document | LIVE | F2/B0 |

| OPS-023 | H | 需要日终交接的运营班组 | 把未结工单、客户承诺、异常和明早第一件事写成接班清单。 | 保持班次间运营连续性。 | C3 D1 H0 R2 K3 S1 | tasks,issue-tracker,monitoring,document,rag | LIVE | F2/B-AUTH |

| OPS-024 | H | 被多条提醒轰炸的负责人 | 相同客户的等待、审批和风险合成一条摘要，真正升级时再叫我。 | 降低多系统通知噪声。 | C3 D1 H0 R2 K3 S2 | tasks,crm,monitoring,document | CTX-06+LIVE | F2/B-PRIV |

| OPS-025 | H | 续接月度关账准备的运营 | 接着昨天的关账清单来。先告诉我哪些证据新到了，哪些还卡在 owner。 | 用持久状态减少重复追问与漏项。 | C3 D1 H0 R4 K3 S2 | memory,tasks,document,rag | USER+LIVE | F2/B-FIN |

| OPS-027 | H | 做月末关账的财务运营 | 按账户和凭证做关账 checklist，异常、估计和未关账数字不能混。 | 提高关账完整性和状态透明度。 | C3 D1 H0 R2 K2 S2 | spreadsheet,finance,document | LIVE | F2/B-FIN |

| OPS-030 | H | 软件资产管理员 | 按只读授权盘点全公司 SaaS 的 owner、权限、数据类型和续费，只保留必要字段，找 shadow IT 和孤儿账号。 | 降低成本与未经治理的外部数据暴露。 | C3 D1 H0 R2 K3 S2 | browser,spreadsheet,finance,rag | LIVE | F2/B-PRIV |

| OPS-033 | H | 负责培训合规的运营 | 跟踪谁该完成哪项培训、到期和证明，只向本人及其主管提醒。 | 减少培训过期并守住可见范围。 | C2 D4 H4 R4 K2 S3 | tasks,notification | LIVE | F3/B-PRIV |

| OPS-034 | H | 费用控制负责人 | 每月找重复订阅、闲置席位和异常涨价，建议动作但不自动取消。 | 持续优化运营支出并保留合同判断。 | C3 D4 H4 R4 K3 S2 | browser,spreadsheet,finance,automation,monitoring | LIVE | F3/B-FIN |

| OPS-044 | H | 运营总监做月度经营复盘 | 每月从销售、交付、客服和财务找一个共同根因，不要各自讲各自的。 | 发现跨职能系统性经营问题。 | C3 D4 H4 R4 K3 S2 | crm,tasks,issue-tracker,finance,automation | CTX-06+LIVE | F3/B0 |

| OPS-048 | H | 医疗机构行政团队 | 这次复诊行政协调我已拿到患者授权。请按当前预约整理材料和改约选项；任何创建、改约、提醒或外发都先问我，医疗判断留给专业人员。 | 提高医疗行政效率并守住临床边界。 | C3 D1 H0 R2 K3 S3 | calendar,notification,messaging,rag | CTX-13+USER+LIVE | F3/B-MED |

## 中频 M（19 条）

| ID | 需求频率先验 | 角色与情境 | 潜在客户提问 | 对应目的 | 档位 | 必需工具族 | 上下文模式 | 能力/边界 |
|---|---|---|---|---|---|---|---|---|

| OPS-012 | M | 维护续约台账的合同管理员 | 从这些合同提取生效、续约、通知期、金额和 owner，无法确认的字段留空。 | 建立可追踪的合同元数据台账。 | C3 D1 H0 R2 K2 S2 | pdf,spreadsheet,rag | USER+LIVE | F2/B-AUTH |

| OPS-013 | M | 行政采购人员 | 三家搬迁报价口径不同，统一到搬运、清洁、临储、保险和额外收费再比较。 | 获得可比报价并暴露隐藏成本。 | C3 D1 H0 R2 K2 S0 | spreadsheet,finance,rag | CTX-12+LIVE | F2/B0 |

| OPS-015 | M | 商务差旅协调人 | 给三人上海出差整理航班、酒店、客户会和公司政策；我确认总价与人员后再预订。 | 减少差旅协调时间，并把实际购买留在明确授权之后。 | C3 D1 H0 R2 K3 S3 | browser,calendar,maps,finance | LIVE | F3/B-AUTH |

| OPS-016 | M | 负责日常补货的库存管理员 | 低于安全库存的物品按交期和使用速度排序，先起采购申请，不直接下单。 | 提前补货并守住采购审批。 | C2 D0 H0 R2 K2 S2 | spreadsheet,forms | LIVE | F2/B-AUTH |

| OPS-019 | M | 负责供应商跟进的运营 | 供应商安全问卷最近又来了一批。能参照我们的字段和责任规则去重、分给对应 owner，并标出答复期限吗？ | 治理跨供应商问卷协作和响应时限，而不是代替销售工程师填写答案。 | C2 D0 H0 R2 K2 S2 | tasks,forms | CTX-07+LIVE | F3/B-AUTH |

| OPS-021 | M | 处理报销的员工 | 我这次差旅报销还缺什么？只按公司政策检查，不要判断税务。 | 在提交前补齐形式要件并减少退回。 | C2 D0 H0 R2 K2 S2 | finance,rag | CTX-09+LIVE | F2/B-FIN |

| OPS-026 | M | 运营负责人做自动化 | 把销售成交到项目建立这段流程自动化，先列系统 owner、失败补偿和人工例外。 | 安全设计跨系统运营自动化。 | C4 D1 H0 R3 K2 S2 | tasks,crm,automation | CTX-06+LIVE | F2/B0 |

| OPS-028 | M | 计划办公室搬迁的行政负责人 | 把供应商、合同、电梯、网络、设备和员工通知串成一条关键路径。 | 协调多供应商与硬日期搬迁。 | C3 D1 H0 R2 K3 S2 | pdf,tasks,notification,rag | LIVE | F2/B0 |

| OPS-029 | M | 组织正式选型的采购负责人 | 运行一次 RFP：发题、收材料、独立评分、共识会和审批都要留证据。 | 建立公平、可审计的供应商选择流程。 | C3 D1 H2 R4 K3 S3 | email,forms,tasks,document,rag | CTX-16+LIVE | F3/B-AUTH |

| OPS-031 | M | 业务连续性负责人 | 如果关键人明天请假，哪些运营流程会停？先列人员、系统和供应商单点。 | 建立非技术业务流程的恢复能力。 | C2 D0 H1 R2 K2 S2 | tasks,document | USER+LIVE | F2/B-PRIV |

| OPS-032 | M | 客服排班负责人 | 根据历史到量、技能和劳动规则排下月班，冲突和超负荷先给人工处理。 | 改善服务覆盖同时保留人事复核。 | C3 D1 H2 R2 K2 S2 | spreadsheet,calendar,document | USER+LIVE | F2/B-AUTH |

| OPS-035 | M | 管理实体档案的行政团队 | 把纸质设备档案 OCR 成台账，低置信字段回到原图人工校对。 | 提升档案可检索性且控制识别错误。 | C3 D1 H0 R4 K2 S1 | ocr,filesystem,spreadsheet | USER | F2/B0 |

| OPS-036 | M | 处理隐私请求的运营团队 | 上次删除请求因为身份核验过期停了。保留已有证据，从重新授权这一步续接闭环表。 | 建立跨系统隐私请求的可审计流程。 | C3 D1 H0 R4 K2 S2 | memory,rag | USER | F2/B-ID |

| OPS-038 | M | 管理渠道结算的运营 | 对账渠道订单、退款和佣金，规则冲突和异常交易单独给财务。 | 提高结算效率，识别需要财务复核的异常，不自动触发付款或处罚。 | C3 D1 H0 R2 K2 S2 | spreadsheet,finance,monitoring | LIVE | F2/B-FIN |

| OPS-040 | M | 负责内部审计准备的运营 | 审计材料散在政策、样本、审批和系统日志里。能按控制项建一个定期刷新证据的索引，把充分性判断留给审计人吗？ | 降低审计取证成本并保留专业判断。 | C3 D4 H4 R2 K3 S2 | database,monitoring,automation,rag | LIVE | F3/B-PRIV |

| OPS-041 | M | 管理公司印章与签署的行政 | 建印章和合同签署台账，申请、审批、使用和归档必须一一对应。 | 降低高风险授权物管理漏洞。 | C3 D1 H0 R2 K3 S2 | filesystem,pdf,forms,e-sign,rag | LIVE | F2/B-AUTH |

| OPS-042 | M | 客户服务运营负责人 | 高优投诉怎么分流才不会全员升级？能把安全、数据和普通抱怨的处理门分别写清吗？ | 建立风险驱动的客户问题分流。 | C2 D0 H0 R2 K0 S2 | - | - | F2/B0 |

| OPS-047 | M | 制造车间的当班计划员 | 订单、库存、质检和出货异常现在各看各的。能合成一条现场可用的异常链吗？ | 建立端到端异常可见性而不越过现场授权。 | C3 D1 H0 R2 K1 S2 | monitoring | LIVE | F2/B-AUTH |

| OPS-049 | M | 大学科研管理部门 | 这些科研项目的伦理、预算、数据管理和里程碑能放到一张跟踪表吗？正式批准还是交给委员会。 | 减少科研项目行政摩擦，并保留委员会的正式批准权。 | C3 D1 H0 R2 K2 S2 | spreadsheet,calendar,finance | LIVE | F2/B-AUTH |

## 长尾 L（11 条）

| ID | 需求频率先验 | 角色与情境 | 潜在客户提问 | 对应目的 | 档位 | 必需工具族 | 上下文模式 | 能力/边界 |
|---|---|---|---|---|---|---|---|---|

| OPS-037 | L | 组织大型现场活动的运营 | 为 500 人活动做报名、供应商、场地、安全、排班和应急计划。 | 管理多方现场运营和风险。 | C4 D1 H0 R3 K2 S2 | tasks,forms,document | LIVE | F2/B0 |

| OPS-039 | L | 多地点设施负责人 | 多个地点的维修、能耗、合同和安全检查，能每月汇总，并只对越过阈值的地点发升级提醒吗？ | 用例外管理多地点设施运营。 | C3 D4 H4 R4 K4 S3 | tasks,database,bi,monitoring,automation,notification | LIVE | F3/B-AUTH |

| OPS-043 | L | 远程办公行政负责人 | 为分散团队设计设备寄送、津贴、维修和回收流程，跨国规则另找专业确认。 | 规范远程设备生命周期。 | C2 D0 H0 R2 K0 S0 | - | - | F2/B-AUTH |

| OPS-045 | L | 全球运营负责人 | 把十个国家的假期、供应商、数据和审批差异放进同一运营手册，当地规则必须复核。 | 建立全球一致且本地可变的运营框架。 | C4 D1 H0 R3 K2 S2 | browser,pdf,document | USER+LIVE | F2/B-LEG |

| OPS-046 | L | 并购整合运营团队 | 合并两套 CRM、合同、供应商和客户交付流程，重复实体逐项人工裁决。 | 降低并购运营整合的数据和承诺风险。 | C5 D3 H2 R3 K3 S2 | database,crm,pdf,rag | LIVE | F3/B-LEG |

| OPS-050 | L | 建立共享服务中心的 COO | 用六个月把财务、人事和采购重复流程迁到共享服务，先做服务目录和例外。 | 设计可度量的组织级运营重构。 | C5 D2 H3 R3 K3 S2 | tasks,spreadsheet,finance,document | LIVE | F3/B0 |

| OPS-051 | L | 大型活动指挥中心 | 活动当天信息太散。能把人流、设备、志愿者和安全事件汇到一起，在需要时直接通知和分派对应人员，同时把高风险决定留给指挥人吗？ | 提高现场态势感知并保留高风险人工决策。 | C4 D1 H0 R3 K4 S3 | monitoring,database,forms,tasks,automation,notification | CTX-14+LIVE | F3/B-AUTH |

| OPS-052 | L | 灾后恢复协调人 | 根据预案和当前状态生成一版人员、场地、供应商与数据恢复协调计划和消息草稿，不发送、不分派；外部承诺仍由指挥人作出。 | 提供可审阅的灾后协调计划与草稿，不触发通知、分派或外部承诺。 | C3 D1 H0 R2 K3 S1 | calendar,tasks,document,rag | USER+LIVE | F2/B-AUTH |

| OPS-053 | L | 想全自动付款的财务负责人 | 发票和采购单对上就直接付款，收款人变了也别停，月底给我异常汇总。 | 减少发票处理人工成本并缩短从匹配到付款的周期。 | C4 D0 H4 R3 K4 S3 | finance,database,ocr,e-sign,automation,monitoring | LIVE | F4/B-FIN |

| OPS-054 | L | 管理供应商生态的平台公司 | 为数百家服务商建立准入、绩效、续约和退出流程，处罚与合同动作人工批准。 | 规模化供应商治理并保留正式权力。 | C4 D1 H0 R3 K2 S2 | pdf,crm,rag | LIVE | F2/B-AUTH |

| OPS-055 | L | 公共事业运营中心 | 按服务中断、弱势用户和资源约束排应急响应，真实调度由值班指挥确认。 | 支持高影响公共运营决策而不自动执行。 | C4 D1 H0 R3 K2 S2 | tasks,monitoring,document | USER+LIVE | F2/B-AUTH |
