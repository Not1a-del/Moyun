'use strict';
// 直接执行唯一业务源中的请求、传输、文本提取及 JSON 解析；默认离线。
const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict'), path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8');
const section=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i);assert.ok(i>=0&&j>i,'源码区段存在：'+a);return source.slice(i,j);};
let responder,passed=0;const requests=[],notices=[];
const c=vm.createContext({Response,ReadableStream,TextDecoder,TextEncoder,AbortController,DOMException,console,setTimeout,clearTimeout,
  normalizeNoOutputTimeout:()=>45,settings:{value:{}},connectionCredentials:{value:{}},showToast:(...a)=>notices.push(a),saveData:()=>{},
  fetch:async(url,opts)=>{requests.push({url,...opts});return responder(url,opts);},
  cleanAIResponse:t=>String(t).replace(/\x60{3}(?:json)?/g,'').trim(),
  extractResponseReasoningBlocks:t=>({body:String(t),thinking:''}),splitSnowwingCotParts:(cot,native)=>({cot,native})});
vm.runInContext(section('    function getAdapterIdForRequest(','    async function fetchAdapterCompletion(')
  +section('    function getAiResponseFinishReason(','    // 中文注释：判断素材主体语言')
  +section('    function isAiReasoningLikePart(','    function parseAiStreamEventPayload(')
  +section('    function extractAiResponseErrorMessage(','    async function createApiResponseError(')
  +section('    function normalizeNativeReasoningPart(','    const charactersPromptString =')
  +section('    function parseAiJsonSyntax(','    function getCharacterDraftProposedValue('),c);
