// AI：没设置时打开站点设置；起稿填入稿件（非空先确认）；润色替换正文；起标题和摘要逐项采用；关掉对话框丢弃迟到的结果。
import { expect, open, test } from "nsh/test";
import type { App } from "nsh/test";
import type { AiTask, Draft } from "../../src/lib/editor-host/contract";
import { AI_OFF, AI_ON, later, READY_DRAFT, signedIn, withDraft } from "./fixtures";

const WIDE = { platform: "web", width: 1280, height: 860 } as const;
const AI_DRAFT: Draft = { title: "AI 写的标题", description: "AI 写的摘要", tags: ["AI", "写作"], body: "## AI 的小节\n\nAI 的正文。" };

test("without AI settings, the tools open the site's settings and explain", async () => {
  const app = await open("../App.tsx", { ...WIDE, host: { handlers: signedIn({ "ai.status": AI_OFF }) } });
  await app.waitFor("role:button[AI 未设置，打开 AI 设置]");
  await app.press("role:button[AI 起稿…]");
  await app.waitFor("text:/AI 还没设置/");
  expect(app.host.calls().map((c) => c.name)).toContain("ai.openSettings");
  expect(app.shows("id:ai-draft-dialog")).toBe(false);
  // 设置好之后宿主发 ai.changed：提示消失，顶栏显示模型名。
  await app.host.send("ai.changed", AI_ON);
  await app.waitFor("text:/AI 还没设置/", { state: "gone" });
  expect(app.shows("text:gpt-test")).toBe(true);
});

test("AI 起稿 fills every field of an empty draft", async () => {
  const tasks: AiTask[] = [];
  let app!: App;
  // 宿主回答之前看一眼：输入区换成了生成过程，底部只有「停止」。
  let running = false;
  app = await open("../App.tsx", {
    ...WIDE,
    host: {
      handlers: signedIn({
        "ai.complete": (task: AiTask) => {
          tasks.push(task);
          running = app.shows("id:ai-stream") && app.shows("text:/通常要半分钟/") && app.shows("role:button[停止]") && !app.shows("label:主题或提纲");
          return AI_DRAFT;
        },
      }),
    },
  });
  await app.waitFor("role:button[AI 起稿…]");
  await app.press("role:button[AI 起稿…]");
  await app.waitFor("label:主题或提纲");
  expect(app.enabled("role:button[生成]")).toBe(false);
  await app.type("label:主题或提纲", "怎么给博客加投稿");
  await app.type("label:额外要求", "短一点");
  await app.press("role:button[生成]");
  await app.waitFor("id:ai-draft-result");
  expect(running).toBe(true);
  expect(tasks).toMatchObject([{ task: "draft", input: "怎么给博客加投稿", extra: "短一点" }]);
  expect(typeof (tasks[0] as { id?: unknown }).id).toBe("string");
  expect(app.shows("id:ai-draft-result >> text:AI 写的标题")).toBe(true);

  await app.press("role:button[填入稿件]");
  await app.waitFor("id:ai-draft-dialog", { state: "gone" });
  expect(app.value("label:标题")).toBe(AI_DRAFT.title);
  expect(app.value("label:一句话摘要")).toBe(AI_DRAFT.description);
  expect(app.value("label:正文")).toBe(AI_DRAFT.body);
  expect(app.shows("label:移除标签 写作")).toBe(true);
  expect(app.dialogs().length).toBe(0);
});

test("AI 起稿 asks before replacing a draft that has content", async () => {
  const app = await open("../App.tsx", {
    ...WIDE,
    storage: withDraft(READY_DRAFT),
    host: { handlers: signedIn({ "ai.complete": AI_DRAFT }) },
  });
  await app.waitFor("role:button[AI 起稿…]");
  await app.press("role:button[AI 起稿…]");
  await app.type("label:主题或提纲", "主题");
  await app.press("role:button[生成]");
  await app.waitFor("id:ai-draft-result");
  app.onDialog(() => "取消");
  await app.press("role:button[填入稿件]");
  expect(app.shows("id:ai-draft-result")).toBe(true);
  app.onDialog((dialog) => {
    expect(dialog.title).toBe("用 AI 的稿子替换当前稿件？");
    return "替换";
  });
  await app.press("role:button[填入稿件]");
  await app.waitFor("id:ai-draft-dialog", { state: "gone" });
  expect(app.value("label:标题")).toBe(AI_DRAFT.title);
});

