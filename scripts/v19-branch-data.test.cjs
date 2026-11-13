'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {branchHarness,fn,clone}=require('./v19-branch-harness.cjs');
function state(c){return clone({chapters:c.chapters.value,branches:c.branchList.value,planning:c.branchData.value,novel:c.novel.value,summaries:c.summaries.value,memory:c.memoryLibrary.value,mods:c.modPrivateData.value,active:c.activeBranchId.value});}
function addChapter(c,no){const id='own-'+no;const row={id,branchId:c.activeBranchId.value,title:'自有'+no,content:'自有正文'+no,summary:'自有摘要'+no,versions:[{content:'自有旧稿'+no}]};c.chapters.value.push(row);c.chapterOutlines.value.push({id:'own-o'+no,chapterNo:no,title:row.title,content:'自有细纲'+no,history:[]});c.chapterIndexDrafts.value.push({chapterNo:no,title:row.title});return row;}

test('分支规划整份复制到分叉点，历史保留，未来回收清除；空首章分支不继承第一章',()=>{
 const {c}=branchHarness(),copied=c.createBranchPlanningData(2);
 assert.equal(copied.chapterOutlines.length,3);assert.equal(copied.chapterOutlines[0].history[0].content,'旧细纲');assert.equal(copied.chapterIndexDrafts.length,3);assert.equal(copied.outlineEdits,undefined);assert.equal(copied.outlineTail,undefined);
 assert.equal(copied.foreshadowMatrix[0].resolvedChapter,'');assert.notEqual(copied.foreshadowMatrix[0].status,'回收');copied.chapterOutlines[0].content='分支改变';assert.equal(c.branchData.value.main.chapterOutlines[0].content,'主线细纲1');assert.equal(c.createBranchPlanningData(-1).chapterOutlines.length,0);
});

test('稀疏细纲按实际章号截断，不能把分叉点后的规划误复制进支线',()=>{
 const {c}=branchHarness();c.branchData.value.main.chapterOutlines=[{id:'sparse2',chapterNo:2,content:'第2章既有规划'},{id:'sparse5',chapterNo:5,content:'第5章未来规划'}];const branch=c.createBranchPlanningData(2,'main');assert.deepEqual(clone(branch.chapterOutlines.map(row=>row.chapterNo)),[2]);assert.equal(branch.chapterOutlines[0].content,'第2章既有规划');
});

