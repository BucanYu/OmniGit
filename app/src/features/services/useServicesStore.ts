import { create } from 'zustand';
import type {
  ServiceConfig,
  ServiceRuntimeState,
  DiscoveredScriptGroup,
  ServiceStatus,
} from './types';
import {
  StreamLogBuffer,
  DEFAULT_RUNTIME_STATE,
  normalizeProjectPath,
  getPathStorageKey,
  getLegacyStorageKey,
  KNOWN_PROJECT_CANONICAL_SERVICES,
  validateAndSanitizeServices,
  resolveProject,
  fetchDiskBackup,
  saveProjectServiceConfigsLocally,
  resolveServiceCwd,
  bindServiceEventListeners,
  detectConflictPortFromLog,
  computeProcessExitInfo,
  fetchProjectScriptsFromBackend,
  buildImportedServicesFromGroups,
  applyUpdatedServiceConfigs,
  invokeStartServiceBackend,
  invokeStopServiceBackend,
  invokeKillPortBackend,
} from './serviceStorage';

export { StreamLogBuffer, normalizeProjectPath };

interface ServicesState {
  configsByProject: Record<string, ServiceConfig[]>;
  runtimeStates: Record<string, ServiceRuntimeState>;
  activeServiceId: string | null;
  autoScrollByService: Record<string, boolean>;
  isConfigModalOpen: boolean;
  editingService: ServiceConfig | null;

  // Selected project within services module
  servicesSelectedProjectId: string | null;
  lastSyncedGitProjectId: string | null;
  setServicesSelectedProjectId: (projectId: string) => void;
  syncWithGitActiveProject: (gitProjectId: string) => void;

  // Actions
  loadProjectServices: (projectIdOrPath: string, explicitPath?: string) => ServiceConfig[];
  getServices: (projectIdOrPath: string) => ServiceConfig[];
  getRuntime: (serviceId: string) => ServiceRuntimeState;
  setActiveServiceId: (serviceId: string | null) => void;
  openAddModal: () => void;
  openEditModal: (service: ServiceConfig) => void;
  closeConfigModal: () => void;

  scanProjectScripts: (projectIdOrPath: string) => Promise<DiscoveredScriptGroup[]>;
  importDiscoveredScripts: (projectIdOrPath: string, groups: DiscoveredScriptGroup[]) => ServiceConfig[];

  addService: (
    projectIdOrPath: string,
    data: Omit<ServiceConfig, 'id' | 'createdAt' | 'updatedAt'>
  ) => ServiceConfig;
  updateService: (
    projectIdOrPath: string,
    serviceId: string,
    updates: Partial<Omit<ServiceConfig, 'id' | 'createdAt'>>
  ) => void;
  renameService: (projectIdOrPath: string, serviceId: string, newName: string) => void;
  reorderServices: (projectIdOrPath: string, fromIndex: number, toIndex: number) => void;
  deleteService: (projectIdOrPath: string, serviceId: string) => Promise<void>;

  startService: (projectIdOrPath: string, serviceId: string) => Promise<boolean>;
  stopService: (serviceId: string) => Promise<boolean>;
  restartService: (projectIdOrPath: string, serviceId: string) => Promise<boolean>;
  killPortAndRestart: (projectIdOrPath: string, serviceId: string, port: number) => Promise<boolean>;
  startAllServices: (projectIdOrPath: string) => Promise<void>;
  stopAllServices: (projectIdOrPath: string) => Promise<void>;

  clearLogs: (serviceId: string) => void;
  setAutoScroll: (serviceId: string, enabled: boolean) => void;
  toggleAutoScroll: (serviceId: string) => void;
  hasRunningServices: (projectIdOrPath?: string) => boolean;
  getRunningCount: (projectIdOrPath?: string) => number;
  appendLog: (serviceId: string, text: string) => void;
  handleProcessExit: (serviceId: string, exitCode: number, signal?: string, pid?: number) => void;
}

const serviceLogBuffers = new Map<string, StreamLogBuffer>();
const pendingLogFlushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastLogFlushTime = new Map<string, number>();
const LOG_FLUSH_INTERVAL_MS = 32;

