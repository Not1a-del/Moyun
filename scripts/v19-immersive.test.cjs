'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../source/moyun.single.html'), 'utf8');
const start = source.indexOf('    function splitImmersiveParagraphs(');
const end = source.indexOf('    function getImmersiveChapterIndex(', start);
const ctx = vm.createContext({
  parseAiStructured(raw) {
    try { return { ok:true, value:JSON.parse(raw), items:[], errors:[] }; }
    catch { return { ok:false, items:[], errors:['格式不完整'] }; }
  }
});
vm.runInContext(source.slice(start, end), ctx);

test('mixed paragraph separators round-trip exactly and offsets retain blank lines', () => {
  const text = '\r\n甲。\r\n\r\n乙。\n丙。\r丁。\n\n';
  const rows = ctx.splitImmersiveParagraphs(text);
  assert.equal(rows.map(row => row.text + row.sep).join(''), text);
  for (const row of rows) assert.equal(text.slice(row.start, row.end), row.text);
  assert.equal(rows.find(row => row.text === '乙。').start, text.indexOf('乙。'));
});

test('end and insertion modes preserve every source character outside insertion', () => {
  const text = '甲。\r\n\r\n乙。\n丙。';
  const tail = ctx.prepareImmersiveExpansion(text, 'append', {}, '尾声。');
  assert.equal(ctx.composeImmersiveExpansion(text, tail), text + '\r\n\r\n尾声。');
  const ops = ctx.prepareImmersiveExpansion(text, 'insert', { 1:'insert' }, '新段。');
  const result = ctx.composeImmersiveExpansion(text, ops);
  assert.equal(result, '甲。\r\n\r\n新段。\r\n\r\n乙。\n丙。');
});

test('range replacement retains exact prefix and suffix, including CRLF', () => {
  const text = '甲。\r\n\r\n乙。\n丙。\r丁。';
  const ops = ctx.prepareImmersiveExpansion(text, 'range', { 1:'start', 3:'end' }, '乙丙扩写。');
  assert.equal(ctx.composeImmersiveExpansion(text, ops), '甲。\r\n\r\n乙丙扩写。\r丁。');
  assert.equal(ops[0].end, text.indexOf('丙。') + 2);
});

test('whole-book operations locate by valid paragraph or unique locator; failures cannot apply', () => {
  const text = '甲走进雨里。\n\n乙收起伞。\r\n丙回到家。';
  const raw = JSON.stringify([
    { '段落编号':'P1', '插入或替换':'插入', '新文字':'风很冷。', '理由':'补环境' },
    { '段落编号':99, '定位句':'乙收起伞', '插入或替换':'替换', '新文字':'乙慢慢收起湿伞。' },
    { '段落编号':100, '定位句':'不存在的句子', '新文字':'不可写入。' }
  ]);
  const ops = ctx.prepareImmersiveExpansion(text, 'full', {}, raw);
  assert.equal(ops.length, 3);
  assert.equal(ops[1].issue, '');
  assert.match(ops[2].issue, /定位/);
  const result = ctx.composeImmersiveExpansion(text, ops.filter(op => !op.issue));
  assert.equal(result, '甲走进雨里。\n\n风很冷。\n\n乙慢慢收起湿伞。\r\n丙回到家。');
});

test('missing markers, partial content, and copied outside paragraphs remain reviewable', () => {
  const text = '外部首段。\n\n选中段。\n\n外部尾段。';
  const missing = ctx.prepareImmersiveExpansion(text, 'append', {}, '好的，以下是扩写内容：\n新段。');
  assert.equal(missing[0].text.includes('好的'), false);
  assert.ok(missing[0].warnings.length);
  const mixed = ctx.prepareImmersiveExpansion(text, 'range', { 1:'start', 2:'end' }, '【新内容开始】外部首段。\n\n扩写选中段。\n\n外部尾段。');
  assert.equal(ctx.composeImmersiveExpansion(text, mixed), '外部首段。\n\n扩写选中段。\n\n外部尾段。');
  assert.ok(mixed[0].warnings.length);
});

test('conflicting whole-book edits and ambiguous locators do not overwrite source', () => {
  const text = '重复句。\n重复句。';
  const ops = ctx.prepareImmersiveExpansion(text, 'full', {}, JSON.stringify([
    { paragraph:1, action:'replace', text:'甲。' },
    { paragraph:1, action:'replace', text:'乙。' },
    { paragraph:99, locator:'重复句', text:'丙。' }
  ]));
  assert.match(ops[1].issue, /重叠/);
  assert.match(ops[2].issue, /定位/);
});

