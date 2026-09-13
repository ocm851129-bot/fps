const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const vendor=path.join(root,'vendor');fs.mkdirSync(vendor,{recursive:true});
for(const f of ['three.module.js','three.core.js'])fs.copyFileSync(path.join(root,'node_modules/three/build',f),path.join(vendor,f));
fs.copyFileSync(path.join(root,'node_modules/three/LICENSE'),path.join(vendor,'LICENSE.txt'));
require('esbuild').buildSync({entryPoints:[path.join(root,'online.js')],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:path.join(vendor,'online.js'),minify:true});
require('esbuild').buildSync({entryPoints:[path.join(root,'hero-online.js')],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:path.join(vendor,'hero-online.js'),minify:true});
const files = ['hero.html','hero.css','vendor/hero-online.js',"royale.html","royale.css","royale-core.js","royale.js","royale-design.md","royale-roadmap.md",'career.js','maps.js','online-config.js','vendor/online.js','view3d.js','tactical.css','vendor/three.module.js','vendor/three.core.js','vendor/LICENSE.txt','index.html','style.css','mobile.css','game.js','touch.js','pwa.js','sw.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'];
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
for (const file of files) {fs.mkdirSync(path.dirname(path.join(out,file)),{recursive:true});fs.copyFileSync(path.join(root, file), path.join(out, file));}
console.log(`Built ${files.length} static assets. No credentials, tests, or server code in output.`);
