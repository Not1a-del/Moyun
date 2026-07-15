# Moyun 网页版完整开发与 MOD 共创接口指南

> 适用仓库：`Not1a-del/Moyun`（GitHub Pages 网页版）
> 权威实现：本仓 `source/moyun.single.html`
> MOD API：`1.1`（仅承诺主版本 `1` 兼容）
> 文档状态：2026-07-15，根据当前 `main` 分支源码整理

这是一份给网页维护者、测试者、MOD 作者和协作 AI 使用的完整手册。它描述的是**当前网页版真实运行方式**，而不是历史离线包的设计设想。任何实现、评审或发布决策与本手册冲突时，应先回到本仓 `source/moyun.single.html`、`scripts/build-static-site.cjs` 和近期提交核对，再更新本文档。

## 目录

1. [先读：边界、术语与维护原则](#先读边界术语与维护原则)
2. [仓库、开发与构建](#仓库开发与构建)
3. [发布、验收与回滚](#发布验收与回滚)
4. [网页运行架构与功能地图](#网页运行架构与功能地图)
5. [本地数据、备份、导入导出与隐私](#本地数据备份导入导出与隐私)
6. [连接中心、模型路由与协议适配](#连接中心模型路由与协议适配)
7. [上下文、生成、弹窗与公告维护](#上下文生成弹窗与公告维护)
8. [MOD API 1.1：概念、包格式与校验](#mod-api-11概念包格式与校验)
9. [MOD 权限、规则、模块、设置与资产](#mod-权限规则模块设置与资产)
10. [MOD UI、资料表、AI 工具、工作流与事件](#mod-ui资料表ai-工具工作流与事件)
11. [主题与白鸟 Skill 的信任模型](#主题与白鸟-skill-的信任模型)
12. [MOD 测试、排错、兼容与发布清单](#mod-测试排错兼容与发布清单)
13. [附录：可导入的最小示例](#附录可导入的最小示例)

---

## 先读：边界、术语与维护原则

### 唯一写入源

工作区的离线 `单文件版/` 已冻结。网页功能、网页文档和 Pages 发布的唯一可写源是本独立仓：

```text
单文件版/output/deploy-staging/
```

不要把任何离线宿主 HTML、白鸟 JSON、纯净版、交付包或历史测试产物复制回本仓；也不要用它们覆盖网页源码。离线资料只能作为**只读历史参考**。尤其是旧版 MOD 文档中“所有 MOD 都不执行 CSS/JS/HTML”“旧品牌/旧版本号”“以某个离线 HTML 为发布锚点”等表述，均不能直接用于网页维护。

### 术语

| 术语 | 本文含义 |
| --- | --- |
| 网页版 / 在线版 | 本仓构建并由 GitHub Pages 部署的静态单页应用。 |
| 源文件 | `source/moyun.single.html`，唯一允许修改的应用源。 |
| 生成物 | 根目录 `index.html`、`assets/css/moyun.css`、`assets/js/moyun.js`；由构建器生成，禁止手改。 |
| 连接中心 | 用户在浏览器内维护 API 配置、密钥、模型及模块路由的唯一运行时配置中心。 |
| Profile / 配置 | 连接中心的一条 API 配置；一个配置只对应一个模型。 |
| 模块路由 | 某个功能模块明确绑定到一个 Profile 的关系。 |
| MOD | JSON 声明式扩展包；普通 MOD 默认不执行任意脚本。 |
| Hosted View | 由宿主用组件白名单渲染的安全 MOD 视图，不是 HTML 插件页面。 |
| Full Access | 主题或 Skill 的高风险能力；可能执行 CSS/HTML/JS 或访问宿主页上下文，须明确确认。 |

### 不变量

- 网页没有应用后端，也没有服务器端 API 代理。浏览器会直接请求用户填入的第三方模型地址，因此供应商必须允许浏览器跨域（CORS）。
- 用户数据和密钥默认留在用户自己的浏览器存储中；这不等于“绝不外发”。当用户点击生成时，相应提示词、正文片段和资料会发送给其选定的 API 服务商。
- 新功能应优先做成宿主白名单能力，再让 MOD 用 JSON 声明调用；不要把外部脚本执行作为普通扩展方案。
- 一个显式模块路由一旦配置失败，必须暴露该配置/上游的错误，**不能**偷偷改用默认配置或另一把 Key。
- 所有修改前先查看 `git status`。本仓可能保留历史截图、脚本和日志等未跟踪内容；本轮无关文件不得暂存、删除或格式化。

---

## 仓库、开发与构建

### 目录地图

```text
Moyun/
├── source/
│   └── moyun.single.html        # 唯一应用源：模板、样式、Vue 运行逻辑
├── scripts/
│   └── build-static-site.cjs    # 静态拆分构建器
├── assets/
│   ├── css/moyun.css            # 生成物，禁止手改
│   ├── js/moyun.js              # 生成物，禁止手改
│   └── favicon/moyun.svg        # 网页图标资产
├── docs/
│   ├── DEPLOYMENT.md            # 精简部署说明
│   └── ONLINE_VERSION_COMPLETE_DEVELOPER_GUIDE.md
├── index.html                   # 生成的 Pages 入口，禁止手改
├── package.json
├── README.md
└── LICENSE
```

需要 Node.js 与 Git。`package.json` 当前只有一个脚本：

```powershell
npm run build
```

不要假设仓库存在 npm dev server、TypeScript 编译、框架 CLI 或 GitHub Actions；当前都没有。需要本地查看时，用任意静态 HTTP 服务器服务仓库根目录即可。直接双击 HTML 可能受浏览器本地文件策略和第三方 API CORS 限制。

### 构建器的真实行为

`scripts/build-static-site.cjs` 会：

1. 读取 `source/moyun.single.html`。
2. 强制确认其中**恰好一个** `<style>` 和**恰好一个**无 `src` 的应用 `<script>`；多出或缺失都会构建失败。
3. 将 CSS 与 JS 分别写入生成资产。
4. 对各自产物计算 SHA-256，取前 12 位，写进 `index.html` 的 `?v=` 查询参数，作为缓存指纹。
5. 在生成文件顶部标记来源，提醒不要直接编辑。

因此一次正常的应用改动最小步骤是：

```powershell
# 1) 只编辑 source/moyun.single.html
npm run build

# 2) 先检查生成差异，再按本次范围暂存
git diff --check
git status --short
git diff -- source/moyun.single.html index.html assets/css/moyun.css assets/js/moyun.js
```

文档改动无需重新构建，但在同一提交中混有应用改动时仍应运行构建。绝不可为了“快速修复”直接改生成的 CSS、JS 或 `index.html`：下一次构建会覆盖它们，也会使源码与线上实际不一致。

### 依赖与供应链边界

应用通过 CDN 使用 Vue 3 global、Tailwind CSS、Marked、diff-match-patch 与 Google Fonts。它们没有被本仓打包和锁定。维护者改动页面加载方式、离线能力或 CSP 前，应评估：网络不可用、CDN 内容变化、地区网络失败、第三方脚本供应链和字体回退。`LICENSE` 只覆盖 Moyun 原创内容，不替代第三方依赖各自的许可证。

---

## 发布、验收与回滚

### 当前部署

| 项目 | 值 |
| --- | --- |
| 仓库 | `Not1a-del/Moyun` |
| 发布分支 | `main` |
| 发布目录 | 仓库根目录 `/` |
| 线上地址 | <https://not1a-del.github.io/Moyun/> |
| 构建来源 | GitHub Pages 仓库设置；当前没有仓内 Actions 工作流。 |

### 标准发布流程

1. 在任务日志里写清目的、范围、验收项与“不得触碰”的已修复范围。
2. `git status --short`，识别既有未跟踪文件；它们默认属于其他历史工作。
3. 只修改 `source/moyun.single.html` 或本次需要的文档。若改应用，运行 `npm run build`。
4. 运行与变更匹配的自动回归，至少执行 `git diff --check`。涉及 JS 时可额外执行 `node --check assets/js/moyun.js`（构建后）。
5. 本地人工检查桌面与窄屏手机视口，查看控制台错误、关键路径、弹窗关闭策略和页面横向溢出。
6. 只 `git add` 明确列出的文件；不要使用无差别的 `git add .`。
7. 提交一个描述范围的提交，推送 `main`。
8. 等待 GitHub Pages 构建，硬刷新线上页面，复验与本轮有关的路径。记录提交 SHA、校验内容与线上结果。

示例（请按真实文件替换）：

```powershell
git add README.md docs/ONLINE_VERSION_COMPLETE_DEVELOPER_GUIDE.md output/本轮执行日志.md
git commit -m "docs: add complete online development guide"
git push origin main
```

### 回滚

- **文档或静态页面错误**：优先用一个新的、可追踪的 revert 提交回滚已发布提交，再推送 `main`。
- **尚未提交的错误**：只撤回自己明确编辑的文件；不使用 `git reset --hard`，不覆盖他人的未跟踪输出。
- **数据兼容风险**：先停止发布，保留可复现资料和浏览器备份；不能以离线冻结文件整体覆盖网页源。
- **主题/Skill 高风险包导致页面异常**：使用“主题安全模式”设置或 URL `?safeTheme=1` 进入恢复路径，关闭/删除有问题的包，再导出诊断信息。

### 最小线上验收

- 首页能完成加载，控制台无新的 Vue/语法错误。
- 刷新后 CSS/JS 缓存指纹与新提交一致，不是浏览器旧资产。
- 桌面与约 `390px` 宽手机视口均可访问关键按钮、弹窗和底部内容，无横向溢出。
- 若改连接中心：配置、测试、切换模型、显式模块路由和失败不回退均已验证。
- 若改生成/弹窗：点击背景、Esc、X 与“中断生成”符合该弹窗声明的关闭策略，不会误中断仍在运行的任务。
- 若改公告：首次用户、新手说明已读用户、已读旧公告用户都按预期只看到一次。

---

## 网页运行架构与功能地图

### 单页架构

Moyun 是 Vue 3 的单页应用，主体使用 `createApp({ setup() { ... }})`。模板、样式和运行逻辑现在同置于源文件；构建时只做静态拆分，不改变逻辑。没有服务端账户、云同步或后端数据库。

主要响应状态包括书架与当前书、章节、结构化角色、设定、梗概/大纲/细纲、设置、连接中心及本机凭据、预设/文风/流水线、MOD 与其私有数据、快照、生图、评论和上下文工具等。修改状态时应使用既有的保存链路，避免只更新可见 UI 却漏掉重载后的持久化。

页面挂载后会初始化主题、读取本地数据；加载动画约 2 秒后退出，并在后续阶段检查紧急备份、打开新手说明或更新公告、触发 `appReady` 事件处理器。窗口尺寸、`visualViewport`、键盘和 `beforeunload` 都有监听；关闭页面前会尽力同步保存，并写一份轻量紧急备份。

### 功能地图

| 区域 | 主要职责 | 维护注意点 |
| --- | --- | --- |
| 书架 | 新建、切换、管理书籍与分支 | 书级数据必须隔离，不能把上一书 MOD 私有资料带入下一书。 |
| 设定、角色 | 世界观、人物资料、创作材料 | 内容可能进入用户配置的 AI 上下文。 |
| 大纲、目录、总结、查找 | 规划、章节浏览与检索 | 大纲和细纲生成/解析要按当前重构格式做成功门禁。 |
| 预设 | 文风、提示词流水线等创作偏好 | 白鸟等 MOD 的隔离/注入规则不得被宿主预设误覆盖。 |
| 全局设置 / 连接中心 | Profile、模型、模块路由、测试和无密钥方案 | 网页运行时只认连接中心。 |
| 全局设置 / 上下文 | 上下文与模块相关配置 | “模块模型分配”必须呈现连接中心配置名，不应把 MOD 侧栏工具伪装成模型模块。 |
| 全局设置 / 集中编辑、插件、生图、关于 | 批量编辑、MOD、图片、项目说明与支持入口 | 保持关于页、首开说明、公告内容的来源清晰。 |

### 弹窗与可访问性约定

统一弹窗协调器会处理顶部焦点、焦点陷阱、背景 `inert/aria-hidden`、页面滚动锁、Esc 与浏览器历史哨兵。新增弹窗应遵循现有 `data-moyun-modal` / `data-moyun-modal-panel` 约定，而不是另造一套蒙层。

关闭策略必须显式设计：设置类窗口通常只允许 X 或 Esc 关闭；生成中或需要确认的窗口可标记为锁定，不得因误点空白而关闭/中断。公告允许背景、Esc、X 关闭。任何新弹窗都要测试键盘焦点、移动端居中、短屏滚动、底部浏览器安全区和点击背景的行为。

---

## 本地数据、备份、导入导出与隐私

### 持久化层

| 数据 | 位置 | 兜底 / 限制 |
| --- | --- | --- |
| 主作品库 | IndexedDB `NovelWriterV6`，store `kv`，主键 `library_v6` | IndexedDB 不可用时使用 `localStorage` 前缀 `_nw6_`。 |
| 连接凭据 | 同一主库中的独立键 `connection_credentials_v1` | Profile 只保存 `credentialRef`，不直接保存可见 Key。 |
| 图片缓存 | IndexedDB `NovelImageCacheV1` / `images` | 浏览器清理站点数据会一并丢失。 |
| 快照 | IndexedDB `NovelSnapshotsV6` / `snaps` | 每本书界面最多展示最近 30 条。 |
| 紧急备份 | `localStorage`：`_nw6_emergency_backup_<bookId>` | 保存当前书的精简数据与最近 3 章，用于异常恢复。 |
| 公告已读、主题信任、浮窗位置等 | `localStorage` | 是设备/浏览器级状态，不可当作服务端账号状态。 |

普通编辑通过防抖保存；关键操作走即时保存。持久化会先落紧急备份，再保存凭据与主库，成功后删除同书紧急备份。恢复时只合并匹配的书籍并检查差异，避免把另一部作品误写回来。

### 导入、导出与密钥

- **书籍 JSON**：导出当前书的创作、MOD 和图片相关数据；不包含 `connectionCenter`、`connectionCredentials`、全局设置和 `imageGenKey`。
- **TXT**：只包含文本内容。
- **连接方案**：只导出配置名、协议、地址、模型和模块路由；导入时会拒绝包含 `apiKey`、`credential`、`authorization`、`x-api-key` 等敏感字段的方案文件。
- **普通快照**：主要用于本地恢复，不能当成对外分享的脱敏备份。当前历史设置中仍可能存在 `apiKey` 字段，生图 Key 也可能位于本地快照。因此不要上传、提交或转发未审计的浏览器导出/快照。

### 隐私与安全告知

1. 不把 API Key、Token、作品正文、浏览器数据库导出、带个人信息的日志或截图提交到 Git。
2. 使用公共电脑、共用浏览器档案或不可信扩展时，站点本地数据仍有被本机其他软件读取/导出的风险。
3. 调用模型时，浏览器会把该功能构建出的上下文发送给用户选定的上游服务。MOD 的 AI 工具同样由宿主代发，不是本地离线推理。
4. 导入第三方 MOD、主题和 Skill 前，要核验作者、包 ID、版本、权限与高风险说明；对未知来源保持禁用。

---

## 连接中心、模型路由与协议适配

### 核心约束

连接中心版本为 `3`，是网页当前唯一的请求配置来源。旧的散落 API 字段只承担迁移或兼容用途，**不得**为新功能新增第二条调用链。

一个 Profile 只允许一个 `defaultModel`，模型目录也归一为这一个模型。上游同一把 Key 有 GLM、Gemini 等多个模型时，应使用“派生模型”创建多个 Profile：它们可复用协议、地址、本机 Key 与已通过的连接测试，但每个 Profile 各自选择一个模型。这是防止“界面改成 Gemini，实际请求仍带 GLM”问题的必要数据结构。

### 支持的模板与适配器

| 新建模板（UI 顺序） | 内部 adapterId | 请求方式 |
| --- | --- | --- |
| OpenAI 兼容接口 | `openai-compatible` | Bearer + Chat Completions。 |
| OpenAI Chat | `openai-chat` | Bearer + Chat Completions。 |
| Anthropic | `anthropic-messages` | `x-api-key` + `/messages`。 |
| Gemini | `gemini-generate` | 模型 URL 传 Key + `generateContent` / SSE。 |
| 自定义 | 选择受支持的适配器 | 不能绕过适配器白名单。 |

地址输入可为根地址、`/v1`、`/chat/completions` 或模型列表地址；系统会清理端点尾缀并补足 `/v1`。这项容错不代表所有中转站路径都可推断：遇到非标准地址，应以 Profile 测试和实际请求为准。

### Profile 的有效条件

一个配置只有同时满足下列条件才可作为默认或路由目标：已启用、协议受支持、地址存在、本机凭据存在、默认模型存在、并且 `lastTest.status === 'ok'`。连接测试与模型验证是不同概念：改模型会让模型验证失效，但不会无故清掉连接测试；随后请求会实时读取保存后的 `defaultModel`。

### 模块路由

允许路由的模块 key：

```text
writing, settings, character, imagetext, outline,
suggestion, review, summary, comments, translate
```

运行时必须通过：

```js
resolveModuleConnection(moduleKey)
getModuleRequestConfig(moduleKey)
buildAdapterRequest(request, messages, options)
fetchAdapterCompletion(request, messages, options)
```

来解析与发送请求。新功能不得自己读取旧 `settings.apiKey`、全局模型字段或另一个 Profile。

路由规则如下：

1. **显式绑定**：只使用该 Profile。配置不存在、停用、未测试、缺 Key、缺模型、协议不支持或上游返回错误时，直接显示对应错误；不回退默认配置、更不尝试别的 Key。
2. **跟随默认**：先使用 `defaultProfileId` 指向且有效的 Profile；若它无效，则取列表中第一个连接测试成功的有效 Profile。
3. **没有有效默认**：提示用户先新建并测试 API 配置；不发送猜测性的请求。
4. **模块模型分配 UI**：展示并选择连接中心配置名，不使用遗留 `settings.moduleModels` 当作真正路由。MOD 的 `setHostModuleModel` / `clearHostModuleModel` 目前只会写旧兼容字段，**不能**作为网页版 API 路由配置方法。

### 四类请求负载

| 协议 | 认证与端点 | 请求体要点 |
| --- | --- | --- |
| OpenAI / Compatible | `Authorization: Bearer <key>`，`/chat/completions` | `{model,messages,stream,temperature,max_tokens?}` |
| Anthropic | `x-api-key`、`anthropic-version: 2023-06-01`，`/messages` | system 消息合并为 `system`，另传 `model/messages/max_tokens/stream/temperature`。 |
| Gemini | URL `/models/<encode(model)>:generateContent` 或 `streamGenerateContent`，Key 在 query | `contents`、`generationConfig`，system 消息转为 `systemInstruction`；流式增加 `alt=sse`。 |

响应解析同样经过统一适配层；不要让业务模块自行假定 `choices[0].message.content`。错误应保留上游 HTTP 状态、可显示信息和明确模块来源，但不能在 toast、日志或 UI 中泄露 API Key。

### 连接中心修改后的验收

- 同一 Key 建两个派生配置，分别选 GLM/Gemini，两个请求体的 `model` 必须分别正确。
- 在同一配置中改模型、保存后重新调用，观察请求 `model` 已更新。
- 切换不同配置，地址、Key、模型和协议都随路由切换。
- 给模块绑定一个错误/429 配置，确认错误直接返回，不回退默认 Profile。
- OpenAI、Anthropic、Gemini 的模型发现/测试和文本请求各至少实测一个可用样本。
- 桌面与手机上配置弹窗无横向溢出，获取模型后只能单选。

---

## 上下文、生成、弹窗与公告维护

### 上下文与生成门禁

生成功能应使用对应模块的 `getModuleRequestConfig`，并在发请求前检查有效连接。AI 返回内容要经过既有清洗和响应门禁：排除思维链/诊断泄漏，识别空文本与 token 截断，满足功能要求后才写入正文、大纲、细纲、摘要或资料表。不得把“收到 HTTP 200”直接当作生成成功。

白鸟导入后，宿主预设区可被锁定/蒙版显示；这只影响其预设提示词是否参与请求，不能让 UI 状态与实际上下文注入脱节。任何这类规则修改都要用真实请求/上下文快照验证“宿主预设未注入、MOD 规则按授权注入”。

### 新手说明与更新公告

源码常量：

- `MOYUN_PROJECT_INTRO`：关于页与首次说明共享的项目介绍。
- `MOYUN_FIRST_RUN_GUIDE`：新浏览器的首开说明；已读键为 `moyun_first_run_guide_seen`。
- `WEB_UPDATE_ANNOUNCEMENT`：普通网页更新公告；已读键为 `moyun_web_update_announcement_seen`。

当前逻辑中，新用户先看到新手说明；关闭后下次刷新才可看到更新公告。已读旧首开说明的用户可直接看到具有新 `id` 的更新。修改公告时：

1. 只编辑 `WEB_UPDATE_ANNOUNCEMENT` 的 `id`、`badge`、`publishedAt`、标题和正文；时间精确到分钟。
2. 每次面向已读用户的新公告必须换一个稳定且唯一的 `id`，不能仅改正文。
3. 测试首次访问、已读旧公告、首开说明未读三种 localStorage 状态。
4. 用桌面与手机检查公告居中、可滚动、X/Esc/背景关闭和已读后不重复弹出。

不要把发布公告写进前端版本号；网页 UI 与关于页应避免散落的版本历史。公告是面向用户的更新记录，Git 提交与发行记录才是维护追踪。

---

## MOD API 1.1：概念、包格式与校验

### 默认安全模型

普通 MOD 是 JSON 声明包，而不是可任意执行的浏览器扩展。宿主负责导入、规范化、权限展示、逐项启用、渲染、存储与请求；MOD 只描述规则、设置、UI、资料表、AI 工具、工作流和生命周期动作。未知字段、未知权限、未知 UI 动作、未知视图组件、未知工作流步骤或未知事件，不能变成可执行能力。

导入兼容两种类型：`moyun_mod_pack`（推荐）与旧 `novel_mod_pack`；为兼容旧数据，`_type` 也可省略。导出统一写成 `moyun_mod_pack`。`apiVersion` 只比较主版本，当前必须是 `1`；建议新包明确写 `"1.1"`。同一 `manifest.id` 再导入会覆盖该 ID 的已有包，ID 必须稳定且全局唯一。

### 顶层结构

```json
{
  "_type": "moyun_mod_pack",
  "apiVersion": "1.1",
  "manifest": {
    "id": "author.example.prompt-kit",
    "name": "示例提示词包",
    "description": "说明用途、影响范围、风险和停用后的效果。",
    "author": "作者或团队",
    "version": "1.0.0",
    "apiVersion": "1.1"
  },
  "permissions": ["prompt:write"],
  "features": {},
  "settingsSchema": {},
  "ui": {},
  "hooks": {},
  "rules": [],
  "modules": [],
  "assets": {},
  "dataSchemas": [],
  "aiTools": [],
  "workflows": [],
  "activeContextTools": [],
  "hostedViews": [],
  "skillPacks": [],
  "eventHandlers": [],
  "testCases": []
}
```

规范化后的主要字段为：`id/name/description/author/version/apiVersion/enabled/permissions/features/hooks/settingsSchema/ui/rules/modules/assets/dataSchemas/aiTools/workflows/activeContextTools/hostedViews/skillPacks/eventHandlers/riskLevel/contextPolicy/writePolicy/testCases`。部分集合既可写数组，也可写对象映射；对象键会作为项目的 `id`/`key` 候选。正式发布仍推荐数组，便于排序、代码审查和差异比较。输入中的 `manifest` 本体、`tags`、`compatibility` 或其他未规范化字段不是宿主运行时契约，不应承诺会在运行时或标准导出中保留。

### 结构校验的重点

导入前 `validateModPack` 会检查包类型、API 主版本、规则位置、权限、资料表字段、AI 工具、工作流、Hosted View、事件以及相互引用。典型硬错误包括：没有 ID、引用不存在的工具/资料表/工作流、按钮动作不在白名单、`modal` 等插槽不存在、工作流缺少 `toolId` 或 `tableId`。

校验通过不等于“对用户安全”或“功能一定有用”。当前没有发布者签名、身份核验、包哈希信任、总包大小限制、重复 ID/规则冲突检查或跨 MOD 冲突裁决；`riskLevel` 只是保留描述字段，不是权限门禁或沙箱。作者仍要保持最小权限、说明上下文外发范围、测试真实路由，并避免不受控的大段提示词。导入确认页会展示规范化后的作者、功能、权限和风险；它是一次总确认，不是逐项授权向导。用户之后可关闭整个包或逐项权限。

---

## MOD 权限、规则、模块、设置与资产

### 权限目录

权限是宿主能力请求与运行时门禁，不是浏览器安全沙箱。只声明真正需要的项。规范化器会因规则、资料表、AI 工具、主题、工作流或事件等声明自动补入部分必要权限，导入确认会展示补全结果；这不是绕过确认，但作者不应依赖隐式补权，应在源包中显式写出最小权限集。

| 分组 | 权限 | 用途 |
| --- | --- | --- |
| 提示词/数据 | `prompt:write` | 让规则和文本钩子参与提示词构建。 |
|  | `storage:own` | 读写本 MOD 私有设置、工具结果、运行日志、一次性事件标记等。 |
|  | `skill:own` | 保存白鸟 Skill 自有数据。 |
|  | `storage:book` | 声明需要影响当前书数据的能力。 |
|  | `data:table` | 读写声明式资料表。 |
| 资产/主题 | `assets:install` | 由用户触发安装文风、预设、流水线资产。 |
|  | `theme:install` | 安装安全主题变量包。 |
|  | `theme:fullAccess` | 高风险主题 CSS/HTML/JS；必须二次确认。 |
| 宿主 UI | `ui:settingsTab`、`ui:sidebarTool`、`ui:floatingPanel` | 设置页、侧栏、悬浮面板插槽。 |
|  | `ui:newBookAction`、`ui:mainToolbar`、`ui:chapterAction`、`ui:modal` | 新建书、主工具栏、章节动作、安全独立弹窗插槽。 |
| AI/上下文 | `ai:request`、`ai:embedding` | 宿主代发文本/向量请求。 |
|  | `context:activeRead` | 在生成期读取结构化资料。 |
|  | `web:search` | 联网检索资料；仅用于开放的宿主路径。 |
| Skill | `skill:runtime`、`skill:script`、`skill:html` | Skill 运行能力声明；不等于自动执行。 |
| 宿主设置/导出/事件 | `settings:moduleModels`、`export:data`、`event:listen` | 遗留模块模型写入、数据迁移声明、监听生命周期。 |

`settings:moduleModels` 目前只能写遗留兼容字段，不能配置当前连接中心路由；普通 MOD 不应依赖它实现网页模型分配。

### 规则与注入位置

单条规则：

```json
{ "name": "连续性检查", "position": "writing", "enabled": true, "content": "生成前核对人物状态、地点和时间线。" }
```

| position | 含义 |
| --- | --- |
| `pre` / `post` | 最前/最后的全局强调。 |
| `style` | 文风与语言质感。 |
| `world` / `character` | 世界观与角色层。 |
| `outline` / `scene` / `writing` | 规划、场景、正文。 |
| `summary` / `review` / `suggestion` | 总结、书评、建议。 |

规则生效至少要满足：MOD 启用、拥有 `prompt:write`、规则启用、位置匹配、内容非空。规则应短而可审计：一个规则只负责一个目标，明确输入/输出/禁止项，不要在提示词里伪造 UI 操作、外部 JS 或密钥。

`modules` 用于把大型规则包拆为可独立开关的小说模块。每个模块可含 `id/key/title/desc/category/order/core/recommended/enabled/rules/hooks/contextPolicy/writePolicy`；数组或对象映射均可。模块中的 `rules` 必须仍是规则对象，不能仅写字符串 ID。`content`、`prompt`、`text` 可作为快捷写法，宿主会把它们归一为一条规则。`hooks` 是文本变换，不是脚本钩子，只支持字符串或 `append`、`prepend`、`replace`（replace 另用 `search` 指定替换目标），并受 `prompt:write` 门禁。

当前真正调用的 hook 名称是 `buildInfinitePrompt`、`buildWritingRules`、`buildPostPrompt`、`buildFullSystemPrompt`、`buildSummaryPrompt`、`buildSuggestionPrompt`、`buildReviewPrompt`。任何自造 hook 名字虽然可写进 JSON，但宿主没有调用点便不会生效。规则宏同样只是纯文本处理：`{{setvar::变量名::值}}`、`{{getvar::变量名}}`、`{{// 注释}}`、`{{trim}}`，最多展开四轮；不执行表达式、网络请求或代码。

### 设置与 MOD 私有数据

`settingsSchema` 是“设置定义”，用户实际填写值保存在：

```text
modPrivateData[modId].settings
```

写入需要 `storage:own`。字段可用：`type`（`string`、`number`、`boolean`、`select`、`textarea`）、`label/title`、`desc/description`、`default`、`options`、`visibleWhen`、`presetSettings`、`presetSettingKeys`、`allowCustomPresets`、`customStoreKey`。`visibleWhen` 可声明依赖设置键以及 `equals/notEquals/in/notIn`，但作者应保证隐藏字段的默认值安全。

私有数据按 MOD ID、按书籍隔离。新建/切换/恢复书籍时，不能继承上一书的资料表、向量索引、召回快照、工具结果和运行日志；可按宿主现有规则保留配置类设置。清空私有数据不能顺带清掉正文、角色、其他 MOD 或连接中心。

### 资产

`assets` 可包含：

- `writingStyles[]`：`id/name/prompt/desc/enabled`；
- `presets[]`：`id/name/content/applyTo/enabled/desc`；
- `promptPipeline[]`：供宿主安装的流水线数据；
- `themePacks[]`：见下一章的安全与高风险分层。

资产安装必须由用户发起，采用追加/选择式安装，不自动覆盖用户已有文风、预设或流水线。每项应有稳定 ID、说明和可逆路径。

---

## MOD UI、资料表、AI 工具、工作流与事件

### 声明式 UI 插槽和动作

可用插槽：`settingsTab`、`sidebarTool`、`floatingPanel`、`newBookAction`、`mainToolbar`、`chapterAction`、`modal`。每个 `ui[slot]` 项可含：

```text
enabled, title, desc, content, order, icon, badge, theme, layout,
density, accent, anchor, target, variant, buttons, payload
```

按钮结构为 `label/action/variant/tone/size/colSpan/rowStart/payload`。`action` 只能使用宿主白名单：提示、打开/切换宿主面板、填入/追加剧情与大纲、安装资产、开关模块、写私有数据/资料表、复制、打开 MOD 弹窗或 Skill 管理器、运行 AI 工具/工作流、读取模型列表、向量索引与记忆操作、以及宿主已公开的其他安全动作。未知 action 会报错；动作还会按具体数据、AI、向量、模块模型等权限再次检查。

当前完整 action 值如下（字段名必须精确匹配；存在于目录不代表当前页面每个入口都可见）：

```text
toast
toggleFloatingPanel, openModFloatingPanel, openSettingsTab, switchSidebarTab
fillNextPrompt, appendNextPrompt, fillOutline, appendOutline
fillScenePrompt, appendScenePrompt, openOutlinePanel, openDetailedOutline
applyModAssets, toggleModModule, setModModuleEnabled, setModModuleGroup
setSetting, savePrivateData, writeModDataTableRows
copyContent, copyContextSnapshot, openModModal
openModSkillManager, importModSkillPack, toggleModSkillPack,
deleteModSkillPack, exportModSkillPack, copyModSkillDiagnostic,
runModSkillRuntime
runModWorkflow, testModApiConnection, fillModAiSettingsFromMain,
fetchModModels, selectModModel
setHostModuleModel, clearHostModuleModel
rebuildModVectorIndex, pauseModVectorIndex, resumeModVectorIndex,
cancelModVectorIndex, retryModVectorIndexFailedBatches,
previewModMemoryRecall, confirmModMemoryRecallSnapshot,
clearModVectorIndex, scanModMemoryGovernance, applyModMemoryPreset
enterInfiniteMode
```

MOD 不能用此接口任意操作 DOM。宿主上下文只提供必要的只读书籍基础字段、计数、当前页签/章节标题/摘要和清洗后的正文；不包含 API Key。

> 当前显示限制：`sidebarTool` 仍是合法的 API 插槽、权限和校验项，但当前网页版模板没有直接渲染普通 `modUiHostSlots.sidebarTool`。作者可保留兼容声明，却不能承诺它会在现行网页 UI 中显示；若要交付可见入口，应选用已渲染插槽并在发布前实测。

### Hosted Views

`hostedViews[]` 是安全独立视图，字段包括：

```text
id, title, desc, slot, category, order, icon, badge, theme, layout,
density, width, enabled, components, contextPolicy, writePolicy
```

`slot` 必须是上述 UI 插槽之一。宿主只渲染以下组件类型：

```text
text, stat, list, table, button, settingsForm, collapsibleGroup, divider,
dataTable, modelList, aiToolForm, aiToolResult, workflowRun,
memoryPresetSelector, vectorIndexStatus, memoryRecallPreview,
memoryGovernancePreview, foreshadowLinkGraph, skillRegistry, skillCompatMatrix
```

组件可用 `id/type/title/text/value/source/tableId/toolId/workflowId/action/variant/tone/layout/size/badge/featured/open/defaultOpen/payload/visibleWhen/components/items/columns/settingsKeys/showKeys/enabled`。文本由 Vue 安全渲染，`hostedViews` 没有注入 HTML/JS 的接口。引用 `dataTable`、`aiToolForm`、`aiToolResult` 或 `workflowRun` 时，对应表/工具/工作流 ID 必须存在。

### 结构化资料表

`dataSchemas[]` 定义资料表，行数据保存于：

```text
modPrivateData[modId].tables[tableId]
```

常用字段：`id/title/desc/category/enabled/injectToPrompt/enabledSetting/injectSetting/position/maxRowsInPrompt/recallMode` 与一组 `recall*` 设置；`recallMode` 只能为 `vector`、`hybrid`、`static`、`none`。`fields[]` 的列可用 `key/label/type/default/options`，其中 type 为 `string`、`number`、`boolean`、`select`、`textarea` 或 `date`。

读写资料表须有 `data:table`。行写入由宿主按 schema 白名单字段和 `writePolicy` 执行，不能借任意对象字段改写应用状态。参与正文注入的表要控制 `maxRowsInPrompt`，并使用清洗后的可见内容；冲突队列、内部诊断、密钥和思维链不可注入。

### AI 工具

`aiTools[]` 由宿主发起请求，MOD 本身不能直接 `fetch`。典型字段：

```text
id, title, desc, category, order, enabled, taskType, modelKey,
apiUrlSetting, apiKeySetting, modelSetting, promptTemplate, instruction,
inputSchema, outputMode, targetTableId, saveResult, maxInputChars,
useNsfwMessages, requiredSettings, contextPolicy, writePolicy
```

`modelKey` 默认 `writing`，会走该 key 的连接中心路由。`inputSchema[]` 支持 `string/textarea/number/boolean/select` 及 `key/label/placeholder/desc/default/runtimeDefault/required/options`。`outputMode` 为 `text`、`markdown`、`json` 或 `tableRows`，最大输入会被限制为 50,000 字符。

运行工具至少需要 `ai:request`；保存结果或运行日志通常还需 `storage:own`，写资料表另需 `data:table`。提示词模板只支持纯文本 `{{path}}` 占位符，不执行表达式或 JavaScript。

如果工具显式填写 `apiUrlSetting/apiKeySetting/modelSetting`，它只按 OpenAI Compatible 方式请求：显式 Key 缺失时必须报错，绝不能悄悄回退到模块 Key。普通工具则自动遵守连接中心的严格模块路由。

### 工作流

`workflows[]` 把宿主能力按顺序串接，不运行 MOD 自带脚本。字段：

```text
id, title, desc, category, order, enabled, enabledSetting, steps,
saveRunLog, confirmBeforeRun, requiredSettings, contextPolicy, writePolicy
```

每步可含 `id/title/desc/type/enabled/action/toolId/tableId/key/value/delayMs/saveResult/payload/row/rows/writePolicy/onError`。允许的 type 只有：

| type | 行为 |
| --- | --- |
| `uiAction` | 调用白名单 UI 动作。 |
| `aiTool` | 运行本包声明的 AI 工具。 |
| `savePrivateData` | 写本包私有数据。 |
| `dataTableRow` / `dataTableRows` | 写一行 / 多行资料表。 |
| `embeddingIndex` | 重建向量索引。 |
| `memoryRecall` | 预览记忆召回。 |
| `wait` | 等待 0–10,000ms。 |
| `toast` | 显示流程提示。 |

`onError` 只能为 `stop` 或 `continue`，默认停止；运行日志最多保留 20 条且需要私有存储。对可能写数据、耗时或发请求的流应开启 `confirmBeforeRun`，并在发布测试里覆盖取消、失败、中断和重复点击。

### 主动上下文工具与事件

`activeContextTools[]` 支持 `memory`、`foreshadow`、`keyword`、`worldview`、`webSearch`。常用字段为 `id/title/desc/enabled/enabledSetting/weightSetting/maxCallsSetting/resultLimitSetting/maxCharsSetting/weight/priority/maxCalls/resultLimit/maxChars`，范围依次受宿主限制（权重 0.1–9，调用 0–8，结果 1–20，字符 300–12,000）。需要 `context:activeRead` 与 `data:table`；`webSearch` 还需 `web:search`。作者应明确检索的外发范围，默认克制调用次数。

> 已知限制：当前 `exportModPack()` 导出普通 MOD 时没有输出 `activeContextTools`。作者在更新包、导出再导入或交付前应自行保留源 JSON，并在修复前把该字段视为不可依赖的导出往返能力。

可监听事件：`appReady`、`bookCreated`、`bookLoaded`、`chapterInserted`、`chapterSaved`、`chapterDeleted`、`generationStarted`、`generationFinished`、`generationStopped`。事件处理器字段：

```text
id, event, type, title, desc, enabled, order, action, workflowId,
toolId, enabledSetting, key, value, payload, runOnce, saveLog
```

处理器类型只限 `toast`、`uiAction`、`workflow`、`aiTool`、`savePrivateData`。使用事件须申请 `event:listen`；`runOnce`/日志依赖 `storage:own`。事件不是浏览器任意事件监听器，不能自造事件名，也不应在 `appReady` 自动发高成本 AI 请求。

---

## 主题与白鸟 Skill 的信任模型

### 安全主题变量

普通主题可修改有限 CSS 变量，例如背景、文字、边框、强调色、阴影、状态色、覆盖层与字体变量。值会经过过滤，拒绝 `javascript:`、`@import`、`url(...)`、`<script>`、HTML 等危险内容。此路径仍应使用 `theme:install`，并在导入前显示作者和影响范围。

### Full Access 主题

`themePacks[]` 可含 `id/name/desc/author/baseTheme/light/dark/variables/previewColors/customCss/customJs/mountHtml/fullAccess/trustedKey/enabled`。其中 `customCss`、`customJs`、`mountHtml` 属于高风险 Full Access：它们不属于 Hosted View 安全接口，可能在用户确认后操作 DOM、读取本机页面数据或造成页面故障。

Full Access 必须满足：明确声明 `theme:fullAccess`、导入后不自动信任、用户看到风险并二次确认、作者提供来源和回退说明。维护者不得在普通 MOD 说明中笼统写“绝不执行 CSS/JS/HTML”，也不得把 Full Access 伪装成普通换色。异常时用设置安全模式或 `?safeTheme=1` 打开页面，再禁用问题主题。

### 白鸟与 Skill 包

白鸟·雪翼成双是使用 MOD/Skill 兼容层的特殊扩展，宿主 ID 为 `moyun.linxun.snowwing-pair`。Skill 可从 JSON、Markdown 或 zip 导入；zip 需保留 `SKILL.md` 与关联资源。所有 Skill 的设置、资料表、工具、工作流与运行数据必须按 Skill ID 命名空间隔离（例如 `skill_<skillId>__...`），不能撞到白鸟本体或其他 Skill。

Skill 策略：

| 策略 | 含义 |
| --- | --- |
| `audit-only` | 仅审计，不运行。 |
| `declarative-only` | 仅允许安全声明式部分。 |
| `controlled-runtime` | 在 Worker 沙盒运行受控 runtime；不能直接访问父页 DOM、`localStorage`、`fetch` 或 `XMLHttpRequest`。 |
| `full-access` | 高风险宿主页运行；可触及 DOM、白鸟私有数据、设置和宿主白名单能力，必须二次确认。 |

Skill 的 `runtime/script/html` 只是风险能力声明，普通导入、启用和正文生成不会自动执行它们。不得默认偷用主 Key 或主模型；任何“跟随主配置”都要用户明确选择/确认。未知来源 Skill 保持禁用，特别不要确认 Full Access。

---

## MOD 测试、排错、兼容与发布清单

### 推荐测试矩阵

| 范围 | 必测内容 |
| --- | --- |
| 导入 | 合法包、未知权限、主版本不兼容、同 ID 覆盖、取消确认、禁用后无效。 |
| 提示词 | 每个规则位置、模块独立开关、停用后的上下文移除、不会泄露内部文本。 |
| 设置/资料 | 默认值、隐藏条件、书籍隔离、字段白名单、删除与恢复。 |
| AI | 缺路由不发请求、显式错误不回退、正确模型/地址/协议、空回和截断不写成功。 |
| 工作流/事件 | 确认、取消、停止/继续、重复点击、日志上限、`runOnce`、失败不写错数据。 |
| UI | 所有 slot、焦点、Esc/X/背景、桌面与 390px 窄屏、无横向溢出。 |
| 主题/Skill | 安全变量、Full Access 二次确认、`?safeTheme=1` 恢复、未知包默认不执行。 |
| 往返 | 导出再导入、升级同 ID、保留源 JSON；特别核对 `activeContextTools` 已知导出限制。 |

仓内 `output/*.cjs` 保留有连接中心、模型切换、无回退、弹窗安全、章节导航、公告、桌面/手机 smoke 等 Playwright 回归脚本。它们不是 npm 脚本也不是 CI；使用前查看脚本的前置条件、浏览器路径和测试数据，避免把测试 Key/作品带进仓库。

### 常见问题

| 现象 | 排查顺序 |
| --- | --- |
| 规则未生效 | MOD/规则是否启用 → 是否有 `prompt:write` → position 是否匹配 → 内容是否为空 → 实际请求上下文。 |
| 工具没有请求 | 是否有 `ai:request` → 模块路由是否有效 → requiredSettings 是否齐全 → 是否被确认/运行状态拦截。 |
| 绑定模块却用了别的 Key | 这是严重回归；检查是否绕开 `getModuleRequestConfig`。显式路由不允许回退。 |
| Hosted View 空白 | slot、组件 type、权限、引用的 table/tool/workflow ID、`visibleWhen` 和控制台错误。 |
| 导入失败 | `_type`、API 主版本、重复/空 ID、未知权限/动作/事件、数据结构是否数组或对象。 |
| 页面被主题弄坏 | 用 `?safeTheme=1` 恢复，禁用主题；不要盲目清除全部站点数据。 |
| 导出后少了主动上下文工具 | 当前已知 `activeContextTools` 不被普通 MOD 导出；以源 JSON 为准。 |

### 作者发布清单

- [ ] `_type` 为 `moyun_mod_pack`，`apiVersion` 与 `manifest.apiVersion` 为 `1.1`。
- [ ] `manifest.id` 稳定、唯一、无空格，`name/description/author/version` 齐全。
- [ ] 权限遵循最小化原则，高风险主题/Skill 有醒目说明。
- [ ] 所有规则、工具、资料表、工作流、视图和事件引用均真实存在。
- [ ] 不依赖遗留 `settings:moduleModels` 配置网页 API 路由。
- [ ] AI 工具说明发送给上游的资料范围，且使用正确连接中心模块。
- [ ] 不含 Key、Token、用户正文、浏览器导出、私有运行记录或不可信远程脚本。
- [ ] 已做桌面和手机实测，测试了取消、失败、关闭、重导入和停用。
- [ ] 保留完整源 JSON 与变更说明；在已知导出限制修复前不以导出文件作为唯一源。

---

## 附录：可导入的最小示例

以下包只展示安全声明式规则、设置和设置页入口，可用于验证导入、权限、规则和 UI。它不会发请求、写资料表或执行脚本。

```json
{
  "_type": "moyun_mod_pack",
  "apiVersion": "1.1",
  "manifest": {
    "id": "example.continuity-helper",
    "name": "连续性提示示例",
    "description": "在正文生成前提醒模型核对人物、地点和时间线。仅注入一条 writing 规则。",
    "author": "Example Author",
    "version": "1.0.0",
    "apiVersion": "1.1"
  },
  "permissions": ["prompt:write", "storage:own", "ui:settingsTab"],
  "settingsSchema": {
    "strict": {
      "type": "boolean",
      "label": "严格连续性",
      "description": "关闭后作者仍建议人工检查，但不应假称规则已移除。",
      "default": true
    }
  },
  "ui": {
    "settingsTab": [
      {
        "title": "连续性提示示例",
        "desc": "此包只使用安全声明式规则。",
        "content": "可在 MOD 管理中关闭本包或单独关闭规则。",
        "order": 10,
        "buttons": [
          {
            "label": "显示说明",
            "action": "toast",
            "payload": { "text": "连续性提示示例处于启用状态。" }
          }
        ]
      }
    ]
  },
  "rules": [
    {
      "name": "正文连续性检查",
      "position": "writing",
      "enabled": true,
      "content": "输出正文前，核对人物当前状态、地点、时间线、已发生事件与未回收伏笔；若资料不足，不要编造已确定事实。"
    }
  ],
  "features": {
    "continuityRule": {
      "enabled": true,
      "title": "正文连续性规则",
      "logic": "通过 writing 位置规则提醒模型。",
      "createsDom": false,
      "singleInstanceKey": "example.continuity-helper"
    }
  },
  "testCases": [
    {
      "name": "导入与停用",
      "steps": ["导入 JSON", "确认三项权限", "生成前查看 writing 上下文", "关闭 MOD 后再次查看"],
      "expected": "启用时仅多出一条连续性规则；关闭后该规则消失。"
    }
  ]
}
```

### 维护者最后检查

本文档本身只描述和约束网页维护，不会改变网页运行逻辑。任何准备实现的新字段、动作、协议或高风险能力，都应先：设计最小宿主能力与权限 → 修改源码和校验器 → 补充本手册的字段/限制/测试 → 构建并完成桌面、手机和线上验收 → 再发布给 MOD 作者使用。
