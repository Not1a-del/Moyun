'use strict';
const assert=require('node:assert/strict');
module.exports=async function(c,check,shot){
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 await check('章节迁移、最近N章原文与目标章节范围，不读取未来章节',async()=>{
  const d=await c.ev(async()=>{
   const original=JSON.parse(JSON.stringify(__s.memoryLibrary)),chapters=__s.chapters,keep=__s.normalizeMemoryLibrary({settings:{summaryKeepFloors:14}}).settings.summaryKeepChapters;
   try{
    __s.cancelMemoryWork();__s.memoryLibrary=__s.normalizeMemoryLibrary({settings:{enabled:false,summaryKeepChapters:2,classicConcurrency:1}});
    __s.chapters=Array.from({length:5},(_,i)=>({id:'scope-'+i,branchId:'main',content:'CHAPTER_BODY_'+(i+1),summary:'WRONG_SHORT_SUMMARY_'+(i+1)}));
    const start=__wire.length;await __s.runMemoryBackfill();
    const prompts=__wire.slice(start).map(r=>JSON.stringify(r.body));
    __s.memoryLibrary.settings.enabled=true;
    return {keep,prompts,rows:__s.getValidMemoryRows().length,history:__s.buildMemoryHistory(__s.visibleChapters).text};
   }finally{__s.cancelMemoryWork();__s.chapters=chapters;__s.memoryLibrary=original;}
  });assert.equal(d.keep,7);assert.equal(d.rows,5);assert.equal(d.prompts.length,5);
  for(let i=0;i<5;i++){const p=d.prompts[i];assert.ok(p.includes('唯一总结目标｜第 '+(i+1)+' 章'));assert.ok(p.includes('CHAPTER_BODY_'+(i+1)));assert.ok(!p.includes('WRONG_SHORT_SUMMARY'));for(let j=i+2;j<=5;j++)assert.ok(!p.includes('CHAPTER_BODY_'+j));if(i>=3)assert.ok(!p.includes('CHAPTER_BODY_'+(i-2)));}
  assert.ok(d.history.includes('【逐章记忆】'));assert.ok(d.history.includes('CHAPTER_BODY_4'));assert.ok(d.history.includes('CHAPTER_BODY_5'));assert.ok(!d.history.includes('CHAPTER_BODY_3'));return{keep:d.keep,chapters:d.rows,recentOriginal:2};
 });
 await check('全局向量模型获取：使用默认API，手选保留，切站旧结果不污染新列表，错误可重试',async()=>{
  const d=await c.ev(async()=>{
   const before=fetch,original=__s.settings.memoryEmbeddingModel,route=__s.connectionCenter.moduleRoutes.summary,profile=__s.connectionCenter.profiles[0];const urls=[];
   try{
    __s.connectionCenter.profiles.push({...JSON.parse(JSON.stringify(profile)),id:'other-summary',baseUrl:'https://other.invalid/v1'});__s.setConnectionCredential('other-summary','test-other');__s.connectionCenter.moduleRoutes.summary='other-summary';
    window.fetch=async(url,opts)=>{urls.push(String(url));return new Response(JSON.stringify({data:[{id:'chat-model'},{id:'manual-vector'}]}));};
    const ok=await __s.fetchMemoryEmbeddingModels();__s.settings.memoryEmbeddingModel='manual-vector';__s.memorySettingsChanged();
    const options=[...__s.memoryEmbeddingModelOptions];
    let release;window.fetch=async()=>new Promise(r=>release=r);const pending=__s.fetchMemoryEmbeddingModels();await Promise.resolve();
    __s.connectionCenter.defaultProfileId='other-summary';release(new Response(JSON.stringify({data:[{id:'stale-vector'}]})));await pending;
    const stale=__s.memoryEmbeddingModelOptions.includes('stale-vector'),selected=__s.settings.memoryEmbeddingModel;
    window.fetch=async()=>new Response('{"error":{"message":"offline"}}',{status:503});await __s.fetchMemoryEmbeddingModels();const error=__s.memoryEmbeddingDiscovery.error;
    window.fetch=async()=>new Response(JSON.stringify({data:[{id:'new-vector'}]}));const retried=await __s.fetchMemoryEmbeddingModels();
    return{ok,urls,options,stale,selected,error,retried,loading:__s.memoryEmbeddingDiscovery.loading};
   }finally{window.fetch=before;__s.connectionCenter.defaultProfileId=profile.id;__s.connectionCenter.moduleRoutes.summary=route;__s.connectionCenter.profiles=__s.connectionCenter.profiles.filter(p=>p.id!=='other-summary');__s.settings.memoryEmbeddingModel=original;__s.cancelMemoryWork();}
  });assert.equal(d.ok,true);assert.equal(d.urls[0],'https://v18.invalid/v1/models');assert.ok(d.options.includes('chat-model')&&d.options.includes('manual-vector'));assert.equal(d.stale,false);assert.equal(d.selected,'manual-vector');assert.ok(d.error.includes('503'));assert.equal(d.retried,true);assert.equal(d.loading,false);return{defaultSite:true,manualSelection:true,staleExcluded:true,retried:true};
 });
 await check('向量失败和重复索引不阻断写作，回退逐章上下文；取消仍抛出',async()=>{
  const d=await c.ev(async()=>{
   const before=fetch,original=JSON.parse(JSON.stringify(__s.memoryLibrary));
   try{
    __s.cancelMemoryWork();__s.memoryLibrary.settings.enabled=true;__s.memoryLibrary.settings.mode='enhanced';
    for(const m of __s.memoryLibrary.memories)delete m.vector;
    const messages=[{role:'user',content:'FALLBACK_WRITING'}];
    window.fetch=async()=>new Response('{"error":{"message":"offline"}}',{status:503});const fallback=await __s.appendEnhancedMemoryRecall(messages,__s.visibleChapters,'铜钥匙',new AbortController().signal);
    window.fetch=async()=>new Response(JSON.stringify({data:[{index:0,embedding:[1,0]},{index:0,embedding:[1,0]}]}));const duplicate=await __s.appendEnhancedMemoryRecall(messages,__s.visibleChapters,'铜钥匙',new AbortController().signal);
    const controller=new AbortController();controller.abort();let aborted=false;try{await __s.appendEnhancedMemoryRecall(messages,__s.visibleChapters,'铜钥匙',controller.signal);}catch(e){aborted=e.name==='AbortError';}
    return{fallback:JSON.stringify(fallback),duplicate:JSON.stringify(duplicate),vectors:__s.memoryLibrary.memories.filter(m=>m.vector).length,aborted};
   }finally{window.fetch=before;__s.cancelMemoryWork();__s.memoryLibrary=original;}
  });assert.equal(d.fallback,'[{"role":"user","content":"FALLBACK_WRITING"}]');assert.equal(d.duplicate,d.fallback);assert.equal(d.vectors,0);assert.equal(d.aborted,true);return d;
 });
 await check('抗截断进入实际写作与记忆总结，工具外壳不进入章节，全局采样覆盖固定值',async()=>{
  await c.ev(()=>{
   window.__optOriginalFetch=fetch;window.__optModel=__s.connectionCenter.profiles[0].defaultModel;
   __s.connectionCenter.profiles[0].defaultModel='gemini-3-test';__s.settings.preventTruncation=true;__s.settings.temperature=.36;__s.settings.reasoningEffort='low';__s.settings.geminiTestInput=true;
   window.fetch=async(url,opts)=>{const response=await __optOriginalFetch(url,opts);if(!String(url).includes('v18.invalid') || !JSON.parse(opts.body || '{}').tools?.some(t=>t.function?.name==='output_reply'))return response;const data=await response.json(),text=data.choices[0].message.content;data.choices[0].message={tool_calls:[{id:'reply',type:'function',function:{name:'output_reply',arguments:JSON.stringify({content:text})}}]};data.choices[0].finish_reason='tool_calls';return new Response(JSON.stringify(data));};
   __s.memoryLibrary.settings.enabled=true;__s.nextChapterPrompt='V18_TOOL_WRITE：阿雪在东门等待，钥匙仍在她手中。';__s.startGeneration();
  });
  try{
   for(let i=0;i<150;i++){if(!await c.ev(()=>__s.isGenerating))break;await delay(80);}await delay(1000);
   const d=await c.ev(()=>{const wire=__wire.filter(r=>Array.isArray(r.body.messages)&&r.body.tools?.some(t=>t.function?.name==='output_reply')&&JSON.stringify(r.body).includes('V18_TOOL_WRITE')&&!JSON.stringify(r.body).includes('逐章记忆整理器')).at(-1);return{last:__s.chapters.at(-1),wire,rows:__s.getValidMemoryRows().map(m=>m.chapterId),isInterrupted:__s.isInterrupted};});
   assert.ok(d.last.memoryUserInput.includes('V18_TOOL_WRITE'));assert.ok(!d.last.content.includes('output_reply'));assert.ok(!d.last.content.includes('"content":'));assert.ok(d.rows.includes(d.last.id));assert.equal(d.wire.body.temperature,.36);assert.equal(d.wire.body.reasoning_effort,'low');assert.equal(d.isInterrupted,false);assert.ok(!JSON.stringify(d.wire.body.messages).includes('[续写意图分析]'));return{saved:true,recorded:true,temperature:d.wire.body.temperature,effort:d.wire.body.reasoning_effort};
  }finally{await c.ev(()=>{window.fetch=__optOriginalFetch;__s.connectionCenter.profiles[0].defaultModel=__optModel;__s.settings.preventTruncation=false;__s.settings.reasoningEffort='';__s.settings.temperature=1;__s.cancelMemoryWork();});}
 });
 await require('./v18-memory-ui.cjs')(c,check);
 for(const [width,height] of [[1366,900],[390,844],[320,568],[667,375]]){
  await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768});
  await c.ev(()=>{__s.showStoryBibleWorkbench=false;__s.mobileSidebarOpen=false;__s.activeSettingsTab='api';__s.showSettings_modal=true;});await delay(450);
  await check('全局滑块交互与键盘焦点 '+width+'x'+height,async()=>{
   const d=await c.ev(async()=>{const el=document.querySelector('[data-global-generation-settings]');el.scrollIntoView({block:'center'});const inputs=[...el.querySelectorAll('input[type=range]')];inputs[0].value='3';inputs[0].dispatchEvent(new Event('input',{bubbles:true}));inputs[0].dispatchEvent(new Event('change',{bubbles:true}));inputs[1].value='.42';inputs[1].dispatchEvent(new Event('input',{bubbles:true}));inputs[1].dispatchEvent(new Event('change',{bubbles:true}));inputs[1].focus();await Vue.nextTick();const r=el.getBoundingClientRect();return{effort:__s.settings.reasoningEffort,temp:__s.settings.temperature,focus:document.activeElement===inputs[1],label:inputs[0].getAttribute('aria-valuetext'),heights:inputs.map(i=>i.getBoundingClientRect().height),left:r.left,right:r.right,viewport:innerWidth,overflow:el.scrollWidth>el.clientWidth+1,text:el.textContent};});
   assert.equal(d.effort,'high');assert.equal(d.temp,.42);assert.equal(d.focus,true);assert.ok(d.heights.every(h=>h>=44),JSON.stringify(d));assert.ok(d.left>=0&&d.right<=d.viewport+1,JSON.stringify(d));assert.equal(d.overflow,false);assert.ok(d.text.includes('全局设置'));return d;
  });await shot('global-controls-'+width+'x'+height);
  await c.ev(()=>{__s.activeSettingsTab='context';});await delay(80);
  await check('Gemini说明仅实验功能 '+width,async()=>{const text=await c.ev(()=>document.querySelector('[data-settings-gemini-input]').querySelector('[class~="text-[10px]"]')?.textContent);assert.equal(text,'实验功能');return text;});
  await c.ev(()=>{__s.showSettings_modal=false;__s.currentTab='presets';__s.mobileSidebarOpen=innerWidth<768;__s.presets[0]._expanded=true;__s.presets[0].name='LONG'.repeat(160);__s.presets[0].content='长内容LONG'.repeat(600);});await delay(450);
  await check('旧预设长文本可读与警告 '+width+'x'+height,async()=>{
   const d=await c.ev(()=>{const root=document.querySelector('[data-moyun-legacy-presets]');root.scrollIntoView({block:'start'});const input=root.querySelector('textarea'),r=root.getBoundingClientRect(),t=input.getBoundingClientRect();return{warning:root.textContent.includes('未知兼容性警告，请谨慎使用'),left:r.left,right:r.right,width:r.width,viewport:innerWidth,overflow:root.scrollWidth>root.clientWidth+1,textareaWidth:t.width,fontSize:parseFloat(getComputedStyle(input).fontSize)};});assert.equal(d.warning,true);assert.equal(d.overflow,false);assert.ok(d.left>=0&&d.right<=d.viewport+1,JSON.stringify(d));assert.ok(d.textareaWidth>=d.width*.8-26);if(width<768)assert.ok(d.fontSize>=14);return d;
  });await shot('legacy-readable-'+width+'x'+height);
  await c.ev(()=>{const button=[...document.querySelector('[data-moyun-region="presets"]').querySelectorAll('button')].find(b=>b.textContent.trim()==='+ 新建');button.scrollIntoView({block:'center'});button.focus();button.click();});await delay(450);
  await c.ev(()=>{__s.promptPresetEditor.name='长预设';__s.promptPresetEditor.content='TEXT'.repeat(1600);});
  await check('预设编辑弹窗居中、可读宽度、焦点与滚动 '+width+'x'+height,async()=>{const d=await c.ev(()=>{const root=document.querySelector('[data-moyun-modal="prompt-preset-editor"]'),panel=root.querySelector('[data-moyun-modal-panel]'),r=panel.getBoundingClientRect(),save=[...panel.querySelectorAll('button')].find(b=>b.textContent.trim()==='保存');save.scrollIntoView({block:'center'});const s=save.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width,top:r.top,bottom:r.bottom,viewport:innerWidth,height:innerHeight,overflow:panel.scrollWidth>panel.clientWidth+1,scrollable:panel.scrollHeight>panel.clientHeight,focused:root.contains(document.activeElement),saveVisible:s.top>=r.top&&s.bottom<=r.bottom+1};});assert.ok(d.left>=-.5&&d.right<=d.viewport+.5);assert.ok(d.top>=-.5&&d.bottom<=d.height+.5);assert.ok(d.width>=Math.min(512,d.viewport)-1,JSON.stringify(d));assert.ok(Math.abs((d.left+d.right)/2-d.viewport/2)<1);assert.equal(d.overflow,false);assert.equal(d.focused,true);assert.equal(d.saveVisible,true);return d;});await shot('preset-editor-'+width+'x'+height);
  await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await delay(150);
  await check('预设弹窗 Escape 关闭并还原焦点 '+width,async()=>{const d=await c.ev(()=>({closed:!__s.showPromptPresetEditor,focus:document.activeElement.textContent.trim()}));assert.equal(d.closed,true);assert.equal(d.focus,'+ 新建');return d;});
  await c.ev(()=>{__s.mobileSidebarOpen=false;__s.openStoryBibleWorkbench('memory');__s.memoryLibrary.settings.mode='enhanced';});await delay(450);
  await check('全局向量选择与章节文案布局 '+width+'x'+height,async()=>{const d=await c.ev(()=>{const root=document.querySelector('[data-memory-library]'),el=document.querySelector('[data-memory-embedding]'),r=el.getBoundingClientRect();return{left:r.left,right:r.right,viewport:innerWidth,overflow:el.scrollWidth>el.clientWidth+1,text:root.textContent,selected:document.querySelector('[data-memory-embedding-model]').value};});assert.ok(d.left>=0&&d.right<=d.viewport+1,JSON.stringify(d));assert.equal(d.overflow,false);assert.ok(!d.text.includes('楼层'));assert.ok(d.text.includes('章节')&&d.text.includes('全局'));assert.equal(d.selected,'v18-vector-next');return{left:d.left,right:d.right,selected:d.selected};});await shot('embedding-controls-'+width+'x'+height);
  await c.ev(()=>{__s.closeStoryBibleWorkbench();});
 }
 await c.ev(()=>{__s.settings.temperature=.42;__s.settings.reasoningEffort='high';__s.settings.preventTruncation=true;__s.cancelMemoryWork();__s.memoryLibrary.settings.enabled=false;__s.presets[0].name='测试旧预设';__s.presets[0].content='V18_LEGACY_SCOPE';});
};
