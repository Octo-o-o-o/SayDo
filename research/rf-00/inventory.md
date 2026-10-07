# RF-00 机械清单(inventory.md)

> 生成物:`node scripts/rf00-inventory-scan.mjs --write` 产出;语义核验与分母口径见 README.md 与 semantic-claims.json。本表只证明机械命中,不证明语义读完。
> basis: branch=`codex/saydo-unify-audit-20261003` head=`527b069c7198e22da0145debe2a8070db52357f3` tracked_files=2590
> 源码面: product_sources=883(ts/tsx/py/kt/kts/swift/ets)

| class | discovered | unique | selected(semantic) | executed | retried | skipped | NOT_RUN |
|---|---|---|---|---|---|---|---|
| transport_registrations | 660 | 660 | 660 | 0 | 0 | 0 | 0 |
| http_routes | 87 | 87 | 87 | 0 | 0 | 0 | 0 |
| ws_messages | 35 | 35 | 35 | 0 | 0 | 0 | 0 |
| ipc_frames | 5 | 5 | 5 | 0 | 0 | 0 | 0 |
| brain_tools | 32 | 32 | 32 | 0 | 0 | 0 | 0 |
| task_actions | 5 | 5 | 5 | 0 | 0 | 0 | 0 |
| cli_commands | 5 | 5 | 5 | 0 | 0 | 0 | 0 |
| console_api_members | 43 | 43 | 43 | 0 | 0 | 0 | 0 |
| tables | 57 | 57 | 57 | 0 | 0 | 0 | 0 |
| table_writers | 116 | 116 | 116 | 0 | 0 | 0 | 0 |
| file_writers | 225 | 225 | 225 | 0 | 0 | 0 | 0 |
| module_dependencies | 5 | 5 | 5 | 0 | 0 | 0 | 0 |
| external_dependencies | 55 | 55 | 55 | 0 | 0 | 0 | 0 |
| artifacts | 9 | 9 | 9 | 0 | 0 | 0 | 0 |
| support_facts | 28 | 28 | 28 | 0 | 0 | 0 | 0 |
| legacy_candidates | 54 | 54 | 14 | 0 | 0 | 0 | 0 |

## transport_registrations (660)

