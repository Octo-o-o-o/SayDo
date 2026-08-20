# Saydo Brand Assets

Saydo 的首版品牌视觉围绕一句话展开：**From conversation to completion.**

## 视觉概念

连续的 `S` 形流带代表三步：自然说话 → 上下文汇聚 → 事情向前并完成。它不是麦克风、聊天气泡或机器人，而是“对话变成行动”的视觉隐喻。

## 配色

| Token | Hex | 用途 |
|---|---|---|
| Ink | `#111827` | 主背景、正文、深色模式 |
| Coral | `#F9735B` | 主行动色、语音输入、强调 |
| Mint | `#A7F3D0` | 记忆、上下文、完成状态 |
| Ivory | `#F7F3EA` | 页面底色、留白、浅色模式 |
| Lemon | `#FDE68A` | 少量提示、节点和微亮点 |

## 字体建议

- 主字体：`Manrope`，用于品牌标题、产品界面和正文。
- 辅助字体：`IBM Plex Mono`，仅用于状态、时间、版本等少量系统信息。

## 语气

自然、聪明、简洁、可靠。Saydo 不要求用户写 prompt，而是让用户把想法说出来；文案应少用“配置、参数、工作流”等机器语言，多用“聊、理解、准备、开始、完成、回来告诉你”。

## 资产

- `saydo-mark-v1.png`：浅色背景核心标志探索稿
- `saydo-mark-v1-transparent.png`：透明背景标志
- `saydo-app-icon-v1.png`：深色 App 图标
- `saydo-lockup-v1.png`：图标 + `Saydo` 字标锁定稿
- `saydo-hero-v1.png`：官网横向主视觉
- `saydo-social-cover-v1.png`：横向社交封面
- `saydo-vertical-poster-v1.png`：竖版品牌海报

## 使用边界

- 优先使用 Ink / Ivory 作为大面积底色，Coral 和 Mint 作为动作与状态色。
- 保持流带和留白，不要把所有颜色同时做成高饱和装饰。
- 避免麦克风、耳机、机器人头像、霓虹赛博风、通用 AI 星光和复杂节点图。

当前文件是首版 raster 品牌探索资产；进入正式产品发布前，应据此把核心标志和字标重新绘制为 SVG，并补齐不同尺寸的 favicon、社交头像和反白版本。

---

## 2026-08-13 · 正式 icon 定稿(取代上方 v1 探索稿)

义骁经 ChatGPT 生图四方向多轮迭代拍板:**朱印方向**——品牌朱(#b13a2b,与 UI 印泥朱同值)满幅印面,反白「对话气泡×对勾」共构图形(勾的收笔接管气泡右框=Say 的边界由 Do 完成;右框断口=篆刻"击边")。三母版分工:
- `saydo-icon-flat-1024.png` 纯扁平 → favicon 链(16-48px)
- `saydo-icon-tex-1024.png` 细纹理 → App icon 母版(iOS/Android/鸿蒙/macOS icns)
- `saydo-icon-heavy-1024.png` 重纹理 → 官网/展示大图
均已从生成原图(#c02918 系)校色至品牌朱。`saydo.icns` 为 macOS 备用(D2 桌面壳)。
