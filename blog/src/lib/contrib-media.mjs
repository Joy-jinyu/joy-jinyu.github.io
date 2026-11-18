/**
 * 读者投稿图片的规则：浏览器里的宿主（lib/editor-host/media.ts，存图、清洗 AI 画的 SVG）和
 * PR 守门（.github/scripts/check-contrib.mjs，校验 PR 里的图片文件）共用这一份，改规则只改这里。
 * SVG 发布在本站同源地址下，直接打开会执行里面的脚本，所以只放行白名单里的元素和属性。
 */

/** 仓库里的位置和文件名：<内容 sha256 的前 16 位>.<扩展名> */
export const MEDIA_DIR = 'blog/public/contrib-images'
export const MEDIA_FILE = /^[0-9a-f]{16}\.(png|jpg|webp|gif|svg)$/
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
export const MAX_SVG_BYTES = 200 * 1024
/** 元素和 <use> 的上限：<use> 层层引用能把很小的文件放大成极慢的渲染 */
export const MAX_SVG_ELEMENTS = 3000
export const MAX_SVG_USE = 30

/** 按文件头认格式，不信扩展名和 MIME；认不出返回 null */
export function sniffImage(bytes) {
  const b = bytes
  const at = (i, ...xs) => xs.every((x, k) => b[i + k] === x)
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png'
  if (at(0, 0xff, 0xd8, 0xff)) return 'jpg'
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'gif'
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'webp'
  return null
}

const ELEMENTS = new Set([
  'svg', 'g', 'defs', 'title', 'desc', 'symbol', 'use',
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan',
  'linearGradient', 'radialGradient', 'stop', 'pattern', 'clipPath', 'mask', 'marker',
])

const ATTRS = new Set([
  'xmlns', 'xmlns:xlink', 'version', 'id', 'class', 'role', 'aria-label', 'aria-hidden',
  'viewBox', 'preserveAspectRatio', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'd', 'points', 'dx', 'dy', 'transform',
  'fill', 'fill-opacity', 'fill-rule', 'clip-rule', 'stroke', 'stroke-width', 'stroke-opacity',
  'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit',
  'opacity', 'visibility', 'display', 'vector-effect', 'shape-rendering', 'text-rendering', 'paint-order',
  'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline',
  'alignment-baseline', 'letter-spacing', 'word-spacing', 'text-decoration',
  'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'spreadMethod',
  'patternUnits', 'patternContentUnits', 'patternTransform', 'clipPathUnits', 'maskUnits', 'maskContentUnits',
  'markerWidth', 'markerHeight', 'markerUnits', 'refX', 'refY', 'orient',
  'marker-start', 'marker-mid', 'marker-end', 'clip-path', 'mask',
  'href', 'xlink:href',
])

/** 只许引用文件内部的 #id；url() 同理 */
const LOCAL_REF = /^#[A-Za-z_][\w.-]*$/
const URL_FN = /url\s*\(([^)]*)\)/gi

export const allowedElement = (name) => ELEMENTS.has(name)

export function allowedAttr(name, value) {
  if (!ATTRS.has(name)) return false
  const v = String(value)
  // 反斜杠是 CSS 转义（u\72 l( 会被浏览器读成 url(），控制字符会被浏览器忽略后拼出别的词：都不收
  if (/[\\\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)) return false
  if (name === 'href' || name === 'xlink:href') return LOCAL_REF.test(v.trim())
  for (const m of v.matchAll(URL_FN)) {
    if (!LOCAL_REF.test(m[1].trim().replace(/^['"]|['"]$/g, ''))) return false
  }
  return !/javascript:|data:|vbscript:|expression\s*\(/i.test(v)
}
