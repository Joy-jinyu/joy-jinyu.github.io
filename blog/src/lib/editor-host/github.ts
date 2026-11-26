/**
 * 投稿编辑器的 GitHub 部分：经 Cloudflare Worker（sveltia-cms-auth，pairwise-cms-auth）弹窗登录拿 token，
 * 再用 GitHub REST API 走 fork → 建分支 → 写文件（稿件 + 图片）→ 提 PR。
 * 登录存在本机 7 天；GitHub 的 token 8 小时过期，用刷新令牌经 Worker 续期。
 * 稿件和图片的路径、frontmatter 要过 .github/scripts/check-contrib.mjs 的守门规则，改字段要两边一起改。
 */
import { bodyBytes, LIMITS, MEDIA_PREFIX, type Draft, type Login, type MyPr, type SubmitStep, type Submitted } from './contract'
import { MEDIA_DIR } from '../contrib-media.mjs'
import { bytesOf, toBase64 } from './media'

const AUTH_WORKER = 'https://pairwise-cms-auth.1825326327.workers.dev'
const UPSTREAM = 'Joy-jinyu/joy-jinyu.github.io'
const BASE = 'master'
const DIR = 'blog/src/content/posts/contrib'
const API = 'https://api.github.com'
/** Worker 弹窗与本页的消息协议（Worker 源码 outputHTML） */
const HANDSHAKE = 'authorizing:github'
const RESULT = /^authorization:github:(success|error):(.*)$/s
const KEY = 'pairwise-github'
const KEEP_MS = 7 * 24 * 3600 * 1000

type Session = { token: string; refreshToken?: string; user: NonNullable<Login>; signedInAt: number }
let session: Session | null = restore()

function restore(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Session | null
    if (s?.token && s.user?.login && Date.now() - s.signedInAt < KEEP_MS) return s
    localStorage.removeItem(KEY)
  } catch {
    // 存储不可用或内容坏了：当作没登录
  }
  return null
}

function persist(next: Session | null) {
  session = next
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    // 存不进去只影响下次要不要重新登录
  }
}

// 别的标签页登录、退出或续期了：跟着更新，免得这里用旧 token 把它们的结果写回去
addEventListener('storage', (e) => {
  if (e.key === KEY) session = restore()
})

export const currentLogin = (): Login => session?.user ?? null

/** 登录失效（GitHub 返回 401 且续期也失败）的错误：宿主据此通知应用回到未登录 */
export const isAuthError = (err: unknown) => (err as { status?: number })?.status === 401

export function logout() {
  persist(null)
}

/** 打开 Worker 的登录弹窗，等它把 token 送回来 */
function requestToken(): Promise<{ token: string; refreshToken?: string }> {
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
      if (e.data === HANDSHAKE) return popup.postMessage(HANDSHAKE, e.origin)
      const m = RESULT.exec(e.data)
      if (!m) return
      let payload: { token?: string; refreshToken?: string; error?: string } = {}
      try {
        payload = JSON.parse(m[2])
      } catch {
        // 格式不对时按失败处理
      }
      popup.close()
      if (m[1] === 'success' && payload.token) done(() => resolve({ token: payload.token!, refreshToken: payload.refreshToken }))
      else done(() => reject(new Error(`GitHub 登录失败${payload.error ? `：${payload.error}` : ''}`)))
    }
    const watch = setInterval(() => {
      if (popup.closed) done(() => reject(new Error('登录窗口已关闭，没有完成登录')))
    }, 500)
    addEventListener('message', onMessage)
  })
}

/**
 * 用刷新令牌换新 token（Worker 的 /auth POST，代我们带上 client secret）。
 * GitHub 的刷新令牌只能用一次：并发的几个请求同时遇到 401 时只续一次，其余等同一个结果。
 */
let refreshing: Promise<boolean> | null = null
function refresh(failed: string): Promise<boolean> {
  refreshing ??= withRefreshLock(failed).finally(() => (refreshing = null))
  return refreshing
}

