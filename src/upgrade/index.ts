/**
 * Markdown → MD2 auto-upgrade pipeline.
 *
 * Wave 4 task K. AI clients that don't speak MD2 still POST raw Markdown to
 * `POST /api/docs`. We run this upgrade pass on the source string before
 * storage so the focused viewer rendering Just Works.
 *
 * Design notes:
 *
 *  - **Detection via mdast, rewrite via line-indexed source.** We parse with
 *    `remark-parse` to get accurate node positions (line numbers, ranges),
 *    then build a list of edits keyed by line. We never `remark-stringify`
 *    the whole document — that would round-trip whitespace and code-fence
 *    style and surprise authors.
 *
 *  - **Conservative.** Every rule errs toward false negatives. If we can't
 *    prove the pattern with high confidence, we leave the source alone.
 *
 *  - **Directive-aware.** Before applying any edit, we scan the source for
 *    `:::`+ container ranges and reject any candidate edit overlapping
 *    a directive's interior. This keeps the upgrade idempotent — once a
 *    paragraph is inside `:::callout`, we never touch it again.
 *
 *  - **Diagnostics.** Each successful upgrade emits a `MD2_UPGRADE_APPLIED`
 *    diagnostic with `{ rule, line }`. The API drops these for now; a
 *    future "preview the upgrade" endpoint can surface them.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';

import { beginDiagnostics, endDiagnostics, emitDiagnosticAt } from '../diagnostics.js';
import type { Diagnostic, MutableNode, UnistPosition } from '../md2-types.js';

export type UpgradeRule =
	| 'callout-note'
	| 'callout-warning'
	| 'callout-blocking'
	| 'callout-success'
	| 'steps'
	| 'annotate-code'
	| 'pros-cons-columns';

interface Edit {
	rule: UpgradeRule;
	/** 1-based inclusive line of the source the rule fired on. */
	startLine: number;
	/** 1-based inclusive last line replaced. */
	endLine: number;
	/** Replacement text. Newline-joined; no trailing newline. */
	replacement: string;
	/** mdast position for diagnostic emission. */
	position: UnistPosition;
}

interface DirectiveRange {
	/** 1-based inclusive opening fence line. */
	start: number;
	/** 1-based inclusive closing fence line. */
	end: number;
}

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

/**
 * Upgrade likely Markdown patterns to MD2 directives.
 *
 * Idempotent: re-running this on its own output is a no-op modulo the
 * trailing newline normalisation done in `applyEdits`.
 */
export function upgradeMarkdown(src: string): { source: string; diagnostics: Diagnostic[] } {
	beginDiagnostics();
	try {
		// Empty input — nothing to do.
		if (!src) return { source: src, diagnostics: endDiagnostics() };

		const lines = src.split(/\r?\n/);
		const directiveRanges = scanDirectiveRanges(lines);

		// Parse the source to mdast. remark-directive is included so directive
		// containers parse as `containerDirective` nodes — we never want to
		// re-write inside one of those.
		const tree = parser.parse(src) as Root;

		const edits: Edit[] = [];

		// Pre-pass: collect candidate edits.
		visit(tree, (n) => {
			const node = n as unknown as MutableNode;
			if (
				node.type === 'containerDirective' ||
				node.type === 'leafDirective' ||
				node.type === 'textDirective'
			) {
				// Don't descend into existing directives.
				return 'skip';
			}

			if (node.type === 'blockquote') {
				const edit = tryCalloutFromBlockquote(node, lines);
				if (edit && !overlapsDirective(edit, directiveRanges)) edits.push(edit);
				return 'skip'; // don't recurse into the blockquote
			}

			if (node.type === 'list') {
				const edit = tryStepsFromList(node, lines);
				if (edit && !overlapsDirective(edit, directiveRanges)) edits.push(edit);
				return 'skip';
			}

			if (node.type === 'code') {
				const edit = tryAnnotateCodeFromFence(node, lines);
				if (edit && !overlapsDirective(edit, directiveRanges)) edits.push(edit);
				return;
			}

			return undefined;
		});

		// Pros/Cons columns runs on the root-level child sequence (heading
		// adjacency). We do it outside the visit so we have full sibling
		// context.
		for (const edit of detectProsConsColumns(tree, lines)) {
			if (!overlapsDirective(edit, directiveRanges)) edits.push(edit);
		}

		// Drop overlapping edits (later rules win lower-priority — but in
		// practice the rules above don't overlap). Sort by startLine ascending
		// then apply bottom-up.
		const filtered = dedupeOverlapping(edits);

		for (const e of filtered) {
			emitDiagnosticAt(e.position, {
				severity: 'info',
				message: `auto-upgrade: ${e.rule}`,
				code: 'MD2_UPGRADE_APPLIED',
				directive: e.rule
			});
		}

		const out = applyEdits(lines, filtered);
		return { source: out, diagnostics: endDiagnostics() };
	} catch (err) {
		// Bail out: emit a diagnostic, return original.
		const diagnostics = endDiagnostics();
		diagnostics.push({
			severity: 'warning',
			message: err instanceof Error ? err.message : String(err),
			code: 'MD2_UPGRADE_APPLIED'
		});
		return { source: src, diagnostics };
	}
}

