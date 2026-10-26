import React, { useState } from 'react';
import { useDataToolsStore } from './useDataToolsStore';
import type { TreeNodeData } from './types';
import { useTranslation } from '../../locales';
import {
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Search,
  FolderTree,
  UnfoldHorizontal,
  FoldHorizontal,
} from 'lucide-react';

export const DataToolsTreeViewer: React.FC = () => {
  const { t } = useTranslation();
  const {
    treeRoot,
    expandedPaths,
    togglePath,
    expandAll,
    collapseAll,
    collapseToDepth,
    treeSearchQuery,
    setTreeSearchQuery,
  } = useDataToolsStore();

  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const handleCopyPath = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 1500);
    } catch {}
  };

  const handleCopyValue = async (value: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const text = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      await navigator.clipboard.writeText(text);
      setCopiedPath('val_' + Math.random());
      setTimeout(() => setCopiedPath(null), 1500);
    } catch {}
  };

  if (!treeRoot) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-theme-muted select-none bg-theme-panel/40">
        <FolderTree className="w-10 h-10 text-theme-muted/40 mb-3" />
        <p className="text-xs font-medium">{t.dataTools.noTreeData}</p>
        <p className="text-[11px] text-theme-dim mt-1">{t.dataTools.noTreeDataDesc}</p>
      </div>
    );
  }

  const renderNode = (node: TreeNodeData) => {
    const isExpanded = expandedPaths.has(node.path);
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isMatched =
      Boolean(treeSearchQuery.trim()) &&
      (node.key.toLowerCase().includes(treeSearchQuery.toLowerCase()) ||
        String(node.value).toLowerCase().includes(treeSearchQuery.toLowerCase()));

    return (
      <div key={node.id} className="flex flex-col">
        {/* Node Row */}
        <div
          data-testid={`tree-node-${node.path}`}
          onClick={() => hasChildren && togglePath(node.path)}
          style={{ paddingLeft: `${node.depth * 18 + 8}px` }}
          className={`group flex items-center justify-between py-1 px-2 hover:bg-theme-hover/60 transition-colors font-mono text-[11px] select-none rounded-md cursor-pointer ${
            isMatched ? 'bg-amber-500/15 border-l-2 border-amber-500' : ''
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
            {/* Expand / Collapse Toggle Icon */}
            {hasChildren ? (
              <button
                type="button"
                data-testid={`tree-toggle-${node.path}`}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePath(node.path);
                }}
                className="w-4 h-4 flex items-center justify-center text-theme-dim hover:text-theme-main transition-colors shrink-0"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}

            {/* Field Key */}
            <span className="text-sky-600 dark:text-sky-400 font-semibold shrink-0">
              {node.key}:
            </span>

            {/* Value / Container Indicator */}
            {node.type === 'array' ? (
              <span className="text-theme-muted flex items-center gap-1.5">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Array({node.count})
                </span>
                {!isExpanded && (
                  <span className="text-[10px] text-theme-dim bg-theme-hover px-1 rounded">
                    [...]
                  </span>
                )}
              </span>
            ) : node.type === 'object' ? (
              <span className="text-theme-muted flex items-center gap-1.5">
                <span className="text-purple-600 dark:text-purple-400 font-medium">
                  Object({node.count})
                </span>
                {!isExpanded && (
                  <span className="text-[10px] text-theme-dim bg-theme-hover px-1 rounded">
                    {'{...}'}
                  </span>
                )}
              </span>
            ) : node.type === 'string' ? (
              <span className="text-emerald-600 dark:text-emerald-400 truncate">
                "{String(node.value)}"
              </span>
            ) : node.type === 'number' ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {String(node.value)}
              </span>
            ) : node.type === 'boolean' ? (
              <span className="text-pink-600 dark:text-pink-400 font-semibold">
                {String(node.value)}
              </span>
            ) : (
              <span className="text-theme-dim italic">null</span>
            )}
          </div>

          {/* Quick Actions (Copy Path & Value) */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 ml-2">
            <button
              type="button"
              onClick={(e) => handleCopyPath(node.path, e)}
              className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-theme-main transition-colors"
              title={`复制 JSONPath: ${node.path}`}
            >
              {copiedPath === node.path ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <span className="text-[10px] px-1 bg-theme-hover border border-theme-border/60 rounded">
                  Path
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={(e) => handleCopyValue(node.value, e)}
              className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-theme-main transition-colors"
              title="复制此节点值"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Children Rows (when expanded) */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col">
            {node.children!.map((child) => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-theme-panel/30 border-l border-theme-border select-none">
      {/* Tree Control Bar */}
      <div className="p-2 border-b border-theme-border bg-theme-sidebar/60 flex items-center justify-between gap-2 shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-xs flex items-center">
          <Search className="w-3 h-3 text-theme-muted absolute left-2 pointer-events-none" />
          <input
            type="text"
            value={treeSearchQuery}
            onChange={(e) => setTreeSearchQuery(e.target.value)}
            placeholder={t.dataTools.searchTreePlaceholder}
            className="w-full bg-theme-card text-theme-main text-[11px] pl-7 pr-2 py-1 rounded-md border border-theme-border focus:border-sky-500 focus:outline-none font-sans"
          />
        </div>

        {/* Level & Depth Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={expandAll}
            className="p-1.5 rounded text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors"
            title={t.dataTools.expandAll}
          >
            <UnfoldHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="p-1.5 rounded text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors"
            title={t.dataTools.collapseAll}
          >
            <FoldHorizontal className="w-3.5 h-3.5" />
          </button>

          <span className="text-theme-border">|</span>

          {/* Quick Depth Buttons */}
          {[1, 2, 3].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => collapseToDepth(d + 1)}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono text-theme-muted hover:text-theme-main hover:bg-theme-hover border border-theme-border/60"
              title={`折叠至第 ${d} 层`}
            >
              L{d}
            </button>
          ))}
        </div>
      </div>

      {/* Tree Hierarchy Scroll Area */}
      <div className="flex-1 overflow-y-auto p-2">
        {renderNode(treeRoot)}
      </div>
    </div>
  );
};
