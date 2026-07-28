import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';

import { highlightLine } from './prism-langs.js';
import { applyTabsDirective, applyTabDirective } from './dir-tabs.js';
import { applyStepsDirective, applyStepDirective } from './dir-steps.js';
import { applyFigureDirective } from './dir-figure.js';
import { applyTimelineDirective, applyEventDirective } from './dir-timeline.js';
import { applyCompareDirective, applyOptionDirective } from './dir-compare.js';
import { applyTreeDirective } from './dir-tree.js';
import { applyFlowDirective } from './dir-flow.js';
import { applyChartDirective } from './dir-chart.js';
import { emitDiagnosticAt, suggestClosest } from './diagnostics.js';
import { coerceSeverity, extractLabel } from './md2-utils.js';
import type { DirectiveAttrs, MutableNode, Severity } from './md2-types.js';

/** Canonical list of supported directives — used for unknown-name diagnostics. */
export const KNOWN_DIRECTIVES = [
	'callout',
	'columns',
	'column',
	'details',
	'risk-map',
	'annotate-code',
	'badge',
	'jump',
	'tabs',
	'tab',
	'steps',
	'step',
	'figure',
	'timeline',
	'event',
	'compare',
	'option',
	'tree',
	'flow',
	'chart'
] as const;

/** Severity keywords accepted by callout/badge/option/event/step. */
const VALID_SEVERITIES = new Set<Severity>(['info', 'warning', 'blocking', 'success', 'nit']);

/** Which directives use the `severity=` attribute. */
const SEVERITY_USERS = new Set(['callout', 'badge', 'option', 'event', 'step']);

interface Annotation {
	line: number;
	endLine?: number;
	severity: Severity | string;
	text: string;
}

/**
 * Transform `remark-directive` nodes into HTML elements with classes.
 *
 * Supported directives:
 *   :::callout{severity=warning icon=warning dismissible} body :::
 *   :::columns{min=240px gap=1rem cols=3} ::: column :::  :::
 *   :::details[Summary] body :::
 *   :::risk-map  - file → status [#anchor] ... :::
 *   :::annotate-code{lang=ts} ...code... :::
 *     followed by lines:  @11 blocking: text   /  @25-30 nit: text
 *
 * Inline / leaf directives:
 *   :badge[Blocking]{severity=blocking icon=warning}
 *   :jump[label]{to=#anchor}
 */
