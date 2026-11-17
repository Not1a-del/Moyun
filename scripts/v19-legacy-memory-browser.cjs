'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {makeBook}=require('./v19-legacy-memory-fixture.cjs');
// --backup 只在本地隔离页选择文件；证据只保存计数，不保存书稿、请求正文或截图。
module.exports=async function(c,{backup=''}={}){
 const out=path.join(__dirname,'../.ui-check/legacy-memory',backup?'real':'synthetic');fs.mkdirSync(out,{recursive:true});
 const results=[];let completed=false;
 async function check(name,run){try{const data=await run();results.push({name,ok:true,data});console.log('PASS',name,JSON.stringify(data));}catch(e){results.push({name,ok:false,error:String(e)});throw e;}}
 const inspect=()=>c.ev(()=>{const s=__s,rows=s.getValidMemoryRows(),groups=s.validMemoryGroups(rows),history=s.buildMemoryHistory(s.visibleChapters),stored=s.books.find(b=>b.id===s.currentBookId);return{chapterCount:s.visibleChapters.length,proseChars:s.visibleChapters.reduce((n,ch)=>n+String(ch.content||'').length,0),memories:s.memoryLibrary.memories.length,validMemories:rows.length,groups:groups.length,groupsSent:groups.filter(g=>history.text.includes(g.text)).length,historyChars:history.text.length,missingChapters:history.missingChapters,details:s.chapterOutlines.length,summaries:s.summaries.length,volumes:s.novel.volumes.length,modDataBytes:JSON.stringify(s.modPrivateData).length,regenSnapshots:s.chapters.filter(ch=>ch.regenSnapshot).length,storedMemories:stored?.memoryLibrary?.memories?.length};});
 try{
  await c.ev(()=>{const s=__s;s.dismissWebUpdateAnnouncement();s.showSettings_modal=false;window.__memoryRequests=[];window.fetch=async(input,init={})=>{const url=String(input?.url||input);if(!url.startsWith('https://memory-recovery.invalid/'))throw Error('隔离验收阻止外发请求');const body=JSON.parse(init.body||'{}');__memoryRequests.push(body);const text='本地验收章\n\n'+'守夜人整理手中的书信，逐一核对日期，收好文件后继续等待。'.repeat(26)+'\n---剧情摘要---\n'+'守夜人完成文件整理，保留书信并核对日期，没有发生其他关键事件。'.repeat(2),args=JSON.stringify({content:text});if(url.endsWith('/embeddings'))throw Error('隔离测试模拟向量接口不可用');if(!body.stream)return new Response(JSON.stringify({choices:[{message:body.tools?{role:'assistant',tool_calls:[{id:'reply',type:'function',function:{name:'output_reply',arguments:args}}]}:{role:'assistant',content:text},finish_reason:body.tools?'tool_calls':'stop'}]}),{headers:{'content-type':'application/json'}});const chunks=body.tools?[{tool_calls:[{index:0,id:'reply',type:'function',function:{name:'output_reply',arguments:args}}]}]:[{content:text.slice(0,50)},{content:text.slice(50)}];return new Response(chunks.map((delta,i)=>'data: '+JSON.stringify({choices:[{delta,finish_reason:i===chunks.length-1?(body.tools?'tool_calls':'stop'):null}]})+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});};});
  const started=Date.now();
  if(backup){
   assert.ok(fs.existsSync(backup),'备份路径不存在');
   await c.ev(()=>{document.querySelector('#app').__vue_app__._instance.proxy.$refs.importJsonInput.setAttribute('data-isolated-book-input','');});
   const root=await c.send('DOM.getDocument'),node=await c.send('DOM.querySelector',{nodeId:root.root.nodeId,selector:'[data-isolated-book-input]'});
   await c.send('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[path.resolve(backup)]});
   for(let i=0;i<100;i++){const s=await c.ev(()=>({ready:!!__s.transferState,error:__s.importJsonError}));if(s.error)throw Error('备份识别失败：'+s.error);if(s.ready)break;await c.delay(100);}
  }else{const b=makeBook();await c.ev(async b=>{await __s.handleImportJson({target:{value:'selected',files:[new File([JSON.stringify(b)],'million-book.json',{type:'application/json'})]}});},b);}
  await check('原生导入选择页：默认新建、未发AI请求',async()=>{const d=await c.ev(()=>({kind:__s.transferState?.kind,target:__s.transferState?.target,rows:__s.transferState?.rows.length,requests:__memoryRequests.length}));assert.equal(d.kind,'book');assert.equal(d.target,'new');assert.equal(d.requests,0);return{...d,readMs:Date.now()-started,bytes:backup?fs.statSync(backup).size:undefined};});
  await check('确认导入并由原有保存流程写入IndexedDB',async()=>{
   await c.ev(()=>{window.__importFinished=false;__s.executeTransfer().then(()=>{window.__importFinished=true;});});
   for(let i=0;i<240;i++){const d=await c.ev(()=>({done:__importFinished,error:__s.transferError}));if(d.error)throw Error(d.error);if(d.done)break;await c.delay(150);}
   const d=await inspect(),persisted=await c.ev(async()=>{const raw=await DB.get('library_v6'),lib=typeof raw==='string'?JSON.parse(raw):raw,b=lib.books.find(b=>b.id===__s.currentBookId);return{chapters:b.chapters.length,memories:b.memoryLibrary.memories.length,groups:b.memoryLibrary.groups.length,regenSnapshots:b.chapters.filter(ch=>ch.regenSnapshot).length};});
   assert.equal(d.chapterCount,backup?311:320);assert.equal(d.validMemories,d.chapterCount);assert.equal(d.memories,backup?516:320);assert.equal(d.groups,backup?57:59);assert.equal(d.regenSnapshots,backup?167:0);assert.equal(d.volumes,backup?4:0);assert.equal(d.groupsSent,d.groups);assert.equal(persisted.memories,d.memories);assert.equal(persisted.regenSnapshots,d.regenSnapshots);assert.equal(d.details,backup?510:1);assert.equal(d.summaries,backup?32:0);return{...d,persisted,importAndSaveMs:Date.now()-started};
  });
  const imported=await inspect();
  const installMock=await c.ev(()=>window.fetch.toString());
  await c.navigate();
  // 刷新后重新安装只允许本地假服务的发送拦截，绝不把用户文字发到外网。
  await c.ev(code=>{window.__memoryRequests=[];window.fetch=(0,eval)('('+code+')');__s.cancelMemoryWork();},installMock);
  await check('刷新后正文、细纲、总结、有效记忆与合并组完整恢复',async()=>{const d=await inspect();for(const k of ['chapterCount','proseChars','memories','validMemories','groups','groupsSent','details','summaries','regenSnapshots'])assert.equal(d[k],imported[k],k);return d;});
  await c.ev(()=>{const s=__s;window.__archiveChapterIds=s.chapters.map(ch=>ch.id);const made=s.createConnectionProfile({name:'本地隔离记忆验收',templateId:'openai-compatible',baseUrl:'https://memory-recovery.invalid/v1',defaultModel:'gemini-memory-test',apiKey:'local-test-only',lastTest:{status:'ok'}});if(!made.ok)throw Error(made.reason);s.connectionCenter.defaultProfileId=made.profile.id;s.settings.memoryEmbeddingModel='local-embedding';s.settings.streamEnabled=true;s.settings.secondRoundSupplementEnabled=false;s.settings.thirdRoundSupplementEnabled=false;s.settings.autoTimelineSupplement=false;s.settings.commentInline=false;s.settings.enableReviewer=false;s.settings.enableThinking=false;s.nsfwSettings.enabled=false;s.priorityEnabled=false;s.wordCountTarget=600;s.generateCount=1;});
  for(const enabled of [false,true]){
   await check('实际写作请求：Gemini双开关'+enabled+'，向量失败回退仍保留全部合并记忆',async()=>{const d=await c.ev(async enabled=>{const s=__s;s.showRealContextModal=false;s.settings.geminiTestInput=enabled;s.settings.preventTruncation=enabled;s.cancelMemoryWork();const start=__memoryRequests.length,before=s.visibleChapters.length,groups=s.validMemoryGroups(s.getValidMemoryRows());s.nextChapterPrompt='只续写本章';await s.startGeneration({count:1});for(let i=0;i<180&&s.isGenerating;i++)await new Promise(r=>setTimeout(r,50));s.cancelMemoryWork();const calls=__memoryRequests.slice(start),writing=calls.filter(b=>Array.isArray(b.messages)),raw=writing.map(b=>b.messages.map(m=>typeof m.content==='string'?m.content:JSON.stringify(m.content)).join('\n')).join('\n');return{before,after:s.visibleChapters.length,writingRequests:writing.length,embeddingRequests:calls.length-writing.length,groupCount:groups.length,groupsSent:groups.filter(g=>raw.includes(g.text)).length,bodyChars:raw.length,tools:!!writing[0]?.tools,stillGenerating:s.isGenerating,toast:s.toast?.message};},enabled);assert.equal(d.stillGenerating,false);assert.equal(d.writingRequests,1,JSON.stringify(d));assert.equal(d.groupsSent,d.groupCount);assert.equal(d.after,d.before+1,JSON.stringify(d));assert.equal(d.tools,enabled);return d;});
  }
  for(const width of [1280,360])for(const dark of [false,true]){await c.send('Emulation.setDeviceMetricsOverride',{width,height:width===1280?800:740,deviceScaleFactor:1,mobile:width<768});
   await check(width+' '+(dark?'深色':'浅色')+' 真实上下文窗口显示与脱敏计数',async()=>{const d=await c.ev(async({dark})=>{const s=__s;if(s.isDark!==dark)s.toggleTheme();s.openRealContextSafeView();await Vue.nextTick();const h=s.buildMemoryHistory(s.visibleChapters),groups=s.validMemoryGroups(s.getValidMemoryRows()),m=document.querySelector('[data-moyun-modal=real-context]'),r=m?.getBoundingClientRect();return{actualChars:s.safeChapterContextMeta?.totalChars,historyChars:h.text.length,groupCount:groups.length,groupsSent:groups.filter(g=>h.text.includes(g.text)).length,overflow:document.documentElement.scrollWidth>innerWidth+1,preview:!!s.showRealContextModal,modalWidth:r?.width,modalHeight:r?.height};},{dark});assert.equal(d.groupsSent,d.groupCount);assert.ok(d.actualChars>=d.historyChars);assert.equal(d.preview,true);assert.equal(d.overflow,false);return d;});
  }
  await check('全量导出再导入：正文、全部记忆、规划和生成快照逐项一致',async()=>{
   const d=await c.ev(async()=>{const s=__s;s.showRealContextModal=false;s.cancelMemoryWork();const ids=new Set(__archiveChapterIds);s.chapters=s.chapters.filter(ch=>ids.has(ch.id));
    const fingerprint=()=>({chapters:s.memoryTextHash(JSON.stringify(s.chapters.map(ch=>({id:ch.id,branchId:ch.branchId,title:ch.title,content:ch.content,summary:ch.summary,regenSnapshot:ch.regenSnapshot,versions:ch.versions,nativeThinking:ch.nativeThinking,memoryUserInput:ch.memoryUserInput})))),memories:s.memoryTextHash(JSON.stringify(s.memoryLibrary)),details:s.memoryTextHash(JSON.stringify(s.chapterOutlines)),summaries:s.memoryTextHash(JSON.stringify(s.summaries)),volumes:s.memoryTextHash(JSON.stringify(s.novel.volumes)),modData:s.memoryTextHash(JSON.stringify(s.modPrivateData))});
    const before=fingerprint(),originalCreate=URL.createObjectURL,originalClick=HTMLAnchorElement.prototype.click;let blob;URL.createObjectURL=function(value){blob=value;return originalCreate.call(URL,value);};HTMLAnchorElement.prototype.click=function(){};
    try{s.exportBookJson();for(let i=0;i<100&&!s.showConfirm;i++)await new Promise(r=>setTimeout(r,20));await s.execConfirmChoice('backup');}finally{URL.createObjectURL=originalCreate;HTMLAnchorElement.prototype.click=originalClick;}if(!blob)throw Error('未生成全量备份');
    s.books=[{id:'isolated-empty',novel:{title:'隔离空书'},chapters:[],characters:[]}];s.loadBook('isolated-empty');await s.handleImportJson({target:{value:'file',files:[new File([blob],'restored-full-book.json',{type:'application/json'})]}});await s.executeTransfer();s.cancelMemoryWork();if(s.transferError)throw Error(s.transferError);return{bytes:blob.size,before,after:fingerprint(),chapters:s.chapters.length,validMemories:s.getValidMemoryRows().length,memories:s.memoryLibrary.memories.length,groups:s.validMemoryGroups(s.getValidMemoryRows()).length};
   });assert.deepEqual(d.after,d.before);assert.equal(d.chapters,imported.chapterCount);assert.equal(d.memories,imported.memories);return d;
  });
  if(!backup)for(const kind of ['v6-current-mirror','v6-single','v5']){
   await check(kind+'启动迁移：顶层资料仅恢复当前书，首次切书和刷新不丢失',async()=>{
    const b=makeBook(40);b.summaries=[{id:'old-summary',startChapter:1,endChapter:5,content:'旧长期总结哨兵',useForContext:true}];
    await c.ev(()=>{__s.cancelMemoryWork();__s.saveData();});await c.delay(3000);
    await c.ev(async({b,kind})=>{
     const data={...b,version:kind==='v5'?5:6,currentBookId:b.id,revision:1};if(kind!=='v6-single')data.books=[{id:b.id,novel:b.novel,chapters:b.chapters,characters:[]},{id:'startup-other',novel:{title:'另一书'},chapters:[],characters:[]}];
     // 只在隔离页阻止旧页面的关页保存，避免测试种子被当前运行态覆盖。
     window.addEventListener('beforeunload',event=>event.stopImmediatePropagation(),{capture:true,once:true});
     for(const key of Object.keys(localStorage))if(key.startsWith('_nw6_emergency_backup'))localStorage.removeItem(key);
     await DB.set('library_v6_revision','1');await DB.set('library_v6',kind==='v5'?null:JSON.stringify(data));await DB.set('library_v5',kind==='v5'?JSON.stringify(data):null);
    },{b,kind});
    await c.navigate();await c.ev(()=>__s.cancelMemoryWork());
    const loaded=await inspect();assert.equal(loaded.chapterCount,40);assert.equal(loaded.validMemories,40);assert.equal(loaded.details,1);assert.equal(loaded.summaries,1);assert.equal(loaded.modDataBytes,JSON.stringify(b.modPrivateData).length);
    const switched=await c.ev(async()=>{const s=__s,id=s.currentBookId;if(!s.books.some(b=>b.id==='startup-other'))s.books.push({id:'startup-other',novel:{title:'另一书'},chapters:[],characters:[]});s.switchBook('startup-other');await Vue.nextTick();const otherMemories=s.memoryLibrary.memories.length;s.switchBook(id);s.cancelMemoryWork();s.saveData();return{otherMemories,memories:s.getValidMemoryRows().length,details:s.chapterOutlines.length,summaries:s.summaries.length};});
    assert.deepEqual(switched,{otherMemories:0,memories:40,details:1,summaries:1});await c.delay(3000);await c.navigate();await c.ev(()=>__s.cancelMemoryWork());const reloaded=await inspect();assert.equal(reloaded.validMemories,40);assert.equal(reloaded.details,1);assert.equal(reloaded.summaries,1);return{loaded,switched,reloaded};
   });
  }
  assert.deepEqual(c.errors,[]);completed=true;
 }finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:completed,results,errors:c.errors},null,2));}
};
