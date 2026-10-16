import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useGlobalSearchStore, type SearchResultItem } from './useGlobalSearchStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { useEditorTabsStore } from '../code-editor/useEditorTabsStore';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../locales';
import {
  Search,
  X,
  FileCode,
  Folder,
  Loader2,
  Code2,
  ChevronRight,
  Filter,
  Check,
  CornerDownLeft,
} from 'lucide-react';

export function GlobalSearchModal() {
  const {
    isOpen,
    query,
    isCaseSensitive,
    isWholeWord,
    isRegex,
    filePattern,
    searchScope,
    isSearching,
    results,
    groupedResults,
    totalMatches,
    selectedMatchIndex,
    closeSearchModal,
    setQuery,
    setIsCaseSensitive,
    setIsWholeWord,
    setIsRegex,
    setFilePattern,
    setSearchScope,
    setSelectedMatchIndex,
    executeSearch,
  } = useGlobalSearchStore();

  const { projects, activeProjectId } = useAppStore();
  const { setWorkbenchMode } = useWorkbenchStore();
  const { openFileTab } = useEditorTabsStore();
  const { t } = useTranslation();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Active project name for current scope
  const activeProject = projects.find((p) => p.id === activeProjectId);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  // Expose global opener on window
  useEffect(() => {
    (window as any).__openGlobalSearch = (initialQuery?: string) => {
      useGlobalSearchStore.getState().openSearchModal(initialQuery);
    };
  }, []);

  const handleJumpToMatch = async (match: SearchResultItem) => {
    closeSearchModal();
    setWorkbenchMode('explorer');

    const fullPath = match.filePath || `${match.repoPath}/${match.relativePath || match.file}`.replace(/\\/g, '/');
    const targetLine = match.lineNumber ?? match.line ?? 1;
    const targetCol = match.column || (match.matchStart !== undefined ? match.matchStart + 1 : 1);

    await openFileTab({
      filePath: fullPath,
      repoPath: match.repoPath,
      relativePath: match.relativePath || match.file,
      repoName: match.repoName,
    });

    // Reveal line in Monaco editor
    setTimeout(() => {
      const editor = (window as any).__currentCodeEditor;
      if (editor) {
        editor.revealLineInCenter(targetLine);
        editor.setPosition({
          lineNumber: targetLine,
          column: targetCol,
        });
        editor.focus();
      }
    }, 150);
  };

  // Keyboard navigation: Enter, Esc, Up, Down
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearchModal();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) {
        const nextIdx = Math.min(selectedMatchIndex + 1, results.length - 1);
        setSelectedMatchIndex(nextIdx);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        const prevIdx = Math.max(selectedMatchIndex - 1, 0);
        setSelectedMatchIndex(prevIdx);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedMatchIndex >= 0 && selectedMatchIndex < results.length) {
        handleJumpToMatch(results[selectedMatchIndex]);
      }
    }
  };

  // Map flat index to item
  const selectedMatch = results[selectedMatchIndex] || null;

  // Highlight matched query substring within line snippet
  const renderHighlightedText = (lineText: string, searchQuery: string) => {
    if (!searchQuery.trim() || !lineText) return lineText;

    try {
      let regex: RegExp;
      if (isRegex) {
        regex = new RegExp(`(${searchQuery})`, isCaseSensitive ? 'g' : 'gi');
      } else {
        const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = isWholeWord ? `\\b(${escaped})\\b` : `(${escaped})`;
        regex = new RegExp(pattern, isCaseSensitive ? 'g' : 'gi');
      }

      const parts = lineText.split(regex);
      return parts.map((part, i) =>
        regex.test(part) ? (
          <span
            key={i}
            className="bg-amber-300 dark:bg-amber-400/30 text-amber-950 dark:text-amber-100 font-semibold px-0.5 rounded border border-amber-400/50 dark:border-amber-400/30 shadow-xs"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      );
    } catch {
      return lineText;
    }
  };

  if (!isOpen) return null;

  let flatCounter = -1;

  return (
    <div
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-start justify-center pt-14 bg-black/50 backdrop-blur-xs select-none"
    >
      {/* Modal Dialog Container */}
      <div
        className="w-[860px] max-w-[95vw] max-h-[82vh] bg-theme-panel border border-theme-border rounded-xl shadow-2xl flex flex-col overflow-hidden text-theme-main animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header & Primary Search Input */}
        <div className="p-3 border-b border-theme-border bg-theme-header flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />
            <span className="font-semibold text-xs tracking-wide uppercase text-theme-muted">
              {t.globalSearch.title}
            </span>
            <div className="flex-1" />
            <button
              onClick={closeSearchModal}
              className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-theme-main transition cursor-pointer"
              title="Esc"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Box with Inline Toggle Switches */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-theme-input border border-theme-border focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500/30 transition-all">
            <Search className="w-4 h-4 text-theme-muted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.globalSearch.searchPlaceholder}
              className="bg-transparent border-none outline-none text-xs w-full text-theme-main placeholder:text-theme-muted/50 font-mono"
            />

            {/* Quick Filter Buttons */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Match Case */}
              <button
                type="button"
                onClick={() => setIsCaseSensitive(!isCaseSensitive)}
                title={t.globalSearch.matchCase}
                className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-medium transition cursor-pointer ${
                  isCaseSensitive
                    ? 'bg-sky-500 text-white shadow-xs'
                    : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover'
                }`}
              >
                Aa
              </button>

              {/* Match Whole Word */}
              <button
                type="button"
                onClick={() => setIsWholeWord(!isWholeWord)}
                title={t.globalSearch.matchWord}
                className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-medium transition cursor-pointer ${
                  isWholeWord
                    ? 'bg-sky-500 text-white shadow-xs'
                    : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover'
                }`}
              >
                \b
              </button>

              {/* Regex */}
              <button
                type="button"
                onClick={() => setIsRegex(!isRegex)}
                title={t.globalSearch.useRegex}
                className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-medium transition cursor-pointer ${
                  isRegex
                    ? 'bg-sky-500 text-white shadow-xs'
                    : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover'
                }`}
              >
                .*
              </button>

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1 rounded text-theme-muted hover:text-theme-main"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 2. Secondary Filter Options: Scope & File Pattern */}
          <div className="flex items-center justify-between gap-3 text-xs pt-0.5">
            {/* Scope Pills */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-theme-muted font-medium">{t.globalSearch.scopePrefix}:</span>
              <button
                type="button"
                onClick={() => setSearchScope('all')}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition cursor-pointer ${
                  searchScope === 'all'
                    ? 'bg-sky-500/15 dark:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-semibold'
                    : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover border border-transparent'
                }`}
              >
                {t.globalSearch.scopeAllProjects} ({projects.length})
              </button>

              {activeProject && (
                <button
                  type="button"
                  onClick={() => setSearchScope('current')}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition cursor-pointer max-w-[200px] truncate ${
                    searchScope === 'current'
                      ? 'bg-sky-500/15 dark:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-semibold'
                      : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover border border-transparent'
                  }`}
                  title={activeProject.name}
                >
                  {t.globalSearch.scopeCurrentProject}: {activeProject.name}
                </button>
              )}
            </div>

            {/* File Mask Filter */}
            <div className="flex items-center gap-1.5 min-w-[220px]">
              <Filter className="w-3.5 h-3.5 text-theme-muted shrink-0" />
              <input
                type="text"
                value={filePattern}
                onChange={(e) => setFilePattern(e.target.value)}
                placeholder={t.globalSearch.fileMaskPlaceholder}
                className="px-2 py-1 rounded bg-theme-input border border-theme-border text-xs w-full text-theme-main placeholder:text-theme-muted/50 font-mono outline-none focus:border-sky-500 transition-colors"
              />
              {filePattern && (
                <button
                  type="button"
                  onClick={() => setFilePattern('')}
                  className="text-theme-muted hover:text-theme-main p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3. Search Results & Context Preview Dual-Pane */}
        <div className="flex-1 flex overflow-hidden min-h-[360px]">
          {/* Left: Results List Grouped by File */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto border-r border-theme-border py-1 divide-y divide-theme-border/30"
          >
            {isSearching ? (
              <div className="flex flex-col items-center justify-center h-64 gap-2 text-theme-muted text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                <span>{t.globalSearch.searching}</span>
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-2 text-theme-muted text-xs text-center p-6">
                <Code2 className="w-8 h-8 text-theme-muted/40 stroke-[1.5]" />
                <p className="font-medium text-theme-main">{t.globalSearch.noResults}</p>
                <p className="text-[11px] text-theme-muted/70">{t.globalSearch.shortcutHint}</p>
              </div>
            ) : (
              groupedResults.map((group) => (
                <div key={group.filePath} className="py-1">
                  {/* Group Header: File Information */}
                  <div className="px-3 py-1.5 flex items-center justify-between text-xs font-semibold text-theme-main bg-theme-hover/60 dark:bg-theme-hover/40 border-b border-theme-border/40 sticky top-0 z-10 backdrop-blur-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0" />
                      <span className="font-semibold text-xs text-theme-main shrink-0 max-w-[280px] truncate" title={group.fileName}>
                        {group.fileName}
                      </span>
                      <span className="text-[11px] text-theme-muted font-normal truncate opacity-75" title={group.relativePath}>
                        {group.repoName ? `${group.repoName} · ` : ''}
                        {group.relativePath}
                      </span>
                    </div>
                    <span className="text-[10px] text-sky-700 dark:text-sky-300 font-mono bg-sky-500/10 dark:bg-sky-500/20 px-1.5 py-0.5 rounded border border-sky-500/20 shrink-0 font-medium">
                      {group.matches.length}
                    </span>
                  </div>

                  {/* Matches within this file */}
                  <div className="flex flex-col">
                    {group.matches.map((m) => {
                      flatCounter++;
                      const currentFlatIdx = flatCounter;
                      const isSelected = selectedMatchIndex === currentFlatIdx;

                      return (
                        <div
                          key={`${group.filePath}_${m.lineNumber ?? m.line}_${currentFlatIdx}`}
                          onClick={() => {
                            setSelectedMatchIndex(currentFlatIdx);
                          }}
                          onDoubleClick={() => handleJumpToMatch(m)}
                          className={`px-3 py-1.5 flex items-baseline gap-2.5 cursor-pointer text-xs font-mono transition-colors ${
                            isSelected
                              ? 'bg-sky-500/15 dark:bg-sky-500/25 text-theme-main border-l-2 border-sky-500 font-medium'
                              : 'hover:bg-theme-hover/70 text-theme-main'
                          }`}
                        >
                          {/* Line Number or File badge */}
                          <span className="text-[11px] text-theme-muted w-12 text-right shrink-0 select-none">
                            {m.isFileNameMatch ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-sans border border-amber-500/30 font-medium">
                                {t.globalSearch.fileBadge}
                              </span>
                            ) : (
                              `${m.lineNumber ?? m.line}:`
                            )}
                          </span>

                          {/* Line Content with Match Highlight */}
                          <div className="truncate flex-1 whitespace-pre leading-relaxed">
                            {renderHighlightedText(m.lineContent ?? m.text, query)}
                          </div>

                          {/* Jump Indicator on Selection */}
                          {isSelected && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleJumpToMatch(m);
                              }}
                              className="text-[10px] text-sky-700 dark:text-sky-300 hover:text-white dark:hover:text-white px-2 py-0.5 rounded bg-sky-500/15 dark:bg-sky-600/30 hover:bg-sky-600 dark:hover:bg-sky-500 border border-sky-500/30 transition flex items-center gap-1 shrink-0 font-medium cursor-pointer"
                              title={t.globalSearch.jumpTitle}
                            >
                              <span>{t.globalSearch.jumpAction}</span>
                              <CornerDownLeft className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right: Code Context Preview Pane */}
          <div className="w-[360px] bg-theme-sidebar/30 flex flex-col overflow-hidden text-xs">
            <div className="h-8 px-3 border-b border-theme-border flex items-center justify-between font-medium text-theme-muted text-[11px] shrink-0">
              <span>{t.globalSearch.previewTitle}</span>
              {selectedMatch && (
                <span className="font-mono text-sky-700 dark:text-sky-400 font-medium">
                  {selectedMatch.isFileNameMatch ? t.globalSearch.fileNameMatchTitle : `L:${selectedMatch.lineNumber ?? selectedMatch.line}`}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed select-text">
              {selectedMatch ? (
                <div className="flex flex-col gap-1">
                  <div className="text-theme-muted text-[10px] pb-2 border-b border-theme-border/50 truncate">
                    {selectedMatch.repoName} / {selectedMatch.relativePath || selectedMatch.file}
                  </div>
                  <div className="py-2 bg-sky-500/10 dark:bg-sky-500/20 -mx-3 px-3 border-l-2 border-sky-500 text-theme-main font-semibold whitespace-pre">
                    <span className="text-theme-muted mr-3 select-none font-normal">
                      {selectedMatch.isFileNameMatch ? t.globalSearch.fileBadgeUpper : (selectedMatch.lineNumber ?? selectedMatch.line)}
                    </span>
                    {renderHighlightedText(selectedMatch.lineContent ?? selectedMatch.text, query)}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-theme-muted italic text-center p-4">
                  {t.globalSearch.previewPlaceholder}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4. Footer Summary Bar */}
        <div className="h-8 px-3 border-t border-theme-border bg-theme-sidebar flex items-center justify-between text-[11px] text-theme-muted shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span>
              {t.globalSearch.matchesSummary(totalMatches, groupedResults.length)}
            </span>
            {totalMatches >= 300 && (
              <span className="text-amber-500 dark:text-amber-400/90 text-[10px] font-medium">
                {t.globalSearch.matchesTruncated(300)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[10px] text-theme-muted">
            <span>{t.globalSearch.shortcutNavigate}</span>
            <span>{t.globalSearch.shortcutJump}</span>
            <span>{t.globalSearch.shortcutClose}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
