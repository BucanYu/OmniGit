import type { DataTab, DataFormat } from './types';
import { FORMAT_METAS, DEFAULT_SAMPLES, DEFAULT_SAMPLE_JSON } from './defaultSamples';

export const STORAGE_KEY_TABS_V2 = 'omnigit_datatools_tabs_v2';
export const STORAGE_KEY_ACTIVE_TAB = 'omnigit_datatools_active_tab_id';
export const STORAGE_KEY_SPLIT_COMPARE = 'omnigit_datatools_split_compare';
export const STORAGE_KEY_SECONDARY_TAB = 'omnigit_datatools_secondary_tab_id';

export function createNewTab(
  format: DataFormat = 'json',
  customTitle?: string,
  content?: string
): DataTab {
  const meta = FORMAT_METAS.find((m) => m.id === format) || FORMAT_METAS[0];
  const now = Date.now();
  const id = `tab_${now}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    id,
    title: customTitle || meta.defaultTitle,
    format,
    content: content !== undefined ? content : DEFAULT_SAMPLES[format] || '',
    viewMode: 'split',
    indentSize: 2,
    sortKeys: false,
    treeSearchQuery: '',
    expandedPaths: ['$', '$.data', '$.data.activeProjects'],
    editorWidth: 650,
    createdAt: now,
    updatedAt: now,
  };
}

export function loadInitialTabs(): { tabs: DataTab[]; activeTabId: string } {
  if (typeof window === 'undefined') {
    const tab = createNewTab('json', 'JSON 1');
    return { tabs: [tab], activeTabId: tab.id };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_TABS_V2);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_TAB) || parsed[0].id;
        const validActive = parsed.some((t) => t.id === activeId) ? activeId : parsed[0].id;
        return { tabs: parsed, activeTabId: validActive };
      }
    }
  } catch {}

  // Fallback: migrate from legacy single/per-format buffer if any
  let legacyContent = DEFAULT_SAMPLE_JSON;
  try {
    const rawMap = localStorage.getItem('omnigit_datatools_contents');
    if (rawMap) {
      const map = JSON.parse(rawMap);
      if (map && typeof map.json === 'string') legacyContent = map.json;
    }
  } catch {}

  const initialTab = createNewTab('json', 'JSON 1', legacyContent);
  return { tabs: [initialTab], activeTabId: initialTab.id };
}

export function persistTabs(tabs: DataTab[], activeId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_TABS_V2, JSON.stringify(tabs));
    localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, activeId);
  } catch {}
}
