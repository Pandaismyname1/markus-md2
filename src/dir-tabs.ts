/**
 * MD2 `tabs` / `tab` directive transforms.
 *
 * Mutates a `containerDirective` node into a raw-HTML node so rehype-raw
 * can pass the pre-rendered block through. Mirrors the pattern used by
 * `transformAnnotateCode` in `remark-md2.ts`.
 *
 * Syntax:
 *   :::tabs{id=demo default=Source}
 *   :::tab[Source]
 *   …body…
 *   :::
 *   :::tab[Output]{key=out}
 *   …body…
 *   :::
 *   :::
 *
 * Tab switching is pure CSS (radio inputs + `:checked + section`).
 */

import { toHtml } from 'hast-util-to-html';
import { toHast } from 'mdast-util-to-hast';
import type { Nodes as HastNodes } from 'hast';
import type { Nodes as MdastNodes } from 'mdast';

import { extractLabel } from './md2-utils.js';
import type { DirectiveAttrs, MutableNode } from './md2-types.js';

let tabsCounter = 0;

/** Apply the `:::tabs` container directive to `node`. */
export function applyTabsDirective(node: MutableNode, attrs: DirectiveAttrs): void {
	const rawId = attrs.id ? slugify(attrs.id) : `t${++tabsCounter}`;
	const defaultLabel = attrs.default ? String(attrs.default) : null;

	const tabs: Array<{ label: string; key: string; body: string }> = [];
	for (const child of node.children || []) {
		// Children may already have been mutated to type:'html' by the integrator's
		// child-first pre-pass; check the __md2Tab marker, which `applyTabDirective`
		// stashes on `child.data` regardless of post-pass type.
		if (child && child.data && child.data.__md2Tab) {
			tabs.push(child.data.__md2Tab);
		}
	}

	if (tabs.length === 0) {
		// Nothing to render — emit an empty wrapper.
		node.type = 'html';
		node.value = `<div class="md2-tabs" data-md2-tabs-id="${escapeAttr(rawId)}"></div>`;
		node.children = [];
		delete node.data;
		return;
	}

	let activeIndex = 0;
	if (defaultLabel) {
		const idx = tabs.findIndex((t) => t.label === defaultLabel || t.key === defaultLabel);
		if (idx >= 0) activeIndex = idx;
	}

	const radioName = `md2-tabs-${rawId}`;
	const inputs: string[] = [];
	const labels: string[] = [];
	const panels: string[] = [];

	tabs.forEach((tab, i) => {
		const tabKey = tab.key || slugify(tab.label) || String(i + 1);
		const inputId = `md2-tab-${rawId}-${tabKey}`;
		const panelId = `md2-tabpanel-${rawId}-${tabKey}`;
		const isActive = i === activeIndex;
		const checked = isActive ? ' checked' : '';
		// aria-controls links the label/input to its panel; aria-selected reflects
		// the *initial* checked state. The radio group's :checked CSS handles the
		// visible swap, but aria-selected stays static (no JS) — accept the trade
		// for a no-JS implementation. AT users navigating via the radio group's
		// native arrow-key support hear the panel reference via aria-controls.
		inputs.push(
			`<input type="radio" class="md2-tabs-input" name="${escapeAttr(radioName)}" id="${escapeAttr(inputId)}" aria-controls="${escapeAttr(panelId)}"${checked}>`
		);
		labels.push(
			`<label class="md2-tabs-label" for="${escapeAttr(inputId)}" role="tab" aria-controls="${escapeAttr(panelId)}" aria-selected="${isActive ? 'true' : 'false'}">${escapeHtml(tab.label)}</label>`
		);
		panels.push(
			`<section class="md2-tabs-panel" role="tabpanel" id="${escapeAttr(panelId)}" data-md2-tab-key="${escapeAttr(tabKey)}" tabindex="0">${tab.body}</section>`
		);
	});

	const html =
		`<div class="md2-tabs" data-md2-tabs-id="${escapeAttr(rawId)}">` +
		inputs.join('') +
		`<div class="md2-tabs-bar" role="tablist">${labels.join('')}</div>` +
		`<div class="md2-tabs-panels">${panels.join('')}</div>` +
		`</div>`;

	node.type = 'html';
	node.value = html;
	node.children = [];
	delete node.data;
}

/**
 * Apply the `:::tab` container directive.
 *
 * This stashes the rendered body and metadata on `node.data.__md2Tab` so
 * the surrounding `:::tabs` transform can collect them. The node itself
 * is reduced to an empty html node — the parent emits the real markup.
 */
export function applyTabDirective(node: MutableNode, attrs: DirectiveAttrs): void {
	const label = extractLabel(node) || attrs.label || 'Tab';
	const key = attrs.key ? slugify(attrs.key) : '';

	// Render the body children to HTML by routing through mdast → hast.
	const bodyHtml = renderChildrenToHtml(node.children || []);

	const data = node.data || (node.data = {});
	data.__md2Tab = { label, key, body: bodyHtml };

	// Reduce this node to an empty raw-html node so it leaves no trace
	// once the parent `tabs` directive emits its own markup. Keep `data`
	// attached so the parent can read `child.data.__md2Tab` after this runs.
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

function slugify(s: string): string {
	return String(s)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
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
