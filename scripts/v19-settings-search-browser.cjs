'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const cases=require('./fixtures/v0.0.19/settings-search-cases.json');
const {runFeedbackCharacterGeometryChecks}=require('./v19-feedback-browser.cjs');
module.exports=async function(c){
 const out=path.join(__dirname,'../.ui-check/settings-search');fs.mkdirSync(out,{recursive:true});
 const results=[];let completed=false;
 async function check(name,run){try{const data=await run();results.push({name,ok:true,data});console.log('PASS',name);}catch(error){results.push({name,ok:false,error:String(error)});throw error;}}
 async function shot(name){const image=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(image.data,'base64'));}
 async function click(selector,touch){
  await c.ev(selector=>document.querySelector(selector)?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'}),selector);await c.delay(100);
  const point=await c.ev(selector=>{const button=document.querySelector(selector);if(!button)throw Error('找不到点击目标 '+selector);button.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});const r=button.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{x,y,height:r.height,hit:button.contains(document.elementFromPoint(x,y))};},selector);
  assert.ok(point.hit,'按钮被遮挡：'+selector+' '+JSON.stringify(point));assert.ok(point.height>=44,selector+' 点击高度不足');
  if(touch){await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  else{await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});}
  return point;
 }
 try{
  await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await c.send('Page.bringToFront');
  await c.ev(()=>{const s=__s,id='settings-search-acceptance';s.books.push({id,title:'搜索验收',novel:{title:'搜索验收'},chapters:[],characters:[]});s.loadBook(id);s.showNewBook=false;s.showBookEditor=false;s.showSettings_modal=true;s.activeSettingsTab='api';window.__searchAiCalls=0;window.fetch=async()=>{__searchAiCalls++;throw Error('设置搜索不应发起 AI 请求');};});await c.delay(650);
  for(const width of [1280,360,320])for(const dark of [false,true]){
   const label=width+'-'+(dark?'dark':'light'),height=width===1280?800:740,touch=width<768;
   await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:touch});
   await c.send('Emulation.setTouchEmulationEnabled',{enabled:touch});
   await c.ev(({dark})=>{const s=__s;if(s.isDark!==dark)s.toggleTheme();s.showSettings_modal=true;s.activeSettingsTab='api';s.mobileSidebarOpen=false;s.settingsSearchQuery='';s.closeSettingsSearch();},{dark});await c.delay(450);
   await check(label+'全部常用关联词进入可见前十',async()=>{
    const data=await c.ev(async rows=>{const checks=[];for(const row of rows)for(const query of row.queries){const input=document.querySelector('[data-settings-search-area] input');input.blur();input.focus();input.value=query;input.dispatchEvent(new Event('input',{bubbles:true}));await Vue.nextTick();checks.push({query,target:row.target,focused:__s.settingsSearchFocused,results:__s.settingsSearchResults.map(item=>({target:item.target,title:item.title})),dom:[...document.querySelectorAll('#settings-search-results [role="option"] .settings-search-result-title')].map(node=>node.textContent.trim())});}return checks;},cases);
    for(const row of data){assert.ok(row.results.some(item=>item.target==='settings-search-'+row.target),JSON.stringify(row));assert.deepEqual(row.dom,row.results.map(item=>item.title),JSON.stringify(row));assert.ok(row.dom.length<=10);}
    return {pairs:data.length,checks:data};
   });
   for(const query of ['时间','补写']){
    await c.ev(async query=>{const shell=document.querySelector('.settings-search-shell');shell.scrollTo({top:0,behavior:'instant'});const input=document.querySelector('[data-settings-search-area] input');input.focus();input.value=query;input.dispatchEvent(new Event('input',{bubbles:true}));await Vue.nextTick();},query);await c.delay(220);
    await check(label+'搜索“'+query+'”布局',async()=>{const data=await c.ev(()=>{const list=document.querySelector('#settings-search-results'),r=list.getBoundingClientRect();return{titles:[...list.querySelectorAll('.settings-search-result-title')].map(node=>node.textContent.trim()),list:r.toJSON(),viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth+1,inert:document.querySelector('.settings-search-body').inert};});assert.ok(data.titles.includes(query==='时间'?'首字超时':'二轮补写'));if(query==='补写')assert.ok(data.titles.includes('三轮摘要补写'));assert.equal(data.overflow,false);assert.equal(data.inert,true);assert.ok(data.list.left>=0&&data.list.right<=width+1&&data.list.bottom<=height+1);await shot(label+'-'+(query==='时间'?'time':'supplement'));return data;});
   }
   for(const row of cases){
    // 每个设置实际点击一次；共享词分别选择对应结果，不能只测第一条。
    const query=row.queries[0],target='settings-search-'+row.target;
    const index=await c.ev(async({query,target})=>{document.querySelector('.settings-search-shell').scrollTo({top:0,behavior:'instant'});const input=document.querySelector('[data-settings-search-area] input');input.focus();input.value=query;input.dispatchEvent(new Event('input',{bubbles:true}));await Vue.nextTick();return __s.settingsSearchResults.find(item=>item.target===target)?.index;},{query,target});assert.notEqual(index,undefined,query+' 没找到 '+target);
    await check(label+'点击 '+query+' → '+row.target,async()=>{
     const button=await click('#settings-search-option-'+index,touch);await c.delay(190);
     const flashed=await c.ev(target=>document.getElementById(target)?.classList.contains('settings-search-target-flash'),target);
     for(let i=0;i<48;i++){if(await c.ev(target=>{const r=document.getElementById(target)?.getBoundingClientRect(),s=document.querySelector('.settings-search-shell').getBoundingClientRect();return r&&r.top<s.bottom-44&&r.bottom>s.top+78;},target))break;await c.delay(50);}
     const data=await c.ev(target=>{const node=document.getElementById(target),r=node?.getBoundingClientRect(),shell=document.querySelector('.settings-search-shell'),sr=shell.getBoundingClientRect(),panel=node?.closest('[role="tabpanel"]');return{target,tab:__s.activeSettingsTab,panel:panel?.id,teamRoutes:__s.teamBookRoutesOpen,query:__s.settingsSearchQuery,focused:__s.settingsSearchFocused,inert:document.querySelector('.settings-search-body').inert,visible:!!node&&node.checkVisibility(),flash:node?.classList.contains('settings-search-target-flash'),box:r?.toJSON(),shell:sr.toJSON(),overflow:document.documentElement.scrollWidth>innerWidth+1};},target);
     assert.equal(data.query,'');assert.equal(data.focused,false);assert.equal(data.inert,false);assert.equal(data.visible,true,JSON.stringify(data));assert.equal(flashed,true);assert.equal(data.panel,'settings-panel-'+data.tab);assert.ok(data.box.bottom>data.shell.top&&data.box.top<data.shell.bottom,JSON.stringify(data));assert.equal(data.overflow,false);if(row.target.startsWith('team-')&&row.target!=='team-book')assert.equal(data.teamRoutes,true);return{...data,flashed,buttonHeight:button.height};
    });
   }
   await check(label+'喜欢查看入口抵达原有侧栏且可见',async()=>{
    await c.ev(async()=>{__s.settingsSearchQuery='爱心';__s.settingsSearchFocused=true;await Vue.nextTick();const item=__s.settingsSearchResults.find(row=>row.target==='settings-search-favorites');__s.navigateToSettingsSearchResult(item);});await c.delay(800);
    await click('#settings-search-favorites button',touch);await c.delay(450);
    const data=await c.ev(()=>{const section=document.querySelector('[data-settings-section="favorites"]'),r=section?.getBoundingClientRect();return{settings:__s.showSettings_modal,tab:__s.currentTab,mobileSidebar:__s.mobileSidebarOpen,visible:section?.checkVisibility(),box:r?.toJSON(),viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth+1};});
    await shot(label+'-favorites');assert.equal(data.settings,false,JSON.stringify(data));assert.equal(data.tab,'presets');assert.equal(data.visible,true);assert.equal(data.mobileSidebar,true);assert.ok(data.box.top>=-1&&data.box.top<height-44&&data.box.left>=-1&&data.box.right<=width+1,JSON.stringify(data));assert.equal(data.overflow,false);await c.ev(()=>{__s.showSettings_modal=true;__s.mobileSidebarOpen=false;});await c.delay(450);return data;
   });
   await check(label+'无MOD空白角色与超长文本几何',async()=>{await c.ev(()=>{__s.showSettings_modal=false;__s.mobileSidebarOpen=false;});await c.delay(250);const data=await c.ev(runFeedbackCharacterGeometryChecks,dark);assert.equal(data.length,2);await c.ev(()=>{__s.showSettings_modal=true;});await c.delay(450);return data;});
  }
  await check('搜索与跳转不请求AI、没有未捕获异常',async()=>{const calls=await c.ev(()=>__searchAiCalls);assert.equal(calls,0);assert.deepEqual(c.errors,[]);return{aiCalls:calls,errors:c.errors};});completed=true;console.log('设置搜索浏览器验收：'+results.length+' 项通过');
 }finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:completed,results,errors:c.errors,consoleErrors:c.logs.filter(row=>row.type==='error')},null,2));}
};
