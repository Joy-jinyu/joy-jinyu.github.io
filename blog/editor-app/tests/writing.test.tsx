// 写稿：校验只在碰过字段后出现、计数、标签输入、预览、自动保存和读回、清空。
import { expect, open, test } from "nsh/test";
import { READY_DRAFT, signedIn, withDraft } from "./fixtures";

const SUBMIT = "role:button[提交审核…]";
const WIDE = { platform: "web", width: 1280, height: 860 } as const;

test("errors show only after a field was left, and submit waits for a valid draft", async () => {
  const app = await open("../App.tsx", { ...WIDE, host: { handlers: signedIn() } });
  await app.waitFor(SUBMIT);
  expect(app.enabled(SUBMIT)).toBe(false);
  expect(app.shows("写一个标题。")).toBe(false);

  // 进标题再离开：标题的错误出现，别的字段还没碰过，不报。
  await app.type("label:标题", "x");
  await app.clear("label:标题");
  await app.type("label:一句话摘要", "讲一件事");
  await app.waitFor("写一个标题。");
  expect(app.shows("正文还是空的。")).toBe(false);

  await app.type("label:标题", "第一篇投稿");
  expect(app.shows("text:5 / 80")).toBe(true);
  await app.type("label:正文", "## 你好\n\n正文");
  expect(app.shows("写一个标题。")).toBe(false);
  expect(app.enabled(SUBMIT)).toBe(true);

  // 宽屏有实时预览：标题和 Markdown 正文。
  expect(app.shows("id:preview >> text:第一篇投稿")).toBe(true);
  expect(app.shows("id:preview >> text:你好")).toBe(true);
});

test("a title over the limit is an error and blocks submit", async () => {
  const app = await open("../App.tsx", { ...WIDE, storage: withDraft(READY_DRAFT), host: { handlers: signedIn() } });
  await app.waitFor(SUBMIT);
  expect(app.enabled(SUBMIT)).toBe(true);
  await app.type("label:标题", "长".repeat(80));
  await app.type("label:正文", " ");
  await app.waitFor("标题最多 80 字。");
  expect(app.enabled(SUBMIT)).toBe(false);
});

test("tags: Enter and commas add, the chip's button and Backspace remove", async () => {
  const app = await open("../App.tsx", { ...WIDE, host: { handlers: signedIn() } });
  await app.waitFor(SUBMIT);
  await app.type("label:标签", "前端,Rust");
  await app.type("label:标签", "\n");
  expect(app.shows("label:移除标签 前端")).toBe(true);
  expect(app.shows("label:移除标签 Rust")).toBe(true);
  expect(app.value("label:标签")).toBe("");
  // 重复的不加。
  await app.type("label:标签", "前端，");
  expect(app.count("text:前端")).toBe(2); // 表单里的 chip 和预览里的 badge
  await app.press("label:移除标签 前端");
  expect(app.shows("label:移除标签 前端")).toBe(false);
  await app.keyboard.press("backspace");
  expect(app.shows("label:移除标签 Rust")).toBe(false);
});

test("narrow windows switch between editing and preview", async () => {
  const app = await open("../App.tsx", { storage: withDraft(READY_DRAFT), host: { handlers: signedIn() } });
  await app.waitFor("role:tab[编辑]");
  expect(app.shows("id:preview")).toBe(false);
  expect(app.value("label:标题")).toBe(READY_DRAFT.title);
  await app.press("role:tab[预览]");
  await app.waitFor("id:preview");
  expect(app.shows("id:preview >> text:开头")).toBe(true);
  await app.press("role:tab[编辑]");
  await app.waitFor("label:标题");
});

test("the draft is saved after a pause and comes back on the next start", async () => {
  const app = await open("../App.tsx", { ...WIDE, host: { handlers: signedIn() } });
  await app.waitFor(SUBMIT);
  await app.type("label:标题", "存下来");
  await app.waitFor("草稿已保存");
  const saved = JSON.parse(app.storage()["pairwise.draft"] ?? "{}");
  expect(saved.title).toBe("存下来");

  const again = await open("../App.tsx", { ...WIDE, storage: app.storage(), host: { handlers: signedIn() } });
  await again.waitFor(SUBMIT);
  expect(again.value("label:标题")).toBe("存下来");
});

test("clearing asks first, and only 清空 clears", async () => {
  const app = await open("../App.tsx", { ...WIDE, storage: withDraft(READY_DRAFT), host: { handlers: signedIn() } });
  await app.waitFor(SUBMIT);
  app.onDialog(() => "取消");
  await app.press("role:button[清空…]");
  expect(app.value("label:标题")).toBe(READY_DRAFT.title);
  app.onDialog((dialog) => {
    expect(dialog.title).toBe("清空这篇稿件？");
    return "清空";
  });
  await app.press("role:button[清空…]");
  expect(app.value("label:标题")).toBe("");
  expect(app.storage()["pairwise.draft"]).toBeUndefined();
});
