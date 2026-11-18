'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value)),ref=value=>({value}),computed=get=>({get value(){return get();}});
function section(start,end){const at=source.indexOf(start),to=source.indexOf(end,at);assert.ok(at>=0&&to>at,start);return source.slice(at,to);}
function fn(name){const at=source.search(new RegExp('    (?:async )?function '+name+'[(]')),end=source.indexOf('\n    }',at);assert.ok(at>=0&&end>at,name);return source.slice(at,end+6);}

test('正文实时携带最新卷纲摘要与交接，下一卷起笔章号正确',()=>{
 const volumes=[{id:'v1',title:'上卷',startChapter:1,endChapter:2,summary:'上卷计划',handoffSummaries:{main:{content:'手改交接',actualOutline:'实际修正'}}},{id:'v2',title:'下卷',startChapter:3,endChapter:5,summary:'刚接受的卷纲'}];
 const c={novel:ref({volumes}),memoryLibrary:ref({settings:{replaceHistoryWithSummaries:true}}),activeBranchId:ref('main'),normalizeNovelVolumes:value=>value,getVolumeForChapter:no=>volumes.find(v=>no>=v.startChapter&&no<=v.endChapter),getVolumeHandoff:(volume,bid)=>volume.handoffSummaries?.[bid],buildBudgetedChapterHistory:()=>({text:'请写第一章。',rawChars:0,missingChapters:[]}),visibleChapters:ref([{},{}])};vm.createContext(c);vm.runInContext([fn('buildVolumeConstraintPrompt'),fn('buildChapterHistoryContext')].join('\n'),c);
 assert.match(c.buildVolumeConstraintPrompt(3),/刚接受的卷纲/);volumes[1].summary='作者又修改了卷纲';assert.match(c.buildVolumeConstraintPrompt(3),/作者又修改了卷纲/);const history=c.buildChapterHistoryContext([{},{}]);assert.match(history.text,/手改交接/);assert.match(history.text,/请继续写第3章/);assert.doesNotMatch(history.text,/请写第一章/);
});

test('细纲反推发送超过6000字的完整目标，摘要失败的合并兜底仍含末尾事件',async()=>{
 const calls=[],c={chapterOutlines:ref([{title:'长细纲',content:'前段'.repeat(3500)+'末尾关键事件哨兵'}]),getModuleRequestConfig:()=>({ok:true}),reverseOutlineState:ref({}),AbortController,parseAiStructuredJson:JSON.parse,showToast(){},applyReverseOutlineResult:()=>true,okStreamFetch:async prompt=>{calls.push(prompt);if(calls.length<3)throw Error('模拟摘要失败');return JSON.stringify({outline:'大纲',volumes:[],aiFinished:false});}};
 vm.createContext(c);vm.runInContext('let reverseOutlineAbortController=null;'+fn('reverseOutlineFromDetails'),c);assert.equal(await c.reverseOutlineFromDetails({confirmed:true}),true);assert.equal(calls.length,3);for(const prompt of calls)assert.match(prompt,/末尾关键事件哨兵/);
});

