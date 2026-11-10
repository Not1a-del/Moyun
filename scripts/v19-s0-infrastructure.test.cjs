'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const {createFixtures,toLibrary,writeFixtures} = require('./v19-make-fixtures.cjs');
const {MODES,responseText,createFakeAi,browserFakeAiScript,writeRequestLog} = require('./v19-fake-ai.cjs');
const {installStorageSimulator,browserStorageScript} = require('./v19-storage-simulator.cjs');
const ask = (fake,body={},signal,url='https://fixture.invalid/v1/chat/completions')=>fake.fetch(url,{method:'POST',body:JSON.stringify(body),signal});

test('A-F match planned sizes, legacy B omits new fields, F retains paragraph variants',()=>{
  const {A,B,C,D,E,F} = createFixtures();
  assert.equal(A.chapters.length,0);assert.equal(A.novel.outline,'');assert.equal(A.characters.length,0);
  assert.equal(B.chapters.length,30);assert.equal(B.branchList.length-1,2);assert.equal(B.novel.volumes.length,1);
  for(const key of ['branchData','staleMarks','unfinishedMode','reviewStates'])assert.equal(Object.hasOwn(B,key),false,key);
  assert.equal(B.chapterOutlines.some(row=>Object.hasOwn(row,'history')),false);
  assert.equal(C.chapters.length,100);assert.equal(C.branchList.length-1,3);assert.equal(C.chapterOutlines.length,100);assert.equal(C.storyBible.world.entries.length,30);
  for(const branch of C.branchList.slice(1))assert.equal(C.branchData[branch.id].chapterOutlines[0].chapterNo,branch.forkIndex+2);
  assert.equal(D.chapters.length,0);assert.equal(D.chapterOutlines.length,35);assert.equal(D.novel.outline,'');assert.doesNotMatch(D.chapterOutlines.at(-1).content,/故事结束/);
  assert.equal(E.chapterOutlines.length,12);assert.match(E.chapterOutlines.at(-1).content,/故事结束/);
  assert.equal(F.chapters.length,1);assert.equal(F.chapters[0].content.replace(/\s/g,'').length,8000);
  for(const separator of ['\n','\n\n','\r\n\r\n','　　'])assert.ok(F.chapters[0].content.includes(separator));
  const library = toLibrary(B); library.books[0].novel.title='changed';assert.notEqual(B.novel.title,'changed');assert.notEqual(library.novel.title,'changed');
  assert.deepEqual(createFixtures(),createFixtures(),'fixed IDs and timestamps must be reproducible');
});

test('fixture and request-log files are generated deterministically',()=>{
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'moyun-v19-fixtures-'));
  try {
    const first = writeFixtures(temp), b = fs.readFileSync(path.join(temp,'B.json'),'utf8');
    assert.equal(JSON.parse(b).id,'v19-fixture-B');assert.deepEqual(writeFixtures(temp),first);
    const fake={requests:[{prompt:'完整提示词',body:{messages:[{role:'user',content:'不可截断'}]}}]};
    writeRequestLog(fake,path.join(temp,'requests.json'));assert.deepEqual(JSON.parse(fs.readFileSync(path.join(temp,'requests.json'),'utf8')),fake.requests);
  }finally {fs.rmSync(temp,{recursive:true,force:true});}
});

test('all F01-F12 response variants are available with distinct malformed input',()=>{
  for(const mode of MODES)assert.equal(typeof responseText('records',mode),'string',mode);
  assert.equal(JSON.parse(responseText('records','valid')).length,10);
  assert.match(responseText('records','fenced'),/json/);assert.match(responseText('records','prose'),/好的/);
  assert.match(responseText('records','trailing-comma'),/,]/);assert.match(responseText('records','curly-quotes'),/“/);assert.match(responseText('records','single-quotes'),/'chapterNo'/);
  assert.equal(Object.hasOwn(JSON.parse(responseText('records','missing-optional'))[0],'characterIds'),false);
  assert.equal(JSON.parse(responseText('records','missing-required')).filter(row=>!row.content).length,1);
  assert.equal(JSON.parse(responseText('records','wrong-types'))[0].chapterNo,'第3章');
  assert.throws(()=>JSON.parse(responseText('records','truncated')));
  assert.match(responseText('records','refusal'),/无法完成/);assert.match(responseText('records','html'),/<!doctype html>/);
  assert.equal(responseText('records','empty'),'');assert.equal(responseText('records','whitespace').trim(),'');
  assert.equal(responseText('records','missing-end-marker').includes('【新内容结束】'),false);
  assert.equal(responseText('records','duplicate-markers').split('【新内容开始】').length,3);
  assert.equal(responseText('records','nested-markers').startsWith('【新内容开始】外层内容。【新内容开始】'),true);
});

