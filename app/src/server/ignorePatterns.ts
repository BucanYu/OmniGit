import * as path from 'path';

/**
 * Multi-language universal directory blacklist (lowercased for case-insensitive matching).
 * Used by:
 * 1. `fs.watch` workspace watcher (prevents file event & Git spawn storms during builds/installs)
 * 2. `CodeSearchService` (prevents full-text search from hanging on build artifacts/virtualenvs)
 * 3. `scanProjects` workspace discovery (skips heavy non-repo directories)
 *
 * NOTE: Does NOT affect `WorkspaceExplorerPanel` manual tree browsing, where users can still
 * toggle the eye icon to inspect ignored directories on demand.
 */
export const UNIVERSAL_IGNORED_DIRS = new Set<string>([
  // VCS internal metadata
  '.git',
  '.svn',
  '.hg',
  '.bzr',

  // Node.js / Web / Frontend ecosystems
  'node_modules',
  'bower_components',
  'jspm_packages',
  '.pnpm-store',
  '.yarn',
  '.npm',
  '.next',
  '.nuxt',
  '.output',
  '.svelte-kit',
  '.astro',
  '.vite',
  '.parcel-cache',
  '.turbo',
  '.cache',
  '.docusaurus',
  '.vuepress',
  '.storybook-out',
  'storybook-static',
  'dist',
  'dist-ssr',
  'build',
  'out',
  'coverage',
  '.nyc_output',
  '.tmp_chrome_e2e',

  // Java / Kotlin / Scala / Groovy / JVM
  'target',
  '.gradle',
  '.mvn',
  '.kotlin',
  'classes',
  'test-output',
  '.apt_generated',
  '.apt_generated_tests',
  '.factorypath',
  '.settings',

  // Python / AI / Data Science
  'venv',
  '.venv',
  'env',
  '.env.virtualenv',
  'virtualenv',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.tox',
  '.nox',
  '.hypothesis',
  '.eggs',
  'pip-wheel-metadata',
  'htmlcov',
  '.ipynb_checkpoints',
  'cython_debug',
  '.pybuilder',
  'site-packages',
  'conda-meta',

  // Go / Rust
  'vendor',
  'pkg',

  // C / C++ / CMake / Embedded
  'cmake-build-debug',
  'cmake-build-release',
  'cmake-build-relwithdebinfo',
  'cmake-build-minsizerel',
  'cmakefiles',
  '_deps',
  'debug',
  'release',
  'x64',
  'x86',
  'arm64',
  '.pio',
  'ipch',

  // C# / .NET
  'bin',
  'obj',
  'packages',
  '.vs',
  'testresults',
  'benchmarkdotnet.artifacts',
  'artifacts',

  // PHP / Ruby / Elixir / Erlang
  '.bundle',
  '_build',
  'deps',
  '.elixir_ls',

  // Dart / Flutter / Mobile (Android / iOS / HarmonyOS)
  '.dart_tool',
  '.pub-cache',
  '.pub',
  'pods',
  'deriveddata',
  '.cxx',
  '.externalnativebuild',
  'oh_modules',
  '.hvigor',
  '.arkui-x',

  // DevOps / Infrastructure / IDEs / Logs / Temp
  '.terraform',
  '.terragrunt-cache',
  '.serverless',
  '.aws-sam',
  '.vagrant',
  '.idea',
  '.vscode',
  '.fleet',
  '.eclipse',
  '.history',
  'logs',
  'log',
  'temp',
  'tmp',
  '.temp',
  '.tmp',
]);

/**
 * Binary, compiled artifact, model weights, archive, and temporary file extensions (lowercased).
 */
