import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../locales';
import Editor from '@monaco-editor/react';
import {
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Lock,
  X,
  Minus,
  Maximize2,
  Minimize2,
  Check,
  CheckCircle2,
} from 'lucide-react';

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'css':
    case 'scss':
      return 'css';
    case 'html':
      return 'html';
    case 'py':
      return 'python';
    case 'java':
      return 'java';
    case 'cpp':
    case 'c':
      return 'cpp';
    case 'md':
      return 'markdown';
    default:
      return 'plaintext';
  }
}

interface ManagedConflictBlock {
  id: number;
  yoursText: string;
  theirsText: string;
  baseText: string;
  yoursBranch: string;
  theirsBranch: string;
  resultStartLine: number;
  resultEndLine: number;
  leftStartLine: number;
  leftEndLine: number;
  rightStartLine: number;
  rightEndLine: number;
  status: 'unresolved' | 'resolved-left' | 'resolved-right' | 'ignored-left' | 'ignored-right';
}

export function ThreeWayMergeModal() {
  const { t } = useTranslation();
  const {
    threeWayMergeOpen,
    threeWayMergeMinimized,
    threeWayLoading,
    threeWayData,
    closeThreeWayMerge,
    setThreeWayMergeMinimized,
    applyThreeWayMergeResult,
    theme,
    projects,
    activeProjectId,
  } = useAppStore();

  const [resultContent, setResultContent] = useState('');
  const [blocks, setBlocks] = useState<ManagedConflictBlock[]>([]);
  const [currentConflictIdx, setCurrentConflictIdx] = useState(0);
  const [isApplying, setIsApplying] = useState(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const centerEditorRef = useRef<any>(null);
  const leftEditorRef = useRef<any>(null);
  const rightEditorRef = useRef<any>(null);

  const leftGutterContentRef = useRef<HTMLDivElement>(null);
  const rightGutterContentRef = useRef<HTMLDivElement>(null);

  const centerDecorationsRef = useRef<string[]>([]);
  const leftDecorationsRef = useRef<string[]>([]);
  const rightDecorationsRef = useRef<string[]>([]);

  const isLight = theme === 'idea-light';
  const monacoTheme = useMemo(() => (isLight ? 'vs' : 'vs-dark'), [isLight]);

  // Initialize clean result and conflict blocks when data arrives (1:1 IntelliJ IDEA Match)
  useEffect(() => {
    if (threeWayData) {
      // 1. Initial Result: IntelliJ IDEA shows the clean Base version in conflict areas (0 git conflict markers!)
      const initialClean =
        threeWayData.cleanResult ||
        threeWayData.base ||
        threeWayData.result.replace(/<<<<<<<[^\n]*\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>>[^\n]*(\r?\n)?/g, '') ||
        threeWayData.yours ||
        '';

      setResultContent(initialClean);

      // 2. Parse and map conflict blocks with line numbers
      const mapped: ManagedConflictBlock[] = (threeWayData.conflictBlocks || []).map((b, idx) => ({
        id: b.id || idx + 1,
        yoursText: b.yoursText || '',
        theirsText: b.theirsText || '',
        baseText: b.baseText || '',
        yoursBranch: b.yoursBranch || 'HEAD',
        theirsBranch: b.theirsBranch || 'incoming',
        resultStartLine: b.resultStartLine || b.startLine || 1,
        resultEndLine: b.resultEndLine || b.endLine || 1,
        leftStartLine: b.leftStartLine || b.startLine || 1,
        leftEndLine: b.leftEndLine || b.endLine || 1,
        rightStartLine: b.rightStartLine || b.startLine || 1,
        rightEndLine: b.rightEndLine || b.endLine || 1,
        status: 'unresolved',
      }));

      setBlocks(mapped);
      setCurrentConflictIdx(0);
    }
  }, [threeWayData]);

  const currentProject = projects.find((p) => p.id === activeProjectId);
  const currentBranch = currentProject?.currentBranch || 'dev';
  const incomingBranch =
    threeWayData?.conflictBlocks?.[0]?.theirsBranch || 'demo-incoming-theirs';
  const language = threeWayData ? getLanguageFromPath(threeWayData.filePath) : 'plaintext';

  const unresolvedBlocks = blocks.filter((b) => b.status === 'unresolved');
  const remainingCount = unresolvedBlocks.length;

  // High-performance GPU-accelerated scroll synchronization across all 3 editors (0 React re-renders on scroll!)
  const isScrollingSync = useRef(false);
  const registerSyncScroll = useCallback((editor: any, source: 'left' | 'center' | 'right') => {
    editor.onDidScrollChange((e: any) => {
      if (isScrollingSync.current || !e.scrollTopChanged) return;
      isScrollingSync.current = true;
      const top = editor.getScrollTop();

      // Direct GPU transform update on Gutter DOM elements: 0 React re-renders! 120 FPS buttery smooth!
      if (leftGutterContentRef.current) {
        leftGutterContentRef.current.style.transform = `translate3d(0, -${top}px, 0)`;
      }
      if (rightGutterContentRef.current) {
        rightGutterContentRef.current.style.transform = `translate3d(0, -${top}px, 0)`;
      }

      if (source !== 'left' && leftEditorRef.current) {
        leftEditorRef.current.setScrollTop(top);
      }
      if (source !== 'center' && centerEditorRef.current) {
        centerEditorRef.current.setScrollTop(top);
      }
      if (source !== 'right' && rightEditorRef.current) {
        rightEditorRef.current.setScrollTop(top);
      }
      isScrollingSync.current = false;
    });
  }, []);

  // Soft background highlight decorations for Monaco editors
  const updateDecorations = useCallback(() => {
    // 1. Center Editor (Result) Highlighting
    if (centerEditorRef.current) {
      const decorations: any[] = [];
      for (const block of blocks) {
        const isResolved = block.status.startsWith('resolved');
        const start = Math.max(1, block.resultStartLine);
        const end = Math.max(start, block.resultEndLine);

        for (let l = start; l <= end; l++) {
          decorations.push({
            range: {
              startLineNumber: l,
              startColumn: 1,
              endLineNumber: l,
              endColumn: 1000,
            },
            options: {
              isWholeLine: true,
              className: isResolved ? 'monaco-resolved-line' : 'monaco-conflict-line',
              inlineClassName: isResolved ? undefined : 'monaco-conflict-inline',
              overviewRuler: {
                color: isResolved ? '#22c55e' : '#ef4444',
                position: 7,
              },
            },
          });
        }
      }
      centerDecorationsRef.current = centerEditorRef.current.deltaDecorations(
        centerDecorationsRef.current,
        decorations
      );
    }

    // 2. Left Editor (dev / Yours) Highlighting
    if (leftEditorRef.current) {
      const decorations: any[] = [];
      for (const block of blocks) {
        const start = Math.max(1, block.leftStartLine);
        const end = Math.max(start, block.leftEndLine);
        for (let l = start; l <= end; l++) {
          decorations.push({
            range: {
              startLineNumber: l,
              startColumn: 1,
              endLineNumber: l,
              endColumn: 1000,
            },
            options: {
              isWholeLine: true,
              className: 'monaco-conflict-line',
              overviewRuler: {
                color: '#ef4444',
                position: 7,
              },
            },
          });
        }
      }
      leftDecorationsRef.current = leftEditorRef.current.deltaDecorations(
        leftDecorationsRef.current,
        decorations
      );
    }

    // 3. Right Editor (incoming / Theirs) Highlighting
    if (rightEditorRef.current) {
      const decorations: any[] = [];
      for (const block of blocks) {
        const start = Math.max(1, block.rightStartLine);
        const end = Math.max(start, block.rightEndLine);
        for (let l = start; l <= end; l++) {
          decorations.push({
            range: {
              startLineNumber: l,
              startColumn: 1,
              endLineNumber: l,
              endColumn: 1000,
            },
            options: {
              isWholeLine: true,
              className: 'monaco-conflict-line',
              overviewRuler: {
                color: '#ef4444',
                position: 7,
              },
            },
          });
        }
      }
      rightDecorationsRef.current = rightEditorRef.current.deltaDecorations(
        rightDecorationsRef.current,
        decorations
      );
    }
  }, [blocks]);

  useEffect(() => {
    const timer = setTimeout(updateDecorations, 50);
    return () => clearTimeout(timer);
  }, [updateDecorations]);

  // Jump to specific conflict across all 3 editors
  const jumpToConflict = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= blocks.length) return;
      setCurrentConflictIdx(idx);
      const block = blocks[idx];

      if (centerEditorRef.current) {
        centerEditorRef.current.revealLineInCenter(block.resultStartLine);
        centerEditorRef.current.setPosition({ lineNumber: block.resultStartLine, column: 1 });
      }
      if (leftEditorRef.current) {
        leftEditorRef.current.revealLineInCenter(block.leftStartLine);
      }
      if (rightEditorRef.current) {
        rightEditorRef.current.revealLineInCenter(block.rightStartLine);
      }
    },
    [blocks]
  );

  const handleNextConflict = () => {
    if (blocks.length === 0) return;
    const nextIdx = (currentConflictIdx + 1) % blocks.length;
    jumpToConflict(nextIdx);
  };

  const handlePrevConflict = () => {
    if (blocks.length === 0) return;
    const prevIdx = (currentConflictIdx - 1 + blocks.length) % blocks.length;
    jumpToConflict(prevIdx);
  };

  // 1:1 IntelliJ IDEA Action: Apply single block to Result (via >> or <<)
  const applyBlock = (blockId: number, side: 'left' | 'right') => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block || !centerEditorRef.current) return;

    const textToInsert = side === 'left' ? block.yoursText : block.theirsText;
    const model = centerEditorRef.current.getModel();
    if (!model) return;

    const startLine = block.resultStartLine;
    const endLine = block.resultEndLine;
    const maxCol = model.getLineMaxColumn(endLine);

    // Atomic replacement in Monaco editor (preserves undo/redo and clean code)
    centerEditorRef.current.executeEdits('three-way-merge', [
      {
        range: {
          startLineNumber: startLine,
          startColumn: 1,
          endLineNumber: endLine,
          endColumn: maxCol,
        },
        text: textToInsert,
        forceMoveMarkers: true,
      },
    ]);

    const oldLineCount = Math.max(1, endLine - startLine + 1);
    const newLineCount = Math.max(1, textToInsert.split(/\r?\n/).length);
    const deltaLines = newLineCount - oldLineCount;

    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id === blockId) {
          return {
            ...b,
            resultEndLine: b.resultStartLine + newLineCount - 1,
            status: side === 'left' ? 'resolved-left' : 'resolved-right',
          };
        } else if (b.resultStartLine > block.resultStartLine) {
          return {
            ...b,
            resultStartLine: b.resultStartLine + deltaLines,
            resultEndLine: b.resultEndLine + deltaLines,
          };
        }
        return b;
      })
    );
  };

  // 1:1 IntelliJ IDEA Action: Ignore single block (via ✕)
  const ignoreBlock = (blockId: number, side: 'left' | 'right') => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id === blockId) {
          return {
            ...b,
            status: side === 'left' ? 'ignored-left' : 'ignored-right',
          };
        }
        return b;
      })
    );
  };

  // Accept All Left (bottom-up application to avoid line shift)
  const handleAcceptAllLeft = () => {
    const sorted = [...blocks].sort((a, b) => b.resultStartLine - a.resultStartLine);
    for (const b of sorted) {
      applyBlock(b.id, 'left');
    }
  };

  // Accept All Right (bottom-up application to avoid line shift)
  const handleAcceptAllRight = () => {
    const sorted = [...blocks].sort((a, b) => b.resultStartLine - a.resultStartLine);
    for (const b of sorted) {
      applyBlock(b.id, 'right');
    }
  };

  // 1:1 IDEA Feature: Apply Non-Conflicting Changes
  const handleApplyNonConflicting = (side: 'left' | 'all' | 'right' = 'all') => {
    const identical = blocks.filter((b) => b.yoursText.trim() === b.theirsText.trim());
    if (identical.length > 0) {
      for (const b of identical) {
        applyBlock(b.id, 'left');
      }
      alert(t.modals.threeWay.autoAcceptedAlert(identical.length));
    } else {
      alert(t.modals.threeWay.noIdenticalAlert);
    }
  };

  // Apply final Result and mark file resolved
  const handleApply = async () => {
    if (!threeWayData) return;

    if (remainingCount > 0) {
      const confirmSave = window.confirm(
        t.modals.threeWay.unresolvedConfirm(remainingCount)
      );
      if (!confirmSave) return;
    }

    setIsApplying(true);
    try {
      const finalValue = centerEditorRef.current
        ? centerEditorRef.current.getValue()
        : resultContent;
      await applyThreeWayMergeResult(threeWayData.filePath, finalValue);
    } finally {
      setIsApplying(false);
    }
  };

  if (!threeWayMergeOpen) return null;

  // 1. Instant Pop-up Loading Modal: 0ms perceived response when user clicks Merge...
  if (threeWayLoading || !threeWayData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
        <div
          className={`p-6 rounded-xl border shadow-2xl flex flex-col items-center gap-4 min-w-[320px] ${
            isLight ? 'bg-white border-[#d1d5db] text-[#27282c]' : 'bg-[#1e1f22] border-[#4e5157] text-[#dfe1e5]'
          }`}
        >
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <h3 className="text-sm font-semibold mb-1">{t.modals.threeWay.loadingMerge}</h3>
            <p className="text-xs text-gray-400">{t.modals.threeWay.extractingBase}</p>
          </div>
        </div>
      </div>
    );
  }

  const fullFilePath = currentProject
    ? `${currentProject.path}\\${threeWayData.filePath.replace(/\//g, '\\')}`
    : threeWayData.filePath;

  // Minimized Floating Pill
  if (threeWayMergeMinimized) {
    return (
      <div
        onClick={() => setThreeWayMergeMinimized(false)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#2b2d30] border border-[#4e5157] text-[#dfe1e5] shadow-2xl cursor-pointer hover:bg-[#35373c] transition select-none group"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-white truncate max-w-[220px]">
            Merge: {threeWayData.filePath}
          </span>
          <span className="text-[11px] text-[#868a91]">
            {remainingCount > 0 ? t.modals.threeWay.conflictsRemaining(remainingCount) : t.modals.threeWay.conflictsResolved}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            closeThreeWayMerge();
          }}
          className="p-1 hover:bg-[#4e5157] rounded text-gray-400 hover:text-white ml-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs transition-all ${
        isMaximized ? 'p-0' : 'p-3'
      }`}
    >
      <div
        className={`text-xs font-sans select-none flex flex-col overflow-hidden border shadow-2xl transition-all duration-150 ${
          isLight
            ? 'bg-[#f7f8fa] text-[#27282c] border-[#c0c4cb]'
            : 'bg-[#1e1f22] text-[#bcbec4] border-[#4e5157]'
        } ${
          isMaximized
            ? 'w-full h-full rounded-none border-none'
            : 'w-[96vw] h-[93vh] max-w-[1760px] max-h-[980px] rounded-xl'
        }`}
      >
        {/* 1. Title Bar (1:1 IntelliJ IDEA Match: media_1789009410299.png) */}
        <div
          className={`h-8 px-3 border-b flex items-center justify-between shrink-0 ${
            isLight ? 'bg-[#ebecef] border-[#d1d5db]' : 'bg-[#2b2d30] border-[#393b40]'
          }`}
        >
          <div className="flex items-center gap-2 text-xs truncate font-mono">
            <span className="w-3.5 h-3.5 rounded bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
              ⚑
            </span>
            <span
              className={`font-semibold text-xs truncate ${
                isLight ? 'text-[#27282c]' : 'text-[#dfe1e5]'
              }`}
            >
              Merge Revisions for {fullFilePath}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setThreeWayMergeMinimized(true)}
              className="p-1 hover:bg-[#393b40] rounded text-[#868a91] hover:text-white transition cursor-pointer"
              title={t.common.minimize}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1 hover:bg-[#393b40] rounded text-[#868a91] hover:text-white transition cursor-pointer"
              title={isMaximized ? t.common.restore : t.common.maximize}
            >
              {isMaximized ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={closeThreeWayMerge}
              className="p-1 hover:bg-rose-500 rounded text-[#868a91] hover:text-white transition cursor-pointer"
              title={t.common.close}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Secondary Toolbar (1:1 IntelliJ IDEA Match: media_1789009410299.png) */}
        <div
          className={`h-9 px-3 border-b flex items-center justify-between shrink-0 font-sans ${
            isLight ? 'bg-[#f2f3f5] border-[#d1d5db]' : 'bg-[#26282b] border-[#393b40]'
          }`}
        >
          <div className="flex items-center gap-2">
            {/* Conflict Navigation Up/Down */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={handlePrevConflict}
                className="p-1 hover:bg-[#393b40] rounded text-[#868a91] hover:text-white transition cursor-pointer"
                title={t.modals.threeWay.prevConflictTooltip}
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleNextConflict}
                className="p-1 hover:bg-[#393b40] rounded text-[#868a91] hover:text-white transition cursor-pointer"
                title={t.modals.threeWay.nextConflictTooltip}
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-4 w-px bg-gray-600/40 mx-1" />

            {/* Apply non-conflicting changes */}
            <div className="flex items-center gap-1.5 text-xs text-[#868a91]">
              <span className="font-medium">{t.modals.threeWay.applyNonConflictingLabel}</span>
              <button
                onClick={() => handleApplyNonConflicting('left')}
                className="px-2 py-0.5 rounded hover:bg-theme-hover text-xs font-semibold text-[#3574f0] transition cursor-pointer flex items-center gap-1"
                title={t.modals.threeWay.applyLeftNonConflicting}
              >
                &gt;&gt; Left
              </button>
              <button
                onClick={() => handleApplyNonConflicting('all')}
                className="px-2 py-0.5 rounded hover:bg-theme-hover text-xs font-semibold text-[#3574f0] transition cursor-pointer flex items-center gap-1"
                title={t.modals.threeWay.applyAllNonConflicting}
              >
                &gt;&gt; &lt;&lt; All
              </button>
              <button
                onClick={() => handleApplyNonConflicting('right')}
                className="px-2 py-0.5 rounded hover:bg-theme-hover text-xs font-semibold text-[#3574f0] transition cursor-pointer flex items-center gap-1"
                title={t.modals.threeWay.applyRightNonConflicting}
              >
                &lt;&lt; Right
              </button>
            </div>

            <div className="h-4 w-px bg-gray-600/40 mx-1" />

            {/* Ignore whitespace dropdown */}
            <button
              onClick={() => setIgnoreWhitespace(!ignoreWhitespace)}
              className="px-2 py-0.5 rounded hover:bg-theme-hover text-xs text-[#868a91] flex items-center gap-1 cursor-pointer"
            >
              <span>{ignoreWhitespace ? t.modals.threeWay.ignoreWhitespaceTooltip : t.modals.threeWay.doNotIgnoreWhitespaceTooltip}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            <span className="px-2 py-0.5 text-xs text-[#868a91] opacity-70">
              {t.modals.threeWay.highlightWords}
            </span>
          </div>

          {/* Right Status (1:1 IDEA Match: No changes. 4 conflicts.) */}
          <div className="flex items-center gap-2 text-xs">
            {remainingCount > 0 ? (
              <span className="font-medium text-amber-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                {t.modals.threeWay.unresolvedStatus(remainingCount)}
              </span>
            ) : (
              <span className="font-semibold text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t.modals.threeWay.readyStatus}
              </span>
            )}
          </div>
        </div>

        {/* 3. Column Header Labels (1:1 IntelliJ IDEA Match) */}
        <div
          className={`h-7 border-b flex items-center text-xs shrink-0 font-sans select-none ${
            isLight ? 'bg-[#ebecef] border-[#d1d5db]' : 'bg-[#2b2d30] border-[#393b40]'
          }`}
        >
          {/* Left Header */}
          <div className="flex-1 px-3 border-r border-[#393b40]/30 flex items-center justify-between text-[#868a91]">
            <div className="flex items-center gap-1.5 truncate">
              <Lock className="w-3 h-3 text-[#868a91] shrink-0" />
              <span className="truncate">
                Changes from <strong className="text-[#3574f0]">{currentBranch}</strong>
              </span>
            </div>
            <span className="text-[11px] text-[#868a91] shrink-0 font-mono">(Yours)</span>
          </div>

          {/* Left Gutter Space Header */}
          <div className="w-11 shrink-0 border-r border-[#393b40]/30" />

          {/* Center Header */}
          <div className="flex-1 px-3 border-r border-[#393b40]/30 flex items-center justify-between">
            <span className="font-semibold truncate">
              Result{' '}
              <span className="font-normal text-[#868a91] ml-1">{threeWayData.filePath}</span>
            </span>
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                remainingCount > 0
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {remainingCount > 0 ? t.modals.threeWay.unresolvedStatus(remainingCount) : t.modals.threeWay.readyStatus}
            </span>
          </div>

          {/* Right Gutter Space Header */}
          <div className="w-11 shrink-0 border-r border-[#393b40]/30" />

          {/* Right Header */}
          <div className="flex-1 px-3 flex items-center justify-between text-[#868a91]">
            <div className="flex items-center gap-1.5 truncate">
              <Lock className="w-3 h-3 text-[#868a91] shrink-0" />
              <span className="truncate">
                Changes from <strong className="text-purple-400">{incomingBranch}</strong>
              </span>
            </div>
            <span className="text-[11px] text-[#868a91] shrink-0 font-mono">(Theirs)</span>
          </div>
        </div>

        {/* 4. Three-Column Code View with Gutter Action Buttons (1:1 IntelliJ IDEA Match) */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* 4.1 Left Editor: dev (Yours - Read-only) */}
          <div
            className={`flex-1 h-full border-r flex flex-col relative ${
              isLight ? 'border-[#d1d5db] bg-white' : 'border-[#393b40] bg-[#1e1f22]'
            }`}
          >
            <Editor
              height="100%"
              theme={monacoTheme}
              language={language}
              value={threeWayData.yours || ''}
              onMount={(editor) => {
                leftEditorRef.current = editor;
                registerSyncScroll(editor, 'left');
                updateDecorations();
              }}
              options={{
                readOnly: true,
                automaticLayout: true,
                fontSize: 12,
                lineNumbers: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'off',
                fastScrollSensitivity: 7,
                smoothScrolling: true,
              }}
            />
          </div>

          {/* 4.2 Left Gutter: Action Buttons (Between Left and Center) - GPU Hardware Accelerated */}
          <div
            className={`w-11 relative h-full shrink-0 border-r overflow-hidden select-none ${
              isLight ? 'bg-[#f4f5f7] border-[#d1d5db]' : 'bg-[#2b2d30] border-[#393b40]'
            }`}
          >
            <div ref={leftGutterContentRef} className="absolute inset-x-0 top-0 will-change-transform">
              {blocks.map((block) => {
                const contentTop = centerEditorRef.current
                  ? centerEditorRef.current.getTopForLineNumber(block.resultStartLine)
                  : (block.resultStartLine - 1) * 19;

                const isResolvedLeft = block.status === 'resolved-left';

                return (
                  <div
                    key={block.id}
                    style={{ position: 'absolute', top: `${contentTop}px`, left: 0, right: 0 }}
                    className="h-6 flex items-center justify-center gap-1 px-1"
                  >
                    {isResolvedLeft ? (
                      <span
                        className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-0.5"
                        title={t.modals.threeWay.acceptedLeftTooltip}
                      >
                        <Check className="w-2.5 h-2.5" />
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => ignoreBlock(block.id, 'left')}
                          className="p-1 hover:bg-rose-500/20 text-gray-400 hover:text-rose-500 rounded transition cursor-pointer"
                          title={t.modals.threeWay.ignoreLeftTooltip}
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => applyBlock(block.id, 'left')}
                          className="px-1 py-0.5 hover:bg-[#3574f0] text-[#3574f0] hover:text-white rounded transition text-[11px] font-black cursor-pointer shadow-2xs"
                          title={t.modals.threeWay.acceptLeftTooltip}
                        >
                          &gt;&gt;
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4.3 Center Editor: Result (Pure clean code, completely editable) */}
          <div
            className={`flex-1 h-full border-r flex flex-col relative ${
              isLight ? 'border-[#d1d5db] bg-white' : 'border-[#393b40] bg-[#1e1f22]'
            }`}
          >
            <Editor
              height="100%"
              theme={monacoTheme}
              language={language}
              value={resultContent}
              onChange={(val) => setResultContent(val || '')}
              onMount={(editor) => {
                centerEditorRef.current = editor;
                registerSyncScroll(editor, 'center');
                updateDecorations();
              }}
              options={{
                readOnly: false,
                automaticLayout: true,
                fontSize: 12,
                lineNumbers: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'off',
                fastScrollSensitivity: 7,
                smoothScrolling: true,
              }}
            />
          </div>

          {/* 4.4 Right Gutter: Action Buttons (Between Center and Right) - GPU Hardware Accelerated */}
          <div
            className={`w-11 relative h-full shrink-0 border-r overflow-hidden select-none ${
              isLight ? 'bg-[#f4f5f7] border-[#d1d5db]' : 'bg-[#2b2d30] border-[#393b40]'
            }`}
          >
            <div ref={rightGutterContentRef} className="absolute inset-x-0 top-0 will-change-transform">
              {blocks.map((block) => {
                const contentTop = centerEditorRef.current
                  ? centerEditorRef.current.getTopForLineNumber(block.resultStartLine)
                  : (block.resultStartLine - 1) * 19;

                const isResolvedRight = block.status === 'resolved-right';

                return (
                  <div
                    key={block.id}
                    style={{ position: 'absolute', top: `${contentTop}px`, left: 0, right: 0 }}
                    className="h-6 flex items-center justify-center gap-1 px-1"
                  >
                    {isResolvedRight ? (
                      <span
                        className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-0.5"
                        title={t.modals.threeWay.acceptedRightTooltip}
                      >
                        <Check className="w-2.5 h-2.5" />
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => applyBlock(block.id, 'right')}
                          className="px-1 py-0.5 hover:bg-[#3574f0] text-[#3574f0] hover:text-white rounded transition text-[11px] font-black cursor-pointer shadow-2xs"
                          title={t.modals.threeWay.acceptRightTooltip}
                        >
                          &lt;&lt;
                        </button>
                        <button
                          type="button"
                          onClick={() => ignoreBlock(block.id, 'right')}
                          className="p-1 hover:bg-rose-500/20 text-gray-400 hover:text-rose-500 rounded transition cursor-pointer"
                          title={t.modals.threeWay.ignoreRightTooltip}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4.5 Right Editor: incoming (Theirs - Read-only) */}
          <div
            className={`flex-1 h-full flex flex-col relative ${
              isLight ? 'bg-white' : 'bg-[#1e1f22]'
            }`}
          >
            <Editor
              height="100%"
              theme={monacoTheme}
              language={language}
              value={threeWayData.theirs || ''}
              onMount={(editor) => {
                rightEditorRef.current = editor;
                registerSyncScroll(editor, 'right');
                updateDecorations();
              }}
              options={{
                readOnly: true,
                automaticLayout: true,
                fontSize: 12,
                lineNumbers: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'off',
                fastScrollSensitivity: 7,
                smoothScrolling: true,
              }}
            />
          </div>
        </div>

        {/* 5. Bottom Action Bar (1:1 IntelliJ IDEA Match: media_1789009410299.png) */}
        <div
          className={`h-11 px-4 border-t flex items-center justify-between shrink-0 select-none ${
            isLight ? 'bg-[#ebecef] border-[#d1d5db]' : 'bg-[#2b2d30] border-[#393b40]'
          }`}
        >
          {/* Left: [ Accept Left ] [ Accept Right ] */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAcceptAllLeft}
              className={`px-3 py-1.5 rounded border text-xs font-medium transition cursor-pointer shadow-xs ${
                isLight
                  ? 'bg-white hover:bg-[#f2f3f5] text-[#27282c] border-[#c0c4cb]'
                  : 'bg-[#393b40] hover:bg-[#43454a] text-[#dfe1e5] border-[#4e5157]'
              }`}
            >
              Accept Left
            </button>
            <button
              type="button"
              onClick={handleAcceptAllRight}
              className={`px-3 py-1.5 rounded border text-xs font-medium transition cursor-pointer shadow-xs ${
                isLight
                  ? 'bg-white hover:bg-[#f2f3f5] text-[#27282c] border-[#c0c4cb]'
                  : 'bg-[#393b40] hover:bg-[#43454a] text-[#dfe1e5] border-[#4e5157]'
              }`}
            >
              Accept Right
            </button>
          </div>

          {/* Center Hint */}
          <div className="text-xs text-gray-500 font-sans hidden sm:block">
            {remainingCount > 0
              ? t.modals.threeWay.bottomStatusUnresolved(remainingCount)
              : t.modals.threeWay.bottomStatusReady}
          </div>

          {/* Right: [ Apply ] [ Cancel ] */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying}
              className="px-5 py-1.5 rounded bg-[#3574f0] hover:bg-[#265ed4] disabled:opacity-50 text-white text-xs font-semibold transition cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              {isApplying ? 'Applying...' : 'Apply'}
            </button>
            <button
              type="button"
              onClick={closeThreeWayMerge}
              className={`px-4 py-1.5 rounded border text-xs font-medium transition cursor-pointer shadow-xs ${
                isLight
                  ? 'bg-white hover:bg-[#f2f3f5] text-[#27282c] border-[#c0c4cb]'
                  : 'bg-[#393b40] hover:bg-[#43454a] text-[#dfe1e5] border-[#4e5157]'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
