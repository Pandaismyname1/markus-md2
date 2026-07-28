/**
 * MD2 `steps` / `step` directive transforms.
 *
 * Mutates `containerDirective` nodes into raw-HTML nodes so rehype-raw
 * passes the pre-rendered block through. Mirrors the pattern used by
 * `transformAnnotateCode` in `remark-md2.ts`.
 *
 * Syntax:
 *   :::steps{start=2}
 *   :::step[Install deps]
 *   ```bash
 *   npm install
 *   ```
 *   :::
 *   :::step[Migrate DB]
 *   …body…
 *   :::
 *   :::step[Run dev]{status=current}
 *   …body…
 *   :::
 *   :::
 */

import { toHtml } from 'hast-util-to-html';
import { toHast } from 'mdast-util-to-hast';
import type { Nodes as HastNodes } from 'hast';
import type { Nodes as MdastNodes } from 'mdast';

import { extractLabel } from './md2-utils.js';
import type { DirectiveAttrs, MutableNode } from './md2-types.js';

const ALLOWED_STATUS = new Set(['pending', 'current', 'done']);
const ALLOWED_SEVERITY = new Set(['info', 'warning', 'blocking', 'success', 'nit']);

/** Apply the `:::steps` container directive. */
export function applyStepsDirective(node: MutableNode, attrs: DirectiveAttrs): void {
	const startRaw = attrs.start;
	const start = Number.isFinite(Number(startRaw)) && Number(startRaw) > 0 ? Number(startRaw) : 1;

	const stepsHtml: string[] = [];
	for (const child of node.children || []) {
		// Children may already have been mutated to type:'html' by the integrator's
		// child-first pre-pass; check the __md2Step marker, not the directive type.
		if (child && child.data && child.data.__md2Step) {
			stepsHtml.push(child.data.__md2Step);
		}
	}

	const html =
		`<ol class="md2-steps" start="${escapeAttr(String(start))}">` + stepsHtml.join('') + `</ol>`;

	node.type = 'html';
	node.value = html;
	node.children = [];
	delete node.data;
}

/**
 * Apply the `:::step` container directive.
 *
 * Stores the rendered step on `node.data.__md2Step` for the parent
 * `:::steps` directive to collect. Reduces the node to an empty html
 * node so it has no standalone output.
 */
export function applyStepDirective(node: MutableNode, attrs: DirectiveAttrs): void {
	const label = extractLabel(node) || attrs.label || '';

	const statusRaw = attrs.status ? String(attrs.status).toLowerCase() : '';
	const status = ALLOWED_STATUS.has(statusRaw) ? statusRaw : '';

	const severityRaw = attrs.severity ? String(attrs.severity).toLowerCase() : '';
	const severity = ALLOWED_SEVERITY.has(severityRaw) ? severityRaw : '';

	const classes = ['md2-step'];
	if (status) classes.push(`md2-step-${status}`);
	if (severity) classes.push(`md2-step-sev-${severity}`);

	const bodyHtml = renderChildrenToHtml(node.children || []);
	const headerHtml = label ? `<header class="md2-step-header">${escapeHtml(label)}</header>` : '';
	const bodyWrap = bodyHtml ? `<div class="md2-step-body">${bodyHtml}</div>` : '';

	const stepAttrs = [
		`class="${classes.join(' ')}"`,
		status ? `data-status="${escapeAttr(status)}"` : '',
		severity ? `data-severity="${escapeAttr(severity)}"` : '',
		// aria-current="step" exposes the in-progress step to AT users. The
		// data-status attribute is already mirrored for any consumer doing
		// programmatic queries, but AT respect aria-current first.
		status === 'current' ? `aria-current="step"` : ''
	]
		.filter(Boolean)
		.join(' ');

	const stepHtml =
		`<li ${stepAttrs}>` +
		`<span class="md2-step-marker" aria-hidden="true"></span>` +
		`<div class="md2-step-content">` +
		headerHtml +
		bodyWrap +
		`</div>` +
		`</li>`;

	const data = node.data || (node.data = {});
	data.__md2Step = stepHtml;

	// Keep `data` attached so the parent's `applyStepsDirective` can read
	// `child.data.__md2Step` after this runs.
	node.type = 'html';
	node.value = '';
	node.children = [];
}

function renderChildrenToHtml(children: MutableNode[]): string {
	if (!children || children.length === 0) return '';
	const parent = { type: 'root', children } as unknown as MdastNodes;
	try {
		const hast = toHast(parent, { allowDangerousHtml: true });
		if (!hast) return '';
		return toHtml(hast as HastNodes, { allowDangerousHtml: true });
	} catch {
		return '';
	}
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
