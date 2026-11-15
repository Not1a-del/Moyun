'use strict';
// 复用大纲验收脚本的隔离 Edge，仅使用本地模拟响应。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function(c){
 const output=path.resolve(__dirname,'../.ui-check/planning-recovery');fs.mkdirSync(output,{recursive:true});
 const fixture=fs.readFileSync(path.join(__dirname,'fixtures/v0.0.19/gemini-planning-response.txt'),'utf8'),results=[];
 const ev=async(fn,...args)=>{const r=await c.send('Runtime.evaluate',{expression:'(async()=>JSON.stringify(await ('+fn.toString()+')('+args.map(x=>JSON.stringify(x)).join(',')+')))()',returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value===undefined?undefined:JSON.parse(r.result.value);};
 async function check(name,fn){try{const data=await fn();results.push({name,ok:true,data});console.log('PASS',name,JSON.stringify(data));}catch(error){results.push({name,ok:false,error:String(error)});throw error;}}
 async function screenshot(name){const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(shot.data,'base64'));}
 await ev(raw=>{
  window.__planningFixture=raw;window.__planningCalls=[];window.__planningMode='complete';
  const original=window.fetch;
  window.fetch=async(input,init={})=>{
   const url=String(input);if(!url.includes('planning.invalid'))return original(input,init);
   const body=JSON.parse(init.body),native=/generatecontent/i.test(url),tool=!!body.tools,mode=__planningMode;
   __planningCalls.push({body,mode,native,tool,stream:native?/streamgeneratecontent/i.test(url):body.stream});
   if(mode==='invalid-volume'&&JSON.stringify(body).includes('你只修复卷纲格式'))throw new DOMException('模拟卷纲修复失败','AbortError');
   const fence=String.fromCharCode(96).repeat(3);
   const text=mode==='invalid-volume'?JSON.stringify({outline:'不应写入的候选大纲'.repeat(15),volumes:[{number:1,title:'损坏范围',startChapter:5,endChapter:2}]}):native?raw:'以下是整理结果：\n'+fence+'json\n'+JSON.stringify({result:JSON.parse(raw)})+'\n'+fence+'\n请审阅。';
   const payload=tool&&!native?JSON.stringify({content:text}):text,encode=new TextEncoder();let offset=0;
   const packet=data=>encode.encode('data: '+JSON.stringify(data)+'\n\n');
   const upstream=new ReadableStream({async pull(controller){
    if(init.signal?.aborted){controller.error(new DOMException('用户停止','AbortError'));return;}
    if(mode==='stop'&&offset>0){await new Promise(resolve=>init.signal.addEventListener('abort',resolve,{once:true}));controller.error(new DOMException('用户停止','AbortError'));return;}
    if(mode==='disconnect'&&offset>0){controller.error(new TypeError('模拟连接中断'));return;}
    if(offset>=payload.length){
     if(native)controller.enqueue(packet({candidates:[{content:{parts:tool?[{functionCall:{name:'output_reply',args:{content:text}}}]:[]},finishReason:'STOP'}]}));
     else controller.enqueue(packet({choices:[{delta:{},finish_reason:'stop'}]}));
     controller.enqueue(encode.encode('data: [DONE]\n\n'));controller.close();return;
    }
    const end=Math.min(payload.length,offset+420),chunk=payload.slice(offset,end);
    if(native)controller.enqueue(packet({candidates:[{content:{parts:[tool?{functionCall:{name:'output_reply',args:{content:text.slice(0,end)}}}:{text:chunk}]}}]}));
    else controller.enqueue(packet({choices:[{delta:tool?{tool_calls:[{index:0,id:'reply',type:'function',function:{...(offset===0?{name:'output_reply'}:{}),arguments:chunk}}]}:{content:chunk}}]}));
    offset=end;await new Promise(resolve=>setTimeout(resolve,3));
   }});
   return new Response(upstream,{headers:{'content-type':'text/event-stream'}});
  };
 },fixture);
 async function configure(native,enabled){await ev(({native,enabled})=>{const s=__s;s.connectionCenter={version:3,profiles:[],defaultProfileId:'',moduleRoutes:{}};const made=s.createConnectionProfile({name:'本地规划模拟',templateId:native?'gemini':'openai-compatible',baseUrl:'https://planning.invalid/v1',defaultModel:native?'gemini-3-planning':'deepseek-planning',apiKey:'test-only',lastTest:{status:'ok'}});if(!made.ok)throw Error('模拟配置创建失败');s.connectionCenter.defaultProfileId=made.profile.id;s.settings.geminiTestInput=enabled;s.settings.preventTruncation=enabled;s.settings.outlineRequestMode='stream';s.settings.streamEnabled=true;s.oneKeyAutoRetry=false;},{native,enabled});}
 try{
  for(const width of [1280,360])for(const dark of [false,true])for(const enabled of [false,true]){
   await c.send('Emulation.setDeviceMetricsOverride',{width,height:width===1280?800:740,deviceScaleFactor:1,mobile:width<768});
   const label=width+'-'+(dark?'dark':'light')+'-'+(enabled?'on':'off');
   for(const native of [false,true]){
    await configure(native,enabled);
    await ev(dark=>{
     const s=__s,id='planning-'+Date.now();s.showSettings_modal=false;s.showNewBook=false;s.showBranchPanel=false;s.showOutlineRevisionModal=false;s.outlineReview={revisions:[]};
     s.books.push({id,title:'通用规划验收',novel:{title:'通用规划验收',outline:'正式大纲哨兵',chapterCount:30,volumes:[{id:'v1',title:'原卷哨兵',startChapter:1,endChapter:30,summary:'原卷纲哨兵'}]},chapters:[],characters:[]});s.loadBook(id);s.chapterOutlines=[{id:'detail-sentinel',chapterNo:1,title:'旧章',content:'正式细纲哨兵'}];
     if(s.isDark!==dark)s.toggleTheme();s.outlineInput='补充主角寻找线索的过程，保持30章';s.showOutlineInMain=true;s.showDetailedOutlineInMain=false;window.__planningMode='complete';__planningCalls=[];
    },dark);
    await check(label+' '+(native?'Gemini原样例':'DeepSeek形态嵌套JSON')+' 进入审阅',async()=>{
     await ev(async()=>{await __s.generateOutline();await Vue.nextTick();});await c.delay(350);
     const d=await ev(()=>{const s=__s,modal=document.querySelector('[data-moyun-modal="outline-revision"]'),r=modal?.querySelector('[data-moyun-modal-panel]')?.getBoundingClientRect();return{modal:!!modal,candidate:s.outlineReview.afterText,volumes:s.outlineReview.volumePlan?.rows.length,outline:s.novel.outline,details:s.chapterOutlines.map(x=>x.content),panel:{left:r?.left,right:r?.right,top:r?.top,bottom:r?.bottom},viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth+1,requests:__planningCalls.map(x=>({native:x.native,tool:x.tool,stream:x.stream}))};});
     assert.equal(await ev(()=>document.documentElement.dataset.theme),dark?'dark':'light');
     assert.equal(d.modal,true);assert.equal(d.volumes,6);assert.match(d.candidate,/荒原血蜕/);assert.match(d.candidate,/第30章/);assert.equal(d.outline,'正式大纲哨兵');assert.deepEqual(d.details,['正式细纲哨兵']);assert.equal(d.overflow,false);assert.ok(d.panel.left>=0&&d.panel.right<=width+1&&d.panel.bottom<=d.viewport[1]+1,JSON.stringify(d.panel));assert.equal(d.requests[0].stream,true);assert.equal(d.requests[0].tool,native&&enabled);
     await screenshot(label+'-'+(native?'gemini':'nested'));return{...d,candidate:d.candidate.slice(0,65)};
    });
    await ev(()=>{__s.rejectAllRevisions();});
   }
   await check(label+' 中断与主动停止保留原文',async()=>{
    const rows=[];
    for(const mode of ['disconnect','stop']){
     await ev(mode=>{__planningMode=mode;__s.outlineReview={revisions:[]};__s.showOutlineRevisionModal=false;__s.outlineStreamPreview='';},mode);
     if(mode==='stop'){
      await ev(()=>{window.__planningRun=__s.generateOutline();});
      let live=false;for(let i=0;i<100;i++){live=await ev(()=>!!__s.outlineStreamPreview);if(live)break;await c.delay(20);}assert.equal(live,true);
      await ev(async()=>{__s.stopOutlineRun();await __planningRun;await Vue.nextTick();});
     }else await ev(async()=>{await __s.generateOutline();await Vue.nextTick();});
     const d=await ev(()=>({mode:__planningMode,raw:__s.outlineReview.volumeOutputRaw,error:__s.outlineReview.volumeOutputError,modal:!!document.querySelector('[data-moyun-modal="outline-revision"]'),outline:__s.novel.outline,detail:__s.chapterOutlines[0]?.content,apply:!!document.querySelector('[data-outline-volume-accept]')}));
     assert.equal(d.modal,true);assert.ok(d.raw.length>50);assert.match(d.raw,/荒原血蜕/);assert.equal(d.outline,'正式大纲哨兵');assert.equal(d.detail,'正式细纲哨兵');assert.equal(d.apply,false);rows.push({...d,raw:d.raw.slice(0,65)});
     await ev(()=>__s.rejectOutlineVolumePlanningFailure());
    }return rows;
   });
  }
  for(const native of [false,true])for(const enabled of [false,true]){
   const label='onekey-'+(native?'native':'compatible')+'-'+(enabled?'on':'off');await configure(native,enabled);
   await ev(()=>{const s=__s;s.showOutlineRevisionModal=false;s.showOutlineInMain=false;s.openNewBookModal();s.newBookForm={theme:'共30章，6卷，林渊寻找线索，保留作者原始输入',title:'原始书名输入',worldView:'原始世界观输入',charCount:0};Object.assign(s.okCfg,{genTitle:false,genSynopsis:false,genWorldView:false,genNegative:false,genOutline:true,genDetailed:false,genCover:false,genCharAvatar:false,charCount:0,genPipeline:false,genStyles:false,genPresets:false});__planningMode='disconnect';__planningCalls=[];});
   await check(label+' 失败页和配置不丢内容',async()=>{
    await ev(async()=>{await __s.startOneKeyGeneration();await Vue.nextTick();document.querySelector('[data-one-key-partial]')?.setAttribute('open','');});
    const d=await ev(()=>({failed:__s.okFailedSteps.map(x=>({id:x.id,raw:x.raw})),outline:__s.novel.outline,stored:__s.novel.oneKeyRecovery?.core.raw,visible:document.querySelector('[data-one-key-partial] pre')?.textContent,all:!!document.querySelector('[data-one-key-failed-actions] button'),requests:__planningCalls.map(x=>({tool:x.tool,stream:x.stream,inputRewritten:!!x.body.contents?.some(row=>row.parts?.some(part=>part.functionResponse?.name==='read_user_input'))}))}));
    assert.equal(d.failed.length,1);assert.ok(d.stored.length>50);assert.equal(d.visible,d.stored);assert.equal(d.all,true);assert.equal(d.requests[0].stream,true);assert.equal(d.requests[0].tool,native&&enabled);assert.equal(d.requests[0].inputRewritten,native&&enabled);assert.ok(!d.outline);
    if(!native&&!enabled)for(const width of [1280,360,320])for(const dark of [false,true]){
     await check(width+'-'+(dark?'dark':'light')+' 失败操作固定在底栏且可点击',async()=>{
      const height=width===1280?800:740;await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768});
      await ev(dark=>{if(__s.isDark!==dark)__s.toggleTheme();},dark);await c.delay(180);
      const layout=await ev(()=>{const group=document.querySelector('[data-one-key-failed-actions]'),footer=group.parentElement,buttons=[...footer.querySelectorAll('button')];return{labels:buttons.map(b=>b.textContent.trim()),buttons:buttons.map(b=>{const r=b.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,hit:b.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))};}),overflow:document.documentElement.scrollWidth>innerWidth+1,footerOverflow:footer.scrollWidth>footer.clientWidth+1,theme:document.documentElement.dataset.theme};});
      assert.deepEqual(layout.labels,['全部重开','返回配置','关闭']);assert.equal(layout.overflow,false);assert.equal(layout.footerOverflow,false);assert.equal(layout.theme,dark?'dark':'light');
      const [retry,back]=layout.buttons;assert.ok(retry.right<=back.left+1);assert.ok(Math.abs(retry.top-back.top)<1);
      layout.buttons.forEach(b=>{assert.ok(b.height>=43.5&&b.left>=0&&b.right<=width+1&&b.bottom<=height+1);assert.equal(b.hit,true);});
      await screenshot('failed-actions-'+width+'-'+(dark?'dark':'light'));return layout;
     });
    }
    await ev(()=>{document.querySelector('[data-one-key-failed-actions] button:nth-child(2)').click();});const form=await ev(()=>({...__s.newBookForm}));assert.equal(form.theme,'共30章，6卷，林渊寻找线索，保留作者原始输入');assert.equal(form.title,'原始书名输入');assert.equal(form.worldView,'原始世界观输入');return{failed:d.failed.map(x=>({id:x.id,chars:x.raw.length})),requests:d.requests,form};
   });
   await check(label+' 完整候选校验失败不会覆盖正式大纲',async()=>{
    await ev(async()=>{__s.novel.outline='已写入正式大纲';__planningMode='invalid-volume';await __s.startOneKeyGeneration();await Vue.nextTick();});
    const d=await ev(()=>({outline:__s.novel.outline,failed:__s.okFailedSteps.map(x=>x.id),raw:__s.novel.oneKeyRecovery?.core.raw,previous:__s.novel.oneKeyRecovery?.core.previousRaw}));assert.equal(d.outline,'已写入正式大纲');assert.deepEqual(d.failed,['core']);assert.match(d.raw,/不应写入/);assert.ok(d.previous.length>50);return{outline:d.outline,failed:d.failed,rawChars:d.raw.length,previousChars:d.previous.length};
   });
   await check(label+' 全部重开实际完成失败模块',async()=>{
    await ev(async()=>{__planningMode='complete';__planningCalls=[];await __s.retryAllOneKeyModules();await Vue.nextTick();});
    const d=await ev(()=>({failed:__s.okFailedSteps.map(x=>x.id),recovery:!!__s.novel.oneKeyRecovery,outline:__s.novel.outline,volumes:__s.novel.volumes.length,calls:__planningCalls.length}));assert.deepEqual(d.failed,[]);assert.equal(d.recovery,false);assert.match(d.outline,/荒原血蜕/);assert.equal(d.volumes,6);assert.equal(d.calls,1);return{...d,outline:d.outline.slice(0,60)};
   });
  }
  await check('保存刷新后能从大纲工作台查看未完成原文',async()=>{
   await ev(async()=>{__s.returnToOneKeyConfig();__planningMode='disconnect';await __s.startOneKeyGeneration();__s.novel.outline='已写入正式大纲';__s.showNewBook=false;__s.showOutlineInMain=true;__s.saveData();});await c.delay(2400);
   await c.navigate();await ev(async()=>{__s.showOutlineInMain=true;await Vue.nextTick();const root=document.querySelector('[data-one-key-recovery]');root.open=true;root.querySelector('details').open=true;});
   const d=await ev(()=>({stored:__s.novel.oneKeyRecovery.core.raw,shown:document.querySelector('[data-one-key-recovery] pre').textContent,outline:__s.novel.outline}));assert.equal(d.shown,d.stored);assert.equal(d.outline,'已写入正式大纲');await screenshot('persistent-raw');return{chars:d.stored.length,outline:d.outline};
  });
  assert.deepEqual(c.errors,[]);
 }finally{fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:results.length>0&&results.every(x=>x.ok)&&!c.errors.length,results,errors:c.errors},null,2));}
};
