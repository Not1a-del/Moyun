'use strict';
// Serialize one exported function into the existing managed, isolated browser tab.
// Fixtures must already be installed as globalThis.__v19Fixtures; no browser is started here.
async function runWritingDraftBrowserChecks() {
  const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState;
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const until=async fn=>{for(let i=0;i<160;i++){if(await fn())return;await wait(40);}throw Error('Writing draft did not reach the expected state');};
  assert(globalThis.__v19Fixtures?.F,'Install fixture F first');
  const fixture=JSON.parse(JSON.stringify(globalThis.__v19Fixtures.F)),id='v19-writing-browser-F',marker='RT-H3 browser draft survives refresh';
  fixture.id=id;fixture.title='Browser handwriting verification';fixture.novel.title=fixture.title;
  s.books=s.books.filter(book=>book.id!==id);s.books.push(fixture);s.loadBook(id);
  s.showSettings_modal=false;s.showOutlineInMain=false;s.showDetailedOutlineInMain=false;s.mobileSidebarOpen=false;
  await wait(2300);
  const chapter=s.chapters[0],official=chapter.content,editable=official.replace(/\r\n?/g,'\n'),draft=editable+'\n\n'+marker;
  const originalSave=DB.saveLibrary,writes=[];
  DB.saveLibrary=async function(library,...args){writes.push(JSON.parse(JSON.stringify(library)));return originalSave.call(DB,library,...args);};
  try {
    s.enterImmersiveWriting({chapterIndex:0});await until(()=>{const el=document.querySelector('textarea[aria-label="沉浸手写正文"]');return el?.value===editable&&s.immersiveWritingText===editable&&s.chapters.find(row=>row.id===chapter.id)?.isEditing;});
    const input=document.querySelector('textarea[aria-label="沉浸手写正文"]'),start=performance.now();
    input.value=draft;input.dispatchEvent(new Event('input',{bubbles:true}));
    await until(()=>{const current=s.chapters.find(row=>row.id===chapter.id);return current?.tempContent===draft&&current.isEditing;});
    assert(s.chapters.find(row=>row.id===chapter.id)?.content===official,'Typing must leave official chapter unchanged');
    await until(()=>s.immersiveDraftStatus==='草稿已保存');
    const elapsed=Math.round(performance.now()-start);
    assert(elapsed>=1800,'Draft must use the approximately two-second autosave');
    assert(writes.some(library=>library.books.find(book=>book.id===id)?.chapters.some(row=>row.id===chapter.id&&row.tempContent===draft&&row.content===official)),'IndexedDB save must include draft and unchanged official content');
    const raw=await DB.get('library_v6'),stored=typeof raw==='string'?JSON.parse(raw):raw;
    const persisted=stored.books.find(book=>book.id===id).chapters[0];
    assert(persisted.tempContent===draft&&persisted.content===official,'Persisted library must preserve the unsaved draft separately');
    return {passed:true,bookId:id,chapterId:chapter.id,cleanCharacters:official.replace(/\s/g,'').length,draftCharacters:draft.length,autosaveElapsedMs:elapsed,indexedDBDraft:true,officialUnchanged:true,refreshNext:true};
  } finally {DB.saveLibrary=originalSave;}
}
async function checkWritingDraftRestoredAndSave() {
  const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState,id='v19-writing-browser-F',marker='RT-H3 browser draft survives refresh';
  const assert=(ok,message)=>{if(!ok)throw Error(message);},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  s.loadBook(id);const chapter=s.chapters[0];
  assert(chapter.tempContent?.includes(marker),'Draft marker must survive a real reload');
  assert(!chapter.content.includes(marker),'Reload must not turn the draft into official content');
  s.enterImmersiveWriting({chapterIndex:0});await wait(80);
  assert(s.immersiveWritingText.includes(marker),'Reentering handwriting must restore the draft without overwriting it');
  const draft=s.immersiveWritingText;s.saveImmersiveWriting();
  for(let i=0;i<160;i++){
    const raw=await DB.get('library_v6'),library=typeof raw==='string'?JSON.parse(raw):raw,row=library?.books?.find(book=>book.id===id)?.chapters?.[0];
    if(row?.content===draft&&!row.isEditing)break;
    if(i===159)throw Error('Save did not persist official handwritten content');await wait(40);
  }
  assert(chapter.content===draft&&!chapter.isEditing,'Save must commit draft into official chapter');
  return {passed:true,bookId:id,restoredDraft:true,formalContentCommitted:true,refreshNext:true};
}
async function checkWritingSavedRestored() {
  const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState,id='v19-writing-browser-F';s.loadBook(id);
  if(!s.chapters[0]?.content.includes('RT-H3 browser draft survives refresh')||s.chapters[0].isEditing)throw Error('Saved chapter did not survive a real reload as official content');
  return {passed:true,bookId:id,formalContentRestored:true};
}
async function runExpansionBrowserChecks() {
  const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState;
  const assert=(ok,message)=>{if(!ok)throw Error(message);},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const until=async fn=>{for(let i=0;i<160;i++){if(fn())return;await wait(30);}throw Error('Expansion did not reach the expected state');};
  assert(globalThis.__v19Fixtures?.F,'Install fixture F first');
  const saved={center:s.connectionCenter,credentials:s.connectionCredentials,preventTruncation:s.settings.preventTruncation,reasoningEffort:s.settings.reasoningEffort};
  const originalFetch=globalThis.fetch,requests=[],results=[];let responseText='',finishReason='stop',delayMs=0;
  const source='开头甲。\r\n\r\n中间乙。\n\n中间丙。\r结尾丁。',id='v19-expansion-browser-F';
  const fixture=JSON.parse(JSON.stringify(globalThis.__v19Fixtures.F));fixture.id=id;fixture.novel.title='Browser expansion verification';fixture.chapters[0].content=source;
  s.books=s.books.filter(book=>book.id!==id);s.books.push(fixture);s.loadBook(id);await wait(100);
  s.showSettings_modal=false;s.showOutlineInMain=false;s.showDetailedOutlineInMain=false;s.mobileSidebarOpen=false;
  const profile={id:'v19-writing-fake',name:'Isolated writing mock',source:'custom',templateId:'custom',adapterId:'openai-compatible',baseUrl:'https://v19-writing.invalid/v1',defaultModel:'v19-fake',enabled:true,lastTest:{status:'ok'},requestOptions:{stream:false},modelCatalog:[]};
  s.connectionCenter={version:3,providerTemplatesVersion:1,profiles:[profile],defaultProfileId:profile.id,moduleRoutes:{}};s.connectionCredentials={[profile.id]:'v19-fake-key'};
  s.settings.preventTruncation=false;s.settings.reasoningEffort='';
  globalThis.fetch=async function(input,init={}) {
    const url=String(input?.url||input);assert(url.startsWith('https://v19-writing.invalid/'),'Test must never call a real provider');
    const body=JSON.parse(init.body),record={url,body,responseText,finishReason};requests.push(record);
    if(init.signal?.aborted)throw new DOMException('Test stopped','AbortError');
    if(delayMs)await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,delayMs);init.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Test stopped','AbortError'));},{once:true});});
    return new Response(JSON.stringify({choices:[{message:{role:'assistant',content:responseText},finish_reason:finishReason}]}),{headers:{'content-type':'application/json'}});
  };
  const reset=async()=>{s.stopImmersiveExpansion();if(s.immersiveExpandReview)s.discardImmersiveExpansion();s.chapters[0].content=source;s.chapters[0].tempContent=source;s.chapters[0].isEditing=true;s.enterImmersiveWriting({chapterIndex:0});s.enterImmersiveExpansion();s.immersiveExpandTarget=100;await wait(40);};
  const run=async(mode,text,tags={})=>{await reset();responseText=text;finishReason='stop';s.immersiveExpandTags=tags;if(mode==='full')s.setImmersiveExpandTagTool('full');await s.runImmersiveExpansion();assert(s.immersiveExpandReview?.operations.length,'A response must produce a review');assert(s.chapters[0].content===source,'Preview must not change official content');return s.immersiveExpandReview;};
  try {
    assert(s.getModuleRequestConfig('writing').ok,'Fake writing route must be ready');
    await run('append','【新内容开始】尾声新段。【新内容结束】');s.applyImmersiveExpansion();
    assert(s.chapters[0].tempContent===source+'\r\n\r\n尾声新段。','Tail expansion must preserve every original character');results.push({mode:'append',ok:true});
    await run('insert','【新内容开始】雨夜插入段。【新内容结束】',{1:'insert'});s.applyImmersiveExpansion();
    const prefix='开头甲。\r\n\r\n';assert(s.chapters[0].tempContent===prefix+'雨夜插入段。\r\n\r\n'+source.slice(prefix.length),'Insert expansion must preserve exact prefix/suffix separators');results.push({mode:'insert',ok:true});
    await run('range','【新内容开始】中段改写。【新内容结束】',{1:'start',3:'end'});s.applyImmersiveExpansion();
    assert(s.chapters[0].tempContent===prefix+'中段改写。\r结尾丁。','Range expansion must preserve exact outside CRLF/CR text');results.push({mode:'range',ok:true});
    await run('full',JSON.stringify([{paragraph:1,action:'replace',text:'新的开头。',reason:'展开开头'},{paragraph:4,action:'replace',text:'新的结尾。',reason:'展开结尾'}]));
    assert(s.immersiveExpandReview.operations.length===2,'Full expansion must create independent operations');s.applyImmersiveExpansion(0);
    assert(s.chapters[0].tempContent===source.replace('开头甲。','新的开头。'),'Applying first operation must keep the other replacement pending');
    assert(!s.immersiveExpandReview.operations[1].applied,'Second operation must remain pending');s.applyImmersiveExpansion(1);
    assert(s.chapters[0].tempContent===source.replace('开头甲。','新的开头。').replace('结尾丁。','新的结尾。'),'Second operation must apply incrementally');results.push({mode:'full',partialApply:true,ok:true});
    await reset();responseText='【新内容开始】半截仍可审阅。';finishReason='length';await s.runImmersiveExpansion();
    assert(s.immersiveExpandReview?.operations.some(op=>op.warnings.some(text=>/截断|提前结束/.test(text))),'Truncated transport output must remain reviewable with a warning');
    s.applyImmersiveExpansion();assert(s.chapters[0].tempContent.includes('半截仍可审阅。'),'Partial output must be applicable to draft');results.push({mode:'truncated',ok:true});
    await reset();responseText='【新内容开始】不会写入。【新内容结束】';finishReason='stop';delayMs=400;const pending=s.runImmersiveExpansion();await wait(40);s.stopImmersiveExpansion();await pending;
    assert(!s.immersiveExpandBusy&&!s.immersiveExpandReview&&s.chapters[0].tempContent===source,'Stop must abort and leave no late review or text changes');results.push({mode:'stop',ok:true});
    assert(s.chapters[0].content===source,'All expansion actions must leave official content unchanged until Save');
    assert(requests.length===6,'Four modes, one truncation and one stop must use six requests without hidden retries');
    assert(requests.slice(0,4).every(row=>JSON.stringify(row.body).includes('P1: 开头甲。')),'Captured request bodies must contain numbered original paragraphs');
    return {passed:true,bookId:id,protocol:'openai-compatible',results,requests:requests.map(row=>({url:row.url,body:row.body,responseText:row.responseText,finishReason:row.finishReason})),officialUnchanged:true};
  } finally {globalThis.fetch=originalFetch;s.stopImmersiveExpansion();s.connectionCenter=saved.center;s.connectionCredentials=saved.credentials;s.settings.preventTruncation=saved.preventTruncation;s.settings.reasoningEffort=saved.reasoningEffort;s.saveData();}
}
async function runStorageQuotaBrowserChecks() {
  const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState;
  const assert=(ok,message)=>{if(!ok)throw Error(message);},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const storage=navigator.storage,descriptor=Object.getOwnPropertyDescriptor(storage,'estimate');let ratio=.85,estimates=0;
  const results=[],branches=s.branchList.length;
  assert(s.activeBranchId==='main','Load a main-branch test book first');
  Object.defineProperty(storage,'estimate',{configurable:true,writable:true,value:async()=>{estimates++;return {usage:ratio*1000000,quota:1000000};}});
  try {
    // A fresh page is intentional: warning escalation state is session-local and private.
    s.dismissToast();await s.forkBranch(-1,'');
    assert(s.toast.show&&/85%/.test(s.toast.message)&&s.toast.type==='warning','Fresh-page 85 percent check must show a backup warning');
    results.push({ratio:.85,toast:s.toast.message});s.dismissToast();await s.forkBranch(-1,'');assert(!s.toast.show,'Same 85 percent tier must not warn again');
    ratio=.92;await s.forkBranch(-1,'');assert(s.toast.show&&/92%/.test(s.toast.message)&&s.toast.type==='error','92 percent must escalate to an urgent warning');
    await wait(8200);assert(s.toast.show&&/92%/.test(s.toast.message),'92 percent warning must remain visible beyond the maximum timed toast duration');
    results.push({ratio:.92,persistentAfterMs:8200,toast:s.toast.message});s.dismissToast();await s.forkBranch(-1,'');assert(!s.toast.show,'Same 92 percent tier must not warn again');
    ratio=.98;const pending=s.forkBranch(-1,'');
    for(let i=0;i<100&&!s.showConfirm;i++)await wait(20);assert(s.showConfirm&&s.confirmCfg.title==='存储空间接近上限','98 percent must require an explicit choice');
    assert(/98%/.test(s.toast.message),'98 percent must escalate warning');
    await s.execConfirmChoice('cancel');await pending;assert(s.branchList.length===branches,'Cancel must not create a branch');
    const continued=s.forkBranch(-1,'');for(let i=0;i<100&&!s.showConfirm;i++)await wait(20);await s.execConfirmChoice('continue');await continued;assert(s.branchList.length===branches,'Invalid source index must never create a branch after continue');
    results.push({ratio:.98,confirmationCancelled:true,confirmationContinued:true,branchCountUnchanged:true});
    return {passed:true,results,estimates,sameTierSuppressed:true};
  } finally {if(descriptor)Object.defineProperty(storage,'estimate',descriptor);else delete storage.estimate;if(s.showConfirm)s.cancelConfirm();}
}
async function runMemoryRescueExportBrowserChecks() {
  const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState;
  const assert=(ok,message)=>{if(!ok)throw Error(message);},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  assert(globalThis.__v19Fixtures?.F,'Install fixture F first');
  const id='v19-rescue-browser-F',fixture=JSON.parse(JSON.stringify(globalThis.__v19Fixtures.F));fixture.id=id;fixture.novel.title='Browser quota rescue';
  const mainOutline={id:'rescue-main-outline',chapterNo:1,title:'Main outline',content:'RT main outline'},sideOutline={id:'rescue-side-outline',chapterNo:2,title:'Side outline',content:'RT side outline'};
  fixture.chapterOutlines=[mainOutline];
  fixture.branchList.push({id:'rescue-side',name:'Rescue side',forkIndex:0,forkFromChapterId:fixture.chapters[0].id});
  fixture.branchData={main:{chapterOutlines:[mainOutline],chapterIndexDrafts:[],foreshadowMatrix:[],staleMarks:[]},'rescue-side':{outlineEdits:{},outlineTail:[sideOutline],indexEdits:{},indexTail:[],foreshadowMatrix:[],staleMarks:[]}};
  s.books=s.books.filter(book=>book.id!==id);s.books.push(fixture);s.loadBook(id);await wait(2300);
  const original={save:DB.saveLibrary,images:ImageStore.exportBook,create:URL.createObjectURL,click:HTMLAnchorElement.prototype.click};
  const blobs=[],downloads=[];let failures=0,imageFailures=0;
  const formal='RT rescue formal memory',draft='RT rescue unsaved chapter draft',handwriting='RT rescue new chapter handwriting';
  s.chapters[0].content=formal;s.chapters[0].tempContent=draft;s.chapters[0].isEditing=true;s.novel.immersiveHandwritingDrafts={main:{content:handwriting}};
  DB.saveLibrary=async()=>{failures++;throw new DOMException('Forced browser quota failure','QuotaExceededError');};
  ImageStore.exportBook=async()=>{imageFailures++;throw new DOMException('Forced image store failure','InvalidStateError');};
  URL.createObjectURL=function(blob){blobs.push(blob);return original.create.call(URL,blob);};
  HTMLAnchorElement.prototype.click=function(){if(this.download.endsWith('_全量备份.json'))downloads.push(this.download);else return original.click.call(this);};
  try {
    s.exportBookJson();for(let i=0;i<100&&!s.showConfirm;i++)await wait(20);assert(s.confirmCfg.title==='导出 JSON','Export must use the native choice dialog');
    await s.execConfirmChoice('backup');
    assert(failures>=1&&imageFailures===1,'Rescue path must exercise actual failing DB.saveLibrary and ImageStore.exportBook');
    assert(blobs.length===1&&downloads.length===1,'A failed save and image read must still produce one JSON download');
    const data=JSON.parse(await blobs[0].text());
    assert(data.chapters[0].content===formal&&data.chapters[0].tempContent===draft,'Rescue backup must retain current formal and draft chapter content');
    assert(data.novel.immersiveHandwritingDrafts.main.content===handwriting,'Rescue backup must retain new chapter handwriting draft');
    assert(data.chapterOutlines[0].id==='rescue-main-outline'&&data.branchData['rescue-side'].outlineTail[0].id==='rescue-side-outline','Rescue backup must preserve main and side branch outlines separately');
    assert(data._type==='moyun_full_book_backup'&&Object.keys(data._imageCache).length===0,'Rescue backup must retain correct format with an empty failed image cache');
    assert(/图片缓存读取失败/.test(s.toast.message),'Rescue warning must disclose missing image cache');
    const memory=s.buildLibrarySnapshot().books.find(book=>book.id===id);
    assert(s.chapters[0].tempContent===draft&&memory.branchData.main.chapterOutlines[0].id==='rescue-main-outline'&&memory.branchData['rescue-side'].outlineTail[0].id==='rescue-side-outline','Failed persistence must not delete in-memory data');
    const serialized=JSON.stringify(data);assert(!serialized.includes('v19-fake-key')&&!('connectionCredentials'in data),'Export must omit API credentials');
    return {passed:true,bookId:id,forcedSaveFailures:failures,forcedImageFailures:imageFailures,downloadName:downloads[0],bytes:blobs[0].size,formalPreserved:true,draftPreserved:true,handwritingPreserved:true,branchesPreserved:true,credentialsOmitted:true,warning:s.toast.message};
  } finally {DB.saveLibrary=original.save;ImageStore.exportBook=original.images;URL.createObjectURL=original.create;HTMLAnchorElement.prototype.click=original.click;s.saveData();}
}
function browserFunction(name) {
  const fn=module.exports[name];if(typeof fn!=='function'||name==='browserFunction')throw Error('Unknown browser helper: '+name);
  return '('+fn.toString()+')()';
}
module.exports={runWritingDraftBrowserChecks,checkWritingDraftRestoredAndSave,checkWritingSavedRestored,runExpansionBrowserChecks,runStorageQuotaBrowserChecks,runMemoryRescueExportBrowserChecks,browserFunction};