| id | detail | sources |
|---|---|---|
| `apps/android/app/src/main/java/com/octoooo/saydo/WebPanel.kt:153` |  | apps/android/app/src/main/java/com/octoooo/saydo/WebPanel.kt:153 |
| `apps/android/app/src/main/java/com/octoooo/saydo/WebPanel.kt:154` |  | apps/android/app/src/main/java/com/octoooo/saydo/WebPanel.kt:154 |
| `apps/android/app/src/main/java/com/octoooo/saydo/WebPanel.kt:43` |  | apps/android/app/src/main/java/com/octoooo/saydo/WebPanel.kt:43 |
| `apps/android/app/src/main/java/com/octoooo/saydo/WebPanel.kt:80` |  | apps/android/app/src/main/java/com/octoooo/saydo/WebPanel.kt:80 |
| `apps/harmonyos/entry/src/main/ets/pages/Index.ets:137` |  | apps/harmonyos/entry/src/main/ets/pages/Index.ets:137 |
| `apps/ios/SayDo/NativeBridge.swift:102` |  | apps/ios/SayDo/NativeBridge.swift:102 |
| `apps/ios/SayDo/NativeBridge.swift:149` |  | apps/ios/SayDo/NativeBridge.swift:149 |
| `apps/ios/SayDo/NativeTTSController.swift:33` |  | apps/ios/SayDo/NativeTTSController.swift:33 |
| `apps/ios/SayDo/WebContainer.swift:164` |  | apps/ios/SayDo/WebContainer.swift:164 |
| `apps/ios/SayDo/WebContainer.swift:205` |  | apps/ios/SayDo/WebContainer.swift:205 |
| `apps/ios/SayDo/WebContainer.swift:206` |  | apps/ios/SayDo/WebContainer.swift:206 |
| `apps/ios/SayDo/WebContainer.swift:218` |  | apps/ios/SayDo/WebContainer.swift:218 |
| `apps/ios/SayDo/WebContainer.swift:62` |  | apps/ios/SayDo/WebContainer.swift:62 |
| `apps/ios/SayDo/WebContainer.swift:74` |  | apps/ios/SayDo/WebContainer.swift:74 |
| `apps/ios/SayDoTests/VoiceStateMachineTests.swift:87` |  | apps/ios/SayDoTests/VoiceStateMachineTests.swift:87 |
| `apps/ios/SayDoTests/VoiceStateMachineTests.swift:88` |  | apps/ios/SayDoTests/VoiceStateMachineTests.swift:88 |
| `apps/ios/SayDoTests/VoiceStateMachineTests.swift:89` |  | apps/ios/SayDoTests/VoiceStateMachineTests.swift:89 |
| `e2e/console/console.spec.ts:122` |  | e2e/console/console.spec.ts:122 |
| `e2e/console/console.spec.ts:133` |  | e2e/console/console.spec.ts:133 |
| `e2e/console/console.spec.ts:147` |  | e2e/console/console.spec.ts:147 |
| `e2e/console/console.spec.ts:42` |  | e2e/console/console.spec.ts:42 |
| `e2e/console/console.spec.ts:445` |  | e2e/console/console.spec.ts:445 |
| `e2e/console/console.spec.ts:49` |  | e2e/console/console.spec.ts:49 |
| `e2e/console/focus-costs.spec.ts:11` |  | e2e/console/focus-costs.spec.ts:11 |
| `e2e/console/focus-costs.spec.ts:12` |  | e2e/console/focus-costs.spec.ts:12 |
| `e2e/console/focus-costs.spec.ts:19` |  | e2e/console/focus-costs.spec.ts:19 |
| `e2e/console/focus-costs.spec.ts:20` |  | e2e/console/focus-costs.spec.ts:20 |
| `e2e/console/fortnight-audit.spec.ts:108` |  | e2e/console/fortnight-audit.spec.ts:108 |
| `e2e/console/fortnight-audit.spec.ts:128` |  | e2e/console/fortnight-audit.spec.ts:128 |
| `e2e/console/fortnight-audit.spec.ts:136` |  | e2e/console/fortnight-audit.spec.ts:136 |
| `e2e/console/fortnight-audit.spec.ts:15` |  | e2e/console/fortnight-audit.spec.ts:15 |
| `e2e/console/fortnight-audit.spec.ts:153` |  | e2e/console/fortnight-audit.spec.ts:153 |
| `e2e/console/fortnight-audit.spec.ts:16` |  | e2e/console/fortnight-audit.spec.ts:16 |
| `e2e/console/fortnight-audit.spec.ts:29` |  | e2e/console/fortnight-audit.spec.ts:29 |
| `e2e/console/fortnight-audit.spec.ts:30` |  | e2e/console/fortnight-audit.spec.ts:30 |
| `e2e/console/fortnight-audit.spec.ts:50` |  | e2e/console/fortnight-audit.spec.ts:50 |
| `e2e/console/fortnight-audit.spec.ts:91` |  | e2e/console/fortnight-audit.spec.ts:91 |
| `e2e/console/fortnight-audit.spec.ts:92` |  | e2e/console/fortnight-audit.spec.ts:92 |
| `e2e/console/journey-01-seven-step.spec.ts:185` |  | e2e/console/journey-01-seven-step.spec.ts:185 |
| `e2e/console/journey-01-seven-step.spec.ts:193` |  | e2e/console/journey-01-seven-step.spec.ts:193 |
| `e2e/console/journey-01-seven-step.spec.ts:268` |  | e2e/console/journey-01-seven-step.spec.ts:268 |
| `e2e/console/journey-01-seven-step.spec.ts:34` |  | e2e/console/journey-01-seven-step.spec.ts:34 |
| `e2e/console/journey-01-seven-step.spec.ts:47` |  | e2e/console/journey-01-seven-step.spec.ts:47 |
| `e2e/console/real-entry.spec.ts:124` |  | e2e/console/real-entry.spec.ts:124 |
| `e2e/console/real-entry.spec.ts:126` |  | e2e/console/real-entry.spec.ts:126 |
| `e2e/console/real-entry.spec.ts:127` |  | e2e/console/real-entry.spec.ts:127 |
| `e2e/console/real-entry.spec.ts:128` |  | e2e/console/real-entry.spec.ts:128 |
| `e2e/console/real-entry.spec.ts:159` |  | e2e/console/real-entry.spec.ts:159 |
| `e2e/console/real-entry.spec.ts:199` |  | e2e/console/real-entry.spec.ts:199 |
| `e2e/console/real-entry.spec.ts:218` |  | e2e/console/real-entry.spec.ts:218 |
| `e2e/console/real-entry.spec.ts:244` |  | e2e/console/real-entry.spec.ts:244 |
| `e2e/console/real-entry.spec.ts:258` |  | e2e/console/real-entry.spec.ts:258 |
| `e2e/console/real-entry.spec.ts:267` |  | e2e/console/real-entry.spec.ts:267 |
| `e2e/console/real-entry.spec.ts:314` |  | e2e/console/real-entry.spec.ts:314 |
| `e2e/console/real-entry.spec.ts:320` |  | e2e/console/real-entry.spec.ts:320 |
| `e2e/console/real-entry.spec.ts:333` |  | e2e/console/real-entry.spec.ts:333 |
| `e2e/console/real-entry.spec.ts:334` |  | e2e/console/real-entry.spec.ts:334 |
| `e2e/console/real-entry.spec.ts:360` |  | e2e/console/real-entry.spec.ts:360 |
| `e2e/console/real-entry.spec.ts:390` |  | e2e/console/real-entry.spec.ts:390 |
| `e2e/console/real-entry.spec.ts:420` |  | e2e/console/real-entry.spec.ts:420 |
| `e2e/console/real-entry.spec.ts:460` |  | e2e/console/real-entry.spec.ts:460 |
| `e2e/console/real-entry.spec.ts:492` |  | e2e/console/real-entry.spec.ts:492 |
| `e2e/console/real-entry.spec.ts:510` |  | e2e/console/real-entry.spec.ts:510 |
| `e2e/console/real-entry.spec.ts:61` |  | e2e/console/real-entry.spec.ts:61 |
| `e2e/console/real-entry.spec.ts:62` |  | e2e/console/real-entry.spec.ts:62 |
| `e2e/console/real-entry.spec.ts:63` |  | e2e/console/real-entry.spec.ts:63 |
| `e2e/console/real-entry.spec.ts:68` |  | e2e/console/real-entry.spec.ts:68 |
| `e2e/console/real-entry.spec.ts:82` |  | e2e/console/real-entry.spec.ts:82 |
| `e2e/console/real-entry.spec.ts:89` |  | e2e/console/real-entry.spec.ts:89 |
| `e2e/console/redesign-refresh.spec.ts:23` |  | e2e/console/redesign-refresh.spec.ts:23 |
| `e2e/console/redesign-refresh.spec.ts:35` |  | e2e/console/redesign-refresh.spec.ts:35 |
| `e2e/console/redesign-refresh.spec.ts:64` |  | e2e/console/redesign-refresh.spec.ts:64 |
| `e2e/console/redesign-refresh.spec.ts:65` |  | e2e/console/redesign-refresh.spec.ts:65 |
| `e2e/console/redesign-refresh.spec.ts:82` |  | e2e/console/redesign-refresh.spec.ts:82 |
| `e2e/console/redesign-refresh.spec.ts:94` |  | e2e/console/redesign-refresh.spec.ts:94 |
| `e2e/console/redesign-refresh.spec.ts:95` |  | e2e/console/redesign-refresh.spec.ts:95 |
| `e2e/journey01-browser/journey01-seven-step.spec.ts:369` |  | e2e/journey01-browser/journey01-seven-step.spec.ts:369 |
| `e2e/journey01-browser/run-round.ts:11` |  | e2e/journey01-browser/run-round.ts:11 |
| `e2e/journey01-browser/scripted-llm.ts:193` |  | e2e/journey01-browser/scripted-llm.ts:193 |
| `e2e/journey01-browser/scripted-llm.ts:195` |  | e2e/journey01-browser/scripted-llm.ts:195 |
| `e2e/journey01-browser/scripted-llm.ts:200` |  | e2e/journey01-browser/scripted-llm.ts:200 |
| `e2e/journey01-browser/scripted-llm.ts:259` |  | e2e/journey01-browser/scripted-llm.ts:259 |
| `e2e/journey01-browser/scripted-llm.ts:270` |  | e2e/journey01-browser/scripted-llm.ts:270 |
| `e2e/journey01-browser/scripted-llm.ts:6` |  | e2e/journey01-browser/scripted-llm.ts:6 |
| `e2e/smoke/audio-smoke-5.py:11` |  | e2e/smoke/audio-smoke-5.py:11 |
| `e2e/smoke/audio-smoke-5.py:95` |  | e2e/smoke/audio-smoke-5.py:95 |
| `e2e/spikes/claude-cli-tier1/jsonl_query.py:297` |  | e2e/spikes/claude-cli-tier1/jsonl_query.py:297 |
| `e2e/spikes/claude-cli-tier1/spawn.py:10` |  | e2e/spikes/claude-cli-tier1/spawn.py:10 |
| `e2e/spikes/claude-cli-tier1/spawn.py:205` |  | e2e/spikes/claude-cli-tier1/spawn.py:205 |
| `e2e/spikes/claude-cli-tier1/spawn.py:43` |  | e2e/spikes/claude-cli-tier1/spawn.py:43 |
| `packages/cli/src/cli.ts:11` |  | packages/cli/src/cli.ts:11 |
| `packages/cli/src/cli.ts:13` |  | packages/cli/src/cli.ts:13 |
| `packages/cli/src/cli.ts:7` |  | packages/cli/src/cli.ts:7 |
| `packages/cli/src/options.ts:41` |  | packages/cli/src/options.ts:41 |
| `packages/cli/src/supervisor.ts:145` |  | packages/cli/src/supervisor.ts:145 |
| `packages/cli/src/supervisor.ts:71` |  | packages/cli/src/supervisor.ts:71 |
| `packages/cli/src/supervisor.ts:72` |  | packages/cli/src/supervisor.ts:72 |
| `packages/cli/test/doctor.test.ts:1` |  | packages/cli/test/doctor.test.ts:1 |
| `packages/cli/test/doctor.test.ts:100` |  | packages/cli/test/doctor.test.ts:100 |
| `packages/cli/test/doctor.test.ts:46` |  | packages/cli/test/doctor.test.ts:46 |
| `packages/cli/test/doctor.test.ts:48` |  | packages/cli/test/doctor.test.ts:48 |
| `packages/cli/test/doctor.test.ts:53` |  | packages/cli/test/doctor.test.ts:53 |
| `packages/cli/test/doctor.test.ts:54` |  | packages/cli/test/doctor.test.ts:54 |
| `packages/cli/test/doctor.test.ts:96` |  | packages/cli/test/doctor.test.ts:96 |
| `packages/cli/test/emergency-reaper.test.ts:491` |  | packages/cli/test/emergency-reaper.test.ts:491 |
| `packages/cli/test/emergency-reaper.test.ts:537` |  | packages/cli/test/emergency-reaper.test.ts:537 |
| `packages/cli/test/options.test.ts:3` |  | packages/cli/test/options.test.ts:3 |
| `packages/cli/test/options.test.ts:37` |  | packages/cli/test/options.test.ts:37 |
| `packages/cli/test/options.test.ts:40` |  | packages/cli/test/options.test.ts:40 |
| `packages/cli/test/options.test.ts:44` |  | packages/cli/test/options.test.ts:44 |
| `packages/cli/test/options.test.ts:51` |  | packages/cli/test/options.test.ts:51 |
| `packages/cli/test/options.test.ts:52` |  | packages/cli/test/options.test.ts:52 |
| `packages/cli/test/options.test.ts:53` |  | packages/cli/test/options.test.ts:53 |
| `packages/cli/test/options.test.ts:58` |  | packages/cli/test/options.test.ts:58 |
| `packages/cli/test/options.test.ts:66` |  | packages/cli/test/options.test.ts:66 |
| `packages/cli/test/options.test.ts:67` |  | packages/cli/test/options.test.ts:67 |
| `packages/cli/test/options.test.ts:68` |  | packages/cli/test/options.test.ts:68 |
| `packages/cli/test/options.test.ts:69` |  | packages/cli/test/options.test.ts:69 |
| `packages/cli/test/options.test.ts:70` |  | packages/cli/test/options.test.ts:70 |
| `packages/cli/test/options.test.ts:71` |  | packages/cli/test/options.test.ts:71 |
| `packages/cli/test/options.test.ts:79` |  | packages/cli/test/options.test.ts:79 |
| `packages/cli/test/probe.test.ts:1` |  | packages/cli/test/probe.test.ts:1 |
| `packages/cli/test/probe.test.ts:104` |  | packages/cli/test/probe.test.ts:104 |
| `packages/cli/test/probe.test.ts:122` |  | packages/cli/test/probe.test.ts:122 |
| `packages/cli/test/probe.test.ts:124` |  | packages/cli/test/probe.test.ts:124 |
| `packages/cli/test/probe.test.ts:44` |  | packages/cli/test/probe.test.ts:44 |
| `packages/cli/test/probe.test.ts:46` |  | packages/cli/test/probe.test.ts:46 |
| `packages/cli/test/probe.test.ts:60` |  | packages/cli/test/probe.test.ts:60 |
| `packages/cli/test/probe.test.ts:61` |  | packages/cli/test/probe.test.ts:61 |
| `packages/cli/test/probe.test.ts:64` |  | packages/cli/test/probe.test.ts:64 |
| `packages/cli/test/run-owned-reap.test.ts:1` |  | packages/cli/test/run-owned-reap.test.ts:1 |
| `packages/cli/test/run-owned-reap.test.ts:48` |  | packages/cli/test/run-owned-reap.test.ts:48 |
| `packages/cli/test/run-owned-reap.test.ts:49` |  | packages/cli/test/run-owned-reap.test.ts:49 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:100` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:100 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:101` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:101 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:103` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:103 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:104` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:104 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:110` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:110 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:24` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:24 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:25` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:25 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:29` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:29 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:30` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:30 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:31` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:31 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:32` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:32 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:35` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:35 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:54` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:54 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:55` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:55 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:59` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:59 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:70` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:70 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:76` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:76 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:83` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:83 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:85` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:85 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:96` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:96 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:97` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:97 |
| `packages/console/src/hooks/redesign/sessionTestKit.ts:98` |  | packages/console/src/hooks/redesign/sessionTestKit.ts:98 |
| `packages/console/src/mobile/confirmDecision.ts:44` |  | packages/console/src/mobile/confirmDecision.ts:44 |
| `packages/console/src/mobile/confirmDecision.ts:59` |  | packages/console/src/mobile/confirmDecision.ts:59 |
| `packages/console/src/voice/useVoiceChannel.ts:401` |  | packages/console/src/voice/useVoiceChannel.ts:401 |
| `packages/console/src/voice/useVoiceChannel.ts:560` |  | packages/console/src/voice/useVoiceChannel.ts:560 |
| `packages/console/src/voice/useVoiceChannel.ts:589` |  | packages/console/src/voice/useVoiceChannel.ts:589 |
| `packages/daemon/scripts/demo-sample.ts:33` |  | packages/daemon/scripts/demo-sample.ts:33 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:139` |  | packages/daemon/src/api/recoveryOnlyServer.ts:139 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:300` |  | packages/daemon/src/api/recoveryOnlyServer.ts:300 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:366` |  | packages/daemon/src/api/recoveryOnlyServer.ts:366 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:384` |  | packages/daemon/src/api/recoveryOnlyServer.ts:384 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:385` |  | packages/daemon/src/api/recoveryOnlyServer.ts:385 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:386` |  | packages/daemon/src/api/recoveryOnlyServer.ts:386 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:387` |  | packages/daemon/src/api/recoveryOnlyServer.ts:387 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:389` |  | packages/daemon/src/api/recoveryOnlyServer.ts:389 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:4` |  | packages/daemon/src/api/recoveryOnlyServer.ts:4 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:410` |  | packages/daemon/src/api/recoveryOnlyServer.ts:410 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:424` |  | packages/daemon/src/api/recoveryOnlyServer.ts:424 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:435` |  | packages/daemon/src/api/recoveryOnlyServer.ts:435 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:445` |  | packages/daemon/src/api/recoveryOnlyServer.ts:445 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:455` |  | packages/daemon/src/api/recoveryOnlyServer.ts:455 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:483` |  | packages/daemon/src/api/recoveryOnlyServer.ts:483 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:494` |  | packages/daemon/src/api/recoveryOnlyServer.ts:494 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:500` |  | packages/daemon/src/api/recoveryOnlyServer.ts:500 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:542` |  | packages/daemon/src/api/recoveryOnlyServer.ts:542 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:556` |  | packages/daemon/src/api/recoveryOnlyServer.ts:556 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:642` |  | packages/daemon/src/api/recoveryOnlyServer.ts:642 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:664` |  | packages/daemon/src/api/recoveryOnlyServer.ts:664 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:673` |  | packages/daemon/src/api/recoveryOnlyServer.ts:673 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:698` |  | packages/daemon/src/api/recoveryOnlyServer.ts:698 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:717` |  | packages/daemon/src/api/recoveryOnlyServer.ts:717 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:733` |  | packages/daemon/src/api/recoveryOnlyServer.ts:733 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:789` |  | packages/daemon/src/api/recoveryOnlyServer.ts:789 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:793` |  | packages/daemon/src/api/recoveryOnlyServer.ts:793 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:838` |  | packages/daemon/src/api/recoveryOnlyServer.ts:838 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:882` |  | packages/daemon/src/api/recoveryOnlyServer.ts:882 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:887` |  | packages/daemon/src/api/recoveryOnlyServer.ts:887 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:888` |  | packages/daemon/src/api/recoveryOnlyServer.ts:888 |
| `packages/daemon/src/api/recoveryOnlyServer.ts:890` |  | packages/daemon/src/api/recoveryOnlyServer.ts:890 |
| `packages/daemon/src/api/s3Routes.ts:100` |  | packages/daemon/src/api/s3Routes.ts:100 |
| `packages/daemon/src/api/s3Routes.ts:109` |  | packages/daemon/src/api/s3Routes.ts:109 |
| `packages/daemon/src/api/s3Routes.ts:117` |  | packages/daemon/src/api/s3Routes.ts:117 |
| `packages/daemon/src/api/s3Routes.ts:149` |  | packages/daemon/src/api/s3Routes.ts:149 |
| `packages/daemon/src/api/s3Routes.ts:58` |  | packages/daemon/src/api/s3Routes.ts:58 |
| `packages/daemon/src/api/s3Routes.ts:60` |  | packages/daemon/src/api/s3Routes.ts:60 |
| `packages/daemon/src/api/s3Routes.ts:61` |  | packages/daemon/src/api/s3Routes.ts:61 |
| `packages/daemon/src/api/s3Routes.ts:70` |  | packages/daemon/src/api/s3Routes.ts:70 |
| `packages/daemon/src/api/s3Routes.ts:86` |  | packages/daemon/src/api/s3Routes.ts:86 |
| `packages/daemon/src/brain/liveTools.ts:1054` |  | packages/daemon/src/brain/liveTools.ts:1054 |
| `packages/daemon/src/brain/liveTools.ts:1083` |  | packages/daemon/src/brain/liveTools.ts:1083 |
| `packages/daemon/src/brain/liveTools.ts:1096` |  | packages/daemon/src/brain/liveTools.ts:1096 |
| `packages/daemon/src/brain/liveTools.ts:1115` |  | packages/daemon/src/brain/liveTools.ts:1115 |
| `packages/daemon/src/brain/liveTools.ts:1144` |  | packages/daemon/src/brain/liveTools.ts:1144 |
| `packages/daemon/src/brain/liveTools.ts:1161` |  | packages/daemon/src/brain/liveTools.ts:1161 |
| `packages/daemon/src/brain/liveTools.ts:1195` |  | packages/daemon/src/brain/liveTools.ts:1195 |
| `packages/daemon/src/brain/liveTools.ts:1218` |  | packages/daemon/src/brain/liveTools.ts:1218 |
| `packages/daemon/src/brain/liveTools.ts:1241` |  | packages/daemon/src/brain/liveTools.ts:1241 |
| `packages/daemon/src/brain/liveTools.ts:1284` |  | packages/daemon/src/brain/liveTools.ts:1284 |
| `packages/daemon/src/brain/liveTools.ts:1307` |  | packages/daemon/src/brain/liveTools.ts:1307 |
| `packages/daemon/src/brain/liveTools.ts:1436` |  | packages/daemon/src/brain/liveTools.ts:1436 |
| `packages/daemon/src/brain/liveTools.ts:1474` |  | packages/daemon/src/brain/liveTools.ts:1474 |
| `packages/daemon/src/brain/liveTools.ts:1523` |  | packages/daemon/src/brain/liveTools.ts:1523 |
| `packages/daemon/src/brain/liveTools.ts:1578` |  | packages/daemon/src/brain/liveTools.ts:1578 |
| `packages/daemon/src/brain/liveTools.ts:1605` |  | packages/daemon/src/brain/liveTools.ts:1605 |
| `packages/daemon/src/brain/liveTools.ts:1634` |  | packages/daemon/src/brain/liveTools.ts:1634 |
| `packages/daemon/src/brain/liveTools.ts:1669` |  | packages/daemon/src/brain/liveTools.ts:1669 |
| `packages/daemon/src/brain/liveTools.ts:1726` |  | packages/daemon/src/brain/liveTools.ts:1726 |
| `packages/daemon/src/brain/liveTools.ts:1888` |  | packages/daemon/src/brain/liveTools.ts:1888 |
| `packages/daemon/src/brain/liveTools.ts:2014` |  | packages/daemon/src/brain/liveTools.ts:2014 |
| `packages/daemon/src/brain/liveTools.ts:2064` |  | packages/daemon/src/brain/liveTools.ts:2064 |
| `packages/daemon/src/brain/liveTools.ts:2375` |  | packages/daemon/src/brain/liveTools.ts:2375 |
| `packages/daemon/src/brain/liveTools.ts:2455` |  | packages/daemon/src/brain/liveTools.ts:2455 |
| `packages/daemon/src/brain/liveTools.ts:2580` |  | packages/daemon/src/brain/liveTools.ts:2580 |
| `packages/daemon/src/brain/liveTools.ts:579` |  | packages/daemon/src/brain/liveTools.ts:579 |
| `packages/daemon/src/brain/liveTools.ts:652` |  | packages/daemon/src/brain/liveTools.ts:652 |
| `packages/daemon/src/brain/liveTools.ts:716` |  | packages/daemon/src/brain/liveTools.ts:716 |
| `packages/daemon/src/brain/liveTools.ts:776` |  | packages/daemon/src/brain/liveTools.ts:776 |
| `packages/daemon/src/brain/liveTools.ts:797` |  | packages/daemon/src/brain/liveTools.ts:797 |
| `packages/daemon/src/brain/liveTools.ts:944` |  | packages/daemon/src/brain/liveTools.ts:944 |
| `packages/daemon/src/brain/liveTools.ts:962` |  | packages/daemon/src/brain/liveTools.ts:962 |
| `packages/daemon/src/experimental/codex-app-server/cli.ts:68` |  | packages/daemon/src/experimental/codex-app-server/cli.ts:68 |
| `packages/daemon/src/index.ts:1014` |  | packages/daemon/src/index.ts:1014 |
| `packages/daemon/src/index.ts:1037` |  | packages/daemon/src/index.ts:1037 |
| `packages/daemon/src/index.ts:1051` |  | packages/daemon/src/index.ts:1051 |
| `packages/daemon/src/index.ts:1052` |  | packages/daemon/src/index.ts:1052 |
| `packages/daemon/src/index.ts:1078` |  | packages/daemon/src/index.ts:1078 |
| `packages/daemon/src/index.ts:1132` |  | packages/daemon/src/index.ts:1132 |
| `packages/daemon/src/index.ts:1164` |  | packages/daemon/src/index.ts:1164 |
| `packages/daemon/src/index.ts:1188` |  | packages/daemon/src/index.ts:1188 |
| `packages/daemon/src/index.ts:1199` |  | packages/daemon/src/index.ts:1199 |
| `packages/daemon/src/index.ts:1244` |  | packages/daemon/src/index.ts:1244 |
| `packages/daemon/src/index.ts:1245` |  | packages/daemon/src/index.ts:1245 |
| `packages/daemon/src/index.ts:1246` |  | packages/daemon/src/index.ts:1246 |
| `packages/daemon/src/index.ts:1247` |  | packages/daemon/src/index.ts:1247 |
| `packages/daemon/src/index.ts:1248` |  | packages/daemon/src/index.ts:1248 |
| `packages/daemon/src/index.ts:1249` |  | packages/daemon/src/index.ts:1249 |
| `packages/daemon/src/index.ts:1250` |  | packages/daemon/src/index.ts:1250 |
| `packages/daemon/src/index.ts:1251` |  | packages/daemon/src/index.ts:1251 |
| `packages/daemon/src/index.ts:1253` |  | packages/daemon/src/index.ts:1253 |
| `packages/daemon/src/index.ts:1268` |  | packages/daemon/src/index.ts:1268 |
| `packages/daemon/src/index.ts:1318` |  | packages/daemon/src/index.ts:1318 |
| `packages/daemon/src/index.ts:1323` |  | packages/daemon/src/index.ts:1323 |
| `packages/daemon/src/index.ts:1353` |  | packages/daemon/src/index.ts:1353 |
| `packages/daemon/src/index.ts:1373` |  | packages/daemon/src/index.ts:1373 |
| `packages/daemon/src/index.ts:1413` |  | packages/daemon/src/index.ts:1413 |
| `packages/daemon/src/index.ts:1443` |  | packages/daemon/src/index.ts:1443 |
| `packages/daemon/src/index.ts:1464` |  | packages/daemon/src/index.ts:1464 |
| `packages/daemon/src/index.ts:1563` |  | packages/daemon/src/index.ts:1563 |
| `packages/daemon/src/index.ts:1629` |  | packages/daemon/src/index.ts:1629 |
| `packages/daemon/src/index.ts:163` |  | packages/daemon/src/index.ts:163 |
| `packages/daemon/src/index.ts:1658` |  | packages/daemon/src/index.ts:1658 |
| `packages/daemon/src/index.ts:1694` |  | packages/daemon/src/index.ts:1694 |
| `packages/daemon/src/index.ts:1720` |  | packages/daemon/src/index.ts:1720 |
| `packages/daemon/src/index.ts:1745` |  | packages/daemon/src/index.ts:1745 |
| `packages/daemon/src/index.ts:1769` |  | packages/daemon/src/index.ts:1769 |
| `packages/daemon/src/index.ts:1784` |  | packages/daemon/src/index.ts:1784 |
| `packages/daemon/src/index.ts:1785` |  | packages/daemon/src/index.ts:1785 |
| `packages/daemon/src/index.ts:1786` |  | packages/daemon/src/index.ts:1786 |
| `packages/daemon/src/index.ts:1787` |  | packages/daemon/src/index.ts:1787 |
| `packages/daemon/src/index.ts:1788` |  | packages/daemon/src/index.ts:1788 |
| `packages/daemon/src/index.ts:1789` |  | packages/daemon/src/index.ts:1789 |
| `packages/daemon/src/index.ts:1790` |  | packages/daemon/src/index.ts:1790 |
| `packages/daemon/src/index.ts:1791` |  | packages/daemon/src/index.ts:1791 |
| `packages/daemon/src/index.ts:1792` |  | packages/daemon/src/index.ts:1792 |
| `packages/daemon/src/index.ts:1793` |  | packages/daemon/src/index.ts:1793 |
| `packages/daemon/src/index.ts:1794` |  | packages/daemon/src/index.ts:1794 |
| `packages/daemon/src/index.ts:1795` |  | packages/daemon/src/index.ts:1795 |
| `packages/daemon/src/index.ts:1796` |  | packages/daemon/src/index.ts:1796 |
| `packages/daemon/src/index.ts:1797` |  | packages/daemon/src/index.ts:1797 |
| `packages/daemon/src/index.ts:1798` |  | packages/daemon/src/index.ts:1798 |
| `packages/daemon/src/index.ts:1799` |  | packages/daemon/src/index.ts:1799 |
| `packages/daemon/src/index.ts:1800` |  | packages/daemon/src/index.ts:1800 |
| `packages/daemon/src/index.ts:1801` |  | packages/daemon/src/index.ts:1801 |
| `packages/daemon/src/index.ts:1802` |  | packages/daemon/src/index.ts:1802 |
| `packages/daemon/src/index.ts:1803` |  | packages/daemon/src/index.ts:1803 |
| `packages/daemon/src/index.ts:1805` |  | packages/daemon/src/index.ts:1805 |
| `packages/daemon/src/index.ts:1808` |  | packages/daemon/src/index.ts:1808 |
| `packages/daemon/src/index.ts:1809` |  | packages/daemon/src/index.ts:1809 |
| `packages/daemon/src/index.ts:185` |  | packages/daemon/src/index.ts:185 |
| `packages/daemon/src/index.ts:1877` |  | packages/daemon/src/index.ts:1877 |
| `packages/daemon/src/index.ts:1879` |  | packages/daemon/src/index.ts:1879 |
| `packages/daemon/src/index.ts:2014` |  | packages/daemon/src/index.ts:2014 |
| `packages/daemon/src/index.ts:2040` |  | packages/daemon/src/index.ts:2040 |
| `packages/daemon/src/index.ts:2066` |  | packages/daemon/src/index.ts:2066 |
| `packages/daemon/src/index.ts:2073` |  | packages/daemon/src/index.ts:2073 |
| `packages/daemon/src/index.ts:2077` |  | packages/daemon/src/index.ts:2077 |
| `packages/daemon/src/index.ts:2118` |  | packages/daemon/src/index.ts:2118 |
| `packages/daemon/src/index.ts:2133` |  | packages/daemon/src/index.ts:2133 |
| `packages/daemon/src/index.ts:2135` |  | packages/daemon/src/index.ts:2135 |
| `packages/daemon/src/index.ts:2137` |  | packages/daemon/src/index.ts:2137 |
| `packages/daemon/src/index.ts:2140` |  | packages/daemon/src/index.ts:2140 |
| `packages/daemon/src/index.ts:2149` |  | packages/daemon/src/index.ts:2149 |
| `packages/daemon/src/index.ts:2160` |  | packages/daemon/src/index.ts:2160 |
| `packages/daemon/src/index.ts:2162` |  | packages/daemon/src/index.ts:2162 |
| `packages/daemon/src/index.ts:2196` |  | packages/daemon/src/index.ts:2196 |
| `packages/daemon/src/index.ts:2201` |  | packages/daemon/src/index.ts:2201 |
| `packages/daemon/src/index.ts:2209` |  | packages/daemon/src/index.ts:2209 |
| `packages/daemon/src/index.ts:243` |  | packages/daemon/src/index.ts:243 |
| `packages/daemon/src/index.ts:3407` |  | packages/daemon/src/index.ts:3407 |
| `packages/daemon/src/index.ts:3414` |  | packages/daemon/src/index.ts:3414 |
| `packages/daemon/src/index.ts:3415` |  | packages/daemon/src/index.ts:3415 |
| `packages/daemon/src/index.ts:3417` |  | packages/daemon/src/index.ts:3417 |
| `packages/daemon/src/index.ts:370` |  | packages/daemon/src/index.ts:370 |
| `packages/daemon/src/index.ts:374` |  | packages/daemon/src/index.ts:374 |
| `packages/daemon/src/index.ts:375` |  | packages/daemon/src/index.ts:375 |
| `packages/daemon/src/index.ts:376` |  | packages/daemon/src/index.ts:376 |
| `packages/daemon/src/index.ts:380` |  | packages/daemon/src/index.ts:380 |
| `packages/daemon/src/index.ts:382` |  | packages/daemon/src/index.ts:382 |
| `packages/daemon/src/index.ts:383` |  | packages/daemon/src/index.ts:383 |
| `packages/daemon/src/index.ts:3844` |  | packages/daemon/src/index.ts:3844 |
| `packages/daemon/src/index.ts:3853` |  | packages/daemon/src/index.ts:3853 |
| `packages/daemon/src/index.ts:392` |  | packages/daemon/src/index.ts:392 |
| `packages/daemon/src/index.ts:4` |  | packages/daemon/src/index.ts:4 |
| `packages/daemon/src/index.ts:4088` |  | packages/daemon/src/index.ts:4088 |
| `packages/daemon/src/index.ts:427` |  | packages/daemon/src/index.ts:427 |
| `packages/daemon/src/index.ts:763` |  | packages/daemon/src/index.ts:763 |
| `packages/daemon/src/index.ts:808` |  | packages/daemon/src/index.ts:808 |
| `packages/daemon/src/index.ts:819` |  | packages/daemon/src/index.ts:819 |
| `packages/daemon/src/index.ts:821` |  | packages/daemon/src/index.ts:821 |
| `packages/daemon/src/index.ts:822` |  | packages/daemon/src/index.ts:822 |
| `packages/daemon/src/index.ts:824` |  | packages/daemon/src/index.ts:824 |
| `packages/daemon/src/index.ts:849` |  | packages/daemon/src/index.ts:849 |
| `packages/daemon/src/index.ts:897` |  | packages/daemon/src/index.ts:897 |
| `packages/daemon/src/index.ts:913` |  | packages/daemon/src/index.ts:913 |
| `packages/daemon/src/index.ts:919` |  | packages/daemon/src/index.ts:919 |
| `packages/daemon/src/index.ts:923` |  | packages/daemon/src/index.ts:923 |
| `packages/daemon/src/index.ts:944` |  | packages/daemon/src/index.ts:944 |
| `packages/daemon/src/index.ts:950` |  | packages/daemon/src/index.ts:950 |
| `packages/daemon/src/index.ts:958` |  | packages/daemon/src/index.ts:958 |
| `packages/daemon/src/index.ts:971` |  | packages/daemon/src/index.ts:971 |
| `packages/daemon/src/index.ts:984` |  | packages/daemon/src/index.ts:984 |
| `packages/daemon/src/index.ts:985` |  | packages/daemon/src/index.ts:985 |
| `packages/daemon/src/index.ts:986` |  | packages/daemon/src/index.ts:986 |
| `packages/daemon/src/index.ts:987` |  | packages/daemon/src/index.ts:987 |
| `packages/daemon/src/index.ts:988` |  | packages/daemon/src/index.ts:988 |
| `packages/daemon/src/index.ts:989` |  | packages/daemon/src/index.ts:989 |
| `packages/daemon/src/index.ts:990` |  | packages/daemon/src/index.ts:990 |
| `packages/daemon/src/launchd/cli.ts:516` |  | packages/daemon/src/launchd/cli.ts:516 |
| `packages/daemon/src/launchd/cli.ts:517` |  | packages/daemon/src/launchd/cli.ts:517 |
| `packages/daemon/src/launchd/cli.ts:548` |  | packages/daemon/src/launchd/cli.ts:548 |
| `packages/daemon/src/net/mobileLan.ts:11` |  | packages/daemon/src/net/mobileLan.ts:11 |
| `packages/daemon/src/net/mobileLan.ts:14` |  | packages/daemon/src/net/mobileLan.ts:14 |
| `packages/daemon/src/net/mobileLan.ts:15` |  | packages/daemon/src/net/mobileLan.ts:15 |
| `packages/daemon/src/net/mobileLan.ts:16` |  | packages/daemon/src/net/mobileLan.ts:16 |
| `packages/daemon/src/net/mobileLan.ts:17` |  | packages/daemon/src/net/mobileLan.ts:17 |
| `packages/daemon/src/net/mobileLan.ts:21` |  | packages/daemon/src/net/mobileLan.ts:21 |
| `packages/daemon/src/net/mobileLan.ts:23` |  | packages/daemon/src/net/mobileLan.ts:23 |
| `packages/daemon/src/net/mobileLan.ts:25` |  | packages/daemon/src/net/mobileLan.ts:25 |
| `packages/daemon/src/net/remoteSurface.ts:25` |  | packages/daemon/src/net/remoteSurface.ts:25 |
| `packages/daemon/src/net/remoteSurface.ts:26` |  | packages/daemon/src/net/remoteSurface.ts:26 |
| `packages/daemon/src/net/remoteSurface.ts:36` |  | packages/daemon/src/net/remoteSurface.ts:36 |
| `packages/daemon/src/net/remoteSurface.ts:39` |  | packages/daemon/src/net/remoteSurface.ts:39 |
| `packages/daemon/src/net/remoteSurface.ts:41` |  | packages/daemon/src/net/remoteSurface.ts:41 |
| `packages/daemon/src/net/remoteSurface.ts:42` |  | packages/daemon/src/net/remoteSurface.ts:42 |
| `packages/daemon/src/net/remoteSurface.ts:43` |  | packages/daemon/src/net/remoteSurface.ts:43 |
| `packages/daemon/src/runtimeChildRegistry.ts:383` |  | packages/daemon/src/runtimeChildRegistry.ts:383 |
| `packages/daemon/src/runtimeChildRegistry.ts:384` |  | packages/daemon/src/runtimeChildRegistry.ts:384 |
| `packages/daemon/src/tier1/adapter.ts:56` |  | packages/daemon/src/tier1/adapter.ts:56 |
| `packages/daemon/src/tier1/adapter.ts:62` |  | packages/daemon/src/tier1/adapter.ts:62 |
| `packages/daemon/src/tier1/backends/claude.ts:110` |  | packages/daemon/src/tier1/backends/claude.ts:110 |
| `packages/daemon/src/tier1/backends/claude.ts:44` |  | packages/daemon/src/tier1/backends/claude.ts:44 |
| `packages/daemon/src/tier1/backends/claude.ts:45` |  | packages/daemon/src/tier1/backends/claude.ts:45 |
| `packages/daemon/src/tier1/backends/claude.ts:47` |  | packages/daemon/src/tier1/backends/claude.ts:47 |
| `packages/daemon/src/tier1/backends/claude.ts:48` |  | packages/daemon/src/tier1/backends/claude.ts:48 |
| `packages/daemon/src/tier1/backends/claude.ts:57` |  | packages/daemon/src/tier1/backends/claude.ts:57 |
| `packages/daemon/src/tier1/gateScript.ts:127` |  | packages/daemon/src/tier1/gateScript.ts:127 |
| `packages/daemon/src/tier1/gateScript.ts:131` |  | packages/daemon/src/tier1/gateScript.ts:131 |
| `packages/daemon/src/tier1/gateScript.ts:176` |  | packages/daemon/src/tier1/gateScript.ts:176 |
| `packages/daemon/src/tier1/gateScript.ts:180` |  | packages/daemon/src/tier1/gateScript.ts:180 |
| `packages/daemon/src/tier1/gateScript.ts:323` |  | packages/daemon/src/tier1/gateScript.ts:323 |
| `packages/daemon/src/tier1/gateScript.ts:396` |  | packages/daemon/src/tier1/gateScript.ts:396 |
| `packages/daemon/src/tier1/gateScript.ts:413` |  | packages/daemon/src/tier1/gateScript.ts:413 |
| `packages/daemon/src/tier1/gateScript.ts:425` |  | packages/daemon/src/tier1/gateScript.ts:425 |
| `packages/daemon/src/tier1/gateScript.ts:54` |  | packages/daemon/src/tier1/gateScript.ts:54 |
| `packages/daemon/src/tier1/gateServer.ts:10` |  | packages/daemon/src/tier1/gateServer.ts:10 |
| `packages/daemon/src/tier1/gateServer.ts:100` |  | packages/daemon/src/tier1/gateServer.ts:100 |
| `packages/daemon/src/tier1/gateServer.ts:201` |  | packages/daemon/src/tier1/gateServer.ts:201 |
| `packages/daemon/src/tier1/gateServer.ts:235` |  | packages/daemon/src/tier1/gateServer.ts:235 |
| `packages/daemon/src/tier1/gateServer.ts:237` |  | packages/daemon/src/tier1/gateServer.ts:237 |
| `packages/daemon/src/tier1/gateServer.ts:240` |  | packages/daemon/src/tier1/gateServer.ts:240 |
| `packages/daemon/src/tier1/gateServer.ts:7` |  | packages/daemon/src/tier1/gateServer.ts:7 |
| `packages/daemon/src/tier1/gateServer.ts:93` |  | packages/daemon/src/tier1/gateServer.ts:93 |
| `packages/daemon/src/tier1/gateServer.ts:99` |  | packages/daemon/src/tier1/gateServer.ts:99 |
| `packages/daemon/src/voice/hub.ts:13` |  | packages/daemon/src/voice/hub.ts:13 |
| `packages/daemon/src/voice/hub.ts:186` |  | packages/daemon/src/voice/hub.ts:186 |
| `packages/daemon/src/voice/hub.ts:258` |  | packages/daemon/src/voice/hub.ts:258 |
| `packages/daemon/src/voice/hub.ts:259` |  | packages/daemon/src/voice/hub.ts:259 |
| `packages/daemon/src/voice/hub.ts:302` |  | packages/daemon/src/voice/hub.ts:302 |
| `packages/daemon/src/voice/hub.ts:322` |  | packages/daemon/src/voice/hub.ts:322 |
| `packages/daemon/test/byoa-fake-cli.e2e.test.ts:101` |  | packages/daemon/test/byoa-fake-cli.e2e.test.ts:101 |
| `packages/daemon/test/byoa-fake-cli.e2e.test.ts:156` |  | packages/daemon/test/byoa-fake-cli.e2e.test.ts:156 |
| `packages/daemon/test/byoa-fake-cli.e2e.test.ts:182` |  | packages/daemon/test/byoa-fake-cli.e2e.test.ts:182 |
| `packages/daemon/test/byoa-fake-cli.e2e.test.ts:207` |  | packages/daemon/test/byoa-fake-cli.e2e.test.ts:207 |
| `packages/daemon/test/byoa-fake-cli.e2e.test.ts:230` |  | packages/daemon/test/byoa-fake-cli.e2e.test.ts:230 |
| `packages/daemon/test/byoa-fake-cli.e2e.test.ts:231` |  | packages/daemon/test/byoa-fake-cli.e2e.test.ts:231 |
| `packages/daemon/test/byoa-fake-cli.e2e.test.ts:252` |  | packages/daemon/test/byoa-fake-cli.e2e.test.ts:252 |
| `packages/daemon/test/byoa-fake-cli.e2e.test.ts:275` |  | packages/daemon/test/byoa-fake-cli.e2e.test.ts:275 |
| `packages/daemon/test/callback-email.test.ts:494` |  | packages/daemon/test/callback-email.test.ts:494 |
| `packages/daemon/test/callback-email.test.ts:499` |  | packages/daemon/test/callback-email.test.ts:499 |
| `packages/daemon/test/callback-email.test.ts:6` |  | packages/daemon/test/callback-email.test.ts:6 |
| `packages/daemon/test/codex-app-server/process.test.ts:34` |  | packages/daemon/test/codex-app-server/process.test.ts:34 |
| `packages/daemon/test/console-cost-aggregation.test.ts:11` |  | packages/daemon/test/console-cost-aggregation.test.ts:11 |
| `packages/daemon/test/console-cost-aggregation.test.ts:9` |  | packages/daemon/test/console-cost-aggregation.test.ts:9 |
| `packages/daemon/test/dialog-loop.test.ts:162` |  | packages/daemon/test/dialog-loop.test.ts:162 |
| `packages/daemon/test/dialog-loop.test.ts:174` |  | packages/daemon/test/dialog-loop.test.ts:174 |
| `packages/daemon/test/dialog-loop.test.ts:187` |  | packages/daemon/test/dialog-loop.test.ts:187 |
| `packages/daemon/test/dialog-loop.test.ts:204` |  | packages/daemon/test/dialog-loop.test.ts:204 |
| `packages/daemon/test/dialog-loop.test.ts:205` |  | packages/daemon/test/dialog-loop.test.ts:205 |
| `packages/daemon/test/dialog-loop.test.ts:209` |  | packages/daemon/test/dialog-loop.test.ts:209 |
| `packages/daemon/test/dialog-loop.test.ts:222` |  | packages/daemon/test/dialog-loop.test.ts:222 |
| `packages/daemon/test/dialog-loop.test.ts:223` |  | packages/daemon/test/dialog-loop.test.ts:223 |
| `packages/daemon/test/dialog-loop.test.ts:235` |  | packages/daemon/test/dialog-loop.test.ts:235 |
| `packages/daemon/test/dialog-loop.test.ts:314` |  | packages/daemon/test/dialog-loop.test.ts:314 |
| `packages/daemon/test/dialog-loop.test.ts:331` |  | packages/daemon/test/dialog-loop.test.ts:331 |
| `packages/daemon/test/dialog-loop.test.ts:332` |  | packages/daemon/test/dialog-loop.test.ts:332 |
| `packages/daemon/test/dialog-loop.test.ts:347` |  | packages/daemon/test/dialog-loop.test.ts:347 |
| `packages/daemon/test/dialog-loop.test.ts:365` |  | packages/daemon/test/dialog-loop.test.ts:365 |
| `packages/daemon/test/dialog-loop.test.ts:366` |  | packages/daemon/test/dialog-loop.test.ts:366 |
| `packages/daemon/test/dialog-loop.test.ts:378` |  | packages/daemon/test/dialog-loop.test.ts:378 |
| `packages/daemon/test/dialog-loop.test.ts:393` |  | packages/daemon/test/dialog-loop.test.ts:393 |
| `packages/daemon/test/dialog-loop.test.ts:394` |  | packages/daemon/test/dialog-loop.test.ts:394 |
| `packages/daemon/test/dialog-loop.test.ts:406` |  | packages/daemon/test/dialog-loop.test.ts:406 |
| `packages/daemon/test/dialog-loop.test.ts:99` |  | packages/daemon/test/dialog-loop.test.ts:99 |
| `packages/daemon/test/fixtures/crash-child.ts:8` |  | packages/daemon/test/fixtures/crash-child.ts:8 |
| `packages/daemon/test/fixtures/gate-bind-harness.ts:27` |  | packages/daemon/test/fixtures/gate-bind-harness.ts:27 |
| `packages/daemon/test/fixtures/gate-bind-harness.ts:30` |  | packages/daemon/test/fixtures/gate-bind-harness.ts:30 |
| `packages/daemon/test/fixtures/gate-bind-harness.ts:46` |  | packages/daemon/test/fixtures/gate-bind-harness.ts:46 |
| `packages/daemon/test/fixtures/gate-bind-harness.ts:58` |  | packages/daemon/test/fixtures/gate-bind-harness.ts:58 |
| `packages/daemon/test/fixtures/gate-bind-harness.ts:67` |  | packages/daemon/test/fixtures/gate-bind-harness.ts:67 |
| `packages/daemon/test/fixtures/gate-bind-harness.ts:7` |  | packages/daemon/test/fixtures/gate-bind-harness.ts:7 |
| `packages/daemon/test/fixtures/gate-bind-harness.ts:75` |  | packages/daemon/test/fixtures/gate-bind-harness.ts:75 |
| `packages/daemon/test/fixtures/gate-bind-harness.ts:83` |  | packages/daemon/test/fixtures/gate-bind-harness.ts:83 |
| `packages/daemon/test/fixtures/gate-bind-harness.ts:89` |  | packages/daemon/test/fixtures/gate-bind-harness.ts:89 |
| `packages/daemon/test/fixtures/gate-bind-harness.ts:94` |  | packages/daemon/test/fixtures/gate-bind-harness.ts:94 |
| `packages/daemon/test/fixtures/memory-crash-child.ts:8` |  | packages/daemon/test/fixtures/memory-crash-child.ts:8 |
| `packages/daemon/test/fixtures/startup-entry-harness.ts:111` |  | packages/daemon/test/fixtures/startup-entry-harness.ts:111 |
| `packages/daemon/test/fixtures/startup-entry-harness.ts:113` |  | packages/daemon/test/fixtures/startup-entry-harness.ts:113 |
| `packages/daemon/test/fixtures/startup-entry-harness.ts:16` |  | packages/daemon/test/fixtures/startup-entry-harness.ts:16 |
| `packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:108` |  | packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:108 |
| `packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:325` |  | packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:325 |
| `packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:330` |  | packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:330 |
| `packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:335` |  | packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:335 |
| `packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:337` |  | packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:337 |
| `packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:38` |  | packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:38 |
| `packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:4` |  | packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:4 |
| `packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:43` |  | packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:43 |
| `packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:48` |  | packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:48 |
| `packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:62` |  | packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:62 |
| `packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:86` |  | packages/daemon/test/focus-v04e-screen-a7-a6.test.ts:86 |
| `packages/daemon/test/helpers/daemonProcess.ts:107` |  | packages/daemon/test/helpers/daemonProcess.ts:107 |
| `packages/daemon/test/helpers/daemonProcess.ts:22` |  | packages/daemon/test/helpers/daemonProcess.ts:22 |
| `packages/daemon/test/helpers/daemonProcess.ts:25` |  | packages/daemon/test/helpers/daemonProcess.ts:25 |
| `packages/daemon/test/helpers/daemonProcess.ts:4` |  | packages/daemon/test/helpers/daemonProcess.ts:4 |
| `packages/daemon/test/helpers/playwright-isolation.ts:38` |  | packages/daemon/test/helpers/playwright-isolation.ts:38 |
| `packages/daemon/test/helpers/playwright-isolation.ts:46` |  | packages/daemon/test/helpers/playwright-isolation.ts:46 |
| `packages/daemon/test/helpers/playwright-isolation.ts:5` |  | packages/daemon/test/helpers/playwright-isolation.ts:5 |
| `packages/daemon/test/http-json-body.test.ts:2` |  | packages/daemon/test/http-json-body.test.ts:2 |
| `packages/daemon/test/http-json-body.test.ts:37` |  | packages/daemon/test/http-json-body.test.ts:37 |
| `packages/daemon/test/http-json-body.test.ts:46` |  | packages/daemon/test/http-json-body.test.ts:46 |
| `packages/daemon/test/ownership-anchor.test.ts:124` |  | packages/daemon/test/ownership-anchor.test.ts:124 |
| `packages/daemon/test/playwright-isolation.test.ts:46` |  | packages/daemon/test/playwright-isolation.test.ts:46 |
| `packages/daemon/test/playwright-isolation.test.ts:48` |  | packages/daemon/test/playwright-isolation.test.ts:48 |
| `packages/daemon/test/playwright-isolation.test.ts:51` |  | packages/daemon/test/playwright-isolation.test.ts:51 |
| `packages/daemon/test/playwright-isolation.test.ts:6` |  | packages/daemon/test/playwright-isolation.test.ts:6 |
| `packages/daemon/test/playwright-isolation.test.ts:62` |  | packages/daemon/test/playwright-isolation.test.ts:62 |
| `packages/daemon/test/playwright-setup-failures.test.ts:55` |  | packages/daemon/test/playwright-setup-failures.test.ts:55 |
| `packages/daemon/test/playwright-setup-failures.test.ts:69` |  | packages/daemon/test/playwright-setup-failures.test.ts:69 |
| `packages/daemon/test/recovery-only-json.test.ts:1` |  | packages/daemon/test/recovery-only-json.test.ts:1 |
| `packages/daemon/test/recovery-only-json.test.ts:25` |  | packages/daemon/test/recovery-only-json.test.ts:25 |
| `packages/daemon/test/recovery-only-json.test.ts:27` |  | packages/daemon/test/recovery-only-json.test.ts:27 |
| `packages/daemon/test/recovery-only-json.test.ts:33` |  | packages/daemon/test/recovery-only-json.test.ts:33 |
| `packages/daemon/test/recovery-only-json.test.ts:6` |  | packages/daemon/test/recovery-only-json.test.ts:6 |
| `packages/daemon/test/recovery-only-process.test.ts:1` |  | packages/daemon/test/recovery-only-process.test.ts:1 |
| `packages/daemon/test/recovery-only-process.test.ts:104` |  | packages/daemon/test/recovery-only-process.test.ts:104 |
| `packages/daemon/test/recovery-only-process.test.ts:109` |  | packages/daemon/test/recovery-only-process.test.ts:109 |
| `packages/daemon/test/recovery-only-process.test.ts:121` |  | packages/daemon/test/recovery-only-process.test.ts:121 |
| `packages/daemon/test/recovery-only-process.test.ts:99` |  | packages/daemon/test/recovery-only-process.test.ts:99 |
| `packages/daemon/test/runtime-child-registry.test.ts:162` |  | packages/daemon/test/runtime-child-registry.test.ts:162 |
| `packages/daemon/test/runtime-child-registry.test.ts:188` |  | packages/daemon/test/runtime-child-registry.test.ts:188 |
| `packages/daemon/test/runtime-child-registry.test.ts:238` |  | packages/daemon/test/runtime-child-registry.test.ts:238 |
| `packages/daemon/test/runtime-child-registry.test.ts:258` |  | packages/daemon/test/runtime-child-registry.test.ts:258 |
| `packages/daemon/test/runtime-child-registry.test.ts:286` |  | packages/daemon/test/runtime-child-registry.test.ts:286 |
| `packages/daemon/test/runtime-child-registry.test.ts:314` |  | packages/daemon/test/runtime-child-registry.test.ts:314 |
| `packages/daemon/test/runtime-child-registry.test.ts:737` |  | packages/daemon/test/runtime-child-registry.test.ts:737 |
| `packages/daemon/test/s3-merge-chain.test.ts:214` |  | packages/daemon/test/s3-merge-chain.test.ts:214 |
| `packages/daemon/test/setup.ts:85` |  | packages/daemon/test/setup.ts:85 |
| `packages/daemon/test/startup-failure.test.ts:281` |  | packages/daemon/test/startup-failure.test.ts:281 |
| `packages/daemon/test/startup-failure.test.ts:283` |  | packages/daemon/test/startup-failure.test.ts:283 |
| `packages/daemon/test/startup-failure.test.ts:291` |  | packages/daemon/test/startup-failure.test.ts:291 |
| `packages/daemon/test/startup-failure.test.ts:496` |  | packages/daemon/test/startup-failure.test.ts:496 |
| `packages/daemon/test/startup-failure.test.ts:591` |  | packages/daemon/test/startup-failure.test.ts:591 |
| `packages/daemon/test/t2-thin.test.ts:208` |  | packages/daemon/test/t2-thin.test.ts:208 |
| `packages/daemon/test/t2-thin.test.ts:209` |  | packages/daemon/test/t2-thin.test.ts:209 |
| `packages/daemon/test/t2-thin.test.ts:214` |  | packages/daemon/test/t2-thin.test.ts:214 |
| `packages/daemon/test/t2-thin.test.ts:220` |  | packages/daemon/test/t2-thin.test.ts:220 |
| `packages/daemon/test/t2-thin.test.ts:221` |  | packages/daemon/test/t2-thin.test.ts:221 |
| `packages/daemon/test/t2-thin.test.ts:222` |  | packages/daemon/test/t2-thin.test.ts:222 |
| `packages/daemon/test/tier1-claude-backend.test.ts:106` |  | packages/daemon/test/tier1-claude-backend.test.ts:106 |
| `packages/daemon/test/tier1-claude-backend.test.ts:108` |  | packages/daemon/test/tier1-claude-backend.test.ts:108 |
| `packages/daemon/test/tier1-claude-backend.test.ts:118` |  | packages/daemon/test/tier1-claude-backend.test.ts:118 |
| `packages/daemon/test/tier1-claude-backend.test.ts:80` |  | packages/daemon/test/tier1-claude-backend.test.ts:80 |
| `packages/daemon/test/tier1-claude-backend.test.ts:81` |  | packages/daemon/test/tier1-claude-backend.test.ts:81 |
| `packages/daemon/test/tier1-claude-backend.test.ts:88` |  | packages/daemon/test/tier1-claude-backend.test.ts:88 |
| `packages/daemon/test/tier1-claude-backend.test.ts:90` |  | packages/daemon/test/tier1-claude-backend.test.ts:90 |
| `packages/daemon/test/tier1-claude-backend.test.ts:91` |  | packages/daemon/test/tier1-claude-backend.test.ts:91 |
| `packages/daemon/test/tier1-claude-backend.test.ts:92` |  | packages/daemon/test/tier1-claude-backend.test.ts:92 |
| `packages/daemon/test/tier1-cursor-backend.test.ts:62` |  | packages/daemon/test/tier1-cursor-backend.test.ts:62 |
| `packages/daemon/test/tier1-cursor-backend.test.ts:66` |  | packages/daemon/test/tier1-cursor-backend.test.ts:66 |
| `packages/daemon/test/tier1-cursor-backend.test.ts:72` |  | packages/daemon/test/tier1-cursor-backend.test.ts:72 |
| `packages/daemon/test/tier1-executor.test.ts:2786` |  | packages/daemon/test/tier1-executor.test.ts:2786 |
| `packages/daemon/test/tier1-executor.test.ts:2812` |  | packages/daemon/test/tier1-executor.test.ts:2812 |
| `packages/daemon/test/tier1-executor.test.ts:2814` |  | packages/daemon/test/tier1-executor.test.ts:2814 |
| `packages/daemon/test/tier1-executor.test.ts:5124` |  | packages/daemon/test/tier1-executor.test.ts:5124 |
| `packages/daemon/test/tier1-executor.test.ts:5125` |  | packages/daemon/test/tier1-executor.test.ts:5125 |
| `packages/daemon/test/tier1-gate-loopback.test.ts:112` |  | packages/daemon/test/tier1-gate-loopback.test.ts:112 |
| `packages/daemon/test/tier1-gate-loopback.test.ts:13` |  | packages/daemon/test/tier1-gate-loopback.test.ts:13 |
| `packages/daemon/test/tier1-gate-loopback.test.ts:147` |  | packages/daemon/test/tier1-gate-loopback.test.ts:147 |
| `packages/daemon/test/tier1-gate-loopback.test.ts:40` |  | packages/daemon/test/tier1-gate-loopback.test.ts:40 |
| `packages/daemon/test/tier1-gate-loopback.test.ts:62` |  | packages/daemon/test/tier1-gate-loopback.test.ts:62 |
| `packages/daemon/test/tier1-gate-loopback.test.ts:94` |  | packages/daemon/test/tier1-gate-loopback.test.ts:94 |
| `packages/daemon/test/tier1-gate-socket.test.ts:100` |  | packages/daemon/test/tier1-gate-socket.test.ts:100 |
| `packages/daemon/test/tier1-gate-socket.test.ts:110` |  | packages/daemon/test/tier1-gate-socket.test.ts:110 |
| `packages/daemon/test/tier1-gate-socket.test.ts:123` |  | packages/daemon/test/tier1-gate-socket.test.ts:123 |
| `packages/daemon/test/tier1-gate-socket.test.ts:155` |  | packages/daemon/test/tier1-gate-socket.test.ts:155 |
| `packages/daemon/test/tier1-gate-socket.test.ts:195` |  | packages/daemon/test/tier1-gate-socket.test.ts:195 |
| `packages/daemon/test/tier1-gate-socket.test.ts:196` |  | packages/daemon/test/tier1-gate-socket.test.ts:196 |
| `packages/daemon/test/tier1-gate-socket.test.ts:200` |  | packages/daemon/test/tier1-gate-socket.test.ts:200 |
| `packages/daemon/test/tier1-gate-socket.test.ts:250` |  | packages/daemon/test/tier1-gate-socket.test.ts:250 |
| `packages/daemon/test/tier1-gate-socket.test.ts:251` |  | packages/daemon/test/tier1-gate-socket.test.ts:251 |
| `packages/daemon/test/tier1-gate-socket.test.ts:254` |  | packages/daemon/test/tier1-gate-socket.test.ts:254 |
| `packages/daemon/test/tier1-gate-socket.test.ts:30` |  | packages/daemon/test/tier1-gate-socket.test.ts:30 |
| `packages/daemon/test/tier1-gate-socket.test.ts:428` |  | packages/daemon/test/tier1-gate-socket.test.ts:428 |
| `packages/daemon/test/tier1-gate-socket.test.ts:429` |  | packages/daemon/test/tier1-gate-socket.test.ts:429 |
| `packages/daemon/test/tier1-gate-socket.test.ts:438` |  | packages/daemon/test/tier1-gate-socket.test.ts:438 |
| `packages/daemon/test/tier1-gate-socket.test.ts:479` |  | packages/daemon/test/tier1-gate-socket.test.ts:479 |
| `packages/daemon/test/tier1-gate-socket.test.ts:53` |  | packages/daemon/test/tier1-gate-socket.test.ts:53 |
| `packages/daemon/test/tier1-gate-socket.test.ts:647` |  | packages/daemon/test/tier1-gate-socket.test.ts:647 |
| `packages/daemon/test/tier1-gate-socket.test.ts:70` |  | packages/daemon/test/tier1-gate-socket.test.ts:70 |
| `packages/daemon/test/tier1-gate-socket.test.ts:91` |  | packages/daemon/test/tier1-gate-socket.test.ts:91 |
| `packages/daemon/test/tier1-gate-socket.test.ts:92` |  | packages/daemon/test/tier1-gate-socket.test.ts:92 |
| `packages/daemon/test/tier1-live.e2e.test.ts:100` |  | packages/daemon/test/tier1-live.e2e.test.ts:100 |
| `packages/daemon/test/tier1-live.e2e.test.ts:216` |  | packages/daemon/test/tier1-live.e2e.test.ts:216 |
| `packages/daemon/test/tier1-live.e2e.test.ts:24` |  | packages/daemon/test/tier1-live.e2e.test.ts:24 |
| `packages/daemon/test/tier1-security.test.ts:263` |  | packages/daemon/test/tier1-security.test.ts:263 |
| `packages/daemon/test/tier1-security.test.ts:265` |  | packages/daemon/test/tier1-security.test.ts:265 |
| `packages/daemon/test/tier1-security.test.ts:266` |  | packages/daemon/test/tier1-security.test.ts:266 |
| `packages/daemon/test/voice-barrier.test.ts:106` |  | packages/daemon/test/voice-barrier.test.ts:106 |
| `packages/daemon/test/voice-barrier.test.ts:3` |  | packages/daemon/test/voice-barrier.test.ts:3 |
| `packages/daemon/test/voice-barrier.test.ts:41` |  | packages/daemon/test/voice-barrier.test.ts:41 |
| `packages/daemon/test/voice-barrier.test.ts:44` |  | packages/daemon/test/voice-barrier.test.ts:44 |
| `packages/daemon/test/voice-barrier.test.ts:59` |  | packages/daemon/test/voice-barrier.test.ts:59 |
| `packages/daemon/test/voice-barrier.test.ts:81` |  | packages/daemon/test/voice-barrier.test.ts:81 |
| `packages/daemon/test/voice-handover-privacy.test.ts:1` |  | packages/daemon/test/voice-handover-privacy.test.ts:1 |
| `packages/daemon/test/voice-handover-privacy.test.ts:15` |  | packages/daemon/test/voice-handover-privacy.test.ts:15 |
| `packages/daemon/test/voice-hf-round-production.test.ts:158` |  | packages/daemon/test/voice-hf-round-production.test.ts:158 |
| `packages/daemon/test/voice-hf-round-production.test.ts:179` |  | packages/daemon/test/voice-hf-round-production.test.ts:179 |
| `packages/daemon/test/voice-hf-round-production.test.ts:4` |  | packages/daemon/test/voice-hf-round-production.test.ts:4 |
| `packages/daemon/test/voice-hf-round-production.test.ts:45` |  | packages/daemon/test/voice-hf-round-production.test.ts:45 |
| `packages/daemon/test/voice-hf-round-production.test.ts:67` |  | packages/daemon/test/voice-hf-round-production.test.ts:67 |
| `packages/daemon/test/voice-hf-round-production.test.ts:97` |  | packages/daemon/test/voice-hf-round-production.test.ts:97 |
| `packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:102` |  | packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:102 |
| `packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:130` |  | packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:130 |
| `packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:133` |  | packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:133 |
| `packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:267` |  | packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:267 |
| `packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:4` |  | packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:4 |
| `packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:51` |  | packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:51 |
| `packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:693` |  | packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:693 |
| `packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:73` |  | packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:73 |
| `packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:896` |  | packages/daemon/test/voice-hf-terminal-lifecycle.test.ts:896 |
| `packages/daemon/test/voice-hub-dialog-settle.e2e.test.ts:120` |  | packages/daemon/test/voice-hub-dialog-settle.e2e.test.ts:120 |
| `packages/daemon/test/voice-hub-dialog-settle.e2e.test.ts:136` |  | packages/daemon/test/voice-hub-dialog-settle.e2e.test.ts:136 |
| `packages/daemon/test/voice-hub-dialog-settle.e2e.test.ts:4` |  | packages/daemon/test/voice-hub-dialog-settle.e2e.test.ts:4 |
| `packages/daemon/test/voice-hub-dialog-settle.e2e.test.ts:44` |  | packages/daemon/test/voice-hub-dialog-settle.e2e.test.ts:44 |
| `packages/daemon/test/voice-hub-dialog-settle.e2e.test.ts:66` |  | packages/daemon/test/voice-hub-dialog-settle.e2e.test.ts:66 |
| `packages/daemon/test/voice-hub.test.ts:1004` |  | packages/daemon/test/voice-hub.test.ts:1004 |
| `packages/daemon/test/voice-hub.test.ts:1007` |  | packages/daemon/test/voice-hub.test.ts:1007 |
| `packages/daemon/test/voice-hub.test.ts:1026` |  | packages/daemon/test/voice-hub.test.ts:1026 |
| `packages/daemon/test/voice-hub.test.ts:1027` |  | packages/daemon/test/voice-hub.test.ts:1027 |
| `packages/daemon/test/voice-hub.test.ts:103` |  | packages/daemon/test/voice-hub.test.ts:103 |
| `packages/daemon/test/voice-hub.test.ts:1117` |  | packages/daemon/test/voice-hub.test.ts:1117 |
| `packages/daemon/test/voice-hub.test.ts:1119` |  | packages/daemon/test/voice-hub.test.ts:1119 |
| `packages/daemon/test/voice-hub.test.ts:1140` |  | packages/daemon/test/voice-hub.test.ts:1140 |
| `packages/daemon/test/voice-hub.test.ts:1142` |  | packages/daemon/test/voice-hub.test.ts:1142 |
| `packages/daemon/test/voice-hub.test.ts:1155` |  | packages/daemon/test/voice-hub.test.ts:1155 |
| `packages/daemon/test/voice-hub.test.ts:1157` |  | packages/daemon/test/voice-hub.test.ts:1157 |
| `packages/daemon/test/voice-hub.test.ts:1176` |  | packages/daemon/test/voice-hub.test.ts:1176 |
| `packages/daemon/test/voice-hub.test.ts:1204` |  | packages/daemon/test/voice-hub.test.ts:1204 |
| `packages/daemon/test/voice-hub.test.ts:1226` |  | packages/daemon/test/voice-hub.test.ts:1226 |
| `packages/daemon/test/voice-hub.test.ts:1244` |  | packages/daemon/test/voice-hub.test.ts:1244 |
| `packages/daemon/test/voice-hub.test.ts:130` |  | packages/daemon/test/voice-hub.test.ts:130 |
| `packages/daemon/test/voice-hub.test.ts:170` |  | packages/daemon/test/voice-hub.test.ts:170 |
| `packages/daemon/test/voice-hub.test.ts:244` |  | packages/daemon/test/voice-hub.test.ts:244 |
| `packages/daemon/test/voice-hub.test.ts:298` |  | packages/daemon/test/voice-hub.test.ts:298 |
| `packages/daemon/test/voice-hub.test.ts:3` |  | packages/daemon/test/voice-hub.test.ts:3 |
| `packages/daemon/test/voice-hub.test.ts:47` |  | packages/daemon/test/voice-hub.test.ts:47 |
| `packages/daemon/test/voice-hub.test.ts:49` |  | packages/daemon/test/voice-hub.test.ts:49 |
| `packages/daemon/test/voice-hub.test.ts:490` |  | packages/daemon/test/voice-hub.test.ts:490 |
| `packages/daemon/test/voice-hub.test.ts:501` |  | packages/daemon/test/voice-hub.test.ts:501 |
| `packages/daemon/test/voice-hub.test.ts:653` |  | packages/daemon/test/voice-hub.test.ts:653 |
| `packages/daemon/test/voice-hub.test.ts:656` |  | packages/daemon/test/voice-hub.test.ts:656 |
| `packages/daemon/test/voice-hub.test.ts:67` |  | packages/daemon/test/voice-hub.test.ts:67 |
| `packages/daemon/test/voice-hub.test.ts:747` |  | packages/daemon/test/voice-hub.test.ts:747 |
| `packages/daemon/test/voice-hub.test.ts:751` |  | packages/daemon/test/voice-hub.test.ts:751 |
| `packages/daemon/test/voice-hub.test.ts:754` |  | packages/daemon/test/voice-hub.test.ts:754 |
| `packages/daemon/test/voice-hub.test.ts:83` |  | packages/daemon/test/voice-hub.test.ts:83 |
| `packages/daemon/test/voice-hub.test.ts:899` |  | packages/daemon/test/voice-hub.test.ts:899 |
| `packages/daemon/test/voice-hub.test.ts:904` |  | packages/daemon/test/voice-hub.test.ts:904 |
| `packages/daemon/test/voice-ptt-quiesce-ownership.test.ts:127` |  | packages/daemon/test/voice-ptt-quiesce-ownership.test.ts:127 |
| `packages/daemon/test/voice-ptt-quiesce-ownership.test.ts:166` |  | packages/daemon/test/voice-ptt-quiesce-ownership.test.ts:166 |
| `packages/daemon/test/voice-ptt-quiesce-ownership.test.ts:169` |  | packages/daemon/test/voice-ptt-quiesce-ownership.test.ts:169 |
| `packages/daemon/test/voice-ptt-quiesce-ownership.test.ts:4` |  | packages/daemon/test/voice-ptt-quiesce-ownership.test.ts:4 |
| `packages/daemon/test/voice-ptt-quiesce-ownership.test.ts:46` |  | packages/daemon/test/voice-ptt-quiesce-ownership.test.ts:46 |
| `packages/daemon/test/voice-ptt-quiesce-ownership.test.ts:68` |  | packages/daemon/test/voice-ptt-quiesce-ownership.test.ts:68 |
| `packages/daemon/test/voice-ptt-quiesce-ownership.test.ts:97` |  | packages/daemon/test/voice-ptt-quiesce-ownership.test.ts:97 |
| `packages/platform/src/gate.ts:100` |  | packages/platform/src/gate.ts:100 |
| `packages/platform/src/gate.ts:101` |  | packages/platform/src/gate.ts:101 |
| `packages/platform/src/gate.ts:2` |  | packages/platform/src/gate.ts:2 |
| `packages/platform/src/gate.ts:209` |  | packages/platform/src/gate.ts:209 |
| `packages/platform/src/gate.ts:66` |  | packages/platform/src/gate.ts:66 |
| `packages/platform/src/gate.ts:94` |  | packages/platform/src/gate.ts:94 |
| `packages/platform/src/index.ts:128` |  | packages/platform/src/index.ts:128 |
| `packages/platform/src/win32.ts:2327` |  | packages/platform/src/win32.ts:2327 |
| `packages/platform/src/win32.ts:2330` |  | packages/platform/src/win32.ts:2330 |
| `packages/platform/src/win32.ts:2350` |  | packages/platform/src/win32.ts:2350 |
| `packages/platform/src/win32.ts:6` |  | packages/platform/src/win32.ts:6 |
| `packages/platform/test/gate.test.ts:21` |  | packages/platform/test/gate.test.ts:21 |
| `packages/platform/test/gate.test.ts:27` |  | packages/platform/test/gate.test.ts:27 |
| `packages/platform/test/gate.test.ts:7` |  | packages/platform/test/gate.test.ts:7 |
| `pipeline/spikes/pipecat_interrupt_spike.py:121` |  | pipeline/spikes/pipecat_interrupt_spike.py:121 |
| `pipeline/src/saydo_pipeline/__main__.py:176` |  | pipeline/src/saydo_pipeline/__main__.py:176 |
| `pipeline/src/saydo_pipeline/doubao_asr.py:134` |  | pipeline/src/saydo_pipeline/doubao_asr.py:134 |
| `pipeline/src/saydo_pipeline/doubao_asr.py:136` |  | pipeline/src/saydo_pipeline/doubao_asr.py:136 |
| `pipeline/src/saydo_pipeline/doubao_asr.py:150` |  | pipeline/src/saydo_pipeline/doubao_asr.py:150 |
| `pipeline/src/saydo_pipeline/doubao_tts.py:111` |  | pipeline/src/saydo_pipeline/doubao_tts.py:111 |
| `pipeline/src/saydo_pipeline/doubao_tts.py:114` |  | pipeline/src/saydo_pipeline/doubao_tts.py:114 |
| `pipeline/src/saydo_pipeline/doubao_tts.py:142` |  | pipeline/src/saydo_pipeline/doubao_tts.py:142 |
| `pipeline/src/saydo_pipeline/doubao_tts.py:151` |  | pipeline/src/saydo_pipeline/doubao_tts.py:151 |
| `pipeline/src/saydo_pipeline/hub_client.py:262` |  | pipeline/src/saydo_pipeline/hub_client.py:262 |
| `pipeline/src/saydo_pipeline/hub_client.py:271` |  | pipeline/src/saydo_pipeline/hub_client.py:271 |
| `pipeline/src/saydo_pipeline/hub_client.py:278` |  | pipeline/src/saydo_pipeline/hub_client.py:278 |
| `research/native-preparation/test_bounded_read.py:229` |  | research/native-preparation/test_bounded_read.py:229 |
| `research/voice-runtime-20260923/probe_tts_interruption.py:60` |  | research/voice-runtime-20260923/probe_tts_interruption.py:60 |
| `scripts/audit-local-week.py:3` |  | scripts/audit-local-week.py:3 |
| `scripts/audit-local-week.py:69` |  | scripts/audit-local-week.py:69 |
| `scripts/audit-local-week.py:70` |  | scripts/audit-local-week.py:70 |
| `scripts/release-openat-posix.py:396` |  | scripts/release-openat-posix.py:396 |

