export const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'ico',
  'bmp',
  'avif',
  'apng',
]);

export const ANIMATED_IMAGE_EXTENSIONS = new Set(['gif', 'webp', 'apng']);

/**
 * Checks whether a given file path corresponds to an image file.
 */
export function isImageFile(filePath?: string): boolean {
  if (!filePath) return false;
  const clean = filePath.split(/[?#]/)[0];
  const ext = clean.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * Checks whether an image can be animated (e.g. GIF, animated WebP, APNG).
 */
export function isAnimatedImage(filePath?: string): boolean {
  if (!filePath) return false;
  const clean = filePath.split(/[?#]/)[0];
  const ext = clean.split('.').pop()?.toLowerCase() || '';
  return ANIMATED_IMAGE_EXTENSIONS.has(ext);
}

/**
 * Returns human-readable label for the image format.
 */
export function getImageFormatLabel(filePath?: string, isZh: boolean = true): string {
  if (!filePath) return 'IMAGE';
  const clean = filePath.split(/[?#]/)[0];
  const ext = clean.split('.').pop()?.toUpperCase() || 'IMG';

  if (ext === 'GIF') {
    return isZh ? 'GIF (动态图)' : 'GIF (Animated)';
  }
  if (ext === 'WEBP') {
    return isZh ? 'WEBP (动/静双模)' : 'WEBP (Image/Animation)';
  }
  if (ext === 'APNG') {
    return isZh ? 'APNG (动态图)' : 'APNG (Animated)';
  }
  if (ext === 'SVG') {
    return isZh ? 'SVG (矢量图)' : 'SVG (Vector)';
  }
  if (ext === 'PNG') {
    return isZh ? 'PNG (无损透明)' : 'PNG (Lossless/Alpha)';
  }
  if (ext === 'JPG' || ext === 'JPEG') {
    return 'JPEG';
  }
  return ext;
}

/**
 * Format bytes into human-readable file size string.
 */
export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes < 0) {
    return '--';
  }
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Copy image binary to system clipboard.
 */
export async function copyImageToClipboard(imageUrl: string): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.clipboard || typeof ClipboardItem === 'undefined') {
    return false;
  }

  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();

    // If it's already PNG, modern browsers can directly write it to the clipboard
    if (blob.type === 'image/png') {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      return true;
    }

    // Otherwise, draw to canvas and export as image/png blob for clipboard compatibility
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const loadPromise = new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
    });
    img.src = imageUrl;

    const ok = await loadPromise;
    if (!ok) return false;

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0);

    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });

    if (!pngBlob) return false;

    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': pngBlob }),
    ]);
    return true;
  } catch (err) {
    console.warn('[ImageViewer] Failed to copy image to clipboard:', err);
    return false;
  }
}
