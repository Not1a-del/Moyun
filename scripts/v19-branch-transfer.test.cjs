'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {fn,clone}=require('./v19-branch-harness.cjs');
function harness(){
 const data={branchList:[{id:'main',name:'主线',createdAt:1},{id:'parent',name:'分支1',parentId:'main',forkIndex:2,createdAt:10},{id:'child',name:'分支1-1',parentId:'parent',forkIndex:4,createdAt:20}],activeBranchId:'child',chapters:[],summaries:[],branchData:{},novel:{title:'分支传输书',favoriteClips:[],styleSources:{},volumes:[{id:'volume',actualSummary:'主线旧交接',actualOutline:'主线旧卷纲',handoffSummaries:{}}]},memoryLibrary:{memories:[],groups:[]},modPrivateData:{mod:{memorySummary:{scopes:{}},tables:{memory:[]}}},_imageCache:{},interruptedDraft:{branchId:'child',content:'未完成正文'}};
 for(const [id,count]of [['main',6],['parent',5],['child',5]]){
  const rows=Array.from({length:count},(_,i)=>({id:id+'-c'+(i+1),branchId:id,title:id+'标题'+(i+1),content:id+'正文'+(i+1),summary:id+'摘要'+(i+1),versions:[{content:'完整旧稿'}]}));data.chapters.push(...rows);data.summaries.push({id:id+'-sum',branchId:id,startChapter:1,endChapter:3,content:id+'范围总结'});
  data.branchData[id]={chapterOutlines:rows.map((row,i)=>({id:id+'-o'+i,chapterNo:i+1,content:id+'细纲'+(i+1)})),chapterIndexDrafts:[{chapterNo:1,title:id+'索引'}],foreshadowMatrix:[{id:id+'-dark',note:id+'暗线'}],staleMarks:[{id:id+'-stale',branchId:id,targetId:id+'-o0'}]};
  const favorite={id:id+'-like',chapterId:rows[0].id,branchId:id,snapshot:id+'范文快照',paragraphIndex:0};data.novel.favoriteClips.push(favorite);data.novel.styleSources[id]={mode:'favorites',copies:[{...clone(favorite),key:'book:'+favorite.id,bookId:'book'},{id:'external',bookId:'external-book',branchId:'main',key:'external-book:external',snapshot:'离线跨书快照'}]};
  data.novel.volumes[0].handoffSummaries[id]={branchId:id,content:id+'最新交接',actualOutline:id+'最新卷纲',edited:true};
  data.memoryLibrary.memories.push(...rows.map(row=>({chapterId:row.id,branchId:id,text:id+'记忆'})));data.memoryLibrary.groups.push({key:id+'-group',sourceMemories:rows.slice(0,2).map(row=>({chapterId:row.id})),text:id+'合并记忆'});
  const entry={id:id+'-entry',branchScopeId:id,sourceChapterId:rows[0].id,sourceChapterBranchId:id,status:'completed',text:id+'MOD记忆'};data.modPrivateData.mod.memorySummary.scopes[id]={entries:[entry]};data.modPrivateData.mod.tables.memory.push(clone(entry));data._imageCache['img_v17_book:'+rows[0].id+':插图:0']={src:id+'原图'};
 }
 const c={deepClone:clone,uid:()=> 'volume',currentBookId:{value:'book'},transferQuery:{value:''},transferLimit:{value:0},transferError:{value:''},transferState:{value:null},pendingTransferData:null,BOOK_FIELDS:Object.keys(data),PRESET_FIELDS:[],makeTransferRows:obj=>Object.keys(obj).map(key=>({path:[key],selected:true}))};vm.createContext(c);vm.runInContext([fn('normalizeNovelVolumes'),fn('readBranchNovelPlanning'),fn('selectBookBranches'),fn('transferSelectionPayload'),fn('initTransfer')].join('\n'),c);return {c,data};
}
function assertScopes(result,ids,counts){
 assert.deepEqual(clone(result.branchList.map(row=>row.id)),ids);assert.deepEqual(Object.keys(result.branchData).sort(),ids.slice().sort());assert.deepEqual(Object.keys(result.novel.styleSources).sort(),ids.slice().sort());assert.deepEqual(Object.keys(result.novel.volumes[0].handoffSummaries).sort(),ids.slice().sort());assert.deepEqual(Object.keys(result.modPrivateData.mod.memorySummary.scopes).sort(),ids.slice().sort());
 for(const [id,count]of Object.entries(counts))assert.equal(result.chapters.filter(row=>row.branchId===id).length,count,id+' 完整章节数');for(const rows of [result.chapters,result.summaries,result.memoryLibrary.memories,result.novel.favoriteClips,result.modPrivateData.mod.tables.memory])assert.ok(rows.every(row=>ids.includes(row.branchId||row.branchScopeId)));
 const chapters=new Set(result.chapters.map(row=>row.id));assert.ok(result.memoryLibrary.groups.every(row=>row.sourceMemories.every(item=>chapters.has(item.chapterId))));assert.ok(Object.keys(result._imageCache).every(key=>chapters.has(key.split(':')[1])));
}

