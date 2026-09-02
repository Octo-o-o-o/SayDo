# SayDo

**一个你能对着说话的高级助手**:你只管把事聊清楚，它先吃透项目上下文，听懂了就主动提议开始，
驱动本地 AI agent 把事办成，跑完等你验收时叫你。

> **单仓入口(2026-07-29)**:设计、实现、证据、计划与品牌资产已统一到本仓;
> 后续开发只使用 SayDo。当前工程状态、owner 触点与下一批入口以 [HANDOFF.md](HANDOFF.md) 为准，
> 历史双目录的文件映射与冻结冷档位置见 [MIGRATION.md](docs/plan/MIGRATION.md)。

- Canonical:`docs/01–11 + docs/modules/ + docs/adr/`
- 实施照抄源:[数据契约](docs/09-data-contracts.md) /
  [话术规范](docs/10-voice-ux-spec.md) / [UI 规范](docs/11-ui-spec.md)
- 当前唯一排产源:[IMPLEMENTATION-PLAN-2.md](docs/plan/IMPLEMENTATION-PLAN-2.md)
- 工程约定:[AGENTS.md](AGENTS.md)

## 快速运行

当前公开定位是 developer/preview。首批目标包含开发者与普通用户，完整语音可选；目标人群不是验收证据。v0.1.0-rc.12 固定 URL 已由不可变
[GitHub Release](https://github.com/Octo-o-o-o/SayDo/releases/tag/v0.1.0-rc.12)
及 macOS、Windows、Linux 的一次运行 / 全局安装六项 smoke 验证。该包含 daemon 与 Web 控制台，不含语音 pipeline。

最快的方式是一条安装命令：无需预装 Node.js（缺失时脚本在你的用户目录内准备 Node 22，不改系统、不需要 sudo），安装固定版本包并校验 SHA-256：

```bash
# macOS / Linux
curl -fsSL https://saydo.octoooo.com/install.sh | sh
```

```powershell
# Windows(PowerShell)
irm https://saydo.octoooo.com/install.ps1 | iex
```

然后在新终端运行 `saydo up`。脚本先从 GitHub Release 下载，连不上时自动改用官网镜像 `dl.saydo.octoooo.com`（字节全等、同一 SHA-256 校验；`SAYDO_INSTALL_MIRROR=1` 直接用镜像，`SAYDO_INSTALL_NPM_REGISTRY` 可改依赖 registry）。脚本源码见 [install.sh](deploy/saydo-octoooo-com/install.sh) 与 [install.ps1](deploy/saydo-octoooo-com/install.ps1)，方案见 [快速启动分发方案](docs/plan/2026-09-02-quick-start-distribution.md)。已有 Node.js 22 也可直接用 npm：

```bash
npm exec --yes --package=https://github.com/Octo-o-o-o/SayDo/releases/download/v0.1.0-rc.12/saydo-cli-0.1.0-rc.12.tgz -- saydo up
```

常用安装：

```bash
npm install --global https://github.com/Octo-o-o-o/SayDo/releases/download/v0.1.0-rc.12/saydo-cli-0.1.0-rc.12.tgz
saydo up
```

该包支持 macOS、Windows 与 Linux，启动 daemon + Web 控制台；Windows/Linux 当前以前台方式运行。语音 pipeline、macOS launchd 常驻和源码开发仍走下方开发安装。远程终端可加 `--no-open`，按 `Ctrl+C` 优雅停止。

## 开发

```bash
pnpm install          # Node >= 22
cd pipeline && uv sync
just dev              # daemon + pipeline + console
just ci               # 本地 Node/Python 基线(不是托管 CI 等效)
```

## 文档地图

| 文档 | 内容 |
|---|---|
| [01](docs/01-vision-and-problem.md) | 愿景、问题与价值假设 |
| [02](docs/02-product-definition.md) | 用户、体验、场景与边界 |
| [03](docs/03-architecture.md) | 系统分层、组件与部署 |
| [04](docs/04-key-mechanisms.md) | 记忆、就绪、审批、回叫与可靠性 |
| [05](docs/05-roadmap.md) | 路线、复用、风险与未决项 |
| [06](docs/06-references.md) | 术语、来源与事实基座 |
| [07](docs/07-tech-stack-decisions.md) | 技术选型与降级路径 |
| [08](docs/08-module-design.md) / [modules](docs/modules/) | 模块总览与分域详设 |
| [09](docs/09-data-contracts.md) | 数据契约、状态机、DDL 与配置 |
| [10](docs/10-voice-ux-spec.md) | 语音交互、话术与 Brain instructions |
| [11](docs/11-ui-spec.md) | UI、Design Tokens 与零 emoji 门禁 |
| [ADR](docs/adr/README.md) | 设计决策与工程决策双序列索引 |

## 结构

| 目录 | 内容 |
|---|---|
| `packages/contracts` | docs/09 的 zod schema、digest、状态机与契约测试 |
| `packages/daemon` | voiced daemon:对话域状态、审批、回叫与执行客户端 |
| `packages/console` | Web 控制台(Vite + React，视觉照抄 docs/11) |
| `pipeline` | 语音管线(Python/Pipecat) |
| `e2e` | 端到端、owner 场次与实施证据 |
| `docs` | canonical、ADR 与实施计划 |
| `research` / `history` / `prompts` | 证据、过程档案与评审输入 |
| `demo` / `assets` / `templates` | 演示、品牌资产与配置模板 |

## 许可证

代码以 [Apache License 2.0](LICENSE) 开源(含专利授权;见 [NOTICE](NOTICE))。「说到」/「SayDo」名称、印章 logo 与 `assets/` 下的品牌资产**不在**许可范围内(Apache 2.0 第 6 条),衍生作品不得以原项目名义呈现。

## 过程史与归档

本公开仓自 2026-08-20 的快照起对外;此前的逐提交过程史(设计演化、实施证据、评审档案)保存在私有归档仓,仓内文档引用的历史 commit SHA 在归档中解析。移出公开稿的少量隐私字段(个人联系方式等)见相应文件内的存根说明。公开快照经 [scripts/publish-public-snapshot.sh](scripts/publish-public-snapshot.sh) 更新(推前跑隐私探针)。安全问题请按 [SECURITY.md](SECURITY.md) 私下披露。
