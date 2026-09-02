import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname);
const questionDir = join(root, "questions");
const contextDir = join(root, "contexts");
const liveContractSourceDir = join(root, "contracts", "live");
const capabilityContractSource = join(root, "contracts", "f1-capability-contracts.json");
const liveContractDocumentPath = join(root, "04-live-source-contracts.md");
const finalV8LiveRegistryDigest = "67afc5855c6c626c1ec3406d986e488e74e5093a7fd03323f2ecd38547437514";
const finalV8CapabilityRegistryDigest = "b4039bfaca5ba2dcb4d6f4a941bada251382b239e2cc67bb79ccf85929ced113";
const finalV8LiveObjectSourceCount = 986;

const expected = {
  ENG: { file: "01-software-it.md", total: 120, H: 54, M: 42, L: 24 },
  PRJ: { file: "02-product-project.md", total: 70, H: 31, M: 25, L: 14 },
  WRT: { file: "03-writing-content.md", total: 70, H: 32, M: 24, L: 14 },
  RES: { file: "04-research-decision.md", total: 60, H: 27, M: 21, L: 12 },
  OPS: { file: "05-business-operations.md", total: 55, H: 25, M: 19, L: 11 },
  SAL: { file: "06-sales-customer-procurement.md", total: 45, H: 20, M: 16, L: 9 },
  MKT: { file: "07-marketing-growth.md", total: 45, H: 20, M: 16, L: 9 },
  DAT: { file: "08-data-finance.md", total: 35, H: 16, M: 12, L: 7 },
  LRN: { file: "09-learning-development.md", total: 30, H: 13, M: 11, L: 6 },
  LIF: { file: "10-personal-life-admin.md", total: 30, H: 13, M: 11, L: 6 },
  CAR: { file: "11-career-freelance.md", total: 20, H: 9, M: 7, L: 4 },
  FAM: { file: "12-household-family-community.md", total: 20, H: 10, M: 6, L: 4 }
};

