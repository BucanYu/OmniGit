import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  ArrowUpRight,
  GitBranch,
  GitCommit,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  Database,
  File,
  AlertTriangle,
  Loader2,
  HelpCircle,
  ChevronRight,
  ChevronDown,
  List,
  FolderTree,
  RefreshCw,
  ExternalLink,
  GitCompare,
  Copy,
} from 'lucide-react';
import { useAppStore, type OutgoingCommitFile, type OutgoingCommitItem } from '../../store/useAppStore';
import { useTranslation } from '../../locales';
import { ResizeDivider } from '../../components/ui/ResizeDivider';
import { PushDiffModal } from './PushDiffModal';

// File TreeNode structure for hierarchical directory display
interface FileTreeNode {
  name: string;
  fullPath: string;
  isDirectory: boolean;
  fileCount: number;
  file?: OutgoingCommitFile;
  children: Map<string, FileTreeNode>;
}

function buildFileTree(files: OutgoingCommitFile[] = []): FileTreeNode {
  const safeFiles = Array.isArray(files) ? files : [];
  const root: FileTreeNode = {
    name: 'root',
    fullPath: '',
    isDirectory: true,
    fileCount: safeFiles.length,
    children: new Map(),
  };

  for (const file of safeFiles) {
    if (!file || !file.path || typeof file.path !== 'string') continue;
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          fullPath: currentPath,
          isDirectory: !isLast,
          fileCount: 0,
          file: isLast ? file : undefined,
          children: new Map(),
        });
      }

      const nextNode = current.children.get(part)!;
      nextNode.fileCount += 1;
      current = nextNode;
    }
  }

  return root;
}

