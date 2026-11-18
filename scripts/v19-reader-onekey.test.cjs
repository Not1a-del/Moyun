'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8').replace(/\r\n/g,'\n');
function fn(name){const start=source.search(new RegExp('    (?:async )?function '+name+'\\('));assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n    }',start)+6);}
function cfg(extra={}){return {genTitle:false,genSynopsis:true,genWorldView:false,genNegative:false,genCover:false,genOutline:false,genDetailed:false,charCount:0,genPipeline:false,genStyles:false,genPresets:false,...extra};}
test('取消书名简介和大纲后，只校验勾选的世界观',()=>{
 const check=source.match(/            if \([^\n]+\) \{\n              throw new Error\('设定或大纲结果不完整'\);\n            }/)[0];
 assert.doesNotThrow(()=>vm.runInNewContext(check,{c:cfg({genWorldView:true}),R:{worldView:'完整世界观'}}));
 assert.throws(()=>vm.runInNewContext(check,{c:cfg({genWorldView:true}),R:{}}),/不完整/);
 assert.throws(()=>vm.runInNewContext(check,{c:cfg({genTitle:true}),R:{title:'有书名但无简介'}}),/不完整/);
});
test('只选角色不产生隐藏的设定请求和费用',()=>{
 const c=vm.createContext({okCfg:cfg({charCount:1}),computed:f=>f(),oneKeyAutoRetry:{value:false}});
 const start=source.indexOf('    const okEstimate = computed('),end=source.indexOf('\n    });',start)+8;
 vm.runInContext(source.slice(start,end)+';globalThis.estimate=okEstimate;'+fn('getOneKeyRequiredModelKeys'),c);
 assert.equal(c.estimate.textReqs,1);assert.deepEqual(Array.from(c.getOneKeyRequiredModelKeys()),['character']);
});
test('快速滚动才显示导航，停止后三秒隐藏，点击能到两端',()=>{
 let now=1000,id=0;const timers=new Map(),node={scrollTop:0,scrollHeight:8000,clientHeight:600,scrollTo(o){this.scrollTop=o.top;}};
 const c=vm.createContext({ref:value=>({value}),mainScroll:{value:node},performance:{now:()=>now},setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),window:{matchMedia:()=>({matches:false})}});
 const start=source.indexOf('    const readerScrollNavVisible = ref(false);'),end=source.indexOf('    // 阅读快捷导航结束',start);assert.ok(start>=0&&end>start,'应有阅读快捷导航');
 vm.runInContext(source.slice(start,end)+';globalThis.visible=readerScrollNavVisible;',c);
 c.markReaderScrollInput();now+=100;node.scrollTop=10;c.handleReaderScroll();assert.equal(c.visible.value,false);
 c.markReaderScrollInput();now+=50;node.scrollTop=100;c.handleReaderScroll();assert.equal(c.visible.value,true);
 const timerBefore=[...timers.keys()][0];now+=1200;node.scrollTop=200;c.handleReaderScroll();assert.equal([...timers.keys()][0],timerBefore,'生成自动跟随不能推迟消失');
 assert.equal([...timers.values()].at(-1).ms,3000);c.scrollReaderToEdge('bottom');assert.equal(node.scrollTop,8000);
 c.scrollReaderToEdge('top');assert.equal(node.scrollTop,0);[...timers.values()].at(-1).fn();assert.equal(c.visible.value,false);
 node.scrollTop=600;now+=4000;c.handleReaderScroll();assert.equal(c.visible.value,false,'自动滚动不能弹出导航');
 c.resetReaderScrollNav();assert.equal(timers.size,0);
 node.scrollTop=1120;now+=1000;c.markReaderScrollInput();c.handleReaderScroll();assert.equal(c.visible.value,true,'合成线程先移动、后派发wheel时仍按上次位置识别速度');
});
