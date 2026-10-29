import { create } from 'zustand';
import type { DataFormat, DataViewMode, FormatStats, TreeNodeData, DataTab } from './types';
import {
  DEFAULT_SAMPLES,
  FORMAT_METAS,
  DEFAULT_SAMPLE_JSON,
} from './defaultSamples';
import {
  formatJson,
  minifyJson,
  repairJson,
} from './formatters/jsonFormatter';
import { formatYaml } from './formatters/yamlFormatter';
import { formatXml, minifyXml } from './formatters/xmlFormatter';
import { formatSql, minifySql } from './formatters/sqlFormatter';
import { parseJwt } from './formatters/jwtFormatter';
import { parseUrlQuery } from './formatters/urlFormatter';
import { normalizeBase64 } from './formatters/base64Formatter';
import { calcStatsFor, tryParseJsonDoc, analyzeContent } from './analyzer';
import {
  createNewTab,
  loadInitialTabs,
  persistTabs,
  STORAGE_KEY_SPLIT_COMPARE,
  STORAGE_KEY_SECONDARY_TAB,
} from './tabPersistence';
export { calcStatsFor, tryParseJsonDoc, analyzeContent };

export interface DataToolsState {
  tabs: DataTab[];
  activeTabId: string;
  splitCompareEnabled: boolean;
  secondaryTabId: string | null;

  // Active tab convenience proxies
  formattedContent: string;
  activeFormat: DataFormat;
  viewMode: DataViewMode;
  indentSize: number;
  sortKeys: boolean;
  treeSearchQuery: string;
  expandedPaths: Set<string>;
  stats: FormatStats;
  parsedData: any;
  treeRoot: TreeNodeData | null;
  isTypeModalOpen: boolean;

  // Tab operations
  addTab: (format?: DataFormat, customTitle?: string, initialContent?: string) => string;
  closeTab: (tabId: string) => void;
  setActiveTabId: (tabId: string) => void;
  renameTab: (tabId: string, title: string) => void;
  duplicateTab: (tabId: string) => void;
  setSplitCompareEnabled: (enabled: boolean, secondaryId?: string) => void;
  setSecondaryTabId: (tabId: string | null) => void;

  // Tab content/view updates
  setContent: (content: string, tabId?: string) => void;
  setFormat: (format: DataFormat, tabId?: string) => void;
  setViewMode: (mode: DataViewMode, tabId?: string) => void;
  setIndentSize: (size: number, tabId?: string) => void;
  setSortKeys: (sort: boolean, tabId?: string) => void;
  setTreeSearchQuery: (q: string, tabId?: string) => void;
  setIsTypeModalOpen: (open: boolean) => void;

  formatCurrent: (tabId?: string) => void;
  minifyCurrent: (tabId?: string) => void;
  repairCurrent: (tabId?: string) => void;
  clearContent: (tabId?: string) => void;
  loadSample: (format?: DataFormat, tabId?: string) => void;

  togglePath: (path: string, tabId?: string) => void;
  expandAll: (tabId?: string) => void;
  collapseAll: (tabId?: string) => void;
  collapseToDepth: (depth: number, tabId?: string) => void;
}

