import type { IncomingMessage, ServerResponse } from 'http';
import { gitService } from './gitService';

/**
 * Universal Git API Request Handler
 * Shared between Vite dev middleware and Electron production embedded loopback server.
 * Returns true if the request was handled, false otherwise.
 */
export async function handleGitApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  if (!url.startsWith('/api/git')) {
    return false;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const urlObj = new URL(url, 'http://127.0.0.1:5345');
  const pathname = urlObj.pathname;
  const query = Object.fromEntries(urlObj.searchParams.entries());

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
      const diff = await gitService.getFileDiff(query.path || '', query.file || '');
      res.end(JSON.stringify(diff));
    } else if (pathname === '/api/git/save-file') {
      const success = await gitService.saveFileContent(body.path, body.file, body.content);
      res.end(JSON.stringify({ success }));
    } else if (pathname === '/api/git/checkout') {
      const result = await gitService.checkoutBranch(body.path, body.branch);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/pull') {
      const result = await gitService.pull(body.path);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/commit') {
      const result = await gitService.commit(body.path, body.files, body.message, body.isAmend);
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/rollback') {
      const result = await gitService.rollback(body.path, body.files);
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
      const diff = await gitService.getCommitFileDiff(query.path || '', query.hash || '', query.file || '');
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
        force: body.force,
        tags: body.tags,
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
      const data = await gitService.getOutgoingCommits(query.path || '', query.branch || '');
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
      const result = await gitService.openFileInEditor(body.path || query.path || '', body.file || query.file || '');
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/reveal-file') {
      const result = await gitService.revealInFileManager(body.path || query.path || '', body.file || query.file || '');
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/stage-file') {
      const result = await gitService.stageFile(body.path || query.path || '', body.file || query.file || '');
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/unstage-file') {
      const result = await gitService.unstageFile(body.path || query.path || '', body.file || query.file || '');
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/conflict-3way') {
      const result = await gitService.getConflict3Way(body.path || query.path || '', body.file || query.file || '');
      res.end(JSON.stringify(result));
    } else if (pathname === '/api/git/resolve-conflict') {
      const result = await gitService.resolveConflict(body.path, body.file, body.resolution, body.content);
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
