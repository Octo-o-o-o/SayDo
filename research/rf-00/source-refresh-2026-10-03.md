# RF-00 2026-10-03 源码库存更新

整合旧运行修订与最新候选后，RF-00 静态输入发生真实漂移。本次保留各项来源与角色，重生成机械清单；不改 scanner 容错、PG-02 ledger/proof、未来 RF 模块实现或四项 dual_write_gap。

输入 HEAD 为 `4e80100b6ed540832ddb1245da67578ace7a5424` 加本轮实际修复。具体字节绑定在本轮整合审计的最终代码提交与门禁清单；旧 repair-3 分母不复用。

机械 corpus 摘要更新只证明当前 tracked 字节已入扫描队列，不表示整份文件语义审读或运行验收。新增/改变注册点另逐项读取；连续相等源行摘要的坐标迁移保留原语义处置，重复源行按同文件顺序对齐。各类当前分母以 inventory.md 与 acceptance-matrix A 节生成值为准，executed=0 不改写为业务执行通过。

| 处置 | 数量 |
|---|---|
| identical_source_coordinate_move | 31 |
| read_changed_or_new_source | 14 |
| read_console_consumer | 1 |
| read_file_writer_coordinate_move | 11 |

另有 122 个稳定 ID 的源坐标刷新、85 份 corpus 元数据刷新。逐项如下；日志与完整前后值保存在本轮任务 `evidence/implementation/rf00-refresh-decisions-03.json`。

| 当前项 | 来源/原坐标 | 本次判定 |
|---|---|---|
| `e2e/console/console.spec.ts:121` | `e2e/console/console.spec.ts:120` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `e2e/console/console.spec.ts:132` | `e2e/console/console.spec.ts:131` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `e2e/console/console.spec.ts:146` | `e2e/console/console.spec.ts:145` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `e2e/console/console.spec.ts:41` | `e2e/console/console.spec.ts:40` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `e2e/console/console.spec.ts:444` | `e2e/console/console.spec.ts:443` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `e2e/console/console.spec.ts:48` | `e2e/console/console.spec.ts:47` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `e2e/console/fortnight-audit.spec.ts:108` | `e2e/console/fortnight-audit.spec.ts:108` | 最近会话读取测试注入历史 turn 并计数重载请求；不当作真实会话验收。 |
| `e2e/console/fortnight-audit.spec.ts:128` | `e2e/console/fortnight-audit.spec.ts:128` | 最近会话测试的 500 负例，核失败提示与旧内容不残留。 |
| `e2e/console/fortnight-audit.spec.ts:136` | `e2e/console/fortnight-audit.spec.ts:136` | 验收引用测试注入 verify:missing 与旧 pass，核未绑定成功回执时仍阻断。 |
| `e2e/console/fortnight-audit.spec.ts:15` | `e2e/console/fortnight-audit.spec.ts:15` | Playwright 看板 fixture 路由拦截，构造 Focus/detail；不是生产 HTTP 服务注册。 |
| `e2e/console/fortnight-audit.spec.ts:153` | `e2e/console/fortnight-audit.spec.ts:153` | writing 测试逐 attempt 注入任务详情，核人工裁决不跨 attempt 继承。 |
| `e2e/console/fortnight-audit.spec.ts:16` | `e2e/console/fortnight-audit.spec.ts:16` | 上项 fixture 从请求 URL 取 pathname 分派模拟数据；不是新业务路由。 |
| `e2e/console/fortnight-audit.spec.ts:29` | `e2e/console/fortnight-audit.spec.ts:29` | 看板测试将 attention 回包设空，以核 Focus 保留；属于模拟消费输入。 |
| `e2e/console/fortnight-audit.spec.ts:30` | `e2e/console/fortnight-audit.spec.ts:30` | 任务打开目标测试刻意返回 404，不证明真实 Task 服务可用。 |
| `e2e/console/fortnight-audit.spec.ts:50` | `e2e/console/fortnight-audit.spec.ts:50` | 桌面与移动只读安排测试注入两条依赖标题；不是新增生产端点。 |
| `e2e/console/fortnight-audit.spec.ts:91` | `e2e/console/fortnight-audit.spec.ts:91` | 项目记忆测试注入空项目列表，与最近记忆入口分开。 |
| `e2e/console/fortnight-audit.spec.ts:92` | `e2e/console/fortnight-audit.spec.ts:92` | 最近记忆测试注入未关联 M1 与候选 M2，核只读呈现不提供批准。 |
| `e2e/console/journey-01-seven-step.spec.ts:196` | `e2e/console/journey-01-seven-step.spec.ts:199` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `e2e/console/journey-01-seven-step.spec.ts:204` | `e2e/console/journey-01-seven-step.spec.ts:207` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `e2e/console/journey-01-seven-step.spec.ts:279` | `e2e/console/journey-01-seven-step.spec.ts:282` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `e2e/console/journey-01-seven-step.spec.ts:45` | `e2e/console/journey-01-seven-step.spec.ts:44` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `e2e/console/journey-01-seven-step.spec.ts:58` | `e2e/console/journey-01-seven-step.spec.ts:57` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/cli/test/emergency-reaper.test.ts:491` | `packages/cli/test/emergency-reaper.test.ts:470` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/cli/test/emergency-reaper.test.ts:537` | `packages/cli/test/emergency-reaper.test.ts:516` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/cli/test/options.test.ts:58` | `packages/cli/test/options.test.ts:58` | CLI help 参数测试传入非法相对 HOME，核帮助路径不误走运行初始化。 |
| `packages/cli/test/options.test.ts:66` | `packages/cli/test/options.test.ts:66` | CLI 未知命令负例断言错误携用法提示，未启动 CLI 或业务任务。 |
| `packages/cli/test/options.test.ts:79` | `packages/cli/test/options.test.ts:79` | CLI 敏感参数负例逐 argv 调解析器，核错误不回显原始值。 |
| `packages/daemon/src/experimental/codex-app-server/cli.ts:68` | `packages/daemon/src/experimental/codex-app-server/cli.ts:66` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/daemon/src/index.ts:3407` | `packages/daemon/src/index.ts:3406` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/daemon/src/index.ts:3414` | `packages/daemon/src/index.ts:3413` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/daemon/src/index.ts:3415` | `packages/daemon/src/index.ts:3414` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/daemon/src/index.ts:3417` | `packages/daemon/src/index.ts:3416` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/daemon/src/index.ts:3844` | `packages/daemon/src/index.ts:3843` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/daemon/src/index.ts:3853` | `packages/daemon/src/index.ts:3852` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/daemon/src/index.ts:4088` | `packages/daemon/src/index.ts:4087` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/daemon/test/callback-email.test.ts:494` | `packages/daemon/test/callback-email.test.ts:486` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/daemon/test/callback-email.test.ts:499` | `packages/daemon/test/callback-email.test.ts:491` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/daemon/test/tier1-executor.test.ts:2786` | `packages/daemon/test/tier1-executor.test.ts:2779` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/daemon/test/tier1-executor.test.ts:2812` | `packages/daemon/test/tier1-executor.test.ts:2805` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/daemon/test/tier1-executor.test.ts:2814` | `packages/daemon/test/tier1-executor.test.ts:2807` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/daemon/test/tier1-executor.test.ts:5124` | `packages/daemon/test/tier1-executor.test.ts:5117` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/daemon/test/tier1-executor.test.ts:5125` | `packages/daemon/test/tier1-executor.test.ts:5118` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/platform/src/win32.ts:2327` | `packages/platform/src/win32.ts:1757` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/platform/src/win32.ts:2330` | `packages/platform/src/win32.ts:1760` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/platform/src/win32.ts:2350` | `packages/platform/src/win32.ts:1780` | 同文件连续源行摘要相等，保留原角色/映射；不新增运行通过结论 |
| `packages/daemon/src/experimental/codex-app-server/cli.ts:36` | `packages/daemon/src/experimental/codex-app-server/cli.ts:34` | writeReport:可选 --report 路径写 JSON 报告(experimental spike)。 |
| `packages/daemon/src/tier1/executor.ts:1853` | `packages/daemon/src/tier1/executor.ts:1847` | runDir:mkdirSync(tier1/runs/<runId>)。 |
| `packages/daemon/src/tier1/executor.ts:2125` | `packages/daemon/src/tier1/executor.ts:2119` | writeFileSync(frozen-verify.json)verify 冻结清单(S3 重跑依据)。 |
| `packages/daemon/src/tier1/executor.ts:2386` | `packages/daemon/src/tier1/executor.ts:2380` | consumeEventLine:appendFileSync(events.jsonl;失败记 eventPersistenceError 不停 run)。 |
| `packages/daemon/src/tier1/executor.ts:2845` | `packages/daemon/src/tier1/executor.ts:2839` | verify 失败即落 verify.json(败因证据)再 finalizeFailure。 |
| `packages/daemon/src/tier1/executor.ts:2852` | `packages/daemon/src/tier1/executor.ts:2846` | writeFileSync(verify.json)全量 verify 结果。 |
| `packages/daemon/src/tier1/executor.ts:2922` | `packages/daemon/src/tier1/executor.ts:2916` | writing 面:verifyResults>0 时落 verify.json。 |
| `packages/daemon/src/tier1/executor.ts:3190` | `packages/daemon/src/tier1/executor.ts:3183` | execVerify:mkdirSync(verify-home 隔离 HOME;只建不删)。 |
| `packages/daemon/src/tier1/executor.ts:4290` | `packages/daemon/src/tier1/executor.ts:4276` | establishAgentOwnership:withHomeOwnerBoundary 内 writeFileSync(agent.pid,0o600)legacy 锚。 |
| `packages/daemon/src/tier1/executor.ts:4295` | `packages/daemon/src/tier1/executor.ts:4281` | ownershipRequired!==true(测试注入)时 rmSync(agent.pid)防假锚。 |
| `packages/daemon/src/tier1/s3Tools.ts:605` | `packages/daemon/src/tier1/s3Tools.ts:606` | S3 合并链:mkdirSync(merge-verify-home)冻结 verify 重跑隔离 HOME。 |
| `api.recentMemory` | `api.recentMemory` | GET /api/memory/recent 的消费投影；daemon 读取最近记忆，Memory 页面用它呈现未关联项目的记忆；不提供候选批准写口。 |