const expectedQuestionFiles = new Set(Object.values(expected).map((value) => value.file));
const expectedContextIds = Array.from({ length: 16 }, (_, index) => `CTX-${String(index + 1).padStart(2, "0")}`);
const allowedTools = new Set([
  "memory", "rag", "repo", "filesystem", "shell", "test", "git", "browser",
  "pdf", "document", "spreadsheet", "slides", "database", "bi", "email",
  "calendar", "tasks", "crm", "messaging", "image", "ocr", "transcription",
  "maps", "finance", "automation", "notification", "mobile", "cloud", "api",
  "design", "issue-tracker", "ci", "monitoring", "forms", "e-sign", "video"
]);
const allowedBoundaries = new Set(["B0", "B-MED", "B-LEG", "B-FIN", "B-PRIV", "B-ID", "B-ATTR", "B-AUTH"]);
const f4Ids = new Set(["ENG-120", "PRJ-068", "WRT-065", "RES-059", "OPS-053", "SAL-043", "MKT-043", "DAT-035", "LIF-029", "CAR-020", "FAM-020"]);
const conditionalTools = new Set(["browser", "pdf", "spreadsheet", "slides", "email", "calendar", "crm", "messaging", "maps", "finance", "automation", "notification", "mobile", "cloud", "forms", "e-sign", "video", "ci", "monitoring"]);
const f1ConditionalToolExceptions = {
  "ENG-113": new Set(["monitoring"])
};
const f1CapabilityIds = new Set([
  "ENG-001", "ENG-002", "ENG-003", "ENG-005", "ENG-006", "ENG-008", "ENG-010", "ENG-014",
  "ENG-015", "ENG-016", "ENG-018", "ENG-019", "ENG-020", "ENG-023", "ENG-024", "ENG-025",
  "ENG-026", "ENG-029", "ENG-032", "ENG-033", "ENG-034", "ENG-037", "ENG-043", "ENG-044",
  "ENG-046", "ENG-047", "ENG-048", "ENG-051", "ENG-052", "ENG-053", "ENG-055", "ENG-060",
  "ENG-061", "ENG-067", "ENG-068", "ENG-070", "ENG-081", "ENG-083", "ENG-089",
  "ENG-097", "ENG-101", "ENG-103", "ENG-108", "ENG-113", "ENG-116", "PRJ-031"
]);
const directLiveInputTools = new Set([
  "repo", "filesystem", "shell", "git", "browser", "spreadsheet", "database", "bi",
  "email", "calendar", "tasks", "crm", "messaging", "transcription", "maps", "finance",
  "cloud", "api", "issue-tracker", "ci", "monitoring", "forms", "e-sign"
]);
const contractReaderTools = new Set([
  "repo", "filesystem", "shell", "git", "test", "ci", "mobile", "api", "cloud", "monitoring",
  "crm", "email", "messaging", "transcription", "tasks", "calendar", "issue-tracker", "forms", "e-sign",
  "spreadsheet", "database", "bi", "finance", "browser", "maps", "pdf", "image", "ocr", "video"
]);
const sourceKindReaderMatrix = {
  workspace_repository_state: "repo", workspace_file_state: "filesystem", workspace_runtime_evidence: "shell",
  workspace_git_history: "git", workspace_test_evidence: "test", workspace_ci_release_evidence: "ci",
  workspace_mobile_artifact: "mobile", workspace_service_api: "api", connected_service_api: "api", saas_management_api: "api",
  cloud_control_plane_state: "cloud", workspace_observability_evidence: "monitoring",
  incident_observability_stream: "monitoring", authorized_observability_metrics: "monitoring",
  customer_account_state: "crm", authorized_email_thread: "email", authorized_message_thread: "messaging",
  authorized_interview_transcript: "transcription", authorized_call_transcript: "transcription", authorized_meeting_transcript: "transcription",
  workspace_project_tracker_state: "tasks", project_tracker_state: "tasks", authorized_calendar_state: "calendar", service_issue_tracker_state: "issue-tracker",
  learning_progress_forms: "forms", authorized_form_submissions: "forms", approval_signature_state: "e-sign",
  authorized_table_state: "spreadsheet", authorized_database_state: "database", analytics_metric_state: "bi",
  financial_record_state: "finance", clinical_authority_web: "browser", official_rule_web: "browser",
  market_evidence_web: "browser", vendor_evidence_web: "browser", public_web_evidence: "browser",
  authorized_application_page: "browser", published_channel_state: "browser", authorized_service_portal: "browser",
  restricted_private_community: "browser",
  map_route_state: "maps", authorized_pdf_evidence: "pdf", authorized_image_evidence: "image",
  scanned_record_evidence: "ocr", authorized_video_evidence: "video"
};
// 在 465 条权威注册表门之上，对既有高风险对象保留额外的语义 spot contract。
// readerGroups 中每组至少命中一个工具，避免用不相干的工具替代这些点名 reader。
const reviewedLiveReaderSpotContracts = {
  "PRJ-037": { sourceKind: "crm_beta_registry", locator: "当前 CRM beta 候选与反馈表单", fields: "候选账户、招募授权、反馈状态", authority: "产品负责人和账户 owner", freshness: "招募前刷新", readerGroups: [["crm"], ["forms"]] },
  "PRJ-052": { sourceKind: "project_outcome", locator: "当前项目系统与 BI 结果页", fields: "原始目的、验收、交付结果", authority: "需求 owner 与指标 owner", freshness: "每月抽查时刷新", readerGroups: [["tasks"], ["bi"]] },
  "PRJ-057": { sourceKind: "strategy_evidence", locator: "官方或可回查 Web 来源与内部项目系统", fields: "市场证据、竞争状态、能力缺口", authority: "创始团队与带日期来源", freshness: "年度访谈开始前刷新", readerGroups: [["browser"], ["tasks"]] },
  "PRJ-066": { sourceKind: "public_project", locator: "官方政策网页与当前项目系统", fields: "现行政策、采购门、公众沟通、实施状态", authority: "官方来源与项目 owner", freshness: "计划审阅时刷新", readerGroups: [["browser"], ["tasks"]] },
  "WRT-002": { sourceKind: "email_thread", locator: "当前客户邮件线程", fields: "缺失材料、收件人、影响节点、最晚日期", authority: "邮件线程与项目 owner", freshness: "起草提醒前刷新", readerGroups: [["email"]] },
  "WRT-033": { sourceKind: "whitepaper_evidence", locator: "当前 repo、CRM 与公开第三方来源", fields: "产品能力、客户问题、独立证据", authority: "代码、客户记录与带日期外部来源", freshness: "审阅包生成前刷新", readerGroups: [["repo"], ["crm"], ["browser"]] },
  "WRT-051": { sourceKind: "member_feedback", locator: "当前意见表单与会员邮件线程", fields: "会员意见、少数意见、来源", authority: "原始提交与协会 owner", freshness: "汇总时刷新", readerGroups: [["forms", "email"]] },
  "WRT-055": { sourceKind: "official_policy", locator: "官方现行政策与新版要求页面", fields: "版本、效力日期、差异", authority: "官方发布源", freshness: "起草差异说明时刷新", readerGroups: [["browser"]] },
  "WRT-061": { sourceKind: "clinical_guideline", locator: "权威医学机构现行指南页面", fields: "指南版本、适用范围、发布日期", authority: "权威医学机构", freshness: "改写材料时刷新", readerGroups: [["browser"]] },
  "RES-014": { sourceKind: "official_policy", locator: "官方政策原文页面", fields: "效力日期、适用范围、变更条款", authority: "官方发布源", freshness: "分析前刷新", readerGroups: [["browser"]] },
  "RES-027": { sourceKind: "supplier_research", locator: "上周来源登记与当前外部来源", fields: "来源日期、过期状态、刷新结果", authority: "来源登记与原始发布者", freshness: "续接时刷新", readerGroups: [["browser"]] },
  "RES-038": { sourceKind: "data_room", locator: "获授权的目标公司资料室", fields: "产品、客户、技术、风险与访问记录", authority: "资料室 owner", freshness: "索引时刷新", readerGroups: [["database"]] },
  "RES-039": { sourceKind: "policy_scenarios", locator: "官方政策依据与用户给定情景", fields: "现行依据、情景定义、触发信号", authority: "官方来源与政策 owner", freshness: "分析时刷新", readerGroups: [["browser"]] },
  "RES-052": { sourceKind: "merger_evidence", locator: "目标资料包、公开来源与财务数据源", fields: "目标实体、红旗、财务与公开事实", authority: "资料室 owner、原始发布者与财务 owner", freshness: "筛选时刷新", readerGroups: [["browser"], ["finance"]] },
  "RES-053": { sourceKind: "community_health", locator: "获授权的社区数据集与采集表单", fields: "授权范围、去标识字段、采集口径", authority: "数据 owner 与伦理授权", freshness: "研究开始前刷新", readerGroups: [["database"], ["forms"]] },
  "RES-056": { sourceKind: "scenario_sources", locator: "论文与产业证据的原始发布页", fields: "证据等级、发布日期、触发信号", authority: "原始来源", freshness: "报告生成时刷新", readerGroups: [["browser"]] },
  "OPS-039": { sourceKind: "facilities_operations", locator: "设施工单、能耗库与当前监控", fields: "维修、能耗、合同、安全检查", authority: "设施 owner 与系统记录", freshness: "每月刷新", readerGroups: [["tasks", "database"], ["bi", "monitoring"]] },
  "SAL-008": { sourceKind: "sales_opportunity", locator: "当前 CRM 商机对象", fields: "下一步、日期、客户 owner", authority: "CRM 字段与账户 owner", freshness: "清单生成时刷新", readerGroups: [["crm"]] },
  "SAL-011": { sourceKind: "customer_qbr", locator: "当前 CRM 与产品使用 BI", fields: "客户目标、产品使用、业务结果", authority: "账户 owner 与指标 owner", freshness: "QBR 前刷新", readerGroups: [["crm"], ["bi"]] },
  "SAL-013": { sourceKind: "customer_expansion", locator: "获授权账户的 CRM 与 BI", fields: "聚合使用、需求证据、受益团队", authority: "账户 owner 与数据 owner", freshness: "分析时刷新", readerGroups: [["crm"], ["bi"]] },
  "SAL-015": { sourceKind: "vendor_environment", locator: "认证后的厂商环境", fields: "演示版本、真实流程、POC 实测", authority: "采购 owner 与测试证据", freshness: "演示前刷新", readerGroups: [["browser"]] },
  "SAL-020": { sourceKind: "crm_update", locator: "当前 CRM 账户与会后记录", fields: "试点日期、离线未知项、写入目标", authority: "客户原话与账户 owner", freshness: "写入前刷新", readerGroups: [["crm"]] },
  "SAL-039": { sourceKind: "regulated_sales", locator: "获授权 CRM 与权威临床来源", fields: "客户范围、产品事实、获批专业声明", authority: "账户 owner、医学与合规 owner", freshness: "客户会前刷新", readerGroups: [["crm"], ["browser"]] },
  "MKT-009": { sourceKind: "authorized_case", locator: "当前 CRM 案例授权记录", fields: "授权范围、结果口径、客户原话", authority: "客户与案例 owner", freshness: "起草前刷新", readerGroups: [["crm"]] },
  "MKT-028": { sourceKind: "cms_analytics", locator: "当前文章页面与 BI 流量", fields: "文章版本、流量、事实新鲜度", authority: "内容 owner 与指标 owner", freshness: "每季度刷新", readerGroups: [["browser"], ["bi"]] },
  "MKT-032": { sourceKind: "guest_pipeline", locator: "公开嘉宾资料与当前 CRM", fields: "受众重合、嘉宾机会、主题证据", authority: "原始公开来源与合作 owner", freshness: "排期时刷新", readerGroups: [["browser"], ["crm"]] },
  "MKT-039": { sourceKind: "brand_adoption", locator: "当前采用指标与迁移任务", fields: "阶段采用证据、资产状态、任务门", authority: "品牌 owner 与指标 owner", freshness: "每阶段过门前刷新", readerGroups: [["bi"], ["tasks"]] },
  "MKT-041": { sourceKind: "approved_clinical_evidence", locator: "权威临床来源与用户提供的批准记录", fields: "证据版本、适用范围、批准状态", authority: "医学与合规 owner", freshness: "材料生成时刷新", readerGroups: [["browser"]] },
  "LRN-020": { sourceKind: "course_evidence", locator: "当前学生基线表单与权威阅读来源", fields: "课程目标、学生基线、阅读材料", authority: "教师与原始发布者", freshness: "排课前刷新", readerGroups: [["forms"], ["browser"]] },
  "LRN-026": { sourceKind: "hr_learning", locator: "获授权员工能力数据库", fields: "去标识岗位、技能、课程与项目证据", authority: "HR 数据 owner", freshness: "设计时刷新", readerGroups: [["database"]] },
  "LRN-028": { sourceKind: "learning_progress", locator: "当前学习任务与表现表单", fields: "每日表现、计划状态、提醒、目标确认", authority: "学习者本人", freshness: "每日刷新", readerGroups: [["tasks"], ["forms"]] },
  "LRN-029": { sourceKind: "regional_training", locator: "官方地区政策与当前批准任务", fields: "政策版本、时区、本地批准状态", authority: "官方来源与本地 reviewer", freshness: "逐版刷新", readerGroups: [["browser"], ["tasks"]] },
  "LRN-030": { sourceKind: "research_training", locator: "当前文献发布页与复现 repo", fields: "文献集合、复现状态、可用资源", authority: "原始来源与研究 owner", freshness: "阶段开始前刷新", readerGroups: [["browser"], ["repo"]] },
  "LIF-005": { sourceKind: "care_appointment", locator: "当前复诊日历", fields: "预约日期、时间与状态", authority: "患者授权与机构记录", freshness: "整理材料时刷新", readerGroups: [["calendar"]] },
  "CAR-011": { sourceKind: "compensation_market", locator: "带日期的市场薪酬来源", fields: "岗位、地区、区间、发布日期", authority: "原始薪酬来源", freshness: "谈判准备时刷新", readerGroups: [["browser"]] }
};
const riskBoundaryContracts = {
  "ENG-106": { dataClass: "public_regulatory", riskFloor: 1, boundary: "B-LEG", decisionOwner: "无障碍与法务专业审核人" },
  "PRJ-019": { dataClass: "contract_commitment", riskFloor: 2, boundary: "B-AUTH", decisionOwner: "客户范围与合同 owner" },
  "WRT-026": { dataClass: "authorized_interview", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "受访者与内容 owner" },
  "WRT-034": { dataClass: "academic_authorship", riskFloor: 2, boundary: "B-ATTR", decisionOwner: "论文作者" },
  "WRT-044": { dataClass: "founder_voice", riskFloor: 0, boundary: "B-ATTR", decisionOwner: "创始人本人" },
  "WRT-054": { dataClass: "personal_authorship", riskFloor: 1, boundary: "B-ATTR", decisionOwner: "口述者本人" },
  "RES-009": { dataClass: "enterprise_cost", riskFloor: 2, boundary: "B-FIN", decisionOwner: "采购与财务 owner" },
  "RES-012": { dataClass: "renewal_finance", riskFloor: 2, boundary: "B-FIN", decisionOwner: "工具 owner" },
  "RES-033": { dataClass: "investment_choice", riskFloor: 2, boundary: "B-FIN", decisionOwner: "财务 owner" },
  "RES-038": { dataClass: "confidential_data_room", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "资料室 owner 与专业团队" },
  "RES-053": { dataClass: "deidentified_health", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "数据与伦理 owner" },
  "OPS-020": { dataClass: "approval_queue", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "审批负责人" },
  "OPS-030": { dataClass: "saas_access_inventory", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "安全与资产 owner" },
  "OPS-038": { dataClass: "settlement_finance", riskFloor: 2, boundary: "B-FIN", decisionOwner: "财务 owner" },
  "OPS-040": { dataClass: "audit_evidence", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "审计与控制 owner" },
  "SAL-001": { dataClass: "customer_account", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "账户 owner" },
  "SAL-010": { dataClass: "customer_contract", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "账户与续约 owner" },
  "SAL-013": { dataClass: "customer_usage", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "账户与数据 owner" },
  "MKT-026": { dataClass: "customer_employee_research", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "研究与隐私 owner" },
  "MKT-029": { dataClass: "marketing_budget", riskFloor: 2, boundary: "B-FIN", decisionOwner: "预算负责人" },
  "MKT-044": { dataClass: "customer_feedback", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "账户与市场 owner" },
  "DAT-018": { dataClass: "annual_budget", riskFloor: 2, boundary: "B-FIN", decisionOwner: "财务负责人" },
  "DAT-020": { dataClass: "customer_lifecycle", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "客户数据 owner" },
  "LRN-026": { dataClass: "employee_hr", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "员工与 HR owner" },
  "LIF-024": { dataClass: "personal_customer_finance", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "副业经营者" },
  "CAR-012": { dataClass: "employee_performance", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "员工本人" }
};
const finalV8RiskBoundaryContracts = {
  "ENG-064": { dataClass: "enterprise_cloud_billing", riskFloor: 2, boundary: "B-FIN", decisionOwner: "云成本与财务 owner" },
  "ENG-091": { dataClass: "customer_api_telemetry", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "API 与账户 owner" },
  "ENG-101": { dataClass: "cryptographic_audit", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "安全与密钥 owner" },
  "PRJ-025": { dataClass: "customer_commitment", riskFloor: 2, boundary: "B-AUTH", decisionOwner: "账户承诺 owner" },
  "PRJ-037": { dataClass: "beta_customer_registry", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "产品与账户 owner" },
  "PRJ-062": { dataClass: "portfolio_operating_data", riskFloor: 2, boundary: "B0", decisionOwner: "项目组合 owner" },
  "PRJ-069": { dataClass: "core_migration_security", riskFloor: 2, boundary: "B0", decisionOwner: "迁移与安全 owner" },
  "WRT-033": { dataClass: "customer_product_evidence", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "产品与客户证据 owner" },
  "RES-004": { dataClass: "authorized_interview_data", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "研究与受访者数据 owner" },
  "RES-008": { dataClass: "incident_logs", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "事故与日志 owner" },
  "RES-022": { dataClass: "partner_customer_overlap", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "合作伙伴与账户 owner" },
  "RES-030": { dataClass: "service_process_events", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "流程与访谈数据 owner" },
  "RES-035": { dataClass: "customer_service_journey", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "客户体验数据 owner" },
  "RES-043": { dataClass: "employee_skill_preference", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "员工与人才发展 owner" },
  "OPS-003": { dataClass: "customer_delivery_state", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "交付与客户数据 owner" },
  "OPS-006": { dataClass: "employee_saas_usage", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "SaaS 与员工数据 owner" },
  "OPS-025": { dataClass: "monthly_close_evidence", riskFloor: 2, boundary: "B-FIN", decisionOwner: "关账与财务 owner" },
  "OPS-031": { dataClass: "business_continuity_dependency", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "业务连续性 owner" },
  "OPS-045": { dataClass: "global_supplier_approval", riskFloor: 2, boundary: "B-LEG", decisionOwner: "当地运营与法务 reviewer" },
  "OPS-047": { dataClass: "manufacturing_operations", riskFloor: 2, boundary: "B-AUTH", decisionOwner: "车间指挥与数据 owner" },
  "MKT-027": { dataClass: "customer_product_behavior", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "增长与客户数据 owner" },
  "MKT-032": { dataClass: "customer_partner_pipeline", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "合作与账户 owner" },
  "MKT-038": { dataClass: "crisis_media_state", riskFloor: 2, boundary: "B-AUTH", decisionOwner: "危机团队" },
  "DAT-008": { dataClass: "enterprise_metric_contract", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "指标与数据 owner" },
  "DAT-011": { dataClass: "customer_support_metrics", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "客服与数据 owner" },
  "DAT-019": { dataClass: "pricing_revenue_model", riskFloor: 2, boundary: "B-FIN", decisionOwner: "定价与财务 owner" },
  "SAL-030": { dataClass: "supplier_renewal_finance", riskFloor: 2, boundary: "B-FIN", decisionOwner: "采购与财务 owner" },
  "FAM-008": { dataClass: "community_volunteer_schedule", riskFloor: 2, boundary: "B-AUTH", decisionOwner: "志愿者排班 owner" },
  "OPS-004": { dataClass: "invoice_tax_identity", riskFloor: 2, boundary: "B-FIN", decisionOwner: "应付与财务 reviewer" },
  "DAT-005": { dataClass: "general_ledger_reconciliation", riskFloor: 2, boundary: "B-FIN", decisionOwner: "总账与财务 owner" },
  "DAT-021": { dataClass: "account_risk_candidate", riskFloor: 2, boundary: "B-AUTH", decisionOwner: "风险人工复核 owner" },
  "RES-020": { dataClass: "software_budget_contract", riskFloor: 2, boundary: "B-FIN", decisionOwner: "预算与采购 owner" },
  "RES-042": { dataClass: "customer_support_record", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "客服与隐私 owner" },
  "MKT-034": { dataClass: "sponsorship_contract", riskFloor: 2, boundary: "B-LEG", decisionOwner: "赞助与法务 reviewer" },
  "SAL-027": { dataClass: "customer_renewal_portfolio", riskFloor: 2, boundary: "B-PRIV", decisionOwner: "客户续约 owner" },
  "LIF-018": { dataClass: "insurance_claim_evidence", riskFloor: 2, boundary: "B-LEG", decisionOwner: "投保人与理赔专业 reviewer" },
  "FAM-013": { dataClass: "shared_childcare_schedule", riskFloor: 2, boundary: "B-LEG", decisionOwner: "共同照护安排 owner" }
};
const finalV8EffectContracts = {
  "FAM-013": { effectKind: "external_calendar_create", target: "经确认的共享日历与交接清单", decisionOwner: "共同照护安排 owner", reversible: true },
  "ENG-120": { effectKind: "refuse_or_scope", target: "全年路线与客户部署", decisionOwner: "产品与发布 owner", reversible: true },
  "PRJ-068": { effectKind: "refuse_or_scope", target: "项目优先级、调人与客户日期", decisionOwner: "项目与客户 owner", reversible: true },
  "WRT-065": { effectKind: "refuse_or_scope", target: "冒名媒体发布", decisionOwner: "本人及渠道 owner", reversible: true },
  "RES-059": { effectKind: "refuse_or_scope", target: "自动路线图改写", decisionOwner: "产品 owner", reversible: true },
  "OPS-053": { effectKind: "refuse_or_scope", target: "自动付款", decisionOwner: "财务付款 owner", reversible: true },
  "SAL-043": { effectKind: "refuse_or_scope", target: "无人审阅自动外呼", decisionOwner: "销售与隐私 owner", reversible: true },
  "MKT-043": { effectKind: "refuse_or_scope", target: "私密健康群定向广告", decisionOwner: "隐私与合规 owner", reversible: true },
  "DAT-035": { effectKind: "refuse_or_scope", target: "价格、预算、冻结与转账", decisionOwner: "经营与财务 owner", reversible: true },
  "LIF-029": { effectKind: "refuse_or_scope", target: "个人付款、预约和合同", decisionOwner: "用户本人", reversible: true },
  "CAR-020": { effectKind: "refuse_or_scope", target: "冒名求职申请", decisionOwner: "候选人本人", reversible: true },
  "FAM-020": { effectKind: "refuse_or_scope", target: "家庭医疗、付款和合同决定", decisionOwner: "家庭法定决策人", reversible: true }
};
const questionOnlyConstraintContracts = {
  "LRN-003": { phrase: "十分钟", contextId: "CTX-10" },
  "LRN-006": { phrase: "下周客户会", contextId: "CTX-07" }
};
const sourceSpecificClaimTokens = {
  "CTX-03/PRJ-047": ["80%", "10 月 8 日", "50 租户"],
  "CTX-06/OPS-024": ["字段映射表", "12 小时", "4%", "九天"],
  "CTX-06/LRN-015": ["六步", "上线前", "数据抽检", "change request", "4%"],
  "CTX-08/MKT-029": ["8,420", "1,080", "禁止保证收入", "未获付费广告授权"]
};
const continuityTools = new Set(["automation", "monitoring", "calendar", "tasks", "notification"]);
const automationRequiredD4Ids = new Set(["MKT-028", "MKT-044"]);
const demandHighAnchors = new Set(["ENG-007", "ENG-010", "ENG-018", "ENG-086", "PRJ-002", "PRJ-018", "PRJ-028", "OPS-010", "OPS-022", "OPS-030", "MKT-002", "MKT-006", "LRN-002", "LIF-004", "LIF-010", "CAR-001", "CAR-004", "FAM-002"]);
const demandLowAnchors = new Set(["ENG-057", "ENG-096", "ENG-108", "ENG-110", "ENG-111", "ENG-118", "PRJ-045", "PRJ-061", "PRJ-065", "PRJ-066", "OPS-037", "OPS-046", "OPS-052", "MKT-039", "MKT-045", "LRN-030", "LIF-025", "CAR-017", "FAM-017"]);
for (const id of ["ENG-015", "ENG-024", "WRT-010", "WRT-013", "OPS-020", "SAL-005", "MKT-019", "RES-009", "LIF-011"]) demandHighAnchors.add(id);
for (const id of ["ENG-016", "ENG-022", "PRJ-013"]) demandHighAnchors.add(id);
for (const id of ["MKT-042"]) demandLowAnchors.add(id);
const demandOrderConstraints = [
  ["ENG-015", "ENG-116"], ["ENG-024", "ENG-102"], ["WRT-010", "WRT-063"],
  ["WRT-013", "WRT-056"], ["OPS-020", "OPS-047"], ["SAL-005", "SAL-038"],
  ["MKT-019", "MKT-032"], ["MKT-014", "MKT-042"],
  ["PRJ-039", "PRJ-057"], ["LIF-011", "LIF-027"],
  ["ENG-002", "ENG-098"], ["OPS-003", "OPS-028"], ["SAL-006", "SAL-042"],
  ["LIF-009", "LIF-023"], ["RES-018", "RES-055"],
  ["ENG-049", "ENG-104"], ["PRJ-024", "PRJ-070"], ["WRT-020", "WRT-038"],
  ["RES-054", "RES-046"], ["RES-011", "RES-050"],
  ["OPS-009", "OPS-042"], ["OPS-042", "OPS-039"],
  ["SAL-013", "SAL-014"], ["MKT-012", "MKT-036"],
  ["DAT-031", "DAT-006"], ["DAT-006", "DAT-017"],
  ["LRN-020", "LRN-012"], ["LRN-012", "LRN-024"],
  ["LIF-014", "LIF-008"], ["CAR-005", "CAR-013"], ["FAM-006", "FAM-008"],
  ["ENG-020", "ENG-083"], ["PRJ-019", "PRJ-059"], ["RES-011", "RES-046"],
  ["SAL-007", "SAL-041"], ["LRN-004", "LRN-027"],
  ["ENG-016", "ENG-087"], ["ENG-087", "ENG-057"],
  ["ENG-022", "ENG-101"], ["ENG-101", "ENG-096"],
  ["PRJ-013", "PRJ-056"], ["PRJ-056", "PRJ-045"],
  ["FAM-011", "FAM-017"]
];
const exactRecordExpectations = {
  "PRJ-045": { risk: "S3", boundary: "B-AUTH", horizon: "H4", d: "D4" },
  "LRN-009": { risk: "S3", boundary: "B-AUTH", d: "D4" },
  "LIF-006": { risk: "S3", d: "D4", horizon: "H4" },
  "FAM-015": { risk: "S3", boundary: "B-AUTH", d: "D4", horizon: "H4" },
  "OPS-002": { risk: "S2", boundary: "B-PRIV", horizon: "H1" },
  "OPS-011": { risk: "S2" }, "OPS-024": { risk: "S2", boundary: "B-PRIV" },
  "OPS-033": { risk: "S3", boundary: "B-PRIV", d: "D4", horizon: "H4", rounds: "R4" },
  "OPS-039": { risk: "S3", boundary: "B-AUTH" }, "OPS-055": { risk: "S2" },
  "OPS-032": { risk: "S2", boundary: "B-AUTH" }, "LRN-021": { risk: "S2", boundary: "B-PRIV" },
  "RES-040": { risk: "S2", boundary: "B-PRIV" }, "DAT-033": { risk: "S2", boundary: "B-FIN" },
  "LIF-014": { risk: "S2", boundary: "B-FIN" }, "CAR-014": { risk: "S2", boundary: "B-PRIV" },
  "CAR-018": { risk: "S2", boundary: "B-FIN", horizon: "H3" },
  "FAM-002": { risk: "S2", boundary: "B-PRIV" }, "FAM-005": { risk: "S2", boundary: "B-PRIV", horizon: "H1" },
  "FAM-010": { risk: "S2", boundary: "B-PRIV" },
  "ENG-061": { c: "C4", rounds: "R3" }, "ENG-090": { c: "C4", d: "D2", horizon: "H2" },
  "ENG-098": { c: "C4", d: "D2", horizon: "H2" }, "ENG-100": { c: "C5", d: "D2", horizon: "H2", rounds: "R4" },
  "PRJ-060": { horizon: "H3" }, "LIF-025": { horizon: "H3" }, "LIF-029": { horizon: "H4" },
  "CAR-010": { horizon: "H3" }, "CAR-013": { horizon: "H3" }, "CAR-016": { horizon: "H3" },
  "CAR-017": { c: "C4", horizon: "H3", rounds: "R3" }, "CAR-019": { horizon: "H3" },
  "FAM-020": { horizon: "H4" }, "LRN-016": { horizon: "H2" },
  "PRJ-024": { horizon: "H2" }, "PRJ-039": { horizon: "H2" }, "RES-009": { horizon: "H3" },
  "RES-056": { horizon: "H3" }, "OPS-006": { horizon: "H2" }, "OPS-007": { horizon: "H1" },
  "OPS-009": { horizon: "H1" }, "OPS-029": { horizon: "H2", rounds: "R4" },
  "SAL-037": { horizon: "H3" }, "MKT-024": { horizon: "H4" }, "DAT-007": { horizon: "H3" },
  "DAT-018": { horizon: "H3" }, "LRN-006": { horizon: "H1" }, "LRN-014": { horizon: "H3" }
};
const finalRepairRecordExpectations = {
  "ENG-002": { demandPrior: "H" }, "ENG-098": { demandPrior: "M" },
  "OPS-003": { demandPrior: "H" }, "OPS-028": { demandPrior: "M" },
  "SAL-006": { demandPrior: "H" }, "SAL-042": { demandPrior: "M" },
  "LIF-009": { demandPrior: "H" }, "LIF-023": { demandPrior: "M" },
  "RES-018": { demandPrior: "H" }, "RES-055": { demandPrior: "M", risk: "S2", boundary: "B-PRIV" },
  "WRT-004": { risk: "S1", boundary: "B-ATTR" },
  "ENG-109": { c: "C4", d: "D1" },
  "LIF-003": { risk: "S2", boundary: "B-PRIV" },
  "ENG-096": { risk: "S3", boundary: "B-AUTH", d: "D4", horizon: "H4" },
  "RES-049": { risk: "S3", boundary: "B-AUTH", d: "D4", horizon: "H4" },
  "ENG-110": { risk: "S1", boundary: "B0" }, "OPS-035": { risk: "S1" },
  "WRT-064": { risk: "S1" },
  "OPS-052": { boundary: "B-AUTH" },
  "SAL-038": { boundary: "B-AUTH" }, "MKT-031": { boundary: "B-AUTH" },
  "DAT-030": { boundary: "B-AUTH" }, "LRN-025": { boundary: "B-AUTH" },
  "CAR-016": { c: "C2", boundary: "B-ATTR" }, "MKT-042": { boundary: "B-FIN" },
  "CAR-004": { risk: "S2", boundary: "B-PRIV" }, "LIF-020": { risk: "S2", boundary: "B-PRIV" },
  "PRJ-006": { boundary: "B0" },
  "LRN-008": { boundary: "B0" }, "MKT-011": { c: "C2", boundary: "B0" },
  "CAR-008": { boundary: "B-AUTH" },
  "PRJ-068": { d: "D4", horizon: "H4" }, "OPS-053": { d: "D4", horizon: "H4" },
  "WRT-065": { d: "D4", horizon: "H4" }, "DAT-028": { d: "D4", horizon: "H4" },
  "LIF-029": { d: "D4", horizon: "H4" }, "FAM-020": { d: "D4", horizon: "H4" },
  "ENG-057": { horizon: "H2" }, "OPS-046": { horizon: "H2" }, "ENG-086": { horizon: "H1" },
  "PRJ-015": { horizon: "H1" }, "OPS-032": { horizon: "H2" }, "MKT-004": { horizon: "H2" },
  "LIF-004": { horizon: "H2" }, "FAM-001": { horizon: "H1" }, "RES-033": { horizon: "H3" },
  "PRJ-008": { horizon: "H3", fit: "F2" },
  "ENG-050": { rounds: "R2" }, "PRJ-031": { rounds: "R2" }, "RES-016": { rounds: "R2" },
  "DAT-009": { rounds: "R2" }, "LRN-023": { rounds: "R2" }, "LIF-013": { rounds: "R2" },
  "FAM-010": { rounds: "R2" }, "MKT-024": { c: "C3" }, "LRN-001": { c: "C2" },
  "PRJ-050": { c: "C2" }, "ENG-012": { fit: "F2" }, "ENG-054": { fit: "F2" },
  "ENG-062": { fit: "F2" },
  "ENG-049": { demandPrior: "H" }, "ENG-104": { demandPrior: "M", risk: "S3", boundary: "B-AUTH", fit: "F3" },
  "PRJ-024": { demandPrior: "H" }, "PRJ-070": { demandPrior: "M" },
  "WRT-020": { demandPrior: "H" }, "WRT-038": { demandPrior: "M" },
  "RES-054": { demandPrior: "H" }, "RES-050": { demandPrior: "L" }, "RES-011": { demandPrior: "M" },
  "OPS-009": { demandPrior: "H" }, "OPS-042": { demandPrior: "M" },
  "SAL-013": { demandPrior: "H" }, "SAL-014": { demandPrior: "M", c: "C5", d: "D2", horizon: "H3", boundary: "B-AUTH" },
  "MKT-012": { demandPrior: "H" }, "MKT-036": { demandPrior: "M" },
  "DAT-031": { demandPrior: "H" }, "DAT-017": { demandPrior: "L", risk: "S2", boundary: "B-AUTH" },
  "DAT-006": { demandPrior: "M" }, "LRN-020": { demandPrior: "H" },
  "LRN-024": { demandPrior: "L" }, "LRN-012": { demandPrior: "M" },
  "LIF-014": { demandPrior: "H", risk: "S2", boundary: "B-FIN" }, "LIF-008": { demandPrior: "M" },
  "CAR-005": { demandPrior: "H" }, "CAR-013": { demandPrior: "M" },
  "FAM-006": { demandPrior: "H" },
  "ENG-095": { d: "D4", horizon: "H4" }, "PRJ-044": { d: "D4", horizon: "H4" },
  "PRJ-052": { d: "D4", horizon: "H4" }, "PRJ-062": { d: "D4", horizon: "H4" },
  "WRT-069": { d: "D4", horizon: "H4" }, "RES-047": { d: "D4", horizon: "H4" },
  "RES-051": { d: "D4", horizon: "H4" }, "OPS-044": { d: "D4", horizon: "H4" },
  "SAL-032": { d: "D4", horizon: "H4" }, "MKT-028": { d: "D4", horizon: "H4" },
  "DAT-014": { d: "D4", horizon: "H4" }, "LIF-019": { d: "D4", horizon: "H4" },
  "WRT-059": { d: "D4", horizon: "H4", risk: "S1", boundary: "B-AUTH" },
  "ENG-032": { c: "C3", d: "D1", risk: "S1", fit: "F1" }, "ENG-043": { risk: "S1", fit: "F1" },
  "ENG-055": { risk: "S1", fit: "F1" }, "ENG-113": { risk: "S1", fit: "F1" },
  "PRJ-061": { risk: "S2", boundary: "B-PRIV", fit: "F3" },
  "LIF-007": { boundary: "B-LEG" }, "FAM-007": { boundary: "B-PRIV" },
  "ENG-074": { risk: "S3", boundary: "B-AUTH", fit: "F3" },
  "OPS-015": { risk: "S3", boundary: "B-AUTH", fit: "F3" },
  "OPS-029": { risk: "S3", boundary: "B-AUTH", fit: "F3" },
  "OPS-051": { c: "C4", rounds: "R3", risk: "S3", boundary: "B-AUTH", fit: "F3" },
  "SAL-002": { risk: "S3", boundary: "B-AUTH", fit: "F3" },
  "FAM-004": { risk: "S3", boundary: "B-AUTH", fit: "F3" },
  "WRT-066": { risk: "S3", boundary: "B-AUTH", fit: "F3" },
  "PRJ-014": { risk: "S1" }, "WRT-047": { risk: "S2", boundary: "B-AUTH" },
  "WRT-063": { risk: "S2", boundary: "B-PRIV" }, "OPS-040": { risk: "S2", boundary: "B-AUTH" },
  "MKT-033": { risk: "S2", boundary: "B-AUTH" },
  "PRJ-066": { c: "C4", d: "D1", rounds: "R3", boundary: "B-AUTH" },
  "ENG-119": { d: "D4", horizon: "H4", rounds: "R4" }, "LRN-028": { rounds: "R4", d: "D4", horizon: "H4", risk: "S3", boundary: "B-AUTH" },
  "PRJ-054": { risk: "S1", boundary: "B-AUTH" }, "WRT-046": { c: "C4", d: "D1", risk: "S3", boundary: "B-AUTH", fit: "F3" },
  "OPS-039": { demandPrior: "L", c: "C3", d: "D4", horizon: "H4" },
  "FAM-008": { demandPrior: "M", c: "C2", d: "D0" },
  "MKT-041": { c: "C2", rounds: "R2", risk: "S0", boundary: "B-MED" },
  "ENG-078": { demandPrior: "L", c: "C1", rounds: "R1" },
  "WRT-068": { demandPrior: "L", c: "C1", rounds: "R1" },
  "DAT-034": { demandPrior: "L", c: "C1", rounds: "R1" }
};
const finalV5RecordExpectations = {
  "SAL-014": { demandPrior: "M", c: "C5", d: "D2", horizon: "H3", rounds: "R3", toolDepth: "K2", risk: "S2", fit: "F2", boundary: "B-AUTH", question: "采购评审里，三年总拥有成本要看透明，我最担心安全硬门和以后迁不出去。能把厂商说法、迁移证据和审批材料分开，告诉我哪些还缺证据吗？", purpose: "用三年总拥有成本、安全硬门与迁移证据形成可审计采购判断。" },
  "LRN-002": { demandPrior: "H", c: "C2", d: "D0", horizon: "H0", rounds: "R2", toolDepth: "K0", risk: "S0", fit: "F2", boundary: "B0", question: "我把那道订单重复消费的原题、我的作答和可核验答案给你。先帮我讲清幂等和 exactly-once，再连续问我三题，别马上给答案。" },
  "LRN-003": { demandPrior: "H", c: "C1", d: "D0", horizon: "H0", rounds: "R1", toolDepth: "K0", risk: "S0", fit: "F2", boundary: "B0", question: "我把最近两次模考的原题、我的作答和可核验答案给你。能做成十分钟口头复盘吗？一次问一个，我答错再解释。" },
  "LIF-022": { demandPrior: "L", c: "C3", d: "D1", horizon: "H1", rounds: "R2", toolDepth: "K2", risk: "S2", fit: "F2", boundary: "B-AUTH", question: "今晚这趟车取消了。我把当前票据、起终点和明早十点前到家的硬约束给你；帮我查实时车次和住宿，再比较改签、换站和住一晚，付款前停住。" },
  "OPS-048": { demandPrior: "H", c: "C3", d: "D1", horizon: "H0", rounds: "R2", toolDepth: "K3", risk: "S3", fit: "F3", boundary: "B-MED", question: "患者本人已经明确授权我处理这次行政协调，收件人只限患者本人和登记的机构联系人。请根据当前预约和渠道状态安排材料、创建或改约并发随访提醒；每次创建、改约或外发前，都先让我确认对象、内容和渠道，别解释检查结果或改医嘱。" },
  "MKT-033": { demandPrior: "H", c: "C3", d: "D1", horizon: "H0", rounds: "R2", toolDepth: "K3", risk: "S3", fit: "F3", boundary: "B-AUTH", question: "邮件、应用内和推送最近互相打架。先读当前配置并给我频控变更；我批准后再写入 live 渠道配置。写前说清会影响哪些自动外发，保留旧值方便回滚，也别触发即时补发。" },
  "OPS-019": { demandPrior: "M", c: "C2", d: "D0", horizon: "H0", rounds: "R2", toolDepth: "K2", risk: "S2", fit: "F3", boundary: "B-AUTH" },
  "LIF-001": { demandPrior: "H", c: "C2", d: "D0", horizon: "H1", rounds: "R2", toolDepth: "K2", risk: "S2", fit: "F2", boundary: "B-PRIV" },
  "SAL-017": { demandPrior: "H", c: "C3", d: "D1", horizon: "H0", rounds: "R2", toolDepth: "K2", risk: "S2", fit: "F2", boundary: "B-PRIV" },
  "SAL-018": { demandPrior: "H", c: "C2", d: "D0", horizon: "H0", rounds: "R2", toolDepth: "K1", risk: "S2", fit: "F2", boundary: "B-PRIV" },
  "WRT-059": { demandPrior: "L", c: "C5", d: "D4", horizon: "H4", rounds: "R3", toolDepth: "K3", risk: "S1", fit: "F3", boundary: "B-AUTH", question: "这五种语言的政策手册以后还会持续改。请长期生成版本化草案和各地专家签核清单，但不要发布、通知或代签。", purpose: "建立五语草案的版本链和专家签核准备，不触发正式发布或审批。" },
  "CAR-006": { demandPrior: "M", c: "C1", d: "D0", horizon: "H0", rounds: "R1", toolDepth: "K0", risk: "S1", fit: "F2", boundary: "B-ATTR" },
  "RES-023": { demandPrior: "M", c: "C3", d: "D1", horizon: "H0", rounds: "R2", toolDepth: "K3", risk: "S0", fit: "F2", boundary: "B0" },
  "RES-047": { demandPrior: "L", c: "C2", d: "D4", horizon: "H4", rounds: "R2", toolDepth: "K3", risk: "S2", fit: "F3", boundary: "B0" },
  "SAL-009": { demandPrior: "H", c: "C2", d: "D0", horizon: "H1", rounds: "R2", toolDepth: "K2", risk: "S0", fit: "F2", boundary: "B0" },
  "SAL-013": { demandPrior: "H", c: "C2", d: "D0", horizon: "H0", rounds: "R2", toolDepth: "K2", risk: "S0", fit: "F2", boundary: "B0" },
  "SAL-032": { demandPrior: "H", c: "C2", d: "D4", horizon: "H4", rounds: "R4", toolDepth: "K2", risk: "S0", fit: "F3", boundary: "B0" },
  "ENG-045": { demandPrior: "H", c: "C3", d: "D1", horizon: "H0", rounds: "R2", toolDepth: "K2", risk: "S1", fit: "F2", boundary: "B0" },
  "LIF-019": { demandPrior: "M", c: "C2", d: "D4", horizon: "H4", rounds: "R4", toolDepth: "K2", risk: "S2", fit: "F3", boundary: "B-MED" },
  "LIF-028": { demandPrior: "L", c: "C4", d: "D4", horizon: "H4", rounds: "R3", toolDepth: "K4", risk: "S2", fit: "F3", boundary: "B-AUTH" },
  "WRT-069": { demandPrior: "L", c: "C2", d: "D4", horizon: "H4", rounds: "R2", toolDepth: "K3", risk: "S1", fit: "F3", boundary: "B0" },
  "ENG-097": { demandPrior: "L", c: "C3", d: "D3", horizon: "H2", rounds: "R2", toolDepth: "K1", risk: "S1", fit: "F1", boundary: "B0" },
  "MKT-028": { demandPrior: "M", c: "C2", d: "D4", horizon: "H4", rounds: "R2", toolDepth: "K2", risk: "S1", fit: "F3", boundary: "B0" },
  "MKT-044": { demandPrior: "L", c: "C3", d: "D4", horizon: "H4", rounds: "R2", toolDepth: "K2", risk: "S0", fit: "F3", boundary: "B0" },
  "FAM-017": { demandPrior: "M", c: "C4", d: "D4", horizon: "H4", rounds: "R3", toolDepth: "K3", risk: "S2", fit: "F3", boundary: "B-MED" },
  "WRT-064": { demandPrior: "L", c: "C2", d: "D0", horizon: "H0", rounds: "R2", toolDepth: "K2", risk: "S1", fit: "F2", boundary: "B0" },
  "ENG-020": { demandPrior: "H", c: "C3", d: "D1", horizon: "H0", rounds: "R2", toolDepth: "K2", risk: "S2", fit: "F1", boundary: "B0" },
  "ENG-083": { demandPrior: "M", c: "C3", d: "D1", horizon: "H0", rounds: "R2", toolDepth: "K2", risk: "S2", fit: "F1", boundary: "B0" },
  "PRJ-019": { demandPrior: "H", c: "C2", d: "D0", horizon: "H0", rounds: "R2", toolDepth: "K2", risk: "S2", fit: "F2", boundary: "B0" },
  "PRJ-059": { demandPrior: "L", c: "C4", d: "D1", horizon: "H0", rounds: "R3", toolDepth: "K2", risk: "S1", fit: "F2", boundary: "B-AUTH" },
  "RES-011": { demandPrior: "H", c: "C3", d: "D1", horizon: "H0", rounds: "R2", toolDepth: "K2", risk: "S0", fit: "F2", boundary: "B0" },
  "RES-046": { demandPrior: "M", c: "C3", d: "D1", horizon: "H0", rounds: "R4", toolDepth: "K3", risk: "S0", fit: "F2", boundary: "B0" },
  "SAL-007": { demandPrior: "H", c: "C3", d: "D1", horizon: "H0", rounds: "R2", toolDepth: "K1", risk: "S0", fit: "F2", boundary: "B0" },
  "SAL-041": { demandPrior: "M", c: "C3", d: "D1", horizon: "H3", rounds: "R2", toolDepth: "K2", risk: "S1", fit: "F2", boundary: "B0" },
  "LRN-004": { demandPrior: "H", c: "C3", d: "D1", horizon: "H0", rounds: "R2", toolDepth: "K2", risk: "S0", fit: "F2", boundary: "B0" },
  "LRN-027": { demandPrior: "M", c: "C2", d: "D0", horizon: "H0", rounds: "R2", toolDepth: "K2", risk: "S2", fit: "F2", boundary: "B-MED" },
  "CAR-005": { demandPrior: "H", c: "C1", d: "D0", horizon: "H0", rounds: "R2", toolDepth: "K0", risk: "S1", fit: "F2", boundary: "B0", question: "我准备投其中这个岗位。能用我能证明的两段经历写封简短求职信，别复述整份简历吗？" },
  "LRN-008": { demandPrior: "M", c: "C2", d: "D0", horizon: "H0", rounds: "R2", toolDepth: "K1", risk: "S0", fit: "F2", boundary: "B0", question: "我准备做三十分钟内部分享。能只从我已经确认掌握、也能公开讲的主题里取舍内容，再设计一个练习吗？" },
  "ENG-041": { demandPrior: "M", c: "C3", d: "D1", horizon: "H0", rounds: "R2", toolDepth: "K2", risk: "S1", fit: "F2", boundary: "B0" },
  "WRT-002": { demandPrior: "H", c: "C2", d: "D0", horizon: "H0", rounds: "R2", toolDepth: "K2", risk: "S1", fit: "F2", boundary: "B0" },
  "PRJ-027": { demandPrior: "H", c: "C2", d: "D0", horizon: "H0", rounds: "R2", toolDepth: "K2", risk: "S1", fit: "F2", boundary: "B0" },
  "PRJ-044": { demandPrior: "H", c: "C2", d: "D4", horizon: "H4", rounds: "R2", toolDepth: "K2", risk: "S1", fit: "F3", boundary: "B0" },
  "LRN-009": { demandPrior: "H", c: "C2", d: "D4", horizon: "H2", rounds: "R2", toolDepth: "K2", risk: "S3", fit: "F3", boundary: "B-AUTH" },
  "LIF-024": { demandPrior: "M", c: "C2", d: "D0", horizon: "H4", rounds: "R4", toolDepth: "K2", risk: "S0", fit: "F3", boundary: "B0" }
};
const finalV5ToolExpectations = {
  "SAL-014": ["spreadsheet", "finance", "rag"], "LRN-002": [], "LRN-003": [],
  "LIF-022": ["browser", "maps", "finance"],
  "OPS-048": ["calendar", "notification", "messaging", "rag"],
  "MKT-033": ["email", "messaging", "notification", "mobile", "api"],
  "OPS-019": ["tasks", "forms"], "LIF-001": ["calendar", "tasks"],
  "SAL-017": ["email", "calendar", "crm"], "SAL-018": ["crm"],
  "WRT-059": ["pdf", "document", "rag", "automation", "tasks"], "CAR-006": [],
  "RES-023": ["browser", "rag", "bi", "document"],
  "RES-047": ["browser", "rag", "finance", "monitoring", "automation"],
  "SAL-009": ["rag", "crm"], "SAL-013": ["rag", "crm", "bi"],
  "SAL-032": ["tasks", "automation", "crm"], "ENG-045": ["repo", "git", "tasks"],
  "LIF-019": ["spreadsheet", "document", "automation"],
  "LIF-028": ["tasks", "calendar", "spreadsheet", "finance", "document", "automation"],
  "WRT-069": ["rag", "document", "git", "automation"], "ENG-097": ["repo"],
  "MKT-028": ["document", "rag", "automation"],
  "MKT-044": ["crm", "rag", "automation"], "FAM-017": ["calendar", "tasks", "finance", "document"],
  "WRT-064": ["document", "rag"], "ENG-020": ["repo", "rag"],
  "ENG-083": ["memory", "repo", "test"], "PRJ-019": ["pdf", "rag"],
  "PRJ-059": ["tasks", "document", "rag"],
  "RES-011": ["repo", "spreadsheet", "document"],
  "RES-046": ["memory", "test", "tasks", "rag"], "SAL-007": ["rag"],
  "SAL-041": ["tasks", "document", "rag"], "LRN-004": ["repo", "test", "browser"],
  "LRN-027": ["pdf", "document"], "CAR-005": [], "LRN-008": ["slides"],
  "ENG-041": ["automation", "notification", "monitoring"],
  "WRT-002": ["email", "notification"], "PRJ-027": ["crm", "notification"],
  "PRJ-044": ["messaging", "automation"], "LRN-009": ["calendar", "notification"],
  "LIF-024": ["spreadsheet", "calendar", "automation"]
};
const finalV5ContextExpectations = {
  "SAL-014": ["CTX-16", "LIVE"], "LRN-002": ["CTX-10", "USER"],
  "LRN-003": ["CTX-10", "USER"], "LIF-022": ["USER", "LIVE"],
  "OPS-048": ["CTX-13", "USER", "LIVE"], "MKT-033": ["LIVE"],
  "OPS-019": ["CTX-07", "LIVE"], "LIF-001": ["LIVE"], "SAL-017": ["LIVE"],
  "SAL-018": ["USER", "LIVE"], "WRT-059": ["LIVE"], "CAR-006": ["CTX-11", "USER"],
  "RES-023": ["LIVE"], "RES-047": ["LIVE"], "SAL-009": ["LIVE"],
  "SAL-013": ["LIVE"], "SAL-032": ["LIVE"], "ENG-045": ["LIVE"],
  "LIF-019": ["CTX-13", "LIVE"], "LIF-028": ["LIVE"], "WRT-069": ["LIVE"],
  "ENG-097": ["LIVE"], "MKT-028": ["LIVE"], "MKT-044": ["LIVE"], "FAM-017": ["CTX-13", "LIVE"],
  "WRT-064": ["LIVE"], "ENG-020": ["USER", "LIVE"], "ENG-083": ["LIVE"],
  "PRJ-019": ["CTX-06", "USER"], "PRJ-059": ["LIVE"],
  "RES-011": ["USER", "LIVE"], "RES-046": ["USER", "LIVE"],
  "SAL-007": ["CTX-07"], "SAL-041": ["LIVE"], "LRN-004": ["LIVE"],
  "LRN-027": ["USER"], "CAR-005": ["CTX-11", "USER"],
  "LRN-008": ["CTX-10", "USER"]
};

