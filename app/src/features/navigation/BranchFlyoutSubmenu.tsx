import React from 'react';
import { ChevronRight, RefreshCw, Check, Undo2, Trash2 } from 'lucide-react';
import { useAppStore, type BranchItem } from '../../store/useAppStore';
import { useTranslation, renderDualText } from '../../locales';

interface BranchFlyoutSubmenuProps {
  flyoutRef: React.RefObject<HTMLDivElement | null>;
  flyoutPos: { top: number };
  activeFlyoutBranch: string;
  currentBranchName: string;
  safeBranches: BranchItem[];
  outgoingCount: number;
  isTrackedOpen: boolean;
  setIsTrackedOpen: (v: boolean) => void;
  setNewBranchModalSource: (b: string | null) => void;
  setRenameModalBranch: (b: string | null) => void;
  setUndoMergeTarget: (b: string | null) => void;
  setActiveFlyoutBranch: (b: string | null) => void;
  setBranchToDelete: (b: string | null) => void;
  setIsRemoteToDelete: (v: boolean) => void;
  setForceDelete: (v: boolean) => void;
  setDeleteError: (v: string | null) => void;
  onClose: () => void;
}

export const BranchFlyoutSubmenu: React.FC<BranchFlyoutSubmenuProps> = ({
  flyoutRef,
  flyoutPos,
  activeFlyoutBranch,
  currentBranchName,
  safeBranches,
  outgoingCount,
  isTrackedOpen,
  setIsTrackedOpen,
  setNewBranchModalSource,
  setRenameModalBranch,
  setUndoMergeTarget,
  setActiveFlyoutBranch,
  setBranchToDelete,
  setIsRemoteToDelete,
  setForceDelete,
  setDeleteError,
  onClose,
}) => {
  const { t } = useTranslation();
  const {
    projects,
    activeProjectId,
    checkoutBranch,
    mergeBranch,
    branchOperationLoading,
    updateProject,
    rebaseBranch,
    checkoutAndRebase,
    checkoutAndUpdate,
    openPushModal,
    prefetchOutgoingCommits,
    showBranchDiffWithWorkingTree,
    compareBranchWithCurrent,
  } = useAppStore();

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeFlyoutBranchObj = safeBranches.find((b) => b && b.name === activeFlyoutBranch);
  const isRemoteFlyout = Boolean(
    activeFlyoutBranch?.startsWith('origin/') || activeFlyoutBranchObj?.category === 'remote'
  );

  return (
    <div
      ref={flyoutRef}
      className="absolute left-full top-0 ml-1.5 w-[280px] min-w-[280px] max-w-[340px] theme-dropdown-panel rounded-lg py-1 z-50 text-xs text-theme-main shadow-2xl font-sans border border-theme-border-card animate-in fade-in zoom-in-95 duration-100 app-region-no-drag max-h-[calc(100vh-32px)] overflow-y-auto scrollbar-thin"
      style={{ top: flyoutPos.top }}
      onClick={(e) => e.stopPropagation()}
    >
      {activeFlyoutBranch === currentBranchName ? (
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setNewBranchModalSource(activeFlyoutBranch)}
            className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
            title={t.branchMenu.actions.newBranchFrom(activeFlyoutBranch)}
          >
            <span className="truncate">{t.branchMenu.actions.newBranchFrom(activeFlyoutBranch)}</span>
          </button>

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

          <button
            type="button"
            onMouseEnter={() => {
              if (activeProject && outgoingCount > 0) {
                prefetchOutgoingCommits(activeProject.path, activeFlyoutBranch);
              }
            }}
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

          <div
            onClick={() => setIsTrackedOpen(!isTrackedOpen)}
            className="px-3 py-1 hover:bg-theme-hover flex items-center justify-between text-theme-main cursor-pointer whitespace-nowrap truncate"
            title={t.branchMenu.actions.trackedBranch(`origin/${activeFlyoutBranch}`)}
          >
            <span className="truncate">
              {t.branchMenu.actions.trackedBranch(`origin/${activeFlyoutBranch}`)}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-theme-dim shrink-0 ml-1.5" />
          </div>

          {isTrackedOpen && (
            <div className="pl-4 py-1 bg-theme-card/50 border-y border-theme/40 space-y-0.5">
              <div
                onMouseEnter={() => {
                  if (activeProject && outgoingCount > 0) {
                    prefetchOutgoingCommits(activeProject.path, activeFlyoutBranch);
                  }
                }}
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
      ) : (
        <div className="space-y-0.5">
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
            title={t.branchMenu.actions.checkoutBranchTooltip(activeFlyoutBranch)}
          >
            <div className="flex items-center gap-2 min-w-0 truncate">
              {branchOperationLoading?.type === 'checkout' &&
              branchOperationLoading?.branchName === activeFlyoutBranch ? (
                <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />
              ) : null}
              <span className="truncate">{t.branchMenu.actions.checkout}</span>
            </div>
            <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 ml-2" />
          </button>

          <button
            type="button"
            onClick={() => setNewBranchModalSource(activeFlyoutBranch)}
            className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
            title={t.branchMenu.actions.newBranchFrom(activeFlyoutBranch)}
          >
            <span className="truncate">{t.branchMenu.actions.newBranchFrom(activeFlyoutBranch)}</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await checkoutAndRebase(activeFlyoutBranch, currentBranchName);
              onClose();
            }}
            className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
            title={t.branchMenu.actions.checkoutAndRebaseOnto(currentBranchName)}
          >
            <span className="truncate">
              {t.branchMenu.actions.checkoutAndRebaseOnto(currentBranchName)}
            </span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await checkoutAndUpdate(activeFlyoutBranch);
              onClose();
            }}
            className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
            title={t.branchMenu.actions.checkoutAndUpdate}
          >
            <span className="truncate">{t.branchMenu.actions.checkoutAndUpdate}</span>
          </button>

          <div className="my-0.5 border-t border-theme/60" />

          <button
            type="button"
            onClick={() => {
              compareBranchWithCurrent(activeFlyoutBranch);
              onClose();
            }}
            className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
            title={t.branchMenu.actions.compareWith(currentBranchName)}
          >
            <span className="truncate">{t.branchMenu.actions.compareWith(currentBranchName)}</span>
          </button>

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

          <button
            type="button"
            onClick={async () => {
              await rebaseBranch(activeFlyoutBranch);
              onClose();
            }}
            className="w-full text-left px-3 py-1 hover:bg-theme-hover flex items-center text-theme-main cursor-pointer whitespace-nowrap truncate"
            title={t.branchMenu.actions.rebaseOnto(activeFlyoutBranch, currentBranchName)}
          >
            <span className="truncate">
              {t.branchMenu.actions.rebaseOnto(activeFlyoutBranch, currentBranchName)}
            </span>
          </button>

          <button
            type="button"
            disabled={Boolean(branchOperationLoading)}
            onClick={async () => {
              await mergeBranch(activeFlyoutBranch);
              onClose();
            }}
            className="w-full text-left px-3 py-1 hover:bg-theme-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between text-theme-main cursor-pointer whitespace-nowrap truncate"
            title={t.branchMenu.actions.mergeInto(activeFlyoutBranch, currentBranchName)}
          >
            <span className="truncate">
              {t.branchMenu.actions.mergeInto(activeFlyoutBranch, currentBranchName)}
            </span>
            {branchOperationLoading?.type === 'merge' &&
              branchOperationLoading?.branchName === activeFlyoutBranch && (
                <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0 ml-1.5" />
              )}
          </button>

          <button
            type="button"
            disabled={Boolean(branchOperationLoading)}
            onClick={() => {
              setUndoMergeTarget(activeFlyoutBranch);
              setActiveFlyoutBranch(null);
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

          <button
            type="button"
            onMouseEnter={() => {
              if (activeProject && (activeFlyoutBranchObj?.outgoing || 0) > 0) {
                prefetchOutgoingCommits(activeProject.path, activeFlyoutBranch);
              }
            }}
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

          {!isRemoteFlyout && (
            <div
              onClick={() => setIsTrackedOpen(!isTrackedOpen)}
              className="px-3 py-1 hover:bg-theme-hover flex items-center justify-between text-theme-main cursor-pointer whitespace-nowrap truncate"
              title={t.branchMenu.actions.trackedBranch(`origin/${activeFlyoutBranch}`)}
            >
              <span className="truncate">
                {t.branchMenu.actions.trackedBranch(`origin/${activeFlyoutBranch}`)}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-theme-dim shrink-0 ml-1.5" />
            </div>
          )}

          {!isRemoteFlyout && <div className="my-0.5 border-t border-theme/60" />}

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
              isRemoteFlyout ? t.modals.deleteBranch.titleRemote : t.modals.deleteBranch.title
            }
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">
              {renderDualText(
                isRemoteFlyout ? t.branchMenu.actions.deleteRemote : t.branchMenu.actions.delete
              )}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
