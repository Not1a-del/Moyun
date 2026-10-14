'use strict';
/*
 * 第二期·第 0 刀：预设系统重构的行为刻画（golden）测试。
 *
 * 全部调用生产源码函数（vm 提取），stub 只替换存储/网络/UI 边界：
 *   - ref/computed 极简实现（无响应式需求）、localStorage/window 空壳；
 *   - getModRuntimeSkillFragments/getModRuntimeActiveContextTools 返回 []
 *     （fixture MOD 不含 Skill 片段与 active-context 工具，与真实行为等价）；
 *   - getModelForModule/getDialogueTypePrompt 固定返回（只影响日志标签/未触发分支）。
 * 不 mock 组装逻辑本身；普通正文请求与白鸟锁定请求的消息序列以第 0 刀基线为 golden。
 *
 * golden 文件：scripts/preset-refactor.golden.json
 * 重新捕获（仅当源码 == 基线时允许）：MOYUN_CAPTURE=1 node scripts/preset-refactor.test.cjs
 * 对比历史基线：MOYUN_TEST_REF=<git-ref> node --test scripts/preset-refactor.test.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const source = process.env.MOYUN_TEST_REF
  ? execFileSync('git', ['show', `${process.env.MOYUN_TEST_REF}:source/moyun.single.html`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).replace(/\r\n/g, '\n')
  : fs.readFileSync(path.join(root, 'source/moyun.single.html'), 'utf8').replace(/\r\n/g, '\n');
const GOLDEN_PATH = path.join(__dirname, 'preset-refactor.golden.json');

/* ---------- 源码切片工具 ---------- */

function slice(startAnchor, endAnchor) {
  const i = source.indexOf(startAnchor);
  assert.ok(i !== -1, `切片起始锚点缺失: ${startAnchor.slice(0, 60)}`);
  const j = source.indexOf(endAnchor, i + startAnchor.length);
  assert.ok(j !== -1, `切片结束锚点缺失: ${endAnchor.slice(0, 60)}`);
  return source.slice(i, j);
}

function sliceInclusive(startAnchor, endAnchor) {
  const i = source.indexOf(startAnchor);
  assert.ok(i !== -1, `切片起始锚点缺失: ${startAnchor.slice(0, 60)}`);
  // endAnchor 可能就落在 startAnchor 尾部（单行自包含切片），从重叠区开始找
  const from = i + Math.max(0, startAnchor.length - endAnchor.length);
  const j = source.indexOf(endAnchor, from);
  assert.ok(j !== -1, `切片结束锚点缺失: ${endAnchor.slice(0, 60)}`);
  return source.slice(i, j + endAnchor.length);
}

function fnBlock(name, { indent = 4 } = {}) {
  const startRe = indent === 4
    ? new RegExp(`^    function ${name.replace(/\$/g, '\\$')}\\(`, 'm')
    : new RegExp(`^function ${name.replace(/\$/g, '\\$')}\\(`, 'm');
  const sm = source.match(startRe);
  assert.ok(sm, `函数未找到: ${name}`);
  const endRe = indent === 4 ? /^    \}/m : /^\}/m;
  const rest = source.slice(sm.index);
  const em = rest.match(endRe);
  assert.ok(em, `函数结束未找到: ${name}`);
  return rest.slice(0, em.index + em[0].length);
}

/* ---------- 提取块（顺序无关，合并为单脚本运行以共享作用域） ---------- */

const pieces = [
  // 桩：仅替换存储/网络/UI 边界与未提取的等价空实现
  `
  const ref = v => ({ value: v });
  const computed = arg => typeof arg === 'function'
    ? ({ get value() { return arg(); } })
    : ({ get value() { return arg.get(); }, set value(v) { arg.set(v); } });
  const deepClone = v => JSON.parse(JSON.stringify(v ?? null));
  let __uidCounter = 0;
  const uid = () => 'fixture_uid_' + (++__uidCounter);
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const window = {};
  const getModRuntimeSkillFragments = () => [];
  const getModRuntimeActiveContextTools = () => [];
  // MOD 资料表 / 记忆召回属于存储边界：fixture MOD 不含 dataTables 与记忆索引，
  // 真实两参构建器对这类 MOD 返回空串，stub 与之等价（单参包装器仍用真实代码）。
  const buildModDataTablePromptForModAndPosition = () => '';
  const buildModMemoryRecallPromptForModAndPosition = () => '';
  const getModelForModule = () => 'fixture-model';
  const getDialogueTypePrompt = () => '';
  const saveData = () => {};
  const showToast = () => {};
  // v0.0.17 适配：我方宿主在合作者基线之外保留的旧体系功能，fixture 下全部走空分支。
  // fixture 书 isAdultMode=false、模型名 fixture-model 非 deepseek、暗线矩阵为空、
  // 生图开关关闭、printLog:false —— stub 返回值与真实代码在 fixture 状态下的返回值逐一等价。
  const getFullNsfwSystemPrompt = () => '';
  const getNsfwPrompt = () => '';
  const getDeepSeekPreludeMessages = () => [];
  const getNsfwInjectionMessages = () => [];
  const buildForeshadowPromptContext = () => '';
  const imageGenEnabled = ref(false);
  const imageGenKey = ref('');
  const imageCountPerChapter = ref(2);
  const normalizeImageCount = () => 1;
  const captureChapterContextMessages = () => {};
  // printAIRequestLogs 随 pushProtectedMessage 切片以真实代码进入，不再 stub。
  const applyPromptComposer = msgs => msgs;
  // N 切片尾部的 _defaultWriterPromptTexts 快照与 loadBook 的旧键恢复引用这 4 个 ref；
  // 真实默认值函数未进切片，stub 空串对 fixture（书无这些字段 → 回退快照）等价。
  const nsfwSystemPrompt = ref('');
  const nsfwInjectionPrompt = ref('');
  const discussionPrompt = ref('');
  const oneKeySystemPrompt = ref('');
  // loadBook 恢复 nsfwSettings/dialogueTypes/personalityTagPresets 的默认快照来自 N 切片尾部的
  // _defaultNsfwSettings/_defaultDialogueTypes/_defaultPersonalityTagPresets，其引用的 ref 在桩里声明。
  const nsfwSettings = ref({});
  const dialogueTypes = ref([]);
  const personalityTagPresets = ref([]);
  // R 切片的字数契约引用 wordCountTarget（真实默认 2500；baseOptions 走显式 wordCountTarget=2500 覆盖）。
  const wordCountTarget = ref(2500);
  const promptComposerConfig = { value: { floors: [], overrides: {} } };
  // atmosphereEnabled/atmospherePrompt 随 N 切片（appendModPromptVar→_defaultDialogueTypes）真实进入。
  // promptPipeline/writingStyles/currentWritingStyleId/presets 随 K 切片（新预设→normalizeModRule）
  // 一并以真实代码进入脚本，这里不再重复声明，避免 Identifier 冲突。
  const activeStyleIds = ref([]);
  // visibleChapters 真身是过滤 chapters 的 computed；fixture 不需要过滤语义，独立 ref 手动同步即等价。
  const visibleChapters = ref([]);
  const suggestionPersona = ref('你是建议助手桩。');
  const buildStoryBibleSuggestionContextPackage = () => null;
  const getEnabledModWithFeature = () => null;
  const getModSettingValue = () => undefined;
  `,

  // A：thinking 清洗链 + 白鸟 CoT 上下文 + 审计旗标 + 章节清洗 helper（含 SNOWWING 常量）
  slice('const MOYUN_THINK_TAGS = [', 'function getCleanWordCount(text) {'),

  // B：novel/chapters/structuredCharacters/books/currentBookId 真实默认
  slice('    const novel = ref({', '    const mainScroll = ref(null);'),

  // C：storyBible
  sliceInclusive('    const storyBible = ref(null);', '    const storyBible = ref(null);'),

  // D：角色回退组装
  slice('    function buildFallbackCharacterPromptText() {', '    function buildStoryBibleWritingContextPackage(options = {}) {'),

  // E：Story Bible 正文资料包
  slice('    function buildStoryBibleWritingContextPackage(options = {}) {', '    /* Phase B.4.3'),

  // F：settings 真实默认（含闭合，需要包含式切片）
  sliceInclusive('    const settings = ref({', '    });'),

  // G：buildNsfwMessages + clipContextText + normalizeContextSettings + 大纲裁剪 + 相关 ref
  // v0.0.17 适配：终点提前到我方"其余状态"注释，排除 DOM 编辑器函数（fixture 无 DOM，且与组装无关）。
  slice('    function buildNsfwMessages(userPrompt, options = {}) {', '    /* ═══ 其余状态（占位，后续Part填充） ═══ */'),
  // G'：nextChapterPrompt ref 与 normalizeNoOutputTimeout 供 R 切片的 buildChapterMessages 使用
  sliceInclusive('    const nextChapterPrompt = ref(\'\');', '    const nextChapterPrompt = ref(\'\');'),
  fnBlock('normalizeNoOutputTimeout'),
  // G''：R 切片的 buildChapterMessages 还引用 generateCount/wordCountTarget 两个 ref（真实默认值）
  sliceInclusive('    const generateCount = ref(1);', '    const generateCount = ref(1);'),

  // H：CJK 判定 + 硬约束提取
  slice('    function isPredominantlyCjkMaterial(material) {', '    function isNarrativeHardConstraintUncertain(text) {'),

  // I：角色提示串
  slice('    const charactersPromptString = computed(() => {', '    // 中文注释：统一清洗 AI 返回的角色字段'),


  // K：MOD 规则/权限/运行时模块
  // J'：新预设数据层 + 组装 helper + MOD 常量/modPacks 默认（原 J 切片前半随第 5 刀删除，起点改为新预设区块）
  slice('    /* ═══ 新预设系统：每书扁平预设列表', '    function normalizeModRule(rule) {'),
  fnBlock('normalizeModRule'),
  fnBlock('isModPermissionEnabled'),
  fnBlock('getModRuntimeModules'),
  sliceInclusive('    function getModEnabledModules(mod) {', '      return getModRuntimeModules(mod).filter(module => module && module.enabled !== false);\n    }'),

  // L：白鸟导入判定与锁定
  slice('    function isSnowwingImportMod(mod) {', '    function validateSnowwingSkillPack(data) {'),

  // M：MOD 文本钩子（含 applyModTextHooks 本体）
  slice('    function getModHookEntries(hookName, modFilter = null) {', '    // 中文注释：事件钩子当前只允许 toast'),

  // N：宏展开 + 白鸟锁定装配 + MOD 规则注入 + 无限模式 + narrativePerson/getPersonPresetContent
  // v0.0.17 适配：我方该区间尾部没有合作者的注释锚，改用 _defaultDialogueTypes 定义行作为终点。
  slice('    function appendModPromptVar(vars, key, value) {', '    const _defaultDialogueTypes = deepClone(dialogueTypes.value);'),

  // P：作者资料段 + 白鸟作者上下文 + 组装总入口（v0.0.17 适配：我方等价链
  // getPipelineLayer→buildPipelineLayerPrompt→buildSnowwingAuthorContextPrompt→buildFullSystemPrompt）
  slice('    function getPipelineLayer(key) {', '    const showOutlineInMain = ref(false);'),
  // P'：getMergedStylePrompt 真身（buildPipelineLayerPrompt 的 style 分支依赖）
  fnBlock('getMergedStylePrompt'),

  // Q：连续生成计数
  sliceInclusive('    let _remainingCount = 0;', '    let _remainingCount = 0;'),
  sliceInclusive('    let _generationStopReason', '    let _generationStopReason'),

  // R：字数契约 + 章节消息组装
  slice('    function getChapterLengthContract(target = wordCountTarget.value) {', '    function buildReasoningOnlyRescueMessages(baseMessages, generationCot, mode = \'generate\') {'),

  // S/T：summaries/chapterOutlines（activeStyleIds 切片随第 5 刀删除声明移除）
  sliceInclusive('    const summaries = ref([]);', '    const summaries = ref([]);'),
  sliceInclusive('    const chapterOutlines = ref([]);', '    const chapterOutlines = ref([]);'),

  // U：白鸟 active-context mods 链（fixture MOD 无 active-context 工具 → 等价空）
  slice('    function isSnowwingActiveContextEnabled(mod) {', "    function parseSnowwingContextCallJson(raw = '') {"),

  fnBlock('replaceInlineImageTags'),
  // X：建议提示组装（第4刀 T11：旧预设补充指令退出、新 COT/预注入不外溢）
  slice('    function buildSuggestionPrompt(options = {}) {', '    function isSuggestionRunCurrent(run) {'),

  // W：MOD 资料表 / 记忆召回的单参包装器（真实代码）
  slice('    function buildModDataTablePromptForPosition(position) {', '    // 中文注释：清空插件私有数据只清理该插件分区'),
  slice('    function buildModMemoryRecallPromptForPosition(position, context = {}) {', '    async function clearModMemoryIndex(mod) {'),

  // 消息捕获 helper（buildNsfwMessages 无条件调用 printAIRequestLogs）
  slice('    function pushProtectedMessage(messages, safeState, message) {', 'function mapChapterContextMessages(messages) {'),

  // 对外暴露（const 不挂 context，用 this 桥接）
  // 注：新预设数据层（常量/normalize/sync/组装 helper）已随切片 J（promptPipeline→normalizeModRule）
  // 一并进入脚本——第 1 刀把它插在该区间内部，无需也不可重复切片。
  `
  this.__api = {
    buildChapterMessages, buildFullSystemPrompt, buildNsfwMessages,
    buildSnowwingAuthorContextPrompt, buildPipelineLayerPrompt, getMergedStylePrompt,
    buildChapterHistoryContext,
    collectEnabledPromptPresets, buildHostPresetSystemSections, buildPromptPresetMessages, buildCotPresetContent,
    syncBuiltinPromptPresets, BUILTIN_PROMPT_PRESETS, PROMPT_PRESET_DYNAMIC_MEMORY_SEGMENT, promptPresets,
    buildSnowwingAuthorContextPrompt, buildSnowwingLockedPrompt, collectSnowwingCotContextFromMessages,
    novel, chapters, structuredCharacters, books, currentBookId, settings, summaries, chapterOutlines,
    modPacks, storyBible,
    visibleChapters, narrativePerson,
    // v0.0.17 适配：场景改写需要直接操作流水线层与文风 refs（K 切片真实代码）。
    promptPipeline, writingStyles, currentWritingStyleId, activeStyleIds,
    isSnowwingPresetLocked,
    buildSuggestionPrompt, buildInfiniteContextPrompt, window
  };
  `
];

