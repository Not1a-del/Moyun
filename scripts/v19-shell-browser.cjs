'use strict';
// Run in the managed, isolated local-preview tab. No server/browser is started here.
async function measureCharacterCards(){
 const s=document.querySelector('#app').__vue_app__._instance.setupState,wait=ms=>new Promise(r=>setTimeout(r,ms)),results=[];
 s.showSettings_modal=false;s.showBranchPanel=false;s.closeContinuityCheck();s.openCharacterWorkbench();
 const character=s.selectedWorkbenchCharacter,old={name:character.name,desc:character.desc};
 try{
  for(const kind of ['blank','long']){
   character.name=kind==='blank'?'':'X'.repeat(500);character.desc=kind==='blank'?'':'Z'.repeat(5000);await wait(100);
   const editor=document.querySelector('.moyun-character-editor'),container=editor.parentElement.getBoundingClientRect(),cards=[...editor.querySelectorAll(':scope > .moyun-character-section')].map(el=>el.getBoundingClientRect().width),editorWidth=editor.getBoundingClientRect().width;
   const ratio=Math.min(...cards)/Math.min(container.width,920),overflow=document.documentElement.scrollWidth>innerWidth+1;
   if(ratio<.8||overflow)throw Error('Character cards compressed: '+JSON.stringify({kind,ratio,overflow}));
   results.push({kind,viewport:[innerWidth,innerHeight],container:container.width,editor:editorWidth,minCard:Math.min(...cards),ratio,overflow});
  }
 }finally{character.name=old.name;character.desc=old.desc;s.closeCharacterWorkbench();}
 return {passed:true,results};
}
async function runAnnouncementBrowserChecks(){
 const s=document.querySelector('#app').__vue_app__._instance.setupState,wait=ms=>new Promise(r=>setTimeout(r,ms)),assert=(ok,message)=>{if(!ok)throw Error(message);};
 s.showConfirm=false;s.showBranchPanel=false;s.closeContinuityCheck();s.showSettings_modal=true;s.activeSettingsTab='changelog';
 for(let i=0;i<100;i++){if(document.querySelector('[data-moyun-modal="settings"][data-moyun-modal-active="true"]')&&!document.querySelector('[data-moyun-modal="settings"]').closest('[inert]'))break;await wait(30);}
 const trigger=document.querySelector('[data-moyun-announcement-card] button');assert(trigger,'About announcement entry missing');trigger.focus();assert(document.activeElement===trigger,'About settings did not become interactive');trigger.click();await wait(250);
 const root=document.querySelector('[data-moyun-modal="web-update-announcement"]'),seen=localStorage.getItem('moyun_web_update_announcement_seen'),count=s.webAnnouncementCount;
 assert(root&&s.webAnnouncementBrowseMode&&s.webAnnouncementIndex===0&&count===19,'Browse latest state is wrong');
 assert(root.querySelector('[data-web-update-ack]').textContent.trim()==='关闭','Browse confirmation must close');
 const visible=selector=>[...root.querySelectorAll(selector)].find(el=>el.getClientRects().length);
 const newer=visible('[aria-label="查看更新的公告"]'),earlier=visible('[aria-label="查看更早的公告"]');assert(newer.disabled&&!earlier.disabled,'Latest paging bounds wrong');
 s.webAnnouncementScroll.scrollTop=200;earlier.click();await wait(450);assert(s.webAnnouncementIndex===1&&s.webAnnouncementScroll.scrollTop===0&&s.webAnnouncementLive.includes('2/19'),'Paging scroll or live label wrong');
 earlier.focus();earlier.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));await wait(450);assert(s.webAnnouncementIndex===2,'ArrowLeft did not page');
 if(innerWidth<640){s.startWebAnnouncementSwipe({touches:[{clientX:90,clientY:100}]});s.finishWebAnnouncementSwipe({changedTouches:[{clientX:170,clientY:110}]});await wait(450);assert(s.webAnnouncementIndex===3,'Mobile swipe did not page');}
 const panel=root.querySelector('[data-moyun-modal-panel]'),buttons=[...root.querySelectorAll('.moyun-announce-side,.moyun-announce-mobile-controls button')].filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect().height),overflow=document.documentElement.scrollWidth>innerWidth+1||panel.scrollWidth>panel.clientWidth+1;
 assert(!overflow&&buttons.length===2&&!buttons.some(h=>h<45.9),'Announcement overflows or controls too small');
 root.querySelector('[data-web-update-ack]').focus();document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait(300);
 assert(!s.showWebUpdateAnnouncement&&s.showSettings_modal&&s.activeSettingsTab==='changelog','Esc did not restore settings');assert(localStorage.getItem('moyun_web_update_announcement_seen')===seen,'Browse changed read status');
 const focusRestored=document.activeElement===trigger;assert(focusRestored,'Announcement focus not restored');s.showSettings_modal=false;
 return {passed:true,viewport:[innerWidth,innerHeight],count,latest:s.latestWebAnnouncement.title,buttons,overflow,focusRestored,browsePreservedSeen:true};
}
module.exports={measureCharacterCards,runAnnouncementBrowserChecks};