test('handoff distinguishes a new chapter, continuation, and regeneration without changing content', () => {
  const old = { id:'c1', content:'原正文。', tempContent:'编辑草稿。' };
  const fresh = ctx.prepareImmersiveHandoff({ mode:'continue', options:{} }, [old], '半截正文。');
  assert.equal(fresh.chapterIndex, -1);
  const continuation = ctx.prepareImmersiveHandoff({ mode:'append', options:{ targetChapterId:'c1' } }, [old], '接写半截。');
  assert.equal(continuation.text, '编辑草稿。\n\n接写半截。');
  const regeneration = ctx.prepareImmersiveHandoff({ mode:'reroll', options:{ reroll:{ chapterId:'c1' } } }, [old], '新半稿。');
  assert.equal(regeneration.text, '新半稿。');
  assert.equal(old.content, '原正文。');
});

function runtime(options = {}) {
  const ref = value => ({ value });
  const timers = new Map(), saves = [], runs = new Map(), requestModuleKeys = []; let token = 0;
  const chapters = ref(options.chapters || [{ id:'c1', title:'第一章', content:'原正文。', branchId:'main' }]);
  const scope = {
    ref, computed:fn => ({ get value() { return fn(); } }),
    setTimeout(fn) { const id = ++token; timers.set(id, fn); return id; }, clearTimeout:id => timers.delete(id),
    requestAnimationFrame:() => 1, cancelAnimationFrame:() => {},
    nextTick:fn => fn?.(), document:{ activeElement:null }, window:{ innerHeight:800 }, AbortController,
    chapters, visibleChapters:chapters, currentChapterIndex:ref(0), currentBookId:ref('book-a'), activeBranchId:ref('main'), aiInputDrafts:new Map(), novel:ref({}), chapterOutlines:ref([]), mainScroll:ref(null),
    streamContent:ref(''), interruptedContent:ref(''), isInterrupted:ref(false), _activeGenerationRun:null, nextChapterPrompt:ref(''),
    splitSnowwingChapterStoryTime:text => ({ content:text }), getSnowwingChapterStoryTime:() => '', normalizeSnowwingStoryTime:()=>'',
    normalizeManualChapterTitle:title => title, getDisplayChapterTitle:ch => ch.title, syncChapterTitleReferences:()=>{}, notifyModMemoryChapterChanged:()=>{}, runModEventHandlers:()=>{},
    staleCalls:[], markBodyContinuityStale:(chapter,no)=>scope.staleCalls.push({id:chapter.id,no}),
    getCleanWordCount:text => String(text).replace(/\s/g, '').length, buildDefaultChapterTitle:n => '第' + n + '章',
    uid:() => 'id-' + (++token), deepClone:value => JSON.parse(JSON.stringify(value)), showToast:()=>{}, saveData:()=>{},
    saveDataNow:async reason => { saves.push({ reason, novel:JSON.parse(JSON.stringify(scope.novel.value)), chapters:JSON.parse(JSON.stringify(chapters.value)) }); return true; },
    requireModuleRequest:key=>{requestModuleKeys.push(key);return { model:'mock' };}, fetchAdapterCompletion:options.fetch || (async()=>({ text:'【新内容开始】新增正文。【新内容结束】' })), getAdapterCompletionText:value => value.text, aiRawResponseHistory:[], rememberAiRawResponse:raw=>scope.aiRawResponseHistory.push({raw,at:Date.now()}),
    parseAiStructured:ctx.parseAiStructured,
    // 预算本身由 v19-summary-backfill 测试执行；此处仅隔离扩写的停止/迟到响应行为。
    buildPreviousChapterContextForAi:()=>'',
    parseChapter:raw => ({ title:'新章', content:raw }),
    stopActiveGeneration:()=>{ scope._activeGenerationRun = null; scope.streamContent.value = ''; },
    clearInterruptedDraftState:()=>{ scope.interruptedContent.value = ''; },
    startGeneration:options=>{scope.lastStartGenerationOptions=options;}, continueGeneration:options=>{scope.lastContinueGenerationOptions=options;},
    beginBookScopedAiRun(key) { const run = { key, id:++token, sourceBookId:scope.currentBookId.value, controller:new AbortController() }; runs.set(key, run); return run; },
    isBookScopedAiRunCurrent:run => runs.get(run.key) === run && !run.controller.signal.aborted && run.sourceBookId === scope.currentBookId.value,
    finishBookScopedAiRun:run => { if (runs.get(run.key) === run) runs.delete(run.key); }
  };
  const context = vm.createContext(scope);
  const editStart = source.indexOf('    function startChapterEdit(');
  const editEnd = source.indexOf('    function getDirtyChapterEdits(', editStart);
  const reviewStart = source.indexOf('    function createDiffRevisions(');
  const reviewEnd = source.indexOf('    // 中文注释：修订一旦审完', reviewStart);
  const blockStart = source.indexOf('    const immersiveMode = ref(false);');
  const blockEnd = source.indexOf('    function toggleDesktopSidebar(', blockStart);
  const keyStart = source.indexOf('    function getAiInputDraftKey('), keyEnd = source.indexOf('    const showInputPrompt =', keyStart);
  assert.ok(keyStart >= 0 && keyEnd > keyStart);
  vm.runInContext(source.slice(keyStart, keyEnd) + source.slice(editStart, editEnd) + source.slice(reviewStart, reviewEnd) + source.slice(blockStart, blockEnd) + `
    function toggleImmersive() { immersiveMode.value = !immersiveMode.value; }
    globalThis.api = { immersiveMode, immersiveToolMode, immersiveExpandTags, immersiveExpandTagTool, immersiveExpandWhole, immersiveExpandSource, immersiveExpandReview, immersiveExpandBusy, immersiveWritingText, immersiveDraftStatus, immersiveChapterIndex, immersiveNewDraft, immersiveNewTitle, enterImmersiveWriting, enterImmersiveExpansion, onImmersiveWritingInput, saveImmersiveWriting, runImmersiveExpansion, stopImmersiveExpansion, resetImmersiveTools, beginImmersiveWritingFromGeneration, applyImmersiveExpansion, updateImmersiveReview, discardImmersiveExpansion, setImmersiveExpandTagTool, toggleImmersiveExpandTag };
  `, context);
  return { context, api:context.api, timers, saves, runs, requestModuleKeys };
}

