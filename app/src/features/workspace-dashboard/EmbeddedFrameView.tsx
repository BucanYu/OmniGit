import React, { useRef, useState, useEffect } from 'react';
import {
  Globe,
  FileCode,
  RotateCw,
  ExternalLink,
  Settings,
  Users,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from '../../locales';
import { useDashboardStore } from './useDashboardStore';
import { useAppStore } from '../../store/useAppStore';
import { setupOmniGitBridge } from './OmniGitBridge';

export function EmbeddedFrameView() {
  const { t } = useTranslation();
  const {
    activeConfig,
    configScope,
    sessionToken,
    refreshKey,
    triggerRefresh,
    openConfigModal,
  } = useDashboardStore();

  const { workspaceId, savedWorkspaces } = useAppStore();
  const currentWs = savedWorkspaces.find((w) => w.id === workspaceId);
  const rootPath = currentWs?.rootPath || '';

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const type = activeConfig?.type || 'url';
  const customTitle = activeConfig?.title || (type === 'url' ? activeConfig?.url : activeConfig?.filePath);

  // 计算目标 URL 与预期 Origin
  let srcUrl = '';
  let expectedOrigin = '';

  if (type === 'url' && activeConfig?.url) {
    srcUrl = `${activeConfig.url}#omnigitToken=${sessionToken}`;
    try {
      expectedOrigin = new URL(activeConfig.url).origin;
    } catch {
      expectedOrigin = '*';
    }
  } else if (type === 'file' && activeConfig?.filePath) {
    const normPath = activeConfig.filePath.trim();
    srcUrl = `/api/workspace/dashboard-serve/${encodeURIComponent(workspaceId)}/index.html?root=${encodeURIComponent(normPath)}#omnigitToken=${sessionToken}`;
    expectedOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:5345';
  }

  // 1. 设置 OmniGitBridge 双向通信桥接（零信任护城河）
  useEffect(() => {
    if (!activeConfig?.enableBridge) return;
    const cleanup = setupOmniGitBridge({
      iframeRef,
      expectedToken: sessionToken,
      expectedOrigin,
      enableBridge: Boolean(activeConfig.enableBridge),
      workspaceRoot: rootPath,
    });
    return cleanup;
  }, [sessionToken, expectedOrigin, activeConfig?.enableBridge, rootPath]);

  // 2. 定时静默自动刷新
  useEffect(() => {
    if (!activeConfig?.autoReload || !activeConfig.reloadIntervalSeconds) return;
    const intervalMs = Math.max(5, activeConfig.reloadIntervalSeconds) * 1000;
    const timer = setInterval(() => {
      triggerRefresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [activeConfig?.autoReload, activeConfig?.reloadIntervalSeconds, triggerRefresh]);

  // 3. 页面刷新与加载状态监听
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);

    // 超时排查兜底：若 15 秒尚未完成加载，提示排查
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 15000);

    return () => clearTimeout(timeout);
  }, [refreshKey, srcUrl]);

  const handleOpenExternal = () => {
    if (srcUrl) {
      window.open(srcUrl, '_blank');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-theme-app overflow-hidden relative">
      {/* 顶部微前端操作条 */}
      <div className="h-10 border-b border-theme-border bg-theme-header px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2.5 overflow-hidden">
          {/* 类型徽章 */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-theme-card border border-theme-border text-theme-muted">
            {type === 'url' ? <Globe className="w-3 h-3 text-sky-600 dark:text-sky-400" /> : <FileCode className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
            <span>{type === 'url' ? t.dashboard.topBar.urlBadge : t.dashboard.topBar.fileBadge}</span>
          </span>

          {/* 团队协同徽章 */}
          {configScope === 'team' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400">
              <Users className="w-3 h-3" />
              <span>{t.dashboard.topBar.teamBadge}</span>
            </span>
          )}

          {/* 页面标题 */}
          <span className="text-xs font-semibold text-theme-main truncate max-w-[420px]" title={customTitle || ''}>
            {customTitle || t.dashboard.modeTitle}
          </span>
        </div>

        {/* 右侧控制动作 */}
        <div className="flex items-center gap-1">
          <button
            onClick={triggerRefresh}
            className="p-1.5 rounded-md text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors cursor-pointer"
            title={t.dashboard.topBar.reload}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleOpenExternal}
            className="p-1.5 rounded-md text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors cursor-pointer"
            title={t.dashboard.topBar.openExternal}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={openConfigModal}
            className="p-1.5 rounded-md text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors cursor-pointer"
            title={t.dashboard.topBar.settings}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 嵌入沙箱 Iframe 主体 */}
      <div className="flex-1 relative w-full h-full overflow-hidden bg-theme-panel">
        {srcUrl ? (
          <iframe
            key={`dash_${refreshKey}_${workspaceId}`}
            ref={iframeRef}
            src={srcUrl}
            title={customTitle || 'Workspace Dashboard'}
            sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            className="w-full h-full border-none block"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-theme-muted text-xs">
            {t.dashboard.embedded.loadFailedDesc}
          </div>
        )}

        {/* Loading 状态骨架屏 */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-theme-panel/90 backdrop-blur-xs">
            <RefreshCw className="w-6 h-6 text-sky-500 animate-spin mb-3" />
            <div className="text-xs font-semibold text-theme-main">{t.dashboard.embedded.loadingTitle}</div>
            <div className="text-[11px] text-theme-muted mt-1">{t.dashboard.embedded.loadingDesc}</div>
          </div>
        )}

        {/* 失败友好降级卡片 */}
        {hasError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-theme-panel p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
            <h3 className="text-sm font-semibold text-theme-main">{t.dashboard.embedded.loadFailedTitle}</h3>
            <p className="text-xs text-theme-muted max-w-md mt-1.5 leading-relaxed">
              {t.dashboard.embedded.loadFailedDesc}
            </p>
            <p className="text-[11px] text-theme-muted/80 max-w-md mt-2 italic">
              {t.dashboard.embedded.troubleshootTip}
            </p>
            <div className="flex items-center gap-2 mt-5">
              <button
                onClick={triggerRefresh}
                className="px-3 py-1.5 rounded-lg bg-theme-card border border-theme-border text-xs text-theme-main hover:bg-theme-hover transition-colors cursor-pointer"
              >
                {t.dashboard.embedded.retryButton}
              </button>
              <button
                onClick={openConfigModal}
                className="px-3 py-1.5 rounded-lg bg-sky-600 text-xs text-white hover:bg-sky-500 font-medium transition-colors cursor-pointer"
              >
                {t.dashboard.embedded.configButton}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
