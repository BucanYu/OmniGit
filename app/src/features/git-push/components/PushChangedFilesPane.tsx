import React from 'react';
import {
  FolderTree,
  List,
  ChevronDown,
  ChevronRight,
  GitCompare,
  Loader2,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { useTranslation } from '../../../locales';
import type { OutgoingCommitFile } from '../../../store/useAppStore';
import type { FileTreeNode } from '../types';
import { renderFileIcon, renderStatusCode } from '../utils/pushModalUtils';

interface PushChangedFilesPaneProps {
  files: OutgoingCommitFile[];
  loading: boolean;
  commitsCount: number;
  hasLoadedData: boolean;
  selectedCommitHash: string | null;
  selectedFilePath: string | null;
  fileTree: FileTreeNode;
  expandedFolders: Set<string>;
  viewMode: 'tree' | 'flat';
  onViewModeChange: (mode: 'tree' | 'flat') => void;
  onToggleFolder: (path: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onSelectFile: (path: string) => void;
  onOpenDiff: (file: OutgoingCommitFile) => void;
  onContextMenu: (e: React.MouseEvent, file: OutgoingCommitFile) => void;
}

export const PushChangedFilesPane: React.FC<PushChangedFilesPaneProps> = ({
  files,
  loading,
  commitsCount,
  hasLoadedData,
  selectedCommitHash,
  selectedFilePath,
  fileTree,
  expandedFolders,
  viewMode,
  onViewModeChange,
  onToggleFolder,
  onExpandAll,
  onCollapseAll,
  onSelectFile,
  onOpenDiff,
  onContextMenu,
}) => {
  const { t } = useTranslation();

  const renderTreeNodes = (node: FileTreeNode, depth = 0): React.ReactNode => {
    const isRoot = node.name === 'root';
    const childrenArray = Array.from(node.children.values());

    return (
      <div key={node.fullPath || 'root'} className="select-none">
        {!isRoot && (
          <div
            onClick={() => {
              if (node.isDirectory) {
                onToggleFolder(node.fullPath);
              } else if (node.file) {
                onSelectFile(node.file.path);
              }
            }}
            onDoubleClick={(e) => {
              if (!node.isDirectory && node.file) {
                e.stopPropagation();
                onOpenDiff(node.file);
              }
            }}
            onContextMenu={(e) => {
              if (!node.isDirectory && node.file) {
                onContextMenu(e, node.file);
              }
            }}
            style={{ paddingLeft: `${Math.max(4, depth * 14)}px` }}
            className={`group py-1 px-2 flex items-center justify-between cursor-pointer rounded transition text-[11px] ${
              selectedFilePath === node.fullPath
                ? 'bg-sky-500/20 text-sky-400 font-medium'
                : 'hover:bg-theme-hover text-theme-main'
            }`}
            title={node.isDirectory ? node.name : t.modals.push.showDiffDoubleTooltip(node.fullPath)}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
              {node.isDirectory ? (
                <>
                  <span className="text-theme-dim">
                    {expandedFolders.has(node.fullPath) ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </span>
                  {expandedFolders.has(node.fullPath) ? (
                    <FolderOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-sky-500/80 shrink-0" />
                  )}
                  <span className="font-semibold text-theme-main truncate">{node.name}</span>
                  <span className="text-[10px] text-theme-dim ml-1 font-mono">
                    {node.fileCount} file{node.fileCount > 1 ? 's' : ''}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-3.5 shrink-0" />
                  {renderFileIcon(node.name)}
                  <span className="truncate text-theme-main font-mono text-[11px]">{node.name}</span>
                </>
              )}
            </div>

            {!node.isDirectory && node.file && (
              <div className="shrink-0 flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDiff(node.file!);
                  }}
                  title={t.modals.push.showDiffTooltip}
                  className="p-0.5 hover:bg-sky-500/20 text-theme-dim hover:text-sky-400 rounded opacity-0 group-hover:opacity-100 transition cursor-pointer"
                >
                  <GitCompare className="w-3.5 h-3.5" />
                </button>
                {renderStatusCode(node.file.statusCode, node.file.status)}
              </div>
            )}
          </div>
        )}

        {(isRoot || expandedFolders.has(node.fullPath)) &&
          childrenArray.map((child) => renderTreeNodes(child, isRoot ? 0 : depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-theme-panel min-w-0">
      {/* Toolbar */}
      <div className="px-3 py-1.5 border-b border-theme bg-theme-header flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2 text-theme-muted font-semibold">
          <span>{t.modals.push.changedFilesHeader}</span>
          <span className="text-[10px] font-mono text-theme-dim">
            ({files.length})
          </span>
          {selectedCommitHash && (
            <span className="text-[10px] text-sky-400 font-mono bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">
              Filter: {selectedCommitHash.slice(0, 7)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-theme-dim">
          <button
            type="button"
            disabled={!selectedFilePath}
            onClick={() => {
              const file = files.find((f) => f.path === selectedFilePath);
              if (file) onOpenDiff(file);
            }}
            className="px-1.5 py-0.5 rounded hover:bg-theme-card text-theme-dim hover:text-sky-400 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1 mr-1"
            title={t.modals.push.showDiffTooltip}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span className="text-[10px]">{t.modals.push.showDiffBtn}</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange(viewMode === 'tree' ? 'flat' : 'tree')}
            className={`p-1 rounded hover:bg-theme-card hover:text-theme-main transition cursor-pointer ${
              viewMode === 'tree' ? 'text-sky-400' : ''
            }`}
            title={viewMode === 'tree' ? t.modals.push.switchToFlatList : t.modals.push.switchToTreeList}
          >
            {viewMode === 'tree' ? (
              <FolderTree className="w-3.5 h-3.5" />
            ) : (
              <List className="w-3.5 h-3.5" />
            )}
          </button>

          {viewMode === 'tree' && (
            <>
              <button
                type="button"
                onClick={onExpandAll}
                className="p-1 rounded hover:bg-theme-card hover:text-theme-main transition cursor-pointer"
                title={t.common.expand}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onCollapseAll}
                className="p-1 rounded hover:bg-theme-card hover:text-theme-main transition cursor-pointer"
                title={t.common.collapse}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* File List / Tree View */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading && (!hasLoadedData || commitsCount === 0) ? (
          <div className="p-8 text-center text-theme-dim text-xs flex flex-col items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
            <span>{t.modals.push.loadingCommits}</span>
          </div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center text-theme-dim text-xs">
            {t.modals.push.noChangedFiles}
          </div>
        ) : viewMode === 'tree' ? (
          renderTreeNodes(fileTree)
        ) : (
          <div className="space-y-0.5">
            {files.slice(0, 300).map((file) => (
              <div
                key={file.path}
                onClick={() => onSelectFile(file.path)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onOpenDiff(file);
                }}
                onContextMenu={(e) => onContextMenu(e, file)}
                className={`group px-2 py-1.5 flex items-center justify-between cursor-pointer rounded transition text-xs ${
                  selectedFilePath === file.path
                    ? 'bg-sky-500/20 text-sky-400 font-medium'
                    : 'hover:bg-theme-hover text-theme-main'
                }`}
                title={t.modals.push.showDiffDoubleTooltip(file.path)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                  {renderFileIcon(file.fileName)}
                  <span className="font-mono text-xs text-theme-main truncate">
                    {file.fileName}
                  </span>
                  <span className="text-[11px] text-theme-dim truncate font-mono">
                    {file.dirPath}
                  </span>
                </div>

                <div className="shrink-0 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDiff(file);
                    }}
                    title={t.modals.push.showDiffTooltip}
                    className="p-0.5 hover:bg-sky-500/20 text-theme-dim hover:text-sky-400 rounded opacity-0 group-hover:opacity-100 transition cursor-pointer"
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                  </button>
                  {renderStatusCode(file.statusCode, file.status)}
                </div>
              </div>
            ))}

            {files.length > 300 && (
              <div className="py-2 px-3 text-center text-[11px] text-theme-dim bg-theme-subbar/60 rounded border border-theme/40 my-1">
                {t.modals.push.maxFilesLimitNotice(files.length)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
