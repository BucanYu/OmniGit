import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn, execSync, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

let iconv: any = null;
try {
  iconv = require('iconv-lite');
} catch {}

function decodeStreamBuffer(buffer: Buffer): string {
  const utf8Str = buffer.toString('utf8');
  if (!utf8Str.includes('\uFFFD')) {
    return utf8Str;
  }
  if (iconv) {
    try {
      const gbkStr = iconv.decode(buffer, 'gbk');
      if (!gbkStr.includes('\uFFFD')) {
        return gbkStr;
      }
    } catch {}
  }
  return utf8Str;
}

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
  kind?: 'service' | 'task';
  winStartScript?: string;
  winStopScript?: string;
  unixStartScript?: string;
  unixStopScript?: string;
  cwd?: string;
}

export class NodeServiceProcessManager extends EventEmitter {
  private activeServices = new Map<string, RunningServiceEntry>();
  private lockFilePath: string;
  private watchdogTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.lockFilePath = path.join(os.homedir(), '.omnigit', 'active_service_pids.json');
    this.startWatchdog();
  }

  private startWatchdog() {
    if (this.watchdogTimer) return;
    this.watchdogTimer = setInterval(() => {
      this.checkActiveProcessesLiveness();
    }, 2500);
    if (this.watchdogTimer.unref) {
      this.watchdogTimer.unref();
    }
  }

  private checkActiveProcessesLiveness() {
    if (this.activeServices.size === 0) return;
    for (const [serviceId, entry] of Array.from(this.activeServices.entries())) {
      if (!this.isProcessAlive(entry.pid)) {
        console.log(`[NodeServiceProcessManager] Watchdog detected dead process: PID ${entry.pid} (${entry.serviceName})`);
        this.activeServices.delete(serviceId);
        this.removeRecord(serviceId);
        this.emit('exit', { serviceId, exitCode: 1, signal: 'SIGKILL' });
      }
    }
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

  public async killProcessTree(pid: number): Promise<boolean> {
    if (!pid || pid <= 0) return false;
    const isWin = process.platform === 'win32';
    if (!isWin) {
      try {
        process.kill(-pid, 'SIGKILL');
        return true;
      } catch {
        try {
          process.kill(pid, 'SIGKILL');
          return true;
        } catch {
          return false;
        }
      }
    }

    return new Promise((resolve) => {
      try {
        const cp = spawn('taskkill', ['/F', '/T', '/PID', String(pid)], {
          windowsHide: true,
          stdio: 'ignore',
        });
        cp.on('close', () => resolve(true));
        cp.on('error', () => {
          try {
            process.kill(pid, 'SIGKILL');
            resolve(true);
          } catch {
            resolve(false);
          }
        });
      } catch {
        try {
          process.kill(pid, 'SIGKILL');
          resolve(true);
        } catch {
          resolve(false);
        }
      }
    });
  }

  public killProcessTreeSync(pid: number): boolean {
    if (!pid || pid <= 0) return false;
    const isWin = process.platform === 'win32';
    try {
      if (isWin) {
        execSync(`taskkill /F /T /PID ${pid}`, { windowsHide: true, stdio: 'ignore' });
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
        this.killProcessTreeSync(record.pid);
        cleaned.push(record);
      }
    }

    this.writeRegistry([]);
    return { cleanedCount: cleaned.length, records: cleaned };
  }

  public scanProjectScripts(projectPath: string): DiscoveredScriptGroup[] {
    if (!projectPath || !fs.existsSync(projectPath)) return [];

    const searchRoots: Array<{ rootDir: string; relCwd: string }> = [
      { rootDir: projectPath, relCwd: '' },
    ];
    const parentDir = path.dirname(projectPath);
    if (parentDir && parentDir !== projectPath && fs.existsSync(path.join(parentDir, 'scripts'))) {
      searchRoots.push({ rootDir: parentDir, relCwd: '..' });
    }

    const subdirs = ['.', 'scripts', 'bin', 'tools'];
    const exts = ['.bat', '.cmd', '.ps1', '.sh', '.bash'];
    const discovered: Array<{
      relPath: string;
      absPath: string;
      name: string;
      ext: string;
      cwd: string;
    }> = [];

    for (const { rootDir, relCwd } of searchRoots) {
      for (const d of subdirs) {
        const fullDir = path.resolve(rootDir, d);
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
                    cwd: relCwd,
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

        const isTask =
          /^(build|clean|compile|package|test|migrate|init|install|setup|sync)/i.test(coreId) ||
          /[-_](build|clean|compile|package|test|migrate|init|install|setup|sync)$/i.test(coreId);

        g = {
          id: `discovered_${coreId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: friendlyName,
          kind: isTask ? 'task' : 'service',
          cwd: item.cwd || '',
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

  public resolveCommandAndCwd(
    baseCwd: string,
    rawCommand: string
  ): { cwd: string; command: string } {
    let cwd = baseCwd && fs.existsSync(baseCwd) ? path.resolve(baseCwd) : process.cwd();
    const cmd = (rawCommand || '').trim();
    if (!cmd) {
      return { cwd, command: cmd };
    }

    // 1. Try to extract target file/executable if it points to a script or relative path
    let targetFile = '';
    const psMatch = cmd.match(/^(?:powershell(?:\.exe)?|pwsh(?:\.exe)?)\s+.*-File\s+["']?([^"']+)["']?/i);
    const shMatch = cmd.match(/^(?:sh|bash)\s+["']?([^"']+)["']?/i);
    const cmdMatch = cmd.match(/^cmd(?:\.exe)?\s+\/(?:c|k)\s+["']?([^"']+)["']?/i);
    const nodeMatch = cmd.match(/^node(?:\.exe)?\s+["']?([^"']+)["']?/i);

    if (psMatch) {
      targetFile = psMatch[1].trim();
    } else if (shMatch) {
      targetFile = shMatch[1].trim();
    } else if (cmdMatch) {
      targetFile = cmdMatch[1].trim();
    } else if (nodeMatch) {
      targetFile = nodeMatch[1].trim();
    } else {
      const m = cmd.match(/^"([^"]+)"/) || cmd.match(/^'([^']+)'/) || cmd.match(/^(\S+)/);
      if (m) {
        targetFile = m[1].trim();
      }
    }

    if (!targetFile) {
      return { cwd, command: cmd };
    }

    // If targetFile is an absolute path that exists on disk
    if (path.isAbsolute(targetFile)) {
      if (fs.existsSync(targetFile)) {
        const dir = path.dirname(targetFile);
        if (path.basename(dir).toLowerCase() === 'scripts') {
          const rootCandidate = path.dirname(dir);
          if (fs.existsSync(rootCandidate)) {
            return { cwd: rootCandidate, command: cmd };
          }
        }
        return { cwd, command: cmd };
      }
    }

    // Check if targetFile already exists in current cwd
    const directPath = path.resolve(cwd, targetFile);
    if (fs.existsSync(directPath)) {
      return { cwd, command: cmd };
    }

    // Check parent directories (e.g. inner nested repository inside a monorepo root)
    const candidateParents = [
      path.resolve(cwd, '..'),
      path.resolve(cwd, '../..'),
    ];

    for (const parent of candidateParents) {
      if (fs.existsSync(parent)) {
        // Check 1: does targetFile exist in parent?
        const inParent = path.resolve(parent, targetFile);
        if (fs.existsSync(inParent)) {
          return { cwd: parent, command: cmd };
        }

        // Check 2: if targetFile is just "start-backend.bat", does "scripts/start-backend.bat" exist in parent?
        const inParentScripts = path.resolve(parent, 'scripts', targetFile);
        if (fs.existsSync(inParentScripts)) {
          const replacement = path.join('scripts', targetFile);
          const updatedCmd = cmd.includes(targetFile) ? cmd.replace(targetFile, replacement) : replacement;
          return { cwd: parent, command: updatedCmd };
        }
      }
    }

    // Check 3: if targetFile is just "start-backend.bat", does "scripts/start-backend.bat" exist in cwd?
    const inCwdScripts = path.resolve(cwd, 'scripts', targetFile);
    if (fs.existsSync(inCwdScripts)) {
      const replacement = path.join('scripts', targetFile);
      const updatedCmd = cmd.includes(targetFile) ? cmd.replace(targetFile, replacement) : replacement;
      return { cwd, command: updatedCmd };
    }

    return { cwd, command: cmd };
  }

  public async start(
    config: ServiceRunConfig,
    onLog?: (serviceId: string, data: string, stream: 'stdout' | 'stderr') => void,
    onExit?: (serviceId: string, exitCode: number, signal?: string) => void
  ): Promise<{ success: boolean; pid?: number; error?: string }> {
    if (this.activeServices.has(config.serviceId)) {
      await this.stop(config.serviceId);
    }

    const isWin = process.platform === 'win32';
    const resolved = this.resolveCommandAndCwd(config.cwd, config.command);
    const cwd = resolved.cwd;
    let execCommand = resolved.command;

    const mergedEnv = Object.assign({}, process.env, config.env, {
      FORCE_COLOR: '3',
      SPRING_OUTPUT_ANSI_ENABLED: 'ALWAYS',
      CLICOLOR_FORCE: '1',
      COLORTERM: 'truecolor',
      TERM: 'xterm-256color',
      NODE_ENV: process.env.NODE_ENV || 'development',
    });

    try {
      let child: ChildProcess;
      const cleanCmd = execCommand.trim().replace(/^["']|["']$/g, '');

      if (isWin) {
        if (cleanCmd.toLowerCase().endsWith('.ps1')) {
          child = spawn(
            'powershell.exe',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', cleanCmd],
            {
              cwd,
              env: mergedEnv,
              windowsHide: true,
              stdio: ['pipe', 'pipe', 'pipe'],
            }
          );
        } else if (cleanCmd.toLowerCase().endsWith('.bat') || cleanCmd.toLowerCase().endsWith('.cmd')) {
          child = spawn('cmd.exe', ['/d', '/s', '/c', cleanCmd], {
            cwd,
            env: mergedEnv,
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
        } else if (/^cmd(?:\.exe)?\s+\/(?:c|k)\s+/i.test(cleanCmd)) {
          const inner = cleanCmd.replace(/^cmd(?:\.exe)?\s+\/(?:c|k)\s+/i, '').replace(/^["']|["']$/g, '');
          child = spawn('cmd.exe', ['/d', '/s', '/c', inner], {
            cwd,
            env: mergedEnv,
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
        } else {
          child = spawn(execCommand, [], {
            cwd,
            env: mergedEnv,
            shell: true,
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
        }
      } else {
        if (cleanCmd.toLowerCase().endsWith('.sh') || cleanCmd.toLowerCase().endsWith('.bash')) {
          child = spawn('sh', [cleanCmd], {
            cwd,
            env: mergedEnv,
            detached: true,
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
        const text = decodeStreamBuffer(chunk);
        if (onLog) onLog(config.serviceId, text, 'stdout');
        this.emit('log', { serviceId: config.serviceId, data: text, stream: 'stdout' });
      });

      child.stderr?.on('data', (chunk) => {
        const text = decodeStreamBuffer(chunk);
        if (onLog) onLog(config.serviceId, text, 'stderr');
        this.emit('log', { serviceId: config.serviceId, data: text, stream: 'stderr' });
      });

      // Dual event handling: exit and close, ensuring we never hang if child exited but lingering orphan process holds stdio open
      let hasReportedExit = false;
      const handleExitOrClose = (code: number | null, signal: string | null) => {
        if (hasReportedExit) return;
        hasReportedExit = true;

        this.activeServices.delete(config.serviceId);
        this.removeRecord(config.serviceId);

        const exitCode = code !== null ? code : (signal ? 1 : 0);

        // If process exited with failure (code !== 0), proactively clean up any leftover orphan grandchild processes
        if (exitCode !== 0 && pid) {
          this.killProcessTree(pid).catch(() => {});
        }

        if (onExit) onExit(config.serviceId, exitCode, signal || undefined);
        this.emit('exit', { serviceId: config.serviceId, exitCode, signal: signal || undefined });
      };

      child.on('exit', (code, signal) => {
        handleExitOrClose(code, signal);
      });

      child.on('close', (code, signal) => {
        handleExitOrClose(code, signal);
      });

      child.on('error', (err) => {
        const errText = `\n[Process Error] ${err.message}\n`;
        if (onLog) onLog(config.serviceId, errText, 'stderr');
        this.emit('log', { serviceId: config.serviceId, data: errText, stream: 'stderr' });
        handleExitOrClose(1, null);
      });

      // Immediately send EOF to stdin AFTER listeners are attached to prevent batch scripts with 'pause' from hanging forever
      try {
        child.stdin?.end();
      } catch {}

      return { success: true, pid };
    } catch (err: any) {
      console.error(`[NodeServiceProcessManager] Failed to launch service ${config.serviceName}:`, err);
      return { success: false, error: err.message || String(err) };
    }
  }

  private runStopCommandAsync(command: string, cwd: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        const isWin = process.platform === 'win32';
        let cleanStop = command.trim().replace(/^["']|["']$/g, '');
        let execCmd = cleanStop;
        if (isWin) {
          if (cleanStop.toLowerCase().endsWith('.ps1')) {
            execCmd = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${cleanStop}"`;
          } else if (cleanStop.toLowerCase().endsWith('.bat') || cleanStop.toLowerCase().endsWith('.cmd')) {
            execCmd = `cmd.exe /d /s /c "${cleanStop}"`;
          }
        } else {
          if (cleanStop.toLowerCase().endsWith('.sh') || cleanStop.toLowerCase().endsWith('.bash')) {
            execCmd = `sh "${cleanStop}"`;
          }
        }

        const cp = spawn(execCmd, [], {
          cwd,
          shell: true,
          windowsHide: true,
          stdio: 'ignore',
        });

        // 5 seconds timeout max for custom stop command
        const timer = setTimeout(() => {
          try {
            cp.kill('SIGKILL');
          } catch {}
          resolve();
        }, 5000);

        cp.on('close', () => {
          clearTimeout(timer);
          resolve();
        });

        cp.on('error', () => {
          clearTimeout(timer);
          resolve();
        });
      } catch {
        resolve();
      }
    });
  }

  public async stop(serviceId: string): Promise<boolean> {
    const entry = this.activeServices.get(serviceId);
    if (!entry) return false;

    this.activeServices.delete(serviceId);
    this.removeRecord(serviceId);

    try {
      // 1. Immediately kill the main child process tree asynchronously
      await this.killProcessTree(entry.pid);
      try {
        entry.child.kill('SIGKILL');
      } catch {}

      // 2. If a custom stop command is defined, run it asynchronously without blocking
      if (entry.stopCommand && entry.stopCommand.trim()) {
        try {
          const resolvedStop = this.resolveCommandAndCwd(entry.cwd, entry.stopCommand);
          await this.runStopCommandAsync(resolvedStop.command, resolvedStop.cwd);
        } catch (e) {
          console.warn(`[NodeServiceProcessManager] Custom stop command error:`, e);
        }
      }
    } catch (err) {
      console.warn(`[NodeServiceProcessManager] Error stopping service ${serviceId}:`, err);
    }

    return true;
  }

  public async stopAll(projectId?: string): Promise<number> {
    const targetIds: string[] = [];
    for (const [id, entry] of this.activeServices.entries()) {
      if (!projectId || entry.projectId === projectId) {
        targetIds.push(id);
      }
    }
    await Promise.all(targetIds.map((id) => this.stop(id)));
    return targetIds.length;
  }

  public stopAllSync(projectId?: string): number {
    let count = 0;
    for (const [id, entry] of Array.from(this.activeServices.entries())) {
      if (!projectId || entry.projectId === projectId) {
        this.killProcessTreeSync(entry.pid);
        try {
          entry.child.kill('SIGKILL');
        } catch {}
        this.activeServices.delete(id);
        this.removeRecord(id);
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