export const PushCommitsModal: React.FC = () => {
  const { t } = useTranslation();
  const {
    isPushModalOpen,
    pushModalTargetBranch,
    outgoingCommitsData,
    outgoingCommitsLoading,
    pushingLoading,
    pushError,
    closePushModal,
    executePush,
    projects,
    activeProjectId,
    updateProject,
    setSelectedFile,
    revealFileInOS,
    setNotification,
  } = useAppStore();

  const currentProject = projects.find((p) => p.id === activeProjectId);

  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'flat'>('tree');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [pushTags, setPushTags] = useState(false);
  const [tagOption, setTagOption] = useState<'All' | 'Current'>('All');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [forcePushMode, setForcePushMode] = useState(false);

  // Dedicated diff modal & right-click context menu states
  const [diffModalState, setDiffModalState] = useState<{
    isOpen: boolean;
    filePath: string;
    commitHash: string;
    commitMessage?: string;
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: OutgoingCommitFile;
    commitHash: string;
  } | null>(null);

  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    if (contextMenu) {
      window.addEventListener('click', handleClose);
      window.addEventListener('contextmenu', handleClose);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  const getCommitHashForFile = (file: OutgoingCommitFile) => {
    if (selectedCommitHash) return selectedCommitHash;
    const found = outgoingCommitsData?.commits.find((c) =>
      c.files?.some((f) => f.path === file.path)
    );
    return found?.hash || outgoingCommitsData?.commits[0]?.hash || '';
  };

  const openDiffForFile = (file: OutgoingCommitFile) => {
    const hash = getCommitHashForFile(file);
    const commitObj = outgoingCommitsData?.commits.find((c) => c.hash === hash);
    setSelectedFilePath(file.path);
    setDiffModalState({
      isOpen: true,
      filePath: file.path,
      commitHash: hash,
      commitMessage: commitObj?.message,
    });
  };

  // Left Commits List Resizable Width (default 340px, persisted)
  const [pushModalLeftWidth, setPushModalLeftWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('omnigit_push_modal_left_width');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 180 && val <= 600) return val;
      }
    }
    return 340;
  });

  const handleResizePushModalLeft = (newWidth: number) => {
    setPushModalLeftWidth(newWidth);
    try {
      localStorage.setItem('omnigit_push_modal_left_width', String(newWidth));
    } catch {}
  };

  // Derive which files to display based on selected commit (or all commits if none selected)
  const displayedFiles = useMemo(() => {
    if (!outgoingCommitsData || !Array.isArray(outgoingCommitsData.commits)) return [];
    if (selectedCommitHash) {
      const c = outgoingCommitsData.commits.find((item) => item.hash === selectedCommitHash);
      if (c && Array.isArray(c.files)) return c.files;
    }
    return Array.isArray(outgoingCommitsData.allFiles) ? outgoingCommitsData.allFiles : [];
  }, [outgoingCommitsData, selectedCommitHash]);

  // Build hierarchical tree safely
  const fileTree = useMemo(() => buildFileTree(displayedFiles), [displayedFiles]);

  // Auto-expand all folders when files are loaded so it matches Screenshot 3
  React.useEffect(() => {
    if (displayedFiles && displayedFiles.length > 0) {
      const allPaths = new Set<string>(['root']);
      displayedFiles.forEach((f) => {
        if (!f || !f.path) return;
        const parts = f.path.split('/');
        for (let i = 0; i < parts.length - 1; i++) {
          allPaths.add(parts.slice(0, i + 1).join('/'));
        }
      });
      setExpandedFolders(allPaths);
    }
  }, [displayedFiles]);

  // Auto-select first commit when outgoing commits load (matching IntelliJ IDEA Screenshot 3)
  React.useEffect(() => {
    if (outgoingCommitsData?.commits && outgoingCommitsData.commits.length > 0) {
      if (!selectedCommitHash || !outgoingCommitsData.commits.some((c) => c.hash === selectedCommitHash)) {
        setSelectedCommitHash(outgoingCommitsData.commits[0].hash);
      }
    } else {
      setSelectedCommitHash(null);
    }
  }, [outgoingCommitsData]);

  // Reset internal states on modal close
  React.useEffect(() => {
    if (!isPushModalOpen) {
      setSelectedCommitHash(null);
      setSelectedFilePath(null);
      setForcePushMode(false);
      setDiffModalState(null);
      setContextMenu(null);
    }
  }, [isPushModalOpen]);

  if (!isPushModalOpen) return null;

  const sourceBranch = pushModalTargetBranch || outgoingCommitsData?.sourceBranch || currentProject?.currentBranch || 'dev';
  const targetBranch = outgoingCommitsData?.targetBranch || sourceBranch;
  const remoteName = outgoingCommitsData?.remote || 'origin';
  const commits = (outgoingCommitsData && Array.isArray(outgoingCommitsData.commits)) ? outgoingCommitsData.commits : [];

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allPaths = new Set<string>();
    function collect(node: FileTreeNode) {
      if (node.isDirectory) {
        allPaths.add(node.fullPath || 'root');
        node.children.forEach(collect);
      }
    }
    collect(fileTree);
    setExpandedFolders(allPaths);
  };

  const collapseAll = () => {
    setExpandedFolders(new Set());
  };

  const renderFileIcon = (fileName = '') => {
    if (fileName.endsWith('.java')) {
      return (
        <span className="w-3.5 h-3.5 rounded bg-blue-600/90 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
          C
        </span>
      );
    }
    if (fileName.endsWith('.sql')) {
      return <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
    if (fileName.endsWith('.md')) {
      return <FileText className="w-3.5 h-3.5 text-sky-300 shrink-0" />;
    }
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx') || fileName.endsWith('.json') || fileName.endsWith('.vue')) {
      return <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    }
    return <File className="w-3.5 h-3.5 text-theme-dim shrink-0" />;
  };

  const renderStatusCode = (statusCode = '', status = '') => {
    const code = statusCode || '';
    const st = status || '';
    if (code.startsWith('A') || st === 'added') {
      return <span className="text-[10px] font-mono font-bold text-emerald-400">A</span>;
    }
    if (code.startsWith('D') || st === 'deleted') {
      return <span className="text-[10px] font-mono font-bold text-rose-400">D</span>;
    }
    if (code.startsWith('R') || st === 'renamed') {
      return <span className="text-[10px] font-mono font-bold text-amber-400">R</span>;
    }
    return <span className="text-[10px] font-mono font-bold text-sky-400">M</span>;
  };

  const renderTreeNodes = (node: FileTreeNode, depth = 0): React.ReactNode => {
    const isRoot = node.name === 'root';
    const childrenArray = Array.from(node.children.values());

    return (
      <div key={node.fullPath || 'root'} className="select-none">
        {!isRoot && (
          <div
            onClick={() => {
              if (node.isDirectory) {
                toggleFolder(node.fullPath);
              } else if (node.file) {
                setSelectedFilePath(node.file.path);
                setSelectedFile(node.file.path);
              }
            }}
            onDoubleClick={(e) => {
              if (!node.isDirectory && node.file) {
                e.stopPropagation();
                openDiffForFile(node.file);
              }
            }}
            onContextMenu={(e) => {
              if (!node.isDirectory && node.file) {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  file: node.file,
                  commitHash: getCommitHashForFile(node.file),
                });
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
                    openDiffForFile(node.file!);
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

  const handlePush = async () => {
    await executePush({
      force: forcePushMode,
      tags: pushTags,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs flex items-center justify-center select-none"
      onKeyDown={(e) => {
        if (e.key === 'Escape') closePushModal();
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handlePush();
      }}
    >
      <div className="bg-theme-card border border-theme-border-card rounded-lg shadow-2xl w-[860px] max-w-[95vw] h-[580px] max-h-[92vh] flex flex-col font-sans text-xs text-theme-main overflow-hidden">
        {/* 1. Modal Header */}
        <div className="h-10 px-3 bg-theme-subbar border-b border-theme flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 font-semibold text-xs text-theme-main">
            <ArrowUpRight className="w-4 h-4 text-sky-500" />
            <span>Push Commits to {currentProject?.name || 'Project'}</span>
          </div>
          <button
            type="button"
            onClick={closePushModal}
            className="p-1 text-theme-dim hover:text-theme-main rounded hover:bg-theme-card cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Target Routing Bar (dev → origin: dev) */}
        <div className="px-3 py-2 bg-theme-header border-b border-theme flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 font-medium min-w-0">
            <span className="text-sky-400 font-bold truncate max-w-[200px]" title={sourceBranch}>{sourceBranch}</span>
            <span className="text-theme-dim shrink-0">→</span>
            <span className="text-sky-400 font-semibold shrink-0">{remoteName}:</span>
            <span className="text-sky-400 font-bold truncate max-w-[200px]" title={targetBranch}>{targetBranch}</span>
          </div>

          <div className="text-[11px] text-theme-dim flex items-center gap-2">
            {outgoingCommitsLoading ? (
              <span className="flex items-center gap-1 text-sky-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{t.modals.push.scanningCommits}</span>
              </span>
            ) : (
              <span>
                {t.modals.push.commitsToPush(commits.length)}
              </span>
            )}
          </div>
        </div>

        {/* 3. Main Split Body (Left: Commit List, Right: Changed Files) */}
        <div className="flex-1 flex overflow-hidden min-h-0 relative">
          {/* Left Pane: Commits List */}
          <div
            style={{
              width: `${pushModalLeftWidth}px`,
              minWidth: `${pushModalLeftWidth}px`,
              maxWidth: `${pushModalLeftWidth}px`,
            }}
            className="flex flex-col bg-theme-panel shrink-0"
          >
            <div className="px-3 py-1.5 border-b border-theme bg-theme-header text-[11px] font-semibold text-theme-muted flex items-center justify-between">
              <span>{t.modals.push.commitsHeader}</span>
              <span className="text-theme-dim text-[10px] font-mono">{commits.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-1 space-y-1">
              {outgoingCommitsLoading ? (
                <div className="p-8 text-center text-theme-dim space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-sky-400" />
                  <p>{t.modals.push.loadingCommits}</p>
                </div>
              ) : commits.length === 0 ? (
                <div className="p-8 text-center text-theme-dim space-y-1">
                  <p className="font-semibold text-theme-main">{t.modals.push.everythingUpToDate}</p>
                  <p className="text-[11px]">{t.modals.push.noUnpushedCommits(sourceBranch)}</p>
                </div>
              ) : (
                commits.map((commit: OutgoingCommitItem) => {
                  const isSelected = selectedCommitHash === commit.hash;
                  return (
                    <div
                      key={commit.hash}
                      onClick={() =>
                        setSelectedCommitHash(isSelected ? null : commit.hash)
                      }
                      className={`p-2 rounded border cursor-pointer transition text-xs select-none ${
                        isSelected
                          ? 'bg-sky-500/15 border-sky-500/40 text-theme-main shadow-xs'
                          : 'bg-theme-card hover:bg-theme-card-hover border-theme-border-card text-theme-main'
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        <GitCommit className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-theme-main leading-tight line-clamp-2" title={commit.subject}>
                            {commit.subject}
                          </p>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-theme-dim font-mono">
                            <span className="truncate max-w-[140px]" title={commit.authorName}>{commit.authorName}</span>
                            <span className="text-theme-dim hover:text-theme-main" title={commit.hash}>
                              {commit.shortHash}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Horizontal Resize Divider between Commits List and Changed Files */}
          <ResizeDivider
            currentWidth={pushModalLeftWidth}
            minWidth={200}
            maxWidth={560}
            onResize={handleResizePushModalLeft}
            onDoubleClickReset={() => handleResizePushModalLeft(340)}
            title={t.modals.push.dragResizePushList}
          />

          {/* Right Pane: Changed Files Tree / List */}
          <div className="flex-1 flex flex-col bg-theme-panel min-w-0">
            {/* Toolbar */}
            <div className="px-3 py-1.5 border-b border-theme bg-theme-header flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2 text-theme-muted font-semibold">
                <span>{t.modals.push.changedFilesHeader}</span>
                <span className="text-[10px] font-mono text-theme-dim">
                  ({displayedFiles.length})
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
                    const file = displayedFiles.find((f) => f.path === selectedFilePath);
                    if (file) openDiffForFile(file);
                  }}
                  className="px-1.5 py-0.5 rounded hover:bg-theme-card text-theme-dim hover:text-sky-400 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1 mr-1"
                  title={t.modals.push.showDiffTooltip}
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  <span className="text-[10px]">{t.modals.push.showDiffBtn}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'tree' ? 'flat' : 'tree')}
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
                      onClick={expandAll}
                      className="p-1 rounded hover:bg-theme-card hover:text-theme-main transition cursor-pointer"
                      title={t.common.expand}
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={collapseAll}
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
              {displayedFiles.length === 0 ? (
                <div className="p-8 text-center text-theme-dim text-xs">
                  {t.modals.push.noChangedFiles}
                </div>
              ) : viewMode === 'tree' ? (
                renderTreeNodes(fileTree)
              ) : (
                <div className="space-y-0.5">
                  {displayedFiles.map((file) => (
                    <div
                      key={file.path}
                      onClick={() => {
                        setSelectedFilePath(file.path);
                        setSelectedFile(file.path);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        openDiffForFile(file);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          file,
                          commitHash: getCommitHashForFile(file),
                        });
                      }}
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
                            openDiffForFile(file);
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
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4. Error Banner (Inline Diagnostics) */}
        {pushError && (
          <div className="p-2.5 bg-rose-500/15 border-t border-rose-500/30 text-rose-400 text-xs flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="truncate font-medium">{pushError}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  await updateProject();
                  if (outgoingCommitsData) {
                    useAppStore.getState().openPushModal(sourceBranch);
                  }
                }}
                className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
                title={t.modals.push.pullMergeTooltip}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t.modals.push.updateProjectPull}</span>
              </button>

              <button
                type="button"
                onClick={() => setForcePushMode(!forcePushMode)}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition cursor-pointer ${
                  forcePushMode
                    ? 'bg-rose-700 text-white font-bold shadow-xs'
                    : 'bg-theme-card text-rose-400 hover:bg-theme-card-hover border border-rose-500/30'
                }`}
                title={t.modals.push.forcePushTooltip}
              >
                {forcePushMode ? t.modals.push.forcePushOn : t.modals.push.forcePushOff}
              </button>
            </div>
          </div>
        )}

        {/* 5. Bottom Footer Toolbar (Matches Screenshot 3) */}
        <div className="h-12 px-3 bg-theme-subbar border-t border-theme flex items-center justify-between shrink-0">
          {/* Left: Help & Push Tags option */}
          <div className="flex items-center gap-4 text-xs text-theme-muted">
            <button
              type="button"
              className="p-1 hover:text-theme-main rounded transition cursor-pointer text-theme-dim"
              title={t.modals.push.pushCommitsHelp}
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <label className="flex items-center gap-1.5 cursor-pointer hover:text-theme-main select-none">
              <input
                type="checkbox"
                checked={pushTags}
                onChange={(e) => setPushTags(e.target.checked)}
                className="rounded border-theme text-sky-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
              />
              <span>{t.modals.push.pushTags}</span>
            </label>

            {pushTags && (
              <select
                value={tagOption}
                onChange={(e) => setTagOption(e.target.value as any)}
                className="bg-theme-input border border-theme-border-card rounded px-2 py-0.5 text-xs text-theme-main focus:outline-none cursor-pointer"
              >
                <option value="All">{t.common.all}</option>
                <option value="Current">{t.modals.push.currentBranchTags}</option>
              </select>
            )}
          </div>

          {/* Right: Push & Cancel Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pushingLoading || (commits.length === 0 && !pushTags)}
              onClick={handlePush}
              className={`px-5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm transition cursor-pointer ${
                forcePushMode
                  ? 'bg-rose-600 hover:bg-rose-500 text-white font-bold'
                  : 'bg-sky-600 hover:bg-sky-500 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {pushingLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t.modals.push.pushing}</span>
                </>
              ) : (
                <span>{forcePushMode ? t.modals.push.forcePush : t.modals.push.pushButton}</span>
              )}
            </button>

            <button
              type="button"
              onClick={closePushModal}
              className="px-4 py-1.5 rounded bg-theme-card hover:bg-theme-card-hover text-theme-main border border-theme-border-card text-xs font-medium transition cursor-pointer"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      </div>

      {/* 5. Right-Click Context Menu on Changed Files */}
      {contextMenu && (() => {
        const menuWidth = 220;
        const menuHeight = 200;
        const clampedX = Math.max(10, Math.min(contextMenu.x, window.innerWidth - menuWidth - 10));
        const clampedY = Math.max(10, Math.min(contextMenu.y, window.innerHeight - menuHeight - 10));
        return (
          <div
            style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[1060] bg-theme-panel border border-theme-border rounded-lg shadow-2xl py-1 min-w-[200px] text-xs select-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-75 font-sans"
          >
          <div className="px-3 py-1 text-[10px] text-theme-dim border-b border-theme-border font-mono truncate max-w-[240px]">
            {contextMenu.file.fileName}
          </div>
          <button
            type="button"
            onClick={() => {
              openDiffForFile(contextMenu.file);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-theme-main hover:bg-theme-hover hover:text-sky-400 transition cursor-pointer text-left font-medium"
          >
            <GitCompare className="w-3.5 h-3.5 text-sky-400" />
            <span>{t.modals.push.showDiffTooltip}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              revealFileInOS(contextMenu.file.path);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-theme-main hover:bg-theme-hover transition cursor-pointer text-left"
          >
            <FolderOpen className="w-3.5 h-3.5 text-theme-dim" />
            <span>{t.modals.push.openInExplorer}</span>
          </button>
          <div className="h-px bg-theme-border my-1" />
          <button
            type="button"
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(contextMenu.file.path);
                setNotification({
                  id: Date.now(),
                  title: t.modals.push.relativePathCopied,
                  detail: contextMenu.file.path,
                  type: 'info',
                });
              }
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-theme-main hover:bg-theme-hover transition cursor-pointer text-left"
          >
            <Copy className="w-3.5 h-3.5 text-theme-dim" />
            <span>{t.modals.push.copyRelativePath}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const sep = currentProject?.path.includes('\\') ? '\\' : '/';
              const full = `${currentProject?.path || ''}${sep}${contextMenu.file.path.replace(/\//g, sep)}`;
              if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(full);
                setNotification({
                  id: Date.now(),
                  title: t.modals.push.absolutePathCopied,
                  detail: full,
                  type: 'info',
                });
              }
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-theme-main hover:bg-theme-hover transition cursor-pointer text-left"
          >
            <Copy className="w-3.5 h-3.5 text-theme-dim" />
            <span>{t.modals.push.copyAbsolutePath}</span>
          </button>
        </div>
      );
    })()}

      {/* 6. Push Diff Modal (Dedicated Comparison Dialog) */}
      {diffModalState && diffModalState.isOpen && (
        <PushDiffModal
          isOpen={diffModalState.isOpen}
          onClose={() => setDiffModalState(null)}
          repoPath={currentProject?.path || ''}
          commitHash={diffModalState.commitHash}
          commitMessage={diffModalState.commitMessage}
          initialFilePath={diffModalState.filePath}
          files={displayedFiles}
        />
      )}
    </div>
  );
};
