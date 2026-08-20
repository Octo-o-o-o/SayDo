# SayDo 测试机部署清单(Mac mini / 新机器通用,2026-08-12 更新)

> 目标:在一台新 Mac 上跑起 SayDo 供本人或朋友试用,含手机(iOS/Android/HarmonyOS 壳)扫码连接。
> 本清单由主机(MacBook-Pro)会话维护;测试机上的会话按此执行,遇到与实况不符处以实况为准并回写本文件。
> 2026-08-12 起的大简化:**daemon 直接托管 console 静态页,不再需要起 vite**;模型配置走首跑资源画像向导,**本机有任一已登录 CLI(codex/cursor-agent)即可零 key 开聊**。

## 1. 代码与依赖

```bash
cd ~/WorkSpace && git clone https://github.com/Octo-o-o-o/SayDo.git SayDo && cd SayDo
pnpm install && pnpm -r build   # build 必须:daemon 托管的 console 页来自 packages/console/dist
```

前置:node 22+/pnpm 10.x(corepack enable)。可选:`uv`(仅测 Web 语音时要,见 §4)、cursor-agent(tier1 派发执行器,没有不阻断对话)。
**对话模型前置(二选一)**:①本机已登录 codex 或 cursor-agent CLI(零 key 路径,推荐先试这个);②准备一个 OpenAI 兼容 API key(向导里填)。

## 2. 启动(单进程)

```bash
mkdir -p ~/.saydo
cd ~/WorkSpace/SayDo/packages/daemon && SAYDO_HOME=$HOME/.saydo SAYDO_MOBILE_LAN=1 nohup ./node_modules/.bin/tsx src/index.ts >> ~/.saydo/daemon.log 2>&1 &
sleep 12 && curl -s http://127.0.0.1:47100/health   # 必查:ok:true + identity.sourceRevision=你拉到的 HEAD(tsx 冷启动约 10-15 秒,失败就再等几秒重试)
```

- 默认端口 **47100**。`saydo` CLI 只认 `--port`,直起 daemon 才认 `SAYDO_DAEMON_PORT`。
- `SAYDO_MOBILE_LAN=1`:监听 0.0.0.0 供手机连(RFC1918 内网来源+最小路由白名单);只在桌面浏览器测试可去掉。

入口(daemon 直接服务 console,无需 vite;WebAuthn rpId 绑定 `localhost`,`127.0.0.1` 页面请求会 308 归一;`curl /health` 仍可用 127.0.0.1):

```bash
open "http://localhost:47100/?token=$(cat ~/.saydo/.cap-token)"
```

**首次使用=资源画像向导**:进门即看到本机资源画像(检测到的 CLI/已存 key)与方案卡——有已登录 codex 就选「全用 Codex(订阅内零成本)」一键卡→勾两条知情确认→「确认并启动」→真实四槽自检(约 1-2 分钟)→自动重启落到开口聊。全程零 key 零终端。**CLI 对话为慢速模式(每轮约 15-25 秒),属预期而非卡死;思考气泡超过 90 秒会明确报错。**

## 3. 手机连接(扫码配对)

1. 查本机内网 IP:`ipconfig getifaddr en0`
2. 生成配对二维码(token 不要进第三方在线工具):

```bash
pip3 install --user --break-system-packages qrcode 2>/dev/null; python3 -c "import qrcode; qrcode.make('http://'+__import__('subprocess').run(['ipconfig','getifaddr','en0'],capture_output=True,text=True).stdout.strip()+':47100/?token='+open(__import__('os').path.expanduser('~/.saydo/.cap-token')).read().strip()).save('/tmp/saydo-qr.png'); print('/tmp/saydo-qr.png')" && open /tmp/saydo-qr.png
```

3. 手机 SayDo App(iOS/Android/HarmonyOS 壳)扫码即连;App 支持多桌面 profile,可在旧桌面与这台之间切换。手机浏览器也可直接开同一 URL(移动壳路由 `#/m`)。
4. **注意:daemon 的 `~/.saydo/.cap-token` 被删后重启会轮换 token,所有已配对设备一起掉线**,需重新扫码(已列产品缺口,M2 配对契约修)。

## 4. 可选进程

- **Web 语音(桌面浏览器说话/朗读)**:需 VOLC key + pipeline:`cd pipeline && uv sync && SAYDO_HOME=$HOME/.saydo SAYDO_DAEMON_PORT=47100 nohup uv run python -m saydo_pipeline >> ~/.saydo/pipeline.log 2>&1 &`。**iPhone native 语音(按住说话/TTS)不需要它**(走系统 SFSpeech/AVSpeech)。
- **开发热更**:改前端代码才需要 vite(`cd packages/console && SAYDO_DAEMON_ORIGIN=http://127.0.0.1:47100 ./node_modules/.bin/vite --port 47120 --strictPort`);纯测试用 §2 的静态托管即可。
- **saydo up(桌面 CLI,D1 新)**:`pnpm --filter @saydo/cli build` 后可用 `node packages/cli/dist/cli.mjs up|status|open` 管理 daemon 生命周期(预编译产物模式);clone 测试场景用 §2 直启即可,两者不要混跑(同 HOME 单实例锁)。
- **常驻(`just daemon install`)**:当前会自动生成 `~/Library/LaunchAgents/com.saydo.pipeline.plist`(见本节)。`--without-pipeline` 只装 daemon:桌面浏览器云端语音不可用(浏览器系统语音与 iPhone 原生语音仍可);已有 pipeline plist 时本旗标不拆除。无 `uv` 且只要文本/控制面时用该旗标。

## 5. 试用引导与已知毛边(可直接转述)

> 打开就是「今天」页;点「开口聊」想到哪说到哪,聊成熟它会问你要不要立成一件持续关注的事;要它办的、你欠它的,都会出现在「今天」页。手机上从下方胶囊按住说话,上滑选放进哪件事。
> 已知毛边(不是坏了):①CLI 模式每轮想 15-25 秒是常态,别连点;②偶尔只回应一半诉求,再问一次即可;③「帮我记一下」类随口记录先进记忆库(菜单里可看),立起事后才挂账。

**风险提示(部署者须知)**:开发类请求会真实派发执行任务、消耗额度——预算熔断在 config.toml;放外人用前确认额度;S3(合并/删除)只在本机确认,远程不会出现。

## 6. 关停与重置

```bash
lsof -t -iTCP:47100 -sTCP:LISTEN | xargs kill; pkill -f saydo_pipeline
# 完全重置(回到全新用户状态):停完后 rm -rf ~/.saydo   ← 会轮换 token,手机需重扫码
```
