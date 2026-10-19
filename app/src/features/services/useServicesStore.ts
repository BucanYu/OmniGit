import { create } from 'zustand';
import type { ServiceConfig, ServiceRuntimeState, DiscoveredScriptGroup } from './types';
import { useAppStore } from '../../store/useAppStore';

interface ServicesState {
  configsByProject: Record<string, ServiceConfig[]>;
  runtimeStates: Record<string, ServiceRuntimeState>;
  activeServiceId: string | null;
  autoScrollByService: Record<string, boolean>;
  isConfigModalOpen: boolean;
  editingService: ServiceConfig | null;

  // Actions
  loadProjectServices: (projectId: string) => ServiceConfig[];
  getServices: (projectId: string) => ServiceConfig[];
  getRuntime: (serviceId: string) => ServiceRuntimeState;
  setActiveServiceId: (serviceId: string | null) => void;
  openAddModal: () => void;
  openEditModal: (service: ServiceConfig) => void;
  closeConfigModal: () => void;

  scanProjectScripts: (projectId: string) => Promise<DiscoveredScriptGroup[]>;
  importDiscoveredScripts: (projectId: string, groups: DiscoveredScriptGroup[]) => ServiceConfig[];

  addService: (
    projectId: string,
    data: Omit<ServiceConfig, 'id' | 'createdAt' | 'updatedAt'>
  ) => ServiceConfig;
  updateService: (
    projectId: string,
    serviceId: string,
    updates: Partial<Omit<ServiceConfig, 'id' | 'createdAt'>>
  ) => void;
  renameService: (projectId: string, serviceId: string, newName: string) => void;
  reorderServices: (projectId: string, fromIndex: number, toIndex: number) => void;
  deleteService: (projectId: string, serviceId: string) => Promise<void>;

  startService: (projectId: string, serviceId: string) => Promise<boolean>;
  stopService: (serviceId: string) => Promise<boolean>;
  restartService: (projectId: string, serviceId: string) => Promise<boolean>;
  startAllServices: (projectId: string) => Promise<void>;
  stopAllServices: (projectId: string) => Promise<void>;

  clearLogs: (serviceId: string) => void;
  setAutoScroll: (serviceId: string, enabled: boolean) => void;
  toggleAutoScroll: (serviceId: string) => void;
  hasRunningServices: (projectId?: string) => boolean;
  getRunningCount: (projectId?: string) => number;
  appendLog: (serviceId: string, text: string) => void;
  handleProcessExit: (serviceId: string, exitCode: number, signal?: string) => void;
}

export class StreamLogBuffer {
  private lines: string[] = [];
  private currentLine: string = '';
  private maxLines: number;

  constructor(maxLines = 2000) {
    this.maxLines = maxLines;
  }

  public append(incoming: string): string[] {
    if (!incoming) return this.getDisplayLines();

    // 1. Strip OSC (Operating System Command) sequences e.g. \x1b]0;Title\x07 or \x1b]...\x1b\
    let sanitized = incoming.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '');
    // 2. Strip standalone BEL characters
    sanitized = sanitized.replace(/\x07/g, '');
    // 3. Handle ANSI erase line sequences (\x1b[2K, \x1b[K, \x1b[0K) by resetting current line
    sanitized = sanitized.replace(/\x1b\[[0-2]?K/g, '\r');
    // 4. Strip non-color ANSI CSI sequences (preserve \x1b[...m for colors)
    sanitized = sanitized.replace(/\x1b\[\??[0-9;]*[A-LN-Za-ln-z]/g, '');

    let i = 0;
    while (i < sanitized.length) {
      const ch = sanitized[i];
      if (ch === '\r') {
        if (sanitized[i + 1] === '\n') {
          // Windows CRLF (\r\n) -> finish current line
          this.lines.push(this.currentLine);
          this.currentLine = '';
          i += 2;
          continue;
        } else {
          // Bare CR (\r) -> carriage return (reset line for in-place progress update)
          this.currentLine = '';
          i++;
          continue;
        }
      } else if (ch === '\n') {
        // Unix LF (\n) -> finish current line
        this.lines.push(this.currentLine);
        this.currentLine = '';
        i++;
        continue;
      } else {
        this.currentLine += ch;
        i++;
      }
    }

    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(this.lines.length - this.maxLines);
    }

    return this.getDisplayLines();
  }

