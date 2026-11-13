'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8'),clone=value=>JSON.parse(JSON.stringify(value));
function section(start,end){const at=source.indexOf(start),to=source.indexOf(end,at);assert.ok(at>=0&&to>at,start);return source.slice(at,to);}
function runtime(reply){
 const ref=value=>({value}),requests=[],saves=[],toasts=[];let nextId=0;
 const local={id:'local',chapterId:'lc',chapterTitle:'本书章节',branchId:'main',paragraphIndex:null,snapshot:'阿青和阿白留在本书。',wordCount:10,sourceCharacterNames:['阿青','阿白']};
 const foreign={id:'foreign',chapterId:'fc',chapterTitle:'别书章节',branchId:'main',paragraphIndex:0,snapshot:'阿青走过石桥，阿白在桥头等候。',wordCount:16,sourceCharacterNames:['阿青','阿白']};
 const current={id:'a',title:'本书',novel:{title:'本书',favoriteClips:[local]}},other={id:'b',title:'别书',novel:{favoriteClips:[foreign]}};
 const c={ref,computed:fn=>({get value(){return fn();}}),Date,Map,Set,novel:ref(current.novel),currentBookId:ref('a'),activeBranchId:ref('main'),books:ref([current,other]),chapters:ref([{id:'lc',branchId:'main',content:local.snapshot}]),structuredCharacters:ref([{name:'阿青'},{name:'阿白'}]),
  writingStyles:ref([{id:'library',name:'库文风',prompt:'文风库唯一哨兵'}]),currentWritingStyleId:ref('library'),activeStyleIds:ref(['library']),deepClone:clone,uid:()=> 'new-style-'+(++nextId),
  isSnowwingPresetLocked:()=>c.locked===true,saveData:()=>saves.push('save'),saveDataNow:async reason=>{saves.push(reason);return true;},showToast:(...args)=>toasts.push(args),
  requireModuleRequest:key=>({ok:true,model:key+'-mock',adapterId:'gemini-generate'}),fetchAdapterCompletion:async(req,msg,options)=>{requests.push({req,msg,options});return {text:reply?await reply(requests.length,c):validStyle()};},getAdapterCompletionText:result=>result.text,parseAiStructuredJson:text=>JSON.parse(text),
  cleanNarrativeChapterContent:ch=>ch.content,getChapterParagraphs:ch=>ch.content.split(/\n\n/).map(text=>({text})),getDisplayChapterTitle:ch=>ch.title,getCleanWordCount:text=>text.length,openConfirm(){},nextTick:async()=>{},showSettings_modal:ref(false),mobileSidebarOpen:ref(false)};
 vm.createContext(c);vm.runInContext(section('    const FAVORITE_DISTILL_RULES =','    const currentWritingStyleId =')+'\n'+section('    function getCurrentStylePrompt()','    function getStyleById(')+'\n'+section('    function getMergedStylePrompt()','    /* ═══ 生命周期 ═══ */')+'\n;globalThis.api={rules:FAVORITE_DISTILL_RULES,get state(){return styleSource.value;},get busy(){return isDistillingStyle.value;},get rows(){return styleMaterialRows.value;},get chars(){return selectedStyleChars.value;},set scope(value){favoriteScope.value=value;},openStyleSource,setStyleSourceMode,toggleStyleMaterial,isStyleCopyUpdated,refreshStyleCopy,anonymizeFavoriteMaterials,favoriteStylePrompt,getCurrentStylePrompt,getMergedStylePrompt,validateDistilledStyle,distillFavoriteStyle,removeFavorite};',c);
 return {c,api:c.api,current,other,local,foreign,requests,saves,toasts,localRow:{...local,bookId:'a',bookTitle:'本书'},foreignRow:{...foreign,bookId:'b',bookTitle:'别书'}};
}
function validStyle(extra=''){
 const guide='---\nname: 冷静短句\ndescription: 用动作承载情绪\n---\n# 写作风格指南\n## 风格概述\n用事实推进叙述。\n## 核心特点\n先动作后反应。\n## 特色表达\n使用短句停顿。\n## 写作示例\n### 推荐写法\n他推门进去。\n### 避免写法\n避免抽象赞叹。\n## 注意事项\n保留必要对话。'+extra;
 return guide+'\n<<<JSON>>>\n'+JSON.stringify({name:'冷静短句',summary:'用动作推进',prompt:'先写动作，再写直接反应，少用抽象评价。',samples:'他推门进去。',forbidden:'空泛赞叹',guide});
}
function select(r,row=r.foreignRow){r.api.scope='all';r.api.setStyleSourceMode('favorites');r.api.toggleStyleMaterial(row);}

