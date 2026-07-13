# 部署与更新

## 当前部署

- 托管：GitHub Pages
- 发布分支：`main`
- 发布目录：仓库根目录 `/`
- 访问地址：https://not1a-del.github.io/Moyun/

## 发布新版本

1. 更新 `source/moyun.single.html`。
2. 运行 `npm run build`，生成根目录 `index.html` 和 `assets/`。
3. 提交并推送到 `main` 分支。
4. GitHub Pages 会自动重新构建；通常在数分钟内生效。
5. 访问网页并进行一次硬刷新，确认标题、设置页和主要写作界面正常加载。

## 自定义域名

当前无需购买域名，`not1a-del.github.io/Moyun/` 可长期使用。

若之后需要独立品牌域名：

1. 在域名服务商购买域名。
2. 打开 GitHub 仓库 `Settings` → `Pages` → `Custom domain`。
3. 按 GitHub 页面给出的 DNS 记录在域名服务商处配置。
4. DNS 生效后，在 GitHub 开启 `Enforce HTTPS`。

不要在仓库中提交 DNS 密钥、API Key、访问 Token 或个人创作数据。
