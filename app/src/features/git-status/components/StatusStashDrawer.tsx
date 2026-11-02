import React, { useState, useEffect, useCallback } from 'react';
import { Archive, ArchiveRestore, Play, Trash2, RefreshCw, GitBranch } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import type { GitStashItem } from '../../../store/types';
import { useTranslation } from '../../../locales';

interface StatusStashDrawerProps {
  repoPath: string;
}

export const StatusStashDrawer: React.FC<StatusStashDrawerProps> = ({ repoPath }) => {
  const { t } = useTranslation();
  const loadRepoData = useAppStore((state) => state.loadRepoData);
  const setNotification = useAppStore((state) => state.setNotification);
  const filesCount = useAppStore((state) => state.files.length);

  const [stashes, setStashes] = useState<GitStashItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [operatingIndex, setOperatingIndex] = useState<number | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [stashMessage, setStashMessage] = useState('');
  const [includeUntracked, setIncludeUntracked] = useState(true);

  const fetchStashes = useCallback(async () => {
    if (!repoPath) {
      setStashes([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/git/stash-list?path=${encodeURIComponent(repoPath)}`);
      if (res.ok) {
        const data = await res.json();
        setStashes(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => {
    fetchStashes();
  }, [fetchStashes]);

  const handleStashPush = async () => {
    if (!repoPath || isPushing) return;
    setIsPushing(true);
    try {
      const res = await fetch('/api/git/stash-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: repoPath,
          message: stashMessage.trim(),
          includeUntracked,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStashMessage('');
        await Promise.all([fetchStashes(), loadRepoData(repoPath, true)]);
        setNotification({
          id: Date.now(),
          title: t.statusPanel.stash.stashSuccessToast,
          detail: data.message,
          type: 'success',
        });
      } else {
        setNotification({
          id: Date.now(),
          title: t.common.warning,
          detail: data.message,
          type: 'warning',
        });
      }
    } catch (err: any) {
      setNotification({
        id: Date.now(),
        title: t.common.error,
        detail: err.message,
        type: 'warning',
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handleStashAction = async (action: 'apply' | 'pop' | 'drop', index: number) => {
    if (!repoPath || operatingIndex !== null) return;
    setOperatingIndex(index);
    try {
      const endpoint =
        action === 'apply'
          ? '/api/git/stash-apply'
          : action === 'pop'
          ? '/api/git/stash-pop'
          : '/api/git/stash-drop';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: repoPath, index }),
      });
      const data = await res.json();
      await Promise.all([fetchStashes(), loadRepoData(repoPath, true)]);

      if (data.isConflict) {
        setNotification({
          id: Date.now(),
          title: t.statusPanel.stash.stashConflictToast,
          detail: data.message,
          type: 'warning',
        });
      } else if (data.success) {
        const toastTitle =
          action === 'apply'
            ? t.statusPanel.stash.applySuccessToast
            : action === 'pop'
            ? t.statusPanel.stash.popSuccessToast
            : t.statusPanel.stash.dropSuccessToast;
        setNotification({
          id: Date.now(),
          title: toastTitle,
          detail: data.message,
          type: 'success',
        });
      } else {
        setNotification({
          id: Date.now(),
          title: t.common.warning,
          detail: data.message,
          type: 'warning',
        });
      }
    } catch (err: any) {
      setNotification({
        id: Date.now(),
        title: t.common.error,
        detail: err.message,
        type: 'warning',
      });
    } finally {
      setOperatingIndex(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-theme-panel text-xs select-none">
      {/* Top Stash Creation Box */}
      <div className="p-2.5 border-b border-theme-border bg-theme-subbar/60 flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={stashMessage}
            onChange={(e) => setStashMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleStashPush();
            }}
            placeholder={t.statusPanel.stash.stashMessagePlaceholder}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded bg-theme-input border border-theme-border text-theme-main text-xs focus:outline-none focus:border-sky-500"
          />
          <button
            type="button"
            onClick={fetchStashes}
            className="p-1.5 rounded hover:bg-theme-hover text-theme-muted hover:text-theme-main transition cursor-pointer"
            title={t.statusPanel.toolbar.refresh}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-theme-muted cursor-pointer">
            <input
              type="checkbox"
              checked={includeUntracked}
              onChange={(e) => setIncludeUntracked(e.target.checked)}
              className="rounded border-theme-border accent-sky-500 cursor-pointer"
            />
            <span>{t.statusPanel.stash.includeUntracked}</span>
          </label>

          <button
            type="button"
            onClick={handleStashPush}
            disabled={isPushing || filesCount === 0}
            className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-[11px] flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <Archive className="w-3 h-3" />
            <span>{isPushing ? t.statusPanel.stash.stashingBtn : t.statusPanel.stash.stashPushBtn}</span>
          </button>
        </div>
      </div>

      {/* Stashes List */}
      <div className="flex-1 overflow-y-auto divide-y divide-theme-border/50">
        {stashes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-theme-dim">
            <Archive className="w-8 h-8 mb-2 opacity-40 stroke-[1.5]" />
            <p className="text-xs font-medium text-theme-muted">{t.statusPanel.stash.emptyTitle}</p>
            <p className="text-[11px] text-theme-dim mt-1 max-w-[220px] leading-relaxed">
              {t.statusPanel.stash.emptyDesc}
            </p>
          </div>
        ) : (
          stashes.map((item) => {
            const isBusy = operatingIndex === item.index;
            return (
              <div
                key={item.stashRef}
                className="p-2.5 hover:bg-theme-hover/70 transition flex flex-col gap-1.5 group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono text-[10px] shrink-0">
                      {item.stashRef}
                    </span>
                    {item.branch && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 font-mono text-[10px] truncate max-w-[110px]">
                        <GitBranch className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{item.branch}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-theme-dim shrink-0">
                    {item.date ? item.date.slice(0, 16) : item.hash.slice(0, 7)}
                  </span>
                </div>

                <div className="text-xs text-theme-main font-medium break-all leading-snug">
                  {item.message}
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-0.5">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleStashAction('apply', item.index)}
                    title={t.statusPanel.stash.applyTooltip}
                    className="px-2 py-0.5 rounded bg-theme-card hover:bg-sky-500/20 text-theme-main hover:text-sky-400 border border-theme-border text-[11px] flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
                  >
                    <Play className="w-2.5 h-2.5" />
                    <span>{t.statusPanel.stash.applyBtn}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleStashAction('pop', item.index)}
                    title={t.statusPanel.stash.popTooltip}
                    className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-[11px] flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
                  >
                    <ArchiveRestore className="w-2.5 h-2.5" />
                    <span>{t.statusPanel.stash.popBtn}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleStashAction('drop', item.index)}
                    title={t.statusPanel.stash.dropTooltip}
                    className="px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-[11px] flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                    <span>{t.statusPanel.stash.dropBtn}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
