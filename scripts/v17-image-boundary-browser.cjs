'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{connect}=require('./v16-r2-browser-session.cjs'),{installMock}=require('./v17-image-suggestion-browser.cjs');
const results=[];let c;
async function test(name,fn){const data=await fn();results.push({name,ok:true,data});console.log('PASS',name,JSON.stringify(data??''));}
async function until(fn){for(let i=0;i<100;i++){if(await c.ev(fn))return;await c.delay(100);}throw Error('等待超时');}
async function runBrowserTests(client){results.length=0;let failed=false;try{
 c=client || await connect(Number(process.argv[2]||9236),process.argv[3]||'http://127.0.0.1:4176/index.html');await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+installMock.toString()+')()'});await c.navigate();
 await c.ev(()=>{const s=__s,id='v17-boundaries-'+Date.now();s.books.push({id,novel:{title:'图片边界'},chapters:[],characters:[]});s.loadBook(id);s.modPacks=[];s.showCharacterWorkbench=false;s.showSettings_modal=false;s.showStoryBibleWorkbench=false;s.showOutlineInMain=false;s.showDetailedOutlineInMain=false;s.showImportExport=false;s.showPromptPreview=false;s.bookshelfView='book';s.imageGenEnabled=true;s.imageGenKey='STA1N-test-only';s.naiCallMode='rphub';s.chapters=[{id:'same-tags',content:'[IMG: lighthouse, [[soft light]], sea]\n\n间隔。\n\n[IMG: lighthouse, [[soft light]], sea]',title:'同词两图',isExpanded:true,branchId:'main'}];s.saveData();});
 await test('相同提示词两个位置独立排队，嵌套权重完整发送',async()=>{await until(()=>document.querySelectorAll('.inline-image img[src]').length===2&&!document.querySelector('.inline-image[aria-busy="true"]'));const d=await c.ev(()=>({keys:[...document.querySelectorAll('.inline-image')].map(x=>x.dataset.cacheKey),posts:__imageTest.requests.filter(x=>x.method==='POST').map(x=>x.body.tag)}));assert.notEqual(d.keys[0],d.keys[1]);assert.deepEqual(d.posts,['lighthouse, [[soft light]], sea','lighthouse, [[soft light]], sea']);return{positions:d.keys.length};});
 await test('图片落库失败明确报错，旧图仍在数据库且新图可下载',async()=>{const d=await c.ev(async()=>{window.__realImageSet=ImageStore.set;ImageStore.set=function(key,value,options){if(options?.strict)return Promise.reject(new Error('图片保存失败，请释放存储空间后重试'));return __realImageSet.call(this,key,value,options);};const wrap=document.querySelector('.inline-image');const result=await __s.regenerateInlineImage(wrap.dataset.cacheKey,'new unsaved tags');ImageStore.set=__realImageSet;return{result,message:__s.toast.message,statusHidden:wrap.querySelector('[data-inline-status]').hidden,persisted:(await ImageStore.get(wrap.dataset.cacheKey)).versions.length,downloadEnabled:!wrap.querySelector('[data-img-action="save"]').disabled};});assert.equal(d.result,false);assert.match(d.message,/保存失败/);assert.equal(d.statusHidden,true);assert.equal(d.persisted,1);assert.equal(d.downloadEnabled,true);return d;});
 await test('运行中切画风不重提交、不更换本次请求参数',async()=>{await c.ev(()=>{__s.imageProfiles=[{id:'boundary-original',name:'原画风',artist:'boundary original artist',model:'nai-diffusion-4-5-full'}];__s.activeProfileId='boundary-original';__imageTest.hold='running';window.__boundaryRun=__s.regenerateInlineImage(document.querySelector('.inline-image').dataset.cacheKey,'profile snapshot');});await until(()=>document.querySelector('[data-inline-status]').textContent.includes('42%'));const before=await c.ev(()=>__imageTest.requests.filter(x=>x.method==='POST').length);await c.ev(()=>{__s.addImageProfile();__s.imageProfiles.at(-1).artist='changed while running';__imageTest.hold='';});await c.ev(async()=>await __boundaryRun);assert.equal(await c.ev(()=>__imageTest.requests.filter(x=>x.method==='POST').length),before);assert.notEqual(await c.ev(()=>__imageTest.requests.filter(x=>x.method==='POST').at(-1).body.artist),'changed while running');});
 await test('Canary 直连兼容：展示无百分比说明，只下载一次并保存',async()=>{await c.ev(()=>{__s.naiCallMode='canary';const previous=fetch;window.fetch=async(input,init)=>{if(new URL(String(input),location.href).pathname==='/generate')await new Promise(r=>setTimeout(r,600));return previous(input,init);};window.__boundaryRun=__s.regenerateInlineImage(document.querySelector('.inline-image').dataset.cacheKey,'canary tags');});await until(()=>document.querySelector('[data-inline-status]').textContent.includes('当前线路不提供'));assert.equal(await c.ev(async()=>await __boundaryRun),true);assert.equal(await c.ev(()=>__imageTest.requests.filter(x=>x.path==='/generate').length),1);});
 await test('缓存读取失败不当作空缓存收费生图，恢复后可手动重试',async()=>{
   const before=await c.ev(()=>__imageTest.requests.length);
   await c.ev(()=>{window.__readErrors=[];window.__stopReadErrors=Vue.watch(()=>__s.toast,t=>{if(t.show&&t.type==='error')__readErrors.push(t.message);},{flush:'sync'});window.__realImageGet=ImageStore.get;ImageStore.get=function(key,options){if(options?.strict)return Promise.reject(new Error('图片缓存读取失败，已停止自动生图；请检查浏览器存储'));return __realImageGet.call(this,key,options);};__s.naiCallMode='rphub';__s.chapters=[{id:'read-failure-'+Date.now(),title:'读取异常',content:'[IMG: lighthouse, dusk]',isExpanded:true,branchId:'main'}];});
   try{await until(()=>__s.toast.show&&__s.toast.message.includes('图片缓存读取失败'));assert.equal(await c.ev(()=>document.querySelector('[data-inline-status]').hidden),true);await c.ev(async()=>{__s.dismissToast();await __s.loadCachedImages();await __s.loadCachedImages();});assert.equal(await c.ev(()=>__s.toast.show),false);assert.equal(await c.ev(()=>__readErrors.length),1);assert.equal(await c.ev(()=>__imageTest.requests.length),before);}
   finally{await c.ev(()=>{ImageStore.get=__realImageGet;__stopReadErrors();});}
   assert.equal(await c.ev(async()=>{const el=document.querySelector('.inline-image');return await __s.regenerateInlineImage(el.dataset.cacheKey,el.dataset.tag);}),true);
   assert.match(await c.ev(()=>document.querySelector('[data-inline-status]').textContent),/已保存/);
 });
 await test('长书屏幕外插图延迟生图，滚动到附近才提交',async()=>{
   const before=await c.ev(()=>__imageTest.requests.filter(x=>x.method==='POST').length);
   await c.ev(()=>{const paragraphs=Array.from({length:40},(_,i)=>'第'+i+'段。'+'正文。'.repeat(90)).join('\n\n');__s.chapters=[{id:'offscreen-'+Date.now(),title:'延迟生成',content:paragraphs+'\n\n[IMG: distant mountain]',isExpanded:true,branchId:'main'}];document.querySelector('[data-moyun-region="main"]').scrollTop=0;});
   await until(()=>!!document.querySelector('.inline-image'));
   await c.delay(700);
   assert.equal(await c.ev(()=>__imageTest.requests.filter(x=>x.method==='POST').length),before);
   await c.ev(()=>document.querySelector('.inline-image').scrollIntoView({block:'center'}));
   await until(()=>document.querySelector('.inline-image img')?.src.startsWith('data:image/'));
   assert.equal(await c.ev(()=>__imageTest.requests.filter(x=>x.method==='POST').length),before+1);
 });
 for(const target of ['new','current'])await test('自动插图开启时延迟导入图片不重复提交（'+target+'）',async()=>{
   const before=await c.ev(()=>__imageTest.requests.filter(x=>x.method==='POST').length);
   await c.ev(async target=>{
     const key=document.querySelector('.inline-image').dataset.cacheKey,record=await ImageStore.get(key);
     const backup={_type:'moyun_full_book_backup',novel:{title:'延迟导入验收'},chapters:JSON.parse(JSON.stringify(__s.chapters)),_imageCache:{[key]:record}};
     const id='empty-import-'+Date.now();__s.books.push({id,novel:{title:'导入前'},chapters:[],characters:[]});__s.loadBook(id);__s.imageGenEnabled=true;__s.imageGenKey='STA1N-test-only';
     await __s.handleImportJson({target:{value:'',files:[new File([JSON.stringify(backup)],'图片恢复.json')]}});__s.transferState.target=target;__s.transferState.strategy='append';
     window.__importWriteStarted=false;window.__originalImportSet=ImageStore.set;
     const gate=new Promise(resolve=>window.__releaseImportWrite=resolve);
     ImageStore.set=async function(key,value,options){window.__importWriteStarted=true;await gate;return __originalImportSet.call(this,key,value,options);};
     window.__pendingImport=__s.executeTransfer();
   },target);
   try{
     await until(()=>__importWriteStarted);
     await c.ev(()=>{if(__s.chapters[0])__s.chapters[0].isExpanded=true;});await c.delay(600);
     assert.equal(await c.ev(()=>__imageTest.requests.filter(x=>x.method==='POST').length),before);
   }finally{await c.ev(async()=>{__releaseImportWrite();await __pendingImport;ImageStore.set=__originalImportSet;});}
   assert.equal(await c.ev(()=>__s.transferError),'');
   await c.ev(()=>{__s.chapters[0].isExpanded=true;});await until(()=>!!document.querySelector('.inline-image img[src]'));
   await c.ev(()=>document.querySelector('.inline-image').scrollIntoView({block:'center'}));await c.delay(500);
   assert.equal(await c.ev(()=>__imageTest.requests.filter(x=>x.method==='POST').length),before);
   assert.equal(await c.ev(()=>__s.chapters.length),1);
 });
 await test('图片导入中途写入失败时撤回已覆盖图片，保留原书和原历史',async()=>{
   const d=await c.ev(async()=>{
     const key=document.querySelector('.inline-image').dataset.cacheKey,original=await ImageStore.get(key),oldId=__s.currentBookId,title=__s.novel.title;
     const changed=JSON.parse(JSON.stringify(original));changed.versions[0].tag='不应保留的导入词';
     const backup={_type:'moyun_full_book_backup',novel:{title:'失败导入'},chapters:JSON.parse(JSON.stringify(__s.chapters)),_imageCache:{[key]:changed,[key+'-second']:changed}};
     await __s.handleImportJson({target:{value:'',files:[new File([JSON.stringify(backup)],'损坏恢复.json')]}});__s.transferState.target='current';__s.transferState.strategy='replace';
     const set=ImageStore.set;let calls=0;ImageStore.set=function(...args){if(++calls===2)return Promise.reject(new Error('模拟图片写入失败'));return set.apply(this,args);};
     try{await __s.executeTransfer();}finally{ImageStore.set=set;}
     const result={error:__s.transferError,sameBook:oldId===__s.currentBookId,sameTitle:title===__s.novel.title,sameImage:JSON.stringify(original)===JSON.stringify(await ImageStore.get(key))};__s.closeTransfer();return result;
   });
   assert.match(d.error,/图片写入失败/);assert.equal(d.sameBook,true);assert.equal(d.sameTitle,true);assert.equal(d.sameImage,true);return d;
 });
 assert.equal(c.errors.length,0,c.errors.join('\n'));
}catch(error){results.push({name:'运行中断',ok:false,error:String(error)});console.error(error);failed=true;if(!client)process.exitCode=1;}
finally{fs.writeFileSync(path.join(__dirname,'../.ui-check/v17-image-boundary-results.json'),JSON.stringify({passed:!failed,results,errors:c?.errors},null,2));c?.ws.close();console.log('V17 image boundary',results.filter(x=>x.ok).length,'passed');}}
if(require.main === module) runBrowserTests();
module.exports={runBrowserTests};
