import { create } from 'zustand';
import type { DataFormat, DataViewMode, FormatStats, TreeNodeData } from './types';
import { formatJson, minifyJson, repairJson, calcJsonStats, calcTextStats, buildJsonTree } from './formatters/jsonFormatter';
import { formatYaml, parseYamlObject } from './formatters/yamlFormatter';
import { formatXml, minifyXml } from './formatters/xmlFormatter';
import { formatSql, minifySql } from './formatters/sqlFormatter';
import { parseJwt } from './formatters/jwtFormatter';
import { parseUrlQuery } from './formatters/urlFormatter';
import { normalizeBase64, decodeBase64 } from './formatters/base64Formatter';

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

const DEFAULT_SAMPLE_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: omnigit-core-service
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: omnigit-core
  template:
    metadata:
      labels:
        app: omnigit-core
    spec:
      containers:
        - name: core
          image: omnigit/engine:0.6.1
          ports:
            - containerPort: 5345`;

const DEFAULT_SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.omnigit</groupId>
  <artifactId>omnigit-server</artifactId>
  <version>0.6.1</version>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
  </dependencies>
</project>`;

const DEFAULT_SAMPLE_SQL = `SELECT u.id, u.username, u.email, count(c.id) AS total_commits FROM users u LEFT JOIN commits c ON u.id = c.author_id WHERE u.status = 'ACTIVE' AND c.created_at >= '2026-01-01' GROUP BY u.id, u.username, u.email HAVING count(c.id) > 10 ORDER BY total_commits DESC LIMIT 50;`;

const DEFAULT_SAMPLE_JWT = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFsZXggRGV2Iiwicm9sZXMiOlsic3VwZXJfYWRtaW4iLCJkZXZlbG9wZXIiXSwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE3OTMwMDAwMDB9.signature_placeholder`;

const DEFAULT_SAMPLE_URL = `https://api.omnigit.dev/v1/repositories?workspace=ws_1789&filter=active&sort=updated_desc&page=1&pageSize=20&tags=java&tags=react`;

const DEFAULT_SAMPLE_BASE64 = 'T21uaUdpdCBEYXRhIFRvb2xzIC0gQmFzZTY0IHNhbXBsZSBwYXlsb2Fk';

/** Per-format default sample documents. Each tab is an independent document. */
const DEFAULT_SAMPLES: Record<DataFormat, string> = {
  json: DEFAULT_SAMPLE_JSON,
  yaml: DEFAULT_SAMPLE_YAML,
  xml: DEFAULT_SAMPLE_XML,
  sql: DEFAULT_SAMPLE_SQL,
  jwt: DEFAULT_SAMPLE_JWT,
  url: DEFAULT_SAMPLE_URL,
  base64: DEFAULT_SAMPLE_BASE64,
};

/**
 * Stats dispatch: only JSON content goes through JSON.parse validation,
 * other formats (yaml/xml/sql) get basic text stats to avoid false syntax errors.
 */
function calcStatsFor(content: string, format: DataFormat): FormatStats {
  return format === 'json' ? calcJsonStats(content) : calcTextStats(content);
}

/** Parse the document of a given format into { parsed, tree, stats }. */
function analyzeContent(
  content: string,
  format: DataFormat
): { parsed: any; tree: TreeNodeData | null; stats: FormatStats } {
  let parsed: any = null;
  let tree: TreeNodeData | null = null;

  if (format === 'json') {
    try {
      parsed = JSON.parse(content);
      tree = buildJsonTree(parsed);
    } catch {}
  } else if (format === 'jwt') {
    const jwt = parseJwt(content);
    if (jwt.payload) {
      parsed = { header: jwt.header, payload: jwt.payload };
      tree = buildJsonTree(parsed);
    }
  } else if (format === 'url') {
    const u = parseUrlQuery(content);
    if (u.parsed) {
      parsed = u.parsed;
      tree = buildJsonTree(u.parsed);
    }
  } else if (format === 'yaml') {
    const y = parseYamlObject(content);
    if (y !== null && typeof y === 'object') {
      parsed = y;
      tree = buildJsonTree(y);
    }
  } else if (format === 'base64') {
    // Base64 is never rewritten here: the editor keeps the source, the tree only
    // shows a read-only decoded preview.
    const info = decodeBase64(content);
    if (info.valid) {
      const PREVIEW_LIMIT = 2000;
      const preview =
        info.text === null
          ? null
          : info.text.length > PREVIEW_LIMIT
            ? `${info.text.slice(0, PREVIEW_LIMIT)}…`
            : info.text;
      parsed = {
        valid: true,
        decodedBytes: info.byteLength,
        decodedType: info.binary ? 'binary' : 'text',
        decodedText: preview,
      };
      tree = buildJsonTree(parsed);
    }
  }

  return { parsed, tree, stats: calcStatsFor(content, format) };
}

