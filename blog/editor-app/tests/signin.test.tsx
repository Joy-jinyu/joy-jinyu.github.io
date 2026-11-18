// 未登录 → 登录：说明页、登录中、宿主拒绝、用户没完成授权。
import { expect, open, test } from "nsh/test";
import type { App } from "nsh/test";
import { ADA, AI_OFF } from "./fixtures";

const LOGIN = "role:button[用 GitHub 登录]";

test("signed out shows the steps, and logging in opens the writing page", async () => {
  let app!: App;
  // 宿主回答之前看一眼：按钮在等待中、不能再按。
  let waiting = false;
  app = await open("../App.tsx", {
    host: {
      handlers: {
        "auth.status": null,
        "ai.status": AI_OFF,
        "auth.login": () => {
          waiting = app.shows("等待 GitHub 授权…") && !app.enabled(LOGIN);
          return ADA;
        },
      },
    },
  });
  await app.waitFor("投稿到 Pairwise");
  expect(app.shows("text:用 GitHub 登录")).toBe(true);
  expect(app.shows("text:提交后会变成一个 PR，审过后发布")).toBe(true);

  await app.press(LOGIN);
  await app.waitFor("ada");
  await app.waitFor("role:button[提交审核…]");
  expect(waiting).toBe(true);
  expect(app.host.calls().map((c) => c.name)).toContain("auth.login");
});

test("a rejected login shows the host's message and can be tried again", async () => {
  let tries = 0;
  const app = await open("../App.tsx", {
    host: {
      handlers: {
        "auth.status": null,
        "ai.status": AI_OFF,
        "auth.login": () => {
          tries++;
          if (tries === 1) throw new Error("弹窗被浏览器拦住了");
          return ADA;
        },
      },
    },
  });
  await app.press(LOGIN);
  await app.waitFor("弹窗被浏览器拦住了");
  expect(app.enabled(LOGIN)).toBe(true);
  await app.press(LOGIN);
  await app.waitFor("ada");
});

test("a login the user did not finish keeps the page and says so", async () => {
  const app = await open("../App.tsx", {
    host: { handlers: { "auth.status": null, "ai.status": AI_OFF, "auth.login": null } },
  });
  await app.press(LOGIN);
  await app.waitFor("登录没有完成，可以再试一次。");
  expect(app.shows("投稿到 Pairwise")).toBe(true);
});

test("a failed status read offers a retry", async () => {
  let reads = 0;
  const app = await open("../App.tsx", {
    host: {
      handlers: {
        "ai.status": AI_OFF,
        "auth.status": () => {
          reads++;
          if (reads === 1) throw new Error("宿主还没准备好");
          return null;
        },
      },
    },
  });
  await app.waitFor("text:/没能读取登录状态/");
  await app.press("role:button[重试]");
  await app.waitFor("投稿到 Pairwise");
});

test("logging out goes back to the signed-out page", async () => {
  const app = await open("../App.tsx", {
    host: { handlers: { "auth.status": ADA, "ai.status": AI_OFF, "auth.logout": null } },
  });
  await app.waitFor("ada");
  await app.press("role:button[退出]");
  await app.waitFor("投稿到 Pairwise");
});
