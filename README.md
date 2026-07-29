# MD2

A thin directive layer over Markdown, for documents an AI writes and a human reads.

Markdown gives you paragraphs, lists, and code fences. MD2 adds the structures that long technical documents actually need — callouts, steps, tabs, timelines, comparisons, annotated code, flowcharts, charts — as `:::directive` blocks that cost roughly the same tokens as the Markdown they replace, and a fraction of what the equivalent HTML would.

```md
:::callout{severity=blocking title="Blocks release"}
Migration `0042` is not applied on prod.
:::
```

```js
import { compileMd2 } from 'markus-md2';
import 'markus-md2/md2.css';

const html = await compileMd2(source);
```

## Install

```bash
npm install markus-md2
```

The package ships ESM only and needs Node 18+. It runs unchanged in the browser — the same compiler powers server-rendered and client-rendered views.

### Or use it from a CDN, with no install

`browser/md2.js` is a self-contained ESM bundle with every dependency inlined, committed to the repository so it can be served straight from git. Pin a tag — never `@main` — so a page renders the same way a year from now:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Pandaismyname1/markus-md2@v0.1.0/browser/md2.standalone.css" />
<script type="module">
	import { compileMd2 } from 'https://cdn.jsdelivr.net/gh/Pandaismyname1/markus-md2@v0.1.0/browser/md2.js';

	document.querySelector('.md2').innerHTML = await compileMd2(source);
</script>
```

Two URLs, no build step, no package manager. Useful for docs pages, sandboxed iframes, and anywhere a page receives MD2 source and renders it client-side — the source travels instead of the compiled HTML, which is dramatically smaller. Use `md2.standalone.css` when the host page has no design system, or `md2.css` when you supply the tokens yourself.

## Compiling

Three entry points, all in `markus-md2` (or `markus-md2/compile`):

| Function                          | Returns                       | Use when                                            |
| --------------------------------- | ----------------------------- | --------------------------------------------------- |
| `compileMd2(source)`              | `Promise<string>`             | Normal async rendering                              |
| `compileMd2Sync(source)`          | `string`                      | Sync contexts — templates, CLI tools                |
| `compileMd2WithDiagnostics(source)` | `Promise<{ html, diagnostics }>` | Editors, linting, publish pipelines that report problems |

Diagnostics are structured, never thrown, and never logged:

```js
const { html, diagnostics } = await compileMd2WithDiagnostics(source);
// [{ severity: 'warning', code: 'MD2_ORPHAN_FENCE', message: '…', line: 30, column: 1 }]
```

Codes: `MD2_UNKNOWN_DIRECTIVE`, `MD2_BAD_SEVERITY`, `MD2_FIGURE_MISSING_SRC`, `MD2_CHART_NO_DATA`, `MD2_CHART_BAD_TYPE`, `MD2_FLOW_NO_NODES`, `MD2_COMPARE_TOO_FEW_OPTIONS`, `MD2_ORPHAN_TAB`, `MD2_ORPHAN_STEP`, `MD2_ANNOTATE_RANGE_REVERSED`, `MD2_COLUMNS_NO_CHILDREN`, `MD2_ORPHAN_FENCE`, `MD2_COMPILE_THROW`.

## Directives

| Directive        | Shape     | What it renders                                        |
| ---------------- | --------- | ------------------------------------------------------ |
| `callout`        | container | Severity-coloured aside, optional icon and dismiss      |
| `columns` / `column` | container | Responsive card grid                                |
| `details`        | container | Native `<details>` disclosure                           |
| `risk-map`       | container | Index of files or sections with severity badges         |
| `tabs` / `tab`   | container | CSS-only tabs (radio inputs, no JavaScript)             |
| `steps` / `step` | container | Numbered sequence with current/pending states           |
| `figure`         | leaf      | Image with caption and credit                           |
| `timeline` / `event` | container | Time-stamped incident or history log                |
| `compare` / `option` | container | Side-by-side options, doubles as a vote picker      |
| `tree`           | container | File tree from a nested list                            |
| `flow`           | container | SVG flowchart from node and edge lines                  |
| `chart`          | container | SVG bar, line, or sparkline chart with a data table      |
| `annotate-code`  | container | Syntax-highlighted code with per-line severity notes     |
| `badge`          | inline    | Severity pill                                           |
| `jump`           | inline    | In-page anchor link                                     |

Severities are `info`, `warning`, `blocking`, `success`, `nit`. Anything else coerces to `info`.

### Nesting: use a longer outer fence

`remark-directive` fences are length-sensitive, so a `:::` block inside another `:::` block closes the outer one early:

```md
::::tabs
:::tab[First]
Body.
:::
::::
```

Three colons inside, four outside. Same for `steps`/`step`, `columns`/`column`, `timeline`/`event`, `compare`/`option`. Stray closers are reported as `MD2_ORPHAN_FENCE`.

## Styling

The stylesheet is plain CSS with no build step:

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

**You have your own design system.** Map the tokens onto it — this is the whole integration:

```css
.md2 {
	--md2-info: var(--your-accent);
	--md2-blocking: var(--your-danger);
	--md2-bg: var(--your-surface);
	--md2-text: var(--your-text);
	/* …fifteen in total, listed in css/md2-host.css */
}
```

For `<link>` tags, inlined `<style>` blocks, or sandboxes that block extra requests, the build emits flattened single files: `dist/md2.bundle.css` (imports resolved) and `dist/md2.standalone.css` (bundle plus host tokens, works in a page with no design system at all).

Built-in alternate themes — sepia, newspaper, high-contrast, solarized — apply via `data-md2-theme` on the article wrapper.

## Auto-upgrade

Promote plain Markdown to MD2 before rendering. Conservative by design: it only rewrites patterns it recognises unambiguously, it never touches existing directives, and it's idempotent.

```js
import { upgradeMarkdown } from 'markus-md2/upgrade';

const { source, diagnostics } = upgradeMarkdown('> **Note:** heads up');
// ':::callout{severity=info}\nheads up\n:::'
```

Useful when a document arrives from a tool that doesn't know MD2 — the render still gets structure.

## Markup contract

The compiler emits semantic HTML with stable `.md2-*` class names. Those names are the contract between the compiler and the stylesheet: the tests assert them, and CSS in the wild depends on them. They won't change without a major version.

## Development

```bash
npm install
npm test          # 142 specs
npm run build     # tsc + flattened stylesheets
```

## License

MIT
