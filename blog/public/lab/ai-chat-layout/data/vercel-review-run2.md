## run2.html（Vercel Web Interface Guidelines 的 command.md，Claude Opus 5.5 执行，2026-10-25）

run2.html:5 - missing `<meta name="theme-color">` matching page bg (light #faf9f7 / dark #1f1e1c)
run2.html:5 - viewport-fit=cover but no `env(safe-area-inset-left/right)` anywhere (topbar 417, thread 419, composer 423, fixed sidebar 395); landscape notch covers content
run2.html:59 - no `touch-action: manipulation` on buttons/links
run2.html:59 - `-webkit-tap-highlight-color` not set intentionally
run2.html:117 - `.history` scroll inside mobile drawer lacks `overscroll-behavior: contain`
run2.html:267 - `.ai-body a` no hover state
run2.html:354 - `.send` no hover state
run2.html:400 - closed drawer only translated offscreen; its links/buttons still tabbable, so focus lands on invisible elements (use `inert`/`visibility: hidden` when closed)
run2.html:432 - no skip link to main content
run2.html:437 - brand "Pairwise Chat" lacks `translate="no"` / `&nbsp;`
run2.html:443 - heading order: `<h2>` (sidebar) precedes the only `<h1>` (477)
run2.html:445 - history items `href="#"` + preventDefault (666-673); Cmd/Ctrl/middle-click broken, selected conversation not reflected in URL
run2.html:472 - `<div class="scrim">` with click handler (663) → `<button>` or non-interactive
run2.html:478 - "分享" only copies link → specific label e.g. "复制链接"
run2.html:485 - code tokens (`<code>` here and 519-520, 540-541, code block 494) lack `translate="no"`
run2.html:491 - "两件事" → numerals "2 件事"
run2.html:493 - "复制" label not specific → "复制代码"
run2.html:528 - "三层" → numerals "3 层"
run2.html:556 - textarea missing `name` and `autocomplete` (`autocomplete="off"`)
run2.html:556 - placeholder should end with "…"; "Shift + Enter" → `Shift&nbsp;+&nbsp;Enter`
run2.html:556 - no `beforeunload` warning when unsent draft present
run2.html:557 - submit disabled while empty (also 591); keep enabled until request starts
run2.html:590 - autosize writes height then reads `scrollHeight`; interleaved DOM write/read forces layout each keystroke
run2.html:610 - loading label "正在回复" → "正在回复…"; `aria-label` on role-less `<span>` not announced
run2.html:624 - streaming writes textContent then reads `scrollHeight` every 30ms (interleaved read/write); forced scroll-to-bottom not interruptible when user scrolls up mid-stream
run2.html:679 - "新对话" wipes current messages immediately, no confirm/undo; leaves empty thread with no empty state
run2.html:681 - `input.focus()` on new chat also fires on mobile (keyboard pops); restrict to desktop
run2.html:695 - error "当前环境不支持自动复制" gives no next step (e.g. "请手动选中复制")
