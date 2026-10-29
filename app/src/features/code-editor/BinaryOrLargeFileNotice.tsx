import React from 'react';
import type { EditorTabItem } from './useEditorTabsStore';
import { useTranslation } from '../../locales';
import { useAppStore } from '../../store/useAppStore';
import {
  FileText,
  FolderOpen,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  HardDrive,
} from 'lucide-react';

interface BinaryOrLargeFileNoticeProps {
  tab: EditorTabItem;
  theme: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export const BinaryOrLargeFileNotice: React.FC<BinaryOrLargeFileNoticeProps> = ({ tab }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);
  const openProjectFolder = useAppStore((state) => state.openProjectFolder);

  const handleCopyPath = () => {
    if (tab.filePath && navigator.clipboard) {
      navigator.clipboard.writeText(tab.filePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevealInExplorer = async () => {
    try {
      await fetch('/api/git/reveal-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: tab.repoPath || '',
          file: tab.filePath,
        }),
      });
    } catch {
      // Fallback
      const normPath = tab.filePath.replace(/\\/g, '/');
      const lastSlash = normPath.lastIndexOf('/');
      const parentDir = lastSlash > 0 ? normPath.substring(0, lastSlash) : tab.filePath;
      openProjectFolder(parentDir);
    }
  };

  const handleOpenWithDefaultApp = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).electron?.shell?.openPath) {
        await (window as any).electron.shell.openPath(tab.filePath);
        return;
      }
      await fetch('/api/git/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: tab.repoPath || '',
          file: tab.filePath,
        }),
      });
    } catch (e) {
      console.warn('Failed to open with default app:', e);
    }
  };

  const isTooLarge = Boolean(tab.tooLarge);
  const ext = tab.fileName.includes('.') ? tab.fileName.split('.').pop()?.toUpperCase() : 'FILE';

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 select-none text-center bg-theme-app">
      <div className="max-w-md w-full bg-theme-sidebar border border-theme-border rounded-xl p-6 shadow-lg flex flex-col items-center">
        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-inner">
          {isTooLarge ? <HardDrive className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-theme-main mb-1">
          {isTooLarge ? t.editor.largeFileNotice : t.editor.binaryFileTitle}
        </h3>

        {/* Description */}
        <p className="text-xs text-theme-muted mb-4 max-w-sm leading-relaxed">
          {isTooLarge
            ? t.editor.largeFileWarning(formatBytes(tab.size))
            : t.editor.binaryFileWarning}
        </p>

        {/* File Meta Box */}
        <div className="w-full bg-theme-card/60 border border-theme-border rounded-lg p-3 mb-5 text-left text-xs font-mono">
          <div className="flex items-center justify-between gap-2 mb-1.5 pb-1.5 border-b border-theme-border/50">
            <span className="text-theme-muted text-[11px] font-sans">文件名称</span>
            <span className="font-semibold text-theme-main truncate max-w-[240px]" title={tab.fileName}>
              {tab.fileName}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mb-1.5 pb-1.5 border-b border-theme-border/50">
            <span className="text-theme-muted text-[11px] font-sans">文件大小 / 类型</span>
            <span className="text-sky-400 font-medium">
              {formatBytes(tab.size)} · <span className="text-amber-400 uppercase">{ext}</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-theme-muted text-[11px] font-sans shrink-0">物理路径</span>
            <div className="flex items-center gap-1 min-w-0 max-w-[260px]">
              <span className="truncate text-[10px] text-theme-muted" title={tab.filePath}>
                {tab.filePath}
              </span>
              <button
                type="button"
                onClick={handleCopyPath}
                title="复制路径"
                className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-sky-400 transition cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5 w-full">
          <button
            type="button"
            onClick={handleRevealInExplorer}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-theme-hover hover:bg-theme-border border border-theme-border text-theme-main font-medium text-xs transition cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>{t.editor.openInSystemExplorer}</span>
          </button>
          <button
            type="button"
            onClick={handleOpenWithDefaultApp}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow-sm transition cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{t.editor.openWithDefaultApp}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
