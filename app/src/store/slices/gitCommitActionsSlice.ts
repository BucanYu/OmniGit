import type { GitCommitDetails } from '../types';
import {
  safeLocalStorageSetItem,
  saveLocalSnapshot,
  repoSnapshotCache,
} from '../storeHelpers';
import { getLocale } from '../../locales';

export const createGitCommitActionsSlice = (set: any, get: any) => ({
  isAmend: false,

  commitMessage: '',

  commitHistory: [],

  rollbackModal: {
    isOpen: false,
    targetPaths: [],
  },

  lastCommitDetails: null,

  setIsAmend: async (isAmend: boolean) => {
    const state = get();
    const currentProject = state.projects.find((p: any) => p.id === state.activeProjectId);
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

  setCommitMessage: (msg: string) => {
    set({ commitMessage: msg });
    const currentProject = get().projects.find((p: any) => p.id === get().activeProjectId);
    if (currentProject && typeof window !== 'undefined') {
      if (msg && !get().isAmend) {
        safeLocalStorageSetItem(`omnigit_commit_draft_${currentProject.path}`, msg);
      } else if (!msg && !get().isAmend) {
        localStorage.removeItem(`omnigit_commit_draft_${currentProject.path}`);
      }
    }
  },

  loadLastCommit: async (repoPath?: string) => {
    const targetPath =
      repoPath || get().projects.find((p: any) => p.id === get().activeProjectId)?.path;
    if (!targetPath) return null;
    const normTarget = targetPath.replace(/\\/g, '/').toLowerCase();
    try {
      const res = await fetch(`/api/git/last-commit?path=${encodeURIComponent(targetPath)}`);
      if (res.ok) {
        const details: GitCommitDetails = await res.json();
        const nowActive = get().projects.find((p: any) => p.id === get().activeProjectId);
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
    const targetPath =
      repoPath || get().projects.find((p: any) => p.id === get().activeProjectId)?.path;
    if (!targetPath) return;
    const normTarget = targetPath.replace(/\\/g, '/').toLowerCase();
    try {
      const res = await fetch(
        `/api/git/recent-commit-messages?path=${encodeURIComponent(targetPath)}&limit=25`
      );
      if (res.ok) {
        const gitMessages: string[] = await res.json();
        let localHistory: string[] = [];
        if (typeof window !== 'undefined') {
          try {
            localHistory = JSON.parse(
              localStorage.getItem(`omnigit_history_${targetPath}`) || '[]'
            );
          } catch {}
        }
        const projectHistory = Array.from(new Set([...localHistory, ...gitMessages])).slice(0, 30);

        const cached = repoSnapshotCache.get(normTarget);
        if (cached) {
          cached.commitHistory = projectHistory;
        }

        const nowActive = get().projects.find((p: any) => p.id === get().activeProjectId);
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
    const currentProject = state.projects.find((p: any) => p.id === state.activeProjectId);
    if (!currentProject) return;

    if (state.isMerging) {
      await state.completeMergeCommit(state.commitMessage);
      if (pushAfter) {
        get().openPushModal(currentProject.currentBranch);
      }
      return;
    }

    const checkedFiles = state.files.filter((f: any) => f.checked).map((f: any) => f.path);
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
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`omnigit_commit_draft_${currentProject.path}`);
          const subject = state.commitMessage.split('\n')[0].trim();
          try {
            const key = `omnigit_history_${currentProject.path}`;
            const prev: string[] = JSON.parse(localStorage.getItem(key) || '[]');
            const updated = Array.from(new Set([subject, ...prev])).slice(0, 20);
            safeLocalStorageSetItem(key, JSON.stringify(updated));
          } catch {}
        }

        const subject = state.commitMessage.split('\n')[0].trim();
        const newHistory = Array.from(new Set([subject, ...state.commitHistory])).slice(0, 30);

        const remainingFiles = state.files.filter((f: any) => !checkedFiles.includes(f.path));
        const outgoingDelta = state.isAmend ? 0 : 1;
        const normPath = currentProject.path.toLowerCase();

        set((curr: any) => ({
          commitMessage: '',
          isAmend: false,
          commitHistory: newHistory,
          files: remainingFiles,
          selectedFilePath:
            curr.selectedFilePath && checkedFiles.includes(curr.selectedFilePath)
              ? remainingFiles[0]?.path || null
              : curr.selectedFilePath,
          selectedFileDiff:
            curr.selectedFilePath &&
            checkedFiles.includes(curr.selectedFilePath) &&
            remainingFiles.length === 0
              ? { oldContent: '', newContent: '' }
              : curr.selectedFileDiff,
          projects: curr.projects.map((p: any) =>
            p.id === currentProject.id
              ? {
                  ...p,
                  outgoing: (p.outgoing || 0) + outgoingDelta,
                  uncommittedCount: remainingFiles.length,
                }
              : p
          ),
          branches: curr.branches.map((b: any) =>
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

  openRollbackModal: (paths: string[]) => {
    set({ rollbackModal: { isOpen: true, targetPaths: paths } });
  },

  closeRollbackModal: () => {
    set({ rollbackModal: { isOpen: false, targetPaths: [] } });
  },

  confirmRollback: async () => {
    const { targetPaths } = get().rollbackModal;
    const currentProject = get().projects.find((p: any) => p.id === get().activeProjectId);
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

      const remainingFiles = get().files.filter((f: any) => !targetPaths.includes(f.path));
      const normPath = currentProject.path.toLowerCase();

      set((curr: any) => ({
        rollbackModal: { isOpen: false, targetPaths: [] },
        files: remainingFiles,
        selectedFilePath:
          curr.selectedFilePath && targetPaths.includes(curr.selectedFilePath)
            ? remainingFiles[0]?.path || null
            : curr.selectedFilePath,
        selectedFileDiff:
          curr.selectedFilePath &&
          targetPaths.includes(curr.selectedFilePath) &&
          remainingFiles.length === 0
            ? { oldContent: '', newContent: '' }
            : curr.selectedFileDiff,
        projects: curr.projects.map((p: any) =>
          p.id === currentProject.id ? { ...p, uncommittedCount: remainingFiles.length } : p
        ),
        notification: {
          id: Date.now(),
          title: `Rolled back ${targetPaths.length} file(s)`,
          detail: result.message,
          type: 'info',
        },
      }));

      const cached = repoSnapshotCache.get(normPath);
      if (cached) {
        cached.files = remainingFiles;
        cached.lastUpdated = Date.now();
        saveLocalSnapshot(normPath, cached);
      }

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
    const currentProject = get().projects.find((p: any) => p.id === get().activeProjectId);
    if (!currentProject || !filePath) return;

    const sep = currentProject.path.includes('\\') ? '\\' : '/';
    const fullPath =
      filePath.includes(':') || filePath.startsWith('/')
        ? filePath
        : currentProject.path + sep + filePath.replace(/\//g, sep);
    const folderPath = fullPath.includes(sep)
      ? fullPath.substring(0, fullPath.lastIndexOf(sep))
      : currentProject.path;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(folderPath).catch(() => {});
    }

    const t = getLocale(get().language);

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
    const targetPath =
      projectPath ||
      get().getWorkspaceOpenFolder() ||
      get().projects.find((p: any) => p.id === get().activeProjectId)?.path;
    if (!targetPath) return;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(targetPath).catch(() => {});
    }

    const t = getLocale(get().language);

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
    const currentProject = get().projects.find((p: any) => p.id === get().activeProjectId);
    if (!currentProject || !filePath) return;
    try {
      const res = await fetch('/api/git/stage-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, file: filePath }),
      });
      const data = await res.json();
      if (data.success) {
        set((state: any) => ({
          files: state.files.map((f: any) => (f.path === filePath ? { ...f, checked: true } : f)),
        }));
        const cached = repoSnapshotCache.get(currentProject.path.toLowerCase());
        if (cached) {
          cached.files = cached.files.map((f) =>
            f.path === filePath ? { ...f, checked: true } : f
          );
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
    const currentProject = get().projects.find((p: any) => p.id === get().activeProjectId);
    if (!currentProject || !filePath) return;
    try {
      const res = await fetch('/api/git/unstage-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, file: filePath }),
      });
      const data = await res.json();
      if (data.success) {
        set((state: any) => ({
          files: state.files.map((f: any) => (f.path === filePath ? { ...f, checked: false } : f)),
        }));
        const cached = repoSnapshotCache.get(currentProject.path.toLowerCase());
        if (cached) {
          cached.files = cached.files.map((f) =>
            f.path === filePath ? { ...f, checked: false } : f
          );
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
  },
});
