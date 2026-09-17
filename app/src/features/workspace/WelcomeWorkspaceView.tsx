import React, { useState, useEffect, useRef } from 'react';
import { useAppStore, type WorkspaceGroupItem, type AppTheme } from '../../store/useAppStore';
import { OmniGitLogo } from '../../components/ui/OmniGitLogo';
import { APP_VERSION_LABEL } from '../../constants/version';
import { useTranslation } from '../../locales';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  FolderGit2,
  FolderOpen,
  DownloadCloud,
  ExternalLink,
  Search,
  Sliders,
  Settings,
  Trash2,
  ArrowRight,
  GitBranch,
  X,
  Layers,
  Sparkles,
  Check,
  Edit2,
  Copy,
  Languages,
  Moon,
  Sun,
  Terminal,
  Compass,
} from 'lucide-react';

const BADGE_PALETTE = [
  'bg-blue-600/90 text-white',
  'bg-emerald-600/90 text-white',
  'bg-purple-600/90 text-white',
  'bg-amber-600/90 text-white',
  'bg-rose-600/90 text-white',
  'bg-indigo-600/90 text-white',
  'bg-teal-600/90 text-white',
  'bg-cyan-600/90 text-white',
];

function getWorkspaceInitials(name: string): string {
  if (!name) return 'WS';
  const clean = name.replace(/[-_.]/g, ' ').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getBadgeColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return BADGE_PALETTE[hash % BADGE_PALETTE.length];
}

