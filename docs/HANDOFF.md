# Moyun 接手说明

## v0.0.15 发布复核（2026-09-23）

用户已授权上传；release/v0.0.15-0923 为干净发布分支，fix/v0.0.15-final-checks 为保留用户本地修改的主目录分支。主目录及发布副本分别通过 23 组协议、15 项业务浏览器、17 项二轮补写、8 项公告和结构审计；详情见 TEST_REPORT.md 顶部。本次运行时代码未再变更，版本和公告保持 0.0.15 / 0923。下文为此前阶段记录，线上发布状态以最新回执为准。

## v0.0.15 本地更新（2026-09-23）

当前主工作区已同步 v0.0.15，未上传；直接使用根目录 index.html 或 source/moyun.single.html。分支为 fix/v0.0.15-main-workspace，删除功能的稳定代码提交为 8abdf43。用户原有 AGENTS.md 和模板修改已恢复为未提交状态，本地构建与当前模板一致。独立副本 .ui-check/fix-v0.0.15 保留作稳定参考，不再是唯一交付位置。

2026-09-23 补正：上一轮只更新独立副本，主目录仍为旧版本，这是用户仍看到抗截断开关的原因。主目录同步前备份在 .ui-check/backup-main-v15-20260923，含文件清单/哈希与用户改动 stash；基线分支 backup/main-before-v15-20260923。今后交付必须核对实际使用入口，不能仅验证副本。基线 0922 稳定发布 94b787b 及 backup/v0.0.15-base-94b787b 仍保留。

- 文本请求统一使用buildAdapterRequest与fetchAiAdapterResponse，不直接fetch适配请求；模型连接测试、图片、向量、搜索API有独立协议。
- Gemini 抗截断入口、模型自动开关、output_reply 工具声明/强制选择/提示词/解码和专属重试已移除。旧存档的开关字段不再被读取；普通流式设置仍生效。
- 保留普通 JSON/SSE 传输校验、取消和空闲超时。OpenAI、Gemini、Anthropic 仍使用各自普通文本协议；错误、过滤和限长不作为成功结果保存。
- parseAiStructuredJson只处理AI业务JSON，不能用于存档导入或API传输；不补造缺失闭合，修复后仍做业务校验，角色保持审阅。
- 工作台补充实时预览后才填字段；createWorkbenchStreamFiller保留调用签名，不再通过onField提前写半截资料。
- 补写复用adapterInit.wireMessages，再追加首轮正文与续写要求，提醒幂等。不要恢复“必然命中缓存”的表述。
- 页面公告按本轮指令为「0923更新」，使用新已读标识，只保留 JSON 改进说明，无版本号和抗截断说明。上传前仍需用户授权。
- npm run regress 已串联 23 组协议测试；node scripts/ai-browser-smoke.cjs 9235 完成 15 项浏览器检查，node scripts/announcement-browser-smoke.cjs 完成 8 项公告检查。脚本只用于独立测试档案，不能接日常浏览器。两款模型真实调用 4/4 通过，具体范围见 TEST_REPORT.md。

## 项目定位

Moyun 是本地优先的纯前端长篇小说写作工作台。书籍、章节、正文、设定、角色、卷纲、细纲、资料条目和事件时间线保存在浏览器存储中；模型接口由用户在连接中心自行配置。项目不依赖自有后端，静态入口可部署到 GitHub Pages。

## 源码与构建

- 唯一业务源：[source/moyun.single.html](../source/moyun.single.html)
- 构建脚本：[scripts/build-static-site.cjs](../scripts/build-static-site.cjs)
- 生成入口：`index.html`
- 生成样式：`assets/css/moyun.css`
- 生成逻辑：`assets/js/moyun.js`
- 构建命令：`npm run build`
- 回归检查：`npm run regress`（v0.0.10 新增 `scripts/regression-check.cjs`：构建 + 语法 + 锚点 + 卷纲/流式解析单元断言 + 字数硬限与比例抽样）

不要直接编辑 `index.html` 或 `assets/` 下的生成文件。修改 `source/moyun.single.html` 后再构建。

## 关键运行结构

