import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import { md2DirectiveTransform } from './remark-md2.js';
import { beginDiagnostics, endDiagnostics } from './diagnostics.js';
import type { Diagnostic } from './md2-types.js';
import './prism-langs.js';

const processor = unified()
	.use(remarkParse)
	.use(remarkDirective)
	.use(md2DirectiveTransform)
	.use(remarkRehype, { allowDangerousHtml: true })
	.use(rehypeRaw)
	.use(rehypeStringify, { allowDangerousHtml: true });

/** Compile MD2 source to HTML. */
export async function compileMd2(source: string): Promise<string> {
	beginDiagnostics();
	try {
		const file = await processor.process(source);
		return String(file);
	} finally {
		endDiagnostics();
	}
}

/** Sync variant. */
export function compileMd2Sync(source: string): string {
	beginDiagnostics();
	try {
		const file = processor.processSync(source);
		return String(file);
	} finally {
		endDiagnostics();
	}
}

/** Compile MD2 source and return both HTML and any diagnostics emitted. */
export async function compileMd2WithDiagnostics(
	source: string
): Promise<{ html: string; diagnostics: Diagnostic[] }> {
	beginDiagnostics();
	let html = '';
	let throwErr: unknown = null;
	try {
		const file = await processor.process(source);
		html = String(file);
	} catch (err) {
		throwErr = err;
	}
	const diagnostics = endDiagnostics();
	if (throwErr) {
		// Surface upstream pipeline errors alongside any partial diagnostics.
		diagnostics.push({
			severity: 'error',
			message: throwErr instanceof Error ? throwErr.message : String(throwErr),
			code: 'MD2_COMPILE_THROW'
		});
	}
	return { html, diagnostics };
}

export type { Diagnostic } from './md2-types.js';
