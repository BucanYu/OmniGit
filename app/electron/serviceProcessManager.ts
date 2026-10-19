import * as path from 'path';
import * as fs from 'fs';
import { spawn, execSync, ChildProcess } from 'child_process';
import { app, BrowserWindow, ipcMain } from 'electron';

export interface ServiceRunConfig {
  serviceId: string;
  serviceName: string;
  projectId: string;
  command: string;
  cwd: string;
  env?: Record<string, string>;
}

export interface ActiveProcessRecord {
  serviceId: string;
  serviceName: string;
  projectId: string;
  pid: number;
  command: string;
  startedAt: number;
}

interface RunningServiceEntry {
  serviceId: string;
  serviceName: string;
  projectId: string;
  pid: number;
  command: string;
  startedAt: number;
  child: ChildProcess;
}

class ServiceProcessManager {
  private activeServices = new Map<string, RunningServiceEntry>();
  private lockFilePath: string = '';

  constructor() {
    try {
      this.lockFilePath = path.join(app.getPath('userData'), 'active_service_pids.json');
    } catch {
      // In non-ready state or testing
    }
  }

  private getLockFilePath(): string {
    if (!this.lockFilePath) {
      this.lockFilePath = path.join(app.getPath('userData'), 'active_service_pids.json');
    }
    return this.lockFilePath;
  }

