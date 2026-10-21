import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  Check,
  X,
} from 'lucide-react';
import { useTranslation } from '../../../locales';
import type { GitFileItem } from '../../../store/useAppStore';

interface StatusMergeBannerProps {
  isMerging: boolean;
  conflictFiles: GitFileItem[];
  mergeSourceBranch?: string;
  onOpenThreeWayMerge: (filePath: string) => void;
  onCompleteMerge: () => void;
  onAbortMerge: () => void;
}

export const StatusMergeBanner: React.FC<StatusMergeBannerProps> = ({
  isMerging,
  conflictFiles,
  mergeSourceBranch,
  onOpenThreeWayMerge,
  onCompleteMerge,
  onAbortMerge,
}) => {
  const { t } = useTranslation();

  if (!isMerging && conflictFiles.length === 0) return null;

  return (
    <div
      className={`px-3 py-2 border-b flex items-center justify-between text-xs transition ${
        conflictFiles.length > 0
          ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
          : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
      }`}
    >
      <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
        {conflictFiles.length > 0 ? (
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        )}
        <div className="truncate">
          <span className="font-bold">
            {conflictFiles.length > 0
              ? t.statusPanel.conflictBannerCount(conflictFiles.length)
              : t.statusPanel.conflictBannerResolved}
          </span>
          {mergeSourceBranch && (
            <span className="text-[10px] text-theme-dim ml-1.5 font-mono">
              ({mergeSourceBranch})
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {conflictFiles.length > 0 ? (
          <button
            onClick={() => onOpenThreeWayMerge(conflictFiles[0].path)}
            className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
            title={t.statusPanel.threeWayMergeTooltip}
          >
            <ArrowRightLeft className="w-3 h-3" />
            <span>{t.statusPanel.mergeBtn}</span>
          </button>
        ) : (
          <button
            onClick={onCompleteMerge}
            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
          >
            <Check className="w-3 h-3" />
            <span>{t.statusPanel.completeMerge}</span>
          </button>
        )}
        <button
          onClick={onAbortMerge}
          className="p-1 rounded text-theme-dim hover:text-rose-400 hover:bg-theme-hover transition cursor-pointer text-[11px]"
          title={t.statusPanel.abortMerge}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
