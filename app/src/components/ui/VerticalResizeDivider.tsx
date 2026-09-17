import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '../../locales';

interface VerticalResizeDividerProps {
  currentHeight: number;
  minHeight?: number;
  maxHeight?: number;
  onResize: (newHeight: number) => void;
  onDoubleClickReset?: () => void;
  title?: string;
  direction?: 'up-expands' | 'down-expands';
}

export function VerticalResizeDivider({
  currentHeight,
  minHeight = 100,
  maxHeight = 600,
  onResize,
  onDoubleClickReset,
  title,
  direction = 'up-expands',
}: VerticalResizeDividerProps) {
  const { t } = useTranslation();
  const effectiveTitle = title ?? t.common.dragResizeVertical;
  const [isDragging, setIsDragging] = useState(false);
  const dragInfoRef = useRef<{ startY: number; startHeight: number }>({
    startY: 0,
    startHeight: currentHeight,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragInfoRef.current = {
      startY: e.clientY,
      startHeight: currentHeight,
    };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = e.clientY - dragInfoRef.current.startY;
      const proposedHeight =
        direction === 'up-expands'
          ? dragInfoRef.current.startHeight - deltaY
          : dragInfoRef.current.startHeight + deltaY;
      const clampedHeight = Math.max(minHeight, Math.min(maxHeight, proposedHeight));
      onResize(clampedHeight);
    },
    [isDragging, minHeight, maxHeight, onResize, direction]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = 'row-resize';
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
      {/* Invisible global overlay during active drag */}
      {isDragging && (
        <div className="fixed inset-0 z-[9999] cursor-row-resize select-none" />
      )}

      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={onDoubleClickReset}
        title={effectiveTitle}
        className={`relative z-20 h-[5px] -my-[2px] w-full cursor-row-resize select-none shrink-0 transition-colors flex items-center justify-center group ${
          isDragging ? 'bg-sky-500' : 'hover:bg-sky-500/50 active:bg-sky-500'
        }`}
      >
        {/* Subtle center line indicator on hover */}
        <div
          className={`h-[1px] w-12 rounded-full transition-all duration-150 ${
            isDragging
              ? 'bg-white w-20'
              : 'bg-transparent group-hover:bg-white/80 group-hover:w-16'
          }`}
        />
      </div>
    </>
  );
}
