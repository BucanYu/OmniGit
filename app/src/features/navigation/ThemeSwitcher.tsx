import React, { useState, useRef, useEffect } from 'react';
import { useAppStore, type AppTheme } from '../../store/useAppStore';
import { Palette, Sun, Moon, Terminal, Compass, Check } from 'lucide-react';
import { useTranslation } from '../../locales';

interface ThemeOption {
  id: AppTheme;
  name: string;
  descKey: 'darculaDesc' | 'lightDesc' | 'slateDesc' | 'arcticDesc';
  icon: React.ComponentType<{ className?: string }>;
  colors: string[];
}

const THEMES: ThemeOption[] = [
  {
    id: 'darcula',
    name: 'IDEA Darcula',
    descKey: 'darculaDesc',
    icon: Moon,
    colors: ['#1e1f22', '#2b2d30', '#3574f0'],
  },
  {
    id: 'idea-light',
    name: 'IDEA Light',
    descKey: 'lightDesc',
    icon: Sun,
    colors: ['#f7f8fa', '#ffffff', '#2f65ca'],
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    descKey: 'slateDesc',
    icon: Terminal,
    colors: ['#0d1117', '#161b22', '#2f81f7'],
  },
  {
    id: 'nord-frost',
    name: 'Nord Frost',
    descKey: 'arcticDesc',
    icon: Compass,
    colors: ['#242933', '#2e3440', '#88c0d0'],
  },
];

export function ThemeSwitcher() {
  const { t } = useTranslation();
  const { theme, setTheme } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeThemeObj = THEMES.find((t) => t.id === theme) || THEMES[0];
  const ActiveIcon = activeThemeObj.icon;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      {/* Theme Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded transition cursor-pointer text-xs border ${
          isOpen
            ? 'bg-theme-hover text-theme-main border-sky-500/60 shadow'
            : 'bg-theme-card hover:bg-theme-card-hover text-theme-muted hover:text-theme-main border-theme-border-card'
        }`}
        title={t.themes.currentThemeTooltip(activeThemeObj.name)}
      >
        <Palette className="w-3.5 h-3.5 text-sky-400" />
        <span className="text-[11px] font-medium hidden sm:inline">{activeThemeObj.name}</span>
        <ActiveIcon className="w-3 h-3 opacity-75 ml-0.5" />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-64 theme-dropdown-panel rounded-lg py-1.5 z-50 text-xs text-theme-main font-sans">
          <div className="px-3 py-1 text-[10px] font-semibold text-theme-dim uppercase tracking-wider border-b border-theme-border-subtle flex items-center justify-between">
            <span>{t.themes.switchThemeHeader}</span>
            <span className="text-theme-muted">{t.themes.optionsCount(THEMES.length)}</span>
          </div>

          <div className="py-1 space-y-0.5">
            {THEMES.map((item) => {
              const isSelected = item.id === theme;
              const ItemIcon = item.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setTheme(item.id);
                    setIsOpen(false);
                  }}
                  className={`px-3 py-2 flex items-center justify-between cursor-pointer transition ${
                    isSelected
                      ? 'bg-theme-active/80 text-theme-main font-semibold'
                      : 'hover:bg-theme-hover text-theme-muted hover:text-theme-main'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ItemIcon
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-sky-400' : 'text-theme-dim'
                      }`}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-xs">{item.name}</span>
                      <span className="text-[10px] text-theme-dim truncate">{t.themes[item.descKey]}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Color Swatch Dots */}
                    <div className="flex items-center gap-1">
                      {item.colors.map((c, i) => (
                        <span
                          key={i}
                          className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>

                    {/* Active Check */}
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 ml-1" />
                    ) : (
                      <span className="w-3.5 h-3.5 shrink-0 ml-1" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
