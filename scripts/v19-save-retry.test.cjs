'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8'),clone=value=>JSON.parse(JSON.stringify(value));
const start=source.indexOf('    let libraryPersistenceRunning='),end=source.indexOf('    const _saveDebounced =',start);assert.ok(start>=0&&end>start);
function failure(name,message=name){return Object.assign(new Error(message),{name});}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
function runtime(save,storage){
 let clock=100000,sequence=0,active=0,peak=0,durable={revision:7,chapters:[{id:'old',content:'原记录'}]};const delays=[],notices=[],backups=new Map(),cleared=[],calls=[],logs=[];
 const c={Map,Promise,navigator:storage===undefined?{}:{storage},Date:{now:()=>clock},console:{log:(...args)=>logs.push(args),error:(...args)=>logs.push(args)},
  setTimeout:(cb,ms)=>{delays.push(ms);Promise.resolve().then(cb);return delays.length;},showToast:(...args)=>notices.push(args),storageLoadFailed:false,_lastKnownLibraryRevision:7,_overwriteRemoteLibraryOnce:false,completedSaveRevision:0,CONNECTION_CREDENTIALS_DB_KEY:'fixture-credentials',connectionCredentials:{value:{api:'test-only'}},
  buildLibrarySnapshot:()=>({currentBookId:'book',chapters:[{id:'new',content:'待保存正文'}],novel:{favoriteClips:[{snapshot:'喜欢快照'}]}}),readStoredLibraryRevision:async()=>durable.revision,checkStorageQuota:async()=>({supported:false}),
  saveEmergencyBackup:(library,reason)=>{const backupToken='backup-'+(++sequence);backups.set(backupToken,{library:clone(library),reason});return {backupToken};},clearEmergencyBackup:(token,bookId)=>{cleared.push({token,bookId});backups.delete(token);},promptLibraryWriteConflict:()=>{throw Error('本用例不应发生跨标签冲突');},
  DB:{saveLibrary:async(...args)=>{calls.push(args);active++;peak=Math.max(peak,active);try{const result=save?await save(calls.length,args,c):'indexedDB';durable=clone(args[0]);return result;}finally{active--;}}}};
 vm.createContext(c);vm.runInContext(source.slice(start,end)+'\n;globalThis.api={requestPersistentStorage,isRetryableLibraryError,saveLibraryWithRetry,persistLibraryNow,performLibraryPersistence,notifyLibrarySaveFailure};',c);
 return {c,api:c.api,calls,delays,notices,backups,cleared,logs,get peak(){return peak;},get durable(){return durable;},advance:ms=>{clock+=ms;}};
}

test('前两次InvalidStateError第三次成功，按250/500等待且不提示失败',async()=>{
 const r=runtime(at=>{if(at<3)throw failure('InvalidStateError');return 'indexedDB';});assert.equal(await r.api.performLibraryPersistence('逐章保存'),true);assert.equal(r.calls.length,3);assert.deepEqual(r.delays,[250,500]);assert.equal(r.notices.length,0);assert.equal(r.durable.chapters[0].content,'待保存正文');assert.equal(r.c._lastKnownLibraryRevision,8);assert.equal(r.c.completedSaveRevision,1);assert.equal(r.backups.size,0);assert.equal(r.cleared.length,1);assert.equal(r.cleared[0].bookId,'book');assert.equal(r.calls[0][1],8);assert.equal(r.calls[0][2],'fixture-credentials');
});

test('持续偶发错误初次加三次重试，等待250/500/750，旧记录和应急备份保留',async()=>{
 const r=runtime(()=>{throw failure('InvalidStateError');});assert.equal(await r.api.performLibraryPersistence('失败保护'),false);assert.equal(r.calls.length,4);assert.deepEqual(r.delays,[250,500,750]);assert.equal(r.backups.size,1);assert.equal(r.cleared.length,0);assert.equal([...r.backups.values()][0].library.chapters[0].content,'待保存正文');assert.equal(r.durable.chapters[0].content,'原记录');assert.equal(r.c._lastKnownLibraryRevision,7);assert.equal(r.c.completedSaveRevision,0);assert.equal(r.notices.length,1);assert.match(r.notices[0][0],/旧记录未被覆盖，请不要刷新/);
});

