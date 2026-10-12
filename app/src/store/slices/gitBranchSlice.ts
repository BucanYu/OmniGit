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
} from '../storeHelpers';
import { getLocale, type AppLanguage } from '../../locales';

export const createGitBranchSlice = (set: any, get: any) => ({
  branches: [],

  isBranchMenuOpen: false,

  branchOperationLoading: null,

  isPushModalOpen: false,

  pushModalSourceBranch: null,

  pushModalTargetBranch: null,

  outgoingCommitsData: null,

  outgoingCommitsLoading: false,

  pushingLoading: false,

  pushError: null,

  setIsBranchMenuOpen: (open) => set({ isBranchMenuOpen: open }),

  checkoutBranch: async (branchName: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return;

    const isZh = get().language === 'zh-CN';
    set({
      isBranchMenuOpen: false,
      branchOperationLoading: {
        operating: true,
        type: 'checkout',
        branchName,
        message: isZh ? `正在切换分支至 '${branchName}'...` : `Checking out branch '${branchName}'...`,
      },
    });

    try {
      const res = await fetch('/api/git/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          branch: branchName,
        }),
      });
      const result = await res.json();
      if (result.success) {
        // 1. Optimistically update currentBranch & isCurrent at 0ms
        const normPath = currentProject.path.toLowerCase();
        set((curr) => ({
          projects: (curr.projects || []).map((p) =>
            p && p.id === currentProject.id ? { ...p, currentBranch: branchName } : p
          ),
          branches: (curr.branches || []).map((b) => ({
            ...b,
            isCurrent: Boolean(b && b.name === branchName),
          })),
          notification: {
            id: Date.now(),
            title: isZh ? `已成功切换到分支 '${branchName}'` : `Switched to branch '${branchName}'`,
            detail: result.message,
            type: 'info',
          },
        }));

        // 2. Sync snapshot cache & disk snapshot
        try {
          const cached = repoSnapshotCache.get(normPath);
          if (cached) {
            cached.currentBranch = branchName;
            cached.branches = (cached.branches || []).map((b) => ({
              ...b,
              isCurrent: Boolean(b && b.name === branchName),
            }));
            cached.lastUpdated = Date.now();
            saveLocalSnapshot(normPath, cached);
          }
        } catch {}

        // 3. Force reload repo status & commit logs (bypassing 15s TTL)
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        const errorDetail = result.message || (isZh ? '切换分支失败，请检查是否有未提交的代码冲突或文件被占用' : 'Checkout failed. Please ensure there are no uncommitted conflicts');
        set({
          notification: {
            id: Date.now(),
            title: isZh ? '切换分支失败' : 'Checkout Failed',
            detail: errorDetail,
            type: 'warning',
          },
        });
      }
    } catch (e: any) {
      set({
        notification: {
          id: Date.now(),
          title: isZh ? '切换分支异常' : 'Checkout Exception',
          detail: e.message || (isZh ? '网络请求或服务通信失败' : 'Network request or service communication failed'),
          type: 'warning',
        },
      });
    } finally {
      set({ branchOperationLoading: null });
    }
  },

  deleteBranch: async (branchName: string, force = false, isRemote = false) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    const isZh = get().language === 'zh-CN';
    const isActuallyRemote = Boolean(isRemote || branchName.startsWith('origin/') || branchName.includes('/'));

    try {
      const res = await fetch('/api/git/delete-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          branch: branchName,
          force,
          isRemote: isActuallyRemote,
        }),
      });
      const result = await res.json();
      if (result.success) {
        // 1. Optimistically remove deleted branch at 0ms
        const normPath = currentProject.path.toLowerCase();
        set((curr) => ({
          branches: curr.branches.filter(
            (b) => b.name !== branchName && b.name !== `origin/${branchName}` && `origin/${b.name}` !== branchName
          ),
          notification: {
            id: Date.now(),
            title: isZh
              ? (isActuallyRemote ? `成功删除远程分支 '${branchName}'` : `成功删除分支 '${branchName}'`)
              : (isActuallyRemote ? `Deleted remote branch '${branchName}'` : `Deleted branch '${branchName}'`),
            detail: result.message || (isZh ? '分支已成功删除。' : 'Branch deleted successfully.'),
            type: 'success',
          },
        }));

        // 2. Sync snapshot cache & disk snapshot
        const cached = repoSnapshotCache.get(normPath);
        if (cached) {
          cached.branches = cached.branches.filter(
            (b) => b.name !== branchName && b.name !== `origin/${branchName}` && `origin/${b.name}` !== branchName
          );
          cached.lastUpdated = Date.now();
          saveLocalSnapshot(normPath, cached);
        }

        // 3. Force refresh in background (bypassing 15s TTL, non-blocking for instantaneous UI response)
        get().loadRepoData(currentProject.path, true).catch((e) => console.error('Background refresh failed', e));
        get().pollWorkspaceSyncStatus();
      } else {
        // Global error notification with exact Git output
        set({
          notification: {
            id: Date.now(),
            title: isZh
              ? (isActuallyRemote ? `删除远程分支 '${branchName}' 失败` : `删除分支 '${branchName}' 失败`)
              : (isActuallyRemote ? `Failed to delete remote branch '${branchName}'` : `Failed to delete branch '${branchName}'`),
            detail: result.message || (isZh ? '未知 Git 错误，请检查网络或分支保护规则。' : 'Unknown Git error.'),
            type: 'error',
          },
        });
      }
      return result;
    } catch (e: any) {
      const errorMsg = e.message || (isZh ? '网络异常或 Git 命令执行失败' : 'Failed to delete branch');
      set({
        notification: {
          id: Date.now(),
          title: isZh ? `删除分支 '${branchName}' 失败` : `Failed to delete branch '${branchName}'`,
          detail: errorMsg,
          type: 'error',
        },
      });
      return { success: false, message: errorMsg };
    }
  },

  updateProject: async () => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return;

    const t = getLocale(get().language);
    set({
      isBranchMenuOpen: false,
      branchOperationLoading: {
        operating: true,
        type: 'pull',
        branchName: currentProject.currentBranch,
        message: t.notifications.pullUpdating,
      },
      notification: {
        id: Date.now(),
        title: t.notifications.pullUpdating,
        detail: t.notifications.pullUpdatingDetail,
        type: 'info',
      },
    });

    try {
      const res = await fetch('/api/git/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
        }),
      });
      const result = await res.json();

      if (result.success) {
        // 1. Instantly clear incoming count in active state (0ms latency!)
        const normPath = currentProject.path.toLowerCase();
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === currentProject.id ? { ...p, incoming: 0 } : p
          ),
          branches: state.branches.map((b) =>
            b.isCurrent || b.name === currentProject.currentBranch ? { ...b, incoming: 0 } : b
          ),
          notification: {
            id: Date.now(),
            title: t.notifications.pullComplete,
            detail: result.message?.includes('Already up to date')
              ? t.notifications.pullAlreadyUpToDate
              : (result.message || t.notifications.pullUpdatedCommits),
            linkText: t.notifications.pullViewCommits,
            type: 'success',
          },
        }));

        // 2. Immediately update memory and disk cache snapshots
        const cached = repoSnapshotCache.get(normPath);
        if (cached) {
          cached.incoming = 0;
          cached.branches = cached.branches.map((b) =>
            b.isCurrent || b.name === currentProject.currentBranch ? { ...b, incoming: 0 } : b
          );
          cached.lastUpdated = Date.now();
          saveLocalSnapshot(normPath, cached);
        }

        // 3. Force-refresh status & commit logs (bypassing 15s TTL) and sync workspace
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        set({
          notification: {
            id: Date.now(),
            title: t.notifications.pullNotice,
            detail: result.message || t.notifications.pullNoticeDetail,
            type: 'warning',
          },
        });
      }
    } catch (e: any) {
      set({
        notification: {
          id: Date.now(),
          title: t.notifications.pullFailed,
          detail: e.message,
          type: 'warning',
        },
      });
    } finally {
      set({ branchOperationLoading: null });
    }
  },

  toggleBranchFavorite: (branchName: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return;

    const favKey = `omnigit_fav_branches_${currentProject.path}`;
    const updatedBranches = state.branches.map((b) =>
      b.name === branchName ? { ...b, isFavorite: !b.isFavorite } : b
    );
    const newFavs = updatedBranches.filter((b) => b.isFavorite).map((b) => b.name);
    safeLocalStorageSetItem(favKey, JSON.stringify(newFavs));
    set({ branches: updatedBranches });
  },

  renameBranch: async (oldName: string, newName: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    try {
      const res = await fetch('/api/git/rename-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, oldName, newName }),
      });
      const data = await res.json();
      if (data.success) {
        // 1. Optimistically rename branch at 0ms
        const normPath = currentProject.path.toLowerCase();
        set((curr) => ({
          branches: curr.branches.map((b) => (b.name === oldName ? { ...b, name: newName } : b)),
          projects: curr.projects.map((p) =>
            p.id === currentProject.id && p.currentBranch === oldName
              ? { ...p, currentBranch: newName }
              : p
          ),
          notification: {
            id: Date.now(),
            title: 'Branch Renamed',
            detail: `'${oldName}' -> '${newName}'`,
            type: 'success',
          },
        }));

        // 2. Sync snapshot cache & disk snapshot
        const cached = repoSnapshotCache.get(normPath);
        if (cached) {
          if (cached.currentBranch === oldName) cached.currentBranch = newName;
          cached.branches = cached.branches.map((b) => (b.name === oldName ? { ...b, name: newName } : b));
          cached.lastUpdated = Date.now();
          saveLocalSnapshot(normPath, cached);
        }

        // 3. Force refresh
        await get().loadRepoData(currentProject.path, true);
        get().pollWorkspaceSyncStatus();
      } else {
        set({
          notification: {
            id: Date.now(),
            title: 'Rename Failed',
            detail: data.message,
            type: 'warning',
          },
        });
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  rebaseBranch: async (upstream: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    try {
      const res = await fetch('/api/git/rebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, upstream }),
      });
      const data = await res.json();
      if (data.success) {
        set({
          notification: {
            id: Date.now(),
            title: 'Rebase Succeeded',
            detail: `Rebased onto '${upstream}'`,
            type: 'success',
          },
        });
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        set({
          notification: {
            id: Date.now(),
            title: 'Rebase Failed',
            detail: data.message,
            type: 'warning',
          },
        });
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  checkoutAndRebase: async (branch: string, onto: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    const isZh = get().language === 'zh-CN';
    set({
      branchOperationLoading: {
        operating: true,
        type: 'rebase',
        branchName: branch,
        message: isZh ? `正在切换到 '${branch}' 并变基到 '${onto}'...` : `Checking out '${branch}' and rebasing onto '${onto}'...`,
      },
    });

    try {
      const res = await fetch('/api/git/checkout-and-rebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, branch, onto }),
      });
      const data = await res.json();
      if (data.success) {
        // 1. Optimistically switch branch at 0ms
        const normPath = currentProject.path.toLowerCase();
        set((curr) => ({
          projects: curr.projects.map((p) =>
            p.id === currentProject.id ? { ...p, currentBranch: branch } : p
          ),
          branches: curr.branches.map((b) => ({ ...b, isCurrent: b.name === branch })),
          notification: {
            id: Date.now(),
            title: 'Checkout & Rebase Succeeded',
            detail: `Checked out '${branch}' and rebased onto '${onto}'`,
            type: 'success',
          },
        }));

        // 2. Sync snapshot cache & disk snapshot
        const cached = repoSnapshotCache.get(normPath);
        if (cached) {
          cached.currentBranch = branch;
          cached.branches = cached.branches.map((b) => ({ ...b, isCurrent: b.name === branch }));
          cached.lastUpdated = Date.now();
          saveLocalSnapshot(normPath, cached);
        }

        // 3. Force refresh
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        set({
          notification: {
            id: Date.now(),
            title: 'Checkout & Rebase Failed',
            detail: data.message,
            type: 'warning',
          },
        });
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    } finally {
      set({ branchOperationLoading: null });
    }
  },

  checkoutAndUpdate: async (branch: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    const isZh = state.language === 'zh-CN';
    set({
      branchOperationLoading: {
        operating: true,
        type: 'update',
        branchName: branch,
        message: isZh ? `正在切换并更新分支 '${branch}'...` : `Checking out and updating branch '${branch}'...`,
      },
    });

    try {
      const res = await fetch('/api/git/checkout-and-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, branch }),
      });
      const data = await res.json();
      if (data.success) {
        // 1. Optimistically switch branch and clear incoming count at 0ms
        const normPath = currentProject.path.toLowerCase();
        set((curr) => ({
          projects: curr.projects.map((p) =>
            p.id === currentProject.id ? { ...p, currentBranch: branch, incoming: 0 } : p
          ),
          branches: curr.branches.map((b) =>
            b.name === branch ? { ...b, isCurrent: true, incoming: 0 } : { ...b, isCurrent: false }
          ),
          notification: {
            id: Date.now(),
            title: 'Checkout & Update Succeeded',
            detail: `Switched to '${branch}' and updated from remote`,
            type: 'success',
          },
        }));

        // 2. Sync snapshot cache & disk snapshot
        const cached = repoSnapshotCache.get(normPath);
        if (cached) {
          cached.currentBranch = branch;
          cached.incoming = 0;
          cached.branches = cached.branches.map((b) =>
            b.name === branch ? { ...b, isCurrent: true, incoming: 0 } : { ...b, isCurrent: false }
          );
          cached.lastUpdated = Date.now();
          saveLocalSnapshot(normPath, cached);
        }

        // 3. Force refresh
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        set({
          notification: {
            id: Date.now(),
            title: 'Checkout & Update Failed',
            detail: data.message,
            type: 'warning',
          },
        });
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    } finally {
      set({ branchOperationLoading: null });
    }
  },

  openPushModal: async (branchName?: string, targetBranchName?: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return;

    const source = branchName || currentProject.currentBranch;
    const target = targetBranchName || source;
    const cacheKey = `${currentProject.path.toLowerCase()}::${source}::${target}`;
    const cached = outgoingCommitsMemoryCache.get(cacheKey) || (get().pushModalSourceBranch === source ? get().outgoingCommitsData : null);

    // 0ms INSTANT UI HYDRATION: If cached data exists, render modal and commits IMMEDIATELY with ZERO spinner delay!
    set({
      isPushModalOpen: true,
      pushModalSourceBranch: source,
      pushModalTargetBranch: target,
      outgoingCommitsLoading: !cached,
      pushError: null,
      isBranchMenuOpen: false,
      outgoingCommitsData: cached || null,
    });

    try {
      const url = `/api/git/outgoing-commits?path=${encodeURIComponent(currentProject.path)}&branch=${encodeURIComponent(source)}&targetBranch=${encodeURIComponent(target)}`;
      const res = await fetch(url);
      const data: OutgoingCommitsData = await res.json();
      outgoingCommitsMemoryCache.set(cacheKey, data);
      set({
        outgoingCommitsData: data,
        pushModalTargetBranch: data.targetBranch || target,
        outgoingCommitsLoading: false,
      });
    } catch (e: any) {
      set({
        outgoingCommitsLoading: false,
        pushError: `Failed to load outgoing commits: ${e.message}`,
      });
    }
  },

  prefetchOutgoingCommits: (repoPath?: string, branchName?: string, targetBranchName?: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    const pPath = repoPath || currentProject?.path;
    if (!pPath) return;
    const source = branchName || currentProject?.currentBranch || 'main';
    const target = targetBranchName || source;
    const cacheKey = `${pPath.toLowerCase()}::${source}::${target}`;
    if (outgoingCommitsMemoryCache.has(cacheKey)) return;

    fetch(`/api/git/outgoing-commits?path=${encodeURIComponent(pPath)}&branch=${encodeURIComponent(source)}&targetBranch=${encodeURIComponent(target)}`)
      .then((res) => res.json())
      .then((data: OutgoingCommitsData) => {
        if (data && Array.isArray(data.commits)) {
          outgoingCommitsMemoryCache.set(cacheKey, data);
        }
      })
      .catch(() => {});
  },

  switchPushSourceBranch: async (sourceBranch: string, targetBranch?: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return;

    const target = targetBranch || sourceBranch;
    set({
      pushModalSourceBranch: sourceBranch,
      pushModalTargetBranch: target,
      outgoingCommitsLoading: true,
      pushError: null,
    });

    try {
      const url = `/api/git/outgoing-commits?path=${encodeURIComponent(currentProject.path)}&branch=${encodeURIComponent(sourceBranch)}&targetBranch=${encodeURIComponent(target)}`;
      const res = await fetch(url);
      const data: OutgoingCommitsData = await res.json();
      set({
        outgoingCommitsData: data,
        pushModalTargetBranch: data.targetBranch || target,
        outgoingCommitsLoading: false,
      });
    } catch (e: any) {
      set({
        outgoingCommitsLoading: false,
        pushError: `Failed to load outgoing commits: ${e.message}`,
      });
    }
  },

  closePushModal: () => {
    set({
      isPushModalOpen: false,
      pushModalSourceBranch: null,
      pushModalTargetBranch: null,
      pushError: null,
      pushingLoading: false,
    });
  },

  executePush: async (options?: { force?: boolean; tags?: boolean; targetCommit?: string; targetBranch?: string }) => {
    const t = getLocale(get().language);
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    const sourceBranch = get().pushModalSourceBranch || currentProject?.currentBranch || '';
    const targetBranch = options?.targetBranch || get().pushModalTargetBranch || sourceBranch;
    if (!currentProject || !sourceBranch) {
      return { success: false, message: 'No active project or branch' };
    }

    set({ pushingLoading: true, pushError: null });

    try {
      const res = await fetch('/api/git/push-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          branch: sourceBranch,
          targetBranch,
          targetCommit: options?.targetCommit,
          force: options?.force,
          tags: options?.tags,
        }),
      });
      const data = await res.json();
      set({ pushingLoading: false });

      if (data.success) {
        // 1. Instantly clear outgoing count in active state (0ms latency!)
        set((state) => ({
          isPushModalOpen: false,
          projects: state.projects.map((p) =>
            p.id === currentProject.id ? { ...p, outgoing: 0 } : p
          ),
          branches: state.branches.map((b) =>
            b.name === sourceBranch || b.name === targetBranch || b.isCurrent ? { ...b, outgoing: 0 } : b
          ),
          notification: {
            id: Date.now(),
            title: t.notifications.pushSuccess,
            detail: data.message || t.notifications.pushSuccessDetail,
            type: 'success',
          },
        }));

        // 2. Immediately update cache snapshot & persist to disk
        const cached = repoSnapshotCache.get(currentProject.path.toLowerCase());
        if (cached) {
          cached.outgoing = 0;
          cached.branches = cached.branches.map((b) =>
            b.name === sourceBranch || b.name === targetBranch || b.isCurrent ? { ...b, outgoing: 0 } : b
          );
          cached.lastUpdated = Date.now();
          saveLocalSnapshot(currentProject.path.toLowerCase(), cached);
        }

        // 3. Force-refresh status & commit logs (bypassing 15s TTL) and sync workspace
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        set({
          pushError: data.message,
          notification: {
            id: Date.now(),
            title: t.notifications.pushFailed,
            detail: data.message,
            type: 'warning',
          },
        });
      }
      return data;
    } catch (e: any) {
      const errorMsg = e?.message === 'Failed to fetch'
        ? t.notifications.networkError
        : (e?.message || t.notifications.pushFailed);
      set({ pushingLoading: false, pushError: errorMsg });
      return { success: false, message: errorMsg };
    }
  },

  pushSelectedCommits: async (options: {
    hashes: string[];
    targetBranch: string;
    createNewBranch?: boolean;
    newBranchName?: string;
    force?: boolean;
  }) => {
    const t = getLocale(get().language);
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    const sourceBranch = get().pushModalSourceBranch || currentProject?.currentBranch || '';
    if (!currentProject || !options.hashes || options.hashes.length === 0) {
      return { success: false, message: t.notifications.noValidProjectOrCommit };
    }

    set({ pushingLoading: true, pushError: null });

    try {
      const res = await fetch('/api/git/push-commits-selective', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          hashes: options.hashes,
          sourceBranch,
          targetBranch: options.targetBranch,
          createNewBranch: options.createNewBranch,
          newBranchName: options.newBranchName,
          force: options.force,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData.error || errorData.message || `Request failed (${res.status})`;
        set({
          pushingLoading: false,
          pushError: msg,
          notification: {
            id: Date.now(),
            title: t.notifications.selectivePushFailed,
            detail: msg,
            type: 'warning',
          },
        });
        return { success: false, message: msg };
      }

      const data = await res.json();
      set({ pushingLoading: false });

      if (data.success) {
        const pushedHashes = new Set(options.hashes.map((h) => h.toLowerCase()));
        const pushedCount = options.hashes.length;
        const currentOut = currentProject.outgoing || 0;
        const nextOut = Math.max(0, currentOut - pushedCount);
        outgoingCommitsMemoryCache.clear();

        // 1. Immediately and optimistically update projects, branches, and outgoingCommitsData in 0ms!
        set((state) => ({
          isPushModalOpen: false,
          pushError: null,
          notification: {
            id: Date.now(),
            title: t.notifications.selectivePushSuccess,
            detail: data.message || t.notifications.selectivePushSuccessDetail,
            type: 'success',
          },
          projects: state.projects.map((p) =>
            p.id === currentProject.id ? { ...p, outgoing: nextOut } : p
          ),
          branches: state.branches.map((b) =>
            b.name === sourceBranch || b.name === options.targetBranch || b.isCurrent
              ? { ...b, outgoing: nextOut }
              : b
          ),
          outgoingCommitsData: state.outgoingCommitsData
            ? {
                ...state.outgoingCommitsData,
                commits: state.outgoingCommitsData.commits.filter(
                  (c) => !pushedHashes.has(c.hash.toLowerCase()) && !pushedHashes.has(c.shortHash.toLowerCase())
                ),
              }
            : null,
        }));

        // 2. Immediately update memory cache snapshot
        const cached = repoSnapshotCache.get(currentProject.path.toLowerCase());
        if (cached) {
          cached.outgoing = nextOut;
          cached.branches = cached.branches.map((b) =>
            b.name === sourceBranch || b.name === options.targetBranch || b.isCurrent
              ? { ...b, outgoing: nextOut }
              : b
          );
          saveLocalSnapshot(currentProject.path.toLowerCase(), cached);
        }

        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        set({
          pushError: data.message,
          notification: {
            id: Date.now(),
            title: t.notifications.selectivePushFailed,
            detail: data.message,
            type: 'warning',
          },
        });
      }
      return data;
    } catch (e: any) {
      console.error('[pushSelectedCommits] Push error:', e);
      // Auto-verification on network failure or server reload:
      try {
        const checkUrl = `/api/git/outgoing-commits?path=${encodeURIComponent(currentProject.path)}&branch=${encodeURIComponent(sourceBranch)}&targetBranch=${encodeURIComponent(options.targetBranch)}`;
        const checkRes = await fetch(checkUrl);
        if (checkRes.ok) {
          const checkData: OutgoingCommitsData = await checkRes.json();
          const targetHashes = new Set(options.hashes.map((h) => h.toLowerCase()));
          const stillOutgoing = checkData.commits?.some((c) =>
            targetHashes.has(c.hash.toLowerCase()) ||
            targetHashes.has(c.shortHash.toLowerCase()) ||
            options.hashes.some((h) => h.toLowerCase().startsWith(c.shortHash.toLowerCase()))
          );
          if (!stillOutgoing) {
            // Commit was pushed successfully!
            const pushedCount = options.hashes.length;
            const currentOut = currentProject.outgoing || 0;
            const nextOut = Math.max(0, currentOut - pushedCount);
            outgoingCommitsMemoryCache.clear();

            set((state) => ({
              pushingLoading: false,
              isPushModalOpen: false,
              pushError: null,
              outgoingCommitsData: checkData,
              notification: {
                id: Date.now(),
                title: t.notifications.selectivePushSuccess,
                detail: t.notifications.selectivePushSuccessDetail,
                type: 'success',
              },
              projects: state.projects.map((p) =>
                p.id === currentProject.id ? { ...p, outgoing: nextOut } : p
              ),
              branches: state.branches.map((b) =>
                b.name === sourceBranch || b.name === options.targetBranch || b.isCurrent
                  ? { ...b, outgoing: nextOut }
                  : b
              ),
            }));
            await get().loadRepoData(currentProject.path, true);
            await get().fetchCommitLogs(true);
            get().pollWorkspaceSyncStatus();
            return { success: true, message: t.notifications.selectivePushSuccessDetail };
          }
        }
      } catch {}

      const errorMsg = e?.message === 'Failed to fetch'
        ? t.notifications.networkError
        : (e?.message || t.notifications.selectivePushFailed);
      set({ pushingLoading: false, pushError: errorMsg });
      return { success: false, message: errorMsg };
    }
  },

  syncCommitsToBranch: async (options: {
    hashes: string[];
    targetBranch: string;
    pushToRemote?: boolean;
  }) => {
    const t = getLocale(get().language);
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject || !options.hashes || options.hashes.length === 0) {
      return { success: false, message: t.notifications.noValidProjectOrCommit };
    }

    try {
      const res = await fetch('/api/git/sync-commits-to-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          hashes: options.hashes,
          targetBranch: options.targetBranch,
          pushToRemote: options.pushToRemote,
        }),
      });
      const data = await res.json();

      if (data.success) {
        set({
          notification: {
            id: Date.now(),
            title: t.notifications.syncBranchSuccess,
            detail: data.message,
            type: 'success',
          },
        });
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
      } else {
        set({
          notification: {
            id: Date.now(),
            title: t.notifications.syncBranchFailed,
            detail: data.message,
            type: 'warning',
          },
        });
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  pushBranch: async (branch: string) => {
    await get().openPushModal(branch);
    return { success: true, message: 'Opened Push dialog' };
  },

  checkoutTagOrRevision: async (target: string, newBranchName?: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    try {
      const res = await fetch('/api/git/checkout-tag-revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, target, newBranchName }),
      });
      const data = await res.json();
      if (data.success) {
        set({
          notification: {
            id: Date.now(),
            title: 'Checkout Succeeded',
            detail: newBranchName
              ? `Created and checked out branch '${newBranchName}' at '${target}'`
              : `Checked out '${target}'`,
            type: 'success',
          },
        });
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        set({
          notification: {
            id: Date.now(),
            title: 'Checkout Failed',
            detail: data.message,
            type: 'warning',
          },
        });
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  showBranchDiffWithWorkingTree: async (branch: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return;

    try {
      const res = await fetch(
        `/api/git/branch-working-diff?path=${encodeURIComponent(currentProject.path)}&branch=${encodeURIComponent(branch)}`
      );
      const data = await res.json();
      const isZh = get().language === 'zh-CN';
      set({
        isRightPanelOpen: true,
        historicalDiff: {
          original: '',
          modified: data.stdout || (isZh ? '(没有检测到与工作区的差异)' : '(No diff with working tree)'),
          filePath: `Branch Diff: ${branch} vs Working Tree`,
          oldLabel: `Branch '${branch}'`,
          newLabel: isZh ? '工作区修改' : 'Working Tree',
          commitHash: branch,
        },
      });
    } catch (e: any) {
      console.error('Failed to get branch diff:', e);
    }
  },

  compareBranchWithCurrent: async (branch: string) => {
    const state = get();
    state.setActiveTab('log');
    state.setLogFilters({ branch });
  }
});
