'use strict';
// Offline fetch replacement; response framing follows ai-protocol-regression.cjs.
const MODES = ['valid','fenced','prose','trailing-comma','curly-quotes','single-quotes','missing-optional','missing-required','wrong-types','truncated','nonsense','refusal','html','empty','whitespace','missing-end-marker','duplicate-markers','nested-markers','failure','401','429','timeout'];
function inferTask(body) {
  if(body.taskType || body.metadata?.taskType)return body.taskType || body.metadata.taskType;
  const prompt = JSON.stringify(body);
  const rules = [['plan',/你是策划员|拆分方案/],['characters',/你是角色员/],['settings',/你是设定员/],['team-outline',/你是大纲卷纲员/],['continuity-adjust',/你是小说衔接编辑/],['continuity',/你是小说衔接检查员/],['details',/你是细纲员|逐章输出|生成.*细纲/],['review',/你是审查员|审查结果/],['volumes',/卷纲规划|规划.*卷纲/],['expansion',/扩写|新内容开始/],['summary',/摘要|总结/]];
  return rules.find(([,pattern])=>pattern.test(prompt))?.[0] || 'writing';
}
function taskResult(task,body={}) {
  const prompt = JSON.stringify(body), range = prompt.match(/(?:只生成|范围[:：]?)?第?\s*(\d+)\s*[-~至到]\s*(\d+)\s*章/);
  const from = range ? Number(range[1]) : 1, to = range ? Number(range[2]) : 10;
  const rows = Array.from({length:Math.min(200,Math.max(1,to-from+1))},(_,i)=>({chapterNo:from+i,title:'航标'+(from+i),content:'林舟收好铜钥匙，和沈禾继续调查雾港。',characterIds:['char-1','char-2']}));
  const volumes = [{number:1,title:'雾港',startChapter:from,endChapter:to,summary:'调查航路。',writingRequirement:'保留钥匙线索。',bridge:'发现旧码头。'}];
  if(/plan|Planner/.test(task))return {titleCandidates:['雾港寻灯'],genre:'悬疑',tone:'温暖',userFacts:[{text:'林舟寻找守灯人。',source:'用户'}],characters:[{name:'林舟',summary:'修灯师'},{name:'沈禾',summary:'领航员'}],volumes,chapterCount:to,unfinishedMode:false,uncertainties:[]};
  if(/character/.test(task))return {characters:[{name:'林舟',desc:'成年修灯师。',personalityTags:['谨慎'],speakingStyle:'直白',exampleDialogues:['等潮水退去再走。'],relationships:[],characterPrompt:'保管铜钥匙。'}]};
  if(/settings/.test(task))return {title:'雾港寻灯',synopsis:'寻找守灯人。',worldView:'潮汐决定航路。',negativePrompt:''};
  if(task==='team-outline')return {outline:'调查雾港旧案，找到守灯人。',volumes,chapterIndexDrafts:rows.map(({chapterNo,title})=>({chapterNo,title,goal:'寻找线索'}))};
  if(/volume/.test(task))return volumes;
  if(/detail/.test(task))return rows.map(row=>'## 第'+row.chapterNo+'章 '+row.title+'\n'+row.content+'\n【无问题】').join('\n\n');
  if(task==='continuity-adjust')return rows;
  if(/continuity/.test(task))return '【无问题】';
  if(/review/.test(task))return {summary:'设定和章节范围一致。',issues:[],changes:[]};
  if(/expan/.test(task))return '【新内容开始】林舟擦去钥匙上的盐霜，抬头确认灯塔的方向。【新内容结束】';
  if(/summary/.test(task))return '林舟和沈禾在雾港检查航标，铜钥匙仍由林舟保管。';
  if(task==='records')return rows;
  return '林舟沿着潮湿的石阶走向灯塔。沈禾跟在身后，远处的钟声仍在回响。';
}
function responseText(task,mode='valid',body={}) {
  const result = taskResult(task,body), json = typeof result==='string' ? result : JSON.stringify(result);
  const fence = String.fromCharCode(96).repeat(3);
  if(mode==='fenced')return '好的，以下是结果：\n'+fence+'json\n'+json+'\n'+fence+'\n请查收。';
  if(mode==='prose')return '好的，以下是结果：\n'+json+'\n以上内容供参考。';
  if(mode==='trailing-comma')return json.replace(/([}\]])/g,',$1');
  if(mode==='curly-quotes') {let open=true;return json.replace(/"/g,()=>{const mark=open?'“':'”';open=!open;return mark;});}
  if(mode==='single-quotes')return json.replace(/"/g,"'");
  if(mode==='missing-optional')return JSON.stringify([{chapterNo:1,title:'航标',content:'林舟调查雾港。'}]);
  if(mode==='missing-required')return JSON.stringify(Array.from({length:10},(_,i)=>i===4?{chapterNo:i+1,title:'需补'}:{chapterNo:i+1,title:'航标'+(i+1),content:'林舟调查雾港。'}));
  if(mode==='wrong-types')return JSON.stringify([{chapterNo:'第3章',title:'航标',content:'林舟调查雾港。',characterIds:'a、b、c'}]);
  if(mode==='truncated')return '[{"chapterNo":1,"title":"航标","content":"完整第一项"},{"chapterNo":2,"content":"被截断';
  if(mode==='nonsense')return '我们先认真思考一下，再讨论更合适的安排。';
  if(mode==='refusal')return '抱歉，我无法完成这个请求，请改写要求或更换模型。';
  if(mode==='html')return '<!doctype html><html><body>502 Bad Gateway</body></html>';
  if(mode==='empty')return '';
  if(mode==='whitespace')return ' \n\t ';
  if(mode==='missing-end-marker')return '【新内容开始】林舟在灯塔前停下脚步。';
  if(mode==='duplicate-markers')return '【新内容开始】第一份内容。【新内容结束】\n【新内容开始】第二份内容。【新内容结束】';
  if(mode==='nested-markers')return '【新内容开始】外层内容。【新内容开始】内层内容。【新内容结束】外层结尾。【新内容结束】';
  return json;
}
function createFakeAi(options={}) {
  const requests = [], aliases = {'F-01':'valid','F-02':'fenced','F-03':'trailing-comma','F-04':'missing-optional','F-05':'missing-required','F-06':'wrong-types','F-07':'truncated','F-08':'nonsense','F-09':'refusal','F-10':'html','F-11':'missing-end-marker','F-12':'duplicate-markers'};
  function abortError(signal) {return signal?.reason instanceof Error ? signal.reason : new DOMException('测试请求已停止','AbortError');}
  async function wait(ms,signal,timeout=false) {
    if(signal?.aborted)throw abortError(signal);
    await new Promise((resolve,reject)=>{
      const finish = error=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve();};
      const abort = ()=>finish(abortError(signal));
      const timer = setTimeout(()=>finish(timeout?new DOMException('模拟请求超时','TimeoutError'):null),ms);
      signal?.addEventListener('abort',abort,{once:true});
    });
  }
  async function fakeFetch(input,init={}) {
    const url = String(input?.url || input), raw = init.body ?? (typeof input?.clone==='function'?await input.clone().text():'{}');
    let body;try {body=typeof raw==='string'?JSON.parse(raw):raw;}catch {body={prompt:String(raw)};}
    const task = options.taskType || inferTask(body), sequence = options.sequence?.[requests.length];
    const selected = sequence ?? options.routes?.[task] ?? options.mode ?? 'valid';
    const config = typeof selected==='object' ? selected : {mode:selected}; const mode = aliases[config.mode] || config.mode || 'valid';
    const signal = init.signal || input?.signal;
    const record = {sequence:requests.length+1,url,method:init.method || input?.method || 'POST',taskType:task,mode,body,prompt:JSON.stringify(body),startedAt:Date.now()}; requests.push(record);
    try {
      await wait(config.delayMs ?? options.delayMs ?? 0,signal);
      if(mode==='timeout')await wait(config.timeoutMs ?? options.timeoutMs ?? 50,signal,true);
      if(mode==='failure')throw new TypeError('模拟网络连接失败');
      const status = mode==='401'?401:mode==='429'?429:config.status || 200;
      record.status = status;
      if(status!==200)return new Response(JSON.stringify({error:{message:status===401?'测试密钥无效':status===429?'测试请求过于频繁':'模拟服务失败'}}),{status,headers:{'content-type':'application/json',...(status===429?{'retry-after':'1'}:{})}});
      const text = config.text ?? options.responses?.[task] ?? responseText(task,mode,body); record.responseText = text;
      if(mode==='html')return new Response(text,{headers:{'content-type':'text/html'}});
      const anthropic = /\/messages(?:\?|$)/.test(url), gemini = /:(?:streamGenerateContent|generateContent)/.test(url);
      const streamed = body.stream===true || url.includes(':streamGenerateContent');
      if(!streamed) {
        const payload = gemini?{candidates:[{content:{role:'model',parts:[{text}]},finishReason:mode==='truncated'?'MAX_TOKENS':'STOP'}]}:anthropic?{type:'message',role:'assistant',content:[{type:'text',text}],stop_reason:mode==='truncated'?'max_tokens':'end_turn'}:{choices:[{message:{role:'assistant',content:text},finish_reason:mode==='truncated'?'length':'stop'}]};
        return new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}});
      }
      const event = payload=>'data: '+JSON.stringify(payload)+'\n\n';
      let wire = '';
      if(anthropic)wire += 'event: content_block_start\n'+event({type:'content_block_start',index:0,content_block:{type:'text',text:''}});
      const characters = Array.from(text), chunkSize = config.chunkSize || options.chunkSize || 7;
      for(let i=0;i<characters.length;i+=chunkSize) {
        const chunk = characters.slice(i,i+chunkSize).join('');
        wire += anthropic?'event: content_block_delta\n'+event({type:'content_block_delta',index:0,delta:{type:'text_delta',text:chunk}}):gemini?event({candidates:[{content:{role:'model',parts:[{text:chunk}]}}]}):event({choices:[{delta:{content:chunk},finish_reason:null}]});
      }
      wire += anthropic?'event: message_delta\n'+event({type:'message_delta',delta:{stop_reason:mode==='truncated'?'max_tokens':'end_turn'}})+'event: message_stop\n'+event({type:'message_stop'}):gemini?event({candidates:[{finishReason:mode==='truncated'?'MAX_TOKENS':'STOP'}]}):event({choices:[{delta:{},finish_reason:mode==='truncated'?'length':'stop'}]})+'data: [DONE]\n\n';
      const bytes = new TextEncoder().encode(wire); let offset = 0;
      const stream = new ReadableStream({pull(controller){if(signal?.aborted)return controller.error(abortError(signal));if(offset>=bytes.length)controller.close();else controller.enqueue(bytes.slice(offset,offset+=config.wireChunkSize || options.wireChunkSize || 13));}});
      return new Response(stream,{headers:{'content-type':'text/event-stream'}});
    }catch(error){record.error={name:error.name,message:error.message};throw error;}
  }
  function install(target=globalThis) {
    const original = target.fetch;
    target.fetch = (input,init)=>/\/(?:chat\/completions|messages)(?:\?|$)|:(?:streamGenerateContent|generateContent)/.test(String(input?.url || input))?fakeFetch(input,init):original.call(target,input,init);
    return ()=>{target.fetch=original;};
  }
  return {fetch:fakeFetch,requests,install,reset(){requests.length=0;}};
}
function browserFakeAiScript(options={}) {
  return [inferTask,taskResult,responseText,createFakeAi].map(fn=>fn.toString()).join(';')+';globalThis.__v19FakeAi=createFakeAi('+JSON.stringify(options)+');globalThis.__v19FakeAi.install(globalThis);';
}
function writeRequestLog(fake,file) {require('node:fs').writeFileSync(file,JSON.stringify(fake.requests,null,2)+'\n');}
module.exports = {MODES,inferTask,taskResult,responseText,createFakeAi,browserFakeAiScript,writeRequestLog};

