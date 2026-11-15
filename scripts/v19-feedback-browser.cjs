'use strict';
// 在 Cindy 管理的隔离预览页执行，仅使用测试书和本地假响应。
async function runFeedbackLayoutChecks(dark=false) {
 const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState;
 const assert=(ok,label)=>{if(!ok)throw Error(label);},tick=()=>new Promise(r=>setTimeout(r,60));
 s.showConfirm=false;s.showNewBook=false;s.showBranchPanel=false;s.showOutlineInMain=false;s.showDetailedOutlineInMain=false;s.showCharacterWorkbench=false;s.showStoryBibleWorkbench=false;s.immersiveMode=false;s.composerCollapsed=false;s.priorityEnabled=false;
 if(s.isDark!==dark)s.toggleTheme();s.settings.sidebarCollapsed=true;s.mobileSidebarOpen=false;s.modPacks=[];s.settings.showTokenUsage=true;
 const id='v19-feedback-browser';s.syncBookData();
 if(!s.books.some(b=>b.id===id))s.books.push({id,title:'反馈修复验收',novel:{title:'反馈修复验收',outline:'',worldView:''},chapters:[],characters:[]});
 s.loadBook(id);s.activeBranchId='main';s.novel.favoriteClips=[];
 s.chapters=[{id:'feedback-ch1',branchId:'main',title:'第一章 灯塔',content:['林远推开灯塔的门。','他决定留下来继续寻找旧灯。','最后一段正文不可遮挡。'].join(String.fromCharCode(10,10)),summary:'进入灯塔',isExpanded:true,versions:[]}];
 await tick();
 const main=document.querySelector('main'),composer=document.querySelector('[data-moyun-region=composer]');main.style.scrollBehavior='auto';main.scrollTop=main.scrollHeight;
 const mr=main.getBoundingClientRect(),cr=composer.getBoundingClientRect();
 assert(mr.bottom<=cr.top+1,'composer overlaps prose');assert(cr.height<220,'composer remains too tall');assert(document.documentElement.scrollWidth<=innerWidth,'page horizontal overflow');
 const heart=document.querySelector('[data-chapter-favorite]'),svg=heart.querySelector('svg');heart.scrollIntoView({block:'center',behavior:'instant'});
 assert(!heart.classList.contains('is-liked'),'initial heart not gray');assert(heart.nextElementSibling.textContent.trim()==='删除','heart is not left of delete');
 const hr=heart.getBoundingClientRect(),sr=svg.getBoundingClientRect(),style=getComputedStyle(heart);
 assert(Math.abs(hr.x+hr.width/2-sr.x-sr.width/2)<1&&Math.abs(hr.y+hr.height/2-sr.y-sr.height/2)<1,'heart not centered');assert(style.borderTopWidth==='0px'&&style.boxShadow==='none','heart still has outer circle');
 heart.click();await tick();assert(s.showConfirm&&s.confirmCfg.title==='喜欢','heart did not open choice dialog');
 const choice=label=>[...document.querySelectorAll('[data-moyun-modal=confirm] button')].find(x=>x.textContent.trim()===label);
 choice('整篇喜欢').click();await tick();assert(heart.classList.contains('is-liked'),'whole favorite did not turn red');
 heart.click();await tick();choice('整篇喜欢').click();await tick();assert(!heart.classList.contains('is-liked'),'unfavorite not gray');
 heart.click();await tick();choice('段落喜欢').click();await tick();
 const para=document.querySelector('[data-favorite-paragraph] .moyun-favorite-heart');assert(para,'paragraph heart missing');para.click();await tick();assert(para.classList.contains('is-liked')&&heart.classList.contains('is-liked'),'paragraph/main hearts not red');
 para.click();await tick();assert(!heart.classList.contains('is-liked'),'last paragraph removal did not reset main heart');
 s.priorityEnabled=true;await tick();assert(document.querySelector('[data-priority-input]'),'priority input missing');assert(main.getBoundingClientRect().bottom<=composer.getBoundingClientRect().top+1,'priority overlaps prose');s.priorityEnabled=false;
 s.novel.unfinishedMode=true;s.novel.unfinishedModeClosed=false;s.markUnfinishedPlanComplete();await tick();assert(s.novel.unfinishedMode&&s.showConfirm&&s.confirmCfg.message.includes('不可返回'),'unfinished disabled before confirmation');s.cancelConfirm();assert(s.novel.unfinishedMode,'cancel disabled unfinished');s.markUnfinishedPlanComplete();await s.execConfirm();assert(!s.novel.unfinishedMode&&s.novel.unfinishedModeClosed,'confirmation did not permanently close');
 s.chapterOutlines=[1,2,3].map(chapterNo=>({id:'outline-'+chapterNo,chapterNo,title:'细纲'+chapterNo,content:'原细纲'+chapterNo,isExpanded:true}));s.chapters=[];s.openDetailedOutlineWorkbench();await tick();
 const fork=[...document.querySelectorAll('.moyun-do-card-head button')].find(x=>x.textContent.trim()==='从这章分支');assert(fork&&!fork.disabled,'empty prose outline fork disabled');fork.click();await tick();
 for(let i=0;i<100&&(s.activeBranchId==='main'||!s.showBranchPanel);i++)await tick();assert(s.activeBranchId!=='main'&&s.visibleChapters.length===0&&s.showBranchPanel,'empty outline branch not entered');assert(s.chapterOutlines.length===1,'outline fork did not truncate planning');s.showBranchPanel=false;await tick();
 s.showDetailedOutlineInMain=false;s.showOutlineInMain=false;s.chapters=[{id:'branch-1',branchId:s.activeBranchId,title:'第一章',content:'支线第一章',isExpanded:true},{id:'branch-2',branchId:s.activeBranchId,title:'第二章',content:'支线第二章',isExpanded:true},{id:'main-1',branchId:'main',title:'第一章',content:'主线一'},{id:'main-2',branchId:'main',title:'第二章',content:'主线二'}];s.insertChapterAt(2);assert(s.visibleChapters[2].title==='第3章','branch new chapter named by book total');
 s.chapters.forEach(ch=>ch.isEditing=false);await tick();
 return {viewport:[innerWidth,innerHeight],theme:document.documentElement.dataset.theme,composerHeight:Math.round(cr.height),mainBottom:Math.round(mr.bottom),composerTop:Math.round(cr.top),heartTarget:[hr.width,hr.height],heartGlyph:[sr.width,sr.height],overlap:false,horizontalOverflow:false,checks:['favorite whole/paragraph/red/reset/centering','priority expanded','unfinished cancel/confirm','outline empty fork and enter','branch chapter title3']};
}

