import * as fs from 'fs';
import * as path from 'path';
import type { OmniGitSettings } from './gitTypes';
import { decodeGitPath } from '../utils/gitPathUtils';

function getConfigFile(): string {
  const candidate1 = path.resolve(process.cwd(), '.omnigit_config.json');
  const candidate2 = path.resolve(process.cwd(), '..', '.omnigit_config.json');
  if (fs.existsSync(candidate2)) return candidate2;
  if (fs.existsSync(candidate1)) return candidate1;
  return candidate2;
}

export function loadSettings(): OmniGitSettings {
  const configFile = getConfigFile();
  const defaultDir = 'D:\\OmniGitCache';
  try {
    if (fs.existsSync(configFile)) {
      const raw = fs.readFileSync(configFile, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        cacheDir: parsed.cacheDir || defaultDir,
        maxCacheRepos: parsed.maxCacheRepos || 30,
        cacheTTL: parsed.cacheTTL || 15000,
      };
    }
  } catch (err) {
    console.warn('[gitSnapshotService] Failed to read settings config:', err);
  }
  return {
    cacheDir: defaultDir,
    maxCacheRepos: 30,
    cacheTTL: 15000,
  };
}

export function saveSettings(settings: OmniGitSettings): void {
  const configFile = getConfigFile();
  try {
    fs.writeFileSync(configFile, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('[gitSnapshotService] Failed to write settings config:', err);
  }
}

export function getRepoSnapshotPath(cacheDir: string, repoPath: string): string {
  const clean = repoPath.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_').slice(-60);
  const hash = Buffer.from(repoPath.toLowerCase()).toString('base64').replace(/[/+=]/g, '').slice(0, 16);
  const snapshotsDir = path.join(cacheDir, 'snapshots');
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true });
  }
  return path.join(snapshotsDir, `${clean}_${hash}.json`);
}

