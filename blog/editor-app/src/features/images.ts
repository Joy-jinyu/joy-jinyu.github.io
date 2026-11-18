/** 插入图片：选图 → 交给宿主存（media.add）→ 在正文光标处（没有就末尾）写进 `![名字](地址)`。张数和大小按 LIMITS 卡。 */
import { Picker, signal } from "nsh";
import { LIMITS, MEDIA_PATH } from "../../../src/lib/editor-host/contract";
import type { StepState } from "../ui";
import { currentDraft, insertBlock, setField } from "./draft";
import { call, messageOf } from "./host";

/** 选图时把长边缩到多少像素、JPEG 用什么质量重新编码：正文里的图用不着更大，也让大多数照片落在 2 MB 以内。 */
const PICK = { maxDimension: 2000, quality: 0.85 } as const;

export type ImageJob = { id: number; name: string; state: StepState; message?: string };

const jobs = signal<ImageJob[]>([]);
const notice = signal<string | null>(null);
/** 用户最后在正文里的光标（选区末尾），以及那时的正文：正文被别处改过（AI 替换、清空）就不再信它。 */
let caret: { at: number; body: string } | null = null;
let nextId = 0;

export const imageJobs = () => jobs();
export const imagesBusy = () => jobs().some((j) => j.state === "pending" || j.state === "active");
export const imageNotice = () => notice();
export const dismissImageNotice = () => notice.set(null);
export const clearImageJobs = () => jobs.set([]);

/** 正文里已经用到的投稿图片（同一张只算一次）。 */
export function countImages(body: string): number {
  const paths = new Set<string>();
  for (const m of body.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
    if (MEDIA_PATH.test(m[1])) paths.add(m[1]);
  }
  return paths.size;
}

/** 正文输入框的光标变了。 */
export function noteCaret(selection: { start: number; end: number }) {
  caret = { at: selection.end, body: currentDraft().body };
}

/** 用户在正文输入框里改了字（光标事件可能先到，那时记下的正文是旧的）。 */
export function noteBodyEdit(body: string) {
  if (caret) caret = { ...caret, body };
}

/** 选图并插入；张数、大小超了给出说明，每张图的进度在 `imageJobs`。 */
export async function insertImages() {
  if (imagesBusy()) return;
  notice.set(null);
  const remaining = LIMITS.images - countImages(currentDraft().body);
  if (remaining <= 0) {
    notice.set(`正文里已经有 ${LIMITS.images} 张图片，最多放 ${LIMITS.images} 张。删掉一张再插入。`);
    return;
  }
  let picked: Awaited<ReturnType<typeof Picker.pickImages>>;
  try {
    picked = await Picker.pickImages({ multiple: true, limit: remaining, ...PICK });
  } catch (error) {
    notice.set(`没能打开选图：${messageOf(error)}`);
    return;
  }
  if (!picked.length) return;
  // 有的平台（网页的文件框）不管 limit，多选的部分丢掉并说明。
  if (picked.length > remaining) {
    notice.set(`正文最多 ${LIMITS.images} 张图片，只插入了前 ${remaining} 张。`);
    picked = picked.slice(0, remaining);
  }
  const files = picked.map((p) => p.file);
  const mine = files.map((file) => ({ id: ++nextId, name: file.name || "图片", state: "pending" as StepState }));
  jobs.set(mine);
  let at = startAt();
  let expected = currentDraft().body;
  for (let i = 0; i < files.length; i++) {
    const job = mine[i];
    update(job.id, { state: "active" });
    try {
      const block = await store(files[i]);
      // 上传期间用户改了正文，位置就不准了：放到末尾。
      const body = currentDraft().body;
      const placed = insertBlock(body, body === expected ? at : body.length, block);
      setField("body", placed.body);
      at = placed.end;
      expected = placed.body;
      caret = { at, body: placed.body };
      update(job.id, { state: "done" });
    } catch (error) {
      update(job.id, { state: "error", message: messageOf(error) });
    }
  }
  // 都插进去了：正文里已经看得到，进度不用留着。
  if (jobs().every((j) => j.state === "done")) jobs.set([]);
}

/** 光标还可信就从光标处插，否则放在末尾。 */
function startAt(): number {
  const body = currentDraft().body;
  return caret && caret.body === body ? caret.at : body.length;
}

/** 存一张图，返回要写进正文的 Markdown。 */
async function store(file: File): Promise<string> {
  if (file.size > LIMITS.imageBytes) {
    throw new Error(`有 ${(file.size / 1024 / 1024).toFixed(1)} MB，单张最多 ${LIMITS.imageBytes / 1024 / 1024} MB。`);
  }
  const data = Buffer.from(new Uint8Array(await file.arrayBuffer())).toString("base64");
  const ref = await call("media.add", { name: file.name, type: file.type, data });
  return `![${altOf(file.name)}](${ref.path})`;
}

/** 文件名去掉扩展名当图片说明；方括号会打断 Markdown，去掉。 */
function altOf(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[[\]]/g, "").replace(/\s+/g, " ").trim() || "图片";
}

function update(id: number, patch: Partial<ImageJob>) {
  jobs.update((list) => list.map((j) => (j.id === id ? { ...j, ...patch } : j)));
}
