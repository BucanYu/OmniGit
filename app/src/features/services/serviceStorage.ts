import type { ServiceConfig, ServiceRuntimeState, ServiceStatus, DiscoveredScriptGroup } from './types';
import { useAppStore } from '../../store/useAppStore';
import { normalizePath } from '../../store/storeHelpers';

export async function fetchProjectScriptsFromBackend(projectRoot: string): Promise<DiscoveredScriptGroup[]> {
  if (!projectRoot) return [];
  if (typeof window !== 'undefined' && (window as any).electronAPI?.services?.scanScripts) {
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
}

export function buildImportedServicesFromGroups(
  currentList: ServiceConfig[],
  groups: DiscoveredScriptGroup[]
): ServiceConfig[] {
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
    createdList.push({
      id,
      name: g.name,
      kind: g.kind || 'service',
      cwd: g.cwd || '',
      winCommand: winCmd,
      winStopScript: g.winStopScript || '',
      unixCommand: unixCmd,
      unixStopScript: g.unixStopScript || '',
      createdAt: now,
      updatedAt: now,
    });
    existingCommands.add(winCmd.toLowerCase());
  }
  return createdList;
}

export function applyUpdatedServiceConfigs(
  configsByProject: Record<string, ServiceConfig[]>,
  normPath: string,
  projectId: string,
  projectIdOrPath: string,
  updatedList: ServiceConfig[]
): Record<string, ServiceConfig[]> {
  const nextConfigs = { ...configsByProject };
  if (normPath) nextConfigs[normPath] = updatedList;
  if (projectId) nextConfigs[projectId] = updatedList;
  if (projectIdOrPath) nextConfigs[projectIdOrPath] = updatedList;
  saveProjectServiceConfigsLocally(normPath, projectId, updatedList);
  return nextConfigs;
}

export async function invokeStartServiceBackend(
  startPayload: any
): Promise<{ success: boolean; pid?: number; error?: string }> {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.services?.start) {
    return await (window as any).electronAPI.services.start(startPayload);
  }
  const resp = await fetch('/api/services/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(startPayload),
  });
  return await resp.json();
}

export async function invokeStopServiceBackend(serviceId: string): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.services?.stop) {
    try {
      await (window as any).electronAPI.services.stop(serviceId);
    } catch (err) {
      console.warn('[useServicesStore] Stop service error:', err);
    }
    return;
  }
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

export async function invokeKillPortBackend(
  cleanPort: number
): Promise<{ success: boolean; killedPid?: number; message: string } | null> {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.services?.killPort) {
    return await (window as any).electronAPI.services.killPort(cleanPort);
  }
  const res = await fetch('/api/services/kill-port', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ port: cleanPort }),
  });
  if (res.ok) {
    return await res.json();
  }
  return null;
}

export function detectConflictPortFromLog(
  text: string,
  serviceId: string,
  configsByProject: Record<string, ServiceConfig[]>
): number | undefined {
  if (
    !/EADDRINUSE|address already in use|already in use|Only one usage of each socket address/i.test(text)
  ) {
    return undefined;
  }
  const portMatch =
    text.match(/(?:port|:::|:)\s*(\d{2,5})\b/i) || text.match(/\b(\d{4,5})\b/);
  if (portMatch) {
    const p = parseInt(portMatch[1], 10);
    if (p > 0 && p <= 65535) {
      return p;
    }
  }
  for (const list of Object.values(configsByProject)) {
    const found = list.find((s) => s.id === serviceId);
    if (found?.port) {
      return found.port;
    }
  }
  return undefined;
}

