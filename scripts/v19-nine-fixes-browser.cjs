'use strict';
// 在 Cindy 的隔离预览来源执行；仅假响应，禁止真实服务商请求。
async function runCharacterIsolationBrowserChecks() {
 const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState;
 const assert=(ok,label)=>{if(!ok)throw Error(label);},clone=x=>JSON.parse(JSON.stringify(x));
 const originalFetch=window.fetch,calls=[],results=[];
 const bad={name:'林舟',desc:'林舟守护灯塔。',personalityTags:['克制'],dialogueType:'cold',speakingStyle:'短句，不用比喻。',exampleDialogues:['灯还亮着。'],characterPrompt:'遵守角色的克制表达。',relationships:[],avatarPrompt:'portrait',presets:[{content:''}],styles:[{prompt:''}],pipeline:{pre:'不许注入'}};
 let responseKind='one';
 window.fetch=async(input,init={})=>{
  const url=new URL(String(input),location.href);if(url.hostname!=='nine-fixes.invalid')return originalFetch.call(window,input,init);
  const body=JSON.parse(init.body),text=body.messages.map(m=>typeof m.content==='string'?m.content:JSON.stringify(m.content)).join('\n');
  calls.push({kind:responseKind,body:clone(body)});
  let reply=responseKind==='presets'?{presets:[{name:'有效预设',content:'  写清人物动作。  ',enabled:true},{name:'空白',content:' \n '}]}
   :responseKind==='array'?[bad]:responseKind==='envelope'?{characters:[bad],dialogueStyles:[{id:'cold',label:'克制',prompt:'短句'}],presets:[{content:''}],styles:[{prompt:''}],pipeline:{pre:'不许注入'}}:bad;
  if(text.includes('你是AI写作系统专家'))reply={presets:[{name:'有效预设',content:'  写清人物动作。  ',enabled:true},{name:'空白',content:' \n '}]};
  const output=JSON.stringify(reply),tool=body.tools?.some(t=>t.function?.name==='output_reply');
  return new Response(JSON.stringify({choices:[{message:tool?{content:null,tool_calls:[{id:'reply',type:'function',function:{name:'output_reply',arguments:JSON.stringify({content:output})}}]}:{content:output},finish_reason:'stop'}]}),{headers:{'content-type':'application/json'}});
 };
 try {
  const id='nine-role-'+Date.now();s.books.push({id,title:'九项角色验收',novel:{title:'九项角色验收',theme:'林舟守灯',worldView:'海边灯塔'},chapters:[],characters:[]});s.loadBook(id);s.modPacks=[];s.settings.streamEnabled=false;s.oneKeyAutoRetry=false;
  s.connectionCenter={version:1,profiles:[],defaultProfileId:'',moduleRoutes:{}};
  const profile=s.createConnectionProfile({name:'本地 Gemini 假响应',templateId:'openai-compatible',baseUrl:'https://nine-fixes.invalid/v1',defaultModel:'gemini-nine-mock',apiKey:'test-only',lastTest:{status:'ok'}});
  assert(profile.ok,'mock connection');s.connectionCenter.defaultProfileId=profile.profile.id;
  const configSnapshot=()=>JSON.stringify([s.presets,s.writingStyles,s.promptPipeline]);
  const closeDraft=()=>{s.characterDraftReview.status='idle';s.showCharacterDraftReview=false;};
  for(const enabled of [false,true]) {
   s.settings.geminiTestInput=enabled;s.settings.preventTruncation=enabled;
   const before=configSnapshot();s.aiCharDesc='一位守灯人';responseKind='one';await s.generateAiCharacter();assert(s.characterDraftReview.status==='review','create review');await s.applyCharacterAiDraft();closeDraft();
   const ci=s.structuredCharacters.length-1;assert(s.structuredCharacters[ci].dialogueType==='cold','dialogue type saved');
   await s.aiCompleteCharacter(ci);await s.applyCharacterAiDraft({onlyFill:true});closeDraft();
   s.batchCharCount=1;s.batchCharPrompt='另一个守灯人';responseKind='array';await s.generateBatchCharacters();await s.applyCharacterAiDraft();closeDraft();
   const ch=s.structuredCharacters[ci];ch.speakingStyle='';responseKind='one';await s.aiSupplementSelectedCharacter(ch);assert(ch.speakingStyle===bad.speakingStyle,'workbench speaking style');
   assert(before===configSnapshot(),'role request changed global config');
   responseKind='envelope';Object.assign(s.okCfg,{genTitle:false,genSynopsis:false,genWorldView:false,genNegative:false,genOutline:false,genDetailed:false,genPipeline:false,genStyles:false,genPresets:false,genCover:false,genCharAvatar:false,charCount:1});s.newBookForm={title:'单次角色隔离',theme:'海边守灯',worldView:'海边灯塔'};
   const estimate=s.okEstimate.textReqs,start=calls.length;await s.startOneKeyGeneration();assert(calls.length-start===estimate,'one-key request estimate');
   const originalId=s.currentBookId,existing=configSnapshot();s.retryOneKeyModule('chars');await s.startOneKeyGeneration();assert(s.currentBookId===originalId,'retry created another book');assert(existing===configSnapshot(),'retry role changed global config');
   s.okCfg.genPresets=true;const cost=s.okEstimate.textReqs;assert(cost===estimate+1,'preset must cost one additional request');const from=calls.length;await s.startOneKeyGeneration();assert(calls.length-from===cost,'preset actual request count');
   const added=s.presets.filter(p=>p.name==='有效预设');assert(added.length===1&&added[0].enabled===false&&added[0].content==='写清人物动作。','preset guard');assert(!s.presets.some(p=>p.name==='空白'),'blank preset persisted');
   results.push({geminiInput:enabled,preventTruncation:enabled,passed:true,roleEntries:6,requests:calls.length-start});
  }
  const roleCalls=calls.filter(row=>!row.body.messages.some(m=>String(m.content).includes('你是AI写作系统专家')));
  for(const row of roleCalls)assert(!row.body.messages.some(m=>/"(?:presets|styles|pipeline)"\s*:/.test(String(m.content))),'forbidden role output schema');
  s.saveData(); await new Promise(resolve=>setTimeout(resolve,2300));
  const receipt={passed:true,results,requestCount:calls.length,rolesChecked:roleCalls.length,model:'gemini-nine-mock',protocol:'openai-compatible'};
  window.__nineP1={...receipt,calls}; return receipt;
 } finally {window.fetch=originalFetch;}
}
async function runFloatingFieldBrowserChecks(dark=false) {
 const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState,wait=ms=>document.hasFocus()?new Promise(r=>setTimeout(r,ms)):Promise.resolve(),assert=(v,m)=>{if(!v)throw Error(m);};
 // 侧栏后台页的入场动画会停在首帧；几何验收只关闭动画，不改变布局规则。
 if(!document.querySelector('#nine-no-motion')){const st=document.createElement('style');st.id='nine-no-motion';st.textContent='[data-moyun-modal]{transform:none!important;transition:none!important;opacity:1!important}';document.head.appendChild(st);}
 if(s.isDark!==dark)s.toggleTheme();s.openSettingsTab('api');s.openConnectionProfileEditor('openai-compatible');await wait(80);
 const rows=[...document.querySelectorAll('[data-moyun-modal="connection-profile-editor"] .moyun-floating-field')];assert(rows.length===4,'four labels');
 const positions=[];
 for(const row of rows){const input=row.querySelector('input'),label=row.querySelector('span'),position=()=>label.getBoundingClientRect().top-row.getBoundingClientRect().top;input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.blur();await wait(160);const empty=position();
  input.focus();await wait(160);const focused=position();if(document.hasFocus())assert(focused<empty-5,'focus floats '+input.getAttribute('aria-label'));
  input.value='long-value-for-layout-test';input.dispatchEvent(new Event('input',{bubbles:true}));input.blur();await wait(160);const filled=position();assert(filled<empty-5,'filled floats');assert(input.getBoundingClientRect().height>=44,'44px input');positions.push({label:input.getAttribute('aria-label'),empty,focused,filled,nativeFocusAvailable:document.hasFocus()});
 }
 assert(document.querySelector('[data-settings-api-key]').type==='password','secret remains masked');
 const button=document.querySelector('[data-moyun-modal="connection-profile-editor"] [aria-describedby]')||[...document.querySelectorAll('button')].find(b=>b.textContent==='验证模型');button.disabled=false;
 button.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}));assert(document.querySelector('.moyun-help-tip'),'hover tip');button.dispatchEvent(new PointerEvent('pointerleave',{pointerType:'mouse'}));
 button.dispatchEvent(new FocusEvent('focus'));assert(document.querySelector('.moyun-help-tip'),'keyboard focus handler tip');button.dispatchEvent(new FocusEvent('blur'));
 button.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',bubbles:true}));let r=document.querySelector('.moyun-help-tip').getBoundingClientRect();assert(r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,'tip fits viewport');const tip=r.toJSON();if(document.hasFocus()){await wait(3150);assert(!document.querySelector('.moyun-help-tip'),'touch expires');}
 button.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',bubbles:true}));document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));assert(!document.querySelector('.moyun-help-tip'),'outside dismisses');
 Object.assign(s.connectionProfileDraft,{name:'浮动标签验收',baseUrl:'https://nine-fixes.invalid/v1',defaultModel:'gemini-nine-mock',apiKey:'test-only'});
 const original=window.fetch;window.fetch=async()=>new Response(JSON.stringify({data:[{id:'gemini-nine-mock'}],choices:[{message:{content:'OK'}}]}),{headers:{'content-type':'application/json'}});
 try{assert(await s.testConnectionProfileDraft(),'connection validates');assert(await s.testConnectionProfileModelDraft(),'model validates');assert(s.saveConnectionProfileDraft(),'profile saves');}finally{window.fetch=original;}
 s.openConnectionProfileEditor('openai-compatible',s.connectionCenter.profiles.find(p=>p.name==='浮动标签验收'));await wait(80);
 assert(s.connectionProfileDraft.defaultModel==='gemini-nine-mock','saved model');
 const overflow=document.documentElement.scrollWidth>innerWidth;assert(!overflow,'no horizontal scroll');
 return {passed:true,viewport:[innerWidth,innerHeight],dark,positions,tip,connectionSaved:true};
}
async function startSummaryBackfillBrowserCheck(enabled=false){
 const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState,assert=(v,m)=>{if(!v)throw Error(m);};
 const id='nine-summary-'+Date.now(),chapters=Array.from({length:30},(_,i)=>({id:id+'-'+i,title:'第'+(i+1)+'章 灯塔',content:'第'+(i+1)+'章正文。'+ '海上灯火。'.repeat(5),summary:i<5?'':'原摘要'+i,branchId:'main'}));
 s.books.push({id,title:'补摘要验收',novel:{title:'补摘要验收',volumes:[]},chapters,characters:[]});s.loadBook(id);s.modPacks=[];s.showSettings_modal=false;s.currentTab='chapters';s.mobileSidebarOpen=true;s.settings.geminiTestInput=enabled;s.settings.preventTruncation=enabled;s.settings.streamEnabled=true;
 const made=s.createConnectionProfile({name:'补摘要假模型'+Date.now(),templateId:'openai-compatible',baseUrl:'https://nine-fixes.invalid/v1',defaultModel:'gemini-summary-mock',apiKey:'test-only',lastTest:{status:'ok'}});assert(made.ok,'summary profile');s.setModuleRouteProfile('summary',made.profile.id);
 const original=window.fetch,calls=[];window.__nineP3={calls,original,enabled,id,pending:false};
 window.fetch=async(url,init={})=>{if(!String(url).includes('nine-fixes.invalid'))return original(url,init);const body=JSON.parse(init.body);calls.push(body);if(calls.length===1){const tool=body.tools?.some(t=>t.function?.name==='output_reply');return new Response(JSON.stringify({choices:[{message:tool?{tool_calls:[{id:'r',type:'function',function:{name:'output_reply',arguments:JSON.stringify({content:'第一章完整摘要'})}}]}:{content:'第一章完整摘要'},finish_reason:'stop'}]}),{headers:{'content-type':'application/json'}});}
  const payload=body.tools?.length?{choices:[{delta:{tool_calls:[{index:0,id:'r2',type:'function',function:{name:'output_reply',arguments:'{"content":"第二章半截摘要'}}]},finish_reason:null}]}:{choices:[{delta:{content:'第二章半截摘要'},finish_reason:null}]};
  return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: '+JSON.stringify(payload)+'\n\n'));window.__nineP3.pending=true;init.signal.addEventListener('abort',()=>{try{c.error(new DOMException('stop','AbortError'));}catch{}},{once:true});}}),{headers:{'content-type':'text/event-stream'}});
 };
 s.openSummaryBackfill();assert(s.selectedSummaryBackfillCount===5,'five selected');assert(calls.length===0,'picker no request');s.confirmSummaryBackfill();assert(s.showConfirm,'second confirmation');s.cancelConfirm();assert(calls.length===0,'cancel no request');s.confirmSummaryBackfill();s.execConfirm();
 return {started:s.summaryBackfill.running,enabled,selected:5,requests:calls.length};
}
async function finishSummaryBackfillBrowserCheck(){
 const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState,t=window.__nineP3,assert=(v,m)=>{if(!v)throw Error(m);};assert(t.pending,'second stream reached');assert(s.summaryBackfill.completed===1,'first saved');assert(s.visibleChapters[0].summary==='第一章完整摘要','first complete');assert(s.visibleChapters[1].summary==='第二章半截摘要','partial visible');s.stopSummaryBackfill();window.fetch=t.original;
 const receipt={enabled:t.enabled,requests:t.calls.length,models:t.calls.map(c=>c.model),first:s.visibleChapters[0].summary,second:s.visibleChapters[1].summary,incomplete:s.visibleChapters[1].summaryIncomplete,third:s.visibleChapters[2].summary,bookId:t.id};window.__nineP3.receipt=receipt;return receipt;
}
if(typeof module!=='undefined')module.exports={runCharacterIsolationBrowserChecks,runFloatingFieldBrowserChecks,startSummaryBackfillBrowserCheck,finishSummaryBackfillBrowserCheck};