// ---------------------------------------------------------------------------
// Directive-range pre-scan
// ---------------------------------------------------------------------------

/**
 * Find all `:::`+ container ranges in the source.
 *
 * remark-directive's grammar is name-sensitive: an opening fence carries a
 * directive name (`:::callout`) while a closing fence is bare (`:::`).
 * Same-length closers match openers. We walk a stack so nested directives
 * (`::::tabs` wrapping `:::tab`) all surface as separate ranges.
 *
 * We also skip lines inside fenced code blocks — code fences can contain a
 * literal `:::` in the body which would otherwise confuse us. Code fences
 * are recognised as `^[ ]{0,3}(```+|~~~+)`.
 */
function scanDirectiveRanges(lines: string[]): DirectiveRange[] {
	const ranges: DirectiveRange[] = [];
	const stack: { fenceLen: number; openLine: number; name: string }[] = [];

	let inCodeFence = false;
	let codeFenceMarker = '';

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Code fence toggle.
		const codeOpen = line.match(/^[ ]{0,3}(`{3,}|~{3,})(.*)$/);
		if (codeOpen) {
			const marker = codeOpen[1][0]; // ` or ~
			const len = codeOpen[1].length;
			if (!inCodeFence) {
				inCodeFence = true;
				codeFenceMarker = codeOpen[1];
			} else if (marker === codeFenceMarker[0] && len >= codeFenceMarker.length) {
				// Closing fence (same marker char, ≥ same length).
				inCodeFence = false;
				codeFenceMarker = '';
			}
			continue;
		}
		if (inCodeFence) continue;

		// Directive fence.
		const m = line.match(/^(:{3,})([A-Za-z][A-Za-z0-9_-]*)?/);
		if (!m) continue;
		const fenceLen = m[1].length;
		const name = m[2] ?? '';

		if (name) {
			// Opening fence.
			stack.push({ fenceLen, openLine: i + 1, name });
		} else {
			// Closing fence — pop the deepest open with matching length.
			for (let s = stack.length - 1; s >= 0; s--) {
				if (stack[s].fenceLen === fenceLen) {
					const opened = stack[s];
					stack.splice(s, 1);
					ranges.push({ start: opened.openLine, end: i + 1 });
					break;
				}
			}
		}
	}

	// Any still-open fences: treat the open line through EOF as a directive
	// range so we don't touch their interior either.
	for (const opened of stack) {
		ranges.push({ start: opened.openLine, end: lines.length });
	}

	return ranges;
}

