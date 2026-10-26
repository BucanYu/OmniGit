import React, { useState } from 'react';
import {
  Sparkles,
  Globe,
  BookOpen,
  FileCode,
  Kanban,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useTranslation } from '../../locales';

interface PresetConfig {
  enabled: boolean;
  type: 'url' | 'file';
  url?: string;
  filePath?: string;
  title: string;
  enableBridge?: boolean;
}

interface WorkspacePortalBannerProps {
  onOpenGuideModal: () => void;
  onApplyPreset: (preset: PresetConfig) => void;
}

export const WorkspacePortalBanner: React.FC<WorkspacePortalBannerProps> = ({
  onOpenGuideModal,
  onApplyPreset,
}) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('omnigit_portal_banner_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('omnigit_portal_banner_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const presets = [
    {
      icon: Globe,
      color: 'text-sky-600 dark:text-sky-400',
      iconBg: 'bg-sky-500/10 border-sky-500/20',
      hoverBorder: 'hover:border-sky-500/50',
      title: t.dashboard.defaultHub.presetLocalDev,
      desc: t.dashboard.defaultHub.presetLocalDevDesc,
      preset: {
        enabled: true,
        type: 'url' as const,
        url: 'http://localhost:3000',
        title: '本地开发实时预览',
        enableBridge: true,
      },
    },
    {
      icon: BookOpen,
      color: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20',
      hoverBorder: 'hover:border-emerald-500/50',
      title: t.dashboard.defaultHub.presetDocs,
      desc: t.dashboard.defaultHub.presetDocsDesc,
      preset: {
        enabled: true,
        type: 'url' as const,
        url: 'http://localhost:5173',
        title: '自研技术规范文档',
        enableBridge: true,
      },
    },
    {
      icon: FileCode,
      color: 'text-purple-600 dark:text-purple-400',
      iconBg: 'bg-purple-500/10 border-purple-500/20',
      hoverBorder: 'hover:border-purple-500/50',
      title: t.dashboard.defaultHub.presetSpa,
      desc: t.dashboard.defaultHub.presetSpaDesc,
      preset: {
        enabled: true,
        type: 'file' as const,
        filePath: './dist/index.html',
        title: '自研单页应用门户',
        enableBridge: true,
      },
    },
    {
      icon: Kanban,
      color: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-500/10 border-amber-500/20',
      hoverBorder: 'hover:border-amber-500/50',
      title: t.dashboard.defaultHub.presetKanban,
      desc: t.dashboard.defaultHub.presetKanbanDesc,
      preset: {
        enabled: true,
        type: 'url' as const,
        url: '',
        title: '团队敏捷项目看板',
        enableBridge: true,
      },
    },
  ];

  return (
    <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-500/5 via-blue-500/5 to-transparent p-4 sm:p-5 shadow-2xs transition-all">
      {/* Collapsed State: Slim Bar */}
      {isCollapsed ? (
        <div className="flex items-center justify-between gap-3 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-xs font-bold text-theme-main truncate">
                {t.dashboard.defaultHub.customizeBannerTitle}
              </h3>
              <span className="text-[11px] text-theme-muted hidden sm:inline truncate">
                · {t.dashboard.defaultHub.customizeBannerDesc}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenGuideModal}
              className="px-2.5 py-1 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-medium text-xs transition-colors cursor-pointer"
            >
              <span>{t.dashboard.defaultHub.viewGuide}</span>
            </button>
            <button
              type="button"
              onClick={toggleCollapse}
              className="p-1.5 rounded-lg text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors cursor-pointer"
              title="展开自研门户模版"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Expanded State: Full Showcase */
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-theme-main tracking-tight">
                  {t.dashboard.defaultHub.customizeBannerTitle}
                </h3>
                <p className="text-[11px] text-theme-muted mt-0.5 leading-relaxed">
                  {t.dashboard.defaultHub.customizeBannerDesc}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={onOpenGuideModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-medium text-xs transition-colors cursor-pointer shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t.dashboard.defaultHub.viewGuide}</span>
              </button>

              <button
                type="button"
                onClick={toggleCollapse}
                className="p-1.5 rounded-lg text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors cursor-pointer"
                title="收起门户推荐"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3.5">
            {presets.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  onClick={() => onApplyPreset(item.preset)}
                  className={`p-3 rounded-xl border border-theme-border/70 bg-theme-card/90 dark:bg-theme-card/80 ${item.hoverBorder} hover:bg-theme-card hover:shadow-xs transition-all cursor-pointer group shadow-2xs select-none`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`p-1.5 rounded-lg border ${item.iconBg} shrink-0`}>
                        <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                      </span>
                      <span className="text-xs font-semibold text-theme-main truncate">
                        {item.title}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] ${item.color} opacity-0 group-hover:opacity-100 transition-opacity font-medium shrink-0 flex items-center gap-0.5`}
                    >
                      <span>{t.dashboard.defaultHub.applyPreset}</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                  <p className="text-[10px] text-theme-muted mt-1.5 leading-normal line-clamp-2">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
