'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8').replace(/\r\n/g,'\n');
function fn(name){const at=source.indexOf('    function '+name+'(');assert.ok(at>=0,name);return source.slice(at,source.indexOf('\n    }',at)+6);}
const rows=Array.from({length:12},(_,i)=>({id:'c'+(i+1),title:'章节'+(i+1),content:'正文哨兵'+(i+1)+'。'+'文'.repeat(990),summary:'摘要哨兵'+(i+1)+'。'}));
function runtime(settings={},memory={}){
 const c={settings:{value:{contextFullChapters:8,contextSummaryChapters:10,contextHistoryCharLimit:60000,...settings}},memoryLibrary:{value:{settings:{enabled:false,summaryKeepChapters:2,...memory}}},summaries:{value:[]},normalizeReaderScrollSettings:()=>{},normalizeNoOutputTimeout:()=>45,cleanNarrativeChapterContent:ch=>ch.content,cleanNarrativeChapterSummary:ch=>ch.summary,cleanNarrativeSourceText:s=>s,formatSnowwingChapterStoryTimeContext:()=>'',formatSnowwingSummaryStoryTimesContext:()=>'',isSummaryInCurrentBranch:()=>true,getValidMemoryRows:()=>[],validMemoryGroups:()=>[]};
 vm.createContext(c);vm.runInContext(['normalizeContextSettings','buildBudgetedChapterHistory'].map(fn).join('\n'),c);return c;
}
function fullNumbers(history){return rows.filter(ch=>history.text.includes(ch.content)).map(ch=>Number(ch.id.slice(1)));}
test('省token模式加载及生成校正不改写保存的章数和字数上限',()=>{
 const c=runtime({contextCompactMode:true,contextMaxFullChapterChars:8000,contextMaxChapterSummaryChars:900,contextMaxWorldChars:7000,contextMaxCharacterChars:12000,contextMaxOutlineChars:15000});
 const before=JSON.parse(JSON.stringify(c.settings.value));for(let i=0;i<3;i++)c.normalizeContextSettings();for(const [key,value]of Object.entries(before))assert.equal(c.settings.value[key],value,key);
 assert.deepEqual(fullNumbers(c.buildBudgetedChapterHistory(rows)),[11,12]);c.settings.value.contextCompactMode=false;assert.deepEqual(fullNumbers(c.buildBudgetedChapterHistory(rows)),[5,6,7,8,9,10,11,12]);
});
test('只读旧记忆时全文章数仍决定近期原文，不被记忆保留章数覆盖',()=>{
 const c=runtime({}, {enabled:true,summaryKeepChapters:2});c.getValidMemoryRows=()=>rows.map(ch=>({chapterId:ch.id,text:'有效记忆'+ch.id,enabled:true}));const h=c.buildBudgetedChapterHistory(rows);assert.deepEqual(fullNumbers(h),[5,6,7,8,9,10,11,12]);assert.match(h.text,/有效记忆c1/);assert.equal(h.missingChapters.length,0);assert.equal(c.memoryLibrary.value.settings.autoSummarize,undefined);
});
test('0章在普通和省token模式以及记忆开关下均不发送原文',()=>{
 for(const enabled of [false,true])for(const compact of [false,true]){const c=runtime({contextFullChapters:0,contextCompactMode:compact},{enabled});c.normalizeContextSettings();const h=c.buildBudgetedChapterHistory(rows);assert.equal(c.settings.value.contextFullChapters,0);assert.deepEqual(fullNumbers(h),[]);assert.match(h.text,/摘要哨兵12/);}
});
test('主动启用记忆替换时同时遵守全文章数和记忆保留章数',()=>{
 const c=runtime({contextFullChapters:2},{enabled:true,replaceHistoryWithSummaries:true,summaryKeepChapters:10});assert.deepEqual(fullNumbers(c.buildBudgetedChapterHistory(rows)),[11,12]);c.settings.value.contextFullChapters=8;c.memoryLibrary.value.settings.summaryKeepChapters=1;assert.deepEqual(fullNumbers(c.buildBudgetedChapterHistory(rows)),[12]);
});
test('字数预算不足时更早章仍有摘要；提高预算后恢复所选章节原文',()=>{
 const long=rows.map(ch=>({...ch,content:ch.content+'长'.repeat(4000)})),c=runtime({contextHistoryCharLimit:15000});let h=c.buildBudgetedChapterHistory(long);assert.equal(h.rawChars,15000);for(const ch of long)assert.ok(h.text.includes(ch.content)||h.text.includes(ch.summary),ch.id);assert.equal(h.missingChapters.length,0);c.settings.value.contextHistoryCharLimit=60000;h=c.buildBudgetedChapterHistory(long,{wholeChapters:true});assert.equal(long.filter(ch=>h.text.includes(ch.content)).length,8);
});
test('历史缺省保留3章；数字字符串、0、越界和空值正确恢复',()=>{
 for(const [value,expected]of [[undefined,3],[null,3],['',3],['8',8],[0,0],[-2,0],[30,20],['oops',3]]){const c=runtime({contextFullChapters:value});c.normalizeContextSettings();assert.equal(c.settings.value.contextFullChapters,expected,String(value));}
});
test('长章碰到单章上限后继续读取更早原文，记忆开关不绕过单章上限',()=>{
 const long=rows.map(ch=>({...ch,content:'头部'+ch.id+'。'+'文'.repeat(6000)+'尾部'+ch.id+'。'}));
 for(const enabled of [false,true]){const c=runtime({contextFullChapters:4,contextMaxFullChapterChars:1000,contextHistoryCharLimit:15000},{enabled}),h=c.buildBudgetedChapterHistory(long);assert.equal(h.rawChars,4000);for(const ch of long.slice(-4)){assert.ok(h.text.includes('尾部'+ch.id+'。'),ch.id);assert.ok(h.text.includes(ch.summary),ch.id+'摘要');assert.ok(!h.text.includes('头部'+ch.id+'。'),ch.id+'单章上限');}assert.equal(h.missingChapters.length,0);}
});
