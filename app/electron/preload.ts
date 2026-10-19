import { contextBridge, ipcRenderer } from 'electron';

export interface UpdateStatusPayload {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  info?: any;
  progress?: {
    percent: number;
    bytesPerSecond: number;
    transferred: number;
    total: number;
  };
  error?: string;
}

const electronAPI = {
  isElectron: true,
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke('app:version') as Promise<string>,

  // Native window control
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>,
  createNewWindow: (wsId?: string) => ipcRenderer.invoke('window:create-new', wsId),

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  quitAndInstall: () => ipcRenderer.invoke('update:quit-and-install'),
  onUpdateStatus: (callback: (payload: UpdateStatusPayload) => void) => {
    const handler = (_event: any, payload: UpdateStatusPayload) => callback(payload);
    ipcRenderer.on('update:status', handler);
    return () => {
      ipcRenderer.removeListener('update:status', handler);
    };
  },

  // Native Git detector
  detectGitPath: () => ipcRenderer.invoke('git:detect-path') as Promise<{ found: boolean; path: string; version?: string }>,
  setCustomGitPath: (customPath: string) => ipcRenderer.invoke('git:set-custom-path', customPath) as Promise<boolean>,

  // Native folder & file picker dialogs
  selectFolder: (defaultPath?: string) => ipcRenderer.invoke('dialog:select-folder', defaultPath) as Promise<string | null>,
  selectFile: (options?: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) =>
    ipcRenderer.invoke('dialog:select-file', options) as Promise<string | null>,

  // Cross-window workspace synchronization
  notifyWorkspaceChanged: () => ipcRenderer.invoke('workspace:notify-changed') as Promise<void>,
  onWorkspaceChanged: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('workspace:changed', handler);
    return () => {
      ipcRenderer.removeListener('workspace:changed', handler);
    };
  },

  // Integrated Terminal (PTY)
  terminal: {
    getShells: () =>
      ipcRenderer.invoke('terminal:get-shells') as Promise<
        Array<{ id: string; name: string; path: string; args?: string[] }>
      >,
    spawn: (options: { id: string; shell?: string; args?: string[]; cwd?: string; cols?: number; rows?: number }) =>
      ipcRenderer.invoke('terminal:spawn', options) as Promise<{ id: string; shell: string; cwd: string }>,
    write: (id: string, data: string) =>
      ipcRenderer.invoke('terminal:write', id, data) as Promise<boolean>,
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:resize', id, cols, rows) as Promise<boolean>,
    kill: (id: string) =>
      ipcRenderer.invoke('terminal:kill', id) as Promise<boolean>,
    onData: (callback: (payload: { id: string; data: string }) => void) => {
      const handler = (_event: any, payload: { id: string; data: string }) => callback(payload);
      ipcRenderer.on('terminal:data', handler);
      return () => {
        ipcRenderer.removeListener('terminal:data', handler);
      };
    },
    onExit: (callback: (payload: { id: string; exitCode: number }) => void) => {
      const handler = (_event: any, payload: { id: string; exitCode: number }) => callback(payload);
      ipcRenderer.on('terminal:exit', handler);
      return () => {
        ipcRenderer.removeListener('terminal:exit', handler);
      };
    },
  },

  // Launch Scripts & Background Services Management
  services: {
    start: (config: {
      serviceId: string;
      serviceName: string;
      projectId: string;
      command: string;
      stopCommand?: string;
      cwd: string;
      env?: Record<string, string>;
    }) =>
      ipcRenderer.invoke('services:start', config) as Promise<{ success: boolean; pid?: number; error?: string }>,
    stop: (serviceId: string) =>
      ipcRenderer.invoke('services:stop', serviceId) as Promise<{ success: boolean }>,
    stopAll: (projectId?: string) =>
      ipcRenderer.invoke('services:stop-all', projectId) as Promise<{ success: boolean; count: number }>,
    getRunning: (projectId?: string) =>
      ipcRenderer.invoke('services:get-running', projectId) as Promise<
        Array<{ serviceId: string; pid: number; startedAt: number }>
      >,
    checkOrphans: () =>
      ipcRenderer.invoke('services:check-orphans') as Promise<{
        cleanedCount: number;
        records: Array<{ serviceId: string; serviceName: string; pid: number }>;
      }>,
    scanScripts: (projectPath: string) =>
      ipcRenderer.invoke('services:scan-scripts', projectPath) as Promise<
        Array<{
          id: string;
          name: string;
          winStartScript?: string;
          winStopScript?: string;
          unixStartScript?: string;
          unixStopScript?: string;
          cwd?: string;
        }>
      >,
    onLog: (callback: (payload: { serviceId: string; data: string; stream: 'stdout' | 'stderr' }) => void) => {
      const handler = (_event: any, payload: { serviceId: string; data: string; stream: 'stdout' | 'stderr' }) =>
        callback(payload);
      ipcRenderer.on('services:log', handler);
      return () => {
        ipcRenderer.removeListener('services:log', handler);
      };
    },
    onExit: (callback: (payload: { serviceId: string; exitCode: number; signal?: string }) => void) => {
      const handler = (_event: any, payload: { serviceId: string; exitCode: number; signal?: string }) =>
        callback(payload);
      ipcRenderer.on('services:exit', handler);
      return () => {
        ipcRenderer.removeListener('services:exit', handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
