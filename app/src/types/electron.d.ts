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

export interface ElectronAPI {
  isElectron: boolean;
  platform?: string;
  getAppVersion: () => Promise<string>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  createNewWindow: (wsId?: string) => Promise<void>;
  checkForUpdates: () => Promise<any>;
  quitAndInstall: () => Promise<void>;
  onUpdateStatus: (callback: (payload: UpdateStatusPayload) => void) => () => void;
  detectGitPath: () => Promise<{ found: boolean; path: string; version?: string }>;
  setCustomGitPath: (customPath: string) => Promise<boolean>;
  selectFolder?: (defaultPath?: string) => Promise<string | null>;
  notifyWorkspaceChanged?: () => Promise<void>;
  onWorkspaceChanged?: (callback: () => void) => () => void;
  terminal?: {
    getShells: () => Promise<Array<{ id: string; name: string; path: string; args?: string[] }>>;
    spawn: (options: {
      id: string;
      shell?: string;
      args?: string[];
      cwd?: string;
      cols?: number;
      rows?: number;
    }) => Promise<{ id: string; shell: string; cwd: string }>;
    write: (id: string, data: string) => Promise<boolean>;
    resize: (id: string, cols: number, rows: number) => Promise<boolean>;
    kill: (id: string) => Promise<boolean>;
    onData: (callback: (payload: { id: string; data: string }) => void) => () => void;
    onExit: (callback: (payload: { id: string; exitCode: number }) => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
