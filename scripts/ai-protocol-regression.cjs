'use strict';
// 直接执行唯一业务源中的实现：离线、不读取密钥、不修改作品。
const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict'), path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
let responder, passed=0; const requests=[], notices=[];
const c=vm.createContext({Response,ReadableStream,TextDecoder,TextEncoder,AbortController,DOMException,console,setTimeout,clearTimeout,normalizeNoOutputTimeout:()=>45,
  settings:{value:{geminiReplyInTool:null}},showToast:(...a)=>notices.push(a),saveData:()=>{},
  fetch:async(url,opts)=>{requests.push({url,...opts});return responder(url,opts);},
  getModuleRequestConfig:()=>({model:'gemini-test'}),cleanAIResponse:t=>String(t).replace(/\x60{3}(?:json)?/g,'').trim(),
  extractAiResponseErrorMessage:d=>d?.error?.message||'',sanitizeApiErrorDetail:t=>t,
  getAiResponseFinishReason:d=>d?.choices?.[0]?.finish_reason||d?.stop_reason||'',isAiFinishReasonTruncated:r=>/length|max_tokens/i.test(r),
  extractAiStreamTextDelta:(d,s)=>{const x=d.choices?.[0];if(x?.delta)return x.delta.content||'';const t=x?.message?.content||'',v=t.slice((s.text||'').length);s.text=t;return v;},
  extractNativeReasoningFromPayload:d=>d?.choices?.[0]?.delta?.reasoning_content||'',createApiResponseError:async r=>Object.assign(new Error('HTTP '+r.status),{status:r.status})});
