## run3.html（Vercel Web Interface Guidelines 的 command.md，Claude Opus 5.5 执行，2026-10-25）

run3.html:5 - missing `<meta name="theme-color">` matching --bg (light/dark)
run3.html:56 - no `touch-action: manipulation` on buttons/interactive elements
run3.html:56 - `-webkit-tap-highlight-color` not set intentionally
run3.html:90 - mobile drawer `.history` scroll container missing `overscroll-behavior: contain`
run3.html:131 - topbar / mobile fixed sidebar (259) missing `env(safe-area-inset-top/left/right)` despite `viewport-fit=cover`
run3.html:178 - `.body a` no hover state
run3.html:227 - textarea `outline: 0`; only replacement is `.composer:focus-within` border → --muted, low-contrast focus indication
run3.html:235 - `.send` no hover state
run3.html:287 - no skip link to main content / composer
run3.html:290 - brand name "Assistant" missing `translate="no"`
run3.html:292 - decorative close icon svg missing `aria-hidden="true"`
run3.html:306 - `<div>` backdrop with click handler (467); should be `<button>` or non-interactive with Escape only
run3.html:311 - decorative menu icon svg missing `aria-hidden="true"`
run3.html:314 - share button becomes icon-only on mobile (`.share-label{display:none}` 272) with no `aria-label`
run3.html:339 - code block `<pre><code>` and inline `<code>` tokens missing `translate="no"`
run3.html:402 - textarea missing `name` and `autocomplete="off"`
run3.html:402 - placeholder should end with `…`: "给 Assistant 发消息…"
run3.html:403 - submit disabled until input non-empty (514); keep enabled until request starts, validate on submit
run3.html:402 - no `beforeunload`/guard when composer has unsent draft
run3.html:407 - "Shift + Enter" → non-breaking spaces (`Shift&nbsp;+&nbsp;Enter`)
run3.html:443 - history items are navigation (aria-current="page") but rendered as `<button>`; use `<a href>` for Cmd/Ctrl/middle-click
run3.html:448 - active conversation not reflected in URL; not deep-linkable
run3.html:490 - share copies `location.href`, which never encodes current chat → shared link doesn't point to conversation
run3.html:498 - copy failure "复制失败" gives no next step (e.g. 手动选择复制)
run3.html:503 - new chat wipes current thread immediately (`replaceChildren`) with no confirm/undo
run3.html:503 - cleared thread renders blank area; no empty state
run3.html:507 - programmatic `input.focus()` on new chat also fires on mobile (pops keyboard); desktop only
run3.html:511 - autosize interleaves write (`height=auto`) / read (`scrollHeight`) / write → forced reflow per keystroke
run3.html:580 - loading label "正在回复" → "正在回复…"
