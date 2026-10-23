'use strict';
const assert=require('node:assert/strict');
module.exports=async function(c,check,shot){
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 const original=await c.ev(()=>({characters:__s.structuredCharacters,title:__s.novel.title,cover:__s.coverImage}));
 async function key(value,code){
  await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:value,code,windowsVirtualKeyCode:{Enter:13,Escape:27,Space:32,Tab:9}[code]});
  await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:value,code});
 }
 await c.ev(()=>{
  __s.showSettings_modal=false;__s.closeCharacterWorkbench();__s.closeStoryBibleWorkbench();
  const src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="240"><rect width="160" height="240" fill="#64748b"/></svg>');
  __s.structuredCharacters=[{id:'a11y-character',name:'林舟',desc:'审计角色',avatarBase64:src,_expanded:true,profile:{},relationships:[],chapterLinks:{chapterIds:[],outlineIds:[]}}];
  __s.novel.title='键盘验收';__s.coverImage=src;
 });
 try{
  for(const width of [1366,390]){
   await c.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<768});
   await c.ev(w=>{__s.currentTab='characters';__s.mobileSidebarOpen=w<768;},width);await delay(350);
   await check('图片替代文字与布局 '+width,async()=>{
    const d=await c.ev(()=>({avatar:document.querySelector('#character-card-0 img').alt,portrait:document.querySelector('#character-card-0 img[role="button"]').alt,cover:document.querySelector('main img[role="button"]').alt,overflow:document.documentElement.scrollWidth>innerWidth+1}));
    assert.equal(d.avatar,'林舟头像');assert.equal(d.portrait,'林舟立绘，点击放大');assert.equal(d.cover,'《键盘验收》封面，点击放大');assert.equal(d.overflow,false);return d;
   });
   for(const [kind,selector,value,code] of [['立绘','#character-card-0 img[role="button"]','Enter','Enter'],['封面','main img[role="button"]',' ','Space']]){
    await check('键盘图片预览、Tab与Escape焦点还原 '+kind+' '+width,async()=>{
     await c.ev((selector,kind)=>{if(kind==='封面')__s.mobileSidebarOpen=false;const el=document.querySelector(selector);el.scrollIntoView({behavior:'instant',block:'center'});el.focus({preventScroll:true});},selector,kind);await delay(200);
     await key(value,code);await delay(200);
     const opened=await c.ev(()=>{const dialog=document.querySelector('[data-moyun-modal="image-preview"]'),close=dialog?.querySelector('button'),r=dialog?.querySelector('img').getBoundingClientRect();return{open:!!dialog,focus:document.activeElement===close,label:dialog?.getAttribute('aria-label'),height:close?.getBoundingClientRect().height,inside:r&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight};});
     assert.equal(opened.open,true);assert.equal(opened.focus,true);assert.equal(opened.label,'图片预览');assert.ok(opened.height>=44);assert.equal(opened.inside,true);
     await key('Tab','Tab');assert.equal(await c.ev(()=>document.activeElement===document.querySelector('[data-moyun-modal="image-preview"] button')),true);
     await shot('accessible-preview-'+kind+'-'+width);
     await key('Escape','Escape');await delay(250);
     const closed=await c.ev(selector=>({closed:!document.querySelector('[data-moyun-modal="image-preview"]'),restored:document.activeElement===document.querySelector(selector),outline:getComputedStyle(document.querySelector(selector)).outlineStyle}),selector);
     assert.equal(closed.closed,true);assert.equal(closed.restored,true);assert.notEqual(closed.outline,'none');return{opened,closed};
    });
   }
   await c.ev(()=>__s.openRelationshipGraph());await delay(400);
   await check('SVG角色头像及节点可访问名称 '+width,async()=>{
    const d=await c.ev(()=>{const node=document.querySelector('[data-rel-node="a11y-character"]');return{node:node?.getAttribute('aria-label'),image:node?.querySelector('image')?.getAttribute('aria-label'),role:node?.querySelector('image')?.getAttribute('role')};});
    assert.equal(d.node,'选择角色 林舟');assert.equal(d.image,'林舟头像');assert.equal(d.role,'img');return d;
   });
   await c.ev(()=>__s.closeRelationshipGraph());await delay(250);
   for(const preference of ['no-preference','reduce','no-preference']){
    await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:preference}]});
    await check('系统动态效果切换 '+width+' '+preference,async()=>{
     const d=await c.ev(async()=>{
      const calls=[],saved={};
      for(const method of ['scrollIntoView','scrollBy','scrollTo']){saved[method]=Element.prototype[method];Element.prototype[method]=function(options,...rest){if(options&&typeof options==='object')calls.push({method,behavior:options.behavior});return saved[method].call(this,options,...rest);};}
      const probe=document.createElement('div');probe.className='pop-enter-active';const spinner=document.createElement('span');spinner.className='loading-spinner';probe.appendChild(spinner);document.body.appendChild(probe);
      try{
       __s.selectSidebarTab('characters');__s.scrollSidebarTabsForward();__s.scrollSidebarTabsBack();__s.scrollChapterToStart(0);
       await new Promise(r=>setTimeout(r,240));
       return{calls,main:getComputedStyle(document.querySelector('main')).scrollBehavior,transition:getComputedStyle(probe).transitionDuration,animation:getComputedStyle(spinner).animationDuration,iterations:getComputedStyle(spinner).animationIterationCount};
      }finally{for(const method of Object.keys(saved))Element.prototype[method]=saved[method];probe.remove();}
     });
     assert.ok(d.calls.length>=4,JSON.stringify(d));assert.ok(d.calls.every(call=>call.behavior===(preference==='reduce'?'auto':'smooth')),JSON.stringify(d));
     const durations=d.transition.split(',').map(Number.parseFloat);
     if(preference==='reduce'){assert.equal(d.main,'auto');assert.ok(durations.every(n=>n<=.00001));assert.ok(parseFloat(d.animation)<=.00001);assert.equal(d.iterations,'1');}
     else{assert.equal(d.main,'smooth');assert.ok(durations.every(n=>n>=.2));assert.ok(parseFloat(d.animation)>.01);}
     return d;
    });
   }
  }
  await check('新建书籍按钮的可访问名称',async()=>{
   const d=await c.ev(()=>{const button=document.querySelector('button[aria-label="新建书籍"]');return{label:button?.getAttribute('aria-label'),text:button?.textContent.trim(),icon:button?.querySelector('svg').getAttribute('aria-hidden')};});assert.equal(d.label,'新建书籍');assert.equal(d.text,'新建书籍');assert.equal(d.icon,'true');return d;
  });
  for(const [width,height] of [[1366,900],[390,844],[320,568],[667,375]]){
   await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768});
   for(const [flag,id,max] of [['showReviewModal','book-review',900],['showTreeView','story-tree',600]]){
    await c.ev(flag=>{__s.mobileSidebarOpen=false;__s[flag]=true;},flag);await delay(300);
    await check('max-width误报实际弹窗尺寸 '+id+' '+width,async()=>{
     const d=await c.ev(id=>{const panel=document.querySelector('[data-moyun-modal="'+id+'"] [data-moyun-modal-panel]'),r=panel.getBoundingClientRect();return{width:r.width,left:r.left,right:r.right,viewport:innerWidth,scrollWidth:panel.scrollWidth,clientWidth:panel.clientWidth,overflow:document.documentElement.scrollWidth>innerWidth+1};},id);
     assert.ok(d.width<=Math.min(width,max)+1&&d.width>=Math.min(width,max)-35);assert.ok(d.left>=0&&d.right<=width+1);assert.ok(d.scrollWidth<=d.clientWidth+1);assert.equal(d.overflow,false);return d;
    });await shot('max-width-'+id+'-'+width);
    await c.ev(flag=>{__s[flag]=false;},flag);await delay(250);
   }
  }
 }finally{
  await c.send('Emulation.setEmulatedMedia',{features:[]});
  await c.ev(original=>{__s.showRelGraph=false;__s.showReviewModal=false;__s.showTreeView=false;__s.structuredCharacters=original.characters;__s.novel.title=original.title;__s.coverImage=original.cover;document.querySelector('[data-moyun-modal="image-preview"]')?.remove();},original);
 }
};
