// AI 流式生成：先思考过程、再正文，最后用整理好的结果；「停止」中止并丢掉迟到的结果；插入图表（Mermaid / SVG）。
import { expect, open, test } from "nsh/test";
import type { App } from "nsh/test";
import type { AiTask, Draft } from "../../src/lib/editor-host/contract";
import { mediaPath, READY_DRAFT, signedIn, withDraft } from "./fixtures";

const WIDE = { platform: "web", width: 1280, height: 860 } as const;
const AI_DRAFT: Draft = { title: "AI 写的标题", description: "AI 写的摘要", tags: ["AI", "写作"], body: "## AI 的小节\n\nAI 的正文。" };
type Task = AiTask & { id: string };

test("AI 起稿 streams the thinking, then the text, and fills the draft from the final result", async () => {
  let app!: App;
  const seen: Record<string, boolean> = {};
  app = await open("../App.tsx", {
    ...WIDE,
    host: {
      handlers: signedIn({
        "ai.complete": async (task: Task) => {
          seen.thinking = app.shows("id:ai-stage >> text:思考中") && !app.shows("label:思考过程");
          await app.host.send("ai.delta", { id: task.id, kind: "reasoning", text: "先想想怎么分节，" });
          await app.host.send("ai.delta", { id: task.id, kind: "reasoning", text: "再写结论。" });
          seen.reasoning = app.shows("text:先想想怎么分节，再写结论。") && app.shows("id:ai-stage >> text:思考中");
          // 别的（停掉的）那次的增量不算。
          await app.host.send("ai.delta", { id: "ai-old", kind: "content", text: "别人的内容" });
          await app.host.send("ai.delta", { id: task.id, kind: "content", text: "标题：流里的标题\n摘要：流里的摘要\n标签：AI\n---\n## 流里的小节\n\n正在写的" });
          seen.writing = app.shows("id:ai-stage >> text:写作中") && app.shows("id:ai-stream-content >> text:流里的小节") && app.shows("id:ai-stream-content >> text:/正在写的/");
          seen.headLines = app.shows("id:ai-stream-content >> text:标题：流里的标题") && app.shows("id:ai-stream-content >> text:标签：AI");
          // 正文一开始，思考过程自己收起（标题行还在）。
          seen.collapsed = !app.shows("text:先想想怎么分节，再写结论。") && app.shows("label:思考过程");
          seen.foreignDropped = !app.shows("text:别人的内容");
          return AI_DRAFT;
        },
      }),
    },
  });
  await app.waitFor("role:button[AI 起稿…]");
  await app.press("role:button[AI 起稿…]");
  await app.type("label:主题或提纲", "怎么给博客加投稿");
  await app.press("role:button[生成]");
  await app.waitFor("id:ai-draft-result");
  expect(seen).toEqual({ thinking: true, reasoning: true, writing: true, headLines: true, collapsed: true, foreignDropped: true });
  // 结果以宿主整理好的为准，不是流里的文字。
  expect(app.shows("id:ai-draft-result >> text:AI 写的标题")).toBe(true);
  expect(app.shows("text:流里的标题")).toBe(false);
  await app.press("role:button[填入稿件]");
  await app.waitFor("id:ai-draft-dialog", { state: "gone" });
  expect(app.value("label:标题")).toBe(AI_DRAFT.title);
  expect(app.value("label:正文")).toBe(AI_DRAFT.body);
});

// 宿主的回答没回来之前，测试的步骤会一直等它：生成中的操作都在回答函数里做。
test("the thinking panel can be opened again while the text streams", async () => {
  let app!: App;
  const seen: Record<string, boolean> = {};
  app = await open("../App.tsx", {
    ...WIDE,
    storage: withDraft(READY_DRAFT),
    host: {
      handlers: signedIn({
        "ai.complete": async (task: Task) => {
          await app.host.send("ai.delta", { id: task.id, kind: "reasoning", text: "看看哪里啰嗦。" });
          await app.host.send("ai.delta", { id: task.id, kind: "content", text: "润色后的第一段" });
          seen.collapsed = !app.shows("text:看看哪里啰嗦。");
          await app.press("label:思考过程");
          seen.reopened = app.shows("text:看看哪里啰嗦。");
          // 用户打开过就按用户的来：再来增量也不收起。
          await app.host.send("ai.delta", { id: task.id, kind: "content", text: "，接着写" });
          seen.stays = app.shows("text:看看哪里啰嗦。") && app.shows("text:/润色后的第一段，接着写/");
          return { body: "润色后的第一段，接着写。" };
        },
      }),
    },
  });
  await app.press("role:button[润色正文…]");
  await app.waitFor("id:ai-polish-result");
  expect(seen).toEqual({ collapsed: true, reopened: true, stays: true });
});

