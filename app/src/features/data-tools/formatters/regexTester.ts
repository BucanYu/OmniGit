export interface RegexMatchDetail {
  index: number;
  match: string;
  position: { start: number; end: number };
  line: number;
  groups: string[];
  namedGroups: Record<string, string>;
}

export const REGEX_COMMON_PRESETS: Record<string, string> = {
  email: '/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g',
  ipv4: '/\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b/g',
  url: '/https?:\\/\\/[\\w\\-._~:/?#[\\]@!$&\'()*+,;=%]+/gi',
  semver: '/\\bv?(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[\\da-z\\-]+(?:\\.[\\da-z\\-]+)*)?(?:\\+[\\da-z\\-]+(?:\\.[\\da-z\\-]+)*)?\\b/gi',
  cnPhone: '/\\b1[3-9]\\d{9}\\b/g',
};

function parseRegexInput(content: string): {
  pattern: string;
  flags: string;
  testText: string;
} {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj.pattern === 'string' && typeof obj.testText === 'string') {
        return {
          pattern: obj.pattern,
          flags: typeof obj.flags === 'string' ? obj.flags : 'g',
          testText: obj.testText,
        };
      }
    } catch {}
  }

  const lines = content.split(/\r?\n/);
  const firstLine = (lines[0] || '').trim();
  const slashMatch = firstLine.match(/^\/(.+)\/([dgimsuvy]*)$/);
  if (slashMatch) {
    return {
      pattern: slashMatch[1],
      flags: slashMatch[2] || 'g',
      testText: lines.slice(1).join('\n'),
    };
  }

  return {
    pattern: firstLine,
    flags: 'g',
    testText: lines.slice(1).join('\n'),
  };
}

export function evaluateRegexContent(
  content: string,
  indent = 2
): { parsed: any; formattedJson: string } {
  const { pattern, flags, testText } = parseRegexInput(content);

  if (!pattern) {
    const emptyRes = {
      valid: false,
      pattern: '',
      flags,
      testText,
      error: '请在第一行输入正则表达式（例如 /pattern/g），并在后续行输入待匹配文本',
      presets: REGEX_COMMON_PRESETS,
    };
    return { parsed: emptyRes, formattedJson: JSON.stringify(emptyRes, null, indent) };
  }

  try {
    const safeFlags = flags.includes('g') ? flags : `${flags}g`;
    const regex = new RegExp(pattern, safeFlags);
    const matches: RegexMatchDetail[] = [];
    const MAX_MATCHES = 200;

    let m: RegExpExecArray | null;
    let stepGuard = 0;
    while ((m = regex.exec(testText)) !== null && stepGuard < MAX_MATCHES) {
      stepGuard++;
      const start = m.index;
      const matchStr = m[0];
      const end = start + matchStr.length;
      const prefix = testText.slice(0, start);
      const line = prefix.split(/\r?\n/).length;

      matches.push({
        index: matches.length + 1,
        match: matchStr,
        position: { start, end },
        line,
        groups: m.slice(1).map((g) => (g === undefined ? '' : g)),
        namedGroups: m.groups ? { ...m.groups } : {},
      });

      if (matchStr.length === 0) {
        regex.lastIndex++;
      }
    }

    const parsed = {
      valid: true,
      expression: `/${pattern}/${flags}`,
      pattern,
      flags,
      testText,
      totalMatches: matches.length,
      matches,
      presets: REGEX_COMMON_PRESETS,
    };

    return {
      parsed,
      formattedJson: JSON.stringify(parsed, null, indent),
    };
  } catch (err: any) {
    const errRes = {
      valid: false,
      pattern,
      flags,
      testText,
      error: err?.message || '无效的正则表达式',
      presets: REGEX_COMMON_PRESETS,
    };
    return {
      parsed: errRes,
      formattedJson: JSON.stringify(errRes, null, indent),
    };
  }
}
