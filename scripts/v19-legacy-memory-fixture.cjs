'use strict';
// 按 v0.0.18 实际存档结构造书；只含合成文字，不读取用户书库。
function legacyHash(text) {
  let a=2166136261,b=5381;
  for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b,33)^c;}
  return text.length+':'+(a>>>0).toString(36)+':'+(b>>>0).toString(36);
}
function makeBook(count=320,branchId='main') {
  const chapters=Array.from({length:count},(_,i)=>({id:branchId+'-c'+(i+1),branchId,title:'旧章'+(i+1),content:('正文事实'+(i+1)+'。').padEnd(3300,'文'),summary:'摘要事实['+(i+1)+']',versions:[]}));
  const memories=chapters.map((ch,i)=>({chapterId:ch.id,branchId,sourceHash:legacyHash('\n'+ch.content+'\n'),text:'逐章事实['+(i+1)+']',enabled:true,at:1700000000000+i}));
  const groups=[];
  for(let i=0;i+5<=count-25;i+=5){const sourceMemories=memories.slice(i,i+5).map(m=>({chapterId:m.chapterId,sourceHash:m.sourceHash,text:m.text}));groups.push({key:legacyHash(sourceMemories.map(m=>m.chapterId+':'+m.sourceHash+':'+m.text).join('\n')),text:'合并事实['+(i+1)+'-'+(i+5)+']',sourceMemories,at:1700000000000+i});}
  return {id:'legacy-million-'+branchId,title:'百万字旧书',novel:{title:'百万字旧书',outline:'旧总纲完整哨兵',volumes:[]},chapters,characters:[],chapterOutlines:[{id:'old-detail',chapterNo:321,title:'下一章',content:'旧细纲完整哨兵'}],summaries:[],memoryLibrary:{version:2,settings:{enabled:true,mode:'classic',summaryKeepFloors:20,classicConcurrency:5},memories,groups},modPacks:[],modPrivateData:{'old-memory-mod':{archive:{text:'MOD旧记忆保留哨兵'}}},branchList:[{id:branchId,name:'主线',createdAt:1}],activeBranchId:branchId};
}
module.exports={makeBook,legacyHash};
