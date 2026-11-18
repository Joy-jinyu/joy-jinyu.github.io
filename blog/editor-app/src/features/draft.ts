/** 当前稿件：内存里一份，停手 600ms 后存到 Storage，启动时读回来。也放校验规则（和宿主提交前的校验一致）。 */
import { signal, Storage } from "nsh";
import { bodyBytes, type Draft, LIMITS } from "../../host-contract";

const KEY = "pairwise.draft";
/** 停止输入后多久存一次（毫秒）。 */
const SAVE_DELAY = 600;

export const EMPTY_DRAFT: Draft = { title: "", description: "", tags: [], body: "" };

const draft = signal<Draft>(EMPTY_DRAFT);
/** idle：没改过；pending：等着存；saved：已存；error：存不进去。 */
const saveState = signal<"idle" | "pending" | "saved" | "error">("idle");
let timer: ReturnType<typeof setTimeout> | undefined;
/** 用户在读回之前已经动过稿子，就不再用存档覆盖。 */
let edited = false;

export const currentDraft = () => draft();
export const draftSaveState = () => saveState();

export function isBlank(d: Draft): boolean {
  return !d.title.trim() && !d.description.trim() && d.tags.length === 0 && !d.body.trim();
}

/** 改一个字段。 */
export function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
  edited = true;
  draft.update((d) => ({ ...d, [key]: value }));
  scheduleSave();
}

/** 整篇换掉（AI 起稿填入）。 */
export function replaceDraft(next: Draft) {
  edited = true;
  draft.set({ title: next.title, description: next.description, tags: next.tags.slice(0, LIMITS.tags), body: next.body });
  scheduleSave();
}

/** 清空并删掉存档。 */
export async function clearDraft() {
  edited = true;
  if (timer) clearTimeout(timer);
  draft.set(EMPTY_DRAFT);
  saveState.set("idle");
  try {
    await Storage.removeItem(KEY);
  } catch {
    saveState.set("error");
  }
}

/** 启动时读回存档；存档坏了就当没有。 */
export async function restoreDraft() {
  let raw: string | null = null;
  try {
    raw = await Storage.getItem(KEY);
  } catch {
    saveState.set("error");
    return;
  }
  const saved = parse(raw);
  if (saved && !edited) {
    draft.set(saved);
    saveState.set("saved");
  }
}

function scheduleSave() {
  if (timer) clearTimeout(timer);
  saveState.set("pending");
  timer = setTimeout(() => void save(), SAVE_DELAY);
}

async function save() {
  timer = undefined;
  try {
    await Storage.setItem(KEY, JSON.stringify(draft()));
    if (!timer) saveState.set("saved");
  } catch {
    saveState.set("error");
  }
}

function parse(raw: string | null): Draft | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<Draft>;
    const text = (v: unknown) => (typeof v === "string" ? v : "");
    return {
      title: text(o.title),
      description: text(o.description),
      tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === "string").slice(0, LIMITS.tags) : [],
      body: text(o.body),
    };
  } catch {
    return null;
  }
}

export type DraftErrors = Partial<Record<keyof Draft, string>>;

/** 和宿主 contrib.submit 前的校验同一套规则（按 UTF-16 长度计，和宿主一致）。 */
export function validate(d: Draft): DraftErrors {
  const errors: DraftErrors = {};
  const title = d.title.trim();
  const description = d.description.trim();
  if (!title) errors.title = "写一个标题。";
  else if (title.length > LIMITS.title) errors.title = `标题最多 ${LIMITS.title} 字。`;
  if (!description) errors.description = "用一句话说明这篇讲什么。";
  else if (description.length > LIMITS.description) errors.description = `摘要最多 ${LIMITS.description} 字。`;
  if (d.tags.length > LIMITS.tags) errors.tags = `最多 ${LIMITS.tags} 个标签。`;
  else if (d.tags.some((t) => t.length > LIMITS.tag)) errors.tags = `每个标签最多 ${LIMITS.tag} 字。`;
  if (!d.body.trim()) errors.body = "正文还是空的。";
  else if (bodyBytes(d.body) > LIMITS.bodyBytes) errors.body = `正文太长了，最多约 ${Math.floor(LIMITS.bodyBytes / 1024)} KB。`;
  return errors;
}
