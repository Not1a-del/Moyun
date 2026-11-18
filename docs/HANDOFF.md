## v0.0.19 作者设定、旧记忆与阅读反馈（2026-11-18）— 当前本地工作

分支 `fix/v0.0.19-context-reader-review`，基线 `d54d64a`，改前已有未提交内容备份在 `.ui-check/context-reader-backup-20261118-121717/`。用户要求完成三个疑点和两个新增反馈后暂停，本轮不推送、不部署；仍为 19，保留 1116 公告。下方前轮记忆优化“等待方案确认”的状态已被本轮授权取代。

已修复角色摘要遗漏关键事实、无设定包的长角色库按整串头部截断、旧格式与全量备份字段漏收、追加导入对话类型引用未重映射，以及隐藏简介选项导致开书误报。小书 AI 新角色保存丢失未复现，不能把猜测都写成已证实的 bug。文风与人物同时发送并明确人物约束，删除正文自动猜测并改写角色档案的路径。

旧记忆读取与自动维护分开；书级自动总结／主动替换近期原文均默认关闭，已有记忆和分组保留。增强召回关闭自动总结时只读已有索引，不主动重建。快速滚动出现上下箭头，停止操作 3 秒隐藏；44px 按钮在手机避开原主题按钮。所有书级数据仍走原 IndexedDB，无新增 localStorage。

专项已通过：阅读／角色／开书 26 项、记忆与完整备份 19 项、真实约 200 MB 备份 10 项；普通 gate 9/9、v19 316/316。真实备份 311 章、516 条记忆、57 组、510 条细纲、32 总结、4 卷、167 快照保存刷新与全量往返均保留；它的角色数组原本为空，不能声称找回不存在的角色。

最终完整浏览器门禁 24/24，失败／跳过 0，1,136 秒；结构审计通过，源文件与主目录构建字节一致，golden、版本与公告未改。手机布局 170 项、触屏平板 30 项、设置搜索 415 项通过。失败记录已保留：早期测试夹具／动画时机修正，手机主题按钮遮挡属实际布局问题并已修复。报告见 [专项报告](V0.0.19_CONTEXT_INTEGRITY_REPORT.md)，证据见 [归档目录](evidence/v0.0.19-context-integrity/README.md)。本轮结束，等待用户手验；不代表真实模型绝不改人设，真机 iOS／厂商浏览器仍需用户复验。

## v0.0.19 角色阵营、状态色与上下文排查（2026-11-18）— 前轮本地工作

分支 `fix/v0.0.19-character-relations`，基线 `3a052bd`。本轮仅本地修复，未推送／部署；线上仍是下方上一轮正式发布。版本仍为 19、保留 1116 公告。

角色工作台补阵营勾选与原势力资料编辑入口；共用世界资料 characterIds，不另存阵营。图谱按资料 name 显示名称，关系线按固定状态分类着色，修正盟友／否定信任误判；同类文案不再误变混合线，双向不同状态保留各自事实。复杂描述可手选状态色，只影响显示。平板角色页复用下拉选择与折叠检查器，避免多栏挤窄。专项加入浏览器门禁。

记忆部分按用户要求先报告方案，**没有擅自重做选材或覆盖人物资料**。私人备份角色数组为 0，311 章均有有效记忆，57 组当前实际 mock 请求全部进入；默认世界观尾部和本次未命中的资料没有进入。合成角色默认摘要模式实测省略说话方式、专属约束和关系，显式详情可进入。原快照约 54 万字符不是当前约 6.9 万字符请求，不能混为一谈；当前文件也不能证明更早是否丢过角色。

验收状态与后续建议以 [专项报告](V0.0.19_CHARACTER_CONTEXT_REPORT.md) 为准。下一轮先让作者评估“本章关键人物事实保留、旧事实按需召回、方向称谓与冲突处理、空角色库候选整理”的方案，再改写作上下文。私人正文不入 Git、不外发；本地测试不证明真实模型已经遵守。