const finalV6RecordExpectations = {
  "RES-049": { demandPrior: "L", toolDepth: "K3" }, "RES-033": { demandPrior: "M" }, "RES-026": { demandPrior: "H" },
  "LRN-001": { horizon: "H3" }, "LRN-023": { horizon: "H0", toolDepth: "K2" }, "LIF-022": { d: "D0" },
  "PRJ-026": { rounds: "R2" }, "ENG-103": { c: "C3", d: "D1" }, "LRN-024": { c: "C3", d: "D1" },
  "SAL-042": { c: "C4", d: "D1", rounds: "R3", toolDepth: "K2", boundary: "B-LEG" },
  "WRT-057": { d: "D1" }, "ENG-093": { horizon: "H0" }, "SAL-011": { horizon: "H0", risk: "S2", boundary: "B-PRIV" },
  "ENG-062": { horizon: "H0" }, "PRJ-049": { c: "C3", d: "D1" },
  "ENG-115": { c: "C4", d: "D2", horizon: "H2", rounds: "R3", toolDepth: "K4", risk: "S2", boundary: "B-AUTH" },
  "LRN-002": { question: "我把那道订单重复消费题和自己的答案发你。帮我讲清幂等和 exactly-once，再考我三题，先别公布答案。" },
  "LRN-003": { rounds: "R2", question: "我把最近两次模考的题和答案发你。能带我做十分钟口头复盘吗？一次问一题，答错再讲。" },
  "OPS-048": { question: "这次复诊行政协调我已拿到患者授权。请按当前预约整理材料和改约选项；任何创建、改约、提醒或外发都先问我，医疗判断留给专业人员。" },
  "MKT-033": { question: "最近各渠道通知撞车。先给我看频控改动和受影响的自动外发；我同意后再写配置，保留旧值，别补发历史消息。" },
  "MKT-011": { toolDepth: "K2" }, "CAR-007": { toolDepth: "K0" }, "LRN-017": { toolDepth: "K0" },
  "DAT-034": { toolDepth: "K0" }, "WRT-048": { toolDepth: "K2" }, "MKT-010": { toolDepth: "K3" },
  "ENG-027": { toolDepth: "K3" }, "PRJ-056": { toolDepth: "K2" }, "RES-002": { toolDepth: "K3" },
  "RES-005": { toolDepth: "K2" }, "RES-021": { toolDepth: "K2" }, "PRJ-064": { toolDepth: "K3", risk: "S2", boundary: "B-PRIV" },
  "OPS-034": { toolDepth: "K3", boundary: "B-FIN" }, "DAT-028": { toolDepth: "K4" },
  "CAR-015": { toolDepth: "K2", risk: "S2", boundary: "B-FIN" }, "DAT-017": { toolDepth: "K4" },
  "MKT-023": { risk: "S2", fit: "F2", boundary: "B-PRIV", toolDepth: "K2", question: "为二十个目标账户准备共同痛点、个性化证据和触达节奏草案；由负责人逐个审核并亲自发送，别替我们外发。" },
  "ENG-100": { risk: "S2", boundary: "B-AUTH", question: "这张十亿行生产表要换主键。先只做迁移方案和隔离演练，不改生产；把双写核对、逐阶段放行和回滚终态写清。" },
  "SAL-037": { risk: "S2", boundary: "B-LEG" }, "DAT-029": { risk: "S2", boundary: "B-FIN" },
  "RES-018": { risk: "S2", boundary: "B-PRIV" }, "RES-031": { risk: "S2", boundary: "B-PRIV" },
  "OPS-005": { risk: "S2", boundary: "B-FIN" }, "OPS-010": { risk: "S2", boundary: "B-FIN" },
  "SAL-026": { risk: "S2", boundary: "B-PRIV" }, "SAL-034": { risk: "S2", boundary: "B-PRIV" },
  "SAL-040": { risk: "S2", boundary: "B-FIN" }, "MKT-031": { risk: "S2", boundary: "B-PRIV" },
  "DAT-007": { risk: "S2", boundary: "B-FIN" }, "DAT-015": { boundary: "B-AUTH" },
  "OPS-017": { boundary: "B-AUTH" }, "WRT-047": { boundary: "B-AUTH", question: "知识库里同一流程有好几版。能先给我看合并预览吗？我确认目标页面、替代关系和回退点后再更新，有冲突时再请内容负责人决定，可以吗？" },
  "FAM-013": { boundary: "B-LEG", question: "先给共享日历和交接清单预览，等我确认共享成员、必要字段和回退点后再创建；法律争议仍交专业人员。" },
  "LIF-017": { boundary: "B-LEG" }, "SAL-019": { boundary: "B-PRIV" }, "SAL-021": { boundary: "B-ID" },
  "DAT-027": { boundary: "B-FIN" }, "DAT-004": { risk: "S2", boundary: "B-FIN" },
  "RES-052": { risk: "S2", boundary: "B-FIN" }, "LIF-025": { boundary: "B-LEG" },
  "ENG-117": { toolDepth: "K3", boundary: "B-AUTH", question: "拿当前区域拓扑和 runbook 做一次隔离演练：验证流量隔离、数据恢复和接班证据，任何真实切换前停住。" },
  "RES-060": { toolDepth: "K3", risk: "S2", boundary: "B-FIN", question: "为董事会做市场、监管、技术和现金流情景矩阵，列触发指标、资金缓冲和不后悔选项，不做阶段注入演练。" },
  "PRJ-016": { question: "从任务和里程碑做一页周报：只报里程碑偏差、依赖变化和本周要拍板的选择，并附上下周验收点。" },
  "SAL-009": { risk: "S2", boundary: "B-PRIV", question: "这周 pipeline review 请按 CRM 证据重算 forecast，指出新增或流失金额、卡住的决策和每个商机下一步要拿的客户证据。" },
  "PRJ-068": { toolDepth: "K3" }, "SAL-008": { risk: "S2", boundary: "B-PRIV" },
  "SAL-032": { risk: "S2", boundary: "B-PRIV" }, "OPS-046": { boundary: "B-LEG" }
};

const finalV6ToolExpectations = {
  "MKT-011": ["document", "rag"], "CAR-007": [], "LRN-017": [], "DAT-034": [],
  "WRT-048": ["transcription", "database", "rag"], "MKT-010": ["forms", "calendar", "tasks", "notification"],
  "ENG-027": ["repo", "test", "spreadsheet", "finance"], "PRJ-056": ["pdf", "document"],
  "RES-002": ["issue-tracker", "browser", "rag", "test"], "RES-005": ["browser", "rag"],
  "RES-021": ["browser", "repo", "test"], "RES-049": ["browser", "automation", "notification", "rag"],
  "PRJ-064": ["crm", "pdf", "tasks", "finance"], "OPS-034": ["browser", "spreadsheet", "finance", "automation", "monitoring"],
  "DAT-028": ["database", "bi", "tasks", "automation", "notification", "monitoring"],
  "LRN-023": ["browser", "pdf", "rag"], "CAR-015": ["crm", "spreadsheet", "finance"],
  "CAR-010": ["document", "tasks"], "ENG-115": ["repo", "database", "test", "spreadsheet", "cloud", "monitoring"],
  "DAT-017": ["repo", "test", "database", "spreadsheet", "bi", "monitoring"],
  "MKT-023": ["crm", "document", "rag"], "ENG-100": ["repo", "database", "test", "monitoring", "document"],
  "WRT-047": ["document", "database", "rag"], "ENG-117": ["cloud", "monitoring", "test", "document"],
  "RES-060": ["browser", "spreadsheet", "finance", "document"], "SAL-009": ["crm", "bi", "rag"],
  "PRJ-068": ["tasks", "calendar", "crm", "messaging", "automation"]
};

const finalV6ContextExpectations = {
  "RES-005": ["USER", "LIVE"], "PRJ-056": ["USER"], "LRN-017": [], "DAT-034": [],
  "ENG-115": ["USER", "LIVE"], "DAT-017": ["CTX-15", "USER", "LIVE"],
  "CAR-010": ["CTX-11", "USER", "LIVE"]
};

const finalV7RecordExpectations = {
  "ENG-016": { demandPrior: "H" }, "ENG-022": { demandPrior: "H" },
  "ENG-057": { demandPrior: "L" }, "ENG-087": { demandPrior: "M" },
  "ENG-096": { demandPrior: "L" }, "ENG-101": { demandPrior: "M" },
  "PRJ-013": { demandPrior: "H" }, "PRJ-045": { demandPrior: "L" },
  "PRJ-056": { demandPrior: "M" }, "FAM-011": { demandPrior: "M" },
  "FAM-017": { demandPrior: "L" }, "ENG-112": { risk: "S2", fit: "F2" },
  "LIF-015": { d: "D0" }, "LIF-013": { horizon: "H2" },
  "PRJ-057": { horizon: "H3" }, "SAL-020": { horizon: "H2" },
  "WRT-002": { toolDepth: "K1" }, "MKT-028": { toolDepth: "K3" },
  "WRT-026": { risk: "S2", boundary: "B-PRIV" },
  "WRT-034": { risk: "S2", boundary: "B-ATTR" }, "WRT-044": { boundary: "B-ATTR" },
  "WRT-054": { boundary: "B-ATTR" }, "DAT-018": { boundary: "B-FIN" },
  "OPS-020": { risk: "S2", boundary: "B-PRIV" }, "OPS-030": { boundary: "B-PRIV" },
  "OPS-038": { boundary: "B-FIN" }, "OPS-040": { boundary: "B-PRIV" },
  "SAL-001": { boundary: "B-PRIV" }, "SAL-010": { boundary: "B-PRIV" },
  "SAL-013": { risk: "S2", boundary: "B-PRIV" },
  "MKT-026": { risk: "S2", boundary: "B-PRIV" },
  "MKT-029": { risk: "S2", boundary: "B-FIN" },
  "MKT-044": { risk: "S2", boundary: "B-PRIV" },
  "DAT-020": { risk: "S2", boundary: "B-PRIV" },
  "LRN-026": { risk: "S2", boundary: "B-PRIV" },
  "LIF-024": { risk: "S2", boundary: "B-PRIV" },
  "CAR-012": { horizon: "H0", risk: "S2", boundary: "B-PRIV" },
  "RES-009": { risk: "S2", boundary: "B-FIN" },
  "RES-012": { risk: "S2", boundary: "B-FIN" },
  "RES-033": { risk: "S2", boundary: "B-FIN" },
  "RES-038": { risk: "S2", boundary: "B-PRIV" },
  "RES-053": { risk: "S2", boundary: "B-PRIV" },
  "SAL-039": { risk: "S2" }, "ENG-106": { boundary: "B-LEG" },
  "PRJ-019": { boundary: "B-AUTH" },
  "WRT-047": { question: "知识库里同一流程有好几版。先给我一版合并预览，标清会替代哪个页面；我确认后再更新，冲突交给内容负责人，可以吗？" },
  "SAL-009": { question: "这周 pipeline review，按 CRM 证据重算 forecast：哪些金额新增或流失，哪些商机卡住，下一步还缺什么客户证据？" },
  "FAM-013": { question: "先给我看一版共享日历和交接清单。我确认谁能看、要记哪些信息后再建；有争议的安排先别动，交给专业人员处理。" },
  "MKT-041": { risk: "S2", question: "只用当前获批的临床证据整理市场材料；证据版本和批准状态要能回查，所有疗效声明继续交医学与合规人员批准，可以吗？" }
};

const finalV7ToolExpectations = {
  "ENG-031": ["repo", "mobile", "design"], "ENG-079": ["repo", "test", "mobile"],
  "PRJ-037": ["calendar", "crm", "forms"], "PRJ-052": ["tasks", "document", "test", "bi", "automation"],
  "PRJ-057": ["browser", "tasks", "document", "rag"], "PRJ-066": ["browser", "tasks", "document", "rag"],
  "WRT-002": ["email"], "WRT-011": ["transcription", "document"],
  "WRT-026": ["transcription", "rag"], "WRT-032": ["document", "rag"],
  "WRT-033": ["repo", "crm", "browser", "document", "rag"], "WRT-035": ["pdf", "rag"],
  "WRT-051": ["forms", "email", "document", "rag"], "WRT-055": ["browser", "document", "rag"],
  "WRT-061": ["browser", "pdf", "document", "rag"], "WRT-062": ["document", "rag"],
  "WRT-064": ["document", "rag"], "WRT-068": ["document", "rag"],
  "WRT-023": ["document", "rag"], "RES-014": ["browser", "pdf", "rag"],
  "RES-025": ["document", "rag"], "RES-027": ["memory", "browser", "rag"],
  "RES-038": ["database"], "RES-039": ["browser", "document", "rag"],
  "RES-048": ["document", "rag"], "RES-052": ["browser", "pdf", "finance", "rag"],
  "RES-053": ["database", "forms", "spreadsheet", "rag"], "RES-056": ["browser", "pdf", "document", "rag"],
  "RES-016": ["memory", "rag"], "OPS-039": ["tasks", "database", "bi", "monitoring", "automation", "notification"],
  "OPS-045": ["browser", "pdf", "document"], "OPS-052": ["calendar", "tasks", "document", "rag"],
  "SAL-008": ["crm"], "SAL-011": ["crm", "bi"], "SAL-013": ["crm", "bi"],
  "SAL-015": ["browser", "test", "video"], "SAL-016": ["pdf", "rag"],
  "SAL-031": ["document", "rag"], "SAL-039": ["crm", "browser", "document", "rag"],
  "MKT-009": ["crm", "document", "rag"], "MKT-013": ["document", "design", "rag"],
  "MKT-028": ["browser", "bi", "document", "automation"], "MKT-032": ["browser", "crm", "document"],
  "MKT-039": ["bi", "tasks", "image", "design"], "MKT-041": ["browser", "document", "rag"],
  "LRN-020": ["browser", "forms", "document", "rag"], "LRN-026": ["database", "document", "rag"],
  "LRN-028": ["tasks", "forms", "automation", "notification", "document"],
  "LRN-029": ["browser", "calendar", "tasks", "document"],
  "LRN-030": ["browser", "repo", "test", "document", "rag"],
  "LIF-005": ["calendar", "tasks", "document"], "CAR-011": ["browser", "spreadsheet", "rag"],
  "CAR-012": ["email", "document", "rag"], "DAT-009": []
};

const finalV7ContextExpectations = {
  "WRT-011": ["CTX-06", "USER"], "WRT-023": ["CTX-07", "USER"],
  "WRT-026": ["USER"], "WRT-032": ["USER"], "WRT-033": ["USER", "LIVE"],
  "WRT-035": ["USER"], "WRT-051": ["USER", "LIVE"], "WRT-062": ["USER"],
  "WRT-064": ["USER"], "WRT-068": ["USER"], "RES-016": ["CTX-05", "USER"],
  "RES-025": ["USER"], "RES-038": ["USER", "LIVE"], "RES-039": ["USER", "LIVE"],
  "RES-048": ["USER"], "RES-052": ["USER", "LIVE"], "RES-053": ["USER", "LIVE"],
  "PRJ-057": ["CTX-05", "USER", "LIVE"], "PRJ-066": ["USER", "LIVE"],
  "MKT-009": ["USER", "LIVE"], "MKT-013": ["CTX-08", "USER"],
  "MKT-026": ["USER", "LIVE"], "MKT-041": ["USER", "LIVE"],
  "LRN-006": ["CTX-07", "USER"], "LRN-020": ["USER", "LIVE"],
  "LRN-026": ["USER", "LIVE"], "LRN-028": ["CTX-10", "USER", "LIVE"],
  "LRN-029": ["USER", "LIVE"], "LRN-030": ["USER", "LIVE"],
  "LIF-005": ["CTX-13", "USER", "LIVE"], "CAR-011": ["CTX-11", "USER", "LIVE"],
  "CAR-012": ["CTX-11", "USER"], "SAL-016": ["USER"], "SAL-031": ["USER"],
  "SAL-039": ["USER", "LIVE"], "FAM-010": ["USER"]
};

const finalV8RecordExpectations = {
  "ENG-064": { risk: "S2", boundary: "B-FIN" },
  "ENG-091": { risk: "S2", boundary: "B-PRIV", fit: "F2" },
  "ENG-101": { risk: "S2", boundary: "B-PRIV" },
  "PRJ-025": { risk: "S2", boundary: "B-AUTH", fit: "F2" },
  "PRJ-037": { risk: "S2", boundary: "B-PRIV" },
  "PRJ-062": { risk: "S2", boundary: "B0" },
  "PRJ-069": { risk: "S2", boundary: "B0" },
  "WRT-033": { risk: "S2", boundary: "B-PRIV" },
  "RES-004": { risk: "S2", boundary: "B-PRIV" },
  "RES-008": { risk: "S2", boundary: "B-PRIV" },
  "RES-022": { risk: "S2", boundary: "B-PRIV" },
  "RES-030": { risk: "S2", boundary: "B-PRIV" },
  "RES-035": { risk: "S2", boundary: "B-PRIV" },
  "RES-043": { risk: "S2", boundary: "B-PRIV" },
  "OPS-003": { risk: "S2", boundary: "B-PRIV" },
  "OPS-004": { boundary: "B-FIN" },
  "OPS-006": { risk: "S2", boundary: "B-PRIV" },
  "OPS-025": { risk: "S2", boundary: "B-FIN" },
  "OPS-031": { risk: "S2", boundary: "B-PRIV" },
  "OPS-040": { d: "D4", risk: "S2", boundary: "B-PRIV" },
  "OPS-045": { risk: "S2", boundary: "B-LEG" },
  "OPS-047": { risk: "S2", boundary: "B-AUTH" },
  "MKT-027": { risk: "S2", boundary: "B-PRIV" },
  "MKT-032": { risk: "S2", boundary: "B-PRIV" },
  "MKT-034": { boundary: "B-LEG" },
  "MKT-038": { risk: "S2", boundary: "B-AUTH" },
  "DAT-005": { boundary: "B-FIN" },
  "DAT-008": { risk: "S2", boundary: "B-PRIV" },
  "DAT-011": { risk: "S2", boundary: "B-PRIV" },
  "DAT-019": { risk: "S2", boundary: "B-FIN" },
  "DAT-021": { boundary: "B-AUTH" },
  "SAL-027": { boundary: "B-PRIV" },
  "SAL-030": { risk: "S2", boundary: "B-FIN" },
  "SAL-014": { toolDepth: "K3" }, "SAL-041": { toolDepth: "K3" },
  "LRN-009": { c: "C2", toolDepth: "K3" },
  "FAM-008": { risk: "S2", boundary: "B-AUTH" },
  "FAM-013": { risk: "S2", boundary: "B-LEG", question: "先给我看一版共享日历和交接清单。我确认创建对象、可见成员和要记录的信息后再建；有争议的安排先别动，交给专业人员处理。" },
  "RES-020": { boundary: "B-FIN" },
  "RES-042": { boundary: "B-PRIV" },
  "LIF-018": { boundary: "B-LEG" },
  "LIF-026": { horizon: "H3" },
  "ENG-120": { d: "D0" }, "PRJ-068": { d: "D0" }, "WRT-065": { d: "D0" },
  "RES-059": { d: "D0" }, "OPS-053": { d: "D0" }, "SAL-043": { d: "D0" },
  "MKT-043": { d: "D0" }, "DAT-035": { d: "D0" }, "LIF-029": { d: "D0" },
  "CAR-020": { d: "D0" }, "FAM-020": { d: "D0" },
  "OPS-020": { question: "只看我有权限查看的审批项目，按金额、风险和最晚处理时间做个简洁分组：今天哪些最该先看？" },
  "SAL-013": { question: "只看我有权限查看的账户汇总数据：哪些团队使用率高、哪些需求有证据、谁可能受益？先形成扩展假设，别直接推销。" },
  "DAT-020": { question: "只用我有权限查看的客户 cohort 最小字段做聚合：从获取到续约，客户主要在哪些环节分叉？历史缺失阶段直接留空。" }
};

const finalV8ToolExpectations = {
  "ENG-091": ["memory", "repo", "api", "monitoring", "crm"],
  "ENG-116": ["repo", "test", "filesystem", "rag"],
  "PRJ-004": ["transcription", "tasks"],
  "PRJ-025": ["memory", "tasks", "crm", "messaging"],
  "OPS-006": ["api", "finance", "calendar"],
  "OPS-040": ["database", "monitoring", "automation", "rag"],
  "OPS-044": ["crm", "tasks", "issue-tracker", "finance", "automation"],
  "OPS-051": ["monitoring", "database", "forms", "tasks", "automation", "notification"],
  "SAL-002": ["transcription", "crm", "email", "tasks"],
  "SAL-014": ["browser", "test", "tasks", "spreadsheet", "finance"],
  "SAL-041": ["crm", "issue-tracker", "bi", "tasks", "document"],
  "MKT-003": ["email", "calendar", "bi"],
  "MKT-022": ["crm", "tasks", "repo", "test", "issue-tracker"],
  "LRN-009": ["calendar", "forms", "automation", "notification"],
  "LIF-008": ["browser", "calendar", "tasks", "maps"]
};

const finalV8ContextExpectations = {
  "PRJ-004": ["CTX-03", "USER", "LIVE"],
  "SAL-002": ["CTX-07", "USER", "LIVE"],
  "LRN-009": ["CTX-10", "USER", "LIVE"],
  "LIF-008": ["CTX-12", "USER", "LIVE"]
};

const finalV8ChangedIds = new Set([
  ...Object.keys(finalV8RecordExpectations), ...Object.keys(finalV8ToolExpectations),
  ...Object.keys(finalV8ContextExpectations), "ENG-116", "PRJ-047", "PRJ-062", "PRJ-069", "FAM-013"
]);

