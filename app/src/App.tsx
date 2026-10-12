import React, { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { TopBar } from './features/navigation/TopBar';
import { Sidebar } from './features/workspace/Sidebar';
import { StatusPanel } from './features/git-status/StatusPanel';
import { DiffEditorPanel } from './features/diff-editor/DiffEditorPanel';
import { NotificationToast } from './components/ui/NotificationToast';
import { ResizeDivider } from './components/ui/ResizeDivider';
import { PushCommitsModal } from './features/git-push/PushCommitsModal';
import { ThreeWayMergeModal } from './features/git-conflict/ThreeWayMergeModal';
import { ConflictsDialog } from './features/git-conflict/ConflictsDialog';
import { SystemSettingsModal } from './features/settings/SystemSettingsModal';
import { WelcomeWorkspaceView } from './features/workspace/WelcomeWorkspaceView';
import { useTranslation } from './locales';
import { ActivityBar } from './features/activity-bar/ActivityBar';
import { WorkspaceExplorerPanel } from './features/workspace-explorer/WorkspaceExplorerPanel';
import { CodeEditorPanel } from './features/code-editor/CodeEditorPanel';
import { TerminalDock } from './features/terminal/TerminalDock';
import { useTerminalStore } from './features/terminal/useTerminalStore';
import { useWorkbenchStore } from './store/useWorkbenchStore';

export default function App() {
  const { t } = useTranslation();
  const {
    initApp,
    sidebarWidth,
    statusPanelWidth,
    setSidebarWidth,
    setStatusPanelWidth,
    openPushModal,
    isRightPanelOpen,
    activeProjectId,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isWelcomeScreenOpen,
  } = useAppStore();

  const { workbenchMode, setWorkbenchMode } = useWorkbenchStore();
  const { toggleTerminal, createSession } = useTerminalStore();

  const [windowWidth, setWindowWidth] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );

  // Monitor window resize to adaptively clamp panels between fullscreen and windowed modes
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setWindowWidth(w);
      const store = useAppStore.getState();
      if (store.isRightPanelOpen) {
        const maxStatus = Math.max(260, w - store.sidebarWidth - 320);
        if (store.statusPanelWidth > maxStatus) {
          store.setStatusPanelWidth(maxStatus);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    (window as any).__appStore = useAppStore;
    initApp();
  }, [initApp]);

  // Real-time external file modifications sync: SSE watcher + Window focus (zero polling storm)
  useEffect(() => {
    const currentProject = useAppStore.getState().projects.find((p) => p.id === activeProjectId);
    if (!currentProject) return;
    const repoPath = currentProject.path;

    // 1. Single lightweight SSE connection per active project
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/git/watch-repo?path=${encodeURIComponent(repoPath)}`);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'change') {
            useAppStore.getState().syncRepoStatusSilently(repoPath);
          }
        } catch {}
      };
    } catch (e) {
      console.warn('SSE watch error:', e);
    }

    // 2. Window focus & visibility sync (instant refresh when user returns from external IDE or file manager)
    const handleSync = () => {
      useAppStore.getState().syncRepoStatusSilently(repoPath);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleSync();
      }
    };
    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleVisibility);

    // 3. Adaptive conflict poll: while repo is in merge or conflict state, auto-sync every 2s so external edits show in real-time
    const conflictTimer = setInterval(() => {
      const state = useAppStore.getState();
      const hasConflicts = state.isMerging || state.files.some((f) => f.status === 'conflict');
      if (hasConflicts) {
        state.syncRepoStatusSilently(repoPath);
      }
    }, 2000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(conflictTimer);
    };
  }, [activeProjectId]);

  // Global shortcuts (Push, Settings, Terminal, Mode Switching)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
        e.preventDefault();
        openPushModal();
      } else if (isCmdOrCtrl && (e.key === ',' || e.key === '，')) {
        e.preventDefault();
        setIsSettingsModalOpen(true);
      } else if (e.altKey && e.key === '1') {
        e.preventDefault();
        setWorkbenchMode('git');
      } else if (e.altKey && e.key === '2') {
        e.preventDefault();
        setWorkbenchMode('explorer');
      } else if (isCmdOrCtrl && (e.key === '`' || e.key === '~' || e.code === 'Backquote')) {
        e.preventDefault();
        if (e.shiftKey) {
          createSession();
        } else {
          toggleTerminal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openPushModal, setIsSettingsModalOpen, setWorkbenchMode, toggleTerminal, createSession]);

  if (isWelcomeScreenOpen) {
    return (
      <div className="flex flex-col h-screen w-screen bg-theme-app text-theme-main overflow-hidden font-sans select-none">
        <WelcomeWorkspaceView />
        <NotificationToast />
        <PushCommitsModal />
        <ConflictsDialog />
        <ThreeWayMergeModal />
        {isSettingsModalOpen && (
          <SystemSettingsModal onClose={() => setIsSettingsModalOpen(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-theme-app text-theme-main overflow-hidden font-sans select-none">
      {/* 1. Top Navigation Bar: Project selector, Branch capsule with ↙/↗ sync indicators */}
      <TopBar />

      {/* 2. Main Workbench Body with Horizontal Resizable Dividers (只允许左右拖拉调整宽度) */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Activity Bar on Leftmost Edge */}
        <ActivityBar />

        {workbenchMode === 'git' ? (
          <>
            {/* 2.1 Leftmost Sidebar: Multi-repository Projects */}
            <Sidebar />

            {/* Horizontal Resizer: Between Repositories and Changes */}
            <ResizeDivider
              currentWidth={sidebarWidth}
              minWidth={160}
              maxWidth={Math.max(160, Math.min(480, windowWidth - (isRightPanelOpen ? 580 : 260)))}
              onResize={setSidebarWidth}
              onDoubleClickReset={() => setSidebarWidth(256)}
              title={t.common.dragResizeHorizontal}
            />

            {/* 2.2 Left Commit Panel: IDEA-exact Commit tool window */}
            <StatusPanel />

            {isRightPanelOpen && (
              <>
                {/* Horizontal Resizer: Between Changes/Log and Diff Editor */}
                <ResizeDivider
                  currentWidth={statusPanelWidth}
                  minWidth={240}
                  maxWidth={Math.max(260, windowWidth - sidebarWidth - 320)}
                  onResize={setStatusPanelWidth}
                  onDoubleClickReset={() => setStatusPanelWidth(380)}
                  title={t.common.dragResizeHorizontal}
                />

                {/* 2.3 Right Main: Interactive Monaco Diff Editor */}
                <DiffEditorPanel />
              </>
            )}
          </>
        ) : (
          <>
            {/* Multi-Root Workspace Explorer */}
            <WorkspaceExplorerPanel />

            {/* Horizontal Resizer: Between Explorer and Code Editor */}
            <ResizeDivider
              currentWidth={sidebarWidth}
              minWidth={180}
              maxWidth={Math.max(200, windowWidth - 400)}
              onResize={setSidebarWidth}
              onDoubleClickReset={() => setSidebarWidth(260)}
              title={t.common.dragResizeHorizontal}
            />

            {/* Multi-Tab Code Editor Panel */}
            <CodeEditorPanel />
          </>
        )}
      </div>

      {/* Integrated Terminal Dock */}
      <TerminalDock />

      {/* 3. Global Notification Toast (IDEA bottom-right sync toast) */}
      <NotificationToast />

      {/* 4. Global Push Commits Modal (IntelliJ IDEA 1:1) */}
      <PushCommitsModal />

      {/* 5. Global Conflicts Management Dialog (IntelliJ IDEA 1:1) */}
      <ConflictsDialog />

      {/* 6. Global 3-Way Merge Tool Modal (IntelliJ IDEA 1:1) */}
      <ThreeWayMergeModal />

      {/* 6. Global System Settings Modal (IntelliJ IDEA 1:1) */}
      {isSettingsModalOpen && (
        <SystemSettingsModal onClose={() => setIsSettingsModalOpen(false)} />
      )}
    </div>
  );
}
