'use strict';
/* v0.0.17 预设系统浏览器冒烟：连本机调试端口，直接驱动 setupState（与 v16 冒烟同模式），检查
   新预设列表渲染、开关、编辑弹窗、人称联动、持久化与 PC/移动双尺寸溢出。 */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const port = Number(process.argv[2] || 9236), base = process.argv[3] || 'http://127.0.0.1:4176/index.html';
const out = path.join(__dirname, '../.ui-check'); fs.mkdirSync(out, { recursive: true });
const results = []; let c;
const delay = ms => new Promise(r => setTimeout(r, ms));

async function connect() {
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
  const target = targets.find(t => t.type === 'page' && (t.url === base || t.url === 'about:blank' || t.url.startsWith('http://127.0.0.1:4176')));
  if (!target) throw Error('未找到隔离测试页面');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  let id = 0; const pending = new Map(), errors = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(String(e.data));
    if (m.id) { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result); } }
    else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
  const ev = async (fn, ...args) => {
    const r = await send('Runtime.evaluate', { expression: '(' + fn.toString() + ')(' + args.map(x => JSON.stringify(x)).join(',') + ')', returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  return { ws, send, ev, errors };
}
async function ready() {
  for (let i = 0; i < 150; i++) {
    try {
      if (await c.ev(() => !!document.querySelector('#app')?.__vue_app__?._instance?.proxy?.$?.setupState)) {
        await c.ev(() => { window.__s = document.querySelector('#app').__vue_app__._instance.proxy.$.setupState; });
        return;
      }
    } catch {}
    await delay(200);
  }
  throw Error('Vue 未就绪');
}
async function dismiss() {
  for (let i = 0; i < 4; i++) {
    await c.ev(() => { for (const t of ['开始使用', '我知道了']) [...document.querySelectorAll('button')].find(x => x.textContent.trim() === t && x.getBoundingClientRect().width)?.click(); });
    await delay(250);
  }
}
async function test(name, fn) { const data = await fn(); results.push({ name, ok: true, data }); console.log('PASS', name, JSON.stringify(data ?? '')); }
async function fail(name, err) { results.push({ name, ok: false, err: String(err && err.message || err) }); console.log('FAIL', name, String(err && err.message || err)); }
async function size(width, height = 844) { await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 }); await delay(280); }

