// 测试扮演宿主页：按 host-contract.ts 的函数名给出回答。每个测试只覆盖它关心的那几个。
import type { AiStatus, Draft, Login, MyPr } from "../host-contract";

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

/** 已登录、AI 已设置的宿主；`over` 覆盖其中几个函数。 */
export function signedIn(over: Record<string, Handler> = {}) {
  return {
    "auth.status": ADA,
    "auth.logout": null,
    "ai.status": AI_ON,
    "ai.openSettings": null,
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
