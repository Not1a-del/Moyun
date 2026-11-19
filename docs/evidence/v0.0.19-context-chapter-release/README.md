# 全文章数修复双仓上线证据

2026-11-19，候选 `19ef13d1aabb36778caea8725ba0cef11a0ea7b4`；[发布报告](../../V0.0.19_CONTEXT_CHAPTER_RELEASE_REPORT.md)。两站均为实际 HTTPS，独立 Edge 档案，不读日常书库、不调用模型。

- audit.log、gate.log、gate-report.json：本次发布前普通审计／门禁9/9、v19 326/326，无失败／跳过。
- candidate-pages-runs.json：GitHub插件读取两站候选Pages构建，#31／#93 success。
- repo-metadata.json：已登录插件读取两仓身份，供线上门禁使用；不含凭据。
- release-results.json、online.log：两站共4步、110项（每站25项入口／30项平板）通过，记录命令、耗时和候选SHA。
- public／stable下release与tablet：各次完整断言、运行日志；入口记录8个启动文件的在线SHA-256；精选320／390／1280及1024触屏平板明暗截图。
- deployment.json：实际Pages main:/来源、部署commit、执行账号、代理状态；系统代理0、7890无监听、核心进程为空，原7890配置保留。既有管理服务保持原状。

复现命令：`npm.cmd run gate:release -- --repo-metadata .ui-check/context-chapter-release/repo-metadata.json`。元信息回执仅在一小时内有效，再次执行需通过插件重新读取。截图仅代表模拟视口，不能代替iOS和厂商真机；本地章数运行态证据另见同级v0.0.19-context-chapter-settings目录。