源文件元数据刷新清单（机械级）：

- `apps/ios/SayDo/DesktopProfile.swift`：`e76eced1b0d628666aebcb870a0f8b1f143fbc735798c707fa871e1f27aba9b7`。
- `e2e/console/console.spec.ts`：`341a3018db3ac1a735ca68f5cb606d9aa036124d3439397d48057dc1bf7af412`。
- `e2e/console/fortnight-audit.spec.ts`：`cd110f01d8d95c46bb0822c54275167015c66239c22fd6c9179bc650e1e624e1`。
- `e2e/console/global-setup.ts`：`5eecc132ec1d3b411f2587d9bbb524156f98fb7d33ccc82cba5d2b55fc921db5`。
- `e2e/console/journey-01-seven-step.spec.ts`：`ac4d25d174a0e20492052d0f2cdf123305bda182c88677906c78a3a6f935afb1`。
- `e2e/journey01-browser/journey01-npm-negative.spec.ts`：`1d0b593fcacd58642eb0fd62bd31a152a741852dd7dc5c15fbbe088b7de3960c`。
- `packages/cli/src/options.ts`：`f4491fc0cc471e1b9212a348e6565661d424f3c99e36d84d7a93b751735d5dc2`。
- `packages/cli/src/supervisor.ts`：`6073dc9a9c1b7de998f5a63c77dab9abf01d5f7baed3a4da1cc9f93ff5e6275d`。
- `packages/cli/test/emergency-reaper.test.ts`：`04206edbc940cc770a3cbbb9e977910bb825768550911735b682ee9d4f3a97fa`。
- `packages/cli/test/options.test.ts`：`bddf3554aaedc187cf7a2817d0706a5a67bf25254b22032e42409e7415dfa465`。
- `packages/console/src/App.tsx`：`9fd3ecfffb9754fee17b9b52dd066fe7c43a7a53387fc564d569766d0e52ad46`。
- `packages/console/src/components/RecentConversation.tsx`：`ab77e040c38049f0e8cb6b8ccd7421ecae463d7755e27d452d8b690f35a4d1f3`。
- `packages/console/src/components/redesign/BoardLaneGroup.tsx`：`6e3c478fe9904c86d18df1b653b34249452bc9c7b0a4b490a3bf73070d7647b2`。
- `packages/console/src/components/redesign/ReviewPanel.test.tsx`：`1b41c8353e759ee8bb97bbfe9dbcd028dac54498c7c51f11d2cdc6bd90efecaf`。
- `packages/console/src/components/redesign/ReviewPanel.tsx`：`654649d214f5492db951efd52a435efec2853d2065e58b8921c7c7a3a3b83d39`。
- `packages/console/src/components/redesign/types.ts`：`3e21150e33c3ec48892dc667f1132616660675f66eac532d5b21730a357f1484`。
- `packages/console/src/hooks/redesign/mappers.test.ts`：`3a2dc0d9446fb7d76af9880972959466c58dc72ffee1ec55fd55c96902782560`。
- `packages/console/src/hooks/redesign/mappers.ts`：`f04f33f1ba18f82d73bee412cff957d5177474cba4f1ba210a2690d725fc8526`。
- `packages/console/src/hooks/redesign/useBoardPageData.test.ts`：`f3097487f2e2307736ee302b87cdf03277a01a164847adb3443c28e23a2208e6`。
- `packages/console/src/hooks/redesign/useBoardPageData.ts`：`85ef7b4a8992405f0033b0554c6c436d1c24a82cfd7693630109fd67b0b708d6`。
- `packages/console/src/lib/acceptanceEvidenceGate.test.ts`：`91f0f3cbbc9953312cfa199ed6e65ac5c256bebb42ef982f45389eb6564e4a5d`。
- `packages/console/src/lib/acceptanceEvidenceGate.ts`：`8a4455e6a3eac40c6ff9cc28614614580b92d6ad72fd9ba5db27779f89f3527f`。
- `packages/console/src/lib/api.ts`：`5360e5fd4bb846377f4005390d992ac359db70dedca298d3a1293138f40eed05`。
- `packages/console/src/lib/recentTranscript.ts`：`9f709944854bcf6234562fdb7a0df1f12a750f70f16bea1f1af176e6c53d71c7`。
- `packages/console/src/lib/router.ts`：`bd6a89855b8fea93530eaedbde835741f1b2f8a5cdc6e8a51475972ed2ebf8c0`。
- `packages/console/src/mobile/data.ts`：`5373bc705993fa2c522b7b7c1cf046ec77d95462191a93433e8ecf439f37fd2f`。
- `packages/console/src/mobile/pages/LedgerPages.tsx`：`cb62d848c73e311d33e5c96f1316062e6ef4b9817f9a87dd688cb1d46763e530`。
- `packages/console/src/mobile/router.test.ts`：`97dcaf22fb1ec07ed9d2d5150e84b38ca10bca2b54e624ec0284b263a44f64b5`。
- `packages/console/src/mobile/router.ts`：`79d49de35d3413839708f919da6ced566e151595176453d137907e3ec952e8ee`。
- `packages/console/src/pages/Arrangements.tsx`：`fabda623740b2d1edcce1e2f9b0c007c78ca97744709a9d8d2efb5cfd99cf821`。
- `packages/console/src/pages/Chat.tsx`：`47020ec83c8bcb24f6209d44f55efc79771a99a37be23e74094f13b1ab84d7dc`。
- `packages/console/src/pages/Memory.tsx`：`08d55499a279eded9bd2b62ead3d6e966861881be36dda75689b6706cf6d1067`。
- `packages/console/src/pages/TaskDetail.test.tsx`：`0439278c28026196bbc7b6bac826ff4383744cb77613ec1c4bd5dc47585d63ce`。
- `packages/console/src/pages/TaskDetail.tsx`：`6db8ec95e055d32c4026dad8eace268c45e7895740b6043975f809c8251850c4`。
- `packages/console/src/pages/redesign/BoardPage.tsx`：`335820b0d0b05f148726a93370413baf6cba26cf2c0ff054d968dd3ead0793ef`。
- `packages/console/src/pages/redesign/FocusPageRoute.tsx`：`d30748863064523ac623d31a9a3341cba7aaadd5a1b26469e7c37b0946f94194`。
- `packages/console/src/pages/redesign/ReviewPageRoute.tsx`：`b03c0fa154b917d73d269446ba7971259cd9d9b70547137653a894faf3c8e4a6`。
- `packages/console/src/pages/redesign/focusEntryActions.ts`：`0ed2540745f8df2f1780f857615ca89f164644c867ca7d36cd6790231674bdac`。
- `packages/console/src/shell/Layout.tsx`：`596a76456aebb669a460bef85805a5f706102c3a3b7816020d89f09dbf3ef546`。
- `packages/contracts/src/index.ts`：`e6b06946e14f4c6f55ee4e0c9831d96ee934aaf97b91b5a657aa4569e23eb74d`。
- `packages/contracts/src/types/pipeline.ts`：`3085c0e26c231f85a230b916640420b3a13eccd612b05fd2109c4332a7ed7e14`。
- `packages/contracts/src/types/tools.ts`：`be18a0813206b670b4e0e1c48038b918957c85fd4e083d86be11261ee671319a`。
- `packages/contracts/test/voice-barrier-schema.test.ts`：`12c7a2e30ff4ecf43ab090d9ff1c7be953f2f24b4ced6a4b1d0151546efe0955`。
- `packages/daemon/src/api/acceptanceEvidence.ts`：`a731455a8f10a56a318e817b42243d210ee95e1d0b2b40cf8acfd0f94310d40f`。
- `packages/daemon/src/api/firstRun.ts`：`a92def49e0b69afa83a319e80b575902f4af4080a5d0c4634f43e9bb351acfda`。
- `packages/daemon/src/api/focuses.ts`：`7efe7259cf8b033a5abc4b888b55c76806b2f1c51bb8767412c4d37e1396a62c`。
- `packages/daemon/src/api/obligations.ts`：`09826d9c34a0cc50078054cb93cc52c782c1f0a3f85f54fe46aa0c29175a3c5f`。
- `packages/daemon/src/brain/tools.ts`：`dc559c05c8bcc684dd915ec5fc2e99e8d04d98af4fcd686b81e9529f81f4e86b`。
- `packages/daemon/src/callback/email.ts`：`a91f9845c16b097348f00e53bc8f620e1b936651afb0dc54cab8a8802d48d764`。
- `packages/daemon/src/experimental/codex-app-server/cli.ts`：`6fb3cc820dc0f032f839d8725ec5743de98d0cbac4e8b3ab2994673f30bd25dd`。
- `packages/daemon/src/experimental/codex-app-server/session.ts`：`9c4a19865b6dbcb1e3d1cf187c7a773d2725294a0a10fe6d01208aaba58f12d6`。
- `packages/daemon/src/focus/registry.ts`：`db60b7dbbc0b34161697f0deaa1af83272507a6dda89c8fecfc4758c4b746860`。
- `packages/daemon/src/focus/writeTx.ts`：`4ab6562cb009c7831fd14cc98066fa9fc9fd6b58d935d2c47ca8f85415754d04`。
- `packages/daemon/src/index.ts`：`da65166a22a1c55322c812a9fe94a2d1e33cfeeccb290e142a31bf23049bacaf`。
- `packages/daemon/src/obs/sentenceTurn.ts`：`341d9050dd9225396131f968b55f34e7f756a7e84896c1c202381919caba7fe4`。
- `packages/daemon/src/runtimeChildRegistry.ts`：`8eedaff8f21a5d967b531ba5b267dcc55445f3e74fbeafdf231f093fe7679ef6`。
- `packages/daemon/src/storage/dao/tasks.ts`：`57d686805082a73b406a093b1278c6ab389c8f6b990f19eee830511b260c3488`。
- `packages/daemon/src/storage/ddl.ts`：`07d4ac82984a277ec8d4b85b79db04e65831769edd0f853acee290c67711d872`。
- `packages/daemon/src/tier1/executor.ts`：`79659844657764514600c6e80aaf559c39bce5a39398c53144d5781dc895768c`。
- `packages/daemon/src/tier1/operations.ts`：`0c323f47cddb3ba01b857ea414a7a597ba6b3fb2301b37044c66d86ed4a03173`。
- `packages/daemon/src/tier1/s3Tools.ts`：`dd5bf3c39d5933d59b8293ea02f27100632bed6fc05010972e944d1f3be9d742`。
- `packages/daemon/test/acceptance-evidence.test.ts`：`276dd1e6c2a644d7f050631bd8e81b920bcdacf8341b9225b03513623c5774dc`。
- `packages/daemon/test/callback-email.test.ts`：`7a1d2258f0f335dedcc2b26d10109f3e9391f56604405ea252f7bf0e4c6624ee`。
- `packages/daemon/test/codex-app-server/boundaries.test.ts`：`540d8449e1ae58437f4110ddc33a94666444709547a04b34f8d411732b871f9c`。
- `packages/daemon/test/codex-app-server/entries.test.ts`：`facf5d94bc92e783bb9b5cb242f2080635b17c0c4b4e6ed47e90804423cab54e`。
- `packages/daemon/test/codex-app-server/session.test.ts`：`770aa58d6510281fdac0d2ddcfb99dab46912f37ff6a48476b48c48ab9908865`。
- `packages/daemon/test/ddl-v32-v33-backup.test.ts`：`ab48d6c2d619e0057786281db36efff374060f71d03765db3bba1c2673777cd5`。
- `packages/daemon/test/focus-daily01.test.ts`：`83d3902a626d254a276e31f271b0173987acd29aa8267dbb475274f26dc5ee84`。
- `packages/daemon/test/focus-services.test.ts`：`2c540e88598616bfc0779695fe06872a2b3bc9738a8aa3c458ce008eb0509336`。
- `packages/daemon/test/s3-merge-chain.test.ts`：`c5ebc68e6dfc31b2257f87c63ee3c19a394d89ac89ea2261ee17193f8f8533c9`。
- `packages/daemon/test/sentence-turn.test.ts`：`39950cab0900c61857cea3568a6f6ac8441ad7dc486fe18a47a8918f038bc8ef`。
- `packages/daemon/test/storage-migration-v5.test.ts`：`22c472e50e89e9980ec8591390cec4a304e600e50d7c0085f37d6165ac63322a`。
- `packages/daemon/test/tier1-executor.test.ts`：`22d3fe2b4968ec4788d79506e33bd344abf5875f479c36a7d8d830a37ea4214a`。
- `packages/daemon/test/tier1-operations.test.ts`：`3751992764978eee7b4f2fe0ecb5369ed867bc2f5a89880a0001483eb49e1f90`。
- `packages/daemon/test/tools.test.ts`：`1b4d7526e84202a157ab4047272a099623a3a492011b65f69e52b9e76c875d99`。
- `packages/daemon/test/win32-native-pipe-consumer.test.ts`：`38b13d1b1b02569bd4ef63c8c73463641777744b81b0750e1ebc92f23dc327d3`。
- `packages/platform/src/index.ts`：`733c3ea4e87922fe9b941954d7e777606e7b6fe2f7197d3a8b576e961c4f2df2`。
- `packages/platform/src/win32.ts`：`b93993c2b2149dd23af07312e9f8328d3694c351d4843f9f0a0de4bf1e1ab20c`。
- `packages/platform/test/win32-acl-readback.test.ts`：`50ac3c76a003eb14ef5605f5c68691ca0c1ca99946ef75211785109b5991088e`。
- `packages/platform/test/win32-native-pipe-completion.test.ts`：`c3353ef52f97505ae5e366615e48b65dbaeab241ec7e92d9e18c74809dbcf9fe`。
- `packages/platform/test/win32-native-pipe.test.ts`：`b53b5e72e816348376f37e3c9a4e0496127cbcd4e7efc6c26814a2a663359daf`。
- `pipeline/src/saydo_pipeline/hf_round.py`：`06d68c92e21f9f91ec57fef53102a0ce2984583215a9b801efbcd6a1ee227da9`。
- `pipeline/src/saydo_pipeline/hub_client.py`：`b19d1584aeac9b6626c09b43f88cfa5c0bde8324e9fe6c9e6ad92fbb8702d3ff`。
- `pipeline/tests/test_hf_record_order.py`：`5a4b3284308a3efd43591b6f38ac34ab326dee9c459c86a550dc06cd1c59cc79`。
- `pipeline/tests/test_voice_measure_eou_tts.py`：`7732390b1661e649392b135c042e60a8eda2424b407203223ab9eac881a84bea`。

