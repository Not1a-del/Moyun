'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const port=Number(process.argv[2]||9236),base=process.argv[3]||'http://127.0.0.1:4176';
const out=path.join(__dirname,'../.ui-check');let ws,id=0;const pending=new Map(),rows=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function ev(fn,...args){const r=await send('Runtime.evaluate',{expression:'('+fn.toString()+')('+args.map(x=>JSON.stringify(x)).join(',')+')',returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function ready(){for(let i=0;i<150;i++){try{if(await ev(()=>!!document.querySelector('#app')?.__vue_app__?._instance?.proxy?.$?.setupState))return;}catch{}await delay(200);}throw Error('Vue not ready');}
(async()=>{const targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();const t=targets.find(t=>t.type==='page'&&t.url.startsWith(base));assert.ok(t);ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}});await send('Page.enable');await send('Runtime.enable');
for(const [label,url] of [['baseline',base+'/baseline/index.html'],['v16',base+'/index.html']]){
await send('Page.navigate',{url});await ready();await delay(3000);
for(let i=0;i<4;i++){await ev(()=>{for(const t of ['开始使用','我知道了'])[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===t&&x.getBoundingClientRect().width)?.click();});await delay(200);}
for(const width of [1280,390]){
await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<768});
const result=await ev(async()=>{
const s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState;window.__s=s;s.modPacks=[];s.imageGenEnabled=false;s.showSettings_modal=false;s.showCharacterWorkbench=false;s.showStoryBibleWorkbench=false;s.showDetailedOutlineInMain=false;s.showOutlineInMain=false;s.showPromptPreview=false;s.bookshelfView='book';s.mobileSidebarOpen=false;
const para='船员翻开地图，核对港口的方向和潮汐。他在日志里标记停靠时间，然后走上甲板，与领航员商量明日的行程。';
const content=Array.from({length:45},(_,i)=>'场景'+i+'。'+para.repeat(2)).join('\n\n');
s.chapters=Array.from({length:400},(_,i)=>({id:'perf-'+i,title:'海上日志 '+i,content,summary:'航海记录',wordCount:content.length,branchId:'main',versions:[],isExpanded:i>=395,isEditing:false}));s.branchList=[{id:'main',name:'主线'}];s.activeBranchId='main';
await Vue.nextTick();await new Promise(r=>setTimeout(r,300));

s.getChapterParagraphs(s.chapters[0],0);let start=performance.now();
for(let r=0;r<12;r++)for(let i=0;i<10;i++)s.getChapterParagraphs(s.chapters[i],i);
const paragraphMs=performance.now()-start;
const initial=s.totalWordCount;start=performance.now();s.chapters[0].content+='新';const count=s.totalWordCount;const countUpdateMs=performance.now()-start;
start=performance.now();const snapshot=s.buildLibrarySnapshot();const snapshotMs=performance.now()-start;
let frames=0;start=performance.now();for(let i=0;i<30;i++){s.streamContent='流式样本 '+i+'\n\n'+para.repeat(20+i*5);await Vue.nextTick();await new Promise(r=>requestAnimationFrame(()=>{frames++;r();}));}const updatesMs=performance.now()-start;s.streamContent='';
return {chapters:s.chapters.length,characters:content.length*400,paragraphMs:Math.round(paragraphMs),countUpdateMs:Math.round(countUpdateMs),wordCountDelta:count-initial,snapshotMs:Math.round(snapshotMs),snapshotChapters:snapshot.chapters.length,updatesMs:Math.round(updatesMs),frames,overflow:document.documentElement.scrollWidth>innerWidth};
});assert.equal(result.wordCountDelta,1);assert.equal(result.snapshotChapters,400);assert.equal(result.overflow,false);rows.push({label,width,...result});console.log(label,width,JSON.stringify(result));
}
}
const comparison=[1280,390].map(width=>{const before=rows.find(x=>x.width===width&&x.label==='baseline'),after=rows.find(x=>x.width===width&&x.label==='v16');return{width,paragraphReduction:1-after.paragraphMs/Math.max(1,before.paragraphMs),wordCountMsBefore:before.countUpdateMs,wordCountMsAfter:after.countUpdateMs,updateMsBefore:before.updatesMs,updateMsAfter:after.updatesMs};});
fs.writeFileSync(path.join(out,'v16-performance-results.json'),JSON.stringify({rows,comparison,scope:'本机已有 Edge；400 章合成书；窗口仿真，不代表真实手机温度或能耗'},null,2));console.log(JSON.stringify(comparison,null,2));ws.close();
})().catch(e=>{console.error(e);ws?.close();process.exitCode=1;});
