import type {
  GitProject,
  WorkspaceGroupItem,
  WorkspaceRepoItem,
  RecentProjectItem,
} from '../types';
import {
  normalizePath,
  broadcastWorkspaceChanged,
  buildWorkspaceRecord,
  safeLocalStorageSetItem,
  scheduleWorkspacesDiskBackup,
  normalizeSnapshotFiles,
  getLocalSnapshot,
  currentWorkspaceId,
  repoSnapshotCache,
  aggregateReposIntoWorkspaces,
} from '../storeHelpers';
import { useEditorTabsStore } from '../../features/code-editor/useEditorTabsStore';

export const createWorkspaceSavedGroupsSlice = (set: any, get: any) => ({
  workspaceId: currentWorkspaceId,

  isWelcomeScreenOpen: false,

  openWelcomeScreen: () => {
    get().loadSavedWorkspaces();
    get().loadRecentProjects();
    set({ isWelcomeScreenOpen: true });
  },

  closeWelcomeScreen: () => {
    const state = get();
    if (state.projects && state.projects.length > 0) {
      set({ isWelcomeScreenOpen: false });
    } else if (state.savedWorkspaces && state.savedWorkspaces.length > 0) {
      get().openWorkspaceGroup(state.savedWorkspaces[0], false);
    } else {
      set({ isWelcomeScreenOpen: false });
    }
  },

  startupBehavior:
    (typeof window !== 'undefined' && (localStorage.getItem('omnigit_startup_behavior') as any)) ||
    'reopen_last',

  setStartupBehavior: (behavior: 'reopen_last' | 'welcome_screen') => {
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_startup_behavior', behavior);
    }
    set({ startupBehavior: behavior });
  },

  newWindowBehavior:
    (typeof window !== 'undefined' && (localStorage.getItem('omnigit_new_window_behavior') as any)) ||
    'empty',

  setNewWindowBehavior: (behavior: 'empty' | 'welcome') => {
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_new_window_behavior', behavior);
    }
    set({ newWindowBehavior: behavior });
  },

  savedWorkspaces: [],

  loadSavedWorkspaces: async (): Promise<WorkspaceGroupItem[]> => {
    if (typeof window === 'undefined') return [];
    try {
      localStorage.removeItem('omnigit_ws_paths_default');
      localStorage.removeItem('omnigit_last_active_project_path_default');
    } catch {}

    let list: WorkspaceGroupItem[] = [];
    try {
      const raw = localStorage.getItem('omnigit_saved_workspaces');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed.filter((w) => w && w.id && w.id !== 'default');
        }
      }
    } catch {}

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('omnigit_ws_paths_')) {
          const wsId = key.replace('omnigit_ws_paths_', '');
          if (!wsId || wsId === 'default') {
            if (wsId === 'default') {
              try {
                localStorage.removeItem(key);
                localStorage.removeItem('omnigit_last_active_project_path_default');
              } catch {}
            }
            continue;
          }
          const rawPaths = localStorage.getItem(key);
          if (!rawPaths) continue;
          const paths: string[] = JSON.parse(rawPaths);
          if (Array.isArray(paths) && paths.length > 0) {
            const existingIdx = list.findIndex(
              (w) =>
                w.id === wsId ||
                w.id === `ws_${wsId}` ||
                (wsId.startsWith('ws_') && w.id === wsId.replace('ws_', ''))
            );
            if (existingIdx >= 0) {
              const existing = list[existingIdx];
              const existingPathSet = new Set(existing.repos.map((r) => normalizePath(r.path)));
              const isSame =
                existing.repos.length === paths.length &&
                paths.every((p) => existingPathSet.has(normalizePath(p)));
              if (!isSame) {
                const updatedRepos: WorkspaceRepoItem[] = paths.map((p) => {
                  const normP = normalizePath(p);
                  const foundRepo = existing.repos.find((r) => normalizePath(r.path) === normP);
                  const norm = p.replace(/\\/g, '/');
                  const name = foundRepo?.name || norm.split('/').filter(Boolean).pop() || 'repo';
                  return {
                    name,
                    path: p,
                    branch: foundRepo?.branch || 'main',
                  };
                });
                list[existingIdx] = buildWorkspaceRecord(
                  existing.id,
                  paths,
                  existing,
                  updatedRepos,
                  get().language
                );
              }
            } else {
              const lastActive =
                typeof window !== 'undefined'
                  ? localStorage.getItem(`omnigit_last_active_project_path_${wsId}`)
                  : undefined;
              const newWs = buildWorkspaceRecord(
                wsId,
                paths,
                undefined,
                undefined,
                get().language,
                lastActive || undefined
              );
              list.push(newWs);
            }
          }
        }
      }
    } catch {}

    if (list.length === 0) {
      const recent = get().globalRecentProjects;
      if (recent && recent.length > 0) {
        list = aggregateReposIntoWorkspaces(recent);
      }
    }

    if (list.length === 0) {
      try {
        const res = await fetch('/api/git/workspaces/backup');
        const backup = await res.json();
        if (backup) {
          const sanitizedBackup: WorkspaceGroupItem[] = Array.isArray(backup.savedWorkspaces)
            ? backup.savedWorkspaces.filter((w: any) => w && w.id && w.id !== 'default')
            : [];
          if (backup.workspaceProjectPaths && typeof backup.workspaceProjectPaths === 'object') {
            Object.entries(backup.workspaceProjectPaths).forEach(([wsId, paths]: [string, any]) => {
              if (wsId && wsId !== 'default' && Array.isArray(paths) && paths.length > 0) {
                safeLocalStorageSetItem(`omnigit_ws_paths_${wsId}`, JSON.stringify(paths));
                if (!sanitizedBackup.some((w) => w.id === wsId)) {
                  sanitizedBackup.push(
                    buildWorkspaceRecord(wsId, paths, undefined, undefined, get().language)
                  );
                }
              }
            });
          }
          if (Array.isArray(backup.recentProjects) && backup.recentProjects.length > 0) {
            safeLocalStorageSetItem(
              'omnigit_global_recent_projects',
              JSON.stringify(backup.recentProjects)
            );
            set({ globalRecentProjects: backup.recentProjects });
          }
          list = sanitizedBackup;
        }
      } catch (err) {
        console.warn('[OmniGit] Failed to fetch disk backup during loadSavedWorkspaces:', err);
      }
    }

    const multiRepoPaths = new Set<string>();
    for (const ws of list) {
      if (ws.id !== 'default' && ws.repos && ws.repos.length > 1) {
        ws.repos.forEach((r) => {
          if (r.path) {
            multiRepoPaths.add(normalizePath(r.path));
          }
        });
      }
    }

    list = list.filter((ws) => {
      if (!ws || !ws.id || ws.id === 'default') return false;
      if (ws.repos && ws.repos.length === 1) {
        const singlePath = normalizePath(ws.repos[0].path || '');
        if (
          multiRepoPaths.has(singlePath) &&
          (ws.id.startsWith('ws_default') || ws.id === 'default' || ws.name === ws.repos[0].name)
        ) {
          try {
            localStorage.removeItem(`omnigit_ws_paths_${ws.id}`);
            localStorage.removeItem(`omnigit_last_active_project_path_${ws.id}`);
          } catch {}
          return false;
        }
      }
      return true;
    });

    const seenIds = new Set<string>();
    const deduplicated: WorkspaceGroupItem[] = [];
    for (const ws of list) {
      if (!ws || !ws.id || ws.id === 'default' || seenIds.has(ws.id)) continue;
      seenIds.add(ws.id);
      deduplicated.push(ws);
    }

    deduplicated.sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0));

    safeLocalStorageSetItem('omnigit_saved_workspaces', JSON.stringify(deduplicated));
    set({ savedWorkspaces: deduplicated });
    if (deduplicated.length > 0) {
      scheduleWorkspacesDiskBackup();
    }
    return deduplicated;
  },

  saveWorkspaceRecord: (ws: WorkspaceGroupItem) => {
    if (typeof window === 'undefined' || !ws || !ws.id || ws.id === 'default') return;
    const current = (Array.isArray(get().savedWorkspaces) ? get().savedWorkspaces : []).filter(
      (w: any) => w && w.id && w.id !== 'default'
    );
    const idx = current.findIndex((w: any) => w.id === ws.id);
    if (idx >= 0) {
      current[idx] = { ...current[idx], ...ws, lastOpened: Date.now() };
    } else {
      current.unshift({ ...ws, lastOpened: Date.now() });
    }
    safeLocalStorageSetItem('omnigit_saved_workspaces', JSON.stringify(current));
    set({ savedWorkspaces: current });
    broadcastWorkspaceChanged();
    scheduleWorkspacesDiskBackup();
  },

  removeSavedWorkspace: (id: string) => {
    if (typeof window === 'undefined') return;
    const updated = get().savedWorkspaces.filter((w: any) => w.id !== id);
    safeLocalStorageSetItem('omnigit_saved_workspaces', JSON.stringify(updated));
    localStorage.removeItem(`omnigit_ws_paths_${id}`);
    localStorage.removeItem(`omnigit_last_active_project_path_${id}`);
    if (localStorage.getItem('omnigit_last_active_workspace_id') === id) {
      localStorage.removeItem('omnigit_last_active_workspace_id');
    }
    set({ savedWorkspaces: updated });
    broadcastWorkspaceChanged();
    scheduleWorkspacesDiskBackup();
  },

  renameSavedWorkspace: (id: string, newName: string) => {
    if (typeof window === 'undefined' || !newName.trim()) return;
    const current = get().savedWorkspaces.slice();
    const target = current.find((w: any) => w.id === id);
    if (target) {
      target.name = newName.trim();
      safeLocalStorageSetItem('omnigit_saved_workspaces', JSON.stringify(current));
      set({ savedWorkspaces: current });
      broadcastWorkspaceChanged();
      scheduleWorkspacesDiskBackup();
    }
  },

  openWorkspaceGroup: async (ws: WorkspaceGroupItem, inNewWindow = false) => {
    if (!ws) return;
    const targetWsId = ws.id || `ws_${Date.now()}`;

    const currentWsId = get().workspaceId;
    if (currentWsId && currentWsId !== 'default' && currentWsId !== targetWsId && !inNewWindow) {
      try {
        useEditorTabsStore.getState().savePersistedTabs(currentWsId);
      } catch {}
    }

    const rawRepos = Array.isArray(ws.repos) ? ws.repos : [];
    let repoPaths = rawRepos
      .map((r: any) => (typeof r === 'string' ? r : r?.path))
      .filter((p: any): p is string => typeof p === 'string' && p.trim().length > 0);

    if (repoPaths.length === 0 && ws.rootPath) {
      repoPaths = [ws.rootPath];
    }

    const candidatePaths =
      typeof window !== 'undefined'
        ? ([
            localStorage.getItem(`omnigit_last_active_project_path_${targetWsId}`),
            ws.lastActiveProjectPath,
            localStorage.getItem('omnigit_last_active_project_path'),
          ].filter(Boolean) as string[])
        : ws.lastActiveProjectPath
        ? [ws.lastActiveProjectPath]
        : [];

    let matchedActivePath: string | undefined;
    for (const cand of candidatePaths) {
      if (cand && repoPaths.some((p) => normalizePath(p) === normalizePath(cand))) {
        matchedActivePath = cand;
        break;
      }
    }
    if (!matchedActivePath && repoPaths.length > 0) {
      matchedActivePath = repoPaths[0];
    }

    if (inNewWindow) {
      if (typeof window !== 'undefined') {
        safeLocalStorageSetItem(`omnigit_ws_paths_${targetWsId}`, JSON.stringify(repoPaths));
        if (matchedActivePath) {
          safeLocalStorageSetItem(`omnigit_last_active_project_path_${targetWsId}`, matchedActivePath);
          safeLocalStorageSetItem('omnigit_last_closed_project_path', matchedActivePath);
        }
      }
      if (window.electronAPI?.createNewWindow) {
        window.electronAPI.createNewWindow(`ws=${targetWsId}`);
        return;
      }
      const targetUrl = `${window.location.origin}${window.location.pathname}?ws=${targetWsId}`;
      window.open(targetUrl, '_blank');
      return;
    }

    const instantProjects: GitProject[] = repoPaths.map((p, idx) => {
      const repoItem = rawRepos.find((r: any) => r && normalizePath(r.path) === normalizePath(p));
      const norm = p.replace(/\\/g, '/');
      const name = repoItem?.name || norm.split('/').filter(Boolean).pop() || `Repo ${idx + 1}`;
      const normLower = normalizePath(p);
      const cached = repoSnapshotCache.get(normLower) || getLocalSnapshot(normLower);
      if (cached && !repoSnapshotCache.has(normLower)) {
        repoSnapshotCache.set(normLower, cached);
      }
      return {
        id: String(idx + 1),
        name,
        path: p,
        currentBranch: repoItem?.branch || cached?.currentBranch || 'main',
        upstream: cached?.upstream,
        incoming: cached?.incoming || 0,
        outgoing: cached?.outgoing || 0,
        uncommittedCount: cached?.files ? cached.files.length : 0,
      };
    });

    let initialActive = instantProjects[0];
    if (matchedActivePath) {
      const matched = instantProjects.find(
        (p) => normalizePath(p.path) === normalizePath(matchedActivePath!)
      );
      if (matched) initialActive = matched;
    }

    const normActiveLower = initialActive ? normalizePath(initialActive.path) : '';
    const activeCached = normActiveLower
      ? repoSnapshotCache.get(normActiveLower) || getLocalSnapshot(normActiveLower)
      : null;

    set({
      workspaceId: targetWsId,
      isWelcomeScreenOpen: false,
      isLoading: false,
      workspaceProjectPaths: repoPaths,
      projects: instantProjects,
      activeProjectId: initialActive ? initialActive.id : '',
      commitMessage: activeCached?.commitMessage || '',
      files: normalizeSnapshotFiles(activeCached?.files || []),
      branches: activeCached?.branches || [],
      commitLogs: activeCached?.commitLogs || [],
      isMerging: activeCached?.isMerging || false,
      mergeMessage: activeCached?.mergeMessage || '',
      conflictedCount: activeCached?.conflictedCount || 0,
    });

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('omnigit_open_welcome');
        safeLocalStorageSetItem(`omnigit_ws_paths_${targetWsId}`, JSON.stringify(repoPaths));
        if (matchedActivePath) {
          safeLocalStorageSetItem(`omnigit_last_active_project_path_${targetWsId}`, matchedActivePath);
          safeLocalStorageSetItem('omnigit_last_closed_project_path', matchedActivePath);
        }
        safeLocalStorageSetItem('omnigit_last_active_workspace_id', targetWsId);
        const url = new URL(window.location.href);
        url.searchParams.set('ws', targetWsId);
        url.searchParams.delete('welcome');
        window.history.replaceState(null, '', url.toString());
      } catch {}
    }

    try {
      const updatedWs = { ...ws, lastOpened: Date.now(), lastActiveProjectPath: matchedActivePath };
      get().saveWorkspaceRecord(updatedWs);

      rawRepos.forEach((r: any) => {
        if (r && r.path) {
          get().registerRecentProject(r.path, r.name, r.branch);
        }
      });
    } catch (recErr) {
      console.warn('[OmniGit] Failed to update workspace records:', recErr);
    }

    try {
      await get().setWorkspaceProjects(repoPaths);
    } catch (projErr) {
      console.error('[OmniGit] Failed to load workspace projects:', projErr);
    }

    try {
      useEditorTabsStore.getState().restorePersistedTabs(targetWsId);
    } catch {}
  },

  syncCurrentWorkspaceToSaved: (activePathOverride?: string) => {
    if (typeof window === 'undefined') return;
    const state = get();
    const currentPaths = state.workspaceProjectPaths;
    if (!currentPaths || currentPaths.length === 0) return;
    if (!state.workspaceId || state.workspaceId === 'default') return;

    const currentSaved = get().savedWorkspaces.slice();
    const existing = currentSaved.find((w: any) => w.id === state.workspaceId);

    const repos: WorkspaceRepoItem[] = currentPaths.map((p: string) => {
      const normP = normalizePath(p);
      const proj =
        state.projects.find((pr: any) => normalizePath(pr.path) === normP) ||
        state.allScannedProjects.find((pr: any) => normalizePath(pr.path) === normP);
      const norm = p.replace(/\\/g, '/');
      const name = proj?.name || norm.split('/').filter(Boolean).pop() || 'repo';
      return {
        name,
        path: p,
        branch: proj?.currentBranch || 'main',
      };
    });

    const activeProject = state.projects.find((p: any) => p.id === state.activeProjectId);
    const activePath = activePathOverride || activeProject?.path || existing?.lastActiveProjectPath;

    const wsRecord = buildWorkspaceRecord(
      state.workspaceId,
      currentPaths,
      existing,
      repos,
      get().language,
      activePath
    );
    get().saveWorkspaceRecord(wsRecord);
  },

  reorderProjects: (sourceIndex: number, targetIndex: number) => {
    const currentProjects = [...get().projects];
    if (
      sourceIndex < 0 ||
      sourceIndex >= currentProjects.length ||
      targetIndex < 0 ||
      targetIndex >= currentProjects.length ||
      sourceIndex === targetIndex
    ) {
      return;
    }

    const [movedProject] = currentProjects.splice(sourceIndex, 1);
    currentProjects.splice(targetIndex, 0, movedProject);

    const newPaths = currentProjects.map((p) => p.path);
    set({
      projects: currentProjects,
      workspaceProjectPaths: newPaths,
    });

    const wsId = get().workspaceId;
    if (wsId && typeof window !== 'undefined') {
      safeLocalStorageSetItem(`omnigit_ws_paths_${wsId}`, JSON.stringify(newPaths));
    }
    get().syncCurrentWorkspaceToSaved();
  },

  getWorkspaceOpenFolder: () => {
    const state = get();
    const projects = state.projects;
    if (!projects || projects.length === 0) return undefined;

    const currentWs = state.savedWorkspaces.find((w: any) => w.id === state.workspaceId);
    if (currentWs?.rootPath) {
      const normRoot = currentWs.rootPath.toLowerCase().replace(/\\/g, '/');
      const allUnderRoot = projects.every((p: any) =>
        p.path.toLowerCase().replace(/\\/g, '/').startsWith(normRoot)
      );
      if (allUnderRoot) {
        return currentWs.rootPath;
      }
    }

    const parentDirs = projects.map((p: any) => {
      const norm = p.path.replace(/\\/g, '/');
      const idx = norm.lastIndexOf('/');
      return idx > 0 ? norm.substring(0, idx) : norm;
    });
    const allSameParent = parentDirs.every((d: string) => d.toLowerCase() === parentDirs[0].toLowerCase());
    if (allSameParent) {
      const firstPath = projects[0].path;
      const isWin = firstPath.includes('\\');
      const sep = isWin ? '\\' : '/';
      const lastIdx = firstPath.lastIndexOf(sep);
      return lastIdx > 0 ? firstPath.substring(0, lastIdx) : firstPath;
    }

    return projects[0].path;
  },

  createWorkspaceFromFolder: async (folderPath: string) => {
    try {
      const res = await fetch(`/api/git/scan-projects?baseDir=${encodeURIComponent(folderPath)}`);
      if (!res.ok) return null;
      const found: Array<{ name: string; path: string; currentBranch?: string }> = await res.json();
      if (!found || found.length === 0) {
        const statusRes = await fetch(`/api/git/status?path=${encodeURIComponent(folderPath)}`);
        if (statusRes.ok) {
          const st = await statusRes.json();
          const norm = folderPath.replace(/\\/g, '/');
          const folderName = st.repoName || norm.split('/').filter(Boolean).pop() || 'Repo';
          const singleWs: WorkspaceGroupItem = {
            id: `ws_${Date.now()}`,
            name: folderName,
            rootPath: folderPath,
            repos: [{ name: folderName, path: folderPath, branch: st.currentBranch || 'main' }],
            lastOpened: Date.now(),
          };
          get().saveWorkspaceRecord(singleWs);
          return singleWs;
        }
        return null;
      }

      const norm = folderPath.replace(/\\/g, '/');
      const folderName = norm.split('/').filter(Boolean).pop() || 'workspace';
      const newWs: WorkspaceGroupItem = {
        id: `ws_${Date.now()}`,
        name: folderName,
        rootPath: folderPath,
        repos: found.map((f) => ({
          name: f.name,
          path: f.path,
          branch: f.currentBranch || 'main',
        })),
        lastOpened: Date.now(),
      };
      get().saveWorkspaceRecord(newWs);
      return newWs;
    } catch {
      return null;
    }
  },

  globalRecentProjects: [],

  loadRecentProjects: () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('omnigit_global_recent_projects');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const sanitized = parsed.filter(
            (p: any) => p && typeof p.path === 'string' && p.path.trim().length > 0
          );
          set({ globalRecentProjects: sanitized });
          return;
        }
      }
    } catch {}
    set({ globalRecentProjects: [] });
  },

  registerRecentProject: (projectPath: string, name?: string, branch?: string) => {
    if (typeof window === 'undefined' || !projectPath || typeof projectPath !== 'string') return;
    const norm = projectPath.replace(/\\/g, '/');
    const repoName = name || norm.split('/').filter(Boolean).pop() || 'repo';
    const currentList = (Array.isArray(get().globalRecentProjects) ? get().globalRecentProjects : [])
      .filter((p: any) => p && typeof p.path === 'string' && p.path.trim().length > 0);
    const existingIndex = currentList.findIndex(
      (p: any) => p.path.toLowerCase() === projectPath.toLowerCase()
    );
    const badgeColors = [
      'bg-amber-600/90 text-white',
      'bg-blue-600/90 text-white',
      'bg-emerald-600/90 text-white',
      'bg-purple-600/90 text-white',
      'bg-rose-600/90 text-white',
      'bg-indigo-600/90 text-white',
      'bg-teal-600/90 text-white',
      'bg-cyan-600/90 text-white',
    ];
    let hash = 0;
    for (let i = 0; i < repoName.length; i++) {
      hash = (hash * 31 + repoName.charCodeAt(i)) >>> 0;
    }
    const colorClass = badgeColors[hash % badgeColors.length];

    const item: RecentProjectItem = {
      name: repoName,
      path: projectPath,
      branch: branch || (existingIndex >= 0 ? currentList[existingIndex].branch : undefined),
      lastOpened: Date.now(),
      badgeColor: colorClass,
    };

    if (existingIndex >= 0) {
      currentList.splice(existingIndex, 1);
    }
    currentList.unshift(item);
    const truncated = currentList.slice(0, 50);
    safeLocalStorageSetItem('omnigit_global_recent_projects', JSON.stringify(truncated));
    set({ globalRecentProjects: truncated });
    broadcastWorkspaceChanged();
    scheduleWorkspacesDiskBackup();
  },

  removeRecentProject: (projectPath: string) => {
    if (typeof window === 'undefined' || !projectPath) return;
    const currentList = Array.isArray(get().globalRecentProjects) ? get().globalRecentProjects : [];
    const updated = currentList.filter(
      (p: any) => p && typeof p.path === 'string' && p.path.toLowerCase() !== projectPath.toLowerCase()
    );
    safeLocalStorageSetItem('omnigit_global_recent_projects', JSON.stringify(updated));
    set({ globalRecentProjects: updated });
    broadcastWorkspaceChanged();
    scheduleWorkspacesDiskBackup();
  },

  openProjectInWorkspace: async (projectPath: string, inNewWindow = false) => {
    if (!projectPath || typeof projectPath !== 'string') return;
    get().registerRecentProject(projectPath);

    const targetWsId =
      get().workspaceId && get().workspaceId !== 'default'
        ? get().workspaceId
        : `ws_${Date.now()}`;

    if (inNewWindow) {
      const newWsId = `ws_${Date.now()}`;
      if (typeof window !== 'undefined') {
        safeLocalStorageSetItem(`omnigit_ws_paths_${newWsId}`, JSON.stringify([projectPath]));
        safeLocalStorageSetItem(`omnigit_last_active_project_path_${newWsId}`, projectPath);
        safeLocalStorageSetItem('omnigit_last_closed_project_path', projectPath);
      }
      if (window.electronAPI?.createNewWindow) {
        window.electronAPI.createNewWindow(newWsId);
        return;
      }
      const targetUrl = `${window.location.origin}${window.location.pathname}?ws=${newWsId}`;
      window.open(targetUrl, '_blank');
      return;
    }

    const norm = projectPath.replace(/\\/g, '/');
    const name = norm.split('/').filter(Boolean).pop() || 'repo';
    const normLower = normalizePath(projectPath);
    const cached = repoSnapshotCache.get(normLower) || getLocalSnapshot(normLower);
    const instantProj: GitProject = {
      id: '1',
      name,
      path: projectPath,
      currentBranch: cached?.currentBranch || 'main',
      upstream: cached?.upstream,
      incoming: cached?.incoming || 0,
      outgoing: cached?.outgoing || 0,
      uncommittedCount: cached?.files ? cached.files.length : 0,
    };
    set({
      workspaceId: targetWsId,
      isWelcomeScreenOpen: false,
      isLoading: false,
      workspaceProjectPaths: [projectPath],
      projects: [instantProj],
      activeProjectId: instantProj.id,
      commitMessage: cached?.commitMessage || '',
      files: normalizeSnapshotFiles(cached?.files || []),
      branches: cached?.branches || [],
      commitLogs: cached?.commitLogs || [],
      isMerging: cached?.isMerging || false,
      mergeMessage: cached?.mergeMessage || '',
      conflictedCount: cached?.conflictedCount || 0,
    });

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('omnigit_open_welcome');
        safeLocalStorageSetItem(`omnigit_ws_paths_${targetWsId}`, JSON.stringify([projectPath]));
        safeLocalStorageSetItem(`omnigit_last_active_project_path_${targetWsId}`, projectPath);
        safeLocalStorageSetItem('omnigit_last_closed_project_path', projectPath);
        safeLocalStorageSetItem('omnigit_last_active_workspace_id', targetWsId);
        const url = new URL(window.location.href);
        url.searchParams.set('ws', targetWsId);
        url.searchParams.delete('welcome');
        window.history.replaceState(null, '', url.toString());
      } catch {}
    }

    try {
      const singleWs: WorkspaceGroupItem = {
        id: targetWsId,
        name,
        rootPath: projectPath,
        repos: [{ name, path: projectPath, branch: cached?.currentBranch || 'main' }],
        lastOpened: Date.now(),
        lastActiveProjectPath: projectPath,
      };
      get().saveWorkspaceRecord(singleWs);
    } catch {}

    try {
      await get().setWorkspaceProjects([projectPath]);
    } catch (err) {
      console.error('[OmniGit] Failed to load project in workspace:', err);
    }
  },

  createNewWindow: () => {
    const newWsId = `ws_${Date.now()}`;
    const behavior = get().newWindowBehavior;
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem(`omnigit_ws_paths_${newWsId}`, JSON.stringify([]));
      localStorage.removeItem(`omnigit_last_active_project_path_${newWsId}`);
      if (behavior === 'welcome') {
        safeLocalStorageSetItem(`omnigit_open_welcome_${newWsId}`, 'true');
      }
    }
    const queryParam = behavior === 'welcome' ? `ws=${newWsId}&welcome=true` : `ws=${newWsId}`;
    if (window.electronAPI?.createNewWindow) {
      window.electronAPI.createNewWindow(queryParam);
      return;
    }
    const targetUrl = `${window.location.origin}${window.location.pathname}?${queryParam}`;
    window.open(targetUrl, '_blank');
  },
});