test('主线与两层支线拥有各自完整章节、新id和规划；手改祖章只影响当前线且上下文读最新正文',async()=>{
 const r=branchHarness(),{c}=r,parent=await c.forkBranch(2);assert.ok(parent);assert.equal(parent.parentId,'main');assert.equal(parent.forkChapterId,'c3');assert.equal(c.visibleChapters.value.length,3);
 addChapter(c,4);addChapter(c,5);c.persistCurrentBranchData();const parentIds=c.visibleChapters.value.map(ch=>ch.id),child=await c.forkBranch(4);assert.ok(child);assert.equal(child.parentId,parent.id);assert.equal(child.forkIndex,4);assert.equal(child.forkChapterId,parentIds[4]);assert.equal(c.visibleChapters.value.length,5);
 const own=c.visibleChapters.value;assert.equal(new Set(c.chapters.value.map(ch=>ch.id)).size,c.chapters.value.length);assert.ok(own.every(ch=>ch.branchId===child.id&&!parentIds.includes(ch.id)));assert.equal(own[0].summary,'摘要1');assert.equal(own[0].versions[0].content,'旧稿1');assert.equal(own[0].summaryCandidate.content,'候选1');assert.equal(c.chapterOutlines.value.length,5);assert.equal(c.chapterOutlines.value[4].content,'自有细纲5');
 own[1].content='孙分支独立第二章哨兵';own[1].versions[0].content='孙分支旧稿';c.chapterOutlines.value[1].content='孙分支独立细纲';c.persistCurrentBranchData();
 const main=c.chapters.value.find(ch=>ch.id==='c2'),parentSecond=c.chapters.value.find(ch=>ch.id===parentIds[1]);main.content='主线后来修改哨兵';parentSecond.content='父分支后来修改哨兵';assert.equal(own[1].content,'孙分支独立第二章哨兵');assert.equal(parentSecond.versions[0].content,'旧稿2');assert.equal(c.branchData.value.main.chapterOutlines[1].content,'主线细纲2');assert.equal(c.branchData.value[parent.id].chapterOutlines[1].content,'主线细纲2');
 Object.assign(c,{settings:{value:{contextHistoryCharLimit:1000,contextFullChapters:10}},cleanNarrativeChapterContent:ch=>ch.content,cleanNarrativeChapterSummary:ch=>ch.summary,cleanNarrativeSourceText:s=>s,isSummaryInCurrentBranch:row=>row.branchId===c.activeBranchId.value,formatSnowwingChapterStoryTimeContext:()=>'',formatSnowwingSummaryStoryTimesContext:()=>'',getValidMemoryRows:()=>[],validMemoryGroups:()=>[]});vm.runInContext(fn('buildBudgetedChapterHistory'),c);const sent=c.buildBudgetedChapterHistory(c.visibleChapters.value,{wholeChapters:true,fullN:10});assert.match(sent.text,/孙分支独立第二章哨兵/);assert.doesNotMatch(sent.text,/主线后来修改哨兵|父分支后来修改哨兵/);
 const restored=branchHarness().c,saved=state(c);restored.branchList.value=saved.branches;restored.chapters.value=saved.chapters;restored.branchData.value=restored.normalizeBranchData(saved.planning);restored.activeBranchId.value=child.id;restored.loadBranchScopedData(child.id);assert.equal(restored.visibleChapters.value.length,5);assert.equal(restored.visibleChapters.value[1].content,'孙分支独立第二章哨兵');assert.equal(restored.chapterOutlines.value[1].content,'孙分支独立细纲');assert.equal(restored.getBranchForkEnd(child.id),5);
});

test('分叉截断并复制摘要、记忆、喜欢、范文、卷交接和图片，副本不共享嵌套对象',async()=>{
 const {c,images}=branchHarness(),branch=await c.forkBranch(2),copied=c.visibleChapters.value;
 const summaries=c.summaries.value.filter(row=>row.branchId===branch.id);assert.equal(summaries.length,1);assert.equal(summaries[0].content,'前三章总结');assert.notEqual(summaries[0].id,'s1');
 const memories=c.memoryLibrary.value.memories.filter(row=>row.branchId===branch.id);assert.equal(memories.length,3);assert.deepEqual(memories.map(row=>row.chapterId),copied.map(ch=>ch.id));
 const groups=c.memoryLibrary.value.groups.filter(row=>row.key!=='g1'&&row.key!=='g2');assert.equal(groups.length,1);assert.deepEqual(groups[0].sourceMemories.map(row=>row.chapterId),copied.map(ch=>ch.id));
 const liked=c.novel.value.favoriteClips.filter(row=>row.branchId===branch.id);assert.equal(liked.length,1);assert.notEqual(liked[0].id,'like1');assert.equal(liked[0].chapterId,copied[0].id);const styles=c.novel.value.styleSources[branch.id];assert.equal(styles.copies.length,2);assert.equal(styles.copies[0].id,liked[0].id);assert.equal(styles.copies[0].key,'book:'+liked[0].id);assert.equal(styles.copies[0].branchId,branch.id);assert.equal(styles.copies[1].snapshot,'跨书离线范文');
 const volumes=c.novel.value.volumes;assert.equal(volumes[0].handoffSummaries[branch.id].content,'前三章交接');assert.equal(volumes[1].handoffSummaries[branch.id],undefined);volumes[0].handoffSummaries[branch.id].content='独立交接';assert.equal(volumes[0].handoffSummaries.main.content,'前三章交接');
 assert.deepEqual(c.modPrivateData.value[branch.id].map(row=>row.chapterId),copied.map(ch=>ch.id));assert.ok(images.has('img_v17_book:'+copied[0].id+':插图:0'));assert.ok(images.has('img_'+copied[1].id+'_1'));assert.ok(images.has('img_v17_book:c1:插图:0'));images.get('img_v17_book:'+copied[0].id+':插图:0').versions[0].src='新图';assert.equal(images.get('img_v17_book:c1:插图:0').versions[0].src,'原图');
});

