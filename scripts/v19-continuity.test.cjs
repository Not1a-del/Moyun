'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8');
function helpers(extra={}){
 const start=source.indexOf('    function parseContinuityResult('),end=source.indexOf('    function getStaleMark(',start);
 assert.ok(start>=0&&end>start,'real continuity checker must exist');
 const context={ref:value=>({value}),computed:fn=>({get value(){return fn();}}),novel:{value:{volumes:[{id:'v1',startChapter:1,endChapter:3},{id:'v2',startChapter:4,endChapter:6}]}},activeBranchId:{value:'main'},chapterOutlines:{value:Array.from({length:6},(_,i)=>({id:'o'+(i+1),content:'第'+(i+1)+'章细纲',chapterNo:i+1}))},visibleChapters:{value:[]},settings:{value:{autoCheckContinuity:true,allowAiNeighborAdjustment:false}},currentBookId:{value:'book'},parseAiStructuredJson:JSON.parse,cleanNarrativeChapterContent:ch=>ch.content||'',getVolumeForChapter:no=>no<=3?{id:'v1'}:{id:'v2'},deepClone:value=>JSON.parse(JSON.stringify(value)),uid:()=>String(Math.random()),saveData(){},showToast(){},DOMException,buildNsfwMessages:prompt=>[{role:'user',content:prompt}],...extra};
 return new Function(...Object.keys(context),source.slice(start,end)+';return {parseContinuityResult,buildContinuityPrompt,getContinuityNeighborTargets,checkContinuity,checkGeneratedOutlineRange,markBodyContinuityStale,reportOutlineContinuityImpact,requestNeighborAdjustment,requestApplyContinuityReview,continuityState,closeContinuityCheck};')(...Object.values(context));
}
test('continuity requires explicit no-issue marker and rejects malformed/empty arrays',()=>{
 const h=helpers();assert.deepEqual(h.parseContinuityResult('【无问题】'),[]);
 const issue={location:'第4章到第5章',type:'冲突',message:'主角已离城，下一章仍在城内',suggestion:'交代返回原因'};
 assert.deepEqual(h.parseContinuityResult(JSON.stringify([issue])),[issue]);
 for(const raw of ['[]','{}','无问题','garbage','[{"message":"缺字段"}]','【无问题】还有冲突'])assert.equal(h.parseContinuityResult(raw)[0].type,'无法解读',raw);
});
test('body prompt uses only last/first 600 chars and combined outline prompt includes all edges',()=>{
 const h=helpers(),prompt=h.buildContinuityPrompt('正文',{title:'left',content:'SECRET_HEAD'+ '尾'.repeat(600)},{title:'right',content:'首'.repeat(600)+'SECRET_TAIL'});
 assert.ok(!prompt.includes('SECRET_HEAD'));assert.ok(!prompt.includes('SECRET_TAIL'));assert.ok(prompt.includes('尾'.repeat(600)));assert.ok(prompt.includes('首'.repeat(600)));
 const combined=h.buildContinuityPrompt('细纲',null,null,{pairs:[{left:{chapterNo:2,content:'locked-left'},right:{chapterNo:3,content:'generated'}},{left:{chapterNo:3,content:'generated'},right:{chapterNo:4,content:'locked-right'}}]});
 assert.ok(combined.includes('locked-left')&&combined.includes('locked-right'));assert.match(combined,/第2章到第3章/);assert.match(combined,/第3章到第4章/);
});
test('neighbor proposals only target previous/next one in same volume',()=>{
 const h=helpers();assert.deepEqual(h.getContinuityNeighborTargets(3).map(row=>row.chapterNo),[2]);assert.deepEqual(h.getContinuityNeighborTargets(5).map(row=>row.chapterNo),[4,6]);
});
test('checker makes one actual request, cancellation/book changes cannot write results',async()=>{
 let calls=0,active=true;const run={controller:new AbortController()};
 const h=helpers({beginBookScopedAiRun:()=>run,isBookScopedAiRunCurrent:()=>active,finishBookScopedAiRun(){},getModuleRequestConfig:()=>({ok:true}),fetchAdapterCompletion:async()=>{calls++;return {text:'【无问题】'};}});
 assert.deepEqual(await h.checkContinuity('细纲',{content:'前章'},{content:'后章'}),[]);assert.equal(calls,1);
 active=false;await assert.rejects(h.checkContinuity('细纲',{content:'前章'},{content:'后章'}),{name:'AbortError'});
});

