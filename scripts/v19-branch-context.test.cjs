'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {branchHarness,fn,clone}=require('./v19-branch-harness.cjs');
function harness(){
 const h=branchHarness(),c=h.c,ref=value=>({value});
 Object.assign(c,{settings:ref({contextOutlineBefore:1,contextOutlineAfter:2,contextHistoryCharLimit:15000,contextFullChapters:3}),promptPipeline:ref([{key:'outline'}]),promptPresets:ref([]),books:ref([]),atmosphereEnabled:ref(false),atmospherePrompt:ref(''),generateCount:ref(1),_remainingCount:0,imageGenEnabled:ref(false),imageGenKey:ref(''),priorityEnabled:ref(false),priorityRequirement:ref(''),
  stripOutlineLengthDirectives:s=>s,clipContextText:(s,n)=>String(s).slice(0,n),getModRulesForPosition:()=>'',isSnowwingPresetLocked:()=>false,buildStoryBibleWritingContextPackage:()=>({}),buildHostPresetSystemSections:()=>[],getPersonPresetContent:()=>'',buildCotPresetContent:()=>'',applyModTextHooks:(_hook,text,context)=>{c.modContext=context;return text;},
  getChapterLengthContract:()=>({targetWords:2500,promptMinWords:2000,promptMaxWords:3000}),extractNarrativeHardConstraints:()=>[],getSnowwingChapterStoryTime:()=>'',formatNarrativeHardConstraintPrompt:()=>'',getFullNsfwSystemPrompt:()=>'',getNsfwPrompt:()=>'',getDeepSeekPreludeMessages:()=>[],getNsfwInjectionMessages:()=>[],buildPromptPresetMessages:()=>[],normalizeContextSettings(){},buildForeshadowPromptContext:()=>'',buildSnowwingActiveContextPrompt:()=>'',applyPromptComposer:msgs=>msgs,isSnowwingRuntimeAuditFlagEnabled:()=>false,collectSnowwingCotContextFromMessages:()=>({enabled:false}),pushProtectedMessage:(msgs,_safe,msg)=>msgs.push(msg),
  cleanNarrativeChapterContent:ch=>ch.content,cleanNarrativeChapterSummary:ch=>ch.summary,cleanNarrativeSourceText:s=>s,formatSnowwingChapterStoryTimeContext:()=>'',formatSnowwingSummaryStoryTimesContext:()=>'',memoryChapterHash:ch=>ch.content});
 const names=['getVolumeForChapter','getVolumeHandoff','buildVolumeConstraintPrompt','buildOutlineContext','getLatestOutlineTextForAi','getValidMemoryRows','validMemoryGroups','isSummaryInCurrentBranch','buildBudgetedChapterHistory','buildChapterHistoryContext','buildBranchNotePrompt','buildPipelineLayerPrompt','buildFullSystemPrompt','buildChapterMessages','selectBookBranches'];
 vm.runInContext(names.map(fn).join('\n'),c);return h;
}
function setPlanning(c,label){
 const bid=c.activeBranchId.value;
 c.novel.value.outline=label+'总纲';c.novel.value.chapterCount=label==='主线'?20:30;c.novel.value.unfinishedMode=label!=='主线';
 c.novel.value.volumes=c.normalizeNovelVolumes([{id:'v1',startChapter:1,endChapter:2,summary:label+'首卷',handoffSummaries:{[bid]:{content:label+'交接',actualOutline:label+'实际卷纲'}}},{id:'v2',startChapter:3,endChapter:30,summary:label+'当前卷纲'}]);
 c.chapterOutlines.value=Array.from({length:9},(_,i)=>({id:bid+'-o'+i,chapterNo:i+1,title:'章'+(i+1),content:label+'细纲'+(i+1)}));
 c.novel.value.reviewStates={outline:{status:'review',revisions:[{id:label,text:label+'待审'}]}};
 c.visibleChapters.value.forEach((ch,i)=>{ch.content=label+'正文'+(i+1);ch.summary=label+'摘要'+(i+1);});
 c.memoryLibrary.value.memories=c.memoryLibrary.value.memories.filter(row=>row.branchId!==bid).concat(c.visibleChapters.value.map(ch=>({chapterId:ch.id,branchId:bid,sourceHash:ch.content,text:label+'记忆'+ch.id,enabled:true})));
 c.summaries.value=c.summaries.value.filter(row=>row.branchId!==bid).concat({id:label,branchId:bid,startChapter:1,endChapter:2,useForContext:true,content:label+'长期总结'});
 c.persistCurrentBranchData();
}
function assertRequest(c,label,others){
 const text=c.buildChapterMessages({currentChapterNo:c.visibleChapters.value.length+1,printLog:false}).map(row=>row.content).join('\n');
 for(const key of ['总纲','当前卷纲','细纲'])assert.ok(text.includes(label+key),label+key);
 for(const other of others)for(const key of ['总纲','卷纲','细纲','正文','摘要','记忆','长期总结','交接','待审'])assert.ok(!text.includes(other+key),other+key+' 不应进入请求');
 assert.ok(c.modContext.chapters.every(ch=>ch.branchId===c.activeBranchId.value));return text;
}
test('主线→支线→孙支线各自修改规划，切换后的消息构造只读取当前线',async()=>{
 const {c}=harness();setPlanning(c,'主线');const parent=await c.forkBranch(2);assert.ok(parent);assert.deepEqual(clone(c.novel.value.reviewStates),{},'新线不继承上级待审/撤销记录');setPlanning(c,'支线');const child=await c.forkBranch(2);assert.ok(child);setPlanning(c,'孙线');
 for(const [bid,label] of [['main','主线'],[parent.id,'支线'],[child.id,'孙线']]){
  c.switchBranch(bid);assertRequest(c,label,['主线','支线','孙线'].filter(x=>x!==label));assert.equal(c.novel.value.reviewStates.outline.revisions[0].text,label+'待审');
  assert.equal(c.novel.value.chapterCount,label==='主线'?20:30);assert.equal(c.novel.value.unfinishedMode,label!=='主线');
 }
 c.switchBranch('main');c.novel.value.outline='主线后来改纲';c.novel.value.volumes[1].summary='主线后来改卷';c.switchBranch(child.id);assertRequest(c,'孙线',['主线后来改','支线']);
 const saved=clone(c.branchData.value),restored=harness().c;restored.branchList.value=clone(c.branchList.value);restored.chapters.value=clone(c.chapters.value);restored.branchData.value=restored.normalizeBranchData(saved);
 for(const [bid,label]of [[parent.id,'支线'],[child.id,'孙线']]){restored.activeBranchId.value=bid;restored.loadBranchScopedData(bid);assertRequest(restored,label,['主线','支线','孙线'].filter(x=>x!==label));}
});
test('历史原文、逐章摘要、长期总结和记忆的预算路径均不读取其他线；卷交接只读当前线',async()=>{
 const {c}=harness();setPlanning(c,'主线');await c.forkBranch(2);setPlanning(c,'支线');c.memoryLibrary.value.settings.replaceHistoryWithSummaries=true;
 for(const mode of ['raw','summary','range','memory']){
  c.settings.value.contextUseRangeSummaries=mode==='range';c.settings.value.contextHistoryCharLimit=mode==='raw'?15000:0;c.memoryLibrary.value.settings.enabled=mode==='memory';
  const text=c.buildBudgetedChapterHistory(c.visibleChapters.value).text;assert.doesNotMatch(text,/主线(?:正文|摘要|记忆|长期总结)/);assert.match(text,new RegExp('支线'+({raw:'正文',summary:'摘要',range:'长期总结',memory:'记忆'}[mode])));
 }
 const ch=c.visibleChapters.value.pop();c.chapters.value=c.chapters.value.filter(row=>row.id!==ch.id);const history=c.buildChapterHistoryContext(c.visibleChapters.value).text;assert.match(history,/支线交接/);assert.doesNotMatch(history,/主线交接/);
});
test('仅导出孙支线，重新载入新主线后总纲、卷纲、交接与细纲仍是孙线版本',async()=>{
 const {c}=harness();setPlanning(c,'主线');await c.forkBranch(2);setPlanning(c,'支线');const child=await c.forkBranch(2);setPlanning(c,'孙线');
 const before=clone(c.branchData.value),out=c.selectBookBranches({novel:c.novel.value,branchList:c.branchList.value,activeBranchId:child.id,branchData:c.branchData.value,chapters:c.chapters.value,summaries:c.summaries.value,memoryLibrary:c.memoryLibrary.value},[child.id]);
 assert.equal(out.novel.outline,'孙线总纲');assert.equal(out.novel.volumes[0].handoffSummaries.main.content,'孙线交接');assert.equal(out.novel.volumes[0].actualSummary,'孙线交接');assert.equal(out.branchData.main.volumes[0].handoffSummaries.main.content,'孙线交接');assert.deepEqual(clone(c.branchData.value),before);
 const next=harness().c;next.novel.value=out.novel;next.branchList.value=out.branchList;next.chapters.value=out.chapters;next.branchData.value=next.normalizeBranchData(out.branchData);next.loadBranchScopedData('main');assertRequest(next,'孙线',['主线','支线']);
});
test('未带分支规划的旧书从原字段初始化，各线得到独立副本；空规划不会回退到其他线',()=>{
 const {c}=harness();c.branchList.value.push({id:'side',parentId:'main'});const legacy={outline:'原大纲',volumes:[{id:'v1',summary:'原卷纲'}],unfinishedMode:true,chapterCount:20,reviewStates:{manualPlanning:{main:{raw:'原文'}}}};
 const data=c.normalizeBranchData({},legacy);assert.deepEqual(clone(data.side.reviewStates),{},'旧待审记录不能复制到其他线');data.side.volumes[0].summary='支线改卷';assert.equal(data.main.volumes[0].summary,'原卷纲');data.side.outline='';data.side.volumes=[];data.side.reviewStates={};c.branchData.value=data;c.activeBranchId.value='side';c.loadBranchScopedData('side');assert.equal(c.novel.value.outline,'');assert.deepEqual(clone(c.novel.value.volumes),[]);assert.deepEqual(clone(c.novel.value.reviewStates),{});
 const fromSide=c.normalizeBranchData({},legacy);assert.deepEqual(clone(fromSide.main.reviewStates),{});assert.equal(fromSide.side.reviewStates.manualPlanning.main.raw,'原文');
});

