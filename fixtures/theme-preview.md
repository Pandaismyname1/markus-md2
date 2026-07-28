# MD2 theme preview

A compact spread of every directive × every severity. Flip the theme toggle
in the demo header and watch each block restyle without a page reload.

:badge[v0.2]{severity=info} :badge[preview]{severity=success} :badge[touch]{severity=warning} :badge[hot]{severity=blocking} :badge[nit]{severity=nit}

## Callouts

:::callout{severity=info title="Info"}
Plain informational note — keeps the same shape as the original `.md2-callout`
but pulls its colour from daisyUI's `--color-info`.
:::

:::callout{severity=success title="Success" icon=success}
Tier 4 enhancement — `success` severity has its own background tint.
:::

:::callout{severity=warning title="Warning" icon=warning}
Something is off but not broken. Border tints to `--color-warning`.
:::

:::callout{severity=blocking title="Blocking" icon=error}
Hard error. Pulls from `--color-error`.
:::

:::callout{severity=nit title="Nit"}
Low-priority polish; uses the neutral palette.
:::

:::callout{severity=warning icon=warning title="Dismissible" dismissible}
Has a × in the corner — still themed correctly.
:::

## Columns

::::columns{cols=3}

:::column
**One**

Cards use `--md2-bg` and `--md2-border`, so they swap surface colour with the theme.
:::

:::column
**Two**

Same shape, lighter on dark mode thanks to daisyUI's `--color-base-100/200/300` set.
:::

:::column
**Three**

`:badge[ok]{severity=success}` inline.
:::

::::

## Tabs

::::tabs{id=preview default="Light"}

:::tab[Light]
The bar uses `--md2-bg-soft`; the active label flips to `--md2-info`.
:::

:::tab[Dark]
Same colour vars resolve to dark-mode palette automatically.
:::

:::tab[System]
Mirrors `prefers-color-scheme` (configurable in the toggle).
:::

::::

## Steps

::::steps{start=1}

:::step[Pick a token source]{status=done}
daisyUI v5 ships `--color-base-100/200/300/content` plus semantic colour vars.
:::

:::step[Map MD2 tokens onto daisyUI]{status=current}
Single token block in `md2.css` does the bridging.
:::

:::step[Restyle automatically]{status=pending}
Toggle the `data-theme` attribute → every directive re-themes.
:::

::::

## Timeline

::::timeline{title="Severity sampler"}

:::event[T-3]{severity=info}
Info event — neutral dot, info-tinted text.
:::

:::event[T-2]{severity=warning}
Warning event.
:::

:::event[T-1]{severity=blocking}
Blocking event.
:::

:::event[T]{severity=success}
Success event.
:::

::::

## Compare / vote

::::compare{title="Severity-coloured options"}

:::option[Alpha]{key=A severity=info}
Info option — key chip carries the matching tint.
:::

:::option[Bravo]{key=B severity=warning}
Warning option.
:::

:::option[Charlie]{key=C severity=blocking}
Blocking option.
:::

:::option[Delta]{key=D severity=success}
Success option.
:::

::::

## Risk map

:::risk-map{title="Touchpoints"}

- :badge[layout.css]{severity=info} :jump[wire]{to=#callouts}
- :badge[md2.css]{severity=warning} :jump[rebase]{to=#columns}
- :badge[dir-tier-*.css]{severity=blocking} :jump[touch]{to=#tabs}
- :badge[diagnostics]{severity=success} :jump[done]{to=#steps}

:::

## Details

:::details[Toggle details]
Closed by default; flips background colour when open. Inner prose inherits the theme.
:::

## Tree

:::tree

- daisyUI tokens
  - `--color-base-100` :badge[surface]{severity=info}
  - `--color-base-200` :badge[soft]{severity=info}
  - `--color-base-300` :badge[border]{severity=info}
  - `--color-base-content` :badge[text]{severity=info}
- Severity
  - `--color-info` :badge[info]{severity=info}
  - `--color-warning` :badge[warn]{severity=warning}
  - `--color-error` :badge[blocking]{severity=blocking}
  - `--color-success` :badge[success]{severity=success}
  - `--color-neutral` :badge[nit]{severity=nit}

:::

## Flow

:::flow{direction=LR title="Theme switch flow"}
sys[System]{kind=start}
choose[User toggles]
light[Light]{kind=success}
dark[Dark]{kind=process}
applied[data-theme applied]{kind=success}

sys -> choose
choose -light-> light
choose -dark-> dark
light -> applied
dark -> applied
:::

## Chart

:::chart{title="Severity counts" kind=bar}
info, 12
warning, 7
blocking, 3
success, 9
nit, 5
:::

Inline sparkline: severity ramp :chart[3,5,7,12,9,5]

## Annotated code

:::annotate-code{lang=ts}

```ts
export function tint(severity: 'info' | 'warning' | 'blocking' | 'success' | 'nit') {
	return `var(--md2-${severity}-bg)`;
}
```

@1 info: the helper reads the MD2 token alias.
@2 nit: consider `as const` on the union.

:::

## Figure

:::figure{src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 60'%3E%3Crect width='200' height='60' rx='6' fill='%23334155'/%3E%3Ctext x='100' y='38' font-family='ui-sans-serif,system-ui' font-size='18' font-weight='700' text-anchor='middle' fill='%23e2e8f0'%3Etheme preview%3C/text%3E%3C/svg%3E" alt="Theme preview placeholder"}
Placeholder figure showing border + background pull from theme vars.
:::
