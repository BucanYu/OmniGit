import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useAppStore } from '../../store/useAppStore';

interface TerminalViewProps {
  sessionId: string;
}

export function TerminalView({ sessionId }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const theme = useAppStore((state) => state.theme);

  // Determine xterm color theme based on OmniGit theme
  const getThemeColors = (appTheme: string) => {
    switch (appTheme) {
      case 'idea-light':
        return {
          background: '#ffffff',
          foreground: '#1f2328',
          cursor: '#0969da',
          cursorAccent: '#ffffff',
          selectionBackground: '#b6d7a8',
          black: '#24292e',
          red: '#cf222e',
          green: '#116329',
          yellow: '#4d2d00',
          blue: '#0969da',
          magenta: '#8250df',
          cyan: '#1b7c83',
          white: '#6e7781',
          brightBlack: '#57606a',
          brightRed: '#a40e26',
          brightGreen: '#1a7f37',
          brightYellow: '#633c01',
          brightBlue: '#218bff',
          brightMagenta: '#a475f9',
          brightCyan: '#3192aa',
          brightWhite: '#8c959f',
        };
      case 'nord-frost':
        return {
          background: '#242933',
          foreground: '#eceff4',
          cursor: '#88c0d0',
          cursorAccent: '#242933',
          selectionBackground: '#434c5e',
          black: '#3b4252',
          red: '#bf616a',
          green: '#a3be8c',
          yellow: '#ebcb8b',
          blue: '#81a1c1',
          magenta: '#b48ead',
          cyan: '#88c0d0',
          white: '#e5e9f0',
          brightBlack: '#4c566a',
          brightRed: '#d08770',
          brightGreen: '#8fbcbb',
          brightYellow: '#ebcb8b',
          brightBlue: '#81a1c1',
          brightMagenta: '#b48ead',
          brightCyan: '#8fbcbb',
          brightWhite: '#eceff4',
        };
      case 'github-dark':
        return {
          background: '#0d1117',
          foreground: '#c9d1d9',
          cursor: '#58a6ff',
          cursorAccent: '#0d1117',
          selectionBackground: '#264f78',
          black: '#161b22',
          red: '#ff7b72',
          green: '#3fb950',
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39c5cf',
          white: '#b1bac4',
          brightBlack: '#6e7681',
          brightRed: '#ffa198',
          brightGreen: '#56d364',
          brightYellow: '#e3b341',
          brightBlue: '#79c0ff',
          brightMagenta: '#d2a8ff',
          brightCyan: '#56d4dd',
          brightWhite: '#f0f6fc',
        };
      case 'darcula':
      default:
        return {
          background: '#1e1f22',
          foreground: '#bcbec4',
          cursor: '#3574f0',
          cursorAccent: '#1e1f22',
          selectionBackground: '#264f78',
          black: '#1e1f22',
          red: '#f75464',
          green: '#6aab73',
          yellow: '#e0ac16',
          blue: '#56a8f5',
          magenta: '#cf8e6d',
          cyan: '#56a8f5',
          white: '#bcbec4',
          brightBlack: '#707278',
          brightRed: '#fa6675',
          brightGreen: '#7ec487',
          brightYellow: '#fad65c',
          brightBlue: '#70baf7',
          brightMagenta: '#df9b7d',
          brightCyan: '#70baf7',
          brightWhite: '#ffffff',
        };
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: "Consolas, 'Cascadia Code', 'Fira Code', 'Courier New', monospace",
      theme: getThemeColors(theme),
      allowProposedApi: true,
      convertEol: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);
    terminalInstanceRef.current = term;
    fitAddonRef.current = fitAddon;

    // Initial fit with delay to ensure container layout is settled
    const timer = setTimeout(() => {
      try {
        fitAddon.fit();
        if (term.cols > 0 && term.rows > 0) {
          window.electronAPI?.terminal?.resize(sessionId, term.cols, term.rows);
        }
      } catch {}
    }, 100);

    if (!window.electronAPI?.terminal) {
      term.writeln('\x1b[38;5;39m[OmniGit Terminal]\x1b[0m Web 模式运行在浏览器沙箱中，本地命令行 PTY 终端不可用。');
      term.writeln('\x1b[90m请安装并使用 OmniGit 桌面客户端以获得完整极速的集成终端体验 (PowerShell / Git Bash / CMD)。\x1b[0m\r\n');
    }

    // Terminal user input -> send to PTY backend
    const onDataDisposable = term.onData((data) => {
      window.electronAPI?.terminal?.write(sessionId, data);
    });

    // PTY data -> render in Terminal
    let removeListener: (() => void) | undefined;
    if (window.electronAPI?.terminal?.onData) {
      removeListener = window.electronAPI.terminal.onData((payload) => {
        if (payload.id === sessionId) {
          term.write(payload.data);
        }
      });
    }

    // Auto fit on container resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (term.cols > 0 && term.rows > 0) {
          window.electronAPI?.terminal?.resize(sessionId, term.cols, term.rows);
        }
      } catch {}
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(timer);
      onDataDisposable.dispose();
      resizeObserver.disconnect();
      if (removeListener) removeListener();
      term.dispose();
    };
  }, [sessionId]);

  // Sync theme changes dynamically
  useEffect(() => {
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.options.theme = getThemeColors(theme);
    }
  }, [theme]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-theme-sidebar p-1">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