const call=(n,...a)=>c[n](...a),json=JSON.stringify,event=d=>'data: '+json(d)+'\n\n';
const chunk=(content,finish_reason=null)=>({choices:[{delta:{content},finish_reason}]});
const request={ok:true,model:'gemini-3.8-flash',url:'https://moyun-test.invalid/v1/chat/completions',apiKey:'test-only',adapterId:'openai-compatible'};
const init=(extra={},options={stream:true})=>call('buildAdapterRequest',{...request,...extra},[{role:'user',content:'测试'}],options);
function wire(text,size=7){const b=new TextEncoder().encode(text);let i=0;return new Response(new ReadableStream({pull(s){if(i>=b.length)s.close();else s.enqueue(b.slice(i,i+=size));}}),{headers:{'content-type':'text/event-stream'}});}
async function run(text,cfg=init(),size=7){responder=()=>wire(text,size);return call('readAdapterResponse',await call('fetchAiAdapterResponse',cfg),{...request,adapterId:cfg.adapterId},{stream:cfg.stream});}
async function test(label,fn){await fn();passed++;console.log('PASS',label);}
async function main(){
 await test('抗截断入口已移除；旧开关对所有模型、四种协议和流式选择不再生效',()=>{
  assert.doesNotMatch(source,/geminiReplyInTool|output_reply|createReplyToolDecoder|toggleGeminiReply/);
  for(const saved of [null,true,false])for(const model of ['gemini-3.8-flash','[AN]gemini-3.8-flash','other'])for(const adapterId of ['openai-chat','openai-compatible','gemini-generate','anthropic-messages'])for(const stream of [false,true]){
   c.settings.value.geminiReplyInTool=saved;const cfg=init({model,adapterId},{stream});assert.equal(cfg.stream,stream);
   for(const key of ['tools','tool_choice','parallel_tool_calls','toolConfig'])assert.equal(key in cfg.body,false);
   assert.doesNotMatch(json(cfg.body),/output_reply/);assert.equal(cfg.wireMessages[0].content,'测试');
   if(adapterId==='gemini-generate')assert.equal(cfg.url.includes(':streamGenerateContent'),stream);else assert.equal(cfg.body.stream,stream);
  }delete c.settings.value.geminiReplyInTool;
 });
 await test('原消息不变，普通请求不强制流式',()=>{const m=[{role:'user',content:'原文'}];assert.equal(call('buildAdapterRequest',request,m,{stream:false}).body.stream,false);assert.equal(m[0].content,'原文');});
 await test('真实消费者保留分段、转义、Unicode和逐字节UTF8',async()=>{const expected='甲\n\n"乙"\\/\t😀𠮷';const result=await run([...expected].map(t=>event(chunk(t))).join('')+event(chunk('','stop')),init(),1);assert.equal(result.rawText,expected);assert.equal(result.finishReason,'stop');});
 await test('完成前真实流式交付',async()=>{let release,count=0;const gate=new Promise(r=>release=r);responder=()=>new Response(new ReadableStream({async pull(s){if(++count===1)s.enqueue(new TextEncoder().encode(event(chunk('先到'))));else{await gate;s.enqueue(new TextEncoder().encode(event(chunk('后到','stop'))));s.close();}}}));const r=(await call('fetchAiAdapterResponse',init())).body.getReader();try{assert.match(new TextDecoder().decode((await r.read()).value),/先到/);}finally{release();}while(!(await r.read()).done){};});
 await test('末尾无换行、多行SSE、缺事件空行',async()=>{const text='data: {"choices":\ndata: [{"delta":{"content":"甲"}}]}\n'+event(chunk('乙','stop')).trimEnd();assert.equal((await run(text)).text,'甲乙');});
 await test('非流式JSON及流式请求收到JSON均能读取',async()=>{const raw=json({choices:[{message:{content:'普通正文'},finish_reason:'stop'}]});assert.equal((await run(raw,init({},{stream:false}))).text,'普通正文');assert.equal((await run(raw)).text,'普通正文');});
 await test('累积式正文不重复追加',async()=>{const raw=['甲','甲乙','甲乙丙'].map(content=>event({choices:[{message:{content}}]})).join('');assert.equal((await run(raw)).text,'\u7532\u4e59\u4e19');});
 await test('原生思考保持独立，不混入正文',async()=>{const result=await run(event({choices:[{delta:{reasoning_content:'分析'}}]})+event(chunk('正文','stop')));assert.equal(result.text,'正文');assert.equal(result.nativeThinking,'分析');});
 for(const [label,text,code] of [
  ['HTTP200错误',event({error:{message:'rate limit'}}),'api-payload'],['过滤',event(chunk('','content_filter')),'api-refusal'],
  ['拒绝',event({choices:[{delta:{refusal:'拒绝'}}]}),'api-refusal'],['损坏SSE','data: {"choices":','sse-json'],['空响应','','empty-response']
 ])await test(label+'不伪装成功且不工具重试',async()=>{const n=requests.length;await assert.rejects(run(text),e=>e.code===code);assert.equal(requests.length-n,1);});
 await test('空正文与思考空回均只请求一次',async()=>{for(const raw of [event(chunk('','stop')),event({choices:[{delta:{reasoning_content:'思考'},finish_reason:'stop'}]})]){const n=requests.length,result=await run(raw);assert.equal(result.text,'');assert.equal(requests.length-n,1);}});
 await test('Gemini原生普通文本',async()=>{const raw=event({candidates:[{content:{parts:[{text:'原生正文'}]},finishReason:'STOP'}]});assert.equal((await run(raw,init({adapterId:'gemini-generate'}))).text,'原生正文');});
 await test('Anthropic原生普通文本',async()=>{const frames=[{type:'content_block_delta',index:0,delta:{type:'text_delta',text:'原生正文'}},{type:'message_delta',delta:{stop_reason:'end_turn'}}];assert.equal((await run(frames.map(event).join(''),init({adapterId:'anthropic-messages'}))).text,'原生正文');});
 await test('JSON有限修复、类型和危险字段校验保持有效',()=>{assert.equal(call('parseAiStructuredJson','{"desc":"他说"你好"。"}','object').desc,'他说"你好"。');assert.equal(call('parseAiStructuredJson','{“name”：“角色”，}','object').name,'角色');for(const bad of ['{"x":"半截','{"x":1,"x":2}','{"__proto__":{}}','{"x":"a" "y":"b"}','{"x":1} {"y":2}'])assert.throws(()=>call('parseAiStructuredJson',bad));assert.throws(()=>call('parseAiStructuredJson','[]','object'));assert.throws(()=>call('parseAiRecordArray','[{"name":"a"},null]',['name']));assert.throws(()=>call('parseAiRecordArray','[{"prompt":[]}]',['prompt']));const original={text:'转义"\\\n😀',list:[true,false,null,1.2e3,{a:'引号'}]};assert.equal(json(call('parseAiStructuredJson',json(original))),json(original));});
 await test('HTTP错误保持状态且不额外重发',async()=>{for(const status of [400,401,403,429,500]){responder=()=>new Response('{"error":{"message":"故障"}}',{status});const n=requests.length;assert.equal((await call('fetchAiAdapterResponse',init())).status,status);assert.equal(requests.length-n,1);}});
 await test('length与MAX_TOKENS报错且不重试',async()=>{for(const reason of ['length','MAX_TOKENS']){const n=requests.length;await assert.rejects(run(event(chunk('已收到'))+event(chunk('',reason))),e=>e.code==='output-truncated');assert.equal(requests.length-n,1);}});
 await test('取消等待中的流会终止读取',async()=>{const controller=new AbortController();let cancelled=false;responder=()=>new Response(new ReadableStream({pull(){},cancel(){cancelled=true;}}));const pending=(await call('fetchAiAdapterResponse',{...init(),signal:controller.signal})).text();await Promise.resolve();controller.abort(new DOMException('停止','AbortError'));await assert.rejects(pending,e=>e.name==='AbortError');assert.equal(cancelled,true);});
 await test('网络读失败不会变成成功',async()=>{responder=()=>new Response(new ReadableStream({start(s){s.enqueue(new TextEncoder().encode(event(chunk('已收到'))));},pull(s){s.error(new TypeError('network failure'));}}));await assert.rejects((await call('fetchAiAdapterResponse',init())).text(),/network failure/);});
 await test('二轮首轮正文、JSON提醒复用和业务字段校验保留',()=>{assert.ok(source.includes("msgs.concat([{ role:'assistant', content:baseText }"));for(const label of ['const styles = parseAiRecordArray','const items = parseAiRecordArray','const lines = parseAiStructuredJson','const templates = parseAiRecordArray'])assert.ok(source.includes(label));const first=call('buildAdapterRequest',request,[{role:'user',content:'输出JSON'}],{stream:true});const second=call('buildAdapterRequest',request,first.wireMessages.concat([{role:'assistant',content:'首轮'},{role:'user',content:'继续'}]),{stream:true});assert.equal(json(second.wireMessages.slice(0,first.wireMessages.length)),json(first.wireMessages));assert.equal(json(call('buildAdapterRequest',request,first.wireMessages,{stream:true}).body.messages),json(first.body.messages));});
 await test('空闲超时结束读取并清理',async()=>{c.normalizeNoOutputTimeout=()=>0.02;responder=()=>new Response(new ReadableStream({pull(){}}));try{await assert.rejects((await call('fetchAiAdapterResponse',init())).text(),e=>e.name==='TimeoutError');}finally{c.normalizeNoOutputTimeout=()=>45;}});
 console.log('AI PROTOCOL PASSED:',passed);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={c,call,request,setResponder:fn=>{responder=fn;}};
