'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {branchHarness,fn,section,clone,source}=require('./v19-branch-harness.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function runtime(reply){
 const r=branchHarness(),{c}=r,requests=[],watchers=new Set(),dialogs=[],routes=[];
 Object.assign(c,{AbortController,DOMException,console,showConfirm:{value:false},confirmCfg:{value:{}},showFullscreenInput:{value:false},generateCount:{value:1},wordCountTarget:{value:2500},mobileSidebarOpen:{value:false},abortController:{value:null},priorityEnabled:null,priorityRequirement:null,settings:{value:{}},
  computed:definition=>typeof definition==='function'?{get value(){return definition();}}:{get value(){return definition.get();},set value(value){definition.set(value);}},
  watch:(get,callback)=>{const item={get,callback};watchers.add(item);return()=>watchers.delete(item);},
  cleanAIResponse:value=>String(value||''),sanitizeApiErrorDetail:value=>String(value),extractNarrativeHardConstraints:()=>[],getChapterLengthContract:()=>({targetWords:2500,promptMinWords:2000,promptMaxWords:3000}),
  connectionCenter:{value:{defaultProfileId:'default',profiles:[{id:'default',defaultModel:'gemini-default',enabled:true,adapterId:'gemini-generate',baseUrl:'https://fake.invalid/v1',lastTest:{status:'ok'}},{id:'review',defaultModel:'gemini-reviewer',enabled:true,adapterId:'gemini-generate',baseUrl:'https://fake.invalid/v1',lastTest:{status:'ok'}},{id:'writing',defaultModel:'gemini-writer',enabled:true,adapterId:'gemini-generate',baseUrl:'https://fake.invalid/v1',lastTest:{status:'ok'}}],moduleRoutes:{writing:{profileId:'writing'},'team-review':{profileId:'review'}}}},
  normalizeConnectionCenter:value=>value,getEffectiveDefaultConnectionProfile:center=>center.profiles.find(row=>row.id===center.defaultProfileId),getConnectionCredential:()=> 'test-only',isConnectionProfileAdapterSupported:()=>true,getApiBaseUrl:value=>value,
  fetchAdapterCompletion:async(request,messages,options)=>{requests.push({kind:'review',request,messages:clone(messages),options});return reply?reply(request,messages,options,c):{text:'{"changesKeyEvent":false,"reason":"只改变心理描写"}'};},
  buildChapterHistoryContext:()=>({text:'实际前文',hasSummaryContext:false}),buildFullSystemPrompt:()=> '正文规则',getSnowwingChapterStoryTime:()=>'',formatNarrativeHardConstraintPrompt:()=>'',isSnowwingPresetLocked:()=>true,promptPresets:{value:[]},getFullNsfwSystemPrompt:()=>'',getNsfwPrompt:()=>'',getDeepSeekPreludeMessages:()=>[],getNsfwInjectionMessages:()=>[],pushProtectedMessage:(messages,_state,message)=>messages.push(message),normalizeContextSettings(){},buildForeshadowPromptContext:()=> '暗线计划哨兵',collectSnowwingCotContextFromMessages:()=>({enabled:false}),buildSnowwingActiveContextPrompt:()=>'',applyPromptComposer:messages=>messages,imageGenEnabled:{value:false},imageGenKey:{value:''},
  scrollGenerationStatusToStart(){},clearGenerationBetweenTimer(){},resetModPendingGenerationToolTimeline(){},runModEventHandlers(){},prepareModMemoryRecallForGeneration:async()=>{},saveSnapshot(){},
  doGenerateOne(_url,_runId,options){const context=c.createGenerationContextSnapshot(options);requests.push({kind:'writing',request:c.getModuleRequestConfig('writing'),context,options,messages:c.buildChapterMessages({...options,...context,printLog:false})});},stopActiveGeneration(){}});
 vm.runInContext('let _confirmCb=null;'+[fn('openConfirm'),fn('execConfirm'),fn('execConfirmChoice')].join('\n')+'\nfunction cancelConfirm(){showConfirm.value=false;_confirmCb=null;}',c);
 const open=c.openConfirm;c.openConfirm=(config,callback)=>{dialogs.push(config);open(config,callback);};
 vm.runInContext(section('    const CONNECTION_MODULE_KEYS =','    const PROVIDER_TEMPLATES')+'\n'+[fn('resolveModuleConnection'),fn('getModuleRequestConfig'),fn('getCompletionsUrl')].join('\n'),c);
 const get=c.getModuleRequestConfig;c.getModuleRequestConfig=key=>{routes.push(key);return get(key);};
 vm.runInContext('let _bookScopedAiRunSequence=0;'+[fn('beginBookScopedAiRun'),fn('isBookScopedAiRunCurrent'),fn('finishBookScopedAiRun'),fn('parseAiJsonSyntax'),fn('scanAiJsonFragments'),fn('parseAiStructuredJson')].join('\n')+'\n'+section('    const priorityEnabled =','    function keepComposerFocus(')+'\nlet _remainingCount=0,_generationStopReason="",_isPreparingGenerationRecall=false,_generationRunSeq=0,_activeGenerationRun=null;\n'+[fn('createGenerationContextSnapshot'),fn('getWritingGenerationPrerequisites'),fn('beginGenerationRun'),fn('isGenerationRunCurrent'),fn('buildChapterMessages'),fn('startGeneration'),fn('obfuscateGeminiInput')].join('\n')+';globalThis.api={get enabled(){return priorityEnabled.value;},set enabled(value){priorityEnabled.value=value;},get requirement(){return priorityRequirement.value;},set requirement(value){priorityRequirement.value=value;},get busy(){return priorityReviewBusy.value;},get collapsed(){return composerCollapsed.value;},get run(){return priorityReviewRun;},togglePriorityRequirement,requestComposerAction,requestGenerationChoice,preparePriorityGeneration,finishPriorityInput};',c);
 c.chapters.value=c.chapters.value.slice(0,2);c.chapterOutlines.value[2].content='主角拒绝邀请';c.nextChapterPrompt.value='在雨夜继续故事';c.api.enabled=true;c.api.requirement='这一章多写主角的心理活动';
 return {...r,api:c.api,requests,dialogs,routes,watchers,flush(){for(const item of [...watchers])item.callback(item.get());},async choose(id){await c.execConfirmChoice(id);this.flush();await tick();},async waitDialog(){await tick();assert.equal(c.showConfirm.value,true);return c.confirmCfg.value;}};
}

