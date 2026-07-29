import { describe, it, expect, afterAll } from 'vitest';

/* Guards the *committed* browser bundle — the file jsDelivr serves straight from
 * git — against import-time side effects on the host document.
 *
 * Prism's main entry bundles its auto-run and its file-highlight plugin. Left
 * alone, importing this bundle registers a DOMContentLoaded handler, highlights
 * the host page's DOM, and fetches every `pre[data-src]` URL it finds there.
 * scripts/bundle-browser.mjs sets Prism's `manual` flag in a banner to prevent
 * that; this test fails if a dependency bump ever brings it back. */

const original = {
	window: (globalThis as Record<string, unknown>).window,
	document: (globalThis as Record<string, unknown>).document,
	Element: (globalThis as Record<string, unknown>).Element,
	XMLHttpRequest: (globalThis as Record<string, unknown>).XMLHttpRequest
};

afterAll(() => {
	for (const [key, value] of Object.entries(original)) {
		if (value === undefined) delete (globalThis as Record<string, unknown>)[key];
		else (globalThis as Record<string, unknown>)[key] = value;
	}
});

describe('committed browser bundle', () => {
	it('imports without touching the host document', async () => {
		const listeners: string[] = [];
		const requests: string[] = [];
		const selectors: string[] = [];

		class StubElement {}
		(StubElement.prototype as Record<string, unknown>).matches = () => false;

		const g = globalThis as Record<string, unknown>;
		g.Element = StubElement;
		g.window = globalThis;
		g.document = {
			readyState: 'loading',
			currentScript: null,
			addEventListener: (type: string) => listeners.push(type),
			removeEventListener: () => {},
			querySelectorAll: (sel: string) => {
				selectors.push(sel);
				return [];
			},
			getElementsByTagName: () => [],
			createElement: () => ({
				style: {},
				setAttribute() {},
				appendChild() {},
				classList: { add() {} }
			})
		};
		g.XMLHttpRequest = class {
			open(method: string, url: string) {
				requests.push(`${method} ${url}`);
			}
			setRequestHeader() {}
			send() {}
		};

		const mod = await import('../browser/md2.js');

		expect(listeners).toEqual([]);
		expect(requests).toEqual([]);
		expect(selectors).toEqual([]);

		// …and highlighting still works, so the fix didn't disable Prism itself.
		const html = await (mod as { compileMd2: (s: string) => Promise<string> }).compileMd2(
			[':::annotate-code{lang=ts}', '```ts', 'const a = 1;', '```', '', '@1 info: note', ':::'].join(
				'\n'
			)
		);
		expect(html).toContain('class="token');
	});
});
