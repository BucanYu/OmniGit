import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { zhCN } from './zh-CN';
import { enUS } from './en-US';
import type { AppLanguage, LocaleDictionary } from './types';

export * from './types';

const dictionaries: Record<AppLanguage, LocaleDictionary> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

export function useTranslation() {
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);

  const t = dictionaries[language] || dictionaries['zh-CN'];

  return {
    t,
    language,
    setLanguage,
    isZh: language === 'zh-CN',
    isEn: language === 'en-US',
  };
}

/**
 * Parses and renders bilingual text like "Commit (提交)" into a two-tier typography span.
 * Main term in regular/bold size, secondary Chinese explanation in lighter font & smaller size.
 * If text is plain or English, it renders as standard string.
 */
export function renderDualText(text: string): React.ReactNode {
  const match = text.match(/^(.+?)\s*\((.+)\)$/);
  if (!match) {
    return text;
  }
  const [, mainPart, subPart] = match;
  return React.createElement(
    'span',
    { className: 'inline-flex items-baseline truncate' },
    React.createElement('span', { className: 'font-medium' }, mainPart),
    React.createElement('span', { className: 'ml-1 text-[0.82em] font-normal opacity-70' }, `(${subPart})`)
  );
}
