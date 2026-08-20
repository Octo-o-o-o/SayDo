# App 备案信息表(照 OctoDesk 千手先例字段;经商店平台备案通道提交)

> **[已冻结 / 禁止当现行材料]** 备案通道已裁决为腾讯云接入商,不是商店平台通道。已提交原文以 `docs/release/2026-08-13-tencent-icp-app-filing.md` 为准,材料索引见 `docs/release/2026-08-13-app-materials.md` §5。阅读地图:`docs/release/README.md`。本稿服务类型「工具类/效率办公」与实交「软件开发」不一致,禁止再抄。

> 义骁操作;既白备好可填项。主体信息沿用 OctoDesk 备案主体,不重复列。

| 字段 | 填写 | 备注 |
|---|---|---|
| App 名称 | 【应用名】 | 与商店/软著一致 |
| 英文名 | SayDo | |
| 包名(iOS Bundle ID) | com.octoooo.saydo | 三端同名策略 |
| 包名(Android) | 【确认 applicationId,当前 apps/android 构建配置为准】 | 提交前 `grep applicationId apps/android/app/build.gradle*` 核对 |
| 包名(HarmonyOS) | com.octoooo.saydo | AppScope/app.json5 |
| 服务类型 | 工具类/效率办公 | |
| 是否含第三方 SDK | 否(壳内仅系统能力+扫码库 zxing-embedded/ScanKit) | 安卓 zxing 为本地扫码库非数据 SDK,按各平台口径如实填 |
| 服务端/域名 | 无开发者运营服务端(本地局域网工具) | 照 OctoDesk 同口径;若通道必填域名,填官网/开源仓页面 |
| 隐私政策 URL | 【挂网后填】 | docs/store/01 定稿后挂 |
| 公安备案 | 视商店要求 | OctoDesk 先例照抄 |

## 各端签名指纹(备案/商店常要,提交前采集)

```bash
# Android(如需):keytool -list -printcert -jarfile app-release.apk
# iOS:Team ID 5CS6HUB4P2(Apple Developer 后台可查)
# HarmonyOS:AGC 项目页证书指纹
```
