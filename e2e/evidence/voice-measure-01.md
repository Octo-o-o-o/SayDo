# VOICE-MEASURE-01 本地验收与收口

日期:2026-09-23。owner本会话授权「确认，请你继续实施」,覆盖本批本地提交、合并与收口及继续受控原型。状态 LOCAL_GREEN_REMOTE_PENDING;没有push、部署或远端CI。

代码提交: `b751843b4ebad43ff45949ad69f4f0798ffff5c2`。提交前固定候选 HEAD=`595725bad012302ef75ec7ab68c4aaf773f7155a`,git-diff-v1=`28a01b53ab9cca2714da440a2969d2d956991a560b686c5103bb4f49c12acc86`。15个变更文件按accepted-files.json逐一SHA核对后提交,代码字节等于独立验收候选。

本批修复 EOU 终止/续接标点、TTS入队绑定源turn、有界去重、系统播报拒虚构turn,生产playout使用同一允许集。未改wire、HF状态机、console协议或现役执行后端。

## 独立验收

fresh Codex `gpt-6-astra/medium`,read-only,会话`01a0ccfb-fc0b-73c1-b6e6-5295d197ff7b`,review-2 GREEN;校验器`--deliver`实际exit0、deliverable=true。身份已核rollout turn_context。旧review-1系统句P1为RED,经一次修复再审通过;没有删失败或重复审同候选。

私有证据目录:`~/.codex/tasks/saydo-voice-measure-20260923/`,含acceptance.md、task.json、review-2.md、review-identities.json、accepted-files.json和原始日志。本文件不复制私有task或原始log入Git。

| 门禁 | exit | 日志 | 字节 | SHA-256 |
|---|---:|---|---:|---|
| `just ci` | 0 | `gate-3-1.log` | 136403 | `c492a22b4f3566ae09f5f6899c5e723b50b11f58e1f436b6c48da5fde9702c51` |
| `pnpm exec playwright test` | 0 | `gate-4-1.log` | 7085 | `c8b66d30db39bb0a69904eaeab6d8cd60778904488a714169c338bcc14051877` |
| `just precommit` | 0 | `gate-3-3.log` | 398 | `4feff060a1759103b08f244683b4385ef1972f7910ac278df9277023993e1471` |
| `schedule self-test` | 0 | `gate-3-4.log` | 398 | `90a58bdf2d8e346d4f7152dfe006f83365c49b8f37cffb199d4ef5d4cf0cbfff` |

Node3266 passed/21 skipped;Python110 passed;浏览器54 passed。修复前后反例及定向日志见同目录focused-logs/、repair-1-focused/。第一次CI缺clone私有探针失败后补环境重跑;浏览器一次53pass/1fail重载超时保留,后同候选全套54pass,负载仅可能因素。测试生成截图保全后还原,指纹完全恢复。修复1/3、复审1/3、程序重试2/2,无活调用。

## 保留边界

HF L5五段仍undeterminable,需候选端点修订/轮次映射合同,本批按已采纳EOU/TTS子集收口。远端CI、真实ASR/TTS、麦克风、多设备、SLO均未验。CODEX-AS-SPIKE-01是独立后继,此处不宣称其实现或PG-07生产支持。
