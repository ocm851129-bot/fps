const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
http.createServer((req,res) => {
  let file;
  try { file=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const target=path.resolve(root,'.'+(file==='/'?'/index.html':file));
  if (!target.startsWith(root+path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {res.writeHead(404).end('Not found'); return;}
  res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});
  fs.createReadStream(target).pipe(res);
}).listen(process.env.PORT||3001,()=>console.log(`TRIAD http://localhost:${process.env.PORT||3001}`));
