import React, { useRef, useEffect, useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  FileSpreadsheet,
  File,
  Code2,
  FileTerminal,
  Settings,
  Database,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { useWorkspaceExplorerStore, normalizePath, buildDirKey, type FileTreeNodeItem } from './useWorkspaceExplorerStore';
import { useEditorTabsStore } from '../code-editor/useEditorTabsStore';

interface FileTreeNodeProps {
  item: FileTreeNodeItem;
  repoPath: string;
  repoName: string;
  depth: number;
}

function getFileIcon(name: string, ext?: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.startsWith('.env')) {
    return <Settings className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  }
  if (lowerName.startsWith('.git') || lowerName.includes('license')) {
    return <FileText className="w-3.5 h-3.5 text-theme-muted shrink-0" />;
  }

  const cleanExt = (ext || '').toLowerCase().replace(/^\./, '');
  switch (cleanExt) {
    case 'ts':
    case 'tsx':
      return <Code2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return <Code2 className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
    case 'java':
    case 'kt':
    case 'kts':
    case 'scala':
      return <Code2 className="w-3.5 h-3.5 text-red-400 shrink-0" />;
    case 'py':
    case 'pyw':
      return <Code2 className="w-3.5 h-3.5 text-blue-300 shrink-0" />;
    case 'go':
      return <Code2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    case 'rs':
      return <Code2 className="w-3.5 h-3.5 text-orange-500 shrink-0" />;
    case 'c':
    case 'h':
    case 'cpp':
    case 'hpp':
    case 'cc':
    case 'cs':
      return <Code2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
    case 'json':
    case 'jsonc':
    case 'json5':
      return <FileJson className="w-3.5 h-3.5 text-amber-300 shrink-0" />;
    case 'html':
    case 'htm':
    case 'vue':
    case 'svelte':
      return <FileCode className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'ico':
    case 'bmp':
    case 'avif':
    case 'apng':
      return <ImageIcon className="w-3.5 h-3.5 text-pink-400 shrink-0" />;
    case 'xml':
    case 'xsd':
    case 'xaml':
      return <FileCode className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return <FileCode className="w-3.5 h-3.5 text-sky-300 shrink-0" />;
    case 'md':
    case 'markdown':
    case 'txt':
    case 'log':
      return <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    case 'yml':
    case 'yaml':
    case 'toml':
    case 'ini':
    case 'properties':
    case 'conf':
      return <Settings className="w-3.5 h-3.5 text-purple-300 shrink-0" />;
    case 'sh':
    case 'bash':
    case 'bat':
    case 'cmd':
    case 'ps1':
      return <FileTerminal className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    case 'sql':
      return <Database className="w-3.5 h-3.5 text-teal-400 shrink-0" />;
    case 'csv':
    case 'xlsx':
    case 'xls':
    case 'et':
      return <FileSpreadsheet className="w-3.5 h-3.5 text-green-500 shrink-0" />;
    default:
      return <File className="w-3.5 h-3.5 text-theme-muted shrink-0" />;
  }
}

const EMPTY_CHILDREN: FileTreeNodeItem[] = [];

export const FileTreeNode = React.memo(function FileTreeNode({ item, repoPath, repoName, depth }: FileTreeNodeProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [isLocatePulsing, setIsLocatePulsing] = useState(false);

  const key = React.useMemo(() => buildDirKey(repoPath, item.relativePath), [repoPath, item.relativePath]);
  const normPath = React.useMemo(() => (item.path ? normalizePath(item.path).toLowerCase() : ''), [item.path]);

  // Fine-grained Zustand subscriptions: only re-render if THIS item's specific state changed!
  const isExpanded = useWorkspaceExplorerStore((state) =>
    item.isDirectory ? state.expandedDirs.has(key) : false
  );
  const isLoading = useWorkspaceExplorerStore((state) =>
    item.isDirectory ? state.loadingDirs.has(key) : false
  );
  const isSelected = useWorkspaceExplorerStore((state) =>
    Boolean(state.selectedNodePath && normPath && normalizePath(state.selectedNodePath).toLowerCase() === normPath)
  );
  const locateHighlightTimestamp = useWorkspaceExplorerStore((state) =>
    isSelected ? state.locateHighlightTimestamp : 0
  );
  const children = useWorkspaceExplorerStore((state) =>
    item.isDirectory && isExpanded ? state.dirChildren[key] || EMPTY_CHILDREN : EMPTY_CHILDREN
  );

  const selectNode = useWorkspaceExplorerStore((state) => state.selectNode);
  const toggleExpandDir = useWorkspaceExplorerStore((state) => state.toggleExpandDir);
  const openFileTab = useEditorTabsStore((state) => state.openFileTab);

  // Instant scroll into view and pulse highlight when this node is located
  useEffect(() => {
    if (isSelected && locateHighlightTimestamp > 0 && rowRef.current) {
      const animId = requestAnimationFrame(() => {
        rowRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' });
      });
      setIsLocatePulsing(true);
      const pulseTimer = setTimeout(() => setIsLocatePulsing(false), 2400);
      return () => {
        cancelAnimationFrame(animId);
        clearTimeout(pulseTimer);
      };
    }
  }, [isSelected, locateHighlightTimestamp]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(item.path);

    if (item.isDirectory) {
      toggleExpandDir(repoPath, item.relativePath);
    } else {
      openFileTab({
        filePath: item.path,
        repoPath,
        relativePath: item.relativePath,
        repoName,
      });
    }
  };

  return (
    <div>
      <div
        ref={rowRef}
        onClick={handleClick}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className={`flex items-center gap-1.5 py-1 pr-2 text-xs cursor-pointer select-none rounded transition-all duration-300 ${
          isLocatePulsing
            ? 'bg-sky-100 dark:bg-sky-500/25 text-sky-800 dark:text-sky-300 font-semibold ring-1 ring-sky-500/60 dark:ring-sky-400 shadow-sm'
            : isSelected
            ? 'bg-theme-hover text-theme-main font-medium'
            : 'text-theme-main/90 hover:bg-theme-hover/60'
        }`}
        title={`${item.name} (${item.relativePath})`}
      >
        {item.isDirectory ? (
          <>
            <span className="w-3.5 h-3.5 flex items-center justify-center text-theme-muted shrink-0">
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
              ) : isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            {getFileIcon(item.name, item.extension)}
          </>
        )}

        <span className="truncate text-[12px]">{item.name}</span>
      </div>

      {/* Render children recursively if expanded */}
      {item.isDirectory && isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FileTreeNode
              key={child.path}
              item={child}
              repoPath={repoPath}
              repoName={repoName}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
});
