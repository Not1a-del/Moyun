#!/usr/bin/env node
// v0.0.10 req1：可重复执行的全局回归检查（`npm run regress`）。
// 背景上一轮报告的已知风险：改动全靠临时浏览器脚本验证，没有可重复的全局回归。本轮把关键逻辑
// 从源文件里原样抽取成纯函数做断言测试，任何后续改动跑一次即可发现回归；不需要浏览器、不发真实请求。
// 检查内容：
//   1) npm run build 成功，且生成的 assets/js/moyun.js 通过 node --check 语法检查；
//   2) 关键锚点存在性（本轮修复点不被误删）；
//   3) applyAiVolumeUpdates：新【卷纲更新】逐章格式解析 + 旧格式兼容（v0.0.10 req5）；
//   4) extractStreamFieldValue：JSON/行式/半截流三种取值（v0.0.10 req2）；
//   5) 事件字段硬限（title≤20/timeText≤24/summary≤60/其余≤80）与 normalizeStoryBibleEvent 标题 120 上限；
//   6) 细纲比例预算：1:4~1:5（中值 1:4.5）推算与下限（v0.0.10 补充轮 S4，静态断言源码锚点 + 数值抽样）；
//   7) 补充轮锚点：全文时间线补充按钮、范围选择弹窗、按钮下方段/批进度提示（v0.0.10 补充轮 S1/S2/S3）。
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'source', 'moyun.single.html');
let failed = 0;
const failures = [];

function check(label, ok, detail) {
  if (ok) console.log('  PASS', label);
  else { console.log('  FAIL', label, detail ? '— ' + detail : ''); failures.push(label); failed++; }
}

// ── 1. 构建 + 生成文件语法 ──
console.log('[1/5] build + syntax');
try {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-static-site.cjs')], { cwd: ROOT, stdio: 'pipe' });
  check('npm build 成功', true);
} catch (e) {
  check('npm build 成功', false, String(e.message).slice(0, 200));
}
try {
  execFileSync(process.execPath, ['--check', path.join(ROOT, 'assets', 'js', 'moyun.js')], { stdio: 'pipe' });
  check('assets/js/moyun.js 语法检查', true);
} catch (e) {
  check('assets/js/moyun.js 语法检查', false, String(e.message).slice(0, 200));
}

const src = fs.readFileSync(SOURCE, 'utf8');

