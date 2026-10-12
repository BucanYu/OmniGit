import React, { useState, useRef, useEffect } from 'react';
import { useTerminalStore } from './useTerminalStore';
import { useAppStore } from '../../store/useAppStore';
import {
  Terminal as TerminalIcon,
  Plus,
  ChevronDown,
  X,
  Maximize2,
  Minimize2,
  Trash2,
  FolderGit2,
  ChevronRight,
} from 'lucide-react';

export function TerminalTabs() {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    closeSession,
    createSession,
    toggleTerminal,
    isMaximized,
    toggleMaximized,
    availableShells,
    loadAvailableShells,
  } = useTerminalStore();

  const projects = useAppStore((state) => state.projects);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const activeProject = projects.find((p) => p.id === activeProjectId);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAvailableShells();
  }, [loadAvailableShells]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

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
          return (
            <div
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-t text-xs cursor-pointer border-b-2 transition-colors ${
                isActive
                  ? 'border-sky-500 bg-theme-hover text-theme-main font-medium'
                  : 'border-transparent text-theme-muted hover:text-theme-main hover:bg-theme-hover/50'
              }`}
              title={`${session.name} - ${session.cwd}`}
            >
              <TerminalIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate max-w-[150px]">{session.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeSession(session.id);
                }}
                className="p-0.5 hover:bg-theme-main/10 rounded text-theme-muted hover:text-red-400"
                title="关闭终端"
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
            className="px-1.5 py-1 text-theme-main hover:text-sky-400 transition"
            title="新建终端 (当前项目)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="px-1 py-1 text-theme-muted hover:text-theme-main border-l border-theme-border transition"
            title="选择工程或 Shell 新建终端"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute right-0 top-8 w-64 bg-theme-app border border-theme-border rounded shadow-xl py-1 z-50 text-xs">
            {/* 1. Default current project */}
            <div
              onClick={() => {
                createSession();
                setIsMenuOpen(false);
              }}
              className="px-3 py-1.5 hover:bg-theme-hover cursor-pointer flex items-center gap-2 text-theme-main"
            >
              <Plus className="w-3.5 h-3.5 text-sky-400" />
              <span>新建终端 (默认: {activeProject?.name || '工作区'})</span>
            </div>

            {/* 2. Workspace projects */}
            {projects.length > 0 && (
              <>
                <div className="border-t border-theme-border my-1" />
                <div className="px-3 py-1 text-[10px] text-theme-muted font-bold tracking-wider">
                  在工作区项目中打开:
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
                      <span className="text-[10px] text-sky-400 font-semibold shrink-0">活跃</span>
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
                  选择 Shell 类型:
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

        {/* Maximize / Restore Toggle */}
        <button
          onClick={toggleMaximized}
          className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-theme-main transition cursor-pointer"
          title={isMaximized ? '还原终端视窗' : '最大化终端视窗'}
        >
          {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        {/* Close Dock */}
        <button
          onClick={toggleTerminal}
          className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-theme-main transition cursor-pointer"
          title="折叠终端面板 (Ctrl + `)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
