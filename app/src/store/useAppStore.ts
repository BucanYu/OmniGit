import { create } from 'zustand';
import type { AppLanguage } from '../locales/types';

export type { AppLanguage };

export interface GitUserInfo {
  name: string;
  email: string;
}

export interface GitAuthorItem {
  name: string;
  email: string;
  commitCount: number;
  isCurrent: boolean;
}

export interface WorkspaceGitAccount {
  id: string;
  name: string;
  email: string;
  username?: string;
  remoteHost?: string;
  remoteUrl?: string;
  projectPaths: string[];
  projectNames: string[];
  isCurrent: boolean;
  hasPassword?: boolean;
  source: 'project' | 'credential' | 'custom' | 'global';
}

export interface GitFileItem {
  path: string;
  fileName: string;
  dirPath: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'conflict';
  group: 'changes' | 'unversioned' | 'conflict';
  checked: boolean;
  oldContent?: string;
  newContent?: string;
}

export interface ConflictBlockInfo {
  id: number;
  startLine: number;
  midLine: number;
  endLine: number;
  yoursText: string;
  theirsText: string;
  baseText?: string;
  yoursBranch: string;
  theirsBranch: string;
  resultStartLine?: number;
  resultEndLine?: number;
  leftStartLine?: number;
  leftEndLine?: number;
  rightStartLine?: number;
  rightEndLine?: number;
}

export interface Conflict3WayData {
  filePath: string;
  repoPath: string;
  yours: string;
  theirs: string;
  base: string;
  result: string;
  cleanResult?: string;
  conflictBlocks: ConflictBlockInfo[];
}

export interface BranchItem {
  name: string;
  isCurrent: boolean;
  isFavorite: boolean;
  upstream?: string;
  incoming: number;
  outgoing: number;
  category: 'recent' | 'local' | 'remote';
}

export interface GitProject {
  id: string;
  name: string;
  path: string;
  currentBranch: string;
  upstream?: string;
  incoming: number;
  outgoing: number;
  uncommittedCount?: number;
}

export type AppTheme = 'darcula' | 'idea-light' | 'github-dark' | 'nord-frost';

export interface AppNotification {
  id: number;
  title: string;
  detail?: string;
  linkText?: string;
  type?: 'info' | 'success' | 'warning';
}

export interface GitCommitItem {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  refs: string;
  message: string;
}

export interface GitCommitFileChange {
  path: string;
  oldPath?: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'unknown';
  statusCode: string;
  additions?: number;
  deletions?: number;
}

export interface GitCommitDetails {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  authorDate: string;
  committerName: string;
  committerEmail: string;
  committerDate: string;
  subject: string;
  body: string;
  parents: string[];
  refs: string;
  files: GitCommitFileChange[];
}

export interface LogFilterOptions {
  query: string;
  branch: string;
  author: string;
  dateRange: string;
}

export interface BranchOperationState {
  operating: boolean;
  type: 'checkout' | 'merge' | 'rebase' | 'update';
  branchName: string;
  message: string;
}

export interface HistoricalDiffState {
  original: string;
  modified: string;
  filePath: string;
  oldLabel: string;
  newLabel: string;
  commitHash: string;
}

export interface OutgoingCommitFile {
  path: string;
  fileName: string;
  dirPath: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'unknown';
  statusCode: string;
}

export interface OutgoingCommitItem {
  hash: string;
  shortHash: string;
  subject: string;
  body: string;
  authorName: string;
  authorEmail: string;
  date: string;
  files: OutgoingCommitFile[];
}

export interface OutgoingCommitsData {
  sourceBranch: string;
  targetBranch: string;
  remote: string;
  commits: OutgoingCommitItem[];
  allFiles: OutgoingCommitFile[];
}

export interface LightRepoCache {
  repoPath: string;
  currentBranch: string;
  upstream?: string;
  incoming: number;
  outgoing: number;
  branches: BranchItem[];
  files: GitFileItem[];
  selectedFilePath: string | null;
  commitMessage: string;
  commitHistory: string[];
  commitLogs?: GitCommitItem[];
  isMerging: boolean;
  mergeMessage: string;
  mergeSourceBranch?: string;
  conflictedCount: number;
  lastCommitDetails: GitCommitDetails | null;
  lastUpdated: number;
}

export interface WorkspaceRepoItem {
  name: string;
  path: string;
  branch?: string;
}

export interface WorkspaceGroupItem {
  id: string;
  name: string;
  rootPath: string;
  repos: WorkspaceRepoItem[];
  lastOpened: number;
  badgeColor?: string;
}

export interface RecentProjectItem {
  name: string;
  path: string;
  branch?: string;
  lastOpened: number;
  badgeColor?: string;
}

interface AppState {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  workspaceId: string;
  activeTab: 'commit' | 'shelf' | 'log';
  setActiveTab: (tab: 'commit' | 'shelf' | 'log') => void;

  // Welcome Screen & Startup Behavior (IntelliJ IDEA 1:1)
  isWelcomeScreenOpen: boolean;
  openWelcomeScreen: () => void;
  closeWelcomeScreen: () => void;
  startupBehavior: 'reopen_last' | 'welcome_screen';
  setStartupBehavior: (behavior: 'reopen_last' | 'welcome_screen') => void;
  newWindowBehavior: 'empty' | 'welcome';
  setNewWindowBehavior: (behavior: 'empty' | 'welcome') => void;
  
  // Workspace Aggregation (Multi-repo Workspaces)
  savedWorkspaces: WorkspaceGroupItem[];
  loadSavedWorkspaces: () => void;
  saveWorkspaceRecord: (ws: WorkspaceGroupItem) => void;
  removeSavedWorkspace: (id: string) => void;
  renameSavedWorkspace: (id: string, newName: string) => void;
  openWorkspaceGroup: (ws: WorkspaceGroupItem, inNewWindow?: boolean) => Promise<void>;
  createWorkspaceFromFolder: (folderPath: string) => Promise<WorkspaceGroupItem | null>;
  syncCurrentWorkspaceToSaved: () => void;

  globalRecentProjects: RecentProjectItem[];
  loadRecentProjects: () => void;
  registerRecentProject: (projectPath: string, name?: string, branch?: string) => void;
  removeRecentProject: (projectPath: string) => void;
  openProjectInWorkspace: (projectPath: string, inNewWindow?: boolean) => Promise<void>;
  gitUser: GitUserInfo | null;
  gitAuthors: GitAuthorItem[];
  workspaceAccounts: WorkspaceGitAccount[];
  selectedAuthorNames: string[];
  allScannedProjects: GitProject[]; // All local repos found on computer
  workspaceProjectPaths: string[];  // User-selected repos for THIS window
  projects: GitProject[];           // Active repos in this workspace
  activeProjectId: string;
  isLoading: boolean;
  isRepoLoading: boolean;
  
  // Branches
  branches: BranchItem[];
  isBranchMenuOpen: boolean;
  branchOperationLoading: BranchOperationState | null;
  
  // Files and Diff
  files: GitFileItem[];
  selectedFilePath: string | null;
  selectedFileDiff: { oldContent: string; newContent: string; isBinary?: boolean };
  editorViewMode: 'diff' | 'editor';
  setEditorViewMode: (mode: 'diff' | 'editor') => void;
  isRightPanelOpen: boolean;
  openRightPanel: () => void;
  closeRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
  viewStyle: 'flat' | 'tree';
  groupCollapsed: {
    conflicts: boolean;
    changes: boolean;
    unversioned: boolean;
  };
  isAmend: boolean;
  commitMessage: string;
  commitHistory: string[];

  // Merge & Conflict Resolution (IDEA Style)
  isMerging: boolean;
  mergeMessage: string;
  mergeSourceBranch?: string;
  conflictedCount: number;
  conflictsDialogOpen: boolean;
  conflictsDialogMinimized: boolean;
  openConflictsDialog: () => void;
  closeConflictsDialog: () => void;
  setConflictsDialogMinimized: (minimized: boolean) => void;
  threeWayMergeOpen: boolean;
  threeWayMergeMinimized: boolean;
  threeWayLoading: boolean;
  threeWayData: Conflict3WayData | null;
  openThreeWayMerge: (filePath: string) => Promise<void>;
  closeThreeWayMerge: () => void;
  setThreeWayMergeMinimized: (minimized: boolean) => void;
  resolveConflictQuick: (filePath: string, resolution: 'yours' | 'theirs') => Promise<void>;
  resolveAllConflictsQuick: (resolution: 'yours' | 'theirs') => Promise<void>;
  applyThreeWayMergeResult: (filePath: string, finalContent: string) => Promise<boolean>;
  abortCurrentMerge: () => Promise<void>;
  completeMergeCommit: (customMsg?: string) => Promise<void>;
  pollWorkspaceSyncStatus: () => Promise<void>;
  
  // Notifications & Modals
  notification: AppNotification | null;
  rollbackModal: {
    isOpen: boolean;
    targetPaths: string[];
  };
  isAddRepoModalOpen: boolean;
  setIsAddRepoModalOpen: (open: boolean) => void;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;

  // Layout Panel Widths & Heights (可左右与上下拖拉调整尺寸)
  sidebarWidth: number;
  statusPanelWidth: number;
  commitBoxHeight: number;
  logInspectorHeight: number;
  logInspectorDetailsWidth: number;
  setSidebarWidth: (width: number) => void;
  setStatusPanelWidth: (width: number) => void;
  setCommitBoxHeight: (height: number) => void;
  setLogInspectorHeight: (height: number) => void;
  setLogInspectorDetailsWidth: (width: number) => void;
  resetPanelWidths: () => void;
  lastCommitDetails: GitCommitDetails | null;
  loadLastCommit: (repoPath?: string) => Promise<GitCommitDetails | null>;
  loadRecentCommitMessages: (repoPath?: string) => Promise<void>;

