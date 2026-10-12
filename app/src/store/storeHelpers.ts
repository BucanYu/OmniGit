import type { AppLanguage, AppTheme, GitFileItem, LightRepoCache, WorkspaceGroupItem, WorkspaceRepoItem, OutgoingCommitsData } from './types';

export function normalizePath(p: string): string {
  if (!p) return '';
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

// Get workspace identifier from URL, e.g. ?ws=default or ?ws=ws_123, with localStorage fallback for cold start
function getWorkspaceIdFromUrl(): string {
  if (typeof window === 'undefined') return 'default';
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('ws');
  if (fromUrl) return fromUrl;
  const lastWsId = localStorage.getItem('omnigit_last_active_workspace_id');
  if (lastWsId && lastWsId !== 'default') return lastWsId;
  return 'default';
}

// Helper to aggregate repos by their common parent folder into WorkspaceGroupItem
export function aggregateReposIntoWorkspaces(
  repos: Array<{ name: string; path: string; branch?: string; lastOpened?: number }>
): WorkspaceGroupItem[] {
  if (!repos || repos.length === 0) return [];

  const badgeColors = [
    'bg-sky-600/90 text-white',
    'bg-emerald-600/90 text-white',
    'bg-purple-600/90 text-white',
    'bg-amber-600/90 text-white',
    'bg-rose-600/90 text-white',
    'bg-indigo-600/90 text-white',
    'bg-teal-600/90 text-white',
  ];

  // Group repos by parent directory
  const parentMap = new Map<string, Array<{ name: string; path: string; branch?: string; lastOpened?: number }>>();
  for (const r of repos) {
    if (!r.path) continue;
    const norm = r.path.replace(/\\/g, '/').replace(/\/+$/, '');
    const parts = norm.split('/');
    const parent = parts.slice(0, -1).join('/');
    if (!parentMap.has(parent)) {
      parentMap.set(parent, []);
    }
    parentMap.get(parent)!.push(r);
  }

  const result: WorkspaceGroupItem[] = [];
  let colorIdx = 0;

  for (const [parent, repoList] of parentMap.entries()) {
    const parentParts = parent.split('/');
    const folderName = parentParts[parentParts.length - 1] || 'Workspace';
    const isGenericRoot = /^[a-zA-Z]:(\/(projects|workspace|code|src|repo|github))?$/i.test(parent);

    if (isGenericRoot && repoList.length > 1) {
      for (const r of repoList) {
        result.push({
          id: `ws_${encodeURIComponent(r.name).toLowerCase()}`,
          name: r.name,
          rootPath: r.path,
          repos: [{ name: r.name, path: r.path, branch: r.branch }],
          lastOpened: r.lastOpened || Date.now(),
          badgeColor: badgeColors[colorIdx++ % badgeColors.length],
        });
      }
    } else {
      const maxTime = Math.max(...repoList.map((r) => r.lastOpened || 0), Date.now());
      result.push({
        id: `ws_${encodeURIComponent(folderName).toLowerCase()}`,
        name: folderName,
        rootPath: parent.replace(/\//g, '\\'),
        repos: repoList.map((r) => ({
          name: r.name,
          path: r.path,
          branch: r.branch,
        })),
        lastOpened: maxTime,
        badgeColor: badgeColors[colorIdx++ % badgeColors.length],
      });
    }
  }

  return result;
}

// Broadcast workspace change across all open windows & tabs
export function broadcastWorkspaceChanged() {
  if (typeof window === 'undefined') return;
  // 1. Electron IPC broadcast
  if (window.electronAPI?.notifyWorkspaceChanged) {
    window.electronAPI.notifyWorkspaceChanged().catch(() => {});
  }
  // 2. Web BroadcastChannel (cross-window/tab communication)
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel('omnigit_workspace_channel');
      channel.postMessage({ type: 'workspace_changed', time: Date.now() });
      channel.close();
    } catch {}
  }
  // 3. Current window DOM event
  window.dispatchEvent(new CustomEvent('omnigit:workspace-changed'));
}

