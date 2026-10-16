import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from '../../locales';
import { useAppStore } from '../../store/useAppStore';
import {
  isAnimatedImage,
  getImageFormatLabel,
  formatFileSize,
  copyImageToClipboard,
} from './imageUtils';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  Copy,
  Check,
  FolderOpen,
  ExternalLink,
  Layers,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Play,
} from 'lucide-react';

interface ImageViewerProps {
  filePath: string;
  fileSize?: number;
  mtime?: number;
  theme?: string;
  onOpenFolder?: () => void;
}

type BgMode = 'checkerboard' | 'dark' | 'light';

export function ImageViewer({
  filePath,
  fileSize,
  mtime,
  theme,
  onOpenFolder,
}: ImageViewerProps) {
  const { t, isZh } = useTranslation();
  const { openProjectFolder, openFileInEditor } = useAppStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [scale, setScale] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [bgMode, setBgMode] = useState<BgMode>('checkerboard');

  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState<'image' | 'path' | null>(null);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const isAnimated = isAnimatedImage(filePath);
  const isSvg = (filePath || '').toLowerCase().endsWith('.svg');
  const formatLabel = getImageFormatLabel(filePath, isZh);

  // Cache-busting image URL
  const imageUrl = `/api/fs/raw?filePath=${encodeURIComponent(filePath)}${mtime ? `&t=${mtime}` : ''}`;

  // Reset transforms when filePath changes
  useEffect(() => {
    setScale(1.0);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setIsLoading(true);
    setHasError(false);
    setNaturalDimensions(null);
  }, [filePath]);

  // Image load handler
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    setNaturalDimensions({ width: w, height: h });
    setIsLoading(false);
    setHasError(false);

    // Auto-fit if image is larger than container viewport
    if (containerRef.current && w > 0 && h > 0) {
      const cw = containerRef.current.clientWidth - 64;
      const ch = containerRef.current.clientHeight - 64;
      if (cw > 0 && ch > 0 && (w > cw || h > ch)) {
        const fitScale = Math.min(cw / w, ch / h, 1.0);
        setScale(Number(fitScale.toFixed(2)));
      }
    }
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setScale((prev) => Math.min(Number((prev * 1.25).toFixed(2)), 20.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(Number((prev / 1.25).toFixed(2)), 0.05));
  };

  const handleActualSize = () => {
    setScale(1.0);
    setPan({ x: 0, y: 0 });
  };

  const handleFitWindow = useCallback(() => {
    if (!containerRef.current || !naturalDimensions) {
      setScale(1.0);
      setPan({ x: 0, y: 0 });
      return;
    }
    const cw = containerRef.current.clientWidth - 48;
    const ch = containerRef.current.clientHeight - 48;
    if (cw <= 0 || ch <= 0) return;

    const fit = Math.min(cw / naturalDimensions.width, ch / naturalDimensions.height, 1.0);
    setScale(Number(fit.toFixed(2)));
    setPan({ x: 0, y: 0 });
  }, [naturalDimensions]);

  // Rotate & Flip
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleFlipH = () => setFlipH((prev) => !prev);
  const handleFlipV = () => setFlipV((prev) => !prev);

  const handleResetView = () => {
    handleFitWindow();
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
  };

  // Background toggle: checkerboard -> dark -> light -> checkerboard
  const cycleBgMode = () => {
    setBgMode((prev) => {
      if (prev === 'checkerboard') return 'dark';
      if (prev === 'dark') return 'light';
      return 'checkerboard';
    });
  };

  // Pan / Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left-click
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setScale((prev) => {
      const next = prev * factor;
      return Math.min(Math.max(Number(next.toFixed(2)), 0.05), 20.0);
    });
  };

  // Copy Image binary to clipboard
  const handleCopyImage = async () => {
    const success = await copyImageToClipboard(imageUrl);
    if (success) {
      setCopiedToast('image');
      setTimeout(() => setCopiedToast(null), 2000);
    }
  };

  // Copy file path to clipboard
  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(filePath);
      setCopiedToast('path');
      setTimeout(() => setCopiedToast(null), 2000);
    } catch {}
  };

  // Reveal in OS File Manager
  const handleRevealInOS = () => {
    if (onOpenFolder) {
      onOpenFolder();
      return;
    }
    openProjectFolder(filePath);
  };

  // Open with system default application
  const handleOpenInDefaultApp = () => {
    openFileInEditor(filePath);
  };

  return (
    <div className="flex flex-col h-full w-full bg-theme-panel select-none relative overflow-hidden">
      {/* 1. Floating Top Actions Toolbar */}
      <div className="h-9 px-3 border-b border-theme-border bg-theme-sidebar flex items-center justify-between gap-2 z-20 shrink-0 text-xs text-theme-main shadow-2xs">
        {/* Left: Metadata info badges */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Format Badge */}
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono border ${
              isAnimated
                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse'
                : isSvg
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
            }`}
          >
            {formatLabel}
          </span>

          {/* Animated GIF / WebP Play Badge */}
          {isAnimated && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-medium">
              <Play className="w-2.5 h-2.5 fill-emerald-400 text-emerald-400" />
              <span>{t.imageViewer.animatedBadge}</span>
            </span>
          )}

          {/* Dimensions */}
          {naturalDimensions && (
            <span className="text-[11px] font-mono text-theme-muted hidden md:inline">
              {t.imageViewer.resolution(naturalDimensions.width, naturalDimensions.height)}
            </span>
          )}

          {/* File Size */}
          {fileSize !== undefined && fileSize > 0 && (
            <span className="text-[11px] font-mono text-theme-dim hidden md:inline">
              ({formatFileSize(fileSize)})
            </span>
          )}
        </div>

        {/* Center/Right: Interactive Controls */}
        <div className="flex items-center gap-1">
          {/* Zoom Out (-) */}
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-theme-main transition cursor-pointer"
            title={t.imageViewer.zoomOut}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Zoom Percentage Pill (click to reset to 100%) */}
          <button
            type="button"
            onClick={handleActualSize}
            className="px-2 py-0.5 rounded hover:bg-theme-hover font-mono text-[11px] text-theme-main font-semibold transition cursor-pointer"
            title={t.imageViewer.actualSize}
          >
            {Math.round(scale * 100)}%
          </button>

          {/* Zoom In (+) */}
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-theme-main transition cursor-pointer"
            title={t.imageViewer.zoomIn}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* Fit to Viewport */}
          <button
            type="button"
            onClick={handleFitWindow}
            className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-theme-main transition cursor-pointer"
            title={t.imageViewer.fitWindow}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Vertical Separator */}
          <div className="h-4 w-[1px] bg-theme-border mx-1" />

          {/* Rotate 90 deg */}
          <button
            type="button"
            onClick={handleRotate}
            className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-theme-main transition cursor-pointer"
            title={t.imageViewer.rotate}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* Flip Horizontal */}
          <button
            type="button"
            onClick={handleFlipH}
            className={`p-1 rounded transition cursor-pointer ${
              flipH ? 'bg-sky-500/20 text-sky-400' : 'hover:bg-theme-hover text-theme-muted hover:text-theme-main'
            }`}
            title={t.imageViewer.flipH}
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Flip Vertical */}
          <button
            type="button"
            onClick={handleFlipV}
            className={`p-1 rounded transition cursor-pointer ${
              flipV ? 'bg-sky-500/20 text-sky-400' : 'hover:bg-theme-hover text-theme-muted hover:text-theme-main'
            }`}
            title={t.imageViewer.flipV}
          >
            <FlipVertical className="w-3.5 h-3.5" />
          </button>

          {/* Reset Transform */}
          <button
            type="button"
            onClick={handleResetView}
            className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-theme-main transition cursor-pointer"
            title={t.imageViewer.resetView}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Vertical Separator */}
          <div className="h-4 w-[1px] bg-theme-border mx-1" />

          {/* Background Mode Toggle (Checkerboard / Dark / Light) */}
          <button
            type="button"
            onClick={cycleBgMode}
            className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-sky-400 transition cursor-pointer flex items-center gap-1"
            title={
              bgMode === 'checkerboard'
                ? t.imageViewer.bgCheckerboard
                : bgMode === 'dark'
                ? t.imageViewer.bgDark
                : t.imageViewer.bgLight
            }
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase font-mono hidden xl:inline">
              {bgMode === 'checkerboard' ? 'Grid' : bgMode}
            </span>
          </button>

          {/* Copy Image to Clipboard */}
          <button
            type="button"
            onClick={handleCopyImage}
            className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-sky-400 transition cursor-pointer"
            title={t.imageViewer.copyImage}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Reveal in OS File Manager */}
          <button
            type="button"
            onClick={handleRevealInOS}
            className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-amber-400 transition cursor-pointer"
            title={t.imageViewer.openInFolder}
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>

          {/* Open with default system app */}
          <button
            type="button"
            onClick={handleOpenInDefaultApp}
            className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-sky-400 transition cursor-pointer"
            title={t.imageViewer.openInApp}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Feedback Notification Toast */}
      {copiedToast && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-medium text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-fadeIn">
          <Check className="w-3.5 h-3.5" />
          <span>
            {copiedToast === 'image'
              ? t.imageViewer.copiedImageToast
              : t.imageViewer.copiedPathToast}
          </span>
        </div>
      )}

      {/* 3. Main Interactive Image Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={scale !== 1.0 ? handleActualSize : handleFitWindow}
        className={`flex-1 relative overflow-hidden flex items-center justify-center ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        } ${
          bgMode === 'dark'
            ? 'bg-[#18181b]'
            : bgMode === 'light'
            ? 'bg-[#ffffff]'
            : 'image-viewer-checkerboard'
        }`}
      >
        {/* Loading Spinner */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 bg-theme-panel/60 backdrop-blur-2xs">
            <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-theme-muted">{t.imageViewer.reload}...</span>
          </div>
        )}

        {/* Error Fallback */}
        {hasError && (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-md z-10">
            <AlertCircle className="w-10 h-10 text-rose-400 mb-2" />
            <p className="text-xs text-theme-main font-semibold mb-1">
              {t.imageViewer.loadError}
            </p>
            <p className="text-[11px] font-mono text-theme-muted break-all mb-4 select-all">
              {filePath}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setHasError(false);
                  setIsLoading(true);
                  if (imgRef.current) {
                    imgRef.current.src = `${imageUrl}&retry=${Date.now()}`;
                  }
                }}
                className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs transition cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{t.imageViewer.reload}</span>
              </button>
              <button
                type="button"
                onClick={handleRevealInOS}
                className="px-3 py-1 bg-theme-hover hover:bg-theme-card border border-theme-border rounded text-xs text-theme-main transition cursor-pointer"
              >
                {t.imageViewer.openInFolder}
              </button>
            </div>
          </div>
        )}

        {/* Live Image Element */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt={filePath.split(/[/\\]/).pop()}
          draggable={false}
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale}) rotate(${rotation}deg) scaleX(${
              flipH ? -1 : 1
            }) scaleY(${flipV ? -1 : 1})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.12s ease-out',
            display: hasError ? 'none' : 'block',
            maxWidth: 'none',
            maxHeight: 'none',
            imageRendering: scale > 2.0 ? 'pixelated' : 'auto',
          }}
          className="select-none shadow-md"
        />
      </div>

      {/* 4. Bottom Compact Status Bar */}
      <div className="h-6 px-3 border-t border-theme-border bg-theme-sidebar flex items-center justify-between text-[11px] text-theme-muted shrink-0 z-20 font-mono">
        <div className="flex items-center gap-3">
          <span className="truncate max-w-[280px] text-theme-main" title={filePath}>
            {filePath.split(/[/\\]/).pop()}
          </span>
          {naturalDimensions && (
            <span>
              {naturalDimensions.width} × {naturalDimensions.height} px
            </span>
          )}
          {fileSize !== undefined && fileSize > 0 && (
            <span>{formatFileSize(fileSize)}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span>{Math.round(scale * 100)}%</span>
          {rotation > 0 && <span>{rotation}°</span>}
          {(flipH || flipV) && <span>Flip</span>}
          <span className="capitalize">{bgMode}</span>
        </div>
      </div>

      {/* Checkerboard Pattern Styles */}
      <style>{`
        .image-viewer-checkerboard {
          background-color: ${theme === 'light' ? '#f8fafc' : '#111827'};
          background-image: linear-gradient(45deg, ${
            theme === 'light' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)'
          } 25%, transparent 25%),
            linear-gradient(-45deg, ${
              theme === 'light' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)'
            } 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, ${
              theme === 'light' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)'
            } 75%),
            linear-gradient(-45deg, transparent 75%, ${
              theme === 'light' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)'
            } 75%);
          background-size: 16px 16px;
          background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
        }
      `}</style>
    </div>
  );
}
