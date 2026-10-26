import React, { useState, useMemo } from 'react';
import { useDataToolsStore } from './useDataToolsStore';
import { useTranslation } from '../../locales';
import {
  jsonToTypeScript,
  jsonToGo,
  jsonToJava,
  jsonToPython,
} from './formatters/typeGenerator';
import { X, Copy, Check, FileCode2 } from 'lucide-react';

type TargetLanguage = 'typescript' | 'go' | 'java' | 'python';

export const DataToolsTypeGeneratorModal: React.FC = () => {
  const { t } = useTranslation();
  const { isTypeModalOpen, setIsTypeModalOpen, parsedData } = useDataToolsStore();
  const [lang, setLang] = useState<TargetLanguage>('typescript');
  const [copied, setCopied] = useState(false);

  const generatedCode = useMemo(() => {
    if (!parsedData) return '// No valid JSON data available to generate types';
    switch (lang) {
      case 'typescript':
        return jsonToTypeScript(parsedData);
      case 'go':
        return jsonToGo(parsedData);
      case 'java':
        return jsonToJava(parsedData);
      case 'python':
        return jsonToPython(parsedData);
      default:
        return '';
    }
  }, [parsedData, lang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (!isTypeModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-100">
      <div className="w-full max-w-2xl bg-theme-panel border border-theme-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-theme-border flex items-center justify-between bg-theme-header/80">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <FileCode2 className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-theme-main">
                {t.dataTools.typeGeneratorModalTitle}
              </h3>
              <p className="text-[11px] text-theme-muted mt-0.5">
                {t.dataTools.typeGeneratorModalDesc}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsTypeModalOpen(false)}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-main hover:bg-theme-hover transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Language Tabs & Copy Button */}
        <div className="px-5 py-2.5 border-b border-theme-border bg-theme-sidebar/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-theme-hover/60 border border-theme-border/60">
            {(
              [
                { id: 'typescript', label: 'TypeScript' },
                { id: 'go', label: 'Go Struct' },
                { id: 'java', label: 'Java Record' },
                { id: 'python', label: 'Python Pydantic' },
              ] as { id: TargetLanguage; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLang(item.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  lang === item.id
                    ? 'bg-theme-card text-purple-600 dark:text-purple-400 font-semibold shadow-2xs'
                    : 'text-theme-muted hover:text-theme-main'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors cursor-pointer shadow-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? t.dataTools.copiedToast : t.dataTools.copyCode}</span>
          </button>
        </div>

        {/* Code View Area */}
        <div className="flex-1 overflow-auto p-4 bg-theme-input/40">
          <pre className="font-mono text-xs text-theme-main leading-relaxed selection:bg-purple-500/30 whitespace-pre">
            {generatedCode}
          </pre>
        </div>
      </div>
    </div>
  );
};