/** 多个标签页也只让一个去续：拿到锁后先看看别的标签页是不是已经续好了 */
async function withRefreshLock(failed: string): Promise<boolean> {
  const run = async () => {
    session = restore()
    if (session && session.token !== failed) return true
    return doRefresh()
  }
  return navigator.locks ? navigator.locks.request('pairwise-github-refresh', run) : run()
}

async function doRefresh(): Promise<boolean> {
  const before = session
  if (!before?.refreshToken) return false
  try {
    const res = await fetch(`${AUTH_WORKER}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: before.refreshToken }),
    })
    const data = await res.json().catch(() => null)
    // 等结果的时候别的标签页退出或续好了：以那边为准，这次的结果不要了
    if (session !== before) return !!session && session.token !== before.token
    if (!res.ok || !data?.access_token) return false
    persist({ ...before, token: data.access_token, refreshToken: data.refresh_token ?? before.refreshToken })
    return true
  } catch {
    return false
  }
}

async function request<T>(token: string, path: string, init: RequestInit): Promise<{ res: Response; data: T }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...init.headers },
  })
  const data = (res.status === 204 ? null : await res.json().catch(() => null)) as T
  return { res, data }
}

/** 带登录的 GitHub 请求；401 时先续期再试一次，还不行就退出登录 */
async function gh<T>(path: string, init: RequestInit = {}): Promise<T> {
  const s = need()
  let { res, data } = await request<T>(s.token, path, init)
  // 别的请求可能已经续好了：token 变了就直接用新的重试，不再续一次
  if (res.status === 401 && (session?.token !== s.token || (await refresh(s.token))) && session) {
    ;({ res, data } = await request<T>(session.token, path, init))
  }
  if (!res.ok) {
    if (res.status === 401) logout()
    const msg = (data as { message?: string } | null)?.message
    throw Object.assign(new Error(`GitHub 返回 ${res.status}${msg ? `：${msg}` : ''}`), { status: res.status })
  }
  return data
}

export async function login(): Promise<Login> {
  const { token, refreshToken } = await requestToken()
  const { res, data } = await request<{ login: string; avatar_url: string }>(token, '/user', {})
  if (!res.ok) throw new Error(`GitHub 返回 ${res.status}`)
  persist({ token, refreshToken, user: { login: data.login, avatarUrl: data.avatar_url }, signedInAt: Date.now() })
  return session!.user
}

function need(): Session {
  if (!session) throw Object.assign(new Error('登录已失效，请重新登录'), { status: 401 })
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

/** 正文里引用的投稿图片地址（去重） */
const mediaIn = (body: string) => [...new Set([...body.matchAll(/!\[[^\]]*\]\((\/blog\/contrib-images\/[0-9a-f]{16}\.(?:png|jpg|webp|gif|svg))[\s)]/g)].map((m) => m[1]))]

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
  if (mediaIn(draft.body).length > LIMITS.images) throw new Error(`图片最多 ${LIMITS.images} 张`)
  return { ...draft, title, description, tags: draft.tags.map((t) => t.trim()) }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const status = (err: unknown) => (err as { status?: number }).status

/** 有写权限就在原仓库建分支；否则用（或新建）访客的 fork。fork 是异步建的，等它的默认分支出现 */
async function prepareRepo(): Promise<{ repo: string; sha: string; viaFork: boolean }> {
  const upstream = await gh<{ permissions?: { push?: boolean } }>(`/repos/${UPSTREAM}`)
  if (upstream.permissions?.push) {
    const ref = await gh<{ object: { sha: string } }>(`/repos/${UPSTREAM}/git/ref/heads/${BASE}`)
    return { repo: UPSTREAM, sha: ref.object.sha, viaFork: false }
  }
  const fork = await gh<{ full_name: string; default_branch: string }>(`/repos/${UPSTREAM}/forks`, {
    method: 'POST',
    body: JSON.stringify({ default_branch_only: true }),
  })
  for (let i = 0; i < 30; i++) {
    try {
      const ref = await gh<{ object: { sha: string } }>(`/repos/${fork.full_name}/git/ref/heads/${fork.default_branch}`)
      // fork 的默认分支上有访客自己的提交时，从它切出的分支会把这些提交一起带进 PR，过不了守门检查
      const owner = fork.full_name.split('/')[0]
      const diff = await gh<{ ahead_by: number }>(`/repos/${UPSTREAM}/compare/${BASE}...${owner}:${fork.default_branch}`)
      if (diff.ahead_by > 0) {
        throw new Error(`你的 fork（${fork.full_name}）的 ${fork.default_branch} 分支上有 ${diff.ahead_by} 个本站没有的提交，先在 GitHub 上把它和本站同步（或撤掉这些提交）再投稿`)
      }
      return { repo: fork.full_name, sha: ref.object.sha, viaFork: true }
    } catch (err) {
      if (status(err) !== 404 && status(err) !== 409) throw err
      await sleep(2000)
    }
  }
  throw new Error('fork 还没准备好，过一会儿再提交')
}

/** 上一次没提交成功的稿件：同一篇重试时沿用同一个分支，不重复开分支、不重复提 PR */
let attempt: { key: string; slug: string } | null = null

/** 已存在就当成功：重试时上一次可能已经做完了这一步。只认「已存在」这类 422，别的 422（参数错）照常报错 */
async function unlessExists<T>(fn: () => Promise<T>, onExists: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (status(err) === 422 && /already exists|sha.* (wasn't|was not) supplied|does not match/i.test((err as Error).message)) return onExists()
    throw err
  }
}

/** 往分支上写一个文件；已经有了（重试）就带上它的 sha 覆盖 */
async function putFile(repo: string, branch: string, path: string, content: string, message: string) {
  const put = (sha?: string) => gh(`/repos/${repo}/contents/${path}`, { method: 'PUT', body: JSON.stringify({ message, content, branch, sha }) })
  await unlessExists(put, async () => {
    const existing = await gh<{ sha: string }>(`/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`)
    return put(existing.sha)
  })
}

/**
 * 不同步 fork：新分支直接从 fork 的默认分支切出来，PR 只多出投稿这几个文件。
 * 这样即使上游改过 .github/workflows（同步要 workflow 权限）也不受影响。
 */
export async function submit(raw: Draft, progress: (step: SubmitStep, state: 'active' | 'done') => void): Promise<Submitted> {
  const { user } = need()
  const draft = check(raw)
  // 先把图片都找齐，缺图就别开分支
  const media = await Promise.all(
    mediaIn(draft.body).map(async (path) => {
      const stored = await bytesOf(path)
      if (!stored) throw new Error(`正文里的图片 ${path.slice(MEDIA_PREFIX.length)} 在这台设备上找不到了，删掉它或重新插入`)
      return stored
    }),
  )
  const key = JSON.stringify([user.login, draft])
  if (attempt?.key !== key) attempt = { key, slug: newSlug() }
  const { slug } = attempt
  const branch = `contrib/${slug}`
  const path = `${DIR}/${slug}.md`

  progress('fork', 'active')
  const { repo, sha, viaFork } = await prepareRepo()
  progress('fork', 'done')

  progress('branch', 'active')
  await unlessExists(
    () => gh(`/repos/${repo}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }) }),
    async () => null,
  )
  progress('branch', 'done')

  progress('commit', 'active')
  for (const m of media) {
    await putFile(repo, branch, `${MEDIA_DIR}/${m.path.slice(MEDIA_PREFIX.length)}`, toBase64(m.bytes), `docs(blog): add images for contributed post ${slug}`)
  }
  // 提交信息只能是英文（scripts/check-commit-lang.mjs），稿件标题可能是中文，所以这里用 slug
  await putFile(repo, branch, path, toBase64(new TextEncoder().encode(toMarkdown(draft, user.login))), `docs(blog): add contributed post ${slug}`)
  progress('commit', 'done')

  progress('pr', 'active')
  const head = viaFork ? `${repo.split('/')[0]}:${branch}` : branch
  type Pr = { number: number; html_url: string }
  const pr = await unlessExists(
    () =>
      gh<Pr>(`/repos/${UPSTREAM}/pulls`, {
        method: 'POST',
        body: JSON.stringify({
          // 合并时 PR 标题会进合并提交，必须是英文，所以标题用 slug；稿件标题放正文，「我的投稿」从正文读回
          title: `${TITLE_PREFIX}${slug}`,
          head,
          base: BASE,
          body: `Reader contribution from the in-site editor.\n\n${BODY_TITLE}${draft.title}\n\n> ${draft.description}\n\nAuthor: @${user.login}${media.length ? `\n\nImages: ${media.length}` : ''}`,
          maintainer_can_modify: true,
        }),
      }),
    async () => {
      const owner = viaFork ? repo.split('/')[0] : UPSTREAM.split('/')[0]
      const [found] = await gh<Pr[]>(`/repos/${UPSTREAM}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`)
      if (!found) throw new Error('GitHub 拒绝创建 PR，可以稍后在「我的投稿」里看看是否已经提交')
      return found
    },
  )
  progress('pr', 'done')
  attempt = null
  return { prNumber: pr.number, prUrl: pr.html_url, path }
}

