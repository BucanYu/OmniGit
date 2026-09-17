import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../locales';
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
  AlertCircle,
  Lock,
  Download,
} from 'lucide-react';

interface AddRepoModalProps {
  onClose: () => void;
}

function extractRepoNameFromUrl(url: string): string {
  const clean = url.trim().replace(/\.git\/?$/i, '').replace(/\/+$/, '');
  const lastSlash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'), clean.lastIndexOf(':'));
  if (lastSlash !== -1 && lastSlash < clean.length - 1) {
    return clean.slice(lastSlash + 1);
  }
  return '';
}

/**
 * In Chinese mode, shows concise Chinese text on the surface,
 * while hover (title attribute) displays the full information including English.
 */
function getDisplayTitle(fullText: string, isZh: boolean): string {
  if (!isZh || !fullText) return fullText;
  const match = fullText.match(/^(.+?)\s*\(([A-Za-z0-9_ &/:.-]+)\)$/);
  return match ? match[1].trim() : fullText;
}

export function AddRepoModal({ onClose }: AddRepoModalProps) {
  const { t, isZh } = useTranslation();
  const {
    projects,
    allScannedProjects,
    workspaceProjectPaths,
    addProjectsToWorkspace,
    setWorkspaceProjects,
    cloneAndImportRepo,
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

  // Tab 3 state: Clone from remote URL
  const [cloneUrl, setCloneUrl] = useState('');
  const defaultParent = projects[0]?.path
    ? projects[0].path.split(/[\\/]/).slice(0, -1).join('\\') || ''
    : '';
  const [targetParentDir, setTargetParentDir] = useState(defaultParent);
  const [folderName, setFolderName] = useState('');
  const [cloneBranch, setCloneBranch] = useState('');
  const [needAuth, setNeedAuth] = useState(false);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [cloneError, setCloneError] = useState('');

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

  const handleUrlChange = (val: string) => {
    setCloneUrl(val);
    setCloneError('');
    const extracted = extractRepoNameFromUrl(val);
    if (extracted && (!folderName || folderName === extractRepoNameFromUrl(cloneUrl))) {
      setFolderName(extracted);
    }
  };

  const fullDestinationPath = targetParentDir && folderName
    ? `${targetParentDir.replace(/[\\/]+$/, '')}\\${folderName}`
    : targetParentDir || '';

  const handleCloneSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cloneUrl.trim()) {
      setCloneError(t.modals.addRepo.urlRequired);
      return;
    }
    if (!targetParentDir.trim()) {
      setCloneError(t.modals.addRepo.dirRequired);
      return;
    }
    if (!folderName.trim()) {
      setCloneError(t.modals.addRepo.folderRequired);
      return;
    }

    setIsCloning(true);
    setCloneError('');

    const res = await cloneAndImportRepo({
      remoteUrl: cloneUrl.trim(),
      targetDir: targetParentDir.trim(),
      folderName: folderName.trim(),
      branch: cloneBranch.trim() || undefined,
      username: needAuth ? authUsername.trim() : undefined,
      password: needAuth ? authPassword.trim() : undefined,
    });

    setIsCloning(false);

    if (res.success) {
      onClose();
    } else {
      setCloneError(res.message || t.modals.addRepo.cloneFailed);
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
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
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
    setSelectedDiscovered((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
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
                  const isAlreadyInWorkspace = workspaceProjectPaths.includes(repo.path);
                  const isChecked = selectedDiscovered.includes(repo.path);
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
                  const isChecked = selectedPaths.includes(proj.path);
                  const isCurrentlyInWorkspace = workspaceProjectPaths.includes(proj.path);
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
          <form onSubmit={handleCloneSubmit} className="flex-1 overflow-y-auto flex flex-col p-4 gap-3.5">
            {/* 1. Remote Git Repository URL */}
            <div>
              <label className="text-theme-muted text-[11px] mb-1 font-medium flex items-center justify-between">
                <span>{t.modals.addRepo.remoteUrlLabel}</span>
                <span className="text-[10px] text-theme-dim">{t.modals.addRepo.protocolsHint}</span>
              </label>
              <div className="relative flex items-center">
                <Globe className="w-3.5 h-3.5 text-sky-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={cloneUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder={t.modals.addRepo.urlPlaceholder}
                  className="w-full bg-theme-input border border-theme-border-card rounded pl-8 pr-3 py-1.5 text-xs text-theme-main placeholder-theme-dim focus:outline-none focus:border-sky-500 font-mono"
                  autoFocus
                />
              </div>
            </div>

            {/* 2. Target Parent Directory and Folder Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="text-theme-muted text-[11px] mb-1 font-medium block">
                  {t.modals.addRepo.parentDirLabel}
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1 flex items-center">
                    <FolderOpen className="w-3.5 h-3.5 text-sky-400 absolute left-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={targetParentDir}
                      onChange={(e) => setTargetParentDir(e.target.value)}
                      placeholder="D:\projects"
                      className="w-full bg-theme-input border border-theme-border-card rounded pl-8 pr-2.5 py-1.5 text-xs text-theme-main placeholder-theme-dim focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectFolder(targetParentDir, setTargetParentDir)}
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
                </div>
              </div>

              <div>
                <label className="text-theme-muted text-[11px] mb-1 font-medium block">
                  {t.modals.addRepo.folderNameLabel}
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="my-project"
                  className="w-full bg-theme-input border border-theme-border-card rounded px-2.5 py-1.5 text-xs text-theme-main placeholder-theme-dim focus:outline-none focus:border-sky-500 font-mono font-semibold"
                />
              </div>
            </div>

            {/* 3. Destination Path Live Preview */}
            <div className="p-2.5 rounded bg-theme-input/60 border border-theme-border-subtle flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-theme-dim font-medium uppercase tracking-wider shrink-0">{t.modals.addRepo.targetPathLabel}</span>
                <span className="font-mono text-[11px] text-sky-400 truncate" title={fullDestinationPath}>
                  {fullDestinationPath || t.modals.addRepo.specifyDirPrompt}
                </span>
              </div>
            </div>

            {/* 4. Checkout Branch (Optional) */}
            <div>
              <label className="text-theme-muted text-[11px] mb-1 font-medium flex items-center justify-between">
                <span>{t.modals.addRepo.checkoutBranchLabel}</span>
                <span className="text-[10px] text-theme-dim">{t.modals.addRepo.defaultBranchHint}</span>
              </label>
              <div className="relative flex items-center">
                <GitBranch className="w-3.5 h-3.5 text-theme-dim absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={cloneBranch}
                  onChange={(e) => setCloneBranch(e.target.value)}
                  placeholder={t.modals.addRepo.checkoutBranchPlaceholder}
                  className="w-full bg-theme-input border border-theme-border-card rounded pl-8 pr-3 py-1.5 text-xs text-theme-main placeholder-theme-dim focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            </div>

            {/* 5. Optional Authentication Section */}
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-theme-muted hover:text-theme-main">
                <input
                  type="checkbox"
                  checked={needAuth}
                  onChange={(e) => setNeedAuth(e.target.checked)}
                  className="rounded border-theme-border text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-theme-dim" />
                  <span>{t.modals.addRepo.authRequiredLabel}</span>
                </span>
              </label>

              {needAuth && (
                <div className="mt-2 p-3 bg-theme-input/40 border border-theme-border-subtle rounded space-y-2 animate-in fade-in duration-100">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-theme-dim text-[10px] mb-0.5 block">{t.modals.addRepo.usernameLabel}</label>
                      <input
                        type="text"
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                        placeholder={t.modals.addRepo.usernamePlaceholder}
                        className="w-full bg-theme-input border border-theme-border-card rounded px-2.5 py-1 text-xs text-theme-main placeholder-theme-dim focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-theme-dim text-[10px] mb-0.5 block">{t.modals.addRepo.passwordLabel}</label>
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder={t.modals.addRepo.passwordPlaceholder}
                        className="w-full bg-theme-input border border-theme-border-card rounded px-2.5 py-1 text-xs text-theme-main placeholder-theme-dim focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-theme-dim leading-relaxed">
                    {t.modals.addRepo.credentialManagerHint}
                  </p>
                </div>
              )}
            </div>

            {/* Error Message Alert */}
            {cloneError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed flex-1">{cloneError}</span>
              </div>
            )}

            {/* Real-time Cloning Progress Banner */}
            {isCloning && (
              <div className="p-3 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs flex items-center gap-2.5 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-semibold">{t.modals.addRepo.cloningHeader}</span>
                  <span className="text-[10px] text-sky-300/80">{t.modals.addRepo.cloningDesc}</span>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-theme-border-subtle mt-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isCloning}
                className="px-3 py-1.5 bg-theme-hover hover:bg-theme-border-card text-theme-main rounded cursor-pointer transition disabled:opacity-50"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={isCloning || !cloneUrl.trim() || !folderName.trim() || !targetParentDir.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-theme-accent hover:bg-theme-accent-hover text-white rounded font-medium cursor-pointer transition disabled:opacity-50 shadow-sm"
              >
                {isCloning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t.modals.addRepo.cloningBtn}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.modals.addRepo.startCloneBtn}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
