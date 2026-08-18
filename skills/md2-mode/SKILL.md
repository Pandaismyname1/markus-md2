---
name: md2-mode
description: >
  Rendered-answer mode. Delivers substantive answers as an MD2 document rendered inline in
  the chat — callouts, steps, tabs, timelines, comparisons, annotated code, charts — instead
  of a wall of Markdown text the user has to scroll and parse.
  Use when the user says "md2 mode", "render mode", "render your answers", "answer in MD2",
  "stop dumping text at me", or invokes /md2-mode. Once on, it stays on for every following
  answer until the user asks for plain text again.
---

Answers arrive as rendered documents, not walls of text.

Reading fatigue is the problem this solves. A long Markdown answer in a chat window is grey-on-grey: the blocking issue, the optional nit, and the aside all look identical, tables are unreadable, and the reader scrolls hunting for what matters. MD2 costs about the same tokens as the Markdown it replaces — it's a directive layer, not HTML — but renders as a focused document where severity is visible at a glance.

## The one rule

**Write the answer exactly once, inside the tool call. When you render, your entire chat message is this single line:**

```
Check the widget.
```

Nothing before it. Nothing after it. No summary, no "key points", no "let me know if you'd like me to expand".

The trap is the order of operations. It's natural to compose the reply in chat and *then* render it — but by the time the tool call happens the duplicate already exists, and the user pays twice: once in tokens, once in attention. Compose the answer directly in the document. The chat line is a pointer, not a summary.

If you catch yourself typing the conclusion into chat, stop — that sentence belongs in the document.

### This overrides the widget tool's own guidance

`show_widget` asks you to call `read_me` first, and that guidance says to keep prose in your chat response and put only visuals in the tool. It is written for illustrations that *accompany* a text answer — a chart beside your explanation.

This mode is the other case: the document **is** the answer, so the prose goes inside it. Where the two conflict, follow this skill. The rest of `read_me` still applies — the sandbox's CDN allowlist, the host theme variables, no `position: fixed`.

## Persistence

ACTIVE EVERY RESPONSE once invoked. Don't drift back to plain text after a few turns — the drift is the failure mode, because each individual answer feels fine as text and the mode quietly dies.

Off when the user asks for plain text in any phrasing: "stop md2", "normal mode", "plain text", "no more widgets", "just answer normally", "stop rendering". Read intent rather than matching strings; a user who sounds like they want the rendering to stop wants it to stop.

Being *asked about* MD2 is not the same as being asked *to use* it. "How do I write an MD2 callout?" is a syntax question — answer it, don't switch the mode on.

## When to render, and when not to

Render when the answer has structure worth seeing: plans, reviews, comparisons, walkthroughs, postmortems, status reports, findings with different severities, anything with sequenced steps or per-file notes.

Stay in plain text for:

- **Short replies.** "Yes, that works." "Done — tests pass." A bordered iframe around six words is worse than the six words.
- **A turn that is only a question.** If you have nothing to deliver but a question, ask it in chat.
- **Confirmations before risky or irreversible actions**, and security warnings. The user must read these directly, not through a rendering layer that might fail.
- **Anything the user will copy** — a single command, a diff to paste, a file path.

The test is whether the *shape* of the answer carries meaning. Three findings at different severities: render. One sentence: don't.

## How to render

Call `mcp__visualize__show_widget` with this template. The MD2 source lives in a `text/plain` script tag, **not** a JavaScript string — inside a template literal every backslash, backtick and `${` becomes a syntax hazard, and a syntax error means the module never runs, the widget renders empty, and nothing reports it.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Pandaismyname1/markus-md2@v0.2.0/browser/md2.css" />
<h2 style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">One sentence describing the document for screen readers.</h2>
<style>
.md2{--md2-radius:8px;--md2-info:var(--text-accent);--md2-warning:var(--text-warning);--md2-blocking:var(--text-danger);--md2-success:var(--text-success);--md2-nit:var(--text-secondary);--md2-bg:var(--surface-2);--md2-bg-soft:var(--surface-1);--md2-border:var(--border);--md2-text:var(--text-primary);--md2-muted:var(--text-secondary);--md2-info-bg:var(--bg-accent);--md2-warning-bg:var(--bg-warning);--md2-blocking-bg:var(--bg-danger);--md2-success-bg:var(--bg-success);--md2-nit-bg:var(--surface-1);font-size:16px;padding-bottom:1rem}
.md2 h1,.md2 h2,.md2 h3{font-weight:500}
.md2 h2{font-size:18px}
#md2-out[data-fallback]{white-space:pre-wrap;font-family:var(--font-mono);font-size:13px}
</style>
<script type="text/plain" id="md2-src">
## Your answer in MD2

