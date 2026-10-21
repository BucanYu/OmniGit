import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../../locales';

interface StatusRollbackModalProps {
  isOpen: boolean;
  targetPaths: string[];
  onClose: () => void;
  onConfirm: () => void;
}

export const StatusRollbackModal: React.FC<StatusRollbackModalProps> = ({
  isOpen,
  targetPaths,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center select-none">
      <div className="bg-theme-card border border-theme-border-card rounded shadow-2xl p-4 w-96 text-xs text-theme-main">
        <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm mb-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{t.statusPanel.toolbar.rollback}</span>
        </div>
        <p className="text-theme-muted mb-3">
          {t.statusPanel.rollbackConfirmDescription(targetPaths.length)}
        </p>
        <div className="max-h-36 overflow-y-auto bg-theme-input p-2 rounded border border-theme-border-card font-mono text-[11px] mb-4 text-theme-dim">
          {targetPaths.map((p) => (
            <div key={p} className="truncate">
              {p}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-theme-hover hover:bg-theme-border-card text-theme-main rounded transition cursor-pointer"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium transition cursor-pointer"
          >
            {t.statusPanel.toolbar.rollback}
          </button>
        </div>
      </div>
    </div>
  );
};
