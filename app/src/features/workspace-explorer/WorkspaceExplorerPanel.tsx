import React, { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useWorkspaceExplorerStore } from './useWorkspaceExplorerStore';
import { FileTreeNode } from './FileTreeNode';
import {
  FolderGit2,
  GitBranch,
  RefreshCw,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Layers,
  Plus,
} from 'lucide-react';

export function WorkspaceExplorerPanel() {
  const {
    projects,
    activeProjectId,
    setActiveProject,
    sidebarWidth,
    setIsAddRepoModalOpen,
  } = useAppStore();

  const {
    expandedDirs,
    dirChildren,
    toggleExpandDir,
    refreshDir,
  } = useWorkspaceExplorerStore();

  // Auto-expand the active project or first project on mount if not expanded
  useEffect(() => {
    if (projects.length > 0) {
      const activeP = projects.find((p) => p.id === activeProjectId) || projects[0];
      const normPath = activeP.path.replace(/\\/g, '/');
      if (!expandedDirs.has(normPath)) {
        toggleExpandDir(activeP.path, '');
      }
    }
  }, [projects, activeProjectId]);

  const handleRefreshAll = () => {
    for (const p of projects) {
      refreshDir(p.path, '');
    }
  };

  return (
    <aside
      style={{
        width: `${sidebarWidth}px`,
        minWidth: `${sidebarWidth}px`,
        maxWidth: `${sidebarWidth}px`,
      }}
      className="bg-theme-sidebar border-r border-theme-border flex flex-col h-full select-none text-xs shrink-0 transition-colors"
    >
      {/* Explorer Header */}
      <div className="h-9 px-3 border-b border-theme-border flex items-center justify-between font-medium tracking-wider text-theme-main bg-theme-sidebar">
        <div className="flex items-center gap-1.5 min-w-0">
          <FolderGit2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="font-bold text-[11px] text-theme-main uppercase tracking-wider truncate">
            资源管理器 ({projects.length})
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleRefreshAll}
            title="刷新文件树"
            className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-sky-400 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsAddRepoModalOpen(true)}
            title="添加项目到工作区"
            className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-theme-main transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Projects Multi-Root Trees */}
      <div className="flex-1 overflow-y-auto py-1">
        {projects.length === 0 ? (
          <div className="p-4 text-center text-theme-dim text-[11px] flex flex-col items-center justify-center h-64 gap-3 select-none">
            <div className="p-3 rounded-xl bg-theme-hover text-theme-muted border border-theme-border">
              <Layers className="w-6 h-6 text-sky-400 stroke-[1.8]" />
            </div>
            <p className="text-theme-main font-semibold text-xs">工作区暂无项目</p>
            <p className="text-theme-dim text-[10px] leading-relaxed">
              请点击右上角加号添加本地代码仓库
            </p>
          </div>
        ) : (
          projects.map((project) => {
            const normPath = project.path.replace(/\\/g, '/');
            const isExpanded = expandedDirs.has(normPath);
            const rootChildren = dirChildren[normPath] || [];
            const isActive = project.id === activeProjectId;

            return (
              <div key={project.id} className="mb-1">
                {/* Project Root Row */}
                <div
                  onClick={() => {
                    setActiveProject(project.id);
                    toggleExpandDir(project.path, '');
                  }}
                  className={`flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-theme-hover font-semibold text-[11px] select-none transition-colors ${
                    isActive ? 'text-sky-400 bg-theme-hover/50' : 'text-theme-main'
                  }`}
                  title={`${project.name} (${project.path})`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-theme-muted">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <FolderOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="truncate font-bold tracking-tight text-[12px]">{project.name}</span>
                  </div>

                  {/* Branch Pill */}
                  {project.currentBranch && (
                    <div className="flex items-center gap-0.5 text-[10px] font-normal text-theme-muted bg-theme-app/60 px-1.5 py-0.5 rounded border border-theme-border/60 shrink-0">
                      <GitBranch className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                      <span className="truncate max-w-[80px]">{project.currentBranch}</span>
                    </div>
                  )}
                </div>

                {/* Project Tree Children */}
                {isExpanded && (
                  <div>
                    {rootChildren.length === 0 ? (
                      <div className="pl-6 py-1 text-theme-muted text-[11px] italic">
                        (空目录或加载中...)
                      </div>
                    ) : (
                      rootChildren.map((child) => (
                        <FileTreeNode
                          key={child.path}
                          item={child}
                          repoPath={project.path}
                          repoName={project.name}
                          depth={1}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
