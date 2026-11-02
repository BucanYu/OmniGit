import * as fs from 'fs';
import * as path from 'path';
import { decodeGitPath } from '../../utils/gitPathUtils';
import {
  runGit,
  hasGitConflictMarkers,
  parseConflictMarkers,
} from './gitExec';
import { gitStatusIdentityOps } from './gitStatusIdentityOps';
import type { Conflict3WayData } from '../gitTypes';

export const gitMergeConflictOps = {
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
    preMergeHead?: string;
    mergedHead?: string;
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

    const headRes = await runGit(['rev-parse', 'HEAD'], repoPath);
    const preMergeHead = (headRes.stdout || '').trim();

    const res = await runGit(['merge', cleanBranch, '--no-edit'], repoPath, 180000);

    if (res.code === 0) {
      const isUpToDate = res.stdout.includes('Already up to date');
      const headAfterRes = await runGit(['rev-parse', 'HEAD'], repoPath);
      const mergedHead = (headAfterRes.stdout || '').trim();

      if (!isUpToDate && preMergeHead && mergedHead && preMergeHead !== mergedHead) {
        try {
          const gitDirRes = await runGit(['rev-parse', '--git-dir'], repoPath);
          const gitDir = gitDirRes.code === 0 && gitDirRes.stdout ? path.resolve(repoPath, gitDirRes.stdout.trim()) : path.join(repoPath, '.git');
          const undoFilePath = path.join(gitDir, 'omnigit_merge_undo.json');
          fs.writeFileSync(
            undoFilePath,
            JSON.stringify({
              repoPath,
              sourceBranch: cleanBranch,
              targetBranch,
              preMergeHead,
              mergedHead,
              timestamp: Date.now(),
            }, null, 2),
            'utf8'
          );
        } catch (err) {
          console.warn('Failed to save omnigit_merge_undo.json:', err);
        }
      }

      return {
        success: true,
        message: isUpToDate
          ? `Already up to date: '${targetBranch}' is already up to date with '${cleanBranch}'.`
          : `Merged ${cleanBranch} to ${targetBranch}`,
        targetBranch,
        sourceBranch: cleanBranch,
        preMergeHead,
        mergedHead,
        stdout: res.stdout,
      };
    } else {
      const errText = (res.stderr || res.stdout || 'Git 进程非零返回，未捕获到具体错误输出，请检查工作区或冲突文件').trim();
      const isConflict =
        errText.includes('CONFLICT') ||
        errText.includes('Automatic merge failed') ||
        errText.includes('unmerged files') ||
        fs.existsSync(path.join(repoPath, '.git', 'MERGE_HEAD'));
      return {
        success: false,
        message: isConflict
          ? `分支合并冲突: 将 '${cleanBranch}' 合并到 '${targetBranch}' 时检测到冲突文件，请解决冲突后提交。`
          : `合并分支 '${cleanBranch}' 到 '${targetBranch}' 失败: ${errText}`,
        targetBranch,
        sourceBranch: cleanBranch,
        preMergeHead,
        stdout: errText,
        isConflict,
      };
    }
  },

  // 32b. Undo last merge (revert HEAD to pre-merge commit)
  async undoMerge(
    repoPath: string,
    preMergeHead: string
  ): Promise<{ success: boolean; message: string }> {
    if (!repoPath || !preMergeHead) {
      return { success: false, message: 'Repository path and preMergeHead are required' };
    }

    const gitDirRes = await runGit(['rev-parse', '--git-dir'], repoPath);
    const gitDir = gitDirRes.code === 0 && gitDirRes.stdout ? path.resolve(repoPath, gitDirRes.stdout.trim()) : path.join(repoPath, '.git');
    if (fs.existsSync(path.join(gitDir, 'MERGE_HEAD'))) {
      await runGit(['merge', '--abort'], repoPath);
    }

    const resetRes = await runGit(['reset', '--hard', preMergeHead], repoPath);
    if (resetRes.code === 0) {
      try {
        const undoFilePath = path.join(gitDir, 'omnigit_merge_undo.json');
        if (fs.existsSync(undoFilePath)) {
          fs.unlinkSync(undoFilePath);
        }
      } catch {}

      return {
        success: true,
        message: `已成功撤销本次合并，分支已回滚至合并前状态 (${preMergeHead.slice(0, 7)})`,
      };
    } else {
      return {
        success: false,
        message: `撤销合并失败: ${resetRes.stderr || resetRes.stdout}`,
      };
    }
  },

  // 32c. Get Merge Undo Status (resolves pre-merge commit from persistent file, git log parents, or reflog)
  async getMergeUndoStatus(
    repoPath: string,
    activeBranch?: string
  ): Promise<{
    canUndo: boolean;
    repoPath: string;
    sourceBranch: string;
    targetBranch: string;
    preMergeHead: string;
    mergedHead: string;
    timestamp?: number;
  } | null> {
    if (!repoPath || !fs.existsSync(repoPath)) return null;

    try {
      const curBranchRes = await runGit(['branch', '--show-current'], repoPath);
      const currentBranch = (curBranchRes.stdout || '').trim();
      if (!currentBranch) return null;

      const headRes = await runGit(['rev-parse', 'HEAD'], repoPath);
      const currentHead = (headRes.stdout || '').trim();
      if (!currentHead) return null;

      const gitDirRes = await runGit(['rev-parse', '--git-dir'], repoPath);
      const gitDir = gitDirRes.code === 0 && gitDirRes.stdout ? path.resolve(repoPath, gitDirRes.stdout.trim()) : path.join(repoPath, '.git');
      const undoFilePath = path.join(gitDir, 'omnigit_merge_undo.json');

      const cleanActive = activeBranch ? activeBranch.replace(/^origin\//, '') : '';

      if (fs.existsSync(undoFilePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(undoFilePath, 'utf8'));
          if (
            data &&
            data.preMergeHead &&
            data.targetBranch === currentBranch &&
            data.mergedHead === currentHead
          ) {
            const cleanSource = (data.sourceBranch || '').replace(/^origin\//, '');
            if (!cleanActive || cleanActive.toLowerCase() === cleanSource.toLowerCase()) {
              return {
                canUndo: true,
                repoPath,
                sourceBranch: data.sourceBranch,
                targetBranch: data.targetBranch,
                preMergeHead: data.preMergeHead,
                mergedHead: data.mergedHead,
                timestamp: data.timestamp,
              };
            }
          }
        } catch {}
      }

      const logRes = await runGit(['log', '-1', '--pretty=format:%H%x00%P%x00%s'], repoPath);
      if (logRes.code === 0 && logRes.stdout) {
        const parts = logRes.stdout.split('\x00');
        const hash = parts[0]?.trim();
        const parents = (parts[1] || '').trim().split(/\s+/).filter(Boolean);
        const subject = parts[2] || '';

        if (hash === currentHead && parents.length >= 2) {
          const preMergeHead = parents[0];
          const p2 = parents[1];

          let detectedSource = '';
          const match =
            subject.match(/Merge (?:remote-tracking )?branch ['"]([^'"]+)['"]/i) ||
            subject.match(/Merge (?:remote-tracking )?branch (\S+)/i);
          if (match) {
            detectedSource = match[1].replace(/^origin\//, '');
          }

          if (cleanActive) {
            let isP2Match = false;
            try {
              const p2HeadRes = await runGit(['rev-parse', `refs/heads/${cleanActive}`], repoPath);
              if (p2HeadRes.code === 0 && p2HeadRes.stdout?.trim() === p2) {
                isP2Match = true;
              }
              if (!isP2Match) {
                const p2RemoteRes = await runGit(['rev-parse', `refs/remotes/origin/${cleanActive}`], repoPath);
                if (p2RemoteRes.code === 0 && p2RemoteRes.stdout?.trim() === p2) {
                  isP2Match = true;
                }
              }
            } catch {}

            if (
              isP2Match ||
              detectedSource.toLowerCase() === cleanActive.toLowerCase() ||
              subject.toLowerCase().includes(cleanActive.toLowerCase())
            ) {
              return {
                canUndo: true,
                repoPath,
                sourceBranch: cleanActive,
                targetBranch: currentBranch,
                preMergeHead,
                mergedHead: currentHead,
              };
            }
          } else if (detectedSource) {
            return {
              canUndo: true,
              repoPath,
              sourceBranch: detectedSource,
              targetBranch: currentBranch,
              preMergeHead,
              mergedHead: currentHead,
            };
          }
        }
      }

      const reflogRes = await runGit(['reflog', '-n', '3', '--format=%H%x00%gd%x00%gs'], repoPath);
      if (reflogRes.code === 0 && reflogRes.stdout) {
        const firstLine = reflogRes.stdout.split(/\r?\n/).filter(Boolean)[0];
        if (firstLine) {
          const [refHash, , refSubject] = firstLine.split('\x00');
          if (refHash?.trim() === currentHead && refSubject) {
            const ffMatch = refSubject.match(/^merge (?:origin\/)?([^:]+):/i);
            if (ffMatch) {
              const detectedSource = ffMatch[1].replace(/^origin\//, '');
              const origHeadPath = path.join(gitDir, 'ORIG_HEAD');
              let preMergeHead = '';
              if (fs.existsSync(origHeadPath)) {
                preMergeHead = fs.readFileSync(origHeadPath, 'utf8').trim();
              }
              if (!preMergeHead) {
                const head1Res = await runGit(['rev-parse', 'HEAD@{1}'], repoPath);
                if (head1Res.code === 0 && head1Res.stdout) {
                  preMergeHead = head1Res.stdout.trim();
                }
              }

              if (preMergeHead && preMergeHead !== currentHead) {
                if (!cleanActive || cleanActive.toLowerCase() === detectedSource.toLowerCase()) {
                  return {
                    canUndo: true,
                    repoPath,
                    sourceBranch: detectedSource,
                    targetBranch: currentBranch,
                    preMergeHead,
                    mergedHead: currentHead,
                  };
                }
              }
            }
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  },

  // 29. Stage single or multiple files (git add)
  async stageFile(repoPath: string, filePath: string): Promise<{ success: boolean; message: string }> {
    const cleanFilePath = decodeGitPath(filePath).replace(/\\/g, '/');
    const res = await runGit(['add', '--', cleanFilePath], repoPath);
    return {
      success: res.code === 0,
      message: res.code === 0 ? `Staged ${cleanFilePath}` : res.stderr || res.stdout,
    };
  },

  // 30. Unstage single or multiple files (git restore --staged)
  async unstageFile(repoPath: string, filePath: string): Promise<{ success: boolean; message: string }> {
    const cleanFilePath = decodeGitPath(filePath).replace(/\\/g, '/');
    let res = await runGit(['restore', '--staged', '--', cleanFilePath], repoPath);
    if (res.code !== 0) {
      res = await runGit(['reset', 'HEAD', '--', cleanFilePath], repoPath);
    }
    return {
      success: res.code === 0,
      message: res.code === 0 ? `Unstaged ${cleanFilePath}` : res.stderr || res.stdout,
    };
  },

  // 31. Get 3-way conflict data (Yours, Result, Theirs, Base)
  async getConflict3Way(repoPath: string, filePath: string): Promise<Conflict3WayData> {
    const cleanFilePath = decodeGitPath(filePath).replace(/\\/g, '/');
    const fullPath = path.resolve(repoPath, cleanFilePath);
    let result = '';
    try {
      if (fs.existsSync(fullPath)) {
        result = fs.readFileSync(fullPath, 'utf8');
      }
    } catch {}

    const hasConflictMarkers = hasGitConflictMarkers(result);

    if (!hasConflictMarkers && fs.existsSync(fullPath)) {
      await runGit(['add', '--', cleanFilePath], repoPath);
      return {
        filePath: cleanFilePath,
        repoPath,
        yours: result,
        theirs: result,
        base: result,
        result,
        cleanResult: result,
        conflictBlocks: [],
        alreadyResolved: true,
      };
    }

    const [baseRes, yoursRes, theirsRes] = await Promise.all([
      runGit(['show', `:1:${cleanFilePath}`], repoPath),
      runGit(['show', `:2:${cleanFilePath}`], repoPath),
      runGit(['show', `:3:${cleanFilePath}`], repoPath),
    ]);

    const base = baseRes.code === 0 ? baseRes.stdout : '';
    let yours = yoursRes.code === 0 ? yoursRes.stdout : '';
    let theirs = theirsRes.code === 0 ? theirsRes.stdout : '';

    if (!yours || !theirs) {
      const [headRes, mRes] = await Promise.all([
        !yours ? runGit(['show', `HEAD:${cleanFilePath}`], repoPath) : Promise.resolve(null),
        !theirs ? runGit(['show', `MERGE_HEAD:${cleanFilePath}`], repoPath) : Promise.resolve(null),
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
      filePath: cleanFilePath,
      repoPath,
      yours,
      theirs,
      base,
      result,
      cleanResult: parsed.cleanResult,
      conflictBlocks: parsed.blocks,
    };
  },

  // 32. Resolve conflict for a single file (yours, theirs, custom merged content, or mark-resolved)
  async resolveConflict(
    repoPath: string,
    filePath: string,
    resolution: 'yours' | 'theirs' | 'content' | 'mark-resolved',
    content?: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanFilePath = decodeGitPath(filePath).replace(/\\/g, '/');
    const fullPath = path.resolve(repoPath, cleanFilePath);

    if (resolution === 'mark-resolved') {
      let currentFileContent = '';
      if (fs.existsSync(fullPath)) {
        try {
          currentFileContent = fs.readFileSync(fullPath, 'utf8');
        } catch {}
      }
      if (hasGitConflictMarkers(currentFileContent)) {
        return {
          success: false,
          message: '标记解决失败: 文件中仍包含未解决的代码冲突标记 (<<<<<<< 或 =======)，请先清除冲突标记',
        };
      }
      await runGit(['add', '--', cleanFilePath], repoPath);
      return { success: true, message: `冲突已标记为已解决并已暂存: ${cleanFilePath}` };
    }

    if (resolution === 'yours') {
      const res = await runGit(['checkout', '--ours', '--', cleanFilePath], repoPath);
      if (res.code !== 0) {
        const yoursRes = await runGit(['show', `:2:${cleanFilePath}`], repoPath);
        if (yoursRes.code === 0) {
          fs.writeFileSync(fullPath, yoursRes.stdout, 'utf8');
        }
      }
      await runGit(['add', '--', cleanFilePath], repoPath);
      return { success: true, message: `Accepted local version (Yours) / 已采纳本地版本: ${cleanFilePath}` };
    }

    if (resolution === 'theirs') {
      const res = await runGit(['checkout', '--theirs', '--', cleanFilePath], repoPath);
      if (res.code !== 0) {
        const theirsRes = await runGit(['show', `:3:${cleanFilePath}`], repoPath);
        if (theirsRes.code === 0) {
          fs.writeFileSync(fullPath, theirsRes.stdout, 'utf8');
        }
      }
      await runGit(['add', '--', cleanFilePath], repoPath);
      return { success: true, message: `Accepted incoming version (Theirs) / 已采纳传入版本: ${cleanFilePath}` };
    }

    if (resolution === 'content' && typeof content === 'string') {
      if (hasGitConflictMarkers(content)) {
        return {
          success: false,
          message: 'Save failed / 保存失败: Code still contains unresolved conflict markers (<<<<<<< or =======)',
        };
      }
      fs.writeFileSync(fullPath, content, 'utf8');
      await runGit(['add', '--', cleanFilePath], repoPath);
      return { success: true, message: `Three-way merge applied / 三方合并结果已应用: ${cleanFilePath}` };
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
    const status = await gitStatusIdentityOps.getRepoStatus(repoPath);
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
};
