'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function switchHarness(){
 const ref=value=>({value}),c={currentBookId:ref('book'),isGenerating:ref(false),isGeneratingOutline:ref(false),isGeneratingDO:ref(false),outlineAiEditingIdx:ref(-1),isGeneratingCharacterDraft:ref(false),isReviewing:ref(false),_isPreparingGenerationRecall:false,_activeGenerationRun:null,_bookScopedAiRuns:new Map(),activeBranchId:ref('main'),branchList:ref([{id:'main'},{id:'b'}]),showBranchPanel:ref(true),visibleChapters:ref([]),chapters:ref([]),currentChapterIndex:ref(0),persistCurrentBranchData(){},closeContinuityCheck(){},cancelMemoryWork(){},cancelSuggestionRun(){},loadBranchScopedData(){},saveData(){},showToast(message){c.message=message;},openConfirm(cfg,cb){c.confirm=cb;}};
 vm.createContext(c);
 if(source.includes('    function canChangeBranch('))vm.runInContext(section('    function canChangeBranch(','    function switchBranch('),c);
 vm.runInContext(section('    function switchBranch(','    // 中文注释：侧栏示例'),c);return c;
}
test('所有前台 AI 任务期间切换分支必须被拦住，面板保留',()=>{
 for(const kind of ['isGenerating','isGeneratingOutline','isGeneratingDO','isGeneratingCharacterDraft','isReviewing','bookTask','preparing']){
  const c=switchHarness();if(kind==='bookTask')c._bookScopedAiRuns.set('test',{});else if(kind==='preparing')c._isPreparingGenerationRecall=true;else c[kind].value=true;
  c.switchBranch('b');assert.equal(c.activeBranchId.value,'main',kind);assert.equal(c.showBranchPanel.value,true,kind);assert.match(c.message,/停止/);
 }
});
test('编辑确认等待期间启动 AI 后不能继续切换；不存在的分支不能写入',()=>{
 const c=switchHarness();c.visibleChapters.value=[{isEditing:true}];c.switchBranch('b');assert.ok(c.confirm);c.isGenerating.value=true;c.confirm();assert.equal(c.activeBranchId.value,'main');
 const d=switchHarness();d.switchBranch('missing');assert.equal(d.activeBranchId.value,'main');
});
test('桌面默认显示图形，手机默认列表',()=>{
 for(const width of [320,767,768,1280]){const c={window:{innerWidth:width,innerHeight:800},branchPanelContext:{},selectedBranchPanelId:{},activeBranchId:{value:'main'},branchPanelView:{},branchPanelStyle:{},showBranchPanel:{value:false}};vm.createContext(c);vm.runInContext(section('    function toggleBranchPanel(','    function enterSelectedBranch('),c);c.toggleBranchPanel();assert.equal(c.branchPanelView.value,width<768?'list':'map');}
});
function forkHarness(){
 const c=switchHarness();Object.assign(c,{currentBookId:{value:'book'},showDetailedOutlineInMain:{value:false},branchData:{value:{}},nextChapterPrompt:{},uid:()=> 'new',confirmStorageHeadroom:async()=>true,createBranchPlanningData:()=>({}),cloneModMemorySummaryScopesForBranch:()=>0,toggleBranchPanel(){c.showBranchPanel.value=true;}});c.visibleChapters.value=[{id:'c1'},{id:'c2'}];
 vm.runInContext(section('    let branchForkPending =','    function deleteBranch('),c);return c;
}
test('快速重复点击新建分支只创建一次；容量确认期间切书不能写错书',async()=>{
 const c=forkHarness();await Promise.all([c.forkBranch(1),c.forkBranch(1)]);assert.equal(c.branchList.value.length,3);assert.equal(c.activeBranchId.value,'new');assert.equal(c.showBranchPanel.value,true);
 const d=forkHarness();let resolve;d.confirmStorageHeadroom=()=>new Promise(r=>resolve=r);const run=d.forkBranch(1);d.currentBookId.value='other';resolve(true);await run;assert.equal(d.branchList.value.length,2);assert.equal(d.activeBranchId.value,'main');
});
test('容量确认期间章节重排仍从原来的章节分叉',async()=>{
 const c=forkHarness();let resolve;c.confirmStorageHeadroom=()=>new Promise(r=>resolve=r);const run=c.forkBranch(1);c.visibleChapters.value.reverse();resolve(true);await run;const branch=c.branchList.value.find(row=>row.id==='new');assert.equal(branch.forkFromChapterId,'c2');assert.equal(branch.forkIndex,0);
});
test('生成中删除分支必须被拦截；切书后旧的切换确认不能作用到新书',()=>{
 const c=switchHarness();Object.assign(c,{readBranchPlanningRows:()=>[],branchData:{value:{}},TextEncoder});vm.runInContext(section('    function deleteBranch(','    function renameBranch('),c);c.isGenerating.value=true;c.deleteBranch('b');assert.equal(c.confirm,undefined);assert.match(c.message,/停止/);
 const d=switchHarness();d.visibleChapters.value=[{isEditing:true}];d.switchBranch('b');d.currentBookId.value='other';d.confirm();assert.equal(d.activeBranchId.value,'main');
});
test('拖动分支图不会误选节点，丢失松开事件后能恢复；当前整条路线高亮',()=>{
 const c=vm.createContext({setTimeout:fn=>fn()});vm.runInContext(section('const BranchPanel =','/* ──── Vue 应用 ──── */')+';globalThis.panel=BranchPanel;',c);const panel=c.panel,emitted=[],state={...panel.data(),...panel.methods,$emit:(...args)=>emitted.push(args)};let captures=0;const frame={scrollLeft:100,scrollTop:0,setPointerCapture(){captures++;}};
 state.startDrag({pointerType:'mouse',button:0,clientX:100,clientY:10,currentTarget:frame});state.dragMap({buttons:1,clientX:50,clientY:10,pointerId:1,currentTarget:frame});state.select('b');assert.equal(frame.scrollLeft,150);assert.equal(captures,1);assert.equal(emitted.length,0);state.dragMap({buttons:0});state.select('b');assert.equal(state.drag,null);assert.equal(emitted.length,1);
 const route={edges:[{from:'main',to:'a'},{from:'a',to:'b'},{from:'main',to:'other'}]};assert.deepEqual([...panel.computed.activePath.call({activeId:'b',route})],['b','a','main']);
});
