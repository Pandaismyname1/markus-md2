/**
 * MD2 `compare` / `option` container directives.
 *
 * Two use-cases, one directive:
 *   1. Side-by-side comparison of 2+ entries (before/after, X vs Y, A/B/C).
 *   2. Vote / option presentation — present 2–N choices to a user for them
 *      to pick (AskUserQuestion-style UI).
 *
 * Syntax:
 *   :::compare{title="Which approach?"}
 *
 *   :::option[Refactor first]{key=A severity=warning}
 *   - Pros: clean codebase
 *   - Cons: 2-week delay
 *   :::
 *
 *   :::option[Ship now]{key=B severity=success}
 *   - Pros: speed
 *   - Cons: tech debt
 *   :::
 *
 *   :::option[Split the difference]{key=C severity=info}
 *   - Pros: balance
 *   - Cons: complexity
 *   :::
 *
 *   :::
 *
 * `mode` is `vote` or `diff` (default `diff`). The presence of `key=X` on any
 * child option auto-implies `mode=vote`. In vote mode each option renders a
 * key-letter chip in its header so a reader can say "go with B".
 */

import type { DirectiveAttrs, MutableNode } from './md2-types.js';
import { emitDiagnosticAt } from './diagnostics.js';
import { extractLabel } from './md2-utils.js';

const VALID_SEVERITIES = new Set(['info', 'warning', 'blocking', 'success', 'nit']);
const VALID_MODES = new Set(['vote', 'diff']);

/**
 * Wire a `compare` container directive so it renders as a `<section>` with an
 * optional title header and a CSS-grid of options.
 */
export function applyCompareDirective(node: MutableNode, attrs: DirectiveAttrs): void {
	const data = node.data || (node.data = {});

	// Detect children that are `option` directives so we can:
	//   (a) auto-promote mode=vote when any child carries key=
	//   (b) warn when fewer than 2 options are present
	const optionChildren = (node.children || []).filter(
		(c) => c && c.type === 'containerDirective' && c.name === 'option'
	);
	const anyKey = optionChildren.some((c) => c.attributes && c.attributes.key);

	let mode = attrs && attrs.mode ? String(attrs.mode).toLowerCase() : '';
	if (!VALID_MODES.has(mode)) {
		mode = anyKey ? 'vote' : 'diff';
	}

	if (optionChildren.length < 2) {
		emitDiagnosticAt(node.position, {
			severity: 'warning',
			message: `':::compare' has fewer than 2 ':::option' children (found ${optionChildren.length})`,
			directive: 'compare',
			code: 'MD2_COMPARE_TOO_FEW_OPTIONS'
		});
	}

	data.hName = 'section';
	data.hProperties = {
		className: ['md2-compare', `md2-compare-${mode}`],
		'data-mode': mode,
		'data-options': String(optionChildren.length)
	};

	// Optional title header rendered first.
	if (attrs && attrs.title) {
		const children = node.children || (node.children = []);
		children.unshift({
			type: 'paragraph',
			data: {
				hName: 'header',
				hProperties: { className: ['md2-compare-title'] }
			},
			children: [{ type: 'text', value: String(attrs.title) }]
		});
	}

	// Stamp the resolved mode onto each option's attributes so the option
	// handler can render its key-chip iff mode === 'vote'. We do this here
	// rather than at parse time so the parent's mode flows down.
	for (const opt of optionChildren) {
		opt.attributes = opt.attributes || {};
		if (!opt.attributes.__compareMode) {
			opt.attributes.__compareMode = mode;
		}
	}

	// Wrap option children in an inner grid div so the title sits outside the grid.
	rewrapAsGrid(node);
}

/**
 * After applyCompareDirective has prepended the title (if any) and stamped
 * options, this groups every `option` child under a single grid wrapper.
 */
function rewrapAsGrid(node: MutableNode): void {
	const before: MutableNode[] = [];
	const options: MutableNode[] = [];
	for (const c of node.children || []) {
		if (c && c.type === 'containerDirective' && c.name === 'option') {
			options.push(c);
		} else {
			before.push(c);
		}
	}

	if (options.length === 0) {
		// Nothing to group; leave node as-is.
		return;
	}

	const grid: MutableNode = {
		type: 'containerDirective',
		name: '_compare-grid',
		attributes: {},
		children: options,
		data: {
			hName: 'div',
			hProperties: { className: ['md2-compare-grid'] }
		}
	};

	node.children = [...before, grid];
}

/**
 * Wire an `option` container directive as one card in a compare grid.
 *
 * Renders as `<article class="md2-compare-option md2-compare-option-<severity>?">`
 * with a header containing an optional key chip and the label, followed by the body.
 */
export function applyOptionDirective(node: MutableNode, attrs: DirectiveAttrs): void {
	const data = node.data || (node.data = {});

	const severityRaw = attrs && attrs.severity ? String(attrs.severity).toLowerCase() : '';
	const severity = VALID_SEVERITIES.has(severityRaw) ? severityRaw : '';
	const key = attrs && attrs.key ? String(attrs.key).trim() : '';
	const mode = (attrs && attrs.__compareMode) || (key ? 'vote' : 'diff');

	const className = ['md2-compare-option'];
	if (severity) className.push(`md2-compare-option-${severity}`);

	data.hName = 'article';
	const props: Record<string, unknown> = { className };
	if (severity) props['data-severity'] = severity;
	if (key) props['data-key'] = key;
	data.hProperties = props;

	const label = extractLabel(node);

	// Build the option header: [key chip]? [label]
	const headerChildren: MutableNode[] = [];
	if (mode === 'vote' && key) {
		// The single-letter key (e.g. "A") is visually meaningful but reads
		// poorly to screen readers in isolation. Give it an aria-label so AT
		// announces "Option A" instead of just "A". `role="img"` lets AT honour
		// the aria-label override on a span whose visible text alone is
		// ambiguous.
		headerChildren.push({
			type: 'paragraph',
			data: {
				hName: 'span',
				hProperties: {
					className: ['md2-compare-option-key'],
					role: 'img',
					'aria-label': `Option ${key}`
				}
			},
			children: [{ type: 'text', value: key }]
		});
	}
	if (label) {
		headerChildren.push({
			type: 'paragraph',
			data: {
				hName: 'span',
				hProperties: { className: ['md2-compare-option-label'] }
			},
			children: [{ type: 'text', value: label }]
		});
	}

	if (headerChildren.length > 0) {
		const children = node.children || (node.children = []);
		children.unshift({
			type: 'paragraph',
			data: {
				hName: 'header',
				hProperties: { className: ['md2-compare-option-header'] }
			},
			children: headerChildren
		});
	}

	// Strip the internal __compareMode bookkeeping attribute from the directive
	// node's `attributes` map so it doesn't leak into rendered output.
	if (node.attributes && '__compareMode' in node.attributes) {
		delete node.attributes.__compareMode;
	}
}
