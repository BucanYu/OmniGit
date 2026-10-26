const fs = require('fs');
const path = require('path');

const appDir = path.resolve(__dirname, '..');
const repoRootDir = path.resolve(appDir, '..');
const sourceDocsDir = path.join(repoRootDir, 'docs');
const targetPublicDocsDir = path.join(appDir, 'public', 'docs');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  if (fs.existsSync(sourceDocsDir)) {
    fs.mkdirSync(targetPublicDocsDir, { recursive: true });
    copyRecursive(sourceDocsDir, targetPublicDocsDir);
    console.log('[setup-docs] Built-in docs synchronized to app/public/docs.');
  } else {
    console.warn('[setup-docs] Source docs directory not found at:', sourceDocsDir);
  }
} catch (err) {
  console.error('[setup-docs] Error synchronizing docs:', err.message);
}
