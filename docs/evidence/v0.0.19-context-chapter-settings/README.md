# 全文章数与前文范围验收证据

2026-11-19 本地隔离 Edge，合成书稿，不访问真实服务商、不读取日常书库。修复报告见 [报告](../../V0.0.19_CONTEXT_CHAPTER_SETTINGS_REPORT.md)。

- chapter-settings.json：23 项，未失焦输入保存、刷新、0 章、5 种宽度明暗、10 组 Gemini 开关／前文限额实际发送。记录原文、尾部和摘要哨兵章号，不保存冗长正文。
- lifecycle-before.json／lifecycle-before.log／lifecycle-before-reset.png：改前完整页面4项复现，未刷新下一次正文生成5→2；JSON保留同步调用栈，指向 normalizeContextSettings。
- lifecycle-current.json／lifecycle-current.log：修复版40项运行态回归，2种尺寸×省token开／关，实际生成、失败／停止、空闲、切书／支线、预览、保存和刷新；全程未发生5回写2。
- lifecycle-audit.log／lifecycle-gate.log：本次补充重新执行的审计、门禁；gate-report.json同步本次9/9、326/326。
- lifecycle-fixture-first-failure.log：新增夹具首轮误调用不存在的stopGeneration，已改走页面实际停止路径后重跑；没有因此修改产品。
- context-integrity.json：19 项，默认只读、作者设定与完整备份。
- memory-recovery.json：13 项，320 章百万字合成存档、320 记忆、59 合并组与往返指纹。
- branch-context.json：36 项，主线／子线／孙线真实发送流程的隔离哨兵统计。
- gate-report.json：普通门禁 9/9，v19 326/326。
- before-fix.log、unit.log、audit.log、browser.log：改前失败与改后执行输出。
- 1280-light.png、320-dark.png：新增说明与 44px 输入框截图；其余 6 张在本机 .ui-check/context-chapter-settings/，可重复脚本生成。

复现命令：node scripts/v19-outline-review-browser.cjs --chapter-settings；普通门禁已自动收录新增单元测试，gate:browser 已登记本专项。其余受影响专项命令见报告，不将普通门禁当成完整浏览器或真实模型验收。
