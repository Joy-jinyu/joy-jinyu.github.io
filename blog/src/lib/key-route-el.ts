/** <key-route> 的 DOM 层：接键盘 / 预设按钮，把 Router 的结果画成路线。只用 textContent 写页面 */
import { Router, keyName, PRESETS, TIMEOUT_MS } from './key-route'

type Shown = { layer: 'tmux' | 'nvim'; keys: string; action: string; note?: string }

const HISTORY_MAX = 6
/** 路线动画每一层亮起的间隔 */
const STEP_MS = 140

export class KeyRoute extends HTMLElement {
  private router = new Router()
  private pad!: HTMLElement
  private timer = 0
  private steps: number[] = []
  private replaying = false
  private replayTimers: number[] = []

  connectedCallback() {
    this.pad = this.querySelector('.kr-pad')!
    this.pad.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' || e.metaKey) return
      const k = keyName(e)
      if (!k) return
      e.preventDefault()
      // 预设回放期间不接真实按键，否则两串键混进同一个路由状态
      if (!this.replaying) this.press(k)
    })
    this.pad.addEventListener('blur', () => {
      clearTimeout(this.timer)
      this.router.reset()
      this.showWait('')
    })
    // Windows / Linux 的浏览器会抢走 Ctrl-W（关标签页），页面拦不住，提示改用预设按钮
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) this.querySelector<HTMLElement>('.kr-warn')!.hidden = false
    this.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) =>
      b.addEventListener('click', () => this.replay(PRESETS[+b.dataset.preset!].keys)),
    )
  }

  disconnectedCallback() {
    clearTimeout(this.timer)
    this.steps.forEach(clearTimeout)
    this.replayTimers.forEach(clearTimeout)
  }

  private press(k: string) {
    clearTimeout(this.timer)
    const r = this.router.feed(k)
    if ('pending' in r) {
      this.showWait(r.pending, r.timed, r.note)
      if (!r.timed) return
      this.timer = window.setTimeout(() => {
        const done = this.router.flush()
        this.showWait('')
        if (done) this.show(done)
      }, TIMEOUT_MS)
      return
    }
    this.showWait('')
    this.show(r)
  }

  /** 预设：按顺序把键喂进去，键与键之间留 120ms，最后一个键之后的等待照样走 timeoutlen */
  private replay(keys: string[]) {
    if (this.replaying) return
    this.replaying = true
    clearTimeout(this.timer)
    this.router.reset()
    this.replayTimers = keys.map((k, i) =>
      window.setTimeout(() => {
        this.press(k)
        if (i !== keys.length - 1) return
        this.replaying = false
        // 窄屏上结果在按钮下方，可能在屏幕外：只在看不见时滚到可见，滚动方式跟随页面的 scroll-behavior
        this.querySelector('.kr-result')!.scrollIntoView({ block: 'nearest' })
      }, i * 120),
    )
  }

  private showWait(seq: string, timed = true, note = '') {
    const idle = this.querySelector<HTMLElement>('.kr-idle')!
    const wait = this.querySelector<HTMLElement>('.kr-wait')!
    idle.hidden = !!seq
    wait.hidden = !seq
    if (!seq) return
    this.querySelector('.kr-seq')!.textContent = seq.replace('␣', 'Space ').replace(/^C-/, 'Ctrl-')
    this.querySelector('.kr-wait-note')!.textContent = timed ? `最多等 ${TIMEOUT_MS}ms` : note
    // 重新挂一次进度条，让 300ms 的倒计时动画从头播；不限时的等待不显示进度条
    const bar = this.querySelector<HTMLElement>('.kr-bar')!
    const fresh = bar.cloneNode() as HTMLElement
    fresh.hidden = !timed
    bar.replaceWith(fresh)
  }

  private show(r: Shown) {
    this.querySelector('.kr-keys')!.textContent = r.keys
    this.querySelector('.kr-action')!.textContent = `${r.layer === 'tmux' ? 'tmux' : 'nvim'}：${r.action}`
    this.querySelector('.kr-note')!.textContent = r.note ?? ''
    this.lightRoute(r.layer)
    const li = document.createElement('li')
    const b = document.createElement('b')
    b.textContent = r.layer
    li.append(b, document.createTextNode(` ${r.keys}`))
    const list = this.querySelector('.kr-history')!
    list.prepend(li)
    while (list.children.length > HISTORY_MAX) list.lastElementChild!.remove()
  }

  /** 终端总是经过；tmux 处理就停在 tmux、nvim 变灰；否则 tmux 经过、停在 nvim */
  private lightRoute(stopAt: 'tmux' | 'nvim') {
    this.steps.forEach(clearTimeout)
    this.steps = []
    const nodes = ['term', 'tmux', 'nvim'] as const
    const els = nodes.map((n) => this.querySelector<HTMLElement>(`[data-node="${n}"]`)!)
    els.forEach((el) => el.classList.remove('pass', 'stop', 'skip'))
    const stopIdx = nodes.indexOf(stopAt)
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    els.forEach((el, i) => {
      const cls = i < stopIdx ? 'pass' : i === stopIdx ? 'stop' : 'skip'
      if (reduce) el.classList.add(cls)
      else this.steps.push(window.setTimeout(() => el.classList.add(cls), i * STEP_MS))
    })
  }
}