四项已知多写缺口仍是 pending_confirmations/confirmation_ledger 的 index.ts 写面，以及 focus_events/focuses 的 live/confirm.ts 写面；此更新不将它们写成已收拢。fixtures、designed、declared_only 与生产证明分开，后续 RF-01..11 的服务、设备、制品与幂等/统一准入验收未由本清单完成。

后续真实 --check 发现并修正两项引用漂移：brain/tools.ts 的同一模型请求源行由112移到113，源行摘要与原绑定相等；旧 stash:1 的序号随宿主新恢复stash改变，原处置原文保存在 historical_item_dispositions，当前以 archive/stash-main-tree-pre-checkout-20260909（对象5b9e158a1382de4c30f88fa4a043ea4e71e3ee58）的具名不可变tag登记。同一来源未删除、未消费，checker规则不改。

对上述31项坐标迁移，已从d023ffce找到与旧corpus SHA完全相等的各源Git blob，并逐项核对完整最近函数/注册语句、具名handler参数与外层if/case分支；31项局部区域字节和句法上下文均相等。后续journey默认输出路径收束导致测试源行再次整体移动，最终坐标以inventory与semantic-claims为准。该核对不证明外部helper的数据流、权限、owner或PG02来源闭合；85份source corpus摘要更新仍只是机械入队记录，不冒充85份runtime验收。完整前后摘录保存在rf00-move-context-readback.json。

