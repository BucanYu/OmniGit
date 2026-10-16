import React, { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useWorkspaceExplorerStore, normalizePath, buildDirKey } from './useWorkspaceExplorerStore';
import { FileTreeNode } from './FileTreeNode';
import { useEditorTabsStore } from '../code-editor/useEditorTabsStore';
import { useTranslation } from '../../locales';
import {
  FolderGit2,
  GitBranch,
  RefreshCw,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Layers,
  Plus,
  Crosshair,
} from 'lucide-react';

export function WorkspaceExplorerPanel() {
  const {
    projects,
    activeProjectId,
    setActiveProject,
    sidebarWidth,
    setIsAddRepoModalOpen,
    openProjectFolder,
  } = useAppStore();

  const {
    expandedDirs,
    dirChildren,
    toggleExpandDir,
    refreshDir,
    locateFile,
  } = useWorkspaceExplorerStore();

  const { tabs, activeTabId } = useEditorTabsStore();
  const { t } = useTranslation();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const hasActiveFile = Boolean(activeTab && activeTab.filePath);

  const handleLocateCurrentFile = async () => {
    if (!activeTab || !activeTab.filePath) return;

    const normActiveFile = normalizePath(activeTab.filePath).toLowerCase();

    // 1. Try to match project by activeTab.repoPath first
    let matchedProject = activeTab.repoPath
      ? projects.find((p) => normalizePath(p.path).toLowerCase() === normalizePath(activeTab.repoPath).toLowerCase())
      : undefined;

    // 2. If not matched, match projects by file path prefix (pick longest matching project path)
    if (!matchedProject) {
      const matchingProjects = projects.filter((p) => {
        const normP = normalizePath(p.path).toLowerCase();
        return normActiveFile === normP || normActiveFile.startsWith(normP + '/');
      });
      if (matchingProjects.length > 0) {
        matchingProjects.sort((a, b) => b.path.length - a.path.length);
        matchedProject = matchingProjects[0];
      }
    }

    if (!matchedProject) return;

    setActiveProject(matchedProject.id);

    // 3. Compute relative path strictly against matchedProject.path
    const normProjPath = normalizePath(matchedProject.path);
    const normFilePath = normalizePath(activeTab.filePath);
    let relPath = '';

    if (normFilePath.toLowerCase().startsWith(normProjPath.toLowerCase())) {
      relPath = normFilePath.slice(normProjPath.length).replace(/^\/+/, '');
    } else if (activeTab.relativePath) {
      relPath = activeTab.relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    }

    await locateFile(matchedProject.path, relPath, activeTab.filePath);
  };

  // Auto-expand the active project or first project on mount if not expanded
  useEffect(() => {
    if (projects.length > 0) {
      const activeP = projects.find((p) => p.id === activeProjectId) || projects[0];
      const rootKey = buildDirKey(activeP.path, '');
      if (!expandedDirs.has(rootKey)) {
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
            {t.workspaceExplorer.title(projects.length)}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {/* Locate Opened File (Scroll from Source) */}
          <button
            onClick={handleLocateCurrentFile}
            disabled={!hasActiveFile}
            title={hasActiveFile ? t.workspaceExplorer.locateCurrentFile : t.workspaceExplorer.locateNoActiveFile}
            className={`p-1 rounded transition cursor-pointer ${
              hasActiveFile
                ? 'hover:bg-theme-hover text-theme-muted hover:text-sky-400'
                : 'text-theme-muted/30 cursor-not-allowed'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRefreshAll}
            title={t.workspaceExplorer.refreshTree}
            className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-sky-400 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsAddRepoModalOpen(true)}
            title={t.workspaceExplorer.addRepo}
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
            <p className="text-theme-main font-semibold text-xs">{t.workspaceExplorer.emptyTitle}</p>
            <p className="text-theme-dim text-[10px] leading-relaxed">
              {t.workspaceExplorer.emptyDesc}
            </p>
          </div>
        ) : (
          projects.map((project) => {
            const rootKey = buildDirKey(project.path, '');
            const isExpanded = expandedDirs.has(rootKey);
            const rootChildren = dirChildren[rootKey] || [];
            const isActive = project.id === activeProjectId;

            return (
              <div key={project.id} className="mb-1">
                {/* Project Root Row */}
                <div
                  onClick={() => {
                    setActiveProject(project.id);
                    toggleExpandDir(project.path, '');
                  }}
                  className={`group flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-theme-hover font-semibold text-[11px] select-none transition-colors ${
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

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Hover Action: Open folder in system file manager (consistent with Git module, strictly NO 'x' delete button) */}
                    <div className="hidden group-hover:flex items-center bg-theme-app/90 px-1 py-0.5 rounded border border-theme-border shadow-xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openProjectFolder(project.path);
                        }}
                        title={t.workspaceExplorer.openInSystemExplorer(project.path)}
                        className="p-1 text-theme-muted hover:text-sky-400 hover:bg-theme-hover rounded transition cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                      </button>
                    </div>

                    {/* Branch Pill */}
                    {project.currentBranch && (
                      <div className="flex items-center gap-0.5 text-[10px] font-normal text-theme-muted bg-theme-app/60 px-1.5 py-0.5 rounded border border-theme-border/60 shrink-0">
                        <GitBranch className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                        <span className="truncate max-w-[80px]">{project.currentBranch}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Project Tree Children */}
                {isExpanded && (
                  <div>
                    {rootChildren.length === 0 ? (
                      <div className="pl-6 py-1 text-theme-muted text-[11px] italic">
                        {t.workspaceExplorer.emptyDirOrLoading}
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
