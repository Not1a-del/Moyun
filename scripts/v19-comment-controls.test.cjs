'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8');
const start=src.indexOf('    function getRequestedCommentCount()'),end=src.indexOf('    function likeComment(',start);
function setup(config={}) {
 const calls={api:0,config:0,confirm:0,toasts:[]},ch={id:'ch',content:'正文',comments:[{content:'保留旧评论'}]};
 const ctx=vm.createContext({settings:{value:{commentCount:8,enableReviewer:true,...config}},chapters:{value:[ch]},visibleChapters:{value:[ch]},showToast:message=>calls.toasts.push(message),requireModuleRequest:()=>{calls.config++;return null;},cleanNarrativeChapterContent:c=>c.content,openConfirm:()=>calls.confirm++});
 vm.runInContext(src.slice(start,end),ctx);return{ctx,calls,ch};
}
test('评论默认跟随；总开关、跟随开关、数量分别守住自动请求',()=>{
 for(const enabled of [false,true])for(const auto of [false,true,undefined])for(const count of [0,3,8]) {
  const {ctx}=setup({enableReviewer:enabled,commentAutoGenerate:auto,commentCount:count});assert.equal(ctx.shouldAutoGenerateChapterComments(),enabled&&auto!==false&&count>0);
 }
});
test('0与字符串0不会退回8；小数、负数、非法数采用统一范围',()=>{
 for(const [input,want] of [[0,0],['0',0],[2.9,2],[-5,0],[100,20],['bad',8],['',8],[undefined,8]])assert.equal(setup({commentCount:input}).ctx.getRequestedCommentCount(),want);
});
test('数量0，直接与重生成反复点击均不查API、不确认、不改旧评论',()=>{
 const {ctx,calls,ch}=setup({commentCount:0});for(let i=0;i<5;i++){ctx.generateChapterComments(0);ctx.regenerateComments(0);}assert.equal(calls.config,0);assert.equal(calls.confirm,0);assert.equal(ch.comments[0].content,'保留旧评论');assert.equal(calls.toasts.length,10);
});
test('自动关闭时仍能手动生成；总开关关闭则阻止手动入口',()=>{
 const manual=setup({commentAutoGenerate:false});manual.ctx.generateChapterComments(0);assert.equal(manual.calls.config,1);
 const off=setup({enableReviewer:false});off.ctx.generateChapterComments(0);assert.equal(off.calls.config,0);
});