test('文风库与喜欢范文互斥，范文不标成作者指令；最后一条取消后退回文风库',()=>{
 const r=runtime();assert.equal(r.api.state.mode,'library');assert.equal(r.api.getCurrentStylePrompt(),'文风库唯一哨兵');select(r,r.localRow);
 for(const fn of [r.api.getCurrentStylePrompt,r.api.getMergedStylePrompt]){const prompt=fn();assert.match(prompt,/只模仿语感、句式和节奏/);assert.match(prompt,/阿青和阿白留在本书/);assert.doesNotMatch(prompt,/文风库唯一哨兵/);}
 assert.equal(r.api.state.copies[0]._moyunUserInput,undefined);r.api.setStyleSourceMode('library');assert.equal(r.api.getMergedStylePrompt(),'文风库唯一哨兵');assert.doesNotMatch(r.api.getCurrentStylePrompt(),/喜欢范文/);r.api.setStyleSourceMode('favorites');r.api.toggleStyleMaterial(r.localRow);assert.equal(r.api.state.mode,'library');assert.ok(r.toasts.some(row=>row[0].includes('已切回文风库')));
 const empty=runtime();empty.current.novel.favoriteClips=[];empty.api.setStyleSourceMode('favorites');assert.equal(empty.api.state.mode,'library');
});

test('跨书存原文副本，发送时以一致A/B替换人名，本书素材保留人名',()=>{
 const r=runtime();select(r);const second={...r.foreignRow,id:'second',snapshot:'阿白向阿青招手，石桥没有变。'};r.api.toggleStyleMaterial(second);r.api.toggleStyleMaterial(r.localRow);
 assert.equal(r.api.state.copies[0].snapshot,r.foreign.snapshot);const text=r.api.anonymizeFavoriteMaterials(r.api.state.copies,'a');assert.match(text,/A走过石桥，B在桥头等候/);assert.match(text,/B向A招手，石桥没有变/);assert.match(text,/阿青和阿白留在本书/);assert.equal(r.api.state.copies[0].snapshot,r.foreign.snapshot);assert.equal(r.api.chars,r.api.state.copies.reduce((n,row)=>n+row.snapshot.length,0));
 const overlap=r.api.anonymizeFavoriteMaterials([{bookId:'b',snapshot:'阿青山看见阿青。',sourceCharacterNames:['阿青','阿青山']}],'a');assert.equal(overlap,'B看见A。');assert.ok(r.saves.includes('保存范文副本'));
});

test('原书新版本只提示不自动覆盖，手动更新后才改副本',()=>{
 const r=runtime();select(r);const copy=r.api.state.copies[0],old=copy.snapshot;r.foreign.snapshot='阿白先走，阿青随后。';assert.equal(copy.snapshot,old);assert.equal(r.api.isStyleCopyUpdated(copy),true);assert.equal(r.api.rows.find(row=>row.id==='foreign').sourceUpdated,true);r.api.refreshStyleCopy(copy);assert.equal(copy.snapshot,r.foreign.snapshot);assert.equal(copy.key,'b:foreign');assert.equal(copy.bookId,'b');assert.equal(r.api.isStyleCopyUpdated(copy),false);assert.ok(r.saves.includes('更新范文副本'));
});

test('序列化后不读原书也能发送范文，文风来源按书与分支隔离',()=>{
 const r=runtime();select(r);const saved=clone(r.c.novel.value);r.c.activeBranchId.value='side';assert.equal(r.api.state.mode,'library');assert.equal(r.api.state.copies.length,0);r.api.setStyleSourceMode('library');r.c.activeBranchId.value='main';assert.equal(r.api.state.mode,'favorites');
 const restored=runtime();restored.c.novel.value=saved;Object.defineProperty(restored.other,'novel',{get(){throw Error('发送不得加载来源书');}});assert.match(restored.api.getMergedStylePrompt(),/A走过石桥，B在桥头等候/);const another={title:'另一本书'};restored.c.currentBookId.value='new';restored.c.novel.value=another;assert.equal(restored.api.state.mode,'library');assert.equal(restored.api.state.copies.length,0);restored.c.currentBookId.value='a';restored.c.novel.value=saved;assert.equal(restored.api.state.mode,'favorites');
});