test('handwriting autosaves the editable draft after two seconds, then Save changes the official text', async () => {
  const { context, api, timers, saves } = runtime();
  api.enterImmersiveWriting();
  api.onImmersiveWritingInput({ target:{ value:'手写修改。' } });
  assert.equal(context.chapters.value[0].content, '原正文。');
  assert.equal(context.chapters.value[0].tempContent, '手写修改。');
  assert.equal(timers.size, 1);
  await [...timers.values()][0]();
  assert.equal(saves[0].chapters[0].tempContent, '手写修改。');
  assert.equal(api.immersiveDraftStatus.value, '草稿已保存');
  api.saveImmersiveWriting();
  assert.equal(context.chapters.value[0].content, '手写修改。');
  assert.deepEqual(context.staleCalls,[{id:'c1',no:1}]);
});

test('short stopped AI output becomes a new persisted draft and never pollutes the old chapter', () => {
  const { context, api, saves } = runtime();
  context._activeGenerationRun = { mode:'generate', options:{} }; context.streamContent.value = '短半稿。';
  api.beginImmersiveWritingFromGeneration();
  assert.equal(api.immersiveChapterIndex.value, -1);
  assert.equal(api.immersiveWritingText.value, '短半稿。');
  assert.equal(context.chapters.value.length, 1);
  assert.equal(context.chapters.value[0].content, '原正文。');
  assert.equal(saves[0].novel.immersiveHandwritingDrafts.main.content, '短半稿。');
  api.saveImmersiveWriting();
  assert.equal(context.chapters.value[1].content, '短半稿。');
});

test('stopping an in-flight expansion unlocks immediately and a late response cannot create a review', async () => {
  let resolve, signal;
  const { context, api } = runtime({ fetch:(_request, _messages, options) => { signal = options.signal; return new Promise(done => { resolve = done; }); } });
  api.enterImmersiveExpansion();
  const pending = api.runImmersiveExpansion();
  assert.equal(api.immersiveExpandBusy.value, true);
  api.stopImmersiveExpansion();
  assert.equal(signal.aborted, true);
  assert.equal(api.immersiveExpandBusy.value, false);
  resolve({ text:'【新内容开始】晚到结果。【新内容结束】' }); await pending;
  assert.equal(api.immersiveExpandReview.value, null);
  assert.equal(context.chapters.value[0].content, '原正文。');
});

