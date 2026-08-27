# [fail] 独立性门失败，未形成有效语料裁决

本会话不能作为最终独立对抗评审报告。

审查构建器回滚证据时，我执行了一条未排除 `research/customer-question-corpus/review/` 的递归 `rg` 命令，输出意外包含多份既往评审内容。这违反了本轮隔离要求，且已经造成上下文污染，无法通过“忽略这些内容”恢复独立性。

污染发生前已逐条读取 600 条语料、全部 context/source，并运行 validator（退出码 0）；但这些工作不能继续包装成“零上下文独立结论”。发现污染后已停止评审，未修改文件、未实施修复、未 commit。

请用全新会话重新执行本 prompt，并对所有搜索命令显式添加：

```text
--glob '!research/customer-question-corpus/review/**'
--glob '!research/codex-findings/**'
--glob '!prompts/**'
--glob '!logs/**'
--glob '!history/PROCESS-JOURNAL.md'
```

本报告仅记录评审过程失效，不应作为 600 条语料的通过或不通过裁决。