import React, { useState, useEffect } from 'react';
import { useServicesStore } from './useServicesStore';
import type { DiscoveredScriptGroup } from './types';
import { useTranslation } from '../../locales';
import {
  X,
  Folder,
  FileCode2,
  Terminal,
  Plus,
  Trash2,
  Sparkles,
  Play,
  Square,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ServiceConfigModalProps {
  projectId: string;
  projectPath: string;
}

export const ServiceConfigModal: React.FC<ServiceConfigModalProps> = ({
  projectId,
  projectPath,
}) => {
  const { t } = useTranslation();
  const {
    isConfigModalOpen,
    editingService,
    closeConfigModal,
    addService,
    updateService,
    scanProjectScripts,
  } = useServicesStore();

  const [name, setName] = useState('');
  const [cwd, setCwd] = useState('');
  const [winCommand, setWinCommand] = useState('');
  const [winStopScript, setWinStopScript] = useState('');
  const [unixCommand, setUnixCommand] = useState('');
  const [unixStopScript, setUnixStopScript] = useState('');
  const [envPairs, setEnvPairs] = useState<Array<{ key: string; value: string }>>([]);
  const [isEnvExpanded, setIsEnvExpanded] = useState(false);

  // Discovered scripts in the project
  const [discoveredScripts, setDiscoveredScripts] = useState<DiscoveredScriptGroup[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!isConfigModalOpen) return;

    if (editingService) {
      setName(editingService.name);
      setCwd(editingService.cwd || '');
      setWinCommand(editingService.winCommand || '');
      setWinStopScript(editingService.winStopScript || '');
      setUnixCommand(editingService.unixCommand || '');
      setUnixStopScript(editingService.unixStopScript || '');
      if (editingService.env) {
        const pairs = Object.entries(editingService.env).map(([k, v]) => ({
          key: k,
          value: v,
        }));
        setEnvPairs(pairs);
        setIsEnvExpanded(pairs.length > 0);
      } else {
        setEnvPairs([]);
        setIsEnvExpanded(false);
      }
    } else {
      // New service creation: reset form
      setName('');
      setCwd('');
      setWinCommand('');
      setWinStopScript('');
      setUnixCommand('');
      setUnixStopScript('');
      setEnvPairs([]);
      setIsEnvExpanded(false);
    }

    // Auto-scan project scripts when opening modal
    if (projectId) {
      setIsScanning(true);
      scanProjectScripts(projectId)
        .then((groups) => {
          setDiscoveredScripts(groups);
        })
        .finally(() => {
          setIsScanning(false);
        });
    }
  }, [editingService, isConfigModalOpen, projectId, scanProjectScripts]);

  if (!isConfigModalOpen) return null;

  // Handle clicking a detected project script pill
  const handleApplyScriptGroup = (group: DiscoveredScriptGroup) => {
    setName(group.name);
    if (group.winStartScript) setWinCommand(group.winStartScript);
    if (group.winStopScript) setWinStopScript(group.winStopScript);
    if (group.unixStartScript) setUnixCommand(group.unixStartScript);
    if (group.unixStopScript) setUnixStopScript(group.unixStopScript);
    if (group.cwd) setCwd(group.cwd);
  };

  const toRelativePath = (fullPath: string) => {
    if (!fullPath || !projectPath) return fullPath;
    const normFull = fullPath.replace(/\//g, '\\');
    const normRoot = projectPath.replace(/\//g, '\\');
    if (normFull.toLowerCase().startsWith(normRoot.toLowerCase())) {
      const rel = normFull.slice(normRoot.length).replace(/^[/\\]+/, '');
      return rel;
    }
    return fullPath;
  };

  const handleBrowseFile = async (
    field: 'winCommand' | 'winStopScript' | 'unixCommand' | 'unixStopScript'
  ) => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.selectFile) {
      const isWindows = field.startsWith('win');
      let dialogTitle = t.services.fields.browseWinStartTooltip;
      if (field === 'winStopScript') dialogTitle = t.services.fields.browseWinStopTooltip;
      else if (field === 'unixCommand') dialogTitle = t.services.fields.browseUnixStartTooltip;
      else if (field === 'unixStopScript') dialogTitle = t.services.fields.browseUnixStopTooltip;

      const selected = await (window as any).electronAPI.selectFile({
        title: dialogTitle,
        defaultPath: projectPath,
        filters: isWindows
          ? [
              { name: 'Scripts / Executables (*.bat, *.cmd, *.ps1, *.exe)', extensions: ['bat', 'cmd', 'ps1', 'exe'] },
              { name: 'All Files (*.*)', extensions: ['*'] },
            ]
          : [
              { name: 'Shell Scripts (*.sh, *.bash)', extensions: ['sh', 'bash', 'zsh', 'command'] },
              { name: 'All Files (*.*)', extensions: ['*'] },
            ],
      });
      if (selected) {
        const cleanPath = toRelativePath(selected);
        if (field === 'winCommand') setWinCommand(cleanPath);
        else if (field === 'winStopScript') setWinStopScript(cleanPath);
        else if (field === 'unixCommand') setUnixCommand(cleanPath);
        else if (field === 'unixStopScript') setUnixStopScript(cleanPath);

        // Auto-fill service name if empty
        if (!name) {
          const base = cleanPath.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, '') || '';
          const cleanName = base.replace(/^(start|run|launch|dev)[-_]?/i, '') || base;
          setName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
        }
      }
    }
  };

  const handleBrowseFolder = async () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.selectFolder) {
      const selected = await (window as any).electronAPI.selectFolder(projectPath);
      if (selected) {
        setCwd(toRelativePath(selected));
      }
    }
  };

  const handleAddEnv = () => {
    setEnvPairs([...envPairs, { key: '', value: '' }]);
    setIsEnvExpanded(true);
  };

  const handleRemoveEnv = (index: number) => {
    setEnvPairs(envPairs.filter((_, i) => i !== index));
  };

  const handleEnvChange = (index: number, key: string, value: string) => {
    const updated = [...envPairs];
    updated[index] = { key, value };
    setEnvPairs(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const envObj: Record<string, string> = {};
    for (const pair of envPairs) {
      const k = pair.key.trim();
      if (k) {
        envObj[k] = pair.value;
      }
    }

    if (editingService) {
      updateService(projectId, editingService.id, {
        name: trimmedName,
        cwd: cwd.trim(),
        winCommand: winCommand.trim(),
        winStopScript: winStopScript.trim() || undefined,
        unixCommand: unixCommand.trim(),
        unixStopScript: unixStopScript.trim() || undefined,
        env: Object.keys(envObj).length > 0 ? envObj : undefined,
      });
    } else {
      addService(projectId, {
        name: trimmedName,
        cwd: cwd.trim(),
        winCommand: winCommand.trim(),
        winStopScript: winStopScript.trim() || undefined,
        unixCommand: unixCommand.trim(),
        unixStopScript: unixStopScript.trim() || undefined,
        env: Object.keys(envObj).length > 0 ? envObj : undefined,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div
        className="w-full max-w-2xl bg-theme-sidebar border border-theme-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-theme-border flex items-center justify-between bg-theme-sidebar/95 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-theme-main">
                {editingService ? t.services.editService : t.services.newService}
              </h2>
            </div>
          </div>
          <button
            onClick={closeConfigModal}
            className="p-1 rounded-lg text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Quick Select Detected Scripts from Project */}
          {discoveredScripts.length > 0 && !editingService && (
            <div className="p-3.5 rounded-xl bg-sky-500/8 border border-sky-500/25 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t.services.detectedScriptsTitle}</span>
                <span className="text-[11px] font-normal text-sky-400/80">
                  ({t.services.fields.selectScriptHint})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {discoveredScripts.map((group) => {
                  const displayScript = group.winStartScript || group.unixStartScript || '';
                  const hasStop = Boolean(group.winStopScript || group.unixStopScript);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => handleApplyScriptGroup(group)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-theme-app/80 hover:bg-sky-500/20 text-theme-main hover:text-sky-300 border border-theme-border hover:border-sky-500/40 transition-colors cursor-pointer shadow-2xs"
                      title={hasStop ? `启动: ${displayScript} | 停止: ${group.winStopScript || group.unixStopScript}` : displayScript}
                    >
                      <Terminal className="w-3 h-3 text-sky-400 shrink-0" />
                      <span className="font-sans font-medium text-sky-400">{group.name}</span>
                      <span className="text-[11px] text-theme-muted truncate max-w-[200px]">
                        {displayScript}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Service Name */}
          <div>
            <label className="block text-xs font-medium text-theme-main mb-1.5">
              {t.services.fields.name} <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.services.fields.namePlaceholder}
              className="w-full px-3 py-2 text-xs rounded-lg bg-theme-app border border-theme-border text-theme-main placeholder-theme-muted/50 focus:outline-hidden focus:border-sky-500 transition-colors"
            />
          </div>

          {/* Working Directory (Cwd) */}
          <div>
            <label className="block text-xs font-medium text-theme-main mb-1.5">
              {t.services.fields.cwd}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={cwd}
                onChange={(e) => setCwd(e.target.value)}
                placeholder={t.services.fields.cwdPlaceholder}
                className="flex-1 px-3 py-2 text-xs rounded-lg bg-theme-app border border-theme-border text-theme-main font-mono placeholder-theme-muted/50 focus:outline-hidden focus:border-sky-500 transition-colors"
              />
              <button
                type="button"
                onClick={handleBrowseFolder}
                className="px-3 py-2 rounded-lg bg-theme-hover hover:bg-theme-border/60 text-theme-main text-xs font-medium flex items-center gap-1.5 border border-theme-border transition-colors cursor-pointer shrink-0"
                title={t.services.fields.selectFolderTooltip}
              >
                <Folder className="w-3.5 h-3.5 text-sky-400" />
                <span>{t.services.browseFolder}</span>
              </button>
            </div>
          </div>

          {/* Windows Configuration Section */}
          <div className="p-3.5 rounded-xl bg-theme-app/40 border border-theme-border/80 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-theme-main">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <span>{t.services.fields.winSectionTitle}</span>
            </div>

            {/* Windows Start Command / Script */}
            <div>
              <label className="block text-[11px] font-medium text-theme-muted mb-1">
                {t.services.fields.winCommand} <span className="text-rose-400">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-emerald-400 font-mono text-xs">
                    <Play className="w-3 h-3 fill-current" />
                  </div>
                  <input
                    type="text"
                    required
                    value={winCommand}
                    onChange={(e) => setWinCommand(e.target.value)}
                    placeholder={t.services.fields.winPlaceholder}
                    className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg bg-theme-app border border-theme-border text-theme-main font-mono placeholder-theme-muted/50 focus:outline-hidden focus:border-sky-500 transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleBrowseFile('winCommand')}
                  className="px-2.5 py-1.5 rounded-lg bg-theme-hover hover:bg-theme-border/60 text-theme-main text-xs font-medium flex items-center gap-1.5 border border-theme-border transition-colors cursor-pointer shrink-0"
                  title={t.services.fields.browseWinStartTooltip}
                >
                  <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t.services.browseFile}</span>
                </button>
              </div>
            </div>

            {/* Windows Stop Script (Optional) */}
            <div>
              <label className="block text-[11px] font-medium text-theme-muted mb-1">
                {t.services.fields.winStopScript}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-rose-400 font-mono text-xs">
                    <Square className="w-3 h-3 fill-current" />
                  </div>
                  <input
                    type="text"
                    value={winStopScript}
                    onChange={(e) => setWinStopScript(e.target.value)}
                    placeholder={t.services.fields.winStopScriptPlaceholder}
                    className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg bg-theme-app border border-theme-border text-theme-main font-mono placeholder-theme-muted/50 focus:outline-hidden focus:border-sky-500 transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleBrowseFile('winStopScript')}
                  className="px-2.5 py-1.5 rounded-lg bg-theme-hover hover:bg-theme-border/60 text-theme-main text-xs font-medium flex items-center gap-1.5 border border-theme-border transition-colors cursor-pointer shrink-0"
                  title={t.services.fields.browseWinStopTooltip}
                >
                  <FileCode2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>{t.services.browseFile}</span>
                </button>
              </div>
            </div>
          </div>

          {/* macOS / Linux Configuration Section */}
          <div className="p-3.5 rounded-xl bg-theme-app/40 border border-theme-border/80 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-theme-main">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{t.services.fields.unixSectionTitle}</span>
            </div>

            {/* Unix Start Command / Script */}
            <div>
              <label className="block text-[11px] font-medium text-theme-muted mb-1">
                {t.services.fields.unixCommand}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-emerald-400 font-mono text-xs">
                    <Play className="w-3 h-3 fill-current" />
                  </div>
                  <input
                    type="text"
                    value={unixCommand}
                    onChange={(e) => setUnixCommand(e.target.value)}
                    placeholder={t.services.fields.unixPlaceholder}
                    className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg bg-theme-app border border-theme-border text-theme-main font-mono placeholder-theme-muted/50 focus:outline-hidden focus:border-sky-500 transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleBrowseFile('unixCommand')}
                  className="px-2.5 py-1.5 rounded-lg bg-theme-hover hover:bg-theme-border/60 text-theme-main text-xs font-medium flex items-center gap-1.5 border border-theme-border transition-colors cursor-pointer shrink-0"
                  title={t.services.fields.browseUnixStartTooltip}
                >
                  <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t.services.browseFile}</span>
                </button>
              </div>
            </div>

            {/* Unix Stop Script (Optional) */}
            <div>
              <label className="block text-[11px] font-medium text-theme-muted mb-1">
                {t.services.fields.unixStopScript}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-rose-400 font-mono text-xs">
                    <Square className="w-3 h-3 fill-current" />
                  </div>
                  <input
                    type="text"
                    value={unixStopScript}
                    onChange={(e) => setUnixStopScript(e.target.value)}
                    placeholder={t.services.fields.unixStopScriptPlaceholder}
                    className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg bg-theme-app border border-theme-border text-theme-main font-mono placeholder-theme-muted/50 focus:outline-hidden focus:border-sky-500 transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleBrowseFile('unixStopScript')}
                  className="px-2.5 py-1.5 rounded-lg bg-theme-hover hover:bg-theme-border/60 text-theme-main text-xs font-medium flex items-center gap-1.5 border border-theme-border transition-colors cursor-pointer shrink-0"
                  title={t.services.fields.browseUnixStopTooltip}
                >
                  <FileCode2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>{t.services.browseFile}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Environment Variables (Collapsible) */}
          <div className="border border-theme-border/70 rounded-xl overflow-hidden bg-theme-app/20">
            <button
              type="button"
              onClick={() => setIsEnvExpanded(!isEnvExpanded)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-theme-main hover:bg-theme-hover/50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <span>{t.services.fields.env}</span>
                {envPairs.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/15 text-sky-400 font-mono">
                    {envPairs.length}
                  </span>
                )}
              </span>
              {isEnvExpanded ? <ChevronUp className="w-3.5 h-3.5 text-theme-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-theme-muted" />}
            </button>

            {isEnvExpanded && (
              <div className="p-3 border-t border-theme-border/60 space-y-2">
                {envPairs.map((pair, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pair.key}
                      onChange={(e) => handleEnvChange(idx, e.target.value, pair.value)}
                      placeholder={t.services.fields.envKeyPlaceholder}
                      className="w-1/3 px-2.5 py-1 text-xs rounded bg-theme-app border border-theme-border text-theme-main font-mono placeholder-theme-muted/50 focus:outline-hidden focus:border-sky-500"
                    />
                    <span className="text-theme-muted text-xs">=</span>
                    <input
                      type="text"
                      value={pair.value}
                      onChange={(e) => handleEnvChange(idx, pair.key, e.target.value)}
                      placeholder={t.services.fields.envValPlaceholder}
                      className="flex-1 px-2.5 py-1 text-xs rounded bg-theme-app border border-theme-border text-theme-main font-mono placeholder-theme-muted/50 focus:outline-hidden focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveEnv(idx)}
                      className="p-1 rounded text-theme-muted hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddEnv}
                  className="mt-1 text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Plus className="w-3 h-3" />
                  <span>{t.services.fields.addEnv}</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={closeConfigModal}
              className="px-4 py-2 rounded-lg text-xs font-medium text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors cursor-pointer"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-medium bg-sky-500 hover:bg-sky-400 text-white shadow-sm transition-colors cursor-pointer"
            >
              {t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
