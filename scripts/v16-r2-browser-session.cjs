'use strict';
// 仅连接使用者指定的隔离 CDP 测试浏览器；不得连接日常浏览器档案。
const delay=ms=>new Promise(r=>setTimeout(r,ms));
exports.connect=async(port=9236,base='http://127.0.0.1:4176/index.html')=>{
  const targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();
  const target=targets.find(t=>t.type==='page'&&t.url===base)||targets.find(t=>t.type==='page'&&t.url==='about:blank');
  if(!target)throw Error('未找到指定的隔离测试页面');
  const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let id=0;const pending=new Map(),errors=[],logs=[];
  ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timeout);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);else if(m.method==='Runtime.consoleAPICalled')logs.push({type:m.params.type,text:m.params.args.map(x=>x.description||x.value).join(' ')});});
  function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;const timeout=setTimeout(()=>{pending.delete(n);reject(Error('CDP 超时：'+method));},60000);pending.set(n,{resolve,reject,timeout});ws.send(JSON.stringify({id:n,method,params}));});}
  async function ev(fn,...args){const r=await send('Runtime.evaluate',{expression:'('+fn.toString()+')('+args.map(x=>JSON.stringify(x)).join(',')+')',returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
  async function ready(){for(let i=0;i<120;i++){try{if(await ev(()=>!!document.querySelector('#app')?.__vue_app__?._instance?.proxy?.$?.setupState)){await ev(()=>{window.__s=document.querySelector('#app').__vue_app__._instance.proxy.$.setupState;});return;}}catch{}await delay(200);}throw Error('Vue 未就绪：'+errors.join('\n'));}
  async function dismiss(){for(let i=0;i<4;i++){await ev(()=>{for(const t of ['开始使用','我知道了'])[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t&&b.getBoundingClientRect().width)?.click();});await delay(250);}}
  async function navigate(url=base){await send('Page.navigate',{url});await ready();await delay(2700);await dismiss();}
  await send('Page.enable');await send('Runtime.enable');
  return{ws,send,ev,ready,dismiss,navigate,delay,errors,logs};
};
