/** AI 工具的状态：哪个对话框开着、哪个在跑、AI 没设置时的提示。只认最新一次调用的结果。 */
import { signal } from "nsh";
import type { AiResult, AiTask } from "../../host-contract";
import { call, messageOf } from "./host";
import { showNotice } from "./notice";
import { aiReady, openAiSettings } from "./session";

export type AiKind = AiTask["task"];

const open = signal<AiKind | null>(null);
const running = signal<AiKind | null>(null);
const hint = signal(false);
/** 每次调用和每次关闭都加一；回来的结果对不上就丢掉。 */
let ticket = 0;

export const aiOpen = () => open();
export const aiRunning = () => running();
/** AI 还没设置、用户按过 AI 按钮之后显示提示；设置好了自动消失。 */
export const aiHintShown = () => hint() && !aiReady();

/** 工具栏按钮：AI 没设置就打开站点的 AI 设置，否则打开对应对话框。 */
export async function startAi(kind: AiKind) {
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
  open.set(kind);
}

/** 关掉对话框，放弃正在跑的那次。 */
export function closeAi() {
  ticket++;
  running.set(null);
  open.set(null);
}

/** 跑一次 AI；对话框关了或又跑了一次，这次的结果和错误都不再回调。 */
export function runAi<K extends AiKind>(
  task: Extract<AiTask, { task: K }>,
  done: (result: AiResult[K]) => void,
  failed: (message: string) => void,
) {
  const mine = ++ticket;
  running.set(task.task);
  call("ai.complete", task).then(
    (result) => {
      if (mine !== ticket) return;
      running.set(null);
      done(result as AiResult[K]);
    },
    (error) => {
      if (mine !== ticket) return;
      running.set(null);
      failed(messageOf(error));
    },
  );
}
