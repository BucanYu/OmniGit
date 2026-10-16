import { create } from 'zustand';
import { useAppStore } from '../../store/useAppStore';

export interface SearchResultItem {
  filePath: string;
  relativePath: string;
  fileName: string;
  lineNumber: number;
  lineContent: string;
  matchStart?: number;
  matchLength?: number;
  isFileNameMatch?: boolean;
  repoPath: string;
  repoName: string;
  // Backward compatibility aliases
  file: string;
  line: number;
  column?: number;
  text: string;
  matchEnd?: number;
}

export interface SearchGroupedFile {
  filePath: string;
  relativePath: string;
  fileName: string;
  repoPath: string;
  repoName: string;
  matches: SearchResultItem[];
}

interface GlobalSearchState {
  isOpen: boolean;
  query: string;
  isCaseSensitive: boolean;
  isWholeWord: boolean;
  isRegex: boolean;
  filePattern: string;
  searchScope: 'all' | 'current';

  isSearching: boolean;
  results: SearchResultItem[];
  groupedResults: SearchGroupedFile[];
  totalMatches: number;
  selectedMatchIndex: number;

  openSearchModal: (initialQuery?: string) => void;
  closeSearchModal: () => void;
  setQuery: (q: string) => void;
  setIsCaseSensitive: (v: boolean) => void;
  setIsWholeWord: (v: boolean) => void;
  setIsRegex: (v: boolean) => void;
  setFilePattern: (v: string) => void;
  setSearchScope: (scope: 'all' | 'current') => void;
  setSelectedMatchIndex: (idx: number) => void;
  executeSearch: () => Promise<void>;
}

let searchDebounceTimer: NodeJS.Timeout | null = null;

export const useGlobalSearchStore = create<GlobalSearchState>((set, get) => ({
  isOpen: false,
  query: '',
  isCaseSensitive: false,
  isWholeWord: false,
  isRegex: false,
  filePattern: '',
  searchScope: 'all',

  isSearching: false,
  results: [],
  groupedResults: [],
  totalMatches: 0,
  selectedMatchIndex: -1,

  openSearchModal: (initialQuery?: string) => {
    const nextQuery = initialQuery !== undefined ? initialQuery.trim() : get().query;
    set({
      isOpen: true,
      query: nextQuery,
      selectedMatchIndex: -1,
    });
    if (nextQuery) {
      get().executeSearch();
    }
  },

  closeSearchModal: () => {
    set({ isOpen: false });
  },

  setQuery: (q: string) => {
    set({ query: q });
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    searchDebounceTimer = setTimeout(() => {
      get().executeSearch();
    }, 280);
  },

  setIsCaseSensitive: (v: boolean) => {
    set({ isCaseSensitive: v });
    get().executeSearch();
  },

  setIsWholeWord: (v: boolean) => {
    set({ isWholeWord: v });
    get().executeSearch();
  },

  setIsRegex: (v: boolean) => {
    set({ isRegex: v });
    get().executeSearch();
  },

  setFilePattern: (v: string) => {
    set({ filePattern: v });
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    searchDebounceTimer = setTimeout(() => {
      get().executeSearch();
    }, 350);
  },

  setSearchScope: (scope: 'all' | 'current') => {
    set({ searchScope: scope });
    get().executeSearch();
  },

  setSelectedMatchIndex: (idx: number) => {
    set({ selectedMatchIndex: idx });
  },

  executeSearch: async () => {
    const { query, isCaseSensitive, isWholeWord, isRegex, filePattern, searchScope } = get();
    if (!query.trim()) {
      set({ results: [], groupedResults: [], totalMatches: 0, selectedMatchIndex: -1, isSearching: false });
      return;
    }

    set({ isSearching: true });

    try {
      const appState = useAppStore.getState();
      const allProjects = appState.projects;
      const activeProjectId = appState.activeProjectId;

      let targetRepos: Array<{ path: string; name: string }> = [];
      if (searchScope === 'current') {
        const curr = allProjects.find((p) => p.id === activeProjectId) || allProjects[0];
        if (curr) {
          targetRepos = [{ path: curr.path, name: curr.name }];
        }
      } else {
        targetRepos = allProjects.map((p) => ({ path: p.path, name: p.name }));
      }

      if (targetRepos.length === 0) {
        set({ isSearching: false, results: [], groupedResults: [], totalMatches: 0, selectedMatchIndex: -1 });
        return;
      }

      const res = await fetch('/api/fs/search-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repos: targetRepos,
          query,
          options: {
            isCaseSensitive,
            isWholeWord,
            isRegex,
            filePattern: filePattern.trim() || undefined,
            maxResults: 300,
          },
        }),
      });

      const data = await res.json();
      const rawMatches: any[] = data.matches || [];

      // Normalize match fields safely
      const matches: SearchResultItem[] = rawMatches.map((m) => {
        const relPath = (m.relativePath || m.file || '').replace(/\\/g, '/');
        const repoP = (m.repoPath || '').replace(/\\/g, '/');
        const full = (m.filePath ? m.filePath.replace(/\\/g, '/') : `${repoP}/${relPath}`);
        const fName = m.fileName || relPath.split('/').pop() || full.split('/').pop() || '';
        const lineNum = m.lineNumber ?? m.line ?? 1;
        const textContent = m.lineContent ?? m.text ?? '';
        const mLen = m.matchLength ?? (m.matchEnd !== undefined && m.matchStart !== undefined ? m.matchEnd - m.matchStart : query.length);

        return {
          filePath: full,
          relativePath: relPath,
          fileName: fName,
          lineNumber: lineNum,
          lineContent: textContent,
          matchStart: m.matchStart ?? 0,
          matchLength: mLen,
          isFileNameMatch: !!m.isFileNameMatch,
          repoPath: repoP,
          repoName: m.repoName || '',
          file: relPath,
          line: lineNum,
          column: m.column,
          text: textContent,
          matchEnd: (m.matchStart ?? 0) + mLen,
        };
      });

      // Group matches by file
      const groupsMap = new Map<string, SearchGroupedFile>();
      for (const m of matches) {
        const full = m.filePath;
        if (!groupsMap.has(full)) {
          groupsMap.set(full, {
            filePath: full,
            relativePath: m.relativePath,
            fileName: m.fileName,
            repoPath: m.repoPath,
            repoName: m.repoName,
            matches: [],
          });
        }
        groupsMap.get(full)!.matches.push(m);
      }

      const groupedResults = Array.from(groupsMap.values());
      set({
        isSearching: false,
        results: matches,
        groupedResults,
        totalMatches: matches.length,
        selectedMatchIndex: matches.length > 0 ? 0 : -1,
      });
    } catch (err) {
      console.error('[GlobalSearch] Search failed:', err);
      set({ isSearching: false, results: [], groupedResults: [], totalMatches: 0, selectedMatchIndex: -1 });
    }
  },
}));
