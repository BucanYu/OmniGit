import * as fs from 'fs';
import * as path from 'path';
import { decodeGitPath, splitGitPath } from '../../utils/gitPathUtils';
import {
  runGit,
  hasGitConflictMarkers,
  getSystemGitCredentials,
} from './gitExec';
import type {
  GitUserInfo,
  GitAuthorItem,
  WorkspaceGitAccount,
  RealGitFile,
  RealBranchInfo,
  RealRepoStatus,
} from '../gitTypes';

export const gitStatusIdentityOps = {
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
        const countsRes = await runGit(['rev-list', '--left-right', '--count', '--cherry-pick', `HEAD...${upstream}`], repoPath);
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
    return Promise.all(validPaths.map((p) => gitStatusIdentityOps.getSingleRepoSync(p)));
  },

  // 2. Scan projects directory for valid Git repositories
  async scanProjects(baseDir?: string): Promise<Array<{ id: string; name: string; path: string; currentBranch: string; incoming: number; outgoing: number }>> {
    const repos: Array<{ id: string; name: string; path: string }> = [];
    const targetDir = baseDir || (fs.existsSync('D:\\projects') ? 'D:\\projects' : (process.env.USERPROFILE || process.env.HOME || ''));

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
          return;
        }
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await checkDir(path.join(dir, entry.name), depth + 1);
          }
        }
      } catch {}
    }

    if (targetDir && fs.existsSync(targetDir)) {
      await checkDir(targetDir, 0);
    }

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

    const branchRes = await runGit(['branch', '--show-current'], repoPath);
    const currentBranch = branchRes.stdout || 'HEAD';

    const upstreamRes = await runGit(['rev-parse', '--abbrev-ref', '@{upstream}'], repoPath);
    const upstream = upstreamRes.code === 0 ? upstreamRes.stdout : undefined;

    let incoming = 0;
    let outgoing = 0;
    if (upstream) {
      const countsRes = await runGit(['rev-list', '--left-right', '--count', '--cherry-pick', `HEAD...${upstream}`], repoPath);
      if (countsRes.code === 0 && countsRes.stdout) {
        const parts = countsRes.stdout.split(/\s+/);
        outgoing = parseInt(parts[0], 10) || 0;
        incoming = parseInt(parts[1], 10) || 0;
      }
    }

    const statusRes = await runGit(['status', '--porcelain=v1', '-u'], repoPath);
    const files: RealGitFile[] = [];

    if (statusRes.stdout) {
      const lines = statusRes.stdout.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const match = line.match(/^([ MADRCU?]{2})\s+(.*)$/);
        if (!match) continue;
        const code = match[1];
        let rawTarget = match[2].trim();
        if (rawTarget.includes(' -> ')) {
          const parts = rawTarget.split(' -> ');
          rawTarget = parts[parts.length - 1].trim();
        }
        const { fileName, dirPath, forwardPath } = splitGitPath(rawTarget);

        const isConflict =
          code.includes('U') ||
          code === 'AA' ||
          code === 'DD' ||
          code === 'AU' ||
          code === 'UD' ||
          code === 'UA' ||
          code === 'DU';

        if (isConflict) {
          const fullPath = path.resolve(repoPath, forwardPath);
          let conflictResolvedExternally = false;
          if (fs.existsSync(fullPath)) {
            try {
              const stats = fs.statSync(fullPath);
              if (stats.size < 5 * 1024 * 1024) {
                const content = fs.readFileSync(fullPath, 'utf8');
                const hasConflictMarkers = hasGitConflictMarkers(content);
                if (!hasConflictMarkers) {
                  await runGit(['add', '--', forwardPath], repoPath);
                  conflictResolvedExternally = true;
                }
              }
            } catch {}
          }

          if (conflictResolvedExternally) {
            files.push({
              path: forwardPath,
              fileName,
              dirPath,
              status: 'modified',
              group: 'changes',
              checked: true,
            });
          } else {
            files.push({
              path: forwardPath,
              fileName,
              dirPath,
              status: 'conflict',
              group: 'conflict',
              checked: false,
            });
          }
        } else if (code === '??') {
          files.push({
            path: forwardPath,
            fileName,
            dirPath,
            status: 'untracked',
            group: 'unversioned',
            checked: false,
          });
        } else if (code.includes('A')) {
          files.push({
            path: forwardPath,
            fileName,
            dirPath,
            status: 'added',
            group: 'changes',
            checked: true,
          });
        } else if (code.includes('D')) {
          files.push({
            path: forwardPath,
            fileName,
            dirPath,
            status: 'deleted',
            group: 'changes',
            checked: true,
          });
        } else {
          files.push({
            path: forwardPath,
            fileName,
            dirPath,
            status: 'modified',
            group: 'changes',
            checked: true,
          });
        }
      }
    }

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
    const cleanFilePath = decodeGitPath(filePath).replace(/\\/g, '/');
    const ext = path.extname(cleanFilePath).toLowerCase();
    const binaryExtensions = new Set([
      '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.tiff', '.tif',
      '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
      '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm', '.parquet',
      '.mp3', '.mp4', '.mov', '.avi', '.flv', '.mkv',
      '.woff', '.woff2', '.ttf', '.eot', '.otf',
      '.pyc', '.class', '.o', '.obj'
    ]);

    const fullPath = path.resolve(repoPath, cleanFilePath);
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

    const headRes = await runGit(['show', `HEAD:${cleanFilePath}`], repoPath, 20000);
    const oldContent = headRes.code === 0 ? headRes.stdout : '';

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
    const cleanFilePath = decodeGitPath(filePath).replace(/\\/g, '/');
    const fullPath = path.resolve(repoPath, cleanFilePath);
    try {
      fs.writeFileSync(fullPath, content, 'utf8');
      if (!hasGitConflictMarkers(content)) {
        const statusRes = await runGit(['status', '--porcelain=v1', '--', cleanFilePath], repoPath);
        if (statusRes.stdout && (statusRes.stdout.includes('U') || statusRes.stdout.startsWith('AA'))) {
          await runGit(['add', '--', cleanFilePath], repoPath);
        }
      }
      return true;
    } catch {
      return false;
    }
  },

  // 11. Inspect a given folder path (root or subdirectories with .git)
  async inspectFolder(folderPath: string): Promise<Array<{ id: string; name: string; path: string; currentBranch: string; isRoot: boolean }>> {
    const results: Array<{ id: string; name: string; path: string; currentBranch: string; isRoot: boolean }> = [];
    if (!fs.existsSync(folderPath)) {
      return results;
    }

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
      } catch {}
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
    const globalUser = await gitStatusIdentityOps.getUserInfo();
    const accountMap = new Map<string, WorkspaceGitAccount>();

    for (const p of projectPaths) {
      if (!p || !fs.existsSync(p)) continue;
      const gitDir = path.join(p, '.git');
      if (!fs.existsSync(gitDir)) continue;

      const projectName = path.basename(p);
      const isCurrentProject = activePath
        ? path.resolve(p).toLowerCase() === path.resolve(activePath).toLowerCase()
        : false;

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

      const matchedCred = creds.find(
        (c) => remoteHost && c.host.toLowerCase() === remoteHost.toLowerCase()
      );

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

      if (!name) name = effNameRes.stdout || globalUser.name || 'Git User';
      if (!email) email = effEmailRes.stdout || globalUser.email || '';

      const username = embeddedUser || matchedCred?.username || (email.includes('@') ? email : name);
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
        const currentUser = await gitStatusIdentityOps.getUserInfo(repoPath);
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

    const accounts = await gitStatusIdentityOps.getWorkspaceGitAccounts(repoPath ? [repoPath] : [], repoPath);
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

    const updated = await gitStatusIdentityOps.getUserInfo(repoPath);
    return { success: true, user: updated };
  },
};
