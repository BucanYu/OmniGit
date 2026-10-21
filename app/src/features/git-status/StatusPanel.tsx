import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../locales';
import { GitLogPanel } from '../git-log/GitLogPanel';
import { VerticalResizeDivider } from '../../components/ui/VerticalResizeDivider';
import {
  Undo2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { StatusHeader } from './components/StatusHeader';
import { StatusMergeBanner } from './components/StatusMergeBanner';
import { StatusConflictGroup } from './components/StatusConflictGroup';
import {
  StatusFileItem,
  getGroupCheckboxIcon,
  renderFileIcon,
  renderStatusBadge,
} from './components/StatusFileItem';
import { StatusAmendFilesDrawer } from './components/StatusAmendFilesDrawer';
import { StatusCommitBox } from './components/StatusCommitBox';
import { StatusRollbackModal } from './components/StatusRollbackModal';

// Re-export helpers for backward compatibility
export { renderFileIcon, renderStatusBadge, getGroupCheckboxIcon };

export function StatusPanel() {
  const { t } = useTranslation();
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
    mergeSourceBranch,
    openConflictsDialog,
    openThreeWayMerge,
    abortCurrentMerge,
    completeMergeCommit,
  } = useAppStore();

  const currentProject = projects.find((p) => p.id === activeProjectId);

  const conflictFiles = files.filter((f) => f.status === 'conflict');
  const changesFiles = files.filter((f) => f.group === 'changes' && f.status !== 'conflict');
  const unversionedFiles = files.filter((f) => f.group === 'unversioned');

  // Progressive rendering for large changes
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

  const addedCount = totalChecked.filter((f) => f.status === 'added' || f.status === 'untracked').length;
  const modifiedCount = totalChecked.filter((f) => f.status === 'modified' || f.status === 'deleted').length;

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
      {/* 1. Header & Sub-toolbar */}
      <StatusHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        statusPanelWidth={statusPanelWidth}
        isRightPanelOpen={isRightPanelOpen}
        isRepoLoading={isRepoLoading}
        viewStyle={viewStyle}
        onRollbackClick={handleRollbackClick}
        onRefresh={() => currentProject && loadRepoData(currentProject.path, true)}
        onToggleRightPanel={() => {
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
        onToggleViewStyle={() => setViewStyle(viewStyle === 'flat' ? 'tree' : 'flat')}
      />

      {activeTab === 'log' ? (
        <GitLogPanel />
      ) : activeTab === 'shelf' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-theme-dim">
          <p className="text-xs font-medium text-theme-muted">{t.statusPanel.emptyState.clean}</p>
          <p className="text-[11px] text-theme-dim mt-1">{t.statusPanel.emptyState.cleanDesc}</p>
        </div>
      ) : (
        <>
          {/* 2. Merge In Progress Banner */}
          <StatusMergeBanner
            isMerging={isMerging}
            conflictFiles={conflictFiles}
            mergeSourceBranch={mergeSourceBranch}
            onOpenThreeWayMerge={openThreeWayMerge}
            onCompleteMerge={completeMergeCommit}
            onAbortMerge={abortCurrentMerge}
          />

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
            ) : (
              <>
                {/* Group 0: Conflicts */}
                <StatusConflictGroup
                  conflictFiles={conflictFiles}
                  collapsed={groupCollapsed.conflicts}
                  selectedFilePath={selectedFilePath}
                  onToggleCollapse={() => toggleGroupCollapsed('conflicts')}
                  onOpenConflictsDialog={openConflictsDialog}
                  onOpenThreeWayMerge={openThreeWayMerge}
                  onSelectFile={setSelectedFile}
                  onRevealInOS={revealFileInOS}
                />

                {/* Group 1: Changes (Unstaged) */}
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
                          {t.statusPanel.groups.unstaged}{' '}
                          <span className="font-normal text-theme-dim text-[11px]">
                            {t.statusPanel.fileCountFormat(changesFiles.length)}
                          </span>
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
                        {displayedChanges.map((file) => (
                          <StatusFileItem
                            key={file.path}
                            file={file}
                            isSelected={file.path === selectedFilePath}
                            onSelect={setSelectedFile}
                            onToggleCheck={toggleFileCheck}
                            onOpenInEditor={openFileInEditor}
                            onRevealInOS={revealFileInOS}
                            onRollback={(p) => openRollbackModal([p])}
                            onStage={stageFile}
                            onUnstage={unstageFile}
                          />
                        ))}

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
                          {t.statusPanel.groups.untracked}{' '}
                          <span className="font-normal text-theme-dim text-[11px]">
                            {t.statusPanel.fileCountFormat(unversionedFiles.length)}
                          </span>
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
                        {displayedUnversioned.map((file) => (
                          <StatusFileItem
                            key={file.path}
                            file={file}
                            isSelected={file.path === selectedFilePath}
                            onSelect={setSelectedFile}
                            onToggleCheck={toggleFileCheck}
                            onOpenInEditor={openFileInEditor}
                            onRevealInOS={revealFileInOS}
                            onRollback={(p) => openRollbackModal([p])}
                            onStage={stageFile}
                            onUnstage={unstageFile}
                          />
                        ))}

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
              </>
            )}

            {/* Amend Node: Previous Commit Files */}
            <StatusAmendFilesDrawer
              isAmend={isAmend}
              lastCommitDetails={lastCommitDetails}
              selectedHistoricalFilePath={selectedHistoricalFilePath}
              onSelectHistoricalFileDiff={selectHistoricalFileDiff}
              onRevealFileInOS={revealFileInOS}
            />
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
          <StatusCommitBox
            commitBoxHeight={commitBoxHeight}
            isAmend={isAmend}
            setIsAmend={setIsAmend}
            lastCommitDetails={lastCommitDetails}
            commitHistory={commitHistory}
            commitMessage={commitMessage}
            setCommitMessage={setCommitMessage}
            addedCount={addedCount}
            modifiedCount={modifiedCount}
            conflictFiles={conflictFiles}
            totalChecked={totalChecked}
            isMerging={isMerging}
            onCommit={commit}
          />
        </>
      )}

      {/* 5. Rollback Modal (Safe confirmation dialog) */}
      <StatusRollbackModal
        isOpen={rollbackModal.isOpen}
        targetPaths={rollbackModal.targetPaths}
        onClose={closeRollbackModal}
        onConfirm={confirmRollback}
      />
    </div>
  );
}
