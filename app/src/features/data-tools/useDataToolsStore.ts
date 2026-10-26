import { create } from 'zustand';
import type { DataFormat, DataViewMode, FormatStats, TreeNodeData } from './types';
import { formatJson, minifyJson, repairJson, calcJsonStats, buildJsonTree } from './formatters/jsonFormatter';
import { formatYaml } from './formatters/yamlFormatter';
import { formatXml, minifyXml } from './formatters/xmlFormatter';
import { formatSql, minifySql } from './formatters/sqlFormatter';
import { parseJwt } from './formatters/jwtFormatter';
import { parseUrlQuery } from './formatters/urlFormatter';

const DEFAULT_SAMPLE_JSON = JSON.stringify(
  {
    code: 200,
    message: 'success',
    data: {
      workspace: 'OmniGit Production Hub',
      version: '0.6.1',
      activeProjects: [
        {
          id: 101,
          name: 'cloud-gateway-service',
          status: 'running',
          port: 8080,
          tags: ['microservice', 'gateway', 'spring-cloud'],
          metrics: { cpu: 12.5, memoryMb: 512, qps: 1420 },
        },
        {
          id: 102,
          name: 'user-auth-service',
          status: 'running',
          port: 8081,
          tags: ['microservice', 'auth', 'jwt'],
          metrics: { cpu: 8.2, memoryMb: 384, qps: 890 },
        },
        {
          id: 103,
          name: 'frontend-portal-web',
          status: 'stopped',
          port: 3000,
          tags: ['frontend', 'react', 'vite'],
          metrics: { cpu: 0, memoryMb: 0, qps: 0 },
        },
      ],
      featuresEnabled: {
        autoSync: true,
        antiRceSandbox: true,
        interactiveCodeFolding: true,
      },
    },
    timestamp: 1793000000000,
  },
  null,
  2
);

interface DataToolsState {
  rawContent: string;
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

  // Actions
  setContent: (content: string) => void;
  setFormat: (format: DataFormat) => void;
  setViewMode: (mode: DataViewMode) => void;
  setIndentSize: (size: number) => void;
  setSortKeys: (sort: boolean) => void;
  setTreeSearchQuery: (q: string) => void;
  setIsTypeModalOpen: (open: boolean) => void;

  formatCurrent: () => void;
  minifyCurrent: () => void;
  repairCurrent: () => void;
  clearContent: () => void;
  loadSample: (format?: DataFormat) => void;

