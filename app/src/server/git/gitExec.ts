import { execFile, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { splitGitPath } from '../../utils/gitPathUtils';
import type {
  ConflictBlockInfo,
  OutgoingCommitFile,
  OutgoingCommitItem,
} from '../gitTypes';

export interface CloneProgressEvent {
  phase: 'counting' | 'compressing' | 'receiving' | 'resolving' | 'checkout' | 'completing' | 'unknown';
  phaseText: string;
  percent: number;
  stagePercent?: number;
  transferred?: string;
  speed?: string;
  objects?: string;
  raw: string;
}

export const activeCloneProcesses = new Map<string, ChildProcess>();

export function killProcessTree(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!child || !child.pid) return resolve();
    const pid = child.pid;
    if (process.platform === 'win32') {
      execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => resolve());
    } else {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {}
      }
      resolve();
    }
  });
}

export function parseGitProgress(line: string): CloneProgressEvent | null {
  const clean = line.trim();
  if (!clean) return null;

  // 1. Receiving objects (the bulk of the clone, 20% ~ 85%)
  const receivingMatch = clean.match(/Receiving objects:\s+(\d+)%(?:\s+\((\d+\/\d+)\))?(?:,\s+([0-9.]+\s+[KMGT]?i?B))?(?:\s+\|\s+([0-9.]+\s+[KMGT]?i?B\/s))?/i);
  if (receivingMatch) {
    const stageP = parseInt(receivingMatch[1], 10) || 0;
    const overall = Math.min(85, Math.max(20, Math.round(20 + stageP * 0.65)));
    return {
      phase: 'receiving',
      phaseText: '正在下载对象与历史数据 (Receiving objects)',
      percent: overall,
      stagePercent: stageP,
      objects: receivingMatch[2],
      transferred: receivingMatch[3],
      speed: receivingMatch[4],
      raw: clean,
    };
  }

  // 2. Resolving deltas (85% ~ 95%)
  const deltasMatch = clean.match(/Resolving deltas:\s+(\d+)%(?:\s+\((\d+\/\d+)\))?/i);
  if (deltasMatch) {
    const stageP = parseInt(deltasMatch[1], 10) || 0;
    const overall = Math.min(95, Math.max(85, Math.round(85 + stageP * 0.1)));
    return {
      phase: 'resolving',
      phaseText: '正在解压与重构差异 (Resolving deltas)',
      percent: overall,
      stagePercent: stageP,
      objects: deltasMatch[2],
      raw: clean,
    };
  }

  // 3. Updating / checking out files (95% ~ 99%)
  const updatingMatch = clean.match(/(?:Updating files|Checking out files):\s+(\d+)%(?:\s+\((\d+\/\d+)\))?/i);
  if (updatingMatch) {
    const stageP = parseInt(updatingMatch[1], 10) || 0;
    const overall = Math.min(99, Math.max(95, Math.round(95 + stageP * 0.04)));
    return {
      phase: 'checkout',
      phaseText: '正在检出工作区文件 (Checking out files)',
      percent: overall,
      stagePercent: stageP,
      objects: updatingMatch[2],
      raw: clean,
    };
  }

  // 4. Compressing objects (10% ~ 20%)
  const compressMatch = clean.match(/Compressing objects:\s+(\d+)%(?:\s+\((\d+\/\d+)\))?/i);
  if (compressMatch) {
    const stageP = parseInt(compressMatch[1], 10) || 0;
    const overall = Math.min(20, Math.max(10, Math.round(10 + stageP * 0.1)));
    return {
      phase: 'compressing',
      phaseText: '正在压缩数据 (Compressing objects)',
      percent: overall,
      stagePercent: stageP,
      objects: compressMatch[2],
      raw: clean,
    };
  }

  // 5. Counting objects (0% ~ 10%)
  const countingMatch = clean.match(/Counting objects:\s+(\d+)%(?:\s+\((\d+\/\d+)\))?/i);
  if (countingMatch) {
    const stageP = parseInt(countingMatch[1], 10) || 0;
    const overall = Math.min(10, Math.max(0, Math.round(stageP * 0.1)));
    return {
      phase: 'counting',
      phaseText: '正在计算对象 (Counting objects)',
      percent: overall,
      stagePercent: stageP,
      objects: countingMatch[2],
      raw: clean,
    };
  }

  if (/Cloning into/i.test(clean)) {
    return {
      phase: 'counting',
      phaseText: '正在初始化克隆 (Initializing clone)',
      percent: 2,
      raw: clean,
    };
  }

  return null;
}

