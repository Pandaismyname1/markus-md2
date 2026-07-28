import { describe, it, expect } from 'vitest';
import { upgradeMarkdown } from './index.js';

function lines(...l: string[]): string {
	return l.join('\n');
}

describe('upgradeMarkdown — callout rules', () => {
	it('callout-note: promotes `> **Note:**` blockquote to :::callout severity=info', () => {
		const src = lines('> **Note:** server caches for 5m.', '> Restart to bust.');
		const { source, diagnostics } = upgradeMarkdown(src);
		expect(source).toContain(':::callout{severity=info}');
		expect(source).toContain('server caches for 5m.');
		expect(source).toContain('Restart to bust.');
		expect(source).not.toMatch(/\*\*Note:\*\*/);
		expect(source.trimEnd().endsWith(':::')).toBe(true);
		const applied = diagnostics.filter((d) => d.code === 'MD2_UPGRADE_APPLIED');
		expect(applied).toHaveLength(1);
		expect(applied[0].directive).toBe('callout-note');
		expect(applied[0].line).toBe(1);
	});

	it('callout-note: also triggers on `> 💡` prefix', () => {
		const src = '> 💡 read the spec first';
		const { source, diagnostics } = upgradeMarkdown(src);
		expect(source).toContain(':::callout{severity=info}');
		expect(source).toContain('read the spec first');
		expect(diagnostics.filter((d) => d.code === 'MD2_UPGRADE_APPLIED')).toHaveLength(1);
	});

	it('callout-warning: `> **Warning:**` → severity=warning', () => {
		const src = '> **Warning:** quotas reset at midnight';
		const { source, diagnostics } = upgradeMarkdown(src);
		expect(source).toContain(':::callout{severity=warning}');
		expect(source).toContain('quotas reset at midnight');
		expect(diagnostics.find((d) => d.directive === 'callout-warning')).toBeTruthy();
	});

	it('callout-blocking: `> **Important:**` → severity=blocking', () => {
		const src = '> **Important:** rotate the secret';
		const { source } = upgradeMarkdown(src);
		expect(source).toContain(':::callout{severity=blocking}');
		expect(source).toContain('rotate the secret');
	});

	it('callout-success: `> ✅` → severity=success', () => {
		const src = '> ✅ all green';
		const { source } = upgradeMarkdown(src);
		expect(source).toContain(':::callout{severity=success}');
		expect(source).toContain('all green');
	});

	it('NEGATIVE: blockquote without recognised prefix is left alone', () => {
		const src = '> just a quote';
		const { source, diagnostics } = upgradeMarkdown(src);
		expect(source).toBe('> just a quote');
		expect(diagnostics.filter((d) => d.code === 'MD2_UPGRADE_APPLIED')).toHaveLength(0);
	});

	it('NEGATIVE: `> Note: foo` (no bold) is NOT upgraded — conservative', () => {
		const src = '> Note: this is not bold';
		const { source } = upgradeMarkdown(src);
		expect(source).toBe('> Note: this is not bold');
	});
});

describe('upgradeMarkdown — steps rule', () => {
	it('promotes a numbered list of **Step N:** items to ::::steps', () => {
		const src = lines(
			'1. **Step 1:** Install deps',
			'2. **Step 2:** Run migrations',
			'3. **Step 3:** Start the server'
		);
		const { source, diagnostics } = upgradeMarkdown(src);
		expect(source).toContain('::::steps');
		expect(source).toContain(':::step[Install deps]');
		expect(source).toContain(':::step[Run migrations]');
		expect(source).toContain(':::step[Start the server]');
		expect(source.trimEnd().endsWith('::::')).toBe(true);
		const applied = diagnostics.filter((d) => d.code === 'MD2_UPGRADE_APPLIED');
		expect(applied).toHaveLength(1);
		expect(applied[0].directive).toBe('steps');
	});

	it('also triggers on `**N.** Title` form', () => {
		const src = lines('1. **1.** First', '2. **2.** Second');
		const { source } = upgradeMarkdown(src);
		expect(source).toContain('::::steps');
		expect(source).toContain(':::step[First]');
		expect(source).toContain(':::step[Second]');
	});

	it('preserves step body lines that follow the title', () => {
		const src = lines(
			'1. **Step 1:** Install',
			'   ```bash',
			'   npm install',
			'   ```',
			'2. **Step 2:** Build',
			'   Run the bundler.'
		);
		const { source } = upgradeMarkdown(src);
		expect(source).toContain(':::step[Install]');
		expect(source).toContain('npm install');
		expect(source).toContain(':::step[Build]');
		expect(source).toContain('Run the bundler.');
	});

	it('NEGATIVE: numbering mismatch leaves list alone', () => {
		const src = lines('1. **Step 1:** First', '2. **Step 99:** Wrong N');
		const { source, diagnostics } = upgradeMarkdown(src);
		expect(source).toBe(src);
		expect(diagnostics.filter((d) => d.code === 'MD2_UPGRADE_APPLIED')).toHaveLength(0);
	});

	it('NEGATIVE: only one item has the **Step N:** prefix → no upgrade', () => {
		const src = lines('1. **Step 1:** First', '2. Second item with no prefix');
		const { source } = upgradeMarkdown(src);
		expect(source).toBe(src);
	});

	it('NEGATIVE: unordered list is never a steps candidate', () => {
		const src = lines('- **Step 1:** First', '- **Step 2:** Second');
		const { source } = upgradeMarkdown(src);
		expect(source).toBe(src);
	});
});