  togglePath: (path: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  collapseToDepth: (depth: number) => void;
}

const STORAGE_KEY_CONTENT = 'omnigit_datatools_content';
const STORAGE_KEY_FORMAT = 'omnigit_datatools_format';
const STORAGE_KEY_VIEW = 'omnigit_datatools_view';

export const useDataToolsStore = create<DataToolsState>((set, get) => {
  const initialContent =
    (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY_CONTENT)) ||
    DEFAULT_SAMPLE_JSON;
  const initialFormat =
    ((typeof window !== 'undefined' &&
      localStorage.getItem(STORAGE_KEY_FORMAT)) as DataFormat) || 'json';
  const initialViewMode =
    ((typeof window !== 'undefined' &&
      localStorage.getItem(STORAGE_KEY_VIEW)) as DataViewMode) || 'split';

  // Compute initial stats & tree
  const initialStats = calcJsonStats(initialContent);
  let initialParsed: any = null;
  let initialTree: TreeNodeData | null = null;
  const initialExpanded = new Set<string>(['$', '$.data', '$.data.activeProjects']);

  try {
    initialParsed = JSON.parse(initialContent);
    initialTree = buildJsonTree(initialParsed);
  } catch {}

  return {
    rawContent: initialContent,
    formattedContent: initialContent,
    activeFormat: initialFormat,
    viewMode: initialViewMode,
    indentSize: 2,
    sortKeys: false,
    treeSearchQuery: '',
    expandedPaths: initialExpanded,
    stats: initialStats,
    parsedData: initialParsed,
    treeRoot: initialTree,
    isTypeModalOpen: false,

    setContent: (content: string) => {
      try {
        localStorage.setItem(STORAGE_KEY_CONTENT, content);
      } catch {}

      const { activeFormat, indentSize, sortKeys } = get();
      let parsed: any = null;
      let tree: TreeNodeData | null = null;
      const stats = calcJsonStats(content);

      if (activeFormat === 'json') {
        try {
          parsed = JSON.parse(content);
          tree = buildJsonTree(parsed);
        } catch {}
      } else if (activeFormat === 'jwt') {
        const jwt = parseJwt(content);
        if (jwt.payload) {
          parsed = { header: jwt.header, payload: jwt.payload };
          tree = buildJsonTree(parsed);
        }
      } else if (activeFormat === 'url') {
        const u = parseUrlQuery(content);
        if (u.parsed) {
          parsed = u.parsed;
          tree = buildJsonTree(parsed);
        }
      }

      set({
        rawContent: content,
        formattedContent: content,
        stats,
        parsedData: parsed,
        treeRoot: tree,
      });
    },

    setFormat: (format: DataFormat) => {
      try {
        localStorage.setItem(STORAGE_KEY_FORMAT, format);
      } catch {}
      set({ activeFormat: format });
      get().formatCurrent();
    },

    setViewMode: (mode: DataViewMode) => {
      try {
        localStorage.setItem(STORAGE_KEY_VIEW, mode);
      } catch {}
      set({ viewMode: mode });
    },

    setIndentSize: (size: number) => {
      set({ indentSize: size });
      get().formatCurrent();
    },

    setSortKeys: (sort: boolean) => {
      set({ sortKeys: sort });
      get().formatCurrent();
    },

    setTreeSearchQuery: (q: string) => set({ treeSearchQuery: q }),
    setIsTypeModalOpen: (open: boolean) => set({ isTypeModalOpen: open }),

    formatCurrent: () => {
      const { rawContent, activeFormat, indentSize, sortKeys } = get();
      if (!rawContent.trim()) return;

      if (activeFormat === 'json') {
        const res = formatJson(rawContent, indentSize, sortKeys);
        let tree: TreeNodeData | null = null;
        if (res.parsed) {
          tree = buildJsonTree(res.parsed);
        }
        set({
          formattedContent: res.formatted,
          parsedData: res.parsed,
          treeRoot: tree,
          stats: calcJsonStats(res.formatted),
        });
      } else if (activeFormat === 'yaml') {
        const res = formatYaml(rawContent, indentSize);
        set({ formattedContent: res.formatted, stats: calcJsonStats(res.formatted) });
      } else if (activeFormat === 'xml') {
        const res = formatXml(rawContent, indentSize);
        set({ formattedContent: res.formatted, stats: calcJsonStats(res.formatted) });
      } else if (activeFormat === 'sql') {
        const res = formatSql(rawContent, indentSize);
        set({ formattedContent: res.formatted, stats: calcJsonStats(res.formatted) });
      } else if (activeFormat === 'jwt') {
        const res = parseJwt(rawContent);
        let tree: TreeNodeData | null = null;
        if (res.payload) {
          tree = buildJsonTree({ header: res.header, payload: res.payload });
        }
        set({
          formattedContent: res.formattedJson,
          parsedData: res.payload,
          treeRoot: tree,
          stats: calcJsonStats(res.formattedJson),
        });
      } else if (activeFormat === 'url') {
        const res = parseUrlQuery(rawContent);
        let tree: TreeNodeData | null = null;
        if (res.parsed) {
          tree = buildJsonTree(res.parsed);
        }
        set({
          formattedContent: res.formattedJson,
          parsedData: res.parsed,
          treeRoot: tree,
          stats: calcJsonStats(res.formattedJson),
        });
      } else if (activeFormat === 'base64') {
        try {
          const decoded = atob(rawContent.trim());
          set({ formattedContent: decoded });
        } catch {
          const encoded = btoa(rawContent);
          set({ formattedContent: encoded });
        }
      }
    },

    minifyCurrent: () => {
      const { rawContent, activeFormat } = get();
      if (!rawContent.trim()) return;

      if (activeFormat === 'json') {
        const res = minifyJson(rawContent);
        set({ formattedContent: res.minified, stats: calcJsonStats(res.minified) });
      } else if (activeFormat === 'xml') {
        const res = minifyXml(rawContent);
        set({ formattedContent: res.minified, stats: calcJsonStats(res.minified) });
      } else if (activeFormat === 'sql') {
        const res = minifySql(rawContent);
        set({ formattedContent: res.minified, stats: calcJsonStats(res.minified) });
      } else {
        const minified = rawContent.replace(/\s+/g, ' ').trim();
        set({ formattedContent: minified });
      }
    },

    repairCurrent: () => {
      const { rawContent } = get();
      const res = repairJson(rawContent);
      if (res.success) {
        get().setContent(res.repaired);
      }
    },

    clearContent: () => {
      get().setContent('');
    },

    loadSample: (format = 'json') => {
      if (format === 'json') {
        get().setContent(DEFAULT_SAMPLE_JSON);
      } else if (format === 'yaml') {
        get().setContent(
          `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: omnigit-core-service\n  namespace: default\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: omnigit-core\n  template:\n    metadata:\n      labels:\n        app: omnigit-core\n    spec:\n      containers:\n        - name: core\n          image: omnigit/engine:0.6.1\n          ports:\n            - containerPort: 5345`
        );
      } else if (format === 'xml') {
        get().setContent(
          `<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0">\n  <modelVersion>4.0.0</modelVersion>\n  <groupId>com.omnigit</groupId>\n  <artifactId>omnigit-server</artifactId>\n  <version>0.6.1</version>\n  <dependencies>\n    <dependency>\n      <groupId>org.springframework.boot</groupId>\n      <artifactId>spring-boot-starter-web</artifactId>\n    </dependency>\n  </dependencies>\n</project>`
        );
      } else if (format === 'sql') {
        get().setContent(
          `SELECT u.id, u.username, u.email, count(c.id) AS total_commits FROM users u LEFT JOIN commits c ON u.id = c.author_id WHERE u.status = 'ACTIVE' AND c.created_at >= '2026-01-01' GROUP BY u.id, u.username, u.email HAVING count(c.id) > 10 ORDER BY total_commits DESC LIMIT 50;`
        );
      } else if (format === 'jwt') {
        get().setContent(
          `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFsZXggRGV2Iiwicm9sZXMiOlsic3VwZXJfYWRtaW4iLCJkZXZlbG9wZXIiXSwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE3OTMwMDAwMDB9.signature_placeholder`
        );
      } else if (format === 'url') {
        get().setContent(
          `https://api.omnigit.dev/v1/repositories?workspace=ws_1789&filter=active&sort=updated_desc&page=1&pageSize=20&tags=java&tags=react`
        );
      }
      get().setFormat(format);
    },

    togglePath: (path: string) => {
      const { expandedPaths } = get();
      const next = new Set(expandedPaths);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      set({ expandedPaths: next });
    },

    expandAll: () => {
      const { treeRoot } = get();
      if (!treeRoot) return;
      const allPaths = new Set<string>();
      function collect(node: TreeNodeData) {
        allPaths.add(node.path);
        if (node.children) {
          node.children.forEach(collect);
        }
      }
      collect(treeRoot);
      set({ expandedPaths: allPaths });
    },

    collapseAll: () => {
      set({ expandedPaths: new Set(['$']) });
    },

    collapseToDepth: (targetDepth: number) => {
      const { treeRoot } = get();
      if (!treeRoot) return;
      const validPaths = new Set<string>();
      function collect(node: TreeNodeData) {
        if (node.depth < targetDepth) {
          validPaths.add(node.path);
        }
        if (node.children) {
          node.children.forEach(collect);
        }
      }
      collect(treeRoot);
      set({ expandedPaths: validPaths });
    },
  };
});