test("润色正文 shows the result and replaces the body only when asked", async () => {
  const app = await open("../App.tsx", {
    ...WIDE,
    storage: withDraft(READY_DRAFT),
    host: { handlers: signedIn({ "ai.complete": { body: "润色后的正文。" } }) },
  });
  await app.waitFor("role:button[润色正文…]");
  await app.press("role:button[润色正文…]");
  await app.waitFor("id:ai-polish-result");
  expect(app.value("label:正文")).toBe(READY_DRAFT.body);
  await app.press("role:button[替换正文]");
  await app.waitFor("id:ai-polish-dialog", { state: "gone" });
  expect(app.value("label:正文")).toBe("润色后的正文。");
});

test("润色 and 起标题 need a body first", async () => {
  const app = await open("../App.tsx", { ...WIDE, host: { handlers: signedIn() } });
  // 不能按时读屏名带上原因。
  await app.waitFor("role:button[润色正文…（先写正文）]");
  expect(app.enabled("role:button[润色正文…（先写正文）]")).toBe(false);
  expect(app.enabled("role:button[起标题和摘要…（先写正文）]")).toBe(false);
  expect(app.enabled("role:button[AI 起稿…]")).toBe(true);
  await app.type("label:正文", "有正文了");
  expect(app.enabled("role:button[润色正文…]")).toBe(true);
  expect(app.enabled("role:button[起标题和摘要…]")).toBe(true);
});

test("起标题和摘要: each suggestion is adopted on its own", async () => {
  const meta = { titles: ["标题甲", "标题乙", "标题丙"], description: "新的摘要", tags: ["甲", "乙"] };
  const app = await open("../App.tsx", { ...WIDE, storage: withDraft(READY_DRAFT), host: { handlers: signedIn({ "ai.complete": meta }) } });
  await app.waitFor("role:button[起标题和摘要…]");
  await app.press("role:button[起标题和摘要…]");
  await app.waitFor("id:ai-meta-dialog >> text:标题乙");
  await app.press("id:ai-title-1");
  expect(app.value("label:标题")).toBe("标题乙");
  expect(app.shows("id:ai-title-1 >> text:已采用")).toBe(true);
  await app.press("id:ai-description");
  expect(app.value("label:一句话摘要")).toBe("新的摘要");
  await app.press("id:ai-tags");
  expect(app.shows("label:移除标签 乙")).toBe(true);
  expect(app.shows("label:移除标签 前端")).toBe(false);
  await app.press("role:button[完成]");
  await app.waitFor("id:ai-meta-dialog", { state: "gone" });
});

test("closing a running dialog drops its late result", async () => {
  const app = await open("../App.tsx", {
    ...WIDE,
    storage: withDraft(READY_DRAFT),
    host: { handlers: signedIn({ "ai.complete": () => later({ body: "迟到的正文" }, 300) }) },
  });
  await app.waitFor("role:button[润色正文…]");
  await app.press("role:button[润色正文…]");
  await app.press("role:button[取消]");
  await app.waitFor("id:ai-polish-dialog", { state: "gone" });
  await app.wait(500);
  expect(app.value("label:正文")).toBe(READY_DRAFT.body);
  expect(app.enabled("role:button[润色正文…]")).toBe(true);
  expect(app.shows("text:迟到的正文")).toBe(false);
});

test("an AI error is shown in the dialog with a retry", async () => {
  let calls = 0;
  const app = await open("../App.tsx", {
    ...WIDE,
    storage: withDraft(READY_DRAFT),
    host: {
      handlers: signedIn({
        "ai.complete": () => {
          calls++;
          if (calls === 1) throw new Error("AI 接口返回 429");
          return { body: "第二次成功" };
        },
      }),
    },
  });
  await app.press("role:button[润色正文…]");
  await app.waitFor("AI 接口返回 429");
  await app.press("role:button[重试]");
  await app.waitFor("id:ai-polish-result");
});

test("keyboard: mod+Enter generates, Escape closes and drops the result", async () => {
  const app = await open("../App.tsx", { ...WIDE, host: { handlers: signedIn({ "ai.complete": AI_DRAFT }) } });
  await app.press("role:button[AI 起稿…]");
  await app.type("label:主题或提纲", "主题");
  await app.keyboard.press("mod+enter");
  await app.waitFor("id:ai-draft-result");
  await app.keyboard.press("escape");
  await app.waitFor("id:ai-draft-dialog", { state: "gone" });
  expect(app.value("label:标题")).toBe("");
});
