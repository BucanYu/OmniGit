import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { ipcMain, BrowserWindow } from 'electron';
let ptyModule: typeof import('node-pty') | null = null;
try {
  ptyModule = require('node-pty');
} catch (err) {
  console.warn('[PtyManager] Failed to load node-pty module:', err);
}

export interface ShellInfo {
  id: string;
  name: string;
  path: string;
  args?: string[];
}

export interface SpawnOptions {
  id: string;
  shell?: string;
  args?: string[];
  cwd?: string;
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
}

class PtyManager {
  private terminals = new Map<string, any>();

  public getAvailableShells(): ShellInfo[] {
    const isWindows = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    const shells: ShellInfo[] = [];

    if (isWindows) {
      // 1. Windows PowerShell
      const sysRoot = process.env.SystemRoot || 'C:\\Windows';
      const winPowerShell = path.join(sysRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      if (fs.existsSync(winPowerShell)) {
        shells.push({
          id: 'powershell',
          name: 'PowerShell',
          path: winPowerShell,
        });
      }

      // 2. PowerShell Core / 7
      const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      const pwshCore = path.join(programFiles, 'PowerShell', '7', 'pwsh.exe');
      if (fs.existsSync(pwshCore)) {
        shells.push({
          id: 'pwsh',
          name: 'PowerShell 7',
          path: pwshCore,
        });
      }

      // 3. Git Bash
      const gitBashCandidates = [
        path.join(programFiles, 'Git', 'bin', 'bash.exe'),
        path.join(programFiles, 'Git', 'usr', 'bin', 'bash.exe'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Git', 'bin', 'bash.exe'),
        path.join(process.env['LOCALAPPDATA'] || '', 'Programs', 'Git', 'bin', 'bash.exe'),
      ];
      for (const candidate of gitBashCandidates) {
        if (candidate && fs.existsSync(candidate)) {
          shells.push({
            id: 'git-bash',
            name: 'Git Bash',
            path: candidate,
            args: ['--login', '-i'],
          });
          break;
        }
      }

      // 4. Command Prompt
      const cmdPath = path.join(sysRoot, 'System32', 'cmd.exe');
      if (fs.existsSync(cmdPath)) {
        shells.push({
          id: 'cmd',
          name: 'Command Prompt',
          path: cmdPath,
        });
      }

      // 5. WSL
      const wslPath = path.join(sysRoot, 'System32', 'wsl.exe');
      if (fs.existsSync(wslPath)) {
        shells.push({
          id: 'wsl',
          name: 'WSL (Linux)',
          path: wslPath,
        });
      }
    } else if (isMac) {
      const defaultShell = process.env.SHELL || '/bin/zsh';
      shells.push({
        id: 'zsh',
        name: 'Zsh',
        path: defaultShell,
        args: ['-l'],
      });
      if (fs.existsSync('/bin/bash')) {
        shells.push({
          id: 'bash',
          name: 'Bash',
          path: '/bin/bash',
          args: ['-l'],
        });
      }
    } else {
      const defaultShell = process.env.SHELL || '/bin/bash';
      shells.push({
        id: 'bash',
        name: 'Bash',
        path: defaultShell,
        args: ['-i'],
      });
    }

    return shells;
  }

  public getDefaultShell(): ShellInfo {
    const available = this.getAvailableShells();
    return available[0] || {
      id: 'default',
      name: 'Default Shell',
      path: process.platform === 'win32' ? 'powershell.exe' : '/bin/sh',
    };
  }

  public spawn(
    options: SpawnOptions,
    onData: (data: string) => void,
    onExit: (exitCode: number) => void
  ): { id: string; shell: string; cwd: string } {
    this.kill(options.id);

    const defaultShell = this.getDefaultShell();
    const shellPath = options.shell || defaultShell.path;
    const args = options.args || defaultShell.args || [];
    const cwd = options.cwd && fs.existsSync(options.cwd) ? options.cwd : os.homedir();

    const env = Object.assign({}, process.env, options.env, {
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    });

    if (!ptyModule) {
      throw new Error('终端底层模块 node-pty 未加载成功');
    }

    try {
      const ptyProcess = ptyModule.spawn(shellPath, args, {
        name: 'xterm-256color',
        cols: options.cols || 80,
        rows: options.rows || 24,
        cwd,
        env: env as Record<string, string>,
        useConpty: process.platform === 'win32',
      });

      ptyProcess.onData((data) => {
        onData(data);
      });

      ptyProcess.onExit((e) => {
        this.terminals.delete(options.id);
        onExit(e ? e.exitCode : 0);
      });

      this.terminals.set(options.id, ptyProcess);

      return {
        id: options.id,
        shell: path.basename(shellPath),
        cwd,
      };
    } catch (err: any) {
      console.error(`[PtyManager] Failed to spawn PTY:`, err);
      throw err;
    }
  }

  public write(id: string, data: string): boolean {
    const ptyProcess = this.terminals.get(id);
    if (ptyProcess) {
      ptyProcess.write(data);
      return true;
    }
    return false;
  }

  public resize(id: string, cols: number, rows: number): boolean {
    const ptyProcess = this.terminals.get(id);
    if (ptyProcess && cols > 0 && rows > 0) {
      try {
        ptyProcess.resize(cols, rows);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  public kill(id: string): boolean {
    const ptyProcess = this.terminals.get(id);
    if (ptyProcess) {
      try {
        ptyProcess.kill();
      } catch {}
      this.terminals.delete(id);
      return true;
    }
    return false;
  }

  public killAll() {
    for (const [id, ptyProcess] of this.terminals.entries()) {
      try {
        ptyProcess.kill();
      } catch {}
    }
    this.terminals.clear();
  }
}

export const ptyManager = new PtyManager();

export function setupPtyIpcHandlers() {
  ipcMain.handle('terminal:get-shells', () => {
    return ptyManager.getAvailableShells();
  });

  ipcMain.handle('terminal:spawn', (event, options: SpawnOptions) => {
    const sender = event.sender;
    return ptyManager.spawn(
      options,
      (data) => {
        if (!sender.isDestroyed()) {
          sender.send('terminal:data', { id: options.id, data });
        }
      },
      (exitCode) => {
        if (!sender.isDestroyed()) {
          sender.send('terminal:exit', { id: options.id, exitCode });
        }
      }
    );
  });

  ipcMain.handle('terminal:write', (_event, id: string, data: string) => {
    return ptyManager.write(id, data);
  });

  ipcMain.handle('terminal:resize', (_event, id: string, cols: number, rows: number) => {
    return ptyManager.resize(id, cols, rows);
  });

  ipcMain.handle('terminal:kill', (_event, id: string) => {
    return ptyManager.kill(id);
  });
}
