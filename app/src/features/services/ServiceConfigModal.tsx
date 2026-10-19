import React, { useState, useEffect } from 'react';
import { useServicesStore } from './useServicesStore';
import { SERVICE_PRESET_TEMPLATES } from './serviceTemplates';
import type { ServicePresetKey } from './types';
import { useTranslation } from '../../locales';
import {
  X,
  Folder,
  Layers,
  Terminal,
  Plus,
  Trash2,
  Sparkles,
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
  } = useServicesStore();

  const [name, setName] = useState('');
  const [cwd, setCwd] = useState('');
  const [winCommand, setWinCommand] = useState('');
  const [unixCommand, setUnixCommand] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ServicePresetKey>('custom');
  const [envPairs, setEnvPairs] = useState<Array<{ key: string; value: string }>>([]);

  useEffect(() => {
    if (editingService) {
      setName(editingService.name);
      setCwd(editingService.cwd || '');
      setWinCommand(editingService.winCommand || '');
      setUnixCommand(editingService.unixCommand || '');
      setSelectedTemplate('custom');
      if (editingService.env) {
        const pairs = Object.entries(editingService.env).map(([k, v]) => ({
          key: k,
          value: v,
        }));
        setEnvPairs(pairs);
      } else {
        setEnvPairs([]);
      }
    } else {
      // Default to nodeDev or custom
      setName('');
      setCwd('');
      const defaultTmpl = SERVICE_PRESET_TEMPLATES.find((t) => t.key === 'nodeDev');
      if (defaultTmpl) {
        setSelectedTemplate('nodeDev');
        setWinCommand(defaultTmpl.winCommand);
        setUnixCommand(defaultTmpl.unixCommand);
        setName(t.services.templates.nodeDev);
      } else {
        setSelectedTemplate('custom');
        setWinCommand('');
        setUnixCommand('');
      }
      setEnvPairs([]);
    }
  }, [editingService, isConfigModalOpen, t]);

  if (!isConfigModalOpen) return null;

  const handleSelectTemplate = (templateKey: ServicePresetKey) => {
    setSelectedTemplate(templateKey);
    const tmpl = SERVICE_PRESET_TEMPLATES.find((item) => item.key === templateKey);
    if (!tmpl) return;

    if (templateKey !== 'custom') {
      setWinCommand(tmpl.winCommand);
      setUnixCommand(tmpl.unixCommand);
      if (!name || SERVICE_PRESET_TEMPLATES.some((x) => x.defaultName === name)) {
        const localizedName = t.services.templates[templateKey] || tmpl.defaultName;
        setName(localizedName);
      }
    }
  };

  const handleBrowseFolder = async () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.selectFolder) {
      const selected = await (window as any).electronAPI.selectFolder(projectPath);
      if (selected) {
        setCwd(selected);
      }
    }
  };

  const handleAddEnv = () => {
    setEnvPairs([...envPairs, { key: '', value: '' }]);
  };

  const handleRemoveEnv = (index: number) => {
    setEnvPairs(envPairs.filter((_, i) => i !== index));
  };

  const handleEnvChange = (index: number, field: 'key' | 'value', val: string) => {
    setEnvPairs(
      envPairs.map((p, i) => (i === index ? { ...p, [field]: val } : p))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    // Convert env pairs to Record
    const envObj: Record<string, string> = {};
    for (const pair of envPairs) {
      const k = pair.key.trim();
      if (k) {
        envObj[k] = pair.value.trim();
      }
    }

    if (editingService) {
      updateService(projectId, editingService.id, {
        name: trimmedName,
        cwd: cwd.trim(),
        winCommand: winCommand.trim(),
        unixCommand: unixCommand.trim(),
        env: Object.keys(envObj).length > 0 ? envObj : undefined,
      });
    } else {
      addService(projectId, {
        name: trimmedName,
        cwd: cwd.trim(),
        winCommand: winCommand.trim(),
        unixCommand: unixCommand.trim(),
        env: Object.keys(envObj).length > 0 ? envObj : undefined,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-xl bg-theme-sidebar border border-theme-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-theme-border flex items-center justify-between bg-theme-app/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-theme-main">
              {editingService ? t.services.editService : t.services.newService}
            </h2>
          </div>
          <button
            onClick={closeConfigModal}
            className="p-1 rounded-md text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors cursor-pointer"
            title={t.common.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Preset Template Selector */}
          <div>
            <label className="block text-theme-muted font-medium mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.services.fields.template}</span>
              <span className="text-[10px] text-theme-muted/70 font-normal">
                ({t.services.fields.selectTemplateHint})
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {SERVICE_PRESET_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplate === tmpl.key;
                const label = t.services.templates[tmpl.key] || tmpl.defaultName;
                return (
                  <button
                    type="button"
                    key={tmpl.key}
                    onClick={() => handleSelectTemplate(tmpl.key)}
                    className={`px-2.5 py-1.5 rounded-lg border text-left transition-all truncate cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/15 border-sky-500/60 text-sky-400 font-medium'
                        : 'bg-theme-app/40 border-theme-border/60 text-theme-muted hover:border-theme-border hover:text-theme-main'
                    }`}
                    title={label}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service Name */}
          <div>
            <label className="block text-theme-main font-medium mb-1">
              {t.services.fields.name} <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.services.fields.namePlaceholder}
              className="w-full px-3 py-2 rounded-lg bg-theme-app border border-theme-border focus:border-sky-500 focus:outline-none text-theme-main placeholder:text-theme-muted/50"
            />
          </div>

          {/* Working Directory (Cwd) */}
          <div>
            <label className="block text-theme-main font-medium mb-1">
              {t.services.fields.cwd}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={cwd}
                onChange={(e) => setCwd(e.target.value)}
                placeholder={t.services.fields.cwdPlaceholder}
                className="flex-1 px-3 py-2 rounded-lg bg-theme-app border border-theme-border focus:border-sky-500 focus:outline-none text-theme-main placeholder:text-theme-muted/50 font-mono"
              />
              <button
                type="button"
                onClick={handleBrowseFolder}
                className="px-3 py-2 rounded-lg bg-theme-hover hover:bg-theme-border border border-theme-border text-theme-main transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                title={t.services.fields.selectFolderTooltip}
              >
                <Folder className="w-3.5 h-3.5 text-sky-400" />
                <span>{t.common.select}</span>
              </button>
            </div>
          </div>

          {/* Windows Command */}
          <div>
            <label className="block text-theme-main font-medium mb-1 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              <span>{t.services.fields.winCommand}</span>
            </label>
            <input
              type="text"
              value={winCommand}
              onChange={(e) => setWinCommand(e.target.value)}
              placeholder={t.services.fields.winPlaceholder}
              className="w-full px-3 py-2 rounded-lg bg-theme-app border border-theme-border focus:border-sky-500 focus:outline-none text-theme-main placeholder:text-theme-muted/50 font-mono text-[11px]"
            />
          </div>

          {/* macOS / Linux Command */}
          <div>
            <label className="block text-theme-main font-medium mb-1 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.services.fields.unixCommand}</span>
            </label>
            <input
              type="text"
              value={unixCommand}
              onChange={(e) => setUnixCommand(e.target.value)}
              placeholder={t.services.fields.unixPlaceholder}
              className="w-full px-3 py-2 rounded-lg bg-theme-app border border-theme-border focus:border-sky-500 focus:outline-none text-theme-main placeholder:text-theme-muted/50 font-mono text-[11px]"
            />
          </div>

          {/* Custom Environment Variables */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-theme-main font-medium">
                {t.services.fields.env}
              </label>
              <button
                type="button"
                onClick={handleAddEnv}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.services.fields.addEnv}</span>
              </button>
            </div>

            {envPairs.length > 0 ? (
              <div className="space-y-1.5 bg-theme-app/30 p-2.5 rounded-lg border border-theme-border/50">
                {envPairs.map((pair, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pair.key}
                      onChange={(e) => handleEnvChange(idx, 'key', e.target.value)}
                      placeholder={t.services.fields.envKeyPlaceholder}
                      className="w-2/5 px-2.5 py-1.5 rounded-md bg-theme-app border border-theme-border focus:border-sky-500 focus:outline-none text-theme-main font-mono text-[11px]"
                    />
                    <span className="text-theme-muted">=</span>
                    <input
                      type="text"
                      value={pair.value}
                      onChange={(e) => handleEnvChange(idx, 'value', e.target.value)}
                      placeholder={t.services.fields.envValPlaceholder}
                      className="flex-1 px-2.5 py-1.5 rounded-md bg-theme-app border border-theme-border focus:border-sky-500 focus:outline-none text-theme-main font-mono text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveEnv(idx)}
                      className="p-1.5 text-theme-muted hover:text-rose-400 transition-colors cursor-pointer"
                      title={t.common.delete}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-theme-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={closeConfigModal}
              className="px-4 py-2 rounded-lg bg-theme-hover hover:bg-theme-border text-theme-main transition-colors cursor-pointer font-medium"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-medium shadow-sm transition-colors cursor-pointer"
            >
              {t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
