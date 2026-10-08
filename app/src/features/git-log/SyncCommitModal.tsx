import React, { useState, useMemo } from 'react';
import { GitFork, GitBranch, ArrowRight, Loader2, X, Search, Check, AlertTriangle } from 'lucide-react';
import type { GitCommitItem } from '../../store/useAppStore';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../locales';

export interface SyncCommitModalProps {
  isOpen: boolean;
  commit: GitCommitItem | null;
  onClose: () => void;
  onConfirmSync: (options: { hashes: string[]; targetBranch: string; pushToRemote?: boolean }) => Promise<any>;
}

export const SyncCommitModal: React.FC<SyncCommitModalProps> = ({
  isOpen,
  commit,
  onClose,
  onConfirmSync,
}) => {
  const { t } = useTranslation();
  const { branches, projects, activeProjectId } = useAppStore();
  const currentProject = projects.find((p) => p.id === activeProjectId);
  const currentBranch = currentProject?.currentBranch || 'dev';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [pushToRemote, setPushToRemote] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Available branches excluding current branch
  const candidateBranches = useMemo(() => {
    if (!Array.isArray(branches)) return [];
    const list: string[] = [];
    branches.forEach((b) => {
      if (!b || !b.name) return;
      const clean = b.name.replace(/^origin\//, '');
      if (clean !== currentBranch && !list.includes(clean)) {
        list.push(clean);
      }
    });
    return list;
  }, [branches, currentBranch]);

  const filteredBranches = useMemo(() => {
    if (!searchTerm.trim()) return candidateBranches;
    return candidateBranches.filter((name) =>
      name.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );
  }, [candidateBranches, searchTerm]);

  // Set initial selected branch if candidate branches exist
  React.useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setIsLoading(false);
      setSearchTerm('');
      if (candidateBranches.length > 0) {
        // Prefer common target branches like test, uat, staging, master, main
        const preferred = candidateBranches.find((b) => ['test', 'uat', 'staging', 'release', 'master', 'main'].includes(b.toLowerCase()));
        setSelectedBranch(preferred || candidateBranches[0]);
      } else {
        setSelectedBranch('');
      }
    }
  }, [isOpen, candidateBranches]);

  if (!isOpen || !commit) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = selectedBranch.trim() || searchTerm.trim();
    if (!target) {
      setErrorMsg('请选择或输入要同步的目标分支');
      return;
    }
    if (target === currentBranch) {
      setErrorMsg('目标分支不能与当前所在分支相同');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await onConfirmSync({
        hashes: [commit.hash],
        targetBranch: target,
        pushToRemote,
      });

      if (res && res.success) {
        onClose();
      } else if (res && res.message) {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || '同步执行失败');
    } finally {
      setIsLoading(false);
    }
  };

  const effectiveTarget = selectedBranch || searchTerm.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-theme-panel border border-theme rounded-lg shadow-2xl overflow-hidden flex flex-col font-sans text-xs text-theme-main animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-theme bg-theme-header">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <GitFork className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-theme-main leading-tight">
                同步提交到其他分支
              </h2>
              <p className="text-[11px] text-theme-dim mt-0.5">
                将选中的修改内容抽取（Cherry-pick）并同步到其他环境分支
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-theme-dim hover:text-theme-main rounded transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Commit Summary */}
          <div className="p-3 rounded bg-theme-card border border-theme-border-card space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono text-sky-400 font-semibold">{commit.shortHash}</span>
              <span className="text-theme-dim">{commit.authorName}</span>
            </div>
            <p className="text-xs text-theme-main font-medium line-clamp-2 leading-relaxed">
              {commit.subject}
            </p>
          </div>

          {/* Source and Target Routing Visualization */}
          <div className="flex items-center justify-between px-3 py-2 rounded bg-sky-500/10 border border-sky-500/20 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-theme-dim">来源分支:</span>
              <span className="font-bold text-sky-400 truncate max-w-[140px]">{currentBranch}</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-theme-dim">同步目标:</span>
              <span className="font-bold text-emerald-400 truncate max-w-[140px]">
                {effectiveTarget || '未选择'}
              </span>
            </div>
          </div>

          {/* Target Branch Picker */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-theme-main">
              选择目标分支：
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-theme-dim absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (candidateBranches.includes(e.target.value.trim())) {
                    setSelectedBranch(e.target.value.trim());
                  }
                }}
                placeholder="搜索或输入目标分支（如 test, uat, master）..."
                className="w-full pl-8 pr-3 py-1.5 rounded bg-theme-input border border-theme-border-card text-xs text-theme-main focus:outline-none focus:border-sky-500"
                autoFocus
              />
            </div>

            <div className="max-h-36 overflow-y-auto border border-theme-border-card rounded bg-theme-panel p-1 space-y-0.5">
              {filteredBranches.length === 0 ? (
                <div className="py-3 text-center text-theme-dim text-[11px]">
                  未找到匹配分支，直接回车将尝试同步到 &apos;{searchTerm.trim()}&apos;
                </div>
              ) : (
                filteredBranches.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setSelectedBranch(name);
                      setSearchTerm(name);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded flex items-center justify-between text-left text-xs transition cursor-pointer ${
                      selectedBranch === name
                        ? 'bg-sky-500/20 text-sky-400 font-bold'
                        : 'hover:bg-theme-card text-theme-main'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <GitBranch className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="truncate">{name}</span>
                    </div>
                    {selectedBranch === name && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Push to remote checkbox */}
          <label className="flex items-center gap-2 text-xs text-theme-main cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pushToRemote}
              onChange={(e) => setPushToRemote(e.target.checked)}
              className="rounded border-theme text-sky-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
            />
            <span>同步成功后立即推送到远端 (git push origin &lt;目标分支&gt;)</span>
          </label>

          {/* Error Message banner */}
          {errorMsg && (
            <div className="p-2.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="flex-1 leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-theme">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-theme-card hover:bg-theme-card-hover border border-theme-border-card text-theme-main text-xs font-medium transition cursor-pointer"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isLoading || !effectiveTarget}
              className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>正在同步并推送...</span>
                </>
              ) : (
                <>
                  <GitFork className="w-3.5 h-3.5" />
                  <span>开始同步</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
