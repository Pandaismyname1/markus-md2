import { describe, it, expect } from 'vitest';
import { compileMd2 } from './compile.js';

describe('figure directive', () => {
	it('renders <figure><img …></figure> when only `src` is given', async () => {
		const html = await compileMd2(':::figure{src="/img/a.png"}\n:::');
		expect(html).toContain('<figure class="md2-figure">');
		expect(html).toContain('<img class="md2-figure-img" src="/img/a.png" alt="">');
		// No caption when body and credit are empty.
		expect(html).not.toContain('md2-figure-caption');
	});

	it('passes through `alt` attribute', async () => {
		const html = await compileMd2(':::figure{src="/img/a.png" alt="Diagram"}\n:::');
		expect(html).toContain('alt="Diagram"');
	});

	it('wraps the <img> in an <a class="md2-figure-link"> when `link=` is set', async () => {
		const html = await compileMd2(
			':::figure{src="/img/a.png" link="https://example.com/big.png"}\n:::'
		);
		expect(html).toContain('<a class="md2-figure-link" href="https://example.com/big.png">');
		expect(html).toContain('<img class="md2-figure-img"');
	});

	it('renders a caption wrapping the body + credit when either is present', async () => {
		const html = await compileMd2(':::figure{src="/img/a.png" credit="Jane Doe"}\nA caption.\n:::');
		expect(html).toContain('<figcaption class="md2-figure-caption">');
		expect(html).toContain('A caption.');
		expect(html).toContain('<span class="md2-figure-credit">Jane Doe</span>');
	});

	it('renders only credit (no body) when body is empty but credit is set', async () => {
		const html = await compileMd2(':::figure{src="/img/a.png" credit="J"}\n:::');
		expect(html).toContain('md2-figure-caption');
		expect(html).toContain('md2-figure-credit');
	});

	it('renders missing-src placeholder when `src` is omitted', async () => {
		const html = await compileMd2(':::figure\nCaption\n:::');
		expect(html).toContain('md2-figure-missing-src');
		expect(html).toContain('<!-- md2: figure: missing required attribute "src" -->');
		expect(html).not.toContain('<img');
	});

	it('escapes double quotes in src and alt attribute values', async () => {
		const html = await compileMd2(":::figure{src='/x\".png' alt='a\"b'}\n:::");
		// The raw-HTML path emits `&quot;` from escapeAttr, then rehype-raw
		// re-encodes the `&` so the literal `"` is preserved as `&#x26;quot;`
		// (or equivalent). What matters is the attribute boundaries are
		// intact and the literal quote is encoded — not how.
		expect(html).toMatch(/src="\/x(?:&quot;|&#x26;quot;|&amp;quot;)\.png"/);
		expect(html).toMatch(/alt="a(?:&quot;|&#x26;quot;|&amp;quot;)b"/);
	});
});
