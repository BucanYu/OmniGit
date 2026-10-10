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

export function getLocale(language?: AppLanguage): LocaleDictionary {
  const lang = language || useAppStore.getState().language || 'zh-CN';
  return dictionaries[lang] || dictionaries['zh-CN'];
}

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
 * When compact (hideSub = true), it ALWAYS preserves Chinese content (never falling back to English)!
 * Also attaches the full bilingual description to the title attribute for mouse hover preview.
 */
export function renderDualText(text: string, hideSub = false): React.ReactNode {
  const match = text.match(/^(.+?)\s*\((.+)\)$/);
  if (!match) {
    return text;
  }
  const [, part1, part2] = match;
  const isPart1Chinese = /[\u4e00-\u9fa5]/.test(part1);
  const isPart2Chinese = /[\u4e00-\u9fa5]/.test(part2);

  // If compact/hideSub is requested, ALWAYS prioritize Chinese!
  if (hideSub) {
    const chinesePart = isPart2Chinese ? part2 : (isPart1Chinese ? part1 : part1);
    return React.createElement(
      'span',
      { className: 'inline-flex items-baseline truncate', title: text },
      React.createElement('span', { className: 'font-medium' }, chinesePart)
    );
  }

  return React.createElement(
    'span',
    { className: 'inline-flex items-baseline truncate', title: text },
    React.createElement('span', { className: 'font-medium' }, part1),
    React.createElement('span', { className: 'ml-1 text-[0.82em] font-normal opacity-70' }, `(${part2})`)
  );
}