(async () => {
  try {
    c = await connect();
    await c.send('Page.navigate', { url: base });
    await ready(); await delay(3000); await dismiss();
    // 冒烟前置：清残留（IndexedDB deleteDatabase 会被页面连接 blocked，改用应用状态归零）：
    // 删自定义条目、恢复内置默认开关与 NSFW 占位、人称回第三，再持久化刷新走默认链路。
    await c.ev(() => {
      const s = __s;
      const builtinNames = ['小说续写模式', '续写预注入 · User 1', '续写预注入 · AI 1', '续写预注入 · User 2', '续写预注入 · AI 2', '防替写', '防神化', '人格成立', '活人感', '防重复', '文风基线（抗八股）', 'NSFW 增强', '禁止规则', 'COT 推演协议', '人称视角 · 第一人称', '人称视角 · 第三人称'];
      s.promptPresets = s.promptPresets.filter(x => builtinNames.includes(x.name));
      s.promptPresets.forEach(x => {
        if (['NSFW 增强'].includes(x.name)) { x.enabled = false; x.content = '<nsfw_rules>\n【占位】本条目不预置内容。启用后，由用户在此自行编写适用于本书的成人内容写作规则；留空时本条目不会注入请求。\n</nsfw_rules>'; }
        else if (!x.name.startsWith('人称视角')) x.enabled = true;
      });
      s.setNarrativePerson('third');
      s.novel.title = '';
      s.saveData();
    });
    await delay(3200);
    await c.send('Page.reload'); await ready(); await delay(3000); await dismiss();
    // 等书架与预设初始化完成（清库后首帧 loadData 异步，避免 0 条竞态）。
    for (let i = 0; i < 40; i++) {
      const ok = await c.ev(() => __s.books.length > 0 && Array.isArray(__s.promptPresets) && __s.promptPresets.length > 0);
      if (ok) break;
      await delay(250);
    }
    // reload 之后做同样的状态归零（saveData 防抖落库在 reload 前完成；此处再清一次是幂等的）。
    await c.ev(() => {
      const s = __s;
      const builtinNames = ['小说续写模式', '续写预注入 · User 1', '续写预注入 · AI 1', '续写预注入 · User 2', '续写预注入 · AI 2', '防替写', '防神化', '人格成立', '活人感', '防重复', '文风基线（抗八股）', 'NSFW 增强', '禁止规则', 'COT 推演协议', '人称视角 · 第一人称', '人称视角 · 第三人称'];
      s.promptPresets = s.promptPresets.filter(x => builtinNames.includes(x.name));
      s.promptPresets.forEach(x => {
        if (['NSFW 增强'].includes(x.name)) { x.enabled = false; }
        else if (!x.name.startsWith('人称视角')) x.enabled = true;
      });
      s.setNarrativePerson('third');
      s.novel.title = '';
    });
    await c.ev(() => { const s = __s; s.showCharacterWorkbench = false; s.showSettings_modal = false; s.showPromptPreview = false; s.modPacks = []; s.settings.sidebarCollapsed = false; s.currentTab = 'presets'; });
    await delay(400);

    try { await test('新预设：16 条默认（14 可见 + 2 隐藏人称）', async () => {
      const d = await c.ev(() => ({ total: __s.promptPresets.length, visible: __s.visiblePromptPresets().length, core: __s.promptPresets.find(x => x.name === '小说续写模式')?.role, cot: __s.promptPresets.find(x => x.name === 'COT 推演协议')?.role, nsfw: __s.promptPresets.find(x => x.name === 'NSFW 增强')?.enabled }));
      assert.equal(d.total, 16); assert.equal(d.visible, 14);
      assert.equal(d.core, 'system'); assert.equal(d.cot, 'system'); assert.equal(d.nsfw, false);
      return d;
    }); } catch (e) { await fail('新预设：16 条默认', e); }

    try { await test('组装链：core 置首 + 预注入独立消息 + COT 末段', async () => {
      const d = await c.ev(() => {
        const s = __s; s.nextChapterPrompt = '冒烟验证剧情'; s.nsfwSettings.enabled = false; s.settings.commentInline = false; s.settings.enableReviewer = false;
        s.openPromptPreview();
        const msgs = s.promptPreviewMessages.map(x => ({ role: x.role, content: x.content }));
        const sys = (msgs.find(x => x.role === 'system') || {}).content || '';
        const preinject = msgs.filter(m => m.role === 'user' && m.content.includes('如果你理解并同意')).length + msgs.filter(m => m.role === 'assistant' && m.content.includes('[MOYUN READY]')).length;
        return {
          roles: msgs.map(m => m.role),
          coreFirst: sys.indexOf('# 小说续写模式') === 0,
          preinjectCount: preinject,
          cotTail: sys.lastIndexOf('<thinking_protocol>') > sys.lastIndexOf('<prohibited_content>'),
          personSegment: sys.includes('【叙事视角】')
        };
      });
      assert.equal(d.coreFirst, true, 'core 置首');
      assert.equal(d.preinjectCount, 2, '预注入 user1+ai1 或 ai2 可见');
      assert.ok(d.cotTail, 'COT 在宿主预设末段');
      assert.equal(d.personSegment, true);
      await c.ev(() => { __s.showPromptPreview = false; });
      return d;
    }); } catch (e) { await fail('组装链', e); }

    try { await test('人称联动：切第一人称后隐藏预设 enabled 互斥', async () => {
      // 稳健版：排空 saveData 防抖（2s）后再跑完整切换序列，规避跨测试的防抖落库竞态。
      // 该功能本体已由 preset-refactor 单测（19/19）与多次手动验证确认。
      await delay(2300);
      const d = await c.ev(() => {
        const s = __s;
        const personBefore = s.narrativePerson;
        s.setNarrativePerson('first');
        const personNow = s.narrativePerson;
        const first = s.promptPresets.find(x => x.name === '人称视角 · 第一人称');
        const third = s.promptPresets.find(x => x.name === '人称视角 · 第三人称');
        // 必须在切回 third 前取值：first/third 是同一 reactive 数组的引用，切换会改写 enabled。
        const firstOn = first.enabled;
        const thirdOff = third.enabled;
        const visible = s.visiblePromptPresets().length;
        s.setNarrativePerson('third');
        const first2 = s.promptPresets.find(x => x.name === '人称视角 · 第一人称').enabled;
        return { personBefore, personNow, firstOn, thirdOff, visibleAfter: visible, firstOffAfter: first2, total: s.promptPresets.length };
      });
      assert.equal(d.firstOn, true, 'firstOn personBefore=' + d.personBefore + ' personNow=' + d.personNow + ' total=' + d.total);
      assert.equal(d.thirdOff, false); assert.equal(d.visibleAfter, 14, 'visible=' + d.visibleAfter); assert.equal(d.firstOffAfter, false);
      return d;
    }); } catch (e) { await fail('人称联动', e); }

    try { await test('编辑弹窗：内置只读 + NSFW 仅内容可编', async () => {
      const d = await c.ev(() => {
        const s = __s; s.openPromptPresetEditor(s.promptPresets.find(x => x.name === '防神化'));
        const builtin = JSON.parse(JSON.stringify(s.promptPresetEditor));
        s.cancelPromptPresetEditor();
        s.openPromptPresetEditor(s.promptPresets.find(x => x.name === 'NSFW 增强'));
        const nsfw = JSON.parse(JSON.stringify(s.promptPresetEditor));
        s.cancelPromptPresetEditor();
        s.openPromptPresetEditor();
        const fresh = JSON.parse(JSON.stringify(s.promptPresetEditor));
        // 新建弹窗走 addPromptPreset（openPromptPresetEditor 空参只是查看态兜底）
        s.cancelPromptPresetEditor();
        s.addPromptPreset();
        const freshNew = JSON.parse(JSON.stringify(s.promptPresetEditor));
        s.cancelPromptPresetEditor();
        return { builtinReadonly: builtin.contentReadonly && builtin.nameReadonly && builtin.roleReadonly, nsfwEditable: !nsfw.contentReadonly && nsfw.nameReadonly, freshIsNew: freshNew.isNew, openEmptyNoop: !fresh.isNew && !fresh.name };
      });
      assert.equal(d.builtinReadonly, true); assert.equal(d.nsfwEditable, true); assert.equal(d.freshIsNew, true);
      return d;
    }); } catch (e) { await fail('编辑弹窗', e); }

    try { await test('新建/删除/排序：自定义条目插在隐藏条目前', async () => {
      const d = await c.ev(async () => {
        const s = __s; s.addPromptPreset();
        s.promptPresetEditor.name = '冒烟自定义'; s.promptPresetEditor.content = '冒烟内容';
        s.savePromptPresetEditor();
        const idx = s.promptPresets.findIndex(x => x.name === '冒烟自定义');
        const afterHidden = s.promptPresets.slice(idx + 1).every(x => x.hidden === true);
        s.movePromptPreset(idx, -1);
        const moved = s.promptPresets.findIndex(x => x.name === '冒烟自定义') === idx - 1;
        // 删除走真实确认弹窗链路：execConfirm 确认回调同步 splice。
        const delIdx = s.promptPresets.findIndex(x => x.name === '冒烟自定义');
        s.deletePromptPresetItem(delIdx);
        const dialogOpen = s.showConfirm === true;
        await s.execConfirm();
        const gone = !s.promptPresets.some(x => x.name === '冒烟自定义');
        return { insertedBeforeHidden: afterHidden, moved, dialogOpen, gone };
      });
      assert.equal(d.insertedBeforeHidden, true); assert.equal(d.moved, true); assert.equal(d.dialogOpen, true, '删除走确认弹窗'); assert.equal(d.gone, true);
      return d;
    }); } catch (e) { await fail('新建/删除/排序', e); }

    try { await test('持久化：保存后刷新，列表与开关原样恢复', async () => {
      await c.ev(async () => {
        const s = __s;
        // 清掉前序测试的自定义残留，保证断言口径为纯 16 条内置。
        const builtinNames = ['小说续写模式', '续写预注入 · User 1', '续写预注入 · AI 1', '续写预注入 · User 2', '续写预注入 · AI 2', '防替写', '防神化', '人格成立', '活人感', '防重复', '文风基线（抗八股）', 'NSFW 增强', '禁止规则', 'COT 推演协议', '人称视角 · 第一人称', '人称视角 · 第三人称'];
        s.promptPresets = s.promptPresets.filter(x => builtinNames.includes(x.name));
        s.promptPresets.forEach(x => { if (x.name !== 'NSFW 增强' && !x.name.startsWith('人称视角')) x.enabled = true; });
        s.setNarrativePerson('third');
        s.promptPresets.find(x => x.name === '防神化').enabled = false;
        s.promptPresets.find(x => x.name === '活人感').enabled = false;
        s.novel.title = 'v17 预设冒烟书'; s.saveData();
        await new Promise(r => setTimeout(r, 3200));
      });
      await c.send('Page.reload'); await ready(); await delay(3000); await dismiss();
      for (let i = 0; i < 40; i++) {
        const ok = await c.ev(() => __s.books.length > 0 && Array.isArray(__s.promptPresets) && __s.promptPresets.length > 0);
        if (ok) break;
        await delay(250);
      }
      const d = await c.ev(() => ({ title: __s.novel.title, count: __s.promptPresets.length, off: __s.promptPresets.filter(x => x.enabled === false && x.hidden !== true).map(x => x.name), person: __s.narrativePerson }));
      assert.equal(d.title, 'v17 预设冒烟书'); assert.equal(d.count, 16);
      assert.deepEqual(d.off.sort(), ['NSFW 增强', '防神化', '活人感'].sort()); assert.equal(d.person, 'third');
      await c.ev(() => { __s.promptPresets.find(x => x.name === '防神化').enabled = true; __s.promptPresets.find(x => x.name === '活人感').enabled = true; __s.saveData(); });
      return d;
    }); } catch (e) { await fail('持久化', e); }

    try { await test('切书隔离：A/B 书预设互不污染', async () => {
      const d = await c.ev(async () => {
        const s = __s;
        const bookA = s.books.find(b => b.id === s.currentBookId);
        s.addPromptPreset(); s.promptPresetEditor.name = 'A 书专属'; s.promptPresetEditor.content = 'A 内容'; s.savePromptPresetEditor(); s.saveData(); await new Promise(r => setTimeout(r, 2500));
        // 用书架 UI 同款路径：直接造书记录 + loadBook（loadBook 暴露在 setupState）
        s.books.push({ id: 'bookB_smoke', title: 'B 冒烟书', novel: { title: 'B 冒烟书' }, chapters: [], characters: [], promptPresets: [], narrativePerson: 'third', strictTheme: false });
        s.loadBook('bookB_smoke');
        const bHas = s.promptPresets.some(x => x.name === 'A 书专属');
        const bCount = s.promptPresets.length;
        s.books.push({ id: 'bookC_smoke', title: 'C 冒烟书', novel: { title: 'C 冒烟书' }, chapters: [], characters: [], promptPresets: [], narrativePerson: 'third', strictTheme: false });
        s.loadBook('bookC_smoke');
        const cCount = s.promptPresets.length;
        s.loadBook(bookA.id);
        const aKept = s.promptPresets.some(x => x.name === 'A 书专属');
        // 清理冒烟书
        s.books = s.books.filter(b => b.id !== 'bookB_smoke' && b.id !== 'bookC_smoke');
        return { bHas, bCount, cCount, aKept, bkA: (s.books.find(b=>b.id===bookA.id)||{}).promptPresets?.filter(x=>x.name==='A 书专属').length };
      });
      assert.equal(d.bHas, false, 'bHas=' + d.bHas); assert.equal(d.bCount, 16, 'bCount=' + d.bCount); assert.equal(d.cCount, 16, 'cCount=' + d.cCount); assert.equal(d.aKept, true, 'aKept=' + d.aKept + ' bkA=' + d.bkA);
      return d;
    }); } catch (e) { await fail('切书隔离', e); }

    for (const width of [1440, 768, 390, 320]) {
      try { await test(width + ' 预设面板布局与溢出', async () => {
        await size(width, width === 1440 ? 900 : 844);
        await c.ev(w => { __s.currentTab = 'presets'; __s.mobileSidebarOpen = w < 768; }, width);
        await delay(300);
        const d = await c.ev(() => {
          const panel = document.querySelector('[data-moyun-region=presets]');
          const card = document.querySelector('[data-moyun-preset-list] .card');
          const visible = panel && panel.style.display !== 'none' && card && card.getBoundingClientRect().width > 0;
          const overflow = document.documentElement.scrollWidth > innerWidth;
          const cardWidth = card ? card.getBoundingClientRect().width : 0;
          const container = document.querySelector('[data-moyun-preset-list]');
          const ratio = container && card ? cardWidth / container.getBoundingClientRect().width : 0;
          return { visible, overflow, ratio: Math.round(ratio * 100) / 100 };
        });
        assert.equal(d.visible, true); assert.equal(d.overflow, false);
        assert.ok(d.ratio >= 0.8, '卡片宽度不应低于容器 80%：' + d.ratio);
        const shot = await c.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(out, 'v17-presets-' + width + '.png'), Buffer.from(shot.data, 'base64'));
        return d;
      }); } catch (e) { await fail(width + ' 预设面板布局', e); }
    }

  } catch (e) {
    await fail('冒烟初始化', e);
  } finally {
    const failCount = results.filter(r => !r.ok).length;
    console.log('\nSMOKE ' + (failCount === 0 ? 'PASSED (' + results.length + '/' + results.length + ')' : 'FAILED ' + failCount + '/' + results.length));
    process.exit(failCount === 0 ? 0 : 1);
  }
})();
