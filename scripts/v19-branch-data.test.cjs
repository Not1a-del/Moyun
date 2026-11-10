'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8');
function harness(){
  const clone=x=>JSON.parse(JSON.stringify(x));
  const c={deepClone:clone,uid:()=> 'id',branchList:{value:[{id:'main'},{id:'b',forkIndex:1},{id:'negative',forkIndex:-1},{id:'legacy',forkIndex:1}]},activeBranchId:{value:'main'},branchData:{value:{}},chapterOutlines:{value:[]},chapterIndexDrafts:{value:[]},foreshadowMatrix:{value:[]},staleMarks:{value:[]},normalizeChapterIndexDrafts:x=>clone(x||[]),normalizeForeshadowMatrix:x=>clone(x||[]),normalizeStaleMarks:x=>clone(x||[]),parseChapterRefs:x=>(String(x||'').match(/\d+/g)||[]).map(Number)};
  vm.createContext(c);
  const normalize=source.slice(source.indexOf('    function normalizeChapterOutline('),source.indexOf('    function archiveChapterOutline('));
  const helpers=source.slice(source.indexOf('    function getBranchForkEnd('),source.indexOf('    function markStale('));
  vm.runInContext(normalize+helpers,c);
  const main={chapterOutlines:[1,2,3,4].map(n=>({id:'o'+n,chapterNo:n,title:'第'+n+'章',content:'主线'+n,history:[{content:'旧'}]})),chapterIndexDrafts:[1,2,3,4].map(n=>({chapterNo:n,title:'索引'+n})),foreshadowMatrix:[{id:'d',resolvedChapter:'4',status:'回收',note:'原计划'}]};
  c.branchData.value=c.normalizeBranchData({},main);c.loadBranchScopedData('main');return c;
}
test('新分支只保存差量、不复制历史；分叉后细纲空白、实际回收清除',()=>{
  const c=harness(),b=c.createBranchPlanningData(1);c.branchData.value.b=b;c.activeBranchId.value='b';c.loadBranchScopedData('b');
  assert.equal(c.chapterOutlines.value.length,2);assert.equal(c.chapterOutlines.value[0].history,undefined);
  assert.equal(Object.keys(b.outlineEdits).length,0);assert.equal(b.outlineTail.length,0);assert.equal(b.chapterOutlines,undefined);
  assert.equal(b.foreshadowMatrix[0].resolvedChapter,'');assert.notEqual(b.foreshadowMatrix[0].status,'回收');
  c.chapterOutlines.value[1].content='分支第二章';c.chapterOutlines.value.push({id:'b3',chapterNo:3,title:'支线3',content:'支线独有'});c.persistCurrentBranchData();
  assert.equal(Object.keys(c.branchData.value.b.outlineEdits).length,1);assert.equal(c.branchData.value.b.outlineTail.length,1);assert.equal(c.branchData.value.main.chapterOutlines[1].content,'主线2');
});
test('未改的继承细纲跟随主线，改过的细纲和暗线保持独立；刷新往返完整',()=>{
  const c=harness();c.branchData.value.b=c.createBranchPlanningData(1);c.activeBranchId.value='b';c.loadBranchScopedData('b');
  c.chapterOutlines.value[1].content='独立';c.foreshadowMatrix.value[0].note='分支暗线';c.persistCurrentBranchData();
  c.branchData.value.main.chapterOutlines[0].content='主线更新';c.branchData.value.main.foreshadowMatrix[0].note='主线暗线更新';
  c.branchData.value=c.normalizeBranchData(JSON.parse(JSON.stringify(c.branchData.value)));c.loadBranchScopedData('b');
  assert.equal(c.chapterOutlines.value[0].content,'主线更新');assert.equal(c.chapterOutlines.value[1].content,'独立');assert.equal(c.foreshadowMatrix.value[0].note,'分支暗线');
});
test('负数分叉点不继承第一章；旧分支惰性迁移保留原先共享细纲尾部',()=>{
  const c=harness();assert.equal(c.branchData.value.legacy,undefined);c.loadBranchScopedData('legacy');assert.equal(c.chapterOutlines.value.length,4);assert.equal(c.branchData.value.legacy.outlineTail.length,2);
  c.branchData.value.negative=c.createBranchPlanningData(-1);c.loadBranchScopedData('negative');assert.equal(c.chapterOutlines.value.length,0);
});
test('旧预览整份分支迁移保留修改，消除冗余继承副本',()=>{
  const c=harness(),main=c.branchData.value.main,old=JSON.parse(JSON.stringify(main));old.inheritedChapterOutlines=JSON.parse(JSON.stringify(main.chapterOutlines.slice(0,2)));old.chapterOutlines[1].content='旧分支修改';
  const result=c.normalizeBranchData({main,b:old});assert.equal(result.b.chapterOutlines,undefined);assert.equal(result.b.inheritedChapterOutlines,undefined);assert.equal(result.b.outlineEdits.o2.content,'旧分支修改');assert.equal(Object.keys(result.b.outlineEdits).length,1);
});

test('分叉前修改按章节 id 跟随重排，不覆盖换到原编号的另一章',()=>{
  const c=harness();c.branchData.value.b=c.createBranchPlanningData(1);c.activeBranchId.value='b';c.loadBranchScopedData('b');c.chapterOutlines.value[1].content='独立第二章';c.persistCurrentBranchData();
  const main=c.branchData.value.main.chapterOutlines;[main[0].chapterNo,main[1].chapterNo]=[2,1];c.loadBranchScopedData('b');
  assert.equal(c.chapterOutlines.value[0].id,'o2');assert.equal(c.chapterOutlines.value[0].content,'独立第二章');assert.equal(c.chapterOutlines.value[1].content,'主线1');
});

test('待核对标记全书合计最多200条，保留较新的条目',()=>{
  const c=harness(),data={main:{staleMarks:[]},b:{staleMarks:[]}};
  for(let i=0;i<150;i++){data.main.staleMarks.push({id:'m'+i,at:i});data.b.staleMarks.push({id:'b'+i,at:150+i});}
  c.trimBranchStaleMarks(data);assert.equal(data.main.staleMarks.length+data.b.staleMarks.length,200);assert.equal(data.main.staleMarks[0].id,'m100');assert.equal(data.b.staleMarks.length,150);
});