export const useDataToolsStore = create<DataToolsState>((set, get) => {
  const { tabs: initialTabs, activeTabId: initialActiveId } = loadInitialTabs();
  const initialSplitCompare =
    typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY_SPLIT_COMPARE) === 'true';
  const initialSecondary =
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SECONDARY_TAB) : null;

  const syncActiveState = (tabs: DataTab[], activeId: string) => {
    const activeTab = tabs.find((t) => t.id === activeId) || tabs[0];
    const { parsed, tree, stats } = analyzeContent(activeTab.content, activeTab.format);
    return {
      tabs,
      activeTabId: activeTab.id,
      formattedContent: activeTab.content,
      activeFormat: activeTab.format,
      viewMode: activeTab.viewMode,
      indentSize: activeTab.indentSize,
      sortKeys: activeTab.sortKeys,
      treeSearchQuery: activeTab.treeSearchQuery,
      expandedPaths: new Set(activeTab.expandedPaths || ['$']),
      stats,
      parsedData: parsed,
      treeRoot: tree,
    };
  };

  const initialSync = syncActiveState(initialTabs, initialActiveId);

  return {
    ...initialSync,
    splitCompareEnabled: initialSplitCompare,
    secondaryTabId: initialSecondary,
    isTypeModalOpen: false,

    addTab: (format = 'json', customTitle, initialContent) => {
      const { tabs, activeTabId } = get();
      const meta = FORMAT_METAS.find((m) => m.id === format) || FORMAT_METAS[0];
      const sameFormatCount = tabs.filter((t) => t.format === format).length;
      const title = customTitle || `${meta.defaultTitle} ${sameFormatCount + 1}`;
      const newTab = createNewTab(format, title, initialContent);
      const nextTabs = [...tabs, newTab];
      persistTabs(nextTabs, newTab.id);
      set(syncActiveState(nextTabs, newTab.id));
      return newTab.id;
    },

    closeTab: (tabId) => {
      const { tabs, activeTabId, secondaryTabId } = get();
      if (tabs.length <= 1) {
        // At least one tab always stays: reset content
        const resetTab = createNewTab('json', 'JSON 1');
        const nextTabs = [resetTab];
        persistTabs(nextTabs, resetTab.id);
        set(syncActiveState(nextTabs, resetTab.id));
        return;
      }
      const closeIndex = tabs.findIndex((t) => t.id === tabId);
      const nextTabs = tabs.filter((t) => t.id !== tabId);
      let nextActive = activeTabId;
      if (activeTabId === tabId) {
        const nextIndex = Math.min(closeIndex, nextTabs.length - 1);
        nextActive = nextTabs[nextIndex].id;
      }
      let nextSecondary = secondaryTabId;
      if (secondaryTabId === tabId) {
        nextSecondary = nextTabs.find((t) => t.id !== nextActive)?.id || null;
      }
      persistTabs(nextTabs, nextActive);
      set({
        ...syncActiveState(nextTabs, nextActive),
        secondaryTabId: nextSecondary,
      });
    },

    setActiveTabId: (tabId) => {
      const { tabs, activeTabId } = get();
      if (tabId === activeTabId) return;
      const target = tabs.find((t) => t.id === tabId);
      if (!target) return;
      persistTabs(tabs, tabId);
      set(syncActiveState(tabs, tabId));
    },

    renameTab: (tabId, title) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const { tabs, activeTabId } = get();
      const nextTabs = tabs.map((t) => (t.id === tabId ? { ...t, title: trimmed, updatedAt: Date.now() } : t));
      persistTabs(nextTabs, activeTabId);
      set({ tabs: nextTabs });
    },

    duplicateTab: (tabId) => {
      const { tabs } = get();
      const source = tabs.find((t) => t.id === tabId);
      if (!source) return;
      get().addTab(source.format, `${source.title} (副本)`, source.content);
    },

    setSplitCompareEnabled: (enabled, secondaryId) => {
      const { tabs, activeTabId } = get();
      let targetSecondary = secondaryId !== undefined ? secondaryId : get().secondaryTabId;
      if (enabled) {
        if (!targetSecondary || targetSecondary === activeTabId || !tabs.some((t) => t.id === targetSecondary)) {
          const candidate = tabs.find((t) => t.id !== activeTabId);
          if (candidate) {
            targetSecondary = candidate.id;
          } else {
            // Auto-create a second window of current format for immediate comparison
            const currentTab = tabs.find((t) => t.id === activeTabId);
            const newId = get().addTab(currentTab?.format || 'json', undefined, currentTab?.content);
            targetSecondary = newId;
          }
        }
      }
      try {
        localStorage.setItem(STORAGE_KEY_SPLIT_COMPARE, String(enabled));
        if (targetSecondary) localStorage.setItem(STORAGE_KEY_SECONDARY_TAB, targetSecondary);
      } catch {}
      set({ splitCompareEnabled: enabled, secondaryTabId: targetSecondary });
    },

    setSecondaryTabId: (tabId) => {
      try {
        if (tabId) localStorage.setItem(STORAGE_KEY_SECONDARY_TAB, tabId);
      } catch {}
      set({ secondaryTabId: tabId });
    },

    setContent: (content, targetTabId) => {
      const { tabs, activeTabId } = get();
      const tabId = targetTabId || activeTabId;
      const nextTabs = tabs.map((t) => (t.id === tabId ? { ...t, content, updatedAt: Date.now() } : t));
      persistTabs(nextTabs, activeTabId);
      set(syncActiveState(nextTabs, activeTabId));
    },

    setFormat: (format, targetTabId) => {
      const { tabs, activeTabId } = get();
      const tabId = targetTabId || activeTabId;
      const target = tabs.find((t) => t.id === tabId);
      if (!target || target.format === format) return;
      const meta = FORMAT_METAS.find((m) => m.id === format) || FORMAT_METAS[0];
      const nextTabs = tabs.map((t) =>
        t.id === tabId ? { ...t, format, title: meta.defaultTitle, updatedAt: Date.now() } : t
      );
      persistTabs(nextTabs, activeTabId);
      set(syncActiveState(nextTabs, activeTabId));
      get().formatCurrent(tabId);
    },

    setViewMode: (mode, targetTabId) => {
      const { tabs, activeTabId } = get();
      const tabId = targetTabId || activeTabId;
      const nextTabs = tabs.map((t) => (t.id === tabId ? { ...t, viewMode: mode, updatedAt: Date.now() } : t));
      persistTabs(nextTabs, activeTabId);
      set(syncActiveState(nextTabs, activeTabId));
    },

    setIndentSize: (size, targetTabId) => {
      const { tabs, activeTabId } = get();
      const tabId = targetTabId || activeTabId;
      const nextTabs = tabs.map((t) => (t.id === tabId ? { ...t, indentSize: size } : t));
      persistTabs(nextTabs, activeTabId);
      set(syncActiveState(nextTabs, activeTabId));
      get().formatCurrent(tabId);
    },

    setSortKeys: (sort, targetTabId) => {
      const { tabs, activeTabId } = get();
      const tabId = targetTabId || activeTabId;
      const nextTabs = tabs.map((t) => (t.id === tabId ? { ...t, sortKeys: sort } : t));
      persistTabs(nextTabs, activeTabId);
      set(syncActiveState(nextTabs, activeTabId));
      get().formatCurrent(tabId);
    },

    setTreeSearchQuery: (q, targetTabId) => {
      const { tabs, activeTabId } = get();
      const tabId = targetTabId || activeTabId;
      const nextTabs = tabs.map((t) => (t.id === tabId ? { ...t, treeSearchQuery: q } : t));
      set(syncActiveState(nextTabs, activeTabId));
    },

    setIsTypeModalOpen: (open) => set({ isTypeModalOpen: open }),

    formatCurrent: (targetTabId) => {
      const { tabs, activeTabId } = get();
      const tabId = targetTabId || activeTabId;
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab || !tab.content.trim()) return;

      let formatted = tab.content;
      if (tab.format === 'json') {
        const res = formatJson(tab.content, tab.indentSize, tab.sortKeys);
        formatted = res.formatted;
      } else if (tab.format === 'yaml') {
        formatted = formatYaml(tab.content, tab.indentSize).formatted;
      } else if (tab.format === 'xml') {
        formatted = formatXml(tab.content, tab.indentSize).formatted;
      } else if (tab.format === 'sql') {
        formatted = formatSql(tab.content, tab.indentSize).formatted;
      } else if (tab.format === 'jwt') {
        const jsonView = tryParseJsonDoc(tab.content);
        if (jsonView) formatted = JSON.stringify(jsonView, null, tab.indentSize);
        else formatted = parseJwt(tab.content).formattedJson;
      } else if (tab.format === 'url') {
        const jsonView = tryParseJsonDoc(tab.content);
        if (jsonView) formatted = JSON.stringify(jsonView, null, tab.indentSize);
        else formatted = parseUrlQuery(tab.content).formattedJson;
      } else if (tab.format === 'base64') {
        formatted = normalizeBase64(tab.content);
      }
      get().setContent(formatted, tabId);
    },

    minifyCurrent: (targetTabId) => {
      const { tabs, activeTabId } = get();
      const tabId = targetTabId || activeTabId;
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab || !tab.content.trim()) return;

      let minified = tab.content;
      if (tab.format === 'json') {
        minified = minifyJson(tab.content).minified;
      } else if (tab.format === 'xml') {
        minified = minifyXml(tab.content).minified;
      } else if (tab.format === 'sql') {
        minified = minifySql(tab.content).minified;
      } else if (tab.format === 'base64') {
        minified = tab.content.replace(/\s+/g, '');
      } else {
        const jsonView = tryParseJsonDoc(tab.content);
        if (jsonView) minified = JSON.stringify(jsonView);
        else minified = tab.content.replace(/\s+/g, ' ').trim();
      }
      get().setContent(minified, tabId);
    },

    repairCurrent: (targetTabId) => {
      const { tabs, activeTabId } = get();
      const tabId = targetTabId || activeTabId;
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      const res = repairJson(tab.content);
      if (res.success) get().setContent(res.repaired, tabId);
    },

    clearContent: (targetTabId) => {
      get().setContent('', targetTabId);
    },

    loadSample: (format, targetTabId) => {
      const { tabs, activeTabId } = get();
      const tabId = targetTabId || activeTabId;
      const tab = tabs.find((t) => t.id === tabId);
      const fmt = format || tab?.format || 'json';
      const sample = DEFAULT_SAMPLES[fmt] || '';
      get().setContent(sample, tabId);
      if (tab && tab.format !== fmt) {
        get().setFormat(fmt, tabId);
      }
    },

    togglePath: (path, targetTabId) => {
      const { tabs, activeTabId } = get();
      const tabId = targetTabId || activeTabId;
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      const current = new Set(tab.expandedPaths || ['$']);
      if (current.has(path)) current.delete(path);
      else current.add(path);
      const nextTabs = tabs.map((t) =>
        t.id === tabId ? { ...t, expandedPaths: Array.from(current) } : t
      );
      persistTabs(nextTabs, activeTabId);
      set(syncActiveState(nextTabs, activeTabId));
    },

    expandAll: (targetTabId) => {
      const { tabs, activeTabId, treeRoot } = get();
      const tabId = targetTabId || activeTabId;
      if (!treeRoot) return;
      const allPaths = new Set<string>();
      const collect = (node: TreeNodeData) => {
        allPaths.add(node.path);
        if (node.children) node.children.forEach(collect);
      };
      collect(treeRoot);
      const nextTabs = tabs.map((t) =>
        t.id === tabId ? { ...t, expandedPaths: Array.from(allPaths) } : t
      );
      persistTabs(nextTabs, activeTabId);
      set(syncActiveState(nextTabs, activeTabId));
    },

    collapseAll: (targetTabId) => {
      const { tabs, activeTabId } = get();
      const tabId = targetTabId || activeTabId;
      const nextTabs = tabs.map((t) => (t.id === tabId ? { ...t, expandedPaths: ['$'] } : t));
      persistTabs(nextTabs, activeTabId);
      set(syncActiveState(nextTabs, activeTabId));
    },

    collapseToDepth: (targetDepth, targetTabId) => {
      const { tabs, activeTabId, treeRoot } = get();
      const tabId = targetTabId || activeTabId;
      if (!treeRoot) return;
      const validPaths = new Set<string>();
      const collect = (node: TreeNodeData) => {
        if (node.depth < targetDepth) validPaths.add(node.path);
        if (node.children) node.children.forEach(collect);
      };
      collect(treeRoot);
      const nextTabs = tabs.map((t) =>
        t.id === tabId ? { ...t, expandedPaths: Array.from(validPaths) } : t
      );
      persistTabs(nextTabs, activeTabId);
      set(syncActiveState(nextTabs, activeTabId));
    },
  };
});
