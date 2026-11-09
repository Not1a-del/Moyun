'use strict';
// v0.0.19：结构审计的追加检查，由 structure-audit.cjs 调用（npm run audit）。
// 补上“人短时间内不容易发现”的几类问题：
//   1) 新增 localStorage 键 / IndexedDB 库：书的数据只应走原有 IndexedDB 路径，localStorage 只放 API 密钥、主题等小设置；
//   2) 同缩进同名函数：同一作用域重复声明时，后者会静默覆盖前者；
//   3) 已删除功能的符号仍有残留引用。
// 基线登记在 scripts/audit-baseline.json。确属有意新增时运行：node scripts/structure-audit.cjs --write-baseline，
// 人工核对 git diff，并在提交说明里写明理由。
// 已删除符号登记在 scripts/audit-removed-symbols.json（删除功能时同步登记）。
const fs = require('fs');
const path = require('path');

const BASELINE_FILE = path.join(__dirname, 'audit-baseline.json');
const REMOVED_FILE = path.join(__dirname, 'audit-removed-symbols.json');

const norm = s => String(s).replace(/\s+/g, ' ').trim();
const isPlainLiteral = s => /^(['"`])[^'"`]*\1$/.test(s);
const sortedUnique = list => Array.from(new Set(list)).sort();

function collect(src, re) {
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) out.push(norm(m[1]));
  return out;
}

function scan(src) {
  const keyExprs = collect(src, /localStorage\.(?:setItem|getItem|removeItem)\(\s*([^,)]+)/g);
  const variableKeySites = {};
  keyExprs.filter(e => !isPlainLiteral(e)).forEach(e => { variableKeySites[e] = (variableKeySites[e] || 0) + 1; });
  const functions = {};
  src.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/^( *)(?:async +)?function\*?\s+([A-Za-z0-9_$]+)\s*\(/);
    if (!m) return;
    const key = m[1].length + ':' + m[2];
    (functions[key] = functions[key] || []).push(i + 1);
  });
  return {
    literalKeys: sortedUnique(keyExprs.filter(isPlainLiteral)),
    variableKeySites: Object.fromEntries(Object.entries(variableKeySites).sort((a, b) => (a[0] < b[0] ? -1 : 1))),
    otherAccess: (src.match(/localStorage\s*\[|Object\.keys\(\s*localStorage\s*\)|localStorage\.(?:key|length|clear)\b/g) || []).length,
    indexedDBNames: sortedUnique(collect(src, /indexedDB\.open\(\s*([^,)]+)/g)),
    functions
  };
}

function run({ src, check, writeBaseline }) {
  const cur = scan(src);
  const duplicateFunctions = Object.keys(cur.functions).filter(k => cur.functions[k].length > 1).sort();
  const snapshot = {
    localStorage: { literalKeys: cur.literalKeys, variableKeySites: cur.variableKeySites, otherAccess: cur.otherAccess },
    indexedDBNames: cur.indexedDBNames,
    duplicateFunctions
  };

  if (writeBaseline) {
    const out = Object.assign({ '_说明': '审计基线：现有 localStorage 键、IndexedDB 库名和跨作用域同名函数。只在有意新增时用 node scripts/structure-audit.cjs --write-baseline 重新生成，并核对 git diff。' }, snapshot);
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(out, null, 2) + '\n');
    console.log('  已写入基线 scripts/audit-baseline.json —— 请人工核对 git diff，并在提交说明里写明新增原因');
  } else {
    let base = null;
    try { base = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')); } catch (e) { base = null; }
    if (!base) {
      check('审计基线可读取（scripts/audit-baseline.json）', false, '缺失或损坏；确认源码现状无误后运行 node scripts/structure-audit.cjs --write-baseline');
    } else {
      const ls = base.localStorage || {};
      const baseSites = ls.variableKeySites || {};
      const newKeys = cur.literalKeys.filter(k => !(ls.literalKeys || []).includes(k));
      check('localStorage：没有未登记的新增键（共 ' + cur.literalKeys.length + ' 个字面量键）', newKeys.length === 0,
        '新增 ' + newKeys.join(' , ') + ' —— 书的数据必须走 IndexedDB；确需新增小设置项时登记基线并写明理由');
      const grown = Object.keys(cur.variableKeySites).filter(e => cur.variableKeySites[e] > (baseSites[e] || 0));
      check('localStorage：变量/拼接键的读写点没有增加', grown.length === 0,
        grown.map(e => e + ' ' + (baseSites[e] || 0) + '→' + cur.variableKeySites[e]).join(' ; ') + ' —— 变量键可能藏着新键，请确认并登记');
      check('localStorage：遍历/清空类访问没有增加', cur.otherAccess <= (ls.otherAccess || 0), cur.otherAccess + ' > ' + (ls.otherAccess || 0));
      const newDb = cur.indexedDBNames.filter(n => !(base.indexedDBNames || []).includes(n));
      check('IndexedDB：没有未登记的新增库（共 ' + cur.indexedDBNames.length + ' 个）', newDb.length === 0,
        '新增 ' + newDb.join(' , ') + ' —— 新数据应挂在书的数据里走 DB.saveLibrary，不要另开库');
      const known = new Set(base.duplicateFunctions || []);
      const newDup = duplicateFunctions.filter(k => !known.has(k));
      check('同缩进同名函数：没有未登记的重复声明（已登记 ' + known.size + ' 组为不同作用域的同名内部函数）', newDup.length === 0,
        newDup.map(k => k + ' @行 ' + cur.functions[k].join('/')).join(' ; ') + ' —— 同一作用域重复声明会静默覆盖');
    }
  }

  let removed = null;
  try { removed = JSON.parse(fs.readFileSync(REMOVED_FILE, 'utf8')).symbols; } catch (e) { removed = null; }
  if (!Array.isArray(removed)) {
    check('已删除符号清单可读取（scripts/audit-removed-symbols.json）', false, '缺失，或格式不是 { symbols: [...] }');
  } else {
    const lines = src.split(/\r?\n/);
    const left = [];
    removed.forEach(item => {
      const name = String((item && item.name) || '').trim();
      if (!name) return;
      const re = new RegExp('(?<![A-Za-z0-9_$])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9_$])');
      const hits = [];
      lines.forEach((line, i) => { if (re.test(line)) hits.push(i + 1); });
      if (hits.length) left.push(name + ' @行 ' + hits.slice(0, 5).join('/') + (hits.length > 5 ? ' 等共 ' + hits.length + ' 处' : ''));
    });
    check('已删除符号没有残留引用（登记 ' + removed.length + ' 个）', left.length === 0,
      left.join(' ; ') + ' —— 删除功能时必须同时删掉模板和脚本里的全部引用');
  }
}

module.exports = { run, scan };