const SCRIPT = pieces.join('\n');

function harness() {
  const ctx = vm.createContext({
    Vue: { reactive: value => value },
    console: Object.assign(Object.create(console), {
      group: () => {}, groupEnd: () => {}, table: () => {}, log: () => {}, warn: () => {}, info: () => {}
    })
  });
  try {
    vm.runInContext(SCRIPT, ctx, { filename: 'moyun-preset-refactor-extract.cjs' });
  } catch (e) {
    if (process.env.MOYUN_CAPTURE) {
      const dump = path.join(root, '..', '_moyun_phase2_audit', 'cut-0', 'merged-extract.cjs');
      fs.mkdirSync(path.dirname(dump), { recursive: true });
      fs.writeFileSync(dump, SCRIPT, 'utf8');
      console.error('合并脚本已转储: ' + dump);
    }
    throw e;
  }
  return ctx.__api;
}

/* ---------- fixture ---------- */

const ch0 = {
  id: 'ch1', title: '第一章 旧书店',
  content: '第一章 旧书店\n\n雨停了。林晚推开书店的门，风铃响了一声。\n\n“有人吗？”\n\n柜台后没有人，只有一盏黄灯亮着。',
  summary: '林晚进入旧书店，遇到店主陈叔，开始整理旧书。'
};
const ch1 = {
  id: 'ch2', title: '第二章 一封信',
  content: '第二章 一封信\n\n陈叔从抽屉深处递来一个牛皮纸信封。\n\n“这封信，等了三十年。”',
  summary: '陈叔交给林晚一封旧信，委托她寻找收信人。'
};

const snowwingMod = {
  id: 'moyun.linxun.snowwing-pair',
  name: '白鸟·雪翼成双',
  enabled: true,
  permissions: ['prompt:write'],
  rules: [
    { name: '白鸟文风', position: 'style', enabled: true, content: '文风基调：朴素白描，避免堆砌修辞。' },
    { name: '白鸟推演', position: 'writing', enabled: true, content: '白鸟·雪翼成双 推演链要求。\n核心思路：保持克制白描，先自检再落笔。\n【问题】当前剧情：承接旧书店寻信主线。\n【问题】输出边界：不写总结，不复述规则。' }
  ],
  modules: []
};

function baseState(api) {
  api.novel.value = {
    title: '测试书：旧书店来信',
    theme: '现代都市背景的轻奇幻故事，围绕一家旧书店展开。',
    synopsis: '林晚接手一家旧书店，替店主寻找一封三十年前的信的收信人。',
    worldView: '现实都市，存在少量无法解释的巧合，但没有超自然力量。',
    negativePrompt: '',
    outline: '三幕结构：接信、寻人、送达。'
  };
  api.chapters.value = [ch0, ch1];
  api.visibleChapters.value = api.chapters.value;
  api.structuredCharacters.value = [{
    id: 'c1', name: '林晚', desc: '旧书店的年轻店员，认真而好奇。',
    personalityTags: ['细心', '好奇'], speakingStyle: '温和、略带书卷气',
    exampleDialogues: ['这封信……是给我的？'], characterPrompt: '', relationships: []
  }];
  api.books.value = [{ id: 'bookA', strictTheme: false }];
  api.currentBookId.value = 'bookA';
  api.summaries.value = [];
  api.chapterOutlines.value = [{ title: '第三章 线索', content: '林晚按信封上的地址找到老宅，发现门牌被人换过。' }];
  api.storyBible.value = null;
  api.modPacks.value = [];
  api.narrativePerson.value = 'third';
  // 新预设列表：真实书籍经 loadBook 同步必有 16 条默认；fixture 等价初始化（NSFW 默认关、人称 third）
  api.promptPresets.value = api.syncBuiltinPromptPresets([], 'third');
  // 被场景改写过的状态在这里恢复默认，防止场景间泄漏
  api.settings.value.contextCompactMode = false;
  api.settings.value.contextUseFullText = true;
  api.settings.value.contextUseChapterSummaries = true;
  api.settings.value.contextUseRangeSummaries = true;
  api.window.SNOWWING_DISABLE_HOST_COT_CARRIER = false;
  // v0.0.17 适配：我方流水线层开关可被场景改写（layerWorldDisabled），场景间同样恢复默认全开。
  api.promptPipeline.value.forEach(layer => { layer.enabled = true; });
  api.currentWritingStyleId.value = '';
  api.activeStyleIds.value = [];
}

const baseOptions = () => ({
  contextChapters: [ch0, ch1],
  currentChapterNo: 3,
  promptOverride: '两个成年人在旧书店寻找一封信',
  wordCountTarget: 2500,
  printLog: false
});

const serialize = msgs => JSON.stringify(msgs, null, 1);

/* ---------- golden 捕获与比较 ---------- */

