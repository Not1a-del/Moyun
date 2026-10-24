'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../source/moyun.single.html'),'utf8');
const catalogStart=source.indexOf('    const settingsSearchCatalog = [');
const catalogEnd=source.indexOf('    function normalizeSettingsSearchText',catalogStart);
const catalogSource=source.slice(catalogStart,catalogEnd);
module.exports=async function(c,check,shot){
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const previous=await c.ev(()=>({tab:__s.currentTab,mobile:__s.mobileSidebarOpen,settingsTab:__s.activeSettingsTab,storyBible:__s.showStoryBibleWorkbench,storySection:__s.storyBibleWorkbenchSection,character:__s.showCharacterWorkbench}));
 const openSettings=async(tab='api')=>{await c.ev(name=>{__s.showSettings_modal=true;__s.activeSettingsTab=name;},tab);await delay(160);};
 const search=async query=>{
  await c.ev(async value=>{const input=document.querySelector('[data-settings-search-area] input[aria-label="搜索全局设置"]');if(!input)throw Error('设置搜索框未挂载');input.focus();input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));await Vue.nextTick();},query);
  await delay(50);
  return c.ev(()=>({titles:[...document.querySelectorAll('#settings-search-results [role="option"] .settings-search-result-title')].map(node=>node.textContent.trim()),empty:document.querySelector('#settings-search-results [role="status"]')?.textContent.trim()||'',focused:__s.settingsSearchFocused,inert:document.querySelector('.settings-search-body')?.inert,filter:getComputedStyle(document.querySelector('.settings-search-body')).filter}));
 };
 try{
  await c.send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
  await openSettings('api');
  await check('搜索目录锚点：所有静态目标存在且排除关于',async()=>{const targets=[...catalogSource.matchAll(/target:'([^']+)'/g)].map(match=>match[1]).filter(target=>target!=='settings-search-route-');const missing=targets.filter(target=>!source.includes('id="'+target+'"'));assert.deepEqual(missing,[]);assert.equal(catalogSource.includes("tab:'changelog'"),false);assert.match(source,/:id="'settings-search-route-'\+mod\.key"/);return{staticTargets:targets.length,dynamicRoutePrefix:true,includesAbout:false};});
  await check('设置搜索：中文单字、错序词、拼音与相邻换位容错',async()=>{
   const one=await search('温');assert.ok(one.titles.includes('全局温度与思考强度'),JSON.stringify(one));
   const reordered=await search('章摘');assert.ok(reordered.titles.some(title=>title==='发送章节摘要'||title==='模块模型分配｜AI总结'),JSON.stringify(reordered));
   const pinyin=await search('wendu');assert.ok(pinyin.titles.includes('全局温度与思考强度'),JSON.stringify(pinyin));
   const transposed=await search('wednu');assert.ok(transposed.titles.includes('全局温度与思考强度'),JSON.stringify(transposed));
   const multi=await search('温度 思考');assert.ok(multi.titles.includes('全局温度与思考强度'),JSON.stringify(multi));
   const memory=await search('记忆库');assert.ok(memory.titles.includes('创作设定工作台与记忆库入口'),JSON.stringify(memory));
   const typo=await search('首字超吋');assert.ok(typo.titles.includes('首字超时'),JSON.stringify(typo));
   return{single:one.titles.slice(0,3),reordered:reordered.titles.slice(0,4),pinyin:pinyin.titles.slice(0,3),transposed:transposed.titles.slice(0,3),multi:multi.titles.slice(0,3),memory:memory.titles.slice(0,3),typo:typo.titles.slice(0,3)};
  });
  await check('设置搜索：只查全局设置，不包含关于',async()=>{const d=await search('关于');assert.deepEqual(d.titles,[]);assert.match(d.empty,/没有找到/);assert.notEqual(await c.ev(()=>__s.activeSettingsTab),'changelog');return{results:d.titles,empty:d.empty};});
  await check('设置搜索：Enter 跳到首字超时控件',async()=>{
   await search('首字超时');
   await c.ev(()=>{const input=document.querySelector('[data-settings-search-area] input');input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));});await delay(180);
   const d=await c.ev(()=>({tab:__s.activeSettingsTab,query:__s.settingsSearchQuery,focused:__s.settingsSearchFocused,target:document.getElementById('settings-search-timeout')?.classList.contains('settings-search-target-flash')}));
   assert.equal(d.tab,'context');assert.equal(d.query,'');assert.equal(d.focused,false);assert.equal(d.target,true);return d;
  });
  await check('设置搜索：生图结果落在可见开关，不落到隐藏锚点',async()=>{
   await openSettings('api');const matches=await search('生图设置');assert.ok(matches.titles.includes('生图设置'),JSON.stringify(matches));
   const clicked=await c.ev(()=>{const node=[...document.querySelectorAll('#settings-search-results [role="option"]')].find(item=>item.textContent.includes('生图设置'));if(!node)return false;node.click();return true;});assert.equal(clicked,true);await delay(180);
   const d=await c.ev(()=>{const target=document.getElementById('settings-search-image');const panel=document.querySelector('[data-moyun-modal="settings"] [data-moyun-modal-panel]');return{tab:__s.activeSettingsTab,visible:!!target&&getComputedStyle(target).display!=='none',label:target?.textContent.trim(),scrolled:panel?.scrollTop>0};});
   assert.equal(d.tab,'image');assert.equal(d.visible,true);assert.match(d.label,/生图功能/);return d;
  });
  await check('上下文模块入口：描述齐全，黄色链接逐项抵达对应页面',async()=>{
   await openSettings('context');
   const expectedLinkColor=await c.ev(()=>{const probe=document.createElement('span');probe.style.color='var(--warn)';document.body.appendChild(probe);const color=getComputedStyle(probe).color;probe.remove();return color;});
   const modules=await c.ev(()=>__s.moduleModelConfig.map(mod=>({key:mod.key,name:mod.name,desc:mod.desc,locations:__s.settingsModuleLocations[mod.key]||[],route:!!document.getElementById('settings-search-route-'+mod.key)})));
   const sidebarTabIds=await c.ev(()=>__s.sidebarTabs.map(tab=>tab.id));
   const descriptionTerms={writing:'正文续写',supplement:'追加请求',settings:'作品简介',character:'角色卡',imagetext:'关键词',outline:'全书大纲',suggestion:'AI 建议',review:'点评',summary:'章节摘要',comments:'读者评论',translate:'翻译'};
   assert.ok(modules.every(mod=>mod.route&&mod.desc.length>=30&&/[；。]/.test(mod.desc)&&mod.desc.includes(descriptionTerms[mod.key])),JSON.stringify(modules));
   assert.ok(modules.every(mod=>mod.key==='translate'?mod.locations.length===0:mod.locations.length>0),JSON.stringify(modules));
   assert.ok(modules.every(mod=>mod.locations.every(location=>location.workbenchSection||sidebarTabIds.includes(location.tab))),JSON.stringify(modules));
   let checked=0;const destinations=[];
   for(const mod of modules){for(const location of mod.locations){
    const color=await c.ev((key,label)=>{const root=document.getElementById('settings-search-route-'+key);const button=[...root.querySelectorAll('.settings-module-location')].find(item=>item.textContent.includes(label));if(!button)throw Error('缺少页面跳转标签：'+key+' '+label);const value=getComputedStyle(button).color;button.click();return value;},mod.key,location.label);
    assert.equal(color,expectedLinkColor,mod.key+': '+location.label+' 未使用黄色主题色');
    await delay(160);const state=await c.ev(()=>({modal:__s.showSettings_modal,tab:__s.currentTab,workbench:__s.showStoryBibleWorkbench,section:__s.storyBibleWorkbenchSection}));assert.equal(state.modal,false);if(location.workbenchSection){assert.equal(state.workbench,true,mod.key+': '+location.label+' 未打开创作设定工作台');assert.equal(state.section,location.workbenchSection,mod.key+': '+location.label+' 未打开对应栏目');}else assert.equal(state.tab,location.tab,mod.key+': '+location.label);destinations.push(mod.name+'→'+location.label);checked++;await openSettings('context');
   }}
   const workbenchLocations=await c.ev(()=>__s.settingsContextWorkbenchLocations);let workbenchChecked=0;
   for(const location of workbenchLocations){
    const color=await c.ev(label=>{const root=document.getElementById('settings-search-context-workbench');const button=[...root.querySelectorAll('.settings-module-location')].find(item=>item.textContent.includes(label));if(!button)throw Error('缺少工作台入口：'+label);const value=getComputedStyle(button).color;button.click();return value;},location.label);
    assert.equal(color,expectedLinkColor,location.label+' 未使用黄色主题色');await delay(160);
    const state=await c.ev(()=>({modal:__s.showSettings_modal,workbench:__s.showStoryBibleWorkbench,section:__s.storyBibleWorkbenchSection,mobileSidebar:__s.mobileSidebarOpen,memoryVisible:!!document.querySelector('[data-memory-library]')}));
    assert.equal(state.modal,false);assert.equal(state.workbench,true);assert.equal(state.section,location.workbenchSection);if(location.workbenchSection==='memory')assert.equal(state.memoryVisible,true);
    workbenchChecked++;await openSettings('context');
   }
   await c.ev(()=>{if(__s.showStoryBibleWorkbench)__s.closeStoryBibleWorkbench();});
   const translate=modules.find(mod=>mod.key==='translate');assert.equal(translate.locations.length,0);assert.match(await c.ev(()=>document.getElementById('settings-search-route-translate')?.textContent||''),/当前预留/);
   return{moduleCount:modules.length,described:modules.length,modelLinks:checked,workbenchLinks:workbenchChecked,linkColor:expectedLinkColor,destinations,translateReserved:true};
  });
  await check('记忆库入口：手机视口直达正确栏目',async()=>{
   await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await openSettings('context');
   await c.ev(()=>{document.querySelector('.settings-search-shell').scrollTop=0;});await delay(80);await shot('context-module-routes-390x844');
   const before=await c.ev(()=>({target:!!document.querySelector('#settings-search-context-workbench [aria-label="打开记忆库"]'),visible:!!document.querySelector('[data-memory-library]')}));assert.equal(before.target,true);assert.equal(before.visible,false);
   await c.ev(()=>document.querySelector('#settings-search-context-workbench [aria-label="打开记忆库"]').click());await delay(180);
   const after=await c.ev(()=>({modal:__s.showSettings_modal,workbench:__s.showStoryBibleWorkbench,section:__s.storyBibleWorkbenchSection,mobileSidebar:__s.mobileSidebarOpen,visible:!!document.querySelector('[data-memory-library]'),width:document.querySelector('[data-memory-library]')?.getBoundingClientRect().width,viewport:innerWidth}));
   assert.equal(after.modal,false);assert.equal(after.workbench,true);assert.equal(after.section,'memory');assert.equal(after.mobileSidebar,false);assert.equal(after.visible,true);assert.ok(after.width<=after.viewport);return{before,after};
  });
  await check('搜索遮挡：输入时模糊且 inert，点遮罩后立即还原',async()=>{
   await openSettings('api');const started=await search('temperature');assert.equal(started.focused,true);
   await delay(220);const before=await c.ev(()=>({focused:__s.settingsSearchFocused,inert:document.querySelector('.settings-search-body')?.inert,filter:getComputedStyle(document.querySelector('.settings-search-body')).filter}));
   assert.equal(before.focused,true);assert.equal(before.inert,true);assert.match(before.filter,/blur\(4px\)/);
   await c.ev(()=>document.querySelector('.settings-search-backdrop')?.click());await delay(220);
   const after=await c.ev(()=>({focused:__s.settingsSearchFocused,query:__s.settingsSearchQuery,inert:document.querySelector('.settings-search-body')?.inert,filter:getComputedStyle(document.querySelector('.settings-search-body')).filter,backdrop:!!document.querySelector('.settings-search-backdrop')}));
   assert.equal(after.focused,false);assert.equal(after.query,'');assert.equal(after.inert,false);assert.equal(after.filter,'none');assert.equal(after.backdrop,false);return{during:{inert:before.inert,filter:before.filter},after};
  });
  await check('设置搜索：Escape 清空搜索并解除遮挡',async()=>{
   await search('memory');await c.ev(()=>document.querySelector('[data-settings-search-area] input')?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));await delay(220);
   const d=await c.ev(()=>({focused:__s.settingsSearchFocused,query:__s.settingsSearchQuery,inert:document.querySelector('.settings-search-body')?.inert,filter:getComputedStyle(document.querySelector('.settings-search-body')).filter}));
   assert.equal(d.focused,false);assert.equal(d.query,'');assert.equal(d.inert,false);assert.equal(d.filter,'none');return d;
  });
  await check('正文 Markdown：波浪线显示为原文，常规格式与代码不变',async()=>{
   const sample='前文~~保留波浪线~~后文 **加粗**，行内 \x60~~代码~~\x60。\n\n~~~text\n~~围栏代码~~\n~~~';
   const d=await c.ev(value=>{const html=__s.renderMarkdown(value),node=document.createElement('div');node.innerHTML=html;const cot=__s.renderCotMarkdown(value),cotNode=document.createElement('div');cotNode.innerHTML=cot;return{html,text:node.textContent,bold:!!node.querySelector('strong'),del:node.querySelectorAll('del').length,inline:node.querySelector('code')?.textContent,block:node.querySelector('pre code')?.textContent,cotText:cotNode.textContent,cotDel:cotNode.querySelectorAll('del').length};},sample);
   assert.match(d.text,/前文~~保留波浪线~~后文/);assert.ok(d.bold);assert.equal(d.del,0);assert.equal(d.inline,'~~代码~~');assert.equal(d.block,'~~围栏代码~~\n');assert.match(d.cotText,/前文~~保留波浪线~~后文/);assert.equal(d.cotDel,0);return{html:d.html,text:d.text,bold:d.bold,inline:d.inline,block:d.block,cotDel:d.cotDel};
  });
  for(const {width,height} of [{width:1366,height:900},{width:390,height:844},{width:320,height:568},{width:667,height:375}]){
   await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768});
   await openSettings('api');await search('wednu');await delay(40);
   await shot('settings-search-'+width+'x'+height);
   await check('设置搜索响应式与触控布局 '+width+'x'+height,async()=>{const d=await c.ev(()=>{const panel=document.querySelector('[data-moyun-modal="settings"] [data-moyun-modal-panel]'),area=document.querySelector('[data-settings-search-area]'),control=area?.querySelector('.settings-search-control'),list=area?.querySelector('.settings-search-results'),body=document.querySelector('.settings-search-body'),rect=x=>{const r=x.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width,height:r.height};};return{viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,panel:rect(panel),area:rect(area),control:rect(control),list:rect(list),bodyInert:body?.inert,results:[...document.querySelectorAll('#settings-search-results [role="option"]')].length};});assert.equal(d.overflow,false);assert.ok(d.panel.left>=-1&&d.panel.right<=d.viewport+1,JSON.stringify(d));assert.ok(d.control.width<=d.panel.width+1,JSON.stringify(d));assert.ok(d.list.width<=d.panel.width+1,JSON.stringify(d));assert.equal(d.bodyInert,true);assert.ok(d.results>0);return d;});
   await c.ev(()=>document.querySelector('.settings-search-backdrop')?.click());await delay(50);
  }
  await check('设置弹窗滚动边界：上下栏不重叠，滑块不越界',async()=>{
   await openSettings('api');
   const read=()=>c.ev(()=>{
    const panel=document.querySelector('[data-moyun-modal="settings"] [data-moyun-modal-panel]');
    const header=document.querySelector('[data-settings-modal-header]'),footer=document.querySelector('[data-settings-modal-footer]'),shell=document.querySelector('.settings-search-shell'),card=document.querySelector('#settings-search-global-controls');
    const rect=x=>{const r=x.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
    return{panel:rect(panel),header:rect(header),footer:rect(footer),shell:rect(shell),shellScrollTop:shell.scrollTop,shellScrollHeight:shell.scrollHeight,shellClientHeight:shell.clientHeight,panelOverflow:getComputedStyle(panel).overflow,display:getComputedStyle(panel).display,borderTop:getComputedStyle(panel).borderTopWidth,borderBottom:getComputedStyle(panel).borderBottomWidth,card:rect(card),ranges:[...card.querySelectorAll('input[type="range"]')].map(rect)};
   });
   await c.ev(()=>{document.querySelector('.settings-search-shell').scrollTop=0;return true;});await delay(40);const before=await read();
   await c.ev(()=>{const shell=document.querySelector('.settings-search-shell');shell.scrollTop=shell.scrollHeight;return true;});await delay(80);const after=await read();
   assert.equal(before.display,'flex',JSON.stringify(before));assert.equal(before.panelOverflow,'hidden',JSON.stringify(before));assert.equal(before.borderTop,'1px',JSON.stringify(before));assert.equal(before.borderBottom,'1px',JSON.stringify(before));
   assert.ok(before.shellScrollHeight>before.shellClientHeight,JSON.stringify(before));assert.ok(Math.abs(before.header.top-after.header.top)<1&&Math.abs(before.footer.bottom-after.footer.bottom)<1,JSON.stringify({before,after}));
   assert.ok(after.footer.top>=after.shell.bottom-1,JSON.stringify({before,after}));assert.ok(after.footer.bottom<=after.panel.bottom+1,JSON.stringify({before,after}));
   for(const range of [...before.ranges,...after.ranges]){assert.ok(range.left>=before.card.left-1&&range.right<=before.card.right+1,JSON.stringify({range,before,after}));}
   assert.ok(after.shellScrollTop>=after.shellScrollHeight-after.shellClientHeight-1,JSON.stringify(after));
   await shot('settings-scroll-boundary-667x375');
   return{before,after};
  });
 }finally{
  await c.send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
  await c.ev(async state=>{__s.showSettings_modal=false;__s.settingsSearchQuery='';__s.settingsSearchFocused=false;if(__s.showStoryBibleWorkbench) __s.closeStoryBibleWorkbench?.();if(__s.showCharacterWorkbench) __s.closeCharacterWorkbench?.();__s.mobileSidebarOpen=state.mobile;__s.selectSidebarTab(state.tab);if(state.storyBible) __s.openStoryBibleWorkbench(state.storySection);if(state.character) __s.openCharacterWorkbench?.();await Vue.nextTick();},previous);
  await delay(120);
 }
};
