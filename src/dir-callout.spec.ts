import { describe, it, expect } from 'vitest';
import { compileMd2 } from './compile.js';

describe('callout directive', () => {
	it('renders an <aside> with severity classes and data-severity', async () => {
		const html = await compileMd2(':::callout{severity=warning}\nbody\n:::');
		expect(html).toContain('<aside');
		expect(html).toContain('md2-callout');
		expect(html).toContain('md2-callout-warning');
		expect(html).toContain('data-severity="warning"');
		expect(html).toContain('body');
	});

	it('defaults severity to info when omitted', async () => {
		const html = await compileMd2(':::callout\nbody\n:::');
		expect(html).toContain('md2-callout-info');
		expect(html).toContain('data-severity="info"');
	});

	it('renders a header with title text when `title` attr is set', async () => {
		const html = await compileMd2(':::callout{severity=info title="Heads up"}\nbody\n:::');
		expect(html).toContain('<header');
		expect(html).toContain('md2-callout-title');
		expect(html).toContain('Heads up');
	});

	it('renders an inline SVG icon when `icon=warning` is supplied', async () => {
		const html = await compileMd2(':::callout{severity=warning icon=warning}\nbody\n:::');
		expect(html).toContain('md2-callout-icon');
		expect(html).toContain('<svg');
	});

	it('marks icon-only callouts (no title) with md2-callout-title-icon-only', async () => {
		const html = await compileMd2(':::callout{severity=info icon=tip}\nbody\n:::');
		expect(html).toContain('md2-callout-title-icon-only');
	});

	it('adds dismiss button + dismissible class when `dismissible` flag is present', async () => {
		const html = await compileMd2(':::callout{severity=info dismissible}\nbody\n:::');
		expect(html).toContain('md2-callout-dismissible');
		expect(html).toContain('md2-callout-dismiss');
		expect(html).toContain('aria-label="Dismiss"');
	});

	it('renders an empty body without breaking', async () => {
		const html = await compileMd2(':::callout{severity=info}\n:::');
		expect(html).toContain('<aside');
		expect(html).toContain('md2-callout-info');
	});

	it('invalid severity falls back to info (md2-spec L240-243)', async () => {
		const html = await compileMd2(':::callout{severity=fubar}\nbody\n:::');
		expect(html).toContain('md2-callout-info');
		expect(html).toContain('data-severity="info"');
		expect(html).not.toContain('md2-callout-fubar');
	});
});

describe('badge directive', () => {
	it('renders a <span> badge with severity classes', async () => {
		const html = await compileMd2(':badge[Required]{severity=blocking}');
		expect(html).toContain('<span class="md2-badge md2-badge-blocking"');
		expect(html).toContain('data-severity="blocking"');
		expect(html).toContain('Required');
	});

	it('defaults severity to info when omitted', async () => {
		const html = await compileMd2(':badge[Note]');
		expect(html).toContain('md2-badge-info');
	});

	it('prepends an inline SVG icon when `icon=` is supplied', async () => {
		const html = await compileMd2(':badge[Required]{severity=blocking icon=warning}');
		expect(html).toContain('md2-badge-icon');
		expect(html).toContain('<svg');
	});

	it('passes a non-keyword icon glyph through as md2-icon-glyph', async () => {
		const html = await compileMd2(':badge[X]{severity=info icon=🔥}');
		expect(html).toContain('md2-icon-glyph');
		expect(html).toContain('🔥');
	});
});

describe('jump directive', () => {
	it('renders an anchor with class md2-jump and the target href', async () => {
		const html = await compileMd2(':jump[Go]{to=#section-2}');
		expect(html).toContain('<a href="#section-2"');
		expect(html).toContain('md2-jump');
		expect(html).toContain('Go');
	});

	it('falls back to href="#" when `to=` is omitted', async () => {
		const html = await compileMd2(':jump[Go]');
		expect(html).toContain('href="#"');
		expect(html).toContain('md2-jump');
	});
});
