'use strict';
// 参数：CDP 端口、本机入口、白鸟包路径、旧包目录。所有 AI/网络请求由离线响应承接。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const port=Number(process.argv[2]||9236),base=process.argv[3]||'http://127.0.0.1:4176/index.html',whiteFile=process.argv[4],oldDir=process.argv[5];
if(!whiteFile||!oldDir)throw Error('请提供白鸟 JSON 和旧 MOD 目录');
const files=[whiteFile,...fs.readdirSync(oldDir).filter(x=>x.endsWith('.json')).map(x=>path.join(oldDir,x))];
const packs=files.map(file=>({name:path.basename(file),data:JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''))}));
const results=[];let c;
async function record(name,fn){const data=await fn();results.push({name,ok:true,data});console.log('PASS',name,JSON.stringify(data));}
async function setup(){await c.ev(()=>{const s=__s;window.__modTest={requests:[],response:'离线工具结果：本章船员在北港完成补给，核对海图后安排次日出航。'};window.fetch=async(url,opts={})=>{if(!String(url).startsWith('https://moyun-test.invalid/'))throw Error('测试禁止外发：'+url);__modTest.requests.push(JSON.parse(opts.body||'{}'));return new Response('data: '+JSON.stringify({choices:[{delta:{content:__modTest.response},finish_reason:'stop'}]})+'\n\n',{headers:{'content-type':'text/event-stream'}});};const r=s.createConnectionProfile({name:'MOD 离线测试',templateId:'openai-compatible',baseUrl:'https://moyun-test.invalid/v1',defaultModel:'mod-test',apiKey:'test-only',lastTest:{status:'ok'}});if(!r.ok)throw Error(r.reason);s.connectionCenter.defaultProfileId=r.profile.id;s.nsfwSettings.enabled=false;s.settings.secondRoundSupplementEnabled=false;s.settings.autoTimelineSupplement=false;s.settings.enableReviewer=false;s.settings.commentInline=false;s.novel.title='兼容测试书';s.novel.worldView='北港位于群岛北岸，林舟与沈禾准备航程。';s.chapters=[{id:'compat-chapter',title:'北港',content:'林舟在北港核对海图。沈禾检查潮汐与补给，然后在日志里记录次日航线。\n\n船员等待天气转晴，并检查船只。',summary:'林舟与沈禾在北港核对航线和补给，等待晴天出航。',branchId:'main',wordCount:60,versions:[],isExpanded:true}];s.currentChapterIndex=0;});}
async function install(pack){await c.ev(async pack=>{const s=__s;s.showConfirm=false;s.showSettings_modal=false;s.showPromptPreview=false;s.activeModModalKey='';s.activeModFloatingPanelKey='';s.modFloatingHubOpen=false;s.modPacks=[];s.modPrivateData={};const f=new File([JSON.stringify(pack.data)],pack.name,{type:'application/json'});s.handleModImport({target:{files:[f],value:''}});await new Promise(r=>setTimeout(r,300));},pack);const err=await c.ev(()=>({confirm:__s.showConfirm,toast:__s.toast.message}));assert.equal(err.confirm,true,pack.name+': '+err.toast);await c.ev(async()=>{await __s.execConfirm();await Vue.nextTick();});}
async function exercise(pack){return await c.ev(async pack=>{const s=__s,id=pack.data.id||pack.data.manifest.id,mod=s.modPacks.find(m=>m.id===id);if(!mod)throw Error('安装的稳定 ID 不符');
const expected=JSON.stringify(s.normalizeModPack(pack.data));if(JSON.stringify(s.normalizeModPack(mod))!==expected)throw Error('MOD 声明在导入时被意外修改');
const metrics={id,version:mod.version,modules:mod.modules.length,tools:mod.aiTools.length,workflows:mod.workflows.length,hosted:mod.hostedViews.length,settings:0,tables:0,components:0,toolRuns:0,workflowRuns:0};
const raw=s.buildLibrarySnapshot();structuredClone(raw);
for(const field of s.getModSettingsFields(mod)){const value=field.value; s.setModSettingValue(id,field.key,value);metrics.settings++;}
for(const [key] of Object.entries(mod.settingsSchema||{})){if(/apikey/i.test(key))s.setModSettingValue(id,key,'test-only');else if(/apiurl/i.test(key))s.setModSettingValue(id,key,'https://moyun-test.invalid/v1');else if(/model$/i.test(key))s.setModSettingValue(id,key,'mod-test');else if(/enabled|autoGenerate|auto.*After/i.test(key))s.setModSettingValue(id,key,true);}
if(mod.permissions.includes('storage:own')){s.setModPrivateData(id,'compatMarker',{value:'persist-'+id});if(s.getModPrivateData(id).compatMarker.value!=='persist-'+id)throw Error('私有数据未写入');}
for(const schema of mod.dataSchemas){if(!mod.permissions.includes('data:table'))continue;s.addModTableRow(mod,schema);const rows=s.getModTableRows(id,schema.id),row=rows.at(-1),field=schema.fields[0];if(field)s.updateModTableCell(mod,schema,row,field.key,'兼容验收');if(!rows.length)throw Error('表格未新增');metrics.tables++;}
function walk(components){for(const component of components||[]){s.getModHostedViewComponentData(mod,component);metrics.components++;walk(component.children||component.components);}}
for(const view of mod.hostedViews)walk(view.components);
for(const [slot,list] of Object.entries(mod.ui)){if(!list.length)continue;const entries=s.getModUiEntries(slot).filter(e=>e.mod.id===id);const permission=s.getModUiSlotPermissionKey(slot);if(!permission||mod.permissions.includes(permission)){if(entries.length!==list.filter(e=>e.enabled!==false).length)throw Error('UI 插槽数量不符 '+slot);}}
for(const tool of mod.aiTools){const schema=mod.dataSchemas.find(x=>x.id===tool.targetTableId);const row={};if(schema)for(const f of schema.fields){row[f.key]=f.type==='number'?1:f.type==='boolean'?true:f.type==='select'?(f.options[0]?.value||f.options[0]||''):String(f.default||'验收字段 '+f.key);}
__modTest.response=tool.outputMode==='tableRows'?JSON.stringify([row]):'离线工具验收：船员核对海图与潮汐，林舟将北港的变化记录在日志中，准备次日出航。';
const inputs={};for(const field of tool.inputSchema||[])inputs[field.key]=field.default!==undefined&&field.default!==''?field.default:(field.type==='number'?1:'本章船员检查海图并准备出航');
if('materialText'in inputs)inputs.materialText=s.chapters[0].content;
const r=await s.runModAiTool(mod,tool,{inputs,maxRetryAttempts:1});if(!r.ok)throw Error('工具 '+tool.id+': '+r.error);if(tool.saveResult!==false&&!s.getModAiToolLatestResult(id,tool.id))throw Error('工具结果未持久化 '+tool.id);metrics.toolRuns++;}
for(const workflow of mod.workflows){if(workflow.steps.some(st=>!['toast','savePrivateData','uiAction'].includes(st.type)))continue;if(workflow.steps.some(st=>st.type==='uiAction'&&!['openModFloatingPanel','openModModal','appendNextPrompt','fillNextPrompt','setModModuleEnabled'].includes(st.action)))continue;const r=await s.runModWorkflow(mod,workflow,{skipConfirm:true});if(!r.ok)throw Error('工作流 '+workflow.id+': '+r.error);metrics.workflowRuns++;s.activeModModalKey='';}
// 完整消息预览必须真正包含该 MOD 的已启用规则；白鸟关闭宿主预设仍有效。
metrics.promptRules=0;
s.openPromptPreview();if(s.promptPreviewError)throw Error(s.promptPreviewError);
const promptText=s.promptPreviewMessages.map(x=>x.content).join('\n');
const ruleTexts=(mod.rules||[]).concat(...(mod.modules||[]).filter(m=>m.enabled!==false).map(m=>m.rules||[])).filter(r=>r.enabled!==false&&r.content&&['pre','style','world','character','outline','scene','writing','post'].includes(r.position));
for(const rule of ruleTexts){const snippet=String(rule.content).split('\n').map(x=>x.trim()).find(x=>x.length>=12&&!/[{}<>]/.test(x));if(snippet&&promptText.includes(snippet.slice(0,60)))metrics.promptRules++;}
if(ruleTexts.length&&mod.permissions.includes('prompt:write')&&!metrics.promptRules)throw Error('预览中未找到该 MOD 的有效提示规则');
s.showPromptPreview=false;
// 由宿主的原工作流引擎串联工具，不用单独工具成功来代替串联成功。
metrics.aiWorkflows=0;
for(const flow of mod.workflows){
  if(!flow.steps.some(st=>st.type==='aiTool'))continue;
  if(flow.steps.some(st=>!['toast','aiTool','uiAction','savePrivateData'].includes(st.type)))continue;
  if(flow.steps.some(st=>st.type==='uiAction'&&!['openModModal','appendNextPrompt','openModFloatingPanel'].includes(st.action)))continue;
  if(flow.enabledSetting)s.setModSettingValue(id,flow.enabledSetting,true);
  const tools=flow.steps.filter(st=>st.type==='aiTool').map(st=>mod.aiTools.find(t=>t.id===st.toolId));
  __modTest.response=tools.every(t=>t?.outputMode==='tableRows')?'[]':'离线工作流结果：船员完成港口检查，记录潮汐和补给变化，并确定下一步航程。';
  const run=await s.runModWorkflow(mod,flow,{skipConfirm:true,context:{chapterIndex:0,chapterId:s.chapters[0].id,chapterTitle:s.chapters[0].title,chapterContent:s.chapters[0].content,current:{chapterIndex:0,chapterId:s.chapters[0].id,chapterTitle:s.chapters[0].title,chapterContent:s.chapters[0].content}}});
  if(!run.ok)throw Error('串联工作流 '+flow.id+': '+run.error);metrics.aiWorkflows++;s.activeModModalKey='';
}
metrics.eventHandlers=0;
if(mod.permissions.includes('event:listen')){
  __modTest.response=mod.aiTools.every(t=>t.outputMode==='tableRows')?'[]':'事件回归：船员确认当前航线并记录已经发生的变化。';
  for(const h of mod.eventHandlers||[])if(h.enabledSetting)s.setModSettingValue(id,h.enabledSetting,true);
  const results=await s.runModEventHandlers('generationFinished',{chapterIndex:0,chapterId:s.chapters[0].id,chapterTitle:s.chapters[0].title,chapterNumber:1});
  for(const r of results){if(r.error&&!r.skipped)throw Error('事件 '+r.handlerId+': '+r.error);metrics.eventHandlers++;}s.activeModModalKey='';
}
// 手动正文控件的阅读隐藏不能阻塞原来的输入/续写功能。
if(mod.features?.infiniteMode){
  s.enterInfiniteMode();await Vue.nextTick();if(!s.novel.isInfiniteMode)throw Error('无限模式未进入');
  s.infiniteDraft='船员在北港记录航行计划。';__modTest.response='领航员将新地图铺开，逐项核对潮汐与补给，并在日志中记下变化。';
  await s.startInfiniteContinuation();await Vue.nextTick();
  if(!s.infiniteDraft.includes('领航员将新地图'))throw Error('无限模式续写没有回填');
  s.toggleImmersive();await Vue.nextTick();if(getComputedStyle(document.querySelector('[data-infinite-control="primary"]')).display!=='none')throw Error('无限模式沉浸未隐藏续写栏');
  s.toggleImmersive();await Vue.nextTick();if(getComputedStyle(document.querySelector('[data-infinite-control="primary"]')).display==='none')throw Error('无限模式退出沉浸未恢复');
  s.exitInfiniteMode();metrics.infinite=true;
  // 创建新书只继承设置，不继承旧书的 MOD 私有运行数据，这是原有隔离特性。
  if(mod.permissions.includes('storage:own'))s.setModPrivateData(id,'compatMarker',{value:'persist-'+id});
  s.chapters=[{id:'compat-chapter',title:'北港',content:'林舟在北港核对海图。沈禾检查潮汐与补给，然后在日志里记录次日航线。',summary:'船员核对海图并准备出航。',branchId:'main',versions:[],isExpanded:true}];s.currentChapterIndex=0;
}

if(id==='moyun.linxun.snowwing-pair'&&!s.isSnowwingPresetLocked())throw Error('白鸟锁定特性被破坏');
s.showSettings_modal=false;s.showConfirm=false;s.showPromptPreview=false;s.activeModModalKey='';s.saveData();return metrics;},pack);}
(async()=>{c=await require('./v16-r2-browser-session.cjs').connect(port,base);await c.navigate();await setup();
for(const pack of packs.filter(p=>p.data._type!=='moyun_mod_table_export')){
await record(pack.name,async()=>{await install(pack);const data=await exercise(pack);for(const width of [1280,390]){await c.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<768});await c.ev(()=>{__s.showSettings_modal=true;__s.activeSettingsTab='mods';});await c.delay(100);assert.equal(await c.ev(()=>document.documentElement.scrollWidth>innerWidth),false,pack.name+' overflow '+width);}await c.ev(()=>{__s.showSettings_modal=false;__s.saveData();});await c.delay(2500);const stored=await c.ev(async id=>{const raw=await DB.get('library_v6'),lib=typeof raw==='string'?JSON.parse(raw):raw;return{present:lib.modPacks.some(x=>x.id===id),marker:lib.modPrivateData[id]?.compatMarker?.value,clone:true};},data.id);assert.equal(stored.present,true);if(pack.data.permissions?.includes('storage:own'))assert.equal(stored.marker,'persist-'+data.id);return data;});
}
for(const pack of packs.filter(p=>p.data._type==='moyun_mod_table_export'))await record(pack.name+'（数据表文件识别）',async()=>{const d=await c.ev(data=>({error:__s.validateModPack(data),type:data._type,source:data.source}),pack.data);assert.ok(d.error);return{type:d.type,source:d.source,reason:'原始文件是数据表导出，完整宿主 MOD 未提供；不冒充完整包兼容通过'};});
assert.equal(c.errors.length,0,c.errors.join('\n'));fs.writeFileSync(path.join(__dirname,'../.ui-check/v16-r2-mod-results.json'),JSON.stringify({passed:true,results,errors:c.errors,limits:'AI 返回为离线模拟；未调用真实模型、向量或搜索服务'},null,2));console.log('MOD R2 PASSED:',results.length);c.ws.close();
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(__dirname,'../.ui-check/v16-r2-mod-results.json'),JSON.stringify({passed:false,results,errors:c?.errors,error:String(e)},null,2));c?.ws.close();process.exitCode=1;});