  // Actions
  initApp: () => Promise<void>;
  setActiveProject: (id: string) => Promise<void>;
  loadRepoData: (repoPath: string, force?: boolean) => Promise<void>;
  syncRepoStatusSilently: (repoPath?: string) => Promise<void>;
  setSelectedFile: (path: string | null) => Promise<void>;
  saveCurrentFile: (content: string) => Promise<boolean>;
  toggleFileCheck: (path: string) => void;
  toggleGroupCheck: (group: 'changes' | 'unversioned', checked: boolean) => void;
  toggleGroupCollapsed: (group: 'changes' | 'unversioned') => void;
  setViewStyle: (style: 'flat' | 'tree') => void;
  setIsAmend: (isAmend: boolean) => void;
  setCommitMessage: (msg: string) => void;
  setIsBranchMenuOpen: (open: boolean) => void;
  setIsAddRepoModalOpen: (open: boolean) => void;

  // Workspace & Multi-window Actions
  addProjectsToWorkspace: (paths: string[]) => Promise<void>;
  setWorkspaceProjects: (paths: string[]) => Promise<void>;
  removeProjectFromWorkspace: (path: string) => Promise<void>;
  reorderProjects: (sourceIndex: number, targetIndex: number) => void;
  getWorkspaceOpenFolder: () => string | undefined;
  cloneAndImportRepo: (params: {
    remoteUrl: string;
    targetDir: string;
    folderName?: string;
    branch?: string;
    username?: string;
    password?: string;
  }) => Promise<{ success: boolean; message: string; repoPath?: string }>;
  createNewWindow: () => void;
  
  // Real Git Flow Actions
  commit: (pushAfter?: boolean) => Promise<void>;
  openRollbackModal: (paths: string[]) => void;
  closeRollbackModal: () => void;
  confirmRollback: () => Promise<void>;
  checkoutBranch: (branchName: string) => Promise<void>;
  mergeBranch: (branchName: string) => Promise<{ success: boolean; message: string }>;
  lastMergeUndoInfo: {
    repoPath: string;
    sourceBranch: string;
    targetBranch: string;
    preMergeHead: string;
    timestamp: number;
  } | null;
  checkMergeUndoStatus: (repoPath?: string, activeBranch?: string) => Promise<{ canUndo: boolean; sourceBranch: string; targetBranch: string; preMergeHead: string } | null>;
  undoLastMerge: (sourceBranch?: string) => Promise<{ success: boolean; message: string }>;
  deleteBranch: (branchName: string, force?: boolean, isRemote?: boolean) => Promise<{ success: boolean; message: string }>;
  updateProject: () => Promise<void>;
  setNotification: (notif: AppNotification | null) => void;
  clearNotification: () => void;

  // Branch & Git Flow Actions (IntelliJ IDEA Style)
  toggleBranchFavorite: (branchName: string) => void;
  renameBranch: (oldName: string, newName: string) => Promise<{ success: boolean; message: string }>;
  rebaseBranch: (upstream: string) => Promise<{ success: boolean; message: string }>;
  checkoutAndRebase: (branch: string, onto: string) => Promise<{ success: boolean; message: string }>;
  checkoutAndUpdate: (branch: string) => Promise<{ success: boolean; message: string }>;
  pushBranch: (branch: string) => Promise<{ success: boolean; message: string }>;
  checkoutTagOrRevision: (target: string, newBranchName?: string) => Promise<{ success: boolean; message: string }>;
  showBranchDiffWithWorkingTree: (branch: string) => Promise<void>;
  compareBranchWithCurrent: (branch: string) => Promise<void>;

  // Push Commits Modal (IntelliJ IDEA Style)
  isPushModalOpen: boolean;
  pushModalTargetBranch: string | null;
  outgoingCommitsData: OutgoingCommitsData | null;
  outgoingCommitsLoading: boolean;
  pushingLoading: boolean;
  pushError: string | null;
  openPushModal: (branchName?: string) => Promise<void>;
  closePushModal: () => void;
  executePush: (options?: { force?: boolean; tags?: boolean }) => Promise<{ success: boolean; message: string }>;

  // User & Author Filter Actions
  loadRepoAuthors: (repoPath?: string) => Promise<void>;
  loadWorkspaceAccounts: () => Promise<void>;
  toggleAuthorFilter: (authorName: string) => void;
  setPrimaryAuthor: (authorName: string) => void;
  selectAllAuthors: () => void;
  clearAuthorFilter: () => void;
  switchActiveGitUser: (
    name: string,
    email: string,
    isGlobal?: boolean,
    applyToAllWorkspace?: boolean
  ) => Promise<void>;
  addCustomGitAccount: (data: {
    name: string;
    email: string;
    username?: string;
    password?: string;
    scope: 'project' | 'workspace' | 'global';
  }) => Promise<void>;

  // Git Log & Historical Version Control
  commitLogs: GitCommitItem[];
  commitLogsLoading: boolean;
  commitLogsSkip: number;
  hasMoreCommits: boolean;
  selectedCommitHash: string | null;
  selectedCommitDetails: GitCommitDetails | null;
  commitDetailsLoading: boolean;
  selectedHistoricalFilePath: string | null;
  historicalDiff: HistoricalDiffState | null;
  logFilters: LogFilterOptions;

  // Log Actions
  setLogFilters: (filters: Partial<LogFilterOptions>) => void;
  fetchCommitLogs: (reset?: boolean) => Promise<void>;
  selectCommit: (hash: string | null) => Promise<void>;
  selectHistoricalFileDiff: (hash: string, filePath: string) => Promise<void>;
  clearHistoricalDiff: () => void;
  resetToCommit: (hash: string, mode: 'soft' | 'mixed' | 'hard') => Promise<{ success: boolean; message: string }>;
  revertCommit: (hash: string) => Promise<{ success: boolean; message: string }>;
  checkoutRevision: (hash: string) => Promise<{ success: boolean; message: string }>;
  createBranchAtCommit: (branchName: string, hash: string) => Promise<{ success: boolean; message: string }>;
  createTagAtCommit: (tagName: string, hash: string, message?: string) => Promise<{ success: boolean; message: string }>;
  cherryPickCommit: (hash: string) => Promise<{ success: boolean; message: string; isConflict?: boolean }>;

  // VS Code File Action Icons (Open, Reveal, Stage, Unstage)
  openFileInEditor: (filePath: string) => Promise<void>;
  revealFileInOS: (filePath: string) => Promise<void>;
  openProjectFolder: (projectPath?: string) => Promise<void>;
  stageFile: (filePath: string) => Promise<void>;
  unstageFile: (filePath: string) => Promise<void>;
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
  lang: string = 'zh-CN'
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
  };
}

const currentWorkspaceId = getWorkspaceIdFromUrl();
const initialLanguage: AppLanguage =
  (typeof window !== 'undefined' && (localStorage.getItem('omnigit_language') as AppLanguage)) || 'zh-CN';
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('lang', initialLanguage);
}
const rawStoredTheme =
  (typeof window !== 'undefined' && localStorage.getItem('omnigit_theme')) || 'darcula';
const initialTheme: AppTheme =
  rawStoredTheme === 'light' ? 'idea-light' : (rawStoredTheme as AppTheme);
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', initialTheme);
}

// In-flight concurrency guards to prevent request storming and socket exhaustion
let isSyncingSilently = false;
let isPollingBatchSync = false;
let currentRepoLoadId = 0;
let lastFocusSyncTime = 0;
const repoInFlight = new Set<string>();
const repoSnapshotCache = new Map<string, LightRepoCache>();

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

