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
 * - 转身：绕身子中点转，先转头、脊柱往那边弯，身子再跟上；边转边踏步，着地的脚钉在地上不打滑
 * - 尾巴每节比前一节慢半拍；呼吸、眨眼（偶尔慢眨）、抖耳朵、歪头
 * - 点击：停下、转头看你、蓄力跳一下（落地压扁再回弹），冒爱心；随机冒说话气泡
 * - 可收起，状态记在 localStorage；打印时隐藏；prefers-reduced-motion 下只渲染静止画面
 * 展示台：?pet=show 整屏渲染，&petpose=<pet.json 里的姿势名>|walk|hop 固定姿势，&petstate=open 固定睁眼（无头浏览器里动画帧很少，截图用）
 * three.js 走 CDN，页面 load 之后才加载，失败时整个宠物不出现，不影响简历本身
 * AI（对话面板、陪投稿编辑器干活）在同目录的 pet-ai.js：就绪后把下面的 window.pairwisePet 交给它；pet.json 没有 ai 时不加载
 * 页面挪开小猫用 CSS 变量（写在 :root 上，可以按媒体查询分别给）：--pet-lift 整体抬高多少（猫、收起按钮、叫回按钮一起），
 *   --pet-right 猫离右边多远，--pet-w / --pet-h 画布尺寸，--pet-open-right 叫回按钮离右边多远；
 *   --pet-start: hidden 表示这个页面默认收起（只在加载时读一次，不记进 localStorage）
 *
 * 数据和引擎分开：台词、配色、尺寸、姿势、行为节奏都在同目录的 pet.json（字段说明见下面的 PetConfig），
 * 这个文件只管怎么捏形体、怎么动。加台词、调性格、换配色、加一种静态姿势只改 pet.json；
 * 新动作（比如舔爪）或新物种要改这里。pet.json、pet-ai.js 跟着 pet.js 的 ?v= 一起刷新缓存，
 * 改了要给 site/resume/index.html 和 blog/src/layouts/Base.astro 里的版本号一起加一。
 */
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js'
const STORAGE_KEY = 'joy-pet-hidden'
const sibling = (name) => { const u = new URL(name, import.meta.url); u.search = new URL(import.meta.url).search; return u }
const CONFIG_URL = sibling('pet.json')

/**
 * pet.json 的结构。区间 [a, b] 表示每次在 a~b 之间随机取；时间单位都是秒。
 * @typedef {object} PetConfig
 * @property {{ canvas: string, close: string, open: string, openButton: string, chat?: string, chatTitle?: string }} text 画布和按钮的读屏名称、收起后的按钮文字；
 *   open / openButton 只在页面没有预留 #pet-launcher 时用（简历页 resume/index.html 里预留了，那里的文字写在 HTML 里）；chat / chatTitle 是对话按钮和面板标题（有 ai 时必填）
 * @property {{ greet: string, back: string, poke: string, random: string[], ai?: { start: string, writing: string, done: string, failed: string, noKey: string } }} lines
 *   进场招呼、叫回来、被摸时（按 behavior.poke.lineChance）、随机说的话；
 *   ai（有 ai 时必填）：编辑器里 AI 开工 / 开始出正文 / 写完，AI 出错，没配置 AI 时说的话。
 *   index.html 的 Geist 字体按 text= 子集化：简历页上会显示的台词里新出现的英文 / 数字 / 符号要补进那里，否则会回退成系统字体
 * @property {object} colors fur / accent（围兜、尾尖）/ pink（耳内、鼻子）是 0~1 的 sRGB 三元组；eye / mouth / rim（背后轮廓光）是 #hex；
 *   blush（腮红）/ glow（脚下光晕）是 0~255 的 RGB，透明度渐变写在代码里
 * @property {object} dim 尺寸表。单位：头的半径约 0.5；坐标：猫面朝 +X，Y 向上，Z 指向猫的左侧（镜头一侧），地面 y = 0；
 *   躯干和头挂在 body 上，body 以髋关节为支点俯仰。
 *   shoulder / head：肩关节、头部中心相对髋关节的位置（body 坐标）；headScale：头的缩放；
 *   front / hind：L 大腿和小腿长、meta 掌骨长、z 离中线多远、r 从腿根到脚腕的 5 个半径；
 *   tail：len 总长、r0 / r1 根部和尖端半径、base 尾根位置、seg 节数；
 *   body：躯干放样截面 [x, 截面中心 y, 上下半径, 左右半径]，从臀到胸，像一颗横放的豆子；
 *   stride 步幅、duty 每只脚着地占一个步态周期的比例、lift 抬脚高度、speed 走路速度；
 *   roam：走动范围，身子中点 x 在 ±roam 之间；pivot：转身支点（髋和肩的中点，body 坐标 x）；
 *   bend：脊柱侧弯从这里开始弯、到这里弯完（body 坐标 x），前面一段整体转过去；
 *   turnRate：转身最快多少弧度 / 秒，再快短腿的步子就跟不上
 * @property {Object<string, PetPose>} poses 必须有 stand（站着，也是混合的基准）；其余姿势按权重叠加在 stand 上
 * @property {object} behavior 行为节奏：
 *   next：站够了之后下一步做什么，按 weight 抽，do 是 walk 或 poses 里 stand 以外的姿势名，姿势要写 hold（保持多久）；
 *   pause：从姿势起身后先站多久；arrive：走到目的地后站多久；
 *   idle：每隔 every 随机做一个小动作，weights 里 tilt 歪头 / ear 抖耳朵 / tail 甩尾巴，tiltAngle 歪头角度（弧度），tiltHold 歪多久；
 *   blink：每隔 every 眨一次眼，slowChance 的概率是慢眨，fast / slow 是两种眨眼的时长；
 *   poke：被点后开心多久（happy）、开心时身子往镜头侧过来多少（turn）、说 lines.poke 的概率（lineChance，否则随机说一句）；
 *   talk：进场后多久打招呼（greetAfter）、招呼后多久开始随机说话（firstAfterGreet）、之后的间隔（every）、叫回来后多久说话（reopenAfter）、气泡停留多久（show）
 * @property {PetAi} [ai] 和小猫对话（pet-ai.js）；不写就没有 AI 功能
 */
