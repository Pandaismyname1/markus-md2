import { describe, it, expect } from 'vitest';
import { compileMd2, compileMd2WithDiagnostics } from './compile.js';

const codeBlock = (lines: string[]): string => ['```ts', ...lines, '```'].join('\n');

const wrap = (codeLines: string[], annotations: string[], opts: { collapsed?: boolean } = {}) =>
	[
		`:::annotate-code{lang=ts${opts.collapsed ? ' collapsed' : ''}}`,
		'',
		codeBlock(codeLines),
		'',
		...annotations,
		':::'
	].join('\n');

describe('annotate-code directive', () => {
	it('wraps output in a <figure> with caption + body when not collapsed', async () => {
		const html = await compileMd2(wrap(['const a = 1;'], ['@1 blocking: bad']));
		expect(html).toContain('<figure class="md2-annotate-code"');
		expect(html).toContain('data-lang="ts"');
		expect(html).toContain('md2-annotate-code-caption');
		expect(html).toContain('md2-annotate-code-body');
	});

	it('renders one md2-code-row per source line, padded line numbers and Prism tokens', async () => {
		const html = await compileMd2(wrap(['const a = 1;', 'const b = 2;'], []));
		const rows = html.match(/class="md2-code-row[^"]*"/g) ?? [];
		expect(rows.length).toBe(2);
		// Line numbers are 3-wide, right-padded.
		expect(html).toContain('  1');
		expect(html).toContain('  2');
		// Prism tokenisation runs (TS keyword highlighting).
		expect(html).toContain('token keyword');
	});

	it('tints a single annotated line with md2-code-row-<severity>', async () => {
		const html = await compileMd2(wrap(['const a = 1;'], ['@1 blocking: bad']));
		expect(html).toContain('md2-code-row-blocking');
		expect(html).toContain('md2-code-ann-row');
		expect(html).toContain('md2-code-ann-row-blocking');
		expect(html).toContain('bad');
	});

	it('stacks multiple annotations targeting the same start line in source order', async () => {
		const html = await compileMd2(
			wrap(['const a = 1;'], ['@1 blocking: first', '@1 nit: second', '@1 warning: third'])
		);
		// All three annotation rows are emitted under line 1.
		expect(html).toContain('first');
		expect(html).toContain('second');
		expect(html).toContain('third');
		const annRows = html.match(/class="md2-code-ann-row [^"]+"/g) ?? [];
		expect(annRows.length).toBe(3);
		// Order is preserved: blocking, then nit, then warning.
		expect(html.indexOf('first')).toBeLessThan(html.indexOf('second'));
		expect(html.indexOf('second')).toBeLessThan(html.indexOf('third'));
		// Last-declared severity wins the row tint — 'warning' is last on line 1.
		expect(html).toContain('md2-code-row-warning');
	});

	it('range @N-M tints lines N..M and attaches the annotation row to line N only', async () => {
		const html = await compileMd2(
			wrap(
				['const a = 1;', 'const b = 2;', 'const c = 3;', 'const d = 4;'],
				['@2-4 blocking: spans three lines']
			)
		);
		// All three lines (2-4) are tinted blocking.
		const tinted = html.match(/md2-code-row md2-code-row-blocking/g) ?? [];
		expect(tinted.length).toBe(3);
		// Only one annotation row is emitted (attached to line 2).
		const annRows = html.match(/md2-code-ann-row md2-code-ann-row-blocking/g) ?? [];
		expect(annRows.length).toBe(1);
		expect(html).toContain('spans three lines');
		// Line 1 is NOT tinted.
		expect(html).toContain(
			'class="md2-code-row"><div class="md2-code-line"><span class="md2-code-ln">  1</span>'
		);
	});

	it('later-declared severity wins tint on overlapping ranges', async () => {
		const html = await compileMd2(
			wrap(
				['const a = 1;', 'const b = 2;', 'const c = 3;', 'const d = 4;'],
				['@1-3 nit: first', '@2-4 blocking: second']
			)
		);
		// Line 1 stays nit (only the first annotation touches it).
		expect(html).toContain('md2-code-row md2-code-row-nit');
		// Lines 2, 3, 4 are tinted blocking (second annotation wins).
		const blocking = html.match(/md2-code-row md2-code-row-blocking/g) ?? [];
		expect(blocking.length).toBe(3);
	});

	it('swaps a backward range (@N-M with M < N) and emits a diagnostic', async () => {
		const { html, diagnostics } = await compileMd2WithDiagnostics(
			wrap(
				['const a = 1;', 'const b = 2;', 'const c = 3;', 'const d = 4;'],
				['@4-2 info: backward']
			)
		);
		const diag = diagnostics.find((d) => d.code === 'MD2_ANNOTATE_RANGE_REVERSED');
		expect(diag).toBeDefined();
		expect(diag?.severity).toBe('warning');
		expect(diag?.directive).toBe('annotate-code');
		expect(diag?.message).toMatch(/@4-2/);
		// Range was swapped: lines 2..4 tinted info.
		const tinted = html.match(/md2-code-row md2-code-row-info/g) ?? [];
		expect(tinted.length).toBe(3);
		// Annotation row is attached to line 2 (the smaller after swap).
		expect(html).toContain('md2-code-ann-row-info');
	});

	it('lines with no annotation get a plain md2-code-row (no severity suffix)', async () => {
		const html = await compileMd2(wrap(['const a = 1;', 'const b = 2;'], ['@1 nit: just one']));
		// Line 2 row has no severity suffix.
		expect(html).toContain(
			'class="md2-code-row"><div class="md2-code-line"><span class="md2-code-ln">  2</span>'
		);
	});

	it('renders a collapsible <details> wrapper when `collapsed` flag is present', async () => {
		const html = await compileMd2(
			wrap(['const a = 1;'], ['@1 blocking: bad'], { collapsed: true })
		);
		expect(html).toContain('<details class="md2-annotate-code md2-annotate-code-collapsible"');
		expect(html).toContain('<summary class="md2-annotate-code-caption md2-annotate-code-summary"');
		// Summary meta includes line count + annotation severity tallies.
		expect(html).toContain('1 lines');
		expect(html).toContain('1 blocking');
	});

	it('handles annotate-code with no annotations and no language', async () => {
		const html = await compileMd2(
			[':::annotate-code', '', '```', 'plain code', '```', '', ':::'].join('\n')
		);
		// data-lang is empty when lang is omitted.
		expect(html).toContain('data-lang=""');
		// Caption falls back to "code".
		expect(html).toContain('>code<');
		// No annotation row rendered.
		expect(html).not.toContain('md2-code-ann-row');
	});
});

describe('annotate-code range bounds', () => {
	it('clamps an absurd end line instead of allocating per line in the range', async () => {
		const src = [
			':::annotate-code{lang=ts}',
			'```ts',
			'const a = 1;',
			'```',
			'',
			'@1-1000000000 info: this range is far larger than the code',
			':::'
		].join('\n');
		const started = Date.now();
		const html = await compileMd2(src);
		expect(Date.now() - started).toBeLessThan(2000);
		expect(html).toContain('md2-annotate-code');
		// One code row, so at most one tinted row — not a million.
		expect((html.match(/md2-code-row-info/g) || []).length).toBeLessThanOrEqual(2);
	});

	it('still tints a range that fits inside the code', async () => {
		const src = [
			':::annotate-code{lang=ts}',
			'```ts',
			'const a = 1;',
			'const b = 2;',
			'const c = 3;',
			'```',
			'',
			'@1-2 warning: covers the first two lines',
			':::'
		].join('\n');
		const html = await compileMd2(src);
		expect((html.match(/md2-code-row-warning/g) || []).length).toBe(2);
	});
});