// L1 / L2 / L3 Snapshot Persistence
function getLocalSnapshot(normPath: string): LightRepoCache | null {
  if (typeof window === 'undefined') return null;
  // 1. Check L1 In-Memory Cache first (0ms)
  if (repoSnapshotCache.has(normPath)) {
    return repoSnapshotCache.get(normPath)!;
  }
  // 2. Check L2 Web Storage
  try {
    const raw = localStorage.getItem(`omnigit_snap_${normPath}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) {
        repoSnapshotCache.set(normPath, parsed);
        return parsed;
      }
    }
  } catch {}
  return null;
}

// Asynchronously read from L3 disk cache and promote into L1 memory (3~5ms)
export async function loadDiskSnapshot(repoPath: string): Promise<LightRepoCache | null> {
  const normPath = repoPath.toLowerCase();
  try {
    const res = await fetch(`/api/git/cache/snapshot?path=${encodeURIComponent(repoPath)}`);
    const diskSnap = await res.json();
    if (diskSnap && diskSnap.repoPath) {
      repoSnapshotCache.set(normPath, diskSnap);
      return diskSnap;
    }
  } catch {}
  return null;
}

function saveLocalSnapshot(normPath: string, snapshot: LightRepoCache) {
  if (typeof window === 'undefined') return;

  // 1. L1 Memory: Full runtime state preserved
  repoSnapshotCache.set(normPath, snapshot);

  // 2. L2 Web Storage: Ultra-lightweight skeleton only (~3KB, prevents QuotaExceededError!)
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
      files: (snapshot.files || []).slice(0, 30).map((f) => ({
        path: f.path,
        status: f.status,
        staged: f.staged,
      })),
      selectedFilePath: snapshot.selectedFilePath,
      commitMessage: snapshot.commitMessage,
      commitHistory: (snapshot.commitHistory || []).slice(0, 5),
      commitLogs: (snapshot.commitLogs || []).slice(0, 10).map((c) => ({
        hash: c.hash,
        shortHash: c.shortHash,
        subject: c.subject || c.message || '',
        message: c.message || c.subject || '',
        authorName: c.authorName || '',
        date: c.date || '',
      })),
      isMerging: snapshot.isMerging,
      mergeMessage: snapshot.mergeMessage,
      conflictedCount: snapshot.conflictedCount,
      lastUpdated: snapshot.lastUpdated || Date.now(),
    };
    safeLocalStorageSetItem(`omnigit_snap_${normPath}`, JSON.stringify(lightSnapshot));
  } catch {}

  // 3. L3 Disk Storage: Full snapshot asynchronously sunk to disk folder (up to 200 commits, all files)
  try {
    fetch('/api/git/cache/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: snapshot.repoPath, snapshot }),
    }).catch(() => {});
  } catch {}
}

export const useAppStore = create<AppState>((set, get) => ({
  language: initialLanguage,
  setLanguage: (lang: AppLanguage) => {
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_language', lang);
      document.documentElement.setAttribute('lang', lang);
    }
    set({ language: lang });
  },
  theme: initialTheme,
  setTheme: (theme: AppTheme) => {
    const safeTheme: AppTheme = (theme as any) === 'light' ? 'idea-light' : theme;
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_theme', safeTheme);
      document.documentElement.setAttribute('data-theme', safeTheme);
    }
    set({ theme: safeTheme });
    broadcastWorkspaceChanged();
  },
  workspaceId: currentWorkspaceId,
  isWelcomeScreenOpen: false,
  openWelcomeScreen: () => {
    get().loadSavedWorkspaces();
    get().loadRecentProjects();
    set({ isWelcomeScreenOpen: true });
  },
  closeWelcomeScreen: () => set({ isWelcomeScreenOpen: false }),
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
              const existingPathSet = new Set(existing.repos.map((r) => r.path.toLowerCase()));
              const isSame =
                existing.repos.length === paths.length &&
                paths.every((p) => existingPathSet.has(p.toLowerCase()));
              if (!isSame) {
                const updatedRepos: WorkspaceRepoItem[] = paths.map((p) => {
                  const foundRepo = existing.repos.find((r) => r.path.toLowerCase() === p.toLowerCase());
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
              const newWs = buildWorkspaceRecord(wsId, paths, undefined, undefined, get().language);
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
            multiRepoPaths.add(r.path.toLowerCase().replace(/\\/g, '/'));
          }
        });
      }
    }

    // Auto-clean any duplicate single-repo workspace created by the cold-start bug whose single repo is already part of a multi-repo workspace
    list = list.filter((ws) => {
      if (!ws || !ws.id || ws.id === 'default') return false;
      if (ws.repos && ws.repos.length === 1) {
        const singlePath = (ws.repos[0].path || '').toLowerCase().replace(/\\/g, '/');
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
    const current = get().savedWorkspaces.filter((w) => w && w.id && w.id !== 'default');
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
    const updatedWs = { ...ws, lastOpened: Date.now() };
    get().saveWorkspaceRecord(updatedWs);

    ws.repos.forEach((r) => {
      get().registerRecentProject(r.path, r.name, r.branch);
    });

    const repoPaths = ws.repos.map((r) => r.path);
    const targetWsId = ws.id;

    if (inNewWindow) {
      if (typeof window !== 'undefined') {
        safeLocalStorageSetItem(`omnigit_ws_paths_${targetWsId}`, JSON.stringify(repoPaths));
        if (repoPaths[0]) {
          safeLocalStorageSetItem(`omnigit_last_active_project_path_${targetWsId}`, repoPaths[0]);
          safeLocalStorageSetItem('omnigit_last_closed_project_path', repoPaths[0]);
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
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem(`omnigit_ws_paths_${targetWsId}`, JSON.stringify(repoPaths));
      if (repoPaths[0]) {
        safeLocalStorageSetItem(`omnigit_last_active_project_path_${targetWsId}`, repoPaths[0]);
        safeLocalStorageSetItem('omnigit_last_closed_project_path', repoPaths[0]);
      }
      safeLocalStorageSetItem('omnigit_last_active_workspace_id', targetWsId);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('ws', targetWsId);
        window.history.replaceState(null, '', url.toString());
      } catch {}
    }
    set({ workspaceId: targetWsId, isWelcomeScreenOpen: false, isLoading: true });
    await get().setWorkspaceProjects(repoPaths);
    set({ isLoading: false });
  },

  syncCurrentWorkspaceToSaved: () => {
    if (typeof window === 'undefined') return;
    const state = get();
    const currentPaths = state.workspaceProjectPaths;
    if (!currentPaths || currentPaths.length === 0) return;
    if (!state.workspaceId || state.workspaceId === 'default') return;

    const currentSaved = get().savedWorkspaces.slice();
    const existing = currentSaved.find((w) => w.id === state.workspaceId);

    const repos: WorkspaceRepoItem[] = currentPaths.map((p) => {
      const proj =
        state.projects.find((pr) => pr.path.toLowerCase() === p.toLowerCase()) ||
        state.allScannedProjects.find((pr) => pr.path.toLowerCase() === p.toLowerCase());
      const norm = p.replace(/\\/g, '/');
      const name = proj?.name || norm.split('/').filter(Boolean).pop() || 'repo';
      return {
        name,
        path: p,
        branch: proj?.currentBranch || 'main',
      };
    });

    // Also register every repo into recent projects list
    repos.forEach((r) => {
      get().registerRecentProject(r.path, r.name, r.branch);
    });

    const wsRecord = buildWorkspaceRecord(
      state.workspaceId,
      currentPaths,
      existing,
      repos,
      get().language
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
          set({ globalRecentProjects: parsed });
          return;
        }
      }
    } catch {}
    set({ globalRecentProjects: [] });
  },
  registerRecentProject: (projectPath: string, name?: string, branch?: string) => {
    if (typeof window === 'undefined' || !projectPath) return;
    const norm = projectPath.replace(/\\/g, '/');
    const repoName = name || norm.split('/').filter(Boolean).pop() || 'repo';
    const currentList = get().globalRecentProjects.slice();
    const existingIndex = currentList.findIndex(
      (p) => p.path.toLowerCase() === projectPath.toLowerCase()
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
    safeLocalStorageSetItem('omnigit_last_active_project_path', projectPath);
    safeLocalStorageSetItem(`omnigit_last_active_project_path_${get().workspaceId}`, projectPath);
    safeLocalStorageSetItem('omnigit_last_closed_project_path', projectPath);
    safeLocalStorageSetItem('omnigit_last_active_workspace_id', get().workspaceId);
    set({ globalRecentProjects: truncated });
    broadcastWorkspaceChanged();
    scheduleWorkspacesDiskBackup();
  },
  removeRecentProject: (projectPath: string) => {
    if (typeof window === 'undefined') return;
    const updated = get().globalRecentProjects.filter(
      (p) => p.path.toLowerCase() !== projectPath.toLowerCase()
    );
    safeLocalStorageSetItem('omnigit_global_recent_projects', JSON.stringify(updated));
    set({ globalRecentProjects: updated });
    broadcastWorkspaceChanged();
    scheduleWorkspacesDiskBackup();
  },
  openProjectInWorkspace: async (projectPath: string, inNewWindow = false) => {
    get().registerRecentProject(projectPath);
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
    set({ isWelcomeScreenOpen: false, isLoading: true });
    await get().setWorkspaceProjects([projectPath]);
    set({ isLoading: false });
  },
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

  // Git Log & Historical Version Control
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

  branches: [],
  isBranchMenuOpen: false,
  branchOperationLoading: null,

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

  // Merge & Conflict Resolution Initial State
  isMerging: false,
  mergeMessage: '',
  mergeSourceBranch: undefined,
  conflictedCount: 0,
  conflictsDialogOpen: false,
  conflictsDialogMinimized: false,
  lastMergeUndoInfo: null,
  openConflictsDialog: () => set({ conflictsDialogOpen: true, conflictsDialogMinimized: false }),
  closeConflictsDialog: () => set({ conflictsDialogOpen: false, conflictsDialogMinimized: false }),
  setConflictsDialogMinimized: (minimized: boolean) => set({ conflictsDialogMinimized: minimized }),
  threeWayMergeOpen: false,
  threeWayMergeMinimized: false,
  threeWayLoading: false,
  threeWayData: null,
  closeThreeWayMerge: () => {
    set({
      threeWayMergeOpen: false,
      threeWayMergeMinimized: false,
      threeWayLoading: false,
      threeWayData: null,
      conflictsDialogOpen: false,
      conflictsDialogMinimized: false,
    });
  },
  setThreeWayMergeMinimized: (minimized: boolean) => set({ threeWayMergeMinimized: minimized }),

  notification: null,
  rollbackModal: {
    isOpen: false,
    targetPaths: [],
  },
  isAddRepoModalOpen: false,
  isSettingsModalOpen: false,
  isPushModalOpen: false,
  pushModalTargetBranch: null,
  outgoingCommitsData: null,
  outgoingCommitsLoading: false,
  pushingLoading: false,
  pushError: null,

  // Layout Panel Widths & Resize Actions
  sidebarWidth:
    typeof window !== 'undefined'
      ? parseInt(localStorage.getItem('omnigit_sidebar_width') || '256', 10)
      : 256,
  statusPanelWidth:
    typeof window !== 'undefined'
      ? parseInt(localStorage.getItem('omnigit_status_width') || '380', 10)
      : 380,
  commitBoxHeight:
    typeof window !== 'undefined'
      ? parseInt(localStorage.getItem('omnigit_commit_box_height') || '190', 10)
      : 190,
  logInspectorHeight:
    typeof window !== 'undefined'
      ? parseInt(localStorage.getItem('omnigit_log_inspector_height') || '260', 10)
      : 260,
  logInspectorDetailsWidth:
    typeof window !== 'undefined'
      ? parseInt(localStorage.getItem('omnigit_log_inspector_details_width') || '240', 10)
      : 240,
  lastCommitDetails: null,

  setSidebarWidth: (width: number) => {
    const clamped = Math.max(160, Math.min(520, width));
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_sidebar_width', String(clamped));
    }
    set({ sidebarWidth: clamped });
  },

  setStatusPanelWidth: (width: number) => {
    const clamped = Math.max(240, Math.min(1100, width));
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_status_width', String(clamped));
    }
    set({ statusPanelWidth: clamped });
  },

  setCommitBoxHeight: (height: number) => {
    const clamped = Math.max(110, Math.min(480, height));
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_commit_box_height', String(clamped));
    }
    set({ commitBoxHeight: clamped });
  },

  setLogInspectorHeight: (height: number) => {
    const clamped = Math.max(120, Math.min(600, height));
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_log_inspector_height', String(clamped));
    }
    set({ logInspectorHeight: clamped });
  },

  setLogInspectorDetailsWidth: (width: number) => {
    const clamped = Math.max(140, Math.min(600, width));
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_log_inspector_details_width', String(clamped));
    }
    set({ logInspectorDetailsWidth: clamped });
  },

  resetPanelWidths: () => {
    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('omnigit_sidebar_width', '256');
      safeLocalStorageSetItem('omnigit_status_width', '380');
      safeLocalStorageSetItem('omnigit_commit_box_height', '190');
      safeLocalStorageSetItem('omnigit_log_inspector_height', '260');
      safeLocalStorageSetItem('omnigit_log_inspector_details_width', '240');
    }
    set({
      sidebarWidth: 256,
      statusPanelWidth: 380,
      commitBoxHeight: 190,
      logInspectorHeight: 260,
      logInspectorDetailsWidth: 240,
    });
  },

  // Initialize application with real Git data & workspace persistence
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

      const savedActivePath = typeof window !== 'undefined'
        ? localStorage.getItem(`omnigit_last_active_project_path_${activeWsId}`) || localStorage.getItem('omnigit_last_active_project_path')
        : null;
      let activeProject = instantProjects[0];
      if (savedActivePath) {
        const matched = instantProjects.find(
          (p) => p.path.toLowerCase() === savedActivePath.toLowerCase()
        );
        if (matched) {
          activeProject = matched;
        }
      }

      const normActiveLower = activeProject.path.toLowerCase();
      const activeCached = repoSnapshotCache.get(normActiveLower) || getLocalSnapshot(normActiveLower);
      if (activeCached && !repoSnapshotCache.has(normActiveLower)) {
        repoSnapshotCache.set(normActiveLower, activeCached);
      }

      const initialDraft = typeof window !== 'undefined'
        ? localStorage.getItem(`omnigit_commit_draft_${activeWsId}_${activeProject.path}`) || localStorage.getItem(`omnigit_commit_draft_${activeProject.path}`) || ''
        : '';

      // Register all instant projects into global recent list & sync saved workspace
      instantProjects.forEach((p) => {
        get().registerRecentProject(p.path, p.name, p.currentBranch !== '...' ? p.currentBranch : undefined);
      });
      get().syncCurrentWorkspaceToSaved();

      // 0ms instant UI mount: Sidebar, projects, branch, files & logs appear with ZERO waiting!
      if (activeCached) {
        set({
          workspaceProjectPaths: selectedPaths,
          projects: instantProjects,
          activeProjectId: activeProject.id,
          commitMessage: initialDraft || activeCached.commitMessage || '',
          files: activeCached.files || [],
          branches: activeCached.branches || [],
          commitLogs: activeCached.commitLogs || [],
          isMerging: activeCached.isMerging || false,
          mergeMessage: activeCached.mergeMessage || '',
          conflictedCount: activeCached.conflictedCount || 0,
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

  // Add multiple project paths into current workspace
  addProjectsToWorkspace: async (newPaths: string[]) => {
    const state = get();
    const storageKey = `omnigit_ws_paths_${state.workspaceId}`;
    const merged = Array.from(new Set([...state.workspaceProjectPaths, ...newPaths]));

    safeLocalStorageSetItem(storageKey, JSON.stringify(merged));

    // Ensure all paths exist in allScannedProjects
    let allProjects = [...state.allScannedProjects];
    for (const p of newPaths) {
      if (!allProjects.some((exist) => exist.path.toLowerCase() === p.toLowerCase())) {
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

    const resolvedProjects = allProjects.filter((p) => merged.includes(p.path));

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
          (p) => p.path.toLowerCase() === savedActivePath.toLowerCase()
        );
        if (matched) targetRepo = matched;
      }
      set({ activeProjectId: targetRepo.id });
      await get().loadRepoData(targetRepo.path);
    } else {
      await get().loadWorkspaceAccounts();
    }
  },

  // Clone remote Git repository and automatically import into workspace
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
        (p) => p.path.toLowerCase() === repoPath.toLowerCase()
      );
      if (createdProject) {
        get().setActiveProject(createdProject.id);
        await get().loadRepoData(createdProject.path);
      }

      const isZh = get().language === 'zh-CN';
      get().setNotification({
        id: Date.now(),
        title: isZh ? '克隆成功并已加入工作区' : 'Repository Cloned & Added to Workspace',
        detail: isZh
          ? `已成功从远端拉取仓库：${data.repoName || params.folderName || repoPath}`
          : `Successfully cloned remote repository: ${data.repoName || params.folderName || repoPath}`,
        type: 'success',
      });

      return { success: true, message: data.message, repoPath };
    } catch (e: any) {
      return { success: false, message: e.message || (get().language === 'zh-CN' ? '网络请求错误，无法连接后端服务' : 'Network error, unable to connect to server') };
    }
  },

  // Set the exact list of projects in workspace
  setWorkspaceProjects: async (newPaths: string[]) => {
    const state = get();
    const storageKey = `omnigit_ws_paths_${state.workspaceId}`;
    safeLocalStorageSetItem(storageKey, JSON.stringify(newPaths));

    let allProjects = [...state.allScannedProjects];
    for (const p of newPaths) {
      if (!allProjects.some((exist) => exist.path.toLowerCase() === p.toLowerCase())) {
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

    const resolvedProjects = allProjects.filter((p) => newPaths.includes(p.path));

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
      get().syncCurrentWorkspaceToSaved();

      const savedActivePath = typeof window !== 'undefined'
        ? localStorage.getItem(`omnigit_last_active_project_path_${state.workspaceId}`) || localStorage.getItem('omnigit_last_active_project_path')
        : null;
      const matched = savedActivePath
        ? resolvedProjects.find((p) => p.path.toLowerCase() === savedActivePath.toLowerCase())
        : null;
      if (matched) {
        await get().setActiveProject(matched.id);
      } else if (!resolvedProjects.some((p) => p.id === state.activeProjectId)) {
        await get().setActiveProject(resolvedProjects[0].id);
      } else {
        await get().loadWorkspaceAccounts();
      }
    } else {
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

  // Remove a project from current workspace (view only, never deletes disk files!)
  removeProjectFromWorkspace: async (targetPath: string) => {
    const state = get();
    const storageKey = `omnigit_ws_paths_${state.workspaceId}`;
    const filteredPaths = state.workspaceProjectPaths.filter((p) => p !== targetPath);

    safeLocalStorageSetItem(storageKey, JSON.stringify(filteredPaths));

    const remainingProjects = state.projects.filter((p) => p.path !== targetPath);
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

  // Create and launch an independent new window with a fresh workspace
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

  // Load real status, branches, and diff for active repository
  loadRepoData: async (repoPath: string, force = false) => {
    const normPath = repoPath.toLowerCase();
    const cached = repoSnapshotCache.get(normPath) || getLocalSnapshot(normPath);
    if (cached && !repoSnapshotCache.has(normPath)) {
      repoSnapshotCache.set(normPath, cached);
    }
    const now = Date.now();

    // 15s TTL Freshness check: if cached within 15s and not forced, do NOT fire any network request!
    if (!force && cached && now - cached.lastUpdated < 15000) {
      const currentActive = get().projects.find((p) => p.id === get().activeProjectId);
      if (currentActive && currentActive.path.toLowerCase() === normPath) {
        set({
          files: cached.files,
          branches: cached.branches,
          commitLogs: cached.commitLogs || get().commitLogs,
          isMerging: cached.isMerging,
          mergeMessage: cached.mergeMessage,
          mergeSourceBranch: cached.mergeSourceBranch,
          conflictedCount: cached.conflictedCount,
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
        }));

      const allFiles: GitFileItem[] = Array.isArray(status?.files) ? status.files : [];
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
      if (loadId !== currentRepoLoadId || !nowActive || nowActive.path.toLowerCase() !== normPath) {
        return;
      }

      const shouldOpenConflicts = conflictFiles.length > 0 && !get().conflictsDialogOpen && !get().conflictsDialogMinimized;

      set((state) => ({
        files: allFiles,
        branches: enrichedBranches,
        isMerging: Boolean(status.isMerging),
        mergeMessage: status.mergeMessage || '',
        mergeSourceBranch: status.mergeSourceBranch,
        conflictedCount: status.conflictedCount || conflictFiles.length,
        conflictsDialogOpen: shouldOpenConflicts ? true : state.conflictsDialogOpen,
        projects: state.projects.map((p) =>
          p.path.toLowerCase() === normPath
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

  // Silent real-time sync for external file modifications, creations, and deletions
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

      const allFiles: GitFileItem[] = Array.isArray(status?.files) ? status.files : [];
      const conflictFiles = allFiles.filter((f) => f.status === 'conflict');

      // Update state without resetting user interaction
      set((state) => {
        const prevProject = state.projects.find((p) => p.path === targetPath);
        const isProjectUnchanged =
          prevProject &&
          prevProject.currentBranch === status.currentBranch &&
          prevProject.upstream === status.upstream &&
          prevProject.incoming === status.incoming &&
          prevProject.outgoing === status.outgoing;

        const updatedProjects = isProjectUnchanged
          ? state.projects
          : state.projects.map((p) =>
              p.path === targetPath
                ? {
                    ...p,
                    currentBranch: status.currentBranch,
                    upstream: status.upstream,
                    incoming: status.incoming,
                    outgoing: status.outgoing,
                  }
                : p
            );

        return {
          files: allFiles,
          branches: enrichedBranches,
          isMerging: Boolean(status.isMerging),
          mergeMessage: status.mergeMessage || state.mergeMessage,
          mergeSourceBranch: status.mergeSourceBranch,
          conflictedCount: status.conflictedCount || conflictFiles.length,
          projects: updatedProjects,
        };
      });

      // Update snapshot cache in background
      const cachedSnapshot = repoSnapshotCache.get(targetPath.toLowerCase());
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

  setActiveProject: async (id: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    const targetProject = get().projects.find((p) => p.id === id);
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
      const curCached = repoSnapshotCache.get(currentProject.path.toLowerCase());
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

    // Invalidate any in-flight requests from the previous project!
    currentRepoLoadId++;

    const normTargetPath = targetProject.path.toLowerCase();
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
        files: Array.isArray(cached.files) ? cached.files : [],
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
        isMerging: Boolean(cached.isMerging),
        mergeMessage: cached.mergeMessage || '',
        mergeSourceBranch: cached.mergeSourceBranch,
        conflictedCount: Number(cached.conflictedCount) || 0,
      });

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

  setIsBranchMenuOpen: (open) => set({ isBranchMenuOpen: open }),
  setIsAddRepoModalOpen: (open) => set({ isAddRepoModalOpen: open }),
  setIsSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),

  // 1. Real Commit
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

  // 2. Real Rollback
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

  // 3. Real Checkout
  checkoutBranch: async (branchName: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return;

    const isZh = get().language === 'zh-CN';
    set({
      isBranchMenuOpen: false,
      branchOperationLoading: {
        operating: true,
        type: 'checkout',
        branchName,
        message: isZh ? `正在切换分支至 '${branchName}'...` : `Checking out branch '${branchName}'...`,
      },
    });

    try {
      const res = await fetch('/api/git/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          branch: branchName,
        }),
      });
      const result = await res.json();
      if (result.success) {
        // 1. Optimistically update currentBranch & isCurrent at 0ms
        const normPath = currentProject.path.toLowerCase();
        set((curr) => ({
          projects: (curr.projects || []).map((p) =>
            p && p.id === currentProject.id ? { ...p, currentBranch: branchName } : p
          ),
          branches: (curr.branches || []).map((b) => ({
            ...b,
            isCurrent: Boolean(b && b.name === branchName),
          })),
          notification: {
            id: Date.now(),
            title: isZh ? `已成功切换到分支 '${branchName}'` : `Switched to branch '${branchName}'`,
            detail: result.message,
            type: 'info',
          },
        }));

        // 2. Sync snapshot cache & disk snapshot
        try {
          const cached = repoSnapshotCache.get(normPath);
          if (cached) {
            cached.currentBranch = branchName;
            cached.branches = (cached.branches || []).map((b) => ({
              ...b,
              isCurrent: Boolean(b && b.name === branchName),
            }));
            cached.lastUpdated = Date.now();
            saveLocalSnapshot(normPath, cached);
          }
        } catch {}

        // 3. Force reload repo status & commit logs (bypassing 15s TTL)
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        const errorDetail = result.message || (isZh ? '切换分支失败，请检查是否有未提交的代码冲突或文件被占用' : 'Checkout failed. Please ensure there are no uncommitted conflicts');
        set({
          notification: {
            id: Date.now(),
            title: isZh ? '切换分支失败 (Checkout Failed)' : 'Checkout Failed',
            detail: errorDetail,
            type: 'warning',
          },
        });
      }
    } catch (e: any) {
      set({
        notification: {
          id: Date.now(),
          title: isZh ? '切换分支异常' : 'Checkout Exception',
          detail: e.message || (isZh ? '网络请求或服务通信失败' : 'Network request or service communication failed'),
          type: 'warning',
        },
      });
    } finally {
      set({ branchOperationLoading: null });
    }
  },

  mergeBranch: async (branchName: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    const isZh = get().language === 'zh-CN';
    set({
      isBranchMenuOpen: false,
      branchOperationLoading: {
        operating: true,
        type: 'merge',
        branchName,
        message: isZh ? `正在合并分支 '${branchName}' 到当前分支...` : `Merging branch '${branchName}' into current branch...`,
      },
    });

    try {
      const res = await fetch('/api/git/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          branch: branchName,
        }),
      });
      const data = await res.json();

      if (data.success) {
        if (data.preMergeHead) {
          set({
            lastMergeUndoInfo: {
              repoPath: currentProject.path,
              sourceBranch: branchName,
              targetBranch: data.targetBranch || currentProject.currentBranch,
              preMergeHead: data.preMergeHead,
              timestamp: Date.now(),
            },
          });
        }

        // Pop up the exact IDEA-matching notification balloon: "Merged <source> to <target>"
        set({
          notification: {
            id: Date.now(),
            title: `Merged ${data.sourceBranch} to ${data.targetBranch}`,
            detail: data.stdout && !data.stdout.includes('Already up to date') ? data.stdout : undefined,
            type: 'success',
          },
        });
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        const hasConflicts = Boolean(data.isConflict) || get().files.some((f) => f.status === 'conflict') || get().isMerging;
        set({
          conflictsDialogOpen: hasConflicts,
          conflictsDialogMinimized: false,
          activeTab: hasConflicts ? 'changes' : get().activeTab,
          notification: {
            id: Date.now(),
            title: hasConflicts
              ? (isZh ? '分支合并冲突 (Merge Conflicts)' : 'Merge Conflicts')
              : (isZh ? '分支合并失败 (Merge Failed)' : 'Merge Failed'),
            detail: hasConflicts
              ? (isZh ? '合并发生代码冲突，已自动为您打开冲突解决窗口。您可以进行三方可视化合并或放弃合并。' : data.message)
              : data.message,
            type: 'warning',
          },
        });
      }
      return data;
    } catch (e: any) {
      const errorMsg = e.message || (isZh ? '网络通信异常或请求超时' : 'Network error or request timeout');
      set({
        notification: {
          id: Date.now(),
          title: isZh ? '分支合并异常' : 'Merge Exception',
          detail: errorMsg,
          type: 'warning',
        },
      });
      return { success: false, message: errorMsg };
    } finally {
      set({ branchOperationLoading: null });
    }
  },

  checkMergeUndoStatus: async (repoPath?: string, activeBranch?: string) => {
    const targetPath = repoPath || get().projects.find((p) => p.id === get().activeProjectId)?.path;
    if (!targetPath) return null;
    try {
      const res = await fetch('/api/git/merge-undo-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: targetPath,
          activeBranch,
        }),
      });
      const data = await res.json();
      if (data && data.canUndo && data.preMergeHead) {
        const info = {
          repoPath: data.repoPath || targetPath,
          sourceBranch: data.sourceBranch,
          targetBranch: data.targetBranch,
          preMergeHead: data.preMergeHead,
          timestamp: data.timestamp || Date.now(),
        };
        set({ lastMergeUndoInfo: info });
        return info;
      }
      return null;
    } catch {
      return null;
    }
  },

  undoLastMerge: async (sourceBranch?: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    const isZh = state.language === 'zh-CN';
    const targetBranchName = sourceBranch || state.lastMergeUndoInfo?.sourceBranch;

    set({ branchOperationLoading: { type: 'merge', branchName: targetBranchName || 'undo' } });

    try {
      // 1. Resolve merge undo status dynamically from backend (handles crashes, restarts, and cache wipes)
      let preMergeHead = '';
      let detectedSource = targetBranchName || '';
      let detectedTarget = currentProject.currentBranch;

      const statusRes = await fetch('/api/git/merge-undo-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          activeBranch: targetBranchName,
        }),
      });
      const statusData = await statusRes.json();

      if (statusData && statusData.canUndo && statusData.preMergeHead) {
        preMergeHead = statusData.preMergeHead;
        detectedSource = statusData.sourceBranch || detectedSource;
        detectedTarget = statusData.targetBranch || detectedTarget;
      } else if (state.lastMergeUndoInfo?.preMergeHead) {
        preMergeHead = state.lastMergeUndoInfo.preMergeHead;
        detectedSource = state.lastMergeUndoInfo.sourceBranch || detectedSource;
        detectedTarget = state.lastMergeUndoInfo.targetBranch || detectedTarget;
      }

      if (!preMergeHead) {
        set({
          notification: {
            id: Date.now(),
            title: isZh ? '未检测到可撤销的合并' : 'No Merge to Undo',
            detail: isZh
              ? `当前分支 (${currentProject.currentBranch}) 最近未检测到合并 '${targetBranchName || ''}' 的记录，或已有后续新提交。为了代码安全，未执行回滚。`
              : `No recent merge from '${targetBranchName || ''}' detected on current branch, or newer commits exist.`,
            type: 'warning',
          },
        });
        return { success: false, message: 'No merge to undo' };
      }

      // 2. Perform safe reset to pre-merge commit
      const res = await fetch('/api/git/undo-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          preMergeHead,
        }),
      });
      const data = await res.json();
      if (data.success) {
        set({
          lastMergeUndoInfo: null,
          notification: {
            id: Date.now(),
            title: isZh ? '已撤销合并' : 'Merge Undone',
            detail: isZh
              ? `已成功撤销将 '${detectedSource}' 合并到 '${detectedTarget}' 的操作，分支已安全回滚至 (${preMergeHead.slice(0, 7)})`
              : data.message,
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
            title: isZh ? '撤销合并失败' : 'Failed to Undo Merge',
            detail: data.message,
            type: 'warning',
          },
        });
      }
      return data;
    } catch (e: any) {
      const errorMsg = e.message || (isZh ? '请求异常' : 'Request error');
      return { success: false, message: errorMsg };
    } finally {
      set({ branchOperationLoading: null });
    }
  },

  deleteBranch: async (branchName: string, force = false, isRemote = false) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    const isZh = get().language === 'zh-CN';
    const isActuallyRemote = Boolean(isRemote || branchName.startsWith('origin/') || branchName.includes('/'));

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
        // 1. Optimistically remove deleted branch at 0ms
        const normPath = currentProject.path.toLowerCase();
        set((curr) => ({
          branches: curr.branches.filter(
            (b) => b.name !== branchName && b.name !== `origin/${branchName}` && `origin/${b.name}` !== branchName
          ),
          notification: {
            id: Date.now(),
            title: isZh
              ? (isActuallyRemote ? `成功删除远程分支 '${branchName}'` : `成功删除分支 '${branchName}'`)
              : (isActuallyRemote ? `Deleted remote branch '${branchName}'` : `Deleted branch '${branchName}'`),
            detail: result.message || (isZh ? '分支已成功删除。' : 'Branch deleted successfully.'),
            type: 'success',
          },
        }));

        // 2. Sync snapshot cache & disk snapshot
        const cached = repoSnapshotCache.get(normPath);
        if (cached) {
          cached.branches = cached.branches.filter(
            (b) => b.name !== branchName && b.name !== `origin/${branchName}` && `origin/${b.name}` !== branchName
          );
          cached.lastUpdated = Date.now();
          saveLocalSnapshot(normPath, cached);
        }

        // 3. Force refresh in background (bypassing 15s TTL, non-blocking for instantaneous UI response)
        get().loadRepoData(currentProject.path, true).catch((e) => console.error('Background refresh failed', e));
        get().pollWorkspaceSyncStatus();
      } else {
        // Global error notification with exact Git output
        set({
          notification: {
            id: Date.now(),
            title: isZh
              ? (isActuallyRemote ? `删除远程分支 '${branchName}' 失败` : `删除分支 '${branchName}' 失败`)
              : (isActuallyRemote ? `Failed to delete remote branch '${branchName}'` : `Failed to delete branch '${branchName}'`),
            detail: result.message || (isZh ? '未知 Git 错误，请检查网络或分支保护规则。' : 'Unknown Git error.'),
            type: 'error',
          },
        });
      }
      return result;
    } catch (e: any) {
      const errorMsg = e.message || (isZh ? '网络异常或 Git 命令执行失败' : 'Failed to delete branch');
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

  // 4. Real Pull (Update Project)
  updateProject: async () => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return;

    const isZh = get().language === 'zh-CN';
    set({
      isBranchMenuOpen: false,
      branchOperationLoading: {
        operating: true,
        type: 'pull',
        branchName: currentProject.currentBranch,
        message: isZh ? '正在拉取远端更新 (git pull)...' : 'Pulling remote updates (git pull)...',
      },
      notification: {
        id: Date.now(),
        title: 'Updating Project...',
        detail: 'Running git pull from remote...',
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
        // 1. Instantly clear incoming count in active state (0ms latency!)
        const normPath = currentProject.path.toLowerCase();
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === currentProject.id ? { ...p, incoming: 0 } : p
          ),
          branches: state.branches.map((b) =>
            b.isCurrent || b.name === currentProject.currentBranch ? { ...b, incoming: 0 } : b
          ),
          notification: {
            id: Date.now(),
            title: 'Project Updated',
            detail: result.message || 'Already up to date.',
            linkText: 'View Commits',
            type: 'success',
          },
        }));

        // 2. Immediately update memory and disk cache snapshots
        const cached = repoSnapshotCache.get(normPath);
        if (cached) {
          cached.incoming = 0;
          cached.branches = cached.branches.map((b) =>
            b.isCurrent || b.name === currentProject.currentBranch ? { ...b, incoming: 0 } : b
          );
          cached.lastUpdated = Date.now();
          saveLocalSnapshot(normPath, cached);
        }

        // 3. Force-refresh status & commit logs (bypassing 15s TTL) and sync workspace
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        set({
          notification: {
            id: Date.now(),
            title: 'Update Notice',
            detail: result.message || 'Pull encountered an issue.',
            type: 'warning',
          },
        });
      }
    } catch (e: any) {
      alert(`Pull error: ${e.message}`);
    } finally {
      set({ branchOperationLoading: null });
    }
  },

  setNotification: (notif) => set({ notification: notif }),
  clearNotification: () => set({ notification: null }),

  // User & Author Filter Actions (Scoped to Workspace Projects' Git Accounts)
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
        const isZh = get().language === 'zh-CN';
        set((s) => ({
          gitUser: data.user,
          selectedAuthorNames: [
            data.user.name,
            ...s.selectedAuthorNames.filter((n) => n !== data.user.name),
          ],
          notification: {
            id: Date.now(),
            title: isZh ? `已切换 Git 身份为 ${data.user.name}` : `Switched Git author to ${data.user.name}`,
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

  // Git Log & Historical Version Control Actions
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

    const isZh = state.language === 'zh-CN';

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
            title: isZh ? 'Cherry-Pick 成功' : 'Cherry-Pick Succeeded',
            detail: isZh ? `已将提交 ${hash.slice(0, 7)} 成功合并到当前分支` : `Cherry-picked ${hash.slice(0, 7)} into current branch`,
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
              title: isZh ? 'Cherry-Pick 产生代码冲突' : 'Cherry-Pick Conflict',
              detail: isZh
                ? `提交 ${hash.slice(0, 7)} 存在冲突，已自动为您打开冲突解决器。您可以点击【解决冲突】三方合并，或点击【放弃】中止合并。`
                : `Cherry-pick of ${hash.slice(0, 7)} produced conflicts. The conflicts dialog has been opened.`,
              type: 'warning',
            },
          });
        } else {
          set({
            notification: {
              id: Date.now(),
              title: isZh ? 'Cherry-Pick 失败' : 'Cherry-Pick Failed',
              detail: data.message,
              type: 'warning',
            },
          });
        }
      }
      return data;
    } catch (e: any) {
      const errorMsg = e.message || (isZh ? '请求异常' : 'Request error');
      set({
        notification: {
          id: Date.now(),
          title: isZh ? 'Cherry-Pick 异常' : 'Cherry-Pick Error',
          detail: errorMsg,
          type: 'warning',
        },
      });
      return { success: false, message: errorMsg };
    }
  },


  // IntelliJ IDEA Style Branch Actions
  toggleBranchFavorite: (branchName: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return;

    const favKey = `omnigit_fav_branches_${currentProject.path}`;
    const updatedBranches = state.branches.map((b) =>
      b.name === branchName ? { ...b, isFavorite: !b.isFavorite } : b
    );
    const newFavs = updatedBranches.filter((b) => b.isFavorite).map((b) => b.name);
    safeLocalStorageSetItem(favKey, JSON.stringify(newFavs));
    set({ branches: updatedBranches });
  },

  renameBranch: async (oldName: string, newName: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    try {
      const res = await fetch('/api/git/rename-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, oldName, newName }),
      });
      const data = await res.json();
      if (data.success) {
        // 1. Optimistically rename branch at 0ms
        const normPath = currentProject.path.toLowerCase();
        set((curr) => ({
          branches: curr.branches.map((b) => (b.name === oldName ? { ...b, name: newName } : b)),
          projects: curr.projects.map((p) =>
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

        // 2. Sync snapshot cache & disk snapshot
        const cached = repoSnapshotCache.get(normPath);
        if (cached) {
          if (cached.currentBranch === oldName) cached.currentBranch = newName;
          cached.branches = cached.branches.map((b) => (b.name === oldName ? { ...b, name: newName } : b));
          cached.lastUpdated = Date.now();
          saveLocalSnapshot(normPath, cached);
        }

        // 3. Force refresh
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
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
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
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    const isZh = get().language === 'zh-CN';
    set({
      branchOperationLoading: {
        operating: true,
        type: 'rebase',
        branchName: branch,
        message: isZh ? `正在切换到 '${branch}' 并变基到 '${onto}'...` : `Checking out '${branch}' and rebasing onto '${onto}'...`,
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
        // 1. Optimistically switch branch at 0ms
        const normPath = currentProject.path.toLowerCase();
        set((curr) => ({
          projects: curr.projects.map((p) =>
            p.id === currentProject.id ? { ...p, currentBranch: branch } : p
          ),
          branches: curr.branches.map((b) => ({ ...b, isCurrent: b.name === branch })),
          notification: {
            id: Date.now(),
            title: 'Checkout & Rebase Succeeded',
            detail: `Checked out '${branch}' and rebased onto '${onto}'`,
            type: 'success',
          },
        }));

        // 2. Sync snapshot cache & disk snapshot
        const cached = repoSnapshotCache.get(normPath);
        if (cached) {
          cached.currentBranch = branch;
          cached.branches = cached.branches.map((b) => ({ ...b, isCurrent: b.name === branch }));
          cached.lastUpdated = Date.now();
          saveLocalSnapshot(normPath, cached);
        }

        // 3. Force refresh
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
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return { success: false, message: 'No active project' };

    const isZh = state.language === 'zh-CN';
    set({
      branchOperationLoading: {
        operating: true,
        type: 'update',
        branchName: branch,
        message: isZh ? `正在切换并更新分支 '${branch}'...` : `Checking out and updating branch '${branch}'...`,
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
        // 1. Optimistically switch branch and clear incoming count at 0ms
        const normPath = currentProject.path.toLowerCase();
        set((curr) => ({
          projects: curr.projects.map((p) =>
            p.id === currentProject.id ? { ...p, currentBranch: branch, incoming: 0 } : p
          ),
          branches: curr.branches.map((b) =>
            b.name === branch ? { ...b, isCurrent: true, incoming: 0 } : { ...b, isCurrent: false }
          ),
          notification: {
            id: Date.now(),
            title: 'Checkout & Update Succeeded',
            detail: `Switched to '${branch}' and updated from remote`,
            type: 'success',
          },
        }));

        // 2. Sync snapshot cache & disk snapshot
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

        // 3. Force refresh
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

  openPushModal: async (branchName?: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return;

    const target = branchName || currentProject.currentBranch;
    set({
      isPushModalOpen: true,
      pushModalTargetBranch: target,
      outgoingCommitsData: null,
      outgoingCommitsLoading: true,
      pushError: null,
      isBranchMenuOpen: false,
    });

    try {
      const res = await fetch(
        `/api/git/outgoing-commits?path=${encodeURIComponent(currentProject.path)}&branch=${encodeURIComponent(target)}`
      );
      const data: OutgoingCommitsData = await res.json();
      set({
        outgoingCommitsData: data,
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
      pushModalTargetBranch: null,
      pushError: null,
      pushingLoading: false,
    });
  },

  executePush: async (options?: { force?: boolean; tags?: boolean }) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    const targetBranch = get().pushModalTargetBranch || currentProject?.currentBranch || '';
    if (!currentProject || !targetBranch) {
      return { success: false, message: 'No active project or branch' };
    }

    set({ pushingLoading: true, pushError: null });

    try {
      const res = await fetch('/api/git/push-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          branch: targetBranch,
          force: options?.force,
          tags: options?.tags,
        }),
      });
      const data = await res.json();
      set({ pushingLoading: false });

      if (data.success) {
        // 1. Instantly clear outgoing count in active state (0ms latency!)
        set((state) => ({
          isPushModalOpen: false,
          projects: state.projects.map((p) =>
            p.id === currentProject.id ? { ...p, outgoing: 0 } : p
          ),
          branches: state.branches.map((b) =>
            b.name === targetBranch || b.isCurrent ? { ...b, outgoing: 0 } : b
          ),
          notification: {
            id: Date.now(),
            title: 'Push Succeeded',
            detail: data.message,
            type: 'success',
          },
        }));

        // 2. Immediately update cache snapshot & persist to disk
        const cached = repoSnapshotCache.get(currentProject.path.toLowerCase());
        if (cached) {
          cached.outgoing = 0;
          cached.branches = cached.branches.map((b) =>
            b.name === targetBranch || b.isCurrent ? { ...b, outgoing: 0 } : b
          );
          cached.lastUpdated = Date.now();
          saveLocalSnapshot(currentProject.path.toLowerCase(), cached);
        }

        // 3. Force-refresh status & commit logs (bypassing 15s TTL) and sync workspace
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        set({
          pushError: data.message,
          notification: {
            id: Date.now(),
            title: 'Push Failed',
            detail: data.message,
            type: 'warning',
          },
        });
      }
      return data;
    } catch (e: any) {
      set({ pushingLoading: false, pushError: e.message });
      return { success: false, message: e.message };
    }
  },

  pushBranch: async (branch: string) => {
    await get().openPushModal(branch);
    return { success: true, message: 'Opened Push dialog' };
  },

  checkoutTagOrRevision: async (target: string, newBranchName?: string) => {
    const state = get();
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
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
    const currentProject = state.projects.find((p) => p.id === state.activeProjectId);
    if (!currentProject) return;

    try {
      const res = await fetch(
        `/api/git/branch-working-diff?path=${encodeURIComponent(currentProject.path)}&branch=${encodeURIComponent(branch)}`
      );
      const data = await res.json();
      const isZh = get().language === 'zh-CN';
      set({
        isRightPanelOpen: true,
        historicalDiff: {
          original: '',
          modified: data.stdout || (isZh ? '(没有检测到与工作区的差异 / No diff with working tree)' : '(No diff with working tree)'),
          filePath: `Branch Diff: ${branch} vs Working Tree`,
          oldLabel: `Branch '${branch}'`,
          newLabel: isZh ? 'Working Tree (本地修改)' : 'Working Tree',
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

  openFileInEditor: async (filePath: string) => {
    if (!filePath) return;
    await get().setSelectedFile(filePath);
    set({ editorViewMode: 'editor', isRightPanelOpen: true });
    const isZh = get().language === 'zh-CN';
    get().setNotification({
      id: Date.now(),
      title: isZh ? '已在内部源码编辑器中打开' : 'Opened in Internal Editor',
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

    const isZh = get().language === 'zh-CN';

    // 1. Electron runtime bridge (when packaged as desktop client)
    if (typeof window !== 'undefined' && (window as any).electron?.shell?.openPath) {
      try {
        await (window as any).electron.shell.openPath(folderPath);
        get().setNotification({
          id: Date.now(),
          title: isZh ? '已打开所在文件夹' : 'Folder Opened',
          detail: isZh ? `${folderPath} (路径已复制)` : `${folderPath} (Path copied to clipboard)`,
          type: 'success',
        });
        return;
      } catch {}
    } else if (typeof window !== 'undefined' && (window as any).electron?.shell?.showItemInFolder) {
      (window as any).electron.shell.showItemInFolder(fullPath);
      get().setNotification({
        id: Date.now(),
        title: isZh ? '已打开所在文件夹' : 'Folder Opened',
        detail: isZh ? `${folderPath} (路径已复制)` : `${folderPath} (Path copied to clipboard)`,
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
          title: isZh ? '已打开所在文件夹' : 'Folder Opened',
          detail: isZh ? `${folderPath} (路径已复制)` : `${folderPath} (Path copied to clipboard)`,
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
          title: isZh ? '已打开所在文件夹' : 'Folder Opened',
          detail: isZh ? `${actualFolder} (路径已复制到剪贴板)` : `${actualFolder} (Path copied to clipboard)`,
          type: 'success',
        });
      } else {
        get().setNotification({
          id: Date.now(),
          title: isZh ? '打开文件夹失败' : 'Failed to Open Folder',
          detail: data.message || (isZh ? '未知错误' : 'Unknown error'),
          type: 'error',
        });
      }
    } catch (err: any) {
      get().setNotification({
        id: Date.now(),
        title: isZh ? '打开文件夹异常' : 'Open Folder Exception',
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

    const isZh = get().language === 'zh-CN';

    // 1. Electron 桌面容器调用
    if (typeof window !== 'undefined' && (window as any).electron?.shell?.openPath) {
      try {
        await (window as any).electron.shell.openPath(targetPath);
        get().setNotification({
          id: Date.now(),
          title: isZh ? '已打开项目文件夹' : 'Project Folder Opened',
          detail: isZh ? `${targetPath} (路径已复制到剪贴板)` : `${targetPath} (Path copied to clipboard)`,
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
          title: isZh ? '已打开项目文件夹' : 'Project Folder Opened',
          detail: isZh ? `${targetPath} (路径已复制到剪贴板)` : `${targetPath} (Path copied to clipboard)`,
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
          title: isZh ? '已打开项目所在文件夹' : 'Project Folder Opened',
          detail: isZh ? `${actualFolder} (路径已复制到剪贴板)` : `${actualFolder} (Path copied to clipboard)`,
          type: 'success',
        });
      } else {
        get().setNotification({
          id: Date.now(),
          title: isZh ? '打开项目文件夹失败' : 'Failed to Open Project Folder',
          detail: data.message || (isZh ? '未知错误' : 'Unknown error'),
          type: 'error',
        });
      }
    } catch (err: any) {
      get().setNotification({
        id: Date.now(),
        title: isZh ? '打开项目文件夹异常' : 'Open Project Folder Exception',
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
        const isZh = get().language === 'zh-CN';
        get().setNotification({
          id: Date.now(),
          title: isZh ? '已暂存更改 (Staged)' : 'Changes Staged',
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
        const isZh = get().language === 'zh-CN';
        get().setNotification({
          id: Date.now(),
          title: isZh ? '已取消暂存 (Unstaged)' : 'Changes Unstaged',
          detail: filePath,
          type: 'info',
        });
        await get().loadRepoData(currentProject.path, true);
      }
    } catch (e: any) {
      console.error('Failed to unstage file:', e);
    }
  },

  // 3-Way Merge & Conflict Resolution Actions (IDEA Style)
  openThreeWayMerge: async (filePath: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject || !filePath) return;

    // 1. Immediately pop up the modal window with loading state (0ms perceived latency!)
    set({
      threeWayMergeOpen: true,
      threeWayMergeMinimized: false,
      threeWayLoading: true,
      threeWayData: null,
      conflictsDialogOpen: false,
    });

    try {
      const res = await fetch('/api/git/conflict-3way', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, file: filePath }),
      });
      const data: Conflict3WayData = await res.json();
      set({
        threeWayData: data,
        threeWayLoading: false,
      });
    } catch (e: any) {
      set({ threeWayMergeOpen: false, threeWayLoading: false });
      const isZh = get().language === 'zh-CN';
      get().setNotification({
        id: Date.now(),
        title: isZh ? '无法加载三方合并数据' : 'Failed to Load 3-Way Merge Data',
        detail: e.message,
        type: 'warning',
      });
    }
  },

  resolveConflictQuick: async (filePath: string, resolution: 'yours' | 'theirs') => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject || !filePath) return;

    try {
      const res = await fetch('/api/git/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          file: filePath,
          resolution,
        }),
      });
      const data = await res.json();

      if (data.success) {
        const isZh = get().language === 'zh-CN';
        get().setNotification({
          id: Date.now(),
          title: resolution === 'yours'
            ? (isZh ? '已接受本地版本 (Accept Yours)' : 'Accepted Local Version (Yours)')
            : (isZh ? '已接受传入版本 (Accept Theirs)' : 'Accepted Incoming Version (Theirs)'),
          detail: filePath,
          type: 'success',
        });
        await get().loadRepoData(currentProject.path, true);
        get().pollWorkspaceSyncStatus();

        // Check if any conflicts remain
        const remainingConflicts = get().files.filter((f) => f.status === 'conflict');
        if (remainingConflicts.length === 0) {
          set({ conflictsDialogOpen: false });
        }
      } else {
        const isZh = get().language === 'zh-CN';
        get().setNotification({
          id: Date.now(),
          title: isZh ? '冲突解决失败' : 'Conflict Resolution Failed',
          detail: data.message,
          type: 'warning',
        });
      }
    } catch (e: any) {
      console.error('Failed to resolve conflict:', e);
    }
  },

  resolveAllConflictsQuick: async (resolution: 'yours' | 'theirs') => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return;

    const conflictFiles = get().files.filter((f) => f.status === 'conflict');
    for (const f of conflictFiles) {
      await fetch('/api/git/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          file: f.path,
          resolution,
        }),
      });
    }

    const isZh = get().language === 'zh-CN';
    get().setNotification({
      id: Date.now(),
      title: resolution === 'yours'
        ? (isZh ? '全部采用本地版本完成' : 'All Accepted Local (Yours)')
        : (isZh ? '全部采用传入版本完成' : 'All Accepted Incoming (Theirs)'),
      detail: isZh ? `已批量解决 ${conflictFiles.length} 个冲突文件` : `Resolved ${conflictFiles.length} conflicted files`,
      type: 'success',
    });

    await get().loadRepoData(currentProject.path, true);
    get().pollWorkspaceSyncStatus();
    set({ conflictsDialogOpen: false });
  },

  applyThreeWayMergeResult: async (filePath: string, finalContent: string): Promise<boolean> => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject || !filePath) return false;

    try {
      const res = await fetch('/api/git/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentProject.path,
          file: filePath,
          resolution: 'content',
          content: finalContent,
        }),
      });
      const data = await res.json();

      if (data.success) {
        // 1. Immediately close the modal window! Zero waiting time!
        set({ threeWayMergeOpen: false, threeWayData: null, threeWayLoading: false });
        const isZh = get().language === 'zh-CN';
        get().setNotification({
          id: Date.now(),
          title: isZh ? '三方合并应用成功并已标记解决' : '3-Way Merge Applied & Resolved',
          detail: filePath,
          type: 'success',
        });

        // 2. Perform background repo status refresh non-blockingly (bypassing 15s TTL)
        get().loadRepoData(currentProject.path, true).then(() => {
          get().pollWorkspaceSyncStatus();
          const remainingConflicts = get().files.filter((f) => f.status === 'conflict');
          if (remainingConflicts.length === 0) {
            set({ conflictsDialogOpen: false });
          }
        });
        return true;
      } else {
        const isZh = get().language === 'zh-CN';
        alert(data.message || (isZh ? '合并失败' : 'Merge failed'));
        return false;
      }
    } catch (e: any) {
      const isZh = get().language === 'zh-CN';
      alert(isZh ? `合并错误: ${e.message}` : `Merge error: ${e.message}`);
      return false;
    }
  },

  abortCurrentMerge: async () => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return;

    try {
      const res = await fetch('/api/git/abort-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path }),
      });
      const data = await res.json();

      const isZh = get().language === 'zh-CN';
      set({
        conflictsDialogOpen: false,
        threeWayMergeOpen: false,
        threeWayData: null,
        notification: {
          id: Date.now(),
          title: data.success
            ? (isZh ? '已放弃合并' : 'Merge Aborted')
            : (isZh ? '放弃合并失败' : 'Failed to Abort Merge'),
          detail: data.message,
          type: data.success ? 'info' : 'warning',
        },
      });
      await get().loadRepoData(currentProject.path, true);
      await get().fetchCommitLogs(true);
      get().pollWorkspaceSyncStatus();
    } catch (e: any) {
      console.error('Failed to abort merge:', e);
    }
  },

  completeMergeCommit: async (customMsg?: string) => {
    const currentProject = get().projects.find((p) => p.id === get().activeProjectId);
    if (!currentProject) return;

    try {
      const message = customMsg || get().mergeMessage || get().commitMessage || 'Merge conflicts resolved';
      const res = await fetch('/api/git/complete-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentProject.path, message }),
      });
      const data = await res.json();

      const isZh = get().language === 'zh-CN';
      if (data.success) {
        set({
          commitMessage: '',
          isMerging: false,
          notification: {
            id: Date.now(),
            title: isZh ? '合并完成并提交成功' : 'Merge Completed & Committed',
            detail: message,
            type: 'success',
          },
        });
        await get().loadRepoData(currentProject.path, true);
        await get().fetchCommitLogs(true);
        get().pollWorkspaceSyncStatus();
      } else {
        get().setNotification({
          id: Date.now(),
          title: isZh ? '完成合并提交失败' : 'Failed to Complete Merge Commit',
          detail: data.message,
          type: 'warning',
        });
      }
    } catch (e: any) {
      console.error('Failed to complete merge:', e);
    }
  },

  pollWorkspaceSyncStatus: async () => {
    if (isPollingBatchSync) return;
    const state = get();
    const paths = state.workspaceProjectPaths.length > 0
      ? state.workspaceProjectPaths
      : state.projects.map((p) => p.path);
    if (!paths || paths.length === 0) return;

    isPollingBatchSync = true;
    try {
      const res = await fetch('/api/git/batch-sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths }),
      });
      if (!res.ok) return;
      const statuses: Array<{ path: string; currentBranch: string; upstream?: string; incoming: number; outgoing: number }> = await res.json();
      if (!Array.isArray(statuses)) return;

      // Keep all cached repo branches and counters fresh without triggering disk status scans
      statuses.forEach((s) => {
        const cached = repoSnapshotCache.get(s.path.toLowerCase());
        if (cached) {
          cached.currentBranch = s.currentBranch || cached.currentBranch;
          if (s.upstream !== undefined) cached.upstream = s.upstream;
          cached.incoming = s.incoming;
          cached.outgoing = s.outgoing;
        }
      });

      set((curr) => {
        let hasChanged = false;
        const updatedProjects = curr.projects.map((p) => {
          const match = statuses.find((s) => s.path.toLowerCase() === p.path.toLowerCase());
          if (match) {
            const isDiff =
              (match.currentBranch && match.currentBranch !== p.currentBranch) ||
              (match.upstream !== undefined && match.upstream !== p.upstream) ||
              match.incoming !== p.incoming ||
              match.outgoing !== p.outgoing;
            if (isDiff) {
              hasChanged = true;
              return {
                ...p,
                currentBranch: match.currentBranch || p.currentBranch,
                upstream: match.upstream !== undefined ? match.upstream : p.upstream,
                incoming: match.incoming,
                outgoing: match.outgoing,
              };
            }
          }
          return p;
        });

        if (!hasChanged) {
          return {}; // Do not trigger store change if nothing changed
        }

        return {
          projects: updatedProjects,
        };
      });
    } catch {
      // Quietly ignore background poll error
    } finally {
      isPollingBatchSync = false;
    }
  },
}));
