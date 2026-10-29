import React, { useState } from 'react';
import { useDataToolsStore } from './useDataToolsStore';
import { DataToolsTabBar } from './DataToolsTabBar';
import { DataToolsHeader } from './DataToolsHeader';
import { DataToolsMonacoEditor } from './DataToolsMonacoEditor';
import { DataToolsTreeViewer } from './DataToolsTreeViewer';
import { DataToolsTableView } from './DataToolsTableView';
import { DataToolsTypeGeneratorModal } from './DataToolsTypeGeneratorModal';
import { ResizeDivider } from '../../components/ui/ResizeDivider';
import { CheckCircle2, AlertCircle, FileCode } from 'lucide-react';
import { useTranslation } from '../../locales';

export const DataToolsWorkbench: React.FC = () => {
  const { t } = useTranslation();
  const {
    tabs,
    activeTabId,
    viewMode,
    activeFormat,
    stats,
    splitCompareEnabled,
    secondaryTabId,
    setSecondaryTabId,
  } = useDataToolsStore();

  const [editorWidth, setEditorWidth] = useState(650);
  const [compareSplitWidth, setCompareSplitWidth] = useState(700);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const secondaryTab = tabs.find((t) => t.id === secondaryTabId) || tabs.find((t) => t.id !== activeTabId);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-theme-app select-none">
      {/* 1. Multi-Window Tab Bar */}
      <DataToolsTabBar />

      {/* 2. Format & Actions Toolbar */}
      <DataToolsHeader />

      {/* 3. Main Workbench Content Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {splitCompareEnabled && secondaryTab ? (
          /* Side-by-Side Split Compare View (Window 1 vs Window 2) */
          <div className="flex-1 flex h-full overflow-hidden relative" data-testid="data-tools-split-compare-view">
            {/* Left Window: Active Tab */}
            <div
              style={{
                width: `${compareSplitWidth}px`,
                minWidth: '360px',
                maxWidth: 'calc(100% - 360px)',
              }}
              className="h-full flex flex-col shrink-0 overflow-hidden border-r border-theme-border/60"
            >
              <div data-testid="data-tools-split-pane-header" className="data-tools-split-pane-header h-7 px-3 bg-theme-sidebar/90 border-b border-theme-border flex items-center justify-between text-[11px] shrink-0 font-medium text-theme-main">
                <span className="flex items-center gap-1.5 font-semibold text-sky-500 truncate">
                  <span>{t.dataTools?.windowLeft || '窗口 1'}:</span>
                  <span className="text-theme-main">{activeTab?.title}</span>
                  <span className="text-[10px] px-1 py-0.2 rounded bg-theme-hover font-mono uppercase text-theme-muted">
                    {activeTab?.format}
                  </span>
                </span>
                <span className="text-[10px] text-theme-dim font-mono">{activeTab?.content.length || 0} chars</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <DataToolsMonacoEditor tabId={activeTab?.id} />
              </div>
            </div>

            {/* Split Resizer Divider */}
            <ResizeDivider
              currentWidth={compareSplitWidth}
              minWidth={360}
              maxWidth={1400}
              onResize={setCompareSplitWidth}
              onDoubleClickReset={() => setCompareSplitWidth(window.innerWidth / 2 - 30)}
              title={t.common.dragResizeHorizontal}
            />

            {/* Right Window: Secondary Tab */}
            <div className="flex-1 h-full min-w-0 overflow-hidden flex flex-col">
              <div data-testid="data-tools-split-pane-header" className="data-tools-split-pane-header h-7 px-3 bg-theme-sidebar/90 border-b border-theme-border flex items-center justify-between text-[11px] shrink-0 font-medium text-theme-main">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-semibold text-emerald-500 shrink-0">{t.dataTools?.windowRight || '窗口 2'}:</span>
                  <select
                    value={secondaryTab.id}
                    onChange={(e) => setSecondaryTabId(e.target.value)}
                    className="bg-theme-card text-theme-main text-xs py-0.5 px-1.5 rounded border border-theme-border focus:outline-none cursor-pointer max-w-[200px] truncate"
                  >
                    {tabs
                      .filter((t) => t.id !== activeTabId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.format.toUpperCase()})
                        </option>
                      ))}
                  </select>
                </div>
                <span className="text-[10px] text-theme-dim font-mono">{secondaryTab.content.length} chars</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <DataToolsMonacoEditor tabId={secondaryTab.id} />
              </div>
            </div>
          </div>
        ) : (
          /* Normal Single Window View */
          <div className="flex-1 flex h-full overflow-hidden relative">
            {viewMode === 'editor' && <DataToolsMonacoEditor />}

            {viewMode === 'tree' && <DataToolsTreeViewer />}

            {viewMode === 'table' && <DataToolsTableView />}

            {viewMode === 'split' && (
              <div className="flex-1 flex h-full overflow-hidden relative">
                {/* Left: Monaco Editor */}
                <div
                  style={{
                    width: `${editorWidth}px`,
                    minWidth: '320px',
                    maxWidth: 'calc(100% - 280px)',
                  }}
                  className="h-full flex flex-col shrink-0 overflow-hidden"
                >
                  <DataToolsMonacoEditor />
                </div>

                {/* Split Resizer Divider */}
                <ResizeDivider
                  currentWidth={editorWidth}
                  minWidth={320}
                  maxWidth={1200}
                  onResize={setEditorWidth}
                  onDoubleClickReset={() => setEditorWidth(650)}
                  title={t.common.dragResizeHorizontal}
                />

                {/* Right: Interactive Tree Viewer */}
                <div className="flex-1 h-full min-w-0 overflow-hidden">
                  <DataToolsTreeViewer />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Bottom Status Bar */}
      <div className="h-6 px-3 border-t border-theme-border bg-theme-sidebar/80 flex items-center justify-between text-[11px] font-mono text-theme-muted shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-semibold text-theme-main uppercase">
            <FileCode className="w-3 h-3 text-sky-500" />
            <span>{activeFormat}</span>
          </span>

          <span>{stats.charCount} chars</span>
          <span>{stats.lineCount} lines</span>
          <span>{stats.byteSize}</span>

          {stats.minifiedSize && (
            <span className="hidden sm:inline text-theme-dim">
              min: {stats.minifiedSize} ({stats.reductionPercentage} saved)
            </span>
          )}

          {stats.depth !== undefined && stats.depth > 1 && (
            <span className="hidden md:inline text-theme-dim">
              depth: {stats.depth}
            </span>
          )}

          {stats.keyCount !== undefined && stats.keyCount > 0 && (
            <span className="hidden lg:inline text-theme-dim">
              {stats.keyCount} keys, {stats.arrayCount || 0} arrays
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {stats.isValid ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-sans text-[10px] font-medium">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span>Valid {activeFormat.toUpperCase()}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-sans text-[10px] font-medium">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>Syntax Error</span>
            </span>
          )}
        </div>
      </div>

      {/* 5. Type Generator Modal */}
      <DataToolsTypeGeneratorModal />
    </div>
  );
};
