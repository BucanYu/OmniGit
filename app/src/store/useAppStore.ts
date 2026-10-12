import { create } from 'zustand';
export * from './types';
export * from './storeHelpers';

import type { AppState } from './types';
import { createLayoutSlice } from './slices/layoutSlice';
import { createWorkspaceSlice } from './slices/workspaceSlice';
import { createGitStatusSlice } from './slices/gitStatusSlice';
import { createGitBranchSlice } from './slices/gitBranchSlice';
import { createGitLogSlice } from './slices/gitLogSlice';
import { createGitConflictSlice } from './slices/gitConflictSlice';

export const useAppStore = create<AppState>((set, get) => ({
  ...createLayoutSlice(set, get),
  ...createWorkspaceSlice(set, get),
  ...createGitStatusSlice(set, get),
  ...createGitBranchSlice(set, get),
  ...createGitLogSlice(set, get),
  ...createGitConflictSlice(set, get),
}));
