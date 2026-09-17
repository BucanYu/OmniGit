import { execFile, exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface RepoWatcherEntry {
  watcher: fs.FSWatcher | null;
  callbacks: Set<() => void>;
  debounceTimer: NodeJS.Timeout | null;
}
const repoWatchers = new Map<string, RepoWatcherEntry>();

function runGit(
  args: string[],
  cwd?: string,
  timeout = 120000
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      {
        cwd: cwd || process.cwd(),
        maxBuffer: 50 * 1024 * 1024,
        encoding: 'utf8',
        windowsHide: true,
        timeout,
      },
      (error, stdout, stderr) => {
        let cleanStdout = stdout ? stdout.replace(/\r?\n$/, '') : '';
        let cleanStderr = stderr ? stderr.replace(/\r?\n$/, '') : '';

        // Extract detailed and informative diagnostics when error is encountered
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

function getSystemGitCredentials(): Promise<Array<{ target: string; host: string; username: string }>> {
  return new Promise((resolve) => {
    const credentials: Array<{ target: string; host: string; username: string }> = [];

    // 1. Check ~/.git-credentials file if exists
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

    // 2. Query Windows Credential Manager on Windows
    if (process.platform === 'win32') {
      execFile('cmdkey', ['/list'], { encoding: 'utf8' }, (error, stdout) => {
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
        resolve(credentials);
      });
    } else {
      resolve(credentials);
    }
  });
}

export interface GitUserInfo {
  name: string;
  email: string;
}

export interface GitAuthorItem {
  name: string;
  email: string;
  commitCount: number;
  isCurrent: boolean;
}

export interface WorkspaceGitAccount {
  id: string;
  name: string;
  email: string;
  username?: string;
  remoteHost?: string;
  remoteUrl?: string;
  projectPaths: string[];
  projectNames: string[];
  isCurrent: boolean;
  hasPassword?: boolean;
  source: 'project' | 'credential' | 'custom' | 'global';
}

export interface RealGitFile {
  path: string;
  fileName: string;
  dirPath: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'conflict';
  group: 'changes' | 'unversioned' | 'conflict';
  checked: boolean;
}

export interface RealBranchInfo {
  name: string;
  isCurrent: boolean;
  isFavorite: boolean;
  upstream?: string;
  incoming: number;
  outgoing: number;
  category: 'recent' | 'local' | 'remote';
}

export interface RealRepoStatus {
  repoPath: string;
  repoName: string;
  currentBranch: string;
  upstream?: string;
  incoming: number;
  outgoing: number;
  files: RealGitFile[];
  isMerging?: boolean;
  mergeMessage?: string;
  mergeSourceBranch?: string;
  conflictedCount?: number;
}

export interface ConflictBlockInfo {
  id: number;
  startLine: number;
  midLine: number;
  endLine: number;
  yoursText: string;
  theirsText: string;
  baseText?: string;
  yoursBranch: string;
  theirsBranch: string;
  resultStartLine?: number;
  resultEndLine?: number;
  leftStartLine?: number;
  leftEndLine?: number;
  rightStartLine?: number;
  rightEndLine?: number;
}

export interface Conflict3WayData {
  filePath: string;
  repoPath: string;
  yours: string;
  theirs: string;
  base: string;
  result: string;
  cleanResult?: string;
  conflictBlocks: ConflictBlockInfo[];
}

export interface GitCommitItem {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  refs: string;
  message: string;
}

export interface GitCommitFileChange {
  path: string;
  oldPath?: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'unknown';
  statusCode: string;
  additions?: number;
  deletions?: number;
}

export interface GitCommitDetails {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  authorDate: string;
  committerName: string;
  committerEmail: string;
  committerDate: string;
  subject: string;
  body: string;
  parents: string[];
  refs: string;
  files: GitCommitFileChange[];
}

export interface OutgoingCommitFile {
  path: string;
  fileName: string;
  dirPath: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'unknown';
  statusCode: string;
}

export interface OutgoingCommitItem {
  hash: string;
  shortHash: string;
  subject: string;
  body: string;
  authorName: string;
  authorEmail: string;
  date: string;
  files: OutgoingCommitFile[];
}

export interface OutgoingCommitsData {
  sourceBranch: string;
  targetBranch: string;
  remote: string;
  commits: OutgoingCommitItem[];
  allFiles: OutgoingCommitFile[];
}

export interface PushBranchOptions {
  branch: string;
  force?: boolean;
  tags?: boolean;
  setUpstream?: boolean;
}

// OmniGit Global Settings & Custom Cache Configuration
export interface OmniGitSettings {
  cacheDir: string;
  maxCacheRepos: number;
  cacheTTL: number;
}

function getConfigFile(): string {
  const candidate1 = path.resolve(process.cwd(), '.omnigit_config.json');
  const candidate2 = path.resolve(process.cwd(), '..', '.omnigit_config.json');
  if (fs.existsSync(candidate2)) return candidate2;
  if (fs.existsSync(candidate1)) return candidate1;
  return candidate2;
}

function loadSettings(): OmniGitSettings {
  const configFile = getConfigFile();
  const defaultDir = 'D:\\OmniGitCache';
  try {
    if (fs.existsSync(configFile)) {
      const raw = fs.readFileSync(configFile, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        cacheDir: parsed.cacheDir || defaultDir,
        maxCacheRepos: parsed.maxCacheRepos || 30,
        cacheTTL: parsed.cacheTTL || 15000,
      };
    }
  } catch (err) {
    console.warn('[gitService] Failed to read settings config:', err);
  }
  return {
    cacheDir: defaultDir,
    maxCacheRepos: 30,
    cacheTTL: 15000,
  };
}

function saveSettings(settings: OmniGitSettings): void {
  const configFile = getConfigFile();
  try {
    fs.writeFileSync(configFile, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('[gitService] Failed to write settings config:', err);
  }
}

function getRepoSnapshotPath(cacheDir: string, repoPath: string): string {
  const clean = repoPath.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_').slice(-60);
  const hash = Buffer.from(repoPath.toLowerCase()).toString('base64').replace(/[/+=]/g, '').slice(0, 16);
  const snapshotsDir = path.join(cacheDir, 'snapshots');
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true });
  }
  return path.join(snapshotsDir, `${clean}_${hash}.json`);
}

export const gitService = {
  // 1. Get current Git user configuration (supports repo-specific local config & credential match)
  async getUserInfo(repoPath?: string): Promise<GitUserInfo> {
    if (repoPath && fs.existsSync(repoPath)) {
      const [localNameRes, localEmailRes] = await Promise.all([
        runGit(['config', '--local', 'user.name'], repoPath),
        runGit(['config', '--local', 'user.email'], repoPath),
      ]);
      let name = localNameRes.stdout.trim();
      let email = localEmailRes.stdout.trim();

      if (!name || !email) {
        // Try remote credential and commit history matching
        const [remoteUrlRes, creds] = await Promise.all([
          runGit(['config', '--get', 'remote.origin.url'], repoPath),
          getSystemGitCredentials(),
        ]);
        const remoteUrl = remoteUrlRes.stdout.trim();
        let remoteHost = '';
        if (remoteUrl) {
          const sshMatch = remoteUrl.match(/@([^/:]+):/);
          const httpMatch = remoteUrl.match(/https?:\/\/(?:([^:@]+)(?::([^@]+))?@)?([^/:]+)/i);
          if (sshMatch) remoteHost = sshMatch[1];
          else if (httpMatch) remoteHost = httpMatch[3];
        }
        const matchedCred = creds.find(
          (c) => remoteHost && c.host.toLowerCase() === remoteHost.toLowerCase()
        );
        if (matchedCred) {
          const logRes = await runGit(['log', '-n', '1', `--author=${matchedCred.username}`, '--format=%an|%ae'], repoPath);
          if (logRes.code === 0 && logRes.stdout.includes('|')) {
            const [logAuthor, logEmail] = logRes.stdout.trim().split('|');
            if (!name && logAuthor) name = logAuthor;
            if (!email && logEmail) email = logEmail;
          }
          if (!email && matchedCred.username.includes('@')) email = matchedCred.username;
          if (!name && matchedCred.username) name = matchedCred.username.replace(/@.*$/, '');
        }
      }

      if (name) {
        return { name, email: email || '' };
      }
    }

    const [nameRes, emailRes] = await Promise.all([
      runGit(['config', '--get', 'user.name'], repoPath),
      runGit(['config', '--get', 'user.email'], repoPath),
    ]);
    return {
      name: nameRes.stdout || 'Git User',
      email: emailRes.stdout || '',
    };
  },

  // Helper to get fast sync status (branch, upstream, incoming, outgoing) for a repo
  async getSingleRepoSync(repoPath: string): Promise<{ path: string; currentBranch: string; upstream?: string; incoming: number; outgoing: number }> {
    try {
      const branchRes = await runGit(['branch', '--show-current'], repoPath);
      const currentBranch = branchRes.stdout || 'main';
      const upstreamRes = await runGit(['rev-parse', '--abbrev-ref', '@{upstream}'], repoPath);
      const upstream = upstreamRes.code === 0 && upstreamRes.stdout ? upstreamRes.stdout : undefined;
      let incoming = 0;
      let outgoing = 0;
      if (upstream) {
        const countsRes = await runGit(['rev-list', '--left-right', '--count', `HEAD...${upstream}`], repoPath);
        if (countsRes.code === 0 && countsRes.stdout) {
          const parts = countsRes.stdout.trim().split(/\s+/);
          outgoing = parseInt(parts[0], 10) || 0;
          incoming = parseInt(parts[1], 10) || 0;
        }
      }
      return { path: repoPath, currentBranch, upstream, incoming, outgoing };
    } catch {
      return { path: repoPath, currentBranch: 'main', upstream: undefined, incoming: 0, outgoing: 0 };
    }
  },

  // Batch query sync status for multiple workspace repository paths
  async getBatchSyncStatus(paths: string[]): Promise<Array<{ path: string; currentBranch: string; upstream?: string; incoming: number; outgoing: number }>> {
    const validPaths = paths.filter((p) => p && fs.existsSync(p));
    return Promise.all(validPaths.map((p) => this.getSingleRepoSync(p)));
  },

  // 2. Scan projects directory for valid Git repositories
  async scanProjects(baseDir?: string): Promise<Array<{ id: string; name: string; path: string; currentBranch: string; incoming: number; outgoing: number }>> {
    const repos: Array<{ id: string; name: string; path: string }> = [];
    const targetDir = baseDir || (fs.existsSync('D:\\projects') ? 'D:\\projects' : (process.env.USERPROFILE || process.env.HOME || ''));

    // Helper recursive search up to depth 2
    async function checkDir(dir: string, depth: number) {
      if (depth > 2) return;
      try {
        const gitDir = path.join(dir, '.git');
        if (fs.existsSync(gitDir)) {
          repos.push({
            id: String(repos.length + 1),
            name: path.basename(dir),
            path: dir,
          });
          return; // Don't search inside a repo
        }
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await checkDir(path.join(dir, entry.name), depth + 1);
          }
        }
      } catch {
        // Ignore permission or read errors
      }
    }

    if (targetDir && fs.existsSync(targetDir)) {
      await checkDir(targetDir, 0);
    }

    // Enrich all scanned repositories with real-time branch (lightweight & fast)
    const enriched = await Promise.all(
      repos.map(async (r) => {
        let currentBranch = 'main';
        try {
          const bRes = await runGit(['branch', '--show-current'], r.path);
          if (bRes.stdout) currentBranch = bRes.stdout;
        } catch {}
        return {
          ...r,
          currentBranch,
          incoming: 0,
          outgoing: 0,
        };
      })
    );

    return enriched;
  },

  // 3. Get repository status (porcelain + rev-list for incoming/outgoing)
  async getRepoStatus(repoPath: string): Promise<RealRepoStatus> {
    const repoName = path.basename(repoPath);

    // Current branch
    const branchRes = await runGit(['branch', '--show-current'], repoPath);
    const currentBranch = branchRes.stdout || 'HEAD';

    // Upstream tracking
    const upstreamRes = await runGit(['rev-parse', '--abbrev-ref', '@{upstream}'], repoPath);
    const upstream = upstreamRes.code === 0 ? upstreamRes.stdout : undefined;

    // Incoming & Outgoing counts
    let incoming = 0;
    let outgoing = 0;
    if (upstream) {
      const countsRes = await runGit(['rev-list', '--left-right', '--count', `HEAD...${upstream}`], repoPath);
      if (countsRes.code === 0 && countsRes.stdout) {
        const parts = countsRes.stdout.split(/\s+/);
        outgoing = parseInt(parts[0], 10) || 0;
        incoming = parseInt(parts[1], 10) || 0;
      }
    }

    // Git Status
    const statusRes = await runGit(['status', '--porcelain=v1', '-u'], repoPath);
    const files: RealGitFile[] = [];

    if (statusRes.stdout) {
      const lines = statusRes.stdout.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const match = line.match(/^([ MADRCU?]{2})\s+(.*)$/);
        if (!match) continue;
        const code = match[1];
        let rawPath = match[2].trim();
        // Remove quotes if present
        if (rawPath.startsWith('"') && rawPath.endsWith('"')) {
          rawPath = rawPath.slice(1, -1);
        }

        const normalizedPath = rawPath.replace(/\//g, '\\');
        const fileName = path.basename(normalizedPath);
        const dirPath = path.dirname(normalizedPath);

        const isConflict =
          code.includes('U') ||
          code === 'AA' ||
          code === 'DD' ||
          code === 'AU' ||
          code === 'UD' ||
          code === 'UA' ||
          code === 'DU';

        if (isConflict) {
          files.push({
            path: rawPath,
            fileName,
            dirPath: dirPath === '.' ? '' : dirPath,
            status: 'conflict',
            group: 'conflict',
            checked: false,
          });
        } else if (code === '??') {
          files.push({
            path: rawPath,
            fileName,
            dirPath: dirPath === '.' ? '' : dirPath,
            status: 'untracked',
            group: 'unversioned',
            checked: false,
          });
        } else if (code.includes('A')) {
          files.push({
            path: rawPath,
            fileName,
            dirPath: dirPath === '.' ? '' : dirPath,
            status: 'added',
            group: 'changes',
            checked: true,
          });
        } else if (code.includes('D')) {
          files.push({
            path: rawPath,
            fileName,
            dirPath: dirPath === '.' ? '' : dirPath,
            status: 'deleted',
            group: 'changes',
            checked: true,
          });
        } else {
          // 'M ', ' M', 'MM'
          files.push({
            path: rawPath,
            fileName,
            dirPath: dirPath === '.' ? '' : dirPath,
            status: 'modified',
            group: 'changes',
            checked: true,
          });
        }
      }
    }

    // Merge status detection (.git/MERGE_HEAD, .git/REBASE_HEAD, .git/CHERRY_PICK_HEAD)
    const gitDir = path.join(repoPath, '.git');
    const mergeHeadPath = path.join(gitDir, 'MERGE_HEAD');
    const rebaseHeadPath = path.join(gitDir, 'REBASE_HEAD');
    const cherryPickHeadPath = path.join(gitDir, 'CHERRY_PICK_HEAD');
    const hasMergeHead = fs.existsSync(mergeHeadPath);
    const isMerging = hasMergeHead || fs.existsSync(rebaseHeadPath) || fs.existsSync(cherryPickHeadPath);

    let mergeMessage: string | undefined = undefined;
    const mergeMsgPath = path.join(gitDir, 'MERGE_MSG');
    if (fs.existsSync(mergeMsgPath)) {
      try {
        mergeMessage = fs.readFileSync(mergeMsgPath, 'utf8').trim();
      } catch {}
    }

    let mergeSourceBranch: string | undefined = undefined;
    if (hasMergeHead) {
      try {
        const headSha = fs.readFileSync(mergeHeadPath, 'utf8').trim();
        const nameRes = await runGit(['name-rev', '--name-only', headSha], repoPath);
        mergeSourceBranch = nameRes.stdout ? nameRes.stdout.replace(/^remotes\/origin\//, '').replace(/^origin\//, '') : headSha.slice(0, 7);
      } catch {}
    }

    const conflictedCount = files.filter((f) => f.status === 'conflict').length;

    return {
      repoPath,
      repoName,
      currentBranch,
      upstream,
      incoming,
      outgoing,
      files,
      isMerging: isMerging || conflictedCount > 0,
      mergeMessage: mergeMessage || (conflictedCount > 0 ? 'Merge branch conflicts resolved' : undefined),
      mergeSourceBranch,
      conflictedCount,
    };
  },

  // 4. Get all branches
  async getRepoBranches(repoPath: string): Promise<RealBranchInfo[]> {
    const branchesRes = await runGit(['branch', '-a', '-vv'], repoPath);
    const branchList: RealBranchInfo[] = [];

    if (!branchesRes.stdout) return branchList;

    const lines = branchesRes.stdout.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const isCurrent = line.startsWith('*');
      const cleanLine = line.replace('*', '').trim();
      const parts = cleanLine.split(/\s+/);
      const name = parts[0];

      if (!name || name.includes('HEAD')) continue;

      if (name.startsWith('remotes/')) {
        const remoteName = name.replace('remotes/', '');
        branchList.push({
          name: remoteName,
          isCurrent: false,
          isFavorite: false,
          incoming: 0,
          outgoing: 0,
          category: 'remote',
        });
      } else {
        // Extract upstream tracking if present like [origin/dev: ahead 1, behind 2]
        let upstream: string | undefined;
        let incoming = 0;
        let outgoing = 0;

        const bracketMatch = cleanLine.match(/\[(.*?)\]/);
        if (bracketMatch) {
          const bracketContent = bracketMatch[1];
          upstream = bracketContent.split(':')[0].trim();
          if (bracketContent.includes('behind')) {
            const behindMatch = bracketContent.match(/behind (\d+)/);
            if (behindMatch) incoming = parseInt(behindMatch[1], 10);
          }
          if (bracketContent.includes('ahead')) {
            const aheadMatch = bracketContent.match(/ahead (\d+)/);
            if (aheadMatch) outgoing = parseInt(aheadMatch[1], 10);
          }
        }

        branchList.push({
          name,
          isCurrent,
          isFavorite: name === 'dev' || name === 'main' || name === 'master',
          upstream,
          incoming,
          outgoing,
          category: 'recent',
        });
      }
    }

    return branchList;
  },

  // 5. Get file diff
  async getFileDiff(repoPath: string, filePath: string): Promise<{ oldContent: string; newContent: string; isBinary?: boolean }> {
    const ext = path.extname(filePath).toLowerCase();
    const binaryExtensions = new Set([
      '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.tiff', '.tif',
      '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
      '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm', '.parquet',
      '.mp3', '.mp4', '.mov', '.avi', '.flv', '.mkv',
      '.woff', '.woff2', '.ttf', '.eot', '.otf',
      '.pyc', '.class', '.o', '.obj'
    ]);

    const fullPath = path.join(repoPath, filePath);
    let isBinary = binaryExtensions.has(ext);

    if (!isBinary && fs.existsSync(fullPath)) {
      try {
        const stats = fs.statSync(fullPath);
        if (stats.size > 2 * 1024 * 1024) {
          isBinary = true;
        }
      } catch {}
    }

    if (isBinary) {
      return {
        oldContent: `(Binary file / 二进制文件 [${ext || 'binary'}])`,
        newContent: `(Binary file / 二进制文件 [${ext || 'binary'}])`,
        isBinary: true,
      };
    }

    // 1. Get HEAD version
    const headRes = await runGit(['show', `HEAD:${filePath}`], repoPath, 20000);
    const oldContent = headRes.code === 0 ? headRes.stdout : '';

    // 2. Get working copy version
    let newContent = '';
    try {
      if (fs.existsSync(fullPath)) {
        newContent = fs.readFileSync(fullPath, 'utf8');
      }
    } catch {
      newContent = '';
    }

    return { oldContent, newContent, isBinary: false };
  },

  // 6. Save modified file content back to disk
  async saveFileContent(repoPath: string, filePath: string, content: string): Promise<boolean> {
    const fullPath = path.join(repoPath, filePath);
    try {
      fs.writeFileSync(fullPath, content, 'utf8');
      return true;
    } catch {
      return false;
    }
  },

  // 7. Checkout branch
  async checkoutBranch(repoPath: string, branchName: string): Promise<{ success: boolean; message: string }> {
    const res = await runGit(['checkout', branchName], repoPath, 60000);
    const output = (res.stderr || res.stdout || '').trim();
    if (res.code === 0) {
      return {
        success: true,
        message: output || `Switched to branch '${branchName}'`,
      };
    } else {
      return {
        success: false,
        message: output || `切换到分支 '${branchName}' 失败: 未知错误，请检查是否有未提交的代码冲突或文件被占用`,
      };
    }
  },

  // 8. Pull / Update Project
  async pull(repoPath: string): Promise<{ success: boolean; message: string }> {
    const res = await runGit(['pull'], repoPath);
    return {
      success: res.code === 0,
      message: res.stdout || res.stderr,
    };
  },

  // 9. Commit selected files
  async commit(repoPath: string, files: string[], message: string, isAmend = false): Promise<{ success: boolean; message: string }> {
    if (files.length > 0) {
      await runGit(['add', '--', ...files], repoPath);
    }
    const args = ['commit', '-m', message];
    if (isAmend) {
      args.push('--amend');
    }
    const res = await runGit(args, repoPath);
    return {
      success: res.code === 0,
      message: res.stdout || res.stderr,
    };
  },

  // 10. Rollback files
  async rollback(repoPath: string, files: string[]): Promise<{ success: boolean; message: string }> {
    // Restore tracked changes
    const restoreRes = await runGit(['restore', '--staged', '--worktree', '--', ...files], repoPath);
    // If restore is not supported or failed, fallback to checkout
    if (restoreRes.code !== 0) {
      await runGit(['checkout', 'HEAD', '--', ...files], repoPath);
    }
    // Clean untracked files if any
    await runGit(['clean', '-f', '--', ...files], repoPath);
    return {
      success: true,
      message: 'Changes rolled back successfully',
    };
  },

  // 11. Inspect a given folder path (root or subdirectories with .git)
  async inspectFolder(folderPath: string): Promise<Array<{ id: string; name: string; path: string; currentBranch: string; isRoot: boolean }>> {
    const results: Array<{ id: string; name: string; path: string; currentBranch: string; isRoot: boolean }> = [];
    if (!fs.existsSync(folderPath)) {
      return results;
    }

    // Check if folder itself has .git
    if (fs.existsSync(path.join(folderPath, '.git'))) {
      const branchRes = await runGit(['branch', '--show-current'], folderPath);
      results.push({
        id: String(Date.now()),
        name: path.basename(folderPath),
        path: folderPath,
        currentBranch: branchRes.stdout || 'main',
        isRoot: true,
      });
    }

    // Check subdirectories up to depth 2
    async function scanSub(dir: string, depth: number) {
      if (depth > 2) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            const subDir = path.join(dir, entry.name);
            if (fs.existsSync(path.join(subDir, '.git'))) {
              if (!results.some((r) => r.path.toLowerCase() === subDir.toLowerCase())) {
                const branchRes = await runGit(['branch', '--show-current'], subDir);
                results.push({
                  id: String(Date.now() + results.length),
                  name: entry.name,
                  path: subDir,
                  currentBranch: branchRes.stdout || 'main',
                  isRoot: false,
                });
              }
            } else {
              await scanSub(subDir, depth + 1);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    await scanSub(folderPath, 1);
    return results;
  },

  // 12. Get workspace projects' Git login accounts (Deduplicated, project-scoped)
  async getWorkspaceGitAccounts(
    projectPaths: string[] = [],
    activePath?: string
  ): Promise<WorkspaceGitAccount[]> {
    const creds = await getSystemGitCredentials();
    const globalUser = await this.getUserInfo();
    const accountMap = new Map<string, WorkspaceGitAccount>();

    // 1. Scan each project in current workspace
    for (const p of projectPaths) {
      if (!p || !fs.existsSync(p)) continue;
      const gitDir = path.join(p, '.git');
      if (!fs.existsSync(gitDir)) continue;

      const projectName = path.basename(p);
      const isCurrentProject = activePath
        ? path.resolve(p).toLowerCase() === path.resolve(activePath).toLowerCase()
        : false;

      // Local config takes highest precedence, then credentials & commit history, then effective config, then global
      const [localNameRes, localEmailRes, effNameRes, effEmailRes, remoteUrlRes] = await Promise.all([
        runGit(['config', '--local', 'user.name'], p),
        runGit(['config', '--local', 'user.email'], p),
        runGit(['config', 'user.name'], p),
        runGit(['config', 'user.email'], p),
        runGit(['config', '--get', 'remote.origin.url'], p),
      ]);

      let name = localNameRes.stdout.trim();
      let email = localEmailRes.stdout.trim();
      const remoteUrl = remoteUrlRes.stdout || '';

      // Extract host and any embedded username from remoteUrl
      let remoteHost = '';
      let embeddedUser = '';
      if (remoteUrl) {
        const sshMatch = remoteUrl.match(/@([^/:]+):/);
        const httpMatch = remoteUrl.match(/https?:\/\/(?:([^:@]+)(?::([^@]+))?@)?([^/:]+)/i);
        if (sshMatch) {
          remoteHost = sshMatch[1];
        } else if (httpMatch) {
          embeddedUser = httpMatch[1] || '';
          remoteHost = httpMatch[3] || '';
        }
      }

      // Find matched credential by host
      const matchedCred = creds.find(
        (c) => remoteHost && c.host.toLowerCase() === remoteHost.toLowerCase()
      );

      // If local user is missing, check matched credential or commit history
      if (!name || !email) {
        if (matchedCred) {
          const logRes = await runGit(['log', '-n', '1', `--author=${matchedCred.username}`, '--format=%an|%ae'], p);
          if (logRes.code === 0 && logRes.stdout.includes('|')) {
            const [logAuthor, logEmail] = logRes.stdout.trim().split('|');
            if (!name && logAuthor) name = logAuthor;
            if (!email && logEmail) email = logEmail;
          }
          if (!email && matchedCred.username.includes('@')) {
            email = matchedCred.username;
          }
          if (!name && matchedCred.username) {
            name = matchedCred.username.replace(/@.*$/, '');
          }
        }
      }

      // Fallback to effective git config or global user
      if (!name) name = effNameRes.stdout || globalUser.name || 'Git User';
      if (!email) email = effEmailRes.stdout || globalUser.email || '';

      const username = embeddedUser || matchedCred?.username || (email.includes('@') ? email : name);

      // Deduplication key: normalized by email, or username, or name
      const dedupeKey = (email || username || name).toLowerCase().trim();
      if (!dedupeKey) continue;

      if (accountMap.has(dedupeKey)) {
        const existing = accountMap.get(dedupeKey)!;
        if (!existing.projectPaths.includes(p)) {
          existing.projectPaths.push(p);
        }
        if (!existing.projectNames.includes(projectName)) {
          existing.projectNames.push(projectName);
        }
        if (isCurrentProject) {
          existing.isCurrent = true;
        }
        if (!existing.remoteHost && remoteHost) {
          existing.remoteHost = remoteHost;
        }
        if (!existing.remoteUrl && remoteUrl) {
          existing.remoteUrl = remoteUrl;
        }
        if (matchedCred) {
          existing.hasPassword = true;
        }
      } else {
        const normP = p.replace(/\\/g, '/');
        accountMap.set(dedupeKey, {
          id: dedupeKey,
          name,
          email,
          username,
          remoteHost: remoteHost || undefined,
          remoteUrl: remoteUrl || undefined,
          projectPaths: [normP],
          projectNames: [projectName],
          isCurrent: isCurrentProject,
          hasPassword: !!matchedCred,
          source: 'project',
        });
      }
    }

    // 2. Merge all available system credentials into accountMap so they are never lost (per user preference)
    for (const cred of creds) {
      const credEmail = cred.username.includes('@') ? cred.username : '';
      const credName = cred.username.includes('@') ? cred.username.split('@')[0] : cred.username;
      const dedupeKey = (credEmail || cred.username || credName).toLowerCase().trim();
      if (!dedupeKey) continue;
      if (accountMap.has(dedupeKey)) {
        const existing = accountMap.get(dedupeKey)!;
        if (!existing.remoteHost && cred.host) {
          existing.remoteHost = cred.host;
        }
        existing.hasPassword = true;
      } else {
        accountMap.set(dedupeKey, {
          id: dedupeKey,
          name: credName,
          email: credEmail,
          username: cred.username,
          remoteHost: cred.host || undefined,
          remoteUrl: undefined,
          projectPaths: [],
          projectNames: [],
          isCurrent: false,
          hasPassword: true,
          source: 'credential',
        });
      }
    }

    // 3. If accountMap is empty (no projects found), fallback to global user
    if (accountMap.size === 0 && globalUser.name) {
      const gKey = (globalUser.email || globalUser.name).toLowerCase().trim();
      accountMap.set(gKey, {
        id: gKey,
        name: globalUser.name,
        email: globalUser.email,
        username: globalUser.email || globalUser.name,
        projectPaths: [],
        projectNames: [],
        isCurrent: true,
        source: 'global',
      });
    }

    // 4. Mark isCurrent for the active project
    if (activePath) {
      const normActive = activePath.replace(/\\/g, '/').toLowerCase();
      const activeProjectAccount = Array.from(accountMap.values()).find((a) =>
        a.projectPaths.some((p) => p.replace(/\\/g, '/').toLowerCase() === normActive)
      );
      if (activeProjectAccount) {
        accountMap.forEach((a) => {
          a.isCurrent = a.id === activeProjectAccount.id;
        });
      }
    }

    // Sort: Current project account first, then accounts with workspace projects, then others
    const accounts = Array.from(accountMap.values());
    accounts.sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      return b.projectNames.length - a.projectNames.length;
    });

    return accounts;
  },

  // 12.1 Get repo commit authors from git shortlog
  async getRepoAuthors(repoPath?: string): Promise<GitAuthorItem[]> {
    if (repoPath && fs.existsSync(repoPath)) {
      const shortlogRes = await runGit(['shortlog', '-sne', '--all'], repoPath);
      let out = shortlogRes.code === 0 ? shortlogRes.stdout : '';
      if (!out) {
        const headRes = await runGit(['shortlog', '-sne', 'HEAD'], repoPath);
        if (headRes.code === 0) out = headRes.stdout;
      }
      if (out) {
        const currentUser = await this.getUserInfo(repoPath);
        const lines = out.split(/\r?\n/).filter(Boolean);
        const authors: GitAuthorItem[] = [];
        for (const line of lines) {
          const match = line.match(/^\s*(\d+)\s+(.+?)\s+<([^>]+)>/);
          if (match) {
            const commitCount = parseInt(match[1], 10) || 0;
            const name = match[2].trim();
            const email = match[3].trim();
            const isCurrent = Boolean(
              currentUser &&
              ((currentUser.name && name.toLowerCase() === currentUser.name.toLowerCase()) ||
               (currentUser.email && email.toLowerCase() === currentUser.email.toLowerCase()))
            );
            authors.push({
              name,
              email,
              commitCount,
              isCurrent,
            });
          }
        }
        if (authors.length > 0) {
          return authors;
        }
      }
    }

    // Fallback: Return workspace accounts
    const accounts = await this.getWorkspaceGitAccounts(repoPath ? [repoPath] : [], repoPath);
    return accounts.map((a) => ({
      name: a.name,
      email: a.email,
      commitCount: a.projectNames.length,
      isCurrent: a.isCurrent,
    }));
  },

  // 13. Switch active Git user identity (supports per-project, workspace-wide or global)
  async switchGitUser(
    repoPath?: string,
    name?: string,
    email?: string,
    isGlobal = false,
    applyToAllWorkspace = false,
    workspacePaths?: string[]
  ): Promise<{ success: boolean; user: GitUserInfo; message?: string }> {
    if (!name) return { success: false, user: { name: '', email: '' }, message: 'User name is required' };
    
    const targets: string[] = [];
    if (applyToAllWorkspace && workspacePaths && workspacePaths.length > 0) {
      targets.push(...workspacePaths);
    } else if (repoPath) {
      targets.push(repoPath);
    }

    const globalFlag = isGlobal ? ['--global'] : [];
    if (isGlobal || targets.length === 0) {
      await runGit(['config', '--global', 'user.name', name]);
      if (email) {
        await runGit(['config', '--global', 'user.email', email]);
      }
    }

    for (const p of targets) {
      if (fs.existsSync(p)) {
        await runGit(['config', '--local', 'user.name', name], p);
        if (email) {
          await runGit(['config', '--local', 'user.email', email], p);
        }
      }
    }

    const updated = await this.getUserInfo(repoPath);
    return { success: true, user: updated };
  },

  // 14. Delete branch with safety options (-d safe delete, -D force delete, or remote branch deletion)
  async deleteBranch(
    repoPath: string,
    branchName: string,
    force = false,
    isRemote = false
  ): Promise<{ success: boolean; message: string }> {
    const isRemoteBranch = Boolean(isRemote || branchName.startsWith('origin/') || branchName.includes('/'));

    if (isRemoteBranch) {
      // Remote branch deletion: git push <remote> --delete <shortName>
      const parts = branchName.split('/');
      const remote = parts.length > 1 ? parts[0] : 'origin';
      const shortName = parts.length > 1 ? parts.slice(1).join('/') : branchName;
      const remoteRef = `${remote}/${shortName}`;

      const res = await runGit(['push', remote, '--delete', shortName], repoPath);
      if (res.code !== 0) {
        return {
          success: false,
          message: (res.stderr || res.stdout || `Failed to delete remote branch '${shortName}' on '${remote}'`).trim(),
        };
      }

      // Also prune local remote-tracking reference: git branch -dr <remote>/<shortName>
      try {
        await runGit(['branch', '-dr', remoteRef], repoPath);
      } catch {}

      return {
        success: true,
        message: (res.stdout || res.stderr || `Successfully deleted remote branch '${remoteRef}'`).trim(),
      };
    }

    // Local branch deletion
    const flag = force ? '-D' : '-d';
    const res = await runGit(['branch', flag, branchName], repoPath);
    return {
      success: res.code === 0,
      message: (res.code === 0 ? (res.stdout || res.stderr || `Deleted branch '${branchName}'`) : (res.stderr || res.stdout || `Failed to delete branch '${branchName}'`)).trim(),
    };
  },

  // 15. Get commit logs with multi-dimensional filtering
  async getCommitLogs(
    repoPath: string,
    options: {
      branch?: string;
      author?: string;
      query?: string;
      since?: string;
      skip?: number;
      limit?: number;
    } = {}
  ): Promise<GitCommitItem[]> {
    if (!repoPath || !fs.existsSync(repoPath)) return [];
    const limit = options.limit || 60;
    const skip = options.skip || 0;
    const args = [
      'log',
      `-n`,
      String(limit),
      `--skip=${skip}`,
      '--date=iso',
      '--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%ad%x1f%D%x1f%s',
    ];

    if (options.branch === 'all') {
      args.push('--all');
    } else if (options.branch && options.branch !== 'current' && options.branch !== 'HEAD') {
      args.push(options.branch);
    }

    if (options.author && options.author !== 'all') {
      args.push(`--author=${options.author}`);
    }

    if (options.query && options.query.trim()) {
      args.push(`--grep=${options.query.trim()}`);
    }

    if (options.since && options.since !== 'all') {
      if (options.since === 'today') {
        args.push('--since=midnight');
      } else if (options.since === 'week') {
        args.push('--since=7.days.ago');
      } else if (options.since === 'month') {
        args.push('--since=30.days.ago');
      } else {
        args.push(`--since=${options.since}`);
      }
    }

    const res = await runGit(args, repoPath);
    if (res.code !== 0 || !res.stdout) {
      return [];
    }

    const items: GitCommitItem[] = [];
    const lines = res.stdout.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const parts = line.split('\x1f');
      if (parts.length >= 7) {
        items.push({
          hash: parts[0],
          shortHash: parts[1],
          authorName: parts[2],
          authorEmail: parts[3],
          date: parts[4],
          refs: parts[5],
          message: parts.slice(6).join('\x1f'),
        });
      }
    }
    return items;
  },

  // 16. Get commit details and changed file list
  async getCommitDetails(repoPath: string, hash: string): Promise<GitCommitDetails | null> {
    if (!repoPath || !hash || !fs.existsSync(repoPath)) return null;

    const metaRes = await runGit(
      [
        'show',
        '--no-patch',
        '--date=iso',
        '--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%ad%x1f%cn%x1f%ce%x1f%cd%x1f%P%x1f%D%x1f%s%x1f%b',
        hash,
      ],
      repoPath
    );

    if (metaRes.code !== 0 || !metaRes.stdout) return null;

    const parts = metaRes.stdout.split('\x1f');
    const commitHash = parts[0] || hash;
    const shortHash = parts[1] || hash.slice(0, 8);
    const authorName = parts[2] || '';
    const authorEmail = parts[3] || '';
    const authorDate = parts[4] || '';
    const committerName = parts[5] || '';
    const committerEmail = parts[6] || '';
    const committerDate = parts[7] || '';
    const parents = (parts[8] || '').split(' ').filter(Boolean);
    const refs = parts[9] || '';
    const subject = parts[10] || '';
    const body = parts.slice(11).join('\x1f').trim();

    const diffRes = await runGit(
      ['diff-tree', '-r', '--no-commit-id', '--name-status', '-M', '-m', '--first-parent', hash],
      repoPath
    );

    const files: GitCommitFileChange[] = [];
    if (diffRes.code === 0 && diffRes.stdout) {
      const diffLines = diffRes.stdout.split(/\r?\n/).filter(Boolean);
      for (const dLine of diffLines) {
        const segs = dLine.split(/\t+/);
        if (segs.length >= 2) {
          const rawStatus = segs[0].trim();
          const statusCode = rawStatus.charAt(0).toUpperCase();
          let status: GitCommitFileChange['status'] = 'modified';
          let pathStr = segs[1];
          let oldPath: string | undefined = undefined;

          if (statusCode === 'A') status = 'added';
          else if (statusCode === 'D') status = 'deleted';
          else if (statusCode === 'M') status = 'modified';
          else if (statusCode === 'R') {
            status = 'renamed';
            oldPath = segs[1];
            pathStr = segs[2] || segs[1];
          } else if (statusCode === 'C') {
            status = 'copied';
            oldPath = segs[1];
            pathStr = segs[2] || segs[1];
          } else {
            status = 'unknown';
          }

          files.push({
            path: pathStr,
            oldPath,
            status,
            statusCode,
          });
        }
      }
    }

    return {
      hash: commitHash,
      shortHash,
      authorName,
      authorEmail,
      authorDate,
      committerName,
      committerEmail,
      committerDate,
      subject,
      body,
      parents,
      refs,
      files,
    };
  },

  // 17. Get commit file diff content (parent vs commit)
  async getCommitFileDiff(
    repoPath: string,
    hash: string,
    filePath: string
  ): Promise<{ original: string; modified: string; filePath: string; oldLabel: string; newLabel: string }> {
    if (!repoPath || !hash || !filePath) {
      return { original: '', modified: '', filePath: filePath || '', oldLabel: '', newLabel: '' };
    }

    const parentRes = await runGit(['rev-parse', '--verify', '--quiet', `${hash}^`], repoPath);
    const hasParent = parentRes.code === 0 && Boolean(parentRes.stdout);
    const parentHash = hasParent ? `${hash.slice(0, 7)}^` : 'Initial';

    let original = '';
    if (hasParent) {
      const oldRes = await runGit(['show', `${hash}^:${filePath}`], repoPath);
      if (oldRes.code === 0) {
        original = oldRes.stdout;
      }
    }

    let modified = '';
    const newRes = await runGit(['show', `${hash}:${filePath}`], repoPath);
    if (newRes.code === 0) {
      modified = newRes.stdout;
    }

    return {
      original,
      modified,
      filePath,
      oldLabel: `Parent (${parentHash})`,
      newLabel: `Commit (${hash.slice(0, 7)})`,
    };
  },

  // 18. Reset to commit (Soft, Mixed, Hard)
  async resetToCommit(
    repoPath: string,
    hash: string,
    mode: 'soft' | 'mixed' | 'hard' = 'mixed'
  ): Promise<{ success: boolean; message: string }> {
    const res = await runGit(['reset', `--${mode}`, hash], repoPath);
    return {
      success: res.code === 0,
      message: res.stdout || res.stderr || `Reset to ${hash.slice(0, 7)} (${mode}) completed successfully`,
    };
  },

  // 19. Revert commit (Safe reverse patch)
  async revertCommit(
    repoPath: string,
    hash: string
  ): Promise<{ success: boolean; message: string }> {
    const res = await runGit(['revert', '--no-edit', hash], repoPath);
    return {
      success: res.code === 0,
      message: res.stdout || res.stderr || `Revert commit ${hash.slice(0, 7)} completed successfully`,
    };
  },

  // 20. Checkout revision (Historical snapshot - Detached HEAD)
  async checkoutRevision(
    repoPath: string,
    hash: string
  ): Promise<{ success: boolean; message: string }> {
    const res = await runGit(['checkout', hash], repoPath);
    return {
      success: res.code === 0,
      message: res.stdout || res.stderr || `Checked out revision ${hash.slice(0, 7)}`,
    };
  },

  // 21. Create branch at commit
  async createBranchAtCommit(
    repoPath: string,
    branchName: string,
    hash: string
  ): Promise<{ success: boolean; message: string }> {
    const res = await runGit(['checkout', '-b', branchName, hash], repoPath);
    return {
      success: res.code === 0,
      message: res.stdout || res.stderr || `Branch ${branchName} created at ${hash.slice(0, 7)}`,
    };
  },

  // 22. Create tag at commit
  async createTagAtCommit(
    repoPath: string,
    tagName: string,
    hash: string,
    message?: string
  ): Promise<{ success: boolean; message: string }> {
    const args = message
      ? ['tag', '-a', tagName, '-m', message, hash]
      : ['tag', tagName, hash];
    const res = await runGit(args, repoPath);
    return {
      success: res.code === 0,
      message: res.stdout || res.stderr || `Tag ${tagName} created at ${hash.slice(0, 7)}`,
    };
  },

  // 23. Cherry-pick commit
  async cherryPickCommit(
    repoPath: string,
    hash: string
  ): Promise<{ success: boolean; message: string }> {
    const res = await runGit(['cherry-pick', hash], repoPath);
    return {
      success: res.code === 0,
      message: res.stdout || res.stderr || `Cherry-picked ${hash.slice(0, 7)} into current branch`,
    };
  },

  // 24. Rename branch (F2)
  async renameBranch(
    repoPath: string,
    oldName: string,
    newName: string
  ): Promise<{ success: boolean; message: string }> {
    const res = await runGit(['branch', '-m', oldName, newName], repoPath);
    return {
      success: res.code === 0,
      message: res.stdout || res.stderr || `Renamed branch '${oldName}' to '${newName}'`,
    };
  },

  // 25. Rebase current branch onto target branch
  async rebaseBranch(
    repoPath: string,
    upstream: string
  ): Promise<{ success: boolean; message: string }> {
    const res = await runGit(['rebase', upstream], repoPath);
    return {
      success: res.code === 0,
      message: res.stdout || res.stderr || `Rebased onto '${upstream}'`,
    };
  },

  // 26. Checkout target branch and rebase onto another branch
  async checkoutAndRebase(
    repoPath: string,
    branchToCheckout: string,
    rebaseOnto: string
  ): Promise<{ success: boolean; message: string }> {
    const coRes = await runGit(['checkout', branchToCheckout], repoPath);
    if (coRes.code !== 0) {
      return { success: false, message: coRes.stderr || coRes.stdout || `Failed to checkout '${branchToCheckout}'` };
    }
    const rebRes = await runGit(['rebase', rebaseOnto], repoPath);
    return {
      success: rebRes.code === 0,
      message: rebRes.stdout || rebRes.stderr || `Checked out '${branchToCheckout}' and rebased onto '${rebaseOnto}'`,
    };
  },

  // 27. Checkout and Update (Pull from remote)
  async checkoutAndUpdate(
    repoPath: string,
    branchToCheckout: string
  ): Promise<{ success: boolean; message: string }> {
    const coRes = await runGit(['checkout', branchToCheckout], repoPath);
    if (coRes.code !== 0) {
      return { success: false, message: coRes.stderr || coRes.stdout || `Failed to checkout '${branchToCheckout}'` };
    }
    const pullRes = await runGit(['pull'], repoPath);
    return {
      success: pullRes.code === 0,
      message: pullRes.stdout || pullRes.stderr || `Checked out and updated '${branchToCheckout}'`,
    };
  },

  // 28. Push specific branch (Upgraded with robust error diagnostics and options)
  async pushBranch(
    repoPath: string,
    options: PushBranchOptions | string
  ): Promise<{ success: boolean; message: string; rawOutput?: string }> {
    const opts: PushBranchOptions = typeof options === 'string' ? { branch: options } : options;
    const cleanBranch = opts.branch.replace(/^origin\//, '');

    // Check if remote tracking is configured
    const upstreamRes = await runGit(['rev-parse', '--abbrev-ref', `${cleanBranch}@{upstream}`], repoPath);
    const hasUpstream = upstreamRes.code === 0 && Boolean(upstreamRes.stdout);

    const args = ['push'];
    if (!hasUpstream || opts.setUpstream) {
      args.push('-u');
    }
    if (opts.force) {
      args.push('--force-with-lease');
    }
    if (opts.tags) {
      args.push('--follow-tags');
    }
    args.push('origin', cleanBranch);

    const res = await runGit(args, repoPath);

    if (res.code === 0) {
      return {
        success: true,
        message: res.stdout || res.stderr || `Successfully pushed '${cleanBranch}' to origin`,
        rawOutput: `${res.stdout}\n${res.stderr}`.trim(),
      };
    } else {
      const errText = res.stderr || res.stdout || 'Push failed with unknown error';
      let friendlyMessage = errText;
      if (errText.includes('non-fast-forward') || errText.includes('fetch first')) {
        friendlyMessage = 'Push rejected: Remote repository contains commits that you do not have locally. Please update project (Pull) first, or Force Push if appropriate.';
      } else if (errText.includes('Permission denied') || errText.includes('Authentication failed') || errText.includes('Invalid credentials')) {
        friendlyMessage = 'Push rejected: Authentication or permission denied. Please verify Git credentials.';
      } else if (errText.includes('Protected branch') || errText.includes('pre-receive hook declined')) {
        friendlyMessage = `Push rejected by remote hook: '${cleanBranch}' may be a protected branch or failed GitLab branch rules.`;
      }
      return {
        success: false,
        message: friendlyMessage,
        rawOutput: errText,
      };
    }
  },

  // 29. Checkout tag or revision
  async checkoutTagOrRevision(
    repoPath: string,
    target: string,
    newBranchName?: string
  ): Promise<{ success: boolean; message: string }> {
    const args = newBranchName && newBranchName.trim()
      ? ['checkout', '-b', newBranchName.trim(), target.trim()]
      : ['checkout', target.trim()];
    const res = await runGit(args, repoPath);
    return {
      success: res.code === 0,
      message: res.stdout || res.stderr || `Checked out '${target}'`,
    };
  },

  // 30. Get diff between working tree and branch
  async getBranchWorkingTreeDiff(
    repoPath: string,
    branchName: string
  ): Promise<{ stdout: string; success: boolean }> {
    const res = await runGit(['diff', branchName], repoPath);
    return {
      success: res.code === 0,
      stdout: res.stdout || '',
    };
  },

  // 31. Get outgoing commits and file list for Push Dialog (1:1 with IntelliJ IDEA Screenshot 3)
  async getOutgoingCommits(
    repoPath: string,
    branchName?: string
  ): Promise<OutgoingCommitsData> {
    // 1. Resolve source branch
    let sourceBranch = branchName ? branchName.replace(/^origin\//, '') : '';
    if (!sourceBranch) {
      const bRes = await runGit(['branch', '--show-current'], repoPath);
      sourceBranch = bRes.stdout || 'dev';
    }

    // 2. Resolve upstream and remote
    const remote = 'origin';
    let targetBranch = sourceBranch;
    const upRes = await runGit(['rev-parse', '--abbrev-ref', `${sourceBranch}@{upstream}`], repoPath);
    if (upRes.code === 0 && upRes.stdout) {
      targetBranch = upRes.stdout.replace(/^origin\//, '');
    }

    // 3. Query outgoing commits (upstream..HEAD)
    const commits: OutgoingCommitItem[] = [];
    const allFilesMap = new Map<string, OutgoingCommitFile>();

    const range = `${remote}/${targetBranch}..${sourceBranch}`;
    let logRes = await runGit([
      'log',
      range,
      '--pretty=format:%H%x00%h%x00%an%x00%ae%x00%ad%x00%s%x00%b%x1f',
    ], repoPath);

    // If range produced nothing (e.g. already pushed or new branch without remote),
    // fallback to querying the latest commit on this branch so the dialog can still show context
    let rawLog = logRes.stdout.trim();
    if (!rawLog) {
      // Check if remote branch exists at all
      const checkRemote = await runGit(['rev-parse', '--verify', '--quiet', `${remote}/${targetBranch}`], repoPath);
      if (checkRemote.code !== 0) {
        // Remote branch doesn't exist yet, so all commits on sourceBranch are outgoing
        const fullLog = await runGit([
          'log',
          sourceBranch,
          '-n', '10',
          '--pretty=format:%H%x00%h%x00%an%x00%ae%x00%ad%x00%s%x00%b%x1f',
        ], repoPath);
        rawLog = fullLog.stdout.trim();
      } else {
        // Remote branch exists and range produced nothing: EVERYTHING IS UP TO DATE!
        rawLog = '';
      }
    }

    if (rawLog) {
      const records = rawLog.split('\x1f').map((r) => r.trim()).filter(Boolean);
      const parsedCommits = await Promise.all(
        records.map(async (record) => {
          const parts = record.split('\x00');
          if (parts.length < 6) return null;
          const [hash, shortHash, authorName, authorEmail, date, subject, body = ''] = parts;

          // Get files for this commit in parallel
          const diffRes = await runGit(
            ['diff-tree', '--no-commit-id', '--name-status', '-r', '-m', '--first-parent', hash],
            repoPath
          );
          const files: OutgoingCommitFile[] = [];

          if (diffRes.stdout) {
            const lines = diffRes.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
            for (const line of lines) {
              const segs = line.split(/\t+/);
              if (segs.length >= 2) {
                const statusCode = segs[0];
                const filePath = segs[segs.length - 1];
                const normalizedPath = filePath.replace(/\\/g, '/');
                const lastSlash = normalizedPath.lastIndexOf('/');
                const fileName = lastSlash >= 0 ? normalizedPath.slice(lastSlash + 1) : normalizedPath;
                const dirPath = lastSlash >= 0 ? normalizedPath.slice(0, lastSlash) : '';

                let status: OutgoingCommitFile['status'] = 'modified';
                if (statusCode.startsWith('A')) status = 'added';
                else if (statusCode.startsWith('D')) status = 'deleted';
                else if (statusCode.startsWith('R')) status = 'renamed';

                const fileObj: OutgoingCommitFile = {
                  path: normalizedPath,
                  fileName,
                  dirPath,
                  status,
                  statusCode,
                };
                files.push(fileObj);
              }
            }
          }

          return {
            hash,
            shortHash,
            subject,
            body: body.trim(),
            authorName,
            authorEmail,
            date,
            files,
          };
        })
      );

      for (const item of parsedCommits) {
        if (!item) continue;
        commits.push(item);
        for (const file of item.files) {
          allFilesMap.set(file.path, file);
        }
      }
    }

    return {
      sourceBranch,
      targetBranch,
      remote,
      commits,
      allFiles: Array.from(allFilesMap.values()),
    };
  },

  // 32. Merge branch into current HEAD
  async mergeBranch(
    repoPath: string,
    sourceBranch: string
  ): Promise<{
    success: boolean;
    message: string;
    targetBranch: string;
    sourceBranch: string;
    stdout?: string;
    isConflict?: boolean;
  }> {
    if (!repoPath || !sourceBranch) {
      return {
        success: false,
        message: 'Repository path and branch name are required',
        targetBranch: '',
        sourceBranch: sourceBranch || '',
      };
    }
    const cleanBranch = String(sourceBranch).replace(/^origin\//, '');
    const curRes = await runGit(['branch', '--show-current'], repoPath);
    const targetBranch = curRes.stdout || 'HEAD';

    const res = await runGit(['merge', cleanBranch, '--no-edit'], repoPath, 180000);

    if (res.code === 0) {
      const isUpToDate = res.stdout.includes('Already up to date');
      return {
        success: true,
        message: isUpToDate
          ? `Already up to date: '${targetBranch}' is already up to date with '${cleanBranch}'.`
          : `Merged ${cleanBranch} to ${targetBranch}`,
        targetBranch,
        sourceBranch: cleanBranch,
        stdout: res.stdout,
      };
    } else {
      const errText = (res.stderr || res.stdout || 'Git 进程非零返回，未捕获到具体错误输出，请检查工作区或冲突文件').trim();
      const isConflict = errText.includes('CONFLICT') || errText.includes('Automatic merge failed');
      return {
        success: false,
        message: isConflict
          ? `分支合并冲突: 将 '${cleanBranch}' 合并到 '${targetBranch}' 时检测到冲突文件，请解决冲突后提交。`
          : `合并分支 '${cleanBranch}' 到 '${targetBranch}' 失败: ${errText}`,
        targetBranch,
        sourceBranch: cleanBranch,
        stdout: errText,
        isConflict,
      };
    }
  },

  // 26. Get HEAD / last commit details
  async getLastCommit(repoPath: string): Promise<GitCommitDetails | null> {
    if (!repoPath || !fs.existsSync(repoPath)) return null;
    const headRes = await runGit(['rev-parse', 'HEAD'], repoPath);
    if (headRes.code !== 0 || !headRes.stdout) return null;
    return this.getCommitDetails(repoPath, headRes.stdout.trim());
  },

  // 27. Get recent commit messages from git log
  async getRecentCommitMessages(repoPath: string, limit = 15): Promise<string[]> {
    if (!repoPath || !fs.existsSync(repoPath)) return [];
    const res = await runGit(['log', `-${limit}`, '--pretty=format:%s'], repoPath);
    if (res.code !== 0 || !res.stdout) return [];
    return res.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  },

  // 28. Open file in external editor (VS Code or system default)
  async openFileInEditor(repoPath: string, filePath: string): Promise<{ success: boolean; message: string }> {
    const fullPath = path.resolve(repoPath, filePath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, message: `File not found: ${filePath}` };
    }
    try {
      const isWin = process.platform === 'win32';
      if (isWin) {
        // Try opening with 'code' first; if not found, use explorer.exe directly (bypasses cmd.exe policy restriction)
        exec(`code "${fullPath}"`, (err) => {
          if (err) {
            const child = spawn('explorer.exe', [fullPath.replace(/\//g, '\\')], {
              detached: true,
              stdio: 'ignore',
            });
            child.unref();
          }
        });
      } else if (process.platform === 'darwin') {
        exec(`code "${fullPath}" || open "${fullPath}"`);
      } else {
        exec(`code "${fullPath}" || xdg-open "${fullPath}"`);
      }
      return { success: true, message: `Opened ${filePath}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  // 28b. Reveal file/folder in OS file manager (Windows File Explorer / macOS Finder / Linux Desktop)
  async revealInFileManager(repoPath: string, filePath: string): Promise<{ success: boolean; message: string; target?: string }> {
    // 1. 规范化路径解析（支持绝对路径、相对路径以及多层级嵌套项目）
    let resolvedPath = path.isAbsolute(filePath)
      ? path.normalize(filePath)
      : path.resolve(repoPath, filePath);

    if (!fs.existsSync(resolvedPath)) {
      // 检查嵌套目录（如 repoPath/basename(repoPath)/filePath）
      const nestedPath = path.resolve(repoPath, path.basename(repoPath), filePath);
      if (fs.existsSync(nestedPath)) {
        resolvedPath = nestedPath;
      } else {
        // 检查上级目录
        const parentDir = path.dirname(repoPath);
        const altPath = path.resolve(parentDir, filePath);
        if (fs.existsSync(altPath)) {
          resolvedPath = altPath;
        }
      }
    }

    // 2. 核心规则判断：如果是文件夹打开当前文件夹，如果是文件打开当前文件的父文件夹
    let targetDir: string;
    if (fs.existsSync(resolvedPath)) {
      try {
        const stat = fs.statSync(resolvedPath);
        if (stat.isDirectory()) {
          // 文件夹：直接打开当前文件夹
          targetDir = resolvedPath;
        } else {
          // 文件：打开当前文件的父文件夹
          targetDir = path.dirname(resolvedPath);
        }
      } catch {
        targetDir = path.dirname(resolvedPath);
      }
    } else {
      // 若文件已被暂存删除或尚未创建，逐级向上寻找最近存在的有效目录
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
      if (platform === 'win32') {
        const winDirPath = path.normalize(targetDir).replace(/\//g, '\\');
        console.log('[gitService] revealInFileManager opening winDirPath:', winDirPath);
        // 在 Windows 上打开本地文件夹窗口的多重保障做法：
        // 1. 优先使用 explorer.exe "<dir>" 直接唤起资源管理器窗口
        //    （注意：Windows 上 explorer 打开成功交由桌面 Shell 窗口处理时通常返回 code 1，视为成功）
        exec(`explorer "${winDirPath}"`, (err) => {
          if (err && err.code !== 1 && err.code !== 0) {
            console.warn('[gitService] explorer direct exec failed, trying PowerShell Start-Process:', err.message);
            // 2. 备用：通过 PowerShell 的 Start-Process explorer.exe 委托 Windows Shell 唤起
            const escaped = winDirPath.replace(/'/g, "''");
            exec(`powershell.exe -NoProfile -NonInteractive -Command "Start-Process explorer.exe -ArgumentList '${escaped}'"`, (psErr) => {
              if (psErr) {
                console.warn('[gitService] PowerShell launch failed, trying cmd start:', psErr.message);
                // 3. 终极兜底：cmd start
                exec(`start "" "${winDirPath}"`);
              }
            });
          }
        });
      } else if (platform === 'darwin') {
        // macOS: open "<dir>" 直接在 Finder 中打开该文件夹
        const child = spawn('open', [targetDir], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      } else {
        // Linux: xdg-open "<dir>" 在系统桌面文件管理器中打开该文件夹
        const child = spawn('xdg-open', [targetDir], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      }

      return {
        success: true,
        message: `已打开所在文件夹: ${targetDir}`,
        target: targetDir,
      };
    } catch (e: any) {
      console.error('[gitService] revealInFileManager exception:', e);
      return { success: false, message: e.message };
    }
  },

  // 29. Stage single or multiple files (git add)
  async stageFile(repoPath: string, filePath: string): Promise<{ success: boolean; message: string }> {
    const res = await runGit(['add', '--', filePath], repoPath);
    return {
      success: res.code === 0,
      message: res.code === 0 ? `Staged ${filePath}` : res.stderr || res.stdout,
    };
  },

  // 30. Unstage single or multiple files (git restore --staged)
  async unstageFile(repoPath: string, filePath: string): Promise<{ success: boolean; message: string }> {
    let res = await runGit(['restore', '--staged', '--', filePath], repoPath);
    if (res.code !== 0) {
      res = await runGit(['reset', 'HEAD', '--', filePath], repoPath);
    }
    return {
      success: res.code === 0,
      message: res.code === 0 ? `Unstaged ${filePath}` : res.stderr || res.stdout,
    };
  },

  // 31. Get 3-way conflict data (Yours, Result, Theirs, Base)
  async getConflict3Way(repoPath: string, filePath: string): Promise<Conflict3WayData> {
    const fullPath = path.resolve(repoPath, filePath);
    let result = '';
    try {
      if (fs.existsSync(fullPath)) {
        result = fs.readFileSync(fullPath, 'utf8');
      }
    } catch {}

    // Stage 1, 2, 3: Fetch Base, Yours, and Theirs concurrently in parallel for 3x speedup
    const [baseRes, yoursRes, theirsRes] = await Promise.all([
      runGit(['show', `:1:${filePath}`], repoPath),
      runGit(['show', `:2:${filePath}`], repoPath),
      runGit(['show', `:3:${filePath}`], repoPath),
    ]);

    const base = baseRes.code === 0 ? baseRes.stdout : '';
    let yours = yoursRes.code === 0 ? yoursRes.stdout : '';
    let theirs = theirsRes.code === 0 ? theirsRes.stdout : '';

    // Parallel fallback if stage 2 or 3 not present in index
    if (!yours || !theirs) {
      const [headRes, mRes] = await Promise.all([
        !yours ? runGit(['show', `HEAD:${filePath}`], repoPath) : Promise.resolve(null),
        !theirs ? runGit(['show', `MERGE_HEAD:${filePath}`], repoPath) : Promise.resolve(null),
      ]);
      if (headRes && headRes.code === 0) yours = headRes.stdout;
      if (mRes && mRes.code === 0) theirs = mRes.stdout;
    }

    const parsed = parseConflictMarkers(result, base);
    if (!yours) {
      yours = parsed.reconstructedYours;
    }
    if (!theirs) {
      theirs = parsed.reconstructedTheirs;
    }

    return {
      filePath,
      repoPath,
      yours,
      theirs,
      base,
      result,
      cleanResult: parsed.cleanResult,
      conflictBlocks: parsed.blocks,
    };
  },

  // 32. Resolve conflict for a single file (yours, theirs, or custom merged content)
  async resolveConflict(
    repoPath: string,
    filePath: string,
    resolution: 'yours' | 'theirs' | 'content',
    content?: string
  ): Promise<{ success: boolean; message: string }> {
    const fullPath = path.resolve(repoPath, filePath);

    if (resolution === 'yours') {
      const res = await runGit(['checkout', '--ours', '--', filePath], repoPath);
      if (res.code !== 0) {
        const yoursRes = await runGit(['show', `:2:${filePath}`], repoPath);
        if (yoursRes.code === 0) {
          fs.writeFileSync(fullPath, yoursRes.stdout, 'utf8');
        }
      }
      await runGit(['add', '--', filePath], repoPath);
      return { success: true, message: `Accepted local version (Yours) / 已采纳本地版本: ${filePath}` };
    }

    if (resolution === 'theirs') {
      const res = await runGit(['checkout', '--theirs', '--', filePath], repoPath);
      if (res.code !== 0) {
        const theirsRes = await runGit(['show', `:3:${filePath}`], repoPath);
        if (theirsRes.code === 0) {
          fs.writeFileSync(fullPath, theirsRes.stdout, 'utf8');
        }
      }
      await runGit(['add', '--', filePath], repoPath);
      return { success: true, message: `Accepted incoming version (Theirs) / 已采纳传入版本: ${filePath}` };
    }

    if (resolution === 'content' && typeof content === 'string') {
      if (content.includes('<<<<<<<') && content.includes('=======')) {
        return {
          success: false,
          message: 'Save failed / 保存失败: Code still contains unresolved conflict markers (<<<<<<< or =======)',
        };
      }
      fs.writeFileSync(fullPath, content, 'utf8');
      await runGit(['add', '--', filePath], repoPath);
      return { success: true, message: `Three-way merge applied / 三方合并结果已应用: ${filePath}` };
    }

    return { success: false, message: 'Invalid conflict resolution mode / 无效的冲突解决模式' };
  },

  // 33. Abort merge or rebase
  async abortMerge(repoPath: string): Promise<{ success: boolean; message: string }> {
    const gitDir = path.join(repoPath, '.git');
    if (fs.existsSync(path.join(gitDir, 'MERGE_HEAD'))) {
      const res = await runGit(['merge', '--abort'], repoPath);
      return {
        success: res.code === 0,
        message: res.code === 0 ? 'Merge aborted successfully / 已成功放弃合并' : res.stderr || res.stdout,
      };
    }
    if (
      fs.existsSync(path.join(gitDir, 'REBASE_HEAD')) ||
      fs.existsSync(path.join(gitDir, 'rebase-merge')) ||
      fs.existsSync(path.join(gitDir, 'rebase-apply'))
    ) {
      const res = await runGit(['rebase', '--abort'], repoPath);
      return {
        success: res.code === 0,
        message: res.code === 0 ? 'Rebase aborted successfully / 已成功放弃变基' : res.stderr || res.stdout,
      };
    }
    if (fs.existsSync(path.join(gitDir, 'CHERRY_PICK_HEAD'))) {
      const res = await runGit(['cherry-pick', '--abort'], repoPath);
      return {
        success: res.code === 0,
        message: res.code === 0 ? 'Cherry-pick aborted / 已成功放弃 Cherry-pick' : res.stderr || res.stdout,
      };
    }

    const res = await runGit(['reset', '--hard', 'HEAD'], repoPath);
    return {
      success: res.code === 0,
      message: 'Reset conflicts to HEAD / 已安全回退未合并冲突',
    };
  },

  // 34. Complete merge commit
  async completeMerge(repoPath: string, message?: string): Promise<{ success: boolean; message: string }> {
    const status = await this.getRepoStatus(repoPath);
    const conflicts = status.files.filter((f) => f.status === 'conflict');
    if (conflicts.length > 0) {
      return {
        success: false,
        message: `Cannot complete merge / 无法完成合并: ${conflicts.length} conflicted files remaining`,
      };
    }

    const commitMsg = message && message.trim() ? message.trim() : 'Merge branch';
    const res = await runGit(['commit', '-m', commitMsg], repoPath);
    return {
      success: res.code === 0,
      message: res.code === 0 ? 'Merge commit succeeded / 分支合并完成并提交成功' : res.stderr || res.stdout,
    };
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

          // 严格忽略 .git 目录内所有文件、node_modules、临时文件等噪音，防止与 Git 底层操作形成自激死循环
          if (
            fn.startsWith('.git') ||
            fn.includes('/.git') ||
            fn.includes('node_modules') ||
            fn.includes('.vscode') ||
            fn.includes('.idea') ||
            fn.includes('.temp') ||
            fn.endsWith('.tmp') ||
            fn.endsWith('~')
          ) {
            return;
          }

          // 防抖 350ms 聚合文件变动事件
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
    const settings = loadSettings();
    const snapshotsDir = path.join(settings.cacheDir, 'snapshots');
    let cacheSize = 0;
    let repoCount = 0;
    try {
      if (fs.existsSync(snapshotsDir)) {
        const files = fs.readdirSync(snapshotsDir);
        for (const f of files) {
          if (f.endsWith('.json')) {
            repoCount++;
            const stat = fs.statSync(path.join(snapshotsDir, f));
            cacheSize += stat.size;
          }
        }
      }
    } catch {}
    return {
      settings,
      cacheSize,
      repoCount,
    };
  },

  // 41. Update settings with optional snapshot migration to new directory
  async updateSettings(
    newSettings: Partial<OmniGitSettings>,
    migrateData = false
  ): Promise<{ settings: OmniGitSettings; cacheSize: number; repoCount: number }> {
    const current = loadSettings();
    const oldDir = current.cacheDir;
    const updated: OmniGitSettings = {
      ...current,
      ...newSettings,
    };

    const newSnapshotsDir = path.join(updated.cacheDir, 'snapshots');
    if (!fs.existsSync(newSnapshotsDir)) {
      fs.mkdirSync(newSnapshotsDir, { recursive: true });
    }

    if (migrateData && oldDir.toLowerCase() !== updated.cacheDir.toLowerCase()) {
      const oldSnapshotsDir = path.join(oldDir, 'snapshots');
      if (fs.existsSync(oldSnapshotsDir)) {
        try {
          const files = fs.readdirSync(oldSnapshotsDir);
          for (const f of files) {
            if (f.endsWith('.json')) {
              const src = path.join(oldSnapshotsDir, f);
              const dest = path.join(newSnapshotsDir, f);
              fs.copyFileSync(src, dest);
            }
          }
        } catch (e) {
          console.warn('[gitService] Migration partial error:', e);
        }
      }
    }

    saveSettings(updated);
    return this.getSettingsInfo();
  },

  // 42. Clear cache snapshot files in user-configured cache directory
  async clearCache(): Promise<{ success: boolean; clearedCount: number }> {
    const settings = loadSettings();
    const snapshotsDir = path.join(settings.cacheDir, 'snapshots');
    let clearedCount = 0;
    if (fs.existsSync(snapshotsDir)) {
      try {
        const files = fs.readdirSync(snapshotsDir);
        for (const f of files) {
          if (f.endsWith('.json')) {
            try {
              fs.unlinkSync(path.join(snapshotsDir, f));
              clearedCount++;
            } catch {}
          }
        }
      } catch {}
    }
    return { success: true, clearedCount };
  },

  // 43. Get all disk snapshots for fast client hydration
  getDiskSnapshots(): Record<string, any> {
    const settings = loadSettings();
    const snapshotsDir = path.join(settings.cacheDir, 'snapshots');
    const result: Record<string, any> = {};
    if (!fs.existsSync(snapshotsDir)) return result;

    try {
      const files = fs.readdirSync(snapshotsDir);
      for (const f of files) {
        if (f.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(path.join(snapshotsDir, f), 'utf8');
            const data = JSON.parse(raw);
            if (data && data.repoPath) {
              result[data.repoPath.toLowerCase()] = data;
            }
          } catch {}
        }
      }
    } catch {}
    return result;
  },

  // 44. Save lightweight repo snapshot to disk (NEVER file diff/contents!)
  saveDiskSnapshot(repoPath: string, snapshot: any): boolean {
    if (!repoPath) return false;
    try {
      const settings = loadSettings();
      const filePath = getRepoSnapshotPath(settings.cacheDir, repoPath);

      // STRICT LIGHTWEIGHT FILTER: Absolutely NO file content or Monaco Diff text!
      const safeSnapshot = {
        repoPath,
        currentBranch: snapshot.currentBranch || 'main',
        upstream: snapshot.upstream,
        incoming: Number(snapshot.incoming) || 0,
        outgoing: Number(snapshot.outgoing) || 0,
        branches: (snapshot.branches || []).map((b: any) => ({
          name: b.name,
          isCurrent: Boolean(b.isCurrent),
          isFavorite: Boolean(b.isFavorite),
          upstream: b.upstream,
          incoming: Number(b.incoming) || 0,
          outgoing: Number(b.outgoing) || 0,
        })),
        files: (snapshot.files || []).map((f: any) => ({
          path: f.path,
          status: f.status,
          staged: Boolean(f.staged),
          oldPath: f.oldPath,
        })),
        selectedFilePath: snapshot.selectedFilePath || null,
        commitMessage: snapshot.commitMessage || '',
        commitHistory: (snapshot.commitHistory || []).slice(0, 30),
        commitLogs: (snapshot.commitLogs || []).slice(0, 200).map((c: any) => ({
          hash: c.hash,
          shortHash: c.shortHash,
          subject: c.subject || c.message || '',
          message: c.message || c.subject || '',
          authorName: c.authorName || '',
          authorEmail: c.authorEmail || '',
          date: c.date || '',
          refs: c.refs || '',
        })),
        isMerging: Boolean(snapshot.isMerging),
        mergeMessage: snapshot.mergeMessage || '',
        mergeSourceBranch: snapshot.mergeSourceBranch,
        conflictedCount: Number(snapshot.conflictedCount) || 0,
        lastUpdated: Date.now(),
      };

      fs.writeFileSync(filePath, JSON.stringify(safeSnapshot, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('[gitService] Failed to save disk snapshot:', e);
      return false;
    }
  },

  // 45. Get single repo disk snapshot for 3~5ms fast promotion into L1 cache
  getSingleDiskSnapshot(repoPath: string): any | null {
    if (!repoPath) return null;
    try {
      const settings = loadSettings();
      const filePath = getRepoSnapshotPath(settings.cacheDir, repoPath);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('[gitService] Failed to read single disk snapshot:', e);
    }
    return null;
  },

  // 46. Workspaces & Recent Projects Disk Backup (Dual-tier persistence guarantee)
  saveWorkspacesBackup(data: {
    savedWorkspaces?: any[];
    recentProjects?: any[];
    workspaceProjectPaths?: Record<string, string[]>;
  }): boolean {
    try {
      const settings = loadSettings();
      if (!fs.existsSync(settings.cacheDir)) {
        fs.mkdirSync(settings.cacheDir, { recursive: true });
      }
      const backupPath = path.join(settings.cacheDir, 'workspaces_backup.json');
      let existing: any = {};
      if (fs.existsSync(backupPath)) {
        try {
          existing = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        } catch {}
      }

      const rawSaved =
        data.savedWorkspaces && data.savedWorkspaces.length > 0
          ? data.savedWorkspaces
          : existing.savedWorkspaces || [];
      const sanitizedSaved = Array.isArray(rawSaved)
        ? rawSaved.filter((w: any) => w && w.id && w.id !== 'default')
        : [];

      const rawPaths =
        data.workspaceProjectPaths && Object.keys(data.workspaceProjectPaths).length > 0
          ? { ...(existing.workspaceProjectPaths || {}), ...data.workspaceProjectPaths }
          : existing.workspaceProjectPaths || {};
      const sanitizedPaths: Record<string, string[]> = {};
      for (const [wsId, paths] of Object.entries(rawPaths)) {
        if (wsId && wsId !== 'default' && Array.isArray(paths) && paths.length > 0) {
          sanitizedPaths[wsId] = paths;
        }
      }

      const merged = {
        savedWorkspaces: sanitizedSaved,
        recentProjects:
          data.recentProjects && data.recentProjects.length > 0
            ? data.recentProjects
            : existing.recentProjects || [],
        workspaceProjectPaths: sanitizedPaths,
        lastBackup: Date.now(),
      };

      fs.writeFileSync(backupPath, JSON.stringify(merged, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('[gitService] Failed to save workspaces backup:', e);
      return false;
    }
  },

  // 47. Get Workspaces & Recent Projects Disk Backup
  getWorkspacesBackup(): {
    savedWorkspaces: any[];
    recentProjects: any[];
    workspaceProjectPaths: Record<string, string[]>;
  } {
    try {
      const settings = loadSettings();
      const backupPath = path.join(settings.cacheDir, 'workspaces_backup.json');
      if (fs.existsSync(backupPath)) {
        const raw = fs.readFileSync(backupPath, 'utf8');
        const parsed = JSON.parse(raw);
        const rawSaved = Array.isArray(parsed.savedWorkspaces) ? parsed.savedWorkspaces : [];
        const sanitizedSaved = rawSaved.filter((w: any) => w && w.id && w.id !== 'default');
        const rawPaths =
          parsed.workspaceProjectPaths && typeof parsed.workspaceProjectPaths === 'object'
            ? parsed.workspaceProjectPaths
            : {};
        const sanitizedPaths: Record<string, string[]> = {};
        for (const [wsId, paths] of Object.entries(rawPaths)) {
          if (wsId && wsId !== 'default' && Array.isArray(paths) && paths.length > 0) {
            sanitizedPaths[wsId] = paths;
          }
        }
        return {
          savedWorkspaces: sanitizedSaved,
          recentProjects: Array.isArray(parsed.recentProjects) ? parsed.recentProjects : [],
          workspaceProjectPaths: sanitizedPaths,
        };
      }
    } catch (e) {
      console.error('[gitService] Failed to read workspaces backup:', e);
    }
    return { savedWorkspaces: [], recentProjects: [], workspaceProjectPaths: {} };
  },

  // Clone a remote Git repository into local directory
  async cloneRepo(
    remoteUrl: string,
    targetDir: string,
    options?: {
      branch?: string;
      username?: string;
      password?: string;
    }
  ): Promise<{
    success: boolean;
    message: string;
    repoPath?: string;
    repoName?: string;
    currentBranch?: string;
  }> {
    const trimmedUrl = (remoteUrl || '').trim();
    let finalTargetDir = (targetDir || '').trim();

    if (!trimmedUrl) {
      return { success: false, message: 'Please enter a valid remote Git URL / 请输入有效的远端 Git 仓库地址' };
    }
    if (!finalTargetDir) {
      return { success: false, message: 'Please specify target folder / 请指定本地存放文件夹路径' };
    }

    finalTargetDir = path.resolve(finalTargetDir);

    // 1. Check if target directory already exists and is non-empty
    if (fs.existsSync(finalTargetDir)) {
      try {
        const files = fs.readdirSync(finalTargetDir);
        if (files.length > 0) {
          return {
            success: false,
            message: `Target directory already exists and is not empty / 目标文件夹已存在且不为空: ${finalTargetDir}`,
          };
        }
      } catch (e: any) {
        return { success: false, message: `Failed to inspect target directory / 检查目标文件夹失败: ${e.message}` };
      }
    } else {
      // Create parent directory if needed
      try {
        const parentDir = path.dirname(finalTargetDir);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
      } catch (e: any) {
        return { success: false, message: `Failed to create parent directory / 无法创建父级目录: ${e.message}` };
      }
    }

    // 2. Prepare Git clone command & URL
    let cloneUrl = trimmedUrl;
    // Inject credentials if provided for HTTP/HTTPS URL
    if (options?.username && options?.password && /^https?:\/\//i.test(trimmedUrl)) {
      try {
        const u = new URL(trimmedUrl);
        u.username = encodeURIComponent(options.username);
        u.password = encodeURIComponent(options.password);
        cloneUrl = u.toString();
      } catch {
        // Fallback to original URL if parsing fails
      }
    }

    const args = ['clone', '--progress'];
    if (options?.branch && options.branch.trim()) {
      args.push('-b', options.branch.trim());
    }
    args.push(cloneUrl, finalTargetDir);

    const parentDir = path.dirname(finalTargetDir);
    // Timeout set to 5 minutes (300,000 ms) for large repositories
    const res = await runGit(args, parentDir, 300000);

    if (res.code !== 0) {
      // Diagnostic error message cleanup
      let errorMsg = res.stderr || res.stdout || 'Clone failed / 克隆操作失败';
      if (/Authentication failed|Invalid credentials|401|403/i.test(errorMsg)) {
        errorMsg = 'Remote authentication failed (401/403) / 远端仓库认证失败: Please check credentials';
      } else if (/Could not resolve host/i.test(errorMsg)) {
        errorMsg = 'Could not resolve host / 无法解析远端服务器域名: Please check network or URL';
      } else if (/Repository not found|remote: Not Found/i.test(errorMsg)) {
        errorMsg = 'Remote repository not found / 远端仓库未找到: Please verify URL and access rights';
      } else if (/already exists and is not an empty directory/i.test(errorMsg)) {
        errorMsg = `Target directory already exists and is not empty / 目标文件夹已存在且不为空: ${finalTargetDir}`;
      } else if (/Connection timed out|operation timed out/i.test(errorMsg)) {
        errorMsg = 'Connection timed out / 连接远端服务器超时: Please check network proxy or server status';
      }
      return { success: false, message: errorMsg };
    }

    // 3. Clone succeeded! Read repo status to get default branch & name
    const repoName = path.basename(finalTargetDir);
    let currentBranch = 'main';
    try {
      const branchRes = await runGit(['branch', '--show-current'], finalTargetDir);
      if (branchRes.stdout.trim()) {
        currentBranch = branchRes.stdout.trim();
      }
    } catch {}

    return {
      success: true,
      message: `Repository '${repoName}' cloned successfully / 仓库 '${repoName}' 克隆成功!`,
      repoPath: finalTargetDir,
      repoName,
      currentBranch,
    };
  },

  // Open native Windows folder selection dialog
  selectLocalFolder(initialPath?: string): Promise<{ success: boolean; folderPath?: string }> {
    return new Promise((resolve) => {
      const initDir = initialPath && fs.existsSync(initialPath) ? initialPath.replace(/'/g, "''") : '';
      const psCommand = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '选择本地文件夹 (Select Folder)'; $f.ShowNewFolderButton = $true; ${initDir ? `$f.SelectedPath = '${initDir}';` : ''} $t = New-Object System.Windows.Forms.Form; $t.TopMost = $true; if ($f.ShowDialog($t) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output $f.SelectedPath }`;

      exec(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`,
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
};

function parseConflictMarkers(
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

      // Left (Yours) line positions
      const leftStartLine = yLines.length + 1;
      yLines.push(...curYoursLines);
      const leftEndLine = Math.max(leftStartLine, yLines.length);

      // Right (Theirs) line positions
      const rightStartLine = tLines.length + 1;
      tLines.push(...curTheirsLines);
      const rightEndLine = Math.max(rightStartLine, tLines.length);

      // Result (Center) line positions with Base
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

