import React, { useState, useRef, useEffect } from 'react';
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
  } = useEditorTabsStore();
  const { t } = useTranslation();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tab: EditorTabItem;
  } | null>(null);

  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  if (tabs.length === 0) {
    return null;
  }

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

  return (
    <div className="h-9 bg-theme-sidebar border-b border-theme-border flex items-center px-1 overflow-x-auto no-scrollbar select-none text-xs shrink-0">
      <div className="flex items-center gap-0.5">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab)}
              onMouseDown={(e) => {
                // Middle click to close tab
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(tab.id);
                }
              }}
              className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs cursor-pointer border-t-2 border-r border-theme-border/60 transition-colors ${
                isActive
                  ? 'border-t-sky-500 bg-theme-app text-theme-main font-medium shadow-sm'
                  : 'border-t-transparent bg-theme-sidebar text-theme-muted hover:text-theme-main hover:bg-theme-hover/50'
              }`}
              title={`${tab.fileName}\n${tab.filePath}`}
            >
              {getTabIcon(tab.fileName)}

              <span className="truncate max-w-[140px] text-[12px]">{tab.fileName}</span>

              {/* Project Badge if more than 1 project or to disambiguate */}
              {tab.repoName && (
                <span className="text-[10px] text-theme-muted px-1 rounded bg-theme-hover/60 shrink-0 font-normal">
                  {tab.repoName}
                </span>
              )}

              {/* Dirty Indicator / Close Button */}
              {tab.isDirty ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="w-4 h-4 flex items-center justify-center text-sky-400 group-hover:hidden"
                >
                  ●
                </span>
              ) : null}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className={`w-4 h-4 flex items-center justify-center rounded hover:bg-theme-main/10 text-theme-muted hover:text-red-400 transition ${
                  tab.isDirty ? 'hidden group-hover:flex' : 'flex'
                }`}
                title={t.editor.closeTabTooltip}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Right Click Context Menu */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed bg-theme-app border border-theme-border rounded shadow-xl py-1 z-50 text-xs w-48 text-theme-main"
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
              closeAllTabs();
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-theme-hover cursor-pointer"
          >
            {t.editor.closeAllTabs}
          </div>
          <div className="border-t border-theme-border my-1" />
          <div
            onClick={() => handleCopy(contextMenu.tab.relativePath)}
            className="px-3 py-1.5 hover:bg-theme-hover cursor-pointer flex items-center justify-between"
          >
            <span>{t.editor.copyRelativePath}</span>
            {copiedPath === contextMenu.tab.relativePath && (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </div>
          <div
            onClick={() => handleCopy(contextMenu.tab.filePath)}
            className="px-3 py-1.5 hover:bg-theme-hover cursor-pointer flex items-center justify-between"
          >
            <span>{t.editor.copyAbsolutePath}</span>
            {copiedPath === contextMenu.tab.filePath && (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
