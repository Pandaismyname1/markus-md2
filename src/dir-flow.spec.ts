import { describe, it, expect } from 'vitest';
import { compileMd2 } from './compile.js';

describe('flow directive', () => {
	it('renders <figure class="md2-flow"> with an inline SVG and direction attr', async () => {
		const html = await compileMd2(':::flow\na[A]\nb[B]\na -> b\n:::');
		expect(html).toContain('<figure class="md2-flow"');
		expect(html).toContain('data-direction="LR"');
		expect(html).toContain('<svg class="md2-flow-svg"');
		// Always emits the arrow marker.
		expect(html).toContain('id="md2-flow-arrow"');
	});

	it('honours direction=TB', async () => {
		const html = await compileMd2(':::flow{direction=TB}\na[A]\nb[B]\na -> b\n:::');
		expect(html).toContain('data-direction="TB"');
	});

	it('falls back to LR for an unrecognised direction', async () => {
		const html = await compileMd2(':::flow{direction=ZZ}\na[A]\nb[B]\na -> b\n:::');
		expect(html).toContain('data-direction="LR"');
	});

	it('renders a figcaption with title when `title=` is set', async () => {
		const html = await compileMd2(':::flow{title="Deploy pipeline"}\na[A]\n:::');
		expect(html).toContain('md2-flow-title');
		expect(html).toContain('Deploy pipeline');
	});

	it('renders a rect with rounded ends for start/end nodes', async () => {
		const html = await compileMd2(':::flow\na[Start]{kind=start}\nb[End]{kind=end}\na -> b\n:::');
		// kind=start uses rx = h/2 = 28
		expect(html).toContain('md2-flow-node-start');
		expect(html).toContain('rx="28"');
		expect(html).toContain('md2-flow-node-end');
	});

	it('renders a <polygon> for decision nodes', async () => {
		const html = await compileMd2(
			':::flow\nstart[Start]\ndecide[Decide]{kind=decision}\nend[End]\nstart -> decide\ndecide -> end\n:::'
		);
		expect(html).toContain('md2-flow-node-decision');
		expect(html).toContain('<polygon class="md2-flow-node-shape"');
	});

	it('renders process nodes (default kind) as rounded rectangles with rx="6"', async () => {
		const html = await compileMd2(':::flow\na[Plain]\nb[Plain2]\na -> b\n:::');
		expect(html).toContain('md2-flow-node-process');
		expect(html).toContain('rx="6"');
	});

	it('falls back to process for an unknown kind', async () => {
		const html = await compileMd2(':::flow\na[A]{kind=weird}\nb[B]\na -> b\n:::');
		expect(html).toContain('md2-flow-node-process');
		expect(html).not.toContain('md2-flow-node-weird');
	});

	it('draws a straight <path d="M … L …"> for adjacent forward edges', async () => {
		const html = await compileMd2(':::flow\na[A]\nb[B]\na -> b\n:::');
		// Adjacent forward edge → straight line (M … L …, no cubic).
		const edge = html.match(/data-from="a" data-to="b">[^<]*<path[^>]*\sd="([^"]+)"/);
		expect(edge).toBeTruthy();
		expect(edge![1]).toMatch(/^M\s/);
		expect(edge![1]).toContain(' L ');
		expect(edge![1]).not.toContain(' C ');
	});

	it('draws a cubic Bezier (M … C …) for skip edges (non-adjacent forward)', async () => {
		const html = await compileMd2(':::flow\na[A]\nb[B]\nc[C]\na -> c\na -> b\nb -> c\n:::');
		// a -> c skips b.
		const edge = html.match(/data-from="a" data-to="c">[^<]*<path[^>]*\sd="([^"]+)"/);
		expect(edge).toBeTruthy();
		expect(edge![1]).toContain(' C ');
		// Skip edges receive the md2-flow-edge-skip class.
		expect(html).toMatch(/class="md2-flow-edge md2-flow-edge-skip"[^>]*data-from="a" data-to="c"/);
	});

	it('draws a cubic Bezier and md2-flow-edge-back class for backward edges', async () => {
		const html = await compileMd2(':::flow\na[A]\nb[B]\na -> b\nb -> a\n:::');
		const edge = html.match(/data-from="b" data-to="a">[^<]*<path[^>]*\sd="([^"]+)"/);
		expect(edge).toBeTruthy();
		expect(edge![1]).toContain(' C ');
		expect(html).toMatch(/class="md2-flow-edge md2-flow-edge-back"[^>]*data-from="b" data-to="a"/);
	});

	it('parses labelled edges `a -label-> b` and emits an edge-label group', async () => {
		const html = await compileMd2(':::flow\na[A]{kind=decision}\nb[B]\na -ok-> b\n:::');
		expect(html).toContain('md2-flow-edge-label');
		expect(html).toContain('>ok</text>');
	});

	it('renders a flow-empty placeholder when the DSL has no node declarations', async () => {
		const html = await compileMd2(':::flow{title="empty"}\n:::');
		expect(html).toContain('md2-flow-empty');
		expect(html).toContain('<!-- md2: flow: no node declarations found -->');
		// Title still renders even when empty.
		expect(html).toContain('md2-flow-title');
	});

	it('silently drops edges that reference unknown ids', async () => {
		const html = await compileMd2(':::flow\na[A]\nb[B]\na -> ghost\na -> b\n:::');
		// Edge a -> b is rendered.
		expect(html).toContain('data-from="a" data-to="b"');
		// Edge a -> ghost is dropped (no edge group referencing ghost).
		expect(html).not.toContain('data-to="ghost"');
	});
});
