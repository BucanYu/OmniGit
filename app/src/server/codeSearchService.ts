import * as fs from 'fs';
import * as path from 'path';

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

// VCS and heavy cache directories to skip during recursive search to avoid lockups
const SEARCH_SKIP_DIRS = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  '.output',
  'coverage',
  '.tmp_chrome_e2e',
]);

const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svgz',
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.node', '.bin',
  '.jar', '.war', '.class', '.pyc',
  '.mp3', '.mp4', '.wav', '.mov', '.avi',
  '.woff', '.woff2', '.ttf', '.eot',
]);

export class CodeSearchService {
  /**
   * Fast recursive search inside repository files.
   * Does NOT hard-exclude user configuration or code files like .env or scripts.
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

        // Skip internal VCS and dependency heavy caches
        if (SEARCH_SKIP_DIRS.has(name)) {
          continue;
        }

        const fullPath = path.join(currentDir, name);
        const relPath = path.relative(resolvedRepo, fullPath).replace(/\\/g, '/');

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
          if (BINARY_EXTS.has(ext) || !matchPattern(name)) {
            continue;
          }

          try {
            const stat = fs.statSync(fullPath);
            if (stat.size > 5 * 1024 * 1024) continue; // Skip files > 5MB

            const content = fs.readFileSync(fullPath, 'utf8');
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

export const codeSearchService = new CodeSearchService();
