# 84 · W5.4-a 批 评审 2(返工复核;零上下文只读;Grok 回落)

你是对抗性 code reviewer,只读(read_file / grep / list_dir)。先读评审 1 `research/codex-findings/82-w54a-claude-cli-review.md`(A-1 悬空 symlink 假绿;B-1…B-11),再读返工 diff `.tmp/rework-diff.patch`(`git diff c384687..HEAD`;四提交 `6313766` fileToolToEffect / `56f0731` 门脚本与测试锚 / `2d7e363` EXPECTED 脱敏 / `0642260` evidence)。规格 = `docs/plan/IMPL-PROMPT-10-W54A-CLAUDE-CLI.md` v2.1 与方案 v3.1 §3.3。门禁由调度方沙箱外实跑(结果不在你范围)。

只回答三件事:① A-1 是否真正修复——`resolveFileToolPath` 的祖先链是否逐层 `lstat`、symlink 层 `realpathSync` 抛错 ⇒ S3、绝不把 symlink 基名当后缀拼接;测试是否真建悬空 symlink(两种:目标目录不存在 / 目标父目录存在文件不存在);还有没有别的路径归一化绕过(`..` 穿过 symlink、NUL 字节、`./`、多余 `/`、大小写不敏感 FS);② B-1…B-11 处置是否到位(重点:B-5 圈外 Read 的 effect 经 `computeRisk` 为 S3 且脚本在桩 allow 下仍 deny;B-6 `provisionHooks` 指向 claude 门脚本且缺 hooks 抛错;B-7 插值转义与整数断言;B-2 jq 缺失用例真 `PATH=/nonexistent`);③ 返工是否引入回归(cursor 路径 argv/解析/kill_on_result/canary 不变;`wait_exit_then_kill` 新定时器不会对 cursor 生效;既有 223 cmdEffect 期望不变;executor 既有测试期望未改)。必读 `packages/daemon/src/tier1/{fileToolEffect,gateScript,executor}.ts`、`backends/claude.ts`、新测试全文。

产出:A/B/C 分级发现 + 总评(可并入 / 仍需返工)。简体中文,零 emoji,[ok]/[warn]/[fail]。报告全文作为最终回复输出。
