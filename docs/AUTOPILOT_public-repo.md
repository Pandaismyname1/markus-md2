# Autopilot contract — prepare markus-md2 for public use

Frozen scope for the unattended run started 2026-07-29. Every item below is a
deliverable. Items get checked off only when verified, not when written.

## A. GitHub setup

- [ ] A1 Issue templates — bug report, feature request, `config.yml` with contact links
- [ ] A2 Pull request template
- [ ] A3 `CONTRIBUTING.md` — dev setup, test/build commands, the fence-length gotcha, PR expectations
- [ ] A4 `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1
- [ ] A5 `SECURITY.md` — supported versions, private reporting route
- [ ] A6 `CHANGELOG.md` — Keep a Changelog format, 0.1.0 entry
- [ ] A7 Release workflow — publish to npm on `v*` tag, with provenance
- [ ] A8 `dependabot.yml` — npm + github-actions, weekly
- [ ] A9 `.gitattributes` (LF normalisation — CRLF churn already bit this repo) and `.editorconfig`
- [ ] A10 Repo metadata — description, homepage, topics via `gh`
- [ ] A11 README badges that resolve today (no dead npm badge before publish)

## B. README

- [ ] B1 Rewritten top: what MD2 is, why it exists, one-glance example
- [ ] B2 Install + CDN sections kept accurate against the published tag
- [ ] B3 **md2-mode skill install section** — the headline ask: how it changes daily
      Claude Code use, install steps for macOS/Linux and Windows, how to turn it on
      and off, what it costs
- [ ] B4 Directive reference and theming kept, links verified

## C. The skill ships from this repo

- [ ] C1 `skills/md2-mode/` (SKILL.md + references/md2-syntax.md) copied in, since the
      public repo is where users install it from
- [ ] C2 Install verified by actually running the documented commands into a temp dir

## D. Known issues recorded

- [ ] D1 `docs/KNOWN_ISSUES.md` with the three compiler findings found while dogfooding:
      nested stray fences escape `MD2_ORPHAN_FENCE`, `:::flow{id=}` emits no anchor,
      chart axis ticks aren't rounded to nice numbers

## E. Verification

- [ ] E1 `npm ci && npm test && npm run build` clean
- [ ] E2 Every workflow and template YAML parses
- [ ] E3 Every relative link in every Markdown file resolves; every external URL returns 200
- [ ] E4 Multi-agent adversarial review of docs + GitHub config, findings fixed, two clean rounds
- [ ] E5 CI green on the pushed branch
- [ ] E6 PR opened with the decision log

## Out of scope (deliberately)

- Fixing the three compiler findings — recorded in D1, not fixed here. This run is
  repo preparation; mixing behaviour changes into it would muddy both.
- Publishing to npm — requires a credential only the user can set (§2 boundary).
- Removing the duplicate `skills/md2-mode/` in the private markus repo — flagged in
  the report instead, since deleting files there is outside this repo's scope.
