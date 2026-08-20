你是对抗评审。只读,不改文件。
评审对象:/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-13-向导快速配置UX重构方案-v1.md 的「v3.0 追加」节(左右分栏融合布局+中文名)。
实施仓:/Users/wangyixiao/WorkSpace/SayDo(当前 checked-out 分支 ui/standardize-tokens=main=946cc68;工作树有另一会话未提交改动,勿动)。
背景:owner 构想=左栏 Provider 列表、右栏五用途区,由此融合快速/高级两视图,高级视图(SupplyPicker 四步流)退役。
重点核验:
1. 融合语义:右栏单槽换家=mixed。现 validate/SLOT_POLICY/双 ack 的 mixed 规则(哪些组合要哪些 ack、dialog=CLI 的 oneshot 限制、evaluator 同族判定)在"任意逐槽混搭"下的完整矩阵——UI 动态显隐 ack 的判定来源在哪(setupApi 契约表?);有没有"UI 让配但 validate 必拒"的死角组合(例:evaluator 换到与 thinking 异家的 CLI 需要什么 ack;dialog 换 API 时 key 来源)。
2. SupplyPicker 退役面:它还有哪些独立职责(GlobalSettings?failure fallback「转高级配置(已预填)」跳哪?)——退役后这些去向;「转高级」预填 mixed 的失败流在新布局怎么表达。
3. 布局回落:<1000px 回落现有上下布局=两套编排并存的维护面;移动壳/GlobalSettings 内嵌形态影响。
4. 「说到 SayDo」:document.title/侧栏名的消费点;与上架线会话正在改的壳侧 App 名有无文件交集(apps/ 下 strings.xml/Info.plist 已在其未提交区,Web 侧改动是否零交集)。
5. 预置与混搭的状态机:左栏切家时,已手动混搭过的槽是否被覆盖(建议:提示或保留?给出裁决依据);「跟回」语义。
输出:编号 findings(A/B/C+file:line),终裁(可派工/需修订+条件)。
