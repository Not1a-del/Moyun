'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.argv[2] || 'http://127.0.0.1:4173/index.html';
const label = base.startsWith('https:') ? 'live' : 'local';
const results = [], errors = [], pending = new Map();
const out = path.join(__dirname, '../.ui-check');fs.mkdirSync(out,{recursive:true});
const announcementId = 'web-2026-09-26-0925-0926-update';
let ws, seq = 0, session;
const delay = ms => new Promise(r => setTimeout(r, ms));
function send(method, params = {}, targetSession = session) {
  return new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, {resolve,reject});
    ws.send(JSON.stringify({id,method,params,...(targetSession ? {sessionId:targetSession} : {})}));
  });
}
async function ev(fn, ...args) {
  const r = await send('Runtime.evaluate', {expression:'('+fn.toString()+')('+args.map(a=>JSON.stringify(a)).join(',')+')',returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function waitFor(fn) {
  for(let i=0;i<120;i++) { try { const r=await fn(); if(r)return r; }catch{} await delay(250); }
  throw Error('等待公告状态超时');
}
async function title() { return ev(()=>document.querySelector('#moyun-web-update-title')?.textContent.trim()); }
async function clickAck() {
  const p=await ev(()=>{const b=document.querySelector('[data-web-update-ack]');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,hit:b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
  assert.equal(p.hit,true);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});
  await delay(400);
}
function record(name,data) { results.push({name,ok:true,data});console.log('PASS',name,JSON.stringify(data)); }
(async()=>{
  const info=await(await fetch('http://127.0.0.1:9235/json/version')).json();
  ws=new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
  ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
  for(const width of [1280,390]) {
    session=undefined;
    const {browserContextId}=await send('Target.createBrowserContext');
    const {targetId}=await send('Target.createTarget',{url:'about:blank',browserContextId});
    session=(await send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
    await send('Runtime.enable');await send('Page.enable');
    await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
    await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<500});
    await send('Page.navigate',{url:base});
    await waitFor(async()=> (await title())?.includes('欢迎来到 Moyun'));
    await delay(4500);await clickAck();
    await waitFor(async()=> (await title())==='0926更新');
    record(width+' 新用户先新手说明再公告',true);
    const d=await ev(()=>{const m=document.querySelector('[data-moyun-modal="web-update-announcement"]'),text=m.innerText,r=m.getBoundingClientRect();return{text,overflow:document.documentElement.scrollWidth>innerWidth,modalOverflow:m.scrollWidth>m.clientWidth,bounds:r.left>=0&&r.right<=innerWidth};});
    assert.ok(!/抗截断|工具回复|空回复最多/.test(d.text));assert.ok(d.text.includes('侧栏收起/展开改为即时切换'));
    assert.ok(d.text.includes('0925')&&d.text.includes('0926'),'公告必须同时覆盖 0925 与 0926 两天的变更');
    assert.ok(d.text.includes('发送预览')&&d.text.includes('小说 JSON 导入'));
    assert.ok(!/反标记|NSFW|大书保存|0914更新|0923更新|v?0\.0\.\d+/.test(d.text));
    assert.equal(d.overflow,false);assert.equal(d.modalOverflow,false);assert.equal(d.bounds,true);
    record(width+' JSON公告/无版本号/无横向溢出',{overflow:d.overflow,modalOverflow:d.modalOverflow,bounds:d.bounds});
    const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'announce-0926-'+label+'-'+width+'.png'),Buffer.from(shot.data,'base64'));
    await clickAck();assert.equal(await title(),undefined);
    assert.equal(await ev(()=>localStorage.getItem('moyun_web_update_announcement_seen')),announcementId);
    await send('Page.reload');await delay(5000);
    await waitFor(()=>ev(()=>!!document.querySelector('#app')?.__vue_app__?._instance?.proxy?.$?.setupState));
    assert.equal(await title(),undefined);record(width+' 确认后刷新不再弹',true);
    await ev(()=>{localStorage.setItem('moyun_first_run_guide_seen','moyun-first-run-project-introduction-v1');localStorage.setItem('moyun_web_update_announcement_seen','web-2026-09-22-2020-0922-update');});
    await send('Page.reload');await waitFor(async()=> (await title())==='0926更新');
    await delay(4500);await clickAck();
    assert.equal(await ev(()=>localStorage.getItem('moyun_web_update_announcement_seen')),announcementId);record(width+' 老用户直接显示新公告并可确认',true);
    session=undefined;await send('Target.disposeBrowserContext',{browserContextId});
  }
  assert.equal(errors.length,0);
  fs.writeFileSync(path.join(out,'announce-0926-'+label+'.json'),JSON.stringify({base,passed:true,results,errors},null,2));
  console.log('ANNOUNCEMENT PASSED:',results.length);ws.close();
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(out,'announce-0926-'+label+'.json'),JSON.stringify({base,passed:false,results,errors,error:String(e)},null,2));ws?.close();process.exitCode=1;});
