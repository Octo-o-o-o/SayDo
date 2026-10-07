# RF-00 离线 fixture 语料(fixtures/)

> 本目录是**独立准备材料**:离线语料 + 严格校验脚本,不接任何生产路径,
> 未审合同不因此成为运行路径。`fixture pass` 只证明语料形状/覆盖合法,
> **不是**生产行为 pass、不是设备/真机/provider 验收。

| 文件 | 绑定 | 内容 |
|---|---|---|
| `bridge-frames.json` | §17.7 / RF-09 | bridge hello/request/response/event/bye golden 帧 + 拒绝(version/capability/origin/size/decode)+ 恢复(bye 清 pending/重连新 hello)+ unknown(replyTo 无主)案例 |
| `provider-executor-conformance.json` | §3/§6.1/§17.1 / RF-07 | provider 与 executor 责任边界语料:启动/取消/恢复/settle/hook 丢失/unknown 终态/计费切换,禁静默 fallback |
| `media-corpus.json` | §17.6 / RF-08 | 24 个测量场景(中文停顿/中英混说/迟到 ASR/打断/崩溃/蓝牙/锁屏/噪声/PTT 竞态/误唤醒/TTS 脱敏/watermark);P50≤1.5s/P90≤2.5s/样本≥20 分组与 undeterminable 口径冻结;**不含音频、未跑 provider,无性能数字** |
| `device-capability-matrix.json` | §17.7 / RF-09 | 三端能力矩阵:maturity_now 全部 inventory_only/designed(文件树可证),maturity_target 与所需证据逐格列明;模拟器只能到 implemented_hidden |
| `release-closure-sample.json` | §17.8 / RF-10 | 安装闭包样例:CycloneDX SBOM 片段、原生运行时组件、额外下载登记、provenance 绑定{repo,commit,workflow,signer}、exact-set 兼容与反例 |

校验器:`scripts/check-offline-fixtures.mjs`(Node 22,零依赖)。

```bash
node scripts/check-offline-fixtures.mjs            # 全量校验
node scripts/check-offline-fixtures.mjs --mutation-test  # 变异自测:损坏语料必失败
```

设计约束:

- 每份语料含 `normal`/`reject`/`recover`/`unknown` 四类案例及输入/输出预期;
- 语料绑定 canonical 节号(binds.contract),协议改动须同步 fixture;
- `media-corpus` 不携带音频字节与实测延迟——RF-08 执行期实测填入,当前无性能结论;
- `device-capability-matrix` 不允许 `maturity_now` 高于 `designed` 而无 `evidence` 字段支撑;
- `release-closure-sample` 的 `commit` 必须为 40-hex;exact-set 兼容旧集仍验,新增资产为增量登记。
