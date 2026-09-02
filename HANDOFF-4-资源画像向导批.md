# HANDOFF-4:资源画像向导批(2026-08-11;方案=OctoAgent onboarding 方案 v8,义骁双拍板)

> **已交付归档(2026-09-02 月度对账补记)**:本合同对应的资源画像向导批已于 2026-08-11 施工完毕并验收合并入 main(`history/DEV-VERSION-LEDGER.md` §2 登记代码 `e0bb23a`);本文件仅留痕,不再是活合同。当前开工链以根 `HANDOFF.md` 为准。


> 方向:向导从"配置视角"(逐槽问)改为**"资源画像视角"**(先看懂本地,再给完整方案一键起步)。义骁原话:"能怎么用就先起来,快速开始比什么都强;多模型分工在快速开始之后一步一步引导。"目标:**打开到能说话一分钟**。

## 任务(允许域=packages/console/src/;daemon 仅允许 cli-capability/probe 响应的只读消费,如需新字段先标 OPEN QUESTION 不自行加)

1. **首屏=画像呈现**:合成 probe+cli-capability,一屏说清"检测到:cursor-agent(已登录·193 个模型)/codex(已登录·本机用过 2 个模型)/claude(已登录)/API key:无"。探测中用骨架卡(已有惯例);登录态/模型数如实,拿不到就"未知"。
2. **方案卡(2-3 张,画像驱动生成)**:每张=完整五槽配置+一句人话定位+代价标注,例:
   - 「全用 cursor——最快开始」:五槽全 cursor_cli;代价行:"订阅内不另计费;对话每轮约 13-23 秒;评估独立性不可证(将替你勾选知情确认)"
   - 「codex 对话 + claude 评估——独立性更好」(两家都在时):代价行相应;
   - 有 API key 痕迹时给 API 方案卡。
   生成规则写成纯函数+单测(画像输入→卡列表),规则最小化:按"已登录 CLI 集合×是否有 key"枚举,不做花哨评分。
   **点卡=一键**:写全五槽 config+自动带出所需 ack(勾选态在确认弹层里如实展示"将替你签哪两条字、代价是什么",用户确认才提交)→保存→重启→自检→开聊。
3. **逐槽表单降级为「高级模式」**:现 SupplyPicker 流程整体保留,入口收进"高级配置"折叠;方案卡满足不了的用户走它。
4. **L16-L19 并批落地**:①每槽一句人话(对话=跟你聊天的;沉思=复杂事后台深想;廉价=大量小活省钱用;评估=独立检查 AI 自己干的活;开发=真写代码的执行器)——方案卡与高级模式共用同一份文案常量;②成本对比并排(CLI 免费但慢/API 秒回但按量,量级示例);③"其余槽都用和对话一样的"一键(高级模式内);④设置页常驻"当前生效的豁免"卡(读 config 两 ack+对应 hints 文案)+一键撤销(写 config ack=false,提示需重启)。
5. **纪律**:零 emoji;状态词三级;探测/画像数据如实禁伪精确;key 永不回显;ack 代签必须先展示后确认,禁静默代签。
6. **门禁**:pnpm --filter @saydo/console exec tsc --noEmit / test / build 三绿+emoji gate+lint(ci:node 全量);方案卡生成规则单测;空 HOME 走查:画像→点卡→确认代签→重启→自检→开聊全链。commit 中文分主题;不 push。

## 边界外(勿做)
渐进分工引导(attention 建议条)=下批 daemon 件;托管档=中期只留位(画像空资源时暂不显示第三选项);服务端一切。

## 诚实要求
如实汇报;画像/方案卡规则与 daemon 数据形状不符处标 OPEN QUESTION,不自行发明字段。

## v2 修订(2026-08-11;codex 对抗审 3A3B 全吸收,以本节为准覆盖上文冲突)

1. **允许域扩一条 daemon 小增量(解 A1/B2)**:`/api/setup/probe` 响应补 `acks:{evaluator_isolation:boolean, evaluator_same_family:boolean}`(读活动 config [models] 两 ack)+`hints:[{code,slot,message,fix}]`(启动校验同源只读投影)+secrets 布尔补 `ANTHROPIC_API_KEY`。除此之外 daemon 不动。
2. **L19 撤销降级为撤销引导(解 A2)**:撤销 ack=false 单写会因重新触发 violation 而 422(写口全量校验,正确行为)。豁免卡的「撤销」按钮=跳高级模式+预填提示"撤销需同时把评估槽换成合规配置(如 claude_cli)才能保存"——不做单键撤销,不加新协议。
3. **方案卡 binding 规则钉死(解 A3)**:①一键卡只写**四槽**(dialog/thinking/cheap/evaluator),dev 槽留空如实 missing(DevAgentBinding 形态不同且本就不进向导);②cursor_cli 四槽 model 必填——默认模型=其 models 列表首个 id≠"auto" 项,卡面显示所选模型且可改(下拉);**models 为空或不可枚举→该 CLI 的卡不生成**(如实降级,不猜模型名);③codex_cli/claude_cli 用省略 model 的合法形态,卡面标注"用 CLI 默认";④保存 422 时把 violations 人话展示(fail-visible),不静默。
4. **两 ack 分别展示分别确认(解 B1)**:确认弹层两条独立勾选(isolation=资格代价/same_family=同族代价),文案各自说清;缺一不提交对应 ack。
5. **console probe 适配修正(解 B3,并入本批)**:槽键对齐 daemon 真实形状(thinking/evaluator 非 think/eval;状态含 configured;pendingConfig/pendingEnv 在顶层);**画像字段照抄审查附表**:cli-capability=`{clis:[{name,provider,found,version?,path?,auth:{status:logged_in|not_logged_in|not_found|unknown,detail?,fixHint?},enumerable,models:[{id,label?,source:listed|used|configured|alias,seen?}],note?}]}`;登录只认 auth.status;codex"用过 N 个"只数 source==="used"。
