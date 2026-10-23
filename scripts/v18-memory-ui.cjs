'use strict';
const assert=require('node:assert/strict');
module.exports=async function(c,check){
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 await c.ev(()=>{
  __s.cancelMemoryWork();__s.syncBookData();
  window.__memoryUi={book:__s.currentBookId,model:__s.settings.memoryEmbeddingModel,fetch};
  __s.books.push({id:'v18-memory-ui',title:'记忆按钮隔离书',novel:{title:'记忆按钮隔离书'},chapters:[],characters:[]});__s.loadBook('v18-memory-ui');
  __s.chapters=[1,2].map(no=>({id:'ui-chapter-'+no,branchId:'main',title:'按钮测试'+no,content:'UI_CHAPTER_'+no+'：铜钥匙在阿雪手中。',summary:'不能拿短摘要代替正文'}));
  __s.memoryLibrary=__s.normalizeMemoryLibrary({settings:{enabled:false,mode:'enhanced',summaryKeepChapters:1}});
  __s.openStoryBibleWorkbench('memory');
 });await delay(450);
 try{
  await check('记忆模型按钮与手选：加载状态、全局保存、切书不丢且无串书',async()=>{
   const d=await c.ev(async()=>{
    let release;window.fetch=async(url,opts)=>String(url).endsWith('/models')?new Promise(r=>release=r):__memoryUi.fetch(url,opts);
    document.querySelector('[data-memory-embedding] button').click();await Vue.nextTick();
    const loading=document.querySelector('[data-memory-embedding] button').disabled;
    release(new Response(JSON.stringify({data:[{id:'v18-ui-vector'},{id:'v18-chat'}]})));
    for(let i=0;i<30&&__s.memoryEmbeddingDiscovery.loading;i++)await new Promise(r=>setTimeout(r,20));await Vue.nextTick();
    const select=document.querySelector('[data-memory-embedding-model]');select.value='v18-ui-vector';select.dispatchEvent(new Event('change',{bubbles:true}));await Vue.nextTick();
    const selected=__s.settings.memoryEmbeddingModel;__s.syncBookData();__s.loadBook(__memoryUi.book);
    const other={model:__s.settings.memoryEmbeddingModel,mixed:__s.chapters.some(ch=>ch.id.startsWith('ui-chapter-'))||__s.memoryLibrary.memories.some(m=>m.chapterId.startsWith('ui-chapter-'))};
    __s.loadBook('v18-memory-ui');__s.openStoryBibleWorkbench('memory');await Vue.nextTick();window.fetch=__memoryUi.fetch;
    return{loading,selected,other,returned:document.querySelector('[data-memory-embedding-model]').value,rows:__s.memoryLibrary.memories.length};
   });assert.equal(d.loading,true);assert.equal(d.selected,'v18-ui-vector');assert.equal(d.other.model,d.selected);assert.equal(d.other.mixed,false);assert.equal(d.returned,d.selected);assert.equal(d.rows,0);return d;
  });
  await check('记忆补录按钮：两章正文各自总结并创建向量索引',async()=>{
   await c.ev(()=>[...document.querySelector('[data-memory-library]').querySelectorAll('button')].find(b=>b.textContent.includes('补录缺失记忆')).click());
   for(let i=0;i<100&&await c.ev(()=>__s.memoryProgress.busy);i++)await delay(30);
   const d=await c.ev(()=>({busy:__s.memoryProgress.busy,error:__s.memoryProgress.error,memories:__s.memoryLibrary.memories.map(m=>({id:m.chapterId,text:m.text,vector:!!m.vector})),labels:[...document.querySelectorAll('[data-memory-library] article')].map(a=>a.textContent)}));
   assert.equal(d.busy,false);assert.equal(d.error,'');assert.equal(d.memories.length,2);assert.deepEqual(d.memories.map(m=>m.id).sort(),['ui-chapter-1','ui-chapter-2']);assert.ok(d.memories.every(m=>m.vector));assert.ok(d.labels.every(t=>t.includes('章')&&!t.includes('楼层')));return d;
  });
  await check('记忆编辑、停用/启用与重新记录按钮：写作上下文实时更新',async()=>{
   const d=await c.ev(async()=>{
    const article=()=>document.querySelector('[data-memory-library] article');
    const input=article().querySelector('textarea');input.value='UI_EDITED_MEMORY：阿雪保管钥匙。';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));await Vue.nextTick();
    __s.memoryLibrary.settings.enabled=true;
    const edited=__s.buildMemoryHistory(__s.visibleChapters).text;const cleared=!__s.memoryLibrary.memories[0].vector;
    [...article().querySelectorAll('button')].find(b=>b.textContent.trim()==='停用').click();await Vue.nextTick();
    const disabled=__s.buildMemoryHistory(__s.visibleChapters).text;
    [...article().querySelectorAll('button')].find(b=>b.textContent.trim()==='启用').click();await Vue.nextTick();const enabled=__s.buildMemoryHistory(__s.visibleChapters).text;
    __s.memoryLibrary.settings.enabled=false;__s.cancelMemoryWork();
    [...article().querySelectorAll('button')].find(b=>b.textContent.trim()==='重新记录').click();
    for(let i=0;i<100&&__s.memoryProgress.busy;i++)await new Promise(r=>setTimeout(r,20));await Vue.nextTick();
    return{edited,cleared,disabled,enabled,recorded:article().querySelector('textarea').value,error:__s.memoryProgress.error};
   });assert.ok(d.edited.includes('UI_EDITED_MEMORY'));assert.equal(d.cleared,true);assert.ok(d.disabled.includes('UI_CHAPTER_1')&&!d.disabled.includes('UI_EDITED_MEMORY'));assert.ok(d.enabled.includes('UI_EDITED_MEMORY'));assert.ok(d.recorded.startsWith('记忆1：'));assert.equal(d.error,'');return d;
  });
  await check('记忆停止按钮：取消在途补录，晚到响应不写入',async()=>{
   const d=await c.ev(async()=>{
    __s.cancelMemoryWork();__s.memoryLibrary.memories=[];await Vue.nextTick();
    const pending=[];window.fetch=async(url,opts)=>new Promise(resolve=>pending.push(()=>__memoryUi.fetch(url,{...opts,signal:undefined}).then(resolve)));
    [...document.querySelector('[data-memory-library]').querySelectorAll('button')].find(b=>b.textContent.includes('补录缺失记忆')).click();await Vue.nextTick();
    const running=__s.memoryProgress.busy;[...document.querySelector('[data-memory-library]').querySelectorAll('button')].find(b=>b.textContent.trim()==='停止').click();await Vue.nextTick();
    for(const release of pending)release();await new Promise(r=>setTimeout(r,150));
    window.fetch=__memoryUi.fetch;return{running,busy:__s.memoryProgress.busy,rows:__s.memoryLibrary.memories.length,stopped:!document.querySelector('[data-memory-library]').textContent.includes('停止')};
   });assert.equal(d.running,true);assert.equal(d.busy,false);assert.equal(d.rows,0);assert.equal(d.stopped,true);return d;
  });
 }finally{
  await c.ev(()=>{window.fetch=__memoryUi.fetch;__s.cancelMemoryWork();__s.loadBook(__memoryUi.book);__s.books=__s.books.filter(b=>b.id!=='v18-memory-ui');__s.settings.memoryEmbeddingModel=__memoryUi.model;__s.closeStoryBibleWorkbench();delete window.__memoryUi;});
 }
};
