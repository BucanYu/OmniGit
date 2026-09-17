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

    // 2. Window focus sync (instant refresh when user returns from external IDE or file manager)
    const handleFocus = () => {
      useAppStore.getState().syncRepoStatusSilently(repoPath);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      window.removeEventListener('focus', handleFocus);
    };
  }, [activeProjectId]);

  // Global shortcuts (e.g. Ctrl+Shift+K for Push)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
        e.preventDefault();
        openPushModal();
      } else if (isCmdOrCtrl && (e.key === ',' || e.key === '，')) {
        e.preventDefault();
        setIsSettingsModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openPushModal, setIsSettingsModalOpen]);

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
        {/* 2.1 Leftmost Sidebar: Multi-repository Projects */}
        <Sidebar />

        {/* Horizontal Resizer: Between Repositories and Changes */}
        <ResizeDivider
          currentWidth={sidebarWidth}
          minWidth={160}
          maxWidth={500}
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
              maxWidth={1100}
              onResize={setStatusPanelWidth}
              onDoubleClickReset={() => setStatusPanelWidth(380)}
              title={t.common.dragResizeHorizontal}
            />

            {/* 2.3 Right Main: Interactive Monaco Diff Editor */}
            <DiffEditorPanel />
          </>
        )}
      </div>

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
