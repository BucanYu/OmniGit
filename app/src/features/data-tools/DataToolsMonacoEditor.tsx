import React, { useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useDataToolsStore } from './useDataToolsStore';
import { useAppStore } from '../../store/useAppStore';
import { Loader2, AlertCircle } from 'lucide-react';

export const DataToolsMonacoEditor: React.FC = () => {
  const { formattedContent, setContent, activeFormat, stats } = useDataToolsStore();
  const theme = useAppStore((state) => state.theme);
  const editorRef = useRef<any>(null);

  const getMonacoTheme = (appTheme: string): string => {
    switch (appTheme) {
      case 'idea-light':
      case 'light':
        return 'vs';
      case 'github-dark':
      case 'darcula':
      case 'nord-frost':
      default:
        return 'vs-dark';
    }
  };

  const getMonacoLanguage = (format: string): string => {
    switch (format) {
      case 'json':
      case 'jwt':
      case 'url':
        return 'json';
      case 'yaml':
        return 'yaml';
      case 'xml':
        return 'xml';
      case 'sql':
        return 'sql';
      default:
        return 'plaintext';
    }
  };

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-theme-app">
      {/* Syntax Error Banner */}
      {!stats.isValid && stats.errorMessage && (
        <div className="px-3 py-1.5 bg-rose-500/10 border-b border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
            <span className="font-mono text-[11px] truncate">{stats.errorMessage}</span>
          </div>
          {stats.errorLine && (
            <span className="font-mono text-[10px] shrink-0 font-semibold px-1.5 py-0.5 rounded bg-rose-500/20">
              Line {stats.errorLine}:{stats.errorColumn || 1}
            </span>
          )}
        </div>
      )}

      {/* Editor Frame */}
      <div className="flex-1 relative overflow-hidden">
        <Editor
          height="100%"
          language={getMonacoLanguage(activeFormat)}
          value={formattedContent}
          theme={getMonacoTheme(theme)}
          onChange={(val) => setContent(val || '')}
          onMount={handleEditorMount}
          loading={
            <div className="flex items-center justify-center h-full gap-2 text-xs text-theme-muted">
              <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
              <span>Loading Monaco Editor...</span>
            </div>
          }
          options={{
            wordWrap: 'on',
            minimap: { enabled: false },
            lineNumbers: 'on',
            fontSize: 13,
            fontFamily: "Consolas, 'Cascadia Code', 'Fira Code', 'Courier New', monospace",
            tabSize: 2,
            scrollBeyondLastLine: false,
            renderWhitespace: 'none',
            folding: true,
            foldingStrategy: 'auto',
            foldingHighlight: true,
            showFoldingControls: 'always',
            bracketPairColorization: { enabled: true },
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
};