/**
 * @typedef {object} PetAi
 * @property {string} persona 系统提示词里的人设和回答规则
 * @property {{ selector: string, kind: string, prompts: string[] }[]} sources 页面资料从哪取：按顺序取第一个选中了非空文字的 selector（所有匹配元素的文字拼起来），
 *   kind 是告诉模型这是什么（文章 / 简历…），prompts 是面板上的快捷提问
 * @property {string} selection 「解释选中的内容」时放在选中文字前面的提问
 * @property {number} maxContext 页面资料最多带多少字
 * @property {number} history 最多带上最近几条对话（一问一答算两条）
 * @property {number} memory 访客浏览器里最多记住几条对话（换页面、刷新后还在，面板上能清空）
 * @property {string} thinkPose 等模型回答时摆的姿势（stand 以外的姿势名）
 */
/**
 * 一种姿势。stand 必须给齐 hip ~ lz 和 turn / breath / swish（stand 上的 eyes / settled / blend / ease 不起作用）；
 * 其它姿势必须写 blend，缺的其它项沿用 stand 的；姿势名不能用 walk、hop。
 * @typedef {object} PetPose
 * @property {number} hip 髋高
 * @property {number} pitch 身子俯仰
 * @property {number} fx 前脚落点相对肩的前后偏移
 * @property {number} hx 后脚落点相对髋的前后偏移
 * @property {[number, number]} fm 前脚掌骨方向
 * @property {[number, number]} hm 后脚掌骨方向
 * @property {number} lz 腿往身体下面收的比例（1 是不收）
 * @property {number} [turn] 站定时身子往镜头侧过来多少（弧度；0 是正侧面，头另外会转过来看你）
 * @property {number} [breath] 呼吸快慢
 * @property {number} [swish] 尾巴摆动快慢
 * @property {number} [eyes] 眼睛睁开的程度（1 是全睁）
 * @property {boolean} [settled] 是不是坐下 / 趴下这类歇着的姿势：尾巴绕到身前、转身时脊柱不弯
 * @property {number} [blend] 进出这个姿势的弹簧刚度，越大越快（stand 以外必填）
 * @property {Object<string, 'out' | 'smooth'>} [ease] 某几项不按权重线性混合：out 先快后慢，smooth 两头慢
 * @property {string} [label] 给模型看的动作说明（对话时模型可以点名做这个姿势），不写就用姿势名
 */

const params = new URLSearchParams(location.search)
const SHOW = params.get('pet') === 'show'
const SHOW_POSE = SHOW ? params.get('petpose') || 'stand' : ''
const SHOW_STATE = params.get('petstate') || ''
const debug = (window.__pet = { ready: false, errors: [], frames: 0 })

