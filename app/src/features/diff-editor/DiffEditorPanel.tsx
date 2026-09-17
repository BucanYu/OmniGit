import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../locales';
import Editor, { DiffEditor } from '@monaco-editor/react';
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
  Lock,
  FileEdit,
  Sparkles,
  Copy,
  Check,
  FileCode,
  WrapText,
  AlertTriangle,
  ArrowRightLeft,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'scss':
    case 'sass':
      return 'scss';
    case 'less':
      return 'less';
    case 'html':
    case 'htm':
      return 'html';
    case 'vue':
      return 'html';
    case 'py':
      return 'python';
    case 'go':
      return 'go';
    case 'rs':
      return 'rust';
    case 'java':
    case 'kt':
    case 'kts':
      return 'java';
    case 'c':
    case 'h':
      return 'c';
    case 'cpp':
    case 'hpp':
    case 'cc':
      return 'cpp';
    case 'cs':
      return 'csharp';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'xml':
    case 'svg':
      return 'xml';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'bat':
    case 'cmd':
      return 'bat';
    case 'ps1':
      return 'powershell';
    case 'sql':
      return 'sql';
    case 'php':
      return 'php';
    case 'dockerfile':
      return 'dockerfile';
    default:
      return 'plaintext';
  }
}

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
    openConflictsDialog,
    revealFileInOS,
    isRepoLoading,
  } = useAppStore();
  const { t } = useTranslation();
  const isSideBySide = true;
  const [wordWrap, setWordWrap] = useState(true);
  const [saved, setSaved] = useState(false);
  const diffEditorRef = useRef<any>(null);
  const singleEditorRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // File Path Hover & Copy States (完整路径悬浮与复制)
  const [copiedType, setCopiedType] = useState<'relative' | 'full' | null>(null);
  const [isPathHovered, setIsPathHovered] = useState(false);
  const hoverTimeoutRef = useRef<any>(null);

  // Search & Navigation States
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

  const originalContent = isHistorical ? (historicalDiff?.original || '') : (selectedFileDiff?.oldContent || '');
  const modifiedContent = isHistorical ? (historicalDiff?.modified || '') : (selectedFileDiff?.newContent || '');

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
      if (singleEditorRef.current) {
        currentText = singleEditorRef.current.getValue();
      } else {
        currentText = modifiedContent;
      }
    } else {
      if (diffEditorRef.current) {
        currentText = diffEditorRef.current.getModifiedEditor().getValue();
      } else {
        currentText = modifiedContent;
      }
    }

    const success = await saveCurrentFile(currentText);
    if (success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  // Keyboard shortcut Ctrl+F to focus diff search, and Ctrl+S to save
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

  // Ensure side-by-side is strictly enforced whenever file or historical mode changes (MUST BE TOP-LEVEL HOOK)
  useEffect(() => {
    if (diffEditorRef.current) {
      try {
        diffEditorRef.current.updateOptions({
          renderSideBySide: true,
          useInlineViewWhenSpaceIsLimited: false,
          renderSideBySideInlineBreakpoint: 0,
          readOnly: isHistorical,
        });
      } catch (e) {
        // ignore
      }
    }
  }, [isHistorical, relativePath, editorViewMode]);

  // Ensure clicking the Monaco Find Widget close button or pressing Escape always successfully closes it
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
      <div className="flex-1 bg-theme-panel flex flex-col items-center justify-center text-theme-dim text-xs select-none">
        <RefreshCw className="w-8 h-8 text-sky-400 mb-3 animate-spin stroke-[1.5]" />
        <p className="text-theme-muted font-medium text-sm">{t.statusPanel.loadingWorkspace}</p>
        <p className="text-theme-dim text-[11px] mt-1">
          {t.diff.readingRepoDiff}
        </p>
      </div>
    );
  }

  if (!selectedFile && !isHistorical) {
    return (
      <div className="flex-1 bg-theme-panel flex flex-col items-center justify-center text-theme-dim text-xs select-none">
        <FileText className="w-10 h-10 text-theme-dim mb-2 stroke-[1.5]" />
        <p className="text-theme-muted font-medium">{t.diff.noFileSelected}</p>
        <p className="text-theme-dim text-[11px] mt-1 text-center max-w-md">
          {t.diff.selectFileHint}
        </p>
      </div>
    );
  }

  const insertSelectionFromOriginalToModified = () => {
    if (!diffEditorRef.current) return;
    const originalEditor = diffEditorRef.current.getOriginalEditor();
    const modifiedEditor = diffEditorRef.current.getModifiedEditor();
    if (!originalEditor || !modifiedEditor) return;

    const sel = originalEditor.getSelection();
    if (!sel || sel.isEmpty()) return;
    const textToInsert = originalEditor.getModel()?.getValueInRange(sel) || '';
    if (!textToInsert) return;

    const modModel = modifiedEditor.getModel();
    if (!modModel) return;

    const modSel = modifiedEditor.getSelection();
    const currentLine = modSel ? modSel.startLineNumber : 1;
    const lineCount = modModel.getLineCount();

    // Check if current position in modified editor is inside a conflict block
    let conflictStartLine = -1;
    let conflictEndLine = -1;

    for (let l = currentLine; l >= 1; l--) {
      const lineText = modModel.getLineContent(l);
      if (lineText.startsWith('<<<<<<<')) {
        conflictStartLine = l;
        break;
      }
      if (lineText.startsWith('>>>>>>>') && l < currentLine) {
        break;
      }
    }

    if (conflictStartLine !== -1) {
      for (let l = conflictStartLine; l <= lineCount; l++) {
        const lineText = modModel.getLineContent(l);
        if (lineText.startsWith('>>>>>>>')) {
          conflictEndLine = l;
          break;
        }
      }
    }

    if (conflictStartLine !== -1 && conflictEndLine !== -1 && currentLine >= conflictStartLine && currentLine <= conflictEndLine) {
      // Replace the entire conflict block, stripping <<<<<<< HEAD, =======, >>>>>>> markers
      const endLineMaxCol = modModel.getLineMaxColumn(conflictEndLine);
      const conflictRange = {
        startLineNumber: conflictStartLine,
        startColumn: 1,
        endLineNumber: conflictEndLine,
        endColumn: endLineMaxCol,
      };
      modifiedEditor.executeEdits('insert-and-strip-conflict', [
        { range: conflictRange, text: textToInsert, forceMoveMarkers: true },
      ]);
    } else {
      modifiedEditor.executeEdits('insert-selection', [
        { range: modSel, text: textToInsert, forceMoveMarkers: true },
      ]);
    }

    modifiedEditor.focus();
  };

  const handleMountDiffEditor = (editor: any, monaco: any) => {
    diffEditorRef.current = editor;

    // Strictly lock Monaco in side-by-side mode (prevent auto-inline view when width is constrained)
    try {
      editor.updateOptions({
        renderSideBySide: true,
        useInlineViewWhenSpaceIsLimited: false,
        renderSideBySideInlineBreakpoint: 0,
      });
    } catch (e) {
      console.warn('Failed to lock side-by-side mode on mount', e);
    }

    // Add Ctrl+S command inside diff editor
    const modifiedEditor = editor.getModifiedEditor();
    if (modifiedEditor) {
      modifiedEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        handleSave();
      });
    }

    // Add Alt+Enter command inside original editor to insert selection to modified editor
    const originalEditor = editor.getOriginalEditor();
    if (originalEditor) {
      originalEditor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Enter, () => {
        insertSelectionFromOriginalToModified();
      });
      originalEditor.addAction({
        id: 'insert-selection-to-modified',
        label: t.diff.insertCodeTooltip,
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.Enter],
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        run: () => {
          insertSelectionFromOriginalToModified();
        },
      });
    }

    // Track real diff changes
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

    // Add Ctrl+S command inside single editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });
  };

  // Perform search across the active editor
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

  // 向上定位: 上一个匹配项 或 上一处差异 (Previous Match / Previous Diff Change)
  const handleGoToPrevious = () => {
    if (searchQuery.trim() && matches.length > 0) {
      // 1. Keyword search match previous
      const prevIdx = (currentMatchIndex - 1 + matches.length) % matches.length;
      setCurrentMatchIndex(prevIdx);
      revealMatch(prevIdx, matches);
    } else if (editorViewMode === 'diff' && diffEditorRef.current) {
      // 2. Git diff change previous
      if (diffEditorRef.current.goToDiff) {
        diffEditorRef.current.goToDiff('previous');
      }
      if (lineChanges.length > 0) {
        const prevDiff =
          currentDiffIndex <= 0 ? lineChanges.length - 1 : currentDiffIndex - 1;
        setCurrentDiffIndex(prevDiff);
        const change = lineChanges[prevDiff];
        const targetLine =
          change.modifiedStartLineNumber || change.originalStartLineNumber;
        diffEditorRef.current.getModifiedEditor()?.revealLineInCenter(targetLine);
      }
    }
  };

  // 向下定位: 下一个匹配项 或 下一处差异 (Next Match / Next Diff Change)
  const handleGoToNext = () => {
    if (searchQuery.trim() && matches.length > 0) {
      // 1. Keyword search match next
      const nextIdx = (currentMatchIndex + 1) % matches.length;
      setCurrentMatchIndex(nextIdx);
      revealMatch(nextIdx, matches);
    } else if (editorViewMode === 'diff' && diffEditorRef.current) {
      // 2. Git diff change next
      if (diffEditorRef.current.goToDiff) {
        diffEditorRef.current.goToDiff('next');
      }
      if (lineChanges.length > 0) {
        const nextDiff = (currentDiffIndex + 1) % lineChanges.length;
        setCurrentDiffIndex(nextDiff);
        const change = lineChanges[nextDiff];
        const targetLine =
          change.modifiedStartLineNumber || change.originalStartLineNumber;
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
    <div className="flex-1 bg-theme-panel flex flex-col h-full overflow-hidden">
      {/* Workbench Header */}
      <div className="h-9 px-2.5 border-b border-theme-border flex items-center justify-between bg-theme-header text-xs select-none gap-1.5 overflow-hidden">
        {/* Left: File Path & Status Badge with Hover Full Path Preview & Copy */}
        <div
          className="relative flex items-center gap-1 min-w-0 flex-1 max-w-[36%] shrink"
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = setTimeout(() => setIsPathHovered(true), 250);
          }}
          onMouseLeave={() => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = setTimeout(() => setIsPathHovered(false), 200);
          }}
        >
          {/* File Path text (supports mouse selection & quick click to copy) */}
          <div
            className="flex items-center gap-1 min-w-0 max-w-full px-1 py-0.5 rounded hover:bg-theme-hover transition cursor-pointer"
            onClick={(e) => handleCopyPath(fullAbsolutePath, 'full', e)}
            title={t.diff.copyFullPathTooltip(fullAbsolutePath)}
          >
            <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="font-mono text-theme-main font-semibold truncate text-[11px] select-text">
              {relativePath}
            </span>
          </div>

          {/* Quick Copy Full Path Button (Available on wider widths) */}
          <button
            type="button"
            onClick={(e) => handleCopyPath(fullAbsolutePath, 'full', e)}
            className="hidden 2xl:flex p-1 rounded text-theme-muted hover:text-sky-400 hover:bg-theme-card-hover transition cursor-pointer shrink-0"
            title={t.diff.copyFullPath}
          >
            {copiedType ? (
              <Check className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Quick Reveal in OS File Manager (Explorer / Finder) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              revealFileInOS(relativePath);
            }}
            className="hidden 2xl:flex p-1 rounded text-theme-muted hover:text-amber-400 hover:bg-theme-card-hover transition cursor-pointer shrink-0"
            title={t.diff.revealInExplorerTooltip}
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>

          {/* Copied Feedback Badge */}
          {copiedType && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1 py-0.2 rounded shrink-0 font-bold animate-pulse">
              {t.diff.copied}
            </span>
          )}

          {/* Status Badge (Only shown in non-historical mode to avoid clutter) */}
          {!isHistorical && selectedFile?.status && (
            <span
              className={`hidden sm:inline-block text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase shrink-0 ${
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

          {/* Rich Full Path Hover Card (鼠标移上去悬浮展示完整路径与单独复制按钮) */}
          {isPathHovered && (
            <div
              className="absolute left-0 top-full mt-1.5 z-50 w-[440px] max-w-[90vw] theme-dropdown-panel rounded-lg p-3 shadow-2xl border border-theme-border-card text-xs text-theme-main font-sans select-text"
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                setIsPathHovered(true);
              }}
              onMouseLeave={() => setIsPathHovered(false)}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-theme-border-subtle pb-1.5 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="font-bold text-theme-main text-xs truncate">
                    {relativePath.split(/[/|\\]/).pop()}
                  </span>
                </div>
                <span className="text-[10px] text-theme-muted font-mono shrink-0">
                  {isHistorical ? 'HISTORICAL COMMIT' : selectedFile?.status.toUpperCase()}
                </span>
              </div>

              {/* Relative Path */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-[10px] text-theme-muted mb-0.5">
                  <span>{t.diff.relativePath}</span>
                  <button
                    type="button"
                    onClick={(e) => handleCopyPath(relativePath, 'relative', e)}
                    className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-mono text-[10px] px-1 py-0.5 rounded hover:bg-theme-hover transition cursor-pointer"
                  >
                    {copiedType === 'relative' ? (
                      <>
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">{t.common.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-2.5 h-2.5" />
                        <span>{t.common.copy}</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-1.5 bg-theme-input rounded border border-theme-border text-[11px] font-mono break-all text-theme-main select-all">
                  {relativePath}
                </div>
              </div>

              {/* Absolute Full Path */}
              <div>
                <div className="flex items-center justify-between text-[10px] text-theme-muted mb-0.5">
                  <span>{t.diff.fullAbsolutePath}</span>
                  <button
                    type="button"
                    onClick={(e) => handleCopyPath(fullAbsolutePath, 'full', e)}
                    className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-mono text-[10px] px-1 py-0.5 rounded hover:bg-theme-hover transition cursor-pointer"
                  >
                    {copiedType === 'full' ? (
                      <>
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">{t.common.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-2.5 h-2.5" />
                        <span>{t.diff.copyFullPath}</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-1.5 bg-theme-input rounded border border-theme-border text-[11px] font-mono break-all text-theme-main select-all">
                  {fullAbsolutePath}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Center: View Mode Toggle Tabs & Search Box (差异对比 vs 单文件源码编辑) */}
        <div className="flex items-center gap-1.5 shrink-0 justify-center">
          {/* Mode Switcher Pills */}
          <div className="flex items-center bg-theme-input p-0.5 rounded-lg border border-theme-border text-xs shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => setEditorViewMode('diff')}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md font-medium transition cursor-pointer text-[11px] ${
                editorViewMode === 'diff'
                  ? 'bg-sky-500 text-white shadow-xs font-semibold'
                  : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover'
              }`}
              title={t.diff.diffViewTooltip}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>{t.diff.modeDiff}</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorViewMode('editor')}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md font-medium transition cursor-pointer text-[11px] ${
                editorViewMode === 'editor'
                  ? 'bg-sky-500 text-white shadow-xs font-semibold'
                  : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover'
              }`}
              title={t.diff.editorViewTooltip}
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>{t.diff.modeEditor}</span>
            </button>
          </div>

          {/* Search Box - dynamic responsive elastic width */}
          <div className="flex items-center gap-1 px-2 py-0.5 bg-theme-input border border-theme-border rounded-lg focus-within:border-sky-500 transition w-20 sm:w-28 md:w-32 lg:w-40 focus-within:w-40 shadow-2xs">
            <Search className="w-3.5 h-3.5 text-theme-dim shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t.diff.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="bg-transparent border-none outline-none text-theme-main text-xs w-full min-w-0 placeholder:text-theme-dim"
            />
            {/* Search Match Counter Badge */}
            {searchQuery.trim() && (
              <span className="text-[10px] font-mono text-sky-400 shrink-0 px-1.5 py-0.2 rounded-full bg-sky-500/10 font-medium">
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
                className="text-theme-dim hover:text-theme-main text-xs px-0.5 cursor-pointer"
                title={t.diff.clearSearch}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Up & Down Navigation Buttons (向上与向下定位) */}
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

          {/* Diff Changes Counter Badge (when in diff mode and not actively searching) */}
          {editorViewMode === 'diff' && !searchQuery.trim() && lineChanges.length > 0 && (
            <span
              className="hidden lg:flex text-[10px] font-mono text-theme-dim px-1.5 py-0.5 rounded bg-theme-subbar border border-theme-border shrink-0 items-center gap-1"
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

        {/* Right: Actions (Diff View controls / Editor controls / Unified Historical pill / Save) */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {/* Editor mode controls: Word Wrap toggle */}
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
              <span className="hidden xl:inline">{t.diff.wordWrap}</span>
            </button>
          )}

          {/* Unified Historical mode pill OR Normal Save button */}
          {isHistorical ? (
            <div className="flex items-center bg-purple-500/15 border border-purple-500/30 rounded-lg text-[11px] font-mono text-purple-300 px-2 py-0.5 gap-1.5 shrink-0 shadow-2xs">
              <History className="w-3 h-3 text-purple-400 shrink-0" />
              <span className="font-semibold text-[10px] truncate max-w-[85px]">
                {historicalDiff?.commitHash ? `Commit ${historicalDiff.commitHash.slice(0, 7)}` : t.diff.snapshot}
              </span>
              <button
                type="button"
                onClick={clearHistoricalDiff}
                className="px-1.5 py-0.5 rounded bg-purple-500/25 hover:bg-purple-500/40 text-purple-200 hover:text-white transition cursor-pointer text-[10px] font-sans font-medium"
                title={t.diff.exitHistoryTooltip}
              >
                {t.diff.exitHistory}
              </button>
            </div>
          ) : (
            <button
              onClick={handleSave}
              className="flex items-center gap-1 bg-theme-card hover:bg-theme-card-hover text-theme-main border border-theme-border-card px-2.5 py-1 rounded-lg transition text-xs cursor-pointer shadow-2xs font-medium"
              title={t.diff.saveDiskTooltip}
            >
              {saved ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Save className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span className="hidden sm:inline">{saved ? t.diff.saved : t.diff.save}</span>
            </button>
          )}

          {/* Vertical Separator */}
          <div className="h-4 w-[1px] bg-theme-border mx-0.5 shrink-0" />

          {/* Close Right Panel [✕] Button */}
          <button
            type="button"
            onClick={closeRightPanel}
            className="p-1 rounded-lg hover:bg-theme-hover text-theme-dim hover:text-rose-400 transition cursor-pointer"
            title={t.diff.closeSideTooltip}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 1.5 Conflict Resolver Action Bar (IntelliJ IDEA style) */}
      {(selectedFile?.status === 'conflict' || (Boolean(modifiedContent) && modifiedContent.includes('<<<<<<<'))) && (
        <div className="px-3 py-2 bg-amber-500/15 border-b border-amber-500/30 flex items-center justify-between text-xs animate-in fade-in shrink-0">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>{t.diff.conflictWarning}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* 1. Conflict list dialog button */}
            <button
              type="button"
              onClick={openConflictsDialog}
              className="px-2.5 py-1 rounded bg-theme-panel hover:bg-theme-hover text-theme-main border border-theme-border text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
              title={t.diff.conflictsDialogTooltip}
            >
              <FileCode className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.diff.conflictList}</span>
            </button>

            {/* 2. Accept Yours */}
            <button
              type="button"
              onClick={() => selectedFile && resolveConflictQuick(selectedFile.path, 'yours')}
              className="px-2.5 py-1 rounded bg-theme-panel hover:bg-sky-500/20 text-sky-300 border border-theme-border hover:border-sky-500/40 text-[11px] font-semibold transition cursor-pointer"
              title={t.diff.acceptYoursTooltip}
            >
              {t.diff.acceptYours}
            </button>

            {/* 3. Accept Theirs */}
            <button
              type="button"
              onClick={() => selectedFile && resolveConflictQuick(selectedFile.path, 'theirs')}
              className="px-2.5 py-1 rounded bg-theme-panel hover:bg-purple-500/20 text-purple-300 border border-theme-border hover:border-purple-500/40 text-[11px] font-semibold transition cursor-pointer"
              title={t.diff.acceptTheirsTooltip}
            >
              {t.diff.acceptTheirs}
            </button>

            {/* 4. Primary 3-Way Merge Button */}
            <button
              type="button"
              onClick={() => selectedFile && openThreeWayMerge(selectedFile.path)}
              className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
              title={t.diff.threeWayMergeTooltip}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>{t.diff.mergeModal}</span>
            </button>
          </div>
        </div>
      )}

      {/* Subheader Toolbar */}
      {editorViewMode === 'diff' ? (
        /* 2. Dual Pane Identifiers for Diff Mode (Strictly Side-by-Side 左右并排比对) */
        <div className="h-7 border-b border-theme-border flex items-center bg-theme-subbar text-xs select-none shrink-0 overflow-hidden">
          {/* Left: 历史基准 */}
          <div className="w-1/2 h-full px-2 border-r border-theme-border flex items-center justify-between bg-amber-500/[0.04] min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
              <History className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="font-bold text-[11px] text-theme-main truncate" title={isHistorical ? historicalDiff?.oldLabel : t.diff.leftBase}>
                {isHistorical
                  ? t.diff.leftParentLabel(historicalDiff?.oldLabel)
                  : t.diff.leftBase}
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0 flex items-center gap-1 shadow-2xs">
                <Lock className="w-2.5 h-2.5" />
                {t.diff.readOnly}
              </span>
            </div>
            <span className="text-[10px] text-theme-dim hidden 2xl:inline font-mono shrink-0">
              {isHistorical ? t.diff.parentRevision : t.diff.baseRevision}
            </span>
          </div>

          {/* Right: 调整后代码 */}
          <div className="w-1/2 h-full px-2 flex items-center justify-between bg-emerald-500/[0.04] min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
              {isHistorical ? (
                <History className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              ) : (
                <FileEdit className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              )}
              <span className="font-bold text-[11px] text-theme-main truncate" title={isHistorical ? historicalDiff?.newLabel : t.diff.rightWorking}>
                {isHistorical
                  ? t.diff.rightCommitLabel(historicalDiff?.newLabel)
                  : t.diff.rightWorking}
              </span>
              {isHistorical ? (
                <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0 flex items-center gap-1 shadow-2xs">
                  <Lock className="w-2.5 h-2.5" />
                  {t.diff.snapshot}
                </span>
              ) : (
                <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 flex items-center gap-1 shadow-2xs">
                  <Sparkles className="w-2.5 h-2.5" />
                  {t.diff.editable}
                </span>
              )}
            </div>
            <span className="text-[10px] text-theme-dim hidden 2xl:inline font-mono shrink-0">
              {isHistorical ? t.diff.commitRevision : t.diff.workingCopy}
            </span>
          </div>
        </div>
      ) : (
        /* Subheader for Single File Editor Mode */
        <div className="h-7 px-3 border-b border-theme-border flex items-center justify-between bg-theme-subbar text-xs select-none shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="font-bold text-[11px] text-theme-main truncate">
              {t.diff.singleFileViewing}: {relativePath}
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              {t.diff.liveEditable}
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
              {fileLanguage.toUpperCase()}
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded font-mono text-theme-dim bg-theme-input border border-theme-border shrink-0">
              UTF-8
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-theme-dim">
            <span>{t.diff.saveShortcutHint}</span>
            <span>•</span>
            <span>{t.diff.autoSyncHint}</span>
          </div>
        </div>
      )}

      {/* Main Monaco Container */}
      <div className="flex-1 relative">
        {Boolean(selectedFileDiff?.isBinary || originalContent.startsWith('(Binary') || originalContent.startsWith('(\u4e8c\u8fdb\u5236\u6587\u4ef6') || modifiedContent.startsWith('(\u4e8c\u8fdb\u5236\u6587\u4ef6')) ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-theme-panel text-xs select-none p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-3 shadow-inner">
              <FileCode className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-theme-main mb-1">
              {t.diff.binaryAssetTitle} ({selectedFile?.fileName || 'Binary Asset'})
            </h3>
            <p className="text-xs text-theme-dim max-w-md mb-4 leading-relaxed">
              {t.diff.binaryAssetDesc}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => selectedFile && openFileInEditor(selectedFile.path)}
                className="px-3 py-1.5 bg-theme-hover hover:bg-theme-card border border-theme-border rounded text-xs text-theme-main transition cursor-pointer flex items-center gap-1.5"
              >
                <FileEdit className="w-3.5 h-3.5 text-sky-400" />
                {t.diff.openWithDefaultApp}
              </button>
              <button
                type="button"
                onClick={() => selectedFile && revealFileInOS(selectedFile.path)}
                className="px-3 py-1.5 bg-theme-hover hover:bg-theme-card border border-theme-border rounded text-xs text-theme-main transition cursor-pointer flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                {t.diff.showInExplorer}
              </button>
            </div>
          </div>
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
            options={{
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
            }}
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
            options={{
              readOnly: isHistorical,
              automaticLayout: true,
              fontSize: 13,
              lineNumbers: 'on',
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              wordWrap: wordWrap ? 'on' : 'off',
              tabSize: 2,
              hover: { enabled: false },
            }}
          />
        )}
      </div>
    </div>
  );
}