最终本地验收：浏览器完整门禁 22/22、v19 回归 302/302；增强角色专项 20/20、原私人备份匿名专项 3/3，失败／跳过 0。同章 Gemini 双开关全开／全关均为 69,412 字符、57/57 组；第三人称在，世界观尾部仍未完整带入。阵营和状态色刷新及导出再导入保留。角色专项覆盖 1280／1024／768／360／320 明暗，按钮 44px、中心命中、无横向滚动。[脱敏证据](evidence/v0.0.19-character-relations/README.md)已归档；本轮未上传。

## v0.0.19 公测入口及两站同步（2026-11-17）— 上一轮已发布

本轮分支 `fix/v0.0.19-public-release`，基线c6ac50a。用户已恢复代理并明确授权本版直接同步正式库；旧书记忆修复、快照管理和公测入口说明已发布两站。运行候选89c1d83、部署候选0dd2770（后者只改验收和文档）；公测Pages #21、正式#84成功，main:/，执行账号yydcm-129。本地21/21、v19回归297/297、线上两站各25+30项共110/110通过，无失败或跳过。后续回执提交仅归档证据，不改运行文件。

README明确两仓与两站，网页按域名显示公测身份，「关于」增加当前站点与入口。保留19及1116公告。公测库和平板已加入固定本地／线上门禁，执行 `npm run gate:browser`、`npm run gate:release`；代理下匿名GitHub API403时用插件现场读取元信息回执，按部署文档追加 `--repo-metadata`，不删断言。分站证据、命令、边界与回滚见[本轮报告](V0.0.19_PUBLIC_RELEASE_REPORT.md)。下方“本地未上传／未推送”均为历史阶段，当前状态以本节和本轮回执为准。

## v0.0.19 重生成快照查看与清理（2026-11-17）— 上一轮开发记录

当前分支 fix/v0.0.19-regen-snapshot-cleanup，基线2b1b80f（已包含下方旧书记忆修复）。现有“快照历史”新增“章节重生成快照／本机书籍快照”：前者按本书所有分支显示首次请求，可分段查看、逐条删除或整本清理；只删regenSnapshot，保存失败回滚，不删正文、旧稿、摘要、记忆与规划。复用原保存排队重试，无新增存储键或库。

本地最终验收：结构审计通过，普通门禁9/9、完整浏览器门禁20/20，失败／跳过0，v19回归296/296；快照单元8项、合成浏览器18项、匿名真实备份7项通过。公测候选运行提交4309f05bfa88ccf68bceb1f38d10b16138037d5e已推至 yydcm-129/Moyun:main，Pages构建成功、站点HTTP 200；线上浏览器交互冒烟因Vue未就绪／打开超时而未完成，不可称线上UI全验收。未推正式库，等待用户手动验收。账号API确认yydcm-129；repo-local Git作者已设yydcm-129+noreply，不影响push权限。

真实备份内167份请求导入后能查看；清理、刷新和全量导出再导入后，311章及516条记忆等内容指纹不变，备份降至约15.4MB。原文件未修改。原备份没有正文旧稿versions（0条），也没有独立书籍恢复点；不能把首次请求当作过去的正文版本。

用户手动验收JSON和步骤只放F:\QQ，项目内仅保留生成器、回归脚本和合成截图；真实用户书稿不入Git、不外发。验收方法、最终门禁、原始失败、已知边界和回滚见 [专项报告](V0.0.19_REGEN_SNAPSHOT_REPORT.md)。此阶段未推正式库；公测已上传，后续发布以文首本轮回执为准。版本仍为19、保留1116公告。后续新章节仍会生成新快照；本机独立历史仍未随全量书籍备份迁移。

## v0.0.19 长书记忆与大备份修复（2026-11-17）— 上一轮本地修复

当前分支 `fix/v0.0.19-legacy-memory`，基线 `5a0a1bb`。用户报告百万字老书丢记忆，并提供约200.7MB全量备份；本地已解除书籍JSON的50MB硬限制，修复多组合并记忆误去重、跨卷丢更早记忆、旧库／旧JSON资料补缺、旧导入细纲被空分支规划遮住，以及重记失败先删旧记录。没有改记忆结构或指纹算法，没有清理用户生成快照。

