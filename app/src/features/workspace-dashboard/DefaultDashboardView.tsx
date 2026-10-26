import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { useTerminalStore } from '../terminal/useTerminalStore';
import { useDashboardStore } from './useDashboardStore';
import { useServicesStore } from '../services/useServicesStore';
import { WorkspaceHeroHeader } from './WorkspaceHeroHeader';
import { WorkspaceQuickActions } from './WorkspaceQuickActions';
import { WorkspaceRepoMatrix } from './WorkspaceRepoMatrix';
import { WorkspacePortalBanner } from './WorkspacePortalBanner';

export function DefaultDashboardView() {
  const {
    workspaceId,
    savedWorkspaces,
    projects,
    setActiveProject,
    pollWorkspaceSyncStatus,
  } = useAppStore();

  const { setWorkbenchMode } = useWorkbenchStore();
  const { toggleTerminal } = useTerminalStore();
  const { openConfigModal, openGuideModal, openConfigModalWithPreset } = useDashboardStore();
  const runningServicesCount = useServicesStore((state) => state.getRunningCount());

  const [isSyncing, setIsSyncing] = useState(false);

  const currentWs = savedWorkspaces.find((w) => w.id === workspaceId);
  const workspaceName = currentWs?.name || 'Workspace';
  const rootPath = currentWs?.rootPath || '';

  // Calculate workspace aggregated metrics
  const totalRepos = projects.length;
  const totalUncommitted = projects.reduce((acc, p) => acc + (p.uncommittedCount || 0), 0);
  const totalIncoming = projects.reduce((acc, p) => acc + (p.incoming || 0), 0);
  const totalOutgoing = projects.reduce((acc, p) => acc + (p.outgoing || 0), 0);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      await pollWorkspaceSyncStatus?.();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenRepoCommit = (repoId: string) => {
    setActiveProject(repoId);
    setWorkbenchMode('git');
  };

  const handleOpenRepoExplorer = (repoId: string) => {
    setActiveProject(repoId);
    setWorkbenchMode('explorer');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-theme-app overflow-y-auto select-none p-5 sm:p-6 space-y-5">
      {/* 1. Fluid Workspace Hero Header */}
      <WorkspaceHeroHeader
        workspaceName={workspaceName}
        rootPath={rootPath}
        totalRepos={totalRepos}
        totalUncommitted={totalUncommitted}
        totalIncoming={totalIncoming}
        totalOutgoing={totalOutgoing}
        runningServicesCount={runningServicesCount}
        isSyncing={isSyncing}
        onSyncAll={handleSyncAll}
        onOpenConfig={openConfigModal}
      />

      {/* 2. Responsive Quick Actions Island */}
      <WorkspaceQuickActions
        totalUncommitted={totalUncommitted}
        runningServicesCount={runningServicesCount}
        onNavigateGit={() => setWorkbenchMode('git')}
        onNavigateExplorer={() => setWorkbenchMode('explorer')}
        onNavigateServices={() => setWorkbenchMode('services')}
        onToggleTerminal={toggleTerminal}
      />

      {/* 3. Intelligent Multi-Repo Matrix (Tabs + Search + Grid/List) */}
      <WorkspaceRepoMatrix
        projects={projects}
        onOpenRepoCommit={handleOpenRepoCommit}
        onOpenRepoExplorer={handleOpenRepoExplorer}
      />

      {/* 4. Streamlined Custom Portal Showcase Banner */}
      <WorkspacePortalBanner
        onOpenGuideModal={openGuideModal}
        onApplyPreset={openConfigModalWithPreset}
      />
    </div>
  );
}
