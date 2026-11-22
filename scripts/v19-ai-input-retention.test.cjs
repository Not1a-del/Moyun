'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8').replace(/\r\n/g,'\n');
function fn(name){
 const start=source.search(new RegExp('    (?:async )?function '+name+'\\('));
 assert.ok(start>=0,name);const end=source.indexOf('\n    }',start);return source.slice(start,end+6);
}
const ref=value=>({value}),clone=value=>JSON.parse(JSON.stringify(value));
function context(names,extra={}){const ctx=vm.createContext({currentBookId:ref('A'),activeBranchId:ref('main'),aiInputDrafts:new Map(),deepClone:clone,showToast(){},...extra});vm.runInContext(fn('getAiInputDraftKey')+names.map(fn).join('\n'),ctx);return ctx;}
test('通用输入弹窗取消、提交后重开保留文字，并按书/分支/目标隔离',()=>{
 const c=context(['openInputPrompt','cancelInputPrompt','execInputPrompt'],{inputPromptDraftKey:'',inputPromptInitialValue:'',showInputPrompt:ref(false),inputPromptCfg:ref({}),inputPromptValue:ref(''),_inputPromptCb:null,nextTick(){}});
 const open=key=>c.openInputPrompt({draftKey:key,initialValue:'原始'},()=>{});
 open('rewrite:c1');c.inputPromptValue.value='作者修改：不清空。';c.cancelInputPrompt();open('rewrite:c1');assert.equal(c.inputPromptValue.value,'作者修改：不清空。');
 c.execInputPrompt();open('rewrite:c1');assert.equal(c.inputPromptValue.value,'作者修改：不清空。');
 open('rewrite:c2');assert.equal(c.inputPromptValue.value,'原始');
 c.activeBranchId.value='side';open('rewrite:c1');assert.equal(c.inputPromptValue.value,'原始');
 c.activeBranchId.value='main';c.currentBookId.value='B';open('rewrite:c1');assert.equal(c.inputPromptValue.value,'原始');
 c.currentBookId.value='A';open('rewrite:c1');assert.equal(c.inputPromptValue.value,'作者修改：不清空。');
 c.openInputPrompt({initialValue:'普通改名不留稿'},()=>{});assert.equal(c.inputPromptValue.value,'普通改名不留稿');
});
test('通用输入弹窗上游原文改变时采用新原文，不用旧草稿覆盖',()=>{
 const c=context(['openInputPrompt','cancelInputPrompt'],{inputPromptDraftKey:'',inputPromptInitialValue:'',showInputPrompt:ref(false),inputPromptCfg:ref({}),inputPromptValue:ref(''),_inputPromptCb:null,nextTick(){}});
 c.openInputPrompt({draftKey:'detailed:1',initialValue:'原来的要求'},()=>{});
 c.inputPromptValue.value='弹窗里补充';c.cancelInputPrompt();
 c.openInputPrompt({draftKey:'detailed:1',initialValue:'主输入区后来修改的新要求'},()=>{});
 assert.equal(c.inputPromptValue.value,'主输入区后来修改的新要求');
});
test('单个/批量角色重开保留描述和数量，切书与分支分别恢复',()=>{
 const c=context(['openAiCharacterInput','requestCloseAiCharacterModal','requestCloseBatchCharacterModal'],{characterInputScope:'',aiCharDesc:ref(''),batchCharPrompt:ref(''),batchCharCount:ref(3),showAiCharModal:ref(false),showBatchCharModal:ref(false),isGeneratingChar:ref(false),isGeneratingBatch:ref(false)});
 c.openAiCharacterInput();c.aiCharDesc.value='冷静的女剑客';c.requestCloseAiCharacterModal();c.openAiCharacterInput();assert.equal(c.aiCharDesc.value,'冷静的女剑客');
 c.openAiCharacterInput('batch');c.batchCharCount.value=7;c.batchCharPrompt.value='七名守灯人';c.requestCloseBatchCharacterModal();c.openAiCharacterInput('batch');assert.equal(c.batchCharPrompt.value,'七名守灯人');assert.equal(c.batchCharCount.value,7);
 c.currentBookId.value='B';c.openAiCharacterInput();assert.equal(c.aiCharDesc.value,'');c.aiCharDesc.value='B书人物';
 c.currentBookId.value='A';c.activeBranchId.value='side';c.openAiCharacterInput();assert.equal(c.aiCharDesc.value,'');c.aiCharDesc.value='支线人物';
 c.activeBranchId.value='main';c.openAiCharacterInput();assert.equal(c.aiCharDesc.value,'冷静的女剑客');assert.equal(c.batchCharCount.value,7);
 c.activeBranchId.value='side';c.openAiCharacterInput();assert.equal(c.aiCharDesc.value,'支线人物');
});
test('新书关闭重开保留最新表单、勾选和失败状态，创建成功后才初始化下一本',()=>{
 const c=context(['openNewBookModal','resetNewBookInput','requestCloseNewBookModal'],{newBookInputCompleted:false,newBookMode:ref('manual'),oneKeyPhase:ref('config'),showNewBook:ref(true),newBookForm:ref({theme:'原始主题',title:'我的书',worldView:'世界观'}),okCfg:{strictTheme:true,unfinishedMode:true},okSec:{settings:true,chars:true,outline:true,presets:true},newBookAdvancedOpen:ref(true),oneKeyFailureSnapshot:{bookId:'A'},oneKeyRetryTarget:'A',teamAppendMode:false,keepTeamDraftBeforeExit:()=>false,cancelTeamPlanner(){}});
 c.requestCloseNewBookModal();c.openNewBookModal();assert.equal(c.newBookForm.value.theme,'原始主题');assert.equal(c.okCfg.strictTheme,true);assert.equal(c.newBookAdvancedOpen.value,true);
 c.oneKeyPhase.value='done';c.requestCloseNewBookModal();c.openNewBookModal();assert.equal(c.oneKeyPhase.value,'done');assert.equal(c.oneKeyFailureSnapshot.bookId,'A');
 c.newBookInputCompleted=true;c.openNewBookModal();assert.equal(c.newBookForm.value.theme,'');assert.equal(c.oneKeyPhase.value,'config');assert.equal(c.oneKeyRetryTarget,'');
});
test('工作台要求切书/分支保留，重复恢复审阅不会清空新输入',()=>{
 const c=context(['restoreWorkbenchAiInputs'],{workbenchAiInputScope:'',settingsRevisionPrompt:ref(''),outlineInput:ref(''),doInput:ref('')});
 c.restoreWorkbenchAiInputs();c.settingsRevisionPrompt.value='设定要求';c.outlineInput.value='大纲要求';c.doInput.value='细纲要求';c.restoreWorkbenchAiInputs();assert.equal(c.outlineInput.value,'大纲要求');
 c.activeBranchId.value='side';c.restoreWorkbenchAiInputs();assert.equal(c.settingsRevisionPrompt.value,'');c.settingsRevisionPrompt.value='支线要求';
 c.currentBookId.value='B';c.restoreWorkbenchAiInputs();assert.equal(c.settingsRevisionPrompt.value,'');
 c.currentBookId.value='A';c.activeBranchId.value='main';c.restoreWorkbenchAiInputs();assert.equal(c.settingsRevisionPrompt.value,'设定要求');assert.equal(c.doInput.value,'细纲要求');
 c.activeBranchId.value='side';c.restoreWorkbenchAiInputs();assert.equal(c.settingsRevisionPrompt.value,'支线要求');
});
test('团队开书与各书续规划分别恢复想法、二次要求和手动方案',()=>{
 const refs={};for(const [k,v]of Object.entries({teamBrief:'',teamReplanInput:'',teamPlan:null,teamPlanRaw:'',teamPlanNeedsManual:false,teamBlocks:[],teamDraft:null,teamReview:null,teamRawView:'',teamPhase:'input'}))refs[k]=ref(v);
 const c=context(['activateTeamBookInput'],{...refs,teamPlanOptions:{unfinishedMode:false,chapterCount:10},teamInputScope:'',teamExistingBookId:'',teamAppendMode:false});
 c.activateTeamBookInput();c.teamBrief.value='新书想法';c.teamReplanInput.value='新的补充';c.teamPlan.value={titleCandidates:['手动改名']};c.teamPhase.value='review';
 c.activateTeamBookInput('A');assert.equal(c.teamBrief.value,'');c.teamBrief.value='A书下一段';c.teamPlanOptions.chapterCount=12;
 c.activateTeamBookInput();assert.equal(c.teamBrief.value,'新书想法');assert.equal(c.teamReplanInput.value,'新的补充');assert.equal(c.teamPlan.value.titleCandidates[0],'手动改名');assert.equal(c.teamPhase.value,'review');
 c.activateTeamBookInput('A');assert.equal(c.teamBrief.value,'A书下一段');assert.equal(c.teamPlanOptions.chapterCount,12);
 c.activeBranchId.value='side';c.activateTeamBookInput('A');assert.equal(c.teamBrief.value,'');
});
test('团队二次修改失败保留输入、再次请求不重复追加，成功仅清已发送版本',async()=>{
 const c=context(['retryTeamPlanner'],{teamBrief:ref('原始想法'),teamReplanInput:ref('补充要求'),teamPlanNeedsManual:ref(true),splitTeamPlan:async text=>{c.teamBrief.value=text;return true;}});
 await c.retryTeamPlanner();await c.retryTeamPlanner();assert.equal(c.teamReplanInput.value,'补充要求');assert.equal(c.teamBrief.value,'原始想法\n补充要求');
 c.teamPlanNeedsManual.value=false;await c.retryTeamPlanner();assert.equal(c.teamReplanInput.value,'');
});
test('章节AI编辑重开保留选段、要求和待审稿，正文变动后保留要求但丢弃旧定位',()=>{
 const c=context(['rememberAiEditInput','openAiEdit','requestCloseAiEditModal'],{aiEditDraftKey:'',visibleChapters:ref([{id:'c1',content:'第一段\n\n第二段'},{id:'c2',content:'其他章'}]),aiEditChapterIdx:ref(-1),aiEditParagraphs:ref([]),aiEditInstruction:ref(''),aiEditDiffs:ref([]),aiEditPhase:ref('select'),isAiEditing:ref(false),showAiEditModal:ref(false),_aiEditOriginalText:'',_aiEditNewText:'',cleanNarrativeChapterContent:ch=>ch.content});
 c.openAiEdit(0);c.aiEditInstruction.value='只改动作';c.aiEditParagraphs.value[1].selected=true;c.aiEditDiffs.value=[{type:1,text:'候选'}];c.aiEditPhase.value='diff';c._aiEditNewText='候选';c.requestCloseAiEditModal();c.openAiEdit(1);assert.equal(c.aiEditInstruction.value,'');c.openAiEdit(0);assert.equal(c.aiEditInstruction.value,'只改动作');assert.equal(c.aiEditParagraphs.value[1].selected,true);assert.equal(c.aiEditPhase.value,'diff');assert.equal(c._aiEditNewText,'候选');
 c.visibleChapters.value[0].content='正文已改';c.openAiEdit(0);assert.equal(c.aiEditInstruction.value,'只改动作');assert.equal(c.aiEditPhase.value,'select');assert.equal(c.aiEditParagraphs.value[0].selected,false);
});
