'use strict';
const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../source/moyun.single.html'),'utf8');
function fn(name){const re=new RegExp('    (?:async )?function '+name+'\\('),at=source.search(re);assert.ok(at>=0,name);const end=source.indexOf('\n    }',at);return source.slice(at,end+6);}
function runtime(fetch){
 const ref=value=>({value}),toasts=[],saves=[],requests=[],chapters=ref(Array.from({length:30},(_,i)=>({id:'c'+i,title:'第'+(i+1)+'章',content:'正文'+i,summary:i<5?'':'原摘要'+i,branchId:'main'})));
 const c={ref,computed:f=>({get value(){return f();}}),AbortController,DOMException,Date,settings:ref({contextHistoryCharLimit:10,contextFullChapters:3}),memoryLibrary:ref({settings:{enabled:false},memories:[],groups:[]}),summaries:ref([]),chapters,visibleChapters:chapters,books:ref([]),currentBookId:ref('b'),activeBranchId:ref('main'),
  cleanNarrativeChapterContent:ch=>String(ch?.content||''),cleanNarrativeChapterSummary:ch=>String(ch?.summary||''),cleanNarrativeSourceText:s=>String(s||''),cleanAIResponse:s=>s,getDisplayChapterTitle:ch=>ch.title,
  isSummaryInCurrentBranch:()=>true,formatSnowwingChapterStoryTimeContext:()=>'',formatSnowwingSummaryStoryTimesContext:()=>'',getValidMemoryRows:()=>[],validMemoryGroups:()=>[],
  openConfirm:(o,cb)=>{c.confirm={o,cb};},showToast:(...a)=>toasts.push(a),saveData:()=>{},saveDataNow:async reason=>{saves.push({reason,chapters:JSON.parse(JSON.stringify(chapters.value))});return true;},markChapterSummaryEdited:()=>{},sanitizeApiErrorDetail:s=>s,
  requireModuleRequest:()=>({ok:true,model:'summary-model'}),buildStoryBibleWritingContextPackage:()=>({worldText:'设定'}),buildNsfwMessages:p=>[{role:'user',content:p}],getAdapterCompletionText:r=>r.text,
  fetchAdapterCompletion:async(req,msg,opts)=>{requests.push({req,msg,opts});return fetch?fetch(req,msg,opts,requests.length):{text:'完整新摘要'};}};
 vm.createContext(c);vm.runInContext(['buildBudgetedChapterHistory','notifyMissingChapterHistory'].map(fn).join('\n')+'\n'+source.slice(source.indexOf('    const summaryBackfillPicker='),source.indexOf('    async function aiRewriteSummary('))+';globalThis.api={get picker(){return summaryBackfillPicker.value;},get job(){return summaryBackfill.value;},get count(){return selectedSummaryBackfillCount.value;},openSummaryBackfill,confirmSummaryBackfill,startSummaryBackfill,stopSummaryBackfill,adoptSummaryCandidate,setChapterSummaryResult};',c);
 return {c,api:c.api,requests,saves,toasts};
}
test('30章缺5章默认选择；两次确认取消均零请求；全有摘要默认无选择',()=>{
 const r=runtime();r.api.openSummaryBackfill();assert.equal(r.api.count,5);assert.equal(r.requests.length,0);r.api.confirmSummaryBackfill();assert.match(r.c.confirm.o.message,/5 次/);assert.equal(r.requests.length,0);
 r.c.chapters.value.forEach(ch=>ch.summary='已完成');r.api.openSummaryBackfill();assert.equal(r.api.count,0);assert.equal(r.api.picker.allComplete,true);assert.equal(r.requests.length,0);
});
test('逐章保存；第二章中止保留半截，已完成和其余章节不变',async()=>{
 let entered;const ready=new Promise(r=>entered=r);const r=runtime(async(_req,_msg,o,n)=>{if(n===1)return{text:'第一章完整'};o.onTextDelta('半截','第二章半截');entered();return new Promise((_resolve,reject)=>o.signal.addEventListener('abort',()=>reject(new DOMException('stop','AbortError')),{once:true}));});
 r.api.openSummaryBackfill();const task=r.api.startSummaryBackfill(r.api.picker.rows.slice(0,5));await ready;r.api.stopSummaryBackfill();await task;
 assert.equal(r.c.chapters.value[0].summary,'第一章完整');assert.equal(r.c.chapters.value[0].summaryIncomplete,false);assert.equal(r.c.chapters.value[1].summary,'第二章半截');assert.equal(r.c.chapters.value[1].summaryIncomplete,true);assert.equal(r.c.chapters.value[2].summary,'');assert.ok(r.saves.some(s=>s.chapters[0].summary==='第一章完整'));assert.equal(r.requests.length,2);
});
test('已有摘要中止保留旧值和可采用候选；并行作者编辑不被覆盖',async()=>{
 const r=runtime(async(_req,_msg,o)=>{o.onTextDelta('半截','新半截');throw new DOMException('stop','AbortError');});r.api.openSummaryBackfill();await r.api.startSummaryBackfill([r.api.picker.rows[5]]);const ch=r.c.chapters.value[5];assert.equal(ch.summary,'原摘要5');assert.equal(ch.summaryCandidate.content,'新半截');assert.equal(ch.summaryCandidate.incomplete,true);r.api.adoptSummaryCandidate(ch);assert.equal(ch.summary,'新半截');assert.equal(ch.summaryIncomplete,true);
 r.api.setChapterSummaryResult(ch,'此前摘要','新结果',false);assert.equal(ch.summary,'新半截');assert.equal(ch.summaryCandidate.content,'新结果');
});
test('预算只限制原文，较早章使用摘要/有效记忆，缺失章号合并提示一次',()=>{
 const r=runtime(),rows=Array.from({length:4},(_,i)=>({id:'x'+i,title:'标题'+i,content:'内容'.repeat(3),summary:i===0?'旧章事实':''}));
 const h=r.c.buildBudgetedChapterHistory(rows,{fullN:4,wholeChapters:true});assert.equal(h.rawChars,10);assert.match(h.text,/旧章事实/);assert.ok(h.text.includes(rows[3].content));assert.deepEqual(Array.from(h.missingChapters),[2,3]);r.c.notifyMissingChapterHistory(h);assert.equal(r.toasts.length,1);assert.match(r.toasts[0][0],/2、3/);
 r.c.memoryLibrary.value.settings.enabled=true;r.c.getValidMemoryRows=()=>[{chapterId:'x1',enabled:true,text:'记忆事实'}];const m=r.c.buildBudgetedChapterHistory(rows,{fullN:4,wholeChapters:true});assert.match(m.text,/记忆事实/);assert.deepEqual(Array.from(m.missingChapters),[3]);
});
test('当前细纲超过旧上限不裁剪，卷交接不在原文预算中；目标摘要请求发送完整正文',async()=>{
 const r=runtime();r.c.chapters.value[0].content='头'+ '中'.repeat(25000)+'目标尾哨兵';r.api.openSummaryBackfill();await r.api.startSummaryBackfill([r.api.picker.rows[0]]);assert.match(r.requests[0].msg[0].content,/目标尾哨兵/);assert.equal(r.requests[0].req.model,'summary-model');assert.equal(r.requests[0].opts.stream,true);assert.ok(!source.includes('clipContextText(currentOutline,'));
 const previous={id:'v1',startChapter:1,endChapter:30},next={id:'v2',startChapter:31,endChapter:40},handoff='交接头'+'中'.repeat(25000)+'交接尾';Object.assign(r.c,{memoryLibrary:{value:{settings:{replaceHistoryWithSummaries:true}}},novel:{value:{volumes:[previous,next]}},getVolumeForChapter:()=>next,normalizeNovelVolumes:v=>v,getVolumeHandoff:()=>({content:handoff,actualOutline:'实际卷纲完整哨兵'})});vm.runInContext(fn('buildChapterHistoryContext'),r.c);const history=r.c.buildChapterHistoryContext(r.c.chapters.value);assert.ok(history.text.includes(handoff));assert.ok(history.text.includes('实际卷纲完整哨兵'));assert.match(history.text,/第31章/);
});
