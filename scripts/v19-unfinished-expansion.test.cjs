'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8'),clone=v=>JSON.parse(JSON.stringify(v)),LF=String.fromCharCode(10);
const {fn,section}=require('./v19-branch-harness.cjs');
function harness(){
 let serial=0;const ref=value=>({value}),toasts=[],requests=[],saved=[];
 const c={ref,computed:f=>typeof f==='function'?{get value(){return f();}}:{get value(){return f.get();},set value(v){f.set(v);}},uid:()=> 'exp-'+(++serial),deepClone:clone,AbortController,Date,
 novel:ref({outline:'第1章 开端；第2章 旧转折',chapterCount:2,unfinishedMode:true,volumes:[{id:'v1',number:1,title:'旧卷',startChapter:1,endChapter:2,summary:'原卷纲',handoffSummaries:{main:{content:'已发生事实'}}}]}),
 chapterOutlines:ref([{id:'o1',chapterNo:1,title:'第1章 开端',content:'旧章一原文',history:[{content:'手写历史'}]},{id:'o2',chapterNo:2,title:'第2章 转折',content:'接续第1章，第2章发生旧事件'}]),visibleChapters:ref([]),chapters:ref(Array(50).fill({branchId:'other'})),
 chapterIndexDrafts:ref([{id:'i1',chapterNo:1,title:'一',goal:'旧一'},{id:'i2',chapterNo:2,title:'第2章',goal:'第2章旧二'}]),foreshadowMatrix:ref([{id:'f1',setupChapter:'1',payoffChapter:'2',resolvedChapter:''}]),
 currentBookId:ref('book'),activeBranchId:ref('main'),summaries:ref([]),staleMarks:ref([]),branchData:ref({main:{staleMarks:[]}}),
 isGeneratingOutline:ref(false),isGeneratingDO:ref(false),outlineAiEditingIdx:ref(-1),outlineAbortController:ref(null),outlineStreamPreview:ref(''),outlineStreamError:ref(''),outlineStreamDockCollapsed:ref(false),outlineStreamWorkbench:ref('outline'),showOutlineRevisionModal:ref(false),outlineReview:ref({revisions:[]}),reverseOutlineState:ref({status:'idle'}),
 requireModuleRequest:()=>({ok:true,model:'outline-fixture'}),getLatestOutlineTextForAi:()=>c.novel.value.outline,getVolumeHandoff:v=>v.handoffSummaries?.main,
 fetchAdapterCompletion:async(r,m,o)=>{requests.push(clone({r,m,stream:o.stream}));const text=JSON.stringify(c.response);o.onTextDelta(text,text);return {text};},getAdapterCompletionText:r=>r.text,parseAiStructuredJson:JSON.parse,parseVolumePlan:()=>[],
 createReviewState:(id,beforeText,afterText)=>({id,beforeText,afterText,revisions:[]}),normalizeNovelVolumes:clone,saveVolumeHandoffEdit(){},markVolumePlanStale(){},
 showToast:(...a)=>toasts.push(a),openConfirm:(config,cb)=>{c.confirm={config,cb};},saveData(){},persistReviewStates(){saved.push(clone({novel:c.novel.value,review:c.outlineReview.value,details:c.chapterOutlines.value}));},
 getReviewChangeIds:state=>state.revisions.filter(r=>r.type!==0).map(r=>r.id)};
 c.novelVolumes={get value(){return c.novel.value.volumes;}};c.outlineRevisions={get value(){return c.outlineReview.value.revisions;},set value(v){c.outlineReview.value.revisions=v;}};
 vm.createContext(c);vm.runInContext(section('    const outlineRevisions =','    const showOutlineRevisionModal =')+';globalThis.outlineRevisions=outlineRevisions;',c);
 vm.runInContext(['normalizeNovelVolumes','parseWorkbenchCount','isVolumeWorkbenchRequest','getWorkbenchChapterScope','prepareWorkbenchExpansion','inferChapterStage','getWorkbenchExpansionBaseline','remapWorkbenchChapterText','applyWorkbenchExpansion','buildWorkbenchPlanningContext','validateVolumeRanges','planWorkbenchVolumes','getWorkbenchDetailsKey','getWorkbenchVolumesKey','checkRevisionsComplete','requestOutlineReviewApply','undoOutlineRevisionApply','acceptOutlineVolumePlan','rejectOutlineVolumePlan','showOutlineVolumePlanningFailure','remapDarklineChapterReferences','parseChapterRefs','formatChapterRefs'].map(fn).join(LF)+LF+section('    const canUndoOutlineRevisionApply =','    function undoOutlineRevisionApply('),c);
 c.response={outlineAppend:'第2章 增加海港调查；第3章承接原转折',chapterPlan:[{existingChapterNo:1,content:'恶意重写旧一'}, {title:'新港口调查',content:'主角调查新的海港线索，承接第1章并衔接第3章。'},{existingChapterNo:2}],volumes:[{number:1,title:'初探',startChapter:1,endChapter:1,summary:'保留开端'},{number:2,title:'新港与转折',startChapter:2,endChapter:3,summary:'新事件后接旧转折'}]};
 return {c,toasts,requests,saved,accept(){c.acceptOutlineVolumePlan();if(c.confirm){c.confirm.cb();c.confirm=null;}}};
}
test('已有大纲与细纲可开启未完，普通书预设入口独立于白鸟锁定',()=>{
 const {c}=harness();vm.runInContext(section('    const unfinishedModeToggle =','    const reverseOutlineState =')+fn('markUnfinishedPlanComplete')+';globalThis.toggle=unfinishedModeToggle;globalThis.description=unfinishedModeDescription;',c);
 c.novel.value.unfinishedMode=false;c.toggle.value=true;assert.equal(c.novel.value.unfinishedMode,true);assert.match(c.description.value,/当前已有大纲与细纲，只能创造新内容章节/);
 assert.ok(src.indexOf('data-moyun-unfinished-mode')<src.indexOf(':aria-disabled="isSnowwingPresetLocked()'));
 c.toggle.value=false;assert.equal(c.novel.value.unfinishedMode,true);c.confirm.cb();c.toggle.value=true;assert.equal(c.novel.value.unfinishedMode,false);
});
test('区分纯重分卷与新增剧情，不把其他分支50章算进本线两章',()=>{
 const {c}=harness();assert.equal(c.getWorkbenchChapterScope('新增两卷并按剧情归类').expand,false);
 const scope=c.getWorkbenchChapterScope('新增1章海港剧情，重新分成两卷');assert.equal(scope.total,3);assert.equal(scope.existingTotal,2);assert.equal(scope.expand,true);
 assert.equal(c.getWorkbenchChapterScope('在现有章节内填充新的内容，并分成更多卷').expand,true);
 assert.equal(c.isVolumeWorkbenchRequest('追加两章新剧情'),true);
 for(const input of ['在原有章节内填充新的内容','填入新的情节','丰富主角成长过程',''])assert.equal(c.isVolumeWorkbenchRequest(input),true,input);
 c.novel.value.unfinishedMode=false;assert.equal(c.isVolumeWorkbenchRequest('润色大纲'),false);
});
test('实际新增细纲、重新分卷并在接受前保留原文，只有作者原话标记输入',async()=>{
 const h=harness(),{c,requests}=h,before=clone({novel:c.novel.value,details:c.chapterOutlines.value});
 assert.equal(await c.planWorkbenchVolumes('新增1章海港剧情，重新分成两卷'),true);
 assert.deepEqual(clone(c.novel.value),before.novel);assert.deepEqual(clone(c.chapterOutlines.value),before.details);
 assert.equal(requests[0].stream,true);assert.equal(requests[0].m.filter(m=>m._moyunUserInput).length,1);
 assert.match(requests[0].m[0].content,/chapterPlan/);assert.match(requests[0].m[0].content,/禁止写结局/);
 assert.match(requests[0].m[1].content,/已发生事实/);assert.equal(c.showOutlineRevisionModal.value,true);
 h.accept();assert.equal(c.chapterOutlines.value.length,3);assert.equal(c.chapterOutlines.value[0].content,'旧章一原文');assert.equal(c.chapterOutlines.value[0].id,'o1');
 assert.equal(c.chapterOutlines.value[2].id,'o2');assert.equal(c.chapterOutlines.value[2].content,'接续第1章，第3章发生旧事件');
 assert.match(c.chapterOutlines.value[1].content,/新.*海港/);assert.equal(c.novel.value.volumes.length,2);assert.equal(c.novel.value.chapterCount,3);
 assert.equal(c.chapterIndexDrafts.value.find(r=>r.id==='i2').chapterNo,3);assert.equal(c.foreshadowMatrix.value[0].payoffChapter,'3');
 assert.match(c.novel.value.outline,/新增剧情规划/);assert.match(c.buildWorkbenchPlanningContext(),/新港口调查/);
 c.undoOutlineRevisionApply();assert.deepEqual(clone(c.chapterOutlines.value),before.details);assert.equal(c.novel.value.outline,before.novel.outline);assert.equal(c.novel.value.chapterCount,2);
 assert.ok(c.outlineReview.value.workbenchVolumes.expansion);
});
test('拒绝与稍后序列化恢复不写入新增内容；刷新补齐UI默认值后仍可应用和撤销',async()=>{
 const h=harness(),{c,saved}=h,before=clone(c.chapterOutlines.value);await c.planWorkbenchVolumes('新增1章，分成两卷');
 const restored=clone(saved.at(-1).review);c.rejectOutlineVolumePlan();assert.deepEqual(clone(c.chapterOutlines.value),before);
 c.outlineReview.value=restored;c.novel.value.volumes=c.normalizeNovelVolumes(c.novel.value.volumes);
 c.chapterOutlines.value.forEach(row=>Object.assign(row,{isExpanded:true,aiInput:'',aiResult:''}));
 c.chapterIndexDrafts.value.forEach(row=>Object.assign(row,{stage:c.inferChapterStage(row.chapterNo,2),foreshadowTags:'',isExpanded:true}));
 c.foreshadowMatrix.value.forEach(row=>Object.assign(row,{tag:'',status:'',note:'',upgradeChapter:'',isExpanded:true}));
 h.accept();assert.equal(c.chapterOutlines.value.length,3);
 c.outlineReview.value=clone(c.outlineReview.value);
 c.chapterIndexDrafts.value.forEach(row=>{row.stage ||=c.inferChapterStage(row.chapterNo,3);row.foreshadowTags ||= '';});
 c.chapterOutlines.value.forEach(row=>{row.isExpanded=true;row.aiInput='';row.aiResult='';});
 c.undoOutlineRevisionApply();assert.equal(c.chapterOutlines.value.length,2);
});
test('没有新细纲、缺章、重排旧章、缺新章正文或范围错误均保留原规划及原始输出',async()=>{
 for(const mutate of [r=>delete r.chapterPlan,r=>r.chapterPlan.pop(),r=>r.chapterPlan.reverse(),r=>r.chapterPlan[1].content='',r=>r.volumes[1].endChapter=4]){
  const {c}=harness(),before=clone(c.novel.value);mutate(c.response);assert.equal(await c.planWorkbenchVolumes('新增1章，分成两卷'),false);
  assert.deepEqual(clone(c.novel.value),before);assert.ok(c.outlineReview.value.volumeOutputRaw);assert.equal(c.chapterOutlines.value.length,2);
 }
});
test('已写正文前插章明确拒绝，末尾追加允许',async()=>{
 const h=harness(),{c}=h;c.visibleChapters.value=[{id:'c1'},{id:'c2'}];
 assert.equal(await c.planWorkbenchVolumes('新增1章，分成两卷'),false);assert.match(c.outlineReview.value.volumeOutputError,/先.*创建分支/);
 c.outlineReview.value={revisions:[]};c.response.chapterPlan=[{existingChapterNo:1},{existingChapterNo:2},{title:'追踪',content:'在旧转折后新添追踪事件'}];
 assert.equal(await c.planWorkbenchVolumes('新增1章，分成两卷'),true);h.accept();assert.equal(c.chapterOutlines.value.length,3);assert.equal(c.visibleChapters.value.length,2);
});
test('接受期间新增正文、手改细纲、大纲或切分支都不覆盖',async()=>{
 for(const change of [c=>c.visibleChapters.value.push({id:'late'}),c=>c.chapterOutlines.value[0].content='作者新改',c=>c.novel.value.outline='新总纲',c=>c.activeBranchId.value='side',c=>c.foreshadowMatrix.value[0].note='作者新备注',c=>c.chapterIndexDrafts.value[0].foreshadowTags='新增伏笔']){
  const h=harness(),{c}=h;await c.planWorkbenchVolumes('新增1章，分成两卷');c.acceptOutlineVolumePlan();change(c);const before=clone(c.chapterOutlines.value);c.confirm.cb();
  assert.deepEqual(clone(c.chapterOutlines.value),before);assert.equal(c.novel.value.volumes.length,1);
 }
});
test('撤销不覆盖应用后手改细纲，生成时切书不弹迟到候选',async()=>{
 const h=harness(),{c}=h;await c.planWorkbenchVolumes('新增1章，分成两卷');h.accept();c.chapterOutlines.value[1].content='后来手写';c.undoOutlineRevisionApply();assert.equal(c.chapterOutlines.value[1].content,'后来手写');
 c.outlineReview.value={revisions:[]};c.fetchAdapterCompletion=async()=>{c.currentBookId.value='other';throw Error('late response');};
 assert.equal(await c.planWorkbenchVolumes('追加1章剧情'),false);assert.equal(c.outlineReview.value.volumeOutputError,undefined);
});
test('普通一键开书的预设模块可以带入未完模式',()=>{
 assert.ok(src.includes('unfinishedMode: false'));
 assert.ok(src.includes('v-model="okCfg.unfinishedMode"'));
 assert.ok(src.includes('novel.value.unfinishedMode = !!c.unfinishedMode'));
 assert.ok(src.includes('if (c.unfinishedMode) prompt +='));
 assert.ok(src.includes('novel.value.unfinishedMode = !!okCfg.unfinishedMode'));
});
