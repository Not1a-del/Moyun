# 输入保留双仓发布证据

候选 `983ac881b5d730bf7a6de94747d537c26435d08c`，2026-11-22 发布。

- `gate-basic.json`：本轮发布前普通门禁 9/9，含结构审计。
- `pages-receipts.json`：认证账号、两仓 main:/ 与候选构建回执。
- `public-release.json`、`public-tablet.json`：公测 25+30 项。
- `stable-release.json`、`stable-tablet.json`：正式 25+30 项，后者是失败后按原参数补验的结果。
- `initial-release-gate.json`、`initial-stable-tablet.log`：首次正式站平板冷启动失败；原 gate 失败结果保留。
- `stable-tablet-retry.log`：仅重跑平板专项，30 项通过。
- `results.json`：最终覆盖汇总，110 项全部通过；不代表首次 gate 全绿。

完整截图仍在本机 `.ui-check/release-gate/` 及 `.ui-check/mobile-hotfix/tablet-smoke/`。没有包含用户私有书稿或凭据；没有调用真实模型或进行真机验证。
