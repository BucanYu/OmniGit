/**
 * Pure client-side URL & Query String Parser & Formatter
 */

export function parseUrlQuery(input: string): { formattedJson: string; parsed: any; error?: string } {
  const clean = input.trim();
  if (!clean) return { formattedJson: '', parsed: null };

  try {
    let queryPart = clean;
    let origin = '';
    let pathname = '';

    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      try {
        const u = new URL(clean);
        origin = u.origin;
        pathname = u.pathname;
        queryPart = u.search.startsWith('?') ? u.search.slice(1) : u.search;
      } catch {}
    } else if (clean.includes('?')) {
      const parts = clean.split('?');
      pathname = parts[0];
      queryPart = parts.slice(1).join('?');
    }

    const params: Record<string, string | string[]> = {};
    if (queryPart) {
      const pairs = queryPart.split('&');
      for (const pair of pairs) {
        if (!pair) continue;
        const [k, v] = pair.split('=');
        const key = decodeURIComponent((k || '').replace(/\+/g, ' '));
        const val = decodeURIComponent((v || '').replace(/\+/g, ' '));
        if (key in params) {
          if (Array.isArray(params[key])) {
            (params[key] as string[]).push(val);
          } else {
            params[key] = [params[key] as string, val];
          }
        } else {
          params[key] = val;
        }
      }
    }

    const result = {
      ...(origin ? { origin } : {}),
      ...(pathname ? { pathname } : {}),
      params,
    };

    return {
      formattedJson: JSON.stringify(result, null, 2),
      parsed: result,
    };
  } catch (err: any) {
    return {
      formattedJson: clean,
      parsed: null,
      error: err.message || 'URL Parse Error',
    };
  }
}

export function encodeUrlParams(input: string): string {
  try {
    // If input is JSON
    const parsed = JSON.parse(input);
    const params = parsed.params || parsed;
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) {
        for (const item of v) {
          parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`);
        }
      } else {
        parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
      }
    }
    return parts.join('&');
  } catch {
    return encodeURIComponent(input);
  }
}
