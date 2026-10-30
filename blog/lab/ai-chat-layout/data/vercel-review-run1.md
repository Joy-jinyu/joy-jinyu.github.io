## run1.html（Vercel Web Interface Guidelines 的 command.md，Claude Opus 5.5 执行，2026-10-25）

run1.html:5 - no `<meta name="theme-color">` matching `--bg`; light and dark variants needed
run1.html:52 - no `overscroll-behavior: none` on `<html>` inside `@media (pointer: fine)`
run1.html:53 - missing `touch-action: manipulation`
run1.html:53 - `-webkit-tap-highlight-color` not set intentionally
run1.html:89 - `transition: background-color` → animate transform/opacity only
run1.html:161 - `.msg a` missing hover state
run1.html:251 - `.send` missing hover state
run1.html:229 - composer and topbar handle only top/bottom safe areas; with `viewport-fit=cover`, landscape also needs `env(safe-area-inset-left/right)` (line 131 too)
run1.html:282 - open mobile drawer leaves `.main` focusable under the scrim; Tab can move focus behind the overlay (needs `inert` on main)
run1.html:308 - no skip link to main content
run1.html:313 - brand "Pairwise Chat" lacks `translate="no"`; so do the code blocks and inline `<code>` (384, 370 etc.)
run1.html:370 - "Node 17.3" / "Node 18" (365) → non-breaking space between name and version
run1.html:325 - history `<a href="#">` + preventDefault (583); the selected conversation is not in the URL, and Cmd/middle-click opens nothing useful
run1.html:457 - textarea lacks meaningful `name`
run1.html:458 - send button disabled until input is non-empty (498); it should stay enabled until the request starts
run1.html:462 - "Shift + Enter" → `Shift&nbsp;+&nbsp;Enter`
run1.html:494 - autosize writes height, reads scrollHeight and writes again on every keystroke; this interleaves reads and writes and forces layout
run1.html:513 - loading label "正在输入" → "正在输入…"; `aria-label` on a generic div without a role
run1.html:535 - typeOut writes textContent and then reads scrollHeight/scrollTop every 24ms tick; this interleaves reads and writes
run1.html:560 - no `beforeunload` warning when the composer has an unsent draft
run1.html:595 - new chat wipes the thread immediately with no confirm or undo, and leaves an empty thread with no empty state
run1.html:597 - `input.focus()` on new chat also fires on mobile and opens the keyboard
run1.html:602 - share copies `location.href`, which has no conversation id, so the shared link does not deep-link
run1.html:616 - copy result ("已复制"/"复制失败") changes the button text with no live-region announcement
run1.html:618 - "复制失败" gives no next step