const css = `
.joy-pet{position:fixed;right:var(--pet-right,10px);bottom:calc(6px + var(--pet-lift,0px));z-index:20;width:var(--pet-w,280px);height:var(--pet-h,180px);user-select:none;-webkit-user-select:none;pointer-events:none}
.joy-pet.show{right:0;bottom:0;width:100vw;height:100vh;background:#0d1118}
.joy-pet canvas{display:block;width:100%!important;height:100%!important;cursor:pointer;outline:none;pointer-events:none}
/* 画布大部分是透明的：只有指针在猫身上时（.hot）才接收点击，其余让给下面的页面选字、点链接 */
.joy-pet canvas.hot{pointer-events:auto}
.joy-pet canvas:focus-visible{outline:2px solid #00b8b8;outline-offset:-4px;border-radius:16px}
.joy-pet-bubble{position:absolute;right:42%;bottom:calc(var(--pet-h,180px) + 4px);max-width:200px;width:max-content;padding:8px 12px;border-radius:12px 12px 2px 12px;font:500 12px/1.45 "Geist","PingFang SC",sans-serif;color:var(--strong,#f3f5f9);background:color-mix(in srgb,var(--bg,#07090f) 82%,transparent);border:1px solid var(--line-hi,rgba(255,255,255,.14));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 10px 30px -10px rgba(0,0,0,.5);opacity:0;transform:translateY(6px) scale(.96);transform-origin:right bottom;transition:opacity .25s ease,transform .3s cubic-bezier(.22,1,.36,1);pointer-events:none}
.joy-pet-bubble.on{opacity:1;transform:none}
.joy-pet-close,.joy-pet-open{position:fixed;z-index:21;display:grid;place-items:center;border-radius:999px;border:1px solid var(--line-hi,rgba(255,255,255,.14));background:color-mix(in srgb,var(--bg,#07090f) 80%,transparent);color:var(--muted,#7d8596);cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:color .2s,border-color .2s,opacity .2s}
.joy-pet-close{right:calc(var(--pet-right,10px) + 10px);bottom:calc(var(--pet-h,180px) + 2px + var(--pet-lift,0px));width:22px;height:22px;font:600 12px/1 sans-serif;opacity:0}
.joy-pet:hover~.joy-pet-close,.joy-pet-close:hover,.joy-pet-close:focus-visible{opacity:1}
.joy-pet-open{right:var(--pet-open-right,18px);bottom:calc(18px + var(--pet-lift,0px));height:32px;padding:0 12px;font:500 12px/1 "Geist Mono",monospace;gap:6px}
.joy-pet-close:hover,.joy-pet-open:hover{color:var(--brand-2,#5eead4);border-color:var(--brand,#00b8b8)}
.joy-heart{position:fixed;z-index:22;pointer-events:none;font-size:16px;color:#ff6b9a;animation:joy-heart 1s cubic-bezier(.22,1,.36,1) forwards}
@keyframes joy-heart{from{opacity:1;transform:translate(0,0) scale(.6)}to{opacity:0;transform:translate(var(--dx),-70px) scale(1.2)}}
/* 上面给按钮写了 display:grid，会盖掉 [hidden] 的默认隐藏 */
.joy-pet[hidden],.joy-pet-close[hidden],.joy-pet-open[hidden],#pet-launcher[hidden]{display:none!important}
@media (hover:none){.joy-pet-close{opacity:1}}
@media (max-width:820px){.joy-pet{width:var(--pet-w,190px);height:var(--pet-h,122px);right:var(--pet-right,4px);bottom:calc(4px + var(--pet-lift,0px))}.joy-pet-close{right:calc(var(--pet-right,4px) + 6px);bottom:calc(var(--pet-h,122px) + var(--pet-lift,0px))}.joy-pet-bubble{bottom:calc(var(--pet-h,122px) + 4px);max-width:170px}}
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

// 脊柱侧弯：脊柱线在 [x0, x1] 这一段（dim.bend）弯成圆弧，总共转过 B，前面一段直的跟着转过去；
// 返回 body 坐标水平面里 (x, z) 弯过之后的位置和那一截的朝向。躯干着色器里的 bendP 是同一个公式，改这里要一起改
function bendAt([x0, x1], B, x, z) {
  const k = B / (x1 - x0)
  const xr = clamp(x, x0, x1) - x0, th = k * xr
  let cx = x0 + Math.min(x - x0, 0), cz
  if (Math.abs(k) < 1e-4) { cx += xr; cz = -0.5 * k * xr * xr } else { cx += Math.sin(th) / k; cz = -(1 - Math.cos(th)) / k }
  const ex = Math.max(x - x1, 0)
  cx += ex * Math.cos(B); cz -= ex * Math.sin(B)
  return [cx + z * Math.sin(th), cz + z * Math.cos(th), th]
}

const linear = (c) => c.map((v) => v ** 2.2)

function buildCat(THREE, { dim: DIM, colors: COL }) {
  const fur = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.72, sheen: 0.8, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xffffff) })
  const pinkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...COL.pink, THREE.SRGBColorSpace), roughness: 0.6 })
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: COL.eye, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 })
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const inkMat = new THREE.MeshBasicMaterial({ color: COL.mouth })
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

  // 身子：放样出来的“豆子”；围兜在着色器里逐像素画在胸前；转身时在着色器里侧弯（uBend）
  const bodyMat = fur.clone()
  const bendU = { value: 0 }
  const [bx0, bx1] = DIM.bend.map((v) => v.toFixed(3))
  bodyMat.onBeforeCompile = (sh) => {
    sh.uniforms.uBib = { value: new THREE.Color().setRGB(...COL.accent, THREE.SRGBColorSpace) }
    sh.uniforms.uBend = bendU
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 vObj;
      uniform float uBend;
      float bendTh(float x) { return uBend * (clamp(x, ${bx0}, ${bx1}) - ${bx0}) / (${bx1} - ${bx0}); }
      vec3 bendP(vec3 p) {
        float k = uBend / (${bx1} - ${bx0}), xr = clamp(p.x, ${bx0}, ${bx1}) - ${bx0}, th = k * xr;
        vec2 c = vec2(${bx0} + min(p.x - ${bx0}, 0.0), 0.0);
        if (abs(k) < 1e-4) c += vec2(xr, -0.5 * k * xr * xr); else c += vec2(sin(th) / k, -(1.0 - cos(th)) / k);
        c += max(p.x - ${bx1}, 0.0) * vec2(cos(uBend), -sin(uBend));
        return vec3(c.x + p.z * sin(th), p.y, c.y + p.z * cos(th));
      }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      { float th = bendTh(position.x); objectNormal = vec3(objectNormal.x * cos(th) + objectNormal.z * sin(th), objectNormal.y, -objectNormal.x * sin(th) + objectNormal.z * cos(th)); }`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;\ntransformed = bendP(transformed);')
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;\nuniform vec3 uBib;').replace('#include <color_fragment>', `#include <color_fragment>
      float e = pow(vObj.z / 0.2, 2.0) + pow((vObj.y + 0.02) / 0.24, 2.0);
      float bib = smoothstep(1.0, 0.82, e) * smoothstep(0.8, 0.9, vObj.x);
      diffuseColor.rgb = mix(diffuseColor.rgb, uBib, bib);`)
  }
  bodyMat.customProgramCacheKey = () => 'joy-pet-bib-bend'
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
    gr.addColorStop(0, `rgba(${COL.blush},0.85)`); gr.addColorStop(0.55, `rgba(${COL.blush},0.35)`); gr.addColorStop(1, `rgba(${COL.blush},0)`)
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

  return { root, rig, body, torso, headBase, head, ears, eyes, legs, tail, TN, LEG_RINGS, bendU }
}

/** 姿势混合的缓动：某几项不按权重线性混合（pose.ease 里写名字） */
const EASE = { out: (w) => 1 - (1 - w) ** 2, smooth: (w) => w * w * (3 - 2 * w) }
/** walk 和 hop 是动作不是静态姿势，不能拿来当姿势名；这里的说明给对话里的模型看（pet-ai.js 的动作标记） */
const MOVES = { walk: '走两步', hop: '开心地跳一下' }
const RESERVED = Object.keys(MOVES)
/** 模型点名的姿势保持几秒：够看清就行，之后接着按 behavior 走 */
const ACT_HOLD = 4

/** 读 pet.json 并检查各块的字段类型：写错直接报错、宠物不出现，免得跑起来才在某一帧里炸 */
async function loadConfig() {
  const res = await fetch(CONFIG_URL)
  if (!res.ok) throw new Error(`pet.json ${res.status}`)
  const cfg = await res.json()
  const bad = (path) => { throw new Error(`pet.json 的 ${path} 缺失或格式不对`) }
  const num = (v, path) => (typeof v === 'number' && Number.isFinite(v)) || bad(path)
  /** n 个有限数字组成的数组 */
  const nums = (v, n, path) => (Array.isArray(v) && v.length === n && v.every((x) => typeof x === 'number' && Number.isFinite(x))) || bad(path)
  const pair = (v, path) => nums(v, 2, path)
  const str = (v, path) => typeof v === 'string' || bad(path)
  for (const k of ['text', 'lines', 'colors', 'dim', 'poses', 'behavior']) if (!cfg[k] || typeof cfg[k] !== 'object') bad(k)
  const { text, lines, colors: C, dim: D, poses, behavior: B } = cfg
  for (const k of ['fur', 'accent', 'pink', 'blush', 'glow']) nums(C[k], 3, `colors.${k}`)
  for (const k of ['eye', 'mouth', 'rim']) (typeof C[k] === 'string' && /^#([0-9a-f]{3}){1,2}$/i.test(C[k])) || bad(`colors.${k}`)
  for (const k of ['shoulder', 'head', 'bend']) pair(D[k], `dim.${k}`)
  for (const k of ['headScale', 'stride', 'duty', 'lift', 'speed', 'roam', 'pivot', 'turnRate']) num(D[k], `dim.${k}`)
  for (const leg of ['front', 'hind']) {
    pair(D[leg]?.L, `dim.${leg}.L`)
    for (const k of ['meta', 'z']) num(D[leg][k], `dim.${leg}.${k}`)
    nums(D[leg].r, 5, `dim.${leg}.r`)
  }
  for (const k of ['len', 'r0', 'r1']) num(D.tail?.[k], `dim.tail.${k}`)
  ;(Number.isInteger(D.tail.seg) && D.tail.seg >= 3) || bad('dim.tail.seg')
  pair(D.tail.base, 'dim.tail.base')
  if (!Array.isArray(D.body) || D.body.length < 2) bad('dim.body')
  D.body.forEach((b, i) => nums(b, 4, `dim.body[${i}]`))
  for (const k of ['canvas', 'close', 'open', 'openButton']) str(text[k], `text.${k}`)
  for (const k of ['greet', 'back', 'poke']) str(lines[k], `lines.${k}`)
  if (!Array.isArray(lines.random) || !lines.random.length || !lines.random.every((l) => typeof l === 'string')) bad('lines.random')

  const { stand, ...others } = poses
  if (!stand) bad('poses.stand')
  for (const k of ['hip', 'pitch', 'fx', 'hx', 'lz', 'turn', 'breath', 'swish']) num(stand[k], `poses.stand.${k}`)
  for (const k of ['fm', 'hm']) pair(stand[k], `poses.stand.${k}`)
  for (const [n, p] of Object.entries(others)) {
    if (RESERVED.includes(n)) throw new Error(`pet.json 的姿势不能叫 ${n}`)
    num(p.blend, `poses.${n}.blend`)
    if (p.settled !== undefined && typeof p.settled !== 'boolean') bad(`poses.${n}.settled`)
    for (const k of ['hip', 'pitch', 'fx', 'hx', 'lz', 'eyes', 'turn', 'breath', 'swish']) if (p[k] !== undefined) num(p[k], `poses.${n}.${k}`)
    for (const k of ['fm', 'hm']) if (p[k] !== undefined) pair(p[k], `poses.${n}.${k}`)
    if (p.label !== undefined) str(p.label, `poses.${n}.label`)
    for (const [k, e] of Object.entries(p.ease ?? {})) if (!Object.hasOwn(EASE, e)) bad(`poses.${n}.ease.${k}`)
  }

  if (!Array.isArray(B.next) || !B.next.length) bad('behavior.next')
  B.next.forEach((n, i) => {
    num(n.weight, `behavior.next[${i}].weight`)
    if (n.do === 'walk') return
    if (n.do === 'stand' || !Object.hasOwn(others, n.do)) bad(`behavior.next[${i}].do`)
    pair(n.hold, `behavior.next[${i}].hold`)
  })
  for (const k of ['pause', 'arrive']) pair(B[k], `behavior.${k}`)
  for (const k of ['every', 'tiltAngle', 'tiltHold']) pair(B.idle?.[k], `behavior.idle.${k}`)
  for (const [k, w] of Object.entries(B.idle.weights ?? bad('behavior.idle.weights'))) { if (!['tilt', 'ear', 'tail'].includes(k)) bad(`behavior.idle.weights.${k}`); num(w, `behavior.idle.weights.${k}`) }
  pair(B.blink?.every, 'behavior.blink.every')
  for (const k of ['slowChance', 'fast', 'slow']) num(B.blink[k], `behavior.blink.${k}`)
  for (const k of ['happy', 'turn', 'lineChance']) num(B.poke?.[k], `behavior.poke.${k}`)
  for (const k of ['greetAfter', 'firstAfterGreet', 'reopenAfter', 'show']) num(B.talk?.[k], `behavior.talk.${k}`)
  pair(B.talk.every, 'behavior.talk.every')

  if (cfg.ai !== undefined) {
    const { ai } = cfg
    if (!ai || typeof ai !== 'object') bad('ai')
    for (const k of ['chat', 'chatTitle']) str(text[k], `text.${k}`)
    for (const k of ['start', 'writing', 'done', 'failed', 'noKey']) str(lines.ai?.[k], `lines.ai.${k}`)
    for (const k of ['persona', 'selection']) str(ai[k], `ai.${k}`)
    for (const k of ['maxContext', 'history', 'memory']) (Number.isInteger(ai[k]) && ai[k] > 0) || bad(`ai.${k}`)
    if (ai.thinkPose === 'stand' || !Object.hasOwn(others, ai.thinkPose)) bad('ai.thinkPose')
    if (!Array.isArray(ai.sources) || !ai.sources.length) bad('ai.sources')
    ai.sources.forEach((src, i) => {
      for (const k of ['selector', 'kind']) str(src?.[k], `ai.sources[${i}].${k}`)
      try { document.createDocumentFragment().querySelector(src.selector) } catch { bad(`ai.sources[${i}].selector`) }
      if (!Array.isArray(src.prompts) || !src.prompts.every((q) => typeof q === 'string')) bad(`ai.sources[${i}].prompts`)
    })
  }

  return { ...cfg, poses: { stand, ...Object.fromEntries(Object.entries(others).map(([n, p]) => [n, { ...stand, settled: false, ...p }])) } }
}

const rand = Math.random

async function start() {
  const style = el('style')
  style.textContent = css
  document.head.append(style)

  const wrap = el('div', 'joy-pet' + (SHOW ? ' show' : ''))
  const bubble = el('div', 'joy-pet-bubble', { role: 'status', 'aria-live': 'polite' })

  let THREE, cfg
  try {
    ;[THREE, cfg] = await Promise.all([import(THREE_URL), loadConfig()])
  } catch (err) {
    console.warn('[pet] three.js 或 pet.json 加载失败，跳过宠物', err)
    debug.errors.push(String(err))
    return
  }
  const { text: TEXT, lines: LINES, colors: COL, dim: DIM, poses: POSE, behavior: BEH } = cfg
  /** stand 以外的姿势：按权重叠在 stand 上 */
  const OTHERS = Object.keys(POSE).filter((n) => n !== 'stand')
  const SETTLED = OTHERS.filter((n) => POSE[n].settled)
  const range = ([a, b]) => a + rand() * (b - a)
  const pick = (entries) => {
    let r = rand() * entries.reduce((n, [, w]) => n + w, 0)
    for (const [v, w] of entries) if ((r -= w) < 0) return v
    return entries[entries.length - 1][0]
  }

  const close = el('button', 'joy-pet-close', { type: 'button', 'aria-label': TEXT.close, title: TEXT.close })
  close.textContent = '×'
  // index.html 里预留了 #pet-launcher；没有就自己建一个
  const open = document.getElementById('pet-launcher') || el('button', 'joy-pet-open', { type: 'button', 'aria-label': TEXT.open, title: TEXT.open })
  if (!open.textContent) open.textContent = TEXT.openButton

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  const canvas = renderer.domElement
  canvas.setAttribute('tabindex', '0')
  canvas.setAttribute('role', 'button')
  canvas.setAttribute('aria-label', TEXT.canvas)
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
  const rimL = new THREE.DirectionalLight(COL.rim, 1.3) // 背后的青色轮廓光，呼应站点主色
  rimL.position.set(-2.5, 2, -3)
  scene.add(rimL)

  const cat = buildCat(THREE, cfg)
  const { root, rig, body, torso, headBase, head, ears, eyes, legs, tail, TN, LEG_RINGS, bendU } = cat
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
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radial([[0, `rgba(${COL.glow},0.3)`], [0.6, `rgba(${COL.glow},0.1)`], [1, `rgba(${COL.glow},0)`]]), transparent: true, depthWrite: false }))
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
  const pointer = { x: 0, y: 0, t: -99, buttons: 0 }
  const st = {
    // x 是身子中点（转身支点）的位置；odo 只在展示台里累加：猫原地走，脚掌按假想的位移落地
    mode: 'stand', until: 3, x: 0, targetX: 0, odo: [0, 0],
    yaw: spring(-0.55), speed: spring(0), gait: 0, bend: spring(0),
    w: Object.fromEntries(OTHERS.map((n) => [n, spring(0)])),
    hy: spring(0), hp: spring(0), ht: spring(0), tiltTarget: 0, tiltUntil: 0, nextIdle: 4,
    happyUntil: -1, hop: -1, sx: spring(1), sy: spring(1), lift: spring(0), thinking: false,
    blinkT: -1, blinkLen: 0, slowBlink: false, nextBlink: 2, swish: 0, breath: 0, flick: 0,
    tailEl: Array.from({ length: TN }, () => spring(0.6)), tailAz: Array.from({ length: TN }, () => spring(0)),
  }
  addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.t = performance.now() / 1000; pointer.buttons = e.buttons; if (!running) render() }, { passive: true })

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

  function startWalk() {
    let tx = (rand() * 2 - 1) * DIM.roam
    if (Math.abs(tx - st.x) < 0.3) tx = st.x > 0 ? -DIM.roam * (0.5 + rand() * 0.5) : DIM.roam * (0.5 + rand() * 0.5)
    st.targetX = tx; st.mode = 'walk'
  }
  // 走一段 → 停下（站着看你 / 坐 / 揣手趴）→ 再走；等 AI 回答时一直摆 ai.thinkPose
  function think(t) {
    if (SHOW) return
    if (st.thinking) { st.mode = cfg.ai.thinkPose; st.until = t; return }
    if (st.happyUntil > t || t < st.until || st.mode === 'walk') return
    if (st.mode !== 'stand') { st.mode = 'stand'; st.until = t + range(BEH.pause); return }
    const next = pick(BEH.next.map((n) => [n, n.weight]))
    if (next.do === 'walk') startWalk()
    else { st.mode = next.do; st.until = t + range(next.hold) }
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
      if (Math.abs(dx) < 0.02) { st.mode = 'stand'; st.until = t + range(BEH.arrive) }
    } else {
      const facing = Math.cos(yaw) >= -0.05 ? 1 : -1
      const turn = happy ? BEH.poke.turn : (Object.hasOwn(POSE, mode) ? POSE[mode] : POSE.stand).turn
      wantYaw = facing > 0 ? -turn : -Math.PI + turn
    }
    if (SHOW && params.get('petyaw')) wantYaw = (+params.get('petyaw') * Math.PI) / 180
    const yawErr = wrapNear(wantYaw, yaw) - yaw
    step(st.yaw, yaw + yawErr, mode === 'walk' ? 2.4 : 1.8, dt)
    // 限住转速：转得比步子快，脚就只能在地上蹭
    if (Math.abs(st.yaw.v) > DIM.turnRate) { st.yaw.v = Math.sign(st.yaw.v) * DIM.turnRate; st.yaw.x = yaw + st.yaw.v * dt }
    step(st.speed, wantSpeed, 3, dt)
    const speed = Math.max(0, st.speed.x)
    if (!SHOW) st.x = clamp(st.x + Math.cos(st.yaw.x) * speed * dt, -DIM.roam - 0.1, DIM.roam + 0.1)
    else { st.odo[0] += Math.cos(st.yaw.x) * speed * dt; st.odo[1] -= Math.sin(st.yaw.x) * speed * dt }
    // 转身时原地踏步：步频跟着转速走，让前脚每一步扫过的弧长约等于一个步幅（0.45 ≈ 前脚到支点的距离）
    const stepping = Math.max(speed, Math.min(DIM.speed * 1.6, Math.abs(st.yaw.v) * 0.45))
    st.gait = (st.gait + (dt * stepping * DIM.duty) / DIM.stride) % 1
    const amp = clamp(stepping / DIM.speed)
    // 转身先转头和肩：脊柱往要去的方向弯，身子随后跟上；坐着、趴着不弯
    step(st.bend, clamp(yawErr * 0.4, -0.45, 0.45) * (1 - Math.max(0, ...SETTLED.map((n) => st.w[n].x))), 5, dt)
    const B = st.bend.x
    bendU.value = B

    // ---- 姿势权重
    const W = {}
    for (const n of OTHERS) W[n] = clamp(step(st.w[n], mode === n && !happy ? 1 : 0, POSE[n].blend, dt))
    const S = POSE.stand
    const mixP = (k) => OTHERS.reduce((v, n) => { const e = POSE[n].ease?.[k]; return v + (POSE[n][k] - S[k]) * (e ? EASE[e](W[n]) : W[n]) }, S[k])
    const mixDir = (k) => {
      const a = [0, 0]
      const wS = Math.max(0, OTHERS.reduce((v, n) => v - W[n], 1))
      for (const [p, w] of [[S, wS], ...OTHERS.map((n) => [POSE[n], W[n]])]) { a[0] += p[k][0] * w; a[1] += p[k][1] * w }
      const l = Math.hypot(a[0], a[1]) || 1
      return [a[0] / l, a[1] / l]
    }
    /** 权重过半的那个姿势（没有就是 stand）：呼吸、尾巴摆动快慢按它来 */
    const main = POSE[OTHERS.reduce((m, n) => (W[n] > 0.5 && (!m || W[n] > W[m]) ? n : m), null) ?? 'stand']
    /** 歇着的姿势（坐 / 趴）占多少：尾巴绕到身前 */
    const wrapW = Math.max(0, ...SETTLED.map((n) => W[n]))

    // ---- 躯干：呼吸、走路时的起伏和左右摇摆
    st.breath += dt * main.breath
    const ph = st.gait * TAU
    const bob = amp * 0.018 * (1 - Math.cos(ph * 2)) * 0.5
    const hipY = mixP('hip') - bob
    const pitch = mixP('pitch') + amp * 0.02 * Math.sin(ph * 2 + 0.6)
    // 根节点在髋关节，绕身子中点转：中点不动，髋跟着转半圈
    const cy = Math.cos(st.yaw.x), sy = Math.sin(st.yaw.x)
    const hipX = st.x - DIM.pivot * cy, hipZ = DIM.pivot * sy
    root.position.set(hipX, 0, hipZ)
    root.rotation.y = st.yaw.x
    // 根节点水平面坐标 ↔ 地面坐标（脚掌落地后按地面坐标钉住）
    const toW = (x, z) => [hipX + x * cy + z * sy + st.odo[0], hipZ - x * sy + z * cy + st.odo[1]]
    const toL = (wx, wz) => { const dx = wx - hipX - st.odo[0], dz = wz - hipZ - st.odo[1]; return [dx * cy - dz * sy, dx * sy + dz * cy] }
    body.position.set(0, hipY, amp * 0.015 * Math.sin(ph))
    body.rotation.set(amp * 0.04 * Math.sin(ph + 0.4), amp * 0.04 * Math.sin(ph), pitch)
    const br = 1 + 0.012 * Math.sin(st.breath)
    torso.scale.set(1, br, br)
    const cp = Math.cos(pitch), sp = Math.sin(pitch)
    const toRoot = (x, y) => [x * cp - y * sp, hipY + x * sp + y * cp]

    // ---- 腿：步态 → 脚掌位置 → 两段 IK → 沿平滑曲线重建整条腿
    // 每条腿在自己的“腿坐标”里算：后腿就是根节点坐标；前腿跟着脊柱侧弯，整体平移、转过肩部那一截的朝向
    // 迈步时着地的脚钉在地面上不动，抬起的脚落到“走到半步时正好在肩 / 髋下面”的位置（算上这半步里身子的平移和转动）
    const [shX, shY] = toRoot(...DIM.shoulder)
    const fm = mixDir('fm'), hm = mixDir('hm')
    const [sbx, sbz, phS] = bendAt(DIM.bend, B, DIM.shoulder[0], 0)
    const sdx = sbx - DIM.shoulder[0], cS = Math.cos(phS), sS = Math.sin(phS)
    const halfStance = DIM.stride / (2 * Math.max(stepping, 1e-3))
    const dTh = clamp(st.yaw.v * halfStance, -0.4, 0.4), adv = speed * halfStance
    const planted = smooth(0, 0.3, amp) // 不迈步时脚回到姿势规定的位置（坐下、趴下要收腿）
    for (const L of legs) {
      const front = L.type === 'front'
      const fr = front ? (x, z) => [shX + sdx + (x - shX) * cS + z * sS, sbz - (x - shX) * sS + z * cS] : (x, z) => [x, z]
      const toF = front ? (x, z) => { const dx = x - shX - sdx, dz = z - sbz; return [shX + dx * cS - dz * sS, dx * sS + dz * cS] } : (x, z) => [x, z]
      const frameYaw = st.yaw.x + (front ? phS : 0)
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
      const z = L.side * L.d.z * mixP('lz')
      const idealX = restX + off * amp + 0.03
      // 落点：支点在腿坐标里的位置，绕它把“肩 / 髋正下方”转过半步的角度，再往前挪半步的位移
      const [pvx, pvz] = toF(DIM.pivot, 0), rx = restX + 0.03 - pvx, rz = z - pvz
      const tc = Math.cos(dTh), ts = Math.sin(dTh)
      const tgx = pvx + rx * tc + rz * ts + adv, tgz = pvz - rx * ts + rz * tc
      if (!L.plant) L.plant = [...toW(...fr(idealX, z)), frameYaw]
      let fx, fz, fyaw
      if (p < DIM.duty) {
        ;[fx, fz] = toF(...toL(L.plant[0], L.plant[1]))
        fyaw = wrapNear(L.plant[2] - frameYaw, 0)
        L.stance = true
      } else {
        if (L.stance || !L.lift) L.lift = L.plant.slice()
        L.stance = false
        const e = smooth(0, 1, (p - DIM.duty) / (1 - DIM.duty))
        const [lx, lz] = toF(...toL(L.lift[0], L.lift[1]))
        fx = lerp(lx, tgx, e); fz = lerp(lz, tgz, e)
        fyaw = lerp(wrapNear(L.lift[2] - frameYaw, 0), dTh, e)
      }
      const pawX = lerp(idealX, fx, planted), pawZ = lerp(z, fz, planted), pawYaw = fyaw * planted
      L.plant = [...toW(...fr(pawX, pawZ)), frameYaw + pawYaw]
      const pawY = 0.06 + lift * amp
      const md = front ? fm : hm
      const ca = curl * amp * (front ? 0.8 : 0.5), cc = Math.cos(ca), cs = Math.sin(ca)
      const mdx = md[0] * cc - md[1] * cs, mdy = md[0] * cs + md[1] * cc
      const wx = pawX + mdx * L.d.meta, wy = pawY + mdy * L.d.meta
      const [kx, ky] = ik(jx, jy, wx, wy, L.d.L[0], L.d.L[1], front ? -1 : 1)
      // 腿根锚点沿大腿方向往身体里延长：关节处不拐急弯，管子不会自相交出尖角；脚掌落在侧面时，膝和腕按比例往那边偏
      const ctrl = [[jx - (kx - jx) * 0.7, jy - (ky - jy) * 0.7, z * 0.55], [jx, jy, z * 0.9], [kx, ky, lerp(z, pawZ, 0.5)], [wx, wy, lerp(z, pawZ, 0.9)], [pawX, pawY, pawZ]]
        .map(([x, y, cz]) => { const [rx2, rz2] = fr(x, cz); return V(rx2, y, rz2) })
      curve(ctrl, LEG_RINGS, legPts)
      for (let i = 0; i < LEG_RINGS; i++) {
        const f = (i / (LEG_RINGS - 1)) * 4, s = Math.min(3, Math.floor(f))
        legR[i] = lerp(L.d.r[s], L.d.r[s + 1], f - s)
      }
      L.t.write(legPts, legR)
      const [ppx, ppz] = fr(pawX + 0.025, pawZ)
      L.paw.position.set(ppx, pawY - 0.01, ppz)
      L.paw.rotation.set(0, frameYaw - st.yaw.x + pawYaw, ca * 0.8)
    }

    // ---- 头：看鼠标 / 看镜头 / 随便张望；抵消躯干俯仰，头始终正着；跟着脊柱侧弯挪到弯过去的位置
    const [hbx, hbz] = bendAt(DIM.bend, B, DIM.head[0], 0)
    headBase.rotation.set(0, B, -pitch, 'ZYX')
    headBase.position.set(hbx, DIM.head[1] + bob * 0.7, hbz)
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
    // 转身时先看要去的方向
    const turning = smooth(0.1, 0.5, Math.abs(yawErr))
    wantHY = lerp(wantHY, clamp(yawErr, -1.1, 1.1), turning)
    wantHP *= 1 - turning
    if (!SHOW && t > st.nextIdle) {
      const act = pick(Object.entries(BEH.idle.weights))
      if (act === 'tilt') { st.tiltTarget = (rand() < 0.5 ? -1 : 1) * range(BEH.idle.tiltAngle); st.tiltUntil = t + range(BEH.idle.tiltHold) }
      else if (act === 'ear') ears[rand() < 0.5 ? 0 : 1].flick = 0
      else st.flick = 1
      st.nextIdle = t + range(BEH.idle.every)
    }
    if (t > st.tiltUntil) st.tiltTarget = 0
    if (st.thinking) st.tiltTarget = (Math.sin(t * 0.9) > 0 ? 1 : -1) * 0.16 // 想事情：约 3.5 秒换一边歪头
    step(st.hy, wantHY, 4.5, dt)
    // 脸始终朝镜头一侧、至少露出四分之三：头的朝向角限在 [-π, 0]（这一半朝着镜头）往里收 0.6 弧度；
    // 镜头是俯视的，正侧面看过去基本只剩后脑勺。身子转得快时弹簧跟不上，所以限在弹簧之后
    {
      const w = st.yaw.x + st.hy.x, w2 = wrapNear(w, -Math.PI / 2), c = clamp(w2, -Math.PI + 0.6, -0.6)
      if (c !== w2) { st.hy.x = c - (w2 - w) - st.yaw.x; st.hy.v = 0 }
    }
    step(st.hp, wantHP, 4.5, dt)
    step(st.ht, st.tiltTarget + (happy ? 0.16 : 0), 3.2, dt)
    head.rotation.set(st.hp.x, Math.PI / 2 + st.hy.x - B, -st.ht.x) // hy 是相对身子的转角，headBase 已经转过 B

    // ---- 耳朵、眨眼
    for (const e of ears) {
      let f = 0
      if (e.flick >= 0) { e.flick += dt; f = Math.sin(clamp(e.flick / 0.24) * Math.PI) * 0.35; if (e.flick > 0.24) e.flick = -1 }
      e.g.rotation.set(-f * 0.6, -0.2 * e.s, -0.36 * e.s - f * e.s * 0.5)
    }
    let lid = OTHERS.reduce((v, n) => v - W[n] * (1 - (POSE[n].eyes ?? 1)), 1)
    if (!SHOW) {
      if (st.blinkT < 0 && t > st.nextBlink) { st.blinkT = 0; st.slowBlink = rand() < BEH.blink.slowChance; st.blinkLen = st.slowBlink ? BEH.blink.slow : BEH.blink.fast }
      if (st.blinkT >= 0) {
        st.blinkT += dt
        const p = st.blinkT / st.blinkLen
        const k = st.slowBlink ? 1 - 0.9 * (p < 0.3 ? smooth(0, 0.3, p) : p < 0.7 ? 1 : 1 - smooth(0.7, 1, p)) : 1 - Math.sin(clamp(p) * Math.PI) * 0.92
        lid = Math.min(lid, k)
        if (p >= 1) { st.blinkT = -1; st.nextBlink = t + range(BEH.blink.every) }
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
    st.swish += dt * main.swish
    st.flick = Math.max(0, st.flick - dt * 1.6)
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
    const cx = st.x, cz = 0
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
    // 指针不动、猫自己走到它下面或走开时也要更新，否则按下和松开落在不同元素上，第一下点击就丢了；
    // 按着键（正在拖选文字）时不切换，免得拖到一半终点落到画布上
    if (pointer.t >= 0 && !pointer.buttons && !document.hidden) canvas.classList.toggle('hot', overCat(pointer.x, pointer.y))
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
  function say(text, seconds = BEH.talk.show) {
    if (!text) {
      let i
      do i = Math.floor(rand() * LINES.random.length)
      while (i === lastLine && LINES.random.length > 1)
      lastLine = i
      text = LINES.random[i]
    }
    bubble.textContent = text
    bubble.classList.add('on')
    clearTimeout(bubbleTimer)
    bubbleTimer = setTimeout(() => bubble.classList.remove('on'), seconds * 1000)
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
  function poke(talk = true) {
    // 停下、转头看你、跳一下
    st.happyUntil = simT + BEH.poke.happy
    if (st.mode === 'walk') st.mode = 'stand'
    st.until = Math.max(st.until, st.happyUntil + 1)
    if (st.hop < 0) st.hop = 0
    hearts()
    if (talk) say(rand() < BEH.poke.lineChance ? LINES.poke : '')
    if (!raf) { clock.getDelta(); raf = requestAnimationFrame(function tick() { render(); raf = st.hop >= 0 || running ? requestAnimationFrame(tick) : 0 }) }
  }
  canvas.addEventListener('click', () => poke())
  canvas.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke() } })

  // 指针在不在猫身上：猫的屏幕包围盒外扩 HIT_PAD。鼠标靠 pointermove 和每帧渲染后判定（见 render）；
  // 触屏没有悬停，在 pointerdown 的捕获阶段判定，随后的 click 会重新命中测试，落到画布或下面的页面
  const HIT_PAD = 4
  /** 躯干中线上的三个点（body 坐标），各自外扩 0.4 盖住豆子形的身子（截面半径最大 0.36） */
  const BODY_PTS = [[-0.3, 0.1], [0.35, 0.08], [0.9, 0.11]].map(([x, y]) => new THREE.Vector3(x, y, 0))
  const hv = new THREE.Vector3(), hp = new THREE.Vector3()
  /** 用每帧现成的点（头、躯干、四只脚掌、尾巴各节）各外扩一个半径再投影：不遍历顶点；rig 的矩阵里已经带着跳起和压扁 */
  function catRect() {
    const r = canvas.getBoundingClientRect()
    const out = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
    const add = (p, pad) => {
      for (let i = 0; i < 4; i++) {
        hv.set(p.x + (i & 1 ? pad : -pad), p.y + (i & 2 ? pad : -pad), p.z).project(camera)
        const x = r.left + ((hv.x + 1) / 2) * r.width, y = r.top + ((1 - hv.y) / 2) * r.height
        out.left = Math.min(out.left, x); out.right = Math.max(out.right, x); out.top = Math.min(out.top, y); out.bottom = Math.max(out.bottom, y)
      }
    }
    // 头：半径约 0.48（缩放后），耳尖比头心高 0.56，所以中心上移 0.1、外扩 0.6
    hp.setFromMatrixPosition(head.matrixWorld)
    add(hp.setY(hp.y + 0.1), 0.6)
    for (const b of BODY_PTS) add(hp.copy(b).applyMatrix4(body.matrixWorld), 0.4)
    for (const L of legs) add(hp.setFromMatrixPosition(L.paw.matrixWorld), 0.14)
    for (const t of tailPts) add(hp.copy(t).applyMatrix4(rig.matrixWorld), 0.1)
    return out
  }
  function overCat(x, y) {
    if (wrap.hidden) return false
    const b = wrap.getBoundingClientRect()
    if (x < b.left || x > b.right || y < b.top || y > b.bottom) return false
    const r = catRect()
    return x >= r.left - HIT_PAD && x <= r.right + HIT_PAD && y >= r.top - HIT_PAD && y <= r.bottom + HIT_PAD
  }
  const aim = (e) => {
    pointer.buttons = e.buttons
    if (e.type === 'pointerdown' || !e.buttons) canvas.classList.toggle('hot', overCat(e.clientX, e.clientY))
  }
  addEventListener('pointermove', aim, { passive: true })
  document.addEventListener('pointerdown', aim, { capture: true, passive: true })
  for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, (e) => { pointer.buttons = e.buttons }, { capture: true, passive: true })
  debug.catRect = catRect
  debug.thinking = () => st.thinking

  // 随机说话：进场后打个招呼，之后每隔 behavior.talk.every 说一句
  let talkTimer = 0
  function scheduleTalk(delay) {
    clearTimeout(talkTimer)
    talkTimer = setTimeout(() => { if (!wrap.hidden && !document.hidden && !st.thinking) say(); scheduleTalk(range(BEH.talk.every) * 1000) }, delay)
  }

  const hiddenListeners = new Set()
  function setHidden(hidden, persist = true) {
    wrap.hidden = hidden
    close.hidden = hidden || SHOW
    open.hidden = !hidden
    if (persist) try { localStorage.setItem(STORAGE_KEY, hidden ? '1' : '') } catch {}
    if (hidden) { clearTimeout(talkTimer); bubble.classList.remove('on') } else if (!SHOW) scheduleTalk(BEH.talk.reopenAfter * 1000)
    play()
    hiddenListeners.forEach((cb) => cb(hidden))
  }
  close.addEventListener('click', () => { setHidden(true); open.focus() })
  open.addEventListener('click', () => { setHidden(false); say(LINES.back); canvas.focus() })

  let stored = ''
  try { stored = localStorage.getItem(STORAGE_KEY) || '' } catch {}
  if (SHOW) stored = ''
  const startHidden = stored === '1' || (!SHOW && getComputedStyle(wrap).getPropertyValue('--pet-start').trim() === 'hidden')
  // 先把弹簧、尾巴和腿稳定下来，避免第一帧从零位置弹过来
  if (SHOW && SHOW_POSE === 'walk') st.gait = +(params.get('petgait') || 0.15)
  for (let i = 0; i < 120; i++) { simT += 1 / 60; sim(simT, 1 / 60) }
  setHidden(startHidden, false)
  debug.ready = true
  if (!startHidden && !SHOW) {
    clearTimeout(talkTimer)
    setTimeout(() => st.thinking || say(LINES.greet), BEH.talk.greetAfter * 1000)
    scheduleTalk((BEH.talk.greetAfter + BEH.talk.firstAfterGreet) * 1000)
  }
  if (SHOW) return

  /** 给 pet-ai.js 用的接口 */
  /** 谁在让猫想事情（对话、编辑器各算一个）：都结束了才起身 */
  const thinkers = new Set()
  function setThinking(on, who = 'ai') {
    if (on) thinkers.add(who)
    else thinkers.delete(who)
    const was = st.thinking
    st.thinking = thinkers.size > 0
    if (was && !st.thinking) st.until = simT // 下一拍起身，接着按 behavior 走
  }
  function act(name) {
    if (name === 'hop') poke(false)
    else if (name === 'walk') startWalk()
    else if (OTHERS.includes(name)) { st.mode = name; st.until = simT + ACT_HOLD }
  }
  const api = (window.pairwisePet = {
    say: (text, seconds) => text && say(text, seconds),
    setThinking,
    act,
    actions: () => [...OTHERS.map((n) => ({ name: n, label: POSE[n].label ?? n })), ...RESERVED.map((n) => ({ name: n, label: MOVES[n] }))],
    rect: () => wrap.getBoundingClientRect(),
    isHidden: () => wrap.hidden,
    onHiddenChange: (cb) => { hiddenListeners.add(cb); return () => hiddenListeners.delete(cb) },
  })
  if (cfg.ai) import(sibling('pet-ai.js').href).then((m) => m.init(api, cfg)).catch((e) => console.warn('[pet] pet-ai.js 加载失败，没有 AI 对话', e))
}

// three.js 解析 + 首帧编译 shader 是一个 100ms 级的长任务，必须等入场动画（约 2s）播完、浏览器空闲时再加载，否则入场会卡一下
// 挂上页面之后才出错（比如 pet.json 里尺寸写错）：把已经放上去的画布、按钮（含自己建的叫回按钮、对话按钮和面板）拿掉，别在角落留个空壳
const run = () => start().catch((e) => {
  debug.errors.push(String((e && e.stack) || e))
  console.error('[pet]', e)
  document.querySelectorAll('.joy-pet, .joy-pet-close, .joy-pet-open, .joy-ai').forEach((n) => n.remove())
})
const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1))
const later = () => (SHOW ? run() : setTimeout(() => idle(run, { timeout: 2000 }), 2400))
if (document.readyState === 'complete') later()
else addEventListener('load', later, { once: true })
