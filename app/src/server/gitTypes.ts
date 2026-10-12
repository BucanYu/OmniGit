export interface CloneProgressEvent {
  phase: 'counting' | 'compressing' | 'receiving' | 'resolving' | 'checkout' | 'completing' | 'unknown';
  phaseText: string;
  percent: number;
  stagePercent?: number;
  transferred?: string;
  speed?: string;
  objects?: string;
  raw: string;
}

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

export interface RealGitFile {
  path: string;
  fileName: string;
  dirPath: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'conflict';
  group: 'changes' | 'unversioned' | 'conflict';
  checked: boolean;
}

export interface RealBranchInfo {
  name: string;
  isCurrent: boolean;
  isFavorite: boolean;
  upstream?: string;
  incoming: number;
  outgoing: number;
  category: 'recent' | 'local' | 'remote';
}

export interface RealRepoStatus {
  repoPath: string;
  repoName: string;
  currentBranch: string;
  upstream?: string;
  incoming: number;
  outgoing: number;
  files: RealGitFile[];
  isMerging?: boolean;
  mergeMessage?: string;
  mergeSourceBranch?: string;
  conflictedCount?: number;
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

export interface PushBranchOptions {
  branch: string;
  targetBranch?: string;
  targetCommit?: string;
  force?: boolean;
  tags?: boolean;
  setUpstream?: boolean;
}

export interface SelectivePushOptions {
  hashes: string[];
  sourceBranch?: string;
  targetBranch: string;
  remote?: string;
  createNewBranch?: boolean;
  newBranchName?: string;
  force?: boolean;
}

export interface SyncCommitsOptions {
  hashes: string[];
  targetBranch: string;
  remote?: string;
  pushToRemote?: boolean;
}

export interface OmniGitSettings {
  cacheDir: string;
  maxCacheRepos: number;
  cacheTTL: number;
}