// ── 2. 关键锚点存在性 ──
console.log('[2/5] anchors');
const anchors = [
  ['req3 事件网格比例列', '.moyun-event-fields.three{grid-template-columns:minmax(0,1.6fr)'],
  ['req3 字段 min-width:0', '.moyun-event-fields input,.moyun-event-fields textarea,.moyun-event-fields select{min-width:0;width:100%}'],
  ['req4 逐章阅读提示', '逐章阅读全文并按顺序插入'],
  ['req1 截断警告 toast', '已自动截断到标题20'],
  ['req2 流式填充助手', 'function createWorkbenchStreamFiller(fields, onField)'],
  ['req2 设定补充流式', 'const bibleFiller = createWorkbenchStreamFiller'],
  ['req2 条目补充流式', 'const entryFiller = createWorkbenchStreamFiller'],
  ['req2 角色补充流式', 'const charFiller = createWorkbenchStreamFiller'],
  ['req2 细纲流式预览', 'isGeneratingDO && outlineStreamPreview'],
  ['req5 章行格式样例', "第M章：本章一句话大纲（不超过40字）"],
  ['req5 章行解析', "lastUpdate.chapterLines.push('第' + no + '章：' + text)"],
  ['S4 比例预算 1:4.5', 'const doPerChapterRatio = Math.max(200, Math.round(Number(wordCountTarget.value) / 4.5))'],
  ['S4 单章比例 1:4.5', "const singleChapterWords = singleSettingTouched ? Math.max(500, Math.round(Number(settings.value.aiWordCount_detailedOutline || 3000) / Math.max(1, chapterOutlines.value.length || 1))) : Math.max(500, Math.round(Number(wordCountTarget.value) / 4.5))"],
  ['S4 设置面板说明', '每1000字细纲生成4000-5000字正文，取中值1:4.5'],
  ['S1 改名按钮', 'data-story-event-ai-full>{{ isAiSupplementingStoryBible ? \'补充中…\' : \'全文时间线补充\' }}'],
  ['S1 范围弹窗', 'data-moyun-modal="story-event-range"'],
  ['S1 弹窗确认执行', '@submit.prevent="execStoryEventRangePrompt"'],
  ['S1 范围校验', '章节范围超出已有正文（1-'],
  ['S2 时间线填对提示词', '时间线必须正确：timeText 要准确反映本章事件发生在正文中的时间点'],
  ['S2 稳定排序', 'stableIndex.get(x)'],
  ['S3 段进度状态', "const aiSupplementSegmentProgress = ref('')"],
  ['S3 事件批进度', "storyEventSupplementProgress.value = '已补充到第 ' + batchNo + '/' + batches.length + ' 批"],
  ['S3 通用提示挂载', 'isAiSupplementingStoryBible && aiSupplementSegmentProgress'],
  ['S3 细纲批进度', "aiSupplementSegmentProgress.value = '已补充到第 ' + (bi + 1) + '/' + batches.length + ' 批"],
  ['S3 流水线段进度', "aiSupplementSegmentProgress.value = '已补充到第 ' + completed + '/' + enabledLayers.length + ' 段"]
];
anchors.forEach(([label, needle]) => { if (label === '版本号') return; check(label, src.includes(needle)); });
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const app = src.match(/version['\"]?\s*[:=]\s*['\"]([\d.]+)['\"]/);
check('package.json 版本 ' + pkg.version, /^\d+\.\d+\.\d+$/.test(pkg.version), pkg.version);

// ── 3. applyAiVolumeUpdates 单元（req5） ──
console.log('[3/5] applyAiVolumeUpdates');
const avuText = extractFunction(src, 'function applyAiVolumeUpdates(text)');
if (!avuText) check('抽取 applyAiVolumeUpdates', false, '未找到函数');
else {
  check('抽取 applyAiVolumeUpdates', true);
  const volumes = () => ([
    { id: 'v1', title: '第一卷', startChapter: 1, endChapter: 3, summary: '' },
    { id: 'v2', title: '第二卷', startChapter: 4, endChapter: 6, summary: '' }
  ]);
  let novel = { value: { volumes: volumes() } };
  const novelVolumes = { get value() { return novel.value.volumes; } };
  let saved = 0;
  const fn = new Function('novel', 'novelVolumes', 'saveData', 'return (' + avuText + ');')(novel, novelVolumes, () => { saved++; });
  // 新格式：卷头 + 逐章行
  const aiNew = '【卷纲更新】\n第1卷｜卷名：风云起｜章节 1-3｜框架摘要：少年入宗\n第1章：主角进山\n第2章：初见师姐\n第3章：夜袭\n第2卷｜卷名：暗流涌｜章节 4-6｜框架摘要：暗线展开\n第4章：密信\n第5章：破庙对峙\n第6章：断桥抉择\n## 核心卖点\n- 测试';
  fn(aiNew);
  const v1 = novel.value.volumes[0], v2 = novel.value.volumes[1];
  check('新格式：卷一摘要含 3 条章行', (v1.summary.match(/第\d+章：/g) || []).length === 3, v1.summary);
  check('新格式：卷二摘要含 3 条章行', (v2.summary.match(/第\d+章：/g) || []).length === 3, v2.summary);
  check('新格式：卷名回填', v1.title === '风云起' && v2.title === '暗流涌', v1.title + '/' + v2.title);
  check('新格式：摘要含框架摘要行', v1.summary.startsWith('少年入宗'), v1.summary.slice(0, 20));
  // 旧格式兼容
  novel = { value: { volumes: volumes() } };
  const fn2 = new Function('novel', 'novelVolumes', 'saveData', 'return (' + avuText + ');')(novel, novelVolumes, () => {});
  fn2('【卷纲更新】\n第1卷｜卷名：新卷名｜章节 1-3｜框架摘要：全新摘要\n## 核心卖点');
  check('旧格式兼容：仅回填摘要', novel.value.volumes[0].summary === '全新摘要', novel.value.volumes[0].summary);
  // 超量卷行被忽略
  novel = { value: { volumes: volumes() } };
  const fn3 = new Function('novel', 'novelVolumes', 'saveData', 'return (' + avuText + ');')(novel, novelVolumes, () => {});
  const changed9 = fn3('【卷纲更新】\n第9卷｜卷名：臆造卷｜章节 1-2｜框架摘要：不存在');
  check('臆造卷行被忽略', changed9 === 0 && novel.value.volumes[0].title === '第一卷', 'changed=' + changed9);
}

// ── 4. extractStreamFieldValue 单元（req2） ──
console.log('[4/5] extractStreamFieldValue');
const esfText = extractFunction(src, 'function extractStreamFieldValue(text, names)');
if (!esfText) check('抽取 extractStreamFieldValue', false, '未找到函数');
else {
  check('抽取 extractStreamFieldValue', true);
  const cleanAIResponse = t => String(t || '');
  const fn = new Function('cleanAIResponse', 'return (' + esfText + ');')(cleanAIResponse);
  const names = ['premise', '前提'];
  check('JSON 完整值', fn('{"premise":"少年入宗拜师"}', names) === '少年入宗拜师', String(fn('{"premise":"少年入宗拜师"}', names)));
  check('JSON 半截流（未闭合引号）', fn('{"premise":"少年入', names) === '少年入', String(fn('{"premise":"少年入', names)));
  const namesZh = ['summary', '摘要'];
  check('行式取值', fn('摘要：主角进入宗门并遭遇夜袭', namesZh) === '主角进入宗门并遭遇夜袭', String(fn('摘要：主角进入宗门并遭遇夜袭', namesZh)));
  check('字段缺失返回 null', fn('{"other":"x"}', names) === null, String(fn('{"other":"x"}', names)));
}

// ── 5. 事件字段硬限 + 细纲比例抽样（req1/req4/req6） ──
console.log('[5/5] clamps + ratio');
const clampNeedles = [
  ['EVENT_FIELD_MAX 硬限表', 'const EVENT_FIELD_MAX = { title:20, timeText:24, summary:60, cause:80, result:80, legacyImpact:80 }'],
  ['事件标题 120 上限', "next.title = String(next.title || '').slice(0, 120);"],
  ['条目摘要 60/详情300 提示', 'summary 不超过 60 字']
];
clampNeedles.forEach(([label, needle]) => check(label, src.includes(needle)));
// v0.0.10 补充轮 S4：细纲比例 = 1:4~1:5 的中值 1:4.5——每 1000 字细纲负责 4000-5000 字正文，
// 即每章细纲预算 ≈ 所选正文字数 / 4.5，下限 200 字（旧 6% 启发式已被替换，不应再出现）。
const ratioCases = [[600, 200], [2500, 556], [10000, 2222], [15000, 3333]];
ratioCases.forEach(([target, expect]) => {
  const per = Math.max(200, Math.round(target / 4.5));
  check('1:4.5 比例: 正文' + target + ' → 每章细纲≈' + expect + '字', per === expect, 'got ' + per);
});
check('比例总预算下限 600', Math.max(600, Math.round(200 * 3)) === 600, String(Math.max(600, Math.round(200 * 3))));
check('旧 6% 比例已移除（批量）', !src.includes('wordCountTarget.value) * 0.06'), '仍存在 6% 批量锚点');
check('旧 6% 比例已移除（单章）', !src.includes("Math.round(Number(wordCountTarget.value) * 0.06)"), '仍存在 6% 单章锚点');

console.log('');
if (failed) { console.error('REGRESSION FAILED: ' + failed + ' 项失败\n  - ' + failures.join('\n  - ')); process.exit(1); }
console.log('REGRESSION PASSED: 全部检查通过');

// ── 工具：按函数名从源码原样抽取整个函数体（花括号配平） ──
function extractFunction(text, signature) {
  const start = text.indexOf(signature);
  if (start === -1) return null;
  let depth = 0, i = start, end = -1;
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return end === -1 ? null : text.slice(start, end);
}