export function md2DirectiveTransform() {
	return (tree: Root) => {
		// First pass: detect orphan `:::` lines at root level. remark-directive
		// only consumes fences that have a matching name; otherwise a `:::`
		// becomes a literal text paragraph. The classic same-fence-length
		// footgun in spec §3.3 produces exactly this: a leftover `:::` after
		// the inner closer eats the outer fence.
		const root = tree as unknown as MutableNode;
		for (const child of root.children || []) {
			if (
				child &&
				child.type === 'paragraph' &&
				Array.isArray(child.children) &&
				child.children.length === 1
			) {
				const grand = child.children[0] as MutableNode;
				if (grand?.type === 'text' && typeof grand.value === 'string') {
					const t = grand.value.trim();
					if (/^:::+$/.test(t)) {
						const longer = ':'.repeat(t.length + 1);
						emitDiagnosticAt(child.position, {
							severity: 'warning',
							message:
								`stray '${t}' fence at root level — likely a same-fence-length ` +
								'nesting issue. Use a longer fence on the outer block (e.g. ' +
								`'${longer}columns ... ${longer}').`,
							code: 'MD2_ORPHAN_FENCE'
						});
					}
				}
			}
		}

		visit(tree, (n) => {
			const node = n as unknown as MutableNode;
			if (
				node.type !== 'containerDirective' &&
				node.type !== 'leafDirective' &&
				node.type !== 'textDirective'
			) {
				return;
			}

			const data = node.data || (node.data = {});
			const attrs: DirectiveAttrs = node.attributes || {};
			const name = node.name ?? '';

			// Severity validation (one place, before per-directive handlers).
			if (SEVERITY_USERS.has(name) && typeof attrs.severity === 'string' && attrs.severity) {
				const sev = String(attrs.severity).toLowerCase();
				if (!VALID_SEVERITIES.has(sev as Severity)) {
					const suggestion = suggestClosest(sev, Array.from(VALID_SEVERITIES) as readonly string[]);
					emitDiagnosticAt(node.position, {
						severity: 'warning',
						message:
							`invalid severity '${attrs.severity}' on :::${name}` +
							` (allowed: info, warning, blocking, success, nit` +
							(suggestion ? `; did you mean '${suggestion}'?` : '') +
							`)`,
						directive: name,
						code: 'MD2_BAD_SEVERITY'
					});
				}
			}

			// Same-fence-length footgun (spec §3.3): a `:::columns` whose direct
			// child is `:::column` using the same fence length collapses at parse
			// time — the inner :::column ends up as a sibling. We can't recover
			// the fence count from mdast, but the symptom is detectable:
			// a `:::columns` that has zero `:::column` children.
			if (name === 'columns' && node.type === 'containerDirective') {
				const directColumns = (node.children || []).filter(
					(c) => c && c.type === 'containerDirective' && c.name === 'column'
				);
				if (directColumns.length === 0) {
					emitDiagnosticAt(node.position, {
						severity: 'warning',
						message:
							"':::columns' has no direct ':::column' children — if you " +
							"used the same fence length for both, the inner ':::column' " +
							'may have closed the outer block. Use a longer fence for ' +
							"':::columns' (e.g. '::::columns ... ::::').",
						directive: 'columns',
						code: 'MD2_COLUMNS_NO_CHILDREN'
					});
				}
			}

			switch (name) {
				case 'callout': {
					// Coerce unknown severities to 'info' per spec §callout. The
					// `MD2_BAD_SEVERITY` diagnostic already fired above; here we
					// keep the rendered output stable so unknown values don't
					// produce dead class names like `md2-callout-fubar`.
					const severity = coerceSeverity(attrs.severity, 'default-info') || 'info';
					const dismissible = isTruthyAttr(attrs.dismissible);
					data.hName = 'aside';
					data.hProperties = {
						className: ['md2-callout', `md2-callout-${severity}`],
						'data-severity': severity
					};
					const iconHtml = attrs.icon ? renderIcon(attrs.icon) : '';
					const children = node.children || (node.children = []);
					if (attrs.title || iconHtml) {
						const headerChildren: MutableNode[] = [];
						if (iconHtml) {
							headerChildren.push({
								type: 'html',
								value: `<span class="md2-callout-icon" aria-hidden="true">${iconHtml}</span>`
							});
						}
						if (attrs.title) {
							headerChildren.push({ type: 'text', value: attrs.title });
						}
						children.unshift({
							type: 'paragraph',
							data: {
								hName: 'header',
								hProperties: {
									className: [
										'md2-callout-title',
										iconHtml && !attrs.title ? 'md2-callout-title-icon-only' : ''
									].filter(Boolean) as string[]
								}
							},
							children: headerChildren
						});
					}
					if (dismissible) {
						const cls = (data.hProperties.className || []) as string[];
						cls.push('md2-callout-dismissible');
						data.hProperties.className = cls;
						children.push({
							type: 'html',
							value:
								'<button class="md2-callout-dismiss" type="button" aria-label="Dismiss" onclick="this.closest(\'.md2-callout\').hidden=true">×</button>'
						});
					}
					break;
				}

				case 'columns': {
					data.hName = 'div';
					data.hProperties = { className: ['md2-columns'] };
					const min = attrs.min || '220px';
					const gap = attrs.gap || '1rem';
					const colsRaw = attrs.cols;
					const colsNum = colsRaw != null ? parseInt(String(colsRaw), 10) : NaN;
					if (Number.isFinite(colsNum) && colsNum > 0) {
						data.hProperties.style = `grid-template-columns: repeat(${colsNum}, 1fr); --md2-cols-min: ${min}; --md2-cols-gap: ${gap}; gap: ${gap};`;
					} else {
						data.hProperties.style = `--md2-cols-min: ${min}; --md2-cols-gap: ${gap};`;
					}
					break;
				}

				case 'column': {
					data.hName = 'div';
					data.hProperties = { className: ['md2-column'] };
					break;
				}

				case 'details': {
					data.hName = 'details';
					data.hProperties = { className: ['md2-details'] };
					const summaryText = extractLabel(node) || attrs.summary || 'Details';
					const children = node.children || (node.children = []);
					children.unshift({
						type: 'paragraph',
						data: { hName: 'summary', hProperties: { className: ['md2-details-summary'] } },
						children: [{ type: 'text', value: summaryText }]
					});
					break;
				}

				case 'risk-map': {
					data.hName = 'nav';
					data.hProperties = { className: ['md2-risk-map'] };
					if (attrs.title) {
						const children = node.children || (node.children = []);
						children.unshift({
							type: 'paragraph',
							data: { hName: 'header', hProperties: { className: ['md2-risk-map-title'] } },
							children: [{ type: 'text', value: attrs.title }]
						});
					}
					break;
				}

				case 'annotate-code': {
					transformAnnotateCode(node, attrs);
					break;
				}

				case 'badge': {
					// Same severity coercion as callout — see comment above.
					const severity = coerceSeverity(attrs.severity, 'default-info') || 'info';
					data.hName = 'span';
					data.hProperties = {
						className: ['md2-badge', `md2-badge-${severity}`],
						'data-severity': severity
					};
					if (attrs.icon) {
						const iconHtml = renderIcon(attrs.icon);
						if (iconHtml) {
							const children = node.children || (node.children = []);
							children.unshift({
								type: 'html',
								value: `<span class="md2-badge-icon" aria-hidden="true">${iconHtml}</span>`
							});
						}
					}
					break;
				}

				case 'jump': {
					const to = attrs.to || '#';
					data.hName = 'a';
					data.hProperties = { href: to, className: ['md2-jump'] };
					break;
				}

				case 'tabs': {
					// Tabs needs each :::tab child processed FIRST so it stashes
					// its rendered body on child.data.__md2Tab, which the parent
					// then collects. unist-util-visit walks pre-order, so do the
					// child pass inline here before the parent renders.
					for (const child of node.children || []) {
						if (child && child.type === 'containerDirective' && child.name === 'tab') {
							applyTabDirective(child, (child.attributes as DirectiveAttrs) || {});
						}
					}
					applyTabsDirective(node, attrs);
					break;
				}
				case 'tab': {
					// Orphaned :::tab (outside :::tabs). Render as empty + diagnose.
					emitDiagnosticAt(node.position, {
						severity: 'warning',
						message: "':::tab' outside ':::tabs' — rendered empty",
						directive: 'tab',
						code: 'MD2_ORPHAN_TAB'
					});
					node.type = 'html';
					node.value = '';
					node.children = [];
					delete node.data;
					break;
				}

				case 'steps': {
					// Same child-first pattern as :::tabs.
					for (const child of node.children || []) {
						if (child && child.type === 'containerDirective' && child.name === 'step') {
							applyStepDirective(child, (child.attributes as DirectiveAttrs) || {});
						}
					}
					applyStepsDirective(node, attrs);
					break;
				}
				case 'step': {
					emitDiagnosticAt(node.position, {
						severity: 'warning',
						message: "':::step' outside ':::steps' — rendered empty",
						directive: 'step',
						code: 'MD2_ORPHAN_STEP'
					});
					node.type = 'html';
					node.value = '';
					node.children = [];
					delete node.data;
					break;
				}

				case 'figure': {
					applyFigureDirective(node, attrs);
					break;
				}

				case 'timeline': {
					applyTimelineDirective(node, attrs);
					break;
				}
				case 'event': {
					applyEventDirective(node, attrs);
					break;
				}

				case 'compare': {
					applyCompareDirective(node, attrs);
					break;
				}
				case 'option': {
					applyOptionDirective(node, attrs);
					break;
				}

				case 'tree': {
					applyTreeDirective(node, attrs);
					break;
				}

				case 'flow': {
					applyFlowDirective(node, attrs);
					break;
				}

				case 'chart': {
					applyChartDirective(node, attrs);
					break;
				}

				default: {
					// Skip our internal grid synthesis from dir-compare.
					if (name === '_compare-grid') break;
					// Skip nodes that have already been re-typed (defensive — visit
					// shouldn't deliver them, but `name` may be empty for malformed).
					if (!name) break;
					const suggestion = suggestClosest(
						name.toLowerCase(),
						KNOWN_DIRECTIVES as readonly string[]
					);
					emitDiagnosticAt(node.position, {
						severity: 'warning',
						message:
							`unknown directive '${name}'` + (suggestion ? `; did you mean '${suggestion}'?` : ''),
						directive: name,
						code: 'MD2_UNKNOWN_DIRECTIVE'
					});
					break;
				}
			}
		});
	};
}

