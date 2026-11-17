#!/usr/bin/env node
'use strict';
// 发布后检查实际站点；顺序复用同一个隔离浏览器 runner，并分站保存证据。
const fs=require('node:fs'),path=require('node:path'),{spawnSync,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),option=name=>{const index=process.argv.indexOf(name);return index<0?'':process.argv[index+1]||'';};
const sites={public:'https://yydcm-129.github.io/Moyun/',stable:'https://not1a-del.github.io/Moyun/'},selected=option('--site')||'all';
if(!['all',...Object.keys(sites)].includes(selected))throw Error('--site 仅支持 public、stable 或 all');
const out=path.join(root,'.ui-check/release-gate'),results=[];fs.mkdirSync(out,{recursive:true});
for(const [site,url] of Object.entries(sites)){
 if(selected!=='all'&&selected!==site)continue;
 for(const mode of ['release','tablet']){
  const args=['scripts/v19-outline-review-browser.cjs',...(mode==='release'?['--release-smoke']:['--mobile-layout','--tablet-layout']),'--url',url,...(option('--proxy')?['--proxy',option('--proxy')]:[]),...(option('--repo-metadata')?['--repo-metadata',option('--repo-metadata')]:[])];
  const evidence=path.join(root,mode==='release'?'.ui-check/release-smoke/live':'.ui-check/mobile-hotfix/tablet-smoke');
  // 只清理本轮报告，失败时不能把上次通过的文件复制为新证据。
  if(fs.existsSync(path.join(evidence,'results.json')))fs.unlinkSync(path.join(evidence,'results.json'));
  const started=Date.now(),run=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:20*60*1000,maxBuffer:16*1024*1024,windowsHide:true});
  const log=String(run.stdout||'')+String(run.stderr||'');process.stdout.write(log);
  const target=path.join(out,site,mode);fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(target,'run.log'),log);
  if(fs.existsSync(evidence))fs.cpSync(evidence,target,{recursive:true});
  const reportFile=path.join(target,'results.json'),report=fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile,'utf8')):null;
  results.push({site,url,mode,command:'node '+args.join(' '),passed:run.status===0&&!run.error&&report?.passed===true,exitCode:run.status,error:run.error?.message||null,seconds:Math.round((Date.now()-started)/100)/10,checks:report?.results?.length||0});
  if(!results.at(-1).passed)break;
 }
 if(!results.at(-1).passed)break;
}
const expected=(selected==='all'?2:1)*2,passed=results.length===expected&&results.every(row=>row.passed);
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({generatedAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),passed,selected,results,notCovered:['模拟视口不能代替 iOS 与厂商真机','不调用真实模型；Pages 来源和构建 SHA 另以 GitHub 回执核对']},null,2));
console.log('[release-gate]',passed?'通过':'未通过，不能作为上线验收通过',path.join(out,'results.json'));process.exit(passed?0:1);
