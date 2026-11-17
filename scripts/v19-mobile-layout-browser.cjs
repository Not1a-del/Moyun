'use strict';
// 隔离页面复现手机/平板工具栏与键盘改变可视区域；不发送模型请求。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function(c){
 const before=process.argv.includes('--record-before'),tablet=process.argv.includes('--tablet-layout'),out=path.resolve(__dirname,'../.ui-check/mobile-hotfix',before?'before':tablet?'tablet-smoke':'after');fs.mkdirSync(out,{recursive:true});
 const results=[];let passed=false;
 async function check(name,run){try{const data=await run();results.push({name,data});console.log('PASS',name);return data;}catch(error){results.push({name,error:String(error.stack||error)});throw error;}}
 async function shot(name){const image=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(image.data,'base64'));}
 async function visible(selector){return c.ev(selector=>{const node=document.querySelector(selector),r=node?.getBoundingClientRect(),v=visualViewport;return{exists:!!node,box:r?.toJSON(),height:r?.height,hit:!!node&&node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),viewport:{top:v?.offsetTop||0,height:v?.height||innerHeight,width:innerWidth,cssHeight:getComputedStyle(document.documentElement).getPropertyValue('--moyun-visual-viewport-height'),bodyHeight:getComputedStyle(document.body).height},overflow:document.documentElement.scrollWidth>innerWidth+1};},selector);}
 try{
  await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});await c.send('Page.bringToFront');
  await c.ev(()=>{window.__nativeViewport=window.visualViewport;window.__mobileTestAiCalls=0;window.fetch=async()=>{__mobileTestAiCalls++;throw Error('布局验收禁止 AI 请求');};__s.novel.title='手机布局验收';__s.chapters=[{id:'layout-chapter',branchId:'main',title:'第一章 · 布局验收',content:'正文段落用于检查阅读区滚动后仍能完整阅读。\n\n'.repeat(60),summary:'布局验收摘要',isExpanded:true,wordCount:1260}];});
  for(const [width,height] of before?[[360,740]]:tablet?[[1024,1366],[1280,800]]:[[1280,800],[768,1024],[390,844],[360,740],[320,740],[740,360]])for(const dark of [false,true]){
   const name=width+'x'+height+'-'+(dark?'dark':'light');
   await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768});
   if(tablet)await c.send('Emulation.setTouchEmulationEnabled',{enabled:width===1024,maxTouchPoints:1});
   await c.ev(async dark=>{Object.defineProperty(window,'visualViewport',{configurable:true,value:__nativeViewport});if(__s.isDark!==dark)__s.toggleTheme();__s.mobileSidebarOpen=false;__s.settings.thirdRoundSupplementEnabled=true;__s.settings.secondRoundSupplementEnabled=true;__s.openSettingsTab('context');await Vue.nextTick();},dark);await c.delay(350);
   await check(name+'开关形状和滑块位置',async()=>{
    await c.ev(()=>document.querySelector('[aria-label="三轮摘要补写开关"]').scrollIntoView({block:'center'}));await c.delay(200);
    const data=await c.ev(()=>['二轮补写开关','三轮摘要补写开关'].map(label=>{const hit=document.querySelector('[aria-label="'+label+'"]'),track=hit.querySelector('.toggle-track')||hit,thumb=track.querySelector('.toggle-thumb'),h=hit.getBoundingClientRect(),r=track.getBoundingClientRect(),t=thumb.getBoundingClientRect();return{label,hit:h.toJSON(),track:r.toJSON(),thumb:t.toJSON(),checked:hit.getAttribute('aria-checked')};}));
    await shot(name+'-toggles');if(!before)for(const x of data){assert.equal(x.track.width,44);assert.equal(x.track.height,24);assert.ok(Math.abs((x.thumb.top+x.thumb.bottom)/2-(x.track.top+x.track.bottom)/2)<1);assert.ok(x.thumb.left>=x.track.left&&x.thumb.right<=x.track.right);assert.ok(x.hit.width>=44&&x.hit.height>=44);}return data;
   });
   if(!before)await check(name+'开关关闭与恢复',async()=>{const data=await c.ev(async()=>{const rows=[];for(const label of ['二轮补写开关','三轮摘要补写开关']){const button=document.querySelector('[aria-label="'+label+'"]');button.click();await Vue.nextTick();const knob=button.querySelector('.toggle-thumb');getComputedStyle(knob).transform;await Promise.all(knob.getAnimations().map(animation=>animation.finished));const track=button.querySelector('.toggle-track').getBoundingClientRect(),thumb=button.querySelector('.toggle-thumb').getBoundingClientRect();rows.push({label,checked:button.getAttribute('aria-checked'),width:track.width,height:track.height,left:thumb.left-track.left});button.click();await Vue.nextTick();}return rows;});await c.delay(220);for(const row of data){assert.equal(row.checked,'false');assert.equal(row.width,44);assert.equal(row.height,24);assert.equal(row.left,3);}return data;});
   await check(name+'设置分类不随内容下移',async()=>{
    await c.ev(()=>{__s.openSettingsTab('api');document.querySelector('.settings-search-shell').scrollTop=0;});await c.delay(250);
    const first=await visible('.settings-tab-bar');await c.ev(()=>document.querySelector('.settings-search-shell').scrollTop=10000);await c.delay(250);const last=await visible('.settings-tab-bar');await shot(name+'-settings');
    if(!before){assert.ok(Math.abs(first.box.top-last.box.top)<1);assert.ok(last.hit);assert.equal(last.overflow,false);}return{first,last};
   });
   await c.ev(()=>{__s.showSettings_modal=false;});await c.delay(200);
   for(const scenario of tablet&&width===1024?[{label:'正常',reduction:0,top:0},{label:'浏览器双栏',reduction:132,top:0}]:width<768?[{label:'正常',reduction:0,top:0},{label:'浏览器双栏',reduction:132,top:0},{label:'地址栏收起',reduction:40,top:0},{label:'键盘',reduction:Math.min(360,height-240),top:0},{label:'键盘上移',reduction:Math.min(360,height-240),top:32}]:[{label:'桌面',reduction:0,top:0}]){
    await c.ev(({reduction,top})=>{const viewport=new EventTarget();Object.assign(viewport,{height:innerHeight-reduction-top,offsetTop:top,width:innerWidth,scale:1});Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport});window.__moyunSyncMobileChrome();},scenario);await c.delay(200);
    await check(name+scenario.label+'正文操作在可视区',async()=>{const data=await visible('[data-moyun-region="composer"]');const button=await visible('[data-moyun-composer-generate]');const reader=await c.ev(()=>{const main=document.querySelector('[data-moyun-region="main"]');main.scrollTo({top:main.scrollHeight,behavior:'instant'});const reachedEnd=main.scrollTop>0,last=main.querySelector('.paragraph-comment-line:last-child')||[...main.querySelectorAll('.paragraph-comment-line')].at(-1);last?.scrollIntoView({block:'center',behavior:'instant'});const end=last?.getBoundingClientRect(),area=main.getBoundingClientRect();return{reachedEnd,lastVisible:!!end&&end.bottom>area.top&&end.top<area.bottom,box:main.getBoundingClientRect().toJSON(),chapters:__s.visibleChapters.length,paragraphs:main.querySelectorAll('.paragraph-comment-line').length,scrollHeight:main.scrollHeight,clientHeight:main.clientHeight,scrollTop:main.scrollTop};});if(!before){assert.ok(data.box.bottom<=data.viewport.top+data.viewport.height+1,JSON.stringify(data));assert.ok(reader.box.bottom<=data.box.top+1,JSON.stringify({reader,data}));assert.equal(reader.chapters,1);assert.equal(reader.paragraphs,60);assert.ok(reader.scrollHeight>reader.clientHeight&&reader.reachedEnd&&reader.lastVisible,JSON.stringify(reader));assert.ok(button.hit,JSON.stringify(button));assert.equal(data.overflow,false);}if(scenario.label==='浏览器双栏'||scenario.label==='键盘上移')await shot(name+'-'+(scenario.label==='浏览器双栏'?'browser-bars':'keyboard'));return{data,button,reader};});
    await c.ev(()=>__s.openSettingsTab('api'));await c.delay(200);
    await check(name+scenario.label+'设置弹窗在可视区',async()=>{const footer=await visible('[data-settings-modal-footer]'),button=await visible('[data-settings-modal-footer] button'),header=await visible('[data-settings-modal-header]');if(!before){assert.ok(header.box.top>=header.viewport.top-1,JSON.stringify(header));assert.ok(footer.box.bottom<=footer.viewport.top+footer.viewport.height+1,JSON.stringify(footer));assert.ok(button.hit,JSON.stringify(button));assert.equal(footer.overflow,false);}return{header,footer,button};});
    await c.ev(()=>__s.showSettings_modal=false);await c.delay(150);
    await c.ev(()=>__s.showBranchPanel=true);await c.delay(150);
    await check(name+scenario.label+'分支弹窗不重复抬高',async()=>{const header=await visible('.moyun-branch-panel header'),button=await visible('.moyun-branch-panel footer button');if(!before){assert.ok(header.box.top>=header.viewport.top-1,JSON.stringify(header));assert.ok(button.box.bottom<=button.viewport.top+button.viewport.height+1,JSON.stringify(button));assert.ok(button.hit,JSON.stringify(button));assert.equal(button.overflow,false);}return{header,button};});
    await c.ev(()=>__s.showBranchPanel=false);await c.delay(100);
   }
   await c.ev(()=>{Object.defineProperty(window,'visualViewport',{configurable:true,value:__nativeViewport});window.__moyunSyncMobileChrome();});
  }
  if(!before&&!tablet){
   await c.send('Emulation.setDeviceMetricsOverride',{width:360,height:740,deviceScaleFactor:1,mobile:true});
   await check('不支持 visualViewport 时保持可用',async()=>{await c.ev(()=>{Object.defineProperty(window,'visualViewport',{configurable:true,value:undefined});window.__moyunSyncMobileChrome();});const data=await visible('[data-moyun-region="composer"]');assert.ok(data.box.bottom<=740);assert.equal(data.viewport.bodyHeight,'740px');assert.equal(data.overflow,false);return data;});
   await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
   await c.ev(()=>{Object.defineProperty(window,'visualViewport',{configurable:true,value:__nativeViewport});window.__moyunSyncMobileChrome();});
   await check('旋转并恢复电脑尺寸',async()=>{const data=await visible('[data-moyun-region="composer"]');assert.equal(data.viewport.bodyHeight,'800px');assert.equal(data.overflow,false);return data;});
  }
  assert.deepEqual(c.errors,[]);assert.deepEqual(c.logs.filter(x=>x.type==='error'),[]);assert.equal(await c.ev(()=>__mobileTestAiCalls),0);passed=true;
 }finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed,before,results,errors:c.errors,consoleErrors:c.logs.filter(x=>x.type==='error')},null,2));}
};