隔离页真实导入、保存刷新与导出再导入已完成：311章均有有效记忆，516条记忆和57组合并全部保留；Gemini双开关全开／全关的实际mock请求均带齐57组。205条无现存章节对应的旧记忆全部保留，不自行关联。最终门禁、证据及未覆盖范围见[专项报告](V0.0.19_LEGACY_MEMORY_RECOVERY_REPORT.md)。

**本轮没有推送或部署。** 保留版本0.0.19与既有1116公告。私有备份和书稿不入库、不外发；只用临时Edge档案，不碰日常书库。后续上传仍先公测，再由用户确认候选后正式发布；下方11月16日上线记录仅是上一轮状态。

## v0.0.19 第一轮热更新（2026-11-16）— 上一轮上线记录

三个布局问题已修复并发布两站：运行候选 `ccdc2e1`，正式 Pages #82、公测 Pages #16 成功，触发账号 yydcm-129；线上各 18/18，8 个启动文件与同一候选一致。`a018e50` 上完整本地浏览器门禁 18/18，无失败或跳过；手机／平板／补充布局共 240 项通过。后续仅补文档和检查脚本回执，运行文件不变。最新远端状态见[热更新发布回执](V0.0.19_HOTFIX_RELEASE_REPORT.md)，完整根因与方法见[修复报告](V0.0.19_MOBILE_HOTFIX_REPORT.md)，共享证据见 [evidence](evidence/v0.0.19-hotfix-1/README.md)。不能把旧版“已上线”段落当作本轮上线证据。

保留 `0.0.19` 和既有 1116 公告，不写新页面公告、不升 20。`origin` 的 `yydcm-129/Moyun` 现用作公测，`upstream` 的 `Not1a-del/Moyun` 是正式库。以后先上传公测，经用户确认对应候选提交后再发布正式库，不能沿用旧的“先正式后同步 fork”。见根目录 `AGENTS.md`、[部署说明](DEPLOYMENT.md)和[公测说明](PUBLIC_TESTING.md)。

剩余边界：开发侧模拟不代表用户真机；重点收集手机／平板工具栏、键盘和横竖屏反馈。保持平板双栏，不再使用按机型猜底栏或仅小于 768px 的适配。

## v0.0.19 · 1116 已上线（2026-11-16）— 热更新前历史状态

已按用户要求用 yydcm-129 快进上传 upstream/main 和 origin/main，运行时提交均为 34393c1，Pages #80 成功，线上 https://not1a-del.github.io/Moyun/ 已为“1116更新”，工作版本 0.0.19。主目录与开发分支 v0.0.19/L1-foundation 保留；本地门禁 9/9、本地和线上发布专项各 18/18，线上 8 个启动文件与 Git 发布提交逐字节一致。中文回执随后同步两仓且不改变运行文件。完整方法、证据、未覆盖项及回滚见 [V0.0.19_RELEASE_REPORT.md](./V0.0.19_RELEASE_REPORT.md)。以下“未上传”仅代表历史开发阶段，以本节和发布报告为准。

## v0.0.19 初版补全（2026-11-10）— 历史本地交付

主目录 F:\yydcm129\codex 墨韵接手\Moyun 已按定向清单同步并重新构建；保留用户AGENTS.md修改及CLAUDE.md删除状态。本轮没有上线或推送，没有添加本版网页公告。

功能范围、验收证据、未覆盖项见 [V0.0.19_LOCAL_VALIDATION.md](./V0.0.19_LOCAL_VALIDATION.md)，用户真实模型及真机回传继续使用 [V0.0.19_TEST_HANDOFF.md](./V0.0.19_TEST_HANDOFF.md)。旧S1/S9仅为历史状态，最新范围以STEP_LOG追加条目为准。同步前备份位置和文件哈希在 .ui-check/v19/main-sync.json；基线标签v0.0.19-base，禁止直接reset覆盖已有本地改动。

