import {
  safeLocalStorageSetItem,
  saveLocalSnapshot,
  repoSnapshotCache,
} from '../storeHelpers';
import { getLocale } from '../../locales';
import { createGitPushSlice } from './gitPushSlice';

export const createGitBranchSlice = (set: any, get: any) => ({
  ...createGitPushSlice(set, get),

  branches: [],

  isBranchMenuOpen: false,

  branchOperationLoading: null,

  setIsBranchMenuOpen: (open: boolean) => set({ isBranchMenuOpen: open }),

  checkoutBranch: async (branchName: string) => {
    const currentProject = get().projects.find((p: any) => p.id === get().activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    const isZh = get().language === 'zh-CN';
    set({
      isBranchMenuOpen: false,
      branchOperationLoading: {
        operating: true,
        type: 'checkout',
        branchName,
        message: isZh
          ? `正在切换分支至 '${branchName}' 并自动拉取代码...`
          : `Checking out branch '${branchName}' and pulling remote code...`,
      },
    });

    try {
      const res = await fetch('/api/git/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          branch: branchName,
          autoPull: true,
        }),
      });
      const result = await res.json();
      if (result.success) {
        const normPath = currentProject.path.toLowerCase();

        let notifType: 'info' | 'success' | 'warning' = 'info';
        let notifTitle = isZh ? `已切换到分支 '${branchName}'` : `Switched to branch '${branchName}'`;

        if (result.pullStatus === 'updated') {
          notifType = 'success';
          notifTitle = isZh
            ? `已切换至 '${branchName}' 并已拉取最新代码`
            : `Switched to '${branchName}' and pulled updates`;
        } else if (result.pullStatus === 'already-up-to-date') {
          notifType = 'success';
          notifTitle = isZh
            ? `已切换至 '${branchName}'（远端代码已是最新）`
            : `Switched to '${branchName}' (Already up to date)`;
        } else if (result.pullStatus === 'no-upstream') {
          notifType = 'info';
          notifTitle = isZh
            ? `已切换至 '${branchName}'（本地分支，未关联远端）`
            : `Switched to '${branchName}' (Local branch, no upstream)`;
        } else if (result.pullStatus === 'conflict') {
          notifType = 'warning';
          notifTitle = isZh
            ? `已切换至 '${branchName}'，自动拉取产生代码冲突`
            : `Switched to '${branchName}' (Pull conflict detected)`;
        } else if (result.pullStatus === 'failed') {
          notifType = 'warning';
          notifTitle = isZh
            ? `已切换至 '${branchName}'，但拉取远端代码失败`
            : `Switched to '${branchName}' (Failed to pull remote updates)`;
        }

        set((curr: any) => ({
          projects: (curr.projects || []).map((p: any) =>
            p && p.id === currentProject.id
              ? { ...p, currentBranch: branchName, incoming: result.pulled ? 0 : p.incoming }
              : p
          ),
          branches: (curr.branches || []).map((b: any) => ({
            ...b,
            isCurrent: Boolean(b && b.name === branchName),
            incoming: b && b.name === branchName && result.pulled ? 0 : b.incoming,
          })),
          notification: {
            id: Date.now(),
            title: notifTitle,
            detail: result.message,
            type: notifType,
          },
        }));

        try {
          const cached = repoSnapshotCache.get(normPath);
          if (cached) {
            cached.currentBranch = branchName;
            if (result.pulled) cached.incoming = 0;
            cached.branches = (cached.branches || []).map((b) => ({
              ...b,
              isCurrent: Boolean(b && b.name === branchName),
              incoming: b && b.name === branchName && result.pulled ? 0 : b.incoming,
            }));
            cached.lastUpdated = Date.now();
            saveLocalSnapshot(normPath, cached);
          }
        } catch {}

        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
        return result;
      } else {
        const errorDetail =
          result.message ||
          (isZh
            ? '切换分支失败，请检查是否有未提交的代码冲突或文件被占用'
            : 'Checkout failed. Please ensure there are no uncommitted conflicts');
        set({
          notification: {
            id: Date.now(),
            title: isZh ? '切换分支失败' : 'Checkout Failed',
            detail: errorDetail,
            type: 'warning',
          },
        });
        return result;
      }
    } catch (e: any) {
      const errorMsg =
        e.message || (isZh ? '网络请求或服务通信失败' : 'Network request or service communication failed');
      set({
        notification: {
          id: Date.now(),
          title: isZh ? '切换分支异常' : 'Checkout Exception',
          detail: errorMsg,
          type: 'warning',
        },
      });
      return { success: false, message: errorMsg };
    } finally {
      set({ branchOperationLoading: null });
    }
  },

  deleteBranch: async (branchName: string, force = false, isRemote = false) => {
    const currentProject = get().projects.find((p: any) => p.id === get().activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    const isZh = get().language === 'zh-CN';
    const isActuallyRemote = Boolean(
      isRemote || branchName.startsWith('origin/') || branchName.includes('/')
    );

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
        const normPath = currentProject.path.toLowerCase();
        set((curr: any) => ({
          branches: curr.branches.filter(
            (b: any) =>
              b.name !== branchName &&
              b.name !== `origin/${branchName}` &&
              `origin/${b.name}` !== branchName
          ),
          notification: {
            id: Date.now(),
            title: isZh
              ? isActuallyRemote
                ? `成功删除远程分支 '${branchName}'`
                : `成功删除分支 '${branchName}'`
              : isActuallyRemote
              ? `Deleted remote branch '${branchName}'`
              : `Deleted branch '${branchName}'`,
            detail: result.message || (isZh ? '分支已成功删除。' : 'Branch deleted successfully.'),
            type: 'success',
          },
        }));

        const cached = repoSnapshotCache.get(normPath);
        if (cached) {
          cached.branches = cached.branches.filter(
            (b) =>
              b.name !== branchName &&
              b.name !== `origin/${branchName}` &&
              `origin/${b.name}` !== branchName
          );
          cached.lastUpdated = Date.now();
          saveLocalSnapshot(normPath, cached);
        }

        get()
          .loadRepoData(currentProject.path, true)
          .catch((e: any) => console.error('Background refresh failed', e));
        get().pollWorkspaceSyncStatus();
      } else {
        set({
          notification: {
            id: Date.now(),
            title: isZh
              ? isActuallyRemote
                ? `删除远程分支 '${branchName}' 失败`
                : `删除分支 '${branchName}' 失败`
              : isActuallyRemote
              ? `Failed to delete remote branch '${branchName}'`
              : `Failed to delete branch '${branchName}'`,
            detail:
              result.message ||
              (isZh ? '未知 Git 错误，请检查网络或分支保护规则。' : 'Unknown Git error.'),
            type: 'error',
          },
        });
      }
      return result;
    } catch (e: any) {
      const errorMsg =
        e.message || (isZh ? '网络异常或 Git 命令执行失败' : 'Failed to delete branch');
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
    const currentProject = get().projects.find((p: any) => p.id === get().activeProjectId);
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
        const normPath = currentProject.path.toLowerCase();
        set((state: any) => ({
          projects: state.projects.map((p: any) =>
            p.id === currentProject.id ? { ...p, incoming: 0 } : p
          ),
          branches: state.branches.map((b: any) =>
            b.isCurrent || b.name === currentProject.currentBranch ? { ...b, incoming: 0 } : b
          ),
          notification: {
            id: Date.now(),
            title: t.notifications.pullComplete,
            detail: result.message?.includes('Already up to date')
              ? t.notifications.pullAlreadyUpToDate
              : result.message || t.notifications.pullUpdatedCommits,
            linkText: t.notifications.pullViewCommits,
            type: 'success',
          },
        }));

        const cached = repoSnapshotCache.get(normPath);
        if (cached) {
          cached.incoming = 0;
          cached.branches = cached.branches.map((b) =>
            b.isCurrent || b.name === currentProject.currentBranch ? { ...b, incoming: 0 } : b
          );
          cached.lastUpdated = Date.now();
          saveLocalSnapshot(normPath, cached);
        }

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
    const currentProject = state.projects.find((p: any) => p.id === state.activeProjectId);
    if (!currentProject) return;

    const favKey = `omnigit_fav_branches_${currentProject.path}`;
    const updatedBranches = state.branches.map((b: any) =>
      b.name === branchName ? { ...b, isFavorite: !b.isFavorite } : b
    );
    const newFavs = updatedBranches.filter((b: any) => b.isFavorite).map((b: any) => b.name);
    safeLocalStorageSetItem(favKey, JSON.stringify(newFavs));
    set({ branches: updatedBranches });
  },

  renameBranch: async (oldName: string, newName: string) => {
    const state = get();
    const currentProject = state.projects.find((p: any) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    try {
      const res = await fetch('/api/git/rename-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, oldName, newName }),
      });
      const data = await res.json();
      if (data.success) {
        const normPath = currentProject.path.toLowerCase();
        set((curr: any) => ({
          branches: curr.branches.map((b: any) =>
            b.name === oldName ? { ...b, name: newName } : b
          ),
          projects: curr.projects.map((p: any) =>
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

        const cached = repoSnapshotCache.get(normPath);
        if (cached) {
          if (cached.currentBranch === oldName) cached.currentBranch = newName;
          cached.branches = cached.branches.map((b) =>
            b.name === oldName ? { ...b, name: newName } : b
          );
          cached.lastUpdated = Date.now();
          saveLocalSnapshot(normPath, cached);
        }

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
    const currentProject = state.projects.find((p: any) => p.id === state.activeProjectId);
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
    const currentProject = state.projects.find((p: any) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    const isZh = get().language === 'zh-CN';
    set({
      branchOperationLoading: {
        operating: true,
        type: 'rebase',
        branchName: branch,
        message: isZh
          ? `正在切换到 '${branch}' 并变基到 '${onto}'...`
          : `Checking out '${branch}' and rebasing onto '${onto}'...`,
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
        const normPath = currentProject.path.toLowerCase();
        set((curr: any) => ({
          projects: curr.projects.map((p: any) =>
            p.id === currentProject.id ? { ...p, currentBranch: branch } : p
          ),
          branches: curr.branches.map((b: any) => ({ ...b, isCurrent: b.name === branch })),
          notification: {
            id: Date.now(),
            title: 'Checkout & Rebase Succeeded',
            detail: `Checked out '${branch}' and rebased onto '${onto}'`,
            type: 'success',
          },
        }));

        const cached = repoSnapshotCache.get(normPath);
        if (cached) {
          cached.currentBranch = branch;
          cached.branches = cached.branches.map((b) => ({ ...b, isCurrent: b.name === branch }));
          cached.lastUpdated = Date.now();
          saveLocalSnapshot(normPath, cached);
        }

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
    const currentProject = state.projects.find((p: any) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    const isZh = state.language === 'zh-CN';
    set({
      branchOperationLoading: {
        operating: true,
        type: 'update',
        branchName: branch,
        message: isZh
          ? `正在切换并更新分支 '${branch}'...`
          : `Checking out and updating branch '${branch}'...`,
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
        const normPath = currentProject.path.toLowerCase();
        set((curr: any) => ({
          projects: curr.projects.map((p: any) =>
            p.id === currentProject.id ? { ...p, currentBranch: branch, incoming: 0 } : p
          ),
          branches: curr.branches.map((b: any) =>
            b.name === branch ? { ...b, isCurrent: true, incoming: 0 } : { ...b, isCurrent: false }
          ),
          notification: {
            id: Date.now(),
            title: 'Checkout & Update Succeeded',
            detail: `Switched to '${branch}' and updated from remote`,
            type: 'success',
          },
        }));

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

  checkoutTagOrRevision: async (target: string, newBranchName?: string) => {
    const state = get();
    const currentProject = state.projects.find((p: any) => p.id === state.activeProjectId);
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
    const currentProject = state.projects.find((p: any) => p.id === state.activeProjectId);
    if (!currentProject) return;

    try {
      const res = await fetch(
        `/api/git/branch-working-diff?path=${encodeURIComponent(
          currentProject.path
        )}&branch=${encodeURIComponent(branch)}`
      );
      const data = await res.json();
      const isZh = get().language === 'zh-CN';
      set({
        isRightPanelOpen: true,
        historicalDiff: {
          original: '',
          modified:
            data.stdout || (isZh ? '(没有检测到与工作区的差异)' : '(No diff with working tree)'),
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
  },
});
