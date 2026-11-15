'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const {branchHarness,fn,section}=require('./v19-branch-harness.cjs');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));

test('细纲无正文也能创建并进入独立分支，规划按所选章截断；正文入口无效时说明原因',async()=>{
  const {c,toasts}=branchHarness();c.chapters.value=[];
  const branch=await c.forkBranch(2,null,false,{planning:true});
  assert.ok(branch);assert.equal(c.activeBranchId.value,branch.id);assert.equal(c.visibleChapters.value.length,0);
  assert.deepEqual(clone(c.chapterOutlines.value.map(row=>row.chapterNo)),[1,2,3]);
  assert.ok(toasts.some(row=>row[0].includes('已创建并进入')));
  const nested=await c.forkBranch(1,null,false,{planning:true});assert.equal(nested.parentId,branch.id);
  assert.deepEqual(clone(c.chapterOutlines.value.map(row=>row.chapterNo)),[1,2]);
  const before=c.branchList.value.length;assert.equal(await c.forkBranch(0),false);assert.equal(c.branchList.value.length,before);
  assert.match(toasts.at(-1)[0],/尚无正文.*细纲/);
});

test('主支线各2章时插入第3章的标题、角色状态和记忆事件均用支线章号3',async()=>{
  const {c}=branchHarness();c.chapters.value=c.chapters.value.slice(0,2);const branch=await c.forkBranch(1);
  Object.assign(c,{buildDefaultChapterTitle:no=>'第'+no+'章',remapDarklineChapterReferences:()=>0,remapSummaryChapterRanges:()=>({}),describeSummaryRemapResult:()=>'',runModEventHandlers(){},nextTick:fn=>fn(),scrollToChapter(){}});
  vm.runInContext(fn('insertChapterAt'),c);c.insertChapterAt(2);const chapter=c.visibleChapters.value[2];
  assert.equal(chapter.title,'第3章');assert.equal(chapter.tempTitle,'第3章');assert.equal(chapter.branchId,branch.id);
  chapter.content='林远平静地发现了旧灯背后的线索，决定继续追查。';
  const bible={world:{events:[],entries:[]}};
  Object.assign(c,{settings:{value:{}},ensureStoryBible:()=>bible,normalizeStoryBibleEvent:row=>row,cleanNarrativeChapterContent:row=>row.content,structuredCharacters:{value:[{name:'林远',desc:'寻灯人'}]},escapeRegExp:value=>value});
  vm.runInContext(fn('updateStoryMemoryFromChapter'),c);c.updateStoryMemoryFromChapter(chapter);
  assert.equal(c.structuredCharacters.value[0].stateLog[0].chapter,3);
  assert.ok(bible.world.events.length>0);assert.ok(bible.world.events.every(row=>row.chapterNo===3));
});

test('自动总结仅统计当前分支章数，不把其他分支算进触发范围',()=>{
  const c=vm.createContext({autoSummaryConfig:{value:{enabled:true,frequency:2}},visibleChapters:{value:[{},{}]},chapters:{value:Array(20).fill({})},summaryStart:{},summaryEnd:{},showToast(){},setTimeout:fn=>fn(),generateSummaryRange(){c.generated=true;}});
  vm.runInContext(fn('checkAutoSummary'),c);c.checkAutoSummary();assert.equal(c.summaryEnd.value,2);
});

test('关闭未完先确认，取消不改数据，确认不能重开；切书后旧确认不影响新书',()=>{
  const c=vm.createContext({novel:{value:{unfinishedMode:true,planReminded:[10]}},chapterOutlines:{value:[]},currentBookId:{value:'a'},computed:definition=>typeof definition==='function'?{get value(){return definition();}}:{get value(){return definition.get();},set value(v){definition.set(v);}},openConfirm:(cfg,cb)=>{c.dialog={cfg,cb};},showToast(){},saveData(){c.saved=true;},ref:value=>({value})});
  vm.runInContext(section('    const unfinishedModeToggle =','    const reverseOutlineState =')+fn('markUnfinishedPlanComplete')+';globalThis.toggle=unfinishedModeToggle;',c);
  c.toggle.value=false;assert.equal(c.novel.value.unfinishedMode,true);assert.match(c.dialog.cfg.message,/关闭后不可返回/);
  c.dialog.cb();assert.equal(c.novel.value.unfinishedMode,false);assert.equal(c.novel.value.unfinishedModeClosed,true);
  c.toggle.value=true;assert.equal(c.novel.value.unfinishedMode,false);
  c.novel.value={unfinishedMode:true};c.toggle.value=false;c.currentBookId.value='b';c.dialog.cb();assert.equal(c.novel.value.unfinishedMode,true);
});

