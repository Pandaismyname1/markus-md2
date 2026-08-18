import { describe, it, expect } from 'vitest';
import { compileMd2 } from './compile.js';
import { upgradeMarkdown } from './upgrade/index.js';

/* remark-parse alone is CommonMark, which has no tables: a pipe table used to
 * fall through as a single paragraph with soft line breaks. remark-gfm is what
 * makes the table syntax the README, the skill and every fixture already use
 * actually compile. */
describe('GFM tables', () => {
	const table = [
		'| Attribute | Required | Meaning |',
		'| --- | :---: | ---: |',
		'| `data-key` | yes | Public key |',
		'| `data-api` | no | API origin |'
	].join('\n');

	it('compiles a pipe table to a real table element', async () => {
		const html = await compileMd2(table);
		expect(html).toContain('<table>');
		expect(html).toContain('<thead>');
		expect(html).toContain('<th>Attribute</th>');
		expect(html).toContain('<td><code>data-key</code></td>');
		// The delimiter row must not leak into the output as text.
		expect(html).not.toContain('| --- |');
	});

	it('carries column alignment from the delimiter row', async () => {
		const html = await compileMd2(table);
		expect(html).toContain('<th align="center">Required</th>');
		expect(html).toContain('<th align="right">Meaning</th>');
	});

	it('compiles a table nested inside a directive container', async () => {
		const html = await compileMd2(`:::callout{severity=info}\n${table}\n:::`);
		expect(html).toContain('class="md2-callout md2-callout-info"');
		expect(html).toContain('<td><code>data-api</code></td>');
	});

	it('leaves a table alone through the upgrade pass', () => {
		const { source } = upgradeMarkdown(`## Attributes\n\n${table}\n`);
		expect(source).toContain('| `data-key` | yes | Public key |');
	});
});

describe('other GFM syntax', () => {
	it('renders strikethrough, task lists and autolinks', async () => {
		const html = await compileMd2(
			'~~gone~~\n\n- [x] done\n- [ ] todo\n\nhttps://example.com'
		);
		expect(html).toContain('<del>gone</del>');
		expect(html).toContain('type="checkbox"');
		expect(html).toContain('<a href="https://example.com">');
	});

	it('still parses directives alongside GFM', async () => {
		const html = await compileMd2(':::callout{severity=warning}\n~~old~~ plan\n:::');
		expect(html).toContain('md2-callout-warning');
		expect(html).toContain('<del>old</del>');
	});
});
