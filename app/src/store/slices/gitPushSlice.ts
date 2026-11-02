import type { OutgoingCommitsData } from '../types';
import {
  saveLocalSnapshot,
  repoSnapshotCache,
  outgoingCommitsMemoryCache,
} from '../storeHelpers';
import { getLocale } from '../../locales';

export const createGitPushSlice = (set: any, get: any) => ({
  isPushModalOpen: false,

  pushModalSourceBranch: null,

  pushModalTargetBranch: null,

  outgoingCommitsData: null,

  outgoingCommitsLoading: false,

  pushingLoading: false,

  pushError: null,

  openPushModal: async (branchName?: string, targetBranchName?: string) => {
    const currentProject = get().projects.find((p: any) => p.id === get().activeProjectId);
    if (!currentProject) return;

    const source = branchName || currentProject.currentBranch;
    const target = targetBranchName || source;
    const cacheKey = `${currentProject.path.toLowerCase()}::${source}::${target}`;
    const cached =
      outgoingCommitsMemoryCache.get(cacheKey) ||
      (get().pushModalSourceBranch === source ? get().outgoingCommitsData : null);

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
      const url = `/api/git/outgoing-commits?path=${encodeURIComponent(
        currentProject.path
      )}&branch=${encodeURIComponent(source)}&targetBranch=${encodeURIComponent(target)}`;
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
    const currentProject = get().projects.find((p: any) => p.id === get().activeProjectId);
    const pPath = repoPath || currentProject?.path;
    if (!pPath) return;
    const source = branchName || currentProject?.currentBranch || 'main';
    const target = targetBranchName || source;
    const cacheKey = `${pPath.toLowerCase()}::${source}::${target}`;
    if (outgoingCommitsMemoryCache.has(cacheKey)) return;

    fetch(
      `/api/git/outgoing-commits?path=${encodeURIComponent(pPath)}&branch=${encodeURIComponent(
        source
      )}&targetBranch=${encodeURIComponent(target)}`
    )
      .then((res) => res.json())
      .then((data: OutgoingCommitsData) => {
        if (data && Array.isArray(data.commits)) {
          outgoingCommitsMemoryCache.set(cacheKey, data);
        }
      })
      .catch(() => {});
  },

  switchPushSourceBranch: async (sourceBranch: string, targetBranch?: string) => {
    const currentProject = get().projects.find((p: any) => p.id === get().activeProjectId);
    if (!currentProject) return;

    const target = targetBranch || sourceBranch;
    set({
      pushModalSourceBranch: sourceBranch,
      pushModalTargetBranch: target,
      outgoingCommitsLoading: true,
      pushError: null,
    });

    try {
      const url = `/api/git/outgoing-commits?path=${encodeURIComponent(
        currentProject.path
      )}&branch=${encodeURIComponent(sourceBranch)}&targetBranch=${encodeURIComponent(target)}`;
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

  executePush: async (options?: {
    force?: boolean;
    tags?: boolean;
    targetCommit?: string;
    targetBranch?: string;
  }) => {
    const t = getLocale(get().language);
    const currentProject = get().projects.find((p: any) => p.id === get().activeProjectId);
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
        set((state: any) => ({
          isPushModalOpen: false,
          projects: state.projects.map((p: any) =>
            p.id === currentProject.id ? { ...p, outgoing: 0 } : p
          ),
          branches: state.branches.map((b: any) =>
            b.name === sourceBranch || b.name === targetBranch || b.isCurrent
              ? { ...b, outgoing: 0 }
              : b
          ),
          notification: {
            id: Date.now(),
            title: t.notifications.pushSuccess,
            detail: data.message || t.notifications.pushSuccessDetail,
            type: 'success',
          },
        }));

        const cached = repoSnapshotCache.get(currentProject.path.toLowerCase());
        if (cached) {
          cached.outgoing = 0;
          cached.branches = cached.branches.map((b) =>
            b.name === sourceBranch || b.name === targetBranch || b.isCurrent
              ? { ...b, outgoing: 0 }
              : b
          );
          cached.lastUpdated = Date.now();
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
            title: t.notifications.pushFailed,
            detail: data.message,
            type: 'warning',
          },
        });
      }
      return data;
    } catch (e: any) {
      const errorMsg =
        e?.message === 'Failed to fetch'
          ? t.notifications.networkError
          : e?.message || t.notifications.pushFailed;
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
    const currentProject = get().projects.find((p: any) => p.id === get().activeProjectId);
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

        set((state: any) => ({
          isPushModalOpen: false,
          pushError: null,
          notification: {
            id: Date.now(),
            title: t.notifications.selectivePushSuccess,
            detail: data.message || t.notifications.selectivePushSuccessDetail,
            type: 'success',
          },
          projects: state.projects.map((p: any) =>
            p.id === currentProject.id ? { ...p, outgoing: nextOut } : p
          ),
          branches: state.branches.map((b: any) =>
            b.name === sourceBranch || b.name === options.targetBranch || b.isCurrent
              ? { ...b, outgoing: nextOut }
              : b
          ),
          outgoingCommitsData: state.outgoingCommitsData
            ? {
                ...state.outgoingCommitsData,
                commits: state.outgoingCommitsData.commits.filter(
                  (c: any) =>
                    !pushedHashes.has(c.hash.toLowerCase()) &&
                    !pushedHashes.has(c.shortHash.toLowerCase())
                ),
              }
            : null,
        }));

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
      try {
        const checkUrl = `/api/git/outgoing-commits?path=${encodeURIComponent(
          currentProject.path
        )}&branch=${encodeURIComponent(sourceBranch)}&targetBranch=${encodeURIComponent(
          options.targetBranch
        )}`;
        const checkRes = await fetch(checkUrl);
        if (checkRes.ok) {
          const checkData: OutgoingCommitsData = await checkRes.json();
          const targetHashes = new Set(options.hashes.map((h) => h.toLowerCase()));
          const stillOutgoing = checkData.commits?.some(
            (c) =>
              targetHashes.has(c.hash.toLowerCase()) ||
              targetHashes.has(c.shortHash.toLowerCase()) ||
              options.hashes.some((h) => h.toLowerCase().startsWith(c.shortHash.toLowerCase()))
          );
          if (!stillOutgoing) {
            const pushedCount = options.hashes.length;
            const currentOut = currentProject.outgoing || 0;
            const nextOut = Math.max(0, currentOut - pushedCount);
            outgoingCommitsMemoryCache.clear();

            set((state: any) => ({
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
              projects: state.projects.map((p: any) =>
                p.id === currentProject.id ? { ...p, outgoing: nextOut } : p
              ),
              branches: state.branches.map((b: any) =>
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

      const errorMsg =
        e?.message === 'Failed to fetch'
          ? t.notifications.networkError
          : e?.message || t.notifications.selectivePushFailed;
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
    const currentProject = get().projects.find((p: any) => p.id === get().activeProjectId);
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
});