test('沉浸 AI 扩写和续写使用独立路由，工具栏清楚标出 AI', async () => {
  const { context, api, requestModuleKeys } = runtime();
  api.enterImmersiveExpansion(); await api.runImmersiveExpansion();
  assert.equal(requestModuleKeys.at(-1),'immersive-expand');
  await vm.runInContext('sendImmersiveContinue()',context);
  assert.equal(context.lastStartGenerationOptions.moduleKey,'immersive-continue');
  context.isInterrupted.value=true;context.interruptedContent.value='中断正文';
  await vm.runInContext('sendImmersiveContinue()',context);
  assert.equal(context.lastContinueGenerationOptions.moduleKey,'immersive-continue');
  const toolbar=source.slice(source.indexOf('class="immersive-toolbar"'),source.indexOf('class="immersive-continue-panel"'));
  assert.match(toolbar,/手写当前章/);assert.match(toolbar,/AI扩写/);assert.match(toolbar,/title="调用 AI 根据当前写作内容续写/);assert.doesNotMatch(toolbar,/调用 AI 续写当前章节/);
});

test('沉浸 AI 扩写和续写拥有独立可搜索的上下文 API 配置', () => {
  const moduleStart=source.indexOf('const moduleModelConfig = [');
  const moduleConfig=source.slice(moduleStart,source.indexOf('    ];',moduleStart)+6);
  const searchStart=source.indexOf('const settingsSearchCatalog = [');
  const searchCatalog=source.slice(searchStart,source.indexOf('    ];',searchStart)+6);
  assert.match(moduleConfig,/key:'immersive-expand', name:'沉浸模式 AI 扩写'/);
  assert.match(moduleConfig,/key:'immersive-continue', name:'沉浸模式 AI 续写'/);
  assert.ok(searchCatalog.includes("target:'settings-search-route-"));
  assert.ok(searchCatalog.includes("title:'模块模型分配｜'+mod.name"));
  assert.ok(searchCatalog.includes("keywords:mod.name+' '+mod.desc"));
});

test('switching branch rejects a late response even before view cleanup', async () => {
  let resolve;
  const { context, api } = runtime({ fetch:()=>new Promise(done => { resolve = done; }) });
  api.enterImmersiveExpansion(); const pending = api.runImmersiveExpansion();
  context.activeBranchId.value = 'side';
  resolve({ text:'【新内容开始】旧分支内容。【新内容结束】' }); await pending;
  assert.equal(api.immersiveExpandReview.value, null);
  assert.equal(context.novel.value.immersiveExpansionReviews, undefined);
});

test('partial transport output is previewed, persisted, applied only to tempContent, and discard leaves official text intact', async () => {
  const { context, api } = runtime({ fetch:async()=>{ throw Object.assign(new Error('truncated'), { partialText:'【新内容开始】半截扩写' }); } });
  api.enterImmersiveExpansion(); await api.runImmersiveExpansion();
  const session = api.immersiveExpandReview.value;
  assert.ok(session.operations[0].warnings.some(text => text.includes('半截')));
  assert.equal(api.immersiveExpandBusy.value, false);
  assert.ok(context.novel.value.immersiveExpansionReviews['main:c1']);
  api.applyImmersiveExpansion();
  assert.equal(context.chapters.value[0].content, '原正文。');
  assert.equal(context.chapters.value[0].tempContent, '原正文。\n\n半截扩写');
  api.discardImmersiveExpansion();
  assert.equal(context.chapters.value[0].content, '原正文。');
});

test('selected diff blocks can be applied incrementally without dropping unselected original text', async () => {
  const { context, api } = runtime();
  api.enterImmersiveExpansion(); api.immersiveExpandTags.value = { 0:'start', 1:'end' };
  await api.runImmersiveExpansion();
  const op = api.immersiveExpandReview.value.operations[0];
  op.review.revisions = [
    { id:'d1', groupId:'a', type:-1, text:'原', status:'pending', selected:true },
    { id:'i1', groupId:'a', type:1, text:'新', status:'pending', selected:true },
    { id:'same', type:0, text:'正', status:'accepted' },
    { id:'d2', groupId:'b', type:-1, text:'文', status:'pending', selected:false },
    { id:'i2', groupId:'b', type:1, text:'稿', status:'pending', selected:false },
    { id:'end', type:0, text:'。', status:'accepted' }
  ];
  api.applyImmersiveExpansion(0);
  assert.equal(context.chapters.value[0].tempContent, '新正文。');
  assert.equal(op.done, false);
  context.setReviewSelection(op.review, 'd2', true); api.applyImmersiveExpansion(0);
  assert.equal(context.chapters.value[0].tempContent, '新正稿。');
  assert.equal(context.chapters.value[0].content, '原正文。');
  assert.equal(op.done, true);
});

test('pending review restores from book data only while the source draft still matches', async () => {
  const { context, api } = runtime();
  api.enterImmersiveExpansion(); await api.runImmersiveExpansion();
  const saved = context.novel.value.immersiveExpansionReviews['main:c1'];
  api.resetImmersiveTools(); api.enterImmersiveExpansion();
  assert.equal(api.immersiveExpandReview.value, saved);
  context.chapters.value[0].content = '另外的正文。'; api.resetImmersiveTools(); api.enterImmersiveExpansion();
  assert.equal(api.immersiveExpandReview.value, null);
});

test('accepting one review card applies only its change group and keeps remaining groups pending', async () => {
  const { context, api } = runtime();
  api.enterImmersiveExpansion(); api.immersiveExpandTags.value = { 0:'start', 1:'end' }; await api.runImmersiveExpansion();
  const op = api.immersiveExpandReview.value.operations[0];
  op.review.revisions = [
    { id:'d1', groupId:'a', type:-1, text:'原', status:'pending', selected:true },
    { id:'i1', groupId:'a', type:1, text:'新', status:'pending', selected:true },
    { id:'same', type:0, text:'正', status:'accepted' },
    { id:'d2', groupId:'b', type:-1, text:'文', status:'pending', selected:true },
    { id:'i2', groupId:'b', type:1, text:'稿', status:'pending', selected:true },
    { id:'end', type:0, text:'。', status:'accepted' }
  ];
  api.updateImmersiveReview(op, 'accept', 'd1');
  assert.equal(context.chapters.value[0].tempContent, '新正文。');
  assert.equal(op.review.revisions.find(row=>row.id==='d2').status, 'pending');
  assert.equal(context.chapters.value[0].content, '原正文。');
  api.updateImmersiveReview(op, 'reject', 'd2');
  assert.equal(op.done, true);
  assert.equal(context.chapters.value[0].tempContent, '新正文。');
});

test('invalid items in a whole-book response become disabled cards instead of aborting the batch', () => {
  const ops = ctx.prepareImmersiveExpansion('正文。', 'full', {}, JSON.stringify([null, '坏记录', { paragraph:1, text:'建议。' }]));
  assert.equal(ops.length, 3);
  assert.equal(ops[0].canApply, false); assert.equal(ops[1].canApply, false); assert.equal(ops[2].canApply, true);
});

test('changing tag tool places a complete range and clicking a tag removes it without text input', () => {
  const { api } = runtime();
  api.enterImmersiveExpansion();
  api.setImmersiveExpandTagTool('start'); api.toggleImmersiveExpandTag(0);
  assert.equal(api.immersiveExpandTagTool.value, 'end'); api.toggleImmersiveExpandTag(1);
  assert.equal(api.immersiveExpandTags.value[0], 'start');
  assert.equal(api.immersiveExpandTags.value[1], 'end');
  api.toggleImmersiveExpandTag(0); assert.equal(api.immersiveExpandTags.value[0], undefined);
});

test('all immersive template bindings are exported from setup', () => {
  const setupReturn = source.slice(source.lastIndexOf('    return {'));
  const names = new Set((source.slice(0, source.indexOf('const { createApp')).match(/\b(?:immersive[A-Z]\w*|enterImmersive\w*|onImmersive\w*|keepImmersive\w*|saveImmersive\w*|cancelImmersive\w*|setImmersive\w*|toggleImmersive\w*|runImmersive\w*|stopImmersive\w*|updateImmersive\w*|applyImmersive\w*|discardImmersive\w*|openImmersive\w*|sendImmersive\w*|beginImmersive\w*)\b/g) || []));
  for (const name of names) assert.match(setupReturn, new RegExp('\\b' + name + '\\b'), name);
});

test('the complete inline application script parses', () => {
  const script = source.slice(source.indexOf('<script>') + '<script>'.length, source.lastIndexOf('</script>'));
  assert.doesNotThrow(() => new vm.Script(script, { filename:'moyun.single.html' }));
});