## 初次独立评审之后的普通回修库存

初次评审固定输入为 `2ff490c2`，结论 FAIL，不能随本段刷新自动改绿。本段输入为 canonical 固定 `a97b9dfd` 加已授权普通回修源码；对应最终代码 ref 与运行状态见本轮整合审计。当前机械源宽计数 849，其中 846 进入六语言 source_corpus 字节绑定，另 3 份 kts 参与有限文件写词表。kts 中 ProcessBuilder/keytool/debug.keystore 副作用不由该绑定/词表证明，RF-10 真实 Android 构建验收仍未建立。

本次新增 7 个测试装配/隔离模拟注册点，逐项读取如下。另有 54 个坐标迁移逐项对比具名 handler/function、分支条件及直接 owning region，全部字节相同；这允许保留原处置，不是全部文件或外部 helper 语义通过。初次库存更新的独立上下文摘录共 31 项，亦全部直接 region 相同；源行 SHA 本身不当权限/准入/owner 证明。

本次 14 份源的摘要/注册点集合变化只登记机械 source census；实际 runtime 范围读具名门禁结果，不把未命中或 fixture 通过改成产品 GREEN。该阶段 item_dispositions 共 1371 项；四项 dual_write_gap 对象与原值完全相同。

| 新注册点 | 本次归类与边界 |
|---|---|
| `packages/daemon/test/helpers/playwright-isolation.ts:5` | 测试装配 helper 引入 node:net 工厂；不提供业务 HTTP/WS 服务。 |
| `packages/daemon/test/helpers/playwright-isolation.ts:29` | 启动前临时空 TCP listener 探测独占端口；探针只关闭自己创建的 listener，不接管既有服务。 |
| `packages/daemon/test/helpers/playwright-isolation.ts:37` | 独占 listen 的端口预检，依次覆盖实际127 loopback/wildcard/IPv6；错误拒占，成功即关探针，不作daemon ready证明。 |
| `packages/daemon/test/playwright-isolation.test.ts:6` | 隔离负向测试引入 HTTP 工厂；只服务本轮 owned ephemeral listener，不是产品HTTP入口。 |
| `packages/daemon/test/playwright-isolation.test.ts:46` | 真实 ephemeral HTTP listener 用于端口占用和HMAC健康证明正负例，不承载业务路由。 |
| `packages/daemon/test/playwright-isolation.test.ts:48` | 健康模拟按测试参数构造回包，HTTP200 foreign与owned token proof分开；fixture通过不当产品ready/native证明。 |
| `packages/daemon/test/playwright-isolation.test.ts:51` | 测试server监听127.0.0.1随机端口，afterEach只回收本测试创建的server，不触碰他轮listener。 |

