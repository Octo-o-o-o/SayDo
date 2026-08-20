# iOS 审核备注(App Review Notes;提交时贴 Review Information)

> **[已冻结 / 禁止当现行材料]** 本文件已归并至 `docs/release/2026-08-13-app-materials.md` §4。阅读地图:`docs/release/README.md`。本稿不再更新,不要贴进 App Review。

## 中文底稿(自查用)

本应用是开源桌面软件 SayDo(github.com/Octo-o-o-o/SayDo)的移动伴侣端。它不运营任何云服务:用户在自己的 Mac 上运行 SayDo 桌面服务,手机扫码(局域网内)连接后,作为语音输入与账本查看设备使用。因此:
1. 应用无账号体系、无注册登录、无内购、不收集数据(详见隐私政策);
2. 首次启动为扫码配对页——需要一台运行 SayDo 桌面服务的电脑才能体验完整功能;
3. 为便于审核,我们提供:①完整功能演示视频(链接);②审核期间可用的演示服务器配对二维码(见下),扫码后即可体验全部功能。

## Review Notes(英文,贴表单)

This app is the mobile companion for SayDo, an open-source desktop application (github.com/Octo-o-o-o/SayDo). It operates NO cloud service of its own: the user runs the SayDo service on their own Mac, and this app connects to it over the local network by scanning a pairing QR code. The phone then serves as a voice-input and ledger-viewing device for the user's own desktop.

Key points for review:
- No account system, no sign-up, no in-app purchases, no data collection (no developer-operated server exists; see privacy policy).
- Camera is used solely to scan the pairing QR code; microphone + speech recognition are used for push-to-talk input, processed on-device; local network access is required to reach the user's own computer.
- On first launch the app shows a pairing screen. Full functionality requires a desktop instance.

**How to review**: We have set up a temporary demo desktop instance for the review period.
- Demo video (full flow): 【链接,提交前填】
- To try the app live: scan the QR code in the attachment 【或:open this pairing link on the test device】. This connects to our demo instance over the internet for review purposes only; production usage is LAN-only.
- The demo instance will remain online for the entire review window.

## 演示环境准备清单(提交前一天执行)

- [ ] 公网可达 daemon 一台(临时 VPS 或内网穿透;含演示数据:两三件事+账本内容)
- [ ] 生成演示配对二维码图片(附件上传)+ 配对链接
- [ ] 录演示视频:桌面起服务→手机扫码→按住说话"帮我记一下…"→账面变化→跨端同显→销账盖章(2-3 分钟,无剪辑花活)
- [ ] 审核通过后关停演示机、轮换 token