- Vue 3 通过 CDN 加载，应用逻辑集中在单文件源的内联脚本中。
- `novel.value` 保存当前书籍，`novelVolumes` 保存卷纲，`activeVolumeEditor` 控制卷纲放大编辑。
- 生成正文、大纲、细纲、评论和工作台补充时，会通过上下文构建逻辑注入设定、资料、事件和卷纲边界。
- `toggleNovelVolumeCollapsed` 管理卷纲全局/单项折叠；v0.0.7 修复了全局收起后单项展开。
- v0.0.9 新增 `novelVolumesBoardMinimized`：卷纲板“整体收起”状态（收起后仅一条摘要行 + 展开卷纲按钮），与逐卷折叠状态相互独立；大纲生成提示词要求模型输出【卷纲更新】小节，由 `applyAiVolumeUpdates` 回填。
- v0.0.10 【卷纲更新】升级为“卷头行 + 逐章一行（第M章：一句话大纲）”：章行归属最近的既有卷头，卷摘要 = 框架摘要 + 章行拼接（上限 2000 字，120 字上限已移除）；旧格式兼容。
- v0.0.10 工作台 AI 补充走 `createWorkbenchStreamFiller`（基于 `extractStreamFieldValue`）逐字段流式回填，只填空白字段，完成后仍整段解析校验；事件 AI 补充按 3 章一批循环读全文、按章号插入时间线；细纲预算默认 = 所选正文字数 ÷ 4.5（用户实测 1:4~1:5 的中值，已替换旧 6% 启发式）。
- v0.0.10 补充轮（版本号不变）：事件顶栏按钮为“全文时间线补充”（锚点 `data-story-event-ai-full`），点击不再直接补充，而是弹范围弹窗（`storyEventRangeCfg.from/.to` + `openStoryEventRangePrompt/execStoryEventRangePrompt/cancelStoryEventRangePrompt`，弹窗锚点 `data-moyun-modal="story-event-range"`）；全局 `aiSupplementSegmentProgress` 驱动 8 处补充按钮下方“已补充到第 X/Y 段”小字，任务开始与结束（含失败）都会清空，勿在多处同时写入；事件提示词要求 `timeText` 准确反映正文时间点，完成后按 `sortOrder` 稳定重排（无章号事件排末尾）。
- v0.0.10 事件编辑网格为比例列（`minmax(0,1.6fr) minmax(0,.6fr) minmax(0,.7fr)`）+ 全字段 `min-width:0`，不要恢复固定 150px/170px 列。
- v0.0.11 台词示例走 `normalizeStringList(value, maxLen, 'dialogues')` 整句模式（换行分条、句末标点断句、逗号/顿号不拆）；性格标签等其他列表字段仍用默认 `'tags'` 模式。给台词类新增列表字段时必须传 `'dialogues'`。
- v0.0.11 细纲批量生成流式落卡：`onTextDelta` → `applyDetailedOutlineStreamDelta(full, batch, onlyEmpty)` → `ensureStreamedChapterCard`（补齐卡片并展开）。`onlyEmpty` 用 `chapterOutlines` 卡片上的临时 `_streamed` 标记防覆盖，批次合并后与 finally 块都会清理——新代码不得依赖该标记持久存在。最终整段解析校验逻辑不变。
- v0.0.11 大纲/单章细纲/批量细纲发送后输入框不再自动清空；唯一清空入口是用户显式点“放弃修改”（`discardDetailedOutlineNavigationDraft`）。不要把“发送成功后清输入”加回去。
- v0.0.11 正文图片重试按钮：`.img-retry`（30px、半透明、PC 悬停显示/触屏常驻）+ `data-img-action="retry-regen"` 全局委托 → 二次确认 → `regenerateInlineImage(cacheKey, tag)`。新增图片操作时复用同一委托机制。
- v0.0.11 事件时间线自动补录开关：`settings.autoTimelineSupplement`（默认 true），门控在 `updateStoryMemoryFromChapter`（运行时即时读取，交错开/关各自生效）；UI 两处共用：事件工作台 `data-story-event-auto-toggle`、设置-上下文页 `data-settings-auto-timeline`，切换函数 `toggleAutoTimelineSupplement`。
- v0.0.11 大书序列化：`buildLibrarySnapshot` 用 `snapshotForSerialize`（浅结构展开、叶子引用共享、>12 层回退 JSON 深拷贝）代替 `deepClone`；其消费方只允许 `JSON.stringify` 或只读，不得在快照对象上做会写回运行时的变更。
- v0.0.13 保存链路瘦身：`syncBookData`（每次保存含 2s 防抖）、`saveSnapshot`、`performExportBookFullBackup`、角色草案回滚快照、`saveBookEditor` 回滚副本全部改用 `snapshotForSerialize`（值等价+叶子共享）；`loadBook` 的 deepClone 保留（运行态与 `books[]` 隔离，勿删）。给 books 里塞新字段时在 `syncBookData` 用 `snap()` 包装即可，不要改回 `deepClone`。
- v0.0.13 二轮补写：`settings.secondRoundSupplementEnabled`（默认 true）门控 `requestShortfallSupplement`（关闭返回 `skippedBySwitch`，不计入"已尝试二轮"）；设置-上下文页开关锚点 `data-settings-second-round-toggle`、切换函数 `toggleSecondRoundSupplement`。`CONNECTION_MODULE_KEYS` 新增 `supplement`：未显式分配时 `resolveModuleConnection` 内联跟随 writing 配置（含可用性检查），`getSupplementFollowProfile` 供 UI 显示；二轮消息走 `msgs.concat` 保持与首轮前缀逐字节一致以命中厂商缓存——改这块时不要重建消息数组，只能往后追加。
- v0.0.13 生图默认渠道：`naiCallMode` 默认 `rphub`（增强），加载条件只认显式 `'canary'|'rphub'` 存档值；不要放宽为 `if (data.naiCallMode)`，否则旧档案缺失字段时会误恢复 Canary。
- v0.0.13 NSFW 预设分组：`builtinSystemPromptCards` 数组不变，展示用 `getNsfwOnlyBuiltinPromptCards()`（nsfwCore/nsfwPrelude）与 `getNonNsfwBuiltinPromptCards()`（discussion/oneKey/image/avatar，渲染在 `data-moyun-builtin-prompts-secondary` 分区）两个视图函数；编辑/恢复默认仍走原函数。rp6 新规则补丁在 `normalizeBuiltinPresets` 里按关键词 `includes` 只补缺失项，勿改成整段覆盖。
- v0.0.12 结构审计：`npm run audit`（`scripts/structure-audit.cjs`）静态解析模板区（`#app` 到 `</body>`，剥 script/注释），断言标签栈平衡（跨层闭合即 FAIL）、全部 `v-else`/`v-else-if` 与前一兄弟 `v-if` 配对（img 等 void 标签计入兄弟）、`moyun-character-editor-head` 开闭平衡且与 `moyun-character-levels` 同级、`transition`/`transition-group`/`template` 开闭一致。`npm run regress` 已串联该审计；改模板后必须先过审计再交付（AGENTS.md 硬规）。
- v0.0.12 历史教训（防复发）：v0.0.10 `038b967` 在 editor-head 里把单行按钮区拆成两层嵌套 flex 时少写 1 个 `</div>`，浏览器把后续兄弟全部吞进 flex 行，卡片挤成 26~30px 竖条，而文档总宽不变——横向溢出检测恒绿、功能点击恒绿，照常上线（线上 v0.0.10 至今带病）。任何"拆嵌套行"的模板改动，改完必须数闭合；遇"卡片挤细条/面板变窄/空态同屏"先跑 `npm run audit`，再查 CDP 运行时 DOM，最后才查 CSS（长文本撑宽、MOD 污染都是相似表象的错误方向）。
- 所有本地数据通过既有保存逻辑持久化；不要在测试中写入真实作品或 API Key。

