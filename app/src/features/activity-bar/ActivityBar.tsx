import React from 'react';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { useTerminalStore } from '../terminal/useTerminalStore';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../locales';
import { useGlobalSearchStore } from '../global-search/useGlobalSearchStore';
import { useServicesStore } from '../services/useServicesStore';
import {
  GitCommit,
  Files,
  Terminal,
  Settings,
  Search,
  Server,
} from 'lucide-react';

export function ActivityBar() {
  const { workbenchMode, setWorkbenchMode } = useWorkbenchStore();
  const { isTerminalOpen, toggleTerminal } = useTerminalStore();
  const setIsSettingsModalOpen = useAppStore((state) => state.setIsSettingsModalOpen);
  const runningServicesCount = useServicesStore((state) => state.getRunningCount());
  const { t } = useTranslation();

  return (
    <div className="w-[42px] bg-theme-sidebar border-r border-theme-border flex flex-col items-center justify-between py-2 shrink-0 select-none z-20">
      {/* Top Modes */}
      <div className="flex flex-col items-center gap-2 w-full">
        {/* 1. Git Workbench Mode */}
        <button
          onClick={() => setWorkbenchMode('git')}
          className={`relative p-2 rounded-lg transition-colors cursor-pointer group ${
            workbenchMode === 'git'
              ? 'text-sky-400 bg-theme-hover shadow-sm'
              : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover/60'
          }`}
          title={t.activityBar.gitWorkbench}
        >
          {workbenchMode === 'git' && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-sky-500 rounded-r" />
          )}
          <GitCommit className="w-5 h-5 stroke-[1.8]" />
        </button>

        {/* 2. Workspace Explorer Mode */}
        <button
          onClick={() => setWorkbenchMode('explorer')}
          className={`relative p-2 rounded-lg transition-colors cursor-pointer group ${
            workbenchMode === 'explorer'
              ? 'text-sky-400 bg-theme-hover shadow-sm'
              : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover/60'
          }`}
          title={t.activityBar.workspaceExplorer}
        >
          {workbenchMode === 'explorer' && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-sky-500 rounded-r" />
          )}
          <Files className="w-5 h-5 stroke-[1.8]" />
        </button>

        {/* 3. Services / Launch Scripts Mode */}
        <button
          onClick={() => setWorkbenchMode('services')}
          className={`relative p-2 rounded-lg transition-colors cursor-pointer group ${
            workbenchMode === 'services'
              ? 'text-sky-400 bg-theme-hover shadow-sm'
              : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover/60'
          }`}
          title={t.activityBar.services}
        >
          {workbenchMode === 'services' && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-sky-500 rounded-r" />
          )}
          <Server className="w-5 h-5 stroke-[1.8]" />
          {runningServicesCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-theme-sidebar animate-pulse" />
          )}
        </button>

        {/* 4. Global Code Search (Find in Files) */}
        <button
          onClick={() => useGlobalSearchStore.getState().openSearchModal()}
          className="relative p-2 rounded-lg transition-colors cursor-pointer group text-theme-muted hover:text-theme-main hover:bg-theme-hover/60"
          title={t.activityBar.search}
        >
          <Search className="w-5 h-5 stroke-[1.8]" />
        </button>
      </div>

      {/* Bottom Tools */}
      <div className="flex flex-col items-center gap-2 w-full">
        {/* Terminal Toggle */}
        <button
          onClick={toggleTerminal}
          className={`relative p-2 rounded-lg transition-colors cursor-pointer ${
            isTerminalOpen
              ? 'text-sky-400 bg-theme-hover shadow-sm'
              : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover/60'
          }`}
          title={t.activityBar.terminal}
        >
          {isTerminalOpen && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-sky-500 rounded-r" />
          )}
          <Terminal className="w-5 h-5 stroke-[1.8]" />
        </button>

        {/* Settings */}
        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="p-2 rounded-lg text-theme-muted hover:text-theme-main hover:bg-theme-hover/60 transition-colors cursor-pointer"
          title={t.activityBar.settings}
        >
          <Settings className="w-5 h-5 stroke-[1.8]" />
        </button>
      </div>
    </div>
  );
}
