import React, { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorTabsStore } from './useEditorTabsStore';
import { EditorTabStrip } from './EditorTabStrip';
import { useAppStore } from '../../store/useAppStore';
import { MarkdownPreview } from './MarkdownPreview';
import { ImageViewer } from './ImageViewer';
import { isImageFile } from './imageUtils';
import { useTranslation } from '../../locales';
import {
  toggleEditorComment,
  registerAllLanguageComments,
} from '../../utils/editorCommentUtils';
import {
  Save,
  Check,
  FileCode,
  FileText,
  AlertCircle,
  WrapText,
  Copy,
  MessageSquareCode,
  Columns,
  Eye,
  Code2,
  Loader2,
  RotateCcw,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';

export function CodeEditorPanel() {
  const {
    tabs,
    activeTabId,
    updateTabContent,
    saveTab,
    reloadTabFromDisk,
    dismissConflict,
    syncActiveTabWithDisk,
  } = useEditorTabsStore();
  const theme = useAppStore((state) => state.theme);
  const { t } = useTranslation();

  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [wordWrap, setWordWrap] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [reloadSuccess, setReloadSuccess] = useState(false);
  const [mdViewMode, setMdViewMode] = useState<'editor' | 'split' | 'preview'>('split');
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [isSplitDragging, setIsSplitDragging] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const panelContainerRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState<number>(600);

  useEffect(() => {
    if (!panelContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setPanelWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(panelContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const isNarrow = panelWidth < 540;

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Check if current active tab is an image file
  const isImage = Boolean(activeTab && isImageFile(activeTab.filePath));

  // Check if current active tab is Markdown file
  const isMarkdown = Boolean(
    activeTab &&
      !isImage &&
      (activeTab.language === 'markdown' ||
        activeTab.filePath.toLowerCase().endsWith('.md') ||
        activeTab.filePath.toLowerCase().endsWith('.markdown'))
  );

  // Map theme to Monaco theme
  const getMonacoTheme = (appTheme: string) => {
    switch (appTheme) {
      case 'idea-light':
        return 'vs';
      case 'nord-frost':
      case 'github-dark':
      case 'darcula':
      default:
        return 'vs-dark';
    }
  };

  const handleSaveRef = useRef<() => void>(() => {});
  const handleSave = async () => {
    if (!activeTabId) return;
    const success = await saveTab(activeTabId);
    if (success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }
  };
  handleSaveRef.current = handleSave;

  const handleToggleComment = useCallback(() => {
    if (editorRef.current && activeTab) {
      toggleEditorComment(editorRef.current, activeTab.language, activeTab.filePath);
    }
  }, [activeTab]);

  // Keyboard shortcut Ctrl+S to save, Ctrl+W to close tab, Ctrl+/ to toggle comment (Capture phase)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
      } else if (isCmdOrCtrl && !e.shiftKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        e.stopPropagation();
        if (activeTabId) {
          useEditorTabsStore.getState().closeTab(activeTabId);
        }
      } else if (isCmdOrCtrl && !e.shiftKey && (e.key === '/' || e.code === 'Slash')) {
        e.preventDefault();
        e.stopPropagation();
        handleToggleComment();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeTabId, activeTab?.content, handleToggleComment]);

  // Real-time external file modification sync: focus, visibilitychange, and periodic 2.5s heartbeat
  useEffect(() => {
    if (!activeTabId) return;

    // 1. Initial check when active tab changes
    syncActiveTabWithDisk();

    // 2. Focus & visibility change handler
    const handleFocus = () => {
      syncActiveTabWithDisk();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncActiveTabWithDisk();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // 3. Heartbeat check every 2500ms
    const timer = setInterval(() => {
      syncActiveTabWithDisk();
    }, 2500);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(timer);
    };
  }, [activeTabId, syncActiveTabWithDisk]);

  // Synchronize Monaco editor model value when activeTab.content changes externally without dirty conflict
  useEffect(() => {
    if (editorRef.current && activeTab && !activeTab.isDirty) {
      const currentVal = editorRef.current.getValue();
      if (currentVal !== activeTab.content) {
        const pos = editorRef.current.getPosition();
        editorRef.current.setValue(activeTab.content);
        if (pos) {
          editorRef.current.setPosition(pos);
        }
      }
    }
  }, [activeTab?.content, activeTab?.isDirty]);

  const handleSplitMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSplitDragging(true);
  };

  const handleSplitDoubleClick = () => {
    setSplitPercent(50);
  };

  useEffect(() => {
    if (!isSplitDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const offsetX = e.clientX - rect.left;
      const percent = (offsetX / rect.width) * 100;
      // Clamp between 15% and 85% to ensure neither pane collapses to invisible
      const clamped = Math.max(15, Math.min(85, percent));
      setSplitPercent(clamped);
    };

    const handleMouseUp = () => {
      setIsSplitDragging(false);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSplitDragging]);

  useEffect(() => {
    if (!isSplitDragging && editorRef.current) {
      editorRef.current.layout();
    }
  }, [isSplitDragging, splitPercent]);

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    (window as any).__currentCodeEditor = editor;

    // Register all universal language comment definitions
    registerAllLanguageComments(monaco);

    // 1. Bind Ctrl+S / Cmd+S save command within Monaco Editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveRef.current();
    });

    // 2. Add Save action to Monaco Editor context menu
    editor.addAction({
      id: 'omnigit-save-file',
      label: t.editor.saveFileTooltip,
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.0,
      run: () => {
        handleSaveRef.current();
      },
    });

    // 3. Bind Ctrl+W / Cmd+W close tab command within Monaco Editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => {
      const currentActiveId = useEditorTabsStore.getState().activeTabId;
      if (currentActiveId) {
        useEditorTabsStore.getState().closeTab(currentActiveId);
      }
    });

    // 4. Bind Ctrl+/ comment command within Monaco Editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      handleToggleComment();
    });

    // 5. Add comment action to context menu
    editor.addAction({
      id: 'omnigit-toggle-line-comment',
      label: t.editor.toggleCommentContextMenu,
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash],
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.5,
      run: () => {
        handleToggleComment();
      },
    });

    // 6. Bind Ctrl+Shift+F find in files within Monaco Editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      const selection = editor.getModel()?.getValueInRange(editor.getSelection());
      (window as any).__openGlobalSearch?.(selection || '');
    });

    editor.onDidChangeCursorPosition((e: any) => {
      setCursorPos({
        line: e.position.lineNumber,
        col: e.position.column,
      });
    });
  };

  if (!activeTab) {
    return (
      <div ref={panelContainerRef} className="flex-1 flex flex-col h-full bg-theme-app text-theme-main overflow-hidden">
        <EditorTabStrip />
        <div className="flex-1 flex flex-col items-center justify-center p-8 select-none text-center">
          <div className="p-4 rounded-2xl bg-theme-hover border border-theme-border mb-4 text-theme-muted">
            <FileCode className="w-10 h-10 text-sky-400 stroke-[1.5]" />
          </div>
          <h3 className="text-sm font-semibold text-theme-main mb-1">{t.editor.noFileOpenTitle}</h3>
          <p className="text-xs text-theme-muted max-w-sm leading-relaxed">
            {t.editor.noFileOpenDesc}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={panelContainerRef} className="flex-1 flex flex-col h-full bg-theme-app text-theme-main overflow-hidden">
      {/* 1. Multi-Tab Bar */}
      <EditorTabStrip />

      {isImage ? (
        <div className="flex-1 relative overflow-hidden">
          <ImageViewer
            filePath={activeTab.filePath}
            fileSize={activeTab.size}
            mtime={activeTab.mtime}
            theme={theme}
            onOpenFolder={() => {
              const normPath = activeTab.filePath.replace(/\\/g, '/');
              const lastSlash = normPath.lastIndexOf('/');
              const parentDir = lastSlash > 0 ? normPath.substring(0, lastSlash) : (activeTab.repoPath || activeTab.filePath);
              useAppStore.getState().openProjectFolder(parentDir);
            }}
          />
        </div>
      ) : (
        <>
          {/* 2. Top Quick Action Bar */}
      <div className="h-8 px-2 sm:px-3 border-b border-theme-border flex items-center justify-between bg-theme-app/90 select-none text-xs gap-1.5 sm:gap-2 min-w-0 overflow-hidden">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="font-semibold text-[11px] text-theme-main shrink-0 truncate max-w-[140px] sm:max-w-[200px]" title={activeTab.fileName}>
            {activeTab.fileName}
          </span>
          {!isNarrow && (
            <span className="font-mono text-[10px] text-theme-muted truncate opacity-70" title={activeTab.filePath}>
              {activeTab.filePath}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              const normPath = activeTab.filePath.replace(/\\/g, '/');
              const lastSlash = normPath.lastIndexOf('/');
              const parentDir = lastSlash > 0 ? normPath.substring(0, lastSlash) : (activeTab.repoPath || activeTab.filePath);
              useAppStore.getState().openProjectFolder(parentDir);
            }}
            className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-sky-400 transition cursor-pointer shrink-0"
            title={t.editor.openContainingFolder}
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          {activeTab.isDirty && (
            <span className="text-[10px] text-amber-400 font-medium px-1.5 py-0.2 rounded bg-amber-400/10 border border-amber-400/20 shrink-0 whitespace-nowrap">
              {t.editor.unsaved}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Markdown View Mode Segmented Control */}
          {isMarkdown && (
            <div className="flex items-center bg-theme-sidebar border border-theme-border rounded p-0.5 text-[11px] font-medium mr-0.5 sm:mr-1">
              <button
                onClick={() => setMdViewMode('editor')}
                className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded transition cursor-pointer ${
                  mdViewMode === 'editor'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover'
                }`}
                title={t.editor.viewSourceTooltip}
              >
                <Code2 className="w-3 h-3" />
                {!isNarrow && <span>{t.editor.viewSource}</span>}
              </button>
              <button
                onClick={() => setMdViewMode('split')}
                className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded transition cursor-pointer ${
                  mdViewMode === 'split'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover'
                }`}
                title={t.editor.viewSplitTooltip}
              >
                <Columns className="w-3 h-3" />
                {!isNarrow && <span>{t.editor.viewSplit}</span>}
              </button>
              <button
                onClick={() => setMdViewMode('preview')}
                className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded transition cursor-pointer ${
                  mdViewMode === 'preview'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover'
                }`}
                title={t.editor.viewPreviewTooltip}
              >
                <Eye className="w-3 h-3" />
                {!isNarrow && <span>{t.editor.viewPreview}</span>}
              </button>
            </div>
          )}

          {/* Quick Comment Toggle Button */}
          {(!isMarkdown || mdViewMode !== 'preview') && (
            <button
              onClick={handleToggleComment}
              className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-sky-400 transition cursor-pointer"
              title={t.editor.toggleCommentTooltip}
            >
              <MessageSquareCode className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Word Wrap Toggle */}
          {(!isMarkdown || mdViewMode !== 'preview') && (
            <button
              onClick={() => setWordWrap(!wordWrap)}
              className={`p-1 rounded hover:bg-theme-hover transition cursor-pointer ${
                wordWrap ? 'text-sky-400 bg-theme-hover' : 'text-theme-muted'
              }`}
              title={t.editor.toggleWordWrapTooltip}
            >
              <WrapText className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Reload from Disk Button */}
          <button
            onClick={async () => {
              if (!activeTab) return;
              const ok = await reloadTabFromDisk(activeTab.id);
              if (ok) {
                setReloadSuccess(true);
                setTimeout(() => setReloadSuccess(false), 1500);
              }
            }}
            className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-sky-400 transition cursor-pointer"
            title={t.editor.reloadFromDiskTooltip}
          >
            <RotateCcw className={`w-3.5 h-3.5 transition-transform ${reloadSuccess ? 'text-emerald-400 rotate-180 duration-500' : ''}`} />
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!activeTab.isDirty}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition text-xs ${
              activeTab.isDirty
                ? 'bg-sky-600 hover:bg-sky-500 text-white font-medium cursor-pointer shadow-sm'
                : 'text-theme-muted/50 cursor-not-allowed'
            }`}
            title={t.editor.saveFileTooltip}
          >
            {savedSuccess ? (
              <>
                <Check className="w-3 h-3 text-emerald-300" />
                {!isNarrow && <span>{t.editor.saved}</span>}
              </>
            ) : (
              <>
                <Save className="w-3 h-3" />
                {!isNarrow && <span>{t.editor.save}</span>}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Disk Conflict Warning Banner */}
      {activeTab.hasDiskConflict && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-xs text-amber-300 animate-fadeIn shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-medium truncate">{t.editor.diskConflictWarning}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => reloadTabFromDisk(activeTab.id)}
              className="px-2.5 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium flex items-center gap-1 cursor-pointer transition shadow-xs text-[11px]"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t.editor.reloadDiskAction}</span>
            </button>
            <button
              onClick={() => dismissConflict(activeTab.id)}
              className="px-2.5 py-0.5 rounded bg-theme-hover hover:bg-theme-border text-theme-main transition cursor-pointer text-[11px]"
            >
              <span>{t.editor.keepLocalAction}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Monaco Editor Container or Markdown Preview */}
      <div className="flex-1 relative overflow-hidden">
        {activeTab.isBinary ? (
          <div className="flex flex-col items-center justify-center h-full text-theme-muted text-xs">
            <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
            <p>{t.editor.binaryFileWarning}</p>
          </div>
        ) : activeTab.readError ? (
          <div className="flex flex-col items-center justify-center h-full text-theme-muted text-xs gap-3 p-4">
            <AlertCircle className="w-10 h-10 text-rose-400" />
            <div className="text-center max-w-md">
              <p className="text-rose-300 font-medium text-sm mb-1">{activeTab.readError}</p>
              <p className="text-theme-muted text-[11px] font-mono break-all">{activeTab.filePath}</p>
            </div>
            <button
              onClick={() => reloadTabFromDisk(activeTab.id)}
              className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium flex items-center gap-1.5 cursor-pointer text-xs shadow-sm transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.editor.reloadDiskAction || '重新读取'}</span>
            </button>
          </div>
        ) : isMarkdown && mdViewMode === 'preview' ? (
          /* Pure Fullscreen Markdown Preview */
          <MarkdownPreview content={activeTab.content} theme={theme} filePath={activeTab.filePath} />
        ) : isMarkdown && mdViewMode === 'split' ? (
          /* Split Dual-Pane: Editor on Left, Markdown Preview on Right (支持左右拖拽调节宽度与双击重置) */
          <div ref={splitContainerRef} className="flex h-full w-full overflow-hidden relative">
            {/* 全局拖拽遮罩：防止拖拽过程中 Monaco Editor 捕获鼠标事件 */}
            {isSplitDragging && (
              <div className="fixed inset-0 z-[9999] cursor-col-resize select-none" />
            )}

            {/* Left: Monaco Editor */}
            <div
              style={{ width: `${splitPercent}%` }}
              className="h-full relative overflow-hidden shrink-0"
            >
              <Editor
                height="100%"
                language={activeTab.language}
                value={activeTab.content}
                theme={getMonacoTheme(theme)}
                onChange={(val) => updateTabContent(activeTab.id, val || '')}
                onMount={handleEditorMount}
                loading={
                  <div className="flex items-center justify-center h-full gap-2 text-xs text-theme-muted">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                    <span>{t.editor.loadingEditor}</span>
                  </div>
                }
                options={{
                  wordWrap: wordWrap ? 'on' : 'off',
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  fontSize: 13,
                  fontFamily: "Consolas, 'Cascadia Code', 'Fira Code', 'Courier New', monospace",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  renderWhitespace: 'selection',
                  tabSize: 2,
                }}
              />
            </div>

            {/* Middle: Interactive Draggable Divider */}
            <div
              onMouseDown={handleSplitMouseDown}
              onDoubleClick={handleSplitDoubleClick}
              title={t.editor.dragSplitTooltip}
              className={`relative z-20 w-[5px] -mx-[2px] h-full cursor-col-resize select-none shrink-0 transition-colors flex items-center justify-center group ${
                isSplitDragging ? 'bg-sky-500' : 'bg-theme-border/60 hover:bg-sky-500/50 active:bg-sky-500'
              }`}
            >
              <div
                className={`w-[1px] h-8 rounded-full transition-all duration-150 ${
                  isSplitDragging
                    ? 'bg-white h-16'
                    : 'bg-transparent group-hover:bg-white group-hover:h-10'
                }`}
              />
            </div>

            {/* Right: Markdown Preview */}
            <div className="flex-1 h-full relative overflow-hidden min-w-0">
              <MarkdownPreview content={activeTab.content} theme={theme} filePath={activeTab.filePath} />
            </div>
          </div>
        ) : (
          /* Standard Fullscreen Monaco Editor */
          <Editor
            height="100%"
            language={activeTab.language}
            value={activeTab.content}
            theme={getMonacoTheme(theme)}
            onChange={(val) => updateTabContent(activeTab.id, val || '')}
            onMount={handleEditorMount}
            loading={
              <div className="flex items-center justify-center h-full gap-2 text-xs text-theme-muted">
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                <span>{t.editor.loadingEditor}</span>
              </div>
            }
            options={{
              wordWrap: wordWrap ? 'on' : 'off',
              minimap: { enabled: true },
              lineNumbers: 'on',
              fontSize: 13,
              fontFamily: "Consolas, 'Cascadia Code', 'Fira Code', 'Courier New', monospace",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              renderWhitespace: 'selection',
              tabSize: 2,
            }}
          />
        )}
      </div>

      {/* 4. Bottom Editor Status Bar */}
      <div className="h-6 px-3 bg-theme-sidebar border-t border-theme-border flex items-center justify-between text-[11px] text-theme-muted select-none">
        <div className="flex items-center gap-3">
          <span>
            {t.editor.cursorPosition(cursorPos.line, cursorPos.col)}
          </span>
          <span>{activeTab.language.toUpperCase()}</span>
          {isMarkdown && (
            <span className="text-[10px] text-sky-400 bg-sky-400/10 px-1.5 py-0.2 rounded font-mono">
              MARKDOWN PREVIEW READY
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-sky-400/90 font-medium">
            {activeTab.encoding.toUpperCase()}
          </span>
          <span className="font-mono">{activeTab.eol}</span>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
