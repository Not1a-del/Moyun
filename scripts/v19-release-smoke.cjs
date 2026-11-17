'use strict';
// 复用隔离 Edge runner；只核对部署文件和页面操作，不发送模型请求。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
module.exports=async function(c){
 const root=path.resolve(__dirname,'..'),url=await c.ev(()=>location.href),label=new URL(url).hostname==='127.0.0.1'?'local':'live';
 const out=path.join(root,'.ui-check/release-smoke',label);fs.mkdirSync(out,{recursive:true});
 const results=[];let passed=false;
 async function check(name,run){try{const data=await run();results.push({name,ok:true,data});console.log('PASS',name,JSON.stringify(data));}catch(error){results.push({name,ok:false,error:String(error)});throw error;}}
 async function click(selector){await c.ev(async selector=>{const node=document.querySelector(selector),modal=node?.closest('[data-moyun-modal]');await Promise.all((modal||node)?.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{}))||[]);},selector);const p=await c.ev(selector=>{const node=document.querySelector(selector);if(!node)throw Error('找不到 '+selector);node.scrollIntoView({block:'nearest',behavior:'instant'});const r=node.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{x,y,height:r.height,hit:node.contains(document.elementFromPoint(x,y))};},selector);assert.ok(p.hit,selector+' 被遮挡 '+JSON.stringify(p));assert.ok(p.height>=44,selector+' 点击高度不足 '+JSON.stringify(p));await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});await c.delay(350);return p;}
 async function shot(name){const image=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(image.data,'base64'));}
 async function search(query){await c.ev(async query=>{const input=document.querySelector('[data-settings-search-area] input');input.focus();input.value=query;input.dispatchEvent(new Event('input',{bubbles:true}));await Vue.nextTick();},query);}
 // 先离开页面再重新打开，保证读取的是新文档，不沿用上次 Vue 实例。
 async function reload(){await c.send('Page.navigate',{url:'about:blank'});for(let i=0;i<100;i++){if(await c.ev(()=>location.href==='about:blank'))break;await c.delay(100);}await c.send('Page.navigate',{url});for(let i=0;i<300;i++){try{if(await c.ev(url=>location.href===url&&typeof window.__moyunReadyAt==='number',url)){await c.ready();await c.delay(600);return;}}catch{}await c.delay(200);}throw Error('新文档未完成初始化');}
 try{
  await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});await c.send('Page.bringToFront');await c.send('Network.enable');await c.send('Network.setCacheDisabled',{cacheDisabled:true});
  await check('部署入口和全部启动文件与对应发布基准逐字节一致',async()=>{
   const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
   const files=['index.html',...[...html.matchAll(/<(?:script|link) [^>]*?(?:src|href)="([^"]+)"/g)].map(x=>x[1])];
   assert.ok(files.length>=6,'没有收集到全部启动资源');
   const rows=await c.ev(async files=>{const rows=[];for(const file of files){const response=await fetch(new URL(file,location.href),{cache:'reload'}),bytes=await response.arrayBuffer();rows.push({file,status:response.status,bytes:bytes.byteLength,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')});}return rows;},files);
   for(const row of rows){
    assert.equal(row.status,200,row.file);const file=row.file.split('?')[0].replace(/^[.][/]/,''),local=fs.readFileSync(path.join(root,file));
    // Windows 提交时会标准化换行；线上必须逐字节匹配 Git 中真正发布的文件。
    const bytes=label==='local'?local:execFileSync('git',['show','HEAD:'+file],{cwd:root,maxBuffer:8*1024*1024});
    if(label==='live')assert.equal(local.toString().replaceAll(String.fromCharCode(13),''),bytes.toString().replaceAll(String.fromCharCode(13),''),file+' 存在尚未提交的内容变化');
    assert.equal(row.sha256,crypto.createHash('sha256').update(bytes).digest('hex'),row.file+' 不是当前发布基准');
   }return{baseline:label==='local'?'工作目录原始字节':'Git HEAD 发布原始字节',files:rows};
  });
  await check('页面品牌图标实际解码成功',async()=>{const images=await c.ev(()=>[...document.querySelectorAll('img[src*="favicon"]')].map(node=>({src:node.getAttribute('src'),loaded:node.complete&&node.naturalWidth>0})));assert.ok(images.length);assert.ok(images.every(node=>node.loaded));return images;});
  const expectedChannel=new URL(url).hostname==='yydcm-129.github.io'?'public':new URL(url).hostname==='not1a-del.github.io'?'stable':'local';
  if(expectedChannel!=='local')await check('GitHub 仓库身份和静态站点入口一致',async()=>{
   const owner=expectedChannel==='public'?'yydcm-129':'Not1a-del',data=await c.ev(async owner=>{const response=await fetch('https://api.github.com/repos/'+owner+'/Moyun');if(!response.ok)throw Error('GitHub 元信息 '+response.status);const repo=await response.json();return{full_name:repo.full_name,homepage:repo.homepage,description:repo.description,has_pages:repo.has_pages,has_issues:repo.has_issues,default_branch:repo.default_branch};},owner);
   assert.equal(data.homepage.toLowerCase(),new URL('./',url).href.toLowerCase());assert.equal(data.full_name,owner+'/Moyun');assert.equal(data.default_branch,'main');assert.equal(data.has_pages,true);if(expectedChannel==='public'){assert.match(data.description,/公测|公众测试/);assert.equal(data.has_issues,true);}return data;
  });
  for(const width of [1280,390])for(const dark of [false,true]){
   const name=width+'-'+(dark?'dark':'light');await c.send('Emulation.setDeviceMetricsOverride',{width,height:width===1280?800:844,deviceScaleFactor:1,mobile:width<768});
   await c.ev(({dark})=>{if(__s.isDark!==dark)__s.toggleTheme();localStorage.removeItem('moyun_first_run_guide_seen');localStorage.removeItem('moyun_web_update_announcement_seen');},{dark});await reload();
   await check(name+'首次说明→1116公告→已读刷新',async()=>{
    assert.equal(await c.ev(()=>__s.isFirstRunGuide),true,JSON.stringify(await c.ev(()=>({guide:localStorage.getItem('moyun_first_run_guide_seen'),seen:localStorage.getItem('moyun_web_update_announcement_seen'),active:__s.webUpdateAnnouncement.id,shown:__s.showWebUpdateAnnouncement}))));await click('[data-web-update-ack]');
    const data=await c.ev(()=>{const modal=document.querySelector('[data-moyun-modal="web-update-announcement"]'),r=modal.getBoundingClientRect();return{title:__s.webUpdateAnnouncement.title,date:__s.webUpdateAnnouncement.publishedAt,text:modal.innerText,overflow:document.documentElement.scrollWidth>innerWidth+1,bounds:r.left>=0&&r.right<=innerWidth+1};});
    assert.equal(data.title,'1116更新');assert.equal(data.date,'2026-11-16');assert.ok(data.text.includes('设置常用词搜索')&&data.text.includes('分支上下文独立'));assert.doesNotMatch(data.text,/v0[.]0[.]19/);assert.equal(data.overflow,false);assert.equal(data.bounds,true);await shot(name+'-announcement');await click('[data-web-update-ack]');await reload();assert.equal(await c.ev(()=>__s.showWebUpdateAnnouncement),false);return{...data,text:undefined};
   });
   await check(name+'旧版已读用户只看到新公告',async()=>{await c.ev(()=>localStorage.setItem('moyun_web_update_announcement_seen','web-2026-10-24-1024-update'));await reload();assert.equal(await c.ev(()=>__s.webUpdateAnnouncement.title),'1116更新');assert.equal(await c.ev(()=>__s.isFirstRunGuide),false);await click('[data-web-update-ack]');return true;});
   await check(name+'站点标识和关于页入口可见可点',async()=>{
    const identity=await c.ev(()=>({channel:__s.releaseChannel,title:document.title,labels:[...document.querySelectorAll('[data-moyun-public-label]')].filter(node=>node.checkVisibility()).map(node=>{const r=node.getBoundingClientRect();return{text:node.textContent,bounds:r.left>=0&&r.right<=innerWidth};})}));
    assert.equal(identity.channel,expectedChannel);if(expectedChannel==='public'){assert.match(identity.title,/公众测试/);assert.equal(identity.labels.length,1);assert.ok(identity.labels[0].bounds);}else assert.equal(identity.labels.length,0);
    await c.ev(()=>__s.openSettingsTab('changelog'));await c.delay(350);
    const links=await c.ev(()=>[...document.querySelectorAll('[data-moyun-site-link]')].map(node=>{const r=node.getBoundingClientRect();return{key:node.dataset.moyunSiteLink,href:node.href,height:r.height,hit:node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),bounds:r.left>=0&&r.right<=innerWidth};}));
    assert.equal(links.length,3);for(const node of links){assert.ok(node.height>=44&&node.hit&&node.bounds,JSON.stringify(node));}assert.equal(links.find(x=>x.key==='public').href,'https://yydcm-129.github.io/Moyun/');assert.equal(links.find(x=>x.key==='stable').href,'https://not1a-del.github.io/Moyun/');assert.equal(links.find(x=>x.key==='feedback').href,'https://github.com/yydcm-129/Moyun/issues');
    await shot(name+'-site');await c.ev(()=>{__s.showSettings_modal=false;return true;});await c.delay(500);return{identity,links};
   });
   await c.ev(()=>{window.__releaseAiCalls=0;window.__releaseFetch=window.fetch;window.fetch=async()=>{__releaseAiCalls++;throw Error('发布冒烟禁止模型请求');};__s.mobileSidebarOpen=false;});
   await check(name+'正文续写入口和连接中心可用',async()=>{const data=await c.ev(()=>{const composer=[...document.querySelectorAll('[data-moyun-region="composer"]')].find(x=>x.checkVisibility());return{composer:!!composer,prompt:!!composer?.querySelector('textarea'),generate:[...(composer?.querySelectorAll('button')||[])].some(x=>x.textContent.includes('提笔续写')),overflow:document.documentElement.scrollWidth>innerWidth+1};});assert.ok(data.composer&&data.prompt&&data.generate);assert.equal(data.overflow,false);await click('[data-moyun-region="composer"] [aria-label="去连接中心配置"]');assert.equal(await c.ev(()=>__s.activeSettingsTab),'api');assert.equal(await c.ev(()=>!!document.getElementById('settings-search-api-profiles')?.checkVisibility()),true);return data;});
   await check(name+'常用词可搜索并实际跳到首字超时',async()=>{await search('补写');const titles=await c.ev(()=>[...document.querySelectorAll('#settings-search-results .settings-search-result-title')].map(x=>x.textContent.trim()));assert.ok(titles.includes('二轮补写')&&titles.includes('三轮摘要补写'));await search('时间');const index=await c.ev(()=>__s.settingsSearchResults.find(x=>x.target==='settings-search-timeout').index);await shot(name+'-search');await click('#settings-search-option-'+index);await c.delay(1300);const data=await c.ev(()=>{const node=document.getElementById('settings-search-timeout'),r=node.getBoundingClientRect(),shell=document.querySelector('.settings-search-shell').getBoundingClientRect();return{tab:__s.activeSettingsTab,visible:node.checkVisibility(),inViewport:r.top<shell.bottom&&r.bottom>shell.top,overflow:document.documentElement.scrollWidth>innerWidth+1,aiCalls:__releaseAiCalls};});assert.equal(data.tab,'context');assert.equal(data.visible,true);assert.equal(data.inViewport,true);assert.equal(data.overflow,false);assert.equal(data.aiCalls,0);return data;});
   await c.ev(()=>{window.fetch=window.__releaseFetch;__s.showSettings_modal=false;});
  }
  await c.send('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:1,mobile:true});
  for(const dark of [false,true])await check('320px '+(dark?'dark':'light')+' 公测身份、关于入口和横向边界',async()=>{
   await c.ev(dark=>{if(__s.isDark!==dark)__s.toggleTheme();__s.showSettings_modal=true;__s.openSettingsTab('changelog');__s.mobileSidebarOpen=false;},dark);await c.delay(400);
   const data=await c.ev(expected=>{const labels=[...document.querySelectorAll('[data-moyun-public-label]')].filter(node=>node.checkVisibility()),links=[...document.querySelectorAll('[data-moyun-site-link]')].map(node=>{const r=node.getBoundingClientRect();return{key:node.dataset.moyunSiteLink,height:r.height,hit:node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),bounds:r.left>=0&&r.right<=innerWidth};});return{channel:__s.releaseChannel,expected,title:document.title,labels:labels.length,siteInfo:document.querySelector('[data-moyun-site-info]')?.innerText||'',links,overflow:document.documentElement.scrollWidth>innerWidth+1};},expectedChannel);
   assert.equal(data.channel,expectedChannel);if(expectedChannel==='public'){assert.equal(data.labels,1);assert.match(data.title,/公众测试/);assert.match(data.siteInfo,/当前站点：公众测试站/);}else assert.equal(data.labels,0);assert.equal(data.links.length,3);assert.ok(data.links.every(node=>node.height>=44&&node.hit&&node.bounds),JSON.stringify(data.links));assert.equal(data.overflow,false);await shot('320-'+(dark?'dark':'light')+'-site');return data;
  });await c.ev(()=>{__s.showSettings_modal=false;});
  assert.deepEqual(c.errors,[]);assert.deepEqual(c.logs.filter(x=>x.type==='error'),[]);passed=true;
 }finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed,url,results,errors:c.errors,consoleErrors:c.logs.filter(x=>x.type==='error')},null,2));}
};
