import * as fs from 'fs';
import * as path from 'path';
import { runGit } from './gitExec';
import { gitStatusIdentityOps } from './gitStatusIdentityOps';
import { gitBranchPushOps } from './gitBranchPushOps';
import type {
  GitStashItem,
  GitBlameLineItem,
  BatchRepoOperationResult,
} from '../gitTypes';

export const gitBatchStashBlameOps = {
  // 45. Batch multi-repo Pull
  async batchPull(paths: string[]): Promise<BatchRepoOperationResult[]> {
    const validPaths = Array.isArray(paths) ? paths.filter((p) => p && fs.existsSync(p)) : [];
    return Promise.all(
      validPaths.map(async (repoPath): Promise<BatchRepoOperationResult> => {
        const repoName = path.basename(repoPath);
        try {
          const pullRes = await gitBranchPushOps.pull(repoPath);
          const syncList = await gitStatusIdentityOps.getBatchSyncStatus([repoPath]);
          const syncInfo = syncList[0];
          return {
            path: repoPath,
            repoName,
            success: pullRes.success,
            status: (pullRes.status as any) || (pullRes.success ? 'updated' : 'failed'),
            message: pullRes.message,
            branch: syncInfo?.currentBranch,
            incoming: syncInfo?.incoming,
            outgoing: syncInfo?.outgoing,
          };
        } catch (err: any) {
          return {
            path: repoPath,
            repoName,
            success: false,
            status: 'failed',
            message: err.message || 'Pull failed',
          };
        }
      })
    );
  },

  // 46. Batch multi-repo Fetch
  async batchFetch(paths: string[]): Promise<BatchRepoOperationResult[]> {
    const validPaths = Array.isArray(paths) ? paths.filter((p) => p && fs.existsSync(p)) : [];
    return Promise.all(
      validPaths.map(async (repoPath): Promise<BatchRepoOperationResult> => {
        const repoName = path.basename(repoPath);
        try {
          const fetchRes = await runGit(['fetch', '--all', '--prune'], repoPath, 60000);
          const syncList = await gitStatusIdentityOps.getBatchSyncStatus([repoPath]);
          const syncInfo = syncList[0];
          return {
            path: repoPath,
            repoName,
            success: fetchRes.code === 0,
            status: fetchRes.code === 0 ? 'fetched' : 'failed',
            message: fetchRes.stdout || fetchRes.stderr || 'Fetched remotes',
            branch: syncInfo?.currentBranch,
            incoming: syncInfo?.incoming,
            outgoing: syncInfo?.outgoing,
          };
        } catch (err: any) {
          return {
            path: repoPath,
            repoName,
            success: false,
            status: 'failed',
            message: err.message || 'Fetch failed',
          };
        }
      })
    );
  },

  // 47. Batch multi-repo Checkout same-named branch
  async batchCheckout(
    paths: string[],
    branchName: string,
    autoPull = false
  ): Promise<BatchRepoOperationResult[]> {
    const cleanTarget = (branchName || '').trim();
    const validPaths = Array.isArray(paths) ? paths.filter((p) => p && fs.existsSync(p)) : [];
    if (!cleanTarget) return [];

    return Promise.all(
      validPaths.map(async (repoPath): Promise<BatchRepoOperationResult> => {
        const repoName = path.basename(repoPath);
        try {
          const coRes = await gitBranchPushOps.checkoutBranch(repoPath, cleanTarget, autoPull);
          const syncList = await gitStatusIdentityOps.getBatchSyncStatus([repoPath]);
          const syncInfo = syncList[0];
          return {
            path: repoPath,
            repoName,
            success: coRes.success,
            status: coRes.success ? 'checked-out' : 'skipped',
            message: coRes.message,
            branch: syncInfo?.currentBranch,
            incoming: syncInfo?.incoming,
            outgoing: syncInfo?.outgoing,
          };
        } catch (err: any) {
          return {
            path: repoPath,
            repoName,
            success: false,
            status: 'failed',
            message: err.message || 'Checkout failed',
          };
        }
      })
    );
  },

  // 48. Git Stash List
  async getStashes(repoPath: string): Promise<GitStashItem[]> {
    if (!repoPath || !fs.existsSync(repoPath)) return [];
    const res = await runGit(
      ['stash', 'list', '--date=iso', '--pretty=format:%gd%x1f%H%x1f%gs%x1f%ci'],
      repoPath
    );
    if (res.code !== 0 || !res.stdout) return [];

    const items: GitStashItem[] = [];
    const lines = res.stdout.split(/\r?\n/).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split('\x1f');
      const stashRef = parts[0] || `stash@{${i}}`;
      const hash = parts[1] || '';
      const rawSubject = parts[2] || '';
      const date = parts[3] || '';
      const idxMatch = stashRef.match(/stash@\{(\d+)\}/);
      const index = idxMatch ? parseInt(idxMatch[1], 10) : i;

      let branch = '';
      let message = rawSubject;
      const wipMatch = rawSubject.match(/^(?:WIP on|On)\s+([^:]+):\s*(.*)$/i);
      if (wipMatch) {
        branch = wipMatch[1].trim();
        message = wipMatch[2].trim() || rawSubject;
      }

      items.push({
        index,
        stashRef,
        branch,
        message,
        date,
        hash,
      });
    }
    return items;
  },

  // 49. Git Stash Push
  async stashPush(
    repoPath: string,
    message?: string,
    includeUntracked = true
  ): Promise<{ success: boolean; message: string }> {
    if (!repoPath || !fs.existsSync(repoPath)) {
      return { success: false, message: 'Invalid repository path' };
    }
    const args = ['stash', 'push'];
    if (includeUntracked) {
      args.push('-u');
    }
    if (message && message.trim()) {
      args.push('-m', message.trim());
    }
    const res = await runGit(args, repoPath);
    const out = (res.stdout || res.stderr || '').trim();
    const noLocalChanges = /No local changes to save/i.test(out);
    return {
      success: res.code === 0 && !noLocalChanges,
      message: out || (res.code === 0 ? 'Stashed working tree changes' : 'Stash failed'),
    };
  },

  // 50. Git Stash Apply
  async stashApply(
    repoPath: string,
    index = 0
  ): Promise<{ success: boolean; message: string; isConflict?: boolean }> {
    if (!repoPath || !fs.existsSync(repoPath)) {
      return { success: false, message: 'Invalid repository path' };
    }
    const ref = `stash@{${index}}`;
    const res = await runGit(['stash', 'apply', ref], repoPath);
    const out = `${res.stdout}\n${res.stderr}`.trim();
    const isConflict = /CONFLICT|Merge conflict/i.test(out);
    return {
      success: res.code === 0 && !isConflict,
      isConflict,
      message: out || `Applied ${ref}`,
    };
  },

  // 51. Git Stash Pop
  async stashPop(
    repoPath: string,
    index = 0
  ): Promise<{ success: boolean; message: string; isConflict?: boolean }> {
    if (!repoPath || !fs.existsSync(repoPath)) {
      return { success: false, message: 'Invalid repository path' };
    }
    const ref = `stash@{${index}}`;
    const res = await runGit(['stash', 'pop', ref], repoPath);
    const out = `${res.stdout}\n${res.stderr}`.trim();
    const isConflict = /CONFLICT|Merge conflict/i.test(out);
    return {
      success: res.code === 0 && !isConflict,
      isConflict,
      message: out || `Popped ${ref}`,
    };
  },

  // 52. Git Stash Drop
  async stashDrop(
    repoPath: string,
    index = 0
  ): Promise<{ success: boolean; message: string }> {
    if (!repoPath || !fs.existsSync(repoPath)) {
      return { success: false, message: 'Invalid repository path' };
    }
    const ref = `stash@{${index}}`;
    const res = await runGit(['stash', 'drop', ref], repoPath);
    return {
      success: res.code === 0,
      message: (res.stdout || res.stderr || `Dropped ${ref}`).trim(),
    };
  },

  // 53. Git Blame (--line-porcelain)
  async getFileBlame(repoPath: string, filePath: string): Promise<GitBlameLineItem[]> {
    if (!repoPath || !filePath || !fs.existsSync(repoPath)) return [];
    let relPath = filePath;
    const normRepo = repoPath.replace(/\\/g, '/').replace(/\/+$/, '');
    const normFile = filePath.replace(/\\/g, '/');
    if (normFile.toLowerCase().startsWith(normRepo.toLowerCase() + '/')) {
      relPath = normFile.slice(normRepo.length + 1);
    }

    const res = await runGit(['blame', '--line-porcelain', '--', relPath], repoPath, 30000);
    if (res.code !== 0 || !res.stdout) return [];

    const items: GitBlameLineItem[] = [];
    const lines = res.stdout.split(/\r?\n/);

    let curHash = '';
    let curLine = 0;
    let curAuthor = '';
    let curAuthorMail = '';
    let curAuthorTime = 0;
    let curSummary = '';

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!curHash) {
        const headerMatch = l.match(/^([0-9a-f]{40})\s+(\d+)\s+(\d+)/);
        if (headerMatch) {
          curHash = headerMatch[1];
          curLine = parseInt(headerMatch[3], 10);
        }
        continue;
      }

      if (l.startsWith('author ')) {
        curAuthor = l.slice(7).trim();
      } else if (l.startsWith('author-mail ')) {
        curAuthorMail = l.slice(12).trim().replace(/^<|>$/g, '');
      } else if (l.startsWith('author-time ')) {
        curAuthorTime = parseInt(l.slice(12).trim(), 10) || 0;
      } else if (l.startsWith('summary ')) {
        curSummary = l.slice(8).trim();
      } else if (l.startsWith('\t')) {
        const isUncommitted = /^0+$/.test(curHash);
        const dateStr = curAuthorTime > 0
          ? new Date(curAuthorTime * 1000).toISOString().slice(0, 10)
          : '';
        items.push({
          line: curLine,
          hash: curHash,
          shortHash: isUncommitted ? 'Working' : curHash.slice(0, 7),
          author: isUncommitted ? 'Not Committed Yet' : curAuthor,
          authorMail: curAuthorMail,
          authorTime: curAuthorTime,
          dateStr,
          summary: curSummary,
        });
        curHash = '';
        curLine = 0;
        curAuthor = '';
        curAuthorMail = '';
        curAuthorTime = 0;
        curSummary = '';
      }
    }

    return items;
  },
};
