import React, { useState, useRef, useEffect } from 'react';
import { useDataToolsStore } from './useDataToolsStore';
import { FORMAT_METAS } from './defaultSamples';
import type { DataFormat } from './types';
import { Plus, X, Columns2, Copy, ChevronDown, Check } from 'lucide-react';
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
  const [addMenuPos, setAddMenuPos] = useState({ top: 0, left: 0 });
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [copiedTabId, setCopiedTabId] = useState<string | null>(null);

  const addBtnRef = useRef<HTMLButtonElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  // Position format dropdown relative to the "+ New Window" button
  const toggleAddMenu = () => {
    if (!isAddMenuOpen && addBtnRef.current) {
      const rect = addBtnRef.current.getBoundingClientRect();
      const menuWidth = 270;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 12));
      setAddMenuPos({
        top: rect.bottom + 6,
        left,
      });
    }
    setIsAddMenuOpen(!isAddMenuOpen);
  };

  // Close add menu on outside click, window resize or escape
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
    const handleScrollOrResize = () => {
      setIsAddMenuOpen(false);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isAddMenuOpen]);

  const handleStartRename = (tabId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTabId(tabId);
    setEditTitle(currentTitle);
  };

  const handleFinishRename = (tabId: string) => {
    if (editingTabId === tabId) {
      const trimmed = editTitle.trim();
      if (trimmed) renameTab(tabId, trimmed);
      setEditingTabId(null);
    }
  };

  const handleSelectFormat = (fmt: DataFormat) => {
    setIsAddMenuOpen(false);
    addTab(fmt);
  };

  const handleDuplicate = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateTab(tabId);
    setCopiedTabId(tabId);
    setTimeout(() => setCopiedTabId(null), 1200);
  };

  const getFormatBadgeStyle = (format: DataFormat, isActive: boolean) => {
    switch (format) {
      case 'json':
        return isActive
          ? 'text-sky-500 bg-sky-500/15 border-sky-500/30'
          : 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20';
      case 'yaml':
        return isActive
          ? 'text-amber-500 bg-amber-500/15 border-amber-500/30'
          : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'xml':
        return isActive
          ? 'text-purple-500 bg-purple-500/15 border-purple-500/30'
          : 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'sql':
        return isActive
          ? 'text-emerald-500 bg-emerald-500/15 border-emerald-500/30'
          : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'jwt':
        return isActive
          ? 'text-blue-500 bg-blue-500/15 border-blue-500/30'
          : 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'url':
        return isActive
          ? 'text-teal-500 bg-teal-500/15 border-teal-500/30'
          : 'text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/20';
      case 'timestamp':
        return isActive
          ? 'text-orange-500 bg-orange-500/15 border-orange-500/30'
          : 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'hash':
        return isActive
          ? 'text-pink-500 bg-pink-500/15 border-pink-500/30'
          : 'text-pink-600 dark:text-pink-400 bg-pink-500/10 border-pink-500/20';
      case 'regex':
        return isActive
          ? 'text-cyan-500 bg-cyan-500/15 border-cyan-500/30'
          : 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
      case 'base64':
      default:
        return isActive
          ? 'text-indigo-500 bg-indigo-500/15 border-indigo-500/30'
          : 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
    }
  };

  return (
    <>
      {/* TabBar Header Container */}
      <div className="h-10 px-3 bg-theme-sidebar/90 dark:bg-zinc-950/70 border-b border-theme-border flex items-center justify-between gap-3 shrink-0 select-none relative">
        {/* Left: Tab list with horizontal scroll */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
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
                title={`${tab.title} (${tab.format.toUpperCase()}) - 双击可重命名`}
                className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer border shrink-0 ${
                  isActive
                    ? 'bg-theme-card text-theme-main border-theme-border/90 shadow-sm font-semibold'
                    : isSecondary
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 font-medium'
                    : 'bg-theme-card/30 text-theme-muted hover:text-theme-main hover:bg-theme-hover/70 border-theme-border/30'
                }`}
              >
                {/* Active Accent Indicator bar at top */}
                {isActive && (
                  <span className="absolute -top-[1px] left-2 right-2 h-[2px] bg-sky-500 rounded-full" />
                )}
                {isSecondary && (
                  <span className="absolute -top-[1px] left-2 right-2 h-[2px] bg-emerald-500 rounded-full" />
                )}

                {/* Format Badge */}
                <span
                  className={`font-mono text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase transition-colors ${getFormatBadgeStyle(
                    tab.format,
                    isActive
                  )}`}
                >
                  {meta.badge}
                </span>

                {/* Title / Inline Rename Input */}
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
                    className="bg-theme-app text-theme-main text-xs px-1.5 py-0.5 rounded border border-sky-500 outline-none w-28 ring-1 ring-sky-500/40"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="truncate max-w-[140px] tracking-tight">{tab.title}</span>
                )}

                {/* Secondary compare indicator tag */}
                {isSecondary && !isActive && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono scale-90">
                    对比
                  </span>
                )}

                {/* Duplicate / Clone Button */}
                <button
                  type="button"
                  onClick={(e) => handleDuplicate(tab.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-theme-dim hover:text-theme-main hover:bg-theme-hover rounded transition-opacity cursor-pointer"
                  title={t.dataTools?.duplicateWindow || '克隆副本'}
                >
                  {copiedTabId === tab.id ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
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
                    className="p-0.5 rounded-md hover:bg-rose-500/20 text-theme-dim hover:text-rose-500 transition-colors cursor-pointer"
                    title={t.dataTools?.closeWindow || '关闭此窗口'}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Tab Button */}
          <button
            ref={addBtnRef}
            type="button"
            data-testid="data-tools-add-tab-btn"
            onClick={toggleAddMenu}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-dashed transition-all cursor-pointer shrink-0 shadow-2xs ${
              isAddMenuOpen
                ? 'bg-sky-500/15 border-sky-500 text-sky-600 dark:text-sky-400 font-semibold ring-2 ring-sky-500/20'
                : 'text-theme-muted hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-500/10 border-theme-border/80 hover:border-sky-500/40 bg-theme-card/40'
            }`}
            title={t.dataTools?.newWindow || '新增窗口 (选择格式)'}
          >
            <Plus className="w-3.5 h-3.5 text-sky-500" />
            <span className="text-xs font-sans">{t.dataTools?.newWindow || '新增窗口'}</span>
            <ChevronDown
              className={`w-3 h-3 text-theme-dim transition-transform duration-200 ${
                isAddMenuOpen ? 'rotate-180 text-sky-500' : ''
              }`}
            />
          </button>
        </div>

        {/* Right: Compare mode toggle & Secondary tab picker */}
        <div className="flex items-center gap-2 shrink-0">
          {splitCompareEnabled && tabs.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs text-theme-muted bg-theme-card/60 px-2 py-1 rounded-lg border border-theme-border/60">
              <span className="text-theme-dim">{t.dataTools?.selectSecondaryWindow || '对比窗口'}:</span>
              <select
                value={secondaryTabId || ''}
                onChange={(e) => setSecondaryTabId(e.target.value)}
                className="bg-theme-app text-theme-main text-xs py-0.5 px-2 rounded border border-theme-border focus:outline-none cursor-pointer max-w-[160px] truncate"
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
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-2xs ${
              splitCompareEnabled
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-600 dark:text-sky-400 font-semibold ring-1 ring-sky-500/20'
                : 'border-theme-border/80 bg-theme-card/60 text-theme-muted hover:text-theme-main hover:bg-theme-hover'
            }`}
            title={
              splitCompareEnabled
                ? t.dataTools?.singleWindow || '切换为单窗口模式'
                : t.dataTools?.splitCompare || '开启双窗口并排对比模式'
            }
          >
            <Columns2 className="w-3.5 h-3.5 text-sky-500" />
            <span className="hidden sm:inline">
              {splitCompareEnabled
                ? t.dataTools?.splitCompareActive || '双屏对比中'
                : t.dataTools?.splitCompare || '双屏对比'}
            </span>
          </button>
        </div>
      </div>

      {/* Floating Format Picker Dropdown Panel using Fixed Viewport Coordinates */}
      {isAddMenuOpen && (
        <div
          ref={addMenuRef}
          data-testid="data-tools-format-dropdown"
          style={{
            top: `${addMenuPos.top}px`,
            left: `${addMenuPos.left}px`,
          }}
          className="fixed z-[9999] w-72 bg-theme-sidebar/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-theme-border/90 p-1.5 text-xs select-none animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {/* Menu Title Header */}
          <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-semibold text-theme-dim border-b border-theme-border/50 mb-1">
            <span>{t.dataTools?.selectFormatForNewWindow || '选择新窗口数据格式'}</span>
            <kbd className="font-mono text-[10px] bg-theme-hover px-1 rounded text-theme-muted">Esc</kbd>
          </div>

          {/* Format Options List */}
          <div className="flex flex-col gap-0.5">
            {FORMAT_METAS.map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                data-testid={`data-tools-format-opt-${fmt.id}`}
                onClick={() => handleSelectFormat(fmt.id)}
                className="w-full px-2.5 py-2 rounded-lg text-left text-theme-main hover:bg-theme-hover/90 flex items-center justify-between cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase transition-colors shrink-0 ${getFormatBadgeStyle(
                      fmt.id,
                      false
                    )}`}
                  >
                    {fmt.badge}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-xs text-theme-main group-hover:text-sky-500 transition-colors">
                      {fmt.label}
                    </span>
                    <span className="text-[10px] text-theme-dim truncate">{fmt.desc}</span>
                  </div>
                </div>
                <span className="text-[10px] text-theme-dim opacity-0 group-hover:opacity-100 transition-opacity">
                  创建 →
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
