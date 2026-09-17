import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../locales';
import { AddRepoModal } from './AddRepoModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FolderGit2, GitBranch, Plus, Settings, X, Layers, FolderOpen, Copy, RefreshCw, User } from 'lucide-react';

export function Sidebar() {
  const { t } = useTranslation();
  const {
    projects,
    activeProjectId,
    files,
    setActiveProject,
    isRepoLoading,
    isAddRepoModalOpen,
    setIsAddRepoModalOpen,
    removeProjectFromWorkspace,
    openProjectFolder,
    reorderProjects,
    getWorkspaceOpenFolder,
    workspaceId,
    gitUser,
    sidebarWidth,
    openWelcomeScreen,
    setIsSettingsModalOpen,
  } = useAppStore();

  const currentProject = projects.find((proj) => proj.id === activeProjectId);
  const [projectToRemove, setProjectToRemove] = useState<{ name: string; path: string } | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    project: { name: string; path: string; id: string };
  } | null>(null);

  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    if (contextMenu) {
      window.addEventListener('click', handleClose);
      window.addEventListener('contextmenu', handleClose);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  return (
    <aside
      style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px`, maxWidth: `${sidebarWidth}px` }}
      className="bg-theme-sidebar border-r border-theme-border flex flex-col h-full select-none text-xs shrink-0 transition-colors"
    >
      {/* Workspace Header */}
      <div className="h-9 px-3 border-b border-theme-border flex items-center justify-between font-medium tracking-wider text-theme-main bg-theme-sidebar">
        <div className="flex items-center gap-1.5 min-w-0">
          <FolderGit2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="font-bold text-[11px] text-theme-main truncate">
            {t.sidebar.title} ({projects.length})
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => openProjectFolder(getWorkspaceOpenFolder())}
            title={t.sidebar.contextMenu.showInExplorer}
            className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-sky-400 transition cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsAddRepoModalOpen(true)}
            title={t.sidebar.addRepository}
            className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-theme-main transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Repositories List in Current Workspace */}
      <div className="flex-1 overflow-y-auto py-1">
        {projects.length === 0 ? (
          <div className="p-4 text-center text-theme-dim text-[11px] flex flex-col items-center justify-center h-64 gap-3 select-none">
            <div className="p-3 rounded-xl bg-theme-hover text-theme-muted border border-theme-border">
              <Layers className="w-6 h-6 text-sky-400 stroke-[1.8]" />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-theme-main font-semibold text-xs">{t.sidebar.noRepositories}</p>
              <p className="text-theme-dim text-[10px] leading-relaxed">
                {t.sidebar.dropFolderHint}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 w-full px-1 pt-1">
              <button
                type="button"
                onClick={() => setIsAddRepoModalOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.sidebar.addRepository}</span>
              </button>
              <button
                type="button"
                onClick={() => openWelcomeScreen()}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-theme-hover hover:bg-theme-card border border-theme-border text-theme-main text-xs transition cursor-pointer"
              >
                <FolderGit2 className="w-3.5 h-3.5 text-sky-400" />
                <span>{t.welcome.recentWorkspaces}...</span>
              </button>
            </div>
          </div>
        ) : (
          projects.map((p, index) => {
            const isActive = p.id === activeProjectId;
            const incomingCount = isActive ? (currentProject?.incoming ?? p.incoming) : p.incoming;
            const outgoingCount = isActive ? (currentProject?.outgoing ?? p.outgoing) : p.outgoing;
            const changedCount = isActive ? files.length : 0;
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;

            return (
              <div
                key={p.id}
                draggable={true}
                onDragStart={(e) => {
                  setDraggedIndex(index);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', p.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverIndex !== index) {
                    setDragOverIndex(index);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverIndex === index) {
                    setDragOverIndex(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedIndex !== null && draggedIndex !== index) {
                    reorderProjects(draggedIndex, index);
                  }
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                onClick={() => {
                  if (p.id !== activeProjectId) {
                    setActiveProject(p.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    project: { name: p.name, path: p.path, id: p.id },
                  });
                }}
                className={`group mx-1.5 my-0.5 px-2.5 py-1.5 rounded-lg cursor-pointer flex flex-col gap-0.5 transition-all relative border ${
                  isDragging ? 'opacity-40 scale-[0.98]' : ''
                } ${
                  isDragOver && draggedIndex !== index ? 'border-t-2 border-t-sky-500 bg-sky-500/10' : ''
                } ${
                  isActive
                    ? 'bg-theme-active text-theme-active-text border-theme-border-active shadow-xs font-semibold'
                    : 'border-transparent hover:bg-theme-hover text-theme-muted'
                }`}
                title={`${p.name}\n${p.path}`}
              >
                <div className="flex items-center justify-between gap-1 text-[11px] font-medium min-w-0">
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <span className={`truncate ${isActive ? 'font-bold text-theme-active-text' : 'font-semibold text-theme-main'}`}>
                      {p.name}
                    </span>
                    {isActive && isRepoLoading && (
                      <RefreshCw className="w-2.5 h-2.5 text-sky-400 animate-spin shrink-0" />
                    )}
                  </div>
                  {/* Right Slot: Badges when not hovering; Action buttons when hovering (Zero overlap) */}
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    {/* Badges: visible normally, hidden on card hover */}
                    <div className="flex items-center gap-0.5 font-mono text-[10px] group-hover:hidden transition-all">
                      {incomingCount > 0 && (
                        <span
                          className="text-sky-400 font-bold bg-sky-500/15 px-1.5 py-0.2 rounded-full border border-sky-500/30"
                          title={t.sidebar.incomingTooltip(incomingCount)}
                        >
                          ↙{incomingCount}
                        </span>
                      )}
                      {changedCount > 0 && (
                        <span
                          className="text-amber-400 font-bold bg-amber-500/20 px-1.5 py-0.2 rounded-full border border-amber-500/40 flex items-center gap-0.5 shadow-2xs"
                          title={t.sidebar.uncommittedTooltip(changedCount)}
                        >
                          <span>✎</span>
                          <span>{changedCount}</span>
                        </span>
                      )}
                      {outgoingCount > 0 && (
                        <span
                          className="text-emerald-400 font-bold bg-emerald-500/15 px-1.5 py-0.2 rounded-full border border-emerald-500/30"
                          title={t.sidebar.outgoingTooltip(outgoingCount)}
                        >
                          ↗{outgoingCount}
                        </span>
                      )}
                    </div>

                    {/* Action buttons: hidden normally, revealed cleanly in-place on card hover */}
                    <div className="hidden group-hover:flex items-center gap-0.5 bg-theme-card px-1 py-0.5 rounded border border-theme-border-card shadow-xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openProjectFolder(p.path);
                        }}
                        title={t.sidebar.revealInExplorerTooltip(p.name, p.path)}
                        className="p-1 text-theme-dim hover:text-sky-400 hover:bg-theme-card-hover rounded transition cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToRemove({ name: p.name, path: p.path });
                        }}
                        title={t.sidebar.removeRepoTooltip}
                        className="p-1 text-theme-dim hover:text-rose-400 hover:bg-theme-card-hover rounded transition cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className={`flex items-center gap-1.5 text-[10px] ${isActive ? 'text-theme-active-dim font-medium' : 'text-theme-dim'}`}>
                  <GitBranch className="w-3 h-3 text-orange-400 shrink-0" />
                  <span className="truncate" title={`Branch: ${p.currentBranch}`}>{p.currentBranch}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Right-Click Context Menu */}
      {contextMenu && (() => {
        const menuWidth = 200;
        const menuHeight = 150;
        const clampedX = Math.max(10, Math.min(contextMenu.x, window.innerWidth - menuWidth - 10));
        const clampedY = Math.max(10, Math.min(contextMenu.y, window.innerHeight - menuHeight - 10));
        return (
          <div
            style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-50 bg-theme-panel border border-theme-border rounded-lg shadow-2xl py-1 min-w-[180px] text-xs select-none backdrop-blur-md"
          >
            <div className="px-3 py-1 text-[10px] text-theme-dim border-b border-theme-border font-mono truncate max-w-[220px]" title={contextMenu.project.name}>
              {contextMenu.project.name}
            </div>
          <button
            type="button"
            onClick={() => {
              openProjectFolder(contextMenu.project.path);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-theme-main hover:bg-theme-hover hover:text-sky-400 transition cursor-pointer text-left"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>{t.sidebar.contextMenu.showInExplorer}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(contextMenu.project.path);
                useAppStore.getState().setNotification({
                  id: Date.now(),
                  title: t.common.copied,
                  detail: contextMenu.project.path,
                  type: 'info',
                });
              }
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-theme-main hover:bg-theme-hover transition cursor-pointer text-left"
          >
            <Copy className="w-3.5 h-3.5 text-theme-dim" />
            <span>{t.sidebar.contextMenu.copyPath}</span>
          </button>
          <div className="h-px bg-theme-border my-1" />
          <button
            type="button"
            onClick={() => {
              const proj = contextMenu.project;
              setContextMenu(null);
              setProjectToRemove({ name: proj.name, path: proj.path });
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-rose-400 hover:bg-rose-500/10 transition cursor-pointer text-left"
          >
            <X className="w-3.5 h-3.5" />
            <span>{t.sidebar.contextMenu.remove}</span>
          </button>
        </div>
        );
      })()}

      {/* Footer: Workspace & Git Engine Info */}
      <div className="p-2 border-t border-theme-border flex items-center justify-between text-[10px] text-theme-dim bg-theme-sidebar">
        <div className="flex items-center gap-1.5 truncate">
          {gitUser?.name ? (
            <div
              className="flex items-center gap-1.5 truncate text-theme-main font-sans"
              title={`${gitUser.name}${gitUser.email ? ` <${gitUser.email}>` : ''}`}
            >
              <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white text-[9px] font-bold shrink-0 shadow-2xs">
                {gitUser.name.slice(0, 1).toUpperCase()}
              </div>
              <span className="truncate text-xs font-medium text-theme-main">
                {gitUser.name}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 truncate font-mono">
              <span className="px-1.5 py-0.2 rounded bg-theme-card text-sky-400 border border-theme-border-card">
                {workspaceId || 'default'}
              </span>
              <span className="truncate">OmniGit</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsSettingsModalOpen(true)}
          title={t.topBar.windowActions.systemSettingsTooltip}
          className="p-1 hover:text-sky-400 text-theme-dim hover:bg-theme-hover rounded transition cursor-pointer shrink-0"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mount AddRepoModal */}
      {isAddRepoModalOpen && <AddRepoModal onClose={() => setIsAddRepoModalOpen(false)} />}

      {/* Secondary Confirmation for Removing Project from Workspace (高危操作二次确认) */}
      <ConfirmDialog
        isOpen={!!projectToRemove}
        title={t.sidebar.contextMenu.remove}
        variant="warning"
        icon="alert"
        confirmText={t.common.confirm}
        cancelText={t.common.cancel}
        onCancel={() => setProjectToRemove(null)}
        onConfirm={() => {
          if (projectToRemove) {
            removeProjectFromWorkspace(projectToRemove.path);
            setProjectToRemove(null);
          }
        }}
        description={
          <div className="space-y-2 text-xs">
            <p>
              {projectToRemove ? t.sidebar.contextMenu.removeConfirm(projectToRemove.name) : ''}
            </p>
          </div>
        }
      />
    </aside>
  );
}
