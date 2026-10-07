# repair48 RF 源职责审读

这是作者正常RF分类，不是独立最终候选验收或SOURCE_FINITE认证。8项按当前完整源码逐项审读并登记SHA；未读旧160文档/46commit不记FULL。既有101actions/3781effects/7754diagnostics/22none及未知PG结论不改变。

- `research/native-preparation/bounded_read.py`：176行/8954B，SHA `f27f9dc5a6986ff324835fa01baeaeacc5eea74e6ef0654a85bf14eef053af01`。共享Budget直接FS研究工具：参数/余额/deadline拒绝，元数据与FD核对、逐块实际bytes、未知open槽、持有stream清理回执；无模块启动读、transport注册、完整prepare/build/load。release_closed只核对象关闭，不关裸FD。未证明OS/loader/native/mmap/heap全通道。
- `research/native-preparation/precheck.py`：13行/479B，SHA `66a37d3d39b018cf2694cf13e4ce80fa0f24a24ea37dfd7e9d83fa71b12dbec8`。显式configure持有同一Budget、拒重新绑定；read仅委托Budget.read固定precheck阶段并返回bytes。没有预检查编排、模块bootstrap I/O、transport、build/load。
- `research/native-preparation/collect-prepare.py`：13行/499B，SHA `19bbc69fdaf9b9da1a8ae0fb43c00ae93a78925bce2924f4f08b4111a6fa1a49`。显式共享Budget薄collector角色；read传phase/sink/channel并返回bytes/event，sink写异常由reader保存账。没有全树收集/启动子进程/完整prepare编排或transport。
- `research/native-preparation/finalize.py`：13行/471B，SHA `1f3dc587b1aafa50a7bc64333ef093ba1efb6c42204f6c668d283548e3cc6600`。显式共享Budget薄finalizer角色，read委托阶段并返回bytes/event；不写最终包、不读取旧trial或启动native，不代表旧完整finalizer已接入。无transport。
- `research/native-preparation/check-and-record.py`：13行/474B，SHA `9640a737c1e6e286d982cb8abbafe5e24bf5e32d1302a26926a3f3615d6fcea3`。显式共享Budget薄check-and-record角色，read返回bytes，实际事件由Budget保存；不持久化旧trial manifest/新准备编排，无transport/build/load。
- `research/native-preparation/test_bounded_read.py`：229行/14561B，SHA `0c2c764eff86a1d8d5b51a4d57c939d6633240f46c819401ac36be2c59ac6747`。unittest真实tiny FS+Spy/明确fstat及close注入测试，逐四真实wrapper验证cap/漂移/共享账/持有handle；唯一__main__调用unittest.main是测试CLI入口，不是生产transport。错误注入不是OS故障率或正式native资源授信。
- `packages/contracts/src/types/truthPlane.ts`：507行/22882B，SHA `630442e20316cf37ffac489842270dd131310d769576820bb8ad31e6c61b7641`。完整审读词表、公开状态映射、路径/entry ref、cost限额、capability/action/effect/scope/support/gate/source-binding与四ledger schema refinements。SELF_PATHS包含reader及其test，via最多13、record256等原合同不变；模块只定义导出schema/常量，无transport注册或产品调用成功证明。
- `packages/contracts/test/truth-plane.test.ts`：150行/7072B，SHA `d761b15c4e06fa42d039e72fffc4ddc9551b485d5b1bfb6628702f1559ad89de`。完整审读vitest断言：vocab投影、C14人工写/运行证据绑定、none iff原因、direct禁项、公开rank、process provenance、via13/14和新读工具自引用禁集。测试readFileSync仅读vocab fixture；无transport注册，PASS不等于完整产品验收。

唯一新增机械命中 `research/native-preparation/test_bounded_read.py:229` 处置为verified_semantics/reachability=test。discovered保留648，原selected647历史保留；按原算法当前selected648只表示已具名处置，不表示生产能力或已执行。本次不改computeDenominators、不新增selected:false。六研究源全文职责登记与两contracts旧审核锚实际重审后更新，未批量授信其他unknown。旧四完整准备helper仍禁止resume。
