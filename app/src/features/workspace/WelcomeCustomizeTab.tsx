import React from 'react';
import {
  Check,
  Languages,
  Moon,
  Sun,
  Terminal,
  Compass,
  Settings,
  FolderGit2,
  GitBranch,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Edit2,
  Copy,
  Trash2,
} from 'lucide-react';
import { useAppStore, type AppTheme, type WorkspaceGroupItem } from '../../store/useAppStore';
import { useTranslation } from '../../locales';

export const WelcomeCustomizeTab: React.FC = () => {
  const { t, language, setLanguage } = useTranslation();
  const {
    theme,
    setTheme,
    startupBehavior,
    setStartupBehavior,
    newWindowBehavior,
    setNewWindowBehavior,
    setIsSettingsModalOpen,
  } = useAppStore();

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-3xl space-y-6">
      <div>
        <h2 className="text-base font-bold text-theme-main">{t.welcome.customizeTitle}</h2>
        <p className="text-xs text-theme-dim mt-1">{t.welcome.customizeDesc}</p>
      </div>

      {/* Section 0: Interface Language */}
      <div className="space-y-4 bg-theme-card p-4 rounded-xl border border-theme-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-xs text-theme-main">
              {t.welcome.languageSettingTitle}
            </span>
          </div>
          <span className="text-[10px] text-theme-dim font-mono">i18n Dual Engine</span>
        </div>
        <p className="text-xs text-theme-dim">{t.welcome.languageSettingDesc}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => setLanguage('zh-CN')}
            className={`p-3.5 rounded-lg border text-left flex flex-col gap-1 transition cursor-pointer ${
              language === 'zh-CN'
                ? 'border-sky-500 bg-sky-500/10 shadow-xs ring-1 ring-sky-500/30'
                : 'border-theme-border hover:border-theme-border/80 bg-theme-input'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-theme-main flex items-center gap-1.5">
                <span className="text-sm">🇨🇳</span>
                <span>{t.settings.languageSection.zhTitle}</span>
              </span>
              {language === 'zh-CN' && <Check className="w-3.5 h-3.5 text-sky-400" />}
            </div>
            <span className="text-[11px] text-theme-dim mt-0.5 leading-normal">
              {t.settings.languageSection.zhDesc}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setLanguage('en-US')}
            className={`p-3.5 rounded-lg border text-left flex flex-col gap-1 transition cursor-pointer ${
              language === 'en-US'
                ? 'border-sky-500 bg-sky-500/10 shadow-xs ring-1 ring-sky-500/30'
                : 'border-theme-border hover:border-theme-border/80 bg-theme-input'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-theme-main flex items-center gap-1.5">
                <span className="text-sm">🇺🇸</span>
                <span>{t.settings.languageSection.enTitle}</span>
              </span>
              {language === 'en-US' && <Check className="w-3.5 h-3.5 text-sky-400" />}
            </div>
            <span className="text-[11px] text-theme-dim mt-0.5 leading-normal">
              {t.settings.languageSection.enDesc}
            </span>
          </button>
        </div>
      </div>

      {/* Section 1: Color Themes */}
      <div className="space-y-4 bg-theme-card p-4 rounded-xl border border-theme-border">
        <div className="flex items-center justify-between">
          <span className="font-bold text-xs text-theme-main">
            {t.topBar.windowActions.theme}
          </span>
          <span className="text-[10px] text-theme-dim font-mono">
            {t.themes.optionsCount(4)}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {[
            {
              id: 'darcula' as AppTheme,
              name: 'IDEA Darcula',
              subtitle: t.themes.darculaDesc,
              icon: Moon,
              preview: 'bg-[#1e1f22] border-[#323438] text-[#e2e4e9]',
              dots: ['#1e1f22', '#2b2d30', '#3574f0'],
            },
            {
              id: 'idea-light' as AppTheme,
              name: 'IDEA Light',
              subtitle: t.themes.lightDesc,
              icon: Sun,
              preview: 'bg-[#f7f8fa] border-[#d5d8dc] text-[#1e2024]',
              dots: ['#f7f8fa', '#ffffff', '#2f65ca'],
            },
            {
              id: 'github-dark' as AppTheme,
              name: 'GitHub Dark',
              subtitle: t.themes.slateDesc,
              icon: Terminal,
              preview: 'bg-[#0d1117] border-[#30363d] text-[#e6edf3]',
              dots: ['#0d1117', '#161b22', '#2f81f7'],
            },
            {
              id: 'nord-frost' as AppTheme,
              name: 'Nord Frost',
              subtitle: t.themes.arcticDesc,
              icon: Compass,
              preview: 'bg-[#242933] border-[#434c5e] text-[#eceff4]',
              dots: ['#242933', '#2e3440', '#88c0d0'],
            },
          ].map((item) => {
            const isSelected =
              theme === item.id ||
              (item.id === 'idea-light' && (theme as any) === 'light');
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id)}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between gap-2.5 transition cursor-pointer ${
                  isSelected
                    ? 'border-sky-500 bg-sky-500/10 shadow-xs ring-1 ring-sky-500/30'
                    : 'border-theme-border hover:border-theme-border/80 bg-theme-input'
                }`}
              >
                <div
                  className={`h-9 rounded-md flex items-center justify-between px-2.5 font-bold text-xs ${item.preview} border shadow-2xs`}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" />
                    <span className="font-semibold text-[11px]">Aa</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.dots.map((c, i) => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full border border-black/15 shrink-0"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-theme-main truncate">
                      {item.name}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                  </div>
                  <span className="text-[10px] text-theme-dim mt-0.5 truncate leading-tight">
                    {item.subtitle}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Application Cold Startup Behavior */}
      <div className="space-y-3 bg-theme-card p-4 rounded-xl border border-theme-border">
        <div className="flex items-center justify-between">
          <span className="font-bold text-xs text-theme-main">
            {t.welcome.startupSettingTitle}
          </span>
          <span className="text-[10px] text-theme-dim font-mono">
            {t.settings.startupSection.badgeIdea}
          </span>
        </div>
        <p className="text-xs text-theme-dim">{t.welcome.startupSettingDesc}</p>

        <div className="space-y-2 pt-1">
          <label
            onClick={() => setStartupBehavior('reopen_last')}
            className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition ${
              startupBehavior === 'reopen_last'
                ? 'bg-sky-500/10 border-sky-500/60'
                : 'bg-theme-input border-theme-border hover:border-theme-border/80'
            }`}
          >
            <input
              type="radio"
              name="startup_behavior_welcome"
              checked={startupBehavior === 'reopen_last'}
              onChange={() => setStartupBehavior('reopen_last')}
              className="mt-0.5 text-sky-500 cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="font-bold text-xs text-theme-main">
                {t.welcome.startupReopenLast}
              </span>
              <span className="text-[11px] text-theme-dim mt-0.5">
                {t.welcome.startupReopenLastDesc}
              </span>
            </div>
          </label>

          <label
            onClick={() => setStartupBehavior('welcome_screen')}
            className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition ${
              startupBehavior === 'welcome_screen'
                ? 'bg-sky-500/10 border-sky-500/60'
                : 'bg-theme-input border-theme-border hover:border-theme-border/80'
            }`}
          >
            <input
              type="radio"
              name="startup_behavior_welcome"
              checked={startupBehavior === 'welcome_screen'}
              onChange={() => setStartupBehavior('welcome_screen')}
              className="mt-0.5 text-sky-500 cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="font-bold text-xs text-theme-main">
                {t.welcome.startupWelcomeScreen}
              </span>
              <span className="text-[11px] text-theme-dim mt-0.5">
                {t.welcome.startupWelcomeScreenDesc}
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Section 3: New Window Behavior */}
      <div className="space-y-3 bg-theme-card p-4 rounded-xl border border-theme-border">
        <div className="flex items-center justify-between">
          <span className="font-bold text-xs text-theme-main">
            {t.welcome.newWindowSettingTitle}
          </span>
          <span className="text-[10px] text-theme-dim font-mono">
            {t.settings.newWindowSection.badgeMultiWindow}
          </span>
        </div>
        <p className="text-xs text-theme-dim">{t.welcome.newWindowSettingDesc}</p>
        <div className="space-y-2 pt-1">
          <label
            onClick={() => setNewWindowBehavior('empty')}
            className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition ${
              newWindowBehavior === 'empty'
                ? 'bg-sky-500/10 border-sky-500/60'
                : 'bg-theme-input border-theme-border hover:border-theme-border/80'
            }`}
          >
            <input
              type="radio"
              name="new_window_behavior_welcome"
              checked={newWindowBehavior === 'empty'}
              onChange={() => setNewWindowBehavior('empty')}
              className="mt-0.5 text-sky-500 cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="font-bold text-xs text-theme-main">
                {t.welcome.newWindowEmpty}
              </span>
              <span className="text-[11px] text-theme-dim mt-0.5">
                {t.welcome.newWindowEmptyDesc}
              </span>
            </div>
          </label>

          <label
            onClick={() => setNewWindowBehavior('welcome')}
            className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition ${
              newWindowBehavior === 'welcome'
                ? 'bg-sky-500/10 border-sky-500/60'
                : 'bg-theme-input border-theme-border hover:border-theme-border/80'
            }`}
          >
            <input
              type="radio"
              name="new_window_behavior_welcome"
              checked={newWindowBehavior === 'welcome'}
              onChange={() => setNewWindowBehavior('welcome')}
              className="mt-0.5 text-sky-500 cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="font-bold text-xs text-theme-main">
                {t.welcome.newWindowWelcome}
              </span>
              <span className="text-[11px] text-theme-dim mt-0.5">
                {t.welcome.newWindowWelcomeDesc}
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Section 4: Open Full Settings */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-theme-dim">{t.welcome.advancedSettingsHint}</span>
        <button
          type="button"
          onClick={() => setIsSettingsModalOpen(true)}
          className="px-4 py-2 bg-theme-hover hover:bg-theme-card border border-theme-border rounded-lg text-xs font-semibold text-theme-main transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
        >
          <Settings className="w-3.5 h-3.5 text-sky-400" />
          <span>{t.welcome.openAdvancedSettings}</span>
        </button>
      </div>
    </div>
  );
};

interface WelcomeFloatingMenusProps {
  hoveredWorkspace: {
    id: string;
    ws: WorkspaceGroupItem;
    top: number;
    left: number;
  } | null;
  contextMenu: {
    x: number;
    y: number;
    workspace: WorkspaceGroupItem;
  } | null;
  setContextMenu: (v: null) => void;
  setWorkspaceToDelete: (ws: WorkspaceGroupItem | null) => void;
  openWorkspaceGroup: (ws: WorkspaceGroupItem, inNewWindow?: boolean) => void;
  renameSavedWorkspace: (id: string, name: string) => void;
}

export const WelcomeFloatingMenus: React.FC<WelcomeFloatingMenusProps> = ({
  hoveredWorkspace,
  contextMenu,
  setContextMenu,
  setWorkspaceToDelete,
  openWorkspaceGroup,
  renameSavedWorkspace,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {hoveredWorkspace && (
        <div
          className="fixed z-50 pointer-events-none w-96 bg-theme-panel border border-theme-border rounded-xl shadow-2xl p-3.5 text-xs text-theme-main animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
          style={{ top: `${hoveredWorkspace.top}px`, left: `${hoveredWorkspace.left}px` }}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-theme-border">
            <div className="flex items-center gap-2 min-w-0">
              <FolderGit2 className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="font-bold text-xs text-theme-main truncate">
                {hoveredWorkspace.ws.name}
              </span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/25 shrink-0">
              {t.welcome.workspaceCard.repoCount(hoveredWorkspace.ws.repos.length)}
            </span>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
            {hoveredWorkspace.ws.repos.map((repo) => (
              <div
                key={repo.path}
                className="flex flex-col gap-0.5 p-2 rounded-lg bg-theme-input/70 border border-theme-border/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                    <span className="font-bold text-xs text-theme-main truncate">
                      {repo.name}
                    </span>
                  </div>
                  {repo.branch && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-0.5 shrink-0">
                      <GitBranch className="w-2.5 h-2.5" />
                      <span>{repo.branch}</span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-theme-dim truncate mt-0.5">
                  {repo.path}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2 mt-2 border-t border-theme-border/60 flex items-center justify-between text-[10px] text-theme-dim">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>{t.welcome.workspaceCard.openButton}</span>
            </span>
            <span className="font-mono text-sky-400">1-Click Multi-Repo</span>
          </div>
        </div>
      )}

      {contextMenu &&
        (() => {
          const menuWidth = 220;
          const menuHeight = 220;
          const clampedX = Math.max(
            10,
            Math.min(contextMenu.x, window.innerWidth - menuWidth - 10)
          );
          const clampedY = Math.max(
            10,
            Math.min(contextMenu.y, window.innerHeight - menuHeight - 10)
          );
          return (
            <div
              className="fixed z-50 theme-dropdown-panel rounded-lg py-1 shadow-2xl border border-theme-border-card text-xs text-theme-main font-sans min-w-[220px]"
              style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
            >
              <div className="px-3 py-1 text-[10px] font-semibold text-theme-dim border-b border-theme-border-subtle truncate max-w-[220px]">
                {contextMenu.workspace.name} (
                {t.welcome.workspaceCard.repoCount(contextMenu.workspace.repos.length)})
              </div>

              <button
                type="button"
                onClick={() => {
                  openWorkspaceGroup(contextMenu.workspace, false);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-theme-hover text-theme-main text-xs transition cursor-pointer flex items-center gap-2"
              >
                <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                <span>{t.welcome.openInThisWindow}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  openWorkspaceGroup(contextMenu.workspace, true);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-theme-hover text-theme-main text-xs transition cursor-pointer flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                <span>{t.welcome.openInNewWindow}</span>
              </button>

              <div className="h-[1px] bg-theme-border-subtle my-1" />

              <button
                type="button"
                onClick={() => {
                  const newName = prompt(t.common.rename, contextMenu.workspace.name);
                  if (newName && newName.trim()) {
                    renameSavedWorkspace(contextMenu.workspace.id, newName.trim());
                  }
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-theme-hover text-theme-muted hover:text-theme-main text-xs transition cursor-pointer flex items-center gap-2"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{t.common.rename}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.workspace.rootPath);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-theme-hover text-theme-muted hover:text-theme-main text-xs transition cursor-pointer flex items-center gap-2"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{t.sidebar.contextMenu.copyPath}</span>
              </button>

              <div className="h-[1px] bg-theme-border-subtle my-1" />

              <button
                type="button"
                onClick={() => {
                  const target = contextMenu.workspace;
                  setContextMenu(null);
                  setWorkspaceToDelete(target);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-rose-500/10 text-rose-400 text-xs transition cursor-pointer flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.welcome.workspaceCard.removeWorkspace}</span>
              </button>
            </div>
          );
        })()}
    </>
  );
};
