/**
 * Base64 工具函数（零依赖）
 * 设计原则：只做规范化与只读解码，绝不隐式改写用户输入的语义。
 */

/** 去掉空白并按 4 字符对齐补齐 padding；非 Base64 内容原样返回（trim 后）。 */
export function normalizeBase64(raw: string): string {
  const compact = raw.replace(/\s+/g, '');
  if (!compact) return '';
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) return raw.trim();
  const body = compact.replace(/=+$/, '');
  if (body.length % 4 === 1) return raw.trim(); // 长度不合法，保持原样
  const pad = (4 - (body.length % 4)) % 4;
  return body + '='.repeat(pad);
}

export interface Base64Info {
  valid: boolean;
  byteLength: number;
  /** 解码后的 UTF-8 文本；二进制内容为 null */
  text: string | null;
  binary: boolean;
}

const EMPTY_INFO: Base64Info = { valid: false, byteLength: 0, text: null, binary: false };

/** 安全解码：非法 Base64 返回 valid=false；二进制内容不产出乱码文本。 */
export function decodeBase64(raw: string): Base64Info {
  const normalized = normalizeBase64(raw);
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    return EMPTY_INFO;
  }

  let binaryString = '';
  try {
    binaryString = atob(normalized);
  } catch {
    return EMPTY_INFO;
  }

  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  let text: string | null = null;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = null;
  }

  return { valid: true, byteLength: bytes.length, text, binary: text === null };
}