## http_routes (87)

| id | detail | sources |
|---|---|---|
| `ANY /api/*` | ANY prefix | packages/daemon/src/api/recoveryOnlyServer.ts:424 |
| `ANY /api/s3/*` | ANY prefix | packages/daemon/src/api/s3Routes.ts:61; packages/daemon/src/index.ts:1014 |
| `ANY /api/setup/*` | ANY prefix | packages/daemon/src/api/recoveryOnlyServer.ts:455 |
| `ANY /api/tasks/:id/approve-merge` | ANY regex | packages/daemon/src/api/s3Routes.ts:60; packages/daemon/src/index.ts:1014 |
| `ANY /dev/*` | ANY prefix | packages/daemon/src/index.ts:897 |
| `ANY /health` | ANY literal | packages/daemon/src/api/recoveryOnlyServer.ts:387; packages/daemon/src/index.ts:383; packages/daemon/src/index.ts:822 |
| `ANY /readyz` | ANY literal | packages/daemon/src/api/recoveryOnlyServer.ts:410; packages/daemon/src/index.ts:849 |
| `DELETE /api/session/:id/task-context` | DELETE regex | packages/daemon/src/index.ts:2040 |
| `GET /api/approvals` | GET literal | packages/daemon/src/index.ts:2120 |
| `GET /api/artifacts/:id/diff` | GET regex | packages/daemon/src/index.ts:2140 |
| `GET /api/artifacts/:id/versions/:id` | GET regex | packages/daemon/src/index.ts:1199 |
| `GET /api/attention` | GET literal | packages/daemon/src/index.ts:2174; packages/daemon/src/net/mobileLan.ts:14; packages/daemon/src/net/mobileLan.ts:14 |
| `GET /api/config` | GET literal | packages/daemon/src/index.ts:2214 |
| `GET /api/costs` | GET literal | packages/daemon/src/index.ts:2132 |
| `GET /api/desktop/summary` | GET literal | packages/daemon/src/api/recoveryOnlyServer.ts:445; packages/daemon/src/index.ts:2181 |
| `GET /api/focuses` | GET literal | packages/daemon/src/index.ts:2165; packages/daemon/src/net/mobileLan.ts:15; packages/daemon/src/net/mobileLan.ts:15 |
| `GET /api/focuses/:id` | GET regex | packages/daemon/src/index.ts:2201; packages/daemon/src/net/mobileLan.ts:21 |
| `GET /api/focuses/:id/activations/:id/transcript` | GET regex | packages/daemon/src/index.ts:1188 |
| `GET /api/focuses/:id/artifacts` | GET regex | packages/daemon/src/index.ts:2209 |
| `GET /api/focuses/:id/sessions` | GET regex | packages/daemon/src/index.ts:2196 |
| `GET /api/focuses/:id/timeline` | GET regex | packages/daemon/src/index.ts:1164 |
| `GET /api/memory/recent` | GET literal | packages/daemon/src/index.ts:2178; packages/daemon/src/net/mobileLan.ts:17; packages/daemon/src/net/mobileLan.ts:17 |
| `GET /api/obligations` | GET literal | packages/daemon/src/index.ts:2167 |
| `GET /api/outbox` | GET literal | packages/daemon/src/index.ts:2131 |
| `GET /api/overview` | GET literal | packages/daemon/src/index.ts:2119 |
| `GET /api/pairing-info` | GET literal | packages/daemon/src/index.ts:1052 |
| `GET /api/projects/:id/artifacts` | GET regex | packages/daemon/src/index.ts:2137 |
| `GET /api/projects/:id/artifacts/export` | GET regex | packages/daemon/src/index.ts:2149 |
| `GET /api/projects/:id/memory` | GET regex | packages/daemon/src/index.ts:2135; packages/daemon/src/net/mobileLan.ts:23 |
| `GET /api/projects/:id/settings` | GET regex | packages/daemon/src/index.ts:2160 |
| `GET /api/projects/:id/tasks` | GET regex | packages/daemon/src/index.ts:2133 |
| `GET /api/sessions/recent-transcript` | GET literal | packages/daemon/src/index.ts:2175; packages/daemon/src/net/mobileLan.ts:16; packages/daemon/src/net/mobileLan.ts:16 |
| `GET /api/setup/cli-capability` | GET literal | packages/daemon/src/api/recoveryOnlyServer.ts:494; packages/daemon/src/index.ts:1132 |
| `GET /api/setup/probe` | GET literal | packages/daemon/src/api/recoveryOnlyServer.ts:483; packages/daemon/src/index.ts:1078 |
| `GET /api/setup/project-overrides/invalid` | GET literal | packages/daemon/src/api/recoveryOnlyServer.ts:500 |
| `GET /api/spaces` | GET literal | packages/daemon/src/index.ts:2208 |
| `GET /api/tasks/:id` | GET regex | packages/daemon/src/index.ts:2162 |
| `GET /api/value-report` | GET literal | packages/daemon/src/index.ts:2216 |
| `GET /dev/latency-report` | GET literal | packages/daemon/src/index.ts:944 |
| `POST /api/approvals/:id/decide` | POST regex | packages/daemon/src/index.ts:1563 |
| `POST /api/artifacts/:id/realize` | POST regex | packages/daemon/src/index.ts:1800 |
| `POST /api/attention/:id/ack` | POST regex | packages/daemon/src/index.ts:1805 |
| `POST /api/focuses` | POST literal | packages/daemon/src/index.ts:1809; packages/daemon/src/index.ts:1879 |
| `POST /api/focuses/:id/abandon` | POST regex | packages/daemon/src/index.ts:1789 |
| `POST /api/focuses/:id/archive` | POST regex | packages/daemon/src/index.ts:1788 |
| `POST /api/focuses/:id/artifacts` | POST regex | packages/daemon/src/index.ts:1787 |
| `POST /api/focuses/:id/expectations/:id/adjust` | POST regex | packages/daemon/src/index.ts:1801 |
| `POST /api/focuses/:id/expectations/:id/withdraw` | POST regex | packages/daemon/src/index.ts:1802 |
| `POST /api/focuses/:id/fork` | POST regex | packages/daemon/src/index.ts:1791 |
| `POST /api/focuses/:id/lanes` | POST regex | packages/daemon/src/index.ts:1793 |
| `POST /api/focuses/:id/lanes/:id/redo-from` | POST regex | packages/daemon/src/index.ts:1796 |
| `POST /api/focuses/:id/lanes/:id/retire` | POST regex | packages/daemon/src/index.ts:1794 |
| `POST /api/focuses/:id/lanes/:id/unretire` | POST regex | packages/daemon/src/index.ts:1795 |
| `POST /api/focuses/:id/reopen` | POST regex | packages/daemon/src/index.ts:1790 |
| `POST /api/focuses/:id/space` | POST regex | packages/daemon/src/index.ts:1786 |
| `POST /api/memory/:id/approve` | POST regex | packages/daemon/src/index.ts:1629 |
| `POST /api/memory/:id/reject` | POST regex | packages/daemon/src/index.ts:1629 |
| `POST /api/obligations/:id/defer` | POST regex | packages/daemon/src/index.ts:1799 |
| `POST /api/obligations/:id/resolve` | POST regex | packages/daemon/src/index.ts:1797 |
| `POST /api/obligations/:id/waiting-on` | POST regex | packages/daemon/src/index.ts:1798 |
| `POST /api/outbox/:id/ack` | POST regex | packages/daemon/src/index.ts:1769 |
| `POST /api/projects/:id/foundation/bootstrap` | POST regex | packages/daemon/src/index.ts:1694 |
| `POST /api/projects/:id/settings/overrides` | POST regex | packages/daemon/src/index.ts:1658 |
| `POST /api/s3/challenge` | POST literal | packages/daemon/src/api/s3Routes.ts:100 |
| `POST /api/s3/register` | POST literal | packages/daemon/src/api/s3Routes.ts:109 |
| `POST /api/s3/status` | POST literal | packages/daemon/src/api/s3Routes.ts:86 |
| `POST /api/s3/verify` | POST literal | packages/daemon/src/api/s3Routes.ts:117 |
| `POST /api/session/:id/task-context` | POST regex | packages/daemon/src/index.ts:1792 |
| `POST /api/sessions/:id/focus-anchor` | POST regex | packages/daemon/src/index.ts:1803 |
| `POST /api/setup/cli-capability/confirm` | POST literal | packages/daemon/src/api/recoveryOnlyServer.ts:717; packages/daemon/src/index.ts:989; packages/daemon/src/index.ts:1250 +1 |
| `POST /api/setup/cli-capability/reprobe` | POST literal | packages/daemon/src/api/recoveryOnlyServer.ts:698; packages/daemon/src/index.ts:990; packages/daemon/src/index.ts:1251 +1 |
| `POST /api/setup/config` | POST literal | packages/daemon/src/api/recoveryOnlyServer.ts:642; packages/daemon/src/index.ts:984; packages/daemon/src/index.ts:1244 +1 |
| `POST /api/setup/first-run/query` | POST literal | packages/daemon/src/api/recoveryOnlyServer.ts:542; packages/daemon/src/index.ts:1249; packages/daemon/src/index.ts:1268 +2 |
| `POST /api/setup/project-overrides/clear-invalid` | POST literal | packages/daemon/src/api/recoveryOnlyServer.ts:556; packages/daemon/src/index.ts:988; packages/daemon/src/index.ts:1248 +1 |
| `POST /api/setup/restart` | POST literal | packages/daemon/src/api/recoveryOnlyServer.ts:733; packages/daemon/src/index.ts:987; packages/daemon/src/index.ts:1247 +1 |
| `POST /api/setup/secret` | POST literal | packages/daemon/src/api/recoveryOnlyServer.ts:664; packages/daemon/src/index.ts:985; packages/daemon/src/index.ts:1245 +1 |
| `POST /api/setup/test` | POST literal | packages/daemon/src/api/recoveryOnlyServer.ts:673; packages/daemon/src/index.ts:986; packages/daemon/src/index.ts:1246 +1 |
| `POST /api/spaces` | POST literal | packages/daemon/src/index.ts:1808; packages/daemon/src/index.ts:1877 |
| `POST /api/spaces/:id/delete` | POST regex | packages/daemon/src/index.ts:1785 |
| `POST /api/spaces/:id/rename` | POST regex | packages/daemon/src/index.ts:1784 |
| `POST /api/tasks/:id/:action` | POST regex | packages/daemon/src/index.ts:2014 |
| `POST /api/tasks/:id/explain` | POST regex | packages/daemon/src/index.ts:1745 |
| `POST /api/value-report/manual` | POST literal | packages/daemon/src/index.ts:1720 |
| `POST /dev/inject` | POST literal | packages/daemon/src/index.ts:919 |
| `POST /dev/say` | POST literal | packages/daemon/src/index.ts:919; packages/daemon/src/index.ts:923 |
| `POST /dev/seed-fixture` | POST literal | packages/daemon/src/index.ts:913 |
| `POST /gate` | POST literal | packages/daemon/src/tier1/gateServer.ts:100; packages/platform/src/gate.ts:101 |

