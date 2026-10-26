import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { GitProject } from '../../store/types';
import { useTranslation } from '../../locales';
import {
  FolderGit2,
  ChevronDown,
  Check,
  Search,
  Server,
} from 'lucide-react';

interface ServicesProjectSelectorProps {
  currentProject: GitProject;
  projects: GitProject[];
  onSelectProject: (projectId: string) => void;
  getProjectRunningCount: (projectId: string, projectPath: string) => number;
}

export const ServicesProjectSelector: React.FC<ServicesProjectSelectorProps> = ({
  currentProject,
  projects,
  onSelectProject,
  getProjectRunningCount,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && projects.length >= 6) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, projects.length]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase().trim();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.path.toLowerCase().includes(q) ||
        (p.currentBranch && p.currentBranch.toLowerCase().includes(q))
    );
  }, [projects, searchQuery]);

  // Single project in workspace: display plain label
  if (projects.length <= 1) {
    return (
      <div
        className="flex items-center gap-1.5 text-[10px] text-theme-muted truncate mt-0.5"
        title={`${currentProject.name}\n${currentProject.path}`}
      >
        <FolderGit2 className="w-3 h-3 text-theme-dim shrink-0" />
        <span className="truncate max-w-[150px]">{currentProject.name}</span>
      </div>
    );
  }

  return (
    <div className="relative mt-0.5" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        data-testid="services-project-dropdown-btn"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group flex items-center gap-1.5 max-w-full text-left py-0.5 px-1.5 -ml-1.5 rounded-md hover:bg-theme-hover/80 text-theme-muted hover:text-theme-main transition-colors cursor-pointer border border-transparent hover:border-theme-border/60"
        title={t.services.switchProjectTooltip}
      >
        <FolderGit2 className="w-3 h-3 text-theme-dim group-hover:text-sky-500 shrink-0 transition-colors" />
        <span className="text-[11px] font-medium text-theme-main truncate max-w-[130px] sm:max-w-[160px]">
          {currentProject.name}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-theme-dim group-hover:text-theme-main transition-transform duration-150 shrink-0 ${
            isOpen ? 'rotate-180 text-sky-500' : ''
          }`}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          data-testid="services-project-dropdown-menu"
          className="absolute left-0 top-full mt-1.5 w-72 max-w-[90vw] bg-theme-panel border border-theme-border rounded-xl shadow-2xl z-50 overflow-hidden text-xs py-1 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="px-3 py-1.5 text-[10px] font-semibold text-theme-dim uppercase tracking-wider border-b border-theme-border/50 flex items-center justify-between bg-theme-header/50">
            <span>{t.services.projectSelectorTitle}</span>
            <span className="text-theme-muted font-mono">{t.topBar.projectSelector.repoCount(projects.length)}</span>
          </div>

          {/* Quick Filter (if >= 6 projects) */}
          {projects.length >= 6 && (
            <div className="p-2 border-b border-theme-border/50 bg-theme-sidebar/40">
              <div className="relative flex items-center">
                <Search className="w-3 h-3 text-theme-muted absolute left-2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.services.searchProjectsPlaceholder}
                  className="w-full bg-theme-input text-theme-main text-[11px] pl-7 pr-2 py-1 rounded-md border border-theme-border focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Project List */}
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredProjects.length === 0 ? (
              <div className="px-3 py-4 text-center text-theme-muted text-[11px]">
                {t.topBar.projectSelector.noProjects}
              </div>
            ) : (
              filteredProjects.map((p) => {
                const isSelected = p.id === currentProject.id;
                const pRunningCount = getProjectRunningCount(p.id, p.path);
                return (
                  <button
                    key={p.id}
                    data-testid={`services-project-item-${p.name}`}
                    type="button"
                    onClick={() => {
                      onSelectProject(p.id);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors cursor-pointer border-l-2 ${
                      isSelected
                        ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500 font-medium'
                        : 'border-transparent text-theme-muted hover:text-theme-main hover:bg-theme-hover'
                    }`}
                    title={`${p.name}\n${p.path}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FolderGit2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-sky-500' : 'text-theme-dim'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs truncate font-medium ${
                              isSelected ? 'text-theme-main font-semibold' : 'text-theme-main/90'
                            }`}
                          >
                            {p.name}
                          </span>
                          {p.currentBranch && (
                            <span className="text-[10px] text-theme-dim truncate max-w-[80px]">
                              ({p.currentBranch})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-theme-dim truncate font-mono opacity-75">
                          {p.path}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {pRunningCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>{t.services.runningServicesCount(pRunningCount)}</span>
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
