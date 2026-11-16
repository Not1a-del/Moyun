# 部署与更新

## 当前部署

- 托管：GitHub Pages
- 发布分支：`main`
- 发布目录：仓库根目录 `/`
- 访问地址：https://not1a-del.github.io/Moyun/

## 发布新版本

1. 更新 `source/moyun.single.html`。
2. 运行 `npm run build`，生成根目录 `index.html` 和 `assets/`。
3. 运行 `npm run audit`、`npm run gate`，需要完整浏览器回归时运行 `npm run gate:browser`；确认 `.ui-check/gate-report.json` 为 `passed=true` 且无失败/跳过。门禁已包含构建、生成脚本语法和受影响的功能回归；浏览器使用本机已有 Edge 及隔离档案。旧的 `output/bug-audit/` 路径不再使用。仅改公告或文档时，在此前完整门禁的基础上重跑普通门禁、公告及线上专项，不把旧报告当作新增检查的结果。
4. 检查 `git diff --check`、真实暂存区和待提交清单；只暂存本轮明确文件，不使用 `git add .`。
5. 只有用户明确批准上线后，才上传。先用 `git ls-remote` 核对 `upstream`（Not1a-del/Moyun）与 `origin`（yydcm-129/Moyun）的 `main`，取回远端引用并确认它们都是待发布提交的祖先；普通快进推送 `HEAD:main`，先 `upstream`、再 `origin`，不得 force push。不必切换当前开发分支。
6. GitHub Pages 会自动重新构建；通常在数分钟内生效。
7. 硬刷新线上页面，用桌面与约 `390px` 手机视口复验加载、连接中心、正文主操作和本轮变更；若包含公告，再验证首次用户与已读用户状态。当前可用 `node scripts/v19-outline-review-browser.cjs --release-smoke --url https://not1a-del.github.io/Moyun/`，本机需要代理时追加 `--proxy http://127.0.0.1:7890`。脚本核对线上运行文件与本地 SHA-256、公告及设置入口，证据写入 `.ui-check/release-smoke/`。

8. 核对两仓远端 SHA 一致并记录 Pages 部署状态、线上资产指纹、测试范围、未覆盖边界及回滚点；同时更新 `UPDATE_LOG.md`、`TEST_REPORT.md` 和 `HANDOFF.md` 文首。旧阶段的“未上传”记录保留为历史，以最新发布回执为准。

全量脚本中的当前线上检查是发布前的只读基线，不代表新候选已经部署。推送后必须使用新提交 SHA、生成资产指纹和预期公告文字重新执行线上冒烟。

## 自定义域名

当前无需购买域名，`not1a-del.github.io/Moyun/` 可长期使用。

若之后需要独立品牌域名：

1. 在域名服务商购买域名。
2. 打开 GitHub 仓库 `Settings` → `Pages` → `Custom domain`。
3. 按 GitHub 页面给出的 DNS 记录在域名服务商处配置。
4. DNS 生效后，在 GitHub 开启 `Enforce HTTPS`。

不要在仓库中提交 DNS 密钥、API Key、访问 Token 或个人创作数据。