## v0.0.18 本地完成（2026-10-21，未提交未发布）— 历史工作状态

当前分支 `feat/v0.0.18`，Git 基线 `a9fe943`；保留接手时已有的未提交改动，继续归入 v0.0.18。主工作区源码与构建入口已同步，网页公告未改，未上传。上一版线上发布状态见下方历史记录，本轮未重新核验线上。

- 已完成 Gemini 简短文案、旧预设黄色兼容警告与手机布局；预设编辑弹窗移到工作区根层，修复侧栏 transform 导致的定位/宽度错误。
- 连接中心下加入全局温度和思考强度，公共文本请求统一适配；Gemini 抗截断以 `output_reply` 提交正文，流式/非流式共用解码。遇到 `length/MAX_TOKENS` 时有普通正文或工具正文就尽量保留，只有无可保留正文才失败；纯空回复最多请求 3 次，普通非抗截断请求仍严格拒绝限长结果。
- 记忆按章节正文总结并接入写作/续写，校验书籍、分支和正文指纹；向量模型由默认全局 API 获取并手选，全局保存，书内记忆隔离。补录、编辑、停用/启用、重记、停止、切书、导入和刷新均有回归。
- 接手已有的首次预设初始化、卷纲交接、Gemini 测试输入、Token 用量、自定义字数继续保留并回归。v0.0.17 的旧预设无 UI 与首次启动预设为空，已在本地修复；新旧预设并存是本版明确保留的行为。
- 前端审计由 5 errors / 48 warnings 降至 0 errors / 38 warnings：修复图片标签、过渡和减少动态效果，补键盘预览；余项已逐条分类，见 [审计整改记录](./V0.0.18_FRONTEND_AUDIT.md)。本次整改前备份为 `.ui-check/backup-v18-audit-fix-20261021/`。
- 验收：AI 协议 40/40，v18 浏览器 100/100（控制台错误 0，含作用模块按钮四尺寸几何与刷新持久化），旧功能浏览器 57/57，v17 单测 26/26，首次启动 3/3，构建与结构审计通过。四尺寸覆盖 PC、手机窄屏及横屏。

完整范围、RP-Hub 来源/适配、前端审计整改、测试局限及回滚方法见 [V0.0.18_LOCAL_VALIDATION.md](./V0.0.18_LOCAL_VALIDATION.md)。本轮优化前备份为 `.ui-check/backup-v18-optimization-20261021/`；Git 基线不含接手时的未提交 v18，勿直接 reset 丢弃。最需后续真实使用验证的是服务商的工具/强度兼容性、总结质量和实体手机软键盘。

## v0.0.17 已上线（2026-10-14）— 历史发布状态

