import React, { useRef, useState, useEffect } from 'react';
import { useTerminalStore } from './useTerminalStore';
import { TerminalTabs } from './TerminalTabs';
import { TerminalView } from './TerminalView';

export function TerminalDock() {
  const {
    isTerminalOpen,
    terminalHeight,
    setTerminalHeight,
    isMaximized,
    activeSessionId,
    sessions,
  } = useTerminalStore();

  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = terminalHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaY = startYRef.current - moveEvent.clientY;
      const newHeight = startHeightRef.current + deltaY;
      setTerminalHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (!isTerminalOpen) {
    return null;
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  return (
    <div
      style={{
        height: isMaximized ? 'calc(100vh - 40px)' : `${terminalHeight}px`,
        position: isMaximized ? 'absolute' : 'relative',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: isMaximized ? 40 : 10,
      }}
      className="flex flex-col border-t border-theme-border bg-theme-app shrink-0 shadow-lg"
    >
      {/* Top Resizer Handle (Only active when not maximized) */}
      {!isMaximized && (
        <div
          onMouseDown={handleMouseDown}
          className="h-1 w-full hover:bg-sky-500/50 cursor-row-resize transition-colors absolute -top-0.5 left-0 z-20"
          title="上下拖动调整终端高度"
        />
      )}

      {/* Tabs and Controls */}
      <TerminalTabs />

      {/* Terminal View */}
      <div className="flex-1 w-full relative overflow-hidden bg-theme-sidebar">
        {activeSession ? (
          <TerminalView key={activeSession.id} sessionId={activeSession.id} />
        ) : (
          <div className="flex items-center justify-center h-full text-theme-muted text-xs">
            暂无活动终端会话，点击上方 “+” 新建
          </div>
        )}
      </div>
    </div>
  );
}
