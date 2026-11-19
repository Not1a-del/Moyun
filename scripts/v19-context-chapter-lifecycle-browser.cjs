'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
// 仅隔离验收记录同步调用栈；不在产品中加入监控或强行锁定用户的章数。
module.exports=async function(c,{expectReset=false}={}){
 const out=path.join(__dirname,'../.ui-check/context-chapter-settings');fs.mkdirSync(out,{recursive:true});const results=[];let passed=false;
 async function check(name,run){const data=await run();results.push({name,ok:true,data});console.log('PASS',name,JSON.stringify({...data,trace:data.trace?.map(({from,to,phase,elapsedMs})=>({from,to,phase,elapsedMs}))}));return data;}
 async function state(phase){return c.ev(async phase=>{window.__chapterPhase=phase;const raw=await DB.get('library_v6'),d=typeof raw==='string'?JSON.parse(raw):raw;return{phase,elapsedMs:Math.round(performance.now()-__chapterTraceStart),value:__s.settings.contextFullChapters,input:document.querySelector('#settings-search-full-chapters input')?.value,stored:d?.settings?.contextFullChapters,compact:__s.settings.contextCompactMode,requests:__lifecycleRequests.length,trace:__chapterTrace.slice()};},phase);}
 async function stable(phase){const d=await state(phase);assert.equal(d.value,5,phase);assert.equal(d.stored,5,phase+' DB');assert.ok(!d.trace.some(row=>row.from===5&&row.to!==5),phase+' 不应回写');return d;}
 async function typeFive(){await c.ev(()=>{window.__chapterPhase='真实输入5';__s.showSettings_modal=true;__s.activeSettingsTab='context';});await c.delay(150);await c.ev(()=>{const el=document.querySelector('#settings-search-full-chapters input');el.scrollIntoView({block:'center',behavior:'instant'});el.focus();el.select();});await c.send('Input.insertText',{text:'5'});await c.ev(()=>document.activeElement.blur());await c.delay(2600);}
 async function setup(compact){await c.ev(compact=>{
  const s=__s,chapters=Array.from({length:12},(_,i)=>({id:'lifecycle-main-'+i,branchId:'main',title:'旧信'+(i+1),content:'正文哨兵['+(i+1)+']'+'文'.repeat(800),summary:'摘要哨兵['+(i+1)+']'}));window.__lifecycleBookId='lifecycle-'+Date.now();
  s.books.push({id:__lifecycleBookId,novel:{title:'运行态章数验收',outline:'只核对旧信'},chapters:chapters.concat(chapters.map(ch=>({...ch,id:ch.id+'-branch',branchId:'lifecycle-branch'}))),characters:[],branchList:[{id:'main',name:'主线',createdAt:1},{id:'lifecycle-branch',name:'隔离支线',parentId:'main',createdAt:2,forkIndex:2}],chapterOutlines:[]},{id:__lifecycleBookId+'-other',novel:{title:'切书验收'},chapters:[],characters:[]});s.loadBook(__lifecycleBookId);
  Object.assign(s.settings,{contextFullChapters:2,contextCompactMode:compact,contextUseFullText:true,contextHistoryCharLimit:60000,contextMaxFullChapterChars:5000,streamEnabled:true,secondRoundSupplementEnabled:false,thirdRoundSupplementEnabled:false,enableReviewer:false,enableThinking:false,commentInline:false,autoTimelineSupplement:false});s.memoryLibrary.settings.enabled=false;s.memoryLibrary.settings.autoSummarize=false;s.memoryLibrary.settings.replaceHistoryWithSummaries=false;s.priorityEnabled=false;s.nsfwSettings.enabled=false;s.wordCountTarget=600;s.generateCount=1;
  const p=s.createConnectionProfile({name:'运行态隔离请求',templateId:'openai-compatible',baseUrl:'https://chapter-lifecycle.invalid/v1',defaultModel:'gemini-local',apiKey:'test-only',lastTest:{status:'ok'}});if(!p.ok)throw Error(p.reason);s.connectionCenter.defaultProfileId=p.profile.id;s.connectionCenter.moduleRoutes={};
  window.__lifecycleRequests=[];window.__lifecycleResponse='success';window.fetch=async(input,init={})=>{
   if(!String(input?.url||input).startsWith('https://chapter-lifecycle.invalid/'))throw Error('隔离验收禁止外发');const body=JSON.parse(init.body);__lifecycleRequests.push(body);if(__lifecycleResponse==='error')return new Response('local failure',{status:400});
   const tool=!!body.tools?.length,content='灯下核信'+String.fromCharCode(10)+'守灯人核对旧信日期。'.repeat(100)+String.fromCharCode(10)+'---剧情摘要---'+String.fromCharCode(10)+'信中日期与前文一致。';
   const delta=tool?{tool_calls:[{index:0,id:'call',type:'function',function:{name:'output_reply',arguments:JSON.stringify({content})}}]}:{content};
   if(__lifecycleResponse==='stop')return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify({choices:[{delta:{content:'已经收到的中断草稿。'.repeat(30)},finish_reason:null}]})+'\n\n'));init.signal?.addEventListener('abort',()=>controller.error(new DOMException('Aborted','AbortError')),{once:true});}}),{headers:{'content-type':'text/event-stream'}});
   return new Response('data: '+JSON.stringify({choices:[{delta,finish_reason:tool?'tool_calls':'stop'}]})+'\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
  window.__chapterTrace=[];window.__chapterTraceStart=performance.now();window.__chapterPhase='初始化';Error.stackTraceLimit=40;window.__stopChapterTrace=Vue.watch(()=>s.settings.contextFullChapters,(to,from)=>__chapterTrace.push({from,to,phase:__chapterPhase,elapsedMs:Math.round(performance.now()-__chapterTraceStart),stack:new Error().stack}),{flush:'sync'});s.showNewBook=false;s.showSettings_modal=true;s.activeSettingsTab='context';
 },compact);await c.delay(250);}
 async function generate(enabled,response='success'){
  await c.ev(({enabled,response})=>{const s=__s;window.__chapterPhase='正文请求 '+response+' Gemini='+enabled;window.__lifecycleResponse=response;s.settings.geminiTestInput=enabled;s.settings.preventTruncation=enabled;s.showSettings_modal=false;s.nextChapterPrompt='按本章核对旧信';window.__lifecycleBefore=s.chapters.map(ch=>ch.id);window.__lifecycleRun=s.startGeneration({count:1});},{enabled,response});
  if(response==='stop'){for(let i=0;i<100;i++){if(await c.ev(()=>__s.isGenerating&&__s.streamContent))break;await c.delay(30);}assert.ok(await c.ev(()=>__s.streamContent),'收到部分文字后再停止');await c.ev(()=>__s.startGeneration());}
  for(let i=0;i<250;i++){if(await c.ev(()=>!__s.isGenerating))break;await c.delay(40);}assert.equal(await c.ev(()=>__s.isGenerating),false);
  const data=await c.ev(()=>{const s=__s,body=__lifecycleRequests.at(-1),text=(body?.messages||[]).find(m=>String(m.content).startsWith('【前文剧情'))?.content||'';const data={requests:__lifecycleRequests.length,tools:!!body?.tools?.length,added:s.chapters.filter(ch=>!__lifecycleBefore.includes(ch.id)).length,preserved:String(s.interruptedContent||'').length,history:Array.from({length:12},(_,i)=>i+1).filter(n=>text.includes('正文哨兵['+n+']'))};s.chapters=s.chapters.filter(ch=>__lifecycleBefore.includes(ch.id));s.interruptedContent='';s.isInterrupted=false;return data;});await c.delay(2600);return data;
 }
 try{
  for(const width of expectReset?[360]:[1280,360])for(const compact of expectReset?[true]:[false,true]){
   if(results.length){await c.ev(()=>window.__stopChapterTrace?.());await c.navigate();}
   await c.send('Emulation.setDeviceMetricsOverride',{width,height:width===1280?800:740,deviceScaleFactor:1,mobile:width<768});await c.send('Emulation.setTouchEmulationEnabled',{enabled:width<768});await setup(compact);await typeFive();
   await check(width+' compact='+compact+' 已输入5并保存',()=>stable('输入后'));
   await c.delay(10000);await check(width+' compact='+compact+' 空闲10秒、未刷新仍为5',()=>stable('空闲10秒'));
   if(expectReset){
    await c.ev(()=>{window.__chapterPhase='关闭设置再打开';__s.showSettings_modal=false;});await c.delay(2600);await c.ev(()=>{__s.showSettings_modal=true;__s.activeSettingsTab='context';});await check('旧页面关闭设置再打开仍为5',()=>stable('设置重开'));
    const generated=await generate(false);await c.ev(()=>{__s.showSettings_modal=true;__s.activeSettingsTab='context';});await c.delay(250);
    await check('旧页面下一次生成将5改成2并持久保存（不刷新）',async()=>{const d=await state('旧版生成完成');assert.equal(d.value,2);assert.equal(d.input,'2');assert.equal(d.stored,2);const trace=d.trace.find(row=>row.from===5&&row.to===2);assert.ok(trace);assert.match(trace.stack,/normalizeContextSettings/);assert.match(trace.stack,/buildChapterMessages/);assert.equal(generated.added,1);return{...d,generated};});
    const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'lifecycle-before-reset.png'),Buffer.from(shot.data,'base64'));break;
   }
   await c.ev(async()=>{window.__chapterPhase='连续排队保存';await Promise.all(Array.from({length:4},()=>__s.saveDataNow('运行态验收')));__s.loadBook(__lifecycleBookId+'-other');__s.loadBook(__lifecycleBookId);__s.switchBranch('lifecycle-branch');});await c.delay(2600);await check(width+' compact='+compact+' 连续保存、切书、切支线',async()=>{assert.equal(await c.ev(()=>__s.activeBranchId),'lifecycle-branch');return stable('切书切支线后');});
   await c.ev(()=>{window.__chapterPhase='请求预览';__s.openPromptPreview();__s.showPromptPreview=false;});await c.delay(2600);await check(width+' compact='+compact+' 预览不回写章数',()=>stable('预览后'));
   for(const enabled of [false,true]){const data=await generate(enabled);await check(width+' compact='+compact+' 正文生成 Gemini双开关='+enabled,async()=>{assert.equal(data.tools,enabled);assert.equal(data.added,1);assert.equal(data.history.length,compact?2:5);return{...await stable('正文生成后'),generated:data};});}
   for(const response of ['error','stop']){const data=await generate(false,response);await check(width+' compact='+compact+' '+response+' 后保留5',async()=>{assert.equal(data.added,0);if(response==='stop')assert.ok(data.preserved>0);return{...await stable(response+' 后'),generated:data};});}
   await c.ev(()=>{window.__chapterPhase='关闭省token';__s.settings.contextCompactMode=false;__s.openPromptPreview();__s.showPromptPreview=false;__s.showSettings_modal=true;__s.activeSettingsTab='context';});await c.delay(2600);await check(width+' compact='+compact+' 设置重开、关闭省token仍保留5',()=>stable('设置重开后'));
   await c.ev(()=>window.__stopChapterTrace?.());await c.navigate();await c.ev(()=>{__s.showNewBook=false;__s.showSettings_modal=true;__s.activeSettingsTab='context';});await c.delay(250);
   await check(width+' compact='+compact+' 最后刷新仍为5',async()=>{const data=await c.ev(()=>({value:__s.settings.contextFullChapters,input:document.querySelector('#settings-search-full-chapters input')?.value}));assert.equal(data.value,5);assert.equal(data.input,'5');return data;});
  }
  assert.deepEqual(c.errors,[]);passed=true;
 }finally{await c.ev(()=>window.__stopChapterTrace?.()).catch(()=>{});fs.writeFileSync(path.join(out,expectReset?'lifecycle-before.json':'lifecycle-current.json'),JSON.stringify({passed,expectReset,results,errors:c.errors},null,2)+'\n');}
};
