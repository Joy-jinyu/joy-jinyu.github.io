// 图片和图表：选图交给宿主存、写进正文；张数和大小的上限；预览里投稿图片换成预览地址、找不到时说明；Mermaid 交给宿主画，出错显示错误和代码。
import { expect, open, test } from "nsh/test";
import type { App } from "nsh/test";
import type { Draft } from "../../src/lib/editor-host/contract";
import { mediaPath, PREVIEW_URL, READY_DRAFT, signedIn, withDraft } from "./fixtures";

const WIDE = { platform: "web", width: 1280, height: 860 } as const;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

/** 带 n 张投稿图片的稿子。 */
function withImages(n: number): Draft {
  const images = Array.from({ length: n }, (_, i) => `![图 ${i}](${mediaPath(i + 1)})`);
  return { ...READY_DRAFT, body: [READY_DRAFT.body, ...images].join("\n\n") };
}

test("插入图片 stores each picked image and writes it into the body", async () => {
  let app!: App;
  const added: unknown[] = [];
  let progress = false;
  app = await open("../App.tsx", {
    ...WIDE,
    storage: withDraft(READY_DRAFT),
    host: {
      handlers: signedIn({
        "media.add": (image: { name: string }) => {
          added.push(image);
          progress = progress || app.shows("id:image-progress");
          return { path: mediaPath(added.length, image.name.endsWith(".jpg") ? "jpg" : "png"), url: PREVIEW_URL };
        },
      }),
    },
  });
  await app.waitFor("role:button[插入图片…]");
  app.onPick(() => [
    { name: "架构图.png", type: "image/png", data: PNG },
    { name: "截图 [1].jpg", type: "image/jpeg", data: JPG },
  ]);
  await app.press("role:button[插入图片…]");
  await app.waitUntil(() => (app.value("label:正文") ?? "").includes(mediaPath(2, "jpg")));

  expect(app.picks()).toMatchObject([{ kind: "images", multiple: true, limit: 10, maxDimension: 2000 }]);
  // quality 过了一道 f32：0.8500000238418579。
  expect(Math.abs((app.picks()[0] as { quality: number }).quality - 0.85)).toBeLessThan(1e-6);
  expect(added).toEqual([
    { name: "架构图.png", type: "image/png", data: base64(PNG) },
    { name: "截图 [1].jpg", type: "image/jpeg", data: base64(JPG) },
  ]);
  expect(app.value("label:正文")).toBe(`${READY_DRAFT.body}\n\n![架构图](${mediaPath(1)})\n\n![截图 1](${mediaPath(2, "jpg")})\n`);
  expect(progress).toBe(true);
  // 都成功了：进度自己收起。
  await app.waitFor("id:image-progress", { state: "gone" });
  // 预览里投稿图片换成宿主给的预览地址。
  await app.waitFor("id:preview >> id:media-image");
  const asked = app.host.calls().filter((c) => c.name === "media.url").map((c) => c.data);
  expect(asked).toContainEqual({ path: mediaPath(1) });
  expect(asked).toContainEqual({ path: mediaPath(2, "jpg") });
});

test("插入图片 stops at the image limit and says so", async () => {
  const app = await open("../App.tsx", { ...WIDE, storage: withDraft(withImages(10)), host: { handlers: signedIn() } });
  await app.waitFor("role:button[插入图片…]");
  await app.press("role:button[插入图片…]");
  await app.waitFor("text:/已经有 10 张图片/");
  expect(app.picks()).toEqual([]);
});

test("插入图片 asks for only as many images as are left", async () => {
  const app = await open("../App.tsx", {
    ...WIDE,
    storage: withDraft(withImages(9)),
    host: { handlers: signedIn({ "media.add": { path: mediaPath(99), url: PREVIEW_URL } }) },
  });
  await app.waitFor("role:button[插入图片…]");
  app.onPick(() => [
    { name: "一.png", type: "image/png", data: PNG },
    { name: "二.png", type: "image/png", data: PNG },
  ]);
  await app.press("role:button[插入图片…]");
  expect(app.picks()).toMatchObject([{ limit: 1 }]);
  await app.waitUntil(() => (app.value("label:正文") ?? "").includes(mediaPath(99)));
  expect(app.host.calls().filter((c) => c.name === "media.add").length).toBe(1);
  expect(app.value("label:正文")).not.toContain("![二]");
});

