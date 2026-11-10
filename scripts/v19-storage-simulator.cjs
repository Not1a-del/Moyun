'use strict';
// Apply only to an isolated test browser. restore() reinstates original descriptors.
function installStorageSimulator(options={},target=globalThis) {
  const restores = [];
  function replace(object,key,value) {
    if(!object)return;
    const descriptor = Object.getOwnPropertyDescriptor(object,key);
    Object.defineProperty(object,key,{configurable:true,writable:true,value});
    restores.push(()=>{if(descriptor)Object.defineProperty(object,key,descriptor);else delete object[key];});
  }
  const navigator = target.navigator || {};
  if(!target.navigator)replace(target,'navigator',navigator);
  const storage = navigator.storage || {};
  if(!navigator.storage)replace(navigator,'storage',storage);
  replace(storage,'estimate',async()=>({usage:options.usage ?? 95*1024*1024,quota:options.quota ?? 100*1024*1024}));
  const makeError = (message,name)=>new (target.DOMException || DOMException)(message,name);
  if(options.quotaExceeded) {
    const failWrite = ()=>{throw makeError('模拟存储空间不足','QuotaExceededError');};
    replace(target.IDBObjectStore?.prototype,'put',failWrite);
    replace(target.IDBObjectStore?.prototype,'add',failWrite);
    replace(target.Storage?.prototype,'setItem',failWrite);
  }
  if(options.indexedDBUnavailable) {
    const unavailable = ()=>{throw makeError('模拟 IndexedDB 不可用','SecurityError');};
    replace(target.indexedDB,'open',unavailable);
    replace(target.IDBDatabase?.prototype,'transaction',unavailable);
    if(!target.indexedDB)replace(target,'indexedDB',{open:unavailable});
  }
  return {restore(){while(restores.length)restores.pop()();}};
}
function browserStorageScript(options={}) {
  return 'globalThis.__v19StorageSimulator=('+installStorageSimulator.toString()+')('+JSON.stringify(options)+',globalThis);';
}
module.exports = {installStorageSimulator,browserStorageScript};

