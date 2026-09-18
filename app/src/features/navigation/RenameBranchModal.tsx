import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit3, X } from 'lucide-react';
import { useTranslation } from '../../locales';

export interface RenameBranchModalProps {
  isOpen: boolean;
  oldBranchName: string;
  onClose: () => void;
  onRename: (oldName: string, newName: string) => Promise<void>;
}

export function RenameBranchModal({
  isOpen,
  oldBranchName,
  onClose,
  onRename,
}: RenameBranchModalProps) {
  const { t } = useTranslation();
  const [newName, setNewName] = useState(oldBranchName);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setError(t.modals.renameBranch.nameRequired);
      return;
    }
    if (trimmed === oldBranchName) {
      onClose();
      return;
    }
    if (/\s/.test(trimmed)) {
      setError(t.modals.renameBranch.noSpaces);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await onRename(oldBranchName, trimmed);
      onClose();
    } catch (err: any) {
      setError(err.message || t.modals.renameBranch.renameFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-sm bg-theme-panel border border-theme rounded-lg shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-theme bg-theme-header">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-theme-main">{t.modals.renameBranch.title}</h3>
              <p className="text-[11px] text-theme-dim">
                {t.modals.renameBranch.currentName}<span className="font-mono text-amber-400 font-semibold">{oldBranchName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-theme-dim hover:text-theme-main hover:bg-theme-card transition-colors cursor-pointer"
            title={t.common.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-theme-main">{t.modals.renameBranch.newNameLabel}</label>
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t.modals.renameBranch.newNamePlaceholder}
              className="px-3 py-1.5 rounded-md bg-theme-input border border-theme text-xs text-theme-main placeholder-theme-dim focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono"
            />
          </div>

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
              {isLoading ? t.modals.renameBranch.renaming : t.modals.renameBranch.renameBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
