import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '../../locales';

interface ResizeDividerProps {
  currentWidth: number;
  minWidth?: number;
  maxWidth?: number;
  onResize: (newWidth: number) => void;
  onDoubleClickReset?: () => void;
  title?: string;
}

export function ResizeDivider({
  currentWidth,
  minWidth = 160,
  maxWidth = 700,
  onResize,
  onDoubleClickReset,
  title,
}: ResizeDividerProps) {
  const { t } = useTranslation();
  const effectiveTitle = title ?? t.common.dragResizeHorizontal;
  const [isDragging, setIsDragging] = useState(false);
  const dragInfoRef = useRef<{ startX: number; startWidth: number }>({
    startX: 0,
    startWidth: currentWidth,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragInfoRef.current = {
      startX: e.clientX,
      startWidth: currentWidth,
    };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragInfoRef.current.startX;
      const proposedWidth = dragInfoRef.current.startWidth + deltaX;
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, proposedWidth));
      onResize(clampedWidth);
    },
    [isDragging, minWidth, maxWidth, onResize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      // Prevent text selection & ensure col-resize cursor everywhere during active drag
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <>
      {/* Invisible global overlay during active drag to prevent Monaco Editor from capturing mouse events */}
      {isDragging && (
        <div className="fixed inset-0 z-[9999] cursor-col-resize select-none" />
      )}

      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={onDoubleClickReset}
        title={effectiveTitle}
        className={`relative z-20 w-[5px] -mx-[2px] h-full cursor-col-resize select-none shrink-0 transition-colors flex items-center justify-center group ${
          isDragging ? 'bg-sky-500' : 'hover:bg-sky-500/50 active:bg-sky-500'
        }`}
      >
        {/* Subtle center line indicator on hover */}
        <div
          className={`w-[1px] h-6 rounded-full transition-all duration-150 ${
            isDragging
              ? 'bg-white h-12'
              : 'bg-transparent group-hover:bg-white group-hover:h-8'
          }`}
        />
      </div>
    </>
  );
}