export const UNIVERSAL_BINARY_AND_ARTIFACT_EXTS = new Set<string>([
  // Images / Media / Fonts / Archives / Docs
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svgz', '.bmp', '.tiff',
  '.pdf', '.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.rar',
  '.mp3', '.mp4', '.wav', '.ogg', '.flac', '.mov', '.avi', '.mkv', '.webm',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',

  // JVM compiled artifacts & heap dumps
  '.class', '.jar', '.war', '.ear', '.nar', '.hprof',

  // Python bytecode, wheels, AI model weights & binary datasets
  '.pyc', '.pyo', '.pyd', '.whl',
  '.pt', '.pth', '.onnx', '.safetensors', '.ckpt', '.h5', '.hdf5',
  '.pkl', '.pickle', '.parquet', '.feather', '.npy', '.npz',

  // Native / C / C++ / Rust / Go / .NET compiled binaries & symbols
  '.exe', '.dll', '.so', '.dylib', '.node', '.bin',
  '.o', '.obj', '.a', '.lib', '.pdb', '.ilk', '.exp', '.pch', '.idb', '.ipch', '.tlog',
  '.rlib', '.rmeta', '.test', '.prof',
  '.nupkg', '.snupkg', '.suo', '.user',

  // Mobile packages
  '.apk', '.aab', '.ipa', '.dex', '.ap_', '.hap',

  // Local databases, logs & editor swap/temp files
  '.sqlite', '.sqlite3', '.db', '.db-shm', '.db-wal',
  '.log', '.tmp', '.temp', '.swp', '.swo', '.bak', '.orig', '.lock',
]);

/**
 * Fast check whether a directory or segment name belongs to the multi-language ignored list.
 */
export function isUniversalIgnoredDirName(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  if (UNIVERSAL_IGNORED_DIRS.has(lower)) return true;
  if (
    lower.startsWith('cmake-build-') ||
    lower.endsWith('.egg-info') ||
    lower.endsWith('.dist-info') ||
    lower.endsWith('.xcworkspace') ||
    lower.endsWith('.xcuserdata')
  ) {
    return true;
  }
  return false;
}

/**
 * Check if a file extension is a binary or compiled build artifact.
 */
export function isBinaryOrArtifactFile(filename: string): boolean {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  if (lower === '.ds_store' || lower === 'thumbs.db' || lower.endsWith('~')) {
    return true;
  }
  const ext = path.extname(lower);
  return Boolean(ext && UNIVERSAL_BINARY_AND_ARTIFACT_EXTS.has(ext));
}

/**
 * Determine whether a `fs.watch` change notification should be ignored.
 * Combines:
 * 1. Git internal state filtering (only index/HEAD/refs/merge states trigger UI updates)
 * 2. Multi-language universal build/dependency/virtualenv directory & artifact filtering
 * 3. Optional repository `.gitignore` rule matcher
 */
export function shouldIgnoreWatchPath(
  relativeFilename: string,
  gitignoreMatcher?: (name: string, relPath: string) => boolean
): boolean {
  if (!relativeFilename) return true;
  const fn = relativeFilename.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!fn) return true;

  // 1. Special handling for .git internal changes
  if (fn === '.git' || fn.startsWith('.git/') || fn.includes('/.git/')) {
    const isSignificantGitChange =
      fn === '.git/index' ||
      fn.endsWith('/.git/index') ||
      fn === '.git/HEAD' ||
      fn.endsWith('/.git/HEAD') ||
      fn === '.git/MERGE_HEAD' ||
      fn.endsWith('/.git/MERGE_HEAD') ||
      fn === '.git/MERGE_MSG' ||
      fn.endsWith('/.git/MERGE_MSG') ||
      fn === '.git/ORIG_HEAD' ||
      fn.endsWith('/.git/ORIG_HEAD') ||
      fn === '.git/REBASE_HEAD' ||
      fn.endsWith('/.git/REBASE_HEAD') ||
      fn.startsWith('.git/refs/heads/') ||
      fn.includes('/.git/refs/heads/') ||
      fn.startsWith('.git/refs/remotes/') ||
      fn.includes('/.git/refs/remotes/');

    return !isSignificantGitChange;
  }

  // 2. Check every path segment against universal multi-language ignored directories
  const segments = fn.split('/');
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (isUniversalIgnoredDirName(seg)) {
      return true;
    }
  }

  // 3. Check basename against binary/compiled artifact/log/temp extensions
  const baseName = segments[segments.length - 1];
  if (isBinaryOrArtifactFile(baseName)) {
    return true;
  }

  // 4. Check repository's own .gitignore rules if provided
  if (gitignoreMatcher && gitignoreMatcher(baseName, fn)) {
    return true;
  }

  return false;
}
