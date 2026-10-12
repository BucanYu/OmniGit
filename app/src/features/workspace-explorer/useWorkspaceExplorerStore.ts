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

  toggleExpandDir: (repoPath: string, subDir?: string, autoExpandDepth?: number) => Promise<void>;
  selectNode: (nodePath: string) => void;
  refreshDir: (repoPath: string, subDir?: string) => Promise<void>;
}

export const useWorkspaceExplorerStore = create<WorkspaceExplorerState>((set, get) => ({
  expandedDirs: new Set<string>(),
  dirChildren: {},
  loadingDirs: new Set<string>(),
  selectedNodePath: null,

  toggleExpandDir: async (repoPath: string, subDir: string = '', autoExpandDepth: number = 0) => {
    const fullKey = subDir ? `${repoPath}/${subDir}`.replace(/\\/g, '/') : repoPath.replace(/\\/g, '/');
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
          dir: subDir,
        });
        const res = await fetch(`/api/fs/tree?${query.toString()}`);
        items = await res.json();

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
      }
    }

    // Auto-expand single-child folder chains (e.g. src/main/java/com/adas/...)
    if (items && items.length === 1 && items[0].isDirectory && autoExpandDepth < 8) {
      get().toggleExpandDir(repoPath, items[0].relativePath, autoExpandDepth + 1);
    }
  },

  selectNode: (nodePath: string) => set({ selectedNodePath: nodePath }),

  refreshDir: async (repoPath: string, subDir: string = '') => {
    const fullKey = subDir ? `${repoPath}/${subDir}`.replace(/\\/g, '/') : repoPath.replace(/\\/g, '/');
    try {
      const query = new URLSearchParams({ repoPath, dir: subDir });
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
