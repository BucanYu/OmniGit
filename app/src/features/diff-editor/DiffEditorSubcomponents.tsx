import React from 'react';
import {
  History,
  Lock,
  FileEdit,
  Sparkles,
  FileCode,
  AlertTriangle,
  ArrowRightLeft,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useTranslation } from '../../locales';

export function hasGitConflictMarkers(text: string): boolean {
  if (!text || (!text.includes('<<<<<<<') && !text.includes('======='))) return false;
  if (
    /(?:^|\r?\n)<<<<<<< [^\r\n]*\r?\n[\s\S]*?(?:^|\r?\n)=======(?:\r?\n)[\s\S]*?(?:^|\r?\n)>>>>>>> [^\r\n]*/m.test(
      text
    )
  ) {
    return true;
  }
  const lines = text.split(/\r?\n/);
  let hasStart = false;
  for (const line of lines) {
    if (
      line.startsWith('<<<<<<< ') ||
      line.startsWith('<<<<<<<HEAD') ||
      line.startsWith('<<<<<<< HEAD')
    ) {
      hasStart = true;
    } else if (hasStart && (line === '=======' || line.startsWith('======='))) {
      return true;
    }
  }
  return false;
}

export function insertSelectionFromOriginalToModified(diffEditor: any): void {
  if (!diffEditor) return;
  const originalEditor = diffEditor.getOriginalEditor();
  const modifiedEditor = diffEditor.getModifiedEditor();
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

  if (
    conflictStartLine !== -1 &&
    conflictEndLine !== -1 &&
    currentLine >= conflictStartLine &&
    currentLine <= conflictEndLine
  ) {
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
}

export function getLanguageFromPath(filePath: string): string {
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

interface DiffConflictActionBarProps {
  filePath: string;
  openConflictsDialog: () => void;
  markConflictResolved: (path: string) => void;
  resolveConflictQuick: (path: string, side: 'yours' | 'theirs') => void;
  openThreeWayMerge: (path: string) => void;
}

export const DiffConflictActionBar: React.FC<DiffConflictActionBarProps> = ({
  filePath,
  openConflictsDialog,
  markConflictResolved,
  resolveConflictQuick,
  openThreeWayMerge,
}) => {
  const { t } = useTranslation();

  return (
    <div className="px-3 py-2 bg-amber-500/15 border-b border-amber-500/30 flex items-center justify-between text-xs animate-in fade-in shrink-0 overflow-hidden flex-wrap gap-1.5">
      <div className="flex items-center gap-2 text-amber-300">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          <strong>{t.diff.conflictWarning}</strong>
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={openConflictsDialog}
          className="px-2.5 py-1 rounded bg-theme-panel hover:bg-theme-hover text-theme-main border border-theme-border text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
          title={t.diff.conflictsDialogTooltip}
        >
          <FileCode className="w-3.5 h-3.5 text-amber-400" />
          <span>{t.diff.conflictList}</span>
        </button>

        <button
          type="button"
          onClick={() => markConflictResolved(filePath)}
          className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
          title={t.diff.markResolvedTooltip}
        >
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t.diff.markResolved}</span>
        </button>

        <button
          type="button"
          onClick={() => resolveConflictQuick(filePath, 'yours')}
          className="px-2.5 py-1 rounded bg-theme-panel hover:bg-sky-500/20 text-sky-300 border border-theme-border hover:border-sky-500/40 text-[11px] font-semibold transition cursor-pointer"
          title={t.diff.acceptYoursTooltip}
        >
          {t.diff.acceptYours}
        </button>

        <button
          type="button"
          onClick={() => resolveConflictQuick(filePath, 'theirs')}
          className="px-2.5 py-1 rounded bg-theme-panel hover:bg-purple-500/20 text-purple-300 border border-theme-border hover:border-purple-500/40 text-[11px] font-semibold transition cursor-pointer"
          title={t.diff.acceptTheirsTooltip}
        >
          {t.diff.acceptTheirs}
        </button>

        <button
          type="button"
          onClick={() => openThreeWayMerge(filePath)}
          className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
          title={t.diff.threeWayMergeTooltip}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>{t.diff.mergeModal}</span>
        </button>
      </div>
    </div>
  );
};

interface DiffSubheaderProps {
  editorViewMode: 'diff' | 'editor';
  isHistorical: boolean;
  oldLabel?: string;
  newLabel?: string;
  isWide: boolean;
  relativePath: string;
  fileName: string;
  fileLanguage: string;
}

export const DiffSubheader: React.FC<DiffSubheaderProps> = ({
  editorViewMode,
  isHistorical,
  oldLabel,
  newLabel,
  isWide,
  relativePath,
  fileName,
  fileLanguage,
}) => {
  const { t } = useTranslation();

  if (editorViewMode === 'diff') {
    return (
      <div className="h-7 border-b border-theme-border flex items-center bg-theme-subbar text-xs select-none shrink-0 overflow-hidden">
        <div className="w-1/2 h-full px-2 border-r border-theme-border flex items-center justify-between bg-amber-500/[0.04] min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1 overflow-hidden">
            <History className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span
              className="font-bold text-[11px] text-theme-main truncate min-w-0"
              title={isHistorical ? oldLabel : t.diff.leftBase}
            >
              {isHistorical ? t.diff.leftParentLabel(oldLabel) : t.diff.leftBase}
            </span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-mono font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0 flex items-center gap-1 shadow-2xs whitespace-nowrap"
              title={t.diff.readOnly}
            >
              <Lock className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">{t.diff.readOnly}</span>
            </span>
          </div>
          {isWide && (
            <span className="text-[10px] text-theme-dim font-mono shrink-0">
              {isHistorical ? t.diff.parentRevision : t.diff.baseRevision}
            </span>
          )}
        </div>

        <div className="w-1/2 h-full px-2 flex items-center justify-between bg-emerald-500/[0.04] min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1 overflow-hidden">
            {isHistorical ? (
              <History className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            ) : (
              <FileEdit className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            )}
            <span
              className="font-bold text-[11px] text-theme-main truncate min-w-0"
              title={isHistorical ? newLabel : t.diff.rightWorking}
            >
              {isHistorical ? t.diff.rightCommitLabel(newLabel) : t.diff.rightWorking}
            </span>
            {isHistorical ? (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-mono font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0 flex items-center gap-1 shadow-2xs whitespace-nowrap"
                title={t.diff.snapshot}
              >
                <Lock className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">{t.diff.snapshot}</span>
              </span>
            ) : (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 flex items-center gap-1 shadow-2xs whitespace-nowrap"
                title={t.diff.editable}
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">{t.diff.editable}</span>
              </span>
            )}
          </div>
          {isWide && (
            <span className="text-[10px] text-theme-dim font-mono shrink-0">
              {isHistorical ? t.diff.commitRevision : t.diff.workingCopy}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-7 px-2 sm:px-3 border-b border-theme-border flex items-center justify-between bg-theme-subbar text-xs select-none shrink-0 overflow-hidden">
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-hidden">
        <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        <span className="font-bold text-[11px] text-theme-main truncate" title={relativePath}>
          {fileName}
        </span>
        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 flex items-center gap-1 whitespace-nowrap">
          <Sparkles className="w-2.5 h-2.5" />
          <span className="hidden sm:inline">{t.diff.liveEditable}</span>
        </span>
        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
          {fileLanguage.toUpperCase()}
        </span>
        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono text-theme-dim bg-theme-input border border-theme-border shrink-0 hidden sm:inline">
          UTF-8
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] font-mono text-theme-dim shrink-0 hidden md:flex">
        <span>{t.diff.saveShortcutHint}</span>
        <span>•</span>
        <span>{t.diff.autoSyncHint}</span>
      </div>
    </div>
  );
};

interface DiffPathHoverCardProps {
  relativePath: string;
  fullAbsolutePath: string;
  isHistorical: boolean;
  fileStatus?: string;
  copiedType: 'relative' | 'full' | null;
  handleCopyPath: (text: string, type: 'relative' | 'full', e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const DiffPathHoverCard: React.FC<DiffPathHoverCardProps> = ({
  relativePath,
  fullAbsolutePath,
  isHistorical,
  fileStatus,
  copiedType,
  handleCopyPath,
  onMouseEnter,
  onMouseLeave,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className="absolute left-0 top-full mt-1.5 z-50 w-[440px] max-w-[90vw] theme-dropdown-panel rounded-lg p-3 shadow-2xl border border-theme-border-card text-xs text-theme-main font-sans select-text"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-center justify-between border-b border-theme-border-subtle pb-1.5 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="font-bold text-theme-main text-xs truncate">
            {relativePath.split(/[/|\\]/).pop()}
          </span>
        </div>
        <span className="text-[10px] text-theme-muted font-mono shrink-0">
          {isHistorical ? 'HISTORICAL COMMIT' : fileStatus?.toUpperCase()}
        </span>
      </div>

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
  );
};

interface DiffBinaryPlaceholderProps {
  fileName?: string;
  filePath?: string;
  openFileInEditor: (path: string) => void;
  revealFileInOS: (path: string) => void;
}

export const DiffBinaryPlaceholder: React.FC<DiffBinaryPlaceholderProps> = ({
  fileName,
  filePath,
  openFileInEditor,
  revealFileInOS,
}) => {
  const { t } = useTranslation();

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-theme-panel text-xs select-none p-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-3 shadow-inner">
        <FileCode className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-theme-main mb-1">
        {t.diff.binaryAssetTitle} ({fileName || 'Binary Asset'})
      </h3>
      <p className="text-xs text-theme-dim max-w-md mb-4 leading-relaxed">
        {t.diff.binaryAssetDesc}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => filePath && openFileInEditor(filePath)}
          className="px-3 py-1.5 bg-theme-hover hover:bg-theme-card border border-theme-border rounded text-xs text-theme-main transition cursor-pointer flex items-center gap-1.5"
        >
          <FileEdit className="w-3.5 h-3.5 text-sky-400" />
          {t.diff.openWithDefaultApp}
        </button>
        <button
          type="button"
          onClick={() => filePath && revealFileInOS(filePath)}
          className="px-3 py-1.5 bg-theme-hover hover:bg-theme-card border border-theme-border rounded text-xs text-theme-main transition cursor-pointer flex items-center gap-1.5"
        >
          <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
          {t.diff.showInExplorer}
        </button>
      </div>
    </div>
  );
};
