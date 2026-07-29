# Autopilot contract — prepare markus-md2 for public use

Frozen scope for the unattended run started 2026-07-29. Items are checked off only when verified.

## A. GitHub setup

- [x] A1 Issue templates — bug report, feature request, `config.yml` with contact links
- [x] A2 Pull request template
- [x] A3 `CONTRIBUTING.md` — dev setup, test/build commands, the fence-length gotcha, PR expectations
- [x] A4 `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1
- [x] A5 `SECURITY.md` — supported versions, private reporting route
- [x] A6 `CHANGELOG.md` — Keep a Changelog format, 0.1.0 entry
- [x] A7 Release workflow — publish to npm on `v*` tag, with provenance, SHA-pinned actions, idempotent re-runs
- [x] A8 `dependabot.yml` — npm + github-actions, weekly
- [x] A9 `.gitattributes` (LF normalisation) and `.editorconfig`
- [x] A10 Repo metadata — description and 12 topics via `gh`; homepage left unset deliberately
- [x] A11 README badges that resolve today (CI, licence, node — no dead npm badge before publish)

## B. README

- [x] B1 Rewritten top: what MD2 is, why it exists, one-glance example
- [x] B2 Install + CDN sections accurate against the published tag
- [x] B3 **md2-mode skill install section** — what it changes, install for macOS/Linux and Windows,
      how to turn it on and off, what it costs
- [x] B4 Directive reference and theming kept, links verified

## C. The skill ships from this repo

- [x] C1 `skills/md2-mode/` copied in
- [x] C2 Install verified by running the documented commands into a throwaway home directory,
      both bash and PowerShell

## D. Known issues recorded

- [x] D1 `docs/KNOWN_ISSUES.md` — now six issues, each with a verified reproduction

## E. Verification

- [x] E1 `npm install && npm test && npm run build` clean (148 specs)
- [x] E2 Every workflow and template YAML parses; both validated against the published GitHub schemas
- [x] E3 Every relative link resolves; every external URL returns 200
- [x] E4 Multi-agent adversarial review — round 1 (four reviewers) findings all fixed; round 2 run
- [x] E5 CI green on the branch: test (20), test (22), smoke-node18
- [x] E6 PR opened with the decision log

## Scope added mid-run

Three security bugs surfaced during review. Fixing them wasn't in the frozen scope, but shipping a
public repo whose `SECURITY.md` invites reports of bugs I already knew about would have been worse.
Each has a regression test:

- [x] Resource exhaustion via an unclamped `annotate-code` range
- [x] CSS injection through `:::columns{min}` / `{gap}`
- [x] Import-time side effects in the browser bundle (Prism auto-run)

## Out of scope (deliberately)

- The four remaining compiler findings — recorded in `docs/KNOWN_ISSUES.md`. They're behaviour
  changes that deserve their own PR and tests.
- Publishing to npm — needs a credential only the user can set.
- Deleting the duplicate `skills/md2-mode/` in the private markus repo — flagged in the report.