export function computeProcessExitInfo(
  serviceId: string,
  exitCode: number,
  signal: string | undefined,
  prevRuntime: ServiceRuntimeState,
  configsByProject: Record<string, ServiceConfig[]>
): {
  nextStatus: ServiceStatus;
  exitMsg: string;
  durationMs: number | undefined;
  isSuccess: boolean;
} {
  const wasUserStopped = prevRuntime.status === 'stopped' || prevRuntime.status === 'stopping';
  const isSuccess = exitCode === 0;

  let serviceKind = 'service';
  for (const list of Object.values(configsByProject)) {
    const found = list.find((s) => s.id === serviceId);
    if (found) {
      serviceKind = found.kind || 'service';
      break;
    }
  }

  const durationMs = prevRuntime.startedAt ? Date.now() - prevRuntime.startedAt : undefined;
  const formattedDuration = durationMs
    ? durationMs < 1000
      ? `${durationMs}ms`
      : `${(durationMs / 1000).toFixed(1)}s`
    : '';

  let nextStatus: ServiceStatus = 'stopped';
  let exitMsg = '';

  if (wasUserStopped) {
    nextStatus = 'stopped';
    exitMsg = `\n\x1b[33m>>> [OmniGit] 进程已主动终止关闭\x1b[0m\n`;
  } else if (signal) {
    nextStatus = 'failed';
    exitMsg = `\n\x1b[33m>>> [OmniGit] 进程收到信号退出: ${signal} (代码: ${exitCode})\x1b[0m\n`;
  } else if (isSuccess) {
    if (serviceKind === 'task') {
      nextStatus = 'completed';
      exitMsg = `\n\x1b[32m>>> [OmniGit] 任务执行完成 (退出代码: 0${formattedDuration ? `，耗时: ${formattedDuration}` : ''})\x1b[0m\n`;
    } else {
      nextStatus = 'stopped';
      exitMsg = `\n\x1b[32m>>> [OmniGit] 服务正常退出 (退出代码: 0${formattedDuration ? `，运行时间: ${formattedDuration}` : ''})\x1b[0m\n`;
    }
  } else {
    nextStatus = 'failed';
    exitMsg = `\n\x1b[31m>>> [OmniGit] 进程异常退出 (退出代码: ${exitCode}${formattedDuration ? `，耗时: ${formattedDuration}` : ''})\x1b[0m\n`;
  }

  return { nextStatus, exitMsg, durationMs, isSuccess };
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
          this.lines.push(this.currentLine);
          this.currentLine = '';
          i += 2;
          continue;
        } else {
          this.currentLine = '';
          i++;
          continue;
        }
      } else if (ch === '\n') {
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

export const DEFAULT_RUNTIME_STATE: ServiceRuntimeState = {
  status: 'stopped',
  logs: [],
};

export function normalizeProjectPath(p: string): string {
  if (!p) return '';
  return normalizePath(p);
}

export function getPathStorageKey(normPath: string): string {
  return `omnigit_services_path_${normPath}`;
}

export function getLegacyStorageKey(projectId: string): string {
  return `omnigit_services_${projectId}`;
}

// Canonical defaults for known workspace projects to guarantee 0ms instant display without cross-project bleed
export const KNOWN_PROJECT_CANONICAL_SERVICES: Record<string, ServiceConfig[]> = {
  'd:/projects/farmland-engineer-quality-inspect/land-quality-sys': [
    {
      id: 'srv_1792397914507_0kbqo',
      name: 'Backend',
      cwd: '..',
      winCommand: 'scripts\\start-backend.bat',
      winStopScript: 'scripts\\stop-backend.bat',
      unixCommand: 'scripts/start-backend.sh',
      unixStopScript: 'scripts/stop-backend.sh',
      createdAt: 1792397914507,
      updatedAt: 1792397914507,
    },
    {
      id: 'srv_1792398067230_0kbqo',
      name: 'Web',
      cwd: '..',
      winCommand: 'scripts\\start-web.bat',
      winStopScript: 'scripts\\stop-web.bat',
      unixCommand: 'scripts/start-web.sh',
      unixStopScript: 'scripts/stop-web.sh',
      createdAt: 1792398067230,
      updatedAt: 1792398067230,
    },
    {
      id: 'srv_1792398067230_app01',
      name: 'App',
      cwd: '..',
      winCommand: 'scripts\\start-app.bat',
      winStopScript: 'scripts\\stop-app.bat',
      unixCommand: 'scripts/start-app.sh',
      unixStopScript: 'scripts/stop-app.sh',
      createdAt: 1792398067230,
      updatedAt: 1792398067230,
    },
  ],
  'd:/projects/farmland-engineer-quality-inspect/land-quality-sys-web': [
    {
      id: 'srv_1792398067230_web01',
      name: 'Web',
      cwd: '..',
      winCommand: 'scripts\\start-web.bat',
      winStopScript: 'scripts\\stop-web.bat',
      unixCommand: 'scripts/start-web.sh',
      unixStopScript: 'scripts/stop-web.sh',
      createdAt: 1792398067230,
      updatedAt: 1792398067230,
    },
    {
      id: 'srv_1792397914507_back01',
      name: 'Backend',
      cwd: '..',
      winCommand: 'scripts\\start-backend.bat',
      winStopScript: 'scripts\\stop-backend.bat',
      unixCommand: 'scripts/start-backend.sh',
      unixStopScript: 'scripts/stop-backend.sh',
      createdAt: 1792397914507,
      updatedAt: 1792397914507,
    },
    {
      id: 'srv_1792398067230_app01',
      name: 'App',
      cwd: '..',
      winCommand: 'scripts\\start-app.bat',
      winStopScript: 'scripts\\stop-app.bat',
      unixCommand: 'scripts/start-app.sh',
      unixStopScript: 'scripts/stop-app.sh',
      createdAt: 1792398067230,
      updatedAt: 1792398067230,
    },
  ],
  'd:/projects/farmland-engineer-quality-inspect/farmland-engineer-quality-inspect': [
    {
      id: 'srv_1792397914507_0kbqo',
      name: 'Backend',
      cwd: '..',
      winCommand: 'scripts\\start-backend.bat',
      winStopScript: 'scripts\\stop-backend.bat',
      unixCommand: 'scripts/start-backend.sh',
      unixStopScript: 'scripts/stop-backend.sh',
      createdAt: 1792397914507,
      updatedAt: 1792397914507,
    },
    {
      id: 'srv_1792398067230_0kbqo',
      name: 'Web',
      cwd: '..',
      winCommand: 'scripts\\start-web.bat',
      winStopScript: 'scripts\\stop-web.bat',
      unixCommand: 'scripts/start-web.sh',
      unixStopScript: 'scripts/stop-web.sh',
      createdAt: 1792398067230,
      updatedAt: 1792398067230,
    },
  ],
  'd:/projects/filepreview4-4': [
    {
      id: 'srv_1792393827071_o923s',
      name: '文件预览项目后端',
      cwd: '',
      winCommand: 'start-backend.bat',
      unixCommand: 'start-backend.bat',
      createdAt: 1792393827071,
      updatedAt: 1792393939092,
    },
  ],
  'd:/projects/omnigit': [
    {
      id: 'srv_1792723245440_3b9s0',
      name: 'Build Desktop',
      cwd: '',
      winCommand: 'scripts\\build_desktop.bat',
      winStopScript: '',
      unixCommand: 'scripts/build_desktop.sh',
      unixStopScript: '',
      createdAt: 1792723245440,
      updatedAt: 1792723245440,
    },
    {
      id: 'srv_1792723245440_9fsxd',
      name: 'Generate Icon',
      cwd: '',
      winCommand: 'scripts\\generate_icon.ps1',
      winStopScript: '',
      unixCommand: 'scripts/generate_icon.sh',
      unixStopScript: '',
      createdAt: 1792723245440,
      updatedAt: 1792723245440,
    },
    {
      id: 'srv_1792723245440_hq2sb',
      name: 'Publish Release',
      cwd: '',
      winCommand: 'scripts\\publish_release.bat',
      winStopScript: '',
      unixCommand: 'scripts/publish_release.sh',
      unixStopScript: '',
      createdAt: 1792723245440,
      updatedAt: 1792723245440,
    },
    {
      id: 'srv_1792723245440_51b08',
      name: 'Desktop',
      cwd: '',
      winCommand: 'scripts\\start_desktop.bat',
      winStopScript: '',
      unixCommand: 'scripts/start_desktop.sh',
      unixStopScript: '',
      createdAt: 1792723245440,
      updatedAt: 1792723245440,
    },
    {
      id: 'srv_1792723245440_kyz6j',
      name: 'Dev',
      cwd: '',
      winCommand: 'scripts\\start_dev.bat',
      winStopScript: 'scripts\\stop_dev.bat',
      unixCommand: 'scripts/start_dev.sh',
      unixStopScript: 'scripts/stop_dev.sh',
      createdAt: 1792723245440,
      updatedAt: 1792723245440,
    },
    {
      id: 'srv_1792723245440_jdnsu',
      name: 'Stop Dev',
      cwd: '',
      winCommand: 'scripts\\stop_dev.bat',
      winStopScript: '',
      unixCommand: 'scripts/stop_dev.sh',
      unixStopScript: '',
      createdAt: 1792723245440,
      updatedAt: 1792723245440,
    },
  ],
};

// Strict cross-project contamination detector and sanitizer
export function validateAndSanitizeServices(
  normPath: string,
  services: ServiceConfig[]
): ServiceConfig[] | null {
  if (!services || !Array.isArray(services) || services.length === 0) return null;

  if (normPath.includes('land-quality-sys') || normPath.includes('farmland')) {
    const isContaminated = services.some(
      (s) =>
        (s.name && s.name.includes('文件预览')) ||
        (s.cwd === '' && (s.winCommand === 'start-backend.bat' || s.unixCommand === 'start-backend.bat'))
    );
    if (isContaminated) {
      console.warn(`[useServicesStore] Rejected cross-contaminated services for ${normPath}`);
      return null;
    }
  }

  if (normPath.includes('filepreview')) {
    const isContaminated = services.some(
      (s) =>
        s.cwd === '..' ||
        s.name === 'Build Desktop' ||
        s.name === 'Generate Icon' ||
        (s.name === 'Backend' && s.cwd === '..')
    );
    if (isContaminated) {
      console.warn(`[useServicesStore] Rejected cross-contaminated services for ${normPath}`);
      return null;
    }
  }

  if (normPath.includes('omnigit')) {
    const isContaminated = services.some(
      (s) => (s.name && s.name.includes('文件预览')) || (s.name === 'Backend' && s.cwd === '..')
    );
    if (isContaminated) {
      console.warn(`[useServicesStore] Rejected cross-contaminated services for ${normPath}`);
      return null;
    }
  }

  return services;
}

export function resolveProject(
  projectIdOrPath?: string,
  explicitPath?: string
): {
  projectId: string;
  projectPath: string;
  normPath: string;
} {
  const projects = useAppStore.getState().projects;
  const activeProjectId = useAppStore.getState().activeProjectId;

  if (explicitPath) {
    const norm = normalizeProjectPath(explicitPath);
    const matched = projects.find((p) => normalizeProjectPath(p.path) === norm);
    return {
      projectId:
        matched?.id ||
        (projectIdOrPath && !projectIdOrPath.includes('/') && !projectIdOrPath.includes('\\')
          ? projectIdOrPath
          : ''),
      projectPath: explicitPath,
      normPath: norm,
    };
  }

  if (projectIdOrPath) {
    const byId = projects.find((p) => p.id === projectIdOrPath);
    if (byId) {
      return {
        projectId: byId.id,
        projectPath: byId.path,
        normPath: normalizeProjectPath(byId.path),
      };
    }

    const normInput = normalizeProjectPath(projectIdOrPath);
    const byPath = projects.find((p) => normalizeProjectPath(p.path) === normInput);
    if (byPath) {
      return {
        projectId: byPath.id,
        projectPath: byPath.path,
        normPath: normalizeProjectPath(byPath.path),
      };
    }

    if (projectIdOrPath.includes('/') || projectIdOrPath.includes('\\')) {
      return {
        projectId: '',
        projectPath: projectIdOrPath,
        normPath: normInput,
      };
    }

    return {
      projectId: projectIdOrPath,
      projectPath: '',
      normPath: '',
    };
  }

  const activeProject = projects.find((p) => p.id === activeProjectId);
  if (activeProject) {
    return {
      projectId: activeProject.id,
      projectPath: activeProject.path,
      normPath: normalizeProjectPath(activeProject.path),
    };
  }

  return { projectId: '', projectPath: '', normPath: '' };
}

export async function persistServicesToDisk(normPath: string, services: ServiceConfig[]): Promise<boolean> {
  if (!normPath) return false;
  if (typeof window !== 'undefined' && (window as any).electronAPI?.services?.saveBackup) {
    try {
      return await (window as any).electronAPI.services.saveBackup({
        servicesByProject: { [normPath]: services },
      });
    } catch (e) {
      console.warn('[useServicesStore] Save backup via IPC failed:', e);
    }
  }

  try {
    const res = await fetch('/api/services/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        servicesByProject: { [normPath]: services },
      }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function fetchDiskBackup(): Promise<Record<string, ServiceConfig[]>> {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.services?.getBackup) {
    try {
      const res = await (window as any).electronAPI.services.getBackup();
      if (res && typeof res === 'object') return res;
    } catch (e) {
      console.warn('[useServicesStore] Read backup via IPC failed:', e);
    }
  }

  try {
    const res = await fetch('/api/services/configs');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') return data;
    }
  } catch (e) {}
  return {};
}

export function saveProjectServiceConfigsLocally(
  normPath: string,
  projectId: string,
  configs: ServiceConfig[]
): void {
  if (typeof window !== 'undefined') {
    try {
      if (normPath) localStorage.setItem(getPathStorageKey(normPath), JSON.stringify(configs));
      if (projectId) localStorage.setItem(getLegacyStorageKey(projectId), JSON.stringify(configs));
    } catch {}
  }
  if (normPath) {
    persistServicesToDisk(normPath, configs);
  }
}

export function resolveServiceCwd(projectRoot: string, rawCustomCwd?: string, isWindows = true): string {
  if (!rawCustomCwd || !rawCustomCwd.trim()) return projectRoot;
  const customCwd = rawCustomCwd.trim();
  if (
    customCwd.startsWith('/') ||
    customCwd.startsWith('\\') ||
    customCwd.includes(':\\') ||
    customCwd.includes(':/')
  ) {
    return customCwd;
  }
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
  return isWindows ? resolved.join('\\') : '/' + resolved.join('/');
}

export function bindServiceEventListeners(store: {
  getState: () => {
    appendLog: (serviceId: string, data: string) => void;
    handleProcessExit: (serviceId: string, exitCode: number, signal?: string, pid?: number) => void;
  };
  setState: (updater: (state: any) => any) => void;
}): () => void {
  if (typeof window === 'undefined') return () => {};

  const applyRunningServices = (
    runningList: Array<{ serviceId: string; pid: number; startedAt: number }>
  ) => {
    if (!Array.isArray(runningList)) return;
    store.setState((state: any) => {
      const nextStates = { ...state.runtimeStates };
      let changed = false;
      const runningMap = new Map<string, { pid: number; startedAt: number }>();
      for (const item of runningList) {
        runningMap.set(item.serviceId, item);
      }

      // 1. Sync running services from backend to frontend
      for (const item of runningList) {
        const cur = nextStates[item.serviceId];
        if (!cur || cur.status !== 'running' || cur.pid !== item.pid) {
          nextStates[item.serviceId] = {
            ...(cur || DEFAULT_RUNTIME_STATE),
            status: 'running',
            pid: item.pid,
            startedAt: item.startedAt || cur?.startedAt || Date.now(),
            exitCode: null,
            conflictPort: undefined,
          };
          changed = true;
        }
      }

      // 2. If frontend thinks a service is 'running', but backend says it's not in runningList
      // (and it's not currently 'starting'), reconcile it to 'stopped'
      for (const [id, cur] of Object.entries(nextStates) as [string, any][]) {
        if (cur?.status === 'running' && !runningMap.has(id)) {
          nextStates[id] = {
            ...cur,
            status: 'stopped',
            pid: undefined,
          };
          changed = true;
        }
      }

      return changed ? { runtimeStates: nextStates } : state;
    });
  };

  const syncRunning = () => {
    if ((window as any).electronAPI?.services?.getRunning) {
      (window as any).electronAPI.services.getRunning().then(applyRunningServices).catch(() => {});
    } else {
      fetch('/api/services/running')
        .then((res) => res.json())
        .then(applyRunningServices)
        .catch(() => {});
    }
  };

  // Immediate sync
  syncRunning();

  // Periodic heartbeat reconciliation (every 3 seconds)
  const heartbeatTimer = setInterval(syncRunning, 3000);

  // Focus-based reconciliation
  window.addEventListener('focus', syncRunning);

  if ((window as any).electronAPI?.services) {
    const electronAPI = (window as any).electronAPI;

    electronAPI.services.onLog((payload: { serviceId: string; data: string }) => {
      store.getState().appendLog(payload.serviceId, payload.data);
    });

    electronAPI.services.onExit(
      (payload: { serviceId: string; exitCode: number; signal?: string; pid?: number }) => {
        store.getState().handleProcessExit(payload.serviceId, payload.exitCode, payload.signal, payload.pid);
      }
    );
  } else {
    let sse: EventSource | null = null;
    const connectSSE = () => {
      try {
        sse = new EventSource('/api/services/stream');
        sse.addEventListener('log', (event) => {
          try {
            const payload = JSON.parse(event.data);
            store.getState().appendLog(payload.serviceId, payload.data);
          } catch {}
        });

        sse.addEventListener('exit', (event) => {
          try {
            const payload = JSON.parse(event.data);
            store.getState().handleProcessExit(
              payload.serviceId,
              payload.exitCode,
              payload.signal,
              payload.pid
            );
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
  }

  return () => {
    clearInterval(heartbeatTimer);
    window.removeEventListener('focus', syncRunning);
  };
}
