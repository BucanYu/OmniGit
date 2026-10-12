import { create } from 'zustand';

export interface EditorTabItem {
  id: string;
  filePath: string;
  relativePath: string;
  fileName: string;
  repoPath: string;
  repoName: string;
  content: string;
  originalContent: string;
  encoding: string;
  eol: 'CRLF' | 'LF';
  isDirty: boolean;
  language: string;
  isBinary?: boolean;
}

export function getLanguageFromPath(filePath: string): string {
  const base = filePath.split(/[\\/]/).pop()?.toLowerCase() || '';
  if (base.startsWith('.env')) return 'shell';
  if (base === 'dockerfile') return 'dockerfile';

  const ext = base.split('.').pop() || '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'scss':
    case 'sass':
      return 'scss';
    case 'less':
      return 'less';
    case 'html':
    case 'htm':
    case 'vue':
      return 'html';
    case 'py':
      return 'python';
    case 'go':
      return 'go';
    case 'rs':
      return 'rust';
    case 'java':
    case 'kt':
    case 'kts':
      return 'java';
    case 'c':
    case 'h':
    case 'cpp':
    case 'hpp':
    case 'cc':
      return 'cpp';
    case 'cs':
      return 'csharp';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'xml':
    case 'svg':
      return 'xml';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'bat':
    case 'cmd':
      return 'bat';
    case 'ps1':
      return 'powershell';
    case 'sql':
      return 'sql';
    case 'php':
      return 'php';
    default:
      return 'plaintext';
  }
}

interface EditorTabsState {
  tabs: EditorTabItem[];
  activeTabId: string | null;

  openFileTab: (params: {
    filePath: string;
    repoPath: string;
    relativePath: string;
    repoName: string;
  }) => Promise<string>;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  setActiveTabId: (id: string) => void;
  updateTabContent: (id: string, newContent: string) => void;
  saveTab: (id: string) => Promise<boolean>;
}

export const useEditorTabsStore = create<EditorTabsState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openFileTab: async ({ filePath, repoPath, relativePath, repoName }) => {
    const { tabs } = get();
    // Normalize path for lookup
    const normTarget = filePath.replace(/\\/g, '/').toLowerCase();
    const existing = tabs.find((t) => t.filePath.replace(/\\/g, '/').toLowerCase() === normTarget);

    if (existing) {
      set({ activeTabId: existing.id });
      return existing.id;
    }

    const id = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fileName = filePath.split(/[\\/]/).pop() || 'Untitled';
    const language = getLanguageFromPath(filePath);

    // Read content from backend API
    try {
      const res = await fetch(`/api/fs/read?filePath=${encodeURIComponent(filePath)}`);
      const data = await res.json();

      const newTab: EditorTabItem = {
        id,
        filePath,
        relativePath,
        fileName,
        repoPath,
        repoName,
        content: data.content || '',
        originalContent: data.content || '',
        encoding: data.encoding || 'utf-8',
        eol: data.eol || 'LF',
        isDirty: false,
        language,
        isBinary: Boolean(data.isBinary),
      };

      set((state) => ({
        tabs: [...state.tabs, newTab],
        activeTabId: id,
      }));

      return id;
    } catch (err) {
      console.error('[EditorTabs] Failed to read file:', err);
      return '';
    }
  },

  closeTab: (id: string) => {
    const { tabs, activeTabId } = get();
    const targetIdx = tabs.findIndex((t) => t.id === id);
    if (targetIdx === -1) return;

    const filtered = tabs.filter((t) => t.id !== id);
    let nextActive = activeTabId;

    if (activeTabId === id) {
      if (filtered.length > 0) {
        // Select nearest neighbor
        const nextIdx = Math.min(targetIdx, filtered.length - 1);
        nextActive = filtered[nextIdx].id;
      } else {
        nextActive = null;
      }
    }

    set({ tabs: filtered, activeTabId: nextActive });
  },

  closeOtherTabs: (id: string) => {
    set((state) => ({
      tabs: state.tabs.filter((t) => t.id === id),
      activeTabId: id,
    }));
  },

  closeAllTabs: () => {
    set({ tabs: [], activeTabId: null });
  },

  setActiveTabId: (id: string) => set({ activeTabId: id }),

  updateTabContent: (id: string, newContent: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            content: newContent,
            isDirty: newContent !== t.originalContent,
          };
        }
        return t;
      }),
    }));
  },

  saveTab: async (id: string) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return false;

    try {
      const res = await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: tab.filePath,
          content: tab.content,
          encoding: tab.encoding,
          eol: tab.eol,
        }),
      });
      const data = await res.json();
      if (data && data.success) {
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, originalContent: t.content, isDirty: false } : t)),
        }));
        return true;
      }
      return false;
    } catch (err) {
      console.error('[EditorTabs] Save failed:', err);
      return false;
    }
  },
}));