// Build a canonical WorkspaceGroupItem from a list of project paths, preserving existing custom attributes
export function buildWorkspaceRecord(
  wsId: string,
  paths: string[],
  existing?: WorkspaceGroupItem,
  knownRepos?: WorkspaceRepoItem[],
  lang: string = 'zh-CN',
  lastActiveProjectPath?: string
): WorkspaceGroupItem {
  const isZh = lang === 'zh-CN';
  const repos: WorkspaceRepoItem[] =
    knownRepos && knownRepos.length === paths.length
      ? knownRepos
      : paths.map((p) => {
          const norm = p.replace(/\\/g, '/');
          const name = norm.split('/').filter(Boolean).pop() || 'repo';
          return {
            name,
            path: p,
            branch: 'main',
          };
        });

  // Calculate common parent directory
  let rootPath = '';
  if (paths.length === 1) {
    rootPath = paths[0];
  } else if (paths.length > 1) {
    const normPaths = paths.map((p) => p.replace(/\\/g, '/').replace(/\/+$/, ''));
    const pathParts = normPaths.map((p) => p.split('/'));
    const minLen = Math.min(...pathParts.map((p) => p.length));
    const common: string[] = [];
    for (let i = 0; i < minLen; i++) {
      const part = pathParts[0][i];
      if (pathParts.every((p) => p[i].toLowerCase() === part.toLowerCase())) {
        common.push(part);
      } else {
        break;
      }
    }
    if (common.length > 0) {
      rootPath = common.join('/').replace(/\//g, '\\');
      if (/^[a-zA-Z]:$/i.test(rootPath)) {
        rootPath = `${rootPath}\\`;
      }
    } else {
      rootPath = paths[0];
    }
  }

  // Determine workspace name (preserve user custom name if already assigned!)
  let name = existing?.name;
  if (!name || name.trim() === '' || name.startsWith('ws_')) {
    if (repos.length === 1) {
      name = repos[0].name;
    } else if (repos.length > 1) {
      const normRoot = rootPath.replace(/\\/g, '/').replace(/\/+$/, '');
      const parts = normRoot.split('/').filter(Boolean);
      const parentFolderName = parts[parts.length - 1];
      const isDriveRoot = /^[a-zA-Z]:?$/i.test(parentFolderName || '');
      if (parentFolderName && !isDriveRoot) {
        name = parentFolderName;
      } else {
        name = isZh
          ? `${repos[0].name} 等 ${repos.length} 个项目`
          : `${repos[0].name} and ${repos.length - 1} more`;
      }
    } else {
      name = 'Workspace';
    }
  }

  const badgeColors = [
    'bg-sky-600/90 text-white',
    'bg-emerald-600/90 text-white',
    'bg-purple-600/90 text-white',
    'bg-amber-600/90 text-white',
    'bg-rose-600/90 text-white',
    'bg-indigo-600/90 text-white',
    'bg-teal-600/90 text-white',
  ];
  let hash = 0;
  for (let i = 0; i < wsId.length; i++) {
    hash = (hash * 31 + wsId.charCodeAt(i)) >>> 0;
  }
  const badgeColor = existing?.badgeColor || badgeColors[hash % badgeColors.length];

  return {
    id: wsId,
    name,
    rootPath,
    repos,
    lastOpened: existing?.lastOpened || Date.now(),
    badgeColor,
    lastActiveProjectPath: lastActiveProjectPath || existing?.lastActiveProjectPath,
  };
}

export const currentWorkspaceId = getWorkspaceIdFromUrl();
export const initialLanguage: AppLanguage =
  (typeof window !== 'undefined' && (localStorage.getItem('omnigit_language') as AppLanguage)) || 'zh-CN';
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('lang', initialLanguage);
}
const rawStoredTheme =
  (typeof window !== 'undefined' && localStorage.getItem('omnigit_theme')) || 'darcula';
export const initialTheme: AppTheme =
  rawStoredTheme === 'light' ? 'idea-light' : (rawStoredTheme as AppTheme);
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', initialTheme);
}

// In-flight concurrency guards to prevent request storming and socket exhaustion
export const syncRuntime = {
  isSyncingSilently: false,
  isPollingBatchSync: false,
  currentRepoLoadId: 0,
  lastFocusSyncTime: 0,
};
export const repoInFlight = new Set<string>();
export const repoSnapshotCache = new Map<string, LightRepoCache>();
export const outgoingCommitsMemoryCache = new Map<string, OutgoingCommitsData>();

