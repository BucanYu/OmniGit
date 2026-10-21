import type { OutgoingCommitFile, OutgoingCommitItem } from '../../store/useAppStore';

export interface FileTreeNode {
  name: string;
  fullPath: string;
  isDirectory: boolean;
  fileCount: number;
  file?: OutgoingCommitFile;
  children: Map<string, FileTreeNode>;
}

export interface CommitContextMenuState {
  x: number;
  y: number;
  commit: OutgoingCommitItem;
}

export interface FileContextMenuState {
  x: number;
  y: number;
  file: OutgoingCommitFile;
  commitHash: string;
}

export interface SelectiveModalState {
  isOpen: boolean;
  hashes: string[];
  mode: 'target' | 'patch';
  targetBranch: string;
  patchBranchName: string;
}

export interface DiffModalState {
  isOpen: boolean;
  filePath: string;
  commitHash: string;
  commitMessage?: string;
}