export function diagnoseCloneError(errorText: string): string {
  if (!errorText) return '克隆操作失败 / Clone failed';

  if (
    /Authentication failed for/i.test(errorText) ||
    /could not read (?:Username|Password)/i.test(errorText) ||
    /Invalid username or password/i.test(errorText) ||
    /remote:\s*HTTP Basic:\s*Access denied/i.test(errorText) ||
    /fatal:\s*Authentication failed/i.test(errorText) ||
    /fatal:\s*remote error:\s*GitLab:\s*API is not accessible/i.test(errorText) ||
    /\bHTTP\s+(?:401|403)\b/i.test(errorText) ||
    /\bstatus\s*(?:401|403)\b/i.test(errorText)
  ) {
    return '远端仓库认证失败 (Authentication failed): 请检查账号密码、Personal Access Token 或仓库访问权限';
  }

  if (/Could not resolve host/i.test(errorText)) {
    return '无法解析远端服务器域名 (Could not resolve host): 请检查网络连接、公司 VPN 或仓库 URL';
  }

  if (/Repository not found|remote:\s*Not Found|\bHTTP\s+404\b/i.test(errorText)) {
    return '远端仓库未找到 (Repository not found): 请核对仓库 URL 是否正确，或当前账号无权访问该私有仓库';
  }

  if (/already exists and is not an empty directory/i.test(errorText)) {
    return '目标文件夹已存在且不为空，无法克隆至该目录';
  }

  if (/Connection timed out|operation timed out|Failed to connect to/i.test(errorText)) {
    return '连接远端服务器超时 (Connection timed out): 请检查网络代理或服务器状态';
  }

  if (/SSL certificate problem|certificate has expired/i.test(errorText)) {
    return 'SSL 证书验证失败: 远端服务器证书不受信任或已过期';
  }

  const fatalLine = errorText.split(/[\r\n]+/).find((l) => /^fatal:\s*/i.test(l.trim()));
  if (fatalLine) {
    return fatalLine.trim();
  }

  return errorText.slice(0, 300);
}

export function parseGitLogBatchOutput(raw: string): { commits: OutgoingCommitItem[]; allFiles: OutgoingCommitFile[] } {
  const commits: OutgoingCommitItem[] = [];
  const commitsMap = new Map<string, OutgoingCommitItem>();
  const allFilesMap = new Map<string, OutgoingCommitFile>();
  const chunks = raw.split('\x1e').map((c) => c.trim()).filter(Boolean);

  for (const chunk of chunks) {
    const unitSepIdx = chunk.indexOf('\x1f');
    if (unitSepIdx === -1) continue;

    const header = chunk.slice(0, unitSepIdx).trim();
    const filesSection = chunk.slice(unitSepIdx + 1).trim();

    const parts = header.split('\x00');
    let hash = '';
    let shortHash = '';
    let authorName = '';
    let authorEmail = '';
    let date = '';
    let subject = '';
    let body = '';
    let isMerge = false;

    if (parts.length >= 8) {
      [hash, shortHash, authorName, authorEmail, date, subject] = parts;
      const parentsStr = parts[6] || '';
      body = parts[7] || '';
      const parents = parentsStr.trim().split(/\s+/).filter(Boolean);
      isMerge = parents.length > 1 || subject.toLowerCase().startsWith('merge ');
    } else if (parts.length >= 6) {
      [hash, shortHash, authorName, authorEmail, date, subject, body = ''] = parts;
      isMerge = subject.toLowerCase().startsWith('merge ');
    } else {
      continue;
    }

    const files: OutgoingCommitFile[] = [];
    if (filesSection) {
      const lines = filesSection.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const segs = line.split(/\t+/);
        if (segs.length >= 2) {
          const statusCode = segs[0];
          const rawFilePath = segs[segs.length - 1];
          const { fileName, dirPath, forwardPath } = splitGitPath(rawFilePath);

          let status: OutgoingCommitFile['status'] = 'modified';
          if (statusCode.startsWith('A')) status = 'added';
          else if (statusCode.startsWith('D')) status = 'deleted';
          else if (statusCode.startsWith('R')) status = 'renamed';

          const fileObj: OutgoingCommitFile = {
            path: forwardPath,
            fileName,
            dirPath,
            status,
            statusCode,
          };
          files.push(fileObj);
          allFilesMap.set(forwardPath, fileObj);
        }
      }
    }

    const existing = commitsMap.get(hash);
    if (existing) {
      const existingPaths = new Set(existing.files.map((f) => f.path));
      for (const f of files) {
        if (!existingPaths.has(f.path)) {
          existing.files.push(f);
          existingPaths.add(f.path);
        }
      }
    } else {
      const commitObj: OutgoingCommitItem = {
        hash,
        shortHash,
        subject,
        body: body.trim(),
        authorName,
        authorEmail,
        date,
        files,
        isMerge,
      };
      commitsMap.set(hash, commitObj);
      commits.push(commitObj);
    }
  }

  return { commits, allFiles: Array.from(allFilesMap.values()) };
}

