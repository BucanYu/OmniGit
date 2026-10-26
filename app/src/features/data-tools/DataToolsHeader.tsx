import React, { useState } from 'react';
import { useDataToolsStore } from './useDataToolsStore';
import type { DataFormat, DataViewMode } from './types';
import { useTranslation } from '../../locales';
import {
  Sparkles,
  Minimize2,
  Trash2,
  Copy,
  Check,
  Wrench,
  Columns2,
  Code2,
  FolderTree,
  Table2,
  FileCode2,
  ChevronDown,
  ArrowDownAZ,
  FolderOpen,
} from 'lucide-react';

export const DataToolsHeader: React.FC = () => {
  const { t } = useTranslation();
  const {
    activeFormat,
    setFormat,
    viewMode,
    setViewMode,
    indentSize,
    setIndentSize,
    sortKeys,
    setSortKeys,
    formatCurrent,
    minifyCurrent,
    repairCurrent,
    clearContent,
    loadSample,
    formattedContent,
    setIsTypeModalOpen,
  } = useDataToolsStore();

  const [copied, setCopied] = useState(false);
  const [isSampleMenuOpen, setIsSampleMenuOpen] = useState(false);

  const handleCopy = async () => {
    if (!formattedContent) return;
    try {
      await navigator.clipboard.writeText(formattedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const formats: { id: DataFormat; label: string; badge: string }[] = [
    { id: 'json', label: 'JSON / JSON5', badge: '{ }' },
    { id: 'yaml', label: 'YAML', badge: 'yml' },
    { id: 'xml', label: 'XML / HTML', badge: '< >' },
    { id: 'sql', label: 'SQL', badge: 'sql' },
    { id: 'jwt', label: 'JWT Token', badge: 'jwt' },
    { id: 'url', label: 'URL Query', badge: 'url' },
    { id: 'base64', label: 'Base64', badge: 'b64' },
  ];

  return (
    <div className="h-11 px-3 border-b border-theme-border bg-theme-sidebar/95 flex items-center justify-between gap-2 shrink-0 select-none overflow-x-auto no-scrollbar">
      {/* Left: Format selector pills */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex items-center p-0.5 rounded-lg bg-theme-hover/60 border border-theme-border/60">
          {formats.map((fmt) => (
            <button
              key={fmt.id}
              type="button"
              data-testid={`data-format-tab-${fmt.id}`}
              onClick={() => setFormat(fmt.id)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFormat === fmt.id
                  ? 'bg-theme-card text-sky-600 dark:text-sky-400 font-semibold shadow-2xs'
                  : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover/50'
              }`}
            >
              <span className="font-mono text-[10px] text-theme-dim opacity-75">{fmt.badge}</span>
              <span>{fmt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Middle: Formatting actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Beautify / Format */}
        <button
          type="button"
          data-testid="data-tools-btn-beautify"
          onClick={formatCurrent}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 text-xs font-medium transition-colors cursor-pointer shadow-2xs"
          title={t.dataTools.beautifyTooltip}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t.dataTools.beautify}</span>
        </button>

        {/* Minify */}
        <button
          type="button"
          data-testid="data-tools-btn-minify"
          onClick={minifyCurrent}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-theme-border/80 bg-theme-card hover:bg-theme-hover text-theme-main text-xs font-medium transition-colors cursor-pointer shadow-2xs"
          title={t.dataTools.minifyTooltip}
        >
          <Minimize2 className="w-3.5 h-3.5 text-theme-muted" />
          <span>{t.dataTools.minify}</span>
        </button>

        {/* Repair JSON (only when in JSON format) */}
        {activeFormat === 'json' && (
          <button
            type="button"
            data-testid="data-tools-btn-repair"
            onClick={repairCurrent}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-theme-border/80 bg-theme-card hover:bg-theme-hover text-theme-main text-xs font-medium transition-colors cursor-pointer shadow-2xs"
            title={t.dataTools.repairTooltip}
          >
            <Wrench className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">{t.dataTools.repair}</span>
          </button>
        )}

        {/* Sort keys toggle (for JSON) */}
        {activeFormat === 'json' && (
          <button
            type="button"
            onClick={() => setSortKeys(!sortKeys)}
            className={`p-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer shadow-2xs ${
              sortKeys
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-600 dark:text-sky-400'
                : 'border-theme-border/80 bg-theme-card text-theme-muted hover:text-theme-main hover:bg-theme-hover'
            }`}
            title={t.dataTools.sortKeysTooltip}
          >
            <ArrowDownAZ className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Indent switcher */}
        <select
          value={indentSize}
          onChange={(e) => setIndentSize(Number(e.target.value))}
          className="bg-theme-card text-theme-main text-xs py-1 px-1.5 rounded-lg border border-theme-border/80 focus:outline-none cursor-pointer"
          title={t.dataTools.indentTooltip}
        >
          <option value={2}>2 Spaces</option>
          <option value={4}>4 Spaces</option>
        </select>

        {/* Type generator modal trigger */}
        {activeFormat === 'json' && (
          <button
            type="button"
            data-testid="data-tools-btn-types"
            onClick={() => setIsTypeModalOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-theme-border/80 bg-theme-card hover:bg-theme-hover text-theme-main text-xs font-medium transition-colors cursor-pointer shadow-2xs"
            title={t.dataTools.generateTypesTooltip}
          >
            <FileCode2 className="w-3.5 h-3.5 text-purple-500" />
            <span className="hidden md:inline">{t.dataTools.generateTypes}</span>
          </button>
        )}

        {/* Sample selector dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsSampleMenuOpen(!isSampleMenuOpen)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-theme-border/80 bg-theme-card hover:bg-theme-hover text-theme-muted hover:text-theme-main text-xs font-medium transition-colors cursor-pointer"
            title={t.dataTools.samplesTooltip}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{t.dataTools.samples}</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {isSampleMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-44 bg-theme-panel border border-theme-border rounded-xl shadow-2xl z-50 py-1 text-xs animate-in fade-in zoom-in-95"
              onMouseLeave={() => setIsSampleMenuOpen(false)}
            >
              <div className="px-2.5 py-1 text-[10px] font-semibold text-theme-dim uppercase tracking-wider">
                {t.dataTools.loadSampleTitle}
              </div>
              <button
                type="button"
                onClick={() => {
                  loadSample('json');
                  setIsSampleMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-theme-hover text-theme-main flex items-center justify-between"
              >
                <span>Microservice API</span>
                <span className="text-[10px] text-theme-dim font-mono">JSON</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  loadSample('yaml');
                  setIsSampleMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-theme-hover text-theme-main flex items-center justify-between"
              >
                <span>Kubernetes Pod</span>
                <span className="text-[10px] text-theme-dim font-mono">YAML</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  loadSample('sql');
                  setIsSampleMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-theme-hover text-theme-main flex items-center justify-between"
              >
                <span>Complex Query</span>
                <span className="text-[10px] text-theme-dim font-mono">SQL</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  loadSample('jwt');
                  setIsSampleMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-theme-hover text-theme-main flex items-center justify-between"
              >
                <span>Auth Bearer</span>
                <span className="text-[10px] text-theme-dim font-mono">JWT</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  loadSample('xml');
                  setIsSampleMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-theme-hover text-theme-main flex items-center justify-between"
              >
                <span>Maven POM</span>
                <span className="text-[10px] text-theme-dim font-mono">XML</span>
              </button>
            </div>
          )}
        </div>

        {/* Copy Result */}
        <button
          type="button"
          data-testid="data-tools-btn-copy"
          onClick={handleCopy}
          className="p-1.5 rounded-lg border border-theme-border/80 bg-theme-card hover:bg-theme-hover text-theme-muted hover:text-theme-main transition-colors cursor-pointer shadow-2xs"
          title={copied ? t.dataTools.copiedToast : t.dataTools.copyTooltip}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        {/* Clear */}
        <button
          type="button"
          onClick={clearContent}
          className="p-1.5 rounded-lg border border-theme-border/80 bg-theme-card hover:bg-rose-500/10 text-theme-muted hover:text-rose-500 transition-colors cursor-pointer shadow-2xs"
          title={t.dataTools.clearTooltip}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right: View Mode Toggle */}
      <div className="flex items-center gap-1 shrink-0 p-0.5 rounded-lg bg-theme-hover/60 border border-theme-border/60">
        <button
          type="button"
          data-testid="data-view-split"
          onClick={() => setViewMode('split')}
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            viewMode === 'split' ? 'bg-theme-card text-sky-500 shadow-2xs' : 'text-theme-muted hover:text-theme-main'
          }`}
          title={t.dataTools.viewSplit}
        >
          <Columns2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          data-testid="data-view-editor"
          onClick={() => setViewMode('editor')}
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            viewMode === 'editor' ? 'bg-theme-card text-sky-500 shadow-2xs' : 'text-theme-muted hover:text-theme-main'
          }`}
          title={t.dataTools.viewEditor}
        >
          <Code2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          data-testid="data-view-tree"
          onClick={() => setViewMode('tree')}
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            viewMode === 'tree' ? 'bg-theme-card text-sky-500 shadow-2xs' : 'text-theme-muted hover:text-theme-main'
          }`}
          title={t.dataTools.viewTree}
        >
          <FolderTree className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          data-testid="data-view-table"
          onClick={() => setViewMode('table')}
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            viewMode === 'table' ? 'bg-theme-card text-sky-500 shadow-2xs' : 'text-theme-muted hover:text-theme-main'
          }`}
          title={t.dataTools.viewTable}
        >
          <Table2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