// extractLabel moved to ./md2-utils.js — see import above.

/**
 * Parse annotate-code children to extract code body + annotations.
 * Children layout:
 *   - first code block = source
 *   - subsequent paragraphs starting with `@N severity: text`
 *     or `@N-M severity: text` = annotations
 *
 * Replaces the directive node with a raw-HTML node so rehype-raw will pass
 * the pre-rendered block straight through.
 *
 * Annotation behaviour:
 *   - Single line: `@7 blocking: text` — tints line 7, attaches an annotation row.
 *   - Range:       `@7-10 blocking: text` — tints lines 7..10, attaches the
 *                  annotation row beneath line 7 only.
 *   - Stacked:     two annotations targeting the same start line render BOTH
 *                  rows beneath that line, source order preserved.
 *   - Overlap:     ranges may overlap; for tinted rows, the later-declared
 *                  severity wins.
 */
function transformAnnotateCode(node: MutableNode, attrs: DirectiveAttrs): void {
	const lang = attrs.lang || '';
	let codeNode: MutableNode | null = null;
	const annotations: Annotation[] = [];

	for (const child of node.children || []) {
		if (child.type === 'code' && !codeNode) {
			codeNode = child;
			continue;
		}
		if (child.type === 'paragraph') {
			const text = stringifyParagraph(child);
			for (const rawLine of text.split(/\r?\n/)) {
				const line = rawLine.trim();
				if (!line) continue;
				const match = /^@(\d+)(?:-(\d+))?\s+(blocking|nit|info|warning)\s*:\s*(.+)$/i.exec(line);
				if (match) {
					let start = Number(match[1]);
					let end: number | undefined = match[2] != null ? Number(match[2]) : undefined;
					if (end != null && end < start) {
						emitDiagnosticAt(child.position, {
							severity: 'warning',
							message: `annotate-code range @${start}-${end} has end < start; swapping`,
							directive: 'annotate-code',
							code: 'MD2_ANNOTATE_RANGE_REVERSED'
						});
						const tmp = start;
						start = end;
						end = tmp;
					}
					annotations.push({
						line: start,
						endLine: end,
						severity: match[3].toLowerCase(),
						text: match[4]
					});
				}
			}
		}
	}

	const code = codeNode?.value ?? '';
	const lines = code.split('\n');

	// Map start line → ordered list of annotations at that start line (stacking).
	const annsByStartLine = new Map<number, Annotation[]>();
	// Map line number → severity of the *last-declared* annotation that tints it
	// (used for row tinting where later-declared wins on overlap).
	const tintByLine = new Map<number, string>();

	for (const a of annotations) {
		const list = annsByStartLine.get(a.line) || [];
		list.push(a);
		annsByStartLine.set(a.line, list);
		const from = a.line;
		const to = a.endLine != null ? a.endLine : a.line;
		for (let ln = from; ln <= to; ln++) {
			tintByLine.set(ln, a.severity);
		}
	}

	const lineHtml = lines
		.map((lineText, idx) => {
			const ln = idx + 1;
			const tintSev = tintByLine.get(ln);
			const rowCls = ['md2-code-row', tintSev ? `md2-code-row-${tintSev}` : '']
				.filter(Boolean)
				.join(' ');
			const lnHtml = `<span class="md2-code-ln">${String(ln).padStart(3, ' ')}</span>`;
			const highlighted = highlightLine(lineText || ' ', lang);
			const codeHtml = `<span class="md2-code-src language-${escapeAttr(lang || 'plain')}">${highlighted}</span>`;
			const anns = annsByStartLine.get(ln) || [];
			const annRows = anns
				.map((ann) => {
					// Build an accessible label so AT announces context: "Line 7
					// blocking annotation: text". The line/range is the most useful
					// orientation cue. role="group" lets AT treat the row as a
					// discrete annotation block.
					const range =
						ann.endLine != null && ann.endLine !== ann.line
							? `Lines ${ann.line}-${ann.endLine}`
							: `Line ${ann.line}`;
					const annLabel = `${range} ${ann.severity} annotation: ${ann.text}`;
					return (
						`<div class="md2-code-ann-row md2-code-ann-row-${ann.severity}" role="group" aria-label="${escapeAttr(annLabel)}">` +
						`<span class="md2-badge md2-badge-${ann.severity}">${escapeHtml(ann.severity)}</span> ${escapeHtml(ann.text)}` +
						`</div>`
					);
				})
				.join('');
			return `<div class="${rowCls}"><div class="md2-code-line">${lnHtml}${codeHtml}</div>${annRows}</div>`;
		})
		.join('');

	const captionText = lang ? lang : 'code';
	const collapsed = isTruthyAttr(attrs.collapsed);
	const sevCounts = annotations.reduce<Record<string, number>>((m, a) => {
		m[a.severity] = (m[a.severity] || 0) + 1;
		return m;
	}, {});
	const summaryBadges = Object.entries(sevCounts)
		.map(([sev, n]) => `<span class="md2-badge md2-badge-${sev}">${n} ${escapeHtml(sev)}</span>`)
		.join(' ');
	const summaryMeta = `${lines.length} lines${annotations.length ? ` · ${summaryBadges}` : ''}`;

	let html: string;
	if (collapsed) {
		html = `<details class="md2-annotate-code md2-annotate-code-collapsible" data-lang="${escapeAttr(lang)}"><summary class="md2-annotate-code-caption md2-annotate-code-summary"><span class="md2-annotate-code-lang">${escapeHtml(captionText)}</span><span class="md2-annotate-code-meta">${summaryMeta}</span></summary><pre class="md2-annotate-code-body">${lineHtml}</pre></details>`;
	} else {
		html = `<figure class="md2-annotate-code" data-lang="${escapeAttr(lang)}"><figcaption class="md2-annotate-code-caption">${escapeHtml(captionText)}</figcaption><pre class="md2-annotate-code-body">${lineHtml}</pre></figure>`;
	}

	node.type = 'html';
	node.value = html;
	node.children = [];
	delete node.data;
}

