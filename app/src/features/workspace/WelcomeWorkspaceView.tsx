import React, { useState, useEffect, useRef } from 'react';
import { useAppStore, type WorkspaceGroupItem } from '../../store/useAppStore';
import { OmniGitLogo } from '../../components/ui/OmniGitLogo';
import { APP_VERSION_LABEL } from '../../constants/version';
import { useTranslation } from '../../locales';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { WelcomeCustomizeTab, WelcomeFloatingMenus } from './WelcomeCustomizeTab';
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
  X,
  Layers,
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
  const { t } = useTranslation();
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
    closeWelcomeScreen,
    projects,
  } = useAppStore();

  const [activeNav, setActiveNav] = useState<'workspaces' | 'customize'>('workspaces');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<WorkspaceGroupItem | null>(null);
  const [isOpeningFolder, setIsOpeningFolder] = useState(false);

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
  const isMac =
    (window as any).electronAPI?.platform === 'darwin' ||
    (typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac'));

  useEffect(() => {
    loadSavedWorkspaces();
    loadRecentProjects();

    let unsubscribeIpc: (() => void) | undefined;
    if (window.electronAPI?.onWorkspaceChanged) {
      unsubscribeIpc = window.electronAPI.onWorkspaceChanged(() => {
        loadSavedWorkspaces();
        loadRecentProjects();
      });
    }

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
        const input = prompt(t.welcome.openFolderModalPrompt, '');
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
      {/* 1. Frameless Window Titlebar */}
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

      {/* 2. Main Welcome Workbench Layout */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-theme-sidebar border-r border-theme-border flex flex-col justify-between p-4 shrink-0">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3 px-1 pt-1">
              <OmniGitLogo size={32} showText={false} />
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-base tracking-tight text-theme-main leading-tight">
                  Omni<span className="text-sky-400">Git</span>
                </span>
                <span className="text-[11px] text-theme-dim font-mono">
                  2026.1 / {APP_VERSION_LABEL}
                </span>
              </div>
            </div>

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

          <div className="flex flex-col gap-2 pt-4 border-t border-theme-border">
            {projects.length > 0 ? (
              <button
                type="button"
                onClick={closeWelcomeScreen}
                className="flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                <span>
                  {t.welcome.workspaceCard.openButton} ({projects.length})
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : savedWorkspaces.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  const target =
                    savedWorkspaces.find((w) => w.id === selectedWorkspaceId) || savedWorkspaces[0];
                  if (target) openWorkspaceGroup(target, false);
                }}
                className="flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                <span>{t.welcome.workspaceCard.openButton}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : null}

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
              <div className="h-14 px-6 border-b border-theme-border flex items-center justify-between gap-4 shrink-0 bg-theme-panel">
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
                          onClick={() => {
                            setSelectedWorkspaceId(ws.id);
                            openWorkspaceGroup(ws, false);
                          }}
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
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div
                                className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs tracking-wider shrink-0 shadow-2xs ${badgeClass}`}
                              >
                                {initials}
                              </div>

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

                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
                                    <FolderGit2 className="w-3 h-3" />
                                    <span>{t.welcome.workspaceCard.repoCount(ws.repos.length)}</span>
                                  </span>
                                </div>

                                <span
                                  className="text-[11px] text-theme-dim font-mono truncate leading-tight mt-0.5"
                                  title={ws.rootPath}
                                >
                                  {ws.rootPath}
                                </span>
                              </div>
                            </div>

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

                          <div className="mt-2.5 pt-2 border-t border-theme-border/40 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-theme-dim shrink-0">
                              {t.welcome.workspaceCard.containsTitle}
                            </span>
                            {ws.repos.slice(0, 5).map((repo) => (
                              <button
                                type="button"
                                key={repo.path}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openWorkspaceGroup(
                                    { ...ws, lastActiveProjectPath: repo.path },
                                    false
                                  );
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-theme-input text-[10px] font-mono text-theme-main border border-theme-border/60 hover:border-sky-500 hover:bg-sky-500/10 transition shrink-0 cursor-pointer text-left"
                                title={`${repo.name} (${repo.path})`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                <span className="truncate max-w-[140px] font-semibold">
                                  {repo.name}
                                </span>
                                {repo.branch && (
                                  <span className="text-[9px] text-sky-400/90 font-mono">
                                    (⎇ {repo.branch})
                                  </span>
                                )}
                              </button>
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
            <WelcomeCustomizeTab />
          )}
        </main>
      </div>

      <WelcomeFloatingMenus
        hoveredWorkspace={hoveredWorkspace}
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        setWorkspaceToDelete={setWorkspaceToDelete}
        openWorkspaceGroup={openWorkspaceGroup}
        renameSavedWorkspace={renameSavedWorkspace}
      />

      <ConfirmDialog
        isOpen={!!workspaceToDelete}
        title={t.welcome.workspaceCard.removeWorkspace}
        description={
          workspaceToDelete ? (
            <div className="space-y-1 text-xs">
              <p>{t.welcome.workspaceCard.removeConfirmMessage(workspaceToDelete.name)}</p>
              <p className="text-theme-dim text-[11px]">
                {t.welcome.workspaceCard.removeNoticeSafe}
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
