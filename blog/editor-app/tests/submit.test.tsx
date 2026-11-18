// 提交：确认后进度跟着宿主的 contrib.progress 走，成功给 PR，失败标出卡住的一步并可重试。
import { expect, open, test } from "nsh/test";
import type { App } from "nsh/test";
import type { Draft, Submitted } from "../host-contract";
import { READY_DRAFT, signedIn, withDraft } from "./fixtures";

const WIDE = { platform: "web", width: 1280, height: 860 } as const;
const SUBMIT = "role:button[提交审核…]";
const PR: Submitted = { prNumber: 42, prUrl: "https://github.com/joy/site/pull/42", path: "blog/src/content/contrib/x.md" };

/** 当前每一步的读屏名（「准备仓库：进行中」）。 */
function steps(app: App) {
  return ["准备仓库", "创建分支", "写入稿件", "提交 PR"].map((label) =>
    ["未开始", "进行中", "完成", "失败"].find((state) => app.shows(`label:${label}：${state}`)) ?? "?",
  );
}

test("submitting asks first, follows each step, and ends with the PR", async () => {
  let app!: App;
  const seen: string[][] = [];
  const sent: Draft[] = [];
  app = await open("../App.tsx", {
    ...WIDE,
    storage: withDraft(READY_DRAFT),
    host: {
      handlers: signedIn({
        "contrib.submit": async (draft: Draft) => {
          sent.push(draft);
          seen.push(steps(app));
          for (const step of ["fork", "branch", "commit", "pr"]) {
            await app.host.send("contrib.progress", { step, state: "active" });
            seen.push(steps(app));
            await app.host.send("contrib.progress", { step, state: "done" });
          }
          return PR;
        },
      }),
    },
  });
  await app.waitFor(SUBMIT);
  app.onDialog((dialog) => {
    expect(dialog.title).toBe("提交这篇稿件？");
    return "提交";
  });
  await app.press(SUBMIT);
  await app.waitFor("text:PR #42 已创建");

  expect(sent).toEqual([READY_DRAFT]);
  expect(seen).toEqual([
    ["未开始", "未开始", "未开始", "未开始"],
    ["进行中", "未开始", "未开始", "未开始"],
    ["完成", "进行中", "未开始", "未开始"],
    ["完成", "完成", "进行中", "未开始"],
    ["完成", "完成", "完成", "进行中"],
  ]);
  expect(steps(app)).toEqual(["完成", "完成", "完成", "完成"]);
  expect(app.shows("text:已提交")).toBe(true);

  await app.press("role:button[查看 PR]");
  expect(app.host.calls().filter((c) => c.name === "site.open").map((c) => c.data)).toEqual([{ url: PR.prUrl }]);

  await app.press("role:button[继续写新稿]");
  await app.waitFor("id:submit-dialog", { state: "gone" });
  expect(app.value("label:标题")).toBe("");
});

test("cancelling the confirmation submits nothing", async () => {
  const app = await open("../App.tsx", { ...WIDE, storage: withDraft(READY_DRAFT), host: { handlers: signedIn({ "contrib.submit": PR }) } });
  await app.waitFor(SUBMIT);
  app.onDialog(() => "取消");
  await app.press(SUBMIT);
  expect(app.host.calls().some((c) => c.name === "contrib.submit")).toBe(false);
  expect(app.shows("id:submit-dialog")).toBe(false);
});

test("a failure marks the step it stopped at, keeps the draft, and retries; success clears it", async () => {
  let app!: App;
  let tries = 0;
  app = await open("../App.tsx", {
    ...WIDE,
    storage: withDraft(READY_DRAFT),
    host: {
      handlers: signedIn({
        "contrib.submit": async () => {
          tries++;
          await app.host.send("contrib.progress", { step: "fork", state: "active" });
          await app.host.send("contrib.progress", { step: "fork", state: "done" });
          await app.host.send("contrib.progress", { step: "branch", state: "active" });
          if (tries === 1) throw new Error("fork 还没准备好，过一会儿再提交");
          await app.host.send("contrib.progress", { step: "branch", state: "done" });
          return PR;
        },
      }),
    },
  });
  await app.waitFor(SUBMIT);
  app.onDialog(() => "提交");
  await app.press(SUBMIT);
  await app.waitFor("fork 还没准备好，过一会儿再提交");
  expect(app.shows("text:没能提交")).toBe(true);
  expect(steps(app)).toEqual(["完成", "失败", "未开始", "未开始"]);

  await app.press("role:button[重试]");
  await app.waitFor("text:PR #42 已创建");
  await app.press("role:button[关闭]");
  await app.waitFor("id:submit-dialog", { state: "gone" });
  // 提交成功后稿件已经在 PR 里：不管对话框怎么关，草稿都清掉，免得再点一次提交出第二个 PR。
  expect(app.value("label:标题")).toBe("");
});
