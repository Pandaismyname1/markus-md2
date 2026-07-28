// Centralized Prism language registration. Order matters — some languages
// extend or depend on earlier ones. Imported for side effects.

// `prismjs` main entry bundles core + markup + css + clike + javascript.
// Importing those components again here would reset the markup grammar and
// break `markup.tag.addAttribute`, which jsx/tsx depend on. Only load the
// additional grammars we need on top of the bundle.
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-jsx.js';
import 'prismjs/components/prism-tsx.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-rust.js';
import 'prismjs/components/prism-go.js';

// Prism's TypeScript-side typings don't expose `extend` / `insertBefore` on
// the `languages` map; cast to a permissive shape for grammar surgery only.
type PrismLanguages = Record<string, unknown> & {
	extend: (id: string, redef: Record<string, unknown>) => Record<string, unknown>;
	insertBefore: (
		inside: string,
		before: string,
		insert: Record<string, unknown>
	) => Record<string, unknown>;
};

const langs = Prism.languages as unknown as PrismLanguages;

// Svelte: Prism has no first-party grammar. Approximate it as a markup
// superset that recognises <script lang="ts"> bodies as TypeScript and
// {expression} interpolations. Good enough for demos.
if (!langs.svelte) {
	langs.svelte = langs.extend('markup', {
		script: {
			pattern: /(<script[\s\S]*?>)[\s\S]*?(?=<\/script>)/i,
			lookbehind: true,
			inside: langs.typescript
		},
		style: {
			pattern: /(<style[\s\S]*?>)[\s\S]*?(?=<\/style>)/i,
			lookbehind: true,
			inside: langs.css
		}
	});
	// Mustache-style {expression} blocks and {#each ...} {#if ...} {/each} directives
	langs.insertBefore('svelte', 'tag', {
		'svelte-block': {
			pattern: /\{[#/:][a-z]+[^}]*\}/,
			inside: langs.typescript
		},
		'svelte-expr': {
			pattern: /\{[^{}]+\}/,
			inside: langs.typescript
		}
	});
}

export const aliases: Record<string, string> = {
	ts: 'typescript',
	tsx: 'tsx',
	js: 'javascript',
	jsx: 'jsx',
	py: 'python',
	rs: 'rust',
	sh: 'bash',
	shell: 'bash',
	html: 'markup',
	xml: 'markup',
	yml: 'yaml'
};

/**
 * Highlight one line of source to HTML using Prism. Falls back to escaped
 * plain text when the language is unknown or empty.
 */
export function highlightLine(source: string, lang: string): string {
	const key = (aliases[lang] || lang || '').toLowerCase();
	const grammar = key && (langs[key] as Prism.Grammar | undefined);
	if (!grammar) return escapeHtml(source);
	try {
		return Prism.highlight(source, grammar, key);
	} catch {
		return escapeHtml(source);
	}
}

function escapeHtml(s: string): string {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export { Prism };