function overlapsDirective(edit: Edit, ranges: DirectiveRange[]): boolean {
	for (const r of ranges) {
		// Reject if the edit's lines lie inside (strictly inside, not
		// including the fence lines themselves — but fence lines were
		// already parsed as containerDirective nodes so we skip those).
		if (edit.startLine >= r.start && edit.endLine <= r.end) return true;
		// Or partially overlaps — also reject.
		if (edit.startLine <= r.end && edit.endLine >= r.start) return true;
	}
	return false;
}

function dedupeOverlapping(edits: Edit[]): Edit[] {
	const sorted = [...edits].sort((a, b) => a.startLine - b.startLine);
	const kept: Edit[] = [];
	for (const e of sorted) {
		const last = kept[kept.length - 1];
		if (last && e.startLine <= last.endLine) {
			// Overlap; keep the earlier one (deterministic).
			continue;
		}
		kept.push(e);
	}
	return kept;
}

// ---------------------------------------------------------------------------
// Edit application
// ---------------------------------------------------------------------------

function applyEdits(lines: string[], edits: Edit[]): string {
	if (edits.length === 0) return lines.join('\n');
	// Apply in reverse so earlier-line indices stay valid.
	const sorted = [...edits].sort((a, b) => b.startLine - a.startLine);
	let out = lines.slice();
	for (const e of sorted) {
		const before = out.slice(0, e.startLine - 1);
		const after = out.slice(e.endLine);
		const middle = e.replacement.split('\n');
		out = [...before, ...middle, ...after];
	}
	return out.join('\n');
}

// ---------------------------------------------------------------------------
// Rule: blockquote → callout
// ---------------------------------------------------------------------------

interface CalloutPrefixMatch {
	severity: 'info' | 'warning' | 'blocking' | 'success';
	rule: UpgradeRule;
	/** Bytes consumed from the start of the first paragraph's text. */
	consumed: number;
}

/** Map of well-known prefixes to a severity. */
const PREFIX_RULES: ReadonlyArray<{
	pattern: RegExp;
	severity: CalloutPrefixMatch['severity'];
	rule: UpgradeRule;
}> = [
	{
		// **Note:** / **Tip:** — case-insensitive, optional trailing space.
		pattern: /^\*\*(?:Note|Tip)\s*:\s*\*\*\s*/i,
		severity: 'info',
		rule: 'callout-note'
	},
	{ pattern: /^💡\s+/, severity: 'info', rule: 'callout-note' },
	{
		pattern: /^\*\*Warning\s*:\s*\*\*\s*/i,
		severity: 'warning',
		rule: 'callout-warning'
	},
	{ pattern: /^⚠️\s+/, severity: 'warning', rule: 'callout-warning' },
	{ pattern: /^⚠\s+/, severity: 'warning', rule: 'callout-warning' },
	{
		pattern: /^\*\*(?:Important|Blocking)\s*:\s*\*\*\s*/i,
		severity: 'blocking',
		rule: 'callout-blocking'
	},
	{ pattern: /^❗\s+/, severity: 'blocking', rule: 'callout-blocking' },
	{
		pattern: /^\*\*Success\s*:\s*\*\*\s*/i,
		severity: 'success',
		rule: 'callout-success'
	},
	{ pattern: /^✅\s+/, severity: 'success', rule: 'callout-success' }
];

/**
 * If the blockquote begins with a recognised prefix, return an edit that
 * replaces the whole blockquote with a `:::callout` block, stripping the
 * prefix and removing the leading `> ` on each line.
 */
function tryCalloutFromBlockquote(node: MutableNode, lines: string[]): Edit | null {
	if (!node.position) return null;
	const startLine = node.position.start?.line;
	const endLine = node.position.end?.line;
	if (!startLine || !endLine) return null;

	// Get the raw blockquote body (strip leading `> ` from each line).
	const raw = lines.slice(startLine - 1, endLine);
	const body = stripBlockquoteMarkers(raw);
	if (body.length === 0) return null;
	const firstLine = body[0];

	const match = matchCalloutPrefix(firstLine);
	if (!match) return null;

	// Strip the prefix from the first line.
	const stripped = [firstLine.slice(match.consumed), ...body.slice(1)];
	// If the first line is now empty after the prefix, drop it.
	while (stripped.length > 0 && stripped[0].trim() === '') stripped.shift();

	const replacement = [`:::callout{severity=${match.severity}}`, ...stripped, ':::'].join('\n');

	return {
		rule: match.rule,
		startLine,
		endLine,
		replacement,
		position: node.position
	};
}