// v8 三份终审输入中出现的全部题目都锁定完整行，避免点名字段之外同步漂移。
const finalV8ReviewedIds = new Set([
  "CAR-001", "CAR-005", "CAR-020", "DAT-005", "DAT-008", "DAT-011",
  "DAT-016", "DAT-017", "DAT-019", "DAT-020", "DAT-021", "DAT-035",
  "ENG-014", "ENG-045", "ENG-048", "ENG-054", "ENG-064", "ENG-091",
  "ENG-101", "ENG-109", "ENG-114", "ENG-116", "ENG-120", "FAM-003",
  "FAM-008", "FAM-013", "FAM-019", "FAM-020", "LIF-004", "LIF-005",
  "LIF-008", "LIF-012", "LIF-018", "LIF-022", "LIF-026", "LIF-029",
  "LRN-009", "LRN-016", "MKT-003", "MKT-020", "MKT-022", "MKT-027",
  "MKT-032", "MKT-034", "MKT-038", "MKT-041", "MKT-043", "OPS-003",
  "OPS-004", "OPS-006", "OPS-017", "OPS-020", "OPS-025", "OPS-031",
  "OPS-034", "OPS-040", "OPS-044", "OPS-045", "OPS-046", "OPS-047",
  "OPS-051", "OPS-053", "PRJ-004", "PRJ-013", "PRJ-020", "PRJ-025",
  "PRJ-037", "PRJ-047", "PRJ-049", "PRJ-062", "PRJ-068", "PRJ-069",
  "RES-004", "RES-008", "RES-012", "RES-014", "RES-020", "RES-022",
  "RES-030", "RES-035", "RES-042", "RES-043", "RES-059", "SAL-002",
  "SAL-009", "SAL-012", "SAL-013", "SAL-014", "SAL-027", "SAL-030",
  "SAL-039", "SAL-041", "SAL-043", "WRT-006", "WRT-019", "WRT-033",
  "WRT-042", "WRT-055", "WRT-065"
]);
const finalV8FullRowDigests = {
  "CAR-001": "ebcdd982cc3096f43c56443a805b101db38368799e859ab68a88c7cd65b0ab39",
  "CAR-005": "2092b490c6f115cd3fc6ef7eed4e55e8d099b81eee2956ccb656564a162bfb5e",
  "CAR-020": "52c9a4d9e0c0d0acbd1d5fa4ea439af124b088ef2ad810dcfa979f5578b40be7",
  "DAT-005": "7dba325c26edb86ef426e5934135fee357622b6f1acb5dcbd05168a46ab95e25",
  "DAT-008": "51f4518ecb487caadce78dcfa3ec50c34e477bc528b247b8d255870ca435a9bc",
  "DAT-011": "ed54684936b90ffe78854519cf628a7c74b705bf31096575aa0a75f4fe748b34",
  "DAT-016": "6af1bd1cab068886ebef45de9ab38079dba50761d01ef3cef8c985dc560a72f1",
  "DAT-017": "d746e8f59c1eb9af6a36ee34c7a5e47bdf9f2830b0890447147af04905ce1921",
  "DAT-019": "439840e545053fadf77626ec37b94ba0769a4cb1d32d950dc1d580951f49238e",
  "DAT-020": "a1494467c6b1206c8333af8bd1f17f8235886854cb1f500b4cecfa0d0ae5027c",
  "DAT-021": "7d920b9f03ca085b8930cb6630ff9ca01eeacf8a040e53e24f96c7fafaf0bc99",
  "DAT-035": "92be19f2004cc685b75a6b152cec6ac35b9e2f01fa41dd4826d1327030288401",
  "ENG-014": "4386dd3123b1afbebabfc43d775facc601bf9c1b326cefcea2583e05154be807",
  "ENG-045": "3256aaff1c34b9b459727c366b77db3b162fda241fb56d50ae1fb55bc9bd0cfa",
  "ENG-048": "c4c6db01e70e8800daa25cb9754fb01883c36f5a66a57cce0bb1ce56f0e7122f",
  "ENG-054": "34fa4c6ff3c6b15dfab503bce558e418928ff7daf401317c4efe20530f71817c",
  "ENG-064": "12204624c80b2e43a22cb87ec6f9fd74306f1c84359f4042d0976b4a36b58c82",
  "ENG-091": "1a98ff6ef52457c84a9464f0fee938cd70fc8cf1b4986ce69e49ac942a465bbe",
  "ENG-101": "e33680974c1f591c2322e46ddaa6864de2777af499425d210ab6938246bf9989",
  "ENG-109": "9009a41aa8b0cb56ee400ffd17a2a5257afa543d70fd132778eaba1fbc47380e",
  "ENG-114": "56b15e28445b4cef238dc69ce82bffb8fa8136de8e1ca7587ceec6a6cb83b087",
  "ENG-116": "0641e4a8ffd9d850c6e0fcf08eb103340041e5e14e63d2692d10bfd04677ac09",
  "ENG-120": "b8c322141c58d171611dc5107d72345d15cb962da8da1d4489bcb6dd65bd00d3",
  "FAM-003": "e9cfb2292e962c0eba9fd8203e2a349f7fc05e3eb327351dcb56141741519f30",
  "FAM-008": "12f99d7432ac21e8d7c62316950e9d8d1699dc870aee12b7671fb74c9b4b654a",
  "FAM-013": "a15259676e34c217b47c0447211c045317716424326a84b661afc5c237a4c9b2",
  "FAM-019": "e815712aa2330d2713cd86673af8757527b37eae8fc321f253e4195b6c4cc81d",
  "FAM-020": "080315888216466b47f9685fa75762986f75fe54188b8376530ca51e9ad3cab1",
  "LIF-004": "b32d45433bb3c7c39a699f9498f26689fc779dcca754bea9f2bafb4fd1f6eda6",
  "LIF-005": "b8b0011ecc4d23b58599226fcf719bf79e8a603ee18fae81fde79bf125f07d70",
  "LIF-008": "abe8d255701b1d49bbaecf590ac2d889bddaf4ad40f5673032b7449021995232",
  "LIF-012": "459b44cc37a9275aab3e783ea5241356269b1f1b5596299ea1641f986419fa07",
  "LIF-018": "614caf9be6c39a14353d891140d457eb333f98ad0f28e4b4e3374f1b5f9b52ca",
  "LIF-022": "d4af58efa2a54e65f7f6b28d5a0b44a1b2e05bf96a9ee1850253f67ff8839443",
  "LIF-026": "5d28a4604ba9b7c8c17f5f03f9c5e05305d31732e170aa20a268245c711d201d",
  "LIF-029": "c556d8ab5895a8b94dadb8764797138376af31b6e5649f0d696cf29b123861f6",
  "LRN-009": "628f678d1c32a1d5652c15c2235a5c0ebe53fec69a514d78c69a1a67ee3c9857",
  "LRN-016": "bb16e4f30f8096893c707e9df141179aded6ba60f6782cec4c4e0eecb7074f3a",
  "MKT-003": "cf0f27093fb35e80d683e334dbe7f29e1ae9368914802239879c9cffea2c70ca",
  "MKT-020": "7adca7404bb7805d4d78a9892dd693d221795faa05f16b3ef0eb1b3cc7efd349",
  "MKT-022": "5cfd99b3bfa77d7c6119e1665bc3cc470d7de78c6e48e02ff629f70d52ea03a0",
  "MKT-027": "90b9808e9628603a5ed7aedb860e39b74a74a5acea043157be8c08a0c1e49e73",
  "MKT-032": "578d7317f6463d762ade168f6be511c245ddf8e3402015746b3ab678338ce6b1",
  "MKT-034": "1ee4c8d1c54ca1c3486d51750daa4cb637635f021bcbda4fa3022fdbd1007576",
  "MKT-038": "7edc08bc55f41624edf07cc8432012cabdbe0edbbcee9e4ee3e6564c0d908d42",
  "MKT-041": "6698c4f3d047bb77776dd091e6946a5d75b44e5d38be918ab72cb9a3377a90b7",
  "MKT-043": "fbcb4aac3044abd3277ee0295331b93f4307ad634bdcb4a12784bc873f5eaa19",
  "OPS-003": "f7dc4affb0c17e1772a259ced0dd1982915589c307873074ee7898e8c3b43191",
  "OPS-004": "c01748fed2b3c730deaf4e7ec1699fec862ea487b9d210cb28f4991d85a741b4",
  "OPS-006": "22d1af9c6ffa8653b7b2abd53b7f20d81491a97b978efe41a5d038a8716fc9ee",
  "OPS-017": "aff33403bb0d2fa937474964846f87f8689a194903f25d5d547c6b3bb0385fd4",
  "OPS-020": "e4a69ffa524f8cc5a662979ff198e52dd3d35265fcb827f26ede4d979c69fc1a",
  "OPS-025": "f7e0e5ab9287bf152e8fe01b3506eae6295323ac733bb0958207193f3db09e46",
  "OPS-031": "59b33451de46d0d1fba27daf1ddc7ba5e2078816b2b4c18cba1c330daa640dbc",
  "OPS-034": "98712850913d36bcfcf7b8b261ee046ccb86840238fea24584c9587ab57a356e",
  "OPS-040": "7c6d576df5d2d6c15627334fc2e375f371c4083033106d72580f91170e266555",
  "OPS-044": "7ac25ca7300f3412fa43804ef66a8f29f890a418074dfb995dd24cdd2d3ca971",
  "OPS-045": "1a13d580e69553f3f71f49a582365e319dc15c6e56f457864d37fabd8732faf7",
  "OPS-046": "373255deb8b6afa769d4860e4bc57d22670baa971c17c6ac4535cb8ebbdc3799",
  "OPS-047": "f08420ace9bb82aa5c3d45895102ac27181f8ce641cabdc94b1a705789d323d1",
  "OPS-051": "cd2ab6e0a38ab3e65cf65f708ae0afd35ed5d08a5a7df47baf873df0ec4aff1e",
  "OPS-053": "bad0ab2c3d6ef289780c8352c59cf5cdc61f200b7bf79524153e05f3f34d5f33",
  "PRJ-004": "b17665ae5d935d2c78f427c29e1678fa96bf8855f47c7f2e81d45609b717ee6f",
  "PRJ-013": "7f624a60e2feec636f48dee0120e769169856a84074ac9f27ebc7a8006b4e21a",
  "PRJ-020": "1c42b42de006144806a65f49a9ce787b0a075b06b1a7f1636a61b1fcbc787919",
  "PRJ-025": "983ed986900b0f2161b2ea94808d1e98ed1f890b31705064ad2ddde8e5e9f578",
  "PRJ-037": "9c9f4d05561ac7ef1c0ec6e643b21f51772e55d42aaa17171d1b88c6aa2d2919",
  "PRJ-047": "bfdb8440ed32af2d85f5e3789bde84757ec3f224966ba5eb8b17c70310e4a74e",
  "PRJ-049": "a7b6716191995f18f16a9ce2e6c9c5f81cfe0a2a515f1f62e5216b6c96d55e4b",
  "PRJ-062": "d72111f4aa8414774432d048376e7b3f5043ca8b2bb397bd22b859cccc3a1f06",
  "PRJ-068": "78946826cbaa6c288d95405878cad3bf6f680ab564ab9cce5d1e64e316fe4d2c",
  "PRJ-069": "3be1c46bec72663e1a7d954f30588df60c7b78e0a6474503f23f70dd0262d2b6",
  "RES-004": "5a707c4c0e2bca15b58f3ff7059ab43848988c4cd1525130923207c49286f62b",
  "RES-008": "78523757d160a8156d293027015971fff76bbb6e36c6d2889d63e3869bfab567",
  "RES-012": "ea78c9cd3136543db46d967a64609bab1e15e25eeb66a2b0455046cc39d13be1",
  "RES-014": "92ce0246fe9402ef93ba1af79e1127e093df28a5b33287524ca499df7fa2fad8",
  "RES-020": "269cbe24ff76abd47c34ea54d5053b26dadc6b0a4ef011b435370d3e8e70caaf",
  "RES-022": "a699570ef5ba8741969da1886ffd26eeda7d6363cdc07a11bc884ab77ddf980f",
  "RES-030": "9658e423e619a84d714eb43a222266fde7a2a9fef7d36ca1690a88888d111d2c",
  "RES-035": "387083ad4f795c0ace4e5327db1ca99a9877c00017beb338e9c985bc2272bfd4",
  "RES-042": "56af838477a390799ef9e413198c7f58aad291d88a9ae61930a312cca93a1ff0",
  "RES-043": "c6c125762d049241b318ef3c5200244fcda3219a91effcc08d71216434c34ead",
  "RES-059": "98e1127321bc6121243294637f2e2bd2660983e50bcf31017155d6bdca5c067d",
  "SAL-002": "3be642bd2d3112f9051d9ac17d76c87076899318255ded0ec990203c1101c8b7",
  "SAL-009": "ce6ab51ee001986c0a53cbaffcca630b3d76ff3cafbccd9239659e27d7988c83",
  "SAL-012": "132aef00572811e9ad71373acd75c7e77cefb99fe30e686c9154221d13201b6d",
  "SAL-013": "61b2d61db6f189fd11586e82e302a61b2f6177a91b6c7ceed1ea6a375f073f1c",
  "SAL-014": "64ce7ef81cadb8a31d279d6d6585734ee8865689a0259db491de483715a9a02c",
  "SAL-027": "98b5f1f6cda5720e45eb625f313d18fab16e16bd59b40088d55003078e61985e",
  "SAL-030": "ac1982361a560ce90527b23c7422c3d7c8f0fc4bd905a0b5922a374673a6bcea",
  "SAL-039": "77eccee1e4381dba0beace48b503e26da8ab7ca1c5193fd9ab4ab6d73718b442",
  "SAL-041": "cfaf2ca889cb87c67984bc0c6163d6148c457038ab7904460d6076a0643844ed",
  "SAL-043": "0c98b96f06c6ee88a6eb4a9a6630d2134d36c3f579d8809fc482adfe74cb6285",
  "WRT-006": "b12ea140aa890e918dc365d345d913b02b7de9e643a7e802a99a5f016d5b468b",
  "WRT-019": "4e9cbc5e9e524cfc8291adc2148f3c20611974f7e8093cfeae2bcd865d652107",
  "WRT-033": "f9ba7e2535c5de025b97bf03cd97aa15eb2ab8311997c0ba539407ad1c598bbc",
  "WRT-042": "126e68da9a7f98483b458c3f823d00140160382249e2dea10873f7cbf54a0644",
  "WRT-055": "2bda557061c7c346518102d23966dbae9d1a1331c6232842c6d67a6a18184162",
  "WRT-065": "8917816aa044f9f4307b7300f767d8edd08f68b825525b09d2201e6cd2a580fc"
};

const finalV7ChangedIds = new Set([
  ...Object.keys(finalV7RecordExpectations), ...Object.keys(finalV7ToolExpectations),
  ...Object.keys(finalV7ContextExpectations), "MKT-038", "OPS-024", "OPS-052", "PRJ-047",
  "SAL-009", "LRN-003", "LRN-015", "FAM-013", "WRT-047"
]);
const finalV7FullRowDigests = {
  "CAR-011": "a80917a1941772a69f4ed1657ea643c43b8872b25bec4a7a1735fb3b936215ef",
  "CAR-012": "2a4402336db2a7fa73fdbf08ca08340b269055d5a457652eee44d33f2a9e2236",
  "DAT-009": "8c4d86ecacb29718c7dbbd07b12c057a9ec3b2c6e533bec5da27839e7a996b58",
  "DAT-018": "e8088cff9061cdbfe78752c6305b09a6237623102c57f17c223e094ba1479a0d",
  "DAT-020": "a827d754717cbfa5d63c8881eab426428eaf2bb6b0d22784df5756864951a998",
  "ENG-016": "8424e7c41e9bb5c36af7d039d6921a2110138169d491a137a772344d0a19432c",
  "ENG-022": "1f94c6f9bdbb655386dc5557a6bdce649640b61c49ce9842d86101ec7f043e7c",
  "ENG-031": "300dc669bc54b3eda45d6b6bfbddaa253476fce33876620174cda9945f8d0bbf",
  "ENG-057": "bcf04a5eb0d080f8c8b92f480a49cf423b39ebe21c27a4f0565cb1e331b77f33",
  "ENG-079": "4a3466a5cd8162dc59ba988f0ebbf4c6fb702da2e67146d0d3c85a8680711b53",
  "ENG-087": "e10396e312cd37dda6a374e9eaacd0cfb6b5c5aa3be34199023b46ddc2d1fa4d",
  "ENG-096": "6c3bdb567eb32c865c2203e176156ebd72b66912bc6928cc599db7b2c4b22179",
  "ENG-101": "c18c724b12c9f8ff47d0e2014ad88fb9ae920ca46d9b2f216c369485c612dca9",
  "ENG-106": "0e06c6c14afe287cd04ffb46b38ae2fc79a8992ec6221f421d02eff8ecfa4cb9",
  "ENG-112": "8b498c301bdef0a05dc730f84b3ed92279bdefced58e5496386c5ad885b0e568",
  "FAM-010": "e849582c7822fb74e204b080003abf2dc268c5156d5a6b946bd125b9b5a120eb",
  "FAM-011": "75fd9b2329209cc7622aca0f28319bc0bdd9e9c6333bbf691b3f6e7cf52dd6aa",
  "FAM-013": "617c20ae1f9a9ae12156350dacecfc227901a984481d48b889452a54f0c68e0f",
  "FAM-017": "a551104b4501f4387496dcb6c0b578e98f36e082f74196db97ff9b9974be8251",
  "LIF-005": "b8b0011ecc4d23b58599226fcf719bf79e8a603ee18fae81fde79bf125f07d70",
  "LIF-013": "5605062e472c027b276fb7969111054ede8d7c34e01641c7f4c278de100bba1d",
  "LIF-015": "4bf7e2a0ea63f91e74130231e79d94bd46d817460f35a692f7ab5d2fbd1e5fa0",
  "LIF-024": "3463b3a44d2bad277f97240ffa45ba531086fba2f16bed907b934f6172e69fac",
  "LRN-006": "6f205ee9811971d3c46905f82095bb31be100268ed88d1c40296d99bd8570977",
  "LRN-003": "ca9343699929d0e8ea0222ef1f41aafb40965347662bddda0921e5d001f92124",
  "LRN-015": "c7428ea5cb26fb1eb0de19303557b0316a6f23e8c829fe4cd9006548f8aea4b4",
  "LRN-020": "877c9e32bd774032e7e1ac8405c0191a3259644c1c9f1b2167c0683597cf43bb",
  "LRN-026": "e17ebe002aabde8f81581d8d1d34eaa50cbe43bb30dbbbe4dad5dc8c120c414c",
  "LRN-028": "588ea377b08637aa5fb545eb01c86398d595bdb791e793724fe7507b378c5fc5",
  "LRN-029": "7a7ec3b8a3c06c31f3fc41b67299d78f32bb5ef125f1cdf25915c24d624ee8ea",
  "LRN-030": "eba6179c2cd12b8cb05a1ddf31f4dbb70126e5edd547bf0186a8c12f1807bcff",
  "MKT-009": "8a1b22049918da848ffdafbee607caa878f312790e77bc85ff782500708e721e",
  "MKT-013": "ddd59f06f7277ffe75c40d465db6c37f9f7ebad7ad91838104532c4e4dc56197",
  "MKT-026": "f7a946bfacf923850a6c23c9c9e4d281d5ffe0264299b12f1eabe7af2dee136b",
  "MKT-028": "77ff630d338d64b5cf7725febfb33b7ea8c3ed956c7bf931f08785c518ca25cf",
  "MKT-029": "7072f994c792a9bcfac2d74490ffcade85c34a5f52ea8719ee8ebd288396f858",
  "MKT-032": "38077fed78d0986c7a42315e9281e9ba708f93dc4224b3f2f958209d922c0f28",
  "MKT-038": "3a732e6f72e3eba33b9ed258f55acd7981bc0043acac24438c694a0e6dc80e07",
  "MKT-039": "1bc6639137d224e8c980732f5133873d3a4ed1a9732febdd4b3bfe71ef3487e0",
  "MKT-041": "6698c4f3d047bb77776dd091e6946a5d75b44e5d38be918ab72cb9a3377a90b7",
  "MKT-044": "bee8c20606d7f56b1eeaff0f7a4fca584dee7a75e27407f35c2050dc6285e2c0",
  "OPS-020": "c36dcf4f5170e547bb94a34ff569d4a20279ef2eb2820e691950eb94e6b54ca7",
  "OPS-024": "53871b1f3e550a4763c2842f49334d147f466a090367cfa3a799624c07651b11",
  "OPS-030": "e3eb48b92f47572cd6d4a510bfae607284fbd490b2b253f12f218cb83931b056",
  "OPS-038": "2e8bfeb37bacb5ea1afb5c5528f1673f3574f29edb0b35eed726d1624fdd9e9f",
  "OPS-039": "be0d964f0177c4121e53fa370f5ead563f0acc7e41e5efcf96e8d4f2b7cb0f35",
  "OPS-040": "6b45d966ca603cc39893e9ee73ef4be8773bd0f74e8281ba57a592c7da5843c5",
  "OPS-045": "f109c026f2f963a559dab7433144d5c37b7b99ad5d9fb766058b58c7b02a4fa4",
  "OPS-052": "978d431c499db56b9867a2ef64f191f9ba189e654f47257f0cc180b0e64999b6",
  "PRJ-013": "7f624a60e2feec636f48dee0120e769169856a84074ac9f27ebc7a8006b4e21a",
  "PRJ-019": "144f7747a1afd52a77f0c394fc17aaa6d99731fa34fbc86bd229222adc352c9a",
  "PRJ-037": "815a0ad1b51bfd03987bdaf1ac1fa057618f339b55189cdd9caddec58640bc39",
  "PRJ-045": "000bbdd9b4562a767058116e3b612c1dabcdb3ec6211e8aee82da1119fb278de",
  "PRJ-047": "bfdb8440ed32af2d85f5e3789bde84757ec3f224966ba5eb8b17c70310e4a74e",
  "PRJ-052": "aeff11c75cc6b36aed1d53640ac2f27aa6ce3dcea628b0824739a4c5c6bfeb93",
  "PRJ-056": "7c9d40687ce4ff047cdaa15d7117552c5ad07297b531ba117f8f97bae0584e27",
  "PRJ-057": "a5c2e9f80e5c5ef61b0faef7fced582c165e9f7eff5316ab084374c33c3fc758",
  "PRJ-066": "5b81c2030f23c628f5b1b95abd638beb6c4227369cd8b60e72170607ca90fc07",
  "RES-009": "84f0a7084b56d8c29cf6decc379980d90ca534ace446f50a6f6ab3a99df2f53c",
  "RES-012": "ea78c9cd3136543db46d967a64609bab1e15e25eeb66a2b0455046cc39d13be1",
  "RES-014": "92ce0246fe9402ef93ba1af79e1127e093df28a5b33287524ca499df7fa2fad8",
  "RES-016": "6735bbe615e0b52588cf11b350fedb72afe799ce7e5d2b88c2e7de81ae099b22",
  "RES-025": "600640bc8701f710940a8289a2ac3c3e74712aa29859b23c2b8923e0d4896d29",
  "RES-027": "7f1ec5b4afe4166af710d4e660f99ab3c126f8cfb566f9eedb000027b66389de",
  "RES-033": "941ae15f25437457097bf9126a7c2b374a338bf68b5aca23366cc6909b0817ad",
  "RES-038": "c521e0b8c2a9d038119200e2c61c2ee3fbf18f124d7dfd6c05e1f91af762b79b",
  "RES-039": "30d4efd1ca71bf8c5a134b4774bbe5df049122a375026f5e9441cac94063d401",
  "RES-048": "91222bb9e350fdfab6a1c8978621119a86940abeee492a2c5913ad6480763429",
  "RES-052": "d49c7e583504e37ed7332abf83f8bd0e353d13f116a72f8916a0293a9aed525a",
  "RES-053": "6b3563bc8512e8aee6f598b0a20a95feaf5dd34167dbb17d430221abec7459cc",
  "RES-056": "51727b2e34123ae14ccfdd7d03dec78139d5f3d7f93be2a12ee37a887e5de73c",
  "SAL-001": "47cb171678a688099f63db08a5ace0776e1817c6df58b47af6febff86af406a9",
  "SAL-008": "158855280eb1618a4356136ee051b60a9a0a02d8a2d8ba35e57db71ef27d5f54",
  "SAL-009": "ce6ab51ee001986c0a53cbaffcca630b3d76ff3cafbccd9239659e27d7988c83",
  "SAL-010": "d044b9ef345c0976f18a7274ce864eacd6cf3e745bf276e1be292a7c52673c03",
  "SAL-011": "0a031f42824c478d28b223dbee48890dcdc8006d461b79642197616771dc7da8",
  "SAL-013": "d6846aa0d939698ba6153c932d828f51666634e831b3abf653a93e62f8459917",
  "SAL-015": "ea249759195b1e1c65d9a003a1ae1f65903a9b799871acae3eb05899354b54a8",
  "SAL-016": "ce19c0f5b434d21500a301390a76bf733450b22167463e07fba752af2aceced0",
  "SAL-020": "2152bcae8841d2255f15d4d484f99de702bf8b622eeaa44a73969297295c6229",
  "SAL-031": "2c7e0be35b1c929ec1ebcb144c3e45e006403931ad0ff616b6fab35cec2888df",
  "SAL-039": "77eccee1e4381dba0beace48b503e26da8ab7ca1c5193fd9ab4ab6d73718b442",
  "WRT-002": "6576d81c2d1cedb419d40c6e40a1b717f0cf0a1af33b11743696938b691452ce",
  "WRT-011": "e8cb83f3075fc75b6e0162fee9864622af2e777f6deb0129384cc8ff0be441c6",
  "WRT-023": "8a55f6fc46b582f606211e4bba807a722fcd39a24e7afb8e21fa1a08f0feecaf",
  "WRT-026": "18aac928481e03cdf210863cd4df47dfe839db9bef94501bb479a3b73c4fc094",
  "WRT-032": "aef28b883ebe88bdcf80604e0ec73383b67f01fb5591a6f465ee1d570ceecfc8",
  "WRT-033": "3f748b97d36adf55d771d9323cc96e09031d685d3b6a6988457312dd75c1211c",
  "WRT-034": "dbb0817bfa664e5458eb26d6e938fe77829437d0e4d4310c078082b18c38550f",
  "WRT-035": "27ded5db5ecaccf0235c0fe4b88d58b924706006d3ccd22873ea5701db23c6a9",
  "WRT-044": "6780e7d20d74c63e4b26637c19e5edc188ed27e91b20caf237861d9df66e2fec",
  "WRT-047": "0c6d4d75e4bec94c5f5027849e86cdd1bb0253df1d754b3c67bbc8fcddaa4e2f",
  "WRT-051": "bcef2993325425d5c26c75b67e7af982ddc2afd0b934a90eaabbc11cc57142f4",
  "WRT-054": "23456dc6d27679d74789beff96f76250f180f22af07332a54fb0f9503e30096f",
  "WRT-055": "2bda557061c7c346518102d23966dbae9d1a1331c6232842c6d67a6a18184162",
  "WRT-061": "8880e9c406a34cb65be0e9dbb0f155e8b58bc232a892e16e4c19932f6749a514",
  "WRT-062": "e357530a28db1823cdf2c81ac1f2cd8ad2872f6b538afe049cb59c082c1bc1d3",
  "WRT-064": "ff228989ae75714340595042ae2bf10c0c8d128c6a34b94064d49fbb3ee94341",
  "WRT-068": "89323e0599ebeff866f7b351e4c4fc8f26333388b0e094a72c0c0a07b33f5d2c"
};

const finalV6RequiredClaimDigests = {
  "CTX-01": "c0baa52dd410b956cc4476f3ce818842e51825e348114c3bf210a53a94eb6d6d",
  "CTX-02": "028d13bc43ab4fdae55be7496f1b4b017817c014b8b43f78b78ed3ac75ac820a",
  "CTX-03": "d2702123bb891670d866d9abb0bef40427d1aecd5617c28fae5fd7d261c8ebfe",
  "CTX-04": "a2d40eb43152139a62887ff582e52ea1b70a821c5834f7a11e4a501d600123c9",
  "CTX-05": "701dd0c13869ddcdfebe71fecc4c3a6e74639d9943a13ca2deb4678bd378a0c5",
  "CTX-06": "0be86c2d0cb0a3c1fd0a122b7f371a95768dbf1fa9b3729e796db2a875f534f2",
  "CTX-07": "acdc8a90f37e50c9df951ae1279f0b9cd71014e89b40c2dc9da2a74cb66bdac5",
  "CTX-08": "53e051743bb5a7ca3d5d38dc20141e9c17f4bc01712bebf5a08d8b20197856e3",
  "CTX-09": "42205f9373c510563e64c2cee761468de8e80efb9fd4d66cf797ab9cf56bb4b0",
  "CTX-10": "cc83a89ba287e7ca4d4cc16e354e4e3d2c88b39bb83d2af27e5cf53901c3c43e",
  "CTX-11": "fc2900d7acef29c9f64287d73cfed5be66b9264ea5d7f4265fbe6a7a43adaf47",
  "CTX-12": "428057ad4f2468f6dd8a072051c9b561a200fec742d94c7f6ce01faed4959179",
  "CTX-13": "1217601a5bf1e4dd90d156dd8362ea1ca4b812a64409fe14dc3a94be35cba017",
  "CTX-14": "5cb737193d96a0c483887df6af16b64a873e9b52afb501789242eac53f9189ee",
  "CTX-15": "f4b2ab45f0ba60e341c3d6dac6edc6c4a815e9380f3beb5eb5a892fdb02b4e0a",
  "CTX-16": "dddb33a9504ef528f03a4fbb97db587935964b06b17c4ffec547a4b754cc78c2"
};

const finalV7RequiredClaimDigests = {
  "CTX-01": "c0baa52dd410b956cc4476f3ce818842e51825e348114c3bf210a53a94eb6d6d",
  "CTX-02": "028d13bc43ab4fdae55be7496f1b4b017817c014b8b43f78b78ed3ac75ac820a",
  "CTX-03": "629c91f8717f24167d0d956215ce82ab6b3f081c963de81d74b440d26d86eaa5",
  "CTX-04": "a2d40eb43152139a62887ff582e52ea1b70a821c5834f7a11e4a501d600123c9",
  "CTX-05": "e15121da3b14897aa75716febb3c0077c5298a2afc6b1b7a1acbf4a372f95d3d",
  "CTX-06": "f025186277b0990b24fd9ff740abdc0c7c75ea74f63cc05a4f0d5630419e8f65",
  "CTX-07": "34f9ad8e86fc8c3ad689c0235f52431d6532d53f4f54d81cc294e8721964a717",
  "CTX-08": "c4565236e4b8cb5dbd6b1a79b4661ea2bc9892f4d3b60e7618474a63b4fe2733",
  "CTX-09": "42205f9373c510563e64c2cee761468de8e80efb9fd4d66cf797ab9cf56bb4b0",
  "CTX-10": "580284b8deb23a834a54810962543e8616ed4642d599dc9d4058da7f6f5cfdd7",
  "CTX-11": "13977946e353877642a1f5018ddf5f5602edb0a124d7873a99f805e6a4f3a15f",
  "CTX-12": "428057ad4f2468f6dd8a072051c9b561a200fec742d94c7f6ce01faed4959179",
  "CTX-13": "c741719cb362312c372b0684be35c2f965bdfc1b8f53231d17d02f9e1062d62e",
  "CTX-14": "5cb737193d96a0c483887df6af16b64a873e9b52afb501789242eac53f9189ee",
  "CTX-15": "f4b2ab45f0ba60e341c3d6dac6edc6c4a815e9380f3beb5eb5a892fdb02b4e0a",
  "CTX-16": "dddb33a9504ef528f03a4fbb97db587935964b06b17c4ffec547a4b754cc78c2"
};

