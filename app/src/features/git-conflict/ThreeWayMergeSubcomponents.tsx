import React from 'react';
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
import { useTranslation } from '../../locales';

export function getLanguageFromPath(filePath: string): string {
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

export interface ManagedConflictBlock {
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

interface ThreeWayMergeHeaderProps {
  isLight: boolean;
  fullFilePath: string;
  filePath: string;
  currentBranch: string;
  incomingBranch: string;
  remainingCount: number;
  ignoreWhitespace: boolean;
  setIgnoreWhitespace: (val: boolean) => void;
  isMaximized: boolean;
  setIsMaximized: (val: boolean) => void;
  setThreeWayMergeMinimized: (val: boolean) => void;
  closeThreeWayMerge: () => void;
  handlePrevConflict: () => void;
  handleNextConflict: () => void;
  handleApplyNonConflicting: (side: 'left' | 'all' | 'right') => void;
}

export const ThreeWayMergeHeader: React.FC<ThreeWayMergeHeaderProps> = ({
  isLight,
  fullFilePath,
  filePath,
  currentBranch,
  incomingBranch,
  remainingCount,
  ignoreWhitespace,
  setIgnoreWhitespace,
  isMaximized,
  setIsMaximized,
  setThreeWayMergeMinimized,
  closeThreeWayMerge,
  handlePrevConflict,
  handleNextConflict,
  handleApplyNonConflicting,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* 1. Title Bar */}
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

      {/* 2. Secondary Toolbar */}
      <div
        className={`h-9 px-3 border-b flex items-center justify-between shrink-0 font-sans ${
          isLight ? 'bg-[#f2f3f5] border-[#d1d5db]' : 'bg-[#26282b] border-[#393b40]'
        }`}
      >
        <div className="flex items-center gap-2">
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

          <button
            onClick={() => setIgnoreWhitespace(!ignoreWhitespace)}
            className="px-2 py-0.5 rounded hover:bg-theme-hover text-xs text-[#868a91] flex items-center gap-1 cursor-pointer"
          >
            <span>
              {ignoreWhitespace
                ? t.modals.threeWay.ignoreWhitespaceTooltip
                : t.modals.threeWay.doNotIgnoreWhitespaceTooltip}
            </span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          <span className="px-2 py-0.5 text-xs text-[#868a91] opacity-70">
            {t.modals.threeWay.highlightWords}
          </span>
        </div>

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

      {/* 3. Column Header Labels */}
      <div
        className={`h-7 border-b flex items-center text-xs shrink-0 font-sans select-none ${
          isLight ? 'bg-[#ebecef] border-[#d1d5db]' : 'bg-[#2b2d30] border-[#393b40]'
        }`}
      >
        <div className="flex-1 px-3 border-r border-[#393b40]/30 flex items-center justify-between text-[#868a91]">
          <div className="flex items-center gap-1.5 truncate">
            <Lock className="w-3 h-3 text-[#868a91] shrink-0" />
            <span className="truncate">
              Changes from <strong className="text-[#3574f0]">{currentBranch}</strong>
            </span>
          </div>
          <span className="text-[11px] text-[#868a91] shrink-0 font-mono">(Yours)</span>
        </div>

        <div className="w-11 shrink-0 border-r border-[#393b40]/30" />

        <div className="flex-1 px-3 border-r border-[#393b40]/30 flex items-center justify-between">
          <span className="font-semibold truncate">
            Result <span className="font-normal text-[#868a91] ml-1">{filePath}</span>
          </span>
          <span
            className={`text-[11px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
              remainingCount > 0
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {remainingCount > 0
              ? t.modals.threeWay.unresolvedStatus(remainingCount)
              : t.modals.threeWay.readyStatus}
          </span>
        </div>

        <div className="w-11 shrink-0 border-r border-[#393b40]/30" />

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
    </>
  );
};

interface ThreeWayMergeGutterProps {
  side: 'left' | 'right';
  isLight: boolean;
  gutterContentRef: React.RefObject<HTMLDivElement | null>;
  blocks: ManagedConflictBlock[];
  centerEditorRef: React.MutableRefObject<any>;
  applyBlock: (blockId: number, side: 'left' | 'right') => void;
  ignoreBlock: (blockId: number, side: 'left' | 'right') => void;
}

export const ThreeWayMergeGutter: React.FC<ThreeWayMergeGutterProps> = ({
  side,
  isLight,
  gutterContentRef,
  blocks,
  centerEditorRef,
  applyBlock,
  ignoreBlock,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`w-11 relative h-full shrink-0 border-r overflow-hidden select-none ${
        isLight ? 'bg-[#f4f5f7] border-[#d1d5db]' : 'bg-[#2b2d30] border-[#393b40]'
      }`}
    >
      <div ref={gutterContentRef} className="absolute inset-x-0 top-0 will-change-transform">
        {blocks.map((block) => {
          const contentTop = centerEditorRef.current
            ? centerEditorRef.current.getTopForLineNumber(block.resultStartLine)
            : (block.resultStartLine - 1) * 19;

          const isResolved =
            side === 'left' ? block.status === 'resolved-left' : block.status === 'resolved-right';

          return (
            <div
              key={block.id}
              style={{ position: 'absolute', top: `${contentTop}px`, left: 0, right: 0 }}
              className="h-6 flex items-center justify-center gap-1 px-1"
            >
              {isResolved ? (
                <span
                  className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-0.5"
                  title={
                    side === 'left'
                      ? t.modals.threeWay.acceptedLeftTooltip
                      : t.modals.threeWay.acceptedRightTooltip
                  }
                >
                  <Check className="w-2.5 h-2.5" />
                </span>
              ) : side === 'left' ? (
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
  );
};