async function runFeedbackTeamChecks(enabled=false,model='qwen-feedback-stream',templateId='openai-compatible') {
 const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState;
 const originalFetch=window.fetch,center=JSON.parse(JSON.stringify(s.connectionCenter)),originalGemini=s.settings.geminiTestInput,originalTruncation=s.settings.preventTruncation;
 const assert=(ok,label)=>{if(!ok)throw Error(label);},tick=()=>new Promise(r=>setTimeout(r,30)),requests=[],live=[],held=[],nl=String.fromCharCode(10),blank=nl+nl;
 const until=async(fn,label)=>{for(let i=0;i<250;i++){if(fn())return;await tick();}throw Error('Team timeout: '+label);};
 const plan={titleCandidates:['反馈流式验收'],genre:'悬疑',tone:'克制',characters:[{name:'林远',summary:'守灯人'}],userFacts:[{text:'林远寻找旧灯',source:'用户'}],volumes:[{number:1,title:'灯塔',startChapter:1,endChapter:2,summary:'寻找旧灯',writingRequirement:'逐章寻找',bridge:'留下线索'}],chapterCount:2,unfinishedMode:true,tasks:{settings:'设定',characters:'角色',outline:'纲要'}};
 const values={planner:plan,settings:{title:'反馈流式验收',worldView:'海边灯塔以潮汐供能，旧灯沉睡。',synopsis:'寻找旧灯'},characters:{characters:[{name:'林远',desc:'克制的守灯人',relationships:[]}]},outline:{outline:'林远开始寻找旧灯，线索尚未揭晓。',volumes:plan.volumes},review:{status:'ok',facts:[{text:'林远寻找旧灯',fulfilled:true}],issues:[]},details:['## 第1章 潮声','林远在灯塔找到旧地图。','【无问题】','## 第2章 灯影','他查出下一条线索。','【无问题】'].join(nl)};
 let mode='full',holdLive=true,releaseLive;const liveGate=new Promise(resolve=>{releaseLive=resolve;});
 window.fetch=async(input,init={})=>{
  const url=new URL(String(input),location.href);if(url.hostname!=='feedback.invalid')return originalFetch.call(window,input,init);
  const body=JSON.parse(init.body),prompt=JSON.stringify(body),id=prompt.includes('你是策划员')?'planner':prompt.includes('你是设定员')?'settings':prompt.includes('你是角色员')?'characters':prompt.includes('你是大纲卷纲员')?'outline':prompt.includes('你是细纲员')?'details':'review';
  const text=typeof values[id]==='string'?values[id]:JSON.stringify(values[id]),native=templateId==='gemini',tool=!!body.tools,stream=native?url.pathname.includes(':streamGenerateContent'):body.stream;requests.push({id,model:body.model||model,stream,mode,replyTool:tool,inputRewritten:!!body.contents?.some(row=>row.parts?.some(part=>part.functionResponse?.name==='read_user_input'))});assert(stream===true,'team requested non-stream');
  let offset=0;const payload=tool&&!native?JSON.stringify({content:text}):text,encode=new TextEncoder();
  const wire=(chunk,end)=>'data: '+JSON.stringify(native?{candidates:[{content:{parts:[tool?{functionCall:{name:'output_reply',args:{content:text.slice(0,end)}}}:{text:chunk}]}}]}:{choices:[{delta:tool?{tool_calls:[{index:0,function:{...(offset===0?{name:'output_reply'}:{}),arguments:chunk}}]}:{content:chunk}}]})+blank;
  return new Response(new ReadableStream({async pull(c){
   if(init.signal.aborted){c.error(new DOMException('用户停止','AbortError'));return;}
   if(offset>=payload.length){c.enqueue(encode.encode('data: [DONE]'+blank));c.close();return;}
   if(mode==='full'&&id==='settings'&&offset>0&&holdLive)await liveGate;
   if(mode==='stop'&&offset>0){await new Promise(resolve=>held.push(resolve));if(init.signal.aborted){c.error(new DOMException('用户停止','AbortError'));return;}}
   await tick();const end=Math.min(payload.length,offset+24);c.enqueue(encode.encode(wire(payload.slice(offset,end),end)));offset=end;
  }}),{headers:{'content-type':'text/event-stream'}});
 };
 try {
  s.showConfirm=false;s.showBranchPanel=false;s.showDetailedOutlineInMain=false;s.showOutlineInMain=false;s.settings.geminiTestInput=enabled;s.settings.preventTruncation=enabled;
  s.connectionCenter={version:1,profiles:[],defaultProfileId:'',moduleRoutes:{}};
  const made=s.createConnectionProfile({name:'本地流式假响应',templateId,baseUrl:'https://feedback.invalid/v1',defaultModel:model,apiKey:'test-only',lastTest:{status:'ok'}});assert(made.ok,'profile creation');s.connectionCenter.defaultProfileId=made.profile.id;
  s.openTeamBookMode();s.teamSkipPlanConfirm=false;s.teamPlanOptions.chapterCount=2;s.teamPlanOptions.unfinishedMode=true;s.teamBrief='林远寻找旧灯';
  const planning=s.splitTeamPlan();await until(()=>s.teamPlanRaw.length>0&&s.teamPhase==='planning','live planner');assert(document.querySelector('[data-team-planner-stream]').textContent.includes(s.teamPlanRaw.slice(0,8)),'planner stream not visible');live.push('planner before complete');await planning;await tick();
  const rawButton=[...document.querySelectorAll('[data-moyun-modal=new-book] button')].find(x=>x.textContent.trim()==='查看策划员原文');rawButton.click();await tick();assert(document.querySelector('[data-moyun-modal=team-raw] pre').textContent===s.teamPlanRaw,'planner raw modal missing');document.querySelector('[data-moyun-modal=team-raw] button').click();await tick();assert(s.teamPhase==='review'&&!s.teamRawView,'raw return lost classified plan');
  rawButton.click();await tick();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await tick();assert(!s.teamRawView&&s.showNewBook,'Escape closed the underlying plan instead of raw');
  const run=s.startTeamGeneration();await until(()=>s.teamBlocks.some(row=>row.raw&&row.status==='running'),'live specialist');await tick();
  const row=s.teamBlocks.find(row=>row.raw&&row.status==='running'),card=document.querySelector('[data-team-block="'+row.id+'"]');assert(card,'structured progress cards missing');card.querySelector('summary').click();await tick();assert(card.open&&row.status==='running'&&card.textContent.includes(row.raw),'expanded card missing live text');live.push(row.id+' before complete');holdLive=false;releaseLive();
  await run;await tick();assert(s.teamDraft&&s.teamBlocks.every(row=>row.status==='done'),'team did not finish');
  const settingsCard=document.querySelector('[data-team-block=settings]');if(!settingsCard.open)settingsCard.querySelector('summary').click();await tick();assert(settingsCard.open,'finished card cannot expand');settingsCard.querySelector('details').querySelector('summary').click();await tick();assert(settingsCard.querySelector('details').open,'nested content cannot expand');const raw=[...settingsCard.querySelectorAll('button')].find(x=>x.textContent==='查看原文');raw.click();await tick();assert(document.querySelector('[data-moyun-modal=team-raw] pre').textContent.includes('潮汐供能'),'specialist raw modal missing');document.querySelector('[data-moyun-modal=team-raw] button').click();
  mode='stop';s.openTeamBookMode();s.teamPlan=plan;s.teamBrief='林远寻找旧灯';const stopping=s.startTeamGeneration();await until(()=>s.teamBlocks.some(row=>row.raw),'partial output');s.stopTeamBook();held.splice(0).forEach(resolve=>resolve());await stopping;await tick();assert(s.teamPhase==='done'&&s.teamBlocks.some(row=>row.raw&&row.partial),'stop discarded partial raw');assert(s.teamDraft,'stop recovery draft missing');
  if(templateId==='gemini')assert(requests.every(row=>row.replyTool===enabled&&row.inputRewritten===enabled),'Gemini global switches not applied to every request');
  return {switches:enabled?'on':'off',protocol:templateId,model,requests,allStream:requests.every(row=>row.stream),live,checks:['planner raw modal/return','progress expand/live','finished nested expand/raw','stop preserve partial'],partial:s.teamBlocks.filter(row=>row.raw).map(row=>({id:row.id,length:row.raw.length,status:row.status}))};
 } finally {if(s.oneKeyPhase==='generating')s.stopTeamBook();releaseLive();held.splice(0).forEach(resolve=>resolve());window.fetch=originalFetch;s.connectionCenter=center;s.settings.geminiTestInput=originalGemini;s.settings.preventTruncation=originalTruncation;s.showNewBook=false;s.teamRawView='';}
}

