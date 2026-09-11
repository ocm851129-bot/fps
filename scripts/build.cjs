const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = ['index.html','style.css','mobile.css','game.js','touch.js','pwa.js','sw.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'];
for (const file of files) {
  if (!fs.statSync(path.join(root, file)).isFile()) throw new Error(`Missing asset: ${file}`);
  if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', path.join(root, file)]);
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const [,asset] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (!files.includes(asset)) throw new Error(`Unlisted HTML asset: ${asset}`);
}
JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
const out = path.join(root, 'dist');
fs.mkdirSync(out, {recursive:true});
for (const file of files) fs.copyFileSync(path.join(root, file), path.join(out, file));
console.log(`Built ${files.length} static assets. No credentials, tests, or server code in output.`);
