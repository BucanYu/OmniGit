import type { DataFormat, FormatStats, TreeNodeData } from './types';
import {
  calcJsonStats,
  calcTextStats,
  buildJsonTree,
} from './formatters/jsonFormatter';
import { parseYamlObject } from './formatters/yamlFormatter';
import { parseJwt } from './formatters/jwtFormatter';
import { parseUrlQuery } from './formatters/urlFormatter';
import { decodeBase64 } from './formatters/base64Formatter';

export function calcStatsFor(content: string, format: DataFormat): FormatStats {
  return format === 'json' ? calcJsonStats(content) : calcTextStats(content);
}

export function tryParseJsonDoc(content: string): any | null {
  const t = content.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return null;
  try {
    const v = JSON.parse(t);
    return v !== null && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

export function analyzeContent(
  content: string,
  format: DataFormat
): { parsed: any; tree: TreeNodeData | null; stats: FormatStats } {
  let parsed: any = null;
  let tree: TreeNodeData | null = null;

  if (format === 'jwt' || format === 'url') {
    const jsonView = tryParseJsonDoc(content);
    if (jsonView) {
      return { parsed: jsonView, tree: buildJsonTree(jsonView), stats: calcJsonStats(content) };
    }
  }

  if (format === 'json') {
    try {
      parsed = JSON.parse(content);
      tree = buildJsonTree(parsed);
    } catch {}
  } else if (format === 'jwt') {
    const jwt = parseJwt(content);
    if (jwt.payload) {
      parsed = { header: jwt.header, payload: jwt.payload };
      tree = buildJsonTree(parsed);
    }
  } else if (format === 'url') {
    const u = parseUrlQuery(content);
    if (u.parsed) {
      parsed = u.parsed;
      tree = buildJsonTree(u.parsed);
    }
  } else if (format === 'yaml') {
    const y = parseYamlObject(content);
    if (y !== null && typeof y === 'object') {
      parsed = y;
      tree = buildJsonTree(y);
    }
  } else if (format === 'base64') {
    const info = decodeBase64(content);
    if (info.valid) {
      const PREVIEW_LIMIT = 2000;
      const preview =
        info.text === null
          ? null
          : info.text.length > PREVIEW_LIMIT
            ? `${info.text.slice(0, PREVIEW_LIMIT)}…`
            : info.text;
      parsed = {
        valid: true,
        decodedBytes: info.byteLength,
        decodedType: info.binary ? 'binary' : 'text',
        decodedText: preview,
      };
      tree = buildJsonTree(parsed);
    }
  }

  return { parsed, tree, stats: calcStatsFor(content, format) };
}
