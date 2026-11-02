import { decodeGitPath, splitGitPath } from '../utils/gitPathUtils';
import {
  hasGitConflictMarkers,
  type CloneProgressEvent,
} from './git/gitExec';
import { gitStatusIdentityOps } from './git/gitStatusIdentityOps';
import { gitLogHistoryOps } from './git/gitLogHistoryOps';
import { gitBranchPushOps } from './git/gitBranchPushOps';
import { gitMergeConflictOps } from './git/gitMergeConflictOps';
import { gitWorkspaceCloneOps } from './git/gitWorkspaceCloneOps';
import { gitBatchStashBlameOps } from './git/gitBatchStashBlameOps';

export { decodeGitPath, splitGitPath, hasGitConflictMarkers };
export type { CloneProgressEvent };
export * from './gitTypes';

export const gitService = {
  ...gitStatusIdentityOps,
  ...gitLogHistoryOps,
  ...gitBranchPushOps,
  ...gitMergeConflictOps,
  ...gitWorkspaceCloneOps,
  ...gitBatchStashBlameOps,
};
