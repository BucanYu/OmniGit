import React, { useState, useRef, useEffect } from 'react';
import { useAppStore, type GitFileItem } from '../../store/useAppStore';
import { useTranslation, renderDualText } from '../../locales';
import { GitLogPanel } from '../git-log/GitLogPanel';
import { VerticalResizeDivider } from '../../components/ui/VerticalResizeDivider';
import {
  Undo2,
  RefreshCw,
  Columns2,
  List,
  FolderTree,
  ChevronDown,
  ChevronRight,
  Clock,
  Settings,
  FileCode,
  FileText,
  Database,
  CheckSquare,
  Square,
  MinusSquare,
  AlertTriangle,
  Folder,
  FolderOpen,
  GitCommit,
  Plus,
  Minus,
  ExternalLink,
  FileEdit,
  GitMerge,
  ArrowRightLeft,
  CheckCircle2,
  Check,
  X,
} from 'lucide-react';

export function StatusPanel() {
  const { t, isZh } = useTranslation();
  const {
    activeTab,
    setActiveTab,
    files,
    selectedFilePath,
    setSelectedFile,
    toggleFileCheck,
    toggleGroupCheck,
    groupCollapsed,
    toggleGroupCollapsed,
    viewStyle,
    setViewStyle,
    isAmend,
    setIsAmend,
    commitMessage,
    setCommitMessage,
    commitHistory,
    commit,
    openRollbackModal,
    closeRollbackModal,
    confirmRollback,
    rollbackModal,
    projects,
    activeProjectId,
    loadRepoData,
    isRepoLoading,
    statusPanelWidth,
    commitBoxHeight,
    setCommitBoxHeight,
    lastCommitDetails,
    loadRecentCommitMessages,
    loadLastCommit,
    selectHistoricalFileDiff,
    selectedHistoricalFilePath,
    openFileInEditor,
    revealFileInOS,
    stageFile,
    unstageFile,
    isRightPanelOpen,
    openRightPanel,
    closeRightPanel,
    isMerging,
    mergeMessage,
    mergeSourceBranch,
    conflictedCount,
    openConflictsDialog,
    openThreeWayMerge,
    abortCurrentMerge,
    completeMergeCommit,
  } = useAppStore();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAmendDropdownOpen, setIsAmendDropdownOpen] = useState(false);
  const [isAmendFilesCollapsed, setIsAmendFilesCollapsed] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const amendDropdownRef = useRef<HTMLDivElement>(null);
  const historyPopupRef = useRef<HTMLDivElement>(null);

  const currentProject = projects.find((p) => p.id === activeProjectId);

  const conflictFiles = files.filter((f) => f.status === 'conflict');
  const changesFiles = files.filter((f) => f.group === 'changes' && f.status !== 'conflict');
  const unversionedFiles = files.filter((f) => f.group === 'unversioned');

  // Progressive/windowed rendering for massive file changes (e.g. 30,000+ files)
  const [visibleChangesCount, setVisibleChangesCount] = useState(150);
  const [visibleUnversionedCount, setVisibleUnversionedCount] = useState(150);

  useEffect(() => {
    setVisibleChangesCount(150);
    setVisibleUnversionedCount(150);
  }, [activeProjectId]);

  const displayedChanges = changesFiles.slice(0, visibleChangesCount);
  const hasMoreChanges = changesFiles.length > visibleChangesCount;

  const displayedUnversioned = unversionedFiles.slice(0, visibleUnversionedCount);
  const hasMoreUnversioned = unversionedFiles.length > visibleUnversionedCount;

  const checkedChanges = changesFiles.filter((f) => f.checked);
  const checkedUnversioned = unversionedFiles.filter((f) => f.checked);
  const totalChecked = files.filter((f) => f.checked);

  // Statistics
  const addedCount = files.filter((f) => f.checked && (f.status === 'added' || f.status === 'untracked')).length;
  const modifiedCount = files.filter((f) => f.checked && f.status === 'modified').length;

  const getGroupCheckboxIcon = (total: number, checked: number) => {
    if (total === 0 || checked === 0) {
      return <Square className="w-3.5 h-3.5 text-gray-500 hover:text-white" />;
    }
    if (checked === total) {
      return <CheckSquare className="w-3.5 h-3.5 text-sky-400" />;
    }
    return <MinusSquare className="w-3.5 h-3.5 text-sky-400" />;
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        historyRef.current &&
        !historyRef.current.contains(target) &&
        historyPopupRef.current &&
        !historyPopupRef.current.contains(target)
      ) {
        setIsHistoryOpen(false);
      }
      if (amendDropdownRef.current && !amendDropdownRef.current.contains(target)) {
        setIsAmendDropdownOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsHistoryOpen(false);
        setIsAmendDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (currentProject?.path) {
      loadRecentCommitMessages(currentProject.path);
      loadLastCommit(currentProject.path);
    }
  }, [currentProject?.path, loadRecentCommitMessages, loadLastCommit]);

  const renderFileIcon = (fileName: string) => {
    if (fileName.endsWith('.sql')) {
      return <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
    if (fileName.endsWith('.md')) {
      return <FileText className="w-3.5 h-3.5 text-sky-300 shrink-0" />;
    }
    if (fileName.endsWith('.java')) {
      return (
        <span className="w-3.5 h-3.5 rounded bg-blue-600/90 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
          C
        </span>
      );
    }
    if (fileName.endsWith('.json') || fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
      return <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    }
    return <FileCode className="w-3.5 h-3.5 text-gray-400 shrink-0" />;
  };

  const renderStatusBadge = (status: GitFileItem['status']) => {
    switch (status) {
      case 'modified':
        return <span className="text-[10px] font-mono font-bold text-sky-400 ml-1">M</span>;
      case 'added':
        return <span className="text-[10px] font-mono font-bold text-emerald-400 ml-1">A</span>;
      case 'deleted':
        return <span className="text-[10px] font-mono font-bold text-rose-400 ml-1">D</span>;
      case 'conflict':
        return <span className="text-[10px] font-mono font-bold text-rose-500 bg-rose-500/20 px-1 rounded ml-1">C</span>;
      case 'untracked':
        return <span className="text-[10px] font-mono font-bold text-amber-400 ml-1">?</span>;
      default:
        return null;
    }
  };

  const handleRollbackClick = () => {
    const checkedPaths = totalChecked.map((f) => f.path);
    if (checkedPaths.length > 0) {
      openRollbackModal(checkedPaths);
    } else if (selectedFilePath) {
      openRollbackModal([selectedFilePath]);
    } else {
      alert(t.statusPanel.selectFilesToRollbackAlert);
    }
  };

  return (
    <div
      style={
        isRightPanelOpen
          ? { width: `${statusPanelWidth}px`, minWidth: `${statusPanelWidth}px`, maxWidth: `${statusPanelWidth}px` }
          : undefined
      }
      className={`bg-theme-panel border-r border-theme-border flex flex-col h-full select-none text-xs text-theme-main font-sans relative transition-colors ${
        isRightPanelOpen ? 'shrink-0' : 'flex-1'
      }`}
    >
      {/* 1. Header Tabs (Commit / Shelf / Log) */}
      <div className="h-9 px-2.5 border-b border-theme-border flex items-center justify-between bg-theme-header">
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-theme-subbar border border-theme-border shadow-inner">
          <button
            onClick={() => setActiveTab('commit')}
            className={`px-3 py-0.5 font-semibold rounded-md text-xs transition-all cursor-pointer ${
              activeTab === 'commit'
                ? 'bg-theme-card text-theme-main shadow-xs'
                : 'text-theme-muted hover:text-theme-main'
            }`}
          >
            {renderDualText(t.statusPanel.tabs.changes)}
          </button>
          <button
            onClick={() => setActiveTab('shelf')}
            className={`px-3 py-0.5 font-semibold rounded-md text-xs transition-all cursor-pointer ${
              activeTab === 'shelf'
                ? 'bg-theme-card text-theme-main shadow-xs'
                : 'text-theme-muted hover:text-theme-main'
            }`}
          >
            {renderDualText(t.statusPanel.tabs.shelf)}
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`px-3 py-0.5 font-semibold rounded-md text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'log'
                ? 'bg-theme-card text-theme-main shadow-xs'
                : 'text-theme-muted hover:text-theme-main'
            }`}
          >
            {renderDualText(t.statusPanel.tabs.log)}
          </button>
        </div>
      </div>

      {activeTab === 'log' ? (
        <GitLogPanel />
      ) : activeTab === 'shelf' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-theme-dim">
          <p className="text-xs font-medium text-theme-muted">{t.statusPanel.emptyState.clean}</p>
          <p className="text-[11px] text-theme-dim mt-1">{t.statusPanel.emptyState.cleanDesc}</p>
        </div>
      ) : (
        <>
          {/* 2. Sub-Toolbar (IDEA Exact Tools: Rollback, Refresh, Diff, View Mode, Collapse) */}
          <div className="h-8 px-2 border-b border-theme-border flex items-center justify-between bg-theme-subbar text-theme-muted">
        <div className="flex items-center gap-1">
          {/* Rollback */}
          <button
            onClick={handleRollbackClick}
            className="p-1 hover:text-theme-main hover:bg-theme-hover rounded transition cursor-pointer"
            title={t.statusPanel.toolbar.rollback}
          >
            <Undo2 className="w-3.5 h-3.5 text-theme-main" />
          </button>

          {/* Refresh */}
          <button
            onClick={() => currentProject && loadRepoData(currentProject.path, true)}
            className="p-1 hover:text-theme-main hover:bg-theme-hover rounded transition cursor-pointer"
            title={t.statusPanel.toolbar.refresh}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-theme-main ${isRepoLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          {/* Toggle Diff / Right Panel */}
          <button
            onClick={() => {
              if (isRightPanelOpen) {
                closeRightPanel();
              } else {
                if (selectedFilePath) {
                  setSelectedFile(selectedFilePath);
                } else if (files.length > 0) {
                  setSelectedFile(files[0].path);
                } else {
                  openRightPanel();
                }
              }
            }}
            className={`p-1 rounded transition cursor-pointer ${
              isRightPanelOpen
                ? 'text-sky-400 bg-sky-500/10'
                : 'hover:text-theme-main hover:bg-theme-hover text-theme-main'
            }`}
            title={t.statusPanel.toggleRightPanel(isRightPanelOpen)}
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Toggle View Mode: Flat List (IDEA Default) vs Tree View */}
          <button
            onClick={() => setViewStyle(viewStyle === 'flat' ? 'tree' : 'flat')}
            className="p-1 hover:text-theme-main hover:bg-theme-hover rounded transition cursor-pointer"
            title={viewStyle === 'flat' ? t.statusPanel.switchDirectoryTreeTooltip : t.statusPanel.switchFlatListTooltip}
          >
            {viewStyle === 'flat' ? (
              <List className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <FolderTree className="w-3.5 h-3.5 text-sky-400" />
            )}
          </button>

          {/* Settings */}
          <button className="p-1 hover:text-theme-main hover:bg-theme-hover rounded transition cursor-pointer" title={t.statusPanel.viewOptionsTooltip}>
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Merge In Progress Banner */}
      {(isMerging || conflictFiles.length > 0) && (
        <div
          className={`px-3 py-2 border-b flex items-center justify-between text-xs transition ${
            conflictFiles.length > 0
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
            {conflictFiles.length > 0 ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <div className="truncate">
              <span className="font-bold">
                {conflictFiles.length > 0
                  ? t.statusPanel.conflictBannerCount(conflictFiles.length)
                  : t.statusPanel.conflictBannerResolved}
              </span>
              {mergeSourceBranch && (
                <span className="text-[10px] text-theme-dim ml-1.5 font-mono">
                  ({mergeSourceBranch})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {conflictFiles.length > 0 ? (
              <button
                onClick={() => openThreeWayMerge(conflictFiles[0].path)}
                className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
                title={t.statusPanel.threeWayMergeTooltip}
              >
                <ArrowRightLeft className="w-3 h-3" />
                <span>{t.statusPanel.mergeBtn}</span>
              </button>
            ) : (
              <button
                onClick={() => completeMergeCommit()}
                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <Check className="w-3 h-3" />
                <span>{t.statusPanel.completeMerge}</span>
              </button>
            )}
            <button
              onClick={abortCurrentMerge}
              className="p-1 rounded text-theme-dim hover:text-rose-400 hover:bg-theme-hover transition cursor-pointer text-[11px]"
              title={t.statusPanel.abortMerge}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3. File Groupings Tree: Conflicts, Changes & Unversioned */}
      <div className="flex-1 overflow-y-auto py-1 font-mono text-xs">
        {projects.length === 0 ? (
          <div className="p-6 text-center text-theme-dim font-sans text-xs flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-theme-muted font-medium">{t.statusPanel.noProjectTitle}</p>
            <p className="text-[11px] text-theme-dim">{t.statusPanel.noProjectDesc}</p>
          </div>
        ) : isRepoLoading && files.length === 0 ? (
          <div className="p-8 text-center text-gray-400 font-sans text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />
            <p className="text-gray-400">{t.statusPanel.loadingWorkspace}</p>
          </div>
        ) : files.length === 0 ? (
          <div className="p-4 text-center text-gray-500 font-sans text-xs">
            <p>{t.statusPanel.emptyState.clean}</p>
            <p className="text-[11px] text-gray-600 mt-1">{t.statusPanel.emptyState.cleanDesc}</p>
          </div>
        ) : null}

        {/* Group 0: Merge Conflicts (置顶展示) */}
        {conflictFiles.length > 0 && (
          <div className="mb-1 border-b border-rose-500/20 bg-rose-500/5">
            <div className="px-2 py-1 flex items-center justify-between hover:bg-rose-500/10 group cursor-pointer text-theme-main">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroupCollapsed('conflicts');
                  }}
                  className="p-0.5 hover:text-theme-main text-rose-400"
                >
                  {groupCollapsed.conflicts ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>

                <div
                  onClick={() => toggleGroupCollapsed('conflicts')}
                  className="font-sans font-bold text-rose-400 text-xs truncate flex-1 flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>{t.statusPanel.groups.conflicts}</span>
                  <span className="font-normal text-rose-400/80 text-[11px]">
                    {t.statusPanel.conflictsCountTitle(conflictFiles.length)}
                  </span>
                </div>
              </div>

              {/* Group quick actions: Resolve (Conflicts dialog) + Merge... (3-Way Merge) */}
              <div className="flex items-center gap-1 mr-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openConflictsDialog();
                  }}
                  className="px-2 py-0.5 rounded text-[11px] text-[#3574f0] hover:bg-[#3574f0]/10 font-bold transition cursor-pointer"
                  title={t.statusPanel.conflictsDialogTooltip}
                >
                  Resolve
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openThreeWayMerge(conflictFiles[0].path);
                  }}
                  className="px-2 py-0.5 rounded text-[11px] text-theme-muted hover:text-theme-main hover:bg-theme-hover font-medium transition cursor-pointer"
                  title={t.statusPanel.threeWayMergeTooltip}
                >
                  Merge...
                </button>
              </div>
            </div>

            {!groupCollapsed.conflicts &&
              conflictFiles.map((file) => {
                const isSelected = file.path === selectedFilePath;
                return (
                  <div
                    key={file.path}
                    onClick={() => {
                      setSelectedFile(file.path);
                    }}
                    onDoubleClick={() => openThreeWayMerge(file.path)}
                    className={`px-3 py-1.5 flex flex-col justify-center cursor-pointer transition text-[11px] border-l-2 group/row gap-0.5 ${
                      isSelected
                        ? 'bg-rose-500/20 text-rose-200 border-rose-500 shadow-2xs'
                        : 'border-transparent hover:bg-rose-500/10 text-rose-300'
                    }`}
                    title={file.path}
                  >
                    {/* Top Line: Badge C + Icon + FileName + Conflict Action */}
                    <div className="flex items-center justify-between gap-1.5 min-w-0 w-full">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="w-3.5 h-3.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[9px] font-bold flex items-center justify-center shrink-0">
                          C
                        </span>

                        {renderFileIcon(file.fileName)}

                        <span
                          className={`truncate whitespace-nowrap text-xs font-semibold ${
                            isSelected ? 'text-white font-bold' : 'text-rose-300'
                          }`}
                          title={file.path}
                        >
                          {file.fileName}
                        </span>
                      </div>

                      {/* Conflict Row Action: Reveal Folder & Merge... button */}
                      <div className="flex items-center gap-1 shrink-0 ml-auto">
                        <div className="flex items-center gap-0.5 text-theme-dim opacity-50 group-hover/row:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              revealFileInOS(file.path);
                            }}
                            className="p-1 hover:text-amber-400 hover:bg-theme-hover rounded transition cursor-pointer"
                            title={t.diff.revealInExplorerTooltip}
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(file.path);
                            openThreeWayMerge(file.path);
                          }}
                          className="px-2 py-0.5 rounded text-[11px] text-[#3574f0] hover:bg-[#3574f0]/10 font-semibold transition cursor-pointer"
                          title={t.statusPanel.threeWayMergeTooltip}
                        >
                          Merge...
                        </button>
                      </div>
                    </div>

                    {/* Bottom Line (Stacked): Directory Path */}
                    {file.dirPath && (
                      <div className="pl-[26px] min-w-0 w-full flex items-center">
                        <span
                          className="text-[10px] font-mono truncate text-rose-300/70"
                          title={file.path}
                        >
                          {file.dirPath}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* Group 1: Changes */}
        {changesFiles.length > 0 && (
          <div>
            <div className="px-2 py-1 flex items-center justify-between hover:bg-theme-hover group cursor-pointer text-theme-main">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroupCollapsed('changes');
                  }}
                  className="p-0.5 hover:text-theme-main text-theme-dim"
                >
                  {groupCollapsed.changes ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>

                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroupCheck('changes', checkedChanges.length !== changesFiles.length);
                  }}
                  className="cursor-pointer"
                >
                  {getGroupCheckboxIcon(changesFiles.length, checkedChanges.length)}
                </div>

                <span
                  onClick={() => toggleGroupCollapsed('changes')}
                  className="font-sans font-semibold text-theme-main text-xs truncate flex-1"
                >
                  Changes <span className="font-normal text-theme-dim text-[11px]">{changesFiles.length} files</span>
                </span>
              </div>

              {/* Group Hover Actions: Discard All & Stage All */}
              <div className="hidden group-hover:flex items-center gap-0.5 text-theme-dim mr-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openRollbackModal(changesFiles.map((f) => f.path));
                  }}
                  className="p-1 hover:text-rose-400 hover:bg-theme-hover rounded transition cursor-pointer"
                  title={t.statusPanel.discardAllChangesTooltip}
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroupCheck('changes', true);
                  }}
                  className="p-1 hover:text-emerald-400 hover:bg-theme-hover rounded transition cursor-pointer"
                  title={t.statusPanel.stageAllChangesTooltip}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {!groupCollapsed.changes && (
              <>
                {displayedChanges.map((file) => {
                  const isSelected = file.path === selectedFilePath;
                  return (
                    <div
                      key={file.path}
                      onClick={() => setSelectedFile(file.path)}
                      className={`mx-1.5 my-0.5 px-2.5 py-1.5 rounded-lg flex flex-col justify-center cursor-pointer transition-all text-[11px] border group/row gap-0.5 ${
                        isSelected
                          ? 'bg-theme-active text-theme-active-text border-theme-border-active shadow-2xs font-medium'
                          : 'border-transparent hover:bg-theme-hover text-theme-main'
                      }`}
                      title={file.path}
                    >
                      {/* Top Line: Checkbox + Icon + FileName (truncate) + Right Actions & Status Badge */}
                      <div className="flex items-center justify-between gap-1.5 min-w-0 w-full">
                        {/* Left: Checkbox + File Icon + File Name */}
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFileCheck(file.path);
                            }}
                            className="cursor-pointer shrink-0"
                          >
                            {file.checked ? (
                              <CheckSquare className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-theme-dim hover:text-theme-main shrink-0" />
                            )}
                          </div>

                          {renderFileIcon(file.fileName)}

                          <span
                            className={`truncate whitespace-nowrap text-xs font-semibold ${
                              isSelected ? 'text-theme-active-text font-bold' : 'text-theme-main'
                            }`}
                            title={file.path}
                          >
                            {file.fileName}
                          </span>
                        </div>

                        {/* Right: Hover Action Icons + Status Badge */}
                        <div className="shrink-0 flex items-center gap-1 ml-auto">
                          {/* Hover Actions: reveal cleanly in-place on card hover without pushing filename */}
                          <div className="hidden group-hover/row:flex items-center gap-0.5 bg-theme-card px-1 py-0.5 rounded border border-theme-border-card shadow-xs">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openFileInEditor(file.path);
                              }}
                              className="p-0.5 hover:text-sky-400 hover:bg-theme-card-hover rounded transition cursor-pointer"
                              title={t.statusPanel.openInInternalEditorTooltip}
                            >
                              <FileEdit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                revealFileInOS(file.path);
                              }}
                              className="p-0.5 hover:text-amber-400 hover:bg-theme-card-hover rounded transition cursor-pointer"
                              title={t.diff.revealInExplorerTooltip}
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRollbackModal([file.path]);
                              }}
                              className="p-0.5 hover:text-rose-400 hover:bg-theme-card-hover rounded transition cursor-pointer"
                              title={t.statusPanel.discardFileTooltip}
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (file.checked) {
                                  unstageFile(file.path);
                                } else {
                                  stageFile(file.path);
                                }
                              }}
                              className={`p-0.5 hover:bg-theme-card-hover rounded transition cursor-pointer ${
                                file.checked ? 'hover:text-amber-400' : 'hover:text-emerald-400'
                              }`}
                              title={file.checked ? t.statusPanel.unstageFileTooltip : t.statusPanel.stageFileTooltip}
                            >
                              {file.checked ? (
                                <Minus className="w-3.5 h-3.5 text-sky-400" />
                              ) : (
                                <Plus className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {renderStatusBadge(file.status)}
                        </div>
                      </div>

                      {/* Bottom Line (Stacked): Directory Path neatly indented under filename */}
                      {file.dirPath && (
                        <div className="pl-[26px] min-w-0 w-full flex items-center">
                          <span
                            className={`text-[10px] font-mono truncate ${
                              isSelected ? 'text-theme-active-dim' : 'text-theme-dim opacity-75'
                            }`}
                            title={file.path}
                          >
                            {file.dirPath}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {hasMoreChanges && (
                  <div className="px-3 py-2 flex items-center justify-between text-[11px] bg-theme-hover/60 border-t border-theme-border/40 text-theme-dim select-none">
                    <span>
                      {t.statusPanel.showingItems(displayedChanges.length, changesFiles.length)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setVisibleChangesCount((c) => Math.min(changesFiles.length, c + 200))}
                        className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-medium transition cursor-pointer"
                      >
                        {t.statusPanel.loadMore(200)}
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisibleChangesCount(changesFiles.length)}
                        className="px-2 py-0.5 rounded hover:bg-theme-hover text-theme-dim hover:text-theme-main transition cursor-pointer"
                      >
                        {t.statusPanel.showAll}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Group 2: Unversioned Files */}
        {unversionedFiles.length > 0 && (
          <div className="mt-2">
            <div className="px-2 py-1 flex items-center justify-between hover:bg-theme-hover group cursor-pointer text-theme-main">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroupCollapsed('unversioned');
                  }}
                  className="p-0.5 hover:text-theme-main text-theme-dim"
                >
                  {groupCollapsed.unversioned ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>

                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroupCheck('unversioned', checkedUnversioned.length !== unversionedFiles.length);
                  }}
                  className="cursor-pointer"
                >
                  {getGroupCheckboxIcon(unversionedFiles.length, checkedUnversioned.length)}
                </div>

                <span
                  onClick={() => toggleGroupCollapsed('unversioned')}
                  className="font-sans font-semibold text-theme-main text-xs truncate flex-1"
                >
                  Unversioned Files{' '}
                  <span className="font-normal text-theme-dim text-[11px]">{unversionedFiles.length} files</span>
                </span>
              </div>

              {/* Group Hover Actions: Discard All & Stage All */}
              <div className="hidden group-hover:flex items-center gap-0.5 text-theme-dim mr-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openRollbackModal(unversionedFiles.map((f) => f.path));
                  }}
                  className="p-1 hover:text-rose-400 hover:bg-theme-hover rounded transition cursor-pointer"
                  title={t.statusPanel.discardAllUnversionedTooltip}
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroupCheck('unversioned', true);
                  }}
                  className="p-1 hover:text-emerald-400 hover:bg-theme-hover rounded transition cursor-pointer"
                  title={t.statusPanel.stageAllUnversionedTooltip}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {!groupCollapsed.unversioned && (
              <>
                {displayedUnversioned.map((file) => {
                  const isSelected = file.path === selectedFilePath;
                  return (
                    <div
                      key={file.path}
                      onClick={() => setSelectedFile(file.path)}
                      className={`px-3 py-1.5 flex flex-col justify-center cursor-pointer transition text-[11px] border-l-2 group/row gap-0.5 ${
                        isSelected
                          ? 'bg-theme-active text-theme-active-text border-theme-border-active shadow-2xs'
                          : 'border-transparent hover:bg-theme-hover text-theme-main'
                      }`}
                      title={file.path}
                    >
                      {/* Top Line: Checkbox + Icon + FileName (truncate) + Right Actions & Status Badge */}
                      <div className="flex items-center justify-between gap-1.5 min-w-0 w-full">
                        {/* Left: Checkbox + File Icon + File Name */}
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFileCheck(file.path);
                            }}
                            className="cursor-pointer shrink-0"
                          >
                            {file.checked ? (
                              <CheckSquare className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-theme-dim hover:text-theme-main shrink-0" />
                            )}
                          </div>

                          {renderFileIcon(file.fileName)}

                          <span
                            className={`truncate whitespace-nowrap text-xs font-semibold ${
                              isSelected ? 'text-theme-active-text font-bold' : 'text-theme-main'
                            }`}
                            title={file.path}
                          >
                            {file.fileName}
                          </span>
                        </div>

                        {/* Right: Hover Action Icons + Status Badge */}
                        <div className="shrink-0 flex items-center gap-1 ml-auto">
                          {/* Hover Actions: reveal cleanly in-place on card hover without pushing filename */}
                          <div className="hidden group-hover/row:flex items-center gap-0.5 bg-theme-card px-1 py-0.5 rounded border border-theme-border-card shadow-xs">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openFileInEditor(file.path);
                              }}
                              className="p-0.5 hover:text-sky-400 hover:bg-theme-card-hover rounded transition cursor-pointer"
                              title={t.statusPanel.openInInternalEditorTooltip}
                            >
                              <FileEdit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                revealFileInOS(file.path);
                              }}
                              className="p-0.5 hover:text-amber-400 hover:bg-theme-card-hover rounded transition cursor-pointer"
                              title={t.diff.revealInExplorerTooltip}
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRollbackModal([file.path]);
                              }}
                              className="p-0.5 hover:text-rose-400 hover:bg-theme-card-hover rounded transition cursor-pointer"
                              title={t.statusPanel.discardFileTooltip}
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (file.checked) {
                                  unstageFile(file.path);
                                } else {
                                  stageFile(file.path);
                                }
                              }}
                              className={`p-0.5 hover:bg-theme-card-hover rounded transition cursor-pointer ${
                                file.checked ? 'hover:text-amber-400' : 'hover:text-emerald-400'
                              }`}
                              title={file.checked ? t.statusPanel.unstageFileTooltip : t.statusPanel.stageFileTooltip}
                            >
                              {file.checked ? (
                                <Minus className="w-3.5 h-3.5 text-sky-400" />
                              ) : (
                                <Plus className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {renderStatusBadge(file.status)}
                        </div>
                      </div>

                      {/* Bottom Line (Stacked): Directory Path neatly indented under filename */}
                      {file.dirPath && (
                        <div className="pl-[26px] min-w-0 w-full flex items-center">
                          <span
                            className={`text-[10px] font-mono truncate ${
                              isSelected ? 'text-theme-active-dim' : 'text-theme-dim opacity-75'
                            }`}
                            title={file.path}
                          >
                            {file.dirPath}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {hasMoreUnversioned && (
                  <div className="px-3 py-2 flex items-center justify-between text-[11px] bg-theme-hover/60 border-t border-theme-border/40 text-theme-dim select-none">
                    <span>
                      {t.statusPanel.showingItems(displayedUnversioned.length, unversionedFiles.length)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setVisibleUnversionedCount((c) => Math.min(unversionedFiles.length, c + 200))}
                        className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-medium transition cursor-pointer"
                      >
                        {t.statusPanel.loadMore(200)}
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisibleUnversionedCount(unversionedFiles.length)}
                        className="px-2 py-0.5 rounded hover:bg-theme-hover text-theme-dim hover:text-theme-main transition cursor-pointer"
                      >
                        {t.statusPanel.showAll}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Amend Node: Previous Commit Files */}
        {isAmend && lastCommitDetails && lastCommitDetails.files && lastCommitDetails.files.length > 0 && (
          <div>
            <div className="px-2 py-1 flex items-center justify-between hover:bg-theme-hover group cursor-pointer text-theme-main">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAmendFilesCollapsed(!isAmendFilesCollapsed);
                  }}
                  className="p-0.5 hover:text-theme-main text-theme-dim"
                >
                  {isAmendFilesCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>

                <GitCommit className="w-3.5 h-3.5 text-blue-400 shrink-0" />

                <span
                  onClick={() => setIsAmendFilesCollapsed(!isAmendFilesCollapsed)}
                  className="font-sans font-medium text-theme-main text-xs truncate"
                  title={lastCommitDetails.subject}
                >
                  {lastCommitDetails.subject}{' '}
                  <span className="font-normal text-theme-dim text-[11px]">
                    {lastCommitDetails.files.length} files
                  </span>
                </span>
              </div>
            </div>

            {!isAmendFilesCollapsed &&
              lastCommitDetails.files.map((file) => {
                const fileName = file.path.split('/').pop() || file.path;
                const dirPath = file.path.substring(0, file.path.lastIndexOf('/'));
                const isSelected = file.path === selectedHistoricalFilePath;

                return (
                  <div
                    key={file.path}
                    onClick={() => selectHistoricalFileDiff(lastCommitDetails.hash, file.path)}
                    className={`px-3 py-1.5 flex flex-col justify-center cursor-pointer transition text-[11px] border-l-2 group/row gap-0.5 ${
                      isSelected
                        ? 'bg-theme-active text-theme-active-text border-theme-border-active shadow-2xs'
                        : 'border-transparent hover:bg-theme-hover text-theme-main'
                    }`}
                    title={file.path}
                  >
                    {/* Top Line: Icon + FileName + Actions + Status */}
                    <div className="flex items-center justify-between gap-1.5 min-w-0 w-full">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {renderFileIcon(fileName)}
                        <span
                          className={`truncate whitespace-nowrap text-xs font-semibold ${
                            isSelected ? 'text-theme-active-text font-bold' : 'text-theme-main'
                          }`}
                          title={file.path}
                        >
                          {fileName}
                        </span>
                      </div>

                      <div className="shrink-0 flex items-center gap-1 ml-auto">
                        <div className="flex items-center gap-0.5 text-theme-dim opacity-50 group-hover/row:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              revealFileInOS(file.path);
                            }}
                            className="p-0.5 hover:text-amber-400 hover:bg-theme-card-hover rounded transition cursor-pointer"
                            title={t.diff.revealInExplorerTooltip}
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="font-mono text-[10px] font-bold text-sky-400">
                          {file.statusCode || 'M'}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Line (Stacked): Directory Path */}
                    {dirPath && (
                      <div className="pl-[18px] min-w-0 w-full flex items-center">
                        <span
                          className={`text-[10px] font-mono truncate ${
                            isSelected ? 'text-theme-active-dim' : 'text-theme-dim opacity-75'
                          }`}
                          title={file.path}
                        >
                          {dirPath}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Resizable Divider: Between File Tree and Commit Message Box */}
      <VerticalResizeDivider
        currentHeight={commitBoxHeight}
        minHeight={110}
        maxHeight={480}
        onResize={setCommitBoxHeight}
        onDoubleClickReset={() => setCommitBoxHeight(190)}
        title={t.statusPanel.dragResizeCommitBox}
        direction="up-expands"
      />

      {/* 4. Commit Message & Controls Area */}
      <div
        style={{ height: `${commitBoxHeight}px` }}
        className="border-t border-theme-border bg-theme-panel/70 p-3 flex flex-col gap-2 shrink-0 relative select-none"
      >
        {/* Top Control Line: Amend last commit ▾, History clock, and Statistics */}
        <div className="flex items-center justify-between text-[11px] select-none shrink-0">
          <div className="flex items-center gap-1.5">
            <label className="flex items-center gap-1.5 cursor-pointer text-theme-muted hover:text-theme-main">
              <input
                type="checkbox"
                checked={isAmend}
                onChange={(e) => setIsAmend(e.target.checked)}
                className="rounded border-theme-border-card bg-theme-card text-blue-500 focus:ring-0 cursor-pointer"
              />
              <span>{t.statusPanel.commitBox.amend}</span>
            </label>

            {isAmend ? (
              <div className="relative" ref={amendDropdownRef}>
                <button
                  onClick={() => setIsAmendDropdownOpen(!isAmendDropdownOpen)}
                  className="flex items-center gap-0.5 text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                  title={t.statusPanel.expandLastCommitTooltip}
                >
                  <span>last commit</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {isAmendDropdownOpen && (
                  <div className="absolute left-0 bottom-6 z-50 w-80 theme-dropdown-panel rounded-lg shadow-2xl py-1 text-xs text-theme-main">
                    <div
                      onClick={() => {
                        if (lastCommitDetails) {
                          const fullMsg = lastCommitDetails.body
                            ? `${lastCommitDetails.subject}\n\n${lastCommitDetails.body}`
                            : lastCommitDetails.subject;
                          setCommitMessage(fullMsg);
                        }
                        setIsAmendDropdownOpen(false);
                      }}
                      className="px-3 py-1.5 hover:bg-blue-500/15 hover:text-blue-400 cursor-pointer flex items-center gap-1.5 text-xs text-theme-main truncate"
                    >
                      <span className="text-blue-400 font-bold">✓</span>
                      <span className="font-semibold text-theme-dim shrink-0">last commit</span>
                      <span className="truncate text-theme-muted" title={lastCommitDetails?.subject}>
                        {lastCommitDetails?.subject || t.statusPanel.lastCommitTitle}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-theme-muted">last commit</span>
            )}

            {/* Commit Message History Clock Button */}
            <div className="relative" ref={historyRef}>
              <button
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className={`p-1 rounded transition cursor-pointer ml-0.5 ${
                  isHistoryOpen
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-theme-dim hover:text-theme-main hover:bg-theme-hover'
                }`}
                title={t.statusPanel.commitHistoryTooltip}
              >
                <Clock className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Statistics summary */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            {addedCount > 0 && (
              <span className="text-emerald-400 font-medium">{addedCount} added</span>
            )}
            {modifiedCount > 0 && (
              <span className="text-sky-400 font-medium">{modifiedCount} modified</span>
            )}
          </div>
        </div>

        {/* Floating Commit Message History Popup (1:1 IDEA media_1788940060844) */}
        {isHistoryOpen && (
          <div
            ref={historyPopupRef}
            className="absolute left-2.5 right-2.5 bottom-[calc(100%-8px)] z-50 theme-dropdown-panel rounded-md shadow-2xl overflow-hidden flex flex-col text-xs text-theme-main max-h-56"
          >
            <div className="flex-1 overflow-y-auto divide-y divide-theme-border/30">
              {commitHistory.length === 0 ? (
                <div className="px-3 py-2 text-theme-dim text-[11px]">{t.statusPanel.noHistoryYet}</div>
              ) : (
                commitHistory.map((msg, idx) => {
                  const isSelected = commitMessage.trim() === msg.trim();
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setCommitMessage(msg);
                        setIsHistoryOpen(false);
                      }}
                      className={`px-3 py-1.5 cursor-pointer truncate text-[11.5px] transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white font-medium'
                          : 'hover:bg-blue-500/15 hover:text-blue-500 text-theme-main'
                      }`}
                      title={msg}
                    >
                      {msg}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Textarea: Flex-1 to adapt to dragging height smoothly */}
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder={t.statusPanel.commitBox.placeholder}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              commit(false);
            }
          }}
          className="w-full flex-1 min-h-[48px] bg-theme-input border border-theme-border-card rounded-xl p-2.5 text-xs text-theme-main placeholder-theme-dim focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none font-sans shadow-2xs transition-all"
        />

        {/* Action Buttons: [ Commit / Amend Commit / Commit Merge ] */}
        <div className="flex items-center justify-between gap-2 pt-0.5 shrink-0">
          <div className="flex items-center gap-2 flex-1">
            {conflictFiles.length > 0 ? (
              <button
                disabled
                className="px-3.5 py-1.5 bg-rose-600/20 text-rose-300 border border-rose-500/40 cursor-not-allowed rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5"
                title={t.statusPanel.cannotCommitConflicts(conflictFiles.length)}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>{t.statusPanel.groups.conflicts} ({conflictFiles.length})</span>
              </button>
            ) : (
              <>
                {/* Primary Commit Button (样式与布局保持完全一致) */}
                <button
                  disabled={!(commitMessage || '').trim() || (totalChecked.length === 0 && !isMerging)}
                  onClick={() => commit(false)}
                  className="px-4 py-2 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-blue-500/25 cursor-pointer shrink-0 whitespace-nowrap border border-blue-400/30"
                  title={isAmend ? t.statusPanel.commitBox.amend : t.statusPanel.commitBox.commitBtn}
                >
                  {isAmend ? renderDualText(t.statusPanel.commitBox.amend) : renderDualText(t.statusPanel.commitBox.commitBtn)}
                </button>

                {/* Secondary Commit and Push Button (样式与布局保持完全一致) */}
                <button
                  disabled={!(commitMessage || '').trim() || (totalChecked.length === 0 && !isMerging)}
                  onClick={() => commit(true)}
                  className="px-4 py-2 bg-theme-card hover:bg-theme-card-hover active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-theme-main border border-theme-border-card rounded-xl text-xs font-medium flex items-center justify-center gap-1 transition-all shadow-2xs cursor-pointer shrink-0 whitespace-nowrap"
                  title={t.statusPanel.commitBox.commitAndPushBtn}
                >
                  <span className="whitespace-nowrap font-medium">
                    {t.statusPanel.commitBox.commitAndPushShort || renderDualText(t.statusPanel.commitBox.commitAndPushBtn)}
                  </span>
                </button>
              </>
            )}
          </div>

          <button className="p-1.5 text-theme-dim hover:text-theme-main hover:bg-theme-hover rounded-lg transition cursor-pointer">
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      </>
      )}

      {/* 5. Rollback Modal (Safe confirmation dialog) */}
      {rollbackModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center select-none">
          <div className="bg-theme-card border border-theme-border-card rounded shadow-2xl p-4 w-96 text-xs text-theme-main">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{t.statusPanel.toolbar.rollback}</span>
            </div>
            <p className="text-theme-muted mb-3">
              {t.statusPanel.rollbackConfirmDescription(rollbackModal.targetPaths.length)}
            </p>
            <div className="max-h-36 overflow-y-auto bg-theme-input p-2 rounded border border-theme-border-card font-mono text-[11px] mb-4 text-theme-dim">
              {rollbackModal.targetPaths.map((p) => (
                <div key={p} className="truncate">
                  {p}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={closeRollbackModal}
                className="px-3 py-1.5 bg-theme-hover hover:bg-theme-border-card text-theme-main rounded transition cursor-pointer"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={confirmRollback}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium transition cursor-pointer"
              >
                {t.statusPanel.toolbar.rollback}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
