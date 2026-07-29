import { describe, it, expect } from 'vitest';
import { compileMd2 } from './compile.js';

describe('columns / column directives', () => {
	it('wraps a columns container in a div.md2-columns with default min/gap css vars', async () => {
		const html = await compileMd2('::::columns\n:::column\nbody\n:::\n::::');
		expect(html).toContain('class="md2-columns"');
		// Default style: --md2-cols-min:220px and --md2-cols-gap:1rem; no explicit columns count.
		expect(html).toContain('--md2-cols-min: 220px');
		expect(html).toContain('--md2-cols-gap: 1rem');
		expect(html).not.toContain('grid-template-columns: repeat(');
	});

	it('honours `cols=`, `min=`, and `gap=` attributes', async () => {
		const html = await compileMd2(
			'::::columns{cols=3 min=200px gap=0.75rem}\n:::column\na\n:::\n:::column\nb\n:::\n::::'
		);
		expect(html).toContain('grid-template-columns: repeat(3, 1fr)');
		expect(html).toContain('--md2-cols-min: 200px');
		expect(html).toContain('--md2-cols-gap: 0.75rem');
		// When cols=N is set, an explicit gap is also injected so the grid lays out.
		expect(html).toContain('gap: 0.75rem');
	});

	it('ignores a non-finite `cols=` value and keeps default layout', async () => {
		const html = await compileMd2('::::columns{cols=abc}\n:::column\nbody\n:::\n::::');
		expect(html).not.toContain('grid-template-columns: repeat(');
		expect(html).toContain('--md2-cols-min: 220px');
	});

	it('renders each :::column child as a div.md2-column', async () => {
		const html = await compileMd2(
			'::::columns\n:::column\nfirst\n:::\n:::column\nsecond\n:::\n::::'
		);
		// Two column wrappers, two bodies.
		const matches = html.match(/class="md2-column"/g) ?? [];
		expect(matches.length).toBe(2);
		expect(html).toContain('first');
		expect(html).toContain('second');
	});
});

describe('columns css value handling', () => {
	it('drops a min value that would escape the style declaration', async () => {
		const attack = ':::columns{min="1px;position:fixed;inset:0;background:url(https://evil.example/x)"}\nA\n:::';
		const html = await compileMd2(attack);
		expect(html).not.toContain('position:fixed');
		expect(html).not.toContain('evil.example');
		expect(html).toContain('--md2-cols-min: 220px');
	});

	it('drops a gap value carrying extra declarations', async () => {
		const html = await compileMd2(':::columns{gap="1rem;z-index:9999"}\nA\n:::');
		expect(html).not.toContain('z-index');
		expect(html).toContain('--md2-cols-gap: 1rem');
	});

	it('keeps legitimate lengths, calc() and var() values', async () => {
		const html = await compileMd2('::::columns{min=18rem gap="clamp(0.5rem, 2vw, 2rem)"}\n:::column\nA\n:::\n::::');
		expect(html).toContain('--md2-cols-min: 18rem');
		expect(html).toContain('--md2-cols-gap: clamp(0.5rem, 2vw, 2rem)');
	});
});
