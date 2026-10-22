/**
 * 右下角 3D 小猫（three.js，低多边形，全部用基础几何体搭出来，不依赖模型文件）
 * - 待机：呼吸、眨眼、甩尾巴，头和眼睛跟随鼠标
 * - 点击：跳一下并冒爱心；随机冒说话气泡
 * - 可收起，状态记在 localStorage；打印时隐藏；prefers-reduced-motion 下只渲染静止画面
 * three.js 走 CDN，页面 load 之后才加载，失败时整个宠物不出现，不影响简历本身
 */
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js'
const STORAGE_KEY = 'joy-pet-hidden'
const LINES = [
  '你好呀，我是 Joy 的猫 🐾',
  '右上角可以切换亮色 / 暗色',
  '技术笔记在 Notes 里 ↗',
  '想要 PDF？直接 ⌘P 打印就好',
  '在找 AI 应用前端？就是他了',
  '喵～',
  '摸摸头会开心',
]

const css = `
.joy-pet{position:fixed;right:18px;bottom:14px;z-index:20;width:150px;height:150px;user-select:none;-webkit-user-select:none}
.joy-pet canvas{display:block;width:100%!important;height:100%!important;cursor:pointer;outline:none}
.joy-pet canvas:focus-visible{outline:2px solid #00b8b8;outline-offset:-4px;border-radius:50%}
.joy-pet-bubble{position:absolute;right:100%;bottom:96px;margin-right:-34px;max-width:200px;width:max-content;padding:8px 12px;border-radius:12px 12px 2px 12px;font:500 12px/1.45 "Geist","PingFang SC",sans-serif;color:var(--strong,#f3f5f9);background:color-mix(in srgb,var(--bg,#07090f) 82%,transparent);border:1px solid var(--line-hi,rgba(255,255,255,.14));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 10px 30px -10px rgba(0,0,0,.5);opacity:0;transform:translateY(6px) scale(.96);transform-origin:right bottom;transition:opacity .25s ease,transform .3s cubic-bezier(.22,1,.36,1);pointer-events:none}
.joy-pet-bubble.on{opacity:1;transform:none}
.joy-pet-close,.joy-pet-open{position:fixed;z-index:21;display:grid;place-items:center;border-radius:999px;border:1px solid var(--line-hi,rgba(255,255,255,.14));background:color-mix(in srgb,var(--bg,#07090f) 80%,transparent);color:var(--muted,#7d8596);cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:color .2s,border-color .2s,opacity .2s}
.joy-pet-close{right:20px;bottom:150px;width:22px;height:22px;font:600 12px/1 sans-serif;opacity:0}
.joy-pet:hover~.joy-pet-close,.joy-pet-close:hover,.joy-pet-close:focus-visible{opacity:1}
.joy-pet-open{right:18px;bottom:18px;height:32px;padding:0 12px;font:500 12px/1 "Geist Mono",monospace;gap:6px}
.joy-pet-close:hover,.joy-pet-open:hover{color:var(--brand-2,#5eead4);border-color:var(--brand,#00b8b8)}
.joy-heart{position:fixed;z-index:22;pointer-events:none;font-size:16px;color:#ff6b9a;animation:joy-heart 1s cubic-bezier(.22,1,.36,1) forwards}
@keyframes joy-heart{from{opacity:1;transform:translate(0,0) scale(.6)}to{opacity:0;transform:translate(var(--dx),-70px) scale(1.2)}}
/* 上面给按钮写了 display:grid，会盖掉 [hidden] 的默认隐藏 */
.joy-pet[hidden],.joy-pet-close[hidden],.joy-pet-open[hidden]{display:none!important}
@media (hover:none){.joy-pet-close{opacity:1}}
@media (max-width:820px){.joy-pet{width:110px;height:110px;right:8px;bottom:8px}.joy-pet-close{right:10px;bottom:110px}.joy-pet-bubble{bottom:72px;max-width:170px}}
@media print{.joy-pet,.joy-pet-close,.joy-pet-open,.joy-heart{display:none!important}}
`

function el(tag, cls, attrs = {}) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v))
  return e
}

