import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Whitelist of allowed built-in document names to strictly prevent path traversal
const ALLOWED_BUILTIN_DOCS = new Set([
  'CUSTOM_DASHBOARD_GUIDE.md',
  'README.md',
  'README.en.md',
  'CHANGELOG.md',
]);

/**
 * Dynamically resolves the absolute path of built-in application documentation across
 * different platforms (Windows, macOS, Linux), execution modes (Vite Dev Server, Electron
 * unpackaged dev, standalone release package, installed in Program Files / AppData).
 */
export function resolveBuiltinDocPath(rawName?: string): {
  filePath: string;
  repoPath: string;
  relativePath: string;
  exists: boolean;
} | null {
  const sanitizedName = (rawName || 'CUSTOM_DASHBOARD_GUIDE.md').trim().replace(/^[\\/]+/, '');
  const baseName = path.basename(sanitizedName);

  if (!ALLOWED_BUILTIN_DOCS.has(baseName)) {
    return null;
  }

  // Candidate directories across packaging layouts and environments
  const resourcesPath = (process as any).resourcesPath || '';
  const candidates: string[] = [
    // 1. Packaged Electron runtime (resources/app/docs or resources/app/dist/docs)
    path.join(resourcesPath, 'app', 'docs', baseName),
    path.join(resourcesPath, 'app', 'dist', 'docs', baseName),

    // 2. Relative to server file location (src/server or dist-electron)
    path.resolve(__dirname, '../../../docs', baseName),
    path.resolve(__dirname, '../../docs', baseName),
    path.resolve(__dirname, '../public/docs', baseName),
    path.resolve(__dirname, '../../public/docs', baseName),
    path.resolve(__dirname, '../../dist/docs', baseName),

    // 3. Relative to process.cwd()
    path.resolve(process.cwd(), 'docs', baseName),
    path.resolve(process.cwd(), '../docs', baseName),
    path.resolve(process.cwd(), 'app/public/docs', baseName),
    path.resolve(process.cwd(), 'app/dist/docs', baseName),
    path.resolve(process.cwd(), 'public/docs', baseName),
    path.resolve(process.cwd(), 'dist/docs', baseName),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      const resolved = path.resolve(candidate);
      const parentDir = path.dirname(resolved);
      const grandParentDir = path.dirname(parentDir);
      return {
        filePath: resolved,
        repoPath: grandParentDir,
        relativePath: `docs/${baseName}`,
        exists: true,
      };
    }
  }

  // 4. Fail-safe fallback: generate guaranteed cache file in temp directory
  try {
    const fallbackDir = path.join(os.tmpdir(), 'omnigit-builtin-docs');
    fs.mkdirSync(fallbackDir, { recursive: true });
    const fallbackFile = path.join(fallbackDir, baseName);
    if (!fs.existsSync(fallbackFile)) {
      const header = `# OmniGit ${baseName}\n\n`;
      fs.writeFileSync(fallbackFile, header, 'utf8');
    }
    return {
      filePath: fallbackFile,
      repoPath: fallbackDir,
      relativePath: baseName,
      exists: true,
    };
  } catch {
    return null;
  }
}

/**
 * Handles /api/app/builtin-doc?name=... requests.
 */
export function handleBuiltinDocRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  query: Record<string, any>
): boolean {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const docName = (query.name as string) || 'CUSTOM_DASHBOARD_GUIDE.md';
  const resolved = resolveBuiltinDocPath(docName);

  if (!resolved) {
    res.statusCode = 400;
    res.end(JSON.stringify({ success: false, error: 'Invalid or disallowed doc name' }));
    return true;
  }

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      success: true,
      name: path.basename(resolved.filePath),
      filePath: resolved.filePath.replace(/\\/g, '/'),
      repoPath: resolved.repoPath.replace(/\\/g, '/'),
      relativePath: resolved.relativePath.replace(/\\/g, '/'),
      repoName: 'OmniGit',
    })
  );
  return true;
}
