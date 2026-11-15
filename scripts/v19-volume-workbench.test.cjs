'use strict';
const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const src=fs.readFileSync(require('node:path').join(__dirname,'../source/moyun.single.html'),'utf8');
function fn(name){const start=src.search(new RegExp('    (?:async )?function '+name+'[(]'));assert.ok(start>=0,name);return src.slice(start,src.indexOf(String.fromCharCode(10)+'    }',start)+6);}
function harness(){
 const ref=value=>({value}),novel=ref({outline:'总纲原文',volumes:[{id:'v1',title:'旧卷',startChapter:1,endChapter:2,summary:'旧计划',handoffSummaries:{main:{content:'最新交接',actualOutline:'实际修正'}}}]}),calls=[];let id=0;
 const c={novel,novelVolumes:{get value(){return novel.value.volumes;}},chapterOutlines:ref([{title:'一',content:'细纲一'},{title:'二',content:'细纲二尾哨兵'}]),visibleChapters:ref([]),activeBranchId:ref('main'),currentBookId:ref('b'),isGeneratingOutline:ref(false),isGeneratingDO:ref(false),outlineAiEditingIdx:ref(-1),outlineAbortController:ref(null),outlineStreamPreview:ref(''),outlineStreamError:ref(''),outlineStreamDockCollapsed:ref(false),outlineStreamWorkbench:ref('outline'),showOutlineInMain:ref(false),showOutlineRevisionModal:ref(false),showDetailedOutlineInMain:ref(true),outlineReview:ref({revisions:[]}),reverseOutlineState:ref({status:'idle'}),
 requireModuleRequest:()=>({ok:true,model:'outline-model'}),getLatestOutlineTextForAi:()=>novel.value.outline,getVolumeHandoff:v=>v.handoffSummaries.main,fetchAdapterCompletion:async(r,m)=>{calls.push({r,m});return {text:JSON.stringify({volumes:[{number:1,title:'新卷一',startChapter:1,endChapter:1,summary:'新计划'},{number:2,title:'新卷二',startChapter:2,endChapter:2,summary:'末卷',handoff:{content:'新交接',actualOutline:'新修正'}}]})};},getAdapterCompletionText:r=>r.text,parseAiStructuredJson:JSON.parse,showToast:()=>{},AbortController,uid:()=>String(++id),deepClone:structuredClone,createReviewState:()=>({revisions:[]}),persistReviewStates:()=>{},normalizeNovelVolumes:r=>structuredClone(r),saveVolumeHandoffEdit:(v,b,h)=>{novel.value.volumes.find(x=>x.id===v.id).handoffSummaries[b]=h;},markVolumePlanStale:()=>{},applyRevisions:()=>{throw Error('卷纲审阅不能改总纲');}};
 Object.defineProperty(c,'outlineRevisions',{value:{get value(){return c.outlineReview.value.revisions;}}});vm.createContext(c);vm.runInContext(['isVolumeWorkbenchRequest','parseWorkbenchCount','getWorkbenchChapterScope','buildWorkbenchPlanningContext','validateVolumeRanges','planWorkbenchVolumes','getWorkbenchDetailsKey','getWorkbenchVolumesKey','checkRevisionsComplete'].map(fn).join('\n').replaceAll('}\\n    ','}\n    '),c);return {c,calls,novel};
}
test('工作台共用完整实时上下文，候选先审阅；拒绝不改变卷纲',async()=>{const {c,calls,novel}=harness(),before=JSON.stringify(novel.value);assert.equal(c.isVolumeWorkbenchRequest('根据现有细纲重新划分卷纲'),true);await c.planWorkbenchVolumes('重新划分卷纲');assert.equal(c.showOutlineRevisionModal.value,true);assert.equal(JSON.stringify(novel.value),before);const text=JSON.stringify(calls[0].m);for(const part of ['总纲原文','细纲一','细纲二尾哨兵','最新交接','实际修正'])assert.ok(text.includes(part),part);assert.equal(calls[0].m[2]._moyunUserInput,true);c.outlineReview.value.revisions.forEach(r=>r.status='rejected');c.checkRevisionsComplete();assert.equal(JSON.stringify(novel.value),before);assert.equal(c.showOutlineRevisionModal.value,false);});
test('接受后实时卷纲和交接更新，总纲不受损；并行修改不被候选覆盖',async()=>{const {c,novel}=harness();await c.planWorkbenchVolumes('重分卷纲');c.outlineReview.value.revisions.forEach(r=>r.status='accepted');c.checkRevisionsComplete();assert.equal(novel.value.outline,'总纲原文');assert.equal(novel.value.volumes.length,2);assert.equal(novel.value.volumes[1].handoffSummaries.main.content,'新交接');assert.match(c.buildWorkbenchPlanningContext(),/新计划/);novel.value.volumes[0].summary='需修订';await c.planWorkbenchVolumes('再分卷纲');novel.value.volumes[0].summary='作者新改';c.outlineReview.value.revisions.forEach(r=>r.status='accepted');c.checkRevisionsComplete();assert.equal(novel.value.volumes[0].summary,'作者新改');});
test('细纲批量输入也走卷纲候选审阅，提示明确普通修改范围',()=>{
 const batch=src.slice(src.indexOf('function requestDetailedOutlineGeneration'),src.indexOf('async function aiRewriteChapterOutline'));
 assert.match(batch,/isVolumeWorkbenchRequest\(doInput\.value\)/);
 const single=src.slice(src.indexOf('async function aiRewriteChapterOutline'),src.indexOf('function retryFailedDetailedOutline'));
 assert.match(single,/isVolumeWorkbenchRequest\(chapterOutlines\.value\[ci\]\?\.aiInput\)/);
 assert.match(src,/普通修改只作用于第\{\{ ci\+1 \}\}章；包含卷纲\/分卷要求时读取全书并先审阅候选/);
});
test('大纲/细纲没有正文时仍按文本章号推断卷纲范围',()=>{
 const {c}=harness();
 c.novel.value.outline='总纲：第1章开端；第10章转折；第30章收束';
 c.chapterOutlines.value=[];
 c.novel.value.volumes=[];
 const scope=c.getWorkbenchChapterScope('根据现有细纲创建三卷卷纲');
 assert.equal(scope.total,30);
 assert.equal(scope.volumeCount,3);
 assert.equal(scope.allowExpand,true);
});
test('六章细纲优先于空白默认十章卷范围',()=>{
 const {c}=harness();
 c.novel.value.volumes=[{id:'placeholder',title:'第1卷',startChapter:1,endChapter:10,summary:'',writingRequirement:'',bridge:''}];
 c.chapterOutlines.value=Array.from({length:6},(_,i)=>({title:'第'+(i+1)+'章',content:'剧情'}));
 const scope=c.getWorkbenchChapterScope('根据现有六章细纲创建三卷并归类');
 assert.equal(scope.total,6); assert.equal(scope.volumeCount,3);
});
test('大纲正文审阅完成后仍保留卷纲候选的第二次确认',()=>{
 const {c,novel}=harness();
 c.applyRevisions=()=> '已接受的大纲'; c.reportOutlineContinuityImpact=()=>{};
 c.outlineReview.value={revisions:[{id:'r1',type:1,status:'accepted'}],volumePlan:{rows:[{number:1,title:'候选卷',startChapter:1,endChapter:2}],total:2},volumeBaseline:structuredClone(novel.value.volumes)};
 c.showOutlineRevisionModal.value=true; c.checkRevisionsComplete();
 assert.equal(novel.value.outline,'已接受的大纲');
 assert.equal(c.showOutlineRevisionModal.value,true);
 assert.ok(c.outlineReview.value.volumePlan);
});
test('卷纲整理提示明确只改卷纲且范围受已有章节约束',()=>{
 assert.match(src,/你是墨韵的卷纲整理编辑，不是正文作者/);
 assert.match(src,/不能删除、重写、补写或改动任何一章细纲/);
 assert.match(src,/细纲中的关键事件必须原样保留/);
 assert.match(src,/requireModuleRequest\('outline'\)/);
 assert.match(src,/getWorkbenchChapterScope\(input\)/);
});
