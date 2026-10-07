# 第三轮精简第二阶段

代码提交：`cb232ab160f2ec01ab8d8063e4c97c9de5b76c24`。第一阶段代码 `25214865` 与证据 `de5e1480` 完整提交后，才做补足价值评估；两名新的 reviewer 独立检查源码、交叉 challenge 后，仅采用一项真实 Git 来源防回归。

## 最小补足与取舍

三份既有 scripts 文件 +153/-43，净增110行。trustedPhysicalTools 从 post-release-gate 搬到已经导入的 release-physical-closure 模块，生产检查顺序、Git 参数、完整工具闭包与字节校验、当前 HEAD 来源和调用上下文不变。未增加新模块、adapter、CLI 测试模式、schema、manifest 或门禁。

既有 provenance 专项增加真实临时 Git/bare fixture：release SHA 后无关提交仍取当前 HEAD；fetch ref 事前不存在、事后等于 release SHA；tracked/untracked、分支、push URL 和已提交工具漂移按具体原因拒绝。另用 assume-unchanged 构造 Git status 与 commit diff 干净、实际工具字节不同，要求真实哈希校验拒绝。隔离测试子进程的 Git 配置/环境，仅允许 file transport，禁 hooks/签名/交互，finally 清理；不改全局配置或生产环境。

这不是已证实生产漏洞的修复，而是对本轮来源语义的低成本防回归。Pages 现有恢复、耐久性和身份漂移反例充分，不重复补矩阵。memory 恢复/遗忘未接线涉及启动屏障、多存储清除和文件删除范围，保留独立产品缺口，不用几行接线声称闭环。

## 独立验收与验证

新非作者 reviewer 四维验收 `[ok]`。候选/reviewer 审前审后指纹一致：`91489bcaa3d513cce7d8b5d7f5998e09ff9f333c877cead1596240e8d51290da`。独立运行 provenance 专项退出0；在外部副本将当前 HEAD 改为旧 release SHA、移除 fetch、绕过字节比较，三项突变均被新增测试捕获，各退出1，属于预期负向结果。候选未被突变。

最终 `pnpm test:release`、`pnpm test:tools`、`just precommit` 均退出0，diff卫生通过。产品输入未变，明确沿用第一阶段 `just ci` 的Node3900pass/20skip、Python159pass，不称重跑。未运行真实 GitHub fetch、release/tag、原生平台/设备、Cloudflare或provider；本地文件remote不证明远端授权或真实发布通过。

本证据提交时尚未push。后续按授权快进main、推私有归档并同步隐私过滤公开快照；双仓最终SHA与托管CI实际终态记外部最终报告，不预写通过。

## 原始证据

外置目录 `saydo-gates-round3-20261007`；日志不入Git。

| 文件 | bytes | SHA-256 |
|---|---:|---|
| `phase2-proposal.md` | 8105 | `96fdd5f9248f13a772c04c924a51c7fe61bfc8613485646ccbf1dbeedd723049` |
| `phase2-review-a.md` | 6456 | `3c831bdf5e93036ac6c54d408ba7a931048832a76c1c462de16734137e2817cf` |
| `phase2-review-b.md` | 5793 | `3d1b5e17afbfc4c05c19dc65c8863512ccfcc63f32e62e05195a546ac81104f2` |
| `phase2-implementation.md` | 4202 | `8f3f25519048be32c553355684fbfb0aedad3ad6ad0f993612b0a487450cc1f4` |
| `phase2-accept.md` | 4207 | `15748d174aa907483ab1f0cf3946a11ce8bd6ce2969d1c3128d4a12d1d71d3d7` |
| `phase2-focused-01.log` | 173 | `c6e2de800bb7b29d4ab23570c58b8a1a1e6dbf40abd78fe416965b7276896cb6` |
| `phase2-release-01.log` | 11942 | `7d6ba02062a92bcc26bff24adc948432b2ab92586a2257752888f6a584181c89` |
| `phase2-tools-01.log` | 4829 | `2b8539789f3397a846425acd123cc28539871aea71b7dc28e5bb8392dc6e6ec6` |
| `phase2-precommit-01.log` | 251 | `05d468bfa7ea73d11640aa2d9cb8fd2db6fe6ff9d08adfe947a1e829ba0c9aae` |
| `phase2-accept-provenance.log` | 250 | `7819616cc77e8eeb91061f7a07b185401c1c610bc695e8f51a5b082f6f393652` |
| `phase2-accept-mutations.log` | 187 | `2c93ba72c4e94a36152878e5cb5a07aab048a0469d71430958be1d89f8b5b097` |
