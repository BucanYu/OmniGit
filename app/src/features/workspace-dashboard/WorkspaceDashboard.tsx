import React, { useEffect } from 'react';
import { useDashboardStore } from './useDashboardStore';
import { useAppStore } from '../../store/useAppStore';
import { EmbeddedFrameView } from './EmbeddedFrameView';
import { DefaultDashboardView } from './DefaultDashboardView';
import { DashboardConfigModal } from './DashboardConfigModal';

export function WorkspaceDashboard() {
  const { activeConfig, loadWorkspaceConfig } = useDashboardStore();
  const { workspaceId, savedWorkspaces } = useAppStore();

  const currentWs = savedWorkspaces.find((w) => w.id === workspaceId);
  const rootPath = currentWs?.rootPath || '';

  // 当工作空间变更时，异步加载并匹配对应的仪表盘配置（支持 .omnigit/dashboard.json 与本地存储）
  useEffect(() => {
    if (workspaceId) {
      loadWorkspaceConfig(workspaceId, rootPath);
    }
  }, [workspaceId, rootPath, loadWorkspaceConfig]);

  const isCustomConfigured = Boolean(
    activeConfig?.enabled && (activeConfig?.url || activeConfig?.filePath)
  );

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden relative">
      {isCustomConfigured ? <EmbeddedFrameView /> : <DefaultDashboardView />}
      <DashboardConfigModal />
    </div>
  );
}
