import React, { useState, useEffect } from 'react';
import { useAppStore, normalizePath } from '../../store/useAppStore';
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
  Terminal,
  ChevronDown,
  ChevronUp,
  Ban,
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
  const [activeCloneId, setActiveCloneId] = useState<string | null>(null);
  const [isAborting, setIsAborting] = useState(false);
  const [showCloneLogs, setShowCloneLogs] = useState(true);
  const [cloneLogs, setCloneLogs] = useState<string[]>([]);
  const [cloneProgress, setCloneProgress] = useState<{
    phase: string;
    phaseText: string;
    percent: number;
    stagePercent?: number;
    transferred?: string;
    speed?: string;
    objects?: string;
  }>({
    phase: 'counting',
    phaseText: '',
    percent: 0,
  });

  const logsEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showCloneLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [cloneLogs, showCloneLogs]);

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

    const fullTargetDir = `${targetParentDir.replace(/[\\/]+$/, '')}\\${folderName.trim()}`;
    const cloneId = `clone_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    setIsCloning(true);
    setIsAborting(false);
    setActiveCloneId(cloneId);
    setCloneError('');
    setCloneLogs([]);
    setCloneProgress({
      phase: 'counting',
      phaseText: t.modals.addRepo.phaseCounting,
      percent: 2,
      stagePercent: 0,
    });

    try {
      const response = await fetch('/api/git/clone-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remoteUrl: cloneUrl.trim(),
          targetDir: fullTargetDir,
          branch: cloneBranch.trim() || undefined,
          username: needAuth ? authUsername.trim() : undefined,
          password: needAuth ? authPassword.trim() : undefined,
          cloneId,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const evt of events) {
          const trimmedEvt = evt.trim();
          if (!trimmedEvt) continue;
          const dataLine = trimmedEvt.split('\n').find((l) => l.startsWith('data: '));
          if (!dataLine) continue;

          try {
            const data = JSON.parse(dataLine.slice(6));
            if (data.type === 'progress') {
              let pText = data.phaseText;
              if (data.phase === 'counting') pText = t.modals.addRepo.phaseCounting;
              else if (data.phase === 'compressing') pText = t.modals.addRepo.phaseCompressing;
              else if (data.phase === 'receiving') pText = t.modals.addRepo.phaseReceiving;
              else if (data.phase === 'resolving') pText = t.modals.addRepo.phaseResolving;
              else if (data.phase === 'checkout') pText = t.modals.addRepo.phaseCheckout;
              else if (data.phase === 'completing') pText = t.modals.addRepo.phaseCompleting;

              setCloneProgress({
                phase: data.phase,
                phaseText: pText,
                percent: data.percent,
                stagePercent: data.stagePercent,
                transferred: data.transferred,
                speed: data.speed,
                objects: data.objects,
              });
            } else if (data.type === 'log') {
              setCloneLogs((prev) => {
                const next = [...prev, data.line];
                return next.length > 200 ? next.slice(-200) : next;
              });
            } else if (data.type === 'complete') {
              setCloneProgress((prev) => ({
                ...prev,
                percent: 100,
                phase: 'completing',
                phaseText: t.modals.addRepo.phaseCompleting,
              }));

              const repoPath = data.repoPath || fullTargetDir;
              await addProjectsToWorkspace([repoPath]);
              const created = projects.find((p) => p.path.toLowerCase() === repoPath.toLowerCase());
              if (created) {
                setActiveProject(created.id);
              }

              setTimeout(() => {
                setIsCloning(false);
                setActiveCloneId(null);
                onClose();
              }, 700);
              return;
            } else if (data.type === 'error') {
              setCloneError(data.message || t.modals.addRepo.cloneFailed);
              setIsCloning(false);
              setActiveCloneId(null);
              return;
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setCloneError(err.message || t.modals.addRepo.cloneFailed);
      setIsCloning(false);
      setActiveCloneId(null);
    }
  };

  const handleAbortClone = async () => {
    if (!activeCloneId || isAborting) return;
    if (!window.confirm(t.modals.addRepo.abortConfirm)) return;

    setIsAborting(true);
    try {
      await fetch('/api/git/clone-abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloneId: activeCloneId }),
      });
      setCloneError(t.modals.addRepo.abortedNotice);
    } catch {
      // ignore
    } finally {
      setIsAborting(false);
      setIsCloning(false);
      setActiveCloneId(null);
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
                <div className="flex-1 space-y-1">
                  <div className="leading-relaxed font-medium">{cloneError}</div>
                  {cloneError.includes('目标文件夹已存在') && (
                    <div className="text-[11px] text-rose-300/80 leading-normal">
                      {t.modals.addRepo.existingDirNotice}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Real-time Cloning Progress Dashboard */}
            {isCloning && (
              <div className="p-3.5 rounded-lg bg-theme-input/90 border border-sky-500/40 shadow-inner space-y-3">
                {/* Header info */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <RefreshCw className="w-4 h-4 animate-spin text-sky-400 shrink-0" />
                    <span className="font-semibold text-xs text-theme-main truncate">
                      {cloneProgress.phaseText || t.modals.addRepo.cloningHeader}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sm text-sky-400 bg-sky-500/15 px-2 py-0.5 rounded border border-sky-500/30 shrink-0">
                    {cloneProgress.percent}%
                  </span>
                </div>

                {/* Animated Progress Bar */}
                <div className="w-full bg-zinc-800/80 rounded-full h-2.5 overflow-hidden border border-zinc-700/50 relative">
                  <div
                    className="bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500 h-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(3, Math.min(100, cloneProgress.percent))}%` }}
                  />
                </div>

                {/* Metrics Badges */}
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <div className="p-1.5 rounded bg-theme-card/60 border border-theme-border-subtle flex flex-col">
                    <span className="text-[10px] text-theme-dim">{t.modals.addRepo.speedLabel}</span>
                    <span className="text-sky-400 font-semibold truncate">
                      {cloneProgress.speed ? `⚡ ${cloneProgress.speed}` : '⚡ 测速中...'}
                    </span>
                  </div>
                  <div className="p-1.5 rounded bg-theme-card/60 border border-theme-border-subtle flex flex-col">
                    <span className="text-[10px] text-theme-dim">{t.modals.addRepo.transferredLabel}</span>
                    <span className="text-emerald-400 font-semibold truncate">
                      {cloneProgress.transferred ? `📦 ${cloneProgress.transferred}` : '📦 计算中...'}
                    </span>
                  </div>
                  <div className="p-1.5 rounded bg-theme-card/60 border border-theme-border-subtle flex flex-col">
                    <span className="text-[10px] text-theme-dim">{t.modals.addRepo.objectsLabel}</span>
                    <span className="text-purple-400 font-semibold truncate">
                      {cloneProgress.objects ? `🔢 ${cloneProgress.objects}` : '🔢 连接中...'}
                    </span>
                  </div>
                </div>

                {/* Toggleable Git Terminal Log Panel */}
                <div className="border border-theme-border-subtle rounded overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowCloneLogs((v) => !v)}
                    className="w-full px-2.5 py-1 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-[10px] font-mono flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Terminal className="w-3 h-3 text-emerald-400" />
                      <span>{showCloneLogs ? t.modals.addRepo.logsToggleHide : t.modals.addRepo.logsToggleShow}</span>
                      <span className="text-zinc-500">({cloneLogs.length} lines)</span>
                    </span>
                    {showCloneLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showCloneLogs && (
                    <div className="bg-zinc-950 p-2 text-[10px] font-mono text-zinc-300 max-h-36 overflow-y-auto space-y-0.5 select-text border-t border-zinc-800">
                      {cloneLogs.length === 0 ? (
                        <div className="text-zinc-600 italic">Git process initiated, awaiting output...</div>
                      ) : (
                        cloneLogs.map((line, idx) => (
                          <div key={idx} className="whitespace-pre-wrap break-all leading-tight text-emerald-400/90">
                            {line}
                          </div>
                        ))
                      )}
                      <div ref={logsEndRef} />
                    </div>
                  )}
                </div>

                {/* Abort Button while cloning */}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAbortClone}
                    disabled={isAborting}
                    className="px-3 py-1 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-300 rounded text-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isAborting ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>{t.modals.addRepo.abortingBtn}</span>
                      </>
                    ) : (
                      <>
                        <Ban className="w-3 h-3" />
                        <span>{t.modals.addRepo.abortBtn}</span>
                      </>
                    )}
                  </button>
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
