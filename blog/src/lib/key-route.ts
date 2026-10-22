/**
 * <key-route> 的行为层：演示一个按键从终端进来，先经过 tmux，再交给 nvim，最后被谁处理。
 * 键位取自文章里的 ~/.tmux.conf 和 ~/.config/nvim；结构和样式在 components/KeyRoute.astro
 */

type Layer = 'tmux' | 'nvim'
type Result = { layer: Layer; keys: string; action: string; note?: string }
/** timed=false：nvim 内置的等待（如 Ctrl-w），一直等下一个键，不受 timeoutlen 限制 */
export type Pending = { pending: string; timed: boolean; note?: string }

/** tmux 前缀之后的按键：我的配置、tmux-sensible 加的、以及常用的默认键。没列出的键 tmux 也会吃掉，只是演示里没收录 */
const TMUX: Record<string, string> = {
  '\\': 'split-window -h：左右分屏',
  '%': 'split-window -h：左右分屏',
  '-': 'split-window -v：上下分屏',
  '"': 'split-window -v：上下分屏',
  h: 'select-pane -L：移到左边的 pane',
  j: 'select-pane -D：移到下面的 pane',
  k: 'select-pane -U：移到上面的 pane',
  l: 'select-pane -R：移到右边的 pane',
  z: 'resize-pane -Z：放大 / 还原当前 pane',
  c: 'new-window：新建窗口',
  n: 'next-window：下一个窗口',
  p: 'previous-window：上一个窗口',
  d: 'detach-client：离开会话',
  '[': 'copy-mode：进入复制模式',
  r: 'source-file ~/.tmux.conf：重新加载配置',
  'C-a': 'send-prefix：把一个 Ctrl-a 转发给 nvim，nvim 里它的作用是把光标下的数字加 1',
  H: 'resize-pane -L 5：向左调大小，可连按',
  J: 'resize-pane -D 5：向下调大小，可连按',
  K: 'resize-pane -U 5：向上调大小，可连按',
  L: 'resize-pane -R 5：向右调大小，可连按',
  a: 'last-window：回到上一个窗口（tmux-sensible 插件加的）',
  x: 'kill-pane：关闭当前 pane（要确认）',
  '&': 'kill-window：关闭当前窗口（要确认）',
  ',': 'rename-window：重命名窗口',
  w: 'choose-tree：会话和窗口的树形列表',
  s: 'choose-tree -s：会话列表',
  q: 'display-panes：显示 pane 编号',
  ';': 'last-pane：回到上一个 pane',
  o: 'select-pane -t :.+：切到下一个 pane',
  '␣': 'next-layout：切换预设布局',
  '?': 'list-keys：列出全部快捷键',
  ':': 'command-prompt：输入 tmux 命令',
  '1': 'select-window -t :1', '2': 'select-window -t :2', '3': 'select-window -t :3',
}

/** nvim 普通模式下的映射（<leader> 是空格），键序列 -> 作用 */
const NVIM: Record<string, string> = {
  '␣w': ':w 保存',
  '␣q': ':q 关闭窗口',
  '␣e': ':Oil 打开文件浏览',
  '␣ff': 'Telescope find_files 找文件',
  '␣fg': 'Telescope live_grep 全文搜索',
  '␣fb': 'Telescope buffers 已打开的文件',
  '␣fh': 'Telescope help_tags 查帮助',
  '␣gg': ':LazyGit',
  '␣rn': 'LSP 重命名符号（LSP 连上后才有）',
  '␣ca': 'LSP code action（LSP 连上后才有）',
  '␣f': 'conform 格式化当前文件（LSP 连上后才有）',
  gd: 'LSP 跳到定义（LSP 连上后才有）',
  gr: 'LSP 查找引用（LSP 连上后才有）',
  grr: 'LSP 查找引用（nvim 0.11 自带）',
  grn: 'LSP 重命名（nvim 0.11 自带）',
  gri: 'LSP 跳到实现（nvim 0.11 自带）',
  gra: 'LSP code action（nvim 0.11 自带）',
  grt: 'LSP 跳到类型定义（nvim 0.11 自带）',
  gi: 'LSP 跳到实现（LSP 连上后才有）',
  K: 'LSP 悬浮文档（LSP 连上后才有）',
  '-': ':Oil 打开上级目录',
  Esc: ':nohlsearch 清掉搜索高亮',
  'C-wh': '移到左边的 nvim 窗口',
  'C-wj': '移到下面的 nvim 窗口',
  'C-wk': '移到上面的 nvim 窗口',
  'C-wl': '移到右边的 nvim 窗口',
  'C-wv': '左右分出一个 nvim 窗口',
  'C-ws': '上下分出一个 nvim 窗口',
}

