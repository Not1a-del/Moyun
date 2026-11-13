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
if(typeof module!=='undefined')module.exports={runCharacterIsolationBrowserChecks};