test('fetch returns valid JSON and streaming frames for all four protocol adapters',async()=>{
  const fake = createFakeAi({taskType:'settings',wireChunkSize:3,chunkSize:5});
  for(const url of ['https://fixture.invalid/v1/chat/completions','https://fixture.invalid/v1/messages','https://fixture.invalid/v1/models/test:generateContent']) {
    const result = await (await ask(fake,{messages:[{role:'user',content:'完整用户提示词'}]},undefined,url)).json();
    assert.ok(result.choices || result.content || result.candidates,url);
    const streamUrl = url.replace(':generateContent',':streamGenerateContent');
    const response = await ask(fake,{stream:true},undefined,streamUrl), wire = await response.text();
    assert.match(response.headers.get('content-type'),/text\/event-stream/);assert.match(wire,/data: /);
    assert.ok(wire.includes('雾港') || /content_block_delta|"delta"|"candidates"/.test(wire));
  }
  assert.equal(fake.requests[0].body.messages[0].content,'完整用户提示词');
  assert.ok(fake.requests.every(request=>request.status===200));
});

test('routes, sequential failures, HTTP 401/429, timeout and cancellation are observable',async()=>{
  const fake = createFakeAi({sequence:['F-09','401','429','failure','timeout'],timeoutMs:5});
  assert.match((await (await ask(fake)).json()).choices[0].message.content,/无法完成/);
  assert.equal((await ask(fake)).status,401);assert.equal((await ask(fake)).status,429);
  await assert.rejects(ask(fake),{name:'TypeError'});await assert.rejects(ask(fake),{name:'TimeoutError'});
  const delayed = createFakeAi({delayMs:1000}), controller = new AbortController();
  const pending = ask(delayed,{},controller.signal);controller.abort();await assert.rejects(pending,{name:'AbortError'});
  assert.equal(delayed.requests[0].error.name,'AbortError');
  const route = createFakeAi({routes:{settings:'empty'}});
  assert.equal((await (await ask(route,{taskType:'settings'})).json()).choices[0].message.content,'');
  assert.equal(route.requests[0].taskType,'settings');
  const html=await ask(createFakeAi({mode:'html'}));
  assert.match(html.headers.get('content-type'),/text\/html/);assert.match(await html.text(),/<!doctype html>/);
  for(const [url,key,value] of [['https://fixture.invalid/v1/chat/completions','finish_reason','length'],['https://fixture.invalid/v1/messages','stop_reason','max_tokens'],['https://fixture.invalid/v1/models/test:generateContent','finishReason','MAX_TOKENS']]) {
    const truncated=createFakeAi({mode:'truncated'}),data=await(await ask(truncated,{},undefined,url)).json();
    assert.equal((data.choices?.[0]||data.candidates?.[0]||data)[key],value);
    assert.ok((await(await ask(truncated,{stream:true},undefined,url.replace(':generateContent',':streamGenerateContent'))).text()).includes(value));
  }
});

test('serialized browser hooks intercept AI only, leave asset fetches intact, and restore',async()=>{
  const context={Response,ReadableStream,TextEncoder,DOMException,setTimeout,clearTimeout,fetch:async()=>new Response('asset')};
  vm.runInNewContext(browserFakeAiScript({taskType:'settings'}),context);
  assert.equal(await (await context.fetch('https://fixture.invalid/asset.js')).text(),'asset');
  assert.ok((await (await context.fetch('https://fixture.invalid/v1/chat/completions',{body:'{}'})).json()).choices);
  assert.equal(context.__v19FakeAi.requests.length,1);
  class Store {put(){return 'put';}add(){return 'add';}}
  class Storage {setItem(){return 'saved';}}
  class Database {transaction(){return 'transaction';}}
  const target={navigator:{storage:{estimate:async()=>({usage:1,quota:10})}},indexedDB:{open:()=> 'opened'},IDBObjectStore:Store,Storage,IDBDatabase:Database,DOMException};
  const before = target.navigator.storage.estimate;
  const simulation = installStorageSimulator({usage:99,quota:100,quotaExceeded:true,indexedDBUnavailable:true},target);
  assert.deepEqual(await target.navigator.storage.estimate(),{usage:99,quota:100});
  assert.throws(()=>new Store().put(),{name:'QuotaExceededError'});assert.throws(()=>new Storage().setItem(),{name:'QuotaExceededError'});assert.throws(()=>target.indexedDB.open(),{name:'SecurityError'});assert.throws(()=>new Database().transaction(),{name:'SecurityError'});
  simulation.restore();assert.equal(target.navigator.storage.estimate,before);assert.equal(new Store().put(),'put');assert.equal(target.indexedDB.open(),'opened');
  vm.runInNewContext(browserStorageScript({usage:2,quota:3}),context);
  assert.deepEqual(JSON.parse(JSON.stringify(await context.navigator.storage.estimate())),{usage:2,quota:3});context.__v19StorageSimulator.restore();
});