test('复制中途失败或最终保存失败，撤回全部新分支数据和图片并保留原有内容',async()=>{
 for(const mode of ['chapter-copy','mod-copy','save','image-copy']){
  const r=branchHarness(),{c}=r;c.persistCurrentBranchData();const before=state(c),beforeImages=clone([...r.images]);let saveCalls=0;
  if(mode==='chapter-copy')c.deepClone=value=>{if(value?.id==='c2'&&value.content==='正文2')throw Error('模拟章节复制失败');return clone(value);};
  if(mode==='mod-copy')c.cloneModMemorySummaryScopesForBranch=()=>{c.modPrivateData.value.half={content:'半截数据'};throw Error('模拟MOD复制失败');};
  if(mode==='save')c.saveDataNow=async()=>++saveCalls>1;
  if(mode==='image-copy'){let writes=0;const set=c.ImageStore.set;c.ImageStore.set=async(...args)=>{if(++writes===2)throw Error('模拟图片复制失败');return set(...args);};}
  assert.equal(await c.forkBranch(2),false,mode);assert.deepEqual(state(c),before,mode+' 数据完整回滚');assert.deepEqual(clone([...r.images]),beforeImages,mode+' 图片回滚');assert.ok(r.toasts.some(row=>/已撤回未完成副本/.test(row[0])),mode);c.deepClone=clone;c.cloneModMemorySummaryScopesForBranch=()=>0;assert.equal(await c.forkBranch(-1)!==false,true,mode+' 互斥锁已释放');
 }
});

test('删除父分支只清理该线，子分支重挂主线且正文规划和素材不变',async()=>{
 const {c}=branchHarness(),parent=await c.forkBranch(2);addChapter(c,4);addChapter(c,5);const child=await c.forkBranch(4),before=clone({chapters:c.visibleChapters.value,planning:c.branchData.value[child.id],styles:c.novel.value.styleSources[child.id],likes:c.novel.value.favoriteClips.filter(row=>row.branchId===child.id)});
 c.deleteBranch(parent.id);assert.match(c.confirm.config.message,/还有 1 条子分支，它们的内容不受影响/);c.confirm.callback();assert.equal(c.branchList.value.some(row=>row.id===parent.id),false);assert.equal(c.branchList.value.find(row=>row.id===child.id).parentId,'main');assert.equal(c.activeBranchId.value,child.id);assert.deepEqual(clone({chapters:c.visibleChapters.value,planning:c.branchData.value[child.id],styles:c.novel.value.styleSources[child.id],likes:c.novel.value.favoriteClips.filter(row=>row.branchId===child.id)}),before);assert.ok(c.chapters.value.every(ch=>ch.branchId!==parent.id));assert.equal(c.branchData.value[parent.id],undefined);assert.equal(c.novel.value.styleSources[parent.id],undefined);assert.ok(c.memoryLibrary.value.memories.every(row=>row.branchId!==parent.id));
});