async function runFeedbackCharacterGeometryChecks(dark=false) {
 const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState,results=[];
 s.showNewBook=false;s.showConfirm=false;s.showBranchPanel=false;s.modPacks=[];if(s.isDark!==dark)s.toggleTheme();
 for(const long of [false,true]){
  const character={id:long?'feedback-long':'feedback-blank',name:long?'长文本角色':'空白角色',profileLevel:'regular',desc:long?'超长无空格中文角色描述'.repeat(300):'',profile:{},relationships:[],stateLog:[]};
  s.structuredCharacters=[character];s.openCharacterWorkbench(character.id);await new Promise(r=>setTimeout(r,100));
  const editor=document.querySelector('.moyun-character-editor'),main=document.querySelector('.moyun-character-main');
  if(!editor||!main)throw Error('character workbench missing');
  const widths=[...editor.querySelectorAll('.moyun-character-section')].map(el=>Math.round(el.getBoundingClientRect().width)),ratio=Math.min(...widths)/main.clientWidth;
  if(!widths.length||ratio<0.8||document.documentElement.scrollWidth>innerWidth)throw Error('character geometry failure '+JSON.stringify({widths,ratio}));
  results.push({case:long?'long-unbroken':'blank',viewport:[innerWidth,innerHeight],theme:document.documentElement.dataset.theme,container:main.clientWidth,widths,ratio});
 }
 s.showCharacterWorkbench=false;return results;
}