/** 对应 options.lua 的 timeoutlen：键序列有歧义时 nvim 等这么久再决定 */
export const TIMEOUT_MS = 300

/** 把 KeyboardEvent 转成映射表里的键名 */
export function keyName(e: KeyboardEvent): string | null {
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return null
  if (e.ctrlKey && e.key.length === 1) return `C-${e.key.toLowerCase()}`
  if (e.key === ' ') return '␣'
  if (e.key === 'Escape') return 'Esc'
  return e.key.length === 1 ? e.key : null
}

const label = (k: string) => k.replace(/^C-/, 'Ctrl-').replace('␣', 'Space ')

/**
 * 按键路由的状态机。feed 返回本次按键的处理结果；返回 pending 表示 nvim 还在等后续按键，
 * 调用方在 TIMEOUT_MS 后调 flush() 拿到「等不到就按短的执行」的结果
 */
export class Router {
  private prefix = false
  private buf = ''

  get pendingSeq() {
    return this.buf
  }

  feed(k: string): Result | Pending {
    if (this.prefix) {
      this.prefix = false
      const action = TMUX[k]
      return {
        layer: 'tmux',
        keys: `Ctrl-a ${label(k)}`,
        action: action ?? '前缀后的这个键演示里没收录',
        note: action ? undefined : 'tmux 收下了这个键，不会发给 nvim；实际绑定可以按 前缀 ? 查看',
      }
    }
    // tmux 不管 nvim 在等什么，看到前缀就截住；nvim 那边等着的半截序列之后自己超时作废
    if (k === 'C-a') {
      const dropped = this.buf
      this.buf = ''
      this.prefix = true
      return {
        layer: 'tmux',
        keys: 'Ctrl-a',
        action: '前缀键：等下一个键',
        note: dropped ? `tmux 截住了 Ctrl-a；nvim 里等着的「${label(dropped)}」收不到后续，会超时作废` : 'tmux 截住，不会发给 nvim',
      }
    }
    const seq = this.buf + (k.startsWith('C-') && this.buf === 'C-w' ? k.slice(2) : k)
    const exact = NVIM[seq]
    const longer = Object.keys(NVIM).some((s) => s !== seq && s.startsWith(seq))
    if (longer) {
      this.buf = seq
      if (seq === 'C-w') return { pending: seq, timed: false, note: 'Ctrl-w 是 nvim 的内置命令，会一直等下一个键，不受 timeoutlen 限制' }
      return { pending: seq, timed: true }
    }
    this.buf = ''
    if (exact) return { layer: 'nvim', keys: label(seq).replace('Ctrl-w', 'Ctrl-w '), action: exact, note: k === 'Esc' ? 'tmux 的 escape-time 10 让 Esc 几乎没有延迟' : undefined }
    return { layer: 'nvim', keys: label(seq), action: '没有自定义映射，按 nvim 默认行为处理' }
  }

  /** timeoutlen 到了：有完全匹配的短序列就执行它，否则丢弃 */
  flush(): Result | null {
    const seq = this.buf
    this.buf = ''
    if (!seq) return null
    const exact = NVIM[seq]
    return {
      layer: 'nvim',
      keys: label(seq),
      action: exact ?? '没有自定义映射，按 nvim 默认行为处理',
      note: `等了 ${TIMEOUT_MS}ms（timeoutlen）没等到下一个键，才按「${label(seq)}」执行`,
    }
  }

  reset() {
    this.prefix = false
    this.buf = ''
  }
}

/** 预设按键序列：触屏和懒得按键时点一下就能看路线 */
export const PRESETS: { label: string; keys: string[] }[] = [
  { label: 'Ctrl-a \\', keys: ['C-a', '\\'] },
  { label: 'Ctrl-a h', keys: ['C-a', 'h'] },
  { label: 'Ctrl-w l', keys: ['C-w', 'l'] },
  { label: 'Space f f', keys: ['␣', 'f', 'f'] },
  { label: 'Space f（等一下）', keys: ['␣', 'f'] },
  { label: 'g d', keys: ['g', 'd'] },
  { label: 'g r（等一下）', keys: ['g', 'r'] },
  { label: 'Esc', keys: ['Esc'] },
  { label: 'Ctrl-a Ctrl-a', keys: ['C-a', 'C-a'] },
]
