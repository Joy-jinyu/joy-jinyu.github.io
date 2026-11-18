/** 登录和 AI 状态：启动时问一次宿主，之后跟着 auth.changed / ai.changed 走。信号私有，页面通过函数读写。 */
import { computed, effect, signal } from "nsh";
import type { AiStatus, Login } from "../../../src/lib/editor-host/contract";
import { call, messageOf, on } from "./host";

/** undefined：还没问到。 */
const login = signal<Login | undefined>(undefined);
const ai = signal<AiStatus | undefined>(undefined);
const bootError = signal<string | null>(null);
const aiError = signal<string | null>(null);

/** 当前登录的人，null 是未登录（读的地方跟踪）。 */
export const currentLogin = () => login() ?? null;
export const aiStatus = () => ai();
export const aiReady = () => ai()?.configured === true;
export const aiStatusError = () => aiError();
export const sessionError = () => bootError();

/** 应用处在哪一屏；只在屏幕真的变了时通知（同一个人重复登录不重建写稿页）。 */
export const phase = computed<"loading" | "error" | "out" | "in">(() => {
  if (login() === undefined) return bootError() ? "error" : "loading";
  return login() ? "in" : "out";
});

/** 订阅宿主事件并读初始状态；在根组件里调用一次。 */
export function startSession() {
  on("auth.changed", (next) => login.set(next));
  on("ai.changed", (next) => {
    aiError.set(null);
    ai.set(next);
  });
  void loadLogin();
  void loadAi();
}

/**
 * 首屏（未登录、写稿或读取失败）出现后的下一帧告诉宿主一次，宿主收起它的加载层。在根组件里调用一次。
 * 宿主拒绝也不管：加载层怎么收是宿主的事，应用照常用。
 */
export function announceReady() {
  let sent = false;
  effect(() => {
    if (sent || phase() === "loading") return;
    sent = true;
    requestAnimationFrame(() => {
      call("site.ready", null).catch(() => undefined);
    });
  });
}

/** 读登录状态；失败时进入 error 屏，可重试。 */
export async function loadLogin() {
  bootError.set(null);
  try {
    login.set(await call("auth.status", null));
  } catch (error) {
    bootError.set(messageOf(error));
  }
}

/** 读 AI 设置；失败只影响顶栏的 AI 状态，按它重试。 */
export async function loadAi() {
  aiError.set(null);
  try {
    ai.set(await call("ai.status", null));
  } catch (error) {
    aiError.set(messageOf(error));
  }
}

/** GitHub 登录。返回 false：用户没完成授权（宿主返回 null）；失败时 reject。 */
export async function signIn(): Promise<boolean> {
  const who = await call("auth.login", null);
  if (who) login.set(who);
  return !!who;
}

export async function signOut() {
  await call("auth.logout", null);
  login.set(null);
}

/** 打开站点顶栏的 AI 设置对话框；之后宿主会发 ai.changed。 */
export function openAiSettings() {
  return call("ai.openSettings", null);
}
