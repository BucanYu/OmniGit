import React from 'react';
import {
  FileCode,
  FileText,
  Database,
  File,
} from 'lucide-react';
import type { OutgoingCommitFile } from '../../../store/useAppStore';
import type { FileTreeNode } from '../types';

export function buildFileTree(files: OutgoingCommitFile[] = []): FileTreeNode {
  const safeFiles = Array.isArray(files) ? files : [];
  const root: FileTreeNode = {
    name: 'root',
    fullPath: '',
    isDirectory: true,
    fileCount: safeFiles.length,
    children: new Map(),
  };

  for (const file of safeFiles) {
    if (!file || !file.path || typeof file.path !== 'string') continue;
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          fullPath: currentPath,
          isDirectory: !isLast,
          fileCount: 0,
          file: isLast ? file : undefined,
          children: new Map(),
        });
      }

      const nextNode = current.children.get(part)!;
      nextNode.fileCount += 1;
      current = nextNode;
    }
  }

  return root;
}

export function formatCommitTime(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return dateStr || '';
  }
}

export function renderFileIcon(fileName?: string): React.ReactElement {
  if (!fileName || typeof fileName !== 'string') {
    return <File className="w-3.5 h-3.5 text-theme-dim shrink-0" />;
  }
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.java')) {
    return (
      <span className="w-3.5 h-3.5 rounded bg-blue-600/90 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
        C
      </span>
    );
  }
  if (lower.endsWith('.sql')) {
    return <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  }
  if (lower.endsWith('.md')) {
    return <FileText className="w-3.5 h-3.5 text-sky-300 shrink-0" />;
  }
  if (
    lower.endsWith('.ts') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.json') ||
    lower.endsWith('.vue') ||
    lower.endsWith('.js') ||
    lower.endsWith('.jsx')
  ) {
    return <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
  }
  return <File className="w-3.5 h-3.5 text-theme-dim shrink-0" />;
}

export function renderStatusCode(statusCode = '', status = ''): React.ReactElement {
  const code = statusCode || '';
  const st = status || '';
  if (code.startsWith('A') || st === 'added') {
    return <span className="text-[10px] font-mono font-bold text-emerald-400">A</span>;
  }
  if (code.startsWith('D') || st === 'deleted') {
    return <span className="text-[10px] font-mono font-bold text-rose-400">D</span>;
  }
  if (code.startsWith('R') || st === 'renamed') {
    return <span className="text-[10px] font-mono font-bold text-amber-400">R</span>;
  }
  return <span className="text-[10px] font-mono font-bold text-sky-400">M</span>;
}
