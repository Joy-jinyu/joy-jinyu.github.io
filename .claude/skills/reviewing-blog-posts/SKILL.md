---
name: reviewing-blog-posts
description: Use when a blog post in blog/src/content/posts/ is drafted and about to be handed to the user, set to draft false, committed, or deployed (审稿、发布前检查、能发了吗、review 这篇).
---

# 博客发布前审稿

## 核心

写稿的人看不出自己的稿子和本站风格差在哪。审稿要交给一个**没参与写稿**的 subagent，按下面的提示词来做。写稿的人只负责修改和复核。

## 步骤

1. **派审稿 subagent。** 把 `reviewer-prompt.md` 的内容整段作为 prompt，把 `<文章路径>` 换成实际的文件路径。它只读文件、只看网页，不改任何东西。
2. **逐条处理它的结论：**
   - 风格不符：按 `.claude/skills/writing-blog-posts/SKILL.md` 的要求改。
   - 事实不对：改正文；没法核实的，挪进 `<Callout type="todo">`，或者标「待核实」。
   - 竞品关没过：不要硬发，告诉用户缺什么。
3. **演示组件**按 `.claude/skills/building-post-demos/SKILL.md` 的流程在浏览器里重新跑一遍，逐张看截图。
4. **交给用户时**，交稿说明里写清楚：
   - 竞品关的那一句：这篇比同类文章多给了什么。
   - 审稿结论：发现了什么、改了什么、哪些没改以及原因。
   - 验证情况：哪些是浏览器里实测过的（附数字），哪些只是推断，哪些没有验证。
   - 还是 `draft: true`，等用户确认后才改成 `false`。改 `draft`、提交、部署是三个独立的动作，每个都要用户点头。
