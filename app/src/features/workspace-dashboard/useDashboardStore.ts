import { create } from 'zustand';
import type { WorkspaceDashboardConfig, TeamDashboardJsonConfig } from './types';
import { useAppStore } from '../../store/useAppStore';

function generateSessionToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `token_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

interface DashboardState {
  isConfigModalOpen: boolean;
  openConfigModal: () => void;
  closeConfigModal: () => void;

  isGuideModalOpen: boolean;
  openGuideModal: () => void;
  closeGuideModal: () => void;

  presetConfig: Partial<WorkspaceDashboardConfig> | null;
  openConfigModalWithPreset: (preset: Partial<WorkspaceDashboardConfig>) => void;
  clearPresetConfig: () => void;

  activeConfig: WorkspaceDashboardConfig | null;
  configScope: 'local' | 'team';
  sessionToken: string;
  refreshKey: number;
  isLoading: boolean;

  triggerRefresh: () => void;
  loadWorkspaceConfig: (workspaceId: string, rootPath?: string) => Promise<WorkspaceDashboardConfig | null>;
  saveConfig: (
    workspaceId: string,
    rootPath: string,
    config: WorkspaceDashboardConfig,
    scope: 'local' | 'team'
  ) => Promise<void>;
  disableCustomDashboard: (workspaceId: string, rootPath: string) => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  isConfigModalOpen: false,
  openConfigModal: () => set({ isConfigModalOpen: true, presetConfig: null }),
  closeConfigModal: () => set({ isConfigModalOpen: false, presetConfig: null }),

  isGuideModalOpen: false,
  openGuideModal: () => set({ isGuideModalOpen: true }),
  closeGuideModal: () => set({ isGuideModalOpen: false }),

  presetConfig: null,
  openConfigModalWithPreset: (preset) => set({ isConfigModalOpen: true, presetConfig: preset }),
  clearPresetConfig: () => set({ presetConfig: null }),

  activeConfig: null,
  configScope: 'local',
  sessionToken: generateSessionToken(),
  refreshKey: 0,
  isLoading: false,

  triggerRefresh: () => {
    set((state) => ({
      refreshKey: state.refreshKey + 1,
      sessionToken: generateSessionToken(),
    }));
  },

  loadWorkspaceConfig: async (workspaceId: string, rootPath?: string) => {
    set({ isLoading: true });
    try {
      // 1. 优先侦测工程根目录 .omnigit/dashboard.json 团队协同配置
      if (rootPath) {
        try {
          const teamFilePath = `${rootPath.replace(/\\/g, '/')}/.omnigit/dashboard.json`;
          const res = await fetch(`/api/fs/read?filePath=${encodeURIComponent(teamFilePath)}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.content) {
              const parsed = JSON.parse(data.content) as TeamDashboardJsonConfig;
              if (parsed && typeof parsed === 'object') {
                const config: WorkspaceDashboardConfig = {
                  enabled: parsed.enabled ?? true,
                  type: parsed.type || 'url',
                  url: parsed.url || '',
                  filePath: parsed.filePath || '',
                  title: parsed.title || '',
                  openMode: parsed.openMode || 'embedded',
                  autoReload: parsed.autoReload ?? false,
                  reloadIntervalSeconds: parsed.reloadIntervalSeconds || 60,
                  enableBridge: parsed.enableBridge ?? (parsed.type === 'file' || parsed.url?.includes('localhost')),
                };
                set({
                  activeConfig: config,
                  configScope: 'team',
                  isLoading: false,
                  sessionToken: generateSessionToken(),
                });
                return config;
              }
            }
          }
        } catch (e) {
          // Team file not present or corrupted, fallback to local store
        }
      }

      // 2. 本地持久化配置读取 (跟随 WorkspaceGroupItem)
      const currentWs = useAppStore
        .getState()
        .savedWorkspaces.find((w) => w.id === workspaceId);

      const localConfig = currentWs?.dashboard || null;
      set({
        activeConfig: localConfig,
        configScope: 'local',
        isLoading: false,
        sessionToken: generateSessionToken(),
      });
      return localConfig;
    } catch (err) {
      console.warn('[useDashboardStore] Error loading dashboard config:', err);
      set({ activeConfig: null, configScope: 'local', isLoading: false });
      return null;
    }
  },

  saveConfig: async (
    workspaceId: string,
    rootPath: string,
    config: WorkspaceDashboardConfig,
    scope: 'local' | 'team'
  ) => {
    set({ isLoading: true });
    try {
      // 1. 保存为团队协同文件 .omnigit/dashboard.json
      if (scope === 'team' && rootPath) {
        const teamFilePath = `${rootPath.replace(/\\/g, '/')}/.omnigit/dashboard.json`;
        const fileContent: TeamDashboardJsonConfig = {
          $schema: 'https://omnigit.dev/schemas/dashboard.schema.json',
          version: '1.0',
          updatedAt: new Date().toISOString(),
          ...config,
        };
        await fetch('/api/fs/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath: teamFilePath,
            content: JSON.stringify(fileContent, null, 2),
            encoding: 'utf-8',
          }),
        });
      }

      // 2. 无论 scope 为何，同步写入当前工作空间本地记录以获得秒切体验
      const appStore = useAppStore.getState();
      const currentWs = appStore.savedWorkspaces.find((w) => w.id === workspaceId);
      if (currentWs) {
        const updatedWs = {
          ...currentWs,
          dashboard: config,
        };
        appStore.saveWorkspaceRecord(updatedWs);
      }

      set({
        activeConfig: config,
        configScope: scope,
        isConfigModalOpen: false,
        isLoading: false,
        sessionToken: generateSessionToken(),
        refreshKey: get().refreshKey + 1,
      });
    } catch (err) {
      console.error('[useDashboardStore] Failed to save dashboard config:', err);
      set({ isLoading: false });
    }
  },

  disableCustomDashboard: async (workspaceId: string, rootPath: string) => {
    const current = get().activeConfig;
    if (!current) return;
    const disabledConfig: WorkspaceDashboardConfig = {
      ...current,
      enabled: false,
    };
    await get().saveConfig(workspaceId, rootPath, disabledConfig, get().configScope);
  },
}));
