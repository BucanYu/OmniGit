import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppStore, type WorkspaceGitAccount } from '../../store/useAppStore';
import {
  User,
  Users,
  Search,
  Check,
  ChevronDown,
  CheckSquare,
  Square,
  ArrowUp,
  RefreshCw,
  Plus,
  UserCheck,
  Lock,
  Globe,
  FolderGit2,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from '../../locales';

// Generates consistent pleasant colors for user avatar badges
function getAvatarBg(name: string) {
  const colors = [
    'bg-sky-600/30 text-sky-300 border-sky-500/40',
    'bg-violet-600/30 text-violet-300 border-violet-500/40',
    'bg-emerald-600/30 text-emerald-300 border-emerald-500/40',
    'bg-amber-600/30 text-amber-300 border-amber-500/40',
    'bg-rose-600/30 text-rose-300 border-rose-500/40',
    'bg-indigo-600/30 text-indigo-300 border-indigo-500/40',
    'bg-teal-600/30 text-teal-300 border-teal-500/40',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function UserAccountFilter() {
  const { t } = useTranslation();
  const {
    gitUser,
    workspaceAccounts,
    loadWorkspaceAccounts,
    selectedAuthorNames,
    toggleAuthorFilter,
    selectAllAuthors,
    clearAuthorFilter,
    switchActiveGitUser,
    addCustomGitAccount,
    projects,
    activeProjectId,
  } = useAppStore();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Custom Account Form States
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [customScope, setCustomScope] = useState<'project' | 'workspace' | 'global'>('project');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const currentProject = projects.find((p) => p.id === activeProjectId);

  // Active account for current project
  const activeAccount = useMemo(() => {
    return workspaceAccounts.find((a) => a.isCurrent) || workspaceAccounts[0];
  }, [workspaceAccounts]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter accounts according to search query across name, email, username, remoteHost, projectNames
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return workspaceAccounts;
    const q = searchQuery.toLowerCase();
    return workspaceAccounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.username && a.username.toLowerCase().includes(q)) ||
        (a.remoteHost && a.remoteHost.toLowerCase().includes(q)) ||
        a.projectNames.some((pn) => pn.toLowerCase().includes(q))
    );
  }, [workspaceAccounts, searchQuery]);

  // Determine primary user and display text according to user rule:
  // "多个用户的时候优先展示第一个用户"
  const primaryUserName = selectedAuthorNames.length > 0 ? selectedAuthorNames[0] : null;
  const extraCount = selectedAuthorNames.length > 1 ? selectedAuthorNames.length - 1 : 0;

  // Make an author the primary user (move to index 0 of selectedAuthorNames)
  const handleSetPrimary = (authorName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    useAppStore.setState((state) => {
      const rest = state.selectedAuthorNames.filter((n) => n !== authorName);
      return { selectedAuthorNames: [authorName, ...rest] };
    });
  };

  // Switch git user identity
  const handleSwitchUser = async (name: string, email: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsSubmitting(true);
    try {
      await switchActiveGitUser(name, email, false, false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit custom user identity
  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    setIsSubmitting(true);
    try {
      await addCustomGitAccount({
        name: customName.trim(),
        email: customEmail.trim(),
        username: customName.trim(),
        password: customPassword.trim() || undefined,
        scope: customScope,
      });
      setCustomName('');
      setCustomEmail('');
      setCustomPassword('');
      setShowCustomInput(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Refresh workspace accounts from all project git configs and credentials
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadWorkspaceAccounts();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Select only current user
  const handleSelectOnlyMe = () => {
    if (activeAccount?.name) {
      useAppStore.setState({ selectedAuthorNames: [activeAccount.name] });
    } else if (gitUser?.name) {
      useAppStore.setState({ selectedAuthorNames: [gitUser.name] });
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Capsule Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition cursor-pointer text-xs border select-none ${
          isOpen
            ? 'bg-theme-hover text-theme-main border-sky-500/60 shadow-xs'
            : 'bg-theme-card hover:bg-theme-card-hover text-theme-main border-theme-border-card shadow-xs'
        }`}
        title={
          selectedAuthorNames.length > 1
            ? t.userAccount.selectedHeaderTooltip(selectedAuthorNames.length, selectedAuthorNames.join(', '), primaryUserName)
            : primaryUserName
            ? t.userAccount.currentDisplayTooltip(primaryUserName)
            : t.userAccount.defaultTooltip
        }
      >
        {selectedAuthorNames.length > 1 ? (
          <Users className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        ) : (
          <User className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        )}

        {/* Primary Account Name */}
        <span className="font-semibold text-theme-main max-w-[120px] truncate text-[11px]">
          {primaryUserName || activeAccount?.name || gitUser?.name || 'Git Accounts'}
        </span>

        {/* Multiple Users Extra Count Badge */}
        {extraCount > 0 && (
          <span
            className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40 font-mono"
            title={t.userAccount.extraAccountsTooltip(extraCount, selectedAuthorNames.slice(1).join(', '))}
          >
            +{extraCount}
          </span>
        )}

        <ChevronDown
          className={`w-3 h-3 text-theme-dim transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-sky-400' : ''
          }`}
        />
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute right-0 top-9 z-50 w-[380px] theme-dropdown-panel rounded-lg text-xs text-theme-main select-none flex flex-col font-sans shadow-2xl border border-theme-border"
          style={{ maxHeight: 'calc(100vh - 70px)' }}
        >
          {/* 1. Header Section */}
          <div className="p-3 border-b border-theme-border flex items-center justify-between bg-theme-subbar rounded-t-lg">
            <div>
              <div className="font-semibold text-theme-main flex items-center gap-1.5 text-[12px]">
                <Users className="w-4 h-4 text-sky-400" />
                <span>{t.userAccount.workspaceAccountsTitle}</span>
              </div>
              <p className="text-[10px] text-theme-dim mt-0.5">
                {t.userAccount.workspaceAccountsSubtitle}
              </p>
            </div>

            {/* Refresh workspace accounts button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`p-1.5 text-theme-dim hover:text-sky-400 hover:bg-theme-hover rounded transition cursor-pointer ${
                isRefreshing ? 'animate-spin text-sky-400' : ''
              }`}
              title={t.userAccount.refreshAccountsTooltip}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 2. Active Committer Card (Current Project Active Git Identity) */}
          <div className="px-3 py-2.5 bg-sky-500/10 border-b border-theme-border flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden flex-1 mr-2">
              <div className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-[12px] shrink-0 border border-sky-500/30">
                {(activeAccount?.name || gitUser?.name || 'G').charAt(0).toUpperCase()}
              </div>
              <div className="truncate flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-theme-main truncate text-[12px]">
                    {activeAccount?.name || gitUser?.name || 'Git User'}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-0.5 shrink-0">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    <span>{t.userAccount.currentProjectBound}</span>
                  </span>
                </div>
                <div className="text-[10px] text-theme-dim truncate font-mono mt-0.5 flex items-center gap-1.5">
                  <span className="truncate">
                    {activeAccount?.username || activeAccount?.email || gitUser?.email}
                  </span>
                  {activeAccount?.remoteHost && (
                    <span className="px-1 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[9px] shrink-0 font-sans">
                      {activeAccount.remoteHost}
                    </span>
                  )}
                </div>
                {currentProject && (
                  <div className="text-[10px] text-theme-dim/80 truncate mt-0.5 flex items-center gap-1">
                    <FolderGit2 className="w-3 h-3 text-sky-400 shrink-0" />
                    <span className="truncate">{t.userAccount.currentProjectLabel(currentProject.name)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. Search Bar */}
          <div className="p-2 border-b border-theme-border">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-theme-input border border-theme-border rounded focus-within:border-sky-500 transition">
              <Search className="w-3.5 h-3.5 text-theme-dim shrink-0" />
              <input
                type="text"
                placeholder={t.userAccount.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-theme-main text-xs w-full placeholder:text-theme-dim"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-theme-dim hover:text-theme-main text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 4. Quick Actions Toolbar */}
          <div className="px-3 py-1.5 border-b border-theme-border flex items-center justify-between text-[11px] text-theme-dim bg-theme-subbar">
            <div className="flex items-center gap-1">
              <span>{t.userAccount.accountsListTitle}</span>
              <span className="font-semibold text-sky-400 font-mono">
                {filteredAccounts.length}
              </span>
              <span>{t.userAccount.accountsCountUnit}</span>
              {selectedAuthorNames.length > 0 && (
                <span className="text-[10px] text-theme-dim ml-1">
                  {t.userAccount.selectedFilterCount(selectedAuthorNames.length)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSelectOnlyMe}
                className="px-1.5 py-0.5 rounded hover:bg-theme-hover hover:text-theme-main text-theme-dim transition cursor-pointer text-[10px]"
                title={t.userAccount.selectCurrentOnlyTooltip}
              >
                {t.userAccount.selectCurrentOnly}
              </button>
              <span className="text-theme-border">|</span>
              <button
                onClick={selectAllAuthors}
                className="px-1.5 py-0.5 rounded hover:bg-theme-hover hover:text-theme-main text-theme-dim transition cursor-pointer text-[10px]"
              >
                {t.userAccount.selectAll}
              </button>
              <span className="text-theme-border">|</span>
              <button
                onClick={clearAuthorFilter}
                className="px-1.5 py-0.5 rounded hover:bg-theme-hover hover:text-theme-main text-theme-dim transition cursor-pointer text-[10px]"
              >
                {t.userAccount.clearAll}
              </button>
            </div>
          </div>

          {/* 5. Accounts List (Deduplicated Workspace Accounts) */}
          <div className="overflow-y-auto max-h-[280px] divide-y divide-theme-border/40 py-1">
            {filteredAccounts.length === 0 ? (
              <div className="p-4 text-center text-theme-dim text-xs">
                {t.userAccount.noAccountsFound}
              </div>
            ) : (
              filteredAccounts.map((account: WorkspaceGitAccount) => {
                const isChecked = selectedAuthorNames.includes(account.name);
                const isPrimary = selectedAuthorNames[0] === account.name;
                const isCurrentProjectAccount = account.isCurrent;

                return (
                  <div
                    key={account.id}
                    onClick={() => toggleAuthorFilter(account.name)}
                    className={`group flex items-center justify-between px-3 py-2 hover:bg-theme-hover/80 cursor-pointer transition ${
                      isChecked ? 'bg-theme-hover/40' : ''
                    }`}
                  >
                    {/* Left: Checkbox + Avatar + Account Info */}
                    <div className="flex items-center gap-2.5 overflow-hidden flex-1 mr-2">
                      {/* Checkbox for Git Log Filtering */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAuthorFilter(account.name);
                        }}
                        className="text-theme-dim hover:text-theme-main transition cursor-pointer shrink-0"
                        title={t.userAccount.checkboxFilterTooltip}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-sky-400" />
                        ) : (
                          <Square className="w-4 h-4 text-theme-dim group-hover:text-theme-main" />
                        )}
                      </button>

                      {/* Avatar */}
                      <div
                        className={`w-6 h-6 rounded-full border flex items-center justify-center font-bold text-[10px] shrink-0 ${getAvatarBg(
                          account.name
                        )}`}
                      >
                        {account.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Text */}
                      <div className="truncate flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`truncate font-semibold text-[11px] ${
                              isChecked ? 'text-theme-main font-bold' : 'text-theme-muted'
                            }`}
                          >
                            {account.name}
                          </span>

                          {/* Primary Display Tag */}
                          {isPrimary && (
                            <span
                              className="px-1 py-0.2 rounded text-[9px] bg-sky-500/20 text-sky-400 border border-sky-500/40 font-bold"
                              title={t.userAccount.preferredTooltip}
                            >
                              {t.userAccount.preferredBadge}
                            </span>
                          )}

                          {/* Current Git Committer Tag */}
                          {isCurrentProjectAccount && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-medium">
                              {t.userAccount.currentProjectInUse}
                            </span>
                          )}

                          {/* Remote Host Tag */}
                          {account.remoteHost && (
                            <span className="px-1 py-0.2 rounded text-[9px] bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono">
                              {account.remoteHost}
                            </span>
                          )}
                        </div>

                        {/* Account username / email */}
                        <div className="flex items-center gap-1.5 text-[10px] text-theme-dim font-mono truncate mt-0.5">
                          <span className="truncate">
                            {account.username || account.email}
                          </span>
                          {account.email && account.email !== account.username && (
                            <span className="truncate text-theme-dim/70">
                              · {account.email}
                            </span>
                          )}
                          {account.hasPassword && (
                            <span className="text-emerald-400 shrink-0" title={t.userAccount.credentialSavedTooltip}>
                              {t.userAccount.credentialSaved}
                            </span>
                          )}
                        </div>

                        {/* Project Association (Shows which project uses this account) */}
                        {account.projectNames.length > 0 ? (
                          <div
                            className="flex items-center gap-1 text-[10px] text-sky-400/90 font-medium truncate mt-0.5"
                            title={t.userAccount.appliedProjectsTooltip(account.projectNames.join(', '))}
                          >
                            <FolderGit2 className="w-2.5 h-2.5 shrink-0 text-sky-400" />
                            <span className="truncate">
                              {t.userAccount.appliedToLabel(account.projectNames.join(', '))}
                            </span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-theme-dim/70 truncate mt-0.5">
                            {t.userAccount.systemCredentialDesc}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Set as Primary Button (if checked but not primary) */}
                      {isChecked && !isPrimary && (
                        <button
                          type="button"
                          onClick={(e) => handleSetPrimary(account.name, e)}
                          className="px-1.5 py-0.5 rounded text-[10px] text-theme-dim hover:text-sky-400 hover:bg-sky-500/10 transition cursor-pointer border border-transparent hover:border-sky-500/30 flex items-center gap-0.5"
                          title={t.userAccount.pinTopTooltip}
                        >
                          <ArrowUp className="w-3 h-3" />
                          <span>{t.userAccount.pinTop}</span>
                        </button>
                      )}

                      {/* Switch Committer Identity Button */}
                      {!isCurrentProjectAccount && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={(e) => handleSwitchUser(account.name, account.email, e)}
                          className="px-2 py-0.5 rounded text-[10px] bg-theme-subbar hover:bg-sky-500/20 text-theme-dim hover:text-sky-400 border border-theme-border hover:border-sky-500/40 transition cursor-pointer flex items-center gap-1 font-medium"
                          title={t.userAccount.switchIdentityTooltip(currentProject?.name || '', account.name, account.email)}
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>{t.userAccount.switchIdentity}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 6. Footer: Custom Account Switcher / Creator */}
          <div className="p-2.5 border-t border-theme-border bg-theme-subbar rounded-b-lg">
            {!showCustomInput ? (
              <button
                onClick={() => setShowCustomInput(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-theme-dim hover:text-theme-main text-[11px] rounded hover:bg-theme-hover transition cursor-pointer border border-dashed border-theme-border font-medium"
              >
                <Plus className="w-3.5 h-3.5 text-sky-400" />
                <span>{t.userAccount.customAddBtn}</span>
              </button>
            ) : (
              <form onSubmit={handleCustomSubmit} className="space-y-2 p-1">
                <div className="text-[11px] font-semibold text-theme-main flex items-center justify-between">
                  <span>{t.userAccount.customAddTitle}</span>
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(false)}
                    className="text-theme-dim hover:text-theme-main text-[10px]"
                  >
                    ✕ {t.common.cancel}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div>
                    <input
                      type="text"
                      placeholder={t.userAccount.customNamePlaceholder}
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      required
                      className="w-full px-2 py-1 bg-theme-input border border-theme-border rounded text-xs text-theme-main outline-none focus:border-sky-500 placeholder:text-theme-dim"
                    />
                  </div>

                  <div>
                    <input
                      type="email"
                      placeholder={t.userAccount.customEmailPlaceholder}
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      required
                      className="w-full px-2 py-1 bg-theme-input border border-theme-border rounded text-xs text-theme-main outline-none focus:border-sky-500 placeholder:text-theme-dim"
                    />
                  </div>

                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t.userAccount.customPasswordPlaceholder}
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      className="w-full px-2 py-1 pr-8 bg-theme-input border border-theme-border rounded text-xs text-theme-main outline-none focus:border-sky-500 placeholder:text-theme-dim"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 text-theme-dim hover:text-theme-main p-0.5"
                      title={showPassword ? t.userAccount.hidePassword : t.userAccount.showPassword}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Scope Selection */}
                  <div className="pt-1 text-[10px] text-theme-dim space-y-1">
                    <span className="font-semibold text-theme-main">{t.userAccount.scopeTitle}</span>
                    <div className="flex flex-col gap-1 pl-1">
                      <label className="flex items-center gap-1.5 cursor-pointer hover:text-theme-main">
                        <input
                          type="radio"
                          name="scope"
                          value="project"
                          checked={customScope === 'project'}
                          onChange={() => setCustomScope('project')}
                          className="cursor-pointer text-sky-500"
                        />
                        <span>{t.userAccount.applyToCurrentProject(currentProject?.name || t.common.none)}</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer hover:text-theme-main">
                        <input
                          type="radio"
                          name="scope"
                          value="workspace"
                          checked={customScope === 'workspace'}
                          onChange={() => setCustomScope('workspace')}
                          className="cursor-pointer text-sky-500"
                        />
                        <span>{t.userAccount.applyToWorkspace(projects.length)}</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer hover:text-theme-main">
                        <input
                          type="radio"
                          name="scope"
                          value="global"
                          checked={customScope === 'global'}
                          onChange={() => setCustomScope('global')}
                          className="cursor-pointer text-sky-500"
                        />
                        <span>{t.userAccount.applyToGlobal}</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-1.5 pt-1.5">
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(false)}
                    className="px-2.5 py-1 rounded text-[11px] text-theme-dim hover:text-theme-main hover:bg-theme-hover transition cursor-pointer"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-3 py-1 rounded text-[11px] bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? t.userAccount.saving : t.userAccount.saveAndApply}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
