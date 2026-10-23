'use strict';
// 直接执行唯一业务源中的请求、传输、文本提取及 JSON 解析；默认离线。
const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict'), path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8');
const section=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i);assert.ok(i>=0&&j>i,'源码区段存在：'+a);return source.slice(i,j);};
let responder,passed=0;const requests=[],notices=[];
const c=vm.createContext({Response,ReadableStream,TextDecoder,TextEncoder,AbortController,DOMException,console,setTimeout,clearTimeout,
  normalizeNoOutputTimeout:()=>45,uid:()=> 'protocol-fixture-id',settings:{value:{}},connectionCredentials:{value:{}},showToast:(...a)=>notices.push(a),saveData:()=>{},
  fetch:async(url,opts)=>{requests.push({url,...opts});return responder(url,opts);},
  cleanAIResponse:t=>String(t).replace(/\x60{3}(?:json)?/g,'').trim(),
  extractResponseReasoningBlocks:t=>({body:String(t),thinking:''}),splitSnowwingCotParts:(cot,native)=>({cot,native})});
vm.runInContext(section('    function getAdapterIdForRequest(','    async function fetchAdapterCompletion(')
  +section('    function extractAiUsage(data)','    const lastWritingUsage =')
  +section('    function getAiResponseFinishReason(','    // 中文注释：判断素材主体语言')
  +section('    function isAiReasoningLikePart(','    function parseAiStreamEventPayload(')
  +section('    function extractAiResponseErrorMessage(','    async function createApiResponseError(')
  +section('    function normalizeNativeReasoningPart(','    const charactersPromptString =')
  +section('    function parseAiJsonSyntax(','    function getCharacterDraftProposedValue('),c);
