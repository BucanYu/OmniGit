import React, { useState, useRef, useEffect } from 'react';
import {
  Clock,
  ChevronDown,
  ChevronRight,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import { useTranslation } from '../../../locales';
import type { GitFileItem } from '../../../store/useAppStore';

interface LastCommitDetailsType {
  hash: string;
  subject: string;
  body?: string;
  files?: Array<{ path: string; statusCode?: string }>;
}

interface StatusCommitBoxProps {
  commitBoxHeight: number;
  isAmend: boolean;
  setIsAmend: (val: boolean) => void;
  lastCommitDetails: LastCommitDetailsType | null;
  commitHistory: string[];
  commitMessage: string;
  setCommitMessage: (msg: string) => void;
  addedCount: number;
  modifiedCount: number;
  conflictFiles: GitFileItem[];
  totalChecked: GitFileItem[];
  isMerging: boolean;
  onCommit: (push: boolean) => void;
}

export const StatusCommitBox: React.FC<StatusCommitBoxProps> = ({
  commitBoxHeight,
  isAmend,
  setIsAmend,
  lastCommitDetails,
  commitHistory,
  commitMessage,
  setCommitMessage,
  addedCount,
  modifiedCount,
  conflictFiles,
  totalChecked,
  isMerging,
  onCommit,
}) => {
  const { t } = useTranslation();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAmendDropdownOpen, setIsAmendDropdownOpen] = useState(false);

  const historyRef = useRef<HTMLDivElement>(null);
  const amendDropdownRef = useRef<HTMLDivElement>(null);
  const historyPopupRef = useRef<HTMLDivElement>(null);

  // Close history popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        historyRef.current &&
        !historyRef.current.contains(event.target as Node) &&
        historyPopupRef.current &&
        !historyPopupRef.current.contains(event.target as Node)
      ) {
        setIsHistoryOpen(false);
      }
      if (
        amendDropdownRef.current &&
        !amendDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAmendDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      style={{ height: `${commitBoxHeight}px` }}
      className="border-t border-theme-border bg-theme-panel/70 p-3 flex flex-col gap-2 shrink-0 relative select-none"
    >
      {/* Top Control Line: Amend last commit, History clock, and Statistics */}
      <div className="flex items-center justify-between text-[11px] select-none shrink-0">
        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-1.5 cursor-pointer text-theme-muted hover:text-theme-main">
            <input
              type="checkbox"
              checked={isAmend}
              onChange={(e) => setIsAmend(e.target.checked)}
              className="rounded border-theme-border-card bg-theme-card text-blue-500 focus:ring-0 cursor-pointer"
            />
            <span>{t.statusPanel.commitBox.amend}</span>
          </label>

          {isAmend ? (
            <div className="relative" ref={amendDropdownRef}>
              <button
                onClick={() => setIsAmendDropdownOpen(!isAmendDropdownOpen)}
                className="flex items-center gap-0.5 text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                title={t.statusPanel.expandLastCommitTooltip}
              >
                <span>{t.statusPanel.lastCommitLabel}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {isAmendDropdownOpen && (
                <div className="absolute left-0 bottom-6 z-50 w-80 theme-dropdown-panel rounded-lg shadow-2xl py-1 text-xs text-theme-main">
                  <div
                    onClick={() => {
                      if (lastCommitDetails) {
                        const fullMsg = lastCommitDetails.body
                          ? `${lastCommitDetails.subject}\n\n${lastCommitDetails.body}`
                          : lastCommitDetails.subject;
                        setCommitMessage(fullMsg);
                      }
                      setIsAmendDropdownOpen(false);
                    }}
                    className="px-3 py-1.5 hover:bg-blue-500/15 hover:text-blue-400 cursor-pointer flex items-center gap-1.5 text-xs text-theme-main truncate"
                  >
                    <span className="text-blue-400 font-bold">✓</span>
                    <span className="font-semibold text-theme-dim shrink-0">{t.statusPanel.lastCommitLabel}</span>
                    <span className="truncate text-theme-muted" title={lastCommitDetails?.subject}>
                      {lastCommitDetails?.subject || t.statusPanel.lastCommitTitle}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span className="text-theme-muted">{t.statusPanel.lastCommitLabel}</span>
          )}

          {/* Commit Message History Clock Button */}
          <div className="relative" ref={historyRef}>
            <button
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              className={`p-1 rounded transition cursor-pointer ml-0.5 ${
                isHistoryOpen
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-theme-dim hover:text-theme-main hover:bg-theme-hover'
              }`}
              title={t.statusPanel.commitHistoryTooltip}
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Statistics summary */}
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          {addedCount > 0 && (
            <span className="text-emerald-400 font-medium">{t.statusPanel.statsAdded(addedCount)}</span>
          )}
          {modifiedCount > 0 && (
            <span className="text-sky-400 font-medium">{t.statusPanel.statsModified(modifiedCount)}</span>
          )}
        </div>
      </div>

      {/* Floating Commit Message History Popup */}
      {isHistoryOpen && (
        <div
          ref={historyPopupRef}
          className="absolute left-2.5 right-2.5 bottom-[calc(100%-8px)] z-50 theme-dropdown-panel rounded-md shadow-2xl overflow-hidden flex flex-col text-xs text-theme-main max-h-56"
        >
          <div className="flex-1 overflow-y-auto divide-y divide-theme-border/30">
            {commitHistory.length === 0 ? (
              <div className="px-3 py-2 text-theme-dim text-[11px]">{t.statusPanel.noHistoryYet}</div>
            ) : (
              commitHistory.map((msg, idx) => {
                const isSelected = commitMessage.trim() === msg.trim();
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setCommitMessage(msg);
                      setIsHistoryOpen(false);
                    }}
                    className={`px-3 py-1.5 cursor-pointer truncate text-[11.5px] transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white font-medium'
                        : 'hover:bg-blue-500/15 hover:text-blue-500 text-theme-main'
                    }`}
                    title={msg}
                  >
                    {msg}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Textarea */}
      <textarea
        value={commitMessage}
        onChange={(e) => setCommitMessage(e.target.value)}
        placeholder={t.statusPanel.commitBox.placeholder}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            onCommit(false);
          }
        }}
        className="w-full flex-1 min-h-[48px] bg-theme-input border border-theme-border-card rounded-xl p-2.5 text-xs text-theme-main placeholder-theme-dim focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none font-sans shadow-2xs transition-all"
      />

      {/* Action Buttons: [ Commit / Amend Commit / Commit Merge ] */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 pt-0.5 shrink-0 overflow-hidden">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
          {conflictFiles.length > 0 ? (
            <button
              disabled
              className="px-3 py-1.5 bg-rose-600/20 text-rose-300 border border-rose-500/40 cursor-not-allowed rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5"
              title={t.statusPanel.cannotCommitConflicts(conflictFiles.length)}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>{t.statusPanel.groups.conflicts} ({conflictFiles.length})</span>
            </button>
          ) : (
            <>
              {/* Primary Commit Button */}
              <button
                disabled={!(commitMessage || '').trim() || (totalChecked.length === 0 && !isMerging)}
                onClick={() => onCommit(false)}
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-blue-500/25 cursor-pointer shrink-0 whitespace-nowrap border border-blue-400/30"
                title={isAmend ? t.statusPanel.amendCommitTitle : t.statusPanel.commitBox.commitBtn}
              >
                {isAmend ? (t.statusPanel.commitBox.amendBtn || t.statusPanel.commitBox.amend) : t.statusPanel.commitBox.commitBtn}
              </button>

              {/* Secondary Commit and Push Button */}
              <button
                disabled={!(commitMessage || '').trim() || (totalChecked.length === 0 && !isMerging)}
                onClick={() => onCommit(true)}
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-theme-card hover:bg-theme-card-hover active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-theme-main border border-theme-border-card rounded-xl text-xs font-medium flex items-center justify-center gap-1 transition-all shadow-2xs cursor-pointer shrink-0 whitespace-nowrap"
                title={t.statusPanel.commitBox.commitAndPushBtn}
              >
                <span className="whitespace-nowrap font-medium">
                  {t.statusPanel.commitBox.commitAndPushBtn}
                </span>
              </button>
            </>
          )}
        </div>

        <button className="p-1.5 text-theme-dim hover:text-theme-main hover:bg-theme-hover rounded-lg transition cursor-pointer shrink-0">
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
