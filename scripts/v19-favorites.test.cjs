'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8');
const clone=x=>JSON.parse(JSON.stringify(x));
function section(start,end){const at=source.indexOf(start);assert.ok(at>=0,start);const to=source.indexOf(end,at);assert.ok(to>at,end);return source.slice(at,to);}
function runtime(){
 const ref=value=>({value}),saves=[],toasts=[],jumps=[],loads=[],paragraphJumps=[];let serial=0;
 const main={id:'m1',branchId:'main',title:'渡口',content:'阿青停在渡口。\n\n阿白收起船桨。'},side={id:'s1',branchId:'side',title:'支线渡口',content:'支线正文。'};
 const novel=ref({title:'当前书'}),chapters=ref([main,side]),currentBookId=ref('book-a'),activeBranchId=ref('main');
 const current={id:'book-a',title:'当前书',novel:novel.value,chapters:chapters.value};
 const other={id:'book-b',title:'其他书',novel:{favoriteClips:[{id:'other-f',chapterId:'other-c',chapterTitle:'其他章',branchId:'main',paragraphIndex:null,snapshot:'其他书快照',wordCount:6,at:1,status:''}]},chapters:[{id:'other-c',branchId:'main',title:'其他章',content:'其他书原文。'}]};
 const c={ref,computed:f=>({get value(){return f();}}),Date,WeakMap,Map,novel,chapters,currentBookId,activeBranchId,books:ref([current,other]),structuredCharacters:ref([{name:'阿青'},{name:'阿白'}]),imageGenEnabled:ref(false),
  uid:()=> 'favorite-'+(++serial),cleanNarrativeChapterContent:ch=>String(ch?.content||''),getDisplayChapterTitle:ch=>ch.title,getCleanWordCount:text=>String(text).replace(/\s/g,'').length,
  replaceInlineImageTags:text=>text,normalizeParagraphText:text=>String(text).trim(),simpleHash:text=>String(text).length,renderChapterContent:ch=>ch.content,scheduleCachedImageLoad(){},
  openConfirm:(config,cb)=>{c.confirm={config,cb};},showToast:(...args)=>toasts.push(args),saveDataNow:async reason=>{saves.push({reason,bookId:currentBookId.value,novel:clone(novel.value)});return true;},
  showSettings_modal:ref(true),mobileSidebarOpen:ref(true),scrollToChapter:idx=>jumps.push({bookId:currentBookId.value,branchId:activeBranchId.value,idx}),nextTick:async()=>{},
  document:{querySelector:selector=>({scrollIntoView:options=>paragraphJumps.push({selector,options})})}};
 c.visibleChapters={get value(){return chapters.value.filter(ch=>String(ch.branchId||'main')===activeBranchId.value);}};
 c.loadBook=id=>{loads.push(id);const book=c.books.value.find(row=>row.id===id);if(!book)return false;currentBookId.value=id;novel.value=book.novel;chapters.value=book.chapters;activeBranchId.value=book.activeBranchId||'main';return true;};
 c.switchBranch=id=>{activeBranchId.value=id;};
 vm.createContext(c);vm.runInContext(section('    const chapterParagraphCache=','    // 中文注释：读取或计算派生数据函数 `getParagraphComments`')+'\n'+section('    const FAVORITE_CHAR_WARNING =','    const currentWritingStyleId =')+'\n;globalThis.api={currentFavoriteClips,favoriteStatus,refreshFavoriteStatuses,saveFavoriteClip,openFavoriteChoice,hasParagraphFavorite,toggleParagraphFavorite,removeFavorite,jumpToFavorite,updateFavorite,get rows(){return favoriteMaterialRows.value;},get selection(){return favoriteSelection.value;},set scope(value){favoriteScope.value=value;}};',c);
 return {c,api:c.api,main,side,current,other,saves,toasts,jumps,loads,paragraphJumps};
}

test('整篇与段落喜欢保留独立原文快照、章号位置和角色名单，切换可取消',()=>{
 const r=runtime();r.api.openFavoriteChoice(r.main,0);assert.equal(r.api.currentFavoriteClips().length,0);r.c.confirm.cb('whole');
 let clips=r.api.currentFavoriteClips();assert.equal(clips.length,1);assert.equal(clips[0].chapterId,'m1');assert.equal(clips[0].chapterTitle,'渡口');assert.equal(clips[0].paragraphIndex,null);assert.equal(clips[0].snapshot,r.main.content);assert.equal(clips[0].wordCount,r.c.getCleanWordCount(r.main.content));assert.equal(clips[0].branchId,'main');assert.ok(clips[0].at>0);assert.deepEqual(Array.from(clips[0].sourceCharacterNames),['阿青','阿白']);assert.equal(clips[0]._moyunUserInput,undefined);
 r.api.openFavoriteChoice(r.main,0);r.c.confirm.cb('paragraph');assert.equal(r.api.selection.chapterId,'m1');r.api.toggleParagraphFavorite(r.main,0,1,'阿白收起船桨。');clips=r.api.currentFavoriteClips();assert.equal(clips.length,2);assert.equal(clips[1].paragraphIndex,1);assert.equal(clips[1].snapshot,'阿白收起船桨。');assert.equal(r.api.hasParagraphFavorite('m1',1),true);
 r.api.toggleParagraphFavorite(r.main,0,1,'阿白收起船桨。');assert.equal(r.api.hasParagraphFavorite('m1',1),false);r.api.openFavoriteChoice(r.main,0);r.c.confirm.cb('whole');assert.equal(r.api.currentFavoriteClips().length,0);assert.ok(r.saves.length>=4);
});

