import type {
  GitFileItem,
  BranchItem,
  LightRepoCache,
} from '../types';
import {
  normalizePath,
  normalizeSnapshotFiles,
  getLocalSnapshot,
  saveLocalSnapshot,
  repoSnapshotCache,
  setL1SnapshotCache,
  repoMetadataFreshness,
  syncRuntime,
  repoInFlight,
} from '../storeHelpers';
import { createGitCommitActionsSlice } from './gitCommitActionsSlice';

export const createGitStatusSlice = (set: any, get: any) => ({
  ...createGitCommitActionsSlice(set, get),

  files: [],

  selectedFilePath: null,

  selectedFileDiff: { oldContent: '', newContent: '' },

  editorViewMode: 'diff' as 'diff' | 'editor',

  setEditorViewMode: (mode: 'diff' | 'editor') => set({ editorViewMode: mode }),

  isRightPanelOpen: true,

  openRightPanel: () => set({ isRightPanelOpen: true }),

  closeRightPanel: () => {
    set({
      isRightPanelOpen: false,
      selectedFilePath: null,
      selectedFileDiff: { oldContent: '', newContent: '' },
      historicalDiff: null,
      selectedHistoricalFilePath: null,
    });
  },

  setRightPanelOpen: (open: boolean) => set({ isRightPanelOpen: open }),

  viewStyle: 'flat' as 'flat' | 'tree',

  groupCollapsed: {
    conflicts: false,
    changes: false,
    unversioned: false,
  },

  loadRepoData: async (repoPath: string, force = false) => {
    const normPath = normalizePath(repoPath);
    const cached = repoSnapshotCache.get(normPath) || getLocalSnapshot(normPath);
    if (cached && !repoSnapshotCache.has(normPath)) {
      repoSnapshotCache.set(normPath, cached);
    }
    const now = Date.now();

    if (!force && cached && now - cached.lastUpdated < 15000) {
      const currentActive = get().projects.find((p: any) => p.id === get().activeProjectId);
      if (currentActive && normalizePath(currentActive.path) === normPath) {
        set({
          files: normalizeSnapshotFiles(cached.files || []).filter(
            (f) => f.status !== 'conflict'
          ),
          branches: cached.branches,
          commitLogs: cached.commitLogs || get().commitLogs,
          isMerging: false,
          mergeMessage: '',
          mergeSourceBranch: undefined,
          conflictedCount: 0,
          lastCommitDetails: cached.lastCommitDetails,
          commitHistory: cached.commitHistory,
          isRepoLoading: false,
        });
      }
      return;
    }

    if (repoInFlight.has(normPath)) {
      return;
    }
    repoInFlight.add(normPath);

    const loadId = ++syncRuntime.currentRepoLoadId;
    if (!cached) {
      set({ isRepoLoading: true });
    }

    try {
      const [statusRes, branchesRes, userRes] = await Promise.all([
        fetch(`/api/git/status?path=${encodeURIComponent(repoPath)}`),
        fetch(`/api/git/branches?path=${encodeURIComponent(repoPath)}`),
        fetch(`/api/git/user?path=${encodeURIComponent(repoPath)}`),
      ]);

      const status = await statusRes.json();
      const rawBranches = await branchesRes.json();
      const repoUser = await userRes.json();
      if (repoUser && repoUser.name) {
        set({ gitUser: repoUser });
      }
      const safeRawBranches: BranchItem[] = Array.isArray(rawBranches) ? rawBranches : [];

      const favKey = `omnigit_fav_branches_${repoPath}`;
      let savedFavs: string[] = ['dev', 'main', 'master'];
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(favKey) : null;
        if (raw) savedFavs = JSON.parse(raw);
      } catch {}

      const enrichedBranches = safeRawBranches
        .filter((b) => b && typeof b.name === 'string')
        .map((b) => ({
          ...b,
          isFavorite: savedFavs.includes(b.name) || Boolean(b.isCurrent),
          outgoing:
            (b.isCurrent || b.name === status.currentBranch) && status.outgoing !== undefined
              ? status.outgoing
              : b.outgoing,
          incoming:
            (b.isCurrent || b.name === status.currentBranch) && status.incoming !== undefined
              ? status.incoming
              : b.incoming,
        }));

      const allFiles: GitFileItem[] = normalizeSnapshotFiles(
        Array.isArray(status?.files) ? status.files : []
      );
      const conflictFiles = allFiles.filter((f) => f.status === 'conflict');

      const localDraft =
        typeof window !== 'undefined'
          ? localStorage.getItem(`omnigit_commit_draft_${repoPath}`) || ''
          : '';
      let targetMessage = localDraft;
      if (!targetMessage && status.isMerging && status.mergeMessage) {
        targetMessage = status.mergeMessage;
      }

      const snapshot: LightRepoCache = {
        repoPath,
        currentBranch: status.currentBranch || 'main',
        upstream: status.upstream,
        incoming: status.incoming || 0,
        outgoing: status.outgoing || 0,
        branches: enrichedBranches,
        files: allFiles,
        selectedFilePath:
          cached?.selectedFilePath || conflictFiles[0]?.path || allFiles[0]?.path || null,
        commitMessage: targetMessage,
        commitHistory: cached?.commitHistory || [],
        commitLogs: cached?.commitLogs || [],
        isMerging: Boolean(status.isMerging),
        mergeMessage: status.mergeMessage || '',
        mergeSourceBranch: status.mergeSourceBranch,
        conflictedCount: status.conflictedCount || conflictFiles.length,
        lastCommitDetails: cached?.lastCommitDetails || null,
        lastUpdated: Date.now(),
      };
      setL1SnapshotCache(normPath, snapshot);
      saveLocalSnapshot(normPath, snapshot);
      repoMetadataFreshness.set(normPath, Date.now());

      const nowActive = get().projects.find((p: any) => p.id === get().activeProjectId);
      if (
        loadId !== syncRuntime.currentRepoLoadId ||
        !nowActive ||
        normalizePath(nowActive.path) !== normPath
      ) {
        return;
      }

      const shouldOpenConflicts =
        conflictFiles.length > 0 &&
        !get().conflictsDialogOpen &&
        !get().conflictsDialogMinimized;
      const isThreeWayFileResolved = Boolean(
        get().threeWayMergeOpen &&
          get().threeWayData?.filePath &&
          !conflictFiles.some((f) => f.path === get().threeWayData!.filePath)
      );

      set((state: any) => ({
        files: allFiles,
        branches: enrichedBranches,
        isMerging: Boolean(status.isMerging),
        mergeMessage: status.mergeMessage || '',
        mergeSourceBranch: status.mergeSourceBranch,
        conflictedCount: status.conflictedCount || conflictFiles.length,
        conflictsDialogOpen: shouldOpenConflicts
          ? true
          : conflictFiles.length === 0
          ? false
          : state.conflictsDialogOpen,
        threeWayMergeOpen: isThreeWayFileResolved ? false : state.threeWayMergeOpen,
        threeWayData: isThreeWayFileResolved ? null : state.threeWayData,
        threeWayLoading: isThreeWayFileResolved ? false : state.threeWayLoading,
        projects: state.projects.map((p: any) =>
          normalizePath(p.path) === normPath
            ? {
                ...p,
                currentBranch: status.currentBranch,
                upstream: status.upstream,
                incoming: status.incoming,
                outgoing: status.outgoing,
              }
            : p
        ),
      }));

      const selected =
        cached?.selectedFilePath || conflictFiles[0]?.path || allFiles[0]?.path || null;
      if (selected && allFiles.some((f) => f.path === selected)) {
        get().setSelectedFile(selected);
      }

      await get().loadRepoAuthors(repoPath);
      get().loadRecentCommitMessages(repoPath);
      get().loadLastCommit(repoPath);
      get().checkMergeUndoStatus(repoPath);
    } catch (e: any) {
      console.error('Failed to load repo data:', e);
    } finally {
      repoInFlight.delete(normPath);
      if (loadId === syncRuntime.currentRepoLoadId) {
        set({ isRepoLoading: false });
      }
    }
  },

  syncRepoStatusSilently: async (repoPath?: string) => {
    if (syncRuntime.isSyncingSilently) return;
    const currentActive = get().projects.find((p: any) => p.id === get().activeProjectId);
    if (!currentActive) return;

    if (repoPath && repoPath.toLowerCase() !== currentActive.path.toLowerCase()) {
      return;
    }

    const targetPath = currentActive.path;
    const normTarget = normalizePath(targetPath);
    if (repoInFlight.has(normTarget)) return;

    syncRuntime.isSyncingSilently = true;
    const loadId = syncRuntime.currentRepoLoadId;

    try {
      const [statusRes, branchesRes] = await Promise.all([
        fetch(`/api/git/status?path=${encodeURIComponent(targetPath)}`),
        fetch(`/api/git/branches?path=${encodeURIComponent(targetPath)}`),
      ]);
      const status = await statusRes.json();
      const rawBranches = await branchesRes.json();
      const safeRawBranches: BranchItem[] = Array.isArray(rawBranches) ? rawBranches : [];

      const nowActive = get().projects.find((p: any) => p.id === get().activeProjectId);
      if (
        loadId !== syncRuntime.currentRepoLoadId ||
        !nowActive ||
        nowActive.path.toLowerCase() !== targetPath.toLowerCase()
      ) {
        return;
      }

      const favKey = `omnigit_fav_branches_${targetPath}`;
      let savedFavs: string[] = ['dev', 'main', 'master'];
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(favKey) : null;
        if (raw) savedFavs = JSON.parse(raw);
      } catch {}

      const enrichedBranches = safeRawBranches
        .filter((b) => b && typeof b.name === 'string')
        .map((b) => ({
          ...b,
          isFavorite: savedFavs.includes(b.name) || Boolean(b.isCurrent),
        }));

      const allFiles: GitFileItem[] = normalizeSnapshotFiles(
        Array.isArray(status?.files) ? status.files : []
      );
      const conflictFiles = allFiles.filter((f) => f.status === 'conflict');

      set((state: any) => {
        const prevProject = state.projects.find(
          (p: any) => normalizePath(p.path) === normalizePath(targetPath)
        );
        const isProjectUnchanged =
          prevProject &&
          prevProject.currentBranch === status.currentBranch &&
          prevProject.upstream === status.upstream &&
          prevProject.incoming === status.incoming &&
          prevProject.outgoing === status.outgoing;

        const updatedProjects = isProjectUnchanged
          ? state.projects
          : state.projects.map((p: any) =>
              normalizePath(p.path) === normalizePath(targetPath)
                ? {
                    ...p,
                    currentBranch: status.currentBranch,
                    upstream: status.upstream,
                    incoming: status.incoming,
                    outgoing: status.outgoing,
                  }
                : p
            );

        const isThreeWayFileResolved = Boolean(
          state.threeWayMergeOpen &&
            state.threeWayData?.filePath &&
            !conflictFiles.some((f) => f.path === state.threeWayData!.filePath)
        );

        return {
          files: allFiles,
          branches: enrichedBranches,
          isMerging: Boolean(status.isMerging),
          mergeMessage: status.mergeMessage || state.mergeMessage,
          mergeSourceBranch: status.mergeSourceBranch,
          conflictedCount: status.conflictedCount || conflictFiles.length,
          conflictsDialogOpen: conflictFiles.length === 0 ? false : state.conflictsDialogOpen,
          threeWayMergeOpen: isThreeWayFileResolved ? false : state.threeWayMergeOpen,
          threeWayData: isThreeWayFileResolved ? null : state.threeWayData,
          threeWayLoading: isThreeWayFileResolved ? false : state.threeWayLoading,
          projects: updatedProjects,
        };
      });

      const cachedSnapshot = repoSnapshotCache.get(normalizePath(targetPath));
      if (cachedSnapshot) {
        cachedSnapshot.currentBranch = status.currentBranch || cachedSnapshot.currentBranch;
        cachedSnapshot.upstream = status.upstream;
        cachedSnapshot.incoming = status.incoming || 0;
        cachedSnapshot.outgoing = status.outgoing || 0;
        cachedSnapshot.branches = enrichedBranches;
        cachedSnapshot.files = allFiles;
        cachedSnapshot.isMerging = Boolean(status.isMerging);
        cachedSnapshot.mergeMessage = status.mergeMessage || '';
        cachedSnapshot.conflictedCount = status.conflictedCount || conflictFiles.length;
        cachedSnapshot.lastUpdated = Date.now();
      }

      const currentSelected = get().selectedFilePath;
      if (currentSelected) {
        const fileStillExists = allFiles.some((f) => f.path === currentSelected);
        if (fileStillExists) {
          try {
            const diffRes = await fetch(
              `/api/git/diff?path=${encodeURIComponent(targetPath)}&file=${encodeURIComponent(
                currentSelected
              )}`
            );
            const diff = await diffRes.json();
            if (
              get().activeProjectId === currentActive.id &&
              get().selectedFilePath === currentSelected
            ) {
              const oldDiff = get().selectedFileDiff;
              if (oldDiff.oldContent !== diff.oldContent || oldDiff.newContent !== diff.newContent) {
                set({ selectedFileDiff: diff });
              }
            }
          } catch {}
        } else {
          if (get().activeProjectId === currentActive.id) {
            if (allFiles.length > 0) {
              await get().setSelectedFile(allFiles[0].path);
            } else {
              set({ selectedFilePath: null, selectedFileDiff: { oldContent: '', newContent: '' } });
            }
          }
        }
      } else if (allFiles.length > 0) {
        if (get().activeProjectId === currentActive.id) {
          await get().setSelectedFile(allFiles[0].path);
        }
      }
    } catch {
      // Ignore background errors
    } finally {
      syncRuntime.isSyncingSilently = false;
    }
  },

  setSelectedFile: async (filePath: string | null) => {
    set({ selectedFilePath: filePath });
    if (!filePath) {
      set({ selectedFileDiff: { oldContent: '', newContent: '' } });
      return;
    }
    set({ isRightPanelOpen: true });

    const currentProject = get().projects.find((p: any) => p.id === get().activeProjectId);
    if (!currentProject) return;

    try {
      const diffRes = await fetch(
        `/api/git/diff?path=${encodeURIComponent(currentProject.path)}&file=${encodeURIComponent(
          filePath
        )}`
      );
      const diff = await diffRes.json();
      if (get().selectedFilePath === filePath && get().activeProjectId === currentProject.id) {
        set({ selectedFileDiff: diff });
      }
    } catch {
      if (get().selectedFilePath === filePath && get().activeProjectId === currentProject.id) {
        set({ selectedFileDiff: { oldContent: '', newContent: '' } });
      }
    }
  },

  saveCurrentFile: async (content: string) => {
    const currentProject = get().projects.find((p: any) => p.id === get().activeProjectId);
    const filePath = get().selectedFilePath;
    if (!currentProject || !filePath) return false;

    try {
      const res = await fetch('/api/git/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          file: filePath,
          content,
        }),
      });
      const data = await res.json();
      if (data.success) {
        set({
          notification: {
            id: Date.now(),
            title: `Saved ${filePath}`,
            type: 'success',
          },
        });
        await get().setSelectedFile(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  toggleFileCheck: (path: string) =>
    set((state: any) => ({
      files: state.files.map((f: any) => (f.path === path ? { ...f, checked: !f.checked } : f)),
    })),

  toggleGroupCheck: (group: string, checked: boolean) =>
    set((state: any) => ({
      files: state.files.map((f: any) => (f.group === group ? { ...f, checked } : f)),
    })),

  toggleGroupCollapsed: (group: 'conflicts' | 'changes' | 'unversioned') =>
    set((state: any) => ({
      groupCollapsed: {
        ...state.groupCollapsed,
        [group]: !state.groupCollapsed[group],
      },
    })),

  setViewStyle: (style: 'flat' | 'tree') => set({ viewStyle: style }),
});
