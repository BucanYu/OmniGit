import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../locales';
import {
  X,
  FileCode,
  Undo2,
  Minus,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export function ConflictsDialog() {
  const { t } = useTranslation();
  const {
    conflictsDialogOpen,
    conflictsDialogMinimized,
    closeConflictsDialog,
    setConflictsDialogMinimized,
    files,
    isMerging,
    mergeSourceBranch,
    projects,
    activeProjectId,
    openThreeWayMerge,
    resolveConflictQuick,
    abortCurrentMerge,
    theme,
  } = useAppStore();

  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [groupByDir, setGroupByDir] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  if (!conflictsDialogOpen) return null;

  const currentProject = projects.find((p) => p.id === activeProjectId);
  const currentBranch = currentProject?.currentBranch || 'dev';
  const incomingBranch = mergeSourceBranch || 'demo-incoming-theirs';

  const conflictFiles = (files || []).filter((f) => f.status === 'conflict');
  const activeFile = selectedFilePath
    ? conflictFiles.find((f) => f.path === selectedFilePath) || conflictFiles[0]
    : conflictFiles[0];

  const isLight = theme === 'idea-light';

  // 1. Minimized Dock Badge (Bottom Right Floating Pill)
  if (conflictsDialogMinimized) {
    return (
      <div
        onClick={() => setConflictsDialogMinimized(false)}
        className={`fixed bottom-4 right-6 z-50 px-3.5 py-2 rounded-lg shadow-2xl border flex items-center gap-2.5 cursor-pointer transition-all hover:scale-105 select-none ${
          isLight
            ? 'bg-white text-[#27282c] border-[#c0c4cb] shadow-gray-400/30'
            : 'bg-[#2b2d30] text-[#dfe1e5] border-[#4e5157] shadow-black/60'
        }`}
        title={t.modals.conflicts.restoreTooltip}
      >
        <div className="w-4 h-4 rounded bg-gradient-to-br from-blue-500 to-amber-500 text-white font-bold text-[9px] flex items-center justify-center">
          ⚑
        </div>
        <span className="font-semibold text-xs">Conflicts ({conflictFiles.length})</span>
        <span className="text-[11px] text-[#3574f0] font-medium ml-1">{t.modals.conflicts.restoreBtn} 🗖</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            closeConflictsDialog();
          }}
          className="p-1 hover:bg-rose-500 hover:text-white rounded transition text-gray-400 cursor-pointer ml-1"
          title={t.common.closeWindow}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const handleResolve = async (resolution: 'yours' | 'theirs') => {
    if (!activeFile) return;
    setIsResolving(true);
    try {
      await resolveConflictQuick(activeFile.path, resolution);
    } finally {
      setIsResolving(false);
    }
  };

  const handleMerge = () => {
    if (!activeFile) return;
    openThreeWayMerge(activeFile.path);
  };

  const handleAbort = async () => {
    try {
      await abortCurrentMerge();
      setShowAbortConfirm(false);
    } catch {}
  };

  const getFileBadge = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toUpperCase() || 'FILE';
    if (ext === 'TS' || ext === 'TSX') {
      return <span className="w-4 h-4 rounded bg-[#3178c6] text-white text-[9px] font-bold flex items-center justify-center shrink-0">TS</span>;
    }
    if (ext === 'JS' || ext === 'JSX') {
      return <span className="w-4 h-4 rounded bg-[#f7df1e] text-black text-[9px] font-bold flex items-center justify-center shrink-0">JS</span>;
    }
    if (ext === 'JAVA') {
      return <span className="w-4 h-4 rounded bg-[#b07219] text-white text-[9px] font-bold flex items-center justify-center shrink-0">C</span>;
    }
    return <FileCode className="w-4 h-4 text-sky-400 shrink-0" />;
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs transition-all ${
        isMaximized ? 'p-0' : 'p-4'
      } animate-in fade-in duration-150 select-none`}
    >
      <div
        className={`flex flex-col overflow-hidden shadow-2xl transition-all duration-150 border ${
          isMaximized
            ? 'w-full h-full rounded-none border-none'
            : 'w-[820px] max-w-full max-h-[85vh] rounded-xl'
        } ${
          isLight
            ? 'bg-white border-[#c0c4cb] text-[#27282c]'
            : 'bg-[#2b2d30] border-[#393b40] text-[#bcbec4]'
        }`}
      >
        {/* 1. Header (1:1 IntelliJ IDEA Style: media_1788944984139.png) */}
        <div
          onDoubleClick={() => setIsMaximized(!isMaximized)}
          className={`px-4 py-2 border-b flex items-center justify-between cursor-default shrink-0 ${
            isLight
              ? 'bg-[#ebedf0] border-[#d1d5db] text-[#27282c]'
              : 'bg-[#2b2d30] border-[#393b40] text-[#dfe1e5]'
          }`}
          title={t.modals.conflicts.doubleClickHeader}
        >
          <div className="flex items-center gap-2">
            {/* IDEA Conflict Logo Badge */}
            <div className="w-4 h-4 rounded bg-gradient-to-br from-blue-500 to-amber-500 text-white font-bold text-[9px] flex items-center justify-center shadow-2xs">
              ⚑
            </div>
            <span className="font-bold text-xs">{t.modals.conflicts.title}</span>
          </div>

          {/* Window Control Buttons (Minimize, Maximize/Restore, Close) */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setConflictsDialogMinimized(true)}
              className={`p-1 rounded transition cursor-pointer ${
                isLight
                  ? 'text-gray-500 hover:text-black hover:bg-black/10'
                  : 'text-[#868a91] hover:text-white hover:bg-[#393b40]'
              }`}
              title={t.modals.conflicts.minimizeWindow}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className={`p-1 rounded transition cursor-pointer ${
                isLight
                  ? 'text-gray-500 hover:text-black hover:bg-black/10'
                  : 'text-[#868a91] hover:text-white hover:bg-[#393b40]'
              }`}
              title={isMaximized ? t.modals.conflicts.restoreWindow : t.modals.conflicts.maximizeWindow}
            >
              {isMaximized ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={closeConflictsDialog}
              className={`p-1 rounded transition cursor-pointer ${
                isLight
                  ? 'text-gray-500 hover:text-white hover:bg-rose-600'
                  : 'text-[#868a91] hover:text-white hover:bg-rose-600'
              }`}
              title={t.common.closeWindow}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Subtitle Header (1:1 with media_1788944984139.png) */}
        <div
          className={`px-4 py-2 text-xs border-b shrink-0 ${
            isLight
              ? 'bg-[#f7f8fa] text-[#57606a] border-[#e1e4e8]'
              : 'bg-[#2b2d30] text-[#868a91] border-[#393b40]/50'
          }`}
        >
          Merging branch <strong className={isLight ? 'text-[#1f2328]' : 'text-[#dfe1e5]'}>{incomingBranch}</strong> into branch <strong className={isLight ? 'text-[#1f2328]' : 'text-[#dfe1e5]'}>{currentBranch}</strong>
        </div>

        {/* 2. Main Workbench: Left Table + Right Actions Column (1:1 IDEA Layout) */}
        <div className="flex flex-1 p-3 gap-3 overflow-hidden min-h-[280px]">
          {/* 2.1 Left Table Area */}
          <div
            className={`flex-1 border rounded flex flex-col overflow-hidden ${
              isLight
                ? 'border-[#d1d5db] bg-white'
                : 'border-[#393b40] bg-[#1e1f22]'
            }`}
          >
            {/* Table Header */}
            <div
              className={`grid grid-cols-[1fr_110px_140px] border-b text-[11px] font-medium px-3 py-1.5 shrink-0 ${
                isLight
                  ? 'bg-[#f2f3f5] border-[#d1d5db] text-[#57606a]'
                  : 'bg-[#2b2d30] border-[#393b40] text-[#868a91]'
              }`}
            >
              <div>{t.modals.conflicts.nameColumn}</div>
              <div className="truncate">Yours ({currentBranch})</div>
              <div className="truncate">Theirs ({incomingBranch})</div>
            </div>

            {/* Table Body */}
            <div className={`flex-1 overflow-y-auto divide-y ${
              isLight ? 'divide-[#e1e4e8]' : 'divide-[#393b40]/30'
            }`}>
              {conflictFiles.length === 0 ? (
                <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center">
                  <span className="text-emerald-500 font-bold mb-1">{t.modals.conflicts.allResolved}</span>
                  <p className="text-[11px]">{t.modals.conflicts.allResolvedDesc}</p>
                </div>
              ) : (
                conflictFiles.map((file) => {
                  const isSelected = activeFile?.path === file.path;
                  return (
                    <div
                      key={file.path}
                      onClick={() => setSelectedFilePath(file.path)}
                      onDoubleClick={handleMerge}
                      className={`grid grid-cols-[1fr_110px_140px] items-center px-3 py-1.5 cursor-pointer text-xs transition ${
                        isSelected
                          ? isLight
                            ? 'bg-[#3574f0] text-white font-medium shadow-xs'
                            : 'bg-[#2e436e] text-white font-medium'
                          : isLight
                          ? 'hover:bg-[#f2f3f5] text-[#27282c]'
                          : 'hover:bg-[#2b2d30]/60 text-[#bcbec4]'
                      }`}
                    >
                      {/* Name with File Icon & Path */}
                      <div className="flex items-center gap-2 overflow-hidden pr-2">
                        {getFileBadge(file.fileName)}
                        <span className={`font-semibold truncate ${
                          isSelected
                            ? 'text-white'
                            : 'text-rose-500 font-bold'
                        }`}>
                          {file.fileName}
                        </span>
                        <span
                          className={`text-[10px] truncate ${
                            isSelected
                              ? 'text-white/80'
                              : isLight ? 'text-gray-400' : 'text-[#868a91]'
                          }`}
                          title={file.path}
                        >
                          {file.dirPath || currentProject?.name || ''}
                        </span>
                      </div>

                      {/* Yours */}
                      <div className={`text-[11px] ${
                        isSelected ? 'text-white/90' : isLight ? 'text-gray-500' : 'text-[#868a91]'
                      }`}>
                        Modified
                      </div>

                      {/* Theirs */}
                      <div className={`text-[11px] ${
                        isSelected ? 'text-white/90' : isLight ? 'text-gray-500' : 'text-[#868a91]'
                      }`}>
                        Modified
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 2.2 Right Action Buttons (1:1 IDEA Style: media_1788944984139.png) */}
          <div className="w-36 flex flex-col gap-2 shrink-0">
            {/* 1. Accept Yours */}
            <button
              type="button"
              disabled={!activeFile || isResolving}
              onClick={() => handleResolve('yours')}
              className={`w-full px-3 py-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed border text-xs font-medium transition cursor-pointer shadow-xs ${
                isLight
                  ? 'bg-white hover:bg-[#f2f3f5] text-[#27282c] border-[#c0c4cb]'
                  : 'bg-[#393b40] hover:bg-[#43454a] text-[#dfe1e5] border-[#4e5157]'
              }`}
              title={t.modals.conflicts.acceptYoursTooltip}
            >
              Accept Yours
            </button>

            {/* 2. Accept Theirs */}
            <button
              type="button"
              disabled={!activeFile || isResolving}
              onClick={() => handleResolve('theirs')}
              className={`w-full px-3 py-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed border text-xs font-medium transition cursor-pointer shadow-xs ${
                isLight
                  ? 'bg-white hover:bg-[#f2f3f5] text-[#27282c] border-[#c0c4cb]'
                  : 'bg-[#393b40] hover:bg-[#43454a] text-[#dfe1e5] border-[#4e5157]'
              }`}
              title={t.modals.conflicts.acceptTheirsTooltip}
            >
              Accept Theirs
            </button>

            {/* 3. Merge... (Primary Blue Button with underline on M) */}
            <button
              type="button"
              disabled={!activeFile || isResolving}
              onClick={handleMerge}
              className="w-full px-3 py-1.5 rounded bg-[#3574f0] hover:bg-[#265ed4] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition cursor-pointer shadow-md mt-1"
              title={t.modals.conflicts.mergeToolTooltip}
            >
              <u>M</u>erge...
            </button>
          </div>
        </div>

        {/* Abort warning banner if user requested abort */}
        {showAbortConfirm && (
          <div className="mx-3 mb-2 p-2 bg-rose-500/15 border border-rose-500/30 rounded flex items-center justify-between text-xs text-rose-400 shrink-0">
            <span>{t.modals.conflicts.abortMergeConfirmTitle}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAbortConfirm(false)}
                className="px-2 py-0.5 rounded hover:underline text-gray-500 cursor-pointer"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleAbort}
                className="px-2.5 py-0.5 rounded bg-rose-600 text-white font-bold cursor-pointer"
              >
                {t.modals.conflicts.confirmAbortBtn}
              </button>
            </div>
          </div>
        )}

        {/* 3. Bottom Bar: [ ] Group files by directory | [ Close ] (1:1 with media_1788944984139.png) */}
        <div
          className={`px-4 py-2.5 border-t flex items-center justify-between shrink-0 ${
            isLight
              ? 'bg-[#f7f8fa] border-[#e1e4e8]'
              : 'bg-[#2b2d30] border-[#393b40]'
          }`}
        >
          <label className={`flex items-center gap-2 text-xs cursor-pointer ${
            isLight ? 'text-[#57606a] hover:text-[#1f2328]' : 'text-[#868a91] hover:text-[#dfe1e5]'
          }`}>
            <input
              type="checkbox"
              checked={groupByDir}
              onChange={(e) => setGroupByDir(e.target.checked)}
              className="rounded border-gray-400 bg-transparent text-[#3574f0] focus:ring-0 cursor-pointer"
            />
            <span>{t.modals.conflicts.groupByDirectory}</span>
          </label>

          <div className="flex items-center gap-2">
            {(isMerging || conflictFiles.length > 0) && (
              <button
                type="button"
                onClick={() => setShowAbortConfirm(true)}
                className="px-2.5 py-1 rounded text-[11px] text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer flex items-center gap-1"
                title={t.modals.conflicts.abortMergeTooltip}
              >
                <Undo2 className="w-3 h-3" />
                <span>{t.modals.conflicts.abortMergeBtn}</span>
              </button>
            )}

            <button
              type="button"
              onClick={closeConflictsDialog}
              className={`px-4 py-1.5 rounded border text-xs font-medium transition cursor-pointer shadow-xs ${
                isLight
                  ? 'bg-white hover:bg-[#f2f3f5] text-[#27282c] border-[#c0c4cb]'
                  : 'bg-[#393b40] hover:bg-[#43454a] text-[#dfe1e5] border-[#4e5157]'
              }`}
            >
              {t.common.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
