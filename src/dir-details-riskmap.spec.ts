import { describe, it, expect } from 'vitest';
import { compileMd2 } from './compile.js';

describe('details directive', () => {
	it('wraps body in <details> with summary from [label]', async () => {
		const html = await compileMd2(':::details[More info]\nbody text\n:::');
		expect(html).toContain('<details class="md2-details"');
		expect(html).toContain('<summary class="md2-details-summary">More info</summary>');
		expect(html).toContain('body text');
	});

	it('uses `summary=` attribute when no [label] is provided', async () => {
		const html = await compileMd2(':::details{summary="Click me"}\nhidden\n:::');
		expect(html).toContain('<summary class="md2-details-summary">Click me</summary>');
	});

	it('defaults summary text to "Details" when both [label] and `summary` are missing', async () => {
		const html = await compileMd2(':::details\nbody\n:::');
		expect(html).toContain('<summary class="md2-details-summary">Details</summary>');
	});
});

describe('risk-map directive', () => {
	it('renders as a <nav> with class md2-risk-map', async () => {
		const html = await compileMd2('::::risk-map\n- a\n- b\n::::');
		expect(html).toContain('<nav class="md2-risk-map"');
		expect(html).toContain('<li>a</li>');
		expect(html).toContain('<li>b</li>');
	});

	it('prepends a title header when `title=` is set', async () => {
		const html = await compileMd2('::::risk-map{title="Files at risk"}\n- a\n::::');
		expect(html).toContain('md2-risk-map-title');
		expect(html).toContain('Files at risk');
	});
});
