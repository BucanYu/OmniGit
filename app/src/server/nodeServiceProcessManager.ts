import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn, execSync, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface ServiceRunConfig {
  serviceId: string;
  serviceName: string;
  projectId: string;
  command: string;
  stopCommand?: string;
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
  stopCommand?: string;
  cwd: string;
  startedAt: number;
  child: ChildProcess;
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

export class NodeServiceProcessManager extends EventEmitter {
  private activeServices = new Map<string, RunningServiceEntry>();
  private lockFilePath: string;

  constructor() {
    super();
    this.lockFilePath = path.join(os.homedir(), '.omnigit', 'active_service_pids.json');
  }

  public setCustomLockFilePath(customPath: string) {
    if (customPath) {
      this.lockFilePath = customPath;
    }
  }

  private readRegistry(): ActiveProcessRecord[] {
    try {
      if (fs.existsSync(this.lockFilePath)) {
        const raw = fs.readFileSync(this.lockFilePath, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
      }
    } catch (err) {
      console.warn('[NodeServiceProcessManager] Failed to read process registry:', err);
    }
    return [];
  }

  private writeRegistry(records: ActiveProcessRecord[]) {
    try {
      const dir = path.dirname(this.lockFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.lockFilePath, JSON.stringify(records, null, 2), 'utf8');
    } catch (err) {
      console.warn('[NodeServiceProcessManager] Failed to save process registry:', err);
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

  public isProcessAlive(pid: number): boolean {
    if (!pid || pid <= 0) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (e: any) {
      return e.code === 'EPERM';
    }
  }

  public killProcessTree(pid: number): boolean {
    if (!pid || pid <= 0) return false;
    const isWin = process.platform === 'win32';
    try {
      if (isWin) {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
        return true;
      } else {
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

  public checkAndCleanOrphanProcesses(): { cleanedCount: number; records: ActiveProcessRecord[] } {
    const staleRecords = this.readRegistry();
    if (staleRecords.length === 0) {
      return { cleanedCount: 0, records: [] };
    }

    const cleaned: ActiveProcessRecord[] = [];
    for (const record of staleRecords) {
      if (this.isProcessAlive(record.pid)) {
        console.log(`[NodeServiceProcessManager] Cleaning orphan process: PID ${record.pid} (${record.serviceName})`);
        this.killProcessTree(record.pid);
        cleaned.push(record);
      }
    }

    this.writeRegistry([]);
    return { cleanedCount: cleaned.length, records: cleaned };
  }

  public scanProjectScripts(projectPath: string): DiscoveredScriptGroup[] {
    if (!projectPath || !fs.existsSync(projectPath)) return [];

    const searchRoots = [projectPath];
    const parentDir = path.dirname(projectPath);
    if (parentDir && parentDir !== projectPath && fs.existsSync(path.join(parentDir, 'scripts'))) {
      searchRoots.push(parentDir);
    }

    const subdirs = ['.', 'scripts', 'bin', 'tools'];
    const exts = ['.bat', '.cmd', '.ps1', '.sh', '.bash'];
    const discovered: Array<{ relPath: string; absPath: string; name: string; ext: string }> = [];

    for (const root of searchRoots) {
      for (const d of subdirs) {
        const fullDir = path.resolve(root, d);
        if (fs.existsSync(fullDir)) {
          try {
            const stat = fs.statSync(fullDir);
            if (stat.isDirectory()) {
              const files = fs.readdirSync(fullDir);
              for (const f of files) {
                const ext = path.extname(f).toLowerCase();
                if (exts.includes(ext)) {
                  const relPath = d === '.' ? f : path.join(d, f);
                  const absPath = path.join(fullDir, f);
                  discovered.push({
                    relPath,
                    absPath,
                    name: path.basename(f, ext),
                    ext,
                  });
                }
              }
            }
          } catch {}
        }
      }
    }

    const groupMap = new Map<string, DiscoveredScriptGroup>();

    const startItems = discovered.filter((item) => {
      const lower = item.name.toLowerCase();
      return (
        lower.includes('start') ||
        lower.includes('run') ||
        lower.includes('dev') ||
        lower.includes('launch') ||
        lower.includes('serve') ||
        lower.includes('up') ||
        (!lower.includes('stop') && !lower.includes('kill') && !lower.includes('down'))
      );
    });

    const stopItems = discovered.filter((item) => {
      const lower = item.name.toLowerCase();
      return lower.includes('stop') || lower.includes('kill') || lower.includes('down');
    });

    for (const item of startItems) {
      const coreId = item.name.toLowerCase().replace(/^(start|run|launch|dev)[-_]?/i, '') || item.name;
      const isWin = item.ext === '.bat' || item.ext === '.cmd' || item.ext === '.ps1';
      const isBat = item.ext === '.bat' || item.ext === '.cmd';
      const isUnix = item.ext === '.sh' || item.ext === '.bash';

      let g = groupMap.get(coreId);
      if (!g) {
        const cleanCore = coreId.replace(/[-_]/g, ' ');
        const friendlyName =
          cleanCore
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ') || item.name;

        g = {
          id: `discovered_${coreId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: friendlyName,
          cwd: '',
        };
        groupMap.set(coreId, g);
      }

      const matchingStop = stopItems.find((s) => {
        const stopCore = s.name.toLowerCase().replace(/^(stop|kill|down)[-_]?/i, '') || s.name;
        return stopCore === coreId;
      });

      if (isWin) {
        if (!g.winStartScript || isBat) {
          g.winStartScript = item.relPath;
        }
        if (matchingStop && (!g.winStopScript || matchingStop.ext === '.bat')) {
          g.winStopScript = matchingStop.relPath;
        }
      }
      if (isUnix) {
        if (!g.unixStartScript) {
          g.unixStartScript = item.relPath;
        }
        if (matchingStop && !g.unixStopScript) {
          g.unixStopScript = matchingStop.relPath;
        }
      }
    }

    return Array.from(groupMap.values());
  }

  public start(
    config: ServiceRunConfig,
    onLog?: (serviceId: string, data: string, stream: 'stdout' | 'stderr') => void,
    onExit?: (serviceId: string, exitCode: number, signal?: string) => void
  ): { success: boolean; pid?: number; error?: string } {
    if (this.activeServices.has(config.serviceId)) {
      this.stop(config.serviceId);
    }

    const isWin = process.platform === 'win32';
    const cwd = config.cwd && fs.existsSync(config.cwd) ? config.cwd : process.cwd();

    const mergedEnv = Object.assign({}, process.env, config.env, {
      FORCE_COLOR: '3',
      NODE_ENV: process.env.NODE_ENV || 'development',
    });

    try {
      let child: ChildProcess;
      let execCommand = (config.command || '').trim();

      if (isWin) {
        if (execCommand.toLowerCase().endsWith('.ps1')) {
          execCommand = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${execCommand}"`;
        } else if (execCommand.toLowerCase().endsWith('.bat') || execCommand.toLowerCase().endsWith('.cmd')) {
          execCommand = `cmd.exe /d /s /c "${execCommand}"`;
        }
      } else {
        if (execCommand.toLowerCase().endsWith('.sh') || execCommand.toLowerCase().endsWith('.bash')) {
          execCommand = `sh "${execCommand}"`;
        }
      }

      if (isWin) {
        child = spawn(execCommand, [], {
          cwd,
          env: mergedEnv,
          shell: true,
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } else {
        child = spawn(execCommand, [], {
          cwd,
          env: mergedEnv,
          shell: true,
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
        stopCommand: config.stopCommand,
        cwd,
        child,
      };

      this.activeServices.set(config.serviceId, entry);
      this.addRecord(record);

      child.stdout?.on('data', (chunk) => {
        const text = chunk.toString();
        if (onLog) onLog(config.serviceId, text, 'stdout');
        this.emit('log', { serviceId: config.serviceId, data: text, stream: 'stdout' });
      });

      child.stderr?.on('data', (chunk) => {
        const text = chunk.toString();
        if (onLog) onLog(config.serviceId, text, 'stderr');
        this.emit('log', { serviceId: config.serviceId, data: text, stream: 'stderr' });
      });

      child.on('close', (code, signal) => {
        this.activeServices.delete(config.serviceId);
        this.removeRecord(config.serviceId);
        const exitCode = code !== null ? code : (signal ? 1 : 0);
        if (onExit) onExit(config.serviceId, exitCode, signal || undefined);
        this.emit('exit', { serviceId: config.serviceId, exitCode, signal: signal || undefined });
      });

      child.on('error', (err) => {
        const errText = `\n[Process Error] ${err.message}\n`;
        if (onLog) onLog(config.serviceId, errText, 'stderr');
        this.emit('log', { serviceId: config.serviceId, data: errText, stream: 'stderr' });
        this.activeServices.delete(config.serviceId);
        this.removeRecord(config.serviceId);
        if (onExit) onExit(config.serviceId, 1);
        this.emit('exit', { serviceId: config.serviceId, exitCode: 1 });
      });

      return { success: true, pid };
    } catch (err: any) {
      console.error(`[NodeServiceProcessManager] Failed to launch service ${config.serviceName}:`, err);
      return { success: false, error: err.message || String(err) };
    }
  }

  public stop(serviceId: string): boolean {
    const entry = this.activeServices.get(serviceId);
    if (!entry) return false;

    try {
      if (entry.stopCommand && entry.stopCommand.trim()) {
        try {
          const isWin = process.platform === 'win32';
          let stopCmd = entry.stopCommand.trim();
          if (isWin) {
            if (stopCmd.toLowerCase().endsWith('.ps1')) {
              stopCmd = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${stopCmd}"`;
            } else if (stopCmd.toLowerCase().endsWith('.bat') || stopCmd.toLowerCase().endsWith('.cmd')) {
              stopCmd = `cmd.exe /d /s /c "${stopCmd}"`;
            }
          } else {
            if (stopCmd.toLowerCase().endsWith('.sh') || stopCmd.toLowerCase().endsWith('.bash')) {
              stopCmd = `sh "${stopCmd}"`;
            }
          }
          execSync(stopCmd, { cwd: entry.cwd, timeout: 5000, stdio: 'ignore' });
        } catch (e) {
          console.warn(`[NodeServiceProcessManager] Custom stop command error:`, e);
        }
      }

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

export const nodeServiceProcessManager = new NodeServiceProcessManager();
