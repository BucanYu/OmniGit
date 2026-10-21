import React from 'react';
import { Rocket, ArrowUpRight, Copy } from 'lucide-react';
import { useTranslation } from '../../../locales';
import type { CommitContextMenuState, SelectiveModalState } from '../types';

interface CommitContextMenuProps {
  state: CommitContextMenuState;
  targetBranch: string;
  onClose: () => void;
  onOpenSelectiveModal: (state: SelectiveModalState) => void;
  onExecutePushToCommit: (hash: string) => Promise<void>;
  onCopyHash: (hash: string) => void;
}

export const CommitContextMenu: React.FC<CommitContextMenuProps> = ({
  state,
  targetBranch,
  onClose,
  onOpenSelectiveModal,
  onExecutePushToCommit,
  onCopyHash,
}) => {
  const { t } = useTranslation();

  return (
    <div
      style={{
        left: `${Math.min(state.x, window.innerWidth - 220)}px`,
        top: `${Math.min(state.y, window.innerHeight - 160)}px`,
      }}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-[1070] bg-theme-panel border border-theme rounded-lg shadow-2xl py-1 min-w-[200px] text-xs select-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-75 font-sans"
    >
      <div className="px-3 py-1.5 border-b border-theme/60 bg-theme-header/50 mb-1 flex items-center justify-between">
        <span className="font-mono text-[11px] font-semibold text-sky-400">
          {state.commit.shortHash}
        </span>
      </div>

      <button
        type="button"
        onClick={() => {
          const hash = state.commit.hash;
          onClose();
          onOpenSelectiveModal({
            isOpen: true,
            hashes: [hash],
            mode: 'target',
            targetBranch,
            patchBranchName: `patch/fix-${state.commit.shortHash}`,
          });
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-theme-main hover:bg-theme-card hover:text-sky-400 transition cursor-pointer"
      >
        <Rocket className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        <span>{t.modals.push.pushAloneCommitTooltip}...</span>
      </button>

      <button
        type="button"
        onClick={async () => {
          const hash = state.commit.hash;
          onClose();
          await onExecutePushToCommit(hash);
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-theme-main hover:bg-theme-card hover:text-sky-400 transition cursor-pointer"
      >
        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>{t.modals.push.pushOnlyUpToThisCommit}</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onCopyHash(state.commit.hash);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-theme-muted hover:bg-theme-card hover:text-theme-main transition cursor-pointer"
      >
        <Copy className="w-3.5 h-3.5 text-theme-dim shrink-0" />
        <span>{t.modals.push.copyCommitHash}</span>
      </button>
    </div>
  );
};
