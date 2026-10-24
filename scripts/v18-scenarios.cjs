'use strict';
const assert=require('node:assert/strict');
module.exports=async function(c,check,shot){
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 await c.send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
 await c.ev(()=>{
  __s.mobileSidebarOpen=false;__s.currentTab='outline';__s.showSettings_modal=false;__s.showStoryBibleWorkbench=false;
  window.__wire=[];window.__nativeFetch=window.fetch;
  window.fetch=async(url,opts={})=>{
   if(!String(url).includes('v18.invalid'))return __nativeFetch(url,opts);
   const body=JSON.parse(opts.body || '{}');__wire.push({url:String(url),body});
   if(opts.signal?.aborted)throw new DOMException('停止','AbortError');
   if(String(url).includes('/embeddings') || String(url).includes(':batchEmbedContents')){
    const inputs=body.input || body.requests.map(r=>r.content.parts[0].text);
    return new Response(JSON.stringify(body.requests ? {embeddings:inputs.map(()=>({values:[1,0.2,0.1]}))} : {data:inputs.map((_,index)=>({index,embedding:[1,0.2,0.1]}))}),{headers:{'content-type':'application/json'}});
   }
   const text=JSON.stringify(body);
   let output='接口测试正文';
   const no=Number((text.match(/唯一总结目标｜第 (\d+) 章/) || [])[1]);
   if(no)output='记忆'+no+'：林舟在旧仓库将铜钥匙交给阿雪，约定次日到东门，守门人尚不知情。';
   else if(text.includes('长期记忆压缩器'))output='合并记忆：林舟将铜钥匙交给阿雪，双方约定次日东门见面，守门人仍不知情；需继续核对钥匙归属与承诺。';
   else if(text.includes('你是专业网文策划。'))output='【卷纲更新】\n第1卷｜卷名：归来｜章节 1-2｜框架摘要：归还铜钥匙\n承接上一卷：'+('开局条件已经核对。'.repeat(100))+'\n本卷推进与收束：'+('阿雪接收钥匙，东门之约尚待履行。'.repeat(100))+'\n下一卷起笔核对：次日东门相见，守门人仍不知情。\n第1章：归还钥匙\n第2章：约定见面\n第2卷｜卷名：赴约｜章节 3-4｜框架摘要：承接东门之约\n承接上一卷：铜钥匙在阿雪手中，双方约定次日东门见面。\n本卷推进与收束：核对约定执行与人物状态。\n下一卷起笔核对：只交接已发生事实。\n第3章：东门会面\n第4章：核对承诺\n## 核心卖点\n铜钥匙与秘密知情边界。';
   else if(text.includes('剧情摘要'))output='东门赴约\n'+('阿雪握住铜钥匙，在东门等候林舟。她确认约定的时辰，听见远处脚步声，抬头看向来路。'.repeat(12))+'\n---剧情摘要---\n阿雪携带林舟交给她的铜钥匙，按约定到东门等候。她核对时辰并留意来路，听到脚步声后抬头观察。钥匙仍归阿雪保管，双方的约定仍待落实，守门人并不知道这件事。';
   if(body.contents)return new Response(JSON.stringify({candidates:[{content:{parts:[{text:output}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:120,candidatesTokenCount:80,cachedContentTokenCount:40}}));
   if(body.max_tokens && opts.headers?.['x-api-key'])return new Response(JSON.stringify({content:[{type:'text',text:output}],stop_reason:'end_turn',usage:{input_tokens:80,output_tokens:80,cache_read_input_tokens:40}}));
   return new Response(JSON.stringify({choices:[{message:{content:output},finish_reason:'stop'}],usage:{prompt_tokens:120,completion_tokens:80,total_tokens:200,prompt_tokens_details:{cached_tokens:40}}}),{headers:{'content-type':'application/json'}});
  };
  __s.connectionCenter.profiles=[{id:'v18-profile',name:'V18隔离测试',templateId:'custom',adapterId:'openai-compatible',baseUrl:'https://v18.invalid/v1',defaultModel:'v18-summary',enabled:true,lastTest:{status:'ok'},modelCatalog:[]}];
  __s.connectionCenter.defaultProfileId='v18-profile';__s.connectionCenter.moduleRoutes={};__s.setConnectionCredential('v18-profile','test-only');
  __s.settings.geminiTestInput=false;__s.settings.streamEnabled=false;__s.settings.showTokenUsage=true;__s.settings.secondRoundSupplementEnabled=false;
 });
 await check('真实请求：旧预设作用模块开启才注入',async()=>{
  await c.ev(async()=>{const p=__s.presets[0];p.content='V18_LEGACY_SCOPE';p.enabled=true;p.applyTo=['outline'];__s.novel.volumes=[{id:'vol1',title:'一',startChapter:1,endChapter:2,summary:''},{id:'vol2',title:'二',startChapter:3,endChapter:4,summary:''}];__s.novel.outline='';await __s.generateOutline();});
  const first=await c.ev(()=>__wire.find(r=>JSON.stringify(r.body).includes('V18_LEGACY_SCOPE')));assert.ok(first,'大纲实际请求应携带旧预设');
  await c.ev(async()=>{__wire=[];__s.presets[0].enabled=false;__s.novel.outline='';await __s.generateOutline();});
  assert.equal(await c.ev(()=>__wire.some(r=>JSON.stringify(r.body).includes('V18_LEGACY_SCOPE'))),false);
  return {enabledInjected:true,disabledExcluded:true};
 });
 await check('卷纲：三段衔接完整保存，超过2000字不截断',async()=>{
  const d=await c.ev(()=>({volumes:__s.novel.volumes.map(v=>({title:v.title,summary:v.summary}))}));
  assert.ok(d.volumes[0].summary.length>2000);for(const name of ['承接上一卷','本卷推进与收束','下一卷起笔核对'])assert.ok(d.volumes[0].summary.includes(name));
  return {length:d.volumes[0].summary.length,second:d.volumes[1].summary.includes('铜钥匙在阿雪手中')};
 });
 await check('Gemini测试输入仅作用于Gemini模型与原生协议，并只搬移本轮作者要求',async()=>{
  const d=await c.ev(async()=>{
   const req={ok:true,url:'https://v18.invalid/v1/chat/completions',apiKey:'test-only',model:'ordinary-model'}, messages=[{role:'system',content:'系统'},{role:'assistant',content:'历史回复'},{role:'user',content:'V18_USER_INPUT',_moyunUserInput:true},{role:'user',content:'JSON输出要求'}];
   const results=[];__s.settings.geminiTestInput=true;
   for(const adapterId of ['openai-compatible','anthropic-messages','gemini-generate']){
    const model=adapterId==='gemini-generate'?'gemini-3-test':'ordinary-model';
    const init=__s.buildAdapterRequest({...req,adapterId,model},messages,{stream:false});
    await __s.fetchAdapterCompletion({...req,adapterId,model},messages,{stream:false});
    results.push({adapterId,body:__wire.at(-1).body,canonical:init.wireMessages,planned:init.sentMessages});
   }
   const geminiReq={...req,adapterId:'gemini-generate',model:'gemini-3-test'};
   await __s.fetchAdapterCompletion(geminiReq,messages,{stream:false});const a=__wire.at(-1).body.contents;
   await __s.fetchAdapterCompletion(geminiReq,messages,{stream:false});const b=__wire.at(-1).body.contents;
   __s.settings.geminiTestInput=false;await __s.fetchAdapterCompletion({...req,model:'gemini-3-test'},messages,{stream:false});
   return{results,a,b,off:__wire.at(-1).body,geminiOff:__s.buildAdapterRequest({...req,adapterId:'gemini-generate',model:'gemini-3-test'},messages,{stream:false}).body,messages};
  });
  assert.equal(JSON.stringify(d.results[0].body).includes('read_user_input'),false);assert.equal(JSON.stringify(d.results[1].body).includes('read_user_input'),false);
  assert.ok(JSON.stringify(d.results[2].body).includes('read_user_input'));assert.ok(JSON.stringify(d.results[2].body).includes('V18_USER_INPUT'));
  for(const r of d.results)assert.equal(r.canonical.some(m=>m.role==='tool'),false);
  const aInput=d.a.find(m=>m.role==='user' && m.parts?.[0]?.text?.includes('读取 read_user_input')),bInput=d.b.find(m=>m.role==='user' && m.parts?.[0]?.text?.includes('读取 read_user_input'));
  assert.ok(aInput && bInput);assert.equal(aInput.parts[0].text,bInput.parts[0].text);assert.equal(aInput.parts[0].text,'读取 read_user_input 的返回内容，作为本轮用户输入继续回复。');
  assert.equal(d.results[0].planned.some(m=>m.role==='tool'),false);assert.equal(d.results[1].planned.some(m=>m.role==='tool'),false);assert.equal(d.off.messages.some(m=>m.role==='tool'),false);assert.equal(d.geminiOff.tools,undefined);assert.equal(d.messages[2].content,'V18_USER_INPUT');
  return {adapters:d.results.map(r=>r.adapterId),geminiOnly:true,randomPrefix:false,manualOnly:true};
 });
 await check('Token真实用量：三种接口、0与缺失、多请求合计',async()=>{
  const d=await c.ev(async()=>{
   const samples=[{usage:{prompt_tokens:0,completion_tokens:0,prompt_tokens_details:{cached_tokens:0}}},{usage:{input_tokens:80,cache_read_input_tokens:30,cache_creation_input_tokens:10}},{usageMetadata:{promptTokenCount:200,candidatesTokenCount:90,cachedContentTokenCount:100}}].map(__s.extractAiUsage);
   const controller=new AbortController();__s.beginWritingUsage(controller.signal);const req={ok:true,url:'https://v18.invalid/v1/chat/completions',apiKey:'test-only',model:'token-test'};
   for(let i=0;i<2;i++)await __s.fetchAdapterCompletion(req,[{role:'user',content:'测试'}],{stream:false,signal:controller.signal});
   return{samples,usage:JSON.parse(JSON.stringify(__s.lastWritingUsage))};
  });assert.equal(d.samples[0].prompt,0);assert.equal(d.samples[0].cached,0);assert.equal(d.samples[1].prompt,120);assert.equal(d.samples[1].completion,null);assert.equal(d.samples[2].cached,100);assert.equal(d.usage.prompt,240);assert.equal(d.usage.completion,160);assert.equal(d.usage.cached,80);return d;
 });
 await check('记忆：历史章补录、并发、增强向量与旧记忆合并保留源细节',async()=>{
  const d=await c.ev(async()=>{
   __s.cancelMemoryWork();__s.settings.memoryEmbeddingModel='v18-vector';__s.memoryLibrary=__s.normalizeMemoryLibrary({settings:{enabled:false,mode:'enhanced',classicConcurrency:5}});
   __s.chapters=Array.from({length:31},(_,i)=>({id:'memory-'+(i+1),branchId:'main',title:'旧仓库'+(i+1),content:'第'+(i+1)+'日，林舟把铜钥匙交给阿雪，约定次日到东门。守门人不知道此事。',memoryUserInput:i?'第'+(i+1)+'日继续约定':'',summary:'短摘要',versions:[]}));
   __s.activeBranchId='main';await __s.runMemoryBackfill();
   return{progress:__s.memoryProgress,total:__s.memoryLibrary.memories.length,vectors:__s.memoryLibrary.memories.filter(m=>m.vector).length,groups:__s.memoryLibrary.groups,valid:__s.getValidMemoryRows().length};
  });assert.equal(d.progress.error,'');assert.equal(d.total,31);assert.equal(d.vectors,31);assert.equal(d.groups.length,1);assert.equal(d.groups[0].sourceMemories.length,5);assert.equal(d.valid,31);return{total:d.total,vectors:d.vectors,groups:d.groups.length,originals:d.groups[0].sourceMemories.length};
 });
 await check('记忆：旧章替换总结、最新原文保留、召回最多10条按时间排序',async()=>{
  const d=await c.ev(async()=>{
   __s.memoryLibrary.settings.enabled=true;
   const history=__s.buildMemoryHistory(__s.visibleChapters);
   const messages=await __s.appendEnhancedMemoryRecall([{role:'user',content:'铜钥匙在哪里？'}],__s.visibleChapters,'铜钥匙在哪里？',new AbortController().signal);
   __s.cancelMemoryWork();return{history,messages,hits:messages[0].content.match(/<memory_fragment /g)?.length || 0};
  });assert.ok(d.history.text.includes('【合并记忆'));assert.ok(d.history.text.includes('记忆6'));assert.ok(d.history.text.includes('第31日'));assert.equal(d.hits,10);assert.ok(d.messages[0].content.indexOf('chapter="1"')<d.messages[0].content.indexOf('chapter="10"'));return{hits:d.hits,summary:d.history.hasSummaryContext};
 });
 await check('记忆：正文重写立即失效、停用回退原文、支线隔离',async()=>{
  const d=await c.ev(()=>{
   __s.chapters[0].content='V18_REWRITTEN_FACT：铜钥匙已归还林舟';
   const stale=__s.getValidMemoryRows().some(m=>m.chapterId==='memory-1'),groups=__s.validMemoryGroups(__s.getValidMemoryRows()).length;
   const m=__s.memoryLibrary.memories.find(m=>m.chapterId==='memory-2');m.enabled=false;
   const history=__s.buildMemoryHistory(__s.visibleChapters);
   __s.branchList=[{id:'main',name:'主线'},{id:'side',name:'支线',forkFromChapterId:'memory-3'}];
   __s.chapters.push({id:'side-1',branchId:'side',content:'支线独有事实',title:'分岔'});__s.activeBranchId='side';
   const ids=__s.getValidMemoryRows().map(m=>m.chapterId);__s.memoryLibrary.settings.enabled=false;
   return{stale,groups,history:history.text,ids};
  });assert.equal(d.stale,false);assert.equal(d.groups,0);assert.ok(d.history.includes('V18_REWRITTEN_FACT'));assert.ok(d.history.includes('第2日'));assert.deepEqual(d.ids,['memory-2','memory-3']);return {staleExcluded:true,disabledUsesOriginal:true,branchIds:d.ids};
 });
 await check('记忆：切书取消在途请求，书籍/Token/模型互不覆盖',async()=>{
  const d=await c.ev(async()=>{
   const origin=__s.currentBookId;__s.syncBookData();const model=__s.connectionCenter.profiles[0].defaultModel;
   window.__delayMemory=true;const fetchBefore=window.fetch;
   window.fetch=async(url,opts)=>{if(__delayMemory && String(url).includes('v18.invalid') && !String(url).includes('embeddings'))await new Promise((resolve,reject)=>{const t=setTimeout(resolve,180);opts.signal?.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('已取消','AbortError'));},{once:true});});return fetchBefore(url,opts);};
   const pending=__s.runMemoryBackfill();await new Promise(r=>setTimeout(r,25));
   __s.books.push({id:'v18-other',title:'另一书',novel:{title:'另一书'},chapters:[],characters:[]});__s.loadBook('v18-other');await pending;
   const fresh={memory:__s.memoryLibrary.memories.length,usage:__s.lastWritingUsage};
   __s.loadBook(origin);__delayMemory=false;window.fetch=fetchBefore;
   return{fresh,restored:__s.memoryLibrary.memories.length,usage:__s.lastWritingUsage,model:__s.connectionCenter.profiles[0].defaultModel,sameModel:__s.connectionCenter.profiles[0].defaultModel===model};
  });assert.equal(d.fresh.memory,0);assert.equal(d.fresh.usage,null);assert.equal(d.restored,31);assert.equal(d.usage.cached,80);assert.equal(d.sameModel,true);return d;
 });
 await check('自定义字数：桌面双击、小数保存、固定档位仍可选',async()=>{
  await c.ev(()=>{__s.showStoryBibleWorkbench=false;__s.showCharacterWorkbench=false;__s.showOutlineInMain=false;__s.showDetailedOutlineInMain=false;__s.mobileSidebarOpen=false;__s.currentTab='outline';document.querySelector('[data-word-count]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));});await delay(80);
  const d=await c.ev(()=>{const input=document.querySelector('[data-custom-word-count]');input.value='1234.5';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return{value:__s.wordCountTarget,editing:__s.editingWordCount};});assert.equal(d.value,1234.5);assert.equal(d.editing,false);return d;
 });
 for(const width of [1366,390]){
  await c.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});await c.ev(()=>{__s.mobileSidebarOpen=false;__s.openStoryBibleWorkbench('memory');});await delay(450);await shot('memory-'+width);
  await check('记忆工作台布局 '+width,async()=>{const d=await c.ev(()=>{const rect=document.querySelector('[data-memory-library]').getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth+1,width:rect.width,left:rect.left,right:rect.right,inner:innerWidth};});assert.equal(d.overflow,false);assert.ok(d.width>Math.min(280,width-40));assert.ok(d.left>=0 && d.right<=d.inner+1);return d;});
  await c.ev(()=>{__s.closeStoryBibleWorkbench();__s.showTokenUsage=true;});await delay(120);await shot('composer-'+width);
 }
 await check('手机长按字数：显示输入框且获得焦点',async()=>{
  await c.ev(()=>{const select=document.querySelector('[data-word-count]');select.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',bubbles:true}));});await delay(580);
  const d=await c.ev(()=>{const input=document.querySelector('[data-custom-word-count]');const focused=document.activeElement===input;input.value='876.25';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return{focused,value:__s.wordCountTarget};});assert.equal(d.focused,true);assert.equal(d.value,876.25);return d;
 });
 await check('自动记录与真实写作请求接线：记忆和自定义字数进入请求，token更新',async()=>{
  await c.ev(()=>{__s.activeBranchId='main';__s.chapters=__s.chapters.slice(0,3);__s.memoryLibrary.settings.enabled=true;__s.memoryLibrary.settings.summaryKeepChapters=5;__s.settings.geminiTestInput=true;__s.wordCountTarget=300.5;__s.nextChapterPrompt='V18_STORY_INPUT：阿雪按约定携铜钥匙到东门。';__s.startGeneration();});
  for(let i=0;i<100;i++){if(!await c.ev(()=>__s.isGenerating))break;await delay(80);}
  await delay(1200);
  const d=await c.ev(()=>({chapters:__s.chapters.length,last:__s.chapters.at(-1),usage:__s.lastWritingUsage,rows:__s.getValidMemoryRows().length,request:__wire.filter(r=>!r.url.includes('embeddings') && JSON.stringify(r.body).includes('V18_STORY_INPUT') && !JSON.stringify(r.body).includes('逐章记忆整理器')).at(-1),progress:__s.memoryProgress}));
  assert.equal(d.chapters,4);assert.ok(d.last.memoryUserInput.includes('V18_STORY_INPUT'));assert.ok(d.rows>=4);
  // 默认隔离配置是 OpenAI-compatible；Gemini 测试输入只在原生 Gemini 请求中注入。
  assert.equal(JSON.stringify(d.request.body).includes('read_user_input'),false);assert.ok(JSON.stringify(d.request.body).includes('300.5字'));assert.equal(d.usage.prompt,240);assert.equal(d.usage.cached,80);return{chapters:d.chapters,recorded:d.rows,usage:d.usage,volumeHandoffIncluded:true,geminiInputExcludedFromOpenAI:true};
 });
 await require('./v18-boundaries.cjs')(c,check);
 await require('./v18-optimization.cjs')(c,check,shot);
 await require('./v18-visuals.cjs')(c,check,shot);
 await require('./v18-accessibility.cjs')(c,check,shot);
 await require('./v18-r1-settings-search.cjs')(c,check,shot);
 await check('保存刷新：记忆库、旧预设开关、自定义字数及Token恢复',async()=>{
  await c.ev(async()=>{__s.cancelMemoryWork();__s.memoryLibrary.settings.enabled=false;__s.settings.geminiTestInput=true;__s.settings.showTokenUsage=true;await __s.saveData();});await delay(1100);await c.navigate();
  const d=await c.ev(()=>({records:__s.memoryLibrary.memories.length,usage:__s.lastWritingUsage,wordCount:__s.wordCountTarget,old:__s.presets[0].content,oldEnabled:__s.presets[0].enabled,gemini:__s.settings.geminiTestInput,token:__s.settings.showTokenUsage,temperature:__s.settings.temperature,effort:__s.settings.reasoningEffort,anti:__s.settings.preventTruncation,embedding:__s.settings.memoryEmbeddingModel}));assert.ok(d.records>=4);assert.equal(d.usage.cached,40);assert.equal(d.wordCount,300.5);assert.equal(d.old,'V18_LEGACY_SCOPE');assert.equal(d.oldEnabled,false);assert.equal(d.gemini,true);assert.equal(d.token,true);assert.equal(d.temperature,.42);assert.equal(d.effort,'high');assert.equal(d.anti,true);assert.equal(d.embedding,'v18-vector-next');return d;
 });
};