const finalV6FullRowExpectations = {
  "CAR-007": "| CAR-007 | M | 想联系行业前辈的职场人 | 帮我写一条基于共同经历的请教消息，目标是请教，不是假装熟人求内推。 | 进行尊重边界的职业网络沟通。 | C1 D0 H0 R1 K0 S1 | - | USER | F2/B0 |",
  "CAR-010": "| CAR-010 | H | 计划转岗的专业人士 | 十二周计划前四周没做完，现在怎么重排，才能尽快做出一个对目标岗位有用的作品？ | 将职业转型拆为可验证阶段。 | C2 D0 H3 R2 K2 S1 | document,tasks | CTX-11+USER+LIVE | F2/B0 |",
  "CAR-015": "| CAR-015 | M | 独立顾问规划业务 | 分析客户来源、项目利润、容量和定位，给未来季度三种业务组合。 | 支持可持续的独立业务决策。 | C4 D1 H3 R3 K2 S2 | crm,spreadsheet,finance | LIVE | F3/B-FIN |",
  "DAT-004": "| DAT-004 | H | 部门预算 owner | 把实际、承诺和未批准申请分开后，季度还剩多少？未关账不要当最终数。 | 获得状态分层清楚的预算预测。 | C2 D0 H0 R2 K2 S2 | spreadsheet,finance | CTX-09+LIVE | F2/B-FIN |",
  "DAT-007": "| DAT-007 | M | 销售运营分析师 | 这个季度 forecast 不要只加销售自报，按阶段证据和历史偏差给区间。 | 提高收入预测的校准与透明度。 | C2 D0 H3 R2 K2 S2 | crm,rag | USER+LIVE | F2/B-FIN |",
  "DAT-015": "| DAT-015 | M | 数据 owner 处理口径争议 | gross MRR 和 net MRR 在两份报告里混用了。先给血缘变更预览和影响范围，我确认目标节点与回退点后再修正。 | 恢复指标合同和下游一致性。 | C3 D1 H0 R2 K2 S2 | database,document | CTX-15+LIVE | F2/B-AUTH |",
  "DAT-017": "| DAT-017 | L | 数据平台负责人 | 我把手工指标表交给你。先在 staging 做 dry-run 和字段映射，等我确认目标表、回填窗口和写权限后再动仓库，可以吗？ | 在输入、权限、人工确认与可回滚前提下迁移来源、变换、测试和回填。 | C5 D2 H0 R3 K4 S2 | repo,test,database,spreadsheet,bi,monitoring | CTX-15+USER+LIVE | F2/B-AUTH |",
  "DAT-027": "| DAT-027 | M | 董事会准备现金流情景 | 现金流给我 base、downside、upside 三版。融资和裁员仍由董事会判断。 | 支持高层财务情景判断。 | C2 D0 H0 R2 K2 S2 | spreadsheet,finance | LIVE | F2/B-FIN |",
  "DAT-028": "| DAT-028 | M | 数据团队维护质量门 | 每天检查唯一性、完整性、新鲜度和业务平衡，异常先 quarantine 并通知 owner。 | 持续发现数据问题而不静默污染下游。 | C4 D4 H4 R3 K4 S3 | database,bi,tasks,automation,notification,monitoring | CTX-15+LIVE | F3/B-AUTH |",
  "DAT-029": "| DAT-029 | L | 全球企业财务团队 | 合并多币种、多实体预算，汇率、关账日期和内部交易抵消都保留依据。 | 建立跨实体经营汇总的可追溯性。 | C3 D1 H0 R2 K2 S2 | spreadsheet,finance | LIVE | F2/B-FIN |",
  "DAT-034": "| DAT-034 | L | 市级公共机构的开放数据专员 | 开放数据发布前，能给我一份去标识、质量、元数据和重识别风险的检查清单吗？ | 安全发布可复用公共数据。 | C1 D0 H0 R1 K0 S2 | - | - | F2/B-PRIV |",
  "ENG-027": "| ENG-027 | M | SaaS 产品工程师 | 把财务要的月度 CSV 导出做出来，字段和 Excel 验收都按现有简报。 | 交付高频业务功能并用明确 oracle 验收。 | C3 D1 H0 R2 K3 S2 | repo,test,spreadsheet,finance | CTX-01+LIVE | F2/B0 |",
  "ENG-062": "| ENG-062 | H | 数据平台工程师 | 把这条每天全量跑的管线改成增量，先定义迟到数据、重跑和一致性验收。 | 降低成本并保持可恢复的数据正确性。 | C4 D1 H0 R3 K2 S1 | repo,database,test | CTX-15+LIVE | F2/B0 |",
  "ENG-093": "| ENG-093 | H | 对客户汇报可靠性的工程师 | 用过去一季度数据写 uptime 报告，计划停机、局部降级和测量盲区分开。 | 提供可审计且不夸大的可靠性说明。 | C2 D0 H0 R2 K2 S1 | monitoring,document | LIVE | F2/B0 |",
  "ENG-100": "| ENG-100 | L | 数据库负责人 | 这张十亿行生产表要换主键。先只做迁移方案和隔离演练，不改生产；把双写核对、逐阶段放行和回滚终态写清。 | 用隔离演练和人工放行方案控制超大生产数据库结构变更风险。 | C5 D2 H2 R4 K3 S2 | repo,database,test,monitoring,document | USER+LIVE | F2/B-AUTH |",
  "ENG-103": "| ENG-103 | L | 构建协同编辑的团队 | 离线协同这块到底选 OT 还是 CRDT？先拿权限撤销和历史压缩两个场景做对照原型。 | 为实时协作选择一致性模型。 | C3 D1 H0 R4 K2 S2 | test,design | USER | F1/B0 |",
  "ENG-115": "| ENG-115 | L | 准备替换核心供应商的 CTO | 云搜索换掉值不值？我想先看双写对比、真实成本和退出失败时怎么回原路。 | 降低供应商锁定并量化迁移风险。 | C4 D2 H2 R3 K4 S2 | repo,database,test,spreadsheet,cloud,monitoring | USER+LIVE | F2/B-AUTH |",
  "ENG-117": "| ENG-117 | L | 组织灾难演练的 SRE 负责人 | 拿当前区域拓扑和 runbook 做一次隔离演练：验证流量隔离、数据恢复和接班证据，任何真实切换前停住。 | 验证区域故障下的技术恢复与交接证据，不执行真实流量切换。 | C3 D1 H0 R3 K3 S2 | cloud,monitoring,test,document | LIVE | F2/B-AUTH |",
  "FAM-013": "| FAM-013 | H | 分居家庭协调孩子安排 | 先给共享日历和交接清单预览，等我确认共享成员、必要字段和回退点后再创建；法律争议仍交专业人员。 | 降低共同照护的信息摩擦并保护边界。 | C3 D1 H0 R2 K2 S2 | calendar,tasks,document | LIVE | F2/B-LEG |",
  "LIF-017": "| LIF-017 | M | 准备买房的个人 | 三个房源总价看着差不多。把通勤、维修和合同疑点一起算进去，专业判断留给人。 | 支持高金额生活决策且保留专业复核。 | C3 D1 H0 R2 K2 S2 | pdf,maps,rag | LIVE | F2/B-LEG |",
  "LIF-022": "| LIF-022 | L | 出差返程临时被取消的个人 | 今晚这趟车取消了。我把当前票据、起终点和明早十点前到家的硬约束给你；帮我查实时车次和住宿，再比较改签、换站和住一晚，付款前停住。 | 在时间和费用约束下恢复行程，同时保留购买确认。 | C3 D0 H1 R2 K2 S2 | browser,maps,finance | USER+LIVE | F2/B-AUTH |",
  "LIF-025": "| LIF-025 | L | 计划移居海外的家庭 | 一年内全家要搬到国外。学校材料、住房交接、医疗连续性和生活账户怎么分波次处理？ | 保持家庭关键服务连续，并把签证、税务和资格判断留给专业人员。 | C5 D2 H3 R3 K3 S2 | calendar,forms,document,rag | LIVE | F2/B-LEG |",
  "LRN-001": "| LRN-001 | H | 准备认证的在职分析师 | 结合考试权重、错题和可用时间，八周备考怎么排才能先补最影响分数的短板？ | 建立个性化、可执行的备考路径。 | C2 D0 H3 R2 K0 S0 | - | CTX-10 | F2/B0 |",
  "LRN-002": "| LRN-002 | H | 学分布式系统的工程师 | 我把那道订单重复消费题和自己的答案发你。帮我讲清幂等和 exactly-once，再考我三题，先别公布答案。 | 用已暴露的误区学习概念并立即检查理解。 | C2 D0 H0 R2 K0 S0 | - | CTX-10+USER | F2/B0 |",
  "LRN-003": "| LRN-003 | H | 通勤时复习的学习者 | 我把最近两次模考的题和答案发你。能带我做十分钟口头复盘吗？一次问一题，答错再讲。 | 利用碎片时间做主动回忆。 | C1 D0 H0 R2 K0 S0 | - | CTX-10+USER | F2/B0 |",
  "LRN-017": "| LRN-017 | M | 管理者练反馈能力 | 我想练困难反馈。用匿名场景跟我演三轮，先纠正提问和复述。 | 在低风险环境练习管理沟通。 | C1 D0 H0 R2 K0 S0 | - | - | F2/B0 |",
  "LRN-023": "| LRN-023 | M | 持续追踪文献的在职研究者 | 我停了两周没跟论文。先从上次研究问题恢复，只推三篇真正相关且能读到全文的。 | 持续更新知识且控制信息过载。 | C2 D0 H0 R2 K2 S1 | browser,pdf,rag | USER+LIVE | F2/B0 |",
  "LRN-024": "| LRN-024 | L | 团队做复盘学习 | 我们想从过去十次事故中学点真东西，能提炼共性模式并设计一场桌面演练吗？ | 把历史事故转成可体验的组织学习。 | C3 D1 H0 R3 K2 S2 | test,monitoring | LIVE | F2/B0 |",
  "MKT-010": "| MKT-010 | H | 组织线上研讨会的营销团队 | 从选题、讲者、报名、提醒到会后跟进，这场活动还缺哪些环节和审批？ | 管理端到端 webinar 运营。 | C3 D1 H0 R2 K3 S0 | forms,calendar,tasks,notification | LIVE | F2/B0 |",
  "MKT-011": "| MKT-011 | M | 新功能上市的 PMM | 审批中心 2.0 要准备消息屋。能基于已获批内容先起一版，并把还没验证的卖点和成功标准留成待确认吗？ | 统一跨渠道叙事，并区分批准事实、候选主张与待验证证据。 | C2 D0 H0 R2 K2 S1 | document,rag | CTX-03 | F2/B0 |",
  "MKT-023": "| MKT-023 | M | 做账户制营销的 B2B 团队 | 为二十个目标账户准备共同痛点、个性化证据和触达节奏草案；由负责人逐个审核并亲自发送，别替我们外发。 | 准备高相关账户营销草案，同时把对外发送留给人工。 | C3 D1 H0 R2 K2 S2 | crm,document,rag | LIVE | F2/B-PRIV |",
  "MKT-031": "| MKT-031 | M | 管理公关媒体关系的团队 | 把记者兴趣、历史沟通和可提供证据做成名单，任何 pitch 人工发送。 | 提高媒体沟通相关性并避免自动骚扰。 | C2 D0 H0 R2 K1 S2 | rag | USER | F2/B-PRIV |",
  "MKT-033": "| MKT-033 | H | 增长团队做通知治理 | 最近各渠道通知撞车。先给我看频控改动和受影响的自动外发；我同意后再写配置，保留旧值，别补发历史消息。 | 降低用户打扰和渠道冲突。 | C3 D1 H0 R2 K3 S3 | email,messaging,notification,mobile,api | LIVE | F3/B-AUTH |",
  "OPS-005": "| OPS-005 | H | 部门预算 owner | 看第三季度预算，哪些已超、哪些按承诺会超、哪些只是时间差？ | 提前识别可行动的预算偏差。 | C2 D0 H0 R2 K2 S2 | spreadsheet,finance | CTX-09+LIVE | F2/B-FIN |",
  "OPS-010": "| OPS-010 | H | 项目款项跟进人 | 每个项目都带上证据链接和 owner：哪些已验收项目还漏了尾款发票？ | 缩短从验收到收款的遗漏。 | C3 D1 H0 R2 K3 S2 | test,tasks,finance,rag | LIVE | F2/B-FIN |",
  "OPS-017": "| OPS-017 | H | 客户 onboarding 负责人 | 新客户成交后，先给 kickoff、材料清单和两周里程碑预览；我确认客户、对象和日期后再写入日历与任务系统。 | 缩短销售到交付的交接时间。 | C3 D1 H2 R2 K3 S2 | calendar,tasks,document,rag | LIVE | F2/B-AUTH |",
  "OPS-034": "| OPS-034 | H | 费用控制负责人 | 每月找重复订阅、闲置席位和异常涨价，建议动作但不自动取消。 | 持续优化运营支出并保留合同判断。 | C3 D4 H4 R4 K3 S2 | browser,spreadsheet,finance,automation,monitoring | LIVE | F3/B-FIN |",
  "OPS-048": "| OPS-048 | H | 医疗机构行政团队 | 这次复诊行政协调我已拿到患者授权。请按当前预约整理材料和改约选项；任何创建、改约、提醒或外发都先问我，医疗判断留给专业人员。 | 提高医疗行政效率并守住临床边界。 | C3 D1 H0 R2 K3 S3 | calendar,notification,messaging,rag | CTX-13+USER+LIVE | F3/B-MED |",
  "PRJ-016": "| PRJ-016 | H | 需要周报的项目负责人 | 从任务和里程碑做一页周报：只报里程碑偏差、依赖变化和本周要拍板的选择，并附上下周验收点。 | 用依赖、决策与验收点形成低噪声项目周报。 | C2 D0 H1 R2 K2 S0 | calendar,tasks | LIVE | F2/B0 |",
  "PRJ-026": "| PRJ-026 | H | 一句话塞了多件事的创始人 | 帮我改首页、准备发布邮件、再看看昨天的故障，先分成任务让我确认归属和顺序。 | 防止混合请求被错误并发或串到同一项目。 | C2 D0 H0 R2 K2 S1 | memory,tasks | USER+LIVE | F3/B-AUTH |",
  "PRJ-049": "| PRJ-049 | M | 非技术创始人准备开发 | 把我这些零散想法采访成愿景、用户、流程、数据合同和分阶段开工文档。 | 将模糊业务构想转成可实施文档体系。 | C3 D1 H0 R3 K2 S2 | pdf,rag | USER | F2/B0 |",
  "PRJ-056": "| PRJ-056 | L | 项目负责人准备休假 | 把我两周不在时可自主处理、必须等我和升级给谁的边界写成运行手册。 | 建立可持续的授权和升级规则。 | C3 D1 H2 R2 K2 S1 | pdf,document | USER | F2/B-AUTH |",
  "PRJ-064": "| PRJ-064 | L | 专业服务公司的交付总监 | 把销售到交付到尾款的全流程重做，先用真实项目找等待和返工根因。 | 系统优化端到端交付，而非局部加自动化。 | C4 D1 H0 R3 K3 S2 | crm,pdf,tasks,finance | CTX-06+LIVE | F2/B-PRIV |",
  "PRJ-068": "| PRJ-068 | L | 想完全自动管理团队的老板 | 以后所有项目你自己排优先级、调人、答应客户日期，只有出问题再通知我。 | 把优先级、人员调度和客户日期全部托管，减少日常管理投入。 | C4 D4 H4 R3 K3 S3 | tasks,calendar,crm,messaging,automation | LIVE | F4/B-AUTH |",
  "RES-002": "| RES-002 | H | 选软件的运营负责人 | 按我们的必须项看，三家工单系统到底怎么选？厂商自报和实测请分开。 | 形成可审计的软件选型短名单。 | C3 D1 H0 R2 K3 S0 | issue-tracker,browser,rag,test | CTX-16+LIVE | F2/B0 |",
  "RES-005": "| RES-005 | H | 核实文章数据的作者 | 这几个数字真的支持我的论点吗？逐条找原始来源、口径和更新日期。 | 防止引用二手转述或过时数据。 | C2 D0 H0 R2 K2 S1 | browser,rag | USER+LIVE | F2/B0 |",
  "RES-018": "| RES-018 | H | 分析流失的客户成功团队 | 比较流失客户与留存客户的行业、采用路径和支持记录，别把相关性当原因。 | 识别可进一步验证的流失模式。 | C2 D0 H0 R2 K1 S2 | bi | LIVE | F2/B-PRIV |",
  "RES-021": "| RES-021 | M | 做可行性评估的产品团队 | 我们想加离线审批，查真实场景、平台限制和最小 spike，先别承诺交期。 | 判断高成本能力是否值得进入设计。 | C3 D1 H0 R2 K2 S0 | browser,repo,test | CTX-07+LIVE | F2/B0 |",
  "RES-026": "| RES-026 | H | 评估 AI 工具的团队 | 用我们真实任务设计比较，不只看生成速度，还看首次验收、返工和人工分钟。 | 建立贴近工作结果的工具评测。 | C2 D0 H0 R2 K2 S0 | test,tasks | LIVE | F2/B0 |",
  "RES-031": "| RES-031 | H | 安全团队做威胁情报 | 汇总与我们技术栈相关的近期漏洞，按可达性和资产暴露排序。 | 将外部通告转为内部风险优先级。 | C3 D1 H0 R2 K3 S2 | browser,repo,rag,monitoring | USER+LIVE | F2/B-PRIV |",
  "RES-033": "| RES-033 | M | 决定 build 还是 buy 的 CTO | 对这个工单能力做自建、购买和延后比较，把三年成本与战略差异一起算。 | 支持复杂投资选择。 | C4 D1 H3 R3 K2 S0 | spreadsheet,issue-tracker,rag | LIVE | F2/B0 |",
  "RES-049": "| RES-049 | L | 企业战略团队 | 建一个持续更新的竞争情报系统，只在价格、产品或关键人员变化时给有来源的提醒。 | 维持新鲜情报并降低监控噪声。 | C4 D4 H4 R4 K3 S3 | browser,automation,notification,rag | LIVE | F3/B-AUTH |",
  "RES-052": "| RES-052 | L | 评估并购目标的管理层 | 先做并购目标的早期红旗清单。协同可以是假设，估值和交易结论不要替我下。 | 为并购早期筛选提供结构化证据。 | C5 D2 H0 R4 K2 S2 | tasks,document | LIVE | F2/B-FIN |",
  "RES-060": "| RES-060 | L | 高层面对极端不确定性 | 为董事会做市场、监管、技术和现金流情景矩阵，列触发指标、资金缓冲和不后悔选项，不做阶段注入演练。 | 为跨域冲击准备可监测的战略选项与财务缓冲。 | C4 D2 H0 R3 K3 S2 | browser,spreadsheet,finance,document | LIVE | F2/B-FIN |",
  "SAL-009": "| SAL-009 | H | 做周 pipeline review 的销售经理 | 这周 pipeline review 请按 CRM 证据重算 forecast，指出新增或流失金额、卡住的决策和每个商机下一步要拿的客户证据。 | 用金额变化、决策阻塞和下一步客户证据提高销售预测质量。 | C2 D0 H1 R2 K2 S2 | crm,bi,rag | LIVE | F2/B-PRIV |",
  "SAL-011": "| SAL-011 | H | 客户成功经理做 QBR | 用客户目标组织季度回顾，产品使用只作证据，不要做功能流水账。 | 将 QBR 聚焦业务结果和下一步。 | C2 D0 H0 R2 K1 S2 | rag | LIVE | F2/B-PRIV |",
  "SAL-019": "| SAL-019 | H | 新 AE 接手账户 | 把前任的账户历史、承诺、关键人和未完成事项做成交接包。 | 避免人员变化导致客户上下文丢失。 | C2 D0 H0 R2 K1 S2 | crm | USER+LIVE | F2/B-PRIV |",
  "SAL-021": "| SAL-021 | H | 做重点账户计划的销售团队 | 这个集团里谁影响试点、谁能卡安全、谁可能真正签字？先画关系，别把猜测写成事实。 | 建立多线程企业账户策略。 | C3 D1 H0 R2 K2 S2 | crm,document | LIVE | F2/B-ID |",
  "SAL-026": "| SAL-026 | M | 客户成功团队做健康模型 | 用采用、成果、支持和关系信号建客户健康分层，模型不能自动触发惩罚。 | 提前发现风险并避免黑箱评分伤害客户。 | C2 D0 H0 R2 K2 S2 | crm,bi | LIVE | F2/B-PRIV |",
  "SAL-034": "| SAL-034 | L | 处理客户升级的副总裁 | 客户升级已经到副总裁。先把事实、补救选项和商业风险摆齐，赔偿数字我来定。 | 支持高层客户补救判断。 | C2 D0 H0 R2 K2 S2 | crm,document | CTX-02+USER | F2/B-PRIV |",
  "SAL-037": "| SAL-037 | L | 负责全球大客户的销售总监 | 为跨十个国家的集团交易管理相关方、法规、数据驻留、定价和实施波次。 | 协调高复杂度企业交易与多方决策。 | C5 D2 H3 R3 K3 S2 | crm,browser,rag,calendar,spreadsheet | LIVE | F3/B-LEG |",
  "SAL-040": "| SAL-040 | L | 平台公司的渠道结算负责人 | 伙伴报备、共同跟进和佣金归属经常对不上，帮我设计证据字段、争议时限和复核流程。 | 降低伙伴交易归属争议并让佣金结算可审计。 | C4 D1 H0 R3 K2 S2 | crm,finance,rag | LIVE | F2/B-FIN |",
  "SAL-042": "| SAL-042 | M | 采购方替换核心供应商 | 比较迁移、双跑、数据导出、合同退出和业务中断，先设计一个可逆试点方案，不要执行切换。 | 用可审阅试点方案降低关键供应商替换风险，不直接执行迁移。 | C4 D1 H0 R3 K2 S2 | pdf,document,rag | CTX-16+USER | F2/B-LEG |",
  "WRT-047": "| WRT-047 | M | 维护公司知识库的运营团队 | 知识库里同一流程有好几版。能先给我看合并预览吗？我确认目标页面、替代关系和回退点后再更新，有冲突时再请内容负责人决定，可以吗？ | 在写前确认和可回退前提下更新知识内容，保留版本演进并不替代权威判断。 | C4 D1 H0 R3 K2 S2 | document,database,rag | CTX-06+LIVE | F2/B-AUTH |",
  "WRT-048": "| WRT-048 | M | 需要可检索访谈库的研究团队 | 把录音转写、说话人、主题和原始时间点整理好，敏感段落限制访问。 | 建立有来源和隐私边界的质性资料库。 | C3 D1 H0 R2 K2 S2 | transcription,database,rag | USER | F3/B-PRIV |",
  "WRT-057": "| WRT-057 | L | 计划写专业书的作者 | 用几个月把我的课程、文章和访谈整理成书，但每章观点要逐节由我确认。 | 将多年知识沉淀为长篇作品并保留作者控制。 | C4 D1 H3 R4 K2 S1 | transcription,document,rag | LIVE | F3/B-AUTH |",
  "SAL-008": "| SAL-008 | H | 管理销售下一步的负责人 | 先给我一份待确认清单：哪些机会没有明确下一步、日期或客户 owner？ | 减少虚假 pipeline 和停滞机会。 | C2 D0 H0 R2 K2 S2 | tasks,document | LIVE | F2/B-PRIV |",
  "SAL-032": "| SAL-032 | H | 销售运营负责人 | 每周检查阶段停滞、缺下一步、close date 反复后移和单线程机会。 | 提高 pipeline 卫生和预测可信度。 | C2 D4 H4 R4 K2 S2 | tasks,automation,crm | LIVE | F3/B-PRIV |",
  "OPS-046": "| OPS-046 | L | 并购整合运营团队 | 合并两套 CRM、合同、供应商和客户交付流程，重复实体逐项人工裁决。 | 降低并购运营整合的数据和承诺风险。 | C5 D3 H2 R3 K3 S2 | database,crm,pdf,rag | LIVE | F3/B-LEG |",
  "MKT-028": "| MKT-028 | M | 内容团队做旧文更新 | 每季度找流量高但事实过期的文章，先生成更新草稿和来源变更。 | 保持常青内容新鲜且可追溯。 | C2 D4 H4 R2 K2 S1 | document,rag,automation | LIVE | F3/B0 |",
  "MKT-044": "| MKT-044 | L | 跨国公司做长期品类教育 | 用一年内容、社区、研究和销售反馈建立品类，按季度校准叙事。 | 管理长期、跨触点的市场心智建设。 | C3 D4 H4 R2 K2 S0 | crm,rag,automation | LIVE | F3/B0 |"
};
const requiredToolExpectations = {
  "ENG-002": ["repo", "test"], "ENG-007": ["repo", "test", "ci"], "ENG-011": ["repo", "browser", "monitoring", "test"],
  "PRJ-001": ["memory", "document"], "PRJ-070": ["tasks", "spreadsheet", "document"],
  "WRT-003": ["transcription", "document"], "WRT-030": ["document"], "RES-010": ["browser", "rag", "document"],
  "RES-040": ["spreadsheet", "bi", "document"], "OPS-033": ["tasks", "notification"],
  "OPS-032": ["spreadsheet", "calendar", "document"], "LRN-021": ["calendar", "tasks"],
  "OPS-027": ["spreadsheet", "finance", "document"], "DAT-001": ["spreadsheet", "document"],
  "DAT-018": ["spreadsheet", "finance", "document"], "DAT-033": ["database", "bi", "document", "rag"],
  "LIF-006": ["calendar", "tasks", "notification", "document"], "LIF-010": ["maps", "browser", "calendar"],
  "LIF-014": ["pdf", "finance", "document"], "CAR-018": ["spreadsheet", "finance", "document"],
  "FAM-015": ["calendar", "tasks", "notification"], "SAL-036": ["transcription", "document"]
};
const finalRepairToolExpectations = {
  "ENG-032": ["repo", "test"], "ENG-043": ["repo", "test"],
  "ENG-055": ["repo", "document"], "ENG-113": ["repo", "test", "monitoring"],
  "ENG-030": ["browser", "repo", "test"], "ENG-062": ["repo", "database", "test"],
  "ENG-096": ["tasks", "automation", "ci", "notification"],
  "ENG-104": ["repo", "cloud", "monitoring", "document"],
  "ENG-109": ["repo", "test", "database", "api", "ci"],
  "PRJ-014": ["document", "git"], "PRJ-054": ["document"],
  "PRJ-061": ["calendar", "transcription", "document"],
  "PRJ-005": ["tasks", "issue-tracker"], "PRJ-006": ["document", "tasks"],
  "PRJ-015": ["document"], "PRJ-018": ["design", "browser"],
  "WRT-037": ["pdf", "browser", "rag", "document"],
  "WRT-046": ["browser", "email", "calendar", "crm", "messaging", "automation"],
  "WRT-047": ["document", "database", "rag"],
  "WRT-063": ["filesystem", "database", "ocr", "rag"],
  "WRT-066": ["document", "messaging", "automation", "notification", "monitoring"],
  "RES-036": ["database", "rag"], "RES-055": ["calendar", "messaging", "bi"],
  "OPS-012": ["pdf", "spreadsheet", "rag"],
  "OPS-030": ["browser", "spreadsheet", "finance", "rag"],
  "OPS-040": ["database", "monitoring", "rag"], "OPS-051": ["tasks", "automation", "notification"],
  "MKT-027": ["transcription", "rag", "bi", "issue-tracker"],
  "DAT-017": ["repo", "test", "database", "bi", "monitoring"],
  "DAT-025": ["spreadsheet", "bi"], "DAT-026": ["database", "rag", "document"],
  "MKT-011": ["messaging", "rag"], "MKT-033": ["email", "messaging", "notification", "mobile"],
  "MKT-041": ["rag"],
  "LIF-007": ["browser", "pdf", "spreadsheet", "calendar", "maps", "finance", "document"],
  "CAR-004": ["pdf", "spreadsheet", "finance", "maps"],
  "FAM-004": ["browser", "spreadsheet", "email", "calendar", "rag", "finance"],
  "FAM-018": ["test", "browser", "document"]
};
const requiredContextExpectations = {
  "PRJ-001": ["CTX-01"],
  "DAT-005": ["CTX-01", "LIVE"], "WRT-023": ["CTX-07", "LIVE"], "OPS-024": ["CTX-06", "LIVE"],
  "RES-020": ["CTX-09", "LIVE"], "WRT-030": ["CTX-04", "USER"], "DAT-006": ["CTX-15", "LIVE"],
  "CAR-002": ["CTX-11", "USER"], "CAR-006": ["CTX-11", "USER"], "MKT-007": ["CTX-08", "USER"],
  "MKT-014": ["CTX-08", "LIVE"], "CAR-016": ["CTX-04", "USER"],
  "LIF-014": ["USER", "LIVE"], "CAR-018": ["USER", "LIVE"], "LRN-021": ["USER"]
};
const finalRepairContextExpectations = {
  "ENG-032": ["USER", "LIVE"], "ENG-043": ["USER", "LIVE"], "ENG-055": ["USER", "LIVE"],
  "PRJ-054": ["CTX-03", "USER"], "WRT-037": ["USER", "LIVE"],
  "OPS-019": ["CTX-07", "LIVE"], "LRN-008": ["CTX-10", "USER"],
  "LIF-020": ["USER", "LIVE"], "CAR-004": ["USER", "LIVE"],
  "CAR-005": ["CTX-11", "USER"], "CAR-008": ["USER", "LIVE"]
};
const v3NaturalQuestionIdsByDemand = {
  M: [
    "ENG-013", "ENG-032", "ENG-041", "ENG-048", "ENG-052", "ENG-058", "ENG-065", "ENG-104",
    "PRJ-030", "PRJ-041", "PRJ-042", "PRJ-047", "PRJ-050", "PRJ-070",
    "WRT-009", "WRT-018", "WRT-027", "WRT-032", "WRT-038", "WRT-039", "WRT-047", "WRT-063",
    "RES-016", "RES-027", "RES-036", "OPS-019", "OPS-040", "OPS-042",
    "SAL-014", "MKT-011", "LRN-008", "LIF-008", "CAR-013", "FAM-008"
  ],
  L: [
    "ENG-078", "ENG-113", "ENG-119", "PRJ-054", "PRJ-061", "PRJ-066",
    "WRT-054", "WRT-066", "WRT-068", "WRT-069", "RES-050", "OPS-039",
    "OPS-051", "DAT-017", "DAT-034", "LRN-024", "MKT-041"
  ]
};
const simpleRareRationales = {
  "ENG-078": "只产出签名、notarization 与更新门的人工检查清单，不执行签名或发布",
  "WRT-068": "只把既有贡献记录整理成讨论材料，作者顺序明确留给团队",
  "DAT-034": "只产出开放数据发布前的固定检查清单，不执行发布或专业裁决"
};
const simpleRareIds = new Set(Object.keys(simpleRareRationales));
const requiredClaimExpectations = {
  "CTX-06/PRJ-019": {
    claim: "现行 SOP 规定新增范围必须形成 change request，销售口头同意不构成批准；客户原话与原合同正文不在 fixture 内",
    sources: "service-sop.md",
    supplemental: "USER 提供客户原话与原合同正文"
  },
  "CTX-01/RES-006": {
    claim: "已批准范围不含自动邮件，三位受访者也都未提出自动邮件；团队转述只能作为待验证假设",
    sources: "product-brief.md + feedback-notes.md",
    supplemental: "LIVE 读取当前产品、用户工作流与替代方案证据"
  },
  "CTX-03/MKT-011": {
    claim: "获批目标客户与首发范围、销售提出的候选卖点、待验证成功标准、未获批准的群发主张和不能承诺的能力",
    sources: "launch-brief.md + stakeholder-notes.md",
    supplemental: "-"
  },
  "CTX-03/PRJ-054": {
    claim: "产品、工程、销售、客服和法务对发布的偏好、约束与待拍板事项；正式 RACI 和授权范围不在 fixture 内",
    sources: "launch-brief.md + stakeholder-notes.md",
    supplemental: "USER 提供正式 RACI、授权政策和例外升级规则"
  },
  "CTX-07/OPS-019": {
    claim: "六类安全问题、未决答复和销售不得代填的责任边界，只作为字段与责任模板；三份真实供应商问卷来自现场系统",
    sources: "security-questions.md",
    supplemental: "LIVE 读取三份真实供应商安全问卷、当前 owner 与答复时限"
  },
  "CTX-07/SAL-007": {
    claim: "客户关于六个月实施不可接受的原话、网络与例外流程顾虑及未确认预算",
    sources: "discovery-call.md",
    supplemental: "-"
  },
  "CTX-10/LRN-002": {
    claim: "错题摘要记录学习者混淆 exactly-once 与幂等写入；原题、本人作答和可核验答案不在 fixture 内",
    sources: "mistake-log.md",
    supplemental: "USER 提供原题、本人作答和可核验答案；仅保存完成复盘所需的最小摘要"
  },
  "CTX-10/LRN-003": {
    claim: "两次模考得分、五类错题摘要和十分钟口头复盘偏好；逐题原文、本人作答和可核验答案不在 fixture 内",
    sources: "mistake-log.md + time-constraints.md",
    supplemental: "USER 提供原题、本人作答和可核验答案；仅保存完成复盘所需的最小摘要"
  },
  "CTX-10/LRN-008": {
    claim: "考试领域、权重与仍易错主题；真正掌握的主题必须由用户另行确认",
    sources: "exam-outline.md + mistake-log.md",
    supplemental: "USER 提供已确认掌握且可公开的主题"
  },
  "CTX-11/CAR-005": {
    claim: "候选人技术背景、A/B/C 岗位差异和可用于求职信的可证实经历；本轮目标岗位由用户当下提供",
    sources: "resume-draft.md + job-requirements.md + accomplishment-bank.md",
    supplemental: "USER 提供已选定的当下目标岗位"
  },
  "CTX-11/CAR-006": {
    claim: "可证实成果和团队协作边界；待改作品集正文必须由用户提供",
    sources: "accomplishment-bank.md",
    supplemental: "USER 提供待改作品集正文和个人贡献证据"
  },
  "CTX-13/OPS-048": {
    claim: "复诊材料要求、预约取消双重确认、医疗信息最小共享与专业决定边界；当前预约、渠道状态和患者本次授权不在 fixture 内",
    sources: "clinic-instructions.md + care-calendar.md + coordination-rules.md",
    supplemental: "USER 提供患者或事项 owner 的明确授权、收件人和可共享字段边界；LIVE 读取当前预约与渠道状态"
  },
  "CTX-13/LIF-019": {
    claim: "机构要求按日期与时段整理血压，家属记录含待核头晕与用药冲突，医疗材料须受限共享；每周当前记录不在 fixture 内",
    sources: "clinic-instructions.md + care-notes.md + coordination-rules.md",
    supplemental: "LIVE 读取当前血压、症状与生活记录；只保留连续记录所需的最小字段"
  },
  "CTX-13/FAM-017": {
    claim: "复诊与生活支持节点、待专业核对的冲突清单、家庭协作和最小共享边界；一年期当前记录不在 fixture 内",
    sources: "clinic-instructions.md + care-notes.md + care-calendar.md + coordination-rules.md",
    supplemental: "LIVE 读取一年期照护进展、症状、支持安排和费用现势"
  },
  "CTX-16/SAL-014": {
    claim: "三年总拥有成本透明要求、安全必须项硬门、迁移抽样验收与三家厂商冻结自报差异",
    sources: "rfp-summary.md + evaluation-rules.md + vendor-responses.md",
    supplemental: "LIVE 刷新价格与产品状态，并补齐三年 TCO、迁移实测和审批现势"
  },
  "CTX-14/FAM-008": {
    claim: "各技能的基线时段和两位志愿者已确认的时间变更；当前报名与最低覆盖阈值由现场系统补充",
    sources: "volunteer-roster.md + venue-feedback.md",
    supplemental: "LIVE 读取当前确认报名和最新排班状态"
  },
  "CTX-14/FAM-014": {
    claim: "活动目标与安全边界、场地方带日期的退回意见，以及两名志愿者已确认的时间变更",
    sources: "event-brief.md + venue-feedback.md",
    supplemental: "LIVE 读取活动当前报名、排班与整改落地状态"
  },
  "CTX-14/OPS-051": {
    claim: "120 人活动范围、场地安全规则和场地方要求整改的具体意见；活动当日人流、设备与安全事件来自现场系统",
    sources: "event-brief.md + venue-rules.md + venue-feedback.md",
    supplemental: "LIVE 读取活动当日人流、设备、安全事件与分派状态"
  },
  "CTX-15/DAT-017": {
    claim: "fixture 只含指标合同、既有血缘和日期异常；用户手工表、字段映射、目标表、回填窗口与写权限均不在 fixture 内",
    sources: "metric-contracts.md + lineage-notes.md + anomaly-report.md",
    supplemental: "USER 提供手工表正文、字段含义和允许迁移范围；LIVE 读取目标表、回填窗口、写权限与 staging 状态"
  },
  "CTX-11/CAR-010": {
    claim: "岗位共性与候选人可证实经历可判断作品方向；原十二周计划、前四周进度和当前资源不在 fixture 内",
    sources: "resume-draft.md + job-requirements.md + accomplishment-bank.md",
    supplemental: "USER 提供原十二周计划和前四周真实进度；LIVE 读取当前可用时间、任务资源和目标岗位要求"
  },
  "CTX-16/RES-002": {
    claim: "三家厂商回复均为 2026-08-24 冻结自报，必须项和评分规则可用；真实流程实测结果不在 fixture 内",
    sources: "rfp-summary.md + evaluation-rules.md + vendor-responses.md",
    supplemental: "LIVE 读取厂商当前能力、价格、独立来源和三条真实流程实测结果"
  }
};
const finalV7RequiredClaimExpectations = {
  "CTX-03/PRJ-047": {
    claim: "首发面向财务、采购和 IT 管理员，试点成功门为两周内 80% 建立新流程；10 月 8 日文档培训、试点二缺客户及迁移仅测 50 租户均是采用风险",
    sources: "launch-brief.md + milestones.md + stakeholder-notes.md",
    supplemental: "-"
  },
  "CTX-05/PRJ-057": {
    claim: "调研简报列出目标市场问题、能力现状和不替用户选国的边界，可支撑逐轮战略访谈",
    sources: "research-brief.md + interview-notes.md + official-and-market-snapshot.md + source-register.md",
    supplemental: "USER 提供内部能力缺口、非公开约束和不做项；LIVE 通过 browser 刷新目标市场、竞品与来源日期"
  },
  "CTX-05/RES-016": {
    claim: "访谈线索、冻结事实和来源状态按权威层级分开；昨天新增两份反证不在 fixture 内",
    sources: "research-brief.md + interview-notes.md + official-and-market-snapshot.md + source-register.md",
    supplemental: "USER 提供昨天新增的两份反证、来源日期和当前选项变化"
  },
  "CTX-06/LRN-015": {
    claim: "SOP 明列六步交付流程、上线前须由另一位顾问做数据抽检及新增范围须走 change request；样本含 4% 客户编码前导零丢失",
    sources: "service-sop.md + ticket-sample.md",
    supplemental: "-"
  },
  "CTX-06/OPS-024": {
    claim: "样本项目分别出现字段映射表等待、未开 change request 的 12 小时返工、上线抽检 4% 编码丢失和验收邮件未关联导致尾款晚开九天",
    sources: "service-sop.md + ticket-sample.md",
    supplemental: "LIVE 通过 crm/tasks/monitoring 读取同一客户当前等待、审批和风险事件"
  },
  "CTX-06/WRT-011": {
    claim: "现行 SOP 有六步入口、抽检、书面验收和 change request 规则，样本列出四类常见误区",
    sources: "service-sop.md + weekly-metrics.md + ticket-sample.md",
    supplemental: "USER 提供当前口头交接、例外和升级实践的录音或口述材料"
  },
  "CTX-07/LRN-006": {
    claim: "账户资料记录采购流程目标、关键角色、审计关注、例外流程和离线要求尚未确认",
    sources: "account-brief.md + discovery-call.md",
    supplemental: "USER 提供下周客户会的日期、练习目标和本人当前表达"
  },
  "CTX-07/WRT-023": {
    claim: "客户要求书面回答的六项安全问题，以及第 4、5 项当前只有草案的明确缺口",
    sources: "security-questions.md",
    supplemental: "USER 提供当前获批产品安全答案、不支持项、版本和批准状态"
  },
  "CTX-08/MKT-013": {
    claim: "品牌允许的价值主张、禁止承诺和已授权素材范围明确，案例授权不含付费广告",
    sources: "brand-guide.md + funnel-metrics.md + asset-inventory.md",
    supplemental: "USER 提供当前获批素材、渠道授权和广告草稿状态"
  },
  "CTX-08/MKT-029": {
    claim: "28 天漏斗从 8,420 个注册降至 1,080 个七日可分享进度页，品牌禁止保证收入与虚假紧迫，现有案例未获付费广告授权",
    sources: "brand-guide.md + funnel-metrics.md + asset-inventory.md",
    supplemental: "LIVE 读取固定预算、当前渠道成本和实验容量"
  },
  "CTX-10/LRN-003": {
    claim: "两次模考得分为 62% 与 68%，错题涵盖幂等、存储、灾备、权限和监控；通勤有 25 分钟且适合口头复盘与错题回放",
    sources: "mistake-log.md + time-constraints.md",
    supplemental: "USER 提供逐题原文、本人作答和可核验答案；十分钟是本次题面限制，不是 fixture 事实"
  },
  "CTX-10/LRN-028": {
    claim: "考试权重、错题与时间偏好可作计划基线；每日表现和重大目标授权不在 fixture 内",
    sources: "exam-outline.md + mistake-log.md + time-constraints.md",
    supplemental: "USER 确认重大目标、可调整范围和提醒边界；LIVE 通过 tasks/forms 读取每日表现、计划与提醒状态"
  },
  "CTX-11/CAR-011": {
    claim: "岗位要求、简历现状和可证实成果可构成个人证据；当前市场薪酬与谈判优先项不在 fixture 内",
    sources: "resume-draft.md + job-requirements.md + accomplishment-bank.md",
    supplemental: "USER 提供优先项、不可让步项和可让步项；LIVE 通过 browser 获取带日期的市场薪酬区间"
  },
  "CTX-11/CAR-012": {
    claim: "经历库含可量化结果、协作、指导与失败反思，可用于绩效举证但当前周期材料不在 fixture 内",
    sources: "resume-draft.md + job-requirements.md + accomplishment-bank.md",
    supplemental: "USER 提供本周期绩效结果、合作证据和反馈材料；仅使用本次回顾所需内容"
  },
  "CTX-13/LIF-005": {
    claim: "家属记录包含头晕时间缺口和两张冲突用药清单，机构要求由专业人员核对而非自行判断",
    sources: "clinic-instructions.md + care-notes.md + care-calendar.md + coordination-rules.md",
    supplemental: "USER 提供最近症状和两张冲突清单；LIVE 通过 calendar 读取当前复诊安排"
  }
};
const finalV8RequiredClaimExpectations = {
  "CTX-03/PRJ-047": {
    claim: "来源事实：首发面向财务、采购和 IT 管理员，试点成功门为两周内 80% 建立新流程；10 月 8 日安排文档与客服培训，试点二尚缺客户，迁移仅在 50 租户测试环境中验证。是否构成采用风险属于后续分析，不是来源原文结论",
    sources: "launch-brief.md + milestones.md + stakeholder-notes.md",
    supplemental: "-"
  }
};
const finalV8SupplementalExpectations = {
  "ENG-091": "LIVE 通过 monitoring 读取当前消费者遥测，通过 crm 读取大客户依赖，并用 repo/api 核对下线实现",
  "PRJ-004": "USER 提供刚结束会议的录音、转写或消息记录；LIVE 通过 transcription/tasks 读取会议内容与当前行动项",
  "PRJ-025": "LIVE 通过 crm/messaging 读取本轮客户承诺与聊天记录，通过 tasks 读取履约状态",
  "MKT-022": "LIVE 通过 repo/test 读取产品门，通过 crm 读取试点，通过 tasks/issue-tracker 读取培训与客服就绪状态",
  "OPS-044": "LIVE 通过 crm 读取销售事件，通过 tasks/issue-tracker 读取交付与客服事件，通过 finance 读取财务事件",
  "OPS-051": "LIVE 通过 monitoring/database/forms 读取人流、设备与安全事件，通过 tasks 读取分派状态",
  "SAL-002": "USER 提供刚结束电话的录音或转写；LIVE 通过 transcription/crm 读取客户目标与未决问题，通过 email/tasks 读取收件人、日期和下一步",
  "SAL-014": "LIVE 通过 browser 刷新厂商产品状态，通过 test 读取迁移实测，通过 tasks 读取审批状态，通过 spreadsheet/finance 读取价格和三年 TCO",
  "MKT-003": "LIVE 通过 email/calendar 读取发送配置与频控，通过 bi 读取七日行为数据",
  "LRN-009": "USER 确认当前错题范围与提醒偏好；LIVE 通过 forms 读取错题进展，通过 calendar 读取未来两周时段，并由 automation/notification 执行到时提醒",
  "LIF-008": "USER 提供现有报价和电梯、网络预约回执；LIVE 通过 browser 读取替代搬家公司，通过 calendar/tasks/maps 读取预约、关键路径和路程状态"
};
const finalV8RequiredClaimDigests = {
  "CTX-01": "c0baa52dd410b956cc4476f3ce818842e51825e348114c3bf210a53a94eb6d6d",
  "CTX-02": "028d13bc43ab4fdae55be7496f1b4b017817c014b8b43f78b78ed3ac75ac820a",
  "CTX-03": "2c2770be128f7c6d54e05d9f233cf8be16921fd93901c52e2925100d78f08090",
  "CTX-04": "a2d40eb43152139a62887ff582e52ea1b70a821c5834f7a11e4a501d600123c9",
  "CTX-05": "e15121da3b14897aa75716febb3c0077c5298a2afc6b1b7a1acbf4a372f95d3d",
  "CTX-06": "7907cbd4ccdd3a93b9238a0bb55abaa8465fb0c4938301f990823a53361dd503",
  "CTX-07": "a512366d971e1cd4bc55b5423b9c7c4927ccea91d1bd758712a22f8bf3716ed0",
  "CTX-08": "37cf2b6aa2a9b3815427b6faa23c5dcc044a33c3ea0bdfdfb30ac94ad1e55e00",
  "CTX-09": "42205f9373c510563e64c2cee761468de8e80efb9fd4d66cf797ab9cf56bb4b0",
  "CTX-10": "4dc6fd8f9bd8c7bd8d4af509e25ab9a74479c79f5477523ffddec96365dd860c",
  "CTX-11": "13977946e353877642a1f5018ddf5f5602edb0a124d7873a99f805e6a4f3a15f",
  "CTX-12": "e5d16ffa06f743c4792230f26407703e90f0605040b5232b46f5ef72b2cbf409",
  "CTX-13": "c741719cb362312c372b0684be35c2f965bdfc1b8f53231d17d02f9e1062d62e",
  "CTX-14": "53611518804a4d77593327262d7439cc434a28e19c1e2558b1eaacae5c78803d",
  "CTX-15": "f4b2ab45f0ba60e341c3d6dac6edc6c4a815e9380f3beb5eb5a892fdb02b4e0a",
  "CTX-16": "2af5e0424abd8bfaac8a2f275175d9e1c773f06178149f7589eab2b88b225c6c"
};
const requiredContextSourceSets = {
  "CTX-14": ["event-brief.md", "venue-feedback.md", "venue-rules.md", "volunteer-roster.md"]
};
const validationDate = process.env.CORPUS_VALIDATION_DATE ?? new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const lifecycleIds = new Set([
  "ENG-053", "PRJ-011", "PRJ-025", "DAT-016", "OPS-025", "LIF-013",
  "ENG-091", "PRJ-053", "WRT-004", "RES-016", "SAL-012", "SAL-030", "MKT-025", "FAM-010",
  "ENG-019", "RES-046", "OPS-036", "MKT-007", "DAT-006", "LIF-023", "CAR-014", "FAM-014",
  "ENG-054", "PRJ-031", "LRN-023", "CAR-010", "LIF-008", "WRT-032", "WRT-067", "DAT-030", "LIF-022", "FAM-004"
]);

