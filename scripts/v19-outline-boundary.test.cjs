'use strict';
const fs=require('node:fs'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8'),NL=String.fromCharCode(10);
function fn(name,indent=4){const start=source.indexOf(' '.repeat(indent)+'function '+name+'('),end=source.indexOf(NL+' '.repeat(indent)+'}',start);assert.ok(start>=0&&end>start,name);return source.slice(start,end+indent+2);}
function harness(){
 const ref=value=>({value}),settings=ref({contextOutlineBefore:1,contextOutlineAfter:2}),chapterOutlines=ref([]),visibleChapters=ref([]);
 const ctx={settings,chapterOutlines,visibleChapters,stripOutlineLengthDirectives:s=>s,clipContextText:(s,n)=>String(s).slice(0,n),nextChapterPrompt:ref(''),generateCount:ref(1),_remainingCount:0,promptPresets:ref([]),imageGenEnabled:ref(false),imageGenKey:ref(''),getChapterLengthContract:()=>({targetWords:2500,promptMinWords:2000,promptMaxWords:3000}),buildChapterHistoryContext:()=>({text:'请写正文。',hasSummaryContext:false}),extractNarrativeHardConstraints:()=>[],getSnowwingChapterStoryTime:()=>'',formatNarrativeHardConstraintPrompt:()=>'',isSnowwingPresetLocked:()=>true,getFullNsfwSystemPrompt:()=>'',getNsfwPrompt:()=>'',getDeepSeekPreludeMessages:()=>[],getNsfwInjectionMessages:()=>[],normalizeContextSettings(){},buildForeshadowPromptContext:()=>'',buildSnowwingActiveContextPrompt:()=>'',applyPromptComposer:msgs=>msgs,isSnowwingRuntimeAuditFlagEnabled:()=>false};
 ctx.pushProtectedMessage=(msgs,_safe,msg)=>msgs.push(msg);
 const code=[fn('buildOutlineContext'),fn('extractSnowwingCotAuthorContextFromMessages',0),fn('buildChapterMessages'),'return {buildOutlineContext,extractSnowwingCotAuthorContextFromMessages,buildChapterMessages};'].join(NL);
 let api;ctx.buildFullSystemPrompt=options=>'【故事大纲与细纲】'+NL+api.buildOutlineContext(options.currentChapterNo);ctx.collectSnowwingCotContextFromMessages=msgs=>({enabled:ctx.snowwing===true,authorContext:api.extractSnowwingCotAuthorContextFromMessages(msgs)});
 api=new Function(...Object.keys(ctx),code)(...Object.values(ctx));return {api,settings,chapterOutlines,setSnowwing:value=>{ctx.snowwing=value;}};
}
const rows=()=>Array.from({length:7},(_,i)=>({title:'标题'+(i+1),content:'细纲正文哨兵'+(i+1)+'：'+'事'.repeat(450)}));
const note='以下只是后续章节的标题，用来判断本章写到哪里停；其中的事件一律不得在本章出现或铺垫。';
test('E1-01/02/03/08：只发后续标题，前文200字、本章与最后一章保持原处理',()=>{
 const h=harness();h.chapterOutlines.value=rows();
 for(const after of [0,1,2,5]){h.settings.value.contextOutlineAfter=after;const out=h.api.buildOutlineContext(1);assert.ok(out.includes(h.chapterOutlines.value[0].content));assert.equal(out.includes(note),after>0);for(let i=1;i<7;i++){assert.ok(!out.includes('细纲正文哨兵'+(i+1)));assert.equal(out.includes('第'+(i+1)+'章 · 标题'+(i+1)),i<=after);}}
 h.settings.value.contextOutlineAfter=2;const fifth=h.api.buildOutlineContext(5);assert.ok(fifth.includes(h.chapterOutlines.value[3].content.slice(0,200)+NL+NL));assert.ok(!fifth.includes(h.chapterOutlines.value[3].content.slice(0,201)));assert.ok(fifth.includes(h.chapterOutlines.value[4].content));assert.ok(fifth.includes('第6章 · 标题6'+NL+'第7章 · 标题7'));assert.ok(!fifth.includes('细纲正文哨兵6'));assert.ok(!h.api.buildOutlineContext(7).includes(note));
 h.settings.value.contextOutlineAfter=0;assert.equal(h.api.buildOutlineContext(1),['═══════ 【本章细纲 · 第1章 · 标题1】 ═══════',h.chapterOutlines.value[0].content,'═══════ 本章细纲结束 ═══════','','【铁律】你正在写第1章。','- 只写本章细纲范围内的内容，写完就停','- 禁止写到后续章节的任何剧情','- 禁止自行发展细纲中没有的重大情节','- 当本章细纲的事件全部写完后，自然收尾并结束本章','- 如果字数还没到目标但细纲已写完，用场景描写和人物心理充实，不要编造新剧情',''].join(NL));
});
test('E1-04/05/07：最终校验按实际章号追加，无细纲时原文逐字保留，连续三章分别正确',()=>{
 const h=harness(),base='【最终执行校验】开始写正文前，请确认你已经同时读取：用户剧情要求、前文、角色设定、文风/预设、禁止规则、世界观、MOD规则与当前细纲。细纲只限制剧情范围，不能覆盖其他写作指令。输出前检查完整性、准确性和角色一致性，删掉重复废话；禁止“不是……是/不是……而是……”等对比模板、报告式字数表达和排比堆叠。完成内部推演后，可见层直接输出小说正文和剧情摘要；摘要结束后立即停止，禁止再输出读者评论、书评或任何附加内容。';
 const final=no=>h.api.buildChapterMessages({currentChapterNo:no,sequenceTotal:3,sequenceIndex:no,printLog:false}).find(m=>m.content.startsWith('【最终执行校验】')).content;
 assert.equal(final(1),base);h.chapterOutlines.value=rows();for(const no of [1,2,3])assert.equal(final(no),base+'本次只写第'+no+'章；第'+(no+1)+'章及以后的事件不得写出、不得提前铺垫、不得在结尾预告。');
 h.settings.value.contextUseOutline=false;assert.equal(final(1),base);h.settings.value.contextUseOutline=true;h.setSnowwing(true);assert.ok(final(1).includes('【白鸟推演承载要求】'));assert.ok(final(1).includes('本次只写第1章；第2章及以后'));
});
test('E1-06：白鸟证据移除新旧后续预告和铁律，本章细纲仍在，无总纲不假报总纲',()=>{
 const h=harness();h.chapterOutlines.value=rows();
 for(const legacy of [false,true]){let context=h.api.buildOutlineContext(1);if(legacy)context=context.replace([note,'第2章 · 标题2','第3章 · 标题3',''].join(NL),['（后续预告 · 第2章 · 绝对禁止提前展开）','细纲正文哨兵2','','（后续预告 · 第3章 · 绝对禁止提前展开）','细纲正文哨兵3','',''].join(NL));
 const data=h.api.extractSnowwingCotAuthorContextFromMessages([{role:'system',content:['【故事大纲与细纲】',context,'【叙事视角】','第三人称'].join(NL)}]);assert.equal(data.hasOutline,false);assert.ok(data.evidence.includes('未携带可见总纲'));assert.ok(data.detailedOutlineText.includes('细纲正文哨兵1'));for(const text of ['后续预告','标题2','标题3','【铁律】',note])assert.ok(!data.outlineText.includes(text),text);}
 const real=h.api.extractSnowwingCotAuthorContextFromMessages([{role:'system',content:['【故事大纲与细纲】','真实总纲哨兵',h.api.buildOutlineContext(1)].join(NL)}]);assert.equal(real.outlineText,'真实总纲哨兵');
});
