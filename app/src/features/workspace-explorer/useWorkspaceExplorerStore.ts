import { create } from 'zustand';

export interface FileTreeNodeItem {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
}

interface WorkspaceExplorerState {
  expandedDirs: Set<string>;
  dirChildren: Record<string, FileTreeNodeItem[]>;
  loadingDirs: Set<string>;
  selectedNodePath: string | null;
  locateHighlightTimestamp: number;
  isLocating: boolean;

  toggleExpandDir: (repoPath: string, subDir?: string, autoExpandDepth?: number) => Promise<void>;
  ensureDirExpanded: (repoPath: string, subDir?: string) => Promise<void>;
  locateFile: (repoPath: string, relativePath: string, fullPath: string) => Promise<void>;
  selectNode: (nodePath: string) => void;
  refreshDir: (repoPath: string, subDir?: string) => Promise<void>;
}

export function normalizePath(p: string): string {
  if (!p) return '';
  return p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

export function buildDirKey(repoPath: string, subDir: string = ''): string {
  const normRepo = normalizePath(repoPath);
  const cleanSub = subDir ? subDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '';
  return cleanSub ? `${normRepo}/${cleanSub}` : normRepo;
}

const inFlightDirFetches = new Map<string, Promise<FileTreeNodeItem[]>>();

export const useWorkspaceExplorerStore = create<WorkspaceExplorerState>((set, get) => ({
  expandedDirs: new Set<string>(),
  dirChildren: {},
  loadingDirs: new Set<string>(),
  selectedNodePath: null,
  locateHighlightTimestamp: 0,
  isLocating: false,

  toggleExpandDir: async (repoPath: string, subDir: string = '', autoExpandDepth: number = 0) => {
    const fullKey = buildDirKey(repoPath, subDir);
    const cleanSub = subDir ? subDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '';
    const { expandedDirs, dirChildren, loadingDirs } = get();

    if (expandedDirs.has(fullKey) && autoExpandDepth === 0) {
      // Collapse
      const nextExpanded = new Set(expandedDirs);
      nextExpanded.delete(fullKey);
      set({ expandedDirs: nextExpanded });
      return;
    }

    // Expand
    const nextExpanded = new Set(expandedDirs);
    nextExpanded.add(fullKey);
    set({ expandedDirs: nextExpanded });

    // Fetch if not already cached
    let items = dirChildren[fullKey];
    if (!items && !loadingDirs.has(fullKey)) {
      const nextLoading = new Set(loadingDirs);
      nextLoading.add(fullKey);
      set({ loadingDirs: nextLoading });

      try {
        const query = new URLSearchParams({
          repoPath,
          dir: cleanSub,
        });
        const fetchPromise = (async () => {
          const res = await fetch(`/api/fs/tree?${query.toString()}`);
          return (await res.json()) as FileTreeNodeItem[];
        })();

        inFlightDirFetches.set(fullKey, fetchPromise);
        items = await fetchPromise;

        set((state) => ({
          dirChildren: {
            ...state.dirChildren,
            [fullKey]: items,
          },
          loadingDirs: new Set([...state.loadingDirs].filter((k) => k !== fullKey)),
        }));
      } catch (err) {
        console.error('[Explorer] Failed to load directory children:', err);
        set((state) => ({
          loadingDirs: new Set([...state.loadingDirs].filter((k) => k !== fullKey)),
        }));
      } finally {
        inFlightDirFetches.delete(fullKey);
      }
    }

    // Auto-expand single-child folder chains (e.g. src/main/java/com/adas/...)
    if (items && items.length === 1 && items[0].isDirectory && autoExpandDepth < 8) {
      get().toggleExpandDir(repoPath, items[0].relativePath, autoExpandDepth + 1);
    }
  },

  ensureDirExpanded: async (repoPath: string, subDir: string = '') => {
    const fullKey = buildDirKey(repoPath, subDir);
    const cleanSub = subDir ? subDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '';
    const { expandedDirs, dirChildren } = get();

    if (!expandedDirs.has(fullKey)) {
      const nextExpanded = new Set(expandedDirs);
      nextExpanded.add(fullKey);
      set({ expandedDirs: nextExpanded });
    }

    let items = dirChildren[fullKey];
    if (items) {
      return;
    }

    // Check if fetch is already in-flight
    const inFlight = inFlightDirFetches.get(fullKey);
    if (inFlight) {
      await inFlight;
      return;
    }

    const nextLoading = new Set(get().loadingDirs);
    nextLoading.add(fullKey);
    set({ loadingDirs: nextLoading });

    try {
      const query = new URLSearchParams({ repoPath, dir: cleanSub });
      const fetchPromise = (async () => {
        const res = await fetch(`/api/fs/tree?${query.toString()}`);
        return (await res.json()) as FileTreeNodeItem[];
      })();

      inFlightDirFetches.set(fullKey, fetchPromise);
      items = await fetchPromise;

      set((state) => ({
        dirChildren: {
          ...state.dirChildren,
          [fullKey]: items,
        },
        loadingDirs: new Set([...state.loadingDirs].filter((k) => k !== fullKey)),
      }));
    } catch (err) {
      console.error('[Explorer] Failed to load directory children:', err);
      set((state) => ({
        loadingDirs: new Set([...state.loadingDirs].filter((k) => k !== fullKey)),
      }));
    } finally {
      inFlightDirFetches.delete(fullKey);
    }
  },

  locateFile: async (repoPath: string, relativePath: string, fullPath: string) => {
    set({ isLocating: true });

    // 1. Extract intermediate ancestor directories
    const cleanRel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const segments = cleanRel.split('/').filter(Boolean);
    segments.pop(); // Remove target file/folder name itself

    const ancestors: string[] = [''];
    let currentSubDir = '';
    for (const seg of segments) {
      currentSubDir = currentSubDir ? `${currentSubDir}/${seg}` : seg;
      ancestors.push(currentSubDir);
    }

    try {
      // 🚀 High-speed fast path: Fetch all ancestor trees in a SINGLE batch API call!
      // This eliminates the N-roundtrip sequential waterfall and multiple React re-renders.
      const query = new URLSearchParams({
        repoPath,
        relativePath: cleanRel,
      });
      const res = await fetch(`/api/fs/locate-ancestors?${query.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as {
          ancestors: string[];
          trees: Record<string, FileTreeNodeItem[]>;
        };

        const { expandedDirs, dirChildren } = get();
        const nextExpanded = new Set(expandedDirs);
        const nextChildren = { ...dirChildren };

        for (const dir of data.ancestors || ancestors) {
          nextExpanded.add(buildDirKey(repoPath, dir));
        }

        for (const [dir, items] of Object.entries(data.trees || {})) {
          const fullKey = buildDirKey(repoPath, dir);
          nextChildren[fullKey] = items;
        }

        // Single atomic state update - 0 intermediate re-renders!
        set({
          expandedDirs: nextExpanded,
          dirChildren: nextChildren,
          selectedNodePath: fullPath,
          locateHighlightTimestamp: Date.now(),
          isLocating: false,
        });
        return;
      }
    } catch (err) {
      console.warn('[WorkspaceExplorer] Fast locate-ancestors request failed, falling back:', err);
    }

    // Fallback path: Parallel Promise.all across any missing ancestor directories
    try {
      const missingDirs = ancestors.filter((dir) => {
        const fullKey = buildDirKey(repoPath, dir);
        return !get().dirChildren[fullKey];
      });

      const nextExpanded = new Set(get().expandedDirs);
      for (const dir of ancestors) {
        nextExpanded.add(buildDirKey(repoPath, dir));
      }
      set({ expandedDirs: nextExpanded });

      if (missingDirs.length > 0) {
        await Promise.all(missingDirs.map((dir) => get().ensureDirExpanded(repoPath, dir)));
      }

      set({
        selectedNodePath: fullPath,
        locateHighlightTimestamp: Date.now(),
        isLocating: false,
      });
    } catch {
      set({ isLocating: false });
    }
  },

  selectNode: (nodePath: string) => set({ selectedNodePath: nodePath }),

  refreshDir: async (repoPath: string, subDir: string = '') => {
    const fullKey = buildDirKey(repoPath, subDir);
    const cleanSub = subDir ? subDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '';
    try {
      const query = new URLSearchParams({ repoPath, dir: cleanSub });
      const res = await fetch(`/api/fs/tree?${query.toString()}`);
      const items: FileTreeNodeItem[] = await res.json();

      set((state) => ({
        dirChildren: {
          ...state.dirChildren,
          [fullKey]: items,
        },
      }));
    } catch {}
  },
}));
