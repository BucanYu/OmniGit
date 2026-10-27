import type { TreeNodeData, JsonValueType, FormatStats } from '../types';

/**
 * Format bytes to human readable format
 */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Sort keys of an object recursively
 */
function sortObjectKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc: Record<string, any>, key) => {
        acc[key] = sortObjectKeys(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}

/**
 * Format / Beautify JSON string
 */
export function formatJson(
  raw: string,
  indent = 2,
  sortKeys = false
): { formatted: string; parsed: any; error?: string } {
  if (!raw.trim()) return { formatted: '', parsed: null };
  try {
    let parsed = JSON.parse(raw);
    if (sortKeys) {
      parsed = sortObjectKeys(parsed);
    }
    const formatted = JSON.stringify(parsed, null, indent);
    return { formatted, parsed };
  } catch (err: any) {
    return { formatted: raw, parsed: null, error: err.message || 'JSON Parse Error' };
  }
}

/**
 * Minify JSON string to single-line compact
 */
export function minifyJson(raw: string): { minified: string; error?: string } {
  if (!raw.trim()) return { minified: '' };
  try {
    const parsed = JSON.parse(raw);
    return { minified: JSON.stringify(parsed) };
  } catch (err: any) {
    return { minified: raw, error: err.message || 'JSON Parse Error' };
  }
}

/**
 * Intelligent JSON repair for common syntax mistakes:
 * 1. Single quotes to double quotes
 * 2. Unquoted object keys (e.g. { name: "test" } -> { "name": "test" })
 * 3. Trailing commas before } or ]
 */
export function repairJson(raw: string): { repaired: string; success: boolean } {
  if (!raw.trim()) return { repaired: '', success: false };
  try {
    // Already valid
    JSON.parse(raw);
    return { repaired: raw, success: true };
  } catch {}

  let s = raw;
  // 1. Replace single-quoted strings with double quotes
  s = s.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, (_, inner) => {
    return `"${inner.replace(/"/g, '\\"')}"`;
  });

  // 2. Wrap unquoted keys in double quotes
  s = s.replace(/([{,]\s*)([a-zA-Z0-9_$-]+)(\s*:)/g, '$1"$2"$3');

  // 3. Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');

  try {
    const parsed = JSON.parse(s);
    return { repaired: JSON.stringify(parsed, null, 2), success: true };
  } catch {
    return { repaired: s, success: false };
  }
}

/**
 * Compute detailed structural statistics
 */
export function calcJsonStats(raw: string): FormatStats {
  const charCount = raw.length;
  const lineCount = raw ? raw.split('\n').length : 0;
  const byteSize = formatByteSize(new Blob([raw]).size);

  if (!raw.trim()) {
    return { charCount: 0, lineCount: 0, byteSize: '0 B', isValid: true };
  }

  try {
    const parsed = JSON.parse(raw);
    const minified = JSON.stringify(parsed);
    const minSize = new Blob([minified]).size;
    const rawSize = new Blob([raw]).size;
    const diff = rawSize - minSize;
    const reduction = rawSize > 0 && diff > 0 ? `${((diff / rawSize) * 100).toFixed(1)}%` : '0%';

    let maxDepth = 1;
    let keyCount = 0;
    let arrayCount = 0;

    function walk(node: any, currentDepth: number) {
      if (currentDepth > maxDepth) maxDepth = currentDepth;
      if (Array.isArray(node)) {
        arrayCount++;
        for (const item of node) {
          walk(item, currentDepth + 1);
        }
      } else if (node !== null && typeof node === 'object') {
        const keys = Object.keys(node);
        keyCount += keys.length;
        for (const k of keys) {
          walk(node[k], currentDepth + 1);
        }
      }
    }

    walk(parsed, 1);

    return {
      charCount,
      lineCount,
      byteSize,
      minifiedSize: formatByteSize(minSize),
      reductionPercentage: reduction,
      depth: maxDepth,
      keyCount,
      arrayCount,
      isValid: true,
    };
  } catch (err: any) {
    // Try to extract line and column from error message
    let errorLine: number | undefined;
    let errorColumn: number | undefined;
    const match = /line (\d+) column (\d+)/i.exec(err.message) || /position (\d+)/i.exec(err.message);
    if (match) {
      if (match[2]) {
        errorLine = parseInt(match[1], 10);
        errorColumn = parseInt(match[2], 10);
      } else if (match[1]) {
        const pos = parseInt(match[1], 10);
        const prefix = raw.slice(0, pos);
        const lines = prefix.split('\n');
        errorLine = lines.length;
        errorColumn = lines[lines.length - 1].length + 1;
      }
    }

    return {
      charCount,
      lineCount,
      byteSize,
      isValid: false,
      errorMessage: err.message,
      errorLine,
      errorColumn,
    };
  }
}

/**
 * Basic stats for non-JSON formats (yaml/xml/sql) — no JSON validation.
 */
export function calcTextStats(raw: string): FormatStats {
  const charCount = raw.length;
  const lineCount = raw ? raw.split('\n').length : 0;
  const byteSize = formatByteSize(new Blob([raw]).size);

  if (!raw.trim()) {
    return { charCount: 0, lineCount: 0, byteSize: '0 B', isValid: true };
  }

  return { charCount, lineCount, byteSize, isValid: true };
}

/**
 * Build interactive Tree AST from parsed object
 */
export function buildJsonTree(
  data: any,
  key = 'root',
  path = '$',
  depth = 0
): TreeNodeData {
  const type: JsonValueType = Array.isArray(data)
    ? 'array'
    : data === null
    ? 'null'
    : (typeof data as JsonValueType);

  const node: TreeNodeData = {
    id: `${path}_${key}_${depth}`,
    key,
    value: data,
    type,
    path,
    depth,
  };

  if (type === 'array') {
    node.count = data.length;
    node.children = data.map((item: any, idx: number) =>
      buildJsonTree(item, `[${idx}]`, `${path}[${idx}]`, depth + 1)
    );
  } else if (type === 'object') {
    const keys = Object.keys(data);
    node.count = keys.length;
    node.children = keys.map((k) =>
      buildJsonTree(data[k], k, `${path}.${k}`, depth + 1)
    );
  }

  return node;
}
