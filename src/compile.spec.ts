import { describe, it, expect } from 'vitest';
import { compileMd2, compileMd2Sync } from './compile.js';

describe('compileMd2 — basics', () => {
	it('passes plain CommonMark through to HTML', async () => {
		const html = await compileMd2('# Hello\n\nA *paragraph*.');
		expect(html).toContain('<h1>Hello</h1>');
		expect(html).toContain('<em>paragraph</em>');
	});

	it('returns a string for empty input', async () => {
		const html = await compileMd2('');
		expect(typeof html).toBe('string');
	});

	it('compileMd2Sync produces identical output to async variant', async () => {
		const src = ':::callout{severity=info title="X"}\nhello\n:::';
		const a = await compileMd2(src);
		const b = compileMd2Sync(src);
		expect(a).toBe(b);
	});

	it('leaves unknown container directives unmodified (default branch)', async () => {
		// An unrecognised directive falls through the switch — remark-rehype
		// keeps its body as a paragraph but emits no directive wrapper.
		const html = await compileMd2(':::nope-not-a-directive\nhello\n:::');
		// Body text is preserved …
		expect(html).toContain('hello');
		// … but no MD2 wrapper class shows up for the unknown name.
		expect(html).not.toContain('md2-nope-not-a-directive');
	});
});
