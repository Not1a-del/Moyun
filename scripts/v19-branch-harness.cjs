'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
function section(start,end){const at=source.indexOf(start),to=source.indexOf(end,at);assert.ok(at>=0&&to>at,start);return source.slice(at,to);}
function fn(name){let at=source.indexOf('    function '+name+'(');if(at<0)at=source.indexOf('    async function '+name+'(');const end=source.indexOf('\n    }',at);assert.ok(at>=0&&end>at,name);return source.slice(at,end+6);}
function branchHarness(){
 const ref=value=>({value}),computed=get=>({get value(){return get();}}),toasts=[],saves=[],images=new Map();let serial=0;
 const c={ref,computed,Date:class extends Date{static now(){return 1700000000000;}},Map,Set,TextEncoder,deepClone:clone,uid:()=> 'copy-'+(++serial),currentBookId:ref('book'),activeBranchId:ref('main'),branchList:ref([{id:'main',name:'主线',createdAt:1}]),branchData:ref({}),chapters:ref([]),chapterOutlines:ref([]),chapterIndexDrafts:ref([]),foreshadowMatrix:ref([]),staleMarks:ref([]),currentChapterIndex:ref(0),
  novel:ref({title:'分支测试书',favoriteClips:[],styleSources:{},volumes:[]}),summaries:ref([]),memoryLibrary:ref({settings:{enabled:false},memories:[],groups:[]}),modPrivateData:ref({}),nextChapterPrompt:ref(''),showBranchPanel:ref(false),showDetailedOutlineInMain:ref(false),
  isGenerating:ref(false),isGeneratingOutline:ref(false),isGeneratingDO:ref(false),outlineAiEditingIdx:ref(-1),isGeneratingCharacterDraft:ref(false),isReviewing:ref(false),_isPreparingGenerationRecall:false,_activeGenerationRun:null,_bookScopedAiRuns:new Map(),
  normalizeChapterIndexDrafts:rows=>clone(rows||[]),normalizeForeshadowMatrix:rows=>clone(rows||[]),normalizeStaleMarks:rows=>clone(rows||[]),parseChapterRefs:value=>(String(value||'').match(/\d+/g)||[]).map(Number),
  showToast:(...args)=>toasts.push(args),openConfirm:(config,callback)=>{c.confirm={config,callback};},saveData:()=>{saves.push({reason:'debounced'});},saveDataNow:async reason=>{saves.push({reason,branch:c.activeBranchId.value,chapters:clone(c.chapters.value)});return true;},
  confirmStorageHeadroom:async()=>true,closeContinuityCheck(){},cancelMemoryWork(){},cancelSuggestionRun(){},toggleBranchPanel(){c.showBranchPanel.value=true;},
  currentFavoriteClips:()=>c.novel.value.favoriteClips||[],getVolumeHandoff:(volume,bid)=>volume.handoffSummaries?.[bid]||null,
  cloneModMemorySummaryScopesForBranch(parentId,bid,ids,idMap){c.modPrivateData.value[bid]=(c.modPrivateData.value[parentId]||[]).filter(row=>ids.includes(row.chapterId)).map(row=>({...clone(row),chapterId:idMap.get(row.chapterId),branchId:bid}));},
  deleteModMemorySummaryScopesForBranch(bid){delete c.modPrivateData.value[bid];return 0;},
  ImageStore:{async exportBook(_bookId,ids){return Object.fromEntries([...images].filter(([key])=>ids.some(id=>key.includes(':'+encodeURIComponent(id)+':')||key.startsWith('img_'+id+'_'))).map(([key,value])=>[key,clone(value)]));},async set(key,value){images.set(key,clone(value));},async delete(key){images.delete(key);}}};
 c.novelVolumes=computed(()=>c.novel.value.volumes);
 vm.createContext(c);
 vm.runInContext(section('    const visibleChapters = computed(', '    const chapterWordCountCache')+';globalThis.visibleChapters=visibleChapters;',c);
 vm.runInContext(fn('normalizeNovelVolumes')+'\n'+fn('normalizeChapterOutline')+'\n'+section('    function getBranchForkEnd(', '    function markStale(')+'\n'+fn('canChangeBranch')+'\n'+section('    let branchForkPending =', '    function renameBranch(')+'\n'+fn('switchBranch'),c);
 c.chapters.value=Array.from({length:6},(_,i)=>({id:'c'+(i+1),branchId:'main',title:'标题'+(i+1),content:'正文'+(i+1),summary:'摘要'+(i+1),versions:[{content:'旧稿'+(i+1)}],summaryCandidate:{content:'候选'+(i+1),incomplete:true}}));
 const main={chapterOutlines:Array.from({length:8},(_,i)=>({id:'o'+(i+1),chapterNo:i+1,title:'细纲'+(i+1),content:'主线细纲'+(i+1),history:[{content:'旧细纲',at:1}]})),chapterIndexDrafts:Array.from({length:8},(_,i)=>({chapterNo:i+1,title:'索引'+(i+1)})),foreshadowMatrix:[{id:'dark',setupChapter:'2',upgradeChapter:'3',resolvedChapter:'6',status:'回收',note:'原计划'}],staleMarks:[]};
 c.branchData.value=c.normalizeBranchData({},main);c.loadBranchScopedData('main');
 c.summaries.value=[{id:'s1',branchId:'main',startChapter:1,endChapter:3,content:'前三章总结'},{id:'s2',branchId:'main',startChapter:4,endChapter:6,content:'后半总结'}];
 c.memoryLibrary.value.memories=c.chapters.value.map(ch=>({chapterId:ch.id,branchId:'main',text:'记忆'+ch.id}));
 c.memoryLibrary.value.groups=[{key:'g1',text:'前三章记忆',sourceMemories:c.chapters.value.slice(0,3).map(ch=>({chapterId:ch.id}))},{key:'g2',text:'后半记忆',sourceMemories:c.chapters.value.slice(3).map(ch=>({chapterId:ch.id}))}];
 c.novel.value.favoriteClips=[1,4].map(n=>({id:'like'+n,chapterId:'c'+n,branchId:'main',snapshot:'喜欢正文'+n,paragraphIndex:0}));
 c.novel.value.styleSources.main={mode:'favorites',copies:[{...clone(c.novel.value.favoriteClips[0]),bookId:'book',key:'book:like1'},{...clone(c.novel.value.favoriteClips[1]),bookId:'book',key:'book:like4'},{id:'foreign',bookId:'other',branchId:'main',chapterId:'external',key:'other:foreign',snapshot:'跨书离线范文'}]};
 c.novel.value.volumes=[{id:'v1',startChapter:1,endChapter:3,handoffSummaries:{main:{content:'前三章交接',actualOutline:'实际卷纲',branchId:'main'}}},{id:'v2',startChapter:4,endChapter:6,handoffSummaries:{main:{content:'后半卷交接',branchId:'main'}}}];
 c.modPrivateData.value.main=c.chapters.value.map(ch=>({chapterId:ch.id,branchId:'main',text:'MOD记忆'+ch.id}));
 images.set('img_v17_book:c1:插图:0',{versions:[{src:'原图'}],current:0});images.set('img_c2_1',{src:'旧格式原图'});
 c.novel.value.volumes=c.normalizeNovelVolumes(c.novel.value.volumes);
 return {c,toasts,saves,images,clone,fn,source};
}
module.exports={branchHarness,source,section,fn,clone};
