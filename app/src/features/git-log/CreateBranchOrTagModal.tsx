import React, { useState } from 'react';
import { useTranslation } from '../../locales';
import { GitBranch, Tag, X } from 'lucide-react';
import type { GitCommitItem } from '../../store/useAppStore';

export interface CreateBranchOrTagModalProps {
  isOpen: boolean;
  commit: GitCommitItem | null;
  mode: 'branch' | 'tag';
  onClose: () => void;
  onCreateBranch: (branchName: string) => Promise<void>;
  onCreateTag: (tagName: string, message: string) => Promise<void>;
}

export function CreateBranchOrTagModal({
  isOpen,
  commit,
  mode,
  onClose,
  onCreateBranch,
  onCreateTag,
}: CreateBranchOrTagModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [tagMessage, setTagMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !commit) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(mode === 'branch' ? t.modals.createBranchOrTag.branchNameRequired : t.modals.createBranchOrTag.tagNameRequired);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      if (mode === 'branch') {
        await onCreateBranch(trimmed);
      } else {
        await onCreateTag(trimmed, tagMessage.trim());
      }
      setName('');
      setTagMessage('');
      onClose();
    } catch (err: any) {
      setError(err.message || t.common.error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-md bg-theme-panel border border-theme rounded-lg shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-theme bg-theme-header">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              {mode === 'branch' ? <GitBranch className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-theme-main">
                {mode === 'branch' ? t.modals.createBranchOrTag.newBranchTitle : t.modals.createBranchOrTag.newTagTitle}
              </h3>
              <p className="text-[11px] text-theme-dim">
                {t.modals.createBranchOrTag.baseRevision}<span className="font-mono text-sky-400 font-medium">{commit.shortHash}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-theme-dim hover:text-theme-main hover:bg-theme-card transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Commit Card */}
        <div className="px-5 pt-4">
          <div className="p-2.5 rounded bg-theme-card border border-theme-subtle text-xs flex flex-col gap-0.5">
            <div className="font-mono text-[11px] text-sky-400 font-semibold">{commit.shortHash}</div>
            <div className="text-theme-main font-medium truncate">{commit.message}</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-theme-main">
              {mode === 'branch' ? t.modals.createBranchOrTag.branchNameLabel : t.modals.createBranchOrTag.tagNameLabel}
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={mode === 'branch' ? t.modals.createBranchOrTag.branchPlaceholder : t.modals.createBranchOrTag.tagPlaceholder}
              className="px-3 py-1.5 rounded-md bg-theme-input border border-theme text-xs text-theme-main placeholder-theme-dim focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono"
            />
          </div>

          {mode === 'tag' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-theme-main">
                {t.modals.createBranchOrTag.tagMessageLabel}
              </label>
              <textarea
                rows={2}
                value={tagMessage}
                onChange={(e) => setTagMessage(e.target.value)}
                placeholder={t.modals.createBranchOrTag.tagMessagePlaceholder}
                className="px-3 py-1.5 rounded-md bg-theme-input border border-theme text-xs text-theme-main placeholder-theme-dim focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none"
              />
            </div>
          )}

          {error && <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded">{error}</div>}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-theme">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-md text-xs text-theme-muted hover:text-theme-main hover:bg-theme-card border border-theme transition-colors cursor-pointer"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-1.5 rounded-md text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              {isLoading ? t.modals.createBranchOrTag.creating : mode === 'branch' ? t.modals.createBranchOrTag.createAndCheckout : t.modals.createBranchOrTag.createTagBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