完整逐项来源/前后 hash 与上下文在本轮任务 `evidence/implementation/rf00-refresh-decisions-11.json`、`rf00-move-context-readback-11.json`；早轮 `rf00-refresh-decisions-03.json`、`rf00-move-context-readback.json` 保留。验收矩阵各类分母以本轮实际 --write/--check 为准，不改 PG-02 ledger/proof，也不将 designed/declared_only/fixture 变为业务已验。

本轮后续修正还更新了七个已绑定源的当前字节摘要，没有新增注册点或改变原四项双写缺口。测试装配的 Windows 进程组清理分支移入共有 helper 后，原 `e2e/console/global-setup.ts` 与 `e2e/journey01-browser/global-setup.ts` 的两条 `win32` 机械坐标已不再命中现役扫描；原处置对象在本轮外部证据 `rf00-obsolete-support-coordinates-16.json` 保全，现役映射退出这两条旧坐标。七个源摘要更新只登记源码普查；权限、无变化写入与隔离测试的实际结果另见本轮审计，不由摘要证明运行正确。

冻结前现役库存精确读回：宽产品源 849，六语言 source_corpus 846；16 个机械类，645 个注册候选点，item_dispositions 1369 项（1280 verified_semantics、14 excluded_nonproductive、15 migration_only、4 dual_write_gap、55 declared_only、1 observed_fact）。1371 是两条旧平台坐标退出前阶段值；本段计数是源码/处置普查，不是 1369 项业务运行接受。legacy 当前落盘快照枚举 28 项、具名 selected 17 项，A 行与处置绑定该快照，fresh 本机 worktree 增减只记新运行元数据，不据此宣称全部产品语义已验。真实 Git worktree 增加/移除反例与三面一致性、篡改负例见本轮审计记录；stable/source/effect 门未豁免。