/** 用基础几何体搭一只坐着的低多边形小猫，返回需要做动画的部件 */
function buildCat(THREE) {
  const toon = (color) => new THREE.MeshToonMaterial({ color })
  const fur = toon(0xf4f6fa)
  const accent = toon(0x2fc6c0)
  const dark = new THREE.MeshBasicMaterial({ color: 0x0b0f17 })
  const pink = toon(0xff9bb5)
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const cat = new THREE.Group()

  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), fur)
  body.scale.set(1, 0.95, 0.85)
  body.position.y = -0.35
  cat.add(body)
  // 胸前一块青色围兜
  const bib = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), accent)
  bib.scale.set(1, 1.1, 0.5)
  bib.position.set(0, -0.2, 0.42)
  cat.add(bib)

  ;[-0.28, 0.28].forEach((x) => {
    const paw = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), fur)
    paw.scale.set(1, 0.7, 1.3)
    paw.position.set(x, -0.88, 0.32)
    cat.add(paw)
  })

  const head = new THREE.Group()
  head.position.y = 0.42
  cat.add(head)
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), fur)
  skull.scale.set(1.12, 0.92, 0.95)
  head.add(skull)
  ;[-1, 1].forEach((s) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 4), fur)
    ear.position.set(0.32 * s, 0.48, -0.02)
    ear.rotation.set(0, Math.PI / 4, -0.38 * s)
    head.add(ear)
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 4), pink)
    inner.position.set(0.31 * s, 0.45, 0.06)
    inner.rotation.set(0.15, Math.PI / 4, -0.38 * s)
    head.add(inner)
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), pink)
    cheek.scale.set(1.4, 0.7, 0.5)
    cheek.position.set(0.36 * s, -0.12, 0.45)
    head.add(cheek)
  })

  const eyes = []
  ;[-0.2, 0.2].forEach((x) => {
    const eye = new THREE.Group()
    eye.position.set(x, 0.04, 0.47)
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), dark)
    ball.scale.set(1, 1.15, 0.6)
    eye.add(ball)
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), white)
    glint.position.set(0.035, 0.05, 0.06)
    eye.add(glint)
    head.add(eye)
    eyes.push(eye)
  })
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.05, 3), pink)
  nose.rotation.set(Math.PI, 0, 0)
  nose.position.set(0, -0.1, 0.52)
  head.add(nose)

  // 尾巴：一串小球，按相位摆动
  const tail = new THREE.Group()
  tail.position.set(0.45, -0.75, -0.3)
  cat.add(tail)
  const segs = []
  let parent = tail
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.Group()
    seg.position.y = i === 0 ? 0 : 0.13
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085 - i * 0.004, 1), i > 4 ? accent : fur)
    seg.add(ball)
    parent.add(seg)
    segs.push(seg)
    parent = seg
  }
  tail.rotation.z = -0.9

  return { cat, body, head, eyes, segs }
}