function senderHarness(adapterId,model='other-model'){
  const calls=[],deltas=[],toasts=[];let respond;
  const request={ok:true,model,adapterId,url:adapterId==='anthropic-messages'?'https://mock.invalid/v1/messages':'https://mock.invalid/v1/chat/completions',apiKey:'test-only'};
  const c=vm.createContext({Response,ReadableStream,TextDecoder,TextEncoder,AbortController,DOMException,console,setTimeout,clearTimeout,normalizeNoOutputTimeout:()=>45,uid:()=> 'feedback-fixture',settings:{value:{}},connectionCredentials:{value:{}},oneKeyAutoRetry:{value:true},okStream:{value:''},showToast:(...args)=>toasts.push(args),saveData(){},getModuleRequestConfig:()=>request,
    teamBrief:{value:'团队开书用户想法'},fetch:async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return respond(init);},cleanAIResponse:t=>String(t).trim(),extractResponseReasoningBlocks:t=>({body:String(t),thinking:''}),splitSnowwingCotParts:(cot,native)=>({cot,native}),buildNsfwMessages:prompt=>[{role:'user',content:prompt}]});
  vm.runInContext(section('    function getAdapterIdForRequest(','    function stripSnowwingContextBlocks(')+section('    function extractAiUsage(data)','    const lastWritingUsage =')+section('    function getAiResponseFinishReason(','    // 中文注释：判断素材主体语言')+section('    function isAiReasoningLikePart(','    function parseAiStreamEventPayload(')+section('    function extractAiResponseErrorMessage(','    async function createApiResponseError(')+section('    function normalizeNativeReasoningPart(','    const charactersPromptString =')+fn('markRetryableAiError')+fn('isRetryableAiRequestError')+fn('okStreamFetch'),c);
  return {c,calls,deltas,toasts,respond:value=>{respond=value;},send:signal=>c.okStreamFetch('团队开书用户想法','team-planner',signal,{onTextDelta:(_delta,full)=>deltas.push(full)})};
}
function wire(events,fail){const bytes=new TextEncoder().encode(events);let sent=false;return new Response(new ReadableStream({pull(controller){if(!sent){sent=true;controller.enqueue(bytes);}else if(fail)controller.error(fail);else controller.close();}}),{headers:{'content-type':'text/event-stream'}});}
test('团队及一键开书仅标记作者原话，任务格式不冒充用户输入',async()=>{
  const requests=[],c=vm.createContext({teamBrief:{value:'林远寻找旧灯'},oneKeyAutoRetry:{value:false},okStream:{value:''},getModuleRequestConfig:()=>({ok:true,model:'gemini-fixture'}),buildNsfwMessages:content=>[{role:'user',content}],fetchAdapterCompletion:async(_request,messages)=>{requests.push(clone(messages));return {text:'足够长的有效输出内容，供用户查看。'};},getAdapterCompletionText:r=>r.text});
  vm.runInContext(fn('okStreamFetch'),c);
  await c.okStreamFetch('只返回 JSON。用户原话：\n林远寻找旧灯','team-planner');
  await c.okStreamFetch('只生成角色模板。','character',undefined,{authorInput:'守灯人的说话方式要克制'});
  for(const messages of requests){assert.equal(messages.length,2);assert.equal(messages[0]._moyunUserInput,undefined);assert.equal(messages[1]._moyunUserInput,true);}
  assert.equal(requests[0][1].content,'林远寻找旧灯');assert.equal(requests[1][1].content,'守灯人的说话方式要克制');assert.ok(!requests[0][0].content.includes('林远寻找旧灯'));
});
for(const adapterId of ['openai-compatible','anthropic-messages'])test(adapterId+' 团队开书真实公共发送器启用流式，完成前回调；截断及网络中断保留原文且不重复请求',async()=>{
  const event=adapterId==='anthropic-messages'? text=>'data: '+JSON.stringify({type:'content_block_delta',delta:{type:'text_delta',text}})+'\n\n':text=>'data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\n';
  const raw='{"titleCandidates":["雾港"],"worldView":"流式世界观哨兵"}';
  const h=senderHarness(adapterId);h.respond(()=>wire(event(raw.slice(0,20))+event(raw.slice(20))));
  assert.equal(await h.send(),raw);assert.equal(h.calls[0].body.stream,true);assert.ok(h.deltas.length>=2);assert.equal(h.c.okStream.value,raw);
  const aborted=senderHarness(adapterId);aborted.respond(()=>wire(event(raw.slice(0,30)),new DOMException('传输停止','AbortError')));
  await assert.rejects(aborted.send(),e=>e.name==='AbortError'&&e.partialText===raw.slice(0,30));assert.equal(aborted.calls.length,1);assert.equal(aborted.c.okStream.value,raw.slice(0,30));
  const truncated=senderHarness(adapterId),finish=adapterId==='anthropic-messages'?{type:'message_delta',delta:{stop_reason:'max_tokens'}}:{choices:[{delta:{},finish_reason:'length'}]};
  truncated.respond(()=>wire(event(raw.slice(0,35))+'data: '+JSON.stringify(finish)+'\n\n'));
  await assert.rejects(truncated.send(),e=>e.partialText===raw.slice(0,35));assert.equal(truncated.calls.length,1);
});