## 六 API 同库审计回修的库存增量

固定 546 的后继普通回修新增 3 份受跟踪 TS 源（事务能力与两份真实 SQLite 回归），修改 6 个 API 与 5 份旧成功夹具。10 个 WS 测试注册点只因导入真实 SQLite sink 后移一行；已核具名 nextJson/onAck/upgrade/listen 上下文未改，仍是 fixture。5 个具名表写面明确改为状态、事件、审计同库锁窗，实际逐入口回滚与正例见整合报告。其余源摘要更新只绑定本次机械语料，不把 source SHA 当整份文件语义或 PG 证明。四项旧 dual_write_gap 保持原对象。当前分母见生成 inventory 与矩阵 A；逐项增量在任务 evidence/implementation/rf00-refresh-api-26.json。

## 语音存储、结算、归属与日志普通回修

本次按现有 09§10.1/11§5.10/E3 修当前稿持久化失败阻断、串行异常结算、旧稿未知读取拒覆写、管线 producer/logger 摘要及入站 PCM 所属代次；daemon 另收束回执 32/256、legacy HF 真实 FIFO 所属、已登记接收者 ACK 与 parser/schema 错误摘要。ADR 私有/公开 CI 原因分仓按当次信号限定。16 个既有注册坐标按具名 handler/function 周边 delta 读取后投影，2 个新注册仅是未 listen 的 VoiceHub 测试夹具，不提升生产能力。精确增量见任务外 voice-storage-log-I7-58/rf00-source-refresh-67.json；当前分母以生成器为准。源码摘要绑定只证明机械输入，四项原 dual_write_gap 与 13 个旧边界源保持，不称 PG/native/provider 或全文件语义通过。

## Focus 绑定任务详情局部失败回修

SUP-FOCUS-PARTIAL-11以Focus绑定读口决定任务成员，按同id详情补齐；读失败保留真实绑定标题/状态，工作面与上下文显示缺详情且只提供读取/重读，禁止显示未知attempt/成本/包证据或启用写动作。7份源（6份原源与1份新故障注入测试）更新语料摘要；所有稳定机械类别/注册点exact-set未变化，四项dual_write_gap对象保持。实际逐点读取范围与前后摘要见任务外focus-partial-I8-73/rf-source-refresh-77.json，35局部测试/type/lint是作者验证，不当全文件语义或全产品验收。分母以真实生成器为准。


## I9 风险未知与离线自测回修（作者具名范围）

11§2.6 文案先固定为 `a3833035e57db8377e6d43d7dc589ba6fa7c9cf9`，两个只读视角核现有09§3/6.1一致后才改风险展示。TaskView null 是只读投影缺数据；合法S0–S3保留，缺失/null/非法不默认S1，不从任务状态/最大收据推导，S3强认证独立不变。

本次六个产品 source_corpus 字节变动逐块读取如下；其余稳定类 exact-set 没有变化。两处EOF仅收成单LF，去掉尾换行后与E8逐字节相同。四个dual_write_gap原对象保留，不新增PG/D1证明或预算。

| 产品源 | 实际读取块 | 当前 SHA-256 |
|---|---|---|
| `packages/console/src/components/StatusChip.tsx` | RiskBadge输入未知/非法中性文案；S0–S3图标颜色原映射保留，S3审批不由此函数放行 | `b7ae0d8e13c1b8f713154fbfba64a3d7b9201c74e5ce55ad609611c1034b8475` |
| `packages/console/src/components/redesign/types.ts` | TaskView.riskLevel null只读投影，ApprovalView业务读口字段不变 | `75447ada52045b634b8ef6a74e8c21b96208abf91fa5683f7aeb6cc40ccfef1e` |
| `packages/console/src/hooks/redesign/mappers.ts` | knownRiskLevel及mapTaskViewFromDetail/mapTaskRowToView；合法等级精确接受，缺失/null/invalid不猜风险 | `a6850cb8d5f1291fc99fbe1f30af1e70e4a7800bd4ad3c364ff883e0f9b468fe` |
| `packages/console/src/hooks/redesign/taskRiskDisplay.test.tsx` | 13项mapper/真实Focus helper/TaskCard SSR正负，非网络/浏览器认证 | `44e8605ffae84eaaa1b24aa534ff869e60e80fd85a8bba0a86cc9a29cd462a99` |
| `packages/daemon/src/experimental/codex-app-server/session.ts` | 仅尾2LF收成1LF；字节去尾后与E8相同，17项session测试不当真实CLI | `b7c3174982f345bdeb3434d3d00dba048ae47e6164400353c13c81094cba019c` |
| `packages/daemon/src/tier1/cmdEffectLegacy.ts` | 仅尾3LF收成1LF；字节去尾后与E8相同，6项monotonic测试 | `43256abc96e7c0fb23695f95dbf0e6b51960c2c0bd761251f63f74019e9240e7` |

离线工具脚本另列真实字节：正常基线先通过，七项变异必须命中自己的目标诊断；损坏基线和错目标负例已跑，不把fixture成功当provider/media产品验收。排产脚本仅注释改为下列已登记ID，九项ID集合、日期、排产链不改。工具脚本不进入本扫描器六语言产品语料，其字节与具名读取范围在本轮审计证据中单列。该机械source摘要刷新不是全文件语义通过或独立验收。