function buildScenarios(api) {
  const scenarios = {};
  baseState(api);
  scenarios.normal = serialize(api.buildChapterMessages(baseOptions()));

  baseState(api);
  api.modPacks.value = [JSON.parse(JSON.stringify(snowwingMod))];
  scenarios.snowwingLocked = serialize(api.buildChapterMessages(baseOptions()));

  baseState(api);
  // 宿主 COT 关闭：无协议、无动态段、无末尾提醒（§3.4；旧 contextUseFinalCheck 已删，不再有对应开关）
  api.promptPresets.value = api.promptPresets.value.map(item => item.name === 'COT 推演协议' ? Object.assign({}, item, { enabled: false }) : item);
  scenarios.hostCotDisabled = serialize(api.buildChapterMessages(baseOptions()));

  baseState(api);
  api.books.value = [{ id: 'bookA', strictTheme: true }];
  api.novel.value.theme = '都市。'.repeat(300);
  api.novel.value.negativePrompt = '禁止出现真实地点名称';
  scenarios.strictThemeNegative = serialize(api.buildChapterMessages(baseOptions()));

  baseState(api);
  api.summaries.value = [{ useForContext: true, startChapter: 1, endChapter: 2, content: '第一至二章：林晚接手书店并受托寻人。' }];
  scenarios.rangeSummary = serialize(api.buildChapterMessages(baseOptions()));

  baseState(api);
  api.currentWritingStyleId.value = 'ws1';
  scenarios.stylePreset = serialize(api.buildChapterMessages(baseOptions()));

  baseState(api);
  api.promptPipeline.value.find(l => l.key === 'world').enabled = false;
  scenarios.layerWorldDisabled = serialize(api.buildChapterMessages(baseOptions()));

  baseState(api);
  api.novel.value.worldView = '世界观片段。'.repeat(1000);
  api.settings.value.contextCompactMode = true;
  scenarios.compactClip = serialize(api.buildChapterMessages(baseOptions()));

  baseState(api);
  api.settings.value.contextUseFullText = false;
  scenarios.chapterSummariesNoFull = serialize(api.buildChapterMessages(baseOptions()));

  baseState(api);
  scenarios.continueSequence = serialize(api.buildChapterMessages(Object.assign(baseOptions(), { mode: 'continue', sequenceTotal: 3, sequenceIndex: 2 })));

  baseState(api);
  scenarios.sequenceMulti = serialize(api.buildChapterMessages(Object.assign(baseOptions(), { sequenceTotal: 3, sequenceIndex: 2 })));

  baseState(api);
  scenarios.nsfwMessages = serialize(api.buildNsfwMessages('请生成第三章大纲：老宅线索', { taskType: 'outline', systemPrompt: '你是大纲助手。' }));

  scenarios.buildNsfwMessagesSource = slice('    function buildNsfwMessages(userPrompt, options = {}) {', '    // 中文注释：限制长文本注入长度');

  baseState(api);
  api.modPacks.value = [JSON.parse(JSON.stringify(snowwingMod))];
  // 承载独立性：SNOWWING_DISABLE_HOST_COT_CARRIER 审计旗只关白鸟承载，不影响任何宿主文本
  api.window.SNOWWING_DISABLE_HOST_COT_CARRIER = true;
  scenarios.carrierAuditFlag = serialize(api.buildChapterMessages(baseOptions()));

  scenarios.lockedFullSystemPrompt = (() => {
    baseState(api);
    api.modPacks.value = [JSON.parse(JSON.stringify(snowwingMod))];
    return serialize([{ role: 'system', content: api.buildFullSystemPrompt({ contextChapters: [ch0, ch1] }) }]);
  })();

  return scenarios;
}

function loadGolden() {
  return JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
}

