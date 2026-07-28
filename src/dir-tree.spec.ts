import { describe, it, expect } from 'vitest';
import { compileMd2 } from './compile.js';

describe('tree directive', () => {
	it('renders <div class="md2-tree-root"> wrapping a <ul class="md2-tree">', async () => {
		const html = await compileMd2(':::tree\n\n- a\n- b\n\n:::');
		expect(html).toContain('<div class="md2-tree-root">');
		expect(html).toContain('<ul class="md2-tree"');
		expect(html).toContain('data-depth="0"');
	});

	it('renders a title header when `title=` is set', async () => {
		const html = await compileMd2(':::tree{title="src"}\n\n- a\n\n:::');
		expect(html).toContain('md2-tree-title');
		expect(html).toContain('>src<');
	});

	it('marks the last item at every depth with md2-tree-item-last + data-last="true"', async () => {
		const html = await compileMd2(':::tree\n\n- a\n- b\n- c\n\n:::');
		// Three items total, only the last should carry the last/marker classes.
		const lasts = html.match(/md2-tree-item-last/g) ?? [];
		expect(lasts.length).toBe(1);
		expect(html).toContain('data-last="true"');
		// And two items are marked data-last="false".
		const notLasts = html.match(/data-last="false"/g) ?? [];
		expect(notLasts.length).toBe(2);
	});

	it('distinguishes branch from leaf via class names', async () => {
		const html = await compileMd2([':::tree', '', '- a', '  - a.1', '- b', '', ':::'].join('\n'));
		// Item `a` has a child list → branch.
		expect(html).toContain('md2-tree-item-branch');
		// Items `a.1` and `b` have no child list → leaf.
		expect(html).toContain('md2-tree-item-leaf');
	});

	it('renders nested child <ul class="md2-tree-children"> at depth+1', async () => {
		const html = await compileMd2(
			[':::tree', '', '- a', '  - a.1', '    - a.1.1', '', ':::'].join('\n')
		);
		expect(html).toContain('<ul class="md2-tree-children" data-depth="1"');
		expect(html).toContain('<ul class="md2-tree-children" data-depth="2"');
		expect(html).toContain('data-depth="0"');
		expect(html).toContain('data-depth="1"');
		expect(html).toContain('data-depth="2"');
	});

	it('passes inline :badge directives through unchanged inside items', async () => {
		const html = await compileMd2(
			[':::tree', '', '- foo.ts :badge[hot]{severity=warning}', '', ':::'].join('\n')
		);
		expect(html).toContain('md2-badge-warning');
		expect(html).toContain('>hot</span>');
	});
});
