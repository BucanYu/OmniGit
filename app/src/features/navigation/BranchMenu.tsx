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
  Tag,
  Clock,
  Layers,
  Check,
  Globe,
  Trash2,
  AlertCircle,
  Undo2,
} from 'lucide-react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { NewBranchModal } from './NewBranchModal';
import { CheckoutRevisionModal } from './CheckoutRevisionModal';
import { RenameBranchModal } from './RenameBranchModal';

interface BranchMenuProps {
  onClose: () => void;
}

export function BranchMenu({ onClose }: BranchMenuProps) {
  const { t } = useTranslation();
  const {
    branches,
    projects,
    activeProjectId,
    files,
    loadRepoData,
    checkoutBranch,
    mergeBranch,
    lastMergeUndoInfo,
    undoLastMerge,
    branchOperationLoading,
    deleteBranch,
    updateProject,
    toggleBranchFavorite,
    renameBranch,
    rebaseBranch,
    checkoutAndRebase,
    checkoutAndUpdate,
    pushBranch,
    openPushModal,
    checkoutTagOrRevision,
    showBranchDiffWithWorkingTree,
    compareBranchWithCurrent,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFlyoutBranch, setActiveFlyoutBranch] = useState<string | null>(null);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number }>({ top: 0 });
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({
    recent: false,
    local: false,
    remote: false,
  });

  // Modals state
  const [newBranchModalSource, setNewBranchModalSource] = useState<string | null>(null);
  const [isCheckoutRevisionOpen, setIsCheckoutRevisionOpen] = useState(false);
  const [renameModalBranch, setRenameModalBranch] = useState<string | null>(null);

  // High-risk branch delete confirmation state
  const [branchToDelete, setBranchToDelete] = useState<string | null>(null);
  const [isRemoteToDelete, setIsRemoteToDelete] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Tracked branch submenu state
  const [isTrackedOpen, setIsTrackedOpen] = useState(false);

  // Undo merge confirmation state
  const [undoMergeTarget, setUndoMergeTarget] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const currentBranchName = activeProject?.currentBranch || 'dev';
  const safeBranches = Array.isArray(branches)
    ? branches.filter((b) => b && typeof b.name === 'string')
    : [];
  const currentBranchObj = safeBranches.find((b) => b && (b.isCurrent || b.name === currentBranchName));
  const outgoingCount = Math.max(activeProject?.outgoing || 0, currentBranchObj?.outgoing || 0);
  const incomingCount = Math.max(activeProject?.incoming || 0, currentBranchObj?.incoming || 0);
  const uncommittedCount = files.length;
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Dynamically verify and correct the flyout's position to guarantee 100% visibility
  useLayoutEffect(() => {
    if (!activeFlyoutBranch || !menuRef.current || !flyoutRef.current) return;
    const flyoutRect = flyoutRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const windowH = window.innerHeight;
    
    // Ensure the bottom edge of the flyout is at least 16px above window bottom
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

  // Safe focus on mount without causing ancestor container scroll jumping
  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Global keyboard shortcuts within menu
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (branchToDelete || newBranchModalSource || isCheckoutRevisionOpen || renameModalBranch) {
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
  }, [updateProject, onClose, activeFlyoutBranch, currentBranchName, branchToDelete, newBranchModalSource, isCheckoutRevisionOpen, renameModalBranch]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const query = (searchQuery || '').toLowerCase();
  const filteredBranches = safeBranches.filter((b) =>
    (b.name || '').toLowerCase().includes(query)
  );

  // IDEA grouping logic:
  // - Recent: favorites or current branch or branches marked favorite
  // - Local: all non-remote branches
  // - Remote: branches starting with remote prefix
  const recentBranches = filteredBranches.filter(
    (b) => b.isFavorite || b.isCurrent || b.category === 'recent'
  );
  const localBranches = filteredBranches.filter(
    (b) => b.category !== 'remote' && !(b.name || '').startsWith('origin/')
  );
  const remoteBranches = filteredBranches.filter(
    (b) => b.category === 'remote' || (b.name || '').startsWith('origin/')
  );

  // Open secondary actions menu to the right with smart viewport collision avoidance
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
      // Case A has 7 items (~230px); Case B has 14 items (~380px)
      const expectedHeight = isCurrent ? 230 : 380;
      const windowH = window.innerHeight;
      
      // Shift upwards so the flyout's bottom never overflows windowH - 16
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
    const displayUpstream = isRemote ? '' : (branch.upstream || `origin/${branch.name}`);
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
            ? `远程分支: '${branch.name}'`
            : `${t.topBar.branchMenu.switchBranch}: '${branch.name}'`
        }
      >
        {/* Left: Star + Branch Icon + Name + HEAD Badge */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleBranchFavorite(branch.name);
            }}
            className="text-theme-dim hover:text-amber-400 shrink-0 cursor-pointer p-0.5"
            title={branch.isFavorite ? t.topBar.branchMenu.unfavoriteTooltip : t.topBar.branchMenu.favoriteTooltip}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                branch.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-theme-dim hover:text-amber-300'
              }`}
            />
          </button>

          <GitBranch
            className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-sky-500' : 'text-theme-dim'}`}
          />

          <span
            className={`truncate text-xs flex-1 min-w-0 ${isCurrent ? 'text-theme-main font-bold' : 'text-theme-main'}`}
            title={branch.name}
          >
            {displayName}
          </span>

          {isCurrent && (
            <span className="px-1.5 py-0.2 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded text-[10px] font-mono font-bold shrink-0">
              HEAD
            </span>
          )}

          {/* Outgoing Badge (本地待推送 ↗ - 1:1 对标 IDEA 截图 3) */}
          {rowOutgoing > 0 && (
            <span
              className="flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[10px] font-mono font-bold shrink-0"
              title={`Local has ${rowOutgoing} unpushed commit(s)`}
            >
              <span>↗</span>
              <span>{rowOutgoing}</span>
            </span>
          )}

          {/* Incoming Badge (远端待拉取 ↙) */}
          {rowIncoming > 0 && (
            <span
              className="flex items-center gap-0.5 px-1.5 py-0.2 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded text-[10px] font-mono font-bold shrink-0"
              title={`Remote has ${rowIncoming} unpulled commit(s)`}
            >
              <span>↙</span>
              <span>{rowIncoming}</span>
            </span>
          )}
        </div>

        {/* Right: Upstream capsule + expand arrow */}
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

        {/* Real-time Branch Operation Progress Banner */}
        {branchOperationLoading && (
          <div className="px-3 py-2 bg-sky-500/15 border-b border-sky-500/30 text-sky-300 flex items-center gap-2 text-xs">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
            <span className="truncate font-medium">{branchOperationLoading.message}</span>
          </div>
        )}

        {/* 2. Scrollable Body */}
        <div className="overflow-y-auto py-1 flex-1 relative">
          {/* Top Quick Actions */}
          <div className="border-b border-theme/70 pb-1 mb-1">
            {/* Update Project... */}
            <div
              onClick={() => {
                updateProject();
                onClose();
              }}
              className="px-3 py-1.5 hover:bg-theme-hover flex items-center justify-between cursor-pointer group transition text-theme-main"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ArrowDownToLine className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span className="text-theme-main font-medium">{renderDualText(t.topBar.actions.updateProject)}</span>
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

            {/* Commit... (1:1 对齐原生 IDEA: 纯操作项，不在分支菜单中放容易引起混淆的工作区文件数字) */}
            <div
              onClick={() => {
                useAppStore.getState().setActiveTab('commit');
                onClose();
              }}
              className="px-3 py-1.5 hover:bg-theme-hover flex items-center justify-between cursor-pointer group transition text-theme-main"
            >
              <div className="flex items-center gap-2 min-w-0">
                <GitCommit className="w-3.5 h-3.5 text-theme-dim shrink-0" />
                <span className="text-theme-main font-medium">{renderDualText(t.topBar.actions.commit)}</span>
              </div>
              <span className="text-theme-dim text-[11px] font-mono shrink-0">Ctrl+K</span>
            </div>

            {/* Push... */}
            <div
              onClick={() => {
                openPushModal(currentBranchName);
                onClose();
              }}
              className="px-3 py-1.5 hover:bg-theme-hover flex items-center justify-between cursor-pointer group transition text-theme-main"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ArrowUpRight className="w-3.5 h-3.5 text-theme-dim shrink-0" />
                <span className="text-theme-main font-medium">{renderDualText(t.topBar.actions.push)}</span>
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

            {/* + New Branch... */}
            <div
              onClick={() => setNewBranchModalSource(currentBranchName)}
              className="px-3 py-1.5 hover:bg-theme-hover flex items-center justify-between cursor-pointer group transition text-theme-main"
            >
              <div className="flex items-center gap-2.5">
                <Plus className="w-3.5 h-3.5 text-theme-dim shrink-0" />
                <span className="text-theme-main font-medium">{renderDualText(t.topBar.branchMenu.newBranch)}</span>
              </div>
              <span className="text-theme-dim text-[11px] font-mono shrink-0">Ctrl+Alt+N</span>
            </div>

            {/* Checkout Tag or Revision... */}
            <div
              onClick={() => setIsCheckoutRevisionOpen(true)}
              className="px-3 py-1.5 hover:bg-theme-hover flex items-center justify-between cursor-pointer group transition text-theme-main"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-3.5 h-3.5 text-theme-dim shrink-0" />
                <span className="text-theme-main font-medium">{t.branchMenu.checkoutTagOrRevision}</span>
              </div>
            </div>
          </div>

          {/* 3. Branch Categories: Recent (最近与收藏) */}
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

          {/* 4. Branch Categories: Local */}
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

          {/* 5. Branch Categories: Remote */}
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

        {/* 3. Secondary Flyout Submenu Expanding to the Right (向右展开，智能视口防溢出) */}
        {activeFlyoutBranch && (
          <div
            ref={flyoutRef}
            className="absolute left-full top-0 ml-1.5 w-[280px] min-w-[280px] max-w-[340px] theme-dropdown-panel rounded-lg py-1 z-50 text-xs text-theme-main shadow-2xl font-sans border border-theme-border-card animate-in fade-in zoom-in-95 duration-100 app-region-no-drag max-h-[calc(100vh-32px)] overflow-y-auto scrollbar-thin"
            style={{ top: flyoutPos.top }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Case A: Current Branch (e.g. 'dev', 对应截图 1) */}
            {activeFlyoutBranch === currentBranchName ? (
              <div className="space-y-0.5">
                {/* 1. New Branch from 'dev'... */}
                <button
                  type="button"
                  onClick={() => setNewBranchModalSource(activeFlyoutBranch)}
                  className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
                  title={t.branchMenu.actions.newBranchFrom(activeFlyoutBranch)}
                >
                  <span className="truncate">{t.branchMenu.actions.newBranchFrom(activeFlyoutBranch)}</span>
                </button>

                {/* 2. Show Diff with Working Tree */}
                <button
                  type="button"
                  onClick={() => {
                    showBranchDiffWithWorkingTree(activeFlyoutBranch);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
                  title={t.branchMenu.actions.showDiffWithWorkingTree}
                >
                  <span className="truncate">{t.branchMenu.actions.showDiffWithWorkingTree}</span>
                </button>

                {/* 3. New Worktree from 'dev'... */}
                <button
                  type="button"
                  onClick={() => {
                    useAppStore.getState().createNewWindow();
                    onClose();
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
                  title={t.branchMenu.actions.newWorktreeFrom(activeFlyoutBranch)}
                >
                  <span className="truncate">{t.branchMenu.actions.newWorktreeFrom(activeFlyoutBranch)}</span>
                </button>

                <div className="my-0.5 border-t border-theme/60" />

                {/* 4. Update */}
                <button
                  type="button"
                  onClick={() => {
                    updateProject();
                    onClose();
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
                  title={t.branchMenu.actions.update}
                >
                  <span className="truncate">{t.branchMenu.actions.update}</span>
                </button>

                {/* 5. Push... */}
                <button
                  type="button"
                  onClick={() => {
                    openPushModal(activeFlyoutBranch);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center justify-between text-theme-main cursor-pointer whitespace-nowrap truncate"
                  title={t.branchMenu.actions.push}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{t.branchMenu.actions.push}</span>
                    {outgoingCount > 0 && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[10px] font-mono font-bold shrink-0">
                        <span>↗</span>
                        <span>{outgoingCount}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-theme-dim text-[10px] font-mono shrink-0 ml-2">Ctrl+Shift+K</span>
                </button>

                {/* 6. Tracked Branch */}
                <div
                  onClick={() => setIsTrackedOpen(!isTrackedOpen)}
                  className="px-3 py-1 hover:bg-theme-hover flex items-center justify-between text-theme-main cursor-pointer whitespace-nowrap truncate"
                  title={t.branchMenu.actions.trackedBranch(`origin/${activeFlyoutBranch}`)}
                >
                  <span className="truncate">{t.branchMenu.actions.trackedBranch(`origin/${activeFlyoutBranch}`)}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-theme-dim shrink-0 ml-1.5" />
                </div>

                {isTrackedOpen && (
                  <div className="pl-4 py-1 bg-theme-card/50 border-y border-theme/40 space-y-0.5">
                    <div
                      onClick={() => {
                        openPushModal(activeFlyoutBranch);
                        onClose();
                      }}
                      className="px-3 py-1 hover:bg-theme-hover cursor-pointer text-[11px] truncate"
                      title={t.branchMenu.actions.pushToTracked(`origin/${activeFlyoutBranch}`)}
                    >
                      {t.branchMenu.actions.pushToTracked(`origin/${activeFlyoutBranch}`)}
                    </div>
                    <div
                      onClick={async () => {
                        await checkoutAndUpdate(activeFlyoutBranch);
                        onClose();
                      }}
                      className="px-3 py-1 hover:bg-theme-hover cursor-pointer text-[11px] truncate"
                      title={t.branchMenu.actions.pullFromTracked(`origin/${activeFlyoutBranch}`)}
                    >
                      {t.branchMenu.actions.pullFromTracked(`origin/${activeFlyoutBranch}`)}
                    </div>
                  </div>
                )}

                <div className="my-0.5 border-t border-theme/60" />

                {/* 7. Rename... (F2) */}
                <button
                  type="button"
                  onClick={() => setRenameModalBranch(activeFlyoutBranch)}
                  className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center justify-between text-theme-main cursor-pointer whitespace-nowrap truncate"
                  title={t.branchMenu.actions.rename}
                >
                  <span className="truncate">{t.branchMenu.actions.rename}</span>
                  <span className="text-theme-dim text-[10px] font-mono shrink-0 ml-2">F2</span>
                </button>
              </div>
            ) : (() => {
              const activeFlyoutBranchObj = safeBranches.find((b) => b && b.name === activeFlyoutBranch);
              const isRemoteFlyout = Boolean(
                activeFlyoutBranch?.startsWith('origin/') ||
                activeFlyoutBranchObj?.category === 'remote'
              );
              return (
              /* Case B: Other Branch (e.g. 'test', 对应截图 2) */
              <div className="space-y-0.5">
                {/* 1. Checkout (Primary highlight in blue) */}
                <button
                  type="button"
                  disabled={Boolean(branchOperationLoading)}
                  onClick={async () => {
                    if (!activeFlyoutBranch) return;
                    const targetBranch = activeFlyoutBranch.startsWith('origin/')
                      ? activeFlyoutBranch.replace('origin/', '')
                      : activeFlyoutBranch;
                    await checkoutBranch(targetBranch);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-1 bg-sky-500/15 text-sky-400 font-semibold hover:bg-sky-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between cursor-pointer transition-colors whitespace-nowrap truncate"
                  title={`切换到分支 '${activeFlyoutBranch}' (Checkout)`}
                >
                  <div className="flex items-center gap-2 min-w-0 truncate">
                    {branchOperationLoading?.type === 'checkout' && branchOperationLoading?.branchName === activeFlyoutBranch ? (
                      <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />
                    ) : null}
                    <span className="truncate">{t.branchMenu.actions.checkout}</span>
                  </div>
                  <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 ml-2" />
                </button>

                {/* 2. New Branch from 'test'... */}
                <button
                  type="button"
                  onClick={() => setNewBranchModalSource(activeFlyoutBranch)}
                  className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
                  title={t.branchMenu.actions.newBranchFrom(activeFlyoutBranch)}
                >
                  <span className="truncate">{t.branchMenu.actions.newBranchFrom(activeFlyoutBranch)}</span>
                </button>

                {/* 3. Checkout and Rebase onto 'dev' */}
                <button
                  type="button"
                  onClick={async () => {
                    await checkoutAndRebase(activeFlyoutBranch, currentBranchName);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
                  title={`切换并变基到 '${currentBranchName}' (Checkout and Rebase)`}
                >
                  <span className="truncate">{t.branchMenu.actions.checkoutAndRebaseOnto(currentBranchName)}</span>
                </button>

                {/* 4. Checkout and Update */}
                <button
                  type="button"
                  onClick={async () => {
                    await checkoutAndUpdate(activeFlyoutBranch);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
                  title="切换并拉取最新代码 (Checkout and Update)"
                >
                  <span className="truncate">{t.branchMenu.actions.checkoutAndUpdate}</span>
                </button>

                <div className="my-0.5 border-t border-theme/60" />

                {/* 5. Compare with 'dev' */}
                <button
                  type="button"
                  onClick={() => {
                    compareBranchWithCurrent(activeFlyoutBranch);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
                  title={`与 '${currentBranchName}' 对比差异 (Compare with)`}
                >
                  <span className="truncate">{t.branchMenu.actions.compareWith(currentBranchName)}</span>
                </button>

                {/* 6. Show Diff with Working Tree */}
                <button
                  type="button"
                  onClick={() => {
                    showBranchDiffWithWorkingTree(activeFlyoutBranch);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
                  title={t.branchMenu.actions.showDiffWithWorkingTree}
                >
                  <span className="truncate">{t.branchMenu.actions.showDiffWithWorkingTree}</span>
                </button>

                <div className="my-0.5 border-t border-theme/60" />

                {/* 7. Rebase 'dev' onto this branch */}
                <button
                  type="button"
                  onClick={async () => {
                    await rebaseBranch(activeFlyoutBranch);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
                  title={`将 '${currentBranchName}' 变基到 '${activeFlyoutBranch}' (Rebase onto)`}
                >
                  <span className="truncate">{t.branchMenu.actions.rebaseOnto(activeFlyoutBranch, currentBranchName)}</span>
                </button>

                {/* 8. Merge into 'dev' */}
                <button
                  type="button"
                  disabled={Boolean(branchOperationLoading)}
                  onClick={async () => {
                    await mergeBranch(activeFlyoutBranch);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-theme-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between text-theme-main cursor-pointer whitespace-nowrap truncate"
                  title={`将 '${activeFlyoutBranch}' 合并到 '${currentBranchName}' (Merge into)`}
                >
                  <span className="truncate">{t.branchMenu.actions.mergeInto(activeFlyoutBranch, currentBranchName)}</span>
                  {branchOperationLoading?.type === 'merge' && branchOperationLoading?.branchName === activeFlyoutBranch && (
                    <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0 ml-1.5" />
                  )}
                </button>

                {/* 8b. Undo Merge (常态：与其它菜单项一致为常规可用状态，点击后弹出确认框执行安全撤销) */}
                <button
                  type="button"
                  disabled={Boolean(branchOperationLoading)}
                  onClick={() => {
                    setUndoMergeTarget(activeFlyoutBranch);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-theme-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between text-theme-main hover:text-rose-400 cursor-pointer whitespace-nowrap truncate group transition"
                  title={
                    useAppStore.getState().language === 'zh-CN'
                      ? `撤销将 '${activeFlyoutBranch}' 合并到 '${currentBranchName}' 的操作`
                      : `Undo Merge '${activeFlyoutBranch}' into '${currentBranchName}'`
                  }
                >
                  <span className="truncate">
                    {t.branchMenu.actions.undoMergeInto(activeFlyoutBranch, currentBranchName)}
                  </span>
                  <Undo2 className="w-3.5 h-3.5 text-theme-dim group-hover:text-rose-400 shrink-0 ml-1.5 transition-colors" />
                </button>

                <div className="my-0.5 border-t border-theme/60" />

                {/* 9. New Worktree from this branch... */}
                <button
                  type="button"
                  onClick={() => {
                    useAppStore.getState().createNewWindow();
                    onClose();
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
                  title={`基于 '${activeFlyoutBranch}' 建立新工作树窗口... (New Worktree)`}
                >
                  <span className="truncate">{t.branchMenu.actions.newWorktreeFrom(activeFlyoutBranch)}</span>
                </button>

                <div className="my-0.5 border-t border-theme/60" />

                {/* 10. Update */}
                <button
                  type="button"
                  onClick={async () => {
                    await checkoutAndUpdate(activeFlyoutBranch);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
                  title={t.branchMenu.actions.update}
                >
                  <span className="truncate">{t.branchMenu.actions.update}</span>
                </button>

                {/* 11. Push... */}
                <button
                  type="button"
                  onClick={() => {
                    openPushModal(activeFlyoutBranch);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center justify-between text-theme-main cursor-pointer whitespace-nowrap truncate"
                  title={t.branchMenu.actions.push}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{t.branchMenu.actions.push}</span>
                    {activeFlyoutBranchObj && activeFlyoutBranchObj.outgoing > 0 && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[10px] font-mono font-bold shrink-0">
                        <span>↗</span>
                        <span>{activeFlyoutBranchObj.outgoing}</span>
                      </span>
                    )}
                  </div>
                </button>

                {/* 12. Tracked Branch (Only for local branch) */}
                {!isRemoteFlyout && (
                  <div
                    onClick={() => setIsTrackedOpen(!isTrackedOpen)}
                    className="px-3 py-1 hover:bg-theme-hover flex items-center justify-between text-theme-main cursor-pointer whitespace-nowrap truncate"
                    title={t.branchMenu.actions.trackedBranch(`origin/${activeFlyoutBranch}`)}
                  >
                    <span className="truncate">{t.branchMenu.actions.trackedBranch(`origin/${activeFlyoutBranch}`)}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-theme-dim shrink-0 ml-1.5" />
                  </div>
                )}

                {!isRemoteFlyout && <div className="my-0.5 border-t border-theme/60" />}

                {/* 13. Rename... (F2) (Only for local branch) */}
                {!isRemoteFlyout && (
                  <button
                    type="button"
                    onClick={() => setRenameModalBranch(activeFlyoutBranch)}
                    className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center justify-between text-theme-main cursor-pointer whitespace-nowrap truncate"
                    title={t.branchMenu.actions.rename}
                  >
                    <span className="truncate">{t.branchMenu.actions.rename}</span>
                    <span className="text-theme-dim text-[10px] font-mono shrink-0 ml-2">F2</span>
                  </button>
                )}

                {/* 14. Delete (Red Warning) */}
                <button
                  type="button"
                  onClick={() => {
                    setBranchToDelete(activeFlyoutBranch);
                    setIsRemoteToDelete(isRemoteFlyout);
                    setForceDelete(false);
                    setDeleteError(null);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-rose-500/15 text-rose-400 hover:text-rose-500 flex items-center gap-2 cursor-pointer font-medium transition-colors whitespace-nowrap truncate"
                  title={
                    isRemoteFlyout
                      ? `删除远程分支 '${activeFlyoutBranch}' (Delete Remote)`
                      : `删除本地分支 '${activeFlyoutBranch}' (Delete)`
                  }
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">
                    {renderDualText(isRemoteFlyout ? t.branchMenu.actions.deleteRemote : t.branchMenu.actions.delete)}
                  </span>
                </button>
              </div>
            );
          })()}
          </div>
        )}
      </div>

      {/* Modal 1: New Branch */}
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
                // If user didn't want to checkout, switch back
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

      {/* Modal 2: Checkout Tag or Revision */}
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

      {/* Modal 3: Rename Branch (F2) */}
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

      {/* Modal 4: High-risk Delete Branch Confirmation */}
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
              setDeleteError(result.message || '删除失败');
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

      {/* Undo Merge Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(undoMergeTarget)}
        title={
          useAppStore.getState().language === 'zh-CN'
            ? `撤销合并 (Undo Merge)`
            : `Undo Merge`
        }
        confirmText={
          useAppStore.getState().language === 'zh-CN' ? '确认撤销' : 'Undo Merge'
        }
        cancelText={
          useAppStore.getState().language === 'zh-CN' ? '取消' : 'Cancel'
        }
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