if (process.env.MOYUN_CAPTURE) {
  const scenarios = buildScenarios(harness());
  fs.writeFileSync(GOLDEN_PATH, JSON.stringify(scenarios, null, 2) + '\n', 'utf8');
  console.log('golden captured → ' + GOLDEN_PATH);
} else {
  const golden = loadGolden();

  test('第0刀 golden：普通正文请求的消息序列与基线逐字一致', () => {
    const api = harness();
    baseState(api);
    const actual = serialize(api.buildChapterMessages(baseOptions()));
    if (process.env.MOYUN_DIFF && actual !== golden.normal) {
      const dir = path.join(root, '..', '_moyun_phase2_audit', 'cut-0');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'normal-actual.json'), actual, 'utf8');
      fs.writeFileSync(path.join(dir, 'normal-expected.json'), golden.normal, 'utf8');
    }
    assert.equal(actual, golden.normal);
  });

  test('第0刀 golden：白鸟锁定请求的消息序列与基线逐字一致', () => {
    const api = harness();
    baseState(api);
    api.modPacks.value = [JSON.parse(JSON.stringify(snowwingMod))];
    assert.equal(serialize(api.buildChapterMessages(baseOptions())), golden.snowwingLocked);
  });

  test('第4刀 golden：宿主 COT 关闭后无推演协议、无动态段、无末尾提醒', () => {
    const api = harness();
    baseState(api);
    api.promptPresets.value = api.promptPresets.value.map(item => item.name === 'COT 推演协议' ? Object.assign({}, item, { enabled: false }) : item);
    const actual = serialize(api.buildChapterMessages(baseOptions()));
    if (process.env.MOYUN_DIFF && actual !== golden.hostCotDisabled) {
      const dir = path.join(root, '..', '_moyun_phase2_audit', 'cut-4');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'hostCotDisabled-actual.json'), actual, 'utf8');
      fs.writeFileSync(path.join(dir, 'hostCotDisabled-expected.json'), golden.hostCotDisabled, 'utf8');
    }
    assert.equal(actual, golden.hostCotDisabled);
    const msgs = JSON.parse(actual);
    assert.ok(!msgs[0].content.includes('[续写意图分析]'), '无 COT 协议');
    assert.ok(!msgs.some(m => m.content.includes('按规则输出<thinking></thinking>后再输出正文')), '无末尾提醒');
  });

  test('第4刀 golden：白鸟承载独立于旧开关——审计旗关闭承载后其余逐字不变', () => {
    const api = harness();
    baseState(api);
    api.modPacks.value = [JSON.parse(JSON.stringify(snowwingMod))];
    api.window.SNOWWING_DISABLE_HOST_COT_CARRIER = true;
    const actual = serialize(api.buildChapterMessages(baseOptions()));
    if (process.env.MOYUN_DIFF && actual !== golden.carrierAuditFlag) {
      const dir = path.join(root, '..', '_moyun_phase2_audit', 'cut-4');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'carrierAuditFlag-actual.json'), actual, 'utf8');
      fs.writeFileSync(path.join(dir, 'carrierAuditFlag-expected.json'), golden.carrierAuditFlag, 'utf8');
    }
    assert.equal(actual, golden.carrierAuditFlag);
    const msgs = JSON.parse(actual);
    assert.ok(!msgs.some(m => m.content.includes('【白鸟推演承载要求】')), '承载被审计旗关闭');
    // v0.0.17 适配：我方保留【最终执行校验】段（承载文本并入其中）；审计旗关闭后该段仍在但无承载文本。
    const finalCheck = msgs.find(m => m.content && m.content.includes('【最终执行校验】'));
    assert.ok(finalCheck, '最终校验段保留');
    assert.ok(!finalCheck.content.includes('【白鸟推演承载要求】'), '校验段中承载文本被审计旗关闭');
    // 锁定态宿主 COT/预注入均不注入；承载关闭后 user 收尾为普通消息
    assert.ok(!msgs[0].content.includes('小说续写模式'), '锁定态无宿主破限');
    assert.equal(msgs[msgs.length - 1].role, 'user');
  });

  test('第4刀 golden：严格主题保留新位、负面注入退出', () => {
    const api = harness();
    baseState(api);
    api.books.value = [{ id: 'bookA', strictTheme: true }];
    api.novel.value.theme = '都市。'.repeat(300);
    api.novel.value.negativePrompt = '禁止出现真实地点名称';
    assert.equal(serialize(api.buildChapterMessages(baseOptions())), golden.strictThemeNegative);
  });

  test('第4刀 golden：范围总结注入历史且 COT 恰带一份动态记忆段', () => {
    const api = harness();
    baseState(api);
    api.summaries.value = [{ useForContext: true, startChapter: 1, endChapter: 2, content: '第一至二章：林晚接手书店并受托寻人。' }];
    const msgs = api.buildChapterMessages(baseOptions());
    assert.equal(serialize(msgs), golden.rangeSummary);
    assert.equal((msgs[0].content.match(/\[记忆整理\]/g) || []).length, 1);
    assert.ok(msgs[0].content.indexOf('[记忆整理]') < msgs[0].content.indexOf('[续写意图分析]\n'));
  });

  // 注：第 4 刀的"旧文风/旧预设/旧流水线开关零影响"两测试随旧声明删除而移除——
  // 第 5 刀后旧 ref 不存在，旧状态无法影响请求是结构性保证（golden.normal 本身不变）。

  test('第0刀 golden：白鸟锁定态的 buildFullSystemPrompt 与基线逐字一致', () => {
    const api = harness();
    baseState(api);
    api.modPacks.value = [JSON.parse(JSON.stringify(snowwingMod))];
    const out = serialize([{ role: 'system', content: api.buildFullSystemPrompt({ contextChapters: [ch0, ch1] }) }]);
    assert.equal(out, golden.lockedFullSystemPrompt);
  });

  test('第0刀 golden：buildNsfwMessages 通用组装与基线逐字一致', () => {
    const api = harness();
    baseState(api);
    const out = serialize(api.buildNsfwMessages('请生成第三章大纲：老宅线索', { taskType: 'outline', systemPrompt: '你是大纲助手。' }));
    assert.equal(out, golden.nsfwMessages);
  });

  test('第0刀 保护：buildNsfwMessages 源码逐字节保持（MOD 协议兼容面）', () => {
    assert.equal(slice('    function buildNsfwMessages(userPrompt, options = {}) {', '    // 中文注释：限制长文本注入长度'), golden.buildNsfwMessagesSource);
  });

  test('第4刀 结构：system 置首排尾 + 预注入独立消息 + 宿主硬编码全部退出', () => {
    const api = harness();
    baseState(api);
    const msgs = api.buildChapterMessages(baseOptions());
    // v0.0.17 适配：我方保留 contextUseFinalCheck（【最终执行校验】独立消息），序列比合作者基线多 1 条 user。
    assert.equal(JSON.stringify(msgs.map(m => m.role)), JSON.stringify(['system', 'user', 'assistant', 'user', 'assistant', 'user', 'user', 'user']));
    const sys = msgs[0].content;
    // core 置首、COT 排尾；作者资料与格式契约在中间
    assert.ok(sys.startsWith('# 小说续写模式'), 'core 置首');
    assert.ok(sys.endsWith('</thinking_protocol>'), 'COT 必须位于最终 system 末尾，而非仅在 helper 内排尾');
    assert.ok(sys.indexOf('<prohibited_content>') > -1 && sys.indexOf('<prohibited_content>') < sys.indexOf('【世界观设定】'), 'system 预设在作者资料前');
    assert.ok(sys.indexOf('【世界观设定】') < sys.indexOf('【角色设定】') && sys.indexOf('【角色设定】') < sys.indexOf('【故事大纲与细纲】'), '作者资料顺序固定');
    assert.ok(sys.indexOf('---剧情摘要---') > sys.indexOf('【故事大纲与细纲】'), '格式契约在资料后');
    // v0.0.17 适配：我方 buildChapterMessages 会在 buildFullSystemPrompt 返回后追加"要求/校准/摘要硬约束"，
    // 因此只断言 COT 位于全部宿主预设段之后、且在负面提示词等旧体系段之后（buildFullSystemPrompt 内部末段语义）。
    assert.ok(sys.lastIndexOf('<thinking_protocol>') > sys.lastIndexOf('<prohibited_content>'), 'COT 在宿主预设末段');
    // 宿主硬编码（v0.0.17 适配：【模型执行校准】是我方 buildChapterMessages 保留段，与 COT 协议并存）
    ['环境氛围'].forEach(token => {
      assert.ok(!sys.includes(token), '退出: ' + token);
    });
    // v0.0.17 适配：我方保留【最终执行校验】独立消息（合作者第5刀删除，我们不做该删减）；
    // 非锁定 fixture（无白鸟 MOD）下承载文本不并入，只断言校验消息存在。
    const finalCheck = msgs.find(m => m.content && m.content.includes('【最终执行校验】'));
    assert.ok(finalCheck, '最终校验消息保留');
    // 末尾提醒挂在最后一条普通 user 消息末尾（v0.0.17 适配：我方末条 user 是【最终执行校验】）
    const last = msgs[msgs.length - 1];
    assert.equal(last.role, 'user');
    assert.ok(last.content.includes('【最终执行校验】'), '末条 user 为最终校验');
    assert.ok(last.content.endsWith('按规则输出<thinking></thinking>后再输出正文'), 'COT 提醒追加在末尾');
  });

  test('第4刀 结构：锁定请求为独立白鸟承载、宿主预设零注入', () => {
    const api = harness();
    baseState(api);
    api.modPacks.value = [JSON.parse(JSON.stringify(snowwingMod))];
    const msgs = api.buildChapterMessages(baseOptions());
    // v0.0.17 适配：我方锁定序列 4 条——【最终执行校验】（白鸟承载并入其中）为末条 user。
    assert.equal(JSON.stringify(msgs.map(m => m.role)), JSON.stringify(['system', 'user', 'user', 'user']));
    const system = msgs[0].content;
    assert.ok(system.includes('【世界观设定】'), '作者资料（世界观）在锁定态注入');
    assert.ok(system.includes('白鸟·雪翼成双 推演链要求'), '白鸟锁定装配保留');
    assert.ok(!system.includes('小说续写模式'), '宿主 core 不进锁定请求');
    assert.ok(!system.includes('小说续写模式'), '宿主 core 不进锁定请求');
    assert.ok(!system.includes('<thinking_protocol>'), '宿主 COT 不进锁定请求');
    // v0.0.17 适配：【叙事视角】是我方保留的宿主段（人称语义由隐藏预设+该段共同承载），锁定态仍按我方 v0.0.16 语义注入。
    // 承载文本并入【最终执行校验】消息（我方保留段），验证其存在与原文。
    const finalCheck = msgs.find(m => m.content && m.content.includes('【最终执行校验】'));
    assert.ok(finalCheck, '锁定态最终校验消息保留');
    assert.ok(finalCheck.content.includes('【白鸟推演承载要求】'), '承载文本并入最终校验');
    assert.ok(finalCheck.content.includes('白鸟过河滩，逆风越泽川'), '承载原文保留');
  });

  /* ==================== 第 1 刀：新数据、同步器与持久化 ==================== */

  // 新预设数据层切片（常量 + normalize/sync）
  const NEW_SECTION = slice('    /* ═══ 新预设系统：每书扁平预设列表', '    /* ═══ MOD 共创插件系统 ═══ */');

  // 存储矩阵切片
  const SYNC_BOOK_DATA = slice('    function syncBookData() {', '\n    // 中文注释：新书只继承插件配置');
  const INIT_BOOKS = slice('    /* 初始化书架 */\n    function initBooks() {', '    /* ═══ 书架操作 ═══ */');
  const CREATE_AND_LOAD_BOOK = slice('    function createNewBook(title, theme, worldView) {', '    function returnToWritingSurface() {');
  const SAVE_SNAPSHOT = slice('    function saveSnapshot(reason) {', '    function loadSnapshots() {');
  const RESTORE_SNAPSHOT = slice('    function restoreSnapshot(snap) {', '    function clearAll() {');
  const CLEAR_ALL = slice('    function clearAll() {', '    const activeSettingsTab');
  const EXPORT_FULL_BACKUP = slice('    async function performExportBookFullBackup() {', '    // 书名与章节名同样可能来自旧 AI 结果');
  const RESOLVE_IMPORTED = slice('    function resolveImportedBookData(data) {', '    // TXT 导入处理');

  function storageHarness() {
    const R = v => ({ value: v });
    const noop = () => {};
    const savedBooks = [];
    let capturedBlob = null;
    const toasts = [];
    const __snowwingLock = { value: false };
    const ctx = vm.createContext({
      console,
      Vue: { reactive: value => value },
      __snowwingLock,
      // UI 函数（NEW_SECTION 内）运行时依赖：锁定可切换、toast 可断言
      isSnowwingPresetLocked: () => __snowwingLock.value,
      showToast: (message, type) => toasts.push({ message, type }),
      setTimeout: () => 0,
      uid: (() => { let n = 0; return () => 'fixture_id_' + (++n); })(),
      deepClone: v => JSON.parse(JSON.stringify(v ?? null)),
      // 旧预设归一化不属于本刀断言目标：identity stub 对新字段链路无影响。
      normalizePromptPipeline: x => x,
      normalizeBuiltinPresets: x => Array.isArray(x) ? x : [],
      normalizeStoryBible: x => x,
      normalizeNovelVolumes: x => Array.isArray(x) ? x : [],
      normalizePromptComposer: x => (x && typeof x === 'object') ? x : { floors: [], overrides: [] },
      normalizeForeshadowMatrix: x => Array.isArray(x) ? x : [],
      normalizeChapterIndexDrafts: x => Array.isArray(x) ? x : [],
      normalizeModPacks: x => Array.isArray(x) ? x : [],
      normalizeInstalledThemePacks: x => Array.isArray(x) ? x : [],
      normalizeSnowwingChapterStoryTimeRecord: noop,
      normalizeCharacterProfile: noop,
      normalizeImportedChapter: x => x,
      createDefaultStoryBible: () => null,
      buildNewBookModPrivateDataSnapshot: () => ({}),
      isChapterEditDirty: () => false,
      discardChapterEditDraft: noop,
      notifyRestoredChapterEdits: noop,
      stopOutlineRunsForBookChange: noop,
      cancelAiRunsForBookChange: noop,
      resetCharacterDraftReviewForBookChange: noop,
      resetRelationshipGraphState: noop,
      clearRealContextDiagnostics: noop,
      resetCharacterStateDraft: noop,
      restoreInterruptedDraftForBook: noop,
      syncInterruptedDraftToCurrentBook: noop,
      applyImportedInterruptedDraft: () => false,
      repairDanglingCharacterReferences: noop,
      repairStoryBibleReferences: noop,
      applyActiveThemePack: noop,
      buildSanitizedModPrivateDataForExport: () => ({}),
      buildCurrentInterruptedDraftRecord: () => null,
      saveDataNow: async () => true,
      // 图片为独立 IDB 存储边界；此 fixture 无图片，备份回空表。
      ImageStore: { exportBook: async () => ({}) },
      saveData: noop,
      openConfirm: (opts, cb) => cb(),
      // 新书缺省值（loadBook 兜底用；旧活动键缺省随第 5 刀删除声明一并移除）
      _defaultDialogueTypes: [], _defaultPersonalityTagPresets: [],
      _defaultPipeline: [], _defaultPresets: [], _defaultWritingStyles: [], _defaultNsfwSettings: {},
      _defaultAtmospherePrompt: '', _defaultPromptPresets: [], _defaultWriterPromptTexts: {},
      promptComposerConfig: { value: { floors: [], overrides: [] } },
      // loadBook 恢复旧键（nsfwSystemPrompt 等 4 个 ref）在 storage 脚本内以 ref 形式声明。
      nsfwSystemPrompt: R(''), nsfwInjectionPrompt: R(''), discussionPrompt: R(''), oneKeySystemPrompt: R(''),
      lastRemovedDarklinePlan: R(null), lastSentPrompt: R(null), showPromptPreview: R(false), nsfwSettings: R({}),
      imageProfiles: R([]), activeProfileId: R(''),
      SnapshotDB: { save: async snap => { savedBooks.push(snap); return { ok: true }; } },
      // v0.0.16 的轻量引用快照函数（saveSnapshot/restoreSnapshot 用）：深拷贝语义对 fixture 等价。
      snapshotForSerialize: v => JSON.parse(JSON.stringify(v ?? null)),
      totalWordCount: R(0),
      // DOM/Blob 边界：只捕获导出的 JSON 字符串
      Blob: class { constructor(parts) { this.parts = parts; } },
      URL: { createObjectURL: blob => { capturedBlob = blob; return 'blob:fixture'; }, revokeObjectURL: noop },
      document: {
        createElement: () => ({ click() {} }),
        body: { appendChild: noop, removeChild: noop }
      },
      // 存储矩阵触及的全部 ref
      books: R([]), currentBookId: R(''), currentChapterIndex: R(-1),
      novel: R({}), chapters: R([]), structuredCharacters: R([]), storyBible: R(null),
      branchList: R([]), activeBranchId: R('main'), chapterOutlines: R([]), chapterIndexDrafts: R([]),
      outlineRevisions: R([]), selectedRevId: R(''), activeStyleIds: R([]), coverImage: R(''),
      promptPipeline: R([]), presets: R([]), writingStyles: R([]), currentWritingStyleId: R(''),
      modPacks: R([]), installedThemePacks: R([]), activeThemePackId: R(''), modPrivateData: R({}),
      atmosphereEnabled: R(false), atmospherePrompt: R(''), dialogueTypes: R([]), personalityTagPresets: R([]),
      summaries: R([]), narrativePerson: R('third'), promptPresets: R([]),
      selectedStoryBibleEntryId: R(''), selectedWorkbenchCharacterId: R(''), showSnapshots: R(false),
      lastChapterContextMessages: R([]), lastChapterContextMeta: R(null),
      safeChapterContextMessages: R([]), safeChapterContextMeta: R(null), safeChapterContextError: R(''),
      lastGenerationCotContext: R(null), foreshadowMatrix: R([]),
      legacyRemovedLibraryFields: R({}), oneKeySystemPrompt: R('')
    });
    const script = [
      'const ref = v => ({ value: v });\nconst computed = fn => ({ get value() { return fn(); } });\nconst localStorage = { getItem: () => null, setItem() {}, removeItem() {} };\nconst window = {};\nconst LEGACY_PRESET_ROOT_KEYS = [\'promptPipeline\', \'presets\', \'writingStyles\', \'currentWritingStyleId\', \'activeStyleIds\', \'atmosphereEnabled\', \'atmospherePrompt\'];\nconst legacyPresetRootFields = { value: {} };',
      NEW_SECTION, SYNC_BOOK_DATA, INIT_BOOKS, CREATE_AND_LOAD_BOOK, SAVE_SNAPSHOT, RESTORE_SNAPSHOT, CLEAR_ALL, EXPORT_FULL_BACKUP, RESOLVE_IMPORTED,
      'this.__api = { syncBookData, initBooks, createNewBook, loadBook, saveSnapshot, restoreSnapshot, clearAll, performExportBookFullBackup, resolveImportedBookData, normalizeNarrativePerson, normalizePromptPresetRole, normalizePromptPreset, normalizePromptPresetList, syncBuiltinPromptPresets, syncNarrativePersonPresets, BUILTIN_PROMPT_PRESETS, PROMPT_PRESET_DYNAMIC_MEMORY_SEGMENT, books, currentBookId, novel, chapters, structuredCharacters, storyBible, branchList, activeBranchId, chapterOutlines, chapterIndexDrafts, outlineRevisions, activeStyleIds, coverImage, promptPipeline, presets, writingStyles, currentWritingStyleId, modPacks, installedThemePacks, activeThemePackId, modPrivateData, atmosphereEnabled, atmospherePrompt, dialogueTypes, personalityTagPresets, summaries, narrativePerson, promptPresets, totalWordCount, legacyRemovedLibraryFields, legacyPresetRootFields, oneKeySystemPrompt, visiblePromptPresets, canEditPromptPresetContent, canDeletePromptPreset, canMovePromptPreset, movePromptPreset, togglePromptPresetEnabled, addPromptPreset, openPromptPresetEditor, savePromptPresetEditor, deletePromptPresetItem, cancelPromptPresetEditor, setNarrativePerson, uniquePromptPresetImportName, promptPresetEditor, showPromptPresetEditor };'
    ].join('\n');
    vm.runInContext(script, ctx, { filename: 'moyun-preset-refactor-storage.cjs' });
    return { api: ctx.__api, savedBooks, toasts, lock: __snowwingLock, captureExport: () => capturedBlob && capturedBlob.parts[0] };
  }

  function storageFixture(api, personA = 'first', personB = 'third') {
    // 两本书带不同哨兵：A 第一人称 + 自定义条目 + NSFW 用户文本；B 第三人称 + 不同排序
    const listA = [
      { name: '我的自定义设定', content: '哨兵-A-自定义', enabled: true, role: 'user' },
      { name: 'NSFW 增强', content: '哨兵-A-NSFW-用户文本', enabled: true, role: 'system' },
      { name: '防替写', content: '被篡改的旧内容', enabled: false, role: 'user' }
    ];
    const listB = [
      { name: 'COT 推演协议', content: '被篡改', enabled: false, role: 'system' },
      { name: '小说续写模式', content: '被篡改', enabled: false, role: 'system' }
    ];
    api.books.value = [
      { id: 'bookA', title: '书A', novel: { title: '书A' }, chapters: [{ id: 'cA', title: 'A章', content: 'A 正文内容' }], characters: [], promptPresets: listA, narrativePerson: personA,
        // 二期旧活动键哨兵：停写后必须原值保留
        presets: [{ id: 'old-p1', name: '旧预设哨兵', content: '旧-A-原值', enabled: true, applyTo: ['writing'] }],
        promptPipeline: [{ key: 'pre', label: '前置词', content: '旧流水线哨兵-A', enabled: true }],
        atmospherePrompt: '旧氛围哨兵-A' },
      { id: 'bookB', title: '书B', novel: { title: '书B' }, chapters: [{ id: 'cB', title: 'B章', content: 'B 正文内容' }], characters: [], promptPresets: listB, narrativePerson: personB,
        atmospherePrompt: '旧氛围哨兵-B' }
    ];
  }

  const PERSON_FIRST_CONTENT = '<first_person_perspective>';
  const PERSON_THIRD_NAME = '人称视角 · 第三人称';
  const PERSON_FIRST_NAME = '人称视角 · 第一人称';
  const NSFW_NAME = 'NSFW 增强';
  const NSFW_FROZEN_PLACEHOLDER = '本条目不预置内容';

  /* T01：16 条常量与冻结文档逐字一致（独立解析 MD，不与生成器共用代码） */
  test('第1刀 T01：16 条内置常量与冻结 Markdown 逐字一致（含 role/默认/锚点/隐藏）', () => {
    const doc = fs.readFileSync(path.join(root, 'docs/refactor/preset-drafts.md'), 'utf8');
    // 独立提取：按 "## " 分节取各条目围栏
    const sectionOf = startRe => {
      const i = doc.search(startRe);
      assert.ok(i !== -1, 'MD 缺章节: ' + startRe);
      const head = doc.slice(i, doc.indexOf('\n', i) + 1);
      const fenceStart = doc.indexOf('```', i + head.length);
      const bodyStart = doc.indexOf('\n', fenceStart) + 1;
      const bodyEnd = doc.indexOf('\n```', bodyStart);
      return doc.slice(bodyStart, bodyEnd);
    };
    const expected = new Map();
    expected.set('小说续写模式', sectionOf(/^## 1\. 小说续写模式/m));
    const preinject = sectionOf(/^## 2-5\. 续写预注入/m);
    const parts = preinject.split(/^【(?=User 1】|AI 1】|User 2】|AI 2】)/m).slice(1);
    assert.equal(parts.length, 4);
    expected.set('续写预注入 · User 1', parts[0].replace(/^User 1】\(role: user\)\n/, '').replace(/\n+$/, ''));
    expected.set('续写预注入 · AI 1', parts[1].replace(/^AI 1】\(role: assistant\)\n/, '').replace(/\n+$/, ''));
    expected.set('续写预注入 · User 2', parts[2].replace(/^User 2】\(role: user\)\n/, '').replace(/\n+$/, ''));
    expected.set('续写预注入 · AI 2', parts[3].replace(/^AI 2】\(role: assistant\)\n/, '').replace(/\n+$/, ''));
    expected.set('防替写', sectionOf(/^## 6\. 防替写/m));
    expected.set('防神化', sectionOf(/^## 7\. 防神化/m));
    expected.set('人格成立', sectionOf(/^## 8\. 人格成立/m));
    expected.set('活人感', sectionOf(/^## 9\. 活人感/m));
    expected.set('防重复', sectionOf(/^## 10\. 防重复/m));
    expected.set('文风基线（抗八股）', sectionOf(/^## 11\. 文风基线/m));
    expected.set('NSFW 增强', sectionOf(/^## 12\. NSFW 增强/m));
    expected.set('禁止规则', sectionOf(/^## 13\. 禁止规则/m));
    expected.set('COT 推演协议', sectionOf(/^## 14\. COT 推演协议/m));
    const personFence = sectionOf(/^## 隐藏条目：人称视角/m);
    expected.set('人称视角 · 第一人称', personFence.match(/<first_person_perspective>[\s\S]*?<\/first_person_perspective>/)[0]);
    expected.set('人称视角 · 第三人称', personFence.match(/<third_person_perspective>[\s\S]*?<\/third_person_perspective>/)[0]);
    const dynamicExpected = sectionOf(/\*\*动态段（组装层条件注入，非预设正文）\*\*/);

    const { api } = storageHarness();
    const defs = api.BUILTIN_PROMPT_PRESETS;
    assert.equal(defs.length, 16);
    const visible = defs.filter(d => !d.hidden);
    assert.equal(visible.length, 14);
    assert.equal(defs.filter(d => d.hidden).length, 2);
    defs.forEach(def => {
      assert.ok(expected.has(def.name), '常量名在文档中存在: ' + def.name);
      assert.equal(def.content, expected.get(def.name), '正文逐字一致: ' + def.name);
      assert.ok(['system', 'user', 'assistant'].includes(def.role), def.name + ' role 合法');
      assert.equal(def.content.includes('{{user}}'), false, def.name + ' 无 {{user}}');
    });
    assert.equal(visible.filter(d => d.enabled === true).length, 13, '可见 14 条中 13 条默认开');
    assert.equal(visible.find(d => d.enabled === false).name, NSFW_NAME, '默认关的只有 NSFW');
    assert.equal(defs.find(d => d.name === '人称视角 · 第一人称').enabled, null, '隐藏条目默认值由人称驱动');
    assert.equal(api.PROMPT_PRESET_DYNAMIC_MEMORY_SEGMENT, dynamicExpected, '动态记忆段逐字一致');
    assert.equal(api.BUILTIN_PROMPT_PRESETS[0].name, '小说续写模式', '首条为破限');
    assert.equal(api.BUILTIN_PROMPT_PRESETS[13].name, 'COT 推演协议', '第 14 条为 COT');
    assert.equal(JSON.stringify(visible.filter(d => d.role !== 'system').map(d => d.name)),
      JSON.stringify(['续写预注入 · User 1', '续写预注入 · AI 1', '续写预注入 · User 2', '续写预注入 · AI 2']), '四条预注入 role 正确');
  });

  /* T02：同步幂等、开关与顺序保留、内置正文/role 刷回、锚点插入 */
  test('第1刀 T02：同步幂等，保留开关/顺序，刷回冻结正文，按锚点补缺', () => {
    const { api } = storageHarness();
    const tampered = [
      { name: '禁止规则', content: '用户篡改', enabled: false, role: 'assistant' },
      { name: '小说续写模式', content: '用户篡改', enabled: true, role: 'user' },
      { name: '自定义条目', content: '自定义不动', enabled: true, role: 'user' }
    ];
    const once = api.syncBuiltinPromptPresets(api.normalizePromptPresetList(JSON.parse(JSON.stringify(tampered))), 'third');
    // 已有内置：刷回冻结 content/role，保留用户 enabled
    assert.equal(once.find(i => i.name === '禁止规则').content.includes('<prohibited_content>'), true);
    assert.equal(once.find(i => i.name === '禁止规则').role, 'system');
    assert.equal(once.find(i => i.name === '禁止规则').enabled, false, '用户关闭保留');
    assert.equal(once.find(i => i.name === '小说续写模式').role, 'system');
    assert.equal(once.find(i => i.name === '自定义条目').content, '自定义不动', '自定义内容不刷');
    // 首条（破限）缺失时插列表首位
    const missingFirst = api.syncBuiltinPromptPresets([{ name: '禁止规则', content: '', enabled: true, role: 'system' }], 'third');
    assert.equal(missingFirst[0].name, '小说续写模式', '首条缺失插列表首位');
    // 缺失内置补齐：补插条目位于其 after 锚之后；用户已有项顺序保留（禁止规则保持在首位），锚点规则不约束已有项
    assert.equal(once[0].name, '禁止规则', '用户已有项顺序保留');
    const existed = new Set(tampered.filter(i => i.name !== '自定义条目').map(i => i.name));
    const idxByName = new Map(once.map((item, idx) => [item.name, idx]));
    api.BUILTIN_PROMPT_PRESETS.forEach(def => {
      const idx = idxByName.get(def.name);
      assert.notEqual(idx, undefined, '内置补齐: ' + def.name);
      if (def.after && !existed.has(def.name)) assert.ok(idxByName.get(def.after) < idx, def.name + '（补插）位于锚点 ' + def.after + ' 之后');
    });
    const visibleNames = once.filter(i => ![PERSON_FIRST_NAME, PERSON_THIRD_NAME].includes(i.name)).map(i => i.name);
    assert.equal(new Set(visibleNames).size, visibleNames.length, '无重复条目');
    // 存量条目缺 hidden 标志时按内置定义回填（旧书人称条目外露愈合，4 刀验收后修正 R2）
    assert.equal(once.find(i => i.name === PERSON_FIRST_NAME).hidden, true, '第一人称条目 hidden 回填');
    assert.equal(once.find(i => i.name === PERSON_THIRD_NAME).hidden, true, '第三人称条目 hidden 回填');
    assert.equal(once.find(i => i.name === '防替写').hidden, false, '普通内置 hidden=false');
    assert.equal(once.find(i => i.name === '自定义条目').hidden, undefined, '自定义条目不受回填影响');
    // 幂等
    const twice = api.syncBuiltinPromptPresets(once, 'third');
    assert.deepEqual(JSON.parse(JSON.stringify(twice)), JSON.parse(JSON.stringify(once)));
    const thrice = api.syncBuiltinPromptPresets(twice, 'third');
    assert.deepEqual(JSON.parse(JSON.stringify(thrice)), JSON.parse(JSON.stringify(once)));
    // 非对象条目跳过并报告；空 content 合法
    const weird = api.syncBuiltinPromptPresets([null, 'x', { name: '空内容条目', content: '', enabled: true, role: 'user' }], 'third');
    assert.equal(weird.find(i => i.name === '空内容条目').content, '', '空 content 不变默认正文');
    // 旧 presets 对象不迁移：applyTo 等旧字段进不了新列表业务语义
    const legacy = api.syncBuiltinPromptPresets([{ name: '旧预设', content: '旧文本', enabled: true, role: 'system', applyTo: ['writing'], isBuiltin: true }], 'third');
    assert.equal(legacy.find(i => i.name === '旧预设').content, '旧文本', '旧条目按自定义保留（不参与注入，第4刀前旧 UI 不读新列表）');
  });

  /* T03：NSFW 只保存在不刷 content；两个人称互斥 */
  test('第1刀 T03：NSFW 缺失补默认占位且默认关；用户文本/空串不覆盖；人称互斥', () => {
    const { api } = storageHarness();
    // 缺失 → 创建冻结占位 + 默认关
    const created = api.syncBuiltinPromptPresets([], 'third');
    const nsfwCreated = created.find(i => i.name === NSFW_NAME);
    assert.equal(nsfwCreated.enabled, false, 'NSFW 默认关');
    assert.ok(nsfwCreated.content.includes(NSFW_FROZEN_PLACEHOLDER), '占位说明来自冻结文本');
    // 非空用户文本保留
    const kept = api.syncBuiltinPromptPresets([{ name: NSFW_NAME, content: '用户规则文本', enabled: true, role: 'system' }], 'third');
    assert.equal(kept.find(i => i.name === NSFW_NAME).content, '用户规则文本');
    assert.equal(kept.find(i => i.name === NSFW_NAME).enabled, true, '用户开启保留');
    // 空字符串保持空（不能被默认正文回填）
    const emptied = api.syncBuiltinPromptPresets([{ name: NSFW_NAME, content: '', enabled: false, role: 'system' }], 'third');
    assert.equal(emptied.find(i => i.name === NSFW_NAME).content, '', '空串保持空');
    // 两个人称互斥且由 person 驱动
    for (const person of ['first', 'third', '非法', undefined]) {
      const list = api.syncBuiltinPromptPresets([], person);
      const first = list.find(i => i.name === PERSON_FIRST_NAME);
      const third = list.find(i => i.name === PERSON_THIRD_NAME);
      const wantFirst = person === 'first';
      assert.equal(first.enabled, wantFirst, 'first enabled @person=' + person);
      assert.equal(third.enabled, !wantFirst, 'third enabled @person=' + person);
    }
    // normalize：role 白名单、非法回退 system、非对象跳过
    assert.equal(api.normalizePromptPresetRole('assistant'), 'assistant');
    assert.equal(api.normalizePromptPresetRole('tool'), 'system');
    assert.equal(api.normalizePromptPreset('not-an-object'), null);
    assert.equal(api.normalizePromptPreset(null), null);
    const partial = api.normalizePromptPreset({ name: 'x' });
    assert.deepEqual({ name: partial.name, content: partial.content, enabled: partial.enabled, role: partial.role }, { name: 'x', content: '', enabled: true, role: 'system' });
  });

  /* T04：A/B 切换隔离、保存往返、完整备份携带、快照恢复、导入选择 */
  test('第1刀 T04：A/B 新字段隔离，保存/备份/快照/导入全链往返', async () => {
    const h = storageHarness();
    const { api } = h;
    storageFixture(api);
    // 载入 A：人称恢复 + 列表同步（自定义保留、内置刷回、NSFW 用户文本保留）
    assert.equal(api.loadBook('bookA'), true);
    assert.equal(api.narrativePerson.value, 'first', 'A 人称恢复（旧代码串书缺陷已修）');
    let list = api.promptPresets.value;
    assert.equal(list.find(i => i.name === '我的自定义设定').content, '哨兵-A-自定义');
    assert.equal(list.find(i => i.name === NSFW_NAME).content, '哨兵-A-NSFW-用户文本');
    assert.equal(list.find(i => i.name === '防替写').content.includes('<anti_rewrite>'), true, '内置正文刷回');
    assert.equal(list.find(i => i.name === '防替写').enabled, false, '用户关闭保留');
    assert.equal(list.filter(i => i.name === PERSON_FIRST_NAME)[0].enabled, true);
    assert.equal(list.filter(i => i.name === PERSON_THIRD_NAME)[0].enabled, false);
    assert.ok(list.some(i => i.name === '小说续写模式'), '缺失内置补齐');
    // A 修改 + 保存 → 落到 bookA 记录
    list.find(i => i.name === '我的自定义设定').enabled = false;
    api.syncBookData();
    const savedA = api.books.value.find(b => b.id === 'bookA');
    assert.equal(savedA.promptPresets.find(i => i.name === '我的自定义设定').enabled, false, 'syncBookData 写入当前书');
    assert.equal(savedA.narrativePerson, 'first');
    assert.equal(savedA.presets[0].content, '旧-A-原值', '旧活动键停写：书记录旧 presets 原值不变');
    assert.equal(savedA.promptPipeline[0].content, '旧流水线哨兵-A', '书记录旧流水线原值不变');
    assert.equal(savedA.atmospherePrompt, '旧氛围哨兵-A', '书记录旧氛围原值不变');
    // 切 B：B 独立（人称 third、B 的排序、COT 被刷回）
    assert.equal(api.loadBook('bookB'), true);
    assert.equal(api.narrativePerson.value, 'third', 'B 人称恢复');
    const listB = api.promptPresets.value;
    assert.equal(listB.find(i => i.name === '我的自定义设定'), undefined, 'B 不借 A 的自定义');
    assert.equal(listB.find(i => i.name === 'COT 推演协议').content.includes('<thinking_protocol>'), true, 'B 内置刷回');
    assert.equal(listB.find(i => i.name === 'COT 推演协议').enabled, false, 'B 用户关闭保留');
    // 切回 A：A 的编辑还在
    assert.equal(api.loadBook('bookA'), true);
    assert.equal(api.narrativePerson.value, 'first');
    assert.equal(api.promptPresets.value.find(i => i.name === '我的自定义设定').enabled, false, '切回 A 编辑保留');
    // 完整备份：JSON 携带新字段 + 旧字段原值
    await api.performExportBookFullBackup();
    const backup = JSON.parse(h.captureExport());
    assert.deepEqual(backup.promptPresets.map(i => i.name).filter(n => n === '我的自定义设定'), ['我的自定义设定']);
    assert.equal(backup.narrativePerson, 'first');
    // v0.0.17 适配：我方全量备份本就不含旧体系字段（presets/promptPipeline/atmospherePrompt），维持原状；
    // 这里只验证新字段随备份往返，旧字段由书架记录与快照链路覆盖（见下方书记录断言）。
    // 备份 → 导入：resolveImportedBookData 选中书字段优先（含空数组）
    const resolved = api.resolveImportedBookData(backup);
    assert.deepEqual(resolved.promptPresets, backup.promptPresets);
    assert.equal(resolved.narrativePerson, 'first');
    const selectedPriority = api.resolveImportedBookData({ books: [{ id: 'x', novel: {}, promptPresets: [], narrativePerson: 'first' }], currentBookId: 'x', promptPresets: [{ name: '根镜像' }] });
    assert.deepEqual(selectedPriority.promptPresets, [], '选中书空数组优先，不回落根镜像');
    // 导入新书：createNewBook 不克隆上一书
    const nid = api.createNewBook('导入副本');
    const created = api.books.value.find(b => b.id === nid);
    // 注意：created 来自 vm 源，数组原型属 vm realm，用 JSON 比较而非 deepStrictEqual
    assert.equal(JSON.stringify(created.promptPresets), '[]', '新书新字段为空待同步');
    assert.equal(created.narrativePerson, 'third', '新书默认第三人称');
    api.loadBook(nid);
    assert.equal(api.narrativePerson.value, 'third');
    assert.equal(api.promptPresets.value.length, 16, '新书同步出 16 条默认');
    // 快照：保存携带 → 恢复原状态 + 同步内置（restoreSnapshot 内部走异步链，flush 等待完成）
    const flushAsync = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };
    assert.equal(api.loadBook('bookA'), true);
    await api.saveSnapshot('测试');
    const snap = h.savedBooks[h.savedBooks.length - 1];
    const snapData = JSON.parse(snap.data);
    assert.ok(Array.isArray(snapData.promptPresets), '快照携带新列表');
    assert.equal(snapData.narrativePerson, 'first');
    assert.ok(snapData.presets && snapData.presets[0].content === '旧-A-原值', '快照携带书记录旧键原值');
    api.loadBook('bookB');
    api.restoreSnapshot(snap);
    await flushAsync();
    assert.equal(api.narrativePerson.value, 'first', '快照恢复人称');
    assert.equal(api.promptPresets.value.find(i => i.name === '我的自定义设定').enabled, false, '快照恢复列表与开关');
    assert.ok(api.promptPresets.value.find(i => i.name === 'COT 推演协议').content.includes('<thinking_protocol>'), '恢复后同步内置');
    // 旧活动键：随快照原位回落到恢复目标书记录，不激活运行
    const restoredRecord = api.books.value.find(b => b.id === 'bookB');
    assert.ok(restoredRecord.presets && restoredRecord.presets[0].content === '旧-A-原值', '快照旧键原位落回目标书记录');
    // clearAll：重建默认 16 条
    api.clearAll();
    assert.equal(api.promptPresets.value.length, 16);
    assert.ok(api.promptPresets.value.find(i => i.name === '小说续写模式').enabled);
  });

  /* T05：旧档缺新字段 + 旧请求 golden 不受新条目影响 */
  test('第1刀 T05：旧档缺新字段按缺省初始化；普通/白鸟锁定请求 golden 不变', () => {
    const h = storageHarness();
    const { api } = h;
    // 旧书记录没有 promptPresets / narrativePerson
    api.books.value = [{ id: 'old1', title: '旧书', novel: { title: '旧书' }, chapters: [{ id: 'c1', title: '章', content: '旧正文' }], characters: [] }];
    assert.equal(api.loadBook('old1'), true);
    assert.equal(api.narrativePerson.value, 'third', '缺失人称回退 third');
    assert.equal(api.promptPresets.value.length, 16, '缺失列表同步出 16 条默认');
    assert.equal(api.promptPresets.value.find(i => i.name === NSFW_NAME).enabled, false);
    // 保存后旧书记录获得新字段，旧字段原样
    api.syncBookData();
    const rec = api.books.value[0];
    assert.equal(rec.promptPresets.length, 16);
    assert.equal(rec.narrativePerson, 'third');
    assert.ok(Array.isArray(rec.presets) || rec.presets === undefined, '旧字段不被新链路破坏');
  });

  /* 第2刀 T06→v0.0.17 适配：我方资料三分语义仍由 buildPipelineLayerPrompt world/chars/outline 分支承载 */
  test('第2刀 T06：资料分支三分 helper 语义与提取前一致', () => {
    const api = harness();
    baseState(api);
    // chars：结构化人物包有文本 → 直接用包文本；空文本回退 buildFallbackCharacterPromptText（无角色 → 空 → 整层省略）
    const structuredFull = api.buildPipelineLayerPrompt({ key: 'chars', enabled: true, content: '' }, { storyBibleContextPackage: { characterIntent: 'structured', characterText: '结构化角色文本' } });
    assert.ok(structuredFull.startsWith('【角色设定】\n') && structuredFull.includes('结构化角色文本'), 'structured 包文本直用');
    const structuredEmpty = api.buildPipelineLayerPrompt({ key: 'chars', enabled: true, content: '' }, { storyBibleContextPackage: { characterIntent: 'structured', characterText: '   ' } });
    // 空 structured 包不是载入全体角色的许可：回退 buildFallbackCharacterPromptText（用 fixture 角色），不注入空串也不报错
    assert.ok(structuredEmpty.includes('林晚'), '空 structured 包回退 fallback 角色');
    // chars：无包 → legacy 裁剪路径（角色来自 charactersPromptString）
    assert.ok(api.buildPipelineLayerPrompt({ key: 'chars', enabled: true, content: '' }, {}).includes('林晚'), 'legacy 路径读角色提示串');
    // world：SB 包 worldText 优先；无包走 worldView 裁剪
    const worldFromPackage = api.buildPipelineLayerPrompt({ key: 'world', enabled: true, content: '' }, { storyBibleContextPackage: { worldText: 'SB 世界观' } });
    assert.ok(worldFromPackage.startsWith('【世界观设定】\n') && worldFromPackage.includes('SB 世界观'), 'SB 包 worldText 优先');
    // 作者段：buildSnowwingAuthorContextPrompt 产出三段固定顺序（authorOnly=true 禁普通 MOD/自定义层内容）
    const sections = api.buildSnowwingAuthorContextPrompt({ storyBibleContextPackage: { worldText: 'SB 世界观' } }).split('\n\n').filter(Boolean);
    assert.equal(JSON.stringify(sections.map(s => s.split('\n')[0])), JSON.stringify(['【世界观设定】', '【角色设定】', '【故事大纲与细纲】']), '作者段顺序固定');
    // outline：当前章号驱动细纲窗口
    api.chapterOutlines.value = [
      { title: '一', content: '第一章细纲内容' },
      { title: '二', content: '第二章细纲内容' },
      { title: '三', content: '第三章细纲内容' }
    ];
    const outlineAt2 = api.buildPipelineLayerPrompt({ key: 'outline', enabled: true, content: '' }, { currentChapterNo: 2 });
    assert.ok(outlineAt2.includes('本章细纲') && outlineAt2.includes('第二章细纲内容'), '当前章号驱动细纲窗口');
  });

  /* ==================== 第 4 刀：白鸟接缝 / 请求范围 / UI 逻辑 ==================== */

  /* T10：白鸟五面——锁定/解锁宿主预设零注入、承载独立、建议与无限不接新预设 */
  test('第4刀 T10：锁定全链无宿主新预设；解锁后普通请求恢复；建议/无限不接新预设', () => {
    const api = harness();
    baseState(api);
    // 锁定：core/COT/预注入/人称零注入（锁定结构测试已刻画；此处补 buildFullSystemPrompt 面）
    api.modPacks.value = [JSON.parse(JSON.stringify(snowwingMod))];
    const lockedSys = api.buildFullSystemPrompt({ contextChapters: [ch0, ch1] });
    ['小说续写模式', '<thinking_protocol>', '按规则输出'].forEach(token => assert.ok(!lockedSys.includes(token), '锁定 system 无宿主token: ' + token));
    assert.ok(lockedSys.includes('【世界观设定】') && lockedSys.includes('【角色设定】') && lockedSys.includes('【故事大纲与细纲】'), '锁定作者资料三段齐全');
    const authorContext = api.buildSnowwingAuthorContextPrompt({ contextChapters: [ch0, ch1] });
    assert.ok(authorContext.includes('【世界观设定】'), '作者上下文入口保留');
    assert.ok(lockedSys.startsWith(authorContext + '\n\n'), '锁定 system 以作者资料开头，其后为白鸟自有装配');
    // 解锁：无白鸟时无承载、无审计旗影响
    api.modPacks.value = [];
    api.window.SNOWWING_DISABLE_HOST_COT_CARRIER = false;
    const normalMsgs = api.buildChapterMessages(baseOptions());
    assert.ok(!normalMsgs.some(m => m.content.includes('【白鸟推演承载要求】')), '无白鸟不插承载');
    // 建议：新 COT/预注入不外溢（旧预设补充指令路径已随第 5 刀删除声明而不存在）
    baseState(api);
    api.promptPresets.value = api.syncBuiltinPromptPresets([], 'third');
    const suggestionPrompt = api.buildSuggestionPrompt({ contextChapters: [ch0, ch1], currentChapterNo: 3 });
    assert.ok(suggestionPrompt.includes('你是建议助手桩。'), '建议 persona 保留');
    assert.ok(!suggestionPrompt.includes('<thinking_protocol>') && !suggestionPrompt.includes('[进入持续小说续写任务]'), '正文 COT/预注入不进建议');
    // 无限：不注入新章节预设/COT，原功能壳保留（旧文风读取路径已随声明删除）
    const infinitePrompt = api.buildInfiniteContextPrompt('无限模式正文桩。', 800);
    assert.ok(!infinitePrompt.includes('文风：') && !infinitePrompt.includes('小说续写模式') && !infinitePrompt.includes('<thinking_protocol>'), '无限模式不接新预设/COT');
    assert.ok(infinitePrompt.includes('【无限模式续写方向】'), '无限模式原功能壳保留');
  });

  /* T12：UI 逻辑——内置权限、编辑保存、排序、导入改名、锁定拦截、人称 setter */
  test('第4刀 T12：预设 UI 权限/编辑/排序/导入改名/锁定拦截/人称联动', () => {
    const h = storageHarness();
    const { api, toasts } = h;
    // 建 fixture 书并载入：16 默认 + 自定义
    api.books.value = [{ id: 'uiA', title: 'UI书', novel: { title: 'UI书' }, chapters: [{ id: 'c1', title: '章', content: '正文' }], characters: [] }];
    api.loadBook('uiA');
    assert.equal(api.promptPresets.value.length, 16);
    // 可见过滤：14 条可见，两个人称隐藏
    assert.equal(api.visiblePromptPresets().length, 14, '默认 14 条可见');
    // 权限矩阵（U1）
    const sys = api.promptPresets.value.find(i => i.name === '防替写');
    const nsfw = api.promptPresets.value.find(i => i.name === NSFW_NAME);
    const hidden = api.promptPresets.value.find(i => i.name === PERSON_FIRST_NAME);
    assert.equal(api.canEditPromptPresetContent(sys), false, '普通内置只读');
    assert.equal(api.canDeletePromptPreset(sys), false, '普通内置不可删');
    assert.equal(api.canEditPromptPresetContent(nsfw), true, 'NSFW 可编辑内容');
    assert.equal(api.canDeletePromptPreset(nsfw), false, 'NSFW 不可删');
    assert.equal(api.canEditPromptPresetContent(hidden), false, '隐藏人称无编辑入口');
    // 普通内置查看态：正文只读、保存路径静默关闭、无假成功提示（验收后修正 R3）
    const antiRewrite = api.promptPresets.value.find(i => i.name === '防替写');
    api.openPromptPresetEditor(antiRewrite);
    assert.equal(api.promptPresetEditor.contentReadonly, true, '普通内置正文只读');
    const toastCountBefore = toasts.length;
    api.promptPresetEditor.content = '篡改尝试';
    api.savePromptPresetEditor();
    assert.equal(api.showPromptPresetEditor.value, false, '查看态保存即关闭');
    assert.ok(api.promptPresets.value.find(i => i.name === '防替写').content.includes('<anti_rewrite>'), '冻结正文未被写回');
    assert.equal(toasts.length, toastCountBefore, '查看态无任何 toast');
    // 编辑 NSFW：只允许改内容；空串持久
    api.openPromptPresetEditor(nsfw);
    assert.equal(api.showPromptPresetEditor.value, true);
    assert.equal(api.promptPresetEditor.nameReadonly, true, 'NSFW 名称只读');
    assert.equal(api.promptPresetEditor.roleReadonly, true, 'NSFW 角色只读');
    api.promptPresetEditor.content = '多写环境声音';
    api.savePromptPresetEditor();
    assert.equal(api.showPromptPresetEditor.value, false);
    assert.equal(api.promptPresets.value.find(i => i.name === NSFW_NAME).content, '多写环境声音', 'NSFW 内容保存');
    api.openPromptPresetEditor(api.promptPresets.value.find(i => i.name === NSFW_NAME));
    api.promptPresetEditor.content = '';
    api.savePromptPresetEditor();
    assert.equal(api.promptPresets.value.find(i => i.name === NSFW_NAME).content, '', 'NSFW 清空也是用户操作');
    // 新建：默认关闭、插到隐藏条目之前、保留名校验
    api.addPromptPreset();
    assert.equal(api.promptPresetEditor.isNew, true);
    api.promptPresetEditor.name = '防替写';
    api.promptPresetEditor.content = '正文';
    api.savePromptPresetEditor();
    assert.ok(toasts.some(t => t.message.includes('内置预设冲突')), '保留名被拒');
    assert.equal(api.promptPresets.value.length, 16, '拒绝后不新增');
    api.addPromptPreset();
    api.promptPresetEditor.name = '排序测试';
    api.promptPresetEditor.role = 'user';
    api.promptPresetEditor.content = '本次写作背景是旧书店';
    api.savePromptPresetEditor();
    assert.equal(api.promptPresets.value.length, 17, '新建成功');
    const created = api.promptPresets.value.find(i => i.name === '排序测试');
    assert.equal(created.enabled, false, '新建默认关闭');
    assert.equal(created.role, 'user');
    assert.equal(api.promptPresets.value[api.promptPresets.value.length - 1].hidden, true, '新建条目在隐藏条目之前（隐藏仍收尾）');
    // 排序：只交换相邻可见项；隐藏项不参与
    const idxCustom = api.promptPresets.value.indexOf(created);
    const prevItem = api.promptPresets.value[idxCustom - 1];
    api.movePromptPreset(idxCustom, -1);
    const newIdx = api.promptPresets.value.indexOf(created);
    assert.equal(api.promptPresets.value[newIdx + 1], prevItem, '上移交换相邻可见项');
    assert.equal(api.canMovePromptPreset(api.promptPresets.value.indexOf(hidden), -1), false, '隐藏项不可作为移动目标');
    // 删除：自定义可删、内置不可删
    assert.equal(api.canDeletePromptPreset(created), true);
    api.deletePromptPresetItem(api.promptPresets.value.indexOf(created));
    assert.equal(api.promptPresets.value.length, 16, '自定义删除');
    assert.equal(api.canDeletePromptPreset(api.promptPresets.value.find(i => i.name === NSFW_NAME)), false, 'NSFW 删除不可用');
    // 导入改名：同名 → 唯一副本且关闭（uniquePromptPresetImportName 纯函数级验证）
    const used = new Set(api.promptPresets.value.map(i => i.name));
    assert.equal(api.uniquePromptPresetImportName('防替写', used), '防替写（导入副本）', '撞内置名改副本');
    assert.equal(api.uniquePromptPresetImportName('防替写', new Set([...used, '防替写（导入副本）'])), '防替写（导入副本 2）', '批内重名递增');
    assert.equal(api.uniquePromptPresetImportName('', used).length > 0, true, '空名有兜底');
    // 白鸟锁定拦截：全部入口拒改
    api.promptPresets.value = api.syncBuiltinPromptPresets(api.promptPresets.value, 'third');
    h.lock.value = true;
    const snapshotBefore = JSON.stringify(api.promptPresets.value);
    api.togglePromptPresetEnabled(api.promptPresets.value.find(i => i.name === '防替写'));
    api.movePromptPreset(0, 1);
    api.addPromptPreset();
    assert.equal(api.showPromptPresetEditor.value, false, '锁定时编辑器不打开');
    assert.equal(JSON.stringify(api.promptPresets.value), snapshotBefore, '锁定时列表无任何变化');
    assert.equal(toasts.filter(t => t.message.includes('白鸟锁定')).length >= 3, true, '锁定提示');
    // 人称 setter：锁定时不改列表；解锁后互斥
    api.setNarrativePerson('first');
    assert.equal(api.narrativePerson.value, 'first');
    assert.equal(JSON.stringify(api.promptPresets.value), snapshotBefore, '锁定人称不联动隐藏条目');
    h.lock.value = false;
    api.setNarrativePerson('first');
    assert.equal(api.promptPresets.value.find(i => i.name === PERSON_FIRST_NAME).enabled, true, '第一人称条目开');
    assert.equal(api.promptPresets.value.find(i => i.name === PERSON_THIRD_NAME).enabled, false, '第三人称条目关');
    api.setNarrativePerson('nonsense');
    assert.equal(api.narrativePerson.value, 'third', '非法值回退 third');
    assert.equal(api.promptPresets.value.find(i => i.name === PERSON_FIRST_NAME).enabled, false);
    assert.equal(api.promptPresets.value.find(i => i.name === PERSON_THIRD_NAME).enabled, true);
  });
}
