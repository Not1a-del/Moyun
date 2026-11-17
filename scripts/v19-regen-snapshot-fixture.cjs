'use strict';
const {makeBook}=require('./v19-legacy-memory-fixture.cjs');
function makeSnapshotBook(){
 const b=makeBook(5);b.id='snapshot-cleanup-demo';b.title=b.novel.title='快照清理验收书（合成数据）';b.novel.outline='这里只用于测试快照查看和清理，没有真实用户书稿。';
 b.branchList=[{id:'main',name:'主线',createdAt:1},{id:'demo-side',name:'验收支线',parentId:'main',forkIndex:1,forkChapterId:'main-c1',createdAt:2}];
 b.chapters.forEach((ch,i)=>{ch.branchId=i<3?'main':'demo-side';ch.title=['渡口来信','灯下核对','没有快照的一章','支线来信','支线归档'][i];ch.versions=[{title:ch.title+'旧稿',content:'旧稿验收哨兵'+i,summary:'旧稿摘要'+i,savedAt:1700000000000}];if(i!==2)ch.regenSnapshot={version:1,messages:[{role:'system',content:'这是第'+(i+1)+'项的首次请求，仅供查看，不会发给AI。'},{role:'user',content:('快照清理测试材料'+i+'，删除它不应影响正文和记忆。\n').repeat(6000)+'<script>不可执行的原文标记</script>'}],request:{url:'https://snapshot-demo.invalid/v1',model:'离线验收模型',adapterId:'openai-compatible'},promptOverride:'首次剧情要求'+i,targetChapterNo:i<3?i+1:i-2,createdAt:1700000000000+i,streamEnabled:true};b.memoryLibrary.memories[i].branchId=ch.branchId;});
 b.memoryLibrary.settings.enabled=false;b.memoryLibrary.groups=[];b.chapterOutlines=[];b.branchData={main:{outline:b.novel.outline,volumes:[],chapterOutlines:[],chapterIndexDrafts:[],foreshadowMatrix:[],staleMarks:[]},'demo-side':{outline:'支线验收总纲',volumes:[],chapterOutlines:[],chapterIndexDrafts:[],foreshadowMatrix:[],staleMarks:[]}};
 b.summaries=[{id:'demo-summary',branchId:'main',startChapter:1,endChapter:2,content:'长期总结验收哨兵：前两章只完成信件核对。',useForContext:true}];return{_type:'moyun_full_book_backup',_exportVersion:7,_exportMode:'full-backup',...b};
}
module.exports={makeSnapshotBook};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),arg=process.argv.indexOf('--out');if(arg<0||!process.argv[arg+1])throw Error('请通过 --out 指定项目目录外的测试JSON路径');const out=path.resolve(process.argv[arg+1]),root=path.resolve(__dirname,'..');if(out===root||out.startsWith(root+path.sep))throw Error('测试JSON必须放在项目目录外');fs.writeFileSync(out,JSON.stringify(makeSnapshotBook(),null,2),'utf8');console.log(out);}