export const useServicesStore = create<ServicesState>((set, get) => ({
  configsByProject: {},
  runtimeStates: {},
  activeServiceId: null,
  autoScrollByService: {},
  isConfigModalOpen: false,
  editingService: null,

  servicesSelectedProjectId: null,
  lastSyncedGitProjectId: null,

  setServicesSelectedProjectId: (projectId: string) => {
    set({ servicesSelectedProjectId: projectId, activeServiceId: null });
  },

  syncWithGitActiveProject: (gitProjectId: string) => {
    if (!gitProjectId) return;
    const { lastSyncedGitProjectId, servicesSelectedProjectId } = get();
    if (gitProjectId !== lastSyncedGitProjectId) {
      set({
        servicesSelectedProjectId: gitProjectId,
        lastSyncedGitProjectId: gitProjectId,
        activeServiceId: null,
      });
    } else if (!servicesSelectedProjectId) {
      set({
        servicesSelectedProjectId: gitProjectId,
        lastSyncedGitProjectId: gitProjectId,
      });
    }
  },

  loadProjectServices: (projectIdOrPath: string, explicitPath?: string) => {
    if (!projectIdOrPath && !explicitPath) return [];

    const { projectId, normPath } = resolveProject(projectIdOrPath, explicitPath);
    if (!normPath) return [];

    // Tier 1: Check in-memory store
    const inMemory = get().configsByProject[normPath];
    if (inMemory && inMemory.length > 0) {
      const sanitized = validateAndSanitizeServices(normPath, inMemory);
      if (sanitized) return sanitized;
    }

    let loaded: ServiceConfig[] | null = null;

    // Tier 2: Check localStorage primary path key
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(getPathStorageKey(normPath));
        if (raw) {
          const parsed = JSON.parse(raw);
          const sanitized = validateAndSanitizeServices(normPath, parsed);
          if (sanitized && sanitized.length > 0) {
            loaded = sanitized;
          } else {
            localStorage.removeItem(getPathStorageKey(normPath));
            if (projectId) localStorage.removeItem(getLegacyStorageKey(projectId));
          }
        }
      } catch (err) {
        console.warn('[useServicesStore] Failed reading path key from localStorage:', err);
      }
    }

    // Tier 3: Check Known Project Canonical Services (deterministic 0ms resolution)
    if (!loaded && KNOWN_PROJECT_CANONICAL_SERVICES[normPath]) {
      loaded = KNOWN_PROJECT_CANONICAL_SERVICES[normPath];
    }

    if (loaded && loaded.length > 0) {
      const nextConfigs: Record<string, ServiceConfig[]> = {
        ...get().configsByProject,
        [normPath]: loaded,
      };
      if (projectId) nextConfigs[projectId] = loaded;

      set((state) => ({
        configsByProject: nextConfigs,
        activeServiceId: state.activeServiceId || loaded![0].id,
      }));

      saveProjectServiceConfigsLocally(normPath, projectId, loaded);
      return loaded;
    }

    // Tier 4: Async check from disk backup (services_backup.json)
    fetchDiskBackup().then((backup) => {
      if (!backup || typeof backup !== 'object') return;
      let matched: ServiceConfig[] | null = null;
      for (const [key, configs] of Object.entries(backup)) {
        if (normalizeProjectPath(key) === normPath && Array.isArray(configs) && configs.length > 0) {
          const sanitized = validateAndSanitizeServices(normPath, configs);
          if (sanitized && sanitized.length > 0) {
            matched = sanitized;
            break;
          }
        }
      }
      if (matched && matched.length > 0) {
        const nextConfigs: Record<string, ServiceConfig[]> = {
          ...get().configsByProject,
          [normPath]: matched,
        };
        if (projectId) nextConfigs[projectId] = matched;

        set((state) => ({
          configsByProject: nextConfigs,
          activeServiceId: state.activeServiceId || matched![0].id,
        }));

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(getPathStorageKey(normPath), JSON.stringify(matched));
            if (projectId) localStorage.setItem(getLegacyStorageKey(projectId), JSON.stringify(matched));
          } catch {}
        }
      }
    });

    const nextConfigs: Record<string, ServiceConfig[]> = { ...get().configsByProject };
    nextConfigs[normPath] = [];
    if (projectId) nextConfigs[projectId] = [];
    set({ configsByProject: nextConfigs });

    return [];
  },

  getServices: (projectIdOrPath: string) => {
    if (!projectIdOrPath) return [];
    const { projectId, normPath } = resolveProject(projectIdOrPath);
    const configs = get().configsByProject;
    if (normPath && configs[normPath]?.length > 0) {
      const sanitized = validateAndSanitizeServices(normPath, configs[normPath]);
      if (sanitized) return sanitized;
    }
    if (projectId && configs[projectId]?.length > 0) {
      return configs[projectId];
    }
    if (configs[projectIdOrPath]?.length > 0) {
      return configs[projectIdOrPath];
    }
    return [];
  },

  getRuntime: (serviceId: string) => {
    return get().runtimeStates[serviceId] || DEFAULT_RUNTIME_STATE;
  },

  setActiveServiceId: (serviceId: string | null) => {
    set({ activeServiceId: serviceId });
  },

  openAddModal: () => {
    set({ isConfigModalOpen: true, editingService: null });
  },

  openEditModal: (service: ServiceConfig) => {
    set({ isConfigModalOpen: true, editingService: service });
  },

  closeConfigModal: () => {
    set({ isConfigModalOpen: false, editingService: null });
  },

  scanProjectScripts: async (projectIdOrPath: string) => {
    const { projectPath } = resolveProject(projectIdOrPath);
    return fetchProjectScriptsFromBackend(projectPath || '');
  },

  importDiscoveredScripts: (projectIdOrPath: string, groups: DiscoveredScriptGroup[]) => {
    if (!projectIdOrPath || !groups || groups.length === 0) return [];
    const { projectId, normPath } = resolveProject(projectIdOrPath);
    const currentList = get().getServices(normPath || projectId || projectIdOrPath);
    const createdList = buildImportedServicesFromGroups(currentList, groups);

    if (createdList.length > 0) {
      const updatedList = [...currentList, ...createdList];
      const nextConfigs = applyUpdatedServiceConfigs(
        get().configsByProject,
        normPath,
        projectId,
        projectIdOrPath,
        updatedList
      );
      set((state) => ({
        configsByProject: nextConfigs,
        activeServiceId: state.activeServiceId || updatedList[0].id,
      }));
    }

    return createdList;
  },

  addService: (projectIdOrPath, data) => {
    const { projectId, normPath } = resolveProject(projectIdOrPath);
    const id = `srv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const newService: ServiceConfig = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    const currentList = get().getServices(normPath || projectId || projectIdOrPath);
    const updatedList = [...currentList, newService];
    const nextConfigs = applyUpdatedServiceConfigs(
      get().configsByProject,
      normPath,
      projectId,
      projectIdOrPath,
      updatedList
    );

    set({
      configsByProject: nextConfigs,
      activeServiceId: id,
      isConfigModalOpen: false,
      editingService: null,
    });

    return newService;
  },

  updateService: (projectIdOrPath, serviceId, updates) => {
    const { projectId, normPath } = resolveProject(projectIdOrPath);
    const currentList = get().getServices(normPath || projectId || projectIdOrPath);
    const updatedList = currentList.map((item) =>
      item.id === serviceId ? { ...item, ...updates, updatedAt: Date.now() } : item
    );
    const nextConfigs = applyUpdatedServiceConfigs(
      get().configsByProject,
      normPath,
      projectId,
      projectIdOrPath,
      updatedList
    );

    set({
      configsByProject: nextConfigs,
      isConfigModalOpen: false,
      editingService: null,
    });
  },

  renameService: (projectIdOrPath, serviceId, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    get().updateService(projectIdOrPath, serviceId, { name: trimmed });
  },

  reorderServices: (projectIdOrPath, fromIndex, toIndex) => {
    const { projectId, normPath } = resolveProject(projectIdOrPath);
    const currentList = get().getServices(normPath || projectId || projectIdOrPath);
    if (
      fromIndex < 0 ||
      fromIndex >= currentList.length ||
      toIndex < 0 ||
      toIndex >= currentList.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const reordered = [...currentList];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const nextConfigs = applyUpdatedServiceConfigs(
      get().configsByProject,
      normPath,
      projectId,
      projectIdOrPath,
      reordered
    );
    set({ configsByProject: nextConfigs });
  },

  deleteService: async (projectIdOrPath, serviceId) => {
    const { projectId, normPath } = resolveProject(projectIdOrPath);
    const runtime = get().getRuntime(serviceId);
    if (runtime.status === 'running' || runtime.status === 'starting') {
      await get().stopService(serviceId);
    }

    const currentList = get().getServices(normPath || projectId || projectIdOrPath);
    const updatedList = currentList.filter((item) => item.id !== serviceId);
    const nextConfigs = applyUpdatedServiceConfigs(
      get().configsByProject,
      normPath,
      projectId,
      projectIdOrPath,
      updatedList
    );

    set((state) => {
      const nextActiveId =
        state.activeServiceId === serviceId
          ? updatedList.length > 0
            ? updatedList[0].id
            : null
          : state.activeServiceId;

      const nextRuntime = { ...state.runtimeStates };
      delete nextRuntime[serviceId];

      return {
        configsByProject: nextConfigs,
        activeServiceId: nextActiveId,
        runtimeStates: nextRuntime,
      };
    });
  },

  startService: async (projectIdOrPath, serviceId) => {
    const { projectId: resolvedId, projectPath, normPath } = resolveProject(projectIdOrPath);
    const services = get().getServices(normPath || resolvedId || projectIdOrPath);
    const service = services.find((s) => s.id === serviceId);
    if (!service) return false;

    const isWindows =
      (window as any).electronAPI?.platform === 'win32' ||
      (typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('win'));

    const rawCommand = isWindows ? service.winCommand : service.unixCommand;
    const command = (rawCommand || '').trim();
    if (!command) {
      get().appendLog(
        serviceId,
        `\n[OmniGit Error] 未为当前操作系统 (${isWindows ? 'Windows' : 'macOS/Linux'}) 配置启动命令。\n`
      );
      set((state) => ({
        runtimeStates: {
          ...state.runtimeStates,
          [serviceId]: {
            ...state.getRuntime(serviceId),
            status: 'failed',
            exitCode: 1,
          },
        },
      }));
      return false;
    }

    const projectRoot = projectPath || '';
    const resolvedCwd = resolveServiceCwd(projectRoot, service.cwd, isWindows);

    get().setAutoScroll(serviceId, true);

    set((state) => ({
      runtimeStates: {
        ...state.runtimeStates,
        [serviceId]: {
          ...state.getRuntime(serviceId),
          status: 'starting',
          exitCode: null,
          conflictPort: undefined,
        },
      },
    }));

    const rawStopCommand = isWindows ? service.winStopScript : service.unixStopScript;
    const stopCommand = (rawStopCommand || '').trim();

    get().appendLog(
      serviceId,
      `\x1b[36m>>> [OmniGit] 正在启动服务: ${service.name}\x1b[0m\n` +
        `\x1b[90m> 工作目录: ${resolvedCwd}\x1b[0m\n` +
        `\x1b[90m> 启动命令: ${command}\x1b[0m\n` +
        (stopCommand ? `\x1b[90m> 停止脚本: ${stopCommand}\x1b[0m\n` : '') +
        '\n'
    );

    const startPayload = {
      serviceId,
      serviceName: service.name,
      projectId: resolvedId || normPath || projectIdOrPath,
      command,
      stopCommand: stopCommand || undefined,
      cwd: resolvedCwd,
      env: service.env,
    };

    try {
      const res = await invokeStartServiceBackend(startPayload);

      if (res.success && res.pid) {
        set((state) => {
          const current = state.getRuntime(serviceId);
          // Only drop if user initiated a stop while start was in-flight,
          // or if this was a task that has already completed for THIS EXACT pid.
          if (
            current.status === 'stopping' ||
            (current.status === 'completed' && current.lastExitedPid === res.pid)
          ) {
            return state;
          }
          return {
            runtimeStates: {
              ...state.runtimeStates,
              [serviceId]: {
                ...current,
                status: 'running',
                pid: res.pid,
                startedAt: current.startedAt || Date.now(),
                exitCode: null,
                conflictPort: undefined,
              },
            },
          };
        });
        return true;
      } else {
        get().appendLog(serviceId, `\x1b[31m[OmniGit Error] 启动失败: ${res.error || '未知错误'}\x1b[0m\n`);
        set((state) => ({
          runtimeStates: {
            ...state.runtimeStates,
            [serviceId]: {
              ...state.getRuntime(serviceId),
              status: 'failed',
              exitCode: 1,
            },
          },
        }));
        return false;
      }
    } catch (err: any) {
      get().appendLog(serviceId, `\x1b[31m[OmniGit Error] 启动异常: ${err.message || String(err)}\x1b[0m\n`);
      set((state) => ({
        runtimeStates: {
          ...state.runtimeStates,
          [serviceId]: {
            ...state.getRuntime(serviceId),
            status: 'failed',
            exitCode: 1,
          },
        },
      }));
      return false;
    }
  },

  stopService: async (serviceId: string) => {
    set((state) => ({
      runtimeStates: {
        ...state.runtimeStates,
        [serviceId]: {
          ...state.getRuntime(serviceId),
          status: 'stopping',
        },
      },
    }));

    await invokeStopServiceBackend(serviceId);

    get().appendLog(serviceId, `\n\x1b[33m>>> [OmniGit] 服务已终止停止\x1b[0m\n`);

    set((state) => ({
      runtimeStates: {
        ...state.runtimeStates,
        [serviceId]: {
          ...state.getRuntime(serviceId),
          status: 'stopped',
          pid: undefined,
          startedAt: undefined,
        },
      },
    }));

    return true;
  },

  restartService: async (projectIdOrPath: string, serviceId: string) => {
    get().setAutoScroll(serviceId, true);
    await get().stopService(serviceId);
    await new Promise((r) => setTimeout(r, 200));
    return await get().startService(projectIdOrPath, serviceId);
  },

  killPortAndRestart: async (projectIdOrPath: string, serviceId: string, port: number) => {
    const cleanPort = Number(port);
    if (!cleanPort || cleanPort <= 0) return false;

    get().appendLog(
      serviceId,
      `\n\x1b[36m>>> [OmniGit] 正在扫描并释放占用端口 :${cleanPort} 的冲突进程...\x1b[0m\n`
    );

    try {
      const killRes = await invokeKillPortBackend(cleanPort);
      if (killRes) {
        get().appendLog(serviceId, `\x1b[32m>>> [OmniGit] ${killRes.message}\x1b[0m\n`);
      }
    } catch (err: any) {
      get().appendLog(
        serviceId,
        `\x1b[33m>>> [OmniGit] 释放端口异常: ${err.message || String(err)}\x1b[0m\n`
      );
    }

    await new Promise((r) => setTimeout(r, 250));
    return await get().restartService(projectIdOrPath, serviceId);
  },

  startAllServices: async (projectIdOrPath: string) => {
    const list = get().getServices(projectIdOrPath);
    for (const item of list) {
      get().setAutoScroll(item.id, true);
      const runtime = get().getRuntime(item.id);
      if (runtime.status !== 'running' && runtime.status !== 'starting') {
        if (item.startDelayMs && item.startDelayMs > 0) {
          get().appendLog(
            item.id,
            `\x1b[90m>>> [OmniGit] 编排等待 ${item.startDelayMs}ms 后启动 ${item.name}...\x1b[0m\n`
          );
          await new Promise((r) => setTimeout(r, Math.min(30000, item.startDelayMs)));
        }
        await get().startService(projectIdOrPath, item.id);
      }
    }
  },

  stopAllServices: async (projectIdOrPath: string) => {
    const list = get().getServices(projectIdOrPath);
    const runningItems = list.filter((item) => {
      const r = get().getRuntime(item.id);
      return r.status === 'running' || r.status === 'starting';
    });

    if (runningItems.length === 0) return;

    set((state) => {
      const nextRuntimes = { ...state.runtimeStates };
      for (const item of runningItems) {
        nextRuntimes[item.id] = {
          ...state.getRuntime(item.id),
          status: 'stopping',
        };
      }
      return { runtimeStates: nextRuntimes };
    });

    await Promise.all(runningItems.map((item) => get().stopService(item.id)));
  },

  clearLogs: (serviceId: string) => {
    const pendingTimer = pendingLogFlushTimers.get(serviceId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingLogFlushTimers.delete(serviceId);
    }
    serviceLogBuffers.get(serviceId)?.clear();
    set((state) => ({
      runtimeStates: {
        ...state.runtimeStates,
        [serviceId]: {
          ...state.getRuntime(serviceId),
          logs: [],
        },
      },
    }));
  },

  setAutoScroll: (serviceId: string, enabled: boolean) => {
    set((state) => ({
      autoScrollByService: {
        ...state.autoScrollByService,
        [serviceId]: enabled,
      },
    }));
  },

  toggleAutoScroll: (serviceId: string) => {
    const current = get().autoScrollByService[serviceId] !== false;
    get().setAutoScroll(serviceId, !current);
  },

  hasRunningServices: (projectIdOrPath?: string) => {
    const state = get();
    for (const [id, runtime] of Object.entries(state.runtimeStates)) {
      if (runtime.status === 'running' || runtime.status === 'starting') {
        if (!projectIdOrPath) return true;
        const services = get().getServices(projectIdOrPath);
        if (services.some((s) => s.id === id)) return true;
      }
    }
    return false;
  },

  getRunningCount: (projectIdOrPath?: string) => {
    const state = get();
    let count = 0;
    for (const [id, runtime] of Object.entries(state.runtimeStates)) {
      if (runtime.status === 'running' || runtime.status === 'starting') {
        if (!projectIdOrPath) {
          count++;
        } else {
          const services = get().getServices(projectIdOrPath);
          if (services.some((s) => s.id === id)) count++;
        }
      }
    }
    return count;
  },

  appendLog: (serviceId: string, text: string) => {
    let buffer = serviceLogBuffers.get(serviceId);
    if (!buffer) {
      buffer = new StreamLogBuffer(2000);
      serviceLogBuffers.set(serviceId, buffer);
    }
    buffer.append(text);

    const detectedConflictPort = detectConflictPortFromLog(
      text,
      serviceId,
      get().configsByProject
    );

    const flushNow = () => {
      pendingLogFlushTimers.delete(serviceId);
      lastLogFlushTime.set(serviceId, Date.now());
      const currentBuffer = serviceLogBuffers.get(serviceId);
      const updatedLines = currentBuffer ? currentBuffer.getDisplayLines() : [];
      set((state) => {
        const prevRuntime = state.getRuntime(serviceId);
        return {
          runtimeStates: {
            ...state.runtimeStates,
            [serviceId]: {
              ...prevRuntime,
              conflictPort: detectedConflictPort || prevRuntime.conflictPort,
              logs: updatedLines,
            },
          },
        };
      });
    };

    const now = Date.now();
    const lastFlush = lastLogFlushTime.get(serviceId) || 0;
    if (!pendingLogFlushTimers.has(serviceId)) {
      if (now - lastFlush >= LOG_FLUSH_INTERVAL_MS) {
        flushNow();
      } else {
        const delay = Math.max(8, LOG_FLUSH_INTERVAL_MS - (now - lastFlush));
        pendingLogFlushTimers.set(serviceId, setTimeout(flushNow, delay));
      }
    }
  },

  handleProcessExit: (serviceId: string, exitCode: number, signal?: string, pid?: number) => {
    const prevRuntime = get().getRuntime(serviceId);

    // If the exit event carries a PID, and our current runtime has a DIFFERENT PID that is running or starting,
    // this is a stale exit event from an old process that was stopped/replaced. Safely drop it!
    if (pid && prevRuntime.pid && prevRuntime.pid !== pid) {
      console.warn(
        `[useServicesStore] Dropping stale exit event for service ${serviceId} (event PID: ${pid}, current PID: ${prevRuntime.pid})`
      );
      return;
    }

    const pendingTimer = pendingLogFlushTimers.get(serviceId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingLogFlushTimers.delete(serviceId);
    }
    const { nextStatus, exitMsg, durationMs, isSuccess } = computeProcessExitInfo(
      serviceId,
      exitCode,
      signal,
      prevRuntime,
      get().configsByProject
    );

    let buffer = serviceLogBuffers.get(serviceId);
    if (!buffer) {
      buffer = new StreamLogBuffer(2000);
      serviceLogBuffers.set(serviceId, buffer);
    }
    const finalLogs = buffer.append(exitMsg);
    lastLogFlushTime.set(serviceId, Date.now());

    set((state) => ({
      runtimeStates: {
        ...state.runtimeStates,
        [serviceId]: {
          ...state.getRuntime(serviceId),
          logs: finalLogs,
          status: nextStatus,
          pid: undefined,
          lastExitedPid: pid,
          exitCode,
          durationMs,
          completedAt: isSuccess ? Date.now() : undefined,
        },
      },
    }));
  },
}));

bindServiceEventListeners(useServicesStore);
