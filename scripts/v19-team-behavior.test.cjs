'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
function extract(from,to){const start=source.indexOf(from),end=source.indexOf(to,start);assert.ok(start>=0&&end>start,'Cannot extract '+from);return source.slice(start,end);}
const chapter=(no,content='第'+no+'章原始细纲')=>'## 第'+no+'章 章节'+no+'\n'+content+'\n【无问题】';
function harness(extra={}){
  const calls=[],repairs=[],toasts=[];let seq=0;
  const plan={titleCandidates:['雾港回声'],genre:'悬疑',tone:'克制',characters:[{name:'林远',summary:'寻灯人'},{name:'周宁',summary:'守港人'}],userFacts:[{text:'主角在雾港寻找旧灯',source:'用户'}],volumes:[{number:1,title:'雾港',startChapter:1,endChapter:3,summary:'追查旧灯',writingRequirement:'逐章推进调查',bridge:'留下新线索'}],chapterCount:3,unfinishedMode:true};
  const ctx=vm.createContext({
    AbortController,DOMException,Date,Set,Map,console,uid:()=> 'team-test-'+(++seq),deepClone:clone,
    cleanAIResponse:value=>String(value||''),getAdapterCompletionText:value=>value.text,
    teamPlan:{value:plan},teamBrief:{value:'主角在雾港寻找旧灯'},teamPlanOptions:{unfinishedMode:true,chapterCount:3},
    teamBlocks:{value:[]},teamDraft:{value:null},teamReview:{value:null},teamPhase:{value:'input'},oneKeyPhase:{value:'config'},teamRawView:{value:''},
    _teamAbort:null,_teamRunId:0,teamAppendMode:false,teamExistingBookId:'',
    settings:{value:{detailedOutlineBatchSize:3}},moduleModelConfig:[],confirmStorageHeadroom:async()=>true,
    normalizeNovelVolumes:rows=>clone(rows),normalizeChapterIndexDrafts:rows=>clone(rows),normalizeForeshadowMatrix:rows=>clone(rows),
    getModuleRequestConfig:key=>({ok:true,module:key}),
    showToast:(message,type)=>toasts.push({message,type}),
    okStreamFetch:async(prompt,modelKey,signal,options)=>{calls.push({prompt,modelKey,aborted:signal?.aborted,options:clone(options)});throw Error('Unexpected fake team request');},
    fetchAdapterCompletion:async(request,messages,options)=>{repairs.push({request,messages:clone(messages),options:{stream:options.stream,temperature:options.temperature,maxTokens:options.maxTokens,aborted:options.signal?.aborted}});return {text:'{}'};},
    ...extra
  });
  vm.runInContext(extract('    function parseAiJsonSyntax(', '    function parseCharacterAiJsonEnvelope('),ctx);
  vm.runInContext(extract('    function parseChapterNoValue(', '    // v0.0.11 修复3：细纲流式落卡'),ctx);
  vm.runInContext(extract('    function validateVolumeRanges(', '    async function prepareVolumePlan(')+extract('    function teamPlanFallback(', '    function getOneKeyDetailedChapterCount('),ctx);
  const queue=values=>{ctx.okStreamFetch=async(prompt,modelKey,signal,options)=>{calls.push({prompt,modelKey,aborted:signal?.aborted,options:clone(options)});const value=values.shift();if(value instanceof Error)throw value;if(value===undefined)throw Error('Fake response queue exhausted');return typeof value==='function'?value({signal,prompt,options}):value;};};
  const add=(id,result)=>{const row={id,label:id,status:'pending',...(result?{result}:{} )};ctx.teamBlocks.value.push(row);return row;};
  return {ctx,plan,calls,repairs,toasts,queue,add};
}
test('known characters returned out of order retain the right biographies',()=>{
  const {ctx}=harness();
  const draft=ctx.buildTeamDraft({characters:{characters:[{name:'周宁',desc:'周宁独有的守港人经历'},{name:'林远',desc:'林远独有的寻灯人经历'}]}},{});
  const byName=Object.fromEntries(draft.characters.map(row=>[row.name,row.desc]));
  assert.deepEqual(byName,{'周宁':'周宁独有的守港人经历','林远':'林远独有的寻灯人经历'});
  assert.equal(draft.characters.some(row=>row.nameCorrected),false);
});
test('one unknown character and one missing canonical name can be mapped without touching the known character',()=>{
  const {ctx}=harness();
  const draft=ctx.buildTeamDraft({characters:{characters:[{name:'周宁',desc:'守港人原档案'},{name:'林源',desc:'寻灯人原档案'}]}},{});
  assert.equal(draft.characters.find(row=>row.name==='周宁')?.desc,'守港人原档案');
  assert.equal(draft.characters.find(row=>row.name==='林远')?.desc,'寻灯人原档案');
  assert.equal(draft.characters.find(row=>row.name==='林远')?.nameCorrected,true);
});
test('ambiguous unknown character names are listed and never renamed by list position',()=>{
  const {ctx}=harness();
  const draft=ctx.buildTeamDraft({characters:{characters:[{name:'许川',desc:'许川的经历'},{name:'温乔',desc:'温乔的经历'}]}},{});
  assert.deepEqual(clone(draft.characters.map(row=>({name:row.name,desc:row.desc}))),[{name:'许川',desc:'许川的经历'},{name:'温乔',desc:'温乔的经历'}]);
  assert.ok(draft.nameIssues.some(line=>line.includes('许川')),'Unknown name 许川 must be visible in issues');
  assert.ok(draft.nameIssues.some(line=>line.includes('温乔')),'Unknown name 温乔 must be visible in issues');
});
test('additional unknown characters are preserved and identified rather than silently accepted',()=>{
  const {ctx}=harness();
  const draft=ctx.buildTeamDraft({characters:{characters:[{name:'周宁',desc:'守港人'},{name:'林远',desc:'寻灯人'},{name:'陌生人甲',desc:'多出来的角色'}]}},{});
  assert.equal(draft.characters.find(row=>row.name==='陌生人甲')?.desc,'多出来的角色');
  assert.ok(draft.nameIssues.some(line=>line.includes('陌生人甲')));
});
test('missing chapter retries retain good chapters, request only missing ones and ignore extra replies',async()=>{
  const h=harness(),row=h.add('details-1-1'),controller=new AbortController();
  const first=chapter(1,'第一章不可覆盖哨兵'),second=chapter(1,'错误覆盖第一章')+'\n'+chapter(3,'第三章补齐')+'\n'+chapter(9,'范围外章节'),third=chapter(2,'第二章补齐')+'\n'+chapter(3,'错误覆盖第三章');
  h.queue([first,second,third]);
  const result=await h.ctx.runTeamDetailBlock(row.id,h.plan.volumes[0],{}, {},{controller});
  assert.equal(row.status,'done');assert.deepEqual(clone(result.outlines.map(item=>item.chapterNo)),[1,2,3]);
  assert.ok(result.outlines[0].content.includes('第一章不可覆盖哨兵'));assert.ok(!result.outlines[0].content.includes('错误覆盖'));
  assert.ok(result.outlines[2].content.includes('第三章补齐'));assert.equal(h.calls.length,3);
  assert.ok(h.calls[1].prompt.includes('缺少第2、3章'));assert.ok(h.calls[2].prompt.includes('缺少第2章'));
  assert.ok(h.calls.every(call=>call.modelKey==='team-outline'&&call.options.retries===0&&!call.aborted));
  assert.ok(h.toasts.some(toast=>toast.message.includes('9')),'Ignored out-of-range reply should be explained');
});
test('failed chapter block retains partial work; a later retry fills gaps without redoing good chapters',async()=>{
  const h=harness(),row=h.add('details-1-1');
  h.queue([chapter(1,'第一章保留哨兵'),chapter(1,'不可覆盖'),chapter(1,'仍不可覆盖')]);
  await assert.rejects(h.ctx.runTeamDetailBlock(row.id,h.plan.volumes[0],{},{}),error=>error.message.includes('2')&&error.message.includes('3'));
  assert.equal(row.status,'error');assert.deepEqual(clone(row.result.outlines.map(item=>item.chapterNo)),[1]);
  h.queue([chapter(1,'重试不能覆盖第一章')+'\n'+chapter(2,'第二章重试补齐')+'\n'+chapter(3,'第三章重试补齐')]);
  const result=await h.ctx.runTeamDetailBlock(row.id,h.plan.volumes[0],{},{});
  assert.equal(row.status,'done');assert.equal(h.calls.length,4);assert.ok(h.calls[3].prompt.includes('缺少第2、3章'));
  assert.ok(result.outlines[0].content.includes('第一章保留哨兵'));assert.deepEqual(clone(result.outlines.map(item=>item.chapterNo)),[1,2,3]);
});
for(const [id,payload] of [['settings',{title:'有书名但没有世界观',worldView:'  '}],['characters',{characters:[]}],['characters',{characters:[{name:' ',desc:'没有名字'}]}],['outline',{outline:'\n ',volumes:[],chapterIndexDrafts:[]}]] ) {
  test(id+' empty required block is an error and cannot produce a draft result: '+JSON.stringify(payload),async()=>{
    const h=harness(),row=h.add(id);h.queue([JSON.stringify(payload)]);h.ctx.fetchAdapterCompletion=async()=>({text:JSON.stringify(payload)});
    await assert.rejects(h.ctx.runTeamBlock(id));assert.equal(row.status,'error');assert.equal(row.result,undefined);assert.ok(row.error.length>0);
  });
}
test('specialist cancellation after raw response blocks any result or repair request',async()=>{
  const h=harness(),row=h.add('settings'),controller=new AbortController();
  h.queue([()=>{controller.abort();return JSON.stringify({worldView:'迟到的有效世界观'});}]);
  await assert.rejects(h.ctx.runTeamBlock('settings',{controller}),error=>error.name==='AbortError');
  assert.equal(row.status,'stopped');assert.equal(row.result,undefined);assert.equal(h.repairs.length,0);
});
test('specialist cancellation after format repair blocks the repaired result',async()=>{
  const h=harness(),row=h.add('settings'),controller=new AbortController();h.queue(['{"worldView":']);
  h.ctx.fetchAdapterCompletion=async(request,messages,options)=>{h.repairs.push({request,messages:clone(messages),signal:options.signal});controller.abort();return {text:JSON.stringify({worldView:'修复后但已取消的世界观'})};};
  await assert.rejects(h.ctx.runTeamBlock('settings',{controller}),error=>error.name==='AbortError');
  assert.equal(h.repairs.length,1);assert.equal(h.repairs[0].signal,controller.signal);assert.equal(row.status,'stopped');assert.equal(row.result,undefined);
});
test('detail cancellation after raw does not accept even a fully populated late response',async()=>{
  const h=harness(),row=h.add('details-1-1'),controller=new AbortController();
  h.queue([()=>{controller.abort();return [chapter(1),chapter(2),chapter(3)].join('\n');}]);
  await assert.rejects(h.ctx.runTeamDetailBlock(row.id,h.plan.volumes[0],{}, {},{controller}),error=>error.name==='AbortError');
  assert.equal(row.status,'stopped');assert.equal(row.result,undefined);
});
test('specialists use the correct model module and expose exact fake request inputs',async()=>{
  const h=harness();
  const replies={settings:{title:'雾港回声',worldView:'力量来自潮汐',synopsis:'雾港寻灯'},characters:{characters:[{name:'林远',desc:'寻灯人'},{name:'周宁',desc:'守港人'}]},outline:{outline:'追查旧灯，大门后的线索尚未揭开。',volumes:h.plan.volumes,chapterIndexDrafts:[]}};
  for(const id of ['settings','characters','outline']){h.add(id);h.queue([JSON.stringify(replies[id])]);const result=await h.ctx.runTeamBlock(id);assert.ok(result);}
  assert.deepEqual(h.calls.map(call=>({model:call.modelKey,task:call.options.taskType,retries:call.options.retries})),[{model:'team-settings',task:'team-settings',retries:1},{model:'team-character',task:'team-characters',retries:1},{model:'team-outline',task:'team-outline',retries:1}]);
  assert.ok(h.calls.every(call=>call.prompt.includes('雾港回声')&&call.prompt.includes('主角在雾港寻找旧灯')));
  assert.equal(h.repairs.length,0,'Valid structured responses must not spend a repair request');
});
function commitHarness(append=false){
  const writes=[],snapshots=[],created=[];
  const original={id:'original',title:'原书',novel:{title:'原书',outline:'原大纲',worldView:'原世界观',volumes:[{id:'old-volume',number:1,title:'原卷',startChapter:1,endChapter:1}]},chapterOutlines:[{id:'old-detail',chapterNo:1,title:'原章',content:'原细纲哨兵'}],chapterIndexDrafts:[],foreshadowMatrix:[],characters:[]};
  const h=harness({books:{value:[clone(original)]},currentBookId:{value:'original'},novel:{value:clone(original.novel)},chapters:{value:[]},chapterOutlines:{value:clone(original.chapterOutlines)},chapterIndexDrafts:{value:[]},foreshadowMatrix:{value:[]},structuredCharacters:{value:[]},visibleChapters:{value:[]},showNewBook:{value:true},teamAppendMode:append,teamExistingBookId:append?'original':'',saveSnapshot:async label=>{snapshots.push(label);return {ok:true};},saveDataNow:async reason=>{writes.push(reason);return true;},syncBookData:()=>{},runModEventHandlers:()=>{}});
  h.ctx.createNewBook=(title,theme,worldView)=>{const id='created-'+(created.length+1);created.push(id);h.ctx.books.value.push({id,title,novel:{title,theme,worldView},chapterOutlines:[],characters:[]});return id;};
  h.ctx.loadBook=id=>{const book=h.ctx.books.value.find(row=>row.id===id);h.ctx.currentBookId.value=id;h.ctx.novel.value=clone(book.novel);h.ctx.chapterOutlines.value=clone(book.chapterOutlines||[]);h.ctx.structuredCharacters.value=clone(book.characters||[]);};
  const draft=h.ctx.buildTeamDraft({settings:{worldView:'新世界观',synopsis:'新简介'},outline:{outline:'新大纲',volumes:[{number:1,title:'新卷',startChapter:1,endChapter:1}]},characters:{characters:[{name:'林远',desc:'角色哨兵'}]}},{first:{outlines:[{id:'new-detail',chapterNo:1,title:'新章',content:'新细纲哨兵'}]}});
  h.ctx.teamDraft.value=draft;return {...h,writes,snapshots,created,draft};
}
for(const append of [false,true])test((append?'append':'new book')+' concurrent and repeated draft submission commits exactly once',{timeout:2000},async()=>{
  const h=commitHarness(append);let release;h.ctx.saveSnapshot=async label=>{h.snapshots.push(label);return new Promise(resolve=>{release=resolve;});};
  const first=h.ctx.commitTeamDraft();
  const second=h.ctx.commitTeamDraft();assert.equal(h.snapshots.length,1,'Second call must not enter snapshot while first call waits');
  assert.equal(await second,false);assert.equal(h.ctx.books.value.length,1);assert.equal(h.writes.length,0);
  release({ok:true});assert.equal(await first,true);
  assert.equal(h.ctx.teamDraft.value,null,'Successful draft must be consumed');assert.equal(h.ctx.showNewBook.value,false);assert.equal(h.writes.length,1);
  assert.equal(await h.ctx.commitTeamDraft(),false,'Consumed draft cannot be submitted again');assert.equal(h.snapshots.length,1);
  assert.equal(h.ctx.books.value.length,append?1:2);assert.equal(h.created.length,append?0:1);
  assert.equal(h.ctx.chapterOutlines.value.filter(row=>row.content==='新细纲哨兵').length,1);
  if(append){assert.equal(h.ctx.chapterOutlines.value[0].content,'原细纲哨兵');assert.equal(h.ctx.chapterOutlines.value[1].chapterNo,2);}
});
test('failed draft save restores the original book and permits a deliberate retry',async()=>{
  const h=commitHarness();h.ctx.saveDataNow=async()=>false;
  assert.equal(await h.ctx.commitTeamDraft(),false);assert.equal(h.ctx.books.value.length,1);assert.equal(h.ctx.currentBookId.value,'original');assert.equal(h.ctx.novel.value.outline,'原大纲');assert.equal(h.ctx.teamDraft.value,h.draft);
  h.ctx.saveDataNow=async reason=>{h.writes.push(reason);return true;};
  assert.equal(await h.ctx.commitTeamDraft(),true);assert.equal(h.ctx.books.value.length,2);assert.equal(h.writes.length,1);
});
test('rejected snapshot does not leave the team draft permanently locked',async()=>{
  const h=commitHarness();h.ctx.saveSnapshot=async()=>{throw Error('快照服务暂时失败');};
  await assert.rejects(h.ctx.commitTeamDraft(),/快照服务暂时失败/);assert.equal(h.ctx.teamDraft.value,h.draft);assert.equal(h.ctx.books.value.length,1);
  h.ctx.saveSnapshot=async()=>({ok:true});assert.equal(await h.ctx.commitTeamDraft(),true);assert.equal(h.created.length,1);
});
