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
import { useWorkspaceExplorerStore } from './features/workspace-explorer/useWorkspaceExplorerStore';
import { useEditorTabsStore } from './features/code-editor/useEditorTabsStore';
import { GlobalSearchModal } from './features/global-search/GlobalSearchModal';
import { useGlobalSearchStore } from './features/global-search/useGlobalSearchStore';
import { ServicesDashboard } from './features/services/ServicesDashboard';
import { useServicesStore } from './features/services/useServicesStore';

export default function App() {
  const { t } = useTranslation();
  const initApp = useAppStore((state) => state.initApp);
  const sidebarWidth = useAppStore((state) => state.sidebarWidth);
  const statusPanelWidth = useAppStore((state) => state.statusPanelWidth);
  const setSidebarWidth = useAppStore((state) => state.setSidebarWidth);
  const setStatusPanelWidth = useAppStore((state) => state.setStatusPanelWidth);
  const openPushModal = useAppStore((state) => state.openPushModal);
  const isRightPanelOpen = useAppStore((state) => state.isRightPanelOpen);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const isSettingsModalOpen = useAppStore((state) => state.isSettingsModalOpen);
  const setIsSettingsModalOpen = useAppStore((state) => state.setIsSettingsModalOpen);
  const isWelcomeScreenOpen = useAppStore((state) => state.isWelcomeScreenOpen);
  const workspaceId = useAppStore((state) => state.workspaceId);

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
    (window as any).__workbenchStore = useWorkbenchStore;
    (window as any).__workspaceExplorerStore = useWorkspaceExplorerStore;
    (window as any).__editorTabsStore = useEditorTabsStore;
    (window as any).__terminalStore = useTerminalStore;
    (window as any).__globalSearchStore = useGlobalSearchStore;
    (window as any).__servicesStore = useServicesStore;
    initApp();
  }, [initApp]);

  // Restore persisted open editor tabs for active workspace on startup or workspace switch
  useEffect(() => {
    if (workspaceId && workspaceId !== 'default') {
      useEditorTabsStore.getState().restorePersistedTabs(workspaceId);
    }
  }, [workspaceId]);

  // Real-time external file modifications sync: SSE watcher + Window focus (zero polling storm)
  // Decoupled architecture: git status CLI processes are ONLY invoked when user is in 'git' workbench mode.
  // When editing source files or monitoring services, git background CLI calls are suppressed to eliminate UI lag.
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
            if (useWorkbenchStore.getState().workbenchMode === 'git') {
              useAppStore.getState().syncRepoStatusSilently(repoPath);
            }
          }
        } catch {}
      };
    } catch (e) {
      console.warn('SSE watch error:', e);
    }

    // 2. Window focus & visibility sync: only trigger if in git mode
    const handleSync = () => {
      if (useWorkbenchStore.getState().workbenchMode === 'git') {
        useAppStore.getState().syncRepoStatusSilently(repoPath);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleSync();
      }
    };
    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleVisibility);

    // 3. Adaptive conflict poll: while repo is in merge or conflict state, auto-sync every 2s
    const conflictTimer = setInterval(() => {
      if (useWorkbenchStore.getState().workbenchMode === 'git') {
        const state = useAppStore.getState();
        const hasConflicts = state.isMerging || state.files.some((f) => f.status === 'conflict');
        if (hasConflicts) {
          state.syncRepoStatusSilently(repoPath);
        }
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

  // When switching back to Git workbench mode, refresh repo status on demand cleanly
  useEffect(() => {
    if (workbenchMode === 'git' && activeProjectId) {
      const currentProject = useAppStore.getState().projects.find((p) => p.id === activeProjectId);
      if (currentProject) {
        useAppStore.getState().syncRepoStatusSilently(currentProject.path);
      }
    }
  }, [workbenchMode, activeProjectId]);

  // Global shortcuts (Push, Settings, Terminal, Mode Switching)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        useGlobalSearchStore.getState().openSearchModal();
      } else if (isCmdOrCtrl && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
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
        <GlobalSearchModal />
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
        ) : workbenchMode === 'services' ? (
          <ServicesDashboard />
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

      {/* 7. Global Code Search (Find in Files, IntelliJ IDEA 1:1) */}
      <GlobalSearchModal />

      {/* 8. Global System Settings Modal (IntelliJ IDEA 1:1) */}
      {isSettingsModalOpen && (
        <SystemSettingsModal onClose={() => setIsSettingsModalOpen(false)} />
      )}
    </div>
  );
}
