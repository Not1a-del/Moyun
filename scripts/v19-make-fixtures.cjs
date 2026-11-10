'use strict';
// Generated book JSON contains no credentials. B intentionally omits every v19 field.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const at = Date.UTC(2026,9,24), clone = value=>JSON.parse(JSON.stringify(value));
const rows = (count,make)=>Array.from({length:count},(_,index)=>make(index+1));
function book(letter,title) {
  return {id:'v19-fixture-'+letter,title,lastModified:at,wordCount:0,
    novel:{title,theme:'雾港寻灯',synopsis:'林舟和沈禾寻找失踪的守灯人。',worldView:'潮汐决定航路，灯塔只在夜里开放。',outline:'',negativePrompt:'',isAdultMode:false},
    chapters:[],characters:[{id:letter+'-char-1',name:'林舟',desc:'成年修灯师，保管铜钥匙。'},{id:letter+'-char-2',name:'沈禾',desc:'成年领航员，熟悉潮汐。'}],
    chapterOutlines:[],chapterIndexDrafts:[],foreshadowMatrix:[],summaries:[],
    branchList:[{id:'main',name:'主线',forkFromChapterId:null,forkIndex:0}],activeBranchId:'main'};
}
function outlines(letter,count,ended=false) {
  return rows(count,n=>({id:letter+'-outline-'+n,chapterNo:n,title:'第'+n+'章 灯塔线索',
    content:n===count&&ended?'林舟归还钥匙，守灯人平安归来，所有线索在本章收束。故事结束。':'林舟核对第'+n+'处航标，沈禾发现新的潮汐线索。下一步仍需寻找守灯人。',
    characterIds:[letter+'-char-1',letter+'-char-2'],isExpanded:false}));
}
function populate(target,chapterCount,branchCount) {
  const letter = target.id.slice(-1);
  target.chapters = rows(chapterCount,n=>({id:letter+'-chapter-'+n,title:'第'+n+'章 航标',branchId:'main',
    content:('林舟收好铜钥匙，与沈禾核对第'+n+'号航标。潮声掩住脚步，灯塔的光仍没有亮起。\n\n').repeat(12),
    summary:'林舟与沈禾调查第'+n+'处航标。',versions:[],activeVersionIdx:0}));
  target.chapterOutlines = outlines(letter,chapterCount);
  target.chapterIndexDrafts = rows(chapterCount,n=>({id:letter+'-index-'+n,chapterNo:n,title:'第'+n+'章 航标',goal:'调查第'+n+'处航标'}));
  for(let n=1;n<=branchCount;n++) {
    const forkIndex = Math.min(chapterCount-1,n*5-1);
    target.branchList.push({id:letter+'-branch-'+n,name:'支线'+n,forkFromChapterId:target.chapters[forkIndex].id,forkIndex});
  }
  target.wordCount = target.chapters.reduce((sum,ch)=>sum+ch.content.replace(/\s/g,'').length,0);
  return target;
}
function createFixtures() {
  const A = book('A','空白新书'); A.novel = {...A.novel,theme:'',synopsis:'',worldView:''}; A.characters = [];
  const B = populate(book('B','老书：雾港'),30,2);
  B.novel.outline = '调查雾港旧案，找到守灯人并修复灯塔。';
  B.novel.volumes = [{id:'B-volume-1',title:'雾港旧案',startChapter:1,endChapter:30,summary:'查清旧案。'}];
  B.summaries = [{id:'B-summary-1',startChapter:1,endChapter:5,content:'林舟和沈禾在主线调查灯塔。'}];
  B.foreshadowMatrix = [{id:'B-darkline-1',title:'铜钥匙',setupChapter:2,payoffChapter:25,description:'钥匙打开灯塔暗门。'}];
  const C = populate(book('C','大书：百盏灯'),100,3);
  C.novel.outline = '沿百处航标寻找旧案真相。';
  C.novel.volumes = rows(10,n=>({id:'C-volume-'+n,title:'第'+n+'卷 航路',startChapter:n*10-9,endChapter:n*10,summary:'调查本卷航路。'}));
  C.storyBible = {schemaVersion:1,createdAt:at,updatedAt:at,project:{premise:'寻找守灯人'},world:{
    entries:rows(30,n=>({id:'C-setting-'+n,name:'航标'+n,type:'location',summary:'第'+n+'号航标',details:('航标'+n+'位于雾港北岸，需要铜钥匙校准。').repeat(20),characterIds:['C-char-1'],tags:['航路']})),events:[]}};
  C.branchData = {main:{chapterOutlines:clone(C.chapterOutlines),chapterIndexDrafts:clone(C.chapterIndexDrafts),foreshadowMatrix:[],staleMarks:[]}};
  C.branchList.slice(1).forEach((branch,index)=>{C.branchData[branch.id]={chapterOutlines:[{id:branch.id+'-outline',chapterNo:branch.forkIndex+2,title:'支线专属线索',content:'只有支线'+(index+1)+'知道的旧码头口令。'}],chapterIndexDrafts:[],foreshadowMatrix:[],staleMarks:[]};});
  const D = book('D','未完细纲：三十五章'); D.chapterOutlines = outlines('D',35);
  const E = book('E','完结细纲：十二章'); E.chapterOutlines = outlines('E',12,true);
  const F = book('F','手写长章'); F.characters = [];
  const paragraph = '夜色里，林舟收起铜钥匙。“等潮水退去，我们再走。”沈禾停在石阶上，听见远处传来钟声。';
  const prose = (paragraph+'\n'+paragraph+'\n\n'+paragraph+'\r\n\r\n'+'　　'+paragraph+'\n\n\n').repeat(80);
  let letters = 0, end = 0;
  while(end<prose.length && letters<8000) { if(!/\s/.test(prose[end]))letters++; end++; }
  F.chapters = [{id:'F-chapter-1',title:'手写：潮退之前',branchId:'main',content:prose.slice(0,end),versions:[],activeVersionIdx:0}]; F.wordCount = 8000;
  return {A,B,C,D,E,F};
}
function toLibrary(fixture) {
  const current = clone(fixture);
  return {version:6,timestamp:at,revision:1,...clone(current),books:[current],currentBookId:current.id};
}
function writeFixtures(destination = path.join(__dirname,'fixtures/v0.0.19')) {
  fs.mkdirSync(destination,{recursive:true}); const fixtures = createFixtures(), manifest = {};
  for(const [letter,fixture] of Object.entries(fixtures)) {
    const content = JSON.stringify(fixture,null,2)+'\n'; fs.writeFileSync(path.join(destination,letter+'.json'),content);
    manifest[letter] = {file:letter+'.json',title:fixture.title,chapters:fixture.chapters.length,branches:fixture.branchList.length-1,outlines:fixture.chapterOutlines.length,bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex')};
  }
  fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n'); return manifest;
}
if(require.main===module)console.log(JSON.stringify(writeFixtures(process.argv[2]),null,2));
module.exports = {createFixtures,toLibrary,writeFixtures};