async function start() {
  const style = el('style')
  style.textContent = css
  document.head.append(style)

  const wrap = el('div', 'joy-pet')
  const bubble = el('div', 'joy-pet-bubble', { role: 'status', 'aria-live': 'polite' })
  const close = el('button', 'joy-pet-close', { type: 'button', 'aria-label': '收起小猫', title: '收起小猫' })
  close.textContent = '×'
  const open = el('button', 'joy-pet-open', { type: 'button', 'aria-label': '叫小猫出来', title: '叫小猫出来' })
  open.textContent = '🐾 猫'

  let THREE
  try {
    THREE = await import(THREE_URL)
  } catch (err) {
    console.warn('[pet] three.js 加载失败，跳过宠物', err)
    return
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1))
  const canvas = renderer.domElement
  canvas.setAttribute('tabindex', '0')
  canvas.setAttribute('role', 'button')
  canvas.setAttribute('aria-label', '小猫，点一下摸摸它')
  wrap.append(bubble, canvas)
  document.body.append(wrap, close, open)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
  camera.position.set(0, 0.15, 5.2)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.6))
  const key = new THREE.DirectionalLight(0xffffff, 1.6)
  key.position.set(2, 3, 4)
  scene.add(key)

  const { cat, body, head, eyes, segs } = buildCat(THREE)
  scene.add(cat)
  // 脚下一圈柔和的青色光斑
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.8, 32),
    new THREE.MeshBasicMaterial({ color: 0x00b8b8, transparent: true, opacity: 0.18, depthWrite: false }),
  )
  glow.rotation.x = -Math.PI / 2
  glow.position.y = -1
  scene.add(glow)

  const resize = () => {
    const r = wrap.getBoundingClientRect()
    renderer.setSize(r.width, r.height, false)
    camera.aspect = r.width / r.height
    camera.updateProjectionMatrix()
  }
  new ResizeObserver(resize).observe(wrap)
  resize()

  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const mouse = { x: 0, y: 0 }
  const look = { x: 0, y: 0 }
  let jumpT = -1
  let nextBlink = 2
  let blinkT = -1
  let running = false
  let raf = 0
  const clock = new THREE.Clock()

  addEventListener('pointermove', (e) => {
    // 以宠物所在位置为原点，算鼠标相对方向，用来转头和移动眼珠
    const r = wrap.getBoundingClientRect()
    mouse.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth * 0.5)))
    mouse.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (innerHeight * 0.5)))
    if (!running) render()
  }, { passive: true })

  function pose(t, dt) {
    look.x += (mouse.x - look.x) * Math.min(1, dt * 6)
    look.y += (mouse.y - look.y) * Math.min(1, dt * 6)
    head.rotation.y = look.x * 0.6
    head.rotation.x = look.y * 0.35
    eyes.forEach((e) => { e.position.x = Math.sign(e.position.x) * 0.2 + look.x * 0.04; e.position.y = 0.04 - look.y * 0.03 })

    const breath = reduced.matches ? 0 : Math.sin(t * 2.2) * 0.02
    body.scale.set(1 + breath, 0.95 - breath, 0.85 + breath)
    head.position.y = 0.42 + breath * 1.5
    segs.forEach((s, i) => { s.rotation.z = reduced.matches ? 0.2 : Math.sin(t * 2.4 - i * 0.55) * 0.28 + 0.12 })

    // 眨眼：每隔 2~5 秒闭一次，持续 0.15 秒
    if (!reduced.matches) {
      if (blinkT < 0 && t > nextBlink) blinkT = 0
      if (blinkT >= 0) {
        blinkT += dt
        const k = blinkT < 0.15 ? 1 - Math.sin((blinkT / 0.15) * Math.PI) * 0.92 : 1
        eyes.forEach((e) => (e.scale.y = k))
        if (blinkT >= 0.15) { blinkT = -1; nextBlink = t + 2 + Math.random() * 3 }
      }
    }

    // 跳：0.55 秒的抛物线，落地时压扁一下
    if (jumpT >= 0) {
      jumpT += dt
      const p = jumpT / 0.55
      if (p >= 1) { jumpT = -1; cat.position.y = 0; cat.scale.set(1, 1, 1) }
      else {
        cat.position.y = Math.sin(p * Math.PI) * 0.55
        const squash = p > 0.85 ? 1 - Math.sin(((p - 0.85) / 0.15) * Math.PI) * 0.12 : 1
        cat.scale.set(2 - squash, squash, 2 - squash)
      }
    }
    glow.material.opacity = 0.18 - cat.position.y * 0.15
  }

  function render() {
    const dt = Math.min(0.05, clock.getDelta())
    pose(clock.elapsedTime, dt)
    renderer.render(scene, camera)
  }
  function loop() {
    render()
    raf = running ? requestAnimationFrame(loop) : 0
  }
  function play() {
    // 减少动态效果时不跑循环，只在交互时渲染单帧（跳跃除外，跳跃本身是用户主动触发的反馈）
    running = !reduced.matches && !document.hidden && !wrap.hidden
    if (running && !raf) { clock.getDelta(); raf = requestAnimationFrame(loop) }
    if (!running) render()
  }
  document.addEventListener('visibilitychange', play)
  reduced.addEventListener?.('change', play)

  let bubbleTimer = 0
  let lastLine = -1
  function say(text) {
    if (!text) {
      let i
      do i = Math.floor(Math.random() * LINES.length)
      while (i === lastLine && LINES.length > 1)
      lastLine = i
      text = LINES[i]
    }
    bubble.textContent = text
    bubble.classList.add('on')
    clearTimeout(bubbleTimer)
    bubbleTimer = setTimeout(() => bubble.classList.remove('on'), 3800)
  }
  function hearts() {
    if (reduced.matches) return
    const r = canvas.getBoundingClientRect()
    for (let i = 0; i < 5; i++) {
      const h = el('span', 'joy-heart', { 'aria-hidden': 'true' })
      h.textContent = '♥'
      h.style.left = r.left + r.width / 2 - 8 + (Math.random() - 0.5) * 50 + 'px'
      h.style.top = r.top + r.height * 0.35 + 'px'
      h.style.setProperty('--dx', (Math.random() - 0.5) * 60 + 'px')
      h.style.animationDelay = i * 70 + 'ms'
      document.body.append(h)
      setTimeout(() => h.remove(), 1300)
    }
  }
  function poke() {
    if (jumpT < 0) jumpT = 0
    hearts()
    say(Math.random() < 0.5 ? '喵！' : '')
    if (!raf) { clock.getDelta(); raf = requestAnimationFrame(function tick() { render(); raf = jumpT >= 0 || running ? requestAnimationFrame(tick) : 0 }) }
  }
  canvas.addEventListener('click', poke)
  canvas.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke() } })

  // 随机说话：首次进场 2.5 秒后打招呼，之后每 18~35 秒一句
  let talkTimer = 0
  function scheduleTalk(delay) {
    clearTimeout(talkTimer)
    talkTimer = setTimeout(() => { if (!wrap.hidden && !document.hidden) say(); scheduleTalk(18000 + Math.random() * 17000) }, delay)
  }

  function setHidden(hidden) {
    wrap.hidden = hidden
    close.hidden = hidden
    open.hidden = !hidden
    try { localStorage.setItem(STORAGE_KEY, hidden ? '1' : '') } catch {}
    if (hidden) { clearTimeout(talkTimer); bubble.classList.remove('on') } else scheduleTalk(1200)
    play()
  }
  close.addEventListener('click', () => { setHidden(true); open.focus() })
  open.addEventListener('click', () => { setHidden(false); say('我回来啦～'); canvas.focus() })

  let stored = ''
  try { stored = localStorage.getItem(STORAGE_KEY) || '' } catch {}
  setHidden(stored === '1')
  if (stored !== '1') {
    clearTimeout(talkTimer)
    setTimeout(() => say(LINES[0]), 2500)
    scheduleTalk(2500 + 20000)
  }
}

// three.js 解析 + 首帧编译 shader 是一个 100ms 级的长任务，必须等入场动画（约 2s）播完、浏览器空闲时再加载，否则入场会卡一下
const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1))
const later = () => setTimeout(() => idle(start, { timeout: 2000 }), 2400)
if (document.readyState === 'complete') later()
else addEventListener('load', later, { once: true })