test('QuotaExceededError不重试，即使错误文字带closing也不重试',async()=>{
 const r=runtime(()=>{throw failure('QuotaExceededError','database is closing');});assert.equal(await r.api.performLibraryPersistence('quota'),false);assert.equal(r.calls.length,1);assert.deepEqual(r.delays,[]);assert.equal(r.backups.size,1);assert.match(r.notices[0][0],/浏览器存储空间不足/);
});

test('仅指定偶发错误及数据库关闭文字可重试，普通错误直接失败',async()=>{
 const r=runtime();for(const name of ['AbortError','UnknownError','InvalidStateError','TransactionInactiveError'])assert.equal(r.api.isRetryableLibraryError(failure(name)),true,name);
 for(const message of ['The connection is closing.','Database is closing','close pending','数据库正在关闭'])assert.equal(r.api.isRetryableLibraryError(failure('Error',message)),true,message);
 for(const name of ['SecurityError','TypeError','DataCloneError'])assert.equal(r.api.isRetryableLibraryError(failure(name)),false,name);
 const closed=runtime(at=>{if(at===1)throw failure('Error','The DATABASE IS CLOSING');return 'indexedDB';});assert.equal(await closed.api.performLibraryPersistence(),true);assert.equal(closed.calls.length,2);assert.deepEqual(closed.delays,[250]);const permanent=runtime(()=>{throw failure('SecurityError');});assert.equal(await permanent.api.performLibraryPersistence(),false);assert.equal(permanent.calls.length,1);
});

test('并发保存排队，DB最大同时写入数为一，所有调用都得到结果',async()=>{
 const entered=deferred(),release=deferred(),r=runtime(async at=>{if(at===1){entered.resolve();await release.promise;}return 'indexedDB';});const one=r.api.persistLibraryNow('第一次');await entered.promise;const two=r.api.persistLibraryNow('第二次'),three=r.api.persistLibraryNow('第三次');assert.equal(r.calls.length,1);release.resolve();assert.deepEqual(await Promise.all([one,two,three]),[true,true,true]);assert.equal(r.peak,1);assert.ok(r.calls.length>=2);assert.equal(r.calls.at(-1)[1],r.calls.length+7);assert.equal(r.backups.size,0);assert.equal(await r.api.persistLibraryNow('队列结束后'),true);assert.equal(r.peak,1);
});

test('同类保存失败五秒内只提示一次，不同错误分别提示，失败备份不清除',async()=>{
 let kind='QuotaExceededError';const r=runtime(()=>{throw failure(kind);});await r.api.performLibraryPersistence('一');await r.api.performLibraryPersistence('二');assert.equal(r.notices.length,1);r.advance(4999);await r.api.performLibraryPersistence('三');assert.equal(r.notices.length,1);r.advance(1);await r.api.performLibraryPersistence('四');assert.equal(r.notices.length,2);kind='SecurityError';await r.api.performLibraryPersistence('另一种错误');assert.equal(r.notices.length,3);assert.equal(r.cleared.length,0);assert.equal(r.backups.size,5);assert.equal(r.durable.chapters[0].content,'原记录');
});

test('持久存储不支持、拒绝、异常、已获批均静默；每次页面运行只尝试一次',async()=>{
 const unsupported=runtime();await unsupported.api.requestPersistentStorage();await unsupported.api.requestPersistentStorage();assert.equal(unsupported.notices.length,0);assert.equal(unsupported.logs.length,0);
 for(const state of ['denied','granted','reject-persist','reject-persisted']){let reads=0,asks=0;const r=runtime(undefined,{persisted:async()=>{reads++;if(state==='reject-persisted')throw Error('unsupported');return state==='granted';},persist:async()=>{asks++;if(state==='reject-persist')throw Error('denied');return false;}});await Promise.all([r.api.requestPersistentStorage(),r.api.requestPersistentStorage()]);await r.api.requestPersistentStorage();assert.equal(reads,1,state);assert.equal(asks,state==='granted'||state==='reject-persisted'?0:1,state);assert.equal(r.notices.length,0,state);assert.equal(r.logs.length,0,state);}
});