test('真实startGeneration先审查再进入正文，模型走团队审查员/正文各自分区，两条输入顺序和边界正确',async()=>{
 const r=runtime();await r.c.startGeneration();assert.deepEqual(r.requests.map(row=>row.kind),['review','writing']);assert.equal(r.requests[0].request.model,'gemini-reviewer');assert.equal(r.requests[1].request.model,'gemini-writer');assert.ok(r.routes.includes('team-review'));assert.equal(r.requests[0].messages.filter(row=>row._moyunUserInput).length,1);assert.match(r.requests[0].messages[1].content,/第3章细纲：\n主角拒绝邀请/);
 const messages=r.requests[1].messages,marked=messages.filter(row=>row._moyunUserInput);assert.equal(marked.length,2);assert.match(marked[0].content,/本章剧情要求: 在雨夜继续故事/);assert.match(marked[1].content,/作者本轮优先要求.*\n这一章多写主角的心理活动/);const positions=['本章剧情要求','暗线计划哨兵','【作者本轮优先要求】','【最终执行校验】'].map(text=>messages.findIndex(row=>row.content.includes(text)));assert.deepEqual(positions.slice().sort((a,b)=>a-b),positions);assert.match(messages.filter(row=>row.role==='system').map(row=>row.content).join(''),/在不改变细纲关键事件的前提下，尽量按作者的想法和思路来写/);assert.match(messages.find(row=>row.content.startsWith('【最终执行校验】')).content,/确认已落实作者本轮优先要求/);assert.equal(r.api.busy,false);assert.equal(r.c._bookScopedAiRuns.size,0);
});

test('最高要求为空或开关关闭时零审查请求，重roll不借用未发送要求',async()=>{
 for(const mode of ['empty','disabled','reroll']){const r=runtime();if(mode==='empty')r.api.requirement='  ';else if(mode==='disabled')r.api.enabled=false;await r.c.startGeneration(mode==='reroll'?{reroll:{chapterId:'c1'}}:{});assert.deepEqual(r.requests.map(row=>row.kind),['writing'],mode);assert.ok(r.requests[0].messages.every(row=>!row.content.includes('【作者本轮优先要求】')),mode);}
});

