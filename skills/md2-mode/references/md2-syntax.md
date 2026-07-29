# MD2 syntax reference

Every directive, with the exact syntax the compiler accepts. Severities are always `info`, `warning`, `blocking`, `success`, `nit`.

Remember the fence rule throughout: a container holding other containers needs more colons than its children (`::::steps` around `:::step`).

## Contents

- [Callout](#callout)
- [Badge and jump](#badge-and-jump)
- [Columns](#columns)
- [Details](#details)
- [Risk map](#risk-map)
- [Tabs](#tabs)
- [Steps](#steps)
- [Figure](#figure)
- [Timeline](#timeline)
- [Compare](#compare)
- [Tree](#tree)
- [Flow](#flow)
- [Chart](#chart)
- [Annotated code](#annotated-code)

## Callout

```md
:::callout{severity=blocking title="Blocks release" icon=warning}
Migration 0042 is not applied on prod.
:::
```

`icon` accepts `info`, `warning`, `error`, `success`, `tip`, `question`, `lock`, `bolt`. Add `dismissible` for a close button. Both `title` and `icon` are optional — an icon with no title renders icon-only.

## Badge and jump

Inline, inside prose:

```md
:badge[4 services]{severity=success} shipped, :badge[p95 +12%]{severity=warning} to watch.
See the pipeline :jump[below]{to=#flow}.
```

`jump` targets need a real anchor in the document — most directives don't emit `id` attributes, so add one with inline HTML (`<a id="flow"></a>`) next to the heading you're linking to.

## Columns

```md
::::columns

:::column
**Ready**
Four services green on canary.
:::

:::column
**Watch**
Checkout latency up since Tuesday.
:::

::::
```

Attributes on `columns`: `cols=3` to lock the count, `min=280px` for the wrap threshold, `gap=0.75rem`.

## Details

```md
:::details[Out of scope for this review]
Three things came up that don't block the merge.
:::
```

## Risk map

An index of what's affected, with severity at a glance:

```md
::::risk-map{title="Files changed"}

- :badge[useOptimisticTasks.ts]{severity=blocking} concurrency bug
- :badge[TaskList.svelte]{severity=warning} unstable key
- :badge[schema.ts]{severity=success} clean

::::
```

## Tabs

```md
::::tabs{id=auth}

:::tab[Email]
Password flow, two round trips.
:::

:::tab[GitHub]
OAuth round trip, then a session cookie.
:::

::::
```

CSS-only — no JavaScript. The first tab renders selected unless another carries `active`.

## Steps

```md
::::steps

:::step[Apply the migration]{status=current}
Takes about 40 s, no lock on orders.
:::

:::step[Roll the API tier]{status=pending}
25% then 50% then 100%.
:::

::::
```

`status` is `current`, `pending`, or omitted for a plain numbered step. Use it to show where the reader actually is in a sequence.

## Figure

```md
:::figure{src="https://example.com/diagram.png" alt="Request pipeline" credit="Internal docs"}
Caption text sits in the body.
:::
```

## Timeline

```md
::::timeline{title="Incident 2026-07-28"}

:::event[12:01]{severity=blocking}
Pager fired, 5xx at 14%.
:::

:::event[12:20]{severity=success}
Resolved, post-mortem Friday.
:::

::::
```

The label in brackets is free text — a time, a date, a version.

## Compare

```md
::::compare{title="Which rollout?"}

:::option[All at once]{key=A severity=warning}

- Simplest mental model
- 100% blast radius

:::

:::option[Canary]{key=B severity=success}

- Contained blast radius
- 30 min slower

:::

::::
```

Adding `key=` to any option switches the whole block into vote mode and renders key chips on every card. Leave keys off for a plain visual comparison.

## Tree

```md
:::tree

- src/
  - lib/
    - md2/
      - compile.ts
      - remark-md2.ts :badge[hot]{severity=warning}

:::
```

Indentation drives the structure; inline badges are allowed on any line.

## Flow

```md
:::flow{direction=LR title="Deploy pipeline"}
push[git push]{kind=start}
ci[CI checks]
canary[Canary 10%]{kind=decision}
rollback[Auto-rollback]{kind=fail}
done[Promote 100%]{kind=success}

push -> ci
ci -> canary
canary -ok-> done
canary -fail-> rollback
:::
```

Node lines come first, then a blank line, then edges. `kind` is `start`, `process` (default), `decision`, `fail`, or `success`. Label an edge with `-label->`. `direction` is `LR` or `TB`.

## Chart

```md
:::chart{type=bar title="Tokens by format"}
MD2: 811
HTML: 4548
:::
```

```md
:::chart{type=line title="API p95 (ms)" baseline=200}
2026-05-09: 180
2026-05-10: 210
:::
```

```md
:::chart{type=sparkline}
12 18 22 19 24 31 29 34
:::
```

Bar and line take `Label: value` lines; sparkline takes bare numbers. Every chart also emits a visually-hidden data table, so the numbers survive for screen readers.

## Annotated code

```md
:::annotate-code{lang=ts collapsed}

```ts
export function useOptimisticTasks(qc: QueryClient) {
	return useMutation({ mutationFn: createTask });
}
```

@2 blocking: reuse a stable idempotency key across retries.
@1-3 warning: the whole body is missing a cancelQueries call.

:::
```

Annotation lines come after the fence: `@N severity: text`, or `@N-M` for a range. Two annotations on the same line stack. `collapsed` renders the block folded with a summary of its findings — good for long files where only the notes matter.

Languages come from Prism; `ts`, `tsx`, `js`, `jsx`, `svelte`, `bash`, `json`, `css`, `html`, `sql`, `python`, `go`, `rust` all highlight.
