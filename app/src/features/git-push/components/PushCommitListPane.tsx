import React from 'react';
import {
  CheckSquare,
  Square,
  MinusSquare,
  Loader2,
  GitMerge,
  GitCommit,
  Rocket,
} from 'lucide-react';
import { useTranslation } from '../../../locales';
import type { OutgoingCommitItem } from '../../../store/useAppStore';
import { formatCommitTime } from '../utils/pushModalUtils';

interface PushCommitListPaneProps {
  width: number;
  commits: OutgoingCommitItem[];
  loading: boolean;
  hasLoadedData: boolean;
  sourceBranch: string;
  targetBranch: string;
  selectedCommitHash: string | null;
  checkedCommitHashes: Set<string>;
  onSelectCommit: (hash: string | null) => void;
  onToggleCommitCheck: (hash: string) => void;
  onToggleAllCheck: () => void;
  onContextMenu: (e: React.MouseEvent, commit: OutgoingCommitItem) => void;
  onOpenSelectiveModal: (hash: string, shortHash: string) => void;
}

export const PushCommitListPane: React.FC<PushCommitListPaneProps> = ({
  width,
  commits,
  loading,
  hasLoadedData,
  sourceBranch,
  targetBranch,
  selectedCommitHash,
  checkedCommitHashes,
  onSelectCommit,
  onToggleCommitCheck,
  onToggleAllCheck,
  onContextMenu,
  onOpenSelectiveModal,
}) => {
  const { t } = useTranslation();

  const isAllChecked = commits.length > 0 && checkedCommitHashes.size === commits.length;
  const isSubsetChecked = checkedCommitHashes.size > 0 && checkedCommitHashes.size < commits.length;

  return (
    <div
      style={{
        width: `${width}px`,
        minWidth: `${width}px`,
        maxWidth: `${width}px`,
      }}
      className="flex flex-col bg-theme-panel shrink-0"
    >
      {/* Header with Select All Checkbox */}
      <div className="px-3 py-1.5 border-b border-theme bg-theme-header text-[11px] font-semibold text-theme-muted flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={commits.length === 0}
            onClick={onToggleAllCheck}
            className="p-0.5 hover:text-sky-400 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            title={isAllChecked ? t.modals.push.deselectAllCommitsTooltip : t.modals.push.selectAllCommitsTooltip}
          >
            {isAllChecked && commits.length > 0 ? (
              <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
            ) : checkedCommitHashes.size > 0 ? (
              <MinusSquare className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <Square className="w-3.5 h-3.5 text-theme-dim" />
            )}
            <span>{t.modals.push.commitsHeader}</span>
          </button>
          <span className="text-theme-dim text-[10px] font-mono">({commits.length})</span>
        </div>

        {isSubsetChecked && (
          <span className="text-[10px] text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded font-mono">
            {t.modals.push.selectedCommitsBadge(checkedCommitHashes.size)}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-1 space-y-1">
        {loading && (!hasLoadedData || commits.length === 0) ? (
          <div className="p-8 text-center text-theme-dim space-y-2">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-sky-400" />
            <p>{t.modals.push.loadingCommits}</p>
          </div>
        ) : commits.length === 0 ? (
          <div className="p-8 text-center text-theme-dim space-y-1">
            <p className="font-semibold text-theme-main">{t.modals.push.everythingUpToDate}</p>
            <p className="text-[11px]">{t.modals.push.noUnpushedCommits(sourceBranch)}</p>
          </div>
        ) : (
          commits.map((commit: OutgoingCommitItem) => {
            const isSelected = selectedCommitHash === commit.hash;
            const isChecked = checkedCommitHashes.has(commit.hash);
            return (
              <div
                key={commit.hash}
                onClick={() => onSelectCommit(isSelected ? null : commit.hash)}
                onContextMenu={(e) => onContextMenu(e, commit)}
                className={`group p-2 rounded border cursor-pointer transition text-xs select-none ${
                  isSelected
                    ? 'bg-sky-500/15 border-sky-500/40 text-theme-main shadow-xs'
                    : 'bg-theme-card hover:bg-theme-card-hover border-theme-border-card text-theme-main'
                }`}
              >
                <div className="flex items-start gap-1.5">
                  {/* Commit Item Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCommitCheck(commit.hash);
                    }}
                    className="p-0.5 mt-0.5 hover:text-sky-400 transition cursor-pointer shrink-0"
                    title={isChecked ? t.modals.push.uncheckCommitTooltip : t.modals.push.checkCommitTooltip}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-theme-dim group-hover:text-theme-main" />
                    )}
                  </button>

                  {commit.isMerge ? (
                    <span title={t.modals.push.mergeCommitBadge} className="inline-flex shrink-0 mt-0.5">
                      <GitMerge className="w-3.5 h-3.5 text-purple-400" />
                    </span>
                  ) : (
                    <GitCommit className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-theme-main leading-tight line-clamp-2" title={commit.subject}>
                      {commit.subject}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-theme-dim font-mono gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        <span className="truncate max-w-[100px]" title={commit.authorName}>{commit.authorName}</span>
                        {commit.date && (
                          <>
                            <span className="text-theme-dim/60 shrink-0">•</span>
                            <span className="text-theme-dim shrink-0" title={commit.date}>
                              {formatCommitTime(commit.date)}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-theme-dim hover:text-theme-main" title={commit.hash}>
                          {commit.shortHash}
                        </span>
                        {/* Quick Selective Push Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenSelectiveModal(commit.hash, commit.shortHash);
                          }}
                          className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-[10px] transition cursor-pointer flex items-center gap-1"
                          title={t.modals.push.pushAloneCommitTooltip}
                        >
                          <Rocket className="w-2.5 h-2.5" />
                          <span>{t.modals.push.pushAloneBtn}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
