import { create } from 'zustand';
import { useAppStore } from '../../store/useAppStore';

export interface TerminalSession {
  id: string;
  name: string;
  shell: string;
  cwd: string;
  projectId?: string;
  projectName?: string;
  createdAt: number;
}

export interface AvailableShell {
  id: string;
  name: string;
  path: string;
  args?: string[];
}

interface TerminalState {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  isTerminalOpen: boolean;
  terminalHeight: number;
  isMaximized: boolean;
  availableShells: AvailableShell[];

  // Actions
  setTerminalOpen: (open: boolean) => void;
  toggleTerminal: () => void;
  setTerminalHeight: (height: number) => void;
  setIsMaximized: (maximized: boolean) => void;
  toggleMaximized: () => void;
  loadAvailableShells: () => Promise<void>;
  createSession: (options?: {
    shell?: string;
    cwd?: string;
    projectId?: string;
    projectName?: string;
  }) => Promise<string>;
  closeSession: (id: string) => Promise<void>;
  setActiveSessionId: (id: string) => void;
  renameSession: (id: string, newName: string) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isTerminalOpen: false,
  terminalHeight:
    typeof window !== 'undefined'
      ? Math.max(160, Math.min(600, parseInt(localStorage.getItem('omnigit_terminal_height') || '260', 10)))
      : 260,
  isMaximized: false,
  availableShells: [],

  setTerminalOpen: (open: boolean) => {
    set({ isTerminalOpen: open });
    if (open && get().sessions.length === 0) {
      get().createSession();
    }
  },

  toggleTerminal: () => {
    const next = !get().isTerminalOpen;
    get().setTerminalOpen(next);
  },

  setTerminalHeight: (height: number) => {
    const clamped = Math.max(140, Math.min(typeof window !== 'undefined' ? window.innerHeight - 150 : 700, height));
    if (typeof window !== 'undefined') {
      localStorage.setItem('omnigit_terminal_height', String(clamped));
    }
    set({ terminalHeight: clamped });
  },

  setIsMaximized: (maximized: boolean) => set({ isMaximized: maximized }),

  toggleMaximized: () => set((state) => ({ isMaximized: !state.isMaximized })),

  loadAvailableShells: async () => {
    if (window.electronAPI?.terminal?.getShells) {
      try {
        const shells = await window.electronAPI.terminal.getShells();
        set({ availableShells: shells });
      } catch (err) {
        console.warn('[Terminal] Failed to get shells:', err);
      }
    }
  },

  createSession: async (options) => {
    const appState = useAppStore.getState();
    const activeProject = appState.projects.find((p) => p.id === appState.activeProjectId);

    const projectId = options?.projectId || activeProject?.id || '';
    const projectName = options?.projectName || activeProject?.name || '';
    const cwd = options?.cwd || activeProject?.path || '';

    const id = `term_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const shellName = options?.shell ? options.shell.split(/[\\/]/).pop()?.replace(/\.exe$/i, '') : 'PowerShell';
    const sessionName = projectName ? `${shellName} (${projectName})` : shellName || 'Terminal';

    const newSession: TerminalSession = {
      id,
      name: sessionName,
      shell: options?.shell || '',
      cwd,
      projectId,
      projectName,
      createdAt: Date.now(),
    };

    set((state) => ({
      sessions: [...state.sessions, newSession],
      activeSessionId: id,
      isTerminalOpen: true,
    }));

    // Electron PTY spawn
    if (window.electronAPI?.terminal?.spawn) {
      try {
        await window.electronAPI.terminal.spawn({
          id,
          shell: options?.shell,
          cwd,
          cols: 80,
          rows: 24,
        });
      } catch (err) {
        console.error('[Terminal] Failed to spawn terminal session:', err);
      }
    }

    return id;
  },

  closeSession: async (id: string) => {
    const { sessions, activeSessionId } = get();
    const filtered = sessions.filter((s) => s.id !== id);

    if (window.electronAPI?.terminal?.kill) {
      try {
        await window.electronAPI.terminal.kill(id);
      } catch {}
    }

    let nextActive = activeSessionId;
    if (activeSessionId === id) {
      nextActive = filtered.length > 0 ? filtered[filtered.length - 1].id : null;
    }

    set({
      sessions: filtered,
      activeSessionId: nextActive,
      isTerminalOpen: filtered.length > 0 ? get().isTerminalOpen : false,
      isMaximized: filtered.length > 0 ? get().isMaximized : false,
    });
  },

  setActiveSessionId: (id: string) => set({ activeSessionId: id }),

  renameSession: (id: string, newName: string) => {
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, name: newName } : s)),
    }));
  },
}));