function teamHarness(){
 let serial=0;const saves=[],calls=[];
 const payload={characters:[{name:'甲',desc:'守灯人',personalityTags:['冷静'],dialogueType:'quiet',speakingStyle:'只说短句',exampleDialogues:['灯还亮着。'],characterPrompt:'动作中表现克制',avatarPrompt:'portrait lighthouse',relationships:[{targetName:'乙',type:'朋友',attitude:'信任'}]},{name:'乙',desc:'守港人',dialogueType:'quiet',relationships:[]}],dialogueStyles:[{id:'quiet',label:'克制',prompt:'冷静短句模板',isCustom:true}],presets:[{content:''}],styles:[{prompt:''}],pipeline:{pre:'不应写入'}};
 const c={ref,computed,Date,AbortController,DOMException,deepClone:clone,uid:()=> 'id-'+(++serial),
  teamPlan:ref({titleCandidates:['团队书'],characters:[{name:'甲'},{name:'乙'}],volumes:[{number:1,title:'卷一',startChapter:1,endChapter:2}]}),teamBrief:ref('甲与乙守灯'),teamBlocks:ref([{id:'characters',status:'pending'}]),teamDraft:ref(null),_teamAbort:null,
  teamAppendMode:false,teamExistingBookId:'',currentBookId:ref('old-book'),books:ref([{id:'old-book',title:'原书'}]),novel:ref({title:'原书',volumes:[]}),
  visibleChapters:ref([]),chapterOutlines:ref([]),chapterIndexDrafts:ref([]),foreshadowMatrix:ref([]),structuredCharacters:ref([]),dialogueTypes:ref([{id:'old-type',label:'原类型',prompt:'原模板'}]),
  showNewBook:ref(true),showToast(){},normalizeNovelVolumes:clone,normalizeChapterIndexDrafts:clone,normalizeForeshadowMatrix:clone,normalizeCharacterProfile:character=>character,createCharacterRelationshipRecord:row=>({id:'relation-'+(++serial),...row}),
  buildTeamSettingTable:()=> '设定总表',getModuleRequestConfig:key=>({ok:true,key}),
  okStreamFetch:async(prompt,key)=>{calls.push({prompt,key});return JSON.stringify(payload);},repairAiStructured:async()=>({ok:true,value:clone(payload)}),saveSnapshot:async()=>({ok:true}),syncBookData(){},
  createNewBook(title){const id='new-book';c.books.value.push({id,title});return id;},loadBook(id){c.currentBookId.value=id;c.novel.value={title:c.books.value.find(b=>b.id===id).title,volumes:[]};c.structuredCharacters.value=[];return true;},
  saveData(){},saveDataNow:async reason=>{saves.push({reason,characters:clone(c.structuredCharacters.value),dialogueTypes:clone(c.dialogueTypes.value),novel:clone(c.novel.value)});return true;},runModEventHandlers(){}};
 vm.createContext(c);vm.runInContext([fn('sanitizeCharacterGenerationResult'),fn('teamSpecialistPrompt'),fn('runTeamBlock'),section('    function normalizeTeamCharacters(','    async function reviewTeamDraft('),fn('commitTeamDraft')].join('\n'),c);
 return {c,saves,calls};
}
test('团队角色保留关系、立绘提示和对话模板，提交后同书保存且不带全书配置',async()=>{
 const {c,calls,saves}=teamHarness(),result=await c.runTeamBlock('characters');
 assert.ok(calls[0].prompt.includes('dialogueStyles'),'角色格式须保留对话类型模板');
 assert.match(calls[0].prompt,/"dialogueStyles":\[\{"id":"","label":"","prompt":""\}\]/,'对话模板名称沿用角色设置的 label 字段');
 for(const key of ['presets','styles','pipeline'])assert.equal(result[key],undefined,key+' 不得穿透角色过滤');
 c.teamDraft.value=c.buildTeamDraft({characters:result},{});
 assert.equal(c.teamDraft.value.characters.find(row=>row.name==='甲').avatarPrompt,'portrait lighthouse');
 assert.equal(c.teamDraft.value.dialogueStyles.find(row=>row.id==='quiet').prompt,'冷静短句模板');
 assert.equal(await c.commitTeamDraft(),true);
 const saved=saves.at(-1),first=saved.characters.find(row=>row.name==='甲'),second=saved.characters.find(row=>row.name==='乙');
 assert.equal(first.dialogueType,'quiet');assert.equal(first.speakingStyle,'只说短句');assert.equal(first.avatarPrompt,'portrait lighthouse');
 assert.ok(first.relationships.some(row=>row.targetId===second.id&&row.type==='朋友'),'关系应指向同书角色稳定 id');
 assert.equal(saved.dialogueTypes.find(row=>row.id==='quiet').prompt,'冷静短句模板');assert.ok(saved.dialogueTypes.some(row=>row.id==='old-type'));
 assert.equal(saved.novel.presets,undefined);assert.equal(saved.novel.styles,undefined);assert.equal(saved.novel.pipeline,undefined);
});

