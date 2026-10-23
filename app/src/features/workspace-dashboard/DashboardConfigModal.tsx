import React, { useState, useEffect } from 'react';
import {
  X,
  Globe,
  FileCode,
  FolderOpen,
  ExternalLink,
  ShieldAlert,
  Users,
  Laptop,
  RotateCw,
  Save,
  RotateCcw,
} from 'lucide-react';
import { useTranslation } from '../../locales';
import { useDashboardStore } from './useDashboardStore';
import { useAppStore } from '../../store/useAppStore';
import type { WorkspaceDashboardConfig } from './types';

export function DashboardConfigModal() {
  const { t } = useTranslation();
  const {
    isConfigModalOpen,
    closeConfigModal,
    activeConfig,
    configScope,
    saveConfig,
    disableCustomDashboard,
  } = useDashboardStore();

  const { workspaceId, savedWorkspaces, setNotification } = useAppStore();
  const currentWs = savedWorkspaces.find((w) => w.id === workspaceId);
  const rootPath = currentWs?.rootPath || '';

  const [type, setType] = useState<'url' | 'file'>('url');
  const [url, setUrl] = useState('');
  const [filePath, setFilePath] = useState('');
  const [title, setTitle] = useState('');
  const [autoReload, setAutoReload] = useState(false);
  const [reloadIntervalSeconds, setReloadIntervalSeconds] = useState(60);
  const [enableBridge, setEnableBridge] = useState(true);
  const [scope, setScope] = useState<'local' | 'team'>('local');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isConfigModalOpen) {
      if (activeConfig) {
        setType(activeConfig.type || 'url');
        setUrl(activeConfig.url || '');
        setFilePath(activeConfig.filePath || '');
        setTitle(activeConfig.title || '');
        setAutoReload(Boolean(activeConfig.autoReload));
        setReloadIntervalSeconds(activeConfig.reloadIntervalSeconds || 60);
        setEnableBridge(activeConfig.enableBridge ?? true);
        setScope(configScope);
      } else {
        setType('url');
        setUrl('http://localhost:3000');
        setFilePath('');
        setTitle('');
        setAutoReload(false);
        setReloadIntervalSeconds(60);
        setEnableBridge(true);
        setScope('local');
      }
    }
  }, [isConfigModalOpen, activeConfig, configScope]);

  if (!isConfigModalOpen) return null;

  const handleSelectLocalFile = async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.selectFile) {
      try {
        const selected = await electronAPI.selectFile({
          title: t.dashboard.modal.fileLabel,
          defaultPath: rootPath || undefined,
          filters: [{ name: 'HTML Files', extensions: ['html', 'htm'] }],
        });
        if (selected) {
          setFilePath(selected);
        }
      } catch (e) {
        console.warn('Select file error:', e);
      }
    }
  };

  const handleTestOpen = () => {
    const targetUrl =
      type === 'url'
        ? url.trim()
        : `/api/workspace/dashboard-serve/${workspaceId}/index.html?root=${encodeURIComponent(filePath.trim())}`;
    if (targetUrl) {
      window.open(targetUrl, '_blank');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const config: WorkspaceDashboardConfig = {
        enabled: true,
        type,
        url: url.trim(),
        filePath: filePath.trim(),
        title: title.trim(),
        openMode: 'embedded',
        autoReload,
        reloadIntervalSeconds: Math.max(5, reloadIntervalSeconds),
        enableBridge,
      };

      await saveConfig(workspaceId, rootPath, config, scope);
      setNotification({
        id: Date.now(),
        title: t.dashboard.modal.saveSuccessToast,
        type: 'success',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    setIsSaving(true);
    try {
      await disableCustomDashboard(workspaceId, rootPath);
      closeConfigModal();
      setNotification({
        id: Date.now(),
        title: t.dashboard.modal.resetSuccessToast,
        type: 'info',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-theme-bg border border-theme-border rounded-xl shadow-2xl w-[620px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme-border bg-theme-sidebar/50">
          <div>
            <h2 className="text-base font-semibold text-theme-main">{t.dashboard.modal.title}</h2>
            <p className="text-xs text-theme-muted mt-0.5">{t.dashboard.modal.desc}</p>
          </div>
          <button
            onClick={closeConfigModal}
            className="p-1 rounded-md text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs">
          {/* 1. Type Switcher */}
          <div>
            <label className="block font-medium text-theme-main mb-2">{t.dashboard.modal.typeLabel}</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('url')}
                className={`flex items-center gap-2.5 p-3 rounded-lg border text-left transition-all ${
                  type === 'url'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-400 font-medium'
                    : 'border-theme-border bg-theme-sidebar/30 text-theme-muted hover:border-theme-hover'
                }`}
              >
                <Globe className="w-4 h-4 shrink-0" />
                <span>{t.dashboard.modal.typeUrl}</span>
              </button>

              <button
                type="button"
                onClick={() => setType('file')}
                className={`flex items-center gap-2.5 p-3 rounded-lg border text-left transition-all ${
                  type === 'file'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-400 font-medium'
                    : 'border-theme-border bg-theme-sidebar/30 text-theme-muted hover:border-theme-hover'
                }`}
              >
                <FileCode className="w-4 h-4 shrink-0" />
                <span>{t.dashboard.modal.typeFile}</span>
              </button>
            </div>
          </div>

          {/* 2. Source Input */}
          {type === 'url' ? (
            <div>
              <label className="block font-medium text-theme-main mb-1.5">{t.dashboard.modal.urlLabel}</label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t.dashboard.modal.urlPlaceholder}
                className="w-full px-3 py-2 bg-theme-sidebar border border-theme-border rounded-lg text-theme-main placeholder-theme-muted/50 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          ) : (
            <div>
              <label className="block font-medium text-theme-main mb-1.5">{t.dashboard.modal.fileLabel}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  placeholder={t.dashboard.modal.filePlaceholder}
                  className="flex-1 px-3 py-2 bg-theme-sidebar border border-theme-border rounded-lg text-theme-main placeholder-theme-muted/50 focus:outline-none focus:border-sky-500 transition-colors font-mono text-[11px]"
                />
                <button
                  type="button"
                  onClick={handleSelectLocalFile}
                  className="px-3 py-2 rounded-lg border border-theme-border bg-theme-hover text-theme-main hover:bg-theme-hover/80 flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>{t.dashboard.modal.browseFile}</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. Custom Title */}
          <div>
            <label className="block font-medium text-theme-main mb-1.5">{t.dashboard.modal.pageTitleLabel}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.dashboard.modal.pageTitlePlaceholder}
              className="w-full px-3 py-2 bg-theme-sidebar border border-theme-border rounded-lg text-theme-main placeholder-theme-muted/50 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {/* 4. Auto-Reload Options */}
          <div className="p-3 rounded-lg border border-theme-border/60 bg-theme-sidebar/20 space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="chk-autoreload" className="font-medium text-theme-main cursor-pointer">
                {t.dashboard.modal.autoReloadLabel}
              </label>
              <input
                id="chk-autoreload"
                type="checkbox"
                checked={autoReload}
                onChange={(e) => setAutoReload(e.target.checked)}
                className="w-4 h-4 rounded text-sky-500 focus:ring-0 cursor-pointer"
              />
            </div>
            {autoReload && (
              <div className="flex items-center gap-2 pt-1 border-t border-theme-border/40">
                <span className="text-theme-muted">{t.dashboard.modal.intervalLabel}:</span>
                <input
                  type="number"
                  min="5"
                  max="3600"
                  value={reloadIntervalSeconds}
                  onChange={(e) => setReloadIntervalSeconds(Number(e.target.value) || 60)}
                  className="w-20 px-2 py-1 bg-theme-sidebar border border-theme-border rounded text-center text-theme-main"
                />
                <span className="text-theme-muted">{t.dashboard.modal.secondsUnit}</span>
              </div>
            )}
          </div>

          {/* 5. Security & Bridge Toggle */}
          <div className="p-3 rounded-lg border border-theme-border/60 bg-theme-sidebar/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-theme-main">{t.dashboard.modal.enableBridgeLabel}</span>
              <input
                type="checkbox"
                checked={enableBridge}
                onChange={(e) => setEnableBridge(e.target.checked)}
                className="w-4 h-4 rounded text-sky-500 focus:ring-0 cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-theme-muted leading-relaxed">{t.dashboard.modal.enableBridgeDesc}</p>
            {type === 'url' && !url.includes('localhost') && !url.includes('127.0.0.1') && (
              <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed mt-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span>{t.dashboard.modal.securityWarning}</span>
              </div>
            )}
          </div>

          {/* 6. Scope Switcher */}
          <div>
            <label className="block font-medium text-theme-main mb-2">{t.dashboard.modal.scopeLabel}</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setScope('local')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  scope === 'local'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                    : 'border-theme-border bg-theme-sidebar/30 text-theme-muted hover:border-theme-hover'
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium mb-1">
                  <Laptop className="w-3.5 h-3.5" />
                  <span>{t.dashboard.modal.scopeLocal}</span>
                </div>
                <div className="text-[10px] text-theme-muted">{t.dashboard.modal.scopeLocalDesc}</div>
              </button>

              <button
                type="button"
                onClick={() => setScope('team')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  scope === 'team'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                    : 'border-theme-border bg-theme-sidebar/30 text-theme-muted hover:border-theme-hover'
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium mb-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>{t.dashboard.modal.scopeTeam}</span>
                </div>
                <div className="text-[10px] text-theme-muted">{t.dashboard.modal.scopeTeamDesc}</div>
              </button>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-theme-border bg-theme-sidebar/50">
          <div>
            {activeConfig?.enabled && (
              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme-border text-theme-muted hover:text-amber-400 hover:border-amber-400/40 transition-colors cursor-pointer text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.dashboard.modal.resetToDefault}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestOpen}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme-border text-theme-main hover:bg-theme-hover transition-colors text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t.dashboard.modal.testButton}</span>
            </button>

            <button
              type="button"
              onClick={closeConfigModal}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-lg border border-theme-border text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors text-xs"
            >
              {t.dashboard.modal.cancel}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-medium transition-colors cursor-pointer text-xs shadow-sm shadow-sky-500/20 disabled:opacity-50"
            >
              {isSaving ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{t.dashboard.modal.saveApply}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