interface DataToolsState {
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

const STORAGE_KEY_CONTENTS = 'omnigit_datatools_contents';
const STORAGE_KEY_LEGACY_CONTENT = 'omnigit_datatools_content';
const STORAGE_KEY_FORMAT = 'omnigit_datatools_format';
const STORAGE_KEY_VIEW = 'omnigit_datatools_view';

export const useDataToolsStore = create<DataToolsState>((set, get) => {
  const initialFormat =
    ((typeof window !== 'undefined' &&
      localStorage.getItem(STORAGE_KEY_FORMAT)) as DataFormat) || 'json';
  const initialViewMode =
    ((typeof window !== 'undefined' &&
      localStorage.getItem(STORAGE_KEY_VIEW)) as DataViewMode) || 'split';

  // Each format owns an independent document buffer (no cross-tab content leaking).
  const contentByFormat: Partial<Record<DataFormat, string>> = {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CONTENTS);
    if (stored) {
      const map = JSON.parse(stored);
      if (map && typeof map === 'object') {
        (Object.keys(DEFAULT_SAMPLES) as DataFormat[]).forEach((f) => {
          if (typeof map[f] === 'string') contentByFormat[f] = map[f];
        });
      }
    } else {
      // Migrate the legacy single-buffer content into the persisted active format.
      // Historical bug: one shared buffer leaked content across tabs, so the legacy
      // text may not even match the persisted format (e.g. YAML text under "json").
      const legacy = localStorage.getItem(STORAGE_KEY_LEGACY_CONTENT);
      if (legacy) {
        if (initialFormat === 'json') {
          let validJson = false;
          try {
            JSON.parse(legacy);
            validJson = true;
          } catch {}
          if (validJson) {
            contentByFormat.json = legacy;
          } else {
            // Rescue stray YAML text into its own YAML buffer instead of poisoning JSON
            const y = parseYamlObject(legacy);
            if (y !== null && typeof y === 'object') contentByFormat.yaml = legacy;
          }
        } else {
          contentByFormat[initialFormat] = legacy;
        }
      }
    }
  } catch {}

  const persistContents = () => {
    try {
      localStorage.setItem(STORAGE_KEY_CONTENTS, JSON.stringify(contentByFormat));
    } catch {}
  };

  /** Resolve the document for a format: user buffer first, default sample otherwise. */
  const resolveContent = (format: DataFormat): string =>
    contentByFormat[format] !== undefined ? (contentByFormat[format] as string) : DEFAULT_SAMPLES[format];

  /** Commit a new document for a format (buffer + persisted + reactive state). */
  const commitContent = (
    format: DataFormat,
    content: string,
    parsed: any,
    tree: TreeNodeData | null,
    stats: FormatStats
  ) => {
    contentByFormat[format] = content;
    persistContents();
    set({ formattedContent: content, parsedData: parsed, treeRoot: tree, stats });
  };

  const initialContent = resolveContent(initialFormat);
  const initialAnalysis = analyzeContent(initialContent, initialFormat);
  const initialExpanded = new Set<string>(['$', '$.data', '$.data.activeProjects']);

  return {
    formattedContent: initialContent,
    activeFormat: initialFormat,
    viewMode: initialViewMode,
    indentSize: 2,
    sortKeys: false,
    treeSearchQuery: '',
    expandedPaths: initialExpanded,
    stats: initialAnalysis.stats,
    parsedData: initialAnalysis.parsed,
    treeRoot: initialAnalysis.tree,
    isTypeModalOpen: false,

    setContent: (content: string) => {
      const { activeFormat } = get();
      const { parsed, tree, stats } = analyzeContent(content, activeFormat);
      commitContent(activeFormat, content, parsed, tree, stats);
    },

    setFormat: (format: DataFormat) => {
      try {
        localStorage.setItem(STORAGE_KEY_FORMAT, format);
      } catch {}
      if (format === get().activeFormat) return;
      const content = resolveContent(format);
      const { parsed, tree, stats } = analyzeContent(content, format);
      set({
        activeFormat: format,
        formattedContent: content,
        parsedData: parsed,
        treeRoot: tree,
        stats,
      });
      // Apply the format's own display transform on the freshly loaded buffer
      // (e.g. JWT token -> decoded JSON view). Works on this tab's own document,
      // so it can never leak content into another format.
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
      const { formattedContent: doc, activeFormat, indentSize, sortKeys } = get();
      if (!doc.trim()) return;

      if (activeFormat === 'json') {
        const res = formatJson(doc, indentSize, sortKeys);
        let tree: TreeNodeData | null = null;
        if (res.parsed) {
          tree = buildJsonTree(res.parsed);
        }
        commitContent(activeFormat, res.formatted, res.parsed, tree, calcJsonStats(res.formatted));
      } else if (activeFormat === 'yaml') {
        const res = formatYaml(doc, indentSize);
        let tree: TreeNodeData | null = null;
        if (res.parsed !== null && res.parsed !== undefined && typeof res.parsed === 'object') {
          tree = buildJsonTree(res.parsed);
        }
        commitContent(activeFormat, res.formatted, res.parsed ?? null, tree, calcTextStats(res.formatted));
      } else if (activeFormat === 'xml') {
        const res = formatXml(doc, indentSize);
        commitContent(activeFormat, res.formatted, null, null, calcTextStats(res.formatted));
      } else if (activeFormat === 'sql') {
        const res = formatSql(doc, indentSize);
        commitContent(activeFormat, res.formatted, null, null, calcTextStats(res.formatted));
      } else if (activeFormat === 'jwt') {
        const res = parseJwt(doc);
        let tree: TreeNodeData | null = null;
        if (res.payload) {
          tree = buildJsonTree({ header: res.header, payload: res.payload });
        }
        commitContent(activeFormat, res.formattedJson, res.payload, tree, calcJsonStats(res.formattedJson));
      } else if (activeFormat === 'url') {
        const res = parseUrlQuery(doc);
        let tree: TreeNodeData | null = null;
        if (res.parsed) {
          tree = buildJsonTree(res.parsed);
        }
        commitContent(activeFormat, res.formattedJson, res.parsed, tree, calcJsonStats(res.formattedJson));
      } else if (activeFormat === 'base64') {
        // Beautify = normalize only (strip whitespace, fix padding).
        // Never decode into the editor: decoding is a read-only preview shown in the tree.
        const normalized = normalizeBase64(doc);
        const { parsed, tree } = analyzeContent(normalized, activeFormat);
        commitContent(activeFormat, normalized, parsed, tree, calcTextStats(normalized));
      }
    },

    minifyCurrent: () => {
      const { formattedContent: doc, activeFormat } = get();
      if (!doc.trim()) return;

      if (activeFormat === 'json') {
        const res = minifyJson(doc);
        const { parsed, tree } = analyzeContent(res.minified, activeFormat);
        commitContent(activeFormat, res.minified, parsed, tree, calcJsonStats(res.minified));
      } else if (activeFormat === 'xml') {
        const res = minifyXml(doc);
        commitContent(activeFormat, res.minified, null, null, calcTextStats(res.minified));
      } else if (activeFormat === 'sql') {
        const res = minifySql(doc);
        commitContent(activeFormat, res.minified, null, null, calcTextStats(res.minified));
      } else if (activeFormat === 'yaml') {
        // YAML minification is not safe: collapsing whitespace would break indentation.
        // Keep the content as-is to avoid destroying the structure.
        const { parsed, tree } = analyzeContent(doc, activeFormat);
        commitContent(activeFormat, doc, parsed, tree, calcTextStats(doc));
      } else if (activeFormat === 'base64') {
        // Base64 minify = strip whitespace/padding-line breaks only; never re-encode.
        const compact = doc.replace(/\s+/g, '');
        const { parsed, tree } = analyzeContent(compact, activeFormat);
        commitContent(activeFormat, compact, parsed, tree, calcTextStats(compact));
      } else {
        const minified = doc.replace(/\s+/g, ' ').trim();
        commitContent(activeFormat, minified, null, null, calcTextStats(minified));
      }
    },

    repairCurrent: () => {
      const { formattedContent: doc } = get();
      const res = repairJson(doc);
      if (res.success) {
        get().setContent(res.repaired);
      }
    },

    clearContent: () => {
      get().setContent('');
    },

    loadSample: (format = 'json') => {
      contentByFormat[format] = DEFAULT_SAMPLES[format] ?? '';
      persistContents();
      if (get().activeFormat === format) {
        const content = contentByFormat[format] as string;
        const { parsed, tree, stats } = analyzeContent(content, format);
        set({ formattedContent: content, parsedData: parsed, treeRoot: tree, stats });
      } else {
        get().setFormat(format);
      }
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
