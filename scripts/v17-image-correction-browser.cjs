'use strict';
// 可由既有隔离 CDP 会话或浏览器工具注入客户端运行；所有网络均为测试替身。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {connect}=require('./v16-r2-browser-session.cjs');
const {installMock}=require('./v17-image-suggestion-browser.cjs');
async function runBrowserTests(client){
 const results=[];let c,failed=false;
 const test=async(name,fn)=>{const data=await fn();results.push({name,ok:true,data});};
 const until=async fn=>{for(let i=0;i<100;i++){if(await c.ev(fn))return;await c.delay(100);}throw Error('等待测试状态超时');};
 const shot=async name=>{const s=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(__dirname,'../.ui-check/'+name+'.png'),Buffer.from(s.data,'base64'));};
 try{
  c=client||await connect();await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+installMock.toString()+')()'});await c.navigate();
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await c.ev(async()=>{
   const s=__s,id='v17-correction-'+Date.now();s.books.push({id,novel:{title:'插图交互验收'},chapters:[],characters:[]});s.loadBook(id);s.modPacks=[];s.showSettings_modal=false;s.showCharacterWorkbench=false;s.showStoryBibleWorkbench=false;s.showOutlineInMain=false;s.showDetailedOutlineInMain=false;s.showImportExport=false;s.mobileSidebarOpen=false;s.showPromptPreview=false;s.bookshelfView='book';s.currentTab='chapters';s.settings.sidebarCollapsed=true;
   s.connectionCenter={version:1,profiles:[],defaultProfileId:'',moduleRoutes:{}};
   s.createConnectionProfile({name:'默认模型',templateId:'openai-compatible',baseUrl:'https://mock-v17.invalid/v1',defaultModel:'default-model',apiKey:'test-only',lastTest:{status:'ok'}});
   const p=s.createConnectionProfile({name:'封面立绘模型',templateId:'openai-compatible',baseUrl:'https://mock-v17.invalid/v1',defaultModel:'cover-portrait-model',apiKey:'test-only',lastTest:{status:'ok'}});s.connectionCenter.moduleRoutes.imagetext={profileId:p.profile.id};
   s.imageGenEnabled=false;s.imageGenKey='STA1N-test-only';s.naiCallMode='rphub';s.chapters=[{id:'correction-ch',title:'港口',content:'港口哨兵：蓝色帆船驶向灯塔。\n\n[IMG: original lighthouse]\n\n近景哨兵：女孩站在甲板上。',summary:'',branchId:'main',isExpanded:true}];
   await ImageStore.set('img_correction-ch_'+s.simpleHash('original lighthouse'),{base64:__testPng(),tag:'original lighthouse',timestamp:Date.now()});__imageTest.text='fresh sailboat, girl on deck';s.saveData();
  });
  await until(()=>!!document.querySelector('.inline-image img[src]'));
  await c.ev(()=>{window.__imageErrors=[];Vue.watch(()=>__s.toast,t=>{if(t.show&&t.type==='error')__imageErrors.push(t.message);},{flush:'sync'});});
  await test('确认弹窗只有取消、AI 改词、直接重生三个按钮，PC/手机顺序正确且取消不请求',async()=>{
   const before=await c.ev(()=>({images:__imageTest.requests.length,text:__imageTest.textRequests.length}));
   for(const width of [1440,320,390]){
    await c.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
    await c.ev(()=>document.querySelector('[data-img-action="retry-regen"]').click());
    await until(()=>document.querySelector('.inline-image-confirm-actions button')?.getBoundingClientRect().height>=43.99);
    const d=await c.ev(()=>{const footer=document.querySelector('.inline-image-confirm-actions'),buttons=[...footer.querySelectorAll('button')];return {labels:buttons.map(b=>b.textContent.trim()),rects:buttons.map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,height:r.height,width:r.width,overflow:b.scrollWidth>b.clientWidth};}),pageOverflow:document.documentElement.scrollWidth>innerWidth};});
    assert.deepEqual(d.labels,['取消','AI 改词后生成','重新生成']);assert.equal(d.pageOverflow,false);
    assert.ok(d.rects.every(r=>r.height>=43.99&&r.width>=44&&!r.overflow));assert.ok(d.rects[0].right<=d.rects[1].x&&d.rects[1].right<=d.rects[2].x);assert.ok(d.rects.every(r=>r.y===d.rects[0].y));
    await shot('v17-regen-confirm-'+width);
    await c.ev(()=>document.querySelector('[data-moyun-modal="confirm"] [data-moyun-modal-cancel]').click());await until(()=>!__s.showConfirm);
   }
   assert.deepEqual(await c.ev(()=>({images:__imageTest.requests.length,text:__imageTest.textRequests.length})),before);
   await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  });
  await test('AI 重生读取当前正文且使用封面立绘专用模型，新词传入生图并入库',async()=>{
   await c.ev(()=>{__imageTest.textDelay=400;document.querySelector('[data-img-action="retry-regen"]').click();});
   await until(()=>!!document.querySelector('.inline-image-confirm-actions'));
   await c.ev(()=>document.querySelectorAll('.inline-image-confirm-actions button')[1].click());
   await until(()=>document.querySelector('[data-inline-status]').textContent.includes('阅读正文'));
   await until(()=>!document.querySelector('.inline-image[aria-busy="true"]'));
   const d=await c.ev(async()=>{const r=await ImageStore.get(document.querySelector('.inline-image').dataset.cacheKey);return {text:__imageTest.textRequests.at(-1),tag:__imageTest.requests.find(r=>r.method==='POST').body.tag,versions:r.versions.map(v=>v.tag)};});
   assert.equal(d.text.model,'cover-portrait-model');assert.match(JSON.stringify(d.text.messages),/港口哨兵/);assert.match(JSON.stringify(d.text.messages),/近景哨兵/);assert.equal(d.tag,'fresh sailboat, girl on deck');assert.deepEqual(d.versions,['original lighthouse',d.tag]);return{model:d.text.model,tag:d.tag};
  });
  await test('PC 悬停样式显示、解除后隐藏，图片点击打开预览',async()=>{
   await c.ev(()=>{document.querySelector('.inline-image').scrollIntoView({block:'center'});document.activeElement?.blur();});
   await c.send('DOM.enable',{});await c.send('CSS.enable',{});const doc=await c.send('DOM.getDocument',{}),frame=await c.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'.inline-image-frame'});
   await c.send('CSS.forcePseudoState',{nodeId:frame.nodeId,forcedPseudoClasses:['hover']});await until(()=>getComputedStyle(document.querySelector('.inline-image-tools')).opacity==='1');
   assert.equal(await c.ev(()=>getComputedStyle(document.querySelector('.inline-image-tools')).opacity),'1');await shot('v17-correction-desktop-hover');
   await c.send('CSS.forcePseudoState',{nodeId:frame.nodeId,forcedPseudoClasses:[]});await until(()=>getComputedStyle(document.querySelector('.inline-image-tools')).opacity==='0');
   assert.equal(await c.ev(()=>getComputedStyle(document.querySelector('.inline-image-tools')).opacity),'0');
   const preview=await c.ev(()=>{const original=window._imgPreview;let source='';window._imgPreview=value=>{source=value;};document.querySelector('.inline-image img').click();window._imgPreview=original;return source.startsWith('data:image/');});assert.equal(preview,true);return{hover:true,leave:true,preview:true};
  });
  await test('正文编辑显示当前提示词，蓝色箭头切换历史并同步图片',async()=>{
   await c.ev(()=>__s.startChapterEdit(0));await until(()=>!!document.querySelector('[data-inline-prompt]'));
   assert.equal(await c.ev(()=>document.querySelector('[data-inline-prompt]').value),'fresh sailboat, girl on deck');
   await c.ev(()=>document.querySelector('.inline-prompt-history [data-img-action="previous"]').click());await c.delay(100);
   assert.equal(await c.ev(()=>document.querySelector('[data-inline-prompt]').value),'original lighthouse');
   assert.equal(await c.ev(()=>document.querySelector('.inline-prompt-history').textContent.trim()),'1 / 2');
   await c.ev(()=>document.querySelector('.inline-prompt-history [data-img-action="next"]').click());await c.delay(100);
   assert.equal(await c.ev(()=>document.querySelector('[data-inline-prompt]').value),'fresh sailboat, girl on deck');
  });
  await test('手动编辑提示词直接生图，不调用文本 AI，追加第三版',async()=>{
   const before=await c.ev(()=>__imageTest.textRequests.length);
   await c.ev(()=>{const p=document.querySelector('[data-inline-prompt]');p.value='manual tags, [[soft light]]';p.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-img-action="use-prompt"]').click();});await until(()=>!document.querySelector('.inline-image[aria-busy="true"]'));
   assert.equal(await c.ev(()=>__imageTest.textRequests.length),before);assert.equal(await c.ev(()=>__imageTest.requests.filter(x=>x.method==='POST').at(-1).body.tag),'manual tags, [[soft light]]');assert.equal(await c.ev(()=>document.querySelector('.inline-prompt-history').textContent.trim()),'3 / 3');
  });
  await test('手机控件缩小、可触达且不重叠，编辑提示词历史清晰',async()=>{
   for(const width of [320,390]){
    await c.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:true});await c.ev(()=>document.querySelector('.inline-image').scrollIntoView({block:'center'}));
    const d=await c.ev(()=>{const wrap=document.querySelector('.inline-image');const a=wrap.querySelector('.img-version-controls').getBoundingClientRect(),b=wrap.querySelector('.inline-image-tools').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,opacity:getComputedStyle(wrap.querySelector('.inline-image-tools')).opacity,separated:a.right<=b.left,buttons:[...wrap.querySelectorAll('.inline-image-frame button')].map(e=>e.getBoundingClientRect().width)};});
    assert.equal(d.overflow,false);assert.equal(d.opacity,'1');assert.equal(d.separated,true);assert.ok(d.buttons.every(x=>x===32));await shot('v17-correction-mobile-'+width);
   }
  });
  await test('文本失败或空回不提交图片、不丢历史',async()=>{
   const before=await c.ev(()=>__imageTest.requests.filter(r=>r.method==='POST').length);
   const ok=await c.ev(async()=>{__imageTest.text='';const w=document.querySelector('.inline-image');return __s.regenerateInlineImage(w.dataset.cacheKey,w.dataset.tag,{rewritePrompt:true});});assert.equal(ok,false);assert.equal(await c.ev(()=>__imageTest.requests.filter(r=>r.method==='POST').length),before);assert.equal(await c.ev(()=>document.querySelector('.inline-prompt-history').textContent.trim()),'3 / 3');
  });
  await test('AI 读词期间修改正文，旧结果不提交图片',async()=>{
   const before=await c.ev(()=>__imageTest.requests.filter(r=>r.method==='POST').length);
   await c.ev(()=>{__imageTest.text='stale tags';__imageTest.textDelay=600;const w=document.querySelector('.inline-image');window.__rewrite=__s.regenerateInlineImage(w.dataset.cacheKey,w.dataset.tag,{rewritePrompt:true});});
   await c.ev(()=>{__s.chapters[0].tempContent+='\n新增正文';});assert.equal(await c.ev(async()=>await __rewrite),false);assert.equal(await c.ev(()=>__imageTest.requests.filter(r=>r.method==='POST').length),before);
  });
  await test('旧版本选中后保存和刷新，图片及提示词仍对应',async()=>{
   await c.ev(()=>{document.querySelector('.inline-prompt-history [data-img-action="previous"]').click();});await c.delay(150);await c.ev(()=>{__s.saveChapterEdit(0);__s.saveData();});await c.delay(2200);await c.navigate();await c.ev(()=>{__s.chapters[0].isExpanded=true;__s.showSettings_modal=false;__s.mobileSidebarOpen=false;__s.bookshelfView='book';__s.startChapterEdit(0);});await until(()=>document.querySelector('[data-inline-prompt]')?.value==='fresh sailboat, girl on deck');assert.equal(await c.ev(()=>document.querySelector('.inline-prompt-history').textContent.trim()),'2 / 3');
  });
  await test('右侧直接按当前选中旧版的词重生，无文本 AI 配置也可用，忽略未提交草稿',async()=>{
   const before=await c.ev(()=>__imageTest.textRequests.length);
   await c.ev(()=>{window.__savedConnections=__s.connectionCenter;__s.connectionCenter={version:1,profiles:[],defaultProfileId:'',moduleRoutes:{}};const p=document.querySelector('[data-inline-prompt]');p.value='unsaved draft must not be used';p.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-img-action="retry-regen"]').click();});
   await until(()=>!!document.querySelector('.inline-image-confirm-actions'));
   await c.ev(()=>document.querySelectorAll('.inline-image-confirm-actions button')[2].click());
   await until(()=>!document.querySelector('.inline-image[aria-busy="true"]'));
   assert.equal(await c.ev(()=>__imageTest.textRequests.length),before);
   assert.equal(await c.ev(()=>__imageTest.requests.filter(r=>r.method==='POST').at(-1).body.tag),'fresh sailboat, girl on deck');
   const d=await c.ev(async()=>{const record=await ImageStore.get(document.querySelector('.inline-image').dataset.cacheKey);__s.connectionCenter=__savedConnections;return {current:record.current,tags:record.versions.map(v=>v.tag)};});
   assert.equal(d.current,3);assert.deepEqual(d.tags,['original lighthouse','fresh sailboat, girl on deck','manual tags, [[soft light]]','fresh sailboat, girl on deck']);return d;
  });
  await test('失败只弹一次原有提示，图片下不留错误，重绘不重试，手动再次失败仍提示',async()=>{
   await c.ev(()=>{window.__imageErrors=[];Vue.watch(()=>__s.toast,t=>{if(t.show&&t.type==='error')__imageErrors.push(t.message);},{flush:'sync'});__imageTest.mode='failed';__s.imageGenEnabled=true;});
   for(let attempt=1;attempt<=2;attempt++){
    await c.ev(()=>document.querySelector('[data-img-action="retry-regen"]').click());
    await c.ev(()=>__s.execConfirmChoice('confirm'));
    assert.equal(await c.ev(()=>__imageErrors.length),attempt);
    assert.equal(await c.ev(()=>__s.toast.type),'error');assert.match(await c.ev(()=>__s.toast.message),/额度不足/);
    assert.equal(await c.ev(()=>document.querySelector('[data-inline-status]').hidden),true);
    assert.equal(await c.ev(()=>document.querySelector('.inline-prompt-history').textContent.trim()),'4 / 4');
    const requests=await c.ev(()=>__imageTest.requests.length);
    await c.ev(async()=>{__s.dismissToast();__s.chapters[0].tempContent+='\n重绘验证';await __s.loadCachedImages();});await c.delay(350);
    assert.equal(await c.ev(()=>__s.toast.show),false);assert.equal(await c.ev(()=>__imageErrors.length),attempt);assert.equal(await c.ev(()=>__imageTest.requests.length),requests);
   }
   await c.ev(()=>{__imageTest.mode='ok';__imageTest.text='';});
   await c.ev(()=>document.querySelector('[data-img-action="retry-regen"]').click());await c.ev(()=>__s.execConfirmChoice('rewrite'));
   assert.equal(await c.ev(()=>__imageErrors.length),3);assert.equal(await c.ev(()=>document.querySelector('[data-inline-status]').hidden),true);
  });
  await test('无旧图首次失败也清除图下错误并阻止自动再次提交',async()=>{
   const before=await c.ev(()=>__imageErrors.length);
   await c.ev(()=>{__s.dismissToast();__imageTest.mode='failed';__s.chapters=[{id:'failed-first-'+Date.now(),title:'首次失败',content:'[IMG: failure first image]',isExpanded:true,branchId:'main'}];});
   await until(()=>__imageErrors.length>0&&__s.toast.show);
   await until(()=>!document.querySelector('.inline-image[aria-busy="true"]'));
   assert.equal(await c.ev(()=>__imageErrors.length),before+1);assert.equal(await c.ev(()=>document.querySelector('[data-inline-status]').hidden),true);
   const posts=await c.ev(()=>__imageTest.requests.filter(r=>r.method==='POST').length);
   await c.ev(async()=>{__s.dismissToast();await __s.loadCachedImages();});await c.delay(350);
   assert.equal(await c.ev(()=>__imageTest.requests.filter(r=>r.method==='POST').length),posts);assert.equal(await c.ev(()=>__s.toast.show),false);
  });
  await test('等待时收起章节仍提示一次失败，切换书籍后不弹旧任务错误',async()=>{
   const before=await c.ev(()=>__imageErrors.length);
   await c.ev(()=>{__imageTest.hold='queued';__imageTest.mode='ok';const w=document.querySelector('.inline-image');window.__collapsedRun=__s.regenerateInlineImage(w.dataset.cacheKey,w.dataset.tag);});
   await until(()=>document.querySelector('.inline-image')?.getAttribute('aria-busy')==='true');
   await c.ev(()=>{__s.chapters[0].isExpanded=false;__imageTest.hold='';__imageTest.mode='failed';});
   assert.equal(await c.ev(async()=>await __collapsedRun),false);assert.equal(await c.ev(()=>__imageErrors.length),before+1);
   await c.ev(()=>{__s.dismissToast();__s.chapters[0].isExpanded=true;__imageTest.mode='ok';__imageTest.hold='queued';});
   await until(()=>!!document.querySelector('.inline-image'));
   await c.ev(()=>{const w=document.querySelector('.inline-image');window.__switchedRun=__s.regenerateInlineImage(w.dataset.cacheKey,w.dataset.tag);});
   await until(()=>document.querySelector('.inline-image')?.getAttribute('aria-busy')==='true');
   await c.ev(()=>{const id='error-isolation-'+Date.now();__s.books.push({id,novel:{title:'错误隔离'},chapters:[],characters:[]});__s.loadBook(id);__imageTest.mode='failed';});
   assert.equal(await c.ev(async()=>await __switchedRun),false);assert.equal(await c.ev(()=>__imageErrors.length),before+1);assert.equal(await c.ev(()=>__s.toast.type==='error'&&__s.toast.show),false);
  });
 }catch(error){failed=true;results.push({name:'运行中断',ok:false,error:String(error)});if(!client)process.exitCode=1;}
 finally{fs.writeFileSync(path.join(__dirname,'../.ui-check/v17-image-correction-results.json'),JSON.stringify({passed:!failed,results},null,2));c?.ws.close();}
 return {passed:!failed,results};
}
if(require.main===module)runBrowserTests().then(console.log);
module.exports={runBrowserTests};
