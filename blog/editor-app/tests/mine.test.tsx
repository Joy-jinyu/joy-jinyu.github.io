// 我的投稿：加载中、列表（状态 badge、按下在 GitHub 打开）、空、出错重试。
import { expect, open, test } from "nsh/test";
import type { App } from "nsh/test";
import { PRS, signedIn } from "./fixtures";

const WIDE = { platform: "web", width: 1280, height: 860 } as const;
const OPEN = "role:button[我的投稿]";

test("lists my PRs with their state, and a row opens it on GitHub", async () => {
  let app!: App;
  // 宿主回答之前看一眼：此时显示的是加载占位。
  let loadingShown = false;
  app = await open("../App.tsx", {
    ...WIDE,
    host: {
      handlers: signedIn({
        "contrib.mine": () => {
          loadingShown = app.shows("id:mine-loading");
          return PRS;
        },
      }),
    },
  });
  await app.waitFor(OPEN);
  await app.press(OPEN);
  await app.waitFor("text:我的第一篇投稿");
  expect(loadingShown).toBe(true);
  expect(app.shows("id:mine-12 >> text:审核中")).toBe(true);
  expect(app.shows("id:mine-9 >> text:已发布")).toBe(true);
  expect(app.shows("text:#12 · 更新于 2026-11-02")).toBe(true);

  await app.press("role:link[我的第一篇投稿，审核中，在 GitHub 打开]");
  expect(app.host.calls().filter((c) => c.name === "site.open").map((c) => c.data)).toEqual([{ url: PRS[0].url }]);
});

test("no PRs yet shows the empty state", async () => {
  const app = await open("../App.tsx", { ...WIDE, host: { handlers: signedIn({ "contrib.mine": [] }) } });
  await app.press(OPEN);
  await app.waitFor("还没有投稿");
});

test("a failed read shows the message and retries", async () => {
  let reads = 0;
  const app = await open("../App.tsx", {
    ...WIDE,
    host: {
      handlers: signedIn({
        "contrib.mine": () => {
          reads++;
          if (reads === 1) throw new Error("GitHub 接口超时");
          return PRS;
        },
      }),
    },
  });
  await app.press(OPEN);
  await app.waitFor("没能读取投稿");
  expect(app.shows("GitHub 接口超时")).toBe(true);
  await app.press("id:mine-error >> role:button[重试]");
  await app.waitFor("text:我的第一篇投稿");
});

test("the sheet closes with its button, and reads again when opened again", async () => {
  let reads = 0;
  const app = await open("../App.tsx", { ...WIDE, host: { handlers: signedIn({ "contrib.mine": () => (reads++, PRS) }) } });
  await app.press(OPEN);
  await app.waitFor("text:我的第一篇投稿");
  // 侧栏是最上层的模态：这里的「关闭」就是侧栏自己的。
  await app.press("role:button[关闭]");
  await app.waitFor("text:我的第一篇投稿", { state: "gone" });
  await app.press(OPEN);
  await app.waitFor("text:我的第一篇投稿");
  expect(reads).toBe(2);
});
