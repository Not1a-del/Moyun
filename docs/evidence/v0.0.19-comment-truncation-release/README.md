# 评论跟随与截断设置：双仓线上证据

功能候选 `f624e0c390e8f4af514ccd2d2f4f4cf9e4f7ee89`；日期 2026-11-22。两站真实 HTTPS 页面、隔离 Edge 和书库；AI 交互使用本地 SSE／JSON mock，不产生真实模型费用。

- `summary.json`：220 项线上检查汇总，两个站点地址和执行命令。
- `release-gate-results.json`：两站入口各 25、平板各 30 的 110 项结果，含候选 SHA、命令和耗时。
- `public/`／`stable/`：各站 `release-results.json`、`tablet-results.json`、`features-results.json`，逐项结果与请求摘要；对应 `.log` 和代表截图。新功能各 55 项通过，Gemini 双开关全开／全关、0 条费用拦截、超长全文、搜索和刷新保存均有覆盖。
- `repo-metadata.json`：已登录 Cindy GitHub 插件现场读取的仓库身份与 homepage。
- `workflow-candidate.json`／`pages-candidate.json`：候选两次 Pages 成功回执、来源 main:/、完整 SHA、执行账号。
- `audit.log`／`base-gate.json`：发布前重跑的审计与普通门禁。更早的完整本地 26/26 与首轮失败记录见相邻 `v0.0.19-comment-truncation/`。

本轮以 Git 原始字节核对线上 8 个启动文件；完整指纹在每站 `release-results.json` 内。回执文档追加提交不改运行文件。所有数据为合成场景，未包含真实私人书稿或凭据。未覆盖真实服务商及真机 iOS／厂商浏览器，具体范围和回滚见 [发布报告](../../V0.0.19_COMMENT_TRUNCATION_RELEASE_REPORT.md)。
