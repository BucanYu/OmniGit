import React, { useState, useMemo } from 'react';
import type { GitProject } from '../../store/types';
import {
  GitBranch,
  GitCommit,
  Files,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Search,
  X,
  LayoutGrid,
  List,
  Copy,
  Check,
  FolderGit2,
} from 'lucide-react';
import { useTranslation } from '../../locales';

interface WorkspaceRepoMatrixProps {
  projects: GitProject[];
  onOpenRepoCommit: (repoId: string) => void;
  onOpenRepoExplorer: (repoId: string) => void;
}

type FilterType = 'all' | 'dirty' | 'clean';
type ViewMode = 'grid' | 'list';

export const WorkspaceRepoMatrix: React.FC<WorkspaceRepoMatrixProps> = ({
  projects,
  onOpenRepoCommit,
  onOpenRepoExplorer,
}) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const dirtyCount = useMemo(
    () => projects.filter((p) => (p.uncommittedCount || 0) > 0).length,
    [projects]
  );
  const cleanCount = projects.length - dirtyCount;

  const filteredProjects = useMemo(() => {
    let list = projects;
    if (filter === 'dirty') {
      list = list.filter((p) => (p.uncommittedCount || 0) > 0);
    } else if (filter === 'clean') {
      list = list.filter((p) => (p.uncommittedCount || 0) === 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.path.toLowerCase().includes(q) ||
          (p.currentBranch && p.currentBranch.toLowerCase().includes(q))
      );
    }
    return list;
  }, [projects, filter, searchQuery]);

  const handleCopyPath = async (repoId: string, repoPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(repoPath);
      setCopiedId(repoId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  };

  return (
    <div className="space-y-3">
      {/* Toolbar: Filter Tabs & Search & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-theme-muted shrink-0">
            {t.dashboard.defaultHub.healthMatrix}
          </h2>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-theme-hover/60 border border-theme-border/60 text-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer text-[11px] ${
                filter === 'all'
                  ? 'bg-theme-card text-theme-main shadow-2xs'
                  : 'text-theme-muted hover:text-theme-main'
              }`}
            >
              {t.dashboard.defaultHub.filterAll} ({projects.length})
            </button>

            <button
              type="button"
              onClick={() => setFilter('dirty')}
              className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer text-[11px] flex items-center gap-1 ${
                filter === 'dirty'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                  : 'text-theme-muted hover:text-theme-main'
              }`}
            >
              <span>{t.dashboard.defaultHub.filterDirty}</span>
              {dirtyCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
              <span>({dirtyCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilter('clean')}
              className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer text-[11px] ${
                filter === 'clean'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  : 'text-theme-muted hover:text-theme-main'
              }`}
            >
              {t.dashboard.defaultHub.filterClean} ({cleanCount})
            </button>
          </div>
        </div>

        {/* Right: Search Box & View Mode Toggle */}
        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative flex items-center flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-theme-muted absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.dashboard.defaultHub.searchPlaceholder}
              className="w-full bg-theme-hover/50 hover:bg-theme-hover focus:bg-theme-card text-theme-main text-xs pl-8 pr-7 py-1.5 rounded-lg border border-theme-border/70 focus:border-sky-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 p-0.5 text-theme-muted hover:text-theme-main cursor-pointer"
                title={t.dashboard.defaultHub.clearFilter}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center p-0.5 rounded-lg bg-theme-hover/60 border border-theme-border/60 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-theme-card text-theme-main shadow-2xs'
                  : 'text-theme-muted hover:text-theme-main'
              }`}
              title={t.dashboard.defaultHub.viewGrid}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-theme-card text-theme-main shadow-2xs'
                  : 'text-theme-muted hover:text-theme-main'
              }`}
              title={t.dashboard.defaultHub.viewList}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredProjects.length === 0 && (
        <div className="py-12 px-4 rounded-2xl border border-dashed border-theme-border/80 bg-theme-hover/20 text-center">
          <FolderGit2 className="w-8 h-8 text-theme-muted/40 mx-auto mb-2" />
          <p className="text-xs text-theme-muted font-medium">
            {t.dashboard.defaultHub.noMatchingRepos}
          </p>
          {(searchQuery || filter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilter('all');
              }}
              className="mt-3 px-3 py-1 rounded-md text-xs font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 border border-sky-500/30 transition-colors cursor-pointer"
            >
              {t.dashboard.defaultHub.clearFilter}
            </button>
          )}
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && filteredProjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredProjects.map((repo) => {
            const isDirty = (repo.uncommittedCount || 0) > 0;
            return (
              <div
                key={repo.id}
                className="p-4 rounded-2xl border border-theme-border/70 bg-gradient-to-b from-theme-card to-theme-card/95 hover:border-sky-500/40 hover:shadow-md transition-all flex flex-col justify-between group shadow-2xs"
              >
                <div>
                  {/* Top: Repo Name & Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="p-1.5 rounded-lg bg-theme-hover/80 text-theme-dim group-hover:text-sky-500 group-hover:bg-sky-500/10 transition-colors shrink-0">
                        <FolderGit2 className="w-4 h-4" />
                      </div>
                      <h3
                        className="text-xs font-bold text-theme-main truncate leading-tight tracking-tight"
                        title={repo.name}
                      >
                        {repo.name}
                      </h3>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                        isDirty
                          ? 'bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300'
                          : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {isDirty ? (
                        <>
                          <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>{t.dashboard.defaultHub.dirtyState(repo.uncommittedCount || 0)}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>{t.dashboard.defaultHub.cleanState}</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Branch Pill & Remote Sync Indicator */}
                  <div className="flex items-center gap-2 mt-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-theme-hover/80 text-sky-600 dark:text-sky-400 text-[11px] font-mono border border-theme-border/60">
                      <GitBranch className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[140px]">{repo.currentBranch || 'HEAD'}</span>
                    </span>

                    {(repo.incoming > 0 || repo.outgoing > 0) && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-theme-muted font-mono bg-theme-hover/40 px-1.5 py-0.5 rounded border border-theme-border/40">
                        {repo.incoming > 0 && (
                          <span className="text-sky-600 dark:text-sky-400 flex items-center font-medium">
                            <ArrowDownLeft className="w-3 h-3" />
                            {repo.incoming}
                          </span>
                        )}
                        {repo.outgoing > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center font-medium">
                            <ArrowUpRight className="w-3 h-3" />
                            {repo.outgoing}
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Clean Path Line */}
                  <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-theme-muted font-mono">
                    <span className="truncate flex-1" title={repo.path}>
                      {repo.path}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleCopyPath(repo.id, repo.path, e)}
                      className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-theme-main transition-colors shrink-0 cursor-pointer"
                      title={copiedId === repo.id ? t.dashboard.defaultHub.copiedPathToast : t.dashboard.defaultHub.copyPathTooltip}
                    >
                      {copiedId === repo.id ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-2.5 h-2.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Footer: Dedicated Action Buttons */}
                <div className="pt-3 mt-3 border-t border-theme-border/50 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-theme-dim font-medium">
                    {isDirty ? '存在未提交改动' : '工作区已同步'}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenRepoExplorer(repo.id)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-theme-muted hover:text-theme-main bg-theme-hover/40 hover:bg-theme-hover border border-theme-border/50 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <Files className="w-3 h-3 text-theme-dim" />
                      <span>{t.dashboard.defaultHub.openInExplorer}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenRepoCommit(repo.id)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <GitCommit className="w-3 h-3" />
                      <span>{t.dashboard.defaultHub.jumpToGit}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && filteredProjects.length > 0 && (
        <div className="rounded-2xl border border-theme-border/70 bg-theme-card/90 dark:bg-theme-card/80 overflow-hidden divide-y divide-theme-border/50 shadow-2xs">
          {filteredProjects.map((repo) => {
            const isDirty = (repo.uncommittedCount || 0) > 0;
            return (
              <div
                key={repo.id}
                className="px-4 py-3 hover:bg-theme-hover/40 transition-colors flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-1 rounded-md bg-theme-hover/60 text-theme-dim shrink-0">
                    <FolderGit2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-theme-main truncate max-w-[160px] sm:max-w-[220px]">
                    {repo.name}
                  </span>

                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-theme-hover/80 text-sky-600 dark:text-sky-400 text-[10px] font-mono border border-theme-border/50 shrink-0">
                    <GitBranch className="w-2.5 h-2.5" />
                    <span>{repo.currentBranch || 'HEAD'}</span>
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                      isDirty
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {isDirty ? repo.uncommittedCount + ' 改动' : '干净'}
                  </span>

                  <span
                    className="text-[10px] text-theme-muted font-mono truncate hidden md:inline-block max-w-[240px]"
                    title={repo.path}
                  >
                    {repo.path}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenRepoExplorer(repo.id)}
                    className="px-2 py-1 rounded text-xs font-medium text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Files className="w-3 h-3 text-theme-dim" />
                    <span>{t.dashboard.defaultHub.openInExplorer}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenRepoCommit(repo.id)}
                    className="px-2.5 py-1 rounded text-xs font-medium bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/25 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>{t.dashboard.defaultHub.jumpToGit}</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
