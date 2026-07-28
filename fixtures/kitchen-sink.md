# MD2 v0.2 — kitchen sink

:badge[v0.2]{severity=info} :badge[Demo]{severity=warning}

A single fixture exercising every directive in MD2 v0.2 — old and new. Use it as a smoke test and as a discovery surface.

::::risk-map{title="In this fixture"}

- :badge[callout]{severity=info} :jump[jump]{to=#callout-with-icon}
- :badge[columns]{severity=info} :jump[jump]{to=#columns}
- :badge[tabs]{severity=info} :jump[jump]{to=#tabs}
- :badge[steps]{severity=info} :jump[jump]{to=#steps}
- :badge[figure]{severity=info} :jump[jump]{to=#figure}
- :badge[timeline]{severity=warning} :jump[jump]{to=#timeline}
- :badge[compare / vote]{severity=blocking} :jump[jump]{to=#compare}
- :badge[tree]{severity=info} :jump[jump]{to=#tree}
- :badge[flow]{severity=success} :jump[jump]{to=#flow}
- :badge[chart]{severity=success} :jump[jump]{to=#chart}
- :badge[annotate-code]{severity=blocking} :jump[jump]{to=#annotate-code}

::::

## Callout with icon <a id="callout-with-icon"></a>

:::callout{severity=success icon=success title="Tier 4 enhancement"}
Callouts now take an `icon` keyword (info/warning/error/success/tip/question/lock/bolt) and a `dismissible` flag.
:::

:::callout{severity=warning icon=warning title="Dismissible" dismissible}
Click the × in the corner to hide this callout. No JS framework needed — the dismiss button uses an inline `onclick` to toggle the `hidden` attribute.
:::

:::callout{severity=info icon=tip}
Icon-only callout — no title, just a tip glyph and prose.
:::

## Columns <a id="columns"></a>

Custom `min`, `gap`, and `cols` attrs control the layout.

::::columns{cols=3 gap=0.75rem}

:::column
**Auto layout**

`:::columns` with no attrs wraps responsively at the default `220px` minimum.
:::

:::column
**Explicit count**

`:::columns{cols=3}` locks to three columns no matter the viewport.
:::

:::column
**Tight gap**

`gap=0.75rem` tightens the spacing between cards.
:::

::::

## Tabs <a id="tabs"></a>

Note the four-colon outer fence so the inner three-colon `:::tab` children nest correctly.

::::tabs{id=auth default="GitHub"}

:::tab[Email]

```ts
await auth.api.signInEmail({ email, password });
```

Default email-and-password flow. Two round trips.
:::

:::tab[GitHub]

```ts
await auth.api.signInSocial({ provider: 'github' });
```

OAuth round trip → callback → session cookie.
:::

:::tab[Magic link]
Send a one-shot URL by email. Click to resolve a session. No password storage.
:::

::::

## Steps <a id="steps"></a>

::::steps{start=1}

:::step[Install dependencies]

```bash
npm install
```

:::

:::step[Start Postgres]{status=current}

```bash
npm run db:start
```

Brings up the local Docker compose service. Takes about 8 s.
:::

:::step[Push the schema]{status=pending}

```bash
npm run db:push
```

:::

:::step[Run the dev server]{status=pending}

```bash
npm run dev
```

Open http://localhost:5173.
:::

::::

## Figure <a id="figure"></a>

:::figure{src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 80'%3E%3Crect width='200' height='80' rx='8' fill='%230f172a'/%3E%3Ctext x='100' y='48' font-family='ui-sans-serif,system-ui' font-size='22' font-weight='700' text-anchor='middle' fill='%23e2e8f0'%3EMD2 figure%3C/text%3E%3C/svg%3E" alt="Inline SVG placeholder" credit="Inline SVG"}
A placeholder figure inlined as a data URL so the demo renders without external assets.
:::

## Timeline <a id="timeline"></a>

::::timeline{title="Incident 2026-05-14"}

:::event[12:01]{severity=blocking}
Pager fired. API 5xx rate spiked to 14%.
:::

:::event[12:03]{severity=warning}
Investigation started. Suspected the new optimistic-mutations branch.
:::

:::event[12:08]{severity=warning}
Rollback initiated. Image tag reverted to last-known-good.
:::

:::event[12:14]{severity=info}
5xx rate dropping. Watching the canary cohort.
:::

:::event[12:20]{severity=success}
Resolved. Post-mortem scheduled for Friday.
:::

::::

## Compare / vote <a id="compare"></a>

The `compare` directive doubles as a vote / option picker — when any option carries a `key=` attribute, the mode auto-switches and key chips render on every card.

::::compare{title="Which deploy strategy?"}

:::option[All at once]{key=A severity=warning}

- Pros: simplest mental model
- Cons: 100% blast radius on a bad change
  :::

:::option[Canary 10% → 50% → 100%]{key=B severity=success}

- Pros: contained blast radius
- Cons: 30 min slower per rollout
  :::

:::option[Blue / green]{key=C severity=info}

- Pros: instant rollback by DNS flip
- Cons: 2× compute during the cutover window
  :::

::::

Used purely for visual diff (no keys), the same directive lays cards out side-by-side:

::::compare{title="Before vs after"}

:::option[Before]{severity=blocking}
Hand-rolled HTML, ~5× the tokens for the same rendered output.
:::

:::option[After]{severity=success}
MD2 source, renderer-emitted HTML. Token-cheap on the wire.
:::

::::

## Tree <a id="tree"></a>

:::tree

- src/
  - lib/
    - md2/
      - compile.js
      - remark-md2.js :badge[hot]{severity=warning}
      - prism-langs.js
      - dir-tabs.js
      - dir-compare.js :badge[new]{severity=success}
      - css/
        - dir-tier-1.css
        - dir-tier-2.css
        - dir-tier-3.css
    - server/
      - auth.ts
      - db/
        - index.ts
        - schema.ts
  - routes/
    - +layout.svelte
    - +page.svelte
    - demo/
      - md2/
      - md2-viewer/
      - md2-editor/

:::

## Flow <a id="flow"></a>

:::flow{direction=LR title="Deploy pipeline"}
push[git push]{kind=start}
ci[CI checks]
build[Image build]
canary[Canary 10%]{kind=decision}
rollback[Auto-rollback]{kind=fail}
done[Promote 100%]{kind=success}

push -> ci
ci -> build
build -> canary
canary -ok-> done
canary -fail-> rollback
:::

## Chart <a id="chart"></a>

:::::columns{cols=2}

::::column
:::chart{type=bar title="Tokens by format"}
MD2: 811
HTML: 4548
Plain text: 200
:::
::::

::::column
:::chart{type=line title="API p95 (ms)" baseline=200}
2026-05-09: 180
2026-05-10: 210
2026-05-11: 240
2026-05-12: 230
2026-05-13: 205
2026-05-14: 195
:::
::::

:::::

Inline sparkline in a sentence — week-over-week load average:

:::chart{type=sparkline}
12 18 22 19 24 31 29 34
:::

## Annotated code with ranges + stacked annotations <a id="annotate-code"></a>

Tier 4 added range annotations (`@7-10`) and stacked annotations (two `@N` lines targeting the same line render both rows).

:::annotate-code{lang=ts}

```ts
export function useOptimisticTasks(qc: QueryClient) {
	const key = ['tasks'] as const;
	return useMutation({
		mutationFn: createTask,
		onMutate: async (input) => {
			const prev = qc.getQueryData<Task[]>(key) ?? [];
			const optimistic = { ...input, id: crypto.randomUUID(), pending: true };
			qc.setQueryData<Task[]>(key, [optimistic, ...prev]);
			return { prev, tempId: optimistic.id };
		},
		onError: (_e, _v, ctx) => {
			if (ctx) qc.setQueryData(key, ctx.prev);
		},
		onSuccess: (saved, _v, ctx) => {
			qc.setQueryData<Task[]>(key, (cur = []) =>
				cur.map((t) => (t.id === ctx?.tempId ? saved : t))
			);
		}
	});
}
```

@5-9 warning: the entire onMutate body is missing a cancelQueries call at the top.
@7 blocking: optimistic row should reuse a stable idempotency key across retries.
@7 nit: extracting the optimistic builder into a helper would aid testability.
@12 info: rollback uses cached prev — fine, but worth a comment so future readers don't worry about stale data.

:::

## Inline badges with icons

Tier 4 also added `icon` to inline badges:

:badge[Required]{severity=blocking icon=warning} :badge[Optional]{severity=info icon=info} :badge[Recommended]{severity=success icon=success} :badge[Note]{severity=nit icon=tip}