// ==========================================
// 3-Tier Cache Architecture & Safe Storage
// L1: In-Memory Map (0ms instant response)
// L2: Web Storage (localStorage, quota-safe skeleton)
// L3: Local Disk Directory (D:\OmniGitCache\snapshots\, full depth)
// ==========================================

// Bulletproof LocalStorage write with automatic L2 eviction & quota protection
export function safeLocalStorageSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    console.warn(`[safeLocalStorageSetItem] Write failed for '${key}', performing L2 eviction:`, err?.message);
    try {
      // 1. Evict all L2 snapshot caches (full data already safe in L3 disk folder!)
      const snapKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('omnigit_snap_')) {
          snapKeys.push(k);
        }
      }
      snapKeys.forEach((k) => localStorage.removeItem(k));

      // Retry setItem
      localStorage.setItem(key, value);
      return true;
    } catch {
      try {
        // 2. Evict commit drafts if still full
        const draftKeys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('omnigit_commit_draft_')) {
            draftKeys.push(k);
          }
        }
        draftKeys.forEach((k) => localStorage.removeItem(k));

        localStorage.setItem(key, value);
        return true;
      } catch (finalErr) {
        console.error(`[safeLocalStorageSetItem] Critical storage error for key '${key}':`, finalErr);
        return false;
      }
    }
  }
}

// Workspaces & Recent Projects Dual-Tier Persistence Debouncer
let backupDebounceTimer: any = null;
export function scheduleWorkspacesDiskBackup() {
  if (typeof window === 'undefined') return;
  if (backupDebounceTimer) clearTimeout(backupDebounceTimer);
  backupDebounceTimer = setTimeout(() => {
    try {
      let savedWorkspaces: any[] = [];
      let recentProjects: any[] = [];
      const workspaceProjectPaths: Record<string, string[]> = {};

      try {
        const raw = localStorage.getItem('omnigit_saved_workspaces');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            savedWorkspaces = parsed.filter((w: any) => w && w.id && w.id !== 'default');
          }
        }
      } catch {}
      try {
        const raw = localStorage.getItem('omnigit_global_recent_projects');
        if (raw) recentProjects = JSON.parse(raw);
      } catch {}

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('omnigit_ws_paths_')) {
          const wsId = key.replace('omnigit_ws_paths_', '');
          if (!wsId || wsId === 'default') continue;
          try {
            const raw = localStorage.getItem(key);
            if (raw) workspaceProjectPaths[wsId] = JSON.parse(raw);
          } catch {}
        }
      }

      fetch('/api/git/workspaces/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          savedWorkspaces,
          recentProjects,
          workspaceProjectPaths,
        }),
      }).catch(() => {});
    } catch {}
  }, 800);
}

export function normalizeSnapshotFiles(files: any[]): GitFileItem[] {
  if (!Array.isArray(files)) return [];
  return files.map((f) => {
    const rawPath = f.path || '';
    const norm = rawPath.replace(/\\/g, '/');
    const fileName = f.fileName || norm.split('/').filter(Boolean).pop() || rawPath;
    const dirPath = f.dirPath || (norm.includes('/') ? norm.substring(0, norm.lastIndexOf('/')) : '');
    const status = f.status || 'modified';
    const group = f.group || (status === 'conflict' ? 'conflict' : (status === 'untracked' ? 'unversioned' : 'changes'));
    return {
      path: rawPath,
      fileName,
      dirPath,
      status,
      group,
      checked: Boolean(f.checked),
      staged: Boolean(f.staged),
    };
  });
}

// Sanitizes a snapshot so cold-start hydration NEVER speculatively assumes an in-progress merge conflict.
// Active merge conflicts are volatile runtime states determined solely by live Git (.git/MERGE_HEAD).
export function sanitizeSnapshot(snapshot: LightRepoCache): LightRepoCache {
  if (!snapshot) return snapshot;
  const cleanFiles = (snapshot.files || []).filter((f) => f.status !== 'conflict');
  return {
    ...snapshot,
    isMerging: false,
    conflictedCount: 0,
    mergeMessage: '',
    files: cleanFiles,
  };
}

