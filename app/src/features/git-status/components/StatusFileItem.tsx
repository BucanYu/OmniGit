import React from 'react';
import {
  FileCode,
  FileText,
  Database,
  File,
  CheckSquare,
  Square,
  MinusSquare,
  FileEdit,
  FolderOpen,
  Undo2,
  Minus,
  Plus,
} from 'lucide-react';
import { useTranslation } from '../../../locales';
import type { GitFileItem } from '../../../store/useAppStore';

export function renderFileIcon(fileName?: string): React.ReactElement {
  if (!fileName || typeof fileName !== 'string') {
    return <File className="w-3.5 h-3.5 text-theme-dim shrink-0" />;
  }
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.java')) {
    return (
      <span className="w-3.5 h-3.5 rounded bg-blue-600/90 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
        C
      </span>
    );
  }
  if (lower.endsWith('.sql')) {
    return <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  }
  if (lower.endsWith('.md')) {
    return <FileText className="w-3.5 h-3.5 text-sky-300 shrink-0" />;
  }
  if (
    lower.endsWith('.ts') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.json') ||
    lower.endsWith('.vue') ||
    lower.endsWith('.js') ||
    lower.endsWith('.jsx')
  ) {
    return <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
  }
  return <File className="w-3.5 h-3.5 text-theme-dim shrink-0" />;
}

export function renderStatusBadge(status: GitFileItem['status']): React.ReactElement | null {
  switch (status) {
    case 'modified':
      return <span className="text-[10px] font-mono font-bold text-sky-400 ml-1">M</span>;
    case 'added':
      return <span className="text-[10px] font-mono font-bold text-emerald-400 ml-1">A</span>;
    case 'deleted':
      return <span className="text-[10px] font-mono font-bold text-rose-400 ml-1">D</span>;
    case 'conflict':
      return <span className="text-[10px] font-mono font-bold text-rose-500 bg-rose-500/20 px-1 rounded ml-1">C</span>;
    case 'untracked':
      return <span className="text-[10px] font-mono font-bold text-amber-400 ml-1">?</span>;
    default:
      return null;
  }
}

export function getGroupCheckboxIcon(total: number, checkedCount: number): React.ReactElement {
  if (total === 0 || checkedCount === 0) {
    return <Square className="w-3.5 h-3.5 text-theme-dim hover:text-theme-main" />;
  }
  if (checkedCount === total) {
    return <CheckSquare className="w-3.5 h-3.5 text-sky-500" />;
  }
  return <MinusSquare className="w-3.5 h-3.5 text-sky-500" />;
}

interface StatusFileItemProps {
  file: GitFileItem;
  isSelected: boolean;
  onSelect: (path: string) => void;
  onToggleCheck: (path: string) => void;
  onOpenInEditor: (path: string) => void;
  onRevealInOS: (path: string) => void;
  onRollback: (path: string) => void;
  onStage: (path: string) => void;
  onUnstage: (path: string) => void;
}

export const StatusFileItem: React.FC<StatusFileItemProps> = ({
  file,
  isSelected,
  onSelect,
  onToggleCheck,
  onOpenInEditor,
  onRevealInOS,
  onRollback,
  onStage,
  onUnstage,
}) => {
  const { t } = useTranslation();

  return (
    <div
      onClick={() => onSelect(file.path)}
      className={`mx-1.5 my-0.5 px-2.5 py-1.5 rounded-lg flex flex-col justify-center cursor-pointer transition-all text-[11px] border group/row gap-0.5 ${
        isSelected
          ? 'bg-theme-active text-theme-active-text border-theme-border-active shadow-2xs font-medium'
          : 'border-transparent hover:bg-theme-hover text-theme-main'
      }`}
      title={file.path}
    >
      {/* Top Line: Checkbox + Icon + FileName + Actions + Status */}
      <div className="flex items-center justify-between gap-1.5 min-w-0 w-full">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleCheck(file.path);
            }}
            className="cursor-pointer shrink-0"
          >
            {file.checked ? (
              <CheckSquare className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            ) : (
              <Square className="w-3.5 h-3.5 text-theme-dim hover:text-theme-main shrink-0" />
            )}
          </div>

          {renderFileIcon(file.fileName)}

          <span
            className={`truncate whitespace-nowrap text-xs font-semibold ${
              isSelected ? 'text-theme-active-text font-bold' : 'text-theme-main'
            }`}
            title={file.path}
          >
            {file.fileName}
          </span>
        </div>

        {/* Right Actions & Status */}
        <div className="shrink-0 flex items-center gap-1 ml-auto">
          <div className="hidden group-hover/row:flex items-center gap-0.5 bg-theme-card px-1 py-0.5 rounded border border-theme-border-card shadow-xs">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenInEditor(file.path);
              }}
              className="p-0.5 hover:text-sky-400 hover:bg-theme-card-hover rounded transition cursor-pointer"
              title={t.statusPanel.openInInternalEditorTooltip}
            >
              <FileEdit className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRevealInOS(file.path);
              }}
              className="p-0.5 hover:text-amber-400 hover:bg-theme-card-hover rounded transition cursor-pointer"
              title={t.diff.revealInExplorerTooltip}
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRollback(file.path);
              }}
              className="p-0.5 hover:text-rose-400 hover:bg-theme-card-hover rounded transition cursor-pointer"
              title={t.statusPanel.discardFileTooltip}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (file.checked) {
                  onUnstage(file.path);
                } else {
                  onStage(file.path);
                }
              }}
              className={`p-0.5 hover:bg-theme-card-hover rounded transition cursor-pointer ${
                file.checked ? 'hover:text-amber-400' : 'hover:text-emerald-400'
              }`}
              title={file.checked ? t.statusPanel.unstageFileTooltip : t.statusPanel.stageFileTooltip}
            >
              {file.checked ? (
                <Minus className="w-3.5 h-3.5 text-sky-400" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {renderStatusBadge(file.status)}
        </div>
      </div>

      {/* Bottom Line: Directory Path */}
      {file.dirPath && (
        <div className="pl-[26px] min-w-0 w-full flex items-center">
          <span
            className={`text-[10px] font-mono truncate ${
              isSelected ? 'text-theme-active-dim' : 'text-theme-dim opacity-75'
            }`}
            title={file.path}
          >
            {file.dirPath}
          </span>
        </div>
      )}
    </div>
  );
};
