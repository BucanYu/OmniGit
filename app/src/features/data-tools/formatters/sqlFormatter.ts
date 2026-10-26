/**
 * Pure client-side SQL Formatter & Minifier
 */

const SQL_KEYWORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'AND',
  'OR',
  'LEFT JOIN',
  'RIGHT JOIN',
  'INNER JOIN',
  'OUTER JOIN',
  'FULL JOIN',
  'CROSS JOIN',
  'JOIN',
  'ON',
  'GROUP BY',
  'ORDER BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'UNION ALL',
  'UNION',
  'INSERT INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE FROM',
  'CREATE TABLE',
  'DROP TABLE',
  'ALTER TABLE',
  'AS',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'IN',
  'NOT IN',
  'EXISTS',
  'NOT EXISTS',
  'LIKE',
  'IS NULL',
  'IS NOT NULL',
  'BETWEEN',
  'ASC',
  'DESC',
];

export function formatSql(sql: string, indent = 2): { formatted: string; error?: string } {
  if (!sql.trim()) return { formatted: '' };

  try {
    const pad = ' '.repeat(indent);
    let s = sql.trim().replace(/\s+/g, ' ');

    // Uppercase recognized multi-word and single-word keywords
    for (const kw of SQL_KEYWORDS) {
      const reg = new RegExp(`\\b${kw.replace(/ /g, '\\s+')}\\b`, 'gi');
      s = s.replace(reg, kw);
    }

    // Split into distinct major clauses
    const majorClauses = [
      'SELECT',
      'FROM',
      'WHERE',
      'LEFT JOIN',
      'RIGHT JOIN',
      'INNER JOIN',
      'OUTER JOIN',
      'FULL JOIN',
      'CROSS JOIN',
      'JOIN',
      'GROUP BY',
      'ORDER BY',
      'HAVING',
      'LIMIT',
      'UNION ALL',
      'UNION',
      'INSERT INTO',
      'VALUES',
      'UPDATE',
      'SET',
      'DELETE FROM',
    ];

    for (const clause of majorClauses) {
      const reg = new RegExp(`(\\s+)(${clause})\\b`, 'g');
      s = s.replace(reg, `\n$2`);
    }

    // Sub-clauses with extra indent (AND, OR, ON)
    const subClauses = ['AND', 'OR', 'ON'];
    for (const sub of subClauses) {
      const reg = new RegExp(`(\\s+)(${sub})\\b`, 'g');
      s = s.replace(reg, `\n${pad}$2`);
    }

    // Indent lines that follow SELECT items
    const lines = s.split('\n').map((l) => l.trimEnd());
    return { formatted: lines.join('\n') };
  } catch (err: any) {
    return { formatted: sql, error: err.message || 'SQL Format Error' };
  }
}

export function minifySql(sql: string): { minified: string; error?: string } {
  if (!sql.trim()) return { minified: '' };
  try {
    const minified = sql.replace(/\s+/g, ' ').trim();
    return { minified };
  } catch (err: any) {
    return { minified: sql, error: err.message || 'SQL Minify Error' };
  }
}
