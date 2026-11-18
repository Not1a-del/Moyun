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
function navigationHarness(settings={}) {
 let now=1000,id=0;const timers=new Map(),node={scrollTop:0,scrollHeight:8000,clientHeight:600,scrollTo(o){this.scrollTop=o.top;}};
 const c=vm.createContext({ref:value=>({value}),settings:{value:settings},mainScroll:{value:node},performance:{now:()=>now},setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),window:{matchMedia:()=>({matches:false})}});
 const start=source.indexOf('    const readerScrollNavVisible = ref(false);'),end=source.indexOf('    // 阅读快捷导航结束',start);assert.ok(start>=0&&end>start,'应有阅读快捷导航');
 vm.runInContext(source.slice(start,end)+';globalThis.visible=readerScrollNavVisible;',c);
 c.normalizeReaderScrollSettings();return{c,node,timers,scroll:(ms=100,input=true)=>{now+=ms;if(input)c.markReaderScrollInput();node.scrollTop+=100;c.handleReaderScroll();}};
}
test('新旧设置默认关闭，任意滚动和按钮调用都不能显示导航',()=>{
 const {c,node,timers,scroll}=navigationHarness();for(let i=0;i<20;i++)scroll();assert.equal(c.visible.value,false);assert.equal(timers.size,0);c.scrollReaderToEdge('top');assert.notEqual(node.scrollTop,0);assert.equal(c.settings.value.readerScrollShowSeconds,0.5);assert.equal(c.settings.value.readerScrollHideSeconds,3);
 assert.match(source,/readerScrollNavEnabled: false/);assert.match(source,/v-if="settings.readerScrollNavEnabled && readerScrollNavVisible/);
});
test('达到连续滚动时间才显示，按自定义时长隐藏且保留两端跳转',()=>{
 const {c,node,timers,scroll}=navigationHarness({readerScrollNavEnabled:true,readerScrollShowSeconds:0.5,readerScrollHideSeconds:2});
 for(let i=0;i<5;i++)scroll();assert.equal(c.visible.value,false);scroll();assert.equal(c.visible.value,true);assert.equal([...timers.values()].at(-1).ms,2000);
 const timerBefore=[...timers.keys()][0];scroll(1200,false);assert.equal([...timers.keys()][0],timerBefore,'生成自动跟随不能推迟消失');
 c.scrollReaderToEdge('bottom');assert.equal(node.scrollTop,8000);c.scrollReaderToEdge('top');assert.equal(node.scrollTop,0);[...timers.values()].at(-1).fn();assert.equal(c.visible.value,false);scroll(4000,false);assert.equal(c.visible.value,false);
});
test('短暂滚动后停顿不累计，零秒设置支持立即显示，关闭清理定时器',()=>{
 const {c,timers,scroll}=navigationHarness({readerScrollNavEnabled:true});for(let i=0;i<4;i++)scroll();scroll(1000);assert.equal(c.visible.value,false);for(let i=0;i<4;i++)scroll();assert.equal(c.visible.value,false);scroll();assert.equal(c.visible.value,true);
 c.settings.value.readerScrollNavEnabled=false;scroll();assert.equal(c.visible.value,false);assert.equal(timers.size,0);
 c.settings.value.readerScrollNavEnabled=true;c.settings.value.readerScrollShowSeconds=0;scroll();assert.equal(c.visible.value,true);
});
test('时间输入空值和非法值回默认，范围有限制且零秒显示不丢失',()=>{
 for(const value of ['',null,undefined,NaN,Infinity,'无效']){const {c}=navigationHarness({readerScrollShowSeconds:value,readerScrollHideSeconds:value});assert.equal(c.settings.value.readerScrollShowSeconds,0.5);assert.equal(c.settings.value.readerScrollHideSeconds,3);}
 const {c}=navigationHarness({readerScrollShowSeconds:-1,readerScrollHideSeconds:100});assert.equal(c.settings.value.readerScrollShowSeconds,0);assert.equal(c.settings.value.readerScrollHideSeconds,60);
});