test('从首章前分出空支线，再次分叉仍可用，不带任何正文、摘要或记忆',async()=>{
 const {c}=branchHarness(),parent=await c.forkBranch(-1);assert.ok(parent);assert.equal(c.visibleChapters.value.length,0);assert.equal(c.chapterOutlines.value.length,0);assert.equal(parent.forkIndex,-1);assert.equal(parent.forkChapterId,null);assert.equal(c.summaries.value.filter(row=>row.branchId===parent.id).length,0);assert.equal(c.memoryLibrary.value.memories.filter(row=>row.branchId===parent.id).length,0);const child=await c.forkBranch(-1);assert.ok(child);assert.equal(child.parentId,parent.id);assert.equal(c.visibleChapters.value.length,0);
});

test('待核对标记全书合计最多200条，保留较新的条目',()=>{
 const {c}=branchHarness(),data={main:{staleMarks:[]},b:{staleMarks:[]}};for(let i=0;i<150;i++){data.main.staleMarks.push({id:'m'+i,at:i});data.b.staleMarks.push({id:'b'+i,at:150+i});}c.trimBranchStaleMarks(data);assert.equal(data.main.staleMarks.length+data.b.staleMarks.length,200);assert.equal(data.main.staleMarks[0].id,'m100');assert.equal(data.b.staleMarks.length,150);
});

test('MOD长期记忆仅复制分叉前已完成项，章节id/分支/hash重算且重复调用不再复制',()=>{
 const store={scopes:{main:{entries:[{id:'e1',sourceChapterId:'old1',sourceChapterIndex:0,status:'completed',text:'已发生事实'},{id:'e2',sourceChapterId:'old2',status:'failed',text:'未完成'},{id:'e6',sourceChapterId:'old6',status:'completed',text:'未来事实'}]}}},rows=[{id:'t1',sourceChapterId:'old1',branchScopeId:'main',sourceChapterBranchId:'main',status:'completed',enabled:true,text:'已发生事实'}],mod={id:'snowwing'},sourceBefore=clone(store.scopes.main);let invalidations=0;
 const c={deepClone:clone,chapters:{value:[{id:'new1',content:'复制正文'}]},isModPermissionEnabled:()=>true,getModMemorySummaryStore:()=>store,getModMemorySummaryScope:(_mod,id,create)=>store.scopes[id]||(create?store.scopes[id]={entries:[]}:null),getModMemorySummaryEntryId:(id,ch)=>id+':'+ch,getModMemorySummarySchema:()=>({id:'memory'}),getModTableRows:()=>rows,markModVectorIndexStale:()=>invalidations++,simpleHash:value=>value,buildModMemorySummarySource:(ch,index,bid)=>({sourceChapterId:ch.id,sourceChapterIndex:index,sourceChapterBranchId:bid,sourceHash:'复制后正文hash',content:ch.content})};
 vm.createContext(c);vm.runInContext(fn('cloneModMemorySummaryScopeForBranch'),c);const idMap=new Map([['old1','new1'],['old2','new2']]);assert.equal(c.cloneModMemorySummaryScopeForBranch(mod,'main','child',['old1','old2'],idMap),1);const entry=store.scopes.child.entries[0],row=rows.find(item=>item.branchScopeId==='child');assert.equal(entry.sourceChapterId,'new1');assert.equal(entry.branchScopeId,'child');assert.equal(entry.sourceChapterHash,'复制后正文hash');assert.equal(entry.sourceHash,'复制后正文hash');assert.equal(entry.content,undefined);assert.equal(row.sourceChapterId,'new1');assert.equal(row.sourceChapterBranchId,'child');assert.equal(row.sourceChapterHash,'复制后正文hash');assert.equal(invalidations,1);assert.deepEqual(store.scopes.main,sourceBefore);
 assert.equal(c.cloneModMemorySummaryScopeForBranch(mod,'main','child',['old1','old2'],idMap),0);assert.equal(store.scopes.child.entries.length,1);assert.equal(rows.filter(item=>item.branchScopeId==='child').length,1);assert.equal(c.cloneModMemorySummaryScopeForBranch(mod,'main','empty',[],new Map()),0);assert.equal(store.scopes.empty.entries.length,0);
});