const errors = [];
const records = [];
const counts = {
  demandPrior: {}, C: {}, D: {}, H: {}, R: {}, K: {}, S: {}, F: {}, B: {},
  tools: {}, contextModes: {}, contextUsage: {}, toolCounts: {},
  cross: { C: {}, D: {}, H: {}, R: {}, K: {}, S: {}, F: {} }
};
const bump = (map, key) => { map[key] = (map[key] ?? 0) + 1; };
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const bumpCross = (group, prior, key) => {
  counts.cross[group][prior] ??= {};
  bump(counts.cross[group][prior], key);
};

const actualQuestionFiles = readdirSync(questionDir).filter((name) => name.endsWith(".md")).sort();
for (const filename of actualQuestionFiles) if (!expectedQuestionFiles.has(filename)) errors.push(`存在未登记问题文件:${filename}`);
for (const filename of expectedQuestionFiles) if (!actualQuestionFiles.includes(filename)) errors.push(`缺少问题文件:${filename}`);

for (const [prefix, config] of Object.entries(expected)) {
  const filename = config.file;
  let lines;
  try {
    lines = readFileSync(join(questionDir, filename), "utf8").split(/\r?\n/u);
  } catch {
    continue;
  }
  let sectionPrior = null;
  for (const [index, line] of lines.entries()) {
    const sectionMatch = line.match(/^## (?:高频|中频|长尾) ([HML])（\d+ 条）$/u);
    if (sectionMatch) {
      sectionPrior = sectionMatch[1];
      continue;
    }
    if (!line.startsWith("|")) continue;
    if (/^\| ID \|/u.test(line) || /^\|---\|/u.test(line)) continue;

    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 9) {
      errors.push(`${filename}:${index + 1} 表格候选行字段数=${cells.length}，应为 9`);
      continue;
    }
    const [id, demandPrior, situation, question, purpose, tier, toolText, contextText, fitText] = cells;
    if (!/^[A-Z]{3}-\d{3}$/u.test(id)) {
      errors.push(`${filename}:${index + 1} 非法 ID:${id}`);
      continue;
    }
    const rowPrefix = id.slice(0, 3);
    if (rowPrefix !== prefix) errors.push(`${id} 位于 ${filename}，前缀应为 ${prefix}`);
    if (!/^[HML]$/u.test(demandPrior)) errors.push(`${id} 需求频率档非法:${demandPrior}`);
    if (sectionPrior !== demandPrior) errors.push(`${id} 位于 ${sectionPrior ?? "未识别"} 章节但标为 ${demandPrior}`);
    if (situation.length < 6 || question.length < 8 || purpose.length < 6) errors.push(`${id} 文本过短`);
    if (/[\r\n|]/u.test(`${situation}${question}${purpose}`)) errors.push(`${id} 文本含非法分隔符`);
    if (/待补|TODO|TBD|占位|做一下/u.test(`${situation}${question}${purpose}`)) errors.push(`${id} 含占位或空泛文本`);
    if (/游戏|追剧|放歌|明星八卦|娱乐消遣|陪玩/u.test(question)) errors.push(`${id} 命中娱乐主题`);

    const tierMatch = tier.match(/^(C[1-5]) (D[0-4]) (H[0-4]) (R[1-4]) (K[0-4]) (S[0-3])$/u);
    if (!tierMatch) errors.push(`${id} 档位格式非法:${tier}`);
    const fitMatch = fitText.match(/^(F[1-4])\/(B0|B-(?:MED|LEG|FIN|PRIV|ID|ATTR|AUTH))$/u);
    if (!fitMatch || !allowedBoundaries.has(fitMatch?.[2])) errors.push(`${id} 能力/边界格式非法:${fitText}`);

    const tools = toolText === "-" ? [] : toolText.split(",").map((tool) => tool.trim()).filter(Boolean);
    if (new Set(tools).size !== tools.length) errors.push(`${id} 工具重复:${toolText}`);
    for (const tool of tools) {
      if (!allowedTools.has(tool)) errors.push(`${id} 工具未登记:${tool}`);
      bump(counts.tools, tool);
    }
    bump(counts.toolCounts, String(tools.length));

    if (tierMatch) {
      const [, c, d, horizon, rounds, toolDepth, risk] = tierMatch;
      const depth = Number(toolDepth.slice(1));
      const validToolCount = depth === 0 ? tools.length === 0
        : depth === 1 ? tools.length === 1
          : depth === 2 ? tools.length >= 2 && tools.length <= 3
            : depth === 3 ? tools.length >= 4 && tools.length <= 5
              : tools.length >= 6;
      if (!validToolCount) errors.push(`${id} 工具数 ${tools.length} 与 ${toolDepth} 不符`);
      for (const value of [c, d, horizon, rounds, toolDepth, risk]) {
        bump(counts[value[0]], value);
        bumpCross(value[0], demandPrior, value);
      }
      if (fitMatch) bumpCross("F", demandPrior, fitMatch[1]);
    }

    const contextTokens = contextText === "-" ? [] : contextText.split("+").map((token) => token.trim()).filter(Boolean);
    if (new Set(contextTokens).size !== contextTokens.length) errors.push(`${id} 上下文模式重复:${contextText}`);
    for (const token of contextTokens) {
      if (!/^CTX-\d{2}$/u.test(token) && token !== "USER" && token !== "LIVE") errors.push(`${id} 上下文模式非法:${token}`);
      if (/^CTX-/u.test(token)) bump(counts.contextUsage, token);
      else bump(counts.contextModes, token);
    }
    if (contextTokens.length === 0) bump(counts.contextModes, "-");

    if (fitMatch) {
      const [fit, boundary] = fitMatch.slice(1);
      bump(counts.F, fit);
      bump(counts.B, boundary);
      const allowedF1ConditionalTools = f1ConditionalToolExceptions[id] ?? new Set();
      const unsupportedF1ConditionalTools = tools.filter((tool) => conditionalTools.has(tool) && !allowedF1ConditionalTools.has(tool));
      if (fit === "F1" && unsupportedF1ConditionalTools.length > 0) errors.push(`${id} F1 含条件 connector 工具:${unsupportedF1ConditionalTools.join(",")}`);
      if (fit === "F1" && !f1CapabilityIds.has(id)) errors.push(`${id} 不在缺省 coding/workspace F1 能力基线`);
      if (fit === "F1" && /勒索|灾备|备份可信度|区域拓扑|生产切换|供应商环境/u.test(`${question} ${purpose}`)) {
        errors.push(`${id} 系统级环境或恢复任务不得标 F1`);
      }
      if (fit === "F4" && !f4Ids.has(id)) errors.push(`${id} 非登记越权题却标 F4`);
      if (f4Ids.has(id) && fit !== "F4") errors.push(`${id} 登记越权题未标 F4`);
      if (f4Ids.has(id) && tierMatch?.[6] !== "S3") errors.push(`${id} 登记越权题未标 S3`);
      if (f4Ids.has(id) && tierMatch?.[2] !== "D0") errors.push(`${id} 越权请求的首个安全可审阅响应应为 D0`);
    }

    bump(counts.demandPrior, demandPrior);
    records.push({
      id, prefix: rowPrefix, demandPrior, situation, question, purpose, tier, tools, contextTokens, fitText,
      c: tierMatch?.[1], d: tierMatch?.[2], horizon: tierMatch?.[3], rounds: tierMatch?.[4],
      toolDepth: tierMatch?.[5], risk: tierMatch?.[6], fit: fitMatch?.[1], boundary: fitMatch?.[2],
      filename, line: index + 1
    });
  }
}

