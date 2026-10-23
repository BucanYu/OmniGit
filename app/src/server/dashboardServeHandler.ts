import type { IncomingMessage, ServerResponse } from 'http';
import * as path from 'path';
import * as fs from 'fs';

// 记录各工作空间已挂载的静态根目录（内存安全映射）
const dashboardMountRoots = new Map<string, string>();

export function registerDashboardMount(workspaceId: string, rootDir: string) {
  if (workspaceId && rootDir) {
    dashboardMountRoots.set(workspaceId, path.resolve(rootDir));
  }
}

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
};

// 严禁静态服务访问的高危系统与凭据文件黑名单
const BLOCKED_FILE_PATTERNS = [
  /[\\/]\.git[\\/]config$/i,
  /[\\/]\.env(\.[a-z0-9_-]+)?$/i,
  /[\\/]\.ssh[\\/]/i,
  /[\\/]id_[a-z0-9_]+$/i,
  /[\\/]windows[\\/]system32/i,
];

function isOriginAllowed(req: IncomingMessage): boolean {
  const origin = req.headers.origin || req.headers.referer || '';
  if (!origin) return true; // Electron 本地内部请求或无 Origin 访问
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    // 仅允许回环地址、localhost 或本地端口，严禁公网域名跨域嗅探
    return host === '127.0.0.1' || host === 'localhost' || host === '::1';
  } catch {
    return false;
  }
}

/**
 * 处理工作空间静态页面挂载与 SPA 资源安全代理
 * 路由模式：/api/workspace/dashboard-serve/:workspaceId/*
 */
export async function handleDashboardServeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  urlObj: URL
): Promise<boolean> {
  const pathname = urlObj.pathname;

  // 1. 挂载注册接口 POST /api/workspace/dashboard-mount
  if (pathname === '/api/workspace/dashboard-mount') {
    if (!isOriginAllowed(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: Untrusted Origin' }));
      return true;
    }
    let bodyStr = '';
    req.on('data', (chunk) => {
      bodyStr += chunk;
    });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyStr || '{}');
        const { workspaceId, targetDir } = body;
        if (!workspaceId || !targetDir) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing workspaceId or targetDir' }));
          return;
        }
        const resolved = path.resolve(targetDir);
        if (!fs.existsSync(resolved)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Target directory not found' }));
          return;
        }
        registerDashboardMount(workspaceId, resolved);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, workspaceId, mountedDir: resolved }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err?.message || 'Server error' }));
      }
    });
    return true;
  }

  // 2. 静态资源路由 /api/workspace/dashboard-serve/:workspaceId/*
  if (!pathname.startsWith('/api/workspace/dashboard-serve')) {
    return false;
  }

  // 安全检查：拦截外部公网域名的 CSRF / 探针请求
  if (!isOriginAllowed(req)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden: Cross-origin request denied by OmniGit security fence.');
    return true;
  }

  const prefix = '/api/workspace/dashboard-serve/';
  let subRoute = pathname.slice(prefix.length); // e.g. "ws_123/assets/app.js"
  if (!subRoute && pathname === '/api/workspace/dashboard-serve') {
    subRoute = '';
  }

  // 解析 workspaceId 与相对文件路径
  const slashIndex = subRoute.indexOf('/');
  const workspaceId = slashIndex > -1 ? subRoute.slice(0, slashIndex) : subRoute;
  let relativeFilePath = slashIndex > -1 ? subRoute.slice(slashIndex + 1) : '';
  try {
    relativeFilePath = decodeURIComponent(relativeFilePath);
  } catch {}

  // 允许通过 ?root= 参数显式声明或覆盖挂载点
  const queryRoot = urlObj.searchParams.get('root') || urlObj.searchParams.get('targetDir');
  if (queryRoot && workspaceId) {
    registerDashboardMount(workspaceId, queryRoot);
  }

  const mountedRoot = dashboardMountRoots.get(workspaceId);
  if (!mountedRoot || !fs.existsSync(mountedRoot)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`404 Not Found: Workspace dashboard static root not mounted for [${workspaceId}].`);
    return true;
  }

  // 若未指定相对路径或为目录，默认定位至 index.html
  if (!relativeFilePath || relativeFilePath === '/') {
    relativeFilePath = 'index.html';
  }

  // 安全核心防护：绝对路径防穿越校验
  const targetFullPath = path.resolve(mountedRoot, relativeFilePath);
  const normalizedRoot = path.resolve(mountedRoot);

  if (!targetFullPath.startsWith(normalizedRoot + path.sep) && targetFullPath !== normalizedRoot) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden: Path traversal outside workspace boundary is blocked.');
    return true;
  }

  // 安全核心防护：黑名单文件拦截
  for (const pattern of BLOCKED_FILE_PATTERNS) {
    if (pattern.test(targetFullPath)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden: Access to sensitive system or credential file is blocked.');
      return true;
    }
  }

  // SPA History Fallback 支持：若文件不存在且无后缀，回退至 index.html
  let finalPath = targetFullPath;
  if (!fs.existsSync(finalPath)) {
    const ext = path.extname(finalPath);
    if (!ext) {
      const fallbackIndex = path.join(normalizedRoot, 'index.html');
      if (fs.existsSync(fallbackIndex)) {
        finalPath = fallbackIndex;
      }
    }
  }

  if (!fs.existsSync(finalPath) || fs.statSync(finalPath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`404 Not Found: File [${relativeFilePath}] does not exist.`);
    return true;
  }

  const ext = path.extname(finalPath).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';

  // 当返回 HTML 产物时，自动注入 <base> 标签以彻底锁定 SPA 相对资源解析
  if (ext === '.html' || ext === '.htm') {
    try {
      let htmlContent = fs.readFileSync(finalPath, 'utf-8');
      const baseTag = `<base href="/api/workspace/dashboard-serve/${encodeURIComponent(workspaceId)}/">`;

      if (!htmlContent.includes('<base ')) {
        if (htmlContent.includes('<head>')) {
          htmlContent = htmlContent.replace('<head>', `<head>\n  ${baseTag}`);
        } else if (htmlContent.includes('<HEAD>')) {
          htmlContent = htmlContent.replace('<HEAD>', `<HEAD>\n  ${baseTag}`);
        } else {
          htmlContent = `${baseTag}\n${htmlContent}`;
        }
      }

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(htmlContent);
      return true;
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`500 Internal Error: ${err?.message}`);
      return true;
    }
  }

  // 其余静态文件流式传输
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(finalPath).pipe(res);
  return true;
}
