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

export const createGitStatusSlice = (set: any, get: any) => ({
  files: [],

  selectedFilePath: null,

  selectedFileDiff: { oldContent: '', newContent: '' },

  editorViewMode: 'diff',

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

  viewStyle: 'flat',

  groupCollapsed: {
    conflicts: false,
    changes: false,
    unversioned: false,
  },

  isAmend: false,

  commitMessage: '',

  commitHistory: [],

  rollbackModal: {
    isOpen: false,
    targetPaths: [],
  },

  lastCommitDetails: null,

  loadRepoData: async (repoPath: string, force = false) => {
    const normPath = normalizePath(repoPath);
    const cached = repoSnapshotCache.get(normPath) || getLocalSnapshot(normPath);
    if (cached && !repoSnapshotCache.has(normPath)) {
      repoSnapshotCache.set(normPath, cached);
    }
    const now = Date.now();

    // 15s TTL Freshness check: if cached within 15s and not forced, do NOT fire any network request!
    if (!force && cached && now - cached.lastUpdated < 15000) {
      const currentActive = get().projects.find((p) => p.id === get().activeProjectId);
      if (currentActive && normalizePath(currentActive.path) === normPath) {
        set({
          files: normalizeSnapshotFiles(cached.files || []).filter((f) => f.status !== 'conflict'),
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

    // In-flight mutex: if already fetching for this repo, skip redundant request
    if (repoInFlight.has(normPath)) {
      return;
    }
    repoInFlight.add(normPath);

    const loadId = ++currentRepoLoadId;
    // Only show full loading spinner if this repo has never been loaded before (no cache)
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
          outgoing: (b.isCurrent || b.name === status.currentBranch) && status.outgoing !== undefined ? status.outgoing : b.outgoing,
          incoming: (b.isCurrent || b.name === status.currentBranch) && status.incoming !== undefined ? status.incoming : b.incoming,
        }));

      const allFiles: GitFileItem[] = normalizeSnapshotFiles(Array.isArray(status?.files) ? status.files : []);
      const conflictFiles = allFiles.filter((f) => f.status === 'conflict');

      const localDraft = typeof window !== 'undefined' ? localStorage.getItem(`omnigit_commit_draft_${repoPath}`) || '' : '';
      let targetMessage = localDraft;
      if (!targetMessage && status.isMerging && status.mergeMessage) {
        targetMessage = status.mergeMessage;
      }

      // Update snapshot cache with lightweight metadata (NO heavy file diffs!)
      const snapshot: LightRepoCache = {
        repoPath,
        currentBranch: status.currentBranch || 'main',
        upstream: status.upstream,
        incoming: status.incoming || 0,
        outgoing: status.outgoing || 0,
        branches: enrichedBranches,
        files: allFiles,
        selectedFilePath: cached?.selectedFilePath || (conflictFiles[0]?.path || allFiles[0]?.path || null),
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
      repoSnapshotCache.set(normPath, snapshot);
      saveLocalSnapshot(normPath, snapshot);

      // Guard: Discard applying to active state if active project switched or another load began
      const nowActive = get().projects.find((p) => p.id === get().activeProjectId);
      if (loadId !== currentRepoLoadId || !nowActive || normalizePath(nowActive.path) !== normPath) {
        return;
      }

      const shouldOpenConflicts = conflictFiles.length > 0 && !get().conflictsDialogOpen && !get().conflictsDialogMinimized;
      const isThreeWayFileResolved = Boolean(
        get().threeWayMergeOpen &&
        get().threeWayData?.filePath &&
        !conflictFiles.some((f) => f.path === get().threeWayData!.filePath)
      );

      set((state) => ({
        files: allFiles,
        branches: enrichedBranches,
        isMerging: Boolean(status.isMerging),
        mergeMessage: status.mergeMessage || '',
        mergeSourceBranch: status.mergeSourceBranch,
        conflictedCount: status.conflictedCount || conflictFiles.length,
        conflictsDialogOpen: shouldOpenConflicts ? true : (conflictFiles.length === 0 ? false : state.conflictsDialogOpen),
        threeWayMergeOpen: isThreeWayFileResolved ? false : state.threeWayMergeOpen,
        threeWayData: isThreeWayFileResolved ? null : state.threeWayData,
        threeWayLoading: isThreeWayFileResolved ? false : state.threeWayLoading,
        projects: state.projects.map((p) =>
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

      // If user had a selected file in this project, load its single diff on demand
      const selected = cached?.selectedFilePath || (conflictFiles[0]?.path || allFiles[0]?.path || null);
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
      if (loadId === currentRepoLoadId) {
        set({ isRepoLoading: false });
      }
    }
  },

  syncRepoStatusSilently: async (repoPath?: string) => {
    if (isSyncingSilently) return;
    const currentActive = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentActive) return;

    // Strict Guard: If repoPath is passed, it MUST match the currently active project!
    if (repoPath && repoPath.toLowerCase() !== currentActive.path.toLowerCase()) {
      return;
    }

    const targetPath = currentActive.path;
    isSyncingSilently = true;
    const loadId = currentRepoLoadId;

    try {
      const [statusRes, branchesRes] = await Promise.all([
        fetch(`/api/git/status?path=${encodeURIComponent(targetPath)}`),
        fetch(`/api/git/branches?path=${encodeURIComponent(targetPath)}`),
      ]);
      const status = await statusRes.json();
      const rawBranches = await branchesRes.json();
      const safeRawBranches: BranchItem[] = Array.isArray(rawBranches) ? rawBranches : [];

      // Strict Guard: If active project changed while fetching, DISCARD immediately!
      const nowActive = get().projects.find((p) => p.id === get().activeProjectId);
      if (loadId !== currentRepoLoadId || !nowActive || nowActive.path.toLowerCase() !== targetPath.toLowerCase()) {
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

      const allFiles: GitFileItem[] = normalizeSnapshotFiles(Array.isArray(status?.files) ? status.files : []);
      const conflictFiles = allFiles.filter((f) => f.status === 'conflict');

      // Update state without resetting user interaction
      set((state) => {
        const prevProject = state.projects.find((p) => normalizePath(p.path) === normalizePath(targetPath));
        const isProjectUnchanged =
          prevProject &&
          prevProject.currentBranch === status.currentBranch &&
          prevProject.upstream === status.upstream &&
          prevProject.incoming === status.incoming &&
          prevProject.outgoing === status.outgoing;

        const updatedProjects = isProjectUnchanged
          ? state.projects
          : state.projects.map((p) =>
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

      // Update snapshot cache in background
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

      // Synchronize currently opened diff editor if external changes modified that file
      const currentSelected = get().selectedFilePath;
      if (currentSelected) {
        const fileStillExists = allFiles.some((f) => f.path === currentSelected);
        if (fileStillExists) {
          try {
            const diffRes = await fetch(
              `/api/git/diff?path=${encodeURIComponent(targetPath)}&file=${encodeURIComponent(currentSelected)}`
            );
            const diff = await diffRes.json();
            if (get().activeProjectId === currentActive.id && get().selectedFilePath === currentSelected) {
              const oldDiff = get().selectedFileDiff;
              if (oldDiff.oldContent !== diff.oldContent || oldDiff.newContent !== diff.newContent) {
                set({ selectedFileDiff: diff });
              }
            }
          } catch {}
        } else {
          // File was deleted or resolved/committed externally
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
      isSyncingSilently = false;
    }
  },

  setSelectedFile: async (filePath: string | null) => {
    set({ selectedFilePath: filePath });
    if (!filePath) {
      set({ selectedFileDiff: { oldContent: '', newContent: '' } });
      return;
    }
    set({ isRightPanelOpen: true });

    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return;

    try {
      const diffRes = await fetch(
        `/api/git/diff?path=${encodeURIComponent(currentProject.path)}&file=${encodeURIComponent(filePath)}`
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
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
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

  toggleFileCheck: (path) =>
    set((state) => ({
      files: state.files.map((f) => (f.path === path ? { ...f, checked: !f.checked } : f)),
    })),

  toggleGroupCheck: (group, checked) =>
    set((state) => ({
      files: state.files.map((f) => (f.group === group ? { ...f, checked } : f)),
    })),

  toggleGroupCollapsed: (group) =>
    set((state) => ({
      groupCollapsed: {
        ...state.groupCollapsed,
        [group]: !state.groupCollapsed[group],
      },
    })),

  setViewStyle: (style) => set({ viewStyle: style }),

  setIsAmend: async (isAmend) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    set({ isAmend });

    if (isAmend) {
      let last = state.lastCommitDetails;
      if (!last && currentProject) {
        last = await get().loadLastCommit(currentProject.path);
      }
      if (last) {
        const fullMsg = last.body ? `${last.subject}\n\n${last.body}` : last.subject;
        set({ commitMessage: fullMsg });
      }
    } else if (currentProject && typeof window !== 'undefined') {
      const draft = localStorage.getItem(`omnigit_commit_draft_${currentProject.path}`) || '';
      set({ commitMessage: draft });
    }
  },

  setCommitMessage: (msg) => {
    set({ commitMessage: msg });
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (currentProject && typeof window !== 'undefined') {
      if (msg && !get().isAmend) {
        safeLocalStorageSetItem(`omnigit_commit_draft_${currentProject.path}`, msg);
      } else if (!msg && !get().isAmend) {
        localStorage.removeItem(`omnigit_commit_draft_${currentProject.path}`);
      }
    }
  },

  loadLastCommit: async (repoPath?: string) => {
    const targetPath = repoPath || get().projects.find((p) => p.id === get().activeProjectId)?.path;
    if (!targetPath) return null;
    const normTarget = targetPath.replace(/\\/g, '/').toLowerCase();
    try {
      const res = await fetch(`/api/git/last-commit?path=${encodeURIComponent(targetPath)}`);
      if (res.ok) {
        const details: GitCommitDetails = await res.json();
        const nowActive = get().projects.find((p) => p.id === get().activeProjectId);
        if (nowActive && nowActive.path.replace(/\\/g, '/').toLowerCase() === normTarget) {
          set({ lastCommitDetails: details });
        }
        return details;
      }
    } catch (e) {
      console.error('Failed to load last commit:', e);
    }
    return null;
  },

  loadRecentCommitMessages: async (repoPath?: string) => {
    const targetPath = repoPath || get().projects.find((p) => p.id === get().activeProjectId)?.path;
    if (!targetPath) return;
    const normTarget = targetPath.replace(/\\/g, '/').toLowerCase();
    try {
      const res = await fetch(`/api/git/recent-commit-messages?path=${encodeURIComponent(targetPath)}&limit=25`);
      if (res.ok) {
        const gitMessages: string[] = await res.json();
        let localHistory: string[] = [];
        if (typeof window !== 'undefined') {
          try {
            localHistory = JSON.parse(localStorage.getItem(`omnigit_history_${targetPath}`) || '[]');
          } catch {}
        }
        // ONLY this project's commit messages: local history first, then git commit history
        const projectHistory = Array.from(new Set([...localHistory, ...gitMessages])).slice(0, 30);

        // Cache in repoSnapshotCache for this repository so future visits have it immediately
        const cached = repoSnapshotCache.get(normTarget);
        if (cached) {
          cached.commitHistory = projectHistory;
        }

        // Guard against asynchronous race condition: Only set state if targetPath is STILL the active project!
        const nowActive = get().projects.find((p) => p.id === get().activeProjectId);
        if (nowActive && nowActive.path.replace(/\\/g, '/').toLowerCase() === normTarget) {
          set({ commitHistory: projectHistory });
        }
      }
    } catch (e) {
      console.error('Failed to load recent commit messages:', e);
    }
  },

  commit: async (pushAfter = false) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return;

    if (state.isMerging) {
      await state.completeMergeCommit(state.commitMessage);
      if (pushAfter) {
        get().openPushModal(currentProject.currentBranch);
      }
      return;
    }

    const checkedFiles = state.files.filter((f) => f.checked).map((f) => f.path);
    if (checkedFiles.length === 0 || !state.commitMessage.trim()) return;

    try {
      const res = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          files: checkedFiles,
          message: state.commitMessage,
          isAmend: state.isAmend,
        }),
      });
      const result = await res.json();
      if (result.success) {
        // Clean draft message for this project
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`omnigit_commit_draft_${currentProject.path}`);

          // Save to this project's local history
          const subject = state.commitMessage.split('\n')[0].trim();
          try {
            const key = `omnigit_history_${currentProject.path}`;
            const prev: string[] = JSON.parse(localStorage.getItem(key) || '[]');
            const updated = Array.from(new Set([subject, ...prev])).slice(0, 20);
            safeLocalStorageSetItem(key, JSON.stringify(updated));
          } catch {}
        }

        // Prepend commit message to this project's history
        const subject = state.commitMessage.split('\n')[0].trim();
        const newHistory = Array.from(new Set([subject, ...state.commitHistory])).slice(0, 30);

        // 1. Optimistically remove committed files and update uncommitted count & outgoing (+1)
        const remainingFiles = state.files.filter((f) => !checkedFiles.includes(f.path));
        const outgoingDelta = state.isAmend ? 0 : 1;
        const normPath = currentProject.path.toLowerCase();

        set((curr) => ({
          commitMessage: '',
          isAmend: false,
          commitHistory: newHistory,
          files: remainingFiles,
          selectedFilePath:
            curr.selectedFilePath && checkedFiles.includes(curr.selectedFilePath)
              ? (remainingFiles[0]?.path || null)
              : curr.selectedFilePath,
          selectedFileDiff:
            curr.selectedFilePath && checkedFiles.includes(curr.selectedFilePath) && remainingFiles.length === 0
              ? { oldContent: '', newContent: '' }
              : curr.selectedFileDiff,
          projects: curr.projects.map((p) =>
            p.id === currentProject.id
              ? {
                  ...p,
                  outgoing: (p.outgoing || 0) + outgoingDelta,
                  uncommittedCount: remainingFiles.length,
                }
              : p
          ),
          branches: curr.branches.map((b) =>
            b.isCurrent || b.name === currentProject.currentBranch
              ? { ...b, outgoing: (b.outgoing || 0) + outgoingDelta }
              : b
          ),
          notification: {
            id: Date.now(),
            title: 'Commit Successful',
            detail: result.message,
            type: 'success',
          },
        }));

        // 2. Sync snapshot cache & disk snapshot
        const cached = repoSnapshotCache.get(normPath);
        if (cached) {
          cached.files = remainingFiles;
          cached.outgoing = (cached.outgoing || 0) + outgoingDelta;
          cached.lastUpdated = Date.now();
          saveLocalSnapshot(normPath, cached);
        }

        if (pushAfter) {
          get().openPushModal(currentProject.currentBranch);
        }
        await get().loadRepoData(currentProject.path, true);
        await get().loadLastCommit(currentProject.path);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        alert(`Commit failed: ${result.message}`);
      }
    } catch (e: any) {
      alert(`Commit error: ${e.message}`);
    }
  },

  openRollbackModal: (paths) => {
    set({ rollbackModal: { isOpen: true, targetPaths: paths } });
  },

  closeRollbackModal: () => {
    set({ rollbackModal: { isOpen: false, targetPaths: [] } });
  },

  confirmRollback: async () => {
    const { targetPaths } = get().rollbackModal;
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject || targetPaths.length === 0) return;

    try {
      const res = await fetch('/api/git/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          files: targetPaths,
        }),
      });
      const result = await res.json();

      // 1. Optimistically remove rolled back files from state
      const remainingFiles = get().files.filter((f) => !targetPaths.includes(f.path));
      const normPath = currentProject.path.toLowerCase();

      set((curr) => ({
        rollbackModal: { isOpen: false, targetPaths: [] },
        files: remainingFiles,
        selectedFilePath:
          curr.selectedFilePath && targetPaths.includes(curr.selectedFilePath)
            ? (remainingFiles[0]?.path || null)
            : curr.selectedFilePath,
        selectedFileDiff:
          curr.selectedFilePath && targetPaths.includes(curr.selectedFilePath) && remainingFiles.length === 0
            ? { oldContent: '', newContent: '' }
            : curr.selectedFileDiff,
        projects: curr.projects.map((p) =>
          p.id === currentProject.id ? { ...p, uncommittedCount: remainingFiles.length } : p
        ),
        notification: {
          id: Date.now(),
          title: `Rolled back ${targetPaths.length} file(s)`,
          detail: result.message,
          type: 'info',
        },
      }));

      // 2. Sync snapshot cache & disk snapshot
      const cached = repoSnapshotCache.get(normPath);
      if (cached) {
        cached.files = remainingFiles;
        cached.lastUpdated = Date.now();
        saveLocalSnapshot(normPath, cached);
      }

      // 3. Force reload repo status (bypassing 15s TTL)
      await get().loadRepoData(currentProject.path, true);
      get().pollWorkspaceSyncStatus();
    } catch (e: any) {
      alert(`Rollback error: ${e.message}`);
    }
  },

  openFileInEditor: async (filePath: string) => {
    if (!filePath) return;
    await get().setSelectedFile(filePath);
    set({ editorViewMode: 'editor', isRightPanelOpen: true });
    const t = getLocale(get().language);
    get().setNotification({
      id: Date.now(),
      title: t.notifications.openedInEditor,
      detail: filePath,
      type: 'info',
    });
  },

  revealFileInOS: async (filePath: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject || !filePath) return;

    // Calculate full path and folder path
    const sep = currentProject.path.includes('\\') ? '\\' : '/';
    const fullPath = filePath.includes(':') || filePath.startsWith('/')
      ? filePath
      : currentProject.path + sep + filePath.replace(/\//g, sep);
    const folderPath = fullPath.includes(sep)
      ? fullPath.substring(0, fullPath.lastIndexOf(sep))
      : currentProject.path;

    // Auto-copy folder path to clipboard (fail-safe and convenient)
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(folderPath).catch(() => {});
    }

    const t = getLocale(get().language);

    // 1. Electron runtime bridge (when packaged as desktop client)
    if (typeof window !== 'undefined' && (window as any).electron?.shell?.openPath) {
      try {
        await (window as any).electron.shell.openPath(folderPath);
        get().setNotification({
          id: Date.now(),
          title: t.notifications.folderOpened,
          detail: t.notifications.folderOpenedDetail(folderPath),
          type: 'success',
        });
        return;
      } catch {}
    } else if (typeof window !== 'undefined' && (window as any).electron?.shell?.showItemInFolder) {
      (window as any).electron.shell.showItemInFolder(fullPath);
      get().setNotification({
        id: Date.now(),
        title: t.notifications.folderOpened,
        detail: t.notifications.folderOpenedDetail(folderPath),
        type: 'success',
      });
      return;
    }

    // 2. Tauri runtime bridge (when packaged as desktop client)
    if (typeof window !== 'undefined' && (window as any).__TAURI__?.shell?.open) {
      try {
        await (window as any).__TAURI__.shell.open(folderPath);
        get().setNotification({
          id: Date.now(),
          title: t.notifications.folderOpened,
          detail: t.notifications.folderOpenedDetail(folderPath),
          type: 'success',
        });
        return;
      } catch {}
    }

    // 3. Local backend service (universal shell launcher)
    try {
      const res = await fetch('/api/git/reveal-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, file: filePath }),
      });
      const data = await res.json();
      if (data.success) {
        const actualFolder = data.target || folderPath;
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(actualFolder).catch(() => {});
        }
        get().setNotification({
          id: Date.now(),
          title: t.notifications.folderOpened,
          detail: t.notifications.folderOpenedDetail(actualFolder),
          type: 'success',
        });
      } else {
        get().setNotification({
          id: Date.now(),
          title: t.notifications.folderOpenFailed,
          detail: data.message || t.notifications.folderOpenException,
          type: 'error',
        });
      }
    } catch (err: any) {
      get().setNotification({
        id: Date.now(),
        title: t.notifications.folderOpenException,
        detail: err.message,
        type: 'error',
      });
    }
  },

  openProjectFolder: async (projectPath?: string) => {
    const targetPath = projectPath || get().getWorkspaceOpenFolder() || get().projects.find((p) => p.id === get().activeProjectId)?.path;
    if (!targetPath) return;

    // 自动复制项目绝对路径至系统剪贴板（防丢失）
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(targetPath).catch(() => {});
    }

    const t = getLocale(get().language);

    // 1. Electron 桌面容器调用
    if (typeof window !== 'undefined' && (window as any).electron?.shell?.openPath) {
      try {
        await (window as any).electron.shell.openPath(targetPath);
        get().setNotification({
          id: Date.now(),
          title: t.notifications.projectFolderOpened,
          detail: t.notifications.projectFolderOpenedDetail(targetPath),
          type: 'success',
        });
        return;
      } catch {}
    }

    // 2. Tauri 桌面容器调用
    if (typeof window !== 'undefined' && (window as any).__TAURI__?.shell?.open) {
      try {
        await (window as any).__TAURI__.shell.open(targetPath);
        get().setNotification({
          id: Date.now(),
          title: t.notifications.projectFolderOpened,
          detail: t.notifications.projectFolderOpenedDetail(targetPath),
          type: 'success',
        });
        return;
      } catch {}
    }

    // 3. 本地后端服务（Windows Explorer / macOS Finder / Linux xdg-open）
    try {
      const res = await fetch('/api/git/reveal-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath, file: '' }),
      });
      const data = await res.json();
      if (data.success) {
        const actualFolder = data.target || targetPath;
        get().setNotification({
          id: Date.now(),
          title: t.notifications.projectFolderOpened,
          detail: t.notifications.projectFolderOpenedDetail(actualFolder),
          type: 'success',
        });
      } else {
        get().setNotification({
          id: Date.now(),
          title: t.notifications.projectFolderOpenFailed,
          detail: data.message || t.notifications.projectFolderOpenException,
          type: 'error',
        });
      }
    } catch (err: any) {
      get().setNotification({
        id: Date.now(),
        title: t.notifications.projectFolderOpenException,
        detail: err.message,
        type: 'error',
      });
    }
  },

  stageFile: async (filePath: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject || !filePath) return;
    try {
      const res = await fetch('/api/git/stage-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, file: filePath }),
      });
      const data = await res.json();
      if (data.success) {
        set((state) => ({
          files: state.files.map((f) => (f.path === filePath ? { ...f, checked: true } : f)),
        }));
        const cached = repoSnapshotCache.get(currentProject.path.toLowerCase());
        if (cached) {
          cached.files = cached.files.map((f) => (f.path === filePath ? { ...f, checked: true } : f));
          cached.lastUpdated = Date.now();
        }
        const t = getLocale(get().language);
        get().setNotification({
          id: Date.now(),
          title: t.notifications.changesStaged,
          detail: filePath,
          type: 'success',
        });
        await get().loadRepoData(currentProject.path, true);
      }
    } catch (e: any) {
      console.error('Failed to stage file:', e);
    }
  },

  unstageFile: async (filePath: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject || !filePath) return;
    try {
      const res = await fetch('/api/git/unstage-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, file: filePath }),
      });
      const data = await res.json();
      if (data.success) {
        set((state) => ({
          files: state.files.map((f) => (f.path === filePath ? { ...f, checked: false } : f)),
        }));
        const cached = repoSnapshotCache.get(currentProject.path.toLowerCase());
        if (cached) {
          cached.files = cached.files.map((f) => (f.path === filePath ? { ...f, checked: false } : f));
          cached.lastUpdated = Date.now();
        }
        const t = getLocale(get().language);
        get().setNotification({
          id: Date.now(),
          title: t.notifications.changesUnstaged,
          detail: filePath,
          type: 'info',
        });
        await get().loadRepoData(currentProject.path, true);
      }
    } catch (e: any) {
      console.error('Failed to unstage file:', e);
    }
  }
});
