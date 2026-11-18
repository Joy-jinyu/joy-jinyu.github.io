/** 提交审核：确认 → 进度（跟着 contrib.progress）→ 成功拿到 PR / 失败可重试。 */
import { signal } from "nsh";
import type { SubmitStep, Submitted } from "../../../src/lib/editor-host/contract";
import { confirm, type StepState } from "../ui";
import { clearDraft, currentDraft } from "./draft";
import { call, messageOf, on } from "./host";

/** 步骤顺序和文案，和宿主发的 contrib.progress 的 step 一一对应。 */
export const SUBMIT_STEPS: { id: SubmitStep; label: string }[] = [
  { id: "fork", label: "准备仓库" },
  { id: "branch", label: "创建分支" },
  { id: "commit", label: "写入稿件" },
  { id: "pr", label: "提交 PR" },
];

type Progress = Record<SubmitStep, StepState>;
const ALL_PENDING: Progress = { fork: "pending", branch: "pending", commit: "pending", pr: "pending" };

const open = signal(false);
const status = signal<"running" | "success" | "error">("running");
const progress = signal<Progress>(ALL_PENDING);
const result = signal<Submitted | null>(null);
const error = signal<string | null>(null);

export const submitOpen = () => open();
export const submitStatus = () => status();
export const submitResult = () => result();
export const submitError = () => error();
export const submitSteps = () => SUBMIT_STEPS.map((s) => ({ id: s.id, label: s.label, state: progress()[s.id] }));

/** 听宿主的进度事件；写稿页挂载时调用，随页面一起停。 */
export function followProgress() {
  on("contrib.progress", ({ step, state }) => {
    if (status() === "running") progress.update((p) => ({ ...p, [step]: state }));
  });
}

/** 先确认，再提交。 */
export async function startSubmit() {
  const ok = await confirm({
    title: "提交这篇稿件？",
    description: "会在你的 GitHub 账号下 fork 本站仓库，新建分支写入稿件，再向本站发一个 PR。审过合并后才会发布在「投稿」专栏。",
    confirmLabel: "提交",
  });
  if (!ok) return;
  open.set(true);
  await submit();
}

/** 提交（失败后的重试也走这里）。 */
export async function submit() {
  status.set("running");
  error.set(null);
  result.set(null);
  progress.set(ALL_PENDING);
  try {
    const done = await call("contrib.submit", currentDraft());
    progress.set({ fork: "done", branch: "done", commit: "done", pr: "done" });
    result.set(done);
    status.set("success");
    // 稿件已经在 PR 里了：成功就清掉草稿，不管对话框之后怎么关，都不会把同一篇再提交一次
    await clearDraft();
  } catch (e) {
    // 卡在哪一步就把哪一步标成失败：进行中的那步，没有就是第一个没完成的。
    progress.update((p) => {
      const failed = SUBMIT_STEPS.find((s) => p[s.id] === "active") ?? SUBMIT_STEPS.find((s) => p[s.id] !== "done");
      return failed ? { ...p, [failed.id]: "error" } : p;
    });
    error.set(messageOf(e));
    status.set("error");
  }
}

/** 关掉进度对话框（进行中不能关）。 */
export function closeSubmit() {
  if (status() !== "running") open.set(false);
}
