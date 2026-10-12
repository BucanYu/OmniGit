import * as fs from 'fs';
import * as path from 'path';

export interface FileTreeNodeItem {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
  children?: FileTreeNodeItem[];
}

const DEFAULT_IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-electron',
  'build',
  'release',
  '.idea',
  '.vscode',
  'target',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  '.output',
  'coverage',
]);

export class FileSystemService {
  /**
   * Parse .gitignore rules into simple prefix/suffix filters
   */
  private loadGitignoreRules(repoPath: string): string[] {
    const gitignorePath = path.join(repoPath, '.gitignore');
    if (!fs.existsSync(gitignorePath)) return [];
    try {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      return content
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
    } catch {
      return [];
    }
  }

  /**
   * Check if a file or directory name should be ignored
   */
  public isIgnored(name: string, relativePath: string, rules: string[] = []): boolean {
    if (DEFAULT_IGNORED_DIRS.has(name)) {
      return true;
    }
    // Check custom rules
    const cleanRel = relativePath.replace(/\\/g, '/');
    for (const rule of rules) {
      const cleanRule = rule.replace(/^\/+/, '').replace(/\/+$/, '');
      if (cleanRule === name || cleanRel === cleanRule || cleanRel.startsWith(cleanRule + '/')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Lazy load directory children for a specific folder path (depth = 1)
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
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const items: FileTreeNodeItem[] = [];

    for (const entry of entries) {
      const name = entry.name;
      const fullPath = path.join(targetDir, name);
      const relPath = path.relative(resolvedRepo, fullPath).replace(/\\/g, '/');

      if (this.isIgnored(name, relPath, rules)) {
        continue;
      }

      const isDir = entry.isDirectory();
      let size = 0;
      let extension = '';

      if (!isDir) {
        extension = path.extname(name).toLowerCase();
        try {
          const stat = fs.statSync(fullPath);
          size = stat.size;
        } catch {}
      }

      items.push({
        name,
        path: fullPath,
        relativePath: relPath,
        isDirectory: isDir,
        size,
        extension,
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
}

export const fileSystemService = new FileSystemService();
