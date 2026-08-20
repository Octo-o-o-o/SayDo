// D1 控制台(5.1/5.2):路由分发(08 §6 三面一栏 IA 批次②)+ 外壳 + 语音会话贯穿(切导航不断)。

import { useEffect } from "react";
import { CircleHelp } from "lucide-react";
import { api, type Overview } from "./lib/api";
import { useAsync } from "./lib/useAsync";
import { navigate, useHashRoute } from "./lib/router";
import { Layout } from "./shell/Layout";
import { SetupProvider } from "./shell/SetupContext";
import { SetupBootstrapBoundary } from "./components/SetupBootstrapBoundary";
import { SetupBanner } from "./components/SetupGate";
import { VoiceProvider } from "./shell/VoiceContext";
import { EmptyState, PaperCard } from "./components/ui";
import { ApiErrorCard } from "./components/ApiErrorCard";
import { Dashboard } from "./pages/Dashboard";
import { Chat } from "./pages/Chat";
import { Tasks } from "./pages/Tasks";
import { TaskDetail } from "./pages/TaskDetail";
import { Memory } from "./pages/Memory";
import { Artifacts } from "./pages/Artifacts";
import { ProjectSettings } from "./pages/ProjectSettings";
import { Approvals } from "./pages/Approvals";
import { Notify } from "./pages/Notify";
import { Cost } from "./pages/Cost";
import { GlobalSettings } from "./pages/GlobalSettings";
import { Focuses } from "./pages/Focuses";
import { FocusDetail } from "./pages/FocusDetail";
import { Board } from "./pages/Board";
import { Today } from "./pages/Today";
import { DevComponents } from "./pages/DevComponents";
import { DevPages } from "./pages/DevPages";
import { FocusPageRoute } from "./pages/redesign/FocusPageRoute";
import { ReviewPageRoute } from "./pages/redesign/ReviewPageRoute";
import { BoardPageRoute } from "./pages/redesign/BoardPageRoute";
import { RecordsPageRoute } from "./pages/redesign/RecordsPageRoute";
import { useVoice } from "./shell/VoiceContext";
import { MobileApp } from "./mobile/MobileApp";
import { desktopRouteForMobileHash, useMobileRoute } from "./mobile/router";
import { useMobileViewport } from "./mobile/useMobileViewport";

const CHAT_NEW_EMPTY = "想到哪说到哪。聊成熟了,我会问你要不要把这件事立起来持续关注。";

function Page({ route, overview }: { route: ReturnType<typeof useHashRoute>; overview: Overview }) {
  switch (route.page) {
    case "today":
      return <Today />;
    case "board":
      // 批次③:正式看板 = redesign BoardPage
      return <BoardPageRoute />;
    case "legacy-board":
      return <Board />;
    case "dashboard":
      return <Dashboard overview={overview} />;
    case "chat-new":
      // 开口聊:复用无项目 Chat 呈现;空态文案按批次②,不接语音新逻辑
      return <Chat projectId={null} emptyText={CHAT_NEW_EMPTY} />;
    case "chat":
      // 项目内对话 或 旧 #/chat(App 层会重定向到 chat-new)
      return <Chat projectId={route.projectId ?? null} />;
    case "tasks":
      return <Tasks projectId={route.projectId as string} />;
    case "task":
      return <TaskDetail taskId={route.taskId as string} />;
    case "memory":
      return <Memory projectId={route.projectId as string} />;
    case "artifacts":
      return <Artifacts projectId={route.projectId as string} />;
    case "psettings":
      return <ProjectSettings projectId={route.projectId as string} />;
    case "approvals":
      return <Approvals />;
    case "notify":
      return <Notify />;
    case "cost":
      return <Cost />;
    case "settings":
      return <GlobalSettings />;
    case "focuses":
      return <Focuses />;
    case "focus":
      // 批次③:正式 Focus 页 = redesign FocusPage
      return <FocusPageRoute focusId={route.focusId as string} />;
    case "legacy-focus":
      return <FocusDetail focusId={route.focusId as string} />;
    case "review":
      return <ReviewPageRoute taskId={route.taskId as string} />;
    case "records":
      return <RecordsPageRoute focusId={route.focusId as string} />;
    case "dev-components":
      // dev-only:redesign 组件库走查页(handoff §5;不进生产导航)
      return <DevComponents />;
    case "dev-pages":
      // dev-only:redesign 页面拼装走查页(HANDOFF-2 §2;不进生产导航)
      return <DevPages />;
    default:
      return (
        <PaperCard>
          <EmptyState icon={CircleHelp} text="页面不存在" action={<a href="#/today">回今天</a>} />
        </PaperCard>
      );
  }
}

function DesktopAppContent() {
  const route = useHashRoute();
  const voice = useVoice();
  const { data: overview, error, failure } = useAsync(
    () => api.overview(),
    [route.page, route.projectId, voice.sessionProject?.projectRevision]
  );

  // 批次②:#/chat 保留解析,App 层重定向到 #/chat-new(无 projectId 的全局 chat)
  useEffect(() => {
    if (route.page === "chat" && route.projectId === undefined) {
      navigate("/chat-new");
    }
  }, [route.page, route.projectId]);

  return (
    <Layout route={route} projects={overview?.projects ?? []} banner={<SetupBanner />}>
      {route.page === "dev-components" ? (
        // dev-only 走查页:fixture 驱动,不依赖 daemon(handoff §5)
        <DevComponents />
      ) : route.page === "dev-pages" ? (
        // dev-only 页面走查页:fixture 驱动,不依赖 daemon(HANDOFF-2 §2)
        <DevPages />
      ) : error ? (
        <ApiErrorCard
          failure={failure}
          message={error}
          fallbackHint="确认 daemon 在跑,且这个页面是从 daemon 的地址打开的。"
        />
      ) : overview ? (
        <Page route={route} overview={overview} />
      ) : null}
    </Layout>
  );
}

function AppContent() {
  const mobile = useMobileViewport();
  const mobileRoute = useMobileRoute();
  const desktopTarget = mobile ? null : desktopRouteForMobileHash(location.hash);

  useEffect(() => {
    if (desktopTarget) navigate(desktopTarget);
  }, [desktopTarget]);

  if (mobile) return <MobileApp route={mobileRoute} />;
  if (desktopTarget) return null;
  return <DesktopAppContent />;
}

export default function App() {
  return (
    <VoiceProvider>
      <SetupProvider>
        <SetupBootstrapBoundary>
          <AppContent />
        </SetupBootstrapBoundary>
      </SetupProvider>
    </VoiceProvider>
  );
}
