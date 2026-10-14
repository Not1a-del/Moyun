'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL,fileURLToPath}=require('node:url');
const root=path.resolve(__dirname,'..');
test('双击入口和 source 的全部启动脚本、样式及图标均存在于本地',()=>{
 for(const entry of ['index.html','source/moyun.single.html']){
  const file=path.join(root,entry),html=fs.readFileSync(file,'utf8');
  const urls=[...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+)"/g)].map(x=>x[1]);
  assert.ok(urls.length>=5);
  for(const ref of urls){assert.doesNotMatch(ref,/^(?:https?:)?\/\//);const url=new URL(ref,pathToFileURL(file));assert.equal(url.protocol,'file:');assert.ok(fs.existsSync(fileURLToPath(url)),`${entry}: ${ref}`);}
  assert.doesNotMatch(html,/fonts\.googleapis\.com/);
 }
});
test('本地依赖使用经典脚本，无 file:// 不支持的模块加载',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.doesNotMatch(html,/<script[^>]*type="module"/);
 for(const name of ['vue.global.js','tailwind-3.4.17.js','marked.umd.js','diff_match_patch.js'])assert.ok(html.includes('./assets/vendor/'+name));
});
test('启动失败有提示，书库读取完成后立即解除遮罩',()=>{
 const js=fs.readFileSync(path.join(root,'assets/js/moyun.js'),'utf8');
 assert.match(js,/startupTimer = setTimeout/);assert.match(js,/启动文件缺失或未能读取/);assert.match(js,/window\.__moyunReadyAt = performance\.now\(\)/);
 const mounted=js.slice(js.indexOf('onMounted(() => {\n      initTheme();'));assert.doesNotMatch(mounted.slice(0,1100),/}, 2000\)/);
});
