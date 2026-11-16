'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const test = require('node:test'), assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../source/moyun.single.html'), 'utf8');
function extract(from, to) { const a = source.indexOf(from), b = source.indexOf(to, a); assert.ok(a >= 0 && b > a, from); return source.slice(a, b); }
function aiContext(extra = {}) {
  const ctx = vm.createContext({ cleanAIResponse:text=>String(text).trim(), showToast:()=>{}, ref:value=>({ value }), AbortController, DOMException, navigator:{ clipboard:{ writeText:async()=>{} } }, ...extra });
  vm.runInContext(extract('    function parseAiJsonSyntax(', '    function parseCharacterAiJsonEnvelope(') + '; globalThis.history = aiRawResponseHistory;', ctx);
  return ctx;
}
test('G1 extracts complete root before trailing prose and tolerates quote variants', () => {
  const ctx = aiContext();
  const result = ctx.parseAiStructured("好的：[{“name”:“林远”,'content':'窗外下雨。',},] 后面不是 JSON");
  assert.equal(result.value[0].content, '窗外下雨。');
});
test('G1 salvages nested complete records from truncated arrays and validates defaults and types', () => {
  const ctx = aiContext();
  const raw = '[{"chapterNo":"第3章","content":"正文","tags":"甲、乙","meta":{"note":"含 } 的句子"}},{"chapterNo":4},{"chapterNo":5,"content":"半截';
  const result = ctx.parseAiStructured(raw, { root:'array', required:['content'], defaults:{ reason:'' }, types:{ chapterNo:'number', tags:'array' } });
  assert.equal(result.items.length, 2); assert.equal(result.items[0].value.chapterNo, 3);
  assert.deepEqual(Array.from(result.items[0].value.tags), ['甲','乙']);
  assert.equal(result.items[0].value.meta.note, '含 } 的句子'); assert.equal(result.items[0].value.reason, '');
  assert.equal(result.items[1].status, '需补'); assert.equal(result.incomplete, true);
});
test('G1 nested and duplicate markers select first complete content and warn', () => {
  const ctx = aiContext();
  const duplicate = ctx.parseAiStructured('【新内容开始】甲【新内容结束】【新内容开始】乙【新内容结束】', { marked:true });
  assert.equal(duplicate.value, '甲'); assert.ok(duplicate.errors.length);
  const nested = ctx.parseAiStructured('【新内容开始】外【新内容开始】内【新内容结束】尾【新内容结束】', { marked:true });
  assert.equal(nested.value.includes('【新内容开始】'), false); assert.ok(nested.errors.length);
});
test('G1 HTML and explicit refusal are not silently treated as usable story text', () => {
  const ctx = aiContext();
  assert.equal(ctx.parseAiStructured('<!doctype html><html><h1>502</h1></html>').errors[0].code, 'html');
  assert.equal(ctx.parseAiStructured('抱歉，我无法帮助完成这个请求。').refused, true);
  assert.equal(ctx.parseAiStructured('他不能完成任务，只好离开。', { marked:true }).refused, undefined);
});
test('G1 one repair includes prior error; valid JSON and aborted requests send no repair', async () => {
  const requests = [];
  const ctx = aiContext({ fetchAdapterCompletion:async(_request,messages,options)=>{ requests.push({messages,signal:options.signal}); return {text:'[{"content":"修复正文"}]'}; }, getAdapterCompletionText:value=>value.text });
  const options = { root:'array', required:['content'], request:{model:'mock'}, signal:new AbortController().signal };
  const valid = await ctx.repairAiStructured('[{"content":"有效"}]', options); assert.equal(valid.ok,true); assert.equal(requests.length,0);
  const fixed = await ctx.repairAiStructured('格式乱了', options); assert.equal(fixed.ok,true); assert.equal(requests.length,1);
  assert.match(requests[0].messages.at(-1).content,/错|格式/); assert.match(requests[0].messages.at(-1).content,/不改/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(ctx.repairAiStructured('格式乱了',{...options,signal:controller.signal}),{name:'AbortError'}); assert.equal(requests.length,1);
});
test('G1 failed repair retains original exactly and history is bounded to twenty', async () => {
  const ctx = aiContext({ fetchAdapterCompletion:async()=>({text:'仍然坏了'}), getAdapterCompletionText:value=>value.text });
  const raw = '  原始返回 不做 trim  ';
  const result = await ctx.repairAiStructured(raw, {root:'array',request:{model:'mock'}});
  assert.equal(result.raw,raw); assert.equal(result.repairAttempted,true); assert.equal(result.ok,false);
  for(let i=0;i<30;i++) ctx.rememberAiRawResponse('raw '+i);
  assert.equal(ctx.history.length,20); assert.equal(ctx.history.at(-1).raw,'raw 29');
});
test('G1 ignores apostrophes in preambles outside JSON', () => {
  const result = aiContext().parseAiStructured("Here's the result: [{\"content\":\"usable\"}]", {root:'array'});
  assert.equal(result.value[0].content, 'usable');
});
test('G1 selects first complete root while strict legacy parser rejects competing JSON roots',()=>{
  const ctx=aiContext(),raw='{"x":1} {"y":2}';
  assert.throws(()=>ctx.parseAiStructuredJson(raw));
  assert.equal(ctx.parseAiStructured(raw).value.x,1);
});
test('G1 final fallback offers retry, exact original copy and editable manual adoption',async()=>{
  const dialogs=[],prompts=[],copied=[];let adopted='',retried=0;
  const ctx=aiContext({openConfirm:(cfg,cb)=>dialogs.push({cfg,cb}),openInputPrompt:(cfg,cb)=>prompts.push({cfg,cb}),navigator:{clipboard:{writeText:async value=>copied.push(value)}}});
  const raw='  original reply  ';ctx.openAiFormatFallback(raw,{retry:()=>retried++,adopt:value=>adopted=value});
  assert.deepEqual(Array.from(dialogs[0].cfg.choices,x=>x.id),['retry','copy','adopt']);
  await dialogs[0].cb('copy');assert.equal(copied[0],raw);
  await dialogs.at(-1).cb('adopt');assert.equal(prompts[0].cfg.initialValue,raw);prompts[0].cb('manually repaired');assert.equal(adopted,'manually repaired');
  ctx.openAiFormatFallback(raw,{retry:()=>retried++});await dialogs.at(-1).cb('retry');assert.equal(retried,1);
});

function volumeContext(extra = {}) {
  const notices = [], confirmations = [], ref=value=>({value}); let saves=0;
  const ctx=aiContext({ novel:ref({volumes:[],synopsis:'',outline:''}), novelVolumes:ref([]), activeBranchId:ref('main'), chapters:ref([]), outlineInput:ref(''), doEnd:ref(10),
    showToast:(...args)=>notices.push(args), uid:()=>Math.random().toString(36), markVolumePlanStale:()=>{}, saveData:()=>saves++,
    openConfirm:(config,callback)=>confirmations.push({config,callback}), scanAiJsonFragments:raw=>{const start=String(raw).indexOf('{'),end=String(raw).lastIndexOf('}');return {roots:start>=0&&end>start?[String(raw).slice(start,end+1)]:[]};}, ...extra });
  vm.runInContext(extract('    function parseVolumePlan(', '    function applyAiVolumeUpdates('),ctx);
  vm.runInContext(extract('    function buildVolumeConstraintPrompt(', '    const chapters = ref('),ctx);
  return {ctx,notices,confirmations,get saves(){return saves;}};
}
test('V-10 parses JSON aliases and marked plans and tolerates invalid containers',()=>{
  const {ctx}=volumeContext();
  const rows=ctx.parseVolumePlan('【卷纲规划】\n[{"卷序号":1,"卷名":"开端","起始章":1,"结束章":8,"本卷写作内容要求":"寻找线索","衔接点":"新的门"},null]');
  assert.equal(rows.length,1); assert.equal(rows[0].writingRequirement,'寻找线索');
  assert.equal(ctx.parseVolumePlan('{"volumes":{}}').length,0);
  assert.equal(ctx.parseVolumePlan('【卷纲规划】\n第1卷｜卷名：开端｜章节 1-8\n本卷写作内容要求：寻找线索\n衔接点：新的门')[0].endChapter,8);
});
test('V-10b accepts fenced/nested JSON and does not infer volume count from prompt examples',()=>{
  const {ctx}=volumeContext();
  const rows=ctx.parseVolumePlan('模型说明如下：{"data":{"volumes":[{"卷号":1,"卷名":"雾港","章节范围":"1-4","摘要":"开端"},{"卷号":2,"卷名":"回声","章节范围":"5-8","摘要":"收束"}]}}');
  assert.equal(rows.length,2); assert.equal(rows[1].startChapter,5);
  assert.equal(ctx.getVolumePlanCounts('请按现有细纲整理卷纲').count,1);
});
test('V-03/V-04 explicit counts win, otherwise approximately ten chapters per volume',()=>{
  const {ctx}=volumeContext();
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.getVolumePlanCounts('全书共40章，分成三卷'))),{total:40,count:3});
  assert.equal(ctx.getVolumePlanCounts('共40章').count,4);
  assert.equal(ctx.getVolumePlanCounts('一个8章短篇').count,1);
  assert.equal(ctx.getVolumePlanCounts('完整小说共40章，分成四卷',{totalChapters:10,volumeCount:1}).count,1);
});
test('V-09 one format repair only; unresolved ranges preserve original for manual classification instead of inventing volumes',async()=>{
  let requests=0; const {ctx}=volumeContext({ fetchAdapterCompletion:async()=>{requests++;return {text:'still malformed'};}, getAdapterCompletionText:r=>r.text });
  const raw='[{"number":1,"title":"保留卷","startChapter":1,"endChapter":20,"summary":"保留剧情"}]';
  await assert.rejects(ctx.prepareVolumePlan(raw,{prompt:'共8章，分成3卷',request:{model:'mock'}}), error=>{assert.equal(error.partialText,raw);assert.match(error.message,/手动/);return true;});
  assert.equal(requests,1);
  const controller=new AbortController();controller.abort();await assert.rejects(ctx.prepareVolumePlan(raw,{request:{},signal:controller.signal}),{name:'AbortError'});assert.equal(requests,1);
});
test('V-02/V-05 valid plan needs no repair and refusal never sends a format repair',async()=>{
  let requests=0; const {ctx}=volumeContext({fetchAdapterCompletion:async()=>{requests++;return {text:'[]'};},getAdapterCompletionText:r=>r.text});
  const result=await ctx.prepareVolumePlan('[{"number":1,"startChapter":1,"endChapter":10}]',{totalChapters:10,volumeCount:1,request:{}});
  assert.equal(result.fallback,false);assert.equal(requests,0);
  await assert.rejects(ctx.prepareVolumePlan('抱歉，我无法帮助完成这个请求。',{request:{}}),/模型拒绝/);assert.equal(requests,0);
});
test('V-02 new book creates all planned volumes even with an empty initial default',()=>{
  const {ctx,confirmations}=volumeContext();
  ctx.novelVolumes.value=[{id:'default',title:'第1卷',startChapter:1,endChapter:10,summary:'',writingRequirement:'',bridge:''}];
  const rows=ctx.distributeVolumeRanges([{title:'初见',summary:'内容一'},{title:'归途',summary:'内容二'}],20,2);
  assert.equal(ctx.applyPlannedVolumes(rows,{allowCreate:true,totalChapters:20}),2);assert.equal(ctx.novelVolumes.value.length,2);assert.equal(confirmations.length,0);
});
test('V-13 additions to an existing book require explicit acceptance; existing volumes are never deleted',()=>{
  const {ctx,confirmations}=volumeContext();ctx.chapters.value=[{id:'c1'}];
  ctx.novelVolumes.value=[{id:'existing',title:'原卷',startChapter:1,endChapter:10,summary:'原稿'}];
  ctx.applyPlannedVolumes(ctx.distributeVolumeRanges([{title:'新卷一'},{title:'新卷二'}],20,2),{totalChapters:20});
  assert.equal(ctx.novelVolumes.value.length,1);assert.equal(confirmations.length,1);confirmations[0].callback('add');assert.equal(ctx.novelVolumes.value.length,2);
  ctx.applyPlannedVolumes([{number:1,title:'仍保留其余卷',startChapter:1,endChapter:20}],{totalChapters:20});assert.equal(ctx.novelVolumes.value.length,2);assert.equal(ctx.novelVolumes.value[0].endChapter,10);
});
test('V-13 view preserves the pending proposal and switching branch prevents late additions',()=>{
  const {ctx,confirmations}=volumeContext();ctx.chapters.value=[{id:'c1'}];ctx.novelVolumes.value=[{id:'v1',startChapter:1,endChapter:10}];
  ctx.applyPlannedVolumes(ctx.distributeVolumeRanges([],20,2),{totalChapters:20});
  assert.equal(confirmations[0].config.choices.some(x=>x.id==='view'),true);confirmations[0].callback('view');assert.equal(confirmations.length,2);
  ctx.activeBranchId.value='side';confirmations[1].callback('add');assert.equal(ctx.novelVolumes.value.length,1);
});
test('V-06/V-07/V-08 context includes current volume plan and requirement, adjacent bridge or actual handoff',()=>{
  const volumes=[{id:'v1',title:'first',startChapter:1,endChapter:10,summary:'FORBIDDEN_SUMMARY',bridge:'previous bridge'}, {id:'v2',title:'second',startChapter:11,endChapter:20,summary:'FORBIDDEN_CURRENT_SUMMARY',writingRequirement:'current requirement',bridge:'current bridge'}, {id:'v3',title:'FORBIDDEN_OTHER_VOLUME',startChapter:21,endChapter:30}];
  const {ctx}=volumeContext({normalizeNovelVolumes:x=>x,getVolumeForChapter:n=>volumes.find(v=>v.startChapter<=n&&n<=v.endChapter),getVolumeHandoff:()=>null,activeBranchId:{value:'main'}});ctx.novel.value.volumes=volumes;
  const prompt=ctx.buildVolumeConstraintPrompt(12);assert.match(prompt,/previous bridge/);assert.match(prompt,/current requirement/);assert.match(prompt,/current bridge/);assert.match(prompt,/FORBIDDEN_CURRENT_SUMMARY/);assert.doesNotMatch(prompt,/FORBIDDEN_SUMMARY|FORBIDDEN_OTHER_VOLUME/);
  ctx.getVolumeHandoff=()=>({content:'actual handoff'});assert.match(ctx.buildVolumeConstraintPrompt(12),/actual handoff/);
  assert.doesNotThrow(()=>ctx.buildVolumeConstraintPrompt(1));assert.doesNotThrow(()=>ctx.buildVolumeConstraintPrompt(30));
});

