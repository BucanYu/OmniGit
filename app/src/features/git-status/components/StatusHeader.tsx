import React from 'react';
import {
  Undo2,
  RefreshCw,
  Columns2,
  List,
  FolderTree,
  Settings,
} from 'lucide-react';
import { useTranslation } from '../../../locales';

interface StatusHeaderProps {
  activeTab: 'commit' | 'shelf' | 'log';
  setActiveTab: (tab: 'commit' | 'shelf' | 'log') => void;
  statusPanelWidth: number;
  isRightPanelOpen: boolean;
  isRepoLoading: boolean;
  viewStyle: 'tree' | 'flat';
  onRollbackClick: () => void;
  onRefresh: () => void;
  onToggleRightPanel: () => void;
  onToggleViewStyle: () => void;
}

export const StatusHeader: React.FC<StatusHeaderProps> = ({
  activeTab,
  setActiveTab,
  statusPanelWidth,
  isRightPanelOpen,
  isRepoLoading,
  viewStyle,
  onRollbackClick,
  onRefresh,
  onToggleRightPanel,
  onToggleViewStyle,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* 1. Header Tabs (Commit / Shelf / Log) */}
      <div className="h-9 px-2 border-b border-theme-border flex items-center justify-between bg-theme-header overflow-hidden min-w-0">
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-theme-subbar border border-theme-border shadow-inner max-w-full overflow-hidden">
          <button
            onClick={() => setActiveTab('commit')}
            title={t.statusPanel.tabs.changesTooltip || t.statusPanel.tabs.changes}
            className={`px-2.5 sm:px-3 py-0.5 font-semibold rounded-md text-xs transition-all cursor-pointer truncate ${
              activeTab === 'commit'
                ? 'bg-theme-card text-theme-main shadow-xs'
                : 'text-theme-muted hover:text-theme-main'
            }`}
          >
            {statusPanelWidth < 300 && t.statusPanel.tabs.changesShort
              ? t.statusPanel.tabs.changesShort
              : t.statusPanel.tabs.changes}
          </button>
          <button
            onClick={() => setActiveTab('shelf')}
            title={t.statusPanel.tabs.shelfTooltip || t.statusPanel.tabs.shelf}
            className={`px-2.5 sm:px-3 py-0.5 font-semibold rounded-md text-xs transition-all cursor-pointer truncate ${
              activeTab === 'shelf'
                ? 'bg-theme-card text-theme-main shadow-xs'
                : 'text-theme-muted hover:text-theme-main'
            }`}
          >
            {statusPanelWidth < 300 && t.statusPanel.tabs.shelfShort
              ? t.statusPanel.tabs.shelfShort
              : t.statusPanel.tabs.shelf}
          </button>
          <button
            onClick={() => setActiveTab('log')}
            title={t.statusPanel.tabs.logTooltip || t.statusPanel.tabs.log}
            className={`px-2.5 sm:px-3 py-0.5 font-semibold rounded-md text-xs transition-all cursor-pointer flex items-center gap-1.5 truncate ${
              activeTab === 'log'
                ? 'bg-theme-card text-theme-main shadow-xs'
                : 'text-theme-muted hover:text-theme-main'
            }`}
          >
            {statusPanelWidth < 300 && t.statusPanel.tabs.logShort
              ? t.statusPanel.tabs.logShort
              : t.statusPanel.tabs.log}
          </button>
        </div>
      </div>

      {activeTab === 'commit' && (
        <div className="h-8 px-2 border-b border-theme-border flex items-center justify-between bg-theme-subbar text-theme-muted">
          <div className="flex items-center gap-1">
            {/* Rollback */}
            <button
              onClick={onRollbackClick}
              className="p-1 hover:text-theme-main hover:bg-theme-hover rounded transition cursor-pointer"
              title={t.statusPanel.toolbar.rollback}
            >
              <Undo2 className="w-3.5 h-3.5 text-theme-main" />
            </button>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              className="p-1 hover:text-theme-main hover:bg-theme-hover rounded transition cursor-pointer"
              title={t.statusPanel.toolbar.refresh}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-theme-main ${isRepoLoading ? 'animate-spin text-sky-400' : ''}`} />
            </button>

            {/* Toggle Diff / Right Panel */}
            <button
              onClick={onToggleRightPanel}
              className={`p-1 rounded transition cursor-pointer ${
                isRightPanelOpen
                  ? 'text-sky-400 bg-sky-500/10'
                  : 'hover:text-theme-main hover:bg-theme-hover text-theme-main'
              }`}
              title={t.statusPanel.toggleRightPanel(isRightPanelOpen)}
            >
              <Columns2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {/* Toggle View Mode: Flat List vs Tree View */}
            <button
              onClick={onToggleViewStyle}
              className="p-1 hover:text-theme-main hover:bg-theme-hover rounded transition cursor-pointer"
              title={viewStyle === 'flat' ? t.statusPanel.switchDirectoryTreeTooltip : t.statusPanel.switchFlatListTooltip}
            >
              {viewStyle === 'flat' ? (
                <List className="w-3.5 h-3.5 text-sky-400" />
              ) : (
                <FolderTree className="w-3.5 h-3.5 text-sky-400" />
              )}
            </button>

            {/* Settings */}
            <button
              className="p-1 hover:text-theme-main hover:bg-theme-hover rounded transition cursor-pointer"
              title={t.statusPanel.viewOptionsTooltip}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
