/**
 * 投稿编辑器的 GitHub 部分：经 Cloudflare Worker（sveltia-cms-auth，pairwise-cms-auth）弹窗登录拿 token，
 * 再用 GitHub REST API 走 fork → 建分支 → 写文件 → 提 PR。token 只放在这个页面的内存里。
 * 稿件的路径和 frontmatter 要过 .github/scripts/check-contrib.mjs 的守门规则，改字段要两边一起改。
 */
import { bodyBytes, LIMITS, type Draft, type Login, type MyPr, type SubmitStep, type Submitted } from '../../../editor-app/host-contract'

const AUTH_WORKER = 'https://pairwise-cms-auth.1825326327.workers.dev'
const UPSTREAM = 'Joy-jinyu/joy-jinyu.github.io'
const BASE = 'master'
const DIR = 'blog/src/content/posts/contrib'
const API = 'https://api.github.com'
/** Worker 弹窗与本页的消息协议（Worker 源码 outputHTML） */
const HANDSHAKE = 'authorizing:github'
const RESULT = /^authorization:github:(success|error):(.*)$/s

type Session = { token: string; user: NonNullable<Login> }
let session: Session | null = null

export const currentLogin = (): Login => session?.user ?? null

/** 登录失效（GitHub 返回 401）的错误：宿主据此通知应用回到未登录 */
export const isAuthError = (err: unknown) => (err as { status?: number })?.status === 401

export function logout() {
  session = null
}

/** 打开 Worker 的登录弹窗，等它把 token 送回来 */
function requestToken(): Promise<string> {
  const url = `${AUTH_WORKER}/auth?${new URLSearchParams({ provider: 'github', site_id: location.hostname, scope: 'public_repo' })}`
  const popup = open(url, 'pairwise-github-login', 'width=600,height=720')
  if (!popup) return Promise.reject(new Error('登录窗口被浏览器拦住了，请允许本站弹出窗口后再试'))
  const workerOrigin = new URL(AUTH_WORKER).origin
  return new Promise((resolve, reject) => {
    const done = (fn: () => void) => {
      removeEventListener('message', onMessage)
      clearInterval(watch)
      fn()
    }
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== workerOrigin || e.source !== popup || typeof e.data !== 'string') return
      if (e.data === HANDSHAKE) return (e.source as Window | null)?.postMessage(HANDSHAKE, e.origin)
      const m = RESULT.exec(e.data)
      if (!m) return
      let payload: { token?: string; error?: string } = {}
      try {
        payload = JSON.parse(m[2])
      } catch {
        // 格式不对时按失败处理
      }
      popup.close()
      if (m[1] === 'success' && payload.token) done(() => resolve(payload.token!))
      else done(() => reject(new Error(`GitHub 登录失败${payload.error ? `：${payload.error}` : ''}`)))
    }
    const watch = setInterval(() => {
      if (popup.closed) done(() => reject(new Error('登录窗口已关闭，没有完成登录')))
    }, 500)
    addEventListener('message', onMessage)
  })
}

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...init.headers },
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401) logout()
    throw Object.assign(new Error(`GitHub 返回 ${res.status}${data?.message ? `：${data.message}` : ''}`), { status: res.status })
  }
  return data as T
}

export async function login(): Promise<Login> {
  const token = await requestToken()
  const u = await gh<{ login: string; avatar_url: string }>(token, '/user')
  session = { token, user: { login: u.login, avatarUrl: u.avatar_url } }
  return session.user
}

function need(): Session {
  if (!session) throw new Error('登录已失效，请重新登录')
  return session
}

