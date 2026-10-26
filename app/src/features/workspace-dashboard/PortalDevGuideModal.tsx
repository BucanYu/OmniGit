import React, { useState } from 'react';
import {
  X, Sparkles, BookOpen, Globe, FileCode, Kanban, Copy, Check,
  ShieldCheck, Code2, Users, FileText, ArrowRight, ExternalLink,
} from 'lucide-react';
import { useTranslation } from '../../locales';
import { useDashboardStore } from './useDashboardStore';
import { useAppStore } from '../../store/useAppStore';
import { useEditorTabsStore } from '../code-editor/useEditorTabsStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { AI_PROMPT_TEMPLATE, SDK_CODE_SNIPPET } from './guideTemplates';

export function PortalDevGuideModal() {
  const { t } = useTranslation();
  const { isGuideModalOpen, closeGuideModal, openConfigModalWithPreset } = useDashboardStore();
  const { workspaceId, savedWorkspaces, setNotification } = useAppStore();
  const { openFileTab } = useEditorTabsStore();
  const { setWorkbenchMode } = useWorkbenchStore();

  const [activeTab, setActiveTab] = useState<'scenarios' | 'bridge' | 'ai-prompt' | 'team'>('scenarios');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedSdk, setCopiedSdk] = useState(false);

  if (!isGuideModalOpen) return null;

  const currentWs = savedWorkspaces.find((w) => w.id === workspaceId);
  const rootPath = currentWs?.rootPath || '';

  const handleCopy = async (text: string, isPrompt: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isPrompt) {
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2000);
      } else {
        setCopiedSdk(true);
        setTimeout(() => setCopiedSdk(false), 2000);
      }
      setNotification({
        id: Date.now(),
        title: isPrompt ? t.dashboard.guideModal.copiedPromptToast : t.dashboard.guideModal.copiedSdkToast,
        type: 'success',
      });
    } catch {
      console.warn('Clipboard write failed');
    }
  };

  const handleOpenDocInEditor = async () => {
    try {
      const res = await fetch('/api/app/builtin-doc?name=CUSTOM_DASHBOARD_GUIDE.md');
      const data = await res.json();
      if (data && data.success && data.filePath) {
        await useEditorTabsStore.getState().openFileTab({
          filePath: data.filePath,
          repoPath: data.repoPath || '',
          relativePath: data.relativePath || 'docs/CUSTOM_DASHBOARD_GUIDE.md',
          repoName: 'OmniGit',
        });
        useWorkbenchStore.getState().setWorkbenchMode('explorer');
        useDashboardStore.getState().closeGuideModal();
        return;
      }
    } catch (err) {
      console.warn('[PortalDevGuideModal] Failed to fetch built-in doc path:', err);
    }

    // Fail-safe fallback if network request fails
    const docRelPath = 'docs/CUSTOM_DASHBOARD_GUIDE.md';
    const normRoot = rootPath ? rootPath.replace(/\\/g, '/').replace(/\/$/, '') : '';
    const fullTarget = normRoot ? `${normRoot}/${docRelPath}` : docRelPath;
    await useEditorTabsStore.getState().openFileTab({
      filePath: fullTarget,
      repoPath: rootPath,
      relativePath: docRelPath,
      repoName: 'OmniGit',
    });
    useWorkbenchStore.getState().setWorkbenchMode('explorer');
    useDashboardStore.getState().closeGuideModal();
  };

  const handleApplyPreset = (preset: { type: 'url' | 'file'; url?: string; filePath?: string; title: string }) => {
    openConfigModalWithPreset({
      enabled: true,
      type: preset.type,
      url: preset.url || '',
      filePath: preset.filePath || '',
      title: preset.title,
      enableBridge: true,
      openMode: 'embedded',
    });
    closeGuideModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-theme-panel border border-theme-border rounded-xl shadow-2xl w-[780px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme-border bg-theme-header shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-theme-main">{t.dashboard.guideModal.title}</h2>
              <p className="text-xs text-theme-muted mt-0.5 max-w-xl truncate">{t.dashboard.guideModal.desc}</p>
            </div>
          </div>
          <button
            onClick={closeGuideModal}
            className="p-1 rounded-md text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 border-b border-theme-border bg-theme-header/50 shrink-0 text-xs">
          <button
            data-testid="guide-tab-scenarios"
            onClick={() => setActiveTab('scenarios')}
            className={`px-3 py-2.5 font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'scenarios'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-theme-muted hover:text-theme-main'
            }`}
          >
            {t.dashboard.guideModal.tabScenarios}
          </button>
          <button
            data-testid="guide-tab-bridge"
            onClick={() => setActiveTab('bridge')}
            className={`px-3 py-2.5 font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'bridge'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-theme-muted hover:text-theme-main'
            }`}
          >
            {t.dashboard.guideModal.tabBridge}
          </button>
          <button
            data-testid="guide-tab-ai-prompt"
            onClick={() => setActiveTab('ai-prompt')}
            className={`px-3 py-2.5 font-medium border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ai-prompt'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-theme-muted hover:text-theme-main'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{t.dashboard.guideModal.tabAiPrompt}</span>
          </button>
          <button
            data-testid="guide-tab-team"
            onClick={() => setActiveTab('team')}
            className={`px-3 py-2.5 font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'team'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-theme-muted hover:text-theme-main'
            }`}
          >
            {t.dashboard.guideModal.tabTeamConfig}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 text-xs text-theme-main space-y-4">
          {/* Tab 1: 4 Scenarios */}
          {activeTab === 'scenarios' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  icon: Globe,
                  color: 'text-sky-600 dark:text-sky-400',
                  bg: 'bg-sky-500/10',
                  title: t.dashboard.defaultHub.presetLocalDev,
                  desc: '适合 Next.js、Vite、Vue CLI 等正在运行的本地端口。在 OmniGit 内沉浸式预览，热更新实时响应。',
                  example: 'http://localhost:3000 或 5173',
                  preset: { type: 'url' as const, url: 'http://localhost:3000', title: '本地开发实时预览' },
                },
                {
                  icon: BookOpen,
                  color: 'text-emerald-600 dark:text-emerald-400',
                  bg: 'bg-emerald-500/10',
                  title: t.dashboard.defaultHub.presetDocs,
                  desc: '集成 VitePress、Docusaurus、Swagger UI 或 Storybook，边对照契约规范边写代码，零上下文切换。',
                  example: 'http://localhost:5173/docs 或内网 Swagger',
                  preset: { type: 'url' as const, url: 'http://localhost:5173', title: '自研技术规范文档' },
                },
                {
                  icon: FileCode,
                  color: 'text-purple-600 dark:text-purple-400',
                  bg: 'bg-purple-500/10',
                  title: t.dashboard.defaultHub.presetSpa,
                  desc: '本地编译静态 HTML。OmniGit 内置安全静态托管与智能 <base> 注入，彻底根治 SPA 相对路径 404 白屏。',
                  example: './dist/index.html',
                  preset: { type: 'file' as const, filePath: './dist/index.html', title: '自研单页应用门户' },
                },
                {
                  icon: Kanban,
                  color: 'text-amber-600 dark:text-amber-400',
                  bg: 'bg-amber-500/10',
                  title: t.dashboard.defaultHub.presetKanban,
                  desc: '无缝嵌入 Jira、TAPD、飞书项目、GitLab Issues 等团队看板，直接在工作台认领需求与核对缺陷。',
                  example: 'https://jira.internal.com 或内网看板 URL',
                  preset: { type: 'url' as const, url: '', title: '团队敏捷项目看板' },
                },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="p-4 rounded-xl border border-theme-border bg-theme-card flex flex-col justify-between shadow-xs">
                    <div>
                      <div className="flex items-center gap-2 font-bold text-sm text-theme-main">
                        <Icon className={`w-4 h-4 ${item.color}`} />
                        <span>{item.title}</span>
                      </div>
                      <p className="text-[11px] text-theme-muted mt-1.5 leading-relaxed">{item.desc}</p>
                      <div className={`mt-2.5 font-mono text-[11px] ${item.color} ${item.bg} px-2 py-1 rounded truncate`}>
                        {item.example}
                      </div>
                    </div>
                    <button
                      onClick={() => handleApplyPreset(item.preset)}
                      className="mt-3.5 px-3 py-1.5 rounded-lg border border-theme-border bg-theme-hover hover:border-sky-500 text-theme-main font-medium flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span>{t.dashboard.guideModal.applyPresetAndConfigure}</span>
                      <ArrowRight className={`w-3.5 h-3.5 ${item.color}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab 2: Bridge Protocol */}
          {activeTab === 'bridge' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-theme-main space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t.dashboard.guideModal.bridgeCardTitle}</span>
                </div>
                <p className="text-[11px] text-theme-muted leading-relaxed">
                  {t.dashboard.guideModal.bridgeCardDesc}
                </p>
              </div>

              {/* Protocol Table */}
              <div className="border border-theme-border rounded-lg overflow-hidden">
                <div className="bg-theme-header px-3.5 py-2 font-semibold text-[11px] text-theme-muted border-b border-theme-border">
                  核心联动 RPC 动作接口一览
                </div>
                <div className="divide-y divide-theme-border text-[11px]">
                  <div className="p-3 bg-theme-card">
                    <span className="font-mono font-bold text-sky-600 dark:text-sky-400">omnigit:get-workspace-info</span>
                    <p className="text-theme-muted mt-0.5">索取当前工作区名称、系统主题（darcula / idea-light）与多仓库列表（分支、改动数、待推数）。</p>
                  </div>
                  <div className="p-3 bg-theme-card">
                    <span className="font-mono font-bold text-sky-600 dark:text-sky-400">omnigit:navigate</span>
                    <p className="text-theme-muted mt-0.5">
                      通知宿主跳转视图：<code className="text-amber-600 dark:text-amber-300">mode: 'git' | 'explorer' | 'services'</code>。支持传递 <code className="text-amber-600 dark:text-amber-300">repoName</code> 直接激活特定仓库！
                    </p>
                  </div>
                  <div className="p-3 bg-theme-card">
                    <span className="font-mono font-bold text-sky-600 dark:text-sky-400">omnigit:open-file</span>
                    <p className="text-theme-muted mt-0.5">
                      在内置 Monaco 编辑器中定位打开相对路径文件（如 <code className="text-emerald-600 dark:text-emerald-400">src/App.vue</code>），自动切换到资源管理器视图。
                    </p>
                  </div>
                  <div className="p-3 bg-theme-card">
                    <span className="font-mono font-bold text-sky-600 dark:text-sky-400">omnigit:sync-all</span>
                    <p className="text-theme-muted mt-0.5">触发宿主后台对工作区全部仓库执行 Git 状态轮询。</p>
                  </div>
                </div>
              </div>

              {/* Code Preview */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-theme-muted text-[11px]">客户端轻量接入 SDK 示例代码</span>
                  <button
                    onClick={() => handleCopy(SDK_CODE_SNIPPET, false)}
                    className="flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    {copiedSdk ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{t.dashboard.guideModal.copySdkButton}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-theme-input border border-theme-border font-mono text-[11px] text-theme-main overflow-x-auto max-h-48">
                  {SDK_CODE_SNIPPET}
                </pre>
              </div>
            </div>
          )}

          {/* Tab 3: AI Prompt Template */}
          {activeTab === 'ai-prompt' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-theme-main space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                  <Sparkles className="w-4 h-4" />
                  <span>{t.dashboard.guideModal.aiPromptCardTitle}</span>
                </div>
                <p className="text-[11px] text-theme-muted leading-relaxed">
                  {t.dashboard.guideModal.aiPromptCardDesc}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-medium text-theme-muted">完整提示词内容 (Prompt Content)</span>
                <button
                  onClick={() => handleCopy(AI_PROMPT_TEMPLATE, true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors cursor-pointer shadow-xs"
                >
                  {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{t.dashboard.guideModal.copyPromptButton}</span>
                </button>
              </div>

              <pre className="p-3.5 rounded-lg bg-theme-input border border-theme-border font-mono text-[11px] text-theme-main overflow-x-auto max-h-64 whitespace-pre-wrap leading-relaxed select-text">
                {AI_PROMPT_TEMPLATE}
              </pre>
            </div>
          )}

          {/* Tab 4: Team Config */}
          {activeTab === 'team' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-theme-main space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                  <Users className="w-4 h-4" />
                  <span>{t.dashboard.guideModal.teamCardTitle}</span>
                </div>
                <p className="text-[11px] text-theme-muted leading-relaxed">
                  {t.dashboard.guideModal.teamCardDesc}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-medium text-theme-muted block mb-1.5">
                  .omnigit/dashboard.json 推荐规范结构
                </span>
                <pre className="p-3 rounded-lg bg-theme-input border border-theme-border font-mono text-[11px] text-theme-main overflow-x-auto">
{`{
  "$schema": "https://omnigit.dev/schemas/dashboard-v1.json",
  "version": "1.0.0",
  "enabled": true,
  "type": "url",
  "url": "http://localhost:3000",
  "title": "前端工程专属研发门户",
  "openMode": "embedded",
  "autoReload": false,
  "reloadIntervalSeconds": 60,
  "enableBridge": true
}`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-theme-border bg-theme-header shrink-0">
          <button
            data-testid="guide-open-editor-btn"
            type="button"
            onClick={handleOpenDocInEditor}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme-border bg-theme-card hover:bg-theme-hover text-theme-main transition-colors text-xs cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>{t.dashboard.guideModal.openDocInEditor}</span>
          </button>

          <button
            type="button"
            onClick={closeGuideModal}
            className="px-4 py-1.5 rounded-lg bg-theme-hover hover:bg-theme-card border border-theme-border text-theme-main font-medium transition-colors cursor-pointer text-xs"
          >
            {t.dashboard.guideModal.close}
          </button>
        </div>
      </div>
    </div>
  );
}