  public getDisplayLines(): string[] {
    if (this.currentLine.length > 0) {
      return [...this.lines, this.currentLine];
    }
    return [...this.lines];
  }

  public clear(): void {
    this.lines = [];
    this.currentLine = '';
  }
}

const serviceLogBuffers = new Map<string, StreamLogBuffer>();

const DEFAULT_RUNTIME_STATE: ServiceRuntimeState = {
  status: 'stopped',
  logs: [],
};

function getStorageKey(projectId: string): string {
  return `omnigit_services_${projectId}`;
}

export const useServicesStore = create<ServicesState>((set, get) => ({
  configsByProject: {},
  runtimeStates: {},
  activeServiceId: null,
  autoScrollByService: {},
  isConfigModalOpen: false,
  editingService: null,

  loadProjectServices: (projectId: string) => {
    if (!projectId) return [];
    const cached = get().configsByProject[projectId];
    if (cached) return cached;

    let loaded: ServiceConfig[] = [];
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(getStorageKey(projectId));
        if (raw) {
          loaded = JSON.parse(raw);
        }
      } catch (err) {
        console.warn('[useServicesStore] Failed to load services from localStorage:', err);
      }
    }

    set((state) => ({
      configsByProject: {
        ...state.configsByProject,
        [projectId]: loaded,
      },
      activeServiceId: state.activeServiceId || (loaded.length > 0 ? loaded[0].id : null),
    }));

    return loaded;
  },

  getServices: (projectId: string) => {
    if (!projectId) return [];
    return get().configsByProject[projectId] || [];
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

  scanProjectScripts: async (projectId: string) => {
    const appProjects = useAppStore.getState().projects;
    const currentProj = appProjects.find((p) => p.id === projectId);
    const projectRoot = currentProj?.path || '';
    if (!projectRoot) return [];

    if ((window as any).electronAPI?.services?.scanScripts) {
      try {
        return await (window as any).electronAPI.services.scanScripts(projectRoot);
      } catch (e) {
        console.warn('Scan scripts failed via Electron IPC:', e);
      }
    }

    try {
      const res = await fetch(`/api/services/scan-scripts?projectPath=${encodeURIComponent(projectRoot)}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('Scan scripts failed via HTTP:', e);
    }
    return [];
  },

  importDiscoveredScripts: (projectId: string, groups: DiscoveredScriptGroup[]) => {
    if (!projectId || !groups || groups.length === 0) return [];
    const currentList = get().getServices(projectId);
    const existingCommands = new Set(
      currentList.map((s) => (s.winCommand || s.unixCommand || '').toLowerCase().trim())
    );

    const createdList: ServiceConfig[] = [];
    const now = Date.now();

    for (const g of groups) {
      const winCmd = (g.winStartScript || g.unixStartScript || '').trim();
      const unixCmd = (g.unixStartScript || g.winStartScript || '').trim();
      if (!winCmd && !unixCmd) continue;

      if (existingCommands.has(winCmd.toLowerCase()) || existingCommands.has(unixCmd.toLowerCase())) {
        continue;
      }

      const id = `srv_${now}_${Math.random().toString(36).substring(2, 7)}`;
      const newService: ServiceConfig = {
        id,
        name: g.name,
        cwd: g.cwd || '',
        winCommand: winCmd,
        winStopScript: g.winStopScript || '',
        unixCommand: unixCmd,
        unixStopScript: g.unixStopScript || '',
        createdAt: now,
        updatedAt: now,
      };
      createdList.push(newService);
      existingCommands.add(winCmd.toLowerCase());
    }

    if (createdList.length > 0) {
      const updatedList = [...currentList, ...createdList];
      if (typeof window !== 'undefined') {
        localStorage.setItem(getStorageKey(projectId), JSON.stringify(updatedList));
      }
      set((state) => ({
        configsByProject: {
          ...state.configsByProject,
          [projectId]: updatedList,
        },
        activeServiceId: state.activeServiceId || updatedList[0].id,
      }));
    }

    return createdList;
  },

  addService: (projectId, data) => {
    const id = `srv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const newService: ServiceConfig = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    const currentList = get().getServices(projectId);
    const updatedList = [...currentList, newService];

    if (typeof window !== 'undefined') {
      localStorage.setItem(getStorageKey(projectId), JSON.stringify(updatedList));
    }

    set((state) => ({
      configsByProject: {
        ...state.configsByProject,
        [projectId]: updatedList,
      },
      activeServiceId: id,
      isConfigModalOpen: false,
      editingService: null,
    }));

    return newService;
  },

  updateService: (projectId, serviceId, updates) => {
    const currentList = get().getServices(projectId);
    const updatedList = currentList.map((item) =>
      item.id === serviceId ? { ...item, ...updates, updatedAt: Date.now() } : item
    );

    if (typeof window !== 'undefined') {
      localStorage.setItem(getStorageKey(projectId), JSON.stringify(updatedList));
    }

    set((state) => ({
      configsByProject: {
        ...state.configsByProject,
        [projectId]: updatedList,
      },
      isConfigModalOpen: false,
      editingService: null,
    }));
  },

  renameService: (projectId, serviceId, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    get().updateService(projectId, serviceId, { name: trimmed });
  },

  reorderServices: (projectId, fromIndex, toIndex) => {
    const currentList = get().getServices(projectId);
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

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(getStorageKey(projectId), JSON.stringify(reordered));
      } catch (e) {
        console.warn('[useServicesStore] Failed to save reordered services to localStorage', e);
      }
    }

    set((state) => ({
      configsByProject: {
        ...state.configsByProject,
        [projectId]: reordered,
      },
    }));
  },

  deleteService: async (projectId, serviceId) => {
    // If currently running, stop it first
    const runtime = get().getRuntime(serviceId);
    if (runtime.status === 'running' || runtime.status === 'starting') {
      await get().stopService(serviceId);
    }

    const currentList = get().getServices(projectId);
    const updatedList = currentList.filter((item) => item.id !== serviceId);

    if (typeof window !== 'undefined') {
      localStorage.setItem(getStorageKey(projectId), JSON.stringify(updatedList));
    }

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
        configsByProject: {
          ...state.configsByProject,
          [projectId]: updatedList,
        },
        activeServiceId: nextActiveId,
        runtimeStates: nextRuntime,
      };
    });
  },

  startService: async (projectId, serviceId) => {
    const services = get().getServices(projectId);
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

    // Determine working directory
    const appProjects = useAppStore.getState().projects;
    const currentProj = appProjects.find((p) => p.id === projectId);
    const projectRoot = currentProj?.path || '';

    let resolvedCwd = projectRoot;
    if (service.cwd && service.cwd.trim()) {
      const customCwd = service.cwd.trim();
      if (
        customCwd.startsWith('/') ||
        customCwd.startsWith('\\') ||
        customCwd.includes(':\\') ||
        customCwd.includes(':/')
      ) {
        resolvedCwd = customCwd;
      } else {
        const sep = isWindows ? '\\' : '/';
        const combined = `${projectRoot}${sep}${customCwd}`;
        const parts = combined.split(/[/\\]+/);
        const resolved: string[] = [];
        for (const part of parts) {
          if (part === '.' || part === '') continue;
          if (part === '..') {
            if (resolved.length > 0) resolved.pop();
          } else {
            resolved.push(part);
          }
        }
        resolvedCwd = isWindows ? resolved.join('\\') : '/' + resolved.join('/');
      }
    }

    // Ensure auto-scroll is enabled by default when starting
    get().setAutoScroll(serviceId, true);

    // Set status to starting
    set((state) => ({
      runtimeStates: {
        ...state.runtimeStates,
        [serviceId]: {
          ...state.getRuntime(serviceId),
          status: 'starting',
          exitCode: null,
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

    if ((window as any).electronAPI?.services?.start) {
      try {
        const res = await (window as any).electronAPI.services.start({
          serviceId,
          serviceName: service.name,
          projectId,
          command,
          stopCommand: stopCommand || undefined,
          cwd: resolvedCwd,
          env: service.env,
        });

        if (res.success && res.pid) {
          set((state) => ({
            runtimeStates: {
              ...state.runtimeStates,
              [serviceId]: {
                ...state.getRuntime(serviceId),
                status: 'running',
                pid: res.pid,
                startedAt: Date.now(),
                exitCode: null,
              },
            },
          }));
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
    } else {
      // Web browser mode via HTTP API
      try {
        const resp = await fetch('/api/services/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceId,
            serviceName: service.name,
            projectId,
            command,
            stopCommand: stopCommand || undefined,
            cwd: resolvedCwd,
            env: service.env,
          }),
        });
        const res = await resp.json();

        if (res.success && res.pid) {
          set((state) => ({
            runtimeStates: {
              ...state.runtimeStates,
              [serviceId]: {
                ...state.getRuntime(serviceId),
                status: 'running',
                pid: res.pid,
                startedAt: Date.now(),
                exitCode: null,
              },
            },
          }));
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
    }
  },

  stopService: async (serviceId: string) => {
    // 1. Immediately set status to 'stopping' to give instant user feedback (< 16ms)
    set((state) => ({
      runtimeStates: {
        ...state.runtimeStates,
        [serviceId]: {
          ...state.getRuntime(serviceId),
          status: 'stopping',
        },
      },
    }));

    if ((window as any).electronAPI?.services?.stop) {
      try {
        await (window as any).electronAPI.services.stop(serviceId);
      } catch (err) {
        console.warn('[useServicesStore] Stop service error:', err);
      }
    } else {
      try {
        await fetch('/api/services/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceId }),
        });
      } catch (err) {
        console.warn('[useServicesStore] Stop service HTTP error:', err);
      }
    }

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

  restartService: async (projectId: string, serviceId: string) => {
    get().setAutoScroll(serviceId, true);
    await get().stopService(serviceId);
    await new Promise((r) => setTimeout(r, 200));
    return await get().startService(projectId, serviceId);
  },

  startAllServices: async (projectId: string) => {
    const list = get().getServices(projectId);
    for (const item of list) {
      get().setAutoScroll(item.id, true);
      const runtime = get().getRuntime(item.id);
      if (runtime.status !== 'running' && runtime.status !== 'starting') {
        await get().startService(projectId, item.id);
      }
    }
  },

  stopAllServices: async (projectId: string) => {
    const list = get().getServices(projectId);
    const runningItems = list.filter((item) => {
      const r = get().getRuntime(item.id);
      return r.status === 'running' || r.status === 'starting';
    });

    if (runningItems.length === 0) return;

    // Immediately mark all as stopping for instant UI feedback
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

  hasRunningServices: (projectId?: string) => {
    const state = get();
    for (const [id, runtime] of Object.entries(state.runtimeStates)) {
      if (runtime.status === 'running' || runtime.status === 'starting') {
        if (!projectId) return true;
        const services = state.configsByProject[projectId] || [];
        if (services.some((s) => s.id === id)) return true;
      }
    }
    return false;
  },

  getRunningCount: (projectId?: string) => {
    const state = get();
    let count = 0;
    for (const [id, runtime] of Object.entries(state.runtimeStates)) {
      if (runtime.status === 'running' || runtime.status === 'starting') {
        if (!projectId) {
          count++;
        } else {
          const services = state.configsByProject[projectId] || [];
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
    const updatedLines = buffer.append(text);

    set((state) => {
      const prevRuntime = state.getRuntime(serviceId);
      return {
        runtimeStates: {
          ...state.runtimeStates,
          [serviceId]: {
            ...prevRuntime,
            logs: updatedLines,
          },
        },
      };
    });
  },

  handleProcessExit: (serviceId: string, exitCode: number, signal?: string) => {
    const prevRuntime = get().getRuntime(serviceId);
    const wasUserStopped = prevRuntime.status === 'stopped';
    const isSuccess = exitCode === 0 || wasUserStopped;
    const exitMsg = wasUserStopped
      ? `\n\x1b[33m>>> [OmniGit] 进程已主动终止关闭\x1b[0m\n`
      : signal
      ? `\n\x1b[33m>>> [OmniGit] 进程收到信号退出: ${signal} (代码: ${exitCode})\x1b[0m\n`
      : isSuccess
      ? `\n\x1b[32m>>> [OmniGit] 进程正常退出 (代码: 0)\x1b[0m\n`
      : `\n\x1b[31m>>> [OmniGit] 进程异常退出 (退出代码: ${exitCode})\x1b[0m\n`;

    get().appendLog(serviceId, exitMsg);

    set((state) => ({
      runtimeStates: {
        ...state.runtimeStates,
        [serviceId]: {
          ...state.getRuntime(serviceId),
          status: isSuccess ? 'stopped' : 'failed',
          pid: undefined,
          exitCode,
        },
      },
    }));
  },
}));

// Setup global event listeners (Electron IPC or Web browser SSE)
if (typeof window !== 'undefined') {
  if ((window as any).electronAPI?.services) {
    const electronAPI = (window as any).electronAPI;

    electronAPI.services.onLog((payload: { serviceId: string; data: string; stream: 'stdout' | 'stderr' }) => {
      useServicesStore.getState().appendLog(payload.serviceId, payload.data);
    });

    electronAPI.services.onExit((payload: { serviceId: string; exitCode: number; signal?: string }) => {
      useServicesStore.getState().handleProcessExit(payload.serviceId, payload.exitCode, payload.signal);
    });

    if (electronAPI.services.getRunning) {
      electronAPI.services
        .getRunning()
        .then((runningList: Array<{ serviceId: string; pid: number; startedAt: number }>) => {
          if (Array.isArray(runningList) && runningList.length > 0) {
            useServicesStore.setState((state) => {
              const nextStates = { ...state.runtimeStates };
              for (const item of runningList) {
                nextStates[item.serviceId] = {
                  ...(nextStates[item.serviceId] || DEFAULT_RUNTIME_STATE),
                  status: 'running',
                  pid: item.pid,
                  startedAt: item.startedAt,
                };
              }
              return { runtimeStates: nextStates };
            });
          }
        })
        .catch(() => {});
    }
  } else {
    // Web browser mode: connect SSE
    let sse: EventSource | null = null;
    const connectSSE = () => {
      try {
        sse = new EventSource('/api/services/stream');
        sse.addEventListener('log', (event) => {
          try {
            const payload = JSON.parse(event.data);
            useServicesStore.getState().appendLog(payload.serviceId, payload.data);
          } catch {}
        });

        sse.addEventListener('exit', (event) => {
          try {
            const payload = JSON.parse(event.data);
            useServicesStore.getState().handleProcessExit(payload.serviceId, payload.exitCode, payload.signal);
          } catch {}
        });

        sse.onerror = () => {
          sse?.close();
          setTimeout(connectSSE, 3000);
        };
      } catch (err) {
        console.warn('[useServicesStore] Failed to connect SSE:', err);
      }
    };
    connectSSE();

    // Query running services from web server
    fetch('/api/services/running')
      .then((res) => res.json())
      .then((runningList: Array<{ serviceId: string; pid: number; startedAt: number }>) => {
        if (Array.isArray(runningList) && runningList.length > 0) {
          useServicesStore.setState((state) => {
            const nextStates = { ...state.runtimeStates };
            for (const item of runningList) {
              nextStates[item.serviceId] = {
                ...(nextStates[item.serviceId] || DEFAULT_RUNTIME_STATE),
                status: 'running',
                pid: item.pid,
                startedAt: item.startedAt,
              };
            }
            return { runtimeStates: nextStates };
          });
        }
      })
      .catch(() => {});
  }
}
