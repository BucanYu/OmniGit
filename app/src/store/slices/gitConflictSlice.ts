import type { AppState, GitFileItem, BranchItem, GitProject, GitCommitItem, GitCommitDetails, LogFilterOptions, BranchOperationState, HistoricalDiffState, OutgoingCommitsData, LightRepoCache, WorkspaceGroupItem, WorkspaceRepoItem, RecentProjectItem, GitUserInfo, GitAuthorItem, WorkspaceGitAccount, Conflict3WayData } from '../types';
import {
  normalizePath,
  broadcastWorkspaceChanged,
  buildWorkspaceRecord,
  safeLocalStorageSetItem,
  scheduleWorkspacesDiskBackup,
  normalizeSnapshotFiles,
  sanitizeSnapshot,
  getLocalSnapshot,
  loadDiskSnapshot,
  saveLocalSnapshot,
  initialLanguage,
  initialTheme,
  currentWorkspaceId,
  repoSnapshotCache,
  syncRuntime,
} from '../storeHelpers';
import { getLocale, type AppLanguage } from '../../locales';

export const createGitConflictSlice = (set: any, get: any) => ({
  isMerging: false,

  mergeMessage: '',

  mergeSourceBranch: undefined,

  conflictedCount: 0,

  conflictsDialogOpen: false,

  conflictsDialogMinimized: false,

  lastMergeUndoInfo: null,

  openConflictsDialog: () => set({ conflictsDialogOpen: true, conflictsDialogMinimized: false }),

  closeConflictsDialog: () => set({ conflictsDialogOpen: false, conflictsDialogMinimized: false }),

  setConflictsDialogMinimized: (minimized: boolean) => set({ conflictsDialogMinimized: minimized }),

  threeWayMergeOpen: false,

  threeWayMergeMinimized: false,

  threeWayLoading: false,

  threeWayData: null,

  closeThreeWayMerge: () => {
    set({
      threeWayMergeOpen: false,
      threeWayMergeMinimized: false,
      threeWayLoading: false,
      threeWayData: null,
      conflictsDialogOpen: false,
      conflictsDialogMinimized: false,
    });
  },

  setThreeWayMergeMinimized: (minimized: boolean) => set({ threeWayMergeMinimized: minimized }),

  mergeBranch: async (branchName: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    const isZh = get().language === 'zh-CN';
    set({
      isBranchMenuOpen: false,
      branchOperationLoading: {
        operating: true,
        type: 'merge',
        branchName,
        message: isZh ? `正在合并分支 '${branchName}' 到当前分支...` : `Merging branch '${branchName}' into current branch...`,
      },
    });

    try {
      const res = await fetch('/api/git/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          branch: branchName,
        }),
      });
      const data = await res.json();

      if (data.success) {
        if (data.preMergeHead) {
          set({
            lastMergeUndoInfo: {
              repoPath: currentProject.path,
              sourceBranch: branchName,
              targetBranch: data.targetBranch || currentProject.currentBranch,
              preMergeHead: data.preMergeHead,
              timestamp: Date.now(),
            },
          });
        }

        // Pop up the exact IDEA-matching notification balloon: "Merged <source> to <target>"
        set({
          notification: {
            id: Date.now(),
            title: `Merged ${data.sourceBranch} to ${data.targetBranch}`,
            detail: data.stdout && !data.stdout.includes('Already up to date') ? data.stdout : undefined,
            type: 'success',
          },
        });
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        const hasConflicts = Boolean(data.isConflict) || get().files.some((f) => f.status === 'conflict') || get().isMerging;
        set({
          conflictsDialogOpen: hasConflicts,
          conflictsDialogMinimized: false,
          activeTab: hasConflicts ? 'commit' : get().activeTab,
          notification: {
            id: Date.now(),
            title: hasConflicts
              ? (isZh ? '分支合并冲突' : 'Merge Conflicts')
              : (isZh ? '分支合并失败' : 'Merge Failed'),
            detail: hasConflicts
              ? (isZh ? '合并发生代码冲突，已自动为您打开冲突解决窗口。您可以进行三方可视化合并或放弃合并。' : data.message)
              : data.message,
            type: 'warning',
          },
        });
      }
      return data;
    } catch (e: any) {
      const errorMsg = e.message || (isZh ? '网络通信异常或请求超时' : 'Network error or request timeout');
      set({
        notification: {
          id: Date.now(),
          title: isZh ? '分支合并异常' : 'Merge Exception',
          detail: errorMsg,
          type: 'warning',
        },
      });
      return { success: false, message: errorMsg };
    } finally {
      set({ branchOperationLoading: null });
    }
  },

  checkMergeUndoStatus: async (repoPath?: string, activeBranch?: string) => {
    const targetPath = repoPath || get().projects.find((p) => p.id === get().activeProjectId)?.path;
    if (!targetPath) return null;
    try {
      const res = await fetch('/api/git/merge-undo-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: targetPath,
          activeBranch,
        }),
      });
      const data = await res.json();
      if (data && data.canUndo && data.preMergeHead) {
        const info = {
          repoPath: data.repoPath || targetPath,
          sourceBranch: data.sourceBranch,
          targetBranch: data.targetBranch,
          preMergeHead: data.preMergeHead,
          timestamp: data.timestamp || Date.now(),
        };
        set({ lastMergeUndoInfo: info });
        return info;
      }
      return null;
    } catch {
      return null;
    }
  },

  undoLastMerge: async (sourceBranch?: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    const isZh = state.language === 'zh-CN';
    const targetBranchName = sourceBranch || state.lastMergeUndoInfo?.sourceBranch;

    set({ branchOperationLoading: { type: 'merge', branchName: targetBranchName || 'undo' } });

    try {
      // 1. Resolve merge undo status dynamically from backend (handles crashes, restarts, and cache wipes)
      let preMergeHead = '';
      let detectedSource = targetBranchName || '';
      let detectedTarget = currentProject.currentBranch;

      const statusRes = await fetch('/api/git/merge-undo-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          activeBranch: targetBranchName,
        }),
      });
      const statusData = await statusRes.json();

      if (statusData && statusData.canUndo && statusData.preMergeHead) {
        preMergeHead = statusData.preMergeHead;
        detectedSource = statusData.sourceBranch || detectedSource;
        detectedTarget = statusData.targetBranch || detectedTarget;
      } else if (state.lastMergeUndoInfo?.preMergeHead) {
        preMergeHead = state.lastMergeUndoInfo.preMergeHead;
        detectedSource = state.lastMergeUndoInfo.sourceBranch || detectedSource;
        detectedTarget = state.lastMergeUndoInfo.targetBranch || detectedTarget;
      }

      if (!preMergeHead) {
        set({
          notification: {
            id: Date.now(),
            title: isZh ? '未检测到可撤销的合并' : 'No Merge to Undo',
            detail: isZh
              ? `当前分支 (${currentProject.currentBranch}) 最近未检测到合并 '${targetBranchName || ''}' 的记录，或已有后续新提交。为了代码安全，未执行回滚。`
              : `No recent merge from '${targetBranchName || ''}' detected on current branch, or newer commits exist.`,
            type: 'warning',
          },
        });
        return { success: false, message: 'No merge to undo' };
      }

      // 2. Perform safe reset to pre-merge commit
      const res = await fetch('/api/git/undo-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          preMergeHead,
        }),
      });
      const data = await res.json();
      if (data.success) {
        set({
          lastMergeUndoInfo: null,
          notification: {
            id: Date.now(),
            title: isZh ? '已撤销合并' : 'Merge Undone',
            detail: isZh
              ? `已成功撤销将 '${detectedSource}' 合并到 '${detectedTarget}' 的操作，分支已安全回滚至 (${preMergeHead.slice(0, 7)})`
              : data.message,
            type: 'info',
          },
        });
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        set({
          notification: {
            id: Date.now(),
            title: isZh ? '撤销合并失败' : 'Failed to Undo Merge',
            detail: data.message,
            type: 'warning',
          },
        });
      }
      return data;
    } catch (e: any) {
      const errorMsg = e.message || (isZh ? '请求异常' : 'Request error');
      return { success: false, message: errorMsg };
    } finally {
      set({ branchOperationLoading: null });
    }
  },

  openThreeWayMerge: async (filePath: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject || !filePath) return;

    // 1. Immediately pop up the modal window with loading state (0ms perceived latency!)
    set({
      threeWayMergeOpen: true,
      threeWayMergeMinimized: false,
      threeWayLoading: true,
      threeWayData: null,
      conflictsDialogOpen: false,
    });

    try {
      const res = await fetch('/api/git/conflict-3way', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, file: filePath }),
      });
      const data: Conflict3WayData = await res.json();
      if (data.alreadyResolved) {
        set({ threeWayMergeOpen: false, threeWayLoading: false });
        const notif = getLocale(get().language).notifications;
        get().setNotification({
          id: Date.now(),
          title: notif.conflictResolvedExternally,
          detail: filePath,
          type: 'success',
        });
        await get().loadRepoData(currentProject.path, true);
        return;
      }
      set({
        threeWayData: data,
        threeWayLoading: false,
      });
    } catch (e: any) {
      set({ threeWayMergeOpen: false, threeWayLoading: false });
      const notif = getLocale(get().language).notifications;
      get().setNotification({
        id: Date.now(),
        title: notif.failedLoad3WayData,
        detail: e.message,
        type: 'warning',
      });
    }
  },

  resolveConflictQuick: async (filePath: string, resolution: 'yours' | 'theirs') => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject || !filePath) return;

    try {
      const res = await fetch('/api/git/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          file: filePath,
          resolution,
        }),
      });
      const data = await res.json();

      if (data.success) {
        const notif = getLocale(get().language).notifications;
        get().setNotification({
          id: Date.now(),
          title: resolution === 'yours' ? notif.acceptedYours : notif.acceptedTheirs,
          detail: filePath,
          type: 'success',
        });
        await get().loadRepoData(currentProject.path, true);
        get().pollWorkspaceSyncStatus();

        // Check if any conflicts remain
        const remainingConflicts = get().files.filter((f) => f.status === 'conflict');
        if (remainingConflicts.length === 0) {
          set({ conflictsDialogOpen: false, threeWayMergeOpen: false });
        }
      } else {
        const notif = getLocale(get().language).notifications;
        get().setNotification({
          id: Date.now(),
          title: notif.conflictResolveFailed,
          detail: data.message,
          type: 'warning',
        });
      }
    } catch (e: any) {
      console.error('Failed to resolve conflict:', e);
    }
  },

  markConflictResolved: async (filePath: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject || !filePath) return;

    try {
      const res = await fetch('/api/git/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          file: filePath,
          resolution: 'mark-resolved',
        }),
      });
      const data = await res.json();

      if (data.success) {
        const notif = getLocale(get().language).notifications;
        get().setNotification({
          id: Date.now(),
          title: notif.markedResolvedAndStaged,
          detail: filePath,
          type: 'success',
        });
        await get().loadRepoData(currentProject.path, true);
        get().pollWorkspaceSyncStatus();

        const remainingConflicts = get().files.filter((f) => f.status === 'conflict');
        if (remainingConflicts.length === 0) {
          set({ conflictsDialogOpen: false, threeWayMergeOpen: false });
        }
      } else {
        const notif = getLocale(get().language).notifications;
        get().setNotification({
          id: Date.now(),
          title: notif.markResolvedFailed,
          detail: data.message,
          type: 'warning',
        });
      }
    } catch (e: any) {
      console.error('Failed to mark conflict resolved:', e);
    }
  },

  resolveAllConflictsQuick: async (resolution: 'yours' | 'theirs') => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return;

    const conflictFiles = get().files.filter((f) => f.status === 'conflict');
    for (const f of conflictFiles) {
      await fetch('/api/git/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          file: f.path,
          resolution,
        }),
      });
    }

    const notif = getLocale(get().language).notifications;
    get().setNotification({
      id: Date.now(),
      title: resolution === 'yours' ? notif.allAcceptedYours : notif.allAcceptedTheirs,
      detail: notif.allResolvedDetail(conflictFiles.length),
      type: 'success',
    });

    await get().loadRepoData(currentProject.path, true);
    get().pollWorkspaceSyncStatus();
    set({ conflictsDialogOpen: false });
  },

  applyThreeWayMergeResult: async (filePath: string, finalContent: string): Promise<boolean> => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject || !filePath) return false;

    try {
      const res = await fetch('/api/git/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          file: filePath,
          resolution: 'content',
          content: finalContent,
        }),
      });
      const data = await res.json();

      if (data.success) {
        // 1. Immediately close the modal window! Zero waiting time!
        set({ threeWayMergeOpen: false, threeWayData: null, threeWayLoading: false });
        const notif = getLocale(get().language).notifications;
        get().setNotification({
          id: Date.now(),
          title: notif.threeWayApplied,
          detail: filePath,
          type: 'success',
        });

        // 2. Perform background repo status refresh non-blockingly (bypassing 15s TTL)
        get().loadRepoData(currentProject.path, true).then(() => {
          get().pollWorkspaceSyncStatus();
          const remainingConflicts = get().files.filter((f) => f.status === 'conflict');
          if (remainingConflicts.length === 0) {
            set({ conflictsDialogOpen: false });
          }
        });
        return true;
      } else {
        const notif = getLocale(get().language).notifications;
        alert(data.message || notif.mergeError('failed'));
        return false;
      }
    } catch (e: any) {
      const notif = getLocale(get().language).notifications;
      alert(notif.mergeError(e.message));
      return false;
    }
  },

  abortCurrentMerge: async () => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return;

    try {
      const res = await fetch('/api/git/abort-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path }),
      });
      const data = await res.json();

      const notif = getLocale(get().language).notifications;
      set({
        conflictsDialogOpen: false,
        threeWayMergeOpen: false,
        threeWayData: null,
        notification: {
          id: Date.now(),
          title: data.success ? notif.mergeAborted : notif.abortMergeFailed,
          detail: data.message,
          type: data.success ? 'info' : 'warning',
        },
      });
      await get().loadRepoData(currentProject.path, true);
      await get().fetchCommitLogs(true);
      get().pollWorkspaceSyncStatus();
    } catch (e: any) {
      console.error('Failed to abort merge:', e);
    }
  },

  completeMergeCommit: async (customMsg?: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return;

    try {
      const message = customMsg || get().mergeMessage || get().commitMessage || 'Merge conflicts resolved';
      const res = await fetch('/api/git/complete-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, message }),
      });
      const data = await res.json();

      const notif = getLocale(get().language).notifications;
      if (data.success) {
        set({
          commitMessage: '',
          isMerging: false,
          notification: {
            id: Date.now(),
            title: notif.mergeSuccess,
            detail: message,
            type: 'success',
          },
        });
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        get().setNotification({
          id: Date.now(),
          title: notif.mergeCommitFailed,
          detail: data.message,
          type: 'warning',
        });
      }
    } catch (e: any) {
      console.error('Failed to complete merge:', e);
    }
  },

  pollWorkspaceSyncStatus: async () => {
    if (syncRuntime.isPollingBatchSync) return;
    const state = get();
    const paths = state.workspaceProjectPaths.length > 0
      ? state.workspaceProjectPaths
      : state.projects.map((p) => p.path);
    if (!paths || paths.length === 0) return;

    syncRuntime.isPollingBatchSync = true;
    try {
      const res = await fetch('/api/git/batch-sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths }),
      });
      if (!res.ok) return;
      const statuses: Array<{ path: string; currentBranch: string; upstream?: string; incoming: number; outgoing: number }> = await res.json();
      if (!Array.isArray(statuses)) return;

      // Keep all cached repo branches and counters fresh without triggering disk status scans
      statuses.forEach((s) => {
        const cached = repoSnapshotCache.get(s.path.toLowerCase());
        if (cached) {
          cached.currentBranch = s.currentBranch || cached.currentBranch;
          if (s.upstream !== undefined) cached.upstream = s.upstream;
          cached.incoming = s.incoming;
          cached.outgoing = s.outgoing;
        }
      });

      set((curr) => {
        let hasChanged = false;
        const activeProj = curr.projects.find((p) => p.id === curr.activeProjectId);
        const activeMatch = activeProj
          ? statuses.find((s) => s.path.toLowerCase() === activeProj.path.toLowerCase())
          : null;

        const updatedProjects = curr.projects.map((p) => {
          const match = statuses.find((s) => s.path.toLowerCase() === p.path.toLowerCase());
          if (match) {
            const isDiff =
              (match.currentBranch && match.currentBranch !== p.currentBranch) ||
              (match.upstream !== undefined && match.upstream !== p.upstream) ||
              match.incoming !== p.incoming ||
              match.outgoing !== p.outgoing;
            if (isDiff) {
              hasChanged = true;
              return {
                ...p,
                currentBranch: match.currentBranch || p.currentBranch,
                upstream: match.upstream !== undefined ? match.upstream : p.upstream,
                incoming: match.incoming,
                outgoing: match.outgoing,
              };
            }
          }
          return p;
        });

        let updatedBranches = curr.branches;
        if (activeMatch) {
          updatedBranches = curr.branches.map((b) => {
            const isCurr = b.isCurrent || b.name === (activeMatch.currentBranch || activeProj?.currentBranch);
            if (isCurr && (b.outgoing !== activeMatch.outgoing || b.incoming !== activeMatch.incoming)) {
              hasChanged = true;
              return {
                ...b,
                outgoing: activeMatch.outgoing,
                incoming: activeMatch.incoming,
              };
            }
            return b;
          });
        }

        if (!hasChanged) {
          return {}; // Do not trigger store change if nothing changed
        }

        return {
          projects: updatedProjects,
          branches: updatedBranches,
        };
      });
    } catch {
      // Quietly ignore background poll error
    } finally {
      syncRuntime.isPollingBatchSync = false;
    }
  }
});
