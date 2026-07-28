import { describe, it, expect } from 'vitest';
import { compileMd2 } from './compile.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures');
const kitchenSink = readFileSync(resolve(fixtures, 'kitchen-sink.md'), 'utf8');
const prReview = readFileSync(resolve(fixtures, 'pr-review.md'), 'utf8');

describe('kitchen-sink fixture', () => {
	it('compiles end-to-end without throwing and produces a non-trivial HTML payload', async () => {
		const html = await compileMd2(kitchenSink);
		expect(typeof html).toBe('string');
		// Sanity: a real run produces several KB of HTML.
		expect(html.length).toBeGreaterThan(1000);
	});

	it('emits the expected directive class names for every covered directive', async () => {
		const html = await compileMd2(kitchenSink);
		const required = [
			'md2-callout',
			'md2-callout-success',
			'md2-callout-warning',
			'md2-callout-dismissible',
			'md2-columns',
			'md2-column',
			'md2-tabs',
			'md2-tabs-panel',
			'md2-tabs-input',
			'md2-tabs-label',
			'md2-steps',
			'md2-step',
			'md2-step-current',
			'md2-figure',
			'md2-timeline',
			'md2-timeline-event',
			'md2-timeline-dot',
			'md2-compare',
			'md2-compare-vote',
			'md2-compare-diff',
			'md2-compare-option',
			'md2-compare-option-key',
			'md2-tree-root',
			'md2-tree-item-branch',
			'md2-tree-item-leaf',
			'md2-flow',
			'md2-flow-svg',
			'md2-flow-node-decision',
			'md2-chart',
			'md2-chart-bar',
			'md2-chart-line',
			'md2-chart-sparkline',
			'md2-chart-data',
			'md2-annotate-code',
			'md2-code-row',
			'md2-code-ann-row',
			'md2-risk-map',
			'md2-badge',
			'md2-jump'
		];
		for (const cls of required) {
			expect(html, `missing class "${cls}"`).toContain(cls);
		}
	});

	it('renders both vote-mode and diff-mode compare sections from the fixture', async () => {
		const html = await compileMd2(kitchenSink);
		expect(html).toContain('data-mode="vote"');
		expect(html).toContain('data-mode="diff"');
	});

	it('renders all three chart types from the fixture', async () => {
		const html = await compileMd2(kitchenSink);
		expect(html).toContain('md2-chart-bar');
		expect(html).toContain('md2-chart-line');
		expect(html).toContain('md2-chart-sparkline');
	});

	it('renders the annotated-code block with severity tints', async () => {
		const html = await compileMd2(kitchenSink);
		// Fixture has blocking, warning, nit, info annotations. Row tints use
		// "last declared wins" on overlap, so the row for line 7 (blocking +
		// nit) renders as nit. The annotation rows beneath always preserve
		// the severity each annotation was declared with.
		expect(html).toContain('md2-code-row-warning');
		expect(html).toContain('md2-code-row-nit');
		expect(html).toContain('md2-code-ann-row-blocking');
		expect(html).toContain('md2-code-ann-row-warning');
		expect(html).toContain('md2-code-ann-row-nit');
		expect(html).toContain('md2-code-ann-row-info');
	});
});

describe('pr-review fixture', () => {
	it('compiles end-to-end without throwing', async () => {
		const html = await compileMd2(prReview);
		expect(typeof html).toBe('string');
		expect(html.length).toBeGreaterThan(100);
	});
});
