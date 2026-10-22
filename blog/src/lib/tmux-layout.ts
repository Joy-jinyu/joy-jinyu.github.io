/**
 * tmux 模拟器的数据模型：一个窗口的 pane 布局是一棵二叉分屏树。
 * row = 左右排列（split-window -h），col = 上下排列（split-window -v）；ratio 是第一个子节点占的比例
 */
export type Leaf = { kind: 'pane'; id: number }
export type Split = { kind: 'split'; dir: 'row' | 'col'; a: Node; b: Node; ratio: number }
export type Node = Leaf | Split

/** 调大小的步长和上下限：对应配置里 resize-pane 一次 5 格，演示里换算成比例 */
export const RESIZE_STEP = 0.06
const MIN_RATIO = 0.15

/** 深度优先顺序就是 tmux 的 pane 编号顺序（pane-base-index 1，所以显示时 +1） */
export function paneIds(node: Node): number[] {
  return node.kind === 'pane' ? [node.id] : [...paneIds(node.a), ...paneIds(node.b)]
}

/** 把 id 对应的叶子换成「原 pane + 新 pane」的分屏，新 pane 在右边 / 下边 */
export function splitPane(node: Node, id: number, dir: Split['dir'], newId: number): Node {
  if (node.kind === 'pane') {
    return node.id === id ? { kind: 'split', dir, a: node, b: { kind: 'pane', id: newId }, ratio: 0.5 } : node
  }
  return { ...node, a: splitPane(node.a, id, dir, newId), b: splitPane(node.b, id, dir, newId) }
}

/** 删掉一个 pane，它的兄弟节点顶上父节点的位置；删的是最后一个 pane 时返回 null */
export function removePane(node: Node, id: number): Node | null {
  if (node.kind === 'pane') return node.id === id ? null : node
  const a = removePane(node.a, id)
  const b = removePane(node.b, id)
  if (!a) return b
  if (!b) return a
  return { ...node, a, b }
}

/**
 * resize-pane -L/-R/-U/-D：找离这个 pane 最近、方向一致的祖先分屏，移动它的分隔线。
 * 不管 pane 在分隔线哪一侧，-L 都是把线往左推，所以只看方向不看位置
 */
export function resizePane(node: Node, id: number, dir: 'L' | 'R' | 'U' | 'D'): Node {
  const axis: Split['dir'] = dir === 'L' || dir === 'R' ? 'row' : 'col'
  const delta = dir === 'L' || dir === 'U' ? -RESIZE_STEP : RESIZE_STEP
  const path = pathTo(node, id)
  const target = [...path].reverse().find((n) => n.dir === axis)
  if (!target) return node
  return mapSplit(node, target, (s) => ({ ...s, ratio: clamp(s.ratio + delta) }))
}

const clamp = (r: number) => Math.min(1 - MIN_RATIO, Math.max(MIN_RATIO, r))

function pathTo(node: Node, id: number): Split[] {
  if (node.kind === 'pane') return []
  if (paneIds(node.a).includes(id)) return [node, ...pathTo(node.a, id)]
  if (paneIds(node.b).includes(id)) return [node, ...pathTo(node.b, id)]
  return []
}

function mapSplit(node: Node, target: Split, fn: (s: Split) => Split): Node {
  if (node.kind === 'pane') return node
  if (node === target) return fn(node)
  return { ...node, a: mapSplit(node.a, target, fn), b: mapSplit(node.b, target, fn) }
}

type Rect = { left: number; top: number; right: number; bottom: number }

/**
 * select-pane -L/-R/-U/-D：在指定方向上、与当前 pane 有重叠的 pane 里选最近的一个。
 * 位置用渲染后的 DOM 矩形算，省得在模型里重复一遍布局计算
 */
export function neighbor(rects: Map<number, Rect>, from: number, dir: 'L' | 'R' | 'U' | 'D'): number | null {
  const a = rects.get(from)
  if (!a) return null
  let best: number | null = null
  let bestDist = Infinity
  for (const [id, b] of rects) {
    if (id === from) continue
    const horizontal = dir === 'L' || dir === 'R'
    const overlap = horizontal ? b.top < a.bottom - 1 && b.bottom > a.top + 1 : b.left < a.right - 1 && b.right > a.left + 1
    const dist = { L: a.left - b.right, R: b.left - a.right, U: a.top - b.bottom, D: b.top - a.bottom }[dir]
    if (overlap && dist >= -2 && dist < bestDist) {
      best = id
      bestDist = dist
    }
  }
  return best
}
