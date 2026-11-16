'use strict';
// 使用现有隔离浏览器和真实写作发送流程；拦截本地假 API，不消耗用户模型额度。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function(c){
 const out=path.join(__dirname,'../.ui-check/branch-context');fs.mkdirSync(out,{recursive:true});
 const results=[],requests=[];let completed=false;
 async function check(name,run){try{const data=await run();results.push({name,ok:true,data});console.log('PASS',name,JSON.stringify(data));}catch(e){results.push({name,ok:false,error:String(e)});throw e;}}
 async function shot(name){const r=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));}
 try{
  for(const width of [1280,360])for(const dark of [false,true]){
   const height=width===1280?800:740,label=width+'-'+(dark?'dark':'light');
   await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768});
   await c.ev(({dark})=>{const s=__s;if(s.isDark!==dark)s.toggleTheme();s.openWebUpdateAnnouncement(true);},{dark});await c.delay(650);
   await check(label+'公告显示、滚动和关闭入口',async()=>{
    const d=await c.ev(()=>{const m=document.querySelector('[data-moyun-modal="web-update-announcement"]')||document.querySelector('[aria-labelledby="moyun-web-update-title"]'),b=m?.querySelector('[data-web-update-ack]'),r=m?.getBoundingClientRect(),br=b?.getBoundingClientRect();return{title:__s.webUpdateAnnouncement.title,date:__s.webUpdateAnnouncement.publishedAt,text:m?.innerText,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,box:r?.toJSON(),button:br?.toJSON(),hit:!!b&&b.contains(document.elementFromPoint(br.x+br.width/2,br.y+br.height/2))};});
    await shot(label+'-announcement');assert.equal(d.title,'1116更新');assert.equal(d.date,'2026-11-16');assert.ok(d.text.includes('补摘要与保存保护'));assert.equal(d.overflow,false);assert.ok(d.box.left>=0&&d.box.right<=d.width+1);assert.ok(d.button.height>=44&&d.button.bottom<=d.height,JSON.stringify(d));assert.equal(d.hit,true);await c.ev(()=>__s.dismissWebUpdateAnnouncement());return{title:d.title,date:d.date,viewport:[d.width,d.height],buttonHeight:d.button.height,overflow:d.overflow};
   });
   const branches=await c.ev(async()=>{
    const s=__s,id='final-branch-context-'+Date.now();s.showSettings_modal=false;s.showNewBook=false;s.showOutlineInMain=false;s.showDetailedOutlineInMain=false;s.showOutlineRevisionModal=false;s.showBranchPanel=false;s.modPacks=[];
    s.books.push({id,title:'最终分支验收',novel:{title:'最终分支验收',outline:'',volumes:[]},chapters:Array.from({length:3},(_,i)=>({id:id+'-'+i,branchId:'main',title:'原章'+(i+1),content:'原正文'+i,summary:'原摘要'+i,versions:[]})),characters:[]});s.loadBook(id);
    window.__branchLabels={main:'主线哨兵'};
    window.__setBranchPlanning=label=>{const bid=s.activeBranchId;s.novel.outline=label+'总纲';s.novel.chapterCount=12;s.novel.volumes=[{id:'first-volume',number:1,title:label+'第一卷',startChapter:1,endChapter:2,summary:label+'前卷纲',handoffSummaries:{[bid]:{content:label+'交接',actualOutline:label+'实际卷纲'}}},{id:'current-volume',number:2,title:label+'第二卷',startChapter:3,endChapter:12,summary:label+'当前卷纲',writingRequirement:label+'写作约束',handoffSummaries:{}}];s.chapterOutlines=Array.from({length:12},(_,i)=>({id:bid+'-outline-'+i,chapterNo:i+1,title:label+'标题'+(i+1),content:label+'细纲'+(i+1)}));s.visibleChapters.forEach((ch,i)=>{ch.content=label+'正文'+(i+1);ch.summary=label+'摘要'+(i+1);});s.summaries=s.summaries.filter(row=>row.branchId!==bid).concat({id:bid+'-long',branchId:bid,startChapter:1,endChapter:2,useForContext:true,content:label+'长期总结'});s.saveData();};
    __setBranchPlanning('主线哨兵');await s.forkBranch(2);if(s.activeBranchId==='main')throw Error('未创建支线');const parent=s.activeBranchId;__branchLabels[parent]='支线哨兵';__setBranchPlanning('支线哨兵');await s.forkBranch(2);if(s.activeBranchId===parent)throw Error('未创建孙支线');const child=s.activeBranchId;__branchLabels[child]='孙线哨兵';__setBranchPlanning('孙线哨兵');
    const made=s.createConnectionProfile({name:'分支上下文离线测试',templateId:'openai-compatible',baseUrl:'https://branch-context.invalid/v1',defaultModel:'gemini-branch-check',apiKey:'test-only',lastTest:{status:'ok'}});if(!made.ok)throw Error(made.reason);s.connectionCenter.defaultProfileId=made.profile.id;
    s.settings.streamEnabled=true;s.settings.secondRoundSupplementEnabled=false;s.settings.thirdRoundSupplementEnabled=false;s.settings.autoTimelineSupplement=false;s.settings.commentInline=false;s.settings.enableReviewer=false;s.settings.enableThinking=false;s.nsfwSettings.enabled=false;s.memoryLibrary.settings.enabled=false;s.settings.contextHistoryCharLimit=15000;s.settings.contextFullChapters=10;s.wordCountTarget=600;s.generateCount=1;s.priorityEnabled=false;
    window.__branchCalls=[];window.__originalBranchFetch=window.fetch.bind(window);window.fetch=async(input,init={})=>{const url=String(input?.url||input);if(!url.startsWith('https://branch-context.invalid/'))throw Error('验收阻止外发请求：'+url);const body=JSON.parse(init.body);__branchCalls.push({url,body});const text='岸边来信\n\n'+'雨水沿着河岸流向码头，守夜人收好信件，逐一核对船上的物资与来客名单。'.repeat(22)+'\n---剧情摘要---\n'+'守夜人完成物资核对并保管信件，等待下一班船抵达，期间没有发生新的关键事件。'.repeat(2);
     const args=JSON.stringify({content:text});if(!body.stream)return new Response(JSON.stringify({choices:[{message:body.tools?{role:'assistant',tool_calls:[{id:'reply',type:'function',function:{name:'output_reply',arguments:args}}]}:{role:'assistant',content:text},finish_reason:body.tools?'tool_calls':'stop'}]}),{headers:{'content-type':'application/json'}});
     const chunks=body.tools?[{tool_calls:[{index:0,id:'reply',type:'function',function:{name:'output_reply',arguments:args}}]}]:[{content:text.slice(0,30)},{content:text.slice(30)}];return new Response(chunks.map((delta,i)=>'data: '+JSON.stringify({choices:[{delta,finish_reason:i===chunks.length-1?(body.tools?'tool_calls':'stop'):null}]})+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
    };return {bookId:id,parent,child,labels:__branchLabels};
   });
   for(const [bid,branchLabel]of Object.entries(branches.labels))for(const enabled of [false,true]){
    await check(label+' '+branchLabel+' Gemini双开关'+enabled+' 实际写作请求',async()=>{
     const d=await c.ev(async({bid,enabled})=>{const s=__s;s.switchBranch(bid);await Vue.nextTick();s.settings.geminiTestInput=enabled;s.settings.preventTruncation=enabled;const before=__branchCalls.length,count=s.visibleChapters.length;s.nextChapterPrompt='只写本章的河岸日常';await s.startGeneration({count:1});for(let i=0;i<150&&s.isGenerating;i++)await new Promise(r=>setTimeout(r,40));if(s.isGenerating)throw Error('生成未结束');return{active:s.activeBranchId,outline:s.novel.outline,volumes:s.novel.volumes.map(v=>v.summary),details:s.chapterOutlines.map(v=>v.content),chapterCount:s.visibleChapters.length,beforeChapterCount:count,calls:__branchCalls.slice(before),toast:s.toast?.message};},{bid,enabled});
     assert.equal(d.active,bid);assert.equal(d.outline,branchLabel+'总纲');assert.equal(d.calls.length,1,JSON.stringify({calls:d.calls.length,toast:d.toast}));assert.equal(d.chapterCount,d.beforeChapterCount+1,'未生成正文：'+d.toast);
     const body=d.calls[0].body,text=JSON.stringify(body);for(const key of ['总纲','当前卷纲','细纲'])assert.ok(text.includes(branchLabel+key),branchLabel+key);for(const other of Object.values(branches.labels).filter(x=>x!==branchLabel))assert.ok(!text.includes(other),'请求混入 '+other);assert.equal(!!body.tools,enabled);
     requests.push({viewport:[width,height],dark,enabled,bid,branchLabel,body});return{branch:branchLabel,model:body.model,messages:body.messages.length,bodyChars:text.length,chapterNo:d.chapterCount,otherBranchSentinels:0,tools:!!body.tools};
    });
   }
   await c.ev(async()=>{__s.toggleBranchPanel(null,'正文');__s.branchPanelView='map';await Vue.nextTick();});await c.delay(250);
   await check(label+'三层路线图在独立图框内滚动',async()=>{
    const d=await c.ev(()=>{const m=document.querySelector('[data-branch-map]'),route=__s.branchRouteMap;return{positions:route.positions,edges:route.edges,nodes:m?.querySelectorAll('[data-branch-node]').length,scrollHeight:m?.scrollHeight,clientHeight:m?.clientHeight,overflow:document.documentElement.scrollWidth>innerWidth+1};});
    assert.equal(d.nodes,3);assert.equal(d.positions.main.y,0);assert.equal(d.positions[branches.parent].y,1);assert.equal(d.positions[branches.child].y,2);assert.deepEqual(d.edges,[{from:'main',to:branches.parent},{from:branches.parent,to:branches.child}]);assert.ok(d.scrollHeight>d.clientHeight);assert.equal(d.overflow,false);await shot(label+'-branch-tree');return d;
   });
   await c.ev(()=>{__s.showBranchPanel=false;__s.saveData();});await c.delay(2300);await c.navigate();
   await check(label+' IndexedDB刷新后按三条线恢复',async()=>{
    const d=await c.ev(async({branches})=>{const s=__s,rows=[];for(const [bid,label]of Object.entries(branches.labels)){s.switchBranch(bid);await Vue.nextTick();rows.push({bid,label,outline:s.novel.outline,volume:s.novel.volumes[1].summary,detail:s.chapterOutlines[3].content,chapters:s.visibleChapters.length});}return{bookId:s.currentBookId,rows};},{branches});assert.equal(d.bookId,branches.bookId);for(const row of d.rows){assert.equal(row.outline,row.label+'总纲');assert.equal(row.volume,row.label+'当前卷纲');assert.equal(row.detail,row.label+'细纲4');assert.equal(row.chapters,5);}return d;
   });
  }
  assert.deepEqual(c.errors,[]);completed=true;
 }finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:completed,results,errors:c.errors},null,2));fs.writeFileSync(path.join(out,'requests.json'),JSON.stringify(requests,null,2));}
};
