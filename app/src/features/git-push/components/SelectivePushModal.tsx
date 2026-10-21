import React from 'react';
import { Rocket, X, AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslation } from '../../../locales';
import type { SelectiveModalState } from '../types';

interface SelectivePushModalProps {
  state: SelectiveModalState;
  remoteName: string;
  targetBranch: string;
  pushingLoading: boolean;
  pushError: string | null;
  onClose: () => void;
  onUpdateState: (newState: SelectiveModalState) => void;
  onSubmit: () => Promise<void>;
}

export const SelectivePushModal: React.FC<SelectivePushModalProps> = ({
  state,
  remoteName,
  targetBranch,
  pushingLoading,
  pushError,
  onClose,
  onUpdateState,
  onSubmit,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div
        className="bg-theme-panel border border-theme-border-card rounded-lg shadow-2xl w-[460px] max-w-full p-4 flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-100 text-xs text-theme-main font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-theme pb-2.5">
          <div className="flex items-center gap-2 font-bold text-sm text-theme-main">
            <Rocket className="w-4 h-4 text-sky-400" />
            <span>{t.modals.push.selectiveModalTitle(state.hashes.length)}</span>
          </div>
          <button
            type="button"
            disabled={pushingLoading}
            onClick={() => !pushingLoading && onClose()}
            className="p-1 text-theme-dim hover:text-theme-main rounded transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-theme-dim text-[11px] leading-relaxed">
          {t.modals.push.selectiveModalDesc}
        </p>

        <div className="space-y-2.5 bg-theme-card p-3 rounded border border-theme-border-card">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="radio"
              name="selectiveMode"
              checked={state.mode === 'target'}
              onChange={() => onUpdateState({ ...state, mode: 'target' })}
              className="mt-0.5 text-sky-500 focus:ring-0 cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-theme-main">{t.modals.push.pushDirectTargetTitle}</span>
              <p className="text-[11px] text-theme-dim mt-0.5">{t.modals.push.pushDirectTargetDesc(remoteName, targetBranch)}</p>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-theme/60">
            <input
              type="radio"
              name="selectiveMode"
              checked={state.mode === 'patch'}
              onChange={() => onUpdateState({ ...state, mode: 'patch' })}
              className="mt-0.5 text-sky-500 focus:ring-0 cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-theme-main">{t.modals.push.pushPatchBranchTitle}</span>
              <p className="text-[11px] text-theme-dim mt-0.5">{t.modals.push.pushPatchBranchDesc}</p>
              {state.mode === 'patch' && (
                <input
                  type="text"
                  value={state.patchBranchName}
                  onChange={(e) => onUpdateState({ ...state, patchBranchName: e.target.value })}
                  placeholder={t.modals.push.patchBranchPlaceholder}
                  className="mt-2 w-full px-2.5 py-1.5 rounded bg-theme-input border border-theme-border-card text-xs text-theme-main focus:outline-none focus:border-sky-500 font-mono"
                />
              )}
            </div>
          </label>
        </div>

        {pushError && (
          <div className="p-2.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="leading-snug">{pushError}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={pushingLoading}
            onClick={onClose}
            className="px-3.5 py-1.5 rounded bg-theme-card hover:bg-theme-card-hover border border-theme-border-card text-theme-main text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            disabled={pushingLoading || (state.mode === 'patch' && !state.patchBranchName.trim())}
            onClick={onSubmit}
            className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {pushingLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t.modals.push.pushing}</span>
              </>
            ) : (
              <>
                <Rocket className="w-3.5 h-3.5" />
                <span>{t.modals.push.confirmSelectivePush}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
