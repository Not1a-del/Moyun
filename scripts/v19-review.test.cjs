'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../source/moyun.single.html'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
function extract(from, to) {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `Cannot extract ${from}`);
  return source.slice(start, end);
}
function reviewContext(extra = {}) {
  let sequence=0;
  const staleMarkCalls=[],staleMarks={value:[]};
  const ctx = vm.createContext({ uid:()=>`r${++sequence}`, deepClone:clone, activeBranchId:{value:'main'}, chapterOutlines:{value:[]},summaries:{value:[]},staleMarks,staleMarkCalls,showOutlineRevisionModal:{value:false},markStale:(...args)=>{staleMarkCalls.push(args);staleMarks.value.push(args);}, ...extra });
  vm.runInContext(extract('    function createDiffRevisions(', '    // 中文注释：修订一旦审完'), ctx);
  vm.runInContext(extract('    function reportOutlineContinuityImpact(', '    async function replanEmptyOutlinesAfterOutlineReview('),ctx);
  return ctx;
}
function sample() {
  return { revisions:[
    {id:'same',type:0,text:'前言',status:'accepted'},
    {id:'delete',type:-1,text:'原文',status:'pending',selected:false},
    {id:'insert',type:1,text:'新文',status:'pending',selected:false},
    {id:'tail',type:1,text:'结尾',status:'pending',selected:true}
  ] };
}
test('partial application keeps every unselected original character', () => {
  const ctx=reviewContext(), state=sample();
  const result=ctx.applySelectedReview(state, '前言原文');
  assert.equal(result.text,'前言原文结尾');
  assert.equal(state.revisions[1].status,'pending');
  assert.equal(state.revisions[2].status,'pending');
});
test('blocked changes cannot be selected or accepted; reason is optional', () => {
  const ctx=reviewContext();
  const state=ctx.createReviewState('blocked','旧文','新文',{issue:'无法定位'});
  assert.ok(state.revisions.filter(r=>r.type!==0).every(r=>r.selected===false));
  ctx.setReviewSelection(state,state.revisions[0].id,true);
  assert.equal(state.revisions[0].selected,false);
  assert.equal(ctx.applySelectedReview(state,'旧文').text,'旧文');
  const allowed=ctx.createReviewState('allowed','旧文','新文');
  assert.equal(ctx.applySelectedReview(allowed,'旧文').text,'新文');
});
test('reject all ignores checkboxes and preserves original text', () => {
  const ctx=reviewContext(), state=sample();
  ctx.rejectReviewChanges(state);
  assert.equal(ctx.applyRevisions(state.revisions),'前言原文');
  assert.ok(state.revisions.filter(r=>r.type!==0).every(r=>r.status==='rejected'));
});
test('review candidates and undo survive book round trip without saving input history', () => {
  const refs={novel:{value:{}},outlineReview:{value:{id:'outline',revisions:[{id:'a',type:1,text:'待审',status:'pending'}],undo:{outline:'旧文'}}},reverseOutlineState:{value:{status:'idle'}},settingsRevisionState:{value:{status:'review',rows:[{id:'candidate',reason:'统一名称',review:{revisions:[]}}],undo:{bookId:'book1'},error:''}},settingsRevisionPrompt:{value:'不会存档的要求'},settingsRevisionSelectedIds:{value:['a']},settingsRevisionSelectionReady:{value:true},settingsRevisionScopeOpen:{value:true},settingsRevisionBusy:{value:false},saveData:()=>{}};
  const ctx=reviewContext(refs);
  vm.runInContext(extract('    function persistReviewStates(', '    function getSettingsRevisionTargets('),ctx);
  ctx.persistReviewStates();
  const saved=clone(refs.novel.value);
  assert.equal(saved.reviewStates.settings.rows[0].id,'candidate');
  assert.doesNotMatch(JSON.stringify(saved),/不会存档/);
  ctx.restoreReviewStates({novel:{},outlineRevisions:[]});
  assert.equal(refs.settingsRevisionState.value.rows.length,0);
  assert.equal(refs.outlineReview.value.revisions.length,0);
  ctx.restoreReviewStates({novel:saved});
  assert.equal(refs.outlineReview.value.undo.outline,'旧文');
  assert.equal(refs.settingsRevisionState.value.rows[0].id,'candidate');
});
test('outline and settings use the registered shared review component', () => {
  assert.ok(/components:\s*\{[^}]*\bReviewPanel\b/.test(source),'shared component is registered');
  assert.ok(/<review-panel[^\n]*:state="outlineReview"/.test(source),'outline uses shared component');
  assert.ok(/<review-panel[^\n]*:state="row.review"/.test(source),'settings uses shared component');
  assert.ok(!/const selectedRevId = ref/.test(source),'legacy selection state removed');
  assert.ok(!/v-for="rev in outlineRevisions"/.test(source),'legacy template removed');
});
function settingsContext(extra={}) {
  const ctx=reviewContext({
    novel:{value:{worldView:'古港以旧月石驱动。',synopsis:'保留的简介。'}},storyBible:{value:null},currentBookId:{value:'book1'},activeBranchId:{value:'main'},
    settingsRevisionState:{value:{status:'review',rows:[],undo:null,error:''}},settingsRevisionTargets:{value:[]},settingsRevisionSelectedIds:{value:[]},settingsRevisionSelectionReady:{value:false},settingsRevisionScopeOpen:{value:false},
    computed:fn=>({get value(){return fn();}}),cleanAIResponse:value=>String(value||''),persistReviewStates:()=>{},showToast:()=>{},saveData:()=>{},touchStoryBible:()=>{},saveSnapshot:async()=>({ok:true}),...extra
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/vendor/diff_match_patch.js'),'utf8'),ctx);
  vm.runInContext(extract('    function getSettingsRevisionTargets(', '    // 中文注释：v0.0.10 req2'),ctx);
  ctx.settingsRevisionTargets.value=ctx.getSettingsRevisionTargets();
  return ctx;
}
function addCandidate(ctx, value) {
  const row=ctx.makeSettingsRevisionRow({value},ctx.settingsRevisionState.value.rows.length,new Set(['novel:worldView']));
  ctx.settingsRevisionState.value.rows.push(row);return row;
}
test('settings candidate accepts an optional reason and blocks unselected or ambiguous targets',()=>{
  const ctx=settingsContext();
  const row=addCandidate(ctx,{target:'novel:worldView',original:'旧月石',newText:'潮汐'});
  assert.equal(row.canApply,true);assert.equal(row.reason,'');
  const blocked=addCandidate(ctx,{target:'novel:synopsis',original:'保留',newText:'更改'});
  assert.match(blocked.issue,/超出范围/);assert.equal(blocked.canApply,false);
  assert.ok(blocked.review.revisions.every(r=>r.selected===false));
  ctx.novel.value.worldView='月石和月石';ctx.settingsRevisionTargets.value=ctx.getSettingsRevisionTargets();
  const repeated=addCandidate(ctx,{target:'novel:worldView',original:'月石',newText:'潮汐'});
  assert.match(repeated.issue,/多处匹配/);assert.equal(repeated.canApply,false);
});
test('settings generation sends full selected text, short unselected reference and discards response raw',async()=>{
  let sent,repairOptions;const run={controller:new AbortController()};
  const ctx=settingsContext({settingsRevisionBusy:{value:false},settingsRevisionPrompt:{value:'统一力量来源'},settingsRevisionSelectionReady:{value:true},settingsRevisionSelectedIds:{value:['novel:worldView']},getModuleRequestConfig:()=>({ok:true}),beginBookScopedAiRun:()=>run,isBookScopedAiRunCurrent:()=>true,finishBookScopedAiRun:()=>{},getAdapterCompletionText:()=> 'RAW_RESPONSE_SENTINEL',fetchAdapterCompletion:async(request,messages)=>{sent=messages[0].content;return {};},repairAiStructured:async(raw,options)=>{repairOptions=options;assert.equal(raw,'RAW_RESPONSE_SENTINEL');return {items:[{value:{target:'novel:worldView',original:'旧月石',newText:'潮汐'}}],errors:[]};}});
  ctx.novel.value.synopsis='未选简介'.repeat(40);ctx.settingsRevisionTargets.value=ctx.getSettingsRevisionTargets();
  await ctx.generateSettingsRevision();
  const permitted=JSON.parse(sent.split('【允许修改目标，全文】\n')[1].split('\n【仅供参考，不允许修改】')[0]);
  const reference=JSON.parse(sent.split('【仅供参考，不允许修改】\n')[1].split('\n仅输出')[0]);
  assert.equal(permitted.length,1);assert.equal(permitted[0].text,'古港以旧月石驱动。');
  assert.equal(reference.find(row=>row.target==='novel:synopsis').excerpt.length,60);
  assert.equal(repairOptions.signal,run.controller.signal);assert.ok(repairOptions.isCurrent());
  assert.equal(ctx.settingsRevisionState.value.status,'review');assert.doesNotMatch(JSON.stringify(ctx.settingsRevisionState.value),/RAW_RESPONSE_SENTINEL|统一力量来源/);
});
test('settings selected application confirms deletion, creates snapshot and restores field plus candidate on undo',async()=>{
  let confirmation, snapshotCount=0;
  const ctx=settingsContext({openConfirm:(options,apply)=>{confirmation={options,apply};},saveSnapshot:async label=>{assert.equal(label,'设定修改前');snapshotCount++;return {ok:true};}});
  const row=addCandidate(ctx,{target:'novel:worldView',original:'旧月石',newText:'潮汐',reason:'统一来源'});
  const first=row.review.revisions.find(r=>r.type!==0);
  assert.equal(ctx.getReviewChangeIds(row.review,first.id).length,2,'replacement is reviewed together');
  ctx.requestApplySettingsRevision(true);
  assert.ok(confirmation.options.impactLines.some(line=>/删除 1 段、共 3 字/.test(line)));
  assert.equal(ctx.novel.value.worldView,'古港以旧月石驱动。');
  await confirmation.apply();
  assert.equal(snapshotCount,1);assert.equal(ctx.novel.value.worldView,'古港以潮汐驱动。');assert.equal(ctx.novel.value.synopsis,'保留的简介。');
  assert.equal(ctx.undoSettingsRevision(),true);assert.equal(ctx.novel.value.worldView,'古港以旧月石驱动。');
  assert.ok(ctx.settingsRevisionState.value.rows[0].review.revisions.some(r=>r.status==='pending'));
});
test('unusable settings reply exposes raw fallback and manual JSON only stages safe review candidates',async()=>{
  let fallback,attempts=0,rawSeen;const run={controller:new AbortController()};
  const ctx=settingsContext({settingsRevisionBusy:{value:false},settingsRevisionPrompt:{value:'统一力量来源'},settingsRevisionSelectionReady:{value:true},settingsRevisionSelectedIds:{value:['novel:worldView']},getModuleRequestConfig:()=>({ok:true}),beginBookScopedAiRun:()=>run,isBookScopedAiRunCurrent:()=>true,finishBookScopedAiRun:()=>{},getAdapterCompletionText:()=> 'INVALID_RAW_SENTINEL',fetchAdapterCompletion:async()=>{attempts++;return {};},repairAiStructured:async()=>({items:[],errors:[{message:'格式无法识别'}]}),openAiFormatFallback:(raw,options)=>{rawSeen=raw;fallback=options;}});
  vm.runInContext(extract('    function parseAiJsonSyntax(', '    async function repairAiStructured('),ctx);
  await ctx.generateSettingsRevision();
  assert.equal(rawSeen,'INVALID_RAW_SENTINEL');assert.equal(attempts,1);assert.equal(ctx.settingsRevisionBusy.value,false);assert.equal(fallback.isCurrent(),true);assert.equal(ctx.novel.value.worldView,'古港以旧月石驱动。');
  assert.equal(fallback.adopt('仍然不是 JSON'),false);assert.equal(ctx.settingsRevisionState.value.rows.length,0);
  assert.equal(fallback.adopt('[{"target":"novel:worldView","original":"旧月石","newText":"潮汐"}]'),true);
  assert.equal(ctx.settingsRevisionState.value.status,'review');assert.equal(ctx.settingsRevisionState.value.rows[0].canApply,true);assert.equal(ctx.novel.value.worldView,'古港以旧月石驱动。');
  assert.doesNotMatch(JSON.stringify(ctx.settingsRevisionState.value),/INVALID_RAW_SENTINEL|统一力量来源/);
  ctx.activeBranchId.value='other';assert.equal(fallback.isCurrent(),false);ctx.activeBranchId.value='main';ctx.novel.value={worldView:'第二本书'};assert.equal(fallback.isCurrent(),false);
});
test('settings rejects a candidate without touching original text',()=>{
  const ctx=settingsContext(), row=addCandidate(ctx,{target:'novel:worldView',original:'旧月石',newText:'潮汐'});
  ctx.rejectSettingsRevision(row);
  assert.equal(row.canApply,false);assert.equal(row.issue,'已拒绝');assert.equal(ctx.novel.value.worldView,'古港以旧月石驱动。');
});
test('settings partial blocks remain pending, can be applied later and undo to the previous review',async()=>{
  const ctx=settingsContext(),middle='中央长廊保留所有历史记载和出场人物，不改变这里的任何文字。';
  ctx.novel.value.worldView='开端旧港。'+middle+'结尾旧灯。';ctx.settingsRevisionTargets.value=ctx.getSettingsRevisionTargets();
  const row=addCandidate(ctx,{target:'novel:worldView',original:ctx.novel.value.worldView,newText:'开端新港。'+middle+'结尾新灯。'});
  const first=row.review.revisions.find(r=>r.type!==0);ctx.selectSettingsRevisionChange(row,first.id,false);
  await ctx.applySettingsRevisionRows([row],{selectedOnly:true});
  assert.equal(ctx.novel.value.worldView,'开端旧港。'+middle+'结尾新灯。');assert.equal(row.canApply,true);
  await ctx.applySettingsRevisionRows([row],{selectedOnly:false});
  assert.equal(ctx.novel.value.worldView,'开端新港。'+middle+'结尾新灯。');assert.equal(row.canApply,false);
  ctx.undoSettingsRevision();assert.equal(ctx.novel.value.worldView,'开端旧港。'+middle+'结尾新灯。');
  assert.ok(ctx.settingsRevisionState.value.rows[0].review.revisions.some(r=>r.status==='pending'));
});
test('a newly approximate location is held for confirmation instead of silently applied',async()=>{
  const ctx=settingsContext(),row=addCandidate(ctx,{target:'novel:worldView',original:'旧月石',newText:'潮汐'});
  ctx.novel.value.worldView='古港以旧 月石驱动。';
  await ctx.applySettingsRevisionRows([row]);assert.equal(ctx.novel.value.worldView,'古港以旧 月石驱动。');assert.equal(row.locationMode,'near');assert.equal(row.selected,false);
});
test('snapshot failure and switching books while saving cannot write settings',async()=>{
  const ctx=settingsContext({saveSnapshot:async()=>({ok:false})}),row=addCandidate(ctx,{target:'novel:worldView',original:'旧月石',newText:'潮汐'});
  await ctx.applySettingsRevisionRows([row]);assert.equal(ctx.novel.value.worldView,'古港以旧月石驱动。');assert.equal(ctx.settingsRevisionState.value.undo,null);
  const oldBook=ctx.novel.value;ctx.saveSnapshot=async()=>{ctx.novel.value={worldView:'第二本书'};return {ok:true};};
  await ctx.applySettingsRevisionRows([row]);assert.equal(ctx.novel.value.worldView,'第二本书');assert.equal(oldBook.worldView,'古港以旧月石驱动。');
});
test('short whole replacement refuses a field that changed after review was generated',async()=>{
  const ctx=settingsContext(),row=addCandidate(ctx,{target:'novel:worldView',newText:'潮汐驱动的新港。'});
  assert.equal(row.replaceWhole,true);ctx.novel.value.worldView+='新增内容';
  await ctx.applySettingsRevisionRows([row]);assert.equal(ctx.novel.value.worldView,'古港以旧月石驱动。新增内容');assert.equal(row.canApply,false);
});
test('outline selected application and undo preserve unselected changes and the full original',()=>{
  let confirmation;const state=sample();state.revisions.push({id:'last',type:0,text:'收尾',status:'accepted'});
  const outlineReview={value:state},outlineRevisions={get value(){return outlineReview.value.revisions;},set value(rows){outlineReview.value={revisions:rows,undo:null};}};
  const ctx=reviewContext({outlineReview,outlineRevisions,novel:{value:{outline:'前言原文收尾'}},currentBookId:{value:'book1'},reverseOutlineState:{value:{}},computed:fn=>({get value(){return fn();}}),persistReviewStates:()=>{},showToast:()=>{},openConfirm:(options,apply)=>{confirmation={options,apply};}});
  vm.runInContext(extract('    function checkRevisionsComplete(', '    function getOutlineGenerationModContext('),ctx);
  ctx.requestOutlineReviewApply(true);assert.equal(ctx.novel.value.outline,'前言原文结尾收尾');assert.equal(state.revisions[1].status,'pending');
  ctx.undoOutlineRevisionApply();assert.equal(ctx.novel.value.outline,'前言原文收尾');assert.equal(outlineReview.value.revisions[3].status,'pending');
  ctx.requestOutlineReviewApply(false);assert.match(confirmation.options.impactLines[0],/删除 1 段、共 2 字/);confirmation.apply();assert.equal(outlineReview.value.revisions.length,0);assert.equal(ctx.novel.value.outline,'前言新文结尾收尾');
  assert.equal(ctx.novel.value.outlineImpact.volumes,0);assert.equal(ctx.novel.value.outlineImpact.chapters,0);
});
test('reverse outline pending volume metadata survives refresh, applies with outline and can undo both',()=>{
  const outlineReview={value:{revisions:[]}},outlineRevisions={get value(){return outlineReview.value.revisions;},set value(rows){outlineReview.value={revisions:rows,undo:null};}};
  const ctx=reviewContext({outlineReview,outlineRevisions,novel:{value:{outline:'原大纲',volumes:[{id:'old',title:'原卷'}],unfinishedMode:false,planReminded:[1]}},currentBookId:{value:'book1'},reverseOutlineState:{value:{status:'idle'}},settingsRevisionState:{value:{status:'idle',rows:[],undo:null,error:''}},settingsRevisionPrompt:{value:''},settingsRevisionSelectedIds:{value:[]},settingsRevisionSelectionReady:{value:false},settingsRevisionScopeOpen:{value:false},settingsRevisionBusy:{value:false},showOutlineInMain:{value:false},computed:fn=>({get value(){return fn();}}),saveData:()=>{},showToast:()=>{},normalizeNovelVolumes:clone,openConfirm:(options,apply)=>apply()});
  vm.runInContext(extract('    function persistReviewStates(', '    function getSettingsRevisionTargets(')+extract('    function applyReverseOutlineResult(', '    function openOutlineWorkbench('),ctx);
  vm.runInContext(extract('    function checkRevisionsComplete(', '    function getOutlineGenerationModContext('),ctx);
  ctx.applyReverseOutlineResult({outline:'新大纲',volumes:[{id:'new',title:'新卷'}]},false,20);
  const saved=clone(ctx.novel.value);assert.equal(saved.reviewStates.outline.reverse.pendingCount,20);
  ctx.reverseOutlineState.value={status:'idle'};outlineReview.value={revisions:[]};ctx.restoreReviewStates({novel:saved});
  assert.equal(ctx.reverseOutlineState.value.pendingVolumes[0].id,'new');assert.equal(ctx.reverseOutlineState.value.status,'review');
  ctx.requestOutlineReviewApply(false);assert.equal(ctx.novel.value.outline,'新大纲');assert.equal(ctx.novel.value.volumes[0].id,'new');assert.equal(ctx.novel.value.unfinishedMode,true);assert.equal(outlineReview.value.reverse,undefined);
  assert.equal(ctx.novel.value.outlineImpact.volumes,1);assert.ok(ctx.staleMarkCalls.some(args=>args[0]==='卷'&&args[1]==='new'));
  ctx.undoOutlineRevisionApply();assert.equal(ctx.novel.value.outline,'原大纲');assert.equal(ctx.novel.value.volumes[0].id,'old');assert.equal(ctx.novel.value.unfinishedMode,false);assert.equal(outlineReview.value.reverse.pendingCount,20);
  ctx.rejectAllRevisions();assert.equal(ctx.novel.value.volumes[0].id,'old');assert.equal(outlineReview.value.reverse,undefined);
});