test('冲突时只有审查请求；选择否保留两输入、原线和章节，不发正文',async()=>{
 const r=runtime(()=>({text:'{"changesKeyEvent":true,"reason":"细纲拒绝却要求答应"}'})),before=clone(r.c.chapters.value);r.api.requirement='让主角答应邀请';const running=r.c.startGeneration();const cfg=await r.waitDialog();assert.match(cfg.message,/是否要开启分支/);assert.deepEqual(clone(cfg.impactLines),['细纲拒绝却要求答应']);assert.equal(r.requests.length,1);await r.choose('no');await running;assert.equal(r.requests.length,1);assert.equal(r.api.requirement,'让主角答应邀请');assert.equal(r.c.nextChapterPrompt.value,'在雨夜继续故事');assert.equal(r.api.enabled,true);assert.deepEqual(r.c.chapters.value,before);assert.equal(r.c.activeBranchId.value,'main');assert.ok(r.toasts.some(row=>row[0].includes('请修改剧情关键内容或纲要后再试')));
});

test('冲突确认从上一章整份复制，支线可再分叉；首章从空开头分支，原线不改',async()=>{
 for(const mode of ['main','side','first']){const r=runtime(()=>({text:'{"changesKeyEvent":true,"reason":"关键事件被替换"}'}));if(mode==='side'){const parent=await r.c.forkBranch(1);assert.ok(parent);}if(mode==='first')r.c.chapters.value=[];const parentId=r.c.activeBranchId.value,before=clone(r.c.visibleChapters.value),parentPlanning=clone(r.c.chapterOutlines.value);r.api.requirement='改成答应邀请';const running=r.c.startGeneration();await r.waitDialog();await r.choose('fork');await running;const branch=r.c.branchList.value.find(row=>row.id===r.c.activeBranchId.value);assert.notEqual(branch.id,parentId);assert.equal(branch.parentId,parentId);assert.equal(branch.forkIndex,before.length-1);assert.equal(r.c.visibleChapters.value.length,before.length);assert.deepEqual(clone(r.c.visibleChapters.value.map(row=>row.content)),before.map(row=>row.content));assert.ok(r.c.visibleChapters.value.every(row=>row.branchId===branch.id&&!before.some(old=>old.id===row.id)));const writing=r.requests.find(row=>row.kind==='writing');assert.ok(writing,mode);assert.equal(writing.context.currentChapterNo,before.length+1);assert.equal(writing.context.contextChapters.length,before.length);assert.match(writing.messages.find(row=>row._moyunUserInput&&row.content.includes('作者本轮')).content,/改成答应邀请/);assert.deepEqual(clone(r.c.chapters.value.filter(row=>row.branchId===parentId)),before);assert.deepEqual(clone(r.c.branchData.value[parentId].chapterOutlines),parentPlanning);if(mode==='first')assert.equal(branch.forkChapterId,null);}
});

test('审查网络失败/坏JSON/错误字段只询问，不默许放行；明确继续才发正文',async()=>{
 for(const output of [Error('offline'),'不是JSON','{"changesKeyEvent":"false","reason":"不能用字符串"}','{"changesKeyEvent":false}'])for(const choice of ['continue','cancel']){const r=runtime(()=>{if(output instanceof Error)throw output;return{text:output};}),running=r.c.startGeneration();const cfg=await r.waitDialog();assert.match(cfg.message,/无法判断是否改动关键事件，是否仍然继续/);assert.equal(r.requests.length,1);await r.choose(choice);await running;assert.equal(r.requests.length,choice==='continue'?2:1);assert.equal(r.api.requirement,'这一章多写主角的心理活动');assert.equal(r.api.busy,false);}
});

test('审查员未单配时回默认模型，显式分区覆盖默认；费用提示对应真实可搜索设置',async()=>{
 const r=runtime();r.c.connectionCenter.value.moduleRoutes={'writing':{profileId:'writing'}};await r.c.startGeneration();assert.equal(r.requests[0].request.model,'gemini-default');assert.equal(r.requests[1].request.model,'gemini-writer');r.api.togglePriorityRequirement();assert.ok(r.toasts.some(row=>row[0]==='发送后，将额外产生一次审查员的费用，审查员可在「上下文」→「团队开书」中调整。'));assert.match(source,/target:'settings-search-team-review'.*审查员 API/);assert.match(source,/settings-search-.*route[.]key/);
});

