'use strict';
// 使用已有 Edge 的独立测试 profile/CDP 端口。只测试本机页面和模拟 API。
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const port=Number(process.argv[2]||9224), base='http://127.0.0.1:4173/index.html';
const out=path.join(__dirname,'../.ui-check');fs.mkdirSync(out,{recursive:true});
const results=[],errors=[];let ws,id=0;const pending=new Map();
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function ev(fn,...args){const r=await send('Runtime.evaluate',{expression:'('+fn.toString()+')('+args.map(x=>JSON.stringify(x)).join(',')+')',returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function ready(){for(let i=0;i<100;i++){try{if(await ev(()=>!!document.querySelector('#app')?.__vue_app__?._instance?.proxy?.$?.setupState))return;}catch(e){if(!/navigated|context|target/i.test(e.message))throw e;}await delay(200);}throw Error('Vue not ready');}
async function dismissGuides(){for(let i=0;i<5;i++){await ev(()=>{for(const text of ['开始使用','我知道了']){const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text&&b.getBoundingClientRect().width);b?.click();}});await delay(300);}}
async function record(name,fn){const data=await fn();results.push({name,ok:true,data});console.log('PASS',name,JSON.stringify(data??''));}
async function mock(){await ev(()=>{
  window.__moyunTest={requests:[],mode:'ok',body:'正文甲乙',pending:false};
  window.fetch=async function(url,opts){
    if(!String(url).startsWith('https://moyun-test.invalid/'))throw Error('测试禁止外发请求');
    const t=window.__moyunTest,b=JSON.parse(opts.body);t.requests.push(b);
    if(t.mode==='error')return new Response(JSON.stringify({error:{message:'测试错误'}}),{status:429});
    if(t.mode==='filter')return new Response('data: '+JSON.stringify({choices:[{delta:{},finish_reason:'content_filter'}]})+'\n\n',{headers:{'content-type':'text/event-stream'}});
    const reply=b.tools?.[0]?.function?.name==='output_reply',arg=JSON.stringify({content:t.body});
    const frames=reply?[{choices:[{delta:{tool_calls:[{index:0,id:'test-call',type:'function',function:{name:'output_reply',arguments:arg.slice(0,14)}}]}}]},{choices:[{delta:{tool_calls:[{index:0,function:{arguments:arg.slice(14)}}]},finish_reason:'tool_calls'}]}]:[{choices:[{delta:{content:t.body.slice(0,2)}}]},{choices:[{delta:{content:t.body.slice(2)},finish_reason:'stop'}]}];
    let index=0;t.pending=true;
    return new Response(new ReadableStream({async pull(c){await new Promise(r=>setTimeout(r,150));if(opts.signal?.aborted){c.error(opts.signal.reason);return;}if(index<frames.length)c.enqueue(new TextEncoder().encode('data: '+JSON.stringify(frames[index++])+'\n\n'));else{t.pending=false;c.close();}},cancel(){t.pending=false;}}),{headers:{'content-type':'text/event-stream'}});
  };
});}
(async()=>{
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();const target=targets.find(t=>t.type==='page'&&(t.url===base||t.url==='about:blank'));if(!target)throw Error('未找到独立测试页面');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
 await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:base});await delay(400);await ready();await delay(4500);await dismissGuides();
 await ev(()=>{const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState;window.__s=s;s.nsfwSettings.enabled=false;
   const r=s.createConnectionProfile({name:'离线模拟',templateId:'openai-compatible',baseUrl:'https://moyun-test.invalid/v1',defaultModel:'gemini-test',apiKey:'test-only',lastTest:{status:'ok'}});if(!r.ok)throw Error(r.reason);s.connectionCenter.defaultProfileId=r.profile.id;s.settings.geminiReplyInTool=null;s.showSettings_modal=true;s.activeSettingsTab='context';s.saveData();});await delay(300);
 for(const width of [1280,390]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<500});await delay(250);
   await record(width+' 开关位置/触控/无溢出',async()=>{const d=await ev(()=>{const a=document.querySelector('[data-settings-second-round-toggle]'),b=document.querySelector('[data-settings-gemini-reply-toggle]'),sw=b.querySelector('[role=switch]');sw.scrollIntoView({block:'center'});const r=sw.getBoundingClientRect();return{adjacent:a.nextElementSibling===b,on:sw.getAttribute('aria-checked'),w:r.width,h:r.height,overflow:document.documentElement.scrollWidth>innerWidth,hit:sw.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});assert.equal(d.hit,true);assert.equal(d.adjacent,true);assert.equal(d.on,'true');assert.ok(d.w>=44&&d.h>=44);assert.equal(d.overflow,false);return d;});
   await record(width+' 键盘/手动开关',async()=>{await ev(()=>document.querySelector('[aria-label="Gemini抗截断开关"]').focus());await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});await delay(150);assert.equal(await ev(()=>window.__s.settings.geminiReplyInTool),false);await ev(()=>document.querySelector('[aria-label="Gemini抗截断开关"]').click());assert.equal(await ev(()=>window.__s.settings.geminiReplyInTool),true);await ev(()=>window.__s.resetGeminiReplyAuto());});
   const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'v14-settings-'+width+'.png'),Buffer.from(shot.data,'base64'));
 }
 await record('手动关闭后刷新持久化',async()=>{await ev(()=>{window.__s.settings.geminiReplyInTool=false;window.__s.saveData();});await delay(2600);await send('Page.reload');await delay(400);await ready();for(let n=0;n<50;n++){if(await ev(()=>document.querySelector('#app').__vue_app__._instance.proxy.$.setupState.settings.geminiReplyInTool===false))break;await delay(100);}assert.equal(await ev(()=>document.querySelector('#app').__vue_app__._instance.proxy.$.setupState.settings.geminiReplyInTool),false);await ev(()=>{window.__s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState;window.__s.resetGeminiReplyAuto();});});
 await delay(2500);await dismissGuides();await mock();
 await record('所有11个文本模块实际调用/工具解码',async()=>{const data=await ev(async()=>{const s=window.__s,rows=[];for(const key of ['writing','supplement','settings','character','imagetext','outline','suggestion','review','summary','comments','translate']){const r=s.getModuleRequestConfig(key);const result=await s.fetchAdapterCompletion(r,[{role:'user',content:'输出测试'}],{stream:true});rows.push({key,text:result.text,tool:window.__moyunTest.requests.at(-1).tool_choice?.function?.name});}return rows;});assert.equal(data.length,11);data.forEach(d=>{assert.equal(d.text,'正文甲乙');assert.equal(d.tool,'output_reply');});return data;});
 await record('模型切换自动启停、手动覆盖跨模型保留',async()=>{const data=await ev(()=>{const s=window.__s,p=s.connectionCenter.profiles.find(p=>p.id===s.connectionCenter.defaultProfileId);p.defaultModel='other';const off=s.isGeminiReplySwitchOn();p.defaultModel='GeMiNi-test';const on=s.isGeminiReplySwitchOn();s.settings.geminiReplyInTool=false;p.defaultModel='gemini-other';const manual=s.isGeminiReplySwitchOn();s.resetGeminiReplyAuto();return{off,on,manual};});assert.deepEqual(data,{off:false,on:true,manual:false});return data;});
 await record('通用模块实时预览先于响应完成',async()=>{await ev(()=>{const s=window.__s;window.__live=s.fetchAdapterCompletion(s.getModuleRequestConfig('summary'),[{role:'user',content:'测试'}],{stream:true});});await delay(220);const during=await ev(()=>({visible:!!document.querySelector('[data-ai-text-streams]'),pending:window.__moyunTest.pending}));assert.equal(during.visible,true);assert.equal(during.pending,true);await ev(async()=>await window.__live);assert.equal(await ev(()=>window.__s.aiTextStreams.length),0);return during;});
 await record('角色流式草案/裸引号修复/确认前不写入',async()=>{
   const before=await ev(()=>{const s=window.__s;s.showSettings_modal=false;s.aiCharDesc='一个成年航海员';window.__moyunTest.body='{"name":"测试航海员","desc":"他说"你好"。"}';window.__draft=s.generateAiCharacter();return s.structuredCharacters.length;});await delay(230);assert.equal(await ev(()=>!!document.querySelector('[data-character-draft-stream]')),true);await ev(async()=>await window.__draft);
   const result=await ev(()=>({status:window.__s.characterDraftReview.status,count:window.__s.structuredCharacters.length,targets:window.__s.characterDraftReview.targets.length}));assert.equal(result.status,'review');assert.equal(result.count,before);assert.equal(result.targets,1);await ev(()=>{window.__s.requestCloseCharacterDraftReview();});return result;
 });
 await record('错误返回不写角色/不自动重试',async()=>{await ev(()=>{window.__moyunTest.mode='error';});const before=await ev(()=>({count:window.__s.structuredCharacters.length,requests:window.__moyunTest.requests.length}));await ev(async()=>await window.__s.generateAiCharacter());const after=await ev(()=>({count:window.__s.structuredCharacters.length,requests:window.__moyunTest.requests.length,status:window.__s.characterDraftReview.status}));assert.equal(after.count,before.count);assert.equal(after.requests,before.requests+1);assert.equal(after.status,'error');await ev(()=>window.__s.requestCloseCharacterDraftReview());return after;});
 await record('大纲独立入口工具输出及过滤不降级重试',async()=>{
   await ev(async()=>{const s=window.__s;s.novel.outline='';window.__moyunTest.mode='ok';window.__moyunTest.body='【卷纲更新】\n第1卷｜卷名：启航｜章节 1-10｜框架摘要：出海探索\n'+Array.from({length:10},(_,i)=>'第'+(i+1)+'章：船员在不同港口调查线索，完成本章任务。').join('\n');await s.generateOutline();});
   const saved=await ev(()=>window.__s.novel.outline);assert.match(saved,/启航/);
   const before=await ev(()=>{window.__moyunTest.mode='filter';return window.__moyunTest.requests.length;});await ev(async()=>await window.__s.generateOutline());assert.equal(await ev(()=>window.__s.novel.outline),saved);assert.equal(await ev(()=>window.__moyunTest.requests.length),before+1);
 });
 await record('文风业务入口修复裸引号后生成',async()=>{
   const before=await ev(()=>{window.__moyunTest.mode='ok';window.__moyunTest.body='[{"name":"清爽文风","prompt":"使用"简洁"叙事。"}]';return window.__s.writingStyles.length;});await ev(()=>window.__s.aiGenerateStyles());
   for(let i=0;i<40;i++){if(await ev(()=>!window.__s.isGeneratingStyles))break;await delay(100);}assert.equal(await ev(()=>window.__s.writingStyles.length),before+1);
 });
 await record('正文独立流式入口生成章节',async()=>{
   const before=await ev(async()=>{const s=window.__s;s.settings.secondRoundSupplementEnabled=false;s.settings.autoTimelineSupplement=false;s.settings.commentInline=false;s.settings.enableReviewer=false;s.wordCountTarget=600;s.generateCount=1;s.nextChapterPrompt='船员整理港口地图';window.__moyunTest.mode='ok';window.__moyunTest.body='第1章 启航\n\n'+Array.from({length:35},(_,i)=>'第'+i+'份航海记录展开在桌上，船员逐一核对港湾、潮汐和补给日期，然后将新的发现记入地图。').join('\n');const n=s.chapters.length;await s.startGeneration({count:1});return n;});
   for(let i=0;i<80;i++){if(await ev(()=>!window.__s.isGenerating))break;await delay(150);}const after=await ev(()=>({count:window.__s.chapters.length,busy:window.__s.isGenerating}));assert.equal(after.busy,false);assert.equal(after.count,before+1);return after;
 });
 for(const width of [1280,390])for(const long of [false,true]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<500});
   await ev(long=>{const s=window.__s;s.showSettings_modal=false;s.showCharacterDraftReview=false;s.structuredCharacters=[{id:'geometry',name:'测试角色',desc:long?'无空格超长文本'.repeat(600):'',profileLevel:'regular',profile:{},relationships:[],stateHistory:[]}];s.openCharacterWorkbench();s.selectWorkbenchCharacter('geometry');},long);await delay(300);
   await record(width+' '+(long?'超长文本':'空白角色')+'几何',async()=>{const d=await ev(()=>{const e=document.querySelector('.moyun-character-editor'),m=document.querySelector('.moyun-character-main');return{ratio:Math.min(...[...e.querySelectorAll('.moyun-character-section')].map(e=>e.getBoundingClientRect().width))/m.clientWidth,overflow:document.documentElement.scrollWidth>innerWidth,emptyInside:[...e.children].some(e=>String(e.className).includes('max-w-md'))};});assert.ok(d.ratio>=.8);assert.equal(d.emptyInside,false);assert.equal(d.overflow,false);return d;});
 }
 assert.equal(errors.length,0);fs.writeFileSync(path.join(out,'v14-browser-results.json'),JSON.stringify({passed:true,results,errors},null,2));console.log('BROWSER PASSED:',results.length);ws.close();
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(out,'v14-browser-results.json'),JSON.stringify({passed:false,results,errors,error:String(e)},null,2));ws?.close();process.exitCode=1;});
