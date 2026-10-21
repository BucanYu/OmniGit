import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  GitCommit,
  FolderOpen,
} from 'lucide-react';
import { useTranslation } from '../../../locales';
import { renderFileIcon } from './StatusFileItem';

interface HistoricalFile {
  path: string;
  statusCode?: string;
}

interface LastCommitDetailsType {
  hash: string;
  subject: string;
  body?: string;
  files?: HistoricalFile[];
}

interface StatusAmendFilesDrawerProps {
  isAmend: boolean;
  lastCommitDetails: LastCommitDetailsType | null;
  selectedHistoricalFilePath: string | null;
  onSelectHistoricalFileDiff: (hash: string, path: string) => void;
  onRevealFileInOS: (path: string) => void;
}

export const StatusAmendFilesDrawer: React.FC<StatusAmendFilesDrawerProps> = ({
  isAmend,
  lastCommitDetails,
  selectedHistoricalFilePath,
  onSelectHistoricalFileDiff,
  onRevealFileInOS,
}) => {
  const { t } = useTranslation();
  const [isAmendFilesCollapsed, setIsAmendFilesCollapsed] = useState(false);

  if (!isAmend || !lastCommitDetails || !lastCommitDetails.files || lastCommitDetails.files.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="px-2 py-1 flex items-center justify-between hover:bg-theme-hover group cursor-pointer text-theme-main">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span
            onClick={(e) => {
              e.stopPropagation();
              setIsAmendFilesCollapsed(!isAmendFilesCollapsed);
            }}
            className="p-0.5 hover:text-theme-main text-theme-dim"
          >
            {isAmendFilesCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </span>

          <GitCommit className="w-3.5 h-3.5 text-blue-400 shrink-0" />

          <span
            onClick={() => setIsAmendFilesCollapsed(!isAmendFilesCollapsed)}
            className="font-sans font-medium text-theme-main text-xs truncate"
            title={lastCommitDetails.subject}
          >
            {lastCommitDetails.subject}{' '}
            <span className="font-normal text-theme-dim text-[11px]">
              {t.statusPanel.fileCountFormat(lastCommitDetails.files.length)}
            </span>
          </span>
        </div>
      </div>

      {!isAmendFilesCollapsed &&
        lastCommitDetails.files.map((file) => {
          const fileName = file.path.split('/').pop() || file.path;
          const dirPath = file.path.substring(0, file.path.lastIndexOf('/'));
          const isSelected = file.path === selectedHistoricalFilePath;

          return (
            <div
              key={file.path}
              onClick={() => onSelectHistoricalFileDiff(lastCommitDetails.hash, file.path)}
              className={`px-3 py-1.5 flex flex-col justify-center cursor-pointer transition text-[11px] border-l-2 group/row gap-0.5 ${
                isSelected
                  ? 'bg-theme-active text-theme-active-text border-theme-border-active shadow-2xs'
                  : 'border-transparent hover:bg-theme-hover text-theme-main'
              }`}
              title={file.path}
            >
              {/* Top Line: Icon + FileName + Actions + Status */}
              <div className="flex items-center justify-between gap-1.5 min-w-0 w-full">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {renderFileIcon(fileName)}
                  <span
                    className={`truncate whitespace-nowrap text-xs font-semibold ${
                      isSelected ? 'text-theme-active-text font-bold' : 'text-theme-main'
                    }`}
                    title={file.path}
                  >
                    {fileName}
                  </span>
                </div>

                <div className="shrink-0 flex items-center gap-1 ml-auto">
                  <div className="flex items-center gap-0.5 text-theme-dim opacity-50 group-hover/row:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRevealFileInOS(file.path);
                      }}
                      className="p-0.5 hover:text-amber-400 hover:bg-theme-card-hover rounded transition cursor-pointer"
                      title={t.diff.revealInExplorerTooltip}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="font-mono text-[10px] font-bold text-sky-400">
                    {file.statusCode || 'M'}
                  </div>
                </div>
              </div>

              {/* Bottom Line (Stacked): Directory Path */}
              {dirPath && (
                <div className="pl-[18px] min-w-0 w-full flex items-center">
                  <span
                    className={`text-[10px] font-mono truncate ${
                      isSelected ? 'text-theme-active-dim' : 'text-theme-dim opacity-75'
                    }`}
                    title={file.path}
                  >
                    {dirPath}
                  </span>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
};
