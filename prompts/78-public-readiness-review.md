# 78 · public-readiness 批 code review(零上下文只读;Grok 回落,Codex 配额耗尽)

你是对抗性 code reviewer,只读当前仓库(分支 `batch/public-readiness`,基线 `354b028`,批内四提交:`122d101` 模板 / `96946e1` DEPLOY / `f69ea43` launchd / `7382f9c` evidence)。被审对象 = `git diff 354b028..HEAD`(用 `git diff`/`git show` 读)。规格 = `docs/plan/IMPL-PROMPT-11-PUBLIC-READINESS.md`(未跟踪文件,在工作树)。

找问题不给好评,按 A/B/C 分级:
- A 级:安全(launchd 安装路径写入、PATH 快照、plist XML 注入 / 转义、`which uv` 结果被伪造的风险、`--without-pipeline` 语义让用户误以为语音可用);与规格验收锚不符(用例数、`rg` 断言、`planInstall` 四态);模板里 schema 不接受或校验会红的键 / 值(对照 `packages/contracts/src/types/modelbinding.ts`、`packages/daemon/src/config/{types,validate}.ts`);`deploy` 子命令语义被改;既有测试被改动超出规格允许(只允许改 `config.test.ts` 对 `dev.agent` 的那条断言)。
- B 级:DEPLOY 文档与实现仍有不一致;模板注释误导(如 CLI 示例的 model 名形状、ack 语义、`[hopper]` 口径);evidence 引用的 SHA / 数字与 git 实况不符;emoji 门禁;缺少的边界用例。
- C 级:措辞。

你只有只读工具(read_file / grep / list_dir),不能执行命令;门禁已由调度方在沙箱外实跑并给你结果:`just ci` EXIT=0(contracts 103 / cli 19 / console 253 / daemon 1510 passed|4 skipped / python 33);`pnpm --filter @saydo/daemon exec vitest run test/config.test.ts test/launchd-plist.test.ts` 41 passed;`rg -n "T17|saydo\.js" templates DEPLOY-测试机部署清单.md` 零命中;emoji gate clean。请用 read_file 读 `.tmp/batch-diff.patch`(调度方导出的 `git diff 354b028..HEAD` 全文)与相关源文件做静态审查。

产出:按 A/B/C 的发现列表(文件:行、问题、证据、修法)+ 总评(可并入 / 需返工哪些)。简体中文,零 emoji,[ok]/[warn]/[fail] 标记。把报告全文作为最终回复输出。
