// TODO: BUG — :::event[label] with a colon in the label (e.g. `event[12:01]`) is
// truncated at the colon by upstream remark-directive label parsing. md2-spec.md
// shows `:::event[2026-05-14 12:01]` so this is a real spec violation. Worked
// around in non-skipped tests by using colon-free labels (`12-01`); a `.skip` test
// captures the SPEC expectation.

import { describe, it, expect } from 'vitest';
import { compileMd2 } from './compile.js';

describe('timeline / event directives', () => {
	it('renders <ol class="md2-timeline"> containing one <li> per event', async () => {
		const src = [
			'::::timeline',
			':::event[T1]{severity=blocking}',
			'first',
			':::',
			':::event[T2]{severity=success}',
			'second',
			':::',
			'::::'
		].join('\n');
		const html = await compileMd2(src);
		expect(html).toContain('<ol class="md2-timeline">');
		const events = html.match(/class="md2-timeline-event[^"]*"/g) ?? [];
		expect(events.length).toBe(2);
	});

	it('renders a title header when `title=` is set', async () => {
		const html = await compileMd2(
			['::::timeline{title="Incident timeline"}', ':::event[T1]', 'first', ':::', '::::'].join('\n')
		);
		expect(html).toContain('md2-timeline-title');
		expect(html).toContain('Incident timeline');
	});

	it('applies severity class and data-severity to each event', async () => {
		const html = await compileMd2(
			['::::timeline', ':::event[T1]{severity=blocking}', 'first', ':::', '::::'].join('\n')
		);
		expect(html).toContain('md2-timeline-event-blocking');
		expect(html).toContain('data-severity="blocking"');
	});

	it('emits a severity-tinted dot span on every event', async () => {
		const html = await compileMd2(
			['::::timeline', ':::event[T1]{severity=warning}', 'first', ':::', '::::'].join('\n')
		);
		expect(html).toContain('md2-timeline-dot');
		expect(html).toContain('md2-timeline-dot-warning');
		expect(html).toContain('aria-hidden="true"');
	});

	it('emits a <time> element with dateTime + class when [label] is provided', async () => {
		const html = await compileMd2(
			['::::timeline', ':::event[2026-05-14]', 'body', ':::', '::::'].join('\n')
		);
		expect(html).toContain(
			'<time class="md2-timeline-when" datetime="2026-05-14">2026-05-14</time>'
		);
	});

	it('omits severity classes/data when severity is invalid', async () => {
		const html = await compileMd2(
			['::::timeline', ':::event[T1]{severity=fubar}', 'body', ':::', '::::'].join('\n')
		);
		expect(html).not.toContain('md2-timeline-event-fubar');
		expect(html).not.toContain('md2-timeline-dot-fubar');
		expect(html).not.toContain('data-severity="fubar"');
		// Still rendered, just without severity styling.
		expect(html).toContain('md2-timeline-event');
	});

	it('event labels containing a colon are preserved (md2-spec L939)', async () => {
		const html = await compileMd2(
			['::::timeline', ':::event[12:01]', 'body', ':::', '::::'].join('\n')
		);
		expect(html).toContain('datetime="12:01"');
		expect(html).toContain('>12:01<');
	});
});
