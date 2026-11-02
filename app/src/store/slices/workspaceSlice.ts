import type {
  GitProject,
  WorkspaceGroupItem,
} from '../types';
import {
  normalizePath,
  safeLocalStorageSetItem,
  normalizeSnapshotFiles,
  getLocalSnapshot,
  loadDiskSnapshot,
  repoSnapshotCache,
  repoMetadataFreshness,
  syncRuntime,
  bindCrossWindowWorkspaceListeners,
  buildActiveProjectHydratedState,
} from '../storeHelpers';
import { getLocale } from '../../locales';
import { createWorkspaceSavedGroupsSlice } from './workspaceSavedGroupsSlice';

export const createWorkspaceSlice = (set: any, get: any) => ({
  ...createWorkspaceSavedGroupsSlice(set, get),

  gitUser: null,

  gitAuthors: [],

  workspaceAccounts: [],

  selectedAuthorNames: [],

  allScannedProjects: [],

  workspaceProjectPaths: [],

  projects: [],

  activeProjectId: '',

  isLoading: false,

  isRepoLoading: false,

  initApp: async () => {
    get().loadRecentProjects();
    const savedList = await get().loadSavedWorkspaces();

    const urlParams =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    const isExplicitWs = urlParams.has('ws');
    const startupBehavior = get().startupBehavior;
    const isWelcomeRequested =
      urlParams.get('welcome') === 'true' ||
      (typeof window !== 'undefined' && localStorage.getItem('omnigit_open_welcome') === 'true');

    if (typeof window !== 'undefined') {
      localStorage.removeItem('omnigit_open_welcome');
    }

    if (isWelcomeRequested || (!isExplicitWs && startupBehavior === 'welcome_screen')) {
      set({
        workspaceId: 'default',
        isWelcomeScreenOpen: true,
        isLoading: false,
        workspaceProjectPaths: [],
        projects: [],
        activeProjectId: '',
      });
      Promise.all([
        fetch('/api/git/user')
          .then((res) => res.json())
          .then((user) => set({ gitUser: user }))
          .catch(() => {}),
        fetch('/api/git/scan-projects')
          .then((res) => res.json())
          .then((allProjects) => set({ allScannedProjects: allProjects || [] }))
          .catch(() => {}),
      ]);
      return;
    }

    let activeWsId = isExplicitWs ? urlParams.get('ws') || 'default' : 'default';
    let targetWs: WorkspaceGroupItem | undefined;

    if (!isExplicitWs) {
      const lastWsId =
        typeof window !== 'undefined'
          ? localStorage.getItem('omnigit_last_active_workspace_id')
          : null;
      if (lastWsId && lastWsId !== 'default') {
        targetWs = savedList.find((w: WorkspaceGroupItem) => w.id === lastWsId);
      }
      if (!targetWs && savedList.length > 0) {
        targetWs = savedList[0];
      }

      if (targetWs) {
        activeWsId = targetWs.id;
        if (typeof window !== 'undefined') {
          safeLocalStorageSetItem('omnigit_last_active_workspace_id', activeWsId);
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('ws', activeWsId);
            window.history.replaceState(null, '', url.toString());
          } catch {}
        }
      } else {
        set({
          workspaceId: 'default',
          isWelcomeScreenOpen: true,
          isLoading: false,
          workspaceProjectPaths: [],
          projects: [],
          activeProjectId: '',
        });
        Promise.all([
          fetch('/api/git/user')
            .then((res) => res.json())
            .then((user) => set({ gitUser: user }))
            .catch(() => {}),
          fetch('/api/git/scan-projects')
            .then((res) => res.json())
            .then((allProjects) => set({ allScannedProjects: allProjects || [] }))
            .catch(() => {}),
        ]);
        return;
      }
    } else {
      targetWs = savedList.find((w: WorkspaceGroupItem) => w.id === activeWsId);
    }

    set({ workspaceId: activeWsId });

    bindCrossWindowWorkspaceListeners(() => {
      get().loadSavedWorkspaces();
      get().loadRecentProjects();
    });

    const storageKey = `omnigit_ws_paths_${activeWsId}`;
    const savedPathsJson = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
    let selectedPaths: string[] = [];

    if (savedPathsJson) {
      try {
        selectedPaths = JSON.parse(savedPathsJson);
      } catch {}
    }

    if (
      (!selectedPaths || selectedPaths.length === 0) &&
      targetWs &&
      targetWs.repos &&
      targetWs.repos.length > 0
    ) {
      selectedPaths = targetWs.repos.map((r) => r.path);
      if (typeof window !== 'undefined') {
        safeLocalStorageSetItem(storageKey, JSON.stringify(selectedPaths));
      }
    }

    if (!selectedPaths || selectedPaths.length === 0) {
      const candidateWs =
        savedList.find((w: WorkspaceGroupItem) => w.id === activeWsId) ||
        (savedList.length > 0 ? savedList[0] : null);
      if (candidateWs && candidateWs.repos && candidateWs.repos.length > 0) {
        targetWs = candidateWs;
        activeWsId = candidateWs.id;
        selectedPaths = candidateWs.repos.map((r: any) => r.path);
        set({ workspaceId: activeWsId });
        if (typeof window !== 'undefined') {
          safeLocalStorageSetItem(`omnigit_ws_paths_${activeWsId}`, JSON.stringify(selectedPaths));
          safeLocalStorageSetItem('omnigit_last_active_workspace_id', activeWsId);
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('ws', activeWsId);
            window.history.replaceState(null, '', url.toString());
          } catch {}
        }
      }
    }

    if (selectedPaths.length > 0) {
      const instantProjects: GitProject[] = selectedPaths.map((p, idx) => {
        const norm = p.replace(/\\/g, '/');
        const name = norm.split('/').filter(Boolean).pop() || `Repo ${idx + 1}`;
        const normLower = p.toLowerCase();
        const cached = repoSnapshotCache.get(normLower) || getLocalSnapshot(normLower);
        if (cached && !repoSnapshotCache.has(normLower)) {
          repoSnapshotCache.set(normLower, cached);
        }
        return {
          id: String(idx + 1),
          name,
          path: p,
          currentBranch: cached?.currentBranch || '...',
          upstream: cached?.upstream,
          incoming: cached?.incoming || 0,
          outgoing: cached?.outgoing || 0,
          uncommittedCount: cached?.files ? cached.files.length : 0,
        };
      });

      let activeProject = instantProjects[0];
      if (typeof window !== 'undefined') {
        const candidatePaths = [
          localStorage.getItem(`omnigit_last_active_project_path_${activeWsId}`),
          targetWs?.lastActiveProjectPath,
          localStorage.getItem('omnigit_last_active_project_path'),
        ].filter(Boolean) as string[];

        for (const cand of candidatePaths) {
          const matched = instantProjects.find((p) => normalizePath(p.path) === normalizePath(cand));
          if (matched) {
            activeProject = matched;
            break;
          }
        }
      } else if (targetWs?.lastActiveProjectPath) {
        const matched = instantProjects.find(
          (p) => normalizePath(p.path) === normalizePath(targetWs!.lastActiveProjectPath!)
        );
        if (matched) {
          activeProject = matched;
        }
      }

      if (typeof window !== 'undefined') {
        safeLocalStorageSetItem('omnigit_last_active_project_path', activeProject.path);
        safeLocalStorageSetItem(
          `omnigit_last_active_project_path_${activeWsId}`,
          activeProject.path
        );
        safeLocalStorageSetItem('omnigit_last_closed_project_path', activeProject.path);
      }

      const normActiveLower = normalizePath(activeProject.path);
      const activeCached =
        repoSnapshotCache.get(normActiveLower) || getLocalSnapshot(normActiveLower);
      if (activeCached && !repoSnapshotCache.has(normActiveLower)) {
        repoSnapshotCache.set(normActiveLower, activeCached);
      }

      const initialDraft =
        typeof window !== 'undefined'
          ? localStorage.getItem(`omnigit_commit_draft_${activeWsId}_${activeProject.path}`) ||
            localStorage.getItem(`omnigit_commit_draft_${activeProject.path}`) ||
            ''
          : '';

      instantProjects.forEach((p) => {
        get().registerRecentProject(
          p.path,
          p.name,
          p.currentBranch !== '...' ? p.currentBranch : undefined
        );
      });

      if (activeCached) {
        set({
          workspaceProjectPaths: selectedPaths,
          projects: instantProjects,
          activeProjectId: activeProject.id,
          commitMessage: initialDraft || activeCached.commitMessage || '',
          files: normalizeSnapshotFiles(activeCached.files || []).filter(
            (f) => f.status !== 'conflict'
          ),
          branches: activeCached.branches || [],
          commitLogs: activeCached.commitLogs || [],
          isMerging: false,
          mergeMessage: '',
          conflictedCount: 0,
          isRepoLoading: false,
          isLoading: false,
        });
      } else {
        set({
          workspaceProjectPaths: selectedPaths,
          projects: instantProjects,
          activeProjectId: activeProject.id,
          commitMessage: initialDraft,
          isRepoLoading: true,
          isLoading: false,
        });
      }

      get().syncCurrentWorkspaceToSaved(activeProject.path);

      if (typeof document !== 'undefined') {
        document.title = `OmniGit - ${activeProject.name}`;
      }

      Promise.all([
        get().loadRepoData(activeProject.path),
        get().pollWorkspaceSyncStatus(),
        get().loadWorkspaceAccounts(),
      ]);

      fetch('/api/git/scan-projects')
        .then((res) => res.json())
        .then((allProjects) => set({ allScannedProjects: allProjects || [] }))
        .catch(() => {});

      if (typeof window !== 'undefined' && !(window as any).__omnigit_sync_interval_set) {
        (window as any).__omnigit_sync_interval_set = true;
        window.addEventListener('focus', () => {
          const now = Date.now();
          if (now - syncRuntime.lastFocusSyncTime > 30000) {
            syncRuntime.lastFocusSyncTime = now;
            get().pollWorkspaceSyncStatus();
            const curr = get().projects.find((p: GitProject) => p.id === get().activeProjectId);
            if (curr) {
              get().syncRepoStatusSilently(curr.path);
            }
          }
        });
        setInterval(() => {
          if (!document.hidden) {
            get().pollWorkspaceSyncStatus();
          }
        }, 30000);
      }
      return;
    }

    set({
      workspaceProjectPaths: [],
      projects: [],
      activeProjectId: '',
      commitMessage: '',
      files: [],
      branches: [],
      commitLogs: [],
      isLoading: false,
      isRepoLoading: false,
    });

    if (typeof document !== 'undefined') {
      document.title = 'OmniGit - Empty Workspace';
    }

    Promise.all([
      fetch('/api/git/user')
        .then((res) => res.json())
        .then((user) => set({ gitUser: user }))
        .catch(() => {}),
      fetch('/api/git/scan-projects')
        .then((res) => res.json())
        .then((allProjects) => set({ allScannedProjects: allProjects || [] }))
        .catch(() => {}),
    ]);
    return;
  },

  addProjectsToWorkspace: async (newPaths: string[]) => {
    const state = get();
    const storageKey = `omnigit_ws_paths_${state.workspaceId}`;
    const merged = Array.from(new Set([...state.workspaceProjectPaths, ...newPaths]));

    safeLocalStorageSetItem(storageKey, JSON.stringify(merged));

    let allProjects = [...state.allScannedProjects];
    for (const p of newPaths) {
      const normP = normalizePath(p);
      if (!allProjects.some((exist) => normalizePath(exist.path) === normP)) {
        try {
          const statusRes = await fetch(`/api/git/status?path=${encodeURIComponent(p)}`);
          const status = await statusRes.json();
          allProjects.push({
            id: String(Date.now() + Math.random()),
            name: status.repoName || p.split(/[\\/]/).pop() || 'repo',
            path: p,
            currentBranch: status.currentBranch || 'main',
            upstream: status.upstream,
            incoming: status.incoming || 0,
            outgoing: status.outgoing || 0,
          });
        } catch {
          allProjects.push({
            id: String(Date.now() + Math.random()),
            name: p.split(/[\\/]/).pop() || 'repo',
            path: p,
            currentBranch: 'main',
            incoming: 0,
            outgoing: 0,
          });
        }
      }
    }

    const resolvedProjects: GitProject[] = merged.map((p, idx) => {
      const normP = normalizePath(p);
      const found = allProjects.find((exist) => normalizePath(exist.path) === normP);
      if (found) {
        return { ...found, path: p };
      }
      return {
        id: String(Date.now() + Math.random() + idx),
        name: p.split(/[\\/]/).filter(Boolean).pop() || `Repo ${idx + 1}`,
        path: p,
        currentBranch: 'main',
        incoming: 0,
        outgoing: 0,
      };
    });

    set({
      allScannedProjects: allProjects,
      workspaceProjectPaths: merged,
      projects: resolvedProjects,
      notification: {
        id: Date.now(),
        title: `Added ${newPaths.length} repository(ies) to workspace`,
        type: 'success',
      },
    });

    get().syncCurrentWorkspaceToSaved();

    const savedActivePath =
      typeof window !== 'undefined'
        ? localStorage.getItem('omnigit_last_active_project_path')
        : null;
    if (
      (!state.activeProjectId || !resolvedProjects.some((p) => p.id === state.activeProjectId)) &&
      resolvedProjects.length > 0
    ) {
      let targetRepo = resolvedProjects[0];
      if (savedActivePath) {
        const matched = resolvedProjects.find(
          (p) => normalizePath(p.path) === normalizePath(savedActivePath)
        );
        if (matched) targetRepo = matched;
      }
      set({ activeProjectId: targetRepo.id });
      get().syncCurrentWorkspaceToSaved(targetRepo.path);
      await get().loadRepoData(targetRepo.path);
    } else {
      await get().loadWorkspaceAccounts();
    }
  },

  cloneAndImportRepo: async (params: {
    remoteUrl: string;
    targetDir: string;
    folderName?: string;
    branch?: string;
    username?: string;
    password?: string;
  }): Promise<{ success: boolean; message: string; repoPath?: string }> => {
    let fullTargetDir = params.targetDir.trim();
    if (params.folderName && params.folderName.trim()) {
      const cleanTarget = fullTargetDir.replace(/[\\/]+$/, '');
      fullTargetDir = `${cleanTarget}\\${params.folderName.trim()}`;
    }

    try {
      const res = await fetch('/api/git/clone-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remoteUrl: params.remoteUrl.trim(),
          targetDir: fullTargetDir,
          branch: params.branch?.trim() || undefined,
          username: params.username?.trim() || undefined,
          password: params.password?.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        return {
          success: false,
          message:
            data.message ||
            (get().language === 'zh-CN' ? '克隆仓库失败' : 'Failed to clone repository'),
        };
      }

      const repoPath = data.repoPath || fullTargetDir;
      await get().addProjectsToWorkspace([repoPath]);

      const createdProject = get().projects.find(
        (p: GitProject) => normalizePath(p.path) === normalizePath(repoPath)
      );
      if (createdProject) {
        get().setActiveProject(createdProject.id);
        await get().loadRepoData(createdProject.path);
      }

      const t = getLocale(get().language);
      get().setNotification({
        id: Date.now(),
        title: t.notifications.cloneSuccess,
        detail: t.notifications.cloneSuccessDetail(
          data.repoName || params.folderName || repoPath
        ),
        type: 'success',
      });

      return { success: true, message: data.message, repoPath };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || getLocale(get().language).notifications.networkError,
      };
    }
  },

  setWorkspaceProjects: async (newPaths: string[]) => {
    const state = get();
    const storageKey = `omnigit_ws_paths_${state.workspaceId}`;
    safeLocalStorageSetItem(storageKey, JSON.stringify(newPaths));

    let allProjects = [...state.allScannedProjects];
    for (const p of newPaths) {
      const normP = normalizePath(p);
      if (!allProjects.some((exist) => normalizePath(exist.path) === normP)) {
        try {
          const statusRes = await fetch(`/api/git/status?path=${encodeURIComponent(p)}`);
          const status = await statusRes.json();
          allProjects.push({
            id: String(Date.now() + Math.random()),
            name: status.repoName || p.split(/[\\/]/).pop() || 'repo',
            path: p,
            currentBranch: status.currentBranch || 'main',
            upstream: status.upstream,
            incoming: status.incoming || 0,
            outgoing: status.outgoing || 0,
          });
        } catch {
          allProjects.push({
            id: String(Date.now() + Math.random()),
            name: p.split(/[\\/]/).pop() || 'repo',
            path: p,
            currentBranch: 'main',
            incoming: 0,
            outgoing: 0,
          });
        }
      }
    }

    const resolvedProjects: GitProject[] = newPaths.map((p, idx) => {
      const normP = normalizePath(p);
      const found = allProjects.find((exist) => normalizePath(exist.path) === normP);
      if (found) {
        return { ...found, path: p };
      }
      return {
        id: String(Date.now() + Math.random() + idx),
        name: p.split(/[\\/]/).filter(Boolean).pop() || `Repo ${idx + 1}`,
        path: p,
        currentBranch: 'main',
        incoming: 0,
        outgoing: 0,
      };
    });

    set({
      allScannedProjects: allProjects,
      workspaceProjectPaths: newPaths,
      projects: resolvedProjects,
      notification: {
        id: Date.now(),
        title: 'Workspace repositories updated',
        type: 'success',
      },
    });

    if (resolvedProjects.length > 0) {
      const currentWs = get().savedWorkspaces.find(
        (w: WorkspaceGroupItem) => w.id === state.workspaceId
      );
      const candidatePaths =
        typeof window !== 'undefined'
          ? ([
              localStorage.getItem(`omnigit_last_active_project_path_${state.workspaceId}`),
              currentWs?.lastActiveProjectPath,
              localStorage.getItem('omnigit_last_active_project_path'),
            ].filter(Boolean) as string[])
          : currentWs?.lastActiveProjectPath
          ? [currentWs.lastActiveProjectPath]
          : [];

      let matched: GitProject | undefined;
      for (const cand of candidatePaths) {
        matched = resolvedProjects.find((p) => normalizePath(p.path) === normalizePath(cand));
        if (matched) break;
      }
      if (matched) {
        await get().setActiveProject(matched.id);
      } else if (!resolvedProjects.some((p) => p.id === state.activeProjectId)) {
        await get().setActiveProject(resolvedProjects[0].id);
      } else {
        await get().loadWorkspaceAccounts();
      }
      get().syncCurrentWorkspaceToSaved();
    } else if (newPaths.length === 0) {
      get().removeSavedWorkspace(state.workspaceId);
      set({
        activeProjectId: '',
        commitMessage: '',
        commitHistory: [],
        files: [],
        branches: [],
        selectedFilePath: null,
        selectedFileDiff: { oldContent: '', newContent: '' },
      });
      await get().loadWorkspaceAccounts();
    }
  },

  removeProjectFromWorkspace: async (targetPath: string) => {
    const state = get();
    const storageKey = `omnigit_ws_paths_${state.workspaceId}`;
    const normTarget = normalizePath(targetPath);
    const filteredPaths = state.workspaceProjectPaths.filter(
      (p: string) => normalizePath(p) !== normTarget
    );

    safeLocalStorageSetItem(storageKey, JSON.stringify(filteredPaths));

    const remainingProjects = state.projects.filter(
      (p: GitProject) => normalizePath(p.path) !== normTarget
    );
    set({
      workspaceProjectPaths: filteredPaths,
      projects: remainingProjects,
      notification: {
        id: Date.now(),
        title: 'Removed repository from workspace',
        type: 'info',
      },
    });

    if (filteredPaths.length > 0) {
      get().syncCurrentWorkspaceToSaved();
    } else {
      get().removeSavedWorkspace(state.workspaceId);
    }

    if (remainingProjects.length > 0) {
      await get().setActiveProject(remainingProjects[0].id);
    } else {
      set({
        activeProjectId: '',
        commitMessage: '',
        commitHistory: [],
        files: [],
        branches: [],
        selectedFilePath: null,
        selectedFileDiff: { oldContent: '', newContent: '' },
      });
      await get().loadWorkspaceAccounts();
    }
  },

  setActiveProject: async (id: string) => {
    const currentProject = get().projects.find((p: GitProject) => p.id === get().activeProjectId);
    const targetProject = get().projects.find(
      (p: GitProject) => p.id === id || normalizePath(p.path) === normalizePath(id)
    );
    if (!targetProject) return;

    if (currentProject && currentProject.id === id && !get().isRepoLoading) {
      return;
    }

    if (currentProject && typeof window !== 'undefined') {
      const msg = get().commitMessage;
      if (msg && !get().isAmend) {
        safeLocalStorageSetItem(`omnigit_commit_draft_${currentProject.path}`, msg);
      }
      const curCached = repoSnapshotCache.get(normalizePath(currentProject.path));
      if (curCached) {
        curCached.commitMessage = msg;
        curCached.files = get().files;
        curCached.selectedFilePath = get().selectedFilePath;
      }
    }

    let targetDraft = '';
    if (typeof window !== 'undefined') {
      targetDraft =
        localStorage.getItem(`omnigit_commit_draft_${get().workspaceId}_${targetProject.path}`) ||
        localStorage.getItem(`omnigit_commit_draft_${targetProject.path}`) ||
        '';
      safeLocalStorageSetItem('omnigit_last_active_project_path', targetProject.path);
      safeLocalStorageSetItem(
        `omnigit_last_active_project_path_${get().workspaceId}`,
        targetProject.path
      );
      safeLocalStorageSetItem('omnigit_last_closed_project_path', targetProject.path);
      safeLocalStorageSetItem('omnigit_last_active_workspace_id', get().workspaceId);
    }
    get().registerRecentProject(targetProject.path, targetProject.name, targetProject.currentBranch);
    get().syncCurrentWorkspaceToSaved(targetProject.path);

    syncRuntime.currentRepoLoadId++;

    const normTargetPath = normalizePath(targetProject.path);
    let cached = repoSnapshotCache.get(normTargetPath) || getLocalSnapshot(normTargetPath);
    if (!cached) {
      cached = await loadDiskSnapshot(targetProject.path);
    }
    if (cached && !repoSnapshotCache.has(normTargetPath)) {
      repoSnapshotCache.set(normTargetPath, cached);
    }

    if (cached) {
      set(buildActiveProjectHydratedState(id, targetDraft, cached));

      get().syncCurrentWorkspaceToSaved(targetProject.path);

      if (typeof document !== 'undefined') {
        document.title = `OmniGit - ${targetProject.name}`;
      }

      if (
        cached.selectedFilePath &&
        Array.isArray(cached.files) &&
        cached.files.some((f) => f.path === cached.selectedFilePath)
      ) {
        get().setSelectedFile(cached.selectedFilePath);
      }

      if (!cached.commitLogs || cached.commitLogs.length <= 10) {
        loadDiskSnapshot(targetProject.path).then((diskSnap) => {
          if (
            diskSnap &&
            Array.isArray(diskSnap.commitLogs) &&
            diskSnap.commitLogs.length > (cached?.commitLogs?.length || 0)
          ) {
            if (get().activeProjectId === id) {
              set({ commitLogs: diskSnap.commitLogs, commitLogsSkip: diskSnap.commitLogs.length });
            }
          }
        });
      }

      const isStale = Date.now() - (cached.lastUpdated || 0) >= 15000;
      if (isStale) {
        get().loadRepoData(targetProject.path, false);
      } else {
        const lastMetaTime = repoMetadataFreshness.get(normTargetPath) || 0;
        if (Date.now() - lastMetaTime >= 30000) {
          repoMetadataFreshness.set(normTargetPath, Date.now());
          get().loadRepoAuthors(targetProject.path);
          get().loadRecentCommitMessages(targetProject.path);
          get().loadLastCommit(targetProject.path);
        }
      }
      get().loadWorkspaceAccounts();
      if (get().activeTab === 'log') {
        get().fetchCommitLogs(true);
      }
    } else {
      set(buildActiveProjectHydratedState(id, targetDraft, null));

      get().syncCurrentWorkspaceToSaved(targetProject.path);

      if (typeof document !== 'undefined') {
        document.title = `OmniGit - ${targetProject.name}`;
      }

      try {
        await get().loadRepoData(targetProject.path, true);
        get().loadWorkspaceAccounts();
        if (get().activeTab === 'log') {
          await get().fetchCommitLogs(true);
        }
      } finally {
        if (get().activeProjectId === id) {
          set({ isRepoLoading: false });
        }
      }
    }
  },
});