## ws_messages (35)

| id | detail | sources |
|---|---|---|
| `asr.final` |  | packages/contracts/src/types/pipeline.ts:48; packages/contracts/src/types/pipeline.ts:78; packages/contracts/src/types/pipeline.ts:88 +8 |
| `asr.hotwords` |  | packages/contracts/src/types/pipeline.ts:416; packages/daemon/src/voice/hub.ts:1166 |
| `asr.partial` |  | packages/contracts/src/types/pipeline.ts:286 |
| `audio.frame` |  | packages/contracts/src/types/pipeline.ts:284 |
| `barge_in` |  | packages/console/src/voice/useVoiceChannel.ts:483; packages/contracts/src/types/pipeline.ts:314; packages/daemon/src/voice/hub.ts:75 |
| `confirm.card` |  | packages/contracts/src/types/pipeline.ts:353; packages/daemon/src/index.ts:2657; packages/daemon/src/index.ts:3138 +1 |
| `confirm.click` |  | packages/console/src/voice/useVoiceChannel.ts:1297; packages/contracts/src/types/pipeline.ts:389; packages/daemon/src/voice/hub.ts:81 |
| `confirm.countdown` |  | packages/contracts/src/types/pipeline.ts:365; packages/daemon/src/index.ts:2876 |
| `confirm.decision` |  | packages/console/src/mobile/confirmDecision.ts:9; packages/console/src/mobile/confirmDecision.ts:64; packages/contracts/src/types/pipeline.ts:396 +1 |
| `confirm.resolved` |  | packages/contracts/src/types/pipeline.ts:371; packages/daemon/src/index.ts:2668; packages/daemon/src/index.ts:3105 +1 |
| `console.heartbeat` |  | packages/console/src/voice/useVoiceChannel.ts:569; packages/console/src/voice/useVoiceChannel.ts:643; packages/contracts/src/types/pipeline.ts:442 +1 |
| `focus.entity` |  | packages/contracts/src/types/pipeline.ts:377; packages/daemon/src/index.ts:2385; packages/daemon/src/index.ts:2881 +2 |
| `hello` |  | pipeline/src/saydo_pipeline/hub_client.py:0 |
| `hello.ack` |  | packages/contracts/src/types/voiceBarrier.ts:113; packages/daemon/src/voice/hub.ts:493; packages/daemon/src/voice/hub.ts:534 |
| `latency.stage` |  | packages/contracts/src/types/pipeline.ts:409; packages/daemon/src/voice/hub.ts:93; pipeline/src/saydo_pipeline/hub_client.py:1223 |
| `native.reply` |  | packages/console/src/voice/useVoiceChannel.ts:58; packages/contracts/src/types/pipeline.ts:300; packages/daemon/src/voice/hub.ts:1112 +3 |
| `pipeline.health` |  | packages/contracts/src/types/pipeline.ts:420; packages/daemon/src/voice/hub.ts:89; packages/daemon/src/voice/hub.ts:575 +5 |
| `pipeline.restart_ack` |  | packages/contracts/src/types/pipeline.ts:432; pipeline/src/saydo_pipeline/hub_client.py:504 |
| `pipeline.restart_pending` |  | packages/contracts/src/types/pipeline.ts:428; packages/daemon/src/voice/hub.ts:1222 |
| `screen_text` |  | packages/console/src/voice/useVoiceChannel.ts:804; packages/contracts/src/types/pipeline.ts:436; packages/daemon/src/index.ts:2861 +2 |
| `session.project` |  | packages/contracts/src/types/pipeline.ts:402; packages/daemon/src/voice/hub.ts:1132; packages/daemon/src/voice/hub.ts:1133 +1 |
| `tts.playout` |  | packages/console/src/voice/useVoiceChannel.ts:448; packages/contracts/src/types/pipeline.ts:308; packages/daemon/src/voice/hub.ts:76 |
| `tts.say` |  | packages/console/src/voice/useVoiceChannel.ts:767; packages/contracts/src/types/pipeline.ts:293; packages/daemon/src/index.ts:925 +7 |
| `turn.done_speaking` |  | packages/console/src/voice/useVoiceChannel.ts:981; packages/console/src/voice/useVoiceChannel.ts:1092; packages/contracts/src/types/pipeline.ts:321 +3 |
| `turn.listen_again` |  | packages/contracts/src/types/pipeline.ts:337 |
| `turn.text` |  | packages/console/src/voice/useVoiceChannel.ts:628; packages/console/src/voice/useVoiceChannel.ts:1178; packages/contracts/src/types/pipeline.ts:182 +2 |
| `turn.text.result` |  | packages/contracts/src/types/pipeline.ts:204; packages/contracts/src/types/pipeline.ts:210; packages/contracts/src/types/pipeline.ts:218 |
| `vad.speech` |  | packages/contracts/src/types/pipeline.ts:345; pipeline/src/saydo_pipeline/hub_client.py:627 |
| `voice.anchor_prepare` |  | packages/console/src/voice/useVoiceChannel.ts:1226; packages/contracts/src/types/pipeline.ts:447; packages/daemon/src/voice/hub.ts:620 |
| `voice.anchor_status` |  | packages/contracts/src/types/pipeline.ts:229; packages/contracts/src/types/pipeline.ts:236; packages/contracts/src/types/pipeline.ts:242 +1 |
| `voice.mode` |  | packages/console/src/voice/useVoiceChannel.ts:641; packages/console/src/voice/useVoiceChannel.ts:1039; packages/console/src/voice/useVoiceChannel.ts:1250 +6 |
| `voice.quiesce` |  | packages/contracts/src/types/pipeline.ts:456 |
| `voice.quiesced` |  | packages/contracts/src/types/pipeline.ts:265; packages/contracts/src/types/pipeline.ts:273; pipeline/src/saydo_pipeline/hub_client.py:1200 +1 |
| `voice.quiesced_transcript` |  | packages/contracts/src/types/pipeline.ts:463 |
| `voice.quiesced_transcript_ack` |  | packages/console/src/voice/useVoiceChannel.ts:917; packages/contracts/src/types/pipeline.ts:474; packages/daemon/src/voice/hub.ts:620 |

