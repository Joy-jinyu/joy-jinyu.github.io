/**
 * 读 xray.mjs 的输出，算「写的间距」和「看到的间距」。
 * 用法：node relate.mjs <xray json>... > relations.json
 * 写的间距：两个行盒（文字的 line-height 盒子）或盒子边之间的距离，也就是 CSS 里 margin、padding、gap 加起来的结果。
 * 看到的间距：两块墨迹（真正画出来的像素）之间的距离；盒子的边（底色、边框）本身就是墨迹。
 * 关系按文案找，三份页面用的是同一份文案（见 prompt.txt）。
 */
import { readFileSync } from 'node:fs'

/** [名字, 锚点文字, 方向]：方向 up 是量锚点上面那一段空白，down 是下面那一段 */
const RELATIONS = [
  ['分组标题「通知」和上一块', '通知', 'up'],
  ['分组标题「通知」和它的分组', '通知', 'down'],
  ['分组标题「安全」和上一块', '安全', 'up'],
  ['分组标题「安全」和它的分组', '安全', 'down'],
  ['分组标题「联系邮箱」和上一块', '联系邮箱', 'up'],
  ['分组标题「联系邮箱」和它的分组', '联系邮箱', 'down'],
  ['昵称和 ID', '林小满', 'down'],
  ['「邮件摘要」和它的说明', '邮件摘要', 'down'],
  ['说明和下一行', '每周一早上 9 点发送', 'down'],
  ['标签「邮箱」和输入框', '邮箱', 'down'],
  ['输入框和提示', '用于接收账单和安全提醒', 'up'],
  ['提示和下面', '用于接收账单和安全提醒', 'down'],
  ['退出登录和版本号', '版本 3.8.2', 'up'],
]

const overlapX = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1
const r1 = (v) => Math.round(v * 10) / 10

/** 可以挡在锚点上下的东西：文字（行盒 / 墨迹两种看法）、图标和伪元素（只有墨迹）、看得见的盒子边 */
function edges(atoms, view) {
  const out = []
  for (const a of atoms) {
    if (a.kind === 'box') {
      const { x, y, w, h } = a.rect
      if (a.fill || a.sides.includes('top')) out.push({ who: a, top: y, bottom: y, x, w })
      if (a.fill || a.sides.includes('bottom')) out.push({ who: a, top: y + h, bottom: y + h, x, w })
    } else {
      const q = view === 'line' && a.lineBox ? a.lineBox : a.ink
      out.push({ who: a, top: q.y, bottom: q.y + q.h, x: q.x, w: q.w })
    }
  }
  return out
}

function gap(atoms, anchor, dir, view) {
  const q = view === 'line' ? anchor.lineBox : anchor.ink
  let best = null
  for (const e of edges(atoms, view)) {
    if (e.who === anchor || !overlapX(e, q)) continue
    const g = dir === 'up' ? q.y - e.bottom : e.top - (q.y + q.h)
    if (g < -0.5) continue
    if (!best || g < best.g) best = { g, who: e.who }
  }
  if (!best) return null
  // span：这段空白在页面上的上下两条边（CSS px），文章里的 X 光图按它画
  const near = dir === 'up' ? q.y : q.y + q.h
  const span = dir === 'up' ? [r1(near - Math.max(0, best.g)), r1(near)] : [r1(near), r1(near + Math.max(0, best.g))]
  return { px: r1(Math.max(0, best.g)), span, to: best.who.kind === 'box' ? `${best.who.who} 的边` : `${best.who.who}「${best.who.text.slice(0, 10)}」` }
}

const pages = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8')))
const out = pages.map((p) => {
  const texts = p.atoms.filter((a) => a.kind === 'text')
  const relations = RELATIONS.map(([name, text, dir]) => {
    const anchor = texts.find((a) => a.text === text)
    if (!anchor) return { name, missing: true }
    const line = gap(p.atoms, anchor, dir, 'line'), ink = gap(p.atoms, anchor, dir, 'ink')
    return { name, anchor: text, dir, x: r1(anchor.ink.x), written: line?.px ?? null, seen: ink?.px ?? null, writtenSpan: line?.span, seenSpan: ink?.span, writtenTo: line?.to, seenTo: ink?.to }
  })
  // 居中：一个有底色或四边框的盒子里只有一段文字，比较盒子中线、行盒中线、墨迹中线
  const centering = p.atoms.filter((b) => b.kind === 'box' && (b.fill || b.sides.length === 4)).flatMap((b) => {
    const inside = texts.filter((t) => t.ink.x >= b.rect.x && t.ink.x + t.ink.w <= b.rect.x + b.rect.w && t.ink.y >= b.rect.y && t.ink.y + t.ink.h <= b.rect.y + b.rect.h)
    if (inside.length !== 1 || b.rect.h > 80) return []
    const t = inside[0], mid = b.rect.y + b.rect.h / 2
    return [{ box: b.who, text: t.text, font: t.font, boxH: b.rect.h, lineOff: r1(t.lineBox.y + t.lineBox.h / 2 - mid), inkOff: r1(t.ink.y + t.ink.h / 2 - mid), inkTop: r1(t.ink.y - b.rect.y), inkBottom: r1(b.rect.y + b.rect.h - t.ink.y - t.ink.h) }]
  })
  return { file: p.file, relations, centering }
})
console.log(JSON.stringify(out, null, 1))
