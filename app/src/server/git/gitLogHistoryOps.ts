import * as fs from 'fs';
import * as path from 'path';
import { decodeGitPath } from '../../utils/gitPathUtils';
import { runGit } from './gitExec';
import type {
  GitCommitItem,
  GitCommitFileChange,
  GitCommitDetails,
} from '../gitTypes';

export const gitLogHistoryOps = {
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
      '--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%ad%x1f%D%x1f%P%x1f%s',
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
      if (parts.length >= 8) {
        items.push({
          hash: parts[0],
          shortHash: parts[1],
          authorName: parts[2],
          authorEmail: parts[3],
          date: parts[4],
          refs: parts[5],
          parents: (parts[6] || '').split(' ').filter(Boolean),
          message: parts.slice(7).join('\x1f'),
        });
      } else if (parts.length >= 7) {
        items.push({
          hash: parts[0],
          shortHash: parts[1],
          authorName: parts[2],
          authorEmail: parts[3],
          date: parts[4],
          refs: parts[5],
          parents: [],
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
            oldPath = decodeGitPath(segs[1]).replace(/\\/g, '/');
            pathStr = decodeGitPath(segs[2] || segs[1]).replace(/\\/g, '/');
          } else if (statusCode === 'C') {
            status = 'copied';
            oldPath = decodeGitPath(segs[1]).replace(/\\/g, '/');
            pathStr = decodeGitPath(segs[2] || segs[1]).replace(/\\/g, '/');
          } else {
            status = 'unknown';
          }

          pathStr = decodeGitPath(pathStr).replace(/\\/g, '/');

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

    const cleanFilePath = decodeGitPath(filePath).replace(/\\/g, '/');

    const parentRes = await runGit(['rev-parse', '--verify', '--quiet', `${hash}^`], repoPath);
    const hasParent = parentRes.code === 0 && Boolean(parentRes.stdout);
    const parentHash = hasParent ? `${hash.slice(0, 7)}^` : 'Initial';

    let original = '';
    if (hasParent) {
      const oldRes = await runGit(['show', `${hash}^:${cleanFilePath}`], repoPath);
      if (oldRes.code === 0) {
        original = oldRes.stdout;
      }
    }

    let modified = '';
    const newRes = await runGit(['show', `${hash}:${cleanFilePath}`], repoPath);
    if (newRes.code === 0) {
      modified = newRes.stdout;
    }

    return {
      original,
      modified,
      filePath: cleanFilePath,
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

  // 23. Cherry-pick commit with comprehensive conflict detection
  async cherryPickCommit(
    repoPath: string,
    hash: string
  ): Promise<{ success: boolean; message: string; isConflict?: boolean; stdout?: string }> {
    const res = await runGit(['cherry-pick', hash], repoPath);
    if (res.code === 0) {
      return {
        success: true,
        message: res.stdout || res.stderr || `Cherry-picked ${hash.slice(0, 7)} into current branch`,
        stdout: res.stdout,
      };
    }

    const errText = (res.stderr || res.stdout || '').trim();
    const gitDir = path.join(repoPath, '.git');
    const isConflict =
      errText.includes('CONFLICT') ||
      errText.includes('Automatic cherry-pick failed') ||
      errText.includes('unmerged files') ||
      errText.includes('could not apply') ||
      fs.existsSync(path.join(gitDir, 'CHERRY_PICK_HEAD'));

    return {
      success: false,
      isConflict,
      message: isConflict
        ? `Cherry-Pick 产生代码冲突: 提交 ${hash.slice(0, 7)} 存在冲突文件，请在工作区解决冲突或放弃。`
        : `Cherry-Pick 失败: ${errText}`,
      stdout: errText,
    };
  },

  // 26. Get HEAD / last commit details
  async getLastCommit(repoPath: string): Promise<GitCommitDetails | null> {
    if (!repoPath || !fs.existsSync(repoPath)) return null;
    const headRes = await runGit(['rev-parse', 'HEAD'], repoPath);
    if (headRes.code !== 0 || !headRes.stdout) return null;
    return gitLogHistoryOps.getCommitDetails(repoPath, headRes.stdout.trim());
  },

  // 27. Get recent commit messages from git log
  async getRecentCommitMessages(repoPath: string, limit = 15): Promise<string[]> {
    if (!repoPath || !fs.existsSync(repoPath)) return [];
    const res = await runGit(['log', `-${limit}`, '--pretty=format:%s'], repoPath);
    if (res.code !== 0 || !res.stdout) return [];
    return res.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  },
};
