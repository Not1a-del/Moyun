'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '../source/moyun.single.html'), 'utf8');
function extract(from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, '无法提取 ' + from);
  return source.slice(start, end);
}

test('团队方案在未完模式下固定为单卷本段章数，卷范围连续', () => {
  const ctx = vm.createContext({
    teamPlanOptions: { unfinishedMode:true, chapterCount:10 },
    teamPlanFallback: text => ({ userFacts:[{ text, source:'用户' }], volumes:[{ number:1, title:'第一卷', startChapter:1, endChapter:10 }] }),
  });
  vm.runInContext(extract('    function validateVolumeRanges(', '    async function prepareVolumePlan(')+extract('    function normalizeTeamPlan(', '    function buildTeamSettingTable(') + '; globalThis.normalizeTeamPlan = normalizeTeamPlan;', ctx);
  const plan = ctx.normalizeTeamPlan({ chapterCount:30, unfinishedMode:true, volumes:[
    { title:'第一卷', startChapter:1, endChapter:10 },
    { title:'第二卷', startChapter:11, endChapter:30 }
  ] }, '主角发现秘密');
  assert.equal(plan.unfinishedMode, true);
  assert.equal(plan.volumes.length, 1);
  assert.deepEqual([plan.volumes[0].startChapter, plan.volumes[0].endChapter], [1, 10]);
});

test('未勾选未完模式时不接受策划员擅自改成未完模式', () => {
  const ctx = vm.createContext({
    teamPlanOptions: { unfinishedMode:false, chapterCount:10 },
    teamPlanFallback: text => ({ userFacts:[{ text, source:'用户' }], volumes:[{ number:1, title:'第一卷', startChapter:1, endChapter:10 }] })
  });
  vm.runInContext(extract('    function validateVolumeRanges(', '    async function prepareVolumePlan(')+extract('    function normalizeTeamPlan(', '    function buildTeamSettingTable(') + '; globalThis.normalizeTeamPlan = normalizeTeamPlan;', ctx);
  const plan = ctx.normalizeTeamPlan({ unfinishedMode:true, chapterCount:8, volumes:[{ title:'第一卷', startChapter:1, endChapter:8 }] }, '完整故事');
  assert.equal(plan.unfinishedMode, false);
  assert.equal(plan.volumes.length, 1);
});

test('完整模式共30章默认3卷，用户明确分2卷时尊重指定且范围连续',()=>{
  const ctx=vm.createContext({teamPlanOptions:{unfinishedMode:false,chapterCount:10}});
  vm.runInContext(extract('    function validateVolumeRanges(', '    async function prepareVolumePlan(')+extract('    function teamPlanFallback(', '    function buildTeamSettingTable('),ctx);
  const raw={chapterCount:10,volumes:[{title:'保留第一卷',startChapter:1,endChapter:10,summary:'第一卷剧情哨兵'}]};
  const defaultPlan=ctx.normalizeTeamPlan(raw,'完整故事，共30章');
  assert.equal(defaultPlan.chapterCount,30);assert.equal(defaultPlan.volumes.length,3);assert.ok(ctx.validateVolumeRanges(defaultPlan.volumes,30));
  assert.deepEqual(JSON.parse(JSON.stringify(defaultPlan.volumes.map(row=>[row.startChapter,row.endChapter]))),[[1,10],[11,20],[21,30]]);
  const explicitPlan=ctx.normalizeTeamPlan(raw,'完整故事，共30章分为2卷');
  assert.equal(explicitPlan.chapterCount,30);assert.equal(explicitPlan.volumes.length,2);assert.ok(ctx.validateVolumeRanges(explicitPlan.volumes,30));
  assert.deepEqual(JSON.parse(JSON.stringify(explicitPlan.volumes.map(row=>[row.startChapter,row.endChapter]))),[[1,15],[16,30]]);
  assert.equal(explicitPlan.volumes[0].summary,'第一卷剧情哨兵');
});

test('细纲批次按卷切分，卷边界不会跨批次', () => {
  const ctx = vm.createContext({});
  vm.runInContext(extract('    function buildTeamChapterBatches(', '    async function runTeamBlock(') + '; globalThis.buildTeamChapterBatches = buildTeamChapterBatches;', ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.buildTeamChapterBatches({ startChapter:1, endChapter:8 }, 5))), [
    { startChapter:1, endChapter:5 }, { startChapter:6, endChapter:8 }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.buildTeamChapterBatches({ startChapter:9, endChapter:12 }, 5))), [{ startChapter:9, endChapter:12 }]);
});

test('角色员走 character 模型路由，失败块保留错误状态供单独重试', async () => {
  const calls = [];
  const ctx = vm.createContext({
    teamPlan:{ value:{ characters:[] } }, _teamAbort:null,
    teamBlocks:{ value:[{ id:'characters', status:'pending' }] },
    teamSpecialistPrompt: id => id,
    okStreamFetch: async (prompt, modelKey) => { calls.push({ prompt, modelKey }); return '{"characters":[{"name":"林远","desc":"寻灯人"}]}'; },
    cleanAIResponse:value=>String(value||''),getModuleRequestConfig:key=>({ok:true,module:key}),
    fetchAdapterCompletion:async()=>{throw Error('Valid characters must not require format repair');},
    uid:() => 'id', DOMException, Date
  });
  vm.runInContext(extract('    function parseAiJsonSyntax(', '    function parseCharacterAiJsonEnvelope('),ctx);
  vm.runInContext(extract('    async function runTeamBlock(', '    async function runTeamDetailBlock(') + '; globalThis.runTeamBlock = runTeamBlock;', ctx);
  await ctx.runTeamBlock('characters');
  assert.equal(calls[0].modelKey, 'character');
  assert.equal(ctx.teamBlocks.value[0].status, 'done');
  assert.equal(ctx.teamBlocks.value[0].result.characters[0].name,'林远');
  ctx.okStreamFetch=async()=>{throw Error('模拟角色员网络失败');};
  await assert.rejects(ctx.runTeamBlock('characters'),/模拟角色员网络失败/);
  assert.equal(ctx.teamBlocks.value[0].status,'error');
  assert.match(ctx.teamBlocks.value[0].error,/模拟角色员网络失败/);
});

