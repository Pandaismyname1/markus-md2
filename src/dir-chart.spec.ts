import { describe, it, expect } from 'vitest';
import { compileMd2 } from './compile.js';

describe('chart directive — bar', () => {
	it('renders <figure class="md2-chart md2-chart-bar"> with bar rects and a data table', async () => {
		const html = await compileMd2(':::chart{type=bar title="T"}\nFoo: 10\nBar: 20\n:::');
		expect(html).toContain('class="md2-chart md2-chart-bar"');
		// Title rendered.
		expect(html).toContain('md2-chart-title');
		expect(html).toContain('>T<');
		// Bar rects: one per data point.
		const bars = html.match(/<rect class="md2-chart-bar"/g) ?? [];
		expect(bars.length).toBe(2);
		// Visually-hidden but AT-readable data table. Uses the visually-hidden
		// utility class rather than `hidden` (which would also hide it from AT).
		expect(html).toContain('<table class="md2-chart-data md2-visually-hidden">');
		expect(html).toContain('<th scope="col">Label</th>');
		expect(html).toContain('<th scope="row">Foo</th>');
		expect(html).toContain('<td>10</td>');
		expect(html).toContain('<th scope="row">Bar</th>');
		expect(html).toContain('<td>20</td>');
	});

	it('falls back to bar when type= is missing or unknown', async () => {
		const html = await compileMd2(':::chart\nFoo: 1\nBar: 2\n:::');
		expect(html).toContain('md2-chart-bar');

		const html2 = await compileMd2(':::chart{type=pie}\nFoo: 1\nBar: 2\n:::');
		expect(html2).toContain('md2-chart-bar');
	});

	it('renders axes/grid lines and x-labels', async () => {
		const html = await compileMd2(':::chart{type=bar}\nFoo: 10\nBar: 20\n:::');
		expect(html).toContain('md2-chart-axis');
		expect(html).toContain('md2-chart-grid');
		expect(html).toContain('md2-chart-xlabel');
		expect(html).toContain('>Foo<');
		expect(html).toContain('>Bar<');
	});

	it('embeds value tooltips in the rect <title>', async () => {
		const html = await compileMd2(':::chart{type=bar}\nFoo: 10\nBar: 20\n:::');
		expect(html).toContain('<title>Foo: 10</title>');
		expect(html).toContain('<title>Bar: 20</title>');
	});

	it('renders empty placeholder when no parseable rows are present', async () => {
		const html = await compileMd2(':::chart{type=bar title=T}\n:::');
		expect(html).toContain('md2-chart-empty');
		expect(html).toContain('<!-- md2: chart: no data points found -->');
	});
});

describe('chart directive — line', () => {
	it('renders a line chart with path, area, dots, and data table', async () => {
		const html = await compileMd2(':::chart{type=line title=L}\n1: 10\n2: 20\n3: 15\n:::');
		expect(html).toContain('md2-chart-line');
		expect(html).toContain('md2-chart-line-path');
		expect(html).toContain('md2-chart-line-area');
		const dots = html.match(/class="md2-chart-dot"/g) ?? [];
		expect(dots.length).toBe(3);
		// Table is also emitted for line.
		expect(html).toContain('md2-chart-data');
	});

	it('renders baseline line + label when `baseline=` is set', async () => {
		const html = await compileMd2(':::chart{type=line baseline=15}\n1: 10\n2: 20\n3: 15\n:::');
		expect(html).toContain('md2-chart-baseline');
		expect(html).toContain('md2-chart-baseline-label');
		expect(html).toContain('baseline 15');
	});
});

describe('chart directive — sparkline', () => {
	it('parses whitespace-separated numbers and emits a sparkline SVG', async () => {
		const html = await compileMd2(':::chart{type=sparkline}\n12 18 22 19 24 31 29 34\n:::');
		expect(html).toContain('md2-chart-sparkline');
		expect(html).toContain('md2-chart-spark-svg');
		expect(html).toContain('md2-chart-spark-path');
		expect(html).toContain('md2-chart-spark-last');
		// Table uses "#" header for sparkline labels.
		expect(html).toContain('<th scope="col">#</th>');
		// 8 data rows.
		const rows = html.match(/<tr><th scope="row">/g) ?? [];
		expect(rows.length).toBe(8);
	});

	it('sparkline still renders title when present', async () => {
		const html = await compileMd2(':::chart{type=sparkline title=S}\n1 2 3\n:::');
		expect(html).toContain('md2-chart-title');
		expect(html).toContain('>S<');
	});

	it('sparkline empty (no numbers) emits empty placeholder', async () => {
		const html = await compileMd2(':::chart{type=sparkline}\n:::');
		expect(html).toContain('md2-chart-empty');
	});
});
