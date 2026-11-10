'use strict';
// Execute in the already managed isolated test tab after fake-AI configuration.
async function runContinuityBrowserChecks(){
 const s=document.querySelector('#app').__vue_app__._instance.setupState,assert=(ok,message)=>{if(!ok)throw Error(message);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 const book=JSON.parse(JSON.stringify(globalThis.__v19Fixtures.B));book.id='v19-continuity-browser';book.novel.volumes=[{id:'continuity-v1',title:'第一卷',startChapter:1,endChapter:3,summary:'寻灯'},{id:'continuity-v2',title:'第二卷',startChapter:4,endChapter:30,summary:'归港'}];s.books=s.books.filter(row=>row.id!==book.id);s.books.push(book);s.loadBook(book.id);s.showSettings_modal=false;s.mobileSidebarOpen=false;s.settings.sidebarCollapsed=true;s.bookshelfView='book';
 s.chapterOutlines[2].continuityStatus='issues';s.chapterOutlines[2].continuityRaw='第3章到第4章：上一章主角已离开城市，下一章仍在城内。';s.openDetailedOutlineWorkbench();s.openOutlineCard(2);await wait(100);s.openOutlineContinuity(2);await wait(100);
 let modal=document.querySelector('[data-moyun-modal="continuity"]');assert(modal&&modal.textContent.includes('上一章主角已离开城市'),'Conflict explanation is missing');assert(!modal.querySelector('details[open]'),'Suggestions should start collapsed');
 const original=s.chapterOutlines[1].content,row={id:'browser-continuity-row',targetId:s.chapterOutlines[1].id,chapterNo:2,centerNo:3,branchId:'main',bookId:book.id,base:original,review:s.createReviewState('browser-continuity-review',original,original+'新增承接说明。',{source:'衔接调整'})};
 s.novel.reviewStates={...(s.novel.reviewStates||{}),continuity:{rows:[row]}};await wait(100);modal=document.querySelector('[data-moyun-modal="continuity"]');assert(modal.querySelector('[data-continuity-review] .diff-ins'),'Shared red/green review did not render');
 s.requestApplyContinuityReview(row);await wait(80);assert(s.showConfirm&&s.chapterOutlines[1].content===original,'Adjustment wrote before confirmation');await s.execConfirm();await wait(100);assert(s.chapterOutlines[1].content===original+'新增承接说明。','Confirmed adjustment did not apply');s.closeContinuityCheck();s.saveData();await wait(2300);
 s.openOutlineContinuity(2);await wait(80);return {passed:true,bookId:book.id,confirmedOnly:true,persistedRows:s.novel.reviewStates.continuity.rows.length,viewport:[innerWidth,innerHeight]};
}
async function measureContinuityLayout(){
 const s=document.querySelector('#app').__vue_app__._instance.setupState;s.showConfirm=false;s.showSettings_modal=false;s.mobileSidebarOpen=false;s.continuityState.show=true;await new Promise(r=>setTimeout(r,100));
 const panel=document.querySelector('[data-moyun-modal="continuity"] [data-moyun-modal-panel]');if(!panel)throw Error('Continuity panel is missing');const rect=panel.getBoundingClientRect(),overflow=document.documentElement.scrollWidth>innerWidth+1||panel.scrollWidth>panel.clientWidth+1;
 if(overflow||rect.width<Math.min(280,innerWidth-20))throw Error('Continuity panel overflows or is compressed');return {passed:true,viewport:[innerWidth,innerHeight],width:rect.width,overflow};
}
module.exports={runContinuityBrowserChecks,measureContinuityLayout};
