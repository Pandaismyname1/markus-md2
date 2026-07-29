# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Emitted `.md2-*` class names are part of the public API — they won't change outside a major version.

## [Unreleased]

### Added

- Community and contribution docs, issue and pull request templates, a release workflow, and the `md2-mode` skill for Claude Code.

## [0.1.0] — 2026-07-29

First public release. Extracted from the Markus app with no behaviour changes; all 142 specs moved with it and pass standalone.

### Added

- **Compiler** — `compileMd2`, `compileMd2Sync`, and `compileMd2WithDiagnostics`, built on unified, remark-parse, and remark-directive.
- **Fifteen directives** — callout, columns, details, risk-map, tabs, steps, figure, timeline, compare, tree, flow, chart, annotate-code, plus the inline badge and jump.
- **Structured diagnostics** — thirteen `MD2_*` codes reported as data rather than thrown or logged, with Levenshtein "did you mean" hints for unknown directive names.
- **Auto-upgrade** — `upgradeMarkdown` promotes common Markdown patterns to MD2 directives; conservative, directive-aware, and idempotent.
- **Stylesheet** — `css/md2.css` plus three tier files and four alternate themes, all driven by fifteen `--md2-*` tokens that alias daisyUI semantic variables.
- **`md2-host.css`** — the same tokens for hosts without daisyUI, in light and dark, overridable by `data-theme`.
- **Flattened stylesheets** — `dist/md2.bundle.css` and `dist/md2.standalone.css` for `<link>` tags, inline `<style>` blocks, and sandboxes that block extra requests.
- **Browser bundle** — `browser/md2.js`, a self-contained ESM build with every dependency inlined, committed so a CDN can serve it straight from git.

[Unreleased]: https://github.com/Pandaismyname1/markus-md2/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Pandaismyname1/markus-md2/releases/tag/v0.1.0