### I9 同 revision 包状态与五态批准入口

Focus 完整读口由DAO重组表列状态；task详情 canonical body 不存 status。正常详情不能把同id/revision强状态默认覆成proposed；没有该revision权威状态的缺字段body不新造包。不同revision不借状态，外来task详情不入lookup。五个合法状态各自展示，只有proposed可批准，旧direct继续fail-closed；draft仍可改期待/修改，approved/expired/superseded没有批准入口。实现仅只读投影与按钮守卫，不变更DB/09类型或后端写权限。

真实SQLite createFocus/createAuthorizedBinding/getFocusDetail/getTaskDetail 到helper与生产Card SSR已覆盖approved/expired/superseded；draft/proposed、不同revision/外部task/无authority是具名shape/SSR控制，不冒网络/浏览器认证。初版新增different-revision测试曾把缺状态body默认proposed当控制，已在固定前按现行合同纠正为缺状态不造包；原before测试源码与失败日志保留。

| 产品源 | 实际读取块 | SHA-256 |
|---|---|---|
| `packages/console/src/components/redesign/DecisionPackageCard.test.tsx` | 五态SSR+proposed正例+direct禁用，保留原13case | `4d57c15b8f22a05ecbf99cc554ac59f842affeacbf5b9699e9be8f5605a8a4b1` |
| `packages/console/src/components/redesign/DecisionPackageCard.tsx` | 五态各自文案；canApprove仅proposed且非direct；approve回调同判；draft保留改期待/修改，终态不提供批准入口 | `117323e440bf03587cff9b4a757eb172f7b916c3c5e2260fcf96ca926b960198` |
| `packages/console/src/hooks/redesign/focusWorkLookups.test.ts` | 正常详情/404/不同revision/外部task/无authority控制；原五case保留 | `fad171cc6b6a1bf4d39d35433b10b50df6c8a434f5f01c1a1743b4f601ea2c2e` |
| `packages/console/src/hooks/redesign/focusWorkLookups.ts` | 同id/revision的Focus完整状态优先；body缺状态无该revision authority则不造proposed；外部task先过滤 | `ce93e2a8167e537a9132844efa22cd7785749f7ee373e5183ed819b915dea00c` |


### I9 非共享审计 sink 的 M0 generic 错误口径

真实MemoryLedger先insertMemoryEvent再record(memory.add)。nonshared sink的generic异常不能确认已回滚，fallback须unknown，不能因add尚未返回就报none。默认index同SQLite装配不变，shared失败确实回滚仍none；显式拒绝的原边界保留。before初夹具payloadOf作用域错误未入业务，已单独保留；纠正后真实before1行却none的反例成立，after21项通过（含同SQLite同点回滚、既有合法/拒绝控制）。本修只返回口径，不开旧SC/PG资源、native或observer验收。

| 产品源 | 读取块 | SHA-256 |
|---|---|---|
| `packages/daemon/src/memory/m0Confirm.ts` | 仅非共享sink generic add异常无法确认rollback返回unknown；已知拒绝与shared真rollback none不变 | `6ccb2724595277eb3f7c19998e61383c93e97527ac9281d58628af0c2c449121` |
| `packages/daemon/test/memory-m0-confirm.test.ts` | 真实MemoryLedger先insert后memory.add审计throw1行unknown、同SQLite同点trigger全表rollback0/none；21项原控制保留 | `6e044a1c64b73e3006559b6a15850ab684c1dc173ea7eee23cf97582e777bc5c` |

### I9b 风险类型唯一来源

`packages/console/src/components/redesign/types.ts` 仅import/re-export `@saydo/contracts` 的RiskLevel，删除原重复联合；TaskView null只读投影保留，无运行逻辑/枚举/DDL/S3权限变化。实际读取首48行及contracts approval/index权威出口，源码SHA-256 `3c6312489da51c01c7f52f7b22b000428cb9111d1307bf7a7ee16741594fcd76`。完整41普通门仍绑定I9，不继承为I9b新全门通过；I9b仅另跑具名类型/lint/console控制。

### I10 决策包canonical模式保全

09§2与11§5.10固定1cd95e31两视角文本一致后施工；mapper保留合法canonical mode，Focus同id/revision补充不能丢模式，Card合法mode优先于UI兼容selectedMode。旧无mode的UI direct仍拒绝，不置可否每步问你与无selector保持。没有新enum/DDL/权限。完整Focus包缺/invalid mode由DAO schema拒绝，现役liveCard占位确实无mode，不把占位当完整包或另造未知业务规则。

| 产品源 | SHA-256 | 实际范围 |
|---|---|---|
| `packages/console/src/components/redesign/DecisionPackageCard.tsx` | `319b84b17a8933e89da345f3c6816fc6588d46dadf5bb28af9c079ad0922a743` | 仅canonical类型引用/模式mapping/同revision模式保全/Card与7测试块，不称全文件或全项目接受 |
| `packages/console/src/components/redesign/types.ts` | `8e98e1b56c1fffd23d3e3530926d1ab91753abb0bfdb3f0f877a485c55018b06` | 仅canonical类型引用/模式mapping/同revision模式保全/Card与7测试块，不称全文件或全项目接受 |
| `packages/console/src/hooks/redesign/decisionPackageMode.test.tsx` | `3b159cd638a19906b0177709eccf5aa9e02f4aa4564b51f045b36a3016dc3434` | 仅canonical类型引用/模式mapping/同revision模式保全/Card与7测试块，不称全文件或全项目接受 |
| `packages/console/src/hooks/redesign/focusWorkLookups.ts` | `ca3b4dd5d6fb69a082ca70fb735a2e446f82b4b266ac5b6872ba4ced921ee79d` | 仅canonical类型引用/模式mapping/同revision模式保全/Card与7测试块，不称全文件或全项目接受 |
| `packages/console/src/hooks/redesign/mappers.ts` | `2188ddf0eeb48fc8555aae89501e76a7b7ad50e7d69d80b5531d533d5c6cc7cb` | 仅canonical类型引用/模式mapping/同revision模式保全/Card与7测试块，不称全文件或全项目接受 |

