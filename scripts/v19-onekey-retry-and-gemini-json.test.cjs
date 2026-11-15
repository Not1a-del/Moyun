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

function readGeminiFixture() {
  const fixture = path.win32.normalize('F:\\yydcm129\\素材\\gemini3.8flash测试数据.txt');
  if (!fs.existsSync(fixture)) return null;
  return fs.readFileSync(fixture, 'utf8');
}

test('Gemini 完整规划 JSON 可提取大纲、章节规划和卷纲', () => {
  const raw = readGeminiFixture();
  if (!raw) return;
  const context = { cleanAIResponse:value => String(value || ''), showToast(){} };
  vm.createContext(context);
  vm.runInContext(fn('scanAiJsonFragments') + fn('parseAiJsonSyntax') + fn('parseAiStructuredJson') + fn('normalizeGeminiOutlinePayload'), context);
  const payload = context.normalizeGeminiOutlinePayload(raw);
  assert.ok(payload);
  assert.equal(payload.chapterPlan.length, 30);
  assert.equal(payload.volumes.length, 6);
  assert.match(payload.outlineText, /荒原血蜕/);
  assert.match(payload.chapterIndexText, /第1章/);
});

test('一键开书字段提取器不再漏掉 outlineAppend 和 chapterPlan', () => {
  const raw = readGeminiFixture();
  if (!raw) return;
  const context = { parseAiStructuredJson: JSON.parse };
  vm.createContext(context);
  vm.runInContext("const OK_FIELD_KEYS='书名|作品简介|世界观|负面提示词|大纲|章节索引草案|章节索引|细纲|封面关键词';" + fn('normalizeGeminiOutlinePayload') + fn('okNormalizeSectionText') + fn('okExtractField'), context);
  assert.match(context.okExtractField(raw, '大纲'), /荒原血蜕/);
  assert.match(context.okExtractField(raw, '章节索引草案'), /绝境残鼎/);
  assert.match(context.okExtractField(raw, '卷纲规划'), /"volumes"/);
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
