/**
 * MD2 `tree` container directive — a directory/module tree visualisation.
 *
 * Syntax: an indented Markdown bullet list inside `:::tree … :::`.
 *
 *   :::tree
 *
 *   - src/
 *     - lib/
 *       - md2/
 *         - compile.ts
 *         - remark-md2.ts  :badge[hot]{severity=warning}
 *     - routes/
 *       - +page.svelte
 *
 *   :::
 *
 * Inline directives (`:badge`, `:jump`, …) inside list items are passed through
 * untouched so authors can annotate items.
 *
 * The rendered shape is recursive: a top-level `<ul class="md2-tree">` whose
 * descendant `<li class="md2-tree-item">` elements carry depth / position
 * marker classes so CSS can paint the box-drawing characters as
 * pseudo-elements. No JavaScript is required at runtime.
 */

import type { DirectiveAttrs, MutableNode } from './md2-types.js';

/**
 * Wire a `tree` container directive so its body's bullet list renders as a
 * box-drawing-character tree.
 */
export function applyTreeDirective(node: MutableNode, attrs: DirectiveAttrs): void {
	const data = node.data || (node.data = {});
	data.hName = 'div';
	data.hProperties = { className: ['md2-tree-root'] };

	if (attrs && attrs.title) {
		const children = node.children || (node.children = []);
		children.unshift({
			type: 'paragraph',
			data: {
				hName: 'header',
				hProperties: { className: ['md2-tree-title'] }
			},
			children: [{ type: 'text', value: String(attrs.title) }]
		});
	}

	for (const child of node.children || []) {
		if (child && child.type === 'list') {
			decorateList(child, 0);
		}
	}
}

function decorateList(listNode: MutableNode, depth: number): void {
	const data = listNode.data || (listNode.data = {});
	data.hName = 'ul';
	const cls = depth === 0 ? ['md2-tree'] : ['md2-tree-children'];
	data.hProperties = {
		className: cls,
		'data-depth': String(depth)
	};

	const items = listNode.children || [];
	const lastIndex = items.length - 1;

	items.forEach((item, idx) => {
		if (!item || item.type !== 'listItem') return;
		decorateItem(item, depth, idx === lastIndex);
	});
}

function decorateItem(itemNode: MutableNode, depth: number, isLast: boolean): void {
	const data = itemNode.data || (itemNode.data = {});

	let hasChildList = false;
	for (const c of itemNode.children || []) {
		if (c && c.type === 'list') {
			hasChildList = true;
			decorateList(c, depth + 1);
		}
	}

	const className = ['md2-tree-item'];
	if (isLast) className.push('md2-tree-item-last');
	className.push(hasChildList ? 'md2-tree-item-branch' : 'md2-tree-item-leaf');

	data.hName = 'li';
	data.hProperties = {
		className,
		'data-depth': String(depth),
		'data-last': isLast ? 'true' : 'false'
	};
}