test('确认框关闭、被替换、切书、signal中止都会结束等待，释放watcher且不发正文',async()=>{
 for(const mode of ['cancel','replace','book','abort','already-aborted']){const r=runtime(),controller=new AbortController();if(mode==='already-aborted')controller.abort();const pending=r.api.requestGenerationChoice({title:'审查询问',choices:[{id:'continue',label:'继续'}]},controller.signal);if(mode==='cancel')r.c.cancelConfirm();if(mode==='replace')r.c.openConfirm({title:'另一个确认'},()=>{});if(mode==='book')r.c.currentBookId.value='other';if(mode==='abort')controller.abort();r.flush();assert.equal(await pending,null,mode);assert.equal(r.watchers.size,0,mode);}
 const r=runtime(()=>({text:'{"changesKeyEvent":true,"reason":"冲突"}'})),running=r.c.startGeneration();await r.waitDialog();r.c.cancelConfirm();r.flush();await running;assert.equal(r.requests.length,1);assert.equal(r.api.busy,false);assert.equal(r.c._bookScopedAiRuns.size,0);
});

test('审查中停止或细纲/书/分支改变不写正文，旧输入保留，重复点击中止审查',async()=>{
 for(const mode of ['stop','outline','book','branch']){let resolve;const r=runtime(()=>new Promise(done=>resolve=done)),running=r.c.startGeneration();await tick();if(mode==='stop')await r.c.startGeneration();if(mode==='outline')r.c.chapterOutlines.value[2].content='作者新细纲';if(mode==='book')r.c.currentBookId.value='other';if(mode==='branch')r.c.activeBranchId.value='other';resolve({text:'{"changesKeyEvent":false,"reason":"只改风格"}'});await running;assert.equal(r.requests.length,1,mode);assert.equal(r.api.requirement,'这一章多写主角的心理活动');assert.equal(r.api.busy,false);}
});

test('成功后清空本轮两输入并关开关；生成失败/未调用成功收尾保留，作者中途新输入不清',async()=>{
 const r=runtime();await r.c.startGeneration();const writing=r.requests[1],ctx=writing.context;assert.equal(r.api.requirement,'这一章多写主角的心理活动');r.api.finishPriorityInput(ctx,writing.options);assert.equal(r.api.requirement,'');assert.equal(r.api.enabled,false);assert.equal(r.c.nextChapterPrompt.value,'');assert.equal(writing.options.priorityRequirement,'');const next=r.c.buildChapterMessages({...r.c.createGenerationContextSnapshot(writing.options),printLog:false});assert.ok(next.every(row=>!row.content.includes('【作者本轮优先要求】')));
 const newer=runtime();await newer.c.startGeneration();newer.api.requirement='下一轮新要求';newer.c.nextChapterPrompt.value='下一轮新剧情';newer.api.finishPriorityInput(newer.requests[1].context,newer.requests[1].options);assert.equal(newer.api.requirement,'下一轮新要求');assert.equal(newer.api.enabled,true);assert.equal(newer.c.nextChapterPrompt.value,'下一轮新剧情');
});

test('两输入合计>=10字的清空/关闭/收起均三选；取消不变，暂存保留，短输入直接执行',async()=>{
 for(const action of ['clear','close','collapse'])for(const choice of ['clear','collapse','cancel']){const r=runtime();r.c.nextChapterPrompt.value='一二三四五';r.api.requirement='六七八九十';r.c.showFullscreenInput.value=true;r.api.requestComposerAction(action);assert.deepEqual(clone(r.c.confirmCfg.value.choices.map(row=>row.id)),['clear','collapse','cancel']);await r.choose(choice);assert.equal(r.api.requirement,choice==='clear'?'':'六七八九十');assert.equal(r.c.nextChapterPrompt.value,choice==='clear'?'':'一二三四五');assert.equal(r.api.collapsed,choice!=='cancel');assert.equal(r.c.showFullscreenInput.value,choice==='cancel');}
 for(const action of ['clear','close','collapse']){const r=runtime();r.c.nextChapterPrompt.value='一二三四';r.api.requirement='五六七八九';r.c.showFullscreenInput.value=true;r.api.requestComposerAction(action);assert.equal(r.c.showConfirm.value,false);assert.equal(r.api.requirement,action==='clear'?'':'五六七八九');if(action==='collapse')assert.equal(r.api.collapsed,true);if(action==='close')assert.equal(r.c.showFullscreenInput.value,false);}
});