## 版本和分支规则

当前文档版本：`v0.0.15`（本地，未上传）。

接手下一轮时：

1. 先读取 `AGENTS.md`（含 v0.0.12 新增的"结构级坑与精准排障手册"一节）、本文件、[UPDATE_LOG.md](./UPDATE_LOG.md) 和 [TEST_REPORT.md](./TEST_REPORT.md)。
2. 检查 `git status --short --branch`，确认没有覆盖用户未提交的修改。
3. 从上一稳定版本创建临时分支，例如 `temp/v0.0.13-v014-work`，再开始任何源码修改。
4. 每轮只把最后一位加 1，并在完成测试后更新日志和检测报告。
5. 需要回滚时使用对应分支/提交；不要使用 `git reset --hard` 或删除用户数据。

## 上传与公告规则（2026-09-14 起）

- 用户 `yydcm-129` 已是上游 `Not1a-del/Moyun` 的协作者（写权限，2026-09-14 只读核验 `permissions.push=true` + collaborators 204）。**上传流程改为直接推上游 main，不再走 PR**（2026-09-14 用户指令）；无上传指令时交付默认只做本地提交。
- 只有用户明确要求上传时才上传（AGENTS 硬规：上传前必须经过用户同意，且上传需要更新网页内的更新公告）。上游 main 推送用 `upstream` 远端（`https://github.com/Not1a-del/Moyun`）+ `.ui-check/.gh-token`；先 fetch upstream/main、rebase/merge 后再推，推送前必过 `npm run audit` 与浏览器公告验证。
- 页面内更新公告是单份覆盖式常量 `WEB_UPDATE_ANNOUNCEMENT`（source/moyun.single.html ~8099）：换新 id 即对已读旧公告的老用户重弹；标题只记录四位数字日期（如「0914更新」），不展示版本号；全新浏览器先弹 `MOYUN_FIRST_RUN_GUIDE` 再弹公告。写公告时用 `tone:'new'/'extra'/'fix'` 区分条目边色，`kind:'group'` 做分组头；计费相关表述只写「计费以服务商为准」，不做折扣解释。

## 标准验证

```powershell
npm run build
node --check assets/js/moyun.js
npm run audit
git diff --check
```

涉及 UI 时，使用用户已打开的 Edge 页面进行桌面和 `390×844` 移动端检查。重点检查卷纲内部滚动、收起/单项展开、细纲按钮、Logo 资源、水平溢出和控制台错误。模板改动后必须跑 `npm run audit`（结构审计：标签平衡 + v-else 配对 + 关键锚点），审计不过禁止交付；交付前再做"空白角色 + 超长无空格文本"双用例几何实测（关键卡片宽度 ≥ 容器 80%）。测试服务若确有必要，只使用系统已有 Node，测试完成后立即停止。

## 不可触碰内容

- `F:\yydcm129\codex 自用小说软件\图片和文件\绘图风格2.0.txt` 是用户提供的示例文件，严禁修改。
- 不得未经明确授权下载软件、安装依赖、发送真实 API 请求或上传用户作品。
- 不要把 API Key、Token、真实作品或浏览器导出数据写进仓库。

## 交付格式

每轮最终交付必须说明：版本号、临时分支/提交、更新说明、测试方法和结果、已知风险、回滚位置，以及示例文件未修改的确认。