## ipc_frames (5)

| id | detail | sources |
|---|---|---|
| `fatal` |  | packages/daemon/src/api/recoveryOnlyServer.ts:313; packages/daemon/src/api/recoveryOnlyServer.ts:341; packages/daemon/src/index.ts:335 +8 |
| `prepareShutdown` |  | packages/cli/src/supervisor.ts:170 |
| `ready` |  | packages/daemon/src/api/recoveryOnlyServer.ts:810; packages/daemon/src/api/recoveryOnlyServer.ts:853; packages/daemon/src/index.ts:3293 |
| `restartRequested` |  | packages/daemon/src/api/recoveryOnlyServer.ts:289; packages/daemon/src/index.ts:4077 |
| `stopped` |  | packages/daemon/src/api/recoveryOnlyServer.ts:292; packages/daemon/src/api/recoveryOnlyServer.ts:322; packages/daemon/src/index.ts:478 +2 |

## brain_tools (32)

| id | detail | sources |
|---|---|---|
| `addHotword` |  | packages/daemon/src/brain/liveTools.ts:1523 |
| `approveAction` |  | packages/daemon/src/brain/liveTools.ts:1241 |
| `assessReadiness` |  | packages/daemon/src/brain/liveTools.ts:1669 |
| `cancelTask` |  | packages/daemon/src/brain/liveTools.ts:1144 |
| `confirmAndDispatch` |  | packages/daemon/src/brain/liveTools.ts:1054 |
| `confirmReadiness` |  | packages/daemon/src/brain/liveTools.ts:1474 |
| `createTask` |  | packages/daemon/src/brain/liveTools.ts:776 |
| `explainResult` |  | packages/daemon/src/brain/liveTools.ts:1115 |
| `forget` |  | packages/daemon/src/brain/liveTools.ts:1436 |
| `getDecisionPackage` |  | packages/daemon/src/brain/liveTools.ts:944 |
| `getFocusStatus` |  | packages/daemon/src/brain/liveTools.ts:2014 |
| `getStatus` |  | packages/daemon/src/brain/liveTools.ts:1083 |
| `issueDispatchReceipt` |  | packages/daemon/src/brain/liveTools.ts:962 |
| `listProjectDir` |  | packages/daemon/src/brain/liveTools.ts:1578 |
| `openOnScreen` |  | packages/daemon/src/brain/liveTools.ts:1096 |
| `promoteProject` |  | packages/daemon/src/brain/liveTools.ts:716 |
| `proposeExpectationAck` |  | packages/daemon/src/brain/liveTools.ts:2580 |
| `proposeFocusAnchor` |  | packages/daemon/src/brain/liveTools.ts:1726 |
| `proposeFocusRevision` |  | packages/daemon/src/brain/liveTools.ts:2375 |
| `proposeLaneSplit` |  | packages/daemon/src/brain/liveTools.ts:2455 |
| `proposeObligation` |  | packages/daemon/src/brain/liveTools.ts:2064 |
| `proposeObligationResolve` |  | packages/daemon/src/brain/liveTools.ts:1888 |
| `proposeProjectAnchor` |  | packages/daemon/src/brain/liveTools.ts:652 |
| `proposeStart` |  | packages/daemon/src/brain/liveTools.ts:797 |
| `readProjectFile` |  | packages/daemon/src/brain/liveTools.ts:1605 |
| `remember` |  | packages/daemon/src/brain/liveTools.ts:1307 |
| `requestManualMerge` |  | packages/daemon/src/brain/liveTools.ts:1284 |
| `resolveProject` |  | packages/daemon/src/brain/liveTools.ts:579 |
| `retryTask` |  | packages/daemon/src/brain/liveTools.ts:1195 |
| `reviewTask` |  | packages/daemon/src/brain/liveTools.ts:1161 |
| `steerTask` |  | packages/daemon/src/brain/liveTools.ts:1218 |
| `suspendSession` |  | packages/daemon/src/brain/liveTools.ts:1634 |

## task_actions (5)

| id | detail | sources |
|---|---|---|
| `cancel` |  | packages/daemon/src/api/actions.ts:33 |
| `request-manual-merge` |  | packages/daemon/src/api/actions.ts:33 |
| `retry` |  | packages/daemon/src/api/actions.ts:33 |
| `review` |  | packages/daemon/src/api/actions.ts:33 |
| `verify-merge` |  | packages/daemon/src/api/actions.ts:33 |

## cli_commands (5)

| id | detail | sources |
|---|---|---|
| `doctor` | explicit | packages/cli/src/cli.ts:31; packages/cli/src/options.ts:14; packages/cli/src/options.ts:47 +2 |
| `help` | explicit | packages/cli/src/cli.ts:27; packages/cli/src/options.ts:14; packages/cli/src/options.ts:43 |
| `open` | explicit | packages/cli/src/cli.ts:49; packages/cli/src/options.ts:14; packages/cli/src/options.ts:47 |
| `status` | explicit | packages/cli/src/cli.ts:44; packages/cli/src/options.ts:14; packages/cli/src/options.ts:47 |
| `up` | default | packages/cli/src/cli.ts:68; packages/cli/src/options.ts:14; packages/cli/src/options.ts:47 |

## console_api_members (43)

| id | detail | sources |
|---|---|---|
| `api.ackOutbox` | apiPost | packages/console/src/lib/api.ts:211 |
| `api.approvals` | apiGet | packages/console/src/lib/api.ts:209 |
| `api.approveMemory` | apiPost | packages/console/src/lib/api.ts:250 |
| `api.approveMerge` | apiPost | packages/console/src/lib/api.ts:284 |
| `api.artifactDiff` | apiGet | packages/console/src/lib/api.ts:263 |
| `api.artifacts` | apiGet | packages/console/src/lib/api.ts:207 |
| `api.bootstrapFoundation` | apiPost | packages/console/src/lib/api.ts:254 |
| `api.cancelTask` | apiPost | packages/console/src/lib/api.ts:229 |
| `api.config` | apiGet | packages/console/src/lib/api.ts:218 |
| `api.costs` | apiGet | packages/console/src/lib/api.ts:213 |
| `api.decideApproval` | apiPost | packages/console/src/lib/api.ts:236 |
| `api.editApproval` | apiPost | packages/console/src/lib/api.ts:239 |
| `api.explainTask` | apiPost | packages/console/src/lib/api.ts:245 |
| `api.exportArtifacts` | apiGet | packages/console/src/lib/api.ts:269 |
| `api.getArtifactContent` | apiGet | packages/console/src/lib/api.ts:265 |
| `api.memory` | apiGet | packages/console/src/lib/api.ts:205 |
| `api.outbox` | apiGet | packages/console/src/lib/api.ts:210 |
| `api.overview` | apiGet | packages/console/src/lib/api.ts:202 |
| `api.projectSettings` | apiGet | packages/console/src/lib/api.ts:208 |
| `api.projectTasks` | apiGet | packages/console/src/lib/api.ts:203 |
| `api.recentMemory` | apiGet | packages/console/src/lib/api.ts:206 |
| `api.rejectMemory` | apiPost | packages/console/src/lib/api.ts:251 |
| `api.requestManualMerge` | apiPost | packages/console/src/lib/api.ts:232 |
| `api.retryTask` | apiPost | packages/console/src/lib/api.ts:231 |
| `api.reviewTask` | apiPost | packages/console/src/lib/api.ts:228 |
| `api.s3Challenge` | apiPost | packages/console/src/lib/api.ts:275 |
| `api.s3Register` | apiPost | packages/console/src/lib/api.ts:280 |
| `api.s3Status` | apiPost | packages/console/src/lib/api.ts:273 |
| `api.s3Verify` | apiPost | packages/console/src/lib/api.ts:282 |
| `api.saveProjectOverrides` | apiPost | packages/console/src/lib/api.ts:260 |
| `api.taskDetail` | apiGet | packages/console/src/lib/api.ts:204 |
| `api.verifyMerge` | apiPost | packages/console/src/lib/api.ts:233 |
| `setupApi.fetchHealth` | setupFetch | packages/console/src/lib/setupApi.ts:727 |
| `setupApi.getInvalidProjectOverrides` | setupFetch | packages/console/src/lib/setupApi.ts:640 |
| `setupApi.postClearInvalidProjectOverrides` | setupFetch | packages/console/src/lib/setupApi.ts:667 |
| `setupApi.postConfirmCliCapability` | setupFetch | packages/console/src/lib/setupApi.ts:1209 |
| `setupApi.postReprobeCliCapabilities` | setupFetch | packages/console/src/lib/setupApi.ts:1163 |
| `setupApi.postSetupConfig` | setupFetch | packages/console/src/lib/setupApi.ts:588 |
| `setupApi.postSetupRestart` | setupFetch | packages/console/src/lib/setupApi.ts:712 |
| `setupApi.postSetupSecret` | setupFetch | packages/console/src/lib/setupApi.ts:607 |
| `setupApi.postSetupTest` | setupFetch | packages/console/src/lib/setupApi.ts:685 |
| `setupApi.postTier1SetupTest` | setupFetch | packages/console/src/lib/setupApi.ts:698 |
| `setupApi.requestFirstRunQuery` | setupFetch | packages/console/src/lib/setupApi.ts:497 |

## tables (57)

| id | detail | sources |
|---|---|---|
| `action_execution_bindings` |  | packages/daemon/src/storage/ddl.ts:688 |
| `approvals` |  | packages/daemon/src/storage/ddl.ts:62 |
| `approvals_v9` |  | packages/daemon/src/storage/ddl.ts:363 |
| `artifacts` |  | packages/daemon/src/storage/ddl.ts:167 |
| `attention_acks` |  | packages/daemon/src/storage/ddl.ts:734 |
| `audit_log` |  | packages/daemon/src/storage/ddl.ts:179 |
| `callback_outbox` |  | packages/daemon/src/storage/ddl.ts:173 |
| `claim_snapshot_links` |  | packages/daemon/src/storage/ddl.ts:164; packages/daemon/src/storage/ddl.ts:279 |
| `confirmation_ledger` |  | packages/daemon/src/storage/ddl.ts:743 |
| `context_snapshot_uses` |  | packages/daemon/src/storage/ddl.ts:138; packages/daemon/src/storage/ddl.ts:272 |
| `context_snapshots` |  | packages/daemon/src/storage/ddl.ts:135 |
| `cost_entries` |  | packages/daemon/src/storage/ddl.ts:169 |
| `decision_packages` |  | packages/daemon/src/storage/ddl.ts:57 |
| `decision_packages_v11` |  | packages/daemon/src/storage/ddl.ts:455 |
| `dispatch_bindings` |  | packages/daemon/src/storage/ddl.ts:122 |
| `events_cursor` |  | packages/daemon/src/storage/ddl.ts:181 |
| `focus_activations` |  | packages/daemon/src/storage/ddl.ts:592 |
| `focus_artifacts` |  | packages/daemon/src/storage/ddl.ts:914 |
| `focus_artifacts_v24` |  | packages/daemon/src/storage/ddl.ts:1429 |
| `focus_auth_snapshots` |  | packages/daemon/src/storage/ddl.ts:714 |
| `focus_close_settlements` |  | packages/daemon/src/storage/ddl.ts:617 |
| `focus_compare_records` |  | packages/daemon/src/storage/ddl.ts:650 |
| `focus_events` |  | packages/daemon/src/storage/ddl.ts:528 |
| `focus_events_v21` |  | packages/daemon/src/storage/ddl.ts:1047 |
| `focus_expectations` |  | packages/daemon/src/storage/ddl.ts:861 |
| `focus_lanes` |  | packages/daemon/src/storage/ddl.ts:1282 |
| `focus_obligations` |  | packages/daemon/src/storage/ddl.ts:556 |
| `focus_obligations_v23` |  | packages/daemon/src/storage/ddl.ts:1302 |
| `focus_project_refs` |  | packages/daemon/src/storage/ddl.ts:497 |
| `focus_resume_packets` |  | packages/daemon/src/storage/ddl.ts:666 |
| `focus_shadow_projections` |  | packages/daemon/src/storage/ddl.ts:639 |
| `focus_spaces` |  | packages/daemon/src/storage/ddl.ts:926 |
| `focus_states` |  | packages/daemon/src/storage/ddl.ts:511 |
| `focuses` |  | packages/daemon/src/storage/ddl.ts:482 |
| `focuses_v22` |  | packages/daemon/src/storage/ddl.ts:1141 |
| `hopper_commands` |  | packages/daemon/src/storage/ddl.ts:124 |
| `memory_events` |  | packages/daemon/src/storage/ddl.ts:126 |
| `memory_fts` |  | packages/daemon/src/storage/ddl.ts:134 |
| `pending_confirmations` |  | packages/daemon/src/storage/ddl.ts:898 |
| `project_settings` |  | packages/daemon/src/storage/ddl.ts:193; packages/daemon/src/storage/ddl.ts:303 |
| `projects` |  | packages/daemon/src/storage/ddl.ts:10 |
| `projects_v10` |  | packages/daemon/src/storage/ddl.ts:419 |
| `readiness_assessments` |  | packages/daemon/src/storage/ddl.ts:141 |
| `readiness_bindings` |  | packages/daemon/src/storage/ddl.ts:150; packages/daemon/src/storage/ddl.ts:1588 |
| `s3_challenges` |  | packages/daemon/src/storage/ddl.ts:102; packages/daemon/src/storage/ddl.ts:339 |
| `s3_challenges_v12` |  | packages/daemon/src/storage/ddl.ts:1617 |
| `schema_migrations` |  | packages/daemon/src/storage/db.ts:40 |
| `session_project_events` |  | packages/daemon/src/storage/ddl.ts:52; packages/daemon/src/storage/ddl.ts:1563 |
| `session_task_context` |  | packages/daemon/src/storage/ddl.ts:933 |
| `sessions` |  | packages/daemon/src/storage/ddl.ts:37 |
| `source_snapshots` |  | packages/daemon/src/storage/ddl.ts:160; packages/daemon/src/storage/ddl.ts:275 |
| `subscription_retry_queue` |  | packages/daemon/src/storage/ddl.ts:195; packages/daemon/src/storage/ddl.ts:311 |
| `task_messages` |  | packages/daemon/src/storage/ddl.ts:218 |
| `task_messages_v4` |  | packages/daemon/src/storage/ddl.ts:231 |
| `tasks` |  | packages/daemon/src/storage/ddl.ts:112 |
| `tier1_runs` |  | packages/daemon/src/storage/ddl.ts:183 |
| `webauthn_credentials` |  | packages/daemon/src/storage/ddl.ts:94; packages/daemon/src/storage/ddl.ts:331 |

