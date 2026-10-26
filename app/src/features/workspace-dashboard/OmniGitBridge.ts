import type {
  DashboardGuestMessage,
  DashboardNavigatePayload,
  DashboardOpenFilePayload,
  DashboardHostStateUpdatePayload,
} from './types';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { useAppStore } from '../../store/useAppStore';
import { useEditorTabsStore } from '../code-editor/useEditorTabsStore';

export interface BridgeOptions {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  expectedToken: string;
  expectedOrigin: string;
  enableBridge: boolean;
  workspaceRoot: string;
}

export function setupOmniGitBridge(options: BridgeOptions): () => void {
  const { iframeRef, expectedToken, expectedOrigin, enableBridge, workspaceRoot } = options;

  if (!enableBridge) {
    return () => {};
  }

  const handleMessage = (event: MessageEvent) => {
    // 1. 安全验真：校验消息来源窗口
    if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
      return;
    }

    // 2. 安全验真：校验 Origin 来源白名单
    if (expectedOrigin && expectedOrigin !== '*' && event.origin !== expectedOrigin) {
      console.warn('[OmniGitBridge] Security Warning: Dropped message from untrusted origin:', event.origin);
      return;
    }

    // 3. 安全验真：必须携带合法的单次会话随机 Token
    const data = event.data as DashboardGuestMessage;
    if (!data || data.source !== 'omnigit-guest') {
      return;
    }

    if (!data.token || data.token !== expectedToken) {
      console.warn('[OmniGitBridge] Security Warning: Dropped message with invalid session token.');
      return;
    }

    // 4. 受控白名单行为调度（绝不提供任何命令行或终端执行操作）
    switch (data.type) {
      case 'omnigit:navigate': {
        const payload = data.payload as DashboardNavigatePayload;
        const targetMode = payload?.mode;

        // 若指定了目标仓库名称或 ID，自动同步激活该工程项目
        if (payload?.projectId) {
          useAppStore.getState().setActiveProject(payload.projectId);
        } else if (payload?.repoName) {
          const matched = useAppStore
            .getState()
            .projects.find((p) => p.name === payload.repoName || p.id === payload.repoName);
          if (matched) {
            useAppStore.getState().setActiveProject(matched.id);
          }
        }

        if (
          targetMode === 'git' ||
          targetMode === 'explorer' ||
          targetMode === 'services' ||
          targetMode === 'dashboard'
        ) {
          useWorkbenchStore.getState().setWorkbenchMode(targetMode);
        }
        break;
      }

      case 'omnigit:open-file': {
        const payload = data.payload as DashboardOpenFilePayload;
        if (!payload?.filePath || typeof payload.filePath !== 'string') return;

        // 安全路径防穿透：过滤任何试图越界跳出工作空间的行为
        const cleanPath = payload.filePath.trim().replace(/^"(.*)"$/, '$1');
        if (cleanPath.includes('..') || cleanPath.startsWith('/') || cleanPath.startsWith('\\')) {
          console.warn('[OmniGitBridge] Security Warning: Blocked path traversal attempt in open-file:', cleanPath);
          return;
        }

        const appState = useAppStore.getState();
        const activeProject = appState.projects.find((p) => p.id === appState.activeProjectId) || appState.projects[0];
        const repoPath = activeProject ? activeProject.path : workspaceRoot;
        const normRoot = repoPath.replace(/\\/g, '/').replace(/\/$/, '');
        const fullTarget = `${normRoot}/${cleanPath.replace(/\\/g, '/')}`;

        // 在内置 Monaco 编辑器中打开，并切换至资源管理器视图
        useEditorTabsStore.getState().openFileTab({
          filePath: fullTarget,
          repoPath,
          relativePath: cleanPath,
          repoName: activeProject?.name || 'Workspace',
        });
        useWorkbenchStore.getState().setWorkbenchMode('explorer');
        break;
      }

      case 'omnigit:sync-all': {
        // 纯只读工作空间 Git 状态触发刷新
        useAppStore.getState().pollWorkspaceSyncStatus?.();
        break;
      }

      case 'omnigit:get-workspace-info': {
        const appState = useAppStore.getState();
        const currentWs = appState.savedWorkspaces.find((w) => w.id === appState.workspaceId);
        const responsePayload: DashboardHostStateUpdatePayload = {
          theme: appState.theme,
          workspace: {
            id: appState.workspaceId,
            name: currentWs?.name || 'Workspace',
            repos: appState.projects.map((p) => ({
              name: p.name,
              branch: p.currentBranch,
              uncommittedCount: p.uncommittedCount || 0,
              incoming: p.incoming || 0,
              outgoing: p.outgoing || 0,
            })),
          },
        };

        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            {
              source: 'omnigit-host',
              type: 'omnigit:state-update',
              payload: responsePayload,
            },
            expectedOrigin || '*'
          );
        }
        break;
      }

      default:
        console.warn('[OmniGitBridge] Unrecognized or disallowed message type:', (data as any).type);
        break;
    }
  };

  window.addEventListener('message', handleMessage);
  return () => {
    window.removeEventListener('message', handleMessage);
  };
}
