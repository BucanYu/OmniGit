import * as fs from 'fs';
import * as path from 'path';
import { codeSearchService, type SearchCodeOptions, type SearchCodeMatch } from './codeSearchService';

export interface FileTreeNodeItem {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
  children?: FileTreeNodeItem[];
  isIgnored?: boolean;
}

// Only internal VCS database directories are skipped from tree rendering
// Project directories (e.g. node_modules, dist, build, .env, target, logs) are fully accessible!
const VCS_METADATA_DIRS = new Set([
  '.git',
  '.svn',
  '.hg',
]);

export class FileSystemService {
  private gitignoreCache = new Map<string, { mtime: number; rules: string[] }>();

  /**
   * Parse .gitignore rules into simple prefix/suffix filters (cached with mtime check)
   */
  public loadGitignoreRules(repoPath: string): string[] {
    const gitignorePath = path.join(repoPath, '.gitignore');
    if (!fs.existsSync(gitignorePath)) return [];
    try {
      const stat = fs.statSync(gitignorePath);
      const cached = this.gitignoreCache.get(repoPath);
      if (cached && cached.mtime === stat.mtimeMs) {
        return cached.rules;
      }
      const content = fs.readFileSync(gitignorePath, 'utf8');
      const rules = content
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
      this.gitignoreCache.set(repoPath, { mtime: stat.mtimeMs, rules });
      return rules;
    } catch {
      return [];
    }
  }

  /**
   * Check if a file or directory matches .gitignore rules.
   * This is used purely for visual indication (e.g. muted/opacity), NEVER for hard-excluding files.
   */
  public matchesGitignore(name: string, relativePath: string, rules: string[] = []): boolean {
    if (!rules || rules.length === 0) return false;
    const cleanRel = relativePath.replace(/\\/g, '/').toLowerCase();
    const cleanName = name.toLowerCase();

    for (const rawRule of rules) {
      let rule = rawRule.trim();
      if (!rule || rule.startsWith('#')) continue;

      rule = rule.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();

      // Wildcard patterns
      if (rule.startsWith('*.')) {
        const ext = rule.substring(1);
        if (cleanName.endsWith(ext) || cleanRel.endsWith(ext)) {
          return true;
        }
      } else if (rule.endsWith('*')) {
        const prefix = rule.slice(0, -1);
        if (cleanName.startsWith(prefix) || cleanRel.startsWith(prefix)) {
          return true;
        }
      } else if (rule === cleanName || cleanRel === rule || cleanRel.startsWith(rule + '/')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Backward compatibility alias for isIgnored
   */
  public isIgnored(name: string, relativePath: string, rules: string[] = []): boolean {
    if (VCS_METADATA_DIRS.has(name)) return true;
    return this.matchesGitignore(name, relativePath, rules);
  }

  /**
   * Lazy load directory children for a specific folder path (depth = 1).
   * Fully exposes all project files and directories without hard-excluding gitignored files.
   */
  public readDirectory(repoPath: string, subDir: string = ''): FileTreeNodeItem[] {
    const targetDir = subDir ? path.resolve(repoPath, subDir) : path.resolve(repoPath);

    // Security check: ensure targetDir is within or equals repoPath
    const resolvedRepo = path.resolve(repoPath);
    if (!targetDir.toLowerCase().startsWith(resolvedRepo.toLowerCase())) {
      throw new Error('Access denied: directory is outside repository root');
    }

    if (!fs.existsSync(targetDir)) {
      return [];
    }

    const rules = this.loadGitignoreRules(resolvedRepo);
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(targetDir, { withFileTypes: true });
    } catch {
      return [];
    }

    const items: FileTreeNodeItem[] = [];

    for (const entry of entries) {
      const name = entry.name;
      // Skip VCS internal database directories (e.g. .git)
      if (VCS_METADATA_DIRS.has(name)) {
        continue;
      }

      const fullPath = path.join(targetDir, name);
      const relPath = path.relative(resolvedRepo, fullPath).replace(/\\/g, '/');
      const isDir = entry.isDirectory();
      const extension = !isDir ? path.extname(name).toLowerCase() : '';
      const isIgnored = this.matchesGitignore(name, relPath, rules);

      items.push({
        name,
        path: fullPath,
        relativePath: relPath,
        isDirectory: isDir,
        extension,
        isIgnored,
      });
    }

    // Sort: directories first (alphabetical), then files (alphabetical)
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return items;
  }

  /**
   * Batch read multiple directory levels in a single fast local call.
   * Eliminates sequential network waterfall when expanding/locating nested paths.
   */
  public readDirectoryBatch(repoPath: string, subDirs: string[]): Record<string, FileTreeNodeItem[]> {
    const result: Record<string, FileTreeNodeItem[]> = {};
    const resolvedRepo = path.resolve(repoPath);
    if (!fs.existsSync(resolvedRepo)) {
      return result;
    }
    const rules = this.loadGitignoreRules(resolvedRepo);

    for (const subDir of subDirs) {
      const cleanSub = subDir ? subDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '';
      const targetDir = cleanSub ? path.resolve(resolvedRepo, cleanSub) : resolvedRepo;

      // Security check: ensure targetDir is within resolvedRepo (prevent path traversal)
      if (!targetDir.toLowerCase().startsWith(resolvedRepo.toLowerCase())) {
        continue;
      }
      if (!fs.existsSync(targetDir)) {
        result[cleanSub] = [];
        continue;
      }

      try {
        const entries = fs.readdirSync(targetDir, { withFileTypes: true });
        const items: FileTreeNodeItem[] = [];

        for (const entry of entries) {
          const name = entry.name;
          if (VCS_METADATA_DIRS.has(name)) {
            continue;
          }

          const fullPath = path.join(targetDir, name);
          const relPath = path.relative(resolvedRepo, fullPath).replace(/\\/g, '/');
          const isDir = entry.isDirectory();
          const extension = !isDir ? path.extname(name).toLowerCase() : '';
          const isIgnored = this.matchesGitignore(name, relPath, rules);

          items.push({
            name,
            path: fullPath,
            relativePath: relPath,
            isDirectory: isDir,
            extension,
            isIgnored,
          });
        }

        items.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });

        result[cleanSub] = items;
      } catch {
        result[cleanSub] = [];
      }
    }

    return result;
  }

  /**
   * Delegate code search to CodeSearchService
   */
  public searchCode(
    repoPath: string,
    query: string,
    options: SearchCodeOptions = {}
  ): SearchCodeMatch[] {
    return codeSearchService.searchCode(repoPath, query, options);
  }
}

export { type SearchCodeOptions, type SearchCodeMatch };
export const fileSystemService = new FileSystemService();