## table_writers (116)

| id | detail | sources |
|---|---|---|
| `action_execution_bindings <- packages/daemon/src/focus/binding.ts` |  | packages/daemon/src/focus/binding.ts:undefined |
| `approvals <- packages/daemon/src/api/fixture.ts` |  | packages/daemon/src/api/fixture.ts:undefined |
| `approvals <- packages/daemon/src/approvals/directMode.ts` |  | packages/daemon/src/approvals/directMode.ts:undefined |
| `approvals <- packages/daemon/src/approvals/issue.ts` |  | packages/daemon/src/approvals/issue.ts:undefined |
| `approvals <- packages/daemon/src/storage/dao/approvals.ts` |  | packages/daemon/src/storage/dao/approvals.ts:undefined |
| `approvals <- packages/daemon/src/storage/ddl.ts` |  | packages/daemon/src/storage/ddl.ts:undefined |
| `approvals <- packages/daemon/src/tier1/approvalFlow.ts` |  | packages/daemon/src/tier1/approvalFlow.ts:undefined |
| `approvals <- packages/daemon/src/tier1/s3Tools.ts` |  | packages/daemon/src/tier1/s3Tools.ts:undefined |
| `approvals_v9 <- packages/daemon/src/storage/ddl.ts` |  | packages/daemon/src/storage/ddl.ts:undefined |
| `artifacts <- packages/daemon/src/api/fixture.ts` |  | packages/daemon/src/api/fixture.ts:undefined |
| `artifacts <- packages/daemon/src/storage/dao/artifacts.ts` |  | packages/daemon/src/storage/dao/artifacts.ts:undefined |
| `artifacts <- packages/daemon/src/storage/dao/misc.ts` |  | packages/daemon/src/storage/dao/misc.ts:undefined |
| `attention_acks <- packages/daemon/src/api/attention.ts` |  | packages/daemon/src/api/attention.ts:undefined |
| `audit_log <- packages/daemon/src/api/fixture.ts` |  | packages/daemon/src/api/fixture.ts:undefined |
| `audit_log <- packages/daemon/src/storage/dao/misc.ts` |  | packages/daemon/src/storage/dao/misc.ts:undefined |
| `audit_log <- packages/daemon/src/storage/ddl.ts` |  | packages/daemon/src/storage/ddl.ts:undefined |
| `callback_outbox <- packages/daemon/src/api/fixture.ts` |  | packages/daemon/src/api/fixture.ts:undefined |
| `callback_outbox <- packages/daemon/src/callback/engine.ts` |  | packages/daemon/src/callback/engine.ts:undefined |
| `callback_outbox <- packages/daemon/src/storage/dao/outbox.ts` |  | packages/daemon/src/storage/dao/outbox.ts:undefined |
| `claim_snapshot_links <- packages/daemon/src/storage/dao/sourceSnapshots.ts` |  | packages/daemon/src/storage/dao/sourceSnapshots.ts:undefined |
| `confirmation_ledger <- packages/daemon/src/index.ts` |  | packages/daemon/src/index.ts:undefined |
| `confirmation_ledger <- packages/daemon/src/live/confirm.ts` |  | packages/daemon/src/live/confirm.ts:undefined |
| `context_snapshot_uses <- packages/daemon/src/storage/dao/snapshots.ts` |  | packages/daemon/src/storage/dao/snapshots.ts:undefined |
| `context_snapshots <- packages/daemon/src/storage/dao/snapshots.ts` |  | packages/daemon/src/storage/dao/snapshots.ts:undefined |
| `cost_entries <- packages/daemon/src/api/fixture.ts` |  | packages/daemon/src/api/fixture.ts:undefined |
| `cost_entries <- packages/daemon/src/cost/ledger.ts` |  | packages/daemon/src/cost/ledger.ts:undefined |
| `cost_entries <- packages/daemon/src/storage/dao/misc.ts` |  | packages/daemon/src/storage/dao/misc.ts:undefined |
| `decision_packages <- packages/daemon/src/storage/dao/packages.ts` |  | packages/daemon/src/storage/dao/packages.ts:undefined |
| `decision_packages <- packages/daemon/src/storage/ddl.ts` |  | packages/daemon/src/storage/ddl.ts:undefined |
| `decision_packages_v11 <- packages/daemon/src/storage/ddl.ts` |  | packages/daemon/src/storage/ddl.ts:undefined |
| `dispatch_bindings <- packages/daemon/src/bridge/dispatch.ts` |  | packages/daemon/src/bridge/dispatch.ts:undefined |
| `dispatch_bindings <- packages/daemon/src/storage/dao/dispatch.ts` |  | packages/daemon/src/storage/dao/dispatch.ts:undefined |
| `focus_activations <- packages/daemon/src/focus/activation.ts` |  | packages/daemon/src/focus/activation.ts:undefined |
| `focus_activations <- packages/daemon/src/focus/closeSettlement.ts` |  | packages/daemon/src/focus/closeSettlement.ts:undefined |
| `focus_activations <- packages/daemon/src/focus/interruptRecovery.ts` |  | packages/daemon/src/focus/interruptRecovery.ts:undefined |
| `focus_artifacts <- packages/daemon/src/api/artifacts.ts` |  | packages/daemon/src/api/artifacts.ts:undefined |
| `focus_artifacts <- packages/daemon/src/focus/writeTx.ts` |  | packages/daemon/src/focus/writeTx.ts:undefined |
| `focus_artifacts_v24 <- packages/daemon/src/storage/ddl.ts` |  | packages/daemon/src/storage/ddl.ts:undefined |
| `focus_auth_snapshots <- packages/daemon/src/focus/binding.ts` |  | packages/daemon/src/focus/binding.ts:undefined |
| `focus_close_settlements <- packages/daemon/src/focus/closeSettlement.ts` |  | packages/daemon/src/focus/closeSettlement.ts:undefined |
| `focus_compare_records <- packages/daemon/src/focus/shadow.ts` |  | packages/daemon/src/focus/shadow.ts:undefined |
| `focus_events <- packages/daemon/src/api/fixture.ts` |  | packages/daemon/src/api/fixture.ts:undefined |
| `focus_events <- packages/daemon/src/focus/writeTx.ts` |  | packages/daemon/src/focus/writeTx.ts:undefined |
| `focus_events <- packages/daemon/src/live/confirm.ts` |  | packages/daemon/src/live/confirm.ts:undefined |
| `focus_events_v21 <- packages/daemon/src/storage/ddl.ts` |  | packages/daemon/src/storage/ddl.ts:undefined |
| `focus_expectations <- packages/daemon/src/focus/expectations.ts` |  | packages/daemon/src/focus/expectations.ts:undefined |
| `focus_lanes <- packages/daemon/src/focus/lanes.ts` |  | packages/daemon/src/focus/lanes.ts:undefined |
| `focus_obligations <- packages/daemon/src/api/fixture.ts` |  | packages/daemon/src/api/fixture.ts:undefined |
| `focus_obligations <- packages/daemon/src/api/obligations.ts` |  | packages/daemon/src/api/obligations.ts:undefined |
| `focus_obligations <- packages/daemon/src/focus/dependency.ts` |  | packages/daemon/src/focus/dependency.ts:undefined |
| `focus_obligations <- packages/daemon/src/focus/lanes.ts` |  | packages/daemon/src/focus/lanes.ts:undefined |
| `focus_obligations <- packages/daemon/src/focus/writeTx.ts` |  | packages/daemon/src/focus/writeTx.ts:undefined |
| `focus_obligations <- packages/daemon/src/storage/ddl.ts` |  | packages/daemon/src/storage/ddl.ts:undefined |
| `focus_obligations_v23 <- packages/daemon/src/storage/ddl.ts` |  | packages/daemon/src/storage/ddl.ts:undefined |
| `focus_resume_packets <- packages/daemon/src/focus/resumePacket.ts` |  | packages/daemon/src/focus/resumePacket.ts:undefined |
| `focus_shadow_projections <- packages/daemon/src/focus/shadow.ts` |  | packages/daemon/src/focus/shadow.ts:undefined |
| `focus_spaces <- packages/daemon/src/api/spaces.ts` |  | packages/daemon/src/api/spaces.ts:undefined |
| `focus_states <- packages/daemon/src/api/fixture.ts` |  | packages/daemon/src/api/fixture.ts:undefined |
| `focus_states <- packages/daemon/src/focus/writeTx.ts` |  | packages/daemon/src/focus/writeTx.ts:undefined |
| `focuses <- packages/daemon/src/api/fixture.ts` |  | packages/daemon/src/api/fixture.ts:undefined |
| `focuses <- packages/daemon/src/api/focuses.ts` |  | packages/daemon/src/api/focuses.ts:undefined |
| `focuses <- packages/daemon/src/api/spaces.ts` |  | packages/daemon/src/api/spaces.ts:undefined |
| `focuses <- packages/daemon/src/focus/activation.ts` |  | packages/daemon/src/focus/activation.ts:undefined |
| `focuses <- packages/daemon/src/focus/writeTx.ts` |  | packages/daemon/src/focus/writeTx.ts:undefined |
| `focuses <- packages/daemon/src/live/confirm.ts` |  | packages/daemon/src/live/confirm.ts:undefined |
| `focuses_v22 <- packages/daemon/src/storage/ddl.ts` |  | packages/daemon/src/storage/ddl.ts:undefined |
| `hopper_commands <- packages/daemon/src/bridge/journal.ts` |  | packages/daemon/src/bridge/journal.ts:undefined |
| `hopper_commands <- packages/daemon/src/storage/dao/dispatch.ts` |  | packages/daemon/src/storage/dao/dispatch.ts:undefined |
| `memory_events <- packages/daemon/src/api/fixture.ts` |  | packages/daemon/src/api/fixture.ts:undefined |
| `memory_events <- packages/daemon/src/memory/ledger.ts` |  | packages/daemon/src/memory/ledger.ts:undefined |
| `memory_events <- packages/daemon/src/storage/dao/memory.ts` |  | packages/daemon/src/storage/dao/memory.ts:undefined |
| `memory_fts <- packages/daemon/src/memory/fts.ts` |  | packages/daemon/src/memory/fts.ts:undefined |
| `pending_confirmations <- packages/daemon/src/index.ts` |  | packages/daemon/src/index.ts:undefined |
| `pending_confirmations <- packages/daemon/src/live/confirm.ts` |  | packages/daemon/src/live/confirm.ts:undefined |
| `project_settings <- packages/daemon/src/config/projectOverrides.ts` |  | packages/daemon/src/config/projectOverrides.ts:undefined |
| `projects <- packages/daemon/src/api/fixture.ts` |  | packages/daemon/src/api/fixture.ts:undefined |
| `projects <- packages/daemon/src/projects/anchor.ts` |  | packages/daemon/src/projects/anchor.ts:undefined |
| `projects <- packages/daemon/src/storage/dao/projects.ts` |  | packages/daemon/src/storage/dao/projects.ts:undefined |
| `projects <- packages/daemon/src/storage/ddl.ts` |  | packages/daemon/src/storage/ddl.ts:undefined |
| `projects_v10 <- packages/daemon/src/storage/ddl.ts` |  | packages/daemon/src/storage/ddl.ts:undefined |
| `readiness_assessments <- packages/daemon/src/evaluator/readiness.ts` |  | packages/daemon/src/evaluator/readiness.ts:undefined |
| `readiness_assessments <- packages/daemon/src/evaluator/readinessGate.ts` |  | packages/daemon/src/evaluator/readinessGate.ts:undefined |
| `readiness_assessments <- packages/daemon/src/memory/snapshotForget.ts` |  | packages/daemon/src/memory/snapshotForget.ts:undefined |
| `readiness_bindings <- packages/daemon/src/evaluator/readinessBinding.ts` |  | packages/daemon/src/evaluator/readinessBinding.ts:undefined |
| `readiness_bindings <- packages/daemon/src/memory/ledger.ts` |  | packages/daemon/src/memory/ledger.ts:undefined |
| `s3_challenges <- packages/daemon/src/api/fixture.ts` |  | packages/daemon/src/api/fixture.ts:undefined |
| `s3_challenges <- packages/daemon/src/storage/dao/webauthn.ts` |  | packages/daemon/src/storage/dao/webauthn.ts:undefined |
| `s3_challenges_v12 <- packages/daemon/src/storage/ddl.ts` |  | packages/daemon/src/storage/ddl.ts:undefined |
| `schema_migrations <- packages/daemon/src/storage/db.ts` |  | packages/daemon/src/storage/db.ts:undefined |
| `session_project_events <- packages/daemon/src/projects/anchor.ts` |  | packages/daemon/src/projects/anchor.ts:undefined |
| `session_project_events <- packages/daemon/src/storage/ddl.ts` |  | packages/daemon/src/storage/ddl.ts:undefined |
| `session_task_context <- packages/daemon/src/focus/sessionTaskContext.ts` |  | packages/daemon/src/focus/sessionTaskContext.ts:undefined |
| `sessions <- packages/daemon/src/focus/activation.ts` |  | packages/daemon/src/focus/activation.ts:undefined |
| `sessions <- packages/daemon/src/focus/closeSettlement.ts` |  | packages/daemon/src/focus/closeSettlement.ts:undefined |
| `sessions <- packages/daemon/src/focus/interruptRecovery.ts` |  | packages/daemon/src/focus/interruptRecovery.ts:undefined |
| `sessions <- packages/daemon/src/live/pack.ts` |  | packages/daemon/src/live/pack.ts:undefined |
| `sessions <- packages/daemon/src/projects/anchor.ts` |  | packages/daemon/src/projects/anchor.ts:undefined |
| `sessions <- packages/daemon/src/session/manager.ts` |  | packages/daemon/src/session/manager.ts:undefined |
| `sessions <- packages/daemon/src/storage/dao/projects.ts` |  | packages/daemon/src/storage/dao/projects.ts:undefined |
| `source_snapshots <- packages/daemon/src/storage/dao/sourceSnapshots.ts` |  | packages/daemon/src/storage/dao/sourceSnapshots.ts:undefined |
| `subscription_retry_queue <- packages/daemon/src/providers/byoa/retryQueue.ts` |  | packages/daemon/src/providers/byoa/retryQueue.ts:undefined |
| `task_messages <- packages/daemon/src/tier1/operations.ts` |  | packages/daemon/src/tier1/operations.ts:undefined |
| `task_messages_v4 <- packages/daemon/src/storage/ddl.ts` |  | packages/daemon/src/storage/ddl.ts:undefined |
| `tasks <- packages/daemon/src/api/fixture.ts` |  | packages/daemon/src/api/fixture.ts:undefined |
| `tasks <- packages/daemon/src/approvals/parkAging.ts` |  | packages/daemon/src/approvals/parkAging.ts:undefined |
| `tasks <- packages/daemon/src/storage/dao/tasks.ts` |  | packages/daemon/src/storage/dao/tasks.ts:undefined |
| `tasks <- packages/daemon/src/tier1/executor.ts` |  | packages/daemon/src/tier1/executor.ts:undefined |
| `tasks <- packages/daemon/src/tier1/operations.ts` |  | packages/daemon/src/tier1/operations.ts:undefined |
| `tasks <- packages/daemon/src/tier1/s3Tools.ts` |  | packages/daemon/src/tier1/s3Tools.ts:undefined |
| `tier1_runs <- packages/daemon/src/api/fixture.ts` |  | packages/daemon/src/api/fixture.ts:undefined |
| `tier1_runs <- packages/daemon/src/storage/dao/tasks.ts` |  | packages/daemon/src/storage/dao/tasks.ts:undefined |
| `tier1_runs <- packages/daemon/src/summary/explain.ts` |  | packages/daemon/src/summary/explain.ts:undefined |
| `tier1_runs <- packages/daemon/src/tier1/executor.ts` |  | packages/daemon/src/tier1/executor.ts:undefined |
| `tier1_runs <- packages/daemon/src/tier1/operations.ts` |  | packages/daemon/src/tier1/operations.ts:undefined |
| `tier1_runs <- packages/daemon/src/tier1/restartPolicy.ts` |  | packages/daemon/src/tier1/restartPolicy.ts:undefined |
| `webauthn_credentials <- packages/daemon/src/storage/dao/webauthn.ts` |  | packages/daemon/src/storage/dao/webauthn.ts:undefined |

## file_writers (225)