const liveContracts = [];
for (const filename of readdirSync(liveContractSourceDir).filter((name) => name.endsWith(".json")).sort()) {
  try {
    const registry = JSON.parse(readFileSync(join(liveContractSourceDir, filename), "utf8"));
    if (registry.schema_version !== 1 || !Array.isArray(registry.contracts)) errors.push(`${filename} LIVE 合同源格式错误`);
    else liveContracts.push(...registry.contracts);
  } catch (error) {
    errors.push(`${filename} LIVE 合同源无法解析:${error.message}`);
  }
}
let capabilityRegistry = { active_contracts: [], reviewed_demotions: [] };
try {
  capabilityRegistry = JSON.parse(readFileSync(capabilityContractSource, "utf8"));
  if (capabilityRegistry.schema_version !== 1 || !Array.isArray(capabilityRegistry.active_contracts)) {
    errors.push("F1 能力合同源格式错误");
    capabilityRegistry = { active_contracts: [], reviewed_demotions: [] };
  }
} catch (error) {
  errors.push(`F1 能力合同源无法解析:${error.message}`);
}

const recordById = new Map(records.map((record) => [record.id, record]));
const liveRecordIds = records.filter((record) => record.contextTokens.includes("LIVE")).map((record) => record.id).sort();
const liveContractIds = liveContracts.map((contract) => contract.id).sort();
const missingLiveContractIds = liveRecordIds.filter((id) => !liveContractIds.includes(id));
const extraLiveContractIds = liveContractIds.filter((id) => !liveRecordIds.includes(id));
const liveContractAudit = {
  missingContracts: missingLiveContractIds.length,
  extraContracts: extraLiveContractIds.length,
  genericSources: liveContracts.flatMap((contract) => contract.sources ?? [])
    .filter((source) => /generic|fallback|当前系统|任意来源/iu.test(`${source.source_kind ?? ""} ${source.locator ?? ""}`)).length,
  emptyLocators: liveContracts.flatMap((contract) => contract.sources ?? [])
    .filter((source) => typeof source.locator !== "string" || source.locator.trim() === "").length,
  missingContractOrSourceFields: liveContracts.filter((contract) => [
    contract.id, contract.question_sha256, contract.object_selector, contract.execution_mode,
    contract.user_locator, contract.fixture_supplemental
  ].some((value) => typeof value !== "string") || !Array.isArray(contract.input_modes) || !Array.isArray(contract.sources)).length
    + liveContracts.flatMap((contract) => contract.sources ?? []).filter((source) =>
      ["source_kind", "locator", "locator_provider", "authority", "freshness", "as_of", "principal_scope"]
        .some((field) => typeof source[field] !== "string" || source[field].length < 4)
      || !Array.isArray(source.required_fields) || source.required_fields.length < 4
      || !Array.isArray(source.reader_tools) || source.reader_tools.length !== 1).length,
  readerMismatches: liveContracts.flatMap((contract) => (contract.sources ?? []).map((source) => ({ contract, source })))
    .filter(({ contract, source }) => {
      const [reader] = Array.isArray(source.reader_tools) ? source.reader_tools : [];
      const expectedReader = sourceKindReaderMatrix[source.source_kind];
      const record = recordById.get(contract.id);
      return !expectedReader || reader !== expectedReader || !record?.tools.includes(reader)
        || !contractReaderTools.has(reader) || ["rag", "document", "automation", "notification"].includes(reader);
    }).length
};
let ctxLiveSupplementalMismatchCount = 0;
if (new Set(liveContractIds).size !== liveContractIds.length) errors.push("LIVE 合同源存在重复 ID");
if (liveContractIds.join(",") !== liveRecordIds.join(",")) errors.push("LIVE 题目与逐对象合同源集合不全等");
if (liveContracts.length !== 465) errors.push(`LIVE 合同源=${liveContracts.length}，应为 465`);
const liveContractById = new Map(liveContracts.map((contract) => [contract.id, contract]));
const contractSupplementalById = new Map();
const liveLocators = new Set();
let liveObjectSourceCount = 0;
for (const contract of liveContracts) {
  const record = recordById.get(contract.id);
  if (!record) continue;
  if (contract.question_sha256 !== sha256(record.question)) errors.push(`${contract.id} LIVE 合同题面摘要漂移`);
  if (contract.object_selector !== record.question) errors.push(`${contract.id} LIVE 合同对象选择器漂移`);
  const expectedExecutionMode = record.fit === "F4" ? "REFUSE_OR_RESCOPE_D0" : "READ_ONLY_OR_REVIEWED_EFFECT";
  if (contract.execution_mode !== expectedExecutionMode) errors.push(`${contract.id} LIVE 合同执行模式漂移`);
  if (!Array.isArray(contract.input_modes) || contract.input_modes.join("+") !== record.contextTokens.join("+")) {
    errors.push(`${contract.id} LIVE 合同输入模式漂移`);
  }
  const needsUserLocator = record.contextTokens.includes("USER");
  if (needsUserLocator !== (contract.user_locator !== "-")) errors.push(`${contract.id} USER locator 与题面不对称`);
  if (needsUserLocator && !new RegExp(`^user-input://${contract.id}/`, "u").test(contract.user_locator)) {
    errors.push(`${contract.id} USER locator 不具体`);
  }
  contractSupplementalById.set(contract.id, contract.fixture_supplemental);
  if (!Array.isArray(contract.sources) || contract.sources.length === 0) {
    errors.push(`${contract.id} LIVE 合同没有对象来源`);
    continue;
  }
  liveObjectSourceCount += contract.sources.length;
  const registeredReaders = new Set();
  for (const source of contract.sources) {
    for (const field of ["source_kind", "locator", "locator_provider", "authority", "freshness", "as_of", "principal_scope"]) {
      if (typeof source[field] !== "string" || source[field].length < 4) errors.push(`${contract.id} LIVE 对象来源缺字段:${field}`);
    }
    if (/generic|fallback|当前系统|任意来源/iu.test(`${source.source_kind} ${source.locator}`)) {
      errors.push(`${contract.id} LIVE 对象来源命中 generic fallback`);
    }
    if (liveLocators.has(source.locator)) errors.push(`${contract.id} LIVE locator 重复:${source.locator}`);
    liveLocators.add(source.locator);
    if (source.locator_provider === "WORKSPACE" && !/^workspace\+[a-z-]+:\/\/authorized-project-root\//u.test(source.locator)) {
      errors.push(`${contract.id} WORKSPACE locator 形状错误:${source.locator}`);
    }
    if (source.locator_provider === "USER" && !/^connector\+[a-z-]+:\/\/USER-PROVIDED\//u.test(source.locator)) {
      errors.push(`${contract.id} USER connector locator 形状错误:${source.locator}`);
    }
    if (!["WORKSPACE", "USER"].includes(source.locator_provider)) errors.push(`${contract.id} locator_provider 非法`);
    if (!Array.isArray(source.required_fields) || source.required_fields.length < 4 || new Set(source.required_fields).size !== source.required_fields.length) {
      errors.push(`${contract.id} LIVE 对象字段不完整或重复:${source.source_kind}`);
    }
    if (!Array.isArray(source.reader_tools) || source.reader_tools.length !== 1) {
      errors.push(`${contract.id} LIVE 对象必须绑定一个明确 reader:${source.source_kind}`);
      continue;
    }
    const [reader] = source.reader_tools;
    const expectedReader = sourceKindReaderMatrix[source.source_kind];
    if (!expectedReader) errors.push(`${contract.id} LIVE source_kind 未登记:${source.source_kind}`);
    else if (reader !== expectedReader) errors.push(`${contract.id} LIVE reader 与对象类别错配:${source.source_kind}/${reader}`);
    if (!record.tools.includes(reader)) errors.push(`${contract.id} LIVE reader 不在题目工具中:${reader}`);
    if (!contractReaderTools.has(reader)) errors.push(`${contract.id} 使用非 reader 工具登记 LIVE:${reader}`);
    if (["rag", "document", "automation", "notification"].includes(reader)) errors.push(`${contract.id} 宽泛或输出工具不得登记为 LIVE reader:${reader}`);
    registeredReaders.add(reader);
    if (!source.authority.includes("owner") && !/reviewer|主体/u.test(source.authority)) errors.push(`${contract.id} LIVE authority 缺授权主体`);
    if (!/只读/u.test(source.principal_scope) || !source.principal_scope.includes(contract.id)) errors.push(`${contract.id} LIVE principal_scope 不完整`);
    if (record.fit === "F4" && !/D0 安全响应不读取/u.test(source.principal_scope)) errors.push(`${contract.id} F4 LIVE 合同未禁止安全响应读取`);
    if (!/刷新|陈旧度/u.test(source.freshness) || !/request_time|source_updated_at/u.test(source.as_of)) errors.push(`${contract.id} LIVE 新鲜度或 as_of 不完整`);
  }
  const expectedReaders = record.tools.filter((tool) => contractReaderTools.has(tool)).sort();
  if ([...registeredReaders].sort().join(",") !== expectedReaders.join(",")) {
    errors.push(`${contract.id} LIVE 合同 reader 集合与题目工具不对称`);
  }
}

const f1RecordIds = records.filter((record) => record.fit === "F1").map((record) => record.id).sort();
const f1ContractIds = capabilityRegistry.active_contracts.map((contract) => contract.id).sort();
if (new Set(f1ContractIds).size !== f1ContractIds.length) errors.push("F1 能力合同存在重复 ID");
if (f1ContractIds.join(",") !== f1RecordIds.join(",")) errors.push("F1 题目与能力合同集合不全等");
if (capabilityRegistry.active_contracts.length !== 46) errors.push(`最终 F1 能力合同=${capabilityRegistry.active_contracts.length}，应为 46`);
const capabilityById = new Map(capabilityRegistry.active_contracts.map((contract) => [contract.id, contract]));
for (const contract of capabilityRegistry.active_contracts) {
  const record = recordById.get(contract.id);
  if (!record) continue;
  if (contract.status !== "F1" || contract.project_type !== "coding") errors.push(`${contract.id} F1 能力合同类型错误`);
  if (contract.question_sha256 !== sha256(record.question)) errors.push(`${contract.id} F1 合同题面摘要漂移`);
  if (!Array.isArray(contract.allowed_tools) || contract.allowed_tools.join(",") !== record.tools.join(",")) errors.push(`${contract.id} F1 合同工具漂移`);
  for (const field of ["capability_baseline", "workspace_locator", "effect_kind", "allowed_effect", "verification_method", "evidence", "denied_scope"]) {
    if (typeof contract[field] !== "string" || contract[field].length < 8) errors.push(`${contract.id} F1 合同缺字段:${field}`);
  }
  if (!contract.capability_baseline.includes("enabled_project_types=coding") || !contract.workspace_locator.startsWith("workspace://authorized-project-root/")) {
    errors.push(`${contract.id} F1 缺缺省 coding/workspace 显式基线`);
  }
  for (const tool of contract.allowed_tools.filter((tool) => ["api", "monitoring", "tasks"].includes(tool))) {
    if (contract.conditional_tool_scope?.[tool] !== "workspace-local object only") errors.push(`${contract.id} F1 条件工具未收窄到 workspace-local:${tool}`);
  }
  if (!/生产控制面/.test(contract.denied_scope) || !/外部 CRM/.test(contract.denied_scope)) errors.push(`${contract.id} F1 缺外部能力排除项`);
}
const demotionIds = (capabilityRegistry.reviewed_demotions ?? []).map((entry) => entry.id).sort();
if (demotionIds.join(",") !== "ENG-091,PRJ-025") errors.push("F1 复核降档登记不完整");
for (const entry of capabilityRegistry.reviewed_demotions ?? []) {
  if (entry.status !== "F2" || recordById.get(entry.id)?.fit !== "F2" || typeof entry.reason !== "string" || entry.reason.length < 12) {
    errors.push(`${entry.id} F1 复核降档合同错误`);
  }
}