function matchCalloutPrefix(line: string): CalloutPrefixMatch | null {
	for (const rule of PREFIX_RULES) {
		const m = line.match(rule.pattern);
		if (m) {
			return { severity: rule.severity, rule: rule.rule, consumed: m[0].length };
		}
	}
	return null;
}

/**
 * Strip the leading `>` marker (and one optional space) from each line of a
 * blockquote source range. Blank `>` lines stay blank.
 */
function stripBlockquoteMarkers(raw: string[]): string[] {
	const out: string[] = [];
	for (const line of raw) {
		const m = line.match(/^\s{0,3}>[ \t]?(.*)$/);
		out.push(m ? m[1] : line);
	}
	return out;
}

// ---------------------------------------------------------------------------
// Rule: ordered list with `**Step N:**` items → :::steps / :::step[title]
// ---------------------------------------------------------------------------

function tryStepsFromList(node: MutableNode, lines: string[]): Edit | null {
	// Only ordered lists are candidates.
	const ordered = (node as unknown as { ordered?: boolean }).ordered;
	if (!ordered) return null;
	if (!node.position) return null;
	const items = node.children;
	if (!Array.isArray(items) || items.length === 0) return null;

	// Pull each item's first-paragraph text to test for `**Step N:**` /
	// `**N.** ` prefixes. The item index (1-based) must match N.
	const stepTitles: { title: string; body: string[] }[] = [];
	for (let idx = 0; idx < items.length; idx++) {
		const item = items[idx];
		if (!item || item.type !== 'listItem') return null;
		if (!item.position) return null;
		const firstPara = item.children?.[0];
		if (!firstPara || firstPara.type !== 'paragraph') return null;
		const firstText = paragraphLeadingText(firstPara);
		if (firstText == null) return null;
		const parsed = parseStepPrefix(firstText, idx + 1);
		if (!parsed) return null;

		// Title is the rest of the first paragraph's first line.
		// We rebuild the item body by reading its source range and stripping
		// the list marker / indent.
		const itemStart = item.position.start?.line;
		const itemEnd = item.position.end?.line;
		if (!itemStart || !itemEnd) return null;
		const raw = lines.slice(itemStart - 1, itemEnd);
		const dedented = dedentListItem(raw);
		// The dedented body begins with `**Step N:** <title>` (or
		// `**N.** <title>`); strip that prefix so the title and remainder are
		// separate.
		const body = dedented.slice(); // copy
		if (body.length === 0) return null;
		body[0] = body[0].slice(parsed.consumed);
		// Pull the title off the first line. Title is everything on that
		// line after the prefix; rest of body is body[0] (which might also
		// have content after the title, but in practice the title sits
		// alone on the first line).
		const titleLine = body[0];
		const remainingBody = body.slice(1);
		// If there's anything after the title on the same line, push it to
		// the start of the body.
		const title = titleLine.trim();
		stepTitles.push({ title, body: remainingBody });
	}

	if (stepTitles.length < 1) return null;

	const startLine = node.position.start?.line;
	const endLine = node.position.end?.line;
	if (!startLine || !endLine) return null;

	const out: string[] = ['::::steps'];
	for (const s of stepTitles) {
		out.push(`:::step[${escapeLabel(s.title)}]`);
		// Trim leading blank lines from body
		const body = trimBlankEdges(s.body);
		for (const ln of body) out.push(ln);
		out.push(':::');
	}
	out.push('::::');

	return {
		rule: 'steps',
		startLine,
		endLine,
		replacement: out.join('\n'),
		position: node.position
	};
}

