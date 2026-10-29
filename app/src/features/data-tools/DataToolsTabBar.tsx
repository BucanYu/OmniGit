import React, { useState, useRef, useEffect } from 'react';
import { useDataToolsStore } from './useDataToolsStore';
import { FORMAT_METAS } from './defaultSamples';
import type { DataFormat } from './types';
import { Plus, X, Columns2, Edit2, Copy, Check } from 'lucide-react';
import { useTranslation } from '../../locales';

export const DataToolsTabBar: React.FC = () => {
  const { t } = useTranslation();
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    addTab,
    closeTab,
    renameTab,
    duplicateTab,
    splitCompareEnabled,
    setSplitCompareEnabled,
    secondaryTabId,
    setSecondaryTabId,
  } = useDataToolsStore();

  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const addBtnRef = useRef<HTMLButtonElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  // Close add menu on outside click or escape
  useEffect(() => {
    if (!isAddMenuOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (addMenuRef.current?.contains(target)) return;
      if (addBtnRef.current?.contains(target)) return;
      setIsAddMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAddMenuOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddMenuOpen]);

  const handleStartRename = (tabId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTabId(tabId);
    setEditTitle(currentTitle);
  };

  const handleFinishRename = (tabId: string) => {
    if (editingTabId === tabId) {
      renameTab(tabId, editTitle);
      setEditingTabId(null);
    }
  };

  const handleSelectFormat = (fmt: DataFormat) => {
    setIsAddMenuOpen(false);
    addTab(fmt);
  };

  const getFormatBadgeColor = (format: DataFormat) => {
    switch (format) {
      case 'json':
        return 'text-sky-500 bg-sky-500/10 border-sky-500/20';
      case 'yaml':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'xml':
        return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
      case 'sql':
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'jwt':
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'url':
        return 'text-teal-500 bg-teal-500/10 border-teal-500/20';
      case 'base64':
      default:
        return 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20';
    }
  };

  return (
    <div className="h-9 px-2 bg-theme-sidebar/95 border-b border-theme-border flex items-center justify-between gap-2 shrink-0 select-none overflow-x-auto no-scrollbar relative">
      {/* Left: Tab list */}
      <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar py-0.5">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isSecondary = splitCompareEnabled && tab.id === secondaryTabId;
          const meta = FORMAT_METAS.find((m) => m.id === tab.format) || FORMAT_METAS[0];

          return (
            <div
              key={tab.id}
              data-testid={`data-tools-tab-${tab.id}`}
              onClick={() => setActiveTabId(tab.id)}
              onDoubleClick={(e) => handleStartRename(tab.id, tab.title, e)}
              className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer border shrink-0 ${
                isActive
                  ? 'bg-theme-card text-theme-main border-sky-500/50 shadow-2xs font-medium'
                  : isSecondary
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                  : 'bg-transparent text-theme-muted hover:text-theme-main hover:bg-theme-hover/60 border-transparent'
              }`}
            >
              {/* Format Badge */}
              <span
                className={`font-mono text-[9px] px-1 py-0.2 rounded border font-semibold ${getFormatBadgeColor(
                  tab.format
                )}`}
              >
                {meta.badge}
              </span>

              {/* Title / Inline edit input */}
              {editingTabId === tab.id ? (
                <input
                  type="text"
                  value={editTitle}
                  autoFocus
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => handleFinishRename(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishRename(tab.id);
                    if (e.key === 'Escape') setEditingTabId(null);
                  }}
                  className="bg-theme-app text-theme-main text-xs px-1 py-0.5 rounded border border-sky-500 outline-none w-24"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate max-w-[130px]" title={tab.title}>
                  {tab.title}
                </span>
              )}

              {/* Duplicate button (on hover) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateTab(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-theme-dim hover:text-theme-main transition-opacity cursor-pointer rounded"
                title={t.dataTools?.duplicateWindow || '复制窗口'}
              >
                <Copy className="w-2.5 h-2.5" />
              </button>

              {/* Close Tab Button */}
              {tabs.length > 1 && (
                <button
                  type="button"
                  data-testid={`data-tools-close-tab-${tab.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="p-0.5 rounded hover:bg-rose-500/20 text-theme-dim hover:text-rose-500 transition-colors cursor-pointer"
                  title={t.dataTools?.closeWindow || '关闭窗口'}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Add Tab Button with Format Dropdown */}
        <div className="relative">
          <button
            ref={addBtnRef}
            type="button"
            data-testid="data-tools-add-tab-btn"
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-theme-muted hover:text-theme-main hover:bg-theme-hover border border-dashed border-theme-border/80 transition-colors cursor-pointer"
            title={t.dataTools?.newWindow || '新增窗口 / 标签页 (选择格式)'}
          >
            <Plus className="w-3.5 h-3.5 text-sky-500" />
            <span className="text-[11px] font-sans">{t.dataTools?.newWindow || '新增窗口'}</span>
          </button>

          {/* Format Picker Dropdown */}
          {isAddMenuOpen && (
            <div
              ref={addMenuRef}
              data-testid="data-tools-format-dropdown"
              className="absolute left-0 top-full mt-1.5 w-48 bg-theme-sidebar/95 backdrop-blur-md rounded-lg shadow-xl border border-theme-border/90 py-1.5 z-50 text-xs"
            >
              <div className="px-2.5 py-1 text-[10px] font-semibold text-theme-dim uppercase tracking-wider border-b border-theme-border/40 mb-1">
                {t.dataTools?.selectFormatForNewWindow || '选择新窗口数据格式'}
              </div>
              {FORMAT_METAS.map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  data-testid={`data-tools-format-opt-${fmt.id}`}
                  onClick={() => handleSelectFormat(fmt.id)}
                  className="w-full px-2.5 py-1.5 text-left text-theme-main hover:bg-theme-hover flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[10px] px-1 py-0.2 rounded border font-semibold ${getFormatBadgeColor(
                        fmt.id
                      )}`}
                    >
                      {fmt.badge}
                    </span>
                    <span className="font-medium">{fmt.label}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Compare mode toggle & Secondary tab picker */}
      <div className="flex items-center gap-2 shrink-0">
        {splitCompareEnabled && tabs.length > 1 && (
          <div className="flex items-center gap-1.5 text-[11px] text-theme-muted">
            <span className="text-theme-dim">{t.dataTools?.selectSecondaryWindow || '对比窗口'}:</span>
            <select
              value={secondaryTabId || ''}
              onChange={(e) => setSecondaryTabId(e.target.value)}
              className="bg-theme-card text-theme-main text-xs py-0.5 px-2 rounded border border-theme-border focus:outline-none cursor-pointer"
            >
              {tabs
                .filter((t) => t.id !== activeTabId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.format.toUpperCase()}] {t.title}
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Side-by-Side Split Compare Toggle */}
        <button
          type="button"
          data-testid="data-tools-split-compare-btn"
          onClick={() => setSplitCompareEnabled(!splitCompareEnabled)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer shadow-2xs ${
            splitCompareEnabled
              ? 'bg-sky-500/15 border-sky-500/40 text-sky-600 dark:text-sky-400 font-semibold'
              : 'border-theme-border/80 bg-theme-card text-theme-muted hover:text-theme-main hover:bg-theme-hover'
          }`}
          title={
            splitCompareEnabled
              ? t.dataTools?.singleWindow || '切换为单窗口模式'
              : t.dataTools?.splitCompare || '开启双窗口并排对比模式'
          }
        >
          <Columns2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {splitCompareEnabled
              ? t.dataTools?.splitCompareActive || '双屏对比中'
              : t.dataTools?.splitCompare || '双屏对比'}
          </span>
        </button>
      </div>
    </div>
  );
};