:::callout{severity=blocking title="The thing that matters most"}
Lead with what the reader must not miss. Backslashes, `backticks` and ${braces}
are all safe in here — nothing in this block is parsed as JavaScript.
:::
</script>
<div class="md2" id="md2-out"></div>
<script type="module">
	const out = document.getElementById('md2-out');
	const src = document.getElementById('md2-src').textContent;
	try {
		const { compileMd2 } = await import(
			'https://cdn.jsdelivr.net/gh/Pandaismyname1/markus-md2@v0.2.0/browser/md2.js'
		);
		out.innerHTML = await compileMd2(src);
	} catch {
		out.dataset.fallback = '';
		out.textContent = src;
	}
</script>
```

The only sequence that can't appear in the source block is a literal `</script`. Everything else — Windows paths, regex escapes, fenced code blocks, shell snippets — goes in verbatim.

The style block maps MD2's tokens onto the host's variables so the render inherits the user's light or dark theme. Copy it verbatim; it is the whole theming integration.

### Fence lengths: count the depth, don't copy an example

A `:::` block inside another `:::` block closes the outer one early. **Every container needs one more colon than the container nested inside it**, counted from the innermost outward:

| Depth | Fences |
| --- | --- |
| 2 levels | `::::steps` › `:::step[Label]` |
| 3 levels | `:::::steps` › `::::step[Label]` › `:::callout` |
| 3 levels | `:::::columns` › `::::column` › `:::details[Label]` |

A callout inside a step is the most common three-level case, and getting it wrong is **silent**: no diagnostic, the callout loses its styling, and any text after it inside that step disappears from the document entirely. Nothing in the tool result will tell you. When a container holds another container, add a colon.

### Images and links inside the sandbox

The widget blocks every external origin except a few CDNs, so `:::figure{src="https://anywhere/img.png"}` renders as a broken image with no error. Use a `data:` URI, a `cdn.jsdelivr.net` URL, or leave the image out. `:jump` anchors work within the document; external links route through the host's confirmation dialog.

### Writing the document

Same voice as a normal answer — rendering doesn't license breeziness or padding. Lead with the conclusion, usually a `callout` at the severity that fits. Reach for a directive only when it earns its place:

| Answer shape | Directive |
| --- | --- |
| The one thing that matters | `callout{severity=blocking\|warning\|success\|info\|nit}` |
| Do this, then this | `steps` with `step[Label]{status=current\|pending}` |
| Two or three options weighed | `compare` with `option[Label]{key=A severity=…}` |
| Alternatives that aren't sequential | `tabs` with `tab[Label]` |
| Side-by-side commentary | `columns` with `column` |
| What happened, in order | `timeline` with `event[12:01]{severity=…}` |
| Code with per-line findings | `annotate-code{lang=ts}` + fence + `@7 blocking: …` |
| Files touched, with severity | `risk-map` + list of `:badge[file]{severity=…}` |
| Numbers worth seeing | `chart{type=bar\|line\|sparkline}` + `Label: value` lines |
| Structure of a directory | `tree` + a nested list |
| Pipeline or decision flow | `flow{direction=LR}` + `id[Label]{kind=…}` and `a -> b` lines |

Colon counts are omitted from that table on purpose — derive them from the depth rule above.

Full syntax with examples: `references/md2-syntax.md`. Read it when reaching for a directive you haven't used in this session.

Severities are `info`, `warning`, `blocking`, `success`, `nit` — anything else silently becomes `info`.

## What replaces "Check the widget."

Only something the user has to respond to: a question, a confirmation before a risky action, a choice between options. That question becomes the whole chat message in place of the fixed line — it isn't an excuse to also recap the document.

Everything else that tempts you into extra prose belongs in the document. Caveats go in a `callout`. Next steps go in `steps`. "Let me know if you want X" is filler in either medium; drop it.

## Reading the tool result

A successful call returns `Content rendered and shown to the user. Please do not duplicate the shown content in text because it's already visually represented.` That means the reader is looking at the document. Don't restate it, don't apologise for it, don't offer to render it again.

The first call in a session often triggers a permission prompt. **A prompt is not a failure.** If the user approves it, the render happened.

You cannot see the rendered panel; the user can. Never claim a render was blocked or failed unless a tool result says so — a rendered document followed by the same content as text is the worst possible turn.

The corollary: you can't confirm it *looks* right either. If the user says the widget is empty, unstyled, or missing content, believe them immediately — check the source block for a stray `</script`, check fence depths for a silently dropped section, then re-render. Never argue from the success string.

## When rendering isn't available

Two situations, and only these two: `mcp__visualize__show_widget` is absent from the tool list, or a call came back with an explicit error or denial.

Then answer in normal Markdown, once, with no commentary about rendering. The user can't install a tool mid-sentence, and an apology every turn is worse than a plain answer. If a call was explicitly denied you may ask once — in a single sentence, without also pasting the document — whether to retry. Never do both.

## Boundaries

Code you are *delivering* — file edits, commit messages, PR descriptions, a command to run — is written normally, never wrapped in a render. Code you are *discussing* is different: a review with findings pinned to their lines is exactly what `annotate-code` exists for.

The renderer delivers an answer to a person; it isn't a storage format. When the user wants a shareable link instead of an inline render, that's `markus-write`, which publishes to a viewer URL.
