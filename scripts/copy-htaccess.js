/**
 * Copies the project's .htaccess into the static export output dir.
 *
 * Previously handled by next.config's `exportPathMap`, which Next 16 removed.
 * Only relevant for static exports (`output: 'export'`), which write to `out/`.
 */
const path = require('path');
const fs = require('fs');

const root = process.cwd();
const src = path.join(root, '.htaccess');
const outDir = path.join(root, 'out');

if (fs.existsSync(src) && fs.existsSync(outDir)) {
  fs.copyFileSync(src, path.join(outDir, '.htaccess'));
  console.log('Copied .htaccess to out/');
} else if (!fs.existsSync(src)) {
  console.log('No .htaccess file found, skipping copy');
} else {
  console.log('No out/ directory found, skipping .htaccess copy');
}


