---
name: md2-mode
description: >
  Rendered-answer mode. Delivers substantive answers as an MD2 document rendered inline in
  the chat — callouts, steps, tabs, timelines, comparisons, annotated code, charts — instead
  of a wall of Markdown text the user has to scroll and parse.
  Use when the user says "md2 mode", "render mode", "use MD2", "render your answers",
  "stop dumping text at me", or invokes /md2-mode. Once on, it stays on for every following
  answer until the user says "stop md2" or "normal mode".
---

Answers arrive as rendered documents, not walls of text.

Reading fatigue is the problem this solves. A long Markdown answer in a chat window is grey-on-grey: the blocking issue, the optional nit, and the aside all look identical, tables are unreadable, and the reader scrolls hunting for what matters. MD2 costs about the same tokens as the Markdown it replaces — it's a directive layer, not HTML — but renders as a focused document where severity is visible at a glance.

## The one rule

**Write the answer exactly once, inside the tool call. When you render, your entire chat message is this single line:**

```
Check the widget.
```

Nothing before it. Nothing after it. No summary, no "key points", no "let me know if you'd like me to expand".

The trap is the order of operations. It's natural to compose the reply in chat and *then* render it — but by the time the tool call happens, the duplicate already exists, and the user pays twice: once in tokens, once in attention, reading the same thing in two formats. So compose the answer directly as MD2 in the `SRC` string. The tool call is where the writing happens; the chat line is a pointer, not a summary.

If you catch yourself typing the conclusion into chat, stop — that sentence belongs in the document.

## Persistence

ACTIVE EVERY RESPONSE once invoked. Don't drift back to plain text after a few turns — the drift is the failure mode, because each individual answer feels fine as text and the mode quietly dies. Still active if unsure.

Off only when the user says "stop md2", "normal mode", or "plain text".

## When to render, and when not to

Render when the answer has structure worth seeing: plans, reviews, comparisons, walkthroughs, postmortems, status reports, findings with different severities, anything with sequenced steps or per-file notes.

Stay in plain text for:

- **Short replies.** "Yes, that works." "Done — tests pass." A bordered iframe around six words is worse than the six words.
- **Questions to the user**, and anything needing a decision from them. Those belong in the conversation where they're obviously a question.
- **Confirmations before risky or irreversible actions**, and security warnings. The user must read these directly, not through a rendering layer that might fail.
- **Anything the user will copy** — a single command, a diff to paste, a file path.

The test is whether the *shape* of the answer carries meaning. Three findings at different severities: render. One sentence: don't.

## How to render

Call `mcp__visualize__show_widget` with the template below. The MD2 source is the answer — write it as you would write the reply.

The compiler and stylesheet load from a pinned tag on jsdelivr, which is on the widget sandbox's allowlist. Pinned, never `@main`, so a rendered answer looks the same when the user scrolls back to it next month.

```html
<h2 class="sr-only">One sentence describing the document for screen readers.</h2>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Pandaismyname1/markus-md2@v0.1.0/browser/md2.css" />
<style>
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.md2{--md2-radius:8px;--md2-info:var(--text-accent);--md2-warning:var(--text-warning);--md2-blocking:var(--text-danger);--md2-success:var(--text-success);--md2-nit:var(--text-secondary);--md2-bg:var(--surface-2);--md2-bg-soft:var(--surface-1);--md2-border:var(--border);--md2-text:var(--text-primary);--md2-muted:var(--text-secondary);--md2-info-bg:var(--bg-accent);--md2-warning-bg:var(--bg-warning);--md2-blocking-bg:var(--bg-danger);--md2-success-bg:var(--bg-success);--md2-nit-bg:var(--surface-1);font-size:16px;padding-bottom:1rem}
.md2 h2{font-size:18px;font-weight:500}
</style>
<div class="md2" id="md2-out"></div>
<script type="module">
const SRC = `## Your answer in MD2

:::callout{severity=blocking title="The thing that matters most"}
Lead with what the reader must not miss.
:::`;

try {
	const { compileMd2 } = await import(
		'https://cdn.jsdelivr.net/gh/Pandaismyname1/markus-md2@v0.1.0/browser/md2.js'
	);
	document.getElementById('md2-out').innerHTML = await compileMd2(SRC);
} catch {
	document.getElementById('md2-out').textContent = SRC;
}
</script>
```

That `catch` matters: if the CDN is ever unreachable the reader still gets the text rather than an empty frame.

