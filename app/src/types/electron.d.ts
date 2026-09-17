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
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
