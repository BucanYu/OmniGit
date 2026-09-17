import React, { useState } from 'react';
import { Search, X, GitBranch, User, Calendar, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../locales';

export function LogFilterBar() {
  const { t } = useTranslation();
  const {
    logFilters,
    setLogFilters,
    commitLogsLoading,
    fetchCommitLogs,
    branches,
    gitAuthors,
    gitUser,
    projects,
    activeProjectId,
  } = useAppStore();

  const [searchInput, setSearchInput] = useState(logFilters.query);
  const currentProject = projects.find((p) => p.id === activeProjectId);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setLogFilters({ query: searchInput.trim() });
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setLogFilters({ query: '' });
  };

  return (
    <div className="flex flex-col gap-2 p-2.5 border-b border-theme bg-theme-subbar text-xs select-none">
      {/* Search Input */}
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 w-3.5 h-3.5 text-theme-dim pointer-events-none" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          onBlur={() => {
            if (searchInput.trim() !== logFilters.query) {
              setLogFilters({ query: searchInput.trim() });
            }
          }}
          placeholder={t.gitLog.filter.searchPlaceholder}
          className="w-full pl-8 pr-7 py-1.5 rounded-md bg-theme-input border border-theme text-xs text-theme-main placeholder-theme-dim focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
        />
        {searchInput && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="absolute right-2 p-0.5 rounded text-theme-dim hover:text-theme-main hover:bg-theme-card transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Filters Row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Branch Filter */}
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-theme-card border border-theme-subtle text-theme-main min-w-0 max-w-[140px] sm:max-w-[170px] shrink">
          <GitBranch className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <select
            value={logFilters.branch}
            onChange={(e) => setLogFilters({ branch: e.target.value })}
            className="bg-transparent border-none text-[11px] text-theme-main focus:outline-none cursor-pointer pr-1 truncate min-w-0 w-full"
          >
            <option value="all" className="bg-theme-panel text-theme-main">
              {t.gitLog.filter.allBranches}
            </option>
            <option value="current" className="bg-theme-panel text-theme-main">
              {t.gitLog.filter.currentBranch(currentProject?.currentBranch || 'HEAD')}
            </option>
            {branches.map((b) => (
              <option key={b.name} value={b.name} className="bg-theme-panel text-theme-main">
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Author Filter */}
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-theme-card border border-theme-subtle text-theme-main min-w-[130px] max-w-[170px] shrink">
          <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <select
            value={logFilters.author}
            onChange={(e) => setLogFilters({ author: e.target.value })}
            className="bg-transparent border-none text-[11px] text-theme-main focus:outline-none cursor-pointer pr-1 truncate min-w-0 w-full"
          >
            <option value="all" className="bg-theme-panel text-theme-main">
              {t.gitLog.filter.allAuthors}
            </option>
            {gitUser?.name && !gitAuthors.some((a) => a.name.toLowerCase() === gitUser.name.toLowerCase()) && (
              <option value={gitUser.name} className="bg-theme-panel text-theme-main">
                {t.gitLog.filter.meAuthor(gitUser.name)}
              </option>
            )}
            {gitAuthors.map((a) => {
              const isMe = Boolean(gitUser?.name && a.name.toLowerCase() === gitUser.name.toLowerCase());
              const label = isMe
                ? `${t.gitLog.filter.meAuthor(a.name)} (${a.commitCount})`
                : `${a.name} (${a.commitCount})`;
              return (
                <option key={a.name} value={a.name} className="bg-theme-panel text-theme-main">
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-theme-card border border-theme-subtle text-theme-main min-w-0 max-w-[110px] shrink">
          <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <select
            value={logFilters.dateRange}
            onChange={(e) => setLogFilters({ dateRange: e.target.value })}
            className="bg-transparent border-none text-[11px] text-theme-main focus:outline-none cursor-pointer pr-1 truncate min-w-0 w-full"
          >
            <option value="all" className="bg-theme-panel text-theme-main">
              {t.gitLog.filter.allTime}
            </option>
            <option value="today" className="bg-theme-panel text-theme-main">
              {t.gitLog.filter.today}
            </option>
            <option value="week" className="bg-theme-panel text-theme-main">
              {t.gitLog.filter.last7Days}
            </option>
            <option value="month" className="bg-theme-panel text-theme-main">
              {t.gitLog.filter.last30Days}
            </option>
          </select>
        </div>

        <div className="flex-1" />

        {/* Refresh Button */}
        <button
          type="button"
          title={t.gitLog.filter.refreshTooltip}
          onClick={() => fetchCommitLogs(true)}
          disabled={commitLogsLoading}
          className="p-1.5 rounded text-theme-dim hover:text-theme-main hover:bg-theme-card border border-theme-subtle transition-colors cursor-pointer shrink-0 ml-auto"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${commitLogsLoading ? 'animate-spin text-sky-400' : ''}`}
          />
        </button>
      </div>
    </div>
  );
}
