# Tailcat 借鉴评估

> 对方 repo:`https://github.com/tailscale/tailcat`
> 对方版本:git `476c217fa9fa5b304cdb7f07404a6c3844eac0b0`(2026-09-02, `cmd/tailcat: default --derpmap-url from TAILCAT_DERPMAP_URL env var`)
> 对方 license:**BSD 3-Clause**(`LICENSE` 原文, Copyright (c) 2020 Tailscale Inc & contributors;保留版权声明、禁以权利人名义背书)
> 本产品基线:SayDo `80829cdac2f8b2a7de5b95526548f988db221b07`(2026-09-02, `chore(evidence): 随 PROC-01 方案入库重生成 week-audit 账本`)
> 既有评估:仓内**无** Tailcat 评估。同类基线是 `research/mobile-desktop-connectivity.md`(2026-07-22,T2=系统 Tailscale / T3=OctoDesk 协议模板)与 `docs/07-tech-stack-decisions.md` D13。本文是**新评估**,不 supersede D13;只回答「当前组网面能否整面换成 Tailcat」以及哪些设计值得记。

## TL;DR(值不值得借 + 第一刀是什么)

**不能把当前 T2 整面换成 Tailcat。** Tailcat 不是「更轻的 Tailscale App」,而是用户态点对点管道(netcat + WireGuard + magicsock + DERP),没有 TUN、没有 MagicDNS、没有 `100.64/10` / `fd7a:115c:a1e0:` 地址、没有 iOS/Android/HarmonyOS SDK。SayDo 现有组网**不是自研 mesh**,而是「系统 Tailscale 出覆盖网 + daemon 只做 Host/Origin/token 与 `via` 标注」。两者形状不同,换过去等于重写运输面,不是改配置。

第一刀(最小价值闭环,本轮**零代码**):

1. **锁一条身份铁律**:任何用户态转发/sidecar 把远端流量接到 `127.0.0.1` 时,不得落入 `via="local"`(否则 S3 会被手机面打穿)。
2. **不改 PLAN-2 串行链**:T2 手机烟测、T19 × tailnet 合同仍走系统 Tailscale。
3. **若 owner 要「用户不必装 Tailscale」**:另开 spike,不进当前批次;候选是 Go sidecar + 新 `via` + 用户自建 DERP,而不是把 CLI/WASM 塞进 console。

裁决计数:**A×1 / B×8 / C×21**(共 30 条)。

## 对方是什么(先于清单)

Tailcat 官方一句话是 “Tailscale without Tailscale, by Tailscale”:复用 Tailscale **数据面**(用户态 WireGuard、`magicsock`、gVisor netstack、DERP),丢掉 **控制面**(账号、协调器、ACL、MagicDNS、内核 TUN)。一端 `Server` 打出 `tc…` 地址(CBOR + base64,含节点公钥、独立 disco 公钥、DERP 区域),另一端 `Client` 带外拿到地址后经 DERP 做 Meow/Meowed 握手,再尽量升到直连 UDP。默认 DERP 图是 `https://tailcat.dev/derpmap.json`;也可以自建 `derper` 或自备 DERP map。

它同时是:

