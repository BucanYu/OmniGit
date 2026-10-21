import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  ArrowUpRight,
  GitBranch,
  AlertTriangle,
  Loader2,
  HelpCircle,
  ChevronDown,
  RefreshCw,
  Rocket,
} from 'lucide-react';
import { useAppStore, type OutgoingCommitFile, type OutgoingCommitItem } from '../../store/useAppStore';
import { useTranslation } from '../../locales';
import { ResizeDivider } from '../../components/ui/ResizeDivider';
import { PushDiffModal } from './PushDiffModal';
import {
  type CommitContextMenuState,
  type FileContextMenuState,
  type SelectiveModalState,
  type DiffModalState,
} from './types';
import { buildFileTree } from './utils/pushModalUtils';
import { CommitContextMenu } from './components/CommitContextMenu';
import { FileContextMenu } from './components/FileContextMenu';
import { SelectivePushModal } from './components/SelectivePushModal';
import { PushBranchDropdown } from './components/PushBranchDropdown';
import { PushCommitListPane } from './components/PushCommitListPane';
import { PushChangedFilesPane } from './components/PushChangedFilesPane';

// Re-export types & utilities to guarantee zero breaking changes for other modules
export * from './types';
export * from './utils/pushModalUtils';

export const PushCommitsModal: React.FC = () => {
  const { t } = useTranslation();
  const {
    isPushModalOpen,
    pushModalSourceBranch,
    pushModalTargetBranch,
    outgoingCommitsData,
    outgoingCommitsLoading,
    pushingLoading,
    pushError,
    closePushModal,
    executePush,
    switchPushSourceBranch,
    pushSelectedCommits,
    projects,
    branches,
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

  // Multi-select checked commits
  const [checkedCommitHashes, setCheckedCommitHashes] = useState<Set<string>>(new Set());

  // Source & Target branch selector states
  const [isSourceBranchDropdownOpen, setIsSourceBranchDropdownOpen] = useState(false);
  const [sourceBranchSearch, setSourceBranchSearch] = useState('');
  const [isTargetBranchDropdownOpen, setIsTargetBranchDropdownOpen] = useState(false);
  const [targetBranchSearch, setTargetBranchSearch] = useState('');

  // Mode B: Selective Push Popover state
  const [selectiveModal, setSelectiveModal] = useState<SelectiveModalState | null>(null);

  // File diff modal state (double click / context menu inspect)
  const [diffModalState, setDiffModalState] = useState<DiffModalState | null>(null);

  // File context menu state
  const [contextMenu, setContextMenu] = useState<FileContextMenuState | null>(null);

  // Commit context menu state
  const [commitContextMenu, setCommitContextMenu] = useState<CommitContextMenuState | null>(null);

  // Error diagnostic states
  const [isPulling, setIsPulling] = useState(false);

  // Left pane resizable width state
  const [pushModalLeftWidth, setPushModalLeftWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('omnigit_push_modal_left_width');
      return saved ? Math.max(200, Math.min(560, Number(saved))) : 340;
    } catch {
      return 340;
    }
  });

  const handleResizePushModalLeft = (newWidth: number) => {
    setPushModalLeftWidth(newWidth);
    try {
      localStorage.setItem('omnigit_push_modal_left_width', String(newWidth));
    } catch {}
  };

  // Close menus on outside click or Esc
  useEffect(() => {
    const handleClose = () => {
      setContextMenu(null);
      setCommitContextMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setCommitContextMenu(null);
        setIsSourceBranchDropdownOpen(false);
        setIsTargetBranchDropdownOpen(false);
      }
    };
    if (contextMenu || commitContextMenu || isSourceBranchDropdownOpen || isTargetBranchDropdownOpen) {
      window.addEventListener('click', handleClose);
      window.addEventListener('contextmenu', handleClose);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, commitContextMenu, isSourceBranchDropdownOpen, isTargetBranchDropdownOpen]);

  const getCommitHashForFile = (file: OutgoingCommitFile) => {
    if (selectedCommitHash) return selectedCommitHash;
    const found = outgoingCommitsData?.commits.find((c) =>
      c.files?.some((f) => f.path === file.path)
    );
    return found?.hash || outgoingCommitsData?.commits[0]?.hash || '';
  };

  const openDiffForFile = (file: OutgoingCommitFile) => {
    const commitHash = getCommitHashForFile(file);
    const commit = outgoingCommitsData?.commits.find((c) => c.hash === commitHash);
    setDiffModalState({
      isOpen: true,
      filePath: file.path,
      commitHash,
      commitMessage: commit?.subject,
    });
  };

  // Derive which commit is active
  const effectiveSelectedCommit = useMemo(() => {
    if (!outgoingCommitsData?.commits || outgoingCommitsData.commits.length === 0) return null;
    if (selectedCommitHash) {
      const found = outgoingCommitsData.commits.find((item) => item.hash === selectedCommitHash);
      if (found) return found;
    }
    return outgoingCommitsData.commits[0];
  }, [outgoingCommitsData, selectedCommitHash]);

  // Derive which files to display based on selected commit
  const displayedFiles = useMemo(() => {
    if (effectiveSelectedCommit && Array.isArray(effectiveSelectedCommit.files)) {
      return effectiveSelectedCommit.files;
    }
    return Array.isArray(outgoingCommitsData?.allFiles) ? outgoingCommitsData.allFiles : [];
  }, [effectiveSelectedCommit, outgoingCommitsData]);

  // Build hierarchical tree safely
  const fileTree = useMemo(() => buildFileTree(displayedFiles), [displayedFiles]);

  // Auto-expand folders smartly
  useEffect(() => {
    if (displayedFiles && displayedFiles.length > 0) {
      const allPaths = new Set<string>(['root']);
      const isLarge = displayedFiles.length > 150;
      displayedFiles.forEach((f) => {
        if (!f || !f.path) return;
        const parts = f.path.split('/');
        const maxDepth = isLarge ? 1 : parts.length - 1;
        for (let i = 0; i < Math.min(parts.length - 1, maxDepth); i++) {
          allPaths.add(parts.slice(0, i + 1).join('/'));
        }
      });
      setExpandedFolders(allPaths);
    }
  }, [displayedFiles]);

  // Auto-select first commit and check all commits when outgoing commits load
  useEffect(() => {
    if (outgoingCommitsData?.commits && outgoingCommitsData.commits.length > 0) {
      if (!selectedCommitHash || !outgoingCommitsData.commits.some((c) => c.hash === selectedCommitHash)) {
        setSelectedCommitHash(outgoingCommitsData.commits[0].hash);
      }
      setCheckedCommitHashes(new Set(outgoingCommitsData.commits.map((c) => c.hash)));
    } else {
      setSelectedCommitHash(null);
      setCheckedCommitHashes(new Set());
    }
  }, [outgoingCommitsData]);

  // Reset internal states on modal close
  useEffect(() => {
    if (!isPushModalOpen) {
      setSelectedCommitHash(null);
      setSelectedFilePath(null);
      setForcePushMode(false);
      setDiffModalState(null);
      setContextMenu(null);
      setCommitContextMenu(null);
      setSelectiveModal(null);
      setIsSourceBranchDropdownOpen(false);
      setIsTargetBranchDropdownOpen(false);
      setSourceBranchSearch('');
      setTargetBranchSearch('');
    }
  }, [isPushModalOpen]);

  const sourceBranch = pushModalSourceBranch || outgoingCommitsData?.sourceBranch || currentProject?.currentBranch || 'dev';
  const targetBranch = pushModalTargetBranch || outgoingCommitsData?.targetBranch || sourceBranch;
  const remoteName = outgoingCommitsData?.remote || 'origin';
  const commits = (outgoingCommitsData && Array.isArray(outgoingCommitsData.commits)) ? outgoingCommitsData.commits : [];

  const localBranches = useMemo(() => (Array.isArray(branches) ? branches.filter((b) => b && b.category === 'local') : []), [branches]);
  const filteredLocalBranches = useMemo(() => {
    if (!sourceBranchSearch.trim()) return localBranches;
    return localBranches.filter((b) => b.name.toLowerCase().includes(sourceBranchSearch.toLowerCase()));
  }, [localBranches, sourceBranchSearch]);

  const remoteBranches = useMemo(() => (Array.isArray(branches) ? branches.filter((b) => b && b.category === 'remote') : []), [branches]);
  const filteredRemoteBranches = useMemo(() => {
    const clean = remoteBranches.map((b) => b.name.replace(/^origin\//, ''));
    const unique = Array.from(new Set(clean));
    if (!targetBranchSearch.trim()) return unique;
    return unique.filter((name) => name.toLowerCase().includes(targetBranchSearch.toLowerCase()));
  }, [remoteBranches, targetBranchSearch]);

  if (!isPushModalOpen) return null;

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
    const collect = (node: ReturnType<typeof buildFileTree>) => {
      if (node.isDirectory) {
        allPaths.add(node.fullPath || 'root');
        node.children.forEach(collect);
      }
    };
    collect(fileTree);
    setExpandedFolders(allPaths);
  };

  const collapseAll = () => {
    setExpandedFolders(new Set());
  };

  const isNoneChecked = checkedCommitHashes.size === 0;
  const isSubsetChecked = checkedCommitHashes.size > 0 && checkedCommitHashes.size < commits.length;
  const isPushDisabled = pushingLoading || (isNoneChecked && !pushTags);

  const handlePush = async () => {
    const res = await executePush({
      force: forcePushMode,
      tags: pushTags,
    });
    if (res && res.success) {
      closePushModal();
    }
  };

  const handlePrimaryPush = async () => {
    if (isPushDisabled) return;

    if (isSubsetChecked) {
      setSelectiveModal({
        isOpen: true,
        hashes: Array.from(checkedCommitHashes),
        mode: 'target',
        targetBranch,
        patchBranchName: `patch/selected-${checkedCommitHashes.size}-commits`,
      });
      return;
    }

    await handlePush();
  };

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs flex items-center justify-center select-none"
      onKeyDown={(e) => {
        if (e.key === 'Escape') closePushModal();
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handlePrimaryPush();
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

        {/* 2. Target Routing Bar */}
        <div className="px-3 py-2 bg-theme-header border-b border-theme flex items-center justify-between text-xs shrink-0 relative">
          <div className="flex items-center gap-2 font-medium min-w-0">
            {/* Source Branch Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsSourceBranchDropdownOpen(!isSourceBranchDropdownOpen);
                  setIsTargetBranchDropdownOpen(false);
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-theme-card hover:bg-theme-card-hover border border-theme-border-card text-sky-400 font-bold transition cursor-pointer"
                title={t.modals.push.selectSourceBranchTooltip}
              >
                <GitBranch className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate max-w-[160px]">{sourceBranch}</span>
                <ChevronDown className="w-3 h-3 text-theme-dim shrink-0" />
              </button>

              <PushBranchDropdown
                isOpen={isSourceBranchDropdownOpen}
                search={sourceBranchSearch}
                onSearchChange={setSourceBranchSearch}
                placeholder={t.modals.push.searchLocalBranchesPlaceholder}
                emptyText={t.modals.push.noMatchingBranches}
                items={filteredLocalBranches}
                currentValue={sourceBranch}
                onSelect={async (name) => {
                  setIsSourceBranchDropdownOpen(false);
                  if (name !== sourceBranch) {
                    await switchPushSourceBranch(name);
                  }
                }}
              />
            </div>

            <span className="text-theme-dim shrink-0">→</span>

            {/* Target Branch Selector */}
            <div className="relative flex items-center gap-1">
              <span className="text-sky-400 font-semibold shrink-0">{remoteName}:</span>
              <button
                type="button"
                onClick={() => {
                  setIsTargetBranchDropdownOpen(!isTargetBranchDropdownOpen);
                  setIsSourceBranchDropdownOpen(false);
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-theme-card hover:bg-theme-card-hover border border-theme-border-card text-sky-400 font-bold transition cursor-pointer"
                title={t.modals.push.selectTargetRemoteBranchTooltip}
              >
                <span className="truncate max-w-[160px]">{targetBranch}</span>
                <ChevronDown className="w-3 h-3 text-theme-dim shrink-0" />
              </button>

              <PushBranchDropdown
                isOpen={isTargetBranchDropdownOpen}
                search={targetBranchSearch}
                onSearchChange={setTargetBranchSearch}
                placeholder={t.modals.push.searchRemoteBranchesPlaceholder}
                items={filteredRemoteBranches}
                currentValue={targetBranch}
                sourceValue={sourceBranch}
                sameNameLabel={t.modals.push.sameNameBranch}
                onSelect={async (name) => {
                  setIsTargetBranchDropdownOpen(false);
                  if (name !== targetBranch) {
                    await switchPushSourceBranch(sourceBranch, name);
                  }
                }}
              />
            </div>
          </div>

          <div className="text-[11px] text-theme-dim flex items-center gap-2">
            {outgoingCommitsLoading ? (
              <span className="flex items-center gap-1 text-sky-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{commits.length > 0 ? `${t.modals.push.commitsToPush(commits.length)} (${t.modals.push.validatingNotice})` : t.modals.push.scanningCommits}</span>
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
          <PushCommitListPane
            width={pushModalLeftWidth}
            commits={commits}
            loading={outgoingCommitsLoading}
            hasLoadedData={Boolean(outgoingCommitsData)}
            sourceBranch={sourceBranch}
            targetBranch={targetBranch}
            selectedCommitHash={selectedCommitHash}
            checkedCommitHashes={checkedCommitHashes}
            onSelectCommit={setSelectedCommitHash}
            onToggleCommitCheck={(hash) => {
              setCheckedCommitHashes((prev) => {
                const next = new Set(prev);
                if (next.has(hash)) {
                  next.delete(hash);
                } else {
                  next.add(hash);
                }
                return next;
              });
            }}
            onToggleAllCheck={() => {
              if (checkedCommitHashes.size === commits.length) {
                setCheckedCommitHashes(new Set());
              } else {
                setCheckedCommitHashes(new Set(commits.map((c) => c.hash)));
              }
            }}
            onContextMenu={(e, commit) => {
              e.preventDefault();
              e.stopPropagation();
              setCommitContextMenu({
                x: e.clientX,
                y: e.clientY,
                commit,
              });
            }}
            onOpenSelectiveModal={(hash, shortHash) => {
              setSelectiveModal({
                isOpen: true,
                hashes: [hash],
                mode: 'target',
                targetBranch,
                patchBranchName: `patch/fix-${shortHash}`,
              });
            }}
          />

          {/* Horizontal Resize Divider */}
          <ResizeDivider
            currentWidth={pushModalLeftWidth}
            minWidth={200}
            maxWidth={560}
            onResize={handleResizePushModalLeft}
            onDoubleClickReset={() => handleResizePushModalLeft(340)}
            title={t.modals.push.dragResizePushList}
          />

          {/* Right Pane: Changed Files Tree / List */}
          <PushChangedFilesPane
            files={displayedFiles}
            loading={outgoingCommitsLoading}
            commitsCount={commits.length}
            hasLoadedData={Boolean(outgoingCommitsData)}
            selectedCommitHash={selectedCommitHash}
            selectedFilePath={selectedFilePath}
            fileTree={fileTree}
            expandedFolders={expandedFolders}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onToggleFolder={toggleFolder}
            onExpandAll={expandAll}
            onCollapseAll={collapseAll}
            onSelectFile={(path) => {
              setSelectedFilePath(path);
              setSelectedFile(path);
            }}
            onOpenDiff={openDiffForFile}
            onContextMenu={(e, file) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                file,
                commitHash: getCommitHashForFile(file),
              });
            }}
          />
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
                disabled={isPulling}
                onClick={async () => {
                  setIsPulling(true);
                  try {
                    await updateProject();
                    if (outgoingCommitsData) {
                      await useAppStore.getState().openPushModal(sourceBranch);
                    }
                  } finally {
                    setIsPulling(false);
                  }
                }}
                className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                title={t.modals.push.pullMergeTooltip}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin' : ''}`} />
                <span>{isPulling ? t.modals.push.pullingUpdates : t.modals.push.updateProjectPull}</span>
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

        {/* 5. Bottom Footer Toolbar */}
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
              disabled={isPushDisabled}
              onClick={handlePrimaryPush}
              className={`px-5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm transition cursor-pointer ${
                forcePushMode
                  ? 'bg-rose-600 hover:bg-rose-500 text-white font-bold'
                  : isSubsetChecked
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs'
                  : 'bg-sky-600 hover:bg-sky-500 text-white'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={
                isNoneChecked
                  ? t.modals.push.pleaseSelectAtLeastOne
                  : isSubsetChecked
                  ? t.modals.push.pushSelectedTooltip(checkedCommitHashes.size)
                  : t.modals.push.pushAllTooltip
              }
            >
              {pushingLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t.modals.push.pushing}</span>
                </>
              ) : (
                <>
                  {isSubsetChecked && <Rocket className="w-3.5 h-3.5" />}
                  <span>
                    {forcePushMode
                      ? t.modals.push.forcePush
                      : isNoneChecked
                      ? (pushTags ? t.modals.push.pushTagsOnly : t.modals.push.pleaseSelectToPush)
                      : isSubsetChecked
                      ? t.modals.push.pushSelectedCountBtn(checkedCommitHashes.size)
                      : commits.length > 0
                      ? t.modals.push.pushBranchCountBtn(commits.length)
                      : t.modals.push.pushButton}
                  </span>
                </>
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

      {/* 6. Right-Click Context Menu on Changed Files */}
      {contextMenu && (
        <FileContextMenu
          state={contextMenu}
          projectPath={currentProject?.path}
          onClose={() => setContextMenu(null)}
          onOpenDiff={openDiffForFile}
          onRevealInOS={revealFileInOS}
          onNotify={setNotification}
        />
      )}

      {/* 7. Mode B: Selective Push Popover Modal */}
      {selectiveModal && selectiveModal.isOpen && (
        <SelectivePushModal
          state={selectiveModal}
          remoteName={remoteName}
          targetBranch={targetBranch}
          pushingLoading={pushingLoading}
          pushError={pushError}
          onClose={() => setSelectiveModal(null)}
          onUpdateState={setSelectiveModal}
          onSubmit={async () => {
            const res = await pushSelectedCommits({
              hashes: selectiveModal.hashes,
              targetBranch: selectiveModal.targetBranch,
              createNewBranch: selectiveModal.mode === 'patch',
              newBranchName: selectiveModal.patchBranchName.trim(),
            });
            if (res && res.success) {
              setSelectiveModal(null);
              closePushModal();
            }
          }}
        />
      )}

      {/* 8. Commit Card Right-Click Context Menu */}
      {commitContextMenu && (
        <CommitContextMenu
          state={commitContextMenu}
          targetBranch={targetBranch}
          onClose={() => setCommitContextMenu(null)}
          onOpenSelectiveModal={setSelectiveModal}
          onExecutePushToCommit={async (hash) => {
            const res = await executePush({
              targetCommit: hash,
              targetBranch,
            });
            if (res && res.success) {
              closePushModal();
            }
          }}
          onCopyHash={(hash) => {
            navigator.clipboard.writeText(hash);
            setNotification({
              id: Date.now(),
              title: t.notifications.copyHashSuccess,
              detail: hash,
              type: 'info',
            });
          }}
        />
      )}

      {/* 9. Standalone Diff Modal */}
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
