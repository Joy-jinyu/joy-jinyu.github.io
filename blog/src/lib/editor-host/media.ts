/**
 * 投稿图片：存在本页的 IndexedDB 里（刷新后还在，只给预览和提交用），按内容哈希命名。
 * 规则（格式、大小、SVG 白名单）见 lib/contrib-media.mjs，PR 守门用同一份。
 */
import { LIMITS, MEDIA_PREFIX, type MediaRef } from './contract'
import { allowedAttr, allowedElement, MAX_SVG_BYTES, MAX_SVG_ELEMENTS, MAX_SVG_USE, sniffImage } from '../contrib-media.mjs'

type Stored = { path: string; type: string; bytes: Uint8Array }

const DB = 'pairwise-editor'
const STORE = 'media'

let opened: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  opened ??= openDb().catch((err) => {
    opened = null
    throw err
  })
  return opened
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'path' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(new Error('浏览器不让存图片（可能是隐私模式）'))
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const req = run(d.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('存图片失败'))
  })
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }

export function toBase64(bytes: Uint8Array) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

const dataUrl = (s: Stored) => `data:${s.type};base64,${toBase64(s.bytes)}`

async function save(bytes: Uint8Array, ext: string): Promise<MediaRef> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  const name = [...hash.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('')
  const stored: Stored = { path: `${MEDIA_PREFIX}${name}.${ext}`, type: MIME[ext], bytes }
  await tx('readwrite', (s) => s.put(stored))
  return { path: stored.path, url: dataUrl(stored) }
}

/** 访客选的图片：只收 png / jpg / gif / webp，按文件头认，不收 SVG */
export async function addImage(data: string): Promise<MediaRef> {
  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
  } catch {
    throw new Error('图片数据读不出来')
  }
  if (bytes.length > LIMITS.imageBytes) throw new Error(`图片太大了，每张最多 ${LIMITS.imageBytes / 1024 / 1024} MB`)
  const ext = sniffImage(bytes)
  if (!ext) throw new Error('只支持 PNG、JPEG、GIF、WebP 图片')
  return save(bytes, ext)
}

/** AI 画的 SVG：按白名单清洗（删掉脚本、事件、外部引用等）后存成图片 */
export async function addSvg(raw: string): Promise<MediaRef> {
  const clean = sanitizeSvg(raw)
  const bytes = new TextEncoder().encode(clean)
  if (bytes.length > MAX_SVG_BYTES) throw new Error('AI 画的 SVG 太大了，可以让它画简单一点')
  return save(bytes, 'svg')
}

export function sanitizeSvg(raw: string): string {
  const start = raw.indexOf('<svg')
  const end = raw.lastIndexOf('</svg>')
  if (start < 0 || end < start) throw new Error('AI 没有返回 SVG')
  const doc = new DOMParser().parseFromString(raw.slice(start, end + 6), 'image/svg+xml')
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') throw new Error('AI 返回的 SVG 格式不对，可以再试一次')
  const SVG_NS = 'http://www.w3.org/2000/svg'
  const walk = (el: Element) => {
    for (const child of [...el.children]) {
      // 只认 SVG 命名空间里、不带前缀的元素：<svg:path> 这类守门（sax）会按全名拒绝
      if (child.namespaceURI !== SVG_NS || child.prefix || !allowedElement(child.localName)) child.remove()
      else walk(child)
    }
    for (const attr of [...el.attributes]) if (!allowedAttr(attr.name, attr.value)) el.removeAttribute(attr.name)
  }
  walk(doc.documentElement)
  // 注释、处理指令不留；CDATA 换成普通文本（守门不收 CDATA）
  const it = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION)
  const odd: Node[] = []
  for (let n = it.nextNode(); n; n = it.nextNode()) odd.push(n)
  for (const n of odd) {
    if (n.nodeType === Node.CDATA_SECTION_NODE) n.parentNode?.replaceChild(doc.createTextNode(n.textContent ?? ''), n)
    else n.parentNode?.removeChild(n)
  }
  const count = doc.getElementsByTagName('*').length
  if (count > MAX_SVG_ELEMENTS || doc.getElementsByTagName('use').length > MAX_SVG_USE) throw new Error('AI 画的 SVG 太复杂了，可以让它画简单一点')
  if (!doc.documentElement.getAttribute('xmlns')) doc.documentElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  return new XMLSerializer().serializeToString(doc.documentElement)
}

export async function urlOf(path: string): Promise<string | null> {
  const s = await tx<Stored | undefined>('readonly', (st) => st.get(path))
  return s ? dataUrl(s) : null
}

export async function bytesOf(path: string): Promise<Stored | null> {
  return (await tx<Stored | undefined>('readonly', (st) => st.get(path))) ?? null
}
