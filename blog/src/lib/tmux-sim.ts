/**
 * <tmux-playground> 的行为层：状态机 + 渲染。结构和样式在 components/TmuxPlayground.astro。
 * 用户输入只经 textContent / value 写进页面，不拼 HTML
 */
import { type Node, paneIds, splitPane, removePane, resizePane, neighbor } from './tmux-layout'

type Dir = 'L' | 'R' | 'U' | 'D'
type Win = { name: string; root: Node; active: number; last: number | null; zoom: boolean }
type Pane = { lines: { text: string; out?: boolean }[]; input: string }
type Mode =
  | { kind: 'normal' }
  | { kind: 'confirm'; text: string; run: () => void }
  | { kind: 'rename' }
  | { kind: 'help' }
  | { kind: 'numbers' }
  | { kind: 'detached' }
  | { kind: 'exited' }

const SESSION = 'demo'
/** 对应配置里的 repeat-time 默认值：带 -r 的键在这段时间内可以不按前缀连按 */
const REPEAT_MS = 500
const MSG_MS = 1800
/** 分屏后单个 pane 的最小像素，再小就提示 no space for new pane（真实 tmux 的报错文案） */
const MIN_W = 90
const MIN_H = 48

const HELP: [string, string][] = [
  ['前缀 \\  或  %', '左右分屏'],
  ['前缀 -  或  "', '上下分屏'],
  ['前缀 h j k l / 方向键', '移到左 / 下 / 上 / 右的 pane'],
  ['前缀 H J K L', '调整大小，可连按'],
  ['前缀 z', '放大 / 还原当前 pane'],
  ['前缀 ;', '回到上一个 pane'],
  ['前缀 q', '显示 pane 编号'],
  ['前缀 x', '关闭当前 pane'],
  ['前缀 c', '新建窗口'],
  ['前缀 n / p / 1-9', '下一个 / 上一个 / 指定窗口'],
  ['前缀 ,', '重命名窗口'],
  ['前缀 &', '关闭当前窗口'],
  ['前缀 d', '离开会话'],
  ['前缀 r', '重新加载配置'],
]

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text) e.textContent = text
  return e
}

export class TmuxPlayground extends HTMLElement {
  private term!: HTMLElement
  private screen!: HTMLElement
  private status!: HTMLElement
  private log!: HTMLElement
  private wins: Win[] = []
  private cur = 0
  private nextId = 1
  private panes = new Map<number, Pane>()
  private prefixOn = false
  private repeatUntil = 0
  private mode: Mode = { kind: 'normal' }
  private msg = ''
  private msgTimer = 0
  private done = new Set<string>()
  private zoomedOnce = false
  private newWinOnce = false
  private clock = 0

