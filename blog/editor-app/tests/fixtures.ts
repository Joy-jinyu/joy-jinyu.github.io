// 测试扮演宿主页：按 blog/src/lib/editor-host/contract.ts 的函数名给出回答。每个测试只覆盖它关心的那几个。
import type { AiStatus, Draft, Login, MyPr } from "../../src/lib/editor-host/contract";

export const ADA: Login = { login: "ada", avatarUrl: "" };
export const AI_ON: AiStatus = { configured: true, model: "gpt-test" };
export const AI_OFF: AiStatus = { configured: false };

export const READY_DRAFT: Draft = {
  title: "一篇可以提交的稿子",
  description: "一句话说明这篇讲什么",
  tags: ["前端"],
  body: "## 开头\n\n正文第一段。",
};

export const PRS: MyPr[] = [
  { number: 12, title: "我的第一篇投稿", url: "https://github.com/x/y/pull/12", state: "open", updatedAt: "2026-11-02T08:00:00Z" },
  { number: 9, title: "已经发布的那篇", url: "https://github.com/x/y/pull/9", state: "merged", updatedAt: "2026-10-20T08:00:00Z" },
];

type Handler = unknown;

/** 一张能当预览地址的小图（headless 不载入图片，内容无所谓，只要是 data: 地址）。 */
export const PREVIEW_URL = "data:image/png;base64,iVBORw0KGgo=";

/** 投稿图片的发布地址：16 位十六进制 + 扩展名，和 MEDIA_PATH 一致。 */
export function mediaPath(n: number, ext = "png") {
  return `/blog/contrib-images/${n.toString(16).padStart(16, "0")}.${ext}`;
}

/** 已登录、AI 已设置的宿主；`over` 覆盖其中几个函数。 */
export function signedIn(over: Record<string, Handler> = {}) {
  return {
    "site.ready": null,
    "auth.status": ADA,
    "auth.logout": null,
    "ai.status": AI_ON,
    "ai.openSettings": null,
    "ai.cancel": null,
    "media.url": { url: PREVIEW_URL },
    "diagram.render": { url: "data:image/svg+xml;base64,PHN2Zy8+" },
    "site.open": null,
    ...over,
  };
}


/** 带一份草稿启动（Storage 里已有存档）。 */
export function withDraft(draft: Draft) {
  return { "pairwise.draft": JSON.stringify(draft) };
}

/** 过 `ms` 毫秒才到的回答（像真的网络请求）。步骤会等它，但回答在步骤结束后才被应用处理。 */
export function later<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
