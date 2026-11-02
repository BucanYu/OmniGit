import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useAppStore, type BranchItem } from '../../store/useAppStore';
import { useTranslation, renderDualText } from '../../locales';
import {
  Search,
  ArrowDownToLine,
  GitCommit,
  ArrowUpRight,
  Plus,
  GitBranch,
  Star,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Settings,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { NewBranchModal } from './NewBranchModal';
import { CheckoutRevisionModal } from './CheckoutRevisionModal';
import { RenameBranchModal } from './RenameBranchModal';
import { BranchFlyoutSubmenu } from './BranchFlyoutSubmenu';

interface BranchMenuProps {
  onClose: () => void;
}

export function BranchMenu({ onClose }: BranchMenuProps) {
  const { t, language } = useTranslation();
  const {
    branches,
    projects,
    activeProjectId,
    loadRepoData,
    checkoutBranch,
    undoLastMerge,
    branchOperationLoading,
    deleteBranch,
    updateProject,
    toggleBranchFavorite,
    renameBranch,
    openPushModal,
    prefetchOutgoingCommits,
    checkoutTagOrRevision,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFlyoutBranch, setActiveFlyoutBranch] = useState<string | null>(null);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number }>({ top: 0 });
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({
    recent: false,
    local: false,
    remote: false,
  });

  const [newBranchModalSource, setNewBranchModalSource] = useState<string | null>(null);
  const [isCheckoutRevisionOpen, setIsCheckoutRevisionOpen] = useState(false);
  const [renameModalBranch, setRenameModalBranch] = useState<string | null>(null);

  const [branchToDelete, setBranchToDelete] = useState<string | null>(null);
  const [isRemoteToDelete, setIsRemoteToDelete] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [isTrackedOpen, setIsTrackedOpen] = useState(false);
  const [undoMergeTarget, setUndoMergeTarget] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const currentBranchName = activeProject?.currentBranch || 'dev';
  const safeBranches = Array.isArray(branches)
    ? branches.filter((b) => b && typeof b.name === 'string')
    : [];
  const currentBranchObj = safeBranches.find(
    (b) => b && (b.isCurrent || b.name === currentBranchName)
  );
  const outgoingCount =
    activeProject?.outgoing !== undefined ? activeProject.outgoing : currentBranchObj?.outgoing || 0;
  const incomingCount =
    activeProject?.incoming !== undefined ? activeProject.incoming : currentBranchObj?.incoming || 0;
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeProject && outgoingCount > 0) {
      prefetchOutgoingCommits(activeProject.path, currentBranchName);
    }
  }, [activeProject?.path, currentBranchName, outgoingCount, prefetchOutgoingCommits]);

  useLayoutEffect(() => {
    if (!activeFlyoutBranch || !menuRef.current || !flyoutRef.current) return;
    const flyoutRect = flyoutRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const windowH = window.innerHeight;

    const safeBottom = windowH - 16;
    if (flyoutRect.bottom > safeBottom) {
      const overflow = flyoutRect.bottom - safeBottom;
      const minTop = -(menuRect.top - 8);
      setFlyoutPos((prev) => ({
        top: Math.max(minTop, prev.top - overflow),
      }));
    } else if (flyoutRect.top < 8) {
      const minTop = -(menuRect.top - 8);
      setFlyoutPos({ top: minTop });
    }
  }, [activeFlyoutBranch, isTrackedOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        branchToDelete ||
        newBranchModalSource ||
        isCheckoutRevisionOpen ||
        renameModalBranch
      ) {
        return;
      }

      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 't') {
        e.preventDefault();
        updateProject();
        onClose();
      } else if (isCmdOrCtrl && e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setNewBranchModalSource(currentBranchName);
      } else if (e.key === 'F2') {
        if (activeFlyoutBranch) {
          e.preventDefault();
          setRenameModalBranch(activeFlyoutBranch);
        }
      } else if (e.key === 'Escape') {
        if (activeFlyoutBranch) {
          setActiveFlyoutBranch(null);
        } else {
          onClose();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    updateProject,
    onClose,
    activeFlyoutBranch,
    currentBranchName,
    branchToDelete,
    newBranchModalSource,
    isCheckoutRevisionOpen,
    renameModalBranch,
  ]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const query = (searchQuery || '').toLowerCase();
  const filteredBranches = safeBranches.filter((b) =>
    (b.name || '').toLowerCase().includes(query)
  );

  const recentBranches = filteredBranches.filter(
    (b) => b.isFavorite || b.isCurrent || b.category === 'recent'
  );
  const localBranches = filteredBranches.filter(
    (b) => b.category !== 'remote' && !(b.name || '').startsWith('origin/')
  );
  const remoteBranches = filteredBranches.filter(
    (b) => b.category === 'remote' || (b.name || '').startsWith('origin/')
  );

  const openBranchFlyout = (branchName: string, event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setIsTrackedOpen(false);
    if (activeFlyoutBranch === branchName) {
      setActiveFlyoutBranch(null);
      return;
    }

    const rowEl = event.currentTarget.closest('.branch-row');
    if (rowEl && menuRef.current) {
      const rowRect = rowEl.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();
      const relativeTop = rowRect.top - menuRect.top;

      const isCurrent = branchName === currentBranchName;
      const expectedHeight = isCurrent ? 230 : 380;
      const windowH = window.innerHeight;

      const minAllowedTop = -(menuRect.top - 8);
      const maxAllowedTop = windowH - 16 - menuRect.top - expectedHeight;
      const targetTop = Math.max(minAllowedTop, Math.min(relativeTop, maxAllowedTop));
      setFlyoutPos({ top: targetTop });
    }
    setActiveFlyoutBranch(branchName);
  };

  const renderBranchRow = (branch: BranchItem) => {
    const isCurrent = branch.name === currentBranchName;
    const isFlyoutActive = activeFlyoutBranch === branch.name;
    const isRemote = branch.category === 'remote' || branch.name.startsWith('origin/');
    const displayName = isRemote ? branch.name.replace(/^origin\//, '') : branch.name;
    const displayUpstream = isRemote ? '' : branch.upstream || `origin/${branch.name}`;
    const rowOutgoing = isCurrent ? outgoingCount : branch.outgoing;
    const rowIncoming = isCurrent ? incomingCount : branch.incoming;

    return (
      <div
        key={branch.name}
        onClick={(e) => openBranchFlyout(branch.name, e)}
        className={`branch-row group px-3 py-1.5 flex items-center justify-between cursor-pointer transition text-xs select-none ${
          isFlyoutActive
            ? 'bg-sky-500/15 text-sky-400 font-medium'
            : isCurrent
            ? 'bg-theme-card text-theme-main font-semibold'
            : 'hover:bg-theme-hover text-theme-main'
        }`}
        title={
          isCurrent
            ? `${t.topBar.branchMenu.currentBranch}: ${branch.name}`
            : isRemote
            ? t.topBar.branchMenu.remoteBranchTitle(branch.name)
            : `${t.topBar.branchMenu.switchBranch}: '${branch.name}'`
        }
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleBranchFavorite(branch.name);
            }}
            className="text-theme-dim hover:text-amber-400 shrink-0 cursor-pointer p-0.5"
            title={
              branch.isFavorite
                ? t.topBar.branchMenu.unfavoriteTooltip
                : t.topBar.branchMenu.favoriteTooltip
            }
          >
            <Star
              className={`w-3.5 h-3.5 ${
                branch.isFavorite
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-theme-dim hover:text-amber-300'
              }`}
            />
          </button>

          <GitBranch
            className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-sky-500' : 'text-theme-dim'}`}
          />

          <span
            className={`truncate text-xs flex-1 min-w-0 ${
              isCurrent ? 'text-theme-main font-bold' : 'text-theme-main'
            }`}
            title={branch.name}
          >
            {displayName}
          </span>

          {isCurrent && (
            <span className="px-1.5 py-0.2 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded text-[10px] font-mono font-bold shrink-0">
              HEAD
            </span>
          )}

          {rowOutgoing > 0 && (
            <span
              className="flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[10px] font-mono font-bold shrink-0"
              title={t.topBar.branchMenu.outgoingTooltip(rowOutgoing)}
            >
              <span>↗</span>
              <span>{rowOutgoing}</span>
            </span>
          )}

          {rowIncoming > 0 && (
            <span
              className="flex items-center gap-0.5 px-1.5 py-0.2 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded text-[10px] font-mono font-bold shrink-0"
              title={t.topBar.branchMenu.incomingTooltip(rowIncoming)}
            >
              <span>↙</span>
              <span>{rowIncoming}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-theme-dim ml-1">
          {!isRemote && displayUpstream && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-theme-input text-theme-dim border border-theme-border-card max-w-[125px] truncate"
              title={displayUpstream}
            >
              {displayUpstream}
            </span>
          )}

          <ChevronRight className="w-3 h-3 text-theme-dim group-hover:text-theme-main shrink-0" />
        </div>
      </div>
    );
  };

  return (
    <>
      <div
        ref={menuRef}
        className="absolute top-full mt-1.5 left-0 z-50 w-[380px] theme-dropdown-panel rounded-lg text-xs text-theme-main select-none flex flex-col font-sans shadow-2xl border border-theme-border-card app-region-no-drag"
        style={{ maxHeight: 'calc(100vh - 60px)' }}
      >
        {/* 1. Header: Search Bar & Icons */}
        <div className="p-2 border-b border-theme flex items-center justify-between gap-2 bg-theme-subbar rounded-t-lg">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-theme-dim shrink-0" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.topBar.branchMenu.searchBranchesPlaceholder}
              className="w-full bg-transparent border-none text-xs text-theme-main placeholder:text-theme-dim focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-theme-dim hover:text-theme-main text-xs px-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 text-theme-dim">
            <button
              type="button"
              onClick={() => {
                if (activeProject) {
                  loadRepoData(activeProject.path, true);
                  useAppStore.getState().pollWorkspaceSyncStatus();
                }
              }}
              className="p-1 hover:text-theme-main hover:bg-theme-card rounded transition cursor-pointer"
              title={t.topBar.actions.fetch}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="p-1 hover:text-theme-main hover:bg-theme-card rounded transition cursor-pointer"
              title={t.topBar.windowActions.systemSettings}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {branchOperationLoading && (
          <div className="px-3 py-2 bg-sky-500/15 border-b border-sky-500/30 text-sky-300 flex items-center gap-2 text-xs">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
            <span className="truncate font-medium">{branchOperationLoading.message}</span>
          </div>
        )}

        {/* 2. Scrollable Body */}
        <div className="overflow-y-auto py-1 flex-1 relative">
          <div className="border-b border-theme/70 pb-1 mb-1">
            <div
              onClick={() => {
                updateProject();
                onClose();
              }}
              className="px-3 py-1.5 hover:bg-theme-hover flex items-center justify-between cursor-pointer group transition text-theme-main"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ArrowDownToLine className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span className="text-theme-main font-medium">
                  {renderDualText(t.topBar.actions.updateProject)}
                </span>
                {incomingCount > 0 && (
                  <span
                    className="flex items-center gap-0.5 px-1.5 py-0.2 bg-sky-500/20 text-sky-400 border border-sky-500/40 rounded text-[10px] font-mono font-bold shrink-0 animate-pulse"
                    title={t.topBar.branchMenu.incomingTooltip(incomingCount)}
                  >
                    <span>↙</span>
                    <span>{incomingCount}</span>
                  </span>
                )}
              </div>
              <span className="text-theme-dim text-[11px] font-mono shrink-0">Ctrl+T</span>
            </div>

            <div
              onClick={() => {
                useAppStore.getState().setActiveTab('commit');
                onClose();
              }}
              className="px-3 py-1.5 hover:bg-theme-hover flex items-center justify-between cursor-pointer group transition text-theme-main"
            >
              <div className="flex items-center gap-2 min-w-0">
                <GitCommit className="w-3.5 h-3.5 text-theme-dim shrink-0" />
                <span className="text-theme-main font-medium">
                  {renderDualText(t.topBar.actions.commit)}
                </span>
              </div>
              <span className="text-theme-dim text-[11px] font-mono shrink-0">Ctrl+K</span>
            </div>

            <div
              onMouseEnter={() => {
                if (activeProject && outgoingCount > 0) {
                  prefetchOutgoingCommits(activeProject.path, currentBranchName);
                }
              }}
              onClick={() => {
                openPushModal(currentBranchName);
                onClose();
              }}
              className="px-3 py-1.5 hover:bg-theme-hover flex items-center justify-between cursor-pointer group transition text-theme-main"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ArrowUpRight className="w-3.5 h-3.5 text-theme-dim shrink-0" />
                <span className="text-theme-main font-medium">
                  {renderDualText(t.topBar.actions.push)}
                </span>
                {outgoingCount > 0 && (
                  <span
                    className="flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[10px] font-mono font-bold shrink-0"
                    title={t.topBar.branchMenu.outgoingTooltip(outgoingCount)}
                  >
                    <span>↗</span>
                    <span>{outgoingCount}</span>
                  </span>
                )}
              </div>
              <span className="text-theme-dim text-[11px] font-mono shrink-0">Ctrl+Shift+K</span>
            </div>

            <div className="my-1 border-t border-theme/50" />

            <div
              onClick={() => setNewBranchModalSource(currentBranchName)}
              className="px-3 py-1.5 hover:bg-theme-hover flex items-center justify-between cursor-pointer group transition text-theme-main"
            >
              <div className="flex items-center gap-2.5">
                <Plus className="w-3.5 h-3.5 text-theme-dim shrink-0" />
                <span className="text-theme-main font-medium">
                  {renderDualText(t.topBar.branchMenu.newBranch)}
                </span>
              </div>
              <span className="text-theme-dim text-[11px] font-mono shrink-0">Ctrl+Alt+N</span>
            </div>

            <div
              onClick={() => setIsCheckoutRevisionOpen(true)}
              className="px-3 py-1.5 hover:bg-theme-hover flex items-center justify-between cursor-pointer group transition text-theme-main"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-3.5 h-3.5 text-theme-dim shrink-0" />
                <span className="text-theme-main font-medium">
                  {t.branchMenu.checkoutTagOrRevision}
                </span>
              </div>
            </div>
          </div>

          {recentBranches.length > 0 && (
            <div>
              <div
                onClick={() => toggleCategory('recent')}
                className="px-3 py-1 text-[11px] font-semibold text-theme-dim flex items-center gap-1 cursor-pointer hover:text-theme-main"
              >
                {collapsedCategories.recent ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                <span>{t.branchMenu.categories.recent}</span>
              </div>

              {!collapsedCategories.recent && recentBranches.map(renderBranchRow)}
            </div>
          )}

          {localBranches.length > 0 && (
            <div className="mt-1">
              <div
                onClick={() => toggleCategory('local')}
                className="px-3 py-1 text-[11px] font-semibold text-theme-dim flex items-center gap-1 cursor-pointer hover:text-theme-main"
              >
                {collapsedCategories.local ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                <span>{t.branchMenu.categories.local}</span>
              </div>

              {!collapsedCategories.local && localBranches.map(renderBranchRow)}
            </div>
          )}

          {remoteBranches.length > 0 && (
            <div className="mt-1">
              <div
                onClick={() => toggleCategory('remote')}
                className="px-3 py-1 text-[11px] font-semibold text-theme-dim flex items-center gap-1 cursor-pointer hover:text-theme-main"
              >
                {collapsedCategories.remote ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                <span>{t.branchMenu.categories.remote}</span>
              </div>

              {!collapsedCategories.remote && (
                <div className="pl-2">
                  <div className="px-3 py-1 text-[11px] text-theme-muted font-medium flex items-center gap-1">
                    <ChevronDown className="w-3 h-3 text-theme-dim" />
                    <span>origin</span>
                  </div>
                  {remoteBranches.map(renderBranchRow)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Secondary Flyout Submenu */}
        {activeFlyoutBranch && (
          <BranchFlyoutSubmenu
            flyoutRef={flyoutRef}
            flyoutPos={flyoutPos}
            activeFlyoutBranch={activeFlyoutBranch}
            currentBranchName={currentBranchName}
            safeBranches={safeBranches}
            outgoingCount={outgoingCount}
            isTrackedOpen={isTrackedOpen}
            setIsTrackedOpen={setIsTrackedOpen}
            setNewBranchModalSource={setNewBranchModalSource}
            setRenameModalBranch={setRenameModalBranch}
            setUndoMergeTarget={setUndoMergeTarget}
            setActiveFlyoutBranch={setActiveFlyoutBranch}
            setBranchToDelete={setBranchToDelete}
            setIsRemoteToDelete={setIsRemoteToDelete}
            setForceDelete={setForceDelete}
            setDeleteError={setDeleteError}
            onClose={onClose}
          />
        )}
      </div>

      {newBranchModalSource && (
        <NewBranchModal
          isOpen={Boolean(newBranchModalSource)}
          sourceBranch={newBranchModalSource}
          onClose={() => setNewBranchModalSource(null)}
          onCreateBranch={async (branchName, shouldCheckout) => {
            const project = activeProject;
            if (!project) return;
            const res = await fetch('/api/git/create-branch-at', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                path: project.path,
                branchName,
                hash: newBranchModalSource,
              }),
            });
            const data = await res.json();
            if (data.success) {
              if (!shouldCheckout) {
                await checkoutBranch(currentBranchName);
              }
              await loadRepoData(project.path);
              onClose();
            } else {
              throw new Error(data.message);
            }
          }}
        />
      )}

      {isCheckoutRevisionOpen && (
        <CheckoutRevisionModal
          isOpen={isCheckoutRevisionOpen}
          onClose={() => setIsCheckoutRevisionOpen(false)}
          onCheckout={async (target, newBranchName) => {
            await checkoutTagOrRevision(target, newBranchName);
            onClose();
          }}
        />
      )}

      {renameModalBranch && (
        <RenameBranchModal
          isOpen={Boolean(renameModalBranch)}
          oldBranchName={renameModalBranch}
          onClose={() => setRenameModalBranch(null)}
          onRename={async (oldName, newName) => {
            await renameBranch(oldName, newName);
            setActiveFlyoutBranch(null);
            onClose();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(branchToDelete)}
        title={isRemoteToDelete ? t.modals.deleteBranch.titleRemote : t.modals.deleteBranch.title}
        variant="danger"
        icon="trash"
        confirmText={t.modals.deleteBranch.confirmBtn}
        cancelText={t.modals.deleteBranch.cancelBtn}
        isLoading={isDeleting}
        onCancel={() => {
          setBranchToDelete(null);
          setDeleteError(null);
        }}
        onConfirm={async () => {
          if (!branchToDelete) return;
          setIsDeleting(true);
          setDeleteError(null);
          try {
            const result = await deleteBranch(branchToDelete, forceDelete, isRemoteToDelete);
            if (result.success) {
              setBranchToDelete(null);
              setActiveFlyoutBranch(null);
              setDeleteError(null);
              setIsDeleting(false);
              onClose();
            } else {
              setDeleteError(
                result.message || (language === 'zh-CN' ? '删除失败' : 'Failed to delete')
              );
              setIsDeleting(false);
            }
          } catch (err: any) {
            setDeleteError(err?.message || String(err));
            setIsDeleting(false);
          }
        }}
        description={
          <div className="flex flex-col gap-2">
            {deleteError && (
              <div className="p-2.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex flex-col gap-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{t.modals.deleteBranch.errorTitle}</span>
                </div>
                <pre className="mt-1 p-2 bg-black/40 rounded text-[11px] font-mono text-rose-300 whitespace-pre-wrap break-all max-h-36 overflow-y-auto select-text">
                  {deleteError}
                </pre>
              </div>
            )}
            <p>
              {isRemoteToDelete
                ? t.modals.deleteBranch.promptRemote(
                    'origin',
                    (branchToDelete || '').replace(/^origin\//, '')
                  )
                : t.modals.deleteBranch.prompt(branchToDelete || '')}
            </p>
            <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] leading-relaxed">
              {isRemoteToDelete
                ? t.modals.deleteBranch.dangerNoticeRemote(
                    'origin',
                    (branchToDelete || '').replace(/^origin\//, '')
                  )
                : t.modals.deleteBranch.dangerNotice}
            </div>
            {isRemoteToDelete ? (
              <div className="text-[11px] text-theme-dim">
                {t.modals.deleteBranch.deleteTrackingRef}
              </div>
            ) : (
              <label className="flex items-center gap-2 mt-1 cursor-pointer select-none text-theme-main">
                <input
                  type="checkbox"
                  checked={forceDelete}
                  onChange={(e) => setForceDelete(e.target.checked)}
                  className="rounded border-theme-border text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span className="text-[11px] font-medium">{t.modals.deleteBranch.forceDelete}</span>
              </label>
            )}
          </div>
        }
      />

      <ConfirmDialog
        isOpen={Boolean(undoMergeTarget)}
        title={useAppStore.getState().language === 'zh-CN' ? '撤销合并' : 'Undo Merge'}
        confirmText={useAppStore.getState().language === 'zh-CN' ? '确认撤销' : 'Undo Merge'}
        cancelText={t.common.cancel}
        variant="danger"
        icon="warning"
        isLoading={Boolean(branchOperationLoading)}
        onConfirm={async () => {
          const target = undoMergeTarget;
          setUndoMergeTarget(null);
          if (target) {
            await undoLastMerge(target);
            onClose();
          }
        }}
        onCancel={() => setUndoMergeTarget(null)}
        description={
          <div className="flex flex-col gap-2">
            <p>
              {useAppStore.getState().language === 'zh-CN'
                ? `确认要撤销合并 '${undoMergeTarget}' 到当前分支 '${currentBranchName}' 吗？`
                : `Are you sure you want to undo merging '${undoMergeTarget}' into '${currentBranchName}'?`}
            </p>
            <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] leading-relaxed">
              {useAppStore.getState().language === 'zh-CN'
                ? '系统将自动检测本次合并并安全回滚到合并前版本。如果当前分支已有后续新提交或未检测到合并记录，系统将提示并中止，以保障代码安全。'
                : 'OmniGit will check and safely revert HEAD to the pre-merge commit. If newer commits have been made, rollback will be safely prevented.'}
            </div>
          </div>
        }
      />
    </>
  );
}
