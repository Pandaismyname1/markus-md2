import { describe, it, expect } from 'vitest';
import { compileMd2, compileMd2WithDiagnostics } from './compile.js';

describe('compare / option directives', () => {
	it('defaults to mode=diff when no option has a `key=`', async () => {
		const src = [
			'::::compare',
			':::option[Before]',
			'a',
			':::',
			':::option[After]',
			'b',
			':::',
			'::::'
		].join('\n');
		const html = await compileMd2(src);
		expect(html).toContain('md2-compare-diff');
		expect(html).toContain('data-mode="diff"');
		expect(html).toContain('data-options="2"');
		// No key chips in diff mode.
		expect(html).not.toContain('md2-compare-option-key');
	});

	it('auto-promotes to mode=vote when any option carries `key=`', async () => {
		const src = [
			'::::compare{title="Pick"}',
			':::option[Alpha]{key=A}',
			'a',
			':::',
			':::option[Beta]{key=B}',
			'b',
			':::',
			'::::'
		].join('\n');
		const html = await compileMd2(src);
		expect(html).toContain('md2-compare-vote');
		expect(html).toContain('data-mode="vote"');
		expect(html).toContain('data-options="2"');
		// Each option carries data-key.
		expect(html).toContain('data-key="A"');
		expect(html).toContain('data-key="B"');
		// Key chips appear in headers.
		const chips = html.match(/class="md2-compare-option-key"/g) ?? [];
		expect(chips.length).toBe(2);
	});

	it('honours an explicit mode=vote even with no keys', async () => {
		const src = [
			'::::compare{mode=vote}',
			':::option[A]',
			'a',
			':::',
			':::option[B]',
			'b',
			':::',
			'::::'
		].join('\n');
		const html = await compileMd2(src);
		expect(html).toContain('data-mode="vote"');
		// No keys → no chips even though mode=vote.
		expect(html).not.toContain('md2-compare-option-key');
	});

	it('renders the title header when `title=` is set', async () => {
		const src = [
			'::::compare{title="Which approach?"}',
			':::option[A]',
			'a',
			':::',
			':::option[B]',
			'b',
			':::',
			'::::'
		].join('\n');
		const html = await compileMd2(src);
		expect(html).toContain('md2-compare-title');
		expect(html).toContain('Which approach?');
	});

	it('wraps options in a single .md2-compare-grid div', async () => {
		const src = [
			'::::compare',
			':::option[A]',
			'a',
			':::',
			':::option[B]',
			'b',
			':::',
			'::::'
		].join('\n');
		const html = await compileMd2(src);
		const grids = html.match(/class="md2-compare-grid"/g) ?? [];
		expect(grids.length).toBe(1);
	});

	it('renders each option as <article class="md2-compare-option">', async () => {
		const src = [
			'::::compare',
			':::option[A]',
			'a',
			':::',
			':::option[B]',
			'b',
			':::',
			'::::'
		].join('\n');
		const html = await compileMd2(src);
		const articles = html.match(/<article class="md2-compare-option[^"]*"/g) ?? [];
		expect(articles.length).toBe(2);
	});

	it('applies severity class + data-severity per option when allowed', async () => {
		const src = [
			'::::compare',
			':::option[A]{severity=blocking}',
			'a',
			':::',
			':::option[B]{severity=success}',
			'b',
			':::',
			'::::'
		].join('\n');
		const html = await compileMd2(src);
		expect(html).toContain('md2-compare-option-blocking');
		expect(html).toContain('data-severity="blocking"');
		expect(html).toContain('md2-compare-option-success');
		expect(html).toContain('data-severity="success"');
	});

	it('drops invalid severity values from option', async () => {
		const src = [
			'::::compare',
			':::option[A]{severity=fubar}',
			'a',
			':::',
			':::option[B]',
			'b',
			':::',
			'::::'
		].join('\n');
		const html = await compileMd2(src);
		expect(html).not.toContain('md2-compare-option-fubar');
		expect(html).not.toContain('data-severity="fubar"');
	});

	it('does not leak the internal __compareMode attr into output', async () => {
		const src = [
			'::::compare',
			':::option[A]{key=A}',
			'a',
			':::',
			':::option[B]{key=B}',
			'b',
			':::',
			'::::'
		].join('\n');
		const html = await compileMd2(src);
		expect(html).not.toContain('__compareMode');
	});

	it('emits a diagnostic when fewer than 2 options are present but still renders', async () => {
		const { html, diagnostics } = await compileMd2WithDiagnostics(
			['::::compare', ':::option[Only]', 'a', ':::', '::::'].join('\n')
		);
		const diag = diagnostics.find((d) => d.code === 'MD2_COMPARE_TOO_FEW_OPTIONS');
		expect(diag).toBeDefined();
		expect(diag?.severity).toBe('warning');
		expect(diag?.directive).toBe('compare');
		expect(diag?.message).toMatch(/fewer than 2/);
		expect(html).toContain('data-options="1"');
		expect(html).toContain('md2-compare-option');
	});
});
