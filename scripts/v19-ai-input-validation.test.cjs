'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../source/moyun.single.html'), 'utf8').replace(/\r\n/g, '\n');
function extract(name) {
  const start = source.indexOf('    function ' + name + '(');
  const end = source.indexOf('\n    }', start) + '\n    }'.length;
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end);
}
const functions = ['parseAiJsonSyntax', 'scanAiJsonFragments', 'parseAiStructuredJson', 'parseAiRecordArray',
  'aiGenerateDialogueType', 'aiGeneratePresets', 'aiGenerateStyles', 'aiGenerateTemplate', 'aiGenerateTemplateBatch'];
const code = functions.map(extract).join('\n');
const cases = [
  {fn:'aiGenerateDialogueType', hint:'newDialogueTypeDesc', list:'dialogueTypes', busy:'isGeneratingDialogueType', valid:{label:'冷静', prompt:'短句、克制地表达情绪。'}, fields:['label','prompt']},
  {fn:'aiGeneratePresets', hint:'batchPresetHint', list:'presets', busy:'isGeneratingPresets', array:true, valid:{name:'悬念', content:'保留人物信息边界。'}, fields:['name','content']},
  {fn:'aiGenerateStyles', hint:'aiStyleHint', list:'writingStyles', busy:'isGeneratingStyles', array:true, valid:{name:'清简', prompt:'用具体动作描写。'}, fields:['name','prompt']},
  {fn:'aiGenerateTemplate', hint:'aiTemplateHint', list:'worldTemplates', busy:'isGeneratingTemplate', valid:{name:'海底', content:'城邦依靠潮汐交换物资。'}, fields:['name','content']},
  {fn:'aiGenerateTemplateBatch', hint:'aiTemplateHint', list:'worldTemplates', busy:'isGeneratingTemplate', array:true, valid:{name:'海底', content:'城邦依靠潮汐交换物资。'}, fields:['name','content']}
];
function setup(entry) {
  let complete, reject;
  const calls = {saved:0, toasts:[], requests:[]};
  const pending = new Promise((resolve, fail) => { complete = resolve; reject = fail; });
  const data = {novel:{value:{title:'测试书', theme:'航行'}}, worldTemplates:[], showAiStyleGen:{value:true},
    batchPresetCount:{value:3}, batchStyleCount:{value:3}, batchTemplateCount:{value:3},
    cleanAIResponse:text => String(text).replace(/```(?:json)?/g, '').trim(),
    getModuleRequestConfig:() => ({ok:true}), requireModuleRequest:() => ({ok:true}),
    beginBookScopedAiRun:() => ({controller:{signal:{}}}), isBookScopedAiRunCurrent:() => true, finishBookScopedAiRun:() => true,
    fetchAdapterCompletion:(...args) => { calls.requests.push(args); return pending; },
    buildNsfwMessages:prompt => [{role:'user',content:prompt}], getAdapterCompletionText:text => text,
    uid:() => 'new-id', saveData:() => calls.saved++, showToast:(message,type) => calls.toasts.push({message,type}),
    sanitizeApiErrorDetail:message => message};
  for (const field of ['newDialogueTypeDesc','batchPresetHint','aiStyleHint','aiTemplateHint']) data[field] = {value:'作者输入：保留这句话。'};
  for (const field of ['isGeneratingDialogueType','isGeneratingPresets','isGeneratingStyles','isGeneratingTemplate']) data[field] = {value:false};
  for (const field of ['dialogueTypes','presets','writingStyles']) data[field] = {value:[]};
  const ctx = vm.createContext(data);
  vm.runInContext(code, ctx);
  return {ctx, calls, complete, reject, list:() => entry.list === 'worldTemplates' ? ctx.worldTemplates : ctx[entry.list].value};
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const response = (entry, value) => JSON.stringify(entry.array ? [value] : value);

for (const entry of cases) {
  test(entry.fn + ': 空、空白、错类型、格式错误均不写入且保留原输入', async () => {
    const invalid = ['', '无法生成，稍后重试', entry.array ? '[]' : '{}', response(entry, {}),
      response(entry, Object.fromEntries(entry.fields.map(key => [key, ' \n\t ']))),
      response(entry, {...entry.valid, [entry.fields[0]]:12}),
      response(entry, {...entry.valid, [entry.fields[1]]:''})];
    for (const raw of invalid) {
      const run = setup(entry), input = run.ctx[entry.hint].value;
      run.ctx[entry.fn](); run.complete(raw); await settle();
      assert.equal(run.ctx[entry.hint].value, input, raw);
      assert.equal(run.list().length, 0, raw);
      assert.equal(run.calls.saved, 0, raw);
      assert.equal(run.ctx[entry.busy].value, false, raw);
      assert.ok(run.calls.toasts.some(row => row.type === 'error'), raw);
      if (entry.fn === 'aiGenerateStyles') assert.equal(run.ctx.showAiStyleGen.value, true);
    }
  });
  test(entry.fn + ': 网络错误保留要求和生成入口', async () => {
    const run = setup(entry), input = run.ctx[entry.hint].value;
    run.ctx[entry.fn](); run.reject(new Error('HTTP 503')); await settle();
    assert.equal(run.ctx[entry.hint].value, input); assert.equal(run.list().length, 0);
    assert.equal(run.calls.saved, 0); assert.equal(run.ctx[entry.busy].value, false);
  });
  test(entry.fn + ': 合法结果正常写入并清理已发送的输入', async () => {
    const run = setup(entry); run.ctx[entry.fn](); run.complete(response(entry, entry.valid)); await settle();
    assert.equal(run.list().length, 1); assert.equal(run.ctx[entry.hint].value, ''); assert.equal(run.calls.saved, 1);
    assert.equal(run.calls.requests.length, 1); assert.equal(run.calls.requests[0][2].stream, true);
    assert.equal(run.ctx[entry.busy].value, false);
    if (entry.fn === 'aiGenerateStyles') assert.equal(run.ctx.showAiStyleGen.value, false);
  });
  test(entry.fn + ': 不清除请求期间后来填写的新输入', async () => {
    const run = setup(entry); run.ctx[entry.fn](); run.ctx[entry.hint].value = '后来补写的新要求';
    run.complete(response(entry, entry.valid)); await settle();
    assert.equal(run.list().length, 1); assert.equal(run.ctx[entry.hint].value, '后来补写的新要求');
    if (entry.fn === 'aiGenerateStyles') assert.equal(run.ctx.showAiStyleGen.value, true);
  });
  if (entry.array) test(entry.fn + ': 一批内有无效条目时不留下半批结果', async () => {
    const run = setup(entry), input = run.ctx[entry.hint].value; run.ctx[entry.fn]();
    run.complete(JSON.stringify([entry.valid, {[entry.fields[0]]:'空内容'}])); await settle();
    assert.equal(run.list().length, 0); assert.equal(run.calls.saved, 0); assert.equal(run.ctx[entry.hint].value, input);
  });
}
