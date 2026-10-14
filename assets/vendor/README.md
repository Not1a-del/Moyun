# 本地运行依赖

这些文件用于直接打开 `index.html`，启动时不再访问外部 CDN。不需要安装依赖。

| 文件 | 固定版本 | 来源 | 许可证 |
| --- | --- | --- | --- |
| vue.global.js | 3.5.43 | https://unpkg.com/vue@3.5.43/dist/vue.global.js | vue.LICENSE（MIT） |
| tailwind-3.4.17.js | 3.4.17 Play CDN bundle | https://cdn.tailwindcss.com/3.4.17 | tailwind.LICENSE（MIT） |
| marked.umd.js | 15.0.12 | https://cdn.jsdelivr.net/npm/marked@15.0.12/lib/marked.umd.js | marked.LICENSE（MIT） |
| diff_match_patch.js | 20121119 | https://cdnjs.cloudflare.com/ajax/libs/diff_match_patch/20121119/diff_match_patch.js | diff-match-patch.LICENSE（Apache-2.0） |

Vue 版本与此前本地验收使用的文件一致；Marked 固定为原 CDN 当前实际提供的版本。
Tailwind 保持原有运行时样式行为，以免遗漏 Vue 动态 class；后续可单独评估构建时生成 CSS。
页面字体使用原有系统回退字体，不再等待 Google Fonts。

升级依赖时请同步更新本表并运行启动、布局和业务回归。不要直接手改第三方库源码。
