# ICP / 商店证书速查卡

指纹和公钥不是秘密;私钥、keystore 口令、p12 不进本文件。证件号与住址不进本文件。

最后更新: 2026-08-13 `[filing-0813]`(含腾讯云已提交的安卓模数 / iOS Distribution 模数)

角色:可复用抄表。已提交腾讯云的原文以 `docs/release/2026-08-13-tencent-icp-app-filing.md` 为准(防本卡日后被改时对不上当时交的值)。进度以状态文档为准。阅读地图:`docs/release/README.md`。

## 身份

| 项 | 值 |
|---|---|
| 包内名 | 中文主名「说到」(owner 2026-08-13 确认);英文 `SayDo` |
| 包名 | `com.octoooo.saydo` |
| Apple Bundle ID 资源 | `PFS4HWS6C9`(UNIVERSAL, seed `5CS6HUB4P2`) |
| 主办单位 | 个人 汪义骁(与千手三商店账号同一主体,owner 已确认复用) |
| 网站备案主体 | `京ICP备2025153079号` |
| App Store ID | `6801042343`(ASC 应用记录「说到」,2026-08-13 网页创建) |
| Play 应用 ID | `4975182458667142159`(title「说到」,包名占用) |
| AGC App ID | `6917613548237019987`; listing `9249519184596237673`(HarmonyOS NEXT,仅手机) |
| 腾讯云 App 备案 | 订单(号私存)已提交初审(2026-08-13);工信部 App 号未下发 |
| App Store SKU | `saydo`(zh-Hans 主语言;en-US 店名留空) |
| 接入 IP | 腾讯云轻量 `123.207.158.219`(与 octoooo.com 网站备案同一台) |
| 备案域名 | `saydo.octoooo.com`(深链 `link.saydo.octoooo.com`);Pages 自定义域已挂,隐私页 200 |

## Android(从 release keystore 导出,不是 debug,也不是 Play App Signing 密钥)

位置(非秘密):`~/.config/saydo/keystores/saydo-android-release.p12`  
口令:钥匙串 `SayDo Android Release Keystore Password`  
alias:`saydo-android`  
subject:`CN=SayDo, OU=octoooo, O=Yixiao Wang, L=Beijing, C=CN`  
有效期:2026-08-13 → 2051-08-07

备案表通常要**无冒号**的大写 hex:

```text
MD5:    A74A00AD710E55CB23170A593F8756D1
SHA-1:  8F4E425DCC56E3C2BAB3AAC17EA50489A75C948D
SHA-256:B105994D8506727ABDEA700F1DD9338E8C9F5EDFFBC0E9C4E16CBC25B74E2365
公钥 MD5: 35dc9c72807cb52a43297925cc9957a6
腾讯云备案「安卓平台」公钥填 RSA 模数(十六进制,无冒号大写):
D34B9B6744E2F4D3CF5A1CE48D20042B060A5C3788EFA2B4F2D9CB2F2E74EB21DA2EDEEA460F08DB1531E95F85901B6BC191EF8DA1617F0010C2F660B00835A519C3872BD209CE66799882E7DB4E8841AB965670E9375F49DA9B3C8EEC4B586E4231A9E1935BBED5486717E230D3BADC6E02E47DF9F883963862A26C094BEEBDB914D38DE9D2A326482BF63D42A8CEFA17214C3B1E34F184573E0FBC3E4562BA1A285BE25D18D88A71C7EB23E2E3E7661A7D08BB109062359E6E667F648A288D163E1386E709FBE3621EFEDF2B2DE3777DA28E5C8FB908B8DD9CC7FE17E48338E47F844856CB0C77EF86F42E82D3316EA14B1A61795B2D20E517ECCE0E46073D
公钥 DER Base64:
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA00ubZ0Ti9NPPWhzkjSAEKwYKXDeI76K08tnLLy506yHaLt7qRg8I2xUx6V+FkBtrwZHvjaFhfwAQwvZgsAg1pRnDhyvSCc5meZiC59tOiEGrllZw6TdfSdqbPI7sS1huQjGp4ZNbvtVIZxfiMNO63G4C5H35+IOWOGKibAlL7r25FNON6dKjJkgr9j1CqM76FyFMOx408YRXPg+8PkViuhooW+JdGNiKccfrI+Lj52YafQi7EJBiNZ5uZn9kiiiNFj4ThucJ++NiHv7fKy3jd32ijlyPuQi43ZzH/hfkgzjkf4RIVssMd++G9C6C0zFuoUsaYXlbLSDlF+zODkYHPQIDAQAB
```