const TITLE_PREFIX = 'Contribution: '
const BODY_TITLE = 'Title: '
/** 2026-11-25 之前提的投稿 PR（#1–#3）标题是「投稿：稿件标题」，「我的投稿」里还要认得它们 */
const LEGACY_TITLE_PREFIX = '投稿：'

/** 投稿 PR 的稿件标题：新格式从正文的 Title 行取（取不到就用标题里的 slug），旧格式去掉前缀；不是投稿 PR 返回 null */
function contribTitle(pr: { title: string; body?: string | null }): string | null {
  if (pr.title.startsWith(LEGACY_TITLE_PREFIX)) return pr.title.slice(LEGACY_TITLE_PREFIX.length)
  if (!pr.title.startsWith(TITLE_PREFIX)) return null
  const line = (pr.body ?? '').split('\n').find((l) => l.startsWith(BODY_TITLE))
  return line ? line.slice(BODY_TITLE.length) : pr.title.slice(TITLE_PREFIX.length)
}

type PullItem = { number: number; title: string; body: string | null; html_url: string; state: 'open' | 'closed'; merged_at: string | null; updated_at: string; user: { login: string }; head: { ref: string } }
type SearchItem = { number: number; title: string; body: string | null; html_url: string; state: 'open' | 'closed'; updated_at: string; pull_request?: { merged_at: string | null } }