let liveContractDocument = "";
try {
  liveContractDocument = readFileSync(liveContractDocumentPath, "utf8");
} catch (error) {
  errors.push(`04 LIVE 合同文档无法读取:${error.message}`);
}
const liveCanonical = JSON.stringify(liveContracts);
const capabilityCanonical = JSON.stringify(capabilityRegistry);
if (liveObjectSourceCount !== finalV8LiveObjectSourceCount) {
  errors.push(`LIVE 对象来源=${liveObjectSourceCount}，v8 基线应为 ${finalV8LiveObjectSourceCount}`);
}
const corpusReadmePath = join(root, "README.md");
if (existsSync(corpusReadmePath)) {
  const corpusReadme = readFileSync(corpusReadmePath, "utf8");
  if (!corpusReadme.includes("unresolved requirement，不是 connector readiness")) {
    errors.push("README 未将 986 LIVE source 降为 unresolved requirement（非 connector readiness）");
  }
}
if (sha256(liveCanonical) !== finalV8LiveRegistryDigest) errors.push("LIVE 合同源 v8 全量摘要基线漂移");
if (sha256(capabilityCanonical) !== finalV8CapabilityRegistryDigest) errors.push("F1 能力合同源 v8 全量摘要基线漂移");
if (!liveContractDocument.includes(`- LIVE 合同：${liveContracts.length} 条`)) errors.push("04 LIVE 合同数量声明漂移");
if (!liveContractDocument.includes(`- LIVE 对象来源：${liveObjectSourceCount} 个`)) errors.push("04 LIVE 对象来源数量声明漂移");
if (!liveContractDocument.includes(`- LIVE 合同摘要: PLACEHOLDER`.replace(": PLACEHOLDER", `：\`sha256:${sha256(liveCanonical)}\``))) errors.push("04 LIVE 合同摘要漂移");
if (!liveContractDocument.includes(`- 最终 F1 能力合同：${capabilityRegistry.active_contracts.length} 条`)) errors.push("04 F1 合同数量声明漂移");
if (!liveContractDocument.includes(`- F1 合同摘要: PLACEHOLDER`.replace(": PLACEHOLDER", `：\`sha256:${sha256(capabilityCanonical)}\``))) errors.push("04 F1 合同摘要漂移");
const liveSection = liveContractDocument.match(/## LIVE 逐对象来源合同\n([\s\S]*?)\n## 缺省 coding\/workspace F1 能力合同/u)?.[1] ?? "";
const liveDocumentRows = liveSection.split(/\r?\n/u).filter((line) => /^\| [A-Z]{3}-\d{3} \|/u.test(line));
const liveDocumentIds = liveDocumentRows.map((line) => line.split("|")[1].trim()).sort();
if (liveDocumentRows.length !== 465 || new Set(liveDocumentIds).size !== 465 || liveDocumentIds.join(",") !== liveRecordIds.join(",")) {
  errors.push("04 LIVE 合同行与 LIVE 题目集合不全等");
}
for (const contract of liveContracts) {
  const formatSources = (render) => contract.sources.map((source) => render(source)).join("<br>");
  const expectedRow = `| ${contract.id} | ${contract.object_selector} | ${contract.execution_mode}；${contract.input_modes.join("+")}；${contract.user_locator} | ${formatSources((source) => `${source.source_kind}: ${source.locator}`)} | ${formatSources((source) => `[${source.source_kind}] ${source.required_fields.join(",")}`)} | ${formatSources((source) => `[${source.source_kind}] ${source.reader_tools.join(",")}`)} | ${formatSources((source) => source.authority)} | ${formatSources((source) => `${source.freshness}；${source.as_of}`)} | ${formatSources((source) => source.principal_scope)} | ${contract.fixture_supplemental} |`;
  if (!liveDocumentRows.includes(expectedRow)) errors.push(`${contract.id} 04 LIVE 完整合同基线漂移`);
}
const f1Section = liveContractDocument.match(/## 缺省 coding\/workspace F1 能力合同\n([\s\S]*?)\n## F1 复核降档/u)?.[1] ?? "";
const f1DocumentRows = f1Section.split(/\r?\n/u).filter((line) => /^\| [A-Z]{3}-\d{3} \|/u.test(line));
if (f1DocumentRows.length !== 46) errors.push(`04 F1 合同行=${f1DocumentRows.length}，应为 46`);
for (const contract of capabilityRegistry.active_contracts) {
  const expectedRow = `| ${contract.id} | ${contract.project_type}；${contract.capability_baseline} | ${contract.workspace_locator} | ${contract.allowed_tools.join(",")} | ${contract.effect_kind}：${contract.allowed_effect} | ${contract.verification_method}；${contract.evidence} | ${contract.denied_scope} |`;
  if (!f1DocumentRows.includes(expectedRow)) errors.push(`${contract.id} 04 F1 完整合同基线漂移`);
}

const ids = new Set();
const normalizedQuestions = new Map();
for (const record of records) {
  if (ids.has(record.id)) errors.push(`ID 重复:${record.id}`);
  ids.add(record.id);
  const normalized = record.question.toLowerCase().replace(/[\p{P}\p{S}\s]/gu, "");
  if (normalizedQuestions.has(normalized)) errors.push(`问题精确重复:${record.id} 与 ${normalizedQuestions.get(normalized)}`);
  normalizedQuestions.set(normalized, record.id);

  if (record.contextTokens.includes("LIVE")) {
    if (record.tools.length === 0 || record.toolDepth === "K0") errors.push(`${record.id} 含 LIVE 却没有工具`);
    const hasDirectLiveReader = record.tools.some((tool) => directLiveInputTools.has(tool));
    if (!hasDirectLiveReader) errors.push(`${record.id} 含 LIVE 却没有登记的现势读取工具`);
    const contract = reviewedLiveReaderSpotContracts[record.id];
    if (contract) {
      for (const field of ["sourceKind", "locator", "fields", "authority", "freshness"]) {
        if (typeof contract[field] !== "string" || contract[field].length < 4) errors.push(`${record.id} LIVE 来源合同缺字段:${field}`);
      }
      for (const group of contract.readerGroups ?? []) {
        if (!group.some((tool) => record.tools.includes(tool))) {
          errors.push(`${record.id} LIVE ${contract.sourceKind} 缺对象相称 reader:${group.join("/")}`);
        }
      }
    }
  }
  if (record.d === "D4" && !record.tools.some((tool) => continuityTools.has(tool))) {
    errors.push(`${record.id} D4 周期动作缺少持续调度、状态或监控工具`);
  }
  if (automationRequiredD4Ids.has(record.id) && !record.tools.includes("automation")) {
    errors.push(`${record.id} D4 周期内容动作必须含 automation`);
  }
  if (record.id === "OPS-040" && (record.d !== "D4" || !record.tools.includes("automation"))) {
    errors.push("OPS-040 定期刷新证据索引必须标 D4 并含 automation");
  }

  const text = `${record.question} ${record.purpose}`;
  if (record.id === "SAL-014" && /三年(?:采购)?合同|三年合同约束/u.test(text)) {
    errors.push("SAL-014 不得把三年 TCO 比较跨度写成三年合同期限");
  }
  if (/我会指定|会把.{0,24}告诉你/u.test(record.question)) errors.push(`${record.id} 含面向 fixture 的未来输入承诺`);
  const codeWrite = record.prefix === "ENG" && !/状态|现在到哪/u.test(record.question) && /(?:改|修|补|实现|迁移|重做|加一个|放到|做重试|做限流|做降级)/u.test(record.question);
  if (codeWrite && record.risk === "S0") errors.push(`${record.id} 代码写入不得标 S0`);
  if (/病历|症状|用药|健康记录|照护资料|凭据|客户敏感数据|护照|驾照|简历|客户通话|多人日历|复诊和接送/u.test(text) && record.risk === "S0") errors.push(`${record.id} 敏感读取不得标 S0`);
  if (/(?:流失|留存)客户|支持记录|资产暴露|账户历史|(?:客户|账户)关键人|客户健康|客户升级|伙伴报备|佣金归属|记者兴趣|历史沟通|多币种|多实体|内部交易|现金流|融资|裁员|CRM 证据|pipeline|尾款|发票/u.test(text) && record.risk === "S0") {
    errors.push(`${record.id} 企业敏感数据读取不得标 S0`);
  }

  const productionDataChange = /(?:生产.{0,12}(?:数据库|数据表|schema|主键|回填|双写)|(?:数据库|数据表|schema|主键).{0,12}(?:生产迁移|回填|双写)|回填生产)/iu.test(text);
  if (productionDataChange && !["S2", "S3"].includes(record.risk)) errors.push(`${record.id} 生产数据或 schema 变更不得低于 S2`);

  const hardUserReference = /附件|手工表|原计划|本人作答|原题/u.test(record.question);
  const genericReference = /这份|这批|这张|这些|实测/u.test(record.question);
  const hasExplicitCurrentSource = record.contextTokens.includes("LIVE")
    && record.tools.some((tool) => directLiveInputTools.has(tool));
  if (hardUserReference && !record.contextTokens.includes("USER") && !hasExplicitCurrentSource) {
    errors.push(`${record.id} 用户材料指代缺 USER 或明确现势读取来源`);
  }
  if (genericReference && !record.contextTokens.includes("USER")
      && !record.contextTokens.some((token) => /^CTX-/u.test(token)) && !hasExplicitCurrentSource) {
    errors.push(`${record.id} 指代输入未由 fixture、USER 或明确现势来源闭合`);
  }

  const actualExternalEffect = /确认.*后再(?:发送|发布|预订|支付|付款|缴费|提交|部署)|逐渠道确认后再按排期发布|发题|群发|(?:每周|每月|按提前量|窗口临近|复习时|风险变化|偏差出现|越阈值).{0,18}(?:提醒|通知)|向(?:本人|员工|主管|客户|厂商).{0,8}(?:提醒|通知)|通知 owner/u.test(record.question);
  if (actualExternalEffect && record.risk !== "S3") errors.push(`${record.id} 含真实外部 effect 却未标 S3`);
  if (record.risk === "S3" && record.boundary === "B0") errors.push(`${record.id} S3 真实 effect 缺主授权或专业边界`);
  if (/写(?:入)? CRM|更新 CRM|quarantine|隔离数据|修改权限|权限策略|转进项目清单|生成账号|开通账号/u.test(record.question) && !["S2", "S3"].includes(record.risk)) errors.push(`${record.id} 工作树外写入低于 S2`);
  const outOfWorkspaceWrite = /(?:写入|更新)(?:.{0,8})(?:CRM|日历|任务系统|live 知识库|知识库|渠道配置|生产表|目标表)|修正血缘|创建共享日历|改约|quarantine|隔离数据/u.test(record.question);
  const writeAuthorization = record.boundary === "B-AUTH" || /确认|批准|授权|专业人员|人来发送|由人发送/u.test(record.question);
  if (outOfWorkspaceWrite && !/草稿|预览|不要执行|不执行|别.{0,8}(?:外发|发送|发布)|人来发送|由人发送/u.test(record.question)) {
    if (!["S2", "S3"].includes(record.risk)) errors.push(`${record.id} 圈外真实写入不得低于 S2`);
    if (!writeAuthorization) errors.push(`${record.id} 圈外真实写入缺预览、授权或确认边界`);
  }
  if (/并购|买房|融资|裁员|高金额|签证|税务/u.test(text) && record.boundary === "B0") {
    errors.push(`${record.id} 高金额法律或财务任务不得标 B0`);
  }

  const riskContract = finalV8RiskBoundaryContracts[record.id] ?? riskBoundaryContracts[record.id];
  if (riskContract) {
    if (!riskContract.dataClass || !riskContract.decisionOwner) errors.push(`${record.id} 风险合同缺数据类别或决策 owner`);
    if (Number(record.risk?.slice(1)) < riskContract.riskFloor) {
      errors.push(`${record.id} ${riskContract.dataClass} 风险低于 S${riskContract.riskFloor}`);
    }
    if (record.boundary !== riskContract.boundary) {
      errors.push(`${record.id} 主边界=${record.boundary}，${riskContract.dataClass} 应为 ${riskContract.boundary}`);
    }
  }
  const effectContract = finalV8EffectContracts[record.id];
  if (effectContract) {
    for (const field of ["effectKind", "target", "decisionOwner"]) {
      if (typeof effectContract[field] !== "string" || effectContract[field].length < 4) {
        errors.push(`${record.id} effect 合同缺字段:${field}`);
      }
    }
    if (effectContract.effectKind === "external_calendar_create") {
      if (!/确认/u.test(record.question) || !/(?:再建|创建|新增)/u.test(record.question)) {
        errors.push(`${record.id} 圈外创建必须保留确认与创建语义`);
      }
      if (Number(record.risk?.slice(1)) < 2) errors.push(`${record.id} external_calendar_create effect 风险不得低于 S2`);
      if (record.boundary !== "B-LEG") errors.push(`${record.id} external_calendar_create effect 主边界必须为 B-LEG`);
      if (!record.tools.includes("calendar") || !record.tools.includes("tasks")) {
        errors.push(`${record.id} external_calendar_create effect 缺 calendar/tasks 执行工具`);
      }
    }
    if (effectContract.effectKind === "refuse_or_scope") {
      if (record.fit !== "F4" || record.d !== "D0") errors.push(`${record.id} 越权 effect 必须以 F4/D0 安全响应建模`);
      if (record.risk !== "S3") errors.push(`${record.id} 越权 effect 必须保留 S3 请求风险`);
    }
  }

  if (record.id === "OPS-052") {
    if (!/协调计划和消息草稿/u.test(record.question) || !/不发送、不分派/u.test(record.question)) {
      errors.push("OPS-052 必须明确只生成协调计划和消息草稿，不发送、不分派");
    }
    if (record.tools.includes("messaging")) errors.push("OPS-052 草稿模式不应登记 messaging effect 工具");
  }
  if (record.id === "MKT-038" && /实时|持续(?:跟踪|更新)/u.test(record.question)) {
    errors.push("MKT-038 一次性危机简报不得冒充持续实时系统");
  }
  if (record.id === "CAR-012" && record.horizon !== "H0") {
    errors.push("CAR-012 本周期绩效是历史输入窗口，不得冒充未来请求跨度");
  }
  if (record.id === "OPS-040" && /\blive\b/iu.test(record.question)) errors.push("OPS-040 客户题面不得泄露 LIVE 内部术语");
  if (record.id === "FAM-013" && /必要字段|回退点|预览→确认→创建/u.test(record.question)) {
    errors.push("FAM-013 家庭场景不得使用验收合同口吻");
  }
  if (["OPS-020", "SAL-013", "DAT-020"].includes(record.id) && /^我获权/u.test(record.question)) {
    errors.push(`${record.id} 不得使用“我获权”式合同口吻`);
  }

  if (record.boundary === "B-MED" && !/医疗|临床|诊断|症状|用药|病历|医生|治疗|照护|健康/u.test(text)) errors.push(`${record.id} B-MED 缺医疗语义`);
  if (/投资建议|买卖建议|投资组合|自动触发交易|退休.*现金流|税务(?:归类|判断|申报|建议)|报税|转账/u.test(text) && !["B-FIN", "B-LEG"].includes(record.boundary)) errors.push(`${record.id} 财务专业判断未标 B-FIN`);

  const unsafeAutonomy = /(?:不用|不要|无需).{0,8}(?:问|确认|批准)|事后汇报|冒充/u.test(record.question)
    && /自动|直接|替我|替我们/u.test(record.question);
  if (unsafeAutonomy && record.fit !== "F4") errors.push(`${record.id} 明确越权自主请求未标 F4`);

  const exact = {
    ...(exactRecordExpectations[record.id] ?? {}),
    ...(finalRepairRecordExpectations[record.id] ?? {}),
    ...(finalV5RecordExpectations[record.id] ?? {}),
    ...(finalV6RecordExpectations[record.id] ?? {}),
    ...(finalV7RecordExpectations[record.id] ?? {}),
    ...(finalV8RecordExpectations[record.id] ?? {})
  };
  if (Object.keys(exact).length > 0) {
    for (const [field, expectedValue] of Object.entries(exact)) {
      if (record[field] !== expectedValue) errors.push(`${record.id} ${field}=${record[field]}，语义基线应为 ${expectedValue}`);
    }
  }
  const requiredTools = finalV8ToolExpectations[record.id] ?? finalV7ToolExpectations[record.id] ?? finalV6ToolExpectations[record.id] ?? finalV5ToolExpectations[record.id] ?? finalRepairToolExpectations[record.id] ?? requiredToolExpectations[record.id];
  if (requiredTools && requiredTools.join(",") !== record.tools.join(",")) {
    errors.push(`${record.id} 工具语义基线不符:${record.tools.join(",")}，应为 ${requiredTools.join(",")}`);
  }
  const requiredContexts = finalV8ContextExpectations[record.id] || finalV7ContextExpectations[record.id] ? [] : [...new Set([
    ...(requiredContextExpectations[record.id] ?? []),
    ...(finalRepairContextExpectations[record.id] ?? [])
  ])];
  if (requiredContexts.length > 0 && requiredContexts.some((token) => !record.contextTokens.includes(token))) {
    errors.push(`${record.id} 缺必需输入模式:${requiredContexts.filter((token) => !record.contextTokens.includes(token)).join(",")}`);
  }
  const exactContexts = finalV8ContextExpectations[record.id] ?? finalV7ContextExpectations[record.id] ?? finalV6ContextExpectations[record.id] ?? finalV5ContextExpectations[record.id];
  if (exactContexts && exactContexts.join("+") !== record.contextTokens.join("+")) {
    errors.push(`${record.id} 输入模式语义基线不符:${record.contextTokens.join("+") || "-"}，应为 ${exactContexts.join("+") || "-"}`);
  }
  const actualFullRow = `| ${[
    record.id, record.demandPrior, record.situation, record.question, record.purpose,
    record.tier, record.tools.join(",") || "-", record.contextTokens.join("+") || "-", record.fitText
  ].join(" | ")} |`;
  const v8FullRowDigest = finalV8FullRowDigests[record.id];
  const v7FullRowDigest = finalV7FullRowDigests[record.id];
  if (v8FullRowDigest) {
    if (sha256(actualFullRow) !== v8FullRowDigest) errors.push(`${record.id} v8 完整行摘要基线漂移`);
  } else if (v7FullRowDigest && !finalV8ChangedIds.has(record.id)) {
    if (sha256(actualFullRow) !== v7FullRowDigest) errors.push(`${record.id} v7 完整行摘要基线漂移`);
  } else if (!finalV7ChangedIds.has(record.id) && !finalV8ChangedIds.has(record.id)) {
    const expectedFullRow = finalV6FullRowExpectations[record.id];
    if (expectedFullRow && actualFullRow !== expectedFullRow) errors.push(`${record.id} v6 完整行基线漂移`);
  }
}
for (const id of f1CapabilityIds) if (records.find((record) => record.id === id)?.fit !== "F1") errors.push(`F1 能力基线未标 F1:${id}`);
for (const id of Object.keys(reviewedLiveReaderSpotContracts)) {
  const record = records.find((candidate) => candidate.id === id);
  if (!record?.contextTokens.includes("LIVE")) errors.push(`${id} 已登记 LIVE 来源合同但题目没有 LIVE`);
}
if (finalV8ReviewedIds.size !== 99) errors.push(`v8 终审点名行集合=${finalV8ReviewedIds.size}，应为 99`);
if (Object.keys(finalV8FullRowDigests).length !== 99) {
  errors.push(`v8 完整行摘要基线=${Object.keys(finalV8FullRowDigests).length}，应为 99`);
}
for (const id of finalV8ReviewedIds) {
  if (records.filter((record) => record.id === id).length !== 1) errors.push(`v8 终审点名行非单例:${id}`);
  if (!finalV8FullRowDigests[id]) errors.push(`v8 终审点名行缺完整摘要基线:${id}`);
}
for (const id of Object.keys(finalV8FullRowDigests)) {
  if (!finalV8ReviewedIds.has(id)) errors.push(`v8 完整行摘要未登记为终审点名行:${id}`);
  if (!ids.has(id)) errors.push(`v8 完整行摘要基线 ID 不存在:${id}`);
}
if (finalV7ChangedIds.size !== 99) errors.push(`v7 点名行集合=${finalV7ChangedIds.size}，应为 99`);
if (Object.keys(finalV7FullRowDigests).length !== 99) {
  errors.push(`v7 完整行摘要基线=${Object.keys(finalV7FullRowDigests).length}，应为 99`);
}
for (const id of finalV7ChangedIds) {
  if (records.filter((record) => record.id === id).length !== 1) errors.push(`v7 点名行非单例:${id}`);
  if (!finalV7FullRowDigests[id]) errors.push(`v7 点名行缺完整摘要基线:${id}`);
}
for (const id of Object.keys(finalV7FullRowDigests)) if (!ids.has(id)) errors.push(`v7 完整行摘要基线 ID 不存在:${id}`);
for (const id of Object.keys(finalV6FullRowExpectations)) {
  if (!finalV7ChangedIds.has(id) && !ids.has(id)) errors.push(`v6 完整行基线 ID 不存在:${id}`);
}

for (const [prior, rewriteIds] of Object.entries(v3NaturalQuestionIdsByDemand)) {
  if (rewriteIds.length < (prior === "M" ? 25 : 13)) errors.push(`${prior} 档自然改写登记不足:${rewriteIds.length}`);
  for (const id of rewriteIds) {
    const record = records.find((candidate) => candidate.id === id);
    if (!record) {
      errors.push(`自然改写 ID 不存在:${id}`);
      continue;
    }
    if (record.demandPrior !== prior) errors.push(`${id} 自然改写登记在 ${prior}，实际为 ${record.demandPrior}`);
    if (!/[？?]$/u.test(record.question)) errors.push(`${id} 自然改写后仍不是问句`);
    if (/^[把这用每先按从]/u.test(record.question)) errors.push(`${id} 自然改写仍使用集中模板开头`);
  }
}
for (const id of simpleRareIds) {
  const record = records.find((candidate) => candidate.id === id);
  if (!record || record.demandPrior !== "L" || record.c !== "C1" || record.rounds !== "R1") {
    errors.push(`${id} 简单长尾基线应为 L/C1/R1`);
  }
}

for (const [prefix, quota] of Object.entries(expected)) {
  const subset = records.filter((record) => record.prefix === prefix);
  if (subset.length !== quota.total) errors.push(`${prefix} 总数=${subset.length}，应为 ${quota.total}`);
  const expectedIds = Array.from({ length: quota.total }, (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`);
  const actualIds = new Set(subset.map((record) => record.id));
  for (const id of expectedIds) if (!actualIds.has(id)) errors.push(`${prefix} 缺少连续 ID:${id}`);
  for (const prior of ["H", "M", "L"]) {
    const actual = subset.filter((record) => record.demandPrior === prior).length;
    if (actual !== quota[prior]) errors.push(`${prefix}/${prior}=${actual}，应为 ${quota[prior]}`);
  }
}
if (records.length !== 600) errors.push(`总数=${records.length}，应为 600`);
for (const id of lifecycleIds) if (!ids.has(id)) errors.push(`生命周期索引 ID 不存在:${id}`);

function ngrams(text) {
  const normalized = text.toLowerCase().replace(/[\p{P}\p{S}\s]/gu, "");
  const result = new Map();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const key = normalized.slice(index, index + 2);
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}
function dice(left, right) {
  let overlap = 0;
  let leftTotal = 0;
  let rightTotal = 0;
  for (const value of left.values()) leftTotal += value;
  for (const value of right.values()) rightTotal += value;
  for (const [key, value] of left.entries()) overlap += Math.min(value, right.get(key) ?? 0);
  return 2 * overlap / Math.max(1, leftTotal + rightTotal);
}
const gramIndex = records.map((record) => ngrams(record.question));
const nearDuplicates = [];
const allDuplicatePairs = [];
for (let left = 0; left < records.length; left += 1) {
  for (let right = left + 1; right < records.length; right += 1) {
    const score = dice(gramIndex[left], gramIndex[right]);
    allDuplicatePairs.push({ score, left: records[left].id, right: records[right].id });
    if (score >= 0.55) nearDuplicates.push({ score, left: records[left].id, right: records[right].id });
  }
}
const topNearDuplicatePairs = allDuplicatePairs
  .sort((left, right) => right.score - left.score || left.left.localeCompare(right.left) || left.right.localeCompare(right.right))
  .slice(0, 10)
  .map((pair) => ({ ...pair, score: Number(pair.score.toFixed(6)) }));
if (allDuplicatePairs.length !== 179700) errors.push(`全量问题对=${allDuplicatePairs.length}，应为 179700`);
for (const pair of nearDuplicates) errors.push(`问题高度近重复:${pair.left}/${pair.right} dice=${pair.score.toFixed(3)}`);

const actualContextIds = readdirSync(contextDir).filter((name) => /^CTX-\d{2}$/u.test(name)).sort();
if (actualContextIds.join(",") !== expectedContextIds.join(",")) errors.push(`上下文目录集合异常:${actualContextIds.join(",")}`);
const contextSupport = {};
let fixtureSourceCount = 0;
let requiredClaimCount = 0;
let genericClaimCount = 0;
let genericSupplementalCount = 0;
for (const contextId of expectedContextIds) {
  const dir = join(contextDir, contextId);
  const manifestPath = join(dir, "manifest.md");
  let manifest;
  try {
    manifest = readFileSync(manifestPath, "utf8");
  } catch {
    errors.push(`${contextId} 缺少 manifest.md`);
    continue;
  }
  for (const field of ["as_of", "valid_until", "claim_scope", "supported_questions", "unsupported_scope"]) {
    if (!manifest.includes(`\`${field}\``)) errors.push(`${contextId} manifest 缺字段:${field}`);
  }
  const asOf = manifest.match(/- `as_of`: `([^`]+)`/u)?.[1];
  const validUntil = manifest.match(/- `valid_until`: `([^`]+)`/u)?.[1];
  if (!asOf || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/u.test(asOf)) errors.push(`${contextId} as_of 不是 ISO 日期:${asOf ?? "缺失"}`);
  if (asOf?.slice(0, 10) > validationDate) errors.push(`${contextId} as_of 晚于校验日 ${validationDate}:${asOf}`);
  if (validUntil && /^\d{4}-\d{2}-\d{2}$/u.test(validUntil)) {
    if (validUntil < validationDate) errors.push(`${contextId} 已过 valid_until:${validUntil}`);
  } else if (!["fixture-frozen", "immutable_event_window"].includes(validUntil)) {
    errors.push(`${contextId} valid_until 非日期且非登记 sentinel:${validUntil ?? "缺失"}`);
  }
  const supportMatch = manifest.match(/- `supported_questions`: `([^`]+)`/u);
  const supportedIds = supportMatch ? supportMatch[1].split(",").map((value) => value.trim()).filter(Boolean) : [];
  contextSupport[contextId] = new Set(supportedIds);
  if (new Set(supportedIds).size !== supportedIds.length) errors.push(`${contextId} supported_questions 重复`);
  for (const id of supportedIds) if (!ids.has(id)) errors.push(`${contextId} 支持白名单 ID 不存在:${id}`);

  const links = [...manifest.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)].map((match) => match[1]);
  if (links.length < 2) errors.push(`${contextId} manifest 来源链接少于 2 个`);
  const linkedNames = [];
  for (const link of links) {
    if (/^(?:https?:|\/)/u.test(link)) {
      errors.push(`${contextId} manifest 禁止未冻结外部或绝对来源:${link}`);
      continue;
    }
    const resolved = resolve(dir, link);
    if (relative(dir, resolved).startsWith("..")) {
      errors.push(`${contextId} manifest 来源逃逸目录:${link}`);
      continue;
    }
    try {
      if (!statSync(resolved).isFile()) errors.push(`${contextId} manifest 链接不是文件:${link}`);
      else if (dirname(realpathSync(resolved)) !== realpathSync(dir)) errors.push(`${contextId} manifest 来源不在本目录:${link}`);
    } catch {
      errors.push(`${contextId} manifest 断链:${link}`);
    }
    linkedNames.push(basename(link));
  }
  const sourceFiles = readdirSync(dir).filter((name) => name !== "manifest.md" && statSync(join(dir, name)).isFile()).sort();
  fixtureSourceCount += sourceFiles.length;
  const expectedSourceFiles = requiredContextSourceSets[contextId];
  if (expectedSourceFiles && sourceFiles.join(",") !== expectedSourceFiles.join(",")) {
    errors.push(`${contextId} 修复后来源集合不符:${sourceFiles.join(",")}`);
  }
  const linkedSources = [...new Set(linkedNames)].sort();
  if (sourceFiles.join(",") !== linkedSources.join(",")) errors.push(`${contextId} manifest 来源集合不闭合:目录=${sourceFiles.join(",")} 链接=${linkedSources.join(",")}`);
  const sourceContents = sourceFiles.map((name) => [name, readFileSync(join(dir, name), "utf8")]);
  for (const [name, content] of sourceContents) if (content.trim().length < 40) errors.push(`${contextId} 来源内容过短或为空:${name}`);
  const sourceDigest = sha256(sourceContents.map(([name, content]) => `${name}\0${content}`).join("\0"));
  const declaredSourceDigest = manifest.match(/- `fixture_sources_digest`: `sha256:([a-f0-9]{64})`/u)?.[1];
  if (declaredSourceDigest !== sourceDigest) errors.push(`${contextId} fixture_sources_digest 不匹配`);

  const contractMatch = manifest.match(/<!-- corpus:required-claims:begin -->([\s\S]*?)<!-- corpus:required-claims:end -->/u);
  if (!contractMatch) {
    errors.push(`${contextId} 缺少逐题 required claims 合同`);
  } else {
    const contractRows = contractMatch[1].split(/\r?\n/u)
      .filter((line) => /^\| [A-Z]{3}-\d{3} \|/u.test(line))
      .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
    requiredClaimCount += contractRows.length;
    const contractIds = contractRows.map((cells) => cells[0]);
    if (new Set(contractIds).size !== contractIds.length) errors.push(`${contextId} required claims 合同 ID 重复`);
    if ([...contractIds].sort().join(",") !== [...supportedIds].sort().join(",")) errors.push(`${contextId} required claims 与 supported_questions 不对称`);
    const claimTexts = contractRows.map((cells) => cells[1]);
    if (new Set(claimTexts).size !== claimTexts.length) errors.push(`${contextId} required claims 不是逐题唯一合同`);
    const contractDigest = sha256(contractRows.map((cells) => cells.join("\0")).join("\n"));
    const declaredContractDigest = manifest.match(/- `required_claims_digest`: `sha256:([a-f0-9]{64})`/u)?.[1];
    if (declaredContractDigest !== contractDigest) errors.push(`${contextId} required_claims_digest 不匹配`);
    if (contractDigest !== finalV8RequiredClaimDigests[contextId]) errors.push(`${contextId} v8 逐题 required claims 全量基线漂移`);
    for (const cells of contractRows) {
      if (cells.length !== 4) {
        errors.push(`${contextId} required claims 行字段数错误:${cells.join("|")}`);
        continue;
      }
      const [id, claim, sourceText, supplemental] = cells;
      const priorRequiredClaim = finalV7RequiredClaimExpectations[`${contextId}/${id}`]
        ?? requiredClaimExpectations[`${contextId}/${id}`];
      const requiredClaim = finalV8RequiredClaimExpectations[`${contextId}/${id}`]
        ?? (priorRequiredClaim && finalV8SupplementalExpectations[id]
          ? { ...priorRequiredClaim, supplemental: finalV8SupplementalExpectations[id] }
          : priorRequiredClaim);
      if (/作为“[^”]+”的冻结背景/u.test(claim)) {
        errors.push(`${contextId}/${id} required claim 禁止把 purpose 拼成 fixture 事实`);
      }
      if (/用于 [A-Z]{3}-\d{3} 时仅支持这些来源事实|仅支持这些来源事实|题面中未出现于 fixture|作为“[^”]+”的冻结背景/u.test(claim)) {
        genericClaimCount += 1;
        errors.push(`${contextId}/${id} required claim 命中 generic fallback`);
      }
      if (/题面所指材料|当前代码、系统、SaaS 或现势资料|泛化的 LIVE/u.test(supplemental)) {
        genericSupplementalCount += 1;
        errors.push(`${contextId}/${id} supplemental input 命中 generic fallback`);
      }
      if (id === "SAL-014" && /三年(?:采购)?合同|三年合同约束/u.test(claim)) {
        errors.push("CTX-16/SAL-014 required claim 不得虚构三年合同期限");
      }
      if (contextId === "CTX-06" && id === "LRN-015") {
        if (/员工.{0,6}上岗|上岗.{0,6}检查/u.test(claim)) errors.push("CTX-06/LRN-015 不得把上线数据抽检捏造成员工上岗检查");
        if (!/上线前.{0,12}数据抽检/u.test(claim)) errors.push("CTX-06/LRN-015 必须保留来源中的上线前数据抽检语义");
      }
      const sourceTokens = sourceSpecificClaimTokens[`${contextId}/${id}`] ?? [];
      for (const token of sourceTokens) {
        if (!claim.includes(token)) errors.push(`${contextId}/${id} required claim 缺 source 特有事实:${token}`);
      }
      const questionOnly = questionOnlyConstraintContracts[id];
      if (questionOnly?.contextId === contextId) {
        const sourceCorpus = sourceText.split("+").map((value) => value.trim()).filter(Boolean)
          .map((source) => readFileSync(join(dir, source), "utf8"))
          .join("\n");
        if (claim.includes(questionOnly.phrase)) errors.push(`${contextId}/${id} 把题面临时条件写进 fixture claim:${questionOnly.phrase}`);
        if (!records.find((candidate) => candidate.id === id)?.question.includes(questionOnly.phrase)) {
          errors.push(`${contextId}/${id} 题面临时条件基线缺失:${questionOnly.phrase}`);
        }
        if (!sourceCorpus.includes(questionOnly.phrase) && !supplemental.includes("USER")) {
          errors.push(`${contextId}/${id} 题面临时条件既无 fixture 来源也无 USER 归因`);
        }
      }
      if (requiredClaim) {
        if (claim !== requiredClaim.claim) errors.push(`${contextId}/${id} required claim 语义基线漂移`);
        if (sourceText !== requiredClaim.sources) errors.push(`${contextId}/${id} claim source 基线漂移`);
        if (supplemental !== requiredClaim.supplemental) errors.push(`${contextId}/${id} supplemental input 基线漂移`);
      }
      if (claim.length < 8) errors.push(`${contextId}/${id} required claim 过短`);
      const declaredSources = sourceText.split("+").map((value) => value.trim()).filter(Boolean);
      if (declaredSources.length === 0) errors.push(`${contextId}/${id} 未登记 claim source`);
      for (const source of declaredSources) if (!sourceFiles.includes(source)) errors.push(`${contextId}/${id} claim source 不存在:${source}`);
      const record = records.find((candidate) => candidate.id === id);
      const expectedSupplemental = record?.contextTokens.filter((token) => token === "USER" || token === "LIVE") ?? [];
      for (const token of expectedSupplemental) if (!supplemental.includes(token)) errors.push(`${contextId}/${id} 合同漏补充输入:${token}`);
      for (const token of ["USER", "LIVE"]) if (supplemental.includes(token) && !expectedSupplemental.includes(token)) errors.push(`${contextId}/${id} 合同多报补充输入:${token}`);
      if (expectedSupplemental.length === 0 && supplemental !== "-") errors.push(`${contextId}/${id} 无补充输入时合同应为 -`);
      if (record?.contextTokens.includes("LIVE") && contractSupplementalById.get(id) !== supplemental) {
        ctxLiveSupplementalMismatchCount += 1;
        errors.push(`${contextId}/${id} CTX supplemental 与 LIVE 来源合同不对称`);
      }
    }
  }

  const referencedIds = records.filter((record) => record.contextTokens.includes(contextId)).map((record) => record.id).sort();
  const declaredIds = [...new Set(supportedIds)].sort();
  if (referencedIds.join(",") !== declaredIds.join(",")) errors.push(`${contextId} 引用与 supported_questions 不对称`);
}
if (fixtureSourceCount !== 50) errors.push(`fixture sources=${fixtureSourceCount}，应为 50`);
if (requiredClaimCount !== 172) errors.push(`required claims=${requiredClaimCount}，应为 172`);
if (genericClaimCount !== 0) errors.push(`generic required claim=${genericClaimCount}，应为 0`);
if (genericSupplementalCount !== 0) errors.push(`generic supplemental input=${genericSupplementalCount}，应为 0`);
for (const record of records) {
  for (const token of record.contextTokens.filter((value) => /^CTX-/u.test(value))) {
    if (!contextSupport[token]?.has(record.id)) errors.push(`${record.id} 未在 ${token} 支持白名单`);
  }
}

for (const [group, values] of Object.entries({
  C: ["C1", "C2", "C3", "C4", "C5"], D: ["D0", "D1", "D2", "D3", "D4"], H: ["H0", "H1", "H2", "H3", "H4"],
  R: ["R1", "R2", "R3", "R4"], K: ["K0", "K1", "K2", "K3", "K4"], S: ["S0", "S1", "S2", "S3"], F: ["F1", "F2", "F3", "F4"]
})) {
  for (const value of values) if ((counts[group][value] ?? 0) < 3) errors.push(`${value} 覆盖不足 3 条`);
}

for (const prior of ["H", "M", "L"]) {
  if (Object.keys(counts.cross.C[prior] ?? {}).length < 4) errors.push(`${prior} 的复杂度覆盖不足 4 档`);
  for (const group of ["R", "K", "S"]) if (Object.keys(counts.cross[group][prior] ?? {}).length < 3) errors.push(`${prior} 的 ${group} 覆盖不足 3 档`);
  for (const group of ["D", "H"]) if (Object.keys(counts.cross[group][prior] ?? {}).length < 2) errors.push(`${prior} 的 ${group} 覆盖不足 2 档`);
}
if ((counts.cross.C.L?.C1 ?? 0) < 3) errors.push(`L 档 C1 简单长尾不足 3 条:${counts.cross.C.L?.C1 ?? 0}`);
if ((counts.cross.R.L?.R1 ?? 0) < 3) errors.push(`L 档 R1 单轮长尾不足 3 条:${counts.cross.R.L?.R1 ?? 0}`);
for (const id of demandHighAnchors) if (records.find((record) => record.id === id)?.demandPrior !== "H") errors.push(`高频校准锚点未标 H:${id}`);
for (const id of demandLowAnchors) if (records.find((record) => record.id === id)?.demandPrior !== "L") errors.push(`长尾校准锚点未标 L:${id}`);
const demandRank = { H: 0, M: 1, L: 2 };
for (const [moreLikely, lessLikely] of demandOrderConstraints) {
  const left = records.find((record) => record.id === moreLikely)?.demandPrior;
  const right = records.find((record) => record.id === lessLikely)?.demandPrior;
  if (left === undefined || right === undefined || demandRank[left] >= demandRank[right]) {
    errors.push(`频率语义序位未满足:${moreLikely}(${left}) 应高于 ${lessLikely}(${right})`);
  }
}
for (const [group, lowerBound] of [["K2", 2], ["K3", 4], ["K4", 6]]) {
  const total = counts.K[group] ?? 0;
  const exactLower = counts.toolCounts[String(lowerBound)] ?? 0;
  if (total > 0 && exactLower / total > 0.85) errors.push(`${group} 有 ${(exactLower / total * 100).toFixed(1)}% 恰落工具数下界，疑似反填`);
}

const questionMarks = records.filter((record) => /[？?]$/u.test(record.question)).length;
const questionMarksByDemand = Object.fromEntries(["H", "M", "L"].map((prior) => [
  prior,
  records.filter((record) => record.demandPrior === prior && /[？?]$/u.test(record.question)).length
]));
const questionMarkRates = Object.fromEntries(["H", "M", "L"].map((prior) => [
  prior,
  questionMarksByDemand[prior] / records.filter((record) => record.demandPrior === prior).length
]));
const baStarts = records.filter((record) => /^把/u.test(record.question)).length;
const averageLengths = Object.fromEntries(["H", "M", "L"].map((prior) => {
  const lengths = records.filter((record) => record.demandPrior === prior).map((record) => [...record.question].length);
  return [prior, lengths.reduce((sum, value) => sum + value, 0) / lengths.length];
}));
if (questionMarks < 90) errors.push(`自然问句不足 90 条:${questionMarks}`);
const questionRateValues = Object.values(questionMarkRates);
if (Math.max(...questionRateValues) > Math.min(...questionRateValues) * 2) {
  errors.push(`H/M/L 问句率差异超过 2 倍:${JSON.stringify(questionMarkRates)}`);
}
if (baStarts > 120) errors.push(`“把”字开头过多:${baStarts}`);
if (!(averageLengths.H + 0.5 < averageLengths.L)) errors.push(`高频问题未短于长尾:H=${averageLengths.H.toFixed(1)} L=${averageLengths.L.toFixed(1)}`);

const summary = {
  records: records.length,
  questionFiles: actualQuestionFiles.length,
  contextManifests: actualContextIds.length,
  demandPrior: counts.demandPrior,
  complexity: counts.C,
  firstReviewLatency: counts.D,
  realWorldHorizon: counts.H,
  rounds: counts.R,
  toolDepth: counts.K,
  risk: counts.S,
  fit: counts.F,
  boundary: counts.B,
  toolFamilies: counts.tools,
  toolCounts: counts.toolCounts,
  contextModes: counts.contextModes,
  contextUsage: counts.contextUsage,
  fixtureSources: fixtureSourceCount,
  requiredClaims: requiredClaimCount,
  genericRequiredClaims: genericClaimCount,
  genericSupplementalInputs: genericSupplementalCount,
  liveSourceContracts: liveContracts.length,
  liveObjectSources: liveObjectSourceCount,
  liveContractAudit: { ...liveContractAudit, ctxSupplementalMismatches: ctxLiveSupplementalMismatchCount },
  f1CapabilityContracts: capabilityRegistry.active_contracts.length,
  v8ReviewedRowBaselines: Object.keys(finalV8FullRowDigests).length,
  v7ReviewedRowBaselines: Object.keys(finalV7FullRowDigests).length,
  crossByDemandPrior: counts.cross,
  naturalness: { questionMarks, questionMarksByDemand, questionMarkRates, baStarts, averageLengths },
  allQuestionPairs: allDuplicatePairs.length,
  nearDuplicatePairsAt055: nearDuplicates.length,
  topNearDuplicatePairs
};

if (errors.length > 0) {
  console.error(JSON.stringify(summary, null, 2));
  console.error(`\n[fail] ${errors.length} 个问题`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(JSON.stringify(summary, null, 2));
console.log("\n[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过");
