import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../locales';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  icon?: 'trash' | 'warning' | 'alert';
  isLoading?: boolean;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText,
  cancelText,
  variant = 'danger',
  icon = 'warning',
  isLoading = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const effectiveConfirmText = confirmText ?? t.common.confirm;
  const effectiveCancelText = cancelText ?? t.common.cancel;
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const renderIcon = () => {
    if (icon === 'trash') {
      return (
        <div className="w-9 h-9 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
          <Trash2 className="w-5 h-5" />
        </div>
      );
    }
    if (variant === 'danger' || icon === 'alert') {
      return (
        <div className="w-9 h-9 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
        <AlertCircle className="w-5 h-5" />
      </div>
    );
  };

  const confirmBtnStyles =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm border border-rose-500/30'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
      : 'bg-theme-accent hover:bg-theme-accent-hover text-white shadow-sm';

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-theme-card border border-theme-border-card rounded-xl shadow-2xl p-5 w-full max-w-md text-xs text-theme-main relative flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start gap-3.5">
          {renderIcon()}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-sm font-bold text-theme-main tracking-tight leading-snug">
              {title}
            </h3>
            <div className="text-theme-muted text-xs mt-1.5 leading-relaxed">
              {description}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-theme-dim hover:text-theme-main p-1 rounded hover:bg-theme-card-hover transition cursor-pointer shrink-0"
            title={t.common.escClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Optional Custom Content (e.g. Checkbox, File List, etc.) */}
        {children && <div className="pt-1">{children}</div>}

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-theme-border-subtle">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-3.5 py-1.5 rounded-md bg-theme-hover hover:bg-theme-card-hover text-theme-main font-medium transition cursor-pointer border border-theme-border-subtle disabled:opacity-50"
          >
            {effectiveCancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-1.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${confirmBtnStyles}`}
          >
            {isLoading && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            <span>{effectiveConfirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
