import React, { useState, useEffect } from 'react';
import { useAppStore, broadcastWorkspaceChanged } from '../../store/useAppStore';
import { APP_VERSION } from '../../constants/version';
import { useTranslation } from '../../locales';
import {
  Settings,
  X,
  HardDrive,
  Folder,
  Trash2,
  Check,
  AlertCircle,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Sparkles,
  ArrowUpCircle,
  DownloadCloud,
  CheckCircle2,
  Terminal,
  Laptop,
  ExternalLink,
  FolderGit2,
  Layers,
  Languages,
} from 'lucide-react';

interface SystemSettingsModalProps {
  onClose: () => void;
}

export function SystemSettingsModal({ onClose }: SystemSettingsModalProps) {
  const { t, language, setLanguage } = useTranslation();
  const {
    setNotification,
    startupBehavior,
    setStartupBehavior,
    newWindowBehavior,
    setNewWindowBehavior,
    globalRecentProjects,
    loadRecentProjects,
    savedWorkspaces,
    loadSavedWorkspaces,
    openWelcomeScreen,
    workspaceId,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'startup' | 'cache' | 'about'>('startup');

  const [cacheDir, setCacheDir] = useState('D:\\OmniGitCache');
  const [maxCacheRepos, setMaxCacheRepos] = useState(30);
  const [cacheTTL, setCacheTTL] = useState(15);
  const [cacheSize, setCacheSize] = useState(0);
  const [repoCount, setRepoCount] = useState(0);
  const [migrateData, setMigrateData] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Desktop & Update states
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
  const [appVersion, setAppVersion] = useState(APP_VERSION);
  const [gitDetect, setGitDetect] = useState<{ found: boolean; path: string; version?: string } | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'>('idle');
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const [updateSpeed, setUpdateSpeed] = useState<string>('');
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [updateError, setUpdateError] = useState<string>('');

  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;
    window.electronAPI.getAppVersion().then((v) => setAppVersion(v)).catch(() => {});
    window.electronAPI.detectGitPath().then((g) => setGitDetect(g)).catch(() => {});

    const cleanup = window.electronAPI.onUpdateStatus((payload) => {
      setUpdateStatus(payload.status);
      if (payload.progress) {
        setUpdateProgress(Math.round(payload.progress.percent));
        const speedMB = (payload.progress.bytesPerSecond / (1024 * 1024)).toFixed(2);
        setUpdateSpeed(`${speedMB} MB/s`);
      }
      if (payload.info) {
        setUpdateInfo(payload.info);
      }
      if (payload.error) {
        setUpdateError(payload.error);
      }
    });

    return () => {
      cleanup();
    };
  }, [isElectron]);

  const handleCheckUpdate = async () => {
    if (!window.electronAPI) {
      setNotification({
        id: Date.now(),
        title: t.settings.updatesSection.browserNotice,
        type: 'info',
      });
      return;
    }
    setUpdateStatus('checking');
    setUpdateError('');
    try {
      const res = await window.electronAPI.checkForUpdates();
      if (!res) {
        setTimeout(() => {
          setUpdateStatus('not-available');
        }, 600);
      }
    } catch (err: any) {
      setUpdateStatus('error');
      setUpdateError(err?.message || t.settings.updatesSection.checkUpdateFailed);
    }
  };

  const handleQuitAndInstall = () => {
    window.electronAPI?.quitAndInstall();
  };

  // Fetch current backend settings on mount
  useEffect(() => {
    let isMounted = true;
    async function loadSettings() {
      try {
        const res = await fetch('/api/git/settings');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.settings) {
            setCacheDir(data.settings.cacheDir || 'D:\\OmniGitCache');
            setMaxCacheRepos(data.settings.maxCacheRepos || 30);
            setCacheTTL(Math.round((data.settings.cacheTTL || 15000) / 1000));
            setCacheSize(data.cacheSize || 0);
            setRepoCount(data.repoCount || 0);
          }
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  // Keyboard shortcut Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleSave = async () => {
    const cleanDir = cacheDir.trim();
    if (!cleanDir) {
      setNotification({
        id: Date.now(),
        title: t.settings.cacheSection.emptyPathError,
        type: 'warning',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/git/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            cacheDir: cleanDir,
            maxCacheRepos,
            cacheTTL: cacheTTL * 1000,
          },
          migrateData,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCacheSize(data.cacheSize || 0);
        setRepoCount(data.repoCount || 0);
        setNotification({
          id: Date.now(),
          title: t.settings.cacheSection.saveSuccess,
          detail: t.settings.cacheSection.saveSuccessDetail(cleanDir),
          type: 'success',
        });
        onClose();
      } else {
        throw new Error('Server returned error');
      }
    } catch (e) {
      setNotification({
        id: Date.now(),
        title: t.settings.cacheSection.saveError,
        type: 'warning',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      const res = await fetch('/api/git/settings/clear-cache', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        setCacheSize(0);
        setRepoCount(0);
        setConfirmClear(false);
        setNotification({
          id: Date.now(),
          title: t.settings.cacheSection.clearedCountDetail(result.clearedCount || 0),
          type: 'success',
        });
      }
    } catch (e) {
      setNotification({
        id: Date.now(),
        title: t.settings.cacheSection.clearFailed,
        type: 'warning',
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Check if cacheDir is on C: drive
  const isCDrive = /^[cC]:[/\\]/.test(cacheDir.trim());

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-theme-panel border border-theme-border rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="h-12 px-5 bg-theme-header border-b border-theme-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-theme-main">{t.settings.modalTitle}</h2>
              <p className="text-[11px] text-theme-dim">{t.settings.modalSubtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-theme-dim hover:text-theme-main rounded transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-5 border-b border-theme-border bg-theme-subbar text-xs select-none">
          <button
            type="button"
            onClick={() => setActiveTab('startup')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition cursor-pointer ${
              activeTab === 'startup'
                ? 'border-sky-500 text-sky-400 font-semibold'
                : 'border-transparent text-theme-muted hover:text-theme-main'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>{t.settings.tabs.startup}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cache')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition cursor-pointer ${
              activeTab === 'cache'
                ? 'border-sky-500 text-sky-400 font-semibold'
                : 'border-transparent text-theme-muted hover:text-theme-main'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>{t.settings.tabs.cache}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition cursor-pointer ${
              activeTab === 'about'
                ? 'border-sky-500 text-sky-400 font-semibold'
                : 'border-transparent text-theme-muted hover:text-theme-main'
            }`}
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            <span>{t.settings.tabs.updates}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6 text-xs text-theme-main">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-theme-dim">
              <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
              <p>{t.common.loading}</p>
            </div>
          ) : activeTab === 'startup' ? (
            <>
              {/* Section 0: Interface Language (Top Priority) */}
              <div className="space-y-3 bg-theme-card p-4 rounded-md border border-theme-border-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-theme-main font-semibold text-xs">
                    <Languages className="w-4 h-4 text-sky-400" />
                    <span>{t.settings.languageSection.title}</span>
                  </div>
                  <span className="text-[10px] text-theme-dim font-mono">
                    i18n Dual Engine
                  </span>
                </div>

                <p className="text-theme-dim text-[11px] leading-relaxed">
                  {t.settings.languageSection.subtitle}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {/* Option: Chinese Hybrid */}
                  <label
                    onClick={() => setLanguage('zh-CN')}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      language === 'zh-CN'
                        ? 'bg-sky-500/10 border-sky-500/60 ring-1 ring-sky-500/30'
                        : 'bg-theme-input border-theme-border hover:border-theme-border/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sys_language_selection"
                      checked={language === 'zh-CN'}
                      onChange={() => setLanguage('zh-CN')}
                      className="mt-0.5 text-sky-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-theme-main flex items-center gap-1.5">
                        <span className="text-sm">🇨🇳</span>
                        <span>{t.settings.languageSection.zhTitle}</span>
                      </span>
                      <span className="text-[11px] text-theme-dim mt-1 leading-normal">
                        {t.settings.languageSection.zhDesc}
                      </span>
                    </div>
                  </label>

                  {/* Option: English */}
                  <label
                    onClick={() => setLanguage('en-US')}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      language === 'en-US'
                        ? 'bg-sky-500/10 border-sky-500/60 ring-1 ring-sky-500/30'
                        : 'bg-theme-input border-theme-border hover:border-theme-border/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sys_language_selection"
                      checked={language === 'en-US'}
                      onChange={() => setLanguage('en-US')}
                      className="mt-0.5 text-sky-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-theme-main flex items-center gap-1.5">
                        <span className="text-sm">🇺🇸</span>
                        <span>{t.settings.languageSection.enTitle}</span>
                      </span>
                      <span className="text-[11px] text-theme-dim mt-1 leading-normal">
                        {t.settings.languageSection.enDesc}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Section 1: Startup Project Behavior */}
              <div className="space-y-3 bg-theme-card p-4 rounded-md border border-theme-border-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-theme-main font-semibold text-xs">
                    <FolderGit2 className="w-4 h-4 text-sky-400" />
                    <span>{t.settings.startupSection.title}</span>
                  </div>
                  <span className="text-[10px] text-theme-dim font-mono">
                    {t.settings.startupSection.badgeIdea}
                  </span>
                </div>

                <p className="text-theme-dim text-[11px] leading-relaxed">
                  {t.settings.startupSection.desc}
                </p>

                <div className="space-y-2 pt-1">
                  {/* Option A: Reopen Last Closed Project */}
                  <label
                    onClick={() => setStartupBehavior('reopen_last')}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      startupBehavior === 'reopen_last'
                        ? 'bg-sky-500/10 border-sky-500/60'
                        : 'bg-theme-input border-theme-border hover:border-theme-border/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sys_startup_behavior"
                      checked={startupBehavior === 'reopen_last'}
                      onChange={() => setStartupBehavior('reopen_last')}
                      className="mt-0.5 text-sky-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-theme-main">
                        {t.settings.startupSection.reopenLastTitle}
                      </span>
                      <span className="text-[11px] text-theme-dim mt-0.5">
                        {t.settings.startupSection.reopenLastDesc}
                      </span>
                    </div>
                  </label>

                  {/* Option B: Show Welcome Screen to Select */}
                  <label
                    onClick={() => setStartupBehavior('welcome_screen')}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      startupBehavior === 'welcome_screen'
                        ? 'bg-sky-500/10 border-sky-500/60'
                        : 'bg-theme-input border-theme-border hover:border-theme-border/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sys_startup_behavior"
                      checked={startupBehavior === 'welcome_screen'}
                      onChange={() => setStartupBehavior('welcome_screen')}
                      className="mt-0.5 text-sky-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-theme-main">
                        {t.settings.startupSection.welcomeScreenTitle}
                      </span>
                      <span className="text-[11px] text-theme-dim mt-0.5">
                        {t.settings.startupSection.welcomeScreenDesc}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Section 2: New Window Behavior */}
              <div className="space-y-3 bg-theme-card p-4 rounded-md border border-theme-border-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-theme-main font-semibold text-xs">
                    <ExternalLink className="w-4 h-4 text-amber-400" />
                    <span>{t.settings.newWindowSection.title}</span>
                  </div>
                  <span className="text-[10px] text-theme-dim font-mono">
                    {t.settings.newWindowSection.badgeMultiWindow}
                  </span>
                </div>

                <p className="text-theme-dim text-[11px] leading-relaxed">
                  {t.settings.newWindowSection.desc}
                </p>

                <div className="space-y-2 pt-1">
                  {/* Option A: Open Fresh Blank Workspace */}
                  <label
                    onClick={() => setNewWindowBehavior('empty')}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      newWindowBehavior === 'empty'
                        ? 'bg-sky-500/10 border-sky-500/60'
                        : 'bg-theme-input border-theme-border hover:border-theme-border/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sys_new_window_behavior"
                      checked={newWindowBehavior === 'empty'}
                      onChange={() => setNewWindowBehavior('empty')}
                      className="mt-0.5 text-sky-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-theme-main">
                        {t.settings.newWindowSection.emptyTitle}
                      </span>
                      <span className="text-[11px] text-theme-dim mt-0.5">
                        {t.settings.newWindowSection.emptyDesc}
                      </span>
                    </div>
                  </label>

                  {/* Option B: Open Welcome Screen in New Window */}
                  <label
                    onClick={() => setNewWindowBehavior('welcome')}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      newWindowBehavior === 'welcome'
                        ? 'bg-sky-500/10 border-sky-500/60'
                        : 'bg-theme-input border-theme-border hover:border-theme-border/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sys_new_window_behavior"
                      checked={newWindowBehavior === 'welcome'}
                      onChange={() => setNewWindowBehavior('welcome')}
                      className="mt-0.5 text-sky-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-theme-main">
                        {t.settings.newWindowSection.welcomeTitle}
                      </span>
                      <span className="text-[11px] text-theme-dim mt-0.5">
                        {t.settings.newWindowSection.welcomeDesc}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Section 3: Recent Projects & Workspace History */}
              <div className="space-y-3 bg-theme-card p-4 rounded-md border border-theme-border-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-theme-main font-semibold text-xs">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>{t.settings.historySection.title}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-theme-subbar border border-theme-border text-theme-dim font-mono">
                    {t.settings.historySection.stats(savedWorkspaces.length, globalRecentProjects.length)}
                  </span>
                </div>

                <p className="text-theme-dim text-[11px] leading-relaxed">
                  {t.settings.historySection.workspaceIdLabel} <code className="px-1 py-0.5 rounded bg-theme-input font-mono text-sky-400">{workspaceId}</code>。{t.settings.historySection.isolationDesc}
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openWelcomeScreen();
                    }}
                    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <FolderGit2 className="w-3.5 h-3.5" />
                    <span>{t.settings.historySection.openWelcomeBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t.settings.historySection.confirmClearPrompt)) {
                        localStorage.removeItem('omnigit_saved_workspaces');
                        localStorage.removeItem('omnigit_global_recent_projects');
                        loadSavedWorkspaces();
                        loadRecentProjects();
                        broadcastWorkspaceChanged();
                        setNotification({
                          id: Date.now(),
                          title: t.settings.historySection.historyCleared,
                          type: 'info',
                        });
                      }
                    }}
                    className="px-3 py-1.5 bg-theme-hover hover:bg-rose-500/15 hover:text-rose-400 border border-theme-border rounded text-xs text-theme-dim transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.settings.historySection.clearHistoryBtn}</span>
                  </button>
                </div>
              </div>
            </>
          ) : activeTab === 'cache' ? (
            <>
              {/* Section 1: Cache Directory Storage (Top Priority) */}
              <div className="space-y-3 bg-theme-card p-4 rounded-md border border-theme-border-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-theme-main font-semibold text-xs">
                    <HardDrive className="w-4 h-4 text-sky-400" />
                    <span>{t.settings.cacheSection.title}</span>
                  </div>
                  {isCDrive ? (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {t.settings.cacheSection.warningCDrive}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <Check className="w-3 h-3 shrink-0" />
                      {t.settings.cacheSection.safeNonCDrive}
                    </span>
                  )}
                </div>

                <p className="text-theme-dim text-[11px] leading-relaxed">
                  {t.settings.cacheSection.desc}
                </p>

                {/* Path input */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={cacheDir}
                      onChange={(e) => setCacheDir(e.target.value)}
                      placeholder="D:\OmniGitCache"
                      className="w-full bg-theme-input border border-theme-border rounded px-3 py-2 text-xs font-mono text-theme-main focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* Preset suggestions */}
                <div className="flex items-center gap-2 pt-1 text-[11px]">
                  <span className="text-theme-dim">{t.settings.cacheSection.quickRecommend}</span>
                  <button
                    type="button"
                    onClick={() => setCacheDir('C:\\OmniGitCache')}
                    className="px-2 py-0.5 rounded bg-theme-hover text-theme-muted hover:bg-theme-hover text-theme-main border border-theme-border transition cursor-pointer font-mono"
                  >
                    C:\OmniGitCache
                  </button>
                  <button
                    type="button"
                    onClick={() => setCacheDir('D:\\OmniGitCache')}
                    className="px-2 py-0.5 rounded bg-theme-hover text-sky-400 hover:bg-sky-500/20 border border-theme-border transition cursor-pointer font-mono"
                  >
                    D:\OmniGitCache
                  </button>
                </div>

                {/* Migrate option */}
                <label className="flex items-center gap-2 cursor-pointer pt-1 text-theme-muted hover:text-theme-main select-none">
                  <input
                    type="checkbox"
                    checked={migrateData}
                    onChange={(e) => setMigrateData(e.target.checked)}
                    className="rounded border-theme text-sky-500 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>{t.settings.cacheSection.migrateCheckbox}</span>
                </label>
              </div>

              {/* Section 2: Cache Capacity & Lightweight Guard */}
              <div className="bg-theme-card p-4 rounded-md border border-theme-border-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-xs text-theme-main">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>{t.settings.cacheSection.statsTitle}</span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-theme-muted">
                      {t.settings.cacheSection.cachedRepos} <strong className="text-sky-400">{repoCount}</strong>
                    </span>
                    <span className="text-theme-muted">
                      {t.settings.cacheSection.diskUsage} <strong className="text-emerald-400">{formatSize(cacheSize)}</strong>
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-sky-500/5 border border-sky-500/20 text-sky-300 text-[11px] flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    {t.settings.cacheSection.guardNotice}
                  </p>
                </div>

                {/* Clear Cache Action */}
                <div className="pt-2 flex items-center justify-between border-t border-theme-border-card">
                  <div className="text-theme-dim text-[11px]">
                    {t.settings.cacheSection.clearCacheHint}
                  </div>

                  {confirmClear ? (
                    <div className="flex items-center gap-2">
                      <span className="text-rose-400 font-medium text-[11px]">{t.settings.cacheSection.confirmClearPrompt}</span>
                      <button
                        type="button"
                        onClick={handleClearCache}
                        disabled={isClearing}
                        className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs cursor-pointer"
                      >
                        {isClearing ? t.settings.cacheSection.clearingCache : t.settings.cacheSection.confirmClearBtn}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClear(false)}
                        className="px-2.5 py-1 rounded bg-theme-hover text-theme-muted hover:text-theme-main text-xs cursor-pointer"
                      >
                        {t.common.cancel}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClear(true)}
                      className="px-2.5 py-1 rounded bg-theme-hover hover:bg-rose-500/10 hover:text-rose-400 text-theme-muted border border-theme-border transition cursor-pointer flex items-center gap-1.5 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t.settings.cacheSection.clearCacheBtn}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Section 3: Performance & SWR Parameters */}
              <div className="bg-theme-card p-4 rounded-md border border-theme-border-card space-y-3">
                <div className="flex items-center gap-2 font-semibold text-xs text-theme-main">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <span>{t.settings.cacheSection.perfTitle}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-[11px] text-theme-muted mb-1">
                      {t.settings.cacheSection.ttlLabel}
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={300}
                      value={cacheTTL}
                      onChange={(e) => setCacheTTL(Math.max(5, parseInt(e.target.value, 10) || 15))}
                      className="w-full bg-theme-input border border-theme-border rounded px-3 py-1.5 text-xs text-theme-main font-mono"
                    />
                    <p className="text-theme-dim text-[10px] mt-1">
                      {t.settings.cacheSection.ttlDesc}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] text-theme-muted mb-1">
                      {t.settings.cacheSection.lruLabel}
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={maxCacheRepos}
                      onChange={(e) => setMaxCacheRepos(Math.max(5, parseInt(e.target.value, 10) || 30))}
                      className="w-full bg-theme-input border border-theme-border rounded px-3 py-1.5 text-xs text-theme-main font-mono"
                    />
                    <p className="text-theme-dim text-[10px] mt-1">{t.settings.cacheSection.lruDesc}</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ActiveTab === 'about' (版本与在线自动更新) */
            <div className="space-y-4">
              {/* Card 1: Client Runtime & Isolation Status */}
              <div className="bg-theme-card p-4 rounded-md border border-theme-border-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-xs text-theme-main">
                    <Laptop className="w-4 h-4 text-sky-400" />
                    <span>{t.settings.updatesSection.runtimeTitle}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 font-mono font-bold">
                    OmniGit v{appVersion}
                  </span>
                </div>

                <p className="text-theme-dim text-[11px] leading-relaxed">
                  {t.settings.updatesSection.runtimeDesc}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-[11px]">
                  {/* Runtime Status */}
                  <div className="p-2.5 rounded bg-theme-input/60 border border-theme-border flex items-start gap-2">
                    <Terminal className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-theme-main">{t.settings.updatesSection.isolationTitle}</div>
                      <div className="text-theme-dim text-[10px]">
                        {isElectron ? t.settings.updatesSection.isolationElectron : t.settings.updatesSection.isolationWeb}
                      </div>
                      <div className="text-emerald-400 text-[10px] mt-0.5 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>{t.settings.updatesSection.zeroPollution}</span>
                      </div>
                    </div>
                  </div>

                  {/* Git Detector Status */}
                  <div className="p-2.5 rounded bg-theme-input/60 border border-theme-border flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-theme-main">{t.settings.updatesSection.gitEngineTitle}</div>
                      <div className="text-theme-dim text-[10px] truncate" title={gitDetect?.path || t.settings.updatesSection.gitDetecting}>
                        {gitDetect?.found
                          ? gitDetect.path
                          : t.settings.updatesSection.gitDetectFallback}
                      </div>
                      <div className="text-emerald-400 text-[10px] mt-0.5 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>{gitDetect?.version ? t.settings.updatesSection.gitDetected(gitDetect.version) : t.settings.updatesSection.gitReady}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Auto-Update Status & Actions */}
              <div className="bg-theme-card p-4 rounded-md border border-theme-border-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-xs text-theme-main">
                    <DownloadCloud className="w-4 h-4 text-emerald-400" />
                    <span>{t.settings.updatesSection.updatesTitle}</span>
                  </div>
                  <span className="text-theme-dim text-[11px] font-mono">
                    {t.settings.updatesSection.channelLabel}
                  </span>
                </div>

                <p className="text-theme-dim text-[11px] leading-relaxed">
                  {t.settings.updatesSection.updatesDesc}
                </p>

                {/* Status Box */}
                <div className="p-3 rounded-md bg-theme-input/40 border border-theme-border space-y-3">
                  {!isElectron ? (
                    <div className="flex items-center gap-2 text-theme-muted text-[11px]">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        {t.settings.updatesSection.browserNotice}
                      </span>
                    </div>
                  ) : updateStatus === 'checking' ? (
                    <div className="flex items-center gap-2 text-sky-400 text-xs py-1">
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                      <span>{t.settings.updatesSection.checkingUpdate}</span>
                    </div>
                  ) : updateStatus === 'available' ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-emerald-400 font-medium text-xs">
                        <ArrowUpCircle className="w-4 h-4 shrink-0" />
                        <span>{t.settings.updatesSection.updateAvailable(updateInfo?.version || '')}</span>
                      </div>
                      <p className="text-theme-dim text-[11px]">{t.settings.updatesSection.preparingDownload}</p>
                    </div>
                  ) : updateStatus === 'downloading' ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-sky-400 flex items-center gap-1.5 font-medium">
                          <DownloadCloud className="w-3.5 h-3.5 animate-bounce" />
                          {t.settings.updatesSection.downloadingUpdate(updateProgress, updateSpeed || '')}
                        </span>
                        <span className="font-mono text-theme-main font-bold">
                          {updateProgress}% {updateSpeed && `(${updateSpeed})`}
                        </span>
                      </div>
                      {/* Progress Bar */}
                      <div className="h-2 w-full bg-theme-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-300 rounded-full"
                          style={{ width: `${updateProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : updateStatus === 'downloaded' ? (
                    <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded text-emerald-400">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <div>
                          <div className="font-semibold text-xs">{t.settings.updatesSection.downloadComplete}</div>
                          <div className="text-[11px] text-emerald-300/80">
                            {t.settings.updatesSection.downloadComplete}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleQuitAndInstall}
                        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow transition cursor-pointer shrink-0"
                      >
                        {t.settings.updatesSection.quitAndInstallBtn}
                      </button>
                    </div>
                  ) : updateStatus === 'not-available' ? (
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{t.settings.updatesSection.updateNotAvailable} (v{appVersion})</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCheckUpdate}
                        className="px-2.5 py-1 rounded bg-theme-hover text-theme-muted hover:text-theme-main border border-theme-border text-xs transition cursor-pointer"
                      >
                        {t.settings.updatesSection.checkAgain}
                      </button>
                    </div>
                  ) : updateStatus === 'error' ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-400 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{t.settings.updatesSection.updateErrorNotice}</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleCheckUpdate}
                          className="px-2.5 py-1 rounded bg-theme-hover text-theme-muted hover:text-theme-main border border-theme-border text-xs transition cursor-pointer"
                        >
                          {t.settings.updatesSection.retryBtn}
                        </button>
                      </div>
                      {updateError && (
                        <p className="text-[10px] text-theme-dim font-mono bg-theme-header p-1.5 rounded truncate">
                          {updateError}
                        </p>
                      )}
                    </div>
                  ) : (
                    /* updateStatus === 'idle' */
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-theme-muted">
                        {t.settings.updatesSection.versionLabel}: <strong className="text-theme-main">v{appVersion}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleCheckUpdate}
                        className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow transition cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{t.settings.updatesSection.checkUpdateBtn}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-14 px-5 bg-theme-subbar border-t border-theme-border flex items-center justify-between shrink-0">
          <div className="text-[11px] text-theme-dim font-mono">
            {activeTab === 'cache' ? (
              <span>{t.settings.footer.cacheShortcutHint}</span>
            ) : (
              <span>{t.settings.footer.desktopBrand}</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {activeTab === 'cache' ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded bg-theme-card hover:bg-theme-card-hover text-theme-muted hover:text-theme-main border border-theme-border-card text-xs font-medium transition cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || isLoading}
                  className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-medium text-xs shadow transition cursor-pointer flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{t.settings.cacheSection.savingSettings}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{t.settings.cacheSection.saveSettingsBtn}</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded bg-theme-card hover:bg-theme-card-hover text-theme-main border border-theme-border-card text-xs font-medium transition cursor-pointer"
              >
                {t.common.close}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
