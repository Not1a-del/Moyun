'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const port=Number(process.argv[2]||9235),base=process.argv[3]||'http://127.0.0.1:4173/index.html';
const out=path.join(__dirname,'../.ui-check');fs.mkdirSync(out,{recursive:true});
let ws,id=0;const pending=new Map(),results=[],errors=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function ev(fn,...args){const r=await send('Runtime.evaluate',{expression:'('+fn.toString()+')('+args.map(x=>JSON.stringify(x)).join(',')+')',returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function until(fn){for(let i=0;i<200;i++){if(await fn())return;await delay(100);}throw Error('等待页面状态超时');}
async function record(name,fn){const data=await fn();results.push({name,ok:true,data});console.log('PASS',name,JSON.stringify(data??''));}
async function setup(){
 await until(async()=>{try{return await ev(()=>!!document.querySelector('#app')?.__vue_app__?._instance?.proxy?.$?.setupState);}catch(e){if(/navigated|context|closed/i.test(e.message))return false;throw e;}});await delay(4500);
 for(let i=0;i<4;i++){await ev(()=>{for(const text of ['开始使用','我知道了'])[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text&&b.getBoundingClientRect().width)?.click();});await delay(250);}
 await ev(()=>{window.__s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState;});
}
async function mock(){await ev(()=>{
 window.__test={requests:[],scenario:'off',first:'',second:''};
 window.fetch=async(url,opts)=>{
  if(!String(url).startsWith('https://moyun-test.invalid/'))throw Error('禁止外发测试请求');
  const t=window.__test,b=JSON.parse(opts.body),supplement=b.messages.at(-1).content.startsWith('【二轮字数补充】');
  t.requests.push({url,body:b,supplement});
  if(b.tools||b.tool_choice||b.parallel_tool_calls!==undefined)throw Error('不应携带工具请求');
  if(supplement&&t.scenario==='failure')return new Response(JSON.stringify({error:{message:'测试补写失败'}}),{status:400});
  const content=supplement?t.second:t.first;
  if(!b.stream)return new Response(JSON.stringify({choices:[{message:{content},finish_reason:'stop'}]}),{headers:{'content-type':'application/json'}});
  const frames=[{choices:[{delta:{content:content.slice(0,20)}}]},{choices:[{delta:{content:content.slice(20)},finish_reason:'stop'}]}];let n=0;
  return new Response(new ReadableStream({async pull(c){await new Promise(r=>setTimeout(r,100));if(opts.signal?.aborted){c.error(opts.signal.reason);return;}if(n<frames.length)c.enqueue(new TextEncoder().encode('data: '+JSON.stringify(frames[n++])+'\n\n'));else c.close();}}),{headers:{'content-type':'text/event-stream'}});
 };
});}
(async()=>{
 const target=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
 await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:base});await setup();
 await ev(()=>{const s=window.__s;s.nsfwSettings.enabled=false;for(const [name,model] of [['正文测试','gemini-3.8-flash'],['补写测试','[AN]gemini-3.8-flash']]){const r=s.createConnectionProfile({name,templateId:'openai-compatible',baseUrl:'https://moyun-test.invalid/v1',defaultModel:model,apiKey:'test-only',lastTest:{status:'ok'}});if(!r.ok)throw Error(r.reason);if(name==='正文测试'){s.connectionCenter.defaultProfileId=r.profile.id;window.__writingId=r.profile.id;}else window.__supplementId=r.profile.id;}s.connectionCenter.moduleRoutes.writing={profileId:window.__writingId};s.connectionCenter.moduleRoutes.supplement={profileId:''};s.settings.secondRoundSupplementEnabled=true;s.showSettings_modal=true;s.activeSettingsTab='context';s.saveData();});
 for(const width of [1280,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<500});await delay(250);
  await record(width+' 二轮补写点击开关',async()=>{for(const expected of [false,true]){await ev(()=>document.querySelector('[aria-label="二轮补写开关"]').click());await delay(100);assert.equal(await ev(()=>window.__s.settings.secondRoundSupplementEnabled),expected);assert.equal(await ev(()=>document.querySelector('[aria-label="二轮补写开关"]').getAttribute('aria-checked')),String(expected));}assert.equal(await ev(()=>!!document.querySelector('[data-settings-gemini-reply-toggle]')),false);});
 }
 await record('二轮补写开/关各自刷新持久化',async()=>{for(const value of [false,true]){await ev(value=>{const s=window.__s;if((s.settings.secondRoundSupplementEnabled!==false)!==value)s.toggleSecondRoundSupplement();s.saveData();},value);await delay(2700);await send('Page.reload');await setup();assert.equal(await ev(()=>window.__s.settings.secondRoundSupplementEnabled),value);}});
 await mock();
 const scenarios=[['off',false,true],['on',true,true],['enough',true,true],['still-short',true,true],['failure',true,true],['dedicated',true,true],['nonstream',true,false]];
 for(const width of [1280,390])for(const [scenario,enabled,stream] of scenarios){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<500});
  await record(width+' 二轮补写 '+scenario,async()=>{
   const before=await ev(async(scenario,enabled,stream)=>{
    const s=window.__s,t=window.__test;s.showSettings_modal=false;s.showCharacterDraftReview=false;s.nsfwSettings.enabled=false;
    s.settings.secondRoundSupplementEnabled=enabled;s.settings.streamEnabled=stream;s.settings.autoTimelineSupplement=false;s.settings.commentInline=false;s.settings.enableReviewer=false;
    s.wordCountTarget=600;s.generateCount=1;s.nextChapterPrompt='成年守塔员整理灯塔航海记录';s.chapters=[];
    const writing=s.connectionCenter.profiles.find(p=>p.name==='正文测试'),supp=s.connectionCenter.profiles.find(p=>p.name==='补写测试');
    s.connectionCenter.moduleRoutes.writing={profileId:writing.id};s.connectionCenter.moduleRoutes.supplement={profileId:scenario==='dedicated'?supp.id:''};
    t.requests=[];t.scenario=scenario;
    t.first='首轮起点。'+Array.from({length:scenario==='enough'?25:4},(_,i)=>'第'+i+'份记录放在桌上，守塔员核对日期与航线，窗外潮水慢慢退去，他将新的发现写在纸上。').join('\n')+'首轮终点。';
    t.second='补写起点。'+Array.from({length:scenario==='still-short'?1:17},(_,i)=>'第'+i+'张地图映着晨光，同伴指出浅滩的位置，他们交换看法并整理绳索，为傍晚的巡查做好准备。').join('\n')+'补写终点。';
    // 本脚本专测原字数补写合同；缺摘要及第三轮由 v16-r2-summary-browser.cjs 单独覆盖。
    t.first+='\n---剧情摘要---\n守塔员在灯塔核对航海记录与日期，将新发现记入日志，准备继续检查航线。';
    t.second+='\n---剧情摘要---\n守塔员与同伴核对航线和浅滩位置，补充地图与日志，并整理巡查所需的绳索和记录。';
    const n=s.chapters.length;await s.startGeneration({count:1});return n;
   },scenario,enabled,stream);
   await until(()=>ev(()=>!window.__s.isGenerating));
   const d=await ev(()=>({requests:window.__test.requests,first:window.__test.first,second:window.__test.second,count:window.__s.chapters.length,saved:window.__s.chapters.at(-1)?.content||'',busy:window.__s.isGenerating}));
   const wants=enabled&&scenario!=='enough';assert.equal(d.count,before+1);assert.equal(d.requests.length,wants?2:1);assert.equal(d.busy,false);assert.ok(d.saved.includes('首轮起点。'));assert.ok(d.saved.includes('首轮终点。'));
   assert.equal(d.requests[0].body.stream,stream);assert.equal(d.requests[0].body.model,'gemini-3.8-flash');
   if(wants){const [first,second]=d.requests;assert.equal(second.supplement,true);assert.deepEqual(second.body.messages.slice(0,first.body.messages.length),first.body.messages);assert.equal(second.body.messages.at(-2).role,'assistant');assert.equal(second.body.messages.at(-2).content,d.first);assert.equal(second.body.model,scenario==='dedicated'?'[AN]gemini-3.8-flash':'gemini-3.8-flash');}
   assert.equal(d.saved.includes('补写起点。'),wants&&scenario!=='failure');
   if(wants&&scenario!=='failure')assert.ok(d.saved.indexOf('补写起点。')>d.saved.indexOf('首轮终点。'));
   return {requests:d.requests.length,chapters:d.count,savedChars:d.saved.length,secondModel:wants?d.requests[1].body.model:null,hasSupplement:d.saved.includes('补写起点。')};
  });
 }
 assert.equal(errors.length,0);fs.writeFileSync(path.join(out,'v15-supplement-results.json'),JSON.stringify({passed:true,base,results,errors},null,2));console.log('SUPPLEMENT PASSED:',results.length);ws.close();
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(out,'v15-supplement-results.json'),JSON.stringify({passed:false,base,results,errors,error:String(e)},null,2));ws?.close();process.exitCode=1;});
