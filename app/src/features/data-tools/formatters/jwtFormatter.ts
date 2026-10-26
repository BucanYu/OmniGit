/**
 * Pure client-side JWT Token Decoder & Formatter
 */

function base64UrlDecode(str: string): string {
  let output = str.replace(/-/g, '+').replace(/_/g, '/');
  switch (output.length % 4) {
    case 0:
      break;
    case 2:
      output += '==';
      break;
    case 3:
      output += '=';
      break;
    default:
      throw new Error('Illegal base64url string');
  }
  try {
    return decodeURIComponent(
      atob(output)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return atob(output);
  }
}

export interface JwtInspectionResult {
  header: any;
  payload: any;
  signature: string;
  isExpired: boolean;
  issuedAt?: string;
  expiresAt?: string;
  remainingTime?: string;
  formattedJson: string;
  error?: string;
}

export function parseJwt(token: string): JwtInspectionResult {
  const clean = token.trim();
  if (!clean) {
    return {
      header: null,
      payload: null,
      signature: '',
      isExpired: false,
      formattedJson: '',
    };
  }

  const parts = clean.split('.');
  if (parts.length < 2) {
    return {
      header: null,
      payload: null,
      signature: '',
      isExpired: false,
      formattedJson: clean,
      error: 'Invalid JWT format: Token must have at least 2 parts separated by dots (.)',
    };
  }

  try {
    const headerStr = base64UrlDecode(parts[0]);
    const payloadStr = base64UrlDecode(parts[1]);
    const signature = parts[2] || '';

    const header = JSON.parse(headerStr);
    const payload = JSON.parse(payloadStr);

    let isExpired = false;
    let expiresAt: string | undefined;
    let issuedAt: string | undefined;
    let remainingTime: string | undefined;

    if (payload.exp && typeof payload.exp === 'number') {
      const expDate = new Date(payload.exp * 1000);
      expiresAt = expDate.toLocaleString();
      const diffMs = expDate.getTime() - Date.now();
      if (diffMs <= 0) {
        isExpired = true;
        remainingTime = '已过期';
      } else {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        remainingTime = hours > 0 ? `${hours}小时 ${mins}分钟` : `${mins}分钟`;
      }
    }

    if (payload.iat && typeof payload.iat === 'number') {
      issuedAt = new Date(payload.iat * 1000).toLocaleString();
    }

    const aggregated = {
      _meta: {
        tokenStatus: isExpired ? 'EXPIRED' : 'ACTIVE',
        issuedAt,
        expiresAt,
        remainingTime,
        algorithm: header.alg || 'UNKNOWN',
      },
      header,
      payload,
      signaturePrefix: signature.slice(0, 16) + (signature.length > 16 ? '...' : ''),
    };

    return {
      header,
      payload,
      signature,
      isExpired,
      issuedAt,
      expiresAt,
      remainingTime,
      formattedJson: JSON.stringify(aggregated, null, 2),
    };
  } catch (err: any) {
    return {
      header: null,
      payload: null,
      signature: '',
      isExpired: false,
      formattedJson: clean,
      error: err.message || 'JWT Parse Error',
    };
  }
}
