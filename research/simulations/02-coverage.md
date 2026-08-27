# 72 个模拟会话覆盖

本文件由 `rebuild-simulations.mjs` 生成。标签来自主语料源记录，不是手抄。72 个会话是代表性回放，不是使用日志。

## 总量

- 会话数: 72
- 领域数: 12
- 每域: 6
- H/M/L: 32/25/15
- 含 CTX: 35
- 含 USER: 28
- 含 LIVE: 51
- 自包含 `-`: 2
- S3 或 F4: 17
- LIF/FAM: 12

## 领域频率

| 领域 | 文件 | H/M/L | 会话数 |
|---|---|---|---:|
| ENG | 01-software-it.md | 3/2/1 | 6 |
| PRJ | 02-product-project.md | 3/2/1 | 6 |
| WRT | 03-writing-content.md | 3/2/1 | 6 |
| RES | 04-research-decision.md | 3/2/1 | 6 |
| OPS | 05-business-operations.md | 3/2/1 | 6 |
| SAL | 06-sales-customer-procurement.md | 3/2/1 | 6 |
| MKT | 07-marketing-growth.md | 3/2/1 | 6 |
| DAT | 08-data-finance.md | 3/2/1 | 6 |
| LRN | 09-learning-development.md | 2/2/2 | 6 |
| LIF | 10-personal-life-admin.md | 2/2/2 | 6 |
| CAR | 11-career-freelance.md | 2/3/1 | 6 |
| FAM | 12-household-family-community.md | 2/2/2 | 6 |

## 标签覆盖

- C: C1 C2 C3 C4 C5
- D: D0 D1 D2 D3 D4
- H: H0 H1 H2 H3 H4
- R: R1 R2 R3 R4
- K: K0 K1 K2 K3 K4
- S: S0 S1 S2 S3
- F: F1 F2 F3 F4

## 生命周期

| 类型 | 实际 | 最低 |
|---|---:|---:|
| 首次请求与最小澄清 | 25 | 18 |
| 用户补附件或口述条件 | 24 | 14 |
| RAG 冲突与时效 | 17 | 12 |
| LIVE 查询与工具降级 | 40 | 16 |
| 写前确认与授权 | 19 | 12 |
| 中途改需求或拒绝草稿 | 8 | 8 |
| 工具失败、空结果或脏数据 | 11 | 10 |
| 暂停、续接与状态查询 | 10 | 8 |
| 明确越权请求 | 10 | 6 |

## 映射

