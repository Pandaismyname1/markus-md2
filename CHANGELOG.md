# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Emitted `.md2-*` class names are part of the public API — they won't change outside a major version.

## [Unreleased]

## [0.2.0] — 2026-08-19

### Fixed

- **Tables didn't render.** The compiler ran plain `remark-parse`, which is CommonMark and has no table syntax, so a GFM pipe table fell through as a single paragraph — the delimiter row and every `|` visible as text. `remark-gfm` is now part of the pipeline (and of the `upgradeMarkdown` parser, so both agree on where a table starts and ends), which also brings strikethrough, task lists, autolink literals and footnotes. The browser bundle grows by roughly 37 KB.

### Added

- **Table styles.** `css/md2.css` now styles `table`, `th` and `td` from the `--md2-*` token layer: a bordered header row on `--md2-bg-soft`, per-cell rules, and horizontal scrolling for a table wider than its column. Column alignment from the delimiter row is honoured. Visually hidden tables — the `chart` data table — are excluded.

## [0.1.1] — 2026-07-29

### Changed

- **Distribution is GitHub-only.** Releases are git tags, served to browsers by jsDelivr and installed for Node with `npm install github:Pandaismyname1/markus-md2#<tag>`. The package is not published to the npm registry, and `package.json` is marked private so it can't be by accident. Each release attaches the browser bundle and the flattened stylesheets for anyone who prefers to vendor a file.

### Fixed

- **Resource exhaustion in `annotate-code`.** An annotation range (`@1-1000000000`) was iterated without clamping to the length of the code block, allocating one map entry per line in the range. Roughly 70 bytes of input could exhaust the heap and take the process down — uncatchably, since it's an allocation failure rather than a thrown error. Ranges are now clamped to the code that exists.
- **CSS injection through `:::columns`.** The `min` and `gap` attributes were concatenated into a `style` attribute, so a value containing a semicolon could add arbitrary declarations — a full-viewport `position: fixed` overlay, or an outbound `url()` request — from source containing no HTML. Both are now validated as CSS lengths and fall back to the default otherwise.
- **Import-time side effects in the browser bundle.** Prism's main entry bundles its auto-run and file-highlight plugins, so importing `browser/md2.js` registered a `DOMContentLoaded` handler, highlighted the host page's DOM, and fetched every `pre[data-src]` URL on it. The bundle now sets Prism's manual flag, with a regression test against the committed artifact.

### Added

- Community and contribution docs, issue and pull request templates, a release workflow, and the `md2-mode` skill for Claude Code.

## [0.1.0] — 2026-07-29

First public release. Extracted from the Markus app with no behaviour changes; all 142 specs moved with it and pass standalone.

### Added

- **Compiler** — `compileMd2`, `compileMd2Sync`, and `compileMd2WithDiagnostics`, built on unified, remark-parse, and remark-directive.
- **Twenty directive names** — callout, columns, details, risk-map, tabs, steps, figure, timeline, compare, tree, flow, chart, annotate-code and the inline badge and jump, plus the five children an author writes directly: column, tab, step, event, option.
- **Structured diagnostics** — thirteen `MD2_*` codes from the compiler, reported as data rather than thrown or logged, with Levenshtein "did you mean" hints for unknown directive names. `upgradeMarkdown` emits a fourteenth, `MD2_UPGRADE_APPLIED`, through the same collector.
- **Auto-upgrade** — `upgradeMarkdown` promotes common Markdown patterns to MD2 directives; conservative, directive-aware, and idempotent.
- **Stylesheet** — `css/md2.css` plus three tier files and four alternate themes. Fifteen `--md2-*` colour tokens alias daisyUI semantic variables; the remaining five (`--md2-radius` and four `--md2-code-*` values for annotated code) are fixed.
- **`md2-host.css`** — the same tokens for hosts without daisyUI, in light and dark, overridable by `data-theme`.
- **Flattened stylesheets** — `dist/md2.bundle.css` and `dist/md2.standalone.css` for `<link>` tags, inline `<style>` blocks, and sandboxes that block extra requests.
- **Browser bundle** — `browser/md2.js`, a self-contained ESM build with every dependency inlined, committed so a CDN can serve it straight from git.

[Unreleased]: https://github.com/Pandaismyname1/markus-md2/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Pandaismyname1/markus-md2/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Pandaismyname1/markus-md2/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Pandaismyname1/markus-md2/releases/tag/v0.1.0
