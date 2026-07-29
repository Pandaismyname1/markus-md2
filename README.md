# MD2

[![CI](https://github.com/Pandaismyname1/markus-md2/actions/workflows/ci.yml/badge.svg)](https://github.com/Pandaismyname1/markus-md2/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

A thin directive layer over Markdown, for documents an AI writes and a human reads.

Markdown gives you paragraphs, lists, and code fences. MD2 adds the structures long technical documents actually need — callouts, steps, tabs, timelines, comparisons, annotated code, flowcharts, charts — as `:::directive` blocks that cost roughly the same tokens as the Markdown they replace, and a fraction of what the equivalent HTML would.

```md
:::callout{severity=blocking title="Blocks release"}
Migration `0042` is not applied on prod.
:::

::::steps

:::step[Apply the migration]{status=current}
About 40 s, no lock on `orders`.
:::

:::step[Roll the API tier]{status=pending}
25% → 50% → 100%.
:::

::::
```

That renders as a red-railed callout and a numbered sequence with the current step highlighted — in a browser, in an email, or inline in a chat window.

**Why bother.** An AI assistant producing a long answer has two options today: dump Markdown, where the blocking issue and the throwaway aside look identical, or emit HTML, which costs five times the tokens and is rigid. MD2 is the third: the model already speaks Markdown, `:::callout` is cheap to learn, and the render carries the structure the prose was trying to convey.

> **Status.** `v0.1.0` is tagged and the browser bundle is live on the CDN. The npm release publishes from the tag once the registry token is configured — until then, use the CDN or install from git.

## Install

**From a CDN, no install.** `browser/md2.js` is a self-contained ESM bundle with every dependency inlined, committed to the repository so a CDN can serve it straight from git. Pin a tag — never `@main` — so a page renders the same way a year from now:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Pandaismyname1/markus-md2@v0.1.0/browser/md2.standalone.css" />
<script type="module">
	import { compileMd2 } from 'https://cdn.jsdelivr.net/gh/Pandaismyname1/markus-md2@v0.1.0/browser/md2.js';

	document.querySelector('.md2').innerHTML = await compileMd2(source);
</script>
```

Two URLs, no build step, no package manager. Use `md2.standalone.css` when the host page has no design system of its own, or `md2.css` when you supply the tokens.

**From npm.**

```bash
npm install markus-md2
```

**From git**, before the npm release:

```bash
npm install github:Pandaismyname1/markus-md2#v0.1.0
```

ESM only, Node 18+. The same compiler runs on a server and in a browser.

## Compiling

```js
import { compileMd2 } from 'markus-md2';
import 'markus-md2/md2.css';

const html = await compileMd2(source);
```

| Function                            | Returns                          | Use when                                                 |
| ----------------------------------- | -------------------------------- | -------------------------------------------------------- |
| `compileMd2(source)`                | `Promise<string>`                | Normal async rendering                                   |
| `compileMd2Sync(source)`            | `string`                         | Sync contexts — templates, CLI tools                     |
| `compileMd2WithDiagnostics(source)` | `Promise<{ html, diagnostics }>` | Editors, linting, publish pipelines that report problems |

Diagnostics are structured data — never thrown, never logged:

```js
const { html, diagnostics } = await compileMd2WithDiagnostics(source);
// [{ severity: 'warning', code: 'MD2_ORPHAN_FENCE', message: '…', line: 30, column: 1 }]
```

Codes: `MD2_UNKNOWN_DIRECTIVE`, `MD2_BAD_SEVERITY`, `MD2_FIGURE_MISSING_SRC`, `MD2_CHART_NO_DATA`, `MD2_CHART_BAD_TYPE`, `MD2_FLOW_NO_NODES`, `MD2_COMPARE_TOO_FEW_OPTIONS`, `MD2_ORPHAN_TAB`, `MD2_ORPHAN_STEP`, `MD2_ANNOTATE_RANGE_REVERSED`, `MD2_COLUMNS_NO_CHILDREN`, `MD2_ORPHAN_FENCE`, `MD2_COMPILE_THROW`.

## Directives

| Directive            | Shape     | What it renders                                      |
| -------------------- | --------- | ---------------------------------------------------- |
| `callout`            | container | Severity-coloured aside, optional icon and dismiss    |
| `columns` / `column` | container | Responsive card grid                                  |
| `details`            | container | Native `<details>` disclosure                         |
| `risk-map`           | container | Index of files or sections with severity badges       |
| `tabs` / `tab`       | container | CSS-only tabs (radio inputs, no JavaScript)           |
| `steps` / `step`     | container | Numbered sequence with current/pending states         |
| `figure`             | leaf      | Image with caption and credit                         |
| `timeline` / `event` | container | Time-stamped incident or history log                  |
| `compare` / `option` | container | Side-by-side options, doubles as a vote picker        |
| `tree`               | container | File tree from a nested list                          |
| `flow`               | container | SVG flowchart from node and edge lines                |
| `chart`              | container | SVG bar, line, or sparkline chart with a data table   |
| `annotate-code`      | container | Syntax-highlighted code with per-line severity notes  |
| `badge`              | inline    | Severity pill                                         |
| `jump`               | inline    | In-page anchor link                                   |

Severities are `info`, `warning`, `blocking`, `success`, `nit`. Anything else coerces to `info`.

Full syntax with examples: [`skills/md2-mode/references/md2-syntax.md`](skills/md2-mode/references/md2-syntax.md).

### Nesting: the outer fence needs more colons

`remark-directive` fences are length-sensitive, so a `:::` block inside another `:::` block closes the outer one early:

```md
::::tabs
:::tab[First]
Body.
:::
::::
```

Three colons inside, four outside — and five if that block is itself nested. The same applies to `steps`/`step`, `columns`/`column`, `timeline`/`event`, and `compare`/`option`. Strays are reported as `MD2_ORPHAN_FENCE`, though [not in every position yet](docs/KNOWN_ISSUES.md).

## Styling

Plain CSS, no build step:

```js
import 'markus-md2/md2.css';
```

Every directive reads its colours from fifteen `--md2-*` custom properties, which by default alias [daisyUI](https://daisyui.com) semantic variables. Three ways to theme:

**You use daisyUI.** Nothing to do — flipping `data-theme` re-themes every directive.

**You don't.** Load the standalone token layer alongside it:

```js
import 'markus-md2/md2.css';
import 'markus-md2/md2-host.css';
```

**You have your own design system.** Map the tokens onto it — this is the entire integration:

```css
.md2 {
	--md2-info: var(--your-accent);
	--md2-blocking: var(--your-danger);
	--md2-bg: var(--your-surface);
	--md2-text: var(--your-text);
	/* …fifteen in total, listed in css/md2-host.css */
}
```

For `<link>` tags, inline `<style>` blocks, and sandboxes that block extra requests, the build emits flattened single files: `dist/md2.bundle.css` and `dist/md2.standalone.css` (the bundle plus host tokens, works in a page with no design system at all). Alternate themes — sepia, newspaper, high-contrast, solarized — apply via `data-md2-theme` on the article wrapper.

## Use it in Claude Code: the `md2-mode` skill

This is the part that changes your day.

Claude Code answers in Markdown, in a chat pane. A code review comes back as grey-on-grey text where the blocking bug and the style nit look identical, and you scroll hunting for the part that matters. `md2-mode` is a [skill](https://docs.claude.com/en/docs/claude-code/skills) that makes Claude deliver substantive answers as a **rendered MD2 document inline in the conversation** — severity you can see, steps you can follow, annotated code with findings pinned to their lines.

It compiles in the sandbox from the CDN bundle above, so the answer costs about what the Markdown would have. Turn it on once and it stays on.

### Install

**macOS / Linux**

```bash
git clone https://github.com/Pandaismyname1/markus-md2.git /tmp/markus-md2 && mkdir -p ~/.claude/skills && cp -r /tmp/markus-md2/skills/md2-mode ~/.claude/skills/
```

**Windows (PowerShell)**

```powershell
git clone https://github.com/Pandaismyname1/markus-md2.git $env:TEMP\markus-md2; New-Item -ItemType Directory -Force $env:USERPROFILE\.claude\skills; Copy-Item -Recurse -Force $env:TEMP\markus-md2\skills\md2-mode $env:USERPROFILE\.claude\skills\
```

Then restart Claude Code, or run `/reload-skills` if your client has it. Drop the skill into a project's `.claude/skills/` instead of `~/.claude/skills/` to scope it to one repo.

### Use

```
md2 mode
```

Every substantive answer after that arrives as a rendered document. Short replies, questions, and confirmations before risky actions deliberately stay as plain text — a bordered frame around "yes, that works" helps nobody.

```
stop md2
```

turns it off again.

### What it needs

An inline widget renderer — the Claude Code desktop app provides one. In a terminal-only session the skill detects that the tool is missing and answers in normal Markdown without comment, so installing it is safe everywhere; it simply does nothing where it can't render.

Each render fetches the ~400 KB browser bundle once (then it's CDN-cached) and adds roughly 2 KB of boilerplate to the message. The document itself is MD2 source, which is why the total is usually smaller than the Markdown answer it replaces.

## Auto-upgrade

Promote plain Markdown to MD2 before rendering. Conservative by design: it only rewrites patterns it recognises unambiguously, never touches existing directives, and is idempotent.

```js
import { upgradeMarkdown } from 'markus-md2/upgrade';

const { source, diagnostics } = upgradeMarkdown('> **Note:** heads up');
// ':::callout{severity=info}\nheads up\n:::'
```

Useful when a document arrives from a tool that doesn't know MD2 — the render still gets structure.

## Markup contract

The compiler emits semantic HTML with stable `.md2-*` class names. Those names are the contract between the compiler and every stylesheet that consumes it, including ones outside this repository: the tests assert them, and they won't change outside a major version.

## Development

```bash
npm install
npm test          # 142 specs
npm run build     # tsc + flattened stylesheets + browser bundle
```

[Contributing guide](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [Known issues](docs/KNOWN_ISSUES.md) · [Security policy](SECURITY.md)

## License

MIT
