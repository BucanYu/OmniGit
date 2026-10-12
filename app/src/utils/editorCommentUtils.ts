/**
 * Universal Comment / Uncomment Keybinding & Language Configuration Utilities
 * Supports Ctrl+/ toggle line comment across all programming & markup languages.
 */

export interface CommentRule {
  line?: string;
  block?: [string, string];
}

export const LANGUAGE_COMMENT_MAP: Record<string, CommentRule> = {
  // C-style languages (// and /* */)
  javascript: { line: '//', block: ['/*', '*/'] },
  typescript: { line: '//', block: ['/*', '*/'] },
  java: { line: '//', block: ['/*', '*/'] },
  c: { line: '//', block: ['/*', '*/'] },
  cpp: { line: '//', block: ['/*', '*/'] },
  csharp: { line: '//', block: ['/*', '*/'] },
  go: { line: '//', block: ['/*', '*/'] },
  rust: { line: '//', block: ['/*', '*/'] },
  kotlin: { line: '//', block: ['/*', '*/'] },
  swift: { line: '//', block: ['/*', '*/'] },
  php: { line: '//', block: ['/*', '*/'] },
  dart: { line: '//', block: ['/*', '*/'] },
  scala: { line: '//', block: ['/*', '*/'] },
  jsonc: { line: '//', block: ['/*', '*/'] },

  // Hash / Shell style (#)
  python: { line: '#', block: ['"""', '"""'] },
  shell: { line: '#' },
  bash: { line: '#' },
  sh: { line: '#' },
  yaml: { line: '#' },
  yml: { line: '#' },
  dockerfile: { line: '#' },
  ruby: { line: '#' },
  perl: { line: '#' },
  r: { line: '#' },
  toml: { line: '#' },
  properties: { line: '#' },
  ini: { line: ';' },

  // Dash-dash style (--)
  sql: { line: '--', block: ['/*', '*/'] },
  pgsql: { line: '--', block: ['/*', '*/'] },
  mysql: { line: '--', block: ['/*', '*/'] },
  lua: { line: '--', block: ['--[[', ']]'] },
  haskell: { line: '--', block: ['{-', '-}'] },

  // XML / HTML style (<!-- -->)
  html: { block: ['<!--', '-->'] },
  xml: { block: ['<!--', '-->'] },
  svg: { block: ['<!--', '-->'] },
  markdown: { block: ['<!--', '-->'] },
  vue: { block: ['<!--', '-->'] },

  // CSS style (/* */)
  css: { block: ['/*', '*/'] },
  scss: { line: '//', block: ['/*', '*/'] },
  less: { line: '//', block: ['/*', '*/'] },

  // Batch / PowerShell
  bat: { line: 'REM ' },
  cmd: { line: 'REM ' },
  powershell: { line: '#', block: ['<#', '#>'] },
};

/**
 * Register comments configuration with Monaco's language service
 * Ensures built-in editor.action.commentLine knows comment tokens for each language
 */
export function registerAllLanguageComments(monaco: any) {
  if (!monaco || !monaco.languages || !monaco.languages.setLanguageConfiguration) {
    return;
  }

  for (const [lang, rule] of Object.entries(LANGUAGE_COMMENT_MAP)) {
    try {
      const config: any = { comments: {} };
      if (rule.line) {
        config.comments.lineComment = rule.line;
      }
      if (rule.block) {
        config.comments.blockComment = rule.block;
      }
      monaco.languages.setLanguageConfiguration(lang, config);
    } catch {}
  }
}

/**
 * Get comment rule for a specific language or file extension
 */
export function getCommentRule(language: string, filePath?: string): CommentRule {
  const langLower = (language || '').toLowerCase();
  if (LANGUAGE_COMMENT_MAP[langLower]) {
    return LANGUAGE_COMMENT_MAP[langLower];
  }

  if (filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (ext && LANGUAGE_COMMENT_MAP[ext]) {
      return LANGUAGE_COMMENT_MAP[ext];
    }
  }

  // Default fallback to C-style comments
  return { line: '//', block: ['/*', '*/'] };
}

/**
 * Fallback line comment toggler directly operating on Monaco text model
 * Used when native Monaco action fails or when language lacks native lineComment
 */
