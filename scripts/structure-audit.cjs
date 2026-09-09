#!/usr/bin/env node
// v0.0.12：模板结构静态审计（`npm run regress` 第 6 步）。
// 背景：v0.0.10 的角色工作台错位（卡片被挤成 26~30px 竖条）根因是 editor-head 少写 1 个 </div>，
// 浏览器解析时把后续兄弟节点全部吞进 flex 行内，文档总宽不变——横向溢出检测恒为绿，漏检上线。
// 本脚本对 source/moyun.single.html 的模板区（#app 到 </body>）做三件事：
//   1) 标签平衡：任何跨层闭合/多余闭合/EOF 残留 → FAIL；
//   2) v-else / v-else-if 配对：前一个兄弟必须带 v-if / v-else-if（void 元素如 img 计入兄弟）；
//   3) 关键卡片几何锚点（静态）：编辑器头部与档位行必须是编辑器直接子级（防再次吞层）。
// 特殊标签处理：<transition>/<transition-group>/<keep-alive>/<component>/<template> 按 Vue 语法计容器；
// img/input/br 等为 void 标签：不进栈，但作为兄弟参与 v-else 配对。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'source', 'moyun.single.html');
const src = fs.readFileSync(SOURCE, 'utf8');
let failed = 0;
const failures = [];
function check(label, ok, detail) {
  if (ok) console.log('  PASS', label);
  else { console.log('  FAIL', label, detail ? '— ' + detail : ''); failures.push(label); failed++; }
}

// ── 模板区提取：#app 起、</body> 止；剥掉 script 块与 HTML 注释 ──
const appStart = src.indexOf('<div id="app"');
const bodyEnd = src.indexOf('</body>');
if (appStart < 0 || bodyEnd < 0 || bodyEnd < appStart) {
  console.error('STRUCT AUDIT FATAL: 模板区定位失败（#app 或 </body> 缺失）');
  process.exit(1);
}
let tpl = src.slice(appStart, bodyEnd);
tpl = tpl.replace(/<script[\s\S]*?<\/script>/g, '');
tpl = tpl.replace(/<!--[\s\S]*?-->/g, '');

const VOID = new Set(['input', 'br', 'hr', 'img', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'track', 'wbr']);
const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
const VUE_SCOPED = new Set(['transition', 'transition-group', 'keep-alive', 'teleport', 'component', 'template']);

console.log('[structure-audit] 模板区 ' + tpl.length + ' 字符');

// ── 1. 标签平衡（严格栈） ──
const stack = [];
const balanceIssues = [];
let m;
tagRe.lastIndex = 0;
while ((m = tagRe.exec(tpl)) !== null) {
  const close = m[1] === '/', name = m[2].toLowerCase(), self = m[4] === '/' || VOID.has(name);
  if (close) {
    if (stack.length && stack[stack.length - 1].tag === name) { stack.pop(); continue; }
    let idx = -1;
    for (let j = stack.length - 1; j >= 0; j--) if (stack[j].tag === name) { idx = j; break; }
    if (idx === -1) { balanceIssues.push('多余 </' + name + '> @off' + m.index); continue; }
    const skipped = stack.slice(idx + 1);
    balanceIssues.push('</' + name + '> @off' + m.index + ' 跨层闭合，吞掉未闭合的 ' + skipped.map(s => '<' + s.tag + ' @off' + s.off + '>').join(','));
    stack.length = idx;
  } else if (!self) {
    stack.push({ tag: name, off: m.index });
  }
}
if (stack.length) balanceIssues.push('EOF 未闭合残留: ' + stack.map(s => '<' + s.tag + ' @off' + s.off + '>').join(', '));
check('标签平衡（跨层/多余/残留 = 0）', balanceIssues.length === 0, balanceIssues.slice(0, 3).join(' ; '));

// ── 2. v-else / v-else-if 配对 ──
const root = { tag: 'ROOT', kids: [], parent: null, vif: true, velseif: false, velse: false };
let cur = root;
const pairIssues = [];
let elseCount = 0;
tagRe.lastIndex = 0;
while ((m = tagRe.exec(tpl)) !== null) {
  const close = m[1] === '/', name = m[2].toLowerCase(), self = m[4] === '/' || VOID.has(name);
  const attrs = m[3] || '';
  if (close) { if (cur !== root) cur = cur.parent; continue; }
  const node = { tag: name, parent: cur, kids: [], vif: /\sv-if=/.test(attrs), velseif: /\sv-else-if=/.test(attrs), velse: /\sv-else(\s|$|>)/.test(attrs), off: m.index };
  cur.kids.push(node);
  if (!self) cur = node;
  if (node.velse || node.velseif) {
    elseCount++;
    const sibs = node.parent.kids;
    const i = sibs.indexOf(node);
    const prev = i > 0 ? sibs[i - 1] : null;
    if (!prev || !(prev.vif || prev.velseif)) {
      pairIssues.push('off' + node.off + ' <' + node.tag + '> 前一个兄弟缺 v-if/v-else-if: ' + tpl.slice(node.off, node.off + 70).replace(/\s+/g, ' '));
    }
  }
}
check('v-else/v-else-if 配对（共 ' + elseCount + ' 处）', pairIssues.length === 0, pairIssues.slice(0, 3).join(' ; '));

// ── 3. 关键卡片结构锚点：editor-head 与 levels 必须同为编辑器直接子级 ──
// v0.0.10 事故点：editor-head 区内 <div> 与 </div> 数量必须相等，且紧随其后的元素是 moyun-character-levels。
const headOpen = tpl.indexOf('<div class="moyun-character-editor-head">');
const levelsOpen = tpl.indexOf('<div class="moyun-character-levels"');
check('editor-head 锚点存在', headOpen >= 0 && levelsOpen > headOpen, 'headOpen=' + headOpen + ' levelsOpen=' + levelsOpen);
if (headOpen >= 0 && levelsOpen > headOpen) {
  const region = tpl.slice(headOpen, levelsOpen);
  const opens = (region.match(/<div\b/g) || []).length;
  const closes = (region.match(/<\/div>/g) || []).length;
  check('editor-head 闭合平衡（<div> ' + opens + ' = </div> ' + closes + '）', opens === closes, '缺 ' + (opens - closes) + ' 个 </div> —— v0.0.10 同款错位根因');
  // editor-head 的关闭标签后，下一个开始标签必须是 levels（同一父级），不能是 section 被吞进 head
  const headClose = tpl.lastIndexOf('</div>', levelsOpen);
  const between = tpl.slice(headClose + 6, levelsOpen).replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, '');
  check('editor-head 与 levels 同级（中间无其他元素）', between === '', '夹有: ' + between.slice(0, 60));
}

// ── 4. Vue 容器标签闭合（transition 等若被误判 void 会漏检，这里点名计数） ──
for (const t of VUE_SCOPED) {
  const open = (tpl.match(new RegExp('<' + t + '[\\s>]', 'g')) || []).length;
  const close = (tpl.match(new RegExp('</' + t + '>', 'g')) || []).length;
  if (t === 'component' || t === 'teleport') { if (open !== close) check('<' + t + '> 开闭一致', false, open + '/' + close); continue; }
  check('<' + t + '> 开闭一致（' + open + '/' + close + '）', open === close, 'open=' + open + ' close=' + close);
}

console.log('');
if (failed) { console.error('STRUCT AUDIT FAILED: ' + failed + ' 项失败\n  - ' + failures.join('\n  - ')); process.exit(1); }
console.log('STRUCT AUDIT PASSED: 模板结构无跨层/无配对缺失/关键锚点平衡');