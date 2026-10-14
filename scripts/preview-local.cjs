'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 if(pathname==='/')pathname='/index.html';
 // 仅预览发布文件，不暴露备份、配置、Git 或检测目录。
 if(pathname!=='/index.html' && pathname!=='/source/moyun.single.html' && !pathname.startsWith('/assets/')){res.writeHead(404).end();return;}
 const file=path.resolve(root,'.'+pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,data)=>{
  if(error){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 });
}).listen(4176,'127.0.0.1',()=>console.log('Moyun 本地预览：http://127.0.0.1:4176/（Ctrl+C 停止）'));