export const gitSnapshotService = {
  getSettingsInfo(): { settings: OmniGitSettings; cacheSize: number; repoCount: number } {
    const settings = loadSettings();
    const snapshotsDir = path.join(settings.cacheDir, 'snapshots');
    let cacheSize = 0;
    let repoCount = 0;
    try {
      if (fs.existsSync(snapshotsDir)) {
        const files = fs.readdirSync(snapshotsDir);
        for (const f of files) {
          if (f.endsWith('.json')) {
            repoCount++;
            const stat = fs.statSync(path.join(snapshotsDir, f));
            cacheSize += stat.size;
          }
        }
      }
    } catch {}
    return {
      settings,
      cacheSize,
      repoCount,
    };
  },

  async updateSettings(
    newSettings: Partial<OmniGitSettings>,
    migrateData = false
  ): Promise<{ settings: OmniGitSettings; cacheSize: number; repoCount: number }> {
    const current = loadSettings();
    const oldDir = current.cacheDir;
    const updated: OmniGitSettings = {
      ...current,
      ...newSettings,
    };

    const newSnapshotsDir = path.join(updated.cacheDir, 'snapshots');
    if (!fs.existsSync(newSnapshotsDir)) {
      fs.mkdirSync(newSnapshotsDir, { recursive: true });
    }

    if (migrateData && oldDir.toLowerCase() !== updated.cacheDir.toLowerCase()) {
      const oldSnapshotsDir = path.join(oldDir, 'snapshots');
      if (fs.existsSync(oldSnapshotsDir)) {
        try {
          const files = fs.readdirSync(oldSnapshotsDir);
          for (const f of files) {
            if (f.endsWith('.json')) {
              const src = path.join(oldSnapshotsDir, f);
              const dest = path.join(newSnapshotsDir, f);
              fs.copyFileSync(src, dest);
            }
          }
        } catch (e) {
          console.warn('[gitSnapshotService] Migration partial error:', e);
        }
      }
    }

    saveSettings(updated);
    return this.getSettingsInfo();
  },

  async clearCache(): Promise<{ success: boolean; clearedCount: number }> {
    const settings = loadSettings();
    const snapshotsDir = path.join(settings.cacheDir, 'snapshots');
    let clearedCount = 0;
    if (fs.existsSync(snapshotsDir)) {
      try {
        const files = fs.readdirSync(snapshotsDir);
        for (const f of files) {
          if (f.endsWith('.json')) {
            try {
              fs.unlinkSync(path.join(snapshotsDir, f));
              clearedCount++;
            } catch {}
          }
        }
      } catch {}
    }
    return { success: true, clearedCount };
  },

  getDiskSnapshots(): Record<string, any> {
    const settings = loadSettings();
    const snapshotsDir = path.join(settings.cacheDir, 'snapshots');
    const result: Record<string, any> = {};
    if (!fs.existsSync(snapshotsDir)) return result;

    try {
      const files = fs.readdirSync(snapshotsDir);
      for (const f of files) {
        if (f.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(path.join(snapshotsDir, f), 'utf8');
            const data = JSON.parse(raw);
            if (data && data.repoPath) {
              result[data.repoPath.toLowerCase()] = data;
            }
          } catch {}
        }
      }
    } catch {}
    return result;
  },

  saveDiskSnapshot(repoPath: string, snapshot: any): boolean {
    if (!repoPath) return false;
    try {
      const settings = loadSettings();
      const filePath = getRepoSnapshotPath(settings.cacheDir, repoPath);

      // STRICT LIGHTWEIGHT FILTER: Absolutely NO file content or Monaco Diff text!
      const safeSnapshot = {
        repoPath,
        currentBranch: snapshot.currentBranch || 'main',
        upstream: snapshot.upstream,
        incoming: Number(snapshot.incoming) || 0,
        outgoing: Number(snapshot.outgoing) || 0,
        branches: (snapshot.branches || []).map((b: any) => ({
          name: b.name,
          isCurrent: Boolean(b.isCurrent),
          isFavorite: Boolean(b.isFavorite),
          upstream: b.upstream,
          incoming: Number(b.incoming) || 0,
          outgoing: Number(b.outgoing) || 0,
        })),
        files: (snapshot.files || [])
          .filter((f: any) => f.status !== 'conflict')
          .map((f: any) => ({
            path: decodeGitPath(f.path || '').replace(/\\/g, '/'),
            status: f.status,
            staged: Boolean(f.staged),
            oldPath: f.oldPath ? decodeGitPath(f.oldPath).replace(/\\/g, '/') : undefined,
          })),
        selectedFilePath: snapshot.selectedFilePath || null,
        commitMessage: snapshot.commitMessage || '',
        commitHistory: (snapshot.commitHistory || []).slice(0, 30),
        commitLogs: (snapshot.commitLogs || []).slice(0, 200).map((c: any) => ({
          hash: c.hash,
          shortHash: c.shortHash,
          subject: c.subject || c.message || '',
          message: c.message || c.subject || '',
          authorName: c.authorName || '',
          authorEmail: c.authorEmail || '',
          date: c.date || '',
          refs: c.refs || '',
        })),
        isMerging: false,
        mergeMessage: '',
        mergeSourceBranch: undefined,
        conflictedCount: 0,
        lastUpdated: Date.now(),
      };

      fs.writeFileSync(filePath, JSON.stringify(safeSnapshot, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('[gitSnapshotService] Failed to save disk snapshot:', e);
      return false;
    }
  },

  getSingleDiskSnapshot(repoPath: string): any | null {
    if (!repoPath) return null;
    try {
      const settings = loadSettings();
      const filePath = getRepoSnapshotPath(settings.cacheDir, repoPath);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.files)) {
          parsed.files = parsed.files.map((f: any) => ({
            ...f,
            path: decodeGitPath(f.path || '').replace(/\\/g, '/'),
            oldPath: f.oldPath ? decodeGitPath(f.oldPath).replace(/\\/g, '/') : undefined,
          }));
        }
        return parsed;
      }
    } catch (e) {
      console.error('[gitSnapshotService] Failed to read single disk snapshot:', e);
    }
    return null;
  },

  saveWorkspacesBackup(data: {
    savedWorkspaces?: any[];
    recentProjects?: any[];
    workspaceProjectPaths?: Record<string, string[]>;
  }): boolean {
    try {
      const settings = loadSettings();
      if (!fs.existsSync(settings.cacheDir)) {
        fs.mkdirSync(settings.cacheDir, { recursive: true });
      }
      const backupPath = path.join(settings.cacheDir, 'workspaces_backup.json');
      let existing: any = {};
      if (fs.existsSync(backupPath)) {
        try {
          existing = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        } catch {}
      }

      const rawSaved =
        data.savedWorkspaces && data.savedWorkspaces.length > 0
          ? data.savedWorkspaces
          : existing.savedWorkspaces || [];
      const sanitizedSaved = Array.isArray(rawSaved)
        ? rawSaved.filter((w: any) => w && w.id && w.id !== 'default')
        : [];

      const rawPaths =
        data.workspaceProjectPaths && Object.keys(data.workspaceProjectPaths).length > 0
          ? { ...(existing.workspaceProjectPaths || {}), ...data.workspaceProjectPaths }
          : existing.workspaceProjectPaths || {};
      const sanitizedPaths: Record<string, string[]> = {};
      for (const [wsId, paths] of Object.entries(rawPaths)) {
        if (wsId && wsId !== 'default' && Array.isArray(paths) && paths.length > 0) {
          sanitizedPaths[wsId] = paths;
        }
      }

      const merged = {
        savedWorkspaces: sanitizedSaved,
        recentProjects:
          data.recentProjects && data.recentProjects.length > 0
            ? data.recentProjects
            : existing.recentProjects || [],
        workspaceProjectPaths: sanitizedPaths,
        lastBackup: Date.now(),
      };

      fs.writeFileSync(backupPath, JSON.stringify(merged, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('[gitSnapshotService] Failed to save workspaces backup:', e);
      return false;
    }
  },

  getWorkspacesBackup(): {
    savedWorkspaces: any[];
    recentProjects: any[];
    workspaceProjectPaths: Record<string, string[]>;
  } {
    try {
      const settings = loadSettings();
      const backupPath = path.join(settings.cacheDir, 'workspaces_backup.json');
      if (fs.existsSync(backupPath)) {
        const raw = fs.readFileSync(backupPath, 'utf8');
        const parsed = JSON.parse(raw);
        const rawSaved = Array.isArray(parsed.savedWorkspaces) ? parsed.savedWorkspaces : [];
        const sanitizedSaved = rawSaved.filter((w: any) => w && w.id && w.id !== 'default');
        const rawPaths =
          parsed.workspaceProjectPaths && typeof parsed.workspaceProjectPaths === 'object'
            ? parsed.workspaceProjectPaths
            : {};
        const sanitizedPaths: Record<string, string[]> = {};
        for (const [wsId, paths] of Object.entries(rawPaths)) {
          if (wsId && wsId !== 'default' && Array.isArray(paths) && paths.length > 0) {
            sanitizedPaths[wsId] = paths;
          }
        }

        // Auto-reconcile: If workspaceProjectPaths has workspace IDs missing from savedWorkspaces, synthesize them!
        const savedIds = new Set(sanitizedSaved.map((w: any) => w.id));
        for (const [wsId, paths] of Object.entries(sanitizedPaths)) {
          if (!savedIds.has(wsId)) {
            const firstRepo = paths[0] || '';
            const norm = firstRepo.replace(/\\/g, '/');
            const name = paths.length > 1
              ? `${norm.split('/').filter(Boolean).pop() || 'Workspace'} 等 ${paths.length} 个项目`
              : norm.split('/').filter(Boolean).pop() || 'Workspace';
            sanitizedSaved.push({
              id: wsId,
              name,
              rootPath: path.dirname(firstRepo),
              repos: paths.map((p: string) => {
                const pNorm = p.replace(/\\/g, '/');
                return {
                  name: pNorm.split('/').filter(Boolean).pop() || 'repo',
                  path: p,
                  branch: 'main',
                };
              }),
              lastOpened: Date.now(),
              badgeColor: 'bg-sky-600/90 text-white',
            });
            savedIds.add(wsId);
          }
        }

        return {
          savedWorkspaces: sanitizedSaved,
          recentProjects: Array.isArray(parsed.recentProjects) ? parsed.recentProjects : [],
          workspaceProjectPaths: sanitizedPaths,
        };
      }
    } catch (e) {
      console.error('[gitSnapshotService] Failed to read workspaces backup:', e);
    }
    return { savedWorkspaces: [], recentProjects: [], workspaceProjectPaths: {} };
  },

  // 48. Services Disk Backup (Dual-tier persistence guarantee across reboots, port changes & ID shifts)
  saveServicesBackup(data: { servicesByProject?: Record<string, any[]> }): boolean {
    try {
      const settings = loadSettings();
      if (!fs.existsSync(settings.cacheDir)) {
        fs.mkdirSync(settings.cacheDir, { recursive: true });
      }
      const backupPath = path.join(settings.cacheDir, 'services_backup.json');
      let existing: Record<string, any[]> = {};
      if (fs.existsSync(backupPath)) {
        try {
          existing = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        } catch {}
      }
      const merged = { ...existing, ...(data.servicesByProject || {}) };
      fs.writeFileSync(backupPath, JSON.stringify(merged, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('[gitSnapshotService] Failed to save services backup:', e);
      return false;
    }
  },

  getServicesBackup(): Record<string, any[]> {
    try {
      const settings = loadSettings();
      const backupPath = path.join(settings.cacheDir, 'services_backup.json');
      if (fs.existsSync(backupPath)) {
        const raw = fs.readFileSync(backupPath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('[gitSnapshotService] Failed to read services backup:', e);
    }
    return {};
  },
};
