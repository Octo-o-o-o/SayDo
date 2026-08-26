# docs/release — 上架占坑文档地图

本目录是 2026-08-13 起「说到」上架/备案战役的工作文档,不是 `docs/01–11` 合同 canonical。

读之前先认角色,避免把冻结稿或定名前核验当成现行事实。

| 文件 | 角色(唯一) | 不承担 |
|---|---|---|
| [2026-08-13-store-submission-status.md](2026-08-13-store-submission-status.md) | **过程 SoT**:做没做、卡在哪、店/备案 ID | 不放隐私正文、不放长公钥 |
| [2026-08-13-app-materials.md](2026-08-13-app-materials.md) | **成文材料**:隐私政策、商店文案、审核备注、软著说明 | 不记审核进度;已提交备案字段不在此维护 |
| [2026-08-13-tencent-icp-app-filing.md](2026-08-13-tencent-icp-app-filing.md) | **腾讯云已提交原文**(冻结快照) | 号下发后只在状态文档补备案号,不改快照里的提交值 |
| [filing-cheatsheet.md](filing-cheatsheet.md) | **标识符 + 证书指纹/公钥**(可复用抄表) | 不记审核进度 |
| [metadata.json](metadata.json) | 三店 listing 字段投影 | 不以商店后台实时状态为准 |
| [release-profile.yaml](release-profile.yaml) | 机器可读坐标(账号/URL/路径) | 不写密钥 |
| [version-matrix.md](version-matrix.md) | **版本 SoT**:desktop CLI 与三端壳的版本号/签名/测试/真机证据/可分发性 | 不写设备 ID;不替代过程 SoT |
| [name-occupancy.md](name-occupancy.md) | 定名前占用核验证据;§0 为占用后现状 | §1–§5 占坑前原文勿当现状 |
| [data-disclosure-matrix.md](data-disclosure-matrix.md) | 三店隐私表单唯一上游 | 未实现的 T2 行禁止提前填商店 |

`docs/store/00–05` 已冻结,正文全部过时,只留弃用横幅指向 `2026-08-13-app-materials.md`。不要回填、不要当表单抄。

写入规则(防再分叉):

- 进度 / 店 ID / 拍板 → 只改 `2026-08-13-store-submission-status.md`
- 已提交备案字段 → 不改快照;号下发后只在状态文档补 App 号
- 证书指纹 / 公钥 / 包名 → 改 `filing-cheatsheet.md`,再投影 yaml
- 隐私正文 / 商店文案 / 审核备注 / 软著 → 改 `2026-08-13-app-materials.md`,文案再投影 `metadata.json`
- 商店隐私表单 → 只改 `data-disclosure-matrix.md` 再投影三店
- 审核备注 / 审核夹具口径 → 改 `2026-08-13-app-materials.md` §4;拍板状态写过程 SoT DEC-9
- 证件号与住址 → 不进本仓
