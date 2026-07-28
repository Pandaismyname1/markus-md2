import { describe, it, expect } from 'vitest';
import { compileMd2, compileMd2WithDiagnostics } from './compile.js';

const stepsSrc = (steps: Array<{ label: string; body: string; attrs?: string }>) =>
	[
		'::::steps',
		...steps.flatMap((s) => [`:::step[${s.label}]${s.attrs ? `{${s.attrs}}` : ''}`, s.body, ':::']),
		'::::'
	].join('\n');

describe('steps / step directives', () => {
	it('renders an <ol class="md2-steps"> with start=1 by default', async () => {
		const html = await compileMd2(
			stepsSrc([
				{ label: 'Install', body: 'npm install' },
				{ label: 'Run', body: 'npm run dev' }
			])
		);
		expect(html).toContain('<ol class="md2-steps" start="1">');
		// Two <li class="md2-step"> wrappers.
		const lis = html.match(/<li class="md2-step[^"]*"/g) ?? [];
		expect(lis.length).toBe(2);
	});

	it('honours start= attribute', async () => {
		const html = await compileMd2(
			['::::steps{start=5}', ':::step[A]', 'a', ':::', '::::'].join('\n')
		);
		expect(html).toContain('start="5"');
	});

	it('falls back to start=1 when start= is non-numeric or zero', async () => {
		const html = await compileMd2(
			['::::steps{start=abc}', ':::step[A]', 'a', ':::', '::::'].join('\n')
		);
		expect(html).toContain('start="1"');
	});

	it('renders step header and body wrappers', async () => {
		const html = await compileMd2(
			['::::steps', ':::step[Install]', 'body', ':::', '::::'].join('\n')
		);
		expect(html).toContain('<header class="md2-step-header">Install</header>');
		expect(html).toContain('<div class="md2-step-body">');
		expect(html).toContain('body');
		expect(html).toContain('md2-step-marker');
	});

	it('applies status class + data-status when allowed', async () => {
		const html = await compileMd2(
			[
				'::::steps',
				':::step[A]{status=current}',
				'body',
				':::',
				':::step[B]{status=done}',
				'body',
				':::',
				':::step[C]{status=pending}',
				'body',
				':::',
				'::::'
			].join('\n')
		);
		expect(html).toContain('md2-step-current');
		expect(html).toContain('data-status="current"');
		expect(html).toContain('md2-step-done');
		expect(html).toContain('data-status="done"');
		expect(html).toContain('md2-step-pending');
		expect(html).toContain('data-status="pending"');
	});

	it('drops invalid status values', async () => {
		const html = await compileMd2(
			['::::steps', ':::step[A]{status=bogus}', 'body', ':::', '::::'].join('\n')
		);
		expect(html).not.toContain('md2-step-bogus');
		expect(html).not.toContain('data-status="bogus"');
		// Step still rendered.
		expect(html).toContain('md2-step-header');
	});

	it('applies severity class + data-severity when allowed', async () => {
		const html = await compileMd2(
			['::::steps', ':::step[A]{severity=blocking}', 'body', ':::', '::::'].join('\n')
		);
		expect(html).toContain('md2-step-sev-blocking');
		expect(html).toContain('data-severity="blocking"');
	});

	it('drops invalid severity values on step', async () => {
		const html = await compileMd2(
			['::::steps', ':::step[A]{severity=fubar}', 'body', ':::', '::::'].join('\n')
		);
		expect(html).not.toContain('md2-step-sev-fubar');
	});

	it('omits header when no label and no `label=` attr is provided', async () => {
		const html = await compileMd2(['::::steps', ':::step', 'body', ':::', '::::'].join('\n'));
		expect(html).not.toContain('md2-step-header');
		// Body still rendered.
		expect(html).toContain('<div class="md2-step-body">');
	});

	it('orphan :::step outside :::steps renders empty and emits a diagnostic', async () => {
		const { html, diagnostics } = await compileMd2WithDiagnostics(':::step[Orphan]\nbody\n:::');
		expect(html.trim()).toBe('');
		const orphan = diagnostics.find((d) => d.code === 'MD2_ORPHAN_STEP');
		expect(orphan).toBeDefined();
		expect(orphan?.severity).toBe('warning');
		expect(orphan?.directive).toBe('step');
		expect(orphan?.message).toMatch(/outside ':::steps'/);
	});
});
