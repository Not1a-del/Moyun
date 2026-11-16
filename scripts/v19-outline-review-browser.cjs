'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),port=4191,cdp=9251;
const option=name=>{const index=process.argv.indexOf(name);return index<0?'':process.argv[index+1]||'';};
const base=option('--url')||'http://127.0.0.1:'+port+'/index.html';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
  const server=http.createServer((req,res)=>{const pathname=new URL(req.url,base).pathname;const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'content-type':({'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});res.end(error?'':data);});});
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'moyun-v19-outline-'));
  const edgePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(file=>fs.existsSync(file));
  if(!edgePath)throw Error('未找到本机 Edge');
  const edge=spawn(edgePath,['--headless=new','--remote-debugging-port='+cdp,'--user-data-dir='+profile,'--no-first-run','--no-default-browser-check',...(option('--proxy')?['--proxy-server='+option('--proxy')]:[]),'about:blank'],{stdio:'ignore',windowsHide:true});
  let c;
  try{
    for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:'+cdp+'/json/version')).ok)break;}catch{}await wait(100);}
    c=await require('./v16-r2-browser-session.cjs').connect(cdp,base);
    await c.navigate();
    await c.ev(()=>{window.__s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState;});
    if(process.argv.includes('--release-smoke')){await require('./v19-release-smoke.cjs')(c);return;}
    if(process.argv.includes('--mobile-layout')){await require('./v19-mobile-layout-browser.cjs')(c);return;}
    if(process.argv.includes('--planning-recovery')){await require('./v19-planning-recovery-browser.cjs')(c);return;}
    if(process.argv.includes('--manual-planning')){await require('./v19-manual-planning-browser.cjs')(c);return;}
    if(process.argv.includes('--volume-classification')){await require('./v19-volume-classification-browser.cjs')(c);return;}
    if(process.argv.includes('--branch-context')){await require('./v19-branch-context-browser.cjs')(c);return;}
    if(process.argv.includes('--settings-search')){await require('./v19-settings-search-browser.cjs')(c);return;}
    const seed=await c.ev(()=>{const s=__s,id='v19-outline-browser';if(!s.books.some(book=>book.id===id))s.books.push({id,novel:{title:'卷纲审阅验收',outline:'总纲',volumes:[{id:'v1',title:'旧卷',startChapter:1,endChapter:2,summary:'旧计划'}]},chapters:[],characters:[]});s.loadBook(id);s.chapterOutlines=Array.from({length:10},(_,i)=>({id:'o'+i,chapterNo:i+1,title:'第'+(i+1)+'章',content:'细纲'+(i+1)}));s.novel.volumes=[{id:'v1',title:'旧卷',startChapter:1,endChapter:10,summary:'旧计划'}];return true;});
    const results=[];
    for(const mode of [{width:1280,height:800,name:'light'},{width:360,height:740,name:'mobile'}]){
      await c.send('Emulation.setDeviceMetricsOverride',{width:mode.width,height:mode.height,deviceScaleFactor:1,mobile:mode.width<768});
      for(const dark of [false,true]){
        await c.ev(({dark})=>{const s=__s;if(s.isDark!==dark)s.toggleTheme();s.showOutlineInMain=true;s.showDetailedOutlineInMain=false;s.outlineReview={id:'review-'+dark,source:'卷纲整理',selectedId:'',revisions:[{id:'d',type:-1,text:'旧卷',status:'pending',selected:true,groupId:'volume-plan'},{id:'i',type:1,text:'新卷',status:'pending',selected:true,groupId:'volume-plan'}],workbenchVolumes:{rows:Array.from({length:10},(_,i)=>({id:'v'+i,number:i+1,title:'第'+(i+1)+'卷',startChapter:i+1,endChapter:i+1,summary:'卷纲候选内容'.repeat(10),writingRequirement:'本卷写作要求',bridge:'卷末衔接'})),baseline:JSON.stringify(s.novel.volumes),chapterOutlinesBaseline:JSON.stringify(s.chapterOutlines)}};s.showOutlineRevisionModal=true;return true;},{dark});
        await c.delay(650);
        const data=await c.ev(({dark})=>{const modal=document.querySelector('[data-moyun-modal=outline-revision]'),panel=modal?.querySelector('[data-moyun-modal-panel]'),body=modal?.querySelector('.moyun-outline-review-body'),r=panel?.getBoundingClientRect(),cs=panel&&getComputedStyle(panel);return{dark,viewport:{width:innerWidth,height:innerHeight},modal:{width:modal?.getBoundingClientRect().width,height:modal?.getBoundingClientRect().height},panel:{left:r?.left,right:r?.right,top:r?.top,bottom:r?.bottom,width:r?.width,height:r?.height,maxHeight:cs?.maxHeight,display:cs?.display,transform:cs?.transform},body:{scrollHeight:body?.scrollHeight,clientHeight:body?.clientHeight},styles:[...document.styleSheets].map(sheet=>sheet.href),ruleFound:[...document.styleSheets].flatMap(sheet=>{try{return [...sheet.cssRules].filter(rule=>rule.selectorText?.includes('moyun-outline-review-panel')).map(rule=>rule.cssText);}catch{return[];}}),overflow:document.documentElement.scrollWidth>innerWidth+1||modal?.scrollWidth>modal?.clientWidth+1,text:modal?.innerText.includes('卷纲重新划分候选')};},{dark});
        if(!data.text||data.overflow||data.panel.left<0||data.panel.right>data.viewport.width+1||data.panel.bottom>data.viewport.height+1)throw Error(mode.name+' '+(dark?'dark':'light')+' 弹窗布局不合格：'+JSON.stringify(data));
        if(data.body.scrollHeight<=data.body.clientHeight)throw Error(mode.name+' 审阅内容未形成独立滚动区：'+JSON.stringify(data));
        results.push({...mode,...data});
        await c.ev(({dark})=>{const s=__s;s.showOutlineRevisionModal=false;s.showOutlineInMain=true;s.showDetailedOutlineInMain=false;s.isGeneratingOutline=true;s.outlineStreamPreview='stream-check-text'.repeat(12);s.outlineStreamDockCollapsed=false;return true;},{dark});
        await c.delay(220);
        const stream=await c.ev(()=>{const dock=document.querySelector('[data-moyun-workbench="outline"] [data-moyun-outline-stream]'),body=dock?.querySelector('.moyun-outline-stream-dock-body'),operation=dock?.closest('[data-moyun-workbench="outline"]')?.querySelector('.moyun-wb-operation'),workbench=dock?.closest('[data-moyun-workbench="outline"]'),dr=dock?.getBoundingClientRect(),or=operation?.getBoundingClientRect(),wr=workbench?.getBoundingClientRect();return{exists:!!dock,top:dr?.top,bottom:dr?.bottom,workbenchTop:wr?.top,operationTop:or?.top,bodyText:body?.textContent||'',bodyVisible:!!body,workbenchWidth:wr?.width,docOverflow:document.documentElement.scrollWidth>innerWidth+1};});
        if(!stream.exists||stream.top<=stream.workbenchTop+40||stream.bottom>stream.operationTop+2||!stream.bodyVisible||!stream.bodyText||stream.docOverflow)throw Error(mode.name+' stream dock geometry invalid: '+JSON.stringify(stream));
        await c.ev(()=>{const dock=document.querySelector('[data-moyun-workbench="outline"] [data-moyun-outline-stream]');dock?.querySelector('button')?.click();return true;});
        await c.delay(120);
        const collapsedData=await c.ev(()=>{const dock=document.querySelector('[data-moyun-workbench="outline"] [data-moyun-outline-stream]');const body=dock?.querySelector('.moyun-outline-stream-dock-body');const wb=document.querySelector('[data-moyun-workbench="outline"]');return{collapsed:dock?.classList.contains('is-collapsed'),body:!!body,workbenchVisible:!!wb&&getComputedStyle(wb).display!=='none',overflow:document.documentElement.scrollWidth>innerWidth+1};});
        if(!collapsedData.collapsed||collapsedData.body||!collapsedData.workbenchVisible||collapsedData.overflow)throw Error(mode.name+' collapsed stream dock invalid: '+JSON.stringify(collapsedData));
        await c.ev(()=>{__s.isGeneratingOutline=false;__s.outlineStreamPreview='';__s.outlineStreamDockCollapsed=false;return true;});
      }
    }
    await c.ev(()=>{__s.rejectAllRevisions();return true;});
    await c.delay(700);
    const after=await c.ev(()=>({modal:!!document.querySelector('[data-moyun-modal=outline-revision]'),volume:__s.novel.volumes[0].title}));
    if(after.modal||after.volume!=='旧卷')throw Error('拒绝候选后原卷纲未保持不变：'+JSON.stringify(after));
    await c.ev(()=>{
      __s.showOutlineInMain=true;__s.showDetailedOutlineInMain=false;__s.outlineReview={id:'outline-with-volume-plan',source:'故事大纲',selectedId:'',beforeText:'旧大纲',afterText:'新大纲',revisions:[{id:'old-outline',type:-1,text:'旧大纲',status:'pending',selected:true,groupId:'outline-change'},{id:'new-outline',type:1,text:'新大纲',status:'pending',selected:true,groupId:'outline-change'}],volumePlan:{rows:[{number:1,title:'第一卷',startChapter:1,endChapter:5,summary:'候选卷纲'}],total:5},volumeBaseline:[{id:'v1',title:'旧卷',startChapter:1,endChapter:5,summary:'旧卷纲'}]};
      __s.showOutlineRevisionModal=true;
      return true;
    });
    await c.delay(350);
    const outlinePlan=await c.ev(()=>{const modal=document.querySelector('[data-moyun-modal=outline-revision]');return{visible:!!modal,text:modal?.innerText||'',compare:!!modal?.querySelector('[data-moyun-review-compare]')};});
    if(!outlinePlan.visible||!outlinePlan.compare||!outlinePlan.text.includes('AI 候选卷纲'))throw Error('普通大纲修改未显示卷纲左右候选：'+JSON.stringify(outlinePlan));
    await c.ev(()=>{
      __s.novel.volumes=[{id:'v1',title:'旧卷',startChapter:1,endChapter:10,summary:'旧计划'}];
      __s.outlineReview={id:'normal-volume-accept',source:'故事大纲',selectedId:'',revisions:[],volumePlan:{rows:[{number:1,title:'接受后的卷',startChapter:1,endChapter:10,summary:'新计划'}],total:10},volumeBaseline:JSON.parse(JSON.stringify(__s.novel.volumes)),volumeChapterOutlinesBaseline:JSON.stringify(__s.chapterOutlines)};
      __s.showOutlineRevisionModal=true;return true;
    });
    await c.delay(250);
    await c.ev(()=>{document.querySelector('[data-outline-volume-accept]')?.click();return true;});
    await c.delay(450);
    const accepted=await c.ev(()=>({modal:!!document.querySelector('[data-moyun-modal=outline-revision]'),title:__s.novel.volumes[0]?.title}));
    if(accepted.modal||accepted.title!=='接受后的卷')throw Error('卷纲候选接受事件未写入：'+JSON.stringify(accepted));
    await c.ev(()=>{
      __s.outlineReview={id:'workbench-volume-accept',source:'卷纲整理',selectedId:'',revisions:[{id:'old',type:-1,text:'旧卷',status:'pending',selected:true,groupId:'volume-plan'},{id:'new',type:1,text:'新卷',status:'pending',selected:true,groupId:'volume-plan'}],workbenchVolumes:{rows:[{id:'v1',number:1,title:'工作台接受后的卷',startChapter:1,endChapter:10,summary:'工作台新计划'}],baseline:JSON.stringify(__s.novel.volumes),chapterOutlinesBaseline:JSON.stringify(__s.chapterOutlines)}};
      __s.showOutlineRevisionModal=true;return true;
    });
    await c.delay(250);
    await c.ev(()=>{document.querySelector('[data-outline-volume-accept]')?.click();return true;});
    await c.delay(120);
    await c.ev(()=>{const modal=document.querySelector('[data-moyun-modal=confirm]');if(modal)[...modal.querySelectorAll('button')].find(button=>button.textContent.includes('确认并应用'))?.click();return true;});
    await c.delay(450);
    const workbenchAccepted=await c.ev(()=>({modal:!!document.querySelector('[data-moyun-modal=outline-revision]'),title:__s.novel.volumes[0]?.title}));
    if(workbenchAccepted.modal||workbenchAccepted.title!=='工作台接受后的卷')throw Error('工作台卷纲接受事件未写入：'+JSON.stringify(workbenchAccepted));
    await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
    await c.ev(()=>{
      const s=__s, originalFetch=window.fetch.bind(window);
      window.__outlineFlowRequests=[];
      window.fetch=async(input,init={})=>{
        const url=String(input);
        if(!url.includes('outline-flow.invalid'))return originalFetch(input,init);
        const body=JSON.parse(init.body||'{}'), planner=JSON.stringify(body).includes('卷纲整理编辑');
        window.__outlineFlowRequests.push({url,body,planner});
        const output=planner?JSON.stringify({volumes:[{number:1,title:'港口',startChapter:1,endChapter:2,summary:'靠港与相遇'},{number:2,title:'旧信',startChapter:3,endChapter:4,summary:'找到旧信'},{number:3,title:'离岸',startChapter:5,endChapter:6,summary:'离开港口'}]}):'修改后的大纲哨兵：主角在港口找到一封旧信，随后追查信件中的日期与收件人，逐步发现港口旧案与自己的家族有关。'.repeat(8);
        // 用分块 SSE 覆盖非 Gemini 服务商的真实流式输入，并让 UI 有时间呈现正在到达的文字。
        const events=output.match(/.{1,32}/gu)||[output],encode=text=>new TextEncoder().encode(text);
        const upstream=new ReadableStream({start(controller){(async()=>{for(const part of events){controller.enqueue(encode('data: '+JSON.stringify({choices:[{delta:{content:part},finish_reason:null}]})+'\n\n'));await new Promise(resolve=>setTimeout(resolve,100));}controller.enqueue(encode('data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\n'));controller.enqueue(encode('data: [DONE]\n\n'));controller.close();})().catch(error=>controller.error(error));}});
        return new Response(upstream,{status:200,headers:{'content-type':'text/event-stream'}});
      };
      s.books.push({id:'v19-outline-flow',novel:{title:'大纲流式验收',outline:'旧大纲哨兵',volumes:[{id:'old-volume',title:'旧卷',startChapter:1,endChapter:6,summary:'旧卷纲哨兵'}]},chapters:[],chapterOutlines:[],characters:[]});
      s.loadBook('v19-outline-flow');s.novel.outline='旧大纲哨兵';s.novel.chapterCount=6;s.novel.volumes=[{id:'old-volume',title:'旧卷',startChapter:1,endChapter:6,summary:'旧卷纲哨兵'}];
      s.chapterOutlines=Array.from({length:6},(_,i)=>({id:'flow-o'+i,chapterNo:i+1,title:'第'+(i+1)+'章',content:'第'+(i+1)+'章的细纲事实'}));
      s.connectionCenter={version:1,profiles:[{id:'outline-flow-profile',name:'验收模拟',templateId:'custom',adapterId:'openai-compatible',baseUrl:'https://outline-flow.invalid/v1',defaultModel:'flow-model',enabled:true,lastTest:{status:'ok'},modelCatalog:[]}],defaultProfileId:'outline-flow-profile',moduleRoutes:{}};
      s.setConnectionCredential('outline-flow-profile','test-only');s.settings.streamEnabled=true;s.settings.outlineRequestMode='stream';s.isDark=false;
      s.showOutlineInMain=true;s.showDetailedOutlineInMain=false;s.outlineInput='让主角在港口发现一封旧信';s.showOutlineRevisionModal=false;
      return true;
    });
    await c.delay(250);
    await c.ev(()=>document.querySelector('[data-moyun-outline-ai]')?.click());
    let live=null;
    for(let i=0;i<40;i++){live=await c.ev(()=>{const dock=document.querySelector('[data-moyun-workbench="outline"] [data-moyun-outline-stream]'),rect=dock?.getBoundingClientRect(),footer=dock?.closest('[data-moyun-workbench="outline"]')?.querySelector('.moyun-wb-operation')?.getBoundingClientRect();return{visible:!!dock,text:dock?.querySelector('pre')?.textContent||'',top:rect?.top,bottom:rect?.bottom,footerTop:footer?.top,modal:!!document.querySelector('[data-moyun-modal="outline-revision"]'),width:innerWidth};});if(live.visible&&live.text)break;await c.delay(80);}
    if(!live?.visible||!live.text||live.bottom>live.footerTop+1)throw Error('普通大纲流式内容未在底部工作台可读区域显示：'+JSON.stringify({...live,state:await c.ev(()=>({generating:__s.isGeneratingOutline,input:__s.outlineInput,reason:__s.getOutlineAiDisabledReason?.(),requests:__outlineFlowRequests.length,modal:__s.showOutlineRevisionModal,show:__s.showOutlineInMain,toast:__s.toast,errors:window.__consoleErrors||[]}))}));
    for(let i=0;i<80;i++){if(await c.ev(()=>!!document.querySelector('[data-moyun-modal="outline-revision"]')))break;await c.delay(100);}
    const normalFlow=await c.ev(()=>{const modal=document.querySelector('[data-moyun-modal="outline-revision"]'),compare=modal?.querySelector('[data-moyun-review-compare]');return{modal:!!modal,text:modal?.innerText||'',compare:compare?.innerText||'',candidate:!!modal?.querySelector('[data-outline-volume-accept]'),outline:__s.novel.outline,requestCount:__outlineFlowRequests.length,generating:__s.isGeneratingOutline,toast:__s.toast,review:__s.outlineReview,lastRequest:__s.outlineLastRequest,request:__outlineFlowRequests[0]};});
    if(!normalFlow.modal||!normalFlow.compare.includes('旧大纲哨兵')||!normalFlow.compare.includes('修改后的大纲哨兵')||!normalFlow.candidate||normalFlow.outline!=='旧大纲哨兵')throw Error('普通大纲没有生成独立左右审阅，或生成前覆盖了原内容：'+JSON.stringify(normalFlow));
    await c.ev(()=>{[...document.querySelectorAll('[data-moyun-review-panel] button')].find(button=>button.textContent.includes('全部接受'))?.click();return true;});await c.delay(120);
    await c.ev(()=>{const modal=document.querySelector('[data-moyun-modal="confirm"]');if(modal)[...modal.querySelectorAll('button')].find(button=>button.textContent.includes('确认并应用'))?.click();return true;});await c.delay(220);
    const secondStage=await c.ev(()=>{const modal=document.querySelector('[data-moyun-modal="outline-revision"]');return{modal:!!modal,title:modal?.querySelector('#moyun-outline-review-title')?.textContent||'',stage:!!modal?.querySelector('[data-outline-volume-stage]'),compare:!!modal?.querySelector('[data-moyun-volume-compare]'),candidate:!!modal?.querySelector('[data-outline-volume-accept]')};});
    if(!secondStage.modal||!secondStage.stage||!secondStage.compare||!secondStage.candidate||!secondStage.title.includes('卷纲候选确认'))throw Error('接受大纲后没有进入第二阶段卷纲确认：'+JSON.stringify(secondStage));
    await c.ev(()=>{__s.rejectOutlineVolumePlan();return true;});await c.delay(150);
    await c.send('Emulation.setDeviceMetricsOverride',{width:360,height:740,deviceScaleFactor:1,mobile:true});
    await c.ev(()=>{__s.showOutlineRevisionModal=false;__s.showOutlineInMain=false;__s.showDetailedOutlineInMain=true;__s.doInput='根据现有六章细纲创建三卷并按剧情归类';__s.outlineStreamPreview='';__s.outlineStreamDockCollapsed=false;return true;});await c.delay(250);
    await c.ev(()=>document.querySelector('[data-moyun-detailed-ai]')?.click());
    let detailLive=null;
    for(let i=0;i<40;i++){detailLive=await c.ev(()=>{const dock=document.querySelector('[data-moyun-workbench="detailed-outline"] [data-moyun-outline-stream]'),rect=dock?.getBoundingClientRect(),footer=dock?.closest('[data-moyun-workbench="detailed-outline"]')?.querySelector('.moyun-do-footer')?.getBoundingClientRect();return{visible:!!dock,text:dock?.querySelector('pre')?.textContent||'',top:rect?.top,bottom:rect?.bottom,footerTop:footer?.top,width:innerWidth,stillOnDetails:!!document.querySelector('[data-moyun-workbench="detailed-outline"]')};});if(detailLive.visible&&detailLive.text)break;await c.delay(80);}
        if(!detailLive?.visible||!detailLive.text||detailLive.bottom>detailLive.footerTop+1||detailLive.footerTop-detailLive.bottom>24||!detailLive.stillOnDetails)throw Error('细纲入口的卷纲流式输出没有贴近底部细纲工作台：'+JSON.stringify({...detailLive,state:await c.ev(()=>({generating:__s.isGeneratingOutline,workbench:__s.outlineStreamWorkbench,requests:__outlineFlowRequests.length,showReview:__s.showOutlineRevisionModal}))}));
    for(let i=0;i<80;i++){if(await c.ev(()=>!!document.querySelector('[data-moyun-modal="outline-revision"]')))break;await c.delay(100);}
    const detailFlow=await c.ev(()=>{const modal=document.querySelector('[data-moyun-modal="outline-revision"]');return{modal:!!modal,compare:!!modal?.querySelector('[data-moyun-volume-compare]'),rows:__s.outlineReview.workbenchVolumes?.rows?.map(row=>({number:row.number,title:row.title,start:row.startChapter,end:row.endChapter})),originalDetails:__s.chapterOutlines.map(row=>row.content),oldVolume:__s.novel.volumes[0]?.title,request:__outlineFlowRequests.at(-1)};});
    const plannerMessages=JSON.stringify(detailFlow.request?.body?.messages||[]);
    if(!detailFlow.modal||!detailFlow.compare||detailFlow.rows?.length!==3||detailFlow.rows.some((row,index)=>row.number!==index+1)||detailFlow.oldVolume!=='旧卷'||!plannerMessages.includes('第6章的细纲事实')||!plannerMessages.includes('旧卷纲哨兵')||!plannerMessages.includes('有权限新增、合并、拆分和重新命名卷纲')||!plannerMessages.includes('必须在返回的 volumes 中给出完整的新卷范围')||!plannerMessages.includes('最终目标 3 卷')||!plannerMessages.includes('只能修改 volumes'))throw Error('细纲工作台没有展示三卷候选、授予创建权限、说明完整输出契约或保护原卷纲：'+JSON.stringify(detailFlow));
    await c.ev(()=>{document.querySelector('[data-outline-volume-reject]')?.click();return true;});await c.delay(300);
    const rejected=await c.ev(()=>({modal:!!document.querySelector('[data-moyun-modal="outline-revision"]'),volume:__s.novel.volumes[0]?.title,details:__s.chapterOutlines.map(row=>row.content)}));
    if(rejected.modal||rejected.volume!=='旧卷'||JSON.stringify(rejected.details)!==JSON.stringify(detailFlow.originalDetails))throw Error('拒绝新卷候选后原卷纲或细纲发生变化：'+JSON.stringify(rejected));
    await c.ev(()=>{__s.doInput='根据现有六章细纲创建三卷并按剧情归类';document.querySelector('[data-moyun-detailed-ai]')?.click();return true;});
    for(let i=0;i<80;i++){if(await c.ev(()=>!!document.querySelector('[data-moyun-modal="outline-revision"]')))break;await c.delay(100);}
    const created=await c.ev(()=>({modal:!!document.querySelector('[data-moyun-modal="outline-revision"]'),rows:__s.outlineReview.workbenchVolumes?.rows?.map(row=>row.title)}));
    if(!created.modal||created.rows?.length!==3)throw Error('重新生成卷纲候选失败：'+JSON.stringify(created));
    await c.ev(()=>{document.querySelector('[data-outline-volume-accept]')?.click();return true;});await c.delay(450);
    await c.delay(120);
    await c.ev(()=>{const modal=document.querySelector('[data-moyun-modal=confirm]');if(modal)[...modal.querySelectorAll('button')].find(button=>button.textContent.includes('确认并应用'))?.click();return true;});
    await c.delay(450);
    const createdVolumes=await c.ev(()=>({modal:!!document.querySelector('[data-moyun-modal="outline-revision"]'),volumes:__s.novel.volumes.map(row=>({number:row.number,title:row.title,start:row.startChapter,end:row.endChapter})),details:__s.chapterOutlines.map(row=>row.content)}));
    if(createdVolumes.modal||createdVolumes.volumes.length!==3||createdVolumes.volumes.some((row,index)=>row.number!==index+1)||JSON.stringify(createdVolumes.details)!==JSON.stringify(detailFlow.originalDetails))throw Error('接受候选后没有创建三卷，或细纲被误改：'+JSON.stringify(createdVolumes));
    results.push({width:1280,theme:'light',stream:live,review:{modal:normalFlow.modal,compare:normalFlow.compare.slice(0,160)}});
    results.push({width:360,theme:'light',stream:detailLive,plan:detailFlow.rows,reject:rejected,acceptedVolumes:createdVolumes.volumes});
    console.log(JSON.stringify({passed:true,results,after},null,2));
  }finally{
    try{if(c){await c.send('Browser.close');c.ws.close();}}catch{}
    edge.kill();await new Promise(resolve=>server.close(resolve));try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:200});}catch{}
  }
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
