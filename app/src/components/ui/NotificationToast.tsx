import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Info, CheckCircle2, AlertTriangle, X, Copy, Check } from 'lucide-react';
import { useTranslation } from '../../locales';

export function NotificationToast() {
  const { t } = useTranslation();
  const { notification, clearNotification } = useAppStore();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!notification) return;
    // Warnings / Errors stay longer (10s), info/success 6s
    const timeout = notification.type === 'warning' ? 10000 : 6000;
    const timer = setTimeout(() => {
      clearNotification();
    }, timeout);
    return () => clearTimeout(timer);
  }, [notification, clearNotification]);

  if (!notification) return null;

  const renderIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
      default:
        return <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />;
    }
  };

  const handleCopyDetail = () => {
    if (!notification.detail) return;
    navigator.clipboard.writeText(`${notification.title}\n${notification.detail}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-4 left-5 z-[999] animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="bg-[#2b2d30] text-gray-200 border border-[#3e434a] rounded-lg shadow-2xl p-3 max-w-md min-w-[260px] flex items-start gap-2.5 text-xs select-none">
        {renderIcon()}
        <div className="flex-1 pr-1 min-w-0">
          <div className="font-semibold text-gray-100 text-xs flex items-center justify-between">
            <span>{notification.title}</span>
            {notification.detail && (
              <button
                type="button"
                onClick={handleCopyDetail}
                className="text-[10px] text-gray-400 hover:text-sky-400 flex items-center gap-1 transition ml-2 cursor-pointer font-normal"
                title={t.common.notification.copyTooltip}
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? t.common.notification.copied : t.common.notification.copyDetails}</span>
              </button>
            )}
          </div>
          {notification.detail && (
            <div className="text-gray-300 mt-1 text-[11px] font-mono leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap break-words bg-black/30 p-1.5 rounded border border-white/5">
              {notification.detail}
            </div>
          )}
        </div>
        <button
          onClick={clearNotification}
          className="text-gray-400 hover:text-white p-0.5 rounded transition cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
