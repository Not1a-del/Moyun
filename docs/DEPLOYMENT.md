# 部署与更新

## 当前部署

- 托管：GitHub Pages
- 发布分支：`main`
- 发布目录：仓库根目录 `/`
- 访问地址：https://not1a-del.github.io/Moyun/

## 发布新版本

1. 更新 `source/moyun.single.html`。
2. 运行 `npm run build`，生成根目录 `index.html` 和 `assets/`。
3. 运行 `node --check assets/js/moyun.js`、`node output/bug-audit/stage8-full-regression-runner.cjs` 和 `node output/bug-audit/stage8-finalize-report.cjs`；确认 `output/playwright/bug-audit-final-report.json` 为 `passed=true`。
4. 检查 `git diff --check`、真实暂存区和待提交清单；只暂存本轮明确文件，不使用 `git add .`。
5. 只有用户明确批准上线后，才提交并推送到 `main` 分支。
6. GitHub Pages 会自动重新构建；通常在数分钟内生效。
7. 硬刷新线上页面，用桌面与约 `390px` 手机视口复验加载、连接中心、正文主操作和本轮变更；若包含公告，再验证首次用户与已读用户状态。

全量脚本中的当前线上检查是发布前的只读基线，不代表新候选已经部署。推送后必须使用新提交 SHA、生成资产指纹和预期公告文字重新执行线上冒烟。

## 自定义域名

当前无需购买域名，`not1a-del.github.io/Moyun/` 可长期使用。

若之后需要独立品牌域名：

1. 在域名服务商购买域名。
2. 打开 GitHub 仓库 `Settings` → `Pages` → `Custom domain`。
3. 按 GitHub 页面给出的 DNS 记录在域名服务商处配置。
4. DNS 生效后，在 GitHub 开启 `Enforce HTTPS`。

不要在仓库中提交 DNS 密钥、API Key、访问 Token 或个人创作数据。
