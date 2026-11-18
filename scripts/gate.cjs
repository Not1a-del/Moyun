#!/usr/bin/env node
'use strict';
// 统一发布前门禁。
//   npm run gate          构建、语法、结构审计、关键逻辑回归、AI 协议、启动资源、预设与上下文、记忆库
//   npm run gate:browser  以上全部，再加上用本机已有的 Edge（无头、临时用户资料、只访问本机页面）跑的浏览器回归
// 只运行仓库内已入库的脚本：不需要安装依赖、不访问外网、不碰日常浏览器资料。
// 退出码：0 = 全部通过；1 = 有步骤失败；2 = 有步骤被跳过（例如找不到 Edge），不能当作通过。
// 报告：.ui-check/gate-report.json（命令、退出码、耗时、输出尾部）。
// 注意：这里的结果来自本地 mock 与本机浏览器，不等于真实服务商兼容性已经确认。
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const withBrowser = process.argv.includes('--browser');
const EDGE_PATHS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
];

const steps = [
  { id: 'build', title: '构建', args: ['scripts/build-static-site.cjs'], fatal: true },
  { id: 'syntax', title: '生成脚本语法检查', args: ['--check', 'assets/js/moyun.js'], fatal: true },
  { id: 'audit', title: '结构审计', args: ['scripts/structure-audit.cjs'] },
  { id: 'regression', title: '关键逻辑回归', args: ['scripts/regression-check.cjs'] },
  { id: 'ai-protocol', title: 'AI 协议回归（本地 mock）', args: ['scripts/ai-protocol-regression.cjs'] },
  { id: 'startup', title: '启动资源检查', args: ['--test', 'scripts/startup-regression.cjs'] },
  { id: 'v17', title: '预设与上下文回归', args: ['--test', 'scripts/preset-refactor.test.cjs', 'scripts/v17-context-regression.cjs'] },
  { id: 'v18-memory', title: '记忆库回归', args: ['scripts/v18-memory-volume.test.cjs'] },
  { id: 'v19', title: 'v0.0.19 功能回归', args: ['--test', ...fs.readdirSync(path.join(ROOT,'scripts')).filter(name => /^v19-.*\.test\.cjs$/.test(name)).sort().map(name => 'scripts/' + name)] }
];
const browserSteps = [
  { id: 'v19-reader-onekey', title: '角色持久化、旧格式导入、文风与阅读导航、开书选项（浏览器）', args: ['scripts/v19-outline-review-browser.cjs', '--reader-onekey'], browser: true },
  { id: 'v19-context-integrity', title: '作者设定、旧记忆默认只读与完整备份（浏览器）', args: ['scripts/v19-outline-review-browser.cjs', '--context-integrity'], browser: true },
  { id: 'v19-character-relations', title: '角色阵营、关系状态色与上下文统计（浏览器）', args: ['scripts/v19-outline-review-browser.cjs', '--character-relations'], browser: true },
  { id: 'v19-release-local', title: '站点标识、关于入口与公告（本地浏览器）', args: ['scripts/v19-outline-review-browser.cjs', '--release-smoke'], browser: true },
  { id: 'v19-regen-snapshot', title: '重生成快照查看、清理与保存回滚（浏览器）', args: ['scripts/v19-outline-review-browser.cjs', '--snapshot-cleanup'], browser: true },
  { id: 'v19-legacy-memory', title: '百万字旧书导入、记忆发送与启动迁移（浏览器）', args: ['scripts/v19-outline-review-browser.cjs', '--memory-recovery'], browser: true },
  { id: 'v19-mobile-layout', title: '手机开关、设置固定栏与可视区域（浏览器）', args: ['scripts/v19-outline-review-browser.cjs', '--mobile-layout'], browser: true },
  { id: 'v19-tablet-layout', title: '平板双栏底部可视区域（浏览器）', args: ['scripts/v19-outline-review-browser.cjs', '--mobile-layout', '--tablet-layout'], browser: true },
  { id: 'v18-browser', title: '浏览器回归（桌面与手机尺寸）', args: ['scripts/v18-browser.cjs'], browser: true },
  { id: 'v18-browser-legacy', title: '浏览器回归（--legacy 对照）', args: ['scripts/v18-browser.cjs', '--legacy'], browser: true },
  { id: 'v19-planning-recovery', title: '通用规划解析与中断恢复（浏览器）', args: ['scripts/v19-outline-review-browser.cjs', '--planning-recovery'], browser: true },
  { id: 'v19-manual-planning', title: '手动选择原文与分区填充（浏览器）', args: ['scripts/v19-outline-review-browser.cjs', '--manual-planning'], browser: true },
  { id: 'v19-volume-classification', title: '真实文本分卷、接受和刷新（浏览器本地重放）', args: ['scripts/v19-outline-review-browser.cjs', '--volume-classification'], browser: true },
  { id: 'v19-branch-context', title: '三层分支实际请求隔离与1116公告（浏览器）', args: ['scripts/v19-outline-review-browser.cjs', '--branch-context'], browser: true },
  { id: 'v19-settings-search', title: '设置关联词搜索与定位（浏览器）', args: ['scripts/v19-outline-review-browser.cjs', '--settings-search'], browser: true }
];