test('白鸟锁定不发送两类文风，也不能切模式；仍可提炼但结果不生效',async()=>{
 const r=runtime();select(r);r.c.locked=true;r.api.setStyleSourceMode('library');assert.equal(r.api.state.mode,'favorites');assert.equal(r.api.getCurrentStylePrompt(),'');assert.equal(r.api.getMergedStylePrompt(),'');await r.api.distillFavoriteStyle();assert.equal(r.requests.length,1);assert.equal(r.c.writingStyles.value.at(-1).source,'喜欢提炼');assert.equal(r.api.getCurrentStylePrompt(),'');assert.equal(r.api.getMergedStylePrompt(),'');assert.ok(r.toasts.some(row=>row[0].includes('白鸟锁定期间不生效')));
});

test('蒸馏提示词与原文件四字段逐字一致，合格结果存完整指南并自动启用',async()=>{
 const r=runtime();for(const [key,hash]of Object.entries({single:'1cc3646e5e0e7cacf48e6fdf6b75498e809f11a3a997ca1d87ea101205e63db3',retry:'5a73b357d35a349b4759939485cd7f5483aedddd4b8fba51df8d521f788d9c26'}))assert.equal(crypto.createHash('sha256').update(JSON.stringify({instruction:r.api.rules[key].instruction,promptTemplate:r.api.rules[key].promptTemplate})).digest('hex'),hash,key+' 原蒸馏器 instruction/promptTemplate');
 select(r);await r.api.distillFavoriteStyle();assert.equal(r.requests.length,1);const req=r.requests[0];assert.equal(req.req.model,'writing-mock');assert.equal(req.options.stream,true);assert.equal(req.msg[0].content,r.api.rules.single.instruction);assert.match(req.msg[1].content,/A走过石桥，B在桥头等候/);assert.match(req.msg[1].content,/样本较短时只总结能确定的风格特征，不要编造/);assert.ok(req.msg.every(row=>row._moyunUserInput!==true));
 const style=r.c.writingStyles.value.at(-1);assert.equal(style.name,'冷静短句');assert.equal(style.source,'喜欢提炼');assert.equal(style.prompt,'先写动作，再写直接反应，少用抽象评价。');assert.match(style.guide,/## 注意事项/);assert.equal(r.c.currentWritingStyleId.value,style.id);assert.equal(r.api.state.mode,'library');assert.equal(r.api.getCurrentStylePrompt(),style.prompt);assert.equal(r.api.busy,false);assert.ok(r.saves.includes('保存提炼文风'));assert.ok(r.toasts.some(row=>row[0]==='已提炼并启用文风：冷静短句'));
});

test('缺标题或复述大段原文自动重试一次，第二次合格才写入',async()=>{
 for(const kind of ['missing','copy']){let bad;const material='阿青沿着潮湿的石阶慢慢走下码头，阿白提着旧灯在木船上等候，两个人都没有再提昨夜发生的事，只听见远处的钟声。';const r=runtime(n=>n===1?bad:validStyle());const row={...r.foreignRow,snapshot:material};select(r,row);const sent=r.api.anonymizeFavoriteMaterials(r.api.state.copies,'a');bad=kind==='missing'?'只是输出一段文字':validStyle('\n'+sent);await r.api.distillFavoriteStyle();assert.equal(r.requests.length,2,kind);assert.equal(r.requests[1].msg[0].content,r.api.rules.retry.instruction);assert.ok(r.requests[1].msg[1].content.includes(bad));assert.match(r.requests[1].msg[1].content,/上一次的输出不符合要求/);assert.equal(r.c.writingStyles.value.length,2);}
});

test('重试仍不合格或请求失败不写文风；未选素材零请求；切书迟到结果不写',async()=>{
 const r=runtime(()=> '无效输出');select(r);await r.api.distillFavoriteStyle();assert.equal(r.requests.length,2);assert.equal(r.c.writingStyles.value.length,1);assert.equal(r.c.currentWritingStyleId.value,'library');assert.equal(r.api.state.mode,'favorites');assert.ok(r.toasts.some(row=>row[0].includes('未写入文风库')));
 const failed=runtime(()=>{throw Error('offline');});select(failed);await failed.api.distillFavoriteStyle();assert.equal(failed.requests.length,1);assert.equal(failed.c.writingStyles.value.length,1);const empty=runtime();await empty.api.distillFavoriteStyle();assert.equal(empty.requests.length,0);
 const late=runtime((_n,c)=>{c.currentBookId.value='different';return validStyle();});select(late);await late.api.distillFavoriteStyle();assert.equal(late.c.writingStyles.value.length,1);
});
