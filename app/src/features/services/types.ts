export interface ServiceConfig {
  id: string;
  name: string;
  cwd?: string; // Optional working subdirectory, defaults to project root
  winCommand: string; // Windows startup script path (e.g., scripts/start-backend.bat) or command
  winStopScript?: string; // Optional Windows stop script path (e.g., scripts/stop-backend.bat)
  unixCommand: string; // macOS / Linux startup script path (e.g., scripts/start-backend.sh) or command
  unixStopScript?: string; // Optional macOS / Linux stop script path (e.g., scripts/stop-backend.sh)
  env?: Record<string, string>; // Custom environment variables
  createdAt: number;
  updatedAt: number;
}

export type ServiceStatus = 'stopped' | 'starting' | 'running' | 'failed';

export interface ServiceRuntimeState {
  status: ServiceStatus;
  pid?: number;
  startedAt?: number;
  exitCode?: number | null;
  logs: string[]; // Circular buffer of log lines
}

export interface DiscoveredScriptGroup {
  id: string;
  name: string;
  winStartScript?: string;
  winStopScript?: string;
  unixStartScript?: string;
  unixStopScript?: string;
  cwd?: string;
}

export type ServicePresetKey =
  | 'custom'
  | 'nodeDev'
  | 'springMaven'
  | 'springGradle'
  | 'pythonWeb'
  | 'goRun'
  | 'dockerCompose';

export interface ServicePresetTemplate {
  key: ServicePresetKey;
  defaultName: string;
  winCommand: string;
  unixCommand: string;
  cwdPlaceholder?: string;
}
