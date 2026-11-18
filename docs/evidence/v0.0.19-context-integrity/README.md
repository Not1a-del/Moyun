# 作者设定、旧书备份与阅读反馈验收证据

仅含合成书截图、断言、脱敏计数和内容指纹；不含私人书稿、原备份、真实接口配置或密钥。本轮保持 v0.0.19，未上传或部署。具体场景、命令和边界见 [专项报告](../../V0.0.19_CONTEXT_INTEGRITY_REPORT.md)。

- `reader-onekey.json`：26 项。AI 新角色保存与刷新、旧格式角色导入、文风同发、长角色库预算，以及开书勾选和 5 个宽度 × 明暗导航。
- `context-integrity.json`：19 项。默认不自动维护旧记忆、近期原文、完整角色事实、全量备份／追加导入／失败回滚与授权开关。
- `real-backup-counts.json`：10 项。用户约 200 MB 旧书经本机原生文件导入、保存刷新、模拟续写、导出再导入；只有计数和指纹，无正文。
- `reader-*.png`、`memory-*.png`：1280×800、1024×1366、360×740，浅／深主题。320／768 的几何和点击断言见 JSON。
- `audit.log`、`gate-unit.json`：结构审计与普通门禁；最终完整浏览器门禁另存 `gate-browser.json`，不能用普通门禁代替。
- `gate-browser.json`、`gate-browser.log`：最终一次完整 24/24，通过时源码与构建未变；字节指纹见 `build-integrity.json`。
- `character-relations.json`、`mobile-layout.json`、`tablet-layout.json`、`settings-search.json`：本轮完整门禁中的相关回归明细。
- `gate-first-failed.json`、`release-animation-failed.json`：先前失败的原始回执，不计为通过。修复与测试等待条件的原因在报告中说明。

这些结果证明本地数据与发送链路，不证明真实模型永远遵守人设。公测／正式站未部署本轮修改，真机 iOS 与厂商浏览器仍需用户复验。
