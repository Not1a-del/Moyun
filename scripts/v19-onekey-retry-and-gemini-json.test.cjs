'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '../source/moyun.single.html'), 'utf8');
function fn(name) {
  let at = source.indexOf('    function ' + name + '(');
  if (at < 0) at = source.indexOf('    async function ' + name + '(');
  assert.ok(at >= 0, name);
  const end = source.indexOf('\n    }', at);
  assert.ok(end > at, name);
  return source.slice(at, end + 6);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function planningHarness() {
  const context={cleanAIResponse:value=>String(value || ''),showToast(){},looksLikeAiRefusal:()=>false};
  vm.createContext(context);
  const constant=source.match(/    const OK_FIELD_KEYS = [^\n]+/)[0];
  vm.runInContext(constant + ['scanAiJsonFragments','parseAiJsonSyntax','parseAiStructuredJson','normalizePlanningKey','findPlanningField','planningRows','planningNumber','planningText','parsePlanningRoot','parseVolumePlan','validateVolumeRanges','getVolumePlanCounts','distributeVolumeRanges','prepareVolumePlan','normalizeOutlinePlanningPayload','normalizeGeminiOutlinePayload','okNormalizeSectionText','extractPlanningSection','okExtractField'].map(fn).join('\n'),context);
  return context;
}

function readGeminiFixture() {
  return fs.readFileSync(path.join(__dirname, 'fixtures/v0.0.19/gemini-planning-response.txt'), 'utf8');
}
function readGlmTextFixture() {
  return fs.readFileSync(path.join(__dirname, 'fixtures/v0.0.19/glm53-text-planning-response.txt'), 'utf8');
}

test('文本卷纲回退进入共用规划解析器并保留多卷原文', () => {
  const raw = readGlmTextFixture();
  const context = planningHarness();
  const payload = context.normalizeOutlinePlanningPayload(raw);
  assert.ok(payload);
  assert.equal(payload.volumes.length, 4);
  assert.equal(JSON.stringify(payload.volumes.map(row => [row.number, row.startChapter, row.endChapter])), JSON.stringify([[1, 1, 10], [2, 11, 20], [3, 21, 30], [4, 31, 40]]));
  assert.match(payload.volumes[0].title, /雾起炉心/);
  assert.match(payload.volumes[3].title, /苍梧问道/);
  assert.match(payload.volumes[0].writingRequirement, /前三章/);
  assert.match(payload.volumes[0].bridge, /顾长庚/);
  assert.match(payload.outlineText, /第4卷/);
  assert.match(payload.outlineText, /第40章/);
});

test('真实文本卷纲进入生成前的范围校验链，不被均分为单卷', async () => {
  const raw = readGlmTextFixture();
  const context = planningHarness();
  const prepared = await context.prepareVolumePlan(raw, { totalChapters:40, userPrompt:'' });
  assert.equal(prepared.fallback, false);
  assert.equal(prepared.rows.length, 4);
  assert.equal(JSON.stringify(prepared.rows.map(row => [row.number, row.startChapter, row.endChapter])), JSON.stringify([[1, 1, 10], [2, 11, 20], [3, 21, 30], [4, 31, 40]]));
});

test('Gemini 完整规划 JSON 可提取大纲、章节规划和卷纲', () => {
  const raw = readGeminiFixture();
  const context = planningHarness();
  const payload = context.normalizeOutlinePlanningPayload(raw);
  assert.ok(payload);
  assert.equal(payload.chapterPlan.length, 30);
  assert.equal(payload.volumes.length, 6);
  assert.match(payload.outlineText, /荒原血蜕/);
  assert.match(payload.chapterIndexText, /第1章/);
});

test('一键开书字段提取器不再漏掉 outlineAppend 和 chapterPlan', () => {
  const raw = readGeminiFixture();
  const context = planningHarness();
  assert.match(context.okExtractField(raw, '大纲'), /荒原血蜕/);
  assert.match(context.okExtractField(raw, '章节索引草案'), /绝境残鼎/);
  assert.match(context.okExtractField(raw, '卷纲规划'), /"volumes"/);
});

test('不依赖供应商：解释文字、代码围栏、嵌套结果和中英字段别名',()=>{
  const c=planningHarness();
  for(const payload of [
    {data:{outline:'港口来信',chapter_plans:[{chapter_no:'第2章',chapter_title:'来信',goal:'检查邮戳'}],volume_plan:[{volumeNo:1,name:'港口',start:1,end:2,summary:'沿海追查'}]}},
    {result:{大纲:'港口来信',细纲:[{chapterNo:2,章节标题:'来信',章节目标:'检查邮戳'}],卷纲:[{卷号:1,卷名:'港口',起始章:1,结束章:2,摘要:'沿海追查'}]}}
  ]){
    const fence=String.fromCharCode(96).repeat(3);
    const raw='以下为规划结果：\n'+fence+'json\n'+JSON.stringify(payload)+'\n'+fence+'\n请先审阅。';
    const p=c.normalizeOutlinePlanningPayload(raw);
    assert.equal(p.outlineAppend,'港口来信');assert.equal(p.chapterPlan[0].existingChapterNo,2);
    assert.equal(p.chapterPlan[0].content,'检查邮戳');assert.equal(p.volumes[0].endChapter,2);
    assert.equal(p.volumes[0].summary,'沿海追查');assert.equal(p.raw,raw);
  }
});

test('截断嵌套JSON只恢复完整章节和卷对象，不混入错误类型，原文逐字保留',()=>{
  const c=planningHarness();
  const raw='  {"chapterPlan":[{"title":"已收到第一章","content":"追查邮戳"}],"volumes":[{"title":"港口","startChapter":1,"endChapter":2,"summary":"卷的内容"},{"title":"未完成';
  const p=c.normalizeOutlinePlanningPayload(raw);
  assert.equal(p.incomplete,true);assert.equal(p.chapterPlan.length,1);assert.equal(p.volumes.length,1);
  assert.equal(p.chapterPlan[0].content,'追查邮戳');assert.equal(p.volumes[0].title,'港口');assert.equal(p.raw,raw);
  assert.equal(c.scanAiJsonFragments(raw).records.length,0,'现有解析器的默认规则保持不变');
});

test('标题语义可识别Markdown、粗体、中文括号和无分隔符段落，不吞掉下一块',()=>{
  const c=planningHarness();
  for(const heads of [['### 故事大纲','### 章节规划','### 卷纲规划'],['**总纲**','**细纲**','**卷纲**'],['【大纲】','【章节索引草案】','【卷纲规划】'],['大纲：','细纲：','卷纲：']]){
    const text=heads[0]+'\n主角翻开旧档案，大纲中的伏笔随之出现。\n'+heads[1]+'\n第1章｜标题：来信｜一句话目标：检查邮戳\n'+heads[2]+'\n第1卷｜港口｜章节 1-1｜框架摘要：寻找寄信人';
    assert.equal(c.okExtractField(text,'大纲'),'主角翻开旧档案，大纲中的伏笔随之出现。');
    assert.match(c.okExtractField(text,'章节索引草案'),/^第1章/);assert.doesNotMatch(c.okExtractField(text,'章节索引草案'),/第1卷/);
    assert.match(c.okExtractField(text,'卷纲规划'),/^第1卷/);
  }
});

test('无关JSON不误认成规划，多份规划有歧义时拒绝猜测',()=>{
  const c=planningHarness();
  assert.equal(c.normalizeOutlinePlanningPayload('{"characters":[{"name":"小林","outline":"人物小传"}]}'),null);
  assert.throws(()=>c.normalizeOutlinePlanningPayload('{"outline":"示例"}\n{"outline":"实际输出"}'),/多份规划/);
  const p=c.normalizeOutlinePlanningPayload('示例：{"ok":true}\n结果：{"outline":"实际输出"}');
  assert.equal(p.outlineAppend,'实际输出');
});

test('字典形式条目不会漏章，非法小数章号不被四舍五入后误采用',()=>{
  const c=planningHarness();
  const p=c.normalizeOutlinePlanningPayload(JSON.stringify({outline:'总纲',chapterPlan:{a:{title:'来信',content:'检查邮戳'},b:{title:'档案',content:'核对日期'}},volumes:[{title:'港口',startChapter:1.4,endChapter:2.6}]}));
  assert.equal(p.chapterPlan.length,2);assert.equal(p.volumes[0].startChapter,1.4);assert.equal(p.volumes[0].endChapter,2.6);
  for(const invalid of [0,-1,1.4]){
    const q=c.normalizeOutlinePlanningPayload(JSON.stringify({chapterPlan:[{chapterNo:invalid,title:'待核对章',content:'不能猜测章号'}],volumes:[{startChapter:invalid,endChapter:3}]}));
    assert.equal(q.chapterPlan[0].existingChapterNo,invalid);assert.equal(q.volumes[0].startChapter,invalid);
  }
});

test('失败原文跟随书籍保存，重开失败保留上一版，不覆盖正式大纲',()=>{
  const c=vm.createContext({novel:{value:{outline:'正式大纲'}},currentBookId:{value:'b'},oneKeyFailureSnapshot:{bookId:'b'},okStream:{value:'第一版半截原文'},okSteps:{value:[{id:'core',label:'大纲',status:'error',error:'断流'}]},saved:0,saveData(){c.saved++;}});
  vm.runInContext(fn('preserveOneKeyFailure')+fn('getOneKeyFailedSteps'),c);
  c.preserveOneKeyFailure(c.okSteps.value[0],new Error('断流'));
  assert.equal(c.getOneKeyFailedSteps()[0].raw,'第一版半截原文');
  c.preserveOneKeyFailure(c.okSteps.value[0],{partialText:'第二版半截原文'});
  const saved=clone(c.novel.value);
  assert.equal(saved.oneKeyRecovery.core.previousRaw,'第一版半截原文');
  assert.equal(saved.oneKeyRecovery.core.raw,'第二版半截原文');assert.equal(saved.outline,'正式大纲');assert.equal(c.saved,2);
});

test('流式和非流式截断均保留已有文字，不自动重试覆盖',async()=>{
  for(const streaming of [false,true]){
    const raw='已收到的规划文字，下一段还没有完成';let calls=0;
    const c=vm.createContext({okStream:{value:''},oneKeyAutoRetry:{value:true},
      getModuleRequestConfig:()=>({model:'test-model'}),buildNsfwMessages:prompt=>[{role:'user',content:prompt}],
      getAdapterCompletionText:r=>r.text,isRetryableAiRequestError:()=>true,
      fetchAdapterCompletion:async(_r,_m,opts)=>{calls++;if(streaming){opts.onTextDelta(raw,raw);throw new Error('连接中断');}return{text:raw,truncated:true};}});
    vm.runInContext(fn('okStreamFetch'),c);
    await assert.rejects(c.okStreamFetch('规划','settings',new AbortController().signal),error=>{assert.equal(error.partialText,raw);return true;});
    assert.equal(calls,1);
  }
});

function retryHarness() {
  const ref = value => ({ value });
  const context = {
    deepClone: clone,
    currentBookId: ref('book-1'),
    novel: ref({ theme:'已写主题', title:'已生成书名', worldView:'已写世界观', unfinishedMode:true }),
    newBookForm: ref({ theme:'原始主题输入', title:'原始书名输入', worldView:'原始世界观输入', charCount:3 }),
    newBookMode: ref('manual'),
    oneKeyPhase: ref('done'),
    newBookAdvancedOpen: ref(false),
    okSec: { settings:false, chars:false, outline:false, presets:false },
    okCfg: { genTitle:true,genSynopsis:true,genWorldView:true,genNegative:true,genOutline:true,genDetailed:false,genPipeline:true,genStyles:true,genPresets:true,charCount:3,genCharTags:true,genCharStyle:true,genCharDialogues:true,genCharRel:true,genCharPrompt:true,genCover:false,genCharAvatar:false,styleCount:2,presetCount:2,styleHint:'',presetHint:'',unfinishedMode:true },
    structuredCharacters: ref([{name:'已有角色'}]),
    okFailedSteps: ref([{id:'chars',label:'角色'},{id:'presets',label:'预设与文风'}]),
    newBookCloseBaseline:'',
    showToast(){},
    getNewBookCloseSnapshot(){ return ''; },
    startCalls:0
  };
  vm.createContext(context);
  vm.runInContext("let oneKeyRetryTarget=''; let oneKeyFailureSnapshot={bookId:'book-1',form:{theme:'原始主题输入',title:'原始书名输入',worldView:'原始世界观输入',charCount:3},config:{genTitle:true,genSynopsis:true,genWorldView:true,genNegative:true,genOutline:true,genDetailed:false,genPipeline:true,genStyles:true,genPresets:true,charCount:3,genCharTags:true,genCharStyle:true,genCharDialogues:true,genCharRel:true,genCharPrompt:true,unfinishedMode:true},mode:'manual'};" + fn('configureOneKeyRetryModules') + fn('retryAllOneKeyModules') + fn('returnToOneKeyConfig') + "\nthis.api={configureOneKeyRetryModules,retryAllOneKeyModules,returnToOneKeyConfig,oneKeyPhase,okCfg,newBookForm};", context);
  context.startOneKeyGeneration = async function () { context.startCalls++; };
  return context;
}

test('一键开书全部重开只选择失败模块，返回配置恢复原始输入', async () => {
  const context = retryHarness();
  await context.api.retryAllOneKeyModules();
  assert.equal(context.startCalls, 1);
  assert.equal(context.okCfg.genPipeline, true);
  assert.equal(context.okCfg.genStyles, true);
  assert.equal(context.okCfg.genPresets, true);
  assert.equal(context.okCfg.charCount, 3);
  assert.equal(context.okCfg.genTitle, false);
  context.newBookForm.value.theme = '被错误覆盖';
  context.api.returnToOneKeyConfig();
  assert.equal(context.newBookForm.value.theme, '原始主题输入');
  assert.equal(context.newBookForm.value.title, '原始书名输入');
  assert.equal(context.api.oneKeyPhase.value, 'config');
});

test('失败页保留全部重开和恢复配置入口', () => {
  assert.match(source, /data-one-key-failed-actions/);
  assert.match(source, /@click="retryAllOneKeyModules"/);
  assert.match(source, /@click="returnToOneKeyConfig"/);
  assert.doesNotMatch(source, /v-if="okFailedSteps\\.length" @click="openNewBookModal"/);
});
