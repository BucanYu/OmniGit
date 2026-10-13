/**
 * Lightweight, zero-dependency GIF89a encoder in pure JavaScript.
 * Supports:
 * - Multi-frame animation with custom per-frame delays
 * - Infinite loop (Netscape 2.0 extension)
 * - Local Color Table per frame (up to 256 colors) with median-cut / frequency quantization
 * - Standard LZW sub-block bit packing
 */

function createPalette(pixels, maxColors = 256) {
  // Sample pixels to build color histogram
  const colorMap = new Map();
  const step = Math.max(1, Math.floor(pixels.length / (4 * 50000)));
  for (let i = 0; i < pixels.length; i += 4 * step) {
    const r = pixels[i] & 0xF8;
    const g = pixels[i + 1] & 0xF8;
    const b = pixels[i + 2] & 0xF8;
    const key = (r << 16) | (g << 8) | b;
    colorMap.set(key, (colorMap.get(key) || 0) + 1);
  }

  // Sort by popularity
  const sorted = Array.from(colorMap.entries()).sort((a, b) => b[1] - a[1]);
  const palette = [];
  const paletteLookup = new Map();

  for (let i = 0; i < Math.min(sorted.length, maxColors); i++) {
    const key = sorted[i][0];
    const r = (key >> 16) & 0xFF;
    const g = (key >> 8) & 0xFF;
    const b = key & 0xFF;
    palette.push([r, g, b]);
    paletteLookup.set(key, i);
  }

  // Fill up to power of 2 (at least 2, up to 256)
  while (palette.length < 256) {
    palette.push([0, 0, 0]);
  }

  return { palette, paletteLookup };
}

function findNearestColor(r, g, b, palette) {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const pr = palette[i][0];
    const pg = palette[i][1];
    const pb = palette[i][2];
    const dr = r - pr;
    const dg = g - pg;
    const db = b - pb;
    const dist = dr * dr * 2 + dg * dg * 4 + db * db * 3;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
      if (dist === 0) break;
    }
  }
  return bestIdx;
}

function lzwEncode(minCodeSize, indexedPixels) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  const maxCode = 4096;

  // LZW dictionary using trie or hash map
  let dict = new Map();
  function resetDict() {
    dict.clear();
    codeSize = minCodeSize + 1;
    nextCode = eoiCode + 1;
  }

  const outBits = [];
  let curBits = 0;
  let bitCount = 0;

  function writeCode(code) {
    curBits |= (code << bitCount);
    bitCount += codeSize;
    while (bitCount >= 8) {
      outBits.push(curBits & 0xFF);
      curBits >>= 8;
      bitCount -= 8;
    }
  }

  // Output initial Clear Code
  writeCode(clearCode);
  resetDict();

  let prefix = indexedPixels[0];
  for (let i = 1; i < indexedPixels.length; i++) {
    const k = indexedPixels[i];
    const key = (prefix << 12) | k;
    if (dict.has(key)) {
      prefix = dict.get(key);
    } else {
      writeCode(prefix);
      if (nextCode < maxCode) {
        dict.set(key, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) {
          codeSize++;
        }
      } else {
        writeCode(clearCode);
        resetDict();
      }
      prefix = k;
    }
  }
  writeCode(prefix);
  writeCode(eoiCode);

  if (bitCount > 0) {
    outBits.push(curBits & 0xFF);
  }

  // Package into sub-blocks (max 255 bytes each)
  const blocks = [];
  blocks.push(minCodeSize);
  let pos = 0;
  while (pos < outBits.length) {
    const chunkSize = Math.min(255, outBits.length - pos);
    blocks.push(chunkSize);
    for (let i = 0; i < chunkSize; i++) {
      blocks.push(outBits[pos + i]);
    }
    pos += chunkSize;
  }
  blocks.push(0); // Block terminator
  return Buffer.from(blocks);
}

class GifEncoder {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.frames = [];
  }

  addFrame(rgbaBuffer, delayMs = 1500) {
    this.frames.push({
      data: rgbaBuffer,
      delay: Math.round(delayMs / 10), // in 100ths of a second
    });
  }

  encode() {
    const buffers = [];

    // 1. Header: GIF89a
    buffers.push(Buffer.from('GIF89a', 'ascii'));

    // 2. Logical Screen Descriptor
    const lsd = Buffer.alloc(7);
    lsd.writeUInt16LE(this.width, 0);
    lsd.writeUInt16LE(this.height, 2);
    // Packed fields: Global Color Table Flag = 0, Color Res = 7 (8 bits), Sort = 0, Size = 0
    lsd[4] = 0x70;
    lsd[5] = 0; // Background color index
    lsd[6] = 0; // Pixel aspect ratio
    buffers.push(lsd);

    // 3. Netscape 2.0 Loop Block (infinite loop)
    buffers.push(Buffer.from([0x21, 0xFF, 0x0B]));
    buffers.push(Buffer.from('NETSCAPE2.0', 'ascii'));
    buffers.push(Buffer.from([0x03, 0x01, 0x00, 0x00, 0x00]));

    // 4. Frames
    for (const frame of this.frames) {
      const { palette, paletteLookup } = createPalette(frame.data, 256);

      // Quantize RGBA pixels to palette indices
      const numPixels = this.width * this.height;
      const indexed = new Uint8Array(numPixels);
      const cache = new Map();

      for (let i = 0; i < numPixels; i++) {
        const offset = i * 4;
        const r = frame.data[offset];
        const g = frame.data[offset + 1];
        const b = frame.data[offset + 2];
        const key = ((r & 0xF8) << 16) | ((g & 0xF8) << 8) | (b & 0xF8);

        if (paletteLookup.has(key)) {
          indexed[i] = paletteLookup.get(key);
        } else if (cache.has(key)) {
          indexed[i] = cache.get(key);
        } else {
          const idx = findNearestColor(r, g, b, palette);
          cache.set(key, idx);
          indexed[i] = idx;
        }
      }

      // Graphic Control Extension
      buffers.push(Buffer.from([
        0x21, 0xF9, 0x04,
        0x00, // Reserved, Disposal Method = 0, User Input = 0, Transparent = 0
        frame.delay & 0xFF, (frame.delay >> 8) & 0xFF,
        0x00, // Transparent color index
        0x00  // Block terminator
      ]));

      // Image Descriptor
      const id = Buffer.alloc(10);
      id[0] = 0x2C;
      id.writeUInt16LE(0, 1); // Left
      id.writeUInt16LE(0, 3); // Top
      id.writeUInt16LE(this.width, 5);
      id.writeUInt16LE(this.height, 7);
      // Local Color Table Flag = 1, Interlace = 0, Sort = 0, Size = 7 (2^(7+1) = 256 colors)
      id[9] = 0x87;
      buffers.push(id);

      // Local Color Table (256 * 3 bytes)
      const lctBuf = Buffer.alloc(256 * 3);
      for (let c = 0; c < 256; c++) {
        lctBuf[c * 3] = palette[c][0];
        lctBuf[c * 3 + 1] = palette[c][1];
        lctBuf[c * 3 + 2] = palette[c][2];
      }
      buffers.push(lctBuf);

      // LZW Image Data
      const lzwData = lzwEncode(8, indexed);
      buffers.push(lzwData);
    }

    // 5. Trailer
    buffers.push(Buffer.from([0x3B]));

    return Buffer.concat(buffers);
  }
}

module.exports = { GifEncoder };