test('combined range check uses one request; disabling guard makes none',async()=>{
 let calls=0,prompt='';const run={controller:new AbortController()},settings={value:{autoCheckContinuity:true}},outlines={value:Array.from({length:6},(_,i)=>({id:'o'+(i+1),content:'细纲'+(i+1)}))};
 const h=helpers({settings,chapterOutlines:outlines,beginBookScopedAiRun:()=>run,isBookScopedAiRunCurrent:()=>true,finishBookScopedAiRun(){},getModuleRequestConfig:()=>({ok:true}),fetchAdapterCompletion:async(_request,messages)=>{calls++;prompt=messages[0].content;return {text:'【无问题】'};}});
 await h.checkGeneratedOutlineRange([3,4]);assert.equal(calls,1);for(const edge of ['第2章到第3章','第3章到第4章','第4章到第5章'])assert.ok(prompt.includes(edge));assert.equal(outlines.value[2].continuityStatus,'ok');
 settings.value.autoCheckContinuity=false;await h.checkGeneratedOutlineRange([3,4]);assert.equal(calls,1);
});
test('body replacement marks next body/detail and expires an existing volume handoff',()=>{
 const marks=[],h=helpers({visibleChapters:{value:[{id:'c1'},{id:'c2'}]},markStale:(...args)=>marks.push(args),getVolumeHandoff:()=>({content:'old'})});
 h.markBodyContinuityStale({id:'c1'},1);assert.deepEqual(marks.map(row=>row.slice(0,2)),[['正文','c2'],['细纲','o2'],['卷末交接','v1']]);
});
test('outline impact compares volume ranges and summaries and only marks affected detail slots',()=>{
 const marks=[],h=helpers({markStale:(...args)=>marks.push(args)}),before=[{id:'v1',startChapter:1,endChapter:3,summary:'old'},{id:'v2',startChapter:4,endChapter:6,summary:'same'}],after=[{...before[0],summary:'new'},before[1]];
 const impact=h.reportOutlineContinuityImpact(before,after);assert.equal(impact.volumes,1);assert.equal(impact.chapters,3);assert.deepEqual(impact.chapterNos,[1,2,3]);assert.deepEqual(marks.filter(row=>row[0]==='细纲').map(row=>row[1]),['o1','o2','o3']);
});
test('neighbor proposals persist review drafts and require explicit per-chapter confirmation',async()=>{
 const novel={value:{}},outlines={value:Array.from({length:6},(_,i)=>({id:'o'+(i+1),content:'原稿'+(i+1),chapterNo:i+1}))},run={controller:new AbortController()};let confirm=null,calls=0;
 const h=helpers({novel,chapterOutlines:outlines,settings:{value:{allowAiNeighborAdjustment:true}},beginBookScopedAiRun:()=>run,isBookScopedAiRunCurrent:()=>true,finishBookScopedAiRun(){},getModuleRequestConfig:()=>({ok:true}),requestOutlineAi:async()=>{calls++;return {text:JSON.stringify([{chapterNo:2,content:'调整第二章'},{chapterNo:4,content:'越卷内容'}])};},parseAiStructured:raw=>({items:JSON.parse(raw).map(value=>({value,issue:''}))}),createReviewState:(id,oldText,newText)=>({revisions:[{id:'r',type:1,status:'pending',text:newText}]}),getReviewChangeIds:()=>['r'],openConfirm:(_cfg,cb)=>{confirm=cb;},archiveChapterOutline(){},applySelectedReview:state=>{state.revisions[0].status='accepted';return {applied:1,text:state.revisions[0].text};},markStale(){}});
 await h.requestNeighborAdjustment(3);assert.equal(calls,1);assert.equal(novel.value.reviewStates.continuity.rows.length,1);assert.equal(outlines.value[1].content,'原稿2');
 const row=novel.value.reviewStates.continuity.rows[0];h.requestApplyContinuityReview(row);assert.ok(confirm);assert.equal(outlines.value[1].content,'原稿2');confirm();assert.equal(outlines.value[1].content,'调整第二章');assert.equal(outlines.value[3].content,'原稿4');assert.equal(calls,1,'applying must not trigger recursive AI');
});
test('inline continuity markers reject duplicate/contradictory conclusions',()=>{
 const start=source.indexOf('    function parseOutlineContinuity('),end=source.indexOf('    function parseGeneratedDetailedOutlines(',start),parse=new Function(source.slice(start,end)+';return parseOutlineContinuity;')();
 assert.equal(parse('正文\n【无问题】',true).continuityStatus,'ok');assert.equal(parse('正文',true).continuityStatus,'unreadable');assert.equal(parse('正文\n【无问题】还有冲突',true).continuityStatus,'unreadable');assert.equal(parse('正文\n【无问题】\n【衔接提示】冲突',true).continuityStatus,'unreadable');
});

