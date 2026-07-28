/**
 * MD2 `figure` directive transform.
 *
 * Mutates a `containerDirective` node into a raw-HTML node so rehype-raw
 * passes the pre-rendered block through. Mirrors the pattern used by
 * `transformAnnotateCode` in `remark-md2.ts`.
 *
 * Syntax:
 *   :::figure{src="/img/diagram.svg" alt="Architecture" credit="Jane Doe" link="https://…"}
 *   A high-level view of the data flow.
 *   :::
 *
 * - `src` is required. Missing src renders an empty figure with a warning comment.
 * - `link`, when present, wraps the `<img>` in an `<a>`.
 * - The body (block-level CommonMark) becomes the caption.
 * - The figcaption is omitted when body + credit are both empty.
 */

import { toHtml } from 'hast-util-to-html';
import { toHast } from 'mdast-util-to-hast';
import type { Nodes as HastNodes } from 'hast';
import type { Nodes as MdastNodes } from 'mdast';

import type { DirectiveAttrs, MutableNode } from './md2-types.js';
import { emitDiagnosticAt } from './diagnostics.js';

/** Apply the `:::figure` container directive. */
export function applyFigureDirective(node: MutableNode, attrs: DirectiveAttrs): void {
	const src = attrs.src ? String(attrs.src) : '';
	const alt = attrs.alt != null ? String(attrs.alt) : '';
	const credit = attrs.credit ? String(attrs.credit) : '';
	const link = attrs.link ? String(attrs.link) : '';

	if (!src) {
		emitDiagnosticAt(node.position, {
			severity: 'error',
			message: "':::figure' is missing required attribute 'src'",
			directive: 'figure',
			code: 'MD2_FIGURE_MISSING_SRC'
		});
		node.type = 'html';
		node.value =
			`<figure class="md2-figure md2-figure-missing-src">` +
			`<!-- md2: figure: missing required attribute "src" -->` +
			`</figure>`;
		node.children = [];
		delete node.data;
		return;
	}

	const captionBodyHtml = renderChildrenToHtml(node.children || []);
	const creditHtml = credit ? `<span class="md2-figure-credit">${escapeHtml(credit)}</span>` : '';

	let imgHtml = `<img class="md2-figure-img" src="${escapeAttr(src)}" alt="${escapeAttr(alt)}">`;
	if (link) {
		imgHtml = `<a class="md2-figure-link" href="${escapeAttr(link)}">${imgHtml}</a>`;
	}

	const figcaptionHtml =
		captionBodyHtml || credit
			? `<figcaption class="md2-figure-caption">${captionBodyHtml}${creditHtml}</figcaption>`
			: '';

	const html = `<figure class="md2-figure">` + imgHtml + figcaptionHtml + `</figure>`;

	node.type = 'html';
	node.value = html;
	node.children = [];
	delete node.data;
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
