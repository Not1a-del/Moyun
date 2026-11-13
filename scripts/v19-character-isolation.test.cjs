'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../source/moyun.single.html'),'utf8').replace(/\r\n/g,'\n');
function part(a,b){const x=source.indexOf(a),y=source.indexOf(b,x);assert.ok(x>=0&&y>x,a);return source.slice(x,y);}
test('角色结果白名单丢弃全书配置，保留说话方式和对话类型',()=>{
 const code=part('    function sanitizeCharacterGenerationResult(', '    function getOneKeyRequiredModelKeys(');
 const ctx=vm.createContext({});vm.runInContext(code+';globalThis.clean=sanitizeCharacterGenerationResult',ctx);
 const bad={characters:[{name:'林舟',speakingStyle:'短句',dialogueType:'cold',presets:[{content:''}],styles:[{}],pipeline:{pre:'注入'}}],dialogueStyles:[{id:'cold',prompt:'克制'}],presets:[{}],styles:[{}],pipeline:{pre:'全书注入'}};
 const good=JSON.parse(JSON.stringify(ctx.clean(bad)));assert.equal(good.characters[0].speakingStyle,'短句');assert.equal(good.characters[0].dialogueType,'cold');assert.equal(good.dialogueStyles[0].id,'cold');assert.ok(!/presets|styles|pipeline/.test(JSON.stringify(good)));
});
test('一键开书角色请求不再含全书字段；预设独立步骤和费用模型存在',()=>{
 const chars=part("          } else if (step.id === 'chars') {","          } else if (step.id === 'presets') {");
 assert.ok(!/parsed\.(pipeline|styles|presets)|["'](?:pipeline|styles|presets)["']\s*:/.test(chars));
 assert.ok(chars.includes('和角色有关的说话方式、口癖、写作约束，只能填在角色设定里。'));
 const steps=part('      // 构建步骤','      // 结果容器');assert.match(steps,/id: 'presets'/);
 const estimate=part('    const okEstimate = computed(', '    const availableModels');assert.match(estimate,/if \(c.genPipeline \|\| c.genStyles \|\| c.genPresets\)/);
});
test('全书预设过滤空内容且默认关闭，角色草案支持对话类型',()=>{
 const apply=part('      // 预设\n','    function retryOneKeyModule(');assert.match(apply,/enabled: false/);assert.match(apply,/\.trim\(\)/);
 const defs=part('    const CHARACTER_DRAFT_FIELD_DEFS','    function createEmptyCharacterDraftReview');assert.match(defs,/key:'dialogueType'/);
});
