export type DataFormat =
  | 'json'
  | 'yaml'
  | 'xml'
  | 'sql'
  | 'jwt'
  | 'url'
  | 'base64'
  | 'timestamp'
  | 'hash'
  | 'regex';

export type DataViewMode = 'split' | 'editor' | 'tree' | 'table';

export type JsonValueType =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null';

export interface TreeNodeData {
  id: string;
  key: string;
  value: any;
  type: JsonValueType;
  path: string;
  depth: number;
  count?: number; // length for array, key count for object
  children?: TreeNodeData[];
}

export interface FormatOptions {
  indent: number; // 2, 4, etc.
  sortKeys: boolean;
}

export interface FormatStats {
  charCount: number;
  lineCount: number;
  byteSize: string;
  minifiedSize?: string;
  reductionPercentage?: string;
  depth?: number;
  keyCount?: number;
  arrayCount?: number;
  isValid: boolean;
  errorMessage?: string;
  errorLine?: number;
  errorColumn?: number;
}

export interface DataTab {
  id: string;
  title: string;
  format: DataFormat;
  content: string;
  viewMode: DataViewMode;
  indentSize: number;
  sortKeys: boolean;
  treeSearchQuery: string;
  expandedPaths: string[];
  editorWidth?: number;
  createdAt: number;
  updatedAt: number;
}