export interface RepoWatcherEntry {
  watcher: fs.FSWatcher | null;
  callbacks: Set<() => void>;
  debounceTimer: NodeJS.Timeout | null;
}
export const repoWatchers = new Map<string, RepoWatcherEntry>();

const REMOTE_GIT_COMMANDS = new Set(['pull', 'push', 'fetch', 'clone', 'ls-remote']);
const MAX_LOCAL_GIT_CONCURRENCY = 8;
const MAX_REMOTE_GIT_CONCURRENCY = 4;
let activeLocalGitCount = 0;
let activeRemoteGitCount = 0;
const localGitWaitQueue: Array<() => void> = [];
const remoteGitWaitQueue: Array<() => void> = [];

function isRemoteGitCommand(args: string[]): boolean {
  for (const arg of args) {
    if (REMOTE_GIT_COMMANDS.has(arg)) return true;
  }
  return false;
}

function acquireGitSlot(isRemote: boolean): Promise<() => void> {
  return new Promise((resolve) => {
    const release = () => {
      if (isRemote) {
        activeRemoteGitCount = Math.max(0, activeRemoteGitCount - 1);
        const next = remoteGitWaitQueue.shift();
        if (next) next();
      } else {
        activeLocalGitCount = Math.max(0, activeLocalGitCount - 1);
        const next = localGitWaitQueue.shift();
        if (next) next();
      }
    };

    if (isRemote) {
      if (activeRemoteGitCount < MAX_REMOTE_GIT_CONCURRENCY) {
        activeRemoteGitCount++;
        resolve(release);
      } else {
        remoteGitWaitQueue.push(() => {
          activeRemoteGitCount++;
          resolve(release);
        });
      }
    } else {
      if (activeLocalGitCount < MAX_LOCAL_GIT_CONCURRENCY) {
        activeLocalGitCount++;
        resolve(release);
      } else {
        localGitWaitQueue.push(() => {
          activeLocalGitCount++;
          resolve(release);
        });
      }
    }
  });
}

export async function runGit(
  args: string[],
  cwd?: string,
  timeout = 120000
): Promise<{ stdout: string; stderr: string; code: number }> {
  const isRemote = isRemoteGitCommand(args);
  const releaseSlot = await acquireGitSlot(isRemote);

  return new Promise((resolve) => {
    const gitArgs = args.includes('core.quotepath=false')
      ? args
      : ['-c', 'core.quotepath=false', ...args];

    execFile(
      'git',
      gitArgs,
      {
        cwd: cwd || process.cwd(),
        maxBuffer: 50 * 1024 * 1024,
        encoding: 'utf8',
        windowsHide: true,
        timeout,
        env: {
          ...process.env,
          GIT_OPTIONAL_LOCKS: '0',
        },
      },
      (error, stdout, stderr) => {
        releaseSlot();
        let cleanStdout = stdout ? stdout.replace(/\r?\n$/, '') : '';
        let cleanStderr = stderr ? stderr.replace(/\r?\n$/, '') : '';

        if (error && !cleanStderr) {
          if ((error as any).killed) {
            cleanStderr = `Git 操作执行超时 (${Math.round(timeout / 1000)} 秒)，系统已强制中止，请检查是否存在冲突或数据量过大`;
          } else if (error.message) {
            const rawMsg = error.message.replace(/^Command failed: [^\r\n]+\r?\n?/, '').trim();
            cleanStderr = rawMsg || error.message;
          }
        }

        resolve({
          stdout: cleanStdout,
          stderr: cleanStderr,
          code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        });
      }
    );
  });
}