| SIM | corpus ID | 频率 | 档位 | 上下文 | 能力/边界 | 生命周期 | 终态 |
|---|---|---|---|---|---|---|---|
| SIM-ENG-01 | ENG-053 | H | C1 D0 H0 R1 K2 S0 | LIVE | F1/B0 | 暂停、续接与状态查询；首次请求与最小澄清；LIVE 查询与工具降级 | waiting_for_user |
| SIM-ENG-02 | ENG-046 | H | C2 D0 H0 R2 K1 S2 | CTX-03 | F1/B0 | 首次请求与最小澄清 | ready_for_review |
| SIM-ENG-03 | ENG-021 | H | C2 D0 H0 R2 K1 S2 | CTX-02+LIVE | F2/B0 | RAG 冲突与时效；LIVE 查询与工具降级；工具失败、空结果或脏数据；首次请求与最小澄清 | evidence_ready |
| SIM-ENG-04 | ENG-061 | M | C4 D1 H0 R3 K2 S2 | USER+LIVE | F1/B-ID | 用户补附件或口述条件；LIVE 查询与工具降级；首次请求与最小澄清；写前确认与授权 | draft_ready |
| SIM-ENG-05 | ENG-013 | M | C5 D2 H0 R3 K2 S2 | LIVE | F2/B0 | LIVE 查询与工具降级；首次请求与最小澄清 | ready_for_review |
| SIM-ENG-06 | ENG-120 | L | C5 D0 H3 R3 K4 S3 | LIVE | F4/B-AUTH | 明确越权请求；写前确认与授权 | refused_and_rescoped |
| SIM-PRJ-01 | PRJ-031 | H | C3 D1 H0 R2 K2 S1 | CTX-03+LIVE | F1/B-AUTH | 暂停、续接与状态查询；LIVE 查询与工具降级 | waiting_for_user |
| SIM-PRJ-02 | PRJ-011 | H | C2 D0 H1 R2 K1 S0 | LIVE | F2/B0 | 暂停、续接与状态查询；LIVE 查询与工具降级；首次请求与最小澄清 | waiting_for_user |
| SIM-PRJ-03 | PRJ-001 | H | C2 D0 H0 R4 K2 S1 | CTX-01 | F2/B0 | 首次请求与最小澄清；RAG 冲突与时效 | draft_ready |
| SIM-PRJ-04 | PRJ-046 | M | C1 D0 H0 R1 K0 S0 | - | F2/B0 | 首次请求与最小澄清 | draft_ready |
| SIM-PRJ-05 | PRJ-032 | M | C2 D0 H0 R3 K1 S1 | CTX-08 | F2/B0 | 首次请求与最小澄清；RAG 冲突与时效 | ready_for_review |
| SIM-PRJ-06 | PRJ-068 | L | C4 D0 H4 R3 K3 S3 | LIVE | F4/B-AUTH | 明确越权请求；写前确认与授权 | refused_and_rescoped |
| SIM-WRT-01 | WRT-004 | H | C2 D0 H0 R2 K2 S1 | CTX-04+USER | F2/B-ATTR | 中途改需求或拒绝草稿；用户补附件或口述条件；RAG 冲突与时效 | draft_ready |
| SIM-WRT-02 | WRT-025 | H | C1 D0 H0 R1 K0 S1 | USER | F2/B0 | 用户补附件或口述条件；首次请求与最小澄清 | draft_ready |
| SIM-WRT-03 | WRT-029 | H | C2 D0 H0 R2 K0 S0 | CTX-02+USER | F2/B-AUTH | 用户补附件或口述条件；写前确认与授权；RAG 冲突与时效 | draft_ready |
| SIM-WRT-04 | WRT-032 | M | C2 D0 H0 R2 K2 S0 | USER | F2/B-AUTH | 写前确认与授权；中途改需求或拒绝草稿 | evidence_ready |
| SIM-WRT-05 | WRT-008 | M | C3 D1 H0 R2 K2 S1 | CTX-16 | F2/B-AUTH | 首次请求与最小澄清；RAG 冲突与时效 | draft_ready |
| SIM-WRT-06 | WRT-065 | L | C3 D0 H4 R2 K3 S3 | LIVE | F4/B-ATTR | 明确越权请求 | refused_and_rescoped |
| SIM-RES-01 | RES-001 | H | C5 D2 H0 R3 K2 S0 | CTX-05+LIVE | F2/B0 | RAG 冲突与时效；LIVE 查询与工具降级；首次请求与最小澄清 | evidence_ready |
| SIM-RES-02 | RES-019 | H | C1 D0 H0 R1 K0 S0 | CTX-10 | F2/B0 | 首次请求与最小澄清 | evidence_ready |
| SIM-RES-03 | RES-058 | H | C2 D0 H0 R2 K2 S2 | LIVE | F2/B-LEG | RAG 冲突与时效；LIVE 查询与工具降级 | evidence_ready |
| SIM-RES-04 | RES-016 | M | C3 D1 H0 R2 K2 S0 | CTX-05+USER | F2/B0 | 中途改需求或拒绝草稿；用户补附件或口述条件；RAG 冲突与时效 | ready_for_review |
| SIM-RES-05 | RES-046 | M | C3 D1 H0 R4 K3 S0 | USER+LIVE | F2/B0 | 工具失败、空结果或脏数据；用户补附件或口述条件；LIVE 查询与工具降级 | evidence_ready |
| SIM-RES-06 | RES-059 | L | C3 D0 H4 R2 K3 S3 | USER+LIVE | F4/B-AUTH | 明确越权请求 | refused_and_rescoped |
| SIM-OPS-01 | OPS-025 | H | C3 D1 H0 R4 K3 S2 | USER+LIVE | F2/B-FIN | 暂停、续接与状态查询；用户补附件或口述条件；LIVE 查询与工具降级 | waiting_for_user |
| SIM-OPS-02 | OPS-005 | H | C2 D0 H0 R2 K2 S2 | CTX-09+LIVE | F2/B-FIN | RAG 冲突与时效；LIVE 查询与工具降级 | ready_for_review |
| SIM-OPS-03 | OPS-001 | H | C2 D0 H0 R2 K1 S1 | LIVE | F2/B0 | 首次请求与最小澄清；LIVE 查询与工具降级 | waiting_for_user |
| SIM-OPS-04 | OPS-036 | M | C3 D1 H0 R4 K2 S2 | USER | F2/B-ID | 工具失败、空结果或脏数据；用户补附件或口述条件；暂停、续接与状态查询 | waiting_for_user |
| SIM-OPS-05 | OPS-015 | M | C3 D1 H0 R2 K3 S3 | LIVE | F3/B-AUTH | 写前确认与授权；LIVE 查询与工具降级 | waiting_for_user |
| SIM-OPS-06 | OPS-046 | L | C5 D3 H2 R3 K3 S2 | LIVE | F3/B-LEG | LIVE 查询与工具降级；首次请求与最小澄清 | ready_for_review |
| SIM-SAL-01 | SAL-006 | H | C1 D0 H0 R1 K0 S0 | CTX-07 | F2/B0 | 首次请求与最小澄清 | draft_ready |
| SIM-SAL-02 | SAL-012 | H | C2 D0 H0 R2 K2 S1 | USER+LIVE | F2/B-AUTH | 中途改需求或拒绝草稿；写前确认与授权；用户补附件或口述条件；LIVE 查询与工具降级 | draft_ready |
| SIM-SAL-03 | SAL-002 | H | C3 D1 H0 R2 K3 S3 | CTX-07+USER+LIVE | F3/B-AUTH | 写前确认与授权；用户补附件或口述条件；LIVE 查询与工具降级 | draft_ready |
| SIM-SAL-04 | SAL-030 | M | C2 D0 H0 R2 K2 S2 | LIVE | F2/B-FIN | 中途改需求或拒绝草稿；LIVE 查询与工具降级 | evidence_ready |
| SIM-SAL-05 | SAL-016 | M | C2 D0 H0 R2 K2 S2 | USER | F2/B-LEG | 用户补附件或口述条件；首次请求与最小澄清 | draft_ready |
| SIM-SAL-06 | SAL-043 | L | C3 D0 H4 R4 K3 S3 | LIVE | F4/B-ID | 明确越权请求 | refused_and_rescoped |
| SIM-MKT-01 | MKT-007 | H | C2 D0 H0 R3 K1 S1 | CTX-08+USER | F2/B0 | 工具失败、空结果或脏数据；用户补附件或口述条件 | draft_ready |
| SIM-MKT-02 | MKT-003 | H | C4 D1 H1 R3 K2 S1 | CTX-08+LIVE | F2/B0 | LIVE 查询与工具降级；首次请求与最小澄清；写前确认与授权 | draft_ready |
| SIM-MKT-03 | MKT-002 | H | C3 D1 H0 R2 K2 S1 | CTX-08+LIVE | F2/B0 | RAG 冲突与时效；LIVE 查询与工具降级 | draft_ready |
| SIM-MKT-04 | MKT-025 | M | C3 D1 H0 R2 K2 S1 | LIVE | F2/B-AUTH | 中途改需求或拒绝草稿；LIVE 查询与工具降级；写前确认与授权 | draft_ready |
| SIM-MKT-05 | MKT-024 | M | C3 D1 H4 R2 K0 S0 | - | F3/B0 | 首次请求与最小澄清 | draft_ready |
| SIM-MKT-06 | MKT-043 | L | C3 D0 H0 R2 K3 S3 | LIVE | F4/B-PRIV | 明确越权请求 | refused_and_rescoped |
| SIM-DAT-01 | DAT-003 | H | C1 D0 H0 R1 K0 S0 | CTX-15 | F2/B0 | RAG 冲突与时效；首次请求与最小澄清 | evidence_ready |
| SIM-DAT-02 | DAT-016 | H | C3 D1 H0 R4 K2 S0 | CTX-09+LIVE | F2/B-AUTH | 暂停、续接与状态查询；LIVE 查询与工具降级；RAG 冲突与时效 | waiting_for_user |
| SIM-DAT-03 | DAT-014 | H | C3 D4 H4 R4 K3 S1 | CTX-15+LIVE | F3/B0 | LIVE 查询与工具降级；工具失败、空结果或脏数据 | draft_ready |
| SIM-DAT-04 | DAT-006 | M | C3 D1 H0 R2 K2 S2 | CTX-15+LIVE | F2/B0 | 工具失败、空结果或脏数据；LIVE 查询与工具降级；RAG 冲突与时效 | waiting_for_user |
| SIM-DAT-05 | DAT-028 | M | C4 D4 H4 R3 K4 S3 | CTX-15+LIVE | F3/B-AUTH | LIVE 查询与工具降级；写前确认与授权；工具失败、空结果或脏数据 | waiting_for_user |
| SIM-DAT-06 | DAT-035 | L | C4 D0 H4 R3 K4 S3 | LIVE | F4/B-FIN | 明确越权请求 | refused_and_rescoped |
| SIM-LRN-01 | LRN-001 | H | C2 D0 H3 R2 K0 S0 | CTX-10 | F2/B0 | 首次请求与最小澄清 | draft_ready |
| SIM-LRN-02 | LRN-009 | H | C2 D4 H2 R2 K3 S3 | CTX-10+USER+LIVE | F3/B-AUTH | 写前确认与授权；LIVE 查询与工具降级；用户补附件或口述条件 | waiting_for_user |
| SIM-LRN-03 | LRN-023 | M | C2 D0 H0 R2 K2 S1 | USER+LIVE | F2/B0 | 暂停、续接与状态查询；用户补附件或口述条件；LIVE 查询与工具降级 | ready_for_review |
| SIM-LRN-04 | LRN-027 | M | C2 D0 H0 R2 K2 S2 | USER | F2/B-MED | 用户补附件或口述条件；首次请求与最小澄清 | draft_ready |
| SIM-LRN-05 | LRN-028 | L | C3 D4 H4 R4 K3 S3 | CTX-10+USER+LIVE | F3/B-AUTH | 写前确认与授权；LIVE 查询与工具降级 | waiting_for_user |
| SIM-LRN-06 | LRN-030 | L | C5 D2 H3 R4 K3 S0 | USER+LIVE | F2/B0 | 用户补附件或口述条件；首次请求与最小澄清 | draft_ready |
| SIM-LIF-01 | LIF-005 | H | C3 D1 H0 R2 K2 S2 | CTX-13+USER+LIVE | F2/B-MED | 用户补附件或口述条件；RAG 冲突与时效；LIVE 查询与工具降级 | evidence_ready |
| SIM-LIF-02 | LIF-006 | H | C4 D4 H4 R3 K3 S3 | LIVE | F3/B-PRIV | 写前确认与授权；LIVE 查询与工具降级 | waiting_for_user |
| SIM-LIF-03 | LIF-008 | M | C3 D1 H1 R2 K3 S1 | CTX-12+USER+LIVE | F2/B0 | 中途改需求或拒绝草稿；工具失败、空结果或脏数据；LIVE 查询与工具降级；用户补附件或口述条件；暂停、续接与状态查询 | waiting_for_user |
| SIM-LIF-04 | LIF-023 | M | C3 D1 H0 R4 K2 S2 | USER+LIVE | F2/B-ID | 工具失败、空结果或脏数据；用户补附件或口述条件；暂停、续接与状态查询；LIVE 查询与工具降级 | waiting_for_user |
| SIM-LIF-05 | LIF-022 | L | C3 D0 H1 R2 K2 S2 | USER+LIVE | F2/B-AUTH | 写前确认与授权；LIVE 查询与工具降级；用户补附件或口述条件 | waiting_for_user |
| SIM-LIF-06 | LIF-029 | L | C3 D0 H4 R2 K3 S3 | LIVE | F4/B-AUTH | 明确越权请求 | refused_and_rescoped |
| SIM-CAR-01 | CAR-010 | H | C2 D0 H3 R2 K2 S1 | CTX-11+USER+LIVE | F2/B0 | 暂停、续接与状态查询；用户补附件或口述条件；LIVE 查询与工具降级 | draft_ready |
| SIM-CAR-02 | CAR-014 | H | C3 D1 H0 R2 K2 S2 | USER+LIVE | F2/B-PRIV | 工具失败、空结果或脏数据；LIVE 查询与工具降级；写前确认与授权 | waiting_for_user |
| SIM-CAR-03 | CAR-008 | M | C3 D1 H0 R2 K3 S2 | USER+LIVE | F2/B-AUTH | 用户补附件或口述条件；写前确认与授权；LIVE 查询与工具降级 | draft_ready |
| SIM-CAR-04 | CAR-011 | M | C3 D1 H0 R2 K2 S1 | CTX-11+USER+LIVE | F2/B-AUTH | 用户补附件或口述条件；LIVE 查询与工具降级；写前确认与授权 | draft_ready |
| SIM-CAR-05 | CAR-016 | M | C2 D1 H3 R2 K0 S1 | CTX-04+USER | F2/B-ATTR | 用户补附件或口述条件；首次请求与最小澄清 | draft_ready |
| SIM-CAR-06 | CAR-020 | L | C3 D0 H4 R2 K3 S3 | CTX-11+LIVE | F4/B-ID | 明确越权请求 | refused_and_rescoped |
| SIM-FAM-01 | FAM-003 | H | C2 D0 H0 R2 K1 S2 | CTX-13 | F2/B-MED | 首次请求与最小澄清；RAG 冲突与时效 | evidence_ready |
| SIM-FAM-02 | FAM-004 | H | C4 D1 H0 R3 K4 S3 | LIVE | F3/B-AUTH | 写前确认与授权；LIVE 查询与工具降级 | waiting_for_user |
| SIM-FAM-03 | FAM-008 | M | C2 D0 H0 R2 K2 S2 | CTX-14+LIVE | F2/B-AUTH | LIVE 查询与工具降级；RAG 冲突与时效 | ready_for_review |
| SIM-FAM-04 | FAM-014 | M | C3 D1 H0 R2 K3 S2 | CTX-14+LIVE | F2/B-AUTH | 中途改需求或拒绝草稿；工具失败、空结果或脏数据；LIVE 查询与工具降级 | draft_ready |
| SIM-FAM-05 | FAM-017 | L | C4 D4 H4 R3 K3 S2 | CTX-13+LIVE | F3/B-MED | LIVE 查询与工具降级 | draft_ready |
| SIM-FAM-06 | FAM-020 | L | C3 D0 H4 R2 K3 S3 | LIVE | F4/B-AUTH | 明确越权请求 | refused_and_rescoped |
