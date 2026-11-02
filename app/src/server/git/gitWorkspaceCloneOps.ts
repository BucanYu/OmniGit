import { execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { decodeGitPath, splitGitPath } from '../../utils/gitPathUtils';
import {
  runGit,
  activeCloneProcesses,
  killProcessTree,
  parseGitProgress,
  diagnoseCloneError,
  repoWatchers,
  type CloneProgressEvent,
} from './gitExec';
import type { OmniGitSettings } from '../gitTypes';
import { gitSnapshotService } from '../gitSnapshotService';
import { fileSystemService, type SearchCodeMatch, type SearchCodeOptions } from '../fileSystemService';

export const gitWorkspaceCloneOps = {
  // 28. Open file in external editor (VS Code or system default)
  async openFileInEditor(repoPath: string, filePath: string): Promise<{ success: boolean; message: string }> {
    const cleanFilePath = decodeGitPath(filePath);
    const fullPath = path.resolve(repoPath, cleanFilePath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, message: `File not found: ${filePath}` };
    }
    try {
      const isWin = process.platform === 'win32';
      const isMac = process.platform === 'darwin';

      let electronShell: any = null;
      try {
        electronShell = require('electron').shell;
      } catch {}

      const winPath = fullPath.replace(/\//g, '\\');

      const codeChild = spawn('code', [fullPath], {
        detached: true,
        stdio: 'ignore',
        shell: false,
      });

      codeChild.on('error', () => {
        if (electronShell && typeof electronShell.openPath === 'function') {
          electronShell.openPath(fullPath);
        } else if (isWin) {
          const fallbackChild = spawn('explorer.exe', [winPath], {
            detached: true,
            stdio: 'ignore',
            shell: false,
          });
          fallbackChild.unref();
        } else if (isMac) {
          const fallbackChild = spawn('open', [fullPath], {
            detached: true,
            stdio: 'ignore',
            shell: false,
          });
          fallbackChild.unref();
        } else {
          const fallbackChild = spawn('xdg-open', [fullPath], {
            detached: true,
            stdio: 'ignore',
            shell: false,
          });
          fallbackChild.unref();
        }
      });
      codeChild.unref();

      return { success: true, message: `Opened ${filePath}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  // 28b. Reveal file/folder in OS file manager (Windows File Explorer / macOS Finder / Linux Desktop)
  async revealInFileManager(repoPath: string, filePath: string): Promise<{ success: boolean; message: string; target?: string }> {
    const cleanFilePath = decodeGitPath(filePath);
    let resolvedPath = path.isAbsolute(cleanFilePath)
      ? path.normalize(cleanFilePath)
      : path.resolve(repoPath, cleanFilePath);

    if (!fs.existsSync(resolvedPath)) {
      const nestedPath = path.resolve(repoPath, path.basename(repoPath), cleanFilePath);
      if (fs.existsSync(nestedPath)) {
        resolvedPath = nestedPath;
      } else {
        const parentDir = path.dirname(repoPath);
        const altPath = path.resolve(parentDir, cleanFilePath);
        if (fs.existsSync(altPath)) {
          resolvedPath = altPath;
        }
      }
    }

    let targetDir: string;
    if (fs.existsSync(resolvedPath)) {
      try {
        const stat = fs.statSync(resolvedPath);
        if (stat.isDirectory()) {
          targetDir = resolvedPath;
        } else {
          targetDir = path.dirname(resolvedPath);
        }
      } catch {
        targetDir = path.dirname(resolvedPath);
      }
    } else {
      let candidate = path.dirname(resolvedPath);
      while (!fs.existsSync(candidate) && candidate !== repoPath && candidate !== path.dirname(candidate)) {
        candidate = path.dirname(candidate);
      }
      if (fs.existsSync(candidate)) {
        targetDir = candidate;
      } else if (fs.existsSync(repoPath)) {
        targetDir = repoPath;
      } else {
        targetDir = process.cwd();
      }
    }

    try {
      const platform = process.platform;
      let electronShell: any = null;
      try {
        electronShell = require('electron').shell;
      } catch {}

      if (electronShell && typeof electronShell.showItemInFolder === 'function' && fs.existsSync(resolvedPath)) {
        electronShell.showItemInFolder(resolvedPath);
      } else if (platform === 'win32') {
        const winDirPath = path.normalize(targetDir).replace(/\//g, '\\');
        const child = spawn('explorer.exe', [winDirPath], {
          detached: true,
          stdio: 'ignore',
          shell: false,
        });
        child.unref();
      } else if (platform === 'darwin') {
        const child = spawn('open', [targetDir], {
          detached: true,
          stdio: 'ignore',
          shell: false,
        });
        child.unref();
      } else {
        const child = spawn('xdg-open', [targetDir], {
          detached: true,
          stdio: 'ignore',
          shell: false,
        });
        child.unref();
      }

      return {
        success: true,
        message: `已打开所在文件夹: ${targetDir}`,
        target: targetDir,
      };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  // 35. Subscribe to repository file changes in real-time (SSE / fs.watch)
  subscribeRepoChanges(repoPath: string, callback: () => void): () => void {
    const normalized = path.normalize(repoPath);
    let entry = repoWatchers.get(normalized);

    if (!entry) {
      const callbacks = new Set<() => void>();
      callbacks.add(callback);

      let debounceTimer: NodeJS.Timeout | null = null;
      let watcher: fs.FSWatcher | null = null;

      try {
        watcher = fs.watch(normalized, { recursive: true }, (eventType, filename) => {
          if (!filename) return;
          const fn = filename.toString().replace(/\\/g, '/');

          if (fn.startsWith('.git') || fn.includes('/.git')) {
            const isSignificantGitChange =
              fn === '.git/index' ||
              fn.endsWith('/.git/index') ||
              fn === '.git/HEAD' ||
              fn.endsWith('/.git/HEAD') ||
              fn === '.git/MERGE_HEAD' ||
              fn.endsWith('/.git/MERGE_HEAD') ||
              fn === '.git/MERGE_MSG' ||
              fn.endsWith('/.git/MERGE_MSG') ||
              fn === '.git/ORIG_HEAD' ||
              fn.endsWith('/.git/ORIG_HEAD') ||
              fn === '.git/REBASE_HEAD' ||
              fn.endsWith('/.git/REBASE_HEAD') ||
              fn.startsWith('.git/refs/heads/') ||
              fn.includes('/.git/refs/heads/') ||
              fn.startsWith('.git/refs/remotes/') ||
              fn.includes('/.git/refs/remotes/');

            if (!isSignificantGitChange) {
              return;
            }
          } else if (
            fn.includes('node_modules') ||
            fn.includes('.vscode') ||
            fn.includes('.idea') ||
            fn.includes('.temp') ||
            fn.endsWith('.tmp') ||
            fn.endsWith('~')
          ) {
            return;
          }

          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            const currentEntry = repoWatchers.get(normalized);
            if (currentEntry) {
              currentEntry.callbacks.forEach((cb) => {
                try {
                  cb();
                } catch (err) {
                  console.error('[gitService] watcher callback error:', err);
                }
              });
            }
          }, 350);
        });

        watcher.on('error', (err) => {
          console.error('[gitService] fs.watch error on', normalized, err);
        });
      } catch (err) {
        console.error('[gitService] Failed to initialize fs.watch on', normalized, err);
      }

      entry = {
        watcher,
        callbacks,
        debounceTimer,
      };
      repoWatchers.set(normalized, entry);
    } else {
      entry.callbacks.add(callback);
    }

    return () => {
      const current = repoWatchers.get(normalized);
      if (!current) return;
      current.callbacks.delete(callback);
      if (current.callbacks.size === 0) {
        if (current.debounceTimer) clearTimeout(current.debounceTimer);
        if (current.watcher) {
          try {
            current.watcher.close();
          } catch {}
        }
        repoWatchers.delete(normalized);
      }
    };
  },

  // 40. Get current settings, cache storage path and stats
  getSettingsInfo(): { settings: OmniGitSettings; cacheSize: number; repoCount: number } {
    return gitSnapshotService.getSettingsInfo();
  },

  // 41. Update settings with optional snapshot migration to new directory
  async updateSettings(
    newSettings: Partial<OmniGitSettings>,
    migrateData = false
  ): Promise<{ settings: OmniGitSettings; cacheSize: number; repoCount: number }> {
    return gitSnapshotService.updateSettings(newSettings, migrateData);
  },

  // 42. Clear cache snapshot files in user-configured cache directory
  async clearCache(): Promise<{ success: boolean; clearedCount: number }> {
    return gitSnapshotService.clearCache();
  },

  // 43. Get all disk snapshots for fast client hydration
  getDiskSnapshots(): Record<string, any> {
    return gitSnapshotService.getDiskSnapshots();
  },

  // 44. Save lightweight repo snapshot to disk
  saveDiskSnapshot(repoPath: string, snapshot: any): boolean {
    return gitSnapshotService.saveDiskSnapshot(repoPath, snapshot);
  },

  // 45. Get single repo disk snapshot
  getSingleDiskSnapshot(repoPath: string): any | null {
    return gitSnapshotService.getSingleDiskSnapshot(repoPath);
  },

  // 46. Workspaces & Recent Projects Disk Backup
  saveWorkspacesBackup(data: {
    savedWorkspaces?: any[];
    recentProjects?: any[];
    workspaceProjectPaths?: Record<string, string[]>;
  }): boolean {
    return gitSnapshotService.saveWorkspacesBackup(data);
  },

  // 47. Get Workspaces & Recent Projects Disk Backup
  getWorkspacesBackup(): {
    savedWorkspaces: any[];
    recentProjects: any[];
    workspaceProjectPaths: Record<string, string[]>;
  } {
    return gitSnapshotService.getWorkspacesBackup();
  },

  // 48. Services Disk Backup
  saveServicesBackup(data: { servicesByProject?: Record<string, any[]> }): boolean {
    return gitSnapshotService.saveServicesBackup(data);
  },

  getServicesBackup(): Record<string, any[]> {
    return gitSnapshotService.getServicesBackup();
  },

  // Clone a remote Git repository with real-time progress and logs streaming
  cloneRepoStream(
    remoteUrl: string,
    targetDir: string,
    options?: {
      branch?: string;
      username?: string;
      password?: string;
      cloneId?: string;
    },
    onProgress?: (progress: CloneProgressEvent) => void,
    onLog?: (line: string) => void
  ): Promise<{
    success: boolean;
    message: string;
    repoPath?: string;
    repoName?: string;
    currentBranch?: string;
  }> {
    return new Promise((resolve) => {
      const trimmedUrl = (remoteUrl || '').trim();
      let finalTargetDir = (targetDir || '').trim();

      if (!trimmedUrl) {
        return resolve({ success: false, message: 'Please enter a valid remote Git URL / 请输入有效的远端 Git 仓库地址' });
      }
      if (!finalTargetDir) {
        return resolve({ success: false, message: 'Please specify target folder / 请指定本地存放文件夹路径' });
      }

      finalTargetDir = path.resolve(finalTargetDir);

      if (fs.existsSync(finalTargetDir)) {
        try {
          const files = fs.readdirSync(finalTargetDir);
          if (files.length > 0) {
            return resolve({
              success: false,
              message: `目标文件夹已存在且不为空，无法克隆至该目录: ${finalTargetDir}`,
            });
          }
        } catch (e: any) {
          return resolve({ success: false, message: `检查目标文件夹失败: ${e.message}` });
        }
      } else {
        try {
          const parentDir = path.dirname(finalTargetDir);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
        } catch (e: any) {
          return resolve({ success: false, message: `无法创建父级目录: ${e.message}` });
        }
      }

      let cloneUrl = trimmedUrl;
      if (options?.username && options?.password && /^https?:\/\//i.test(trimmedUrl)) {
        try {
          const u = new URL(trimmedUrl);
          u.username = encodeURIComponent(options.username);
          u.password = encodeURIComponent(options.password);
          cloneUrl = u.toString();
        } catch {}
      }

      const args = ['-c', 'core.quotepath=false', 'clone', '--progress'];
      if (options?.branch && options.branch.trim()) {
        args.push('-b', options.branch.trim());
      }
      args.push(cloneUrl, finalTargetDir);

      const parentDir = path.dirname(finalTargetDir);
      const cloneId = options?.cloneId || `clone_${Date.now()}`;

      const child = spawn('git', args, {
        cwd: parentDir,
        windowsHide: true,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
        },
      });

      activeCloneProcesses.set(cloneId, child);

      let accumulatedStderr = '';
      let accumulatedStdout = '';
      let stderrBuffer = '';

      const handleChunk = (chunk: Buffer, isStderr: boolean) => {
        const text = chunk.toString('utf8');
        if (isStderr) {
          accumulatedStderr += text;
          stderrBuffer += text;
          const parts = stderrBuffer.split(/[\r\n]+/);
          if (!stderrBuffer.endsWith('\r') && !stderrBuffer.endsWith('\n')) {
            stderrBuffer = parts.pop() || '';
          } else {
            stderrBuffer = '';
          }
          for (const line of parts) {
            const clean = line.trim();
            if (!clean) continue;
            onLog?.(clean);
            const prog = parseGitProgress(clean);
            if (prog) {
              onProgress?.(prog);
            }
          }
        } else {
          accumulatedStdout += text;
          const lines = text.split(/[\r\n]+/);
          for (const line of lines) {
            const clean = line.trim();
            if (clean) onLog?.(clean);
          }
        }
      };

      child.stderr?.on('data', (chunk) => handleChunk(chunk, true));
      child.stdout?.on('data', (chunk) => handleChunk(chunk, false));

      child.on('error', (err) => {
        activeCloneProcesses.delete(cloneId);
        resolve({
          success: false,
          message: `启动 Git 进程失败: ${err.message}`,
        });
      });

      child.on('close', async (code) => {
        activeCloneProcesses.delete(cloneId);

        if (stderrBuffer.trim()) {
          const clean = stderrBuffer.trim();
          onLog?.(clean);
          const prog = parseGitProgress(clean);
          if (prog) onProgress?.(prog);
        }

        if (code === 0) {
          onProgress?.({
            phase: 'completing',
            phaseText: '克隆完成 (Clone complete)',
            percent: 100,
            stagePercent: 100,
            raw: 'Clone finished successfully',
          });

          const repoName = path.basename(finalTargetDir);
          let currentBranch = options?.branch?.trim() || 'main';
          try {
            const branchRes = await runGit(['branch', '--show-current'], finalTargetDir);
            if (branchRes.stdout.trim()) {
              currentBranch = branchRes.stdout.trim();
            }
          } catch {}

          resolve({
            success: true,
            message: `仓库 '${repoName}' 克隆成功!`,
            repoPath: finalTargetDir,
            repoName,
            currentBranch,
          });
        } else {
          const errorOutput = accumulatedStderr || accumulatedStdout || '克隆操作失败';
          const diagnosed = diagnoseCloneError(errorOutput);
          resolve({
            success: false,
            message: diagnosed,
          });
        }
      });
    });
  },

  // Abort an active clone process tree
  async abortClone(cloneId: string): Promise<{ success: boolean; message: string }> {
    const child = activeCloneProcesses.get(cloneId);
    if (!child) {
      return { success: false, message: '未找到正在进行的克隆任务' };
    }
    activeCloneProcesses.delete(cloneId);
    await killProcessTree(child);
    return { success: true, message: '克隆任务已成功中止' };
  },

  // Clone a remote Git repository into local directory (wraps cloneRepoStream)
  async cloneRepo(
    remoteUrl: string,
    targetDir: string,
    options?: {
      branch?: string;
      username?: string;
      password?: string;
      cloneId?: string;
    }
  ): Promise<{
    success: boolean;
    message: string;
    repoPath?: string;
    repoName?: string;
    currentBranch?: string;
  }> {
    return gitWorkspaceCloneOps.cloneRepoStream(remoteUrl, targetDir, options);
  },

  // Open native Windows folder selection dialog
  selectLocalFolder(initialPath?: string): Promise<{ success: boolean; folderPath?: string }> {
    return new Promise((resolve) => {
      const initDir = initialPath && fs.existsSync(initialPath) ? initialPath.replace(/'/g, "''") : '';
      const psCommand = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '选择本地文件夹 (Select Folder)'; $f.ShowNewFolderButton = $true; ${initDir ? `$f.SelectedPath = '${initDir}';` : ''} $t = New-Object System.Windows.Forms.Form; $t.TopMost = $true; if ($f.ShowDialog($t) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output $f.SelectedPath }`;

      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand],
        { encoding: 'utf8', windowsHide: false, timeout: 120000 },
        (err, stdout) => {
          if (err) {
            return resolve({ success: false });
          }
          const selected = stdout ? stdout.trim().split(/\r?\n/).pop()?.trim() : '';
          if (selected && fs.existsSync(selected)) {
            return resolve({ success: true, folderPath: selected });
          }
          return resolve({ success: false });
        }
      );
    });
  },

  // Search code across files in repository using high-performance git grep with fallback
  async searchCode(
    repoPath: string,
    query: string,
    options: SearchCodeOptions = {}
  ): Promise<SearchCodeMatch[]> {
    if (!query || !query.trim()) return [];

    const maxResults = options.maxResults || 300;
    const gitDir = path.join(repoPath, '.git');

    if (fs.existsSync(gitDir)) {
      try {
        const gitArgs = ['grep', '-n', '-I', '--untracked'];
        if (!options.isCaseSensitive) {
          gitArgs.push('-i');
        }
        if (options.isWholeWord) {
          gitArgs.push('-w');
        }
        if (options.isRegex) {
          gitArgs.push('-E');
        } else {
          gitArgs.push('-F');
        }
        gitArgs.push('-e', query);

        if (options.filePattern && options.filePattern.trim()) {
          gitArgs.push('--');
          const patterns = options.filePattern.split(',').map((p) => p.trim()).filter(Boolean);
          for (const pat of patterns) {
            gitArgs.push(pat);
          }
        }

        const matches: SearchCodeMatch[] = [];

        try {
          const lsRes = await runGit(['ls-files', '--cached', '--others', '--exclude-standard'], repoPath);
          if (lsRes.code === 0 && lsRes.stdout) {
            const files = lsRes.stdout.split('\n');
            const lowerQuery = query.toLowerCase();
            for (const f of files) {
              if (matches.length >= maxResults) break;
              const cleanF = decodeGitPath(f.trim());
              if (!cleanF) continue;
              const { fileName: baseName, forwardPath: relForwardPath } = splitGitPath(cleanF);

              if (options.filePattern && options.filePattern.trim()) {
                const patterns = options.filePattern.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
                const lowerName = baseName.toLowerCase();
                const matchedPat = patterns.some((p) => {
                  if (p.startsWith('*.')) return lowerName.endsWith(p.substring(1));
                  if (p.startsWith('.')) return lowerName.endsWith(p);
                  return lowerName.includes(p);
                });
                if (!matchedPat) continue;
              }

              let isNameMatch = false;
              if (options.isRegex) {
                try {
                  const r = new RegExp(query, options.isCaseSensitive ? '' : 'i');
                  isNameMatch = r.test(baseName);
                } catch {}
              } else if (options.isWholeWord) {
                const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const r = new RegExp(`\\b${escaped}\\b`, options.isCaseSensitive ? '' : 'i');
                isNameMatch = r.test(baseName);
              } else if (options.isCaseSensitive) {
                isNameMatch = baseName.includes(query);
              } else {
                isNameMatch = baseName.toLowerCase().includes(lowerQuery);
              }

              if (isNameMatch) {
                const fullPath = path.join(repoPath, cleanF);
                let mStart = 0;
                if (options.isCaseSensitive) {
                  mStart = baseName.indexOf(query);
                } else {
                  mStart = baseName.toLowerCase().indexOf(lowerQuery);
                }
                if (mStart < 0) mStart = 0;

                matches.push({
                  filePath: fullPath,
                  relativePath: relForwardPath,
                  fileName: baseName,
                  lineNumber: 1,
                  lineContent: baseName,
                  matchStart: mStart,
                  matchLength: query.length,
                  isFileNameMatch: true,
                });
              }
            }
          }
        } catch {}

        const res = await runGit(gitArgs, repoPath);
        if (res.code === 0 && res.stdout) {
          const lines = res.stdout.split('\n');

          for (const rawLine of lines) {
            if (matches.length >= maxResults) break;
            if (!rawLine.trim()) continue;

            const firstColon = rawLine.indexOf(':');
            if (firstColon === -1) continue;
            const secondColon = rawLine.indexOf(':', firstColon + 1);
            if (secondColon === -1) continue;

            const rawRelPath = rawLine.slice(0, firstColon);
            const { fileName, forwardPath: relPath } = splitGitPath(rawRelPath);
            const lineNumStr = rawLine.slice(firstColon + 1, secondColon);
            const lineContent = rawLine.slice(secondColon + 1);
            const lineNum = parseInt(lineNumStr, 10);
            if (isNaN(lineNum)) continue;

            const fullPath = path.resolve(repoPath, relPath);

            let matchStart = -1;
            const matchLength = query.length;
            if (options.isCaseSensitive) {
              matchStart = lineContent.indexOf(query);
            } else {
              matchStart = lineContent.toLowerCase().indexOf(query.toLowerCase());
            }

            matches.push({
              filePath: fullPath,
              relativePath: relPath,
              fileName,
              lineNumber: lineNum,
              lineContent: lineContent.slice(0, 300),
              matchStart: matchStart >= 0 ? matchStart : 0,
              matchLength,
            });
          }
        }

        if (matches.length > 0) {
          return matches;
        }
      } catch (err) {
        console.warn('[GitService] git grep failed, falling back to fileSystemService.searchCode:', err);
      }
    }

    return fileSystemService.searchCode(repoPath, query, options);
  },
};
