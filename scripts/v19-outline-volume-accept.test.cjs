'use strict';
const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const src=fs.readFileSync(require('node:path').join(__dirname,'../source/moyun.single.html'),'utf8');
function fn(name){const start=src.search(new RegExp('    (?:async )?function '+name+'[(]'));assert.ok(start>=0,name);return src.slice(start,src.indexOf(String.fromCharCode(10)+'    }',start)+6);}
test('接受完整卷纲候选时支持把旧卷拆成多卷且保留旧交接',()=>{
 const novel={value:{volumes:[{id:'old',title:'旧卷',startChapter:1,endChapter:10,summary:'旧计划',handoffSummaries:{main:{content:'旧交接'}}}]}};
 const c=vm.createContext({novel,novelVolumes:{get value(){return novel.value.volumes;}},uid:(()=>{let i=0;return()=>String(++i);})(),normalizeNovelVolumes:rows=>JSON.parse(JSON.stringify(rows)),deepClone:value=>JSON.parse(JSON.stringify(value))});
 vm.runInContext(fn('applyAcceptedVolumePlan'),c);
 assert.equal(c.applyAcceptedVolumePlan([{number:1,title:'前半',startChapter:1,endChapter:5,summary:'前半计划'},{number:2,title:'后半',startChapter:6,endChapter:10,summary:'后半计划'}]),true);
 assert.equal(novel.value.volumes.length,2); assert.equal(novel.value.volumes[0].id,'old'); assert.equal(novel.value.volumes[1].startChapter,6);
 assert.equal(novel.value.volumes[0].handoffSummaries.main.content,'旧交接');
});
test('创建和新增卷的请求都进入卷纲规划，数量语义不同且范围覆盖全书细纲',()=>{
 const novel={value:{outline:'',chapterCount:0,volumes:[{id:'v1',title:'旧卷',startChapter:1,endChapter:6,summary:'已有计划'}]}};
 const chapterOutlines={value:Array.from({length:6},(_,i)=>({title:'第'+(i+1)+'章',content:'细纲'}))};
 const context=vm.createContext({novel,novelVolumes:{get value(){return novel.value.volumes;}},chapters:{value:[]},chapterOutlines,visibleChapters:{value:[]}});
 vm.runInContext([fn('parseWorkbenchCount'),fn('isVolumeWorkbenchRequest'),fn('getWorkbenchChapterScope')].join(String.fromCharCode(10)),context);
 assert.equal(context.isVolumeWorkbenchRequest('根据细纲创建新的卷纲并把剧情分成三卷'),true);
 assert.equal(context.getWorkbenchChapterScope('新增两卷并按剧情归类').volumeCount,3);
 assert.equal(context.getWorkbenchChapterScope('新建三卷并按剧情归类').volumeCount,3);
 assert.equal(context.getWorkbenchChapterScope('新增两卷并按剧情归类').total,6);
});
