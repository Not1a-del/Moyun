'use strict';
const assert=require('node:assert/strict');
module.exports=async function(c,check){
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 await check('Token SSE：跨字节分段、累计快照不重复相加、缺失用量不冒充合计',async()=>{
  const d=await c.ev(async()=>{
   const before=fetch, req={ok:true,url:'https://v18.invalid/v1/chat/completions',apiKey:'test-only',model:'sse-test'};
   const controller=new AbortController();__s.beginWritingUsage(controller.signal);
   try{
    window.fetch=async()=>{
     const frames=[{choices:[{delta:{content:'测试'},finish_reason:null}],usage:{prompt_tokens:120,completion_tokens:2,prompt_tokens_details:{cached_tokens:40}}},{choices:[{delta:{content:'分段'},finish_reason:'stop'}],usage:{prompt_tokens:120,completion_tokens:80,prompt_tokens_details:{cached_tokens:40}}}];
     const bytes=new TextEncoder().encode(frames.map(f=>'data: '+JSON.stringify(f)+'\r\n\r\n').join('')+'data: [DONE]\r\n\r\n');
     return new Response(new ReadableStream({start(s){for(let i=0;i<bytes.length;i+=7)s.enqueue(bytes.slice(i,i+7));s.close();}}),{headers:{'content-type':'text/event-stream'}});
    };
    const result=await __s.fetchAdapterCompletion(req,[{role:'user',content:'测试'}],{stream:true,signal:controller.signal});
    const cumulative=JSON.parse(JSON.stringify(__s.lastWritingUsage));
    window.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:'没有用量'},finish_reason:'stop'}]}));
    await __s.fetchAdapterCompletion(req,[{role:'user',content:'测试'}],{stream:false,signal:controller.signal});
    return{result:result.text,cumulative,missing:__s.lastWritingUsage,gemini:__s.extractAiUsage({usageMetadata:{promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:30,totalTokenCount:150}})};
   }finally{window.fetch=before;}
  });
  assert.equal(d.result,'测试分段');assert.equal(d.cumulative.prompt,120);assert.equal(d.cumulative.completion,80);assert.equal(d.cumulative.cached,40);
  for(const field of ['prompt','completion','cached'])assert.equal(d.missing[field],null);assert.equal(d.gemini.completion,50);return d;
 });
 await check('记忆失败与停止：自动不重复重试、手动可补录，停止或换模型后旧结果不写入',async()=>{
  const d=await c.ev(async()=>{
   const before=fetch, original=JSON.parse(JSON.stringify(__s.memoryLibrary)), source=__s.chapters, model=__s.connectionCenter.profiles[0].defaultModel;
   __s.cancelMemoryWork();__s.memoryLibrary=__s.normalizeMemoryLibrary({settings:{enabled:false}});
   __s.chapters=[{id:'memory-retry',branchId:'main',content:'阿雪收到铜钥匙，守门人不知道此事。',title:'重试'}];
   let calls=0;
   try{
    window.fetch=async()=>{calls++;return new Response(JSON.stringify({error:{message:'测试临时失败'}}),{status:503});};
    await __s.runMemoryBackfill();const failed={calls,rows:__s.memoryLibrary.memories.length,error:__s.memoryProgress.error};
    await __s.runMemoryBackfill({automatic:true});const automatic=calls;
    window.fetch=before;await __s.runMemoryBackfill();const retried=__s.memoryLibrary.memories.length;
    __s.memoryLibrary.memories=[];
    window.fetch=async(url,opts)=>{await new Promise(r=>setTimeout(r,100));return before(url,opts);};
    let pending=__s.runMemoryBackfill();await new Promise(r=>setTimeout(r,20));__s.cancelMemoryWork();await pending;const stopped=__s.memoryLibrary.memories.length;
    pending=__s.runMemoryBackfill();await new Promise(r=>setTimeout(r,20));__s.connectionCenter.profiles[0].defaultModel='v18-changed-model';await pending;
    return{failed,automatic,retried,stopped,changed:__s.memoryLibrary.memories.length,busy:__s.memoryProgress.busy};
   }finally{window.fetch=before;__s.cancelMemoryWork();__s.connectionCenter.profiles[0].defaultModel=model;__s.chapters=source;__s.memoryLibrary=original;}
  });
  assert.equal(d.failed.calls,1);assert.equal(d.failed.rows,0);assert.ok(d.failed.error);assert.equal(d.automatic,1);assert.equal(d.retried,1);assert.equal(d.stopped,0);assert.equal(d.changed,0);assert.equal(d.busy,false);return d;
 });
 await check('记忆换向量模型：写作前补建索引，召回不混用旧模型；坏向量可重建',async()=>{
  const d=await c.ev(async()=>{
   __s.cancelMemoryWork();__s.memoryLibrary.settings.enabled=true;__s.memoryLibrary.settings.mode='enhanced';__s.settings.memoryEmbeddingModel='v18-vector-next';
   const first=__s.getValidMemoryRows()[0];if(first)first.vector={data:'broken',dims:10};
   const messages=await __s.appendEnhancedMemoryRecall([{role:'user',content:'铜钥匙'}],__s.visibleChapters,'铜钥匙',new AbortController().signal);
   __s.cancelMemoryWork();return{models:[...new Set(__s.getValidMemoryRows().filter(m=>m.enabled!==false).map(m=>m.vectorModel))],hits:__s.getValidMemoryRows().filter(m=>m.enabled!==false).length,recalled:messages[0].content.includes('enhanced_memory_recall')};
  });assert.equal(d.models.length,1);assert.ok(d.models[0].includes('v18-vector-next'));assert.equal(d.recalled,true);return d;
 });
 await check('字数输入边界：空值、非数字和越界不覆盖原值，固定选项可恢复',async()=>{
  const d=await c.ev(()=>{
   const prior=__s.wordCountTarget, results=[];
   for(const value of ['', 'NaN','299','30001']){__s.editWordCount();__s.customWordCount=value;__s.commitWordCount();results.push({value:__s.wordCountTarget,editing:__s.editingWordCount});}
   __s.editingWordCount=false;const select=document.querySelector('[data-word-count]');select.value='1500';select.dispatchEvent(new Event('change',{bubbles:true}));
   const fixed=__s.wordCountTarget;__s.wordCountTarget=prior;return{prior,results,fixed};
  });assert.ok(d.results.every(r=>r.value===d.prior && r.editing));assert.equal(d.fixed,1500);return d;
 });
 await check('后卷真实写作：携带上一卷交接和本卷边界，自动记忆与自定义字数进入请求',async()=>{
  await c.ev(()=>{__s.cancelMemoryWork();__s.activeBranchId='main';__s.chapters=__s.chapters.slice(0,2);__s.settings.geminiTestInput=true;__s.wordCountTarget=300.5;__s.nextChapterPrompt='V18_VOLUME_NEXT：按约定到东门，核对钥匙归属。';__s.startGeneration();});
  for(let i=0;i<150;i++){if(!await c.ev(()=>__s.isGenerating))break;await delay(80);}await delay(800);
  const d=await c.ev(()=>({count:__s.chapters.length,rows:__s.getValidMemoryRows().length,handoffRows:__s.summaries.filter(item=>item.kind==='volume-handoff').length,wire:__wire.filter(r=>!r.url.includes('embeddings') && JSON.stringify(r.body).includes('V18_VOLUME_NEXT') && !JSON.stringify(r.body).includes('逐章记忆整理器')).at(-1),usage:__s.lastWritingUsage}));
  assert.equal(d.count,3);assert.ok(d.handoffRows>=1);const text=JSON.stringify(d.wire.body);assert.ok(text.includes('上一卷计划'));assert.ok(text.includes('下一卷起笔核对'));assert.ok(text.includes('铜钥匙在阿雪手中'));assert.ok(text.includes('enhanced_memory_recall'));assert.ok(text.includes('300.5字'));assert.ok(d.rows>=3);return{count:d.count,recorded:d.rows,handoffRows:d.handoffRows,usage:d.usage};
 });
 await check('中断续写：旧稿保留，增强记忆与原输入接入，保存后自动记录',async()=>{
  await c.ev(()=>{__s.cancelMemoryWork();__s.settings.geminiTestInput=false;__s.nextChapterPrompt='V18_CONTINUE：阿雪仍持钥匙，等待林舟。';__s.interruptedContent='阿雪握紧铜钥匙，停在东门的树下。她听见脚步声，抬头等待林舟。';__s.isInterrupted=true;__s.interruptedIssue=null;__s.interruptedCanContinue=true;__s.continueGeneration();});
  for(let i=0;i<150;i++){if(!await c.ev(()=>__s.isGenerating))break;await delay(80);}await delay(800);
  const d=await c.ev(()=>({last:__s.chapters.at(-1),wire:__wire.filter(r=>!r.url.includes('embeddings') && JSON.stringify(r.body).includes('V18_CONTINUE') && !JSON.stringify(r.body).includes('逐章记忆整理器')).at(-1),valid:__s.getValidMemoryRows().map(m=>m.chapterId),interrupted:__s.isInterrupted,usage:__s.lastWritingUsage}));
  assert.ok(d.last.memoryUserInput.includes('V18_CONTINUE'));assert.ok(d.last.content.includes('停在东门的树下'));assert.ok(JSON.stringify(d.wire.body).includes('enhanced_memory_recall'));assert.ok(d.valid.includes(d.last.id));assert.equal(d.interrupted,false);assert.equal(d.usage.prompt,240);return{chapterId:d.last.id,recorded:true,volumeHandoffIncluded:true,usage:d.usage};
 });
 await check('书籍导入：记忆随追加章节重映射、重复导入不叠加、全局模型连接不被改号',async()=>{
  const d=await c.ev(async()=>{
   __s.cancelMemoryWork();__s.memoryLibrary.settings.enabled=false;__s.syncBookData();
   const origin=__s.currentBookId, incoming=JSON.parse(JSON.stringify(__s.books.find(b=>b.id===origin)));
   const ch=incoming.chapters[0], oldId=ch.id;ch.id='v18-profile';
   for(const m of incoming.memoryLibrary.memories)if(m.chapterId===oldId)m.chapterId=ch.id;
   incoming.memoryLibrary.settings.classicProfileId='v18-profile';incoming.memoryLibrary.settings.embeddingProfileId='v18-profile';incoming.memoryLibrary.settings.enabled=false;
   async function load(strategy,target){await __s.handleImportJson({target:{value:'',files:[new File([JSON.stringify(incoming)],'记忆.json')]}});__s.transferState.target=target;__s.transferState.strategy=strategy;await __s.executeTransfer();if(__s.transferError)throw Error(__s.transferError);}
   __s.books.push({id:'v18-memory-import',title:'记忆导入目标',novel:{title:'记忆导入目标'},chapters:[],characters:[]});__s.loadBook('v18-memory-import');
   await load('append','current');const first={chapters:__s.chapters.length,rows:__s.getValidMemoryRows().length,settings:JSON.parse(JSON.stringify(__s.memoryLibrary.settings)),ids:__s.chapters.map(ch=>ch.id)};
   const count=__s.memoryLibrary.memories.length;
   const exported=JSON.parse(JSON.stringify(__s.books.find(b=>b.id===__s.currentBookId)));
   await __s.handleImportJson({target:{value:'',files:[new File([JSON.stringify(exported)],'重复.json')]}});__s.transferState.target='current';__s.transferState.strategy='replace';await __s.executeTransfer();
   const second={count:__s.memoryLibrary.memories.length,valid:__s.getValidMemoryRows().length};
   __s.books.push({id:'v18-memory-replace',title:'记忆覆盖目标',novel:{title:'记忆覆盖目标'},chapters:[],characters:[]});__s.loadBook('v18-memory-replace');
   await load('replace','current');const replaced={classic:__s.memoryLibrary.settings.classicProfileId,embedding:__s.settings.memoryEmbeddingModel,valid:__s.getValidMemoryRows().length,ids:__s.chapters.map(ch=>ch.id)};
   await load('replace','new');const created={classic:__s.memoryLibrary.settings.classicProfileId,embedding:__s.settings.memoryEmbeddingModel,valid:__s.getValidMemoryRows().length,ids:__s.chapters.map(ch=>ch.id)};
   __s.loadBook(origin);return{first,count,second,replaced,created,expected:incoming.chapters.length};
  });assert.equal(d.first.chapters,d.expected);assert.equal(d.first.rows,d.expected);assert.ok(!d.first.ids.includes('v18-profile'));assert.equal(d.first.settings.classicProfileId,'');assert.equal(d.second.count,d.count);assert.equal(d.second.valid,d.first.rows);
  for(const imported of [d.replaced,d.created]){assert.equal(imported.classic,'v18-profile');assert.equal(imported.embedding,'v18-vector-next');assert.equal(imported.valid,d.expected);assert.ok(imported.ids.includes('v18-profile'));}return d;
 });
};