test("an image over 2 MB is not stored, and the failure stays listed", async () => {
  const app = await open("../App.tsx", { ...WIDE, storage: withDraft(READY_DRAFT), host: { handlers: signedIn({ "media.add": { path: mediaPath(1), url: PREVIEW_URL } }) } });
  await app.waitFor("role:button[插入图片…]");
  app.onPick(() => [{ name: "大图.png", type: "image/png", data: new Uint8Array(2 * 1024 * 1024 + 1) }]);
  await app.press("role:button[插入图片…]");
  await app.waitFor("text:有图片没能插入");
  expect(app.shows("label:/大图.png：.*单张最多 2 MB/")).toBe(true);
  expect(app.host.calls().some((c) => c.name === "media.add")).toBe(false);
  expect(app.value("label:正文")).toBe(READY_DRAFT.body);
  await app.press("id:image-progress >> role:button[关闭]");
  await app.waitFor("id:image-progress", { state: "gone" });
});

test("the host's media.add error is listed on that image", async () => {
  const app = await open("../App.tsx", {
    ...WIDE,
    storage: withDraft(READY_DRAFT),
    host: {
      handlers: signedIn({
        "media.add": () => {
          throw new Error("不认识这种图片格式");
        },
      }),
    },
  });
  await app.waitFor("role:button[插入图片…]");
  app.onPick(() => [{ name: "怪图.bmp", type: "image/bmp", data: PNG }]);
  await app.press("role:button[插入图片…]");
  await app.waitFor("text:/不认识这种图片格式/");
  expect(app.value("label:正文")).toBe(READY_DRAFT.body);
});

test("an image the host no longer has says so in the preview", async () => {
  const draft = { ...READY_DRAFT, body: `看图：\n\n![丢了的图](${mediaPath(7)})` };
  const app = await open("../App.tsx", { ...WIDE, storage: withDraft(draft), host: { handlers: signedIn({ "media.url": null }) } });
  await app.waitFor("id:preview >> id:media-missing");
  expect(app.shows("text:/图片在这台设备上找不到了/")).toBe(true);
});

test("a mermaid block is drawn by the host in the preview, and the body stays as written", async () => {
  const code = "flowchart LR\n  A --> B";
  const draft = { ...READY_DRAFT, body: `流程：\n\n\`\`\`mermaid\n${code}\n\`\`\`` };
  const app = await open("../App.tsx", { ...WIDE, storage: withDraft(draft), host: { handlers: signedIn() } });
  await app.waitFor("id:preview >> id:diagram");
  expect(app.host.calls().filter((c) => c.name === "diagram.render").map((c) => c.data)).toEqual([{ code, dark: false }]);
  expect(app.value("label:正文")).toBe(draft.body);
  // 换成深色：按深色重新画。
  await app.setColorScheme("dark");
  await app.waitUntil(() => app.host.calls().some((c) => c.name === "diagram.render" && (c.data as { dark: boolean }).dark));
});

test("a mermaid error shows the message and the code", async () => {
  const code = "flowchart LR\n  A -->";
  const draft = { ...READY_DRAFT, body: `\`\`\`mermaid\n${code}\n\`\`\`` };
  const app = await open("../App.tsx", {
    ...WIDE,
    storage: withDraft(draft),
    host: {
      handlers: signedIn({
        "diagram.render": () => {
          throw new Error("第 2 行：箭头后面缺了节点");
        },
      }),
    },
  });
  await app.waitFor("id:preview >> id:diagram-error");
  expect(app.shows("id:diagram-error >> text:/第 2 行：箭头后面缺了节点/")).toBe(true);
  expect(app.shows("id:diagram-error >> text:/A -->/")).toBe(true);
});