test('改写和删章不删除喜欢快照，状态及序列化后的记录正确',()=>{
 const r=runtime();r.api.saveFavoriteClip(r.main,0,null,r.main.content);r.api.saveFavoriteClip(r.main,0,1,'阿白收起船桨。');const snapshots=r.api.currentFavoriteClips().map(row=>row.snapshot);
 r.main.content='阿青离开渡口。\n\n阿白重新撑船。';r.api.refreshFavoriteStatuses();assert.ok(r.api.currentFavoriteClips().every(row=>row.status==='原文已修改'));assert.deepEqual(Array.from(r.api.currentFavoriteClips(),row=>row.snapshot),Array.from(snapshots));
 r.c.chapters.value=r.c.chapters.value.filter(ch=>ch.id!=='m1');r.api.refreshFavoriteStatuses();assert.ok(r.api.currentFavoriteClips().every(row=>row.status==='原文已删除'));const restored=clone(r.c.novel.value);assert.equal(restored.favoriteClips.length,2);assert.equal(restored.favoriteClips[1].snapshot,'阿白收起船桨。');assert.equal(restored.favoriteClips[1].status,'原文已删除');
});

test('整篇更新沿用记录ID；段落更新须重新选段，选后才替换快照',async()=>{
 const r=runtime();r.api.saveFavoriteClip(r.main,0,null,r.main.content);r.api.saveFavoriteClip(r.main,0,1,'阿白收起船桨。');const [whole,paragraph]=r.api.rows;
 r.main.content='阿青已经离港。\n\n一声汽笛。\n\n阿白停船。';await r.api.updateFavorite({...whole,status:'原文已修改'});assert.equal(r.api.currentFavoriteClips()[0].id,whole.id);assert.equal(r.api.currentFavoriteClips()[0].snapshot,r.main.content);assert.equal(r.api.favoriteStatus(r.api.currentFavoriteClips()[0]),'');
 await r.api.updateFavorite({...paragraph,status:'原文已修改'});assert.equal(r.api.selection.updateId,paragraph.id);assert.equal(r.api.currentFavoriteClips()[1].snapshot,'阿白收起船桨。');r.api.toggleParagraphFavorite(r.main,0,2,'阿白停船。');const updated=r.api.currentFavoriteClips()[1];assert.equal(updated.id,paragraph.id);assert.equal(updated.paragraphIndex,2);assert.equal(updated.snapshot,'阿白停船。');assert.equal(r.api.favoriteStatus(updated),'');assert.equal(r.api.selection.updateId,'');assert.ok(r.toasts.some(row=>row[0].includes('已更新快照')));
});

test('当前列表按当前书和分支筛选；全部书只读喜欢列表，不读取其他正文',()=>{
 const r=runtime();r.api.saveFavoriteClip(r.main,0,null,r.main.content);r.c.activeBranchId.value='side';r.api.saveFavoriteClip(r.side,0,null,r.side.content);assert.equal(r.api.rows.length,1);assert.equal(r.api.rows[0].chapterId,'s1');r.c.activeBranchId.value='main';assert.equal(r.api.rows.length,1);assert.equal(r.api.rows[0].chapterId,'m1');
 let reads=0;const otherNovel=r.other.novel;Object.defineProperty(r.other,'novel',{get(){reads++;return otherNovel;}});Object.defineProperty(r.other,'chapters',{get(){throw Error('不应读取其他书正文');}});assert.equal(r.api.rows.length,1);assert.equal(reads,0);assert.equal(r.loads.length,0);
 r.api.scope='all';assert.equal(r.api.rows.length,2);assert.equal(r.api.rows[1].snapshot,'其他书快照');assert.ok(reads>0);assert.equal(r.loads.length,0);
});

test('跨书/跨分支跳转定位原章节和段落；已删除条目不能跳转；取消仅删除目标条目',async()=>{
 const r=runtime();r.api.saveFavoriteClip(r.main,0,1,'阿白收起船桨。');const local=r.api.rows[0];r.c.activeBranchId.value='side';await r.api.jumpToFavorite(local);assert.equal(r.c.activeBranchId.value,'main');assert.equal(r.jumps[0].idx,0);assert.match(r.paragraphJumps[0].selector,/m1:1/);const before=r.jumps.length;await r.api.jumpToFavorite({...local,status:'原文已删除'});assert.equal(r.jumps.length,before);
 r.api.scope='all';const other=r.api.rows.find(row=>row.bookId==='book-b');await r.api.jumpToFavorite(other);assert.deepEqual(r.loads,['book-b']);assert.equal(r.jumps.at(-1).bookId,'book-b');assert.equal(r.c.showSettings_modal.value,false);assert.ok(r.saves.some(row=>row.reason==='跨书查看喜欢'));r.api.removeFavorite(local);assert.equal(r.current.novel.favoriteClips.length,0);assert.equal(r.other.novel.favoriteClips.length,1);r.api.removeFavorite(other);assert.equal(r.other.novel.favoriteClips.length,0);
});

test('大素材只提醒不阻止，段落喜欢入口不依赖段评开关',()=>{
 const r=runtime();r.api.saveFavoriteClip(r.main,0,null,'字'.repeat(30001));assert.equal(r.api.currentFavoriteClips().length,1);assert.ok(r.toasts.some(row=>row[0].includes('总字数较多')));const at=source.indexOf('favoriteSelection.chapterId===ch.id && para.text');assert.ok(at>0);assert.match(source.slice(at-100,at+100),/v-if="favoriteSelection.chapterId===ch.id && para.text"/);
});
