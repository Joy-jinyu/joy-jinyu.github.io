/**
 * NSH 页面的宿主模块（nsh.json web.host）：只做转发。
 * 真正的实现在父页面 /blog/editor/ 挂的 window.pairwiseEditorHost（blog/src/lib/editor-host/），
 * token 和 AI key 都留在父页面，不进应用。协议见 blog/src/lib/editor-host/contract.ts。
 */
export async function createHost(player) {
  let bridge
  try {
    bridge = window.parent !== window ? window.parent.pairwiseEditorHost : undefined
  } catch {
    bridge = undefined
  }
  if (!bridge) throw new Error('投稿编辑器需要从 /blog/editor/ 打开')
  return bridge.attach(player)
}
