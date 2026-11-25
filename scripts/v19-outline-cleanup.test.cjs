'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {EventEmitter}=require('node:events');
const {cleanupBrowserRun}=require('./v19-outline-review-browser.cjs');

function makeEdge(){const edge=new EventEmitter();edge.pid=1234;edge.exitCode=null;edge.signalCode=null;edge.kill=()=>{edge.exitCode=0;edge.emit('exit',0,null);};return edge;}
function makeProfile(){const profile=fs.mkdtempSync(path.join(os.tmpdir(),'moyun-cleanup-test-'));fs.writeFileSync(path.join(profile,'lock'),'test');return profile;}
function makeServer(){return{listening:true,close(callback){this.listening=false;callback();},closeIdleConnections(){}};}

test('waits for Edge to exit before removing its profile',async()=>{
  const profile=makeProfile(),edge=makeEdge();let removedAfterExit=false,treeKill=false;
  const client={send:async()=>{setTimeout(()=>{edge.exitCode=0;edge.emit('exit',0,null);},10);},ws:{close(){}}};
  const error=await cleanupBrowserRun({client,edge,server:makeServer(),profile,platform:'win32',killTree:async()=>{treeKill=true;},removeProfile:target=>{removedAfterExit=edge.exitCode===0;fs.rmSync(target,{recursive:true,force:true});},graceMs:100,logger:{warn(){},error(){}}});
  assert.equal(error,null);assert.equal(removedAfterExit,true);assert.equal(treeKill,false);assert.equal(fs.existsSync(profile),false);
});

test('kills a lingering Windows process tree before profile cleanup',async()=>{
  const profile=makeProfile(),edge=makeEdge();let treeKill=false,removedAfterExit=false;
  const client={send:async()=>{},ws:{close(){}}};
  const error=await cleanupBrowserRun({client,edge,server:makeServer(),profile,platform:'win32',graceMs:1,exitMs:100,killTree:async pid=>{treeKill=pid===edge.pid;setTimeout(()=>{edge.exitCode=0;edge.emit('exit',0,null);},10);},removeProfile:target=>{removedAfterExit=edge.exitCode===0;fs.rmSync(target,{recursive:true,force:true});},logger:{warn(){},error(){}}});
  assert.equal(error,null);assert.equal(treeKill,true);assert.equal(removedAfterExit,true);assert.equal(fs.existsSync(profile),false);
});

test('retries removal and reports a profile that still cannot be deleted',async()=>{
  const profile=makeProfile(),messages=[];let attempts=0;
  const error=await cleanupBrowserRun({profile,removeProfile:()=>{attempts++;throw Error('sharing violation');},retryDelays:[0,0],sleep:async()=>{},logger:{warn(){},error(message){messages.push(message);}}});
  assert.match(error.message,/sharing violation/);assert.equal(attempts,3);assert.match(messages[0],/Failed to remove temporary Edge profile/);
  fs.rmSync(profile,{recursive:true,force:true});
});

test('cleans a profile when browser startup fails before Edge is spawned',async()=>{
  const profile=makeProfile();
  const error=await cleanupBrowserRun({profile,server:makeServer()});
  assert.equal(error,null);assert.equal(fs.existsSync(profile),false);
});