/**
 * Match either `**Step N:**` or `**N.**` at the start of a string, where N
 * matches the given list-item number. Returns the byte count consumed.
 */
function parseStepPrefix(text: string, expectedN: number): { consumed: number } | null {
	// **Step N:** or **Step N.**
	const stepRe = /^\*\*Step\s+(\d+)\s*[:.]\s*\*\*\s*/i;
	const m1 = text.match(stepRe);
	if (m1 && parseInt(m1[1], 10) === expectedN) {
		return { consumed: m1[0].length };
	}
	// **N.** with required trailing space
	const numRe = /^\*\*(\d+)\.\*\*\s+/;
	const m2 = text.match(numRe);
	if (m2 && parseInt(m2[1], 10) === expectedN) {
		return { consumed: m2[0].length };
	}
	return null;
}

/**
 * Read the first run of plain text from a paragraph's children. Stops at
 * the first non-text/strong/emphasis node. We need to capture the leading
 * `**Step N:**` marker which mdast parses as a `strong` node with children
 * `[text 'Step N:']`. Reconstruct that as `**Step N:**`.
 */
function paragraphLeadingText(para: MutableNode): string | null {
	if (!para.children || para.children.length === 0) return null;
	const parts: string[] = [];
	for (const c of para.children) {
		if (c.type === 'text') {
			parts.push(c.value ?? '');
			continue;
		}
		if (c.type === 'strong') {
			const inner = (c.children || [])
				.map((cc) => (cc.type === 'text' ? (cc.value ?? '') : ''))
				.join('');
			parts.push(`**${inner}**`);
			continue;
		}
		// Stop at the first non-text/non-strong inline.
		break;
	}
	return parts.join('');
}

/**
 * Remove the leading ordered-list marker (`1. `, `2. `) and accompanying
 * indent from each line of a list-item's source range. Returns the
 * "naked" body.
 */
function dedentListItem(raw: string[]): string[] {
	if (raw.length === 0) return raw;
	// First line: strip `^\s*\d+\.\s+` (or `^\s*\d+\)\s+`).
	const m = raw[0].match(/^(\s*)(\d+[.)]\s+)/);
	const indent = m ? m[1].length + m[2].length : 0;
	const first = m ? raw[0].slice(indent) : raw[0];
	const rest = raw.slice(1).map((ln) => {
		// Strip up to `indent` leading whitespace chars.
		let n = 0;
		while (n < indent && n < ln.length && ln[n] === ' ') n++;
		return ln.slice(n);
	});
	return [first, ...rest];
}

function trimBlankEdges(lines: string[]): string[] {
	let s = 0;
	let e = lines.length;
	while (s < e && lines[s].trim() === '') s++;
	while (e > s && lines[e - 1].trim() === '') e--;
	return lines.slice(s, e);
}

function escapeLabel(s: string): string {
	// `]` would close the label. Backslash-escape it. Other escapes
	// (backslash) too.
	return s.replace(/\\/g, '\\\\').replace(/]/g, '\\]');
}

// ---------------------------------------------------------------------------
// Rule: fenced code with `// highlight: N-M` first line → :::annotate-code
// ---------------------------------------------------------------------------

