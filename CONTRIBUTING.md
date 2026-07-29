# Contributing

Thanks for looking. MD2 is small on purpose, and the fastest way to get a change merged is to keep it that way.

## Setup

```bash
npm install
npm test        # 148 specs, ~1s
npm run build   # tsc + flattened stylesheets + browser bundle
```

Node 18+. No database, no services, no environment variables.

The compiler is *almost* a pure function from source text to HTML. One exception is worth knowing before it surprises you: `src/dir-tabs.ts` holds a module-level counter used to generate ids for `:::tabs` blocks that don't declare one, so identical input compiles to different ids on successive calls. That breaks SSR/hydration pairing and output hashing — see [known issues](docs/KNOWN_ISSUES.md). Pass an explicit `id=` to avoid it.

## How the pipeline fits together

`unified` → `remark-parse` → `remark-directive` → `md2DirectiveTransform` → `remark-rehype` → `rehype-raw` → `rehype-stringify`.

- `src/compile.ts` — the three public entry points, each bracketing the run with a diagnostics collector.
- `src/remark-md2.ts` — walks the tree and dispatches each directive. Most directives are handled inline here, including `annotate-code`, which is the largest single transform despite having its specs in `src/dir-annotate-code.spec.ts`; the ones with substantial layout logic live in `src/dir-*.ts`.
- `src/md2-utils.ts` — `coerceSeverity()` and `extractLabel()`. Use them rather than reading `node.children[0].value` directly; `extractLabel` handles labels containing colons, which the naive version drops.
- `src/diagnostics.ts` — the per-invocation collector plus the Levenshtein "did you mean" hint.

A directive transform mutates its node into either pre-rendered HTML (when it needs markup the rehype handoff can't produce — radio inputs, SVG, per-line annotations) or hast properties (when the children can flow through unchanged). Both patterns are fine; pick the lighter one that works.

## House rules

**Don't rename `.md2-*` classes.** They're the contract between the compiler and every stylesheet that consumes it, including ones outside this repo. Add new classes freely; renaming an existing one is a breaking change even if every test is updated.

**Emit diagnostics, never `console.warn`.** Any "this looks wrong" path calls `emitDiagnosticAt(node.position, …)` with a stable `MD2_*` code. Callers decide what to do about it; the compiler never prints.

**Keep the stylesheet out of the transforms.** `dir-*.ts` emits semantic HTML; how it looks is `css/`'s job. If a change needs new visual states, add a class and style it there.

**Watch the fence lengths.** `remark-directive` fences are length-sensitive, so a `:::` block inside another `:::` block closes the outer one early. Containers that hold containers need more colons: `::::steps` around `:::step`. This catches everyone, including the people who wrote it.

## Tests

Specs live next to their source as `*.spec.ts` and run in Node. Assertions are required — a spec with none fails.

```bash
npx vitest --run src/dir-chart.spec.ts
```

New directives need coverage of the happy path, the diagnostic path (what happens when the input is malformed), and idempotency where relevant.

## Commits and PRs

Work on a branch, describe what a reader sees differently, and include the MD2 source plus a screenshot for anything visual. Run `npm test` and `npm run build` before opening the PR — CI runs both on Linux, and the build regenerates `browser/` and the flattened stylesheets, which are committed.

### About the lock file

CI runs `npm install`, not `npm ci`. npm resolves optional platform packages differently per operating system, so a `package-lock.json` generated on Windows describes a tree Linux can't satisfy — `@emnapi/*` lands nested under rolldown's wasm binding at one version, while Linux wants another hoisted — and `npm ci` refuses to install rather than adapting.

The lock stays committed because it's still useful locally. Just don't expect `npm ci` to work across platforms, and don't be alarmed when a lock regenerated on your machine shows a large diff.