export function toggleCommentManually(editor: any, language: string, filePath?: string) {
  const model = editor?.getModel();
  if (!model) return;

  const rawSelection = editor?.getSelection() || editor?.getPosition();
  const startLineNumber = rawSelection ? (rawSelection.startLineNumber ?? rawSelection.lineNumber ?? 1) : 1;
  const startColumn = rawSelection ? (rawSelection.startColumn ?? rawSelection.column ?? 1) : 1;
  const endLineNumber = rawSelection ? (rawSelection.endLineNumber ?? rawSelection.lineNumber ?? 1) : 1;
  const endColumn = rawSelection ? (rawSelection.endColumn ?? rawSelection.column ?? 1) : 1;

  const isSelectionEmpty = (startLineNumber === endLineNumber && startColumn === endColumn);
  const selection = {
    startLineNumber,
    startColumn,
    endLineNumber,
    endColumn,
    isEmpty: () => isSelectionEmpty,
  };

  const rule = getCommentRule(language, filePath);
  const startLine = selection.startLineNumber;
  const endLine = selection.endLineNumber;

  // Case A: Language has a lineComment prefix (e.g. //, #, --, REM)
  if (rule.line) {
    const prefix = rule.line.trimEnd() + ' ';
    const rawPrefix = rule.line.trim();

    let allCommented = true;
    const lineTexts: string[] = [];

    for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
      const text = model.getLineContent(lineNum);
      lineTexts.push(text);
      const trimmed = text.trim();
      if (trimmed.length > 0 && !trimmed.startsWith(rawPrefix)) {
        allCommented = false;
      }
    }

    const edits: any[] = [];

    for (let i = 0; i < lineTexts.length; i++) {
      const lineNum = startLine + i;
      const originalText = lineTexts[i];

      if (allCommented) {
        // Uncomment: remove prefix and optional following space
        const commentIdx = originalText.indexOf(rawPrefix);
        if (commentIdx !== -1) {
          const hasSpaceAfter = originalText[commentIdx + rawPrefix.length] === ' ';
          const deleteLength = rawPrefix.length + (hasSpaceAfter ? 1 : 0);

          edits.push({
            range: {
              startLineNumber: lineNum,
              startColumn: commentIdx + 1,
              endLineNumber: lineNum,
              endColumn: commentIdx + 1 + deleteLength,
            },
            text: '',
          });
        }
      } else {
        // Comment: insert prefix at leading indent
        const match = originalText.match(/^(\s*)/);
        const indentLength = match ? match[1].length : 0;

        edits.push({
          range: {
            startLineNumber: lineNum,
            startColumn: indentLength + 1,
            endLineNumber: lineNum,
            endColumn: indentLength + 1,
          },
          text: prefix,
        });
      }
    }

    if (edits.length > 0) {
      editor.executeEdits('toggle-line-comment', edits);
    }
    return;
  }

  // Case B: Language only has blockComment (e.g. HTML/XML/Markdown <!-- -->, CSS /* */)
  if (rule.block) {
    const [openTag, closeTag] = rule.block;
    let targetRange: {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    } = {
      startLineNumber: selection.startLineNumber,
      startColumn: selection.startColumn,
      endLineNumber: selection.endLineNumber,
      endColumn: selection.endColumn,
    };
    let textToComment = model.getValueInRange(selection);

    if (selection.isEmpty()) {
      // If cursor is on a line without selection, target the entire line
      const lineNum = selection.startLineNumber;
      const lineContent = model.getLineContent(lineNum);
      textToComment = lineContent;
      targetRange = {
        startLineNumber: lineNum,
        startColumn: 1,
        endLineNumber: lineNum,
        endColumn: lineContent.length + 1,
      };
    }

    const trimmed = textToComment.trim();

    if (trimmed.startsWith(openTag) && trimmed.endsWith(closeTag)) {
      // Uncomment block
      const inner = trimmed.slice(openTag.length, trimmed.length - closeTag.length).trim();
      editor.executeEdits('toggle-block-comment', [
        {
          range: targetRange,
          text: inner,
        },
      ]);
    } else {
      // Comment block
      editor.executeEdits('toggle-block-comment', [
        {
          range: targetRange,
          text: `${openTag} ${textToComment} ${closeTag}`,
        },
      ]);
    }
  }
}

/**
 * Universal toggle comment dispatcher
 * 1. Tries native Monaco commentLine action
 * 2. If no-op, falls back to manual line/block toggle
 */
export function toggleEditorComment(editor: any, language: string, filePath?: string) {
  if (!editor) return;

  const rule = getCommentRule(language, filePath);

  // If language only has block comments (like HTML/XML/CSS/Markdown), try native block comment first if selection not empty
  if (!rule.line && rule.block) {
    const rawSel = editor.getSelection();
    const isSelectionEmpty = !rawSel || (typeof rawSel.isEmpty === 'function' ? rawSel.isEmpty() : (rawSel.startLineNumber === rawSel.endLineNumber && rawSel.startColumn === rawSel.endColumn));
    if (!isSelectionEmpty) {
      const model = editor.getModel();
      const versionBefore = model?.getVersionId();
      const blockAction = editor.getAction('editor.action.blockComment');
      if (blockAction) {
        blockAction.run();
        const versionAfter = model?.getVersionId();
        if (versionAfter !== versionBefore) {
          return;
        }
      }
    }
  }

  // Try native Monaco commentLine action first
  const lineAction = editor.getAction('editor.action.commentLine');
  if (lineAction) {
    const model = editor.getModel();
    const versionBefore = model?.getVersionId();
    lineAction.run();
    const versionAfter = model?.getVersionId();

    if (versionAfter !== versionBefore) {
      return; // Successfully toggled by Monaco native action
    }
  }

  // Fallback to manual parser
  toggleCommentManually(editor, language, filePath);
}
