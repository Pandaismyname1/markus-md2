<!-- Thanks for contributing. Keep this short — the diff says most of it. -->

## What changes

<!-- One or two sentences. If it changes rendered output, say what the reader sees differently. -->

## Why

<!-- The document shape or bug that motivated it. -->

## Checks

- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Emitted `.md2-*` class names are unchanged, or the change is deliberate and called out below

<!--
Class names are the contract between the compiler and every stylesheet in the wild,
including ones we don't control. Renaming one is a breaking change even when the
tests are updated to match — flag it explicitly rather than letting it ride along.
-->

## Rendered output

<!-- For anything visual, paste the MD2 source and a screenshot of the render. -->
