'use strict';
const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../source/moyun.single.html'),'utf8');
test('通用提示支持悬停、聚焦、触屏三秒、边界翻向及卸载清理',()=>{
 const events={},timers=new Map();let next=0,tip;
 const make=()=>({attrs:{},style:{},handlers:{},getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},addEventListener(k,v){this.handlers[k]=v;},removeEventListener(k){delete this.handlers[k];},contains(v){return v===this;},getBoundingClientRect(){return {left:285,top:3,right:329,bottom:47,width:44,height:44};}});
 const el=make(),document={createElement(){return {...make(),getBoundingClientRect(){return {width:280,height:50};},remove(){tip=null;}};},body:{appendChild(e){tip=e;}},addEventListener(k,f){events[k]=f;},removeEventListener(k){delete events[k];}};
 const context=vm.createContext({document,window:{innerWidth:320,innerHeight:740,addEventListener(){},removeEventListener(){}},setTimeout(f,ms){const id=++next;timers.set(id,{f,ms});return id;},clearTimeout(id){timers.delete(id);}});
 vm.runInContext(source.slice(source.indexOf('const MoyunTip ='),source.indexOf('createApp({'))+';globalThis.directive=MoyunTip;',context);
 const d=context.directive;d.mounted(el,{value:'会额外请求 AI'});
 el.handlers.pointerenter({pointerType:'mouse'});assert.equal(tip.textContent,'会额外请求 AI');assert.equal(tip.style.left,'32px');assert.equal(tip.style.top,'55px');
 el.handlers.pointerleave();assert.equal(tip,null);el.handlers.focus();assert.ok(tip);el.handlers.blur();assert.equal(tip,null);
 el.handlers.pointerdown({pointerType:'touch'});assert.equal([...timers.values()][0].ms,3000);[...timers.values()][0].f();assert.equal(tip,null);
 el.handlers.pointerdown({pointerType:'touch'});events.pointerdown({target:{}});assert.equal(tip,null);
 d.updated(el,{value:'新提示'});el.handlers.pointerenter({pointerType:'mouse'});assert.equal(tip.textContent,'新提示');d.unmounted(el);assert.equal(tip,null);assert.deepEqual(el.handlers,{});assert.equal(el.getAttribute('aria-describedby'),null);
});
test('配置浮动标签保留密码隐藏、输入事件和既有测试锚点',()=>{
 for(const key of ['connectionProfileDraft.name','connectionProfileDraft.baseUrl','connectionProfileDraft.apiKey','connectionProfileDraft.defaultModel','imageGenKey','memoryLibrary.settings.classicModel'])assert.ok(source.includes(key));
 assert.match(source,/<label class="moyun-floating-field"><input[^>]*type="password"[^>]*data-settings-api-key/);
 assert.match(source,/\.moyun-floating-field>\.input-field:focus\+span/);assert.match(source,/not\(:placeholder-shown\)/);
});
