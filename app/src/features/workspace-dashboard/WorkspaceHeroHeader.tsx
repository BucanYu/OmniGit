import React, { useState } from 'react';
import {
  FolderGit2,
  RotateCw,
  Settings,
  AlertCircle,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Check,
} from 'lucide-react';
import { useTranslation } from '../../locales';

interface WorkspaceHeroHeaderProps {
  workspaceName: string;
  rootPath: string;
  totalRepos: number;
  totalUncommitted: number;
  totalIncoming: number;
  totalOutgoing: number;
  runningServicesCount: number;
  isSyncing: boolean;
  onSyncAll: () => void;
  onOpenConfig: () => void;
}

export const WorkspaceHeroHeader: React.FC<WorkspaceHeroHeaderProps> = ({
  workspaceName,
  rootPath,
  totalRepos,
  totalUncommitted,
  totalIncoming,
  totalOutgoing,
  runningServicesCount,
  isSyncing,
  onSyncAll,
  onOpenConfig,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopyPath = async () => {
    if (!rootPath) return;
    try {
      await navigator.clipboard.writeText(rootPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="rounded-2xl border border-theme-border/70 bg-theme-card/90 dark:bg-theme-card/80 p-5 shadow-xs transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Identity & Path */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500/15 to-blue-600/10 text-sky-600 dark:text-sky-400 border border-sky-500/25 shrink-0 shadow-2xs mt-0.5">
            <FolderGit2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-theme-main tracking-tight leading-snug truncate">
                {workspaceName}
              </h1>
            </div>

            {/* Path Chip with One-click Copy */}
            {rootPath && (
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className="text-[11px] text-theme-muted font-mono truncate max-w-[280px] sm:max-w-md"
                  title={rootPath}
                >
                  {rootPath}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPath}
                  className="p-1 rounded-md text-theme-muted hover:text-theme-main hover:bg-theme-hover/80 transition-colors cursor-pointer"
                  title={copied ? t.dashboard.defaultHub.copiedPathToast : t.dashboard.defaultHub.copyPathTooltip}
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
          <button
            type="button"
            onClick={onSyncAll}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme-border/80 bg-theme-hover/50 hover:bg-theme-hover text-xs text-theme-main font-medium transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-500' : ''}`} />
            <span>{isSyncing ? t.dashboard.defaultHub.syncing : t.dashboard.defaultHub.syncAll}</span>
          </button>

          <button
            type="button"
            onClick={onOpenConfig}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-medium transition-all cursor-pointer shadow-xs shadow-sky-500/20 active:scale-98"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{t.dashboard.defaultHub.configureDashboard}</span>
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="flex flex-wrap items-center gap-2 mt-4 pt-3.5 border-t border-theme-border/50 text-xs">
        {/* Total Repos */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-theme-hover/60 border border-theme-border/70 text-theme-main font-medium">
          <FolderGit2 className="w-3.5 h-3.5 text-theme-dim" />
          <span>{t.dashboard.defaultHub.reposCount(totalRepos)}</span>
        </span>

        {/* Uncommitted Changes Status */}
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium ${
            totalUncommitted > 0
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
          }`}
        >
          {totalUncommitted > 0 ? (
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          <span>{t.dashboard.defaultHub.uncommittedTotal(totalUncommitted)}</span>
        </span>

        {/* Incoming / Outgoing Sync Indicator */}
        {(totalIncoming > 0 || totalOutgoing > 0) && (
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-theme-hover/60 border border-theme-border/70 text-theme-muted font-mono text-[11px]">
            {totalIncoming > 0 && (
              <span className="flex items-center gap-0.5 text-sky-600 dark:text-sky-400 font-medium">
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>{totalIncoming}</span>
              </span>
            )}
            {totalIncoming > 0 && totalOutgoing > 0 && <span className="text-theme-border">•</span>}
            {totalOutgoing > 0 && (
              <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{totalOutgoing}</span>
              </span>
            )}
          </span>
        )}

        {/* Running Services Badge */}
        {runningServicesCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span>{t.dashboard.defaultHub.quickActionServicesSubtitle(runningServicesCount)}</span>
          </span>
        )}
      </div>
    </div>
  );
};
