import { create } from 'zustand';

export type WorkbenchMode = 'git' | 'explorer';

interface WorkbenchState {
  workbenchMode: WorkbenchMode;
  setWorkbenchMode: (mode: WorkbenchMode) => void;
  toggleWorkbenchMode: () => void;
}

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  workbenchMode:
    (typeof window !== 'undefined' &&
      (localStorage.getItem('omnigit_workbench_mode') as WorkbenchMode)) ||
    'git',

  setWorkbenchMode: (mode: WorkbenchMode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('omnigit_workbench_mode', mode);
    }
    set({ workbenchMode: mode });
  },

  toggleWorkbenchMode: () => {
    const next = get().workbenchMode === 'git' ? 'explorer' : 'git';
    get().setWorkbenchMode(next);
  },
}));
