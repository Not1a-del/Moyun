'use strict';
// 复用隔离 Edge runner；只核对部署文件和页面操作，不发送模型请求。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
module.exports=async function(c){
 const root=path.resolve(__dirname,'..'),url=await c.ev(()=>location.href),label=new URL(url).hostname==='127.0.0.1'?'local':'live';
 const out=path.join(root,'.ui-check/release-smoke',label);fs.mkdirSync(out,{recursive:true});
 const results=[];let passed=false;
 async function check(name,run){try{const data=await run();results.push({name,ok:true,data});console.log('PASS',name,JSON.stringify(data));}catch(error){results.push({name,ok:false,error:String(error)});throw error;}}
 async function click(selector){const p=await c.ev(selector=>{const node=document.querySelector(selector);if(!node)throw Error('找不到 '+selector);node.scrollIntoView({block:'nearest',behavior:'instant'});const r=node.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{x,y,height:r.height,hit:node.contains(document.elementFromPoint(x,y))};},selector);assert.ok(p.hit,selector+' 被遮挡');assert.ok(p.height>=44);await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});await c.delay(350);return p;}
 async function shot(name){const image=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(image.data,'base64'));}
 async function search(query){await c.ev(async query=>{const input=document.querySelector('[data-settings-search-area] input');input.focus();input.value=query;input.dispatchEvent(new Event('input',{bubbles:true}));await Vue.nextTick();},query);}
 try{
  await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});await c.send('Page.bringToFront');await c.send('Network.enable');await c.send('Network.setCacheDisabled',{cacheDisabled:true});
  await check('部署入口和全部启动文件与本地构建逐字节一致',async()=>{
   const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
   const files=['index.html',...[...html.matchAll(/<(?:script|link) [^>]*?(?:src|href)="([^"]+)"/g)].map(x=>x[1])];
   assert.ok(files.length>=6,'没有收集到全部启动资源');
   const rows=await c.ev(async files=>{const rows=[];for(const file of files){const response=await fetch(new URL(file,location.href),{cache:'reload'}),bytes=await response.arrayBuffer();rows.push({file,status:response.status,bytes:bytes.byteLength,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')});}return rows;},files);
   for(const row of rows){assert.equal(row.status,200,row.file);const expected=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,row.file.split('?')[0]))).digest('hex');assert.equal(row.sha256,expected,row.file+' 不是当前构建');}return rows;
  });
  await check('页面品牌图标实际解码成功',async()=>{const images=await c.ev(()=>[...document.querySelectorAll('img[src*="favicon"]')].map(node=>({src:node.getAttribute('src'),loaded:node.complete&&node.naturalWidth>0})));assert.ok(images.length);assert.ok(images.every(node=>node.loaded));return images;});
  for(const width of [1280,390])for(const dark of [false,true]){
   const name=width+'-'+(dark?'dark':'light');await c.send('Emulation.setDeviceMetricsOverride',{width,height:width===1280?800:844,deviceScaleFactor:1,mobile:width<768});
   await c.ev(({dark})=>{if(__s.isDark!==dark)__s.toggleTheme();localStorage.removeItem('moyun_first_run_guide_seen');localStorage.removeItem('moyun_web_update_announcement_seen');},{dark});
   await c.send('Page.reload',{ignoreCache:true});await c.ready();await c.delay(600);
   await check(name+'首次说明→1116公告→已读刷新',async()=>{
    assert.equal(await c.ev(()=>__s.isFirstRunGuide),true);await click('[data-web-update-ack]');
    const data=await c.ev(()=>{const modal=document.querySelector('[data-moyun-modal="web-update-announcement"]'),r=modal.getBoundingClientRect();return{title:__s.webUpdateAnnouncement.title,date:__s.webUpdateAnnouncement.publishedAt,text:modal.innerText,overflow:document.documentElement.scrollWidth>innerWidth+1,bounds:r.left>=0&&r.right<=innerWidth+1};});
    assert.equal(data.title,'1116更新');assert.equal(data.date,'2026-11-16');assert.ok(data.text.includes('设置常用词搜索')&&data.text.includes('分支上下文独立'));assert.doesNotMatch(data.text,/v0[.]0[.]19/);assert.equal(data.overflow,false);assert.equal(data.bounds,true);await shot(name+'-announcement');await click('[data-web-update-ack]');await c.send('Page.reload',{ignoreCache:true});await c.ready();await c.delay(600);assert.equal(await c.ev(()=>__s.showWebUpdateAnnouncement),false);return{...data,text:undefined};
   });
   await check(name+'旧版已读用户只看到新公告',async()=>{await c.ev(()=>localStorage.setItem('moyun_web_update_announcement_seen','web-2026-10-24-1024-update'));await c.send('Page.reload',{ignoreCache:true});await c.ready();await c.delay(600);assert.equal(await c.ev(()=>__s.webUpdateAnnouncement.title),'1116更新');assert.equal(await c.ev(()=>__s.isFirstRunGuide),false);await click('[data-web-update-ack]');return true;});
   await c.ev(()=>{window.__releaseAiCalls=0;window.__releaseFetch=window.fetch;window.fetch=async()=>{__releaseAiCalls++;throw Error('发布冒烟禁止模型请求');};__s.mobileSidebarOpen=false;});
   await check(name+'正文续写入口和连接中心可用',async()=>{const data=await c.ev(()=>{const composer=[...document.querySelectorAll('[data-moyun-region="composer"]')].find(x=>x.checkVisibility());return{composer:!!composer,prompt:!!composer?.querySelector('textarea'),generate:[...(composer?.querySelectorAll('button')||[])].some(x=>x.textContent.includes('提笔续写')),overflow:document.documentElement.scrollWidth>innerWidth+1};});assert.ok(data.composer&&data.prompt&&data.generate);assert.equal(data.overflow,false);await click('[data-moyun-region="composer"] [aria-label="去连接中心配置"]');assert.equal(await c.ev(()=>__s.activeSettingsTab),'api');assert.equal(await c.ev(()=>!!document.getElementById('settings-search-api-profiles')?.checkVisibility()),true);return data;});
   await check(name+'常用词可搜索并实际跳到首字超时',async()=>{await search('补写');const titles=await c.ev(()=>[...document.querySelectorAll('#settings-search-results .settings-search-result-title')].map(x=>x.textContent.trim()));assert.ok(titles.includes('二轮补写')&&titles.includes('三轮摘要补写'));await search('时间');const index=await c.ev(()=>__s.settingsSearchResults.find(x=>x.target==='settings-search-timeout').index);await shot(name+'-search');await click('#settings-search-option-'+index);await c.delay(1300);const data=await c.ev(()=>{const node=document.getElementById('settings-search-timeout'),r=node.getBoundingClientRect(),shell=document.querySelector('.settings-search-shell').getBoundingClientRect();return{tab:__s.activeSettingsTab,visible:node.checkVisibility(),inViewport:r.top<shell.bottom&&r.bottom>shell.top,overflow:document.documentElement.scrollWidth>innerWidth+1,aiCalls:__releaseAiCalls};});assert.equal(data.tab,'context');assert.equal(data.visible,true);assert.equal(data.inViewport,true);assert.equal(data.overflow,false);assert.equal(data.aiCalls,0);return data;});
   await c.ev(()=>{window.fetch=window.__releaseFetch;__s.showSettings_modal=false;});
  }
  assert.deepEqual(c.errors,[]);assert.deepEqual(c.logs.filter(x=>x.type==='error'),[]);passed=true;
 }finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed,url,results,errors:c.errors,consoleErrors:c.logs.filter(x=>x.type==='error')},null,2));}
};
