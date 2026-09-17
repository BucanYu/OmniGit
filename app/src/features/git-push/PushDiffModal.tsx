import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import {
  X,
  GitCompare,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Lock,
  Columns2,
  AlignJustify,
  Maximize2,
  Minimize2,
  Loader2,
  Copy,
  Check,
  FolderOpen,
  FileCode,
  ExternalLink,
} from 'lucide-react';
import { useAppStore, type OutgoingCommitFile } from '../../store/useAppStore';
import { useTranslation } from '../../locales';

export interface PushDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  commitHash: string;
  commitMessage?: string;
  initialFilePath: string;
  files: OutgoingCommitFile[];
}

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
      return 'scss';
    case 'sass':
      return 'sass';
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
    case 'php':
      return 'php';
    case 'sql':
      return 'sql';
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'shell';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'xml':
      return 'xml';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'env':
      return 'ini';
    case 'dockerfile':
      return 'dockerfile';
    default:
      return 'plaintext';
  }
}

function isBinaryFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return [
    'png',
    'jpg',
    'jpeg',
    'gif',
    'bmp',
    'ico',
    'webp',
    'svg',
    'zip',
    'tar',
    'gz',
    'pdf',
    'exe',
    'dll',
    'so',
    'dylib',
    'woff',
    'woff2',
    'ttf',
    'eot',
  ].includes(ext);
}

