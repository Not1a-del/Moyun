# Moyun 接手说明

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
- 所有本地数据通过既有保存逻辑持久化；不要在测试中写入真实作品或 API Key。

## 版本和分支规则

当前文档版本：`v0.0.10`。

接手下一轮时：

1. 先读取 `AGENTS.md`、本文件、[UPDATE_LOG.md](./UPDATE_LOG.md) 和 [TEST_REPORT.md](./TEST_REPORT.md)。
2. 检查 `git status --short --branch`，确认没有覆盖用户未提交的修改。
3. 从上一稳定版本创建临时分支，例如 `temp/v0.0.10-v011-work`，再开始任何源码修改。
4. 每轮只把最后一位加 1，并在完成测试后更新日志和检测报告。
5. 需要回滚时使用对应分支/提交；不要使用 `git reset --hard` 或删除用户数据。

## 标准验证

```powershell
npm run build
node --check assets/js/moyun.js
git diff --check
```

涉及 UI 时，使用用户已打开的 Edge 页面进行桌面和 `390×844` 移动端检查。重点检查卷纲内部滚动、收起/单项展开、细纲按钮、Logo 资源、水平溢出和控制台错误。测试服务若确有必要，只使用系统已有 Node，测试完成后立即停止。

## 不可触碰内容

- `F:\yydcm129\codex 自用小说软件\图片和文件\绘图风格2.0.txt` 是用户提供的示例文件，严禁修改。
- 不得未经明确授权下载软件、安装依赖、发送真实 API 请求或上传用户作品。
- 不要把 API Key、Token、真实作品或浏览器导出数据写进仓库。

## 交付格式

每轮最终交付必须说明：版本号、临时分支/提交、更新说明、测试方法和结果、已知风险、回滚位置，以及示例文件未修改的确认。
