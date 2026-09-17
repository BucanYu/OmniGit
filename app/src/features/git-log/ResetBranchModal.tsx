import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, X } from 'lucide-react';
import type { GitCommitItem } from '../../store/useAppStore';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useTranslation } from '../../locales';

export interface ResetBranchModalProps {
  isOpen: boolean;
  commit: GitCommitItem | null;
  currentBranch: string;
  onClose: () => void;
  onConfirmReset: (mode: 'soft' | 'mixed' | 'hard') => Promise<void>;
}

export function ResetBranchModal({
  isOpen,
  commit,
  currentBranch,
  onClose,
  onConfirmReset,
}: ResetBranchModalProps) {
  const { t } = useTranslation();
  const [selectedMode, setSelectedMode] = useState<'soft' | 'mixed' | 'hard'>('mixed');
  const [isHardConfirmOpen, setIsHardConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !commit) return null;

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMode === 'hard') {
      setIsHardConfirmOpen(true);
      return;
    }
    await executeReset(selectedMode);
  };

  const executeReset = async (mode: 'soft' | 'mixed' | 'hard') => {
    setIsLoading(true);
    try {
      await onConfirmReset(mode);
      setIsHardConfirmOpen(false);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
        <div
          className="w-full max-w-lg bg-theme-panel border border-theme rounded-lg shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-theme bg-theme-header">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-theme-main">
                  {t.modals.resetBranch.title}
                </h3>
                <p className="text-[11px] text-theme-dim">
                  {t.modals.resetBranch.currentBranchLabel}<span className="font-mono text-sky-400 font-medium">{currentBranch}</span>
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

          {/* Commit Target Card */}
          <div className="px-5 pt-4">
            <div className="p-3 rounded-md bg-theme-card border border-theme-subtle flex flex-col gap-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold text-sky-400 text-[11px] px-1.5 py-0.5 rounded bg-sky-400/10 border border-sky-400/20">
                  {commit.shortHash}
                </span>
                <span className="text-[11px] text-theme-dim">{commit.date}</span>
              </div>
              <p className="font-medium text-theme-main text-xs line-clamp-2 mt-0.5">
                {commit.message}
              </p>
              <div className="text-[11px] text-theme-muted mt-0.5">
                {t.modals.resetBranch.authorLabel}<span className="text-theme-main">{commit.authorName}</span>
              </div>
            </div>
          </div>

          {/* Options Form */}
          <form onSubmit={handleInitialSubmit} className="p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-semibold text-theme-main">{t.modals.resetBranch.resetTypeLabel}</label>

              {/* Mixed Mode (Recommended) */}
              <label
                className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  selectedMode === 'mixed'
                    ? 'bg-sky-500/10 border-sky-500/50 text-theme-main'
                    : 'bg-theme-card/60 border-theme hover:bg-theme-card text-theme-muted'
                }`}
              >
                <input
                  type="radio"
                  name="resetMode"
                  value="mixed"
                  checked={selectedMode === 'mixed'}
                  onChange={() => setSelectedMode('mixed')}
                  className="mt-0.5 text-sky-500 focus:ring-sky-500 cursor-pointer"
                />
                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-2 font-medium text-theme-main">
                    <span>{t.modals.resetBranch.mixedTitle}</span>
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-theme-panel border border-theme text-theme-dim">
                      --mixed
                    </span>
                  </div>
                  <p className="text-[11px] text-theme-dim mt-0.5 leading-relaxed">
                    {t.modals.resetBranch.mixedDesc}
                  </p>
                </div>
              </label>

              {/* Soft Mode */}
              <label
                className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  selectedMode === 'soft'
                    ? 'bg-sky-500/10 border-sky-500/50 text-theme-main'
                    : 'bg-theme-card/60 border-theme hover:bg-theme-card text-theme-muted'
                }`}
              >
                <input
                  type="radio"
                  name="resetMode"
                  value="soft"
                  checked={selectedMode === 'soft'}
                  onChange={() => setSelectedMode('soft')}
                  className="mt-0.5 text-sky-500 focus:ring-sky-500 cursor-pointer"
                />
                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-2 font-medium text-theme-main">
                    <span>{t.modals.resetBranch.softTitle}</span>
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-theme-panel border border-theme text-theme-dim">
                      --soft
                    </span>
                  </div>
                  <p className="text-[11px] text-theme-dim mt-0.5 leading-relaxed">
                    {t.modals.resetBranch.softDesc}
                  </p>
                </div>
              </label>

              {/* Hard Mode (High Risk) */}
              <label
                className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  selectedMode === 'hard'
                    ? 'bg-rose-500/10 border-rose-500/60 text-theme-main'
                    : 'bg-theme-card/60 border-theme hover:bg-theme-card text-theme-muted'
                }`}
              >
                <input
                  type="radio"
                  name="resetMode"
                  value="hard"
                  checked={selectedMode === 'hard'}
                  onChange={() => setSelectedMode('hard')}
                  className="mt-0.5 text-rose-500 focus:ring-rose-500 cursor-pointer"
                />
                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-2 font-medium text-rose-400">
                    <span>{t.modals.resetBranch.hardTitle}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400 font-semibold">
                      {t.modals.resetBranch.dangerBadge}
                    </span>
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-theme-panel border border-theme text-theme-dim">
                      --hard
                    </span>
                  </div>
                  <p className="text-[11px] text-theme-dim mt-0.5 leading-relaxed">
                    {t.modals.resetBranch.hardDesc}
                  </p>
                </div>
              </label>
            </div>

            {/* Warning notice if Hard is selected */}
            {selectedMode === 'hard' && (
              <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-2 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="text-[11px]">
                  {t.modals.resetBranch.hardWarningNotice}
                </span>
              </div>
            )}

            {/* Footer Buttons */}
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
                className={`px-4 py-1.5 rounded-md text-xs font-medium text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm ${
                  selectedMode === 'hard'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-sky-600 hover:bg-sky-700'
                }`}
              >
                {isLoading ? t.common.loading : t.modals.resetBranch.confirmResetBtn}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* High-risk Secondary Confirm Dialog for Hard Reset */}
      <ConfirmDialog
        isOpen={isHardConfirmOpen}
        title={t.modals.resetBranch.hardConfirmPrompt}
        variant="danger"
        icon="alert"
        confirmText={t.modals.resetBranch.hardConfirmBtn}
        cancelText={t.modals.resetBranch.hardCancelBtn}
        isLoading={isLoading}
        onCancel={() => setIsHardConfirmOpen(false)}
        onConfirm={() => executeReset('hard')}
        description={
          <div className="flex flex-col gap-2 text-xs">
            <p className="text-theme-main font-medium">
              {t.modals.resetBranch.hardConfirmDesc(currentBranch)}{' '}
              <span className="font-mono text-amber-400 font-semibold">{commit.shortHash}</span>。
            </p>
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] leading-relaxed">
              <strong>{t.modals.resetBranch.hardWarningTitle}</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>{t.modals.resetBranch.hardWarningBullet1}</li>
                <li>{t.modals.resetBranch.hardWarningBullet2}</li>
                <li>{t.modals.resetBranch.hardWarningBullet3}</li>
              </ul>
            </div>
          </div>
        }
      />
    </>
  );
}
