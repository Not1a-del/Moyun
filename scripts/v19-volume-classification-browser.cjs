'use strict';
// 真实返回文本只在隔离浏览器中重放，不调用在线模型。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function(c){
 const out=path.join(__dirname,'../.ui-check/volume-classification');fs.mkdirSync(out,{recursive:true});const results=[];
 let completed=false;
 const raw=fs.readFileSync(path.join(__dirname,'fixtures/v0.0.19/deepseekv41-text-planning-response.txt'),'utf8').replace(/\r\n/g,'\n');
 const ranges=[[1,10],[11,20],[21,30]],titles=['烬灯引·无名灯','鎏金帖','初灯语'];
 const ev=async(fn,...args)=>{const r=await c.send('Runtime.evaluate',{expression:'(async()=>JSON.stringify(await ('+fn.toString()+')('+args.map(x=>JSON.stringify(x)).join(',')+')))()',returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value===undefined?undefined:JSON.parse(r.result.value);};
 async function settle(){await ev(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await Promise.all([...document.querySelectorAll('[data-moyun-modal]')].flatMap(m=>m.getAnimations({subtree:true})).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});}
 async function check(name,fn){try{const data=await fn();results.push({name,ok:true,data});console.log('PASS',name,JSON.stringify(data));}catch(error){results.push({name,ok:false,error:String(error)});throw error;}}
 async function click(selector){
  let p;
  // 等待上一弹窗真正退出；命中校验保留，不能穿透遮挡直接调用 click()。
  for(let i=0;i<40;i++){
   await settle();p=await ev(selector=>{const el=document.querySelector(selector);if(!el)return{ok:false,missing:true};el.scrollIntoView({block:'center',behavior:'instant'});const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);if(!el.disabled&&el.contains(hit))return{ok:true,x,y};return{ok:false,box:r.toJSON(),disabled:el.disabled,showReview:__s.showOutlineRevisionModal,modal:document.querySelector('[data-moyun-modal]')?.className,hit:hit?.outerHTML.slice(0,400)};},selector);if(p.ok)break;await c.delay(50);
  }
  if(!p?.ok)throw Error('按钮不可点击 '+selector+' '+JSON.stringify(p));
  const point={x:p.x,y:p.y};await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});await c.delay(160);
 }
 async function shot(name){const r=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));}
 async function setup(dark,enabled,mode='text'){
  await ev(({raw,dark,enabled,mode})=>{
   const s=__s,id='volumes-'+Date.now();s.showNewBook=false;s.showSettings_modal=false;s.showOutlineRevisionModal=false;s.showManualPlanningRecovery=false;
   s.books.push({id,novel:{title:'真实文本三卷重放',outline:'旧大纲哨兵',chapterCount:10,volumes:[{id:'original',number:1,title:'原卷',startChapter:1,endChapter:10,summary:'旧卷纲哨兵',handoffSummaries:{main:{content:'原交接哨兵'}}}]},chapters:[],characters:[]});s.loadBook(id);
   s.chapterOutlines=[{id:'detail-sentinel',chapterNo:1,title:'旧章',content:'原细纲哨兵'}];s.showOutlineInMain=true;s.showDetailedOutlineInMain=false;s.outlineInput='保留第1章，继续完善故事大纲';if(s.isDark!==dark)s.toggleTheme();
   s.connectionCenter={version:3,profiles:[],defaultProfileId:'',moduleRoutes:{}};const made=s.createConnectionProfile({name:'隔离分卷重放',templateId:'openai-compatible',baseUrl:'https://classification.invalid/v1',defaultModel:enabled?'gemini-planning':'deepseek-planning',apiKey:'test-only',lastTest:{status:'ok'}});if(!made.ok)throw Error('创建模拟配置失败');s.connectionCenter.defaultProfileId=made.profile.id;
   s.settings.geminiTestInput=enabled;s.settings.preventTruncation=enabled;s.settings.outlineRequestMode='stream';s.settings.streamEnabled=true;
   window.__classificationCalls=[];window.__classificationRaw=raw;window.__classificationMode=mode;
   if(!window.__classificationOriginalFetch)window.__classificationOriginalFetch=window.fetch.bind(window);
   window.fetch=async(input,init={})=>{
    if(!String(input).includes('classification.invalid'))return __classificationOriginalFetch(input,init);
    const body=JSON.parse(init.body),repair=JSON.stringify(body).includes('你只修复卷纲格式');__classificationCalls.push({body,repair});
    if(repair)throw new TypeError('模拟格式修复仍失败');
    const rows=[{number:1,title:'烬灯引·无名灯',startChapter:1,endChapter:10,summary:'第一卷结构化候选'},{number:2,title:'鎏金帖',startChapter:11,endChapter:20,summary:'第二卷结构化候选'},{number:3,title:'初灯语',startChapter:21,endChapter:30,summary:'第三卷结构化候选'}];
    const text=__classificationMode==='json'?JSON.stringify({outline:'结构化大纲'.repeat(40),volumes:rows}):__classificationMode==='broken'?'模型计划尚未完整分类。'.repeat(100)+'\n第一卷：未分类文字\n章节范围：第5-2章':__classificationMode==='broken-json'?JSON.stringify({outline:'未分类文字，完整总纲仍须保留。'.repeat(100),volumes:[{number:1,title:'损坏范围',startChapter:5,endChapter:2}]}):__classificationMode==='mixed'?JSON.stringify({volumes:[{number:1,title:'无效示例',startChapter:5,endChapter:2}]})+'\n'+__classificationRaw:__classificationRaw;
    const payload=body.tools?JSON.stringify({content:text}):text,encoder=new TextEncoder();let offset=0;
    return new Response(new ReadableStream({async pull(controller){
     if(init.signal?.aborted){controller.error(new DOMException('已停止','AbortError'));return;}
     if(offset>=payload.length){controller.enqueue(encoder.encode('data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'));controller.close();return;}
     const part=payload.slice(offset,offset+500),delta=body.tools?{tool_calls:[{index:0,id:'reply',type:'function',function:{...(offset?{}:{name:'output_reply'}),arguments:part}}]}:{content:part};offset+=part.length;
     controller.enqueue(encoder.encode('data: '+JSON.stringify({choices:[{delta}]})+'\n\n'));await new Promise(resolve=>setTimeout(resolve,4));
    }}),{headers:{'content-type':'text/event-stream'}});
   };
  },{raw,dark,enabled,mode});
 }
 async function geometry(){await settle();return ev(()=>{const m=document.querySelector('[data-moyun-modal="outline-revision"]'),p=m?.querySelector('[data-moyun-modal-panel]'),r=p?.getBoundingClientRect(),b=m?.querySelector('[data-outline-manual-success]');return{modal:!!m,left:r?.left,right:r?.right,bottom:r?.bottom,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,buttonHeight:b?.getBoundingClientRect().height,theme:document.documentElement.dataset.theme};});}
 try{
  if(!process.argv.includes('--classification-focused'))for(const width of [1280,360,320])for(const dark of [false,true])for(const enabled of [false,true]){
   const label=width+'-'+(dark?'dark':'light')+'-'+(enabled?'on':'off');await c.send('Emulation.setDeviceMetricsOverride',{width,height:width===1280?800:740,deviceScaleFactor:1,mobile:width<768});await setup(dark,enabled);
   await check(label+' 原文→三卷候选，成功时仍可手动选择',async()=>{
    await ev(async()=>{await __s.generateOutline();await Vue.nextTick();});await c.delay(180);
    const d=await ev(()=>({rows:__s.outlineReview.volumePlan?.rows,raw:__s.outlineReview.rawOutput,outline:__s.novel.outline,volumes:__s.novel.volumes.length,calls:__classificationCalls.length,tool:!!__classificationCalls[0]?.body.tools,stream:__classificationCalls[0]?.body.stream,contract:JSON.stringify(__classificationCalls[0]?.body).includes('每卷必须独立一个对象')}));
    assert.deepEqual(d.rows?.map(r=>[r.startChapter,r.endChapter]),ranges);assert.deepEqual(d.rows.map(r=>r.title),titles);assert.equal(d.raw,raw);assert.equal(d.outline,'旧大纲哨兵');assert.equal(d.volumes,1);assert.equal(d.calls,1);assert.equal(d.tool,enabled);assert.equal(d.stream,true);assert.equal(d.contract,true);
    d.rows.forEach((r,i)=>{assert.match(r.summary,new RegExp('第'+(i*10+10)+'章'));assert.ok(r.writingRequirement);assert.match(r.bridge,/承接上一卷/);assert.match(r.bridge,/下一卷起笔核对/);});
    const g=await geometry();assert.equal(g.modal,true);assert.equal(g.overflow,false);assert.equal(g.theme,dark?'dark':'light');assert.ok(g.left>=0&&g.right<=width+1&&g.bottom<=g.height+1&&g.buttonHeight>=44,JSON.stringify(g));await shot(label+'-automatic');
    await click('[data-outline-manual-success]');assert.equal(await ev(()=>__s.manualPlanningDraft.raw),raw);await click('[data-manual-planning-close]');assert.equal(await ev(()=>__s.novel.volumes.length),1);assert.equal(await ev(()=>!!document.querySelector('[data-outline-manual-success]')),true);
    return{ranges:d.rows.map(r=>[r.startChapter,r.endChapter]),titles:d.rows.map(r=>r.title),requests:d.calls,tool:d.tool,contract:d.contract,geometry:g};
   });
   await check(label+' 二轮确认→写入三卷→实际刷新保留',async()=>{
    await ev(()=>{const b=[...document.querySelectorAll('[data-moyun-review-panel] button')].find(b=>b.textContent.includes('全部接受'));if(!b)throw Error('缺少全部接受');b.click();});await c.delay(160);
    await ev(()=>{const m=document.querySelector('[data-moyun-modal="confirm"]');if(m){const b=[...m.querySelectorAll('button')].find(b=>b.textContent.includes('确认并应用'));if(!b)throw Error('缺少确认');b.click();}});await c.delay(160);
    assert.equal(await ev(()=>!!document.querySelector('[data-outline-volume-stage]')),true);await shot(label+'-volume-review');await click('[data-outline-volume-accept]');
    await ev(()=>__s.saveData());await c.delay(2400);await c.navigate();
    const d=await ev(()=>({rows:__s.novel.volumes.map(r=>({title:r.title,start:r.startChapter,end:r.endChapter,summary:r.summary})),detail:__s.chapterOutlines[0]?.content,raw:__s.outlineReview.rawOutput}));assert.deepEqual(d.rows.map(r=>[r.start,r.end]),ranges);assert.deepEqual(d.rows.map(r=>r.title),titles);assert.equal(d.detail,'原细纲哨兵');assert.equal(d.raw,raw);
    await ev(async()=>{__s.showOutlineInMain=true;await Vue.nextTick();});await click('[data-planning-raw-manual]');assert.equal(await ev(()=>__s.manualPlanningDraft.raw),raw);await click('[data-manual-planning-close]');return{ranges:d.rows.map(r=>[r.start,r.end]),detail:d.detail,rawLength:d.raw.length};
   });
  }
  for(const enabled of [false,true]){
   await c.send('Emulation.setDeviceMetricsOverride',{width:360,height:740,deviceScaleFactor:1,mobile:true});
   await setup(false,enabled,'mixed');
   await check('无效JSON后继续识别同份原文的卷标题，开关'+enabled,async()=>{await ev(async()=>{await __s.generateOutline();});const d=await ev(()=>({ranges:__s.outlineReview.volumePlan?.rows.map(r=>[r.startChapter,r.endChapter]),calls:__classificationCalls.length,raw:__s.outlineReview.rawOutput}));assert.deepEqual(d.ranges,ranges);assert.equal(d.calls,1);assert.match(d.raw,/无效示例/);assert.ok(d.raw.endsWith(raw));return{ranges:d.ranges,calls:d.calls,rawLength:d.raw.length};});
   for(const sourceMode of ['text','mixed']){
   await setup(false,enabled,sourceMode);
   await check('细纲工作台'+sourceMode+'兜底也能实际创建三卷，开关'+enabled,async()=>{
    await ev(async()=>{const s=__s;s.chapterOutlines=Array.from({length:30},(_,i)=>({id:'detail-'+i,chapterNo:i+1,title:'原章'+(i+1),content:'原细纲事实'+(i+1)}));s.showOutlineInMain=false;s.showDetailedOutlineInMain=true;s.doInput='根据现有细纲重新划分卷纲';await Vue.nextTick();});await click('[data-moyun-detailed-ai]');for(let i=0;i<100&&await ev(()=>__s.isGeneratingOutline);i++)await c.delay(60);
    const d=await ev(()=>({rows:__s.outlineReview.workbenchVolumes?.rows.map(r=>[r.startChapter,r.endChapter]),raw:__s.outlineReview.rawOutput,old:__s.novel.volumes.length,calls:__classificationCalls.length}));assert.deepEqual(d.rows,ranges);assert.ok(d.raw.endsWith(raw));assert.equal(d.calls,1);assert.equal(d.old,1);await click('[data-outline-volume-accept]');await ev(()=>{const m=document.querySelector('[data-moyun-modal="confirm"]');[...m.querySelectorAll('button')].find(b=>b.textContent.includes('确认并应用')).click();});await c.delay(250);
    assert.deepEqual(await ev(()=>__s.novel.volumes.map(r=>[r.startChapter,r.endChapter])),ranges);assert.deepEqual(await ev(()=>__s.chapterOutlines.map(r=>r.content)),Array.from({length:30},(_,i)=>'原细纲事实'+(i+1)));return{ranges:d.rows,calls:d.calls,detailCount:30};
   });
   }
   await setup(false,enabled,'json');
   await check('JSON优先，开关'+enabled,async()=>{await ev(async()=>{await __s.generateOutline();});const d=await ev(()=>({ranges:__s.outlineReview.volumePlan?.rows.map(r=>[r.startChapter,r.endChapter]),calls:__classificationCalls.length,raw:__s.outlineReview.rawOutput}));assert.deepEqual(d.ranges,ranges);assert.equal(d.calls,1);assert.match(d.raw,/"volumes"/);return{ranges:d.ranges,calls:d.calls};});
   await check('自动成功改用手选，旧自动候选不能覆盖，开关'+enabled,async()=>{
    await click('[data-outline-manual-success]');await ev(()=>{const s=__s;Object.assign(s.manualPlanningDraft.editor,{target:'volume',targetId:'original',title:'手动指定卷',startChapter:1,endChapter:10,mode:'replace'});const el=document.querySelector('[data-manual-planning-raw]'),text='第一卷结构化候选',start=el.value.indexOf(text);el.focus();el.setSelectionRange(start,start+text.length);el.dispatchEvent(new Event('select',{bubbles:true}));});await click('[data-manual-planning-fill]');assert.equal(await ev(()=>__s.manualPlanningDraft.editor.text),'第一卷结构化候选');await click('[data-manual-planning-add]');await click('[data-manual-planning-preview]');await click('[data-manual-planning-apply]');for(let i=0;i<100&&await ev(()=>__s.manualPlanningBusy);i++)await c.delay(30);
    const d=await ev(()=>({title:__s.novel.volumes[0].title,count:__s.novel.volumes.length,outline:__s.novel.outline,detail:__s.chapterOutlines[0].content,auto:!!__s.outlineReview.volumePlan,calls:__classificationCalls.length}));assert.equal(d.title,'手动指定卷');assert.equal(d.count,1);assert.equal(d.outline,'旧大纲哨兵');assert.equal(d.detail,'原细纲哨兵');assert.equal(d.auto,false);assert.equal(d.calls,1);return d;
   });
   for(const mode of ['broken','broken-json']){
    await setup(false,enabled,mode);
    await check(mode+'识别及一次修复失败→保留原文→手动入口，开关'+enabled,async()=>{await ev(async()=>{await __s.generateOutline();});const d=await ev(()=>({failure:!!document.querySelector('[data-outline-volume-output-error]'),raw:__s.outlineReview.volumeOutputRaw,error:__s.outlineReview.volumeOutputError,volumes:__s.novel.volumes.length,summary:__s.novel.volumes[0].summary,calls:__classificationCalls.length,repairs:__classificationCalls.filter(x=>x.repair).length}));assert.equal(d.failure,true);assert.match(d.raw,/未分类文字/);if(mode==='broken-json')assert.match(d.raw,/完整总纲仍须保留/);assert.equal(d.volumes,1);assert.equal(d.summary,'旧卷纲哨兵');assert.equal(d.calls,2,JSON.stringify(d));assert.equal(d.repairs,1);await click('[data-outline-manual-recovery]');assert.equal(await ev(()=>__s.manualPlanningDraft.raw),d.raw);await click('[data-manual-planning-close]');return{...d,raw:d.raw.slice(0,70),rawLength:d.raw.length};});
   }
  }
  assert.deepEqual(c.errors,[]);completed=true;
 }finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:completed&&results.every(r=>r.ok)&&!c.errors.length,focused:process.argv.includes('--classification-focused'),results,errors:c.errors},null,2));}
};