export function hasGitConflictMarkers(text: string): boolean {
  if (!text || (!text.includes('<<<<<<<') && !text.includes('======='))) return false;
  if (/(?:^|\r?\n)<<<<<<< [^\r\n]*\r?\n[\s\S]*?(?:^|\r?\n)=======(?:\r?\n)[\s\S]*?(?:^|\r?\n)>>>>>>> [^\r\n]*/m.test(text)) {
    return true;
  }
  const lines = text.split(/\r?\n/);
  let hasStart = false;
  for (const line of lines) {
    if (line.startsWith('<<<<<<< ') || line.startsWith('<<<<<<<HEAD') || line.startsWith('<<<<<<< HEAD')) {
      hasStart = true;
    } else if (hasStart && (line === '=======' || line.startsWith('======='))) {
      return true;
    }
  }
  return false;
}

let cachedSysCreds: { timestamp: number; data: Array<{ target: string; host: string; username: string }> } | null = null;
const SYS_CREDS_CACHE_TTL_MS = 60_000;

export function getSystemGitCredentials(): Promise<Array<{ target: string; host: string; username: string }>> {
  if (cachedSysCreds && Date.now() - cachedSysCreds.timestamp < SYS_CREDS_CACHE_TTL_MS) {
    return Promise.resolve(cachedSysCreds.data);
  }
  return new Promise((resolve) => {
    const credentials: Array<{ target: string; host: string; username: string }> = [];

    try {
      const gitCredFile = path.join(process.env.USERPROFILE || process.env.HOME || '', '.git-credentials');
      if (fs.existsSync(gitCredFile)) {
        const content = fs.readFileSync(gitCredFile, 'utf8');
        for (const line of content.split(/\r?\n/)) {
          const m = line.match(/https?:\/\/([^:]+):([^@]+)@([^/:]+)/);
          if (m) {
            credentials.push({ target: `git:https://${m[3]}`, host: m[3], username: m[1] });
          }
        }
      }
    } catch {}

    if (process.platform === 'win32') {
      execFile('cmdkey', ['/list'], { encoding: 'utf8', windowsHide: true }, (error, stdout) => {
        if (!error && stdout) {
          const lines = stdout.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let target = '';
            let host = '';
            const gitMatch = line.match(/(?:target=)?(git:https?:\/\/([^\s\r\n/]+)[^\s\r\n]*)/i);
            if (gitMatch) {
              target = gitMatch[1];
              host = gitMatch[2];
            } else {
              const ghMatch = line.match(/(?:target=)?(?:GitHub\s*-\s*)?https?:\/\/([^\s\r\n/]+)[^\s\r\n]*/i);
              if (ghMatch && (line.toLowerCase().includes('github') || line.toLowerCase().includes('git'))) {
                target = line.trim();
                host = ghMatch[1].replace(/^api\./i, '');
              }
            }
            if (target && host) {
              let username = '';
              for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
                const nextLine = lines[j];
                if (nextLine.includes('target=') || nextLine.includes('目标:')) break;
                const uMatch = nextLine.match(/:\s*([^\s\r\n]+)$/);
                if (uMatch) {
                  username = uMatch[1].trim();
                  break;
                }
              }
              if (host && username && !credentials.some((c) => c.host.toLowerCase() === host.toLowerCase() && c.username.toLowerCase() === username.toLowerCase())) {
                credentials.push({ target, host, username });
              }
            }
          }
        }
        cachedSysCreds = { timestamp: Date.now(), data: credentials };
        resolve(credentials);
      });
    } else {
      cachedSysCreds = { timestamp: Date.now(), data: credentials };
      resolve(credentials);
    }
  });
}

