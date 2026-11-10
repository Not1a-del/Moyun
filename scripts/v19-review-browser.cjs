'use strict';
// Execute in the existing managed test tab; no browser or server is created.
async function runReviewBrowserChecks() {
  const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState;
  const results=[], tick=()=>new Promise(resolve=>setTimeout(resolve,30));
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const until=async fn=>{for(let i=0;i<150;i++){if(fn())return;await tick();}throw Error('Review UI did not reach expected state');};
  const button=(root,label)=>Array.from(root.querySelectorAll('button')).find(el=>el.textContent.trim()===label);
  const middle='中央长廊保留所有历史记载和出场人物，不改变这里的任何文字。';
  const before='开端旧港。'+middle+'结尾旧灯。',after='开端新港。'+middle+'结尾新灯。';
  const id='v19-review-browser-book';
  if(!s.books.some(book=>book.id===id))s.books.push({id,novel:{title:'审阅验收',outline:before,worldView:'古港以旧月石驱动。'},chapters:[],characters:[]});
  s.loadBook(id);s.showSettings_modal=false;s.mobileSidebarOpen=false;s.settings.sidebarCollapsed=true;s.currentTab='settings';s.bookshelfView='book';
  s.novel.outline=before;s.outlineReview=s.createReviewState('browser-outline',before,after,{source:'大纲',reason:'统一地点'});s.openOutlineWorkbench();
  await until(()=>document.querySelector('[data-moyun-review-panel] article'));
  let panel=document.querySelector('[data-moyun-review-panel]');
  assert(panel.querySelectorAll('article').length===2,'Two replacements must be grouped into two review cards');
  assert(panel.querySelector('.diff-del')&&panel.querySelector('.diff-ins'),'Review cards must show original and new text');
  button(panel.querySelector('article'),'只看这块').click();await tick();assert(panel.querySelectorAll('article').length===1,'Focus must show one card');
  button(panel,'返回全部修改').click();await tick();
  panel.querySelector('input[type=checkbox]').click();await tick();
  button(panel,'应用所选（1/2）').click();await until(()=>s.showConfirm);
  assert(s.confirmCfg.impactLines.some(line=>/删除 1 段、共 1 字/.test(line)),'Delete confirmation must include paragraphs and characters');
  button(document.querySelector('[data-moyun-modal="confirm"]'),'确认并应用').click();await until(()=>s.novel.outline===before.replace('旧灯','新灯'));
  assert(s.outlineReview.revisions.some(row=>row.status==='pending'),'Unselected block must remain pending');
  button(panel,'撤销应用').click();await tick();assert(s.novel.outline===before,'Undo must restore full original outline');
  results.push({name:'outline grouped diff, focus, checkbox, deletion confirmation, selected apply and undo',ok:true});
  s.showOutlineInMain=false;s.currentTab='settings';s.mobileSidebarOpen=innerWidth<768;
  const row={id:'browser-setting',targetId:'novel:worldView',label:'世界观文本',locator:{kind:'novel',field:'worldView'},originalSnippet:'旧月石',newText:'潮汐',reason:'统一力量来源',issue:'',locationMode:'exact',canApply:true,selected:true,replaceWhole:false,beforeValue:s.novel.worldView,review:s.createReviewState('browser-setting','旧月石','潮汐',{source:'世界观文本',reason:'统一力量来源'})};
  s.settingsRevisionState={status:'review',rows:[row],undo:null,error:''};
  await until(()=>document.querySelector('[data-moyun-modal="settings-revision"] [data-moyun-review-panel]'));
  const modal=document.querySelector('[data-moyun-modal="settings-revision"]');
  button(modal,'应用这一条').click();await until(()=>s.showConfirm);
  assert(s.confirmCfg.impactLines.some(line=>/删除 1 段、共 3 字/.test(line)),'Settings deletion confirmation must include paragraph and character counts');
  button(document.querySelector('[data-moyun-modal="confirm"]'),'确认并应用').click();await until(()=>s.novel.worldView==='古港以潮汐驱动。');
  assert(s.canUndoSettingsRevision,'Settings undo must be available');button(modal,'↶ 撤销本次修改').click();await until(()=>s.novel.worldView==='古港以旧月石驱动。');
  button(modal,'拒绝这一条').click();await tick();assert(s.settingsRevisionState.rows[0].issue==='已拒绝','Reject must mark candidate rejected');assert(s.novel.worldView==='古港以旧月石驱动。','Reject cannot modify original setting');
  results.push({name:'settings shared diff, snapshot guarded apply, undo and reject',ok:true});
  s.outlineReview=s.createReviewState('browser-saved-outline',before,after,{source:'大纲',reason:'刷新保留'});
  row.review=s.createReviewState('browser-setting','旧月石','潮汐',{source:'世界观文本',reason:'刷新保留'});row.issue='';row.canApply=true;row.selected=true;
  s.settingsRevisionState={status:'deferred',rows:[row],undo:null,error:''};s.persistReviewStates();s.saveData();await new Promise(resolve=>setTimeout(resolve,2300));
  return {passed:true,results,bookId:id,refreshNext:true};
}
async function checkReviewBrowserRestored() {
  const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState,id='v19-review-browser-book';
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  s.loadBook(id);assert(s.outlineReview.revisions.some(row=>row.status==='pending'),'Outline pending review missing after reload');assert(s.settingsRevisionState.rows[0]?.id==='browser-setting','Settings candidate missing after reload');
  const other='v19-review-browser-other';if(!s.books.some(book=>book.id===other))s.books.push({id:other,novel:{title:'隔离验收'},chapters:[],characters:[]});
  s.loadBook(other);assert(s.outlineReview.revisions.length===0,'Outline review leaked into another book');assert(s.settingsRevisionState.rows.length===0,'Settings candidate leaked into another book');
  s.loadBook(id);assert(s.settingsRevisionState.rows[0]?.id==='browser-setting','Original book candidate lost on returning');
  return {passed:true,outlinePending:s.getReviewStats(s.outlineReview).pending,settingsRows:s.settingsRevisionState.rows.length,isolated:true};
}
async function measureReviewLayout() {
  const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState;
  s.settingsRevisionState.status='deferred';s.mobileSidebarOpen=false;s.openOutlineWorkbench();
  await new Promise(resolve=>setTimeout(resolve,150));
  const panel=document.querySelector('[data-moyun-review-panel]');if(!panel)throw Error('Review panel not rendered');
  const rect=panel.getBoundingClientRect(),buttons=Array.from(panel.querySelectorAll('button')).filter(el=>el.getBoundingClientRect().height).map(el=>({text:el.textContent.trim(),height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width}));
  const overflow=document.documentElement.scrollWidth>innerWidth+1||panel.scrollWidth>panel.clientWidth+1;
  if(overflow||buttons.some(el=>el.height<43.9))throw Error('Review layout overflow or touch target below 44px');
  return {passed:true,viewport:{width:innerWidth,height:innerHeight},panel:{left:rect.left,right:rect.right,width:rect.width},buttons,overflow};
}
module.exports={runReviewBrowserChecks,checkReviewBrowserRestored,measureReviewLayout};