function favoriteHarness(){
 let serial=0;const c={ref,computed,Map,Set,Date,deepClone:clone,uid:()=> 'clip-'+(++serial),currentBookId:ref('book'),activeBranchId:ref('main'),novel:ref({title:'当前书',favoriteClips:[],styleSources:{}}),books:ref([]),chapters:ref([{id:'c1',branchId:'main',title:'第一章',content:'旧段落'}]),structuredCharacters:ref([{name:'甲'}]),
  cleanNarrativeChapterContent:ch=>ch.content,getChapterParagraphs:ch=>ch.content.split('\n\n').map(text=>({text})),getDisplayChapterTitle:ch=>ch.title,getCleanWordCount:text=>text.length,saveData(){},saveDataNow:async()=>true,showToast(){},isSnowwingPresetLocked:()=>false};
 vm.createContext(c);vm.runInContext(section('    const FAVORITE_CHAR_WARNING =','    function validateDistilledStyle(')+'\n;globalThis.getSource=()=>styleSource.value;',c);return c;
}
test('更新本书喜欢快照立即同步同分支范文，跨书副本与其他分支保持原值',()=>{
 const c=favoriteHarness(),chapter=c.chapters.value[0];c.saveFavoriteClip(chapter,0,null,chapter.content);
 const local=c.novel.value.favoriteClips[0];c.setStyleSourceMode('favorites');c.toggleStyleMaterial({...local,bookId:'book',bookTitle:'当前书'});
 const foreign={id:'foreign',bookId:'other',branchId:'main',chapterId:'other-c1',snapshot:'别书旧段落',sourceCharacterNames:['乙']};c.toggleStyleMaterial(foreign);
 c.novel.value.styleSources.side={mode:'favorites',copies:[{...clone(local),bookId:'book',branchId:'side',key:'book:'+local.id,snapshot:'支线独有快照'}]};
 chapter.content='更新后的新段落';c.saveFavoriteClip(chapter,0,null,chapter.content,local.id);
 const state=c.getSource();assert.equal(c.novel.value.favoriteClips[0].snapshot,chapter.content);assert.equal(state.copies.find(row=>row.id===local.id).snapshot,chapter.content);assert.match(c.favoriteStylePrompt(),/更新后的新段落/);
 assert.equal(state.copies.find(row=>row.id==='foreign').snapshot,'别书旧段落');assert.equal(c.novel.value.styleSources.side.copies[0].snapshot,'支线独有快照');
 const recipient=c.novel.value;c.currentBookId.value='other';c.novel.value={title:'别书',favoriteClips:[clone(foreign)]};
 c.saveFavoriteClip({id:'other-c1',title:'别书章节'},0,null,'别书后来主动更新的快照','foreign');
 assert.equal(c.novel.value.favoriteClips[0].snapshot,'别书后来主动更新的快照');
 c.currentBookId.value='book';c.novel.value=recipient;
 assert.equal(c.getSource().copies.find(row=>row.id==='foreign').snapshot,'别书旧段落','来源书更新不得擅改已复制进当前书的范文');
});