test('团队开始阶段不创建书或写库，只有提交阶段调用一次写入', () => {
  const start = extract('    async function startTeamGeneration(', '    function collectTeamDetailResults(');
  assert.equal(start.includes('createNewBook('), false);
  assert.equal(start.includes('saveDataNow('), false);
  const commit = extract('    async function commitTeamDraft(', '    async function commitPartialTeamDraft(');
  assert.equal((commit.match(/createNewBook\(/g) || []).length, 1);
  assert.equal((commit.match(/saveDataNow\(/g) || []).length, 2);
});

test('停止团队开书会中止请求并清空草稿，不留下可提交半成品', () => {
  const stop = extract('    function stopTeamBook(', '    function getOneKeyDetailedChapterCount(');
  assert.match(stop, /_teamAbort\) _teamAbort\.abort\(\)/);
  assert.match(stop, /teamDraft\.value = null/);
  assert.match(stop, /teamPhase\.value = 'done'/);
});

test('单个细纲块失败不会用 break 跳过同卷后续批次', () => {
  const start = extract('    async function startTeamGeneration(', '    function collectTeamDetailResults(');
  assert.match(start, /catch { continue; }/);
  assert.doesNotMatch(start, /catch { break; }/);
});

test('继续规划会追加章节索引，且团队失败块可单独补齐', () => {
  const commit = extract('    async function commitTeamDraft(', '    async function commitPartialTeamDraft(');
  assert.match(commit, /appendedIndex/);
  assert.match(commit, /chapterIndexDrafts.value = chapterIndexDrafts.value.concat/);
  const draft = extract('    function buildTeamDraft(', '    async function reviewTeamDraft(');
  assert.match(draft, /nameIssues/);
});

test('未完模式提示词明确禁止写结局', () => {
  const prompt = extract('    function teamDetailPrompt(', '    function buildTeamChapterBatches(');
  assert.match(prompt, /禁止写结局/);
  assert.match(prompt, /只生成第/);
});

test('追加规划保存失败会恢复原书规划', () => {
  const commit = extract('    async function commitTeamDraft(', '    async function commitPartialTeamDraft(');
  assert.match(commit, /appendBackup/);
  assert.match(commit, /已恢复原书内容/);
});

test('团队完成页提供失败块的单独重试和原文入口，重试后重新审查', () => {
  const template = source.slice(source.indexOf('data-team-book-review'), source.indexOf('<!-- ═══ 原有完成阶段 ═══ -->'));
  assert.match(template, /data-team-book-failed-blocks/);
  assert.match(template, /@click="retryTeamBlock\(row.id\)"/);
  assert.match(template, /@click="viewTeamRaw\(row.id\)"/);
  const retry = extract('    async function retryTeamBlock(', '    function viewTeamRaw(');
  assert.match(retry, /await reviewTeamDraft\(teamDraft\.value,controller\)/);
});

test('策划员缺关键字段会进入手动方案，不能被默认值静默掩盖', () => {
  const split = extract('    async function splitTeamPlan(', '    function setTeamPlanConfirmPreference(');
  assert.match(split, /hasPlanShape/);
  assert.match(split, /teamPlanNeedsManual\.value = !hasPlanShape/);
});

test('返回手填或关闭配置时会中止策划员请求', () => {
  const cancel = extract('    function cancelTeamPlanner(', '    function backToManualBook(');
  assert.match(cancel, /_teamAbort\.abort\(\)/);
  assert.match(cancel, /_teamRunId\+\+/);
  const close = extract('    function requestCloseNewBookModal(', '    function openNewBookModal(');
  assert.match(close, /cancelTeamPlanner\(\)/);
});

test('策划员取消后即使请求晚返回也不会回写方案', () => {
  const split = extract('    async function splitTeamPlan(', '    function setTeamPlanConfirmPreference(');
  assert.match(split, /const runId = \+\+_teamRunId/);
  assert.match(split, /runId !== _teamRunId/);
  assert.match(split, /controller\.signal\.aborted/);
});

test('停止后重试失败块不会复用已中止的请求信号', () => {
  const retry = extract('    async function retryTeamBlock(', '    function viewTeamRaw(');
  assert.match(retry, /_teamAbort && !_teamAbort\.signal\.aborted/);
});

test('细纲反推已有大纲先审阅再改卷纲，并支持停止', () => {
  const reverse = extract('    async function reverseOutlineFromDetails(', '    function stopReverseOutlineFromDetails(');
  assert.match(reverse, /chapterNo:Math\.max\(1, Number\(item\?\.chapterNo\)/);
  assert.match(reverse, /reverseOutlineAbortController/);
  const apply = extract('    function applyReverseOutlineResult(', '    function openOutlineWorkbench(');
  assert.match(apply, /pendingVolumes:nextVolumes/);
  assert.match(apply, /已有大纲已生成红绿对比/);
  const stop = extract('    function stopReverseOutlineFromDetails(', '    function applyReverseOutlineResult(');
  assert.match(stop, /reverseOutlineAbortController\.abort\(\)/);
});
