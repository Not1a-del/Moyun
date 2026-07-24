# 墨韵

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
[![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D.svg?logo=vue.js)](https://vuejs.org/)

> 面向长篇创作的纯前端小说写作工作台。

**在线体验：** https://not1a-del.github.io/Moyun/

## 支持 Moyun

Moyun 由 Not1a-del 持续维护与迭代。若项目对你有帮助，欢迎通过 [爱发电](https://ifdian.net/a/moyunapp) 自愿支持测试、设计与后续开发投入。

赞助不等同于购买功能或服务，不影响现有公开功能的正常使用。

## 项目说明

墨韵是本地优先的纯前端 Web 写作工作台，提供书籍、章节、大纲、细纲、创作设定、角色、事件与关系图等能力。它不需要项目方服务器：作品和连接凭据保存在使用者自己的浏览器中，模型服务由使用者自行配置兼容接口。

## 核心特性

- 书籍、章节、大纲、细纲与正文的本地化管理。
- 创作设定工作台：项目承诺、世界总览、结构化资料、事件时间线与可解释的上下文安全预览。
- 角色工作台：速写/常规/核心三档资料、状态记录、稳定关系、AI 草案逐项审阅与关系图。
- 细纲可按稳定 ID 钉选本章活跃角色和世界资料；正文、AI 建议、大纲与细纲共用同一上下文选择结果。
- 支持自定义兼容 API 地址、密钥与模型名称。
- 支持导入、干净书稿导出、本地快照与持久化；优先使用 IndexedDB，并提供轻量 localStorage 兜底。
- 包含创作辅助、白鸟扩展兼容与可控的高风险扩展提示机制。
- 构建结果可部署到 GitHub Pages 等静态托管服务；第三方 CDN 与模型调用仍需要网络。

## 快速开始

### 在线使用

访问 https://not1a-del.github.io/Moyun/ ，在设置中填写你自己的 API 地址、API Key 和模型名称后开始使用。

### 本地使用

1. 点击 GitHub 的 `Code` → `Download ZIP` 下载项目。
2. 解压后双击 `index.html`。
3. 如浏览器限制本地资源或接口跨域，可通过任意静态文件服务器打开该目录。

## 安全与隐私

- 不要把 API Key、Token、个人作品或浏览器导出数据提交到 GitHub。
- 当前网页是静态站点；部署后应用源码可被访问者查看。
- API Key 由浏览器本地保存，其他访问者不能直接读取你的浏览器存储；但仍应只使用可信设备和可信扩展。
- 导入第三方主题、MOD 或 Skill 前，请先核验来源与权限说明。

## 项目结构

```text
Moyun/
├── index.html              # GitHub Pages 入口（由构建器生成）
├── source/
│   └── moyun.single.html   # 网页版唯一业务源
├── assets/
│   ├── css/moyun.css       # 生成的应用样式
│   └── js/moyun.js         # 生成的应用逻辑
├── scripts/
│   └── build-static-site.cjs # 从单文件源生成网页资产
├── README.md               # 项目介绍与使用说明
├── LICENSE                 # CC BY-NC 4.0 完整协议
└── docs/
    ├── DEPLOYMENT.md       # GitHub Pages 更新与部署说明
    ├── ONLINE_VERSION_USER_GUIDE.md
    └── ONLINE_VERSION_COMPLETE_DEVELOPER_GUIDE.md
```

`source/moyun.single.html` 是网页版唯一业务源；构建器将其中的样式和逻辑拆分为真实的 CSS 与 JavaScript 资产。它不属于已冻结的离线交付线。修改源文件后运行 `npm run build`，不要直接修改生成的 `index.html` 或 `assets/` 文件。

## 部署

本仓库已通过 GitHub Pages 从 `main` 分支根目录部署。更新和自定义域名的操作见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 开发与 MOD 文档

- [网页版完整开发与 MOD 共创接口指南](docs/ONLINE_VERSION_COMPLETE_DEVELOPER_GUIDE.md)：唯一网页源、构建与发布、连接中心与协议、数据安全、公告维护、MOD API 1.1、主题和 Skill 信任边界、测试与排错。
- [网页版用户指南](docs/ONLINE_VERSION_USER_GUIDE.md)：创作设定、角色、事件、关系图、上下文安全预览、移动端操作与备份导出。
- [部署与更新](docs/DEPLOYMENT.md)：GitHub Pages 的精简发布流程。

网页版运行时只认“连接中心”的配置与模块路由；请勿把冻结离线文件作为网页发布源，也不要直接修改生成的 `index.html` 或 `assets/`。

## 维护者发布前门禁

应用或接口改动完成后，至少执行：

```powershell
npm run build
node --check assets/js/moyun.js
node output/bug-audit/stage8-full-regression-runner.cjs
node output/bug-audit/stage8-finalize-report.cjs
```

全量回归会串行运行静态合同、连接中心、上下文、白鸟/MOD、干净导出、生成取消、弹窗、桌面/手机/短屏与当前线上只读基线，耗时明显长于普通 smoke。只有 `output/playwright/bug-audit-final-report.json` 显示 `passed=true`，且用户明确批准上线，才可以选择性暂存本轮文件、提交并推送；不要使用 `git add .`。

## 第三方依赖

页面通过 CDN 使用 Vue 3、Tailwind CSS、Marked、diff-match-patch 与 Google Fonts。它们各自适用独立许可证；本仓库的 `LICENSE` 仅适用于墨韵原创内容。

## 协议与许可

本项目采用 [Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/deed.zh-hans) 协议。

- 可以在遵守协议的前提下分享和修改本项目。
- 使用或再发布时必须保留对“墨韵 / Not1a-del”的合理署名，并标明修改。
- 不得将本项目或其衍生版本用于商业目的，包括收费服务、售卖、付费产品集成或广告获利。

完整条款见 [LICENSE](LICENSE)。