export const PushDiffModal: React.FC<PushDiffModalProps> = ({
  isOpen,
  onClose,
  repoPath,
  commitHash,
  commitMessage,
  initialFilePath,
  files,
}) => {
  const { t } = useTranslation();
  const { theme, revealFileInOS, setNotification } = useAppStore();

  const [currentFilePath, setCurrentFilePath] = useState(initialFilePath);
  const [diffData, setDiffData] = useState<{
    original: string;
    modified: string;
    filePath: string;
    oldLabel: string;
    newLabel: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSideBySide, setIsSideBySide] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copied, setCopied] = useState(false);

  // Up/Down difference navigation states
  const diffEditorRef = useRef<any>(null);
  const [lineChanges, setLineChanges] = useState<any[]>([]);
  const [currentDiffIndex, setCurrentDiffIndex] = useState<number>(-1);

  // Sync initialFilePath when modal opens or prop updates
  useEffect(() => {
    if (initialFilePath) {
      setCurrentFilePath(initialFilePath);
    }
  }, [initialFilePath, isOpen]);

  // Reset diff changes on file or commit switch
  useEffect(() => {
    setLineChanges([]);
    setCurrentDiffIndex(-1);
  }, [currentFilePath, commitHash]);

  // Current file index in file list
  const currentIndex = useMemo(() => {
    return files.findIndex((f) => f.path === currentFilePath);
  }, [files, currentFilePath]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < files.length - 1;

  const handlePrev = () => {
    if (hasPrev) {
      setCurrentFilePath(files[currentIndex - 1].path);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      setCurrentFilePath(files[currentIndex + 1].path);
    }
  };

  // Fetch commit file diff whenever currentFilePath or commitHash changes
  useEffect(() => {
    if (!isOpen || !repoPath || !commitHash || !currentFilePath) return;

    let isCancelled = false;
    setLoading(true);

    const fetchDiff = async () => {
      try {
        const res = await fetch(
          `/api/git/commit-file-diff?path=${encodeURIComponent(repoPath)}&hash=${encodeURIComponent(commitHash)}&file=${encodeURIComponent(currentFilePath)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!isCancelled) {
          setDiffData({
            original: data.original || '',
            modified: data.modified || '',
            filePath: data.filePath || currentFilePath,
            oldLabel: data.oldLabel || `Parent (${commitHash.slice(0, 7)}^)`,
            newLabel: data.newLabel || `Commit (${commitHash.slice(0, 7)})`,
          });
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Failed to load commit diff:', err);
          setDiffData({
            original: '',
            modified: `// ${t.common.error}: ${err.message}`,
            filePath: currentFilePath,
            oldLabel: `Parent (${commitHash.slice(0, 7)}^)`,
            newLabel: `Commit (${commitHash.slice(0, 7)})`,
          });
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchDiff();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, repoPath, commitHash, currentFilePath]);

  // Jump to Next Difference (向下定位)
  const handleGoToNextDiff = () => {
    if (!diffEditorRef.current) return;
    if (diffEditorRef.current.goToDiff) {
      diffEditorRef.current.goToDiff('next');
    }
    if (lineChanges.length > 0) {
      const nextIdx = (currentDiffIndex + 1) % lineChanges.length;
      setCurrentDiffIndex(nextIdx);
      const ch = lineChanges[nextIdx];
      if (ch) {
        const targetLine = ch.modifiedStartLineNumber || ch.originalStartLineNumber;
        diffEditorRef.current.getModifiedEditor()?.revealLineInCenter(targetLine);
      }
    }
  };

  // Jump to Previous Difference (向上定位)
  const handleGoToPrevDiff = () => {
    if (!diffEditorRef.current) return;
    if (diffEditorRef.current.goToDiff) {
      diffEditorRef.current.goToDiff('previous');
    }
    if (lineChanges.length > 0) {
      const prevIdx = (currentDiffIndex - 1 + lineChanges.length) % lineChanges.length;
      setCurrentDiffIndex(prevIdx);
      const ch = lineChanges[prevIdx];
      if (ch) {
        const targetLine = ch.modifiedStartLineNumber || ch.originalStartLineNumber;
        diffEditorRef.current.getModifiedEditor()?.revealLineInCenter(targetLine);
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.altKey && e.key === 'ArrowLeft') {
        if (hasPrev) handlePrev();
      } else if (e.altKey && e.key === 'ArrowRight') {
        if (hasNext) handleNext();
      } else if ((e.altKey && e.key === 'ArrowDown') || e.key === 'F7') {
        e.preventDefault();
        handleGoToNextDiff();
      } else if ((e.altKey && e.key === 'ArrowUp') || (e.shiftKey && e.key === 'F7')) {
        e.preventDefault();
        handleGoToPrevDiff();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasPrev, hasNext, currentIndex, lineChanges, currentDiffIndex]);

  // Register Monaco themes with clear, vivid diff colors
  const handleBeforeMount = (monaco: any) => {
    monaco.editor.defineTheme('omnigit-diff-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'diffEditor.insertedLineBackground': '#22c55e22',
        'diffEditor.insertedTextBackground': '#22c55e45',
        'diffEditor.insertedTextBorder': '#22c55e80',
        'diffEditor.removedLineBackground': '#ef444422',
        'diffEditor.removedTextBackground': '#ef444445',
        'diffEditor.removedTextBorder': '#ef444480',
        'diffEditorGutter.insertedLineBackground': '#22c55e',
        'diffEditorGutter.removedLineBackground': '#ef4444',
        'diffEditorOverview.insertedForeground': '#22c55ecc',
        'diffEditorOverview.removedForeground': '#ef4444cc',
      },
    });

    monaco.editor.defineTheme('omnigit-diff-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'diffEditor.insertedLineBackground': '#e6f9ed',
        'diffEditor.insertedTextBackground': '#bbf7d0',
        'diffEditor.insertedTextBorder': '#16a34a80',
        'diffEditor.removedLineBackground': '#ffeef0',
        'diffEditor.removedTextBackground': '#fecaca',
        'diffEditor.removedTextBorder': '#dc262680',
        'diffEditorGutter.insertedLineBackground': '#16a34a',
        'diffEditorGutter.removedLineBackground': '#dc2626',
        'diffEditorOverview.insertedForeground': '#16a34acc',
        'diffEditorOverview.removedForeground': '#dc2626cc',
      },
    });
  };

  // Mount DiffEditor and track real diff line changes
  const handleMountDiffEditor = (editor: any, monaco: any) => {
    diffEditorRef.current = editor;

    // Add keyboard commands inside diff editor
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, handleGoToNextDiff);
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, handleGoToPrevDiff);
    editor.addCommand(monaco.KeyCode.F7, handleGoToNextDiff);
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F7, handleGoToPrevDiff);

    // Track real diff changes and auto-jump to first difference
    editor.onDidUpdateDiff(() => {
      const changes = editor.getLineChanges() || [];
      setLineChanges(changes);
      if (changes.length > 0) {
        setCurrentDiffIndex(0);
        // Automatically reveal first changed block so user immediately sees colorful diff
        setTimeout(() => {
          try {
            if (editor.goToDiff) {
              editor.goToDiff('next');
            } else {
              const firstChange = changes[0];
              const line = firstChange.modifiedStartLineNumber || firstChange.originalStartLineNumber;
              editor.getModifiedEditor()?.revealLineInCenter(line);
            }
          } catch (e) {}
        }, 80);
      } else {
        setCurrentDiffIndex(-1);
      }
    });
  };

  if (!isOpen) return null;

  const fileName = currentFilePath.split('/').pop() || currentFilePath;
  const language = getLanguageFromPath(currentFilePath);
  const isBinary = isBinaryFile(currentFilePath);
  const monacoTheme = theme === 'idea-light' ? 'omnigit-diff-light' : 'omnigit-diff-dark';

  const handleCopyPath = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(currentFilePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      setNotification({
        id: Date.now(),
        title: t.modals.pushDiff.pathCopied,
        detail: currentFilePath,
        type: 'info',
      });
    }
  };

  const handleRevealInExplorer = () => {
    revealFileInOS(currentFilePath);
  };

  return (
    <div
      className="fixed inset-0 z-[1050] bg-black/75 backdrop-blur-xs flex items-center justify-center select-none animate-in fade-in duration-100"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-theme-panel border border-theme-border rounded-lg shadow-2xl flex flex-col font-sans text-xs text-theme-main overflow-hidden transition-all duration-150 ${
          isMaximized
            ? 'w-full h-full rounded-none border-none'
            : 'w-[94vw] max-w-[1320px] h-[86vh] max-h-[920px]'
        }`}
      >
        {/* 1. Header Bar */}
        <div className="h-10 px-3 bg-theme-header border-b border-theme flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
            <GitCompare className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="font-semibold text-xs text-theme-main">{t.modals.pushDiff.title}</span>
            <span className="text-theme-border font-thin">|</span>

            {/* Current File Path Badge */}
            <span
              className="font-mono text-xs font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/25 truncate max-w-[340px]"
              title={currentFilePath}
            >
              {currentFilePath}
            </span>

            {/* Commit Hash Badge */}
            <span
              className="text-[10px] font-mono text-theme-muted bg-theme-card px-1.5 py-0.5 rounded border border-theme-border shrink-0 hidden sm:inline-block"
              title={commitMessage ? `Commit ${commitHash}\n${commitMessage}` : `Commit ${commitHash}`}
            >
              {commitHash.slice(0, 7)}
              {commitMessage && ` : ${commitMessage.slice(0, 24)}...`}
            </span>

            {/* Strict Read-Only Badge (只读标识) */}
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1 shrink-0">
              <Lock className="w-2.5 h-2.5" />
              {t.modals.pushDiff.readOnly}
            </span>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Diff Changes Jump Navigation Buttons: Previous Diff / Next Diff with Badge */}
            <div className="flex items-center bg-theme-subbar border border-theme-border rounded px-1 py-0.5 gap-0.5 shadow-2xs">
              <button
                type="button"
                disabled={lineChanges.length === 0}
                onClick={handleGoToPrevDiff}
                title={t.modals.pushDiff.prevDiffTooltip}
                className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-sky-400 disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-0.5"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span className="text-[10px] hidden sm:inline">{t.modals.pushDiff.upBtn}</span>
              </button>

              <span
                className="text-[11px] font-mono px-1.5 py-0.2 rounded font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 select-none"
                title={t.modals.pushDiff.diffCounterTooltip(
                  lineChanges.length > 0 ? (currentDiffIndex >= 0 ? currentDiffIndex + 1 : 1) : 0,
                  lineChanges.length
                )}
              >
                {lineChanges.length > 0
                  ? t.modals.pushDiff.diffCountLabel(currentDiffIndex >= 0 ? currentDiffIndex + 1 : 1, lineChanges.length)
                  : t.modals.pushDiff.noDiff}
              </span>

              <button
                type="button"
                disabled={lineChanges.length === 0}
                onClick={handleGoToNextDiff}
                title={t.modals.pushDiff.nextDiffTooltip}
                className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-sky-400 disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-0.5"
              >
                <span className="text-[10px] hidden sm:inline">{t.modals.pushDiff.downBtn}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-4 w-[1px] bg-theme-border mx-0.5" />

            {/* File Switcher Navigation: Prev File / Next File */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={handlePrev}
                title={hasPrev ? t.modals.pushDiff.prevFileTooltip(files[currentIndex - 1]?.path || '') : t.modals.pushDiff.isFirstFile}
                className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-theme-main disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {files.length > 0 && (
                <span className="text-[11px] font-mono text-theme-dim px-1">
                  {t.modals.pushDiff.fileCounter(currentIndex >= 0 ? currentIndex + 1 : 1, files.length)}
                </span>
              )}

              <button
                type="button"
                disabled={!hasNext}
                onClick={handleNext}
                title={hasNext ? t.modals.pushDiff.nextFileTooltip(files[currentIndex + 1]?.path || '') : t.modals.pushDiff.isLastFile}
                className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-theme-main disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="h-4 w-[1px] bg-theme-border mx-0.5" />

            {/* Copy Path */}
            <button
              type="button"
              onClick={handleCopyPath}
              title={t.modals.pushDiff.copyPathTooltip}
              className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-sky-400 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Reveal in Explorer */}
            <button
              type="button"
              onClick={handleRevealInExplorer}
              title={t.modals.pushDiff.showInExplorerTooltip}
              className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-sky-400 transition cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-[1px] bg-theme-border mx-0.5" />

            {/* Side-by-Side Toggle */}
            <button
              type="button"
              onClick={() => setIsSideBySide(true)}
              title={t.modals.pushDiff.sideBySideTooltip}
              className={`p-1 rounded transition cursor-pointer ${
                isSideBySide ? 'bg-sky-500/20 text-sky-400' : 'text-theme-muted hover:bg-theme-hover hover:text-theme-main'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
            </button>

            {/* Inline / Unified Toggle */}
            <button
              type="button"
              onClick={() => setIsSideBySide(false)}
              title={t.modals.pushDiff.unifiedTooltip}
              className={`p-1 rounded transition cursor-pointer ${
                !isSideBySide ? 'bg-sky-500/20 text-sky-400' : 'text-theme-muted hover:bg-theme-hover hover:text-theme-main'
              }`}
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>

            {/* Maximize Toggle */}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? t.modals.pushDiff.restoreTooltip : t.modals.pushDiff.maximizeTooltip}
              className="p-1 hover:bg-theme-hover rounded text-theme-muted hover:text-theme-main transition cursor-pointer"
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              title={t.modals.pushDiff.closeDiffTooltip}
              className="p-1 hover:bg-theme-card-hover rounded text-theme-dim hover:text-rose-400 transition cursor-pointer ml-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Subheader Labels Bar */}
        {isSideBySide ? (
          <div className="h-7 border-b border-theme flex items-center bg-theme-subbar text-xs select-none shrink-0 font-mono text-[11px]">
            {/* Left: 历史基准 */}
            <div className="w-1/2 h-full px-3 border-r border-theme flex items-center justify-between bg-rose-500/[0.04]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shrink-0" />
                <span className="font-bold text-rose-500/90 truncate">
                  {t.modals.pushDiff.parentLabel(diffData?.oldLabel || `${commitHash.slice(0, 7)}^`)}
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium bg-rose-500/10 text-rose-500 border border-rose-500/25 shrink-0 flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" />
                  {t.modals.pushDiff.readOnlyBase}
                </span>
              </div>
              <span className="text-[10px] text-theme-dim hidden md:inline font-mono">
                {t.modals.pushDiff.legendRed}
              </span>
            </div>

            {/* Right: 提交变动 */}
            <div className="w-1/2 h-full px-3 flex items-center justify-between bg-emerald-500/[0.04]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 shrink-0 flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" />
                  {t.modals.pushDiff.readOnlySnapshot}
                </span>
                <span className="font-bold text-emerald-500/90 truncate">
                  {t.modals.pushDiff.commitLabel(diffData?.newLabel || commitHash.slice(0, 7))}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0" />
              </div>
              <span className="text-[10px] text-theme-dim hidden md:inline font-mono">
                {t.modals.pushDiff.legendGreen}
              </span>
            </div>
          </div>
        ) : (
          <div className="h-7 px-3 border-b border-theme flex items-center justify-between bg-theme-subbar text-xs select-none shrink-0 text-[11px] font-mono">
            <div className="flex items-center gap-2 min-w-0">
              <GitCompare className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="font-bold text-theme-main">
                {t.modals.pushDiff.unifiedTitle(diffData?.oldLabel || '', diffData?.newLabel || '')}
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" />
                {t.modals.pushDiff.readOnlySnapshot}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-500 border border-rose-500/30">
                {t.modals.pushDiff.unifiedLegendRed}
              </span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                {t.modals.pushDiff.unifiedLegendGreen}
              </span>
            </div>
          </div>
        )}

        {/* 3. Monaco DiffEditor Body */}
        <div className="flex-1 relative min-h-0 bg-theme-bg">
          {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-theme-panel text-xs text-theme-muted gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              <span className="font-medium">{t.modals.pushDiff.loadingDiff}</span>
              <span className="font-mono text-[10px] text-theme-dim">{fileName}</span>
            </div>
          ) : isBinary ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-theme-panel text-xs select-none p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-3 shadow-inner">
                <FileCode className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-theme-main mb-1">
                {t.modals.pushDiff.binaryTitle(fileName)}
              </h3>
              <p className="text-xs text-theme-dim max-w-md mb-4 leading-relaxed">
                {t.modals.pushDiff.binaryDesc}
              </p>
              <button
                type="button"
                onClick={handleRevealInExplorer}
                className="px-3 py-1.5 bg-theme-hover hover:bg-theme-card border border-theme-border rounded text-xs text-theme-main transition cursor-pointer flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                {t.modals.pushDiff.viewInExplorer}
              </button>
            </div>
          ) : (
            <DiffEditor
              height="100%"
              theme={monacoTheme}
              language={language}
              original={diffData?.original || ''}
              modified={diffData?.modified || ''}
              beforeMount={handleBeforeMount}
              onMount={handleMountDiffEditor}
              loading={
                <div className="w-full h-full flex items-center justify-center bg-theme-panel text-xs text-theme-muted gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
                  <span>{t.modals.pushDiff.renderMonaco}</span>
                </div>
              }
              options={{
                renderSideBySide: isSideBySide,
                readOnly: true,
                originalEditable: false,
                domReadOnly: true,
                automaticLayout: true,
                fontSize: 12,
                lineNumbers: 'on',
                renderIndicators: true,
                diffAlgorithm: 'advanced',
                ignoreTrimWhitespace: false,
                renderOverviewRuler: true,
                overviewRulerBorder: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'off',
                diffWordWrap: 'off',
                enableSplitViewResizing: true,
                useInlineViewWhenSpaceIsLimited: false,
                renderSideBySideInlineBreakpoint: 0,
                hover: { enabled: false },
              }}
            />
          )}
        </div>

        {/* 4. Footer Status Bar */}
        <div className="h-7 px-3 bg-theme-subbar border-t border-theme flex items-center justify-between text-[11px] text-theme-dim shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-theme-card border border-theme-border">
              {language.toUpperCase()}
            </span>
            <span className="text-[10px]">
              {t.modals.pushDiff.shortcutHint}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-theme-dim flex items-center gap-1">
              <Lock className="w-2.5 h-2.5 text-amber-400" />
              {t.modals.pushDiff.readOnlySnapshot}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-0.5 rounded bg-theme-card hover:bg-theme-card-hover text-theme-main text-xs border border-theme-border transition cursor-pointer"
            >
              {t.common.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