5源摘要与861六语言/864宽源真实更新；15稳定注册exact-set及4dual_write_gap不变，3kts有限词表不是全副作用证明。SQLite/DAO/两个API读口到lookup/Card SSR/生产callback已跑；callback仅observer数组、没有HTTP或后台批准写入，不冒权限绕过或provider证明。

### I10b PTT测试装配补核

唯一新增摘要更新为 `packages/daemon/test/voice-barrier-capacity-ownership.test.ts`，SHA `1d753c86ba96401212a84876acbe2653161c4d72866c60c7ddee908d432b0ad9`。原 edit 未带 holdForConfirm 被 owning registerDoneSpeaking 前置拒绝，原测试未建立PTT；补 true 并明确 forward/captureId、legacy禁止与 voice_anchor_pending 控制。本人错误的 preparing广播断言失败保留，正确四例通过。voiceBarrier 产品源码不变，15稳定类逐对象相同、4 dual_write_gap保持；仅具名测试语义范围，最新I10b完整ci/PW未跑，不继承I10全门。

### I11 exact-root清单登记修复

仅更新 `packages/daemon/test/exact-test-roots.ts` 与其测试的真实源码摘要。登记先lstat区分不存在和悬空/读失败，只缺失时新建；严格共用解析保留合法legacy数组/无runId对象路径，不丢非法成员，也拒当前run归属不一致。损坏原字节在登记失败后保持；现有死PID/归属清扫与泄漏先断言后清扫不变。before真实syntax/shape覆盖后assert假绿，after正反三控制及16例通过，另PTT四例通过，type/lint实际0。15稳定类fresh对象全等、四dual_write_gap原处置不变；仅测试卫生与具名源码范围，不当旧SC原生/PG业务证明。

I12/I13：HTTP delegation 凭据写按既有关键配置S3、原生稿owner先建立再等实际发送；仅九个具名六语言源摘要（含新增test）与五个transport坐标更新。NativeBridgeController整体与dedup所属测试块原字节相同；其余十四稳定类fresh全等，四dual_write_gap原样。宽源865/六语言862，Swift新增保稿控制未编译/未运行；浏览器只用合成Voice/API端口，不当provider/native证明。

I14及I12断言补核：FocusPage的LanesTab始终展示只读主线并保留具名/已收支线，五个SSR对照包含NULL归主线任务与未归支线义务；这些是fixture输入下的生产组件展示，不称作者真实SQLite或设备认证。旧tier1-cmd-effect测试保留http.delegation用例并从普通S1组移入独立S3控制。仅三源摘要更新；此前135 CI失败保留，不继承其PW结果给新ref。

### repair80：I79本地保稿来源登记闭合

E79完整43门实际38通过/5失败，其中26/27发现I79五个Swift来源与三测试坐标未登记。本次只闭合该库存维护回归，不改扫描词表、分母、生产可达性或支持合同；旧6/7/38失败保留。

- `apps/ios/SayDo/NativeSpeechController.swift`：全文408行，buffer替代published正文；idle非空稿阻新capture，拒绝保稿/显式ownership清稿，恢复edit/discard仅idle。原captureId/generation/bridge loss防线保留。 SHA-256 `07b126963b6fdfdb5e9b7d4cb14d1575e9b3c6eda9bf294f1a57de2087aa3cfb`。
- `apps/ios/SayDo/RootView.swift`：全文292行，无profile时也展示本机恢复；configureNativeVoice原submit与回执闭包未改，未跨profile重新发送。 SHA-256 `9639ae054eaa4f7ad4d5a403bc43836cd1810008185f4356dd88c8054e344c6f`。
- `apps/ios/SayDo/VoiceCapsule.swift`：全文272行，error优先且不截三行，保留稿本机TextEditor/复制/明确确认丢弃；buffer非空阻新录音，未注册remote endpoint或自动submit。 SHA-256 `de90bf3c659622895c0bf6e53e9ced4ea0399c7fb496eb9387da649acb6e7b33`。
- `apps/ios/SayDo/VoiceStateMachine.swift`：全文226行，新增本地NativeTranscriptBuffer保存/编辑/显式丢弃规则，不改CaptureStateMachine状态/世代合同；无新transport注册。 SHA-256 `a19b33a7f68ab280cf0dbc9af2c39dd69f8bda8b6ca8d8485159cd9b8352ff27`。
- `apps/ios/SayDoTests/VoiceStateMachineTests.swift`：全文159行，新增两保稿控制；既有dedup方法全文与三register调用原字节相同，测试可达，不属生产transport。 SHA-256 `50eb2a815bc8e975fd0d5e783ba8bc331aa0f32b948b0223a48ea8d2976c73c1`。

三dedup register调用旧55/56/57→87/88/89，完整testReplyDeduplicationUsesSessionAndSentence方法、receiver、参数、行摘要字节相同，仍精确test处置。机械878六语言source exact-set不变，657transport exact-set只移三坐标；其余14稳定类与44legacy历史快照不动。三当前处置键/evidence同步后selected恢复657，矩阵分母无需改变。历史migration原样保留。buffer与pasteboard只本机稿件，不是新remote业务；I79本机simulator build/XCTest26/26有证，UI截图/复制/确认取消实际交互、真机/配对业务NOT_RUN，不升级Native支持。

## 本地整合验收工具登记（2026-10-06）

本轮新增两个 Python 审计工具语料与三个 CLI 静态注册点，均已逐文件核对。它们提供本地 Git 固定对象索引及双向核验，不新增 daemon 业务入口。库存重新生成保留原发现规则、旧未决项与产品验收边界。新增六个 tracked 文件包括已评审合同和五个实现/测试入口。

同时记录运行元数据自然漂移：legacy_candidates 44 → 54（新增 13、原 3 个 worktree 坐标已不在当前注册清单）。原三个处置完整移入 historical_item_dispositions，当前 selected 17 → 14；新发现项仍未据此宣称产品语义已验。本轮没有删除这些来源目录。
