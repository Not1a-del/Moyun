'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8');
const cases=require('./fixtures/v0.0.19/settings-search-cases.json');
// 直接运行生产目录、评分和前十截取；不复制搜索算法来证明自己。
const context=vm.createContext({settingsSearchQuery:{value:''},computed:run=>({get value(){return run();}})});
const moduleStart=source.indexOf('    const moduleModelConfig = [');
const start=source.indexOf('    const settingsModuleSearchKeywords = {');
assert.ok(moduleStart>=0&&start>moduleStart);
vm.runInContext(source.slice(moduleStart,source.indexOf('\n    ];',moduleStart)+7)+'\n'+source.slice(start,source.indexOf('    function resetSettingsSearchResults',start)),context);
const catalog=vm.runInContext('settingsSearchCatalog',context);
function search(query){context.settingsSearchQuery.value=query;return Array.from(vm.runInContext('settingsSearchResults.value',context));}

test('全部设置均有常用叫法，关联词对应设置出现在实际前十结果中',()=>{
  assert.deepEqual(cases.map(row=>'settings-search-'+row.target).sort(),Array.from(catalog,row=>row.target).sort());
  let pairs=0;
  for(const row of cases)for(const query of row.queries){
    const results=search(query);
    assert.ok(results.some(item=>item.target==='settings-search-'+row.target),query+' → '+row.target+' 没进入前十：'+results.map(item=>item.title).join('、'));
    assert.ok(results.length<=10);pairs++;
  }
  console.log('关联词验收：'+catalog.length+' 个设置，'+pairs+' 组关键词/目标');
});
test('用户给定的补写与时间，以及补摘要，保留多个相关设置',()=>{
  for(const [query,targets]of [['补写',['second-round','third-round','route-supplement']],['时间',['timeout','auto-timeline']],['补摘要',['second-round','third-round','history-limit','route-summary']]]){
    const results=search(query).map(item=>item.target);
    for(const target of targets)assert.ok(results.includes('settings-search-'+target),query+' 缺少 '+target);
  }
});
test('原有精确标题、单字、拼音、错字、错序、多词及全半角搜索仍可用',()=>{
  for(const row of catalog)assert.equal(search(row.title)[0].target,row.target,row.title);
  for(const [query,target]of [['温','global-controls'],['wendu','global-controls'],['wednu','global-controls'],['温度 思考','global-controls'],['首字超吋','timeout'],['章摘','context-chapter-summary'],['ＡＰＩ　密钥','api-profiles'],['GEMINI输入改写','gemini-input']])assert.ok(search(query).some(item=>item.target==='settings-search-'+target),query);
  for(const query of ['','  ','！？','关于','qzxwv987654'])assert.deepEqual(search(query),[],query);
  assert.ok(catalog.every(row=>row.tab!=='changelog'));
});
test('喜欢搜索锚点在全局设置内，入口复用原有侧栏分区',()=>{
  assert.equal(source.split('id="settings-search-favorites"').length-1,1);
  const settingsStart=source.indexOf('id="settings-panel-editable"'),target=source.indexOf('id="settings-search-favorites"');
  assert.ok(target>settingsStart&&target<source.indexOf('id="settings-panel-mods"'));
  assert.match(source.slice(target,target+750),/navigateToSettingsModuleLocation\(\{tab:'presets',section:'favorites'\}\)/);
  assert.match(source,/data-settings-section="favorites"/);
});
