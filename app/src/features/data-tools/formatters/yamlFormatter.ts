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
          // Children of a "- key: value" entry must align 2 columns after the dash,
          // regardless of the configured indent width (otherwise the emitted YAML
          // has misaligned sibling keys and re-parsing truncates the document).
          const formatted = jsonToYaml(item, indent, currentIndent + 2);
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
 * Parse a common-subset YAML string into a plain JS object/array.
 * Supports: nested mappings/sequences by indentation (both indented and
 * same-indent sequence styles), compact "- key: value" entries, inline flow
 * collections ([...] / {...}), quoted & plain scalars, inline comments,
 * document markers and block scalars (| and >).
 * Lenient by design: returns best-effort value, never throws.
 */
export function parseYamlObject(raw: string): any | null {
  if (!raw || !raw.trim()) return null;
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');

  const getIndent = (i: number): number => lines[i].length - lines[i].trimStart().length;

  const isSkippable = (l: string): boolean => {
    const t = l.trim();
    return !t || t === '---' || t === '...' || t.startsWith('#');
  };

  /** Cut trailing comment (" #...") while respecting quotes. */
  const stripComment = (s: string): string => {
    let inS = false;
    let inD = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inS) {
        if (c === "'") inS = false;
      } else if (inD) {
        if (c === '\\') i++;
        else if (c === '"') inD = false;
      } else if (c === "'") inS = true;
      else if (c === '"') inD = true;
      else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i);
    }
    return s;
  };

  /** Find the ':' separating a mapping key from its value (outside quotes/flow). */
  const findKeyColon = (s: string): number => {
    let inS = false;
    let inD = false;
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inS) {
        if (c === "'") inS = false;
      } else if (inD) {
        if (c === '\\') i++;
        else if (c === '"') inD = false;
      } else if (c === "'") inS = true;
      else if (c === '"') inD = true;
      else if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') depth--;
      else if (c === ':' && depth === 0 && (i === s.length - 1 || s[i + 1] === ' ')) return i;
    }
    return -1;
  };

  const unquote = (s: string): string => {
    const t = s.trim();
    if (t.length >= 2 && t[0] === '"' && t[t.length - 1] === '"') {
      try {
        return JSON.parse(t);
      } catch {
        return t.slice(1, -1);
      }
    }
    if (t.length >= 2 && t[0] === "'" && t[t.length - 1] === "'") return t.slice(1, -1).replace(/''/g, "'");
    return t;
  };

  const parseScalar = (s: string): any => {
    const t = s.trim();
    if (!t || t === '~' || /^(null|Null|NULL)$/.test(t)) return null;
    if (/^(true|True|TRUE)$/.test(t)) return true;
    if (/^(false|False|FALSE)$/.test(t)) return false;
    if (/^[-+]?(0x[0-9a-fA-F]+|\d+\.?\d*([eE][-+]?\d+)?|\.\d+([eE][-+]?\d+)?)$/.test(t)) {
      const n = Number(t);
      if (!Number.isNaN(n)) return n;
    }
    if (t.length >= 2 && ((t[0] === '"' && t[t.length - 1] === '"') || (t[0] === "'" && t[t.length - 1] === "'"))) {
      return unquote(t);
    }
    return t;
  };

  /** Read a plain/quoted scalar up to any stop chars, respecting quotes. */
  const readUntil = (s: string, pos: { i: number }, stops: string): string => {
    const start = pos.i;
    let inS = false;
    let inD = false;
    while (pos.i < s.length) {
      const c = s[pos.i];
      if (inS) {
        if (c === "'") inS = false;
      } else if (inD) {
        if (c === '\\') pos.i++;
        else if (c === '"') inD = false;
      } else if (c === "'") inS = true;
      else if (c === '"') inD = true;
      else if (stops.includes(c)) break;
      pos.i++;
    }
    return s.slice(start, pos.i);
  };

  /** Recursive inline flow collection parser for [...] and {...}. */
  const parseFlow = (s: string, pos: { i: number }): any => {
    const isMap = s[pos.i] === '{';
    const result: any = isMap ? {} : [];
    pos.i++;
    for (;;) {
      while (pos.i < s.length && /[\s,]/.test(s[pos.i])) pos.i++;
      if (pos.i >= s.length) break;
      if (s[pos.i] === (isMap ? '}' : ']')) {
        pos.i++;
        break;
      }
      if (isMap) {
        let key: string;
        const q = s[pos.i];
        if (q === '"' || q === "'") {
          pos.i++;
          const start = pos.i;
          while (pos.i < s.length && s[pos.i] !== q) pos.i++;
          key = s.slice(start, pos.i);
          pos.i++;
        } else {
          key = readUntil(s, pos, ':').trim();
        }
        while (pos.i < s.length && /\s/.test(s[pos.i])) pos.i++;
        if (s[pos.i] === ':') pos.i++;
        while (pos.i < s.length && /\s/.test(s[pos.i])) pos.i++;
        let val: any;
        if (s[pos.i] === '[' || s[pos.i] === '{') val = parseFlow(s, pos);
        else val = parseScalar(readUntil(s, pos, ',}'));
        if (key) result[key] = val;
      } else {
        let val: any;
        if (s[pos.i] === '[' || s[pos.i] === '{') val = parseFlow(s, pos);
        else val = parseScalar(readUntil(s, pos, ',]'));
        result.push(val);
      }
    }
    return result;
  };

  /** Consume raw lines of a block scalar (| or >). */
  const readBlockScalar = (from: number, keyIndent: number, marker: string): [string, number] => {
    const folded = marker[0] === '>';
    const stripChomp = marker.endsWith('-');
    const collected: string[] = [];
    let j = from;
    let blockIndent = -1;
    while (j < lines.length) {
      const l = lines[j];
      if (l.trim() === '') {
        collected.push('');
        j++;
        continue;
      }
      const ind = getIndent(j);
      if (ind <= keyIndent) break;
      if (blockIndent === -1) blockIndent = ind;
      collected.push(l.slice(Math.min(ind, blockIndent)));
      j++;
    }
    while (collected.length && collected[collected.length - 1] === '') collected.pop();
    let text = folded ? collected.join(' ').replace(/ {2,}/g, ' ') : collected.join('\n');
    if (!stripChomp && text) text += '\n';
    if (stripChomp && folded) text = text.replace(/\s+$/, '');
    return [text, j];
  };

  /** Parse the node (sequence / mapping / scalar) starting at line i. */
  const parseNode = (start: number): [any, number] => {
    let i = start;
    while (i < lines.length && isSkippable(lines[i])) i++;
    if (i >= lines.length) return [null, i];

    const indent = getIndent(i);
    const first = stripComment(lines[i]).trim();

    // --- Sequence ---
    if (first === '-' || first.startsWith('- ')) {
      const arr: any[] = [];
      while (i < lines.length) {
        if (isSkippable(lines[i])) {
          i++;
          continue;
        }
        const ind = getIndent(i);
        if (ind !== indent) break;
        const c = stripComment(lines[i]).trim();
        if (!(c === '-' || c.startsWith('- '))) break;
        const rest = c === '-' ? '' : c.slice(1).trimStart();
        if (rest) {
          // Compact entry ("- key: value"): rewrite the dash into spaces so the
          // entry aligns as the first line of a nested block, then parse it.
          // Align to the following sibling key when present, so documents emitted
          // with wider indent widths (e.g. 4 spaces) are parsed losslessly too.
          const offset = c.length - rest.length;
          let virtualIndent = ind + offset;
          let k = i + 1;
          while (k < lines.length && isSkippable(lines[k])) k++;
          if (k < lines.length) {
            const nc = stripComment(lines[k]).trim();
            const nind = getIndent(k);
            if (nind > ind && !(nc === '-' || nc.startsWith('- '))) {
              virtualIndent = nind;
            }
          }
          lines[i] = ' '.repeat(virtualIndent) + rest;
          const [val, ni] = parseNode(i);
          arr.push(val);
          i = ni;
        } else {
          let j = i + 1;
          while (j < lines.length && isSkippable(lines[j])) j++;
          let val: any = null;
          if (j < lines.length && getIndent(j) > ind) {
            [val, j] = parseNode(j);
          }
          arr.push(val);
          i = j;
        }
      }
      return [arr, i];
    }

    // --- Mapping ---
    if (findKeyColon(first) !== -1) {
      const map: Record<string, any> = {};
      while (i < lines.length) {
        if (isSkippable(lines[i])) {
          i++;
          continue;
        }
        const ind = getIndent(i);
        if (ind !== indent) break;
        const c = stripComment(lines[i]).trim();
        const ci = findKeyColon(c);
        if (ci === -1 || c === '-' || c.startsWith('- ')) break;
        const key = unquote(c.slice(0, ci));
        const rest = c.slice(ci + 1).trim();

        if (/^[|>][+-]?$/.test(rest)) {
          const [text, ni] = readBlockScalar(i + 1, ind, rest);
          map[key] = text;
          i = ni;
          continue;
        }

        if (rest) {
          if (rest[0] === '[' || rest[0] === '{') {
            const pos = { i: 0 };
            map[key] = parseFlow(rest, pos);
          } else {
            map[key] = parseScalar(rest);
          }
          i++;
          continue;
        }

        // Nested block under "key:"
        let j = i + 1;
        while (j < lines.length && isSkippable(lines[j])) j++;
        if (j < lines.length) {
          const nind = getIndent(j);
          if (nind > ind) {
            const [val, ni] = parseNode(j);
            map[key] = val;
            i = ni;
            continue;
          }
          // Same-indent sequence style ("key:" followed by "- item" at key indent)
          if (nind === ind) {
            const nc = stripComment(lines[j]).trim();
            if (nc === '-' || nc.startsWith('- ')) {
              const [val, ni] = parseNode(j);
              map[key] = val;
              i = ni;
              continue;
            }
          }
        }
        map[key] = null;
        i = i + 1;
      }
      return [map, i];
    }

    // --- Plain scalar document ---
    return [parseScalar(first), i + 1];
  };

  const [value] = parseNode(0);
  return value === undefined ? null : value;
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

  // Parse the YAML subset into a structure and re-dump normalized output
  const parsed = parseYamlObject(raw);
  if (parsed !== null && typeof parsed === 'object') {
    const formatted = jsonToYaml(parsed, indent);
    // Safety net: never hand back a formatted document that loses information
    // (guards against emitter/parser mismatches on unusual indent widths).
    const roundTrip = parseYamlObject(formatted);
    if (JSON.stringify(roundTrip) !== JSON.stringify(parsed)) {
      return { formatted: raw, parsed, error: 'YAML format verification failed' };
    }
    return { formatted, parsed };
  }

  // Fallback: light text cleanup for plain scalar / unparsable content
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
