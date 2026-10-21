/**
 * Git Path Utilities
 * 
 * Handles decoding of Git paths that may be enclosed in double quotes and contain
 * C-style octal escape sequences (e.g. "\345\234\260" for "地" in UTF-8),
 * which Git outputs by default when core.quotepath is true.
 * 
 * Uses standard TextDecoder / Uint8Array to work identically in Node.js,
 * Electron main, and browser environments.
 */

export function decodeGitPath(rawPath: string): string {
  if (!rawPath) return '';
  let str = rawPath.trim();

  // Strip surrounding quotes if present
  if (str.startsWith('"') && str.endsWith('"') && str.length >= 2) {
    str = str.slice(1, -1);
  } else if (!str.includes('\\')) {
    // Fast path: no escape characters
    return str;
  }

  if (!str.includes('\\')) {
    return str;
  }

  const bytes: number[] = [];
  let i = 0;
  while (i < str.length) {
    if (str[i] === '\\' && i + 1 < str.length) {
      const nextChar = str[i + 1];
      // Check 1 to 3 octal digits: \ooo
      if (nextChar >= '0' && nextChar <= '7') {
        let octalStr = nextChar;
        if (i + 2 < str.length && str[i + 2] >= '0' && str[i + 2] <= '7') {
          octalStr += str[i + 2];
          if (i + 3 < str.length && str[i + 3] >= '0' && str[i + 3] <= '7') {
            octalStr += str[i + 3];
          }
        }
        bytes.push(parseInt(octalStr, 8));
        i += 1 + octalStr.length;
        continue;
      }

      // Standard C escapes
      if (nextChar === '\\') {
        bytes.push(92); // '\\'
        i += 2;
        continue;
      }
      if (nextChar === '"') {
        bytes.push(34); // '"'
        i += 2;
        continue;
      }
      if (nextChar === 'n') {
        bytes.push(10); // '\n'
        i += 2;
        continue;
      }
      if (nextChar === 't') {
        bytes.push(9); // '\t'
        i += 2;
        continue;
      }
      if (nextChar === 'r') {
        bytes.push(13); // '\r'
        i += 2;
        continue;
      }
      if (nextChar === 'b') {
        bytes.push(8); // '\b'
        i += 2;
        continue;
      }
      if (nextChar === 'a') {
        bytes.push(7); // '\a'
        i += 2;
        continue;
      }
      if (nextChar === 'v') {
        bytes.push(11); // '\v'
        i += 2;
        continue;
      }
      if (nextChar === 'f') {
        bytes.push(12); // '\f'
        i += 2;
        continue;
      }
    }

    const charCode = str.charCodeAt(i);
    if (charCode < 128) {
      bytes.push(charCode);
    } else {
      const encoded = new TextEncoder().encode(str[i]);
      for (let j = 0; j < encoded.length; j++) {
        bytes.push(encoded[j]);
      }
    }
    i++;
  }

  try {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  } catch {
    return str;
  }
}

/**
 * Splits a decoded git relative path into normalized fileName and dirPath.
 * E.g. "web/src/main/resources/templates/地震模板240314.ftl"
 * -> { fileName: "地震模板240314.ftl", dirPath: "web\\src\\main\\resources\\templates", forwardPath: "web/src/main/resources/templates/地震模板240314.ftl" }
 */
export function splitGitPath(filePath: string): { fileName: string; dirPath: string; forwardPath: string } {
  const decoded = decodeGitPath(filePath);
  const forwardPath = decoded.replace(/\\/g, '/');
  const lastSlash = forwardPath.lastIndexOf('/');
  const fileName = lastSlash >= 0 ? forwardPath.slice(lastSlash + 1) : forwardPath;
  const dirPath = lastSlash >= 0 ? forwardPath.slice(0, lastSlash).replace(/\//g, '\\') : '';
  return { fileName, dirPath, forwardPath };
}
