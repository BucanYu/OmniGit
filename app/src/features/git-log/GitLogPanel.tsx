import React, { useState, useEffect } from 'react';
import {
  GitCommit,
  Clock,
  User,
  GitBranch,
  Tag,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  FileCode,
  FileText,
  Database,
  FileDiff,
  Copy,
  Check,
  ExternalLink,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useAppStore, type GitCommitItem, type GitCommitFileChange } from '../../store/useAppStore';
import { useTranslation } from '../../locales';
import { LogFilterBar } from './LogFilterBar';
import { CommitContextMenu } from './CommitContextMenu';
import { ResetBranchModal } from './ResetBranchModal';
import { CreateBranchOrTagModal } from './CreateBranchOrTagModal';
import { VerticalResizeDivider } from '../../components/ui/VerticalResizeDivider';
import { ResizeDivider } from '../../components/ui/ResizeDivider';

// Generate consistent avatar color from author string
function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 45%)`;
}

// Format friendly relative time
function formatRelativeTime(dateStr: string, t: any): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return t.gitLog.relativeTime.justNow;
    if (diffSec < 3600) return t.gitLog.relativeTime.minutesAgo(Math.floor(diffSec / 60));
    if (diffSec < 86400) return t.gitLog.relativeTime.hoursAgo(Math.floor(diffSec / 3600));
    if (diffSec < 86400 * 30) return t.gitLog.relativeTime.daysAgo(Math.floor(diffSec / 86400));
    return d.toISOString().slice(0, 10);
  } catch {
    return dateStr;
  }
}

export function GitLogPanel() {
  const { t } = useTranslation();
  const {
    projects,
    activeProjectId,
    commitLogs,
    commitLogsLoading,
    commitLogsSkip,
    hasMoreCommits,
    fetchCommitLogs,
    loadRepoAuthors,
    selectedCommitHash,
    selectedCommitDetails,
    commitDetailsLoading,
    selectedHistoricalFilePath,
    selectCommit,
    selectHistoricalFileDiff,
    resetToCommit,
    revertCommit,
    checkoutRevision,
    createBranchAtCommit,
    createTagAtCommit,
    cherryPickCommit,
    setNotification,
    logInspectorHeight,
    setLogInspectorHeight,
    logInspectorDetailsWidth,
    setLogInspectorDetailsWidth,
  } = useAppStore();

  const currentProject = projects.find((p) => p.id === activeProjectId);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    commit: GitCommitItem;
    position: { x: number; y: number };
  } | null>(null);

  // Modals state
  const [resetModalCommit, setResetModalCommit] = useState<GitCommitItem | null>(null);
  const [branchOrTagModal, setBranchOrTagModal] = useState<{
    commit: GitCommitItem;
    mode: 'branch' | 'tag';
  } | null>(null);

  // Copy feedback
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Fetch initial logs and commit authors
  useEffect(() => {
    if (currentProject) {
      loadRepoAuthors(currentProject.path);
      if (commitLogs.length === 0 && !commitLogsLoading) {
        fetchCommitLogs(true);
      }
    }
  }, [currentProject?.path]);

  const handleRowClick = (commit: GitCommitItem) => {
    selectCommit(commit.hash);
  };

  const handleRowContextMenu = (e: React.MouseEvent, commit: GitCommitItem) => {
    e.preventDefault();
    e.stopPropagation();
    selectCommit(commit.hash);
    setContextMenu({
      commit,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleMenuButtonClick = (e: React.MouseEvent, commit: GitCommitItem) => {
    e.stopPropagation();
    selectCommit(commit.hash);
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({
      commit,
      position: { x: rect.left, y: rect.bottom + 4 },
    });
  };

  const handleCopyHash = (commit: GitCommitItem) => {
    navigator.clipboard.writeText(commit.hash);
    setCopiedHash(commit.hash);
    setTimeout(() => setCopiedHash(null), 1800);
    setNotification({
      id: Date.now(),
      title: t.gitLog.panel.copyHashSuccess,
      detail: commit.hash,
      type: 'info',
    });
  };

  const handleCopyMessage = (commit: GitCommitItem) => {
    navigator.clipboard.writeText(commit.message);
    setNotification({
      id: Date.now(),
      title: t.gitLog.panel.copyMessageSuccess,
      detail: commit.message,
      type: 'info',
    });
  };

  const renderFileIcon = (fileName: string) => {
    if (fileName.endsWith('.sql')) return <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    if (fileName.endsWith('.md')) return <FileText className="w-3.5 h-3.5 text-sky-300 shrink-0" />;
    return <FileCode className="w-3.5 h-3.5 text-indigo-300 shrink-0" />;
  };

  const renderStatusBadge = (file: GitCommitFileChange) => {
    const code = file.statusCode;
    if (code === 'A') {
      return (
        <span className="text-[10px] font-mono px-1 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          A
        </span>
      );
    }
    if (code === 'D') {
      return (
        <span className="text-[10px] font-mono px-1 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
          D
        </span>
      );
    }
    if (code === 'R') {
      return (
        <span className="text-[10px] font-mono px-1 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30">
          R
        </span>
      );
    }
    return (
      <span className="text-[10px] font-mono px-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
        M
      </span>
    );
  };

  const renderRefBadges = (refs: string) => {
    if (!refs) return null;
    const parts = refs.split(',').map((s) => s.trim()).filter(Boolean);
    return (
      <div className="flex items-center gap-1 flex-wrap shrink-0">
        {parts.map((r, idx) => {
          const isHead = r.includes('HEAD');
          const isTag = r.startsWith('tag:');
          const isRemote = r.startsWith('origin/');
          let colorClass = 'bg-sky-500/15 text-sky-400 border-sky-500/30';
          if (isHead) {
            colorClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold';
          } else if (isTag) {
            colorClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
          } else if (isRemote) {
            colorClass = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
          }

          return (
            <span
              key={idx}
              className={`text-[10px] px-1.5 py-0.2 rounded border font-mono truncate max-w-[140px] ${colorClass}`}
              title={r}
            >
              {isTag ? `🏷️ ${r.replace('tag:', '').trim()}` : `🌿 ${r}`}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-theme-panel select-none overflow-hidden">
      {/* 1. Filter Bar */}
      <LogFilterBar />

      {/* 2. Middle: Commit History List */}
      <div className="flex-1 overflow-y-auto min-h-[220px] flex flex-col divide-y divide-theme/60">
        {!Array.isArray(commitLogs) || commitLogs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-theme-dim">
            <GitCommit className="w-8 h-8 mb-2 opacity-40 stroke-[1.5]" />
            <p className="text-xs font-medium text-theme-muted">
              {commitLogsLoading ? t.gitLog.panel.loadingLogs : t.gitLog.panel.noLogsFound}
            </p>
            <p className="text-[11px] text-theme-dim mt-1">
              {t.gitLog.panel.noLogsHint}
            </p>
          </div>
        ) : (
          commitLogs.map((commit) => {
            const isSelected = commit.hash === selectedCommitHash;
            const authorInitial = (commit.authorName || 'U').charAt(0).toUpperCase();
            const avatarBg = getAvatarColor(commit.authorName);

            return (
              <div
                key={commit.hash}
                onClick={() => handleRowClick(commit)}
                onContextMenu={(e) => handleRowContextMenu(e, commit)}
                className={`flex items-start gap-2 px-3 py-2 text-xs transition-colors cursor-pointer group ${
                  isSelected
                    ? 'bg-theme-active text-theme-active'
                    : 'hover:bg-theme-card text-theme-main'
                }`}
              >
                {/* Author Avatar */}
                <div
                  className="w-5 h-5 rounded-full text-white font-semibold text-[10px] flex items-center justify-center shrink-0 mt-0.5 shadow-xs"
                  style={{ backgroundColor: avatarBg }}
                  title={`${commit.authorName} <${commit.authorEmail}>`}
                >
                  {authorInitial}
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  {/* Top line: Refs badges + Subject */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {renderRefBadges(commit.refs)}
                    <span
                      className={`font-medium text-xs truncate leading-snug ${
                        isSelected ? 'text-white' : 'text-theme-main'
                      }`}
                      title={commit.message}
                    >
                      {commit.message}
                    </span>
                  </div>

                  {/* Bottom line: Author + Time */}
                  <div className="flex items-center gap-2 text-[11px] text-theme-dim">
                    <span className="truncate max-w-[120px]" title={commit.authorName}>{commit.authorName}</span>
                    <span>•</span>
                    <span title={commit.date}>{formatRelativeTime(commit.date, t)}</span>
                  </div>
                </div>

                {/* Right: Hash pill button + Menu trigger */}
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyHash(commit);
                    }}
                    title={t.gitLog.panel.copyHashTooltip(commit.hash)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[11px] bg-theme-panel/70 border border-theme text-theme-dim hover:text-sky-400 hover:border-sky-500/40 transition-colors cursor-pointer"
                  >
                    {copiedHash === commit.hash ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <span>{commit.shortHash}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleMenuButtonClick(e, commit)}
                    title={t.gitLog.panel.commitActionsTooltip}
                    className="p-1 rounded text-theme-dim hover:text-theme-main hover:bg-theme-card transition-colors cursor-pointer"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Load More Button */}
        {hasMoreCommits && commitLogs.length > 0 && (
          <div className="p-2 flex justify-center bg-theme-panel">
            <button
              type="button"
              onClick={() => fetchCommitLogs(false)}
              disabled={commitLogsLoading}
              className="px-4 py-1.5 rounded-md text-xs font-medium text-theme-muted hover:text-theme-main hover:bg-theme-card border border-theme transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {commitLogsLoading ? t.gitLog.panel.loadingMore : t.gitLog.panel.loadMore}
            </button>
          </div>
        )}
      </div>

      {/* 3. Lower Section: Commit Inspector & Changed Files */}
      {selectedCommitDetails && (
        <>
          <VerticalResizeDivider
            currentHeight={logInspectorHeight}
            minHeight={120}
            maxHeight={600}
            onResize={setLogInspectorHeight}
            onDoubleClickReset={() => setLogInspectorHeight(260)}
            title={t.gitLog.panel.dragResizeDetails}
            direction="up-expands"
          />
          <div
            style={{ height: `${logInspectorHeight}px` }}
            className="border-t-2 border-theme bg-theme-subbar flex flex-col select-none overflow-hidden shrink-0"
          >
          {/* Inspector Header: metadata */}
          <div className="px-3 py-2 border-b border-theme bg-theme-header flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-xs font-semibold text-sky-400 px-1.5 py-0.5 rounded bg-sky-400/10 border border-sky-400/20">
                {selectedCommitDetails.shortHash}
              </span>
              <span className="text-xs font-semibold text-theme-main truncate" title={selectedCommitDetails.subject}>
                {selectedCommitDetails.subject}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-theme-dim shrink-0">
              <span>{selectedCommitDetails.authorName}</span>
              <span>•</span>
              <span title={selectedCommitDetails.authorDate}>
                {formatRelativeTime(selectedCommitDetails.authorDate, t)}
              </span>
            </div>
          </div>

          {/* Body & Changed Files Split */}
          <div className="flex-1 flex min-h-0 relative overflow-hidden">
            {/* Left: Commit description & Parent Hash */}
            <div
              style={{
                width: `${logInspectorDetailsWidth}px`,
                minWidth: `${logInspectorDetailsWidth}px`,
                maxWidth: `${logInspectorDetailsWidth}px`,
              }}
              className="p-2.5 overflow-y-auto text-xs flex flex-col gap-2 shrink-0 bg-theme-subbar"
            >
              <div>
                <div className="text-[10px] font-semibold text-theme-dim uppercase tracking-wider mb-0.5">
                  {t.gitLog.panel.fullSha}
                </div>
                <div
                  onClick={() => handleCopyHash({ hash: selectedCommitDetails.hash } as any)}
                  className="font-mono text-[10px] text-theme-dim hover:text-sky-400 transition-colors break-all cursor-pointer flex items-center gap-1"
                  title={t.gitLog.panel.clickToCopy}
                >
                  <span>{selectedCommitDetails.hash}</span>
                  <Copy className="w-3 h-3 shrink-0 opacity-70" />
                </div>
              </div>

              {selectedCommitDetails.body && (
                <div>
                  <div className="text-[10px] font-semibold text-theme-dim uppercase tracking-wider mb-0.5">
                    {t.gitLog.panel.commitSubjectLabel}
                  </div>
                  <pre className="font-sans text-[11px] text-theme-muted whitespace-pre-wrap leading-relaxed">
                    {selectedCommitDetails.body}
                  </pre>
                </div>
              )}

              {selectedCommitDetails.parents.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-theme-dim uppercase tracking-wider mb-0.5">
                    {t.gitLog.panel.parentCommitLabel}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap font-mono text-[10px] text-theme-dim">
                    {selectedCommitDetails.parents.map((p) => (
                      <span
                        key={p}
                        onClick={() => selectCommit(p)}
                        className="px-1 py-0.2 rounded bg-theme-panel border border-theme hover:text-sky-400 cursor-pointer"
                      >
                        {p.slice(0, 7)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Horizontal Resize Divider between Commit Details and Changed Files List */}
            <ResizeDivider
              currentWidth={logInspectorDetailsWidth}
              minWidth={140}
              maxWidth={560}
              onResize={setLogInspectorDetailsWidth}
              onDoubleClickReset={() => setLogInspectorDetailsWidth(240)}
              title={t.gitLog.panel.dragResizeFiles}
            />

            {/* Right: Changed Files List */}
            <div className="flex-1 flex flex-col min-h-0 bg-theme-panel min-w-0">
              <div className="px-3 py-1.5 border-b border-theme/60 bg-theme-card/30 flex items-center justify-between text-[11px] text-theme-dim">
                <span>{t.gitLog.panel.changedFilesList(selectedCommitDetails.files.length)}</span>
                <span className="text-[10px] text-sky-400">{t.gitLog.panel.viewHistoricalDiff}</span>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-theme/40">
                {selectedCommitDetails.files.map((file) => {
                  const isFileActive = selectedHistoricalFilePath === file.path;
                  const fileName = file.path.split('/').pop() || file.path;

                  return (
                    <div
                      key={file.path}
                      onClick={() =>
                        selectHistoricalFileDiff(selectedCommitDetails.hash, file.path)
                      }
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs transition-colors cursor-pointer group ${
                        isFileActive
                          ? 'bg-sky-500/15 text-sky-400 font-medium'
                          : 'hover:bg-theme-card text-theme-main'
                      }`}
                    >
                      {renderStatusBadge(file)}
                      {renderFileIcon(fileName)}
                      <span className="truncate flex-1 font-mono text-[11px]" title={file.path}>
                        {file.path}
                      </span>
                      {isFileActive && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-400 font-sans shrink-0">
                          {t.gitLog.panel.comparingDiff}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      {/* 4. Context Menu */}
      {contextMenu && (
        <CommitContextMenu
          commit={contextMenu.commit}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onReset={(commit) => setResetModalCommit(commit)}
          onRevert={async (commit) => {
            await revertCommit(commit.hash);
          }}
          onCheckout={async (commit) => {
            await checkoutRevision(commit.hash);
          }}
          onNewBranch={(commit) => setBranchOrTagModal({ commit, mode: 'branch' })}
          onNewTag={(commit) => setBranchOrTagModal({ commit, mode: 'tag' })}
          onCherryPick={async (commit) => {
            await cherryPickCommit(commit.hash);
          }}
          onCopyHash={handleCopyHash}
          onCopyMessage={handleCopyMessage}
        />
      )}

      {/* 5. Reset Branch Modal */}
      {resetModalCommit && currentProject && (
        <ResetBranchModal
          isOpen={Boolean(resetModalCommit)}
          commit={resetModalCommit}
          currentBranch={currentProject.currentBranch}
          onClose={() => setResetModalCommit(null)}
          onConfirmReset={async (mode) => {
            await resetToCommit(resetModalCommit.hash, mode);
          }}
        />
      )}

      {/* 6. Create Branch or Tag Modal */}
      {branchOrTagModal && (
        <CreateBranchOrTagModal
          isOpen={Boolean(branchOrTagModal)}
          commit={branchOrTagModal.commit}
          mode={branchOrTagModal.mode}
          onClose={() => setBranchOrTagModal(null)}
          onCreateBranch={async (branchName) => {
            await createBranchAtCommit(branchName, branchOrTagModal.commit.hash);
          }}
          onCreateTag={async (tagName, message) => {
            await createTagAtCommit(tagName, branchOrTagModal.commit.hash, message);
          }}
        />
      )}
    </div>
  );
}
