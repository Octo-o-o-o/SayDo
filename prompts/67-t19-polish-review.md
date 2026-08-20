你是对抗评审。只读,不改文件。
评审对象:/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-13-向导快速配置UX重构方案-v1.md 的「v2.1 追加:T19-polish 批」节(P1-P7)。
实施仓:/Users/wangyixiao/WorkSpace/SayDo(main a333f3e)。
背景:v2 已实施(T19,评审档 66);v2.1 是 owner 上手+走查后的七项 polish,全部有实测证据。
重点核验:
1. P1/P2:遮罩与内滚动的真实来源(SetupGate.tsx/SetupWizard.tsx 的容器结构)——"摘遮罩+滚动交还 body"会不会破坏 peek 后 Banner 返回向导的形态、GlobalSettings 里复用的 SetupWizard(设置页里它仍应是内嵌形态?查它有没有第二个消费点);
2. P3 横向网格:现有列表 DOM/样式结构改网格的破坏面;busy 锁、键盘可达性(radio 语义)在网格下怎么保;配置区移到网格下方全宽后,「切换选中收旧展新」的滚动跳动问题;
3. P6:cursor-agent 的目录信任旗标全集(-f/--trust/--yolo 语义差异,查 cage.ts 现有 cursor args 与 T18a 时代为何没撞上——staged self-test 的 cwd 是什么);修后对 tripwire 检测型笼的安全影响;
4. P4/P5/P7:低风险确认。
输出:编号 findings(A/B/C+file:line),终裁。
