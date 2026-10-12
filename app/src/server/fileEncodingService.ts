import * as fs from 'fs';
import * as path from 'path';
let iconv: any = null;
try {
  iconv = require('iconv-lite');
} catch (e) {
  // Graceful fallback to native TextDecoder/Buffer
}

export interface FileReadResult {
  content: string;
  encoding: string;
  eol: 'CRLF' | 'LF';
  isBinary: boolean;
  size: number;
  tooLarge?: boolean;
}

export class FileEncodingService {
  /**
   * Check if a buffer appears to be a binary file
   */
  public isBinary(buffer: Buffer): boolean {
    const checkLength = Math.min(buffer.length, 4096);
    if (checkLength === 0) return false;

    // Fast check for null bytes
    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] === 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Detect line ending format
   */
  public detectEol(text: string): 'CRLF' | 'LF' {
    const crlfIndex = text.indexOf('\r\n');
    const lfIndex = text.indexOf('\n');

    if (crlfIndex !== -1) {
      return 'CRLF';
    }
    if (lfIndex !== -1) {
      return 'LF';
    }
    return process.platform === 'win32' ? 'CRLF' : 'LF';
  }

  /**
   * Check if buffer is valid UTF-8
   */
  private isValidUtf8(buf: Buffer): boolean {
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      decoder.decode(buf);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect encoding of buffer
   */
  public detectEncoding(buffer: Buffer): string {
    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return 'utf-8-bom';
    }
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
      return 'utf-16le';
    }
    if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
      return 'utf-16be';
    }

    if (this.isValidUtf8(buffer)) {
      return 'utf-8';
    }

    // Try GBK (commonly used in Chinese Windows systems)
    if (iconv && typeof iconv.encodingExists === 'function' && iconv.encodingExists('gbk')) {
      try {
        const decoded = iconv.decode(buffer, 'gbk');
        // If it decodes without replacement characters
        if (!decoded.includes('\uFFFD')) {
          return 'gbk';
        }
      } catch {}
    } else {
      // Native Node TextDecoder fallback for GBK
      try {
        const decoder = new TextDecoder('gbk', { fatal: true });
        decoder.decode(buffer);
        return 'gbk';
      } catch {}
    }

    return 'utf-8';
  }

  /**
   * Read file with strict encoding and EOL preservation
   */
  public readFile(fullPath: string): FileReadResult {
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const stat = fs.statSync(fullPath);
    const size = stat.size;

    // Large file threshold: 10MB
    if (size > 10 * 1024 * 1024) {
      return {
        content: '',
        encoding: 'utf-8',
        eol: 'LF',
        isBinary: false,
        size,
        tooLarge: true,
      };
    }

    const buffer = fs.readFileSync(fullPath);
    const isBinary = this.isBinary(buffer);

    if (isBinary) {
      return {
        content: '',
        encoding: 'binary',
        eol: 'LF',
        isBinary: true,
        size,
      };
    }

    const encoding = this.detectEncoding(buffer);
    let content = '';

    if (encoding === 'utf-8-bom') {
      content = buffer.slice(3).toString('utf8');
    } else if (encoding === 'utf-8') {
      content = buffer.toString('utf8');
    } else if (iconv && typeof iconv.encodingExists === 'function' && iconv.encodingExists(encoding)) {
      content = iconv.decode(buffer, encoding);
    } else {
      try {
        const decoder = new TextDecoder(encoding);
        content = decoder.decode(buffer);
      } catch {
        content = buffer.toString('utf8');
      }
    }

    const eol = this.detectEol(content);

    return {
      content,
      encoding,
      eol,
      isBinary: false,
      size,
    };
  }

  /**
   * Write file with original encoding and original line ending fidelity
   */
  public writeFile(
    fullPath: string,
    content: string,
    targetEncoding: string = 'utf-8',
    targetEol?: 'CRLF' | 'LF'
  ): boolean {
    try {
      // 1. Normalize line endings if requested
      let normalizedContent = content;
      if (targetEol === 'CRLF') {
        normalizedContent = content.replace(/\r?\n/g, '\r\n');
      } else if (targetEol === 'LF') {
        normalizedContent = content.replace(/\r\n/g, '\n');
      }

      // 2. Encode to target buffer
      let buffer: Buffer;
      const lower = targetEncoding.toLowerCase();

      if (lower === 'utf-8-bom') {
        const bodyBuf = Buffer.from(normalizedContent, 'utf8');
        buffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bodyBuf]);
      } else if (lower === 'utf-8') {
        buffer = Buffer.from(normalizedContent, 'utf8');
      } else if (iconv && typeof iconv.encodingExists === 'function' && iconv.encodingExists(lower)) {
        buffer = iconv.encode(normalizedContent, lower);
      } else {
        buffer = Buffer.from(normalizedContent, 'utf8');
      }

      // 3. Safe write: write to temp file first, then atomically rename
      const tempPath = `${fullPath}.omnigit_tmp_${Date.now()}`;
      fs.writeFileSync(tempPath, buffer);
      fs.renameSync(tempPath, fullPath);

      return true;
    } catch (err) {
      console.error(`[FileEncodingService] Write failed for ${fullPath}:`, err);
      // Fallback direct write
      try {
        fs.writeFileSync(fullPath, content, 'utf8');
        return true;
      } catch {
        return false;
      }
    }
  }
}

export const fileEncodingService = new FileEncodingService();
