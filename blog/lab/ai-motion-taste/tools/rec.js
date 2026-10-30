// 页面内逐帧采样：rec(fn, ms) 每帧调用 fn() 记录一个对象，返回 Promise<数组>
window.__rec = (fn, ms) => new Promise((res) => {
  const t0 = performance.now(); const out = []
  const tick = () => { const t = performance.now() - t0; out.push({ t: Math.round(t * 10) / 10, ...fn() }); if (t < ms) requestAnimationFrame(tick); else res(out) }
  requestAnimationFrame(tick)
})
window.__sleep = (ms) => new Promise((r) => setTimeout(r, ms))
