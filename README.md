# 墨韵

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
[![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D.svg?logo=vue.js)](https://vuejs.org/)

> 面向长篇创作的纯前端小说写作工作台。

**在线体验：** https://not1a-del.github.io/Moyun/

## 支持 Moyun

Moyun 由 Not1a-del 持续维护与迭代。若项目对你有帮助，欢迎通过 [爱发电](https://ifdian.net/a/moyunapp) 自愿支持测试、设计与后续开发投入。

赞助不等同于购买功能或服务，不影响现有公开功能的正常使用。

## 项目说明

墨韵以单文件 Web 应用形式运行，提供书籍、章节、大纲、细纲、人物与创作辅助等工作区能力。它不需要自建服务器：页面数据保存在使用者自己的浏览器中，模型服务由使用者自行配置兼容接口。

## 核心特性

- 书籍、章节、大纲、细纲与人物资料的本地化管理。
- 支持自定义兼容 API 地址、密钥与模型名称。
- 支持导入、导出与本地持久化；优先使用 IndexedDB，并提供轻量 localStorage 兜底。
- 包含创作辅助、白鸟扩展兼容与可控的高风险扩展提示机制。
- 单一 `index.html` 即可离线打开或部署到任意静态托管服务。

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
│   └── moyun.single.html   # 保留离线能力的单文件源
├── assets/
│   ├── css/moyun.css       # 生成的应用样式
│   └── js/moyun.js         # 生成的应用逻辑
├── scripts/
│   └── build-static-site.cjs # 从单文件源生成网页资产
├── README.md               # 项目介绍与使用说明
├── LICENSE                 # CC BY-NC 4.0 完整协议
└── docs/
    └── DEPLOYMENT.md       # GitHub Pages 更新与部署说明
```

`source/moyun.single.html` 保留单文件离线交付能力；公开站将其拆分为真实的 CSS 与 JavaScript 资产。修改源文件后运行 `npm run build`，不要直接修改生成的 `index.html` 或 `assets/` 文件。

## 部署

本仓库已通过 GitHub Pages 从 `main` 分支根目录部署。更新和自定义域名的操作见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 第三方依赖

页面通过 CDN 使用 Vue 3、Tailwind CSS、Marked、diff-match-patch 与 Google Fonts。它们各自适用独立许可证；本仓库的 `LICENSE` 仅适用于墨韵原创内容。

## 协议与许可

本项目采用 [Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/deed.zh-hans) 协议。

- 可以在遵守协议的前提下分享和修改本项目。
- 使用或再发布时必须保留对“墨韵 / Not1a-del”的合理署名，并标明修改。
- 不得将本项目或其衍生版本用于商业目的，包括收费服务、售卖、付费产品集成或广告获利。

完整条款见 [LICENSE](LICENSE)。