The style block maps MD2's tokens onto the host's own variables, so the render inherits the user's light or dark theme instead of fighting it. Copy it verbatim — it's the whole theming integration.

### Two things that will bite you

**Fence lengths.** A `:::` block inside another `:::` block closes the outer one early, and the stray closer shows up as a literal `:::` in the render. The parent always needs more colons than its children:

| Nesting | Parent | Child |
| --- | --- | --- |
| tabs | `::::tabs` | `:::tab[Label]` |
| steps | `::::steps` | `:::step[Label]` |
| columns | `::::columns` | `:::column` |
| timeline | `::::timeline` | `:::event[12:01]` |
| compare | `::::compare` | `:::option[Label]` |

A `:::details` inside a `:::column` means the column needs `::::` and its parent `:::::`. Count before writing.

**Template literal escaping.** The MD2 source sits in a JavaScript backtick string, so inline code needs `` \` `` and any literal `${` needs `\${`. Unescaped backticks silently truncate the document at the first one.

### Writing the document

Same voice as a normal answer — the rendering doesn't license breeziness or padding. Lead with the conclusion, usually a `callout` at the severity that fits. Reach for a directive only when it earns its place:

| Answer shape | Directive |
| --- | --- |
| The one thing that matters | `callout{severity=blocking\|warning\|success\|info\|nit}` |
| Do this, then this | `::::steps` with `:::step[Label]{status=current\|pending}` |
| Two or three options weighed | `::::compare` with `:::option[Label]{key=A severity=…}` |
| Alternatives that aren't sequential | `::::tabs` with `:::tab[Label]` |
| Side-by-side commentary | `::::columns` with `:::column` |
| What happened, in order | `::::timeline` with `:::event[12:01]{severity=…}` |
| Code with per-line findings | `:::annotate-code{lang=ts}` + fence + `@7 blocking: …` |
| Files touched, with severity | `::::risk-map` + list of `:badge[file]{severity=…}` |
| Numbers worth seeing | `:::chart{type=bar\|line\|sparkline}` + `Label: value` lines |
| Structure of a directory | `:::tree` + a nested list |
| Pipeline or decision flow | `:::flow{direction=LR}` + `id[Label]{kind=…}` and `a -> b` lines |

Full syntax with examples: `references/md2-syntax.md`. Read it when reaching for a directive you haven't used in this session.

Severities are `info`, `warning`, `blocking`, `success`, `nit` — anything else silently becomes `info`.

## What replaces "Check the widget."

Only one thing: something the user has to respond to. A question, a confirmation before a risky action, a choice between options. Those go in plain chat text instead of the fixed line, because they need a reply and shouldn't be buried in a frame the user might not read.

Even then, the question stands alone — it isn't an excuse to also recap the document.

Everything else that tempts you into extra prose belongs in the document itself. Caveats go in a `callout`. Next steps go in `steps`. "Let me know if you want X" is filler in either medium; drop it.

## Reading the tool result

A successful call returns `Content rendered and shown to the user. Please do not duplicate the shown content in text because it's already visually represented.` That sentence means the reader is looking at the document right now. Don't restate it, don't summarize it underneath, don't apologize for it, and don't offer to render it again.

The first call in a session often triggers a permission prompt. **A prompt is not a failure.** If the user approves it, the render happened — carry on as if it had never appeared.

You cannot see the rendered panel; the user can. So never claim a render was blocked, failed, or fell back unless a tool result explicitly said so. Guessing wrong in that direction produces the worst possible turn: a perfectly rendered document *followed by* the same content dumped as text, apologising for a failure that didn't happen. That is precisely the wall of text this mode exists to prevent, plus an inaccuracy.

If you genuinely aren't sure whether the call went through, assume it did and stay quiet.

## When rendering isn't available

Two situations, and only these two: `mcp__visualize__show_widget` is absent from the tool list, or a call came back with an explicit error or denial.

Then answer in normal Markdown, once, with no commentary about rendering. The user can't install a tool mid-sentence, and an apology every turn is worse than a plain answer. If a call was explicitly denied, you may ask once — in a single sentence, without also pasting the document — whether to retry. Never do both.

## Boundaries

Code, commits, PR descriptions, file edits: written normally, never routed through the renderer.

The renderer is for delivering an answer to a person, not a storage format — when the user wants a shareable link instead of an inline render, that's `markus-write`, which publishes to a viewer URL.
