/** 按 blog/src/lib/editor-host/contract.ts 加上类型的 host.call / host.on。耗时的调用不设超时（登录、AI、存图、画图、提 PR 可能要几十秒）。 */
import { host } from "nsh";
import type { HostCalls, HostEvents } from "../../../src/lib/editor-host/contract";

const LONG: ReadonlySet<keyof HostCalls> = new Set(["auth.login", "ai.complete", "media.add", "diagram.render", "contrib.submit"]);

/** 调宿主函数；失败时 reject 一个带宿主错误信息的 Error。 */
export function call<K extends keyof HostCalls>(name: K, args: HostCalls[K]["args"]): Promise<HostCalls[K]["result"]> {
  return host.call(name, args, LONG.has(name) ? { timeout: 0 } : null) as Promise<HostCalls[K]["result"]>;
}

/** 听宿主事件；在组件里调用时随组件一起停。 */
export function on<K extends keyof HostEvents>(name: K, listener: (data: HostEvents[K]) => void): () => void {
  return host.on<HostEvents[K]>(name, listener);
}

/** 给用户看的错误文字：宿主的错误信息，没有就给一句通用的。 */
export function messageOf(error: unknown): string {
  const text = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return text.trim() || "出了点问题，再试一次。";
}
