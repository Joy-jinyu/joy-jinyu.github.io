/**
 * 右下角 3D 小猫（three.js，所有形体都在运行时用代码雕出来，不依赖模型文件）
 *
 * 一只 Q 版白猫：大圆头（青色围兜、粉腮红、ω 嘴），圆滚滚的身子，四条短腿，会在右下角来回走。
 * 形体：
 * - 头、脚掌是高细分的球逐顶点“雕”出来的，焊接法线，没有棱角和接缝
 * - 身子是截面放样（像一颗横放的豆子）；四条腿和尾巴是每帧沿曲线重建的管子，关节处圆滑弯折
 * - 围兜在着色器里逐像素画，边缘柔和；腮红是柔边贴片；尾尖渐变成青色
 * 动作：
 * - 腿用两段 IK：前腿肘向后、后腿膝向前；走路是猫的侧对步（左后、左前、右后、右前），脚掌落地不打滑
 * - 状态：来回走 / 站着转头看你 / 坐下 / 揣手趴着；所有切换和转头都是弹簧，起止有缓动
 * - 尾巴每节比前一节慢半拍；呼吸、眨眼（偶尔慢眨）、抖耳朵、歪头
 * - 点击：停下、转头看你、蓄力跳一下（落地压扁再回弹），冒爱心；随机冒说话气泡
 * - 可收起，状态记在 localStorage；打印时隐藏；prefers-reduced-motion 下只渲染静止画面
 * 展示台：?pet=show 整屏渲染，&petpose=stand|walk|sit|loaf|hop 固定姿势，&petstate=open 固定睁眼（无头浏览器里动画帧很少，截图用）
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

const params = new URLSearchParams(location.search)
const SHOW = params.get('pet') === 'show'
const SHOW_POSE = SHOW ? params.get('petpose') || 'stand' : ''
const SHOW_STATE = params.get('petstate') || ''
const debug = (window.__pet = { ready: false, errors: [], frames: 0 })

const css = `
.joy-pet{position:fixed;right:10px;bottom:6px;z-index:20;width:280px;height:180px;user-select:none;-webkit-user-select:none}
.joy-pet.show{right:0;bottom:0;width:100vw;height:100vh;background:#0d1118}
.joy-pet canvas{display:block;width:100%!important;height:100%!important;cursor:pointer;outline:none}
.joy-pet canvas:focus-visible{outline:2px solid #00b8b8;outline-offset:-4px;border-radius:16px}
.joy-pet-bubble{position:absolute;right:42%;bottom:150px;max-width:200px;width:max-content;padding:8px 12px;border-radius:12px 12px 2px 12px;font:500 12px/1.45 "Geist","PingFang SC",sans-serif;color:var(--strong,#f3f5f9);background:color-mix(in srgb,var(--bg,#07090f) 82%,transparent);border:1px solid var(--line-hi,rgba(255,255,255,.14));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 10px 30px -10px rgba(0,0,0,.5);opacity:0;transform:translateY(6px) scale(.96);transform-origin:right bottom;transition:opacity .25s ease,transform .3s cubic-bezier(.22,1,.36,1);pointer-events:none}
.joy-pet-bubble.on{opacity:1;transform:none}
.joy-pet-close,.joy-pet-open{position:fixed;z-index:21;display:grid;place-items:center;border-radius:999px;border:1px solid var(--line-hi,rgba(255,255,255,.14));background:color-mix(in srgb,var(--bg,#07090f) 80%,transparent);color:var(--muted,#7d8596);cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:color .2s,border-color .2s,opacity .2s}
.joy-pet-close{right:20px;bottom:176px;width:22px;height:22px;font:600 12px/1 sans-serif;opacity:0}
.joy-pet:hover~.joy-pet-close,.joy-pet-close:hover,.joy-pet-close:focus-visible{opacity:1}
.joy-pet-open{right:18px;bottom:18px;height:32px;padding:0 12px;font:500 12px/1 "Geist Mono",monospace;gap:6px}
.joy-pet-close:hover,.joy-pet-open:hover{color:var(--brand-2,#5eead4);border-color:var(--brand,#00b8b8)}
.joy-heart{position:fixed;z-index:22;pointer-events:none;font-size:16px;color:#ff6b9a;animation:joy-heart 1s cubic-bezier(.22,1,.36,1) forwards}
@keyframes joy-heart{from{opacity:1;transform:translate(0,0) scale(.6)}to{opacity:0;transform:translate(var(--dx),-70px) scale(1.2)}}
/* 上面给按钮写了 display:grid，会盖掉 [hidden] 的默认隐藏 */
.joy-pet[hidden],.joy-pet-close[hidden],.joy-pet-open[hidden],#pet-launcher[hidden]{display:none!important}
@media (hover:none){.joy-pet-close{opacity:1}}
@media (max-width:820px){.joy-pet{width:190px;height:122px;right:4px;bottom:4px}.joy-pet-close{right:10px;bottom:122px}.joy-pet-bubble{bottom:100px;max-width:170px}}
@media print{.joy-pet,.joy-pet-close,.joy-pet-open,.joy-heart,#pet-launcher{display:none!important}}
`

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const TAU = Math.PI * 2
function el(tag, cls, attrs = {}) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v))
  return e
}
// 弹簧：zeta = 1 是临界阻尼（不过冲），小于 1 会带一点回弹；dt 大时拆成小步保证稳定
const spring = (x = 0) => ({ x, v: 0 })
function step(s, target, k, dt, zeta = 1) {
  const n = Math.max(1, Math.ceil(dt / 0.006)), h = dt / n
  for (let i = 0; i < n; i++) { s.v += (k * k * (target - s.x) - 2 * zeta * k * s.v) * h; s.x += s.v * h }
  return s.x
}
const wrapNear = (a, ref) => a + TAU * Math.round((ref - a) / TAU)

// ---------------------------------------------------------------- 尺寸表
// 单位：头的半径约 0.5。坐标：猫面朝 +X，Y 向上，Z 指向猫的左侧（镜头一侧），地面 y = 0。
// 躯干和头挂在 body 上，body 以髋关节为支点俯仰。
const DIM = {
  shoulder: [0.7, 0.0],          // 肩关节，相对髋关节（body 坐标）
  head: [0.96, 0.52],            // 头部中心，相对髋关节（body 坐标）
  headScale: 0.8,
  front: { L: [0.2, 0.19], meta: 0.08, z: 0.19, r: [0.13, 0.125, 0.11, 0.1, 0.095] },
  hind: { L: [0.22, 0.2], meta: 0.1, z: 0.2, r: [0.13, 0.13, 0.11, 0.1, 0.095] },
  tail: { len: 0.95, r0: 0.085, r1: 0.066, base: [-0.22, 0.14], seg: 14 },
  // 躯干放样截面：[x, 截面中心 y, 上下半径, 左右半径]，从臀到胸，像一颗横放的豆子
  body: [
    [-0.34, 0.1, 0, 0],
    [-0.31, 0.1, 0.17, 0.17],
    [-0.2, 0.09, 0.31, 0.3],
    [0.0, 0.08, 0.36, 0.34],
    [0.35, 0.07, 0.36, 0.35],
    [0.68, 0.09, 0.36, 0.33],
    [0.9, 0.11, 0.29, 0.28],
    [1.0, 0.12, 0.16, 0.16],
    [1.03, 0.12, 0, 0],
  ],
  stride: 0.26, duty: 0.6, lift: 0.1, speed: 0.5,
  roam: 0.5,                     // 走动范围：髋关节 x 在 ±0.5 之间
}
// 姿势：髋高、俯仰、前脚/后脚落点（相对肩/髋）、掌骨方向、腿往身体下面收的比例
const POSE = {
  stand: { hip: 0.5, pitch: 0.0, fx: -0.02, hx: 0.0, fm: [-0.15, 1], hm: [-0.3, 1], lz: 1 },
  sit: { hip: 0.3, pitch: 0.3, fx: 0.0, hx: 0.3, fm: [-0.1, 1], hm: [-1, 0.15], lz: 0.85 },
  loaf: { hip: 0.33, pitch: 0.02, fx: 0.1, hx: 0.24, fm: [-1, 0.4], hm: [-1, 0.1], lz: 0.5 },
}

const COL = { fur: [0.955, 0.962, 0.98], accent: [0.18, 0.776, 0.753], pink: [1, 0.61, 0.71], ink: 0x161a24 }
const linear = (c) => c.map((v) => v ** 2.2)

function buildCat(THREE) {
  const fur = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.72, sheen: 0.8, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xffffff) })
  const pinkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...COL.pink, THREE.SRGBColorSpace), roughness: 0.6 })
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: COL.ink, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 })
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const inkMat = new THREE.MeshBasicMaterial({ color: 0x3a3f4c })
  const FUR = linear(COL.fur)
  const paint = (g, c) => g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).map((_, i) => c[i % 3]), 3))

  // 焊接法线：位置相同的顶点（球面接缝、两极）共用一个平均法线
  function weld(g) {
    const p = g.attributes.position, n = g.attributes.normal, groups = new Map()
    for (let i = 0; i < p.count; i++) {
      const k = `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push(i)
    }
    const v = new THREE.Vector3()
    for (const ids of groups.values()) {
      if (ids.length < 2) continue
      v.set(0, 0, 0)
      for (const i of ids) v.x += n.getX(i), v.y += n.getY(i), v.z += n.getZ(i)
      v.normalize()
      for (const i of ids) n.setXYZ(i, v.x, v.y, v.z)
    }
    return g
  }
  // 雕刻：单位球 → 椭球 → 叠加“鼓包” → 可选后处理
  function sculpt(R, bumps = [], post = null, seg = [72, 54]) {
    const g = new THREE.SphereGeometry(1, seg[0], seg[1])
    g.rotateY(-Math.PI / 2) // 把球面接缝转到背后
    const p = g.attributes.position, d = new THREE.Vector3(), q = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      d.set(p.getX(i), p.getY(i), p.getZ(i))
      q.set(d.x * R[0], d.y * R[1], d.z * R[2])
      let push = 0
      for (const b of bumps) push += b.a * Math.exp(-((q.x - b.c[0]) ** 2 + (q.y - b.c[1]) ** 2 + (q.z - b.c[2]) ** 2) / (b.s * b.s))
      q.addScaledVector(d, push)
      if (post) post(q, d)
      p.setXYZ(i, q.x, q.y, q.z)
    }
    paint(g, FUR)
    g.computeVertexNormals()
    return weld(g)
  }
  // 截面放样：沿 x 轴按截面表插值出一圈圈椭圆（两端半径为 0 自动封口），法线平滑
  function loft(stations, radial = 40, perSpan = 8) {
    const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
    const at = (j) => stations[clamp(j, 0, stations.length - 1)]
    const rings = []
    for (let s = 0; s < stations.length - 1; s++) for (let k = 0; k < perSpan; k++) {
      const t = k / perSpan
      rings.push([0, 1, 2, 3].map((c) => cr(at(s - 1)[c], at(s)[c], at(s + 1)[c], at(s + 2)[c], t)))
    }
    rings.push(stations[stations.length - 1])
    const pos = [], idx = []
    for (const [x, cy, ry, rz] of rings) for (let j = 0; j < radial; j++) {
      const a = (j / radial) * TAU
      pos.push(x, cy + Math.max(ry, 0) * Math.cos(a), Math.max(rz, 0) * Math.sin(a))
    }
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + ((j + 1) % radial)
      idx.push(a, b, a + radial, b, b + radial, a + radial) // 沿 x 前进 × 沿圆周前进 = 外法线
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    const nrm = g.attributes.normal, last = (rings.length - 1) * radial
    for (let j = 0; j < radial; j++) { nrm.setXYZ(j, -1, 0, 0); nrm.setXYZ(last + j, 1, 0, 0) }
    paint(g, FUR)
    return g
  }
  // 可变形的管子：给中心点和半径，每帧重写顶点（平行移动标架），两头封成圆头
  function tube(rings, radial, ringColor) {
    const total = rings + 2
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(total * radial * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const idx = [], col = []
    for (let i = 0; i < total - 1; i++) for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + ((j + 1) % radial)
      idx.push(a, b, a + radial, b, b + radial, a + radial)
    }
    for (let i = 0; i < total; i++) { const c = linear(ringColor(clamp((i - 1) / (rings - 1)))); for (let j = 0; j < radial; j++) col.push(...c) }
    geo.setIndex(idx)
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    const mesh = new THREE.Mesh(geo, fur)
    mesh.frustumCulled = false
    const t = new THREE.Vector3(), n = new THREE.Vector3(), b = new THREE.Vector3(), h0 = new THREE.Vector3(), tip = new THREE.Vector3()
    function write(P, R) {
      h0.copy(P[0]).sub(P[1]).normalize().multiplyScalar(R[0] * 0.6).add(P[0])
      tip.copy(P[rings - 1]).sub(P[rings - 2]).normalize().multiplyScalar(R[rings - 1] * 0.8).add(P[rings - 1])
      const pt = (i) => (i === 0 ? h0 : i === total - 1 ? tip : P[i - 1])
      n.set(0, 0, 1)
      for (let i = 0; i < total; i++) {
        const p = pt(i)
        t.copy(pt(Math.min(total - 1, i + 1))).sub(pt(Math.max(0, i - 1))).normalize()
        n.addScaledVector(t, -n.dot(t))
        if (n.lengthSq() < 1e-8) n.set(0, 1, 0).addScaledVector(t, -t.y)
        n.normalize()
        b.crossVectors(t, n)
        const r = i === 0 || i === total - 1 ? 0.001 : R[i - 1]
        for (let j = 0; j < radial; j++) {
          const a = (j / radial) * TAU, cs = Math.cos(a) * r, sn = Math.sin(a) * r, k = (i * radial + j) * 3
          pos[k] = p.x + n.x * cs + b.x * sn
          pos[k + 1] = p.y + n.y * cs + b.y * sn
          pos[k + 2] = p.z + n.z * cs + b.z * sn
        }
      }
      geo.attributes.position.needsUpdate = true
      geo.computeVertexNormals()
    }
    return { mesh, write }
  }

  const root = new THREE.Group() // 位置 = 髋关节在地面上的投影；rotation.y = 朝向
  const rig = new THREE.Group()  // 跳跃时的压扁 / 拉长，以脚底为支点
  root.add(rig)
  const body = new THREE.Group() // 原点在髋关节，rotation.z = 俯仰
  rig.add(body)

  // 身子：放样出来的“豆子”；围兜在着色器里逐像素画在胸前
  const bodyMat = fur.clone()
  bodyMat.onBeforeCompile = (sh) => {
    sh.uniforms.uBib = { value: new THREE.Color().setRGB(...COL.accent, THREE.SRGBColorSpace) }
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;')
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;\nuniform vec3 uBib;').replace('#include <color_fragment>', `#include <color_fragment>
      float e = pow(vObj.z / 0.2, 2.0) + pow((vObj.y + 0.02) / 0.24, 2.0);
      float bib = smoothstep(1.0, 0.82, e) * smoothstep(0.8, 0.9, vObj.x);
      diffuseColor.rgb = mix(diffuseColor.rgb, uBib, bib);`)
  }
  bodyMat.customProgramCacheKey = () => 'joy-pet-bib'
  const torso = new THREE.Mesh(loft(DIM.body), bodyMat)
  body.add(torso)
  // 后腿根两侧各一块圆鼓鼓的“大腿肉”，把大腿穿出身体的地方包住
  const haunchGeo = sculpt([0.2, 0.21, 0.13], [], null, [40, 30])
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(haunchGeo, fur)
    h.position.set(0.02, -0.06, s * 0.2)
    h.rotation.z = 0.25
    torso.add(h)
  }

  // 头（沿用坐着那版的头）：头的正面朝 +Z，挂上去时转 90° 让它朝 +X
  const headBase = new THREE.Group()
  headBase.position.set(DIM.head[0], DIM.head[1], 0)
  body.add(headBase)
  const head = new THREE.Group()
  head.rotation.order = 'YXZ'
  head.scale.setScalar(DIM.headScale)
  headBase.add(head)
  const skull = new THREE.Mesh(sculpt([0.6, 0.5, 0.52], [
    { c: [0.34, -0.16, 0.3], s: 0.2, a: 0.05 },
    { c: [-0.34, -0.16, 0.3], s: 0.2, a: 0.05 },
    { c: [0, -0.13, 0.48], s: 0.13, a: 0.03 },
  ], (q, d) => { if (d.y > 0.4) q.y -= (d.y - 0.4) * 0.05 }), fur)
  head.add(skull)
  skull.updateMatrixWorld()
  const ray = new THREE.Raycaster()
  function onFace(x, y) {
    ray.set(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1))
    const hit = ray.intersectObject(skull)[0]
    return hit ? { p: hit.point, n: hit.face.normal.clone() } : { p: new THREE.Vector3(x, y, 0.5), n: new THREE.Vector3(0, 0, 1) }
  }
  const ears = []
  const earProfile = (r, h) => [[r, 0], [r * 0.86, h * 0.33], [r * 0.56, h * 0.66], [r * 0.24, h * 0.88], [r * 0.07, h * 0.98], [0, h]].map(([a, b]) => new THREE.Vector2(a, b))
  ;[-1, 1].forEach((s) => {
    const ear = new THREE.Group()
    ear.position.set(0.31 * s, 0.33, -0.02)
    const og = new THREE.LatheGeometry(earProfile(0.2, 0.37), 32)
    og.scale(1, 1, 0.5)
    paint(og, FUR)
    const ig = new THREE.LatheGeometry(earProfile(0.12, 0.25), 24)
    ig.scale(1, 1, 0.3)
    const inner = new THREE.Mesh(ig, pinkMat)
    inner.position.set(0, 0.03, 0.065)
    ear.add(new THREE.Mesh(og, fur), inner)
    head.add(ear)
    ears.push({ g: ear, s, flick: -1 })
  })
  const eyes = []
  ;[-0.2, 0.2].forEach((x) => {
    const { p, n } = onFace(x, 0.04)
    const eye = new THREE.Group()
    eye.position.copy(p).addScaledVector(n, -0.012)
    eye.lookAt(eye.position.clone().add(n))
    const lid = new THREE.Group()
    eye.add(lid)
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.105, 32, 24), eyeMat)
    ball.scale.set(1, 1.15, 0.55)
    const g1 = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), glintMat)
    g1.position.set(0.035, 0.05, 0.05)
    const g2 = new THREE.Mesh(new THREE.SphereGeometry(0.015, 12, 8), glintMat)
    g2.position.set(-0.03, -0.045, 0.05)
    lid.add(ball, g1, g2)
    head.add(eye)
    eyes.push({ lid })
  })
  {
    const { p, n } = onFace(0, -0.1)
    const g = new THREE.SphereGeometry(1, 24, 16)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const w = 1 - 0.45 * smooth(0.6, -0.8, pos.getY(i))
      pos.setXYZ(i, pos.getX(i) * 0.046 * w, pos.getY(i) * 0.03, pos.getZ(i) * 0.025)
    }
    g.computeVertexNormals()
    const nose = new THREE.Mesh(g, pinkMat)
    nose.position.copy(p).addScaledVector(n, 0.004)
    nose.lookAt(nose.position.clone().add(n))
    head.add(nose)
    const pts = [[-0.075, -0.15], [-0.05, -0.178], [-0.022, -0.172], [0, -0.148], [0.022, -0.172], [0.05, -0.178], [0.075, -0.15]]
      .map(([x, y]) => onFace(x, y).p.add(new THREE.Vector3(0, 0, 0.004)))
    head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0085, 8, false), inkMat))
  }
  {
    const c = document.createElement('canvas'); c.width = c.height = 64
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, 'rgba(255,140,170,0.85)'); gr.addColorStop(0.55, 'rgba(255,140,170,0.35)'); gr.addColorStop(1, 'rgba(255,140,170,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
    ;[-1, 1].forEach((s) => {
      const { p, n } = onFace(0.36 * s, -0.12)
      const blush = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.14), mat)
      blush.position.copy(p).addScaledVector(n, 0.006)
      blush.lookAt(blush.position.clone().add(n))
      head.add(blush)
    })
  }

  // 四条腿：管子 + 圆脚掌（脚掌前面有两道浅浅的趾缝）
  const LEG_RINGS = 16
  const pawGeo = sculpt([0.13, 0.085, 0.115], [], (q) => {
    const toe = smooth(0.0, 0.1, q.x)
    q.y -= toe * 0.01 * (Math.exp(-((q.z - 0.035) ** 2) / 0.0004) + Math.exp(-((q.z + 0.035) ** 2) / 0.0004)) * smooth(-0.02, 0.04, q.y)
    if (q.y < -0.04) q.y = -0.04 + (q.y + 0.04) * 0.45
  }, [40, 30])
  const legs = []
  for (const [type, side, phase] of [['hind', 1, 0], ['front', 1, 0.25], ['hind', -1, 0.5], ['front', -1, 0.75]]) {
    const t = tube(LEG_RINGS, 20, () => COL.fur)
    rig.add(t.mesh)
    const paw = new THREE.Mesh(pawGeo, fur)
    rig.add(paw)
    legs.push({ type, side, phase, d: DIM[type], t, paw })
  }

  // 尾巴：管子，尾尖渐变成青色
  const TN = DIM.tail.seg
  const tail = tube(TN, 18, (u) => { const t = smooth(0.6, 0.85, u); return COL.fur.map((v, i) => lerp(v, COL.accent[i], t)) })
  rig.add(tail.mesh)

  return { root, rig, body, torso, headBase, head, ears, eyes, legs, tail, TN, LEG_RINGS }
}

async function start() {
  const style = el('style')
  style.textContent = css
  document.head.append(style)

  const wrap = el('div', 'joy-pet' + (SHOW ? ' show' : ''))
  const bubble = el('div', 'joy-pet-bubble', { role: 'status', 'aria-live': 'polite' })
  const close = el('button', 'joy-pet-close', { type: 'button', 'aria-label': '收起小猫', title: '收起小猫' })
  close.textContent = '×'
  // index.html 里预留了 #pet-launcher；没有就自己建一个
  const open = document.getElementById('pet-launcher') || el('button', 'joy-pet-open', { type: 'button', 'aria-label': '叫小猫出来', title: '叫小猫出来' })
  if (!open.textContent) open.textContent = '🐾 猫'

  let THREE
  try {
    THREE = await import(THREE_URL)
  } catch (err) {
    console.warn('[pet] three.js 加载失败，跳过宠物', err)
    debug.errors.push(String(err))
    return
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  const canvas = renderer.domElement
  canvas.setAttribute('tabindex', '0')
  canvas.setAttribute('role', 'button')
  canvas.setAttribute('aria-label', '小猫，点一下摸摸它')
  wrap.append(bubble, canvas)
  document.body.append(wrap, close)
  if (!open.isConnected) document.body.append(open)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 60)
  const camTarget = new THREE.Vector3(0.15, 0.62, 0)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3442, 1.7))
  const key = new THREE.DirectionalLight(0xfff6ec, 2.2)
  key.position.set(2, 3, 4)
  scene.add(key)
  const rimL = new THREE.DirectionalLight(0x5eead4, 1.3) // 背后的青色轮廓光，呼应站点主色
  rimL.position.set(-2.5, 2, -3)
  scene.add(rimL)

  const cat = buildCat(THREE)
  const { root, rig, body, torso, headBase, head, ears, eyes, legs, tail, TN, LEG_RINGS } = cat
  scene.add(root)

  // 脚下：柔和的青色光晕 + 接触阴影，跟着猫走
  function radial(stops) {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    stops.forEach(([o, s]) => gr.addColorStop(o, s))
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radial([[0, 'rgba(0,184,184,0.3)'], [0.6, 'rgba(0,184,184,0.1)'], [1, 'rgba(0,184,184,0)']]), transparent: true, depthWrite: false }))
  glow.rotation.x = -Math.PI / 2
  scene.add(glow)
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radial([[0, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false }))
  contact.rotation.x = -Math.PI / 2
  contact.position.y = 0.002
  scene.add(contact)

  const resize = () => {
    const r = wrap.getBoundingClientRect()
    const w = r.width || 280, h = r.height || 180
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // 画面至少 4.3 宽、2.0 高，猫走到两头也不出画
    const vfov = (camera.fov * Math.PI) / 180
    const dist = Math.max(2.0, 4.3 / camera.aspect) / 2 / Math.tan(vfov / 2)
    camera.position.set(0.15, 0.62 + dist * 0.16, dist)
    camera.lookAt(camTarget)
    camera.updateProjectionMatrix()
  }
  new ResizeObserver(resize).observe(wrap)
  resize()

  // ---------------------------------------------------------------- 动作
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const rand = Math.random
  const pointer = { x: 0, y: 0, t: -99 }
  const st = {
    mode: 'stand', until: 3, x: 0, targetX: 0,
    yaw: spring(-0.55), speed: spring(0), gait: 0,
    w: { sit: spring(0), loaf: spring(0) },
    hy: spring(0), hp: spring(0), ht: spring(0), tiltTarget: 0, tiltUntil: 0, nextIdle: 4,
    happyUntil: -1, hop: -1, sx: spring(1), sy: spring(1), lift: spring(0),
    blinkT: -1, blinkLen: 0.16, nextBlink: 2, swish: 0, breath: 0, flick: 0,
    tailEl: Array.from({ length: TN }, () => spring(0.6)), tailAz: Array.from({ length: TN }, () => spring(0)),
  }
  addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.t = performance.now() / 1000; if (!running) render() }, { passive: true })

  function ik(ax, ay, tx, ty, l1, l2, bend) {
    const dx = tx - ax, dy = ty - ay
    const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4)
    const c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)
    const b = Math.atan2(dy, dx) + bend * Math.acos(c)
    return [ax + l1 * Math.cos(b), ay + l1 * Math.sin(b)]
  }
  function curve(pts, n, out) {
    const segs = pts.length - 1
    for (let i = 0; i < n; i++) {
      const f = (i / (n - 1)) * segs, s = Math.min(segs - 1, Math.floor(f)), t = f - s
      const p0 = pts[Math.max(0, s - 1)], p1 = pts[s], p2 = pts[s + 1], p3 = pts[Math.min(segs, s + 2)]
      const t2 = t * t, t3 = t2 * t
      const k = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out[i].set(k(p0.x, p1.x, p2.x, p3.x), k(p0.y, p1.y, p2.y, p3.y), k(p0.z, p1.z, p2.z, p3.z))
    }
    return out
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z)
  const legPts = Array.from({ length: LEG_RINGS }, () => new THREE.Vector3())
  const legR = new Array(LEG_RINGS).fill(0.1)
  const tailPts = Array.from({ length: TN }, () => new THREE.Vector3())
  const tailR = Array.from({ length: TN }, (_, i) => { const u = i / (TN - 1), tip = clamp((u - 0.8) / 0.2); return lerp(DIM.tail.r0, DIM.tail.r1, u) * Math.sqrt(1 - tip * tip * 0.9) })

  // 走一段 → 停下（站着看你 / 坐 / 揣手趴）→ 再走
  function think(t) {
    if (SHOW || st.happyUntil > t || t < st.until || st.mode === 'walk') return
    if (st.mode !== 'stand') { st.mode = 'stand'; st.until = t + 1 + rand(); return }
    const r = rand()
    if (r < 0.55) {
      let tx = (rand() * 2 - 1) * DIM.roam
      if (Math.abs(tx - st.x) < 0.3) tx = st.x > 0 ? -DIM.roam * (0.5 + rand() * 0.5) : DIM.roam * (0.5 + rand() * 0.5)
      st.targetX = tx; st.mode = 'walk'
    } else if (r < 0.8) { st.mode = 'sit'; st.until = t + 5 + rand() * 6 }
    else { st.mode = 'loaf'; st.until = t + 7 + rand() * 7 }
  }

  function sim(t, dt) {
    think(t)
    const happy = st.happyUntil > t
    const mode = SHOW ? (SHOW_POSE === 'hop' ? 'stand' : SHOW_POSE) : st.mode

    // ---- 朝向和移动：边走边转，转身时经过“面朝镜头”
    let wantSpeed = 0, wantYaw
    const yaw = st.yaw.x
    if (mode === 'walk' && !happy) {
      const dx = SHOW ? 1 : st.targetX - st.x
      wantYaw = dx > 0 ? 0 : -Math.PI
      wantSpeed = DIM.speed * clamp(Math.cos(wantYaw - yaw)) ** 2 * smooth(0, 0.15, Math.abs(dx))
      if (Math.abs(dx) < 0.02) { st.mode = 'stand'; st.until = t + 1.5 + rand() * 2 }
    } else {
      const facing = Math.cos(yaw) >= -0.05 ? 1 : -1
      const turn = happy ? 1.0 : mode === 'sit' ? 0.85 : mode === 'loaf' ? 0.6 : 0.5
      wantYaw = facing > 0 ? -turn : -Math.PI + turn
    }
    if (SHOW && params.get('petyaw')) wantYaw = (+params.get('petyaw') * Math.PI) / 180
    step(st.yaw, wrapNear(wantYaw, yaw), mode === 'walk' ? 2.4 : 1.8, dt)
    step(st.speed, wantSpeed, 3, dt)
    const speed = Math.max(0, st.speed.x)
    if (!SHOW) st.x = clamp(st.x + Math.cos(st.yaw.x) * speed * dt, -DIM.roam - 0.1, DIM.roam + 0.1)
    // 转身时原地踏步
    const stepping = Math.max(speed, Math.min(DIM.speed * 0.6, Math.abs(st.yaw.v) * 0.25))
    st.gait = (st.gait + (dt * stepping * DIM.duty) / DIM.stride) % 1
    const amp = clamp(stepping / DIM.speed)

    // ---- 姿势权重
    step(st.w.sit, mode === 'sit' && !happy ? 1 : 0, 2.6, dt)
    step(st.w.loaf, mode === 'loaf' && !happy ? 1 : 0, 2.2, dt)
    const ws = clamp(st.w.sit.x), wl = clamp(st.w.loaf.x)
    const wsHip = 1 - (1 - ws) ** 2, wsPitch = ws * ws * (3 - 2 * ws) // 坐下时后腿先落，前身后抬
    const S = POSE.stand
    const mixP = (k, sitW = ws) => S[k] + (POSE.sit[k] - S[k]) * sitW + (POSE.loaf[k] - S[k]) * wl
    const mixDir = (k) => {
      const a = [0, 0]
      for (const [p, w] of [[S, Math.max(0, 1 - ws - wl)], [POSE.sit, ws], [POSE.loaf, wl]]) { a[0] += p[k][0] * w; a[1] += p[k][1] * w }
      const l = Math.hypot(a[0], a[1]) || 1
      return [a[0] / l, a[1] / l]
    }

    // ---- 躯干：呼吸、走路时的起伏和左右摇摆
    st.breath += dt * (wl > 0.5 ? 1.4 : 2.0)
    const ph = st.gait * TAU
    const bob = amp * 0.018 * (1 - Math.cos(ph * 2)) * 0.5
    const hipY = mixP('hip', wsHip) - bob
    const pitch = mixP('pitch', wsPitch) + amp * 0.02 * Math.sin(ph * 2 + 0.6)
    root.position.x = st.x
    root.rotation.y = st.yaw.x
    body.position.set(0, hipY, amp * 0.015 * Math.sin(ph))
    body.rotation.set(amp * 0.04 * Math.sin(ph + 0.4), amp * 0.04 * Math.sin(ph), pitch)
    const br = 1 + 0.012 * Math.sin(st.breath)
    torso.scale.set(1, br, br)
    const cp = Math.cos(pitch), sp = Math.sin(pitch)
    const toRoot = (x, y) => [x * cp - y * sp, hipY + x * sp + y * cp]

    // ---- 腿：步态 → 脚掌位置 → 两段 IK → 沿平滑曲线重建整条腿
    const [shX, shY] = toRoot(...DIM.shoulder)
    const fm = mixDir('fm'), hm = mixDir('hm')
    for (const L of legs) {
      const front = L.type === 'front'
      const jx = front ? shX : 0, jy = front ? shY : hipY
      const restX = jx + mixP(front ? 'fx' : 'hx')
      const p = (st.gait + L.phase) % 1
      let off, lift = 0, curl = 0
      if (p < DIM.duty) off = DIM.stride * (0.5 - p / DIM.duty)
      else {
        const q = (p - DIM.duty) / (1 - DIM.duty)
        off = DIM.stride * (-0.5 + smooth(0, 1, q))
        lift = Math.sin(Math.PI * q ** 0.8) * DIM.lift // 抬得快、放得轻
        curl = Math.sin(Math.PI * q)
      }
      const pawX = restX + off * amp + 0.03, pawY = 0.06 + lift * amp
      const md = front ? fm : hm
      const ca = curl * amp * (front ? 0.8 : 0.5), cc = Math.cos(ca), cs = Math.sin(ca)
      const mdx = md[0] * cc - md[1] * cs, mdy = md[0] * cs + md[1] * cc
      const wx = pawX + mdx * L.d.meta, wy = pawY + mdy * L.d.meta
      const [kx, ky] = ik(jx, jy, wx, wy, L.d.L[0], L.d.L[1], front ? -1 : 1)
      const z = L.side * L.d.z * mixP('lz')
      // 腿根锚点沿大腿方向往身体里延长：关节处不拐急弯，管子不会自相交出尖角
      const ctrl = [V(jx - (kx - jx) * 0.7, jy - (ky - jy) * 0.7, z * 0.55), V(jx, jy, z * 0.9), V(kx, ky, z), V(wx, wy, z), V(pawX, pawY, z)]
      curve(ctrl, LEG_RINGS, legPts)
      for (let i = 0; i < LEG_RINGS; i++) {
        const f = (i / (LEG_RINGS - 1)) * 4, s = Math.min(3, Math.floor(f))
        legR[i] = lerp(L.d.r[s], L.d.r[s + 1], f - s)
      }
      L.t.write(legPts, legR)
      L.paw.position.set(pawX + 0.025, pawY - 0.01, z)
      L.paw.rotation.set(0, 0, ca * 0.8)
    }

    // ---- 头：看鼠标 / 看镜头 / 随便张望；抵消躯干俯仰，头始终正着
    headBase.rotation.z = -pitch
    headBase.position.y = DIM.head[1] + bob * 0.7
    let look = null
    const now = performance.now() / 1000
    if (happy || SHOW) look = camera.position
    else if (now - pointer.t < 5) {
      const r = canvas.getBoundingClientRect()
      const nx = ((pointer.x - r.left) / r.width) * 2 - 1, ny = -((pointer.y - r.top) / r.height) * 2 + 1
      const v = new THREE.Vector3(clamp(nx, -6, 6), clamp(ny, -6, 6), 0.5).unproject(camera).sub(camera.position).normalize()
      look = camera.position.clone().addScaledVector(v, (1.2 - camera.position.z) / v.z)
    } else look = camera.position // 没事的时候就看着你
    let wantHY = 0, wantHP = 0
    root.updateMatrixWorld()
    const hpw = headBase.getWorldPosition(new THREE.Vector3())
    const d = root.worldToLocal(look.clone()).sub(root.worldToLocal(hpw.clone()))
    const a = Math.atan2(-d.z, d.x)
    if (Math.abs(a) < 2.0) { wantHY = clamp(a, -1.25, 1.25); wantHP = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.4, 0.35) }
    const walking = mode === 'walk' ? amp : 0
    wantHY *= 1 - walking * 0.5
    wantHP *= 1 - walking * 0.5
    if (!SHOW && t > st.nextIdle) {
      const r = rand()
      if (r < 0.4) { st.tiltTarget = (rand() < 0.5 ? -1 : 1) * (0.14 + rand() * 0.08); st.tiltUntil = t + 1.4 + rand() }
      else if (r < 0.7) ears[rand() < 0.5 ? 0 : 1].flick = 0
      else st.flick = 1
      st.nextIdle = t + 3 + rand() * 4
    }
    if (t > st.tiltUntil) st.tiltTarget = 0
    step(st.hy, wantHY, 4.5, dt)
    step(st.hp, wantHP, 4.5, dt)
    step(st.ht, st.tiltTarget + (happy ? 0.16 : 0), 3.2, dt)
    head.rotation.set(st.hp.x, Math.PI / 2 + st.hy.x, -st.ht.x)

    // ---- 耳朵、眨眼
    for (const e of ears) {
      let f = 0
      if (e.flick >= 0) { e.flick += dt; f = Math.sin(clamp(e.flick / 0.24) * Math.PI) * 0.35; if (e.flick > 0.24) e.flick = -1 }
      e.g.rotation.set(-f * 0.6, -0.2 * e.s, -0.36 * e.s - f * e.s * 0.5)
    }
    let lid = 1 - wl * 0.4
    if (!SHOW) {
      if (st.blinkT < 0 && t > st.nextBlink) { st.blinkT = 0; st.blinkLen = rand() < 0.18 ? 0.9 : 0.16 }
      if (st.blinkT >= 0) {
        st.blinkT += dt
        const p = st.blinkT / st.blinkLen
        const k = st.blinkLen > 0.5 ? 1 - 0.9 * (p < 0.3 ? smooth(0, 0.3, p) : p < 0.7 ? 1 : 1 - smooth(0.7, 1, p)) : 1 - Math.sin(clamp(p) * Math.PI) * 0.92
        lid = Math.min(lid, k)
        if (p >= 1) { st.blinkT = -1; st.nextBlink = t + 2 + rand() * 3 }
      }
    }
    if (SHOW_STATE === 'open') lid = 1
    eyes.forEach((e) => (e.lid.scale.y = Math.max(0.08, lid)))

    // ---- 跳：蓄力下蹲 → 起跳拉长 → 腾空 → 落地压扁 → 回弹
    let tx = 1, ty = 1, lift = 0
    if (st.hop >= 0) {
      st.hop += dt
      const h = st.hop
      if (h < 0.14) { ty = 0.86; tx = 1.07 }
      else if (h < 0.62) { const p = (h - 0.14) / 0.48; lift = Math.sin(p * Math.PI) * 0.45; ty = p < 0.5 ? 1.07 : 1; tx = p < 0.5 ? 0.96 : 1 }
      else if (h < 0.7) { ty = 0.85; tx = 1.08 }
      if (h >= 0.62 && h - dt < 0.62) { ears.forEach((e) => (e.flick = 0)); st.flick = 1.3 }
      if (h > 0.95) st.hop = -1
    }
    if (SHOW_POSE === 'hop') { lift = 0.3; ty = 1.06; tx = 0.97 }
    step(st.sy, ty, 16, dt, 0.42)
    step(st.sx, tx, 16, dt, 0.42)
    step(st.lift, lift, 22, dt, 0.9)
    rig.position.y = Math.max(0, st.lift.x)
    rig.scale.set(st.sx.x, st.sy.x, st.sx.x)

    // ---- 尾巴：每节的目标角度按姿势混合，再用弹簧跟随，越靠尾尖越慢
    const tb = toRoot(...DIM.tail.base)
    st.swish += dt * (ws > 0.5 || wl > 0.5 ? 1.3 : 1.0)
    st.flick = Math.max(0, st.flick - dt * 1.6)
    const wrapW = Math.max(ws, wl)
    const hp = happy ? 1 : 0
    const segL = DIM.tail.len / (TN - 1)
    tailPts[0].set(tb[0], tb[1], 0)
    for (let i = 1; i < TN; i++) {
      const u = i / (TN - 1)
      const relaxed = lerp(1.15, 0.35, u) + 0.3 * Math.sin(u * 3.2)   // 翘起，往后弯成一道弧
      const wrapEl = lerp(-1.2, 0, smooth(0, 0.3, u))                 // 坐 / 趴时先垂到地上
      const happyEl = 1.5 + smooth(0.65, 1, u) * 1.2                  // 开心：竖直，尖端向前钩
      let elv = lerp(relaxed, wrapEl, wrapW)
      elv = lerp(elv, happyEl, hp * (1 - wrapW))
      const flick = st.flick * Math.sin(t * 14 - u * 4) * 0.5 * smooth(0.5, 1, u)
      const sway = (reduced.matches ? 0 : 0.3 * Math.sin(st.swish * 2 - u * 2.6)) * (1 - wrapW * 0.7) + flick
      const wrapAz = smooth(0.2, 1, u) * 2.3 + 0.15 * Math.sin(st.swish * 1.3) * smooth(0.75, 1, u)
      const az = lerp(sway, wrapAz, wrapW)
      const k = lerp(9, 4.5, u)
      const e = step(st.tailEl[i], elv, k, dt), aa = step(st.tailAz[i], az, k, dt)
      const c = Math.cos(e)
      const q = tailPts[i].copy(tailPts[i - 1]).add(V(-c * Math.cos(aa) * segL, Math.sin(e) * segL, c * Math.sin(aa) * segL))
      q.y = Math.max(q.y, tailR[i] * 0.95)
    }
    tail.write(tailPts, tailR)

    // ---- 脚下的光晕和阴影
    const cx = st.x + Math.cos(st.yaw.x) * 0.35, cz = -Math.sin(st.yaw.x) * 0.35
    const up = Math.max(0, st.lift.x)
    glow.position.set(cx, 0.001, cz)
    glow.scale.setScalar(2.4)
    glow.material.opacity = 1 - up
    contact.position.set(cx, 0.002, cz)
    contact.rotation.z = st.yaw.x
    contact.scale.set(1.9 - up, 0.9 - up * 0.5, 1)
    contact.material.opacity = 1 - up * 1.5
  }

  // ---------------------------------------------------------------- 渲染循环
  let running = false
  let raf = 0
  const clock = new THREE.Clock()
  let simT = 0
  function render() {
    const dt = Math.min(0.05, clock.getDelta())
    simT += dt
    try { sim(simT, dt) } catch (e) { debug.errors.push(String((e && e.stack) || e)); throw e }
    renderer.render(scene, camera)
    debug.frames++
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
      do i = Math.floor(rand() * LINES.length)
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
    root.updateMatrixWorld()
    const hp = headBase.getWorldPosition(new THREE.Vector3()).project(camera)
    const cx = r.left + ((hp.x + 1) / 2) * r.width, cy = r.top + ((1 - hp.y) / 2) * r.height
    for (let i = 0; i < 5; i++) {
      const h = el('span', 'joy-heart', { 'aria-hidden': 'true' })
      h.textContent = '♥'
      h.style.left = cx - 8 + (rand() - 0.5) * 50 + 'px'
      h.style.top = cy - 30 + 'px'
      h.style.setProperty('--dx', (rand() - 0.5) * 60 + 'px')
      h.style.animationDelay = i * 70 + 'ms'
      document.body.append(h)
      setTimeout(() => h.remove(), 1300)
    }
  }
  function poke() {
    // 停下、转头看你、跳一下
    st.happyUntil = simT + 2.6
    if (st.mode === 'walk') st.mode = 'stand'
    st.until = Math.max(st.until, st.happyUntil + 1)
    if (st.hop < 0) st.hop = 0
    hearts()
    say(rand() < 0.5 ? '喵！' : '')
    if (!raf) { clock.getDelta(); raf = requestAnimationFrame(function tick() { render(); raf = st.hop >= 0 || running ? requestAnimationFrame(tick) : 0 }) }
  }
  canvas.addEventListener('click', poke)
  canvas.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke() } })

  // 随机说话：首次进场 2.5 秒后打招呼，之后每 18~35 秒一句
  let talkTimer = 0
  function scheduleTalk(delay) {
    clearTimeout(talkTimer)
    talkTimer = setTimeout(() => { if (!wrap.hidden && !document.hidden) say(); scheduleTalk(18000 + rand() * 17000) }, delay)
  }

  function setHidden(hidden) {
    wrap.hidden = hidden
    close.hidden = hidden || SHOW
    open.hidden = !hidden
    try { localStorage.setItem(STORAGE_KEY, hidden ? '1' : '') } catch {}
    if (hidden) { clearTimeout(talkTimer); bubble.classList.remove('on') } else if (!SHOW) scheduleTalk(1200)
    play()
  }
  close.addEventListener('click', () => { setHidden(true); open.focus() })
  open.addEventListener('click', () => { setHidden(false); say('我回来啦～'); canvas.focus() })

  let stored = ''
  try { stored = localStorage.getItem(STORAGE_KEY) || '' } catch {}
  if (SHOW) stored = ''
  // 先把弹簧、尾巴和腿稳定下来，避免第一帧从零位置弹过来
  if (SHOW && SHOW_POSE === 'walk') st.gait = +(params.get('petgait') || 0.15)
  for (let i = 0; i < 120; i++) { simT += 1 / 60; sim(simT, 1 / 60) }
  setHidden(stored === '1')
  debug.ready = true
  if (stored !== '1' && !SHOW) {
    clearTimeout(talkTimer)
    setTimeout(() => say(LINES[0]), 2500)
    scheduleTalk(2500 + 20000)
  }
}

// three.js 解析 + 首帧编译 shader 是一个 100ms 级的长任务，必须等入场动画（约 2s）播完、浏览器空闲时再加载，否则入场会卡一下
const run = () => start().catch((e) => { debug.errors.push(String((e && e.stack) || e)); console.error('[pet]', e) })
const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1))
const later = () => (SHOW ? run() : setTimeout(() => idle(run, { timeout: 2000 }), 2400))
if (document.readyState === 'complete') later()
else addEventListener('load', later, { once: true })
