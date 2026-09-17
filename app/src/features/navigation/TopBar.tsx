import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../locales';
import { BranchMenu } from './BranchMenu';
import { ThemeSwitcher } from './ThemeSwitcher';
import { UserAccountFilter } from './UserAccountFilter';
import { OmniGitLogo } from '../../components/ui/OmniGitLogo';
import {
  GitBranch,
  FolderGit2,
  ChevronDown,
  User,
  RefreshCw,
  ExternalLink,
  Plus,
  Check,
  Settings,
  Minus,
  Square,
  Copy,
  X,
} from 'lucide-react';

function getProjectBadge(name: string): string {
  if (!name) return 'GIT';
  const parts = name.split(/[-_.]/).filter(Boolean);
  if (parts.length >= 2) {
    return parts.map((p) => p[0].toUpperCase()).slice(0, 4).join('');
  }
  return name.slice(0, 4).toUpperCase();
}

export function TopBar() {
  const { t } = useTranslation();
  const {
    branches,
    projects,
    activeProjectId,
    setActiveProject,
    isRepoLoading,
    isBranchMenuOpen,
    setIsBranchMenuOpen,
    branchOperationLoading,
    gitUser,
    loadRepoData,
    createNewWindow,
    setIsAddRepoModalOpen,
    setIsSettingsModalOpen,
    openWelcomeScreen,
  } = useAppStore();

  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  const currentProject = projects.find((p) => p.id === activeProjectId);
  const safeBranches = Array.isArray(branches) ? branches : [];
  const currentBranchObj = safeBranches.find((b) => b && (b.isCurrent || b.name === currentProject?.currentBranch));
  const outgoingCount = currentProject?.outgoing || currentBranchObj?.outgoing || 0;
  const incomingCount = currentProject?.incoming || currentBranchObj?.incoming || 0;

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
  const isMac = window.electronAPI?.platform === 'darwin' || (typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac'));
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;
    window.electronAPI.isMaximized().then(setIsMaximized).catch(() => {});
  }, [isElectron]);

  const handleMinimize = () => {
    window.electronAPI?.minimize();
  };

  const handleMaximize = async () => {
    await window.electronAPI?.maximize();
    const max = await window.electronAPI?.isMaximized();
    setIsMaximized(!!max);
  };

  const handleClose = () => {
    window.electronAPI?.close();
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(target)) {
        setIsProjectDropdownOpen(false);
      }
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(target)) {
        // If clicking inside a modal dialog (e.g. new branch, delete confirmation), do not close branch menu
        const isInsideModal = (target as HTMLElement)?.closest?.(
          '[role="dialog"], .fixed, .omnigit-modal-overlay'
        );
        if (!isInsideModal) {
          setIsBranchMenuOpen(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsBranchMenuOpen]);

  return (
    <header
      className={`h-10 bg-theme-header/95 backdrop-blur-md border-b border-theme-border flex items-center justify-between px-3 text-xs select-none relative z-50 transition-colors ${
        isElectron ? 'app-region-drag' : ''
      }`}
      style={isElectron ? ({ WebkitAppRegion: 'drag' } as React.CSSProperties) : undefined}
    >
      {/* Top Indeterminate Progress Line when branch operation is in progress */}
      {branchOperationLoading && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-sky-950/80 overflow-hidden z-[100] pointer-events-none">
          <div className="h-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-400 w-full animate-pulse" />
        </div>
      )}

      {/* Left: Brand Logo, Project Identifier Capsule & Branch Capsule */}
      <div className={`flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-visible app-region-no-drag ${isElectron && isMac ? 'pl-[72px]' : ''}`}>
        {/* 1. App Top Brand Logo */}
        <div className="shrink-0">
          <OmniGitLogo size={20} showText={true} />
        </div>

        {/* Subtle Divider */}
        <div className="h-4 w-[1px] bg-theme-border shrink-0" />

        {/* 2. Current Project Identifier with Acronym Badge & Dropdown */}
        <div className="relative shrink min-w-0" ref={projectDropdownRef}>
          <div
            onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-xl cursor-pointer transition-all border shadow-xs ${
              isProjectDropdownOpen
                ? 'bg-theme-hover text-theme-main border-sky-500/70 shadow'
                : 'bg-theme-card hover:bg-theme-card-hover text-theme-main border-theme-border-card'
            }`}
            title={currentProject ? `Active Repo: ${currentProject.path}` : 'Select a project'}
          >
            {/* Project Monogram Badge (FEQI, LQS, etc.) */}
            <span className="px-1.5 py-0.2 rounded-md font-mono font-bold text-[10px] bg-gradient-to-r from-blue-600 to-indigo-600 text-white tracking-wider shadow-2xs shrink-0">
              {getProjectBadge(currentProject?.name || '')}
            </span>

            {/* Project Name */}
            <span
              className="font-semibold max-w-[100px] sm:max-w-[160px] md:max-w-[220px] truncate text-theme-main text-xs"
              title={currentProject ? `${currentProject.name}\n${currentProject.path}` : 'Select Project'}
            >
              {currentProject ? currentProject.name : 'Select Project'}
            </span>

            <ChevronDown className="w-3 h-3 text-theme-dim shrink-0 ml-0.5" />
          </div>

          {/* Quick Project Switch Dropdown */}
          {isProjectDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-72 theme-dropdown-panel rounded-lg py-1 z-50 text-xs text-theme-main font-sans">
              <div className="px-3 py-1 text-[10px] font-semibold text-theme-dim uppercase tracking-wider border-b border-theme-border-subtle flex items-center justify-between">
                <span>{t.topBar.projectSelector.title}</span>
                <span className="text-theme-muted">{t.topBar.projectSelector.repoCount(projects.length)}</span>
              </div>

              <div className="py-1 max-h-60 overflow-y-auto">
                {projects.length === 0 ? (
                  <div className="px-3 py-4 text-center text-theme-dim text-xs">
                    {t.topBar.projectSelector.noProjects}
                  </div>
                ) : (
                  projects.map((p) => {
                    const isSelected = p.id === activeProjectId;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setActiveProject(p.id);
                          setIsProjectDropdownOpen(false);
                        }}
                        className={`px-3 py-1.5 flex items-center justify-between cursor-pointer transition border-l-2 ${
                          isSelected
                            ? 'bg-theme-active text-theme-active-text border-theme-border-active font-semibold shadow-2xs'
                            : 'border-transparent hover:bg-theme-hover text-theme-muted hover:text-theme-main'
                        }`}
                        title={`${p.name}\n${p.path}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[9px] bg-blue-500/20 text-sky-400 shrink-0">
                            {getProjectBadge(p.name)}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className={`truncate text-xs ${isSelected ? 'text-theme-active-text font-bold' : 'text-theme-main'}`} title={p.name}>
                              {p.name}
                            </span>
                            <span className={`text-[10px] truncate ${isSelected ? 'text-theme-active-dim' : 'text-theme-dim'}`} title={`Branch: ${p.currentBranch}`}>
                              {p.currentBranch}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {p.incoming > 0 && (
                            <span className="text-sky-400 text-[10px] font-mono font-bold bg-sky-500/20 px-1 py-0.2 rounded">
                              ↙{p.incoming}
                            </span>
                          )}
                          {p.outgoing > 0 && (
                            <span className="text-emerald-400 text-[10px] font-mono font-bold bg-emerald-500/20 px-1 py-0.2 rounded">
                              ↗{p.outgoing}
                            </span>
                          )}
                          {isSelected && <Check className="w-3.5 h-3.5 text-sky-500" />}
                        </div>

                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-theme-border-subtle p-1.5 flex flex-col gap-1">
                <button
                  onClick={() => {
                    setIsProjectDropdownOpen(false);
                    openWelcomeScreen();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded bg-theme-hover hover:bg-theme-border-card text-theme-main text-xs transition cursor-pointer"
                >
                  <FolderGit2 className="w-3 h-3 text-sky-400" />
                  <span>{t.topBar.projectSelector.manageWorkspaces}</span>
                </button>
                <button
                  onClick={() => {
                    setIsProjectDropdownOpen(false);
                    setIsAddRepoModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded bg-theme-hover hover:bg-theme-border-card text-theme-muted hover:text-theme-main text-xs transition cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-emerald-400" />
                  <span>{t.topBar.projectSelector.addRepo}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. Branch Capsule (IDEA Habit: dev ↙1 ↗9) */}
        {currentProject && (
          <div className="relative flex items-center gap-2 shrink min-w-0 app-region-no-drag" ref={branchDropdownRef}>
            <button
              type="button"
              disabled={!!branchOperationLoading}
              onClick={() => setIsBranchMenuOpen(!isBranchMenuOpen)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl transition-all cursor-pointer text-xs border shrink-0 shadow-xs ${
                isBranchMenuOpen
                  ? 'bg-theme-hover text-theme-main border-sky-500/70 shadow'
                  : branchOperationLoading
                  ? 'bg-sky-500/15 border-sky-500/50 text-sky-300'
                  : 'bg-theme-card hover:bg-theme-card-hover text-theme-main border-theme-border-card'
              }`}
              title={branchOperationLoading ? branchOperationLoading.message : isRepoLoading ? t.topBar.switchProjectLoading : t.topBar.branchActionTooltip}
            >
              {branchOperationLoading || isRepoLoading ? (
                <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />
              ) : (
                <GitBranch className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              )}
              <span
                className={`font-semibold truncate max-w-[80px] sm:max-w-[130px] md:max-w-[180px] ${branchOperationLoading || isRepoLoading ? 'text-sky-300' : 'text-theme-main'}`}
                title={`Current Branch: ${currentProject.currentBranch}`}
              >
                {currentProject.currentBranch}
              </span>

              {/* Incoming Commits (未更新代码 - 选项 A 原生呼吸感) */}
              {incomingCount > 0 && !branchOperationLoading && (
                <span
                  className="flex items-center gap-0.5 px-2 py-0.5 bg-sky-500/15 text-sky-400 border border-sky-500/30 rounded-full text-[10px] font-mono font-bold animate-pulse shrink-0"
                  title={`Remote has ${incomingCount} unpulled commit(s). Click to update.`}
                >
                  <span>↙</span>
                  <span>{incomingCount}</span>
                </span>
              )}

              {/* Outgoing Commits (本地待推送) */}
              {outgoingCount > 0 && !branchOperationLoading && (
                <span
                  className="flex items-center gap-0.5 px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-mono font-bold shrink-0"
                  title={`Local has ${outgoingCount} unpushed commit(s).`}
                >
                  <span>↗</span>
                  <span>{outgoingCount}</span>
                </span>
              )}

              <ChevronDown className="w-3 h-3 text-theme-dim ml-0.5 shrink-0" />
            </button>

            {/* Visual feedback badge when operation is running */}
            {branchOperationLoading && (
              <div
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-sky-500/20 border border-sky-500/40 text-sky-300 rounded text-xs animate-pulse shadow-sm shrink-0"
                title={branchOperationLoading.message}
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
                <span className="font-medium max-w-[200px] truncate">{branchOperationLoading.message}</span>
              </div>
            )}

            {/* Mount Branch Dropdown */}
            {isBranchMenuOpen && <BranchMenu onClose={() => setIsBranchMenuOpen(false)} />}
          </div>
        )}
      </div>

      {/* Right: Multi-Window, User Profile, Refresh & Theme Switcher */}
      <div className="flex items-center gap-2 text-theme-muted shrink-0 ml-2 app-region-no-drag">
        {/* Multi-Window Button (客户端多开) */}
        <button
          onClick={createNewWindow}
          className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-theme-card hover:bg-theme-card-hover text-theme-muted hover:text-theme-main border border-theme-border-card transition cursor-pointer text-[11px] font-medium shadow-2xs shrink-0"
          title={t.topBar.windowActions.newWindowTooltip}
        >
          <ExternalLink className="w-3 h-3 text-sky-400 shrink-0" />
          <span className="hidden xl:inline">{t.topBar.windowActions.newWindow}</span>
        </button>

        {/* Real Git User Profile & Multi-User Filter */}
        <UserAccountFilter />

        {/* Quick Refresh */}
        {currentProject && (
          <button
            onClick={() => {
              loadRepoData(currentProject.path, true);
              useAppStore.getState().fetchCommitLogs(true);
              useAppStore.getState().pollWorkspaceSyncStatus();
            }}
            className="p-1 hover:text-theme-main hover:bg-theme-hover rounded-lg transition cursor-pointer"
            title={t.common.refresh}
          >
            <RefreshCw className="w-3.5 h-3.5 text-theme-dim hover:text-sky-400" />
          </button>
        )}

        {/* Settings button (System Settings & Custom Cache) */}
        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="p-1 hover:text-sky-400 text-theme-dim hover:bg-theme-hover rounded-lg transition cursor-pointer"
          title={t.topBar.windowActions.systemSettingsTooltip}
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-[1px] bg-theme-border" />

        {/* Theme Switcher (Replaces useless Play/Bug/Sliders) */}
        <ThemeSwitcher />

        {/* Windows Native Controls (Only in Electron desktop mode on non-macOS) */}
        {isElectron && !isMac && (
          <>
            <div className="h-4 w-[1px] bg-theme-border ml-1" />
            <div className="flex items-center -mr-3">
              <button
                type="button"
                onClick={handleMinimize}
                className="h-10 w-11 flex items-center justify-center hover:bg-theme-hover text-theme-muted hover:text-theme-main transition cursor-pointer"
                title={t.common.minimize}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleMaximize}
                className="h-10 w-11 flex items-center justify-center hover:bg-theme-hover text-theme-muted hover:text-theme-main transition cursor-pointer"
                title={isMaximized ? t.common.restore : t.common.maximize}
              >
                {isMaximized ? (
                  <Copy className="w-3 h-3 rotate-180" />
                ) : (
                  <Square className="w-3 h-3" />
                )}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="h-10 w-11 flex items-center justify-center hover:bg-rose-600 hover:text-white text-theme-muted transition cursor-pointer"
                title={t.common.closeWindow}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
