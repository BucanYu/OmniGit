import React from 'react';
import { GitCompare, FolderOpen, Copy } from 'lucide-react';
import { useTranslation } from '../../../locales';
import type { AppNotification, OutgoingCommitFile } from '../../../store/useAppStore';
import type { FileContextMenuState } from '../types';

interface FileContextMenuProps {
  state: FileContextMenuState;
  projectPath?: string;
  onClose: () => void;
  onOpenDiff: (file: OutgoingCommitFile) => void;
  onRevealInOS: (path: string) => void;
  onNotify: (notification: AppNotification) => void;
}

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  state,
  projectPath,
  onClose,
  onOpenDiff,
  onRevealInOS,
  onNotify,
}) => {
  const { t } = useTranslation();
  const menuWidth = 220;
  const menuHeight = 200;
  const clampedX = Math.max(10, Math.min(state.x, window.innerWidth - menuWidth - 10));
  const clampedY = Math.max(10, Math.min(state.y, window.innerHeight - menuHeight - 10));

  return (
    <div
      style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-[1060] bg-theme-panel border border-theme-border rounded-lg shadow-2xl py-1 min-w-[200px] text-xs select-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-75 font-sans"
    >
      <div className="px-3 py-1 text-[10px] text-theme-dim border-b border-theme-border font-mono truncate max-w-[240px]">
        {state.file.fileName}
      </div>
      <button
        type="button"
        onClick={() => {
          onOpenDiff(state.file);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2 text-theme-main hover:bg-theme-hover hover:text-sky-400 transition cursor-pointer text-left font-medium"
      >
        <GitCompare className="w-3.5 h-3.5 text-sky-400" />
        <span>{t.modals.push.showDiffTooltip}</span>
      </button>
      <button
        type="button"
        onClick={() => {
          onRevealInOS(state.file.path);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2 text-theme-main hover:bg-theme-hover transition cursor-pointer text-left"
      >
        <FolderOpen className="w-3.5 h-3.5 text-theme-dim" />
        <span>{t.modals.push.openInExplorer}</span>
      </button>
      <div className="h-px bg-theme-border my-1" />
      <button
        type="button"
        onClick={() => {
          if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(state.file.path);
            onNotify({
              id: Date.now(),
              title: t.modals.push.relativePathCopied,
              detail: state.file.path,
              type: 'info',
            });
          }
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2 text-theme-main hover:bg-theme-hover transition cursor-pointer text-left"
      >
        <Copy className="w-3.5 h-3.5 text-theme-dim" />
        <span>{t.modals.push.copyRelativePath}</span>
      </button>
      <button
        type="button"
        onClick={() => {
          const sep = projectPath?.includes('\\') ? '\\' : '/';
          const full = `${projectPath || ''}${sep}${state.file.path.replace(/\//g, sep)}`;
          if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(full);
            onNotify({
              id: Date.now(),
              title: t.modals.push.absolutePathCopied,
              detail: full,
              type: 'info',
            });
          }
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2 text-theme-main hover:bg-theme-hover transition cursor-pointer text-left"
      >
        <Copy className="w-3.5 h-3.5 text-theme-dim" />
        <span>{t.modals.push.copyAbsolutePath}</span>
      </button>
    </div>
  );
};