/** 文件名只能是小写字母、数字和连字符（守门规则），所以用日期 + 随机串，不用标题 */
function newSlug(): string {
  const rand = [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${new Date().toISOString().slice(0, 10)}-${rand}`
}

/** JSON 字符串本身就是合法的 YAML 双引号字符串，转义交给它 */
function toMarkdown(draft: Draft, author: string): string {
  const fm = [
    `title: ${JSON.stringify(draft.title)}`,
    `description: ${JSON.stringify(draft.description)}`,
    `date: ${new Date().toISOString().slice(0, 10)}`,
    `tags: ${JSON.stringify(draft.tags)}`,
    'column: contrib',
    // 加引号：用户名叫 null、true 或纯数字时，不加引号会被 YAML 解析成别的类型
    `author: ${JSON.stringify(author)}`,
  ]
  return `---\n${fm.join('\n')}\n---\n\n${draft.body.trim()}\n`
}

function check(draft: Draft) {
  const title = draft.title.trim()
  const description = draft.description.trim()
  if (!title || title.length > LIMITS.title) throw new Error(`标题要写，最多 ${LIMITS.title} 字`)
  if (!description || description.length > LIMITS.description) throw new Error(`摘要要写，最多 ${LIMITS.description} 字`)
  if (!draft.body.trim()) throw new Error('正文还是空的')
  if (bodyBytes(draft.body) > LIMITS.bodyBytes) throw new Error(`正文太长了，最多约 ${Math.floor(LIMITS.bodyBytes / 1024)} KB`)
  if (draft.tags.length > LIMITS.tags || draft.tags.some((t) => !t.trim() || t.length > LIMITS.tag)) {
    throw new Error(`标签最多 ${LIMITS.tags} 个，每个最多 ${LIMITS.tag} 字`)
  }
  return { ...draft, title, description, tags: draft.tags.map((t) => t.trim()) }
}

const toBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 有写权限就在原仓库建分支；否则用（或新建）访客的 fork。fork 是异步建的，等它的默认分支出现 */
async function prepareRepo(token: string): Promise<{ repo: string; sha: string; viaFork: boolean }> {
  const upstream = await gh<{ permissions?: { push?: boolean } }>(token, `/repos/${UPSTREAM}`)
  if (upstream.permissions?.push) {
    const ref = await gh<{ object: { sha: string } }>(token, `/repos/${UPSTREAM}/git/ref/heads/${BASE}`)
    return { repo: UPSTREAM, sha: ref.object.sha, viaFork: false }
  }
  const fork = await gh<{ full_name: string; default_branch: string }>(token, `/repos/${UPSTREAM}/forks`, {
    method: 'POST',
    body: JSON.stringify({ default_branch_only: true }),
  })
  for (let i = 0; i < 30; i++) {
    try {
      const ref = await gh<{ object: { sha: string } }>(token, `/repos/${fork.full_name}/git/ref/heads/${fork.default_branch}`)
      // fork 的默认分支上有访客自己的提交时，从它切出的分支会把这些提交一起带进 PR，过不了守门检查
      const owner = fork.full_name.split('/')[0]
      const diff = await gh<{ ahead_by: number }>(token, `/repos/${UPSTREAM}/compare/${BASE}...${owner}:${fork.default_branch}`)
      if (diff.ahead_by > 0) {
        throw new Error(`你的 fork（${fork.full_name}）的 ${fork.default_branch} 分支上有 ${diff.ahead_by} 个本站没有的提交，先在 GitHub 上把它和本站同步（或撤掉这些提交）再投稿`)
      }
      return { repo: fork.full_name, sha: ref.object.sha, viaFork: true }
    } catch (err) {
      if ((err as { status?: number }).status !== 404 && (err as { status?: number }).status !== 409) throw err
      await sleep(2000)
    }
  }
  throw new Error('fork 还没准备好，过一会儿再提交')
}

/**
 * 不同步 fork：新分支直接从 fork 的默认分支切出来，PR 只多出投稿这一个文件。
 * 这样即使上游改过 .github/workflows（同步要 workflow 权限）也不受影响。
 */
/** 上一次没提交成功的稿件：同一篇重试时沿用同一个分支，不重复开分支、不重复提 PR */
let attempt: { key: string; slug: string } | null = null

const status = (err: unknown) => (err as { status?: number }).status

/** 已存在就当成功：重试时上一次可能已经做完了这一步 */
async function unlessExists<T>(fn: () => Promise<T>, onExists: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (status(err) === 422) return onExists()
    throw err
  }
}

export async function submit(raw: Draft, progress: (step: SubmitStep, state: 'active' | 'done') => void): Promise<Submitted> {
  const { token, user } = need()
  const draft = check(raw)
  const key = JSON.stringify([user.login, draft])
  if (attempt?.key !== key) attempt = { key, slug: newSlug() }
  const { slug } = attempt
  const branch = `contrib/${slug}`
  const path = `${DIR}/${slug}.md`

  progress('fork', 'active')
  const { repo, sha, viaFork } = await prepareRepo(token)
  progress('fork', 'done')

  progress('branch', 'active')
  await unlessExists(
    () => gh(token, `/repos/${repo}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }) }),
    async () => null,
  )
  progress('branch', 'done')

  progress('commit', 'active')
  const put = (fileSha?: string) =>
    gh(token, `/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({ message: `docs(blog): 投稿《${draft.title}》`, content: toBase64(toMarkdown(draft, user.login)), branch, sha: fileSha }),
    })
  await unlessExists(put, async () => {
    const existing = await gh<{ sha: string }>(token, `/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`)
    return put(existing.sha)
  })
  progress('commit', 'done')

  progress('pr', 'active')
  const head = viaFork ? `${repo.split('/')[0]}:${branch}` : branch
  type Pr = { number: number; html_url: string }
  const pr = await unlessExists(
    () =>
      gh<Pr>(token, `/repos/${UPSTREAM}/pulls`, {
        method: 'POST',
        body: JSON.stringify({
          title: `投稿：${draft.title}`,
          head,
          base: BASE,
          body: `读者投稿，来自站内编辑器。\n\n> ${draft.description}\n\n作者：@${user.login}`,
          maintainer_can_modify: true,
        }),
      }),
    async () => {
      const owner = viaFork ? repo.split('/')[0] : UPSTREAM.split('/')[0]
      const [found] = await gh<Pr[]>(token, `/repos/${UPSTREAM}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`)
      if (!found) throw new Error('GitHub 拒绝创建 PR，可以稍后在「我的投稿」里看看是否已经提交')
      return found
    },
  )
  progress('pr', 'done')
  attempt = null
  return { prNumber: pr.number, prUrl: pr.html_url, path }
}

const TITLE_PREFIX = '投稿：'

type PullItem = { number: number; title: string; html_url: string; state: 'open' | 'closed'; merged_at: string | null; updated_at: string; user: { login: string }; head: { ref: string } }
type SearchItem = { number: number; title: string; html_url: string; state: 'open' | 'closed'; updated_at: string; pull_request?: { merged_at: string | null } }

/**
 * 最近 100 个 PR 里取自己的（刚提交的也在，搜索索引会晚几十秒），
 * 再用搜索补上更早的；两边按编号去重。
 */
export async function mine(): Promise<MyPr[]> {
  const { token, user } = need()
  const q = encodeURIComponent(`repo:${UPSTREAM} is:pr author:${user.login} "${TITLE_PREFIX}" in:title`)
  const [pulls, search] = await Promise.all([
    gh<PullItem[]>(token, `/repos/${UPSTREAM}/pulls?state=all&per_page=100&sort=updated&direction=desc`),
    gh<{ items: SearchItem[] }>(token, `/search/issues?q=${q}&sort=updated&order=desc&per_page=100`),
  ])
  const byNumber = new Map<number, MyPr>()
  for (const p of pulls) {
    if (p.user.login.toLowerCase() !== user.login.toLowerCase() || !p.head.ref.startsWith('contrib/')) continue
    byNumber.set(p.number, { number: p.number, title: p.title.replace(TITLE_PREFIX, ''), url: p.html_url, state: p.merged_at ? 'merged' : p.state, updatedAt: p.updated_at })
  }
  for (const i of search.items) {
    if (byNumber.has(i.number) || !i.title.startsWith(TITLE_PREFIX)) continue
    byNumber.set(i.number, { number: i.number, title: i.title.replace(TITLE_PREFIX, ''), url: i.html_url, state: i.pull_request?.merged_at ? 'merged' : i.state, updatedAt: i.updated_at })
  }
  return [...byNumber.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
