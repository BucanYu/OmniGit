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

export const createGitLogSlice = (set: any, get: any) => ({
  activeTab: 'commit',

  setActiveTab: (tab: 'commit' | 'shelf' | 'log') => {
    set({ activeTab: tab });
    if (tab === 'log') {
      const state = get();
      if (state.commitLogs.length === 0) {
        state.fetchCommitLogs(true);
      }
    }
  },

  commitLogs: [],

  commitLogsLoading: false,

  commitLogsSkip: 0,

  hasMoreCommits: true,

  selectedCommitHash: null,

  selectedCommitDetails: null,

  commitDetailsLoading: false,

  selectedHistoricalFilePath: null,

  historicalDiff: null,

  logFilters: {
    query: '',
    branch: 'all',
    author: 'all',
    dateRange: 'all',
  },

  loadRepoAuthors: async (repoPath?: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    const targetPath = repoPath || currentProject?.path;
    if (!targetPath) return;
    try {
      const res = await fetch(`/api/git/authors?path=${encodeURIComponent(targetPath)}`);
      const authors: GitAuthorItem[] = await res.json();
      if (Array.isArray(authors) && authors.length > 0) {
        set({ gitAuthors: authors });
      }
    } catch (e) {
      console.error('Failed to load repo authors:', e);
    }
  },

  loadWorkspaceAccounts: async () => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    const paths = state.workspaceProjectPaths.length > 0
      ? state.workspaceProjectPaths
      : state.projects.map((p) => p.path);

    try {
      const res = await fetch('/api/git/workspace-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPaths: paths,
          activePath: currentProject?.path || '',
        }),
      });
      let accounts: WorkspaceGitAccount[] = await res.json();
      if (!Array.isArray(accounts)) accounts = [];

      // Maintain a persistent pool of all known accounts in this workspace so accounts never disappear on switch
      const poolKey = 'omnigit_workspace_known_accounts_pool';
      let pool: WorkspaceGitAccount[] = [];
      try {
        const rawPool = typeof window !== 'undefined' ? localStorage.getItem(poolKey) : null;
        if (rawPool) pool = JSON.parse(rawPool);
      } catch {}

      // Merge newly fetched accounts into pool
      for (const acc of accounts) {
        const key = (acc.email || acc.username || acc.name).toLowerCase().trim();
        const existingIdx = pool.findIndex(
          (p) => (p.email || p.username || p.name).toLowerCase().trim() === key
        );
        if (existingIdx >= 0) {
          pool[existingIdx] = { ...pool[existingIdx], ...acc };
        } else {
          pool.push(acc);
        }
      }

      // Also merge any user-defined custom accounts
      try {
        const rawCustom = typeof window !== 'undefined' ? localStorage.getItem('omnigit_custom_git_accounts') : null;
        if (rawCustom) {
          const customAccounts: WorkspaceGitAccount[] = JSON.parse(rawCustom);
          for (const ca of customAccounts) {
            const key = (ca.email || ca.username || ca.name).toLowerCase().trim();
            if (!pool.some((p) => (p.email || p.username || p.name).toLowerCase().trim() === key)) {
              pool.push(ca);
            }
          }
        }
      } catch {}

      // Re-hydrate any pooled accounts that were not in the scan into accounts list (as available accounts)
      for (const pooled of pool) {
        const key = (pooled.email || pooled.username || pooled.name).toLowerCase().trim();
        if (!accounts.some((a) => (a.email || a.username || a.name).toLowerCase().trim() === key)) {
          accounts.push({
            ...pooled,
            isCurrent: false,
            projectPaths: [],
            projectNames: [],
          });
        }
      }

      // Save updated pool
      try {
        if (typeof window !== 'undefined') {
          safeLocalStorageSetItem(poolKey, JSON.stringify(pool));
        }
      } catch {}

      // Determine which account is currently active for the selected project
      if (currentProject) {
        const normCurrent = currentProject.path.replace(/\\/g, '/').toLowerCase();
        // Priority 1: Match by live gitUser for this repo
        const liveUser = get().gitUser;
        let matched: WorkspaceGitAccount | undefined;
        if (liveUser?.name) {
          matched = accounts.find(
            (a) =>
              a.name.toLowerCase() === liveUser.name.toLowerCase() ||
              (a.email && liveUser.email && a.email.toLowerCase() === liveUser.email.toLowerCase())
          );
        }
        // Priority 2: Match by projectPaths
        if (!matched) {
          matched = accounts.find((a) =>
            a.projectPaths.some((p) => p.replace(/\\/g, '/').toLowerCase() === normCurrent)
          );
        }
        if (matched) {
          accounts.forEach((a) => {
            a.isCurrent = a.id === matched!.id;
          });
        }
      }

      // Map to gitAuthors for backwards compatibility with LogFilterBar if repo committers haven't loaded yet
      const fallbackAuthors: GitAuthorItem[] = accounts.map((a) => ({
        name: a.name,
        email: a.email,
        commitCount: a.projectNames.length,
        isCurrent: a.isCurrent,
      }));

      const currentAcc = accounts.find((a) => a.isCurrent) || accounts[0];

      set((s) => {
        let selected = s.selectedAuthorNames;
        if (selected.length === 0 && accounts.length > 0 && currentAcc) {
          selected = [currentAcc.name];
        }
        return {
          workspaceAccounts: accounts,
          gitAuthors: s.gitAuthors.length > 0 ? s.gitAuthors : fallbackAuthors,
          selectedAuthorNames: selected,
          gitUser: currentAcc ? { name: currentAcc.name, email: currentAcc.email } : s.gitUser,
        };
      });
    } catch (e) {
      console.error('Failed to load workspace accounts:', e);
    }
  },

  toggleAuthorFilter: (authorName: string) =>
    set((state) => {
      const exists = state.selectedAuthorNames.includes(authorName);
      let updated: string[];
      if (exists) {
        updated = state.selectedAuthorNames.filter((n) => n !== authorName);
      } else {
        updated = [...state.selectedAuthorNames, authorName];
      }
      return { selectedAuthorNames: updated };
    }),

  setPrimaryAuthor: (authorName: string) =>
    set(() => ({
      selectedAuthorNames: [authorName],
    })),

  selectAllAuthors: () =>
    set((state) => ({
      selectedAuthorNames: state.workspaceAccounts.map((a) => a.name),
    })),

  clearAuthorFilter: () =>
    set(() => ({
      selectedAuthorNames: [],
    })),

  switchActiveGitUser: async (
    name: string,
    email: string,
    isGlobal = false,
    applyToAllWorkspace = false
  ) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    const workspacePaths = state.workspaceProjectPaths.length > 0
      ? state.workspaceProjectPaths
      : state.projects.map((p) => p.path);

    try {
      const res = await fetch('/api/git/switch-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject?.path || '',
          name,
          email,
          isGlobal,
          applyToAllWorkspace,
          workspacePaths,
        }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        const t = getLocale(get().language);
        const isZh = get().language === 'zh-CN';
        set((s) => ({
          gitUser: data.user,
          selectedAuthorNames: [
            data.user.name,
            ...s.selectedAuthorNames.filter((n) => n !== data.user.name),
          ],
          notification: {
            id: Date.now(),
            title: t.notifications.switchedIdentity(data.user.name),
            detail: `${data.user.name} <${data.user.email}>${
              applyToAllWorkspace
                ? (isZh ? ' (已同步至工作空间所有项目)' : ' (Applied to all workspace projects)')
                : isGlobal
                ? (isZh ? ' (已设为全局配置)' : ' (Configured globally)')
                : (isZh ? ` (当前项目: ${currentProject?.name})` : ` (Project: ${currentProject?.name})`)
            }`,
            type: 'success',
          },
        }));
        await get().loadWorkspaceAccounts();
      }
    } catch (e: any) {
      alert(`Failed to switch user: ${e.message}`);
    }
  },

  addCustomGitAccount: async (data: {
    name: string;
    email: string;
    username?: string;
    password?: string;
    scope: 'project' | 'workspace' | 'global';
  }) => {
    const isGlobal = data.scope === 'global';
    const applyToAllWorkspace = data.scope === 'workspace';

    // Save to localStorage so it persists across reloads
    try {
      let customAccounts: WorkspaceGitAccount[] = [];
      const raw = typeof window !== 'undefined' ? localStorage.getItem('omnigit_custom_git_accounts') : null;
      if (raw) customAccounts = JSON.parse(raw);
      const dedupeKey = (data.email || data.username || data.name).toLowerCase().trim();
      customAccounts = customAccounts.filter(
        (a) => (a.email || a.username || a.name).toLowerCase().trim() !== dedupeKey
      );
      customAccounts.push({
        id: dedupeKey,
        name: data.name,
        email: data.email,
        username: data.username || data.name,
        projectPaths: [],
        projectNames: [],
        isCurrent: true,
        hasPassword: !!data.password,
        source: 'custom',
      });
      if (typeof window !== 'undefined') {
        safeLocalStorageSetItem('omnigit_custom_git_accounts', JSON.stringify(customAccounts));
      }
    } catch {}

    await get().switchActiveGitUser(data.name, data.email, isGlobal, applyToAllWorkspace);
  },

  setLogFilters: (filters: Partial<LogFilterOptions>) => {
    set((state) => ({
      logFilters: { ...state.logFilters, ...filters },
    }));
    get().fetchCommitLogs(true);
  },

  fetchCommitLogs: async (reset = false) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return;

    const skip = reset ? 0 : state.commitLogsSkip;
    const limit = 50;

    // Only set loading to true if we have no logs yet (SWR pattern)
    if (state.commitLogs.length === 0) {
      set({ commitLogsLoading: true });
    }
    try {
      const { query, branch, author, dateRange } = state.logFilters;
      const params = new URLSearchParams({
        path: currentProject.path,
        limit: String(limit),
        skip: String(skip),
      });
      if (branch) params.set('branch', branch);
      if (author) params.set('author', author);
      if (query) params.set('query', query);
      if (dateRange) params.set('since', dateRange);

      const res = await fetch(`/api/git/commits?${params.toString()}`);
      const rawList = await res.json();
      const list: GitCommitItem[] = Array.isArray(rawList) ? rawList : [];

      const currentLogs = Array.isArray(state.commitLogs) ? state.commitLogs : [];
      const newLogs = reset ? list : [...currentLogs, ...list];
      set({
        commitLogs: newLogs,
        commitLogsSkip: skip + list.length,
        hasMoreCommits: list.length === limit,
        commitLogsLoading: false,
      });

      // Update in L1 memory cache & L2/L3 persist
      const normPath = currentProject.path.toLowerCase();
      const cached = repoSnapshotCache.get(normPath) || getLocalSnapshot(normPath);
      if (cached) {
        cached.commitLogs = newLogs.slice(0, 100);
        repoSnapshotCache.set(normPath, cached);
        saveLocalSnapshot(normPath, cached);
      }

      // Auto select first commit if none selected or on reset
      if (reset && newLogs.length > 0 && !get().selectedCommitHash) {
        await get().selectCommit(newLogs[0].hash);
      }
    } catch (e: any) {
      console.error('Failed to fetch commit logs:', e);
      set({ commitLogsLoading: false });
    }
  },

  selectCommit: async (hash: string | null) => {
    set({ selectedCommitHash: hash, selectedHistoricalFilePath: null });
    if (!hash) {
      set({ selectedCommitDetails: null, historicalDiff: null });
      return;
    }

    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return;

    set({ commitDetailsLoading: true });
    try {
      const res = await fetch(
        `/api/git/commit-details?path=${encodeURIComponent(currentProject.path)}&hash=${encodeURIComponent(hash)}`
      );
      const details: GitCommitDetails = await res.json();
      set({ selectedCommitDetails: details, commitDetailsLoading: false });

      // Automatically select first changed file and display diff in Monaco Diff Editor
      if (details && details.files && details.files.length > 0) {
        await get().selectHistoricalFileDiff(hash, details.files[0].path);
      } else {
        set({ historicalDiff: null });
      }
    } catch (e: any) {
      console.error('Failed to load commit details:', e);
      set({ commitDetailsLoading: false });
    }
  },

  selectHistoricalFileDiff: async (hash: string, filePath: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return;

    set({ selectedHistoricalFilePath: filePath });
    try {
      const res = await fetch(
        `/api/git/commit-file-diff?path=${encodeURIComponent(currentProject.path)}&hash=${encodeURIComponent(hash)}&file=${encodeURIComponent(filePath)}`
      );
      const diffData = await res.json();
      set({
        isRightPanelOpen: true,
        historicalDiff: {
          original: diffData.original || '',
          modified: diffData.modified || '',
          filePath: diffData.filePath || filePath,
          oldLabel: diffData.oldLabel || `Parent (${hash.slice(0, 7)}^)` ,
          newLabel: diffData.newLabel || `Commit (${hash.slice(0, 7)})`,
          commitHash: hash,
        },
      });
    } catch (e: any) {
      console.error('Failed to load historical file diff:', e);
    }
  },

  clearHistoricalDiff: () => {
    set({ historicalDiff: null, selectedHistoricalFilePath: null });
  },

  resetToCommit: async (hash: string, mode: 'soft' | 'mixed' | 'hard') => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    try {
      const res = await fetch('/api/git/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, hash, mode }),
      });
      const data = await res.json();
      if (data.success) {
        set({
          notification: {
            id: Date.now(),
            title: `Reset (${mode.toUpperCase()}) Succeeded`,
            detail: `HEAD moved to ${hash.slice(0, 7)}`,
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
            title: 'Reset Failed',
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

  revertCommit: async (hash: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    try {
      const res = await fetch('/api/git/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, hash }),
      });
      const data = await res.json();
      if (data.success) {
        set({
          notification: {
            id: Date.now(),
            title: 'Revert Succeeded',
            detail: `Created revert commit for ${hash.slice(0, 7)}`,
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
            title: 'Revert Failed',
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

  checkoutRevision: async (hash: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    try {
      const res = await fetch('/api/git/checkout-revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, hash }),
      });
      const data = await res.json();
      if (data.success) {
        set({
          notification: {
            id: Date.now(),
            title: 'Checkout Revision Succeeded',
            detail: `HEAD is now at ${hash.slice(0, 7)} (detached)`,
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
            title: 'Checkout Revision Failed',
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

  createBranchAtCommit: async (branchName: string, hash: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    try {
      const res = await fetch('/api/git/create-branch-at', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, branchName, hash }),
      });
      const data = await res.json();
      if (data.success) {
        // Optimistically append new branch to state
        set((curr) => ({
          branches: [
            ...curr.branches,
            {
              name: branchName,
              isCurrent: false,
              isFavorite: false,
              isRemote: false,
              isTag: false,
              incoming: 0,
              outgoing: 0,
            },
          ],
          notification: {
            id: Date.now(),
            title: 'Branch Created',
            detail: `Branch '${branchName}' created at ${hash.slice(0, 7)}`,
            type: 'success',
          },
        }));
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        set({
          notification: {
            id: Date.now(),
            title: 'Failed to Create Branch',
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

  createTagAtCommit: async (tagName: string, hash: string, message?: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    try {
      const res = await fetch('/api/git/create-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, tagName, hash, message }),
      });
      const data = await res.json();
      if (data.success) {
        set({
          notification: {
            id: Date.now(),
            title: 'Tag Created',
            detail: `Tag '${tagName}' created at ${hash.slice(0, 7)}`,
            type: 'success',
          },
        });
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
      } else {
        set({
          notification: {
            id: Date.now(),
            title: 'Failed to Create Tag',
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

  cherryPickCommit: async (hash: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    const t = getLocale(state.language);

    try {
      const res = await fetch('/api/git/cherry-pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, hash }),
      });
      const data = await res.json();

      if (data.success) {
        set({
          notification: {
            id: Date.now(),
            title: t.notifications.cherryPickSuccess,
            detail: t.notifications.cherryPickSuccessDetail(hash.slice(0, 7)),
            type: 'success',
          },
        });
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        // Always refresh repo data so conflict status is detected in state
        await get().loadRepoData(currentProject.path, true);

        const hasConflicts = Boolean(data.isConflict) || get().files.some((f) => f.status === 'conflict') || get().isMerging;

        if (hasConflicts) {
          set({
            conflictsDialogOpen: true,
            conflictsDialogMinimized: false,
            activeTab: 'changes',
            notification: {
              id: Date.now(),
              title: t.notifications.cherryPickConflict,
              detail: t.notifications.cherryPickConflictDetail(hash.slice(0, 7)),
              type: 'warning',
            },
          });
        } else {
          set({
            notification: {
              id: Date.now(),
              title: t.notifications.cherryPickFailed,
              detail: data.message,
              type: 'warning',
            },
          });
        }
      }
      return data;
    } catch (e: any) {
      const errorMsg = e.message || t.notifications.cherryPickError;
      set({
        notification: {
          id: Date.now(),
          title: t.notifications.cherryPickError,
          detail: errorMsg,
          type: 'warning',
        },
      });
      return { success: false, message: errorMsg };
    }
  }
});
