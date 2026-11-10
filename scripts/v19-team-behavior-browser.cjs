'use strict';
// Self-contained functions for evaluation inside the existing managed test tab.
async function runTeamBehaviorBrowserChecks() {
  const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState;
  const originalFetch=window.fetch,originalCenter=JSON.parse(JSON.stringify(s.connectionCenter)),originalMods=s.modPacks,originalBatch=s.settings.detailedOutlineBatchSize,originalSkip=s.teamSkipPlanConfirm;
  const results=[],requests=[],held=[],clone=value=>JSON.parse(JSON.stringify(value));
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const tick=()=>new Promise(resolve=>setTimeout(resolve,30));
  const until=async(fn,label)=>{for(let i=0;i<500;i++){if(fn())return;await tick();}throw Error('Team browser timeout: '+label);};
  const button=(root,label)=>Array.from(root.querySelectorAll('button')).find(el=>el.textContent.trim()===label);
  const click=label=>{const el=button(document,label);assert(el&&!el.disabled,'Missing enabled button: '+label);el.click();};
  const fact='主角林远与周宁在雾港寻找旧灯，共3章，保持未完。';
  const plan={titleCandidates:['雾港回声团队验收'],genre:'悬疑',tone:'克制',userFacts:[{text:fact,source:'用户'}],characters:[{name:'林远',summary:'寻灯人'},{name:'周宁',summary:'守港人'}],volumes:[{number:1,title:'雾港',startChapter:1,endChapter:3,summary:'寻找旧灯',writingRequirement:'逐章调查',bridge:'大门后的线索'}],chapterCount:3,unfinishedMode:true,uncertainties:[],tasks:{settings:'设定',characters:'角色',outline:'大纲'}};
  const setting={title:plan.titleCandidates[0],synopsis:'林远与周宁追查旧灯。',worldView:'雾港的灯由潮汐驱动。',negativePrompt:'禁止提前收束'};
  const characters={characters:[{name:'周宁',desc:'周宁独有的守港人经历',personalityTags:['沉稳'],speakingStyle:'短句'},{name:'林远',desc:'林远独有的寻灯人经历',personalityTags:['执着'],speakingStyle:'直率'}]};
  const outline={outline:'林远与周宁找到旧灯，大门后的线索尚未揭开。',volumes:plan.volumes,chapterIndexDrafts:[1,2,3].map(chapterNo=>({chapterNo,title:'灯影'+chapterNo,goal:'调查线索'+chapterNo}))};
  const review={status:'ok',facts:[{text:fact,fulfilled:true,reason:'已进入设定和细纲'}],issues:[]};
  const chapter=(no,text)=>'## 第'+no+'章 灯影'+no+'\n'+text+'\n【无问题】';
  let mode='initial',detailCount=0;
  window.fetch=async(input,init={})=>{
    const url=new URL(String(input),location.href);
    if(url.hostname!=='mock-v19-team.invalid')return originalFetch.call(window,input,init);
    const body=JSON.parse(init.body),prompt=body.messages.map(row=>typeof row.content==='string'?row.content:JSON.stringify(row.content)).join('\n');
    const row={mode,path:url.pathname,body:clone(body),response:''};requests.push(row);
    if(mode==='late-planner'||mode==='late-generation')await new Promise(resolve=>held.push(resolve));
    let value;
    if(prompt.includes('你是策划员'))value=plan;
    else if(prompt.includes('你是审查员'))value=review;
    else if(body.model==='team-character')value=mode==='initial'?{characters:[]}:characters;
    else if(prompt.includes('你是设定员'))value=setting;
    else if(prompt.includes('你是大纲卷纲员'))value=outline;
    else if(prompt.includes('你是细纲员')){detailCount++;value=detailCount===1?chapter(1,'第一章不可覆盖哨兵'):chapter(1,'错误覆盖第一章')+'\n'+chapter(2,'第二章补齐')+'\n'+chapter(3,'第三章补齐')+'\n'+chapter(9,'范围外忽略');}
    else throw Error('Unexpected team mock request: '+prompt.slice(0,100));
    row.response=typeof value==='string'?value:JSON.stringify(value);
    return new Response(JSON.stringify({choices:[{message:{content:row.response},finish_reason:'stop'}]}),{headers:{'content-type':'application/json'}});
  };
  try {
    s.syncBookData();const origin='v19-team-browser-origin';
    if(!s.books.some(book=>book.id===origin))s.books.push({id:origin,title:'团队验收原书',novel:{title:'团队验收原书',outline:'原书大纲哨兵',worldView:'原书世界观哨兵'},chapters:[],characters:[]});
    s.loadBook(origin);s.showSettings_modal=false;s.showOutlineInMain=false;s.showDetailedOutlineInMain=false;s.mobileSidebarOpen=false;s.settings.sidebarCollapsed=true;s.bookshelfView='book';s.modPacks=[];
    s.connectionCenter={version:1,profiles:[],defaultProfileId:'',moduleRoutes:{}};
    for(const key of ['settings','character','outline']){const made=s.createConnectionProfile({name:'团队假AI '+key,templateId:'openai-compatible',baseUrl:'https://mock-v19-team.invalid/v1',defaultModel:'team-'+key,apiKey:'test-only',lastTest:{status:'ok'}});assert(made.ok,'Mock profile creation failed');s.connectionCenter.moduleRoutes[key]={profileId:made.profile.id};if(!s.connectionCenter.defaultProfileId)s.connectionCenter.defaultProfileId=made.profile.id;}
    const beforeCount=s.books.length;
    s.openTeamBookMode();s.teamSkipPlanConfirm=false;s.teamPlanOptions.unfinishedMode=true;s.teamPlanOptions.chapterCount=3;s.settings.detailedOutlineBatchSize=3;
    await until(()=>document.querySelector('[data-team-book-brief]'),'team input');
    const input=document.querySelector('[data-team-book-brief]');input.value=fact;input.dispatchEvent(new Event('input',{bubbles:true}));await tick();click('发送');
    await until(()=>s.teamPhase==='review','planner review');
    assert(s.books.length===beforeCount&&s.novel.outline==='原书大纲哨兵','Planner modified the library');
    assert(s.teamPlan.volumes.length===1&&s.teamPlan.volumes[0].endChapter===3,'Planner did not preserve unfinished range');
    results.push({name:'DOM send, planner, review before writing',ok:true});
    click('接受并开写');await until(()=>s.teamPhase==='done'&&s.teamDraft,'specialists done');
    assert(s.books.length===beforeCount&&s.currentBookId===origin,'Generation wrote a half-finished book');
    assert(s.teamBlocks.find(row=>row.id==='characters').status==='error','Empty characters must fail');
    assert(s.teamDraft.chapterOutlines.length===3,'Missing chapter retry did not finish 1–3');
    assert(s.teamDraft.chapterOutlines[0].content.includes('第一章不可覆盖哨兵')&&!s.teamDraft.chapterOutlines[0].content.includes('错误覆盖'),'Completed chapter was overwritten');
    assert(!s.teamDraft.chapterOutlines.some(row=>row.chapterNo===9),'Out-of-range chapter entered draft');
    const detailRequests=requests.filter(row=>row.body.messages.some(message=>String(message.content).includes('你是细纲员')));
    assert(detailRequests.length===2&&JSON.stringify(detailRequests[1].body).includes('缺少第2、3章'),'Second detail request must ask only for missing chapters');
    await until(()=>document.querySelector('[data-team-book-failed-blocks]'),'failed block controls');
    click('原文');await tick();assert(s.teamRawView.includes('characters'),'Failed block raw response is unavailable');
    const preserved=clone(s.teamBlocks.filter(row=>row.id!=='characters').map(row=>({id:row.id,result:row.result}))),retryStart=requests.length;mode='retry';
    button(document.querySelector('[data-team-book-failed-blocks]'),'重试').click();
    await until(()=>s.teamBlocks.every(row=>row.status==='done')&&s.teamDraft.characters.length===2&&requests.length>=retryStart+2,'single block retry and review');await tick();
    assert(JSON.stringify(preserved)===JSON.stringify(s.teamBlocks.filter(row=>row.id!=='characters').map(row=>({id:row.id,result:row.result}))),'Single block retry modified good blocks');
    assert(requests.slice(retryStart).map(row=>row.body.model).join(',')==='team-character,team-settings','Retry must request only character plus reviewer');
    assert(s.teamDraft.characters.find(row=>row.name==='周宁').desc==='周宁独有的守港人经历'&&s.teamDraft.characters.find(row=>row.name==='林远').desc==='林远独有的寻灯人经历','Character order confused biographies');
    assert(s.teamReview.status==='ok'&&s.teamReview.facts[0].fulfilled===true,'Reviewer did not report user fact');
    results.push({name:'empty role error, raw response, missing-only detail retry, good chapter retention, single role retry and rereview',ok:true});
    click('接受并写入');await until(()=>s.books.length===beforeCount+1&&s.currentBookId!==origin,'one-time commit');
    const createdId=s.currentBookId;assert(s.chapterOutlines.length===3&&s.structuredCharacters.length===2,'Commit lost specialist data');
    s.showNewBook=false;s.detailedOutlineViewMode='all';s.openDetailedOutlineWorkbench();await tick();
    assert(s.showDetailedOutlineInMain&&!s.showOutlineInMain,'Detailed-outline workbench did not open');
    await until(()=>document.querySelector('[data-story-target=detail-outline] .moyun-do-card-head'),'committed detail card');
    const detailCard=document.querySelector('[data-story-target=detail-outline]');
    if(!s.chapterOutlines[0].isExpanded)detailCard.querySelector('.moyun-do-card-head').click();await tick();
    assert(detailCard.querySelector('textarea[data-story-field=content]')?.value.includes('第一章不可覆盖哨兵'),'Committed detailed outline card cannot expand');
    s.saveData();await new Promise(resolve=>setTimeout(resolve,2300));
    results.push({name:'single book commit, 3 chapter outlines, 2 correct characters and opened detail workbench',ok:true});
    mode='late-planner';s.openTeamBookMode();s.teamSkipPlanConfirm=false;s.teamBrief=fact;
    const planning=s.splitTeamPlan(fact);await until(()=>held.length===1,'held planner');s.backToManualBook();held.splice(0).forEach(resolve=>resolve());await planning;
    assert(s.teamPlan===null&&s.newBookMode==='manual'&&s.books.length===beforeCount+1,'Late cancelled planner wrote a plan or book');
    mode='late-generation';s.openTeamBookMode();s.teamPlan=clone(plan);s.teamBrief=fact;s.teamPlanOptions.unfinishedMode=true;s.teamPlanOptions.chapterCount=3;
    const generating=s.startTeamGeneration();await until(()=>held.length===3,'held specialists');s.stopTeamBook();held.splice(0).forEach(resolve=>resolve());await generating;
    assert(s.teamDraft===null&&s.teamBlocks.every(row=>row.status==='stopped')&&s.books.length===beforeCount+1,'Late cancelled specialists wrote a draft or book');
    results.push({name:'late planner and specialist responses cannot repopulate cancelled work',ok:true});
    s.showNewBook=false;s.openDetailedOutlineWorkbench();
    return {passed:true,results,bookId:createdId,originId:origin,libraryBefore:beforeCount,libraryAfter:s.books.length,viewport:{width:innerWidth,height:innerHeight},requests};
  } finally {
    held.splice(0).forEach(resolve=>resolve());window.fetch=originalFetch;s.connectionCenter=originalCenter;s.modPacks=originalMods;s.settings.detailedOutlineBatchSize=originalBatch;s.teamSkipPlanConfirm=originalSkip;
  }
}
module.exports={runTeamBehaviorBrowserChecks};
