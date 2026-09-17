const fs = require('fs');
const path = require('path');

const appDir = path.resolve(__dirname, '..');
const buildDir = path.join(appDir, 'build');
const iconPngPath = path.join(buildDir, 'icon.png');
const iconIcoPath = path.join(buildDir, 'icon.ico');
const targetIcnsPath = path.join(buildDir, 'icon.icns');

console.log('Generating macOS icon.icns...');

// 1. Read 512x512 PNG
if (!fs.existsSync(iconPngPath)) {
  console.error('[ERROR] build/icon.png not found!');
  process.exit(1);
}
const png512 = fs.readFileSync(iconPngPath);

// 2. Extract PNG frames from icon.ico
const icoBuf = fs.readFileSync(iconIcoPath);
const count = icoBuf.readUInt16LE(4);
const frames = {};

for (let i = 0; i < count; i++) {
  const w = icoBuf.readUInt8(6 + i * 16) || 256;
  const len = icoBuf.readUInt32LE(14 + i * 16);
  const offset = icoBuf.readUInt32LE(18 + i * 16);
  const frameBuf = icoBuf.subarray(offset, offset + len);
  // Only use if it is a valid PNG
  if (frameBuf.slice(0, 4).toString('hex') === '89504e47') {
    frames[w] = frameBuf;
  }
}

// 3. Prepare ICNS entries
// Supported modern PNG-based ICNS chunk tags:
// icp4: 16x16, icp5: 32x32, icp6: 64x64, ic07: 128x128, ic08: 256x256, ic09: 512x512
// ic11: 16x16@2x (32x32), ic12: 32x32@2x (64x64), ic13: 128x128@2x (256x256), ic14: 256x256@2x (512x512)
const chunks = [];

function addChunk(tag, buf) {
  if (!buf) return;
  const header = Buffer.alloc(8);
  header.write(tag, 0, 4, 'ascii');
  header.writeUInt32BE(8 + buf.length, 4);
  chunks.push(Buffer.concat([header, buf]));
}

if (frames[16]) addChunk('icp4', frames[16]);
if (frames[32]) {
  addChunk('icp5', frames[32]);
  addChunk('ic11', frames[32]);
}
if (frames[64]) {
  addChunk('icp6', frames[64]);
  addChunk('ic12', frames[64]);
}
if (frames[128]) addChunk('ic07', frames[128]);
if (frames[256]) {
  addChunk('ic08', frames[256]);
  addChunk('ic13', frames[256]);
}
if (png512) {
  addChunk('ic09', png512);
  addChunk('ic14', png512);
}

const totalBody = Buffer.concat(chunks);
const fileHeader = Buffer.alloc(8);
fileHeader.write('icns', 0, 4, 'ascii');
fileHeader.writeUInt32BE(8 + totalBody.length, 4);

const icnsFile = Buffer.concat([fileHeader, totalBody]);
fs.writeFileSync(targetIcnsPath, icnsFile);

console.log(`[SUCCESS] icon.icns created successfully at: ${targetIcnsPath} (${icnsFile.length} bytes)`);
