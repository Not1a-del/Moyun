'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8');
function context(){const start=source.indexOf('    function getChapterLengthContract('),end=source.indexOf('    function buildBudgetedChapterHistory(',start),ctx=vm.createContext({wordCountTarget:{value:4000}});assert.ok(start>=0&&end>start);vm.runInContext(source.slice(start,end),ctx);return ctx;}
test('截断线与界面共用目标字数2.5倍，最低1200字',()=>{const c=context();for(const [target,want]of [[300,1200],[600,1500],[4000,10000],[12000,30000],[30000,75000]])assert.equal(c.getChapterRunawayCeiling(target),want);assert.equal(c.getChapterRunawayCeiling(),10000);});
test('关闭超长拦截没有修改服务商token预算或基本字数合同',()=>{const c=context();assert.equal(c.getChapterLengthContract(4000).persistenceMinWords,2880);assert.equal(c.getChapterLengthContract(4000).persistenceMaxWords,5400);assert.equal(c.getChapterGenerationMaxTokens(4000),20100);});
