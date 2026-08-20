// #/dev-components(dev-only 走查页,handoff §5 门禁要求):平铺渲染 redesign 组件库全组件全状态。
// 只读预览:所有回调打 console.debug;不进生产导航(路由表单独标注 dev-only)。

import type { ReactNode } from "react";
import {
  BoardColsHeader, BoardLaneGroup, ComposerHaltBar, ConfirmCard, DecisionPackageCard,
  ExpectationDriftCard, ExpectationGroup, FocusRail, FocusStateCard, InterviewCard,
  ApprovalModal, ArtifactModal, EmailPreviewModal, HpTaskModal, NewFocusModal,
  ObligationModal, S3InfoModal, TailnetPreviewModal,
  ProgressAlignCard, RecordsPanel, ReviewPanel, SessionSegmentCard, StandbyCard, TaskCard,
  TimelineNote
} from "../components/redesign";
import { focusStateCardFixtures } from "../components/redesign/FocusStateCard.fixture";
import { segmentTranscriptDemo, sessionSegmentFixtures, timelineNoteFixtures } from "../components/redesign/TimelineNote.fixture";
import { confirmCardFixtures } from "../components/redesign/ConfirmCard.fixture";
import { decisionPackageFixtures } from "../components/redesign/DecisionPackageCard.fixture";
import { progressAlignFixtures } from "../components/redesign/ProgressAlignCard.fixture";
import { standbyFixtures } from "../components/redesign/StandbyCard.fixture";
import { interviewFixtures } from "../components/redesign/InterviewCard.fixture";
import { taskCardFixtures } from "../components/redesign/TaskCard.fixture";
import { focusRailFixtures } from "../components/redesign/FocusRail.fixture";
import { reviewCoding, reviewS3, reviewWriting } from "../components/redesign/ReviewPanel.fixture";
import { boardGroupCollapsed, boardGroupMulti, boardGroupSingle } from "../components/redesign/BoardLaneGroup.fixture";
import { recordsFixture } from "../components/redesign/RecordsPanel.fixture";
import { composerHaltFixtures } from "../components/redesign/ComposerHaltBar.fixture";
import { driftCardFixtures, expectationGroupFixtures } from "../components/redesign/ExpectationGroup.fixture";
import { modalsFixtures } from "../components/redesign/Modals.fixture";

const debug = (...args: unknown[]) => console.debug("[dev-components action]", ...args);

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--space-7)" }}>
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: 4 }}>{title}</h2>
      {note ? <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", margin: "0 0 var(--space-3)" }}>{note}</p> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>{children}</div>
    </section>
  );
}

function Case({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>{name}</div>
      {children}
    </div>
  );
}