test('只导出孙分支，提升为main，正文旧稿/所有分支资料完整，原书不变',()=>{
 const {c,data}=harness(),before=clone(data),out=c.selectBookBranches(data,['child']);assertScopes(out,['main'],{main:5});assert.equal(out.chapters[1].content,'child正文2');assert.equal(out.chapters[0].versions[0].content,'完整旧稿');assert.equal(out.branchList[0].parentId,null);assert.equal(out.activeBranchId,'main');assert.equal(out.chapterOutlines[0].content,'child细纲1');assert.equal(out.novel.volumes[0].actualSummary,'child最新交接');assert.equal(out.novel.volumes[0].actualOutline,'child最新卷纲');assert.equal(out.novel.volumes[0].handoffSummaries.main.edited,true);assert.equal(out.branchData.main.staleMarks[0].branchId,'main');assert.equal(out.modPrivateData.mod.memorySummary.scopes.main.entries[0].sourceChapterBranchId,'main');assert.deepEqual(data,before);
});

test('导入不选原主线时最早createdAt成为main，其余父子关系保留；缺父级挂新主线',()=>{
 const {c,data}=harness();const both=c.selectBookBranches(data,['child','parent']);assertScopes(both,['main','child'],{main:5,child:5});assert.equal(both.branchList[0].name,'分支1');assert.equal(both.branchList.find(row=>row.id==='child').parentId,'main');assert.equal(both.chapters.find(row=>row.branchId==='main').content,'parent正文1');const parentMissing=c.selectBookBranches(data,['main','child']);assertScopes(parentMissing,['main','child'],{main:6,child:5});assert.equal(parentMissing.branchList.find(row=>row.id==='child').parentId,'main');assert.equal(parentMissing.branchList[0].createdAt,1);
});

test('保留原主线时排除未选孙支线，其余资料独立；空选择不允许导出导入',()=>{
 const {c,data}=harness(),out=c.selectBookBranches(data,['main','parent']);assertScopes(out,['main','parent'],{main:6,parent:5});assert.equal(out.branchList.find(row=>row.id==='parent').parentId,'main');assert.equal(out.interruptedDraft,null);assert.equal(out.activeBranchId,'main');out.chapters[0].content='编辑导出副本';assert.equal(data.chapters[0].content,'main正文1');assert.throws(()=>c.selectBookBranches(data,[]),/至少选择一条分支/);
});

test('新主线的本书范文副本和中断稿重映射，跨书范文的来源分支不变',()=>{
 const {c,data}=harness(),out=c.selectBookBranches(data,['child']);assert.equal(out.novel.styleSources.main.copies[0].branchId,'main');assert.equal(out.novel.styleSources.main.copies[0].snapshot,'child范文快照');assert.equal(out.novel.styleSources.main.copies[1].branchId,'main');assert.equal(out.novel.styleSources.main.copies[1].bookId,'external-book');assert.equal(out.interruptedDraft.branchId,'main');assert.equal(out.interruptedDraft.content,'未完成正文');
});

test('导出和导入面板默认全选、显示自有章节/上级，实际载荷受分支勾选控制',()=>{
 for(const kind of ['book-export','book-import']){const {c,data}=harness();c.initTransfer(kind,data,'分支筛选','测试.json');const state=c.transferState.value;assert.equal(state.branches.length,3);assert.ok(state.branches.every(row=>row.selected));assert.equal(state.branches[1].chapterCount,5);assert.equal(state.branches[2].parentName,'分支1');state.branches.forEach(row=>row.selected=row.id==='child');const only=c.transferSelectionPayload();assertScopes(only,['main'],{main:5});assert.equal(only.branchList[0].name,'分支1-1');state.branches.forEach(row=>row.selected=false);assert.throws(()=>c.transferSelectionPayload(),/至少选择一条分支/);}
});