| id | detail | sources |
|---|---|---|
| `apps/android/app/src/main/java/com/octoooo/saydo/ConnectionStore.kt:8` |  | apps/android/app/src/main/java/com/octoooo/saydo/ConnectionStore.kt:8 |
| `apps/android/app/src/main/java/com/octoooo/saydo/ConnectionStore.kt:35` |  | apps/android/app/src/main/java/com/octoooo/saydo/ConnectionStore.kt:35 |
| `apps/android/app/src/main/java/com/octoooo/saydo/ConnectionStore.kt:62` |  | apps/android/app/src/main/java/com/octoooo/saydo/ConnectionStore.kt:62 |
| `apps/android/app/src/main/java/com/octoooo/saydo/ConnectionStore.kt:97` |  | apps/android/app/src/main/java/com/octoooo/saydo/ConnectionStore.kt:97 |
| `apps/android/app/src/main/java/com/octoooo/saydo/ConnectionStore.kt:99` |  | apps/android/app/src/main/java/com/octoooo/saydo/ConnectionStore.kt:99 |
| `apps/android/app/src/main/java/com/octoooo/saydo/ConnectionStore.kt:101` |  | apps/android/app/src/main/java/com/octoooo/saydo/ConnectionStore.kt:101 |
| `apps/android/app/src/main/java/com/octoooo/saydo/ConnectionStore.kt:103` |  | apps/android/app/src/main/java/com/octoooo/saydo/ConnectionStore.kt:103 |
| `apps/android/app/src/main/java/com/octoooo/saydo/MainActivity.kt:285` |  | apps/android/app/src/main/java/com/octoooo/saydo/MainActivity.kt:285 |
| `apps/android/app/src/main/java/com/octoooo/saydo/TokenStore.kt:15` |  | apps/android/app/src/main/java/com/octoooo/saydo/TokenStore.kt:15 |
| `apps/android/app/src/main/java/com/octoooo/saydo/TokenStore.kt:37` |  | apps/android/app/src/main/java/com/octoooo/saydo/TokenStore.kt:37 |
| `apps/android/app/src/main/java/com/octoooo/saydo/TokenStore.kt:43` |  | apps/android/app/src/main/java/com/octoooo/saydo/TokenStore.kt:43 |
| `apps/android/app/src/main/java/com/octoooo/saydo/TokenStore.kt:61` |  | apps/android/app/src/main/java/com/octoooo/saydo/TokenStore.kt:61 |
| `apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:33` |  | apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:33 |
| `apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:85` |  | apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:85 |
| `apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:134` |  | apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:134 |
| `apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:148` |  | apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:148 |
| `apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:149` |  | apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:149 |
| `apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:161` |  | apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:161 |
| `apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:163` |  | apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:163 |
| `apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:165` |  | apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:165 |
| `apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:183` |  | apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:183 |
| `apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:185` |  | apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:185 |
| `apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:187` |  | apps/harmonyos/entry/src/main/ets/data/ProfileStore.ets:187 |
| `apps/harmonyos/entry/src/main/ets/pages/Index.ets:429` |  | apps/harmonyos/entry/src/main/ets/pages/Index.ets:429 |
| `apps/harmonyos/entry/src/main/ets/security/SecureStore.ets:19` |  | apps/harmonyos/entry/src/main/ets/security/SecureStore.ets:19 |
| `apps/harmonyos/entry/src/main/ets/security/SecureStore.ets:35` |  | apps/harmonyos/entry/src/main/ets/security/SecureStore.ets:35 |
| `apps/harmonyos/entry/src/main/ets/security/SecureStore.ets:36` |  | apps/harmonyos/entry/src/main/ets/security/SecureStore.ets:36 |
| `apps/harmonyos/entry/src/main/ets/security/SecureStore.ets:41` |  | apps/harmonyos/entry/src/main/ets/security/SecureStore.ets:41 |
| `apps/harmonyos/entry/src/main/ets/security/SecureStore.ets:42` |  | apps/harmonyos/entry/src/main/ets/security/SecureStore.ets:42 |
| `apps/harmonyos/entry/src/main/ets/security/SecureStore.ets:47` |  | apps/harmonyos/entry/src/main/ets/security/SecureStore.ets:47 |
| `apps/harmonyos/entry/src/main/ets/security/SecureStore.ets:68` |  | apps/harmonyos/entry/src/main/ets/security/SecureStore.ets:68 |
| `apps/ios/SayDo/ConnectionStore.swift:62` |  | apps/ios/SayDo/ConnectionStore.swift:62 |
| `apps/ios/SayDo/ConnectionStore.swift:66` |  | apps/ios/SayDo/ConnectionStore.swift:66 |
| `apps/ios/SayDo/ConnectionStore.swift:68` |  | apps/ios/SayDo/ConnectionStore.swift:68 |
| `apps/ios/SayDo/ConnectionStore.swift:103` |  | apps/ios/SayDo/ConnectionStore.swift:103 |
| `apps/ios/SayDo/ConnectionStore.swift:113` |  | apps/ios/SayDo/ConnectionStore.swift:113 |
| `apps/ios/SayDo/ConnectionStore.swift:125` |  | apps/ios/SayDo/ConnectionStore.swift:125 |
| `packages/cli/src/emergencyReaper.ts:190` |  | packages/cli/src/emergencyReaper.ts:190 |
| `packages/cli/src/emergencyReaper.ts:208` |  | packages/cli/src/emergencyReaper.ts:208 |
| `packages/cli/src/supervisor.ts:47` |  | packages/cli/src/supervisor.ts:47 |
| `packages/cli/src/supervisor.ts:73` |  | packages/cli/src/supervisor.ts:73 |
| `packages/cli/src/supervisor.ts:363` |  | packages/cli/src/supervisor.ts:363 |
| `packages/daemon/src/api/firstRun.ts:199` |  | packages/daemon/src/api/firstRun.ts:199 |
| `packages/daemon/src/api/firstRun.ts:209` |  | packages/daemon/src/api/firstRun.ts:209 |
| `packages/daemon/src/api/firstRun.ts:210` |  | packages/daemon/src/api/firstRun.ts:210 |
| `packages/daemon/src/api/fixture.ts:199` |  | packages/daemon/src/api/fixture.ts:199 |
| `packages/daemon/src/api/fixture.ts:202` |  | packages/daemon/src/api/fixture.ts:202 |
| `packages/daemon/src/api/fixture.ts:203` |  | packages/daemon/src/api/fixture.ts:203 |
| `packages/daemon/src/artifacts/store.ts:62` |  | packages/daemon/src/artifacts/store.ts:62 |
| `packages/daemon/src/artifacts/store.ts:74` |  | packages/daemon/src/artifacts/store.ts:74 |
| `packages/daemon/src/artifacts/store.ts:123` |  | packages/daemon/src/artifacts/store.ts:123 |
| `packages/daemon/src/artifacts/store.ts:125` |  | packages/daemon/src/artifacts/store.ts:125 |
| `packages/daemon/src/backup/snapshot.ts:288` |  | packages/daemon/src/backup/snapshot.ts:288 |
| `packages/daemon/src/backup/snapshot.ts:299` |  | packages/daemon/src/backup/snapshot.ts:299 |
| `packages/daemon/src/backup/snapshot.ts:315` |  | packages/daemon/src/backup/snapshot.ts:315 |
| `packages/daemon/src/backup/snapshot.ts:316` |  | packages/daemon/src/backup/snapshot.ts:316 |
| `packages/daemon/src/backup/snapshot.ts:350` |  | packages/daemon/src/backup/snapshot.ts:350 |
| `packages/daemon/src/backup/snapshot.ts:383` |  | packages/daemon/src/backup/snapshot.ts:383 |
| `packages/daemon/src/backup/snapshot.ts:400` |  | packages/daemon/src/backup/snapshot.ts:400 |
| `packages/daemon/src/backup/snapshot.ts:402` |  | packages/daemon/src/backup/snapshot.ts:402 |
| `packages/daemon/src/backup/snapshot.ts:430` |  | packages/daemon/src/backup/snapshot.ts:430 |
| `packages/daemon/src/backup/snapshot.ts:439` |  | packages/daemon/src/backup/snapshot.ts:439 |
| `packages/daemon/src/config/cliRuntime.ts:311` |  | packages/daemon/src/config/cliRuntime.ts:311 |
| `packages/daemon/src/config/cliRuntime.ts:313` |  | packages/daemon/src/config/cliRuntime.ts:313 |
| `packages/daemon/src/config/cliRuntime.ts:314` |  | packages/daemon/src/config/cliRuntime.ts:314 |
| `packages/daemon/src/config/cliRuntime.ts:452` |  | packages/daemon/src/config/cliRuntime.ts:452 |
| `packages/daemon/src/config/pending.ts:84` |  | packages/daemon/src/config/pending.ts:84 |
| `packages/daemon/src/config/pending.ts:104` |  | packages/daemon/src/config/pending.ts:104 |
| `packages/daemon/src/config/pending.ts:109` |  | packages/daemon/src/config/pending.ts:109 |
| `packages/daemon/src/config/pending.ts:128` |  | packages/daemon/src/config/pending.ts:128 |
| `packages/daemon/src/config/pending.ts:185` |  | packages/daemon/src/config/pending.ts:185 |
| `packages/daemon/src/config/pending.ts:187` |  | packages/daemon/src/config/pending.ts:187 |
| `packages/daemon/src/config/pending.ts:228` |  | packages/daemon/src/config/pending.ts:228 |
| `packages/daemon/src/config/pending.ts:236` |  | packages/daemon/src/config/pending.ts:236 |
| `packages/daemon/src/config/pending.ts:284` |  | packages/daemon/src/config/pending.ts:284 |
| `packages/daemon/src/config/pending.ts:287` |  | packages/daemon/src/config/pending.ts:287 |
| `packages/daemon/src/config/pending.ts:289` |  | packages/daemon/src/config/pending.ts:289 |
| `packages/daemon/src/config/pending.ts:294` |  | packages/daemon/src/config/pending.ts:294 |
| `packages/daemon/src/config/pending.ts:296` |  | packages/daemon/src/config/pending.ts:296 |
| `packages/daemon/src/config/pending.ts:309` |  | packages/daemon/src/config/pending.ts:309 |
| `packages/daemon/src/evaluator/readiness.ts:231` |  | packages/daemon/src/evaluator/readiness.ts:231 |
| `packages/daemon/src/evaluator/readiness.ts:233` |  | packages/daemon/src/evaluator/readiness.ts:233 |
| `packages/daemon/src/evaluator/snapshotter.ts:174` |  | packages/daemon/src/evaluator/snapshotter.ts:174 |
| `packages/daemon/src/evaluator/snapshotter.ts:177` |  | packages/daemon/src/evaluator/snapshotter.ts:177 |
| `packages/daemon/src/evaluator/snapshotter.ts:179` |  | packages/daemon/src/evaluator/snapshotter.ts:179 |
| `packages/daemon/src/evaluator/snapshotter.ts:207` |  | packages/daemon/src/evaluator/snapshotter.ts:207 |
| `packages/daemon/src/evaluator/snapshotter.ts:213` |  | packages/daemon/src/evaluator/snapshotter.ts:213 |
| `packages/daemon/src/experimental/codex-app-server/cli.ts:36` |  | packages/daemon/src/experimental/codex-app-server/cli.ts:36 |
| `packages/daemon/src/experimental/codex-app-server/intentLog.ts:63` |  | packages/daemon/src/experimental/codex-app-server/intentLog.ts:63 |
| `packages/daemon/src/experimental/codex-app-server/processControl.ts:94` |  | packages/daemon/src/experimental/codex-app-server/processControl.ts:94 |
| `packages/daemon/src/experimental/codex-app-server/processControl.ts:124` |  | packages/daemon/src/experimental/codex-app-server/processControl.ts:124 |
| `packages/daemon/src/experimental/codex-app-server/processControl.ts:158` |  | packages/daemon/src/experimental/codex-app-server/processControl.ts:158 |
| `packages/daemon/src/index.ts:257` |  | packages/daemon/src/index.ts:257 |
| `packages/daemon/src/index.ts:310` |  | packages/daemon/src/index.ts:310 |
| `packages/daemon/src/index.ts:321` |  | packages/daemon/src/index.ts:321 |
| `packages/daemon/src/launchd/cli.ts:96` |  | packages/daemon/src/launchd/cli.ts:96 |
| `packages/daemon/src/launchd/cli.ts:97` |  | packages/daemon/src/launchd/cli.ts:97 |
| `packages/daemon/src/launchd/cli.ts:108` |  | packages/daemon/src/launchd/cli.ts:108 |
| `packages/daemon/src/launchd/cli.ts:116` |  | packages/daemon/src/launchd/cli.ts:116 |
| `packages/daemon/src/launchd/cli.ts:117` |  | packages/daemon/src/launchd/cli.ts:117 |
| `packages/daemon/src/launchd/cli.ts:128` |  | packages/daemon/src/launchd/cli.ts:128 |
| `packages/daemon/src/launchd/cli.ts:129` |  | packages/daemon/src/launchd/cli.ts:129 |
| `packages/daemon/src/launchd/cli.ts:131` |  | packages/daemon/src/launchd/cli.ts:131 |
| `packages/daemon/src/launchd/cli.ts:252` |  | packages/daemon/src/launchd/cli.ts:252 |
| `packages/daemon/src/launchd/cli.ts:270` |  | packages/daemon/src/launchd/cli.ts:270 |
| `packages/daemon/src/launchd/cli.ts:350` |  | packages/daemon/src/launchd/cli.ts:350 |
| `packages/daemon/src/launchd/cli.ts:352` |  | packages/daemon/src/launchd/cli.ts:352 |
| `packages/daemon/src/launchd/cli.ts:353` |  | packages/daemon/src/launchd/cli.ts:353 |
| `packages/daemon/src/launchd/cli.ts:359` |  | packages/daemon/src/launchd/cli.ts:359 |
| `packages/daemon/src/launchd/cli.ts:361` |  | packages/daemon/src/launchd/cli.ts:361 |
| `packages/daemon/src/launchd/cli.ts:364` |  | packages/daemon/src/launchd/cli.ts:364 |
| `packages/daemon/src/launchd/cli.ts:366` |  | packages/daemon/src/launchd/cli.ts:366 |
| `packages/daemon/src/launchd/cli.ts:412` |  | packages/daemon/src/launchd/cli.ts:412 |
| `packages/daemon/src/memory/foundation.ts:136` |  | packages/daemon/src/memory/foundation.ts:136 |
| `packages/daemon/src/memory/foundation.ts:142` |  | packages/daemon/src/memory/foundation.ts:142 |
| `packages/daemon/src/memory/foundation.ts:148` |  | packages/daemon/src/memory/foundation.ts:148 |
| `packages/daemon/src/memory/foundation.ts:152` |  | packages/daemon/src/memory/foundation.ts:152 |
| `packages/daemon/src/memory/foundation.ts:156` |  | packages/daemon/src/memory/foundation.ts:156 |
| `packages/daemon/src/memory/foundation.ts:159` |  | packages/daemon/src/memory/foundation.ts:159 |
| `packages/daemon/src/memory/foundation.ts:162` |  | packages/daemon/src/memory/foundation.ts:162 |
| `packages/daemon/src/memory/foundation.ts:163` |  | packages/daemon/src/memory/foundation.ts:163 |
| `packages/daemon/src/memory/foundation.ts:165` |  | packages/daemon/src/memory/foundation.ts:165 |
| `packages/daemon/src/memory/foundation.ts:597` |  | packages/daemon/src/memory/foundation.ts:597 |
| `packages/daemon/src/memory/foundation.ts:598` |  | packages/daemon/src/memory/foundation.ts:598 |
| `packages/daemon/src/memory/foundation.ts:599` |  | packages/daemon/src/memory/foundation.ts:599 |
| `packages/daemon/src/memory/foundation.ts:600` |  | packages/daemon/src/memory/foundation.ts:600 |
| `packages/daemon/src/memory/foundation.ts:730` |  | packages/daemon/src/memory/foundation.ts:730 |
| `packages/daemon/src/memory/foundation.ts:882` |  | packages/daemon/src/memory/foundation.ts:882 |
| `packages/daemon/src/memory/foundation.ts:898` |  | packages/daemon/src/memory/foundation.ts:898 |
| `packages/daemon/src/memory/foundation.ts:969` |  | packages/daemon/src/memory/foundation.ts:969 |
| `packages/daemon/src/memory/foundation.ts:976` |  | packages/daemon/src/memory/foundation.ts:976 |
| `packages/daemon/src/memory/gitProtection.ts:269` |  | packages/daemon/src/memory/gitProtection.ts:269 |
| `packages/daemon/src/memory/gitProtection.ts:289` |  | packages/daemon/src/memory/gitProtection.ts:289 |
| `packages/daemon/src/memory/gitProtection.ts:292` |  | packages/daemon/src/memory/gitProtection.ts:292 |
| `packages/daemon/src/memory/gitProtection.ts:433` |  | packages/daemon/src/memory/gitProtection.ts:433 |
| `packages/daemon/src/memory/growth.ts:195` |  | packages/daemon/src/memory/growth.ts:195 |
| `packages/daemon/src/memory/snapshotForget.ts:39` |  | packages/daemon/src/memory/snapshotForget.ts:39 |
| `packages/daemon/src/memory/snapshotForget.ts:111` |  | packages/daemon/src/memory/snapshotForget.ts:111 |
| `packages/daemon/src/net/capToken.ts:19` |  | packages/daemon/src/net/capToken.ts:19 |
| `packages/daemon/src/obs/audit.ts:54` |  | packages/daemon/src/obs/audit.ts:54 |
| `packages/daemon/src/obs/audit.ts:60` |  | packages/daemon/src/obs/audit.ts:60 |
| `packages/daemon/src/obs/logger.ts:109` |  | packages/daemon/src/obs/logger.ts:109 |
| `packages/daemon/src/obs/logger.ts:110` |  | packages/daemon/src/obs/logger.ts:110 |
| `packages/daemon/src/obs/logger.ts:112` |  | packages/daemon/src/obs/logger.ts:112 |
| `packages/daemon/src/obs/valueReport.ts:40` |  | packages/daemon/src/obs/valueReport.ts:40 |
| `packages/daemon/src/projects/lifecycle.ts:70` |  | packages/daemon/src/projects/lifecycle.ts:70 |
| `packages/daemon/src/projects/lifecycle.ts:71` |  | packages/daemon/src/projects/lifecycle.ts:71 |
| `packages/daemon/src/projects/workspace.ts:130` |  | packages/daemon/src/projects/workspace.ts:130 |
| `packages/daemon/src/projects/workspace.ts:138` |  | packages/daemon/src/projects/workspace.ts:138 |
| `packages/daemon/src/providers/byoa/isolatedHome.ts:46` |  | packages/daemon/src/providers/byoa/isolatedHome.ts:46 |
| `packages/daemon/src/providers/byoa/isolatedHome.ts:52` |  | packages/daemon/src/providers/byoa/isolatedHome.ts:52 |
| `packages/daemon/src/providers/byoa/isolatedHome.ts:93` |  | packages/daemon/src/providers/byoa/isolatedHome.ts:93 |
| `packages/daemon/src/providers/byoa/isolatedHome.ts:98` |  | packages/daemon/src/providers/byoa/isolatedHome.ts:98 |
| `packages/daemon/src/providers/byoa/isolatedHome.ts:103` |  | packages/daemon/src/providers/byoa/isolatedHome.ts:103 |
| `packages/daemon/src/providers/byoa/isolatedHome.ts:105` |  | packages/daemon/src/providers/byoa/isolatedHome.ts:105 |
| `packages/daemon/src/providers/byoa/isolatedHome.ts:117` |  | packages/daemon/src/providers/byoa/isolatedHome.ts:117 |
| `packages/daemon/src/providers/byoa/isolatedHome.ts:142` |  | packages/daemon/src/providers/byoa/isolatedHome.ts:142 |
| `packages/daemon/src/providers/byoa/provider.ts:220` |  | packages/daemon/src/providers/byoa/provider.ts:220 |
| `packages/daemon/src/providers/byoa/provider.ts:224` |  | packages/daemon/src/providers/byoa/provider.ts:224 |
| `packages/daemon/src/providers/byoa/provider.ts:266` |  | packages/daemon/src/providers/byoa/provider.ts:266 |
| `packages/daemon/src/providers/byoa/provider.ts:282` |  | packages/daemon/src/providers/byoa/provider.ts:282 |
| `packages/daemon/src/providers/byoa/provider.ts:659` |  | packages/daemon/src/providers/byoa/provider.ts:659 |
| `packages/daemon/src/providers/byoa/provider.ts:660` |  | packages/daemon/src/providers/byoa/provider.ts:660 |
| `packages/daemon/src/providers/byoa/provider.ts:661` |  | packages/daemon/src/providers/byoa/provider.ts:661 |
| `packages/daemon/src/runtimeChildRegistry.ts:396` |  | packages/daemon/src/runtimeChildRegistry.ts:396 |
| `packages/daemon/src/runtimeChildRegistry.ts:980` |  | packages/daemon/src/runtimeChildRegistry.ts:980 |
| `packages/daemon/src/runtimeChildRegistry.ts:1001` |  | packages/daemon/src/runtimeChildRegistry.ts:1001 |
| `packages/daemon/src/runtimeChildRegistry.ts:1006` |  | packages/daemon/src/runtimeChildRegistry.ts:1006 |
| `packages/daemon/src/runtimeChildRegistry.ts:1014` |  | packages/daemon/src/runtimeChildRegistry.ts:1014 |
| `packages/daemon/src/runtimeChildRegistry.ts:1017` |  | packages/daemon/src/runtimeChildRegistry.ts:1017 |
| `packages/daemon/src/runtimeChildRegistry.ts:1104` |  | packages/daemon/src/runtimeChildRegistry.ts:1104 |
| `packages/daemon/src/runtimeChildRegistry.ts:1229` |  | packages/daemon/src/runtimeChildRegistry.ts:1229 |
| `packages/daemon/src/session/manager.ts:61` |  | packages/daemon/src/session/manager.ts:61 |
| `packages/daemon/src/session/manager.ts:112` |  | packages/daemon/src/session/manager.ts:112 |
| `packages/daemon/src/session/manager.ts:113` |  | packages/daemon/src/session/manager.ts:113 |
| `packages/daemon/src/tier1/adapter.ts:123` |  | packages/daemon/src/tier1/adapter.ts:123 |
| `packages/daemon/src/tier1/adapter.ts:125` |  | packages/daemon/src/tier1/adapter.ts:125 |
| `packages/daemon/src/tier1/backends/claude.ts:240` |  | packages/daemon/src/tier1/backends/claude.ts:240 |
| `packages/daemon/src/tier1/backends/cursor.ts:66` |  | packages/daemon/src/tier1/backends/cursor.ts:66 |
| `packages/daemon/src/tier1/backends/cursor.ts:68` |  | packages/daemon/src/tier1/backends/cursor.ts:68 |
| `packages/daemon/src/tier1/claudeIdentity.ts:56` |  | packages/daemon/src/tier1/claudeIdentity.ts:56 |
| `packages/daemon/src/tier1/claudeIdentity.ts:58` |  | packages/daemon/src/tier1/claudeIdentity.ts:58 |
| `packages/daemon/src/tier1/claudeIdentity.ts:59` |  | packages/daemon/src/tier1/claudeIdentity.ts:59 |
| `packages/daemon/src/tier1/executor.ts:1853` |  | packages/daemon/src/tier1/executor.ts:1853 |
| `packages/daemon/src/tier1/executor.ts:2125` |  | packages/daemon/src/tier1/executor.ts:2125 |
| `packages/daemon/src/tier1/executor.ts:2386` |  | packages/daemon/src/tier1/executor.ts:2386 |
| `packages/daemon/src/tier1/executor.ts:2845` |  | packages/daemon/src/tier1/executor.ts:2845 |
| `packages/daemon/src/tier1/executor.ts:2852` |  | packages/daemon/src/tier1/executor.ts:2852 |
| `packages/daemon/src/tier1/executor.ts:2922` |  | packages/daemon/src/tier1/executor.ts:2922 |
| `packages/daemon/src/tier1/executor.ts:3190` |  | packages/daemon/src/tier1/executor.ts:3190 |
| `packages/daemon/src/tier1/executor.ts:4290` |  | packages/daemon/src/tier1/executor.ts:4290 |
| `packages/daemon/src/tier1/executor.ts:4295` |  | packages/daemon/src/tier1/executor.ts:4295 |
| `packages/daemon/src/tier1/gateScript.ts:83` |  | packages/daemon/src/tier1/gateScript.ts:83 |
| `packages/daemon/src/tier1/gateScript.ts:84` |  | packages/daemon/src/tier1/gateScript.ts:84 |
| `packages/daemon/src/tier1/gateScript.ts:85` |  | packages/daemon/src/tier1/gateScript.ts:85 |
| `packages/daemon/src/tier1/gateScript.ts:95` |  | packages/daemon/src/tier1/gateScript.ts:95 |
| `packages/daemon/src/tier1/gateScript.ts:96` |  | packages/daemon/src/tier1/gateScript.ts:96 |
| `packages/daemon/src/tier1/gateScript.ts:97` |  | packages/daemon/src/tier1/gateScript.ts:97 |
| `packages/daemon/src/tier1/gateScript.ts:119` |  | packages/daemon/src/tier1/gateScript.ts:119 |
| `packages/daemon/src/tier1/gateScript.ts:315` |  | packages/daemon/src/tier1/gateScript.ts:315 |
| `packages/daemon/src/tier1/gateServer.ts:98` |  | packages/daemon/src/tier1/gateServer.ts:98 |
| `packages/daemon/src/tier1/restartPolicy.ts:342` |  | packages/daemon/src/tier1/restartPolicy.ts:342 |
| `packages/daemon/src/tier1/restartPolicy.ts:394` |  | packages/daemon/src/tier1/restartPolicy.ts:394 |
| `packages/daemon/src/tier1/restartPolicy.ts:412` |  | packages/daemon/src/tier1/restartPolicy.ts:412 |
| `packages/daemon/src/tier1/restartPolicy.ts:413` |  | packages/daemon/src/tier1/restartPolicy.ts:413 |
| `packages/daemon/src/tier1/s3Tools.ts:605` |  | packages/daemon/src/tier1/s3Tools.ts:605 |
| `packages/daemon/src/tier1/selfTest.ts:145` |  | packages/daemon/src/tier1/selfTest.ts:145 |
| `packages/daemon/src/tier1/selfTest.ts:161` |  | packages/daemon/src/tier1/selfTest.ts:161 |
| `packages/platform/src/fs.ts:96` |  | packages/platform/src/fs.ts:96 |
| `packages/platform/src/gate.ts:56` |  | packages/platform/src/gate.ts:56 |
| `packages/platform/src/gate.ts:60` |  | packages/platform/src/gate.ts:60 |
| `packages/platform/src/gate.ts:62` |  | packages/platform/src/gate.ts:62 |
| `packages/platform/src/homeLock.ts:88` |  | packages/platform/src/homeLock.ts:88 |
| `packages/platform/src/homeLock.ts:97` |  | packages/platform/src/homeLock.ts:97 |
| `packages/platform/src/homeLock.ts:119` |  | packages/platform/src/homeLock.ts:119 |
| `packages/platform/src/jobIdentity.ts:435` |  | packages/platform/src/jobIdentity.ts:435 |
| `packages/platform/src/jobIdentity.ts:438` |  | packages/platform/src/jobIdentity.ts:438 |
| `packages/platform/src/jobIdentity.ts:440` |  | packages/platform/src/jobIdentity.ts:440 |
| `packages/platform/src/jobIdentity.ts:443` |  | packages/platform/src/jobIdentity.ts:443 |
| `packages/platform/src/jobIdentity.ts:449` |  | packages/platform/src/jobIdentity.ts:449 |
| `packages/platform/src/jobIdentity.ts:451` |  | packages/platform/src/jobIdentity.ts:451 |
| `packages/platform/src/lock.ts:7` |  | packages/platform/src/lock.ts:7 |
| `packages/platform/src/lock.ts:10` |  | packages/platform/src/lock.ts:10 |
| `packages/platform/src/lock.ts:14` |  | packages/platform/src/lock.ts:14 |
| `packages/platform/src/open.ts:8` |  | packages/platform/src/open.ts:8 |

