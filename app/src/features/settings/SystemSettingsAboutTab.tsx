import React from 'react';
import {
  Laptop,
  Terminal,
  Check,
  CheckCircle2,
  DownloadCloud,
  AlertCircle,
  RefreshCw,
  ArrowUpCircle,
  Sliders,
} from 'lucide-react';
import { useTranslation } from '../../locales';

export const SystemSettingsPerfSection: React.FC<{
  cacheTTL: number;
  setCacheTTL: (val: number) => void;
  maxCacheRepos: number;
  setMaxCacheRepos: (val: number) => void;
}> = ({ cacheTTL, setCacheTTL, maxCacheRepos, setMaxCacheRepos }) => {
  const { t } = useTranslation();
  return (
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
          <p className="text-theme-dim text-[10px] mt-1">{t.settings.cacheSection.ttlDesc}</p>
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
  );
};

interface SystemSettingsAboutTabProps {
  appVersion: string;
  isElectron: boolean;
  gitDetect: { found: boolean; path: string; version?: string } | null;
  updateStatus:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error';
  updateProgress: number;
  updateSpeed: string;
  updateInfo: any;
  updateError: string;
  handleCheckUpdate: () => void;
  handleQuitAndInstall: () => void;
}

export const SystemSettingsAboutTab: React.FC<SystemSettingsAboutTabProps> = ({
  appVersion,
  isElectron,
  gitDetect,
  updateStatus,
  updateProgress,
  updateSpeed,
  updateInfo,
  updateError,
  handleCheckUpdate,
  handleQuitAndInstall,
}) => {
  const { t } = useTranslation();

  return (
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
          <div className="p-2.5 rounded bg-theme-input/60 border border-theme-border flex items-start gap-2">
            <Terminal className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-theme-main">
                {t.settings.updatesSection.isolationTitle}
              </div>
              <div className="text-theme-dim text-[10px]">
                {isElectron
                  ? t.settings.updatesSection.isolationElectron
                  : t.settings.updatesSection.isolationWeb}
              </div>
              <div className="text-emerald-400 text-[10px] mt-0.5 flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>{t.settings.updatesSection.zeroPollution}</span>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded bg-theme-input/60 border border-theme-border flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-theme-main">
                {t.settings.updatesSection.gitEngineTitle}
              </div>
              <div
                className="text-theme-dim text-[10px] truncate"
                title={gitDetect?.path || t.settings.updatesSection.gitDetecting}
              >
                {gitDetect?.found ? gitDetect.path : t.settings.updatesSection.gitDetectFallback}
              </div>
              <div className="text-emerald-400 text-[10px] mt-0.5 flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>
                  {gitDetect?.version
                    ? t.settings.updatesSection.gitDetected(gitDetect.version)
                    : t.settings.updatesSection.gitReady}
                </span>
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

        <div className="p-3 rounded-md bg-theme-input/40 border border-theme-border space-y-3">
          {!isElectron ? (
            <div className="flex items-center gap-2 text-theme-muted text-[11px]">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{t.settings.updatesSection.browserNotice}</span>
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
                <span>
                  {t.settings.updatesSection.updateAvailable(updateInfo?.version || '')}
                </span>
              </div>
              <p className="text-theme-dim text-[11px]">
                {t.settings.updatesSection.preparingDownload}
              </p>
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
                  <div className="font-semibold text-xs">
                    {t.settings.updatesSection.downloadComplete}
                  </div>
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
                <span>
                  {t.settings.updatesSection.updateNotAvailable} (v{appVersion})
                </span>
              </div>
              <button
                type="button"
                onClick={handleCheckUpdate}
                className="px-2.5 py-1 rounded bg-theme-hover text-theme-muted hover:text-theme-main border border-theme-border text-xs transition cursor-pointer"
              >
                {t.settings.updatesSection.checkUpdateBtn}
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
            <div className="flex items-center justify-between text-xs">
              <span className="text-theme-muted">
                {t.settings.updatesSection.versionLabel}:{' '}
                <strong className="text-theme-main">v{appVersion}</strong>
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
  );
};
