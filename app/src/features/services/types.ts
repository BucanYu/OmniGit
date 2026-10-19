export interface ServiceConfig {
  id: string;
  name: string;
  cwd?: string; // Optional working subdirectory, defaults to project root
  winCommand: string; // Windows startup command / script
  unixCommand: string; // macOS / Linux startup command / script
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
