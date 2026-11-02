import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../locales';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { ImageViewer } from '../code-editor/ImageViewer';
import { isImageFile } from '../code-editor/imageUtils';
import {
  toggleEditorComment,
  registerAllLanguageComments,
} from '../../utils/editorCommentUtils';
import {
  Save,
  CheckCircle2,
  FileText,
  Search,
  ChevronUp,
  ChevronDown,
  X,
  GitCompare,
  History,
  FileEdit,
  Copy,
  Check,
  FileCode,
  WrapText,
  FolderOpen,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  hasGitConflictMarkers,
  insertSelectionFromOriginalToModified,
  getLanguageFromPath,
  DiffConflictActionBar,
  DiffSubheader,
  DiffPathHoverCard,
  DiffBinaryPlaceholder,
} from './DiffEditorSubcomponents';

export function DiffEditorPanel() {
  const {
    files,
    selectedFilePath,
    selectedFileDiff,
    editorViewMode,
    setEditorViewMode,
    saveCurrentFile,
    theme,
    projects,
    activeProjectId,
    historicalDiff,
    clearHistoricalDiff,
    closeRightPanel,
    openThreeWayMerge,
    resolveConflictQuick,
    markConflictResolved,
    openConflictsDialog,
    revealFileInOS,
    openFileInEditor,
    isRepoLoading,
  } = useAppStore();
  const { t } = useTranslation();
  const [wordWrap, setWordWrap] = useState(true);
  const [saved, setSaved] = useState(false);
  const diffEditorRef = useRef<any>(null);
  const singleEditorRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState<number>(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setPanelWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const isUltraCompact = panelWidth < 500;
  const isCompact = panelWidth < 700;
  const isWide = panelWidth >= 880;
  const isVeryWide = panelWidth >= 1080;

  const [copiedType, setCopiedType] = useState<'relative' | 'full' | null>(null);
  const [isPathHovered, setIsPathHovered] = useState(false);
  const hoverTimeoutRef = useRef<any>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [lineChanges, setLineChanges] = useState<any[]>([]);
  const [currentDiffIndex, setCurrentDiffIndex] = useState<number>(-1);

  const isHistorical = Boolean(historicalDiff);
  const selectedFile = files.find((f) => f.path === selectedFilePath);
  const activeProject = projects.find((p) => p.id === activeProjectId);

  const relativePath = isHistorical ? historicalDiff!.filePath : selectedFile?.path || '';
  const fullAbsolutePath = activeProject
    ? `${activeProject.path}\\${relativePath.replace(/\//g, '\\')}`
    : relativePath;

  const normRelPath = relativePath.replace(/\\/g, '/');
  const pathParts = normRelPath.split('/');
  const fileName = pathParts.pop() || normRelPath;
  const parentDir = pathParts.join('/');

  const originalContent = isHistorical
    ? historicalDiff?.original || ''
    : selectedFileDiff?.oldContent || '';
  const modifiedContent = isHistorical
    ? historicalDiff?.modified || ''
    : selectedFileDiff?.newContent || '';

  const handleCopyPath = (text: string, type: 'relative' | 'full', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleSave = async () => {
    if (isHistorical) return;
    let currentText = '';
    if (editorViewMode === 'editor') {
      currentText = singleEditorRef.current ? singleEditorRef.current.getValue() : modifiedContent;
    } else {
      currentText = diffEditorRef.current
        ? diffEditorRef.current.getModifiedEditor().getValue()
        : modifiedContent;
    }

    const success = await saveCurrentFile(currentText);
    if (success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorViewMode, isHistorical, modifiedContent]);

  useEffect(() => {
    if (diffEditorRef.current) {
      try {
        diffEditorRef.current.updateOptions({
          renderSideBySide: true,
          useInlineViewWhenSpaceIsLimited: false,
          renderSideBySideInlineBreakpoint: 0,
          readOnly: isHistorical,
        });
      } catch {}
    }
  }, [isHistorical, relativePath, editorViewMode]);

  useEffect(() => {
    const handleCloseFindWidget = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const closeBtn = target?.closest?.(
        '.find-widget .button.codicon-widget-close, .find-widget .button[aria-label*="Close"], .find-widget .close-button'
      );
      if (closeBtn) {
        if (diffEditorRef.current) {
          try {
            diffEditorRef.current.getModifiedEditor()?.trigger('keyboard', 'closeFindWidget', null);
            diffEditorRef.current.getOriginalEditor()?.trigger('keyboard', 'closeFindWidget', null);
          } catch {}
        }
        if (singleEditorRef.current) {
          try {
            singleEditorRef.current.trigger('keyboard', 'closeFindWidget', null);
          } catch {}
        }
      }
    };

    const handleEscapeFindWidget = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const findWidgets = document.querySelectorAll('.find-widget.visible');
        if (findWidgets.length > 0) {
          if (diffEditorRef.current) {
            try {
              diffEditorRef.current
                .getModifiedEditor()
                ?.trigger('keyboard', 'closeFindWidget', null);
              diffEditorRef.current
                .getOriginalEditor()
                ?.trigger('keyboard', 'closeFindWidget', null);
            } catch {}
          }
          if (singleEditorRef.current) {
            try {
              singleEditorRef.current.trigger('keyboard', 'closeFindWidget', null);
            } catch {}
          }
        }
      }
    };

    document.addEventListener('click', handleCloseFindWidget, true);
    document.addEventListener('keydown', handleEscapeFindWidget, true);
    return () => {
      document.removeEventListener('click', handleCloseFindWidget, true);
      document.removeEventListener('keydown', handleEscapeFindWidget, true);
    };
  }, []);

  if (isRepoLoading && !selectedFile && !isHistorical) {
    return (
      <div
        ref={containerRef}
        className="flex-1 bg-theme-panel flex flex-col items-center justify-center text-theme-dim text-xs select-none"
      >
        <RefreshCw className="w-8 h-8 text-sky-400 mb-3 animate-spin stroke-[1.5]" />
        <p className="text-theme-muted font-medium text-sm">{t.statusPanel.loadingWorkspace}</p>
        <p className="text-theme-dim text-[11px] mt-1">{t.diff.readingRepoDiff}</p>
      </div>
    );
  }

  if (!selectedFile && !isHistorical) {
    return (
      <div
        ref={containerRef}
        className="flex-1 bg-theme-panel flex flex-col items-center justify-center text-theme-dim text-xs select-none"
      >
        <FileText className="w-10 h-10 text-theme-dim mb-2 stroke-[1.5]" />
        <p className="text-theme-muted font-medium">{t.diff.noFileSelected}</p>
        <p className="text-theme-dim text-[11px] mt-1 text-center max-w-md">
          {t.diff.selectFileHint}
        </p>
      </div>
    );
  }

  const handleMountDiffEditor = (editor: any, monaco: any) => {
    diffEditorRef.current = editor;

    try {
      editor.updateOptions({
        renderSideBySide: true,
        useInlineViewWhenSpaceIsLimited: false,
        renderSideBySideInlineBreakpoint: 0,
      });
    } catch (e) {
      console.warn('Failed to lock side-by-side mode on mount', e);
    }

    registerAllLanguageComments(monaco);

    const modifiedEditor = editor.getModifiedEditor();
    if (modifiedEditor) {
      modifiedEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        handleSave();
      });
      modifiedEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
        const lang = getLanguageFromPath(selectedFile?.path || '');
        toggleEditorComment(modifiedEditor, lang, selectedFile?.path);
      });
    }

    const originalEditor = editor.getOriginalEditor();
    if (originalEditor) {
      originalEditor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Enter, () => {
        insertSelectionFromOriginalToModified(diffEditorRef.current);
      });
      originalEditor.addAction({
        id: 'insert-selection-to-modified',
        label: t.diff.insertCodeTooltip,
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.Enter],
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        run: () => {
          insertSelectionFromOriginalToModified(diffEditorRef.current);
        },
      });
    }

    editor.onDidUpdateDiff(() => {
      const changes = editor.getLineChanges() || [];
      setLineChanges(changes);
      if (changes.length > 0 && currentDiffIndex === -1) {
        setCurrentDiffIndex(0);
      }
    });
  };

  const handleMountSingleEditor = (editor: any, monaco: any) => {
    singleEditorRef.current = editor;
    registerAllLanguageComments(monaco);

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      const lang = getLanguageFromPath(selectedFile?.path || '');
      toggleEditorComment(editor, lang, selectedFile?.path);
    });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    let model: any = null;
    if (editorViewMode === 'editor') {
      model = singleEditorRef.current?.getModel();
    } else {
      model = diffEditorRef.current?.getModifiedEditor()?.getModel();
    }

    if (!query.trim() || !model) {
      setMatches([]);
      setCurrentMatchIndex(0);
      return;
    }

    const found = model.findMatches(query, false, false, false, null, true);
    setMatches(found);
    if (found.length > 0) {
      setCurrentMatchIndex(0);
      revealMatch(0, found);
    } else {
      setCurrentMatchIndex(0);
    }
  };

  const revealMatch = (index: number, foundMatches: any[]) => {
    const match = foundMatches[index];
    if (!match) return;

    if (editorViewMode === 'editor' && singleEditorRef.current) {
      singleEditorRef.current.revealRangeInCenter(match.range);
      singleEditorRef.current.setSelection(match.range);
    } else if (diffEditorRef.current) {
      const modifiedEditor = diffEditorRef.current.getModifiedEditor();
      modifiedEditor?.revealRangeInCenter(match.range);
      modifiedEditor?.setSelection(match.range);
    }
  };

  const handleGoToPrevious = () => {
    if (searchQuery.trim() && matches.length > 0) {
      const prevIdx = (currentMatchIndex - 1 + matches.length) % matches.length;
      setCurrentMatchIndex(prevIdx);
      revealMatch(prevIdx, matches);
    } else if (editorViewMode === 'diff' && diffEditorRef.current) {
      if (diffEditorRef.current.goToDiff) {
        diffEditorRef.current.goToDiff('previous');
      }
      if (lineChanges.length > 0) {
        const prevDiff = currentDiffIndex <= 0 ? lineChanges.length - 1 : currentDiffIndex - 1;
        setCurrentDiffIndex(prevDiff);
        const change = lineChanges[prevDiff];
        const targetLine = change.modifiedStartLineNumber || change.originalStartLineNumber;
        diffEditorRef.current.getModifiedEditor()?.revealLineInCenter(targetLine);
      }
    }
  };

  const handleGoToNext = () => {
    if (searchQuery.trim() && matches.length > 0) {
      const nextIdx = (currentMatchIndex + 1) % matches.length;
      setCurrentMatchIndex(nextIdx);
      revealMatch(nextIdx, matches);
    } else if (editorViewMode === 'diff' && diffEditorRef.current) {
      if (diffEditorRef.current.goToDiff) {
        diffEditorRef.current.goToDiff('next');
      }
      if (lineChanges.length > 0) {
        const nextDiff = (currentDiffIndex + 1) % lineChanges.length;
        setCurrentDiffIndex(nextDiff);
        const change = lineChanges[nextDiff];
        const targetLine = change.modifiedStartLineNumber || change.originalStartLineNumber;
        diffEditorRef.current.getModifiedEditor()?.revealLineInCenter(targetLine);
      }
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handleGoToPrevious();
      } else {
        handleGoToNext();
      }
    } else if (e.key === 'Escape') {
      setSearchQuery('');
      setMatches([]);
    }
  };

  const monacoTheme = theme === 'idea-light' ? 'light' : 'vs-dark';
  const fileLanguage = getLanguageFromPath(relativePath);

  return (
    <div ref={containerRef} className="flex-1 min-w-0 bg-theme-panel flex flex-col h-full overflow-hidden">
      {/* Workbench Header */}
      <div className="h-9 px-2 border-b border-theme-border flex items-center justify-between bg-theme-header text-xs select-none gap-2 overflow-hidden min-w-0">
        {/* Left: File Path & Status Badge with Hover Full Path Preview & Copy */}
        <div
          className="relative flex items-center gap-1 min-w-0 shrink max-w-[28%] md:max-w-[34%] overflow-hidden"
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = setTimeout(() => setIsPathHovered(true), 250);
          }}
          onMouseLeave={() => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = setTimeout(() => setIsPathHovered(false), 200);
          }}
        >
          <div
            className="flex items-center gap-1.5 min-w-0 overflow-hidden px-1.5 py-0.5 rounded hover:bg-theme-hover transition cursor-pointer"
            onClick={(e) => handleCopyPath(fullAbsolutePath, 'full', e)}
            title={t.diff.copyFullPathTooltip(fullAbsolutePath)}
          >
            <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="font-semibold text-theme-main text-xs truncate min-w-0 select-text" title={fileName}>
              {fileName}
            </span>
            {isVeryWide && parentDir && (
              <span className="text-[10px] text-theme-muted font-mono truncate min-w-0 opacity-70 select-text" title={relativePath}>
                {parentDir}
              </span>
            )}
          </div>

          {isWide && (
            <button
              type="button"
              onClick={(e) => handleCopyPath(fullAbsolutePath, 'full', e)}
              className="p-1 rounded text-theme-muted hover:text-sky-400 hover:bg-theme-card-hover transition cursor-pointer shrink-0"
              title={t.diff.copyFullPath}
            >
              {copiedType ? (
                <Check className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {isWide && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                revealFileInOS(relativePath);
              }}
              className="p-1 rounded text-theme-muted hover:text-amber-400 hover:bg-theme-card-hover transition cursor-pointer shrink-0"
              title={t.diff.revealInExplorerTooltip}
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          )}

          {copiedType && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1 py-0.2 rounded shrink-0 font-bold animate-pulse">
              {t.diff.copied}
            </span>
          )}

          {isWide && !isHistorical && selectedFile?.status && (
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase shrink-0 ${
                selectedFile.status === 'modified'
                  ? 'bg-blue-500/20 text-sky-400 border border-blue-500/30'
                  : selectedFile.status === 'added' || selectedFile.status === 'untracked'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {selectedFile.status}
            </span>
          )}

          {isPathHovered && (
            <DiffPathHoverCard
              relativePath={relativePath}
              fullAbsolutePath={fullAbsolutePath}
              isHistorical={isHistorical}
              fileStatus={selectedFile?.status}
              copiedType={copiedType}
              handleCopyPath={handleCopyPath}
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                setIsPathHovered(true);
              }}
              onMouseLeave={() => setIsPathHovered(false)}
            />
          )}
        </div>

        {/* Center: View Mode Toggle Tabs & Search Box */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center bg-theme-input p-0.5 rounded-lg border border-theme-border text-xs shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => setEditorViewMode('diff')}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium transition cursor-pointer text-[11px] ${
                editorViewMode === 'diff'
                  ? 'bg-sky-500 text-white shadow-xs font-semibold'
                  : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover'
              }`}
              title={t.diff.diffViewTooltip}
            >
              <GitCompare className="w-3.5 h-3.5 shrink-0" />
              {!isCompact && <span>{t.diff.modeDiff}</span>}
            </button>
            <button
              type="button"
              onClick={() => setEditorViewMode('editor')}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium transition cursor-pointer text-[11px] ${
                editorViewMode === 'editor'
                  ? 'bg-sky-500 text-white shadow-xs font-semibold'
                  : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover'
              }`}
              title={t.diff.editorViewTooltip}
            >
              <FileEdit className="w-3.5 h-3.5 shrink-0" />
              {!isCompact && <span>{t.diff.modeEditor}</span>}
            </button>
          </div>

          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 bg-theme-input border border-theme-border rounded-lg focus-within:border-sky-500 transition shadow-2xs shrink ${
              isUltraCompact
                ? 'w-20 focus-within:w-28'
                : isCompact
                ? 'w-24 focus-within:w-32'
                : 'w-28 focus-within:w-36'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-theme-dim shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={isCompact ? t.common?.search || '搜索' : t.diff.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="bg-transparent border-none outline-none text-theme-main text-xs w-full min-w-0 placeholder:text-theme-dim"
            />
            {searchQuery.trim() && (
              <span className="text-[10px] font-mono text-sky-400 shrink-0 px-1 py-0.2 rounded-full bg-sky-500/10 font-medium">
                {matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : '0/0'}
              </span>
            )}
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setMatches([]);
                }}
                className="text-theme-dim hover:text-theme-main text-xs px-0.5 cursor-pointer shrink-0"
                title={t.diff.clearSearch}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {(!isCompact || Boolean(searchQuery.trim())) && (
            <div className="flex items-center gap-0.5 bg-theme-card border border-theme-border rounded-lg p-0.5 shrink-0 shadow-2xs">
              <button
                type="button"
                onClick={handleGoToPrevious}
                className="p-1 hover:bg-theme-hover text-theme-dim hover:text-theme-main rounded transition cursor-pointer"
                title={
                  searchQuery.trim()
                    ? t.diff.prevMatchTooltip
                    : editorViewMode === 'diff'
                    ? t.diff.prevDiffTooltip
                    : t.common.back
                }
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleGoToNext}
                className="p-1 hover:bg-theme-hover text-theme-dim hover:text-theme-main rounded transition cursor-pointer"
                title={
                  searchQuery.trim()
                    ? t.diff.nextMatchTooltip
                    : editorViewMode === 'diff'
                    ? t.diff.nextDiffTooltip
                    : t.common.open
                }
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {isWide && editorViewMode === 'diff' && !searchQuery.trim() && lineChanges.length > 0 && (
            <span
              className="flex text-[10px] font-mono text-theme-dim px-1.5 py-0.5 rounded bg-theme-subbar border border-theme-border shrink-0 items-center gap-1"
              title={t.diff.diffChangesCount}
            >
              <GitCompare className="w-3 h-3 text-sky-400" />
              <span>
                {currentDiffIndex >= 0
                  ? `${currentDiffIndex + 1}/${lineChanges.length}`
                  : `${lineChanges.length} ${t.diff.diffChangesCount}`}
              </span>
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {editorViewMode === 'editor' && (
            <button
              onClick={() => setWordWrap(!wordWrap)}
              className={`flex items-center gap-1 px-1.5 py-1 rounded transition cursor-pointer text-[11px] ${
                wordWrap
                  ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                  : 'hover:bg-theme-hover text-theme-muted hover:text-theme-main'
              }`}
              title={t.diff.toggleWordWrapTooltip(wordWrap)}
            >
              <WrapText className="w-3.5 h-3.5" />
              {!isCompact && <span>{t.diff.wordWrap}</span>}
            </button>
          )}

          {isHistorical ? (
            <button
              type="button"
              onClick={clearHistoricalDiff}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 shadow-2xs border bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-200 border-purple-500/30 hover:border-purple-500/50"
              title={t.diff.exitHistoryTooltip}
            >
              <History className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="font-medium whitespace-nowrap">{t.diff.exitHistory}</span>
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="flex items-center gap-1 bg-theme-card hover:bg-theme-card-hover text-theme-main border border-theme-border-card px-2 py-1 rounded-lg transition text-xs cursor-pointer shadow-2xs font-medium shrink-0"
              title={t.diff.saveDiskTooltip}
            >
              {saved ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Save className="w-3.5 h-3.5 text-sky-400" />
              )}
              {!isUltraCompact && <span>{saved ? t.diff.saved : t.diff.save}</span>}
            </button>
          )}

          <div className="h-4 w-[1px] bg-theme-border mx-0.5 shrink-0" />

          <button
            type="button"
            onClick={closeRightPanel}
            className="p-1 rounded-lg hover:bg-theme-hover text-theme-dim hover:text-rose-400 transition cursor-pointer shrink-0"
            title={t.diff.closeSideTooltip}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conflict Resolver Action Bar */}
      {!isHistorical &&
        selectedFile &&
        (selectedFile.status === 'conflict' ||
          (Boolean(modifiedContent) && hasGitConflictMarkers(modifiedContent))) && (
          <DiffConflictActionBar
            filePath={selectedFile.path}
            openConflictsDialog={openConflictsDialog}
            markConflictResolved={markConflictResolved}
            resolveConflictQuick={resolveConflictQuick}
            openThreeWayMerge={openThreeWayMerge}
          />
        )}

      {/* Subheader Toolbar */}
      <DiffSubheader
        editorViewMode={editorViewMode}
        isHistorical={isHistorical}
        oldLabel={historicalDiff?.oldLabel}
        newLabel={historicalDiff?.newLabel}
        isWide={isWide}
        relativePath={relativePath}
        fileName={fileName}
        fileLanguage={fileLanguage}
      />

      {/* Main Monaco Container */}
      <div className="flex-1 relative">
        {isImageFile(fullAbsolutePath) ? (
          <ImageViewer
            filePath={fullAbsolutePath}
            theme={theme}
            onOpenFolder={() => revealFileInOS(relativePath)}
          />
        ) : Boolean(
            selectedFileDiff?.isBinary ||
              originalContent.startsWith('(Binary') ||
              originalContent.startsWith('(\u4e8c\u8fdb\u5236\u6587\u4ef6') ||
              modifiedContent.startsWith('(\u4e8c\u8fdb\u5236\u6587\u4ef6')
          ) ? (
          <DiffBinaryPlaceholder
            fileName={selectedFile?.fileName}
            filePath={selectedFile?.path}
            openFileInEditor={openFileInEditor}
            revealFileInOS={revealFileInOS}
          />
        ) : editorViewMode === 'diff' ? (
          <DiffEditor
            height="100%"
            theme={monacoTheme}
            original={originalContent}
            modified={modifiedContent}
            onMount={handleMountDiffEditor}
            loading={
              <div className="w-full h-full flex items-center justify-center bg-theme-panel text-xs text-theme-muted font-sans select-none gap-2">
                <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                <span>{t.diff.loadingDiff}</span>
              </div>
            }
            options={
              {
                renderSideBySide: true,
                useInlineViewWhenSpaceIsLimited: false,
                renderSideBySideInlineBreakpoint: 0,
                readOnly: isHistorical,
                originalEditable: false,
                automaticLayout: true,
                fontSize: 13,
                lineNumbers: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'off',
                diffWordWrap: 'off',
                enableSplitViewResizing: true,
                hover: { enabled: false },
              } as any
            }
          />
        ) : (
          <Editor
            height="100%"
            theme={monacoTheme}
            language={fileLanguage}
            value={modifiedContent || ''}
            onMount={handleMountSingleEditor}
            loading={
              <div className="w-full h-full flex items-center justify-center bg-theme-panel text-xs text-theme-muted font-sans select-none gap-2">
                <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                <span>{t.diff.loadingEditor}</span>
              </div>
            }
            options={
              {
                readOnly: isHistorical,
                automaticLayout: true,
                fontSize: 13,
                lineNumbers: 'on',
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                wordWrap: wordWrap ? 'on' : 'off',
                tabSize: 2,
                hover: { enabled: false },
              } as any
            }
          />
        )}
      </div>
    </div>
  );
}
