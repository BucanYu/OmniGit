import React, { useState, useEffect } from 'react';
import type { ServiceConfig } from './types';
import { useServicesStore } from './useServicesStore';
import { useTranslation } from '../../locales';
import {
  Play,
  Square,
  RefreshCw,
  Settings2,
  Trash2,
  Edit2,
  Check,
  X,
  Clock,
  Terminal,
  GripVertical,
  Loader2,
} from 'lucide-react';

interface ServiceCardProps {
  service: ServiceConfig;
  index: number;
  projectId: string;
  isActive: boolean;
  onSelect: () => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
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

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  index,
  projectId,
  isActive,
  onSelect,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}) => {
  const { t } = useTranslation();
  const {
    getRuntime,
    startService,
    stopService,
    restartService,
    renameService,
    deleteService,
    openEditModal,
  } = useServicesStore();

  const runtime = getRuntime(service.id);
  const isRunning = runtime.status === 'running';
  const isStarting = runtime.status === 'starting';
  const isStopping = runtime.status === 'stopping';
  const isBusy = isRunning || isStarting || isStopping;

  // Inline rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(service.name);

  // Delete confirm state
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Uptime ticker
  const [uptimeText, setUptimeText] = useState('');
  useEffect(() => {
    if (!isRunning || !runtime.startedAt) {
      setUptimeText('');
      return;
    }
    const update = () => {
      setUptimeText(formatUptime(Date.now() - (runtime.startedAt || 0)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isRunning, runtime.startedAt]);

  const isWindows =
    typeof window !== 'undefined' &&
    ((window as any).electronAPI?.platform === 'win32' ||
      navigator.platform?.toLowerCase().includes('win'));

  const activeCommand = (isWindows ? service.winCommand : service.unixCommand) || '';

  const handleStartStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isStopping) return;
    if (isBusy) {
      stopService(service.id);
    } else {
      startService(projectId, service.id);
    }
  };

  const handleRestart = (e: React.MouseEvent) => {
    e.stopPropagation();
    restartService(projectId, service.id);
  };

  const handleSaveRename = (e?: React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== service.name) {
      renameService(projectId, service.id, trimmed);
    }
    setIsRenaming(false);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(service.name);
    setIsRenaming(false);
  };

  return (
    <div
      draggable={!isRenaming && !isConfirmingDelete}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`group relative p-3 rounded-xl border transition-all cursor-pointer select-none mb-2.5 ${
        isDragging
          ? 'opacity-40 scale-[0.98] border-dashed border-sky-400/80 bg-sky-500/5'
          : isDragOver
          ? 'border-sky-400 bg-sky-500/15 shadow-md shadow-sky-500/20 scale-[1.01]'
          : isActive
          ? 'bg-theme-hover/90 border-sky-500/70 shadow-sm shadow-sky-500/10'
          : 'bg-theme-sidebar/80 border-theme-border/60 hover:bg-theme-hover/50 hover:border-theme-border'
      }`}
    >
      {/* Top Row: Drag Handle, Status Indicator, Name, Quick Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Drag Grip Handle */}
          <div
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-theme-muted transition-opacity cursor-grab active:cursor-grabbing shrink-0 -ml-1 mr-0.5"
            title={t.services.dragToReorder}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>

          {/* Status Dot */}
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {isRunning && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            {isStarting && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            )}
            {isStopping && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isRunning
                  ? 'bg-emerald-500'
                  : isStarting
                  ? 'bg-sky-500'
                  : isStopping
                  ? 'bg-amber-500'
                  : runtime.status === 'failed'
                  ? 'bg-rose-500'
                  : 'bg-zinc-400 dark:bg-zinc-600'
              }`}
            />
          </span>

          {/* Name or Inline Rename Form */}
          {isRenaming ? (
            <form onSubmit={handleSaveRename} className="flex items-center gap-1 flex-1">
              <input
                autoFocus
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full text-xs font-medium px-2 py-0.5 rounded bg-theme-app border border-sky-500 focus:outline-none text-theme-main"
              />
              <button
                type="submit"
                onClick={handleSaveRename}
                className="p-1 text-emerald-400 hover:bg-theme-app rounded cursor-pointer"
                title={t.common.save}
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCancelRename}
                className="p-1 text-theme-muted hover:bg-theme-app rounded cursor-pointer"
                title={t.common.cancel}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <div
              className="flex items-center gap-1.5 min-w-0 flex-1"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsRenaming(true);
              }}
            >
              <span className="text-xs font-semibold text-theme-main truncate" title={service.name}>
                {service.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRenaming(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-theme-muted hover:text-theme-main transition-opacity cursor-pointer"
                title={t.services.renameService}
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Start/Stop Button */}
          <button
            onClick={handleStartStop}
            disabled={isStopping}
            className={`p-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center ${
              isStopping
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 cursor-wait'
                : isBusy
                ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30 cursor-pointer'
                : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 cursor-pointer'
            }`}
            title={isStopping ? t.services.status.stopping : isBusy ? t.services.stop : t.services.start}
          >
            {isStopping ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isBusy ? (
              <Square className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
          </button>

          {/* Restart Button (Active only when running) */}
          <button
            onClick={handleRestart}
            disabled={!isRunning}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              isRunning
                ? 'text-theme-muted hover:text-theme-main hover:bg-theme-hover'
                : 'text-theme-muted/30 cursor-not-allowed'
            }`}
            title={t.services.restart}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Edit Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(service);
            }}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors cursor-pointer"
            title={t.services.editService}
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>

          {/* Delete Button */}
          {isConfirmingDelete ? (
            <div className="flex items-center gap-1 bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/30">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteService(projectId, service.id);
                  setIsConfirmingDelete(false);
                }}
                className="text-[10px] text-rose-400 hover:underline px-1 cursor-pointer font-medium"
              >
                {t.common.confirm}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsConfirmingDelete(false);
                }}
                className="text-theme-muted hover:text-theme-main p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsConfirmingDelete(true);
              }}
              className="p-1.5 rounded-lg text-theme-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title={t.services.deleteService}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Middle Row: Platform Command Badge */}
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-theme-muted font-mono truncate bg-theme-app/50 px-2 py-1 rounded-md border border-theme-border/40">
        <Terminal className="w-3 h-3 shrink-0 text-sky-400" />
        <span className="truncate" title={activeCommand || t.common.none}>
          {activeCommand || t.common.none}
        </span>
      </div>

      {/* Bottom Status Row */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-theme-muted/80">
        <div className="flex items-center gap-2">
          {/* Status text */}
          <span
            className={`font-medium ${
              isRunning
                ? 'text-emerald-600 dark:text-emerald-400'
                : isStarting
                ? 'text-sky-600 dark:text-sky-400'
                : isStopping
                ? 'text-amber-600 dark:text-amber-400'
                : runtime.status === 'failed'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-theme-muted'
            }`}
          >
            {runtime.status === 'running'
              ? t.services.status.running
              : runtime.status === 'starting'
              ? t.services.status.starting
              : runtime.status === 'stopping'
              ? t.services.status.stopping
              : runtime.status === 'failed'
              ? `${t.services.status.failed} (${runtime.exitCode !== undefined ? runtime.exitCode : 1})`
              : t.services.status.stopped}
          </span>

          {/* PID badge */}
          {runtime.pid && (
            <span className="font-mono text-zinc-600 dark:text-zinc-400 bg-theme-hover px-1.5 py-0.5 rounded">
              PID: {runtime.pid}
            </span>
          )}
        </div>

        {/* Uptime clock */}
        {uptimeText && (
          <span className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400">
            <Clock className="w-3 h-3" />
            {uptimeText}
          </span>
        )}
      </div>
    </div>
  );
};