export function DevComponents() {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }} data-page="dev-components">
      <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: 4 }}>redesign 组件库走查</h1>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-5)" }}>
        dev-only:全部 fixture 平铺;回调打 console.debug。数据全走 props,组件不接线(HANDOFF §5)。
      </p>

      <Section title="FocusStateCard" note="标题/lifecycle/rN/方向/球权文字(文字形态,永不数字角标)">
        {focusStateCardFixtures.map((f, i) => (
          <Case key={i} name={f.name}><FocusStateCard focus={f.focus} onOpenRecords={() => debug("records")} /></Case>
        ))}
      </Section>

      <Section title="TimelineNote / SessionSegmentCard" note="历史=段+展开(懒加载);未存转写占位不伪造;中断缺尾如实">
        {timelineNoteFixtures.map((f, i) => <Case key={i} name={f.name}><TimelineNote text={f.text} /></Case>)}
        {sessionSegmentFixtures.map((f, i) => (
          <Case key={i} name={f.name}>
            <SessionSegmentCard
              turnCount={f.turnCount}
              startTs={f.startTs}
              endTs={f.endTs}
              transcriptAvailable={f.transcriptAvailable}
              onExpand={() => segmentTranscriptDemo}
            />
          </Case>
        ))}
      </Section>

      <Section title="ConfirmCard" note="kind 按真实枚举;倒计时由 props 传;超时不自动「记」">
        {confirmCardFixtures.map((f, i) => (
          <Case key={i} name={f.name}><ConfirmCard data={f.data} onAction={(d, id) => debug("confirm", d, id)} /></Case>
        ))}
      </Section>

      <Section title="DecisionPackageCard" note="六节结构;二选一无默认预选,推荐只占徽章">
        {decisionPackageFixtures.map((f, i) => (
          <Case key={i} name={f.name}><DecisionPackageCard pkg={f.pkg} onAction={(a, p) => debug("pkg", a, p)} /></Case>
        ))}
      </Section>

      <Section title="ProgressAlignCard" note="期待 vs 现实主动对账">
        {progressAlignFixtures.map((f, i) => (
          <Case key={i} name={f.name}><ProgressAlignCard expectation={f.expectation} nextStepText={f.nextStepText} pkgSteps={f.pkgSteps} /></Case>
        ))}
      </Section>

      <Section title="StandbyCard" note="在等什么/叫醒条件/到期兜底(有账的沉默)">
        {standbyFixtures.map((f, i) => (
          <Case key={i} name={f.name}>
            <StandbyCard waitingText={f.waitingText} wakeCondition={f.wakeCondition} woken={f.woken} wokenText={f.wokenText} onAction={(a) => debug("standby", a)} />
          </Case>
        ))}
      </Section>

      <Section title="InterviewCard" note="一次一问;推荐只占徽章不占预选位">
        {interviewFixtures.map((f, i) => (
          <Case key={i} name={f.name}>
            <InterviewCard question={f.question} options={f.options} recommended={f.recommended} picked={f.picked} onPick={(o) => debug("interview", o)} />
          </Case>
        ))}
      </Section>

      <Section title="TaskCard" note="16 呈现态全覆盖 + Hopper 两种;动作全部回调">
        {taskCardFixtures.map((f, i) => (
          <Case key={i} name={f.name}><TaskCard task={f.task} onAction={(a, t) => debug("task", a, t.id)} /></Case>
        ))}
      </Section>

      <Section title="FocusRail" note="右栏四组;只读状态投影;条目状态只留 chip">
        <Case name="完整右栏(安排/产物/涉及项目/记住的事)">
          <div style={{ maxWidth: 340 }}>
            <FocusRail
              obligations={focusRailFixtures.obligations}
              tasks={focusRailFixtures.tasks}
              artifacts={focusRailFixtures.artifacts}
              projects={focusRailFixtures.projects}
              memories={focusRailFixtures.memories}
              onLocate={(t) => debug("locate", t)}
              onExpect={() => debug("expect")}
            />
          </div>
        </Case>
      </Section>

      <Section title="ReviewPanel" note="左标准右证据;自报空心勾降权;讲给我听三层;writing 逐条裁决;S3 独立按钮">
        <Case name="coding(机器验+自报+人工 unknown)"><ReviewPanel ctx={reviewCoding} onAction={(a) => debug("review", a)} /></Case>
        <Case name="writing(人工项逐条裁决后才放行)"><ReviewPanel ctx={reviewWriting} onAction={(a) => debug("review", a)} /></Case>
        <Case name="S3(Touch ID 独立按钮区)"><ReviewPanel ctx={reviewS3} onAction={(a) => debug("review", a)} /></Case>
      </Section>

      <Section title="BoardLaneGroup" note="Focus 分组+子泳道+4 列;格子折叠(4 张);组折叠">
        <BoardColsHeader />
        <Case name="多支线组(2 条支线)"><BoardLaneGroup data={boardGroupMulti} onOpenTask={(t) => debug("openTask", t.id)} onOpenObligation={(o) => debug("openOb", o.id)} onToggleCollapse={() => debug("collapse")} /></Case>
        <Case name="单支线组"><BoardLaneGroup data={boardGroupSingle} onOpenTask={(t) => debug("openTask", t.id)} onToggleCollapse={() => debug("collapse")} /></Case>
        <Case name="折叠组(休眠默认收起)"><BoardLaneGroup data={boardGroupCollapsed} collapsed onToggleCollapse={() => debug("expand")} /></Case>
      </Section>

      <Section title="RecordsPanel" note="支线航迹/依赖链/会话段/事件流/操作区(回调)">
        <Case name="完整记录面">
          <RecordsPanel
            focus={recordsFixture.focus}
            lanes={recordsFixture.lanes}
            dependencies={recordsFixture.dependencies}
            segments={recordsFixture.segments}
            events={recordsFixture.events}
            onAction={(a) => debug("records", a)}
            onExpandSegment={() => segmentTranscriptDemo}
          />
        </Case>
      </Section>

      <Section title="ComposerHaltBar" note="三种停机三种文案;closed 只能 fork">
        {composerHaltFixtures.map((f, i) => (
          <Case key={i} name={f.name}><ComposerHaltBar lifecycle={f.lifecycle} onFork={() => debug("fork")} /></Case>
        ))}
      </Section>

      <Section title="ExpectationGroup / ExpectationDriftCard(OPEN QUESTION:未在交接清单,demo v2.1 增量)">
        {expectationGroupFixtures.map((f, i) => (
          <Case key={i} name={f.name}>
            <div style={{ maxWidth: 340 }}><ExpectationGroup expectation={f.expectation} onEdit={(t) => debug("expEdit", t)} /></div>
          </Case>
        ))}
        {driftCardFixtures.map((f, i) => (
          <Case key={i} name={f.name}><ExpectationDriftCard text={f.text} detail={f.detail} resolved={f.resolved} onAction={(a) => debug("drift", a)} /></Case>
        ))}
      </Section>

      <Section title="弹窗族(inline 平铺)" note="审批含 S2 改后批准;HP+DecisionRequest;S3 说明;tailnet;新 Focus 表单;邮件 P1 提案">
        <Case name="审批(S2,含改后批准 textarea 流)"><ApprovalModal approval={modalsFixtures.approval} onAction={(a, c) => debug("approval", a, c)} inline /></Case>
        <Case name="义务(human · decision)"><ObligationModal obligation={modalsFixtures.obligation} focusTitle="九月产品发布会讲稿" onAction={(a, t) => debug("obligation", a, t)} inline /></Case>
        <Case name="产物(expected · 可 realize)"><ArtifactModal artifact={modalsFixtures.artifact} focusTitle="给 SayDo 重做前端" onAction={(a) => debug("artifact", a)} inline /></Case>
        <Case name="HP 详情 + DecisionRequest"><HpTaskModal task={modalsFixtures.hpTask} focusTitle="月度运营报表自动化" onAction={(a) => debug("hp", a)} inline /></Case>
        <Case name="S3 说明卡"><S3InfoModal inline /></Case>
        <Case name="tailnet 手机薄版预览"><TailnetPreviewModal items={modalsFixtures.tailnetItems} inline /></Case>
        <Case name="新 Focus 表单(不必先立项,开口即可)"><NewFocusModal spaces={modalsFixtures.spaces} onAction={(a, d) => debug("newFocus", a, d)} inline /></Case>
        <Case name="邮件推送预览(P1 提案,不接真实通道)"><EmailPreviewModal items={modalsFixtures.emailItems} inline /></Case>
      </Section>
    </div>
  );
}
