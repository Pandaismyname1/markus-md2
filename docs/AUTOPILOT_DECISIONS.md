# Decisions taken during the unattended run

Judgment calls made without asking, with the reasoning and the rejected alternative. The ones flagged **worth a second look** are where I'd most want disagreement.

## 1. The skill ships from this repository

`skills/md2-mode/` now lives here rather than only in the private app repo. This is the public artifact users install, the install command is a `git clone` of this repo, and the skill points at this repo's CDN tag — keeping it private would mean documenting an install of something nobody can fetch.

Consequence: the copy still sitting in the private repo at `skills/md2-mode/` is now a duplicate that will drift. It should be deleted there, which I did not do because that repo is outside this run's scope.

## 2. Known issues documented, not fixed

Three compiler findings (nested stray fences, `flow{id}`, chart ticks) are recorded in `docs/KNOWN_ISSUES.md` with reproductions instead of being fixed. The contract for this run was repository preparation; mixing behaviour changes into a docs-and-setup PR makes both harder to review, and the fixes deserve their own tests.

## 3. No npm badge, and a status line instead

**Worth a second look.** The package isn't published yet, so an npm version badge would render as "invalid" — worse than no badge on a first visit. The README carries a blockquoted status line saying the tag is live, the CDN works, and npm publishes once the token is configured.

The alternative was writing the README as if npm already worked. Rejected: a `npm install` line that 404s is the fastest way to lose a first-time visitor, and the repo is already public.

Once you publish, add the badge and delete the status line.

## 4. CDN install leads, npm second

Ordering follows what actually works today, and it also happens to be the strongest opening — "two URLs, no package manager" is a better hook than an install command every reader has seen before.

## 5. SECURITY.md documents unsafety instead of implying safety

**Worth a second look.** While writing it I verified that `rehype-raw` passes `<script>` through *and* that ordinary Markdown link syntax produces `javascript:` hrefs — the second one needs no raw HTML at all, which contradicted my first draft's "in scope" list.

Both are now documented as deliberate behaviour with a plain instruction to sanitise untrusted input. The alternative — staying vague — would have been a promise the compiler doesn't keep.

## 6. The release workflow refuses to publish a stale bundle

`browser/` is committed so a CDN can serve it from git, which means a tag could carry a bundle that doesn't match its own source. The workflow rebuilds and fails if `git status --porcelain browser/` is dirty, and separately fails if the tag doesn't match `package.json`. Slightly annoying when it fires; much better than a CDN serving code nobody reviewed.

## 7. Dependabot groups the unified ecosystem

`unified`, `remark-*`, `rehype-*`, `mdast-*`, `hast-*`, `unist-*` move together and are only ever tested as a set. One grouped PR beats six that each fail in isolation.

## 8. LF normalisation via `.gitattributes`

Not cosmetic: committing from Windows during this project rewrote whole files to CRLF, and a regenerated lock file dropped platform-specific optional dependencies and broke CI. `* text=auto eol=lf` prevents the first problem; `CONTRIBUTING.md` warns about the second.

## 9. No GitHub issues filed for the known findings

Filing them would arguably be tidier, but publishing content to a public tracker goes beyond "prepare the repo" and is trivially done later from `docs/KNOWN_ISSUES.md`. Say the word and they become three issues.

## 10. Repo homepage left unset

The GitHub homepage field is empty rather than pointed at a product URL I couldn't verify was live. Topics and description are set.
