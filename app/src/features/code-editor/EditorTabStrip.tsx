import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useEditorTabsStore, type EditorTabItem } from './useEditorTabsStore';
import { useTranslation } from '../../locales';
import {
  X,
  FileCode,
  FileText,
  FileJson,
  FileSpreadsheet,
  File,
  Code2,
  FileTerminal,
  Settings,
  Database,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Layers,
  Search,
} from 'lucide-react';

function getTabIcon(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.startsWith('.env')) {
    return <Settings className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  }
  const ext = name.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return <Code2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return <Code2 className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
    case 'json':
      return <FileJson className="w-3.5 h-3.5 text-amber-300 shrink-0" />;
    case 'html':
    case 'vue':
      return <FileCode className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
    case 'css':
    case 'scss':
    case 'less':
      return <FileCode className="w-3.5 h-3.5 text-sky-300 shrink-0" />;
    case 'md':
    case 'markdown':
    case 'txt':
      return <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    case 'sh':
    case 'bash':
    case 'bat':
    case 'cmd':
    case 'ps1':
      return <FileTerminal className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    case 'sql':
      return <Database className="w-3.5 h-3.5 text-teal-400 shrink-0" />;
    case 'csv':
    case 'xlsx':
    case 'xls':
    case 'et':
      return <FileSpreadsheet className="w-3.5 h-3.5 text-green-500 shrink-0" />;
    default:
      return <File className="w-3.5 h-3.5 text-theme-muted shrink-0" />;
  }
}

