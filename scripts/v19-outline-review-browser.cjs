'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),port=4191,cdp=9251;
const option=name=>{const index=process.argv.indexOf(name);return index<0?'':process.argv[index+1]||'';};
const base=option('--url')||'http://127.0.0.1:'+port+'/index.html';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const hasExited=child=>child&&((child.exitCode!==null&&child.exitCode!==undefined)||(child.signalCode!==null&&child.signalCode!==undefined));
function waitForChildExit(child,timeout){
  if(hasExited(child))return Promise.resolve(true);
  return new Promise(resolve=>{
    let timer;
    const finish=exited=>{clearTimeout(timer);child.removeListener('exit',onExit);child.removeListener('close',onExit);child.removeListener('error',onError);resolve(exited);};
    const onExit=()=>finish(true),onError=()=>finish(true);
    child.once('exit',onExit);child.once('close',onExit);child.once('error',onError);
    timer=setTimeout(()=>finish(hasExited(child)),timeout);
  });
}
function killWindowsProcessTree(pid){
  return new Promise((resolve,reject)=>{
    const killer=spawn('taskkill',['/PID',String(pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
    killer.once('error',reject);
    killer.once('close',code=>code===0?resolve():reject(Error('taskkill exited with code '+code)));
  });
}
async function cleanupBrowserRun({client,edge,server,profile,platform=process.platform,killTree=killWindowsProcessTree,removeProfile=target=>fs.rmSync(target,{recursive:true,force:true,maxRetries:4,retryDelay:250}),logger=console,graceMs=2500,exitMs=3000,retryDelays=[150,300,600,1000,1500],sleep=wait}={}){
  if(client){let timer;try{await Promise.race([client.send('Browser.close').catch(()=>{}),new Promise(resolve=>{timer=setTimeout(resolve,1000);})]);}catch{}clearTimeout(timer);try{client.ws.close();}catch{}}
  if(edge&&!hasExited(edge)){
    if(client)await waitForChildExit(edge,graceMs);
    if(!hasExited(edge)){
      if(platform==='win32'){try{await killTree(edge.pid);}catch(error){logger.warn('Could not stop Edge process tree:',error.message);}}
      if(!hasExited(edge))try{edge.kill('SIGKILL');}catch{}
      await waitForChildExit(edge,exitMs);
    }
  }
  if(server?.listening)await new Promise(resolve=>{server.close(()=>resolve());server.closeAllConnections?.();});
  if(!profile)return null;
  let lastError;
  for(let attempt=0;attempt<=retryDelays.length;attempt++){
    try{removeProfile(profile);if(!fs.existsSync(profile))return null;throw Error('directory still exists after removal');}
    catch(error){lastError=error;if(attempt<retryDelays.length)await sleep(retryDelays[attempt]);}
  }
  logger.error('Failed to remove temporary Edge profile '+profile+': '+(lastError?.message||lastError));
  return lastError||Error('temporary Edge profile was not removed');
}
async function main(){
  let server,profile,edge,c;
  try{
  server=http.createServer((req,res)=>{const pathname=new URL(req.url,base).pathname;const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'content-type':({'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});res.end(error?'':data);});});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});});
  profile=fs.mkdtempSync(path.join(os.tmpdir(),'moyun-v19-outline-'));
  const edgePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(file=>fs.existsSync(file));
  if(!edgePath)throw Error('鏈壘鍒版湰鏈?Edge');
  edge=spawn(edgePath,['--headless=new','--remote-debugging-port='+cdp,'--user-data-dir='+profile,'--no-first-run','--no-default-browser-check',...(option('--proxy')?['--proxy-server='+option('--proxy')]:[]),'about:blank'],{stdio:'ignore',windowsHide:true});
    for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:'+cdp+'/json/version')).ok)break;}catch{}await wait(100);}
    c=await require('./v16-r2-browser-session.cjs').connect(cdp,base);
    await c.navigate();
    await c.ev(()=>{window.__s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState;});
    if(process.argv.includes('--ai-input-retention')){await require('./v19-ai-input-retention-browser.cjs')(c);return;}
    if(process.argv.includes('--comment-truncation')){await require('./v19-comment-truncation-browser.cjs')(c);return;}
    if(process.argv.includes('--chapter-settings-lifecycle')){await require('./v19-context-chapter-lifecycle-browser.cjs')(c,{expectReset:process.argv.includes('--expect-reset')});return;}
    if(process.argv.includes('--chapter-settings')){await require('./v19-context-chapter-settings-browser.cjs')(c);return;}
    if(process.argv.includes('--context-integrity')){await require('./v19-context-integrity-browser.cjs')(c);return;}
    if(process.argv.includes('--reader-onekey')){await require('./v19-reader-onekey-browser.cjs')(c);return;}
    if(process.argv.includes('--release-smoke')){await require('./v19-release-smoke.cjs')(c);return;}
    if(process.argv.includes('--mobile-layout')){await require('./v19-mobile-layout-browser.cjs')(c);return;}
    if(process.argv.includes('--planning-recovery')){await require('./v19-planning-recovery-browser.cjs')(c);return;}
    if(process.argv.includes('--manual-planning')){await require('./v19-manual-planning-browser.cjs')(c);return;}
    if(process.argv.includes('--volume-classification')){await require('./v19-volume-classification-browser.cjs')(c);return;}
    if(process.argv.includes('--branch-context')){await require('./v19-branch-context-browser.cjs')(c);return;}
    if(process.argv.includes('--settings-search')){await require('./v19-settings-search-browser.cjs')(c);return;}
    if(process.argv.includes('--memory-recovery')){await require('./v19-legacy-memory-browser.cjs')(c,{backup:option('--backup')});return;}
    if(process.argv.includes('--character-relations')){await require('./v19-character-relations-browser.cjs')(c,{backup:option('--backup')});return;}
    if(process.argv.includes('--snapshot-cleanup')){await require('./v19-regen-snapshot-browser.cjs')(c,{backup:option('--backup')});return;}
    const seed=await c.ev(()=>{const s=__s,id='v19-outline-browser';if(!s.books.some(book=>book.id===id))s.books.push({id,novel:{title:'鍗风翰瀹￠槄楠屾敹',outline:'鎬荤翰',volumes:[{id:'v1',title:'鏃у嵎',startChapter:1,endChapter:2,summary:'鏃ц鍒?}]},chapters:[],characters:[]});s.loadBook(id);s.chapterOutlines=Array.from({length:10},(_,i)=>({id:'o'+i,chapterNo:i+1,title:'绗?+(i+1)+'绔?,content:'缁嗙翰'+(i+1)}));s.novel.volumes=[{id:'v1',title:'鏃у嵎',startChapter:1,endChapter:10,summary:'鏃ц鍒?}];return true;});
    const results=[];
    for(const mode of [{width:1280,height:800,name:'light'},{width:360,height:740,name:'mobile'}]){
      await c.send('Emulation.setDeviceMetricsOverride',{width:mode.width,height:mode.height,deviceScaleFactor:1,mobile:mode.width<768});
      for(const dark of [false,true]){
        await c.ev(({dark})=>{const s=__s;if(s.isDark!==dark)s.toggleTheme();s.showOutlineInMain=true;s.showDetailedOutlineInMain=false;s.outlineReview={id:'review-'+dark,source:'鍗风翰鏁寸悊',selectedId:'',revisions:[{id:'d',type:-1,text:'鏃у嵎',status:'pending',selected:true,groupId:'volume-plan'},{id:'i',type:1,text:'鏂板嵎',status:'pending',selected:true,groupId:'volume-plan'}],workbenchVolumes:{rows:Array.from({length:10},(_,i)=>({id:'v'+i,number:i+1,title:'绗?+(i+1)+'鍗?,startChapter:i+1,endChapter:i+1,summary:'鍗风翰鍊欓€夊唴瀹?.repeat(10),writingRequirement:'鏈嵎鍐欎綔瑕佹眰',bridge:'鍗锋湯琛旀帴'})),baseline:JSON.stringify(s.novel.volumes),chapterOutlinesBaseline:JSON.stringify(s.chapterOutlines)}};s.showOutlineRevisionModal=true;return true;},{dark});
        await c.delay(650);
        const data=await c.ev(({dark})=>{const modal=document.querySelector('[data-moyun-modal=outline-revision]'),panel=modal?.querySelector('[data-moyun-modal-panel]'),body=modal?.querySelector('.moyun-outline-review-body'),r=panel?.getBoundingClientRect(),cs=panel&&getComputedStyle(panel);return{dark,viewport:{width:innerWidth,height:innerHeight},modal:{width:modal?.getBoundingClientRect().width,height:modal?.getBoundingClientRect().height},panel:{left:r?.left,right:r?.right,top:r?.top,bottom:r?.bottom,width:r?.width,height:r?.height,maxHeight:cs?.maxHeight,display:cs?.display,transform:cs?.transform},body:{scrollHeight:body?.scrollHeight,clientHeight:body?.clientHeight},styles:[...document.styleSheets].map(sheet=>sheet.href),ruleFound:[...document.styleSheets].flatMap(sheet=>{try{return [...sheet.cssRules].filter(rule=>rule.selectorText?.includes('moyun-outline-review-panel')).map(rule=>rule.cssText);}catch{return[];}}),overflow:document.documentElement.scrollWidth>innerWidth+1||modal?.scrollWidth>modal?.clientWidth+1,text:modal?.innerText.includes('鍗风翰閲嶆柊鍒掑垎鍊欓€?)};},{dark});
        if(!data.text||data.overflow||data.panel.left<0||data.panel.right>data.viewport.width+1||data.panel.bottom>data.viewport.height+1)throw Error(mode.name+' '+(dark?'dark':'light')+' 寮圭獥甯冨眬涓嶅悎鏍硷細'+JSON.stringify(data));
        if(data.body.scrollHeight<=data.body.clientHeight)throw Error(mode.name+' 瀹￠槄鍐呭鏈舰鎴愮嫭绔嬫粴鍔ㄥ尯锛?+JSON.stringify(data));
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
    if(after.modal||after.volume!=='鏃у嵎')throw Error('鎷掔粷鍊欓€夊悗鍘熷嵎绾叉湭淇濇寔涓嶅彉锛?+JSON.stringify(after));
    await c.ev(()=>{
      __s.showOutlineInMain=true;__s.showDetailedOutlineInMain=false;__s.outlineReview={id:'outline-with-volume-plan',source:'鏁呬簨澶х翰',selectedId:'',beforeText:'鏃уぇ绾?,afterText:'鏂板ぇ绾?,revisions:[{id:'old-outline',type:-1,text:'鏃уぇ绾?,status:'pending',selected:true,groupId:'outline-change'},{id:'new-outline',type:1,text:'鏂板ぇ绾?,status:'pending',selected:true,groupId:'outline-change'}],volumePlan:{rows:[{number:1,title:'绗竴鍗?,startChapter:1,endChapter:5,summary:'鍊欓€夊嵎绾?}],total:5},volumeBaseline:[{id:'v1',title:'鏃у嵎',startChapter:1,endChapter:5,summary:'鏃у嵎绾?}]};
      __s.showOutlineRevisionModal=true;
      return true;
    });
    await c.delay(350);
    const outlinePlan=await c.ev(()=>{const modal=document.querySelector('[data-moyun-modal=outline-revision]');return{visible:!!modal,text:modal?.innerText||'',compare:!!modal?.querySelector('[data-moyun-review-compare]')};});
    if(!outlinePlan.visible||!outlinePlan.compare||!outlinePlan.text.includes('AI 鍊欓€夊嵎绾?))throw Error('鏅€氬ぇ绾蹭慨鏀规湭鏄剧ず鍗风翰宸﹀彸鍊欓€夛細'+JSON.stringify(outlinePlan));
    await c.ev(()=>{
      __s.novel.volumes=[{id:'v1',title:'鏃у嵎',startChapter:1,endChapter:10,summary:'鏃ц鍒?}];
      __s.outlineReview={id:'normal-volume-accept',source:'鏁呬簨澶х翰',selectedId:'',revisions:[],volumePlan:{rows:[{number:1,title:'鎺ュ彈鍚庣殑鍗?,startChapter:1,endChapter:10,summary:'鏂拌鍒?}],total:10},volumeBaseline:JSON.parse(JSON.stringify(__s.novel.volumes)),volumeChapterOutlinesBaseline:JSON.stringify(__s.chapterOutlines)};
      __s.showOutlineRevisionModal=true;return true;
    });
    await c.delay(250);
    await c.ev(()=>{document.querySelector('[data-outline-volume-accept]')?.click();return true;});
    await c.delay(450);
    const accepted=await c.ev(()=>({modal:!!document.querySelector('[data-moyun-modal=outline-revision]'),title:__s.novel.volumes[0]?.title}));
    if(accepted.modal||accepted.title!=='鎺ュ彈鍚庣殑鍗?)throw Error('鍗风翰鍊欓€夋帴鍙椾簨浠舵湭鍐欏叆锛?+JSON.stringify(accepted));
    await c.ev(()=>{
      __s.outlineReview={id:'workbench-volume-accept',source:'鍗风翰鏁寸悊',selectedId:'',revisions:[{id:'old',type:-1,text:'鏃у嵎',status:'pending',selected:true,groupId:'volume-plan'},{id:'new',type:1,text:'鏂板嵎',status:'pending',selected:true,groupId:'volume-plan'}],workbenchVolumes:{rows:[{id:'v1',number:1,title:'宸ヤ綔鍙版帴鍙楀悗鐨勫嵎',startChapter:1,endChapter:10,summary:'宸ヤ綔鍙版柊璁″垝'}],baseline:JSON.stringify(__s.novel.volumes),chapterOutlinesBaseline:JSON.stringify(__s.chapterOutlines)}};
      __s.showOutlineRevisionModal=true;return true;
    });
    await c.delay(250);
    await c.ev(()=>{document.querySelector('[data-outline-volume-accept]')?.click();return true;});
    await c.delay(120);
    await c.ev(()=>{const modal=document.querySelector('[data-moyun-modal=confirm]');if(modal)[...modal.querySelectorAll('button')].find(button=>button.textContent.includes('纭骞跺簲鐢?))?.click();return true;});
    await c.delay(450);
    const workbenchAccepted=await c.ev(()=>({modal:!!document.querySelector('[data-moyun-modal=outline-revision]'),title:__s.novel.volumes[0]?.title}));
    if(workbenchAccepted.modal||workbenchAccepted.title!=='宸ヤ綔鍙版帴鍙楀悗鐨勫嵎')throw Error('宸ヤ綔鍙板嵎绾叉帴鍙椾簨浠舵湭鍐欏叆锛?+JSON.stringify(workbenchAccepted));
    await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
    await c.ev(()=>{
      const s=__s, originalFetch=window.fetch.bind(window);
      window.__outlineFlowRequests=[];
      window.fetch=async(input,init={})=>{
        const url=String(input);
        if(!url.includes('outline-flow.invalid'))return originalFetch(input,init);
        const body=JSON.parse(init.body||'{}'), planner=JSON.stringify(body).includes('鍗风翰鏁寸悊缂栬緫');
        window.__outlineFlowRequests.push({url,body,planner});
        const output=planner?JSON.stringify({volumes:[{number:1,title:'娓彛',startChapter:1,endChapter:2,summary:'闈犳腐涓庣浉閬?},{number:2,title:'鏃т俊',startChapter:3,endChapter:4,summary:'鎵惧埌鏃т俊'},{number:3,title:'绂诲哺',startChapter:5,endChapter:6,summary:'绂诲紑娓彛'}]}):JSON.stringify({outline:'淇敼鍚庣殑澶х翰鍝ㄥ叺锛氫富瑙掑湪娓彛鎵惧埌涓€灏佹棫淇★紝闅忓悗杩芥煡淇′欢涓殑鏃ユ湡涓庢敹浠朵汉锛岄€愭鍙戠幇娓彛鏃ф涓庤嚜宸辩殑瀹舵棌鏈夊叧銆?.repeat(8),volumes:[{number:1,title:'娓彛鏃ф',startChapter:1,endChapter:6,summary:'涓昏璋冩煡娓彛鏃ф'}]});
        // 鐢ㄥ垎鍧?SSE 瑕嗙洊闈?Gemini 鏈嶅姟鍟嗙殑鐪熷疄娴佸紡杈撳叆锛屽苟璁?UI 鏈夋椂闂村憟鐜版鍦ㄥ埌杈剧殑鏂囧瓧銆?        const events=output.match(/.{1,32}/gu)||[output],encode=text=>new TextEncoder().encode(text);
        const upstream=new ReadableStream({start(controller){(async()=>{for(const part of events){controller.enqueue(encode('data: '+JSON.stringify({choices:[{delta:{content:part},finish_reason:null}]})+'\n\n'));await new Promise(resolve=>setTimeout(resolve,100));}controller.enqueue(encode('data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\n'));controller.enqueue(encode('data: [DONE]\n\n'));controller.close();})().catch(error=>controller.error(error));}});
        return new Response(upstream,{status:200,headers:{'content-type':'text/event-stream'}});
      };
      s.books.push({id:'v19-outline-flow',novel:{title:'澶х翰娴佸紡楠屾敹',outline:'鏃уぇ绾插摠鍏?,volumes:[{id:'old-volume',title:'鏃у嵎',startChapter:1,endChapter:6,summary:'鏃у嵎绾插摠鍏?}]},chapters:[],chapterOutlines:[],characters:[]});
      s.loadBook('v19-outline-flow');s.novel.outline='鏃уぇ绾插摠鍏?;s.novel.chapterCount=6;s.novel.volumes=[{id:'old-volume',title:'鏃у嵎',startChapter:1,endChapter:6,summary:'鏃у嵎绾插摠鍏?}];
      s.chapterOutlines=Array.from({length:6},(_,i)=>({id:'flow-o'+i,chapterNo:i+1,title:'绗?+(i+1)+'绔?,content:'绗?+(i+1)+'绔犵殑缁嗙翰浜嬪疄'}));
      s.connectionCenter={version:1,profiles:[{id:'outline-flow-profile',name:'楠屾敹妯℃嫙',templateId:'custom',adapterId:'openai-compatible',baseUrl:'https://outline-flow.invalid/v1',defaultModel:'flow-model',enabled:true,lastTest:{status:'ok'},modelCatalog:[]}],defaultProfileId:'outline-flow-profile',moduleRoutes:{}};
      s.setConnectionCredential('outline-flow-profile','test-only');s.settings.streamEnabled=true;s.settings.outlineRequestMode='stream';s.isDark=false;
      s.showOutlineInMain=true;s.showDetailedOutlineInMain=false;s.outlineInput='璁╀富瑙掑湪娓彛鍙戠幇涓€灏佹棫淇?;s.showOutlineRevisionModal=false;
      return true;
    });
    await c.delay(250);
    await c.ev(()=>document.querySelector('[data-moyun-outline-ai]')?.click());
    let live=null;
    for(let i=0;i<40;i++){live=await c.ev(()=>{const dock=document.querySelector('[data-moyun-workbench="outline"] [data-moyun-outline-stream]'),rect=dock?.getBoundingClientRect(),footer=dock?.closest('[data-moyun-workbench="outline"]')?.querySelector('.moyun-wb-operation')?.getBoundingClientRect();return{visible:!!dock,text:dock?.querySelector('pre')?.textContent||'',top:rect?.top,bottom:rect?.bottom,footerTop:footer?.top,modal:!!document.querySelector('[data-moyun-modal="outline-revision"]'),width:innerWidth};});if(live.visible&&live.text)break;await c.delay(80);}
    if(!live?.visible||!live.text||live.bottom>live.footerTop+1)throw Error('鏅€氬ぇ绾叉祦寮忓唴瀹规湭鍦ㄥ簳閮ㄥ伐浣滃彴鍙鍖哄煙鏄剧ず锛?+JSON.stringify({...live,state:await c.ev(()=>({generating:__s.isGeneratingOutline,input:__s.outlineInput,reason:__s.getOutlineAiDisabledReason?.(),requests:__outlineFlowRequests.length,modal:__s.showOutlineRevisionModal,show:__s.showOutlineInMain,toast:__s.toast,errors:window.__consoleErrors||[]}))}));
    for(let i=0;i<80;i++){if(await c.ev(()=>!!document.querySelector('[data-moyun-modal="outline-revision"]')))break;await c.delay(100);}
    const normalFlow=await c.ev(()=>{const modal=document.querySelector('[data-moyun-modal="outline-revision"]'),compare=modal?.querySelector('[data-moyun-review-compare]');return{modal:!!modal,text:modal?.innerText||'',compare:compare?.innerText||'',candidate:!!modal?.querySelector('[data-outline-volume-accept]'),outline:__s.novel.outline,requestCount:__outlineFlowRequests.length,generating:__s.isGeneratingOutline,toast:__s.toast,review:__s.outlineReview,lastRequest:__s.outlineLastRequest,request:__outlineFlowRequests[0]};});
    if(!normalFlow.modal||!normalFlow.compare.includes('鏃уぇ绾插摠鍏?)||!normalFlow.compare.includes('淇敼鍚庣殑澶х翰鍝ㄥ叺')||!normalFlow.candidate||normalFlow.outline!=='鏃уぇ绾插摠鍏?)throw Error('鏅€氬ぇ绾叉病鏈夌敓鎴愮嫭绔嬪乏鍙冲闃咃紝鎴栫敓鎴愬墠瑕嗙洊浜嗗師鍐呭锛?+JSON.stringify(normalFlow));
    await c.ev(()=>{[...document.querySelectorAll('[data-moyun-review-panel] button')].find(button=>button.textContent.includes('鍏ㄩ儴鎺ュ彈'))?.click();return true;});await c.delay(120);
    await c.ev(()=>{const modal=document.querySelector('[data-moyun-modal="confirm"]');if(modal)[...modal.querySelectorAll('button')].find(button=>button.textContent.includes('纭骞跺簲鐢?))?.click();return true;});await c.delay(220);
    const secondStage=await c.ev(()=>{const modal=document.querySelector('[data-moyun-modal="outline-revision"]');return{modal:!!modal,title:modal?.querySelector('#moyun-outline-review-title')?.textContent||'',stage:!!modal?.querySelector('[data-outline-volume-stage]'),compare:!!modal?.querySelector('[data-moyun-volume-compare]'),candidate:!!modal?.querySelector('[data-outline-volume-accept]')};});
    if(!secondStage.modal||!secondStage.stage||!secondStage.compare||!secondStage.candidate||!secondStage.title.includes('鍗风翰鍊欓€夌‘璁?))throw Error('鎺ュ彈澶х翰鍚庢病鏈夎繘鍏ョ浜岄樁娈靛嵎绾茬‘璁わ細'+JSON.stringify(secondStage));
    await c.ev(()=>{__s.rejectOutlineVolumePlan();return true;});await c.delay(150);
    await c.send('Emulation.setDeviceMetricsOverride',{width:360,height:740,deviceScaleFactor:1,mobile:true});
    await c.ev(()=>{__s.showOutlineRevisionModal=false;__s.showOutlineInMain=false;__s.showDetailedOutlineInMain=true;__s.doInput='鏍规嵁鐜版湁鍏珷缁嗙翰鍒涘缓涓夊嵎骞舵寜鍓ф儏褰掔被';__s.outlineStreamPreview='';__s.outlineStreamDockCollapsed=false;return true;});await c.delay(250);
    await c.ev(()=>document.querySelector('[data-moyun-detailed-ai]')?.click());
    let detailLive=null;
    for(let i=0;i<40;i++){detailLive=await c.ev(()=>{const dock=document.querySelector('[data-moyun-workbench="detailed-outline"] [data-moyun-outline-stream]'),rect=dock?.getBoundingClientRect(),footer=dock?.closest('[data-moyun-workbench="detailed-outline"]')?.querySelector('.moyun-do-footer')?.getBoundingClientRect();return{visible:!!dock,text:dock?.querySelector('pre')?.textContent||'',top:rect?.top,bottom:rect?.bottom,footerTop:footer?.top,width:innerWidth,stillOnDetails:!!document.querySelector('[data-moyun-workbench="detailed-outline"]')};});if(detailLive.visible&&detailLive.text)break;await c.delay(80);}
        if(!detailLive?.visible||!detailLive.text||detailLive.bottom>detailLive.footerTop+1||detailLive.footerTop-detailLive.bottom>24||!detailLive.stillOnDetails)throw Error('缁嗙翰鍏ュ彛鐨勫嵎绾叉祦寮忚緭鍑烘病鏈夎创杩戝簳閮ㄧ粏绾插伐浣滃彴锛?+JSON.stringify({...detailLive,state:await c.ev(()=>({generating:__s.isGeneratingOutline,workbench:__s.outlineStreamWorkbench,requests:__outlineFlowRequests.length,showReview:__s.showOutlineRevisionModal}))}));
    for(let i=0;i<80;i++){if(await c.ev(()=>!!document.querySelector('[data-moyun-modal="outline-revision"]')))break;await c.delay(100);}
    const detailFlow=await c.ev(()=>{const modal=document.querySelector('[data-moyun-modal="outline-revision"]');return{modal:!!modal,compare:!!modal?.querySelector('[data-moyun-volume-compare]'),rows:__s.outlineReview.workbenchVolumes?.rows?.map(row=>({number:row.number,title:row.title,start:row.startChapter,end:row.endChapter})),originalDetails:__s.chapterOutlines.map(row=>row.content),oldVolume:__s.novel.volumes[0]?.title,request:__outlineFlowRequests.at(-1)};});
    const plannerMessages=JSON.stringify(detailFlow.request?.body?.messages||[]);
    if(!detailFlow.modal||!detailFlow.compare||detailFlow.rows?.length!==3||detailFlow.rows.some((row,index)=>row.number!==index+1)||detailFlow.oldVolume!=='鏃у嵎'||!plannerMessages.includes('绗?绔犵殑缁嗙翰浜嬪疄')||!plannerMessages.includes('鏃у嵎绾插摠鍏?)||!plannerMessages.includes('鏈夋潈闄愭柊澧炪€佸悎骞躲€佹媶鍒嗗拰閲嶆柊鍛藉悕鍗风翰')||!plannerMessages.includes('蹇呴』鍦ㄨ繑鍥炵殑 volumes 涓粰鍑哄畬鏁寸殑鏂板嵎鑼冨洿')||!plannerMessages.includes('鏈€缁堢洰鏍?3 鍗?)||!plannerMessages.includes('鍙兘淇敼 volumes'))throw Error('缁嗙翰宸ヤ綔鍙版病鏈夊睍绀轰笁鍗峰€欓€夈€佹巿浜堝垱寤烘潈闄愩€佽鏄庡畬鏁磋緭鍑哄绾︽垨淇濇姢鍘熷嵎绾诧細'+JSON.stringify(detailFlow));
    await c.ev(()=>{document.querySelector('[data-outline-volume-reject]')?.click();return true;});await c.delay(300);
    const rejected=await c.ev(()=>({modal:!!document.querySelector('[data-moyun-modal="outline-revision"]'),volume:__s.novel.volumes[0]?.title,details:__s.chapterOutlines.map(row=>row.content)}));
    if(rejected.modal||rejected.volume!=='鏃у嵎'||JSON.stringify(rejected.details)!==JSON.stringify(detailFlow.originalDetails))throw Error('鎷掔粷鏂板嵎鍊欓€夊悗鍘熷嵎绾叉垨缁嗙翰鍙戠敓鍙樺寲锛?+JSON.stringify(rejected));
    await c.ev(()=>{__s.doInput='鏍规嵁鐜版湁鍏珷缁嗙翰鍒涘缓涓夊嵎骞舵寜鍓ф儏褰掔被';document.querySelector('[data-moyun-detailed-ai]')?.click();return true;});
    for(let i=0;i<80;i++){if(await c.ev(()=>!!document.querySelector('[data-moyun-modal="outline-revision"]')))break;await c.delay(100);}
    const created=await c.ev(()=>({modal:!!document.querySelector('[data-moyun-modal="outline-revision"]'),rows:__s.outlineReview.workbenchVolumes?.rows?.map(row=>row.title)}));
    if(!created.modal||created.rows?.length!==3)throw Error('閲嶆柊鐢熸垚鍗风翰鍊欓€夊け璐ワ細'+JSON.stringify(created));
    await c.ev(()=>{document.querySelector('[data-outline-volume-accept]')?.click();return true;});await c.delay(450);
    await c.delay(120);
    await c.ev(()=>{const modal=document.querySelector('[data-moyun-modal=confirm]');if(modal)[...modal.querySelectorAll('button')].find(button=>button.textContent.includes('纭骞跺簲鐢?))?.click();return true;});
    await c.delay(450);
    const createdVolumes=await c.ev(()=>({modal:!!document.querySelector('[data-moyun-modal="outline-revision"]'),volumes:__s.novel.volumes.map(row=>({number:row.number,title:row.title,start:row.startChapter,end:row.endChapter})),details:__s.chapterOutlines.map(row=>row.content)}));
    if(createdVolumes.modal||createdVolumes.volumes.length!==3||createdVolumes.volumes.some((row,index)=>row.number!==index+1)||JSON.stringify(createdVolumes.details)!==JSON.stringify(detailFlow.originalDetails))throw Error('鎺ュ彈鍊欓€夊悗娌℃湁鍒涘缓涓夊嵎锛屾垨缁嗙翰琚鏀癸細'+JSON.stringify(createdVolumes));
    results.push({width:1280,theme:'light',stream:live,review:{modal:normalFlow.modal,compare:normalFlow.compare.slice(0,160)}});
    results.push({width:360,theme:'light',stream:detailLive,plan:detailFlow.rows,reject:rejected,acceptedVolumes:createdVolumes.volumes});
    console.log(JSON.stringify({passed:true,results,after},null,2));
  }finally{
    const cleanupError=await cleanupBrowserRun({client:c,edge,server,profile});
    if(cleanupError)process.exitCode=1;
  }
}
module.exports={cleanupBrowserRun,waitForChildExit};
if(require.main===module)main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});