test("停止 cancels the run, keeps the body, and ignores the late result", async () => {
  let app!: App;
  let id = "";
  const seen: Record<string, boolean> = {};
  app = await open("../App.tsx", {
    ...WIDE,
    storage: withDraft(READY_DRAFT),
    host: {
      handlers: signedIn({
        "ai.complete": async (task: Task) => {
          id = task.id;
          await app.host.send("ai.delta", { id, kind: "content", text: "润色到一半" });
          seen.streaming = app.shows("id:ai-stream-content >> text:/润色到一半/");
          // 这个模型没有思考过程：面板不出现。
          seen.noThinking = !app.shows("label:思考过程");
          await app.press("role:button[停止]");
          seen.stopped = app.shows("id:ai-stopped");
          // 停掉之后宿主才推来的增量、才回来的结果都不算。
          await app.host.send("ai.delta", { id, kind: "content", text: "停了还在写" });
          return { body: "迟到的正文" };
        },
      }),
    },
  });
  await app.press("role:button[润色正文…]");
  await app.wait(300);
  expect(seen).toEqual({ streaming: true, noThinking: true, stopped: true });
  expect(app.host.calls().filter((c) => c.name === "ai.cancel").map((c) => c.data)).toEqual([{ id }]);
  expect(app.shows("text:迟到的正文")).toBe(false);
  expect(app.shows("text:/停了还在写/")).toBe(false);
  expect(app.shows("id:ai-stopped")).toBe(true);
  expect(app.shows("role:button[重新生成]")).toBe(true);
  await app.press("role:button[取消]");
  await app.waitFor("id:ai-polish-dialog", { state: "gone" });
  expect(app.value("label:正文")).toBe(READY_DRAFT.body);
  expect(app.enabled("role:button[润色正文…]")).toBe(true);
});

test("插入图表 draws a Mermaid diagram and appends it as a mermaid block", async () => {
  let app!: App;
  const tasks: Task[] = [];
  let finishing = false;
  app = await open("../App.tsx", {
    ...WIDE,
    storage: withDraft(READY_DRAFT),
    host: {
      handlers: signedIn({
        "ai.complete": async (task: Task) => {
          tasks.push(task);
          await app.host.send("ai.delta", { id: task.id, kind: "content", text: "flowchart LR\n  写稿 --> 提交" });
          // 内容停了一阵（宿主在检查代码）：阶段换成「整理中」。
          await app.wait(1800);
          finishing = app.shows("id:ai-stage >> text:整理中");
          return { mermaid: "flowchart LR\n  写稿 --> 提交 --> 发布" };
        },
      }),
    },
  });
  await app.press("role:button[插入图表…]");
  expect(app.enabled("role:button[生成]")).toBe(false);
  await app.type("label:想画什么", "投稿流程");
  await app.press("role:button[生成]");
  await app.waitFor("id:chart-result");
  expect(tasks).toMatchObject([{ task: "diagram", input: "投稿流程" }]);
  expect(finishing).toBe(true);
  const renders = app.host.calls().filter((c) => c.name === "diagram.render");
  expect(renders.map((c) => c.data)).toEqual([{ code: "flowchart LR\n  写稿 --> 提交 --> 发布", dark: false }]);
  expect(app.shows("id:chart-diagram")).toBe(true);

  await app.press("role:button[插入正文]");
  await app.waitFor("id:ai-chart-dialog", { state: "gone" });
  expect(app.value("label:正文")).toBe(`${READY_DRAFT.body}\n\n\`\`\`mermaid\nflowchart LR\n  写稿 --> 提交 --> 发布\n\`\`\`\n`);
});

test("插入图表 as SVG shows the stored picture and appends it as an image", async () => {
  const image = { path: mediaPath(0xabc, "svg"), url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=" };
  const tasks: Task[] = [];
  const app = await open("../App.tsx", {
    ...WIDE,
    storage: withDraft(READY_DRAFT),
    host: {
      handlers: signedIn({
        "ai.complete": (task: Task) => {
          tasks.push(task);
          return { image };
        },
      }),
    },
  });
  await app.press("role:button[插入图表…]");
  await app.type("label:想画什么", "一张投稿流程的插图");
  await app.press("role:tab[SVG 插图]");
  await app.waitFor("text:/存成图片放进正文/");
  await app.type("label:额外要求", "横向");
  await app.press("role:button[生成]");
  await app.waitFor("id:chart-svg");
  expect(tasks).toMatchObject([{ task: "svg", input: "一张投稿流程的插图", extra: "横向" }]);
  expect(app.shows("label:图")).toBe(true);
  await app.press("role:button[插入正文]");
  await app.waitFor("id:ai-chart-dialog", { state: "gone" });
  expect(app.value("label:正文")).toBe(`${READY_DRAFT.body}\n\n![图](${image.path})\n`);
});
