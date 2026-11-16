'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8'),NL=String.fromCharCode(10);
function fn(name){const start=src.search(new RegExp('    (?:async )?function '+name+'[(]'));assert.ok(start>=0,name);return src.slice(start,src.indexOf(NL+'    }',start)+6);}
function harness(){
 let serial=0,saves=0;const toasts=[],confirms=[],clone=x=>JSON.parse(JSON.stringify(x)),ref=value=>({value});
 const c={ref,computed:fn=>({get value(){return fn();}}),watch(){},uid:()=>String(++serial),deepClone:clone,saveData(){saves++;},showToast:(...a)=>toasts.push(a),openConfirm:(cfg,cb)=>confirms.push({cfg,cb}),
 currentBookId:ref('book'),activeBranchId:ref('main'),novel:ref({title:'原书',outline:'旧大纲',volumes:[{id:'v1',number:1,title:'旧卷',startChapter:1,endChapter:2,summary:'旧卷纲',handoffSummaries:{main:{content:'交接哨兵'}}}]}),chapterOutlines:ref([{id:'d1',chapterNo:1,title:'旧标题',content:'旧细纲',history:[]}]),outlineReview:ref({volumeOutputError:'错误',revisions:[]}),showOutlineRevisionModal:ref(true),showNewBook:ref(false),
 isGenerating:ref(false),isGeneratingOutline:ref(false),isGeneratingDO:ref(false),outlineAiEditingIdx:ref(-1),oneKeyPhase:ref('done'),markVolumePlanStale(){},markOutlineNeighborsStale(){},persistCurrentBranchData(){},saveDataNow:async()=>true};
 c.novelVolumes={get value(){return c.novel.value.volumes;}};
 vm.createContext(c);const start=src.indexOf('    const manualPlanningTargets ='),end=src.indexOf('    function toggleOutlineStreamDock',start);
 vm.runInContext([fn('normalizeNovelVolumes'),fn('getWorkbenchVolumesKey'),fn('getWorkbenchDetailsKey'),fn('archiveChapterOutline'),src.slice(start,end),'this.api={openManualPlanningRecovery,closeManualPlanningRecovery,captureManualPlanningSelection,fillManualPlanningSelection,resetManualPlanningTarget,selectManualPlanningVolume,addManualPlanningAssignment,removeManualPlanningAssignment,buildManualPlanningCandidate,previewManualPlanningAssignments,applyManualPlanningAssignments,saveManualPlanningWrite,get draft(){return manualPlanningDraft.value;},get preview(){return manualPlanningPreview.value;},get visible(){return showManualPlanningRecovery.value;},get selection(){return manualPlanningSelection.value;}};'].join(NL),c);
 c.api.openManualPlanningRecovery('不可识别原文：港口来信，主角检查邮戳。');return{c,api:c.api,toasts,confirms,clone,get saves(){return saves;}};
}
function add(h,values){Object.assign(h.api.draft.editor,values);assert.equal(h.api.addManualPlanningAssignment(),true);}
test('手动选取不会改原文；可多次填入、持久保存草稿，关闭不写正式内容',()=>{
 const h=harness(),raw=h.api.draft.raw;h.api.captureManualPlanningSelection({target:{value:raw,selectionStart:9,selectionEnd:13}});const selected=raw.slice(9,13);h.api.fillManualPlanningSelection();h.api.fillManualPlanningSelection();assert.equal(h.api.draft.editor.text,selected+NL+NL+selected);assert.equal(h.api.draft.raw,raw);h.api.closeManualPlanningRecovery();assert.equal(h.api.visible,false);assert.equal(h.c.novel.value.outline,'旧大纲');assert.ok(h.c.novel.value.reviewStates.manualPlanning.main.editor.text);h.api.openManualPlanningRecovery();assert.equal(h.api.draft.editor.text,selected+NL+NL+selected);assert.ok(h.saves>0);
});
test('分配追加/替换/新卷/细纲先审阅后写入，已有卷交接和原始细纲历史保留',async()=>{
 const h=harness();add(h,{target:'outline',text:'新大纲',mode:'append'});add(h,{target:'volume',targetId:'',title:'新卷',startChapter:3,endChapter:4,text:'新卷纲'});add(h,{target:'chapter',chapterNo:1,title:'新标题',text:'新细纲',mode:'replace'});
 assert.equal(h.api.previewManualPlanningAssignments(),true);assert.equal(h.api.preview.rows.length,3);assert.equal(h.c.novel.value.outline,'旧大纲');assert.equal(h.c.novel.value.volumes.length,1);assert.equal(h.c.chapterOutlines.value[0].content,'旧细纲');assert.equal(await h.api.applyManualPlanningAssignments(),true);
 assert.equal(h.c.novel.value.outline,'旧大纲'+NL+NL+'新大纲');assert.equal(h.c.novel.value.volumes[1].summary,'新卷纲');assert.equal(h.c.novel.value.volumes[0].handoffSummaries.main.content,'交接哨兵');assert.equal(h.c.chapterOutlines.value[0].content,'新细纲');assert.equal(h.c.chapterOutlines.value[0].history[0].content,'旧细纲');assert.equal(h.api.draft.items.length,0);assert.equal(h.api.draft.lastApplied.count,3);
});
test('自动识别成功仍保留原始回复，手动采用后不再保留会覆盖手选内容的自动候选',async()=>{
 const c=vm.createContext({uid:()=> 'review',createDiffRevisions:()=>[]});vm.runInContext(fn('createReviewState'),c);
 const raw='【卷纲更新】\n第一卷：模型原始回复';const review=c.createReviewState('outline','旧大纲','识别后的内容',{rawOutput:raw});
 assert.equal(review.rawOutput,raw);
 const h=harness();h.c.outlineReview.value={...h.clone(review),volumePlan:{rows:[{title:'自动候选'}]},workbenchVolumes:{rows:[]},revisions:[{type:1,status:'pending',text:'不再采用'}]};
 h.api.openManualPlanningRecovery(raw);add(h,{target:'outline',text:'作者手动选择',mode:'replace'});h.api.previewManualPlanningAssignments();await h.api.applyManualPlanningAssignments();
 assert.equal(h.c.novel.value.outline,'作者手动选择');assert.equal(h.c.outlineReview.value.volumePlan,undefined);assert.equal(h.c.outlineReview.value.workbenchVolumes,undefined);assert.equal(h.c.outlineReview.value.revisions.length,0);assert.equal(h.c.outlineReview.value.manualRecoveryApplied,true);assert.equal(h.c.outlineReview.value.volumeOutputRaw,raw);
});
test('无效章号、空内容、重复目标被拦；跳号不会自动补写空章',()=>{
 const h=harness();Object.assign(h.api.draft.editor,{target:'chapter',chapterNo:0,text:'内容'});assert.equal(h.api.addManualPlanningAssignment(),false);Object.assign(h.api.draft.editor,{target:'outline',text:' '});assert.equal(h.api.addManualPlanningAssignment(),false);
 add(h,{target:'outline',text:'新大纲'});h.api.draft.editor.text='重复';assert.equal(h.api.addManualPlanningAssignment(),false);h.api.draft.editor.text='';h.api.removeManualPlanningAssignment(h.api.draft.items[0].id);add(h,{target:'chapter',chapterNo:3,text:'不能猜测补写第二章'});assert.equal(h.api.previewManualPlanningAssignments(),false);assert.match(h.toasts.at(-1)[0],/下一章为第2章/);assert.equal(h.c.chapterOutlines.value.length,1);
});
test('卷范围重叠时整批不写；允许同时调整旧卷后新建卷',async()=>{
 const h=harness();add(h,{target:'volume',targetId:'',title:'冲突卷',startChapter:2,endChapter:3,text:'新卷纲'});assert.equal(h.api.previewManualPlanningAssignments(),false);assert.equal(h.c.novel.value.volumes.length,1);h.api.removeManualPlanningAssignment(h.api.draft.items[0].id);
 add(h,{target:'volume',targetId:'v1',title:'旧卷调整',startChapter:1,endChapter:1,text:'调整',mode:'replace'});add(h,{target:'volume',targetId:'',title:'新卷',startChapter:2,endChapter:3,text:'新计划'});assert.equal(h.api.previewManualPlanningAssignments(),true);await h.api.applyManualPlanningAssignments();assert.equal(h.c.novel.value.volumes.length,2);assert.equal(h.c.novel.value.volumes[0].endChapter,1);
});
test('审阅期间原内容变化、切分支或更换书籍不会覆盖；重新审阅后才可写',async()=>{
 for(const change of [h=>h.c.novel.value.outline='后来手改',h=>h.c.activeBranchId.value='side',h=>h.c.currentBookId.value='other']){
  const h=harness();add(h,{target:'outline',text:'候选',mode:'replace'});h.api.previewManualPlanningAssignments();change(h);assert.equal(await h.api.applyManualPlanningAssignments(),false);assert.notEqual(h.c.novel.value.outline,'候选');
 }
 const h=harness();add(h,{target:'outline',text:'候选',mode:'replace'});h.api.previewManualPlanningAssignments();h.c.novel.value.outline='后来手改';await h.api.applyManualPlanningAssignments();assert.equal(h.api.preview,null);assert.equal(h.api.previewManualPlanningAssignments(),true);assert.equal(h.api.preview.rows[0].before,'后来手改');
});
test('保存失败保留已填内容与原文，重试保存不会重复追加',async()=>{
 const h=harness();let count=0;h.c.saveDataNow=async()=>++count>1;add(h,{target:'outline',text:'只追加一次',mode:'append'});h.api.previewManualPlanningAssignments();assert.equal(await h.api.applyManualPlanningAssignments(),false);assert.equal(h.api.draft.pendingSave,true);assert.equal(h.api.visible,true);assert.match(h.toasts.at(-1)[0],/尚未保存成功/);assert.equal(await h.api.saveManualPlanningWrite(),true);assert.equal(h.api.draft.pendingSave,false);assert.equal(h.c.novel.value.outline,'旧大纲'+NL+NL+'只追加一次');assert.ok(h.api.draft.raw);assert.equal(count,2);
});
test('生成期间不能写；未加入列表的文字不能被悄悄忽略',async()=>{
 const h=harness();add(h,{target:'outline',text:'候选'});h.api.draft.editor.text='未加入';assert.equal(h.api.previewManualPlanningAssignments(),false);h.api.draft.editor.text='';h.api.previewManualPlanningAssignments();h.c.isGenerating.value=true;assert.equal(await h.api.applyManualPlanningAssignments(),false);assert.equal(h.c.novel.value.outline,'旧大纲');
});
test('更换原文先询问草稿取舍；已填未保存时不能丢弃',()=>{
 const h=harness();h.api.draft.editor.text='整理草稿';assert.equal(h.api.openManualPlanningRecovery('新原文'),false);assert.equal(h.confirms.length,1);h.confirms[0].cb('resume');assert.match(h.api.draft.raw,/不可识别/);h.api.draft.pendingSave=true;h.api.openManualPlanningRecovery('另一原文');h.confirms[1].cb('new');assert.equal(h.api.draft.pendingSave,true);
});
test('只修改明确选中的分区，不接受未知字段；书名可单独替换',async()=>{
 const h=harness();add(h,{target:'title',text:'手动书名'});h.api.previewManualPlanningAssignments();await h.api.applyManualPlanningAssignments();assert.equal(h.c.novel.value.title,'手动书名');assert.equal(h.c.novel.value.outline,'旧大纲');assert.equal(h.c.chapterOutlines.value[0].content,'旧细纲');h.api.draft.items=[{target:'presets',text:'越界'}];assert.throws(()=>h.api.buildManualPlanningCandidate(h.api.draft),/无效分区/);
});
test('没有变化的细纲和卷纲不写入、不添历史、不标过期',async()=>{
 const h=harness();let volumeMarks=0,detailMarks=0;h.c.markVolumePlanStale=()=>volumeMarks++;h.c.markOutlineNeighborsStale=()=>detailMarks++;
 add(h,{target:'chapter',chapterNo:1,title:'旧标题',text:'旧细纲',mode:'replace'});add(h,{target:'volume',targetId:'v1',title:'旧卷',startChapter:1,endChapter:2,text:'旧卷纲',mode:'replace'});add(h,{target:'title',text:'只改书名'});assert.equal(h.api.previewManualPlanningAssignments(),true);assert.equal(h.api.preview.rows.length,1);await h.api.applyManualPlanningAssignments();assert.equal(h.c.chapterOutlines.value[0].history.length,0);assert.equal(volumeMarks,0);assert.equal(detailMarks,0);
});
test('导入成新书后可恢复原文和待填草稿，确认仍绑定当前书与分支',async()=>{
 const h=harness();add(h,{target:'outline',text:'随书导入的草稿'});const draft=h.clone(h.api.draft);h.c.currentBookId.value='imported-book';h.c.activeBranchId.value='imported-side';h.c.novel.value.reviewStates.manualPlanning={'imported-side':draft};h.api.openManualPlanningRecovery();assert.equal(h.api.draft.bookId,'imported-book');assert.equal(h.api.draft.branchId,'imported-side');assert.equal(h.api.previewManualPlanningAssignments(),true);await h.api.applyManualPlanningAssignments();assert.match(h.c.novel.value.outline,/随书导入的草稿/);
});
test('按分支导出导入时手动原文草稿一起筛选，支线提升主线后可恢复',()=>{
 const h=harness(),context={deepClone:h.clone};vm.createContext(context);vm.runInContext(fn('selectBookBranches'),context);const original={branchList:[{id:'main',createdAt:1},{id:'side',parentId:'main',createdAt:2}],novel:{reviewStates:{manualPlanning:{main:{...h.clone(h.api.draft),raw:'主线原文'},side:{...h.clone(h.api.draft),branchId:'side',raw:'支线原文'}}}}};const selected=context.selectBookBranches(original,['side']);assert.deepEqual(Object.keys(selected.novel.reviewStates.manualPlanning),['main']);assert.equal(selected.novel.reviewStates.manualPlanning.main.branchId,'main');assert.equal(selected.novel.reviewStates.manualPlanning.main.raw,'支线原文');assert.equal(original.novel.reviewStates.manualPlanning.main.raw,'主线原文');
});
test('删除分支只清理这一支的手动草稿，不影响主线原文',()=>{
 const {c}=require('./v19-branch-harness.cjs').branchHarness();c.branchList.value.push({id:'side',name:'支线',parentId:'main'});c.novel.value.reviewStates={manualPlanning:{main:{raw:'主线原文'},side:{raw:'待删除支线原文'}}};c.deleteBranch('side');c.confirm.callback();assert.equal(c.novel.value.reviewStates.manualPlanning.side,undefined);assert.equal(c.novel.value.reviewStates.manualPlanning.main.raw,'主线原文');
});