test('batch streaming success commits once with history; failure leaves old content and history intact',async()=>{
 const extract=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from))),old={id:'o1',title:'旧题',content:'旧细纲',history:[]};
 async function run(fail){
   const refs={chapterOutlines:{value:[JSON.parse(JSON.stringify(old))]},settings:{value:{detailedOutlineOnlyEmpty:false,autoCheckContinuity:false}},novel:{value:{outline:'大纲'}},currentBookId:{value:'book'},outlineAiEditingIdx:{value:-1},singleDetailedOutlineAbortController:{value:null},isGeneratingDO:{value:false},detailedOutlineAbortController:{value:null},detailedOutlineRun:{value:{}},doStart:{value:1},doEnd:{value:1},wordCountTarget:{value:3000},outlineStreamPreview:{value:''},aiSupplementSegmentProgress:{value:''},showDetailedOutlineInMain:{value:true}};
   const noop=()=>{},context={...refs,AbortController,DOMException,console:{warn:noop},getModuleRequestConfig:()=>({ok:true}),confirmStorageHeadroom:async()=>true,requireModelForModule:()=> 'fake',createOutlineAbortError:()=>new DOMException('stop','AbortError'),clearAiSupplementSegmentProgress:noop,resetDetailedOutlineRun:()=>{refs.detailedOutlineRun.value={written:0,skipped:0,failed:0,failedChapters:[],failedBatches:[],fallbackCount:0};},setChapterOutlineRunState:noop,formatDetailedOutlineBatchLabel:()=> '第1章',deepClone:value=>JSON.parse(JSON.stringify(value)),buildDetailedOutlineBatchPrompt:()=> 'prompt',requestOutlineAi:async(_prompt,options)=>{options.onTextDelta('', 'stream');if(fail)throw Error('fixture failure');return {text:'new'};},cleanAIResponse:value=>value,applyDetailedOutlineStreamDelta:()=>{refs.chapterOutlines.value[0].content='流式临时稿';refs.chapterOutlines.value[0]._streamed=true;},assertOutlineRunActive:noop,parseGeneratedDetailedOutlines:()=>[{id:'generated',title:'新题',content:'新细纲',chapterNo:1}],analyzeDetailedOutlineQuality:()=>({status:'ok'}),markOutlineNeighborsStale:noop,saveData:noop,showToast:noop,isOutlineAbortError:error=>error.name==='AbortError',getChapterOutlineRunStatus:()=>'',uid:()=> 'id'};
   const code='let detailedOutlineRunSequence=0,activeDetailedOutlineRunId=0,closeDetailedOutlineAfterStop=false;'+extract('    function archiveChapterOutline(', '    function normalizeStaleMarks(')+extract('    function mergeGeneratedDetailedOutlines(', '    // 中文注释：「只补空白」取消勾选后')+extract('    async function generateDetailedOutline(', '    /* ═══ 章节系统 ═══ */')+';return generateDetailedOutline;';
   await new Function(...Object.keys(context),code)(...Object.values(context))();return refs.chapterOutlines.value[0];
 }
 const failed=await run(true);assert.deepEqual(failed,old);
 const success=await run(false);assert.equal(success.content,'新细纲');assert.equal(success.id,'o1');assert.equal(success.history.length,1);assert.equal(success.history[0].content,'旧细纲');assert.equal(success.history[0].title,'旧题');assert.equal(Object.hasOwn(success,'_streamed'),false);
});
test('overwrite input keeps warning, accepts blank requirements and exposes both continuity options',()=>{
 const start=source.indexOf('    function requestDetailedOutlineGeneration('),end=source.indexOf('    // 中文注释：单章细纲',start);let cfg,callback,generated=0;
 const state={getDetailedOutlineAiDisabledReason:()=>'',showToast(){},settings:{value:{detailedOutlineOnlyEmpty:false}},doStart:{value:1},doEnd:{value:2},chapterOutlines:{value:[{content:'old'}]},doInput:{value:'old direction'},openInputPrompt:(options,cb)=>{cfg=options;callback=cb;},generateDetailedOutline:()=>{generated++;},saveData(){}};
 const invoke=new Function(...Object.keys(state),source.slice(start,end)+';return requestDetailedOutlineGeneration;')(...Object.values(state));invoke();assert.match(cfg.message,/旧稿保存在各章历史里/);assert.equal(cfg.multiline,true);assert.equal(cfg.checks.length,2);callback('',{check:false,adjust:true});assert.equal(state.doInput.value,'');assert.equal(generated,1);assert.equal(state.settings.value.autoCheckContinuity,false);
});

