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
  '.svn',
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

const DEFAULT_SEARCH_IGNORED_DIRS = new Set([
  ...DEFAULT_IGNORED_DIRS,
  'logs',
  'log',
  '.tmp_chrome_e2e',
]);

export class FileSystemService {
  private gitignoreCache = new Map<string, { mtime: number; rules: string[] }>();

  /**
   * Parse .gitignore rules into simple prefix/suffix filters (cached with mtime check)
   */
  private loadGitignoreRules(repoPath: string): string[] {
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
      const extension = !isDir ? path.extname(name).toLowerCase() : '';

      items.push({
        name,
        path: fullPath,
        relativePath: relPath,
        isDirectory: isDir,
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
          const fullPath = path.join(targetDir, name);
          const relPath = path.relative(resolvedRepo, fullPath).replace(/\\/g, '/');

          if (this.isIgnored(name, relPath, rules)) {
            continue;
          }

          const isDir = entry.isDirectory();
          const extension = !isDir ? path.extname(name).toLowerCase() : '';

          items.push({
            name,
            path: fullPath,
            relativePath: relPath,
            isDirectory: isDir,
            extension,
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
   * Search code text inside repository files with fast recursive scanner
   */
  public searchCode(
    repoPath: string,
    query: string,
    options: SearchCodeOptions = {}
  ): SearchCodeMatch[] {
    if (!query || !query.trim()) return [];

    const resolvedRepo = path.resolve(repoPath);
    if (!fs.existsSync(resolvedRepo)) return [];

    const maxResults = options.maxResults || 300;
    const rules = this.loadGitignoreRules(resolvedRepo);

    // Build Search Regular Expression
    let regex: RegExp;
    try {
      const flags = options.isCaseSensitive ? 'g' : 'gi';
      if (options.isRegex) {
        regex = new RegExp(query, flags);
      } else {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (options.isWholeWord) {
          regex = new RegExp(`\\b${escaped}\\b`, flags);
        } else {
          regex = new RegExp(escaped, flags);
        }
      }
    } catch {
      return [];
    }

    // Parse file extension/pattern filter (e.g. "*.java, *.ts, *.tsx")
    const patterns = (options.filePattern || '')
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);

    const matchPattern = (filename: string): boolean => {
      if (patterns.length === 0) return true;
      const lower = filename.toLowerCase();
      return patterns.some((pat) => {
        if (pat.startsWith('*.')) {
          return lower.endsWith(pat.substring(1));
        }
        if (pat.startsWith('.')) {
          return lower.endsWith(pat);
        }
        return lower.includes(pat);
      });
    };

    const matchFileName = (filename: string): boolean => {
      if (!matchPattern(filename)) return false;
      if (options.isRegex) {
        try {
          const r = new RegExp(query, options.isCaseSensitive ? '' : 'i');
          return r.test(filename);
        } catch {
          return false;
        }
      }
      if (options.isWholeWord) {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const r = new RegExp(`\\b${escaped}\\b`, options.isCaseSensitive ? '' : 'i');
        return r.test(filename);
      }
      if (options.isCaseSensitive) {
        return filename.includes(query);
      }
      return filename.toLowerCase().includes(query.toLowerCase());
    };

    const binaryExts = new Set([
      '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svgz',
      '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
      '.exe', '.dll', '.so', '.dylib', '.node', '.bin',
      '.jar', '.war', '.class', '.pyc',
      '.mp3', '.mp4', '.wav', '.mov', '.avi',
      '.woff', '.woff2', '.ttf', '.eot',
    ]);

    const results: SearchCodeMatch[] = [];

    const walk = (currentDir: string) => {
      if (results.length >= maxResults) return;

      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (results.length >= maxResults) break;
        const name = entry.name;
        const fullPath = path.join(currentDir, name);
        const relPath = path.relative(resolvedRepo, fullPath).replace(/\\/g, '/');

        if (this.isIgnored(name, relPath, rules) || DEFAULT_SEARCH_IGNORED_DIRS.has(name)) {
          continue;
        }

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          // Check if file name itself matches search query
          const isNameMatched = matchFileName(name);
          if (isNameMatched) {
            let mStart = 0;
            if (options.isCaseSensitive) {
              mStart = name.indexOf(query);
            } else {
              mStart = name.toLowerCase().indexOf(query.toLowerCase());
            }
            if (mStart < 0) mStart = 0;

            results.push({
              filePath: fullPath,
              relativePath: relPath,
              fileName: name,
              lineNumber: 1,
              lineContent: name,
              matchStart: mStart,
              matchLength: query.length,
              isFileNameMatch: true,
            });
          }

          const ext = path.extname(name).toLowerCase();
          if (binaryExts.has(ext) || !matchPattern(name)) {
            continue;
          }

          try {
            const stat = fs.statSync(fullPath);
            if (stat.size > 5 * 1024 * 1024) continue; // Skip files > 5MB

            const content = fs.readFileSync(fullPath, 'utf8');
            // Quick check if query is in file
            regex.lastIndex = 0;
            if (!regex.test(content)) continue;

            const lines = content.split(/\r?\n/);
            for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
              if (results.length >= maxResults) break;
              const line = lines[lineIdx];
              regex.lastIndex = 0;
              const execMatch = regex.exec(line);
              if (execMatch) {
                results.push({
                  filePath: fullPath,
                  relativePath: relPath,
                  fileName: name,
                  lineNumber: lineIdx + 1,
                  lineContent: line.slice(0, 300),
                  matchStart: execMatch.index,
                  matchLength: execMatch[0].length,
                });
              }
            }
          } catch {}
        }
      }
    };

    walk(resolvedRepo);
    return results;
  }
}

export interface SearchCodeOptions {
  isCaseSensitive?: boolean;
  isWholeWord?: boolean;
  isRegex?: boolean;
  filePattern?: string;
  maxResults?: number;
}

export interface SearchCodeMatch {
  filePath: string;
  relativePath: string;
  fileName: string;
  lineNumber: number;
  lineContent: string;
  matchStart?: number;
  matchLength?: number;
  isFileNameMatch?: boolean;
}

export const fileSystemService = new FileSystemService();
