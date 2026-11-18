/** AI 工具的状态：哪个对话框开着、哪次在跑、它流过来的思考过程和内容、AI 没设置时的提示。只认最新一次调用的结果。 */
import { cleanup, computed, signal } from "nsh";
import type { AiResult, AiTask, HostEvents } from "../../../src/lib/editor-host/contract";
import { call, messageOf, on } from "./host";
import { showNotice } from "./notice";
import { aiReady, openAiSettings } from "./session";

export type AiKind = AiTask["task"];
/** 工具栏上的 AI 工具，一个工具一个对话框；「插入图表」跑 diagram 或 svg。 */
export type AiTool = "draft" | "polish" | "meta" | "chart";

/** 生成进行到哪：思考中（还没有内容）/ 写作中 / 整理中（内容停了，等宿主整理出结果）。 */
export type AiStage = "thinking" | "writing" | "finishing";

type Stream = { id: string; kind: AiKind; startedAt: number; reasoning: string; content: string; lastDelta: number };

/** 内容停下多久算「整理中」（毫秒）。协议里没有「流结束」事件，只能按停顿推断；模型写作中途很少停这么久。 */
const SETTLE_IDLE = 1500;
/** 阶段和秒数的刷新间隔（毫秒）。 */
const TICK = 250;

const open = signal<AiTool | null>(null);
const running = signal<AiTool | null>(null);
const hint = signal(false);
const stream = signal<Stream | null>(null);
const now = signal(0);
let clock: ReturnType<typeof setInterval> | undefined;
/** 每次调用和每次关闭都加一；回来的结果对不上就丢掉。 */
let ticket = 0;

export const aiOpen = () => open();
export const aiRunning = () => running();
/** AI 还没设置、用户按过 AI 按钮之后显示提示；设置好了自动消失。 */
export const aiHintShown = () => hint() && !aiReady();

/** 正在跑的这次流过来的思考过程和内容（没在跑时是空的）。 */
export const aiReasoning = () => stream()?.reasoning ?? "";
export const aiContent = () => stream()?.content ?? "";
export const aiStreamKind = () => stream()?.kind ?? null;
export const aiStage = computed<AiStage | null>(() => {
  const s = stream();
  if (!s) return null;
  if (!s.content) return "thinking";
  return now() - s.lastDelta >= SETTLE_IDLE ? "finishing" : "writing";
});
/** 这次跑了几秒。 */
export const aiElapsed = computed(() => {
  const s = stream();
  return s ? Math.max(0, Math.floor((now() - s.startedAt) / 1000)) : 0;
});

const toolOf = (kind: AiKind): AiTool => (kind === "diagram" || kind === "svg" ? "chart" : kind);

/** 工具栏按钮：AI 没设置就打开站点的 AI 设置，否则打开对应对话框。 */
export async function startAi(tool: AiTool) {
  if (!aiReady()) {
    hint.set(true);
    try {
      await openAiSettings();
    } catch (error) {
      showNotice(messageOf(error));
    }
    return;
  }
  hint.set(false);
  open.set(tool);
}

/** 听宿主推过来的增量；写稿页挂载时调用，随页面一起停（离开写稿页时也停掉正在跑的那次）。不是这次的（停掉的、关掉的）丢掉。 */
export function followAiDeltas() {
  cleanup(closeAi);
  on("ai.delta", (delta) => {
    const s = stream();
    if (!s || !isDelta(delta) || delta.id !== s.id || !delta.text) return;
    const at = Date.now();
    now.set(at);
    stream.set(delta.kind === "reasoning" ? { ...s, reasoning: s.reasoning + delta.text } : { ...s, content: s.content + delta.text, lastDelta: at });
  });
}

function isDelta(value: unknown): value is HostEvents["ai.delta"] {
  const d = value as Partial<HostEvents["ai.delta"]> | null;
  return !!d && typeof d.id === "string" && typeof d.text === "string" && (d.kind === "reasoning" || d.kind === "content");
}

/** 停掉正在跑的这次：告诉宿主中止，之后回来的结果和错误都不再回调。 */
export function stopAi() {
  const s = stream();
  ticket++;
  settle();
  if (s) call("ai.cancel", { id: s.id }).catch(() => undefined);
}

/** 关掉对话框，放弃正在跑的那次。 */
export function closeAi() {
  stopAi();
  open.set(null);
}

/** 跑一次 AI；停掉、对话框关了或又跑了一次，这次的结果和错误都不再回调。 */
export function runAi<K extends AiKind>(
  task: Extract<AiTask, { task: K }>,
  done: (result: AiResult[K]) => void,
  failed: (message: string) => void,
) {
  const mine = ++ticket;
  const id = `ai-${mine}-${Date.now().toString(36)}`;
  const at = Date.now();
  running.set(toolOf(task.task));
  now.set(at);
  stream.set({ id, kind: task.task, startedAt: at, reasoning: "", content: "", lastDelta: at });
  if (clock) clearInterval(clock);
  clock = setInterval(() => now.set(Date.now()), TICK);
  call("ai.complete", { ...task, id } as AiTask & { id: string }).then(
    (result) => {
      if (mine !== ticket) return;
      settle();
      done(result as AiResult[K]);
    },
    (error) => {
      if (mine !== ticket) return;
      settle();
      failed(messageOf(error));
    },
  );
}

function settle() {
  if (clock) clearInterval(clock);
  clock = undefined;
  running.set(null);
  stream.set(null);
}