vm.runInContext(section('    function getAdapterIdForRequest(','    // v0.0.14：工具')+section('    // v0.0.14：工具','    function extractAdapterText(')+section('    function parseAiJsonSyntax(','    function getCharacterDraftProposedValue('),c);
const call=(n,...a)=>c[n](...a), json=JSON.stringify, event=d=>'data: '+json(d)+'\n\n';
const tool=(args,name='output_reply',id='call_1')=>({choices:[{delta:{tool_calls:[{index:0,id,function:{name,arguments:args}}]}}]});
function wire(text,size=7){const b=new TextEncoder().encode(text);let i=0;return new Response(new ReadableStream({pull(s){if(i>=b.length)s.close();else s.enqueue(b.slice(i,i+=size));}}),{headers:{'content-type':'text/event-stream'}});}
const request={ok:true,model:'gemini-test',url:'https://api.sta1n.cn/v1/chat/completions',apiKey:'test-only',adapterId:'openai-compatible'};
const init=extra=>call('buildAdapterRequest',{...request,...extra},[{role:'user',content:'测试'}],{stream:true});
async function run(text,cfg=init(),size=7){responder=()=>wire(text,size);return(await call('fetchAiAdapterResponse',cfg)).text();}
async function test(label,fn){await fn();passed++;console.log('PASS',label);}
(async()=>{
 await test('自动识别和手动开关优先',()=>{assert.equal(call('isGeminiReplyEnabled',{model:'vendor/GeMiNi-3'}),true);assert.equal(call('isGeminiReplyEnabled',{model:'other'}),false);c.settings.value.geminiReplyInTool=false;assert.equal(init().replyInTool,false);c.settings.value.geminiReplyInTool=true;assert.equal(init({model:'other'}).replyInTool,true);c.settings.value.geminiReplyInTool=null;});
 await test('sta1n工具合同、原消息不变、强制流式',()=>{const m=[{role:'user',content:'原文'}],b=call('buildAdapterRequest',request,m,{stream:false}).body;assert.equal(m[0].content,'原文');assert.equal(b.stream,true);assert.equal(b.tools[0].function.name,'output_reply');assert.equal(b.parallel_tool_calls,false);assert.equal(b.tool_choice.function.name,'output_reply');assert.equal(b.tools[0].function.parameters.additionalProperties,false);});
 await test('跨片转义、Unicode代理对、逐字节UTF8',async()=>{const expected='甲\n"乙"\\/\t😀𠮷',args=json({content:expected});const raw=await run(event(tool(''))+[...args].map(v=>event(tool(v,'','call_1'))).join(''),init(),1);const text=raw.split('\n').filter(l=>l.startsWith('data:')).map(l=>JSON.parse(l.slice(5)).choices[0].delta.content||'').join('');assert.equal(text,expected);const d=call('createReplyToolDecoder');d.accept([{function:{name:'output_reply',arguments:'{"content":"\\uD83D'}}]);assert.equal(d.text,'');d.accept([{function:{arguments:'\\uDE00"}'}}]);assert.equal(d.finish().text,'😀');});
 await test('完成前真实流式交付',async()=>{let release,count=0;const gate=new Promise(r=>release=r);responder=()=>new Response(new ReadableStream({async pull(s){if(++count===1)s.enqueue(new TextEncoder().encode(event(tool('{"content":"先到'))));else{await gate;s.enqueue(new TextEncoder().encode(event(tool('后到"}','','call_1'))));s.close();}}}));const r=(await call('fetchAiAdapterResponse',init())).body.getReader();assert.match(new TextDecoder().decode((await r.read()).value),/先到/);release();while(!(await r.read()).done){};});
 await test('末尾无换行、多行SSE、缺事件空行',async()=>{const text='data: {"choices":\ndata: [{"delta":{"content":"甲"}}]}\n'+event({choices:[{delta:{content:'乙'}}]}).trimEnd();const raw=await run(text,init({model:'other'}));assert.match(raw,/甲/);assert.match(raw,/乙/);});
 await test('非流式JSON与普通正文备用不重复',async()=>{const raw=await run(json({choices:[{message:{tool_calls:[{id:'c',function:{name:'output_reply',arguments:json({content:'正文'})}}],content:'重复正文'},finish_reason:'tool_calls'}]}));assert.match(raw,/正文/);assert.doesNotMatch(raw,/重复正文/);assert.match(await run(event({choices:[{delta:{content:'备用正文'},finish_reason:'stop'}]})),/备用正文/);});
 for(const [label,text,code] of [
 ['残缺工具',event(tool('{"content":"已收到')),'tool-incomplete'],['非法转义',event(tool('{"content":"\\q"}')),'tool-format'],
 ['额外键',event(tool('{"content":"正文","other":1}')),'tool-format'],['重复键',event(tool('{"content":"正文","content":"正文"}')),'tool-format'],
 ['未知工具',event(tool('{}','other')),'tool-name'],['ID冲突',event(tool('{"content":"'))+event(tool('正文"}','','different')),'tool-id'],
 ['HTTP200错误',event({error:{message:'rate limit'}}),'api-payload'],['过滤',event({choices:[{delta:{},finish_reason:'content_filter'}]}),'api-refusal'],
 ['拒绝',event({choices:[{delta:{refusal:'拒绝'}}]}),'api-refusal'],['损坏SSE','data: {"choices":','sse-json']
 ])await test(label+'不伪装成功',async()=>{const n=requests.length;await assert.rejects(run(text),e=>e.code===code);assert.equal(requests.length-n,1);});
 await test('真空回至多3次；推理空回不重试',async()=>{let n=requests.length;await assert.rejects(run(event({choices:[{delta:{},finish_reason:'stop'}]})));assert.equal(requests.length-n,3);n=requests.length;await assert.rejects(run(event({choices:[{delta:{reasoning_content:'思考'}}]})));assert.equal(requests.length-n,1);});
 await test('原生Gemini与Anthropic工具声明',()=>{assert.equal(init({adapterId:'gemini-generate'}).body.toolConfig.functionCallingConfig.mode,'ANY');assert.equal(init({adapterId:'anthropic-messages'}).body.tool_choice.name,'output_reply');});
 await test('原生Gemini functionCall',async()=>{assert.match(await run(event({candidates:[{content:{parts:[{functionCall:{name:'output_reply',args:{content:'原生正文'}}}]},finishReason:'STOP'}]}),init({adapterId:'gemini-generate'})),/原生正文/);});
 await test('Anthropic input_json_delta',async()=>{const frames=[{type:'content_block_start',index:0,content_block:{type:'tool_use',id:'x',name:'output_reply',input:{}}},{type:'content_block_delta',index:0,delta:{type:'input_json_delta',partial_json:json({content:'原生正文'})}},{type:'message_delta',delta:{stop_reason:'tool_use'}}];assert.match(await run(frames.map(event).join(''),init({adapterId:'anthropic-messages'})),/原生正文/);});
 await test('JSON有限修复、类型和危险字段校验',()=>{assert.equal(call('parseAiStructuredJson','{"desc":"他说"你好"。"}','object').desc,'他说"你好"。');assert.equal(call('parseAiStructuredJson','{“name”：“角色”，}','object').name,'角色');for(const bad of ['{"x":"半截','{"x":1,"x":2}','{"__proto__":{}}','{"x":"a" "y":"b"}','{"x":1} {"y":2}'])assert.throws(()=>call('parseAiStructuredJson',bad));assert.throws(()=>call('parseAiStructuredJson','[]','object'));assert.throws(()=>call('parseAiRecordArray','[{"name":"a"},null]',['name']));assert.throws(()=>call('parseAiRecordArray','[{"prompt":[]} ]',['prompt']));const original={text:'转义"\\\n😀',list:[true,false,null,1.2e3,{a:'引号'}]};assert.equal(json(call('parseAiStructuredJson',json(original))),json(original));});
 if(process.argv[2])await test('两个用户原始SSE样本',()=>{for(const name of ['克出错.txt','克正常.txt']){const raw=fs.readFileSync(path.join(process.argv[2],name),'utf8').split(/\r?\n/).map(l=>{try{return JSON.parse(l.replace(/^data:\s*/,''))?.choices?.[0]?.delta?.content||'';}catch{return '';}}).join('');assert.equal(call('parseAiStructuredJson',raw,'array').length,3);}});
 await test('HTTP400/401/403/429/500保持状态且不偷换通道',async()=>{for(const status of [400,401,403,429,500]){responder=()=>new Response('{"error":{"message":"故障"}}',{status});const n=requests.length;assert.equal((await call('fetchAiAdapterResponse',init())).status,status);assert.equal(requests.length-n,1);}});
 await test('length与MAX_TOKENS不改写为stop且不重试',async()=>{for(const reason of ['length','MAX_TOKENS']){const n=requests.length;await assert.rejects(run(event(tool(json({content:'已收到'})))+event({choices:[{delta:{},finish_reason:reason}]})),e=>e.code==='output-truncated');assert.equal(requests.length-n,1);}});
 await test('取消等待中的流会终止读取且不重试',async()=>{
   const controller=new AbortController();let cancelled=false;
   responder=()=>new Response(new ReadableStream({pull(){},cancel(){cancelled=true;}}));
   const cfg={...init(),signal:controller.signal},response=await call('fetchAiAdapterResponse',cfg),pending=response.text();
   await Promise.resolve();controller.abort(new DOMException('停止','AbortError'));
   await assert.rejects(pending,e=>e.name==='AbortError');assert.equal(cancelled,true);
 });
 await test('网络读失败不会变成成功',async()=>{responder=()=>new Response(new ReadableStream({start(s){s.enqueue(new TextEncoder().encode(event(tool('{"content":"已收到'))));},pull(s){s.error(new TypeError('network failure'));}}));await assert.rejects((await call('fetchAiAdapterResponse',init())).text(),/network failure/);});
 await test('所有文本请求入口接入统一传输、补写带首轮正文',()=>{assert.equal((source.match(/fetch\(adapterInit\.url/g)||[]).length,2);assert.ok(source.includes("msgs.concat([{ role:'assistant', content:baseText }"));assert.ok(source.includes('onTextDelta:(_delta,full) => { if (activeCharacterDraftRunId'));
   for(const label of ['const styles = parseAiRecordArray','const items = parseAiRecordArray','const lines = parseAiStructuredJson','const templates = parseAiRecordArray'])assert.ok(source.includes(label));
 });
 await test('补写复用真实前缀、格式提醒不重复',()=>{const first=call('buildAdapterRequest',request,[{role:'user',content:'输出JSON'}],{stream:true});const second=call('buildAdapterRequest',request,first.wireMessages.concat([{role:'assistant',content:'首轮'},{role:'user',content:'继续'}]),{stream:true});assert.equal(json(second.wireMessages.slice(0,first.wireMessages.length)),json(first.wireMessages));const reroll=call('buildAdapterRequest',request,first.wireMessages,{stream:true});assert.equal(json(reroll.body.messages),json(first.body.messages));});
 await test('空闲超时结束读取并清理，不无限挂起',async()=>{c.normalizeNoOutputTimeout=()=>0.02;responder=()=>new Response(new ReadableStream({pull(){}}));try{await assert.rejects((await call('fetchAiAdapterResponse',init())).text(),e=>e.name==='TimeoutError');}finally{c.normalizeNoOutputTimeout=()=>45;}});
 console.log('AI PROTOCOL PASSED:',passed);
})().catch(e=>{console.error(e);process.exitCode=1;});