## module_dependencies (5)

| id | detail | sources |
|---|---|---|
| `packages/cli -> @saydo/contracts` |  | packages/cli/src/buildIdentity.ts:1; packages/cli/src/doctor.ts:10; packages/cli/src/probe.ts:12 +2 |
| `packages/cli -> @saydo/platform` |  | packages/cli/src/cli.ts:3; packages/cli/src/emergencyReaper.ts:28; packages/cli/src/open.ts:1 +5 |
| `packages/console -> @saydo/contracts` |  | packages/console/src/components/redesign/BoardLaneGroup.tsx:6; packages/console/src/components/redesign/ConfirmCard.test.tsx:3; packages/console/src/components/redesign/types.ts:5 +17 |
| `packages/daemon -> @saydo/contracts` |  | packages/daemon/scripts/demo-sample.ts:3; packages/daemon/src/api/acceptanceEvidence.ts:7; packages/daemon/src/api/attention.ts:13 +223 |
| `packages/daemon -> @saydo/platform` |  | packages/daemon/src/api/recoveryOnlyServer.ts:49; packages/daemon/src/config/cliRuntime.ts:8; packages/daemon/src/config/pending.ts:21 +29 |

## external_dependencies (55)

| id | detail | sources |
|---|---|---|
| `packages/cli:dependencies:better-sqlite3` | dependencies | packages/cli/package.json:0 |
| `packages/cli:dependencies:koffi` | dependencies | packages/cli/package.json:0 |
| `packages/cli:devDependencies:@saydo/contracts` | devDependencies | packages/cli/package.json:0 |
| `packages/cli:devDependencies:@saydo/platform` | devDependencies | packages/cli/package.json:0 |
| `packages/cli:devDependencies:@types/node` | devDependencies | packages/cli/package.json:0 |
| `packages/cli:devDependencies:esbuild` | devDependencies | packages/cli/package.json:0 |
| `packages/cli:devDependencies:typescript` | devDependencies | packages/cli/package.json:0 |
| `packages/cli:devDependencies:vitest` | devDependencies | packages/cli/package.json:0 |
| `packages/console:dependencies:@saydo/contracts` | dependencies | packages/console/package.json:0 |
| `packages/console:dependencies:class-variance-authority` | dependencies | packages/console/package.json:0 |
| `packages/console:dependencies:clsx` | dependencies | packages/console/package.json:0 |
| `packages/console:dependencies:lucide-react` | dependencies | packages/console/package.json:0 |
| `packages/console:dependencies:qrcode` | dependencies | packages/console/package.json:0 |
| `packages/console:dependencies:react` | dependencies | packages/console/package.json:0 |
| `packages/console:dependencies:react-dom` | dependencies | packages/console/package.json:0 |
| `packages/console:dependencies:tailwind-merge` | dependencies | packages/console/package.json:0 |
| `packages/console:devDependencies:@tailwindcss/vite` | devDependencies | packages/console/package.json:0 |
| `packages/console:devDependencies:@types/qrcode` | devDependencies | packages/console/package.json:0 |
| `packages/console:devDependencies:@types/react` | devDependencies | packages/console/package.json:0 |
| `packages/console:devDependencies:@types/react-dom` | devDependencies | packages/console/package.json:0 |
| `packages/console:devDependencies:@vitejs/plugin-react` | devDependencies | packages/console/package.json:0 |
| `packages/console:devDependencies:tailwindcss` | devDependencies | packages/console/package.json:0 |
| `packages/console:devDependencies:typescript` | devDependencies | packages/console/package.json:0 |
| `packages/console:devDependencies:vite` | devDependencies | packages/console/package.json:0 |
| `packages/console:devDependencies:vitest` | devDependencies | packages/console/package.json:0 |
| `packages/contracts:dependencies:@noble/hashes` | dependencies | packages/contracts/package.json:0 |
| `packages/contracts:dependencies:ulid` | dependencies | packages/contracts/package.json:0 |
| `packages/contracts:dependencies:zod` | dependencies | packages/contracts/package.json:0 |
| `packages/contracts:devDependencies:vitest` | devDependencies | packages/contracts/package.json:0 |
| `packages/daemon:dependencies:@saydo/contracts` | dependencies | packages/daemon/package.json:0 |
| `packages/daemon:dependencies:@saydo/platform` | dependencies | packages/daemon/package.json:0 |
| `packages/daemon:dependencies:better-sqlite3` | dependencies | packages/daemon/package.json:0 |
| `packages/daemon:dependencies:smol-toml` | dependencies | packages/daemon/package.json:0 |
| `packages/daemon:dependencies:ulid` | dependencies | packages/daemon/package.json:0 |
| `packages/daemon:dependencies:ws` | dependencies | packages/daemon/package.json:0 |
| `packages/daemon:dependencies:zod` | dependencies | packages/daemon/package.json:0 |
| `packages/daemon:devDependencies:@types/better-sqlite3` | devDependencies | packages/daemon/package.json:0 |
| `packages/daemon:devDependencies:@types/node` | devDependencies | packages/daemon/package.json:0 |
| `packages/daemon:devDependencies:@types/ws` | devDependencies | packages/daemon/package.json:0 |
| `packages/daemon:devDependencies:tsx` | devDependencies | packages/daemon/package.json:0 |
| `packages/daemon:devDependencies:vitest` | devDependencies | packages/daemon/package.json:0 |
| `packages/platform:dependencies:koffi` | dependencies | packages/platform/package.json:0 |
| `packages/platform:devDependencies:@types/node` | devDependencies | packages/platform/package.json:0 |
| `packages/platform:devDependencies:typescript` | devDependencies | packages/platform/package.json:0 |
| `packages/platform:devDependencies:vitest` | devDependencies | packages/platform/package.json:0 |
| `pipeline:dependencies:pipecat-ai` | dependencies | pipeline/pyproject.toml:0 |
| `pipeline:dependencies:websockets` | dependencies | pipeline/pyproject.toml:0 |
| `pipeline:devDependencies:pytest` | devDependencies | pipeline/pyproject.toml:0 |
| `pipeline:devDependencies:ruff` | devDependencies | pipeline/pyproject.toml:0 |
| `root:devDependencies:@eslint/js` | devDependencies | package.json:0 |
| `root:devDependencies:@playwright/test` | devDependencies | package.json:0 |
| `root:devDependencies:eslint` | devDependencies | package.json:0 |
| `root:devDependencies:typescript` | devDependencies | package.json:0 |
| `root:devDependencies:typescript-eslint` | devDependencies | package.json:0 |
| `root:devDependencies:wrangler` | devDependencies | package.json:0 |

## artifacts (9)

| id | detail | sources |
|---|---|---|
| `build_output:artifacts/release/copyright` | build_output | .github/workflows/release.yml:47 |
| `build_output:artifacts/release/github/${ENV}` | build_output | .github/workflows/release.yml:179 |
| `build_output:package/dist` | build_output | scripts/build-release-artifacts.mjs:81 |
| `release_asset:release-metadata.json` | release_asset | scripts/release-asset-manifest.mjs:34 |
| `release_asset:saydo-cli-${version}.tgz` | release_asset | scripts/release-asset-manifest.mjs:34 |
| `release_asset:SHA256SUMS` | release_asset | scripts/release-asset-manifest.mjs:34 |
| `tracked_manifest:docs/release/v0.1.0-rc.13-assets.json:release-metadata.json` | tracked_asset_manifest | docs/release/v0.1.0-rc.13-assets.json:0 |
| `tracked_manifest:docs/release/v0.1.0-rc.13-assets.json:saydo-cli-0.1.0-rc.13.tgz` | tracked_asset_manifest | docs/release/v0.1.0-rc.13-assets.json:0 |
| `tracked_manifest:docs/release/v0.1.0-rc.13-assets.json:SHA256SUMS` | tracked_asset_manifest | docs/release/v0.1.0-rc.13-assets.json:0 |

## support_facts (28)

| id | detail | sources |
|---|---|---|
| `app_tree:apps/android:37` | app_tree | apps/android:0 |
| `app_tree:apps/harmonyos:33` | app_tree | apps/harmonyos:0 |
| `app_tree:apps/ios:23` | app_tree | apps/ios:0 |
| `ci_matrix:.github/workflows/ci.yml:ubuntu-24.04,macos-15,windows-2022` | ci_matrix | .github/workflows/ci.yml:98 |
| `ci_matrix:.github/workflows/release.yml:ubuntu-latest,macos-latest,windows-latest` | ci_matrix | .github/workflows/release.yml:282 |
| `ci_runner:.github/workflows/ci.yml:macos-15` | ci_runner | .github/workflows/ci.yml:140 |
| `ci_runner:.github/workflows/ci.yml:ubuntu-24.04` | ci_runner | .github/workflows/ci.yml:117 |
| `ci_runner:.github/workflows/release.yml:ubuntu-latest` | ci_runner | .github/workflows/release.yml:339 |
| `engines:packages/cli:node=>=22 <23` | engines | packages/cli/package.json:0 |
| `engines:root:node=>=22` | engines | package.json:0 |
| `platform_guard:e2e/console/global-setup.ts:darwin` | platform_guard | e2e/console/global-setup.ts:22 |
| `platform_guard:e2e/console/global-setup.ts:linux` | platform_guard | e2e/console/global-setup.ts:22 |
| `platform_guard:e2e/journey01-browser/constants.ts:darwin` | platform_guard | e2e/journey01-browser/constants.ts:17 |
| `platform_guard:e2e/journey01-browser/constants.ts:linux` | platform_guard | e2e/journey01-browser/constants.ts:17 |
| `platform_guard:packages/daemon/src/brain/tools.ts:darwin` | platform_guard | packages/daemon/src/brain/tools.ts:32 |
| `platform_guard:packages/daemon/src/brain/tools.ts:win32` | platform_guard | packages/daemon/src/brain/tools.ts:31 |
| `platform_guard:packages/daemon/src/experimental/codex-app-server/processControl.ts:win32` | platform_guard | packages/daemon/src/experimental/codex-app-server/processControl.ts:65 |
| `platform_guard:packages/daemon/src/index.ts:win32` | platform_guard | packages/daemon/src/index.ts:3843 |
| `platform_guard:packages/daemon/src/memory/foundation.ts:win32` | platform_guard | packages/daemon/src/memory/foundation.ts:150 |
| `platform_guard:packages/daemon/src/projects/workspace.ts:win32` | platform_guard | packages/daemon/src/projects/workspace.ts:272 |
| `platform_guard:packages/daemon/src/runtimeChildRegistry.ts:linux` | platform_guard | packages/daemon/src/runtimeChildRegistry.ts:410 |
| `platform_guard:packages/daemon/src/runtimeChildRegistry.ts:win32` | platform_guard | packages/daemon/src/runtimeChildRegistry.ts:651 |
| `platform_guard:packages/daemon/src/tier1/backends/claude.ts:win32` | platform_guard | packages/daemon/src/tier1/backends/claude.ts:242 |
| `platform_guard:packages/daemon/src/tier1/executor.ts:win32` | platform_guard | packages/daemon/src/tier1/executor.ts:234 |
| `platform_guard:packages/daemon/src/tier1/gateScript.ts:win32` | platform_guard | packages/daemon/src/tier1/gateScript.ts:120 |
| `platform_guard:packages/daemon/src/tier1/gateServer.ts:win32` | platform_guard | packages/daemon/src/tier1/gateServer.ts:236 |
| `platform_guard:packages/daemon/src/tier1/selfTest.ts:win32` | platform_guard | packages/daemon/src/tier1/selfTest.ts:374 |
| `requires-python:>=3.11` | engines | pipeline/pyproject.toml:0 |

## legacy_candidates (54)

| id | detail | sources |
|---|---|---|
| `branch:codex/saydo-fortnight-audit` | branch | codex/saydo-fortnight-audit |
| `branch:codex/saydo-modular-foundation-20260929` | branch | codex/saydo-modular-foundation-20260929 |
| `branch:codex/saydo-unify-audit-20261003` | branch | codex/saydo-unify-audit-20261003 |
| `branch:main` | branch | main |
| `git_tag:archive/pg-01a-c1-red-20260831` | git_tag | archive/pg-01a-c1-red-20260831 |
| `git_tag:archive/pg02-pre-fortnight-20260927` | git_tag | archive/pg02-pre-fortnight-20260927 |
| `git_tag:archive/stash-main-tree-pre-checkout-20260909` | git_tag | archive/stash-main-tree-pre-checkout-20260909 |
| `git_tag:archive/week-audit-evidence-20260823` | git_tag | archive/week-audit-evidence-20260823 |
| `git_tag:archive/wip-consolidation-20260913` | git_tag | archive/wip-consolidation-20260913 |
| `git_tag:archive/wip-daily01-20260925` | git_tag | archive/wip-daily01-20260925 |
| `git_tag:archive/wip-handoff-20260912` | git_tag | archive/wip-handoff-20260912 |
| `git_tag:archive/wip-pg02-20260906` | git_tag | archive/wip-pg02-20260906 |
| `git_tag:archive/wip-research-20260922` | git_tag | archive/wip-research-20260922 |
| `git_tag:archive/wip-voice-runtime-20260923` | git_tag | archive/wip-voice-runtime-20260923 |
| `stash:2` | stash | stash@{0}: On main: saydo-unify-audit-20261003-main-premerge-recovery |
| `worktree:~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-api-code/candidate` | worktree | ~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-api-code/candidate |
| `worktree:~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-api-docs/candidate` | worktree | ~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-api-docs/candidate |
| `worktree:~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-complete-code/candidate` | worktree | ~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-complete-code/candidate |
| `worktree:~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-complete-docs/candidate` | worktree | ~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-complete-docs/candidate |
| `worktree:~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-final-code/candidate` | worktree | ~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-final-code/candidate |
| `worktree:~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-final-documents/candidate` | worktree | ~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-final-documents/candidate |
| `worktree:~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-final-documents/candidate-33` | worktree | ~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-final-documents/candidate-33 |
| `worktree:~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-run-code/candidate` | worktree | ~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-run-code/candidate |
| `worktree:~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-run-docs/candidate` | worktree | ~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-run-docs/candidate |
| `worktree:~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-terminal-code/candidate` | worktree | ~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-terminal-code/candidate |
| `worktree:~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-terminal-docs/candidate` | worktree | ~/.codex/tasks/saydo-unify-audit-20261003/reviews/accept-terminal-docs/candidate |
| `worktree:~/.codex/tasks/saydo-unify-audit-20261003/reviews/code/candidate` | worktree | ~/.codex/tasks/saydo-unify-audit-20261003/reviews/code/candidate |
| `worktree:~/.codex/tasks/saydo-unify-audit-20261003/reviews/docs/candidate` | worktree | ~/.codex/tasks/saydo-unify-audit-20261003/reviews/docs/candidate |
| `worktree:~/.codex/tasks/saydo-unify-audit-20261003/reviews/final-code/candidate` | worktree | ~/.codex/tasks/saydo-unify-audit-20261003/reviews/final-code/candidate |
| `worktree:~/.codex/tasks/saydo-unify-audit-20261003/reviews/final-docs/candidate` | worktree | ~/.codex/tasks/saydo-unify-audit-20261003/reviews/final-docs/candidate |
| `worktree:~/.codex/worktrees/saydo-d1-contract16-review17/SayDo` | worktree | ~/.codex/worktrees/saydo-d1-contract16-review17/SayDo |
| `worktree:~/.codex/worktrees/saydo-d1-contract16-review18/SayDo` | worktree | ~/.codex/worktrees/saydo-d1-contract16-review18/SayDo |
| `worktree:~/.codex/worktrees/saydo-d1-contract16/SayDo` | worktree | ~/.codex/worktrees/saydo-d1-contract16/SayDo |
| `worktree:~/.codex/worktrees/saydo-e64-review/SayDo` | worktree | ~/.codex/worktrees/saydo-e64-review/SayDo |
| `worktree:~/.codex/worktrees/saydo-e65-review/SayDo` | worktree | ~/.codex/worktrees/saydo-e65-review/SayDo |
| `worktree:~/.codex/worktrees/saydo-e66-review/SayDo` | worktree | ~/.codex/worktrees/saydo-e66-review/SayDo |
| `worktree:~/.codex/worktrees/saydo-e67-review/SayDo` | worktree | ~/.codex/worktrees/saydo-e67-review/SayDo |
| `worktree:~/.codex/worktrees/saydo-e68-review/SayDo` | worktree | ~/.codex/worktrees/saydo-e68-review/SayDo |
| `worktree:~/.codex/worktrees/saydo-e69-review/SayDo` | worktree | ~/.codex/worktrees/saydo-e69-review/SayDo |
| `worktree:~/.codex/worktrees/saydo-e70-review/SayDo` | worktree | ~/.codex/worktrees/saydo-e70-review/SayDo |
| `worktree:~/.codex/worktrees/saydo-e71-review/SayDo` | worktree | ~/.codex/worktrees/saydo-e71-review/SayDo |
| `worktree:~/.codex/worktrees/saydo-e72-review/SayDo` | worktree | ~/.codex/worktrees/saydo-e72-review/SayDo |
| `worktree:~/.codex/worktrees/saydo-e73-review/SayDo` | worktree | ~/.codex/worktrees/saydo-e73-review/SayDo |
| `worktree:~/.codex/worktrees/saydo-last-cross-code/SayDo` | worktree | ~/.codex/worktrees/saydo-last-cross-code/SayDo |
| `worktree:~/.codex/worktrees/saydo-last-cross-docs/SayDo` | worktree | ~/.codex/worktrees/saydo-last-cross-docs/SayDo |
| `worktree:~/.codex/worktrees/saydo-original-review-32/SayDo` | worktree | ~/.codex/worktrees/saydo-original-review-32/SayDo |
| `worktree:~/.codex/worktrees/saydo-owner17-canonical-review19/SayDo` | worktree | ~/.codex/worktrees/saydo-owner17-canonical-review19/SayDo |
| `worktree:~/.codex/worktrees/saydo-owner17-input-review20/SayDo` | worktree | ~/.codex/worktrees/saydo-owner17-input-review20/SayDo |
| `worktree:~/.codex/worktrees/saydo-owner18-review21/SayDo` | worktree | ~/.codex/worktrees/saydo-owner18-review21/SayDo |
| `worktree:~/.codex/worktrees/saydo-owner21-review31/SayDo` | worktree | ~/.codex/worktrees/saydo-owner21-review31/SayDo |
| `worktree:~/.codex/worktrees/saydo-owner21-review32/SayDo` | worktree | ~/.codex/worktrees/saydo-owner21-review32/SayDo |
| `worktree:~/.codex/worktrees/saydo-owner21-review33/SayDo` | worktree | ~/.codex/worktrees/saydo-owner21-review33/SayDo |
| `worktree:~/.codex/worktrees/saydo-unify-audit-20261003/SayDo` | worktree | ~/.codex/worktrees/saydo-unify-audit-20261003/SayDo |
| `worktree:~/WorkSpace/SayDo` | worktree | ~/WorkSpace/SayDo |
