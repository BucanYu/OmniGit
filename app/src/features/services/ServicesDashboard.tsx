import React, { useState, useEffect } from 'react';
import { useServicesStore } from './useServicesStore';
import { useAppStore } from '../../store/useAppStore';
import { ServiceCard } from './ServiceCard';
import { ServiceLogViewer } from './ServiceLogViewer';
import { ServiceConfigModal } from './ServiceConfigModal';
import { ResizeDivider } from '../../components/ui/ResizeDivider';
import { useTranslation } from '../../locales';
import {
  Layers,
  Plus,
  Play,
  Square,
  Server,
  FolderGit2,
  FileSearch,
} from 'lucide-react';

export const ServicesDashboard: React.FC = () => {
  const { t } = useTranslation();
  const {
    projects,
    activeProjectId,
  } = useAppStore();

  const {
    loadProjectServices,
    getServices,
    activeServiceId,
    setActiveServiceId,
    openAddModal,
    startAllServices,
    stopAllServices,
    hasRunningServices,
    getRunningCount,
    scanProjectScripts,
    importDiscoveredScripts,
    reorderServices,
  } = useServicesStore();

  const currentProject = projects.find((p) => p.id === activeProjectId);
  const projectId = activeProjectId || '';
  const [isScanning, setIsScanning] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('omnigit_services_left_width');
      if (saved) return Math.max(260, Math.min(600, parseInt(saved, 10)));
    }
    return 360;
  });

  const handleResize = (newWidth: number) => {
    const clamped = Math.max(260, Math.min(600, newWidth));
    setLeftWidth(clamped);
    if (typeof window !== 'undefined') {
      localStorage.setItem('omnigit_services_left_width', String(clamped));
    }
  };

  useEffect(() => {
    if (projectId) {
      loadProjectServices(projectId);
    }
  }, [projectId, loadProjectServices]);

  const services = getServices(projectId);
  const activeService = services.find((s) => s.id === activeServiceId) || (services.length > 0 ? services[0] : null);
  const runningCount = getRunningCount(projectId);
  const hasRunning = hasRunningServices(projectId);

  const handleScanAndImport = async () => {
    if (!projectId) return;
    setIsScanning(true);
    try {
      const discovered = await scanProjectScripts(projectId);
      if (discovered && discovered.length > 0) {
        importDiscoveredScripts(projectId, discovered);
      } else {
        openAddModal();
      }
    } finally {
      setIsScanning(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-theme-app text-theme-muted p-8 select-none">
        <div className="w-16 h-16 rounded-2xl bg-theme-sidebar border border-theme-border flex items-center justify-center mb-4 text-theme-muted/50">
          <FolderGit2 className="w-8 h-8" />
        </div>
        <h3 className="text-sm font-semibold text-theme-main mb-1">
          {t.services.noActiveProjectPrompt}
        </h3>
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-full overflow-hidden relative">
      {/* Left Panel: Services List */}
      <div
        style={{ width: `${leftWidth}px`, minWidth: `${leftWidth}px`, maxWidth: `${leftWidth}px` }}
        className="h-full bg-theme-sidebar border-r border-theme-border flex flex-col shrink-0 overflow-hidden select-none"
      >
        {/* Header */}
        <div className="p-3 border-b border-theme-border flex items-center justify-between gap-2 shrink-0 bg-theme-sidebar/90">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="p-1.5 rounded-lg bg-sky-500/10 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-semibold text-theme-main truncate" title={t.services.modeTitle}>
                  {t.services.modeTitle}
                </span>
                {runningCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none shrink-0 whitespace-nowrap bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 dark:border-emerald-500/30 select-none shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shrink-0" />
                    <span>{t.services.runningCountBadge(runningCount)}</span>
                  </span>
                )}
              </div>
              <p className="text-[10px] text-theme-muted truncate" title={currentProject.name}>
                {currentProject.name}
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Scan Project Scripts */}
            <button
              onClick={handleScanAndImport}
              disabled={isScanning}
              className="p-1.5 rounded-lg text-theme-muted hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-500/10 transition-colors cursor-pointer disabled:opacity-40"
              title={t.services.scanScriptsTooltip}
            >
              <FileSearch className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            </button>

            {/* Start All */}
            <button
              onClick={() => startAllServices(projectId)}
              disabled={services.length === 0}
              className="p-1.5 rounded-lg text-theme-muted hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title={t.services.startAll}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>

            {/* Stop All */}
            <button
              onClick={() => stopAllServices(projectId)}
              disabled={!hasRunning}
              className="p-1.5 rounded-lg text-theme-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title={t.services.stopAll}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>

            {/* Add Service */}
            <button
              onClick={openAddModal}
              className="p-1.5 rounded-lg bg-sky-500/10 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 border border-sky-500/25 dark:border-sky-500/30 transition-colors cursor-pointer"
              title={t.services.newService}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Services List Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {services.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-theme-muted">
              <div className="w-12 h-12 rounded-xl bg-theme-app border border-theme-border flex items-center justify-center mb-3 text-theme-muted/50">
                <Layers className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-semibold text-theme-main mb-1.5">
                {t.services.noServicesTitle}
              </h4>
              <p className="text-[11px] text-theme-muted/80 leading-relaxed mb-4">
                {t.services.noServicesDesc}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleScanAndImport}
                  disabled={isScanning}
                  className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <FileSearch className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{t.services.scanScripts}</span>
                </button>
                <button
                  onClick={openAddModal}
                  className="px-3 py-1.5 rounded-lg bg-theme-hover hover:bg-theme-border/60 text-theme-main font-medium text-xs flex items-center gap-1.5 border border-theme-border transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.services.newService}</span>
                </button>
              </div>
            </div>
          ) : (
            services.map((item, index) => (
              <ServiceCard
                key={item.id}
                service={item}
                index={index}
                projectId={projectId}
                isActive={activeService?.id === item.id}
                onSelect={() => setActiveServiceId(item.id)}
                isDragging={draggedIndex === index}
                isDragOver={dragOverIndex === index}
                onDragStart={(e) => {
                  setDraggedIndex(index);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', item.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverIndex !== index) {
                    setDragOverIndex(index);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverIndex === index) {
                    setDragOverIndex(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedIndex !== null && draggedIndex !== index) {
                    reorderServices(projectId, draggedIndex, index);
                  }
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* Resizable Divider */}
      <ResizeDivider
        currentWidth={leftWidth}
        minWidth={260}
        maxWidth={600}
        onResize={handleResize}
        onDoubleClickReset={() => handleResize(360)}
        title={t.common.dragResizeHorizontal}
      />

      {/* Right Panel: Service Log & Console */}
      <ServiceLogViewer
        service={activeService}
        projectId={projectId}
      />

      {/* Config Modal (Add / Edit) */}
      <ServiceConfigModal
        projectId={projectId}
        projectPath={currentProject.path}
      />
    </div>
  );
};
