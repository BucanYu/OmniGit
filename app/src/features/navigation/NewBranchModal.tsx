import React, { useState } from 'react';
import { GitBranch, X } from 'lucide-react';
import { useTranslation } from '../../locales';

export interface NewBranchModalProps {
  isOpen: boolean;
  sourceBranch: string;
  onClose: () => void;
  onCreateBranch: (branchName: string, shouldCheckout: boolean) => Promise<void>;
}

export function NewBranchModal({
  isOpen,
  sourceBranch,
  onClose,
  onCreateBranch,
}: NewBranchModalProps) {
  const { t } = useTranslation();
  const [branchName, setBranchName] = useState('');
  const [shouldCheckout, setShouldCheckout] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = branchName.trim();
    if (!trimmed) {
      setError(t.modals.newBranch.nameRequired);
      return;
    }
    if (/\s/.test(trimmed)) {
      setError(t.modals.newBranch.noSpaces);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await onCreateBranch(trimmed, shouldCheckout);
      setBranchName('');
      onClose();
    } catch (err: any) {
      setError(err.message || t.modals.newBranch.createFailed);
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
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-theme-main">{t.modals.newBranch.title}</h3>
              <p className="text-[11px] text-theme-dim">
                {t.modals.newBranch.sourceBranch}<span className="font-mono text-sky-400 font-semibold">{sourceBranch}</span>
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
            <label className="text-xs font-semibold text-theme-main">{t.modals.newBranch.branchNameLabel}</label>
            <input
              type="text"
              autoFocus
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder={t.modals.newBranch.branchNamePlaceholder}
              className="px-3 py-1.5 rounded-md bg-theme-input border border-theme text-xs text-theme-main placeholder-theme-dim focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-theme-main cursor-pointer select-none">
            <input
              type="checkbox"
              checked={shouldCheckout}
              onChange={(e) => setShouldCheckout(e.target.checked)}
              className="rounded text-sky-500 focus:ring-sky-500 cursor-pointer"
            />
            <span>{t.modals.newBranch.checkoutAfterCreate}</span>
          </label>

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
              {isLoading ? t.modals.newBranch.creating : t.modals.newBranch.createButton}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
