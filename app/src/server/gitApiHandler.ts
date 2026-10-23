import type { IncomingMessage, ServerResponse } from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { gitService } from './gitService';
import { fileSystemService } from './fileSystemService';
import { fileEncodingService } from './fileEncodingService';
import { nodeServiceProcessManager } from './nodeServiceProcessManager';
import { decodeGitPath } from '../utils/gitPathUtils';
import { handleDashboardServeRequest } from './dashboardServeHandler';

function isAllowedHost(host: string | undefined): boolean {
  if (!host) return false;
  let hostname = host;
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    hostname = end !== -1 ? host.slice(0, end + 1) : host;
  } else {
    hostname = host.split(':')[0];
  }
  hostname = hostname.toLowerCase();

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname === '0.0.0.0' ||
    hostname === 'omnigit.local'
  ) {
    return true;
  }

  // Allow private LAN IP patterns for local multi-device debugging
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;

  return false;
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin || origin === 'null') return true;
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0'
    ) {
      return true;
    }
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (parsed.protocol === 'vscode-webview:' || parsed.protocol === 'electron:') return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Universal Git & File System API Request Handler
 * Shared between Vite dev middleware and Electron production embedded loopback server.
 * Returns true if the request was handled, false otherwise.
 */
export async function handleGitApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  if (
    !url.startsWith('/api/git') &&
    !url.startsWith('/api/fs') &&
    !url.startsWith('/api/services') &&
    !url.startsWith('/api/workspace/dashboard')
  ) {
    return false;
  }

  // 1. Host header validation to prevent DNS Rebinding attacks
  if (!isAllowedHost(req.headers.host)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Access Denied: Invalid Host Header (Security Policy)' }));
    return true;
  }

  // 2. Origin & cross-site validation to prevent unauthorized third-party website access
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Access Denied: Cross-Origin Request Blocked (Security Policy)' }));
    return true;
  }

  const secFetchSite = req.headers['sec-fetch-site'];
  if (secFetchSite === 'cross-site') {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Access Denied: Cross-Site Interaction Blocked (Security Policy)' }));
    return true;
  }

  // Handle CORS preflight safely
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin || 'http://127.0.0.1:5345',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return true;
  }

  const urlObj = new URL(url, 'http://127.0.0.1:5345');
  const pathname = urlObj.pathname;
  const query = Object.fromEntries(urlObj.searchParams.entries());

  if (pathname.startsWith('/api/workspace/dashboard')) {
    return await handleDashboardServeRequest(req, res, urlObj);
  }

  if (pathname === '/api/services/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': origin || 'http://127.0.0.1:5345',
    });
    res.write('event: connected\ndata: {}\n\n');

    const onLog = (payload: { serviceId: string; data: string; stream: 'stdout' | 'stderr' }) => {
      try {
        res.write(`event: log\ndata: ${JSON.stringify(payload)}\n\n`);
      } catch {}
    };

    const onExit = (payload: { serviceId: string; exitCode: number; signal?: string }) => {
      try {
        res.write(`event: exit\ndata: ${JSON.stringify(payload)}\n\n`);
      } catch {}
    };

    nodeServiceProcessManager.on('log', onLog);
    nodeServiceProcessManager.on('exit', onExit);

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      nodeServiceProcessManager.off('log', onLog);
      nodeServiceProcessManager.off('exit', onExit);
    });

    return true;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  let body: any = {};
  if (req.method === 'POST') {
    const buffers: Buffer[] = [];
    for await (const chunk of req) {
      buffers.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const raw = Buffer.concat(buffers).toString('utf8');
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {}
    }
  }

  try {
    if (pathname === '/api/git/user') {
      const user = await gitService.getUserInfo(query.path || body.path || '');
      res.end(JSON.stringify(user));
    } else if (pathname === '/api/git/scan-projects') {
      const projects = await gitService.scanProjects(query.baseDir || undefined);
      res.end(JSON.stringify(projects));
    } else if (pathname === '/api/git/settings') {
      if (req.method === 'POST') {
        const result = await gitService.updateSettings(body.settings || {}, body.migrateData);
        res.end(JSON.stringify(result));
      } else {
        const info = gitService.getSettingsInfo();
        res.end(JSON.stringify(info));
      }
    } else if (pathname === '/api/git/settings/clear-cache') {
      const result = await gitService.clearCache();
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/cache/snapshots') {
      const snapshots = gitService.getDiskSnapshots();
      res.end(JSON.stringify(snapshots));
    } else if (pathname === '/api/git/cache/snapshot') {
      if (req.method === 'GET') {
        const snapshot = gitService.getSingleDiskSnapshot(query.path || '');
        res.end(JSON.stringify(snapshot || null));
      } else {
        const success = gitService.saveDiskSnapshot(body.path, body.snapshot);
        res.end(JSON.stringify({ success }));
      }
    } else if (pathname === '/api/git/workspaces/backup') {
      if (req.method === 'POST') {
        const success = gitService.saveWorkspacesBackup(body);
        res.end(JSON.stringify({ success }));
      } else {
        const backup = gitService.getWorkspacesBackup();
        res.end(JSON.stringify(backup));
      }
    } else if (pathname === '/api/git/batch-sync-status') {
      const paths = body.paths || (query.paths ? query.paths.split(',') : []);
      const result = await gitService.getBatchSyncStatus(paths);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/status') {
      const status = await gitService.getRepoStatus(query.path || '');
      res.end(JSON.stringify(status));
    } else if (pathname === '/api/git/branches') {
      const branches = await gitService.getRepoBranches(query.path || '');
      res.end(JSON.stringify(branches));
    } else if (pathname === '/api/git/diff') {
      const filePath = decodeGitPath(query.file || '');
      const diff = await gitService.getFileDiff(query.path || '', filePath);
      res.end(JSON.stringify(diff));
    } else if (pathname === '/api/git/save-file') {
      const filePath = decodeGitPath(body.file || '');
      const success = await gitService.saveFileContent(body.path, filePath, body.content);
      res.end(JSON.stringify({ success }));
    } else if (pathname === '/api/git/checkout') {
      const result = await gitService.checkoutBranch(body.path, body.branch, body.autoPull !== false);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/pull') {
      const result = await gitService.pull(body.path);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/commit') {
      const files = Array.isArray(body.files) ? body.files.map((f: string) => decodeGitPath(f)) : [];
      const result = await gitService.commit(body.path, files, body.message, body.isAmend);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/rollback') {
      const files = Array.isArray(body.files) ? body.files.map((f: string) => decodeGitPath(f)) : [];
      const result = await gitService.rollback(body.path, files);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/inspect-folder') {
      const result = await gitService.inspectFolder(body.folderPath);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/clone-stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const cloneId = body.cloneId || `clone_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      
      const sendEvent = (data: any) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      };

      sendEvent({ type: 'init', cloneId });

      try {
        const result = await gitService.cloneRepoStream(
          body.remoteUrl,
          body.targetDir,
          {
            branch: body.branch,
            username: body.username,
            password: body.password,
            cloneId,
          },
          (progress) => {
            sendEvent({ type: 'progress', cloneId, ...progress });
          },
          (logLine) => {
            sendEvent({ type: 'log', cloneId, line: logLine });
          }
        );

        if (result.success) {
          sendEvent({ type: 'complete', cloneId, ...result });
        } else {
          sendEvent({ type: 'error', cloneId, message: result.message });
        }
      } catch (err: any) {
        sendEvent({ type: 'error', cloneId, message: err.message || '克隆操作异常' });
      } finally {
        if (!res.writableEnded) {
          res.end();
        }
      }
      return true;
    } else if (pathname === '/api/git/clone-abort') {
      const result = await gitService.abortClone(body.cloneId);
      res.end(JSON.stringify(result));
      return true;
    } else if (pathname === '/api/git/clone-repo') {
      const result = await gitService.cloneRepo(
        body.remoteUrl,
        body.targetDir,
        {
          branch: body.branch,
          username: body.username,
          password: body.password,
        }
      );
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/select-folder') {
      const result = await gitService.selectLocalFolder(body.initialPath);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/authors') {
      const authors = await gitService.getRepoAuthors(query.path || '');
      res.end(JSON.stringify(authors));
    } else if (pathname === '/api/git/workspace-accounts') {
      const paths = body.projectPaths || (query.paths ? query.paths.split(',') : []);
      const activePath = body.activePath || query.activePath || '';
      const accounts = await gitService.getWorkspaceGitAccounts(paths, activePath);
      res.end(JSON.stringify(accounts));
    } else if (pathname === '/api/git/switch-user') {
      const result = await gitService.switchGitUser(
        body.path,
        body.name,
        body.email,
        body.isGlobal,
        body.applyToAllWorkspace,
        body.workspacePaths
      );
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/delete-branch') {
      const result = await gitService.deleteBranch(body.path, body.branch, body.force, body.isRemote);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/commits') {
      const commits = await gitService.getCommitLogs(query.path || '', {
        branch: query.branch,
        author: query.author,
        query: query.query,
        since: query.since,
        skip: query.skip ? parseInt(query.skip, 10) : 0,
        limit: query.limit ? parseInt(query.limit, 10) : 60,
      });
      res.end(JSON.stringify(commits));
    } else if (pathname === '/api/git/commit-details') {
      const details = await gitService.getCommitDetails(query.path || '', query.hash || '');
      res.end(JSON.stringify(details));
    } else if (pathname === '/api/git/commit-file-diff') {
      const filePath = decodeGitPath(query.file || '');
      const diff = await gitService.getCommitFileDiff(query.path || '', query.hash || '', filePath);
      res.end(JSON.stringify(diff));
    } else if (pathname === '/api/git/reset') {
      const result = await gitService.resetToCommit(body.path, body.hash, body.mode);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/revert') {
      const result = await gitService.revertCommit(body.path, body.hash);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/checkout-revision') {
      const result = await gitService.checkoutRevision(body.path, body.hash);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/create-branch-at') {
      const result = await gitService.createBranchAtCommit(body.path, body.branchName, body.hash);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/create-tag') {
      const result = await gitService.createTagAtCommit(body.path, body.tagName, body.hash, body.message);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/cherry-pick') {
      const result = await gitService.cherryPickCommit(body.path, body.hash);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/rename-branch') {
      const result = await gitService.renameBranch(body.path, body.oldName, body.newName);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/rebase') {
      const result = await gitService.rebaseBranch(body.path, body.upstream);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/checkout-and-rebase') {
      const result = await gitService.checkoutAndRebase(body.path, body.branch, body.onto);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/checkout-and-update') {
      const result = await gitService.checkoutAndUpdate(body.path, body.branch);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/push-branch') {
      const result = await gitService.pushBranch(body.path, {
        branch: body.branch,
        targetBranch: body.targetBranch,
        targetCommit: body.targetCommit,
        force: body.force,
        tags: body.tags,
      });
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/push-commits-selective') {
      const result = await gitService.cherryPickAndPushCommits(body.path, {
        hashes: body.hashes,
        sourceBranch: body.sourceBranch,
        targetBranch: body.targetBranch,
        remote: body.remote,
        createNewBranch: body.createNewBranch,
        newBranchName: body.newBranchName,
        force: body.force,
      });
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/sync-commits-to-branch') {
      const result = await gitService.syncCommitsToBranch(body.path, {
        hashes: body.hashes,
        targetBranch: body.targetBranch,
        remote: body.remote,
        pushToRemote: body.pushToRemote,
      });
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/merge') {
      const repoPath = body.path || query.path || '';
      const branchName = body.branch || query.branch || '';
      const result = await gitService.mergeBranch(repoPath, branchName);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/undo-merge') {
      const repoPath = body.path || query.path || '';
      const preMergeHead = body.preMergeHead || '';
      const result = await gitService.undoMerge(repoPath, preMergeHead);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/merge-undo-status') {
      const repoPath = body.path || query.path || '';
      const activeBranch = body.activeBranch || query.activeBranch || '';
      const result = await gitService.getMergeUndoStatus(repoPath, activeBranch);
      res.end(JSON.stringify(result || { canUndo: false }));
    } else if (pathname === '/api/git/outgoing-commits') {
      const data = await gitService.getOutgoingCommits(query.path || '', query.branch || '', query.targetBranch || '');
      res.end(JSON.stringify(data));
    } else if (pathname === '/api/git/checkout-tag-revision') {
      const result = await gitService.checkoutTagOrRevision(body.path, body.target, body.newBranchName);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/branch-working-diff') {
      const result = await gitService.getBranchWorkingTreeDiff(query.path || '', query.branch || '');
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/last-commit') {
      const result = await gitService.getLastCommit(query.path || body.path || '');
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/recent-commit-messages') {
      const limit = query.limit ? parseInt(query.limit, 10) : 15;
      const result = await gitService.getRecentCommitMessages(query.path || body.path || '', limit);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/open-file') {
      const filePath = decodeGitPath(body.file || query.file || '');
      const result = await gitService.openFileInEditor(body.path || query.path || '', filePath);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/reveal-file') {
      const filePath = decodeGitPath(body.file || query.file || '');
      const result = await gitService.revealInFileManager(body.path || query.path || '', filePath);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/stage-file') {
      const filePath = decodeGitPath(body.file || query.file || '');
      const result = await gitService.stageFile(body.path || query.path || '', filePath);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/unstage-file') {
      const filePath = decodeGitPath(body.file || query.file || '');
      const result = await gitService.unstageFile(body.path || query.path || '', filePath);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/conflict-3way') {
      const filePath = decodeGitPath(body.file || query.file || '');
      const result = await gitService.getConflict3Way(body.path || query.path || '', filePath);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/resolve-conflict') {
      const filePath = decodeGitPath(body.file || '');
      const result = await gitService.resolveConflict(body.path, filePath, body.resolution, body.content);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/abort-merge') {
      const result = await gitService.abortMerge(body.path || query.path || '');
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/complete-merge') {
      const result = await gitService.completeMerge(body.path || query.path || '', body.message);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/watch-repo') {
      const repoPath = (query.path as string) || '';
      if (!repoPath) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing path' }));
        return true;
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ type: 'connected', path: repoPath })}\n\n`);

      const unsubscribe = gitService.subscribeRepoChanges(repoPath, () => {
        try {
          res.write(`data: ${JSON.stringify({ type: 'change', path: repoPath, timestamp: Date.now() })}\n\n`);
        } catch {}
      });

      const cleanup = () => {
        try {
          unsubscribe();
          if (!res.writableEnded) {
            res.end();
          }
        } catch {}
      };

      req.on('close', cleanup);
      req.on('error', cleanup);
      return true;
    } else if (pathname === '/api/fs/tree') {
      const repoPath = query.repoPath || '';
      const subDir = query.dir || '';
      if (!repoPath) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing repoPath' }));
        return true;
      }
      const items = fileSystemService.readDirectory(repoPath, subDir);
      res.end(JSON.stringify(items));
    } else if (pathname === '/api/fs/locate-ancestors') {
      const repoPath = query.repoPath || body.repoPath || '';
      const rawRel = query.relativePath ? decodeGitPath(query.relativePath) : (body.relativePath || '');
      if (!repoPath) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing repoPath' }));
        return true;
      }
      const cleanRel = rawRel.replace(/\\/g, '/').replace(/^\/+/, '');
      const segments = cleanRel.split('/').filter(Boolean);
      segments.pop(); // Remove target file itself

      const ancestors: string[] = [''];
      let currentSub = '';
      for (const seg of segments) {
        currentSub = currentSub ? `${currentSub}/${seg}` : seg;
        ancestors.push(currentSub);
      }

      const trees = fileSystemService.readDirectoryBatch(repoPath, ancestors);
      res.end(JSON.stringify({ ancestors, trees }));
      return true;
    } else if (pathname === '/api/fs/tree-batch') {
      const repoPath = query.repoPath || body.repoPath || '';
      let dirs: string[] = [];
      if (Array.isArray(body.dirs)) {
        dirs = body.dirs;
      } else if (query.dirs) {
        dirs = query.dirs.split(',').map((d: string) => decodeGitPath(d.trim()));
      }
      if (!repoPath) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing repoPath' }));
        return true;
      }
      const trees = fileSystemService.readDirectoryBatch(repoPath, dirs);
      res.end(JSON.stringify({ trees }));
      return true;
    } else if (pathname === '/api/fs/read') {
      const repoPath = query.repoPath || '';
      const relativePath = query.relativePath ? decodeGitPath(query.relativePath) : '';
      const rawFilePath = query.filePath ? query.filePath.trim().replace(/^"(.*)"$/, '$1') : '';
      const filePath = rawFilePath || (repoPath && relativePath ? path.join(repoPath, relativePath) : repoPath);
      if (!filePath) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing filePath' }));
        return true;
      }
      const resolvedPath = path.resolve(filePath);
      if (!fs.existsSync(resolvedPath)) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: `File not found: ${resolvedPath}` }));
        return true;
      }
      const result = fileEncodingService.readFile(resolvedPath);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/fs/raw') {
      const repoPath = query.repoPath || '';
      const relativePath = query.relativePath ? decodeGitPath(query.relativePath) : '';
      const rawFilePath = query.filePath ? query.filePath.trim().replace(/^"(.*)"$/, '$1') : '';
      const targetFilePath = rawFilePath || (repoPath && relativePath ? path.join(repoPath, relativePath) : repoPath);
      if (!targetFilePath) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing filePath' }));
        return true;
      }
      const resolvedPath = path.resolve(targetFilePath);
      if (!fs.existsSync(resolvedPath)) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'File not found' }));
        return true;
      }
      const ext = path.extname(resolvedPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon',
        '.bmp': 'image/bmp',
        '.avif': 'image/avif',
        '.apng': 'image/apng',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.pdf': 'application/pdf',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, must-revalidate',
      });
      fs.createReadStream(resolvedPath).pipe(res);
      return true;
    } else if (pathname === '/api/fs/write') {
      const repoPath = body.repoPath || '';
      const relativePath = body.relativePath || '';
      const filePath = body.filePath || (repoPath && relativePath ? path.join(repoPath, relativePath) : repoPath);
      if (!filePath) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing filePath' }));
        return true;
      }
      const success = fileEncodingService.writeFile(
        filePath,
        body.content ?? '',
        body.encoding || 'utf-8',
        body.eol
      );
      let mtime = 0;
      if (success) {
        mtime = fileEncodingService.getFileStat(filePath).mtime;
      }
      res.end(JSON.stringify({ success, mtime }));
    } else if (pathname === '/api/fs/stat') {
      const repoPath = query.repoPath || '';
      const relativePath = query.relativePath || '';
      const filePath = query.filePath || (repoPath && relativePath ? path.join(repoPath, relativePath) : repoPath);
      if (!filePath) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing filePath' }));
        return true;
      }
      const stat = fileEncodingService.getFileStat(filePath);
      res.end(JSON.stringify(stat));
    } else if (pathname === '/api/fs/search-code') {
      const repos = body.repos || [];
      const searchQuery = body.query || '';
      const options = body.options || {};

      const allMatches: any[] = [];
      for (const r of repos) {
        const rPath = typeof r === 'string' ? r : r.path;
        const rName = typeof r === 'string' ? path.basename(r) : (r.name || path.basename(rPath));
        if (!rPath || !fs.existsSync(rPath)) continue;

        const matches = await gitService.searchCode(rPath, searchQuery, options);
        for (const m of matches) {
          allMatches.push({
            ...m,
            file: m.relativePath,
            line: m.lineNumber,
            text: m.lineContent,
            repoPath: rPath,
            repoName: rName,
          });
          if (allMatches.length >= (options.maxResults || 300)) break;
        }
        if (allMatches.length >= (options.maxResults || 300)) break;
      }

      res.end(JSON.stringify({ matches: allMatches }));
    } else if (pathname === '/api/services/start') {
      const result = await nodeServiceProcessManager.start({
        serviceId: body.serviceId,
        serviceName: body.serviceName,
        projectId: body.projectId,
        command: body.command,
        stopCommand: body.stopCommand,
        cwd: body.cwd,
        env: body.env,
      });
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/services/stop') {
      const success = await nodeServiceProcessManager.stop(body.serviceId);
      res.end(JSON.stringify({ success }));
    } else if (pathname === '/api/services/stop-all') {
      const count = await nodeServiceProcessManager.stopAll(body.projectId);
      res.end(JSON.stringify({ success: true, count }));
    } else if (pathname === '/api/services/running') {
      const running = nodeServiceProcessManager.getRunningServices(query.projectId);
      res.end(JSON.stringify(running));
    } else if (pathname === '/api/services/check-orphans') {
      const result = nodeServiceProcessManager.checkAndCleanOrphanProcesses();
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/services/scan-scripts') {
      const projectPath = query.projectPath || body.projectPath || '';
      const scripts = nodeServiceProcessManager.scanProjectScripts(projectPath);
      res.end(JSON.stringify(scripts));
    } else if (pathname === '/api/services/configs') {
      if (req.method === 'POST') {
        const success = gitService.saveServicesBackup(body);
        res.end(JSON.stringify({ success }));
      } else {
        const configs = gitService.getServicesBackup();
        res.end(JSON.stringify(configs));
      }
      return true;
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }
    return true;
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
    return true;
  }
}
