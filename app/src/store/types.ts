import { getLocale, type AppLanguage } from '../locales';

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
  alreadyResolved?: boolean;
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
  isMerge?: boolean;
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
  lastActiveProjectPath?: string;
}

export interface RecentProjectItem {
  name: string;
  path: string;
  branch?: string;
  lastOpened: number;
  badgeColor?: string;
}

export interface AppState {
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
  loadSavedWorkspaces: () => Promise<WorkspaceGroupItem[]>;
  saveWorkspaceRecord: (ws: WorkspaceGroupItem) => void;
  removeSavedWorkspace: (id: string) => void;
  renameSavedWorkspace: (id: string, newName: string) => void;
  openWorkspaceGroup: (ws: WorkspaceGroupItem, inNewWindow?: boolean) => Promise<void>;
  createWorkspaceFromFolder: (folderPath: string) => Promise<WorkspaceGroupItem | null>;
  syncCurrentWorkspaceToSaved: (activePathOverride?: string) => void;

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
  markConflictResolved: (filePath: string) => Promise<void>;
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
  toggleGroupCollapsed: (group: 'changes' | 'unversioned' | 'conflicts') => void;
  setViewStyle: (style: 'flat' | 'tree') => void;
  setIsAmend: (isAmend: boolean) => void;
  setCommitMessage: (msg: string) => void;
  setIsBranchMenuOpen: (open: boolean) => void;

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
  checkMergeUndoStatus: (repoPath?: string, activeBranch?: string) => Promise<any>;
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
  pushModalSourceBranch: string | null;
  pushModalTargetBranch: string | null;
  outgoingCommitsData: OutgoingCommitsData | null;
  outgoingCommitsLoading: boolean;
  pushingLoading: boolean;
  pushError: string | null;
  openPushModal: (branchName?: string, targetBranchName?: string) => Promise<void>;
  prefetchOutgoingCommits: (repoPath?: string, branchName?: string, targetBranchName?: string) => void;
  closePushModal: () => void;
  switchPushSourceBranch: (sourceBranch: string, targetBranch?: string) => Promise<void>;
  executePush: (options?: { force?: boolean; tags?: boolean; targetCommit?: string; targetBranch?: string }) => Promise<{ success: boolean; message: string }>;
  pushSelectedCommits: (options: {
    hashes: string[];
    targetBranch: string;
    createNewBranch?: boolean;
    newBranchName?: string;
    force?: boolean;
  }) => Promise<{ success: boolean; message: string; isConflict?: boolean }>;
  syncCommitsToBranch: (options: {
    hashes: string[];
    targetBranch: string;
    pushToRemote?: boolean;
  }) => Promise<{ success: boolean; message: string; isConflict?: boolean }>;

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

// Path normalization helper: handles backslashes vs slashes, trailing slashes, and Windows drive letter casing
