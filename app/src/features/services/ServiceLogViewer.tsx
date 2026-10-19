import React, { useRef, useEffect, useState } from 'react';
import type { ServiceConfig } from './types';
import { useServicesStore } from './useServicesStore';
import { useTranslation } from '../../locales';
import {
  Play,
  Square,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  ArrowDown,
  Clock,
  Terminal,
  Folder,
  Loader2,
} from 'lucide-react';

interface ServiceLogViewerProps {
  service: ServiceConfig | null;
  projectId: string;
}

// Convert standard ANSI color escape sequences to safe styled HTML spans
function parseAnsiToHtml(text: string): string {
  if (!text) return '';
  // 1. Strip OSC sequences e.g. \x1b]0;Title\x07 or \x1b]0;Title\x1b\
  let cleanText = text
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g, '')
    .replace(/\x07/g, '')
    .replace(/\x1b\[\??[0-9;]*[A-LN-Za-ln-z]/g, '');

  // 2. Replace HTML entities first
  let html = cleanText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 3. Remove bare carriage returns
  html = html.replace(/\r(?!\n)/g, '');

  const ansiColors: Record<number, string> = {
    30: 'color:#71717a;', // Black/Zinc
    31: 'color:#f87171;', // Red
    32: 'color:#4ade80;', // Green
    33: 'color:#facc15;', // Yellow
    34: 'color:#60a5fa;', // Blue
    35: 'color:#c084fc;', // Magenta
    36: 'color:#38bdf8;', // Cyan
    37: 'color:#f4f4f5;', // White
    90: 'color:#a1a1aa;', // Bright Black / Gray
    91: 'color:#ef4444;', // Bright Red
    92: 'color:#22c55e;', // Bright Green
    93: 'color:#eab308;', // Bright Yellow
    94: 'color:#3b82f6;', // Bright Blue
    95: 'color:#a855f7;', // Bright Magenta
    96: 'color:#06b6d4;', // Bright Cyan
    97: 'color:#ffffff;', // Bright White
  };

  // Replace ANSI sequence \x1b[...m
  html = html.replace(/\x1b\[([0-9;]+)m/g, (_match, codesStr) => {
    const codes = codesStr.split(';').map(Number);
    if (codes.includes(0)) {
      return '</span>';
    }
    let styles = '';
    for (const code of codes) {
      if (ansiColors[code]) {
        styles += ansiColors[code];
      } else if (code === 1) {
        styles += 'font-weight:bold;';
      } else if (code === 4) {
        styles += 'text-decoration:underline;';
      }
    }
    return styles ? `<span style="${styles}">` : '';
  });

  return html;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSec = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSec}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return `${hours}h ${remainingMin}m`;
}