  private readRegistry(): ActiveProcessRecord[] {
    try {
      const p = this.getLockFilePath();
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
      }
    } catch (err) {
      console.warn('[ServiceProcessManager] Failed to read process registry:', err);
    }
    return [];
  }

  private writeRegistry(records: ActiveProcessRecord[]) {
    try {
      const p = this.getLockFilePath();
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(p, JSON.stringify(records, null, 2), 'utf8');
    } catch (err) {
      console.warn('[ServiceProcessManager] Failed to save process registry:', err);
    }
  }

  private addRecord(record: ActiveProcessRecord) {
    const list = this.readRegistry().filter((r) => r.serviceId !== record.serviceId);
    list.push(record);
    this.writeRegistry(list);
  }

  private removeRecord(serviceId: string) {
    const list = this.readRegistry().filter((r) => r.serviceId !== serviceId);
    this.writeRegistry(list);
  }

  /**
   * Check whether a process with given PID is still active in the OS
   */
  public isProcessAlive(pid: number): boolean {
    if (!pid || pid <= 0) return false;
    try {
      // Sending signal 0 checks for existence without killing
      process.kill(pid, 0);
      return true;
    } catch (e: any) {
      return e.code === 'EPERM'; // Exists but belongs to another permission group
    }
  }

  /**
   * Kill process tree cleanly across platforms
   */
  public killProcessTree(pid: number): boolean {
    if (!pid || pid <= 0) return false;
    const isWin = process.platform === 'win32';
    try {
      if (isWin) {
        // Windows recursive tree kill (/T = tree, /F = force)
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
        return true;
      } else {
        // Negative PID sends signal to whole process group
        try {
          process.kill(-pid, 'SIGKILL');
          return true;
        } catch {
          process.kill(pid, 'SIGKILL');
          return true;
        }
      }
    } catch {
      return false;
    }
  }

  /**
   * Startup self-check: clean up orphaned child processes left behind by unexpected crashes
   */
  public checkAndCleanOrphanProcesses(): { cleanedCount: number; records: ActiveProcessRecord[] } {
    const staleRecords = this.readRegistry();
    if (staleRecords.length === 0) {
      return { cleanedCount: 0, records: [] };
    }

    const cleaned: ActiveProcessRecord[] = [];
    for (const record of staleRecords) {
      if (this.isProcessAlive(record.pid)) {
        console.log(`[ServiceProcessManager] Cleaning orphan process: PID ${record.pid} (${record.serviceName})`);
        this.killProcessTree(record.pid);
        cleaned.push(record);
      }
    }

    // Reset registry
    this.writeRegistry([]);
    return { cleanedCount: cleaned.length, records: cleaned };
  }

  /**
   * Start a service process
   */
  public start(
    config: ServiceRunConfig,
    onLog: (serviceId: string, data: string, stream: 'stdout' | 'stderr') => void,
    onExit: (serviceId: string, exitCode: number, signal?: string) => void
  ): { success: boolean; pid?: number; error?: string } {
    // 1. Stop any previous instance of this service first
    if (this.activeServices.has(config.serviceId)) {
      this.stop(config.serviceId);
    }

    const isWin = process.platform === 'win32';
    const cwd = config.cwd && fs.existsSync(config.cwd) ? config.cwd : process.cwd();

    // Prepare environment
    const mergedEnv = Object.assign({}, process.env, config.env, {
      FORCE_COLOR: '3', // Encourage ANSI colors in Spring Boot, Vite, Chalk, etc.
      NODE_ENV: process.env.NODE_ENV || 'development',
    });

    try {
      let child: ChildProcess;

      if (isWin) {
        // Use cmd.exe with Windows Hide to avoid popping up separate black console windows
        child = spawn('cmd.exe', ['/d', '/s', '/c', config.command], {
          cwd,
          env: mergedEnv,
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } else {
        // Use sh with detached process group so child processes can be tree-killed cleanly
        child = spawn('sh', ['-c', config.command], {
          cwd,
          env: mergedEnv,
          detached: true,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      }

      const pid = child.pid;
      if (!pid) {
        throw new Error('Failed to obtain process PID');
      }

      const record: ActiveProcessRecord = {
        serviceId: config.serviceId,
        serviceName: config.serviceName,
        projectId: config.projectId,
        pid,
        command: config.command,
        startedAt: Date.now(),
      };

      const entry: RunningServiceEntry = {
        ...record,
        child,
      };

      this.activeServices.set(config.serviceId, entry);
      this.addRecord(record);

      // Handle standard output
      child.stdout?.on('data', (chunk) => {
        const text = chunk.toString();
        onLog(config.serviceId, text, 'stdout');
      });

      // Handle standard error
      child.stderr?.on('data', (chunk) => {
        const text = chunk.toString();
        onLog(config.serviceId, text, 'stderr');
      });

      // Handle process exit
      child.on('close', (code, signal) => {
        this.activeServices.delete(config.serviceId);
        this.removeRecord(config.serviceId);
        onExit(config.serviceId, code !== null ? code : (signal ? 1 : 0), signal || undefined);
      });

      child.on('error', (err) => {
        onLog(config.serviceId, `\n[Process Error] ${err.message}\n`, 'stderr');
        this.activeServices.delete(config.serviceId);
        this.removeRecord(config.serviceId);
        onExit(config.serviceId, 1);
      });

      return { success: true, pid };
    } catch (err: any) {
      console.error(`[ServiceProcessManager] Failed to launch service ${config.serviceName}:`, err);
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Stop an active service process tree
   */
  public stop(serviceId: string): boolean {
    const entry = this.activeServices.get(serviceId);
    if (!entry) return false;

    try {
      this.killProcessTree(entry.pid);
      try {
        entry.child.kill('SIGKILL');
      } catch {}
    } finally {
      this.activeServices.delete(serviceId);
      this.removeRecord(serviceId);
    }
    return true;
  }

  /**
   * Stop all active services, optionally filtered by projectId
   */
  public stopAll(projectId?: string): number {
    let count = 0;
    for (const [id, entry] of Array.from(this.activeServices.entries())) {
      if (!projectId || entry.projectId === projectId) {
        this.stop(id);
        count++;
      }
    }
    return count;
  }

  /**
   * Get list of currently running service IDs and PIDs
   */
  public getRunningServices(projectId?: string): Array<{ serviceId: string; pid: number; startedAt: number }> {
    const res: Array<{ serviceId: string; pid: number; startedAt: number }> = [];
    for (const entry of this.activeServices.values()) {
      if (!projectId || entry.projectId === projectId) {
        res.push({
          serviceId: entry.serviceId,
          pid: entry.pid,
          startedAt: entry.startedAt,
        });
      }
    }
    return res;
  }

  /**
   * Check if there are active running services
   */
  public hasRunningServices(projectId?: string): boolean {
    if (!projectId) {
      return this.activeServices.size > 0;
    }
    for (const entry of this.activeServices.values()) {
      if (entry.projectId === projectId) return true;
    }
    return false;
  }
}

export const serviceProcessManager = new ServiceProcessManager();

export function setupServiceIpcHandlers() {
  ipcMain.handle('services:start', (event, config: ServiceRunConfig) => {
    const sender = event.sender;
    return serviceProcessManager.start(
      config,
      (serviceId, data, stream) => {
        if (!sender.isDestroyed()) {
          sender.send('services:log', { serviceId, data, stream });
        }
      },
      (serviceId, exitCode, signal) => {
        if (!sender.isDestroyed()) {
          sender.send('services:exit', { serviceId, exitCode, signal });
        }
      }
    );
  });

  ipcMain.handle('services:stop', (_event, serviceId: string) => {
    return { success: serviceProcessManager.stop(serviceId) };
  });

  ipcMain.handle('services:stop-all', (_event, projectId?: string) => {
    const stoppedCount = serviceProcessManager.stopAll(projectId);
    return { success: true, count: stoppedCount };
  });

  ipcMain.handle('services:get-running', (_event, projectId?: string) => {
    return serviceProcessManager.getRunningServices(projectId);
  });

  ipcMain.handle('services:check-orphans', () => {
    return serviceProcessManager.checkAndCleanOrphanProcesses();
  });
}