function storageContext() {
  const notices = []; let now = 1000000, ratio = .8, estimates = 0;
  const ctx = vm.createContext({ Date:{now:()=>now}, navigator:{storage:{estimate:async()=>{ estimates++; return {usage:ratio*1000,quota:1000}; }}}, showToast:(...args)=>notices.push(args), openConfirm:(_cfg,callback)=>callback('continue') });
  vm.runInContext(extract('    let storageQuotaNoticeLevel', '    async function readStoredLibraryRevision('),ctx);
  return { ctx, notices, get estimates(){return estimates;}, advance:()=>now+=300001, ratio:value=>{ratio=value;} };
}
test('G5 quota check throttles, only warns on escalation, 90 percent stays visible and 97 requires confirmation',async()=>{
  const {ctx,notices,...control}=storageContext();
  await ctx.checkStorageQuota(); await ctx.checkStorageQuota(); assert.equal(notices.length,1); assert.match(notices[0][0],/80%/);
  control.advance(); await ctx.checkStorageQuota(); assert.equal(notices.length,1);
  control.ratio(.9); control.advance(); await ctx.checkStorageQuota(); assert.equal(notices.length,2); assert.equal(notices[1][2],true);
  control.ratio(.97); control.advance(); assert.equal(await ctx.confirmStorageHeadroom('新建分支'),true); assert.equal(notices.length,3);
  assert.match(notices[2][0],/导出 JSON/);
});
test('G5 unsupported estimates fail quietly; backup export suppresses 80 percent but never suppresses 90',async()=>{
  const fixture=storageContext(),{ctx,notices}=fixture;
  vm.runInContext('storageQuotaExportedThisSession=true;',ctx);
  await ctx.checkStorageQuota(); assert.equal(notices.length,0);
  fixture.ratio(.9); fixture.advance(); await ctx.checkStorageQuota(); assert.equal(notices.length,1);
  ctx.navigator.storage={}; fixture.advance(); assert.equal((await ctx.checkStorageQuota()).supported,false);
});
test('G5 failed browser save and unavailable image store still allow current in-memory book rescue',async()=>{
  const ref=value=>({value}), messages=[]; let downloadCount=0, data;
  const ctx=vm.createContext({
    syncBookData:()=>{},saveDataNow:async()=>false,showToast:(...args)=>messages.push(args),snapshotForSerialize:value=>JSON.parse(JSON.stringify(value)),
    novel:ref({title:'救援书',immersiveHandwritingDrafts:{main:{content:'未落盘手写'}}}),memoryLibrary:ref({}),lastWritingUsage:ref({}),storyBible:ref({}),chapters:ref([{id:'c1',content:'未落盘正文',tempContent:'未落盘草稿'}]),structuredCharacters:ref([]),branchList:ref([]),activeBranchId:ref('side'),branchData:ref({main:{chapterOutlines:[{id:'main',content:'主线'}]},side:{chapterOutlines:[{id:'side',content:'分支'}]}}),chapterOutlines:ref([]),chapterIndexDrafts:ref([]),foreshadowMatrix:ref([]),staleMarks:ref([]),summaries:ref([]),promptPresets:ref([]),narrativePerson:ref('third'),coverImage:ref(''),modPacks:ref([]),imageProfiles:ref([]),activeProfileId:ref(''),currentBookId:ref('book'),
    writingStyles:ref([]),currentWritingStyleId:ref(''),activeStyleIds:ref([]),buildSanitizedModPrivateDataForExport:()=>({}),buildCurrentInterruptedDraftRecord:()=>({content:'中断稿'}),ImageStore:{exportBook:async()=>{throw Error('IDB unavailable');}},
    Blob:class{constructor(parts){data=JSON.parse(parts[0]);}},URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL:()=>{}},document:{createElement:()=>({click:()=>downloadCount++}),body:{appendChild:()=>{},removeChild:()=>{}}},setTimeout:()=>1,storageQuotaExportedThisSession:false,storageQuotaNoticeLevel:3
  });
  vm.runInContext(extract('    async function performExportBookFullBackup(', '    // 书名与章节名'),ctx);
  await ctx.performExportBookFullBackup(); assert.equal(downloadCount,1); assert.equal(data.chapters[0].tempContent,'未落盘草稿');
  assert.equal(data.novel.immersiveHandwritingDrafts.main.content,'未落盘手写'); assert.equal(data.chapterOutlines[0].id,'main'); assert.equal(data.branchData.side.chapterOutlines[0].id,'side');
  assert.match(messages.at(-1)[0],/图片缓存读取失败/);
});
