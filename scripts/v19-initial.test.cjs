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
  assert.ok(start >= 0 && end > start, `无法提取 ${from}`);
  return source.slice(start, end);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
const identityRows = rows => Array.isArray(rows) ? clone(rows) : [];

test('衔接初检只认模型明确标记，缺标记时要求人工核对', () => {
  const parse = extract('    function parseOutlineContinuity(', '    function parseGeneratedDetailedOutlines');
  const ctx = vm.createContext({});
  vm.runInContext(`${parse}; globalThis.parseOutlineContinuity = parseOutlineContinuity;`, ctx);
  const ok = ctx.parseOutlineContinuity('第2章 港口\n林远登上船。\n【无问题】', true);
  assert.equal(ok.content, '第2章 港口\n林远登上船。');
  assert.equal(ok.continuityStatus, 'ok');
  const issue = ctx.parseOutlineContinuity('第2章 港口\n林远登船。\n【衔接提示】上一章说船票已被烧毁。', true);
  assert.equal(issue.continuityStatus, 'issues');
  assert.equal(issue.continuityRaw, '上一章说船票已被烧毁。');
  const missing = ctx.parseOutlineContinuity('第2章 港口\n林远登船。', true);
  assert.equal(missing.continuityStatus, 'unreadable');
  assert.match(missing.continuityRaw, /林远登船/);
});

test('卷纲规划解析保留卷字段并校验连续范围', () => {
  const parse = extract('    function parseVolumePlan(', '    function validateVolumeRanges');
  const validate = extract('    function validateVolumeRanges(', '    function applyPlannedVolumes');
  const ctx = vm.createContext({});
  vm.runInContext(`${parse}${validate}; globalThis.parseVolumePlan = parseVolumePlan; globalThis.validateVolumeRanges = validateVolumeRanges;`, ctx);
  const rows = ctx.parseVolumePlan('【卷纲规划】\n第1卷｜卷名：雾港｜章节 1-10｜框架摘要：调查开始｜本卷写作内容要求：只写港口线｜本卷结尾衔接点：拿到旧钥匙\n第2卷｜卷名：回声｜章节 11-20｜框架摘要：真相浮现｜本卷写作内容要求：收束旧案｜本卷结尾衔接点：回到故乡');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].writingRequirement, '只写港口线');
  assert.equal(rows[1].bridge, '回到故乡');
  assert.equal(ctx.validateVolumeRanges(rows, 20), true);
  rows[1].startChapter = 10;
  assert.equal(ctx.validateVolumeRanges(rows, 20), false);
});
