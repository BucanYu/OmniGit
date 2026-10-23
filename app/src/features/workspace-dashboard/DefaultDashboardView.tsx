import React, { useState } from 'react';
import {
  GitBranch,
  GitCommit,
  Files,
  Server,
  Terminal,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Settings,
  RotateCw,
  FolderGit2,
  ChevronRight,
  Globe,
  FileCode,
  BookOpen,
  Kanban,
} from 'lucide-react';
import { useTranslation } from '../../locales';
import { useAppStore } from '../../store/useAppStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { useTerminalStore } from '../terminal/useTerminalStore';
import { useDashboardStore } from './useDashboardStore';
import { useServicesStore } from '../services/useServicesStore';

export function DefaultDashboardView() {
  const { t } = useTranslation();
  const {
    workspaceId,
    savedWorkspaces,
    projects,
    setActiveProject,
    pollWorkspaceSyncStatus,
  } = useAppStore();

  const { setWorkbenchMode } = useWorkbenchStore();
  const { toggleTerminal } = useTerminalStore();
  const { openConfigModal } = useDashboardStore();
  const runningServicesCount = useServicesStore((state) => state.getRunningCount());

  const [isSyncing, setIsSyncing] = useState(false);

  const currentWs = savedWorkspaces.find((w) => w.id === workspaceId);
  const workspaceName = currentWs?.name || 'Workspace';
  const rootPath = currentWs?.rootPath || '';

  // 计算全局聚合指标
  const totalRepos = projects.length;
  const totalUncommitted = projects.reduce((acc, p) => acc + (p.uncommittedCount || 0), 0);
  const totalIncoming = projects.reduce((acc, p) => acc + (p.incoming || 0), 0);
  const totalOutgoing = projects.reduce((acc, p) => acc + (p.outgoing || 0), 0);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      await pollWorkspaceSyncStatus?.();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleJumpToRepoCommit = (repoId: string) => {
    setActiveProject(repoId);
    setWorkbenchMode('git');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-theme-bg overflow-y-auto select-none p-6 space-y-6">
      {/* 1. Header Hero Card */}
      <div className="p-6 rounded-xl border border-theme-border bg-gradient-to-br from-theme-sidebar/80 via-theme-bg to-theme-sidebar/40 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <FolderGit2 className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-lg font-bold text-theme-main tracking-tight">{workspaceName}</h1>
                <p className="text-xs text-theme-muted font-mono truncate max-w-xl mt-0.5">{rootPath}</p>
              </div>
            </div>

            {/* Metrics Capsule Badges */}
            <div className="flex flex-wrap items-center gap-2.5 mt-4 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-theme-hover/60 border border-theme-border text-theme-main font-medium">
                {t.dashboard.defaultHub.reposCount(totalRepos)}
              </span>

              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium ${
                  totalUncommitted > 0
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                }`}
              >
                {totalUncommitted > 0 ? (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
                {t.dashboard.defaultHub.uncommittedTotal(totalUncommitted)}
              </span>

              {(totalIncoming > 0 || totalOutgoing > 0) && (
                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-theme-hover/60 border border-theme-border text-theme-muted">
                  <span className="flex items-center text-sky-400">
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>{totalIncoming}</span>
                  </span>
                  <span className="text-theme-border">•</span>
                  <span className="flex items-center text-emerald-400">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>{totalOutgoing}</span>
                  </span>
                </span>
              )}

              {runningServicesCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{runningServicesCount} 个服务运行中</span>
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-theme-border bg-theme-sidebar text-xs text-theme-main hover:bg-theme-hover transition-colors cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? t.dashboard.defaultHub.syncing : t.dashboard.defaultHub.syncAll}</span>
            </button>

            <button
              onClick={openConfigModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-medium transition-colors cursor-pointer shadow-sm shadow-sky-500/20"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{t.dashboard.defaultHub.configureDashboard}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Quick Actions Strip */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-theme-muted mb-3">
          {t.dashboard.defaultHub.quickActions}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => setWorkbenchMode('git')}
            className="flex items-center justify-between p-3.5 rounded-lg border border-theme-border bg-theme-sidebar/40 hover:bg-theme-hover hover:border-theme-border/80 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20 transition-colors">
                <GitCommit className="w-4 h-4" />
              </span>
              <div>
                <div className="text-xs font-medium text-theme-main">{t.dashboard.defaultHub.openGitWorkbench}</div>
                <div className="text-[11px] text-theme-muted mt-0.5">{totalUncommitted} 改动待提交</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-theme-muted group-hover:text-theme-main transition-colors" />
          </button>

          <button
            onClick={() => setWorkbenchMode('explorer')}
            className="flex items-center justify-between p-3.5 rounded-lg border border-theme-border bg-theme-sidebar/40 hover:bg-theme-hover hover:border-theme-border/80 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                <Files className="w-4 h-4" />
              </span>
              <div>
                <div className="text-xs font-medium text-theme-main">{t.dashboard.defaultHub.openExplorer}</div>
                <div className="text-[11px] text-theme-muted mt-0.5">代码浏览与编辑</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-theme-muted group-hover:text-theme-main transition-colors" />
          </button>

          <button
            onClick={() => setWorkbenchMode('services')}
            className="flex items-center justify-between p-3.5 rounded-lg border border-theme-border bg-theme-sidebar/40 hover:bg-theme-hover hover:border-theme-border/80 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                <Server className="w-4 h-4" />
              </span>
              <div>
                <div className="text-xs font-medium text-theme-main">{t.dashboard.defaultHub.openServices}</div>
                <div className="text-[11px] text-theme-muted mt-0.5">{runningServicesCount} 运行中</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-theme-muted group-hover:text-theme-main transition-colors" />
          </button>

          <button
            onClick={toggleTerminal}
            className="flex items-center justify-between p-3.5 rounded-lg border border-theme-border bg-theme-sidebar/40 hover:bg-theme-hover hover:border-theme-border/80 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                <Terminal className="w-4 h-4" />
              </span>
              <div>
                <div className="text-xs font-medium text-theme-main">{t.dashboard.defaultHub.openTerminal}</div>
                <div className="text-[11px] text-theme-muted mt-0.5">极速 CLI 交互</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-theme-muted group-hover:text-theme-main transition-colors" />
          </button>
        </div>
      </div>

      {/* 3. Multi-Repo Health Matrix */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-theme-muted mb-3">
          {t.dashboard.defaultHub.healthMatrix}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((repo) => {
            const isDirty = (repo.uncommittedCount || 0) > 0;
            return (
              <div
                key={repo.id}
                className="p-4 rounded-xl border border-theme-border bg-theme-sidebar/30 hover:border-theme-border/80 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-bold text-theme-main truncate" title={repo.name}>
                      {repo.name}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                        isDirty
                          ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                          : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      }`}
                    >
                      {isDirty ? (
                        <>
                          <AlertCircle className="w-3 h-3 text-amber-400" />
                          <span>{t.dashboard.defaultHub.dirtyState(repo.uncommittedCount || 0)}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>{t.dashboard.defaultHub.cleanState}</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Branch Pill */}
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-theme-hover text-sky-400 text-[11px] font-mono border border-theme-border/80">
                      <GitBranch className="w-3 h-3" />
                      <span className="truncate max-w-[140px]">{repo.currentBranch || 'HEAD'}</span>
                    </span>

                    {(repo.incoming > 0 || repo.outgoing > 0) && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-theme-muted font-mono">
                        {repo.incoming > 0 && (
                          <span className="text-sky-400 flex items-center">
                            <ArrowDownLeft className="w-3 h-3" />
                            {repo.incoming}
                          </span>
                        )}
                        {repo.outgoing > 0 && (
                          <span className="text-emerald-400 flex items-center">
                            <ArrowUpRight className="w-3 h-3" />
                            {repo.outgoing}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-theme-border/50 flex items-center justify-between">
                  <span className="text-[10px] text-theme-muted font-mono truncate max-w-[180px]" title={repo.path}>
                    {repo.path}
                  </span>
                  <button
                    onClick={() => handleJumpToRepoCommit(repo.id)}
                    className="text-[11px] text-sky-400 hover:text-sky-300 font-medium flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>{t.dashboard.defaultHub.jumpToGit}</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. "Customize Portal" Onboarding Hero */}
      <div className="p-5 rounded-xl border border-sky-500/20 bg-sky-500/5 mt-2">
        <div className="flex items-start gap-3.5">
          <span className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </span>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-theme-main">{t.dashboard.defaultHub.customizeBannerTitle}</h3>
            <p className="text-xs text-theme-muted mt-1 leading-relaxed">{t.dashboard.defaultHub.customizeBannerDesc}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-4">
              <div
                onClick={openConfigModal}
                className="p-3 rounded-lg border border-theme-border bg-theme-bg/60 hover:border-sky-500/50 hover:bg-theme-hover transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-theme-main group-hover:text-sky-400">
                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                  <span>{t.dashboard.defaultHub.presetLocalDev}</span>
                </div>
                <p className="text-[10px] text-theme-muted mt-1">{t.dashboard.defaultHub.presetLocalDevDesc}</p>
              </div>

              <div
                onClick={openConfigModal}
                className="p-3 rounded-lg border border-theme-border bg-theme-bg/60 hover:border-sky-500/50 hover:bg-theme-hover transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-theme-main group-hover:text-emerald-400">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t.dashboard.defaultHub.presetDocs}</span>
                </div>
                <p className="text-[10px] text-theme-muted mt-1">{t.dashboard.defaultHub.presetDocsDesc}</p>
              </div>

              <div
                onClick={openConfigModal}
                className="p-3 rounded-lg border border-theme-border bg-theme-bg/60 hover:border-sky-500/50 hover:bg-theme-hover transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-theme-main group-hover:text-purple-400">
                  <FileCode className="w-3.5 h-3.5 text-purple-400" />
                  <span>{t.dashboard.defaultHub.presetSpa}</span>
                </div>
                <p className="text-[10px] text-theme-muted mt-1">{t.dashboard.defaultHub.presetSpaDesc}</p>
              </div>

              <div
                onClick={openConfigModal}
                className="p-3 rounded-lg border border-theme-border bg-theme-bg/60 hover:border-sky-500/50 hover:bg-theme-hover transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-theme-main group-hover:text-amber-400">
                  <Kanban className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.dashboard.defaultHub.presetKanban}</span>
                </div>
                <p className="text-[10px] text-theme-muted mt-1">{t.dashboard.defaultHub.presetKanbanDesc}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
