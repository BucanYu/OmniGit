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

export const createWorkspaceSlice = (set: any, get: any) => ({
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

  startupBehavior: (typeof window !== 'undefined' && (localStorage.getItem('omnigit_startup_behavior') as any)) || 'reopen_last',

  setStartupBehavior: (behavior: 'reopen_last' | 'welcome_screen') => {
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_startup_behavior', behavior);
    }
    set({ startupBehavior: behavior });
  },

  newWindowBehavior: (typeof window !== 'undefined' && (localStorage.getItem('omnigit_new_window_behavior') as any)) || 'empty',

  setNewWindowBehavior: (behavior: 'empty' | 'welcome') => {
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_new_window_behavior', behavior);
    }
    set({ newWindowBehavior: behavior });
  },

  savedWorkspaces: [],

  loadSavedWorkspaces: () => {
    if (typeof window === 'undefined') return;
    // Clean up any bogus 'default' storage keys immediately
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

    // Resilient discovery: scan localStorage for any omnigit_ws_paths_* keys!
    // Ensures any workspace created or updated in ANY window is 100% discovered and presented.
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
              (w) => w.id === wsId || w.id === `ws_${wsId}` || (wsId.startsWith('ws_') && w.id === wsId.replace('ws_', ''))
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
              const lastActive = typeof window !== 'undefined'
                ? localStorage.getItem(`omnigit_last_active_project_path_${wsId}`)
                : undefined;
              const newWs = buildWorkspaceRecord(wsId, paths, undefined, undefined, get().language, lastActive || undefined);
              list.push(newWs);
            }
          }
        }
      }
    } catch {}

    // Fallback: If still no saved workspaces, auto-aggregate from globalRecentProjects!
    if (list.length === 0) {
      const recent = get().globalRecentProjects;
      if (recent && recent.length > 0) {
        list = aggregateReposIntoWorkspaces(recent);
      }
    }

    // Collect all repo paths belonging to multi-repo workspaces
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

    // Auto-clean any duplicate single-repo workspace created by the cold-start bug whose single repo is already part of a multi-repo workspace
    list = list.filter((ws) => {
      if (!ws || !ws.id || ws.id === 'default') return false;
      if (ws.repos && ws.repos.length === 1) {
        const singlePath = normalizePath(ws.repos[0].path || '');
        if (multiRepoPaths.has(singlePath) && (ws.id.startsWith('ws_default') || ws.id === 'default' || ws.name === ws.repos[0].name)) {
          try {
            localStorage.removeItem(`omnigit_ws_paths_${ws.id}`);
            localStorage.removeItem(`omnigit_last_active_project_path_${ws.id}`);
          } catch {}
          return false;
        }
      }
      return true;
    });

    // Deduplicate strictly by ws.id
    const seenIds = new Set<string>();
    const deduplicated: WorkspaceGroupItem[] = [];
    for (const ws of list) {
      if (!ws || !ws.id || ws.id === 'default' || seenIds.has(ws.id)) continue;
      seenIds.add(ws.id);
      deduplicated.push(ws);
    }

    // Sort by lastOpened descending
    deduplicated.sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0));

    if (deduplicated.length > 0) {
      safeLocalStorageSetItem('omnigit_saved_workspaces', JSON.stringify(deduplicated));
      set({ savedWorkspaces: deduplicated });
      scheduleWorkspacesDiskBackup();
    } else {
      // Automatic L3 Disk Backup Restoration!
      fetch('/api/git/workspaces/backup')
        .then((res) => res.json())
        .then((backup) => {
          if (backup && Array.isArray(backup.savedWorkspaces) && backup.savedWorkspaces.length > 0) {
            const sanitizedBackup = backup.savedWorkspaces.filter(
              (w: any) => w && w.id && w.id !== 'default'
            );
            if (sanitizedBackup.length > 0) {
              console.log('[OmniGit] Auto-restoring workspaces from L3 disk backup...');
              safeLocalStorageSetItem('omnigit_saved_workspaces', JSON.stringify(sanitizedBackup));
              if (backup.workspaceProjectPaths) {
                Object.entries(backup.workspaceProjectPaths).forEach(([wsId, paths]) => {
                  if (wsId && wsId !== 'default') {
                    safeLocalStorageSetItem(`omnigit_ws_paths_${wsId}`, JSON.stringify(paths));
                  }
                });
              }
              if (Array.isArray(backup.recentProjects) && backup.recentProjects.length > 0) {
                safeLocalStorageSetItem('omnigit_global_recent_projects', JSON.stringify(backup.recentProjects));
                set({ globalRecentProjects: backup.recentProjects });
              }
              set({ savedWorkspaces: sanitizedBackup });
              broadcastWorkspaceChanged();
              return;
            }
          }
          safeLocalStorageSetItem('omnigit_saved_workspaces', JSON.stringify([]));
          set({ savedWorkspaces: [] });
        })
        .catch(() => {
          set({ savedWorkspaces: [] });
        });
    }
  },

  saveWorkspaceRecord: (ws: WorkspaceGroupItem) => {
    if (typeof window === 'undefined' || !ws || !ws.id || ws.id === 'default') return;
    const current = (Array.isArray(get().savedWorkspaces) ? get().savedWorkspaces : []).filter(
      (w) => w && w.id && w.id !== 'default'
    );
    const idx = current.findIndex((w) => w.id === ws.id);
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
    const updated = get().savedWorkspaces.filter((w) => w.id !== id);
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
    const target = current.find((w) => w.id === id);
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
    const rawRepos = Array.isArray(ws.repos) ? ws.repos : [];
    let repoPaths = rawRepos
      .map((r: any) => (typeof r === 'string' ? r : r?.path))
      .filter((p: any): p is string => typeof p === 'string' && p.trim().length > 0);

    if (repoPaths.length === 0 && ws.rootPath) {
      repoPaths = [ws.rootPath];
    }

    const candidatePaths = typeof window !== 'undefined'
      ? [
          localStorage.getItem(`omnigit_last_active_project_path_${targetWsId}`),
          ws.lastActiveProjectPath,
          localStorage.getItem('omnigit_last_active_project_path'),
        ].filter(Boolean) as string[]
      : (ws.lastActiveProjectPath ? [ws.lastActiveProjectPath] : []);

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

    // Open in current workspace:
    // 1. Build instant projects for 0ms UI mount
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
      const matched = instantProjects.find((p) => normalizePath(p.path) === normalizePath(matchedActivePath));
      if (matched) initialActive = matched;
    }

    const normActiveLower = initialActive ? normalizePath(initialActive.path) : '';
    const activeCached = normActiveLower ? (repoSnapshotCache.get(normActiveLower) || getLocalSnapshot(normActiveLower)) : null;

    // 2. IMMEDIATE STATE SWITCH: Close Welcome screen & mount workbench with 0ms perceived lag!
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

    // 3. Persist state and history
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

    // 4. Update workspace record and recent entries safely
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

    // 5. Asynchronously refresh full project status
    try {
      await get().setWorkspaceProjects(repoPaths);
    } catch (projErr) {
      console.error('[OmniGit] Failed to load workspace projects:', projErr);
    }
  },

  syncCurrentWorkspaceToSaved: (activePathOverride?: string) => {
    if (typeof window === 'undefined') return;
    const state = get();
    const currentPaths = state.workspaceProjectPaths;
    if (!currentPaths || currentPaths.length === 0) return;
    if (!state.workspaceId || state.workspaceId === 'default') return;

    const currentSaved = get().savedWorkspaces.slice();
    const existing = currentSaved.find((w) => w.id === state.workspaceId);

    const repos: WorkspaceRepoItem[] = currentPaths.map((p) => {
      const normP = normalizePath(p);
      const proj =
        state.projects.find((pr) => normalizePath(pr.path) === normP) ||
        state.allScannedProjects.find((pr) => normalizePath(pr.path) === normP);
      const norm = p.replace(/\\/g, '/');
      const name = proj?.name || norm.split('/').filter(Boolean).pop() || 'repo';
      return {
        name,
        path: p,
        branch: proj?.currentBranch || 'main',
      };
    });

    const activeProject = state.projects.find((p) => p.id === state.activeProjectId);
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

    // Persist to active workspace record and localStorage
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

    // 1. Check if current workspace has a valid rootPath that covers all projects
    const currentWs = state.savedWorkspaces.find((w) => w.id === state.workspaceId);
    if (currentWs?.rootPath) {
      const normRoot = currentWs.rootPath.toLowerCase().replace(/\\/g, '/');
      const allUnderRoot = projects.every((p) =>
        p.path.toLowerCase().replace(/\\/g, '/').startsWith(normRoot)
      );
      if (allUnderRoot) {
        return currentWs.rootPath;
      }
    }

    // 2. If no valid common rootPath, check if all projects share a common parent folder
    const parentDirs = projects.map((p) => {
      const norm = p.path.replace(/\\/g, '/');
      const idx = norm.lastIndexOf('/');
      return idx > 0 ? norm.substring(0, idx) : norm;
    });
    const allSameParent = parentDirs.every((d) => d.toLowerCase() === parentDirs[0].toLowerCase());
    if (allSameParent) {
      const firstPath = projects[0].path;
      const isWin = firstPath.includes('\\');
      const sep = isWin ? '\\' : '/';
      const lastIdx = firstPath.lastIndexOf(sep);
      return lastIdx > 0 ? firstPath.substring(0, lastIdx) : firstPath;
    }

    // 3. Fallback: if projects are from different parent directories, default to the first project's folder
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

    const targetWsId = get().workspaceId && get().workspaceId !== 'default'
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

    // Open in current workspace:
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

    // Register / update workspace record
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
    get().loadSavedWorkspaces();

    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const isExplicitWs = urlParams.has('ws');
    const startupBehavior = get().startupBehavior;
    const isWelcomeRequested =
      urlParams.get('welcome') === 'true' ||
      (typeof window !== 'undefined' && localStorage.getItem('omnigit_open_welcome') === 'true');

    if (typeof window !== 'undefined') {
      localStorage.removeItem('omnigit_open_welcome');
    }

    // 0. If explicit request to show welcome screen OR (cold start without explicit ws and user configured "Show Welcome Screen on startup"):
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

    // Resolve active workspace:
    let activeWsId = isExplicitWs ? (urlParams.get('ws') || 'default') : 'default';
    const savedList = get().savedWorkspaces.filter((w) => w && w.id && w.id !== 'default');
    let targetWs: WorkspaceGroupItem | undefined;

    if (!isExplicitWs) {
      // Cold start: Reopen last active workspace
      const lastWsId = typeof window !== 'undefined' ? localStorage.getItem('omnigit_last_active_workspace_id') : null;
      if (lastWsId && lastWsId !== 'default') {
        targetWs = savedList.find((w) => w.id === lastWsId);
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
        // No saved workspaces exist at all: Show Welcome Screen
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
      targetWs = savedList.find((w) => w.id === activeWsId);
    }

    set({ workspaceId: activeWsId });

    // Setup cross-window synchronization listeners (once per window)
    if (typeof window !== 'undefined' && !(window as any).__omnigit_cross_window_listener_set) {
      (window as any).__omnigit_cross_window_listener_set = true;
      const reloadData = () => {
        get().loadSavedWorkspaces();
        get().loadRecentProjects();
      };
      if (window.electronAPI?.onWorkspaceChanged) {
        window.electronAPI.onWorkspaceChanged(reloadData);
      }
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const ch = new BroadcastChannel('omnigit_workspace_channel');
          ch.onmessage = reloadData;
        } catch {}
      }
      window.addEventListener('storage', (e) => {
        if (
          !e.key ||
          e.key === 'omnigit_saved_workspaces' ||
          e.key === 'omnigit_global_recent_projects' ||
          e.key.startsWith('omnigit_ws_paths_')
        ) {
          reloadData();
        }
      });
      window.addEventListener('focus', reloadData);
      window.addEventListener('omnigit:workspace-changed', reloadData);
    }

    // 1. Instant local hydration from localStorage (0ms perceived response)
    const storageKey = `omnigit_ws_paths_${activeWsId}`;
    const savedPathsJson = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
    let selectedPaths: string[] = [];

    if (savedPathsJson) {
      try {
        selectedPaths = JSON.parse(savedPathsJson);
      } catch {}
    }

    // If selectedPaths is empty in localStorage but targetWs exists, restore from targetWs.repos
    if ((!selectedPaths || selectedPaths.length === 0) && targetWs && targetWs.repos && targetWs.repos.length > 0) {
      selectedPaths = targetWs.repos.map((r) => r.path);
      if (typeof window !== 'undefined') {
        safeLocalStorageSetItem(storageKey, JSON.stringify(selectedPaths));
      }
    }

    // Fast path: If workspace paths exist, render sidebar & active project IMMEDIATELY!
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
          const matched = instantProjects.find(
            (p) => normalizePath(p.path) === normalizePath(cand)
          );
          if (matched) {
            activeProject = matched;
            break;
          }
        }
      } else if (targetWs?.lastActiveProjectPath) {
        const matched = instantProjects.find(
          (p) => normalizePath(p.path) === normalizePath(targetWs.lastActiveProjectPath!)
        );
        if (matched) {
          activeProject = matched;
        }
      }

      if (typeof window !== 'undefined') {
        safeLocalStorageSetItem('omnigit_last_active_project_path', activeProject.path);
        safeLocalStorageSetItem(`omnigit_last_active_project_path_${activeWsId}`, activeProject.path);
        safeLocalStorageSetItem('omnigit_last_closed_project_path', activeProject.path);
      }

      const normActiveLower = normalizePath(activeProject.path);
      const activeCached = repoSnapshotCache.get(normActiveLower) || getLocalSnapshot(normActiveLower);
      if (activeCached && !repoSnapshotCache.has(normActiveLower)) {
        repoSnapshotCache.set(normActiveLower, activeCached);
      }

      const initialDraft = typeof window !== 'undefined'
        ? localStorage.getItem(`omnigit_commit_draft_${activeWsId}_${activeProject.path}`) || localStorage.getItem(`omnigit_commit_draft_${activeProject.path}`) || ''
        : '';

      // Register all instant projects into global recent list
      instantProjects.forEach((p) => {
        get().registerRecentProject(p.path, p.name, p.currentBranch !== '...' ? p.currentBranch : undefined);
      });

      // 0ms instant UI mount: Sidebar, projects, branch, files & logs appear with ZERO waiting!
      if (activeCached) {
        set({
          workspaceProjectPaths: selectedPaths,
          projects: instantProjects,
          activeProjectId: activeProject.id,
          commitMessage: initialDraft || activeCached.commitMessage || '',
          files: normalizeSnapshotFiles(activeCached.files || []).filter((f) => f.status !== 'conflict'),
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

      // Concurrently load active repo data, workspace sync, git user, and pull backend disk snapshots
      Promise.all([
        get().loadRepoData(activeProject.path),
        get().pollWorkspaceSyncStatus(),
        get().loadRepoAuthors(activeProject.path),
        get().loadWorkspaceAccounts(),
        fetch(`/api/git/user?path=${encodeURIComponent(activeProject.path)}`)
          .then((res) => res.json())
          .then((user) => set({ gitUser: user }))
          .catch(() => {}),
        fetch('/api/git/cache/snapshots')
          .then((res) => res.json())
          .then((diskSnapshots) => {
            if (diskSnapshots && typeof diskSnapshots === 'object') {
              Object.entries(diskSnapshots).forEach(([normP, snap]: [string, any]) => {
                // Populate L1 In-Memory Cache (0ms) without polluting L2 localStorage!
                if (!repoSnapshotCache.has(normP)) {
                  repoSnapshotCache.set(normP, snap);
                }
              });
            }
          })
          .catch(() => {}),
      ]);

      // Lazily populate allScannedProjects in the background for AddRepoModal
      fetch('/api/git/scan-projects')
        .then((res) => res.json())
        .then((allProjects) => set({ allScannedProjects: allProjects || [] }))
        .catch(() => {});

      // Setup background polling for workspace sync status
      if (typeof window !== 'undefined' && !(window as any).__omnigit_sync_interval_set) {
        (window as any).__omnigit_sync_interval_set = true;
        window.addEventListener('focus', () => {
          const now = Date.now();
          if (now - lastFocusSyncTime > 30000) {
            lastFocusSyncTime = now;
            get().pollWorkspaceSyncStatus();
            const curr = get().projects.find((p) => p.id === get().activeProjectId);
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

    // 2. Clean empty workspace path (e.g. New Window, or freshly initialized workspace):
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

    // Lazily fetch user & scanned projects in background
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

    // Ensure all paths exist in allScannedProjects
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

    const savedActivePath = typeof window !== 'undefined'
      ? localStorage.getItem('omnigit_last_active_project_path')
      : null;
    if ((!state.activeProjectId || !resolvedProjects.some((p) => p.id === state.activeProjectId)) && resolvedProjects.length > 0) {
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
        return { success: false, message: data.message || (get().language === 'zh-CN' ? '克隆仓库失败' : 'Failed to clone repository') };
      }

      const repoPath = data.repoPath || fullTargetDir;
      // 1. Add repo into workspace
      await get().addProjectsToWorkspace([repoPath]);

      // 2. Switch active project to newly cloned repo
      const createdProject = get().projects.find(
        (p) => normalizePath(p.path) === normalizePath(repoPath)
      );
      if (createdProject) {
        get().setActiveProject(createdProject.id);
        await get().loadRepoData(createdProject.path);
      }

      const t = getLocale(get().language);
      get().setNotification({
        id: Date.now(),
        title: t.notifications.cloneSuccess,
        detail: t.notifications.cloneSuccessDetail(data.repoName || params.folderName || repoPath),
        type: 'success',
      });

      return { success: true, message: data.message, repoPath };
    } catch (e: any) {
      return { success: false, message: e.message || getLocale(get().language).notifications.networkError };
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
      const currentWs = get().savedWorkspaces.find((w) => w.id === state.workspaceId);
      const candidatePaths = typeof window !== 'undefined'
        ? [
            localStorage.getItem(`omnigit_last_active_project_path_${state.workspaceId}`),
            currentWs?.lastActiveProjectPath,
            localStorage.getItem('omnigit_last_active_project_path'),
          ].filter(Boolean) as string[]
        : (currentWs?.lastActiveProjectPath ? [currentWs.lastActiveProjectPath] : []);

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
    const filteredPaths = state.workspaceProjectPaths.filter((p) => normalizePath(p) !== normTarget);

    safeLocalStorageSetItem(storageKey, JSON.stringify(filteredPaths));

    const remainingProjects = state.projects.filter((p) => normalizePath(p.path) !== normTarget);
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

  setActiveProject: async (id: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    const targetProject = get().projects.find((p) => p.id === id || normalizePath(p.path) === normalizePath(id));
    if (!targetProject) return;

    if (currentProject && currentProject.id === id && !get().isRepoLoading) {
      return;
    }

    // 1. Save current project's local draft if any and sync snapshot
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

    // 2. Retrieve the target project's own local draft and persist last active project
    let targetDraft = '';
    if (typeof window !== 'undefined') {
      targetDraft = localStorage.getItem(`omnigit_commit_draft_${get().workspaceId}_${targetProject.path}`) || localStorage.getItem(`omnigit_commit_draft_${targetProject.path}`) || '';
      safeLocalStorageSetItem('omnigit_last_active_project_path', targetProject.path);
      safeLocalStorageSetItem(`omnigit_last_active_project_path_${get().workspaceId}`, targetProject.path);
      safeLocalStorageSetItem('omnigit_last_closed_project_path', targetProject.path);
      safeLocalStorageSetItem('omnigit_last_active_workspace_id', get().workspaceId);
    }
    get().registerRecentProject(targetProject.path, targetProject.name, targetProject.currentBranch);
    get().syncCurrentWorkspaceToSaved(targetProject.path);

    // Invalidate any in-flight requests from the previous project!
    currentRepoLoadId++;

    const normTargetPath = normalizePath(targetProject.path);
    let cached = repoSnapshotCache.get(normTargetPath) || getLocalSnapshot(normTargetPath);
    if (!cached) {
      // 3~5ms Fast Read-Through from L3 Disk Directory!
      cached = await loadDiskSnapshot(targetProject.path);
    }
    if (cached && !repoSnapshotCache.has(normTargetPath)) {
      repoSnapshotCache.set(normTargetPath, cached);
    }

    if (cached) {
      // 0ms INSTANT HYDRATION FROM CACHE (Zero waiting!)
      set({
        activeProjectId: id,
        isRepoLoading: false,
        files: normalizeSnapshotFiles(Array.isArray(cached.files) ? cached.files : []).filter((f) => f.status !== 'conflict'),
        branches: Array.isArray(cached.branches) ? cached.branches : [],
        selectedFilePath: cached.selectedFilePath,
        selectedFileDiff: { oldContent: '', newContent: '' }, // Loaded on demand below
        commitMessage: targetDraft || cached.commitMessage || '',
        commitHistory: Array.isArray(cached.commitHistory) ? cached.commitHistory : [],
        isAmend: false,
        lastCommitDetails: cached.lastCommitDetails || null,
        selectedCommitHash: null,
        selectedCommitDetails: null,
        selectedHistoricalFilePath: null,
        historicalDiff: null,
        commitLogs: Array.isArray(cached.commitLogs) ? cached.commitLogs : [],
        commitLogsSkip: Array.isArray(cached.commitLogs) ? cached.commitLogs.length : 0,
        isMerging: false,
        mergeMessage: '',
        mergeSourceBranch: undefined,
        conflictedCount: 0,
      });

      get().syncCurrentWorkspaceToSaved(targetProject.path);

      if (typeof document !== 'undefined') {
        document.title = `OmniGit - ${targetProject.name}`;
      }

      // If user had a selected file in this project, load its single diff on demand
      if (cached.selectedFilePath && Array.isArray(cached.files) && cached.files.some((f) => f.path === cached.selectedFilePath)) {
        get().setSelectedFile(cached.selectedFilePath);
      }

      // Background Promotion: If L2 only had a lightweight skeleton (<= 10 commits), promote full depth from L3
      if (!cached.commitLogs || cached.commitLogs.length <= 10) {
        loadDiskSnapshot(targetProject.path).then((diskSnap) => {
          if (diskSnap && Array.isArray(diskSnap.commitLogs) && diskSnap.commitLogs.length > (cached?.commitLogs?.length || 0)) {
            if (get().activeProjectId === id) {
              set({ commitLogs: diskSnap.commitLogs, commitLogsSkip: diskSnap.commitLogs.length });
            }
          }
        });
      }

      // 15s TTL: only revalidate in background if cache is >= 15 seconds old!
      if (Date.now() - (cached.lastUpdated || 0) >= 15000) {
        get().loadRepoData(targetProject.path, false);
      }
      get().loadRepoAuthors(targetProject.path);
      get().loadRecentCommitMessages(targetProject.path);
      get().loadLastCommit(targetProject.path);
      fetch(`/api/git/user?path=${encodeURIComponent(targetProject.path)}`)
        .then((res) => res.json())
        .then((user) => {
          if (user && user.name) {
            set({ gitUser: user });
            get().loadWorkspaceAccounts();
          }
        })
        .catch(() => {});
      get().loadWorkspaceAccounts();
      if (get().activeTab === 'log') {
        get().fetchCommitLogs(true);
      }
    } else {
      // Cold start: First time opening this project (no cache yet): clean loading
      set({
        activeProjectId: id,
        isRepoLoading: true,
        files: [],
        selectedFilePath: null,
        selectedFileDiff: { oldContent: '', newContent: '' },
        commitMessage: targetDraft,
        commitHistory: [],
        isAmend: false,
        lastCommitDetails: null,
        selectedCommitHash: null,
        selectedCommitDetails: null,
        selectedHistoricalFilePath: null,
        historicalDiff: null,
        commitLogs: [],
        commitLogsSkip: 0,
        isMerging: false,
        mergeMessage: '',
        mergeSourceBranch: undefined,
        conflictedCount: 0,
      });

      get().syncCurrentWorkspaceToSaved(targetProject.path);

      if (typeof document !== 'undefined') {
        document.title = `OmniGit - ${targetProject.name}`;
      }

      try {
        await get().loadRepoData(targetProject.path, true);
        get().loadRecentCommitMessages(targetProject.path);
        get().loadLastCommit(targetProject.path);
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
  }
});