test('MOD 独立调用 system 构造时，默认正文范围也只能包含当前分支',async()=>{
 const {c}=harness();setPlanning(c,'主线');await c.forkBranch(2);setPlanning(c,'支线');
 c.buildFullSystemPrompt();
 assert.ok(c.chapters.value.some(ch=>ch.branchId==='main'),'夹具确实保留另一条线');
 assert.equal(c.modContext.chapters.length,c.visibleChapters.value.length);
 assert.ok(c.modContext.chapters.every(ch=>ch.branchId===c.activeBranchId.value));
});

test('恢复支线紧急备份时，总纲和卷纲回到支线，主线规划不被备份中的 novel 覆盖',async()=>{
 const {c}=harness();setPlanning(c,'主线');const side=await c.forkBranch(2);setPlanning(c,'支线');
 const backup={timestamp:1,backupToken:'side-backup',currentBookId:'book',activeBranchId:side.id,novel:clone(c.novel.value),chapterOutlines:clone(c.branchData.value.main.chapterOutlines),chapterIndexDrafts:[],foreshadowMatrix:[],chapters:[{...clone(c.chapters.value.at(-1)),content:'支线未落盘正文'}],chapterCount:c.chapters.value.length,chaptersPartial:true};
 backup.novel.outline='支线备份总纲';backup.novel.volumes[1].summary='支线备份卷纲';
 Object.assign(c,{completedSaveRevision:0,localStorage:{getItem:()=>JSON.stringify(backup)},getEmergencyBackupStorageKey:()=> 'backup',readEmergencyBackupRecord:()=>backup,resetCharacterDraftReviewForBookChange(){},resetCharacterStateDraft(){},repairDanglingCharacterReferences(){},repairStoryBibleReferences(){},isChapterEditDirty:()=>false,discardChapterEditDraft(){},selectedWorkbenchCharacterId:{value:''},structuredCharacters:{value:[]},coverImage:{value:''},console});
 vm.runInContext(['getEmergencyBackupBookSlice','buildEmergencyPlanningFingerprint','buildEmergencyChapterSliceFingerprint','mergeEmergencyBackupChapters','tryRestoreEmergencyBackup'].map(fn).join('\n'),c);
 c.tryRestoreEmergencyBackup();assert.ok(c.confirm,'应询问恢复，不静默写入');c.confirm.callback();
 assert.equal(c.activeBranchId.value,side.id);assert.equal(c.novel.value.outline,'支线备份总纲');assert.equal(c.novel.value.volumes[1].summary,'支线备份卷纲');
 c.switchBranch('main');assert.equal(c.novel.value.outline,'主线总纲');assert.equal(c.novel.value.volumes[1].summary,'主线当前卷纲');assert.equal(c.chapterOutlines.value[0].content,'主线细纲1');
 c.switchBranch(side.id);assert.equal(c.novel.value.outline,'支线备份总纲');assert.equal(c.chapterOutlines.value[0].content,'支线细纲1');
});
