这一篇文，探讨 Harness 工具“为什么”这样设计，而不是现有设计是什么，是工程取舍，还是说是做了某些实验，还是跑了 benchmark 分数更高

### 压缩轮设计

旧：（独立总结）

新的总结专用 system prompt + 序列化后的历史 --> 摘要

新：（称之为 append compaction）

原 system prompt + 原工具定义 + 原历史 + “请总结” --> 摘要

当时的目标是缓存复用，合并到主分支，不过后续又撤回

截至 2026-09-17 仍是旧版独立总结方案

### Todo 设计

Codex 7 月 24 日 新增 tools.update_plan.enabled 开关，当时默认开启，允许关闭；在 2026-08-31 把 update_plan 从默认开启改成了默认关闭，并移除内置提示词

原因：未公开，OpenAI 自己的决策

类似设计：

Manus、deepagents、PI 曾经认为 todo 更耗费 token

### PI 的设计

开源 Harness 工具并不等于所有决策都透明，很多时候只是代码可见

Codex 由 OpenAI 直接控制，很多设计上的改动并不说明原因

至于 PI，它现在是 Earendil 的产品，而非个人项目，并且直接说了不是所有东西都会公开

不过 PI 的 RFC 可供参考

PI 会研究竞争对手，比如 Codex 的行为 https://rfc.earendil.com/0054/