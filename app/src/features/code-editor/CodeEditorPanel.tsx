import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorTabsStore } from './useEditorTabsStore';
import { EditorTabStrip } from './EditorTabStrip';
import { useAppStore } from '../../store/useAppStore';
import {
  Save,
  Check,
  FileCode,
  FileText,
  AlertCircle,
  WrapText,
  Copy,
} from 'lucide-react';

export function CodeEditorPanel() {
  const {
    tabs,
    activeTabId,
    updateTabContent,
    saveTab,
  } = useEditorTabsStore();
  const theme = useAppStore((state) => state.theme);

  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [wordWrap, setWordWrap] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const editorRef = useRef<any>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);

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

  const handleSave = async () => {
    if (!activeTabId) return;
    const success = await saveTab(activeTabId);
    if (success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }
  };

  // Keyboard shortcut Ctrl+S to save, Ctrl+W to close tab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSave();
      } else if (isCmdOrCtrl && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        if (activeTabId) {
          useEditorTabsStore.getState().closeTab(activeTabId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, activeTab?.content]);

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e: any) => {
      setCursorPos({
        line: e.position.lineNumber,
        col: e.position.column,
      });
    });
  };

  if (!activeTab) {
    return (
      <div className="flex-1 flex flex-col h-full bg-theme-app text-theme-main overflow-hidden">
        <EditorTabStrip />
        <div className="flex-1 flex flex-col items-center justify-center p-8 select-none text-center">
          <div className="p-4 rounded-2xl bg-theme-hover border border-theme-border mb-4 text-theme-muted">
            <FileCode className="w-10 h-10 text-sky-400 stroke-[1.5]" />
          </div>
          <h3 className="text-sm font-semibold text-theme-main mb-1">未打开任何文件</h3>
          <p className="text-xs text-theme-muted max-w-sm leading-relaxed">
            请从左侧资源管理器中点击任意源文件，即可进行多标签查看与快速编辑
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-theme-app text-theme-main overflow-hidden">
      {/* 1. Multi-Tab Bar */}
      <EditorTabStrip />

      {/* 2. Top Quick Action Bar */}
      <div className="h-8 px-3 border-b border-theme-border flex items-center justify-between bg-theme-app/90 select-none text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[11px] text-theme-muted truncate" title={activeTab.filePath}>
            {activeTab.filePath}
          </span>
          {activeTab.isDirty && (
            <span className="text-[10px] text-amber-400 font-medium px-1 rounded bg-amber-400/10">
              未保存
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setWordWrap(!wordWrap)}
            className={`p-1 rounded hover:bg-theme-hover transition ${
              wordWrap ? 'text-sky-400 bg-theme-hover' : 'text-theme-muted'
            }`}
            title="自动折行切换"
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleSave}
            disabled={!activeTab.isDirty}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition text-xs ${
              activeTab.isDirty
                ? 'bg-sky-600 hover:bg-sky-500 text-white font-medium cursor-pointer shadow-sm'
                : 'text-theme-muted/50 cursor-not-allowed'
            }`}
            title="保存文件 (Ctrl + S)"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3 h-3 text-emerald-300" />
                <span>已保存</span>
              </>
            ) : (
              <>
                <Save className="w-3 h-3" />
                <span>保存</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Main Monaco Editor Container */}
      <div className="flex-1 relative overflow-hidden">
        {activeTab.isBinary ? (
          <div className="flex flex-col items-center justify-center h-full text-theme-muted text-xs">
            <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
            <p>该文件为二进制文件，无法在文本编辑器中显示</p>
          </div>
        ) : (
          <Editor
            height="100%"
            language={activeTab.language}
            value={activeTab.content}
            theme={getMonacoTheme(theme)}
            onChange={(val) => updateTabContent(activeTab.id, val || '')}
            onMount={handleEditorMount}
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
            行 {cursorPos.line}, 列 {cursorPos.col}
          </span>
          <span>{activeTab.language.toUpperCase()}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-sky-400/90 font-medium">
            {activeTab.encoding.toUpperCase()}
          </span>
          <span className="font-mono">{activeTab.eol}</span>
        </div>
      </div>
    </div>
  );
}
