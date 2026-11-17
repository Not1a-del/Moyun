# v0.0.19 公测入口与两站发布证据

运行文件在完整本地门禁候选 `89c1d83` 后未变化；`0dd2770` 只补验收脚本与文档，解决代理下匿名 GitHub 元信息403。后续回执提交仅归档文档与证据。用户真实书稿、备份、密钥和可导入测试文件不在这里。

| 文件 | 内容 |
| --- | --- |
| local-gate-results.json | 最终本地21步状态、命令与耗时，保留结构审计输出 |
| online-gate-results.json | 公测与正式两站的发布／平板专项汇总 |
| public-release.json / stable-release.json | 各站25项断言，含8个启动文件的原始字节SHA-256 |
| public-tablet.json / stable-tablet.json | 各站30项平板／恢复电脑检查 |
| repo-metadata.json | 已登录账号通过GitHub插件核实的两仓入口信息，不含凭据 |
| release-receipt.json | 候选、授权、两站Pages来源与成功构建回执 |
| public-first-pass.json | 正式推送之前的公测通过回执 |
| public-metadata-403.json | 首次匿名元信息403的失败证据，不计通过 |
| public-*.png / stable-*.png | 合成书库中的两站身份、320px入口和触屏平板可视区截图 |
| manifest.json | JSON与截图的字节数及SHA-256，README不计入 |

执行 `npm.cmd run gate:browser`；公测先执行 `npm.cmd run gate:release -- --site public --proxy http://127.0.0.1:7890 --repo-metadata .ui-check/release-gate/repo-metadata.json`，用户本轮已明确授权正式发布，正式部署后执行同命令去掉 `--site public` 检查两站。元信息回执须用插件现场读取，脚本拒绝超过一小时的回执。

尺寸与输入：1280×800、390×844、320×740明暗主题；1024×1366粗指针触屏平板与1280×800电脑，模拟浏览器双栏使可视高度缩减132px。检查按钮真实命中、44px点击高度、设置固定栏、正文末段和续写操作，不发送模型请求。截图是Edge隔离档案与模拟视口，不代表iOS或厂商平板真机。两站存储按域名独立，不自动同步。

完整结论、原始失败、边界与回滚见[发布报告](../../V0.0.19_PUBLIC_RELEASE_REPORT.md)。
