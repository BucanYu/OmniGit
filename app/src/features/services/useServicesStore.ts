import { create } from 'zustand';
import type { ServiceConfig, ServiceRuntimeState, DiscoveredScriptGroup } from './types';
import { useAppStore } from '../../store/useAppStore';
import { normalizePath } from '../../store/storeHelpers';

interface ServicesState {
  configsByProject: Record<string, ServiceConfig[]>;
  runtimeStates: Record<string, ServiceRuntimeState>;
  activeServiceId: string | null;
  autoScrollByService: Record<string, boolean>;
  isConfigModalOpen: boolean;
  editingService: ServiceConfig | null;

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
  startAllServices: (projectIdOrPath: string) => Promise<void>;
  stopAllServices: (projectIdOrPath: string) => Promise<void>;

  clearLogs: (serviceId: string) => void;
  setAutoScroll: (serviceId: string, enabled: boolean) => void;
  toggleAutoScroll: (serviceId: string) => void;
  hasRunningServices: (projectIdOrPath?: string) => boolean;
  getRunningCount: (projectIdOrPath?: string) => number;
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

export function normalizeProjectPath(p: string): string {
  if (!p) return '';
  return normalizePath(p);
}

function getPathStorageKey(normPath: string): string {
  return `omnigit_services_path_${normPath}`;
}

function getLegacyStorageKey(projectId: string): string {
  return `omnigit_services_${projectId}`;
}

// Canonical defaults for known workspace projects to guarantee 0ms instant display without cross-project bleed
const KNOWN_PROJECT_CANONICAL_SERVICES: Record<string, ServiceConfig[]> = {
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
function validateAndSanitizeServices(normPath: string, services: ServiceConfig[]): ServiceConfig[] | null {
  if (!services || !Array.isArray(services) || services.length === 0) return null;

  // 1. If project is land-quality-sys or farmland, it CANNOT contain "文件预览" or start-backend in root cwd
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

  // 2. If project is filepreview, it CANNOT contain cwd: ".." or OmniGit desktop build scripts
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

  // 3. If project is OmniGit, it CANNOT contain "文件预览" or "Backend" with cwd: ".."
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

function resolveProject(projectIdOrPath?: string, explicitPath?: string): {
  projectId: string;
  projectPath: string;
  normPath: string;
} {
  const projects = useAppStore.getState().projects;
  const activeProjectId = useAppStore.getState().activeProjectId;

  // 1. Explicit path given
  if (explicitPath) {
    const norm = normalizeProjectPath(explicitPath);
    const matched = projects.find((p) => normalizeProjectPath(p.path) === norm);
    return {
      projectId: matched?.id || (projectIdOrPath && !projectIdOrPath.includes('/') && !projectIdOrPath.includes('\\') ? projectIdOrPath : ''),
      projectPath: explicitPath,
      normPath: norm,
    };
  }

  // 2. Identify by projectIdOrPath
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

  // 3. Fallback to active project
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

async function persistServicesToDisk(normPath: string, services: ServiceConfig[]): Promise<boolean> {
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

async function fetchDiskBackup(): Promise<Record<string, ServiceConfig[]>> {
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

export const useServicesStore = create<ServicesState>((set, get) => ({
  configsByProject: {},
  runtimeStates: {},
  activeServiceId: null,
  autoScrollByService: {},
  isConfigModalOpen: false,
  editingService: null,

  loadProjectServices: (projectIdOrPath: string, explicitPath?: string) => {
    if (!projectIdOrPath && !explicitPath) return [];

    const { projectId, projectPath, normPath } = resolveProject(projectIdOrPath, explicitPath);
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
            // Contaminated record found in localStorage -> purge it immediately
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

    // If loaded synchronously (from valid path key or canonical definition)
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

      // Dual-write to localStorage for permanent future boots
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(getPathStorageKey(normPath), JSON.stringify(loaded));
          if (projectId) localStorage.setItem(getLegacyStorageKey(projectId), JSON.stringify(loaded));
        } catch {}
      }

      // Persist to disk backup
      persistServicesToDisk(normPath, loaded);

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
        console.info(`[useServicesStore] Successfully recovered services from disk backup for ${normPath}`);
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

    // Set empty in state for now
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
    const projectRoot = projectPath || '';
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

  importDiscoveredScripts: (projectIdOrPath: string, groups: DiscoveredScriptGroup[]) => {
    if (!projectIdOrPath || !groups || groups.length === 0) return [];
    const { projectId, normPath } = resolveProject(projectIdOrPath);
    const currentList = get().getServices(normPath || projectId || projectIdOrPath);
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
      const nextConfigs = { ...get().configsByProject };
      if (normPath) nextConfigs[normPath] = updatedList;
      if (projectId) nextConfigs[projectId] = updatedList;
      if (projectIdOrPath) nextConfigs[projectIdOrPath] = updatedList;

      if (typeof window !== 'undefined') {
        try {
          if (normPath) localStorage.setItem(getPathStorageKey(normPath), JSON.stringify(updatedList));
          if (projectId) localStorage.setItem(getLegacyStorageKey(projectId), JSON.stringify(updatedList));
        } catch {}
      }
      if (normPath) {
        persistServicesToDisk(normPath, updatedList);
      }

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

    const nextConfigs = { ...get().configsByProject };
    if (normPath) nextConfigs[normPath] = updatedList;
    if (projectId) nextConfigs[projectId] = updatedList;
    if (projectIdOrPath) nextConfigs[projectIdOrPath] = updatedList;

    if (typeof window !== 'undefined') {
      try {
        if (normPath) localStorage.setItem(getPathStorageKey(normPath), JSON.stringify(updatedList));
        if (projectId) localStorage.setItem(getLegacyStorageKey(projectId), JSON.stringify(updatedList));
      } catch {}
    }
    if (normPath) {
      persistServicesToDisk(normPath, updatedList);
    }

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

    const nextConfigs = { ...get().configsByProject };
    if (normPath) nextConfigs[normPath] = updatedList;
    if (projectId) nextConfigs[projectId] = updatedList;
    if (projectIdOrPath) nextConfigs[projectIdOrPath] = updatedList;

    if (typeof window !== 'undefined') {
      try {
        if (normPath) localStorage.setItem(getPathStorageKey(normPath), JSON.stringify(updatedList));
        if (projectId) localStorage.setItem(getLegacyStorageKey(projectId), JSON.stringify(updatedList));
      } catch {}
    }
    if (normPath) {
      persistServicesToDisk(normPath, updatedList);
    }

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

    const nextConfigs = { ...get().configsByProject };
    if (normPath) nextConfigs[normPath] = reordered;
    if (projectId) nextConfigs[projectId] = reordered;
    if (projectIdOrPath) nextConfigs[projectIdOrPath] = reordered;

    if (typeof window !== 'undefined') {
      try {
        if (normPath) localStorage.setItem(getPathStorageKey(normPath), JSON.stringify(reordered));
        if (projectId) localStorage.setItem(getLegacyStorageKey(projectId), JSON.stringify(reordered));
      } catch (e) {
        console.warn('[useServicesStore] Failed to save reordered services to localStorage', e);
      }
    }
    if (normPath) {
      persistServicesToDisk(normPath, reordered);
    }

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

    const nextConfigs = { ...get().configsByProject };
    if (normPath) nextConfigs[normPath] = updatedList;
    if (projectId) nextConfigs[projectId] = updatedList;
    if (projectIdOrPath) nextConfigs[projectIdOrPath] = updatedList;

    if (typeof window !== 'undefined') {
      try {
        if (normPath) localStorage.setItem(getPathStorageKey(normPath), JSON.stringify(updatedList));
        if (projectId) localStorage.setItem(getLegacyStorageKey(projectId), JSON.stringify(updatedList));
      } catch {}
    }
    if (normPath) {
      persistServicesToDisk(normPath, updatedList);
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

    // Determine working directory
    const projectRoot = projectPath || '';
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
          projectId: resolvedId || normPath || projectIdOrPath,
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
            projectId: resolvedId || normPath || projectIdOrPath,
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

  restartService: async (projectIdOrPath: string, serviceId: string) => {
    get().setAutoScroll(serviceId, true);
    await get().stopService(serviceId);
    await new Promise((r) => setTimeout(r, 200));
    return await get().startService(projectIdOrPath, serviceId);
  },

  startAllServices: async (projectIdOrPath: string) => {
    const list = get().getServices(projectIdOrPath);
    for (const item of list) {
      get().setAutoScroll(item.id, true);
      const runtime = get().getRuntime(item.id);
      if (runtime.status !== 'running' && runtime.status !== 'starting') {
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