export function parseConflictMarkers(
  content: string,
  baseContent?: string
): {
  blocks: ConflictBlockInfo[];
  cleanResult: string;
  reconstructedYours: string;
  reconstructedTheirs: string;
} {
  const blocks: ConflictBlockInfo[] = [];
  const lines = content.split(/\r?\n/);
  let inConflict = false;
  let inBase = false;
  let startLine = 0;
  let midLine = 0;
  let yoursBranch = 'HEAD';
  let theirsBranch = 'incoming';
  let curYoursLines: string[] = [];
  let curBaseLines: string[] = [];
  let curTheirsLines: string[] = [];
  let isTheirsSection = false;

  const cleanLines: string[] = [];
  const yLines: string[] = [];
  const tLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (line.startsWith('<<<<<<<')) {
      inConflict = true;
      inBase = false;
      startLine = lineNum;
      yoursBranch = line.slice(7).trim() || 'HEAD';
      curYoursLines = [];
      curBaseLines = [];
      curTheirsLines = [];
      isTheirsSection = false;
    } else if (inConflict && line.startsWith('|||||||')) {
      inBase = true;
    } else if (inConflict && line.startsWith('=======')) {
      midLine = lineNum;
      inBase = false;
      isTheirsSection = true;
    } else if (inConflict && line.startsWith('>>>>>>>')) {
      const endLine = lineNum;
      theirsBranch = line.slice(7).trim() || 'incoming';

      let baseText = curBaseLines.join('\n');
      if (!baseText && baseContent) {
        const normBase = baseContent.replace(/\r\n/g, '\n');
        const beforeLines = lines.slice(Math.max(0, startLine - 3), startLine - 1).filter((l) => l.trim().length > 0);
        const afterLines = lines.slice(endLine, Math.min(lines.length, endLine + 2)).filter((l) => l.trim().length > 0);
        if (beforeLines.length > 0 || afterLines.length > 0) {
          const beforeStr = beforeLines.join('\n');
          const afterStr = afterLines.join('\n');
          const bIdx = beforeStr ? normBase.indexOf(beforeStr) : 0;
          if (bIdx !== -1) {
            const searchFrom = bIdx + beforeStr.length;
            const aIdx = afterStr ? normBase.indexOf(afterStr, searchFrom) : normBase.length;
            if (aIdx !== -1 && aIdx >= searchFrom) {
              baseText = normBase.slice(searchFrom, aIdx).trim();
            }
          }
        }
      }

      const leftStartLine = yLines.length + 1;
      yLines.push(...curYoursLines);
      const leftEndLine = Math.max(leftStartLine, yLines.length);

      const rightStartLine = tLines.length + 1;
      tLines.push(...curTheirsLines);
      const rightEndLine = Math.max(rightStartLine, tLines.length);

      const resultStartLine = cleanLines.length + 1;
      const baseLineArr = baseText ? baseText.split(/\r?\n/) : [];
      cleanLines.push(...baseLineArr);
      const resultEndLine = Math.max(resultStartLine, cleanLines.length);

      blocks.push({
        id: blocks.length + 1,
        startLine,
        midLine: midLine || startLine,
        endLine,
        yoursText: curYoursLines.join('\n'),
        theirsText: curTheirsLines.join('\n'),
        baseText,
        yoursBranch,
        theirsBranch,
        resultStartLine,
        resultEndLine,
        leftStartLine,
        leftEndLine,
        rightStartLine,
        rightEndLine,
      });

      inConflict = false;
      inBase = false;
    } else if (inConflict) {
      if (inBase) {
        curBaseLines.push(line);
      } else if (isTheirsSection) {
        curTheirsLines.push(line);
      } else {
        curYoursLines.push(line);
      }
    } else {
      cleanLines.push(line);
      yLines.push(line);
      tLines.push(line);
    }
  }

  return {
    blocks,
    cleanResult: cleanLines.join('\n'),
    reconstructedYours: yLines.join('\n'),
    reconstructedTheirs: tLines.join('\n'),
  };
}