export function EditorTabStrip() {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    closeSavedTabs,
  } = useEditorTabsStore();
  const { t } = useTranslation();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);

  const [showAllTabsMenu, setShowAllTabsMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tab: EditorTabItem;
  } | null>(null);

  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Defensive deduplication to guarantee that the UI never displays duplicate tabs for the same file
  const uniqueTabs = useMemo(() => {
    const seen = new Set<string>();
    return tabs.filter((t) => {
      const norm = (t.filePath || '').trim().replace(/\\/g, '/').toLowerCase();
      if (!norm || seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
  }, [tabs]);

/**
 * Resolves a smart, compact disambiguation label when multiple tabs share the same fileName.
 * Following VS Code's tab description strategy:
 * 1. If duplicate files belong to different repositories/projects, return the repoName.
 * 2. If duplicate files are in the same repository, return the distinctive parent folder from relativePath.
 */
function getDisambiguationLabel(tab: EditorTabItem, allTabs: EditorTabItem[]): string {
  const targetLower = tab.fileName.toLowerCase();
  const sameNameTabs = allTabs.filter(
    (t) => t.fileName.toLowerCase() === targetLower
  );
  if (sameNameTabs.length <= 1) return '';

  const distinctRepos = new Set(sameNameTabs.map((t) => (t.repoName || t.repoPath || '').toLowerCase()));
  if (distinctRepos.size > 1) {
    return tab.repoName || tab.repoPath.split(/[\\/]/).pop() || '';
  }

  // Same repository: disambiguate by parent directory
  if (tab.relativePath) {
    const parts = tab.relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length > 1) {
      return parts[parts.length - 2];
    }
  }

  return tab.repoName || '';
}

  // Smart disambiguation: detect if there are multiple tabs with the same fileName
  const duplicateFileNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tab of uniqueTabs) {
      const key = tab.fileName.toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const dupes = new Set<string>();
    counts.forEach((cnt, key) => {
      if (cnt > 1) dupes.add(key);
    });
    return dupes;
  }, [uniqueTabs]);

  // Scroll overflow check
  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth;
    setCanScrollLeft(hasOverflow && el.scrollLeft > 2);
    setCanScrollRight(hasOverflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateScrollState();
    const handleResize = () => updateScrollState();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateScrollState, uniqueTabs.length]);

  // Auto-scroll active tab into view smoothly
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
    const timer = setTimeout(updateScrollState, 300);
    return () => clearTimeout(timer);
  }, [activeTabId, updateScrollState]);

  // Translate vertical mouse wheel scrolling into horizontal scrolling
  const handleWheel = (e: React.WheelEvent) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (e.deltaY !== 0) {
      el.scrollLeft += e.deltaY;
      updateScrollState();
    } else if (e.deltaX !== 0) {
      el.scrollLeft += e.deltaX;
      updateScrollState();
    }
  };

  const scrollByAmount = (amount: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: amount,
        behavior: 'smooth',
      });
      setTimeout(updateScrollState, 300);
    }
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownMenuRef.current &&
        !dropdownMenuRef.current.contains(e.target as Node) &&
        dropdownTriggerRef.current &&
        !dropdownTriggerRef.current.contains(e.target as Node)
      ) {
        setShowAllTabsMenu(false);
        setSearchQuery('');
      }
      setContextMenu(null);
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, tab: EditorTabItem) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      tab,
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(text);
    setTimeout(() => setCopiedPath(null), 1500);
    setContextMenu(null);
  };

  const filteredDropdownTabs = useMemo(() => {
    if (!searchQuery.trim()) return uniqueTabs;
    const q = searchQuery.toLowerCase().trim();
    return uniqueTabs.filter(
      (t) =>
        t.fileName.toLowerCase().includes(q) ||
        t.filePath.toLowerCase().includes(q) ||
        t.repoName.toLowerCase().includes(q)
    );
  }, [uniqueTabs, searchQuery]);

  if (uniqueTabs.length === 0) {
    return null;
  }

  return (
    <div className="h-9 bg-theme-sidebar border-b border-theme-border flex items-center select-none text-xs shrink-0 relative z-20">
      {/* 1. Main Tab Scrollable Area (Scrollbar completely hidden, smooth wheel support) */}
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        onScroll={updateScrollState}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        className="flex-1 flex items-center overflow-x-auto select-none [&::-webkit-scrollbar]:hidden h-full"
      >
        <div className="flex items-center gap-0.5 px-1 h-full">
          {uniqueTabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isDuplicate = duplicateFileNames.has(tab.fileName.toLowerCase());
            const disambigLabel = isDuplicate ? getDisambiguationLabel(tab, uniqueTabs) : '';

            return (
              <div
                key={tab.id}
                data-tab-id={tab.id}
                ref={isActive ? activeTabRef : null}
                onClick={() => setActiveTabId(tab.id)}
                onContextMenu={(e) => handleContextMenu(e, tab)}
                onMouseDown={(e) => {
                  // Middle click to close tab
                  if (e.button === 1) {
                    e.preventDefault();
                    closeTab(tab.id);
                  }
                }}
                className={`group relative flex items-center gap-1.5 px-2.5 h-[32px] rounded-t text-xs cursor-pointer border-r border-theme-border/40 transition-colors shrink-0 ${
                  isDuplicate ? 'max-w-[285px] min-w-[85px]' : 'max-w-[180px] min-w-[70px]'
                } ${
                  isActive
                    ? 'bg-theme-app text-theme-main font-medium shadow-xs'
                    : 'bg-theme-sidebar/80 text-theme-muted hover:text-theme-main hover:bg-theme-hover/40'
                }`}
                title={
                  isDuplicate && disambigLabel
                    ? `${tab.fileName} • ${disambigLabel}\n${tab.filePath}`
                    : `${tab.fileName}\n${tab.filePath}`
                }
              >
                {/* Active Top Accent Line */}
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-sky-500 rounded-t" />
                )}

                {/* File Icon */}
                {getTabIcon(tab.fileName)}

                {/* Text Content: File Name (Primary Priority) + Disambiguation Badge (Secondary Priority) */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden select-none">
                  {/* 1. File Name: High priority, always displayed first, protected from shrinking when normal length */}
                  <span
                    className={`text-[12px] truncate leading-none ${
                      isActive ? 'text-theme-main font-medium' : 'text-theme-main/90'
                    }`}
                    style={{
                      flexShrink: tab.fileName.length > 20 ? 1 : 0,
                      minWidth: '38px',
                      maxWidth: '180px',
                    }}
                  >
                    {tab.fileName}
                  </span>

                  {/* 2. Disambiguation Description (Project / Folder Context): Secondary, capped, yields space to file name */}
                  {isDuplicate && disambigLabel ? (
                    <span
                      className="text-[10px] text-theme-muted/75 px-1.5 py-0.5 rounded bg-theme-border/40 font-mono truncate max-w-[95px] min-w-0 scale-95"
                      style={{ flexShrink: 2 }}
                      title={`${tab.fileName} • ${disambigLabel}\n${tab.filePath}`}
                    >
                      {disambigLabel}
                    </span>
                  ) : null}
                </div>

                {/* Dirty Indicator / Close Button */}
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                  {tab.isDirty ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="w-2 h-2 rounded-full bg-amber-400 group-hover:hidden transition-transform"
                      title={t.editor.saveFileTooltip}
                    />
                  ) : null}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className={`w-3.5 h-3.5 items-center justify-center rounded hover:bg-theme-hover hover:text-red-400 transition cursor-pointer p-0.5 ${
                      isActive
                        ? 'flex text-theme-muted'
                        : tab.isDirty
                        ? 'hidden group-hover:flex text-theme-muted'
                        : 'hidden group-hover:flex text-theme-muted/70'
                    }`}
                    title={t.editor.closeTabTooltip}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Fixed Right Action Bar (Chevrons, All Open Tabs Dropdown, Close All) */}
      <div className="flex items-center gap-0.5 px-1.5 bg-theme-sidebar border-l border-theme-border/50 h-full shrink-0 z-10 shadow-xs">
        {/* Left Scroll Chevron */}
        {canScrollLeft && (
          <button
            onClick={() => scrollByAmount(-180)}
            className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-theme-main transition cursor-pointer"
            title={t.editor.scrollTabsLeft}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Right Scroll Chevron */}
        {canScrollRight && (
          <button
            onClick={() => scrollByAmount(180)}
            className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-theme-main transition cursor-pointer"
            title={t.editor.scrollTabsRight}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* All Open Tabs Dropdown Button */}
        <div className="relative">
          <button
            ref={dropdownTriggerRef}
            onClick={() => setShowAllTabsMenu(!showAllTabsMenu)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition cursor-pointer ${
              showAllTabsMenu
                ? 'bg-sky-600/20 text-sky-400 font-medium'
                : 'hover:bg-theme-hover text-theme-muted hover:text-theme-main'
            }`}
            title={t.editor.openTabsListTitle(uniqueTabs.length)}
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-mono text-[11px]">{uniqueTabs.length}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {/* All Open Tabs Floating Dropdown Panel */}
          {showAllTabsMenu && (
            <div
              ref={dropdownMenuRef}
              className="absolute right-0 top-full mt-1 w-72 max-h-96 bg-theme-app border border-theme-border rounded shadow-2xl py-1 z-50 text-xs flex flex-col text-theme-main overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            >
              {/* Header */}
              <div className="px-3 py-1.5 border-b border-theme-border/60 flex items-center justify-between font-medium text-theme-muted text-[11px]">
                <span>{t.editor.openTabsListTitle(uniqueTabs.length)}</span>
                <span className="text-[10px] opacity-70">Esc 关闭</span>
              </div>

              {/* Optional Search if more than 5 tabs */}
              {uniqueTabs.length > 5 && (
                <div className="p-2 border-b border-theme-border/40">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-theme-sidebar border border-theme-border/60 text-xs">
                    <Search className="w-3 h-3 text-theme-muted" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t.editor.searchTabsPlaceholder}
                      className="bg-transparent border-none outline-none text-xs w-full text-theme-main placeholder:text-theme-muted/60"
                      autoFocus
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="text-theme-muted hover:text-theme-main"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Tab List */}
              <div className="max-h-60 overflow-y-auto py-1">
                {filteredDropdownTabs.length === 0 ? (
                  <div className="px-3 py-3 text-center text-theme-muted text-[11px]">
                    无匹配文件
                  </div>
                ) : (
                  filteredDropdownTabs.map((tab) => {
                    const isActive = tab.id === activeTabId;
                    return (
                      <div
                        key={tab.id}
                        onClick={() => {
                          setActiveTabId(tab.id);
                          setShowAllTabsMenu(false);
                          setSearchQuery('');
                        }}
                        className={`flex items-center justify-between px-3 py-1.5 hover:bg-theme-hover cursor-pointer group transition-colors ${
                          isActive
                            ? 'bg-sky-500/10 text-sky-400 font-medium'
                            : 'text-theme-main'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                          {getTabIcon(tab.fileName)}
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-[12px]">{tab.fileName}</span>
                            <span className="text-[10px] text-theme-muted truncate opacity-70">
                              {tab.repoName ? `${tab.repoName} · ` : ''}
                              {tab.relativePath || tab.filePath}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {tab.isDirty && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeTab(tab.id);
                            }}
                            className="p-1 rounded hover:bg-theme-main/10 text-theme-muted hover:text-red-400 opacity-60 group-hover:opacity-100 transition cursor-pointer"
                            title={t.editor.closeTabTooltip}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Batch Actions Footer */}
              <div className="border-t border-theme-border/60 p-1 bg-theme-sidebar/50 flex flex-col gap-0.5 text-[11px]">
                <div
                  onClick={() => {
                    closeSavedTabs();
                    setShowAllTabsMenu(false);
                  }}
                  className="px-2.5 py-1 rounded hover:bg-theme-hover cursor-pointer text-theme-muted hover:text-theme-main transition"
                >
                  {t.editor.closeSavedTabs}
                </div>
                {activeTabId && (
                  <div
                    onClick={() => {
                      closeOtherTabs(activeTabId);
                      setShowAllTabsMenu(false);
                    }}
                    className="px-2.5 py-1 rounded hover:bg-theme-hover cursor-pointer text-theme-muted hover:text-theme-main transition"
                  >
                    {t.editor.closeOtherTabs}
                  </div>
                )}
                <div
                  onClick={() => {
                    closeAllTabs();
                    setShowAllTabsMenu(false);
                  }}
                  className="px-2.5 py-1 rounded hover:bg-theme-hover cursor-pointer text-red-400/90 hover:text-red-400 transition"
                >
                  {t.editor.closeAllTabs}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Close All Button */}
        <button
          onClick={() => closeAllTabs()}
          className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-red-400 transition cursor-pointer"
          title={t.editor.closeAllTabs}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3. Right Click Context Menu */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed bg-theme-app border border-theme-border rounded shadow-xl py-1 z-50 text-xs w-48 text-theme-main animate-in fade-in zoom-in-95 duration-100"
        >
          <div
            onClick={() => {
              closeTab(contextMenu.tab.id);
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-theme-hover cursor-pointer"
          >
            {t.editor.closeCurrentTab}
          </div>
          <div
            onClick={() => {
              closeOtherTabs(contextMenu.tab.id);
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-theme-hover cursor-pointer"
          >
            {t.editor.closeOtherTabs}
          </div>
          <div
            onClick={() => {
              closeSavedTabs();
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-theme-hover cursor-pointer"
          >
            {t.editor.closeSavedTabs}
          </div>
          <div
            onClick={() => {
              closeAllTabs();
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-theme-hover cursor-pointer text-red-400"
          >
            {t.editor.closeAllTabs}
          </div>
          <div className="border-t border-theme-border my-1" />
          <div
            onClick={() => handleCopy(contextMenu.tab.relativePath || contextMenu.tab.fileName)}
            className="px-3 py-1.5 hover:bg-theme-hover cursor-pointer flex items-center justify-between"
          >
            <span>{t.editor.copyRelativePath}</span>
            {copiedPath === (contextMenu.tab.relativePath || contextMenu.tab.fileName) ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 text-theme-muted" />
            )}
          </div>
          <div
            onClick={() => handleCopy(contextMenu.tab.filePath)}
            className="px-3 py-1.5 hover:bg-theme-hover cursor-pointer flex items-center justify-between"
          >
            <span>{t.editor.copyAbsolutePath}</span>
            {copiedPath === contextMenu.tab.filePath ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 text-theme-muted" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
