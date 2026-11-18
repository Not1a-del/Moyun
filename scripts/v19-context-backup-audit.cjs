'use strict';
// 私人备份只读审计：仅输出计数、字段覆盖和指纹，不输出书名、人物名或书稿。
const fs=require('node:fs'),crypto=require('node:crypto');
const index=process.argv.indexOf('--backup'),file=index>=0&&process.argv[index+1];
if(!file){console.error('用法：node scripts/v19-context-backup-audit.cjs --backup <本地备份路径>');process.exit(1);}
const bytes=fs.readFileSync(file),data=JSON.parse(bytes.toString('utf8'));
const books=Array.isArray(data.books)?data.books:[data];
const result={bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),books:books.map(book=>{
 const characters=book.characters||[],chapters=book.chapters||[],entries=book.storyBible?.world?.entries||[],world=String(book.novel?.worldView||'');
 const snapshots=chapters.map(ch=>ch.regenSnapshot).filter(s=>Array.isArray(s?.messages));
 const sizes=snapshots.map(s=>s.messages.reduce((sum,m)=>sum+String(m.content||'').length,0));
 const worldReferenceHints=['性格','关系'].map(keyword=>{const positions=[...world.matchAll(new RegExp(keyword,'g'))].map(m=>m.index);return{keyword,count:positions.length,after4000:positions.filter(pos=>pos>=4000).length};});
 return {chapters:chapters.length,characters:characters.length,relationships:characters.reduce((sum,c)=>sum+(c.relationships||[]).length,0),worldChars:world.length,entries:entries.length,factions:entries.filter(e=>e.type==='faction').length,factionMemberLinks:entries.filter(e=>e.type==='faction').reduce((sum,e)=>sum+(e.characterIds||[]).length,0),memories:book.memoryLibrary?.memories?.length,groups:book.memoryLibrary?.groups?.length,snapshots:snapshots.length,snapshotRequestMinChars:sizes.length?Math.min(...sizes):0,snapshotRequestMaxChars:sizes.length?Math.max(...sizes):0,latest:snapshots.slice(-3).map(s=>{
  const raw=s.messages.map(m=>String(m.content||'')).join('\n');
  return {chapterNo:s.targetChapterNo,chars:raw.length,messageSizes:s.messages.map(m=>({role:m.role,chars:String(m.content||'').length})),worldWhole:world?raw.includes(world):null,worldFirst4000:world?raw.includes(world.slice(0,4000)):null,worldTail:world?raw.includes(world.slice(-200)):null,noCharacterPlaceholder:raw.includes('暂无角色设定'),thirdPersonInstruction:raw.includes('本章采用第三人称视角'),entrySummaries:entries.filter(e=>e.summary&&raw.includes(e.summary)).length,entryDetails:entries.filter(e=>e.details&&raw.includes(e.details)).length};
 }),worldReferenceHints};
})};
process.stdout.write(JSON.stringify(result,null,2)+'\n');
