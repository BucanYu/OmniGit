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

  // Guard 1: Standard Windows absolute paths (e.g. "D:\projects\...") or UNC paths ("\\server\share")
  // MUST NEVER be decoded as C-style escapes!
  if (/^[a-zA-Z]:[/\\]/.test(str) || str.startsWith('\\\\')) {
    if (str.startsWith('"') && str.endsWith('"') && str.length >= 2) {
      return str.slice(1, -1);
    }
    return str;
  }

  // Guard 2: Git ONLY C-quotes paths if they are enclosed in double quotes!
  const isQuoted = str.startsWith('"') && str.endsWith('"') && str.length >= 2;
  if (isQuoted) {
    str = str.slice(1, -1);
  } else {
    // If NOT enclosed in double quotes, Git guarantees this is a normal raw path.
    // However, if external code prematurely stripped surrounding quotes, check if it actually
    // contains non-ASCII UTF-8 octal sequences (\3xx\2xx). Standard folder numbers like "\01_demo"
    // are NOT Git octal escapes!
    const hasUtf8Octal = /\\3[0-7]{2}/.test(str);
    if (!hasUtf8Octal) {
      return str;
    }
  }

  // Fast path: if there is no backslash left, return directly
  if (!str.includes('\\')) {
    return str;
  }

  const bytes: number[] = [];
  let i = 0;
  while (i < str.length) {
    if (str[i] === '\\' && i + 1 < str.length) {
      const nextChar = str[i + 1];
      // Check 3 octal digits: \ooo (Git UTF-8 octals are always 3 digits e.g. \346\265\213)
      if (nextChar >= '0' && nextChar <= '7') {
        let octalStr = nextChar;
        if (i + 2 < str.length && str[i + 2] >= '0' && str[i + 2] <= '7') {
          octalStr += str[i + 2];
          if (i + 3 < str.length && str[i + 3] >= '0' && str[i + 3] <= '7') {
            octalStr += str[i + 3];
          }
        }
        // Only treat as octal if inside quoted string OR looks like standard 3-digit octal >= 040
        const parsed = parseInt(octalStr, 8);
        if (isQuoted || (octalStr.length === 3 && parsed >= 32)) {
          bytes.push(parsed);
          i += 1 + octalStr.length;
          continue;
        }
      }

      // Standard C escapes only when inside a quoted string
      if (isQuoted) {
        if (nextChar === '\\') {
          bytes.push(92);
          i += 2;
          continue;
        }
        if (nextChar === '"') {
          bytes.push(34);
          i += 2;
          continue;
        }
        if (nextChar === 'n') {
          bytes.push(10);
          i += 2;
          continue;
        }
        if (nextChar === 't') {
          bytes.push(9);
          i += 2;
          continue;
        }
        if (nextChar === 'r') {
          bytes.push(13);
          i += 2;
          continue;
        }
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