- 可 import 的 Go 库(`github.com/tailscale/tailcat`);
- 一套 CLI(`serve` / `forward` / `socks` / `ssh` / `cp` / `ping` / `genkey`);
- 实验性浏览器 WASM demo(只走 DERP,无 UDP;直连要等 WebRTC,#4)。

仓库自己写明:**无 API/CLI/线格式稳定承诺**;公共 DERP **无 SLA**,可随时收回。`SECURITY.md` 写明威胁模型按「同一人操作两端」设计,尚未按互不信任方硬化。`AllowedClients` 为空时**默认放行所有客户端**。

## 能力登记表

编号 | 描述 | 对方位置 | 本产品现状(证据) | 裁决 | 理由
---|---|---|---|---|---
1 | 无控制面的数据面(WireGuard + magicsock + DERP) | `README.md` How it works;`tailcat.go:4-30,1460-1492` | 已有**系统 Tailscale 覆盖网**,daemon 不实现数据面:`packages/daemon/src/net/t2.ts:1-34`,`identity.ts:44-54` 认 CGNAT/`fd7a:115c:a1e0:` | **B** | 思路可取(用户不必开 Tailscale 账号),但与 D13「T2 用系统 Tailscale」形状冲突;只能当未来可选运输面,不能替换现网
2 | 带外 `tc…` 地址当连接能力 | `tailcat.go:136-170`;`wire.go:25-31` | 已有 `just t2-pair` 一次性 token URL(`pairUrl.ts:32-34`)与 LAN 扫码(`console/src/lib/pairing.ts:38-41`) | **B** | 若未来嵌入式组网,可用「短地址 = 能力」补 MagicDNS;现网已有配对原语,不值得为它换栈
3 | 纯用户态:无 TUN/无 root/无路由/无 DNS | `README.md` Network stack;`tailcat.go:1460-1492` | 现网依赖系统 Tailscale Network Extension(`HANDOFF` §2-12;`research/codex-findings/86-status-alignment-runtime.md`) | **B** | 嵌入时必须如此;当前 T2 正是靠系统 TUN 才让手机浏览器直接打开 `http://<host>:47100`
4 | Go 库 `Server`/`Client` | `tailcat.go:316-389,1502-1560` | daemon 是 Node 22,不能 import Go | **C** | 框架本体;接入只能是 sidecar/cgo,栈成本远大于收益
5 | CLI stdin/stdout 管道 | `README.md` Usage;`cmd/tailcat/tailcat.go` | 产品面是 HTTP/WS console,不是字节管 | **C** | 越界
6 | CLI `serve` 转发本机 TCP 端口 | `README.md`;`cmd/tailcat/tailcat.go:88-147` | daemon 自己听 `47100`(`index.ts:334-337,413`) | **C** | 运维玩具,不是产品入口
7 | CLI `forward` 把远端端口映到本机 | `cmd/tailcat/forward.go:23-39` | 无此层;身份门按 **真实 socket peer** 判 `via`(`identity.ts:39-75,142-147`) | **C** | 若有人把手机流量 `forward` 到 `127.0.0.1:47100`,peer 变 loopback,会误标 `via="local"` 并放行 S3。这是整面替换的致命点,见 A1
8 | SOCKS5 带子进程 | `cmd/tailcat/tailcat.go:107-108`;README socks | 无 | **C** | console/原生壳都不走 SOCKS;`tc…` 当 hostname 还会被浏览器小写,官方已承认浏览器不可用
9 | 无认证 SSH | `tailcat_ssh.go`;README | 执行在桌面 Tier1,远程封顶 S2 | **C** | 与 S3/Gate 0 红线冲突;对方威胁模型也不覆盖互不信任方
10 | SFTP / 投递箱文件交换 | `tailcat_sftp.go`;`tailcat_files.go` | 跨设备产物走 daemon 合同,不走旁路文件服务 | **C** | 越界;对方还出过投递箱覆盖/探测文件名的安全修复
11 | Exit node | `Server.OnTCPForward` `tailcat.go:365-375` | 无;也不该有 | **C** | 把桌面做成出口节点,扩大攻击面
12 | `ping --until-direct` | README Misc | 无 overlay 探针 | **B** | 若做 sidecar,这条运维探针值得留;现网用系统 `tailscale status`
13 | `parse`/`resolve` 地址 | README | 无 `tc` 地址 | **C** | 不嵌入就不需要
14 | 临时钥 / 持久钥 / 客户端钥 + `--allow` | README Key Management;`tailcat.go:343-347,679-682` | 身份是 capability token + Host 白名单 + peer 网段(`identity.ts:109-158`) | **B** | 嵌入时必须用客户端钥白名单,且**禁止**复制「空 allow = 全放行」
15 | DNS TXT 发布 `tailcat=tc…` | README | 配对 URL / QR,不出公网 DNS | **C** | 与「不运营服务器、不要求用户配 DNS」不符
16 | 自建 DERP / `--derpmap-url` | README BYO DERP;`tailcat.go:93-101` | 现网吃系统 Tailscale 的 DERP;计划里有「国内 DERP 预置」(journal D7) | **B** | 中国可达性与「公共 DERP 无 SLA」都指向用户自建;SayDo 自己不得运营中继(与官网「不运营任何服务器」冲突)
17 | 浏览器 WASM(`tailcatListen`/`tailcatDial`) | `web/main_js.go:1-10,37-179`;`tailcat.go:1215-1221` | 手机薄版是系统 Tailscale 上的普通 HTTP;原生壳是 LAN URL 语法 | **C** | WASM 无 UDP、只走 DERP;直连要 WebRTC(#4),与 D13「不用 WebRTC P2P」直接撞车;不能当生产手机面
18 | disco 钥与 node 钥分离 | `tailcat.go:147-151,1477-1483`;`SECURITY.md` Hall of Thanks | 无自研 disco | **B** | 设计可记:直连探测帧不得泄漏「未列出的连接能力」;现网能力在 token,不在公钥
19 | Meow/Meowed DERP 握手 | `disco.go:11-70` | 无 | **C** | 内部协议,不重实现
20 | 无控制面时用 CallMeMaybe 互报 UDP 端点 | `tailcat.go:1180-1248` | 系统 Tailscale 控制面代劳 | **C** | 不嵌入就不搬
21 | `AllowedClients` 空 = 全放行 | `tailcat.go:343-347,679-682` | G1 fail-closed:未配 `tailnet_hosts` 则整面不开(`t2.ts:22-33`;`t2-thin.test.ts:41-54`) | **C** | **禁止抄默认放行**;比本产品弱
22 | `ServedTCPPorts` 包过滤 | `tailcat.go:377-388` | HTTP 路由 + S3 守卫 + mobile_lan 白名单 | **B** | sidecar 若暴露端口,应静态收口只转发 daemon 端口
23 | 从公钥派生内部 IPv6 | `tailcat.go:572,704`;README Addressing | `isTailnetPeer` 只认 `100.64/10` 与 `fd7a:115c:a1e0:`(`identity.ts:44-54`) | **C** | 地址族不兼容;换过去现网 `via="tailnet"` 判定会全部失效
24 | DERP map 缓存(1h + ETag) | `tailcat.go:102-126` | 无自拉 DERP 图 | **C** | 不嵌入就不需要
25 | 无稳定承诺 / 公共 DERP 无 SLA | README Stability | 产品合同要可验收;T2 已绑系统 Tailscale | **C** | 不能把生产运输面钉在「可随时改线格式、可随时关中继」的实验工具上
26 | 威胁模型=同一人两端 | `SECURITY.md:14-26` | 远程面按已配对设备 + OS 解锁,封顶 S2(`docs/09` §3 对表;`s3Guard.ts`) | **C** | 对方尚未按恶意对端硬化;不能当远程审批通道的安全底座
27 | 发行包装(brew/docker/nix/goreleaser) | README Install | 本仓是 daemon+console+三端壳 | **C** | 不把用户装 `tailcat` CLI 做成产品步骤
28 | 用 build tags 裁掉未用的 Tailscale 功能 | `build-tags.txt` | 无 Go 发行物 | **C** | 打包细节,不借
29 | SOCKS 把 `tc…` 当 hostname(大小写敏感) | README socks | 浏览器会小写 hostname | **C** | 与手机浏览器/WebView 路径不兼容
30 | Web demo 传文件/文本 | `web/app.js`;`webdemo/` | 产品不是传文件工具 | **C** | 越界

## 红线记录

### License

BSD 3-Clause,宽松。允许作依赖或抄设计。第三条禁止用 Tailscale 名义为衍生包装背书。若未来 sidecar 引用 `github.com/tailscale/tailcat` + `tailscale.com v1.103`,须保留版权声明,且产品文案不能写成「官方 Tailscale 内嵌」。

**不构成「可以整仓引进」的许可。** 技能红线仍适用:框架本体不借;Go 运行时进 Node daemon 是栈变更,不是抄一段函数。

### 护城河 / 边界冲突

1. **S3 永不离开本机**(`docs/09` `assertS3LocalAndBound`;`s3Guard.ts:17-45`)。Tailcat `forward` 到 loopback 会破坏「peer=loopback ⇒ local」这条机械式。
2. **Gate 0 / 远程封顶 S2** 不因「对方更简洁」而放松。对方默认 `--allow` 空=全放行,比 G1 弱。
3. **不用 WebRTC P2P**(03 §7、07 D13)。对方浏览器直连的官方出路正是 WebRTC(#4)。
4. **不运营任何服务器**(官网/隐私口径)。公共 `tailcat.dev` DERP 仍是 Tailscale 公司中继;SayDo 若把它写进默认路径,等于把产品可用性绑在对方可撤销的免费中继上。用户自建 DERP 可以,开发者不得代运营。
5. **T3 已定稿为 OctoDesk 瘦身版**(LAN WS + 自建密文中继 + Noise XX),不是 magicsock。Tailcat 不能顺便改写 T3。
6. 对方明确无稳定承诺。合同面不能把 `via="tailnet"` 的验收绑到实验线格式上。

## 承重现状盘点(防后续评估者把已做当没做)

SayDo **没有**自研组网栈。现网是三层叠加,代码都在:

1. **T1 本机面**:daemon 缺省听 `127.0.0.1`;`via="local"`;S3/WebAuthn/`/dev/*`/setup 写口只走这里。
2. **T2 薄版(系统 Tailscale)**:`[t2].tailnet_hosts` 显式枚举 MagicDNS/`100.x`,非法项整面不开;`[t2].listen` 可改 `0.0.0.0`(`t2.ts`;`index.ts:335-337,3121-3128`)。`verifyIdentity` 要求 Host 命中枚举 **且** peer 落 Tailscale 地址族,才标 `via="tailnet"`(`identity.ts:56-75`)。S2 可批,S3 403。`just t2-pair` 打印 `http://<首个 tailnet 主机>:47100/?token=…`(`pairUrl.ts:32-34`)。
3. **LAN 临时面**:`SAYDO_MOBILE_LAN=1` 听 `0.0.0.0`,只接受 RFC1918 Host+peer+token(`mobileLan.ts`;`identity.ts:14-33`)。桌面二维码**只出 RFC1918**,公网/CGNAT/`100.64` 不出码(`pairing.ts:15-41`)。三端原生壳配对语法同样**拒绝** `100.64.0.1`(Android `DesktopProfileTest.kt:120-123`,HarmonyOS `PairingUrl.test.ets:100`)。
4. **选型已定稿**:T2=系统 Tailscale;要 QR+LAN 或 T3 时按 OctoDesk 协议模板重实现;不用 WebRTC(`docs/03-architecture.md:147-151`;`docs/07-tech-stack-decisions.md:164-166`)。
5. **未完成、且不能被「换运输面」跳过**:T2 手机烟测仍待做(结论只对常驻 `ada7981c`,不外推 HEAD);T19 × tailnet 合同未拍板,是升常驻前置。setup 若干写口对 tailnet 403。

一句话:**组网能力在操作系统里的 Tailscale;本仓只做身份与风险面。** Tailcat 想替代的是前者,本仓实现的是后者。

## 为什么整面替换不成立(对照题)

把「换成 Tailcat」拆成四条必达,现状都不达:

1. **手机浏览器直接打开 console URL。** 现网靠系统 Tailscale 给手机一张可达桌面的 overlay IP/MagicDNS。Tailcat 客户端必须自己跑库或 CLI,再 `forward`/`socks`;浏览器不能把 `tc…` 当 HTTP 主机(会小写,且无 DNS)。WASM 只能 DERP,不能当生产。
2. **三端原生壳。** 对方仓库无 Swift/Kotlin/ArkTS、无 gomobile、无 Network Extension。壳侧配对语料还主动拒绝 CGNAT。换运输面要重写三端连接层,不是改一个 TOML。
3. **`via="tailnet"` 机械判定。** 它绑定 Tailscale 地址族。Tailcat 内部 IPv6 从公钥派生,且用户态不进内核路由。换过去现有单测与守卫会集体失效,必须新开 `via` 词并回写 09。
4. **S3 隔离。** 最省事的接法是桌面 `tailcat serve 47100`、手机 `tailcat forward tc… 47100`。此时 daemon 看见的是 `127.0.0.1`,会标 `via="local"`。这不是「换一个 VPN」,是**安全倒退**。

附带成本:daemon 是 TS/Node,对方是 Go 1.27 + `tailscale.com` 预发布依赖;嵌入必加 sidecar 与发布物。公共 DERP 无 SLA,国内还要自建。对方威胁模型与稳定承诺都达不到远程审批通道的合同门槛。

## 第一刀建议

优先级从高到低:

1. **A1(本轮可吸收,文档级)**:后续凡写 overlay/sidecar/用户态转发,合同必须写清「`via="local"` 只认真实 loopback peer;转发进来的远端不得继承本机面」。不改代码也可以先记在本评估;若有人做 spike,测试第一案就是「forward 到 127.0.0.1 不得批 S3」。
2. **保持 D13**:继续用系统 Tailscale 做 T2;先做完手机烟测与 T19 × tailnet 拍板。这与 Tailcat 评估正交,不能互相阻塞。
3. **B 项只在 owner 明确要「去 Tailscale 账号」时再开**:最小 spike 应是「桌面 Go sidecar 只暴露 daemon 端口 + 客户端钥白名单 + 用户自备 DERP + 新 `via`」,验收必须含 S3 不泄漏。预估远大于「改 `tailnet_hosts`」,且与 PLAN-2 当前停点争人力。
4. **不把 Tailcat 当成 T3。** T3 仍是 OctoDesk 瘦身版。二者都「中继只见密文」,但握手、配对、resume、推送五件套已经按 OctoDesk 定稿。

依赖:无代码依赖。与进行中工作的冲突=若现在开工换运输面,会打乱 T2 烟测基线与 T19 合同。

需 owner 决策的点:

- 产品要不要承诺「用户不必安装 Tailscale、也不必注册 Tailscale 账号」?要,才值得为 B1/B16 开 spike;不要,则本评估到此为止。
- 国内 DERP 是继续吃系统 Tailscale,还是允许用户填自建 `derper`?这与 Tailcat 无关也能单独做,但若选 Tailcat 默认路径则变成硬前置。

## 不借清单(C 项汇总)

整面替换、Go 库进 daemon、CLI 当产品步骤、stdin 管道、SOCKS/`tc` hostname、无认证 SSH、SFTP/投递箱、exit node、DNS TXT、浏览器 WASM 生产路径、Meow/CallMeMaybe 重实现、公钥派生 IPv6 替换 `isTailnetPeer`、空 allow 全放行、公共 DERP 当 SLA、把实验线格式写进 09、用 Tailcat 改写 T3、发行包装与 build tags。

这些不是「对方不好」,而是与本产品已建成的身份面、风险面、移动壳、官网口径不兼容,或投入产出不成比。