  connectedCallback() {
    this.term = this.querySelector('.tp-term')!
    this.screen = this.querySelector('.tp-screen')!
    this.status = this.querySelector('.tp-status')!
    this.log = this.querySelector('.tp-log code')!
    this.term.addEventListener('keydown', (e) => this.onKey(e))
    // 点状态栏输入框、弹层按钮时不抢焦点，否则改名输入框一点就失焦
    this.term.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('input, button')) return
      queueMicrotask(() => this.term.focus())
    })
    // 前缀按下后焦点离开模拟器（Tab、点页面别处），前缀作废，避免回来后第一个键被当成命令
    this.term.addEventListener('focusout', (e) => {
      if (this.prefixOn && !this.term.contains(e.relatedTarget as globalThis.Node | null)) {
        this.prefixOn = false
        this.renderStatus()
      }
    })
    this.querySelectorAll<HTMLButtonElement>('.tp-pad button').forEach((b) =>
      b.addEventListener('click', () => {
        this.term.classList.add('used')
        this.runPrefixed(b.dataset.key!)
      }),
    )
    this.querySelector('.tp-reset')!.addEventListener('click', () => this.reset(true))
    this.reset(false)
    this.clock = window.setInterval(() => this.mode.kind === 'normal' && this.renderStatus(), 30_000)
  }

  disconnectedCallback() {
    clearInterval(this.clock)
    clearTimeout(this.msgTimer)
  }

  /* ---------- 状态 ---------- */

  private get win() {
    return this.wins[this.cur]
  }

  private newPane(): number {
    const id = this.nextId++
    this.panes.set(id, { lines: [], input: '' })
    return id
  }

  private reset(clearTasks: boolean) {
    this.panes.clear()
    this.nextId = 1
    const id = this.newPane()
    this.wins = [{ name: 'zsh', root: { kind: 'pane', id }, active: id, last: null, zoom: false }]
    this.cur = 0
    this.prefixOn = false
    this.mode = { kind: 'normal' }
    if (clearTasks) {
      this.done.clear()
      this.zoomedOnce = this.newWinOnce = false
      this.renderTasks()
    }
    this.render()
  }

  private flash(text: string) {
    this.msg = text
    clearTimeout(this.msgTimer)
    this.msgTimer = window.setTimeout(() => {
      this.msg = ''
      // 改名 / 确认等模式下状态栏归那个模式管，消息到期不能去重绘它
      if (this.mode.kind === 'normal') this.renderStatus()
    }, MSG_MS)
  }

  private cmd(text: string) {
    this.log.textContent = text
    const box = this.log.parentElement!
    box.classList.remove('flash')
    void box.offsetWidth
    box.classList.add('flash')
  }

  private task(id: string) {
    if (this.done.has(id)) return
    this.done.add(id)
    this.renderTasks()
  }

  /* ---------- 键盘 ---------- */

  private onKey(e: KeyboardEvent) {
    if (e.key === 'Tab' || e.metaKey) return
    this.term.classList.add('used')
    const m = this.mode
    if (m.kind === 'rename') return
    if (m.kind === 'detached' || m.kind === 'exited') {
      if (e.key === 'Enter') this.reattach()
      e.preventDefault()
      return
    }
    if (m.kind === 'help' || m.kind === 'numbers') {
      e.preventDefault()
      this.mode = { kind: 'normal' }
      if (m.kind === 'numbers' && /^[1-9]$/.test(e.key)) this.selectPaneIndex(+e.key)
      this.render()
      return
    }
    if (m.kind === 'confirm') {
      e.preventDefault()
      this.mode = { kind: 'normal' }
      if (e.key === 'y') m.run()
      this.render()
      return
    }
    if (e.ctrlKey && (e.key === 'a' || e.key === 'b')) {
      e.preventDefault()
      this.prefixOn = true
      this.renderStatus()
      return
    }
    if (this.prefixOn) {
      e.preventDefault()
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt') return
      this.prefixOn = false
      this.runPrefixed(e.key)
      return
    }
    if ('HJKL'.includes(e.key) && e.key.length === 1 && performance.now() < this.repeatUntil) {
      e.preventDefault()
      this.runPrefixed(e.key)
      return
    }
    this.typeKey(e)
  }

  /** 没按前缀时，按键交给当前 pane 里的「shell」 */
  private typeKey(e: KeyboardEvent) {
    const p = this.panes.get(this.win.active)!
    if (e.key === 'Enter') {
      const line = p.input.trim()
      p.lines.push({ text: `❯ ${p.input}` })
      if (line) p.lines.push({ text: line === 'exit' ? '' : '（演示环境，命令不会真的执行）', out: true })
      p.input = ''
      p.lines = p.lines.slice(-30)
      e.preventDefault()
      if (line === 'exit') return this.killPane()
    } else if (e.key === 'Backspace') {
      p.input = p.input.slice(0, -1)
      e.preventDefault()
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
      p.input = (p.input + e.key).slice(0, 80)
      e.preventDefault()
    } else return
    this.renderScreen()
  }

  private runPrefixed(key: string) {
    if (this.mode.kind === 'detached' || this.mode.kind === 'exited') return this.reattach()
    // 按钮面板不走键盘前缀，也要清掉之前按了一半的前缀
    this.prefixOn = false
    this.mode = { kind: 'normal' }
    this.hitButton(key)
    // rename 自己渲染并聚焦输入框，不能再走末尾的 render()，否则输入框被重建、焦点丢到 body
    if (key === ',') return this.rename()
    const dirs: Record<string, Dir> = { h: 'L', j: 'D', k: 'U', l: 'R', ArrowLeft: 'L', ArrowDown: 'D', ArrowUp: 'U', ArrowRight: 'R' }
    const sizes: Record<string, Dir> = { H: 'L', J: 'D', K: 'U', L: 'R' }
    if (key === '\\' || key === '%') this.split('row')
    else if (key === '-' || key === '"') this.split('col')
    else if (dirs[key]) this.select(dirs[key])
    else if (sizes[key]) this.resize(sizes[key])
    else if (key === 'z') this.zoom()
    else if (key === ';') this.lastPane()
    else if (key === 'q') this.showNumbers()
    else if (key === 'x') this.confirm(`kill-pane ${this.paneIndex()}? (y/n)`, () => this.killPane())
    else if (key === 'c') this.newWindow()
    else if (key === 'n' || key === 'p') this.selectIndex((this.cur + (key === 'n' ? 1 : -1) + this.wins.length) % this.wins.length)
    else if (/^[1-9]$/.test(key)) this.selectIndex(+key - 1)
    else if (key === '&') this.confirm(`kill-window ${this.win.name}? (y/n)`, () => this.killWindow())
    else if (key === 'd') this.detach()
    else if (key === '?') this.help()
    else if (key === 'r') {
      this.cmd('source-file ~/.tmux.conf')
      this.flash('tmux config reloaded')
    } else this.flash(`前缀 ${key} 在演示里没有绑定，按 前缀 ? 看可用按键`)
    this.render()
  }

  private hitButton(key: string) {
    const b = this.querySelector<HTMLElement>(`.tp-pad button[data-key="${CSS.escape(key)}"]`)
    if (!b) return
    b.classList.add('hit')
    setTimeout(() => b.classList.remove('hit'), 160)
  }

  /* ---------- 命令 ---------- */

  private paneIndex(id = this.win.active) {
    return paneIds(this.win.root).indexOf(id) + 1
  }

  private split(dir: 'row' | 'col') {
    // 放大状态下量到的是整窗大小，先还原再判断还放不放得下
    if (this.win.zoom) {
      this.win.zoom = false
      this.renderScreen()
    }
    const el = this.screen.querySelector<HTMLElement>(`[data-pane="${this.win.active}"]`)
    const r = el?.getBoundingClientRect()
    if (r && (dir === 'row' ? r.width / 2 < MIN_W : r.height / 2 < MIN_H)) return this.flash('no space for new pane')
    const w = this.win
    const id = this.newPane()
    w.root = splitPane(w.root, w.active, dir, id)
    w.last = w.active
    w.active = id
    w.zoom = false
    this.cmd(`split-window ${dir === 'row' ? '-h' : '-v'} -c "#{pane_current_path}"`)
    this.task(dir === 'row' ? 'split-h' : 'split-v')
  }

  private select(dir: Dir) {
    const w = this.win
    if (w.zoom) {
      w.zoom = false
      this.renderScreen()
    }
    const rects = new Map<number, DOMRect>()
    this.screen.querySelectorAll<HTMLElement>('[data-pane]').forEach((el) => rects.set(+el.dataset.pane!, el.getBoundingClientRect()))
    const to = neighbor(rects, w.active, dir)
    this.cmd(`select-pane -${dir}`)
    if (to === null) return
    w.last = w.active
    w.active = to
    this.task('select')
  }

  private resize(dir: Dir) {
    this.win.root = resizePane(this.win.root, this.win.active, dir)
    this.repeatUntil = performance.now() + REPEAT_MS
    this.cmd(`resize-pane -${dir} 5`)
  }

  private zoom() {
    const w = this.win
    if (paneIds(w.root).length < 2) return this.flash('只有一个 pane，先分屏再放大')
    w.zoom = !w.zoom
    this.cmd('resize-pane -Z')
    if (w.zoom) this.zoomedOnce = true
    else if (this.zoomedOnce) this.task('unzoom')
  }

  private lastPane() {
    const w = this.win
    if (w.last === null || !paneIds(w.root).includes(w.last)) return this.flash('no last pane')
    ;[w.active, w.last] = [w.last, w.active]
    w.zoom = false
    this.cmd('last-pane')
  }

  private showNumbers() {
    this.mode = { kind: 'numbers' }
    this.cmd('display-panes')
    setTimeout(() => {
      if (this.mode.kind === 'numbers') {
        this.mode = { kind: 'normal' }
        this.render()
      }
    }, 1500)
  }

  private confirm(text: string, run: () => void) {
    this.mode = { kind: 'confirm', text, run }
  }

  private killPane() {
    const w = this.win
    const root = removePane(w.root, w.active)
    this.panes.delete(w.active)
    this.cmd('kill-pane')
    if (!root) return this.killWindow()
    w.root = root
    const ids = paneIds(root)
    w.active = w.last !== null && ids.includes(w.last) ? w.last : ids[0]
    w.last = null
    w.zoom = false
    this.render()
  }

  private killWindow() {
    paneIds(this.win.root).forEach((id) => this.panes.delete(id))
    this.wins.splice(this.cur, 1)
    this.cmd('kill-window')
    if (this.wins.length === 0) this.mode = { kind: 'exited' }
    else this.cur = Math.min(this.cur, this.wins.length - 1)
    this.render()
  }

  private newWindow() {
    const id = this.newPane()
    this.wins.push({ name: 'zsh', root: { kind: 'pane', id }, active: id, last: null, zoom: false })
    this.cur = this.wins.length - 1
    this.newWinOnce = true
    this.cmd('new-window -c "#{pane_current_path}"')
  }

  /** display-panes 期间按数字：跳到对应编号的 pane（编号从 1 开始） */
  private selectPaneIndex(n: number) {
    const id = paneIds(this.win.root)[n - 1]
    if (id === undefined) return this.flash(`can't find pane: ${n}`)
    this.focusPane(id)
  }

  /** 切到指定 pane：编号跳转和鼠标点选共用 */
  private focusPane(id: number) {
    const w = this.win
    if (w.active === id) return
    w.last = w.active
    w.active = id
    w.zoom = false
    this.cmd(`select-pane -t ${this.paneIndex(id)}`)
    this.task('select')
  }

  private selectIndex(i: number) {
    if (!this.wins[i]) return this.flash(`can't find window: ${i + 1}`)
    this.cur = i
    this.cmd(`select-window -t :${i + 1}`)
    if (this.newWinOnce && i === 0) this.task('back')
  }

  private rename() {
    this.mode = { kind: 'rename' }
    this.cmd(`rename-window`)
    this.render()
    const input = this.status.querySelector('input')!
    input.focus()
    input.select()
    const finish = (commit: boolean, refocus: boolean) => {
      if (this.mode.kind !== 'rename') return
      const name = input.value.trim().slice(0, 16)
      if (commit && name) {
        this.win.name = name
        this.cmd(`rename-window "${name}"`)
      }
      this.mode = { kind: 'normal' }
      this.render()
      if (refocus) this.term.focus()
    }
    input.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key !== 'Enter' && e.key !== 'Escape') return
      e.preventDefault()
      finish(e.key === 'Enter', true)
    })
    // Tab 走或点到页面别处：当作取消，焦点留在用户去的地方
    input.addEventListener('blur', () => finish(false, false))
  }

  private detach() {
    this.mode = { kind: 'detached' }
    this.cmd('detach-client')
  }

  private reattach() {
    if (this.mode.kind === 'exited') {
      this.reset(false)
      this.cmd(`new-session -A -s ${SESSION}`)
      this.term.focus()
      return
    }
    this.mode = { kind: 'normal' }
    this.cmd(`attach -t ${SESSION}`)
    this.task('attach')
    this.render()
    // 从「回到会话」按钮触发时按钮已被移除，焦点要接回模拟器
    this.term.focus()
  }

  private help() {
    this.mode = { kind: 'help' }
    this.cmd('list-keys')
  }

  /* ---------- 渲染 ---------- */

  private render() {
    this.renderScreen()
    this.renderStatus()
  }

  private renderScreen() {
    const m = this.mode
    this.screen.replaceChildren()
    if (m.kind === 'detached' || m.kind === 'exited') return this.renderOutside(m.kind)
    const w = this.win
    const root: Node = w.zoom ? { kind: 'pane', id: w.active } : w.root
    this.screen.append(this.buildNode(root))
    if (m.kind === 'help') this.screen.append(this.buildHelp())
  }

  private buildNode(node: Node): HTMLElement {
    if (node.kind === 'pane') return this.buildPane(node.id)
    const box = h('div', `tp-split ${node.dir}`)
    const a = this.buildNode(node.a)
    const b = this.buildNode(node.b)
    a.style.flex = `${node.ratio} 1 0`
    b.style.flex = `${1 - node.ratio} 1 0`
    box.append(a, b)
    return box
  }

  private buildPane(id: number): HTMLElement {
    const p = this.panes.get(id)!
    const on = id === this.win.active
    const el = h('div', `tp-pane${on ? ' on' : ''}`)
    el.dataset.pane = String(id)
    el.append(h('span', 'no', String(this.paneIndex(id))))
    p.lines.forEach((l) => l.text && el.append(h('div', `tp-line${l.out ? ' out' : ''}`, l.text)))
    const line = h('div', 'tp-line')
    line.append(h('span', 'tp-ps', '~/demo ❯ '), document.createTextNode(p.input), h('span', 'tp-cur'))
    el.append(line)
    if (this.mode.kind === 'numbers') el.append(h('div', 'tp-bignum', String(this.paneIndex(id))))
    el.addEventListener('click', () => {
      // 确认、改名等模式下点 pane 不切换，否则 kill-pane 的目标会被悄悄换掉
      if (this.mode.kind !== 'normal' || this.win.active === id) return
      this.focusPane(id)
      this.render()
    })
    return el
  }

  private renderOutside(kind: 'detached' | 'exited') {
    const box = h('div', 'tp-full')
    box.append(h('div', 'tp-line out', kind === 'detached' ? `[detached (from session ${SESSION})]` : '[exited]'))
    const line = h('div', 'tp-line')
    line.append(h('span', 'tp-ps', '$ '), document.createTextNode(kind === 'detached' ? `tmux attach -t ${SESSION}` : `tmux new -A -s ${SESSION}`), h('span', 'tp-cur'))
    box.append(line)
    const act = h('div', 'tp-act')
    const btn = h('button', '', kind === 'detached' ? '按 Enter 回到会话' : '按 Enter 重新开始')
    btn.type = 'button'
    btn.addEventListener('click', () => this.reattach())
    act.append(btn)
    box.append(act)
    this.screen.append(box)
  }

  private buildHelp(): HTMLElement {
    const box = h('div', 'tp-help')
    const table = h('table')
    HELP.forEach(([k, v]) => {
      const tr = h('tr')
      tr.append(h('td', '', k), h('td', '', v))
      table.append(tr)
    })
    box.append(table)
    const close = h('button', '', '关闭（或按任意键）')
    close.type = 'button'
    close.addEventListener('click', () => {
      this.mode = { kind: 'normal' }
      this.render()
      this.term.focus()
    })
    box.append(close)
    return box
  }

  private renderStatus() {
    const s = this.status
    const m = this.mode
    // 改名期间输入框已经在了就不动它，重建会丢掉焦点和已输入的内容
    if (m.kind === 'rename' && s.querySelector('input')) return
    s.replaceChildren()
    if (m.kind === 'rename') {
      s.append(h('span', '', '(rename-window) '))
      const input = h('input')
      input.value = this.win.name
      input.setAttribute('aria-label', '新的窗口名，回车确认，Esc 取消')
      s.append(input)
      return
    }
    if (m.kind === 'confirm') return void s.append(h('span', 'msg', m.text))
    if (m.kind === 'detached' || m.kind === 'exited') return
    s.append(h('span', 's', `${SESSION} `))
    this.wins.forEach((w, i) => {
      const flag = i === this.cur ? (w.zoom ? '*Z' : '*') : ''
      s.append(h('span', `w${i === this.cur ? ' cur' : ''}`, `${i + 1}:${w.name}${flag}`))
    })
    const right = h('span', 'r')
    if (this.prefixOn) right.append(h('span', 'pfx', 'PREFIX'))
    if (this.msg) right.append(h('span', 'msg', this.msg))
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    right.append(h('span', 'clock-d', `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`), h('span', '', `${pad(now.getHours())}:${pad(now.getMinutes())}`))
    s.append(right)
  }

  private renderTasks() {
    const items = this.querySelectorAll<HTMLElement>('.tp-tasks li')
    items.forEach((li) => {
      const done = this.done.has(li.dataset.task!)
      li.classList.toggle('done', done)
      li.querySelector('.tp-state')!.textContent = done ? '（已完成）' : '（未完成）'
    })
    this.querySelector('.tp-count')!.textContent = `${this.done.size} / ${items.length}`
    this.querySelector('.tp-tasks')!.classList.toggle('all', this.done.size === items.length)
  }
}
