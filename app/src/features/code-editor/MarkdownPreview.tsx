import React, { useMemo, useState } from 'react';
import { marked } from 'marked';
import { useTranslation } from '../../locales';
import {
  FileText,
  Copy,
  Check,
  Hash,
  AlignLeft,
  BookOpen,
} from 'lucide-react';

interface MarkdownPreviewProps {
  content: string;
  theme?: string;
  filePath?: string;
}

export function MarkdownPreview({ content, theme = 'darcula', filePath }: MarkdownPreviewProps) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  // Configure marked options
  const htmlContent = useMemo(() => {
    try {
      marked.setOptions({
        gfm: true,
        breaks: false,
      });
      return marked.parse(content || '') as string;
    } catch (err) {
      console.error('[MarkdownPreview] Parsing failed:', err);
      return `<pre>${content}</pre>`;
    }
  }, [content]);

  // Statistics
  const stats = useMemo(() => {
    const lines = content ? content.split('\n').length : 0;
    const words = content ? content.trim().split(/\s+/).filter(Boolean).length : 0;
    const headings = (content.match(/^#{1,6}\s+/gm) || []).length;
    return { lines, words, headings };
  }, [content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLight = theme === 'idea-light';

  return (
    <div
      className={`h-full flex flex-col overflow-hidden select-text ${
        isLight ? 'bg-white text-slate-800' : 'bg-[#1e1f22] text-slate-200'
      }`}
    >
      {/* Top Preview Utility Bar */}
      <div
        className={`h-8 px-4 border-b flex items-center justify-between text-xs select-none shrink-0 ${
          isLight
            ? 'bg-slate-100/90 border-slate-200 text-slate-600'
            : 'bg-theme-sidebar/80 border-theme-border text-theme-muted'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium">
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-semibold">{t.editor.markdownPreviewTitle}</span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-[11px] opacity-75">
            <span className="flex items-center gap-1">
              <AlignLeft className="w-3 h-3" />
              {t.editor.lines(stats.lines)}
            </span>
            <span>·</span>
            <span>{t.editor.words(stats.words)}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {t.editor.sections(stats.headings)}
            </span>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
            isLight
              ? 'hover:bg-slate-200 text-slate-700'
              : 'hover:bg-theme-hover text-theme-muted hover:text-theme-main'
          }`}
          title={t.editor.copySourceTooltip}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">{t.editor.copiedSource}</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>{t.editor.copySource}</span>
            </>
          )}
        </button>
      </div>

      {/* Main Markdown Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 scroll-smooth">
        <div
          className={`max-w-4xl mx-auto prose prose-sm ${
            isLight ? 'prose-slate' : 'prose-invert'
          } markdown-body`}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>

      {/* Embedded High-Quality Markdown Styling (Zero External CDN Dependency) */}
      <style>{`
        .markdown-body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          line-height: 1.65;
          font-size: 13.5px;
        }
        .markdown-body h1 {
          font-size: 1.75em;
          font-weight: 700;
          padding-bottom: 0.3em;
          border-bottom: 1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)'};
          margin-top: 1em;
          margin-bottom: 0.6em;
        }
        .markdown-body h2 {
          font-size: 1.4em;
          font-weight: 600;
          padding-bottom: 0.25em;
          border-bottom: 1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'};
          margin-top: 1.2em;
          margin-bottom: 0.5em;
        }
        .markdown-body h3 {
          font-size: 1.18em;
          font-weight: 600;
          margin-top: 1em;
          margin-bottom: 0.4em;
        }
        .markdown-body h4, .markdown-body h5, .markdown-body h6 {
          font-size: 1em;
          font-weight: 600;
          margin-top: 0.8em;
          margin-bottom: 0.4em;
        }
        .markdown-body p {
          margin-top: 0;
          margin-bottom: 0.9em;
        }
        .markdown-body a {
          color: #38bdf8;
          text-decoration: none;
        }
        .markdown-body a:hover {
          text-decoration: underline;
        }
        .markdown-body strong {
          font-weight: 600;
        }
        .markdown-body ul, .markdown-body ol {
          padding-left: 1.5em;
          margin-top: 0;
          margin-bottom: 0.9em;
        }
        .markdown-body ul {
          list-style-type: disc;
        }
        .markdown-body ol {
          list-style-type: decimal;
        }
        .markdown-body li {
          margin-top: 0.25em;
          margin-bottom: 0.25em;
        }
        .markdown-body blockquote {
          margin: 0.8em 0;
          padding: 0.4em 1em;
          color: ${isLight ? '#64748b' : '#94a3b8'};
          border-left: 3.5px solid #38bdf8;
          background-color: ${isLight ? '#f8fafc' : 'rgba(56, 189, 248, 0.05)'};
          border-radius: 0 4px 4px 0;
        }
        .markdown-body hr {
          height: 1px;
          margin: 1.5em 0;
          background-color: ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)'};
          border: 0;
        }
        .markdown-body table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
          display: block;
          overflow-x: auto;
        }
        .markdown-body th, .markdown-body td {
          border: 1px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'};
          padding: 6px 12px;
          text-align: left;
        }
        .markdown-body th {
          background-color: ${isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)'};
          font-weight: 600;
        }
        .markdown-body tr:nth-child(even) td {
          background-color: ${isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)'};
        }
        .markdown-body code {
          font-family: Consolas, "Cascadia Code", "Fira Code", monospace;
          font-size: 0.88em;
          padding: 0.2em 0.4em;
          border-radius: 4px;
          background-color: ${isLight ? '#f1f5f9' : 'rgba(255,255,255,0.08)'};
          color: ${isLight ? '#0284c7' : '#38bdf8'};
        }
        .markdown-body pre {
          background-color: ${isLight ? '#f8fafc' : '#141517'};
          border: 1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'};
          border-radius: 6px;
          padding: 12px 14px;
          overflow-x: auto;
          margin: 1em 0;
        }
        .markdown-body pre code {
          background-color: transparent;
          padding: 0;
          border-radius: 0;
          color: ${isLight ? '#1e293b' : '#e2e8f0'};
          font-size: 0.85em;
          line-height: 1.5;
        }
        .markdown-body img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          display: inline-block;
          vertical-align: middle;
          margin: 2px 3px;
        }
        .markdown-body input[type="checkbox"] {
          margin-right: 0.5em;
          vertical-align: middle;
        }
      `}</style>
    </div>
  );
}
