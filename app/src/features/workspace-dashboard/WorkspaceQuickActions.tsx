import React from 'react';
import {
  GitCommit,
  Files,
  Server,
  Terminal,
  ChevronRight,
} from 'lucide-react';
import { useTranslation } from '../../locales';

interface WorkspaceQuickActionsProps {
  totalUncommitted: number;
  runningServicesCount: number;
  onNavigateGit: () => void;
  onNavigateExplorer: () => void;
  onNavigateServices: () => void;
  onToggleTerminal: () => void;
}

export const WorkspaceQuickActions: React.FC<WorkspaceQuickActionsProps> = ({
  totalUncommitted,
  runningServicesCount,
  onNavigateGit,
  onNavigateExplorer,
  onNavigateServices,
  onToggleTerminal,
}) => {
  const { t } = useTranslation();

  const actions = [
    {
      id: 'git',
      title: 'Git 提交工作台',
      shortcut: 'Alt + 1',
      subtitle: t.dashboard.defaultHub.quickActionGitSubtitle(totalUncommitted),
      icon: GitCommit,
      iconContainerBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 group-hover:bg-sky-500/20',
      hoverBorder: 'hover:border-sky-500/50 hover:shadow-sky-500/5',
      onClick: onNavigateGit,
    },
    {
      id: 'explorer',
      title: '源码资源管理器',
      shortcut: 'Alt + 2',
      subtitle: t.dashboard.defaultHub.quickActionExplorerSubtitle,
      icon: Files,
      iconContainerBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/20',
      hoverBorder: 'hover:border-emerald-500/50 hover:shadow-emerald-500/5',
      onClick: onNavigateExplorer,
    },
    {
      id: 'services',
      title: '启动脚本与服务',
      shortcut: 'Alt + 3',
      subtitle: t.dashboard.defaultHub.quickActionServicesSubtitle(runningServicesCount),
      icon: Server,
      iconContainerBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 group-hover:bg-purple-500/20',
      hoverBorder: 'hover:border-purple-500/50 hover:shadow-purple-500/5',
      onClick: onNavigateServices,
    },
    {
      id: 'terminal',
      title: '内置系统终端',
      shortcut: 'Ctrl + `',
      subtitle: t.dashboard.defaultHub.quickActionTerminalSubtitle,
      icon: Terminal,
      iconContainerBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:bg-amber-500/20',
      hoverBorder: 'hover:border-amber-500/50 hover:shadow-amber-500/5',
      onClick: onToggleTerminal,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-theme-muted">
          {t.dashboard.defaultHub.quickActions}
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.id}
              type="button"
              onClick={act.onClick}
              className={`p-3.5 rounded-xl border border-theme-border/70 bg-theme-card/90 dark:bg-theme-card/80 ${act.hoverBorder} hover:shadow-sm transition-all text-left group cursor-pointer flex items-center justify-between gap-3 shadow-2xs select-none`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className={`p-2.5 rounded-xl shrink-0 transition-colors ${act.iconContainerBg}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-theme-main truncate leading-tight">
                    {act.title}
                  </div>
                  <div className="text-[11px] text-theme-muted mt-1 leading-tight truncate">
                    {act.subtitle}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-theme-hover/60 border border-theme-border/60 text-theme-muted group-hover:text-theme-main group-hover:border-theme-border transition-colors">
                  {act.shortcut}
                </kbd>
                <ChevronRight className="w-3.5 h-3.5 text-theme-dim group-hover:text-theme-main group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