// L1 / L2 / L3 Snapshot Persistence
export function getLocalSnapshot(rawPath: string): LightRepoCache | null {
  if (typeof window === 'undefined') return null;
  const normPath = normalizePath(rawPath);
  // 1. Check L1 In-Memory Cache first (0ms)
  if (repoSnapshotCache.has(normPath)) {
    const cached = repoSnapshotCache.get(normPath)!;
    if (cached && cached.files) {
      cached.files = normalizeSnapshotFiles(cached.files);
    }
    return sanitizeSnapshot(cached);
  }
  // 2. Check L2 Web Storage
  try {
    const raw = localStorage.getItem(`omnigit_snap_${normPath}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) {
        if (parsed.files) {
          parsed.files = normalizeSnapshotFiles(parsed.files);
        }
        const clean = sanitizeSnapshot(parsed);
        repoSnapshotCache.set(normPath, clean);
        return clean;
      }
    }
  } catch {}
  return null;
}

// Asynchronously read from L3 disk cache and promote into L1 memory (3~5ms)
export async function loadDiskSnapshot(repoPath: string): Promise<LightRepoCache | null> {
  const normPath = normalizePath(repoPath);
  try {
    const res = await fetch(`/api/git/cache/snapshot?path=${encodeURIComponent(repoPath)}`);
    const diskSnap = await res.json();
    if (diskSnap && diskSnap.repoPath) {
      if (diskSnap.files) {
        diskSnap.files = normalizeSnapshotFiles(diskSnap.files);
      }
      const clean = sanitizeSnapshot(diskSnap);
      repoSnapshotCache.set(normPath, clean);
      return clean;
    }
  } catch {}
  return null;
}

export function saveLocalSnapshot(rawPath: string, snapshot: LightRepoCache) {
  if (typeof window === 'undefined') return;
  const normPath = normalizePath(rawPath);

  // 1. L1 Memory: Full runtime state preserved with normalized files
  const normalizedFiles = normalizeSnapshotFiles(snapshot.files || []);
  const safeSnapshot = { ...snapshot, files: normalizedFiles };
  repoSnapshotCache.set(normPath, safeSnapshot);

  // 2. L2 Web Storage: Ultra-lightweight skeleton only (~3KB, prevents QuotaExceededError!)
  // Filter out conflict files and set isMerging: false so cold-start never speculatively flashes merge conflicts
  const nonConflictFiles = normalizedFiles.filter((f) => f.status !== 'conflict');
  try {
    const lightSnapshot = {
      repoPath: snapshot.repoPath,
      currentBranch: snapshot.currentBranch,
      upstream: snapshot.upstream,
      incoming: snapshot.incoming,
      outgoing: snapshot.outgoing,
      branches: (snapshot.branches || []).slice(0, 50).map((b) => ({
        name: b.name,
        isCurrent: b.isCurrent,
        isFavorite: b.isFavorite,
        upstream: b.upstream,
        incoming: b.incoming,
        outgoing: b.outgoing,
      })),
      files: nonConflictFiles.slice(0, 50).map((f: any) => ({
        path: f.path,
        fileName: f.fileName,
        dirPath: f.dirPath,
        status: f.status,
        group: f.group,
        staged: f.staged,
        checked: Boolean(f.checked),
      })),
      selectedFilePath: snapshot.selectedFilePath,
      commitMessage: snapshot.commitMessage,
      commitHistory: (snapshot.commitHistory || []).slice(0, 5),
      commitLogs: (snapshot.commitLogs || []).slice(0, 10).map((c: any) => ({
        hash: c.hash,
        shortHash: c.shortHash,
        subject: c.subject || c.message || '',
        message: c.message || c.subject || '',
        authorName: c.authorName || '',
        date: c.date || '',
      })),
      isMerging: false, // Never persist volatile merge conflict state to cold-start cache
      mergeMessage: '',
      conflictedCount: 0,
      lastUpdated: snapshot.lastUpdated || Date.now(),
    };
    safeLocalStorageSetItem(`omnigit_snap_${normPath}`, JSON.stringify(lightSnapshot));
  } catch {}

  // 3. L3 Disk Storage: Full snapshot asynchronously sunk to disk folder (up to 200 commits, all files)
  try {
    fetch('/api/git/cache/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: snapshot.repoPath,
        snapshot: {
          ...snapshot,
          files: nonConflictFiles,
          isMerging: false,
          mergeMessage: '',
          conflictedCount: 0,
        },
      }),
    }).catch(() => {});
  } catch {}
}
