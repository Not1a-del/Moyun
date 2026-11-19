# 阅读导航设置正式站发布证据（2026-11-19）

正式库 `Not1a-del/Moyun:main` 与公测库同为候选 `f5671a48445f4918d748b5b5709b92f2f3154d67`。正式 Pages #87 成功，来源为 main 根目录。GitHub 操作账号 `yydcm-129`，正式库写权限在发布前已核实。

- `results.json`：完整 `gate:release --site stable` 汇总，入口／手机 25 项、触屏平板 30 项，共 55 项，失败／跳过为 0。
- `formal-release.json`、`formal-tablet.json` 与日志：正式站各项线上断言；8 个启动文件与候选一致。
- `repo-metadata.json`：GitHub 插件读取的两仓地址、默认分支及 Pages 信息。
- `pages-deployment.json`：正式 Pages 构建提交、运行编号及结果。
- PNG：隔离 Edge 下正式站 1280、390、320 手机和 1024 触屏平板的合成页面截图，不含用户数据。

线上检查未调用真实模型。模拟视口不能代替 iOS／厂商浏览器真机检查；新增开关的自定义时序与保存刷新由本地 28 项浏览器验收覆盖。
