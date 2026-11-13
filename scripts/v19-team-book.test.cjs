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

test('角色员走 team-character 模型路由，失败块保留错误状态供单独重试', async () => {
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
  vm.runInContext(extract('    function sanitizeCharacterGenerationResult(', '    function getOneKeyRequiredModelKeys('),ctx);
  vm.runInContext(extract('    async function runTeamBlock(', '    async function runTeamDetailBlock(') + '; globalThis.runTeamBlock = runTeamBlock;', ctx);
  await ctx.runTeamBlock('characters');
  assert.equal(calls[0].modelKey, 'team-character');
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

test('停止团队开书会会中止请求并保留成功结果，未完成块可以继续补齐', () => {
  const stop = extract('    function stopTeamBook(', '    function getOneKeyDetailedChapterCount(');
  const ctx = vm.createContext({
    _teamAbort:{abort(){this.aborted=true;}}, _teamRunId:1,
    teamPhase:{value:'generating'}, oneKeyPhase:{value:'generating'},
    teamBlocks:{value:[{id:'settings',label:'设定员',status:'done',result:{worldView:'已完成设定'}},{id:'characters',label:'角色员',status:'running'},{id:'outline',label:'大纲卷纲员',status:'pending'}]},
    teamDraft:{value:null}, teamReview:{value:null}, teamRawView:{value:'原始回复'},
    syncTeamDraftFromBlocks:()=>{ctx.teamDraft.value={needsFill:ctx.teamBlocks.value.filter(row=>row.id!=='review'&&row.status!=='done').map(row=>row.label)};},
    showToast:message=>{ctx.toast=message;}
  });
  vm.runInContext(stop + '; globalThis.stopTeamBook = stopTeamBook;',ctx);
  const abortController=ctx._teamAbort;
  ctx.stopTeamBook();
  assert.equal(abortController.aborted,true);
  assert.equal(ctx.teamPhase.value,'done');
  assert.equal(ctx.teamBlocks.value[0].result.worldView,'已完成设定');
  assert.deepEqual(Array.from(ctx.teamBlocks.value.slice(1),row=>row.status),['stopped','stopped']);
  assert.ok(ctx.teamDraft.value);
  assert.deepEqual(Array.from(ctx.teamDraft.value.needsFill),['角色员','大纲卷纲员']);
  assert.match(ctx.teamReview.value.message,/已保留/);
  assert.match(ctx.toast,/已保留/);
});

test('团队模型路由支持统一配置、逐角色覆盖和已有书籍联动开关',()=>{
  const block=extract('    const TEAM_BOOK_ROUTE_CONFIG =', '    const PROVIDER_TEMPLATES =');
  const ctx=vm.createContext({});
  vm.runInContext(block+'; globalThis.resolveTeamBookRouteSelection=resolveTeamBookRouteSelection;',ctx);
  const routes={settings:{profileId:'settings-api'},character:{profileId:'character-api'},outline:{profileId:'outline-api'}};
  const follows=key=>ctx.resolveTeamBookRouteSelection(key,routes,{});
  assert.equal(follows('team-planner').fallbackKey,'settings');
  assert.equal(follows('team-character').fallbackKey,'character');
  assert.equal(follows('team-outline').fallbackKey,'outline');
  const shared={...routes,'team-book':{profileId:'shared-api'},'team-character':{profileId:'character-special'}};
  assert.equal(ctx.resolveTeamBookRouteSelection('team-planner',shared,{}).profileId,'shared-api');
  assert.equal(ctx.resolveTeamBookRouteSelection('team-character',shared,{}).profileId,'character-special');
  assert.equal(ctx.resolveTeamBookRouteSelection('character',shared,{applyToExisting:true}).profileId,'character-special');
  assert.equal(ctx.resolveTeamBookRouteSelection('character',shared,{applyToExisting:false}).profileId,'character-api');
  assert.equal(ctx.resolveTeamBookRouteSelection('team-character',routes,{useDefault:true}).useDefault,true);
});

test('设置搜索跳转会滚到团队开书所在的设置内容区',()=>{
  const fn=extract('    function navigateToSettingsSearchResult(', '    function navigateToSettingsModuleLocation(');
  const calls=[];
  const target={getBoundingClientRect:()=>({top:530}),classList:{add(){calls.push('highlight');},remove(){}}};
  const scrollArea={scrollTop:100,getBoundingClientRect:()=>({top:200}),scrollTo:options=>calls.push(options)};
  const ctx=vm.createContext({
    settingsTabs:[{id:'context'}],activeSettingsTab:{value:'connections'},teamBookRoutesOpen:{value:false},
    settingsSearchQuery:{value:'团队开书'},closeSettingsSearch(){ctx.settingsSearchFocused.value=false;},
    settingsSearchFocused:{value:true},nextTick:fn=>fn(),requestAnimationFrame:fn=>fn(),setTimeout:()=>{},
    document:{getElementById:()=>target,querySelector:selector=>selector.includes('.settings-search-shell')?scrollArea:null},
    moyunScrollBehavior:()=> 'smooth'
  });
  vm.runInContext(fn+'; globalThis.navigateToSettingsSearchResult=navigateToSettingsSearchResult;',ctx);
  ctx.navigateToSettingsSearchResult({tab:'context',target:'settings-search-team-book',teamBookRoutes:true});
  assert.equal(ctx.teamBookRoutesOpen.value,true);
  assert.equal(ctx.settingsSearchQuery.value,'');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{top:352,behavior:'smooth'});
});

test('全部重置模块 API 时也会清除团队开书的全局默认模式',()=>{
  const fn=extract('    function resetModuleRoutes(', '    // 中文注释：停用插件');
  const ctx=vm.createContext({
    CONNECTION_MODULE_KEYS:['team-book'],connectionCenter:{value:{moduleRoutes:{'team-book':{profileId:''}}}},
    settings:{value:{teamBookUseDefaultProfile:true}},saveDataNow:()=>{},showToast:()=>{},openConfirm:()=>{throw Error('无已分配 API 时不应要求确认');}
  });
  vm.runInContext(fn+'; globalThis.resetModuleRoutes=resetModuleRoutes;',ctx);
  ctx.resetModuleRoutes();
  assert.equal(ctx.settings.value.teamBookUseDefaultProfile,false);
  assert.equal(ctx.connectionCenter.value.moduleRoutes['team-book'].profileId,'');
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
  assert.match(retry, /await runTeamReview\(controller\)/);
  const review = extract('    async function runTeamReview(', '    async function startTeamGeneration(');
  assert.match(review, /await reviewTeamDraft\(teamDraft\.value,controller\)/);
});

test('重试区块后即使缺少大纲也会把审查状态更新为未完成', async () => {
  const review = extract('    async function runTeamReview(', '    async function startTeamGeneration(');
  const retry = extract('    async function retryTeamBlock(', '    function viewTeamRaw(');
  const ctx = vm.createContext({
    _teamAbort:null, teamBlocks:{value:[{id:'characters',status:'error'},{id:'review',status:'pending'}]},
    teamPhase:{value:'done'}, oneKeyPhase:{value:'done'}, teamDraft:{value:{outline:''}}, teamReview:{value:null},
    runTeamBlock:async id=>{const row=ctx.teamBlocks.value.find(item=>item.id===id);row.status='done';row.result={characters:[]};return row.result;},
    syncTeamDraftFromBlocks:()=>{ctx.teamDraft.value={outline:''};}, showToast:()=>{}, DOMException, AbortController
  });
  vm.runInContext(review+retry+'; globalThis.retryTeamBlock=retryTeamBlock;',ctx);
  await ctx.retryTeamBlock('characters');
  const reviewRow=ctx.teamBlocks.value.find(item=>item.id==='review');
  assert.equal(reviewRow.status,'error');
  assert.match(reviewRow.error,/大纲员未完成/);
  assert.equal(ctx.teamReview.value.status,'incomplete');
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

test('离开团队结果页前必须先留在页面或明确写入草稿', () => {
  const confirmations = [], writes = [];
  const ctx = vm.createContext({
    newBookMode:{ value:'team' }, teamDraft:{ value:{ needsFill:['细纲员'], committing:false } },
    teamBlocks:{ value:[{ id:'characters', status:'done' },{ id:'outline', status:'stopped' }] },
    teamReview:{ value:{ status:'incomplete' } },
    openConfirm:(config, callback)=>confirmations.push({ config, callback }),
    commitPartialTeamDraft:()=>writes.push('partial'), commitTeamDraft:()=>writes.push('full')
  });
  vm.runInContext(extract('    function keepTeamDraftBeforeExit(', '    function requestCloseNewBookModal(') + '; globalThis.keepTeamDraftBeforeExit = keepTeamDraftBeforeExit;', ctx);
  assert.equal(ctx.keepTeamDraftBeforeExit(), true);
  assert.match(confirmations[0].config.message, /离开会丢失/);
  assert.equal(confirmations[0].config.choices[1].label, '先写入已完成部分');
  confirmations[0].callback('stay');
  assert.deepEqual(writes, []);
  confirmations[0].callback('save');
  assert.deepEqual(writes, ['partial']);
  assert.match(extract('    function backToManualBook()', '    function teamPlanFallback('), /keepTeamDraftBeforeExit()/);
});

test('运行中选择停止后仍留在恢复页，不直接关闭并丢掉团队结果', () => {
  let onConfirm, stopped = 0;
  const ctx = vm.createContext({
    oneKeyPhase:{ value:'generating' }, newBookMode:{ value:'team' }, showNewBook:{ value:true },
    openConfirm:(config, callback)=>{ onConfirm = callback; ctx.confirm = config; }, stopTeamBook:()=>stopped++
  });
  vm.runInContext(extract('    function requestCloseNewBookModal(', '    function openNewBookModal(') + '; globalThis.requestCloseNewBookModal = requestCloseNewBookModal;', ctx);
  assert.equal(ctx.requestCloseNewBookModal(), false);
  assert.equal(ctx.confirm.choices[1].label, '停止并查看已完成内容');
  onConfirm('stop');
  assert.equal(stopped, 1);
  assert.equal(ctx.showNewBook.value, true);
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
