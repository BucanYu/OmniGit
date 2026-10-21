import React from 'react';
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { useTranslation } from '../../../locales';
import type { GitFileItem } from '../../../store/useAppStore';
import { renderFileIcon } from './StatusFileItem';

interface StatusConflictGroupProps {
  conflictFiles: GitFileItem[];
  collapsed: boolean;
  selectedFilePath: string | null;
  onToggleCollapse: () => void;
  onOpenConflictsDialog: () => void;
  onOpenThreeWayMerge: (filePath: string) => void;
  onSelectFile: (filePath: string) => void;
  onRevealInOS: (filePath: string) => void;
}

export const StatusConflictGroup: React.FC<StatusConflictGroupProps> = ({
  conflictFiles,
  collapsed,
  selectedFilePath,
  onToggleCollapse,
  onOpenConflictsDialog,
  onOpenThreeWayMerge,
  onSelectFile,
  onRevealInOS,
}) => {
  const { t } = useTranslation();

  if (conflictFiles.length === 0) return null;

  return (
    <div>
      <div className="px-2 py-1 flex items-center justify-between hover:bg-theme-hover group cursor-pointer text-theme-main">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="p-0.5 hover:text-theme-main text-theme-dim"
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </span>

          <div
            onClick={onToggleCollapse}
            className="font-sans font-bold text-rose-400 text-xs truncate flex-1 flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{t.statusPanel.groups.conflicts}</span>
            <span className="font-normal text-rose-400/80 text-[11px]">
              {t.statusPanel.conflictsCountTitle(conflictFiles.length)}
            </span>
          </div>
        </div>

        {/* Group quick actions: Resolve (Conflicts dialog) + Merge... (3-Way Merge) */}
        <div className="flex items-center gap-1 mr-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenConflictsDialog();
            }}
            className="px-2 py-0.5 rounded text-[11px] text-[#3574f0] hover:bg-[#3574f0]/10 font-bold transition cursor-pointer"
            title={t.statusPanel.conflictsDialogTooltip}
          >
            {t.statusPanel.resolveBtn}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenThreeWayMerge(conflictFiles[0].path);
            }}
            className="px-2 py-0.5 rounded text-[11px] text-theme-muted hover:text-theme-main hover:bg-theme-hover font-medium transition cursor-pointer"
            title={t.statusPanel.threeWayMergeTooltip}
          >
            {t.statusPanel.mergeQuickBtn}
          </button>
        </div>
      </div>

      {!collapsed &&
        conflictFiles.map((file) => {
          const isSelected = file.path === selectedFilePath;
          return (
            <div
              key={file.path}
              onClick={() => {
                onSelectFile(file.path);
              }}
              onDoubleClick={() => onOpenThreeWayMerge(file.path)}
              className={`px-3 py-1.5 flex flex-col justify-center cursor-pointer transition text-[11px] border-l-2 group/row gap-0.5 ${
                isSelected
                  ? 'bg-rose-500/20 text-rose-200 border-rose-500 shadow-2xs'
                  : 'border-transparent hover:bg-rose-500/10 text-rose-300'
              }`}
              title={file.path}
            >
              {/* Top Line: Badge C + Icon + FileName + Conflict Action */}
              <div className="flex items-center justify-between gap-1.5 min-w-0 w-full">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="w-3.5 h-3.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[9px] font-bold flex items-center justify-center shrink-0">
                    C
                  </span>

                  {renderFileIcon(file.fileName)}

                  <span
                    className={`truncate whitespace-nowrap text-xs font-semibold ${
                      isSelected ? 'text-white font-bold' : 'text-rose-300'
                    }`}
                    title={file.path}
                  >
                    {file.fileName}
                  </span>
                </div>

                {/* Conflict Row Action: Reveal Folder & Merge... button */}
                <div className="flex items-center gap-1 shrink-0 ml-auto">
                  <div className="flex items-center gap-0.5 text-theme-dim opacity-50 group-hover/row:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRevealInOS(file.path);
                      }}
                      className="p-1 hover:text-amber-400 hover:bg-theme-hover rounded transition cursor-pointer"
                      title={t.diff.revealInExplorerTooltip}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectFile(file.path);
                      onOpenThreeWayMerge(file.path);
                    }}
                    className="px-2 py-0.5 rounded text-[11px] text-[#3574f0] hover:bg-[#3574f0]/10 font-semibold transition cursor-pointer"
                    title={t.statusPanel.threeWayMergeTooltip}
                  >
                    {t.statusPanel.mergeQuickBtn}
                  </button>
                </div>
              </div>

              {/* Bottom Line (Stacked): Directory Path */}
              {file.dirPath && (
                <div className="pl-[26px] min-w-0 w-full flex items-center">
                  <span
                    className="text-[10px] font-mono truncate text-rose-300/70"
                    title={file.path}
                  >
                    {file.dirPath}
                  </span>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
};
