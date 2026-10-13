import React, { useState, useRef, useEffect } from 'react';
import { useTerminalStore, type TerminalSession } from './useTerminalStore';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../locales';
import {
  Terminal as TerminalIcon,
  Plus,
  ChevronDown,
  ChevronUp,
  Minus,
  X,
  Trash2,
  FolderGit2,
  Edit3,
  Copy,
} from 'lucide-react';

export function TerminalTabs() {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    closeSession,
    createSession,
    renameSession,
    toggleTerminal,
    isMaximized,
    toggleMaximized,
    availableShells,
    loadAvailableShells,
  } = useTerminalStore();

  const { t } = useTranslation();
  const projects = useAppStore((state) => state.projects);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const activeProject = projects.find((p) => p.id === activeProjectId);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Tab right click context menu & inline renaming
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    sessionId: string;
    sessionName: string;
  } | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  useEffect(() => {
    loadAvailableShells();
  }, [loadAvailableShells]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
      setContextMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleTabContextMenu = (e: React.MouseEvent, session: TerminalSession) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      sessionId: session.id,
      sessionName: session.name,
    });
  };

  const handleFinishRename = (sessionId: string) => {
    if (renameValue.trim()) {
      renameSession(sessionId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleCreateInProject = (project: { id: string; name: string; path: string }, shellPath?: string) => {
    createSession({
      projectId: project.id,
      projectName: project.name,
      cwd: project.path,
      shell: shellPath,
    });
    setIsMenuOpen(false);
  };

  const handleCreateWithShell = (shell: { path: string }) => {
    createSession({
      shell: shell.path,
    });
    setIsMenuOpen(false);
  };

  return (
    <div className="h-8 bg-theme-sidebar border-b border-theme-border flex items-center justify-between px-2 select-none text-xs">
      {/* Left: Tab Sessions */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[70%]">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const isRenaming = renamingId === session.id;

          return (
            <div
              key={session.id}
              data-testid="terminal-tab"
              onClick={() => setActiveSessionId(session.id)}
              onContextMenu={(e) => handleTabContextMenu(e, session)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-t text-xs cursor-pointer border-b-2 transition-colors ${
                isActive
                  ? 'border-sky-500 bg-theme-hover text-theme-main font-medium shadow-xs'
                  : 'border-transparent text-theme-muted hover:text-theme-main hover:bg-theme-hover/50'
              }`}
              title={`${session.name} - ${session.cwd}`}
            >
              <TerminalIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />

              {isRenaming ? (
                <input
                  data-testid="terminal-rename-input"
                  type="text"
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleFinishRename(session.id);
                    } else if (e.key === 'Escape') {
                      setRenamingId(null);
                    }
                  }}
                  onBlur={() => handleFinishRename(session.id)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder={t.terminal.renamePromptPlaceholder}
                  className="bg-theme-app border border-sky-500 rounded px-1.5 py-0 text-xs text-theme-main focus:outline-none w-28"
                />
              ) : (
                <span
                  className="truncate max-w-[150px]"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(session.id);
                    setRenameValue(session.name);
                  }}
                >
                  {session.name}
                </span>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeSession(session.id);
                }}
                className="p-0.5 hover:bg-theme-main/10 rounded text-theme-muted hover:text-red-400 cursor-pointer"
                title={t.terminal.closeTerminal}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Right Controls: New, Split, Maximize, Close */}
      <div className="flex items-center gap-1 shrink-0 relative" ref={menuRef}>
        {/* + Button with Dropdown */}
        <div className="flex items-center bg-theme-hover/80 hover:bg-theme-hover rounded border border-theme-border">
          <button
            onClick={() => createSession()}
            className="px-1.5 py-1 text-theme-main hover:text-sky-400 transition cursor-pointer"
            title={t.terminal.newTerminalTooltip}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            data-testid="terminal-dropdown-trigger"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="px-1 py-1 text-theme-muted hover:text-theme-main border-l border-theme-border transition cursor-pointer"
            title={t.terminal.selectShellTooltip}
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Dropdown Menu: Opens upward when docked at bottom, downward when maximized */}
        {isMenuOpen && (
          <div
            data-testid="terminal-dropdown-menu"
            className={`absolute right-0 ${
              isMaximized ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
            } w-72 bg-theme-card theme-dropdown-panel border border-theme-border rounded-lg shadow-2xl py-1.5 z-50 text-xs max-h-[min(380px,70vh)] overflow-y-auto`}
          >
            {/* 1. Default current project */}
            <div
              onClick={() => {
                createSession();
                setIsMenuOpen(false);
              }}
              className="px-3 py-1.5 hover:bg-theme-hover cursor-pointer flex items-center gap-2 text-theme-main"
            >
              <Plus className="w-3.5 h-3.5 text-sky-400" />
              <span>{t.terminal.newTerminalDefault(activeProject?.name || '工作区')}</span>
            </div>

            {/* 2. Workspace projects */}
            {projects.length > 0 && (
              <>
                <div className="border-t border-theme-border my-1" />
                <div className="px-3 py-1 text-[10px] text-theme-muted font-bold tracking-wider">
                  {t.terminal.openInProjectHeader}
                </div>
                {projects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleCreateInProject(p)}
                    className="px-3 py-1.5 hover:bg-theme-hover cursor-pointer flex items-center justify-between text-theme-main"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FolderGit2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="truncate">{p.name}</span>
                    </div>
                    {p.id === activeProjectId && (
                      <span className="text-[10px] text-sky-400 font-semibold shrink-0">
                        {t.terminal.activeBadge}
                      </span>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* 3. Available Shells */}
            {availableShells.length > 0 && (
              <>
                <div className="border-t border-theme-border my-1" />
                <div className="px-3 py-1 text-[10px] text-theme-muted font-bold tracking-wider">
                  {t.terminal.selectShellHeader}
                </div>
                {availableShells.map((sh) => (
                  <div
                    key={sh.id}
                    onClick={() => handleCreateWithShell(sh)}
                    className="px-3 py-1.5 hover:bg-theme-hover cursor-pointer flex items-center gap-2 text-theme-main"
                  >
                    <TerminalIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{sh.name}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Separator */}
        {activeSessionId && (
          <div className="h-3.5 w-[1px] bg-theme-border/60 mx-0.5" />
        )}

        {/* Kill Terminal (VS Code standard: Trash Can icon to kill active session) */}
        {activeSessionId && (
          <button
            data-testid="terminal-kill-btn"
            onClick={() => closeSession(activeSessionId)}
            className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-rose-400 transition cursor-pointer"
            title={t.terminal.killTerminalTooltip}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Maximize / Restore Toggle (VS Code standard: ChevronUp / ChevronDown) */}
        <button
          data-testid="terminal-maximize-btn"
          onClick={toggleMaximized}
          className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-theme-main transition cursor-pointer"
          title={isMaximized ? t.terminal.restoreWindowTooltip : t.terminal.maximizeWindowTooltip}
        >
          {isMaximized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>

        {/* Collapse Dock (User requested: "-" icon instead of "❌") */}
        <button
          data-testid="terminal-collapse-btn"
          onClick={toggleTerminal}
          className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-theme-main transition cursor-pointer"
          title={t.terminal.collapseDockTooltip}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab Right Click Context Menu */}
      {contextMenu && (
        <div
          style={{
            top: `${Math.min(contextMenu.y, window.innerHeight - 150)}px`,
            left: `${Math.min(contextMenu.x, window.innerWidth - 180)}px`,
          }}
          className="fixed bg-theme-card theme-dropdown-panel border border-theme-border rounded-lg shadow-2xl py-1 z-50 text-xs w-44 text-theme-main select-none"
        >
          <div
            onClick={() => {
              setRenamingId(contextMenu.sessionId);
              setRenameValue(contextMenu.sessionName);
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-theme-hover cursor-pointer flex items-center gap-2"
          >
            <Edit3 className="w-3.5 h-3.5 text-sky-400" />
            <span>{t.terminal.renameTerminal}</span>
          </div>
          <div
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.sessionName);
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-theme-hover cursor-pointer flex items-center gap-2"
          >
            <Copy className="w-3.5 h-3.5 text-theme-muted" />
            <span>{t.terminal.copyTerminalName}</span>
          </div>
          <div className="border-t border-theme-border my-1" />
          <div
            onClick={() => {
              closeSession(contextMenu.sessionId);
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-theme-hover cursor-pointer flex items-center gap-2 text-rose-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.terminal.closeTerminal}</span>
          </div>
        </div>
      )}
    </div>
  );
}