function isTruthyAttr(v: string | undefined | null): boolean {
	if (v === undefined || v === null) return false;
	const s = String(v).toLowerCase();
	return (
		s === '' || s === 'true' || s === '1' || s === 'yes' || s === 'collapsed' || s === 'dismissible'
	);
}

function escapeHtml(s: string): string {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
	return String(s).replace(/"/g, '&quot;').replace(/&/g, '&amp;');
}

function stringifyParagraph(p: MutableNode): string {
	const out: string[] = [];
	for (const c of p.children || []) {
		if (c.type === 'text' || c.type === 'inlineCode') {
			out.push(c.value || '');
		} else if (c.type === 'break') {
			out.push('\n');
		} else if (Array.isArray(c.children)) {
			out.push(stringifyParagraph(c));
		}
	}
	return out.join('').trim();
}

/**
 * Shared icon helper. Maps a short keyword to an inline 16x16 SVG using
 * currentColor for stroke/fill so it inherits the surrounding text colour.
 * Unknown keywords that look like single-character Unicode glyphs (emoji,
 * symbols) are passed through verbatim wrapped in a span.
 */
const ICON_SVGS: Record<string, string> = {
	info: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.5"/><line x1="8" y1="7" x2="8" y2="11.5"/><circle cx="8" cy="4.5" r="0.6" fill="currentColor" stroke="none"/></svg>',
	warning:
		'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5 L15 13.5 L1 13.5 Z"/><line x1="8" y1="6" x2="8" y2="9.5"/><circle cx="8" cy="11.5" r="0.6" fill="currentColor" stroke="none"/></svg>',
	error:
		'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.5"/><line x1="5.5" y1="5.5" x2="10.5" y2="10.5"/><line x1="10.5" y1="5.5" x2="5.5" y2="10.5"/></svg>',
	success:
		'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.5"/><polyline points="5,8.2 7.2,10.4 11,6"/></svg>',
	tip: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5 a4.5 4.5 0 0 0 -2.7 8.1 V11 h5.4 V9.6 A4.5 4.5 0 0 0 8 1.5 Z"/><line x1="6.5" y1="13" x2="9.5" y2="13"/><line x1="7" y1="14.5" x2="9" y2="14.5"/></svg>',
	question:
		'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.5"/><path d="M6 6 a2 2 0 0 1 4 0 c0 1.2 -2 1.5 -2 3"/><circle cx="8" cy="11.5" r="0.6" fill="currentColor" stroke="none"/></svg>',
	lock: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="10" height="7" rx="1.2"/><path d="M5.5 7 V5 a2.5 2.5 0 0 1 5 0 V7"/></svg>',
	bolt: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" stroke="none"><path d="M9 1 L3 9 H7 L6 15 L13 7 H9 Z"/></svg>'
};

function renderIcon(keyword: string | undefined): string {
	if (!keyword) return '';
	const key = String(keyword).toLowerCase();
	if (Object.prototype.hasOwnProperty.call(ICON_SVGS, key)) {
		return ICON_SVGS[key];
	}
	// Pass through verbatim — covers emoji & misc Unicode glyphs.
	return `<span class="md2-icon-glyph">${escapeHtml(keyword)}</span>`;
}
