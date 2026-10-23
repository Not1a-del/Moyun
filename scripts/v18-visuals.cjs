'use strict';
const assert=require('node:assert/strict');
module.exports=async function(c,check,shot){
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 for(const width of [1366,390]){
  await c.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
  await c.ev(()=>{__s.mobileSidebarOpen=false;__s.showStoryBibleWorkbench=false;__s.showCharacterWorkbench=false;__s.activeSettingsTab='context';__s.showSettings_modal=true;});await delay(300);
  for(const [kind,prior,setting]of [['gemini','三轮摘要补写','geminiTestInput'],['token','显示思维链','showTokenUsage']]){
   const selector=kind==='gemini'?'[data-settings-gemini-input]':'[data-settings-token-usage]';
   await check('设置开关位置与点击 '+kind+' '+width,async()=>{
    const d=await c.ev((selector,setting)=>{const row=document.querySelector(selector),button=row.querySelector('button'),track=button.querySelector('.toggle-track');row.scrollIntoView({block:'center'});const before=!!__s.settings[setting];button.click();const after=!!__s.settings[setting];button.click();const r=track.getBoundingClientRect(),hit=button.getBoundingClientRect();return{previous:row.previousElementSibling.textContent,before,after,restored:!!__s.settings[setting],width:r.width,height:r.height,hitHeight:hit.height,left:hit.left,right:hit.right,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1};},selector,setting);
    assert.ok(d.previous.includes(prior));assert.equal(d.after,!d.before);assert.equal(d.restored,d.before);assert.ok(d.width>=36&&d.width<=52&&d.height>=20&&d.height<=30);assert.ok(d.hitHeight>=43.5,JSON.stringify(d));assert.ok(d.left>=0&&d.right<=d.viewport);assert.equal(d.overflow,false);return d;
   });await delay(80);await shot('settings-'+kind+'-'+width);
  }
  await c.ev(()=>{__s.showSettings_modal=false;__s.modPacks=[];__s.structuredCharacters=[{id:'v18-geometry',name:'',desc:'',profileLevel:'core',profile:{},relationships:[],chapterLinks:{chapterIds:[],outlineIds:[]}}];__s.openCharacterWorkbench('v18-geometry');});await delay(200);
  for(const long of [false,true]){
   if(long){await c.ev(()=>{const ch=__s.selectedWorkbenchCharacter;ch.name='W'.repeat(800);ch.desc='Z'.repeat(4000);ch.profile.currentState='Q'.repeat(4000);});await delay(100);}
   await check('无MOD角色卡几何 '+(long?'超长文本':'空白角色')+' '+width,async()=>{
    const d=await c.ev(()=>{const root=document.querySelector('[data-moyun-workbench="character"]'),editor=root.querySelector('.moyun-character-editor'),head=editor.querySelector('.moyun-character-editor-head'),levels=editor.querySelector('.moyun-character-levels'),r=editor.getBoundingClientRect(),wr=root.getBoundingClientRect();return{width:r.width,workbenchWidth:wr.width,left:wr.left,right:wr.right,viewport:innerWidth,adjacent:head.nextElementSibling===levels,ratios:[...editor.querySelectorAll('.moyun-character-section,.moyun-character-levels')].map(el=>el.getBoundingClientRect().width/r.width),overflow:document.documentElement.scrollWidth>innerWidth+1,mods:__s.modPacks.length};});
    assert.equal(d.mods,0);assert.equal(d.adjacent,true);assert.ok(d.ratios.length>=4);assert.ok(d.ratios.every(r=>r>=.8));assert.ok(d.left>=0&&d.right<=d.viewport+1);assert.equal(d.overflow,false);return d;
   });await shot('character-'+(long?'long':'blank')+'-'+width);
  }
  await c.ev(()=>{__s.closeCharacterWorkbench();__s.settings.showTokenUsage=true;});await delay(100);
  await check('Token位置与三列排列 '+width,async()=>{
   const d=await c.ev(()=>{const row=document.querySelector('[data-writing-token-usage]'),input=document.querySelector('[data-moyun-composer-prompt]'),r=row.getBoundingClientRect(),cols=[...row.children].map(el=>{const a=el.getBoundingClientRect();return{x:a.x,y:a.y,text:el.textContent.trim()};});return{text:row.textContent,bottom:r.bottom,inputTop:input.getBoundingClientRect().top,cols,display:getComputedStyle(row).display};});
   assert.equal(d.cols.length,3);assert.ok(d.bottom<=d.inputTop);assert.ok(d.cols[0].x<d.cols[1].x&&d.cols[1].x<d.cols[2].x);assert.equal(d.cols[0].y,d.cols[2].y);assert.match(d.text,/输入.*输出.*缓存命中/s);return d;
  });await shot('composer-final-'+width);
 }
 await check('手机真实触摸长按：切换自定义字数并聚焦输入框',async()=>{
  await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  const point=await c.ev(()=>{const el=document.querySelector('[data-word-count]');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});await delay(650);
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(100);
  const d=await c.ev(()=>{const input=document.querySelector('[data-custom-word-count]');return{exists:!!input,focused:document.activeElement===input};});assert.equal(d.exists,true);assert.equal(d.focused,true);
  await c.ev(()=>{__s.customWordCount='300.5';__s.commitWordCount();});await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});return d;
 });
};