export const ServiceLogViewer: React.FC<ServiceLogViewerProps> = ({
  service,
  projectId,
}) => {
  const { t } = useTranslation();
  const {
    getRuntime,
    startService,
    stopService,
    restartService,
    clearLogs,
    autoScrollByService,
    setAutoScroll,
    toggleAutoScroll,
  } = useServicesStore();

  const logContainerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copied, setCopied] = useState(false);

  const runtime = service ? getRuntime(service.id) : null;
  const isRunning = runtime?.status === 'running';
  const isStarting = runtime?.status === 'starting';
  const isStopping = runtime?.status === 'stopping';
  const isBusy = isRunning || isStarting || isStopping;
  const isAutoScroll = service ? autoScrollByService[service.id] !== false : true;

  // Uptime ticker
  const [uptimeText, setUptimeText] = useState('');
  useEffect(() => {
    if (!isRunning || !runtime?.startedAt) {
      setUptimeText('');
      return;
    }
    const update = () => {
      setUptimeText(formatUptime(Date.now() - (runtime.startedAt || 0)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isRunning, runtime?.startedAt]);

  const scrollToBottom = (smooth = false) => {
    const container = logContainerRef.current;
    if (!container) return;
    isProgrammaticScrollRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    if (smooth) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    } else {
      container.scrollTop = container.scrollHeight;
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 120);
  };

  // Auto-scroll effect whenever logs update or isAutoScroll is toggled on
  useEffect(() => {
    if (isAutoScroll && logContainerRef.current) {
      scrollToBottom();
    }
  }, [runtime?.logs, isAutoScroll]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Detect user manual scroll to pause/resume auto-scroll
  const handleScroll = () => {
    if (isProgrammaticScrollRef.current) return;
    const container = logContainerRef.current;
    if (!container || !service) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom > 80) {
      // User explicitly scrolled up away from bottom -> pause auto-scroll
      if (isAutoScroll) {
        setAutoScroll(service.id, false);
      }
    } else if (distanceFromBottom <= 30) {
      // User scrolled back down to the very bottom -> re-enable auto-scroll
      if (!isAutoScroll) {
        setAutoScroll(service.id, true);
      }
    }
  };

  const handleCopyLogs = () => {
    if (!runtime || runtime.logs.length === 0) return;
    const plainText = runtime.logs
      .join('\n')
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g, '')
      .replace(/\x07/g, '')
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    navigator.clipboard.writeText(plainText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isWindows =
    typeof window !== 'undefined' &&
    ((window as any).electronAPI?.platform === 'win32' ||
      navigator.platform?.toLowerCase().includes('win'));

  const activeCommand = service
    ? (isWindows ? service.winCommand : service.unixCommand) || ''
    : '';

  if (!service || !runtime) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-theme-app text-theme-muted p-8 select-none">
        <div className="w-16 h-16 rounded-2xl bg-theme-sidebar border border-theme-border flex items-center justify-center mb-4 text-theme-muted/50">
          <Terminal className="w-8 h-8" />
        </div>
        <h3 className="text-sm font-semibold text-theme-main mb-1">
          {t.services.noServiceSelected}
        </h3>
        <p className="text-xs text-theme-muted/80 max-w-sm text-center">
          {t.services.selectServicePrompt}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-theme-app overflow-hidden">
      {/* Console Top Header */}
      <div className="px-4 py-2.5 bg-theme-sidebar border-b border-theme-border flex items-center justify-between gap-3 shrink-0 select-none">
        {/* Left: Service Identity & Status Badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-theme-main truncate" title={service.name}>
              {service.name}
            </span>
            {/* Status Badge */}
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 shrink-0 ${
                isRunning
                  ? 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 dark:border-emerald-500/30'
                  : isStarting
                  ? 'bg-sky-500/10 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25 dark:border-sky-500/30'
                  : isStopping
                  ? 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 dark:border-amber-500/30'
                  : runtime.status === 'failed'
                  ? 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 dark:border-rose-500/30'
                  : 'bg-zinc-500/10 dark:bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/25 dark:border-zinc-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isRunning
                    ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse'
                    : isStarting
                    ? 'bg-sky-500 dark:bg-sky-400 animate-pulse'
                    : isStopping
                    ? 'bg-amber-500 dark:bg-amber-400 animate-pulse'
                    : runtime.status === 'failed'
                    ? 'bg-rose-500 dark:bg-rose-400'
                    : 'bg-zinc-400'
                }`}
              />
              {isRunning
                ? t.services.status.running
                : isStarting
                ? t.services.status.starting
                : isStopping
                ? t.services.status.stopping
                : runtime.status === 'failed'
                ? `${t.services.status.failed} (${runtime.exitCode !== undefined ? runtime.exitCode : 1})`
                : t.services.status.stopped}
            </span>
          </div>

          {/* Running PID */}
          {runtime.pid && (
            <span className="text-[11px] font-mono text-theme-muted bg-theme-hover px-1.5 py-0.5 rounded border border-theme-border/60 shrink-0">
              PID: {runtime.pid}
            </span>
          )}

          {/* Uptime */}
          {uptimeText && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400/90 shrink-0">
              <Clock className="w-3 h-3" />
              {uptimeText}
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Start / Stop Toggle */}
          <button
            onClick={() => {
              if (isStopping) return;
              if (isBusy) {
                stopService(service.id);
              } else {
                startService(projectId, service.id);
              }
            }}
            disabled={isStopping}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shadow-xs ${
              isStopping
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 cursor-wait'
                : isBusy
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/40 cursor-pointer'
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40 cursor-pointer'
            }`}
          >
            {isStopping ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t.services.status.stopping}</span>
              </>
            ) : isBusy ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>{t.services.stop}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{t.services.start}</span>
              </>
            )}
          </button>

          {/* Restart */}
          <button
            onClick={() => restartService(projectId, service.id)}
            disabled={!isRunning}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer border border-transparent ${
              isRunning
                ? 'text-theme-muted hover:text-theme-main hover:bg-theme-hover hover:border-theme-border'
                : 'text-theme-muted/30 cursor-not-allowed'
            }`}
            title={t.services.restart}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-theme-border mx-1" />

          {/* Auto Scroll Toggle */}
          <button
            onClick={() => {
              const nextState = !isAutoScroll;
              setAutoScroll(service.id, nextState);
              if (nextState) {
                scrollToBottom(true);
              }
            }}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              isAutoScroll
                ? 'text-sky-400 bg-sky-500/15 border border-sky-500/30'
                : 'text-theme-muted hover:text-theme-main hover:bg-theme-hover'
            }`}
            title={isAutoScroll ? t.services.autoScroll : t.services.autoScrollPaused}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          {/* Copy Logs */}
          <button
            onClick={handleCopyLogs}
            disabled={runtime.logs.length === 0}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title={copied ? t.services.copiedLogsToast : t.services.copyLogs}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Clear Logs */}
          <button
            onClick={() => clearLogs(service.id)}
            disabled={runtime.logs.length === 0}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title={t.services.clearLogs}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sub-header: Command & Cwd Indicator */}
      <div className="px-4 py-1.5 bg-theme-sidebar/60 border-b border-theme-border/50 text-[11px] font-mono text-theme-muted flex items-center justify-between gap-4 select-none shrink-0 overflow-hidden">
        <div className="flex items-center gap-1.5 truncate">
          <Terminal className="w-3 h-3 text-sky-400 shrink-0" />
          <span className="text-zinc-500 dark:text-zinc-400 shrink-0">{t.services.commandLabel}:</span>
          <span className="text-theme-main truncate font-medium">{activeCommand || t.common.none}</span>
        </div>
        {service.cwd && (
          <div className="flex items-center gap-1.5 truncate shrink-0">
            <Folder className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="text-zinc-500 dark:text-zinc-400">{t.services.cwdLabel}:</span>
            <span className="text-theme-main truncate">{service.cwd}</span>
          </div>
        )}
      </div>

      {/* Main Console Output Area */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto p-4 font-mono text-xs text-zinc-200 bg-[#141416] select-text leading-relaxed tracking-wide space-y-0.5"
        >
          {runtime.logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 select-none py-12">
              <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/40 mb-3 text-zinc-400">
                <Terminal className="w-6 h-6" />
              </div>
              <p className="text-xs mb-3">{t.services.noServicesTitle}</p>
              {!isBusy && (
                <button
                  onClick={() => startService(projectId, service.id)}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 text-xs font-sans font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t.services.start}</span>
                </button>
              )}
            </div>
          ) : (
            runtime.logs.map((line, index) => (
              <div
                key={index}
                className="whitespace-pre-wrap break-all min-h-[1.25em]"
                dangerouslySetInnerHTML={{ __html: parseAnsiToHtml(line) || '&nbsp;' }}
              />
            ))
          )}
        </div>

        {/* Floating Scroll to Bottom Pill when Auto-scroll is paused */}
        {!isAutoScroll && runtime.logs.length > 0 && (
          <div className="absolute bottom-4 right-6 z-10 pointer-events-auto">
            <button
              onClick={() => {
                setAutoScroll(service.id, true);
                scrollToBottom(true);
              }}
              className="px-3 py-1.5 rounded-full bg-sky-600/95 hover:bg-sky-500 text-white text-xs font-medium shadow-lg backdrop-blur-xs flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95 border border-sky-400/40"
              title={t.services.scrollToBottom}
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>{t.services.scrollToBottom}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
