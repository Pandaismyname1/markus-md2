import { describe, it, expect } from 'vitest';
import { compileMd2, compileMd2WithDiagnostics } from './compile.js';

describe('tabs / tab directives', () => {
	it('renders a div.md2-tabs with one radio + label + panel per child :::tab', async () => {
		const src = [
			'::::tabs{id=demo}',
			':::tab[Source]',
			'body1',
			':::',
			':::tab[Output]',
			'body2',
			':::',
			'::::'
		].join('\n');
		const html = await compileMd2(src);
		expect(html).toContain('class="md2-tabs"');
		expect(html).toContain('data-md2-tabs-id="demo"');
		// One input per tab.
		const inputs = html.match(/class="md2-tabs-input"/g) ?? [];
		expect(inputs.length).toBe(2);
		// One label per tab.
		const labels = html.match(/class="md2-tabs-label"/g) ?? [];
		expect(labels.length).toBe(2);
		// One panel per tab.
		const panels = html.match(/class="md2-tabs-panel"/g) ?? [];
		expect(panels.length).toBe(2);
		// Labels carry the tab name.
		expect(html).toContain('>Source</label>');
		expect(html).toContain('>Output</label>');
		// Bodies are rendered into their panels.
		expect(html).toContain('body1');
		expect(html).toContain('body2');
	});

	it('checks the first tab by default', async () => {
		const src = ['::::tabs', ':::tab[A]', 'a', ':::', ':::tab[B]', 'b', ':::', '::::'].join('\n');
		const html = await compileMd2(src);
		// First input has `checked`.
		const firstInputMatch = html.match(/<input type="radio"[^>]*>/);
		expect(firstInputMatch).toBeTruthy();
		expect(firstInputMatch![0]).toContain('checked');
	});

	it('selects the tab named by `default=` (by label match)', async () => {
		const src = [
			'::::tabs{id=auth default="GitHub"}',
			':::tab[Email]',
			'email',
			':::',
			':::tab[GitHub]',
			'github',
			':::',
			'::::'
		].join('\n');
		const html = await compileMd2(src);
		// The GitHub input is the one with `checked`.
		const githubInput = html.match(/<input[^>]*id="md2-tab-auth-github"[^>]*>/);
		expect(githubInput).toBeTruthy();
		expect(githubInput![0]).toContain('checked');
		// The Email input is not checked.
		const emailInput = html.match(/<input[^>]*id="md2-tab-auth-email"[^>]*>/);
		expect(emailInput).toBeTruthy();
		expect(emailInput![0]).not.toContain('checked');
	});

	it('selects the tab named by `default=` (by key match)', async () => {
		const src = [
			'::::tabs{id=t default=out}',
			':::tab[Source]',
			'src',
			':::',
			':::tab[Output]{key=out}',
			'out',
			':::',
			'::::'
		].join('\n');
		const html = await compileMd2(src);
		const checked = html.match(/<input[^>]*checked[^>]*>/);
		expect(checked).toBeTruthy();
		expect(checked![0]).toContain('md2-tab-t-out');
	});

	it('slugifies tab labels into tab keys when no `key=` is provided', async () => {
		const src = ['::::tabs{id=x}', ':::tab[My Tab Name]', 'body', ':::', '::::'].join('\n');
		const html = await compileMd2(src);
		expect(html).toContain('data-md2-tab-key="my-tab-name"');
	});

	it('slugifies the tabs id attribute', async () => {
		const src = ['::::tabs{id="My Tab Group"}', ':::tab[A]', 'a', ':::', '::::'].join('\n');
		const html = await compileMd2(src);
		expect(html).toContain('data-md2-tabs-id="my-tab-group"');
	});

	it('emits an empty md2-tabs wrapper when no :::tab children are present', async () => {
		const html = await compileMd2('::::tabs{id=empty}\n::::');
		expect(html).toContain('class="md2-tabs"');
		expect(html).toContain('data-md2-tabs-id="empty"');
		expect(html).not.toContain('md2-tabs-input');
		expect(html).not.toContain('md2-tabs-panel');
	});

	it('orphan :::tab outside :::tabs renders empty and emits a diagnostic', async () => {
		const { html, diagnostics } = await compileMd2WithDiagnostics(':::tab[Orphan]\nbody\n:::');
		// Empty render — no tab markup leaked through.
		expect(html.trim()).toBe('');
		const orphan = diagnostics.find((d) => d.code === 'MD2_ORPHAN_TAB');
		expect(orphan).toBeDefined();
		expect(orphan?.severity).toBe('warning');
		expect(orphan?.directive).toBe('tab');
		expect(orphan?.message).toMatch(/outside ':::tabs'/);
	});
});
