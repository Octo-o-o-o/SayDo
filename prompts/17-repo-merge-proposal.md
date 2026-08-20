# Codex 评审 17:仓库合并方案(voice-coding 并入 SayDo)对抗性复核(2026-07-25)

你是本项目评审制度中的独立 Codex 复核(第 3 路;生成方不能自评)。**只读**,不改任何文件,完整报告输出到 stdout。

## 背景

owner 提出将设计文档库 voice-coding 合并进实现仓 SayDo,voice-coding 转归档。方案文档已成稿:
`/Users/wangyixiao/WorkSpace/voice-coding/REPO-MERGE-PROPOSAL.md`。请对该方案做对抗性复核。

## 复核任务(逐条编号裁决)

1. **事实核验**:方案 §1 事实表 F1-F11 逐条对照真实文件系统与代码核验(路径、行号、计数、体积、gitignore 规则、CI 配置),标出任何不实或过时。
2. **方向裁决挑战**:§3 备选方案对比是否公允?方案 B(不合并只修 CI)是否被低估?是否存在方案 D(如:docs 单独建仓 / git submodule / 保持双仓但加同步门禁)未被考虑且更优?
3. **迁移清单完整性**:§4.1/4.2 逐项核对 voice-coding 顶层全部条目(含隐藏文件)是否都有归属;SayDo 侧是否有会被迁入文件覆盖/冲突的同名路径(逐一列出)。
4. **断链面核验**:§5 引用表的数量与处理是否完备?自行 rg 扫描双向引用(voice-coding→SayDo、SayDo→voice-coding、docs 内部相对链接),找方案漏掉的引用类别。
5. **零 emoji 门禁冲突(F10)**:验证 220 处统计口径;评估"机械替换"方案对语义的风险(尤其表格中 [ok]/[fail] 作为状态列语义的场景);check-emoji.sh 的 BIN_RE 排除表是否覆盖迁入集的全部二进制类型(如 .toml/.html 会被扫,.svg 呢?)。
6. **实施步骤与门禁**:§6 顺序是否有依赖倒置;两提交法与"迁移不与业务改动混批"是否可执行(SayDo 当前有未提交改动);评审制度路径重定义(§4.3)有无漏洞(如 codex-findings/logs 不进 git 后,制度要求的"日志存 logs/"如何审计)。
7. **回滚与风险**:§7/§8 有无遗漏的风险(如 pnpm workspace/tsconfig 对新增顶层目录的影响、Cursor workspace rules 迁移、git 仓体积增长、GitHub 文件大小限制)。

## 输出要求

- 逐条编号裁决:A 级硬伤(会导致数据丢失/CI 永久红/canonical 分叉)/ B 级应修 / C 级建议;每条给文件:行号证据与最小改法;
- 结尾给"事实前提核验表"(你实读了哪些文件/跑了哪些命令、哪些结论来自推断);
- 全部结论必须来自实读文件与实跑命令(只读命令:ls/rg/du/git status 等),不许臆测;读不到的如实标注。

仓库路径:设计库 `/Users/wangyixiao/WorkSpace/voice-coding`(canonical,非 git);实现仓 `/Users/wangyixiao/WorkSpace/SayDo`(git,main)。
