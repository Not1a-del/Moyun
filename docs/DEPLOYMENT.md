# 部署与更新

## 当前部署

- 托管：GitHub Pages
- 发布分支：`main`
- 发布目录：仓库根目录 `/`
- 正式库／地址：`Not1a-del/Moyun:main`（upstream），https://not1a-del.github.io/Moyun/
- 公测库／地址：`yydcm-129/Moyun:main`（origin），https://yydcm-129.github.io/Moyun/
- v0.0.19 阅读导航候选 `f5671a48445f4918d748b5b5709b92f2f3154d67` 已同步两仓；公测 Pages #25、正式 Pages #87 成功。两站线上门禁各 55/55，详情见 `docs/V0.0.19_READER_NAVIGATION_SETTINGS_REPORT.md`。
- 用户于 2026-11-16 确认复用现有 fork 作为公测库；不再使用旧 `yydcm-129-patch-1` 部署。设置变更、部署结果以本轮[发布回执](V0.0.19_HOTFIX_RELEASE_REPORT.md)为准。

## 发布新版本

1. 更新 `source/moyun.single.html`。
2. 运行 `npm run build`，生成根目录 `index.html` 和 `assets/`。
3. 运行 `npm run audit`、`npm run gate`，需要完整浏览器回归时运行 `npm run gate:browser`；确认 `.ui-check/gate-report.json` 为 `passed=true` 且无失败/跳过。门禁已包含构建、生成脚本语法和受影响的功能回归；浏览器使用本机已有 Edge 及隔离档案。旧的 `output/bug-audit/` 路径不再使用。仅改公告或文档时，在此前完整门禁的基础上重跑普通门禁、公告及线上专项，不把旧报告当作新增检查的结果。
4. 检查 `git diff --check`、真实暂存区和待提交清单；只暂存本轮明确文件，不使用 `git add .`。
5. 用户批准公测上传后，先用插件和 `git ls-remote` 核对两仓 `main`，取回引用确认可快进。先将候选提交普通推送至 `origin/main`，不得 force push；核实公测 Pages 来源为 `main`、目录 `/`，部署成功且线上文件与候选一致。记录公测候选完整 SHA、范围、证据与待用户确认状态。
6. GitHub Pages 会自动重新构建；通常在数分钟内生效。
7. 公测部署后必须执行 `npm run gate:release -- --site public`，正式部署后执行 `npm run gate:release` 检查两站。需要本机代理时追加 `--proxy http://127.0.0.1:7890`。顺序复用隔离 Edge，不读日常书库、不请求模型。核对仓库 homepage／描述／反馈入口、网页公测标识、关于页两站链接、8 个启动文件 SHA-256、1280／390／320 明暗主题与公告、设置搜索和实际点击，再测 1024×1366 触屏平板／1280×800 电脑及工具栏变化、正文末段和底部按钮。分站日志、截图、断言写入 `.ui-check/release-gate/{public,stable}/{release,tablet}/`，汇总 `results.json` 必须 passed=true 且无遗漏步骤。Windows 工作目录 CRLF 不作线上原始字节基准，运行文件必须与已提交并部署的 Git HEAD 一致。

8. **等待用户明确确认公测候选后，才发布正式库。** 没有反馈、测试通过、部署成功均不算用户确认；公测期间可与正式库不同。用户确认后再次检查 upstream 可快进，推送同一候选到 `upstream/main`，复验正式 Pages 和线上文件；若候选之后又改了运行文件，要重新公测确认。两仓可追加相同的文档回执提交，不能借此夹带未经确认的代码。
9. 记录两仓远端 SHA、两个 Pages 部署状态、线上资产指纹、测试范围、未覆盖边界、用户确认和回滚点；更新 `UPDATE_LOG.md`、`TEST_REPORT.md`、`HANDOFF.md` 文首。旧阶段的“未上传”仅是历史记录。

本次 v0.0.19 第一轮热更新已获用户授权发布两站，不需再等待一次确认；后续更新执行上述先公测后确认流程。本次保留 `0.0.19`，不改页面内 1116 公告和已读键。文档更新不等于新增页面公告。

2026-11-17 用户再次明确授权：本次旧书记忆恢复、快照管理及公测入口说明直接同步正式库。发布回执见 [本轮报告](V0.0.19_PUBLIC_RELEASE_REPORT.md)。以后公测库与平板均为固定验收项；报告必须区分桌面模拟和真机反馈。

GitHub 插件优先。它未提供仓库更新、Pages 设置和本地提交原样推送时，使用本机已授权的 `yydcm-129` Git/REST，操作前用 `/user` 核实账号。不要以提交 author 代替执行账号核对，不输出凭据；代理仅传当前命令。仓库默认分支和 Pages 来源分别核实，前者改对不代表后者已经改对。

2026-11-19 用户补充代理限制：只允许 GitHub 使用代理，不能用于其他网站。GitHub 自有 API、源码／产物及 Pages 属于发布范围；例如 github.com、api.github.com、githubusercontent.com、github.io，其他流量必须直连或拒绝。优先直连；未经本轮授权不主动启停代理。确需临时启用时，仅给 GitHub 命令或域名配置代理，不开启系统全局代理、不永久改 Git 设置。保留 7890 配置，上传与验收结束后关闭临时代理，核查进程、端口和系统代理状态。无法可靠关闭时须如实说明，不声称已关闭。授权不延伸到后续任务。

共享代理下匿名 GitHub API 返回403时，先用 GitHub 插件 `get_repo` 重新读取两仓，将 `generatedAt`、`source: "Cindy GitHub 插件 get_repo（已登录账号）"` 和 `repos` 写入项目外或 `.ui-check/release-gate/repo-metadata.json`。每条保留 `full_name`、`homepage`、`description`、`has_pages`、`has_issues`、`default_branch`；线上命令追加 `--repo-metadata .ui-check/release-gate/repo-metadata.json`。脚本仍逐项断言，且只接受一小时内回执。凭据不放网页或回执，元信息失败不计通过。

全量脚本中的当前线上检查是发布前的只读基线，不代表新候选已经部署。推送后必须使用新提交 SHA、生成资产指纹和预期公告文字重新执行线上冒烟。

## 自定义域名

当前无需购买域名，`not1a-del.github.io/Moyun/` 可长期使用。

若之后需要独立品牌域名：

1. 在域名服务商购买域名。
2. 打开 GitHub 仓库 `Settings` → `Pages` → `Custom domain`。
3. 按 GitHub 页面给出的 DNS 记录在域名服务商处配置。
4. DNS 生效后，在 GitHub 开启 `Enforce HTTPS`。

不要在仓库中提交 DNS 密钥、API Key、访问 Token 或个人创作数据。
