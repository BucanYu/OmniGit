/**
 * Pure client-side YAML Formatter & Converter (Zero eval, Zero external deps)
 */

export function jsonToYaml(obj: any, indent = 2, currentIndent = 0): string {
  const pad = ' '.repeat(currentIndent);
  const childPad = ' '.repeat(currentIndent + indent);

  if (obj === null) return 'null';
  if (typeof obj === 'boolean' || typeof obj === 'number') return String(obj);
  if (typeof obj === 'string') {
    if (obj.includes('\n')) {
      const lines = obj.split('\n').map((l) => `${childPad}${l}`).join('\n');
      return `|\n${lines}`;
    }
    if (/[:#\[\]{},&*?|<>=!%@`]/.test(obj) || obj.trim() !== obj || obj === '') {
      return JSON.stringify(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj
      .map((item) => {
        if (typeof item === 'object' && item !== null) {
          const formatted = jsonToYaml(item, indent, currentIndent + indent);
          const lines = formatted.split('\n');
          return `${pad}- ${lines[0].trimStart()}\n${lines.slice(1).join('\n')}`.trimEnd();
        }
        return `${pad}- ${jsonToYaml(item, indent, currentIndent + indent)}`;
      })
      .join('\n');
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    return keys
      .map((k) => {
        const val = obj[k];
        const keyFormatted = /[:#\[\]{},&*?|<>=!%@`]/.test(k) ? JSON.stringify(k) : k;
        if (typeof val === 'object' && val !== null) {
          if (Array.isArray(val) && val.length === 0) return `${pad}${keyFormatted}: []`;
          if (!Array.isArray(val) && Object.keys(val).length === 0) return `${pad}${keyFormatted}: {}`;
          return `${pad}${keyFormatted}:\n${jsonToYaml(val, indent, currentIndent + indent)}`;
        }
        return `${pad}${keyFormatted}: ${jsonToYaml(val, indent, currentIndent + indent)}`;
      })
      .join('\n');
  }

  return String(obj);
}

/**
 * Format YAML string: parses into structured representation and re-dumps with consistent indentation
 */
export function formatYaml(raw: string, indent = 2): { formatted: string; parsed?: any; error?: string } {
  if (!raw.trim()) return { formatted: '' };

  // Try parsing JSON first if user pasted JSON into YAML mode
  try {
    const jsonParsed = JSON.parse(raw);
    return { formatted: jsonToYaml(jsonParsed, indent), parsed: jsonParsed };
  } catch {}

  // Parse lines of YAML safely
  try {
    const lines = raw.split('\n');
    const cleaned = lines
      .map((l) => l.replace(/\t/g, ' '.repeat(indent)))
      .filter((l, idx) => idx === 0 || l.trim().length > 0 || !lines[idx - 1]?.trim().length);
    return { formatted: cleaned.join('\n') };
  } catch (err: any) {
    return { formatted: raw, error: err.message || 'YAML Format Error' };
  }
}