function volumeHarness(){
 let serial=0;const toasts=[],saved=[],oldHandoff={content:'原交接',actualOutline:'原修正',branchId:'main',at:1,edited:true};
 const c={ref,computed,Date,AbortController,deepClone:clone,uid:()=> 'rev-'+(++serial),currentBookId:ref('book'),activeBranchId:ref('main'),novel:ref({outline:'总纲保留',volumes:[{id:'v1',title:'旧卷',startChapter:1,endChapter:2,summary:'旧计划',actualSummary:oldHandoff.content,actualOutline:oldHandoff.actualOutline,handoffSummaries:{main:clone(oldHandoff)}}]}),
  chapterOutlines:ref([{id:'o1',chapterNo:1,title:'第一章',content:'细纲一'},{id:'o2',chapterNo:2,title:'第二章',content:'细纲二'}]),visibleChapters:ref([]),summaries:ref([{id:'s1',kind:'volume-handoff',volumeId:'v1',branchId:'main',content:'【上一卷正文总结】\n原交接\n【实际卷纲修正】\n原修正',edited:true},{id:'keep',kind:'range',content:'其他总结应保留'}]),
  staleMarks:ref([{id:'before',kind:'细纲',targetId:'o1',reason:'原有标记'}]),branchData:ref({main:{staleMarks:[]}}),tocHandoffEditor:ref(null),outlineReview:ref({revisions:[]}),reverseOutlineState:ref({status:'idle'}),isGeneratingOutline:ref(false),isGeneratingDO:ref(false),outlineAiEditingIdx:ref(-1),outlineAbortController:ref(null),outlineStreamPreview:ref(''),outlineStreamError:ref(''),showOutlineInMain:ref(false),showOutlineRevisionModal:ref(false),showDetailedOutlineInMain:ref(true),
  getLatestOutlineTextForAi:()=>c.novel.value.outline,requireModuleRequest:()=>({ok:true,model:'outline-mock'}),fetchAdapterCompletion:async()=>({text:JSON.stringify({volumes:[{number:1,title:'新卷一',startChapter:1,endChapter:1,summary:'新计划一',handoff:{content:'新交接一',actualOutline:'新修正一'}},{number:2,title:'新卷二',startChapter:2,endChapter:2,summary:'新计划二',handoff:{content:'新交接二',actualOutline:'新修正二'}}]})}),
  getAdapterCompletionText:r=>r.text,parseAiStructuredJson:JSON.parse,cleanAIResponse:String,createReviewState:()=>({revisions:[]}),getVolumeHandoffSourceHash:()=> 'source-hash',markVolumePlanStale(volume){c.staleMarks.value.push({id:'new-'+volume.id,kind:'卷',targetId:volume.id,reason:'新卷待核对'});},clearStaleMarksForTarget(){},showToast:(...args)=>toasts.push(args),openConfirm:(_config,callback)=>callback(),saveData(){},
  persistReviewStates(){saved.push(clone({novel:c.novel.value,summaries:c.summaries.value,staleMarks:c.staleMarks.value}));},getReviewChangeIds:state=>state.revisions.filter(r=>r.type!==0).map(r=>r.id),applyRevisions:()=>c.novel.value.outline,reportOutlineContinuityImpact(){}};
 c.novelVolumes=computed(()=>c.novel.value.volumes);c.outlineRevisions={get value(){return c.outlineReview.value.revisions;},set value(rows){c.outlineReview.value.revisions=rows;}};
 vm.createContext(c);vm.runInContext(['normalizeNovelVolumes','getVolumeHandoff','parseVolumeHandoffText','saveVolumeHandoffEdit','isVolumeWorkbenchRequest','parseWorkbenchCount','getWorkbenchChapterScope','buildWorkbenchPlanningContext','validateVolumeRanges','planWorkbenchVolumes','getWorkbenchDetailsKey','getWorkbenchVolumesKey','checkRevisionsComplete','requestOutlineReviewApply','undoOutlineRevisionApply'].map(fn).join('\n')+'\n'+section('    const canUndoOutlineRevisionApply =','    function undoOutlineRevisionApply('),c);return {c,toasts,saved};
}
test('卷纲工作台撤销同时还原两份交接与待核对标记，保留卷纲候选供再次接受',async()=>{
 const {c}=volumeHarness(),before=clone({volumes:c.novel.value.volumes,summaries:c.summaries.value,staleMarks:c.staleMarks.value});
 await c.planWorkbenchVolumes('根据细纲重新划分卷纲');const originalPlan=clone(c.outlineReview.value.workbenchVolumes);c.requestOutlineReviewApply(false);assert.equal(c.novel.value.volumes.length,2);assert.equal(c.novel.value.volumes[0].handoffSummaries.main.content,'新交接一');assert.ok(c.summaries.value.some(row=>row.content.includes('新交接一')));
 c.undoOutlineRevisionApply();assert.deepEqual(clone(c.novel.value.volumes),before.volumes);assert.deepEqual(clone(c.summaries.value),before.summaries);assert.deepEqual(clone(c.staleMarks.value),before.staleMarks);assert.deepEqual(clone(c.outlineReview.value.workbenchVolumes),originalPlan);assert.ok(c.outlineReview.value.revisions.every(row=>row.type===0||row.status==='pending'));
 c.requestOutlineReviewApply(false);assert.equal(c.novel.value.volumes.length,2);assert.equal(c.novel.value.volumes[0].handoffSummaries.main.content,'新交接一');assert.equal(c.novel.value.outline,'总纲保留');
});
test('作者后来手改卷纲或交接后，撤销须阻止覆盖',async()=>{
 for(const changed of ['volume','handoff']){
  const {c,toasts}=volumeHarness();await c.planWorkbenchVolumes('重新划分卷纲');c.requestOutlineReviewApply(false);
  if(changed==='volume')c.novel.value.volumes[0].summary='作者后来手改的卷纲';else c.saveVolumeHandoffEdit(c.novel.value.volumes[0],'main',{content:'作者后来手改的交接',actualOutline:'后来修正'});
  const before=clone({volumes:c.novel.value.volumes,summaries:c.summaries.value});c.undoOutlineRevisionApply();assert.deepEqual(clone({volumes:c.novel.value.volumes,summaries:c.summaries.value}),before,changed+' 不得覆盖后改内容');assert.ok(toasts.some(row=>/后来|已有修改|发生变化/.test(row[0])),changed+' 应说明阻止原因');
 }
});