带冒号的 openssl 原文:`A7:4A:00:AD:...` 等,见本会话命令输出。公开证书 DER 同目录 `saydo-android-release.der`。

Play App Signing 启用后,deep-link `assetlinks.json` 还要另加 Google 托管的应用签名密钥 SHA-256;备案仍用上面这张我方 release 证书。

## HarmonyOS

位置:`~/.config/saydo/keystores/saydo-harmony-release.p12` + `.csr`  
口令:钥匙串 `SayDo HarmonyOS Release Keystore Password`  
算法:ECC P-256 / SHA256withECDSA(CSR 已核验 `prime256v1`)  
AGC 已签发发布证书 `SayDo Release`(生效至 2029-08-13)。链文件在仓库外 `~/.config/saydo/keystores/saydo-harmony-release.cer`(含 Root CA G2 + Developer Relations CA G2 + 叶证书);叶证书另存 `saydo-harmony-release-leaf.pem`。**备案只抄叶证书**,不要抄链里的华为根证。

叶证书 subject:`CN=汪义骁(1947908668586462849),Release` / `O=汪义骁`

备案表通常要**无冒号**的大写 hex(叶证书):

```text
MD5:    DEC5959E46FB596C61D62B5FF873854E
SHA-1:  D816EA3D3A536C7ABDB5E928A2A6E9AB426115D1
SHA-256:91993EAB379179383DAC856618E0333C645270D90BE26AFBE17ED31289D4B6A0
```

AGC 控制台「备案信息」给出的证书公钥(未压缩 P-256 点,无冒号小写,与 openssl 叶证书 `pub:` 一致):

```text
04c5c7d72e3f167e61e7615f973c46219d57ca92de65f91707a9d07ce59a9f9aeaccbfe536871798a302e2b1a47ff96071fee47ae0fb8046f30efc3db05df9125c
```

## iOS

腾讯云备案「苹果平台」公钥填 **Apple Distribution** 证书 RSA 模数(十六进制,无冒号);签名 MD5 栏填该证书 **SHA-1**(40 位)。本机钥匙串身份:`Apple Distribution: Yixiao Wang (5CS6HUB4P2)`,SHA-1 `3CE3C2D7073AB9C05F24C01ACD3FD0EA165421DA`。

```text
Bundle ID: com.octoooo.saydo
ASC bundleIds id: PFS4HWS6C9
App Store ID: 6801042343
Team ID: 5CS6HUB4P2
已开 capability: PUSH_NOTIFICATIONS, ASSOCIATED_DOMAINS, IN_APP_PURCHASE(系统默认,无内购计划)
Distribution SHA-1: 3CE3C2D7073AB9C05F24C01ACD3FD0EA165421DA
Distribution 公钥模数:
AF45E6F94DC5053754890926293A6F778D3843FFF24AD705CB548F989399978544D9E1E13DE52C839D3C783F297E7FFFB2D05B4A89A8574A17513F94E8295DEB268AE4CB340E1E1EFC89411FC00CF6876C92DF928D80C8890C2851413297F169065477F6A556C97923BB069BFA527F0D6F1BF3E12BEC7ACD98DF2AE9F777175DE0BCC57F57773B1B44D78FDCD48C4FE0697A9BD1F6AACA8743E34070640584D0DB3663AECFB76FD35B74A90E9BB7A908DEC0A54A8F2F3B8F36B5331B9E30210BF2DC9C5BE6D9A3269FC14053DC25959BE7BC7AE6581EB2537D632642C299850D79FF8625A2104D25CEDEEA261445741E05AE8FFA42BE5DA24C3513A123FBC2C5
```