test('Gemini输入改写逐条保留两个作者输入，顺序/工具id独立，最终校验和范文不搬移',async()=>{
 const r=runtime();await r.c.startGeneration();const original=r.requests[1].messages,before=clone(original),rewritten=r.c.obfuscateGeminiInput(original,{replyToolReminder:'通过output_reply回复'}),tools=rewritten.filter(row=>row.role==='tool');assert.equal(tools.length,2);assert.deepEqual(tools.map(row=>JSON.parse(row.content).text),original.filter(row=>row._moyunUserInput).map(row=>row.content));assert.notEqual(tools[0].tool_call_id,tools[1].tool_call_id);assert.deepEqual(clone(original),before);assert.ok(rewritten.some(row=>row.content?.startsWith?.('【最终执行校验】')));const material=[{role:'user',content:'喜欢范文素材'},{role:'user',content:'【最终执行校验】'}];assert.deepEqual(clone(r.c.obfuscateGeminiInput(material)),material);assert.equal(rewritten.filter(row=>row.role==='user'&&row.content.includes('通过output_reply回复')).length,2);
});

test('Gemini全开/全关均走真实公共发送流程：审查JSON分片可解析，正文两输入不丢',async()=>{
 for(const enabled of [false,true]){const r=runtime(),{c}=r,wire=[];Object.assign(c,{Response,ReadableStream,TextDecoder,TextEncoder,setTimeout,clearTimeout,normalizeNoOutputTimeout:()=>45,connectionCredentials:{value:{}},extractResponseReasoningBlocks:text=>({body:String(text),thinking:''}),splitSnowwingCotParts:(cot,native)=>({cot,native})});c.settings.value={geminiTestInput:enabled,preventTruncation:enabled};
  const output='被审查的标题\n正文结果\n---剧情摘要---\n本章事实摘要';c.fetch=async(url,options)=>{const body=JSON.parse(options.body);wire.push({url,body});const reviewing=body.systemInstruction.parts[0].text.includes('关键事件审查员'),text=reviewing?JSON.stringify({changesKeyEvent:false,reason:'只增加心理描写，不改拒绝事件'}):output;const parts=enabled?[{functionCall:{name:'output_reply',args:{content:text}}}]:[{text}];const sse='data: '+JSON.stringify({candidates:[{content:{parts},finishReason:enabled?'MAX_TOKENS':'STOP'}]})+'\n\n',bytes=new TextEncoder().encode(sse);let index=0;return new Response(new ReadableStream({pull(controller){if(index>=bytes.length)controller.close();else controller.enqueue(bytes.slice(index,index+=7));}}),{headers:{'content-type':'text/event-stream'}});};
  vm.runInContext(section('    function getAdapterIdForRequest(','    async function fetchAdapterCompletion(')+section('    function extractAiUsage(data)','    const lastWritingUsage =')+section('    function getAiResponseFinishReason(','    // 中文注释：判断素材主体语言')+section('    function isAiReasoningLikePart(','    function parseAiStreamEventPayload(')+section('    function extractAiResponseErrorMessage(','    async function createApiResponseError(')+section('    function normalizeNativeReasoningPart(','    const charactersPromptString =')+'\nlet aiTextStreamSequence=0;const aiTextStreams={value:[]};\n'+fn('fetchAdapterCompletion'),c);
  const permitted=await r.api.preparePriorityGeneration();assert.ok(permitted);assert.equal(wire.length,1);const context=c.createGenerationContextSnapshot(permitted),messages=c.buildChapterMessages({...permitted,...context,printLog:false}),result=await c.fetchAdapterCompletion(c.getModuleRequestConfig('writing'),messages,{stream:true});assert.equal(result.text,output);assert.equal(wire.length,2);assert.ok(wire[0].url.includes('gemini-reviewer'));assert.ok(wire[1].url.includes('gemini-writer'));
  for(const [index,row]of wire.entries()){const parts=row.body.contents.flatMap(item=>item.parts||[]),inputs=parts.filter(item=>item.functionResponse?.name==='read_user_input').map(item=>item.functionResponse.response.text);assert.equal(inputs.length,enabled?(index===0?1:2):0);assert.equal(!!row.body.tools,enabled);if(enabled&&index===1){assert.match(inputs[0],/在雨夜继续故事/);assert.match(inputs[1],/心理活动/);}const all=JSON.stringify(row.body);assert.ok(all.includes('心理活动'));if(index===1)assert.ok(all.includes('在雨夜继续故事'));}
 }
});

