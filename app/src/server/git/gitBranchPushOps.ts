import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { decodeGitPath } from '../../utils/gitPathUtils';
import { runGit, parseGitLogBatchOutput } from './gitExec';
import type {
  OutgoingCommitFile,
  OutgoingCommitItem,
  OutgoingCommitsData,
  PushBranchOptions,
  SelectivePushOptions,
  SyncCommitsOptions,
} from '../gitTypes';

export const gitBranchPushOps = {
  // 7. Checkout branch (with automatic remote pull)
  async checkoutBranch(
    repoPath: string,
    branchName: string,
    autoPull = true
  ): Promise<{
    success: boolean;
    message: string;
    pulled?: boolean;
    pullStatus?: 'updated' | 'already-up-to-date' | 'no-upstream' | 'conflict' | 'failed';
    pullMessage?: string;
  }> {
    const cleanBranch = branchName.replace(/^origin\//, '');
    const res = await runGit(['checkout', cleanBranch], repoPath, 60000);
    const output = (res.stderr || res.stdout || '').trim();
    if (res.code !== 0) {
      return {
        success: false,
        message: output || `切换到分支 '${cleanBranch}' 失败: 未知错误，请检查是否有未提交的代码冲突或文件被占用`,
      };
    }

    if (!autoPull) {
      return {
        success: true,
        message: output || `Switched to branch '${cleanBranch}'`,
      };
    }

    try {
      const upstreamRes = await runGit(['rev-parse', '--abbrev-ref', '@{upstream}'], repoPath);
      const hasUpstream = upstreamRes.code === 0 && Boolean(upstreamRes.stdout?.trim());

      if (!hasUpstream) {
        return {
          success: true,
          message: `已成功切换到分支 '${cleanBranch}'（本地分支，未关联远端追踪）`,
          pulled: false,
          pullStatus: 'no-upstream',
          pullMessage: 'No upstream tracking branch configured',
        };
      }

      const pullRes = await runGit(['pull'], repoPath, 60000);
      const pullOutput = (pullRes.stdout || pullRes.stderr || '').trim();

      if (pullRes.code === 0) {
        const isUpToDate = pullOutput.includes('Already up to date');
        return {
          success: true,
          message: isUpToDate
            ? `已成功切换到分支 '${cleanBranch}'（远端代码已是最新）`
            : `已成功切换到分支 '${cleanBranch}' 并拉取最新远端代码`,
          pulled: true,
          pullStatus: isUpToDate ? 'already-up-to-date' : 'updated',
          pullMessage: pullOutput,
        };
      } else {
        const isConflict = pullOutput.includes('CONFLICT') || pullOutput.includes('Automatic merge failed');
        return {
          success: true,
          message: isConflict
            ? `已切换到分支 '${cleanBranch}'，但拉取时产生代码冲突，请尽快解决冲突`
            : `已切换到分支 '${cleanBranch}'，但拉取远端更新失败: ${pullOutput}`,
          pulled: false,
          pullStatus: isConflict ? 'conflict' : 'failed',
          pullMessage: pullOutput,
        };
      }
    } catch (pullErr: any) {
      return {
        success: true,
        message: `已成功切换到分支 '${cleanBranch}'，拉取远端异常: ${pullErr?.message || String(pullErr)}`,
        pulled: false,
        pullStatus: 'failed',
        pullMessage: pullErr?.message,
      };
    }
  },

  // 8. Pull / Update Project
  async pull(repoPath: string): Promise<{ success: boolean; message: string; status?: string }> {
    const res = await runGit(['pull'], repoPath);
    return {
      success: res.code === 0,
      message: res.stdout || res.stderr,
    };
  },

  // 9. Commit selected files
  async commit(repoPath: string, files: string[], message: string, isAmend = false): Promise<{ success: boolean; message: string }> {
    const cleanFiles = (files || []).map((f) => decodeGitPath(f).replace(/\\/g, '/'));
    if (cleanFiles.length > 0) {
      await runGit(['add', '--', ...cleanFiles], repoPath);
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
    const cleanFiles = (files || []).map((f) => decodeGitPath(f).replace(/\\/g, '/'));
    const restoreRes = await runGit(['restore', '--staged', '--worktree', '--', ...cleanFiles], repoPath);
    if (restoreRes.code !== 0) {
      await runGit(['checkout', 'HEAD', '--', ...cleanFiles], repoPath);
    }
    await runGit(['clean', '-f', '--', ...cleanFiles], repoPath);
    return {
      success: true,
      message: 'Changes rolled back successfully',
    };
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

      try {
        await runGit(['branch', '-dr', remoteRef], repoPath);
      } catch {}

      return {
        success: true,
        message: (res.stdout || res.stderr || `Successfully deleted remote branch '${remoteRef}'`).trim(),
      };
    }

    const flag = force ? '-D' : '-d';
    const res = await runGit(['branch', flag, branchName], repoPath);
    return {
      success: res.code === 0,
      message: (res.code === 0 ? (res.stdout || res.stderr || `Deleted branch '${branchName}'`) : (res.stderr || res.stdout || `Failed to delete branch '${branchName}'`)).trim(),
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
  ): Promise<{
    success: boolean;
    message: string;
    pulled?: boolean;
    pullStatus?: 'updated' | 'already-up-to-date' | 'no-upstream' | 'conflict' | 'failed';
    pullMessage?: string;
  }> {
    return gitBranchPushOps.checkoutBranch(repoPath, branchToCheckout, true);
  },

  // 28. Push specific branch (Upgraded with robust error diagnostics and options)
  async pushBranch(
    repoPath: string,
    options: PushBranchOptions | string
  ): Promise<{ success: boolean; message: string; rawOutput?: string }> {
    const opts: PushBranchOptions = typeof options === 'string' ? { branch: options } : options;
    const cleanBranch = opts.branch.replace(/^origin\//, '');

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
    const cleanTargetBranch = (opts.targetBranch || cleanBranch).replace(/^origin\//, '');
    let refspec = cleanBranch;
    if (opts.targetCommit) {
      refspec = `${opts.targetCommit}:${cleanTargetBranch}`;
    } else if (opts.targetBranch && cleanTargetBranch !== cleanBranch) {
      refspec = `${cleanBranch}:${cleanTargetBranch}`;
    }
    args.push('origin', refspec);

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

  // Helper: Batch parse git log --name-status output into commits and modified files safely in O(N) memory
  parseGitLogBatchOutput(raw: string): { commits: OutgoingCommitItem[]; allFiles: OutgoingCommitFile[] } {
    return parseGitLogBatchOutput(raw);
  },

  // 31. Get outgoing commits and file list for Push Dialog
  async getOutgoingCommits(
    repoPath: string,
    branchName?: string,
    targetBranchName?: string
  ): Promise<OutgoingCommitsData> {
    let sourceBranch = branchName ? branchName.replace(/^origin\//, '') : '';
    const remote = 'origin';
    let targetBranch = targetBranchName ? targetBranchName.replace(/^origin\//, '') : (sourceBranch || 'dev');

    if (!sourceBranch) {
      const bRes = await runGit(['branch', '--show-current'], repoPath);
      sourceBranch = bRes.stdout || 'dev';
      if (!targetBranchName) {
        targetBranch = sourceBranch;
      }
    } else if (!targetBranchName) {
      targetBranch = sourceBranch;
    }

    let gitDir = path.join(repoPath, '.git');
    try {
      if (fs.existsSync(gitDir) && fs.statSync(gitDir).isFile()) {
        const content = fs.readFileSync(gitDir, 'utf8');
        const match = content.match(/gitdir:\s*(.+)/i);
        if (match && match[1]) {
          gitDir = path.resolve(repoPath, match[1].trim());
        }
      }
    } catch {}

    const remoteRefPath = path.join(gitDir, 'refs', 'remotes', remote, targetBranch);
    let remoteExists = fs.existsSync(remoteRefPath);
    if (!remoteExists) {
      try {
        const packedPath = path.join(gitDir, 'packed-refs');
        if (fs.existsSync(packedPath)) {
          const content = fs.readFileSync(packedPath, 'utf8');
          remoteExists = content.includes(`refs/remotes/${remote}/${targetBranch}`);
        }
      } catch {}
    }

    if (!remoteExists) {
      const verifyRes = await runGit(['rev-parse', '--verify', '--quiet', `${remote}/${targetBranch}`], repoPath);
      remoteExists = verifyRes.code === 0;
    }

    let commits: OutgoingCommitItem[] = [];
    let allFiles: OutgoingCommitFile[] = [];

    if (remoteExists) {
      const range = `${remote}/${targetBranch}...${sourceBranch}`;
      const [logRes, remoteLogRes] = await Promise.all([
        runGit([
          'log',
          '--cherry-pick',
          '--right-only',
          '-m',
          '--date=iso',
          range,
          '--pretty=format:%x1e%H%x00%h%x00%an%x00%ae%x00%ad%x00%s%x00%P%x00%b%x1f',
          '--name-status',
          '-n', '300',
        ], repoPath),
        runGit([
          'log',
          `${remote}/${targetBranch}`,
          '-n', '50',
          '--pretty=format:%x1e%H%x00%s%x00%b%x00%ae%x00%an%x1f',
        ], repoPath),
      ]);

      const rawLog = (logRes.stdout || '').trim();
      if (rawLog) {
        const parsed = parseGitLogBatchOutput(rawLog);
        commits = parsed.commits;
        allFiles = parsed.allFiles;
      }

      try {
        const isSameBranchPush = sourceBranch === targetBranch;
        if (!isSameBranchPush) {
          const remoteCherryPickedSources = new Set<string>();

          if (remoteLogRes.code === 0 && remoteLogRes.stdout) {
            const records = remoteLogRes.stdout.split('\x1f').filter(Boolean);
            for (const rec of records) {
              const cleanRec = rec.replace(/^\x1e/, '');
              const parts = cleanRec.split('\x00');
              if (parts.length >= 3) {
                const rBody = parts[2] || '';
                const cpMatches = rBody.match(/cherry picked from commit ([a-f0-9]+)/gi);
                if (cpMatches) {
                  for (const m of cpMatches) {
                    const h = m.replace(/cherry picked from commit /i, '').trim();
                    if (h) remoteCherryPickedSources.add(h);
                  }
                }
              }
            }
          }

          const filteredCommits = commits.filter((c) => {
            if (
              remoteCherryPickedSources.has(c.hash) ||
              remoteCherryPickedSources.has(c.shortHash)
            ) {
              return false;
            }
            return true;
          });

          if (filteredCommits.length !== commits.length) {
            commits = filteredCommits;
            const fileMap = new Map<string, OutgoingCommitFile>();
            commits.forEach((c) => {
              (c.files || []).forEach((f) => {
                if (!fileMap.has(f.path)) fileMap.set(f.path, f);
              });
            });
            allFiles = Array.from(fileMap.values());
          }
        }
      } catch {}
    } else {
      const fullLog = await runGit([
        'log',
        sourceBranch,
        '-m',
        '--date=iso',
        '-n', '100',
        '--pretty=format:%x1e%H%x00%h%x00%an%x00%ae%x00%ad%x00%s%x00%P%x00%b%x1f',
        '--name-status',
      ], repoPath);
      const rawLog = (fullLog.stdout || '').trim();
      if (rawLog) {
        const parsed = parseGitLogBatchOutput(rawLog);
        commits = parsed.commits;
        allFiles = parsed.allFiles;
      }
    }

    return {
      sourceBranch,
      targetBranch,
      remote,
      commits,
      allFiles,
    };
  },

  // 31b. Selectively cherry-pick and push commits (Push Dialog selective push)
  async cherryPickAndPushCommits(
    repoPath: string,
    options: SelectivePushOptions
  ): Promise<{ success: boolean; message: string; rawOutput?: string; isConflict?: boolean }> {
    const remote = options.remote || 'origin';
    const targetBranch = options.targetBranch ? options.targetBranch.replace(/^origin\//, '') : 'dev';
    const newBranch = options.createNewBranch && options.newBranchName ? options.newBranchName.trim() : null;
    const finalTargetBranch = newBranch || targetBranch;

    if (!options.hashes || options.hashes.length === 0) {
      return { success: false, message: '未指定要推送的提交' };
    }

    let baseRef = `${remote}/${targetBranch}`;
    const checkRemote = await runGit(['rev-parse', '--verify', '--quiet', baseRef], repoPath);
    if (checkRemote.code !== 0) {
      const checkLocal = await runGit(['rev-parse', '--verify', '--quiet', targetBranch], repoPath);
      if (checkLocal.code === 0) {
        baseRef = targetBranch;
      } else {
        baseRef = 'HEAD';
      }
    }

    let sortedHashes = [...options.hashes];
    const topoRes = await runGit(['rev-list', '--reverse', '--no-walk', ...options.hashes], repoPath);
    if (topoRes.code === 0 && topoRes.stdout.trim()) {
      sortedHashes = topoRes.stdout.trim().split(/\r?\n/).filter(Boolean);
    }

    const tempDir = path.join(os.tmpdir(), `omnigit-push-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    const addRes = await runGit(['worktree', 'add', '--detach', tempDir, baseRef], repoPath);
    if (addRes.code !== 0) {
      return {
        success: false,
        message: `创建安全推送沙箱失败: ${addRes.stderr || addRes.stdout}`,
      };
    }

    try {
      let newlyPickedCount = 0;
      let alreadyAppliedCount = 0;

      for (const hash of sortedHashes) {
        let cpRes = await runGit(['cherry-pick', '-x', hash], tempDir);
        if (cpRes.code !== 0) {
          const rawErr = (cpRes.stdout + '\n' + cpRes.stderr).toLowerCase();
          if (rawErr.includes('is a merge')) {
            cpRes = await runGit(['cherry-pick', '-x', '-m', '1', hash], tempDir);
          }
        }
        if (cpRes.code !== 0) {
          const out = (cpRes.stdout + '\n' + cpRes.stderr).toLowerCase();
          if (
            out.includes('previous cherry-pick is now empty') ||
            out.includes('nothing to commit') ||
            out.includes('is now empty')
          ) {
            await runGit(['cherry-pick', '--skip'], tempDir);
            alreadyAppliedCount++;
            continue;
          }

          await runGit(['cherry-pick', '--abort'], tempDir);
          return {
            success: false,
            isConflict: true,
            message: `单独推送失败: 提交 ${hash.slice(0, 7)} 与未勾选的前置提交存在代码依赖，无法直接单独推送到主分支 (${remote}/${targetBranch})。建议连同前置提交一起勾选推送，或选择【新建补丁分支推送】。`,
          };
        } else {
          newlyPickedCount++;
        }
      }

      if (newlyPickedCount === 0 && alreadyAppliedCount > 0) {
        return {
          success: true,
          message: `所选提交的改动已全部存在于目标分支 (${remote}/${finalTargetBranch})，无需重复推送。`,
        };
      }

      const pushArgs = ['push'];
      if (options.force) {
        pushArgs.push('--force-with-lease');
      }
      if (newBranch) {
        pushArgs.push('-u');
      }
      pushArgs.push(remote, `HEAD:refs/heads/${finalTargetBranch}`);

      const pushRes = await runGit(pushArgs, tempDir);
      if (pushRes.code !== 0) {
        return {
          success: false,
          message: pushRes.stderr || pushRes.stdout || '推送远程仓库失败',
          rawOutput: pushRes.stderr || pushRes.stdout,
        };
      }

      const headRes = await runGit(['rev-parse', 'HEAD'], tempDir);
      const pushedCommit = headRes.code === 0 && headRes.stdout.trim() ? headRes.stdout.trim() : 'HEAD';

      if (pushedCommit && pushedCommit !== 'HEAD') {
        try {
          await runGit(['update-ref', `refs/remotes/${remote}/${finalTargetBranch}`, pushedCommit], repoPath);
        } catch (err) {
          console.warn('[gitService] update-ref tracking branch error:', err);
        }
      }

      if (newBranch) {
        await runGit(['branch', '-f', newBranch, pushedCommit], repoPath);
      } else {
        try {
          const curBranchRes = await runGit(['branch', '--show-current'], repoPath);
          const currentBranch = curBranchRes.stdout?.trim();
          if (currentBranch && targetBranch.toLowerCase() === currentBranch.toLowerCase()) {
            const rebaseRes = await runGit(['rebase', '--autostash', `${remote}/${targetBranch}`], repoPath);
            if (rebaseRes.code !== 0) {
              await runGit(['rebase', '--abort'], repoPath);
              console.warn('[gitService] Auto rebase after selective push failed, safely aborted:', rebaseRes.stderr || rebaseRes.stdout);
            }
          }
        } catch (err) {
          console.warn('[gitService] Auto rebase error:', err);
        }
      }

      runGit(['fetch', remote, finalTargetBranch], repoPath).catch(() => {});

      return {
        success: true,
        message: alreadyAppliedCount > 0
          ? `已成功将 ${newlyPickedCount} 个提交推送到远端 ${remote}/${finalTargetBranch}（另有 ${alreadyAppliedCount} 个提交此前已存在）`
          : `已成功将 ${newlyPickedCount} 个提交推送到远端 ${remote}/${finalTargetBranch}`,
        rawOutput: pushRes.stdout || pushRes.stderr,
      };
    } finally {
      await runGit(['worktree', 'remove', '--force', tempDir], repoPath);
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch {}
    }
  },

  // 31c. Sync commits to other branch (Commit Log context menu sync)
  async syncCommitsToBranch(
    repoPath: string,
    options: SyncCommitsOptions
  ): Promise<{ success: boolean; message: string; rawOutput?: string; isConflict?: boolean }> {
    const remote = options.remote || 'origin';
    const targetBranch = options.targetBranch ? options.targetBranch.replace(/^origin\//, '') : '';

    if (!targetBranch) {
      return { success: false, message: '未指定目标同步分支' };
    }
    if (!options.hashes || options.hashes.length === 0) {
      return { success: false, message: '未指定要同步的提交' };
    }

    let baseRef = targetBranch;
    const checkLocal = await runGit(['rev-parse', '--verify', '--quiet', targetBranch], repoPath);
    if (checkLocal.code !== 0) {
      const checkRemote = await runGit(['rev-parse', '--verify', '--quiet', `${remote}/${targetBranch}`], repoPath);
      if (checkRemote.code === 0) {
        await runGit(['branch', targetBranch, `${remote}/${targetBranch}`], repoPath);
        baseRef = targetBranch;
      } else {
        return { success: false, message: `目标分支 '${targetBranch}' 在本地和远程均不存在` };
      }
    }

    let sortedHashes = [...options.hashes];
    const topoRes = await runGit(['rev-list', '--reverse', '--no-walk', ...options.hashes], repoPath);
    if (topoRes.code === 0 && topoRes.stdout.trim()) {
      sortedHashes = topoRes.stdout.trim().split(/\r?\n/).filter(Boolean);
    }

    const tempDir = path.join(os.tmpdir(), `omnigit-sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    const addRes = await runGit(['worktree', 'add', '--detach', tempDir, baseRef], repoPath);
    if (addRes.code !== 0) {
      return {
        success: false,
        message: `创建安全同步沙箱失败: ${addRes.stderr || addRes.stdout}`,
      };
    }

    try {
      let newlyPickedCount = 0;
      let alreadyAppliedCount = 0;

      for (const hash of sortedHashes) {
        const cpRes = await runGit(['cherry-pick', '-x', hash], tempDir);
        if (cpRes.code !== 0) {
          const out = (cpRes.stdout + '\n' + cpRes.stderr).toLowerCase();
          if (
            out.includes('previous cherry-pick is now empty') ||
            out.includes('nothing to commit') ||
            out.includes('is now empty')
          ) {
            await runGit(['cherry-pick', '--skip'], tempDir);
            alreadyAppliedCount++;
            continue;
          }

          await runGit(['cherry-pick', '--abort'], tempDir);
          return {
            success: false,
            isConflict: true,
            message: `同步失败: 提交 ${hash.slice(0, 7)} 同步到 '${targetBranch}' 分支时产生代码冲突，无法自动拣选。请检查两分支代码差异。`,
          };
        } else {
          newlyPickedCount++;
        }
      }

      if (newlyPickedCount === 0 && alreadyAppliedCount > 0) {
        return {
          success: true,
          message: `所选提交的改动已全部存在于 '${targetBranch}' 分支，无需重复同步。`,
        };
      }

      const headRes = await runGit(['rev-parse', 'HEAD'], tempDir);
      const newHead = headRes.stdout.trim();

      const branchRes = await runGit(['branch', '-f', targetBranch, newHead], repoPath);
      if (branchRes.code !== 0) {
        return {
          success: false,
          message: `更新本地 '${targetBranch}' 分支引用失败: ${branchRes.stderr}`,
        };
      }

      let pushMsg = '';
      if (options.pushToRemote) {
        const pushRes = await runGit(['push', remote, `${targetBranch}:${targetBranch}`], repoPath);
        if (pushRes.code !== 0) {
          return {
            success: false,
            message: `提交已同步到本地 '${targetBranch}'，但推送到远端 ${remote}/${targetBranch} 失败: ${pushRes.stderr || pushRes.stdout}`,
          };
        }
        try {
          await runGit(['fetch', remote, targetBranch], repoPath);
        } catch {}
        pushMsg = ' 并已成功推送到远端';
      }

      return {
        success: true,
        message: alreadyAppliedCount > 0
          ? `已成功将 ${newlyPickedCount} 个提交同步到 '${targetBranch}' 分支${pushMsg}（另有 ${alreadyAppliedCount} 个提交此前已存在）`
          : `已成功将 ${newlyPickedCount} 个提交同步到 '${targetBranch}' 分支${pushMsg}`,
      };
    } finally {
      await runGit(['worktree', 'remove', '--force', tempDir], repoPath);
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch {}
    }
  },
};