const call=(n,...a)=>c[n](...a),json=JSON.stringify,event=d=>'data: '+json(d)+'\n\n';
const chunk=(content,finish_reason=null)=>({choices:[{delta:{content},finish_reason}]});
const toolChunk=(name,args,index=0,finish_reason=null)=>({choices:[{delta:{tool_calls:[{index,function:{...(name?{name}:{}),...(args!==undefined?{arguments:args}:{})}}]},finish_reason}]});
const toolResult=(content,name='output_reply')=>({choices:[{message:{content:null,tool_calls:[{id:'reply-1',type:'function',function:{name,arguments:json({content})}}]},finish_reason:'tool_calls'}]});
const request={ok:true,model:'gemini-3.8-flash',url:'https://moyun-test.invalid/v1/chat/completions',apiKey:'test-only',adapterId:'openai-compatible'};
const init=(extra={},options={stream:true})=>call('buildAdapterRequest',{...request,...extra},[{role:'user',content:'测试',_moyunUserInput:true}],options);
function wire(text,size=7){const b=new TextEncoder().encode(text);let i=0;return new Response(new ReadableStream({pull(s){if(i>=b.length)s.close();else s.enqueue(b.slice(i,i+=size));}}),{headers:{'content-type':'text/event-stream'}});}
async function run(text,cfg=init(),size=7){responder=()=>wire(text,size);return call('readAdapterResponse',await call('fetchAiAdapterResponse',cfg),{...request,adapterId:cfg.adapterId},{stream:cfg.stream});}
async function test(label,fn){await fn();passed++;console.log('PASS',label);}
async function withSettings(settings,fn){const before={...c.settings.value};Object.assign(c.settings.value,settings);try{return await fn();}finally{c.settings.value=before;}}
async function main(){
 await test('抗截断默认关闭、非Gemini及诊断请求豁免，保持流式选择',async()=>{
  for(const saved of [undefined,false,true])for(const model of ['gemini-3.8-flash','[AN]gemini-3.8-flash','other'])for(const adapterId of ['openai-chat','openai-compatible','gemini-generate','anthropic-messages'])for(const stream of [false,true])for(const diagnostic of [false,true])await withSettings({preventTruncation:saved},()=>{
   const cfg=init({model,adapterId},{stream,...(diagnostic?{useGlobalSettings:false}:{})}),enabled=saved===true&&/gemini/i.test(model)&&!diagnostic;
   assert.equal(cfg.stream,stream);assert.equal(cfg.preventTruncation,enabled);assert.equal(/output_reply/.test(json(cfg.body)),enabled);assert.equal(cfg.wireMessages[0].content,'测试');
   if(!enabled)for(const key of ['tools','tool_choice','parallel_tool_calls','toolConfig'])assert.equal(key in cfg.body,false);
   if(adapterId==='gemini-generate')assert.equal(cfg.url.includes(':streamGenerateContent'),stream);else assert.equal(cfg.body.stream,stream);
  });
 });
 await test('抗截断声明：四协议只保留唯一content工具并强制工具选择',()=>withSettings({preventTruncation:true,geminiTestInput:true},()=>{
  for(const adapterId of ['openai-chat','openai-compatible','gemini-generate','anthropic-messages']){
   const cfg=init({adapterId},{stream:true}),tools=adapterId==='gemini-generate'?cfg.body.tools[0].functionDeclarations:cfg.body.tools.map(t=>t.function || t),reply=tools.find(t=>t.name==='output_reply');
   assert.equal(tools.length,1);assert.ok(reply);assert.equal(cfg.geminiTestInput,adapterId==='gemini-generate');
   const schema=reply.parameters || reply.input_schema;assert.equal(json(schema.required),'["content"]');assert.equal(schema.properties.content.type,'string');assert.equal(schema.additionalProperties,false);
   if(adapterId==='gemini-generate'){assert.equal(cfg.body.toolConfig.functionCallingConfig.mode,'ANY');assert.ok(cfg.body.toolConfig.functionCallingConfig.allowedFunctionNames.includes('output_reply'));}
   else if(adapterId==='anthropic-messages'){assert.equal(cfg.body.tool_choice.name,'output_reply');assert.equal(cfg.body.tool_choice.disable_parallel_tool_use,true);}
   else{assert.equal(cfg.body.tool_choice.function.name,'output_reply');assert.equal(cfg.body.parallel_tool_calls,false);}
  }
 }));
 await test('Gemini测试输入仅对Gemini协议和模型生效，且不与抗截断工具冲突',()=>withSettings({geminiTestInput:true,preventTruncation:false},()=>{
  const cases=[
   [{adapterId:'gemini-generate',model:'gemini-3.8-flash'},true],
   [{adapterId:'gemini-generate',model:'other-model'},false],
   [{adapterId:'openai-compatible',model:'gemini-3.8-flash'},false],
   [{adapterId:'anthropic-messages',model:'gemini-3.8-flash'},false]
  ];
  for(const [extra,enabled] of cases){
   const cfg=init(extra),wireBody=json(cfg.body);
   assert.equal(cfg.geminiTestInput,enabled);assert.equal(cfg.sentMessages.some(m=>m.role==='tool' && m.name==='read_user_input'),enabled);assert.equal(wireBody.includes('read_user_input'),enabled);
  }
  const diagnostic=init({adapterId:'gemini-generate',model:'gemini-3.8-flash'},{useGlobalSettings:false,stream:false});
  assert.equal(diagnostic.geminiTestInput,false);assert.equal(json(diagnostic.body).includes('read_user_input'),false);
  c.settings.value.preventTruncation=true;
  const combined=init({adapterId:'gemini-generate',model:'gemini-3.8-flash'});
  assert.equal(json(combined.body.toolConfig.functionCallingConfig.allowedFunctionNames),'["output_reply"]');
  assert.equal(json(combined.body.tools[0].functionDeclarations.map(item=>item.name)),'["output_reply"]');
  const parts=combined.body.contents.flatMap(item=>item.parts || []),inputCall=parts.find(part=>part.functionCall?.name==='read_user_input'),inputResult=parts.find(part=>part.functionResponse?.name==='read_user_input');
  assert.ok(inputCall);assert.equal(inputResult.functionResponse.response.source,'user_input');assert.equal(inputResult.functionResponse.response.text,'测试');
 }));
 await test('Gemini测试输入只搬移标记的本轮作者要求，不搬移最终校验且不添加零宽前缀',()=>withSettings({geminiTestInput:true,preventTruncation:false},()=>{
  const source=[{role:'system',content:'规则'},{role:'user',content:'历史摘要'},{role:'user',content:'作者本轮剧情要求',_moyunUserInput:true},{role:'user',content:'【最终执行校验】必须停止'}];
  const out=call('obfuscateGeminiInput',source);
  assert.equal(out.filter(m=>m.role==='tool'&&m.name==='read_user_input').length,1);
  const tool=out.find(m=>m.role==='tool'&&m.name==='read_user_input');
  assert.equal(JSON.parse(tool.content).text,'作者本轮剧情要求');
  assert.equal(out.find(m=>m.content==='【最终执行校验】必须停止').content,'【最终执行校验】必须停止');
  assert.ok(!String(out.find(m=>m.role==='user'&&String(m.content).includes('读取 read_user_input')).content).match(/[\u200B\u200C\u200D\u2060]/));
  }));
  await test('Gemini无明确作者输入时不猜测最后一条user层',()=>withSettings({geminiTestInput:true,preventTruncation:false},()=>{
   const source=[{role:'system',content:'规则'},{role:'user',content:'前文'},{role:'user',content:'【最终执行校验】只输出正文'}];
   const out=call('obfuscateGeminiInput',source);
   assert.equal(out.some(m=>m.role==='tool'&&m.name==='read_user_input'),false);
   assert.equal(JSON.stringify(out),JSON.stringify(source));
  }));
  await test('Gemini抗截断与输入工具同时启用时，提醒位于原版占位用户层',()=>withSettings({geminiTestInput:true,preventTruncation:true},()=>{
  const cfg=init({adapterId:'gemini-generate',model:'gemini-3.8-flash'});
  const placeholder=cfg.sentMessages.find(m=>m.role==='user'&&String(m.content).includes('读取 read_user_input'));
  assert.ok(placeholder);assert.match(placeholder.content,/output_reply/);
  assert.equal(cfg.body.contents.filter(item=>item.parts?.some(part=>part.functionCall?.name==='read_user_input')).length,1);
 }));
 await test('全局温度覆盖模块固定值、旧存档默认及范围归一化，诊断保留局部值',()=>withSettings({temperature:0.37,reasoningEffort:'',preventTruncation:false},()=>{
  for(const adapterId of ['openai-chat','openai-compatible','gemini-generate','anthropic-messages']){
   const body=init({adapterId},{temperature:0.9,maxTokens:100}).body;assert.equal(adapterId==='gemini-generate'?body.generationConfig.temperature:body.temperature,0.37);
   const diagnostic=init({adapterId},{temperature:0,useGlobalSettings:false,maxTokens:16}).body;assert.equal(adapterId==='gemini-generate'?diagnostic.generationConfig.temperature:diagnostic.temperature,0);
   const omitted=init({adapterId},{omitTemperature:true}).body;assert.equal(adapterId==='gemini-generate'?omitted.generationConfig.temperature:omitted.temperature,undefined);
  }
  for(const [saved,expected]of [[undefined,1],[-2,0],[3,1],['bad',1]]){c.settings.value.temperature=saved;assert.equal(init().body.temperature,expected);}
 }));
 await test('全局六档强度使用对应协议字段，默认与诊断不传，Anthropic预算与温度兼容',()=>withSettings({temperature:0.37,preventTruncation:false},()=>{
  for(const effort of ['','none','low','medium','high','max']){
   c.settings.value.reasoningEffort=effort;
   const open=init().body,gemini=init({adapterId:'gemini-generate'}).body,legacy=init({adapterId:'gemini-generate',model:'gemini-2.5-flash'}).body,anthropic=init({adapterId:'anthropic-messages'},{maxTokens:100}).body;
   assert.equal(open.reasoning_effort,effort || undefined);
   if(!effort){assert.equal(gemini.generationConfig.thinkingConfig,undefined);assert.equal(anthropic.thinking,undefined);}
   else{assert.ok(gemini.generationConfig.thinkingConfig.thinkingLevel);assert.ok(Number.isInteger(legacy.generationConfig.thinkingConfig.thinkingBudget));assert.equal(anthropic.thinking.type,effort==='none'?'disabled':'enabled');if(effort!=='none'){assert.ok(anthropic.max_tokens>anthropic.thinking.budget_tokens);assert.equal(anthropic.temperature,undefined);}}
   const diagnostic=init({},{useGlobalSettings:false,temperature:0,maxTokens:16}).body;assert.equal(diagnostic.reasoning_effort,undefined);assert.equal(diagnostic.max_tokens,16);
  }
 }));
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
 await test('抗截断工具非流式：四种协议恢复完整正文、不泄漏JSON外壳',()=>withSettings({preventTruncation:true},async()=>{
  const expected='正文\n"引号"\\路径\t😀𠮷\n[IMG: snow, night]';
  for(const adapterId of ['openai-chat','openai-compatible','gemini-generate','anthropic-messages']){
   const raw=adapterId==='gemini-generate'?{candidates:[{content:{parts:[{functionCall:{name:'output_reply',args:{content:expected}}}]},finishReason:'STOP'}]}:adapterId==='anthropic-messages'?{content:[{type:'tool_use',id:'reply-1',name:'output_reply',input:{content:expected}}],stop_reason:'tool_use'}:toolResult(expected);
   const result=await run(json(raw),init({adapterId},{stream:false}),1);assert.equal(result.rawText,expected);assert.doesNotMatch(result.rawText,/output_reply|"content"\s*:/);
  }
 }));
 await test('抗截断工具流：工具名、参数和Unicode转义逐字符跨块，UTF8逐字节',()=>withSettings({preventTruncation:true},async()=>{
  const expected='甲\n\n"乙"\\/\t😀𠮷',args=json({content:expected}).replace('😀','\\ud83d\\ude00').replace('𠮷','\\ud842\\udfb7');
  const raw=[...('output_reply')].map(name=>event(toolChunk(name,undefined))).join('')+[...args].map(part=>event(toolChunk('',part))).join('')+event({choices:[{delta:{},finish_reason:'tool_calls'}]});
  const result=await run(raw,init(),1);assert.equal(result.rawText,expected);
 }));
 await test('抗截断原生流：Gemini函数调用与Anthropic参数分段均恢复正文',()=>withSettings({preventTruncation:true},async()=>{
  const expected='原生\n😀';
  const gemini=event({candidates:[{content:{parts:[{functionCall:{name:'output_reply',args:{content:expected}}}]},finishReason:'STOP'}]});
  assert.equal((await run(gemini,init({adapterId:'gemini-generate'}),1)).rawText,expected);
  const anthropic=[{type:'content_block_start',index:0,content_block:{type:'tool_use',id:'reply-1',name:'output_reply',input:{}}},...[...json({content:expected})].map(part=>({type:'content_block_delta',index:0,delta:{type:'input_json_delta',partial_json:part}})),{type:'message_delta',delta:{stop_reason:'tool_use'}}];
  assert.equal((await run(anthropic.map(event).join(''),init({adapterId:'anthropic-messages'}),1)).rawText,expected);
 }));
 await test('抗截断正文在工具参数完成前增量交付，不输出半个Unicode代理对',()=>withSettings({preventTruncation:true},async()=>{
  let release,count=0;const gate=new Promise(r=>release=r);
  responder=()=>new Response(new ReadableStream({async pull(s){if(++count===1)s.enqueue(new TextEncoder().encode(event(toolChunk('output_reply','{"content":"先到\\ud83d'))));else if(count===2){await gate;s.enqueue(new TextEncoder().encode(event(toolChunk('','\\ude00后到"}'))+event({choices:[{delta:{},finish_reason:'tool_calls'}]})));s.close();}}}),{headers:{'content-type':'text/event-stream'}});
  const reader=(await call('fetchAiAdapterResponse',init())).body.getReader();let first='',tail='';
  try{for(let i=0;i<4&&!first.includes('先到');i++){let timer;const next=await Promise.race([reader.read(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('工具正文未增量交付')),1000);})]).finally(()=>clearTimeout(timer));first+=new TextDecoder().decode(next.value);}assert.match(first,/先到/);assert.doesNotMatch(first,/\\ud83d/i);}finally{release();}
  while(true){const next=await reader.read();if(next.done)break;tail+=new TextDecoder().decode(next.value);}
  const text=(first+tail).split('\n').filter(l=>l.startsWith('data: ')).map(l=>JSON.parse(l.slice(6))).map(d=>d.choices?.[0]?.delta?.content || '').join('');assert.equal(text,'先到😀后到');
 }));
 await test('抗截断混返优先工具正文、不重复普通正文；无工具时普通累积正文兜底',()=>withSettings({preventTruncation:true},async()=>{
  const mixed=event(chunk('普通重复内容'))+event(toolChunk('output_reply',json({content:'工具正文'})))+event(chunk('普通尾部','stop'));
  assert.equal((await run(mixed)).rawText,'工具正文');
  const raw=['甲','甲乙','甲乙丙'].map(content=>event({choices:[{message:{content}}]})).join('');assert.equal((await run(raw)).rawText,'甲乙丙');
 }));
 await test('抗截断重复、未知工具、无可保留正文与错误结构均拒绝且不重试',()=>withSettings({preventTruncation:true},async()=>{
  const cases=[
   [event(toolChunk('output_reply',json({content:'甲'}),0))+event(toolChunk('output_reply',json({content:'乙'}),1)),'reply-tool'],
   [event(toolChunk('unknown',json({content:'甲'}))),'reply-tool'],
   [event(toolChunk('output_reply','{"content":"')),'reply-json'],
   [event(toolChunk('output_reply',json({content:42}))),'reply-schema'],
   [event(toolChunk('output_reply',json({content:'甲',extra:true}))),'reply-schema'],
   [event(toolChunk('output_reply',json({content:''}))),'reply-schema']
  ];
   for(const [raw,code]of cases){const before=requests.length;await assert.rejects(run(raw),e=>e.code===code,'expected '+code+' for '+raw.slice(0,100));assert.equal(requests.length-before,1);}
 }));
 await test('抗截断工具JSON尾部缺失时保留已解码正文，混合正文不重复',()=>withSettings({preventTruncation:true},async()=>{
  const partial=event(toolChunk('output_reply','{"content":"已经收到的正文'))+event({choices:[{delta:{},finish_reason:'tool_calls'}]});
  assert.equal((await run(partial)).rawText,'已经收到的正文');
  const mixed=event(chunk('普通预览'))+event(toolChunk('output_reply','{"content":"工具正文'))+event({choices:[{delta:{},finish_reason:'tool_calls'}]});
  assert.equal((await run(mixed)).rawText,'工具正文');
  const unknown=event(chunk('普通预览'))+event(toolChunk('other_tool','{"x":1}'))+event({choices:[{delta:{},finish_reason:'tool_calls'}]});
  await assert.rejects(run(unknown),e=>e.code==='reply-tool' && e.partialText==='普通预览');
 }));
 await test('抗截断跨四协议和流式模式尽量保留length、MAX_TOKENS正文',()=>withSettings({preventTruncation:true},async()=>{
  for(const adapterId of ['openai-chat','openai-compatible','gemini-generate','anthropic-messages'])for(const stream of [false,true])for(const reason of ['length','MAX_TOKENS']){
   const cfg=init({adapterId},{stream}),wire=adapterId==='gemini-generate'
    ? event({candidates:[{content:{parts:[{functionCall:{name:'output_reply',args:{content:'预览'}}} ]},finishReason:reason}]})
    : adapterId==='anthropic-messages'
     ? [event({type:'content_block_start',index:0,content_block:{type:'tool_use',id:'reply-1',name:'output_reply',input:{content:'预览'}}}),event({type:'message_delta',delta:{stop_reason:reason}})].join('')
     : event(toolChunk('output_reply',json({content:'预览'})))+event({choices:[{delta:{},finish_reason:reason}]});
   const result=await run(wire,cfg);assert.equal(result.rawText,'预览',adapterId+' '+stream+' '+reason);assert.equal(result.truncated,false);assert.notEqual(result.finishReason,reason);
  }
  // 已收普通正文在工具回退路径中也可保存；普通非抗截断请求仍严格拒绝。
  for(const reason of ['length','MAX_TOKENS'])assert.equal((await run(event({choices:[{message:{content:'已收到'}}]})+event(chunk('',reason)))).rawText,'已收到');
  for(const reason of ['length','MAX_TOKENS'])await assert.rejects(run(event({choices:[{message:{content:'已收到'}}]})+event(chunk('',reason)),init({model:'other-model'})),e=>e.code==='output-truncated');
  for(const [tail,code]of [[event(chunk('','content_filter')),'api-refusal'],[event({error:{message:'限流'}}),'api-payload']]){
   const before=requests.length;await assert.rejects(run(event(toolChunk('output_reply',json({content:'预览'})))+tail),e=>e.code===code);assert.equal(requests.length-before,1);
  }
  responder=()=>new Response(new ReadableStream({start(s){s.enqueue(new TextEncoder().encode(event(toolChunk('output_reply','{"content":"预览'))));},pull(s){s.error(new TypeError('network failure'));}}));
  const before=requests.length;await assert.rejects((await call('fetchAiAdapterResponse',init())).text(),/network failure/);assert.equal(requests.length-before,1);
 }));
 await test('抗截断真正空回最多三次，第二次成功可恢复，思考空回不重试',()=>withSettings({preventTruncation:true},async()=>{
  for(const stream of [false,true]){
   const before=requests.length;await assert.rejects(run(event(chunk('','stop')),init({},{stream})),e=>e.code==='empty-response');assert.equal(requests.length-before,3);
  }
  let count=0;responder=()=>wire(++count===1?event(chunk('','stop')):event(toolChunk('output_reply',json({content:'重试后正文'}))));
  const result=await call('readAdapterResponse',await call('fetchAiAdapterResponse',init()),request,{stream:true});assert.equal(result.rawText,'重试后正文');assert.equal(count,2);
  const before=requests.length;await assert.rejects(run(event({choices:[{delta:{reasoning_content:'仅思考'},finish_reason:'stop'}]})),e=>e.code==='empty-response');assert.equal(requests.length-before,1);
 }));
 await test('抗截断取消仍终止等待中的底层流且不重试',()=>withSettings({preventTruncation:true},async()=>{
  const controller=new AbortController();let cancelled=false;
  responder=()=>new Response(new ReadableStream({pull(){},cancel(){cancelled=true;}}));const before=requests.length;
  const pending=(await call('fetchAiAdapterResponse',{...init(),signal:controller.signal})).text();await Promise.resolve();controller.abort(new DOMException('停止','AbortError'));await assert.rejects(pending,e=>e.name==='AbortError');assert.equal(cancelled,true);assert.equal(requests.length-before,1);
 }));
 console.log('AI PROTOCOL PASSED:',passed);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={c,call,request,setResponder:fn=>{responder=fn;}};
