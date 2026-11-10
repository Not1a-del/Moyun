'use strict';
async function runBranchBrowserChecks(){
  const s=document.querySelector('#app').__vue_app__._instance.setupState;
  const assert=(ok,message)=>{if(!ok)throw Error(message);},wait=ms=>new Promise(r=>setTimeout(r,ms));
  const old=globalThis.__v19Fixtures.B;
  const book=JSON.parse(JSON.stringify(old));book.id='v19-browser-legacy';s.books=s.books.filter(b=>b.id!==book.id);s.books.push(book);s.loadBook(book.id);
  assert(!s.buildLibrarySnapshot().books.find(b=>b.id===book.id).branchData['B-branch-1'],'Unvisited legacy branch must remain lazy');
  const projection=()=>({chapters:s.chapters.map(ch=>[ch.id,ch.title,ch.content,ch.summary]),outlines:s.chapterOutlines.map(ch=>[ch.id,ch.title,ch.content]),dark:s.foreshadowMatrix.map(ch=>[ch.id,ch.setupChapter,ch.payoffChapter])});
  const before=JSON.stringify(projection());s.saveData();await wait(2400);s.loadBook(book.id);assert(JSON.stringify(projection())===before,'Legacy content changed after save/reopen');
  await s.forkBranch(1);await wait(80);const branch=s.activeBranchId;
  assert(branch!=='main'&&s.chapterOutlines.length===2,'New fork must inherit only first two outlines');
  s.chapterOutlines[1].content='BROWSER-ONLY-BRANCH-OUTLINE';s.foreshadowMatrix[0].note='BROWSER-ONLY-BRANCH-DARKLINE';
  s.selectedBranchPanelId=branch;s.setBranchNote('BROWSER-BRANCH-DIRECTION');s.saveData();await wait(2300);
  s.switchBranch('main');await wait(80);assert(s.chapterOutlines[1].content!=='BROWSER-ONLY-BRANCH-OUTLINE','Branch outline polluted main');assert(s.foreshadowMatrix[0].note!=='BROWSER-ONLY-BRANCH-DARKLINE','Branch darkline polluted main');
  s.chapterOutlines[0].content='BROWSER-MAIN-INHERITED-UPDATE';s.saveData();await wait(2300);s.switchBranch(branch);await wait(80);
  assert(s.chapterOutlines[0].content==='BROWSER-MAIN-INHERITED-UPDATE'&&s.chapterOutlines[1].content==='BROWSER-ONLY-BRANCH-OUTLINE','Inherited vs edited branch rows diverged incorrectly');
  const count=s.branchList.length;await s.forkBranch(0);assert(s.branchList.length===count,'Nested branch was allowed');
  const snapshot=s.buildLibrarySnapshot(),saved=snapshot.books.find(b=>b.id===book.id);
  assert(saved.chapterOutlines[1].content!=='BROWSER-ONLY-BRANCH-OUTLINE','Legacy export field contains branch outline');
  assert(saved.branchData[branch].outlineTail.length===0&&Object.keys(saved.branchData[branch].outlineEdits).length===1,'Branch stores unnecessary full outline copies');
  assert(saved.branchData[branch].foreshadowMatrix[0].note==='BROWSER-ONLY-BRANCH-DARKLINE','Branch darkline missing from snapshot');
  s.saveData();await wait(2300);s.openDetailedOutlineWorkbench();s.openOutlineCard(0);await wait(250);
  return {passed:true,bookId:book.id,branch,legacyUnchanged:true,mainExportClean:true,refreshNext:true,viewport:[innerWidth,innerHeight]};
}
async function checkBranchBrowserRestored(){
  const s=document.querySelector('#app').__vue_app__._instance.setupState,assert=(ok,message)=>{if(!ok)throw Error(message);};
  assert(s.currentBookId==='v19-browser-legacy'&&s.activeBranchId!=='main','Book/branch not restored after reload');
  assert(s.chapterOutlines[1]?.content==='BROWSER-ONLY-BRANCH-OUTLINE','Branch edited outline lost');assert(s.foreshadowMatrix[0]?.note==='BROWSER-ONLY-BRANCH-DARKLINE','Branch darkline lost');
  const branch=s.activeBranchId;s.switchBranch('main');assert(s.chapterOutlines[1].content!=='BROWSER-ONLY-BRANCH-OUTLINE','Reload polluted main');s.switchBranch(branch);
  return {passed:true,restoredBranch:branch,outlines:s.chapterOutlines.length};
}
async function measureWorkbenchLayout(){
  const s=document.querySelector('#app').__vue_app__._instance.setupState,wait=ms=>new Promise(r=>setTimeout(r,ms));
  s.showConfirm=false;s.showNewBook=false;s.showSettings_modal=false;s.settingsRevisionState.status='deferred';s.showBranchPanel=false;s.mobileSidebarOpen=false;s.settings.sidebarCollapsed=true;s.currentTab='settings';s.bookshelfView='book';
  s.openDetailedOutlineWorkbench();s.openOutlineCard(0);await wait(250);
  const textarea=document.querySelector('.moyun-do-textarea');if(!textarea)throw Error('Outline textarea missing');
  const style=getComputedStyle(textarea),rect=textarea.getBoundingClientRect();const result={viewport:[innerWidth,innerHeight],theme:document.documentElement.getAttribute('data-theme'),font:style.fontSize,lineHeight:style.lineHeight,textarea:{width:rect.width,height:rect.height},overflow:document.documentElement.scrollWidth>innerWidth+1};
  if(result.overflow||rect.width<innerWidth*.45||parseFloat(style.fontSize)<(innerWidth<768?15.9:14))throw Error('Detailed outline is compressed, unreadable or overflowing: '+JSON.stringify(result));
  s.toggleChapterOutline(0);await wait(260);s.toggleChapterOutline(0);await wait(260);if(!document.querySelector('.moyun-do-textarea'))throw Error('Outline could not reopen');
  s.toggleBranchPanel(null,'细纲');await wait(120);const panel=document.querySelector('.moyun-branch-panel'),buttons=[...panel.querySelectorAll('footer button')].map(el=>el.getBoundingClientRect().height);
  if(buttons.some(h=>h<43.9)||panel.scrollWidth>panel.clientWidth+1)throw Error('Branch panel overflows or controls are too small');
  result.branchButtons=buttons;result.nodeStats=[...panel.querySelectorAll('small')].map(el=>el.textContent);s.showBranchPanel=false;return result;
}
async function measureLargeBook(){
  const s=document.querySelector('#app').__vue_app__._instance.setupState,large=JSON.parse(JSON.stringify(globalThis.__v19Fixtures.C));large.id='v19-browser-large';s.books=s.books.filter(b=>b.id!==large.id);s.books.push(large);
  const start=performance.now();s.loadBook(large.id);const loadMs=performance.now()-start;
  const opened=performance.now();s.toggleBranchPanel(null,'细纲');await new Promise(r=>setTimeout(r,0));const panelMs=performance.now()-opened;s.showBranchPanel=false;
  const switched=performance.now();s.switchBranch('C-branch-1');const switchMs=performance.now()-switched;
  const snapshot=s.buildLibrarySnapshot(),bytes=new TextEncoder().encode(JSON.stringify(snapshot.books.find(b=>b.id===large.id))).length;
  const serializeStart=performance.now();JSON.stringify(s.buildLibrarySnapshot());const snapshotSerializeMs=performance.now()-serializeStart;
  let commitMs=null,backend=null;const original=DB.saveLibrary;DB.saveLibrary=async function(...args){const start=performance.now();try{backend=await original.apply(this,args);return backend;}finally{commitMs=performance.now()-start;}};
  try{s.saveData();await new Promise(r=>setTimeout(r,2400));if(commitMs===null)throw Error('Normal library save did not run');}
  finally{DB.saveLibrary=original;}
  return {passed:true,chapters:large.chapters.length,branches:large.branchList.length-1,settings:large.storyBible.world.entries.length,bytes,loadMs,panelMs,switchMs,snapshotSerializeMs,saveLibraryMs:commitMs,backend};
}
module.exports={runBranchBrowserChecks,checkBranchBrowserRestored,measureWorkbenchLayout,measureLargeBook};