const tail = (text, n) => String(text || '').split(/\r?\n/).slice(-n).join('\n');
const indent = text => text.split('\n').map(line => '    ' + line).join('\n');
const git = args => {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? String(r.stdout).trim() : '';
};

function runStep(step) {
  const started = Date.now();
  const r = spawnSync(process.execPath, step.args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 10 * 60 * 1000 });
  const output = String(r.stdout || '') + String(r.stderr || '');
  return {
    id: step.id,
    title: step.title,
    command: 'node ' + step.args.join(' '),
    status: r.status === 0 && !r.error ? 'PASS' : 'FAIL',
    exitCode: r.status,
    error: r.error ? String(r.error.message) : null,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    outputTail: tail(output, 40)
  };
}

const edgeFound = process.platform === 'win32' && EDGE_PATHS.some(p => fs.existsSync(p));
const list = steps.concat(withBrowser ? browserSteps : []);
const dirtyBefore = git(['status', '--porcelain']).length > 0;
const results = [];
console.log('[gate] 共 ' + list.length + ' 步' + (withBrowser ? '（含浏览器回归）' : '（不含浏览器回归；加 --browser 运行）'));

let stopped = false;
for (const step of list) {
  const command = 'node ' + step.args.join(' ');
  if (stopped) {
    results.push({ id: step.id, title: step.title, command, status: 'SKIP', reason: '前面的必需步骤失败，已停止' });
    continue;
  }
  if (step.browser && !edgeFound) {
    results.push({ id: step.id, title: step.title, command, status: 'SKIP', reason: '未找到本机 Edge（仅支持 Windows 的 msedge.exe）' });
    console.log('[gate] ' + step.title + ' … 跳过（未找到 Edge）');
    continue;
  }
  process.stdout.write('[gate] ' + step.title + ' … ');
  const r = runStep(step);
  results.push(r);
  console.log(r.status + '（' + r.seconds + ' 秒）');
  if (r.status === 'FAIL') {
    console.log(indent(r.outputTail));
    if (step.fatal) stopped = true;
  }
}

const failed = results.filter(r => r.status === 'FAIL');
const skipped = results.filter(r => r.status === 'SKIP');
const passedCount = results.filter(r => r.status === 'PASS').length;
const notCovered = [
  '真实服务商的兼容性（本门禁只用本地 mock）',
  'iOS Safari 与手机真机的键盘、手势行为',
  '没有登记进本门禁的专项脚本（v16、v17 浏览器脚本、公告脚本等，需要手动启动 Edge 与本地服务）'
];
if (!withBrowser) notCovered.push('浏览器回归（本次没有加 --browser）');

const report = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  commit: git(['rev-parse', '--short', 'HEAD']),
  workingTreeDirtyBeforeRun: dirtyBefore,
  withBrowser,
  passed: failed.length === 0 && skipped.length === 0,
  results,
  notCovered
};
fs.mkdirSync(path.join(ROOT, '.ui-check'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.ui-check', 'gate-report.json'), JSON.stringify(report, null, 2) + '\n');

console.log('');
if (failed.length) console.error('[gate] 未通过：失败 ' + failed.map(r => r.id).join('、'));
else if (skipped.length) console.error('[gate] 未完整执行：跳过 ' + skipped.map(r => r.id).join('、') + '，不能当作通过');
else console.log('[gate] 已执行的 ' + passedCount + ' 步全部通过；在已覆盖范围内未发现问题。');
console.log('[gate] 未覆盖：' + notCovered.join('；'));
console.log('[gate] 报告：.ui-check/gate-report.json');
process.exit(failed.length ? 1 : skipped.length ? 2 : 0);