export function WelcomeWorkspaceView() {
  const { t, language, setLanguage } = useTranslation();
  const {
    savedWorkspaces,
    loadSavedWorkspaces,
    loadRecentProjects,
    removeSavedWorkspace,
    renameSavedWorkspace,
    openWorkspaceGroup,
    createWorkspaceFromFolder,
    openProjectInWorkspace,
    createNewWindow,
    setIsSettingsModalOpen,
    setIsAddRepoModalOpen,
    theme,
    setTheme,
    startupBehavior,
    setStartupBehavior,
    newWindowBehavior,
    setNewWindowBehavior,
    closeWelcomeScreen,
    projects,
  } = useAppStore();

  const [activeNav, setActiveNav] = useState<'workspaces' | 'customize'>('workspaces');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<WorkspaceGroupItem | null>(null);
  const [isOpeningFolder, setIsOpeningFolder] = useState(false);
  
  // Hover Popover State for displaying Git repositories inside workspace
  const [hoveredWorkspace, setHoveredWorkspace] = useState<{
    id: string;
    ws: WorkspaceGroupItem;
    top: number;
    left: number;
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    workspace: WorkspaceGroupItem;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;
  const isMac = (window as any).electronAPI?.platform === 'darwin' || (typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac'));

  useEffect(() => {
    loadSavedWorkspaces();
    loadRecentProjects();

    // 1. Electron IPC listener
    let unsubscribeIpc: (() => void) | undefined;
    if (window.electronAPI?.onWorkspaceChanged) {
      unsubscribeIpc = window.electronAPI.onWorkspaceChanged(() => {
        loadSavedWorkspaces();
        loadRecentProjects();
      });
    }

    // 2. Web BroadcastChannel
    let ch: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        ch = new BroadcastChannel('omnigit_workspace_channel');
        ch.onmessage = () => {
          loadSavedWorkspaces();
          loadRecentProjects();
        };
      } catch {}
    }

    // 3. Storage event
    const handleStorage = (e: StorageEvent) => {
      if (
        !e.key ||
        e.key === 'omnigit_saved_workspaces' ||
        e.key === 'omnigit_global_recent_projects' ||
        e.key.startsWith('omnigit_ws_paths_')
      ) {
        loadSavedWorkspaces();
        loadRecentProjects();
      }
    };
    window.addEventListener('storage', handleStorage);

    // 4. Focus & CustomEvent
    const handleRefresh = () => {
      loadSavedWorkspaces();
      loadRecentProjects();
    };
    window.addEventListener('focus', handleRefresh);
    window.addEventListener('omnigit:workspace-changed', handleRefresh);

    return () => {
      unsubscribeIpc?.();
      ch?.close();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('omnigit:workspace-changed', handleRefresh);
    };
  }, [loadSavedWorkspaces, loadRecentProjects]);

  useEffect(() => {
    if (savedWorkspaces.length > 0 && !selectedWorkspaceId) {
      setSelectedWorkspaceId(savedWorkspaces[0].id);
    }
  }, [savedWorkspaces, selectedWorkspaceId]);

  // Keyboard navigation & search shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'Escape') {
        setContextMenu(null);
        setHoveredWorkspace(null);
      } else if (e.key === 'Enter' && selectedWorkspaceId && activeNav === 'workspaces') {
        const target = savedWorkspaces.find((w) => w.id === selectedWorkspaceId);
        if (target) {
          openWorkspaceGroup(target, false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWorkspaceId, activeNav, savedWorkspaces, openWorkspaceGroup]);

  // Context menu click-away
  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', handleClose);
      window.addEventListener('contextmenu', handleClose);
    }
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
    };
  }, [contextMenu]);

  // Filter workspaces by search query (name, root path, or any contained repo name)
  const filteredWorkspaces = savedWorkspaces.filter((ws) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchName = ws.name.toLowerCase().includes(q);
    const matchPath = ws.rootPath.toLowerCase().includes(q);
    const matchRepos = ws.repos.some(
      (r) => r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q)
    );
    return matchName || matchPath || matchRepos;
  });

  const handleOpenLocalFolder = async () => {
    setIsOpeningFolder(true);
    try {
      let chosenPath: string | null = null;
      if (window.electronAPI?.selectFolder) {
        chosenPath = await window.electronAPI.selectFolder();
      } else {
        const input = prompt(
          t.welcome.openFolderModalPrompt,
          ''
        );
        if (input && input.trim()) {
          chosenPath = input.trim();
        }
      }

      if (chosenPath) {
        const newWs = await createWorkspaceFromFolder(chosenPath);
        if (newWs) {
          await openWorkspaceGroup(newWs, false);
        } else {
          await openProjectInWorkspace(chosenPath, false);
        }
      }
    } catch (err) {
      console.warn('Failed to open local folder:', err);
    } finally {
      setIsOpeningFolder(false);
    }
  };

  const handleOpenCloneModal = () => {
    setIsAddRepoModalOpen(true);
  };

  const handleDoubleClickWorkspace = (ws: WorkspaceGroupItem) => {
    openWorkspaceGroup(ws, false);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-theme-app text-theme-main overflow-hidden font-sans select-none">
      {/* 1. Frameless Window Titlebar (Drag Region for Desktop) */}
      <div
        className={`h-9 bg-theme-header border-b border-theme-border flex items-center justify-between px-3 text-xs shrink-0 select-none ${
          isElectron ? 'app-region-drag' : ''
        }`}
        style={isElectron ? ({ WebkitAppRegion: 'drag' } as React.CSSProperties) : undefined}
      >
        <div className={`flex items-center gap-2 ${isElectron && isMac ? 'pl-[72px]' : ''}`}>
          <OmniGitLogo size={18} showText={false} />
          <span className="font-semibold text-xs text-theme-main">{t.welcome.windowTitle}</span>
        </div>

        {/* Desktop window controls (non-macOS only) */}
        {isElectron && !isMac && (
          <div
            className="flex items-center app-region-no-drag -mr-2"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <button
              onClick={() => (window as any).electronAPI?.minimize()}
              className="w-10 h-9 flex items-center justify-center hover:bg-theme-hover text-theme-muted hover:text-theme-main transition cursor-pointer"
              title={t.common.minimize}
            >
              <span className="text-xs">─</span>
            </button>
            <button
              onClick={() => (window as any).electronAPI?.maximize()}
              className="w-10 h-9 flex items-center justify-center hover:bg-theme-hover text-theme-muted hover:text-theme-main transition cursor-pointer"
              title={t.common.maximize}
            >
              <span className="text-xs">▢</span>
            </button>
            <button
              onClick={() => (window as any).electronAPI?.close()}
              className="w-10 h-9 flex items-center justify-center hover:bg-rose-600 hover:text-white text-theme-muted transition cursor-pointer"
              title={t.common.closeWindow}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Main Welcome Workbench Layout (1:1 IntelliJ IDEA Style) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <aside className="w-64 bg-theme-sidebar border-r border-theme-border flex flex-col justify-between p-4 shrink-0">
          <div className="flex flex-col gap-6">
            {/* Logo & Product Badge */}
            <div className="flex items-center gap-3 px-1 pt-1">
              <OmniGitLogo size={32} showText={false} />
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-base tracking-tight text-theme-main leading-tight">
                  Omni<span className="text-sky-400">Git</span>
                </span>
                <span className="text-[11px] text-theme-dim font-mono">2026.1 / {APP_VERSION_LABEL}</span>
              </div>
            </div>

            {/* Navigation Tabs (IDEA Style) */}
            <nav className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setActiveNav('workspaces')}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeNav === 'workspaces'
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-2xs'
                    : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span>{t.welcome.recentWorkspaces}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveNav('customize')}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeNav === 'customize'
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-2xs'
                    : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover'
                }`}
              >
                <Sliders className="w-4 h-4 shrink-0" />
                <span>{t.welcome.customizeTab}</span>
              </button>
            </nav>
          </div>

          {/* Bottom Settings & Back to Workspace */}
          <div className="flex flex-col gap-2 pt-4 border-t border-theme-border">
            {projects.length > 0 && (
              <button
                type="button"
                onClick={closeWelcomeScreen}
                className="flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                <span>{t.welcome.workspaceCard.openButton} ({projects.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-theme-muted hover:text-theme-main hover:bg-theme-hover text-xs font-medium transition cursor-pointer"
            >
              <Settings className="w-4 h-4 text-theme-dim" />
              <span>{t.topBar.windowActions.systemSettings}</span>
            </button>
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 bg-theme-panel flex flex-col h-full overflow-hidden">
          {activeNav === 'workspaces' ? (
            <>
              {/* Top Header Bar: Search input & Action buttons (New / Open / Clone) */}
              <div className="h-14 px-6 border-b border-theme-border flex items-center justify-between gap-4 shrink-0 bg-theme-panel">
                {/* Search Box */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-theme-dim absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.welcome.searchWorkspacesPlaceholder}
                    className="w-full bg-theme-input border border-theme-border rounded-lg pl-9 pr-8 py-1.5 text-xs text-theme-main placeholder-theme-dim focus:outline-none focus:border-sky-500 transition shadow-2xs font-sans"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-dim hover:text-theme-main cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Top Action Buttons (IDEA 1:1) */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenLocalFolder}
                    disabled={isOpeningFolder}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-card hover:bg-theme-hover border border-theme-border rounded-lg text-xs font-semibold text-theme-main transition cursor-pointer shadow-2xs active:scale-[0.98]"
                    title={t.welcome.openFolderDesc}
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                    <span>{t.welcome.openFolderAsWorkspace}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenCloneModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-card hover:bg-theme-hover border border-theme-border rounded-lg text-xs font-semibold text-theme-main transition cursor-pointer shadow-2xs active:scale-[0.98]"
                    title={t.welcome.cloneRepoDesc}
                  >
                    <DownloadCloud className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t.welcome.cloneRepo}</span>
                  </button>

                  <button
                    type="button"
                    onClick={createNewWindow}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-card hover:bg-theme-hover border border-theme-border rounded-lg text-xs font-semibold text-theme-main transition cursor-pointer shadow-2xs active:scale-[0.98]"
                    title={t.topBar.windowActions.newWindowTooltip}
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                    <span>{t.topBar.windowActions.newWindow}</span>
                  </button>
                </div>
              </div>

              {/* Workspaces Aggregation List (Single-Select Only) */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {filteredWorkspaces.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-theme-dim py-16 gap-3">
                    <Layers className="w-12 h-12 text-theme-dim stroke-[1.2]" />
                    <div className="flex flex-col gap-1">
                      <p className="text-theme-muted font-semibold text-sm">
                        {searchQuery ? t.welcome.noWorkspacesFound : t.welcome.noWorkspacesEmpty}
                      </p>
                      <p className="text-xs text-theme-dim max-w-sm">
                        {searchQuery
                          ? t.welcome.noWorkspacesSearchDesc(searchQuery)
                          : t.welcome.noWorkspacesGuide}
                      </p>
                    </div>
                    {!searchQuery && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={handleOpenLocalFolder}
                          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 shadow-xs"
                        >
                          <FolderOpen className="w-4 h-4" />
                          <span>{t.welcome.openFolderBtn}</span>
                        </button>
                        <button
                          type="button"
                          onClick={createNewWindow}
                          className="px-4 py-2 bg-theme-card hover:bg-theme-hover border border-theme-border text-theme-main rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 shadow-xs"
                        >
                          <ExternalLink className="w-4 h-4 text-purple-400" />
                          <span>{t.welcome.newBlankWorkspaceBtn}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {filteredWorkspaces.map((ws) => {
                      const isSelected = selectedWorkspaceId === ws.id;
                      const initials = getWorkspaceInitials(ws.name);
                      const badgeClass = ws.badgeColor || getBadgeColor(ws.name);

                      return (
                        <div
                          key={ws.id}
                          onClick={() => setSelectedWorkspaceId(ws.id)}
                          onDoubleClick={() => handleDoubleClickWorkspace(ws)}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const useRight = window.innerWidth - rect.right > 380;
                            const left = useRight ? rect.right + 12 : Math.max(20, rect.left + 40);
                            const top = useRight
                              ? Math.min(window.innerHeight - 280, Math.max(60, rect.top - 10))
                              : rect.bottom + 6;

                            setHoveredWorkspace({
                              id: ws.id,
                              ws,
                              top,
                              left,
                            });
                          }}
                          onMouseLeave={() => setHoveredWorkspace(null)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setSelectedWorkspaceId(ws.id);
                            setContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              workspace: ws,
                            });
                          }}
                          className={`group relative flex flex-col p-3.5 rounded-xl border transition cursor-pointer select-none ${
                            isSelected
                              ? 'bg-sky-500/12 border-sky-500/60 shadow-xs'
                              : 'bg-theme-card/60 border-theme-border hover:border-sky-500/40 hover:bg-theme-hover'
                          }`}
                          title={t.welcome.cardClickTooltip(ws.name, ws.repos.length)}
                        >
                          {/* Row 1: Left Monogram + Name + Repo Pill Badge + Right Open Button */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Color Initials Badge */}
                              <div
                                className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs tracking-wider shrink-0 shadow-2xs ${badgeClass}`}
                              >
                                {initials}
                              </div>

                              {/* Workspace Name & Repos Count Badge */}
                              <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`font-bold text-sm truncate transition-colors ${
                                      isSelected
                                        ? 'text-sky-400'
                                        : 'text-theme-main group-hover:text-sky-400'
                                    }`}
                                  >
                                    {ws.name}
                                  </span>

                                  {/* Multi-Repo Pill Tag */}
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
                                    <FolderGit2 className="w-3 h-3" />
                                    <span>{t.welcome.workspaceCard.repoCount(ws.repos.length)}</span>
                                  </span>
                                </div>

                                <span className="text-[11px] text-theme-dim font-mono truncate leading-tight mt-0.5" title={ws.rootPath}>
                                  {ws.rootPath}
                                </span>
                              </div>
                            </div>

                            {/* Right Action Buttons: Delete & Open */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWorkspaceToDelete(ws);
                                }}
                                className="p-1.5 rounded-lg text-theme-dim hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition cursor-pointer"
                                title={t.welcome.workspaceCard.removeWorkspace}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openWorkspaceGroup(ws, false);
                                }}
                                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                                title={t.welcome.workspaceCard.openButton}
                              >
                                <span>{t.welcome.workspaceCard.openButton}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Row 2: Inline Chips Preview of Repos inside Workspace */}
                          <div className="mt-2.5 pt-2 border-t border-theme-border/40 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-theme-dim shrink-0">{t.welcome.workspaceCard.containsTitle}</span>
                            {ws.repos.slice(0, 5).map((repo) => (
                              <span
                                key={repo.path}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-theme-input text-[10px] font-mono text-theme-main border border-theme-border/60 hover:border-sky-500/50 transition shrink-0"
                                title={`${repo.name} (${repo.path})`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                <span className="truncate max-w-[140px] font-semibold">{repo.name}</span>
                                {repo.branch && (
                                  <span className="text-[9px] text-sky-400/90 font-mono">
                                    (⎇ {repo.branch})
                                  </span>
                                )}
                              </span>
                            ))}
                            {ws.repos.length > 5 && (
                              <span className="text-[10px] text-theme-dim px-1 font-mono">
                                {t.welcome.moreReposBadge(ws.repos.length - 5)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Customize Tab */
            <div className="flex-1 overflow-y-auto p-8 max-w-3xl space-y-6">
              <div>
                <h2 className="text-base font-bold text-theme-main">{t.welcome.customizeTitle}</h2>
                <p className="text-xs text-theme-dim mt-1">
                  {t.welcome.customizeDesc}
                </p>
              </div>

              {/* Section 0: Interface Language */}
              <div className="space-y-4 bg-theme-card p-4 rounded-xl border border-theme-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Languages className="w-4 h-4 text-sky-400" />
                    <span className="font-bold text-xs text-theme-main">{t.welcome.languageSettingTitle}</span>
                  </div>
                  <span className="text-[10px] text-theme-dim font-mono">i18n Dual Engine</span>
                </div>
                <p className="text-xs text-theme-dim">
                  {t.welcome.languageSettingDesc}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setLanguage('zh-CN')}
                    className={`p-3.5 rounded-lg border text-left flex flex-col gap-1 transition cursor-pointer ${
                      language === 'zh-CN'
                        ? 'border-sky-500 bg-sky-500/10 shadow-xs ring-1 ring-sky-500/30'
                        : 'border-theme-border hover:border-theme-border/80 bg-theme-input'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-theme-main flex items-center gap-1.5">
                        <span className="text-sm">🇨🇳</span>
                        <span>{t.settings.languageSection.zhTitle}</span>
                      </span>
                      {language === 'zh-CN' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                    </div>
                    <span className="text-[11px] text-theme-dim mt-0.5 leading-normal">
                      {t.settings.languageSection.zhDesc}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLanguage('en-US')}
                    className={`p-3.5 rounded-lg border text-left flex flex-col gap-1 transition cursor-pointer ${
                      language === 'en-US'
                        ? 'border-sky-500 bg-sky-500/10 shadow-xs ring-1 ring-sky-500/30'
                        : 'border-theme-border hover:border-theme-border/80 bg-theme-input'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-theme-main flex items-center gap-1.5">
                        <span className="text-sm">🇺🇸</span>
                        <span>{t.settings.languageSection.enTitle}</span>
                      </span>
                      {language === 'en-US' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                    </div>
                    <span className="text-[11px] text-theme-dim mt-0.5 leading-normal">
                      {t.settings.languageSection.enDesc}
                    </span>
                  </button>
                </div>
              </div>

              {/* Section 1: Color Themes (4 IntelliJ IDEA & Git Themes) */}
              <div className="space-y-4 bg-theme-card p-4 rounded-xl border border-theme-border">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-theme-main">{t.topBar.windowActions.theme}</span>
                  <span className="text-[10px] text-theme-dim font-mono">{t.themes.optionsCount(4)}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  {[
                    {
                      id: 'darcula' as AppTheme,
                      name: 'IDEA Darcula',
                      subtitle: t.themes.darculaDesc,
                      icon: Moon,
                      preview: 'bg-[#1e1f22] border-[#323438] text-[#e2e4e9]',
                      dots: ['#1e1f22', '#2b2d30', '#3574f0'],
                    },
                    {
                      id: 'idea-light' as AppTheme,
                      name: 'IDEA Light',
                      subtitle: t.themes.lightDesc,
                      icon: Sun,
                      preview: 'bg-[#f7f8fa] border-[#d5d8dc] text-[#1e2024]',
                      dots: ['#f7f8fa', '#ffffff', '#2f65ca'],
                    },
                    {
                      id: 'github-dark' as AppTheme,
                      name: 'GitHub Dark',
                      subtitle: t.themes.slateDesc,
                      icon: Terminal,
                      preview: 'bg-[#0d1117] border-[#30363d] text-[#e6edf3]',
                      dots: ['#0d1117', '#161b22', '#2f81f7'],
                    },
                    {
                      id: 'nord-frost' as AppTheme,
                      name: 'Nord Frost',
                      subtitle: t.themes.arcticDesc,
                      icon: Compass,
                      preview: 'bg-[#242933] border-[#434c5e] text-[#eceff4]',
                      dots: ['#242933', '#2e3440', '#88c0d0'],
                    },
                  ].map((item) => {
                    const isSelected =
                      theme === item.id ||
                      (item.id === 'idea-light' && (theme as any) === 'light');
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTheme(item.id)}
                        className={`p-3 rounded-lg border text-left flex flex-col justify-between gap-2.5 transition cursor-pointer ${
                          isSelected
                            ? 'border-sky-500 bg-sky-500/10 shadow-xs ring-1 ring-sky-500/30'
                            : 'border-theme-border hover:border-theme-border/80 bg-theme-input'
                        }`}
                      >
                        {/* Preview Block */}
                        <div
                          className={`h-9 rounded-md flex items-center justify-between px-2.5 font-bold text-xs ${item.preview} border shadow-2xs`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5" />
                            <span className="font-semibold text-[11px]">Aa</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {item.dots.map((c, i) => (
                              <span
                                key={i}
                                className="w-2 h-2 rounded-full border border-black/15 shrink-0"
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-theme-main truncate">
                              {item.name}
                            </span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            )}
                          </div>
                          <span className="text-[10px] text-theme-dim mt-0.5 truncate leading-tight">
                            {item.subtitle}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Application Cold Startup Behavior */}
              <div className="space-y-3 bg-theme-card p-4 rounded-xl border border-theme-border">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-theme-main">{t.welcome.startupSettingTitle}</span>
                  <span className="text-[10px] text-theme-dim font-mono">{t.settings.startupSection.badgeIdea}</span>
                </div>
                <p className="text-xs text-theme-dim">
                  {t.welcome.startupSettingDesc}
                </p>

                <div className="space-y-2 pt-1">
                  {/* Mode A: Reopen last project (Default) */}
                  <label
                    onClick={() => setStartupBehavior('reopen_last')}
                    className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition ${
                      startupBehavior === 'reopen_last'
                        ? 'bg-sky-500/10 border-sky-500/60'
                        : 'bg-theme-input border-theme-border hover:border-theme-border/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="startup_behavior_welcome"
                      checked={startupBehavior === 'reopen_last'}
                      onChange={() => setStartupBehavior('reopen_last')}
                      className="mt-0.5 text-sky-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-theme-main">
                        {t.welcome.startupReopenLast}
                      </span>
                      <span className="text-[11px] text-theme-dim mt-0.5">
                        {t.welcome.startupReopenLastDesc}
                      </span>
                    </div>
                  </label>

                  {/* Mode B: Show Welcome Screen to select */}
                  <label
                    onClick={() => setStartupBehavior('welcome_screen')}
                    className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition ${
                      startupBehavior === 'welcome_screen'
                        ? 'bg-sky-500/10 border-sky-500/60'
                        : 'bg-theme-input border-theme-border hover:border-theme-border/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="startup_behavior_welcome"
                      checked={startupBehavior === 'welcome_screen'}
                      onChange={() => setStartupBehavior('welcome_screen')}
                      className="mt-0.5 text-sky-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-theme-main">
                        {t.welcome.startupWelcomeScreen}
                      </span>
                      <span className="text-[11px] text-theme-dim mt-0.5">
                        {t.welcome.startupWelcomeScreenDesc}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Section 3: New Window Behavior */}
              <div className="space-y-3 bg-theme-card p-4 rounded-xl border border-theme-border">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-theme-main">{t.welcome.newWindowSettingTitle}</span>
                  <span className="text-[10px] text-theme-dim font-mono">{t.settings.newWindowSection.badgeMultiWindow}</span>
                </div>
                <p className="text-xs text-theme-dim">
                  {t.welcome.newWindowSettingDesc}
                </p>
                <div className="space-y-2 pt-1">
                  {/* Option A: Open Fresh Blank Workspace */}
                  <label
                    onClick={() => setNewWindowBehavior('empty')}
                    className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition ${
                      newWindowBehavior === 'empty'
                        ? 'bg-sky-500/10 border-sky-500/60'
                        : 'bg-theme-input border-theme-border hover:border-theme-border/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="new_window_behavior_welcome"
                      checked={newWindowBehavior === 'empty'}
                      onChange={() => setNewWindowBehavior('empty')}
                      className="mt-0.5 text-sky-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-theme-main">
                        {t.welcome.newWindowEmpty}
                      </span>
                      <span className="text-[11px] text-theme-dim mt-0.5">
                        {t.welcome.newWindowEmptyDesc}
                      </span>
                    </div>
                  </label>

                  {/* Option B: Open Welcome Screen in New Window */}
                  <label
                    onClick={() => setNewWindowBehavior('welcome')}
                    className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition ${
                      newWindowBehavior === 'welcome'
                        ? 'bg-sky-500/10 border-sky-500/60'
                        : 'bg-theme-input border-theme-border hover:border-theme-border/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="new_window_behavior_welcome"
                      checked={newWindowBehavior === 'welcome'}
                      onChange={() => setNewWindowBehavior('welcome')}
                      className="mt-0.5 text-sky-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-theme-main">
                        {t.welcome.newWindowWelcome}
                      </span>
                      <span className="text-[11px] text-theme-dim mt-0.5">
                        {t.welcome.newWindowWelcomeDesc}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Section 4: Open Full Settings */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-theme-dim">{t.welcome.advancedSettingsHint}</span>
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="px-4 py-2 bg-theme-hover hover:bg-theme-card border border-theme-border rounded-lg text-xs font-semibold text-theme-main transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Settings className="w-3.5 h-3.5 text-sky-400" />
                  <span>{t.welcome.openAdvancedSettings}</span>
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 3. Floating Hover Popover: Displays Git repositories inside hovered workspace */}
      {hoveredWorkspace && (
        <div
          className="fixed z-50 pointer-events-none w-96 bg-theme-panel border border-theme-border rounded-xl shadow-2xl p-3.5 text-xs text-theme-main animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
          style={{ top: `${hoveredWorkspace.top}px`, left: `${hoveredWorkspace.left}px` }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-theme-border">
            <div className="flex items-center gap-2 min-w-0">
              <FolderGit2 className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="font-bold text-xs text-theme-main truncate">
                {hoveredWorkspace.ws.name}
              </span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/25 shrink-0">
              {t.welcome.workspaceCard.repoCount(hoveredWorkspace.ws.repos.length)}
            </span>
          </div>

          {/* Repositories Detail List */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
            {hoveredWorkspace.ws.repos.map((repo) => (
              <div
                key={repo.path}
                className="flex flex-col gap-0.5 p-2 rounded-lg bg-theme-input/70 border border-theme-border/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                    <span className="font-bold text-xs text-theme-main truncate">
                      {repo.name}
                    </span>
                  </div>
                  {repo.branch && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-0.5 shrink-0">
                      <GitBranch className="w-2.5 h-2.5" />
                      <span>{repo.branch}</span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-theme-dim truncate mt-0.5">
                  {repo.path}
                </span>
              </div>
            ))}
          </div>

          {/* Footer Tip */}
          <div className="pt-2 mt-2 border-t border-theme-border/60 flex items-center justify-between text-[10px] text-theme-dim">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>{t.welcome.workspaceCard.openButton}</span>
            </span>
            <span className="font-mono text-sky-400">1-Click Multi-Repo</span>
          </div>
        </div>
      )}

      {/* 4. Context Menu for Right-click on workspace card */}
      {contextMenu && (() => {
        const menuWidth = 220;
        const menuHeight = 220;
        const clampedX = Math.max(10, Math.min(contextMenu.x, window.innerWidth - menuWidth - 10));
        const clampedY = Math.max(10, Math.min(contextMenu.y, window.innerHeight - menuHeight - 10));
        return (
          <div
            className="fixed z-50 theme-dropdown-panel rounded-lg py-1 shadow-2xl border border-theme-border-card text-xs text-theme-main font-sans min-w-[220px]"
            style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
          >
          <div className="px-3 py-1 text-[10px] font-semibold text-theme-dim border-b border-theme-border-subtle truncate max-w-[220px]">
            {contextMenu.workspace.name} ({t.welcome.workspaceCard.repoCount(contextMenu.workspace.repos.length)})
          </div>

          <button
            type="button"
            onClick={() => {
              openWorkspaceGroup(contextMenu.workspace, false);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-theme-hover text-theme-main text-xs transition cursor-pointer flex items-center gap-2"
          >
            <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
            <span>{t.welcome.openInThisWindow}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              openWorkspaceGroup(contextMenu.workspace, true);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-theme-hover text-theme-main text-xs transition cursor-pointer flex items-center gap-2"
          >
            <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
            <span>{t.welcome.openInNewWindow}</span>
          </button>

          <div className="h-[1px] bg-theme-border-subtle my-1" />

          <button
            type="button"
            onClick={() => {
              const newName = prompt(t.common.rename, contextMenu.workspace.name);
              if (newName && newName.trim()) {
                renameSavedWorkspace(contextMenu.workspace.id, newName.trim());
              }
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-theme-hover text-theme-muted hover:text-theme-main text-xs transition cursor-pointer flex items-center gap-2"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{t.common.rename}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.workspace.rootPath);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-theme-hover text-theme-muted hover:text-theme-main text-xs transition cursor-pointer flex items-center gap-2"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{t.sidebar.contextMenu.copyPath}</span>
          </button>

          <div className="h-[1px] bg-theme-border-subtle my-1" />

          <button
            type="button"
            onClick={() => {
              const target = contextMenu.workspace;
              setContextMenu(null);
              setWorkspaceToDelete(target);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-rose-500/10 text-rose-400 text-xs transition cursor-pointer flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.welcome.workspaceCard.removeWorkspace}</span>
          </button>
        </div>
      );
    })()}

      {/* 5. Confirm Deletion of Historical Workspace */}
      <ConfirmDialog
        isOpen={!!workspaceToDelete}
        title={t.welcome.workspaceCard.removeWorkspace}
        description={
          workspaceToDelete ? (
            <div className="space-y-1 text-xs">
              <p>
                {language === 'zh-CN'
                  ? `确定要从历史记录列表中移除工作空间“${workspaceToDelete.name}”吗？`
                  : `Are you sure you want to remove workspace "${workspaceToDelete.name}" from history?`}
              </p>
              <p className="text-theme-dim text-[11px]">
                {language === 'zh-CN'
                  ? '（此操作仅清理历史访问记录，绝不会删除本地磁盘上的任何项目或仓库代码）'
                  : '(This only cleans up your recent history record and will never delete any project files on disk)'}
              </p>
            </div>
          ) : null
        }
        variant="danger"
        icon="trash"
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        onCancel={() => setWorkspaceToDelete(null)}
        onConfirm={() => {
          if (workspaceToDelete) {
            removeSavedWorkspace(workspaceToDelete.id);
            setWorkspaceToDelete(null);
          }
        }}
      />
    </div>
  );
}
