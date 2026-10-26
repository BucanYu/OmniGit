import React, { useState, useRef } from 'react';
import { useDataToolsStore } from './useDataToolsStore';
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
  const { viewMode, activeFormat, stats } = useDataToolsStore();
  const [editorWidth, setEditorWidth] = useState(650);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-theme-app select-none">
      {/* 1. Header Toolbar */}
      <DataToolsHeader />

      {/* 2. Main Workbench Content Body */}
      <div className="flex-1 flex overflow-hidden relative">
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

      {/* 3. Bottom Status Bar */}
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

      {/* 4. Type Generator Modal */}
      <DataToolsTypeGeneratorModal />
    </div>
  );
};
