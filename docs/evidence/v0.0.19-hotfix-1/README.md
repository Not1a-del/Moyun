# v0.0.19 第一轮热更新共享证据

从最终本地验收结果归档，修复提交 `a018e50`。门禁结束时间 `2026-11-16T14:02:55.535Z`，不是本次文档归档时重新执行。数据为隔离浏览器合成样例，不含用户书库和密钥。

| 文件 | 内容 |
| --- | --- |
| gate-results.json | 18 步命令、退出码和状态；保留完整结构审计输出，其他步骤只摘运行结果以避免重复大段日志 |
| mobile-results.json | 170 项手机／桌面几何、滚动和命中结果 |
| tablet-results.json | 30 项触屏平板／桌面结果 |
| extra-results.json | 40 项空白／长文本角色、开关边缘点击、平板键盘 resize 结果 |
| mobile-dark-toggles.png | 360×740 深色补写开关 |
| mobile-light-settings.png | 360×740 浅色设置固定分类栏 |
| mobile-light-keyboard.png | 手机模拟键盘后的续写操作区 |
| tablet-light-browser-bars.png | 1024×1366 触屏平板模拟工具栏，双栏和底部操作保留 |
| tablet-dark-keyboard.png | 1024×768 平板模拟键盘与顶部偏移 |
| desktop-light-settings.png | 1280×800 电脑设置布局 |
| public-release-results.json / formal-release-results.json | 使用修正刷新等待后的脚本，两站各 18/18 线上结果；包括全部 8 个启动文件原始字节 SHA-256、四组尺寸主题与真实入口点击 |
| formal-first-attempt.json / formal-transition-attempt.json | 正式站前两次未通过的脚本结果，分别为刷新旧状态、动画中按钮尺寸；不计入通过 |
| release-receipt.json | 运行候选、账号、两站 Pages 部署与线上结果摘要 |
| manifest.json | 上述机器结果／截图的字节数与 SHA-256，README 不计入；文本按 Git 原始 LF 字节核对，Windows 检出后需先归一化换行 |

主要命令：`npm.cmd run gate:browser`。其中手机入口 `node scripts/v19-outline-review-browser.cjs --mobile-layout`，平板再加 `--tablet-layout`，两项均已纳入门禁。补充检查使用本机 `.ui-check/mobile-hotfix/extra/run.cjs`，其输入与步骤记录在[完整修复报告](../../V0.0.19_MOBILE_HOTFIX_REPORT.md)；该临时补充脚本不作为发布门禁依赖。

截图仅证明本机 Edge 和模拟可视区；真机／iOS／厂商工具栏差异仍待用户公测。线上发布证据在[发布回执](../../V0.0.19_HOTFIX_RELEASE_REPORT.md)中另记，不与这里的本地结果混用。
