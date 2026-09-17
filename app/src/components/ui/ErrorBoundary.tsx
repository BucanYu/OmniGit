import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { zhCN } from '../../locales/zh-CN';
import { enUS } from '../../locales/en-US';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[OmniGit ErrorBoundary caught]', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearAndReload = () => {
    try {
      // 核心资产绝对白名单：严禁删除任何工作空间、关联仓库路径、全局最近打开记录和用户偏好！
      // 仅允许清理易失性视图快照 (omnigit_snap_*) 与提交草稿 (omnigit_commit_draft_*)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('omnigit_snap_') ||
            key.startsWith('omnigit_commit_draft_') ||
            key.startsWith('omnigit_fav_branches_'))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const lang = (typeof window !== 'undefined' && localStorage.getItem('omnigit_language')) || 'zh-CN';
      const t = lang === 'en-US' ? enUS : zhCN;

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#1e1f22] text-[#bcbec4] font-sans p-6 select-none">
          <div className="max-w-xl w-full bg-[#2b2d30] border border-[#393b40] rounded-xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b border-[#393b40] pb-4">
              <div className="w-10 h-10 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">{t.common.errorBoundary.title}</h2>
                <p className="text-xs text-[#868a91] mt-0.5">
                  {t.common.errorBoundary.desc}
                </p>
              </div>
            </div>

            <div className="bg-[#1e1f22] border border-[#393b40] rounded p-3 text-xs font-mono text-rose-300 overflow-x-auto max-h-48">
              <div className="font-bold mb-1">
                {this.state.error?.name}: {this.state.error?.message}
              </div>
              {this.state.errorInfo?.componentStack && (
                <div className="text-[11px] text-[#868a91] whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex flex-col gap-1">
                <button
                  onClick={this.handleClearAndReload}
                  className="px-3 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 w-fit"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t.common.errorBoundary.clearCacheRetry}</span>
                </button>
                <span className="text-[11px] text-[#868a91]">
                  {lang === 'en-US'
                    ? 'Clears view snapshot cache only; preserves all workspaces and projects'
                    : '仅清理视图快照缓存，绝对保留所有工作空间与历史工程'}
                </span>
              </div>

              <button
                onClick={this.handleReload}
                className="px-4 py-1.5 rounded bg-[#3574f0] hover:bg-[#3069db] text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-sm self-start mt-0.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t.common.errorBoundary.reload}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