describe('upgradeMarkdown — annotate-code rule', () => {
	it('promotes a fenced code block with `// highlight: 2-3` first line', () => {
		const src = lines('```js', '// highlight: 2-3', 'const a = 1;', 'const b = 2;', '```');
		const { source, diagnostics } = upgradeMarkdown(src);
		expect(source).toContain(':::annotate-code{lines=2-3}');
		expect(source).toContain('```js');
		expect(source).toContain('const a = 1;');
		expect(source).toContain('const b = 2;');
		expect(source).not.toContain('// highlight:');
		expect(source.trimEnd().endsWith(':::')).toBe(true);
		const applied = diagnostics.filter((d) => d.code === 'MD2_UPGRADE_APPLIED');
		expect(applied).toHaveLength(1);
		expect(applied[0].directive).toBe('annotate-code');
	});

	it('also triggers on `# focus: N-M` first line', () => {
		const src = lines('```py', '# focus: 1-2', 'a = 1', 'b = 2', '```');
		const { source } = upgradeMarkdown(src);
		expect(source).toContain(':::annotate-code{lines=1-2}');
		expect(source).toContain('a = 1');
		expect(source).not.toContain('# focus:');
	});

	it('NEGATIVE: fenced code without the special first line is left alone', () => {
		const src = lines('```js', 'const a = 1;', '```');
		const { source } = upgradeMarkdown(src);
		expect(source).toBe(src);
	});

	it('NEGATIVE: reversed N-M range is left alone', () => {
		const src = lines('```js', '// highlight: 5-2', 'a', '```');
		const { source } = upgradeMarkdown(src);
		expect(source).toBe(src);
	});
});

describe('upgradeMarkdown — pros/cons columns', () => {
	it('promotes adjacent ### Pros + ### Cons to :::columns', () => {
		const src = lines(
			'## Choices',
			'',
			'### Pros',
			'',
			'- faster',
			'- cheaper',
			'',
			'### Cons',
			'',
			'- harder to migrate'
		);
		const { source, diagnostics } = upgradeMarkdown(src);
		expect(source).toContain('::::columns');
		expect(source).toContain(':::column[Pros]');
		expect(source).toContain(':::column[Cons]');
		expect(source).toContain('faster');
		expect(source).toContain('harder to migrate');
		const applied = diagnostics.filter((d) => d.code === 'MD2_UPGRADE_APPLIED');
		expect(applied).toHaveLength(1);
		expect(applied[0].directive).toBe('pros-cons-columns');
	});

	it('NEGATIVE: only Pros, no Cons → no upgrade', () => {
		const src = lines('### Pros', '', '- faster');
		const { source } = upgradeMarkdown(src);
		expect(source).toBe(src);
	});
});

describe('upgradeMarkdown — directive-aware safety', () => {
	it('content already inside :::callout is NOT re-upgraded', () => {
		const src = lines(':::callout{severity=info}', '> **Note:** hello', ':::');
		const { source, diagnostics } = upgradeMarkdown(src);
		expect(source).toBe(src);
		expect(diagnostics.filter((d) => d.code === 'MD2_UPGRADE_APPLIED')).toHaveLength(0);
	});

	it('mixed input: applies outside-of-directive rules and skips inside-directive content', () => {
		const src = lines(
			'> **Warning:** outside',
			'',
			':::callout{severity=info}',
			'> **Note:** inside (must not be re-upgraded)',
			':::'
		);
		const { source } = upgradeMarkdown(src);
		expect(source).toContain(':::callout{severity=warning}');
		expect(source).toContain('> **Note:** inside (must not be re-upgraded)');
	});
});

describe('upgradeMarkdown — idempotency', () => {
	it('callout: upgrade(upgrade(x)) === upgrade(x)', () => {
		const x = '> **Note:** hello';
		const once = upgradeMarkdown(x).source;
		const twice = upgradeMarkdown(once).source;
		expect(twice).toBe(once);
	});

	it('steps: upgrade(upgrade(x)) === upgrade(x)', () => {
		const x = lines('1. **Step 1:** First', '2. **Step 2:** Second');
		const once = upgradeMarkdown(x).source;
		const twice = upgradeMarkdown(once).source;
		expect(twice).toBe(once);
	});

	it('annotate-code: upgrade(upgrade(x)) === upgrade(x)', () => {
		const x = lines('```js', '// highlight: 1-2', 'a', 'b', '```');
		const once = upgradeMarkdown(x).source;
		const twice = upgradeMarkdown(once).source;
		expect(twice).toBe(once);
	});

	it('mixed input idempotency', () => {
		const x = lines(
			'> **Note:** start',
			'',
			'1. **Step 1:** First',
			'2. **Step 2:** Second',
			'',
			'```js',
			'// highlight: 1-1',
			'const a = 1;',
			'```'
		);
		const once = upgradeMarkdown(x).source;
		const twice = upgradeMarkdown(once).source;
		expect(twice).toBe(once);
	});
});

describe('upgradeMarkdown — diagnostics', () => {
	it('emits exactly one MD2_UPGRADE_APPLIED per rule firing', () => {
		const src = lines(
			'> **Note:** A',
			'',
			'> **Warning:** B',
			'',
			'1. **Step 1:** First',
			'2. **Step 2:** Second'
		);
		const { diagnostics } = upgradeMarkdown(src);
		const applied = diagnostics.filter((d) => d.code === 'MD2_UPGRADE_APPLIED');
		expect(applied).toHaveLength(3);
		const rules = applied.map((d) => d.directive).sort();
		expect(rules).toEqual(['callout-note', 'callout-warning', 'steps']);
	});

	it('diagnostic carries the originating line number', () => {
		const src = lines('intro', '', '> **Note:** A');
		const { diagnostics } = upgradeMarkdown(src);
		const d = diagnostics.find((dx) => dx.code === 'MD2_UPGRADE_APPLIED');
		expect(d).toBeDefined();
		expect(d!.line).toBe(3);
	});
});
