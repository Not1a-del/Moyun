# 阅读导航设置本地验收证据（2026-11-18）

本目录根部对应 `fix/v0.0.19-reader-navigation-settings` 的原本地验收，基于 `1a86b37`；当时尚未提交，因此根部门禁记录该基线、workingTreeDirtyBeforeRun 为 true。当前设置已随候选 `418f969` 发布公测，新增的 [release/](release/README.md) 保存本次完整线上 55 项结果、部署和代理清理回执。正式库尚未同步该候选。

- `gate.json`：`npm.cmd run gate` 9/9，包括构建、结构审计、语法与 v19 319 项回归。没有跳过或失败；不是完整浏览器门禁。
- `reader-results.json`：`node scripts/v19-outline-review-browser.cjs --reader-onekey` 28/28，含默认关闭、自定义时序、保存刷新、鼠标和触摸、相关角色与开书回归。
- `search-results.json`：`node scripts/v19-outline-review-browser.cjs --settings-search` 421/421。保留所有断言名称和结果、新导航六种布局的完整跳转数据；其余重复详细数据留在本地 `.ui-check/settings-search/results.json`。异常与控制台错误均为 0。
- `settings-*.png`：1280×800、1024×1366、360×740、320×740 明暗主题的新开关及时间输入框。768×800 另有几何断言，见 reader-results。

使用隔离 Edge 与合成书稿；关联 AI 测试使用本地流式假模型，无在线模型请求。只证明已覆盖的浏览器场景，不代表 iOS／厂商浏览器真机验证。此前两站 110 项线上证据在相邻的 `v0.0.19-context-release` 目录，不能用于声称新增设置已上线。
