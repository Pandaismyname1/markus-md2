# Known issues

Reproduced against 0.1.0. Each one has a runnable repro so it can be turned into a spec directly.

## 1. Stray fences nested inside a container aren't diagnosed

`MD2_ORPHAN_FENCE` catches a leftover `:::` only when it ends up as a root-level paragraph. When the stray lands *inside* another container — the more common case, since that's where fence-length mistakes happen — it renders as a literal `:::` in the document with no diagnostic at all.

```js
// Diagnosed: stray ends up at root level
await compileMd2WithDiagnostics(':::columns\n\n:::column\nA\n:::\n\n:::\n\n## Next');
// → diagnostics: [MD2_ORPHAN_FENCE @ line 11]

// Silent: stray ends up inside .md2-column
await compileMd2WithDiagnostics('::::columns\n\n:::column\n**Two**\n\n:::details[Inner]\nBody.\n:::\n\n:::\n\n::::');
// → diagnostics: []   ...and the output contains <p>:::</p>
```

The fix is to walk the whole tree for orphan paragraphs rather than checking root children. Worth doing: this is the single most common authoring mistake in MD2, three of four documents written during one session hit it, and the silent variant is the one that reaches a reader.

## 2. `:::flow{id=…}` doesn't emit an anchor

The `id` attribute is accepted and dropped, so `:jump[…]{to=#pipeline}` has nothing to land on.

```js
await compileMd2(':::flow{direction=LR id=pipeline}\na[A]\nb[B]\n\na -> b\n:::');
// → <figure class="md2-flow" data-direction="LR">   ...no id
```

Workaround today is an inline `<a id="pipeline"></a>` next to the block. The fix is to pass `id` through to the emitted element — and the same question applies to every other block directive that could be a jump target.

## 3. Chart axis ticks aren't rounded to nice numbers

Ticks are computed as `max × 1.1` split into fifths, so human-scale data gets fractional gridlines.

```js
await compileMd2(':::chart{type=bar title=T}\nMode A: 38\nMode B: 2\n:::');
// → tick labels: 0 | 10.5 | 20.9 | 31.4 | 41.8
```

Large values hide it — thousands round to `1.3k`, `2.5k` — which is why the kitchen-sink fixture never showed the problem. A standard "nice number" pass (snap the step to 1, 2, or 5 × 10ⁿ) would give `0 | 10 | 20 | 30 | 40`.