test('冲突分支连续三章：只有首章携带优先要求，下一章读新章原文并递增实际章号',async()=>{
 const r=runtime(()=>({text:'{"changesKeyEvent":true,"reason":"关键事件发生变化"}'}));
 r.c.generateCount.value=3;r.api.requirement='改成答应邀请';
 const running=r.c.startGeneration();await r.waitDialog();await r.choose('fork');await running;
 const first=r.requests.find(row=>row.kind==='writing');assert.equal(first.context.currentChapterNo,3);
 for(let no=4;no<=5;no++){
  r.c.chapters.value.push({id:'completed-'+(no-1),branchId:r.c.activeBranchId.value,title:'新分支第'+(no-1)+'章',content:'本分支刚生成的第'+(no-1)+'章最新正文'});
  r.api.finishPriorityInput(first.context,first.options);
  const next=r.c.createGenerationContextSnapshot(first.options),messages=r.c.buildChapterMessages({...next,printLog:false});
  assert.equal(next.currentChapterNo,no,'连续生成必须递增实际章号');
  assert.equal(next.contextChapters.length,no-1,'前文必须包含刚生成的章节');
  assert.match(next.contextChapters.at(-1).content,new RegExp('第'+(no-1)+'章最新正文'));
  assert.equal(next.priorityRequirement,'');assert.ok(messages.every(row=>!row.content.includes('【作者本轮优先要求】')));
 }
 assert.equal(r.requests.filter(row=>row.kind==='review').length,1);
});

test('作者确认分支后细纲保存失败：不发正文请求，两输入仍可重新发送',async()=>{
 const r=runtime(()=>({text:'{"changesKeyEvent":true,"reason":"关键事件发生变化"}'}));
 const save=r.c.saveDataNow;r.c.saveDataNow=async reason=>reason==='保存作者确认的分支细纲'?false:save(reason);
 const running=r.c.startGeneration();await r.waitDialog();await r.choose('fork');await running;
 assert.equal(r.requests.filter(row=>row.kind==='writing').length,0,'分支细纲未可靠保存时不得开始付费正文请求');
 assert.equal(r.api.requirement,'这一章多写主角的心理活动');assert.equal(r.c.nextChapterPrompt.value,'在雨夜继续故事');assert.equal(r.api.enabled,true);assert.equal(r.api.busy,false);
});

test('中断续写遇关键事件冲突后开启分支，改走新正文而不拼接旧冲突草稿',async()=>{
 const r=runtime(()=>({text:'{"changesKeyEvent":true,"reason":"原稿拒绝却要求答应"}'})),continues=[];
 for(const key of ['streamContent','streamCotContent','streamNativeThinking','lastGenerationCot','lastGenerationNativeThinking'])r.c[key]={value:''};
 for(const key of ['streamToolTimeline','lastGenerationToolTimeline','interruptedHardConstraints'])r.c[key]={value:[]};
 r.c.streamCotActive={value:false};r.c.lastGenerationCotContext={value:null};r.c.interruptedCanContinue={value:true};r.c.interruptedIssue={value:null};r.c.interruptedContent={value:'旧草稿哨兵：主角已经拒绝邀请，准备永远离开。'};
 Object.assign(r.c,{normalizeInterruptedContentForContinue:String,beginWritingUsage(){},startGenTimer(){},buildContinueChapterMessages(prev,context){continues.push({prev,context});return [];},appendEnhancedMemoryRecall:()=>new Promise(()=>{})});
 vm.runInContext(fn('continueGeneration'),r.c);r.api.requirement='让主角答应邀请并留在港口';
 const running=r.c.continueGeneration();await r.waitDialog();await r.choose('fork');await running;
 assert.equal(continues.length,0,'分叉后的正文请求不能复用旧中断草稿');
 const writing=r.requests.filter(row=>row.kind==='writing');assert.equal(writing.length,1,'确认分叉后应走新正文生成');
 assert.ok(writing[0].messages.every(row=>!String(row.content).includes('旧草稿哨兵')));
 assert.equal(writing[0].context.currentChapterNo,3);assert.equal(r.requests.filter(row=>row.kind==='review').length,1,'作者已确认后不得重复付费审查');
});
