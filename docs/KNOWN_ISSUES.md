# Known issues

Reproduced against the current build. Each has a runnable repro so it can become a spec directly.

Fixed during pre-release review, so no longer listed here: an unclamped `annotate-code` range that could exhaust the heap, a CSS injection through `:::columns{min}`, and import-time side effects in the browser bundle. See the [changelog](../CHANGELOG.md).

## 1. Stray fences nested inside a container aren't diagnosed

`MD2_ORPHAN_FENCE` only scans the document's top level, so a leftover `:::` is reported when it lands as a root-level paragraph and passes silently when it lands anywhere else.

```js
// Diagnosed
await compileMd2WithDiagnostics(':::columns\n\n:::column\nA\n:::\n\n:::\n\n## Next');
// → [{ code: 'MD2_ORPHAN_FENCE', line: 7 }]

// Silent — the stray renders as <p>:::</p> inside .md2-columns, as a sibling of .md2-column
await compileMd2WithDiagnostics(
	'::::columns\n\n:::column\n**Two**\n\n:::details[Inner]\nBody.\n:::\n\n:::\n\n::::'
);
// → []
```

The fix is to walk the whole tree for orphan paragraphs rather than checking root children. Worth doing: this is the most common authoring mistake in MD2, and the silent variant is the one that reaches a reader.

## 2. Same-length nesting can delete content with no diagnostic

A worse expression of the same root cause. When a container closes early, trailing content in the outer block doesn't become a stray `:::` — it disappears.

```js
const src = `::::steps

:::step[Deploy]
:::callout{severity=warning}
Watch p95 after the roll.
:::
Then verify dashboards.
:::

::::`;

const { html, diagnostics } = await compileMd2WithDiagnostics(src);
// diagnostics: []
// html contains neither "Then verify dashboards" nor class="md2-callout"
```

A callout inside a step is a natural thing to write, and it needs `:::::steps` › `::::step` › `:::callout`. Getting it wrong loses text with no signal on either side. The same shape affects `tabs`/`tab`, `timeline`/`event`, and `compare`/`option`.

## 3. `:::flow{id=…}` doesn't emit an anchor

The `id` attribute is accepted and dropped, so `:jump[…]{to=#pipeline}` has nothing to land on.

```js
await compileMd2(':::flow{direction=LR id=pipeline}\na[A]\nb[B]\n\na -> b\n:::');
// → <figure class="md2-flow" data-direction="LR">   …no id
```

Workaround: an inline `<a id="pipeline"></a>` next to the block. The fix is to pass `id` through — and the same question applies to every block directive that could be a jump target.

## 4. Chart axis ticks aren't rounded to nice numbers

`buildYTicks` divides `max × 1.1` into four intervals, so most real data produces fractional gridlines.

```js
await compileMd2(':::chart{type=bar title=T}\nMode A: 38\nMode B: 2\n:::');
// tick labels: 0 | 10.5 | 20.9 | 31.4 | 41.8
```

Large values only *look* better because labels are abbreviated — `fixtures/kitchen-sink.md` renders `0 | 1.3k | 2.5k | 3.8k | 5k`, which is the same non-nice sequence with the digits hidden. A standard nice-number pass (snap the step to 1, 2, or 5 × 10ⁿ) fixes both.

## 5. `:::tabs` without an explicit `id` isn't deterministic

`src/dir-tabs.ts` keeps a module-level counter for generated ids, so the same source compiles differently on each call within a process.

```js
const src = '::::tabs\n:::tab[One]\nA\n:::\n::::';
(await compileMd2(src)) === (await compileMd2(src)); // false — t1, then t2
```

Server-rendered and client-rendered output therefore disagree, which breaks the radio-group tab switching on hydration, and makes output hashing or caching unstable. Passing `id=` avoids it. A fix would derive the id from document position or content instead of a counter.

## 6. Annotated code ignores the active theme

`--md2-code-bg`, `--md2-code-bg-2`, `--md2-code-fg` and `--md2-code-muted` are hardcoded slate values rather than derived from the token layer, so an `annotate-code` block stays dark under sepia, newspaper, high-contrast and solarized, and under a host design system mapped through `md2-host.css`.

Deliberate to a point — code blocks often want their own background — but it means the four themes aren't complete, and a light-on-light host gets an abrupt dark rectangle. Routing these through the theme layer with sensible defaults would close it.