const ANNOTATE_FIRST_LINE = /^(\/\/|#)\s+(?:highlight|focus)\s*:\s*(\d+)\s*-\s*(\d+)\s*$/;

function tryAnnotateCodeFromFence(node: MutableNode, lines: string[]): Edit | null {
	if (!node.position) return null;
	const startLine = node.position.start?.line;
	const endLine = node.position.end?.line;
	if (!startLine || !endLine) return null;

	const value = node.value ?? '';
	if (!value) return null;
	const codeLines = value.split('\n');
	if (codeLines.length === 0) return null;
	const m = codeLines[0].match(ANNOTATE_FIRST_LINE);
	if (!m) return null;
	const n = parseInt(m[2], 10);
	const mEnd = parseInt(m[3], 10);
	if (!Number.isFinite(n) || !Number.isFinite(mEnd) || n > mEnd) return null;

	// Read the actual source range for the code fence so we preserve its
	// fence markers and lang.
	const raw = lines.slice(startLine - 1, endLine);
	if (raw.length < 2) return null;
	const fenceOpen = raw[0];
	const fenceClose = raw[raw.length - 1];

	// Drop the first content line (the comment).
	// The fence body sits at raw[1 .. raw.length-2]. The comment is raw[1].
	const newBody = raw.slice(2, raw.length - 1);

	const replacement = [
		`:::annotate-code{lines=${n}-${mEnd}}`,
		fenceOpen,
		...newBody,
		fenceClose,
		':::'
	].join('\n');

	return {
		rule: 'annotate-code',
		startLine,
		endLine,
		replacement,
		position: node.position
	};
}

// ---------------------------------------------------------------------------
// Rule: adjacent ### Pros + ### Cons → :::columns wrapping :::column[Pros|Cons]
// ---------------------------------------------------------------------------

function detectProsConsColumns(tree: Root, lines: string[]): Edit[] {
	const edits: Edit[] = [];
	const root = tree as unknown as MutableNode;
	const kids = root.children || [];
	for (let i = 0; i < kids.length; i++) {
		const a = kids[i];
		if (!isProsConsHeading(a, ['pros', 'pro'])) continue;
		// Find next heading sibling.
		// Pros content runs through next heading-or-EOF; Cons must immediately
		// follow as a sibling heading of the same depth.
		// Walk siblings looking for the next `### Cons` heading.
		let j = i + 1;
		while (j < kids.length && (kids[j] as MutableNode).type !== 'heading') j++;
		if (j >= kids.length) continue;
		const b = kids[j];
		if (!isProsConsHeading(b, ['cons', 'con'])) continue;
		// Pros + Cons must share the same depth.
		const da = (a as unknown as { depth?: number }).depth;
		const db = (b as unknown as { depth?: number }).depth;
		if (!da || da !== db) continue;

		// End of the Cons section: next heading at depth ≤ da, or EOF.
		let k = j + 1;
		while (k < kids.length) {
			const kid = kids[k] as MutableNode;
			const kd = (kid as unknown as { depth?: number }).depth;
			if (kid.type === 'heading' && kd && kd <= da) break;
			k++;
		}

		const startLine = a.position?.start?.line;
		// End line: the last line of kids[k-1] (or kids[j..k-1]).
		const endNode = kids[k - 1] as MutableNode;
		const endLine = endNode.position?.end?.line;
		if (!startLine || !endLine) continue;

		// Build replacement.
		const prosStart = a.position?.start?.line;
		const prosEndNode = kids[j - 1] as MutableNode;
		const prosEnd = prosEndNode.position?.end?.line;
		const consStart = b.position?.start?.line;
		const consEnd = endLine;
		if (!prosStart || !prosEnd || !consStart || !consEnd) continue;

		// Take all source lines after the Pros heading through prosEnd.
		const prosBody = lines.slice(prosStart, prosEnd);
		const consBody = lines.slice(consStart, consEnd);
		const replacement = [
			'::::columns',
			':::column[Pros]',
			...trimBlankEdges(prosBody),
			':::',
			':::column[Cons]',
			...trimBlankEdges(consBody),
			':::',
			'::::'
		].join('\n');

		edits.push({
			rule: 'pros-cons-columns',
			startLine,
			endLine,
			replacement,
			position: a.position ?? { start: { line: startLine } }
		});
		i = k - 1;
	}
	return edits;
}

function isProsConsHeading(node: MutableNode, accepted: string[]): boolean {
	if (!node || node.type !== 'heading') return false;
	const kids = node.children || [];
	if (kids.length !== 1) return false;
	const t = kids[0];
	if (!t || t.type !== 'text') return false;
	const v = String(t.value ?? '')
		.trim()
		.toLowerCase();
	return accepted.includes(v);
}
