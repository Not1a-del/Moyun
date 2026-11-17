'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8');
test('公测、正式和本地入口按准确域名与项目路径区分，不误认相似地址',()=>{
 const start=source.indexOf('function getMoyunReleaseChannel(');
 assert.ok(start>=0,'页面缺少站点身份判断');
 const end=source.indexOf('/* 项目说明：',start),context={};vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 const channel=context.getMoyunReleaseChannel;
 assert.equal(channel('yydcm-129.github.io','/Moyun/'),'public');
 assert.equal(channel('YYDCM-129.GITHUB.IO','/Moyun/index.html'),'public');
 assert.equal(channel('not1a-del.github.io','/Moyun/'),'stable');
 for(const [host,url] of [['127.0.0.1','/index.html'],['','/F:/Moyun/index.html'],['yydcm-129.github.io.example.com','/Moyun/'],['yydcm-129.github.io','/Moyun-other/']])assert.equal(channel(host,url),'local');
});
