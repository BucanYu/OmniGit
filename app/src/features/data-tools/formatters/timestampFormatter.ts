export interface TimestampEntryResult {
  input: string;
  valid: boolean;
  unixSeconds?: number;
  unixMilliseconds?: number;
  iso8601?: string;
  utcString?: string;
  localString?: string;
  dateOnly?: string;
  timeOnly?: string;
  dayOfWeek?: string;
  dayOfYear?: number;
  weekOfYear?: number;
  isLeapYear?: boolean;
  relativeTime?: string;
  timezoneOffset?: string;
  error?: string;
}

const WEEKDAYS_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function formatRelativeTime(targetMs: number, nowMs: number): string {
  const diffSec = Math.round((targetMs - nowMs) / 1000);
  if (Math.abs(diffSec) < 5) return '刚刚 / Now';
  const isFuture = diffSec > 0;
  const abs = Math.abs(diffSec);
  const suffix = isFuture ? '后' : '前';
  if (abs < 60) return `${abs} 秒${suffix}`;
  if (abs < 3600) return `${Math.floor(abs / 60)} 分钟${suffix}`;
  if (abs < 86400) return `${Math.floor(abs / 3600)} 小时${suffix}`;
  if (abs < 2592000) return `${Math.floor(abs / 86400)} 天${suffix}`;
  if (abs < 31536000) return `${Math.floor(abs / 2592000)} 个月${suffix}`;
  return `${(abs / 31536000).toFixed(1)} 年${suffix}`;
}

function parseSingleTimestampLine(line: string, nowMs: number): TimestampEntryResult {
  const raw = line.trim();
  let date: Date | null = null;

  if (/^now$/i.test(raw)) {
    date = new Date(nowMs);
  } else if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const num = Number(raw);
    // Heuristic: 10 digits or abs < 1e11 => Unix seconds; otherwise milliseconds
    const ms = Math.abs(num) < 1e11 ? Math.round(num * 1000) : Math.round(num);
    date = new Date(ms);
  } else {
    const parsedMs = Date.parse(raw);
    if (!Number.isNaN(parsedMs)) {
      date = new Date(parsedMs);
    }
  }

  if (!date || Number.isNaN(date.getTime())) {
    return {
      input: raw,
      valid: false,
      error: '无法识别的时间戳或日期格式 (支持秒/毫秒时间戳、ISO 8601、YYYY-MM-DD HH:mm:ss 或 now)',
    };
  }

  const ms = date.getTime();
  const sec = Math.floor(ms / 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const millis = String(date.getMilliseconds()).padStart(3, '0');

  const startOfYear = new Date(year, 0, 0).getTime();
  const dayOfYear = Math.floor((ms - startOfYear) / 86400000);
  const weekOfYear = Math.ceil((dayOfYear + new Date(year, 0, 1).getDay() + 1) / 7);
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

  const tzOffsetMin = -date.getTimezoneOffset();
  const tzSign = tzOffsetMin >= 0 ? '+' : '-';
  const tzAbs = Math.abs(tzOffsetMin);
  const tzStr = `UTC${tzSign}${String(Math.floor(tzAbs / 60)).padStart(2, '0')}:${String(tzAbs % 60).padStart(2, '0')}`;

  return {
    input: raw,
    valid: true,
    unixSeconds: sec,
    unixMilliseconds: ms,
    iso8601: date.toISOString(),
    utcString: date.toUTCString(),
    localString: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${millis}`,
    dateOnly: `${year}-${month}-${day}`,
    timeOnly: `${hours}:${minutes}:${seconds}`,
    dayOfWeek: `${WEEKDAYS_ZH[date.getDay()]} (${date.toLocaleDateString('en-US', { weekday: 'long' })})`,
    dayOfYear,
    weekOfYear,
    isLeapYear,
    relativeTime: formatRelativeTime(ms, nowMs),
    timezoneOffset: tzStr,
  };
}

export function parseTimestampContent(
  content: string,
  indent = 2
): { parsed: any; formattedJson: string } {
  const trimmed = content.trim();
  const nowMs = Date.now();

  if (!trimmed) {
    const fallback = parseSingleTimestampLine('now', nowMs);
    return { parsed: fallback, formattedJson: JSON.stringify(fallback, null, indent) };
  }

  // If already formatted JSON output, preserve or re-evaluate based on input field
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const jsonObj = JSON.parse(trimmed);
      if (jsonObj && typeof jsonObj === 'object') {
        if (typeof jsonObj.input === 'string') {
          const refreshed = parseSingleTimestampLine(jsonObj.input, nowMs);
          return { parsed: refreshed, formattedJson: JSON.stringify(refreshed, null, indent) };
        }
        return { parsed: jsonObj, formattedJson: JSON.stringify(jsonObj, null, indent) };
      }
    } catch {}
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  if (lines.length <= 1) {
    const single = parseSingleTimestampLine(lines[0] || 'now', nowMs);
    return { parsed: single, formattedJson: JSON.stringify(single, null, indent) };
  }

  const items = lines.map((line) => parseSingleTimestampLine(line, nowMs));
  const parsed = {
    currentUnixSeconds: Math.floor(nowMs / 1000),
    currentUnixMilliseconds: nowMs,
    count: items.length,
    conversions: items,
  };
  return { parsed, formattedJson: JSON.stringify(parsed, null, indent) };
}
