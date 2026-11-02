import React, { useState, useEffect } from 'react';
import { useAppStore, normalizePath } from '../../store/useAppStore';
import { useTranslation } from '../../locales';
import { AddRepoCloneSection, getDisplayTitle } from './AddRepoCloneSection';
import {
  FolderPlus,
  X,
  Search,
  CheckSquare,
  Square,
  GitBranch,
  FolderSearch,
  FolderGit2,
  Globe,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';

interface AddRepoModalProps {
  onClose: () => void;
}

export function AddRepoModal({ onClose }: AddRepoModalProps) {
  const { t, isZh } = useTranslation();
  const {
    projects,
    allScannedProjects,
    workspaceProjectPaths,
    addProjectsToWorkspace,
    setWorkspaceProjects,
    workspaceId,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'custom' | 'scanned' | 'clone'>('custom');

  // Tab 1 state: Selection from scanned
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);

  // Tab 2 state: Directory scan
  const [folderInput, setFolderInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredRepos, setDiscoveredRepos] = useState<Array<{ id: string; name: string; path: string; currentBranch: string; isRoot: boolean }>>([]);
  const [selectedDiscovered, setSelectedDiscovered] = useState<string[]>([]);

  const defaultParent = projects[0]?.path
    ? projects[0].path.split(/[\\/]/).slice(0, -1).join('\\') || ''
    : '';

  const [isBrowsing, setIsBrowsing] = useState(false);

  const handleSelectFolder = async (currentPath: string, setter: (val: string) => void) => {
    setIsBrowsing(true);
    try {
      // 1. If running inside Electron desktop app, use Electron native dialog
      if (typeof window !== 'undefined' && (window as any).electronAPI?.selectFolder) {
        const selected = await (window as any).electronAPI.selectFolder(currentPath);
        if (selected) {
          setter(selected);
        }
        return;
      }

      // 2. If running in web browser, call local backend API to open Windows native folder picker
      const res = await fetch('/api/git/select-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialPath: currentPath }),
      });
      const data = await res.json();
      if (data.success && data.folderPath) {
        setter(data.folderPath);
      }
    } catch (e) {
      console.warn('Failed to open native folder picker:', e);
    } finally {
      setIsBrowsing(false);
    }
  };

  // Initialize Tab 1 with current workspace paths so user can add/remove freely
  useEffect(() => {
    setSelectedPaths([...workspaceProjectPaths]);
  }, [workspaceProjectPaths]);

  // Auto scan default directory on modal open so user immediately gets results!
  useEffect(() => {
    handleScanFolder();
  }, []);

  // Filtered scanned projects
  const filteredScanned = allScannedProjects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelectScanned = (path: string) => {
    const norm = normalizePath(path);
    setSelectedPaths((prev) =>
      prev.some((p) => normalizePath(p) === norm)
        ? prev.filter((p) => normalizePath(p) !== norm)
        : [...prev, path]
    );
  };

  const handleSelectAllScanned = () => {
    if (selectedPaths.length === filteredScanned.length) {
      setSelectedPaths([]);
    } else {
      setSelectedPaths(filteredScanned.map((p) => p.path));
    }
  };

  const handleSaveScannedSubmit = async () => {
    await setWorkspaceProjects(selectedPaths);
    onClose();
  };

  // Tab 2: Scan folder
  const handleScanFolder = async () => {
    if (!folderInput.trim()) return;
    setIsScanning(true);
    try {
      const res = await fetch('/api/git/inspect-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: folderInput.trim() }),
      });
      const data: Array<{ id: string; name: string; path: string; currentBranch: string; isRoot: boolean }> = await res.json();
      setDiscoveredRepos(data || []);

      // Pre-select: select all discovered repos by default so user can immediately click import or uncheck any!
      setSelectedDiscovered((data || []).map((r) => r.path));
    } catch {
      alert(t.modals.addRepo.scanFailedAlert);
    } finally {
      setIsScanning(false);
    }
  };

  const toggleSelectDiscovered = (path: string) => {
    const norm = normalizePath(path);
    setSelectedDiscovered((prev) =>
      prev.some((p) => normalizePath(p) === norm)
        ? prev.filter((p) => normalizePath(p) !== norm)
        : [...prev, path]
    );
  };

  const handleSelectAllDiscovered = () => {
    if (selectedDiscovered.length === discoveredRepos.length) {
      setSelectedDiscovered([]);
    } else {
      setSelectedDiscovered(discoveredRepos.map((r) => r.path));
    }
  };

  const handleAddDiscoveredSubmit = async () => {
    if (selectedDiscovered.length === 0) return;
    await addProjectsToWorkspace(selectedDiscovered);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center select-none font-sans">
      <div className="bg-theme-card border border-theme-border-card rounded-lg shadow-2xl w-[680px] max-w-[94vw] max-h-[85vh] flex flex-col text-xs text-theme-main overflow-hidden transition-colors">
        {/* Header */}
        <div className="px-4 py-3 border-b border-theme-border-subtle flex items-center justify-between bg-theme-subbar gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FolderPlus className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="font-semibold text-sm text-theme-main truncate" title={t.modals.addRepo.title}>
              {getDisplayTitle(t.modals.addRepo.title, isZh)}
            </span>
            <span className="px-2 py-0.5 rounded bg-theme-card text-theme-muted text-[10px] font-mono border border-theme-border-card shrink-0">
              {workspaceId}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-theme-dim hover:text-theme-main p-1 rounded transition cursor-pointer shrink-0"
            title={t.common.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs: Custom Folder Scan vs Scanned List vs Remote Clone */}
        <div className="px-4 border-b border-theme-border-subtle flex items-center gap-3 sm:gap-6 bg-theme-subbar text-[11px] overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            title={t.modals.addRepo.scanTabTitle}
            className={`py-2.5 px-1 border-b-2 font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 max-w-[220px] ${
              activeTab === 'custom'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-theme-dim hover:text-theme-main'
            }`}
          >
            <FolderSearch className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{getDisplayTitle(t.modals.addRepo.scanTabTitle, isZh)}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scanned')}
            title={t.modals.addRepo.localTabTitle(allScannedProjects.length)}
            className={`py-2.5 px-1 border-b-2 font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 max-w-[220px] ${
              activeTab === 'scanned'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-theme-dim hover:text-theme-main'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{getDisplayTitle(t.modals.addRepo.localTabTitle(allScannedProjects.length), isZh)}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clone')}
            title={t.modals.addRepo.remoteTabTitle}
            className={`py-2.5 px-1 border-b-2 font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 max-w-[220px] ${
              activeTab === 'clone'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-theme-dim hover:text-theme-main'
            }`}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{getDisplayTitle(t.modals.addRepo.remoteTabTitle, isZh)}</span>
          </button>
        </div>

        {/* Tab 2 Content: Scan Directory & Subfolders (Default) */}
        {activeTab === 'custom' && (
          <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
            <div>
              <label className="text-theme-muted text-[11px] mb-1 block">
                {t.modals.addRepo.targetDirLabel}
              </label>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 flex items-center">
                  <FolderOpen className="w-3.5 h-3.5 text-sky-400 absolute left-2.5 pointer-events-none" />
                  <input
                    value={folderInput}
                    onChange={(e) => setFolderInput(e.target.value)}
                    placeholder={t.modals.addRepo.targetDirPlaceholder}
                    className="w-full bg-theme-input border border-theme-border-card rounded pl-8 pr-2.5 py-1.5 text-xs text-theme-main placeholder-theme-dim focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectFolder(folderInput, setFolderInput)}
                  disabled={isBrowsing}
                  className="px-2.5 py-1.5 bg-theme-hover hover:bg-theme-card-hover border border-theme-border-card hover:border-sky-500/50 text-theme-main rounded transition cursor-pointer shrink-0 flex items-center gap-1.5 text-xs font-medium shadow-2xs"
                  title={t.modals.addRepo.selectFolderTooltip}
                >
                  {isBrowsing ? (
                    <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                  ) : (
                    <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                  )}
                  <span>{t.modals.addRepo.selectFolderBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={handleScanFolder}
                  disabled={isScanning || !folderInput.trim()}
                  title={isScanning ? t.modals.addRepo.scanningBtn : t.modals.addRepo.scanDirBtn}
                  className="px-3.5 py-1.5 bg-theme-accent hover:bg-theme-accent-hover text-white rounded font-medium transition cursor-pointer shrink-0 disabled:opacity-50 shadow-sm"
                >
                  {isScanning ? t.modals.addRepo.scanningBtn : getDisplayTitle(t.modals.addRepo.scanDirBtn, isZh)}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-theme-dim px-1">
              <span>{t.modals.addRepo.discoveredReposTitle(discoveredRepos.length)}</span>
              {discoveredRepos.length > 0 && (
                <button
                  onClick={handleSelectAllDiscovered}
                  title={selectedDiscovered.length === discoveredRepos.length ? t.modals.addRepo.deselectAll : t.modals.addRepo.selectAll}
                  className="text-sky-400 hover:underline cursor-pointer"
                >
                  {getDisplayTitle(selectedDiscovered.length === discoveredRepos.length ? t.modals.addRepo.deselectAll : t.modals.addRepo.selectAll, isZh)}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto border border-theme-border-card rounded bg-theme-input divide-y divide-theme-border-subtle max-h-[300px]">
              {discoveredRepos.length === 0 ? (
                <div className="p-6 text-center text-theme-dim">
                  {isScanning
                    ? t.modals.addRepo.scanningStatus
                    : t.modals.addRepo.scanPrompt}
                </div>
              ) : (
                discoveredRepos.map((repo) => {
                  const isAlreadyInWorkspace = workspaceProjectPaths.some((p) => normalizePath(p) === normalizePath(repo.path));
                  const isChecked = selectedDiscovered.some((p) => normalizePath(p) === normalizePath(repo.path));
                  return (
                    <div
                      key={repo.path}
                      onClick={() => toggleSelectDiscovered(repo.path)}
                      className={`px-3 py-2.5 flex items-center justify-between transition cursor-pointer ${
                        isChecked
                          ? 'bg-theme-active/85 text-white'
                          : 'hover:bg-theme-hover text-theme-main'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                        <div className="shrink-0 cursor-pointer">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-sky-400" />
                          ) : (
                            <Square className="w-4 h-4 text-theme-dim hover:text-theme-main" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-theme-main text-xs">{repo.name}</span>
                            <span
                              className="text-[10px] px-1.5 py-0.2 rounded bg-theme-card text-theme-dim font-mono"
                              title={repo.isRoot ? t.modals.addRepo.rootRepoBadge : t.modals.addRepo.submoduleBadge}
                            >
                              {getDisplayTitle(repo.isRoot ? t.modals.addRepo.rootRepoBadge : t.modals.addRepo.submoduleBadge, isZh)}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-theme-dim font-mono">
                              <GitBranch className="w-2.5 h-2.5 text-orange-400" />
                              {repo.currentBranch}
                            </span>
                          </div>
                          <div className="text-theme-dim text-[10px] font-mono truncate mt-0.5" title={repo.path}>
                            {repo.path}
                          </div>
                        </div>
                      </div>

                      {isAlreadyInWorkspace && (
                        <span
                          className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0"
                          title={t.modals.addRepo.inWorkspaceBadge}
                        >
                          {getDisplayTitle(t.modals.addRepo.inWorkspaceBadge, isZh)}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-theme-border-subtle">
              <span className="text-theme-dim text-[11px]">
                {t.modals.addRepo.foundRepos(discoveredRepos.length)}, {t.modals.addRepo.checkedToImport(selectedDiscovered.length)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 bg-theme-hover hover:bg-theme-border-card text-theme-main rounded cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  disabled={selectedDiscovered.length === 0}
                  onClick={handleAddDiscoveredSubmit}
                  className="px-3.5 py-1.5 bg-theme-accent hover:bg-theme-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium cursor-pointer shadow-sm"
                >
                  {t.modals.addRepo.importSelectedBtn(selectedDiscovered.length)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1 Content: Scanned List Picker */}
        {activeTab === 'scanned' && (
          <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-theme-dim absolute left-2.5 top-2.5" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.modals.addRepo.searchLocalPlaceholder}
                  className="w-full bg-theme-input border border-theme-border-card rounded pl-8 pr-3 py-1.5 text-xs text-theme-main placeholder-theme-dim focus:outline-none focus:border-sky-500"
                />
              </div>

              <button
                onClick={handleSelectAllScanned}
                title={selectedPaths.length === filteredScanned.length ? t.modals.addRepo.deselectAll : t.modals.addRepo.selectAll}
                className="px-2.5 py-1.5 bg-theme-hover hover:bg-theme-border-card text-theme-main rounded text-[11px] transition shrink-0 cursor-pointer"
              >
                {getDisplayTitle(selectedPaths.length === filteredScanned.length ? t.modals.addRepo.deselectAll : t.modals.addRepo.selectAll, isZh)}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border border-theme-border-card rounded bg-theme-input divide-y divide-theme-border-subtle max-h-[340px]">
              {filteredScanned.length === 0 ? (
                <div className="p-6 text-center text-theme-dim">{t.modals.addRepo.noLocalFound}</div>
              ) : (
                filteredScanned.map((proj) => {
                  const isChecked = selectedPaths.some((p) => normalizePath(p) === normalizePath(proj.path));
                  const isCurrentlyInWorkspace = workspaceProjectPaths.some((p) => normalizePath(p) === normalizePath(proj.path));
                  return (
                    <div
                      key={proj.path}
                      onClick={() => toggleSelectScanned(proj.path)}
                      className={`px-3 py-2 flex items-center justify-between transition cursor-pointer ${
                        isChecked
                          ? 'bg-theme-active/85 text-white'
                          : 'hover:bg-theme-hover text-theme-main'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        <div className="shrink-0 cursor-pointer">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-sky-400" />
                          ) : (
                            <Square className="w-4 h-4 text-theme-dim hover:text-theme-main" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-theme-main">{proj.name}</span>
                            <span className="flex items-center gap-1 text-[10px] text-theme-dim font-mono">
                              <GitBranch className="w-2.5 h-2.5 text-orange-400" />
                              {proj.currentBranch}
                            </span>
                          </div>
                          <div className="text-theme-dim text-[10px] font-mono truncate mt-0.5">
                            {proj.path}
                          </div>
                        </div>
                      </div>

                      {isCurrentlyInWorkspace && (
                        <span
                          className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0"
                          title={t.modals.addRepo.inWorkspaceBadge}
                        >
                          {getDisplayTitle(t.modals.addRepo.inWorkspaceBadge, isZh)}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-theme-border-subtle">
              <span className="text-theme-dim text-[11px]">
                {t.modals.addRepo.activeInWorkspaceSummary(selectedPaths.length)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 bg-theme-hover hover:bg-theme-border-card text-theme-main rounded cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={handleSaveScannedSubmit}
                  className="px-3.5 py-1.5 bg-theme-accent hover:bg-theme-accent-hover text-white rounded font-medium cursor-pointer shadow-sm"
                >
                  {t.modals.addRepo.applyToWorkspaceBtn(selectedPaths.length)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3 Content: Clone from Remote URL (新增远端克隆与拉取代码) */}
        {activeTab === 'clone' && (
          <AddRepoCloneSection
            defaultParent={defaultParent}
            isBrowsing={isBrowsing}
            handleSelectFolder={handleSelectFolder}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
