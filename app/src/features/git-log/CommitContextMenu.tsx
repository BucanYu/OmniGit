import React, { useEffect, useRef } from 'react';
import { useTranslation } from '../../locales';
import {
  RotateCcw,
  Undo2,
  Clock,
  GitBranch,
  Tag,
  GitPullRequest,
  Copy,
  MessageSquare,
  Check,
} from 'lucide-react';
import type { GitCommitItem } from '../../store/useAppStore';

export interface CommitContextMenuProps {
  commit: GitCommitItem | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onReset: (commit: GitCommitItem) => void;
  onRevert: (commit: GitCommitItem) => void;
  onCheckout: (commit: GitCommitItem) => void;
  onNewBranch: (commit: GitCommitItem) => void;
  onNewTag: (commit: GitCommitItem) => void;
  onCherryPick: (commit: GitCommitItem) => void;
  onCopyHash: (commit: GitCommitItem) => void;
  onCopyMessage: (commit: GitCommitItem) => void;
}

export function CommitContextMenu({
  commit,
  position,
  onClose,
  onReset,
  onRevert,
  onCheckout,
  onNewBranch,
  onNewTag,
  onCherryPick,
  onCopyHash,
  onCopyMessage,
}: CommitContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!commit || !position) return null;

  // Ensure menu stays within viewport
  const menuWidth = 240;
  const menuHeight = 320;
  const x = Math.min(position.x, window.innerWidth - menuWidth - 10);
  const y = Math.min(position.y, window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      style={{ left: `${Math.max(10, x)}px`, top: `${Math.max(10, y)}px` }}
      className="fixed z-50 w-60 bg-theme-panel border border-theme rounded-lg shadow-2xl py-1 text-xs select-none animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Target Info Header */}
      <div className="px-3 py-1.5 border-b border-theme/60 bg-theme-header/50 mb-1 flex items-center justify-between">
        <span className="font-mono text-[11px] font-semibold text-sky-400">
          {commit.shortHash}
        </span>
        <span className="text-[10px] text-theme-dim truncate max-w-[120px]">
          {commit.authorName}
        </span>
      </div>

      {/* 1. Reset */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onReset(commit);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-theme-main hover:bg-theme-card hover:text-sky-400 transition-colors cursor-pointer group"
      >
        <RotateCcw className="w-3.5 h-3.5 text-amber-400 group-hover:text-sky-400 shrink-0" />
        <span className="flex-1 truncate">{t.gitLog.contextMenu.resetBranchHere}</span>
      </button>

      {/* 2. Revert */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onRevert(commit);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-theme-main hover:bg-theme-card hover:text-sky-400 transition-colors cursor-pointer group"
      >
        <Undo2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        <span className="flex-1 truncate">{t.gitLog.contextMenu.revertCommit}</span>
      </button>

      {/* 3. Checkout Revision */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onCheckout(commit);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-theme-main hover:bg-theme-card hover:text-sky-400 transition-colors cursor-pointer group"
      >
        <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span className="flex-1 truncate">{t.gitLog.contextMenu.checkoutRevision}</span>
      </button>

      <div className="my-1 border-t border-theme/60" />

      {/* 4. New Branch */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onNewBranch(commit);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-theme-main hover:bg-theme-card hover:text-sky-400 transition-colors cursor-pointer group"
      >
        <GitBranch className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="flex-1 truncate">{t.gitLog.contextMenu.newBranchHere}</span>
      </button>

      {/* 5. New Tag */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onNewTag(commit);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-theme-main hover:bg-theme-card hover:text-sky-400 transition-colors cursor-pointer group"
      >
        <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="flex-1 truncate">{t.gitLog.contextMenu.newTag}</span>
      </button>

      {/* 6. Cherry-Pick */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onCherryPick(commit);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-theme-main hover:bg-theme-card hover:text-sky-400 transition-colors cursor-pointer group"
      >
        <GitPullRequest className="w-3.5 h-3.5 text-rose-400 shrink-0" />
        <span className="flex-1 truncate">{t.gitLog.contextMenu.cherryPick}</span>
      </button>

      <div className="my-1 border-t border-theme/60" />

      {/* 7. Copy Revision Number */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onCopyHash(commit);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-theme-muted hover:bg-theme-card hover:text-theme-main transition-colors cursor-pointer group"
      >
        <Copy className="w-3.5 h-3.5 text-theme-dim group-hover:text-theme-main shrink-0" />
        <span className="flex-1 truncate">{t.gitLog.contextMenu.copyRevision}</span>
      </button>

      {/* 8. Copy Message */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onCopyMessage(commit);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-theme-muted hover:bg-theme-card hover:text-theme-main transition-colors cursor-pointer group"
      >
        <MessageSquare className="w-3.5 h-3.5 text-theme-dim group-hover:text-theme-main shrink-0" />
        <span className="flex-1 truncate">{t.gitLog.contextMenu.copyMessage}</span>
      </button>
    </div>
  );
}
