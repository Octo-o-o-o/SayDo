# 2026-10-03 合成语料到期观察

这是本轮本机结构观察，不是新客户资料、续期来源或执行通过证据。原 600 题、16 个 manifest 及全部冻结来源保持；09 §18.9 的原五份退役集合不扩张。

| context | 原 valid_until | 本轮状态 | 引用题数 |
|---|---|---|---|
| [CTX-09](contexts/CTX-09/manifest.md) | 2026-09-30 | expired_not_retired | 8 |
| [CTX-12](contexts/CTX-12/manifest.md) | 2026-09-30 | expired_not_retired | 4 |
| [CTX-16](contexts/CTX-16/manifest.md) | 2026-09-30 | expired_not_retired | 13 |

原五份退役仍阻断 57 题；另有 25 题引用上表到期材料，不能把“未被五项退役阻断”说成有效或执行通过。各题完整引用如下：

- CTX-09：WRT-028, WRT-018, RES-020, OPS-005, OPS-021, DAT-004, DAT-009, DAT-016。
- CTX-12：OPS-013, LIF-013, LIF-008, FAM-009。
- CTX-16：PRJ-040, PRJ-034, WRT-050, WRT-008, RES-002, OPS-029, SAL-014, SAL-015, SAL-022, SAL-029, SAL-042, SAL-035, SAL-044。

`validate.mjs` 仍因这三份材料过期返回失败；`test-mutations.mjs` 的真实 rebuild 正例仍受同一前提阻断。simulation/dry-run 的结构验证和历史回放状态不能抵销该失败。Q0 继续检查原全部 LIVE 需求，不运行 Q0 --write。

原语料日期不续写，不把 USER/LIVE 改成已存在的替代输入。是否新增退役或取得可验证新来源，继续遵现役合同与 owner 追加裁决。