v0.0.17 经 [PR #6](https://github.com/Not1a-del/Moyun/pull/6) 合并到 `Not1a-del/Moyun:main`，发布提交 `ec973954cd16116e0073a1a3c65e0bdebfccd95d`（本地发布副本 `99a00ec`），`yydcm-129/Moyun:main` 已同步到同一提交；[Pages 构建 #76](https://github.com/Not1a-del/Moyun/actions/runs/38580401315) 成功，线上 https://not1a-del.github.io/Moyun/ 展示「1014更新」。32 个发布文件与本地验收文件逐字节一致，线上 7 个运行文件与本地构建逐字节一致，公告 PC/手机 8/8。发布前回滚基线 `44c3700799b0615903ae49809f60ced3c5a1b61d`（备份分支 `backup/v0.0.17-before-takeover-20261011`）。完整回执见 [V0.0.17_REPORT.md](./V0.0.17_REPORT.md)，检测明细见 [TEST_REPORT.md](./TEST_REPORT.md) 顶部。

### v0.0.17 接手时的三条现状（2026-10-18 历史记录）

> 以下待修描述针对当时的 v0.0.17；旧预设 UI 和首次初始化问题现已在本地 v0.0.18 修复，以上方当前工作版本为准。

1. **预设目前是两套并存。** 新系统 `promptPresets`（16 条内置：14 条可见 + 2 条隐藏人称，「设置 → 预设」可编辑，按 system/user/assistant 角色注入，**只作用于正文**）；旧系统 `presets`（11 条，默认启用 6 条，**没有任何 UI 入口，但仍向正文/建议/书评注入**）。实测旧系统每次正文请求隐形注入 **1959 字**，与新预设存在 3 条同名重复（防神化/防重复/禁止规则），人称也被注入两遍（`【叙事视角】` 段 + 隐藏条目）。详见 [V0.0.17_PRESET_AUDIT.md](./V0.0.17_PRESET_AUDIT.md)。**该问题尚未修复**：属产品行为变更，需用户授权、递增版本并跑 `npm run audit`。
2. **全新存档的预设列表为空。** `initBooks()` 建首本书时不写 `promptPresets`，`createNewBook()` 显式置空，只有 `loadBook` / 存档导入才补齐 16 条；首装用户会看到「预设 0 条 / 当前没有可见预设条目」。同为待修项。
3. **启动已本地化。** 固定版本依赖与许可证随仓库保存在 `assets/vendor/`，启动不再依赖远程 CDN 与 Google Fonts；`npm run preview` 可做不替换任何内容的本地静态预览。

### 交接文档同步规则（2026-10-18 新增，防复发）

上线或结束一轮后，**必须同时更新 `HANDOFF.md` 文首版本小节和 `TEST_REPORT.md` 文首检测小节**。v0.0.17 上线时这两份文档没有更新：文首仍是 v0.0.16，本文件「版本和分支规则」一节甚至写着 v0.0.15，导致下一轮接手按 v0.0.16 定位工作，导出历史版本回退副本去核对一个在 v0.0.17 已被删除的界面。文档滞后会污染判断起点，比单个功能缺陷更危险。

## v0.0.16 已上线（2026-09-26）

v0.0.16（含 0925 全部变更与 0926 侧栏动画删除、边框修复、保存/摘要修复）已提交 350fa1d 并推送 upstream（Not1a-del/Moyun，线上 Pages 源）与 origin，线上 https://not1a-del.github.io/Moyun/ 生效。外显公告已重写为「0926更新」，按天分组覆盖 0925+0926 两天内容，不出现版本号。线上公告冒烟 8/8、业务专项 30/30 实测通过，资产指纹与本地构建一致。此前线上停在 0923 的根因是上一轮只推了 origin 未推 upstream，本轮已纠正。详细见 V0.0.16_R4_REPORT.md。回滚基线 033eb41（backup/v0.0.16-announce-base-033eb41）。后续修改未经用户命令不上传、不另升版本。

## v0.0.16 当前修复状态（2026-09-25）

本轮继续归入 v0.0.16，分支 fix/v0.0.16-save-summary-mods，未上传。已修复首轮保存回归，不能再直接把 Vue Proxy 放进 IndexedDB 快照。预设名称已恢复；摘要缺失弹独立补写提醒，二轮/三轮设定生效；关闭或失败时用户明确选择“保留正文、警告、仍可续章”。MOD 扩展测试已按用户最新要求停止。详细结果以 V0.0.16_R2_REPORT.md 和 TEST_REPORT.md 顶部为准，后续未经用户命令不上传、不另升版本。

# Moyun 接手说明

## 当前本地状态（2026-09-25）

> 以下为 v0.0.16 阶段的历史记录；当前本地状态见文首 v0.0.18 小节，历史上线状态见 v0.0.17 小节。

v0.0.16 已在主工作区实现并通过本地验收，尚未上传；后续对话与修改继续归入本版直到用户下达上传命令。分支 feat/v0.0.16，回滚基线 4e8b20e 保留用户原手动改动。详情见 V0.0.16_PLAN.md、TEST_REPORT.md 和 UPDATE_LOG.md 顶部。预览按书保存/回写，导入可新建或合入，两端沉浸隐藏但仅 PC 放大。白鸟宿主预设锁定是特性，不能修掉。上传前按当日 MMDD 更新公告。


## 当前发布状态（2026-09-23）

v0.0.15 已上传到 Not1a-del/Moyun main，运行时代码提交 35a2305，Pages 已部署成功，线上公告为 0923。发布后 15 项业务、17 项二轮补写、8 项公告检查通过。后续文档回执提交不改变这些资产。主目录与发布代码的功能保持一致，用户原有未提交文本和 AGENTS.md 修改只保留在本地。本文下方的“未上传”说明为早期阶段记录，以本节及 TEST_REPORT.md 顶部为准。

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

- Vue 3 从 `assets/vendor/vue.global.js` 本地加载，应用逻辑集中在单文件源的内联脚本中。
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

当前工作版本：`v0.0.19` 第一轮热更新，分支 `fix/v0.0.19-mobile-hotfix`；具体部署状态以本文文首及热更新发布回执为准。

接手下一轮时：

1. 先读取 `AGENTS.md`（含 v0.0.12 新增的"结构级坑与精准排障手册"一节）、本文件、[UPDATE_LOG.md](./UPDATE_LOG.md)、[TEST_REPORT.md](./TEST_REPORT.md) 和 [V0.0.17_PRESET_AUDIT.md](./V0.0.17_PRESET_AUDIT.md)。
2. 检查 `git status --short --branch`，确认没有覆盖用户未提交的修改。
3. 修改前保留上一稳定版本并切到新的修复分支，再开始源码修改。
4. 升版和同版热更新依用户当轮要求及 `AGENTS.md`，完成测试后更新日志和检测报告。
5. 需要回滚时使用对应分支/提交；不要使用 `git reset --hard` 或删除用户数据。
6. 上线或结束一轮后，同步更新本文件文首版本小节与 `TEST_REPORT.md` 文首检测小节（见上方「交接文档同步规则」）。
7. v0.0.17 的旧预设缺少 UI 与首装空预设列表已在 v0.0.18 修复；`V0.0.17_PRESET_AUDIT.md` 保留作历史调查记录，不能把其中施工单当作当前待办重复执行。

## 上传接手入口（2026-11-16 校正）

- 用户 `yydcm-129` 已是上游 `Not1a-del/Moyun` 的协作者（写权限，2026-09-14 只读核验 `permissions.push=true` + collaborators 204）。无上传指令时交付默认只做本地提交。
- 执行根目录 `AGENTS.md` 的公测确认规则及 [DEPLOYMENT.md](DEPLOYMENT.md)；历史的直接发布或 PR 记录不能替代当前用户的公测决定。不要重新创建已有 fork。
- 使用本机已授权账号，不再依赖旧文档所述磁盘 Token 文件。仓库设置和 Pages 来源分开核对，两站线上资源均须验证；具体回执见本文文首。
- 公告现在有历史列表 `WEB_UPDATE_ANNOUNCEMENTS`，当前项为 `WEB_UPDATE_ANNOUNCEMENT`。本次用户明确不要新公告，保持既有条目、日期和已读标记；不得以旧规则为由改写或重复弹出。

## 标准验证

```powershell
npm run build
node --check assets/js/moyun.js
npm run audit
git diff --check
```

涉及 UI 时执行 `AGENTS.md` 的结构、几何、命中和正文滚末段检查，使用隔离浏览器，不能向用户日常书库注入测试数据。手机／平板专项已经纳入 `npm run gate:browser`，不再只测 390px。只使用已有 Node／浏览器；结束自己启动的检查服务，保留用户的预览服务。

## 不可触碰内容

- `F:\yydcm129\codex 自用小说软件\图片和文件\绘图风格2.0.txt` 是用户提供的示例文件，严禁修改。
- 不得未经明确授权下载软件、安装依赖、发送真实 API 请求或上传用户作品。
- 不要把 API Key、Token、真实作品或浏览器导出数据写进仓库。

## 交付格式

每轮最终交付必须说明：版本号、临时分支/提交、更新说明、测试方法和结果、已知风险、回滚位置，以及示例文件未修改的确认。
