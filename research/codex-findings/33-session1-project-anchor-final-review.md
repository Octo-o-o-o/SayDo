# Codex 对抗审计 33：场次①项目归属静态终审

审计时间：2026-07-30 23:44–2026-07-31 00:00 +0800
审计对象：修复审计 32 后的未提交工作树静态快照
结论原值：A=1，B=2，C=1

## 发现与处置

### A1 可信状态根未贯穿 daemon、launchd 与 pipeline

原发现有两部分：

1. `validateStateRoot`/`validateManagedRoot` 的默认期望路径先对父目录做 `realpath`，因此
   `SAYDO_HOME` 的任一父目录为 symlink 时，实际值与期望值会一起指向目标并被放行。
2. daemon launchd plist 未固定 `SAYDO_HOME`，pipeline 又固定读取 `~/.saydo`；使用自定义
   状态根时，runtime/release 与 daemon、pipeline 的 DB、token、env 可能分叉。

处置：已修。可信根默认期望改为词法 `resolve`，要求最终 `realpath` 与词法位置完全相等；
首次创建前验证最近既存祖先为实体路径，创建后再验目录、owner 与 realpath。daemon 生产
入口使用 `ensureStateRoot` 返回值；daemon plist 与 pipeline plist 均显式固定
`SAYDO_HOME`，pipeline 统一从该根读取 `.env` 与 `.cap-token`，runtime preflight 对账两个
plist。补父目录 symlink、自定义根、相对根与跨 env/token 测试。

### B1 通用归属问题“只问一次”仍依赖提示词

原发现：会话没有已询问状态；每轮都可能再次注入并播出相同问题。原测试第二轮再次返回
同一句但只断言 project revision 不变，因此重复询问仍会通过。

处置：已修。daemon session 态增加 `projectAnchorQuestionAsked`，首次成功送入 TTS 后写
durable audit；进程内与重建时均可恢复。每轮 instructions 显式注入已问/未问状态；输出闸
在已问后拦截重复模板，改播一次确定性承接话术。两轮行为测试断言整场通用问题恰好一次，
并核验拦截审计。

### B2 canonical 的 name-only `resolveProject` 未实现

原发现：canonical 已声明无参数只读工具，但 live registry 没有实现，只存在静态 golden
话术。

处置：已修。新增无参数 `resolveProject`：仅从当前进程内仍有效的 heard turn 做 title
只读建议，由 daemon 机械播出本地路径引导并以 `control="await_user"` 终止工具环；不形成
candidate、presentation 或 confirmation。补隐私关闭、后续裸肯定与迟到旧异步轮的零写入
回归。

### C1 重播 throw 与 presentation 终局清理缺行为回归

处置：已修。重播失败测试同时覆盖 enqueue 返回 `false` 和抛异常，连续裸肯定都保持
`replay_pending` 且项目零写入；accepted、rejected、to_screen 终局均直接断言当前
presentation 已删除。

## 原始证据

- Prompt：`prompts/33-session1-project-anchor-final-review.md`
- 本地日志：`logs/33-session1-project-anchor-final-review.log`
- 日志：237 行，1,383,333 bytes
- SHA-256：`55f5acfde5973f3b01d8789d6764493dc0027648564fb70848b60e58777339d0`
- Codex 独立只读门禁：daemon、console `tsc --noEmit` 与 `git diff --check` exit 0；只读
  sandbox 下未重跑 Vitest。

本报告保留原发现与 triage。处置后的最终工作树仍需全量 CI 与下一轮静态终审。