/**
 * 最近 100 个 PR 里取自己的（刚提交的也在，搜索索引会晚几十秒），
 * 再用搜索补上更早的；两边按编号去重。
 */
export async function mine(): Promise<MyPr[]> {
  const { user } = need()
  const q = encodeURIComponent(`repo:${UPSTREAM} is:pr author:${user.login}`)
  const [pulls, search] = await Promise.all([
    gh<PullItem[]>(`/repos/${UPSTREAM}/pulls?state=all&per_page=100&sort=updated&direction=desc`),
    gh<{ items: SearchItem[] }>(`/search/issues?q=${q}&sort=updated&order=desc&per_page=100`),
  ])
  const byNumber = new Map<number, MyPr>()
  for (const p of pulls) {
    if (p.user.login.toLowerCase() !== user.login.toLowerCase() || !p.head.ref.startsWith('contrib/')) continue
    byNumber.set(p.number, { number: p.number, title: contribTitle(p) ?? p.title, url: p.html_url, state: p.merged_at ? 'merged' : p.state, updatedAt: p.updated_at })
  }
  for (const i of search.items) {
    const title = contribTitle(i)
    if (byNumber.has(i.number) || title === null) continue
    byNumber.set(i.number, { number: i.number, title, url: i.html_url, state: i.pull_request?.merged_at ? 'merged' : i.state, updatedAt: i.updated_at })
  }
  return [...byNumber.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
